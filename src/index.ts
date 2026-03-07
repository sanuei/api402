/**
 * API Market x402 Payment Gateway
 *
 * A Cloudflare Worker that serves both:
 * 1. static assets for the landing page
 * 2. paid API routes protected by an x402-style payment challenge
 */

export interface Env {
  PAY_TO?: string;
  APP_NAME?: string;
  ASSETS?: Fetcher;
}

declare global {
  var rateLimiter: Map<string, number[]>;
}

interface APIEndpoint {
  path: string;
  price: string;
  description: string;
  category: string;
  upstream?: string;
  sample: () => unknown;
}

interface PaymentPayload {
  payTo?: string;
  from?: string;
  amount?: string | number;
  signature?: string;
  data?: unknown;
}

import { verifyMessage } from 'ethers';

const DEFAULT_PAY_TO = '0x742d35Cc6634C0532925a3b844Bc9e7595f4f8E1';
const DEMO_PAYMENT_TOKEN = 'demo';
const LEGACY_PRICE_PATH = '/prices';
const CATALOG_PATH = '/api/v1/catalog';
const HEALTH_PATH = '/api/v1/health';

const API_ENDPOINTS: APIEndpoint[] = [
  {
    path: '/api/btc-price',
    price: '0.00001',
    description: 'Real-time BTC price feed aggregated from Binance.',
    category: 'Market Data',
    upstream: 'binance',
    sample: () => ({ symbol: 'BTC', price: 67234.56, timestamp: Date.now() }),
  },
  {
    path: '/api/eth-price',
    price: '0.00001',
    description: 'Real-time ETH price feed aggregated from Binance.',
    category: 'Market Data',
    upstream: 'binance',
    sample: () => ({ symbol: 'ETH', price: 3456.78, timestamp: Date.now() }),
  },
  {
    path: '/api/deepseek',
    price: '0.003',
    description: 'Demo DeepSeek chat completion response.',
    category: 'AI',
    sample: () => ({
      model: 'deepseek-v3',
      response: 'Hello! How can I help you today?',
      usage: { tokens: 128 },
    }),
  },
  {
    path: '/api/qwen',
    price: '0.01',
    description: 'Demo Qwen3 Max chat completion response.',
    category: 'AI',
    sample: () => ({
      model: 'qwen3-max',
      response: '您好！有什么我可以帮您的？',
      usage: { tokens: 256 },
    }),
  },
  {
    path: '/api/whale-positions',
    price: '0.00002',
    description: 'Demo HyperLiquid whale position snapshots.',
    category: 'Onchain Intelligence',
    sample: () => ({
      positions: [
        { address: '0x1234...', size: 1250000, pnl: 12.5 },
        { address: '0x5678...', size: 980000, pnl: 8.2 },
        { address: '0xabcd...', size: 750000, pnl: -2.1 },
      ],
    }),
  },
  {
    path: '/api/kline',
    price: '0.001',
    description: 'Demo BTC/USDT candlestick snapshots.',
    category: 'Trading',
    sample: () => ({
      symbol: 'BTC/USDT',
      interval: '1h',
      candles: [
        [1700000000, 67000, 67500, 66500, 67200, 1000],
        [1700003600, 67200, 67800, 67100, 67650, 1200],
      ],
    }),
  },
];

const API_INDEX: Record<string, APIEndpoint> = Object.fromEntries(
  API_ENDPOINTS.map((endpoint) => [endpoint.path, endpoint]),
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, PAYMENT-SIGNATURE, X-Payment-Proof',
  'Access-Control-Expose-Headers': 'X-Payment-Required, X-Pay-To, X-Price, X-Currency, X-Chain, X-Scheme',
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers,
  });
}

function apiResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return jsonResponse(body, { ...init, headers });
}

