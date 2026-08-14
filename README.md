# dsh-token-usage

**Token usage & cost dashboard for [DeepSeek Harness](https://github.com/deepseek-ai) (DSH)** — a hot-pluggable plugin that adds a full statistics page under **Settings → “Token 用量”**.

> [中文文档（简体）](README.zh.md)

---

## What it does

Every model call in DSH appends an `assistant/message` event to the durable session log with exact token accounting (input / output / cache-read / cache-write / reasoning). This plugin listens to that feed **live across all sessions** and, on startup, **replays every persisted session log** — so totals include history from before the plugin was installed and survive restarts.

### Dashboard contents

| Section | Shows |
| --- | --- |
| **Today / This Week / This Month** | token totals + estimated cost, with input / output / cache-hit breakdown |
| **Weekly task stats** | thinking time (from `reasoning-delta` chunks), total task time, task count, step count |
| **Task Top 3** | this week's heaviest tasks (turn token totals) with title, project, duration, cost |
| **14-day chart** | stacked bars (input / output / cache-hit) with a cursor-following hover tooltip showing the full per-day detail |
| **Model ranking** | this week's token ranking per model with %, progress bar and cost |
| **Project stats** | token usage grouped by workspace (session `cwd`), switchable between this week / all-time |
| **Pricing panel** | official DeepSeek pricing (standard & peak/off-peak), one-click fetch from the official docs site, or manual edit |

### Cost estimation

- Uses **DeepSeek's official pricing** (USD or CNY), either fetched live from `api-docs.deepseek.com` (a resilient parser walks the Docusaurus chunk chain) or entered manually — prices change, so there is a **“fetch latest prices”** button.
- Supports the official **peak / off-peak billing** switch: peak = off-peak × 2 during peak hours (UTC 01:00–04:00 / 06:00–10:00), applied per request timestamp; the effective rate switches automatically at the announced change date (or is set manually per model).
- Cache-hit tokens are billed at the low cache-hit rate; cache-write tokens at the input rate.

## Requirements

- [DeepSeek Harness](https://github.com/deepseek-ai/dsh) installed (`dsh` on PATH, web profile)
- `git` and `pnpm`

## One-click install

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/KeFan-J/dsh-token-usage/main/install.sh)"
```

Or install to a custom directory:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/KeFan-J/dsh-token-usage/main/install.sh)" - ~/tools/dsh-token-usage
```

The script clones the repo, installs dependencies, and mounts the plugin into the DSH web profile. Then:

1. Restart DSH: `npx @deepseek-ai/dsh web`
2. Hard-refresh the browser (`Cmd+Shift+R`)
3. Open **Settings (gear icon) → “Token 用量”**

> Re-run the same command later to update (auto `git pull` + remount).

### Manual install

```bash
git clone https://github.com/KeFan-J/dsh-token-usage.git
cd dsh-token-usage
pnpm install
dsh plugin --profile web add "link:$(pwd)"
# restart DSH + hard-refresh browser
```

## How it works

- **Host half** (`lib/index.js`): listens to the global `session/event` firehose and replays session logs on startup; folds usage per day / per day×model / per day×project; tracks thinking time (`reasoning-delta` chunk span per step) and task duration (`turn/start` → `turn/end`); computes cost from the effective official prices (peak-aware); serves `/api/dsh-token-usage/*` JSON routes. Deduplicates live vs. replay via `sessionId:seq`.
- **Browser half** (`lib/client.js`): registers the Settings page in the `settings.section` slot, styled entirely with `--dsw-*` theme tokens (light/dark ready).
- Mounted as a bare plugin row (`cordis.patch.yml`) via the DSH profile bundle layer — no changes to dsh source.

## Data & privacy

- All data stays local: usage is derived from DSH's own session logs, costs are computed locally, and no telemetry is sent anywhere.
- The only outbound request is the optional “fetch latest prices” button, which reads the public DeepSeek pricing page.

## License

[MIT](LICENSE)
