import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryAdapter } from '../src/adapter.mjs';
import { sign, verifySignedRequest } from '../src/security.mjs';
import { checkoutAmounts, publicAddressLabel } from '../src/taobao-flash-browser.mjs';

class FakeBrowser {
  constructor() { this.submits = 0; this.statusValue = 'pending_payment'; }
  async status() { return { loggedIn: true, addressLabel: '家' }; }
  async currentAddress() { return { label: '家', fingerprintSource: 'secret-full-address' }; }
  async search() { return [{ merchantId: 'kfc-1', merchant: '肯德基', name: '原味鸡套餐', price: 39, deliveryFee: 3, total: 42, browserRef: { item: 1 }, optionGroups: [], optionsLoaded: false }]; }
  async inspectOptionsFor() { return [{ id: 'drink', name: '饮料', required: true, multiple: false, choices: [{ id: 'cola', label: '可乐', available: true }, { id: 'coffee', label: '咖啡', available: true }] }]; }
  async createOrder({ selectedOptions }) { return { total: 42, items: [{ name: '原味鸡套餐', quantity: 1, price: 42, options: selectedOptions.drink }], browserOrderRef: { id: 1 } }; }
  async submitOrder() { this.submits += 1; return { status: 'pending_payment', payUrl: 'https://cashier.example.test/pay?id=1', browserOrderRef: { id: 1 } }; }
  async orderStatus() { return { status: this.statusValue }; }
}

test('signed request rejects stale or changed payload', () => {
  const secret = '12345678901234567890123456789012';
  const timestamp = String(Date.now()); const rawBody = '{"action":"search"}'; const signature = sign(secret, timestamp, rawBody);
  assert.equal(verifySignedRequest({ secret, timestamp, signature, rawBody }), true);
  assert.equal(verifySignedRequest({ secret, timestamp, signature, rawBody: rawBody + ' ' }), false);
  assert.equal(verifySignedRequest({ secret, timestamp: String(Date.now() - 600_000), signature, rawBody }), false);
});

test('public address labels never expose the full platform address row', () => {
  const raw='北京 请输入收货地址 无定位信息 示例小区1幢 13楼，1326 常用 家 联系人 138****0000 新增收货地址';
  assert.equal(publicAddressLabel(raw),'家');
  assert.equal(publicAddressLabel('上海 某科技园 常用 公司 联系人'),'公司');
});

test('checkout total does not mistake the discount for the payable amount', () => {
  const amounts = checkoutAmounts('配送费 惊喜减3元 ¥5.6 ¥2.6 合计 已优惠 ¥3 ¥26.6 购红包 本单立减5元 合计¥26.6 已优惠 ¥3 立即支付');
  assert.deepEqual(amounts, { total: 26.6, discount: 3 });
});

test('adapter exposes manual payment and preserves real options', async () => {
  const browser = new FakeBrowser();
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012', maxOrderAmount: 100 });
  const context = { target: 'yb_test' };
  const capabilities = await adapter.handle('capabilities', {}, context);
  assert.equal(capabilities.automaticPayments, false);
  assert.deepEqual(capabilities.payments, ['alipay']);
  const search = await adapter.handle('search', { query: 'KFC' }, context);
  assert.equal(search.offers[0].optionsLoaded, false);
  assert.deepEqual(search.offers[0].optionGroups, []);
  const options = await adapter.handle('offer_options', { offerId: search.offers[0].offerId, quoteId: search.offers[0].quoteId }, context);
  assert.equal(options.optionGroups[0].choices[1].label, '咖啡');
  await assert.rejects(adapter.handle('create_order', { offerId: search.offers[0].offerId, quoteId: search.offers[0].quoteId, clientRequestId: 'a' }, context), /请选择饮料/);
  const created = await adapter.handle('create_order', { offerId: search.offers[0].offerId, quoteId: search.offers[0].quoteId, selectedOptions: { drink: 'coffee' }, clientRequestId: 'a' }, context);
  const automatic = await adapter.handle('pay_order', { orderId: created.orderId, automatic: true }, context);
  assert.equal(automatic.status, 'pending_payment'); assert.equal(browser.submits, 0);
  const manual = await adapter.handle('pay_order', { orderId: created.orderId, automatic: false, clientRequestId: 'pay-a' }, context);
  assert.equal(manual.paymentMethod, 'alipay'); assert.match(manual.payQrDataUrl, /^data:image\/png;base64,/); assert.equal(browser.submits, 1);
  await adapter.handle('pay_order', { orderId: created.orderId, automatic: false, clientRequestId: 'pay-a' }, context);
  assert.equal(browser.submits, 1, 'retries with the same payment request id must not submit twice');
});

test('amount guard stops an order above the configured limit', async () => {
  const browser = new FakeBrowser(); browser.createOrder = async () => ({ total: 101, browserOrderRef: {} });
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012', maxOrderAmount: 100 });
  const context = { target: 'yb_test' };
  const search = await adapter.handle('search', { query: 'KFC' }, context);
  await assert.rejects(adapter.handle('create_order', { offerId: search.offers[0].offerId, quoteId: search.offers[0].quoteId, selectedOptions: { drink: 'cola' }, clientRequestId: 'b' }, context), /超过服务端上限/);
});
