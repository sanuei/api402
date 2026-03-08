/**
 * API Market x402 Payment Gateway
 *
 * A Cloudflare Worker that serves both:
 * 1. static assets for the landing page
 * 2. paid API routes protected by an x402-style payment challenge
 */

import { verifyMessage } from 'ethers';
import {
  BASE_USDC_CONTRACT,
  DEFAULT_PAY_TO,
  DEFAULT_PAYMENT_MAX_AGE_SECONDS,
  DEFAULT_PAYMENT_MAX_FUTURE_SKEW_SECONDS,
  DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
  DEFAULT_PAYMENT_MIN_CONFIRMATIONS,
  DEMO_PAYMENT_TOKEN,
  ERC20_TRANSFER_TOPIC,
  PAYMENT_REMEDIATION_MAP,
  PAYMENT_TX_HASH_HEADER,
  REMEDIATION_COMPATIBILITY,
  REMEDIATION_SCHEMA_VERSION,
  SETTLEMENT_PATH_PREFIX,
  SETTLEMENT_REMEDIATION_MAP,
  buildPaymentMessage,
  buildRemediation,
  buildRemediationRefs,
  buildSettlementPolicy,
  decodeBase64Json,
  encodeJsonBase64,
  findLargestTransferAmountTo,
  findMatchingTransferAmount,
  getPaymentTxHash,
  isHexAddress,
  isPaymentPayload,
  isTransactionHash,
  parseAmount,
  parseHexBlockNumber,
  parseMinConfirmations,
  parsePositiveInt,
  parseTokenAmount,
  type JsonRpcTransactionReceipt,
  type PaymentMessage,
  type PaymentPayload,
  type PaymentSettlementContext,
  type PaymentVerificationResult,
  type RemediationHint,
  type RemediationRefs,
  type SettlementPolicy,
  type SettlementStatusResult,
} from './payment';
import {
  AI_USAGE_WINDOW_MS,
  AI_ENDPOINT_DEFAULTS,
  type AIEndpointPath,
  DEFAULT_AI_GLOBAL_DAILY_BUDGET_USD,
  DEFAULT_AI_GLOBAL_DAILY_REQUEST_LIMIT,
  DEFAULT_OPENROUTER_API_BASE,
  DEFAULT_OPENROUTER_CLAUDE46_MODEL,
  DEFAULT_OPENROUTER_DEEPSEEK_MODEL,
  DEFAULT_OPENROUTER_GPT54_MODEL,
  DEFAULT_OPENROUTER_GPT54_PRO_MODEL,
  DEFAULT_OPENROUTER_MAX_INPUT_CHARS,
  DEFAULT_OPENROUTER_MAX_MESSAGES,
  DEFAULT_OPENROUTER_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENROUTER_QWEN_MODEL,
  DEFAULT_OPENROUTER_TEMPERATURE,
  UPSTREAM_CIRCUIT_COOLDOWN_MS,
  UPSTREAM_FAILURE_THRESHOLD,
  UPSTREAM_TELEMETRY_MAX_EVENTS,
  UPSTREAM_TELEMETRY_WINDOW_MS,
  UPSTREAM_TIMEOUT_MS,
  buildDefaultAIPrompt,
  fetchUpstreamData,
  getOpenRouterModel,
  isAIEndpointPath,
  normalizeAIMessageContent,
  type AIProfitPolicy,
  type AIQuotaCode,
  type AIRequestContext,
  type AIUsageAggregate,
  type AIUsageEvent,
  type AIUsageSummary,
  type OpenRouterChatMessage,
  type UpstreamErrorCode,
  type UpstreamMeta,
  type UpstreamTelemetryEvent,
  type UpstreamTelemetrySummary,
} from './upstreams';
import { createSettlementStatusResponse } from './settlement';
export { buildPaymentMessage } from './payment';
export type { PaymentPayload } from './payment';

export interface Env {
  PAY_TO?: string;
  APP_NAME?: string;
  BASE_RPC_URL?: string;
  BASE_RPC_URLS?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_API_BASE?: string;
  OPENROUTER_DEEPSEEK_MODEL?: string;
  OPENROUTER_QWEN_MODEL?: string;
  OPENROUTER_GPT54_MODEL?: string;
  OPENROUTER_GPT54_PRO_MODEL?: string;
  OPENROUTER_CLAUDE46_MODEL?: string;
  OPENROUTER_MAX_INPUT_CHARS?: string;
  OPENROUTER_MAX_MESSAGES?: string;
  OPENROUTER_MAX_OUTPUT_TOKENS?: string;
  AI_GLOBAL_DAILY_BUDGET_USD?: string;
  AI_DEEPSEEK_DAILY_BUDGET_USD?: string;
  AI_QWEN_DAILY_BUDGET_USD?: string;
  AI_GPT54_DAILY_BUDGET_USD?: string;
  AI_GPT54_PRO_DAILY_BUDGET_USD?: string;
  AI_CLAUDE46_DAILY_BUDGET_USD?: string;
  AI_GLOBAL_DAILY_REQUEST_LIMIT?: string;
  AI_DEEPSEEK_DAILY_REQUEST_LIMIT?: string;
  AI_QWEN_DAILY_REQUEST_LIMIT?: string;
  AI_GPT54_DAILY_REQUEST_LIMIT?: string;
  AI_GPT54_PRO_DAILY_REQUEST_LIMIT?: string;
  AI_CLAUDE46_DAILY_REQUEST_LIMIT?: string;
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
  var aiUsageState: Map<string, AIUsageEvent[]>;
  var totalApiCallState: { total: number; lastApiCallAt: number | null };
}

export interface APIEndpoint {
  path: string;
  price: string;
  method?: 'GET' | 'POST';
  label: LocalizedText;
  description: LocalizedText;
  category: LocalizedText;
  upstream?: string;
  tags: string[];
  status: 'live' | 'demo';
  sample: () => Record<string, unknown>;
}

const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org';
const BASE_RPC_TIMEOUT_MS = 6000;
const LEGACY_PRICE_PATH = '/prices';
const CATALOG_PATH = '/api/v1/catalog';
const HEALTH_PATH = '/api/v1/health';
const FUNNEL_METRICS_PATH = '/api/v1/metrics/funnel';
const OVERVIEW_METRICS_PATH = '/api/v1/metrics/overview';
const ENDPOINT_METRICS_WINDOW_MS = 60 * 60 * 1000;
const ENDPOINT_METRICS_MAX_EVENTS = 600;
const ENDPOINT_METRICS_DURABLE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ENDPOINT_METRICS_DURABLE_MAX_EVENTS = 20_000;
const ENDPOINT_METRICS_BUCKET_MS = 10 * 60 * 1000;
const ENDPOINT_METRICS_BUCKET_COUNT = 6;
const REQUEST_ID_HEADER = 'X-Request-Id';


