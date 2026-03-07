import './styles.css';

import type { CatalogEndpoint, CatalogResponse, HealthResponse } from './types';

const REMOTE_API_BASE = 'https://api-market-x402.sonic980828.workers.dev';
const SAME_ORIGIN_HOST_PATTERNS = [/api-402\.com$/, /workers\.dev$/];

let walletConnected = false;
let walletAddress = '';
let walletType = '';
let currentAPI = '';
let catalog: CatalogResponse | null = null;
let selectedEndpoint: CatalogEndpoint | null = null;

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }

  return element as T;
}

function resolveApiBase(): string {
  const host = window.location.hostname;
  const canUseSameOrigin = SAME_ORIGIN_HOST_PATTERNS.some((pattern) => pattern.test(host));
  return canUseSameOrigin ? window.location.origin : REMOTE_API_BASE;
}

const API_BASE = resolveApiBase();

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shortenAddress(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function logLine(message: string, tone: 'default' | 'info' | 'success' | 'warning' | 'danger' = 'default') {
  const palette: Record<string, string> = {
    default: 'text-slate-300',
    info: 'text-[#8de7ff]',
    success: 'text-[#33f0b2]',
    warning: 'text-[#ffcf66]',
    danger: 'text-[#ff8f8f]',
  };

  return `<div class="${palette[tone] || palette.default}">${escapeHtml(message)}</div>`;
}

function setHeroTerminal(endpoint: CatalogEndpoint | null) {
  const terminal = getElement<HTMLDivElement>('heroTerminal');
  const path = endpoint ? endpoint.path : '/api/btc-price';
  const price = endpoint ? endpoint.price : '0.00001';
  const lines = [
    `$ curl -i ${API_BASE}${path}`,
    'HTTP/1.1 402 Payment Required',
    `{ "payTo": "0x742d...", "price": "${price}", "currency": "USDC" }`,
    `$ curl -H "Authorization: Bearer demo" ${API_BASE}${path}`,
    '{ "data": "...", "_meta": { "paid": true } }',
  ];

  terminal.innerHTML = lines
    .map(
      (line, index) =>
        `<div class="terminal-line ${index === 1 ? 'text-[#ffcf66]' : index >= 3 ? 'text-[#33f0b2]' : 'text-slate-300'}" style="animation-delay:${index * 120}ms">${escapeHtml(line)}</div>`,
    )
    .join('');
}

function setSelectedEndpoint(endpoint: CatalogEndpoint | null) {
  selectedEndpoint = endpoint;
  if (!endpoint) return;

  getElement<HTMLHeadingElement>('selectedName').textContent = endpoint.path
    .replace('/api/', '')
    .replaceAll('-', ' ');
  getElement<HTMLSpanElement>('selectedPrice').textContent = `${endpoint.price} USDC`;
  getElement<HTMLParagraphElement>('selectedDescription').textContent = endpoint.description;
  getElement<HTMLDivElement>('selectedPath').textContent = endpoint.url;
  getElement<HTMLDivElement>('selectedCategory').textContent = endpoint.category;
  getElement<HTMLDivElement>('selectedAccess').textContent = `${endpoint.access} / ${endpoint.status || 'unknown'}`;
  getElement<HTMLAnchorElement>('openSelectedApi').href = endpoint.url;

  const trySelected = getElement<HTMLButtonElement>('trySelected');
  trySelected.onclick = () => testAPI(endpoint.path);

  const curlExample =
    endpoint.exampleRequest?.curl ||
    [
      `curl -i ${endpoint.url}`,
      '',
      '# replay in demo mode',
      'curl -H "Authorization: Bearer demo" \\',
      `  ${endpoint.url}`,
    ].join('\n');

  const jsExample = [
    `const response = await fetch("${endpoint.url}");`,
    'if (response.status === 402) {',
    '  const challenge = await response.json();',
    '  const paid = await fetch(challenge.path, {',
    '    headers: { Authorization: "Bearer demo" }',
    '  });',
    '  const data = await paid.json();',
    '  console.log(data);',
    '}',
    '',
    '// example response',
    JSON.stringify(endpoint.exampleResponse || {}, null, 2),
  ].join('\n');

  getElement<HTMLPreElement>('curlExample').textContent = curlExample;
  getElement<HTMLPreElement>('jsExample').textContent = jsExample;
  setHeroTerminal(endpoint);

  document.querySelectorAll<HTMLElement>('.api-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.endpointPath === endpoint.path);
  });
}

