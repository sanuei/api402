/**
 * API Market x402 Payment Gateway
 *
 * A Cloudflare Worker that serves both:
 * 1. static assets for the landing page
 * 2. paid API routes protected by an x402-style payment challenge
 */

import { verifyMessage } from 'ethers';

export interface Env {
  PAY_TO?: string;
  APP_NAME?: string;
  BASE_RPC_URL?: string;
  ASSETS?: Fetcher;
}

export interface LocalizedText {
  zh: string;
  en: string;
}

declare global {
  var rateLimiter: Map<string, number[]>;
  var usedPaymentNonces: Map<string, number>;
  var usedPaymentTransactions: Map<string, number>;
}

export interface APIEndpoint {
  path: string;
  price: string;
  label: LocalizedText;
  description: LocalizedText;
  category: LocalizedText;
  upstream?: string;
  tags: string[];
  status: 'live' | 'demo';
  sample: () => Record<string, unknown>;
}

export interface PaymentMessage {
  version: '1';
  scheme: 'exact';
  network: 'base';
  currency: 'USDC';
  payTo: string;
  from: string;
  amount: string;
  resource: string;
  nonce: string;
  deadline: string;
  issuedAt: string;
}

export interface PaymentPayload extends PaymentMessage {
  signature: string;
}

export interface PaymentVerificationResult {
  ok: boolean;
  code:
    | 'PAYMENT_VALID'
    | 'DEMO_PAYMENT'
    | 'PAYMENT_MISSING'
    | 'PAYMENT_PROOF_HEADER'
    | 'INVALID_PAYMENT_ENCODING'
    | 'INVALID_PAYMENT_PAYLOAD'
    | 'PAYMENT_TARGET_MISMATCH'
    | 'PAYMENT_RESOURCE_MISMATCH'
    | 'PAYMENT_AMOUNT_TOO_LOW'
    | 'PAYMENT_EXPIRED'
    | 'PAYMENT_NONCE_REPLAYED'
    | 'PAYMENT_TX_HASH_MISSING'
    | 'PAYMENT_TX_HASH_INVALID'
    | 'PAYMENT_TX_REPLAYED'
    | 'PAYMENT_SETTLEMENT_RPC_FAILED'
    | 'PAYMENT_TX_NOT_FOUND'
    | 'PAYMENT_TX_FAILED'
    | 'PAYMENT_TRANSFER_MISSING'
    | 'PAYMENT_TRANSFER_AMOUNT_TOO_LOW'
    | 'PAYMENT_SIGNATURE_INVALID';
  message: string;
}

const DEFAULT_PAY_TO = '0x0A5312e03C1fb2b64569fAF61aD2c6517cCB0D18';
const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org';
const BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAYMENT_TX_HASH_HEADER = 'X-PAYMENT-TX-HASH';
const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DEMO_PAYMENT_TOKEN = 'demo';
const LEGACY_PRICE_PATH = '/prices';
const CATALOG_PATH = '/api/v1/catalog';
const HEALTH_PATH = '/api/v1/health';

