import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DeliveryAdapter } from '../src/adapter.mjs';
import { sign, verifySignedRequest } from '../src/security.mjs';
import { brandMatches, checkoutAmounts, knownRouteKey, preferredBrand, publicAddressLabel, riskChallengeKind, TaobaoFlashBrowser } from '../src/taobao-flash-browser.mjs';

class FakeBrowser {
  constructor() { this.submits = 0; this.statusCalls = 0; this.statusValue = 'pending_payment'; }
  async status() { this.statusCalls += 1; return { loggedIn: true, addressLabel: '家' }; }
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

test('headful browser is brought to the foreground while headless mode stays silent', async () => {
  let calls = 0;
  const page = { async bringToFront() { calls += 1; } };
  await new TaobaoFlashBrowser({ headless: false }).reveal(page);
  assert.equal(calls, 1);
  await new TaobaoFlashBrowser({ headless: true }).reveal(page);
  assert.equal(calls, 1);
});

test('known drink brands are recognized without widening to another merchant', () => {
  assert.equal(preferredBrand('瑞幸咖啡 生椰拿铁 少冰'), 'luckin');
  assert.equal(preferredBrand('喜茶 多肉葡萄'), 'heytea');
  assert.equal(preferredBrand('随便来杯咖啡'), '');
  assert.equal(brandMatches('luckin', '瑞幸咖啡（人民广场店）'), true);
  assert.equal(brandMatches('luckin', '某某奶茶店'), false);
});

test('known product routes ignore the requested sugar and ice modifiers', () => {
  assert.equal(
    knownRouteKey('瑞幸咖啡 生椰拿铁 少糖 少冰'),
    knownRouteKey('瑞幸咖啡 生椰拿铁 无糖 去冰'),
  );
  assert.notEqual(knownRouteKey('瑞幸咖啡 生椰拿铁'), knownRouteKey('瑞幸咖啡 橙C美式'));
});

test('a successful real product route survives a service restart', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-known-route-'));
  try {
    const first = new TaobaoFlashBrowser({ profile });
    await first.rememberKnownRoute({
      query: '瑞幸咖啡 生椰拿铁 少糖', merchant: '瑞幸咖啡（测试店）', merchantId: 'luckin-1',
      itemName: '生椰拿铁', shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1',
    });
    await first.rememberKnownRoute({
      query: '瑞幸咖啡 橙C美式', merchant: '瑞幸咖啡（测试店）', merchantId: 'luckin-1',
      itemName: '橙C美式', shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1',
    });
    const restarted = new TaobaoFlashBrowser({ profile });
    const saved = await restarted.knownRoute('瑞幸咖啡 生椰拿铁 无糖');
    assert.equal(saved.itemName, '生椰拿铁');
    assert.equal(saved.merchantId, 'luckin-1');
    const natural = await restarted.knownRoute('想喝生椰拿铁少冰');
    assert.equal(natural.itemName, '生椰拿铁');
    await restarted.forgetKnownRoute(natural.routeKey);
    assert.equal(await restarted.knownRoute('想喝生椰拿铁少冰'), null);
    assert.equal((await restarted.knownRoute('瑞幸咖啡 橙C美式')).itemName, '橙C美式');
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test('a remembered route skips global search but still reads the current menu price', async () => {
  const browser = new TaobaoFlashBrowser();
  browser.knownRoute = async () => ({
    merchant: '瑞幸咖啡（测试店）', merchantId: 'luckin-1', itemName: '生椰拿铁',
    shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1', savedAt: Date.now(),
  });
  browser.enterShop = async () => ({ url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1' });
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  browser.extractMenu = async () => [{ name: '生椰拿铁', description: '当次页面数据', price: 18.5, buttonIndex: 3 }];
  browser.goto = async () => { throw new Error('不应进入全平台搜索'); };
  const offers = await browser.search('瑞幸咖啡 生椰拿铁 少糖', 4);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].price, 18.5);
  assert.equal(offers[0].description, '当次页面数据');
});

test('a forced challenge on the remembered route stops instead of starting another search', async () => {
  const browser = new TaobaoFlashBrowser();
  browser.knownRoute = async () => ({
    merchant: '瑞幸咖啡（测试店）', merchantId: 'luckin-1', itemName: '生椰拿铁',
    shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1', savedAt: Date.now(),
  });
  browser.enterShop = async () => ({ url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1' });
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => { throw new Error('淘宝闪购触发图片验证，请本人完成'); };
  let globalSearches = 0;
  browser.goto = async () => { globalSearches += 1; };
  await assert.rejects(browser.search('瑞幸咖啡 生椰拿铁', 4), /图片验证/);
  assert.equal(globalSearches, 0);
});

test('a transient direct-route failure does not discard the route or start global search', async () => {
  const browser = new TaobaoFlashBrowser();
  browser.knownRoute = async () => ({
    merchant: '瑞幸咖啡（测试店）', merchantId: 'luckin-1', itemName: '生椰拿铁',
    shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1', savedAt: Date.now(),
  });
  browser.enterShop = async () => { throw new Error('网络连接暂时中断'); };
  let globalSearches = 0; let forgotten = 0;
  browser.goto = async () => { globalSearches += 1; };
  browser.forgetKnownRoute = async () => { forgotten += 1; };
  await assert.rejects(browser.search('瑞幸咖啡 生椰拿铁', 4), /网络连接暂时中断/);
  assert.equal(globalSearches, 0);
  assert.equal(forgotten, 0);
});

test('expired product routes are not reused', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-expired-route-'));
  try {
    await fs.writeFile(path.join(profile, 'known-product-routes.json'), JSON.stringify({
      [knownRouteKey('瑞幸咖啡 生椰拿铁')]: {
        query: '瑞幸咖啡 生椰拿铁', merchant: '瑞幸咖啡', merchantId: 'luckin-1', itemName: '生椰拿铁',
        shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1', savedAt: Date.now() - 31 * 24 * 60 * 60_000,
      },
    }), 'utf8');
    assert.equal(await new TaobaoFlashBrowser({ profile }).knownRoute('瑞幸咖啡 生椰拿铁'), null);
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test('image captcha stops immediately and persists a retry cooldown', async () => {
  assert.equal(riskChallengeKind('请选择符合描述的所有图片，没有新图片可以点后，请点击“提交”'), '图片验证');
  assert.equal(riskChallengeKind('瑞幸咖啡 生椰拿铁 月售 1200'), '');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-risk-cooldown-'));
  try {
    const frame = { locator: () => ({ innerText: async () => '请选择符合描述的所有图片' }) };
    const page = { frames: () => [frame] };
    const browser = new TaobaoFlashBrowser({ profile, headless: false });
    await assert.rejects(browser.riskCheck(page, { waitForHuman: true, maxWaitMs: 10_000 }), /立即停止.*冷却30分钟/);
    await assert.rejects(new TaobaoFlashBrowser({ profile }).assertRiskCooldown(), /期间不会再次打开或重搜/);
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test('adaptive page wait continues as soon as real search content appears', async () => {
  const waits = [];
  const page = {
    async waitForTimeout(ms) { waits.push(ms); },
    async evaluate() { return '瑞幸咖啡 月售 2000 配送约 30 分钟 起送 ¥20'; },
    url() { return 'https://h5.ele.me/search/?keyword=luckin'; },
  };
  const ready = await new TaobaoFlashBrowser().waitForContent(page, 2500);
  assert.equal(ready, true);
  assert.deepEqual(waits, [220]);
});

test('concurrent cold requests share one browser launch', async () => {
  const browser = new TaobaoFlashBrowser();
  let starts = 0;
  browser.startOnce = async () => {
    starts += 1;
    await Promise.resolve();
    browser.context = { close: async () => {} };
  };
  await Promise.all([browser.start(), browser.start(), browser.start()]);
  assert.equal(starts, 1);
});

test('concurrent first requests share one browser prewarm', async () => {
  const browser = new TaobaoFlashBrowser();
  let warms = 0;
  const page = { url: () => 'about:blank' };
  browser.context = { close: async () => {} };
  browser.page = page;
  browser.ensure = async () => page;
  browser.goto = async () => { warms += 1; await Promise.resolve(); return {}; };
  await Promise.all([browser.prewarm(), browser.prewarm(), browser.prewarm()]);
  assert.equal(warms, 1);
  await browser.prewarm();
  assert.equal(warms, 1);
});

test('capabilities reuses one warm status result for repeated settings checks', async () => {
  const browser = new FakeBrowser();
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const first = await adapter.capabilities();
  const second = await adapter.capabilities();
  assert.equal(first.addressLabel, '家');
  assert.equal(second.addressLabel, '家');
  assert.equal(browser.statusCalls, 1);
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
