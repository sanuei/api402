import { getElement } from './dom';
import { SITE_URL } from './config';
import { state, type Language } from './state';

const translations: Record<Language, Record<string, string>> = {
  zh: {
    'meta.title': 'API Market | Base 上的 x402 API 支付网关',
    'meta.description':
      'API Market 是一个基于 Base 和 USDC 的 x402 API Payment Gateway，支持开发者与 AI Agent 按次付费调用 API，无需注册，无需 API Key。',
    'nav.catalog': '目录',
    'nav.flow': '流程',
    'nav.examples': '示例',
    'nav.faq': '问答',
    'nav.openCatalog': '打开目录',
    'nav.connectWallet': '连接钱包',
    'hero.kicker': '面向 Agent 与开发者的微支付',
    'hero.title.prefix': '按次付费调用 API，',
    'hero.title.mid': '不注册',
    'hero.title.end': '不发 Key',
    'hero.description':
      '面向 AI Agent、自动化工作流和开发者的 API 支付网关。先请求，收到 402 挑战，再用钱包授权完成单次调用。',
    'hero.browse': '浏览付费 API',
    'hero.examples': '查看接入示例',
    'hero.badge1': '无需注册',
    'hero.badge2': '钱包即身份',
    'hero.badge3': '按调用付费',
    'hero.terminalTitle': '支付流程',
    'metrics.endpointCount': '接口数量',
    'metrics.totalApiCalls': '总调用次数',
    'metrics.last24hCalls': '近 24 小时调用',
    'metrics.totalSettledUsdc': '累计已结算',
    'metrics.settledUsdc24h': '24h 已结算',
    'metrics.successRate24h': '24h 成功率',
    'metrics.payment402Rate24h': '24h 402 比率',
    'metrics.requestTrend24h': '24h 趋势',
    'metrics.paymentAsset': '支付资产',
    'metrics.chain': '链',
    'metrics.gatewayStatus': '网关状态',
    'catalog.kicker': '机器可读目录',
    'catalog.title': '可直接给 Agent 调用的 API 目录',
    'catalog.description':
      '前端和 SDK 都从同一份 catalog 读取价格、说明和支付要求。避免页面说一套、网关跑一套。',
    'catalog.directory': 'API 快速目录',
    'catalog.directoryHint': '先按分类快速定位，再在右侧查看卡片细节与价格。',
    'catalog.openCatalog': '打开 /api/v1/catalog',
    'catalog.openHealth': '打开 /api/v1/health',
    'flow.kicker': '开发者工作流',
    'flow.title': '支付流程保持简单，接入模型尽量稳定',
    'flow.step1.title': '请求 API',
    'flow.step1.body':
      '客户端先正常调用 API。如果还没支付，网关返回 402，并附带 `payTo`、价格和支付头要求。',
    'flow.step2.title': '签名或演示授权',
    'flow.step2.body':
      '现在支持 demo token，也预留了 `PAYMENT-SIGNATURE` / `Authorization` 的签名承载方式。',
    'flow.step3.title': '拿回数据',
    'flow.step3.body':
      '网关验证通过后返回真实上游数据或 demo 数据，并附带 `_meta` 方便前端与 SDK 做调试。',
    'payment.kicker': '结算配置',
    'payment.title': '收款地址与支付参数',
    'payment.description':
      '当前网关只接受 Base 主网原生 USDC。这里展示当前 Worker 对外暴露的收款地址、USDC 合约和支付约束，避免调用方打到错误链。',
    'payment.receiver': '网关收款地址',
    'payment.asset': '资产',
    'payment.network': '网络',
    'payment.scheme': '方案',
    'payment.headers': '接受的支付头',
    'payment.tokenContract': 'USDC 合约',
    'payment.acceptance': '接受范围',
    'payment.copy': '复制地址',
    'payment.copied': '已复制',
    'payment.openExplorer': '在区块浏览器打开',
    'examples.selected': '当前选中接口',
    'examples.loading': '正在加载 catalog...',
    'examples.path': '路径',
    'examples.category': '分类',
    'examples.mode': '模式',
    'examples.testSelected': '测试当前接口',
    'examples.openEndpoint': '打开接口',
    'examples.curlHint': '先 402 挑战，再重放请求',
    'examples.jsHint': '前端 / Agent 接入示例',
    'cards.whyBadge': '为什么这样设计',
    'cards.whyTitle': '面向 Agent 的接口边界',
    'cards.whyBody':
      '免费 catalog 提供 discovery，付费接口返回结构化挑战。Agent 不需要看营销文案，也能知道怎么完成一次请求。',
    'cards.stackBadge': '当前架构',
    'cards.stackTitle': 'Cloudflare Worker 一体部署',
    'cards.stackBody':
      '静态页面、catalog、健康检查和付费 API 统一由同一 Worker 提供，减少配置漂移和部署分裂。',
    'cards.nextBadge': '下一步',
    'cards.nextTitle': '真实支付和 SDK',
    'cards.nextBody':
      '下一阶段重点是链上支付验证、SDK 自动重放请求、更多真实上游代理，以及钱包级限流。',
    'faq.kicker': '问答',
    'faq.title': '开发时最容易问的几个问题',
    'faq.q1': '现在是真实链上扣款吗？',
    'faq.a1':
      '是。当前网页已经优先打通 Rabby Wallet 的 Base 主网 USDC 支付闭环：先拿 402 挑战，再签名、转账、等待确认并自动重放请求。Demo Mode 仍然保留给联调和演示使用。',
    'faq.q2': '为什么还保留 demo token？',
    'faq.a2':
      '因为它能保证产品页、联调页和 SDK 示例在没有真实钱包、没有 Base USDC 或只做前端演示时，仍然能完整跑通 402 -> replay -> data 的工作流。',
    'faq.q3': '本地调试时怎么连 API？',
    'faq.a3':
      '页面会优先使用线上 Worker 作为 API 基地址。部署到 `api-402.com` 或 `workers.dev` 后，会自动切换成同源调用。',
    'footer.tagline': '基于 Cloudflare Worker 的 x402 API 支付网关演示',
    'wallet.title': '连接钱包',
    'wallet.subtitle': '优先支持 Rabby 的 Base USDC 真实支付闭环。Coinbase Wallet 与 MetaMask 正在开发。',
    'wallet.coinbase': 'Coinbase 钱包',
    'wallet.metamask': 'MetaMask',
    'wallet.rabby': 'Rabby 钱包',
    'wallet.demo': '演示模式',
    'wallet.priorityBadge': '优先支持',
    'wallet.inDevelopment': '开发中',
    'common.cancel': '取消',
    'common.close': '关闭',
    'modal.liveTest': '实时测试',
    'modal.challenge': '支付挑战',
    'modal.ready': '准备就绪。',
    'modal.execute': '执行请求',
    'dynamic.catalogLoadFailed': '目录加载失败',
    'dynamic.catalogLoadFailedBody':
      '无法从 {apiBase} 读取 catalog。请确认 Worker 已部署，或继续使用远端联调环境。',
    'dynamic.gatewayLive': '在线 / {count} 个接口',
    'dynamic.gatewayRemote': '远程',
    'dynamic.metricNever': '暂无',
    'dynamic.walletConnectedAlert': '已连接地址: {address}\n连接类型: {walletType}\n\n{modeDescription}',
    'dynamic.walletLabel': '钱包',
    'dynamic.walletNotConnected': '未连接',
    'dynamic.gatewayReceiver': '收款地址',
    'dynamic.baseUsdcOnly': '仅接受 Base 主网原生 USDC',
    'dynamic.replayMode': '重放模式',
    'dynamic.replayDemo': 'Authorization: Bearer demo',
    'dynamic.replayRabby': 'Rabby: Base USDC + PAYMENT-SIGNATURE',
    'dynamic.replayManual': '功能开发中',
    'dynamic.endpoint': '接口',
    'dynamic.price': '价格',
    'dynamic.flow': '流程',
    'dynamic.flowValue': '先请求挑战，再重放请求',
    'dynamic.readyToCall': '准备请求 {path}',
    'dynamic.execute': '执行中...',
    'dynamic.initialRequest': '发送未携带支付头的首次请求...',
    'dynamic.received402': '收到 402 Payment Required',
    'dynamic.payTo': 'payTo => {value}',
    'dynamic.priceValue': 'price => {value} {currency}',
    'dynamic.replaying': '使用 demo 授权重放请求...',
    'dynamic.replayingRabby': '使用 Rabby 钱包执行 Base USDC 支付并重放请求...',
    'dynamic.replayFailed': '重放失败，状态 {status}',
    'dynamic.replaySucceeded': '重放成功，响应如下：',
    'dynamic.connectDemo': '连接 Demo Mode 可在浏览器内完成完整请求闭环。',
    'dynamic.connectRabby': '连接 Rabby Wallet 可在浏览器内完成 Base USDC 的真实支付闭环。',
    'dynamic.walletInDevelopment': '{walletType} 浏览器内支付流程仍在开发，当前请使用 Rabby Wallet 或 Demo Mode。',
    'dynamic.walletFeatureActive': '当前钱包支持浏览器内真实支付闭环。',
    'dynamic.walletFeatureDemo': '当前钱包只支持 demo 浏览器联调闭环。',
    'dynamic.walletFeaturePending': '当前钱包浏览器内支付闭环正在开发。',
    'dynamic.requestSucceeded': '请求成功，无需重放。',
    'dynamic.unexpectedStatus': '异常状态 {status}',
    'dynamic.networkError': '网络错误: {message}',
    'dynamic.executeRequest': '执行请求',
    'dynamic.selectedUnknown': '未知',
    'dynamic.exampleResponse': '// 示例响应',
    'dynamic.copyFailed': '复制失败，请手动复制地址。',
    'dynamic.preparingPayment': '正在准备支付载荷与请求体...',
    'dynamic.switchingBase': '正在切换到 Base 主网...',
    'dynamic.baseReady': '已连接 Base 主网。',
    'dynamic.signingPayload': '正在请求 Rabby 对支付载荷签名...',
    'dynamic.signatureReady': '支付签名已生成。',
    'dynamic.submittingTransfer': '正在发起 Base USDC 转账...',
    'dynamic.transferSubmitted': '支付交易已提交，txHash => {txHash}',
    'dynamic.waitingConfirmations': '等待链上确认，目标 {count} confirmations...',
    'dynamic.confirmationsReady': '确认数已达到要求，开始重放请求。',
    'dynamic.walletRejected': '钱包操作已取消。',
    'dynamic.walletMissing': '未检测到可用的钱包提供器。',
    'dynamic.challengeInvalid': '网关返回的支付挑战缺少必要字段。',
    'dynamic.requestBody': 'request body => {value}',
    'dynamic.methodLine': '{method} {url}',
    'dynamic.connectWalletFirst': '请先连接 Rabby Wallet 或 Demo Mode。',
    'dynamic.txMissing': '未获得有效的支付交易哈希。',
    'freshness.label': '数据新鲜度',
    'freshness.updatedAt': '更新时间',
    'freshness.fresh': '新鲜',
    'freshness.stale': '已过期',
    'freshness.unknown': '未知',
    'freshness.signal.upstream_telemetry': '上游遥测',
    'freshness.signal.request_metrics': '请求指标',
    'freshness.signal.none': '无信号',
    'freshness.secondsAgo': '{value}s 前',
    'freshness.minutesAgo': '{value}m 前',
    'freshness.hoursAgo': '{value}h 前',
    'requestMetrics.recentRequests': '近 60 分钟请求',
    'requestMetrics.payment402Rate': '402 比率',
    'requestMetrics.replayConversion': '重放转化率',
    'requestMetrics.trend': '请求趋势（6桶）',
    'requestMetrics.topError': 'Top 错误码',
    'requestMetrics.none': '无',
  },
  en: {
    'meta.title': 'API Market | x402 API Payment Gateway on Base',
    'meta.description':
      'API Market is an x402 API payment gateway on Base with USDC for developers and AI agents. Pay per API call with no signup and no API keys.',
    'nav.catalog': 'Catalog',
    'nav.flow': 'Flow',
    'nav.examples': 'Examples',
    'nav.faq': 'FAQ',
    'nav.openCatalog': 'Open Catalog',
    'nav.connectWallet': 'Connect Wallet',
    'hero.kicker': 'Micropayments For Agents And Developers',
    'hero.title.prefix': 'Pay per API call,',
    'hero.title.mid': 'No signup',
    'hero.title.end': 'No API keys',
    'hero.description':
      'An API payment gateway for AI agents, automation workflows, and developers. Request first, receive a 402 challenge, then authorize a single paid call from your wallet.',
    'hero.browse': 'Browse Paid APIs',
    'hero.examples': 'See Integration Examples',
    'hero.badge1': 'No signup',
    'hero.badge2': 'Wallet as identity',
    'hero.badge3': 'Pay only when called',
    'hero.terminalTitle': 'Payment Flow',
    'metrics.endpointCount': 'Endpoint Count',
    'metrics.totalApiCalls': 'Total API Calls',
    'metrics.last24hCalls': '24h Calls',
    'metrics.totalSettledUsdc': 'Total Settled',
    'metrics.settledUsdc24h': '24h Settled',
    'metrics.successRate24h': '24h Success Rate',
    'metrics.payment402Rate24h': '24h 402 Rate',
    'metrics.requestTrend24h': '24h Trend',
    'metrics.paymentAsset': 'Payment Asset',
    'metrics.chain': 'Chain',
    'metrics.gatewayStatus': 'Gateway Status',
    'catalog.kicker': 'Machine-Readable Catalog',
    'catalog.title': 'API catalog built for agents and direct integrations',
    'catalog.description':
      'The frontend and future SDKs read the same catalog for price, descriptions, and payment requirements so the product page and gateway stay aligned.',
    'catalog.directory': 'API Directory',
    'catalog.directoryHint': 'Jump by category first, then inspect pricing and details on the right.',
    'catalog.openCatalog': 'Open /api/v1/catalog',
    'catalog.openHealth': 'Open /api/v1/health',
    'flow.kicker': 'Builder Workflow',
    'flow.title': 'Keep the payment flow simple and the integration model stable',
    'flow.step1.title': 'Request the API',
    'flow.step1.body':
      'Clients call the API normally. If the request is unpaid, the gateway returns a 402 with payTo, price, and required payment headers.',
    'flow.step2.title': 'Sign or use demo auth',
    'flow.step2.body':
      'The gateway supports a demo token today and also accepts signed payloads over PAYMENT-SIGNATURE or Authorization.',
    'flow.step3.title': 'Receive data',
    'flow.step3.body':
      'After verification, the gateway returns live upstream data or demo data with `_meta` fields for debugging and SDK work.',
    'payment.kicker': 'Settlement Config',
    'payment.title': 'Receiver address and payment parameters',
    'payment.description':
      'This gateway only accepts native USDC on Base mainnet. This section exposes the receiver address, USDC contract, and payment constraints so payers do not send funds on the wrong chain.',
    'payment.receiver': 'Gateway Receiver',
    'payment.asset': 'Asset',
    'payment.network': 'Network',
    'payment.scheme': 'Scheme',
    'payment.headers': 'Accepted Headers',
    'payment.tokenContract': 'USDC Contract',
    'payment.acceptance': 'Accepted Scope',
    'payment.copy': 'Copy Address',
    'payment.copied': 'Copied',
    'payment.openExplorer': 'Open In Explorer',
    'examples.selected': 'Selected Endpoint',
    'examples.loading': 'Loading catalog...',
    'examples.path': 'Path',
    'examples.category': 'Category',
    'examples.mode': 'Mode',
    'examples.testSelected': 'Test Selected API',
    'examples.openEndpoint': 'Open Endpoint',
    'examples.curlHint': '402 challenge then replay',
    'examples.jsHint': 'frontend / agent integration',
    'cards.whyBadge': 'Why This Shape',
    'cards.whyTitle': 'Boundaries designed for agents',
    'cards.whyBody':
      'A free catalog handles discovery while paid endpoints return structured challenges. Agents do not need to parse marketing copy to complete a request.',
    'cards.stackBadge': 'Current Stack',
    'cards.stackTitle': 'Single Cloudflare Worker deployment',
    'cards.stackBody':
      'Static pages, catalog, health checks, and paid APIs all ship from the same Worker to reduce drift in deployment and configuration.',
    'cards.nextBadge': 'Next Up',
    'cards.nextTitle': 'Real payments and SDKs',
    'cards.nextBody':
      'The next stage focuses on on-chain verification, SDK-driven request replay, more live upstreams, and wallet-level rate limiting.',
    'faq.kicker': 'FAQ',
    'faq.title': 'Common questions during development',
    'faq.q1': 'Is this doing real on-chain settlement now?',
    'faq.a1':
      'Yes. The browser flow now prioritizes Rabby Wallet for live Base mainnet USDC settlement: fetch the 402 challenge, sign the payment payload, submit the transfer, wait for confirmations, then replay the request automatically. Demo Mode still exists for integration demos.',
    'faq.q2': 'Why keep the demo token?',
    'faq.a2':
      'It guarantees that the product page, integration demo, and future SDK examples can still show the full 402 -> replay -> data loop without requiring a live wallet payment or Base USDC.',
    'faq.q3': 'How should I connect APIs in local development?',
    'faq.a3':
      'The page prefers the remote Worker by default. Once deployed to `api-402.com` or `workers.dev`, it automatically uses same-origin requests.',
    'footer.tagline': 'Cloudflare Worker based x402 API payment gateway demo',
    'wallet.title': 'Connect Wallet',
    'wallet.subtitle':
      'Rabby is the first wallet with a live Base USDC payment flow. Coinbase Wallet and MetaMask are marked as in development.',
    'wallet.coinbase': 'Coinbase Wallet',
    'wallet.metamask': 'MetaMask',
    'wallet.rabby': 'Rabby Wallet',
    'wallet.demo': 'Demo Mode',
    'wallet.priorityBadge': 'Priority',
    'wallet.inDevelopment': 'In development',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'modal.liveTest': 'Live Test',
    'modal.challenge': 'Payment Challenge',
    'modal.ready': 'Ready.',
    'modal.execute': 'Execute Request',
    'dynamic.catalogLoadFailed': 'Catalog load failed',
    'dynamic.catalogLoadFailedBody':
      'Unable to load the catalog from {apiBase}. Confirm the Worker is deployed or continue using the remote environment.',
    'dynamic.gatewayLive': 'LIVE / {count} endpoints',
    'dynamic.gatewayRemote': 'REMOTE',
    'dynamic.metricNever': 'None yet',
    'dynamic.walletConnectedAlert':
      'Connected address: {address}\nWallet type: {walletType}\n\n{modeDescription}',
    'dynamic.walletLabel': 'Wallet',
    'dynamic.walletNotConnected': 'Not connected',
    'dynamic.gatewayReceiver': 'Gateway receiver',
    'dynamic.baseUsdcOnly': 'Only Base mainnet native USDC is accepted',
    'dynamic.replayMode': 'Replay mode',
    'dynamic.replayDemo': 'Authorization: Bearer demo',
    'dynamic.replayRabby': 'Rabby: Base USDC + PAYMENT-SIGNATURE',
    'dynamic.replayManual': 'In development',
    'dynamic.endpoint': 'Endpoint',
    'dynamic.price': 'Price',
    'dynamic.flow': 'Flow',
    'dynamic.flowValue': 'first request challenge, second request replay',
    'dynamic.readyToCall': 'Ready to call {path}',
    'dynamic.execute': 'Executing...',
    'dynamic.initialRequest': 'Sending initial request without payment header...',
    'dynamic.received402': 'Received 402 Payment Required',
    'dynamic.payTo': 'payTo => {value}',
    'dynamic.priceValue': 'price => {value} {currency}',
    'dynamic.replaying': 'Replaying request with demo authorization...',
    'dynamic.replayingRabby': 'Executing Base USDC payment and replay with Rabby...',
    'dynamic.replayFailed': 'Replay failed with status {status}',
    'dynamic.replaySucceeded': 'Replay succeeded. Response body:',
    'dynamic.connectDemo': 'Connect Demo Mode to complete the full request loop inside the browser.',
    'dynamic.connectRabby': 'Connect Rabby Wallet to complete the live Base USDC payment loop in the browser.',
    'dynamic.walletInDevelopment': '{walletType} browser payment flow is still in development. Use Rabby Wallet or Demo Mode for now.',
    'dynamic.walletFeatureActive': 'This wallet supports the live browser payment flow.',
    'dynamic.walletFeatureDemo': 'This wallet only supports the demo browser loop.',
    'dynamic.walletFeaturePending': 'This wallet browser payment flow is still in development.',
    'dynamic.requestSucceeded': 'Request succeeded without replay.',
    'dynamic.unexpectedStatus': 'Unexpected status {status}',
    'dynamic.networkError': 'Network error: {message}',
    'dynamic.executeRequest': 'Execute Request',
    'dynamic.selectedUnknown': 'unknown',
    'dynamic.exampleResponse': '// example response',
    'dynamic.copyFailed': 'Copy failed. Please copy the address manually.',
    'dynamic.preparingPayment': 'Preparing payment payload and request body...',
    'dynamic.switchingBase': 'Switching wallet to Base mainnet...',
    'dynamic.baseReady': 'Connected to Base mainnet.',
    'dynamic.signingPayload': 'Requesting Rabby signature for the payment payload...',
    'dynamic.signatureReady': 'Payment signature ready.',
    'dynamic.submittingTransfer': 'Submitting Base USDC transfer...',
    'dynamic.transferSubmitted': 'Payment transaction submitted, txHash => {txHash}',
    'dynamic.waitingConfirmations': 'Waiting for on-chain confirmations, target {count} confirmations...',
    'dynamic.confirmationsReady': 'Required confirmations reached. Replaying request.',
    'dynamic.walletRejected': 'Wallet action was rejected.',
    'dynamic.walletMissing': 'No compatible wallet provider was detected.',
    'dynamic.challengeInvalid': 'The gateway returned an incomplete payment challenge.',
    'dynamic.requestBody': 'request body => {value}',
    'dynamic.methodLine': '{method} {url}',
    'dynamic.connectWalletFirst': 'Connect Rabby Wallet or Demo Mode first.',
    'dynamic.txMissing': 'Did not receive a valid payment transaction hash.',
    'freshness.label': 'Freshness',
    'freshness.updatedAt': 'Updated At',
    'freshness.fresh': 'Fresh',
    'freshness.stale': 'Stale',
    'freshness.unknown': 'Unknown',
    'freshness.signal.upstream_telemetry': 'upstream telemetry',
    'freshness.signal.request_metrics': 'request metrics',
    'freshness.signal.none': 'no signal',
    'freshness.secondsAgo': '{value}s ago',
    'freshness.minutesAgo': '{value}m ago',
    'freshness.hoursAgo': '{value}h ago',
    'requestMetrics.recentRequests': 'Requests (60m)',
    'requestMetrics.payment402Rate': '402 Rate',
    'requestMetrics.replayConversion': 'Replay Conversion',
    'requestMetrics.trend': 'Request Trend (6 buckets)',
    'requestMetrics.topError': 'Top Error Code',
    'requestMetrics.none': 'None',
  },
};

