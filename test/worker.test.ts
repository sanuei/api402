import assert from 'node:assert/strict';
import test from 'node:test';
import { Wallet } from 'ethers';

import worker, {
  API_ENDPOINTS,
  buildPaymentMessage,
  type Env,
  type PaymentPayload,
} from '../worker/index';

const TEST_PAY_TO = '0x742d35Cc6634C0532925a3b844Bc9e7595f4f8E1';
const BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
let replayGuardStore = new Map<string, number>();
let metricsStore = new Map<string, unknown>();

class FakeReplayGuardStub {
  async fetch(request: Request | string, init?: RequestInit): Promise<Response> {
    const resolvedRequest =
      typeof request === 'string' ? new Request(request, init) : request;
    const payload = (await resolvedRequest.json()) as {
      keys?: string[];
      expiry?: number;
      now?: number;
    };

    const keys = Array.isArray(payload.keys) ? payload.keys : [];
    const expiry = Number(payload.expiry);
    const now = Number(payload.now);

    for (const key of keys) {
      const currentExpiry = replayGuardStore.get(key);
      if (currentExpiry && currentExpiry > now) {
        return Response.json({ consumed: false, replayedKey: key });
      }
    }

    for (const key of keys) {
      replayGuardStore.set(key, expiry);
    }

    return Response.json({ consumed: true });
  }
}

function createReplayGuardNamespace(): DurableObjectNamespace {
  return {
    idFromName(name: string) {
      return { name } as unknown as DurableObjectId;
    },
    idFromString(name: string) {
      return { name } as unknown as DurableObjectId;
    },
    newUniqueId() {
      return { name: crypto.randomUUID() } as unknown as DurableObjectId;
    },
    get() {
      return new FakeReplayGuardStub() as unknown as DurableObjectStub;
    },
    getByName() {
      return new FakeReplayGuardStub() as unknown as DurableObjectStub;
    },
    jurisdiction() {
      return undefined;
    },
  } as unknown as DurableObjectNamespace;
}

class FakeMetricsStoreStub {
  async fetch(request: Request | string, init?: RequestInit): Promise<Response> {
    const resolvedRequest =
      typeof request === 'string' ? new Request(request, init) : request;
    const url = new URL(resolvedRequest.url);

    if (resolvedRequest.method === 'POST' && url.pathname === '/append') {
      const payload = (await resolvedRequest.json()) as {
        kind?: 'upstream' | 'endpoint' | 'ai';
        key?: string;
        event?: unknown;
      };
      if (!payload.kind || !payload.key || !payload.event) {
        return Response.json({ error: 'invalid' }, { status: 400 });
      }

      const storageKey = `${payload.kind}:${payload.key}`;
      const existing = (metricsStore.get(storageKey) as unknown[] | undefined) || [];
      metricsStore.set(storageKey, [...existing, payload.event]);
      return Response.json({ ok: true });
    }

    if (resolvedRequest.method === 'POST' && url.pathname === '/snapshot') {
      const nowPayload = (await resolvedRequest.json().catch(() => ({}))) as { now?: number };
      const now = Number(nowPayload.now) || Date.now();
      const upstreamTelemetry: Record<string, Array<{ at: number }>> = {};
      const endpointMetrics: Record<string, Array<{ at: number }>> = {};

      for (const [key, value] of metricsStore.entries()) {
        if (!Array.isArray(value)) {
          continue;
        }

        if (key.startsWith('upstream:')) {
          const filtered = value.filter((event) => typeof (event as { at?: number }).at === 'number' && (event as { at: number }).at >= now - 15 * 60 * 1000);
          upstreamTelemetry[key.slice('upstream:'.length)] = filtered as Array<{ at: number }>;
        }

        if (key.startsWith('endpoint:')) {
          const filtered = value.filter((event) => typeof (event as { at?: number }).at === 'number' && (event as { at: number }).at >= now - 60 * 60 * 1000);
          endpointMetrics[key.slice('endpoint:'.length)] = filtered as Array<{ at: number }>;
        }
      }

      return Response.json({ upstreamTelemetry, endpointMetrics });
    }

    if (resolvedRequest.method === 'POST' && url.pathname === '/funnel') {
      const payload = (await resolvedRequest.json().catch(() => ({}))) as {
        now?: number;
        window?: '24h' | '7d';
      };
      const now = Number(payload.now) || Date.now();
      const windowMs = payload.window === '7d' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const from = now - windowMs;
      const endpoints: Array<{
        path: string;
        challenged402: number;
        settled: number;
        replayed: number;
        challengeToReplayConversionRate: number;
      }> = [];

      for (const [key, value] of metricsStore.entries()) {
        if (!key.startsWith('endpoint:') || !Array.isArray(value)) {
          continue;
        }

        const events = value.filter(
          (event) => typeof (event as { at?: number }).at === 'number' && (event as { at: number }).at >= from,
        ) as Array<{ statusCode: number; requestId?: string | null; paymentCode?: string | null }>;

        const challengedRequestIds = new Set(
          events.filter((event) => event.statusCode === 402 && event.requestId).map((event) => event.requestId as string),
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

        const challenged402 = events.filter((event) => event.statusCode === 402).length;
        const settled = events.filter((event) => event.paymentCode === 'PAYMENT_VALID').length;
        const replayed = replayedRequestIds.size;

        if (challenged402 === 0 && settled === 0 && replayed === 0) {
          continue;
        }

        endpoints.push({
          path: key.slice('endpoint:'.length),
          challenged402,
          settled,
          replayed,
          challengeToReplayConversionRate:
            challengedRequestIds.size > 0 ? Number((replayed / challengedRequestIds.size).toFixed(4)) : 0,
        });
      }

      endpoints.sort((a, b) => b.challenged402 - a.challenged402 || a.path.localeCompare(b.path));

      return Response.json({
        window: payload.window === '7d' ? '7d' : '24h',
        from: new Date(from).toISOString(),
        to: new Date(now).toISOString(),
        endpoints,
      });
    }

    if (resolvedRequest.method === 'POST' && url.pathname === '/ai-usage-summary') {
      const payload = (await resolvedRequest.json().catch(() => ({}))) as {
        now?: number;
        path?: string;
      };
      const now = Number(payload.now) || Date.now();
      const from = now - 24 * 60 * 60 * 1000;
      const all = Array.from(metricsStore.entries())
        .filter(([key, value]) => key.startsWith('ai:') && Array.isArray(value))
        .flatMap(([, value]) =>
          (value as Array<{ at: number; costUsd?: number }>)
            .filter((event) => typeof event.at === 'number' && event.at >= from)
            .map((event) => ({ at: event.at, costUsd: Number(event.costUsd || 0) })),
        );
      const endpoint = ((metricsStore.get(`ai:${payload.path || ''}`) as Array<{ at: number; costUsd?: number }> | undefined) || [])
        .filter((event) => typeof event.at === 'number' && event.at >= from)
        .map((event) => ({ at: event.at, costUsd: Number(event.costUsd || 0) }));

      const summarize = (events: Array<{ at: number; costUsd: number }>) => ({
        totalRequests: events.length,
        totalCostUsd: Number(events.reduce((sum, event) => sum + event.costUsd, 0).toFixed(6)),
        oldestAt: events[0] ? new Date(events[0].at).toISOString() : null,
      });

      return Response.json({
        windowMs: 24 * 60 * 60 * 1000,
        global: summarize(all),
        endpoint: summarize(endpoint),
      });
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  }
}

function createMetricsStoreNamespace(): DurableObjectNamespace {
  return {
    idFromName(name: string) {
      return { name } as unknown as DurableObjectId;
    },
    idFromString(name: string) {
      return { name } as unknown as DurableObjectId;
    },
    newUniqueId() {
      return { name: crypto.randomUUID() } as unknown as DurableObjectId;
    },
    get() {
      return new FakeMetricsStoreStub() as unknown as DurableObjectStub;
    },
    getByName() {
      return new FakeMetricsStoreStub() as unknown as DurableObjectStub;
    },
    jurisdiction() {
      return undefined;
    },
  } as unknown as DurableObjectNamespace;
}

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    APP_NAME: 'API Market',
    PAY_TO: TEST_PAY_TO,
    OPENROUTER_DEEPSEEK_MODEL: 'deepseek/deepseek-v3.2',
    OPENROUTER_QWEN_MODEL: 'qwen/qwen-plus-2025-07-28',
    OPENROUTER_GPT54_MODEL: 'openai/gpt-5.4',
    OPENROUTER_GPT54_PRO_MODEL: 'openai/gpt-5.4-pro',
    OPENROUTER_CLAUDE46_MODEL: 'anthropic/claude-sonnet-4.6',
    REPLAY_GUARD: createReplayGuardNamespace(),
    METRICS_STORE: createMetricsStoreNamespace(),
    ASSETS: {
      fetch: async () => new Response('<html>ok</html>', { headers: { 'Content-Type': 'text/html' } }),
    } as unknown as Fetcher,
    ...overrides,
  };
}

