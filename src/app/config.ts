const REMOTE_API_BASE = 'https://api-market-x402.sonic980828.workers.dev';

export const SITE_URL = 'https://api-402.com/';
export const DEFAULT_GATEWAY_PAY_TO = '0x0A5312e03C1fb2b64569fAF61aD2c6517cCB0D18';
export const BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const SAME_ORIGIN_HOST_PATTERNS = [/api-402\.com$/, /workers\.dev$/];
export const BASE_CHAIN_ID_HEX = '0x2105';
export const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

function resolveApiBase(): string {
  const host = window.location.hostname;
  const canUseSameOrigin = SAME_ORIGIN_HOST_PATTERNS.some((pattern) => pattern.test(host));
  return canUseSameOrigin ? window.location.origin : REMOTE_API_BASE;
}

export const API_BASE = resolveApiBase();
