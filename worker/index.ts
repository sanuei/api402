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
  BASE_RPC_URLS?: string;
  PAYMENT_MIN_CONFIRMATIONS?: string;
  PAYMENT_MAX_AGE_SECONDS?: string;
  PAYMENT_MAX_FUTURE_SKEW_SECONDS?: string;
  PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS?: string;
  REPLAY_GUARD?: DurableObjectNamespace;
  METRICS_STORE?: DurableObjectNamespace;
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
  var upstreamCircuitState: Map<string, { failures: number; openUntil: number; lastErrorCode?: string }>;
  var upstreamTelemetryState: Map<string, UpstreamTelemetryEvent[]>;
  var endpointRequestMetricsState: Map<string, EndpointRequestMetricEvent[]>;
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

export interface PaymentSettlementContext {
  txHash: string;
  chainId: 8453;
  tokenContract: string;
  settlementMethod: 'base-usdc-transfer-receipt';
  requiredConfirmations: number;
  receiptBlock: number | null;
  latestBlock: number | null;
  confirmations: number;
}

export interface SettlementPolicy {
  settlementMethod: 'base-usdc-transfer-receipt';
  requiredConfirmations: number;
  maxSettlementAgeBlocks: number;
  averageBlockSeconds: number;
  recommendedRetryAfterSeconds: number;
}

type SettlementStatusResult = {
  ok: boolean;
  code:
    | 'SETTLEMENT_READY'
    | 'SETTLEMENT_PENDING'
    | 'SETTLEMENT_TOO_OLD'
    | 'SETTLEMENT_NOT_FOUND'
    | 'SETTLEMENT_RPC_FAILED';
  message: string;
  settlement: PaymentSettlementContext;
  receipt: JsonRpcTransactionReceipt | null;
};

type RemediationHint = {
  retryable: boolean;
  action: string;
  retryAfterSeconds?: number;
};

type RemediationRefs = {
  changelog: string;
  deprecations: string;
};

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
    | 'PAYMENT_TX_NOT_CONFIRMED'
    | 'PAYMENT_TX_TOO_OLD'
    | 'PAYMENT_ISSUED_AT_IN_FUTURE'
    | 'PAYMENT_STALE'
    | 'PAYMENT_DEADLINE_TOO_FAR'
    | 'PAYMENT_SIGNATURE_INVALID';
  message: string;
  settlement?: PaymentSettlementContext;
}

const DEFAULT_PAY_TO = '0x0A5312e03C1fb2b64569fAF61aD2c6517cCB0D18';
const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org';
const BASE_RPC_TIMEOUT_MS = 6000;
const DEFAULT_PAYMENT_MIN_CONFIRMATIONS = 2;
const DEFAULT_PAYMENT_MAX_AGE_SECONDS = 15 * 60;
const DEFAULT_PAYMENT_MAX_FUTURE_SKEW_SECONDS = 2 * 60;
const DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS = 7200;
const BASE_CONFIRMATION_AVG_SECONDS = 2;
const BASE_SETTLEMENT_RETRY_FLOOR_SECONDS = 2;
const BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAYMENT_TX_HASH_HEADER = 'X-PAYMENT-TX-HASH';
const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DEMO_PAYMENT_TOKEN = 'demo';
const LEGACY_PRICE_PATH = '/prices';
const CATALOG_PATH = '/api/v1/catalog';
const HEALTH_PATH = '/api/v1/health';
const SETTLEMENT_PATH_PREFIX = '/api/v1/settlement/';
const FUNNEL_METRICS_PATH = '/api/v1/metrics/funnel';
const REMEDIATION_CHANGELOG_PATH = '/.well-known/remediation-changelog.json';
const REMEDIATION_DEPRECATIONS_PATH = '/.well-known/remediation-deprecations.json';

const REMEDIATION_SCHEMA_VERSION = '1.0.0';
const REMEDIATION_COMPATIBILITY = 'semver-minor-backward-compatible';
const UPSTREAM_TIMEOUT_MS = 8000;
const UPSTREAM_FAILURE_THRESHOLD = 3;
const UPSTREAM_CIRCUIT_COOLDOWN_MS = 30_000;
const UPSTREAM_TELEMETRY_WINDOW_MS = 15 * 60 * 1000;
const UPSTREAM_TELEMETRY_MAX_EVENTS = 120;
const ENDPOINT_METRICS_WINDOW_MS = 60 * 60 * 1000;
const ENDPOINT_METRICS_MAX_EVENTS = 600;
const ENDPOINT_METRICS_DURABLE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ENDPOINT_METRICS_DURABLE_MAX_EVENTS = 20_000;
const ENDPOINT_METRICS_BUCKET_MS = 10 * 60 * 1000;
const ENDPOINT_METRICS_BUCKET_COUNT = 6;
const REQUEST_ID_HEADER = 'X-Request-Id';


const SETTLEMENT_REMEDIATION_MAP: Record<SettlementStatusResult['code'], RemediationHint> = {
  SETTLEMENT_READY: {
    retryable: false,
    action: 'Settlement is confirmed. Replay the paid request now.',
  },
  SETTLEMENT_PENDING: {
    retryable: true,
    action: 'Wait for more Base confirmations, then retry settlement status or replay request.',
  },
  SETTLEMENT_TOO_OLD: {
    retryable: false,
    action: 'Create and submit a new payment transaction; this proof is too old.',
  },
  SETTLEMENT_NOT_FOUND: {
    retryable: true,
    action: 'Check tx hash and chain, wait for indexing, then retry.',
  },
  SETTLEMENT_RPC_FAILED: {
    retryable: true,
    action: 'Retry against settlement endpoint after a short delay or switch RPC providers.',
  },
};

const PAYMENT_REMEDIATION_MAP: Partial<Record<PaymentVerificationResult['code'], RemediationHint>> = {
  PAYMENT_TX_NOT_CONFIRMED: {
    retryable: true,
    action: 'Wait for required Base confirmations, then replay the same signed payload and tx hash.',
  },
  PAYMENT_TX_TOO_OLD: {
    retryable: false,
    action: 'Pay again with a fresh transaction hash and replay within allowed settlement age.',
  },
  PAYMENT_TX_NOT_FOUND: {
    retryable: true,
    action: 'Confirm the tx hash on Base mainnet and retry when it is indexed.',
  },
  PAYMENT_SETTLEMENT_RPC_FAILED: {
    retryable: true,
    action: 'Retry shortly; gateway could not reach Base RPC.',
  },
  PAYMENT_TX_REPLAYED: {
    retryable: false,
    action: 'Use a new payment transaction hash for a new paid request.',
  },
  PAYMENT_NONCE_REPLAYED: {
    retryable: false,
    action: 'Regenerate payload with a new nonce and signature before replay.',
  },
};

