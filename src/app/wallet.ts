import { BrowserProvider, Interface, parseUnits } from 'ethers';
import type { CatalogEndpoint, EthereumProvider } from '../types';
import { BASE_CHAIN_CONFIG, BASE_CHAIN_ID_HEX, BASE_USDC_CONTRACT } from './config';
import { escapeHtml, getElement, shortenAddress } from './dom';
import { getGatewayPayTo, getGatewayTxExplorerUrl } from './format';
import { t } from './i18n';
import { state } from './state';

const USDC_INTERFACE = new Interface(['function transfer(address to, uint256 amount) returns (bool)']);

export function getWalletProvider(type: 'coinbase' | 'metamask' | 'rabby') {
  const ethereum = window.ethereum;
  if (!ethereum) {
    return null;
  }

  const providers = ethereum.providers && ethereum.providers.length > 0 ? ethereum.providers : [ethereum];

  if (type === 'rabby') {
    return providers.find((provider) => provider.isRabby) || null;
  }

  if (type === 'metamask') {
    return providers.find((provider) => provider.isMetaMask && !provider.isRabby) || ethereum;
  }

  return ethereum;
}

export function logLine(
  message: string,
  tone: 'default' | 'info' | 'success' | 'warning' | 'danger' = 'default',
) {
  const palette: Record<string, string> = {
    default: 'text-slate-300',
    info: 'text-[#8de7ff]',
    success: 'text-[#33f0b2]',
    warning: 'text-[#ffcf66]',
    danger: 'text-[#ff8f8f]',
  };

  return `<div class="${palette[tone] || palette.default}">${escapeHtml(message)}</div>`;
}

export function getWalletCapability(type: string): 'demo' | 'live' | 'pending' {
  if (type === 'Demo') {
    return 'demo';
  }

  if (type === 'Rabby Wallet') {
    return 'live';
  }

  return 'pending';
}

export function getWalletModeDescription(type: string): string {
  const capability = getWalletCapability(type);
  if (capability === 'live') {
    return t('dynamic.walletFeatureActive');
  }

  if (capability === 'demo') {
    return t('dynamic.walletFeatureDemo');
  }

  return t('dynamic.walletFeaturePending');
}

export function getReplayModeLabel(type: string): string {
  const capability = getWalletCapability(type);
  if (capability === 'live') {
    return t('dynamic.replayRabby');
  }

  if (capability === 'demo') {
    return t('dynamic.replayDemo');
  }

  return t('dynamic.replayManual');
}

function encodeBase64Json(value: Record<string, unknown>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

export function getEndpointRequestConfig(endpoint: CatalogEndpoint): {
  method: string;
  body: string | null;
  headers: Record<string, string>;
} {
  const method = (endpoint.method || 'GET').toUpperCase();
  if (method === 'POST') {
    const requestBody =
      endpoint.path === '/api/qwen'
        ? {
            prompt: 'Summarize why x402 micropayments are useful for API monetization in one sentence.',
          }
        : {
            messages: [{ role: 'user', content: 'Explain x402 payments in one sentence.' }],
          };

    return {
      method,
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  return {
    method,
    body: null,
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

function getConfirmationTarget(): number {
  return state.catalog?.payment.settlementConfirmationsRequired || 2;
}

async function ensureBaseNetwork(provider: EthereumProvider) {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'number' ? error.code : null;
    if (code !== 4902) {
      throw error;
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [BASE_CHAIN_CONFIG],
    });
  }
}

export function getWalletErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: number }).code;
    if (code === 4001) {
      return t('dynamic.walletRejected');
    }
  }

  return error instanceof Error ? error.message : 'Unknown wallet error';
}

