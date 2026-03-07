var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var API_PRICES = {
  "/api/btc-price": {
    price: "0.00001",
    description: "Bitcoin price feed - Real-time BTC price from multiple exchanges",
    data: { symbol: "BTC", price: 67234.56, timestamp: Date.now() }
  },
  "/api/eth-price": {
    price: "0.00001",
    description: "Ethereum price feed",
    data: { symbol: "ETH", price: 3456.78, timestamp: Date.now() }
  },
  "/api/deepseek": {
    price: "0.003",
    description: "DeepSeek AI Chat - V3.2 model",
    data: { model: "deepseek-v3", response: "Hello! How can I help you today?", usage: { tokens: 128 } }
  },
  "/api/qwen": {
    price: "0.01",
    description: "Qwen3 Max AI - Alibaba flagship model",
    data: { model: "qwen3-max", response: "\u60A8\u597D\uFF01\u6709\u4EC0\u4E48\u6211\u53EF\u4EE5\u5E2E\u60A8\u7684\uFF1F", usage: { tokens: 256 } }
  },
  "/api/whale-positions": {
    price: "0.00002",
    description: "HyperLiquid whale positions",
    data: { positions: [
      { address: "0x1234...", size: 125e4, pnl: 12.5 },
      { address: "0x5678...", size: 98e4, pnl: 8.2 },
      { address: "0xabcd...", size: 75e4, pnl: -2.1 }
    ] }
  },
  "/api/kline": {
    price: "0.001",
    description: "Binance K-line data",
    data: { symbol: "BTC/USDT", interval: "1h", candles: [
      [17e8, 67e3, 67500, 66500, 67200, 1e3],
      [1700003600, 67200, 67800, 67100, 67650, 1200]
    ] }
  }
};
var DEFAULT_PAY_TO = "0x742d35Cc6634C0532925a3b844Bc9e7595f4f8E1";
function createPaymentRequired(payTo, price, description, path) {
  const body = JSON.stringify({
    code: "PAYMENT_REQUIRED",
    message: "Payment required to access this API",
    payTo,
    price,
    currency: "USDC",
    chain: "base",
    scheme: "exact",
    path,
    description,
    instructions: [
      "1. Connect your wallet",
      "2. Sign an EIP-3009 authorization",
      "3. USDC will be debited automatically on each request"
    ],
    x402Spec: "https://x402.org"
  });
  return new Response(body, {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Required": "true",
      "X-Pay-To": payTo,
      "X-Price": price,
      "X-Currency": "USDC",
      "X-Chain": "base",
      "X-Scheme": "exact",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(createPaymentRequired, "createPaymentRequired");
async function verifyPayment(request, price, payTo) {
  const paymentProof = request.headers.get("X-Payment-Proof");
  const authorization = request.headers.get("Authorization");
  if (authorization && authorization.startsWith("Bearer ")) {
    return true;
  }
  return paymentProof !== null;
}
__name(verifyPayment, "verifyPayment");
function getClientIP(request) {
  const forwarded = request.headers.get("CF-Connecting-IP");
  return forwarded || "unknown";
}
__name(getClientIP, "getClientIP");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Payment-Proof, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const payTo = env.PAY_TO || DEFAULT_PAY_TO;
    if (path === "/" || path === "/index.html") {
      return new Response(JSON.stringify({
        name: "API Market",
        version: "1.0.0",
        description: "x402 Payment Gateway - Pay with USDC",
        endpoints: Object.entries(API_PRICES).map(([path2, config]) => ({
          path: path2,
          price: config.price,
          description: config.description
        }))
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (path === "/prices") {
      return new Response(JSON.stringify(API_PRICES), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const apiEndpoint = API_PRICES[path];
    if (!apiEndpoint) {
      return new Response(JSON.stringify({
        error: "Endpoint not found",
        availableEndpoints: Object.keys(API_PRICES)
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const isPaid = await verifyPayment(request, apiEndpoint.price, payTo);
    if (!isPaid) {
      return createPaymentRequired(payTo, apiEndpoint.price, apiEndpoint.description, path);
    }
    const responseData = {
      ...apiEndpoint.data,
      _meta: {
        paid: true,
        price: apiEndpoint.price,
        payTo,
        timestamp: Date.now(),
        clientIP: getClientIP(request)
      }
    };
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-9LG1iG/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-9LG1iG/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
