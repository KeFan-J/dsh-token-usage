/**
 * dsh-token-usage — host half.
 *
 * Token usage & cost dashboard for DeepSeek Harness (DSH).
 *
 * Data comes from the durable session log, exactly like the product does:
 * every model call appends an `assistant/message` event carrying a `usage`
 * record (input / output / cache-read / cache-write / reasoning tokens), and
 * `request/header` events carry the provider/model of each call. This host
 * half listens to the global `session/event` firehose (all sessions) and, on
 * start, replays every persisted session log so history survives restarts and
 * pre-install usage is included.
 *
 * Folded per day (and per day×model, day×project for breakdowns):
 *   - token totals (today / this week / this month / all-time)
 *   - peak-hour splits (UTC 01:00-04:00 / 06:00-10:00) for peak/off-peak billing
 *   - thinking duration (first → last `reasoning-delta` chunk of each step)
 *   - task duration (turn/start → turn/end), task count, step count
 *   - per-task totals (title from the turn's first user message) for a Top-3
 *   - per-model and per-project (session cwd) rankings
 *
 * Cost estimation uses DeepSeek's official pricing (standard & peak/off-peak
 * sets, USD or CNY), fetched live from api-docs.deepseek.com via a resilient
 * Docusaurus chunk-chain parser, or set manually. Effective rates switch
 * automatically at the announced change date and apply ×2 during peak hours.
 *
 * The browser half talks to this half through /api/dsh-token-usage/* JSON
 * routes (see routes below).
 */
const name = 'dsh-token-usage'
const inject = ['webServer']

function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'referrer-policy': 'no-referrer',
  })
  res.end(payload)
}

async function readJson(req, res) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
    if (chunks.reduce((n, c) => n + c.length, 0) > 1_000_000) return null
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

