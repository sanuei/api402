# API Market

一个基于 Cloudflare Workers 的 x402 API Payment Gateway 演示项目。

## What It Does

- 用同一个 Worker 提供静态首页和付费 API
- 免费提供 machine-readable catalog: `/api/v1/catalog`
- 付费接口先返回 402 challenge，再接受支付头重放请求
- 当前保留 demo 支付模式，方便前端和 SDK 联调

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
npm run dev
```

## Deployment

```bash
npm run deploy
```

`deploy` 会先同步 `index.html` 到 `dist/index.html`，再执行 `wrangler deploy`。

另外，`wrangler.toml` 已配置 `[build] command = "npm run build:static"`。
这意味着即使部署平台直接执行 `npx wrangler deploy`，也会先生成 `dist/`，不会再因为缺少静态目录而失败。

## Current Scope

- BTC / ETH 价格可尝试代理 Binance
- 其余接口仍然以 demo/mock 数据为主
- 支付验证仍以 demo token 和简化签名校验为主

## Next Steps

详细规划见 [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)。