function encodeBase64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

async function createSignedPayload(
  path: string,
  amount: string,
  overrides: Partial<Omit<PaymentPayload, 'signature'>> = {},
): Promise<PaymentPayload> {
  const wallet = Wallet.createRandom();
  const message = buildPaymentMessage({
    version: '1',
    scheme: 'exact',
    network: 'base',
    currency: 'USDC',
    payTo: TEST_PAY_TO,
    from: wallet.address,
    amount,
    resource: path,
    nonce: 'nonce-123',
    deadline: new Date(Date.now() + 60_000).toISOString(),
    issuedAt: new Date().toISOString(),
    ...overrides,
  });

  const signature = await wallet.signMessage(JSON.stringify(message));
  return { ...message, signature };
}

function toTopicAddress(address: string): string {
  return `0x${'0'.repeat(24)}${address.toLowerCase().slice(2)}`;
}

function toAmountHex(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  const units = BigInt(whole) * 1_000_000n + BigInt((fraction + '000000').slice(0, 6));
  return `0x${units.toString(16)}`;
}

function createTransferReceipt(from: string, to: string, amount: string, blockNumber = '0x100') {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: {
      status: '0x1',
      blockNumber,
      logs: [
        {
          address: BASE_USDC_CONTRACT,
          topics: [ERC20_TRANSFER_TOPIC, toTopicAddress(from), toTopicAddress(to)],
          data: toAmountHex(amount),
        },
      ],
    },
  };
}

function createBlockNumberResponse(blockNumber: string) {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: blockNumber,
  };
}

