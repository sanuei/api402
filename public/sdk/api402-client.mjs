const jsonHeaders = {
  Accept: "application/json",
};

function decodeBase64Json(value) {
  return JSON.parse(globalThis.atob(value));
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function decodePaymentRequiredHeader(value) {
  if (!value) {
    throw new Error("Missing PAYMENT-REQUIRED header");
  }

  return decodeBase64Json(value);
}

export class API402Client {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || "https://api-402.com").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.defaultHeaders || {};
    this.paymentHandler = options.paymentHandler;
  }

  async catalog() {
    return this.request("/api/v1/catalog");
  }

  async health() {
    return this.request("/api/v1/health");
  }

  async get(path, options = {}) {
    return this.request(path, { ...options, method: "GET" });
  }

  async post(path, body, options = {}) {
    return this.request(path, { ...options, method: "POST", body });
  }

  async request(path, options = {}) {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const method = options.method || "GET";
    const headers = new Headers({ ...jsonHeaders, ...this.defaultHeaders, ...(options.headers || {}) });
    let body;

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body,
    });

    if (response.status !== 402) {
      return parseJson(response);
    }

    if (!this.paymentHandler) {
      const challenge = decodePaymentRequiredHeader(response.headers.get("PAYMENT-REQUIRED"));
      const error = new Error("Payment required");
      error.paymentRequired = challenge;
      throw error;
    }

    const paymentRequired = decodePaymentRequiredHeader(response.headers.get("PAYMENT-REQUIRED"));
    const paymentHeaders = await this.paymentHandler({
      url,
      path,
      method,
      paymentRequired,
      response,
      request: {
        headers,
        body: options.body,
      },
    });

    const replayHeaders = new Headers({ ...jsonHeaders, ...this.defaultHeaders, ...(options.headers || {}) });
    Object.entries(paymentHeaders || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        replayHeaders.set(key, value);
      }
    });

    if (options.body !== undefined) {
      replayHeaders.set("Content-Type", "application/json");
    }

    const replay = await this.fetchImpl(url, {
      method,
      headers: replayHeaders,
      body,
    });

    return parseJson(replay);
  }
}