export async function executeDemoReplay(
  requestUrl: string,
  requestConfig: ReturnType<typeof getEndpointRequestConfig>,
  resultEl: HTMLDivElement,
) {
  resultEl.innerHTML += logLine(t('dynamic.replaying'), 'success');
  const paid = await fetch(requestUrl, {
    method: requestConfig.method,
    headers: {
      ...requestConfig.headers,
      Authorization: 'Bearer demo',
    },
    body: requestConfig.body,
  });

  if (!paid.ok) {
    resultEl.innerHTML += logLine(t('dynamic.replayFailed', { status: paid.status }), 'danger');
    return;
  }

  const data = await paid.json();
  resultEl.innerHTML += logLine(t('dynamic.replaySucceeded'), 'success');
  resultEl.innerHTML += `<pre class="mt-3 whitespace-pre-wrap break-all text-[#8de7ff]">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
}

export async function executeRabbyReplay(
  requestUrl: string,
  endpoint: CatalogEndpoint,
  requestConfig: ReturnType<typeof getEndpointRequestConfig>,
  challenge: { payTo?: string; price?: string; currency?: string; tokenContract?: string },
  resultEl: HTMLDivElement,
) {
  if (!state.walletProvider || !state.walletAddress) {
    throw new Error(t('dynamic.walletMissing'));
  }

  const payTo = challenge.payTo || getGatewayPayTo();
  const amount = challenge.price || endpoint.price;
  const tokenContract = challenge.tokenContract || state.catalog?.payment.tokenContract || BASE_USDC_CONTRACT;
  if (!payTo || !amount || !tokenContract) {
    throw new Error(t('dynamic.challengeInvalid'));
  }

  resultEl.innerHTML += logLine(t('dynamic.replayingRabby'), 'success');
  resultEl.innerHTML += logLine(t('dynamic.switchingBase'), 'info');
  await ensureBaseNetwork(state.walletProvider);
  resultEl.innerHTML += logLine(t('dynamic.baseReady'), 'success');

  const browserProvider = new BrowserProvider(state.walletProvider);
  const signer = await browserProvider.getSigner();
  const now = Date.now();
  const payload = {
    version: '1',
    scheme: 'exact',
    network: 'base',
    currency: 'USDC',
    payTo,
    from: state.walletAddress,
    amount,
    resource: endpoint.path,
    nonce: crypto.randomUUID(),
    deadline: new Date(now + 10 * 60 * 1000).toISOString(),
    issuedAt: new Date(now).toISOString(),
  };

  resultEl.innerHTML += logLine(t('dynamic.signingPayload'), 'info');
  const signature = await signer.signMessage(JSON.stringify(payload));
  resultEl.innerHTML += logLine(t('dynamic.signatureReady'), 'success');

  resultEl.innerHTML += logLine(t('dynamic.submittingTransfer'), 'info');
  const txRequest = {
    to: tokenContract,
    data: USDC_INTERFACE.encodeFunctionData('transfer', [payTo, parseUnits(amount, 6)]),
  };
  const txResponse = await signer.sendTransaction(txRequest);
  if (!txResponse.hash) {
    throw new Error(t('dynamic.txMissing'));
  }

  resultEl.innerHTML += logLine(t('dynamic.transferSubmitted', { txHash: txResponse.hash }), 'success');
  resultEl.innerHTML += `<div class="text-slate-400"><a href="${escapeHtml(getGatewayTxExplorerUrl(txResponse.hash))}" target="_blank" rel="noreferrer" class="underline">${escapeHtml(getGatewayTxExplorerUrl(txResponse.hash))}</a></div>`;

  const confirmations = getConfirmationTarget();
  resultEl.innerHTML += logLine(t('dynamic.waitingConfirmations', { count: confirmations }), 'info');
  await browserProvider.waitForTransaction(txResponse.hash, confirmations, 180000);
  resultEl.innerHTML += logLine(t('dynamic.confirmationsReady'), 'success');

  const paid = await fetch(requestUrl, {
    method: requestConfig.method,
    headers: {
      ...requestConfig.headers,
      'PAYMENT-SIGNATURE': encodeBase64Json({
        ...payload,
        signature,
      }),
      'X-PAYMENT-TX-HASH': txResponse.hash,
    },
    body: requestConfig.body,
  });

  if (!paid.ok) {
    resultEl.innerHTML += logLine(t('dynamic.replayFailed', { status: paid.status }), 'danger');
    const responseText = await paid.text();
    if (responseText) {
      resultEl.innerHTML += `<pre class="mt-3 whitespace-pre-wrap break-all text-[#ff8f8f]">${escapeHtml(responseText)}</pre>`;
    }
    return;
  }

  const data = await paid.json();
  resultEl.innerHTML += logLine(t('dynamic.replaySucceeded'), 'success');
  resultEl.innerHTML += `<pre class="mt-3 whitespace-pre-wrap break-all text-[#8de7ff]">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
}

export function openWalletModal() {
  getElement<HTMLDivElement>('walletModal').classList.remove('hidden');
  getElement<HTMLDivElement>('walletModal').classList.add('flex');
}

export function closeWalletModal() {
  getElement<HTMLDivElement>('walletModal').classList.add('hidden');
  getElement<HTMLDivElement>('walletModal').classList.remove('flex');
}

export async function connectWallet(type: 'coinbase' | 'metamask' | 'rabby') {
  const provider = getWalletProvider(type);
  if (type !== 'rabby') {
    closeWalletModal();
    state.walletConnected = true;
    state.walletType = type === 'coinbase' ? 'Coinbase Wallet' : 'MetaMask';
    state.walletAddress = provider ? state.walletAddress || getGatewayPayTo() : getGatewayPayTo();
    state.walletProvider = provider;
    updateWalletUI();
    window.alert(t('dynamic.walletInDevelopment', { walletType: state.walletType }));
    return;
  }

  closeWalletModal();

  let address = '';
  try {
    if (provider && typeof provider.request === 'function') {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (Array.isArray(accounts)) {
        address = String(accounts[0] || '');
      }
      state.walletType = 'Rabby Wallet';
      state.walletProvider = provider;
    }
  } catch (error) {
    console.log('wallet connect failed, fallback to demo', error);
  }

  if (!address) {
    state.walletProvider = null;
    throw new Error(t('dynamic.walletMissing'));
  }

  state.walletConnected = true;
  state.walletAddress = address;
  updateWalletUI();
}

export function connectDemo() {
  state.walletConnected = true;
  state.walletType = 'Demo';
  state.walletAddress = getGatewayPayTo();
  state.walletProvider = null;
  closeWalletModal();
  updateWalletUI();
}

export function updateWalletUI() {
  const button = getElement<HTMLButtonElement>('connectWallet');
  button.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${escapeHtml(shortenAddress(state.walletAddress))}`;
  getElement<HTMLDivElement>('paymentDetails').innerHTML = `
    <div>${t('dynamic.walletLabel')}: <span class="text-white">${escapeHtml(state.walletType || t('dynamic.walletNotConnected'))}</span></div>
    <div>${t('dynamic.gatewayReceiver')}: <span class="text-white">${escapeHtml(shortenAddress(getGatewayPayTo()))}</span></div>
    <div>${t('dynamic.replayMode')}: <span class="text-[#33f0b2]">${escapeHtml(getReplayModeLabel(state.walletType))}</span></div>
  `;
}