async function withMockedFetch<T>(
  rpcHandlers: {
    eth_getTransactionReceipt: () => Record<string, unknown>;
    eth_blockNumber: () => Record<string, unknown>;
  },
  handler: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as { method?: string } : {};
    const method = body.method;

    if (method === 'eth_getTransactionReceipt') {
      return new Response(JSON.stringify(rpcHandlers.eth_getTransactionReceipt()), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'eth_blockNumber') {
      return new Response(JSON.stringify(rpcHandlers.eth_blockNumber()), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported RPC method in test' }), { status: 500 });
  };

  try {
    return await handler();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test.beforeEach(() => {
  globalThis.rateLimiter = new Map();
  globalThis.usedPaymentNonces = new Map();
  globalThis.usedPaymentTransactions = new Map();
  globalThis.upstreamCircuitState = new Map();
  globalThis.upstreamTelemetryState = new Map();
  globalThis.endpointRequestMetricsState = new Map();
  globalThis.aiUsageState = new Map();
  replayGuardStore = new Map();
  metricsStore = new Map();
});

test('catalog exposes enriched endpoint metadata', async () => {
  const response = await worker.fetch(new Request('https://api-402.com/api/v1/catalog'), createEnv());
  const body = (await response.json()) as {
    payment: {
      payTo: string;
      currency: string;
      chainId: number;
      tokenContract: string;
      acceptance: string;
      settlementProofHeader: string;
      settlementConfirmationsRequired: number;
      maxSettlementAgeBlocks: number;
      maxPaymentAgeSeconds: number;
      maxFutureSkewSeconds: number;
      remediationSchemaVersion?: string;
      remediationCompatibility?: string;
      remediationRefs?: { changelog: string; deprecations: string };
      payloadSchema: { requiredFields: string[] };
      settlementPolicy?: {
        settlementMethod: string;
        requiredConfirmations: number;
        maxSettlementAgeBlocks: number;
        averageBlockSeconds: number;
        recommendedRetryAfterSeconds: number;
      };
      settlementStatusFilters?: string[];
      settlementStatusRemediation?: Record<string, { retryable: boolean; action: string }>;
      paymentReasonRemediation?: Record<string, { retryable: boolean; action: string }>;
    };
    endpoints: Array<{
      path?: string;
      method?: string;
      exampleRequest: unknown;
      exampleResponse: unknown;
      status: string;
      tags: string[];
      locales?: { zh?: { label?: string }; en?: { label?: string } };
      requestMetrics?: {
        windowMs: number;
        totalRequests: number;
        successRate: number;
        paymentRequiredRate: number;
        rateLimitedRate: number;
        upstreamFallbackRate: number | null;
        paymentFunnel?: {
          challenged402: number;
          settled: number;
          replayed: number;
          challengeToReplayConversionRate: number;
        };
        errorsByCode: Array<{ code: string; count: number }>;
        requestTrend: Array<{ bucketStart: string; requests: number; errors: number }>;
      };
      lastUpdatedAt?: string | null;
      freshness?: {
        status: 'fresh' | 'stale' | 'unknown';
        ageSeconds: number | null;
        maxAgeSeconds: number;
        signal: 'upstream_telemetry' | 'request_metrics' | 'none';
      };
      upstreamPolicy?: {
        timeoutMs: number;
        failureThreshold: number;
        circuitCooldownMs: number;
        errorCodes: string[];
        telemetry?: {
          windowMs: number;
          sampleSize: number;
          successRate: number;
          avgLatencyMs: number | null;
          p95LatencyMs: number | null;
          lastSuccessAt: string | null;
          lastFailureAt: string | null;
          lastErrorCode: string | null;
          updatedAt: string | null;
        } | null;
      } | null;
      aiPolicy?: {
        provider: string;
        model: string;
        maxInputChars: number;
        maxMessages: number;
        maxOutputTokens: number;
        requestLimit: { global: number; endpoint: number };
        dailyBudgetUsd: { global: number; endpoint: number };
        quotaErrorCodes: string[];
      } | null;
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.payment.payTo, TEST_PAY_TO);
  assert.equal(body.payment.currency, 'USDC');
  assert.equal(body.payment.chainId, 8453);
  assert.equal(body.payment.tokenContract, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  assert.equal(body.payment.acceptance, 'base-mainnet-usdc-only');
  assert.equal(body.payment.settlementProofHeader, 'X-PAYMENT-TX-HASH');
  assert.equal(body.payment.settlementConfirmationsRequired, 2);
  assert.equal(body.payment.maxSettlementAgeBlocks, 7200);
  assert.equal(body.payment.maxPaymentAgeSeconds, 900);
  assert.equal(body.payment.maxFutureSkewSeconds, 120);
  assert.equal(body.payment.remediationSchemaVersion, '1.0.0');
  assert.equal(body.payment.remediationCompatibility, 'semver-minor-backward-compatible');
  assert.equal(
    body.payment.remediationRefs?.changelog,
    'https://api-402.com/.well-known/remediation-changelog.json',
  );
  assert.equal(
    body.payment.remediationRefs?.deprecations,
    'https://api-402.com/.well-known/remediation-deprecations.json',
  );
  assert.equal(body.payment.settlementPolicy?.settlementMethod, 'base-usdc-transfer-receipt');
  assert.equal(body.payment.settlementPolicy?.requiredConfirmations, 2);
  assert.equal(body.payment.settlementPolicy?.maxSettlementAgeBlocks, 7200);
  assert.equal(body.payment.settlementPolicy?.averageBlockSeconds, 2);
  assert.equal(body.payment.settlementPolicy?.recommendedRetryAfterSeconds, 4);
  assert.deepEqual(body.payment.settlementStatusFilters, ['payer', 'resource', 'payTo', 'minAmount']);
  assert.equal(body.payment.settlementStatusRemediation?.SETTLEMENT_PENDING?.retryable, true);
  assert.equal(
    body.payment.paymentReasonRemediation?.PAYMENT_TX_NOT_CONFIRMED?.retryable,
    true,
  );
  assert.ok(body.payment.payloadSchema.requiredFields.includes('signature'));
  assert.ok(body.endpoints.length >= API_ENDPOINTS.length);
  assert.equal(body.endpoints[0].status !== undefined, true);
  assert.equal(Array.isArray(body.endpoints[0].tags), true);
  assert.ok(body.endpoints[0].exampleRequest);
  assert.ok(body.endpoints[0].exampleResponse);
  const deepseek = body.endpoints.find((endpoint) => endpoint.path === '/api/deepseek');
  const gpt54 = body.endpoints.find((endpoint) => endpoint.path === '/api/gpt-5.4');
  const gpt54Pro = body.endpoints.find((endpoint) => endpoint.path === '/api/gpt-5.4-pro');
  const claude46 = body.endpoints.find((endpoint) => endpoint.path === '/api/claude-4.6');
  assert.equal(deepseek?.method, 'POST');
  assert.equal(deepseek?.status, 'live');
  assert.equal(deepseek?.aiPolicy?.provider, 'openrouter');
  assert.ok((deepseek?.aiPolicy?.quotaErrorCodes || []).includes('AI_BUDGET_EXCEEDED'));
  assert.equal(gpt54?.method, 'POST');
  assert.equal(gpt54?.aiPolicy?.model, 'openai/gpt-5.4');
  assert.equal(gpt54Pro?.aiPolicy?.model, 'openai/gpt-5.4-pro');
  assert.equal(claude46?.method, 'POST');
  assert.equal(claude46?.aiPolicy?.model, 'anthropic/claude-sonnet-4.6');
  assert.equal(typeof body.endpoints[0].locales?.zh?.label, 'string');
  assert.equal(typeof body.endpoints[0].locales?.en?.label, 'string');
  assert.equal(body.endpoints[0].requestMetrics?.windowMs, 3600000);
  assert.equal(body.endpoints[0].requestMetrics?.totalRequests, 0);
  assert.equal(body.endpoints[0].requestMetrics?.successRate, 1);
  assert.equal(body.endpoints[0].requestMetrics?.paymentFunnel?.challenged402, 0);
  assert.equal(body.endpoints[0].requestMetrics?.paymentFunnel?.settled, 0);
  assert.equal(body.endpoints[0].requestMetrics?.paymentFunnel?.replayed, 0);
  assert.equal(body.endpoints[0].requestMetrics?.paymentFunnel?.challengeToReplayConversionRate, 0);
  assert.equal(body.endpoints[0].requestMetrics?.requestTrend.length, 6);
  assert.equal(body.endpoints[0].lastUpdatedAt, null);
  assert.equal(body.endpoints[0].freshness?.status, 'unknown');
  assert.equal(body.endpoints[0].freshness?.ageSeconds, null);
  assert.equal(body.endpoints[0].freshness?.maxAgeSeconds, 900);
  assert.equal(body.endpoints[0].freshness?.signal, 'none');
  const firstLiveEndpoint = body.endpoints.find((endpoint) => endpoint.upstreamPolicy);
  assert.equal(firstLiveEndpoint?.upstreamPolicy?.timeoutMs, 8000);
  assert.equal(firstLiveEndpoint?.upstreamPolicy?.failureThreshold, 3);
  assert.equal(firstLiveEndpoint?.upstreamPolicy?.circuitCooldownMs, 30000);
  assert.ok(firstLiveEndpoint?.upstreamPolicy?.errorCodes.includes('UPSTREAM_CIRCUIT_OPEN'));
  assert.equal(firstLiveEndpoint?.upstreamPolicy?.telemetry?.windowMs, 900000);
  assert.equal(firstLiveEndpoint?.upstreamPolicy?.telemetry?.sampleSize, 0);
  assert.equal(firstLiveEndpoint?.upstreamPolicy?.telemetry?.successRate, 1);
  assert.equal(firstLiveEndpoint?.upstreamPolicy?.telemetry?.avgLatencyMs, null);
  assert.equal(firstLiveEndpoint?.upstreamPolicy?.telemetry?.p95LatencyMs, null);
  assert.equal(firstLiveEndpoint?.lastUpdatedAt, null);
  assert.equal(firstLiveEndpoint?.freshness?.status, 'unknown');
});

test('health endpoint returns status information', async () => {
  const response = await worker.fetch(new Request('https://api-402.com/api/v1/health'), createEnv());
  const body = (await response.json()) as { status: string; endpoints: number };

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.endpoints, API_ENDPOINTS.length);
});

test('unpaid request returns a 402 challenge with reason code', async () => {
  const response = await worker.fetch(
    new Request('https://api-402.com/api/deepseek', {
      headers: { 'X-Request-Id': 'req-402-test' },
    }),
    createEnv(),
  );
  const body = (await response.json()) as {
    code: string;
    reason: string;
    requestId?: string;
    remediationSchemaVersion?: string;
    remediationCompatibility?: string;
    remediationRefs?: { changelog: string; deprecations: string };
  };

  assert.equal(response.status, 402);
  assert.equal(body.code, 'PAYMENT_REQUIRED');
  assert.equal(body.reason, 'PAYMENT_MISSING');
  assert.equal(body.requestId, 'req-402-test');
  assert.equal(response.headers.get('X-Request-Id'), 'req-402-test');
  assert.equal(body.remediationSchemaVersion, '1.0.0');
  assert.equal(body.remediationCompatibility, 'semver-minor-backward-compatible');
  assert.equal(
    body.remediationRefs?.changelog,
    'https://api-402.com/.well-known/remediation-changelog.json',
  );
  assert.equal(
    body.remediationRefs?.deprecations,
    'https://api-402.com/.well-known/remediation-deprecations.json',
  );
  assert.equal(response.headers.get('X-Payment-Reason'), 'PAYMENT_MISSING');
});

test('demo bearer token can access a paid endpoint', async () => {
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: { Authorization: 'Bearer demo' },
  });
  const response = await worker.fetch(request, createEnv());
  const body = (await response.json()) as { _meta: { paymentMode: string; paid: boolean } };

  assert.equal(response.status, 200);
  assert.equal(body._meta.paid, true);
  assert.equal(body._meta.paymentMode, 'DEMO_PAYMENT');
});

test('ai endpoint rejects invalid json body before payment challenge', async () => {
  const response = await worker.fetch(
    new Request('https://api-402.com/api/deepseek', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'req-ai-invalid',
      },
      body: '{"messages":',
    }),
    createEnv(),
  );
  const body = (await response.json()) as { error: string; requestId?: string };

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Invalid request');
  assert.equal(body.requestId, 'req-ai-invalid');
  assert.equal(response.headers.get('X-Request-Id'), 'req-ai-invalid');
});

test('wallet-risk rejects missing address before payment challenge', async () => {
  const response = await worker.fetch(
    new Request('https://api-402.com/api/wallet-risk', {
      headers: {
        'X-Request-Id': 'req-wallet-risk-missing',
      },
    }),
    createEnv(),
  );
  const body = (await response.json()) as { error?: string; message?: string; requestId?: string };

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Invalid request');
  assert.equal(body.requestId, 'req-wallet-risk-missing');
  assert.match(body.message || '', /wallet-risk requires \?address=/);
});

test('deepseek endpoint proxies live openrouter chat completion when configured', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (!url.includes('/chat/completions')) {
      return new Response(JSON.stringify({ error: 'unexpected upstream target' }), { status: 500 });
    }

    const body = init?.body
      ? (JSON.parse(String(init.body)) as {
          model?: string;
          messages?: Array<{ role: string; content: string }>;
          max_tokens?: number;
        })
      : {};

    assert.equal(body.model, 'deepseek/deepseek-v3.2');
    assert.equal(body.messages?.[0]?.role, 'user');
    assert.equal(body.max_tokens, 64);

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-test',
        model: body.model,
        provider: 'OpenRouter',
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'x402 enables paid API replay.' } }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const response = await worker.fetch(
      new Request('https://api-402.com/api/deepseek', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Explain x402 payments in one sentence.',
          max_tokens: 64,
        }),
      }),
      {
        ...createEnv(),
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    );
    const body = (await response.json()) as {
      source?: string;
      model?: string;
      response?: string;
      usage?: { totalTokens?: number };
      _meta: {
        origin: string;
        upstream?: { source: string; status: string; reasonCode: string };
      };
    };

    assert.equal(response.status, 200);
    assert.equal(body.source, 'openrouter');
    assert.equal(body.model, 'deepseek/deepseek-v3.2');
    assert.equal(body.response, 'x402 enables paid API replay.');
    assert.equal(body.usage?.totalTokens, 20);
    assert.equal(body._meta.origin, 'proxied');
    assert.equal(body._meta.upstream?.source, 'openrouter');
    assert.equal(body._meta.upstream?.status, 'live');
    assert.equal(body._meta.upstream?.reasonCode, 'OK');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('qwen endpoint maps abort errors to machine-readable upstream timeout', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new DOMException('timed out', 'AbortError');
  };

  try {
    const response = await worker.fetch(
      new Request('https://api-402.com/api/qwen', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: '请用一句中文介绍 API402。',
        }),
      }),
      {
        ...createEnv(),
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    );
    const body = (await response.json()) as {
      _meta: { origin: string; upstream?: { source: string; status: string; reasonCode: string } };
    };

    assert.equal(response.status, 200);
    assert.equal(body._meta.origin, 'mock');
    assert.equal(body._meta.upstream?.source, 'openrouter');
    assert.equal(body._meta.upstream?.status, 'fallback');
    assert.equal(body._meta.upstream?.reasonCode, 'UPSTREAM_TIMEOUT');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('gpt-5.4 endpoint proxies live openrouter chat completion when configured', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = init?.body
      ? (JSON.parse(String(init.body)) as {
          model?: string;
          messages?: Array<{ role: string; content: string }>;
        })
      : {};

    assert.equal(body.model, 'openai/gpt-5.4');
    assert.equal(body.messages?.[0]?.role, 'user');

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-gpt54',
        model: body.model,
        provider: 'OpenRouter',
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'GPT-5.4 is now available pay per call.' } }],
        usage: { prompt_tokens: 14, completion_tokens: 10, total_tokens: 24 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const response = await worker.fetch(
      new Request('https://api-402.com/api/gpt-5.4', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'Why use pay-per-call GPT-5.4?' }),
      }),
      {
        ...createEnv(),
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    );
    const body = (await response.json()) as { model?: string; response?: string; _meta: { origin: string } };

    assert.equal(response.status, 200);
    assert.equal(body.model, 'openai/gpt-5.4');
    assert.equal(body.response, 'GPT-5.4 is now available pay per call.');
    assert.equal(body._meta.origin, 'proxied');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('claude-4.6 endpoint proxies live openrouter chat completion when configured', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = init?.body
      ? (JSON.parse(String(init.body)) as {
          model?: string;
        })
      : {};

    assert.equal(body.model, 'anthropic/claude-sonnet-4.6');

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-claude46',
        model: body.model,
        provider: 'OpenRouter',
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Claude 4.6 is available for writing and review tasks.' } }],
        usage: { prompt_tokens: 18, completion_tokens: 12, total_tokens: 30 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const response = await worker.fetch(
      new Request('https://api-402.com/api/claude-4.6', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'What is Claude 4.6 good at?' }),
      }),
      {
        ...createEnv(),
        OPENROUTER_API_KEY: 'test-openrouter-key',
      },
    );
    const body = (await response.json()) as { model?: string; response?: string; _meta: { origin: string } };

    assert.equal(response.status, 200);
    assert.equal(body.model, 'anthropic/claude-sonnet-4.6');
    assert.equal(body.response, 'Claude 4.6 is available for writing and review tasks.');
    assert.equal(body._meta.origin, 'proxied');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('wallet-risk endpoint returns structured Base risk profile when upstream data is available', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.includes('/api/v2/addresses/0xabc0000000000000000000000000000000000000/counters')) {
      return new Response(
        JSON.stringify({
          transactions_count: '123',
          token_transfers_count: '41',
          validations_count: '0',
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/v2/addresses/0xabc0000000000000000000000000000000000000/transactions')) {
      return new Response(
        JSON.stringify({
          items: [
            {
              hash: '0xtx1',
              timestamp: '2026-03-08T01:05:59.000000Z',
              result: 'ok',
              method: 'transfer',
              from: { hash: '0x1111111111111111111111111111111111111111' },
              to: { hash: '0xabc0000000000000000000000000000000000000' },
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/v2/addresses/0xabc0000000000000000000000000000000000000/token-transfers')) {
      return new Response(
        JSON.stringify({
          items: [
            {
              timestamp: '2026-03-08T01:05:59.000000Z',
              method: 'transfer',
              from: { hash: '0x1111111111111111111111111111111111111111' },
              to: { hash: '0xabc0000000000000000000000000000000000000' },
              token: { symbol: 'USDC', type: 'ERC-20' },
              total: { value: '2500000', decimals: '6' },
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/v2/addresses/0xabc0000000000000000000000000000000000000')) {
      return new Response(
        JSON.stringify({
          hash: '0xabc0000000000000000000000000000000000000',
          is_contract: false,
          is_scam: false,
          is_verified: false,
          reputation: 'ok',
          name: null,
          public_tags: [{ name: 'Active wallet' }],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: 'unexpected upstream target' }), { status: 500 });
  };

  try {
    const response = await worker.fetch(
      new Request('https://api-402.com/api/wallet-risk?address=0xabc0000000000000000000000000000000000000', {
        headers: {
          Authorization: 'Bearer demo',
        },
      }),
      createEnv(),
    );
    const body = (await response.json()) as {
      address?: string;
      riskLevel?: string;
      activity?: { transactionsCount?: number; tokenTransfersCount?: number };
      signals?: Array<{ code?: string }>;
      _meta: { origin: string; upstream?: { source: string; status: string } };
    };

    assert.equal(response.status, 200);
    assert.equal(body.address, '0xabc0000000000000000000000000000000000000');
    assert.equal(body.activity?.transactionsCount, 123);
    assert.equal(body.activity?.tokenTransfersCount, 41);
    assert.equal(body._meta.origin, 'proxied');
    assert.equal(body._meta.upstream?.source, 'blockscout');
    assert.equal(body._meta.upstream?.status, 'live');
    assert.ok((body.signals || []).some((signal) => signal.code === 'PUBLIC_TAGS_PRESENT'));
    assert.ok(['low', 'moderate', 'high', 'critical'].includes(body.riskLevel || ''));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ai endpoint blocks requests when rolling budget is exceeded', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-budget',
        model: 'deepseek/deepseek-v3.2',
        provider: 'OpenRouter',
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'budget test ok' } }],
        usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16, cost: 0.25 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const env = createEnv({
      OPENROUTER_API_KEY: 'test-openrouter-key',
      AI_GLOBAL_DAILY_BUDGET_USD: '0.1',
      AI_DEEPSEEK_DAILY_BUDGET_USD: '0.1',
    });

    const first = await worker.fetch(
      new Request('https://api-402.com/api/deepseek', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'first run' }),
      }),
      env,
    );
    const second = await worker.fetch(
      new Request('https://api-402.com/api/deepseek', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo',
          'Content-Type': 'application/json',
          'X-Request-Id': 'req-ai-budget',
        },
        body: JSON.stringify({ prompt: 'second run' }),
      }),
      env,
    );
    const body = (await second.json()) as {
      code: string;
      requestId?: string;
      quota?: { current?: { endpointCostUsd?: number }; limits?: { endpointBudgetUsd?: number } };
    };

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(body.code, 'AI_BUDGET_EXCEEDED');
    assert.equal(body.requestId, 'req-ai-budget');
    assert.equal(body.quota?.current?.endpointCostUsd, 0.25);
    assert.equal(body.quota?.limits?.endpointBudgetUsd, 0.1);
    assert.equal(second.headers.get('X-Quota-Reason'), 'AI_BUDGET_EXCEEDED');
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ai endpoint blocks requests when rolling request limit is exceeded', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-limit',
        model: 'deepseek/deepseek-v3.2',
        provider: 'OpenRouter',
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'request limit ok' } }],
        usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16, cost: 0.001 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const env = createEnv({
      OPENROUTER_API_KEY: 'test-openrouter-key',
      AI_GLOBAL_DAILY_REQUEST_LIMIT: '1',
      AI_DEEPSEEK_DAILY_REQUEST_LIMIT: '1',
    });

    const first = await worker.fetch(
      new Request('https://api-402.com/api/deepseek', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'first run' }),
      }),
      env,
    );
    const second = await worker.fetch(
      new Request('https://api-402.com/api/deepseek', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'second run' }),
      }),
      env,
    );
    const body = (await second.json()) as { code: string };

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(body.code, 'AI_REQUEST_LIMIT_EXCEEDED');
    assert.equal(second.headers.get('X-Quota-Reason'), 'AI_REQUEST_LIMIT_EXCEEDED');
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('catalog requestMetrics expose endpoint request volume and error trend', async () => {
  const env = createEnv();

  const unpaidOne = await worker.fetch(
    new Request('https://api-402.com/api/deepseek', {
      headers: { 'X-Request-Id': 'req-funnel-1' },
    }),
    env,
  );
  const paid = await worker.fetch(
    new Request('https://api-402.com/api/deepseek', {
      headers: { Authorization: 'Bearer demo', 'X-Request-Id': 'req-funnel-1' },
    }),
    env,
  );
  const unpaidTwo = await worker.fetch(
    new Request('https://api-402.com/api/deepseek', {
      headers: { 'X-Request-Id': 'req-funnel-2' },
    }),
    env,
  );

  assert.equal(unpaidOne.status, 402);
  assert.equal(paid.status, 200);
  assert.equal(unpaidTwo.status, 402);

  const catalogResponse = await worker.fetch(new Request('https://api-402.com/api/v1/catalog'), env);
  const catalogBody = (await catalogResponse.json()) as {
    endpoints: Array<{
      path: string;
      requestMetrics?: {
        totalRequests: number;
        successRate: number;
        paymentRequiredRate: number;
        paymentFunnel?: {
          challenged402: number;
          settled: number;
          replayed: number;
          challengeToReplayConversionRate: number;
        };
        errorsByCode: Array<{ code: string; count: number }>;
        requestTrend: Array<{ bucketStart: string; requests: number; errors: number }>;
      };
      lastUpdatedAt?: string | null;
      freshness?: {
        status: 'fresh' | 'stale' | 'unknown';
        ageSeconds: number | null;
        maxAgeSeconds: number;
        signal: 'upstream_telemetry' | 'request_metrics' | 'none';
      };
    }>;
  };

  const deepseek = catalogBody.endpoints.find((endpoint) => endpoint.path === '/api/deepseek');
  assert.equal(deepseek?.requestMetrics?.totalRequests, 3);
  assert.equal(deepseek?.requestMetrics?.successRate, 0.3333);
  assert.equal(deepseek?.requestMetrics?.paymentRequiredRate, 0.6667);
  assert.equal(deepseek?.requestMetrics?.paymentFunnel?.challenged402, 2);
  assert.equal(deepseek?.requestMetrics?.paymentFunnel?.settled, 0);
  assert.equal(deepseek?.requestMetrics?.paymentFunnel?.replayed, 1);
  assert.equal(deepseek?.requestMetrics?.paymentFunnel?.challengeToReplayConversionRate, 0.5);
  assert.equal(deepseek?.requestMetrics?.errorsByCode[0]?.code, 'PAYMENT_MISSING');
  assert.equal(deepseek?.requestMetrics?.errorsByCode[0]?.count, 2);
  assert.equal(deepseek?.requestMetrics?.requestTrend.length, 6);
  assert.equal(typeof deepseek?.lastUpdatedAt, 'string');
  assert.equal(deepseek?.freshness?.status, 'fresh');
  assert.equal(deepseek?.freshness?.signal, 'request_metrics');
  assert.equal(deepseek?.freshness?.maxAgeSeconds, 900);
  assert.ok((deepseek?.freshness?.ageSeconds ?? 0) >= 0);
});

