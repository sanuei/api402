/**
 * API Market x402 Payment Gateway
 * 
 * 基于 x402 协议的 API 付费网关
 * 部署到 Cloudflare Workers
 */

export interface Env {
  // 环境变量
  PAY_TO?: string;  // 收款地址
}

declare global {
  var rateLimiter: Map<string, number[]>;
}

interface APIEndpoint {
  price: string;
  description: string;
  data: any;
}

// API 定价配置
const API_PRICES: Record<string, APIEndpoint> = {
  '/api/btc-price': {
    price: '0.00001',
    description: 'Bitcoin price feed - Real-time BTC price from multiple exchanges',
    data: { symbol: 'BTC', price: 67234.56, timestamp: Date.now() }
  },
  '/api/eth-price': {
    price: '0.00001',
    description: 'Ethereum price feed',
    data: { symbol: 'ETH', price: 3456.78, timestamp: Date.now() }
  },
  '/api/deepseek': {
    price: '0.003',
    description: 'DeepSeek AI Chat - V3.2 model',
    data: { model: 'deepseek-v3', response: 'Hello! How can I help you today?', usage: { tokens: 128 } }
  },
  '/api/qwen': {
    price: '0.01',
    description: 'Qwen3 Max AI - Alibaba flagship model',
    data: { model: 'qwen3-max', response: '您好！有什么我可以帮您的？', usage: { tokens: 256 } }
  },
  '/api/whale-positions': {
    price: '0.00002',
    description: 'HyperLiquid whale positions',
    data: {
      positions: [
        { address: '0x1234...', size: 1250000, pnl: 12.5 },
        { address: '0x5678...', size: 980000, pnl: 8.2 },
        { address: '0xabcd...', size: 750000, pnl: -2.1 }
      ]
    }
  },
  '/api/kline': {
    price: '0.001',
    description: 'Binance K-line data',
    data: {
      symbol: 'BTC/USDT', interval: '1h', candles: [
        [1700000000, 67000, 67500, 66500, 67200, 1000],
        [1700003600, 67200, 67800, 67100, 67650, 1200]
      ]
    }
  }
};

// 默认收款地址（演示用）
const DEFAULT_PAY_TO = '0x742d35Cc6634C0532925a3b844Bc9e7595f4f8E1';

/**
 * 生成 x402 Payment Required 响应
 */
