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
- 支付签名新增时间窗约束：默认 `issuedAt` 最长 15 分钟有效，最多允许 120 秒未来时钟偏差
- 链上结算证明新增区块年龄限制：默认只接受最近 `7200` 块内的 Base 交易，避免历史旧交易被延迟重放
- nonce 和 tx hash 防重放现在优先走 Durable Objects 持久化，不再依赖单实例内存

## Core Routes

- `/`：产品首页
- `/api/v1/catalog`：免费 catalog
- `/api/v1/health`：健康检查
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

```bash
npm run deploy
```

生产环境需要在 Cloudflare Worker 中配置 `PAY_TO`，它就是用户调用付费 API 后应该支付到的钱包地址。
当前仓库默认已配置为 `0x0A5312e03C1fb2b64569fAF61aD2c6517cCB0D18`。
支付资产固定为 `Base` 主网原生 `USDC`，合约地址为 `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`。
默认 Base RPC 为 `https://mainnet.base.org`，可通过 `BASE_RPC_URL` 覆盖。
生产建议配置 `BASE_RPC_URLS`（逗号分隔）提供主备 RPC，Worker 会按顺序自动回退，提高结算校验可用性。
`PAYMENT_MIN_CONFIRMATIONS` 用于控制交易回执最少确认块数，默认值为 `2`。
`PAYMENT_MAX_AGE_SECONDS` 用于限制支付 payload 的最大有效时间窗（默认 `900` 秒）。
`PAYMENT_MAX_FUTURE_SKEW_SECONDS` 用于限制 `issuedAt` 允许的未来时钟偏差（默认 `120` 秒）。
`PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS` 用于限制链上结算证明允许的最大区块年龄（默认 `7200` 块）。
`REPLAY_GUARD` Durable Object 负责持久化 nonce / tx hash 防重放状态。

`deploy` 会先同步 `index.html` 到 `dist/index.html`，再执行 `wrangler deploy`。

另外，`wrangler.toml` 已配置 `[build] command = "npm run build:static"`。
这意味着即使部署平台直接执行 `npx wrangler deploy`，也会先生成 `dist/`，不会再因为缺少静态目录而失败。

## Current Scope

- BTC / ETH 价格可尝试代理 Binance
- K 线接口已接入 Binance 上游
- 其余部分接口仍然以 demo/mock 数据为主
- 支付验证已支持结构化 `PAYMENT-SIGNATURE` payload、金额/路径/过期时间校验、nonce 防重放和 demo token
- 已有最小集成测试覆盖 catalog、health、402 challenge、demo replay、签名验证和 nonce 重放

## Next Steps

详细规划见 [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)。
