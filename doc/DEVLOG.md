# Development Log

## 2026-03-09

### 本轮目标

- 给首页补一个更完整的正式页脚，让页面收尾更像产品站而不是 demo 落版

### 已完成

- 用多栏 footer 替换了原来的单条 tagline 结构
- 页脚现在包含：
  - 品牌摘要
  - 产品入口
  - 开发者入口
  - 基础设施链接
- 增加了 `Catalog JSON / Health / Metrics / SDK Starter / OpenClaw` 等直接入口
- 双语 footer 文案已同步补齐
- 补了独立 footer 样式，并处理了平板和手机端的栅格收缩

### 涉及文件

- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [src/app/i18n.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/i18n.ts)
- [src/styles.css](/Users/yangshangwei/Desktop/网页项目/api402/src/styles.css)

### 下一步建议

1. 继续收紧首页 Hero 文案，让首屏更像“买 API”的一句话销售页
2. 再单独优化 integrations / OpenClaw 区块，把接入步骤压缩成更短的 3 步
3. 后面如果继续 polish，可以把 catalog 做成更明显的“目录 + 详情”双栏产品布局

## 2026-03-08

### 本轮目标

- 提升首页的专业度，优化统计卡片布局、FAQ 表达和中段卖点区，并补新的 logo 备选方案

### 已完成

- 首页统计卡片从拥挤的多块平铺，改成更有层次的 5 卡布局：
  - 总调用次数
  - 累计已结算 USDC
  - 24h 活跃数据
  - 24h 趋势
  - 网关状态与成功率 / 402 比率
- 中段原有“为什么这样设计 / 当前架构 / 下一步”已替换成更偏客户视角的卖点卡：
  - 为什么值得买
  - 结算可验证
  - 现在能买什么
- FAQ 改成更像正式产品页的对外问答，不再偏内部开发说明
- footer tagline 改成更接近产品定位的表述
- 新增 3 个 logo 备选 SVG：
  - [logo-concept-01-orbit.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/logo-concepts/logo-concept-01-orbit.svg)
  - [logo-concept-02-grid.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/logo-concepts/logo-concept-02-grid.svg)
  - [logo-concept-03-signal.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/logo-concepts/logo-concept-03-signal.svg)
- 已补预览页：
  - [preview.html](/Users/yangshangwei/Desktop/网页项目/api402/public/logo-concepts/preview.html)
- 用户已选定 `logo-concept-03-signal.svg` 作为主方向
- 主品牌资源已同步替换：
  - [logo-mark.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/logo-mark.svg)
  - [logo-wordmark.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/logo-wordmark.svg)
  - [favicon.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/favicon.svg)
  - [og-card.svg](/Users/yangshangwei/Desktop/网页项目/api402/public/og-card.svg)

### 下一步建议

1. 从 3 个 logo 方案里选 1 个，替换现有主 logo
2. 把 Hero 文案继续收紧成更明确的购买理由
3. 继续做收入排行和利润面板

## 2026-03-08

### 本轮目标

- 给首页增加“累计 API 调用总次数”的真实统计，并保持实时更新

### 已完成