export function t(key: string, variables: Record<string, string | number> = {}): string {
  const template = translations[state.currentLanguage][key] || translations.en[key] || key;
  return Object.entries(variables).reduce(
    (result, [variableKey, value]) => result.replaceAll(`{${variableKey}}`, String(value)),
    template,
  );
}

function getLanguageUrl(language: Language): string {
  return `${SITE_URL}?lang=${language}`;
}

export function syncLanguageUrl(language: Language) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', language);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next);
}

function updateStructuredData() {
  const websiteSchema = document.getElementById('websiteSchema');
  const webApiSchema = document.getElementById('webApiSchema');
  const description = t('meta.description');

  if (websiteSchema) {
    websiteSchema.textContent = JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'API Market',
        url: getLanguageUrl(state.currentLanguage),
        inLanguage: state.currentLanguage === 'zh' ? 'zh-CN' : 'en',
        description,
      },
      null,
      2,
    );
  }

  if (webApiSchema) {
    webApiSchema.textContent = JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'WebAPI',
        name: 'API Market Gateway',
        url: getLanguageUrl(state.currentLanguage),
        documentation: `${SITE_URL}#examples`,
        provider: {
          '@type': 'Organization',
          name: 'API Market',
        },
        inLanguage: state.currentLanguage === 'zh' ? 'zh-CN' : 'en',
        description,
      },
      null,
      2,
    );
  }
}