function apply(ctx) {
  const log = (...a) => console.log('[dsh-token-usage]', ...a)
  const err = (...a) => console.error('[dsh-token-usage]', ...a)

  // ------------------------------------------------------------------
  // state & helpers
  // ------------------------------------------------------------------
  const emptyFold = () => ({ in: 0, out: 0, cr: 0, cw: 0, r: 0 })
  const dayKey = (t) => {
    const d = new Date(t)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  }
  const isPeakUtc = (t) => {
    const h = new Date(t).getUTCHours()
    return (h >= 1 && h < 4) || (h >= 6 && h < 10)
  }
  const titleOf = (content) => {
    if (!Array.isArray(content)) return ''
    for (const b of content) {
      if (b && b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        const s = b.text.trim().replace(/\s+/g, ' ')
        return s.length > 48 ? `${s.slice(0, 48)}…` : s
      }
    }
    return ''
  }

  const days = new Map() // dateKey -> fold (all usage)
  const peakFolds = new Map() // dateKey -> fold (peak-hour usage only)
  const modelDays = new Map() // dateKey -> Map(modelKey -> fold)
  const modelPeak = new Map() // dateKey -> Map(modelKey -> fold)
  const projectDays = new Map() // projectKey -> Map(dateKey -> Map(modelKey -> fold))
  const projectPeakDays = new Map()
  const sessionDays = new Map() // sessionId -> Map(dateKey -> fold + capture-time cost)
  const sessionProject = new Map() // sessionId -> projectKey (last seen cwd)
  const thinkMs = new Map()
  const turnMs = new Map()
  const taskCount = new Map()
  const stepCount = new Map()
  const seen = new Set() // 'sessionId:seq' dedupe between live feed and replay
  const sessionModel = new Map()
  const liveSteps = new Map()
  const liveTurns = new Map()
  const liveCurTurn = new Map()
  const tasks = [] // finalized per-turn records (bounded)
  const TASK_CAP = 3000
  let scanning = false
  const bump = (map, k, v) => map.set(k, (map.get(k) || 0) + v)

  // ------------------------------------------------------------------
  // pricing
  // ------------------------------------------------------------------
  const CHANGE_EPOCH = Date.parse('2026-08-16T16:00:00Z')
  const DEFAULT_MODELS = {
    'deepseek-v4-flash': {
      base: { cacheHit: 0.0028, cacheMiss: 0.14, output: 0.28 },
      offPeak: { cacheHit: 0.007, cacheMiss: 0.22, output: 0.66 },
    },
    'deepseek-v4-pro': {
      base: { cacheHit: 0.003625, cacheMiss: 0.435, output: 0.87 },
      offPeak: { cacheHit: 0.022, cacheMiss: 0.66, output: 1.98 },
    },
  }
  let priceState = {
    currency: '$',
    source: 'DeepSeek 官网（内置，2026-08-14 解析）',
    updatedAt: null,
    changeEpoch: CHANGE_EPOCH,
    models: DEFAULT_MODELS,
  }
  const priceOverrides = new Map()

  const effectiveOf = (model) => {
    const p = priceState.models[model]
    if (!p) return null
    const override = priceOverrides.get(model)
    if (override === 'base' || override === 'offPeak') {
      const set = override === 'offPeak' ? p.offPeak : p.base
      return set
        ? { key: override, cacheHit: set.cacheHit, cacheMiss: set.cacheMiss, output: set.output }
        : null
    }
    if (Date.now() >= priceState.changeEpoch && p.offPeak) {
      return { key: 'offPeak', cacheHit: p.offPeak.cacheHit, cacheMiss: p.offPeak.cacheMiss, output: p.offPeak.output }
    }
    if (p.base) return { key: 'base', cacheHit: p.base.cacheHit, cacheMiss: p.base.cacheMiss, output: p.base.output }
    return null
  }
  const costFold = (fold, eff, peak) => {
    if (!eff) return 0
    const mult = eff.key === 'offPeak' && peak ? 2 : 1
    return ((fold.in + fold.cw) * eff.cacheMiss + fold.cr * eff.cacheHit + fold.out * eff.output) * mult / 1e6
  }
  const priceSnapshot = () => {
    const pricesOut = {}
    for (const name of Object.keys(priceState.models)) {
      pricesOut[name] = {
        base: priceState.models[name].base || null,
        offPeak: priceState.models[name].offPeak || null,
        override: priceOverrides.get(name) || '',
      }
    }
    return {
      currency: priceState.currency,
      source: priceState.source,
      updatedAt: priceState.updatedAt,
      changeEpoch: priceState.changeEpoch,
      models: pricesOut,
    }
  }
  const setPrices = (input) => {
    if (!input || typeof input !== 'object') return { ok: false, error: '参数无效' }
    const next = {}
    for (const name of Object.keys(input)) {
      const m = input[name]
      const clean = {}
      for (const key of ['base', 'offPeak']) {
        const set = m && m[key]
        if (set && typeof set === 'object') {
          clean[key] = {
            cacheHit: Number(set.cacheHit) || 0,
            cacheMiss: Number(set.cacheMiss) || 0,
            output: Number(set.output) || 0,
          }
        }
      }
      if (clean.base || clean.offPeak) next[name] = clean
      const ov = m && m.override
      if (ov === 'base' || ov === 'offPeak') priceOverrides.set(name, ov)
      else if (ov === '') priceOverrides.delete(name)
    }
    if (Object.keys(next).length) priceState.models = next
    priceState.source = '手动设置'
    priceState.updatedAt = Date.now()
    return { ok: true }
  }

  // ------------------------------------------------------------------
  // capture: live feed + history replay
  // ------------------------------------------------------------------
  const addUsage = (time, usage, sessionId, seq, modelKey, projectKey) => {
    if (!usage || typeof usage !== 'object') return
    const key = `${sessionId}:${seq}`
    if (seen.has(key)) return
    seen.add(key)
    const k = dayKey(time)
    const uin = usage.inputTokens || 0
    const uout = usage.outputTokens || 0
    const ucr = usage.cacheReadTokens || 0
    const ucw = usage.cacheWriteTokens || 0
    const ur = usage.reasoningTokens || 0
    const peak = isPeakUtc(time)

    let fold = days.get(k)
    if (!fold) { fold = emptyFold(); days.set(k, fold) }
    fold.in += uin; fold.out += uout; fold.cr += ucr; fold.cw += ucw; fold.r += ur
    if (peak) {
      let pf = peakFolds.get(k)
      if (!pf) { pf = emptyFold(); peakFolds.set(k, pf) }
      pf.in += uin; pf.out += uout; pf.cr += ucr; pf.cw += ucw; pf.r += ur
    }

    const mk = modelKey || 'unknown'
    let mds = modelDays.get(k)
    if (!mds) { mds = new Map(); modelDays.set(k, mds) }
    let mf = mds.get(mk)
    if (!mf) { mf = emptyFold(); mds.set(mk, mf) }
    mf.in += uin; mf.out += uout; mf.cr += ucr; mf.cw += ucw; mf.r += ur
    if (peak) {
      let mps = modelPeak.get(k)
      if (!mps) { mps = new Map(); modelPeak.set(k, mps) }
      let mpf = mps.get(mk)
      if (!mpf) { mpf = emptyFold(); mps.set(mk, mpf) }
      mpf.in += uin; mpf.out += uout; mpf.cr += ucr; mpf.cw += ucw; mpf.r += ur
    }

    const pk = projectKey || '未指定项目'
    let pds = projectDays.get(pk)
    if (!pds) { pds = new Map(); projectDays.set(pk, pds) }
    let pmds = pds.get(k)
    if (!pmds) { pmds = new Map(); pds.set(k, pmds) }
    let pmf = pmds.get(mk)
    if (!pmf) { pmf = emptyFold(); pmds.set(mk, pmf) }
    pmf.in += uin; pmf.out += uout; pmf.cr += ucr; pmf.cw += ucw; pmf.r += ur
    if (peak) {
      let ppds = projectPeakDays.get(pk)
      if (!ppds) { ppds = new Map(); projectPeakDays.set(pk, ppds) }
      let ppms = ppds.get(k)
      if (!ppms) { ppms = new Map(); ppds.set(k, ppms) }
      let ppf = ppms.get(mk)
      if (!ppf) { ppf = emptyFold(); ppms.set(mk, ppf) }
      ppf.in += uin; ppf.out += uout; ppf.cr += ucr; ppf.cw += ucw; ppf.r += ur
    }

    const sid = String(sessionId)
    let sds = sessionDays.get(sid)
    if (!sds) { sds = new Map(); sessionDays.set(sid, sds) }
    let sf = sds.get(k)
    if (!sf) { sf = Object.assign(emptyFold(), { cost: 0 }); sds.set(k, sf) }
    sf.in += uin; sf.out += uout; sf.cr += ucr; sf.cw += ucw; sf.r += ur
    const eff = effectiveOf((mk || '').split('/').pop())
    if (eff) sf.cost += costFold({ in: uin, out: uout, cr: ucr, cw: ucw }, eff, peak)
    if (projectKey) sessionProject.set(sid, projectKey)
  }

  const recordEvent = (sessionId, event, state, projectKey) => {
    try {
      if (!event) return
      const data = event.data || {}
      const t = event.time
      const type = event.type
      const turns = state ? state.turns : liveTurns.get(sessionId)
      if (type === 'request/header') {
        const cfg = data.header && data.header.config
        if (cfg && cfg.model) {
          const mk = `${cfg.provider ? `${cfg.provider}/` : ''}${cfg.model}`
          if (state) state.model = mk
          else sessionModel.set(sessionId, mk)
        }
        return
      }
      if (type === 'turn/start') {
        const turn = data.turn
        if (turns && turn !== undefined) {
          turns.set(turn, { start: t, in: 0, out: 0, cr: 0, cw: 0, r: 0, cost: 0, title: '' })
          if (state) state.curTurn = turn
          else liveCurTurn.set(sessionId, turn)
        }
        return
      }
      if (type === 'user/message') {
        const cur = state ? state.curTurn : liveCurTurn.get(sessionId)
        if (cur !== undefined && turns) {
          const rec = turns.get(cur)
          if (rec && !rec.title) rec.title = titleOf(data.content)
        }
        return
      }
      if (type === 'step/start') {
        const sk = `${data.turn}:${data.step}`
        const steps = state ? state.steps : liveSteps.get(sessionId)
        if (steps && data.turn !== undefined) steps.set(sk, { start: t })
        return
      }
      if (type === 'assistant/chunk') {
        const c = data.chunk
        if (c && c.type === 'reasoning-delta') {
          const steps = state ? state.steps : liveSteps.get(sessionId)
          const s = steps && steps.get(`${data.turn}:${data.step}`)
          if (s) {
            if (!s.thinkStart || t < s.thinkStart) s.thinkStart = t
            if (!s.thinkLast || t > s.thinkLast) s.thinkLast = t
          }
        }
        return
      }
      if (type === 'assistant/message') {
        if (!data.usage) return
        let mk
        if (state) mk = state.model
        else mk = sessionModel.get(sessionId)
        addUsage(t, data.usage, sessionId, event.seq, mk, projectKey)
        if (turns && data.turn !== undefined) {
          const rec = turns.get(data.turn)
          if (rec) {
            rec.in += data.usage.inputTokens || 0
            rec.out += data.usage.outputTokens || 0
            rec.cr += data.usage.cacheReadTokens || 0
            rec.cw += data.usage.cacheWriteTokens || 0
            rec.r += data.usage.reasoningTokens || 0
            const eff = effectiveOf((mk || '').split('/').pop())
            if (eff) {
              const uf = {
                in: data.usage.inputTokens || 0,
                out: data.usage.outputTokens || 0,
                cr: data.usage.cacheReadTokens || 0,
                cw: data.usage.cacheWriteTokens || 0,
              }
              rec.cost += costFold(uf, eff, isPeakUtc(t))
            }
          }
        }
        return
      }
      if (type === 'step/end') {
        const sk = `${data.turn}:${data.step}`
        const steps = state ? state.steps : liveSteps.get(sessionId)
        const s = steps && steps.get(sk)
        if (steps) steps.delete(sk)
        const ukey = `${sessionId}:${event.seq}`
        if (seen.has(ukey)) return
        seen.add(ukey)
        const k = dayKey(t)
        bump(stepCount, k, 1)
        if (s && s.start != null && s.thinkStart != null && s.thinkLast != null && s.thinkLast > s.thinkStart) {
          bump(thinkMs, k, s.thinkLast - s.thinkStart)
        }
        return
      }
      if (type === 'turn/end') {
        const turn = data.turn
        const rec = turns && turns.get(turn)
        if (turns) turns.delete(turn)
        if (state) { if (state.curTurn === turn) state.curTurn = undefined }
        else if (liveCurTurn.get(sessionId) === turn) liveCurTurn.delete(sessionId)
        const ukey = `${sessionId}:${event.seq}`
        if (seen.has(ukey)) return
        seen.add(ukey)
        const k = dayKey(t)
        if (rec && rec.start != null && t > rec.start) {
          bump(turnMs, k, t - rec.start)
          bump(taskCount, k, 1)
          tasks.push({
            title: rec.title || '（未命名任务）',
            project: projectKey || '',
            time: t,
            in: rec.in, out: rec.out, cr: rec.cr, cw: rec.cw, r: rec.r,
            total: rec.in + rec.out + rec.cr + rec.cw,
            cost: rec.cost,
            durationMs: t - rec.start,
          })
          if (tasks.length > TASK_CAP) tasks.shift()
        }
        return
      }
    } catch (e) {
      err('recordEvent failed:', e)
    }
  }

  // live capture: root-scoped, sees every session's appended events
  ctx.on('session/event', (session, event) => {
    const sid = session && session.id
    if (sid === undefined) return
    if (!liveSteps.has(sid)) liveSteps.set(sid, new Map())
    if (!liveTurns.has(sid)) liveTurns.set(sid, new Map())
    const cwd = session.header && session.header.cwd
    recordEvent(sid, event, null, cwd)
  })

  // history replay: rebuilds everything from durable session logs
  const replay = async () => {
    scanning = true
    try {
      const query = ctx.get('sessionQuery')
      if (query && typeof query.listSessions === 'function' && typeof query.readSession === 'function') {
        const records = await query.listSessions()
        for (const rec of records || []) {
          const id = rec && rec.header && rec.header.id
          if (!id) continue
          try {
            const snap = await query.readSession(id)
            const events = snap && snap.events ? snap.events : []
            const cwd = (rec.header && rec.header.cwd) || (snap && snap.session && snap.session.cwd)
            const st = { model: undefined, steps: new Map(), turns: new Map(), curTurn: undefined }
            for (const ev of events) recordEvent(id, ev, st, cwd)
          } catch (e) { /* skip unreadable session */ }
        }
      } else {
        const persist = ctx.get('sessionPersistence')
        if (persist && typeof persist.list === 'function' && typeof persist.readFrom === 'function') {
          const headers = await persist.list()
          for (const h of headers || []) {
            const id = h && h.id
            if (!id) continue
            try {
              const read = await persist.readFrom(id, 0)
              const events = read && read.events ? read.events : []
              const cwd = (h && h.cwd) || (read && read.meta && read.meta.cwd)
              const st = { model: undefined, steps: new Map(), turns: new Map(), curTurn: undefined }
              for (const ev of events) recordEvent(id, ev, st, cwd)
            } catch (e) { /* skip unreadable session */ }
          }
        }
      }
    } catch (e) {
      err('replay failed:', e)
    } finally {
      scanning = false
    }
  }
  replay()

  // ------------------------------------------------------------------
  // aggregation
  // ------------------------------------------------------------------
  const dayStartMs = (key) => new Date(`${key}T00:00:00`).getTime()
  const sumOf = (fold) => ({
    in: fold.in, out: fold.out, cr: fold.cr, cw: fold.cw, r: fold.r,
    cache: fold.cr + fold.cw,
    total: fold.in + fold.out + fold.cr + fold.cw,
  })
  const sumMap = (map, startMs, endMs) => {
    let total = 0
    for (const entry of map) {
      const t = dayStartMs(entry[0])
      if (t >= startMs && t < endMs) total += entry[1]
    }
    return total
  }
  const periodCost = (startMs, endMs) => {
    let cost = 0
    for (const entry of modelDays) {
      const k = entry[0]
      const t = dayStartMs(k)
      if (t < startMs || t >= endMs) continue
      const mds = entry[1]
      const mps = modelPeak.get(k) || new Map()
      for (const pair of mds) {
        const mf = pair[1]
        const eff = effectiveOf(pair[0].split('/').pop())
        if (!eff) continue
        const pf = mps.get(pair[0]) || emptyFold()
        const non = { in: mf.in - pf.in, out: mf.out - pf.out, cr: mf.cr - pf.cr, cw: mf.cw - pf.cw }
        cost += costFold(non, eff, false) + costFold(pf, eff, true)
      }
    }
    return cost
  }
  const costForDay = (k) => {
    const mds = modelDays.get(k)
    if (!mds) return 0
    const mps = modelPeak.get(k) || new Map()
    let cost = 0
    for (const pair of mds) {
      const mf = pair[1]
      const eff = effectiveOf(pair[0].split('/').pop())
      if (!eff) continue
      const pf = mps.get(pair[0]) || emptyFold()
      const non = { in: mf.in - pf.in, out: mf.out - pf.out, cr: mf.cr - pf.cr, cw: mf.cw - pf.cw }
      cost += costFold(non, eff, false) + costFold(pf, eff, true)
    }
    return cost
  }
  const rangeFold = (startMs, endMs) => {
    const fold = emptyFold()
    for (const entry of days) {
      const t = dayStartMs(entry[0])
      if (t >= startMs && t < endMs) {
        const f = entry[1]
        fold.in += f.in; fold.out += f.out; fold.cr += f.cr; fold.cw += f.cw; fold.r += f.r
      }
    }
    return fold
  }
  const projAgg = (inRange) => {
    const agg = {}
    for (const entry of projectDays) {
      const pk = entry[0]
      const pds = entry[1]
      let a
      for (const de of pds) {
        const t = dayStartMs(de[0])
        if (!inRange(t)) continue
        if (!a) a = { project: pk, in: 0, out: 0, cr: 0, cw: 0, r: 0, cost: 0 }
        const mds = de[1]
        const ppds = projectPeakDays.get(pk)
        const pmps = (ppds && ppds.get(de[0])) || new Map()
        for (const pair of mds) {
          const mk = pair[0]
          const mf = pair[1]
          a.in += mf.in; a.out += mf.out; a.cr += mf.cr; a.cw += mf.cw; a.r += mf.r
          const eff = effectiveOf(mk.split('/').pop())
          if (eff) {
            const pf = pmps.get(mk) || emptyFold()
            const non = { in: mf.in - pf.in, out: mf.out - pf.out, cr: mf.cr - pf.cr, cw: mf.cw - pf.cw }
            a.cost += costFold(non, eff, false) + costFold(pf, eff, true)
          }
        }
      }
      if (a) agg[pk] = a
    }
    return Object.keys(agg)
      .map((pk) => {
        const a = agg[pk]
        return { project: pk, in: a.in, out: a.out, cr: a.cr, cw: a.cw, r: a.r, cost: a.cost, total: a.in + a.out + a.cr + a.cw }
      })
      .sort((x, y) => y.total - x.total)
  }

  const compute = async () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const todayStart = new Date(y, m, now.getDate()).getTime()
    const tomorrowStart = new Date(y, m, now.getDate() + 1).getTime()
    const weekStartMs = (() => {
      const d = new Date(y, m, now.getDate())
      const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
      return d.getTime()
    })()
    const monthStartMs = new Date(y, m, 1).getTime()
    const monthEndMs = new Date(y, m + 1, 1).getTime()

    const all = emptyFold()
    for (const entry of days) {
      const f = entry[1]
      all.in += f.in; all.out += f.out; all.cr += f.cr; all.cw += f.cw; all.r += f.r
    }

    const dayList = []
    for (let i = 30; i >= 0; i--) {
      const t = todayStart - i * 86400000
      const k = dayKey(t)
      const f = days.get(k) || emptyFold()
      dayList.push({ date: k, in: f.in, out: f.out, cr: f.cr, cw: f.cw, r: f.r, total: f.in + f.out + f.cr + f.cw, cost: costForDay(k) })
    }

    const modelAgg = {}
    for (const entry of modelDays) {
      const k = entry[0]
      const mds = entry[1]
      const mps = modelPeak.get(k) || new Map()
      for (const pair of mds) {
        const mk = pair[0]
        const mf = pair[1]
        let a = modelAgg[mk]
        if (!a) { a = { model: mk, in: 0, out: 0, cr: 0, cw: 0, r: 0, cost: 0 }; modelAgg[mk] = a }
        a.in += mf.in; a.out += mf.out; a.cr += mf.cr; a.cw += mf.cw; a.r += mf.r
        const eff = effectiveOf(mk.split('/').pop())
        if (eff) {
          const pf = mps.get(mk) || emptyFold()
          const non = { in: mf.in - pf.in, out: mf.out - pf.out, cr: mf.cr - pf.cr, cw: mf.cw - pf.cw }
          a.cost += costFold(non, eff, false) + costFold(pf, eff, true)
        }
      }
    }
    const models = Object.keys(modelAgg)
      .map((mk) => {
        const a = modelAgg[mk]
        return { model: mk, in: a.in, out: a.out, cr: a.cr, cw: a.cw, r: a.r, cost: a.cost, total: a.in + a.out + a.cr + a.cw }
      })
      .sort((x, y) => y.total - x.total)

    const weekModelAgg = {}
    for (const entry of modelDays) {
      const k = entry[0]
      const t = dayStartMs(k)
      if (t < weekStartMs || t >= tomorrowStart) continue
      const mds = entry[1]
      const mps = modelPeak.get(k) || new Map()
      for (const pair of mds) {
        const mk = pair[0]
        const mf = pair[1]
        let a = weekModelAgg[mk]
        if (!a) { a = { model: mk, in: 0, out: 0, cr: 0, cw: 0, r: 0, cost: 0 }; weekModelAgg[mk] = a }
        a.in += mf.in; a.out += mf.out; a.cr += mf.cr; a.cw += mf.cw; a.r += mf.r
        const eff = effectiveOf(mk.split('/').pop())
        if (eff) {
          const pf = mps.get(mk) || emptyFold()
          const non = { in: mf.in - pf.in, out: mf.out - pf.out, cr: mf.cr - pf.cr, cw: mf.cw - pf.cw }
          a.cost += costFold(non, eff, false) + costFold(pf, eff, true)
        }
      }
    }
    const weekModels = Object.keys(weekModelAgg)
      .map((mk) => {
        const a = weekModelAgg[mk]
        return { model: mk, in: a.in, out: a.out, cr: a.cr, cw: a.cw, r: a.r, cost: a.cost, total: a.in + a.out + a.cr + a.cw }
      })
      .sort((x, y) => y.total - x.total)

    const projectWeek = projAgg((t) => t >= weekStartMs && t < tomorrowStart)
    const projectTotal = projAgg(() => true)

    const sessionAgg = {}
    for (const entry of sessionDays) {
      const sid = entry[0]
      const sds = entry[1]
      let a
      for (const de of sds) {
        const t = dayStartMs(de[0])
        if (t < weekStartMs || t >= tomorrowStart) continue
        if (!a) a = { id: sid, in: 0, out: 0, cr: 0, cw: 0, r: 0, cost: 0 }
        const f = de[1]
        a.in += f.in; a.out += f.out; a.cr += f.cr; a.cw += f.cw; a.r += f.r
        a.cost += f.cost || 0
      }
      if (a) { a.total = a.in + a.out + a.cr + a.cw; sessionAgg[sid] = a }
    }
    const query = ctx.get('sessionQuery')
    const sessionTopList = Object.keys(sessionAgg)
      .map((sid) => sessionAgg[sid])
      .sort((x, y) => y.total - x.total)
      .slice(0, 3)
    const sessionTop = []
    for (const a of sessionTopList) {
      let title = ''
      if (query && typeof query.readTitle === 'function') {
        try {
          const snap = await query.readTitle(a.id)
          if (snap && typeof snap.title === 'string' && snap.title) title = snap.title
        } catch { /* keep id */ }
      }
      const p = sessionProject.get(a.id)
      sessionTop.push({ id: a.id, title: title || String(a.id), project: p || '', total: a.total, cost: a.cost, in: a.in, out: a.out, cr: a.cr })
    }

    return {
      scanning,
      now: Date.now(),
      currency: priceState.currency,
      today: Object.assign(sumOf(rangeFold(todayStart, tomorrowStart)), { cost: periodCost(todayStart, tomorrowStart) }),
      week: Object.assign(sumOf(rangeFold(weekStartMs, tomorrowStart)), { cost: periodCost(weekStartMs, tomorrowStart) }),
      month: Object.assign(sumOf(rangeFold(monthStartMs, monthEndMs)), { cost: periodCost(monthStartMs, monthEndMs) }),
      total: Object.assign(sumOf(all), { cost: periodCost(0, Infinity) }),
      weekStats: {
        thinkMs: sumMap(thinkMs, weekStartMs, tomorrowStart),
        turnMs: sumMap(turnMs, weekStartMs, tomorrowStart),
        taskCount: sumMap(taskCount, weekStartMs, tomorrowStart),
        stepCount: sumMap(stepCount, weekStartMs, tomorrowStart),
        todayThinkMs: sumMap(thinkMs, todayStart, tomorrowStart),
        todayTurnMs: sumMap(turnMs, todayStart, tomorrowStart),
      },
      days: dayList,
      models,
      weekModels,
      projectWeek,
      projectTotal,
      sessionTop,
      prices: priceSnapshot(),
    }
  }

  // ------------------------------------------------------------------
  // official price fetch: DeepSeek docs (Docusaurus chunk chain)
  // ------------------------------------------------------------------
  const parseChunk = (src) => {
    const tokens = []
    const re = /children:"(\$|¥)?([\d.]+|deepseek-[a-z0-9-]+|OFF-PEAK|PEAK|1M INPUT TOKENS \(CACHE (?:HIT|MISS)\)|1M OUTPUT TOKENS)"/g
    let m
    let currency = '$'
    while ((m = re.exec(src))) {
      const v = m[2]
      if (/^[\d.]+$/.test(v)) { tokens.push({ kind: 'price', v: parseFloat(v) }); if (m[1] === '¥') currency = '¥' }
      else if (v.indexOf('deepseek-') === 0) tokens.push({ kind: 'model', v })
      else if (v === 'OFF-PEAK' || v === 'PEAK') tokens.push({ kind: 'period', v })
      else tokens.push({ kind: 'col', v: v.indexOf('HIT') >= 0 ? 'cacheHit' : v.indexOf('MISS') >= 0 ? 'cacheMiss' : 'output' })
    }
    const models = []
    let peakCols = []
    const base = {}
    const offPeak = {}
    let i = 0
    const n = tokens.length
    while (i < n) {
      const t = tokens[i]
      if (t.kind === 'model') {
        if (models.indexOf(t.v) < 0) models.push(t.v)
        i++
        if (tokens[i] && tokens[i].kind === 'period') {
          const period = tokens[i].v
          i++
          const prices = []
          while (i < n && tokens[i].kind === 'price') { prices.push(tokens[i].v); i++ }
          if (period === 'OFF-PEAK' && peakCols.length) {
            const obj = {}
            for (let j = 0; j < peakCols.length && j < prices.length; j++) obj[peakCols[j]] = prices[j]
            if (!offPeak[t.v]) offPeak[t.v] = {}
            offPeak[t.v] = Object.assign(offPeak[t.v], obj)
          }
        } else {
          const prices = []
          while (i < n && tokens[i].kind === 'price') { prices.push(tokens[i].v); i++ }
          if (prices.length && peakCols.length) {
            const obj = {}
            for (let j = 0; j < peakCols.length && j < prices.length; j++) obj[peakCols[j]] = prices[j]
            if (!offPeak[t.v]) offPeak[t.v] = {}
            offPeak[t.v] = Object.assign(offPeak[t.v], obj)
          }
        }
        continue
      }
      if (t.kind === 'col') {
        if (tokens[i + 1] && tokens[i + 1].kind === 'col') {
          const cols = []
          while (i < n && tokens[i].kind === 'col') { cols.push(tokens[i].v); i++ }
          if (cols.length >= 3) peakCols = cols
        } else {
          const col = t.v
          i++
          const prices = []
          while (i < n && tokens[i].kind === 'price') { prices.push(tokens[i].v); i++ }
          for (let j = 0; j < models.length && j < prices.length; j++) {
            if (!base[models[j]]) base[models[j]] = {}
            base[models[j]][col] = prices[j]
          }
        }
        continue
      }
      i++
    }
    const result = {}
    for (const nm of models) {
      if (base[nm] || offPeak[nm]) result[nm] = { base: base[nm] || null, offPeak: offPeak[nm] || null }
    }
    return { models: result, currency }
  }

  const fetchPrices = async () => {
    const web = ctx.get('web')
    if (!web || typeof web.fetch !== 'function') {
      return { ok: false, error: 'web 服务不可用，无法联网获取价格' }
    }
    const get = async (url) => {
      const res = await web.fetch({ url })
      const body = res && res.body
      return body && typeof body.content === 'string' ? body.content : ''
    }
    try {
      const html = await get('https://api-docs.deepseek.com/quick_start/pricing')
      const mainName = html.match(/assets\/js\/main\.([a-f0-9]+)\.js/)
      const runtimeName = html.match(/assets\/js\/runtime~main\.([a-f0-9]+)\.js/)
      if (!mainName || !runtimeName) return { ok: false, error: '无法识别官方定价页结构（main/runtime 脚本缺失）' }
      const mainSrc = await get(`https://api-docs.deepseek.com/assets/js/main.${mainName[1]}.js`)
      const route = mainSrc.match(/"\/quick_start\/pricing-[a-z0-9]+":\{"__comp":"[a-f0-9]+","content":"([a-f0-9]+)"\}/)
      if (!route) return { ok: false, error: '无法在站点脚本中找到定价内容' }
      const contentHash = route[1]
      const loader = mainSrc.match(new RegExp(`${contentHash}:\\[\\(\\)=>Promise\\.all\\(\\[n\\.e\\((\\d+)\\),n\\.e\\((\\d+)\\)\\]\\)`))
      const chunkId = loader ? loader[2] : null
      const runtimeSrc = await get(`https://api-docs.deepseek.com/assets/js/runtime~main.${runtimeName[1]}.js`)
      const secondMap = runtimeSrc.match(/\.u=e=>"assets\/js\/"\+\(\{[^}]*\}\[e\]\|\|e\)\+"\."\+(\{[^}]*\})\[e\]\+"\.js"/)
      let secondHash = null
      if (secondMap && chunkId) {
        const mm = secondMap[1].match(new RegExp(`${chunkId}:"([a-f0-9]+)"`))
        if (mm) secondHash = mm[1]
      }
      if (!secondHash) return { ok: false, error: '无法解析官方脚本的 chunk 映射（页面结构可能已变化）' }
      const chunkSrc = await get(`https://api-docs.deepseek.com/assets/js/${contentHash}.${secondHash}.js`)
      if (!chunkSrc) return { ok: false, error: '无法获取官方价格数据块' }
      const parsed = parseChunk(chunkSrc)
      const names = Object.keys(parsed.models)
      if (!names.length) return { ok: false, error: '价格数据块中未解析出模型价格' }
      priceState = {
        currency: parsed.currency || '$',
        source: 'DeepSeek 官网（api-docs.deepseek.com）',
        updatedAt: Date.now(),
        changeEpoch: CHANGE_EPOCH,
        models: parsed.models,
      }
      priceOverrides.clear()
      return { ok: true, count: names.length }
    } catch (e) {
      return { ok: false, error: `获取失败：${String((e && e.message) || e)}` }
    }
  }

  // ------------------------------------------------------------------
  // routes for the browser half
  // ------------------------------------------------------------------
  const routes = [
    {
      kind: 'exact',
      path: '/api/dsh-token-usage/stats',
      handler: async (req, res) => {
        if ((req.method ?? 'GET') !== 'GET') { writeJson(res, 405, { error: 'method not allowed' }); return }
        writeJson(res, 200, await compute())
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-token-usage/prices',
      handler: async (req, res) => {
        const method = req.method ?? 'GET'
        if (method === 'GET') { writeJson(res, 200, priceSnapshot()); return }
        if (method !== 'POST') { writeJson(res, 405, { error: 'method not allowed' }); return }
        const body = await readJson(req, res)
        const out = setPrices(body && body.models)
        writeJson(res, out.ok ? 200 : 400, out)
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-token-usage/prices/fetch',
      handler: async (req, res) => {
        if ((req.method ?? 'POST') !== 'POST') { writeJson(res, 405, { error: 'method not allowed' }); return }
        writeJson(res, 200, await fetchPrices())
      },
    },
  ]
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route))
    return () => disposers.forEach((d) => { if (d) d() })
  }, 'dsh-token-usage: routes')
}

export { name, inject, apply }