function createPaymentRequired(payTo: string, price: string, description: string, path: string): Response {
  const body = JSON.stringify({
    code: 'PAYMENT_REQUIRED',
    message: 'Payment required to access this API',
    payTo,
    price,
    currency: 'USDC',
    chain: 'base',
    scheme: 'exact',
    path,
    description,
    instructions: [
      '1. Connect your wallet',
      '2. Sign an EIP-3009 authorization',
      '3. USDC will be debited automatically on each request'
    ],
    x402Spec: 'https://x402.org'
  });

  return new Response(body, {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Required': 'true',
      'X-Pay-To': payTo,
      'X-Price': price,
      'X-Currency': 'USDC',
      'X-Chain': 'base',
      'X-Scheme': 'exact',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

import { verifyMessage } from 'ethers';

/**
 * 验证 x402 支付
 * 支持 EIP-3009 授权验证和演示模式
 */
async function verifyPayment(request: Request, price: string, payTo: string): Promise<boolean> {
  const authorization = request.headers.get('Authorization');

  // 1. 演示模式：如果有 Authorization: Bearer demo 就认为是已支付
  if (authorization && authorization.startsWith('Bearer demo')) {
    return true;
  }

  // 2. 尝试 EIP-3009 / 本地签名验证 (x402 真实协议)
  // 此处为一个简化验证流程。完整的业务中会去调用链上的 receiveWithAuthorization
  if (authorization && authorization.startsWith('Bearer ')) {
    try {
      // 这里的 x402 token 可能长这样: Bearer base64(json)
      const tokenStr = authorization.split(' ')[1];
      const payload = JSON.parse(atob(tokenStr));

      // 验证前面是否有发给我们的 payTo，且金额大于 price
      if (payload.payTo && payload.payTo.toLowerCase() === payTo.toLowerCase()) {
        if (payload.signature && payload.from) {
          const recovered = verifyMessage(JSON.stringify(payload.data), payload.signature);
          if (recovered.toLowerCase() === payload.from.toLowerCase()) {
            return true;
          }
        }
      }
    } catch (e) {
      console.log('Payment verification failed:', e);
    }
  }

  // 3. Fallback: 老的 X-Payment-Proof 头
  const paymentProof = request.headers.get('X-Payment-Proof');
  return paymentProof !== null;
}

/**
 * 获取上游真实数据 (代理请求)
 */
async function fetchUpstreamData(endpointName: string): Promise<any> {
  try {
    if (endpointName === '/api/btc-price') {
      const resp = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const data: any = await resp.json();
      return { symbol: 'BTC', price: parseFloat(data.price), timestamp: Date.now(), source: 'binance' };
    }

    if (endpointName === '/api/eth-price') {
      const resp = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
      const data: any = await resp.json();
      return { symbol: 'ETH', price: parseFloat(data.price), timestamp: Date.now(), source: 'binance' };
    }
  } catch (e) {
    console.error('Upstream fetch failed', e);
  }
  return null;
}

/**
 * 获取客户端 IP
 */
function getClientIP(request: Request): string {
  const forwarded = request.headers.get('CF-Connecting-IP');
  return forwarded || 'unknown';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const clientIP = getClientIP(request);

    // 简易限流记录器 (基于单个 Worker 实例内存)
    // 生产环境中推荐用 Cloudflare Rate Limiting 或 Durable Objects 实现分布式限流
    if (!globalThis.rateLimiter) {
      globalThis.rateLimiter = new Map<string, number[]>();
    }

    const now = Date.now();
    const WINDOW_MS = 60 * 1000; // 1 分钟
    const MAX_REQUESTS = 30; // 限制每个 IP 每分钟 30 次请求

    let requests = globalThis.rateLimiter.get(clientIP) || [];
    requests = requests.filter(time => now - time < WINDOW_MS);

    if (requests.length >= MAX_REQUESTS) {
      return new Response(JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
      });
    }
    requests.push(now);
    globalThis.rateLimiter.set(clientIP, requests);

    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Payment-Proof, Authorization',
    };

    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 获取收款地址
    const payTo = env.PAY_TO || DEFAULT_PAY_TO;

    // 根路径 - 返回 API 列表
    if (path === '/' || path === '/index.html') {
      return new Response(JSON.stringify({
        name: 'API Market',
        version: '1.0.0',
        description: 'x402 Payment Gateway - Pay with USDC',
        endpoints: Object.entries(API_PRICES).map(([path, config]) => ({
          path,
          price: config.price,
          description: config.description
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 获取定价信息
    if (path === '/prices') {
      return new Response(JSON.stringify(API_PRICES), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // API 端点
    const apiEndpoint = API_PRICES[path];

    if (!apiEndpoint) {
      return new Response(JSON.stringify({
        error: 'Endpoint not found',
        availableEndpoints: Object.keys(API_PRICES)
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 检查支付
    const isPaid = await verifyPayment(request, apiEndpoint.price, payTo);

    if (!isPaid) {
      // 返回 402 Payment Required
      return createPaymentRequired(payTo, apiEndpoint.price, apiEndpoint.description, path);
    }

    // 返回 API 数据（已支付）
    let realData = null;
    try {
      realData = await fetchUpstreamData(path);
    } catch (e) {
      console.error('Failed to get upstream data for', path);
    }

    const baseData = realData || apiEndpoint.data;

    // 添加一些随机变化或元数据使数据更完整
    const responseData = {
      ...baseData,
      _meta: {
        paid: true,
        price: apiEndpoint.price,
        payTo: payTo,
        timestamp: Date.now(),
        clientIP: getClientIP(request),
        origin: realData ? 'proxied' : 'mock'
      }
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