function parseAmount(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function createCatalog(baseUrl: string, payTo: string) {
  return {
    name: 'API Market',
    appName: 'API Market',
    version: '1.1.0',
    payment: {
      payTo,
      currency: 'USDC',
      chain: 'base',
      scheme: 'exact',
      demoToken: DEMO_PAYMENT_TOKEN,
      acceptedHeaders: ['Authorization', 'PAYMENT-SIGNATURE', 'X-Payment-Proof'],
    },
    docs: {
      quickstart: `${baseUrl}/#examples`,
      health: `${baseUrl}${HEALTH_PATH}`,
      catalog: `${baseUrl}${CATALOG_PATH}`,
    },
    endpoints: API_ENDPOINTS.map((endpoint) => ({
      path: endpoint.path,
      url: `${baseUrl}${endpoint.path}`,
      method: 'GET',
      price: endpoint.price,
      currency: 'USDC',
      category: endpoint.category,
      description: endpoint.description,
      access: endpoint.upstream ? 'live_or_fallback' : 'mock_demo',
      upstream: endpoint.upstream || null,
    })),
  };
}

function createPaymentRequired(payTo: string, endpoint: APIEndpoint): Response {
  return apiResponse(
    {
      code: 'PAYMENT_REQUIRED',
      message: 'Payment required to access this API.',
      payTo,
      price: endpoint.price,
      currency: 'USDC',
      chain: 'base',
      scheme: 'exact',
      path: endpoint.path,
      description: endpoint.description,
      acceptedHeaders: ['Authorization', 'PAYMENT-SIGNATURE', 'X-Payment-Proof'],
      examples: {
        demo: `Authorization: Bearer ${DEMO_PAYMENT_TOKEN}`,
        signature: 'PAYMENT-SIGNATURE: <base64-encoded signed authorization payload>',
      },
      instructions: [
        'Connect a wallet with Base USDC.',
        'Sign an authorization payload for the requested amount.',
        'Replay the request with a payment header.',
      ],
      x402Spec: 'https://x402.org',
    },
    {
      status: 402,
      headers: {
        'X-Payment-Required': 'true',
        'X-Pay-To': payTo,
        'X-Price': endpoint.price,
        'X-Currency': 'USDC',
        'X-Chain': 'base',
        'X-Scheme': 'exact',
      },
    },
  );
}

function decodeBase64Json(value: string): PaymentPayload | null {
  try {
    const normalized = value.startsWith('Bearer ') ? value.slice(7).trim() : value.trim();
    const decoded = atob(normalized);
    return JSON.parse(decoded) as PaymentPayload;
  } catch {
    return null;
  }
}

function extractPaymentPayload(request: Request): PaymentPayload | 'demo' | null {
  const authorization = request.headers.get('Authorization');

  if (authorization === `Bearer ${DEMO_PAYMENT_TOKEN}`) {
    return 'demo';
  }

  if (authorization?.startsWith('Bearer ')) {
    const payload = decodeBase64Json(authorization);
    if (payload) {
      return payload;
    }
  }

  const paymentSignature = request.headers.get('PAYMENT-SIGNATURE');
  if (paymentSignature) {
    const payload = decodeBase64Json(paymentSignature);
    if (payload) {
      return payload;
    }
  }

  return null;
}

async function verifyPayment(request: Request, price: string, payTo: string): Promise<boolean> {
  const payload = extractPaymentPayload(request);

  if (payload === 'demo') {
    return true;
  }

  if (payload && payload.payTo?.toLowerCase() === payTo.toLowerCase()) {
    const amount = parseAmount(payload.amount);
    const expected = parseAmount(price);

    if (amount >= expected && payload.signature && payload.from) {
      try {
        const recovered = verifyMessage(JSON.stringify(payload.data ?? {}), payload.signature);
        if (recovered.toLowerCase() === payload.from.toLowerCase()) {
          return true;
        }
      } catch (error) {
        console.log('Payment verification failed:', error);
      }
    }
  }

  return request.headers.has('X-Payment-Proof');
}

async function fetchUpstreamData(path: string): Promise<unknown | null> {
  try {
    if (path === '/api/btc-price') {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const data = (await response.json()) as { price?: string };

      return {
        symbol: 'BTC',
        price: data.price ? Number(data.price) : null,
        timestamp: Date.now(),
        source: 'binance',
      };
    }

    if (path === '/api/eth-price') {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
      const data = (await response.json()) as { price?: string };

      return {
        symbol: 'ETH',
        price: data.price ? Number(data.price) : null,
        timestamp: Date.now(),
        source: 'binance',
      };
    }
  } catch (error) {
    console.error('Upstream fetch failed:', error);
  }

  return null;
}

function enforceRateLimit(request: Request): Response | null {
  if (!globalThis.rateLimiter) {
    globalThis.rateLimiter = new Map<string, number[]>();
  }

  const clientIP = getClientIP(request);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;

  let requests = globalThis.rateLimiter.get(clientIP) || [];
  requests = requests.filter((timestamp) => now - timestamp < windowMs);

  if (requests.length >= maxRequests) {
    return apiResponse(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    );
  }

  requests.push(now);
  globalThis.rateLimiter.set(clientIP, requests);

  return null;
}

async function serveStaticAsset(request: Request, env: Env): Promise<Response> {
  if (env.ASSETS) {
    return env.ASSETS.fetch(request);
  }

  return new Response('Static assets binding is not available.', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = `${url.protocol}//${url.host}`;
    const payTo = env.PAY_TO || DEFAULT_PAY_TO;

    if (request.method === 'OPTIONS' && (path.startsWith('/api/') || path === LEGACY_PRICE_PATH)) {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === HEALTH_PATH) {
      return apiResponse({
        status: 'ok',
        service: env.APP_NAME || 'API Market',
        timestamp: new Date().toISOString(),
        payTo,
        endpoints: API_ENDPOINTS.length,
      });
    }

    if (path === CATALOG_PATH) {
      return apiResponse(createCatalog(origin, payTo));
    }

    if (path === LEGACY_PRICE_PATH) {
      return apiResponse(
        Object.fromEntries(
          API_ENDPOINTS.map((endpoint) => [
            endpoint.path,
            {
              price: endpoint.price,
              description: endpoint.description,
              category: endpoint.category,
            },
          ]),
        ),
      );
    }

    const endpoint = API_INDEX[path];
    if (endpoint) {
      const rateLimitResponse = enforceRateLimit(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const isPaid = await verifyPayment(request, endpoint.price, payTo);
      if (!isPaid) {
        return createPaymentRequired(payTo, endpoint);
      }

      const upstreamData = await fetchUpstreamData(path);
      const baseData = (upstreamData || endpoint.sample()) as Record<string, unknown>;

      return apiResponse({
        ...baseData,
        _meta: {
          paid: true,
          price: endpoint.price,
          payTo,
          category: endpoint.category,
          timestamp: Date.now(),
          clientIP: getClientIP(request),
          origin: upstreamData ? 'proxied' : 'mock',
        },
      });
    }

    if (path.startsWith('/api/')) {
      return apiResponse(
        {
          error: 'Endpoint not found',
          availableEndpoints: API_ENDPOINTS.map((endpoint) => endpoint.path),
          catalog: `${origin}${CATALOG_PATH}`,
        },
        { status: 404 },
      );
    }

    return serveStaticAsset(request, env);
  },
};
