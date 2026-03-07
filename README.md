# API Market

一个基于 Cloudflare Workers 的 x402 API Payment Gateway 演示项目。

## Project Structure

- `index.html`：Vite 入口 HTML
- `src/`：前端 TypeScript 和样式
- `worker/`：Cloudflare Worker 后端
- `test/`：Worker 集成测试
- `public/`：Logo、favicon、OG 图、robots、sitemap 等静态资源
- `dist/`：Vite 构建产物

## What It Does

- 用同一个 Worker 提供静态首页和付费 API
- 免费提供 machine-readable catalog: `/api/v1/catalog`
- 付费接口先返回 402 challenge，再接受支付头重放请求
- 当前保留 demo 支付模式，方便前端和 SDK 联调
- 支持 MetaMask、Coinbase Wallet、Rabby Wallet 地址连接
- 支持首页中英文一键切换，并记住用户语言选择
- catalog 已输出中英文字段，前端直接消费 Worker 返回的多语言文案
- 提供基础 SEO 资源，包括 favicon、OG 图、robots 和 sitemap
- 已补 `hreflang`、多语言 canonical 和双语 sitemap
- 收款地址由 Worker 的 `PAY_TO` 环境变量决定，catalog 和 402 challenge 会对外暴露这个地址
- 当前支付范围固定为 `Base` 主网原生 `USDC`，不接受其他链上的 USDC
- 非 demo 请求现在要求提供 `PAYMENT-SIGNATURE` 和 `X-PAYMENT-TX-HASH`，Worker 会回查 Base 链上 USDC 转账回执
- 支付通过或被 402 拒绝时都会返回结构化 `settlement` 上下文（txHash、receiptBlock、confirmations），便于 SDK 自动重试
- 新增 `GET /api/v1/settlement/{txHash}` 结算状态查询接口，返回 machine-readable 状态码与重试建议
- settlement 查询支持可选 `PAYMENT-SIGNATURE` 证明校验，并可通过 `payer`/`resource`/`payTo`/`minAmount` 过滤条件做归因绑定校验
- catalog 与 402 challenge 会返回 `settlementPolicy`（确认数、平均区块时间、建议重试间隔）；当确认数不足时会返回 `Retry-After`
- catalog 现在额外暴露 `settlementStatusRemediation` / `paymentReasonRemediation`，402 与 settlement 响应也会返回 `remediation` 字段，便于 SDK 根据错误码自动执行补救动作
- remediation 相关字段已增加稳定元信息：`remediationSchemaVersion`（当前 `1.0.0`）和 `remediationCompatibility`（`semver-minor-backward-compatible`）
- catalog / 402 / settlement 响应现在都附带 `remediationRefs`（`changelog` 与 `deprecations` 公告地址），便于 SDK 自动发现兼容变更公告
- catalog `endpoints[].requestMetrics` 已输出最近 60 分钟请求量、错误码分布和 10 分钟分桶错误趋势，便于转化与可靠性运营
- 支付签名新增时间窗约束：默认 `issuedAt` 最长 15 分钟有效，最多允许 120 秒未来时钟偏差
- 链上结算证明新增区块年龄限制：默认只接受最近 `7200` 块内的 Base 交易，避免历史旧交易被延迟重放
- nonce 和 tx hash 防重放现在优先走 Durable Objects 持久化，不再依赖单实例内存

## Core Routes

- `/`：产品首页
- `/api/v1/catalog`：免费 catalog
- `/api/v1/health`：健康检查
- `/api/v1/settlement/{txHash}`：链上结算确认状态查询
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
- 建议使用 `BASE_RPC_URLS`（逗号分隔）配置主备 RPC
- 防重放依赖 `REPLAY_GUARD` Durable Object

## Current Scope

- BTC / ETH 价格可尝试代理 Binance
- K 线接口已接入 Binance 上游
- 其余部分接口仍然以 demo/mock 数据为主
- 支付验证已支持结构化 `PAYMENT-SIGNATURE` payload、金额/路径/过期时间校验、nonce 防重放和 demo token
- 已有最小集成测试覆盖 catalog、health、402 challenge、demo replay、签名验证和 nonce 重放

## Next Steps

详细规划见 [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)。