export const API_ENDPOINTS: APIEndpoint[] = [
  {
    path: '/api/btc-price',
    price: '0.00001',
    label: { zh: 'BTC 价格', en: 'BTC Price' },
    description: {
      zh: '聚合自 Binance 的 BTC 实时价格。',
      en: 'Real-time BTC price feed aggregated from Binance.',
    },
    category: { zh: '市场数据', en: 'Market Data' },
    upstream: 'binance',
    tags: ['btc', 'market-data', 'realtime'],
    status: 'live',
    sample: () => ({ symbol: 'BTC', price: 67234.56, timestamp: Date.now() }),
  },
  {
    path: '/api/eth-price',
    price: '0.00001',
    label: { zh: 'ETH 价格', en: 'ETH Price' },
    description: {
      zh: '聚合自 Binance 的 ETH 实时价格。',
      en: 'Real-time ETH price feed aggregated from Binance.',
    },
    category: { zh: '市场数据', en: 'Market Data' },
    upstream: 'binance',
    tags: ['eth', 'market-data', 'realtime'],
    status: 'live',
    sample: () => ({ symbol: 'ETH', price: 3456.78, timestamp: Date.now() }),
  },
  {
    path: '/api/deepseek',
    price: '0.003',
    label: { zh: 'DeepSeek 对话', en: 'DeepSeek Chat' },
    description: {
      zh: 'DeepSeek 对话响应示例。',
      en: 'Demo DeepSeek chat completion response.',
    },
    category: { zh: '人工智能', en: 'AI' },
    tags: ['ai', 'chat', 'demo'],
    status: 'demo',
    sample: () => ({
      model: 'deepseek-v3',
      response: 'Hello! How can I help you today?',
      usage: { tokens: 128 },
    }),
  },
  {
    path: '/api/qwen',
    price: '0.01',
    label: { zh: 'Qwen 对话', en: 'Qwen Chat' },
    description: {
      zh: 'Qwen Max 对话响应示例。',
      en: 'Demo Qwen3 Max chat completion response.',
    },
    category: { zh: '人工智能', en: 'AI' },
    tags: ['ai', 'chat', 'demo'],
    status: 'demo',
    sample: () => ({
      model: 'qwen3-max',
      response: '您好！有什么我可以帮您的？',
      usage: { tokens: 256 },
    }),
  },
  {
    path: '/api/whale-positions',
    price: '0.00002',
    label: { zh: '巨鲸仓位', en: 'Whale Positions' },
    description: {
      zh: 'HyperLiquid 巨鲸仓位快照示例。',
      en: 'Demo HyperLiquid whale position snapshots.',
    },
    category: { zh: '链上情报', en: 'Onchain Intelligence' },
    tags: ['onchain', 'whale', 'demo'],
    status: 'demo',
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
    label: { zh: 'K 线数据', en: 'Candlestick Data' },
    description: {
      zh: '来自 Binance 的 BTC/USDT K 线快照。',
      en: 'BTC/USDT candlestick snapshots sourced from Binance.',
    },
    category: { zh: '交易', en: 'Trading' },
    upstream: 'binance',
    tags: ['trading', 'candles', 'binance'],
    status: 'live',
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
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, PAYMENT-SIGNATURE, X-Payment-Proof, X-PAYMENT-TX-HASH',
  'Access-Control-Expose-Headers':
    'X-Payment-Required, X-Pay-To, X-Price, X-Currency, X-Chain, X-Scheme, X-Payment-Reason',
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

function encodeJsonBase64(value: unknown): string {
  return btoa(JSON.stringify(value));
}

function decodeBase64Json(value: string): unknown | null {
  try {
    const normalized = value.startsWith('Bearer ') ? value.slice(7).trim() : value.trim();
    const decoded = atob(normalized);
    return JSON.parse(decoded) as unknown;
  } catch {
    return null;
  }
}

function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function getNonceStore(): Map<string, number> {
  if (!globalThis.usedPaymentNonces) {
    globalThis.usedPaymentNonces = new Map<string, number>();
  }

  return globalThis.usedPaymentNonces;
}

function getTransactionStore(): Map<string, number> {
  if (!globalThis.usedPaymentTransactions) {
    globalThis.usedPaymentTransactions = new Map<string, number>();
  }

  return globalThis.usedPaymentTransactions;
}

function sweepExpiredNonces(now: number) {
  const nonceStore = getNonceStore();
  for (const [key, expiry] of nonceStore.entries()) {
    if (expiry <= now) {
      nonceStore.delete(key);
    }
  }
}

function sweepExpiredTransactions(now: number) {
  const transactionStore = getTransactionStore();
  for (const [key, expiry] of transactionStore.entries()) {
    if (expiry <= now) {
      transactionStore.delete(key);
    }
  }
}

function buildNonceKey(payload: PaymentPayload): string {
  return `${payload.from.toLowerCase()}:${payload.resource}:${payload.nonce}`;
}

function parseTokenAmount(value: string, decimals: number): bigint | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) {
    return null;
  }

  const wholeUnits = BigInt(whole) * 10n ** BigInt(decimals);
  const fractionUnits = BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals));
  return wholeUnits + fractionUnits;
}

function normalizeTopicAddress(value: string | undefined): string | null {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    return null;
  }

  return `0x${value.slice(-40)}`.toLowerCase();
}

