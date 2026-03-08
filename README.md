# API Market

一个基于 Cloudflare Workers 的 x402 API Payment Gateway 演示项目。

## Project Structure

- `index.html`：Vite 入口 HTML
- `src/`：前端 TypeScript 和样式
- `src/app/config.ts`：前端运行时常量与 API 基地址解析
- `src/app/state.ts`：前端共享状态
- `src/app/i18n.ts`：中英文文案与静态翻译同步
- `src/app/catalog.ts`：catalog 渲染、接口测试和支付模块展示
- `src/app/wallet.ts`：钱包连接、Rabby 支付闭环和 replay
- `src/app/bootstrap.ts`：前端启动与事件绑定
- `worker/`：Cloudflare Worker 后端
- `worker/payment.ts`：支付协议类型、错误码映射、payment helper 与 remediation 规则
- `worker/upstreams.ts`：实时上游代理、AI provider 适配、熔断与遥测逻辑
- `worker/settlement.ts`：结算状态查询路由、支付证明绑定校验与 settlement 响应组装
- `test/`：Worker 集成测试
- `public/`：Logo、favicon、OG 图、robots、sitemap 等静态资源
- `dist/`：Vite 构建产物

## What It Does

- 用同一个 Worker 提供静态首页和付费 API
- 免费提供 machine-readable catalog: `/api/v1/catalog`
- 付费接口先返回 402 challenge，再接受支付头重放请求
- 当前保留 demo 支付模式，方便前端和 SDK 联调
- 已优先打通 Rabby Wallet 的浏览器内真实支付闭环：切到 Base、签名、转 USDC、等待确认、自动 replay
- Coinbase Wallet 与 MetaMask 当前在 UI 中明确标注为“开发中”，避免用户误判
- 支持首页中英文一键切换，并记住用户语言选择
- catalog 已输出中英文字段，前端直接消费 Worker 返回的多语言文案
- 提供基础 SEO 资源，包括 favicon、OG 图、robots 和 sitemap
- 已补 `hreflang`、多语言 canonical 和双语 sitemap
- 收款地址由 Worker 的 `PAY_TO` 环境变量决定，catalog 和 402 challenge 会对外暴露这个地址
- 当前支付范围固定为 `Base` 主网原生 `USDC`，不接受其他链上的 USDC
- 非 demo 请求现在要求提供 `PAYMENT-SIGNATURE` 和 `X-PAYMENT-TX-HASH`，Worker 会回查 Base 链上 USDC 转账回执
- 首页测试弹窗现在能直接驱动 Rabby 真实支付流程，不再只是 demo 地址读取
- 支付通过或被 402 拒绝时都会返回结构化 `settlement` 上下文（txHash、receiptBlock、confirmations），便于 SDK 自动重试
- 新增 `GET /api/v1/settlement/{txHash}` 结算状态查询接口，返回 machine-readable 状态码与重试建议
- settlement 查询支持可选 `PAYMENT-SIGNATURE` 证明校验，并可通过 `payer`/`resource`/`payTo`/`minAmount` 过滤条件做归因绑定校验
- 402 challenge、成功响应与 settlement 查询均回传 `X-Request-Id` / `requestId`，便于客户端链路追踪与重放归因
- catalog 与 402 challenge 会返回 `settlementPolicy`（确认数、平均区块时间、建议重试间隔）；当确认数不足时会返回 `Retry-After`
- catalog 现在额外暴露 `settlementStatusRemediation` / `paymentReasonRemediation`，402 与 settlement 响应也会返回 `remediation` 字段，便于 SDK 根据错误码自动执行补救动作
- remediation 相关字段已增加稳定元信息：`remediationSchemaVersion`（当前 `1.0.0`）和 `remediationCompatibility`（`semver-minor-backward-compatible`）
- catalog / 402 / settlement 响应现在都附带 `remediationRefs`（`changelog` 与 `deprecations` 公告地址），便于 SDK 自动发现兼容变更公告
- catalog `endpoints[].requestMetrics` 已输出最近 60 分钟请求量、错误码分布、10 分钟分桶错误趋势，以及 `paymentFunnel`（`challenged402` / `settled` / `replayed` 与 challenge→replay 转化率）；漏斗现支持基于 `X-Request-Id` 的精确 challenge→replay 归因
- 新增 `GET /api/v1/metrics/funnel?window=24h|7d` 机器可读漏斗导出接口，便于外部 dashboard / SDK 拉取长期转化视图
- 新增 `GET /api/v1/metrics/overview`，返回网关累计 API 调用总次数与最近一次调用时间
- catalog endpoint 新增 `lastUpdatedAt` 与 `freshness`（`status` / `ageSeconds` / `maxAgeSeconds` / `signal`），方便 SDK 与开发者快速判断数据新鲜度
- 前端 API 卡片与接口详情面板已直接展示 freshness 状态与更新时间，便于开发者在接入前快速判断数据实时性
- 支付签名新增时间窗约束：默认 `issuedAt` 最长 15 分钟有效，最多允许 120 秒未来时钟偏差
- 链上结算证明新增区块年龄限制：默认只接受最近 `7200` 块内的 Base 交易，避免历史旧交易被延迟重放
- nonce 和 tx hash 防重放现在优先走 Durable Objects 持久化，不再依赖单实例内存
- `/api/deepseek` 与 `/api/qwen` 已接入 OpenRouter 真实上游，支持 `POST application/json` 的 `prompt` / `messages` 请求
- `/api/gpt-5.4`、`/api/gpt-5.4-pro`、`/api/claude-4.6` 已接入 OpenRouter 真实上游，支持最新旗舰模型按次调用
- `/api/polymarket/trending`、`/api/polymarket/search?q=...`、`/api/polymarket/event?slug=...` 已接入 Polymarket Gamma 公共上游
- `/api/wallet-risk?address=0x...` 已接入 Base Blockscout 公共数据源，返回结构化钱包风险画像
- AI 请求体不合法时会先返回 `400`，避免开发者因参数错误先进入付费流程
- AI 接口已加入 24 小时预算保护与请求数上限，超额时返回 `429` 和机器可读错误码：`AI_BUDGET_EXCEEDED` / `AI_REQUEST_LIMIT_EXCEEDED`

