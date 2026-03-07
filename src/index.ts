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
    data: { positions: [
      { address: '0x1234...', size: 1250000, pnl: 12.5 },
      { address: '0x5678...', size: 980000, pnl: 8.2 },
      { address: '0xabcd...', size: 750000, pnl: -2.1 }
    ]}
  },
  '/api/kline': {
    price: '0.001',
    description: 'Binance K-line data',
    data: { symbol: 'BTC/USDT', interval: '1h', candles: [
      [1700000000, 67000, 67500, 66500, 67200, 1000],
      [1700003600, 67200, 67800, 67100, 67650, 1200]
    ]}
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

/**
 * 验证 x402 支付
 * 注意：生产环境需要验证区块链交易
 * 这里简化处理 - 检查是否有支付证明 header
 */
async function verifyPayment(request: Request, price: string, payTo: string): Promise<boolean> {
  // 检查是否有支付证明
  const paymentProof = request.headers.get('X-Payment-Proof');
  const authorization = request.headers.get('Authorization');
  
  // 在演示模式下，如果有 authorization header 就认为是已支付
  // 生产环境需要验证 EIP-3009 授权
  if (authorization && authorization.startsWith('Bearer ')) {
    return true;
  }
  
  return paymentProof !== null;
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
    // 添加一些随机变化使数据更真实
    const responseData = {
      ...apiEndpoint.data,
      _meta: {
        paid: true,
        price: apiEndpoint.price,
        payTo: payTo,
        timestamp: Date.now(),
        clientIP: getClientIP(request)
      }
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