function getPaymentTxHash(request: Request): string | null {
  return request.headers.get(PAYMENT_TX_HASH_HEADER);
}

function isTransactionHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

type JsonRpcReceiptLog = {
  address?: string;
  topics?: string[];
  data?: string;
};

type JsonRpcTransactionReceipt = {
  status?: string;
  logs?: JsonRpcReceiptLog[];
};

async function callBaseRpc(env: Env, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`rpc ${response.status}`);
  }

  const payload = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (payload.error) {
    throw new Error(payload.error.message || 'unknown rpc error');
  }

  return payload.result ?? null;
}

async function verifyBaseUsdcSettlement(
  env: Env,
  txHash: string,
  payload: PaymentPayload,
  payTo: string,
): Promise<PaymentVerificationResult> {
  let receipt: JsonRpcTransactionReceipt | null;

  try {
    receipt = (await callBaseRpc(env, 'eth_getTransactionReceipt', [txHash])) as JsonRpcTransactionReceipt | null;
  } catch {
    return {
      ok: false,
      code: 'PAYMENT_SETTLEMENT_RPC_FAILED',
      message: 'Base RPC could not be reached for payment verification.',
    };
  }

  if (!receipt) {
    return {
      ok: false,
      code: 'PAYMENT_TX_NOT_FOUND',
      message: 'Payment transaction hash was not found on Base.',
    };
  }

  if (receipt.status !== '0x1') {
    return {
      ok: false,
      code: 'PAYMENT_TX_FAILED',
      message: 'Payment transaction did not succeed on-chain.',
    };
  }

  const minimumAmount = parseTokenAmount(payload.amount, 6);
  if (minimumAmount === null) {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_PAYLOAD',
      message: 'Payment payload amount is not a valid USDC decimal string.',
    };
  }

  const matchingTransfer = (receipt.logs || []).find((log) => {
    if (!log.address || log.address.toLowerCase() !== BASE_USDC_CONTRACT.toLowerCase()) {
      return false;
    }

    if (!log.topics || log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      return false;
    }

    const from = normalizeTopicAddress(log.topics[1]);
    const to = normalizeTopicAddress(log.topics[2]);
    return from === payload.from.toLowerCase() && to === payTo.toLowerCase();
  });

  if (!matchingTransfer) {
    return {
      ok: false,
      code: 'PAYMENT_TRANSFER_MISSING',
      message: 'No matching Base USDC transfer to the gateway receiver was found in the transaction.',
    };
  }

  const amountHex = matchingTransfer.data;
  if (!amountHex || !/^0x[0-9a-fA-F]+$/.test(amountHex)) {
    return {
      ok: false,
      code: 'PAYMENT_TRANSFER_MISSING',
      message: 'Matching Base USDC transfer log is missing an amount.',
    };
  }

  const transferredAmount = BigInt(amountHex);
  if (transferredAmount < minimumAmount) {
    return {
      ok: false,
      code: 'PAYMENT_TRANSFER_AMOUNT_TOO_LOW',
      message: 'On-chain Base USDC transfer amount is lower than the requested payment amount.',
    };
  }

  return {
    ok: true,
    code: 'PAYMENT_VALID',
    message: 'Base USDC payment transfer verified successfully.',
  };
}

export function buildPaymentMessage(input: Omit<PaymentPayload, 'signature'>): PaymentMessage {
  return {
    version: '1',
    scheme: 'exact',
    network: 'base',
    currency: 'USDC',
    payTo: input.payTo,
    from: input.from,
    amount: String(input.amount),
    resource: input.resource,
    nonce: input.nonce,
    deadline: input.deadline,
    issuedAt: input.issuedAt,
  };
}

function isPaymentPayload(value: unknown): value is PaymentPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const requiredStringKeys = [
    'version',
    'scheme',
    'network',
    'currency',
    'payTo',
    'from',
    'amount',
    'resource',
    'nonce',
    'deadline',
    'issuedAt',
    'signature',
  ];

  return requiredStringKeys.every((key) => typeof payload[key] === 'string');
}

