# API Market 产品重构方案

更新日期: 2026-03-08

## 1. 目标重写

这个产品的目标不应该是“做一个好看的 x402 演示站”，而应该是：

- 先用最新旗舰模型的按次调用拿到第一批真实付费用户
- 再把利润中心转到 Web3 + AI 的高价值情报、风控、执行辅助接口
- 用 `Base + USDC + x402` 作为统一支付和 agent 接入层，而不是把支付本身当卖点

## 2. 当前问题

当前站点已经有真实支付、Rabby 闭环和多语言页面，但核心商业问题还没有完全解决：

- `btc-price`、`eth-price`、`kline` 这类接口缺少收费护城河
- 通用聊天模型接口有需求，但竞争激烈，单独拿出来利润薄
- 首页叙事仍偏“网关能力展示”，而不是“我为什么现在要付费调用这里的 API”
- API 目录不够强，用户难以快速看出哪些接口是试用型、哪些是高价值型

## 3. 赚钱优先级

### 第一层: 获客型接口

这类接口的作用是让用户第一次愿意付钱。

- `GPT-5.4`
- `GPT-5.4 Pro`
- `Claude 4.6`
- `DeepSeek`
- `Qwen`

定位:

- 不想订阅多个模型套餐的用户
- 只想临时体验最新模型的用户
- 想让 agent 按任务切模型的用户
- 无法方便接触海外模型的部分用户

策略:

- 定价允许 convenience premium，但不能离谱
- 强调“按次体验最新模型，不订阅也能用”
- 首页和目录里把这些接口归为 `Frontier Models`

### 第二层: 利润型接口

这类接口才是后面更可能长期赚钱的部分。

- `wallet-risk`
- `approval-audit`
- `tx-simulate-explain`
- `protocol-change-feed`
- `pricing-diff`
- `docs-change-impact`

定位:

- 做 agent / bot / wallet / security 的开发者
- 小团队创业者
- Web3 项目运营和研究用户

策略:

- 卖结构化结果，不卖原始数据
- 卖“节省时间、降低风险、可直接执行”的结果
- 价格可以明显高于简单聊天和价格接口

## 4. 接口层级调整

### 保留但降级主推

- `/api/btc-price`
- `/api/eth-price`
- `/api/kline`

这些接口可以保留做：

- catalog 充实度
- demo / SDK 示例
- 支付联调

但不应该继续作为主卖点。

### 继续主推

- `/api/gpt-5.4`
- `/api/gpt-5.4-pro`
- `/api/claude-4.6`
- `/api/deepseek`
- `/api/qwen`
- `/api/whale-positions`

### 下一批应该做

1. `GET /api/wallet-risk?address=...`
2. `GET /api/approval-audit?address=0x...`
3. `POST /api/tx-simulate-explain`
4. `GET /api/monitor/protocol-change-feed`
5. `GET /api/monitor/pricing-diff`

## 5. 首页重写方向

首页应该从“支付网关介绍页”改成“按次调用最新模型和高价值 agent API 的产品页”。

需要强化的文案：

- 不订阅，也能按次体验最新模型
- 一个钱包，统一调用 GPT / Claude / DeepSeek / Qwen
- 为 agent 和自动化工作流设计的可支付 API
- 接下来会提供 Web3 风控和执行辅助接口

需要弱化的文案：

- 过多强调 Worker / 架构实现
- 过多强调 demo token
- 把低价值价格接口放在英雄位

## 6. 定价策略

### 最新模型

- 允许比上游高一些，但要让“按次体验”仍然成立
- `GPT-5.4 Pro` 价格可以明显更高，直接把它定义为高价值调用

### 垂直情报接口

- 不按 token 定价
- 按“每次结果价值”定价
- 可以做高于普通 chat 接口数倍的单次价格

## 7. 未来 30 天

1. 完成最新模型目录和产品展示
2. 增加 `wallet-risk`
3. 增加 `approval-audit`
4. 把首页主叙事改成“最新模型 + Web3 AI 工具”
5. 为高价值接口补 quickstart 和真实调用示例

## 8. 关键判断

- 如果只卖“统一模型入口”，可以赚到一点钱，但很难形成壁垒
- 如果把“统一模型入口”做成获客入口，再接上 Web3 + AI 的高价值接口，赚钱概率明显更高
- 后续开发应优先围绕“真实付费需求”和“高价值结果”来做，不再把低价值免费数据接口当核心产品
