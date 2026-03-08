export const DEFAULT_OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_DEEPSEEK_MODEL = 'deepseek/deepseek-v3.2';
export const DEFAULT_OPENROUTER_QWEN_MODEL = 'qwen/qwen-plus-2025-07-28';
export const DEFAULT_OPENROUTER_GPT54_MODEL = 'openai/gpt-5.4';
export const DEFAULT_OPENROUTER_GPT54_PRO_MODEL = 'openai/gpt-5.4-pro';
export const DEFAULT_OPENROUTER_CLAUDE46_MODEL = 'anthropic/claude-sonnet-4.6';
export const DEFAULT_OPENROUTER_MAX_INPUT_CHARS = 4000;
export const DEFAULT_OPENROUTER_MAX_MESSAGES = 12;
export const DEFAULT_OPENROUTER_MAX_OUTPUT_TOKENS = 256;
export const DEFAULT_OPENROUTER_TEMPERATURE = 0.7;
export const DEFAULT_AI_GLOBAL_DAILY_BUDGET_USD = 3;
export const DEFAULT_AI_DEEPSEEK_DAILY_BUDGET_USD = 1.5;
export const DEFAULT_AI_QWEN_DAILY_BUDGET_USD = 1.5;
export const DEFAULT_AI_GPT54_DAILY_BUDGET_USD = 0.8;
export const DEFAULT_AI_GPT54_PRO_DAILY_BUDGET_USD = 0.5;
export const DEFAULT_AI_CLAUDE46_DAILY_BUDGET_USD = 0.8;
export const DEFAULT_AI_GLOBAL_DAILY_REQUEST_LIMIT = 200;
export const DEFAULT_AI_DEEPSEEK_DAILY_REQUEST_LIMIT = 120;
export const DEFAULT_AI_QWEN_DAILY_REQUEST_LIMIT = 80;
export const DEFAULT_AI_GPT54_DAILY_REQUEST_LIMIT = 30;
export const DEFAULT_AI_GPT54_PRO_DAILY_REQUEST_LIMIT = 12;
export const DEFAULT_AI_CLAUDE46_DAILY_REQUEST_LIMIT = 24;
export const OPENROUTER_HTTP_REFERER = 'https://api-402.com';
export const OPENROUTER_X_TITLE = 'API Market';
export const OPENROUTER_TIMEOUT_MS = 20_000;
export const AI_USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const UPSTREAM_TIMEOUT_MS = 8000;
export const UPSTREAM_FAILURE_THRESHOLD = 3;
export const UPSTREAM_CIRCUIT_COOLDOWN_MS = 30_000;
export const UPSTREAM_TELEMETRY_WINDOW_MS = 15 * 60 * 1000;
export const UPSTREAM_TELEMETRY_MAX_EVENTS = 120;
const POLYMARKET_GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export type UpstreamErrorCode =
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

export type UpstreamTelemetryEvent = {
  at: number;
  ok: boolean;
  latencyMs: number;
  code: 'OK' | UpstreamErrorCode;
};