function renderCatalog(endpoints: CatalogEndpoint[]) {
  const grid = getElement<HTMLDivElement>('catalogGrid');
  grid.innerHTML = endpoints
    .map(
      (endpoint, index) => `
        <button
          type="button"
          class="api-card soft-card rounded-[28px] p-6 text-left transition-all duration-300"
          data-endpoint-path="${escapeHtml(endpoint.path)}"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="badge-blue rounded-full px-3 py-1 text-xs mono">${escapeHtml(endpoint.category)}</div>
            <div class="badge-green rounded-full px-3 py-1 text-xs mono">${escapeHtml(endpoint.price)} USDC</div>
          </div>
          <div class="mt-5">
            <h3 class="text-2xl font-bold tracking-tight">${escapeHtml(endpoint.path.replace('/api/', ''))}</h3>
            <p class="mt-3 text-slate-400 leading-7 min-h-[84px]">${escapeHtml(endpoint.description)}</p>
          </div>
          <div class="mt-6 flex items-center justify-between text-sm">
            <span class="${endpoint.access === 'mock_demo' ? 'badge-amber' : 'badge-green'} rounded-full px-3 py-1 text-xs mono">
              ${escapeHtml(endpoint.access)}
            </span>
            <span class="text-slate-500 mono">${String(index + 1).padStart(2, '0')}</span>
          </div>
        </button>
      `,
    )
    .join('');
}

function selectEndpointByPath(path: string) {
  if (!catalog) return;
  const endpoint = catalog.endpoints.find((item) => item.path === path);
  setSelectedEndpoint(endpoint || catalog.endpoints[0] || null);
}

async function loadHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/health`);
    if (!response.ok) throw new Error(`health ${response.status}`);
    const data = (await response.json()) as HealthResponse;
    getElement<HTMLSpanElement>('healthStatus').textContent = `${data.status.toUpperCase()} / ${data.endpoints} endpoints`;
    getElement<HTMLDivElement>('heroStatus').textContent = 'LIVE';
  } catch {
    getElement<HTMLSpanElement>('healthStatus').textContent = 'Degraded';
    getElement<HTMLDivElement>('heroStatus').textContent = 'REMOTE';
  }
}

async function loadCatalog() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/catalog`);
    if (!response.ok) throw new Error(`catalog ${response.status}`);
    catalog = (await response.json()) as CatalogResponse;

    getElement<HTMLDivElement>('metricCount').textContent = String(catalog.endpoints.length).padStart(2, '0');
    getElement<HTMLAnchorElement>('catalogJsonLink').href = `${API_BASE}/api/v1/catalog`;
    getElement<HTMLAnchorElement>('healthLink').href = `${API_BASE}/api/v1/health`;
    getElement<HTMLAnchorElement>('catalogLink').href = `${API_BASE}/api/v1/catalog`;

    renderCatalog(catalog.endpoints);
    setSelectedEndpoint(catalog.endpoints[0] || null);
  } catch {
    getElement<HTMLDivElement>('metricCount').textContent = '00';
    getElement<HTMLDivElement>('catalogGrid').innerHTML = `
      <div class="soft-card rounded-[28px] p-8 md:col-span-2 xl:col-span-3">
        <div class="text-[#ffcf66] font-semibold">Catalog load failed</div>
        <p class="mt-3 text-slate-400 leading-7">
          无法从 ${escapeHtml(API_BASE)} 读取 catalog。请确认 Worker 已部署，或继续使用远端联调环境。
        </p>
      </div>
    `;
    setHeroTerminal(null);
  }
}

function openWalletModal() {
  getElement<HTMLDivElement>('walletModal').classList.remove('hidden');
  getElement<HTMLDivElement>('walletModal').classList.add('flex');
}

function closeWalletModal() {
  getElement<HTMLDivElement>('walletModal').classList.add('hidden');
  getElement<HTMLDivElement>('walletModal').classList.remove('flex');
}

async function connectWallet(type: 'coinbase' | 'metamask') {
  closeWalletModal();

  let address = '';
  try {
    if (window.ethereum && typeof window.ethereum.request === 'function') {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      address = accounts[0] || '';
      walletType = type === 'coinbase' ? 'Coinbase Wallet' : 'MetaMask';
    }
  } catch (error) {
    console.log('wallet connect failed, fallback to demo', error);
  }

  if (!address) {
    address = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
    walletType = 'Demo';
  }

  walletConnected = true;
  walletAddress = address;
  updateWalletUI();
}

function connectDemo() {
  walletConnected = true;
  walletType = 'Demo';
  walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f4f8E1';
  closeWalletModal();
  updateWalletUI();
}

