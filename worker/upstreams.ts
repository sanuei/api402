export const DEFAULT_OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_DEEPSEEK_MODEL = 'deepseek/deepseek-v3.2';
export const DEFAULT_OPENROUTER_QWEN_MODEL = 'qwen/qwen-plus-2025-07-28';
export const DEFAULT_OPENROUTER_MAX_INPUT_CHARS = 4000;
export const DEFAULT_OPENROUTER_MAX_MESSAGES = 12;
export const DEFAULT_OPENROUTER_MAX_OUTPUT_TOKENS = 256;
export const DEFAULT_OPENROUTER_TEMPERATURE = 0.7;
export const DEFAULT_AI_GLOBAL_DAILY_BUDGET_USD = 3;
export const DEFAULT_AI_DEEPSEEK_DAILY_BUDGET_USD = 1.5;
export const DEFAULT_AI_QWEN_DAILY_BUDGET_USD = 1.5;
export const DEFAULT_AI_GLOBAL_DAILY_REQUEST_LIMIT = 200;
export const DEFAULT_AI_DEEPSEEK_DAILY_REQUEST_LIMIT = 120;
export const DEFAULT_AI_QWEN_DAILY_REQUEST_LIMIT = 80;
export const OPENROUTER_HTTP_REFERER = 'https://api-402.com';
export const OPENROUTER_X_TITLE = 'API Market';
export const OPENROUTER_TIMEOUT_MS = 20_000;
export const AI_USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const UPSTREAM_TIMEOUT_MS = 8000;
export const UPSTREAM_FAILURE_THRESHOLD = 3;
export const UPSTREAM_CIRCUIT_COOLDOWN_MS = 30_000;
export const UPSTREAM_TELEMETRY_WINDOW_MS = 15 * 60 * 1000;
export const UPSTREAM_TELEMETRY_MAX_EVENTS = 120;

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

export type UpstreamRequestContext = {
  ai: AIRequestContext | null;
  extractTargetUrl?: string | null;
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
}

export function isAIEndpointPath(path: string): boolean {
  return path === '/api/deepseek' || path === '/api/qwen';
}