function getCatalogEndpoint(baseUrl: string, payTo: string, endpoint: APIEndpoint) {
  const samplePayload = buildPaymentMessage({
    version: '1',
    scheme: 'exact',
    network: 'base',
    currency: 'USDC',
    payTo,
    from: '0xYourWalletAddress',
    amount: endpoint.price,
    resource: endpoint.path,
    nonce: 'replace-with-unique-nonce',
    deadline: '2026-03-08T16:00:00.000Z',
    issuedAt: '2026-03-08T15:55:00.000Z',
  } as Omit<PaymentPayload, 'signature'>);

  return {
    path: endpoint.path,
    url: `${baseUrl}${endpoint.path}`,
    method: 'GET',
    label: endpoint.label.en,
    price: endpoint.price,
    currency: 'USDC',
    category: endpoint.category.en,
    description: endpoint.description.en,
    access: endpoint.upstream ? 'live_or_fallback' : 'mock_demo',
    upstream: endpoint.upstream || null,
    status: endpoint.status,
    tags: endpoint.tags,
    locales: {
      zh: {
        label: endpoint.label.zh,
        category: endpoint.category.zh,
        description: endpoint.description.zh,
      },
      en: {
        label: endpoint.label.en,
        category: endpoint.category.en,
        description: endpoint.description.en,
      },
    },
    exampleRequest: {
      curl: [
        `curl -H "PAYMENT-SIGNATURE: <base64-signed-payload>" \\`,
        `  -H "${PAYMENT_TX_HASH_HEADER}: 0xreplace-with-base-usdc-transaction-hash" \\`,
        `  ${baseUrl}${endpoint.path}`,
        '',
        `# demo mode`,
        `curl -H "Authorization: Bearer ${DEMO_PAYMENT_TOKEN}" ${baseUrl}${endpoint.path}`,
      ].join('\n'),
      paymentPayload: samplePayload,
    },
    exampleResponse: endpoint.sample(),
  };
}

export function createCatalog(baseUrl: string, payTo: string) {
  return {
    name: 'API Market',
    appName: 'API Market',
    version: '1.2.0',
    payment: {
      payTo,
      currency: 'USDC',
      chain: 'base',
      chainId: 8453,
      scheme: 'exact',
      tokenContract: BASE_USDC_CONTRACT,
      acceptance: 'base-mainnet-usdc-only',
      note: 'Only Base mainnet native USDC is accepted. USDC bridged or sent on any other chain is not valid.',
      demoToken: DEMO_PAYMENT_TOKEN,
      acceptedHeaders: ['Authorization', 'PAYMENT-SIGNATURE', PAYMENT_TX_HASH_HEADER, 'X-Payment-Proof'],
      settlementProofHeader: PAYMENT_TX_HASH_HEADER,
      settlementMethod: 'base-usdc-transfer-receipt',
      payloadSchema: {
        version: '1',
        scheme: 'exact',
        network: 'base',
        currency: 'USDC',
        requiredFields: [
          'payTo',
          'from',
          'amount',
          'resource',
          'nonce',
          'deadline',
          'issuedAt',
          'signature',
        ],
      },
    },
    docs: {
      quickstart: `${baseUrl}/#examples`,
      health: `${baseUrl}${HEALTH_PATH}`,
      catalog: `${baseUrl}${CATALOG_PATH}`,
    },
    endpoints: API_ENDPOINTS.map((endpoint) => getCatalogEndpoint(baseUrl, payTo, endpoint)),
  };
}