type ReplayConsumeResult = {
  consumed: boolean;
  replayedKey?: string;
};

export const API_ENDPOINTS: APIEndpoint[] = [
  {
    path: '/api/gpt-5.4-pro',
    price: '0.12',
    method: 'POST',
    label: { zh: 'GPT-5.4 Pro 深度推理', en: 'GPT-5.4 Pro Reasoning' },
    description: {
      zh: '面向高价值深度推理任务的 GPT-5.4 Pro 按次调用入口，适合代码审查和复杂分析。',
      en: 'High-value pay-per-call access to GPT-5.4 Pro for deeper reasoning, code review, and complex analysis.',
    },
    category: { zh: '旗舰模型', en: 'Frontier Models' },
    upstream: 'openrouter',
    tags: ['ai', 'reasoning', 'gpt-5.4-pro', 'openai', 'premium'],
    status: 'live',
    sample: () => ({
      source: 'openrouter',
      model: DEFAULT_OPENROUTER_GPT54_PRO_MODEL,
      response: 'GPT-5.4 Pro is best reserved for expensive, high-confidence reasoning tasks.',
      usage: { promptTokens: 48, completionTokens: 72, totalTokens: 120 },
    }),
  },
  {
    path: '/api/claude-4.6',
    price: '0.04',
    method: 'POST',
    label: { zh: 'Claude 4.6 对话', en: 'Claude 4.6 Chat' },
    description: {
      zh: '基于 OpenRouter 的 Claude 4.6 按次调用入口，适合长上下文写作、审阅和 agent 安全说明。',
      en: 'Pay-per-call Claude 4.6 access via OpenRouter for long-context writing, review, and agent-safe explanations.',
    },
    category: { zh: '旗舰模型', en: 'Frontier Models' },
    upstream: 'openrouter',
    tags: ['ai', 'chat', 'claude-4.6', 'anthropic', 'openrouter', 'latest'],
    status: 'live',
    sample: () => ({
      source: 'openrouter',
      model: DEFAULT_OPENROUTER_CLAUDE46_MODEL,
      response: 'Claude 4.6 is useful when you want strong writing and careful instruction following without a separate subscription.',
      usage: { promptTokens: 28, completionTokens: 34, totalTokens: 62 },
    }),
  },
  {
    path: '/api/gpt-5.4',
    price: '0.03',
    method: 'POST',
    label: { zh: 'GPT-5.4 对话', en: 'GPT-5.4 Chat' },
    description: {
      zh: '基于 OpenRouter 的 GPT-5.4 按次调用入口，适合临时体验最新 OpenAI 模型。',
      en: 'Pay-per-call access to GPT-5.4 via OpenRouter for lightweight trials of the latest OpenAI model.',
    },
    category: { zh: '旗舰模型', en: 'Frontier Models' },
    upstream: 'openrouter',
    tags: ['ai', 'chat', 'gpt-5.4', 'openai', 'openrouter', 'latest'],
    status: 'live',
    sample: () => ({
      source: 'openrouter',
      model: DEFAULT_OPENROUTER_GPT54_MODEL,
      response: 'GPT-5.4 is useful when you need strong general reasoning without a monthly subscription.',
      usage: { promptTokens: 22, completionTokens: 30, totalTokens: 52 },
    }),
  },
  {
    path: '/api/deepseek',
    price: '0.003',
    method: 'POST',
    label: { zh: 'DeepSeek 对话', en: 'DeepSeek Chat' },
    description: {
      zh: '基于 OpenRouter 的 DeepSeek 实时对话接口，支持 prompt 或 messages 请求。',
      en: 'Live DeepSeek chat completions via OpenRouter with prompt or messages input.',
    },
    category: { zh: '人工智能', en: 'AI' },
    upstream: 'openrouter',
    tags: ['ai', 'chat', 'deepseek', 'openrouter', 'live'],
    status: 'live',
    sample: () => ({
      source: 'openrouter',
      model: DEFAULT_OPENROUTER_DEEPSEEK_MODEL,
      response: 'API402 lets agents pay per request on Base with USDC.',
      usage: { promptTokens: 18, completionTokens: 14, totalTokens: 32 },
    }),
  },
  {
    path: '/api/qwen',
    price: '0.01',
    method: 'POST',
    label: { zh: 'Qwen 对话', en: 'Qwen Chat' },
    description: {
      zh: '基于 OpenRouter 的 Qwen 实时对话接口，支持 prompt 或 messages 请求。',
      en: 'Live Qwen chat completions via OpenRouter with prompt or messages input.',
    },
    category: { zh: '人工智能', en: 'AI' },
    upstream: 'openrouter',
    tags: ['ai', 'chat', 'qwen', 'openrouter', 'live'],
    status: 'live',
    sample: () => ({
      source: 'openrouter',
      model: DEFAULT_OPENROUTER_QWEN_MODEL,
      response: 'API402 支持在 Base 上用 USDC 按次付费调用 API。',
      usage: { promptTokens: 20, completionTokens: 16, totalTokens: 36 },
    }),
  },
  {
    path: '/api/polymarket/trending',
    price: '0.003',
    label: { zh: 'Polymarket 热门市场', en: 'Polymarket Trending Markets' },
    description: {
      zh: '返回 Polymarket 当前最热门的预测市场，适合做选题、信号发现和 agent 首页流量入口。',
      en: 'Returns the hottest active Polymarket prediction markets for discovery, trend monitoring, and agent dashboards.',
    },
    category: { zh: '预测市场', en: 'Prediction Markets' },
    upstream: 'polymarket',
    tags: ['polymarket', 'prediction-market', 'trending', 'discovery', 'live'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      markets: [
        {
          question: 'Will Bitcoin reach $150k in 2026?',
          slug: 'bitcoin-150k-in-2026',
          volume: 5212400.33,
          liquidity: 822340.15,
          outcomes: ['Yes', 'No'],
          outcomePrices: [0.41, 0.59],
        },
      ],
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/polymarket/search',
    price: '0.004',
    label: { zh: 'Polymarket 搜索', en: 'Polymarket Search' },
    description: {
      zh: '按关键词搜索 Polymarket 事件和市场，适合给 agent 做热点检索与候选池构建。',
      en: 'Searches Polymarket events and markets by keyword for agent-driven discovery and watchlist building.',
    },
    category: { zh: '预测市场', en: 'Prediction Markets' },
    upstream: 'polymarket',
    tags: ['polymarket', 'search', 'prediction-market', 'event-discovery'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      query: 'bitcoin',
      events: [
        {
          title: 'Bitcoin above ___ on March 31?',
          slug: 'bitcoin-above-on-march-31',
          volume: 1834220.72,
          liquidity: 323110.11,
        },
      ],
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/polymarket/event',
    price: '0.005',
    label: { zh: 'Polymarket 事件详情', en: 'Polymarket Event Detail' },
    description: {
      zh: '按 slug 拉取单个 Polymarket 事件及其市场详情，适合做决策解释、监控和页面深链。',
      en: 'Loads one Polymarket event by slug with nested market details for monitoring, explainability, and deep linking.',
    },
    category: { zh: '预测市场', en: 'Prediction Markets' },
    upstream: 'polymarket',
    tags: ['polymarket', 'event', 'detail', 'prediction-market', 'live'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      slug: 'bitcoin-above-on-march-31',
      title: 'Bitcoin above ___ on March 31?',
      markets: [
        {
          question: 'Bitcoin above $90k on March 31?',
          outcomes: ['Yes', 'No'],
          outcomePrices: [0.36, 0.64],
        },
      ],
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/polymarket/orderbook',
    price: '0.005',
    label: { zh: 'Polymarket 订单簿', en: 'Polymarket Order Book' },
    description: {
      zh: '按 market slug 和 outcome 拉取实时订单簿，返回买卖盘、盘口摘要和可交易 token 映射。',
      en: 'Loads the live Polymarket order book for a market slug and outcome with bids, asks, and marketable token mapping.',
    },
    category: { zh: '预测市场交易', en: 'Prediction Market Trading' },
    upstream: 'polymarket',
    tags: ['polymarket', 'trading', 'orderbook', 'liquidity', 'live'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      slug: 'bitcoin-above-on-march-31',
      outcome: 'Yes',
      tokenId: '123456789',
      bestBid: 0.41,
      bestAsk: 0.43,
      midpoint: 0.42,
      spread: 0.02,
      bids: [{ price: 0.41, size: 250 }],
      asks: [{ price: 0.43, size: 190 }],
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/polymarket/quote',
    price: '0.006',
    label: { zh: 'Polymarket 成交报价', en: 'Polymarket Trade Quote' },
    description: {
      zh: '按 slug、outcome、side 和 size 估算成交均价、滑点和可成交深度，适合自动交易前风控。',
      en: 'Estimates fill price, slippage, and executable depth from the live book before an automated Polymarket trade.',
    },
    category: { zh: '预测市场交易', en: 'Prediction Market Trading' },
    upstream: 'polymarket',
    tags: ['polymarket', 'trading', 'quote', 'slippage', 'execution'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      slug: 'bitcoin-above-on-march-31',
      outcome: 'Yes',
      side: 'buy',
      requestedSize: 150,
      filledSize: 150,
      averagePrice: 0.425,
      estimatedNotionalUsd: 63.75,
      slippagePct: 1.19,
      enoughLiquidity: true,
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/polymarket/price-history',
    price: '0.004',
    label: { zh: 'Polymarket 价格历史', en: 'Polymarket Price History' },
    description: {
      zh: '按 slug 和 outcome 拉取价格历史序列，适合做趋势判断、回测和自动交易信号输入。',
      en: 'Returns Polymarket price history for a market slug and outcome to power trend analysis, backtests, and trading signals.',
    },
    category: { zh: '预测市场交易', en: 'Prediction Market Trading' },
    upstream: 'polymarket',
    tags: ['polymarket', 'trading', 'history', 'backtest', 'signal'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      slug: 'bitcoin-above-on-march-31',
      outcome: 'Yes',
      interval: '1d',
      fidelity: 60,
      points: [
        { timestamp: 1772856025, price: 0.1425 },
        { timestamp: 1772941702, price: 0.1755 },
      ],
      latestPrice: 0.1755,
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/polymarket/topic',
    price: '0.004',
    label: { zh: 'Polymarket 主题雷达', en: 'Polymarket Topic Radar' },
    description: {
      zh: '按主题聚合热门预测市场，适合把 crypto、election、macro 等高流量方向直接变成首页入口。',
      en: 'Clusters hot Polymarket markets by topic such as crypto, election, and macro for discovery and dashboard surfacing.',
    },
    category: { zh: '预测市场', en: 'Prediction Markets' },
    upstream: 'polymarket',
    tags: ['polymarket', 'topic', 'discovery', 'attention', 'live'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      tag: 'crypto',
      markets: [
        {
          question: 'Will BTC hit $100k this month?',
          slug: 'btc-100k-this-month',
          matchedKeywords: ['btc', 'bitcoin'],
          volume24hr: 155000.22,
        },
      ],
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/polymarket/related',
    price: '0.005',
    label: { zh: 'Polymarket 相似市场', en: 'Polymarket Related Markets' },
    description: {
      zh: '按 slug 找出语义和事件上下文相近的其他市场，适合做链式探索和自动 watchlist 扩展。',
      en: 'Finds semantically related Polymarket markets from one slug to expand watchlists and discovery flows.',
    },
    category: { zh: '预测市场', en: 'Prediction Markets' },
    upstream: 'polymarket',
    tags: ['polymarket', 'related', 'watchlist', 'discovery', 'live'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      slug: 'btc-100k-this-month',
      anchorQuestion: 'Will BTC hit $100k this month?',
      relatedMarkets: [
        {
          slug: 'btc-above-95k-this-month',
          similarityScore: 8.4,
        },
      ],
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/polymarket/mispricing',
    price: '0.006',
    label: { zh: 'Polymarket 错价候选', en: 'Polymarket Mispricing Candidates' },
    description: {
      zh: '基于盘口中点、最新成交价、点差和 24h 成交量筛出启发式错价候选，适合自动交易前扫描。',
      en: 'Screens heuristic Polymarket mispricing candidates using midpoint, last trade, spread, and 24h volume before automation.',
    },
    category: { zh: '预测市场交易', en: 'Prediction Market Trading' },
    upstream: 'polymarket',
    tags: ['polymarket', 'trading', 'mispricing', 'signal', 'scanner'],
    status: 'live',
    sample: () => ({
      source: 'polymarket',
      methodology: 'heuristic',
      candidates: [
        {
          slug: 'btc-100k-this-month',
          lastTradePrice: 0.47,
          midpoint: 0.43,
          dislocationPct: 9.3,
          opportunityScore: 27.8,
        },
      ],
      timestamp: Date.now(),
    }),
  },
  {
    path: '/api/wallet-risk',
    price: '0.02',
    label: { zh: '钱包风险画像', en: 'Wallet Risk Profile' },
    description: {
      zh: '基于 Base 地址标签、计数器和近期活动生成结构化钱包风险摘要，适合 agent 做前置筛查。',
      en: 'Structured Base wallet risk summary built from labels, counters, and recent activity for agent-side screening.',
    },
    category: { zh: '链上情报', en: 'Onchain Intelligence' },
    upstream: 'blockscout',
    tags: ['wallet', 'risk', 'base', 'onchain', 'intel'],
    status: 'live',
    sample: () => ({
      address: '0x4200000000000000000000000000000000000006',
      chain: 'base',
      riskScore: 18,
      riskLevel: 'low',
      identity: {
        isContract: true,
        isVerified: true,
        isScam: false,
        reputation: 'ok',
        name: 'Wrapped Ether',
      },
      activity: {
        transactionsCount: 20587009,
        tokenTransfersCount: 4241455,
        uniqueCounterpartiesRecent: 8,
      },
      signals: [{ code: 'VERIFIED_CONTRACT', severity: 'info', message: 'Verified contract with established onchain history.' }],
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
    'X-Payment-Required, X-Pay-To, X-Price, X-Currency, X-Chain, X-Scheme, X-Payment-Reason, X-Request-Id, X-Quota-Reason',
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

function parsePositiveFloat(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

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
        | { kind?: 'endpoint'; key?: string; event?: EndpointRequestMetricEvent }
        | { kind?: 'ai'; key?: string; event?: AIUsageEvent };

      if (!payload || typeof payload !== 'object' || !payload.kind || !payload.key || !payload.event) {
        return jsonResponse({ error: 'Invalid metrics payload' }, { status: 400 });
      }

      const storageKey = `${payload.kind}:${payload.key}`;
      if (payload.kind === 'upstream') {
        const existing = ((await this.state.storage.get<UpstreamTelemetryEvent[]>(storageKey)) || []).filter(Boolean);
        const next = pruneTelemetryEvents([...existing, payload.event as UpstreamTelemetryEvent], Date.now());
        await this.state.storage.put(storageKey, next);
      } else if (payload.kind === 'ai') {
        const existing = ((await this.state.storage.get<AIUsageEvent[]>(storageKey)) || []).filter(Boolean);
        const next = pruneAIUsageEvents([...existing, payload.event as AIUsageEvent], Date.now());
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
        const totalRequests = ((await this.state.storage.get<number>('stats:total_api_calls')) || 0) + 1;
        await this.state.storage.put('stats:total_api_calls', totalRequests);
        await this.state.storage.put('stats:last_api_call_at', Date.now());
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

    if (request.method === 'POST' && url.pathname === '/ai-usage-summary') {
      const payload = (await request.json().catch(() => ({}))) as { now?: number; path?: string };
      const now = Number(payload.now) || Date.now();
      const path = typeof payload.path === 'string' ? payload.path : '';
      const entries = await this.state.storage.list<AIUsageEvent[]>({ prefix: 'ai:' });
      const allEvents: AIUsageEvent[] = [];
      let endpointEvents: AIUsageEvent[] = [];

      for (const [key, value] of entries.entries()) {
        if (!Array.isArray(value)) {
          continue;
        }

        const pruned = pruneAIUsageEvents(value as AIUsageEvent[], now);
        allEvents.push(...pruned);
        if (key === `ai:${path}`) {
          endpointEvents = pruned;
        }
      }

      return jsonResponse({
        windowMs: AI_USAGE_WINDOW_MS,
        global: summarizeAIUsageAggregate(allEvents, now),
        endpoint: summarizeAIUsageAggregate(endpointEvents, now),
      });
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

    if (request.method === 'POST' && url.pathname === '/overview') {
      const totalApiCalls = (await this.state.storage.get<number>('stats:total_api_calls')) || 0;
      const lastApiCallAt = (await this.state.storage.get<number>('stats:last_api_call_at')) || null;
      const now = Date.now();
      const fromMs = now - 24 * 60 * 60 * 1000;
      const bucketMs = (24 * 60 * 60 * 1000) / 6;
      const entries = await this.state.storage.list<EndpointRequestMetricEvent[]>({ prefix: 'endpoint:' });
      const endpointEntries = Array.from(entries.entries())
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => [key.slice('endpoint:'.length), value as EndpointRequestMetricEvent[]] as const);
      const recentEvents = endpointEntries.flatMap(([, value]) =>
        value.filter((event) => event.at >= fromMs && event.at <= now),
      );
      const last24hCalls = recentEvents.length;
      const totalSettledUsdc = Number(
        endpointEntries
          .reduce((sum, [path, events]) => {
            const endpoint = API_INDEX[path];
            if (!endpoint) {
              return sum;
            }

            const settledCount = events.filter((event) => event.paymentCode === 'PAYMENT_VALID').length;
            return sum + parseAmount(endpoint.price) * settledCount;
          }, 0)
          .toFixed(6),
      );
      const settledUsdc24h = Number(
        endpointEntries
          .reduce((sum, [path, events]) => {
            const endpoint = API_INDEX[path];
            if (!endpoint) {
              return sum;
            }

            const settledCount = events.filter(
              (event) => event.paymentCode === 'PAYMENT_VALID' && event.at >= fromMs && event.at <= now,
            ).length;
            return sum + parseAmount(endpoint.price) * settledCount;
          }, 0)
          .toFixed(6),
      );
      const successRate24h =
        last24hCalls > 0
          ? Number((recentEvents.filter((event) => event.statusCode < 400).length / last24hCalls).toFixed(4))
          : 1;
      const paymentRequiredRate24h =
        last24hCalls > 0
          ? Number((recentEvents.filter((event) => event.statusCode === 402).length / last24hCalls).toFixed(4))
          : 0;
      const trend24h = Array.from({ length: 6 }, (_, index) => {
        const bucketStartMs = fromMs + index * bucketMs;
        const bucketEndMs = bucketStartMs + bucketMs;
        const requests = recentEvents.filter((event) => event.at >= bucketStartMs && event.at < bucketEndMs).length;
        return {
          bucketStart: new Date(bucketStartMs).toISOString(),
          requests,
        };
      });
      return jsonResponse({
        totalApiCalls,
        last24hCalls,
        totalSettledUsdc,
        settledUsdc24h,
        successRate24h,
        paymentRequiredRate24h,
        trend24h,
        lastApiCallAt: typeof lastApiCallAt === 'number' ? new Date(lastApiCallAt).toISOString() : null,
      });
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const entries = await this.state.storage.list<UpstreamTelemetryEvent[] | EndpointRequestMetricEvent[] | AIUsageEvent[]>();

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
        continue;
      }

      if (key.startsWith('ai:')) {
        const next = pruneAIUsageEvents(value as AIUsageEvent[], now);
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

function getCatalogEndpoint(
  baseUrl: string,
  payTo: string,
  endpoint: APIEndpoint,
  env: Env,
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
  const aiPolicy = isAIEndpointPath(endpoint.path) ? getAIProfitPolicy(endpoint.path, env) : null;

  return {
    path: endpoint.path,
    url: `${baseUrl}${endpoint.path}`,
    method: endpoint.method || 'GET',
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
      curl:
        endpoint.method === 'POST'
          ? [
              `curl -X POST ${baseUrl}${endpoint.path} \\`,
              '  -H "Content-Type: application/json" \\',
              `  -H "PAYMENT-SIGNATURE: <base64-signed-payload>" \\`,
              `  -H "${PAYMENT_TX_HASH_HEADER}: 0xreplace-with-base-usdc-transaction-hash" \\`,
              `  -d '{"messages":[{"role":"user","content":"Explain x402 payments in one sentence."}]}'`,
              '',
              '# demo mode',
              `curl -X POST ${baseUrl}${endpoint.path} \\`,
              '  -H "Content-Type: application/json" \\',
              `  -H "Authorization: Bearer ${DEMO_PAYMENT_TOKEN}" \\`,
              `  -d '{"prompt":"Explain x402 payments in one sentence."}'`,
            ].join('\n')
          : [
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
    aiPolicy,
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

function getEndpointRequestMetricsState(): Map<string, EndpointRequestMetricEvent[]> {
  if (!globalThis.endpointRequestMetricsState) {
    globalThis.endpointRequestMetricsState = new Map();
  }

  return globalThis.endpointRequestMetricsState;
}

function getTotalApiCallState(): { total: number; lastApiCallAt: number | null } {
  if (!globalThis.totalApiCallState) {
    globalThis.totalApiCallState = { total: 0, lastApiCallAt: null };
  }

  return globalThis.totalApiCallState;
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
  const totalState = getTotalApiCallState();
  totalState.total += 1;
  totalState.lastApiCallAt = event.at;
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
      metricsOverview: `${baseUrl}${OVERVIEW_METRICS_PATH}`,
    },
    endpoints: API_ENDPOINTS.map((endpoint) => getCatalogEndpoint(baseUrl, payTo, endpoint, env, snapshot)),
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

type MetricsOverviewSummary = {
  totalApiCalls: number;
  last24hCalls: number;
  totalSettledUsdc: number;
  settledUsdc24h: number;
  successRate24h: number;
  paymentRequiredRate24h: number;
  trend24h: Array<{ bucketStart: string; requests: number }>;
  lastApiCallAt: string | null;
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

function getAIUsageState(): Map<string, AIUsageEvent[]> {
  if (!globalThis.aiUsageState) {
    globalThis.aiUsageState = new Map();
  }

  return globalThis.aiUsageState;
}

function pruneAIUsageEvents(events: AIUsageEvent[], now: number): AIUsageEvent[] {
  const windowStart = now - AI_USAGE_WINDOW_MS;
  return events.filter((event) => event.at >= windowStart);
}

function recordAIUsage(path: string, event: AIUsageEvent): void {
  const store = getAIUsageState();
  const existing = store.get(path) || [];
  store.set(path, pruneAIUsageEvents([...existing, event], event.at));
}

function summarizeAIUsageAggregate(events: AIUsageEvent[], now: number): AIUsageAggregate {
  const inWindow = pruneAIUsageEvents(events, now);
  const oldest = inWindow[0];
  return {
    totalRequests: inWindow.length,
    totalCostUsd: Number(inWindow.reduce((sum, event) => sum + event.costUsd, 0).toFixed(6)),
    oldestAt: oldest ? new Date(oldest.at).toISOString() : null,
  };
}

async function appendDurableMetric(
  env: Env,
  payload:
    | { kind: 'upstream'; key: string; event: UpstreamTelemetryEvent }
    | { kind: 'endpoint'; key: string; event: EndpointRequestMetricEvent }
    | { kind: 'ai'; key: string; event: AIUsageEvent },
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

async function recordAIUsageWithDurable(env: Env, path: string, event: AIUsageEvent): Promise<void> {
  recordAIUsage(path, event);
  await appendDurableMetric(env, { kind: 'ai', key: path, event });
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

async function getDurableAIUsageSummary(
  env: Env,
  path: string,
  now: number,
): Promise<AIUsageSummary | null> {
  if (!env.METRICS_STORE) {
    return null;
  }

  try {
    const stub = env.METRICS_STORE.get(env.METRICS_STORE.idFromName('global'));
    const response = await stub.fetch('https://metrics-store/ai-usage-summary', {
      method: 'POST',
      body: JSON.stringify({ now, path }),
    });

    if (!response.ok) {
      throw new Error(`metrics store ai usage ${response.status}`);
    }

    return (await response.json()) as AIUsageSummary;
  } catch (error) {
    console.error('metrics store ai usage failed', error);
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

async function getDurableMetricsOverview(env: Env): Promise<MetricsOverviewSummary | null> {
  if (!env.METRICS_STORE) {
    return null;
  }

  try {
    const stub = env.METRICS_STORE.get(env.METRICS_STORE.idFromName('global'));
    const response = await stub.fetch('https://metrics-store/overview', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`metrics store ${response.status}`);
    }

    return (await response.json()) as MetricsOverviewSummary;
  } catch (error) {
    console.error('metrics store overview failed', error);
    return null;
  }
}

function getInMemoryMetricsOverview(): MetricsOverviewSummary {
  const totalState = getTotalApiCallState();
  const now = Date.now();
  const fromMs = now - 24 * 60 * 60 * 1000;
  const buckets = 6;
  const bucketMs = (24 * 60 * 60 * 1000) / buckets;
  const endpointEntries = Array.from(getEndpointRequestMetricsState().entries());
  const allEvents = endpointEntries.flatMap(([, events]) => events);
  const recentEvents = allEvents.filter((event) => event.at >= fromMs && event.at <= now);
  const totalSettledUsdc = Number(
    endpointEntries
      .reduce((sum, [path, events]) => {
        const endpoint = API_INDEX[path];
        if (!endpoint) {
          return sum;
        }

        const settledCount = events.filter((event) => event.paymentCode === 'PAYMENT_VALID').length;
        return sum + parseAmount(endpoint.price) * settledCount;
      }, 0)
      .toFixed(6),
  );
  const settledUsdc24h = Number(
    endpointEntries
      .reduce((sum, [path, events]) => {
        const endpoint = API_INDEX[path];
        if (!endpoint) {
          return sum;
        }

        const settledCount = events.filter(
          (event) => event.paymentCode === 'PAYMENT_VALID' && event.at >= fromMs && event.at <= now,
        ).length;
        return sum + parseAmount(endpoint.price) * settledCount;
      }, 0)
      .toFixed(6),
  );
  const successRate24h =
    recentEvents.length > 0
      ? Number((recentEvents.filter((event) => event.statusCode < 400).length / recentEvents.length).toFixed(4))
      : 1;
  const paymentRequiredRate24h =
    recentEvents.length > 0
      ? Number((recentEvents.filter((event) => event.statusCode === 402).length / recentEvents.length).toFixed(4))
      : 0;
  const trend24h = Array.from({ length: buckets }, (_, index) => {
    const bucketStartMs = fromMs + index * bucketMs;
    const bucketEndMs = bucketStartMs + bucketMs;
    const requests = recentEvents.filter((event) => event.at >= bucketStartMs && event.at < bucketEndMs).length;
    return {
      bucketStart: new Date(bucketStartMs).toISOString(),
      requests,
    };
  });

  return {
    totalApiCalls: totalState.total,
    last24hCalls: recentEvents.length,
    totalSettledUsdc,
    settledUsdc24h,
    successRate24h,
    paymentRequiredRate24h,
    trend24h,
    lastApiCallAt: typeof totalState.lastApiCallAt === 'number' ? new Date(totalState.lastApiCallAt).toISOString() : null,
  };
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

async function recordUpstreamSuccessWithDurable(
  env: Env,
  source: string,
  now: number,
  latencyMs: number,
): Promise<void> {
  getUpstreamCircuitState().set(source, { failures: 0, openUntil: 0 });
  await recordUpstreamTelemetryWithDurable(env, source, {
    at: now,
    ok: true,
    latencyMs,
    code: 'OK',
  });
}

async function recordUpstreamFailureWithDurable(
  env: Env,
  source: string,
  code: UpstreamErrorCode,
  now: number,
  latencyMs: number,
): Promise<void> {
  const state = getUpstreamCircuitState().get(source) || { failures: 0, openUntil: 0 };
  const failures = state.failures + 1;
  const openUntil = failures >= UPSTREAM_FAILURE_THRESHOLD ? now + UPSTREAM_CIRCUIT_COOLDOWN_MS : state.openUntil;
  getUpstreamCircuitState().set(source, { failures, openUntil, lastErrorCode: code });

  await recordUpstreamTelemetryWithDurable(env, source, {
    at: now,
    ok: false,
    latencyMs,
    code,
  });
}

function getAIProfitPolicy(path: string, env: Env): AIProfitPolicy {
  const endpointPath = path as AIEndpointPath;
  const budgetEnvByPath: Partial<Record<AIEndpointPath, string | undefined>> = {
    '/api/deepseek': env.AI_DEEPSEEK_DAILY_BUDGET_USD,
    '/api/qwen': env.AI_QWEN_DAILY_BUDGET_USD,
    '/api/gpt-5.4': env.AI_GPT54_DAILY_BUDGET_USD,
    '/api/gpt-5.4-pro': env.AI_GPT54_PRO_DAILY_BUDGET_USD,
    '/api/claude-4.6': env.AI_CLAUDE46_DAILY_BUDGET_USD,
  };
  const requestLimitEnvByPath: Partial<Record<AIEndpointPath, string | undefined>> = {
    '/api/deepseek': env.AI_DEEPSEEK_DAILY_REQUEST_LIMIT,
    '/api/qwen': env.AI_QWEN_DAILY_REQUEST_LIMIT,
    '/api/gpt-5.4': env.AI_GPT54_DAILY_REQUEST_LIMIT,
    '/api/gpt-5.4-pro': env.AI_GPT54_PRO_DAILY_REQUEST_LIMIT,
    '/api/claude-4.6': env.AI_CLAUDE46_DAILY_REQUEST_LIMIT,
  };
  const defaults = AI_ENDPOINT_DEFAULTS[endpointPath] || AI_ENDPOINT_DEFAULTS['/api/deepseek'];

  return {
    windowMs: AI_USAGE_WINDOW_MS,
    provider: 'openrouter',
    model: getOpenRouterModel(path, env),
    maxInputChars: parsePositiveInt(env.OPENROUTER_MAX_INPUT_CHARS, DEFAULT_OPENROUTER_MAX_INPUT_CHARS),
    maxMessages: parsePositiveInt(env.OPENROUTER_MAX_MESSAGES, DEFAULT_OPENROUTER_MAX_MESSAGES),
    maxOutputTokens: parsePositiveInt(env.OPENROUTER_MAX_OUTPUT_TOKENS, DEFAULT_OPENROUTER_MAX_OUTPUT_TOKENS),
    requestLimit: {
      global: parsePositiveInt(env.AI_GLOBAL_DAILY_REQUEST_LIMIT, DEFAULT_AI_GLOBAL_DAILY_REQUEST_LIMIT),
      endpoint: parsePositiveInt(requestLimitEnvByPath[endpointPath], defaults.requestLimit),
    },
    dailyBudgetUsd: {
      global: parsePositiveFloat(env.AI_GLOBAL_DAILY_BUDGET_USD, DEFAULT_AI_GLOBAL_DAILY_BUDGET_USD),
      endpoint: parsePositiveFloat(budgetEnvByPath[endpointPath], defaults.budgetUsd),
    },
    quotaErrorCodes: ['AI_BUDGET_EXCEEDED', 'AI_REQUEST_LIMIT_EXCEEDED'],
  };
}

function createBadRequestResponse(message: string, requestId: string): Response {
  return apiResponse(
    {
      error: 'Invalid request',
      message,
      requestId,
    },
    {
      status: 400,
      headers: { [REQUEST_ID_HEADER]: requestId },
    },
  );
}

function prepareSpecialEndpointRequest(request: Request, endpoint: APIEndpoint, requestId: string): Response | null {
  const requiresValidatedGet =
    endpoint.path === '/api/wallet-risk' ||
    endpoint.path === '/api/polymarket/search' ||
    endpoint.path === '/api/polymarket/event' ||
    endpoint.path === '/api/polymarket/orderbook' ||
    endpoint.path === '/api/polymarket/quote' ||
    endpoint.path === '/api/polymarket/price-history' ||
    endpoint.path === '/api/polymarket/topic' ||
    endpoint.path === '/api/polymarket/related';

  if (!requiresValidatedGet) {
    return null;
  }

  if (request.method !== 'GET') {
    return apiResponse(
      {
        error: 'Method not allowed',
        requestId,
        allowedMethods: ['GET'],
      },
      {
        status: 405,
        headers: { Allow: 'GET', [REQUEST_ID_HEADER]: requestId },
      },
    );
  }

  const url = new URL(request.url);
  if (endpoint.path === '/api/wallet-risk') {
    const address = url.searchParams.get('address')?.trim() || '';
    if (!address) {
      return createBadRequestResponse('wallet-risk requires ?address=0x... before payment can be evaluated.', requestId);
    }

    if (!isHexAddress(address)) {
      return createBadRequestResponse('wallet-risk address must be a valid EVM hex address.', requestId);
    }

    return null;
  }

  if (endpoint.path === '/api/polymarket/search') {
    const query = url.searchParams.get('q')?.trim() || '';
    if (!query) {
      return createBadRequestResponse('polymarket search requires ?q=keyword before payment can be evaluated.', requestId);
    }

    return null;
  }

  if (endpoint.path === '/api/polymarket/event') {
    const slug = url.searchParams.get('slug')?.trim() || '';
    if (!slug) {
      return createBadRequestResponse('polymarket event requires ?slug=event-slug before payment can be evaluated.', requestId);
    }

    return null;
  }

  if (endpoint.path === '/api/polymarket/orderbook' || endpoint.path === '/api/polymarket/price-history') {
    const slug = url.searchParams.get('slug')?.trim() || '';
    const outcome = url.searchParams.get('outcome')?.trim() || '';
    if (!slug) {
      return createBadRequestResponse('polymarket trading endpoints require ?slug=market-slug before payment can be evaluated.', requestId);
    }

    if (!outcome) {
      return createBadRequestResponse('polymarket trading endpoints require ?outcome=Yes|No before payment can be evaluated.', requestId);
    }

    return null;
  }

  if (endpoint.path === '/api/polymarket/topic') {
    const tag = url.searchParams.get('tag')?.trim() || '';
    if (!tag) {
      return createBadRequestResponse('polymarket topic requires ?tag=crypto|election|macro|ai before payment can be evaluated.', requestId);
    }

    return null;
  }

  if (endpoint.path === '/api/polymarket/related') {
    const slug = url.searchParams.get('slug')?.trim() || '';
    if (!slug) {
      return createBadRequestResponse('polymarket related requires ?slug=market-slug before payment can be evaluated.', requestId);
    }

    return null;
  }

  if (endpoint.path === '/api/polymarket/quote') {
    const slug = url.searchParams.get('slug')?.trim() || '';
    const outcome = url.searchParams.get('outcome')?.trim() || '';
    const side = url.searchParams.get('side')?.trim().toLowerCase() || '';
    const size = Number(url.searchParams.get('size')?.trim() || '0');

    if (!slug) {
      return createBadRequestResponse('polymarket quote requires ?slug=market-slug before payment can be evaluated.', requestId);
    }

    if (!outcome) {
      return createBadRequestResponse('polymarket quote requires ?outcome=Yes|No before payment can be evaluated.', requestId);
    }

    if (side !== 'buy' && side !== 'sell') {
      return createBadRequestResponse('polymarket quote requires ?side=buy or ?side=sell before payment can be evaluated.', requestId);
    }

    if (!Number.isFinite(size) || size <= 0) {
      return createBadRequestResponse('polymarket quote requires a positive ?size=<shares> before payment can be evaluated.', requestId);
    }

    return null;
  }

  return null;
}

function getInMemoryAIUsageSummary(path: string, now: number): AIUsageSummary {
  const store = getAIUsageState();
  const allEvents = [...store.values()].flatMap((events) => events);
  const endpointEvents = store.get(path) || [];

  return {
    windowMs: AI_USAGE_WINDOW_MS,
    global: summarizeAIUsageAggregate(allEvents, now),
    endpoint: summarizeAIUsageAggregate(endpointEvents, now),
  };
}

function buildAIQuotaResponse(
  path: string,
  requestId: string,
  code: AIQuotaCode,
  policy: AIProfitPolicy,
  summary: AIUsageSummary,
): Response {
  const oldestAt = summary.endpoint.oldestAt || summary.global.oldestAt;
  const retryAfterSeconds = oldestAt
    ? Math.max(1, Math.ceil((Date.parse(oldestAt) + summary.windowMs - Date.now()) / 1000))
    : Math.ceil(summary.windowMs / 1000);

  return apiResponse(
    {
      error: 'AI quota exceeded',
      code,
      requestId,
      path,
      quota: {
        windowHours: Math.round(summary.windowMs / (60 * 60 * 1000)),
        provider: policy.provider,
        model: policy.model,
        current: {
          globalRequests: summary.global.totalRequests,
          endpointRequests: summary.endpoint.totalRequests,
          globalCostUsd: summary.global.totalCostUsd,
          endpointCostUsd: summary.endpoint.totalCostUsd,
        },
        limits: {
          globalRequests: policy.requestLimit.global,
          endpointRequests: policy.requestLimit.endpoint,
          globalBudgetUsd: policy.dailyBudgetUsd.global,
          endpointBudgetUsd: policy.dailyBudgetUsd.endpoint,
        },
      },
    },
    {
      status: 429,
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        'Retry-After': String(retryAfterSeconds),
        'X-Quota-Reason': code,
      },
    },
  );
}

async function enforceAIProfitProtection(
  path: string,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  if (!isAIEndpointPath(path)) {
    return null;
  }

  const now = Date.now();
  const policy = getAIProfitPolicy(path, env);
  const summary = (await getDurableAIUsageSummary(env, path, now)) || getInMemoryAIUsageSummary(path, now);

  if (
    summary.global.totalCostUsd >= policy.dailyBudgetUsd.global ||
    summary.endpoint.totalCostUsd >= policy.dailyBudgetUsd.endpoint
  ) {
    return buildAIQuotaResponse(path, requestId, 'AI_BUDGET_EXCEEDED', policy, summary);
  }

  if (
    summary.global.totalRequests >= policy.requestLimit.global ||
    summary.endpoint.totalRequests >= policy.requestLimit.endpoint
  ) {
    return buildAIQuotaResponse(path, requestId, 'AI_REQUEST_LIMIT_EXCEEDED', policy, summary);
  }

  return null;
}

async function prepareAIRequestContext(
  request: Request,
  endpoint: APIEndpoint,
  env: Env,
  requestId: string,
): Promise<{ context: AIRequestContext | null; response: Response | null }> {
  if (!isAIEndpointPath(endpoint.path)) {
    return { context: null, response: null };
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return {
      context: null,
      response: apiResponse(
        {
          error: 'Method not allowed',
          requestId,
          allowedMethods: ['GET', 'POST'],
        },
        {
          status: 405,
          headers: { Allow: 'GET, POST', [REQUEST_ID_HEADER]: requestId },
        },
      ),
    };
  }

  const maxMessages = parsePositiveInt(env.OPENROUTER_MAX_MESSAGES, DEFAULT_OPENROUTER_MAX_MESSAGES);
  const maxInputChars = parsePositiveInt(env.OPENROUTER_MAX_INPUT_CHARS, DEFAULT_OPENROUTER_MAX_INPUT_CHARS);
  const maxOutputTokens = parsePositiveInt(
    env.OPENROUTER_MAX_OUTPUT_TOKENS,
    DEFAULT_OPENROUTER_MAX_OUTPUT_TOKENS,
  );

  let messages: OpenRouterChatMessage[] = [];
  let prompt = '';
  let maxTokens = maxOutputTokens;
  let temperature = DEFAULT_OPENROUTER_TEMPERATURE;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    prompt = (url.searchParams.get('prompt') || buildDefaultAIPrompt(endpoint.path)).trim();
    messages = [{ role: 'user', content: prompt }];
  } else {
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return {
        context: null,
        response: createBadRequestResponse('AI chat requests must use application/json.', requestId),
      };
    }

    const body = (await request.clone().json().catch(() => null)) as
      | {
          prompt?: unknown;
          system?: unknown;
          messages?: Array<{ role?: unknown; content?: unknown }>;
          max_tokens?: unknown;
          temperature?: unknown;
        }
      | null;

    if (!body || typeof body !== 'object') {
      return {
        context: null,
        response: createBadRequestResponse('AI chat request body must be valid JSON.', requestId),
      };
    }

    if (Array.isArray(body.messages) && body.messages.length > 0) {
      messages = body.messages
        .map((message) => {
          const role = message?.role;
          const content = normalizeAIMessageContent(message?.content);
          if (!content || (role !== 'system' && role !== 'user' && role !== 'assistant')) {
            return null;
          }

          return { role, content } as OpenRouterChatMessage;
        })
        .filter((message): message is OpenRouterChatMessage => Boolean(message));

      if (messages.length !== body.messages.length) {
        return {
          context: null,
          response: createBadRequestResponse(
            'Each AI message must include a valid role and non-empty string content.',
            requestId,
          ),
        };
      }
    } else if (typeof body.prompt === 'string' && body.prompt.trim()) {
      prompt = body.prompt.trim();
      messages = [{ role: 'user', content: prompt }];
    } else {
      return {
        context: null,
        response: createBadRequestResponse(
          'Provide either a non-empty prompt or a non-empty messages array.',
          requestId,
        ),
      };
    }

    if (typeof body.system === 'string' && body.system.trim()) {
      messages = [{ role: 'system', content: body.system.trim() }, ...messages];
    }

    if (typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens)) {
      maxTokens = Math.max(1, Math.min(maxOutputTokens, Math.floor(body.max_tokens)));
    }

    if (typeof body.temperature === 'number' && Number.isFinite(body.temperature)) {
      temperature = Math.max(0, Math.min(2, body.temperature));
    }
  }

  if (messages.length === 0) {
    return {
      context: null,
      response: createBadRequestResponse('AI chat request resolved to an empty messages array.', requestId),
    };
  }

  if (messages.length > maxMessages) {
    return {
      context: null,
      response: createBadRequestResponse(`Too many messages. Maximum is ${maxMessages}.`, requestId),
    };
  }

  const totalChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalChars > maxInputChars) {
    return {
      context: null,
      response: createBadRequestResponse(
        `AI input is too large. Maximum total content length is ${maxInputChars} characters.`,
        requestId,
      ),
    };
  }

  if (!prompt) {
    const firstUserMessage = messages.find((message) => message.role === 'user');
    prompt = firstUserMessage?.content || messages[0].content;
  }

  return {
    context: {
      messages,
      prompt,
      maxTokens,
      temperature,
      requestMode: request.method === 'POST' ? 'post_chat' : 'preview_get',
    },
    response: null,
  };
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

    if (path === OVERVIEW_METRICS_PATH) {
      const summary = (await getDurableMetricsOverview(env)) || getInMemoryMetricsOverview();
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
      return createSettlementStatusResponse(request, env, {
        apiResponse,
        callBaseRpc,
        getRequestId,
        requestIdHeader: REQUEST_ID_HEADER,
      });
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
      const specialRequestResponse = prepareSpecialEndpointRequest(request, endpoint, requestId);
      if (specialRequestResponse) {
        await recordEndpointRequestMetricWithDurable(env, path, {
          at: now,
          statusCode: specialRequestResponse.status,
          requestId,
          paymentCode: null,
          upstreamReasonCode: null,
        });
        return specialRequestResponse;
      }
      const preparedAIRequest = await prepareAIRequestContext(request, endpoint, env, requestId);
      if (preparedAIRequest.response) {
        await recordEndpointRequestMetricWithDurable(env, path, {
          at: now,
          statusCode: preparedAIRequest.response.status,
          requestId,
          paymentCode: null,
          upstreamReasonCode: null,
        });
        return preparedAIRequest.response;
      }

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

      const aiQuotaResponse = await enforceAIProfitProtection(path, env, requestId);
      if (aiQuotaResponse) {
        await recordEndpointRequestMetricWithDurable(env, path, {
          at: Date.now(),
          statusCode: aiQuotaResponse.status,
          requestId,
          paymentCode: verification.code,
          upstreamReasonCode: null,
        });
        return aiQuotaResponse;
      }

      const upstreamResult = await fetchUpstreamData(path, url, env, preparedAIRequest.context, {
        getCircuitSnapshot: getUpstreamCircuitSnapshot,
        recordTelemetry: (event, source) => recordUpstreamTelemetryWithDurable(env, source, event),
        recordSuccess: (source, now, latencyMs) => recordUpstreamSuccessWithDurable(env, source, now, latencyMs),
        recordFailure: (source, code, now, latencyMs) =>
          recordUpstreamFailureWithDurable(env, source, code, now, latencyMs),
        recordAIUsage: (metricPath, event) => recordAIUsageWithDurable(env, metricPath, event),
      });
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
