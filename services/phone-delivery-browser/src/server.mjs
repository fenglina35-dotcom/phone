import http from 'node:http';
import { DeliveryAdapter } from './adapter.mjs';
import { TaobaoFlashBrowser } from './taobao-flash-browser.mjs';
import { verifySignedRequest } from './security.mjs';

const secret = process.env.PHONE_DELIVERY_UPSTREAM_SECRET || '';
if (secret.length < 24) throw new Error('PHONE_DELIVERY_UPSTREAM_SECRET must contain at least 24 characters');

const host = process.env.PHONE_DELIVERY_BROWSER_HOST || '127.0.0.1';
const port = Number(process.env.PHONE_DELIVERY_BROWSER_PORT || 8787);
const browser = new TaobaoFlashBrowser({
  profile: process.env.PHONE_DELIVERY_PROFILE || './profile',
  headless: /^(1|true|yes)$/i.test(process.env.PHONE_DELIVERY_HEADLESS || 'false'),
  timeout: Number(process.env.PHONE_DELIVERY_BROWSER_TIMEOUT || 30_000),
});
const adapter = new DeliveryAdapter({
  browser, secret,
  maxOrderAmount: Number(process.env.PHONE_DELIVERY_MAX_ORDER_AMOUNT || 100),
  maxOffers: Number(process.env.PHONE_DELIVERY_MAX_OFFERS || 4),
});

const reply = (response, status, body) => {
  const raw = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(raw), 'cache-control': 'no-store' });
  response.end(raw);
};

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') return reply(response, 200, { ok: true });
  if (request.method !== 'POST' || request.url !== '/delivery') return reply(response, 404, { ok: false, error: 'not-found' });
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) return reply(response, 413, { ok: false, error: 'request-too-large' });
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const authorized = verifySignedRequest({
    secret,
    timestamp: request.headers['x-phone-delivery-timestamp'],
    signature: request.headers['x-phone-delivery-signature'],
    rawBody,
  });
  if (!authorized || request.headers['x-phone-delivery-contract'] !== '1') return reply(response, 401, { ok: false, error: 'upstream-auth-failed' });
  const startedAt = Date.now();
  let action = 'unknown';
  try {
    const input = JSON.parse(rawBody || '{}');
    action = String(input.action || 'unknown').slice(0, 40);
    await browser.prewarm();
    const data = await adapter.handle(action, input.payload || {}, input.context || {});
    console.log(`[phone-delivery-browser] action=${action} ok ms=${Date.now() - startedAt}`);
    return reply(response, 200, { ok: true, data });
  } catch (error) {
    const message = String(error?.message || error || '真实外卖浏览器服务错误').slice(0, 240);
    console.warn(`[phone-delivery-browser] action=${action} failed ms=${Date.now() - startedAt}: ${message}`);
    return reply(response, /登录|验证|地址|规格|报价|金额|不存在|不支持|请输入/.test(message) ? 409 : 502, { ok: false, error: message });
  }
});

server.listen(port, host, () => {
  console.log(`[phone-delivery-browser] listening on http://${host}:${port}/delivery`);
  browser.prewarm().then(() => console.log('[phone-delivery-browser] browser prewarmed')).catch(error => {
    console.warn(`[phone-delivery-browser] prewarm deferred: ${String(error?.message || error).slice(0, 160)}`);
  });
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await browser.context?.close().catch(() => {});
    server.close(() => process.exit(0));
  });
}
