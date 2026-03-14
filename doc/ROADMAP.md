# API Market Roadmap

更新日期: 2026-03-08

## Product Goal

把 `api-402.com` 做成一个面向开发者和 AI Agent 的 x402 API Gateway：

- 免费暴露 machine-readable catalog，方便 discovery
- 付费 API 返回结构化 402 挑战，方便自动化重试
- 用 Base 上的 USDC 做微支付
- 既能作为产品首页，也能作为开发者联调入口

## Current Status

当前仓库已经完成第一轮统一化改造：

- Worker 同时负责静态站、catalog、health、付费 API
- 前端已迁移到 `Vite + TypeScript` 结构，Worker 已迁移到独立目录
- 首页从 catalog 动态渲染，不再完全硬编码
- 页面结构和开发者入口更贴近 `claw402.ai` 的产品表达方式
- 保留 demo 支付流，方便完整演示 402 -> replay -> data
- 已定义结构化 `PAYMENT-SIGNATURE` payload schema
- 已补最小集成测试，覆盖 catalog、health、402、demo replay、签名验证
- 已加入 nonce 防重放逻辑
- 已支持 Rabby Wallet 地址连接
- 已支持首页中英文切换与语言记忆
- 已把 catalog 的名称/分类/描述下沉为中英文字段
- 已补 logo、favicon、Open Graph、robots 和 sitemap
- 已补 `hreflang`、多语言 canonical 与双语 sitemap
- 已固定收款地址、USDC 合约和 Base 主网支付范围
- 已将 nonce / tx hash 防重放迁移到 Durable Objects
- 已加入 Base 交易确认块数门槛（默认 2 confirmations）以增强结算稳健性
- 402 challenge 和成功响应已输出结构化 settlement 上下文（txHash、receiptBlock、latestBlock、confirmations）
- catalog 和 402 challenge 已输出 settlementPolicy（确认目标、平均区块时间、推荐重试间隔）；确认数不足时会返回 Retry-After
- 已新增 `GET /api/v1/settlement/{txHash}` 结算状态查询接口，支持 machine-readable 状态和 Retry-After 建议
- settlement 查询已支持可选 `PAYMENT-SIGNATURE` 证明绑定校验，并支持 `payer` / `resource` / `payTo` / `minAmount` 过滤归因
- catalog 已输出 `settlementStatusRemediation` / `paymentReasonRemediation`，402 challenge 与 settlement 查询响应会返回 `remediation`，方便 SDK 按错误码执行自动补救
- remediation 字段已增加稳定版本元信息（`remediationSchemaVersion=1.0.0`、`remediationCompatibility=semver-minor-backward-compatible`），降低 SDK 解析漂移风险
- catalog / 402 / settlement 响应已附 `remediationRefs`（changelog / deprecations 公告地址），便于 SDK 自动发现兼容升级公告
- 支付签名已加入时间窗约束（`issuedAt` 最大年龄与未来时钟偏差限制），降低延迟重放风险
- Base 结算校验已支持 `BASE_RPC_URLS` 主备 RPC 自动回退（含请求超时控制）
- Base 结算证明已加入最大区块年龄限制（默认 7200 blocks），可拦截历史交易延迟重放
- 已将 `whale-positions` 接入 HyperLiquid 实时成交聚合（BTC/ETH）
- 已为 live 上游接口补统一错误码、熔断冷却与 machine-readable fallback 元信息（`_meta.upstream` + catalog `upstreamPolicy`）
- catalog `upstreamPolicy` 已补 15 分钟窗口的可用性/延迟遥测字段（successRate、avg/p95 latency、last error）
- catalog `requestMetrics` 已补 endpoint 级请求量、错误码分布、最近 60 分钟错误趋势分桶，以及支付阶段漏斗统计（`challenged402` / `settled` / `replayed` 与 challenge→replay 转化率）
- catalog endpoint 已补 `lastUpdatedAt` 与 `freshness`（`status` / `ageSeconds` / `maxAgeSeconds` / `signal`），用于数据新鲜度判断
- 前端 API 卡片与接口详情已展示 freshness 状态和更新时间，提升接入前的数据可用性判断效率
- 前端 API 卡片与接口详情已新增 `requestMetrics` 核心字段展示（近 60 分钟请求量 / 402 比率 / replay 转化率），可直接用于转化诊断
- 前端 API 卡片与接口详情已补 request trend sparkline（6 桶）与 Top 错误码展示，加快转化波动定位
- 402 challenge、成功响应与 settlement 查询均支持 `requestId` 回传（`X-Request-Id`），payment funnel 现基于 requestId 做 challenge→replay 精确归因
- upstream telemetry 与 endpoint requestMetrics 已持久化到 Durable Objects，并用于 catalog snapshot 聚合（降低冷启动窗口丢失）
- 已新增 `GET /api/v1/metrics/funnel`，支持 `window=24h|7d` 的 requestId 漏斗聚合导出（challenged402 / settled / replayed / conversion）
- 已将 `/api/deepseek` 与 `/api/qwen` 接入 OpenRouter 真实上游，并补输入校验与输出 token 上限控制
- 已为 AI 接口加入 24h 成本与请求数保护（rolling budget / request caps），超限时返回 machine-readable quota 错误码
- 已优先打通 Rabby Wallet 的浏览器内真实支付闭环（Base 切链、签名、USDC 转账、确认后自动 replay）
- 钱包策略已收紧为“先跑通一个再扩多钱包”，Coinbase Wallet / MetaMask 在 UI 中明确标注为开发中
- 已创建 OpenClaw 每 15 分钟自动巡检与持续开发任务
- 已补 `doc/DEPLOYMENT.md`，明确发布、回滚与故障诊断路径
- 已新增 `doc/API_EXPANSION.md`，集中维护后续高价值 API 扩展清单与优先级
- 已完成前端模块化第一步：`src/main.ts` 拆分为 `config/state/i18n/catalog/wallet/bootstrap`
- 已完成后端模块化第一步：支付协议层从 `worker/index.ts` 抽离到 `worker/payment.ts`
- 已完成后端模块化第二步：实时上游代理与 AI provider 逻辑从 `worker/index.ts` 抽离到 `worker/upstreams.ts`
- 已完成后端模块化第三步：结算状态查询与证明绑定校验从 `worker/index.ts` 抽离到 `worker/settlement.ts`
- 已补网页内 API 快速目录，支持按分类快速选中接口
- 已新增 `GPT-5.4`、`GPT-5.4 Pro`、`Claude 4.6` 三个按次调用入口，并纳入 OpenRouter 成本保护体系
- 已补产品级重构方案文档 [PRODUCT_REBUILD_PLAN.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/PRODUCT_REBUILD_PLAN.md)，明确“最新模型获客 + Web3 AI 高价值接口盈利”的主线
- 已新增盈利优化文档 [PROFIT_IMPROVEMENT_PLAN.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/PROFIT_IMPROVEMENT_PLAN.md)，记录 challenge 高、转化低的原因和盈利优先级
- 已新增 `GET /api/wallet-risk?address=0x...`，基于 Base Blockscout 地址详情、计数器和近期活动输出结构化钱包风险画像
- 已新增 `GET /api/approval-audit?address=0x...`，基于 Base Blockscout 的近期授权交易和 spender 元数据输出结构化授权风险审计
- 已新增 `GET /api/v1/metrics/overview`，首页可实时轮询展示累计 API 调用总次数
- 首页统计面板已升级为更偏专业产品页的布局，包含累计调用、已结算 USDC、24h 趋势、成功率和 402 比率
- 已补 3 个新的 logo 概念稿到 `public/logo-concepts/`