export function applyStaticTranslations() {
  document.documentElement.lang = state.currentLanguage === 'zh' ? 'zh-CN' : 'en';
  document.title = t('meta.title');

  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = t('meta.description');

  const canonicalLink = document.getElementById('canonicalLink') as HTMLLinkElement | null;
  if (canonicalLink) canonicalLink.href = getLanguageUrl(state.currentLanguage);
  const alternateZh = document.getElementById('alternateZh') as HTMLLinkElement | null;
  if (alternateZh) alternateZh.href = getLanguageUrl('zh');
  const alternateEn = document.getElementById('alternateEn') as HTMLLinkElement | null;
  if (alternateEn) alternateEn.href = getLanguageUrl('en');

  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = t('meta.title');
  const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = t('meta.description');
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = getLanguageUrl(state.currentLanguage);
  const ogLocale = document.querySelector<HTMLMetaElement>('meta[property="og:locale"]');
  if (ogLocale) ogLocale.content = state.currentLanguage === 'zh' ? 'zh_CN' : 'en_US';
  const ogLocaleAlternate = document.querySelector<HTMLMetaElement>('meta[property="og:locale:alternate"]');
  if (ogLocaleAlternate) ogLocaleAlternate.content = state.currentLanguage === 'zh' ? 'en_US' : 'zh_CN';

  const twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.content = t('meta.title');
  const twitterDescription = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
  if (twitterDescription) twitterDescription.content = t('meta.description');

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) return;
    element.textContent = t(key);
  });

  updateStructuredData();
  getElement<HTMLButtonElement>('languageToggle').textContent = state.currentLanguage === 'zh' ? 'EN' : '中文';
}
