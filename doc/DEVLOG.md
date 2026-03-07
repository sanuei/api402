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

## 2026-03-08

### 本轮目标

- 为首页增加中英文切换
- 保持 catalog、钱包弹窗和测试弹窗的动态文案可双语切换
- 记住用户语言选择，避免刷新后丢失

### 已完成

- 首页导航新增中英文切换按钮
- 页面静态文案已接入 `data-i18n` 和前端翻译表
- catalog 卡片、接口详情、示例代码提示、钱包弹窗和 API 测试弹窗都已随语言切换
- 语言选择会写入 `localStorage`，刷新后继续沿用
- README 和 ROADMAP 已同步记录双语能力

### 涉及文件

- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过

### 遗留问题

- 当前 SEO 元信息只做了标题和描述的运行时切换，尚未加入多语言 `hreflang` 策略
- Worker 返回的 catalog 仍然是单语描述，前端当前使用本地映射补足中文展示

### 下一步建议

1. 把双语字段下沉到 catalog，减少前端本地文案映射
2. 补 `hreflang` 与多语言 sitemap 策略
3. 继续把前端拆成 `i18n`、`wallet`、`catalog` 等模块

## 2026-03-08

### 本轮目标

- 把接口双语字段正式下沉到 Worker catalog
- 补 `hreflang`、多语言 canonical 和 sitemap
- 让前端直接消费 catalog 的多语言字段，减少本地写死映射

### 已完成

- Worker catalog 现在输出接口 `label` 与 `locales.zh/en`
- 前端改为直接读取 catalog 里的中英文字段渲染卡片和详情
- 首页支持通过 `?lang=zh` / `?lang=en` 切换语言
- 补 canonical、`hreflang`、`og:locale` 和运行时 JSON-LD 同步
- sitemap 已增加中英文入口与 alternate 关系
- Worker 测试新增对 catalog 双语字段的断言

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [public/sitemap.xml](/Users/yangshangwei/Desktop/网页项目/api402/public/sitemap.xml)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 7 个测试全部通过

### 遗留问题

- 目前中英文还是共用同一条页面路由，`?lang` 方案更偏轻量，不是独立静态路由
- 搜索引擎是否完全执行前端运行时切换，仍取决于抓取端渲染能力

### 下一步建议

1. 把 `/en` 和 `/zh` 做成明确的静态入口路由
2. 给 catalog 增加延迟、可用性和更新时间字段
3. 把 `whale-positions` 接成真实上游代理

## 2026-03-08

### 本轮目标

- 完善“收款地址”模块，让调用方明确知道应该向哪个地址支付
- 把页面展示、catalog 类型和测试一起补齐

### 已完成

- 首页新增收款地址与支付参数模块
- 页面支持直接复制当前网关收款地址，并跳转 Base 区块浏览器
- 前端现在直接读取 catalog.payment 的 `payTo`、`currency`、`chain`、`scheme`、`acceptedHeaders`
- Demo 连接和测试弹窗也会显示当前网关收款地址
- README 已补 `PAY_TO` 环境变量说明
- Worker 测试新增对 catalog 收款地址字段的断言

### 涉及文件

- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 7 个测试全部通过
- `npm run build:frontend` 通过

### 遗留问题

- 当前只是把收款地址展示清楚了，还没有真实链上收款确认与结算状态回查
- `PAY_TO` 仍然是单地址模型，后续如果要支持多商户，需要做按 endpoint 或按商户路由

### 下一步建议

1. 做真实支付确认和链上状态回查
2. 支持不同 API 或不同商户配置不同收款地址
3. 把 `whale-positions` 接成真实上游代理

## 2026-03-08

### 本轮目标

- 把正式收款地址切到你的 Rabby 地址
- 明确限制为仅接受 Base 主网原生 USDC
- 把链、合约、接受范围一起暴露给调用方

### 已完成

- Worker 默认收款地址改为 `0x0A5312e03C1fb2b64569fAF61aD2c6517cCB0D18`
- `wrangler.toml` 已同步配置 `PAY_TO`
- catalog 和 402 challenge 现在返回 `chainId`、`tokenContract`、`acceptance`、`note`
- 首页支付模块新增 USDC 合约地址和接受范围展示
- 页面文案明确说明只接受 `Base` 主网原生 `USDC`

### 涉及文件

- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 7 个测试全部通过
- `npm run build:frontend` 通过

### 遗留问题

- 目前只做了支付范围声明，尚未实现链上入账验证
- 还没有校验付款是否来自指定代币合约的真实转账事件

### 下一步建议

1. 做 Base USDC 入账校验
2. 把支付证明和链上交易哈希关联起来
3. 再考虑多链或多商户扩展

