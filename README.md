# dsh-token-usage

**DeepSeek Harness（DSH）Token 用量与费用统计面板** —— 一个可热插拔的插件，在 **设置 →「Token 用量」** 中新增一整套统计页面。

> [English documentation](README.en.md)

---

## 功能简介

DSH 的每次模型调用都会在持久化会话日志中写入一条 `assistant/message` 事件，携带精确的 token 记账（输入 / 输出 / 缓存命中 / 缓存写入 / 推理）。本插件**实时监听所有会话**的事件流，并在启动时**回放全部历史会话日志**——所以统计包含装插件之前的历史用量，且重启不丢数据。

### 面板内容

| 板块 | 展示内容 |
| --- | --- |
| **今日 / 本周 / 本月** | token 总量 + 费用估算，附 输入 / 输出 / 缓存命中 细分 |
| **本周任务统计** | 思考时长（由 `reasoning-delta` 片段计算）、总任务时长、任务数、步骤数 |
| **任务 Top 3** | 本周 token 消耗最高的任务（标题、项目、时长、费用） |
| **近 14 天柱状图** | 堆叠柱（输入 / 输出 / 缓存命中），鼠标悬停显示跟随光标的当日完整明细 |
| **模型排行** | 本周各模型 token 排行（占比、进度条、费用） |
| **项目统计** | 按工作区（会话 cwd）分组的用量，可切换 本周 / 全部 |
| **价格设置** | DeepSeek 官网定价（标准价 / 峰谷价），支持一键从官网获取、或手动编辑 |

### 费用估算

- 使用 **DeepSeek 官网定价**（美元或人民币）：可一键从 `api-docs.deepseek.com` 实时抓取（内置解析器可穿透官网的 Docusaurus chunk 结构），也可手动填写——官网常有价格变动，因此专门提供了「**从官网获取最新价格**」按钮。
- 支持官网的**峰谷计价**规则：高峰时段（UTC 01:00-04:00 / 06:00-10:00）按低谷价 × 2 计算，按请求时刻自动套用；到公告生效日自动切换生效档位，也可按模型手动指定。
- 缓存命中按极低的命中价计费，缓存写入按输入价计费。

## 环境要求

- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/dsh)（`dsh` 在 PATH 中，使用 web profile）
- `git` 与 `pnpm`

## 一键安装

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/KeFan-J/dsh-token-usage/main/install.sh)"
```

或指定安装目录：

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/KeFan-J/dsh-token-usage/main/install.sh)" - ~/tools/dsh-token-usage
```

脚本会自动克隆仓库、安装依赖并把插件挂载到 DSH web profile。之后：

1. 重启 DSH：`npx @deepseek-ai/dsh web`
2. 浏览器强制刷新（`Cmd+Shift+R`）
3. 打开 **设置（齿轮图标）→「Token 用量」**

> 之后想更新插件，重新执行上面的命令即可（自动 `git pull` + 重新挂载）。

### 手动安装

```bash
git clone https://github.com/KeFan-J/dsh-token-usage.git
cd dsh-token-usage
pnpm install
dsh plugin --profile web add "link:$(pwd)"
# 重启 DSH + 强制刷新浏览器
```

## 实现原理

- **Host 端**（`lib/index.js`）：监听全局 `session/event` 事件流，启动时回放会话日志；按 天 / 天×模型 / 天×项目 折叠用量；用每个 step 的 `reasoning-delta` 片段计算思考时长、用 `turn/start → turn/end` 计算任务时长；按生效的官网价（含峰谷）计算费用；提供 `/api/dsh-token-usage/*` JSON 路由。实时事件与回放通过 `sessionId:seq` 去重。
- **浏览器端**（`lib/client.js`）：在 `settings.section` 槽位注册设置页，样式全部使用 `--dsw-*` 主题变量（自动适配亮/暗主题）。
- 通过 `cordis.patch.yml` 以裸插件行挂载到 DSH profile 的 bundle 层，无需改动 dsh 源码。

## 数据与隐私

- 所有数据仅存本地：用量来自 DSH 自身会话日志，费用本地计算，不上传任何遥测。
- 唯一的对外请求是「从官网获取最新价格」按钮，只读取 DeepSeek 公开定价页面。

## 许可证

[MIT](LICENSE)