export function getOpenRouterModel(path: string, env: UpstreamEnv): string {
  if (path === '/api/qwen') {
    return env.OPENROUTER_QWEN_MODEL || DEFAULT_OPENROUTER_QWEN_MODEL;
  }

  return env.OPENROUTER_DEEPSEEK_MODEL || DEFAULT_OPENROUTER_DEEPSEEK_MODEL;
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

async function fetchTextWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
): Promise<{ text: string; finalUrl: string; contentType: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    if (!response.ok) {
      throw {
        code: 'UPSTREAM_HTTP_ERROR',
        message: `upstream ${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      } as UpstreamFailure;
    }

    return {
      text: await response.text(),
      finalUrl: response.url || url,
      contentType: response.headers.get('Content-Type'),
    };
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

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, ' ');
}

function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function matchMetaContent(html: string, names: string[]): string | null {
  const lowered = names.map((name) => name.toLowerCase());
  const metaRegex = /<meta\b[^>]*?(?:name|property)=["']([^"']+)["'][^>]*?content=["']([^"']+)["'][^>]*?>/gi;

  for (const match of html.matchAll(metaRegex)) {
    const key = match[1]?.toLowerCase();
    if (key && lowered.includes(key)) {
      return stripHtmlTags(match[2] || '');
    }
  }

  return null;
}

function matchTagText(html: string, tagName: string): string | null {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match ? stripHtmlTags(match[1] || '') : null;
}

function matchAllTagTexts(html: string, tagName: string, limit: number): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
  const values = Array.from(html.matchAll(regex))
    .map((match) => stripHtmlTags(match[1] || ''))
    .filter(Boolean);
  return values.slice(0, limit);
}

function extractCanonicalUrl(html: string): string | null {
  const canonicalMatch = html.match(/<link\b[^>]*?rel=["'][^"']*canonical[^"']*["'][^>]*?href=["']([^"']+)["'][^>]*?>/i);
  if (canonicalMatch?.[1]) {
    return canonicalMatch[1].trim();
  }

  return matchMetaContent(html, ['og:url']);
}

function extractLang(html: string): string | null {
  const match = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  return match?.[1]?.trim() || null;
}

function extractExcerpt(html: string): string | null {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const paragraphs = matchAllTagTexts(body, 'p', 4).filter((text) => text.length >= 40);
  if (paragraphs.length === 0) {
    return null;
  }

  return paragraphs.join(' ').slice(0, 420).trim();
}

function extractLinks(html: string, baseUrl: string, limit: number): Array<{ href: string; text: string; sameHost: boolean }> {
  const regex = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: Array<{ href: string; text: string; sameHost: boolean }> = [];

  for (const match of html.matchAll(regex)) {
    if (links.length >= limit) {
      break;
    }

    const rawHref = match[1]?.trim();
    const text = stripHtmlTags(match[2] || '');
    if (!rawHref || !text) {
      continue;
    }

    try {
      const resolved = new URL(rawHref, baseUrl);
      if (!['http:', 'https:'].includes(resolved.protocol)) {
        continue;
      }
      if (seen.has(resolved.href)) {
        continue;
      }
      seen.add(resolved.href);
      links.push({
        href: resolved.href,
        text: text.slice(0, 120),
        sameHost: resolved.hostname === base.hostname,
      });
    } catch {
      continue;
    }
  }

  return links;
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
  env: UpstreamEnv,
  context: UpstreamRequestContext,
  deps: FetchUpstreamDependencies,
): Promise<UpstreamResult> {
  const sourceByPath: Record<string, string | undefined> = {
    '/api/btc-price': 'binance',
    '/api/eth-price': 'binance',
    '/api/deepseek': 'openrouter',
    '/api/qwen': 'openrouter',
    '/api/whale-positions': 'hyperliquid',
    '/api/kline': 'binance',
    '/api/extract/article': 'direct-fetch',
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

    if (path === '/api/extract/article') {
      const targetUrl = context.extractTargetUrl;
      if (!targetUrl) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'missing extract target url', retryable: false } as UpstreamFailure;
      }

      const { text, finalUrl, contentType } = await fetchTextWithTimeout(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'API402Bot/1.0 (+https://api-402.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      const title = matchTagText(text, 'title');
      const description = matchMetaContent(text, ['description', 'og:description', 'twitter:description']);
      const canonicalUrl = extractCanonicalUrl(text);
      const lang = extractLang(text);
      const headings = matchAllTagTexts(text, 'h1', 2).concat(matchAllTagTexts(text, 'h2', 3)).slice(0, 5);
      const excerpt = extractExcerpt(text);
      const links = extractLinks(text, finalUrl, 8);

      if (!title && !description && !excerpt) {
        throw { code: 'UPSTREAM_INVALID_RESPONSE', message: 'no extractable content', retryable: true } as UpstreamFailure;
      }

      await deps.recordSuccess(source, Date.now(), Date.now() - startedAt);
      return {
        data: {
          url: targetUrl,
          finalUrl,
          canonicalUrl,
          title,
          description,
          excerpt,
          headings,
          links,
          lang,
          contentType,
          wordCount: excerpt ? excerpt.split(/\s+/).length : 0,
          timestamp: Date.now(),
        },
        meta: { source, status: 'live', reasonCode: 'OK', retryable: false },
      };
    }

    if (path === '/api/deepseek' || path === '/api/qwen') {
      const aiContext = context.ai;
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

export function buildDefaultAIPrompt(path: string): string {
  if (path === '/api/qwen') {
    return '请用一句中文介绍 API402 的按次付费 API 调用方式。';
  }

  return 'Explain API402 pay-per-call APIs in one concise sentence.';
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
