# 🦞 API Market - x402 支付网关演示

基于 x402 协议的 API 付费网关演示项目。

## 📁 项目结构

```
网页项目/
├── index.html          # 演示网站前端
├── src/
│   └── index.ts        # Cloudflare Workers 后端
├── package.json        # Node.js 依赖
├── wrangler.toml       # Cloudflare 配置
├── tsconfig.json       # TypeScript 配置
└── README.md           # 本文件
```

## 🚀 快速部署

### 前端（静态网站）

**方式 1: Cloudflare Pages**
```bash
# 推送到 GitHub，在 Cloudflare Dashboard 创建 Pages 项目
```

**方式 2: Vercel**
```bash
npm i -g vercel
vercel --prod
```

**方式 3: 本地运行**
```bash
# 简单 HTTP 服务器
python3 -m http.server 8000
# 访问 http://localhost:8000
```

### 后端（Cloudflare Workers）

```bash
# 1. 安装依赖
npm install

# 2. 登录 Cloudflare
npx wrangler login

# 3. 部署
npm run deploy
```

## 🔧 配置

### 修改 API 定价

编辑 `src/index.ts` 中的 `API_PRICES` 对象：

```typescript
const API_PRICES: Record<string, { price: string; description: string; data: any }> = {
  '/api/your-endpoint': {
    price: '0.001',  // USDC 数量
    description: 'API 描述',
    data: { /* 返回数据 */ }
  }
};
```

### 配置收款地址

在生产环境中，需要：
1. 在 Coinbase Developer Platform 注册
2. 获取你的收款钱包地址
3. 更新代码中的 `payTo` 地址

## 💰 价格（演示）

| API | 价格 |
|-----|------|
| BTC 价格 | $0.00001 |
| ETH 价格 | $0.00001 |
| DeepSeek AI | $0.003 |
| Qwen3 Max | $0.01 |
| 大户仓位 | $0.00002 |
| K线数据 | $0.001 |

## 🔗 线上演示

- **前端**: https://638e11e1.api-market.pages.dev/
- **后端 API**: https://api-market-x402.sonic980828.workers.dev

## 🔗 相关链接

- [x402 官方文档](https://x402.org)
- [Coinbase CDP](https://docs.cdp.coinbase.com/x402)
- [awesome-x402 资源列表](https://github.com/xpaysh/awesome-x402)
- [Cloudflare Workers](https://workers.cloudflare.com)

## 📝 License

MIT
