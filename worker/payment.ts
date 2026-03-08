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

export type SettlementStatusResult = {
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

export type RemediationHint = {
  retryable: boolean;
  action: string;
  retryAfterSeconds?: number;
};

export type RemediationRefs = {
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

export type JsonRpcReceiptLog = {
  address?: string;
  topics?: string[];
  data?: string;
};

export type JsonRpcTransactionReceipt = {
  status?: string;
  blockNumber?: string;
  logs?: JsonRpcReceiptLog[];
};

export const DEFAULT_PAY_TO = '0x0A5312e03C1fb2b64569fAF61aD2c6517cCB0D18';
export const DEFAULT_PAYMENT_MIN_CONFIRMATIONS = 2;
export const DEFAULT_PAYMENT_MAX_AGE_SECONDS = 15 * 60;
export const DEFAULT_PAYMENT_MAX_FUTURE_SKEW_SECONDS = 2 * 60;
export const DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS = 7200;
export const BASE_CONFIRMATION_AVG_SECONDS = 2;
export const BASE_SETTLEMENT_RETRY_FLOOR_SECONDS = 2;
export const BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const PAYMENT_TX_HASH_HEADER = 'X-PAYMENT-TX-HASH';
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const DEMO_PAYMENT_TOKEN = 'demo';
export const SETTLEMENT_PATH_PREFIX = '/api/v1/settlement/';
export const REMEDIATION_CHANGELOG_PATH = '/.well-known/remediation-changelog.json';
export const REMEDIATION_DEPRECATIONS_PATH = '/.well-known/remediation-deprecations.json';
export const REMEDIATION_SCHEMA_VERSION = '1.0.0';
export const REMEDIATION_COMPATIBILITY = 'semver-minor-backward-compatible';

export const SETTLEMENT_REMEDIATION_MAP: Record<SettlementStatusResult['code'], RemediationHint> = {
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

export const PAYMENT_REMEDIATION_MAP: Partial<Record<PaymentVerificationResult['code'], RemediationHint>> = {
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

export function parseAmount(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

export function encodeJsonBase64(value: unknown): string {
  return btoa(JSON.stringify(value));
}

export function decodeBase64Json(value: string): unknown | null {
  try {
    const normalized = value.startsWith('Bearer ') ? value.slice(7).trim() : value.trim();
    const decoded = atob(normalized);
    return JSON.parse(decoded) as unknown;
  } catch {
    return null;
  }
}

export function parseMinConfirmations(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PAYMENT_MIN_CONFIRMATIONS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PAYMENT_MIN_CONFIRMATIONS;
  }

  return parsed;
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function parseTokenAmount(value: string, decimals: number): bigint | null {
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

export function normalizeTopicAddress(value: string | undefined): string | null {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    return null;
  }

  return `0x${value.slice(-40)}`.toLowerCase();
}

export function parseHexBlockNumber(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

export function getPaymentTxHash(request: Request): string | null {
  return request.headers.get(PAYMENT_TX_HASH_HEADER);
}

export function isTransactionHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function isHexAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
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

export function isPaymentPayload(value: unknown): value is PaymentPayload {
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

export function findMatchingTransferAmount(
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

export function findLargestTransferAmountTo(
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

export function buildSettlementPolicy(
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

export function buildRemediation(
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

export function buildRemediationRefs(baseUrl: string): RemediationRefs {
  return {
    changelog: `${baseUrl}${REMEDIATION_CHANGELOG_PATH}`,
    deprecations: `${baseUrl}${REMEDIATION_DEPRECATIONS_PATH}`,
  };
}
