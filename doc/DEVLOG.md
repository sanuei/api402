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