function createPaymentRequired(
  payTo: string,
  endpoint: APIEndpoint,
  verification: PaymentVerificationResult,
): Response {
  return apiResponse(
    {
      code: 'PAYMENT_REQUIRED',
      reason: verification.code,
      message: verification.message,
      payTo,
      price: endpoint.price,
      currency: 'USDC',
      chain: 'base',
      chainId: 8453,
      scheme: 'exact',
      tokenContract: BASE_USDC_CONTRACT,
      acceptance: 'base-mainnet-usdc-only',
      path: endpoint.path,
      description: endpoint.description.en,
      acceptedHeaders: ['Authorization', 'PAYMENT-SIGNATURE', PAYMENT_TX_HASH_HEADER, 'X-Payment-Proof'],
      settlementProofHeader: PAYMENT_TX_HASH_HEADER,
      paymentSchema: {
        version: '1',
        scheme: 'exact',
        network: 'base',
        currency: 'USDC',
        requiredFields: [
          'payTo',
          'from',
          'amount',
          'resource',
          'nonce',
          'deadline',
          'issuedAt',
          'signature',
        ],
      },
      examples: {
        demo: `Authorization: Bearer ${DEMO_PAYMENT_TOKEN}`,
        signature: `PAYMENT-SIGNATURE: ${encodeJsonBase64({
          ...buildPaymentMessage({
            version: '1',
            scheme: 'exact',
            network: 'base',
            currency: 'USDC',
            payTo,
            from: '0xYourWalletAddress',
            amount: endpoint.price,
            resource: endpoint.path,
            nonce: 'replace-with-unique-nonce',
            deadline: '2026-03-08T16:00:00.000Z',
            issuedAt: '2026-03-08T15:55:00.000Z',
          } as Omit<PaymentPayload, 'signature'>),
          signature: 'replace-with-signature',
        })}`,
        settlement: `${PAYMENT_TX_HASH_HEADER}: 0xreplace-with-base-usdc-transaction-hash`,
      },
      instructions: [
        'Only Base mainnet native USDC is accepted.',
        `Use the USDC contract ${BASE_USDC_CONTRACT} on Base mainnet.`,
        'Connect a wallet with Base USDC.',
        'Submit the Base USDC transaction hash in X-PAYMENT-TX-HASH.',
        'Build a payment payload for the requested resource.',
        'Sign the canonical JSON string of the payload without the signature field.',
        'Replay the request with Authorization or PAYMENT-SIGNATURE.',
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
        'X-Payment-Reason': verification.code,
      },
    },
  );
}

function extractPaymentPayload(request: Request): PaymentPayload | 'demo' | 'proof' | null {
  const authorization = request.headers.get('Authorization');

  if (authorization === `Bearer ${DEMO_PAYMENT_TOKEN}`) {
    return 'demo';
  }

  if (authorization?.startsWith('Bearer ')) {
    const payload = decodeBase64Json(authorization);
    if (isPaymentPayload(payload)) {
      return payload;
    }

    return authorization ? null : null;
  }

  const paymentSignature = request.headers.get('PAYMENT-SIGNATURE');
  if (paymentSignature) {
    const payload = decodeBase64Json(paymentSignature);
    if (isPaymentPayload(payload)) {
      return payload;
    }

    return null;
  }

  if (request.headers.has('X-Payment-Proof')) {
    return 'proof';
  }

  return null;
}