test('funnel metrics endpoint exposes 24h and 7d payment funnel summaries', async () => {
  const env = createEnv();

  await worker.fetch(
    new Request('https://api-402.com/api/deepseek', {
      headers: { 'X-Request-Id': 'req-window-1' },
    }),
    env,
  );

  await worker.fetch(
    new Request('https://api-402.com/api/deepseek', {
      headers: { Authorization: 'Bearer demo', 'X-Request-Id': 'req-window-1' },
    }),
    env,
  );

  const response24h = await worker.fetch(
    new Request('https://api-402.com/api/v1/metrics/funnel?window=24h'),
    env,
  );
  assert.equal(response24h.status, 200);
  const body24h = (await response24h.json()) as {
    window: '24h' | '7d';
    endpoints: Array<{ path: string; challenged402: number; replayed: number; challengeToReplayConversionRate: number }>;
  };
  assert.equal(body24h.window, '24h');
  const deepseek24h = body24h.endpoints.find((endpoint) => endpoint.path === '/api/deepseek');
  assert.equal(deepseek24h?.challenged402, 1);
  assert.equal(deepseek24h?.replayed, 1);
  assert.equal(deepseek24h?.challengeToReplayConversionRate, 1);

  const response7d = await worker.fetch(
    new Request('https://api-402.com/api/v1/metrics/funnel?window=7d'),
    env,
  );
  const body7d = (await response7d.json()) as { window: '24h' | '7d' };
  assert.equal(body7d.window, '7d');
});

