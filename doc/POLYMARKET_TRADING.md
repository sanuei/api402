# Polymarket Trading Research

更新日期: 2026-03-08

## 结论

当前最适合先做的是 `Polymarket` 的公开交易数据接口，而不是直接开放“代下单”接口。

原因:

- 公开交易数据接口不需要用户私钥和交易签名
- 可以直接服务 BTC 等热门预测市场的策略、监控和自动化 agent
- 能先跑通流量和付费，再决定是否继续做真正的交易执行

## 已确认的公开上游

- `Gamma API`
  - 市场搜索
  - 市场详情 / 事件详情
  - `market slug -> outcome -> clob token id` 映射
- `CLOB API`
  - order book
  - prices history

## 已上线的交易相关接口

- `GET /api/polymarket/orderbook?slug=...&outcome=Yes|No`
- `GET /api/polymarket/quote?slug=...&outcome=Yes|No&side=buy|sell&size=...`
- `GET /api/polymarket/price-history?slug=...&outcome=Yes|No&interval=1d&fidelity=60`

这三类接口已经足够支撑:

- 自动交易前的盘口检查
- 滑点估算
- 趋势信号生成
- 简单回测输入
- BTC 等热门市场的策略监控

## 为什么现在不直接开放下单接口

真正的下单/撤单至少还需要:

- Polymarket 交易签名方案
- 用户自己的钱包或 API credential
- 风险限制
- 地理/合规边界确认
- 订单失败与部分成交处理

如果现在直接做成公开写接口，风险太高，也不适合先对外卖。

## 推荐的下一阶段

1. 继续补交易前接口
2. 优先做 BTC / 宏观 / election 主题的 `topic` 与 `mispricing`
3. 等你确认要做真实执行，再单独接签名下单链路

## 下一批建议接口

- `GET /api/polymarket/topic?tag=crypto`
- `GET /api/polymarket/related?slug=...`
- `GET /api/polymarket/mispricing`
- `GET /api/polymarket/entry-signal?slug=...&outcome=...`