export async function verifyPayment(
  request: Request,
  endpoint: APIEndpoint,
  payTo: string,
  env: Env,
  now = Date.now(),
): Promise<PaymentVerificationResult> {
  const rawPayload = extractPaymentPayload(request);

  if (rawPayload === 'demo') {
    return {
      ok: true,
      code: 'DEMO_PAYMENT',
      message: 'Demo payment token accepted.',
    };
  }

  if (rawPayload === 'proof') {
    return {
      ok: true,
      code: 'PAYMENT_PROOF_HEADER',
      message: 'Legacy payment proof header accepted.',
    };
  }

  const hasPaymentHeader =
    request.headers.has('Authorization') ||
    request.headers.has('PAYMENT-SIGNATURE') ||
    request.headers.has('X-Payment-Proof');

  if (!hasPaymentHeader) {
    return {
      ok: false,
      code: 'PAYMENT_MISSING',
      message: 'Payment header is required to access this API.',
    };
  }

  if (!rawPayload) {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_ENCODING',
      message: 'Payment payload could not be decoded from the request headers.',
    };
  }

  if (rawPayload.payTo.toLowerCase() !== payTo.toLowerCase()) {
    return {
      ok: false,
      code: 'PAYMENT_TARGET_MISMATCH',
      message: 'Payment payload payTo does not match the gateway receiver.',
    };
  }

  if (rawPayload.resource !== endpoint.path) {
    return {
      ok: false,
      code: 'PAYMENT_RESOURCE_MISMATCH',
      message: 'Payment payload resource does not match the requested endpoint.',
    };
  }

  if (parseAmount(rawPayload.amount) < parseAmount(endpoint.price)) {
    return {
      ok: false,
      code: 'PAYMENT_AMOUNT_TOO_LOW',
      message: 'Payment payload amount is lower than the endpoint price.',
    };
  }

  const deadline = Date.parse(rawPayload.deadline);
  if (!Number.isFinite(deadline)) {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_PAYLOAD',
      message: 'Payment payload deadline is invalid.',
    };
  }

  if (deadline < now) {
    return {
      ok: false,
      code: 'PAYMENT_EXPIRED',
      message: 'Payment payload has expired.',
    };
  }

  if (!rawPayload.nonce.trim() || !rawPayload.issuedAt.trim()) {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_PAYLOAD',
      message: 'Payment payload nonce and issuedAt are required.',
    };
  }

  sweepExpiredNonces(now);
  sweepExpiredTransactions(now);
  const nonceKey = buildNonceKey(rawPayload);
  const nonceStore = getNonceStore();
  const currentNonceExpiry = nonceStore.get(nonceKey);
  if (currentNonceExpiry && currentNonceExpiry > now) {
    return {
      ok: false,
      code: 'PAYMENT_NONCE_REPLAYED',
      message: 'Payment payload nonce has already been used.',
    };
  }

  const txHash = getPaymentTxHash(request);
  if (!txHash) {
    return {
      ok: false,
      code: 'PAYMENT_TX_HASH_MISSING',
      message: 'Base settlement proof is required in the X-PAYMENT-TX-HASH header.',
    };
  }

  if (!isTransactionHash(txHash)) {
    return {
      ok: false,
      code: 'PAYMENT_TX_HASH_INVALID',
      message: 'Payment transaction hash is not a valid 32-byte hex value.',
    };
  }

  const transactionStore = getTransactionStore();
  const existingTransactionExpiry = transactionStore.get(txHash.toLowerCase());
  if (existingTransactionExpiry && existingTransactionExpiry > now) {
    return {
      ok: false,
      code: 'PAYMENT_TX_REPLAYED',
      message: 'Payment transaction hash has already been used for a request.',
    };
  }

  try {
    const canonicalMessage = buildPaymentMessage(rawPayload);
    const recovered = verifyMessage(JSON.stringify(canonicalMessage), rawPayload.signature);

    if (recovered.toLowerCase() !== rawPayload.from.toLowerCase()) {
      return {
        ok: false,
        code: 'PAYMENT_SIGNATURE_INVALID',
        message: 'Payment signature does not match the payer address.',
      };
    }
  } catch {
    return {
      ok: false,
      code: 'PAYMENT_SIGNATURE_INVALID',
      message: 'Payment signature verification failed.',
    };
  }

  const settlementVerification = await verifyBaseUsdcSettlement(env, txHash, rawPayload, payTo);
  if (!settlementVerification.ok) {
    return settlementVerification;
  }

  nonceStore.set(nonceKey, deadline);
  transactionStore.set(txHash.toLowerCase(), deadline);

  return {
    ok: true,
    code: 'PAYMENT_VALID',
    message: 'Payment payload verified successfully.',
  };
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

    if (path === '/api/kline') {
      const response = await fetch(
        'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=6',
      );
      const data = (await response.json()) as Array<
        [number, string, string, string, string, string, number, string, number, string, string, string]
      >;

      return {
        symbol: 'BTCUSDT',
        interval: '1h',
        candles: data.map((candle) => [
          candle[0],
          Number(candle[1]),
          Number(candle[2]),
          Number(candle[3]),
          Number(candle[4]),
          Number(candle[5]),
        ]),
        source: 'binance',
        timestamp: Date.now(),
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

const worker = {
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
              description: endpoint.description.en,
              category: endpoint.category.en,
              status: endpoint.status,
              tags: endpoint.tags,
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

      const verification = await verifyPayment(request, endpoint, payTo, env);
      if (!verification.ok) {
        return createPaymentRequired(payTo, endpoint, verification);
      }

      const upstreamData = await fetchUpstreamData(path);
      const baseData = (upstreamData || endpoint.sample()) as Record<string, unknown>;

      return apiResponse({
        ...baseData,
        _meta: {
          paid: true,
          paymentMode: verification.code,
          price: endpoint.price,
          payTo,
          category: endpoint.category.en,
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

export default worker;