test('valid signed payment payload is accepted', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
      'X-PAYMENT-TX-HASH': '0x1111111111111111111111111111111111111111111111111111111111111111',
    },
  });

  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(payload.from, TEST_PAY_TO, '0.003'),
      eth_blockNumber: () => createBlockNumberResponse('0x101'),
    },
    async () => {
      const response = await worker.fetch(request, createEnv());
      const body = (await response.json()) as {
        _meta: {
          paymentMode: string;
          paid: boolean;
          settlement?: {
            txHash: string;
            requiredConfirmations: number;
            confirmations: number;
            receiptBlock: number | null;
            latestBlock: number | null;
          } | null;
        };
      };

      assert.equal(response.status, 200);
      assert.equal(body._meta.paid, true);
      assert.equal(body._meta.paymentMode, 'PAYMENT_VALID');
      assert.equal(body._meta.settlement?.txHash, '0x1111111111111111111111111111111111111111111111111111111111111111');
      assert.equal(body._meta.settlement?.requiredConfirmations, 2);
      assert.equal(body._meta.settlement?.confirmations, 2);
      assert.equal(body._meta.settlement?.receiptBlock, 256);
      assert.equal(body._meta.settlement?.latestBlock, 257);
    },
  );
});

test('expired signed payment payload is rejected with machine-readable reason', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  payload.deadline = new Date(Date.now() - 60_000).toISOString();
  payload.signature = await Wallet.createRandom().signMessage(JSON.stringify(buildPaymentMessage(payload)));

  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
    },
  });

  const response = await worker.fetch(request, createEnv());
  const body = (await response.json()) as { reason: string };

  assert.equal(response.status, 402);
  assert.equal(body.reason, 'PAYMENT_EXPIRED');
});

