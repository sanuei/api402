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

function createEnv(): Env {
  return {
    APP_NAME: 'API Market',
    PAY_TO: TEST_PAY_TO,
    ASSETS: {
      fetch: async () => new Response('<html>ok</html>', { headers: { 'Content-Type': 'text/html' } }),
    } as unknown as Fetcher,
  };
}

function encodeBase64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

async function createSignedPayload(path: string, amount: string): Promise<PaymentPayload> {
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

function createTransferReceipt(from: string, to: string, amount: string) {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: {
      status: '0x1',
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

async function withMockedFetch<T>(
  receiptFactory: () => Record<string, unknown>,
  handler: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(receiptFactory()), {
      headers: { 'Content-Type': 'application/json' },
    });

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
      payloadSchema: { requiredFields: string[] };
    };
    endpoints: Array<{
      exampleRequest: unknown;
      exampleResponse: unknown;
      status: string;
      tags: string[];
      locales?: { zh?: { label?: string }; en?: { label?: string } };
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.payment.payTo, TEST_PAY_TO);
  assert.equal(body.payment.currency, 'USDC');
  assert.equal(body.payment.chainId, 8453);
  assert.equal(body.payment.tokenContract, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  assert.equal(body.payment.acceptance, 'base-mainnet-usdc-only');
  assert.equal(body.payment.settlementProofHeader, 'X-PAYMENT-TX-HASH');
  assert.ok(body.payment.payloadSchema.requiredFields.includes('signature'));
  assert.ok(body.endpoints.length >= API_ENDPOINTS.length);
  assert.equal(body.endpoints[0].status !== undefined, true);
  assert.equal(Array.isArray(body.endpoints[0].tags), true);
  assert.ok(body.endpoints[0].exampleRequest);
  assert.ok(body.endpoints[0].exampleResponse);
  assert.equal(typeof body.endpoints[0].locales?.zh?.label, 'string');
  assert.equal(typeof body.endpoints[0].locales?.en?.label, 'string');
});

test('health endpoint returns status information', async () => {
  const response = await worker.fetch(new Request('https://api-402.com/api/v1/health'), createEnv());
  const body = (await response.json()) as { status: string; endpoints: number };

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.endpoints, API_ENDPOINTS.length);
});

test('unpaid request returns a 402 challenge with reason code', async () => {
  const response = await worker.fetch(new Request('https://api-402.com/api/deepseek'), createEnv());
  const body = (await response.json()) as { code: string; reason: string };

  assert.equal(response.status, 402);
  assert.equal(body.code, 'PAYMENT_REQUIRED');
  assert.equal(body.reason, 'PAYMENT_MISSING');
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

test('valid signed payment payload is accepted', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
      'X-PAYMENT-TX-HASH': '0x1111111111111111111111111111111111111111111111111111111111111111',
    },
  });

  await withMockedFetch(
    () => createTransferReceipt(payload.from, TEST_PAY_TO, '0.003'),
    async () => {
    const response = await worker.fetch(request, createEnv());
    const body = (await response.json()) as { _meta: { paymentMode: string; paid: boolean } };

    assert.equal(response.status, 200);
    assert.equal(body._meta.paid, true);
    assert.equal(body._meta.paymentMode, 'PAYMENT_VALID');
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

test('replayed signed payment nonce is rejected', async () => {
  const payload = await createSignedPayload('/api/deepseek', '0.003');
  const request = new Request('https://api-402.com/api/deepseek', {
    headers: {
      'PAYMENT-SIGNATURE': encodeBase64(payload),
      'X-PAYMENT-TX-HASH': '0x2222222222222222222222222222222222222222222222222222222222222222',
    },
  });

  await withMockedFetch(
    () => createTransferReceipt(payload.from, TEST_PAY_TO, '0.003'),
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
