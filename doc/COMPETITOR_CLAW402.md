# Competitor Review: claw402.ai

更新日期: 2026-03-08

## 研究目标

分析 `claw402.ai` 公开可见的产品结构、接口类型和可借鉴点，明确哪些地方值得学习，哪些地方不应该直接照搬。

## 公开可确认的信息

公开来源:

- `https://claw402.ai/`
- `https://claw402.ai/api/v1/catalog`

从首页和免费 catalog 可确认:

- 它主打的是 `x402 API Payment Gateway`
- 支付资产是 `USDC`
- 支付网络是 `Base`
- 产品表达核心是:
  - No API keys
  - No registration
  - Wallet-based payment
  - Free machine-readable catalog

## catalog 结构

`claw402` 的公开 catalog 不是 `endpoints[]`，而是更偏 marketplace 的 `routes[]` 结构。

字段特征包括:

- `provider`
- `category`
- `path`
- `method`
- `price_usdc`
- `min_price_usdc`
- `pricing_mode`
- `description`
- `description_en`

这说明它的核心产品心智更像:

- 多 provider 聚合市场
- 统一支付层
- 统一目录层

而不是一个围绕某个垂直场景深挖的产品。

## 当前公开规模

本次抓取时，免费 catalog 中约有 `213` 条 `routes`。

按 provider 粗看:

- `coinank`: 78
- `polygon`: 25
- `alphavantage`: 19
- `nofxos`: 18
- `twelvedata`: 18
- `tushare`: 16
- `alpaca`: 15
- `openai`: 8
- `qwen`: 6
- `coinmarketcap`: 5
- `deepseek`: 4
- `anthropic`: 1

按 category 粗看，前几类是:

- `Indicators`
- `Chat`
- `Open Interest`
- `Funding Rate`
- `Market Orders`
- `Rankings`
- `Liquidation`
- `Reference`
- `Long/Short`
- `Time Series`

## 它在卖什么

从公开内容判断，`claw402` 当前卖的是:

1. 多 provider 聚合
2. 标准化目录
3. 标准化钱包支付
4. 高频金融/加密数据
5. 一部分最新模型入口

它更像“付费 API 市场”，不是“强垂直、高毛利工具链”。

## 值得学习的地方

### 1. 免费 catalog 做得对

先让开发者免费看到完整能力，再决定是否付费调用，这是正确方向。

### 2. provider + category 结构清楚

它把“谁提供”和“属于哪类”分开了，目录扩展时不容易乱。

### 3. 首页卖点很直接

它没有讲太多实现细节，而是直接讲:

- 不注册
- 不发 key
- 钱包付款

这个转化路径清晰。

### 4. 优先摆高感知价值接口

最新模型、liquidation、funding、ranking、gainers/losers 这类接口，天然比普通价格接口更容易被点击。

## 不值得照搬的地方

### 1. 过度 marketplace 化

接口太宽，容易变成“谁都能替代”的数据超市。

### 2. commodity 数据过多

很多路线是普通行情、普通指标、普通财经数据，这类接口竞争非常激烈。

### 3. 差异化偏弱

如果核心只是“统一支付 + 聚合”，长期很难有真正护城河。

### 4. 很多接口更适合引流，不适合做利润核心

特别是普通聊天、普通价格、普通指标，转化和利润未必好。

## 对 API Market 的启发

你现在最该学的不是“做 200 个接口”，而是这 4 点:

1. 目录表达方式
2. provider / category 分层
3. 首页优先展示高感知价值接口
4. 免费 catalog + 钱包支付心智

## 对你项目的实际动作

这次已经落到项目里的动作:

1. 保持高感知价值接口前排
2. 继续围绕 `Polymarket`、`Web3 risk`、`trading prep` 深挖
3. 前端目录开始补“provider + 用途标签”表达，而不只是技术分类

## 不建议直接模仿的方向

- 不建议直接抄它的大而全金融数据超市
- 不建议优先补大量 commodity stock / indicator API
- 不建议把统一支付层误当成核心产品壁垒

## 建议继续坚持的主线

对你来说更合理的路线是:

1. 用最新模型做流量入口
2. 用 `Polymarket` 做高感知价值交易与发现接口
3. 用 `wallet-risk` / 后续风控能力做更高毛利方向
4. 后面再决定是否进入真实交易执行

## 下一步建议

1. 继续做 `Polymarket entry-signal`
2. 继续做 `Polymarket rotation`
3. 后续考虑把目录从“技术分类”进一步升级成“Use Case + Provider + Category”
