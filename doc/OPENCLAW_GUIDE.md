# OpenClaw Guide

## Goal

Use OpenClaw or other agent runners to discover paid endpoints from API402, receive a `402` challenge, then replay the request with `PAYMENT-SIGNATURE`.

## Recommended flow

1. Read the catalog first:

```bash
curl https://api-402.com/api/v1/catalog
```

2. Choose an endpoint and make the first request:

```bash
curl -i https://api-402.com/api/polymarket/trending
```

3. Read `PAYMENT-REQUIRED`, create a payment header with an x402-compatible signer, then replay:

```bash
curl https://api-402.com/api/polymarket/trending \
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>"
```

## Lightweight SDK

The repo now exposes a lightweight browser / Node ESM client:

- `/sdk/api402-client.mjs`

Example:

```js
import { API402Client } from "https://api-402.com/sdk/api402-client.mjs";

const client = new API402Client({
  baseUrl: "https://api-402.com",
  async paymentHandler({ paymentRequired }) {
    return {
      "PAYMENT-SIGNATURE": await createX402PaymentHeader(paymentRequired),
    };
  },
});

const result = await client.get("/api/polymarket/trending");
console.log(result);
```

## Notes

- The catalog is the source of truth for path, price, and network.
- Production settlement is Base mainnet native USDC.
- The current production path is compatible with official x402 v2 `PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE`.
