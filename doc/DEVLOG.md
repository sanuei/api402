# Development Log

## 2026-03-07

### 本轮目标

- 重构首页和网关接口模型
- 建立可持续维护的路线图文档
- 修复云端直接执行 `npx wrangler deploy` 时 `dist/` 不存在导致的部署失败

### 已完成

- 重构首页为开发者导向的产品页，支持从 catalog 动态渲染接口列表
- Worker 新增 `GET /api/v1/catalog` 和 `GET /api/v1/health`
- 统一静态站、catalog、付费 API 的 Worker 部署模型
- 增加 [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)
- 在 `wrangler.toml` 中新增 `build.command = "npm run build:static"`，让部署平台直接执行 `wrangler deploy` 时也会先生成 `dist/`
- 更新 README，记录新的部署行为

### 涉及文件

- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [src/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/index.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [package.json](/Users/yangshangwei/Desktop/网页项目/api402/package.json)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 遗留问题

- 当前真实支付验证仍未完成，仍以 demo token 和简化签名校验为主
- 自定义域名 `api-402.com` 的外部可达性仍需单独确认

### 下一步建议

1. 定义稳定的 `PAYMENT-SIGNATURE` payload schema
2. 为支付验证逻辑增加最小集成测试
3. 在 catalog 中加入 `exampleRequest`、`exampleResponse`、`status`
4. 把更多 mock API 替换成真实上游代理

## 2026-03-08

### 本轮目标

- 清理 Cloudflare 中未被当前仓库使用的历史 Pages / Workers 资源

### 已完成

- 确认当前仓库唯一正式部署目标是 `api-market-x402`
- 确认 `api-market` 为独立 Pages 项目，且无 Git 连接
- 确认 `api-market-x402-production` 为独立旧 Worker，不在当前部署链路内
- 删除历史 Pages 项目 `api-market`
- 删除历史 Worker `api-market-x402-production`

### 遗留状态

- 当前保留的正式部署资源为 `api-market-x402`
- 主域名路由仍由 `api-market-x402` 承载

### 下一步建议

1. 补充 `doc/DEPLOYMENT.md`，明确唯一主部署路径
2. 后续所有发布都只对 `api-market-x402` 操作

## 2026-03-08

### 本轮目标

- 开始 Phase 2，收紧支付 payload 结构
- 补最小集成测试
- 扩展 catalog 字段，方便前端和后续 SDK 复用

### 已完成

- 把支付 payload 定义为结构化 `PAYMENT-SIGNATURE` schema
- 新增金额、目标地址、资源路径、过期时间、签名有效性校验
- 402 challenge 新增机器可读 `reason` / `X-Payment-Reason`
- catalog 新增 `status`、`tags`、`exampleRequest`、`exampleResponse`
- 增加最小集成测试，覆盖 catalog、health、402、demo replay、签名验证
- 在 `package.json` 中加入 `npm test`
- 更新 README 和 ROADMAP，反映当前进度

### 涉及文件

- [src/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [package.json](/Users/yangshangwei/Desktop/网页项目/api402/package.json)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 6 个测试全部通过

### 遗留问题

- 还没有做 nonce 去重，签名目前只验证结构和签名，不防重放
- 真实上游代理仍然只覆盖 BTC / ETH
- 前端还没有把新增的 catalog 字段全部展示出来

### 下一步建议

1. 做 nonce 去重和更严格的时间窗
2. 把 `kline` 或 `whale-positions` 接成真实上游
3. 把前端示例区改成直接消费 catalog 的 `exampleRequest` / `exampleResponse`

## 2026-03-08

### 本轮目标

- 把前端迁移到 `Vite + TypeScript`
- 把 Worker 和前端目录拆开，形成可扩展结构

### 已完成

- 新增 `Vite` 前端构建链路，`dist/` 现在由 `vite build` 产出
- Worker 迁移到 `worker/` 目录
- 前端逻辑迁移到 `src/main.ts`
- 自定义样式迁移到 `src/styles.css`
- 补前端类型定义 `src/types.ts`
- 拆分 TypeScript 配置为 app / worker 两套
- 保持现有 Worker、测试和部署链路可用

### 涉及文件

- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [src/styles.css](/Users/yangshangwei/Desktop/网页项目/api402/src/styles.css)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [vite.config.ts](/Users/yangshangwei/Desktop/网页项目/api402/vite.config.ts)
- [tsconfig.app.json](/Users/yangshangwei/Desktop/网页项目/api402/tsconfig.app.json)
- [tsconfig.worker.json](/Users/yangshangwei/Desktop/网页项目/api402/tsconfig.worker.json)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过
- `npm run build:frontend` 通过

### 遗留问题

- 前端现在已经脱离单文件 HTML，但还没有继续细拆为更小的 UI / API 模块
- 仍然使用 Tailwind CDN，后续可以再决定是否切到本地 Tailwind 构建

### 下一步建议

1. 继续把前端逻辑拆成 `catalog`、`wallet`、`modal` 模块
2. 做 nonce 去重和防重放
3. 选择一个 mock API 接成真实上游

## 2026-03-08

### 本轮目标

- 继续推进协议可用性，补防重放
- 接入 Rabby Wallet
- 为网站补上 Logo 和 SEO 基础设施

### 已完成

- Worker 增加 nonce 防重放校验
- `kline` 接口改为真实 Binance 上游代理
- 前端增加 Rabby Wallet 连接入口与 provider 识别
- 新增 logo、wordmark、favicon、Open Graph 卡片
- 新增 `robots.txt` 与 `sitemap.xml`
- 首页补 canonical、Open Graph、Twitter 和 JSON-LD 结构化数据

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [public/logo-mark.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/logo-mark.svg)
- [public/logo-wordmark.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/logo-wordmark.svg)
- [public/favicon.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/favicon.svg)
- [public/og-card.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/og-card.svg)
- [public/robots.txt](/Users/yangshangwei/Desktop/网页项目/api402/public/robots.txt)
- [public/sitemap.xml](/Users/yangshangwei/Desktop/网页项目/api402/public/sitemap.xml)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 7 个测试全部通过
- `npm run build:frontend` 通过

### 说明

- 已按 `$logo-creator` 技能检查流程处理，但当前环境缺少图像生成所需 API key，因此本轮改用手工 SVG 方案直接落地可上线 Logo 资源

### 遗留问题

- nonce 目前仍然保存在 Worker 单实例内存中，不是跨实例持久存储
- Rabby 目前完成的是地址连接，不包含专用交易或签名 UI
- `whale-positions` 仍然是 demo 数据

### 下一步建议

1. 用 Durable Objects 或 KV 做 nonce 持久化
2. 把 `whale-positions` 接成真实上游
3. 把前端继续拆成更细的模块