## 2026-03-08

### 本轮目标

- 开始接入真实 Base USDC 入账校验
- 让非 demo 请求必须提供链上交易证明
- 补充部署配置和测试覆盖

### 已完成

- Worker 现在支持通过 `X-PAYMENT-TX-HASH` 提交 Base 交易哈希
- 非 demo 请求会回查 Base RPC 的 `eth_getTransactionReceipt`
- 只接受命中 Base 原生 USDC 合约、`from -> payTo`、金额足够的 `Transfer` 日志
- 新增交易哈希防重放，避免同一笔链上支付重复消费
- catalog 和 402 challenge 已暴露 `settlementProofHeader` / `settlementMethod`
- `wrangler.toml` 新增 `BASE_RPC_URL`
- 测试新增真实结算通过和缺失交易哈希被拒绝两类场景

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 8 个测试全部通过

### 遗留问题

- 当前只校验单笔交易回执，没有做确认数策略
- 还没有把交易哈希、nonce、请求日志持久化到 Durable Objects / KV
- 浏览器端还没有提供真实链上支付发起 UI

### 下一步建议

1. 把 nonce / tx hash 防重放迁移到持久层
2. 加入确认数或区块高度校验
3. 再做浏览器端真实支付发起流程

## 2026-03-08

### 本轮目标

- 把 nonce / tx hash 防重放从单实例内存迁移到 Durable Objects
- 保证同一笔支付证明不会因为 Worker 重启或多实例而失效
- 补 Durable Objects 配置、测试和文档

### 已完成

- 新增 `ReplayGuardDurableObject`
- `wrangler.toml` 新增 `REPLAY_GUARD` binding 和迁移配置
- nonce 与 tx hash 现在通过 Durable Objects 原子消费，避免单实例内存丢失
- 本地测试环境已补 fake Durable Object namespace，覆盖新逻辑
- README 和 ROADMAP 已同步记录持久化防重放能力

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 8 个测试全部通过
- `npx wrangler deploy --dry-run` 通过

### 遗留问题

- Durable Object 目前是单全局实例，流量继续增长后可以再分片
- 还没有对 Base 交易确认数做更严格的结算策略

### 下一步建议

1. 增加确认数或区块高度校验
2. 把 `whale-positions` 接成真实上游代理
3. 再做浏览器端真实支付发起流程

## 2026-03-08

### 本轮目标

- 建立每 15 分钟自动巡检并持续开发的任务
- 把自动化规则写入仓库文档，便于后续追踪

### 已完成

- 已创建 OpenClaw cron 任务 `API402 Autopilot`
- 调度频率为每 15 分钟
- 自动任务会先读取 `doc/DEVLOG.md`、`doc/ROADMAP.md` 和 git 状态，再决定下一步开发任务
- 自动任务默认会在变更可验证时提交、推送并部署

### 任务信息

- Job ID: `6c1a7df7-f49b-424a-ab58-64cc50574f73`
- Schedule: `every 15m`
- Session mode: `isolated`

### 说明

- OpenClaw 定时任务不能直接复用当前 Codex 聊天窗口
- 连续性依赖仓库里的 [DEVLOG.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/DEVLOG.md)、[ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md) 和 git 历史

### 涉及文件

- [doc/DEVLOG.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/DEVLOG.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `openclaw cron status` 可用
- `openclaw cron add` 已成功创建任务

### 下一步建议

1. 观察首轮自动执行结果
2. 如果自动任务出现稳定阻塞，再补更细的自动化约束
3. 继续按 ROADMAP 当前优先级推进真实支付与真实上游

## 2026-03-08

### 本轮目标

- 提升真实支付结算稳健性，降低“刚上链即重放”导致的确认风险

### 已完成

- 支付验证新增 Base 区块确认门槛：交易回执除 `status=0x1` 外，还需达到最少确认块数才放行
- 新增 `PAYMENT_TX_NOT_CONFIRMED` 机器可读错误码，用于指导调用方等待确认后重试
- catalog 与 402 challenge 同步暴露 `settlementConfirmationsRequired`，方便 SDK / Agent 自动化决策
- 增加 `PAYMENT_MIN_CONFIRMATIONS` 环境变量（默认 2）
- 更新测试桩为双 RPC 方法（`eth_getTransactionReceipt` + `eth_blockNumber`）并新增确认块数不足测试
- 更新 README 与 ROADMAP，记录确认块门槛行为

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 9 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 把 `whale-positions` 接成真实上游代理（优先级最高的 live integration 缺口）
2. 给上游代理补统一超时 / 熔断 / fallback 策略
3. 在 catalog 追加实时 latency / availability 指标字段
