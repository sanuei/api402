import {
  AI_USAGE_WINDOW_MS,
  UPSTREAM_TELEMETRY_MAX_EVENTS,
  UPSTREAM_TELEMETRY_WINDOW_MS,
  type AIUsageAggregate,
  type AIUsageEvent,
  type AIUsageSummary,
  type UpstreamMeta,
  type UpstreamTelemetryEvent,
  type UpstreamTelemetrySummary,
} from './upstreams';
import type { PaymentVerificationResult } from './payment';

export interface MetricsEnv {
  METRICS_STORE?: DurableObjectNamespace;
}

export type EndpointRequestMetricEvent = {
  at: number;
  statusCode: number;
  requestId: string | null;
  paymentCode: PaymentVerificationResult['code'] | 'RATE_LIMIT' | null;
  upstreamReasonCode: UpstreamMeta['reasonCode'] | null;
};

export type EndpointRequestMetricSummary = {
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

export type MetricsSnapshot = {
  upstreamTelemetry: Record<string, UpstreamTelemetryEvent[]>;
  endpointMetrics: Record<string, EndpointRequestMetricEvent[]>;
};

export type FunnelWindow = '24h' | '7d';

type EndpointFunnelSummary = {
  path: string;
  challenged402: number;
  settled: number;
  replayed: number;
  challengeToReplayConversionRate: number;
};

export type FunnelSummary = {
  window: FunnelWindow;
  from: string;
  to: string;
  endpoints: EndpointFunnelSummary[];
};

export type EndpointFreshness = {
  status: 'fresh' | 'stale' | 'unknown';
  ageSeconds: number | null;
  maxAgeSeconds: number;
  signal: 'upstream_telemetry' | 'request_metrics' | 'none';
};

const ENDPOINT_METRICS_WINDOW_MS = 60 * 60 * 1000;
const ENDPOINT_METRICS_MAX_EVENTS = 600;
const ENDPOINT_METRICS_DURABLE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ENDPOINT_METRICS_DURABLE_MAX_EVENTS = 20_000;
const ENDPOINT_METRICS_BUCKET_MS = 10 * 60 * 1000;
const ENDPOINT_METRICS_BUCKET_COUNT = 6;
const ENDPOINT_FRESHNESS_MAX_AGE_SECONDS = 15 * 60;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers,
  });
}

function getEndpointRequestMetricsState(): Map<string, EndpointRequestMetricEvent[]> {
  if (!globalThis.endpointRequestMetricsState) {
    globalThis.endpointRequestMetricsState = new Map();
  }

  return globalThis.endpointRequestMetricsState;
}

function getAIUsageState(): Map<string, AIUsageEvent[]> {
  if (!globalThis.aiUsageState) {
    globalThis.aiUsageState = new Map();
  }

  return globalThis.aiUsageState;
}

function pruneTelemetryEvents(events: UpstreamTelemetryEvent[], now: number): UpstreamTelemetryEvent[] {
  const windowStart = now - UPSTREAM_TELEMETRY_WINDOW_MS;
  const inWindow = events.filter((event) => event.at >= windowStart);
  return inWindow.slice(-UPSTREAM_TELEMETRY_MAX_EVENTS);
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

function pruneAIUsageEvents(events: AIUsageEvent[], now: number): AIUsageEvent[] {
  const windowStart = now - AI_USAGE_WINDOW_MS;
  return events.filter((event) => event.at >= windowStart);
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

function recordAIUsage(path: string, event: AIUsageEvent): void {
  const store = getAIUsageState();
  const existing = store.get(path) || [];
  store.set(path, pruneAIUsageEvents([...existing, event], event.at));
}

export async function appendDurableMetric(
  env: MetricsEnv,
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

export async function recordEndpointRequestMetricWithDurable(
  env: MetricsEnv,
  path: string,
  event: EndpointRequestMetricEvent,
): Promise<void> {
  recordEndpointRequestMetric(path, event);
  await appendDurableMetric(env, { kind: 'endpoint', key: path, event });
}

export async function recordAIUsageWithDurable(
  env: MetricsEnv,
  path: string,
  event: AIUsageEvent,
): Promise<void> {
  recordAIUsage(path, event);
  await appendDurableMetric(env, { kind: 'ai', key: path, event });
}

export function getEndpointRequestMetricSummary(
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

export function computeEndpointFreshness(
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

export async function getDurableMetricsSnapshot(env: MetricsEnv, now: number): Promise<MetricsSnapshot | null> {
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

export async function getDurableAIUsageSummary(
  env: MetricsEnv,
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

export async function getDurableFunnelSummary(
  env: MetricsEnv,
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

export function getInMemoryFunnelSummary(now: number, window: FunnelWindow): FunnelSummary {
  const endpointMetrics: Record<string, EndpointRequestMetricEvent[]> = {};
  for (const [path, events] of getEndpointRequestMetricsState().entries()) {
    endpointMetrics[path] = events;
  }

  return summarizeFunnelFromEndpointMetrics(endpointMetrics, window, now);
}

export function getInMemoryAIUsageSummary(path: string, now: number): AIUsageSummary {
  const store = getAIUsageState();
  const allEvents = [...store.values()].flat();
  const endpointEvents = store.get(path) || [];

  return {
    windowMs: AI_USAGE_WINDOW_MS,
    global: summarizeAIUsageAggregate(allEvents, now),
    endpoint: summarizeAIUsageAggregate(endpointEvents, now),
  };
}

export class MetricsStoreDurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: unknown,
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
