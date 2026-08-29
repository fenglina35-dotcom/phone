import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;

const DELIVERY_ACTIONS = new Set([
  "capabilities",
  "confirm_address",
  "search",
  "offer_options",
  "create_order",
  "pay_order",
  "order_status",
  "saved_routes",
]);
const DELIVERY_DEVICE_ACTIONS = new Set([
  "device_pairing_begin",
  "device_status",
  "device_revoke",
]);
const ORDER_STATUSES = new Set([
  "created",
  "pending_payment",
  "paid",
  "merchant_confirmed",
  "preparing",
  "courier_assigned",
  "picked_up",
  "delivering",
  "delivered",
  "canceled",
  "refunded",
  "failed",
]);
const STATUS_RANK: Record<string, number> = {
  created: 1,
  pending_payment: 1,
  paid: 2,
  merchant_confirmed: 3,
  preparing: 4,
  courier_assigned: 5,
  picked_up: 6,
  delivering: 7,
  delivered: 8,
};
const TERMINAL = new Set(["delivered", "canceled", "refunded", "failed"]);
const PROVIDERS = new Set(["taobao_flash", "meituan"]);
const PAYMENTS = new Set(["wechat", "alipay"]);

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function text(value: unknown, limit = 300) {
  return String(value ?? "").trim().slice(0, limit);
}

function money(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
    throw new Error("invalid-money");
  }
  return Math.round(amount * 100) / 100;
}

function allowedURL(value: unknown, payment = false) {
  const raw = text(value, 1200);
  if (!raw) return "";
  const url = new URL(raw);
  const schemes = payment
    ? new Set(["https:", "weixin:", "alipays:", "alipay:"])
    : new Set(["https:"]);
  if (!schemes.has(url.protocol.toLowerCase())) throw new Error("unsafe-url");
  return raw;
}

function payQrDataURL(value: unknown) {
  const raw = text(value, 320_000);
  return /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(raw) ? raw : "";
}

function optionGroups(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((group) => {
    const row = object(group);
    const choices = (Array.isArray(row.choices) ? row.choices : []).slice(0, 30).map((choice) => {
      const item = object(choice);
      return {
        id: text(item.id || item.value || item.label, 120),
        label: text(item.label || item.name || item.value, 80),
        priceDelta: money(item.priceDelta || item.extraPrice || 0),
        available: item.available !== false,
        selected: item.selected === true,
      };
    }).filter((choice) => choice.id && choice.label && choice.available);
    return {
      id: text(row.id || row.name, 120),
      name: text(row.name || row.label, 80),
      required: row.required !== false,
      multiple: row.multiple === true,
      selectionCount: Math.max(1, Math.min(20, Number(row.selectionCount) || 1)),
      choices,
    };
  }).filter((group) => group.id && group.name && group.choices.length);
}

function status(value: unknown, fallback = "pending_payment") {
  const normalized = text(value, 40).toLowerCase();
  if (!ORDER_STATUSES.has(normalized)) return fallback;
  return normalized;
}

function cors(request: Request) {
  const origin = request.headers.get("origin") || "";
  const configured = (Deno.env.get("PHONE_DELIVERY_ALLOWED_ORIGINS") || "")
    .split(",").map((item) => item.trim()).filter(Boolean);
  const allowed = !configured.length || !origin || configured.includes(origin);
  return {
    allowed,
    headers: {
      "Access-Control-Allow-Origin": allowed ? (origin || "*") : "null",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-north-delivery-contract, x-delivery-webhook-signature, x-delivery-webhook-timestamp",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin",
    },
  };
}

