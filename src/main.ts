import './styles.css';

import { BrowserProvider, Interface, parseUnits } from 'ethers';
import type { CatalogEndpoint, CatalogResponse, HealthResponse } from './types';
import type { EthereumProvider } from './types';

const REMOTE_API_BASE = 'https://api-market-x402.sonic980828.workers.dev';
const SITE_URL = 'https://api-402.com/';
const DEFAULT_GATEWAY_PAY_TO = '0x0A5312e03C1fb2b64569fAF61aD2c6517cCB0D18';
const BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SAME_ORIGIN_HOST_PATTERNS = [/api-402\.com$/, /workers\.dev$/];
const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_ID_HEX = '0x2105';
const BASE_CHAIN_CONFIG = {
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
const USDC_INTERFACE = new Interface(['function transfer(address to, uint256 amount) returns (bool)']);
type Language = 'zh' | 'en';
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
    'metrics.paymentAsset': '支付资产',
    'metrics.chain': '链',
    'metrics.gatewayStatus': '网关状态',
    'catalog.kicker': '机器可读目录',
    'catalog.title': '可直接给 Agent 调用的 API 目录',
    'catalog.description':
      '前端和 SDK 都从同一份 catalog 读取价格、说明和支付要求。避免页面说一套、网关跑一套。',
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
    'metrics.paymentAsset': 'Payment Asset',
    'metrics.chain': 'Chain',
    'metrics.gatewayStatus': 'Gateway Status',
    'catalog.kicker': 'Machine-Readable Catalog',
    'catalog.title': 'API catalog built for agents and direct integrations',
    'catalog.description':
      'The frontend and future SDKs read the same catalog for price, descriptions, and payment requirements so the product page and gateway stay aligned.',
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

let walletConnected = false;
let walletAddress = '';
let walletType = '';
let walletProvider: EthereumProvider | null = null;
let currentAPI = '';
let catalog: CatalogResponse | null = null;
let selectedEndpoint: CatalogEndpoint | null = null;
let currentLanguage: Language = DEFAULT_LANGUAGE;

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

function getWalletProvider(type: 'coinbase' | 'metamask' | 'rabby') {
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

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function t(key: string, variables: Record<string, string | number> = {}): string {
  const template = translations[currentLanguage][key] || translations.en[key] || key;
  return Object.entries(variables).reduce(
    (result, [variableKey, value]) => result.replaceAll(`{${variableKey}}`, String(value)),
    template,
  );
}

function shortenAddress(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatRelativeAge(ageSeconds: number | null | undefined): string {
  if (ageSeconds === null || ageSeconds === undefined || ageSeconds < 0) {
    return '-';
  }

  if (ageSeconds < 60) {
    return t('freshness.secondsAgo', { value: ageSeconds });
  }

  if (ageSeconds < 3600) {
    return t('freshness.minutesAgo', { value: Math.floor(ageSeconds / 60) });
  }

  return t('freshness.hoursAgo', { value: Math.floor(ageSeconds / 3600) });
}

function formatFreshnessStatus(endpoint: CatalogEndpoint): string {
  const status = endpoint.freshness?.status || 'unknown';
  const signal = endpoint.freshness?.signal || 'none';
  const ageLabel = formatRelativeAge(endpoint.freshness?.ageSeconds);
  return `${t(`freshness.${status}`)} · ${ageLabel} · ${t(`freshness.signal.${signal}`)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0%';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatTrendSparkline(endpoint: CatalogEndpoint): string {
  const trend = endpoint.requestMetrics?.requestTrend || [];
  if (trend.length === 0) {
    return '-';
  }

  const values = trend.map((item) => item.requests || 0);
  const max = Math.max(...values, 1);
  const blocks = '▁▂▃▄▅▆▇█';
  return values
    .map((value) => {
      const ratio = value / max;
      const index = Math.min(blocks.length - 1, Math.floor(ratio * (blocks.length - 1)));
      return blocks[index] || blocks[0];
    })
    .join('');
}

function formatTopError(endpoint: CatalogEndpoint): string {
  const top = endpoint.requestMetrics?.errorsByCode?.[0];
  if (!top) {
    return t('requestMetrics.none');
  }

  return `${top.code} · ${top.count}`;
}

function getGatewayPayTo(): string {
  return catalog?.payment.payTo || DEFAULT_GATEWAY_PAY_TO;
}

function getGatewayExplorerUrl(address: string): string {
  return `https://basescan.org/address/${address}`;
}

function getGatewayTxExplorerUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

function getLocalizedFields(endpoint: CatalogEndpoint) {
  return (
    endpoint.locales?.[currentLanguage] ||
    endpoint.locales?.en || {
      label: endpoint.label || endpoint.path.replace('/api/', '').replaceAll('-', ' '),
      category: endpoint.category,
      description: endpoint.description,
    }
  );
}

function getLanguageUrl(language: Language): string {
  return `${SITE_URL}?lang=${language}`;
}

function syncLanguageUrl(language: Language) {
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
        url: getLanguageUrl(currentLanguage),
        inLanguage: currentLanguage === 'zh' ? 'zh-CN' : 'en',
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
        url: getLanguageUrl(currentLanguage),
        documentation: `${SITE_URL}#examples`,
        provider: {
          '@type': 'Organization',
          name: 'API Market',
        },
        inLanguage: currentLanguage === 'zh' ? 'zh-CN' : 'en',
        description,
      },
      null,
      2,
    );
  }
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
  document.title = t('meta.title');

  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = t('meta.description');

  const canonicalLink = document.getElementById('canonicalLink') as HTMLLinkElement | null;
  if (canonicalLink) canonicalLink.href = getLanguageUrl(currentLanguage);
  const alternateZh = document.getElementById('alternateZh') as HTMLLinkElement | null;
  if (alternateZh) alternateZh.href = getLanguageUrl('zh');
  const alternateEn = document.getElementById('alternateEn') as HTMLLinkElement | null;
  if (alternateEn) alternateEn.href = getLanguageUrl('en');

  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = t('meta.title');
  const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = t('meta.description');
  const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = getLanguageUrl(currentLanguage);
  const ogLocale = document.querySelector<HTMLMetaElement>('meta[property="og:locale"]');
  if (ogLocale) ogLocale.content = currentLanguage === 'zh' ? 'zh_CN' : 'en_US';
  const ogLocaleAlternate = document.querySelector<HTMLMetaElement>('meta[property="og:locale:alternate"]');
  if (ogLocaleAlternate) ogLocaleAlternate.content = currentLanguage === 'zh' ? 'en_US' : 'zh_CN';

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
  getElement<HTMLButtonElement>('languageToggle').textContent = currentLanguage === 'zh' ? 'EN' : '中文';
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

function getWalletCapability(type: string): 'demo' | 'live' | 'pending' {
  if (type === 'Demo') {
    return 'demo';
  }

  if (type === 'Rabby Wallet') {
    return 'live';
  }

  return 'pending';
}

function getWalletModeDescription(type: string): string {
  const capability = getWalletCapability(type);
  if (capability === 'live') {
    return t('dynamic.walletFeatureActive');
  }

  if (capability === 'demo') {
    return t('dynamic.walletFeatureDemo');
  }

  return t('dynamic.walletFeaturePending');
}

function getReplayModeLabel(type: string): string {
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

function getEndpointRequestConfig(endpoint: CatalogEndpoint): {
  method: string;
  body: string | null;
  headers: Record<string, string>;
} {
  const method = (endpoint.method || 'GET').toUpperCase();
  if (method === 'POST') {
    const requestBody = endpoint.path === '/api/qwen'
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
  return catalog?.payment.settlementConfirmationsRequired || 2;
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

function getWalletErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: number }).code;
    if (code === 4001) {
      return t('dynamic.walletRejected');
    }
  }

  return error instanceof Error ? error.message : 'Unknown wallet error';
}