test('stale signed payment payload is rejected with machine-readable reason', async () => {
  const issuedAt = new Date(Date.now() - 16 * 60_000).toISOString();
  const deadline = new Date(Date.now() + 60_000).toISOString();
  const payload = await createSignedPayload('/api/deepseek', '0.003', { issuedAt, deadline });
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
      'X-PAYMENT-TX-HASH': '0x5555555555555555555555555555555555555555555555555555555555555555',
    },
  });

  const response = await worker.fetch(request, createEnv());
  const body = (await response.json()) as { reason: string };

  assert.equal(response.status, 402);
  assert.equal(body.reason, 'PAYMENT_STALE');
});

test('signed payment without settlement proof is rejected', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
    },
  });

  const response = await worker.fetch(request, createEnv());
  const body = (await response.json()) as { reason: string };

  assert.equal(response.status, 402);
  assert.equal(body.reason, 'PAYMENT_TX_HASH_MISSING');
});

test('signed payment requires block confirmations before acceptance', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
      'X-PAYMENT-TX-HASH': '0x3333333333333333333333333333333333333333333333333333333333333333',
    },
  });

  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(payload.from, TEST_PAY_TO, '0.003', '0x100'),
      eth_blockNumber: () => createBlockNumberResponse('0x100'),
    },
    async () => {
      const response = await worker.fetch(request, createEnv());
      const body = (await response.json()) as {
        reason: string;
        settlementConfirmationsRequired?: number;
        settlementPolicy?: {
          recommendedRetryAfterSeconds: number;
          requiredConfirmations: number;
          averageBlockSeconds: number;
        };
        settlement?: {
          txHash: string;
          requiredConfirmations: number;
          confirmations: number;
          receiptBlock: number | null;
          latestBlock: number | null;
        };
      };

      assert.equal(response.status, 402);
      assert.equal(body.reason, 'PAYMENT_TX_NOT_CONFIRMED');
      assert.equal(body.settlementConfirmationsRequired, 2);
      assert.equal(response.headers.get('Retry-After'), '2');
      assert.equal(body.settlementPolicy?.recommendedRetryAfterSeconds, 2);
      assert.equal(body.settlementPolicy?.requiredConfirmations, 2);
      assert.equal(body.settlementPolicy?.averageBlockSeconds, 2);
      assert.equal(body.settlement?.txHash, '0x3333333333333333333333333333333333333333333333333333333333333333');
      assert.equal(body.settlement?.requiredConfirmations, 2);
      assert.equal(body.settlement?.confirmations, 1);
      assert.equal(body.settlement?.receiptBlock, 256);
      assert.equal(body.settlement?.latestBlock, 256);
    },
  );
});

