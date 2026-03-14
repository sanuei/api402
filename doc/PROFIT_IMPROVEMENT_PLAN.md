# Profit Improvement Plan

更新日期: 2026-03-14

## 当前事实

根据线上指标：

- 累计 API 调用：`84`
- 累计已结算：`0.004 USDC`
- 最近 24 小时调用：`0`
- 近 7 天 challenge 很多，但 settled 很少

这说明现在的核心问题不是“完全没人点”，而是：

- 有人愿意试
- 但大多数人在看到付款或需要钱包操作时放弃了
- 当前主收费接口还不够值钱，或者太容易被公开数据替代

## 为什么 challenge 高、转化低

1. 一部分接口本质上是公开原始数据
   - 例如价格、K 线、Polymarket 热门列表
   - 用户很容易觉得“我可以直接去上游拿”

2. 第一次付款摩擦仍然偏高
   - 钱包
   - Base USDC
   - gas
   - 402 challenge 理解成本

3. 首页虽然已经比早期好很多，但仍然没有把“先付第一单应该买什么”收得足够窄

4. 当前卖得更多是“接口访问权”，不是“高价值结果”

## 立即执行的改进清单

1. 把低护城河接口从主卖点降级
   - `/api/btc-price`
   - `/api/eth-price`
   - `/api/kline`
   - `/api/polymarket/trending`

2. 首页只主推两条商业主线
   - 最新模型按次体验
   - Web3 / Polymarket 风控与信号

3. 做更值钱的结果型接口
   - `approval-audit`
   - `tx-simulate-explain`
   - `polymarket/entry-signal`
   - `polymarket/rotation`

4. 继续补漏斗埋点
   - challenge issued
   - wallet opened
   - payment authorized
   - payment settled
   - replay succeeded
   - final response returned

5. 做“首单付费入口”
   - 用一个最容易理解的高价值接口承接第一次付款
   - 不让用户自己在很多接口里挑

## 盈利优先级

### P0: 直接更容易收费

- `GET /api/approval-audit?address=0x...`
- `POST /api/tx-simulate-explain`
- `GET /api/polymarket/entry-signal?slug=...&outcome=...`

### P1: 提升复购和 agent 使用频率

- `GET /api/polymarket/rotation?topic=crypto`
- `GET /api/polymarket/range-breakout?slug=...`
- `GET /api/monitor/protocol-change-feed`

### P2: 获客但不是利润中心

- GPT / Claude / DeepSeek / Qwen 最新模型入口
- 公开趋势和 discovery 接口

## 当前执行状态

- `approval-audit`：已立项，当前轮开始实现
- `tx-simulate-explain`：下一优先级
- `polymarket/entry-signal`：下一优先级

## 产品原则

- 不继续把公开原始数据接口当核心付费产品
- 优先卖“节省时间、降低风险、能直接行动”的结果
- 模型入口继续保留，但定位为获客，不当成主要利润来源