async function executeDemoReplay(
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

async function executeRabbyReplay(
  requestUrl: string,
  endpoint: CatalogEndpoint,
  requestConfig: ReturnType<typeof getEndpointRequestConfig>,
  challenge: { payTo?: string; price?: string; currency?: string; tokenContract?: string },
  resultEl: HTMLDivElement,
) {
  if (!walletProvider || !walletAddress) {
    throw new Error(t('dynamic.walletMissing'));
  }

  const payTo = challenge.payTo || getGatewayPayTo();
  const amount = challenge.price || endpoint.price;
  const tokenContract = challenge.tokenContract || catalog?.payment.tokenContract || BASE_USDC_CONTRACT;
  if (!payTo || !amount || !tokenContract) {
    throw new Error(t('dynamic.challengeInvalid'));
  }

  resultEl.innerHTML += logLine(t('dynamic.replayingRabby'), 'success');
  resultEl.innerHTML += logLine(t('dynamic.switchingBase'), 'info');
  await ensureBaseNetwork(walletProvider);
  resultEl.innerHTML += logLine(t('dynamic.baseReady'), 'success');

  const browserProvider = new BrowserProvider(walletProvider);
  const signer = await browserProvider.getSigner();
  const now = Date.now();
  const payload = {
    version: '1',
    scheme: 'exact',
    network: 'base',
    currency: 'USDC',
    payTo,
    from: walletAddress,
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

function setHeroTerminal(endpoint: CatalogEndpoint | null) {
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

function setSelectedEndpoint(endpoint: CatalogEndpoint | null) {
  selectedEndpoint = endpoint;
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
    ? new Date(endpoint.lastUpdatedAt).toLocaleString(currentLanguage === 'zh' ? 'zh-CN' : 'en-US')
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
    [
      `curl -i ${endpoint.url}`,
      '',
      '# replay in demo mode',
      'curl -H "Authorization: Bearer demo" \\',
      `  ${endpoint.url}`,
    ].join('\n');

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
}

function renderCatalog(endpoints: CatalogEndpoint[]) {
  const grid = getElement<HTMLDivElement>('catalogGrid');
  grid.innerHTML = endpoints
    .map(
      (endpoint, index) => {
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
      },
    )
    .join('');
}

function updatePaymentModule() {
  const payTo = getGatewayPayTo();
  const payment = catalog?.payment;

  getElement<HTMLDivElement>('receiverAddress').textContent = payTo;
  getElement<HTMLDivElement>('receiverAsset').textContent = payment?.currency || 'USDC';
  getElement<HTMLDivElement>('receiverNetwork').textContent = payment?.chainId
    ? `${payment.chain} (${payment.chainId})`
    : payment?.chain || 'base';
  getElement<HTMLDivElement>('receiverScheme').textContent = payment?.scheme || 'exact';
  getElement<HTMLDivElement>('receiverHeaders').textContent =
    payment?.acceptedHeaders?.join(', ') || 'Authorization, PAYMENT-SIGNATURE';
  getElement<HTMLDivElement>('receiverTokenContract').textContent =
    payment?.tokenContract || BASE_USDC_CONTRACT;
  getElement<HTMLDivElement>('receiverAcceptance').textContent =
    payment?.note || t('dynamic.baseUsdcOnly');
  getElement<HTMLAnchorElement>('openReceiverButton').href = getGatewayExplorerUrl(payTo);
}

async function loadHealth() {
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

async function loadCatalog() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/catalog`);
    if (!response.ok) throw new Error(`catalog ${response.status}`);
    catalog = (await response.json()) as CatalogResponse;

    getElement<HTMLDivElement>('metricCount').textContent = String(catalog.endpoints.length).padStart(2, '0');
    getElement<HTMLAnchorElement>('catalogJsonLink').href = `${API_BASE}/api/v1/catalog`;
    getElement<HTMLAnchorElement>('healthLink').href = `${API_BASE}/api/v1/health`;
    getElement<HTMLAnchorElement>('catalogLink').href = `${API_BASE}/api/v1/catalog`;

    updatePaymentModule();
    renderCatalog(catalog.endpoints);
    setSelectedEndpoint(catalog.endpoints[0] || null);
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
    updatePaymentModule();
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

async function connectWallet(type: 'coinbase' | 'metamask' | 'rabby') {
  const provider = getWalletProvider(type);
  if (type !== 'rabby') {
    closeWalletModal();
    walletConnected = true;
    walletType = type === 'coinbase' ? 'Coinbase Wallet' : 'MetaMask';
    walletAddress = provider ? walletAddress || getGatewayPayTo() : getGatewayPayTo();
    walletProvider = provider;
    updateWalletUI();
    window.alert(t('dynamic.walletInDevelopment', { walletType }));
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
      walletType = 'Rabby Wallet';
      walletProvider = provider;
    }
  } catch (error) {
    console.log('wallet connect failed, fallback to demo', error);
  }

  if (!address) {
    walletProvider = null;
    throw new Error(t('dynamic.walletMissing'));
  }

  walletConnected = true;
  walletAddress = address;
  updateWalletUI();
}

function connectDemo() {
  walletConnected = true;
  walletType = 'Demo';
  walletAddress = getGatewayPayTo();
  walletProvider = null;
  closeWalletModal();
  updateWalletUI();
}

function updateWalletUI() {
  const button = getElement<HTMLButtonElement>('connectWallet');
  button.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${escapeHtml(shortenAddress(walletAddress))}`;
  getElement<HTMLDivElement>('paymentDetails').innerHTML = `
    <div>${t('dynamic.walletLabel')}: <span class="text-white">${escapeHtml(walletType || t('dynamic.walletNotConnected'))}</span></div>
    <div>${t('dynamic.gatewayReceiver')}: <span class="text-white">${escapeHtml(shortenAddress(getGatewayPayTo()))}</span></div>
    <div>${t('dynamic.replayMode')}: <span class="text-[#33f0b2]">${escapeHtml(getReplayModeLabel(walletType))}</span></div>
  `;
}

function testAPI(endpointPath: string) {
  currentAPI = endpointPath;
  const endpoint = catalog?.endpoints.find((item) => item.path === endpointPath);

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

async function executeRequest() {
  const resultEl = getElement<HTMLDivElement>('apiResult');
  const button = getElement<HTMLButtonElement>('sendRequest');
  const endpoint = catalog?.endpoints.find((item) => item.path === currentAPI) || selectedEndpoint;
  if (!endpoint) {
    resultEl.innerHTML = logLine(t('dynamic.catalogLoadFailed'), 'danger');
    return;
  }

  if (!walletConnected) {
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
      const challenge = (await response.json()) as { payTo?: string; price?: string; currency?: string; tokenContract?: string };
      resultEl.innerHTML += [
        logLine(t('dynamic.received402'), 'warning'),
        logLine(t('dynamic.payTo', { value: challenge.payTo || '' }), 'default'),
        logLine(t('dynamic.priceValue', { value: challenge.price || '', currency: challenge.currency || '' }), 'success'),
      ].join('');

      if (walletType === 'Demo') {
        await executeDemoReplay(requestUrl, requestConfig, resultEl);
      } else if (walletType === 'Rabby Wallet') {
        await executeRabbyReplay(requestUrl, endpoint, requestConfig, challenge, resultEl);
      } else {
        resultEl.innerHTML += logLine(t('dynamic.walletInDevelopment', { walletType }), 'warning');
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

async function copyGatewayAddress() {
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

function closeModal() {
  getElement<HTMLDivElement>('apiModal').classList.add('hidden');
  getElement<HTMLDivElement>('apiModal').classList.remove('flex');
  currentAPI = '';
}

function setLanguage(language: Language) {
  currentLanguage = language;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  syncLanguageUrl(language);
  applyStaticTranslations();
  updatePaymentModule();
  if (catalog) {
    renderCatalog(catalog.endpoints);
    setSelectedEndpoint(selectedEndpoint || catalog.endpoints[0] || null);
  }
  if (walletConnected) {
    updateWalletUI();
  }
}

function bindEvents() {
  getElement<HTMLButtonElement>('languageToggle').addEventListener('click', () => {
    setLanguage(currentLanguage === 'zh' ? 'en' : 'zh');
  });

  getElement<HTMLButtonElement>('copyReceiverButton').addEventListener('click', () => {
    void copyGatewayAddress();
  });

  getElement<HTMLButtonElement>('connectWallet').addEventListener('click', () => {
    if (walletConnected) {
      window.alert(
        t('dynamic.walletConnectedAlert', {
          address: walletAddress,
          walletType,
          modeDescription: getWalletModeDescription(walletType),
        }),
      );
      return;
    }

    openWalletModal();
  });

  document.querySelectorAll<HTMLElement>('[data-wallet-type]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.getAttribute('data-wallet-state') === 'pending') {
        const pendingType =
          button.dataset.walletType === 'coinbase'
            ? 'Coinbase Wallet'
            : button.dataset.walletType === 'metamask'
              ? 'MetaMask'
              : 'Wallet';
        window.alert(t('dynamic.walletInDevelopment', { walletType: pendingType }));
        return;
      }

      const walletTypeValue = button.dataset.walletType;
      if (walletTypeValue === 'coinbase' || walletTypeValue === 'metamask' || walletTypeValue === 'rabby') {
        void connectWallet(walletTypeValue).catch((error) => {
          window.alert(getWalletErrorMessage(error));
        });
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
    if (!card?.dataset.endpointPath || !catalog) {
      return;
    }

    const endpoint = catalog.endpoints.find((item) => item.path === card.dataset.endpointPath);
    setSelectedEndpoint(endpoint || catalog.endpoints[0] || null);
  });
}

applyStaticTranslations();
updatePaymentModule();
setHeroTerminal(null);
bindEvents();
void loadHealth();
void loadCatalog();