test('signed payment with stale settlement proof is rejected', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
      'X-PAYMENT-TX-HASH': '0x6666666666666666666666666666666666666666666666666666666666666666',
    },
  });

  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(payload.from, TEST_PAY_TO, '0.003', '0x1'),
      eth_blockNumber: () => createBlockNumberResponse('0x1c22'),
    },
    async () => {
      const response = await worker.fetch(request, createEnv());
      const body = (await response.json()) as {
        reason: string;
        maxSettlementAgeBlocks?: number;
        settlement?: {
          confirmations: number;
          receiptBlock: number | null;
          latestBlock: number | null;
        };
      };

      assert.equal(response.status, 402);
      assert.equal(body.reason, 'PAYMENT_TX_TOO_OLD');
      assert.equal(body.maxSettlementAgeBlocks, 7200);
      assert.equal(body.settlement?.receiptBlock, 1);
      assert.equal(body.settlement?.latestBlock, 7202);
      assert.ok((body.settlement?.confirmations || 0) > 7200);
    },
  );
});

test('replayed signed payment nonce is rejected', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
      'X-PAYMENT-TX-HASH': '0x2222222222222222222222222222222222222222222222222222222222222222',
    },
  });

  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(payload.from, TEST_PAY_TO, '0.003'),
      eth_blockNumber: () => createBlockNumberResponse('0x101'),
    },
    async () => {
      const firstResponse = await worker.fetch(request, createEnv());
      const secondResponse = await worker.fetch(request, createEnv());
      const body = (await secondResponse.json()) as { reason: string };

      assert.equal(firstResponse.status, 200);
      assert.equal(secondResponse.status, 402);
      assert.equal(body.reason, 'PAYMENT_NONCE_REPLAYED');
    },
  );
});