function reply(request: Request, body: unknown, httpStatus = 200) {
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { ...cors(request).headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function admin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("supabase-not-configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function hexHMAC(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  ));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function authenticate(client: ReturnType<typeof admin>, input: JsonObject) {
  const context = object(input.client);
  const target = text(context.target, 100);
  const ownerSecret = text(context.ownerSecret, 200);
  if (!/^yb_[a-z0-9]{20,96}$/.test(target) || ownerSecret.length < 24) {
    throw new Error("delivery-client-auth-required");
  }
  const { data, error } = await client.rpc("phone_delivery_authenticate", {
    p_target: target,
    p_secret: ownerSecret,
  });
  if (error) throw error;
  if (data !== true) throw new Error("delivery-client-auth-failed");
  return {
    target,
    ownerSecret,
    appVersion: text(context.appVersion, 100),
    privateApp: context.privateApp === true,
  };
}

class DeliveryDeviceJobPending extends Error {
  jobId: string;
  constructor(jobId: string) {
    super("personal-delivery-device-working");
    this.name = "DeliveryDeviceJobPending";
    this.jobId = jobId;
  }
}

async function upstream(action: string, payload: JsonObject, context: JsonObject) {
  const url = Deno.env.get("PHONE_DELIVERY_UPSTREAM_URL") || "";
  const secret = Deno.env.get("PHONE_DELIVERY_UPSTREAM_SECRET") || "";
  if (!url || !secret) throw new Error("真实外卖平台授权尚未配置");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("delivery-upstream-must-use-https");
  const body = JSON.stringify({ action, payload, context });
  const retryable = new Set(["capabilities", "confirm_address", "search", "offer_options", "create_order", "order_status", "saved_routes"]);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timestamp = String(Date.now());
    const signature = await hexHMAC(secret, `${timestamp}.${body}`);
    const response = await fetch(parsed.href, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-phone-delivery-timestamp": timestamp,
        "x-phone-delivery-signature": signature,
        "x-phone-delivery-contract": "1",
      },
      body,
      signal: AbortSignal.timeout(action === "search" ? 50000 : 35000),
    });
    const raw = await response.text();
    let decoded: JsonObject = {};
    try { decoded = object(raw ? JSON.parse(raw) : {}); } catch (_) { /* handled below */ }
    // Cloudflare can briefly return a plain HTML 502 before the request reaches
    // the signed browser service. Retry that ambiguous intermediary response
    // once with the identical task/clientRequestId. The browser adapter and
    // database both enforce idempotency for create_order. A specific JSON
    // error from the browser is never retried, and payment submission is not in
    // the retry allow-list.
    const transientGateway = response.status === 502 && !text(decoded.error, 180);
    if (attempt === 0 && transientGateway && retryable.has(action)) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      continue;
    }
    if (!response.ok || decoded.ok === false) {
      throw new Error(text(decoded.error || `真实外卖上游 HTTP ${response.status}`, 180));
    }
    return object(decoded.data ?? decoded);
  }
  throw new Error("真实外卖上游暂时不可用");
}

async function routedUpstream(
  client: ReturnType<typeof admin>,
  caller: Awaited<ReturnType<typeof authenticate>>,
  action: string,
  payload: JsonObject,
  context: JsonObject,
  requestKey: string,
) {
  const linked = (await client.from("phone_delivery_devices")
    .select("target")
    .eq("target", caller.target)
    .is("revoked_at", null)
    .maybeSingle()).data;
  if (linked?.target) {
    if (!/^dlr_[a-z0-9-]{16,120}$/i.test(requestKey)) {
      throw new Error("personal-delivery-request-key-required");
    }
    const queued = await client.rpc("phone_delivery_enqueue_device_job", {
      p_target: caller.target,
      p_owner_secret: caller.ownerSecret,
      p_request_key: requestKey,
      p_action: action,
      p_payload: payload,
      p_context: context,
    });
    if (queued.error) throw queued.error;
    const job = object(queued.data);
    const state = text(job.status, 30);
    if (state === "completed") return object(job.result);
    if (state === "failed" || state === "expired") {
      throw new Error(text(job.error, 240) || "个人外卖电脑执行失败");
    }
    throw new DeliveryDeviceJobPending(text(job.id, 80));
  }

  const legacyTargets = new Set((Deno.env.get("PHONE_DELIVERY_LEGACY_TARGETS") || "")
    .split(",").map((item) => item.trim()).filter(Boolean));
  if (!legacyTargets.has(caller.target)) {
    throw new Error("此小手机尚未绑定本人的外卖电脑，已禁止连接其他人的后台");
  }
  return upstream(action, payload, context);
}

