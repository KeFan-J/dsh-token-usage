/**
 * dsh-token-usage — browser half (hand-written ModuleLoader bundle).
 *
 * Registers a full Settings page (settings.section slot, "Token 用量"):
 *   - today / this week / this month token cards with live cost estimates
 *   - weekly task stats: thinking time, total task time, task & step counts
 *   - task token Top-3 leaderboard (this week)
 *   - 14-day stacked bar chart (input / output / cache-hit) with a
 *     custom cursor-following hover tooltip
 *   - model token ranking (this week) and per-project stats (week / all)
 *   - pricing panel: fetch the latest official DeepSeek prices from the
 *     official docs site, or edit them manually (standard & peak/off-peak)
 *
 * All colors ride --dsw-* theme tokens, so the panel follows light/dark skins.
 * Data is served by the host half at /api/dsh-token-usage/*.
 */
window.__ModuleLoader__.load({
  id: 'dsh-token-usage',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const name = 'dsh-token-usage'
    const inject = ['slots', 'timer']

    const CSS = '.tu-wrap *{box-sizing:border-box}.tu-wrap{display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary);font-size:13px;width:100%;max-width:100%;min-width:0;padding:2px}.tu-header{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tu-title{font-size:15px;font-weight:600}.tu-refresh{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:7px;padding:4px 10px;font-size:12px;cursor:pointer;flex:none}.tu-refresh:hover{border-color:var(--dsw-alias-border-l2)}.tu-refresh:disabled{opacity:.5;cursor:default}.tu-refresh-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}.tu-scanning{font-size:12px;color:var(--dsw-alias-state-warn-primary)}.tu-error{font-size:12px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}.tu-hint{color:var(--dsw-alias-label-secondary);padding:24px 0;text-align:center}.tu-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.tu-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0;overflow:hidden}.tu-card-title{font-size:12px;color:var(--dsw-alias-label-secondary)}.tu-card-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums}.tu-card-cost{font-size:13px;font-weight:600;color:var(--dsw-alias-brand-primary);font-variant-numeric:tabular-nums}.tu-card-sub{font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.tu-card-sub-muted{opacity:.85}.tu-timing-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;min-width:0}.tu-timing-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.tu-timing-cell{background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;min-width:0}.tu-timing-value{font-size:19px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.tu-timing-label{font-size:11px;color:var(--dsw-alias-label-secondary)}.tu-chart-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;min-width:0;position:relative}.tu-chart-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap;min-width:0}.tu-chart-head span{overflow-wrap:anywhere}.tu-chart{display:flex;align-items:flex-end;gap:6px;height:130px;min-width:0}.tu-bar-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%}.tu-bar-track{flex:1;width:100%;display:flex;align-items:stretch;background:var(--dsw-alias-bg-layer-2);border-radius:4px;overflow:hidden;min-height:6px}.tu-bar-stack{width:100%;flex:1;display:flex;flex-direction:column;justify-content:flex-end;min-height:2px}.tu-bar-space{flex-basis:0}.tu-bar-seg{min-height:2px;transition:opacity .15s ease}.tu-bar-seg:last-child{border-radius:3px 3px 0 0}.tu-bar-track:hover .tu-bar-seg{opacity:.88}.tu-bar-label{font-size:10px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.tu-chart-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary)}.tu-chip{display:inline-flex;align-items:center;gap:5px}.tu-chip-dot{width:8px;height:8px;border-radius:2px;display:inline-block;flex:none}.tu-tip{position:absolute;z-index:30;pointer-events:none;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.18);padding:8px 12px;display:flex;flex-direction:column;gap:3px;font-size:12px;min-width:150px;max-width:230px}.tu-tip-title{font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:2px;font-variant-numeric:tabular-nums}.tu-tip-row{display:flex;justify-content:space-between;gap:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}.tu-tip-row b{color:var(--dsw-alias-label-primary);font-weight:600}.tu-tip-total{border-top:1px solid var(--dsw-alias-border-l1);padding-top:4px;margin-top:2px}.tu-models-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-width:0}.tu-rank-row{display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1);min-width:0}.tu-rank-row:last-child{border-bottom:none}.tu-rank-no{width:26px;flex:none;text-align:center;font-size:14px;font-weight:700;line-height:20px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}.tu-rank-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.tu-rank-line1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}.tu-model-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums;max-width:40%}.tu-rank-tokens{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}.tu-rank-cost{color:var(--dsw-alias-brand-primary);font-variant-numeric:tabular-nums;white-space:nowrap}.tu-rank-bar{height:6px;background:var(--dsw-alias-bg-layer-2);border-radius:3px;overflow:hidden}.tu-rank-bar-fill{height:100%;background:var(--dsw-alias-brand-primary);border-radius:3px;min-width:2px}.tu-model-sub{font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.tu-proj-path{font-size:10px;color:var(--dsw-alias-label-secondary);opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left}.tu-toggle{display:inline-flex;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;overflow:hidden;flex:none}.tu-toggle-btn{background:var(--dsw-alias-bg-layer-1);border:none;color:var(--dsw-alias-label-secondary);font-size:11px;padding:3px 10px;cursor:pointer}.tu-toggle-btn:hover{color:var(--dsw-alias-label-primary)}.tu-toggle-on{background:var(--dsw-alias-brand-primary);color:#fff}.tu-task-row{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l1);min-width:0}.tu-task-row:last-child{border-bottom:none}.tu-task-title{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3}.tu-task-tokens{flex:none;font-weight:700;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}.tu-price-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-width:0}.tu-price-note{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.6;overflow-wrap:anywhere}.tu-price-model{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-width:0}.tu-price-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.tu-price-name{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.tu-price-select{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;font-size:12px;padding:3px 6px;max-width:100%}.tu-price-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px}.tu-price-tag{font-size:11px;color:var(--dsw-alias-label-secondary);width:64px;flex:none}.tu-price-field{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);flex:0 1 auto;min-width:0}.tu-price-field span{font-size:11px;flex:none}.tu-price-input{width:76px;max-width:100%;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;font-size:12px;padding:3px 6px;font-variant-numeric:tabular-nums}.tu-price-input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}.tu-price-note-inline{font-size:11px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.tu-price-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.tu-price-meta{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:normal;overflow-wrap:anywhere;max-width:100%}.tu-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.tu-refresh{transition:transform .08s ease,background-color .15s ease,border-color .15s ease}.tu-refresh:not(:disabled):hover{background:var(--dsw-alias-bg-layer-2)}.tu-refresh:not(:disabled):active{transform:scale(.94)}.tu-spin{display:inline-block;animation:tu-rot .8s linear infinite}.tu-updated{font-size:12px;color:var(--dsw-alias-state-success-primary);animation:tu-fade .25s ease;white-space:nowrap}@keyframes tu-rot{to{transform:rotate(360deg)}}@keyframes tu-fade{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:none}}'

    function apply(ctx) {
      // ---------- styles (owned by this fiber) ----------
      const styleEl = document.createElement('style')
      styleEl.textContent = CSS
      document.head.appendChild(styleEl)
      ctx.effect(() => () => { styleEl.remove() }, 'dsh-token-usage: css')

      const slots = ctx.get('slots')
      if (slots === undefined) return

      const api = async (path, opts) => {
        const res = await fetch(path, opts)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      }

      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'token-usage', order: 25, label: 'Token 用量' },
        () => React.createElement(UsagePanel, null)
      ))

      let flashSeq = 0
      const fmtInt = (n) => Number(n || 0).toLocaleString('zh-CN')
      const fmtMoney = (n, sym) => {
        const v = Number(n || 0)
        if (v === 0) return sym + '0'
        const s = v >= 100 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Number(v.toFixed(6)))
        return sym + s
      }
      const fmtTime = (t) => t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '—'
      const fmtDur = (ms) => {
        const s = Math.round(Number(ms || 0) / 1000)
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        const sec = s % 60
        const mm = String(m).padStart(2, '0')
        const ss = String(sec).padStart(2, '0')
        return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
      }
      const projName = (p) => {
        const s = String(p || '')
        const parts = s.split('/').filter(Boolean)
        return parts.length ? parts[parts.length - 1] : (s || '未知项目')
      }
      const CHART_SEGS = [
        ['输入', 'var(--dsw-alias-label-secondary)'],
        ['输出', 'var(--dsw-alias-brand-primary)'],
        ['缓存命中', 'var(--dsw-alias-state-success-primary)'],
      ]
      const MEDALS = ['🥇', '🥈', '🥉']

      function UsagePanel() {
        const [stats, setStats] = React.useState(null)
        const [error, setError] = React.useState(null)
        const [fetching, setFetching] = React.useState(false)
        const [refreshing, setRefreshing] = React.useState(false)
        const [justUpdated, setJustUpdated] = React.useState(false)
        const [updatedAt, setUpdatedAt] = React.useState(null)
        const [draft, setDraft] = React.useState(null)
        const [dirty, setDirty] = React.useState(false)
        const [draftInit, setDraftInit] = React.useState(false)
        const [projRange, setProjRange] = React.useState('week')
        const [tip, setTip] = React.useState(null)

        const refresh = () => {
          api('/api/dsh-token-usage/stats').then((res) => {
            if (res && typeof res === 'object') { setStats(res); setError(null) }
          }).catch((e) => setError(String((e && e.message) || e)))
        }
        const doRefresh = () => {
          if (refreshing) return
          setRefreshing(true)
          api('/api/dsh-token-usage/stats').then((res) => {
            if (res && typeof res === 'object') {
              setStats(res)
              setError(null)
              const now = Date.now()
              setUpdatedAt(now)
              const n = ++flashSeq
              setJustUpdated(true)
              ctx.timeout(() => { if (flashSeq === n) setJustUpdated(false) }, 2400)
            }
          }).catch((e) => setError(String((e && e.message) || e))).then(() => setRefreshing(false))
        }

        React.useEffect(() => {
          refresh()
          const dispose = ctx.interval(refresh, 15000)
          return dispose
        }, [])

        React.useEffect(() => {
          if (!draftInit && stats && stats.prices && stats.prices.models) {
            setDraftInit(true)
            const m = {}
            for (const nm of Object.keys(stats.prices.models)) {
              const mod = stats.prices.models[nm]
              m[nm] = {
                base: Object.assign({ cacheHit: 0, cacheMiss: 0, output: 0 }, mod.base || {}),
                offPeak: Object.assign({ cacheHit: 0, cacheMiss: 0, output: 0 }, mod.offPeak || {}),
                override: mod.override || '',
              }
            }
            setDraft(m)
          }
        }, [draftInit, stats])

        const setPrice = (model, key, field, value) => {
          setDraft((prev) => {
            const next = JSON.parse(JSON.stringify(prev))
            next[model][key][field] = value
            return next
          })
          setDirty(true)
        }
        const setOverride = (model, value) => {
          setDraft((prev) => {
            const next = JSON.parse(JSON.stringify(prev))
            next[model].override = value
            return next
          })
          setDirty(true)
        }

        const savePrices = () => {
          if (!draft) return
          api('/api/dsh-token-usage/prices', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ models: draft }),
          }).then(() => {
            setDirty(false)
            refresh()
          }).catch((e) => setError(String((e && e.message) || e)))
        }

        const fetchPrices = () => {
          setFetching(true)
          setError(null)
          api('/api/dsh-token-usage/prices/fetch', { method: 'POST' }).then((res) => {
            setFetching(false)
            if (res && res.ok === false) { setError(res.error || '获取失败'); return }
            setDraftInit(false)
            setDraft(null)
            setDirty(false)
            refresh()
          }).catch((e) => {
            setFetching(false)
            setError(String((e && e.message) || e))
          })
        }

        if (!stats) {
          return React.createElement('div', { className: 'tu-wrap' },
            React.createElement('div', { className: 'tu-hint' }, error ? `加载失败：${error}` : '加载中…'))
        }

        const p = stats.prices || { currency: '$', source: '', updatedAt: null, changeEpoch: null, models: {} }
        const sym = p.currency === '¥' ? '¥' : '$'
        const days = Array.isArray(stats.days) ? stats.days : []
        const chartDays = days.slice(-14)
        const maxTotal = Math.max(1, ...chartDays.map((d) => d.total || 0))
        const modelNames = Object.keys(draft || p.models || {})
        const src = draft || p.models
        const ws = stats.weekStats || { thinkMs: 0, turnMs: 0, taskCount: 0, stepCount: 0, todayThinkMs: 0, todayTurnMs: 0 }
        const weekModels = Array.isArray(stats.weekModels) ? stats.weekModels : []
        const weekTotalTokens = weekModels.reduce((a, m) => a + (m.total || 0), 0)
        const weekTotalCost = weekModels.reduce((a, m) => a + (m.cost || 0), 0)
        const maxModel = weekModels.length ? Math.max(1, weekModels[0].total) : 1
        const projList = (projRange === 'week' ? stats.projectWeek : stats.projectTotal) || []
        const projTotalTokens = projList.reduce((a, m) => a + (m.total || 0), 0)
        const projTotalCost = projList.reduce((a, m) => a + (m.cost || 0), 0)
        const maxProj = projList.length ? Math.max(1, projList[0].total) : 1
        const sessionTop = Array.isArray(stats.sessionTop) ? stats.sessionTop : []

        const Card = (title, fold) => {
          const digits = String(Math.round(fold.total || 0)).length
          const fs = digits >= 10 ? 16 : digits >= 8 ? 19 : digits >= 6 ? 21 : 24
          return React.createElement('div', { className: 'tu-card' }, [
            React.createElement('div', { className: 'tu-card-title' }, title),
            React.createElement('div', { className: 'tu-card-value', style: { fontSize: `${fs}px` } }, fmtInt(fold.total)),
            React.createElement('div', { className: 'tu-card-cost' }, `≈ ${fmtMoney(fold.cost, sym)}`),
            React.createElement('div', { className: 'tu-card-sub' }, `输入 ${fmtInt(fold.in)} · 输出 ${fmtInt(fold.out)}`),
            React.createElement('div', { className: 'tu-card-sub tu-card-sub-muted' },
              `缓存命中 ${fmtInt(fold.cr)}${fold.r ? ` · 推理 ${fmtInt(fold.r)}` : ''}`),
          ])
        }

        const segsOf = (d) => [
          d.in > 0 ? ['输入', d.in, CHART_SEGS[0][1]] : null,
          d.out > 0 ? ['输出', d.out, CHART_SEGS[1][1]] : null,
          d.cr > 0 ? ['缓存命中', d.cr, CHART_SEGS[2][1]] : null,
        ].filter(Boolean)
        const showTip = (e, d) => {
          const card = e.currentTarget.closest('.tu-chart-card')
          if (!card) return
          const rect = card.getBoundingClientRect()
          setTip({ day: d, x: e.clientX - rect.left, y: e.clientY - rect.top, flip: e.clientY - rect.top < 110 })
        }
        const tipRow = (label, val, cls) => React.createElement('div', { className: `tu-tip-row${cls ? ` ${cls}` : ''}`, key: label }, [
          React.createElement('span', null, label),
          React.createElement('b', null, val),
        ])
        const barCols = chartDays.map((d) => {
          const total = d.total || 0
          const children = []
          const space = Math.max(0, maxTotal - total)
          children.push(React.createElement('div', { key: 'sp', className: 'tu-bar-space', style: { flexGrow: space } }))
          const bottomUp = segsOf(d).slice().reverse()
          for (const s of bottomUp) {
            children.push(React.createElement('div', {
              key: s[0],
              className: 'tu-bar-seg',
              style: { flexGrow: s[1], backgroundColor: s[2] },
            }))
          }
          const stack = React.createElement('div', { className: 'tu-bar-stack' }, children)
          const label = React.createElement('div', { className: 'tu-bar-label' }, d.date.slice(5).replace('-', '/'))
          return React.createElement('div', {
            key: d.date,
            className: 'tu-bar-col',
            onMouseEnter: (e) => showTip(e, d),
            onMouseMove: (e) => showTip(e, d),
          }, [stack, label])
        })
        const chartLegend = CHART_SEGS.map((c) => React.createElement('span', { className: 'tu-chip', key: c[0] }, [
          React.createElement('i', { className: 'tu-chip-dot', style: { backgroundColor: c[1] } }),
          React.createElement('span', null, c[0]),
        ]))

        const timingCells = [
          ['思考时长', fmtDur(ws.thinkMs)],
          ['总任务时长', fmtDur(ws.turnMs)],
          ['任务数', fmtInt(ws.taskCount)],
          ['步骤数', fmtInt(ws.stepCount)],
        ].map((c) => React.createElement('div', { className: 'tu-timing-cell', key: c[0] }, [
          React.createElement('div', { className: 'tu-timing-value' }, c[1]),
          React.createElement('div', { className: 'tu-timing-label' }, c[0]),
        ]))

        const sessionTopRows = sessionTop.length
          ? sessionTop.map((tk, idx) => React.createElement('div', { className: 'tu-task-row', key: tk.id || idx }, [
              React.createElement('div', { className: 'tu-rank-no' }, MEDALS[idx] || String(idx + 1)),
              React.createElement('div', { className: 'tu-rank-main' }, [
                React.createElement('div', { className: 'tu-task-title', title: tk.title }, tk.title),
                React.createElement('div', { className: 'tu-model-sub' },
                  `项目 ${projName(tk.project)} · 费用 ≈ ${fmtMoney(tk.cost, sym)}`),
                React.createElement('div', { className: 'tu-model-sub' },
                  `输入 ${fmtInt(tk.in)} · 输出 ${fmtInt(tk.out)} · 命中 ${fmtInt(tk.cr)}`),
              ]),
              React.createElement('div', { className: 'tu-task-tokens' }, `${fmtInt(tk.total)} tokens`),
            ]))
          : React.createElement('div', { className: 'tu-hint' }, '本周暂无对话框用量数据')

        const rankRows = weekModels.length
          ? weekModels.map((md, idx) => {
              const pct = weekTotalTokens ? Math.round((md.total / weekTotalTokens) * 100) : 0
              const barW = Math.max(2, Math.round((md.total / maxModel) * 100))
              return React.createElement('div', { className: 'tu-rank-row', key: md.model }, [
                React.createElement('div', { className: 'tu-rank-no' }, MEDALS[idx] || String(idx + 1)),
                React.createElement('div', { className: 'tu-rank-main' }, [
                  React.createElement('div', { className: 'tu-rank-line1' }, [
                    React.createElement('span', { className: 'tu-model-name', title: md.model }, md.model),
                    React.createElement('span', { className: 'tu-rank-tokens' }, `${fmtInt(md.total)} tokens · ${pct}%`),
                    React.createElement('span', { className: 'tu-rank-cost' }, `≈ ${fmtMoney(md.cost, sym)}`),
                  ]),
                  React.createElement('div', { className: 'tu-rank-bar' },
                    React.createElement('div', { className: 'tu-rank-bar-fill', style: { width: `${barW}%` } })),
                  React.createElement('div', { className: 'tu-model-sub' },
                    `输入 ${fmtInt(md.in)} · 输出 ${fmtInt(md.out)} · 命中 ${fmtInt(md.cr)}${md.r ? ` · 推理 ${fmtInt(md.r)}` : ''}`),
                ]),
              ])
            })
          : React.createElement('div', { className: 'tu-hint' }, '本周暂无模型用量数据')

        const projRows = projList.length
          ? projList.map((pd, idx) => {
              const pct = projTotalTokens ? Math.round((pd.total / projTotalTokens) * 100) : 0
              const barW = Math.max(2, Math.round((pd.total / maxProj) * 100))
              return React.createElement('div', { className: 'tu-rank-row', key: pd.project }, [
                React.createElement('div', { className: 'tu-rank-no' }, MEDALS[idx] || String(idx + 1)),
                React.createElement('div', { className: 'tu-rank-main' }, [
                  React.createElement('div', { className: 'tu-rank-line1' }, [
                    React.createElement('span', { className: 'tu-model-name', title: pd.project }, projName(pd.project)),
                    React.createElement('span', { className: 'tu-rank-tokens' }, `${fmtInt(pd.total)} tokens · ${pct}%`),
                    React.createElement('span', { className: 'tu-rank-cost' }, `≈ ${fmtMoney(pd.cost, sym)}`),
                  ]),
                  React.createElement('div', { className: 'tu-rank-bar' },
                    React.createElement('div', { className: 'tu-rank-bar-fill', style: { width: `${barW}%` } })),
                  React.createElement('div', { className: 'tu-model-sub' },
                    `输入 ${fmtInt(pd.in)} · 输出 ${fmtInt(pd.out)} · 命中 ${fmtInt(pd.cr)}${pd.r ? ` · 推理 ${fmtInt(pd.r)}` : ''}`),
                  React.createElement('div', { className: 'tu-proj-path', title: pd.project }, pd.project),
                ]),
              ])
            })
          : React.createElement('div', { className: 'tu-hint' }, projRange === 'week' ? '本周暂无项目用量数据' : '暂无项目用量数据')

        const priceInput = (model, key, field, label) => React.createElement('label', { className: 'tu-price-field' }, [
          React.createElement('span', null, label),
          React.createElement('input', {
            type: 'number', min: 0, step: 0.0001,
            className: 'tu-price-input',
            value: src[model][key][field],
            onChange: (e) => setPrice(model, key, field, Number(e.target.value) || 0),
          }),
        ])

        const tooltip = tip ? React.createElement('div', {
          className: 'tu-tip',
          style: {
            left: `clamp(110px, ${tip.x}px, calc(100% - 110px))`,
            top: `${tip.y}px`,
            transform: tip.flip ? 'translate(-50%, 16px)' : 'translate(-50%, calc(-100% - 10px))',
          },
        }, [
          React.createElement('div', { className: 'tu-tip-title' }, tip.day.date),
          tipRow('输入', fmtInt(tip.day.in)),
          tipRow('输出', fmtInt(tip.day.out)),
          tipRow('缓存命中', fmtInt(tip.day.cr)),
          tip.day.r ? tipRow('推理', fmtInt(tip.day.r)) : null,
          tipRow('合计', `${fmtInt(tip.day.total)} tokens`, 'tu-tip-total'),
          tipRow('费用', `≈ ${fmtMoney(tip.day.cost, sym)}`),
        ]) : null

        return React.createElement('div', { className: 'tu-wrap' }, [
          React.createElement('div', { className: 'tu-header' }, [
            React.createElement('div', { className: 'tu-title' }, 'Token 用量'),
            React.createElement('button', { className: 'tu-refresh', onClick: doRefresh, disabled: refreshing },
              refreshing
                ? [React.createElement('span', { className: 'tu-spin', key: 's' }, '↻'), React.createElement('span', { key: 't' }, ' 刷新中…')]
                : '刷新'),
            justUpdated ? React.createElement('span', { className: 'tu-updated', key: 'u' }, `✓ 已更新 ${fmtTime(updatedAt)}`) : null,
            stats.scanning ? React.createElement('span', { className: 'tu-scanning' }, '正在扫描历史记录…') : null,
            error ? React.createElement('span', { className: 'tu-error' }, error) : null,
          ]),
          React.createElement('div', { className: 'tu-cards' }, [
            Card('今日', stats.today),
            Card('本周', stats.week),
            Card('本月', stats.month),
          ]),
          React.createElement('div', { className: 'tu-timing-card' }, [
            React.createElement('div', { className: 'tu-chart-head' }, [
              React.createElement('span', null, '本周任务统计'),
              React.createElement('span', null, `今日思考 ${fmtDur(ws.todayThinkMs)} · 今日任务 ${fmtDur(ws.todayTurnMs)}`),
            ]),
            React.createElement('div', { className: 'tu-timing-grid' }, timingCells),
          ]),
          React.createElement('div', { className: 'tu-models-card' }, [
            React.createElement('div', { className: 'tu-chart-head' },
              React.createElement('span', null, '对话框 Token 消耗 Top 3（本周）')),
            sessionTopRows,
          ]),
          React.createElement('div', { className: 'tu-chart-card', onMouseLeave: () => setTip(null) }, [
            React.createElement('div', { className: 'tu-chart-head' }, [
              React.createElement('span', null, '近 14 天用量分布'),
              React.createElement('span', null, `累计 ${fmtInt(stats.total.total)} tokens · ≈ ${fmtMoney(stats.total.cost, sym)}`),
            ]),
            React.createElement('div', { className: 'tu-chart' }, barCols),
            React.createElement('div', { className: 'tu-chart-legend' }, chartLegend),
            tooltip,
          ]),
          React.createElement('div', { className: 'tu-models-card' }, [
            React.createElement('div', { className: 'tu-chart-head' }, [
              React.createElement('span', null, '模型 Token 排行（本周）'),
              React.createElement('span', null, `合计 ${fmtInt(weekTotalTokens)} tokens · ≈ ${fmtMoney(weekTotalCost, sym)}`),
            ]),
            rankRows,
          ]),
          React.createElement('div', { className: 'tu-models-card' }, [
            React.createElement('div', { className: 'tu-chart-head' }, [
              React.createElement('span', null, '项目 Token 统计'),
              React.createElement('div', { className: 'tu-toggle' }, [
                React.createElement('button', {
                  className: `tu-toggle-btn${projRange === 'week' ? ' tu-toggle-on' : ''}`,
                  onClick: () => setProjRange('week'),
                }, '本周'),
                React.createElement('button', {
                  className: `tu-toggle-btn${projRange === 'all' ? ' tu-toggle-on' : ''}`,
                  onClick: () => setProjRange('all'),
                }, '全部'),
              ]),
              React.createElement('span', null, `合计 ${fmtInt(projTotalTokens)} tokens · ≈ ${fmtMoney(projTotalCost, sym)}`),
            ]),
            projRows,
          ]),
          React.createElement('div', { className: 'tu-price-card' }, [
            React.createElement('div', { className: 'tu-chart-head' }, [
              React.createElement('span', null, '价格设置（DeepSeek 官网）'),
              React.createElement('span', { className: 'tu-price-meta' },
                `${p.source}${p.updatedAt ? ` · 更新于 ${fmtTime(p.updatedAt)}` : ''}`),
            ]),
            React.createElement('div', { className: 'tu-price-note' },
              `单位：${sym}/百万 tokens。官网公告：2026-08-16 16:00 UTC 起实行峰谷计价（峰值 = 低谷 × 2，高峰时段 01:00-04:00 / 06:00-10:00 UTC，按请求时刻自动套用）。到期自动切换，也可手动指定。`),
            modelNames.map((nm) => React.createElement('div', { className: 'tu-price-model', key: nm }, [
              React.createElement('div', { className: 'tu-price-head' }, [
                React.createElement('span', { className: 'tu-price-name' }, nm),
                React.createElement('select', {
                  className: 'tu-price-select',
                  value: src[nm].override || '',
                  onChange: (e) => setOverride(nm, e.target.value),
                }, [
                  React.createElement('option', { value: '' }, '自动（按公告生效日期）'),
                  React.createElement('option', { value: 'base' }, '标准价'),
                  React.createElement('option', { value: 'offPeak' }, '峰谷价（低谷）'),
                ]),
              ]),
              React.createElement('div', { className: 'tu-price-row' },
                [React.createElement('span', { className: 'tu-price-tag' }, '标准价'),
                  priceInput(nm, 'base', 'cacheMiss', '输入'),
                  priceInput(nm, 'base', 'cacheHit', '命中'),
                  priceInput(nm, 'base', 'output', '输出')]),
              React.createElement('div', { className: 'tu-price-row' },
                [React.createElement('span', { className: 'tu-price-tag' }, '峰谷·低谷'),
                  priceInput(nm, 'offPeak', 'cacheMiss', '输入'),
                  priceInput(nm, 'offPeak', 'cacheHit', '命中'),
                  priceInput(nm, 'offPeak', 'output', '输出'),
                  React.createElement('span', { className: 'tu-price-note-inline' }, '峰值=低谷×2，自动推导')]),
            ])),
            React.createElement('div', { className: 'tu-price-actions' }, [
              React.createElement('button', { className: 'tu-refresh', onClick: fetchPrices, disabled: fetching },
                fetching ? '获取中…' : '从官网获取最新价格'),
              React.createElement('button', { className: 'tu-refresh tu-refresh-primary', onClick: savePrices, disabled: !dirty },
                '保存价格'),
            ]),
          ]),
          React.createElement('div', { className: 'tu-legend' }, [
            React.createElement('span', null, `累计输入 ${fmtInt(stats.total.in)}`),
            React.createElement('span', null, `累计输出 ${fmtInt(stats.total.out)}`),
            React.createElement('span', null, `缓存命中 ${fmtInt(stats.total.cr)}`),
            stats.total.r ? React.createElement('span', null, `推理 ${fmtInt(stats.total.r)}`) : null,
          ]),
        ])
      }
    }

    exports.name = name
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
