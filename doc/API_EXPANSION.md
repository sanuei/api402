# API Expansion Backlog

更新日期: 2026-03-08

## 目标

把后续值得扩展的 API 能力集中记录下来，避免只在对话里讨论，方便按优先级推进、评估成本和判断变现潜力。

## 优先级说明

- `P0`：最值得尽快上线，兼顾开发成本、调用频率和赚钱概率
- `P1`：高价值能力，适合在 P0 后继续扩展
- `P2`：有价值，但和当前网站定位或变现速度的贴合度略低

## 推荐扩展列表

| Priority | API Group | Why It Matters | Monetization Potential | Candidate Upstreams | Notes |
| --- | --- | --- | --- | --- | --- |
| P0 | Web Search | AI agent 和自动化工作流高频调用，接入门槛低，价值直观 | 高 | Tavily, SerpAPI, Brave Search | 适合先做基础搜索结果 JSON |
| P0 | Crawl / Extract | 搜索之后通常紧跟网页抓取和正文抽取，容易形成组合调用 | 高 | Firecrawl, Jina Reader, Browserbase | 可以拆成 crawl、extract、screenshot 三类 |
| P0 | PDF / OCR -> JSON | 企业场景愿意付费，单次调用价值高 | 高 | Mistral OCR, Unstructured, MinerU | 建议优先做 PDF 文本抽取 + 表格结构化 |
| P1 | Onchain Wallet Intelligence | 和当前 Base / USDC / crypto 定位强相关，客单价高 | 高 | Chainbase, Dune API, Zerion, Covalent | 可做 wallet summary、portfolio、risk flags |
| P1 | Token / Contract Security | 适合服务链上 agent、交易机器人和风控流程 | 中高 | GoPlus, Rugcheck, Chainalysis API | 能提升金融类调用价值 |
| P1 | News / Market Intelligence | 高频但竞争大，适合做聚合与结构化摘要 | 中高 | CryptoPanic, NewsAPI, GDELT | 更适合做“结构化情报”而不是纯资讯搬运 |
| P1 | Repo / Code Intelligence | 面向开发者，和站点用户画像匹配 | 中高 | GitHub API, OpenRouter, Mistral Codestral | 可做 repo summary、patch plan、issue digestion |
| P2 | Speech To Text | 需求真实，但和当前站点主定位没有前几项贴合 | 中 | Deepgram, AssemblyAI, Whisper providers | 适合后续补全多模态能力 |
| P2 | Image Understanding | 对 agent 有帮助，但变现优先级低于 search / OCR | 中 | Gemini, OpenAI vision, Cloudflare AI | 可和 OCR 合并设计 |
| P2 | Generic Chat Tools | 通用聊天竞争最强，不适合作为主卖点 | 中低 | OpenRouter, Workers AI | 只适合作为基础能力，不适合做核心差异化 |

## 建议的扩展顺序

1. `Web Search`
2. `Crawl / Extract`
3. `PDF / OCR -> JSON`
4. `Onchain Wallet Intelligence`
5. `Token / Contract Security`

## 当前最值得先做的三组

当前进度更新:

- `Onchain Wallet Intelligence` 已开始落地，首个接口为 `GET /api/wallet-risk?address=0x...`
- `Prediction Markets` 已开始落地，已新增 `GET /api/polymarket/trending`、`GET /api/polymarket/search?q=...`、`GET /api/polymarket/event?slug=...`
- `Prediction Market Trading` 已开始落地，已新增 `GET /api/polymarket/orderbook`、`GET /api/polymarket/quote`、`GET /api/polymarket/price-history`
- 下一步建议继续扩 `approval-audit` 与 `tx-simulate-explain`

### 补充方向: Prediction Markets / Attention APIs

- 价值：
  - 更适合放在首页前排，天然更有点击欲望和分享属性
  - 对 AI agent 来说不仅是流量入口，也能作为“市场共识信号”
  - 和加密货币 / 交易 / 事件判断主题天然贴近
- 已上线接口：
  - `GET /api/polymarket/trending`
  - `GET /api/polymarket/search?q=...`
  - `GET /api/polymarket/event?slug=...`
  - `GET /api/polymarket/orderbook?slug=...&outcome=...`
  - `GET /api/polymarket/quote?slug=...&outcome=...&side=buy|sell&size=...`
  - `GET /api/polymarket/price-history?slug=...&outcome=...`
- 下一步可继续扩：
  - `GET /api/polymarket/related?slug=...`
  - `GET /api/polymarket/topic?tag=election|crypto|macro`
  - `GET /api/polymarket/mispricing`

### 1. Web Search

- 价值：
  - AI agent 和自动化流程天然高频
  - 调用路径简单，用户容易理解
  - 容易和后续 crawl / extract 形成组合付费
- 推荐接口：
  - `GET /api/search/web`
  - `GET /api/search/news`
  - `GET /api/search/answer`
- 推荐返回：
  - `query`
  - `results[]`
  - `citations[]`
  - `freshness`
  - `_meta.upstream`

### 2. Crawl / Extract

- 价值：
  - 和 search 组合后，形成 agent 真正常用链路
  - 比单纯搜索更容易收费，因为是“执行型工具”
- 推荐接口：
  - `POST /api/crawl/page`
  - `POST /api/extract/article`
  - `POST /api/extract/markdown`
- 推荐返回：
  - `title`
  - `content`
  - `markdown`
  - `links[]`
  - `statusCode`
  - `_meta.upstream`

### 3. PDF / OCR -> JSON

- 价值：
  - 企业用户更愿意付费
  - 单次调用价值高
  - 非常适合做按次付费
- 推荐接口：
  - `POST /api/ocr/document`
  - `POST /api/ocr/invoice`
  - `POST /api/ocr/table`
- 推荐返回：
  - `text`
  - `pages[]`
  - `tables[]`
  - `entities`
  - `_meta.upstream`

## 当前不建议优先做的方向

- 通用聊天接口继续扩太多
  - 原因：竞争太强，差异化弱
- 纯价格查询类 API 大量扩展
  - 原因：容易沦为低价值数据搬运
- 过早做太多链支持
  - 原因：支付复杂度、验证复杂度和运维成本会明显上升

## 决策原则

- 优先做“工具型 API”，不是“泛能力展示”
- 优先做会被 agent 多步反复调用的接口
- 优先做单次调用价值高、调用结果清晰可验证的接口
- 优先选择一个真实上游先跑通，再决定是否做多供应商 fallback

## 下一步建议

1. 先立项 `Web Search`
2. 接着做 `Crawl / Extract`
3. 再做 `PDF / OCR -> JSON`
4. 每做完一组，再回头评估真实调用频率、上游成本和 replay 转化率
