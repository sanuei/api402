import { verifyMessage } from 'ethers';

import {
  BASE_USDC_CONTRACT,
  DEFAULT_PAY_TO,
  DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
  REMEDIATION_COMPATIBILITY,
  REMEDIATION_SCHEMA_VERSION,
  SETTLEMENT_PATH_PREFIX,
  SETTLEMENT_REMEDIATION_MAP,
  buildPaymentMessage,
  buildRemediation,
  buildRemediationRefs,
  buildSettlementPolicy,
  decodeBase64Json,
  findLargestTransferAmountTo,
  findMatchingTransferAmount,
  isHexAddress,
  isPaymentPayload,
  isTransactionHash,
  parseHexBlockNumber,
  parseMinConfirmations,
  parsePositiveInt,
  parseTokenAmount,
  type JsonRpcTransactionReceipt,
  type PaymentSettlementContext,
  type SettlementStatusResult,
} from './payment';

export interface SettlementRouteEnv {
  PAY_TO?: string;
  PAYMENT_MIN_CONFIRMATIONS?: string;
  PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS?: string;
}

type SettlementRouteDeps<Env extends SettlementRouteEnv> = {
  apiResponse: (body: unknown, init?: ResponseInit) => Response;
  callBaseRpc: (env: Env, method: string, params: unknown[]) => Promise<unknown>;
  getRequestId: (request: Request) => string;
  requestIdHeader: string;
};

async function getSettlementStatus<Env extends SettlementRouteEnv>(
  env: Env,
  txHash: string,
  minConfirmations: number,
  maxSettlementAgeBlocks: number,
  deps: Pick<SettlementRouteDeps<Env>, 'callBaseRpc'>,
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
    receipt = (await deps.callBaseRpc(env, 'eth_getTransactionReceipt', [txHash])) as JsonRpcTransactionReceipt | null;
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
    const latestBlockHex = await deps.callBaseRpc(env, 'eth_blockNumber', []);
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

export async function createSettlementStatusResponse<Env extends SettlementRouteEnv>(
  request: Request,
  env: Env,
  deps: SettlementRouteDeps<Env>,
): Promise<Response> {
  const url = new URL(request.url);
  const remediationRefs = buildRemediationRefs(url.origin);
  const txHash = decodeURIComponent(url.pathname.slice(SETTLEMENT_PATH_PREFIX.length));
  const minConfirmations = parseMinConfirmations(env.PAYMENT_MIN_CONFIRMATIONS);
  const maxSettlementAgeBlocks = parsePositiveInt(
    env.PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
    DEFAULT_PAYMENT_MAX_SETTLEMENT_AGE_BLOCKS,
  );
  const payTo = env.PAY_TO || DEFAULT_PAY_TO;
  const requestId = deps.getRequestId(request);

  if (!isTransactionHash(txHash)) {
    return deps.apiResponse(
      {
        code: 'INVALID_TX_HASH',
        message: 'Settlement query requires a valid 32-byte transaction hash.',
      },
      { status: 400 },
    );
  }

  const statusResult = await getSettlementStatus(env, txHash, minConfirmations, maxSettlementAgeBlocks, deps);
  const settlementPolicy = buildSettlementPolicy(minConfirmations, maxSettlementAgeBlocks, statusResult.settlement);
  const statusCode = statusResult.code === 'SETTLEMENT_RPC_FAILED' ? 503 : statusResult.ok ? 200 : 409;
  const headers: Record<string, string> = {
    'X-Settlement-Status': statusResult.code,
    [deps.requestIdHeader]: requestId,
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
    return deps.apiResponse(
      {
        code: 'INVALID_SETTLEMENT_FILTER',
        message: 'payTo filter must be a valid 20-byte hex address.',
      },
      { status: 400 },
    );
  }

  if (minAmountFilterRaw && minAmountFilter === null) {
    return deps.apiResponse(
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
      return deps.apiResponse(
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
        return deps.apiResponse(
          {
            code: 'SETTLEMENT_PROOF_INVALID',
            message: 'Settlement proof signature does not match the payer address.',
          },
          { status: 400 },
        );
      }
    } catch {
      return deps.apiResponse(
        {
          code: 'SETTLEMENT_PROOF_INVALID',
          message: 'Settlement proof signature verification failed.',
        },
        { status: 400 },
      );
    }

    if (proofPayload.payTo.toLowerCase() !== expectedPayTo) {
      return deps.apiResponse(
        {
          code: 'SETTLEMENT_PROOF_MISMATCH',
          message: 'Settlement proof payTo does not match the requested payTo filter.',
        },
        { status: 409 },
      );
    }

    if (payerFilter && proofPayload.from.toLowerCase() !== payerFilter) {
      return deps.apiResponse(
        {
          code: 'SETTLEMENT_PROOF_MISMATCH',
          message: 'Settlement proof payer does not match the requested payer filter.',
        },
        { status: 409 },
      );
    }

    if (resourceFilter && proofPayload.resource !== resourceFilter) {
      return deps.apiResponse(
        {
          code: 'SETTLEMENT_PROOF_MISMATCH',
          message: 'Settlement proof resource does not match the requested resource filter.',
        },
        { status: 409 },
      );
    }

    const minimumAmount = parseTokenAmount(proofPayload.amount, 6);
    if (minimumAmount === null) {
      return deps.apiResponse(
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
      return deps.apiResponse(
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
      return deps.apiResponse(
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

  return deps.apiResponse(
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
