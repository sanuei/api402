import type { CatalogEndpoint, CatalogResponse } from '../types';
import type { EthereumProvider } from '../types';

export type Language = 'zh' | 'en';

const LANGUAGE_STORAGE_KEY = 'api-market-language';

function normalizeLanguage(value: string | null | undefined): Language | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.startsWith('zh')) {
    return 'zh';
  }

  if (normalized.startsWith('en')) {
    return 'en';
  }

  return null;
}

const DEFAULT_LANGUAGE: Language =
  typeof window !== 'undefined'
    ? (normalizeLanguage(new URLSearchParams(window.location.search).get('lang')) ||
        normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) ||
        normalizeLanguage(navigator.language) ||
        'en')
    : 'en';

export const state: {
  walletConnected: boolean;
  walletAddress: string;
  walletType: string;
  walletProvider: EthereumProvider | null;
  currentAPI: string;
  catalog: CatalogResponse | null;
  selectedEndpoint: CatalogEndpoint | null;
  currentLanguage: Language;
} = {
  walletConnected: false,
  walletAddress: '',
  walletType: '',
  walletProvider: null,
  currentAPI: '',
  catalog: null,
  selectedEndpoint: null,
  currentLanguage: DEFAULT_LANGUAGE,
};

export { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY };
