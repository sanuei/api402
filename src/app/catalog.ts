import type { CatalogEndpoint, CatalogResponse, HealthResponse, MetricsOverviewResponse } from '../types';
import { API_BASE, BASE_USDC_CONTRACT } from './config';
import { escapeHtml, getElement, shortenAddress } from './dom';
import {
  formatFreshnessStatus,
  formatPercent,
  formatRelativeAge,
  formatTopError,
  formatTrendSparkline,
  getGatewayExplorerUrl,
  getGatewayPayTo,
  getLocalizedFields,
} from './format';
import { t } from './i18n';
import { state } from './state';
import {
  executeDemoReplay,
  executeRabbyReplay,
  getEndpointRequestConfig,
  getWalletErrorMessage,
  logLine,
} from './wallet';

export function setHeroTerminal(endpoint: CatalogEndpoint | null) {
  const terminal = getElement<HTMLDivElement>('heroTerminal');
  const path = endpoint ? endpoint.path : '/api/btc-price';
  const price = endpoint ? endpoint.price : '0.00001';
  const payTo = `${getGatewayPayTo().slice(0, 8)}...`;
  const lines = [
    `$ curl -i ${API_BASE}${path}`,
    'HTTP/1.1 402 Payment Required',
    `{ "payTo": "${payTo}", "price": "${price}", "currency": "USDC" }`,
    `$ curl -H "Authorization: Bearer demo" ${API_BASE}${path}`,
    `{ "data": "...", "_meta": { "paid": true } }`,
  ];

  terminal.innerHTML = lines
    .map(
      (line, index) =>
        `<div class="terminal-line ${index === 1 ? 'text-[#ffcf66]' : index >= 3 ? 'text-[#33f0b2]' : 'text-slate-300'}" style="animation-delay:${index * 120}ms">${escapeHtml(line)}</div>`,
    )
    .join('');
}

export function setSelectedEndpoint(endpoint: CatalogEndpoint | null) {
  state.selectedEndpoint = endpoint;
  if (!endpoint) return;
  const localized = getLocalizedFields(endpoint);

  getElement<HTMLHeadingElement>('selectedName').textContent = localized.label;
  getElement<HTMLSpanElement>('selectedPrice').textContent = `${endpoint.price} USDC`;
  getElement<HTMLParagraphElement>('selectedDescription').textContent = localized.description;
  getElement<HTMLDivElement>('selectedPath').textContent = endpoint.url;
  getElement<HTMLDivElement>('selectedCategory').textContent = localized.category;
  getElement<HTMLDivElement>('selectedAccess').textContent = `${endpoint.access} / ${endpoint.status || t('dynamic.selectedUnknown')}`;
  getElement<HTMLDivElement>('selectedFreshness').textContent = formatFreshnessStatus(endpoint);
  getElement<HTMLDivElement>('selectedUpdatedAt').textContent = endpoint.lastUpdatedAt
    ? new Date(endpoint.lastUpdatedAt).toLocaleString(state.currentLanguage === 'zh' ? 'zh-CN' : 'en-US')
    : '-';
  getElement<HTMLDivElement>('selectedRecentRequests').textContent = String(endpoint.requestMetrics?.totalRequests || 0);
  getElement<HTMLDivElement>('selectedPayment402Rate').textContent = formatPercent(endpoint.requestMetrics?.paymentRequiredRate);
  getElement<HTMLDivElement>('selectedReplayConversion').textContent = formatPercent(
    endpoint.requestMetrics?.paymentFunnel?.challengeToReplayConversionRate,
  );
  getElement<HTMLDivElement>('selectedTrend').textContent = formatTrendSparkline(endpoint);
  getElement<HTMLDivElement>('selectedTopError').textContent = formatTopError(endpoint);
  getElement<HTMLAnchorElement>('openSelectedApi').href = endpoint.url;

  getElement<HTMLButtonElement>('trySelected').onclick = () => testAPI(endpoint.path);

  const curlExample =
    endpoint.exampleRequest?.curl ||
    [`curl -i ${endpoint.url}`, '', '# replay in demo mode', 'curl -H "Authorization: Bearer demo" \\', `  ${endpoint.url}`].join('\n');

  const jsExample =
    endpoint.method === 'POST'
      ? [
          'const requestBody = {',
          '  messages: [{ role: "user", content: "Explain x402 payments in one sentence." }]',
          '};',
          `const response = await fetch("${endpoint.url}", {`,
          '  method: "POST",',
          '  headers: { "Content-Type": "application/json" },',
          '  body: JSON.stringify(requestBody)',
          '});',
          'if (response.status === 402) {',
          '  const challenge = await response.json();',
          `  const paid = await fetch("${endpoint.url}", {`,
          '    method: "POST",',
          '    headers: {',
          '      "Content-Type": "application/json",',
          '      Authorization: "Bearer demo"',
          '    },',
          '    body: JSON.stringify(requestBody)',
          '  });',
          '  const data = await paid.json();',
          '  console.log(data);',
          '}',
          '',
          t('dynamic.exampleResponse'),
          JSON.stringify(endpoint.exampleResponse || {}, null, 2),
        ].join('\n')
      : [
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
          t('dynamic.exampleResponse'),
          JSON.stringify(endpoint.exampleResponse || {}, null, 2),
        ].join('\n');

  getElement<HTMLPreElement>('curlExample').textContent = curlExample;
  getElement<HTMLPreElement>('jsExample').textContent = jsExample;
  setHeroTerminal(endpoint);

  document.querySelectorAll<HTMLElement>('.api-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.endpointPath === endpoint.path);
  });
  document.querySelectorAll<HTMLElement>('.api-directory-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.endpointPath === endpoint.path);
  });
}