export type UpstreamTelemetrySummary = {
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

export type UpstreamMeta = {
  source: string;
  status: 'live' | 'fallback';
  reasonCode: 'OK' | UpstreamErrorCode;
  retryable: boolean;
};

export type UpstreamResult = {
  data: unknown | null;
  meta: UpstreamMeta;
};

export type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AIRequestContext = {
  messages: OpenRouterChatMessage[];
  prompt: string;
  maxTokens: number;
  temperature: number;
  requestMode: 'preview_get' | 'post_chat';
};

export type AIUsageEvent = {
  at: number;
  model: string;
  costUsd: number;
  totalTokens: number;
};

export type AIUsageAggregate = {
  totalRequests: number;
  totalCostUsd: number;
  oldestAt: string | null;
};

export type AIUsageSummary = {
  windowMs: number;
  global: AIUsageAggregate;
  endpoint: AIUsageAggregate;
};

export type AIQuotaCode = 'AI_BUDGET_EXCEEDED' | 'AI_REQUEST_LIMIT_EXCEEDED';

type WalletRiskSignal = {
  code: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  message: string;
};

export type AIProfitPolicy = {
  windowMs: number;
  provider: 'openrouter';
  model: string;
  maxInputChars: number;
  maxMessages: number;
  maxOutputTokens: number;
  requestLimit: {
    global: number;
    endpoint: number;
  };
  dailyBudgetUsd: {
    global: number;
    endpoint: number;
  };
  quotaErrorCodes: AIQuotaCode[];
};

export interface UpstreamEnv {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_API_BASE?: string;
  OPENROUTER_DEEPSEEK_MODEL?: string;
  OPENROUTER_QWEN_MODEL?: string;
  OPENROUTER_GPT54_MODEL?: string;
  OPENROUTER_GPT54_PRO_MODEL?: string;
  OPENROUTER_CLAUDE46_MODEL?: string;
}

export const AI_ENDPOINT_PATHS = [
  '/api/deepseek',
  '/api/qwen',
  '/api/gpt-5.4',
  '/api/gpt-5.4-pro',
  '/api/claude-4.6',
] as const;

export type AIEndpointPath = (typeof AI_ENDPOINT_PATHS)[number];

export const AI_ENDPOINT_DEFAULTS: Record<
  AIEndpointPath,
  {
    model: string;
    budgetUsd: number;
    requestLimit: number;
    prompt: string;
  }
> = {
  '/api/deepseek': {
    model: DEFAULT_OPENROUTER_DEEPSEEK_MODEL,
    budgetUsd: DEFAULT_AI_DEEPSEEK_DAILY_BUDGET_USD,
    requestLimit: DEFAULT_AI_DEEPSEEK_DAILY_REQUEST_LIMIT,
    prompt: 'Explain API402 pay-per-call APIs in one concise sentence.',
  },
  '/api/qwen': {
    model: DEFAULT_OPENROUTER_QWEN_MODEL,
    budgetUsd: DEFAULT_AI_QWEN_DAILY_BUDGET_USD,
    requestLimit: DEFAULT_AI_QWEN_DAILY_REQUEST_LIMIT,
    prompt: '请用一句中文介绍 API402 的按次付费 API 调用方式。',
  },
  '/api/gpt-5.4': {
    model: DEFAULT_OPENROUTER_GPT54_MODEL,
    budgetUsd: DEFAULT_AI_GPT54_DAILY_BUDGET_USD,
    requestLimit: DEFAULT_AI_GPT54_DAILY_REQUEST_LIMIT,
    prompt: 'Summarize why pay-per-call AI APIs are useful for builders in one sentence.',
  },
  '/api/gpt-5.4-pro': {
    model: DEFAULT_OPENROUTER_GPT54_PRO_MODEL,
    budgetUsd: DEFAULT_AI_GPT54_PRO_DAILY_BUDGET_USD,
    requestLimit: DEFAULT_AI_GPT54_PRO_DAILY_REQUEST_LIMIT,
    prompt: 'Review an API product idea in one crisp paragraph with one risk and one upside.',
  },
  '/api/claude-4.6': {
    model: DEFAULT_OPENROUTER_CLAUDE46_MODEL,
    budgetUsd: DEFAULT_AI_CLAUDE46_DAILY_BUDGET_USD,
    requestLimit: DEFAULT_AI_CLAUDE46_DAILY_REQUEST_LIMIT,
    prompt: 'Explain, in one concise paragraph, how to safely expose a paid API to AI agents.',
  },
};

export function isAIEndpointPath(path: string): boolean {
  return AI_ENDPOINT_PATHS.includes(path as AIEndpointPath);
}

export function getOpenRouterModel(path: string, env: UpstreamEnv): string {
  switch (path) {
    case '/api/qwen':
      return env.OPENROUTER_QWEN_MODEL || DEFAULT_OPENROUTER_QWEN_MODEL;
    case '/api/gpt-5.4':
      return env.OPENROUTER_GPT54_MODEL || DEFAULT_OPENROUTER_GPT54_MODEL;
    case '/api/gpt-5.4-pro':
      return env.OPENROUTER_GPT54_PRO_MODEL || DEFAULT_OPENROUTER_GPT54_PRO_MODEL;
    case '/api/claude-4.6':
      return env.OPENROUTER_CLAUDE46_MODEL || DEFAULT_OPENROUTER_CLAUDE46_MODEL;
    default:
      return env.OPENROUTER_DEEPSEEK_MODEL || DEFAULT_OPENROUTER_DEEPSEEK_MODEL;
  }
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
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw {
        code: 'UPSTREAM_TIMEOUT',
        message: 'upstream timeout',
        retryable: true,
      } as UpstreamFailure;
    }

    if (typeof error === 'object' && error && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
      throw error;
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

type FetchUpstreamDependencies = {
  getCircuitSnapshot(source: string, now: number): { open: boolean; openUntil: number };
  recordTelemetry(event: UpstreamTelemetryEvent, source: string): Promise<void>;
  recordSuccess(source: string, now: number, latencyMs: number): Promise<void>;
  recordFailure(source: string, code: UpstreamErrorCode, now: number, latencyMs: number): Promise<void>;
  recordAIUsage(path: string, event: AIUsageEvent): Promise<void>;
};

export async function fetchUpstreamData(
  path: string,
  requestUrl: URL,
  env: UpstreamEnv,
  aiContext: AIRequestContext | null,
  deps: FetchUpstreamDependencies,
): Promise<UpstreamResult> {
  const sourceByPath: Record<string, string | undefined> = {
    '/api/btc-price': 'binance',
    '/api/eth-price': 'binance',
    '/api/deepseek': 'openrouter',
    '/api/qwen': 'openrouter',
    '/api/gpt-5.4': 'openrouter',
  '/api/gpt-5.4-pro': 'openrouter',
  '/api/claude-4.6': 'openrouter',
  '/api/polymarket/trending': 'polymarket',
  '/api/polymarket/search': 'polymarket',
  '/api/polymarket/event': 'polymarket',
    '/api/polymarket/orderbook': 'polymarket',
    '/api/polymarket/quote': 'polymarket',
    '/api/polymarket/price-history': 'polymarket',
    '/api/polymarket/topic': 'polymarket',
    '/api/polymarket/related': 'polymarket',
    '/api/polymarket/mispricing': 'polymarket',
    '/api/wallet-risk': 'blockscout',
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

  if (source === 'openrouter' && !env.OPENROUTER_API_KEY) {
    return {
      data: null,
      meta: { source, status: 'fallback', reasonCode: 'UPSTREAM_FETCH_FAILED', retryable: false },
    };
  }

  const now = Date.now();
  const circuit = deps.getCircuitSnapshot(source, now);
  if (circuit.open) {
    await deps.recordTelemetry(
      {
        at: now,
        ok: false,
        latencyMs: 0,
        code: 'UPSTREAM_CIRCUIT_OPEN',
      },
      source,
    );
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

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
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

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
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

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
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

    if (path === '/api/polymarket/trending') {
      const payload = (await fetchJsonWithTimeout(
        `${POLYMARKET_GAMMA_API_BASE}/markets?limit=12&closed=false&active=true`,
        { method: 'GET' },
      )) as PolymarketMarket[];

      if (!Array.isArray(payload) || payload.length === 0) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing polymarket markets', retryable: true } as UpstreamFailure;
      }

      const markets = payload
        .map((market) => summarizePolymarketMarket(market))
        .filter((market): market is PolymarketMarketSummary => market !== null)
        .sort((left, right) => {
          if (right.volume !== left.volume) {
            return right.volume - left.volume;
          }
          return right.liquidity - left.liquidity;
        })
        .slice(0, 8);

      if (markets.length === 0) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'empty polymarket market summary', retryable: true } as UpstreamFailure;
      }

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          mode: 'trending',
          markets,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/polymarket/search') {
      const query = requestUrl.searchParams.get('q')?.trim();
      if (!query) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing polymarket query', retryable: false } as UpstreamFailure;
      }

      const payload = (await fetchJsonWithTimeout(
        `${POLYMARKET_GAMMA_API_BASE}/public-search?q=${encodeURIComponent(query)}`,
        { method: 'GET' },
      )) as PolymarketSearchResponse;

      const events = Array.isArray(payload.events)
        ? payload.events
            .map((event) => summarizePolymarketEvent(event))
            .filter((event): event is PolymarketEventSummary => event !== null)
            .slice(0, 10)
        : [];

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          mode: 'search',
          query,
          events,
          total: events.length,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/polymarket/event') {
      const slug = requestUrl.searchParams.get('slug')?.trim();
      if (!slug) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing polymarket slug', retryable: false } as UpstreamFailure;
      }

      const payload = (await fetchJsonWithTimeout(
        `${POLYMARKET_GAMMA_API_BASE}/events/slug/${encodeURIComponent(slug)}`,
        { method: 'GET' },
      )) as PolymarketEvent;

      const event = summarizePolymarketEventDetail(payload);
      if (!event) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing polymarket event detail', retryable: true } as UpstreamFailure;
      }

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          ...event,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/polymarket/orderbook') {
      const slug = requestUrl.searchParams.get('slug')?.trim();
      const outcome = requestUrl.searchParams.get('outcome')?.trim();
      if (!slug || !outcome) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing polymarket trading params', retryable: false } as UpstreamFailure;
      }

      const market = await fetchPolymarketMarketBySlug(slug);
      const token = resolvePolymarketOutcomeToken(market, outcome);
      const book = await fetchPolymarketBook(token.tokenId);
      const summary = summarizePolymarketOrderBook(book);

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          slug,
          question: market.question || null,
          outcome: token.outcome,
          tokenId: token.tokenId,
          bestBid: summary.bestBid,
          bestAsk: summary.bestAsk,
          midpoint: summary.midpoint,
          spread: summary.spread,
          bids: summary.bids,
          asks: summary.asks,
          timestamp: summary.timestamp,
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/polymarket/quote') {
      const slug = requestUrl.searchParams.get('slug')?.trim();
      const outcome = requestUrl.searchParams.get('outcome')?.trim();
      const side = requestUrl.searchParams.get('side')?.trim().toLowerCase();
      const requestedSize = Number(requestUrl.searchParams.get('size')?.trim() || '0');
      if (!slug || !outcome || (side !== 'buy' && side !== 'sell') || !Number.isFinite(requestedSize) || requestedSize <= 0) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'invalid polymarket quote params', retryable: false } as UpstreamFailure;
      }

      const market = await fetchPolymarketMarketBySlug(slug);
      const token = resolvePolymarketOutcomeToken(market, outcome);
      const book = await fetchPolymarketBook(token.tokenId);
      const summary = summarizePolymarketOrderBook(book);
      const quote = buildPolymarketTradeQuote(summary, side, requestedSize);

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          slug,
          question: market.question || null,
          outcome: token.outcome,
          tokenId: token.tokenId,
          side,
          requestedSize: Number(requestedSize.toFixed(4)),
          ...quote,
          timestamp: summary.timestamp,
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/polymarket/price-history') {
      const slug = requestUrl.searchParams.get('slug')?.trim();
      const outcome = requestUrl.searchParams.get('outcome')?.trim();
      const interval = requestUrl.searchParams.get('interval')?.trim() || '1d';
      const fidelity = Number(requestUrl.searchParams.get('fidelity')?.trim() || '60');
      if (!slug || !outcome || !Number.isFinite(fidelity) || fidelity <= 0) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'invalid polymarket price history params', retryable: false } as UpstreamFailure;
      }

      const market = await fetchPolymarketMarketBySlug(slug);
      const token = resolvePolymarketOutcomeToken(market, outcome);
      const history = (await fetchJsonWithTimeout(
        `${POLYMARKET_CLOB_API_BASE}/prices-history?market=${encodeURIComponent(token.tokenId)}&interval=${encodeURIComponent(interval)}&fidelity=${encodeURIComponent(String(Math.round(fidelity)))}`,
        { method: 'GET' },
      )) as PolymarketPriceHistoryResponse;

      const points = Array.isArray(history.history)
        ? history.history
            .map((point) => ({
              timestamp: Number(point.t),
              price: Number(Number(point.p).toFixed(4)),
            }))
            .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.price))
        : [];

      if (points.length === 0) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'empty polymarket price history', retryable: true } as UpstreamFailure;
      }

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          slug,
          question: market.question || null,
          outcome: token.outcome,
          tokenId: token.tokenId,
          interval,
          fidelity: Math.round(fidelity),
          points,
          latestPrice: points[points.length - 1]?.price ?? null,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/polymarket/topic') {
      const tag = requestUrl.searchParams.get('tag')?.trim().toLowerCase();
      if (!tag) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing polymarket topic tag', retryable: false } as UpstreamFailure;
      }

      const keywords = POLYMARKET_TOPIC_KEYWORDS[tag];
      if (!keywords) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'unsupported polymarket topic tag', retryable: false } as UpstreamFailure;
      }

      const markets = await fetchActivePolymarketMarkets(80);
      const matches = markets
        .map((market) => scorePolymarketTopicMarket(market, keywords))
        .filter((market): market is PolymarketTopicMatch => market !== null)
        .sort((left, right) => right.attentionScore - left.attentionScore)
        .slice(0, 10);

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          mode: 'topic',
          tag,
          keywords,
          markets: matches,
          total: matches.length,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/polymarket/related') {
      const slug = requestUrl.searchParams.get('slug')?.trim();
      if (!slug) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing polymarket related slug', retryable: false } as UpstreamFailure;
      }

      const anchor = await fetchPolymarketMarketBySlug(slug);
      const markets = await fetchActivePolymarketMarkets(80);
      const relatedMarkets = buildRelatedPolymarketMarkets(anchor, markets).slice(0, 8);

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          slug,
          anchorQuestion: anchor.question || null,
          relatedMarkets,
          total: relatedMarkets.length,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/polymarket/mispricing') {
      const limit = Math.min(20, Math.max(1, Number(requestUrl.searchParams.get('limit')?.trim() || '8')));
      const markets = await fetchActivePolymarketMarkets(100);
      const candidates = markets
        .map((market) => scorePolymarketMispricing(market))
        .filter((candidate): candidate is PolymarketMispricingCandidate => candidate !== null)
        .sort((left, right) => right.opportunityScore - left.opportunityScore)
        .slice(0, limit);

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          source: 'polymarket',
          methodology: 'heuristic',
          warning: 'Candidates are heuristic signals, not guaranteed arbitrage.',
          candidates,
          total: candidates.length,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/wallet-risk') {
      const address = requestUrl.searchParams.get('address')?.trim();
      if (!address) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing wallet address', retryable: false } as UpstreamFailure;
      }

      const [details, counters, transactions, tokenTransfers] = (await Promise.all([
        fetchJsonWithTimeout(`https://base.blockscout.com/api/v2/addresses/${address}`, { method: 'GET' }),
        fetchJsonWithTimeout(`https://base.blockscout.com/api/v2/addresses/${address}/counters`, { method: 'GET' }),
        fetchJsonWithTimeout(
          `https://base.blockscout.com/api/v2/addresses/${address}/transactions?items_count=10`,
          { method: 'GET' },
        ),
        fetchJsonWithTimeout(
          `https://base.blockscout.com/api/v2/addresses/${address}/token-transfers?items_count=10`,
          { method: 'GET' },
        ),
      ])) as [
        BlockscoutAddressDetails,
        BlockscoutAddressCounters,
        BlockscoutItemsResponse<BlockscoutTransactionItem>,
        BlockscoutItemsResponse<BlockscoutTokenTransferItem>
      ];

      const riskProfile = buildWalletRiskProfile(address, details, counters, transactions.items || [], tokenTransfers.items || []);
      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);

      return {
        data: riskProfile,
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

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
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

    if (isAIEndpointPath(path)) {
      if (!aiContext) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing ai request context', retryable: false } as UpstreamFailure;
      }

      const model = getOpenRouterModel(path, env);
      const payload = (await fetchJsonWithTimeout(
        `${env.OPENROUTER_API_BASE || DEFAULT_OPENROUTER_API_BASE}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': OPENROUTER_HTTP_REFERER,
            'X-Title': OPENROUTER_X_TITLE,
          },
          body: JSON.stringify({
            model,
            messages: aiContext.messages,
            temperature: aiContext.temperature,
            max_tokens: aiContext.maxTokens,
          }),
        },
        OPENROUTER_TIMEOUT_MS,
      )) as {
        id?: string;
        model?: string;
        provider?: string;
        choices?: Array<{
          finish_reason?: string;
          message?: { role?: string; content?: unknown };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost?: number;
          cost_details?: {
            upstream_inference_cost?: number;
          };
        };
      };

      const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
      const content = normalizeAIMessageContent(choice?.message?.content);
      if (!content) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing ai response content', retryable: true } as UpstreamFailure;
      }

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      const costUsd = Number(
        (
          payload.usage?.cost ??
          payload.usage?.cost_details?.upstream_inference_cost ??
          0
        ).toFixed?.(6) || 0,
      );
      await deps.recordAIUsage(path, {
        at: Date.now(),
        model: payload.model || model,
        costUsd: Number.isFinite(costUsd) ? costUsd : 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      });
      return {
        data: {
          source: 'openrouter',
          provider: payload.provider || 'openrouter',
          model: payload.model || model,
          response: content,
          finishReason: choice?.finish_reason || null,
          request: {
            mode: aiContext.requestMode,
            prompt: aiContext.prompt,
            maxTokens: aiContext.maxTokens,
            temperature: aiContext.temperature,
            messageCount: aiContext.messages.length,
          },
          usage: {
            promptTokens: payload.usage?.prompt_tokens ?? null,
            completionTokens: payload.usage?.completion_tokens ?? null,
            totalTokens: payload.usage?.total_tokens ?? null,
          },
          timestamp: Date.now(),
          id: payload.id || null,
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'unsupported path', retryable: false } as UpstreamFailure;
  } catch (error) {
    const failure = (error || {
      code: 'UPSTREAM_FETCH_FAILED',
      message: 'unknown upstream error',
      retryable: true,
    }) as UpstreamFailure;
    await deps.recordFailure(source, failure.code || 'UPSTREAM_FETCH_FAILED', Date.now(), Date.now() - startedAt);
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

type BlockscoutAddressEntity = {
  hash?: string;
  name?: string | null;
  is_contract?: boolean;
  is_scam?: boolean;
  is_verified?: boolean;
  reputation?: string | null;
  public_tags?: Array<{ name?: string }>;
};

type PolymarketMarket = {
  id?: string | number;
  question?: string;
  slug?: string;
  eventSlug?: string;
  endDate?: string;
  volume?: string | number;
  liquidity?: string | number;
  image?: string;
  icon?: string;
  active?: boolean;
  closed?: boolean;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  bestBid?: string | number;
  bestAsk?: string | number;
  lastTradePrice?: string | number;
  spread?: string | number;
  volume24hr?: string | number;
  oneDayPriceChange?: string | number;
  featured?: boolean;
  events?: Array<{ title?: string; slug?: string }>;
};

type PolymarketEvent = {
  id?: string | number;
  slug?: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  icon?: string;
  volume?: string | number;
  liquidity?: string | number;
  active?: boolean;
  closed?: boolean;
  markets?: PolymarketMarket[];
};

type PolymarketSearchResponse = {
  events?: PolymarketEvent[];
};

type PolymarketMarketSummary = {
  id: string | null;
  question: string;
  slug: string;
  eventSlug: string | null;
  volume: number;
  liquidity: number;
  endDate: string | null;
  image: string | null;
  active: boolean;
  closed: boolean;
  outcomes: string[];
  outcomePrices: number[];
};

type PolymarketEventSummary = {
  id: string | null;
  slug: string;
  title: string;
  endDate: string | null;
  volume: number;
  liquidity: number;
  image: string | null;
  active: boolean;
  closed: boolean;
  markets: PolymarketMarketSummary[];
};

type PolymarketOrderBookLevel = {
  price?: string | number;
  size?: string | number;
};

type PolymarketOrderBook = {
  asset_id?: string;
  bids?: PolymarketOrderBookLevel[];
  asks?: PolymarketOrderBookLevel[];
  timestamp?: string | number;
};

type PolymarketPriceHistoryResponse = {
  history?: Array<{ t?: number; p?: number }>;
};

type PolymarketTopicMatch = PolymarketMarketSummary & {
  matchedKeywords: string[];
  attentionScore: number;
  volume24hr: number;
  oneDayPriceChange: number | null;
};

type PolymarketRelatedMatch = PolymarketMarketSummary & {
  similarityScore: number;
  sharedKeywords: string[];
  volume24hr: number;
};

type PolymarketMispricingCandidate = PolymarketMarketSummary & {
  bestBid: number;
  bestAsk: number;
  midpoint: number;
  spread: number;
  spreadPct: number;
  lastTradePrice: number;
  dislocationPct: number;
  oneDayPriceChange: number;
  volume24hr: number;
  opportunityScore: number;
};

type BlockscoutAddressDetails = BlockscoutAddressEntity & {
  token?: {
    symbol?: string | null;
    type?: string | null;
  } | null;
};

type BlockscoutAddressCounters = {
  transactions_count?: string;
  token_transfers_count?: string;
  validations_count?: string;
};

type BlockscoutItemsResponse<T> = {
  items?: T[];
};

type BlockscoutTransactionItem = {
  hash?: string;
  timestamp?: string;
  result?: string | null;
  from?: BlockscoutAddressEntity | null;
  to?: BlockscoutAddressEntity | null;
  method?: string | null;
  value?: string | null;
};

type BlockscoutTokenTransferItem = {
  timestamp?: string;
  method?: string | null;
  from?: BlockscoutAddressEntity | null;
  to?: BlockscoutAddressEntity | null;
  token?: {
    symbol?: string | null;
    type?: string | null;
  } | null;
  total?: {
    value?: string | null;
    decimals?: string | null;
  } | null;
};

function parseCount(value: string | number | undefined | null): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const POLYMARKET_TOPIC_KEYWORDS: Record<string, string[]> = {
  crypto: ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'crypto', 'token', 'doge'],
  election: ['election', 'president', 'senate', 'house', 'vote', 'candidate', 'trump', 'biden'],
  macro: ['fed', 'inflation', 'cpi', 'recession', 'rates', 'tariff', 'gdp', 'economy'],
  ai: ['ai', 'openai', 'anthropic', 'gpt', 'claude', 'gemini', 'deepseek', 'minimax'],
};

function parsePolymarketStringArray(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((entry) => String(entry || '').trim()).filter((entry) => entry.length > 0)
      : [];
  } catch {
    return [];
  }
}

function parsePolymarketNumberArray(value: string | undefined): number[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry))
      .map((entry) => Number(entry.toFixed(4)));
  } catch {
    return [];
  }
}

function parsePolymarketTokenIds(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((entry) => String(entry || '').trim()).filter((entry) => entry.length > 0)
      : [];
  } catch {
    return [];
  }
}

function summarizePolymarketMarket(market: PolymarketMarket): PolymarketMarketSummary | null {
  const question = (market.question || '').trim();
  const slug = (market.slug || '').trim();
  if (!question || !slug) {
    return null;
  }

  return {
    id: market.id != null ? String(market.id) : null,
    question,
    slug,
    eventSlug: market.eventSlug?.trim() || null,
    volume: Number(parseCount(market.volume).toFixed(2)),
    liquidity: Number(parseCount(market.liquidity).toFixed(2)),
    endDate: market.endDate || null,
    image: market.image || market.icon || null,
    active: Boolean(market.active),
    closed: Boolean(market.closed),
    outcomes: parsePolymarketStringArray(market.outcomes),
    outcomePrices: parsePolymarketNumberArray(market.outcomePrices),
  };
}

function normalizeKeywordTokens(...values: Array<string | undefined | null>): string[] {
  const text = values
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');

  const stopwords = new Set(['will', 'this', 'that', 'with', 'from', 'what', 'when', 'into', 'than', 'have', 'been', 'after', 'before']);
  const tokens = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));

  return [...new Set(tokens)];
}

function summarizePolymarketEvent(event: PolymarketEvent): PolymarketEventSummary | null {
  const title = (event.title || '').trim();
  const slug = (event.slug || '').trim();
  if (!title || !slug) {
    return null;
  }

  return {
    id: event.id != null ? String(event.id) : null,
    slug,
    title,
    endDate: event.endDate || null,
    volume: Number(parseCount(event.volume).toFixed(2)),
    liquidity: Number(parseCount(event.liquidity).toFixed(2)),
    image: event.image || event.icon || null,
    active: Boolean(event.active),
    closed: Boolean(event.closed),
    markets: Array.isArray(event.markets)
      ? event.markets
          .map((market) => summarizePolymarketMarket(market))
          .filter((market): market is PolymarketMarketSummary => market !== null)
          .slice(0, 6)
      : [],
  };
}

function summarizePolymarketEventDetail(event: PolymarketEvent) {
  const summary = summarizePolymarketEvent(event);
  if (!summary) {
    return null;
  }

  return {
    id: summary.id,
    slug: summary.slug,
    title: summary.title,
    description: event.description?.trim() || null,
    startDate: event.startDate || null,
    endDate: summary.endDate,
    volume: summary.volume,
    liquidity: summary.liquidity,
    image: summary.image,
    active: summary.active,
    closed: summary.closed,
    markets: summary.markets,
  };
}

const POLYMARKET_CLOB_API_BASE = 'https://clob.polymarket.com';

async function fetchPolymarketMarketBySlug(slug: string): Promise<PolymarketMarket> {
  return (await fetchJsonWithTimeout(
    `${POLYMARKET_GAMMA_API_BASE}/markets/slug/${encodeURIComponent(slug)}`,
    { method: 'GET' },
  )) as PolymarketMarket;
}

async function fetchActivePolymarketMarkets(limit: number): Promise<PolymarketMarket[]> {
  const payload = (await fetchJsonWithTimeout(
    `${POLYMARKET_GAMMA_API_BASE}/markets?limit=${encodeURIComponent(String(limit))}&closed=false&active=true`,
    { method: 'GET' },
  )) as PolymarketMarket[];

  return Array.isArray(payload) ? payload : [];
}

function resolvePolymarketOutcomeToken(market: PolymarketMarket, requestedOutcome: string) {
  const outcomes = parsePolymarketStringArray(market.outcomes);
  const tokenIds = parsePolymarketTokenIds(market.clobTokenIds);
  const normalizedRequested = requestedOutcome.trim().toLowerCase();
  const outcomeIndex = outcomes.findIndex((outcome) => outcome.toLowerCase() === normalizedRequested);

  if (outcomeIndex < 0 || !tokenIds[outcomeIndex]) {
    throw {
      code: 'UPSTREAM_INVALID_RESPONSE',
      message: `unknown polymarket outcome ${requestedOutcome}`,
      retryable: false,
    } as UpstreamFailure;
  }

  return {
    outcome: outcomes[outcomeIndex],
    tokenId: tokenIds[outcomeIndex],
  };
}

async function fetchPolymarketBook(tokenId: string): Promise<PolymarketOrderBook> {
  return (await fetchJsonWithTimeout(
    `${POLYMARKET_CLOB_API_BASE}/book?token_id=${encodeURIComponent(tokenId)}`,
    { method: 'GET' },
  )) as PolymarketOrderBook;
}

function normalizePolymarketBookSide(levels: PolymarketOrderBookLevel[] | undefined, direction: 'bid' | 'ask') {
  const normalized = Array.isArray(levels)
    ? levels
        .map((level) => ({
          price: Number(Number(level.price).toFixed(4)),
          size: Number(Number(level.size).toFixed(4)),
        }))
        .filter((level) => Number.isFinite(level.price) && Number.isFinite(level.size) && level.size > 0)
    : [];

  return normalized.sort((left, right) =>
    direction === 'bid' ? right.price - left.price : left.price - right.price,
  );
}

function summarizePolymarketOrderBook(book: PolymarketOrderBook) {
  const bids = normalizePolymarketBookSide(book.bids, 'bid');
  const asks = normalizePolymarketBookSide(book.asks, 'ask');
  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const midpoint =
    bestBid != null && bestAsk != null ? Number((((bestBid + bestAsk) / 2)).toFixed(4)) : null;
  const spread =
    bestBid != null && bestAsk != null ? Number((bestAsk - bestBid).toFixed(4)) : null;
  const timestampValue = Number(book.timestamp);

  return {
    bestBid,
    bestAsk,
    midpoint,
    spread,
    bids: bids.slice(0, 20),
    asks: asks.slice(0, 20),
    timestamp: Number.isFinite(timestampValue) ? timestampValue : Date.now(),
  };
}

function buildPolymarketTradeQuote(
  book: ReturnType<typeof summarizePolymarketOrderBook>,
  side: 'buy' | 'sell',
  requestedSize: number,
) {
  const levels = side === 'buy' ? book.asks : book.bids;
  const referencePrice = side === 'buy' ? book.bestAsk : book.bestBid;
  let remaining = requestedSize;
  let filledSize = 0;
  let estimatedNotionalUsd = 0;
  let worstPrice: number | null = null;

  for (const level of levels) {
    if (remaining <= 0) {
      break;
    }

    const executed = Math.min(remaining, level.size);
    filledSize += executed;
    estimatedNotionalUsd += executed * level.price;
    remaining -= executed;
    worstPrice = level.price;
  }

  const averagePrice = filledSize > 0 ? Number((estimatedNotionalUsd / filledSize).toFixed(4)) : null;
  const enoughLiquidity = filledSize >= requestedSize;
  const slippagePct =
    averagePrice != null && referencePrice != null && referencePrice > 0
      ? Number(
          (
            (side === 'buy'
              ? (averagePrice - referencePrice) / referencePrice
              : (referencePrice - averagePrice) / referencePrice) * 100
          ).toFixed(4),
        )
      : null;

  return {
    filledSize: Number(filledSize.toFixed(4)),
    remainingSize: Number(Math.max(remaining, 0).toFixed(4)),
    averagePrice,
    worstPrice,
    estimatedNotionalUsd: Number(estimatedNotionalUsd.toFixed(4)),
    enoughLiquidity,
    slippagePct,
    fillPct: requestedSize > 0 ? Number(((filledSize / requestedSize) * 100).toFixed(2)) : 0,
  };
}

function scorePolymarketTopicMarket(market: PolymarketMarket, keywords: string[]): PolymarketTopicMatch | null {
  const summary = summarizePolymarketMarket(market);
  if (!summary) {
    return null;
  }

  const haystack = normalizeKeywordTokens(
    market.question,
    market.slug,
    market.eventSlug,
    ...(Array.isArray(market.events) ? market.events.map((event) => event.title || '') : []),
  );
  const matchedKeywords = keywords.filter((keyword) => haystack.includes(keyword));
  if (matchedKeywords.length === 0) {
    return null;
  }

  const volume24hr = Number(parseCount(market.volume24hr).toFixed(2));
  const oneDayPriceChange = Number.isFinite(Number(market.oneDayPriceChange))
    ? Number(Number(market.oneDayPriceChange).toFixed(4))
    : null;
  const attentionScore = Number(
    (
      matchedKeywords.length * 4 +
      Math.min(volume24hr / 10000, 18) +
      Math.min(summary.liquidity / 5000, 12) +
      (market.featured ? 2 : 0)
    ).toFixed(2),
  );

  return {
    ...summary,
    matchedKeywords,
    attentionScore,
    volume24hr,
    oneDayPriceChange,
  };
}

function buildRelatedPolymarketMarkets(anchor: PolymarketMarket, candidates: PolymarketMarket[]): PolymarketRelatedMatch[] {
  const anchorSummary = summarizePolymarketMarket(anchor);
  if (!anchorSummary) {
    return [];
  }

  const anchorTokens = normalizeKeywordTokens(
    anchor.question,
    anchor.slug,
    anchor.eventSlug,
    ...(Array.isArray(anchor.events) ? anchor.events.map((event) => event.title || '') : []),
  );
  const anchorSet = new Set(anchorTokens);

  return candidates
    .map((candidate) => {
      const summary = summarizePolymarketMarket(candidate);
      if (!summary || summary.slug === anchorSummary.slug) {
        return null;
      }

      const candidateTokens = normalizeKeywordTokens(
        candidate.question,
        candidate.slug,
        candidate.eventSlug,
        ...(Array.isArray(candidate.events) ? candidate.events.map((event) => event.title || '') : []),
      );
      const sharedKeywords = candidateTokens.filter((token) => anchorSet.has(token));
      if (sharedKeywords.length === 0) {
        return null;
      }

      const volume24hr = Number(parseCount(candidate.volume24hr).toFixed(2));
      const similarityScore = Number(
        (
          sharedKeywords.length * 3 +
          Math.min(volume24hr / 10000, 12) +
          Math.min(summary.liquidity / 5000, 8)
        ).toFixed(2),
      );

      return {
        ...summary,
        similarityScore,
        sharedKeywords,
        volume24hr,
      };
    })
    .filter((candidate): candidate is PolymarketRelatedMatch => candidate !== null)
    .sort((left, right) => right.similarityScore - left.similarityScore);
}

function scorePolymarketMispricing(market: PolymarketMarket): PolymarketMispricingCandidate | null {
  const summary = summarizePolymarketMarket(market);
  if (!summary) {
    return null;
  }

  const bestBid = Number(market.bestBid);
  const bestAsk = Number(market.bestAsk);
  const lastTradePrice = Number(market.lastTradePrice);
  const volume24hr = Number(parseCount(market.volume24hr).toFixed(2));
  const oneDayPriceChange = Number(Number(market.oneDayPriceChange || 0).toFixed(4));

  if (![bestBid, bestAsk, lastTradePrice].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  if (bestAsk <= bestBid) {
    return null;
  }

  const midpoint = Number((((bestBid + bestAsk) / 2)).toFixed(4));
  if (midpoint <= 0) {
    return null;
  }

  const spread = Number((bestAsk - bestBid).toFixed(4));
  const spreadPct = Number(((spread / midpoint) * 100).toFixed(4));
  const dislocationPct = Number((Math.abs(lastTradePrice - midpoint) / midpoint * 100).toFixed(4));
  const opportunityScore = Number(
    (
      dislocationPct * 2.4 +
      Math.min(volume24hr / 15000, 12) +
      Math.min(summary.liquidity / 6000, 10) +
      Math.abs(oneDayPriceChange) * 10 -
      Math.min(spreadPct, 25) * 0.8
    ).toFixed(2),
  );

  if (opportunityScore <= 0 || volume24hr < 1000) {
    return null;
  }

  return {
    ...summary,
    bestBid: Number(bestBid.toFixed(4)),
    bestAsk: Number(bestAsk.toFixed(4)),
    midpoint,
    spread,
    spreadPct,
    lastTradePrice: Number(lastTradePrice.toFixed(4)),
    dislocationPct,
    oneDayPriceChange,
    volume24hr,
    opportunityScore,
  };
}

function normalizeSeverityScore(severity: WalletRiskSignal['severity']): number {
  switch (severity) {
    case 'critical':
      return 45;
    case 'high':
      return 22;
    case 'warning':
      return 10;
    default:
      return -4;
  }
}

function buildWalletRiskProfile(
  address: string,
  details: BlockscoutAddressDetails,
  counters: BlockscoutAddressCounters,
  transactions: BlockscoutTransactionItem[],
  tokenTransfers: BlockscoutTokenTransferItem[],
) {
  const signals: WalletRiskSignal[] = [];
  const txCount = parseCount(counters.transactions_count);
  const tokenTransferCount = parseCount(counters.token_transfers_count);
  const publicTags = Array.isArray(details.public_tags)
    ? details.public_tags.map((tag) => tag?.name).filter((name): name is string => Boolean(name))
    : [];

  if (details.is_scam) {
    signals.push({ code: 'SCAM_FLAGGED', severity: 'critical', message: 'Blockscout marks this address as scam-related.' });
  }

  if ((details.reputation || '').toLowerCase() !== 'ok') {
    signals.push({
      code: 'REPUTATION_NOT_OK',
      severity: 'high',
      message: `Address reputation is reported as ${details.reputation || 'unknown'}.`,
    });
  }

  if (details.is_contract && !details.is_verified) {
    signals.push({
      code: 'UNVERIFIED_CONTRACT',
      severity: 'high',
      message: 'Contract address is not verified on Blockscout.',
    });
  }

  if (txCount <= 5) {
    signals.push({
      code: 'LOW_HISTORY',
      severity: 'warning',
      message: 'Very limited transaction history on Base.',
    });
  }

  if (tokenTransferCount === 0) {
    signals.push({
      code: 'NO_TOKEN_HISTORY',
      severity: 'warning',
      message: 'No token transfer history detected.',
    });
  }

  if (details.is_contract && details.is_verified) {
    signals.push({
      code: 'VERIFIED_CONTRACT',
      severity: 'info',
      message: 'Verified contract with discoverable metadata.',
    });
  }

  if (!details.is_contract && txCount > 50 && tokenTransferCount > 10) {
    signals.push({
      code: 'ESTABLISHED_EOA',
      severity: 'info',
      message: 'Externally owned account with established activity history.',
    });
  }

  if (publicTags.length > 0) {
    signals.push({
      code: 'PUBLIC_TAGS_PRESENT',
      severity: 'info',
      message: `Public tags available: ${publicTags.slice(0, 3).join(', ')}.`,
    });
  }

  const uniqueCounterparties = new Set<string>();
  let pendingTransactions = 0;
  for (const transaction of transactions) {
    if ((transaction.result || '').toLowerCase() === 'pending') {
      pendingTransactions += 1;
    }
    const fromHash = transaction.from?.hash?.toLowerCase();
    const toHash = transaction.to?.hash?.toLowerCase();
    if (fromHash && fromHash !== address.toLowerCase()) {
      uniqueCounterparties.add(fromHash);
    }
    if (toHash && toHash !== address.toLowerCase()) {
      uniqueCounterparties.add(toHash);
    }
  }

  if (pendingTransactions >= 3) {
    signals.push({
      code: 'MANY_PENDING_TXS',
      severity: 'warning',
      message: 'Recent activity includes multiple pending transactions.',
    });
  }

  const rawScore = signals.reduce((sum, signal) => sum + normalizeSeverityScore(signal.severity), 18);
  const riskScore = Math.max(0, Math.min(100, rawScore));
  const riskLevel =
    riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'moderate' : 'low';

  return {
    address,
    chain: 'base',
    riskScore,
    riskLevel,
    identity: {
      address,
      isContract: Boolean(details.is_contract),
      isVerified: Boolean(details.is_verified),
      isScam: Boolean(details.is_scam),
      reputation: details.reputation || 'unknown',
      name: details.name || null,
      publicTags,
      tokenSymbol: details.token?.symbol || null,
      tokenType: details.token?.type || null,
    },
    activity: {
      transactionsCount: txCount,
      tokenTransfersCount: tokenTransferCount,
      validationsCount: parseCount(counters.validations_count),
      pendingTransactionsRecent: pendingTransactions,
      uniqueCounterpartiesRecent: uniqueCounterparties.size,
      recentTransactions: transactions.slice(0, 5).map((transaction) => ({
        hash: transaction.hash || null,
        timestamp: transaction.timestamp || null,
        result: transaction.result || null,
        method: transaction.method || null,
        counterparty:
          transaction.from?.hash?.toLowerCase() === address.toLowerCase()
            ? transaction.to?.hash || null
            : transaction.from?.hash || null,
      })),
      recentTokenTransfers: tokenTransfers.slice(0, 5).map((transfer) => ({
        timestamp: transfer.timestamp || null,
        method: transfer.method || null,
        tokenSymbol: transfer.token?.symbol || null,
        tokenType: transfer.token?.type || null,
        value: transfer.total?.value || null,
        decimals: transfer.total?.decimals || null,
        direction:
          transfer.from?.hash?.toLowerCase() === address.toLowerCase()
            ? 'outbound'
            : transfer.to?.hash?.toLowerCase() === address.toLowerCase()
              ? 'inbound'
              : 'unknown',
      })),
    },
    signals,
  };
}

export function buildDefaultAIPrompt(path: string): string {
  if (isAIEndpointPath(path)) {
    return AI_ENDPOINT_DEFAULTS[path as AIEndpointPath].prompt;
  }

  return AI_ENDPOINT_DEFAULTS['/api/deepseek'].prompt;
}

export function normalizeAIMessageContent(content: unknown): string | null {
  if (typeof content === 'string') {
    const normalized = content.trim();
    return normalized ? normalized : null;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (
        part &&
        typeof part === 'object' &&
        'text' in part &&
        typeof (part as { text?: unknown }).text === 'string'
      ) {
        return (part as { text: string }).text;
      }

      return '';
    })
    .join('')
    .trim();

  return text || null;
}