## Core Routes

- `/`：产品首页
- `/api/v1/catalog`：免费 catalog
- `/api/v1/health`：健康检查
- `/api/v1/settlement/{txHash}`：链上结算确认状态查询
- `/api/v1/metrics/funnel?window=24h|7d`：endpoint 级 request funnel 导出
- `/api/v1/metrics/overview`：累计 API 调用总览
- `/prices`：兼容旧版价格接口
- `/api/*`：付费 API

## Development

```bash
npm install
npm run typecheck
npm test
npm run build:frontend
npm run dev
```

## Deployment

发布与回滚请直接按运行手册执行：

- [doc/DEPLOYMENT.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/DEPLOYMENT.md)

快速发布命令：

```bash
npm run deploy
```

说明：

- 生产收款地址由 `PAY_TO` 指定（当前默认 `0x0A5312e03C1fb2b64569fAF61aD2c6517cCB0D18`）
- 支付资产固定为 Base 主网原生 USDC（`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`）
- 浏览器内真实支付当前只优先支持 Rabby Wallet；其余钱包先保持“开发中”状态
- 建议使用 `BASE_RPC_URLS`（逗号分隔）配置主备 RPC
- AI 实时上游需通过 `wrangler secret put OPENROUTER_API_KEY` 配置 OpenRouter key
- 可通过 `OPENROUTER_DEEPSEEK_MODEL`、`OPENROUTER_QWEN_MODEL`、`OPENROUTER_GPT54_MODEL`、`OPENROUTER_GPT54_PRO_MODEL`、`OPENROUTER_CLAUDE46_MODEL` 控制模型映射
- 可通过 `AI_GLOBAL_DAILY_BUDGET_USD` 以及各 endpoint 的 `AI_*_DAILY_BUDGET_USD` 控制 24h 预算上限
- 可通过 `AI_GLOBAL_DAILY_REQUEST_LIMIT` 以及各 endpoint 的 `AI_*_DAILY_REQUEST_LIMIT` 控制 24h 请求数上限
- 防重放依赖 `REPLAY_GUARD` Durable Object

## Current Scope

- BTC / ETH 价格可尝试代理 Binance
- K 线接口已接入 Binance 上游
- `DeepSeek` / `Qwen` / `GPT-5.4` / `GPT-5.4 Pro` / `Claude 4.6` 已接入 OpenRouter 实时上游
- `Polymarket trending / search / event detail` 已接入 Gamma 实时上游
- `wallet-risk` 已接入 Base Blockscout 公共上游
- 仍有部分接口保留 demo/mock 数据
- 支付验证已支持结构化 `PAYMENT-SIGNATURE` payload、金额/路径/过期时间校验、nonce 防重放和 demo token
- 已有最小集成测试覆盖 catalog、health、402 challenge、demo replay、签名验证和 nonce 重放

## Next Steps

详细规划见 [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)。