export function renderCatalogDirectory(endpoints: CatalogEndpoint[]) {
  const directory = getElement<HTMLDivElement>('catalogDirectory');
  const groups = new Map<string, CatalogEndpoint[]>();

  endpoints.forEach((endpoint) => {
    const localized = getLocalizedFields(endpoint);
    const current = groups.get(localized.category) || [];
    current.push(endpoint);
    groups.set(localized.category, current);
  });

  directory.innerHTML = [...groups.entries()]
    .map(([category, items]) => {
      const itemHtml = items
        .map((endpoint) => {
          const localized = getLocalizedFields(endpoint);
          return `
            <button
              type="button"
              class="api-directory-item rounded-2xl px-4 py-3 mt-2"
              data-endpoint-path="${escapeHtml(endpoint.path)}"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="font-semibold">${escapeHtml(localized.label)}</div>
                  <div class="mt-1 text-xs text-slate-500 mono">${escapeHtml(endpoint.path)}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs text-[#33f0b2] mono">${escapeHtml(endpoint.price)} USDC</div>
                  <div class="mt-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">${escapeHtml(
                    endpoint.method || 'GET',
                  )}</div>
                </div>
              </div>
            </button>
          `;
        })
        .join('');

      return `
        <div class="api-directory-section">
          <div class="text-xs uppercase tracking-[0.2em] text-slate-500 mono">${escapeHtml(category)}</div>
          ${itemHtml}
        </div>
      `;
    })
    .join('');
}