- 新增 `GET /api/v1/metrics/overview`
- Metrics Durable Object 现在会持久化累计 API 调用总次数和最近一次调用时间
- 首页 Hero 指标区新增总调用次数卡片
- 前端会每 15 秒轮询一次总览指标，刷新总调用次数和最后更新时间
- catalog 文档出口也已补 `metricsOverview` 地址
- 测试已补 overview 路由验证

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [catalog.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/catalog.ts)
- [bootstrap.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/bootstrap.ts)
- [types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [i18n.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/i18n.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 下一步建议

1. 把总调用次数再补成按日趋势或近 24h 增量
2. 继续推进 `approval-audit`
3. 把首页 Hero 进一步改成更偏转化的数据面板

## 2026-03-08

### 本轮目标

- 开始落地第一批真正更容易赚钱的高价值接口，优先做 `wallet-risk`

### 已完成

- 新增付费接口 `GET /api/wallet-risk?address=0x...`
- 接口现在会在付费前先校验 `address` 参数，避免无效请求先进入 402 支付流程
- 上游实现接入 Base Blockscout 公共 API：
  - 地址详情
  - 地址计数器
  - 近期交易
  - 近期 token transfers
- 返回结构现在包含：
  - `riskScore`
  - `riskLevel`
  - `identity`
  - `activity`
  - `signals`
- 当前风险画像第一版重点是“结构化前置筛查”，适合给 agent 或自动化工作流做预检查
- catalog、API 目录、README 与 backlog 文档已同步更新
- 测试已补：
  - 缺少 `address` 时返回 `400`
  - 正常上游数据可返回结构化风险摘要

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [worker/upstreams.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/upstreams.ts)
- [worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [API_EXPANSION.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/API_EXPANSION.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 下一步建议

1. 继续做 `approval-audit`
2. 再做 `tx-simulate-explain`
3. 把首页主推接口文案改成“Frontier Models + Wallet Risk”

## 2026-03-08

### 本轮目标

- 从“功能堆叠”转向“产品重构”，补商业化方向文档、网页 API 快速目录，并把最新旗舰模型入口接进真实上游

### 已完成

- 新增产品级方案文档 [PRODUCT_REBUILD_PLAN.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/PRODUCT_REBUILD_PLAN.md)，明确：
  - `最新模型按次体验` 作为获客入口
  - `Web3 + AI 风控 / 情报 / 执行辅助接口` 作为后续利润中心
  - 低价值价格接口降级为 demo / 联调角色
- 首页 catalog 新增左侧 API 快速目录：
  - 支持按分类浏览
  - 支持点击目录同步高亮右侧卡片
  - 新模型变多后仍可快速定位
- 新增三个真实 OpenRouter 模型入口：
  - `/api/gpt-5.4`
  - `/api/gpt-5.4-pro`
  - `/api/claude-4.6`
- AI 配额策略从只支持 `deepseek/qwen` 的分支判断，改成按 endpoint 配置映射，便于后续继续扩模型
- `wrangler.toml` 已补对应模型、预算和请求上限配置
- 测试已补 catalog 暴露与新模型代理验证

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [worker/upstreams.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/upstreams.ts)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [catalog.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/catalog.ts)
- [bootstrap.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/bootstrap.ts)
- [styles.css](/Users/yangshangwei/Desktop/网页项目/api402/src/styles.css)
- [i18n.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/i18n.ts)
- [worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [PRODUCT_REBUILD_PLAN.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/PRODUCT_REBUILD_PLAN.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 下一步建议

1. 把 `wallet-risk` 做成下一批真正更容易赚钱的高价值接口
2. 把首页 Hero 和 pricing 说明从“支付网关介绍”改成“按次体验最新模型”
3. 给 `GPT-5.4` / `Claude 4.6` 补 quickstart 和真实调用示例

## 2026-03-08

### 本轮目标

- 继续做后端结构优化，把 settlement/status 查询与证明校验路由从 `worker/index.ts` 中抽离出去

### 已完成

- 新增独立结算模块 [settlement.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/settlement.ts)，承接：
  - `GET /api/v1/settlement/{txHash}` 路由响应组装
  - 结算状态查询
  - `PAYMENT-SIGNATURE` 证明绑定校验
  - `payTo` / `minAmount` 等过滤条件校验
- `worker/index.ts` 现在只在 settlement 路由处分发请求并注入公共依赖：
  - `apiResponse`
  - `callBaseRpc`
  - `getRequestId`
- 当前后端主文件规模已从 `2800` 行进一步降到 `2521` 行

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [settlement.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/settlement.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 27 个测试全部通过

### 下一步建议

1. 继续拆 `worker/index.ts`，优先分出 `metrics` 聚合与 DO snapshot 逻辑
2. 然后再做 metrics Durable Object 分片
3. 结构清完后开始第一组高价值新接口：`Web Search`

## 2026-03-08

### 本轮目标

- 继续做后端结构优化，把实时上游代理和 AI provider 逻辑从 `worker/index.ts` 中抽离出去

### 已完成

- 新增独立上游模块 [upstreams.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/upstreams.ts)，承接：
  - Binance / HyperLiquid / OpenRouter 实时上游代理
  - AI provider 模型、配额、请求上下文与消息标准化
  - 上游超时、熔断、fallback 元信息与统一返回结构
- `worker/index.ts` 现在通过依赖注入把 circuit、telemetry、AI usage 持久化能力传给 `upstreams.ts`，主流程保留路由编排，不再内联所有上游细节
- 当前后端主文件规模已从 `3340` 行进一步降到 `2800` 行

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [upstreams.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/upstreams.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 27 个测试全部通过

### 下一步建议

1. 继续拆 `worker/index.ts`，优先分出 `metrics` 聚合与 `settlement/status routes`
2. 然后再做 metrics Durable Object 分片
3. 结构清完后开始第一组高价值新接口：`Web Search`

## 2026-03-08

### 本轮目标

- 继续做后端结构优化，先把支付协议层从超大 `worker/index.ts` 中抽离出来

### 已完成

- 新增独立支付模块 [payment.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/payment.ts)，承接：
  - payment payload / settlement / remediation 类型
  - payment 常量与错误码映射
  - Base USDC 相关 helper
  - payment payload builder
  - settlement policy / remediation builder
- `worker/index.ts` 继续保留路由与主流程，但支付协议层知识不再散落在主文件前半段
- 为兼容测试与现有导入路径，`worker/index.ts` 继续导出：
  - `buildPaymentMessage`
  - `PaymentPayload`
- 当前后端主文件规模已从 `3715` 行降到 `3340` 行

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [payment.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/payment.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 27 个测试全部通过

### 下一步建议

1. 继续拆 `worker/index.ts`，优先分出 `settlement/status route` 和 `upstreams`
2. 然后再拆 `metrics` 持久层聚合逻辑
3. 结构清完后开始第一组新接口：`Web Search`

## 2026-03-08

### 本轮目标

- 先做结构优化而不是继续堆功能，把前端从单个超大入口文件拆成可维护模块

### 已完成

- 前端模块化第一步已完成：
  - `src/main.ts` 现在只负责启动
  - `src/app/config.ts` 负责配置与 API base
  - `src/app/state.ts` 负责共享状态
  - `src/app/i18n.ts` 负责中英文文案与静态翻译同步
  - `src/app/format.ts` 负责格式化与网关展示辅助函数
  - `src/app/catalog.ts` 负责 catalog 渲染、数据加载、接口测试弹窗
  - `src/app/wallet.ts` 负责钱包连接、Rabby 支付闭环、replay
  - `src/app/bootstrap.ts` 负责事件绑定和应用启动
- 保持了现有行为不变：
  - Demo Mode 仍可用
  - Rabby 真实支付闭环仍保留
  - Coinbase Wallet / MetaMask 仍明确为开发中
- 当前前端结构已经从“单入口堆逻辑”变成“按职责拆分”，后续继续加功能时不需要反复改一个 1400 行文件

### 涉及文件

- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [config.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/config.ts)
- [state.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/state.ts)
- [i18n.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/i18n.ts)
- [format.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/format.ts)
- [catalog.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/catalog.ts)
- [wallet.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/wallet.ts)
- [bootstrap.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/bootstrap.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 27 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 继续拆 `worker/index.ts`，优先分出 `payment`、`metrics`、`upstreams`
2. 拆完后再开始第一组高价值新接口：`Web Search`
3. 后续再处理 `DEVLOG` 月度归档

## 2026-03-08

### 本轮目标

- 回答当前项目的结构与支付现状问题，并把后续高价值 API 扩展清单固化到仓库文档

### 已完成

- 评估了当前前后端和文档规模：
  - `src/main.ts`: 1411 行
  - `worker/index.ts`: 3715 行
  - `doc/DEVLOG.md`: 1530 行
- 确认当前网页中“连接钱包”的作用：
  - Demo Mode：浏览器内 demo replay
  - Rabby Wallet：浏览器内真实 Base USDC 支付闭环
  - Coinbase Wallet / MetaMask：当前仅在 UI 标注为开发中，不承诺可用
- 新增后续 API 扩展清单文档 [API_EXPANSION.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/API_EXPANSION.md)
- 将 search / crawl / extract、PDF / OCR、onchain intelligence 等方向按变现优先级集中整理，避免后续只停留在聊天记录中

### 涉及文件

- [API_EXPANSION.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/API_EXPANSION.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 下一步建议

1. 对 `src/main.ts` 做前端模块拆分，优先拆 `wallet`、`api-client`、`i18n`、`catalog`、`modal`
2. 对 `worker/index.ts` 做后端分层，优先拆 `routes`、`payment`、`metrics`、`upstreams`
3. 将 `DEVLOG` 改成按月归档，例如 `doc/devlog/2026-03.md`

## 2026-03-08

### 本轮目标

- 先优先跑通一个真实钱包，不再同时推进多钱包半成品；将 Rabby Wallet 浏览器内支付闭环接到现有 Worker，其他钱包在 UI 中明确标注为开发中

### 已完成

- 前端钱包策略调整为“先打通一个，再扩多个”：
  - Rabby Wallet：浏览器内真实支付闭环已接通
  - Coinbase Wallet / MetaMask：UI 明确标注为“开发中”
- API 测试弹窗现在支持 Rabby 真实支付流程：
  - 首次请求拿 402 challenge
  - 切换到 Base 主网
  - 对 canonical payment payload 签名
  - 发起 Base USDC `transfer(payTo, amount)`
  - 等待确认数达到 Worker 要求
  - 自动携带 `PAYMENT-SIGNATURE` 与 `X-PAYMENT-TX-HASH` 重放请求
- Demo Mode 仍然保留，继续用于无钱包 / 无 Base USDC 的演示与联调
- 首页过时文案已同步修正，不再继续显示“当前仍以 demo 为主”或“还不是真实链上扣款”

### 涉及文件

- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [src/styles.css](/Users/yangshangwei/Desktop/网页项目/api402/src/styles.css)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 27 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 给 Rabby 真实支付链路补更细的失败态展示，例如余额不足、未授权 Base、确认超时
2. 做 AI 成本 / 毛利可视化，直接看到收入与上游消耗差值
3. 扩充高价值 live API，优先评估 search / crawl / extract 与 OCR / PDF 结构化解析

## 2026-03-08

### 本轮目标

- 为已接入 OpenRouter 的 AI 接口补上成本与利润保护，避免 demo / 外部流量把上游余额打穿

### 已完成

- Worker 新增 AI 24h 滚动配额保护：
  - 预算上限：`AI_GLOBAL_DAILY_BUDGET_USD` / `AI_DEEPSEEK_DAILY_BUDGET_USD` / `AI_QWEN_DAILY_BUDGET_USD`
  - 请求上限：`AI_GLOBAL_DAILY_REQUEST_LIMIT` / `AI_DEEPSEEK_DAILY_REQUEST_LIMIT` / `AI_QWEN_DAILY_REQUEST_LIMIT`
- OpenRouter 成功响应的真实 `usage.cost` / token 使用量现在会持久化到 Metrics Durable Object
- AI 调用在超额时会提前返回 `429`，不会继续请求上游
- 新增机器可读错误码与响应头：
  - `AI_BUDGET_EXCEEDED`
  - `AI_REQUEST_LIMIT_EXCEEDED`
  - `X-Quota-Reason`
- catalog 已新增 `aiPolicy` 字段，暴露 AI 请求限制和 quota 错误码，方便后续 SDK / 前端使用
- 测试新增覆盖：
  - 预算超额阻断
  - 请求数超额阻断

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 27 个测试全部通过

### 下一步建议

1. 做 AI 成本 / 毛利可视化，直接看到收入与上游消耗差值
2. 将 Metrics DO 升级为分片聚合，降低高流量单实例压力
3. 继续扩充更高价值的 live API

## 2026-03-08

### 本轮目标

- 将 `/api/deepseek` 与 `/api/qwen` 从 demo/mock 升级为真实可付费 AI 上游，并接入用户提供的 OpenRouter key

### 已完成

- Worker 已接入 OpenRouter `chat/completions`
- `/api/deepseek` 默认模型切到 `deepseek/deepseek-v3.2`
- `/api/qwen` 默认模型切到更快且实测可用的 `qwen/qwen-plus-2025-07-28`
- AI 接口现在支持：
  - `GET` 预览模式（站内 demo / 轻量探活）
  - `POST application/json` 正式模式（`prompt` 或 `messages`）
- AI 请求在参数无效时先返回 `400 Invalid request`，避免开发者因请求体错误先进入 402 付费流程
- catalog 已把 AI 接口标记为 `status: live`、`method: POST`，并输出新的 OpenRouter 调用示例
- 前端接口详情 JS 示例已改成 AI 接口优先展示 `POST` 调用方式
- 已新增测试覆盖：
  - AI 无效 JSON 请求返回 `400`
  - `deepseek` 在配置 OpenRouter key 时可代理真实聊天响应
- 修复上游超时异常归类，避免 `AbortError.code=20` 被错误暴露为上游 reason code

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 下一步建议

1. 把 OpenRouter 成本统计和 quota 错误码补进 catalog / response metadata
2. 将 metrics Durable Object 升级为按 endpoint/source 分片，降低单实例压力
3. 继续替换剩余 demo API

## 2026-03-08

### 本轮目标

- 提供机器可读的长期漏斗导出接口（24h / 7d），提升外部 dashboard / SDK 的转化分析可用性（conversion + developer adoption）

### 已完成

- Worker 新增 `GET /api/v1/metrics/funnel`：
  - `window=24h`（默认）或 `window=7d`
  - 输出 endpoint 级漏斗：`challenged402` / `settled` / `replayed` / `challengeToReplayConversionRate`
- Metrics Durable Object 新增 `/funnel` 聚合读取路径
- endpoint metrics 在 Durable Object 中的保留窗口提升到 7 天（并增加上限裁剪），支持 24h/7d 查询
- catalog `payment` 新增可发现字段：
  - `requestFunnelEndpoint`
  - `requestFunnelSupportedWindows`
- 测试新增 `funnel metrics endpoint exposes 24h and 7d payment funnel summaries`
- ROADMAP 已同步“漏斗导出接口已完成”状态，并刷新 Immediate Next Tasks

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 22 个测试全部通过
- `npm run build:frontend` 通过
- `npm run deploy` 通过（Worker Version: `86167a12-adeb-469c-a9a4-2a71efae91fe`）

### 下一步建议

1. 继续把 AI 类接口从 demo 替换为真实上游（需凭据）
2. 将 metrics 持久层从单实例 DO 升级为按 endpoint/source 分片
3. 将漏斗导出升级为分片聚合或预计算索引，降低高流量读取压力


## 2026-03-08

### 本轮目标

- 在前端补 requestMetrics 趋势可视化（6 桶 sparkline + Top 错误码），提升转化波动排障效率（conversion + developer adoption）

### 已完成

- API 卡片新增趋势/错误诊断模块：
  - Request Trend（6 桶 sparkline）
  - Top Error Code（错误码 + 次数）
- 接口详情面板新增同一组诊断字段，便于单接口快速定位转化异常
- 前端 `requestTrend` 类型定义已与 worker 返回结构对齐（`requests` / `errors`）
- ROADMAP 已同步记录该能力完成，并刷新 Immediate Next Tasks

### 涉及文件

- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 21 个测试全部通过
- `npm run build:frontend` 通过
- `npm run deploy` 通过（Worker Version: `e9207e6b-a5b9-4130-993a-710554584b00`）

### 下一步建议

1. 继续把 AI 类接口从 demo 替换为真实上游（需凭据）
2. 将 metrics 持久层从单实例 DO 升级为按 endpoint/source 分片
3. 在 worker 增加 request funnel 聚合导出接口（24h / 7d）

## 2026-03-08

### 本轮目标

- 在前端 API 卡片与接口详情中直接展示 requestMetrics 核心指标（近 60 分钟请求量 / 402 比率 / replay 转化率），提升转化优化效率（conversion）

### 已完成

- 前端 `CatalogEndpoint` 类型补齐 `requestMetrics` 字段定义（含 payment funnel）
- API 卡片新增 3 个核心运营指标可视化：
  - Requests (60m)
  - 402 Rate
  - Replay Conversion
- 接口详情面板新增同一组指标字段，便于对单个 endpoint 做快速诊断
- 中英文文案已同步国际化词条（`requestMetrics.*`）
- ROADMAP 已同步“requestMetrics 前端可视化已完成”状态，并更新下一步任务

### 涉及文件

- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 21 个测试全部通过
- `npm run build:frontend` 通过
- `npm run deploy` 通过（Worker Version: `8d9cfe02-8356-44e4-8559-a1e0ae75b6dc`）

### 下一步建议

1. 继续把 AI 类接口从 demo 替换为真实上游（需凭据）
2. 将 metrics 持久层从单实例 DO 升级为按 endpoint/source 分片
3. 增加 24h / 7d requestId funnel 聚合导出接口

## 2026-03-08

### 本轮目标

- 将 catalog 的 upstream telemetry + endpoint requestMetrics 持久化到 Durable Objects，避免冷启动窗口丢失（payment reliability + conversion diagnostics）

### 已完成

- 新增 `MetricsStoreDurableObject`：
  - 记录 upstream telemetry 事件
  - 记录 endpoint requestMetrics 事件
  - 提供 snapshot 读取接口用于 catalog 聚合
  - 定时清理窗口外历史事件，控制存储增长
- catalog 构建流程改为优先读取持久化 snapshot（不可用时自动回退内存态）
- 请求路径埋点升级为“内存 + Durable Object”双写：
  - endpoint 402/429/200 指标
  - upstream success/failure/circuit-open 遥测
- `wrangler.toml` 新增 `METRICS_STORE` Durable Object binding 与 `v2` migration
- 测试环境新增 fake `METRICS_STORE` namespace，确保 catalog 指标测试继续覆盖持久化路径

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 21 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 在前端 API 卡片增加 `requestMetrics` 核心字段可视化（recent requests / 402 rate / replay conversion）
2. 提供 AI 上游凭据后推进 `/api/deepseek`、`/api/qwen` 真实上游替换
3. 评估将 metrics DO 从单实例升级为分片策略（按 endpoint/source hash）

## 2026-03-08

### 本轮目标

- 在前端直接展示 catalog 的 freshness 状态与更新时间，提升开发者接入判断效率（conversion + developer adoption）

### 已完成

- API 卡片新增 freshness 可视化：
  - 状态徽章（fresh / stale / unknown）
  - 相对更新时间（秒/分钟/小时）
- 接口详情面板新增字段：
  - `Freshness`
  - `Updated At`
- freshness 文案完成中英文国际化（状态、信号来源、相对时间）
- README / ROADMAP 已同步更新

### 涉及文件

- [src/main.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/main.ts)
- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 21 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 优先推进 AI 类接口真实上游替换（需要凭据）
2. 将 upstream telemetry / requestMetrics 持久化到 Durable Objects 或 KV，避免冷启动窗口丢失
3. 在前端补 requestMetrics 可视化（最近请求量、402 比率、replay 转化率）

## 2026-03-08

### 本轮目标

- 为 catalog endpoint 增加 `lastUpdatedAt` 与 `freshness`，提升开发者/SDK 对数据新鲜度的判断效率（conversion + developer adoption）

### 已完成

- `catalog.endpoints[]` 新增 `lastUpdatedAt`
- `catalog.endpoints[]` 新增 `freshness` 结构：
  - `status`: `fresh | stale | unknown`
  - `ageSeconds`: 最近更新距离当前秒数
  - `maxAgeSeconds`: 新鲜度阈值（当前 900 秒）
  - `signal`: `upstream_telemetry | request_metrics | none`
- 新鲜度优先基于上游 telemetry `updatedAt`，无上游信号时回退到 endpoint `requestMetrics.lastRequestAt`
- 前端类型 `src/types.ts` 已同步新字段定义
- 测试已扩展：
  - 空窗口时 freshness 为 `unknown`
  - 有请求流量后 freshness 为 `fresh`，并带 `request_metrics` 信号
- README / ROADMAP 已同步能力说明与后续任务

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过
- `npm run build:frontend` 通过

### 下一步建议

1. 将 requestMetrics / upstream telemetry / requestId funnel 持久化到 Durable Objects 或 KV，避免冷启动窗口丢失
2. 提供 AI 上游凭据后继续推进 `/api/deepseek`、`/api/qwen` 真实上游替换
3. 在前端 API 卡片直接展示 freshness 状态和更新时间

## 2026-03-08

### 本轮目标

- 为 402 / settlement / 成功响应补 `requestId` 追踪，并将 payment funnel 升级为 challenge→replay 精确归因，提升转化诊断可靠性

### 已完成

- 新增 `X-Request-Id` 协议支持：
  - 402 challenge 响应回传 `requestId`（header + body）
  - paid 成功响应 `_meta` 回传 `requestId`（并附带响应头）
  - settlement 查询响应回传 `requestId`（header + body）
- `catalog.payment.acceptedHeaders` 与 402 challenge `acceptedHeaders` 已包含 `X-Request-Id`
- `requestMetrics.paymentFunnel` 从“按成功请求粗略统计 replay”升级为“基于 requestId 关联 challenge→replay”的精确统计
- 测试已扩展：
  - 402 challenge 回传 requestId 断言
  - settlement pending 回传 requestId 断言
  - payment funnel 使用同 requestId 的 challenge→replay 序列断言

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 21 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 将 requestId 关联漏斗与 upstream telemetry 持久化到 Durable Objects / KV，避免冷启动窗口丢失
2. 在具备凭据后继续推进 `/api/deepseek`、`/api/qwen` 真实上游替换
3. 为 endpoint 增加 `lastUpdatedAt` 与 freshness 提示，优化开发者接入判断

## 2026-03-08

### 本轮目标

- 补齐 endpoint `requestMetrics` 的支付阶段漏斗统计（402 / settled / replayed），直接支撑转化率优化

### 已完成

- `catalog.endpoints[].requestMetrics` 新增 `paymentFunnel` 字段：
  - `challenged402`
  - `settled`
  - `replayed`
  - `challengeToReplayConversionRate`
- 漏斗统计与既有 60 分钟窗口保持一致，默认空窗口返回 0，避免 SDK 分支处理
- 测试已新增/扩展断言，覆盖空窗口与真实请求序列（2 次 402 + 1 次 replay）
- README / ROADMAP 已同步能力说明与下一步任务

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 21 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 将 upstream 遥测与 requestMetrics 持久化到 Durable Objects / KV，避免冷启动丢失
2. 在 settlement / 402 流中引入 requestId，做 challenge→replay 精确归因
3. 提供 AI 上游凭据后继续推进 `/api/deepseek`、`/api/qwen` 真实上游替换

## 2026-03-08

### 本轮目标

- 在不依赖新增外部凭据的前提下，补齐 endpoint 级请求量与错误趋势统计，提升 monetization/可靠性运营可观测性

### 已完成

- 新增 `catalog.endpoints[].requestMetrics` 字段，输出最近 60 分钟窗口统计：
  - `totalRequests` / `successRate`
  - `paymentRequiredRate` / `rateLimitedRate`
  - `upstreamFallbackRate`（仅 live upstream endpoint）
  - `errorsByCode`（Top 错误码分布）
  - `requestTrend`（最近 6 个 10 分钟分桶的请求量与错误量）
- 在 Worker 请求路径中新增实时埋点：
  - 429 限流
  - 402 支付挑战（按 payment reason 归因）
  - 200 成功响应（含 upstream fallback 原因）
- 新增测试 `catalog requestMetrics expose endpoint request volume and error trend`
- README / ROADMAP 已同步能力说明

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 21 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 优先继续推进 AI 类接口真实上游替换（需要凭据）
2. 将 upstream telemetry + requestMetrics 持久化到 Durable Objects/KV，避免冷启动丢失
3. 在 catalog 增加 endpoint `lastUpdatedAt` 与 freshness 提示

## 2026-03-08

### 本轮状态

- 阻塞（未实施代码变更）

### Blocker（API402 Autopilot）

- **阻塞项**: 按优先级当前最高任务仍是把 `/api/deepseek`、`/api/qwen` 从 demo 切到真实付费上游（live upstream integration）。
- **阻塞原因**: 真实上游接入需要生产可用凭据（DeepSeek / DashScope / OpenRouter / Cloudflare AI 之一）；当前仓库与环境未提供可用 key 或绑定，无法完成安全联调与可验证发布。
- **需要你提供的精确信息**:
  1. 目标上游（`deepseek` / `dashscope-qwen` / `openrouter` / `cloudflare-ai`）
  2. 对应生产凭据（如 `DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` / `OPENROUTER_API_KEY`，或 Cloudflare AI 绑定）
  3. 目标模型与成本上限（每请求 token 上限 / 预算阈值）

## 2026-03-08

### 本轮目标

- 为 remediation 能力增加稳定 changelog / deprecation 公告地址，提升 SDK 自动兼容升级能力与开发者接入确定性

### 已完成

- 新增公开公告资源：
  - `/.well-known/remediation-changelog.json`
  - `/.well-known/remediation-deprecations.json`
- catalog `payment` 新增 `remediationRefs`（`changelog` / `deprecations`）
- 402 challenge 响应新增 `remediationRefs`
- settlement 状态响应（含 mismatch 分支）新增 `remediationRefs`
- 测试新增断言，覆盖 catalog / 402 / settlement 的 `remediationRefs` 地址正确性
- README 与 ROADMAP 已同步更新

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [public/.well-known/remediation-changelog.json](/Users/yangshangwei/Desktop/网页项目/api402/public/.well-known/remediation-changelog.json)
- [public/.well-known/remediation-deprecations.json](/Users/yangshangwei/Desktop/网页项目/api402/public/.well-known/remediation-deprecations.json)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 20 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 在具备 AI 上游凭据后继续推进 `/api/deepseek`、`/api/qwen` 的真实上游替换
2. 将 upstream 遥测扩展为持久化时间序列
3. 增加 endpoint 请求量与错误趋势统计

## 2026-03-08

### 本轮目标

- 在 AI 上游凭据缺失导致 live integration 阻塞时，优先补齐生产部署清晰度（发布/回滚/排障 runbook）

### 已完成

- 新增 [doc/DEPLOYMENT.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/DEPLOYMENT.md)
  - 明确唯一正式部署目标：`api-market-x402`
  - 明确发布前检查、生产必备配置、发布步骤、发布后 smoke checks
  - 明确回滚路径与只读故障诊断顺序（health → catalog → 402/remediation → settlement → upstream meta）
- README 的 Deployment 章节改为引用 runbook，避免发布流程散落
- ROADMAP 同步“部署清晰度已完成”状态，并替换下一轮任务列表

### 涉及文件

- [doc/DEPLOYMENT.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/DEPLOYMENT.md)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过
- `npm run build:frontend` 通过
- `npm run deploy` 通过（Worker Version: `f5e9c0a6-0fba-4aa7-96e4-8e3731612265`）

### 下一步建议

1. 提供 AI 上游凭据后，优先把 `/api/deepseek`、`/api/qwen` 切到真实上游
2. 为 remediation 增加 changelog / deprecation 公告地址
3. 将 upstream 遥测扩展为持久化时间序列

## 2026-03-08

### 本轮状态

- 阻塞（未实施代码变更）

### Blocker

- **阻塞项**: 按当前优先级，下一项应为把 AI 类 demo 接口（`/api/deepseek`、`/api/qwen`）替换为真实上游；但仓库当前没有可用的 AI 上游凭据。
- **阻塞原因**: 主流可用上游（DeepSeek / DashScope(Qwen) / OpenRouter / Cloudflare AI）都需要 API Key 或绑定配置；在无凭据情况下无法安全完成“真实付费上游”接入与联调验证。
- **需要你提供的精确信息**:
  1. 选择一个目标上游（`deepseek` / `dashscope-qwen` / `openrouter` / `cloudflare-ai`）
  2. 提供对应生产可用凭据（例如 `DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` / `OPENROUTER_API_KEY`，或 Cloudflare AI 绑定信息）
  3. 指定期望模型与计费上限（例如 `deepseek-chat`、`qwen-max`，以及单请求 token/成本上限）

## 2026-03-08

### 本轮目标

- 在 catalog 暴露 endpoint 级 latency / availability 遥测字段，提升 SDK 选路与开发者接入可观测性

### 已完成

- 新增上游遥测窗口（15 分钟 + 最多 120 个样本）并对每次 live/fallback 结果记录 latency 与错误码
- `catalog.endpoints[].upstreamPolicy` 新增 `telemetry` 字段，输出：`windowMs`、`sampleSize`、`successRate`、`avgLatencyMs`、`p95LatencyMs`、`lastSuccessAt`、`lastFailureAt`、`lastErrorCode`、`updatedAt`
- 熔断打开时（`UPSTREAM_CIRCUIT_OPEN`）也会进入 telemetry 统计，便于观察降级占比
- 测试已补 catalog telemetry 字段断言，并重置测试态 telemetry store
- ROADMAP 已同步“已完成能力”与下一步建议

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 20 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 继续把 AI 类接口从 demo 替换为真实上游并评估成本控制
2. 为 remediation 字段补 changelog / deprecation 公告地址
3. 补 `doc/DEPLOYMENT.md`，明确生产发布、回滚和故障诊断路径

## 2026-03-08

### 本轮目标

- 为 live 上游代理补统一 machine-readable 错误码与熔断降级策略，提升支付后数据交付可靠性与 SDK 自动恢复能力

### 已完成

- 为 Binance / HyperLiquid 上游调用新增统一错误码：`UPSTREAM_TIMEOUT`、`UPSTREAM_HTTP_ERROR`、`UPSTREAM_INVALID_RESPONSE`、`UPSTREAM_FETCH_FAILED`、`UPSTREAM_CIRCUIT_OPEN`
- 新增上游熔断器：连续失败 3 次后打开 30 秒冷却窗口，冷却期内直接走 fallback，避免持续打爆上游
- paid API 响应 `_meta` 新增 `upstream` 机器可读状态（`source` / `status` / `reasonCode` / `retryable`）
- catalog endpoint 元数据新增 `upstreamPolicy`，暴露超时、失败阈值、冷却时间、fallback 策略与错误码清单，便于 SDK 静态建模
- 新增测试覆盖：
  - catalog `upstreamPolicy` 字段断言
  - live upstream 成功时 `_meta.upstream` 状态断言
  - 连续失败触发熔断并返回 `UPSTREAM_CIRCUIT_OPEN` 断言

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 20 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 在 catalog 增加 endpoint 级 latency / availability 指标字段（可先用窗口统计）
2. 推进 AI 类接口真实上游替换，继续降低 demo 占比
3. 补充 `doc/DEPLOYMENT.md`，明确监控、回滚与只读诊断路径

## 2026-03-08

### 本轮目标

- 为 remediation 字段引入稳定 schema 版本与兼容策略元信息，降低 SDK 自动补救解析漂移风险

### 已完成

- 新增 remediation 版本常量：`remediationSchemaVersion=1.0.0`
- 新增兼容策略标记：`remediationCompatibility=semver-minor-backward-compatible`
- `catalog.payment` 已输出 remediation 版本与兼容策略元信息
- 402 challenge 响应已输出 remediation 版本与兼容策略元信息
- `GET /api/v1/settlement/{txHash}` 响应已输出 remediation 版本与兼容策略元信息
- 测试新增断言，覆盖 catalog / 402 / settlement 三类响应中的 remediation 版本字段
- README 与 ROADMAP 已同步更新说明

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 19 个测试全部通过

### 下一步建议

1. 给关键上游代理补统一熔断 / fallback 策略与 machine-readable 错误码
2. 在 catalog 增加 latency / availability 指标字段
3. 为 remediation 增加 changelog / deprecation 公告地址字段

## 2026-03-08

### 本轮目标

- 为 settlement / 402 错误码补 machine-readable 补救动作映射，提升 SDK 自动恢复成功率

### 已完成

- 新增 `settlementStatusRemediation` 映射并在 catalog 对外暴露
- 新增 `paymentReasonRemediation` 映射并在 catalog 对外暴露
- `GET /api/v1/settlement/{txHash}` 响应新增 `remediation` 字段（含 `retryable` 与建议 `retryAfterSeconds`）
- 402 challenge 响应新增 `remediation` 字段，`PAYMENT_TX_NOT_CONFIRMED` 会携带动态重试秒数
- 测试新增断言，覆盖 catalog remediation 字段与 settlement pending 场景 remediation 输出
- README 与 ROADMAP 已同步 remediation 能力说明

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 19 个测试全部通过

### 下一步建议

1. 在 catalog 增加 latency / availability 指标字段
2. 给关键上游代理补统一熔断 / fallback 策略与 machine-readable 错误码
3. 推进 AI 类接口真实上游替换，继续降低 demo 占比

## 2026-03-08

### 本轮目标

- 为 settlement 状态查询补齐 `payTo` / `minAmount` 过滤，提升多商户归因与支付核验可靠性

### 已完成

- `GET /api/v1/settlement/{txHash}` 新增 `payTo` / `minAmount` 过滤参数，支持不带签名证明时的回执日志过滤校验
- settlement proof 校验从固定网关收款地址改为“请求中的目标收款地址（payTo filter）”绑定校验，兼容多商户归因
- catalog 的 `settlementStatusFilters` 已扩展为 `payer` / `resource` / `payTo` / `minAmount`
- 新增测试覆盖：
  - 无签名证明时 `payTo` + `minAmount` 过滤成功
  - `minAmount` 不满足时返回 `SETTLEMENT_PROOF_MISMATCH`
- README 与 ROADMAP 已同步新的 settlement 过滤能力说明

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过
- `npm run build:frontend` 通过

### 下一步建议

1. 给关键上游接口补统一熔断 / fallback 策略与 machine-readable 错误码
2. 在 catalog 增加 latency / availability 指标字段
3. 推进 AI 类接口真实上游替换，继续降低 demo 占比

## 2026-03-08

### 本轮目标

- 为 settlement 查询补可选签名证明校验（payer/resource 维度），降低第三方归因误判

### 已完成

- `GET /api/v1/settlement/{txHash}` 新增可选 `PAYMENT-SIGNATURE` 证明校验
- 支持在 settlement 查询中使用 `payer` / `resource` 过滤参数绑定支付归因
- settlement proof 校验会验证签名、收款地址一致性与链上 USDC `Transfer` 金额匹配
- catalog 新增 `settlementStatusProofHeaders` 与 `settlementStatusFilters`，便于 SDK 自动发现能力
- 新增测试覆盖 settlement proof 成功校验与 resource 过滤不匹配拒绝
- README 与 ROADMAP 已同步更新 settlement proof 查询能力

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 17 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 在 catalog 中增加 latency / availability 指标字段
2. 为关键上游接口补统一熔断 / 降级策略与 machine-readable 错误码
3. 推进 AI 类接口真实上游替换，继续降低 demo 占比

## 2026-03-08

### 本轮目标

- 增加支付后结算状态查询端点，提升 SDK 自动重试与交易追踪能力

### 已完成

- 新增 `GET /api/v1/settlement/{txHash}`，返回 machine-readable 结算状态：`SETTLEMENT_READY` / `SETTLEMENT_PENDING` / `SETTLEMENT_TOO_OLD` / `SETTLEMENT_NOT_FOUND` / `SETTLEMENT_RPC_FAILED`
- 结算查询响应新增 `X-Settlement-Status`，并在 pending 场景输出 `Retry-After`
- catalog 新增 `payment.settlementStatusEndpointTemplate`，便于 SDK 自动拼接查询 URL
- 新增测试覆盖 settlement endpoint 的 pending / ready 两条关键路径
- README 与 ROADMAP 已同步 settlement 查询能力说明

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过
- `npm run build:frontend` 通过

### 下一步建议

1. 在 catalog 增加 latency / availability 指标字段
2. 给关键上游代理补统一熔断 / fallback 策略与 machine-readable 错误码
3. 推进 AI 类接口真实上游替换，继续降低 demo 占比

## 2026-03-08

### 本轮目标

- 扩展 settlement policy 机器可读字段，提升支付失败后的自动重试可靠性

### 已完成

- 新增结构化 `settlementPolicy`，包含确认门槛、平均区块时间、最大可接受结算区块年龄和建议重试间隔
- `catalog.payment` 现输出 `settlementPolicy`，便于 SDK 静态建模自动重试参数
- 402 challenge 现输出动态 `settlementPolicy`，会根据当前确认进度给出 `recommendedRetryAfterSeconds`
- 当返回 `PAYMENT_TX_NOT_CONFIRMED` 时，HTTP 头新增 `Retry-After`（秒），便于客户端无状态退避重试
- 前端类型已补齐 `settlementPolicy` 字段
- 测试新增对 `settlementPolicy` 与 `Retry-After` 的断言

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [src/types.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/types.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 13 个测试全部通过
- `npm run build:frontend` 通过
- `npx wrangler deploy` 通过（Worker Version: `e9fd78b5-075d-4358-bd8b-247cc2d2b2a4`）

### 下一步建议

1. 给关键上游接口补统一熔断 / fallback 策略与 machine-readable 错误码
2. 在 catalog 增加 latency / availability 指标字段
3. 推进 AI 类接口真实上游替换，继续降低 demo 占比

## 2026-03-08

### 本轮目标

- 继续提升真实支付验证稳健性，阻断“历史旧交易”被拿来延迟重放的风险

### 已完成

- Base USDC 结算校验新增交易证明区块年龄限制（默认 `7200` blocks）
- 当交易过旧时返回机器可读错误码 `PAYMENT_TX_TOO_OLD`
- catalog 与 402 challenge 新增 `maxSettlementAgeBlocks` 字段，便于 SDK 静态建模
- `wrangler.toml` 新增 `PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS` 默认配置
- 测试新增“过旧交易证明被拒绝”场景，覆盖 402 reason 与 settlement 上下文

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 13 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 给关键上游代理补统一熔断 / fallback 策略与 machine-readable 错误码
2. 在 catalog 增加 latency / availability 指标字段
3. 继续推进 AI 类接口真实上游替换，进一步降低 demo 占比

## 2026-03-08

### 本轮目标

- 继续提升真实支付验证稳健性，收紧签名 payload 时间窗，降低延迟重放和时钟漂移导致的误验风险

### 已完成

- 支付验证新增 `issuedAt` 时间窗校验：默认只接受 15 分钟内创建的签名
- 新增未来时钟偏差限制：默认最多允许 `issuedAt` 超前当前时间 120 秒
- 新增机器可读错误码：`PAYMENT_STALE`、`PAYMENT_ISSUED_AT_IN_FUTURE`、`PAYMENT_DEADLINE_TOO_FAR`
- catalog 与 402 challenge 现对外暴露 `maxPaymentAgeSeconds`、`maxFutureSkewSeconds`
- `wrangler.toml` 新增 `PAYMENT_MAX_AGE_SECONDS`、`PAYMENT_MAX_FUTURE_SKEW_SECONDS` 默认配置
- 测试新增陈旧签名拒绝场景，并扩展 catalog 字段断言

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 下一步建议

1. 给关键上游代理补统一熔断 / fallback 策略与 machine-readable 错误码
2. 在 catalog 增加 latency / availability 指标字段
3. 继续推进 AI 类接口真实上游替换，进一步降低 demo 占比

## 2026-03-08

### 本轮目标

- 提升真实支付结算的可用性，避免单一 Base RPC 波动导致支付验证误判失败

### 已完成

- 新增 `BASE_RPC_URLS`（逗号分隔）配置，支持主备 Base RPC 顺序回退
- Base RPC 调用新增超时控制，避免单节点长时间挂起拖慢结算验证
- 支付验证中的 `eth_getTransactionReceipt` / `eth_blockNumber` 现统一走多节点回退逻辑
- 增加测试：主 RPC 故障时自动切换备用 RPC 仍可完成支付验证
- 更新 README 与 ROADMAP，补充多 RPC 部署建议与当前能力说明

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [wrangler.toml](/Users/yangshangwei/Desktop/网页项目/api402/wrangler.toml)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 下一步建议

1. 为上游代理接口补统一熔断 / 降级策略与 machine-readable 错误码
2. 在 catalog 里补充 endpoint latency / availability 指标字段
3. 继续推进 AI 类接口从 demo 到 live upstream 的替换

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

## 2026-03-08

### 本轮目标

- 按 ROADMAP 优先级完成 live upstream integration 的最高缺口：`/api/whale-positions`
- 将该接口从 demo 数据升级为可验证的实时上游聚合

### 已完成

- `whale-positions` 已接入 HyperLiquid `recentTrades` 实时上游（BTC/ETH）
- 新增地址聚合逻辑：按地址统计交易次数、名义成交额、主导方向和最近活跃时间
- catalog 中 `whale-positions` 元数据已更新为 `status: live`、`upstream: hyperliquid`
- 上游请求统一改为带超时控制的 JSON 拉取工具（避免慢请求拖垮接口）
- 新增测试覆盖：验证 `whale-positions` 在上游可用时返回 `proxied` 实时数据
- 已完成部署到 Cloudflare Worker：`api-market-x402`（Version `feed74a5-914e-47d5-96e2-4f528c96e5b9`）

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 10 个测试全部通过
- `npm run build:frontend` 通过
- `npx wrangler deploy` 通过

### 遗留问题

- `whale-positions` 当前基于“最近成交”聚合，反映的是活跃巨鲸行为而非严格意义的持仓快照
- 还缺少上游熔断与降级分层错误码，极端网络抖动下仍依赖样例回退

### 下一步建议

1. 给上游代理补统一熔断 / fallback 策略与 machine-readable 错误码
2. 在 catalog 增加 latency / availability 指标字段
3. 推进 AI 类接口的真实上游替换，减少 demo 占比

## 2026-03-08

### 本轮目标

- 继续提升真实支付结算稳健性与可观测性
- 让调用方在成功/失败两侧都能拿到统一的链上确认上下文，便于自动重试

### 已完成

- 扩展支付验证结果结构，新增 `settlement` 上下文对象
- Base USDC 结算校验现在会产出 `txHash`、`receiptBlock`、`latestBlock`、`confirmations`、`requiredConfirmations`
- 402 challenge 在 `PAYMENT_TX_NOT_CONFIRMED` 等结算失败场景下会返回可机器解析的 `settlement`
- 支付成功响应 `_meta` 现在也包含 `settlement`，便于 SDK 记录结算证据
- 测试新增断言：验证成功请求和确认块不足请求都返回预期 settlement 字段
- README 与 ROADMAP 已同步记录结算可观测字段能力

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 10 个测试全部通过
- `npm run build:frontend` 通过

### 下一步建议

1. 将 settlement 可观测字段同步补入 catalog schema，方便 SDK 静态建模
2. 给关键上游代理补统一熔断 / 降级策略并提供 machine-readable 错误码
3. 继续推进 AI 类接口的真实上游替换，减少 demo 占比

## 2026-03-08

### 本轮目标

- 开始专注开发更有流量吸引力的 `Polymarket` 预测市场接口
- 调整首页 API 目录顺序，把最新模型和预测市场能力提前，弱化 BTC/ETH 单点价格接口的首页曝光

### 已完成

- 新增 `GET /api/polymarket/trending`，返回 Polymarket 当前热门活跃市场列表
- 新增 `GET /api/polymarket/search?q=...`，返回 Polymarket 关键词搜索结果
- 新增 `GET /api/polymarket/event?slug=...`，返回单个 Polymarket 事件详情和其下属市场
- 三个接口都接到了 Polymarket Gamma 公共上游，不是 mock 数据
- 为 `polymarket/search` 和 `polymarket/event` 增加了付费前参数校验，避免参数错误先进入 402
- 重排 `API_ENDPOINTS` 顺序：`GPT-5.4 Pro`、`Claude 4.6`、`GPT-5.4`、`DeepSeek`、`Qwen`、`Polymarket`、链上情报、最后才是 BTC/ETH 价格
- 新增测试覆盖：目录排序、Polymarket 缺参校验、trending live 返回、event live 返回
- 已同步更新 `README.md`、`ROADMAP.md`、`API_EXPANSION.md`

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [worker/upstreams.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/upstreams.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)
- [doc/API_EXPANSION.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/API_EXPANSION.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 `37/37`
- `npm run build:frontend` 通过
- `npx wrangler deploy --dry-run` 通过
- `npm run deploy` 通过，Cloudflare 当前版本 `8fffaca0-95d8-4127-ab89-96a4be1a29c8`

### 下一步建议

1. 继续做 `Polymarket related / topic / mispricing` 这类更容易形成分享和复购的预测市场接口
2. 将 `approval-audit` 和 `tx-simulate-explain` 继续作为高客单价 Web3 + AI 风控主线推进
3. 如果首页目录继续扩展，下一步考虑增加“热门接口”分组，而不是只依赖单一排序

## 2026-03-08

### 本轮目标

- 研究 `Polymarket` 自动交易相关接口应该先做哪一层
- 在不引入用户私钥和下单签名的前提下，优先落地公开可卖的交易前数据接口

### 已完成

- 确认 `Gamma API` 和 `CLOB API` 足以支撑公开交易前接口
- 新增 `GET /api/polymarket/orderbook?slug=...&outcome=...`
- 新增 `GET /api/polymarket/quote?slug=...&outcome=...&side=buy|sell&size=...`
- 新增 `GET /api/polymarket/price-history?slug=...&outcome=...&interval=...&fidelity=...`
- `quote` 会基于实时订单簿估算成交均价、剩余未成交量、滑点和是否有足够流动性
- 为新的交易接口增加了 402 前参数校验，避免缺参数先进入付费流程
- 新增研究文档 [doc/POLYMARKET_TRADING.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/POLYMARKET_TRADING.md)，明确当前先做公开交易数据、暂不开放真实下单

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [worker/upstreams.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/upstreams.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/API_EXPANSION.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/API_EXPANSION.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)
- [doc/POLYMARKET_TRADING.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/POLYMARKET_TRADING.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 `42/42`
- `npm run build:frontend` 通过
- `npx wrangler deploy --dry-run` 通过
- `npm run deploy` 通过，Cloudflare 当前版本 `342789e3-76a8-48ed-9eda-71c9a95b40f4`

### 下一步建议

1. 继续做 `Polymarket topic / related / mispricing`
2. 如果你要进入真实自动下单，再单独接签名下单链路和风险限制
3. 继续把 BTC 类热门市场作为 `Polymarket` 交易入口的默认展示样例

## 2026-03-08

### 本轮目标

- 继续沿 `Polymarket` 高价值路线扩展 `topic`、`related`、`mispricing`
- 让网站不只是能查单个市场，而是能围绕 BTC 等热门主题做发现、关联和机会扫描

### 已完成

- 新增 `GET /api/polymarket/topic?tag=crypto|election|macro|ai`
- 新增 `GET /api/polymarket/related?slug=...`
- 新增 `GET /api/polymarket/mispricing?limit=...`
- `topic` 会按主题关键词聚合活跃市场，并按 attention score 排序
- `related` 会基于 anchor 市场的问题、slug 和事件上下文召回相似市场
- `mispricing` 会基于 best bid / best ask / midpoint / last trade / volume24hr 产出启发式候选，不宣称确定套利
- 为 `topic` 和 `related` 增加了 402 前参数校验
- 同步更新了 `README.md`、`API_EXPANSION.md`、`ROADMAP.md`、`POLYMARKET_TRADING.md`

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [worker/upstreams.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/upstreams.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)
- [README.md](/Users/yangshangwei/Desktop/网页项目/api402/README.md)
- [doc/API_EXPANSION.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/API_EXPANSION.md)
- [doc/ROADMAP.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/ROADMAP.md)
- [doc/POLYMARKET_TRADING.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/POLYMARKET_TRADING.md)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 `47/47`
- `npm run build:frontend` 通过
- `npx wrangler deploy --dry-run` 通过
- `npm run deploy` 通过，Cloudflare 当前版本 `df7413ed-68cc-49dc-9855-f2b836221fcc`

### 下一步建议

1. 做 `GET /api/polymarket/entry-signal?slug=...&outcome=...`
2. 做 `GET /api/polymarket/rotation?topic=crypto`
3. 如果你要真正自动下单，再单独接签名、下单、撤单和风控

## 2026-03-08

### 本轮目标

- 解决目录卡片过长、快速目录不够简洁、顶部导航不好看、开发者工作流区域不专业的问题

### 已完成

- 安装了 `pbakaus/impeccable` 技能集合
  - 命令：`npx skills add pbakaus/impeccable --yes --global`
  - 结果：已安装到本机 skills 目录
  - 注意：需要重启 Codex 才能在后续会话里真正启用这些新 skill
- 重做顶部导航
  - 原来的普通文字导航改成胶囊式导航
  - 新增顶部 `OpenClaw` 快捷入口
  - 移动端导航也同步增加更醒目的 `OpenClaw` 快捷项
- 简化 API 快速目录
  - 去掉目录项里过多的 path / tags / provider 堆叠
  - 改成更接近“清单导航”的极简结构：名称 + provider/method + 价格
  - 分类标题也做了压缩
- 压缩 catalog 卡片信息密度
  - 去掉卡片里第二层趋势/错误信息堆叠
  - 说明文字改成 3 行截断
  - 指标压缩成 3 个小统计块：请求 / 402 / 转化
  - 底部只保留 access 和 trend sparkline
- 重做 `开发者工作流` 区块
  - 从普通三列卡片改成“左侧总览 + 右侧时间线步骤”
  - 视觉层级更清楚，也更接近产品说明页而不是模板区块

### 涉及文件

- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [src/app/catalog.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/catalog.ts)
- [src/app/i18n.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/i18n.ts)
- [src/styles.css](/Users/yangshangwei/Desktop/网页项目/api402/src/styles.css)

### 下一步建议

1. 重启 Codex，下一轮可以正式用新安装的 `impeccable` 技能再做一轮视觉 polish
2. 如果继续优化 catalog，下一步把右侧卡片做成更强的“列表 + 详情”双栏，而不是纯卡片墙
3. 如果继续优化转化，下一步把 `OpenClaw` 区块做成更像产品 landing 的专用入口

## 2026-03-08

### 本轮目标

- 提升首页转化表达，并补 OpenClaw / SDK 接入入口，让用户一眼知道网站用途且能快速集成

### 已完成

- 重写 Hero 区文案，不再强调“技术实现感”，而是直接说明“用 USDC 按次购买 API 和 AI 模型”
- Hero 徽章改成更接近用户价值的表达：
  - `先调后付`
  - `支持 OpenClaw`
  - `Base USDC 结算`
- 顶部导航新增 `接入 / Integrations`
- 新增页面区块 `#integrations`
  - OpenClaw 快速接入说明
  - 轻量 JS SDK 说明
  - 可直接复制的接入代码块
- 新增轻量 ESM SDK 静态文件 [public/sdk/api402-client.mjs](/Users/yangshangwei/Desktop/网页项目/api402/public/sdk/api402-client.mjs)
  - 支持 `catalog`
  - 支持 `health`
  - 支持普通 request
  - 支持遇到 `402` 后通过 `paymentHandler` 注入 `PAYMENT-SIGNATURE`
- 新增接入文档 [doc/OPENCLAW_GUIDE.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/OPENCLAW_GUIDE.md)

### 涉及文件

- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [src/app/i18n.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/i18n.ts)
- [public/sdk/api402-client.mjs](/Users/yangshangwei/Desktop/网页项目/api402/public/sdk/api402-client.mjs)
- [doc/OPENCLAW_GUIDE.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/OPENCLAW_GUIDE.md)

### 下一步建议

1. 如果继续做转化，下一步补一个真正的 `SDK / Docs` 顶层页，而不是只放首页区块
2. 给 SDK 再补一个 Node CLI 例子，方便直接在服务器和 agent runner 里调用
3. 后面如果要公开推广，可以把 OpenClaw guide 单独做成 blog / docs 页面

## 2026-03-08

### 本轮目标

- 修复“Payment was authorized but rejected by server”，让官方 x402 v2 客户端不再被 Worker 的自定义支付协议拒绝

### 已完成

- 确认当前根因不是 challenge 金额格式，而是服务端只识别自定义 `PAYMENT-SIGNATURE + X-PAYMENT-TX-HASH`，不识别官方 x402 v2 `PAYMENT-SIGNATURE`
- 对照官方 x402 TypeScript 实现核对了 v2 协议结构：
  - `PAYMENT-REQUIRED` 应为 `x402Version: 2`
  - 顶层应带 `resource`
  - `accepts[]` 应仅保留标准 requirement 字段
  - 客户端重放时发送的是 `accepted + payload`
- 新增 Worker 里的官方 x402 v2 兼容路径：
  - 识别标准 `PAYMENT-SIGNATURE`
  - 校验 `accepted` 是否匹配当前 endpoint / amount / asset / payTo
  - 调用 facilitator 做 `verify -> settle`
  - 成功后返回标准 `PAYMENT-RESPONSE`
- 默认 facilitator 改为支持 Base mainnet 的公开服务 `https://facilitator.xpay.sh`
- 保留了原有“链上转账 + tx hash 回放”的自定义支付路径，前端和现有手工联调不受影响
- 把 `PAYMENT-REQUIRED` challenge 进一步对齐到官方 v2：
  - `x402Version: 2`
  - 顶层 `resource.url / description / mimeType`
  - `accepts[].extra.name = USD Coin`
  - `accepts[].extra.resourceUrl = ...`
- 新增测试覆盖“官方 x402 v2 payment payload 通过 facilitator verify / settle”

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [worker/payment.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/payment.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 `48/48`
- 新测试 `official x402 v2 payment payload is verified and settled through facilitator` 通过

### 风险和判断

- 当前默认依赖公开 facilitator `facilitator.xpay.sh`
- 这能让官方 x402 v2 客户端在 Base mainnet 上真正进入 verify / settle，而不是被本地自定义协议直接拒绝
- 但生产环境要真正成功，还依赖该 facilitator 在线、可用、且接受当前主网 USDC 结算

### 下一步建议

1. 立即重新用同一个真实付费客户端复测 `/api/polymarket/trending`
2. 如果仍失败，下一步抓服务端收到的 `PAYMENT-SIGNATURE` 和 facilitator 返回的 `invalidReason/errorReason`
3. 后续可以把 `FACILITATOR_URL` 暴露到部署配置，支持你切换为自建 facilitator

## 2026-03-08

### 本轮目标

- 修复 `awal x402 pay` 在读取 challenge 时因金额格式报 `Cannot convert 0.003 to a BigInt` 的兼容问题

### 已完成

- 对照官方 x402 exact EVM 规范确认 `accepts[].amount` 应使用资产最小单位整数，而不是 `0.003` 这种小数字符串
- 将 `PAYMENT-REQUIRED` 头和响应体里的 `accepts` 金额从十进制 USDC 改为 6 位精度原子单位
  - `0.003 USDC -> 3000`
  - `0.00001 USDC -> 10`
- 为 challenge 增加 `maxTimeoutSeconds` 以及 `extra.assetTransferMethod = eip3009`、`name = USDC`、`version = 2`
- 同步把 `PAYMENT-RESPONSE` 头里的 `amount` 改成原子单位，保持 transport 层一致
- 补测试锁定 `PAYMENT-REQUIRED` / `PAYMENT-RESPONSE` 的原子单位金额格式

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 `47/47`

### 风险和判断

- 这次修复针对的是 challenge transport 的金额格式 bug，能够解决客户端在发现支付要求时就因 `BigInt` 解析失败的问题
- 但当前网关仍然主要基于“链上转账 + tx hash 回放”模型
- 官方 x402 exact EVM 规范的主路径是 `PAYMENT-SIGNATURE + EIP-3009/Permit2 + facilitator settlement`
- 所以即便 `BigInt` 报错消失，官方客户端后续仍有可能在真正提交支付 payload 时遇到协议不兼容

### 下一步建议

1. 重新用 `awal x402 pay` 测一次，看是否已经越过 `Cannot convert ... to a BigInt`
2. 如果还有后续错误，下一步不是再猜 challenge，而是要针对官方 `PAYMENT-SIGNATURE` payload 做兼容适配
3. 如果目标是全面兼容官方 x402 客户端，后面要决定是否引入真正的 facilitator / EIP-3009 结算路径

## 2026-03-08

### 本轮目标

- 修复真实 x402 自动支付客户端在 challenge 发现阶段报 `Invalid request` 的兼容性问题

### 已完成

- 复现并确认当前生产环境对 `/api/btc-price` 和 `/api/deepseek` 都会返回 `402`，排除了“服务端免费放行”的误判
- 对照 x402 v2 transport 约定补齐 `PAYMENT-REQUIRED` 响应头，challenge 现在会返回 Base64 编码的标准 `accepts` 结构
- 在 402 JSON body 中同步增加 `x402Version` 和 `accepts`，避免客户端只认标准字段时丢失支付要求
- 成功支付后的 `200` 响应新增 `PAYMENT-RESPONSE` 头，方便自动支付客户端做 replay 后确认
- 补充测试锁定 challenge/success transport 兼容层，避免后续再回归成“只有自定义 body、没有标准 header”

### 涉及文件

- [worker/index.ts](/Users/yangshangwei/Desktop/网页项目/api402/worker/index.ts)
- [test/worker.test.ts](/Users/yangshangwei/Desktop/网页项目/api402/test/worker.test.ts)

### 验证结果

- `curl -i https://api-402.com/api/btc-price` 确认生产环境当前返回 `402`
- `curl -i -X POST https://api-402.com/api/deepseek -H 'Content-Type: application/json' -d '{"prompt":"hi"}'` 确认生产环境当前返回 `402`
- `npm run typecheck` 通过
- `npm test` 通过，当前 `47/47`

### 下一步建议

1. 重新用 `awal x402 pay` 做一次真实支付测试，验证客户端是否已能正确发现 challenge
2. 如果客户端仍失败，下一步抓它实际解析的 header/body 预期，继续做更细的 x402 v2 兼容
3. 一旦首次真实结算跑通，就把这套支付验证步骤沉淀成一份最短操作文档

## 2026-03-08

### 本轮目标

- 优化首页的移动端体验，重点处理导航、统计卡片、目录侧栏和示例区在手机上的拥挤问题

### 已完成

- 为移动端新增顶部快捷锚点导航，避免小屏只有按钮没有页面入口
- 调整 Hero 顶部留白与主标题字号，避免固定导航和标题在手机上互相挤压
- 重排统计卡片响应式布局：超窄屏单列，中等小屏双列，宽卡片不再压缩内容
- 为目录侧栏增加移动端最大高度和滚动区域，避免目录过长时占满整屏
- 优化动态生成的 API 卡片内部网格，在手机上改为单列后再向上扩展
- 调整 Selected Endpoint 区块、FAQ 标题和钱包弹窗的移动端排版与可滚动性
- 为主要交互按钮和导航项补齐更稳定的触控尺寸

### 涉及文件

- [index.html](/Users/yangshangwei/Desktop/网页项目/api402/index.html)
- [src/styles.css](/Users/yangshangwei/Desktop/网页项目/api402/src/styles.css)
- [src/app/catalog.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/catalog.ts)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 `47/47`
- `npm run build:frontend` 通过
- `npx wrangler deploy --dry-run` 通过
- `npm run deploy` 通过，Cloudflare 当前版本 `617e6dcf-f15f-41b9-bdae-0559032c5364`

### 下一步建议

1. 如果继续优化移动端，下一步应给目录增加折叠/展开和当前分类吸顶
2. 接着继续推进 `Polymarket entry-signal / rotation`
3. 后面如果增加更多卡片密集内容，需要优先以手机端栅格为基准设计

## 2026-03-08

### 本轮目标

- 把 `claw402.ai` 的竞品研究固化到仓库里
- 顺手把前端目录从“技术分类视角”提升到“产品目录视角”

### 已完成

- 新增竞品研究文档 [doc/COMPETITOR_CLAW402.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/COMPETITOR_CLAW402.md)
- 记录了 `claw402` 的公开 catalog 结构、provider 分布、category 分布，以及值得学和不该学的地方
- 前端目录和卡片增加了 `provider + 用途标签` 显示，不再只有路径、价格和分类
- 新增目录/卡片用途标签规则:
  - `旗舰流量 / Frontier`
  - `流量入口 / Traffic`
  - `交易准备 / Execution Prep`
  - `信号扫描 / Signals`
  - `风控情报 / Risk`
  - `模型调用 / Model Access`
- 目录表达更接近产品销售页，而不是纯技术接口列表

### 涉及文件

- [doc/COMPETITOR_CLAW402.md](/Users/yangshangwei/Desktop/网页项目/api402/doc/COMPETITOR_CLAW402.md)
- [src/app/format.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/format.ts)
- [src/app/catalog.ts](/Users/yangshangwei/Desktop/网页项目/api402/src/app/catalog.ts)
- [src/styles.css](/Users/yangshangwei/Desktop/网页项目/api402/src/styles.css)

### 验证结果

- `npm run typecheck` 通过
- `npm test` 通过，当前 `47/47`
- `npm run build:frontend` 通过
- `npx wrangler deploy --dry-run` 通过
- `npm run deploy` 通过，Cloudflare 当前版本 `25b0fb64-fac9-4493-a5a2-29b424610ff3`

### 下一步建议

1. 继续推进 `Polymarket entry-signal / rotation / range-breakout`
2. 进一步把目录筛选升级成按 `Use Case` 过滤
3. 如果后面再研究竞品，优先只研究“目录结构、转化表达、毛利模型”，不追着抄接口数量
