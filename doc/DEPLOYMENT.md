# Deployment Runbook (`api-market-x402`)

更新日期: 2026-03-08

## 1) Scope

本仓库唯一正式部署目标：**Cloudflare Worker `api-market-x402`**。

- 不再使用历史资源：`api-market`（Pages）、`api-market-x402-production`（旧 Worker）
- 正式域名由当前 Worker 路由承载（`api-402.com`）

## 2) Prerequisites

在执行发布前，确认：

1. 已登录 Cloudflare：`npx wrangler whoami`
2. 本地分支干净：`git status --short --branch`
3. 已完成基础验证：
   - `npm run typecheck`
   - `npm test`
   - `npm run build:frontend`

## 3) Required Production Config

最小建议环境变量（`wrangler.toml` / Cloudflare Dashboard）：

- `PAY_TO`：收款地址（Base）
- `BASE_RPC_URLS`：主备 RPC 列表（逗号分隔）
- `PAYMENT_MIN_CONFIRMATIONS`：最小确认块数（建议 `2` 起）
- `PAYMENT_MAX_AGE_SECONDS`：支付签名最大年龄（默认 `900`）
- `PAYMENT_MAX_FUTURE_SKEW_SECONDS`：未来时钟偏差容忍（默认 `120`）
- `PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS`：结算证明最大区块年龄（默认 `7200`）
- Durable Object 绑定：`REPLAY_GUARD`

## 4) Release Procedure

### 4.1 Normal Release

```bash
npm run typecheck
npm test
npm run build:frontend
npm run deploy
```

说明：

- `npm run deploy` = `npm run build:static && wrangler deploy`
- `wrangler.toml` 已配置 `[build] command = "npm run build:static"`，即使直接 `npx wrangler deploy` 也会先构建静态资源

### 4.2 Post-Deploy Smoke Checks

```bash
curl -sS https://api-402.com/api/v1/health
curl -sS https://api-402.com/api/v1/catalog
curl -i -sS https://api-402.com/api/prices?symbol=BTCUSDT
```

期望：

- `health` 返回 `ok: true`
- `catalog` 返回 payment、endpoints、upstreamPolicy 等字段
- 付费 API 未带支付头时返回 402 且包含 machine-readable reason/remediation

## 5) Rollback

优先使用 Cloudflare 控制台将 Worker 回滚到上一个稳定版本；并在仓库中创建修复提交。

回滚后执行同样 smoke checks：

1. `/api/v1/health`
2. `/api/v1/catalog`
3. 任一付费 API 的 402 challenge 行为

## 6) Incident Triage (Read-Only)

故障排查建议顺序：

1. **健康检查**：`/api/v1/health`
2. **目录能力**：`/api/v1/catalog`（看 payment/upstreamPolicy/telemetry）
3. **支付失败语义**：确认 402 响应 `reason`、`remediation`、`settlement`
4. **结算回查**：`GET /api/v1/settlement/{txHash}` + `Retry-After`
5. **上游健康**：查看 paid API 响应 `_meta.upstream`（`status` / `reasonCode` / `retryable`）

## 7) Change Control

每次发布后在 `doc/DEVLOG.md` 记录：

- 目标与变更范围
- 验证命令与结果
- 是否已部署（含 Worker Version）
- 未完成项 / blocker / 下一步建议