export function renderCatalog(endpoints: CatalogEndpoint[]) {
  const grid = getElement<HTMLDivElement>('catalogGrid');
  grid.innerHTML = endpoints
    .map((endpoint, index) => {
      const localized = getLocalizedFields(endpoint);
      const freshnessClass =
        endpoint.freshness?.status === 'fresh'
          ? 'badge-green'
          : endpoint.freshness?.status === 'stale'
            ? 'badge-amber'
            : 'badge-blue';
      return `
        <button
          type="button"
          class="api-card soft-card rounded-[28px] p-6 text-left transition-all duration-300"
          data-endpoint-path="${escapeHtml(endpoint.path)}"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="badge-blue rounded-full px-3 py-1 text-xs mono">${escapeHtml(localized.category)}</div>
            <div class="badge-green rounded-full px-3 py-1 text-xs mono">${escapeHtml(endpoint.price)} USDC</div>
          </div>
          <div class="mt-5">
            <h3 class="text-2xl font-bold tracking-tight">${escapeHtml(localized.label)}</h3>
            <p class="mt-3 text-slate-400 leading-7 min-h-[84px]">${escapeHtml(localized.description)}</p>
          </div>
          <div class="mt-5 flex items-center gap-2 text-xs">
            <span class="${freshnessClass} rounded-full px-3 py-1 mono">${escapeHtml(t(`freshness.${endpoint.freshness?.status || 'unknown'}`))}</span>
            <span class="text-slate-500 mono">${escapeHtml(formatRelativeAge(endpoint.freshness?.ageSeconds))}</span>
          </div>
          <div class="mt-5 grid grid-cols-3 gap-2">
            <div class="log-box rounded-xl p-2.5">
              <div class="text-[10px] uppercase tracking-[0.15em] text-slate-500 mono">${escapeHtml(t('requestMetrics.recentRequests'))}</div>
              <div class="mt-1 text-sm font-semibold text-slate-200 mono">${escapeHtml(String(endpoint.requestMetrics?.totalRequests || 0))}</div>
            </div>
            <div class="log-box rounded-xl p-2.5">
              <div class="text-[10px] uppercase tracking-[0.15em] text-slate-500 mono">${escapeHtml(t('requestMetrics.payment402Rate'))}</div>
              <div class="mt-1 text-sm font-semibold text-[#ffcf66] mono">${escapeHtml(formatPercent(endpoint.requestMetrics?.paymentRequiredRate))}</div>
            </div>
            <div class="log-box rounded-xl p-2.5">
              <div class="text-[10px] uppercase tracking-[0.15em] text-slate-500 mono">${escapeHtml(t('requestMetrics.replayConversion'))}</div>
              <div class="mt-1 text-sm font-semibold text-[#33f0b2] mono">${escapeHtml(
                formatPercent(endpoint.requestMetrics?.paymentFunnel?.challengeToReplayConversionRate),
              )}</div>
            </div>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <div class="log-box rounded-xl p-2.5">
              <div class="text-[10px] uppercase tracking-[0.15em] text-slate-500 mono">${escapeHtml(t('requestMetrics.trend'))}</div>
              <div class="mt-1 text-sm font-semibold text-slate-200 mono">${escapeHtml(formatTrendSparkline(endpoint))}</div>
            </div>
            <div class="log-box rounded-xl p-2.5">
              <div class="text-[10px] uppercase tracking-[0.15em] text-slate-500 mono">${escapeHtml(t('requestMetrics.topError'))}</div>
              <div class="mt-1 text-xs font-semibold text-[#ff8f8f] mono truncate" title="${escapeHtml(formatTopError(endpoint))}">${escapeHtml(formatTopError(endpoint))}</div>
            </div>
          </div>
          <div class="mt-6 flex items-center justify-between text-sm">
            <span class="${endpoint.access === 'mock_demo' ? 'badge-amber' : 'badge-green'} rounded-full px-3 py-1 text-xs mono">
              ${escapeHtml(endpoint.access)}
            </span>
            <span class="text-slate-500 mono">${String(index + 1).padStart(2, '0')}</span>
          </div>
        </button>
      `;
    })
    .join('');
}

export function updatePaymentModule() {
  const payTo = getGatewayPayTo();
  const payment = state.catalog?.payment;

  getElement<HTMLDivElement>('receiverAddress').textContent = payTo;
  getElement<HTMLDivElement>('receiverAsset').textContent = payment?.currency || 'USDC';
  getElement<HTMLDivElement>('receiverNetwork').textContent = payment?.chainId
    ? `${payment.chain} (${payment.chainId})`
    : payment?.chain || 'base';
  getElement<HTMLDivElement>('receiverScheme').textContent = payment?.scheme || 'exact';
  getElement<HTMLDivElement>('receiverHeaders').textContent =
    payment?.acceptedHeaders?.join(', ') || 'Authorization, PAYMENT-SIGNATURE';
  getElement<HTMLDivElement>('receiverTokenContract').textContent = payment?.tokenContract || BASE_USDC_CONTRACT;
  getElement<HTMLDivElement>('receiverAcceptance').textContent = payment?.note || t('dynamic.baseUsdcOnly');
  getElement<HTMLAnchorElement>('openReceiverButton').href = getGatewayExplorerUrl(payTo);
}