## Phase 1

目标: 统一产品面与接口面，形成可以公开演示的 MVP。

已完成:

- `GET /api/v1/catalog`
- `GET /api/v1/health`
- 静态首页重构
- API 卡片动态渲染
- 统一前端和 Worker 的支付挑战展示

验收标准:

- 首页能从 catalog 拉取 API 列表
- 任何付费接口先返回 402
- Demo 模式下能在浏览器完成完整请求闭环
- 同一 Worker 能同时托管页面和 API

## Phase 2

目标: 把支付验证从 demo 过渡到真实 x402 / EIP-3009。

任务:

- 定义稳定的签名 payload schema
- 接入真实 `PAYMENT-SIGNATURE` 验证
- 校验金额、接收地址、nonce、deadline
- 补充失败原因和错误码
- 引入钱包地址维度的限流策略

验收标准:

- demo token 变为仅限测试环境
- 签名验证可独立通过集成测试
- 支付失败有可机器解析的错误响应

## Phase 3

目标: 把 API 网关从展示站升级为可持续接入新 API 的平台。

任务:

- 把更多 mock API 替换成真实上游代理
- 增加缓存、超时和熔断
- 增加 endpoint tags、version、latency、availability
- 增加请求日志和调用统计
- 提供基础 dashboard

验收标准:

- catalog 中至少 70% 的接口为真实代理
- 上游故障时网关能稳定返回受控错误
- 可查看每个接口的调用量和状态

## Phase 4

目标: 降低第三方接入门槛。

任务:

- 发布 Web / Node SDK
- 发布 Python Agent SDK
- 提供 curl、TypeScript、Python 三套示例
- 增加 webhook / callback 模式
- 输出更明确的 quickstart 文档

验收标准:

- 第三方开发者能在 10 分钟内完成一次付费调用
- SDK 自动处理 402 challenge 和 replay

## Immediate Next Tasks

建议下一轮直接做下面几项:

1. 继续扩展高价值链上接口，优先 `tx-simulate-explain`
2. 在 `Polymarket` 上继续补高频策略型接口，优先 `entry-signal`、`rotation`、`range-breakout`
3. 为最新模型入口补更明确的产品位和对比说明，提升付费转化
4. 为 AI 类接口补成本统计面板与毛利监控，直接展示收入 vs 上游成本
5. 把低护城河接口从首页主卖点降级，把首单付费入口收敛到 1 到 2 个更值钱的接口

## Operations

- OpenClaw 定时任务 `API402 Autopilot` 每 15 分钟检查一次仓库状态
- 自动任务会优先读取 `doc/DEVLOG.md` 与 `doc/ROADMAP.md`
- 连续性主要依赖仓库文档与 git 历史，不依赖当前 Codex 聊天窗口