function updateWalletUI() {
  const button = getElement<HTMLButtonElement>('connectWallet');
  button.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${escapeHtml(shortenAddress(walletAddress))}`;
  getElement<HTMLDivElement>('paymentDetails').innerHTML = `
    <div>Wallet: <span class="text-white">${escapeHtml(walletType || 'Not connected')}</span></div>
    <div>Replay mode: <span class="text-[#33f0b2]">${walletType === 'Demo' ? 'Authorization: Bearer demo' : 'Manual signature required'}</span></div>
  `;
}

function testAPI(endpointPath: string) {
  currentAPI = endpointPath;
  const endpoint = catalog?.endpoints.find((item) => item.path === endpointPath);

  getElement<HTMLHeadingElement>('modalTitle').textContent = endpoint ? endpoint.path : 'API Test';
  getElement<HTMLDivElement>('paymentDetails').innerHTML = `
    <div>Endpoint: <span class="text-white">${escapeHtml(endpointPath)}</span></div>
    <div>Price: <span class="text-[#33f0b2]">${escapeHtml(endpoint?.price || '--')} USDC</span></div>
    <div>Flow: first request challenge, second request replay</div>
  `;
  getElement<HTMLDivElement>('apiResult').innerHTML = logLine(`Ready to call ${endpointPath}`, 'info');
  getElement<HTMLDivElement>('apiModal').classList.remove('hidden');
  getElement<HTMLDivElement>('apiModal').classList.add('flex');
}

async function executeRequest() {
  const resultEl = getElement<HTMLDivElement>('apiResult');
  const button = getElement<HTMLButtonElement>('sendRequest');
  const requestUrl = `${API_BASE}${currentAPI}`;

  button.disabled = true;
  button.textContent = 'Executing...';

  resultEl.innerHTML = [
    logLine(`GET ${requestUrl}`, 'info'),
    logLine('Sending initial request without payment header...', 'default'),
  ].join('');

  try {
    const response = await fetch(requestUrl, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 402) {
      const challenge = (await response.json()) as { payTo?: string; price?: string; currency?: string };
      resultEl.innerHTML += [
        logLine('Received 402 Payment Required', 'warning'),
        logLine(`payTo => ${challenge.payTo}`, 'default'),
        logLine(`price => ${challenge.price} ${challenge.currency}`, 'success'),
      ].join('');

      if (walletType === 'Demo') {
        resultEl.innerHTML += logLine('Replaying request with demo authorization...', 'success');
        const paid = await fetch(requestUrl, {
          headers: { Authorization: 'Bearer demo' },
        });

        if (!paid.ok) {
          resultEl.innerHTML += logLine(`Replay failed with status ${paid.status}`, 'danger');
        } else {
          const data = await paid.json();
          resultEl.innerHTML += logLine('Replay succeeded. Response body:', 'success');
          resultEl.innerHTML += `<pre class="mt-3 whitespace-pre-wrap break-all text-[#8de7ff]">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        }
      } else {
        resultEl.innerHTML += logLine(
          'Connect Demo Mode to complete the full request loop inside the browser.',
          'warning',
        );
      }
    } else if (response.ok) {
      const data = await response.json();
      resultEl.innerHTML += logLine('Request succeeded without replay.', 'success');
      resultEl.innerHTML += `<pre class="mt-3 whitespace-pre-wrap break-all text-[#8de7ff]">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    } else {
      resultEl.innerHTML += logLine(`Unexpected status ${response.status}`, 'danger');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    resultEl.innerHTML += logLine(`Network error: ${message}`, 'danger');
  } finally {
    button.disabled = false;
    button.textContent = 'Execute Request';
  }
}

function closeModal() {
  getElement<HTMLDivElement>('apiModal').classList.add('hidden');
  getElement<HTMLDivElement>('apiModal').classList.remove('flex');
  currentAPI = '';
}

function bindEvents() {
  getElement<HTMLButtonElement>('connectWallet').addEventListener('click', () => {
    if (walletConnected) {
      window.alert(`已连接地址: ${walletAddress}\n连接类型: ${walletType}\n\n当前仍以 demo 支付流为主。`);
      return;
    }

    openWalletModal();
  });

  document.querySelectorAll<HTMLElement>('[data-wallet-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const walletTypeValue = button.dataset.walletType;
      if (walletTypeValue === 'coinbase' || walletTypeValue === 'metamask') {
        void connectWallet(walletTypeValue);
      }
    });
  });

  document.querySelectorAll<HTMLElement>('[data-demo-connect]').forEach((button) => {
    button.addEventListener('click', connectDemo);
  });

  document.querySelectorAll<HTMLElement>('[data-close-wallet-modal]').forEach((button) => {
    button.addEventListener('click', closeWalletModal);
  });

  document.querySelectorAll<HTMLElement>('[data-close-api-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  getElement<HTMLButtonElement>('sendRequest').addEventListener('click', () => {
    void executeRequest();
  });

  getElement<HTMLDivElement>('apiModal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  });

  getElement<HTMLDivElement>('walletModal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      closeWalletModal();
    }
  });

  getElement<HTMLDivElement>('catalogGrid').addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const card = target?.closest<HTMLElement>('[data-endpoint-path]');
    if (!card?.dataset.endpointPath) {
      return;
    }

    selectEndpointByPath(card.dataset.endpointPath);
  });
}

setHeroTerminal(null);
bindEvents();
void loadHealth();
void loadCatalog();
