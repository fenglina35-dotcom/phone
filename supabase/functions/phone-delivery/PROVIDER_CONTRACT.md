# Phone Delivery Upstream Contract

`phone-delivery` is the trusted public connector. Platform credentials stay in a separately controlled upstream adapter selected by `PHONE_DELIVERY_UPSTREAM_URL`.

## Authentication

Every connector request uses HTTPS and includes:

- `x-phone-delivery-contract: 1`
- `x-phone-delivery-timestamp: <unix milliseconds>`
- `x-phone-delivery-signature: <lowercase HMAC-SHA256 hex>`

The signed value is `timestamp + "." + rawRequestBody`. The adapter must reject a timestamp older than five minutes and compare signatures in constant time.

## Request body

```json
{
  "action": "capabilities | confirm_address | search | create_order | pay_order | order_status",
  "payload": {},
  "context": {
    "target": "opaque device id",
    "appVersion": "client build",
    "privateApp": true,
    "requestId": "connector trace id"
  }
}
```

The adapter must implement idempotency for `create_order` and `pay_order` using the client request ID inside `payload`. Platform credentials and cookies must never be returned.

## Standard webhook

Send normalized status changes to:

`POST https://qvuahlqimcfgeoetosnl.supabase.co/functions/v1/phone-delivery?webhook=1`

Sign the raw body with `x-delivery-webhook-timestamp` and `x-delivery-webhook-signature` using the same algorithm and secret.

```json
{
  "provider": "taobao_flash",
  "eventId": "stable provider event id",
  "orderId": "real provider order id",
  "status": "delivering",
  "total": 28.5,
  "paymentMethod": "wechat"
}
```

Only platform-confirmed facts may be sent. Never infer `paid`, `refunded`, courier position, ETA, ratings, discounts, or delivery completion.