type ReplayConsumeResult = {
  consumed: boolean;
  replayedKey?: string;
};

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
      zh: '基于 HyperLiquid 实时成交聚合的巨鲸活跃地址快照。',
      en: 'Near real-time whale activity snapshot aggregated from HyperLiquid recent trades.',
    },
    category: { zh: '链上情报', en: 'Onchain Intelligence' },
    upstream: 'hyperliquid',
    tags: ['onchain', 'whale', 'live'],
    status: 'live',
    sample: () => ({
      source: 'hyperliquid',
      timeframe: 'recent',
      markets: ['BTC', 'ETH'],
      positions: [
        { address: '0x1234...', trades: 12, notionalUsd: 1250000, dominantSide: 'buy' },
        { address: '0x5678...', trades: 10, notionalUsd: 980000, dominantSide: 'buy' },
        { address: '0xabcd...', trades: 9, notionalUsd: 750000, dominantSide: 'sell' },
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
    'Content-Type, Authorization, PAYMENT-SIGNATURE, X-Payment-Proof, X-PAYMENT-TX-HASH, X-Request-Id',
  'Access-Control-Expose-Headers':
    'X-Payment-Required, X-Pay-To, X-Price, X-Currency, X-Chain, X-Scheme, X-Payment-Reason, X-Request-Id',
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

function getRequestId(request: Request): string {
  const fromHeader = request.headers.get(REQUEST_ID_HEADER)?.trim();
  return fromHeader && fromHeader.length > 0 ? fromHeader : crypto.randomUUID();
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

function getReplayStore(kind: 'nonce' | 'tx'): Map<string, number> {
  return kind === 'nonce' ? getNonceStore() : getTransactionStore();
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

function buildReplayGuardKey(kind: 'nonce' | 'tx', value: string): string {
  return `${kind}:${value.toLowerCase()}`;
}

async function consumeReplayKeys(
  env: Env,
  entries: Array<{ kind: 'nonce' | 'tx'; value: string }>,
  expiry: number,
  now: number,
): Promise<ReplayConsumeResult> {
  const keys = entries.map(({ kind, value }) => buildReplayGuardKey(kind, value));

  if (env.REPLAY_GUARD) {
    const stub = env.REPLAY_GUARD.get(env.REPLAY_GUARD.idFromName('global'));
    const response = await stub.fetch('https://replay-guard/consume', {
      method: 'POST',
      body: JSON.stringify({ keys, expiry, now }),
    });

    if (!response.ok) {
      throw new Error(`replay guard ${response.status}`);
    }

    return (await response.json()) as ReplayConsumeResult;
  }

  for (const entry of entries) {
    const key = buildReplayGuardKey(entry.kind, entry.value);
    const currentExpiry = getReplayStore(entry.kind).get(key);
    if (currentExpiry && currentExpiry > now) {
      return { consumed: false, replayedKey: key };
    }
  }

  for (const entry of entries) {
    const key = buildReplayGuardKey(entry.kind, entry.value);
    getReplayStore(entry.kind).set(key, expiry);
  }

  return { consumed: true };
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

function parseMinConfirmations(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PAYMENT_MIN_CONFIRMATIONS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PAYMENT_MIN_CONFIRMATIONS;
  }

  return parsed;
}

function parseHexBlockNumber(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function getPaymentTxHash(request: Request): string | null {
  return request.headers.get(PAYMENT_TX_HASH_HEADER);
}

function isTransactionHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function isHexAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

type JsonRpcReceiptLog = {
  address?: string;
  topics?: string[];
  data?: string;
};

type JsonRpcTransactionReceipt = {
  status?: string;
  blockNumber?: string;
  logs?: JsonRpcReceiptLog[];
};

function getBaseRpcUrls(env: Env): string[] {
  const raw = env.BASE_RPC_URLS || env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL;
  const urls = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return urls.length > 0 ? urls : [DEFAULT_BASE_RPC_URL];
}

async function callBaseRpc(env: Env, method: string, params: unknown[]): Promise<unknown> {
  const rpcUrls = getBaseRpcUrls(env);
  let lastError: Error | null = null;

  for (const rpcUrl of rpcUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BASE_RPC_TIMEOUT_MS);

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`rpc ${response.status}`);
      }

      const payload = (await response.json()) as { result?: unknown; error?: { message?: string } };
      if (payload.error) {
        throw new Error(payload.error.message || 'unknown rpc error');
      }

      return payload.result ?? null;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('base rpc unavailable');
}

async function verifyBaseUsdcSettlement(
  env: Env,
  txHash: string,
  payload: PaymentPayload,
  payTo: string,
): Promise<PaymentVerificationResult> {
  const requiredConfirmations = parseMinConfirmations(env.PAYMENT_MIN_CONFIRMATIONS);
  const maxSettlementAgeBlocks = parsePositiveInt(
    env.PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
    DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
  );
  const createSettlementContext = (
    receiptBlock: bigint | null,
    latestBlock: bigint | null,
    confirmations: bigint,
  ): PaymentSettlementContext => ({
    txHash,
    chainId: 8453,
    tokenContract: BASE_USDC_CONTRACT,
    settlementMethod: 'base-usdc-transfer-receipt',
    requiredConfirmations,
    receiptBlock: receiptBlock === null ? null : Number(receiptBlock),
    latestBlock: latestBlock === null ? null : Number(latestBlock),
    confirmations: Number(confirmations),
  });

  let receipt: JsonRpcTransactionReceipt | null;

  try {
    receipt = (await callBaseRpc(env, 'eth_getTransactionReceipt', [txHash])) as JsonRpcTransactionReceipt | null;
  } catch {
    return {
      ok: false,
      code: 'PAYMENT_SETTLEMENT_RPC_FAILED',
      message: 'Base RPC could not be reached for payment verification.',
      settlement: createSettlementContext(null, null, 0n),
    };
  }

  if (!receipt) {
    return {
      ok: false,
      code: 'PAYMENT_TX_NOT_FOUND',
      message: 'Payment transaction hash was not found on Base.',
      settlement: createSettlementContext(null, null, 0n),
    };
  }

  if (receipt.status !== '0x1') {
    return {
      ok: false,
      code: 'PAYMENT_TX_FAILED',
      message: 'Payment transaction did not succeed on-chain.',
      settlement: createSettlementContext(parseHexBlockNumber(receipt.blockNumber), null, 0n),
    };
  }

  const receiptBlock = parseHexBlockNumber(receipt.blockNumber);
  if (receiptBlock === null) {
    return {
      ok: false,
      code: 'PAYMENT_TX_NOT_CONFIRMED',
      message: 'Payment transaction is not confirmed yet.',
      settlement: createSettlementContext(null, null, 0n),
    };
  }

  let latestBlock: bigint;
  try {
    const latestBlockHex = await callBaseRpc(env, 'eth_blockNumber', []);
    const parsedLatestBlock = parseHexBlockNumber(latestBlockHex);
    if (parsedLatestBlock === null) {
      throw new Error('invalid block number');
    }

    latestBlock = parsedLatestBlock;
  } catch {
    return {
      ok: false,
      code: 'PAYMENT_SETTLEMENT_RPC_FAILED',
      message: 'Base RPC could not be reached for block confirmation verification.',
      settlement: createSettlementContext(receiptBlock, null, 0n),
    };
  }

  const confirmations = latestBlock >= receiptBlock ? latestBlock - receiptBlock + 1n : 0n;
  const txAgeBlocks = latestBlock >= receiptBlock ? latestBlock - receiptBlock : 0n;
  if (txAgeBlocks > BigInt(maxSettlementAgeBlocks)) {
    return {
      ok: false,
      code: 'PAYMENT_TX_TOO_OLD',
      message: `Payment transaction is too old for replay. Maximum settlement proof age is ${maxSettlementAgeBlocks.toString()} blocks.`,
      settlement: createSettlementContext(receiptBlock, latestBlock, confirmations),
    };
  }

  if (confirmations < BigInt(requiredConfirmations)) {
    return {
      ok: false,
      code: 'PAYMENT_TX_NOT_CONFIRMED',
      message: `Payment transaction requires at least ${requiredConfirmations.toString()} confirmations on Base before replay.`,
      settlement: createSettlementContext(receiptBlock, latestBlock, confirmations),
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

  const transferredAmount = findMatchingTransferAmount(receipt, payload.from, payTo);
  if (transferredAmount === null) {
    return {
      ok: false,
      code: 'PAYMENT_TRANSFER_MISSING',
      message: 'No matching Base USDC transfer to the gateway receiver was found in the transaction.',
    };
  }
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
    settlement: createSettlementContext(receiptBlock, latestBlock, confirmations),
  };
}

export class ReplayGuardDurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/consume') {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }

    const payload = (await request.json()) as { keys?: string[]; expiry?: number; now?: number };
    const keys = Array.isArray(payload.keys) ? payload.keys.filter((value) => typeof value === 'string') : [];
    const expiry = Number(payload.expiry);
    const now = Number(payload.now);

    if (!Number.isFinite(expiry) || !Number.isFinite(now) || keys.length === 0) {
      return jsonResponse({ error: 'Invalid replay payload' }, { status: 400 });
    }

    for (const key of keys) {
      const currentExpiry = await this.state.storage.get<number>(key);
      if (typeof currentExpiry === 'number' && currentExpiry > now) {
        return jsonResponse({ consumed: false, replayedKey: key });
      }
    }

    await this.state.storage.put(
      keys.reduce<Record<string, number>>((result, key) => {
        result[key] = expiry;
        return result;
      }, {}),
    );

    const currentAlarm = await this.state.storage.getAlarm();
    if (currentAlarm === null || expiry < currentAlarm) {
      await this.state.storage.setAlarm(expiry);
    }
    return jsonResponse({ consumed: true });
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    let nextAlarm: number | null = null;
    const entries = await this.state.storage.list<number>();

    for (const [key, expiry] of entries.entries()) {
      if (typeof expiry === 'number' && expiry <= now) {
        await this.state.storage.delete(key);
        continue;
      }

      if (typeof expiry === 'number' && (nextAlarm === null || expiry < nextAlarm)) {
        nextAlarm = expiry;
      }
    }

    if (nextAlarm !== null) {
      await this.state.storage.setAlarm(nextAlarm);
    }
  }
}

export class MetricsStoreDurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/append') {
      const payload = (await request.json()) as
        | { kind?: 'upstream'; key?: string; event?: UpstreamTelemetryEvent }
        | { kind?: 'endpoint'; key?: string; event?: EndpointRequestMetricEvent };

      if (!payload || typeof payload !== 'object' || !payload.kind || !payload.key || !payload.event) {
        return jsonResponse({ error: 'Invalid metrics payload' }, { status: 400 });
      }

      const storageKey = `${payload.kind}:${payload.key}`;
      if (payload.kind === 'upstream') {
        const existing = ((await this.state.storage.get<UpstreamTelemetryEvent[]>(storageKey)) || []).filter(Boolean);
        const next = pruneTelemetryEvents([...existing, payload.event as UpstreamTelemetryEvent], Date.now());
        await this.state.storage.put(storageKey, next);
      } else {
        const existing = ((await this.state.storage.get<EndpointRequestMetricEvent[]>(storageKey)) || []).filter(Boolean);
        const next = pruneEndpointRequestEventsWithWindow(
          [...existing, payload.event as EndpointRequestMetricEvent],
          Date.now(),
          ENDPOINT_METRICS_DURABLE_RETENTION_MS,
          ENDPOINT_METRICS_DURABLE_MAX_EVENTS,
        );
        await this.state.storage.put(storageKey, next);
      }

      await this.state.storage.setAlarm(Date.now() + ENDPOINT_METRICS_WINDOW_MS);
      return jsonResponse({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/snapshot') {
      const payload = (await request.json().catch(() => ({}))) as { now?: number };
      const now = Number(payload.now) || Date.now();
      const entries = await this.state.storage.list<UpstreamTelemetryEvent[] | EndpointRequestMetricEvent[]>();
      const upstreamTelemetry: Record<string, UpstreamTelemetryEvent[]> = {};
      const endpointMetrics: Record<string, EndpointRequestMetricEvent[]> = {};

      for (const [key, value] of entries.entries()) {
        if (!Array.isArray(value)) {
          continue;
        }

        if (key.startsWith('upstream:')) {
          upstreamTelemetry[key.slice('upstream:'.length)] = pruneTelemetryEvents(
            value as UpstreamTelemetryEvent[],
            now,
          );
          continue;
        }

        if (key.startsWith('endpoint:')) {
          endpointMetrics[key.slice('endpoint:'.length)] = pruneEndpointRequestEvents(
            value as EndpointRequestMetricEvent[],
            now,
          );
        }
      }

      return jsonResponse({ upstreamTelemetry, endpointMetrics });
    }

    if (request.method === 'POST' && url.pathname === '/funnel') {
      const payload = (await request.json().catch(() => ({}))) as { now?: number; window?: FunnelWindow };
      const now = Number(payload.now) || Date.now();
      const window = payload.window === '7d' ? '7d' : '24h';
      const entries = await this.state.storage.list<EndpointRequestMetricEvent[]>({ prefix: 'endpoint:' });
      const endpointMetrics: Record<string, EndpointRequestMetricEvent[]> = {};

      for (const [key, value] of entries.entries()) {
        if (!Array.isArray(value)) {
          continue;
        }

        endpointMetrics[key.slice('endpoint:'.length)] = value as EndpointRequestMetricEvent[];
      }

      return jsonResponse(summarizeFunnelFromEndpointMetrics(endpointMetrics, window, now));
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const entries = await this.state.storage.list<UpstreamTelemetryEvent[] | EndpointRequestMetricEvent[]>();

    for (const [key, value] of entries.entries()) {
      if (!Array.isArray(value)) {
        continue;
      }

      if (key.startsWith('upstream:')) {
        const next = pruneTelemetryEvents(value as UpstreamTelemetryEvent[], now);
        if (next.length === 0) {
          await this.state.storage.delete(key);
        } else {
          await this.state.storage.put(key, next);
        }
        continue;
      }

      if (key.startsWith('endpoint:')) {
        const next = pruneEndpointRequestEventsWithWindow(
          value as EndpointRequestMetricEvent[],
          now,
          ENDPOINT_METRICS_DURABLE_RETENTION_MS,
          ENDPOINT_METRICS_DURABLE_MAX_EVENTS,
        );
        if (next.length === 0) {
          await this.state.storage.delete(key);
        } else {
          await this.state.storage.put(key, next);
        }
      }
    }

    await this.state.storage.setAlarm(Date.now() + ENDPOINT_METRICS_WINDOW_MS);
  }
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

function findMatchingTransferAmount(
  receipt: JsonRpcTransactionReceipt | null,
  from: string,
  to: string,
): bigint | null {
  if (!receipt) {
    return null;
  }

  const matchingTransfer = (receipt.logs || []).find((log) => {
    if (!log.address || log.address.toLowerCase() !== BASE_USDC_CONTRACT.toLowerCase()) {
      return false;
    }

    if (!log.topics || log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      return false;
    }

    const fromAddress = normalizeTopicAddress(log.topics[1]);
    const toAddress = normalizeTopicAddress(log.topics[2]);
    return fromAddress === from.toLowerCase() && toAddress === to.toLowerCase();
  });

  const amountHex = matchingTransfer?.data;
  if (!amountHex || !/^0x[0-9a-fA-F]+$/.test(amountHex)) {
    return null;
  }

  return BigInt(amountHex);
}

function findLargestTransferAmountTo(
  receipt: JsonRpcTransactionReceipt | null,
  to: string,
): bigint | null {
  if (!receipt) {
    return null;
  }

  let largest: bigint | null = null;
  for (const log of receipt.logs || []) {
    if (!log.address || log.address.toLowerCase() !== BASE_USDC_CONTRACT.toLowerCase()) {
      continue;
    }

    if (!log.topics || log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      continue;
    }

    const toAddress = normalizeTopicAddress(log.topics[2]);
    if (toAddress !== to.toLowerCase()) {
      continue;
    }

    const amountHex = log.data;
    if (!amountHex || !/^0x[0-9a-fA-F]+$/.test(amountHex)) {
      continue;
    }

    const amount = BigInt(amountHex);
    if (largest === null || amount > largest) {
      largest = amount;
    }
  }

  return largest;
}

function getCatalogEndpoint(
  baseUrl: string,
  payTo: string,
  endpoint: APIEndpoint,
  snapshot: MetricsSnapshot | null,
) {
  const now = Date.now();
  const upstreamTelemetry = endpoint.upstream
    ? getUpstreamTelemetrySummary(endpoint.upstream, now, snapshot)
    : null;
  const requestMetrics = getEndpointRequestMetricSummary(endpoint.path, now, Boolean(endpoint.upstream), snapshot);
  const { lastUpdatedAt, freshness } = computeEndpointFreshness(now, requestMetrics, upstreamTelemetry);
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
    requestMetrics,
    lastUpdatedAt,
    freshness,
    upstreamPolicy: endpoint.upstream
      ? {
          timeoutMs: UPSTREAM_TIMEOUT_MS,
          failureThreshold: UPSTREAM_FAILURE_THRESHOLD,
          circuitCooldownMs: UPSTREAM_CIRCUIT_COOLDOWN_MS,
          fallback: 'sample_response',
          errorCodes: [
            'UPSTREAM_TIMEOUT',
            'UPSTREAM_HTTP_ERROR',
            'UPSTREAM_INVALID_RESPONSE',
            'UPSTREAM_FETCH_FAILED',
            'UPSTREAM_CIRCUIT_OPEN',
          ],
          telemetry: upstreamTelemetry,
        }
      : null,
  };
}

function buildSettlementPolicy(
  minConfirmations: number,
  maxSettlementAgeBlocks: number,
  settlement?: PaymentSettlementContext,
): SettlementPolicy {
  const missingConfirmations = Math.max(minConfirmations - (settlement?.confirmations || 0), 0);
  const recommendedRetryAfterSeconds = Math.max(
    BASE_SETTLEMENT_RETRY_FLOOR_SECONDS,
    missingConfirmations * BASE_CONFIRMATION_AVG_SECONDS,
  );

  return {
    settlementMethod: 'base-usdc-transfer-receipt',
    requiredConfirmations: minConfirmations,
    maxSettlementAgeBlocks,
    averageBlockSeconds: BASE_CONFIRMATION_AVG_SECONDS,
    recommendedRetryAfterSeconds,
  };
}

function buildRemediation(
  hint: RemediationHint,
  settlementPolicy?: SettlementPolicy,
): RemediationHint {
  if (!hint.retryable || !settlementPolicy) {
    return hint;
  }

  return {
    ...hint,
    retryAfterSeconds: settlementPolicy.recommendedRetryAfterSeconds,
  };
}

function buildRemediationRefs(baseUrl: string): RemediationRefs {
  return {
    changelog: `${baseUrl}${REMEDIATION_CHANGELOG_PATH}`,
    deprecations: `${baseUrl}${REMEDIATION_DEPRECATIONS_PATH}`,
  };
}

function getEndpointRequestMetricsState(): Map<string, EndpointRequestMetricEvent[]> {
  if (!globalThis.endpointRequestMetricsState) {
    globalThis.endpointRequestMetricsState = new Map();
  }

  return globalThis.endpointRequestMetricsState;
}

function pruneEndpointRequestEventsWithWindow(
  events: EndpointRequestMetricEvent[],
  now: number,
  windowMs: number,
  maxEvents: number,
): EndpointRequestMetricEvent[] {
  const windowStart = now - windowMs;
  const inWindow = events.filter((event) => event.at >= windowStart);
  return inWindow.slice(-maxEvents);
}

function pruneEndpointRequestEvents(events: EndpointRequestMetricEvent[], now: number): EndpointRequestMetricEvent[] {
  return pruneEndpointRequestEventsWithWindow(events, now, ENDPOINT_METRICS_WINDOW_MS, ENDPOINT_METRICS_MAX_EVENTS);
}

function getFunnelWindowMs(window: FunnelWindow): number {
  return window === '7d' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

function summarizeFunnelFromEndpointMetrics(
  endpointMetrics: Record<string, EndpointRequestMetricEvent[]>,
  window: FunnelWindow,
  now: number,
): FunnelSummary {
  const windowMs = getFunnelWindowMs(window);
  const fromMs = now - windowMs;

  const endpoints = Object.entries(endpointMetrics)
    .map(([path, events]) => {
      const inWindow = events.filter((event) => event.at >= fromMs && event.at <= now);
      const challengedRequestIds = new Set(
        inWindow
          .filter((event) => event.statusCode === 402 && event.requestId)
          .map((event) => event.requestId as string),
      );
      const replayedRequestIds = new Set(
        inWindow
          .filter(
            (event) =>
              event.statusCode < 400 &&
              ['PAYMENT_VALID', 'DEMO_PAYMENT', 'PAYMENT_PROOF_HEADER'].includes(event.paymentCode || '') &&
              event.requestId &&
              challengedRequestIds.has(event.requestId),
          )
          .map((event) => event.requestId as string),
      );

      const challenged402 = inWindow.filter((event) => event.statusCode === 402).length;
      const settled = inWindow.filter((event) => event.paymentCode === 'PAYMENT_VALID').length;
      const replayed = replayedRequestIds.size;
      return {
        path,
        challenged402,
        settled,
        replayed,
        challengeToReplayConversionRate:
          challengedRequestIds.size > 0 ? Number((replayed / challengedRequestIds.size).toFixed(4)) : 0,
      };
    })
    .filter((endpoint) => endpoint.challenged402 > 0 || endpoint.settled > 0 || endpoint.replayed > 0)
    .sort((a, b) => b.challenged402 - a.challenged402 || b.replayed - a.replayed || a.path.localeCompare(b.path));

  return {
    window,
    from: new Date(fromMs).toISOString(),
    to: new Date(now).toISOString(),
    endpoints,
  };
}

function recordEndpointRequestMetric(path: string, event: EndpointRequestMetricEvent): void {
  const store = getEndpointRequestMetricsState();
  const existing = store.get(path) || [];
  store.set(path, pruneEndpointRequestEvents([...existing, event], event.at));
}

async function recordEndpointRequestMetricWithDurable(
  env: Env,
  path: string,
  event: EndpointRequestMetricEvent,
): Promise<void> {
  recordEndpointRequestMetric(path, event);
  await appendDurableMetric(env, { kind: 'endpoint', key: path, event });
}

function getEndpointRequestMetricSummary(
  path: string,
  now: number,
  hasUpstream: boolean,
  snapshot: MetricsSnapshot | null = null,
): EndpointRequestMetricSummary {
  const sourceEvents = snapshot ? snapshot.endpointMetrics[path] || [] : getEndpointRequestMetricsState().get(path) || [];
  const events = pruneEndpointRequestEvents(sourceEvents, now);
  const totalRequests = events.length;

  const recentBuckets = Array.from({ length: ENDPOINT_METRICS_BUCKET_COUNT }, (_, index) => {
    const bucketStartMs = now - (ENDPOINT_METRICS_BUCKET_COUNT - index) * ENDPOINT_METRICS_BUCKET_MS;
    return {
      bucketStartMs,
      bucketEndMs: bucketStartMs + ENDPOINT_METRICS_BUCKET_MS,
      requests: 0,
      errors: 0,
    };
  });

  for (const event of events) {
    const bucket = recentBuckets.find((item) => event.at >= item.bucketStartMs && event.at < item.bucketEndMs);
    if (!bucket) {
      continue;
    }

    bucket.requests += 1;
    if (event.statusCode >= 400) {
      bucket.errors += 1;
    }
  }

  if (totalRequests === 0) {
    return {
      windowMs: ENDPOINT_METRICS_WINDOW_MS,
      totalRequests: 0,
      successRate: 1,
      paymentRequiredRate: 0,
      rateLimitedRate: 0,
      upstreamFallbackRate: hasUpstream ? 0 : null,
      paymentFunnel: {
        challenged402: 0,
        settled: 0,
        replayed: 0,
        challengeToReplayConversionRate: 0,
      },
      lastRequestAt: null,
      lastErrorAt: null,
      errorsByCode: [],
      requestTrend: recentBuckets.map((item) => ({
        bucketStart: new Date(item.bucketStartMs).toISOString(),
        requests: item.requests,
        errors: item.errors,
      })),
    };
  }

  const successCount = events.filter((event) => event.statusCode < 400).length;
  const paymentRequiredCount = events.filter((event) => event.statusCode === 402).length;
  const rateLimitedCount = events.filter((event) => event.statusCode === 429).length;
  const settledCount = events.filter((event) => event.paymentCode === 'PAYMENT_VALID').length;

  const challengedRequestIds = new Set(
    events
      .filter((event) => event.statusCode === 402 && event.requestId)
      .map((event) => event.requestId as string),
  );
  const replayedRequestIds = new Set(
    events
      .filter(
        (event) =>
          event.statusCode < 400 &&
          ['PAYMENT_VALID', 'DEMO_PAYMENT', 'PAYMENT_PROOF_HEADER'].includes(event.paymentCode || '') &&
          event.requestId &&
          challengedRequestIds.has(event.requestId),
      )
      .map((event) => event.requestId as string),
  );
  const replayedCount = replayedRequestIds.size;

  const upstreamFallbackCount = hasUpstream
    ? events.filter((event) => event.statusCode < 400 && event.upstreamReasonCode && event.upstreamReasonCode !== 'OK').length
    : 0;

  const errorCodeCount = new Map<string, number>();
  for (const event of events) {
    if (event.statusCode < 400) {
      continue;
    }

    const code = event.paymentCode || `HTTP_${event.statusCode}`;
    errorCodeCount.set(code, (errorCodeCount.get(code) || 0) + 1);
  }

  const errorsByCode = [...errorCodeCount.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const lastError = [...events].reverse().find((event) => event.statusCode >= 400);

  return {
    windowMs: ENDPOINT_METRICS_WINDOW_MS,
    totalRequests,
    successRate: Number((successCount / totalRequests).toFixed(4)),
    paymentRequiredRate: Number((paymentRequiredCount / totalRequests).toFixed(4)),
    rateLimitedRate: Number((rateLimitedCount / totalRequests).toFixed(4)),
    upstreamFallbackRate: hasUpstream ? Number((upstreamFallbackCount / totalRequests).toFixed(4)) : null,
    paymentFunnel: {
      challenged402: paymentRequiredCount,
      settled: settledCount,
      replayed: replayedCount,
      challengeToReplayConversionRate:
        challengedRequestIds.size > 0 ? Number((replayedCount / challengedRequestIds.size).toFixed(4)) : 0,
    },
    lastRequestAt: new Date(events[events.length - 1].at).toISOString(),
    lastErrorAt: lastError ? new Date(lastError.at).toISOString() : null,
    errorsByCode,
    requestTrend: recentBuckets.map((item) => ({
      bucketStart: new Date(item.bucketStartMs).toISOString(),
      requests: item.requests,
      errors: item.errors,
    })),
  };
}

async function getSettlementStatus(
  env: Env,
  txHash: string,
  minConfirmations: number,
  maxSettlementAgeBlocks: number,
): Promise<SettlementStatusResult> {
  const createSettlementContext = (
    receiptBlock: bigint | null,
    latestBlock: bigint | null,
    confirmations: bigint,
  ): PaymentSettlementContext => ({
    txHash,
    chainId: 8453,
    tokenContract: BASE_USDC_CONTRACT,
    settlementMethod: 'base-usdc-transfer-receipt',
    requiredConfirmations: minConfirmations,
    receiptBlock: receiptBlock === null ? null : Number(receiptBlock),
    latestBlock: latestBlock === null ? null : Number(latestBlock),
    confirmations: Number(confirmations),
  });

  let receipt: JsonRpcTransactionReceipt | null;
  try {
    receipt = (await callBaseRpc(env, 'eth_getTransactionReceipt', [txHash])) as JsonRpcTransactionReceipt | null;
  } catch {
    return {
      ok: false,
      code: 'SETTLEMENT_RPC_FAILED',
      message: 'Base RPC could not be reached for settlement status query.',
      settlement: createSettlementContext(null, null, 0n),
      receipt: null,
    };
  }

  if (!receipt || receipt.status !== '0x1') {
    return {
      ok: false,
      code: 'SETTLEMENT_NOT_FOUND',
      message: 'Transaction is not found or not successful on Base.',
      settlement: createSettlementContext(parseHexBlockNumber(receipt?.blockNumber), null, 0n),
      receipt: receipt || null,
    };
  }

  const receiptBlock = parseHexBlockNumber(receipt.blockNumber);
  if (receiptBlock === null) {
    return {
      ok: false,
      code: 'SETTLEMENT_PENDING',
      message: 'Transaction receipt block is not available yet.',
      settlement: createSettlementContext(null, null, 0n),
      receipt,
    };
  }

  let latestBlock: bigint;
  try {
    const latestBlockHex = await callBaseRpc(env, 'eth_blockNumber', []);
    const parsedLatestBlock = parseHexBlockNumber(latestBlockHex);
    if (parsedLatestBlock === null) {
      throw new Error('invalid block number');
    }
    latestBlock = parsedLatestBlock;
  } catch {
    return {
      ok: false,
      code: 'SETTLEMENT_RPC_FAILED',
      message: 'Base RPC could not be reached for latest block query.',
      settlement: createSettlementContext(receiptBlock, null, 0n),
      receipt,
    };
  }

  const confirmations = latestBlock >= receiptBlock ? latestBlock - receiptBlock + 1n : 0n;
  const txAgeBlocks = latestBlock >= receiptBlock ? latestBlock - receiptBlock : 0n;
  const settlement = createSettlementContext(receiptBlock, latestBlock, confirmations);

  if (txAgeBlocks > BigInt(maxSettlementAgeBlocks)) {
    return {
      ok: false,
      code: 'SETTLEMENT_TOO_OLD',
      message: `Settlement proof is older than ${maxSettlementAgeBlocks.toString()} blocks.`,
      settlement,
      receipt,
    };
  }

  if (confirmations < BigInt(minConfirmations)) {
    return {
      ok: false,
      code: 'SETTLEMENT_PENDING',
      message: `Settlement has ${confirmations.toString()} confirmations and needs ${minConfirmations.toString()}.`,
      settlement,
      receipt,
    };
  }

  return {
    ok: true,
    code: 'SETTLEMENT_READY',
    message: 'Settlement confirmation requirement is satisfied.',
    settlement,
    receipt,
  };
}


export async function createCatalog(
  baseUrl: string,
  payTo: string,
  env: Env,
  minConfirmations = DEFAULT_PAYMENT_MIN_CONFIRMATIONS,
  maxAgeSeconds = DEFAULT_PAYMENT_MAX_AGE_SECONDS,
  futureSkewSeconds = DEFAULT_PAYMENT_MAX_FUTURE_SKEW_SECONDS,
  maxSettlementAgeBlocks = DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
) {
  const remediationRefs = buildRemediationRefs(baseUrl);
  const snapshot = await getDurableMetricsSnapshot(env, Date.now());

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
      acceptedHeaders: ['Authorization', 'PAYMENT-SIGNATURE', PAYMENT_TX_HASH_HEADER, 'X-Payment-Proof', REQUEST_ID_HEADER],
      settlementProofHeader: PAYMENT_TX_HASH_HEADER,
      settlementMethod: 'base-usdc-transfer-receipt',
      settlementConfirmationsRequired: minConfirmations,
      maxSettlementAgeBlocks,
      settlementPolicy: buildSettlementPolicy(minConfirmations, maxSettlementAgeBlocks),
      remediationSchemaVersion: REMEDIATION_SCHEMA_VERSION,
      remediationCompatibility: REMEDIATION_COMPATIBILITY,
      remediationRefs,
      maxPaymentAgeSeconds: maxAgeSeconds,
      maxFutureSkewSeconds: futureSkewSeconds,
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
    endpoints: API_ENDPOINTS.map((endpoint) => getCatalogEndpoint(baseUrl, payTo, endpoint, snapshot)),
  };
}

function createPaymentRequired(
  baseUrl: string,
  payTo: string,
  endpoint: APIEndpoint,
  verification: PaymentVerificationResult,
  minConfirmations: number,
  maxAgeSeconds: number,
  futureSkewSeconds: number,
  maxSettlementAgeBlocks: number,
  requestId: string,
): Response {
  const settlementPolicy = buildSettlementPolicy(
    minConfirmations,
    maxSettlementAgeBlocks,
    verification.settlement,
  );

  const responseHeaders: Record<string, string> = {
    'X-Payment-Required': 'true',
    'X-Pay-To': payTo,
    'X-Price': endpoint.price,
    'X-Currency': 'USDC',
    'X-Chain': 'base',
    'X-Scheme': 'exact',
    'X-Payment-Reason': verification.code,
    [REQUEST_ID_HEADER]: requestId,
  };

  if (verification.code === 'PAYMENT_TX_NOT_CONFIRMED') {
    responseHeaders['Retry-After'] = settlementPolicy.recommendedRetryAfterSeconds.toString();
  }

  const remediationHint = PAYMENT_REMEDIATION_MAP[verification.code];
  const remediation = remediationHint
    ? buildRemediation(remediationHint, verification.code === 'PAYMENT_TX_NOT_CONFIRMED' ? settlementPolicy : undefined)
    : null;
  const remediationRefs = buildRemediationRefs(baseUrl);

  return apiResponse(
    {
      code: 'PAYMENT_REQUIRED',
      reason: verification.code,
      message: verification.message,
      requestId,
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
      acceptedHeaders: ['Authorization', 'PAYMENT-SIGNATURE', PAYMENT_TX_HASH_HEADER, 'X-Payment-Proof', REQUEST_ID_HEADER],
      settlementProofHeader: PAYMENT_TX_HASH_HEADER,
      settlementConfirmationsRequired: minConfirmations,
      maxSettlementAgeBlocks,
      settlementPolicy,
      maxPaymentAgeSeconds: maxAgeSeconds,
      maxFutureSkewSeconds: futureSkewSeconds,
      settlement: verification.settlement || null,
      remediation,
      remediationSchemaVersion: REMEDIATION_SCHEMA_VERSION,
      remediationCompatibility: REMEDIATION_COMPATIBILITY,
      remediationRefs,
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
        `Wait for at least ${minConfirmations} Base block confirmations before replaying.`,
        `Use a recent transaction proof (<= ${maxSettlementAgeBlocks} blocks old).`,
        `Set issuedAt close to current time (<= ${futureSkewSeconds}s future skew, <= ${maxAgeSeconds}s max age).`,
        'Build a payment payload for the requested resource.',
        'Sign the canonical JSON string of the payload without the signature field.',
        'Replay the request with Authorization or PAYMENT-SIGNATURE.',
      ],
      x402Spec: 'https://x402.org',
    },
    {
      status: 402,
      headers: responseHeaders,
    },
  );
}

async function createSettlementStatusResponse(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const remediationRefs = buildRemediationRefs(url.origin);
  const txHash = decodeURIComponent(url.pathname.slice(SETTLEMENT_PATH_PREFIX.length));
  const minConfirmations = parseMinConfirmations(env.PAYMENT_MIN_CONFIRMATIONS);
  const maxSettlementAgeBlocks = parsePositiveInt(
    env.PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
    DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
  );
  const payTo = env.PAY_TO || DEFAULT_PAY_TO;
  const requestId = getRequestId(request);

  if (!isTransactionHash(txHash)) {
    return apiResponse(
      {
        code: 'INVALID_TX_HASH',
        message: 'Settlement query requires a valid 32-byte transaction hash.',
      },
      { status: 400 },
    );
  }

  const statusResult = await getSettlementStatus(env, txHash, minConfirmations, maxSettlementAgeBlocks);
  const settlementPolicy = buildSettlementPolicy(minConfirmations, maxSettlementAgeBlocks, statusResult.settlement);
  const statusCode = statusResult.code === 'SETTLEMENT_RPC_FAILED' ? 503 : statusResult.ok ? 200 : 409;
  const headers: Record<string, string> = {
    'X-Settlement-Status': statusResult.code,
    [REQUEST_ID_HEADER]: requestId,
  };

  if (statusResult.code === 'SETTLEMENT_PENDING') {
    headers['Retry-After'] = settlementPolicy.recommendedRetryAfterSeconds.toString();
  }

  const remediation = buildRemediation(SETTLEMENT_REMEDIATION_MAP[statusResult.code], settlementPolicy);

  const proofHeader = request.headers.get('PAYMENT-SIGNATURE');
  const payerFilter = url.searchParams.get('payer')?.toLowerCase() || null;
  const resourceFilter = url.searchParams.get('resource') || null;
  const payToFilterRaw = url.searchParams.get('payTo');
  const payToFilter = payToFilterRaw ? payToFilterRaw.toLowerCase() : null;
  const minAmountFilterRaw = url.searchParams.get('minAmount');
  const minAmountFilter = minAmountFilterRaw ? parseTokenAmount(minAmountFilterRaw, 6) : null;
  const expectedPayTo = payToFilter || payTo.toLowerCase();
  let settlementProof: Record<string, unknown> | null = null;

  if (payToFilter && !isHexAddress(payToFilter)) {
    return apiResponse(
      {
        code: 'INVALID_SETTLEMENT_FILTER',
        message: 'payTo filter must be a valid 20-byte hex address.',
      },
      { status: 400 },
    );
  }

  if (minAmountFilterRaw && minAmountFilter === null) {
    return apiResponse(
      {
        code: 'INVALID_SETTLEMENT_FILTER',
        message: 'minAmount filter must be a valid USDC decimal string.',
      },
      { status: 400 },
    );
  }

  if (proofHeader) {
    const proofPayload = decodeBase64Json(proofHeader);
    if (!isPaymentPayload(proofPayload)) {
      return apiResponse(
        {
          code: 'SETTLEMENT_PROOF_INVALID',
          message: 'PAYMENT-SIGNATURE proof must be a valid base64 encoded payment payload.',
        },
        { status: 400 },
      );
    }

    try {
      const canonicalMessage = buildPaymentMessage(proofPayload);
      const recovered = verifyMessage(JSON.stringify(canonicalMessage), proofPayload.signature);
      if (recovered.toLowerCase() !== proofPayload.from.toLowerCase()) {
        return apiResponse(
          {
            code: 'SETTLEMENT_PROOF_INVALID',
            message: 'Settlement proof signature does not match the payer address.',
          },
          { status: 400 },
        );
      }
    } catch {
      return apiResponse(
        {
          code: 'SETTLEMENT_PROOF_INVALID',
          message: 'Settlement proof signature verification failed.',
        },
        { status: 400 },
      );
    }

    if (proofPayload.payTo.toLowerCase() !== expectedPayTo) {
      return apiResponse(
        {
          code: 'SETTLEMENT_PROOF_MISMATCH',
          message: 'Settlement proof payTo does not match the requested payTo filter.',
        },
        { status: 409 },
      );
    }

    if (payerFilter && proofPayload.from.toLowerCase() !== payerFilter) {
      return apiResponse(
        {
          code: 'SETTLEMENT_PROOF_MISMATCH',
          message: 'Settlement proof payer does not match the requested payer filter.',
        },
        { status: 409 },
      );
    }

    if (resourceFilter && proofPayload.resource !== resourceFilter) {
      return apiResponse(
        {
          code: 'SETTLEMENT_PROOF_MISMATCH',
          message: 'Settlement proof resource does not match the requested resource filter.',
        },
        { status: 409 },
      );
    }

    const minimumAmount = parseTokenAmount(proofPayload.amount, 6);
    if (minimumAmount === null) {
      return apiResponse(
        {
          code: 'SETTLEMENT_PROOF_INVALID',
          message: 'Settlement proof amount is not a valid USDC decimal string.',
        },
        { status: 400 },
      );
    }

    const transferredAmount = findMatchingTransferAmount(statusResult.receipt, proofPayload.from, expectedPayTo);
    const amountSatisfied = transferredAmount !== null && transferredAmount >= minimumAmount;
    const minAmountSatisfied = minAmountFilter === null || (transferredAmount !== null && transferredAmount >= minAmountFilter);

    settlementProof = {
      verified: amountSatisfied && minAmountSatisfied,
      payer: proofPayload.from,
      resource: proofPayload.resource,
      payTo: expectedPayTo,
      requestedAmount: proofPayload.amount,
      minAmountFilter: minAmountFilterRaw,
      transferredAmount: transferredAmount === null ? null : transferredAmount.toString(),
    };

    if (!amountSatisfied || !minAmountSatisfied) {
      return apiResponse(
        {
          code: 'SETTLEMENT_PROOF_MISMATCH',
          message: 'Settlement transaction does not include a matching Base USDC transfer for this proof.',
          requestId,
          txHash,
          settlement: statusResult.settlement,
          settlementPolicy,
          remediation,
          remediationRefs,
          settlementProof,
          settlementEndpoint: `${url.origin}${SETTLEMENT_PATH_PREFIX}${txHash}`,
        },
        { status: 409, headers },
      );
    }
  }

  if (!proofHeader && (payToFilter || minAmountFilter !== null)) {
    const transferredAmount = findLargestTransferAmountTo(statusResult.receipt, expectedPayTo);
    const amountSatisfied = minAmountFilter === null || (transferredAmount !== null && transferredAmount >= minAmountFilter);

    settlementProof = {
      verified: amountSatisfied,
      payTo: expectedPayTo,
      minAmountFilter: minAmountFilterRaw,
      transferredAmount: transferredAmount === null ? null : transferredAmount.toString(),
      mode: 'receipt-log-filter',
    };

    if (!amountSatisfied) {
      return apiResponse(
        {
          code: 'SETTLEMENT_PROOF_MISMATCH',
          message: 'Settlement transaction does not satisfy the requested payTo/minAmount filters.',
          requestId,
          txHash,
          settlement: statusResult.settlement,
          settlementPolicy,
          remediation,
          remediationRefs,
          settlementProof,
          settlementEndpoint: `${url.origin}${SETTLEMENT_PATH_PREFIX}${txHash}`,
        },
        { status: 409, headers },
      );
    }
  }

  return apiResponse(
    {
      code: statusResult.code,
      message: statusResult.message,
      requestId,
      txHash,
      settlement: statusResult.settlement,
      settlementPolicy,
      remediation,
      remediationSchemaVersion: REMEDIATION_SCHEMA_VERSION,
      remediationCompatibility: REMEDIATION_COMPATIBILITY,
      remediationRefs,
      settlementProof,
      settlementEndpoint: `${url.origin}${SETTLEMENT_PATH_PREFIX}${txHash}`,
    },
    { status: statusCode, headers },
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
  const maxPaymentAgeSeconds = parsePositiveInt(env.PAYMENT_MAX_AGE_SECONDS, DEFAULT_PAYMENT_MAX_AGE_SECONDS);
  const maxFutureSkewSeconds = parsePositiveInt(
    env.PAYMENT_MAX_FUTURE_SKEW_SECONDS,
    DEFAULT_PAYMENT_MAX_FUTURE_SKEW_SECONDS,
  );
  const maxPaymentAgeMs = maxPaymentAgeSeconds * 1000;
  const maxFutureSkewMs = maxFutureSkewSeconds * 1000;

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

  const issuedAt = Date.parse(rawPayload.issuedAt);
  if (!Number.isFinite(issuedAt)) {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_PAYLOAD',
      message: 'Payment payload issuedAt is invalid.',
    };
  }

  if (issuedAt > now + maxFutureSkewMs) {
    return {
      ok: false,
      code: 'PAYMENT_ISSUED_AT_IN_FUTURE',
      message: `Payment payload issuedAt is too far in the future. Maximum allowed skew is ${maxFutureSkewSeconds.toString()} seconds.`,
    };
  }

  if (now - issuedAt > maxPaymentAgeMs) {
    return {
      ok: false,
      code: 'PAYMENT_STALE',
      message: `Payment payload is too old. Maximum age is ${maxPaymentAgeSeconds.toString()} seconds.`,
    };
  }

  if (deadline - issuedAt > maxPaymentAgeMs) {
    return {
      ok: false,
      code: 'PAYMENT_DEADLINE_TOO_FAR',
      message: `Payment payload deadline window is too long. Maximum window is ${maxPaymentAgeSeconds.toString()} seconds.`,
    };
  }

  if (!rawPayload.nonce.trim() || !rawPayload.issuedAt.trim()) {
    return {
      ok: false,
      code: 'INVALID_PAYMENT_PAYLOAD',
      message: 'Payment payload nonce and issuedAt are required.',
    };
  }

  const nonceKey = buildNonceKey(rawPayload);
  sweepExpiredNonces(now);
  sweepExpiredTransactions(now);

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

  try {
    const replayResult = await consumeReplayKeys(
      env,
      [
        { kind: 'nonce', value: nonceKey },
        { kind: 'tx', value: txHash },
      ],
      deadline,
      now,
    );

    if (!replayResult.consumed) {
      return {
        ok: false,
        code: replayResult.replayedKey?.startsWith('nonce:') ? 'PAYMENT_NONCE_REPLAYED' : 'PAYMENT_TX_REPLAYED',
        message:
          replayResult.replayedKey?.startsWith('nonce:')
            ? 'Payment payload nonce has already been used.'
            : 'Payment transaction hash has already been used for a request.',
      };
    }
  } catch {
    return {
      ok: false,
      code: 'PAYMENT_SETTLEMENT_RPC_FAILED',
      message: 'Replay protection storage could not be reached.',
    };
  }

  return {
    ok: true,
    code: 'PAYMENT_VALID',
    message: 'Payment payload verified successfully.',
    settlement: settlementVerification.settlement,
  };
}

type UpstreamErrorCode =
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_HTTP_ERROR'
  | 'UPSTREAM_INVALID_RESPONSE'
  | 'UPSTREAM_FETCH_FAILED'
  | 'UPSTREAM_CIRCUIT_OPEN';

type UpstreamFailure = {
  code: UpstreamErrorCode;
  message: string;
  retryable: boolean;
};

type UpstreamTelemetryEvent = {
  at: number;
  ok: boolean;
  latencyMs: number;
  code: 'OK' | UpstreamErrorCode;
};

type UpstreamTelemetrySummary = {
  windowMs: number;
  sampleSize: number;
  successRate: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorCode: UpstreamErrorCode | null;
  updatedAt: string | null;
};

type UpstreamMeta = {
  source: string;
  status: 'live' | 'fallback';
  reasonCode: 'OK' | UpstreamErrorCode;
  retryable: boolean;
};

type UpstreamResult = {
  data: unknown | null;
  meta: UpstreamMeta;
};

type EndpointRequestMetricEvent = {
  at: number;
  statusCode: number;
  requestId: string | null;
  paymentCode: PaymentVerificationResult['code'] | 'RATE_LIMIT' | null;
  upstreamReasonCode: UpstreamMeta['reasonCode'] | null;
};

type EndpointRequestMetricSummary = {
  windowMs: number;
  totalRequests: number;
  successRate: number;
  paymentRequiredRate: number;
  rateLimitedRate: number;
  upstreamFallbackRate: number | null;
  paymentFunnel: {
    challenged402: number;
    settled: number;
    replayed: number;
    challengeToReplayConversionRate: number;
  };
  lastRequestAt: string | null;
  lastErrorAt: string | null;
  errorsByCode: Array<{ code: string; count: number }>;
  requestTrend: Array<{ bucketStart: string; requests: number; errors: number }>;
};

type MetricsSnapshot = {
  upstreamTelemetry: Record<string, UpstreamTelemetryEvent[]>;
  endpointMetrics: Record<string, EndpointRequestMetricEvent[]>;
};

type FunnelWindow = '24h' | '7d';

type EndpointFunnelSummary = {
  path: string;
  challenged402: number;
  settled: number;
  replayed: number;
  challengeToReplayConversionRate: number;
};

type FunnelSummary = {
  window: FunnelWindow;
  from: string;
  to: string;
  endpoints: EndpointFunnelSummary[];
};

async function appendDurableMetric(
  env: Env,
  payload:
    | { kind: 'upstream'; key: string; event: UpstreamTelemetryEvent }
    | { kind: 'endpoint'; key: string; event: EndpointRequestMetricEvent },
): Promise<void> {
  if (!env.METRICS_STORE) {
    return;
  }

  try {
    const stub = env.METRICS_STORE.get(env.METRICS_STORE.idFromName('global'));
    const response = await stub.fetch('https://metrics-store/append', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`metrics store ${response.status}`);
    }
  } catch (error) {
    console.error('metrics store append failed', error);
  }
}

async function getDurableMetricsSnapshot(env: Env, now: number): Promise<MetricsSnapshot | null> {
  if (!env.METRICS_STORE) {
    return null;
  }

  try {
    const stub = env.METRICS_STORE.get(env.METRICS_STORE.idFromName('global'));
    const response = await stub.fetch('https://metrics-store/snapshot', {
      method: 'POST',
      body: JSON.stringify({ now }),
    });

    if (!response.ok) {
      throw new Error(`metrics store ${response.status}`);
    }

    return (await response.json()) as MetricsSnapshot;
  } catch (error) {
    console.error('metrics store snapshot failed', error);
    return null;
  }
}

async function getDurableFunnelSummary(
  env: Env,
  now: number,
  window: FunnelWindow,
): Promise<FunnelSummary | null> {
  if (!env.METRICS_STORE) {
    return null;
  }

  try {
    const stub = env.METRICS_STORE.get(env.METRICS_STORE.idFromName('global'));
    const response = await stub.fetch('https://metrics-store/funnel', {
      method: 'POST',
      body: JSON.stringify({ now, window }),
    });

    if (!response.ok) {
      throw new Error(`metrics store ${response.status}`);
    }

    return (await response.json()) as FunnelSummary;
  } catch (error) {
    console.error('metrics store funnel failed', error);
    return null;
  }
}

function getInMemoryFunnelSummary(now: number, window: FunnelWindow): FunnelSummary {
  const endpointMetrics: Record<string, EndpointRequestMetricEvent[]> = {};
  for (const [path, events] of getEndpointRequestMetricsState().entries()) {
    endpointMetrics[path] = events;
  }

  return summarizeFunnelFromEndpointMetrics(endpointMetrics, window, now);
}

type EndpointFreshness = {
  status: 'fresh' | 'stale' | 'unknown';
  ageSeconds: number | null;
  maxAgeSeconds: number;
  signal: 'upstream_telemetry' | 'request_metrics' | 'none';
};

const ENDPOINT_FRESHNESS_MAX_AGE_SECONDS = 15 * 60;

function computeEndpointFreshness(
  now: number,
  requestMetrics: EndpointRequestMetricSummary,
  upstreamTelemetry: UpstreamTelemetrySummary | null,
): { lastUpdatedAt: string | null; freshness: EndpointFreshness } {
  const signalAt = upstreamTelemetry?.updatedAt || requestMetrics.lastRequestAt;
  if (!signalAt) {
    return {
      lastUpdatedAt: null,
      freshness: {
        status: 'unknown',
        ageSeconds: null,
        maxAgeSeconds: ENDPOINT_FRESHNESS_MAX_AGE_SECONDS,
        signal: 'none',
      },
    };
  }

  const updatedAtMs = Date.parse(signalAt);
  if (Number.isNaN(updatedAtMs)) {
    return {
      lastUpdatedAt: null,
      freshness: {
        status: 'unknown',
        ageSeconds: null,
        maxAgeSeconds: ENDPOINT_FRESHNESS_MAX_AGE_SECONDS,
        signal: 'none',
      },
    };
  }

  const ageSeconds = Math.max(0, Math.floor((now - updatedAtMs) / 1000));
  return {
    lastUpdatedAt: new Date(updatedAtMs).toISOString(),
    freshness: {
      status: ageSeconds <= ENDPOINT_FRESHNESS_MAX_AGE_SECONDS ? 'fresh' : 'stale',
      ageSeconds,
      maxAgeSeconds: ENDPOINT_FRESHNESS_MAX_AGE_SECONDS,
      signal: upstreamTelemetry?.updatedAt ? 'upstream_telemetry' : 'request_metrics',
    },
  };
}

function getUpstreamCircuitState(): Map<string, { failures: number; openUntil: number; lastErrorCode?: string }> {
  if (!globalThis.upstreamCircuitState) {
    globalThis.upstreamCircuitState = new Map();
  }

  return globalThis.upstreamCircuitState;
}

function getUpstreamTelemetryState(): Map<string, UpstreamTelemetryEvent[]> {
  if (!globalThis.upstreamTelemetryState) {
    globalThis.upstreamTelemetryState = new Map();
  }

  return globalThis.upstreamTelemetryState;
}

function pruneTelemetryEvents(events: UpstreamTelemetryEvent[], now: number): UpstreamTelemetryEvent[] {
  const windowStart = now - UPSTREAM_TELEMETRY_WINDOW_MS;
  const inWindow = events.filter((event) => event.at >= windowStart);
  return inWindow.slice(-UPSTREAM_TELEMETRY_MAX_EVENTS);
}

function recordUpstreamTelemetry(source: string, event: UpstreamTelemetryEvent): void {
  const store = getUpstreamTelemetryState();
  const existing = store.get(source) || [];
  const next = pruneTelemetryEvents([...existing, event], event.at);
  store.set(source, next);
}

async function recordUpstreamTelemetryWithDurable(
  env: Env,
  source: string,
  event: UpstreamTelemetryEvent,
): Promise<void> {
  recordUpstreamTelemetry(source, event);
  await appendDurableMetric(env, { kind: 'upstream', key: source, event });
}

function getUpstreamTelemetrySummary(
  source: string,
  now: number,
  snapshot: MetricsSnapshot | null = null,
): UpstreamTelemetrySummary {
  const sourceEvents = snapshot ? snapshot.upstreamTelemetry[source] || [] : getUpstreamTelemetryState().get(source) || [];
  const events = pruneTelemetryEvents(sourceEvents, now);
  const sampleSize = events.length;

  if (sampleSize === 0) {
    return {
      windowMs: UPSTREAM_TELEMETRY_WINDOW_MS,
      sampleSize: 0,
      successRate: 1,
      avgLatencyMs: null,
      p95LatencyMs: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastErrorCode: null,
      updatedAt: null,
    };
  }

  const successEvents = events.filter((event) => event.ok);
  const successRate = Number((successEvents.length / sampleSize).toFixed(4));
  const avgLatencyMs = Math.round(events.reduce((sum, event) => sum + event.latencyMs, 0) / sampleSize);
  const sortedLatency = [...events].map((event) => event.latencyMs).sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(sortedLatency.length * 0.95) - 1);
  const p95LatencyMs = sortedLatency[p95Index] ?? null;

  const lastSuccess = [...successEvents].sort((a, b) => b.at - a.at)[0];
  const failureEvents = events.filter((event) => !event.ok);
  const lastFailure = [...failureEvents].sort((a, b) => b.at - a.at)[0];

  return {
    windowMs: UPSTREAM_TELEMETRY_WINDOW_MS,
    sampleSize,
    successRate,
    avgLatencyMs,
    p95LatencyMs,
    lastSuccessAt: lastSuccess ? new Date(lastSuccess.at).toISOString() : null,
    lastFailureAt: lastFailure ? new Date(lastFailure.at).toISOString() : null,
    lastErrorCode: lastFailure && lastFailure.code !== 'OK' ? lastFailure.code : null,
    updatedAt: new Date(events[events.length - 1].at).toISOString(),
  };
}

function getUpstreamCircuitSnapshot(source: string, now: number): { open: boolean; openUntil: number } {
  const state = getUpstreamCircuitState().get(source);
  if (!state) {
    return { open: false, openUntil: 0 };
  }

  return { open: state.openUntil > now, openUntil: state.openUntil };
}

async function recordUpstreamSuccess(env: Env, source: string, now: number, latencyMs: number): Promise<void> {
  const store = getUpstreamCircuitState();
  store.set(source, { failures: 0, openUntil: 0 });
  await recordUpstreamTelemetryWithDurable(env, source, { at: now, ok: true, latencyMs, code: 'OK' });
}

async function recordUpstreamFailure(
  env: Env,
  source: string,
  code: UpstreamErrorCode,
  now: number,
  latencyMs: number,
): Promise<void> {
  const store = getUpstreamCircuitState();
  const state = store.get(source) || { failures: 0, openUntil: 0 };
  const failures = state.failures + 1;
  const openUntil = failures >= UPSTREAM_FAILURE_THRESHOLD ? now + UPSTREAM_CIRCUIT_COOLDOWN_MS : state.openUntil;

  store.set(source, {
    failures,
    openUntil,
    lastErrorCode: code,
  });
  await recordUpstreamTelemetryWithDurable(env, source, { at: now, ok: false, latencyMs, code });
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs = UPSTREAM_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw {
        code: 'UPSTREAM_HTTP_ERROR',
        message: `upstream ${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      } as UpstreamFailure;
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw {
        code: 'UPSTREAM_TIMEOUT',
        message: 'upstream timeout',
        retryable: true,
      } as UpstreamFailure;
    }

    throw {
      code: 'UPSTREAM_FETCH_FAILED',
      message: error instanceof Error ? error.message : 'unknown upstream error',
      retryable: true,
    } as UpstreamFailure;
  } finally {
    clearTimeout(timeout);
  }
}

type HyperliquidTrade = {
  coin?: string;
  side?: string;
  px?: string;
  sz?: string;
  time?: number;
  users?: string[];
};

async function fetchHyperliquidRecentTrades(coin: string): Promise<HyperliquidTrade[]> {
  const payload = await fetchJsonWithTimeout('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recentTrades', coin }),
  });

  return Array.isArray(payload) ? (payload as HyperliquidTrade[]) : [];
}

async function fetchUpstreamData(path: string, env: Env): Promise<UpstreamResult> {
  const sourceByPath: Record<string, string | undefined> = {
    '/api/btc-price': 'binance',
    '/api/eth-price': 'binance',
    '/api/whale-positions': 'hyperliquid',
    '/api/kline': 'binance',
  };

  const source = sourceByPath[path];
  if (!source) {
    return {
      data: null,
      meta: { source: 'none', status: 'fallback', reasonCode: 'UPSTREAM_INVALID_RESPONSE', retryable: false },
    };
  }

  const now = Date.now();
  const circuit = getUpstreamCircuitSnapshot(source, now);
  if (circuit.open) {
    await recordUpstreamTelemetryWithDurable(env, source, {
      at: now,
      ok: false,
      latencyMs: 0,
      code: 'UPSTREAM_CIRCUIT_OPEN',
    });
    return {
      data: null,
      meta: { source, status: 'fallback', reasonCode: 'UPSTREAM_CIRCUIT_OPEN', retryable: true },
    };
  }

  const startedAt = Date.now();

  try {
    if (path === '/api/btc-price') {
      const data = (await fetchJsonWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', {
        method: 'GET',
      })) as { price?: string };

      if (!data.price) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing price', retryable: true } as UpstreamFailure;
      }

      await recordUpstreamSuccess(env, source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          symbol: 'BTC',
          price: Number(data.price),
          timestamp: Date.now(),
          source: 'binance',
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/eth-price') {
      const data = (await fetchJsonWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', {
        method: 'GET',
      })) as { price?: string };

      if (!data.price) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing price', retryable: true } as UpstreamFailure;
      }

      await recordUpstreamSuccess(env, source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          symbol: 'ETH',
          price: Number(data.price),
          timestamp: Date.now(),
          source: 'binance',
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/whale-positions') {
      const [btcTrades, ethTrades] = await Promise.all([
        fetchHyperliquidRecentTrades('BTC'),
        fetchHyperliquidRecentTrades('ETH'),
      ]);

      const trades = [...btcTrades, ...ethTrades];
      const byAddress = new Map<
        string,
        {
          address: string;
          trades: number;
          notionalUsd: number;
          buyNotionalUsd: number;
          sellNotionalUsd: number;
          lastSeen: number;
          markets: Set<string>;
        }
      >();

      for (const trade of trades) {
        const users = Array.isArray(trade.users) ? trade.users : [];
        const maker = users[0]?.toLowerCase();
        if (!maker || !/^0x[0-9a-f]{40}$/.test(maker)) {
          continue;
        }

        const px = Number(trade.px);
        const sz = Number(trade.sz);
        if (!Number.isFinite(px) || !Number.isFinite(sz)) {
          continue;
        }

        const notionalUsd = Math.abs(px * sz);
        if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) {
          continue;
        }

        const position = byAddress.get(maker) || {
          address: maker,
          trades: 0,
          notionalUsd: 0,
          buyNotionalUsd: 0,
          sellNotionalUsd: 0,
          lastSeen: 0,
          markets: new Set<string>(),
        };

        position.trades += 1;
        position.notionalUsd += notionalUsd;
        if (trade.side === 'A') {
          position.buyNotionalUsd += notionalUsd;
        } else {
          position.sellNotionalUsd += notionalUsd;
        }
        position.lastSeen = Math.max(position.lastSeen, Number(trade.time) || 0);
        if (trade.coin) {
          position.markets.add(trade.coin);
        }

        byAddress.set(maker, position);
      }

      const positions = [...byAddress.values()]
        .sort((a, b) => b.notionalUsd - a.notionalUsd)
        .slice(0, 10)
        .map((entry) => ({
          address: entry.address,
          trades: entry.trades,
          notionalUsd: Number(entry.notionalUsd.toFixed(2)),
          dominantSide: entry.buyNotionalUsd >= entry.sellNotionalUsd ? 'buy' : 'sell',
          markets: [...entry.markets].sort(),
          lastSeen: entry.lastSeen || null,
        }));

      if (positions.length === 0) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'no positions', retryable: true } as UpstreamFailure;
      }

      await recordUpstreamSuccess(env, source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'hyperliquid',
          timeframe: 'recent',
          markets: ['BTC', 'ETH'],
          sampledTrades: trades.length,
          positions,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/kline') {
      const data = (await fetchJsonWithTimeout(
        'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=6',
        { method: 'GET' },
      )) as Array<[number, string, string, string, string, string, number, string, number, string, string, string]>;

      if (!Array.isArray(data) || data.length === 0) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing candles', retryable: true } as UpstreamFailure;
      }

      await recordUpstreamSuccess(env, source, Date.now(), Date.now() - startedAt);
      return {
        data: {
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
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'unsupported path', retryable: false } as UpstreamFailure;
  } catch (error) {
    const failure = (error || { code: 'UPSTREAM_FETCH_FAILED', message: 'unknown upstream error', retryable: true }) as UpstreamFailure;
    await recordUpstreamFailure(env, source, failure.code || 'UPSTREAM_FETCH_FAILED', Date.now(), Date.now() - startedAt);
    console.error('Upstream fetch failed:', source, failure.code, failure.message);

    return {
      data: null,
      meta: {
        source,
        status: 'fallback',
        reasonCode: failure.code || 'UPSTREAM_FETCH_FAILED',
        retryable: failure.retryable ?? true,
      },
    };
  }
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

    if (path === FUNNEL_METRICS_PATH) {
      const now = Date.now();
      const window = url.searchParams.get('window') === '7d' ? '7d' : '24h';
      const durableSummary = await getDurableFunnelSummary(env, now, window);
      const summary = durableSummary || getInMemoryFunnelSummary(now, window);
      return apiResponse(summary);
    }

    if (path === CATALOG_PATH) {
      const minConfirmations = parseMinConfirmations(env.PAYMENT_MIN_CONFIRMATIONS);
      const maxAgeSeconds = parsePositiveInt(env.PAYMENT_MAX_AGE_SECONDS, DEFAULT_PAYMENT_MAX_AGE_SECONDS);
      const maxFutureSkewSeconds = parsePositiveInt(
        env.PAYMENT_MAX_FUTURE_SKEW_SECONDS,
        DEFAULT_PAYMENT_MAX_FUTURE_SKEW_SECONDS,
      );
      const maxSettlementAgeBlocks = parsePositiveInt(
        env.PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
        DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
      );

      const catalog = await createCatalog(
        origin,
        payTo,
        env,
        minConfirmations,
        maxAgeSeconds,
        maxFutureSkewSeconds,
        maxSettlementAgeBlocks,
      ) as Awaited<ReturnType<typeof createCatalog>> & { payment: Record<string, unknown> };
      catalog.payment.settlementStatusEndpointTemplate = `${origin}${SETTLEMENT_PATH_PREFIX}{txHash}`;
      catalog.payment.settlementStatusProofHeaders = ['PAYMENT-SIGNATURE'];
      catalog.payment.settlementStatusFilters = ['payer', 'resource', 'payTo', 'minAmount'];
      catalog.payment.settlementStatusRemediation = SETTLEMENT_REMEDIATION_MAP;
      catalog.payment.paymentReasonRemediation = PAYMENT_REMEDIATION_MAP;
      catalog.payment.requestFunnelEndpoint = `${origin}${FUNNEL_METRICS_PATH}`;
      catalog.payment.requestFunnelSupportedWindows = ['24h', '7d'];
      catalog.payment.remediationSchemaVersion = REMEDIATION_SCHEMA_VERSION;
      catalog.payment.remediationCompatibility = REMEDIATION_COMPATIBILITY;

      return apiResponse(catalog);
    }

    if (path.startsWith(SETTLEMENT_PATH_PREFIX)) {
      return createSettlementStatusResponse(request, env);
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
      const now = Date.now();
      const requestId = getRequestId(request);
      const rateLimitResponse = enforceRateLimit(request);
      if (rateLimitResponse) {
        const limitedHeaders = new Headers(rateLimitResponse.headers);
        limitedHeaders.set(REQUEST_ID_HEADER, requestId);
        await recordEndpointRequestMetricWithDurable(env, path, {
          at: now,
          statusCode: 429,
          requestId,
          paymentCode: 'RATE_LIMIT',
          upstreamReasonCode: null,
        });
        return new Response(rateLimitResponse.body, {
          status: rateLimitResponse.status,
          statusText: rateLimitResponse.statusText,
          headers: limitedHeaders,
        });
      }

      const verification = await verifyPayment(request, endpoint, payTo, env);
      if (!verification.ok) {
        const response = createPaymentRequired(
          origin,
          payTo,
          endpoint,
          verification,
          parseMinConfirmations(env.PAYMENT_MIN_CONFIRMATIONS),
          parsePositiveInt(env.PAYMENT_MAX_AGE_SECONDS, DEFAULT_PAYMENT_MAX_AGE_SECONDS),
          parsePositiveInt(env.PAYMENT_MAX_FUTURE_SKEW_SECONDS, DEFAULT_PAYMENT_MAX_FUTURE_SKEW_SECONDS),
          parsePositiveInt(
            env.PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
            DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
          ),
          requestId,
        );

        await recordEndpointRequestMetricWithDurable(env, path, {
          at: Date.now(),
          statusCode: response.status,
          requestId,
          paymentCode: verification.code,
          upstreamReasonCode: null,
        });
        return response;
      }

      const upstreamResult = await fetchUpstreamData(path, env);
      const baseData = (upstreamResult.data || endpoint.sample()) as Record<string, unknown>;

      const response = apiResponse(
        {
          ...baseData,
          _meta: {
            paid: true,
            paymentMode: verification.code,
            requestId,
            price: endpoint.price,
            payTo,
            category: endpoint.category.en,
            timestamp: Date.now(),
            clientIP: getClientIP(request),
            origin: upstreamResult.meta.status === 'live' ? 'proxied' : 'mock',
            upstream: upstreamResult.meta,
            settlement: verification.settlement || null,
          },
        },
        { headers: { [REQUEST_ID_HEADER]: requestId } },
      );

      await recordEndpointRequestMetricWithDurable(env, path, {
        at: Date.now(),
        statusCode: response.status,
        requestId,
        paymentCode: verification.code,
        upstreamReasonCode: upstreamResult.meta.reasonCode,
      });
      return response;
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