export async function loadHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/health`);
    if (!response.ok) throw new Error(`health ${response.status}`);
    const data = (await response.json()) as HealthResponse;
    getElement<HTMLSpanElement>('healthStatus').textContent = t('dynamic.gatewayLive', { count: data.endpoints });
    getElement<HTMLDivElement>('heroStatus').textContent = 'LIVE';
  } catch {
    getElement<HTMLSpanElement>('healthStatus').textContent = t('dynamic.gatewayRemote');
    getElement<HTMLDivElement>('heroStatus').textContent = t('dynamic.gatewayRemote');
  }
}

export async function loadMetricsOverview() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/metrics/overview`);
    if (!response.ok) throw new Error(`overview ${response.status}`);
    const data = (await response.json()) as MetricsOverviewResponse;
    getElement<HTMLDivElement>('totalApiCalls').textContent = data.totalApiCalls.toLocaleString(
      state.currentLanguage === 'zh' ? 'zh-CN' : 'en-US',
    );
    getElement<HTMLDivElement>('totalApiCallsUpdatedAt').textContent = data.lastApiCallAt
      ? new Date(data.lastApiCallAt).toLocaleString(state.currentLanguage === 'zh' ? 'zh-CN' : 'en-US')
      : t('dynamic.metricNever');
  } catch {
    getElement<HTMLDivElement>('totalApiCalls').textContent = '--';
    getElement<HTMLDivElement>('totalApiCallsUpdatedAt').textContent = t('dynamic.metricNever');
  }
}

