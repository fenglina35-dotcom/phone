import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runtimeCode = path.resolve(here, '..', 'runtime', 'code');

test('signed runtime imports after being copied outside every project node_modules folder', async (t) => {
  const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'small-phone-runtime-'));
  t.after(() => fs.rm(isolated, { recursive: true, force: true }));
  for (const name of ['adapter.mjs', 'security.mjs', 'taobao-flash-browser.mjs', 'runtime-version.json']) {
    await fs.copyFile(path.join(runtimeCode, name), path.join(isolated, name));
  }
  const source = await fs.readFile(path.join(isolated, 'adapter.mjs'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]qrcode['"]|import\(['"]qrcode['"]\)/);
  const loaded = await import(`${pathToFileURL(path.join(isolated, 'adapter.mjs')).href}?test=${Date.now()}`);
  assert.equal(typeof loaded.DeliveryAdapter, 'function');
  const adapter = new loaded.DeliveryAdapter({
    secret: '12345678901234567890123456789012',
    browser: {
      submitOrder: async () => ({
        payUrl: 'https://cashier.example.test/pay',
        status: 'pending_payment',
        total: 20,
        couponCheck: { status: 'none', amount: 0, evidence: 'checkout_explicit_none' },
      }),
    },
  });
  adapter.orders.set('yb_test:order-1', {
    orderId: 'order-1', provider: 'taobao-flash', merchantId: 'shop-1', merchant: '测试店',
    items: [{ name: '测试餐品', quantity: 1 }], total: 20, status: 'created', paymentMethod: 'alipay',
    addressLabel: '已确认地址', addressFingerprint: 'approved', browserOrderRef: {},
  });
  const payment = await adapter.payOrder({ orderId: 'order-1', clientRequestId: 'pay-1' }, { target: 'yb_test' });
  assert.match(payment.payQrDataUrl, /^data:image\/png;base64,/);
});