function capabilityResult(value: JsonObject) {
  const providers = Array.isArray(value.providers)
    ? value.providers.map((item) => text(item, 40)).filter((item) => PROVIDERS.has(item))
    : [];
  const payments = Array.isArray(value.payments)
    ? value.payments.map((item) => text(item, 40)).filter((item) => PAYMENTS.has(item))
    : [];
  return {
    providers,
    payments,
    addressLabel: text(value.addressLabel, 80),
    automaticPayments: value.automaticPayments === true,
    addressConfirmation: value.addressConfirmation !== false,
    realtimeWebhooks: value.realtimeWebhooks === true,
  };
}

function offerResult(value: unknown) {
  const row = object(value);
  const provider = text(row.provider, 40);
  if (!PROVIDERS.has(provider)) throw new Error("unsupported-provider");
  const offerId = text(row.offerId || row.id, 160);
  const quoteId = text(row.quoteId, 160);
  if (!offerId || !quoteId) throw new Error("invalid-offer");
  return {
    offerId,
    quoteId,
    quoteExpiresAt: Number(row.quoteExpiresAt || 0) || 0,
    provider,
    merchantId: text(row.merchantId, 120),
    merchant: text(row.merchant || row.shop, 100),
    name: text(row.name, 140),
    description: text(row.description || row.desc, 240),
    price: money(row.price),
    deliveryFee: money(row.deliveryFee || 0),
    total: money(row.total),
    rating: Number.isFinite(Number(row.rating)) ? Math.max(0, Math.min(5, Number(row.rating))) : null,
    reviewCount: Number.isFinite(Number(row.reviewCount)) ? Math.max(0, Math.floor(Number(row.reviewCount))) : null,
    monthlySales: Number.isFinite(Number(row.monthlySales)) ? Math.max(0, Math.floor(Number(row.monthlySales))) : null,
    etaMinutes: Number.isFinite(Number(row.etaMinutes)) ? Math.max(0, Math.floor(Number(row.etaMinutes))) : null,
    distanceKm: Number.isFinite(Number(row.distanceKm)) ? Math.max(0, Number(row.distanceKm)) : null,
    couponLabel: text(row.couponLabel, 100),
    imageUrl: allowedURL(row.imageUrl),
    emoji: text(row.emoji, 4),
    addressLabel: text(row.addressLabel, 80),
    addressFingerprint: text(row.addressFingerprint, 180),
    rawVersion: text(row.rawVersion, 80),
    optionGroups: optionGroups(row.optionGroups || row.options),
    optionsLoaded: row.optionsLoaded === true,
  };
}

function orderResponse(row: JsonObject) {
  return {
    id: text(row.remote_order_id || row.orderId || row.id, 160),
    orderId: text(row.remote_order_id || row.orderId || row.id, 160),
    provider: text(row.provider, 40),
    merchant: text(row.merchant, 100),
    merchantId: text(row.merchant_id || row.merchantId, 120),
    items: Array.isArray(row.items) ? row.items : [],
    total: money(row.total),
    status: status(row.status, "created"),
    paymentMethod: text(row.payment_method || row.paymentMethod, 40),
    payUrl: allowedURL(row.payUrl || object(row.provider_payload).payUrl, true),
    payQrDataUrl: payQrDataURL(row.payQrDataUrl || object(row.provider_payload).payQrDataUrl),
    addressLabel: text(row.address_label || row.addressLabel, 80),
    addressFingerprint: text(row.address_fingerprint || row.addressFingerprint, 180),
    risk: Array.isArray(row.risk) ? row.risk : [],
  };
}

