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
    'nav.integrations': '接入',
    'nav.openclaw': 'OpenClaw',
    'nav.faq': '问答',
    'nav.openCatalog': '打开目录',
    'nav.connectWallet': '连接钱包',
    'hero.kicker': '按次付费 API 商店',
    'hero.title.line1': '用 USDC 按次购买',
    'hero.title.line2': 'API 和 AI 模型',
    'hero.description':
      '这是一个按次付费 API 商店。先看目录，发起请求，收到 402 后付款，再拿到真实数据或模型结果。',
    'hero.browse': '浏览付费 API',
    'hero.examples': '查看接入示例',
    'hero.badge1': '先调后付',
    'hero.badge2': '支持 OpenClaw',
    'hero.badge3': 'Base USDC 结算',
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
    'catalog.directoryHint': '先按分类快速定位，再到右侧查看详情。',
    'catalog.openCatalog': '打开 /api/v1/catalog',
    'catalog.openHealth': '打开 /api/v1/health',
    'flow.kicker': '开发者工作流',
    'flow.title': '三步接入，不用自己再拼支付协议',
    'flow.summary':
      '先发现接口，再拿 402 challenge，最后用兼容客户端重放请求。OpenClaw、浏览器脚本和服务端作业都走同一套流程。',
    'flow.summaryItem1Label': '发现',
    'flow.summaryItem1Value': '读 catalog 拿到路径、价格、支付要求',
    'flow.summaryItem2Label': '授权',
    'flow.summaryItem2Value': '收到 402 后，用钱包或 x402 客户端签名',
    'flow.summaryItem3Label': '回放',
    'flow.summaryItem3Value': '带 PAYMENT-SIGNATURE 重放并拿到结果',
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
    'integrations.kicker': 'OpenClaw 与 SDK',
    'integrations.title': '给 Agent、OpenClaw 和脚本的最快接入方式',
    'integrations.description':
      '现在先提供最轻量的两条路：直接让 OpenClaw 调你的 API，或者用浏览器 / Node 都能跑的轻量 SDK 包一层。',
    'integrations.openclawBadge': 'OpenClaw 快速接入',
    'integrations.openclawTitle': '先读目录，再让 OpenClaw 调付费接口',
    'integrations.openclawBody':
      '最稳的方式是先读取 catalog 发现价格和路径，再用 x402 兼容客户端重放请求。这样更适合给 Agent 自动挑接口。',
    'integrations.openclawStep1': '先读取 catalog，给 OpenClaw 暴露可用接口、价格和请求方式。',
    'integrations.openclawStep2': '先发第一次请求拿到 402 challenge，再用 PAYMENT-SIGNATURE 重放。',
    'integrations.openclawStep3': '把返回的 `_meta` 和 PAYMENT-RESPONSE 保存下来，方便 Agent 做日志和重试。',
    'integrations.openclawHint': '先读目录，再做付费重放',
    'integrations.sdkBadge': 'SDK Starter',
    'integrations.sdkTitle': '轻量 JS SDK 已可直接接入',
    'integrations.sdkBody':
      '现在已经提供一个轻量 ESM SDK，用来统一 catalog、health、402 challenge 和 replay 请求。你只需要接自己的 payment handler。',
    'integrations.sdkOpen': '打开 SDK 文件',
    'integrations.sdkCatalog': '查看 Catalog JSON',
    'integrations.sdkHint': '支付签名由你的客户端接入',
    'cards.whyBadge': '为什么值得买',
    'cards.whyTitle': '按次用最新模型，不必买多份月费套餐',
    'cards.whyBody':
      '适合想体验最新模型、偶尔跑高价值任务、或者让 agent 在多个模型之间按需切换的开发者和团队。',
    'cards.stackBadge': '结算可验证',
    'cards.stackTitle': 'Base USDC 结算可回查，不是站内虚拟余额',
    'cards.stackBody':
      '真实支付会校验签名、Base USDC 转账回执、确认数和防重放状态，适合做正式的按次调用结算。',
    'cards.nextBadge': '现在能买',
    'cards.nextTitle': '旗舰模型和 Web3 风险情报都在变成真接口',
    'cards.nextBody':
      '当前主打 GPT-5.4、GPT-5.4 Pro、Claude 4.6、DeepSeek、Qwen，并开始扩展 wallet-risk 这类更高价值接口。',
    'faq.kicker': '问答',
    'faq.title': '购买前最常见的几个问题',
    'faq.q1': '为什么不直接订阅某一家模型平台？',
    'faq.a1':
      '如果你只是偶尔体验最新模型、临时跑一个任务，或者想让 agent 在多个模型之间按需切换，按次付费通常比同时买多家订阅更轻。',
    'faq.q2': '这里的付款怎么验证？',
    'faq.a2':
      '网关会校验签名载荷、Base 主网原生 USDC 转账回执、确认数和防重放状态。真实结算按 PAYMENT_VALID 统计，Demo 不会计入收入面板。',
    'faq.q3': '现在支持哪些支付方式和钱包？',
    'faq.a3':
      '当前正式支付范围是 Base 主网原生 USDC，浏览器内优先支持 Rabby Wallet。Coinbase Wallet 和 MetaMask 仍在继续完善。',
    'faq.q4': '如果我只是想先试一下呢？',
    'faq.a4':
      '页面仍然保留 Demo Mode，用来先跑通 402 challenge -> replay -> data 的接入流程。适合联调确认后再切真实支付。',
    'footer.summary':
      '用 Base USDC 按次购买最新模型、Polymarket 情报和 agent-ready APIs。无需注册，不需要长期订阅。',
    'footer.productTitle': '产品',
    'footer.developerTitle': '开发者',
    'footer.infrastructureTitle': '基础设施',
    'footer.linkCatalog': 'API 目录',
    'footer.linkExamples': '调用示例',
    'footer.linkOpenClaw': 'OpenClaw 接入',
    'footer.linkSdk': 'SDK Starter',
    'footer.linkCatalogJson': 'Catalog JSON',
    'footer.linkHealth': '健康检查',
    'footer.linkMetrics': '实时指标',
    'footer.linkGithub': 'GitHub',
    'footer.linkX402': 'x402',
    'footer.linkBase': 'Base',
    'footer.linkFacilitator': 'x402 Facilitator',
    'footer.linkCloudflare': 'Cloudflare Workers',
    'footer.pillUsdc': 'Base USDC',
    'footer.pillX402': 'x402 checkout',
    'footer.pillAgents': 'Agent-ready',
    'footer.tagline': 'Pay-per-call frontier models and agent-ready APIs on Base',
    'footer.note': '适合一次性模型体验、交易前准备和 agent 工作流。',
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
    'requestMetrics.recentRequestsShort': '请求',
    'requestMetrics.payment402Rate': '402 比率',
    'requestMetrics.payment402RateShort': '402',
    'requestMetrics.replayConversion': '重放转化率',
    'requestMetrics.replayConversionShort': '转化',
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
    'nav.integrations': 'Integrations',
    'nav.openclaw': 'OpenClaw',
    'nav.faq': 'FAQ',
    'nav.openCatalog': 'Open Catalog',
    'nav.connectWallet': 'Connect Wallet',
    'hero.kicker': 'Pay-per-call API marketplace',
    'hero.title.line1': 'Buy API calls and frontier models',
    'hero.title.line2': 'with USDC, one request at a time',
    'hero.description':
      'This is a pay-per-call API marketplace. Browse the catalog, make a request, pay after the 402 challenge, and receive real data or model output.',
    'hero.browse': 'Browse Paid APIs',
    'hero.examples': 'See Integration Examples',
    'hero.badge1': 'Request first',
    'hero.badge2': 'OpenClaw ready',
    'hero.badge3': 'Base USDC settlement',
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
    'catalog.directoryHint': 'Jump by category first, then inspect details on the right.',
    'catalog.openCatalog': 'Open /api/v1/catalog',
    'catalog.openHealth': 'Open /api/v1/health',
    'flow.kicker': 'Builder Workflow',
    'flow.title': 'Three steps to integrate, without rebuilding the payment stack',
    'flow.summary':
      'Discover the route, receive the 402 challenge, then replay with a compatible client. OpenClaw, browser scripts, and backend jobs can follow the same path.',
    'flow.summaryItem1Label': 'Discover',
    'flow.summaryItem1Value': 'Read the catalog for routes, prices, and payment requirements',
    'flow.summaryItem2Label': 'Authorize',
    'flow.summaryItem2Value': 'After the 402 challenge, sign with a wallet or x402 client',
    'flow.summaryItem3Label': 'Replay',
    'flow.summaryItem3Value': 'Replay with PAYMENT-SIGNATURE and receive the result',
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
    'integrations.kicker': 'OpenClaw And SDK',
    'integrations.title': 'The fastest way to connect agents, OpenClaw, and scripts',
    'integrations.description':
      'Right now the cleanest paths are: let OpenClaw call the API directly, or wrap the gateway with a lightweight SDK that handles catalog, challenge discovery, and replay.',
    'integrations.openclawBadge': 'OpenClaw Quickstart',
    'integrations.openclawTitle': 'Read the catalog first, then let OpenClaw call paid endpoints',
    'integrations.openclawBody':
      'The stable pattern is to discover routes and prices from the catalog first, then replay requests with an x402-compatible payment client.',
    'integrations.openclawStep1': 'Read the catalog first so OpenClaw can see routes, prices, and request methods.',
    'integrations.openclawStep2': 'Make the first request to receive a 402 challenge, then replay with PAYMENT-SIGNATURE.',
    'integrations.openclawStep3': 'Store `_meta` and PAYMENT-RESPONSE for logs, retries, and agent-side auditing.',
    'integrations.openclawHint': 'Catalog first, then paid replay',
    'integrations.sdkBadge': 'SDK Starter',
    'integrations.sdkTitle': 'A lightweight JS SDK is ready to use now',
    'integrations.sdkBody':
      'There is now a lightweight ESM SDK for catalog, health, 402 challenge discovery, and replay. You only need to plug in your own payment handler.',
    'integrations.sdkOpen': 'Open SDK File',
    'integrations.sdkCatalog': 'View Catalog JSON',
    'integrations.sdkHint': 'Bring your own payment signer',
    'cards.whyBadge': 'Why Pay Here',
    'cards.whyTitle': 'Try frontier models without stacking monthly subscriptions',
    'cards.whyBody':
      'Built for developers and teams who want to sample the latest models, run high-value tasks on demand, or route agents across multiple providers.',
    'cards.stackBadge': 'Verified Settlement',
    'cards.stackTitle': 'Base USDC payments are verifiable, not app-only credits',
    'cards.stackBody':
      'Live payments validate signed payloads, Base USDC transfer receipts, confirmations, and replay protection before the request is accepted.',
    'cards.nextBadge': 'Available Now',
    'cards.nextTitle': 'Frontier models and Web3 risk intelligence are shipping as real APIs',
    'cards.nextBody':
      'The current lineup prioritizes GPT-5.4, GPT-5.4 Pro, Claude 4.6, DeepSeek, Qwen, and the first wallet-risk intelligence endpoint.',
    'faq.kicker': 'FAQ',
    'faq.title': 'Common questions before you buy',
    'faq.q1': 'Why not just subscribe to one model platform?',
    'faq.a1':
      'If you only need occasional access to the latest models, want to run a high-value task, or need an agent to switch between providers, pay-per-call can be lighter than maintaining multiple subscriptions.',
    'faq.q2': 'How is payment verified here?',
    'faq.a2':
      'The gateway validates the signed payment payload, the Base mainnet USDC transfer receipt, confirmation depth, and anti-replay state. Demo calls do not count as settled revenue.',
    'faq.q3': 'Which wallets and payment methods are supported right now?',
    'faq.a3':
      'The production path is Base mainnet native USDC, and the browser flow currently prioritizes Rabby Wallet. Coinbase Wallet and MetaMask are still being completed.',
    'faq.q4': 'What if I only want to test the flow first?',
    'faq.a4':
      'Demo Mode is still available so you can verify the 402 challenge -> replay -> data workflow before switching to live settlement.',
    'footer.summary':
      'Buy frontier models, Polymarket intelligence, and agent-ready APIs one call at a time with Base USDC. No signup and no long subscription commitment.',
    'footer.productTitle': 'Product',
    'footer.developerTitle': 'Developer',
    'footer.infrastructureTitle': 'Infrastructure',
    'footer.linkCatalog': 'API Catalog',
    'footer.linkExamples': 'Examples',
    'footer.linkOpenClaw': 'OpenClaw Guide',
    'footer.linkSdk': 'SDK Starter',
    'footer.linkCatalogJson': 'Catalog JSON',
    'footer.linkHealth': 'Health',
    'footer.linkMetrics': 'Metrics',
    'footer.linkGithub': 'GitHub',
    'footer.linkX402': 'x402',
    'footer.linkBase': 'Base',
    'footer.linkFacilitator': 'x402 Facilitator',
    'footer.linkCloudflare': 'Cloudflare Workers',
    'footer.pillUsdc': 'Base USDC',
    'footer.pillX402': 'x402 checkout',
    'footer.pillAgents': 'Agent-ready',
    'footer.tagline': 'Pay-per-call frontier models and agent-ready APIs on Base',
    'footer.note': 'Built for one-off model access, trading prep, and agent workflows.',
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
    'requestMetrics.recentRequestsShort': 'Requests',
    'requestMetrics.payment402Rate': '402 Rate',
    'requestMetrics.payment402RateShort': '402',
    'requestMetrics.replayConversion': 'Replay Conversion',
    'requestMetrics.replayConversionShort': 'Replay',
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