test('payment verification falls back to secondary Base RPC when primary fails', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
      'X-PAYMENT-TX-HASH': '0x4444444444444444444444444444444444444444444444444444444444444444',
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const body = init?.body ? (JSON.parse(String(init.body)) as { method?: string }) : {};

    if (url.includes('rpc-primary.example')) {
      return new Response(JSON.stringify({ error: 'primary down' }), { status: 503 });
    }

    if (!url.includes('rpc-backup.example')) {
      return new Response(JSON.stringify({ error: 'unknown rpc target' }), { status: 500 });
    }

    if (body.method === 'eth_getTransactionReceipt') {
      return new Response(JSON.stringify(createTransferReceipt(payload.from, TEST_PAY_TO, '0.003')), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify(createBlockNumberResponse('0x101')), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported RPC method in test' }), { status: 500 });
  };

  try {
    const response = await worker.fetch(request, {
      ...createEnv(),
      BASE_RPC_URLS: 'https://rpc-primary.example, https://rpc-backup.example',
    });
    const body = (await response.json()) as { _meta: { paid: boolean; paymentMode: string } };

    assert.equal(response.status, 200);
    assert.equal(body._meta.paid, true);
    assert.equal(body._meta.paymentMode, 'PAYMENT_VALID');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('whale positions endpoint proxies live upstream trades when available', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as { coin?: string }) : {};
    const coin = body.coin || 'BTC';

    const payload = [
      {
        coin,
        side: 'A',
        px: coin === 'BTC' ? '68000' : '2000',
        sz: '12',
        time: 1700000000000,
        users: ['0x1111111111111111111111111111111111111111', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      },
      {
        coin,
        side: 'B',
        px: coin === 'BTC' ? '68010' : '2001',
        sz: '6',
        time: 1700000001000,
        users: ['0x1111111111111111111111111111111111111111', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      },
    ];

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const request = new Request('https://api-402.com/api/whale-positions', {
      headers: { Authorization: 'Bearer demo' },
    });

    const response = await worker.fetch(request, createEnv());
    const body = (await response.json()) as {
      source?: string;
      sampledTrades?: number;
      positions?: Array<{ address: string; trades: number; notionalUsd: number }>;
      _meta: {
        origin: string;
        upstream?: { source: string; status: string; reasonCode: string; retryable: boolean };
      };
    };

    assert.equal(response.status, 200);
    assert.equal(body.source, 'hyperliquid');
    assert.equal(body.sampledTrades, 4);
    assert.equal(body._meta.origin, 'proxied');
    assert.equal(body._meta.upstream?.status, 'live');
    assert.equal(body._meta.upstream?.reasonCode, 'OK');
    assert.equal(body.positions?.[0]?.address, '0x1111111111111111111111111111111111111111');
    assert.equal(body.positions?.[0]?.trades, 4);
    assert.ok((body.positions?.[0]?.notionalUsd || 0) > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('upstream circuit breaker opens after repeated failures and returns machine-readable fallback reason', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('simulated upstream outage');
  };

  try {
    const request = new Request('https://api-402.com/api/btc-price', {
      headers: { Authorization: 'Bearer demo' },
    });

    const first = await worker.fetch(request, createEnv());
    const second = await worker.fetch(request, createEnv());
    const third = await worker.fetch(request, createEnv());
    const fourth = await worker.fetch(request, createEnv());

    const firstBody = (await first.json()) as { _meta: { upstream?: { reasonCode: string } } };
    const thirdBody = (await third.json()) as { _meta: { upstream?: { reasonCode: string } } };
    const fourthBody = (await fourth.json()) as { _meta: { upstream?: { reasonCode: string; status: string } } };

    assert.equal(firstBody._meta.upstream?.reasonCode, 'UPSTREAM_FETCH_FAILED');
    assert.equal(thirdBody._meta.upstream?.reasonCode, 'UPSTREAM_FETCH_FAILED');
    assert.equal(fourthBody._meta.upstream?.reasonCode, 'UPSTREAM_CIRCUIT_OPEN');
    assert.equal(fourthBody._meta.upstream?.status, 'fallback');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('settlement status endpoint returns pending with retry guidance', async () => {
  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(TEST_PAY_TO, TEST_PAY_TO, '0.003', '0x100'),
      eth_blockNumber: () => createBlockNumberResponse('0x100'),
    },
    async () => {
      const response = await worker.fetch(
        new Request('https://api-402.com/api/v1/settlement/0x7777777777777777777777777777777777777777777777777777777777777777', {
          headers: { 'X-Request-Id': 'req-settlement-1' },
        }),
        createEnv(),
      );
      const body = (await response.json()) as {
        code: string;
        requestId?: string;
        settlementPolicy?: { recommendedRetryAfterSeconds: number };
        remediation?: { retryable: boolean; retryAfterSeconds?: number };
        remediationSchemaVersion?: string;
        remediationCompatibility?: string;
        remediationRefs?: { changelog: string; deprecations: string };
        settlement?: { confirmations: number; requiredConfirmations: number };
      };

      assert.equal(response.status, 409);
      assert.equal(body.code, 'SETTLEMENT_PENDING');
      assert.equal(body.requestId, 'req-settlement-1');
      assert.equal(response.headers.get('X-Request-Id'), 'req-settlement-1');
      assert.equal(body.settlement?.confirmations, 1);
      assert.equal(body.settlement?.requiredConfirmations, 2);
      assert.equal(body.settlementPolicy?.recommendedRetryAfterSeconds, 2);
      assert.equal(body.remediation?.retryable, true);
      assert.equal(body.remediation?.retryAfterSeconds, 2);
      assert.equal(body.remediationSchemaVersion, '1.0.0');
      assert.equal(body.remediationCompatibility, 'semver-minor-backward-compatible');
      assert.equal(
        body.remediationRefs?.changelog,
        'https://api-402.com/.well-known/remediation-changelog.json',
      );
      assert.equal(
        body.remediationRefs?.deprecations,
        'https://api-402.com/.well-known/remediation-deprecations.json',
      );
      assert.equal(response.headers.get('Retry-After'), '2');
      assert.equal(response.headers.get('X-Settlement-Status'), 'SETTLEMENT_PENDING');
    },
  );
});

test('settlement status endpoint returns ready when confirmations are satisfied', async () => {
  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(TEST_PAY_TO, TEST_PAY_TO, '0.003', '0x100'),
      eth_blockNumber: () => createBlockNumberResponse('0x101'),
    },
    async () => {
      const response = await worker.fetch(
        new Request('https://api-402.com/api/v1/settlement/0x8888888888888888888888888888888888888888888888888888888888888888'),
        createEnv(),
      );
      const body = (await response.json()) as {
        code: string;
        settlement?: { confirmations: number; requiredConfirmations: number };
      };

      assert.equal(response.status, 200);
      assert.equal(body.code, 'SETTLEMENT_READY');
      assert.equal(body.settlement?.confirmations, 2);
      assert.equal(body.settlement?.requiredConfirmations, 2);
      assert.equal(response.headers.get('X-Settlement-Status'), 'SETTLEMENT_READY');
    },
  );
});

test('settlement status endpoint can verify payment proof binding', async () => {
  const txHash = '0x9999999999999999999999999999999999999999999999999999999999999999';
  const payload = await createSignedPayload('/api/deepseek', '0.003');

  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(payload.from, TEST_PAY_TO, '0.003', '0x100'),
      eth_blockNumber: () => createBlockNumberResponse('0x101'),
    },
    async () => {
      const response = await worker.fetch(
        new Request(`https://api-402.com/api/v1/settlement/${txHash}?payer=${payload.from}&resource=/api/deepseek`, {
          headers: {
            'PAYMENT-SIGNATURE': encodeBase64(payload),
          },
        }),
        createEnv(),
      );
      const body = (await response.json()) as {
        code: string;
        settlementProof?: {
          verified: boolean;
          payer: string;
          resource: string;
          requestedAmount: string;
          transferredAmount: string | null;
        } | null;
      };

      assert.equal(response.status, 200);
      assert.equal(body.code, 'SETTLEMENT_READY');
      assert.equal(body.settlementProof?.verified, true);
      assert.equal(body.settlementProof?.payer, payload.from);
      assert.equal(body.settlementProof?.resource, '/api/deepseek');
      assert.equal(body.settlementProof?.requestedAmount, '0.003');
      assert.equal(body.settlementProof?.transferredAmount, '3000');
    },
  );
});

test('settlement status endpoint rejects proof when resource filter mismatches', async () => {
  const txHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const payload = await createSignedPayload('/api/deepseek', '0.003');

  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(payload.from, TEST_PAY_TO, '0.003', '0x100'),
      eth_blockNumber: () => createBlockNumberResponse('0x101'),
    },
    async () => {
      const response = await worker.fetch(
        new Request(`https://api-402.com/api/v1/settlement/${txHash}?resource=/api/qwen`, {
          headers: {
            'PAYMENT-SIGNATURE': encodeBase64(payload),
          },
        }),
        createEnv(),
      );
      const body = (await response.json()) as { code: string };

      assert.equal(response.status, 409);
      assert.equal(body.code, 'SETTLEMENT_PROOF_MISMATCH');
    },
  );
});

test('settlement status endpoint supports payTo and minAmount filters without signature proof', async () => {
  const txHash = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(TEST_PAY_TO, TEST_PAY_TO, '0.005', '0x100'),
      eth_blockNumber: () => createBlockNumberResponse('0x101'),
    },
    async () => {
      const response = await worker.fetch(
        new Request(`https://api-402.com/api/v1/settlement/${txHash}?payTo=${TEST_PAY_TO}&minAmount=0.004`),
        createEnv(),
      );
      const body = (await response.json()) as {
        code: string;
        settlementProof?: {
          verified: boolean;
          payTo: string;
          minAmountFilter: string;
          transferredAmount: string;
          mode: string;
        } | null;
      };

      assert.equal(response.status, 200);
      assert.equal(body.code, 'SETTLEMENT_READY');
      assert.equal(body.settlementProof?.verified, true);
      assert.equal(body.settlementProof?.payTo, TEST_PAY_TO.toLowerCase());
      assert.equal(body.settlementProof?.minAmountFilter, '0.004');
      assert.equal(body.settlementProof?.transferredAmount, '5000');
      assert.equal(body.settlementProof?.mode, 'receipt-log-filter');
    },
  );
});

test('settlement status endpoint rejects when minAmount filter is not satisfied', async () => {
  const txHash = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

  await withMockedFetch(
    {
      eth_getTransactionReceipt: () => createTransferReceipt(TEST_PAY_TO, TEST_PAY_TO, '0.002', '0x100'),
      eth_blockNumber: () => createBlockNumberResponse('0x101'),
    },
    async () => {
      const response = await worker.fetch(
        new Request(`https://api-402.com/api/v1/settlement/${txHash}?payTo=${TEST_PAY_TO}&minAmount=0.003`),
        createEnv(),
      );
      const body = (await response.json()) as { code: string };

      assert.equal(response.status, 409);
      assert.equal(body.code, 'SETTLEMENT_PROOF_MISMATCH');
    },
  );
});