function shouldAdvance(before: string, next: string) {
  if (!next || before === next || TERMINAL.has(before)) return before === next;
  if (TERMINAL.has(next)) return true;
  return (STATUS_RANK[next] ?? -1) >= (STATUS_RANK[before] ?? -1);
}

async function handleClientAction(
  request: Request,
  input: JsonObject,
  client: ReturnType<typeof admin>,
) {
  const action = text(input.action, 40);
  if (!DELIVERY_ACTIONS.has(action) && !DELIVERY_DEVICE_ACTIONS.has(action)) {
    return reply(request, { ok: false, error: "不支持的真实外卖操作" }, 400);
  }
  const caller = await authenticate(client, input);
  const payload = object(input.payload);
  if (action === "device_pairing_begin") {
    const paired = await client.rpc("phone_delivery_begin_device_pairing", {
      p_target: caller.target,
      p_owner_secret: caller.ownerSecret,
    });
    if (paired.error) throw paired.error;
    return reply(request, { ok: true, data: object(paired.data) });
  }
  if (action === "device_status") {
    const statusResult = await client.rpc("phone_delivery_device_status", {
      p_target: caller.target,
      p_owner_secret: caller.ownerSecret,
    });
    if (statusResult.error) throw statusResult.error;
    return reply(request, { ok: true, data: object(statusResult.data) });
  }
  if (action === "device_revoke") {
    if (payload.confirmedByUser !== true) {
      return reply(request, { ok: false, error: "必须由本人确认解绑外卖电脑" }, 400);
    }
    const revoked = await client.rpc("phone_delivery_revoke_device", {
      p_target: caller.target,
      p_owner_secret: caller.ownerSecret,
    });
    if (revoked.error) throw revoked.error;
    return reply(request, { ok: true, data: { revoked: revoked.data === true } });
  }

  const clientInfo = object(input.client);
  const requestKey = text(clientInfo.relayRequestId, 140);
  const context = {
    target: caller.target,
    appVersion: caller.appVersion,
    privateApp: caller.privateApp,
    requestId: requestKey || crypto.randomUUID(),
  };

  if (action === "capabilities") {
    return reply(request, { ok: true, data: capabilityResult(await routedUpstream(client, caller, action, payload, context, requestKey)) });
  }
  if (action === "confirm_address") {
    if (payload.confirmedByUser !== true) return reply(request, { ok: false, error: "必须由本人确认收货地址" }, 400);
    const data = await routedUpstream(client, caller, action, payload, context, requestKey);
    const fingerprint = text(data.addressFingerprint, 180);
    if (!fingerprint) throw new Error("平台没有返回地址校验标识");
    return reply(request, { ok: true, data: { addressFingerprint: fingerprint, addressLabel: text(data.addressLabel, 80) } });
  }
  if (action === "search") {
    const query = text(payload.query, 120);
    if (!query) return reply(request, { ok: false, error: "请输入要搜索的餐品或店铺" }, 400);
    const data = await routedUpstream(client, caller, action, { ...payload, query }, context, requestKey);
    const source = Array.isArray(data.offers) ? data.offers : [];
    const offers = source.slice(0, 30).map(offerResult);
    return reply(request, { ok: true, data: { offers, addressLabel: text(data.addressLabel, 80) } });
  }
  if (action === "offer_options") {
    const offerId = text(payload.offerId, 160);
    const quoteId = text(payload.quoteId, 160);
    if (!offerId || !quoteId) return reply(request, { ok: false, error: "真实规格请求缺少报价标识" }, 400);
    const data = await routedUpstream(client, caller, action, { offerId, quoteId }, context, requestKey);
    return reply(request, { ok: true, data: { offerId, quoteId, optionGroups: optionGroups(data.optionGroups), optionsLoaded: true } });
  }
  if (action === "saved_routes") {
    const data = await routedUpstream(client, caller, action, {}, context, requestKey);
    const routes = (Array.isArray(data.routes) ? data.routes : []).slice(0, 80).map((value) => {
      const row = object(value);
      return {
        query: text(row.query, 160),
        merchant: text(row.merchant, 100),
        itemName: text(row.itemName, 140),
        savedAt: Number(row.savedAt || 0) || 0,
        closedUntil: Number(row.closedUntil || 0) || 0,
        closedReason: text(row.closedReason, 80),
      };
    });
    return reply(request, { ok: true, data: { routes } });
  }
  if (action === "create_order") {
    const clientRequestId = text(payload.clientRequestId, 160);
    if (!clientRequestId) return reply(request, { ok: false, error: "下单请求缺少幂等标识" }, 400);
    const existing = (await client.from("phone_delivery_orders").select("*")
      .eq("target", caller.target).eq("client_request_id", clientRequestId).maybeSingle()).data;
    if (existing) return reply(request, { ok: true, data: orderResponse(object(existing)) });
    const data = await routedUpstream(client, caller, action, payload, context, requestKey);
    const provider = text(data.provider, 40);
    const remoteOrderId = text(data.orderId || data.id, 160);
    if (!PROVIDERS.has(provider) || !remoteOrderId) throw new Error("平台没有返回有效订单");
    const row = {
      target: caller.target,
      role_id: text(payload.roleId, 120),
      provider,
      remote_order_id: remoteOrderId,
      client_request_id: clientRequestId,
      merchant: text(data.merchant, 100),
      merchant_id: text(data.merchantId, 120),
      offer_id: text(payload.offerId, 160),
      quote_id: text(payload.quoteId, 160),
      total: money(data.total),
      payment_method: text(data.paymentMethod, 40),
      status: status(data.status, "created"),
      address_label: text(data.addressLabel, 80),
      address_fingerprint: text(data.addressFingerprint, 180),
      items: Array.isArray(data.items) ? data.items.slice(0, 30) : [],
      risk: Array.isArray(data.risk) ? data.risk.slice(0, 20) : [],
      provider_payload: data,
    };
    const inserted = await client.from("phone_delivery_orders").insert(row).select("*").single();
    if (inserted.error) {
      const recovered = (await client.from("phone_delivery_orders").select("*")
        .eq("target", caller.target).eq("client_request_id", clientRequestId).maybeSingle()).data;
      if (!recovered) throw inserted.error;
      return reply(request, { ok: true, data: orderResponse(object(recovered)) });
    }
    return reply(request, { ok: true, data: orderResponse(object(inserted.data)) });
  }
  if (action === "pay_order") {
    const remoteOrderId = text(payload.orderId, 160);
    const clientRequestId = text(payload.clientRequestId, 160);
    if (!remoteOrderId || !clientRequestId) return reply(request, { ok: false, error: "付款请求不完整" }, 400);
    const order = (await client.from("phone_delivery_orders").select("*")
      .eq("target", caller.target).eq("remote_order_id", remoteOrderId).maybeSingle()).data;
    if (!order) return reply(request, { ok: false, error: "真实订单不存在或不属于当前设备" }, 404);
    const previous = (await client.from("phone_delivery_payment_attempts").select("id,status,response")
      .eq("target", caller.target).eq("client_request_id", clientRequestId).maybeSingle()).data;
    if (previous && Object.keys(object(previous.response)).length) {
      return reply(request, { ok: true, data: object(previous.response) });
    }
    const automatic = payload.automatic === true;
    const authorizedTotal = automatic ? money(payload.authorizedTotal) : null;
    if (automatic && Number(order.total) > Number(authorizedTotal) + 0.001) {
      return reply(request, { ok: false, error: "订单金额高于角色自动付款授权金额" }, 409);
    }
    const attempt = previous
      ? { data: { id: previous.id }, error: null }
      : await client.from("phone_delivery_payment_attempts").insert({
        target: caller.target,
        order_id: order.id,
        client_request_id: clientRequestId,
        automatic,
        authorized_total: authorizedTotal,
      }).select("id").single();
    if (attempt.error || !attempt.data?.id) throw attempt.error || new Error("payment-attempt-not-created");
    const data = await routedUpstream(client, caller, action, {
      ...payload,
      orderId: remoteOrderId,
      authorizedTotal,
    }, context, requestKey);
    const result = {
      status: status(data.status, "pending_payment"),
      paymentMethod: PAYMENTS.has(text(data.paymentMethod, 40)) ? text(data.paymentMethod, 40) : "",
      payUrl: allowedURL(data.payUrl, true),
      payQrDataUrl: payQrDataURL(data.payQrDataUrl),
      reason: text(data.reason, 180),
      total: money(data.total ?? order.total),
      addressLabel: text(data.addressLabel || order.address_label, 80),
      addressFingerprint: text(data.addressFingerprint || order.address_fingerprint, 180),
    };
    if (automatic && result.total > Number(authorizedTotal) + 0.001) {
      await client.from("phone_delivery_payment_attempts").update({ status: "failed", response: { reason: "amount-changed" }, updated_at: new Date().toISOString() }).eq("id", attempt.data.id);
      return reply(request, { ok: false, error: "付款前订单金额发生变化，已阻止自动付款" }, 409);
    }
    await client.from("phone_delivery_payment_attempts").update({ status: result.status, response: result, updated_at: new Date().toISOString() }).eq("id", attempt.data.id);
    await client.from("phone_delivery_orders").update({
      status: result.status,
      authorized_total: authorizedTotal,
      payment_method: result.paymentMethod,
      total: result.total,
      provider_payload: { ...object(order.provider_payload), ...data, payUrl: result.payUrl },
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    return reply(request, { ok: true, data: result });
  }

  const remoteOrderId = text(payload.orderId, 160);
  const order = (await client.from("phone_delivery_orders").select("*")
    .eq("target", caller.target).eq("remote_order_id", remoteOrderId).maybeSingle()).data;
  if (!order) return reply(request, { ok: false, error: "真实订单不存在或不属于当前设备" }, 404);
  const data = await routedUpstream(client, caller, action, { orderId: remoteOrderId, provider: order.provider }, context, requestKey);
  const next = status(data.status, String(order.status));
  const accepted = shouldAdvance(String(order.status), next) ? next : String(order.status);
  const result = {
    status: accepted,
    paymentMethod: PAYMENTS.has(text(data.paymentMethod || order.payment_method, 40)) ? text(data.paymentMethod || order.payment_method, 40) : "",
    payUrl: allowedURL(data.payUrl || object(order.provider_payload).payUrl, true),
    payQrDataUrl: payQrDataURL(data.payQrDataUrl || object(order.provider_payload).payQrDataUrl),
    total: money(data.total ?? order.total),
    addressLabel: text(data.addressLabel || order.address_label, 80),
    addressFingerprint: text(data.addressFingerprint || order.address_fingerprint, 180),
  };
  await client.from("phone_delivery_orders").update({
    status: accepted,
    payment_method: result.paymentMethod,
    total: result.total,
    address_label: result.addressLabel,
    address_fingerprint: result.addressFingerprint,
    provider_payload: { ...object(order.provider_payload), ...data, payUrl: result.payUrl },
    updated_at: new Date().toISOString(),
  }).eq("id", order.id);
  return reply(request, { ok: true, data: result });
}

async function handleWebhook(request: Request, raw: string, client: ReturnType<typeof admin>) {
  const secret = Deno.env.get("PHONE_DELIVERY_UPSTREAM_SECRET") || "";
  const timestamp = text(request.headers.get("x-delivery-webhook-timestamp"), 32);
  const signature = text(request.headers.get("x-delivery-webhook-signature"), 128).toLowerCase();
  const milliseconds = Number(timestamp);
  if (!secret || !Number.isFinite(milliseconds) || Math.abs(Date.now() - milliseconds) > 5 * 60_000) {
    return reply(request, { ok: false, error: "webhook-auth-failed" }, 401);
  }
  const expected = await hexHMAC(secret, `${timestamp}.${raw}`);
  if (!sameText(expected, signature)) return reply(request, { ok: false, error: "webhook-auth-failed" }, 401);
  const event = object(JSON.parse(raw));
  const provider = text(event.provider, 40);
  const eventId = text(event.eventId, 160);
  const remoteOrderId = text(event.orderId, 160);
  const next = status(event.status, "");
  if (!PROVIDERS.has(provider) || !eventId || !remoteOrderId || !next) {
    return reply(request, { ok: false, error: "invalid-webhook" }, 400);
  }
  const inserted = await client.from("phone_delivery_events").insert({
    provider,
    provider_event_id: eventId,
    remote_order_id: remoteOrderId,
    status: next,
    payload: event,
  }).select("id").maybeSingle();
  if (inserted.error && !/duplicate|unique/i.test(String(inserted.error.message || ""))) throw inserted.error;
  if (!inserted.data?.id) return reply(request, { ok: true, duplicate: true });
  const order = (await client.from("phone_delivery_orders").select("*")
    .eq("provider", provider).eq("remote_order_id", remoteOrderId).maybeSingle()).data;
  if (!order) return reply(request, { ok: true, unmatched: true });
  const accepted = shouldAdvance(String(order.status), next) ? next : String(order.status);
  await client.from("phone_delivery_orders").update({
    status: accepted,
    total: event.total == null ? order.total : money(event.total),
    payment_method: text(event.paymentMethod || order.payment_method, 40),
    provider_payload: { ...object(order.provider_payload), ...event },
    updated_at: new Date().toISOString(),
  }).eq("id", order.id);
  if (accepted !== order.status && order.role_id) {
    const linked = (await client.from("phone_companion_links").select("target")
      .eq("target", order.target).maybeSingle()).data;
    const profile = linked
      ? (await client.from("phone_role_push_profiles").select("role_id")
        .eq("target", order.target).eq("role_id", order.role_id).maybeSingle()).data
      : null;
    if (profile) {
      await client.from("phone_role_background_tasks").upsert({
        target: order.target,
        role_id: order.role_id,
        kind: "delivery_status",
        external_key: `delivery:${provider}:${eventId}`,
        due_at: new Date().toISOString(),
        payload: {
          provider,
          orderId: remoteOrderId,
          status: accepted,
          merchant: order.merchant,
          total: event.total ?? order.total,
          facts: `真实外卖平台刚确认订单状态为「${accepted}」。商家：${text(order.merchant, 100)}；金额：¥${money(event.total ?? order.total).toFixed(2)}。`,
        },
      }, { onConflict: "external_key", ignoreDuplicates: true });
    }
  }
  return reply(request, { ok: true, status: accepted });
}

Deno.serve(async (request) => {
  const access = cors(request);
  if (request.method === "OPTIONS") {
    return access.allowed
      ? new Response("ok", { headers: access.headers })
      : new Response("origin-not-allowed", { status: 403, headers: access.headers });
  }
  if (!access.allowed) return reply(request, { ok: false, error: "origin-not-allowed" }, 403);
  if (request.method !== "POST") return reply(request, { ok: false, error: "method-not-allowed" }, 405);
  try {
    const raw = await request.text();
    const client = admin();
    if (new URL(request.url).searchParams.get("webhook") === "1") {
      return await handleWebhook(request, raw, client);
    }
    const input = object(raw ? JSON.parse(raw) : {});
    return await handleClientAction(request, input, client);
  } catch (error) {
    if (error instanceof DeliveryDeviceJobPending) {
      return reply(request, {
        ok: true,
        pending: true,
        jobId: error.jobId,
        retryAfterMs: 1200,
      }, 202);
    }
    const message = text(error instanceof Error ? error.message : error, 180) || "真实外卖连接器错误";
    const statusCode = /auth/i.test(message) ? 403
      : /invalid|缺少|不支持|必须/.test(message) ? 400
      : /任务|修订|澄清|约束|状态/.test(message) ? 409
      : 502;
    return reply(request, { ok: false, error: message }, statusCode);
  }
});