export async function loadCatalog() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/catalog`);
    if (!response.ok) throw new Error(`catalog ${response.status}`);
    state.catalog = (await response.json()) as CatalogResponse;

    getElement<HTMLDivElement>('metricCount').textContent = String(state.catalog.endpoints.length).padStart(2, '0');
    getElement<HTMLAnchorElement>('catalogJsonLink').href = `${API_BASE}/api/v1/catalog`;
    getElement<HTMLAnchorElement>('healthLink').href = `${API_BASE}/api/v1/health`;
    getElement<HTMLAnchorElement>('catalogLink').href = `${API_BASE}/api/v1/catalog`;

    updatePaymentModule();
    renderCatalogDirectory(state.catalog.endpoints);
    renderCatalog(state.catalog.endpoints);
    setSelectedEndpoint(state.catalog.endpoints[0] || null);
  } catch {
    getElement<HTMLDivElement>('metricCount').textContent = '00';
    getElement<HTMLDivElement>('catalogGrid').innerHTML = `
      <div class="soft-card rounded-[28px] p-8 md:col-span-2 xl:col-span-3">
        <div class="text-[#ffcf66] font-semibold">${t('dynamic.catalogLoadFailed')}</div>
        <p class="mt-3 text-slate-400 leading-7">
          ${escapeHtml(t('dynamic.catalogLoadFailedBody', { apiBase: API_BASE }))}
        </p>
      </div>
    `;
    getElement<HTMLDivElement>('catalogDirectory').innerHTML = '';
    updatePaymentModule();
    setHeroTerminal(null);
  }
}

export function testAPI(endpointPath: string) {
  state.currentAPI = endpointPath;
  const endpoint = state.catalog?.endpoints.find((item) => item.path === endpointPath);

  getElement<HTMLHeadingElement>('modalTitle').textContent = endpoint ? endpoint.path : 'API Test';
  getElement<HTMLDivElement>('paymentDetails').innerHTML = `
    <div>${t('dynamic.endpoint')}: <span class="text-white">${escapeHtml(endpointPath)}</span></div>
    <div>${t('dynamic.gatewayReceiver')}: <span class="text-white">${escapeHtml(shortenAddress(getGatewayPayTo()))}</span></div>
    <div>${t('dynamic.price')}: <span class="text-[#33f0b2]">${escapeHtml(endpoint?.price || '--')} USDC</span></div>
    <div>${t('dynamic.flow')}: ${t('dynamic.flowValue')}</div>
  `;
  getElement<HTMLDivElement>('apiResult').innerHTML = logLine(t('dynamic.readyToCall', { path: endpointPath }), 'info');
  getElement<HTMLDivElement>('apiModal').classList.remove('hidden');
  getElement<HTMLDivElement>('apiModal').classList.add('flex');
}

export async function executeRequest() {
  const resultEl = getElement<HTMLDivElement>('apiResult');
  const button = getElement<HTMLButtonElement>('sendRequest');
  const endpoint = state.catalog?.endpoints.find((item) => item.path === state.currentAPI) || state.selectedEndpoint;
  if (!endpoint) {
    resultEl.innerHTML = logLine(t('dynamic.catalogLoadFailed'), 'danger');
    return;
  }

  if (!state.walletConnected) {
    resultEl.innerHTML = logLine(t('dynamic.connectWalletFirst'), 'warning');
    return;
  }

  const requestUrl = `${API_BASE}${endpoint.path}`;
  const requestConfig = getEndpointRequestConfig(endpoint);

  button.disabled = true;
  button.textContent = t('dynamic.execute');

  resultEl.innerHTML = [
    logLine(t('dynamic.methodLine', { method: requestConfig.method, url: requestUrl }), 'info'),
    logLine(t('dynamic.preparingPayment'), 'default'),
    requestConfig.body ? logLine(t('dynamic.requestBody', { value: requestConfig.body }), 'default') : '',
    logLine(t('dynamic.initialRequest'), 'default'),
  ]
    .filter(Boolean)
    .join('');

  try {
    const response = await fetch(requestUrl, {
      method: requestConfig.method,
      headers: requestConfig.headers,
      body: requestConfig.body,
    });

    if (response.status === 402) {
      const challenge = (await response.json()) as {
        payTo?: string;
        price?: string;
        currency?: string;
        tokenContract?: string;
      };
      resultEl.innerHTML += [
        logLine(t('dynamic.received402'), 'warning'),
        logLine(t('dynamic.payTo', { value: challenge.payTo || '' }), 'default'),
        logLine(t('dynamic.priceValue', { value: challenge.price || '', currency: challenge.currency || '' }), 'success'),
      ].join('');

      if (state.walletType === 'Demo') {
        await executeDemoReplay(requestUrl, requestConfig, resultEl);
      } else if (state.walletType === 'Rabby Wallet') {
        await executeRabbyReplay(requestUrl, endpoint, requestConfig, challenge, resultEl);
      } else {
        resultEl.innerHTML += logLine(t('dynamic.walletInDevelopment', { walletType: state.walletType }), 'warning');
      }
    } else if (response.ok) {
      const data = await response.json();
      resultEl.innerHTML += logLine(t('dynamic.requestSucceeded'), 'success');
      resultEl.innerHTML += `<pre class="mt-3 whitespace-pre-wrap break-all text-[#8de7ff]">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    } else {
      resultEl.innerHTML += logLine(t('dynamic.unexpectedStatus', { status: response.status }), 'danger');
    }
  } catch (error) {
    const message = getWalletErrorMessage(error);
    resultEl.innerHTML += logLine(t('dynamic.networkError', { message }), 'danger');
  } finally {
    button.disabled = false;
    button.textContent = t('dynamic.executeRequest');
  }
}

export async function copyGatewayAddress() {
  try {
    await navigator.clipboard.writeText(getGatewayPayTo());
    getElement<HTMLButtonElement>('copyReceiverButton').textContent = t('payment.copied');
    window.setTimeout(() => {
      getElement<HTMLButtonElement>('copyReceiverButton').textContent = t('payment.copy');
    }, 1200);
  } catch {
    window.alert(t('dynamic.copyFailed'));
  }
}

export function closeModal() {
  getElement<HTMLDivElement>('apiModal').classList.add('hidden');
  getElement<HTMLDivElement>('apiModal').classList.remove('flex');
  state.currentAPI = '';
}
