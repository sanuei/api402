export interface CatalogEndpointLocale {
  label: string;
  category: string;
  description: string;
}

export interface CatalogPaymentConfig {
  payTo: string;
  currency: string;
  chain: string;
  chainId?: number;
  scheme: string;
  tokenContract?: string;
  acceptance?: string;
  note?: string;
  demoToken: string;
  acceptedHeaders?: string[];
  settlementProofHeader?: string;
  settlementMethod?: string;
}

export interface CatalogEndpoint {
  path: string;
  url: string;
  method: string;
  label: string;
  price: string;
  currency: string;
  category: string;
  description: string;
  access: string;
  upstream: string | null;
  status: 'live' | 'demo' | string;
  tags: string[];
  locales?: {
    zh: CatalogEndpointLocale;
    en: CatalogEndpointLocale;
  };
  exampleRequest?: {
    curl?: string;
    paymentPayload?: Record<string, unknown>;
  };
  exampleResponse?: Record<string, unknown>;
}

export interface CatalogResponse {
  payment: CatalogPaymentConfig;
  endpoints: CatalogEndpoint[];
}

export interface HealthResponse {
  status: string;
  endpoints: number;
}

export interface EthereumProvider {
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: EthereumProvider[];
  request(args: { method: string }): Promise<string[]>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
