import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DeliveryAdapter } from '../src/adapter.mjs';
import { sign, verifySignedRequest } from '../src/security.mjs';
import { activeShopMatchesBrand, appliedCouponAmount, availableCouponAmount, brandMatches, checkoutAmounts, checkoutCartState, checkoutEtaText, checkoutPageReady, knownRouteKey, mealSideTopUpEligible, milkTeaTopUpEligible, minimumOrderInfo, multiServingEligible, normalizeOptionPanelGroups, preferredBrand, preferredExactProduct, productMatchesSavedItem, publicAddressLabel, repeatPurchaseMatches, repeatPurchaseMatchKind, requestedExtraItems, requestedItemName, requestedKfcItems, requestedMealSide, requestedStandaloneItems, riskChallengeKind, sameShopUrl, savedTopUpItems, shopClosedReason, TaobaoFlashBrowser } from '../src/taobao-flash-browser.mjs';

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

test('the largest advertised checkout red packet is recognized', () => {
  assert.equal(availableCouponAmount('闪购红包 未选红包，最高10元可用 下单返豆'), 10);
  assert.equal(availableCouponAmount('闪购红包 无可用红包'), 0);
});

test('an already applied checkout red packet is not reopened', () => {
  assert.equal(appliedCouponAmount('闪购红包 -¥ 6.5 下单返豆 合计¥16.4'), 6.5);
  assert.equal(appliedCouponAmount('闪购红包 未选红包，最高6.5元可用'), 0);
});

test('repeat purchase requires the requested product and every explicit hard option', () => {
  const exact = '热销 4天前买过 共1件 ¥18 茉莉葡萄冰奶 大杯 少冰 不额外加糖(口感淡) 再来一单';
  const oldSugar = '热销 4天前买过 共1件 ¥18 茉莉葡萄冰奶 大杯 少冰 3分糖(口感偏淡) 再来一单';
  assert.equal(repeatPurchaseMatches(exact, '茉莉葡萄冰奶', '茶百道 茉莉葡萄冰奶 无糖 少冰 大杯'), true);
  assert.equal(repeatPurchaseMatches(exact, '茉莉葡萄冰奶', '茶百道 茉莉葡萄冰奶 不加糖 少冰 大杯'), true);
  assert.equal(repeatPurchaseMatches(oldSugar, '茉莉葡萄冰奶', '茶百道 茉莉葡萄冰奶 无糖 少冰 大杯'), false);
  assert.equal(repeatPurchaseMatches(exact, '杨枝甘露', '茶百道 杨枝甘露 无糖'), false);
});

test('saved bought-order add-ons are reused as top-ups in their historical order', () => {
  const history = '4天前买过 共4件 茉莉葡萄冰奶 冻冻 椰果 奶冻 再来一单';
  assert.deepEqual(savedTopUpItems(history, '茉莉葡萄冰奶'), ['冻冻', '椰果', '奶冻']);
  assert.deepEqual(savedTopUpItems('当前菜单 冻冻 椰果 奶冻', '茉莉葡萄冰奶'), []);
});

test('milk-tea toppings are never used to pad coffee, meals, or fast food', async () => {
  assert.equal(milkTeaTopUpEligible('茶百道 茉莉葡萄冰奶'), true);
  assert.equal(milkTeaTopUpEligible('瑞幸咖啡 生椰拿铁'), false);
  assert.equal(milkTeaTopUpEligible('肯德基 原味鸡套餐'), false);
  assert.equal(milkTeaTopUpEligible('牛肉炒饭'), false);

  const browser = new TaobaoFlashBrowser();
  browser.returnToStorefrontWithoutRefresh = async () => { throw new Error('non-tea order must not inspect saved toppings'); };
  const result = await browser.topUpWithSavedItems({}, { itemName: '生椰拿铁', merchant: '瑞幸咖啡' });
  assert.deepEqual(result, { checkout: null, added: [], expected: [], exhausted: true, eligible: false });
});

test('automatic double servings are limited to milk tea and Luckin coffee', async () => {
  assert.equal(multiServingEligible('茶百道 茉莉葡萄冰奶'), true);
  assert.equal(multiServingEligible('瑞幸咖啡 生椰拿铁'), true);
  assert.equal(multiServingEligible('星巴克 生椰拿铁'), false);
  assert.equal(multiServingEligible('KFC 原味鸡套餐'), false);
  assert.equal(multiServingEligible('牛肉炒饭'), false);

  const browser = new TaobaoFlashBrowser();
  await assert.rejects(browser.createOrder({
    ref: { merchant: '肯德基', itemName: '原味鸡套餐', query: 'KFC 原味鸡套餐' },
    selectedOptions: {}, optionGroups: [], quantity: 2,
  }), /只允许用于奶茶或瑞幸咖啡/);
});

test('saved add-ons stop as soon as the real checkout becomes available', async () => {
  const browser = new TaobaoFlashBrowser();
  const added = [];
  const checkout = { id: 'checkout' };
  const page = {
    url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1',
    getByText() { return { id: 'checkout-locator' }; },
    async waitForTimeout() {},
  };
  browser.returnToStorefrontWithoutRefresh = async () => page;
  browser.boughtOrderSummary = async () => '4天前买过 茉莉葡萄冰奶 冻冻 椰果 奶冻 再来一单';
  browser.productControl = async (_page, name) => ({ name });
  browser.activateControl = async (_page, control) => { added.push(control.name); };
  browser.optionPanel = async () => null;
  browser.visibleLocator = async locator => locator?.id === 'checkout-locator' ? checkout : null;

  const result = await browser.topUpWithSavedItems(page, { itemName: '茉莉葡萄冰奶' });

  assert.deepEqual(added, ['冻冻']);
  assert.equal(result.checkout, checkout);
  assert.deepEqual(result.expected, ['冻冻', '椰果', '奶冻']);
  assert.equal(result.exhausted, false);
});

test('a saved add-on with an explicit platform default can be confirmed without asking again', async () => {
  const browser = new TaobaoFlashBrowser();
  const clicked = [];
  const checkout = { id: 'checkout' };
  const confirm = { id: 'confirm' };
  const dialog = {
    innerText: async () => '冻冻 已选：分装（+￥0.5） 规格 分装 不分装 数量 1 加入购物车',
    getByText: () => ({ id: 'confirm-locator' }),
    locator: () => ({ id: 'close-locator' }),
  };
  const page = {
    url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1',
    getByText: () => ({ id: 'checkout-locator' }),
    async waitForTimeout() {},
  };
  browser.returnToStorefrontWithoutRefresh = async () => page;
  browser.boughtOrderSummary = async () => '4天前买过 茉莉葡萄冰奶 冻冻 再来一单';
  browser.productControl = async () => ({ id: 'top-up' });
  browser.activateControl = async () => {};
  browser.optionPanel = async () => dialog;
  browser.visibleLocator = async locator => locator?.id === 'confirm-locator' ? confirm : locator?.id === 'checkout-locator' ? checkout : null;
  browser.tapControl = async (_page, control) => { clicked.push(control.id); };

  const result = await browser.topUpWithSavedItems(page, { itemName: '茉莉葡萄冰奶' });

  assert.deepEqual(clicked, ['confirm']);
  assert.deepEqual(result.added, ['冻冻']);
  assert.equal(result.checkout, checkout);
});

test('checkout accepts a React confirmation screen even when the H5 URL does not change', () => {
  assert.equal(checkoutPageReady('https://h5.ele.me/newretail/p/ushop', '确认订单 订单备注 选择餐具份数 提交订单'), true);
  assert.equal(checkoutPageReady('https://h5.ele.me/newretail/p/ushop', '购物车 去结算'), false);
  assert.equal(checkoutPageReady('https://h5.ele.me/checkout/confirm', ''), true);
});

test('checkout preserves the exact platform delivery window', () => {
  assert.equal(checkoutEtaText('预计 08:17-08:32 送至 平台默认地址'), '08:17-08:32送达');
  assert.equal(checkoutEtaText('预计 8:07 至 9:02 送达'), '08:07-09:02送达');
  assert.equal(checkoutEtaText('预计15：06至15：21送达'), '15:06-15:21送达');
  assert.equal(checkoutEtaText('预计送达时间 15:06—15:21'), '15:06-15:21送达');
  assert.equal(checkoutEtaText('预计很快送达'), '');
});

test('the active storefront is reused instead of refreshing the same shop', () => {
  const active = 'https://h5.ele.me/2021001185671035/pages/ele-takeout-index/ele-takeout-index?shopId=shop-7&trace_id=new';
  const quote = 'https://h5.ele.me/2021001185671035/pages/ele-takeout-index/ele-takeout-index?shopId=shop-7&trace_id=old';
  const other = 'https://h5.ele.me/2021001185671035/pages/ele-takeout-index/ele-takeout-index?shopId=shop-8';
  assert.equal(sameShopUrl(active, quote), true);
  assert.equal(sameShopUrl(active, other), false);
  const internalSearch = 'https://h5.ele.me/2021001185671035/pages/ele-index-search/ele-index-search';
  assert.equal(sameShopUrl(internalSearch, internalSearch), true);
});

test('minimum order text provides a resumable same-item quantity', () => {
  assert.deepEqual(minimumOrderInfo('购物车 ¥12.00 还差 ¥28 元起送 ¥40起送', 12, 1), {
    threshold: 40, shortfall: 28, current: 12, minimumQuantity: 4,
  });
});

test('bundle option parser removes platform hints and preserves the required item count', () => {
  const groups = normalizeOptionPanelGroups([{ name: '饮料', choices: ['已选：', '价格计算中', '请选择2份', '选规格', '茉莉奶绿（大杯）', '黑糖珍珠奶茶Pro（大杯）'] }]);
  assert.deepEqual(groups, [{
    name: '饮料（请选择2份）',
    choices: ['茉莉奶绿（大杯）', '黑糖珍珠奶茶Pro（大杯）'],
    multiple: true,
    selectionCount: 2,
  }]);
});

test('adapter requires the exact number of selections for a real bundle', () => {
  const adapter = new DeliveryAdapter({ browser: new FakeBrowser(), secret: '12345678901234567890123456789012' });
  const groups = [{ id: 'g0', name: '饮料（请选择2份）', required: true, multiple: true, choices: [{ id: 'a', available: true }, { id: 'b', available: true }] }];
  assert.throws(() => adapter.validateOptions(groups, { g0: ['a'] }), /准确选择2份/);
  assert.doesNotThrow(() => adapter.validateOptions(groups, { g0: ['a', 'b'] }));
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

test('meal brands, products, and explicit side dishes remain separate', () => {
  assert.equal(preferredBrand('曼玲粥 牛奶燕麦粥 加一个茶叶蛋'), 'manling');
  assert.equal(brandMatches('manling', '曼玲粥（测试店）'), true);
  assert.equal(requestedItemName('曼玲粥 牛奶燕麦粥 加一个茶叶蛋'), '燕麦牛奶粥');
  assert.equal(requestedMealSide('曼玲粥 牛奶燕麦粥 加一个茶叶蛋'), '茶叶蛋');
  assert.deepEqual(requestedExtraItems('茶百道 茉莉葡萄冰奶 加珍珠 少冰'), ['珍珠']);
  assert.deepEqual(requestedExtraItems('瑞幸 生椰拿铁 不加糖'), []);
  assert.equal(mealSideTopUpEligible('曼玲粥 燕麦牛奶粥'), true);
  assert.equal(mealSideTopUpEligible('瑞幸咖啡 生椰拿铁'), false);
  assert.equal(mealSideTopUpEligible('KFC 原味鸡套餐'), false);
});

test('a meal repeat-order superset is kept for confirmation but never treated as exact', () => {
  const request = '曼玲粥 牛奶燕麦粥 加一个茶叶蛋';
  assert.equal(repeatPurchaseMatchKind(
    '7天前买过 共3件 ¥31.73 再来一单 x1 五香茶叶蛋1个 x1 燕麦牛奶粥 糖度/无糖 x1 圆葱牛肉饼',
    '燕麦牛奶粥', request,
  ), 'superset');
  assert.equal(repeatPurchaseMatchKind(
    '7天前买过 共2件 ¥18.90 再来一单 x1 五香茶叶蛋1个 x1 燕麦牛奶粥',
    '燕麦牛奶粥', request,
  ), 'exact');
  assert.equal(repeatPurchaseMatchKind(
    '7天前买过 共2件 ¥18.90 再来一单 x1 燕麦牛奶粥 x1 圆葱牛肉饼',
    '燕麦牛奶粥', request,
  ), 'none');
});

test('historical exact and superset rules remain for drinks and coffee, while KFC is always assembled as single items', () => {
  assert.equal(repeatPurchaseMatchKind(
    '4天前买过 共2件 茉莉葡萄冰奶 不额外加糖 椰果 再来一单',
    '茉莉葡萄冰奶', '茶百道 茉莉葡萄冰奶 无糖',
  ), 'superset');
  assert.equal(repeatPurchaseMatchKind(
    '3天前买过 共1件 生椰拿铁 不额外加糖 再来一单',
    '生椰拿铁', '瑞幸咖啡 生椰拿铁 无糖',
  ), 'exact');
  assert.equal(repeatPurchaseMatchKind(
    '2天前买过 共2件 香辣鸡腿堡 薯条 再来一单',
    '香辣鸡腿堡', 'KFC 香辣鸡腿堡 加薯条',
  ), 'none');
  assert.equal(repeatPurchaseMatchKind(
    '2天前买过 共2件 香辣鸡腿堡 可乐 再来一单',
    '香辣鸡腿堡', 'KFC 香辣鸡腿堡 加薯条',
  ), 'none');
});

test('KFC parses every requested single item and refuses to stop at the minimum order amount', async () => {
  const query = '肯德基 汉堡 加薯条 加蛋挞 加可乐';
  assert.equal(preferredBrand(query), 'kfc');
  assert.equal(brandMatches('kfc', '肯德基（测试店）'), true);
  assert.deepEqual(requestedKfcItems(query), ['汉堡', '薯条', '蛋挞', '可乐']);
  assert.equal(requestedItemName(query), '汉堡');
  assert.deepEqual(requestedExtraItems(query), ['薯条', '蛋挞', '可乐']);
  assert.deepEqual(requestedStandaloneItems(query), ['薯条', '蛋挞', '可乐']);
  assert.equal(preferredExactProduct([
    { name: '香辣鸡腿堡套餐' },
    { name: '香辣鸡腿堡' },
  ], '汉堡')?.name, '香辣鸡腿堡');

  const browser = new TaobaoFlashBrowser();
  const clicks = [];
  const page = {
    url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=kfc-1',
    getByText: () => ({ id: 'checkout-locator' }),
    async waitForTimeout() {},
  };
  browser.extractMenu = async (_page, _limit, name) => [{ name }];
  browser.productControl = async (_page, name) => ({ id: name });
  browser.activateControl = async (_page, control) => { clicks.push(control.id); };
  browser.optionPanel = async () => null;
  browser.visibleLocator = async locator => locator?.id === 'checkout-locator' ? { id: 'checkout' } : null;
  const result = await browser.addRequestedStandaloneItems(page, { query });
  assert.deepEqual(clicks, ['薯条', '蛋挞', '可乐']);
  assert.deepEqual(result.added, ['薯条', '蛋挞', '可乐']);
  assert.equal(result.checkout.id, 'checkout');
});

test('checkout rejects any missing requested item even when the order amount is already sufficient', () => {
  const query = '肯德基 汉堡 加薯条 加蛋挞 加可乐';
  const missing = checkoutCartState('确认订单 香辣鸡腿堡 × 1 ¥21 薯条 × 1 ¥12 蛋挞 × 1 ¥8 合计¥41', '香辣鸡腿堡', query);
  assert.equal(missing.matches, false);
  assert.deepEqual(missing.missing, ['可乐']);
  const complete = checkoutCartState('确认订单 香辣鸡腿堡 × 1 ¥21 薯条 × 1 ¥12 蛋挞 × 1 ¥8 可乐 × 1 ¥9 合计¥50', '香辣鸡腿堡', query);
  assert.equal(complete.matches, true);
});

test('an explicitly requested meal side is added once and only inside the meal shop', async () => {
  const browser = new TaobaoFlashBrowser();
  const checkout = { id: 'checkout' }; const clicks = []; const searches = [];
  const page = {
    url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=meal-1',
    getByText: () => ({ id: 'checkout-locator' }),
    async waitForTimeout() {},
  };
  browser.returnToStorefrontWithoutRefresh = async () => page;
  browser.productControl = async (_page, name) => name === '茶叶蛋' ? { id: name } : null;
  browser.searchInsideShop = async (_page, name) => { searches.push(name); return true; };
  browser.activateControl = async (_page, control) => { clicks.push(control.id); };
  browser.optionPanel = async () => null;
  browser.visibleLocator = async locator => locator?.id === 'checkout-locator' ? checkout : null;

  const result = await browser.topUpWithMealSide(page, { merchant: '曼玲粥', itemName: '燕麦牛奶粥', query: '曼玲粥 牛奶燕麦粥 加一个茶叶蛋' }, '茶叶蛋');

  assert.deepEqual(result.added, ['茶叶蛋']);
  assert.equal(result.checkout, checkout);
  assert.deepEqual(clicks, ['茶叶蛋']);
  assert.deepEqual(searches, []);
});

test('an internal search page from another brand cannot masquerade as the requested shop', () => {
  const teaUrl = 'https://h5.ele.me/pages/ele-index-search?keyword=' + encodeURIComponent('茶百道 茉莉葡萄冰奶');
  assert.equal(activeShopMatchesBrand('瑞幸咖啡 生椰拿铁', teaUrl, '搜索 生椰拿铁'), false);
  assert.equal(activeShopMatchesBrand('茶百道 茉莉葡萄冰奶', teaUrl, '搜索 茉莉葡萄冰奶'), true);
});

test('known product routes ignore the requested sugar and ice modifiers', () => {
  assert.equal(
    knownRouteKey('瑞幸咖啡 生椰拿铁 少糖 少冰'),
    knownRouteKey('瑞幸咖啡 生椰拿铁 无糖 去冰'),
  );
  assert.notEqual(knownRouteKey('瑞幸咖啡 生椰拿铁'), knownRouteKey('瑞幸咖啡 橙C美式'));
});

test('closed shop text is recognized before attempting to add a product', () => {
  assert.equal(shopClosedReason('瑞幸咖啡（测试店） 休息中 明天6:30开始营业'), '休息中 明天6:30开始营业');
  assert.equal(shopClosedReason('生椰拿铁 月售 2000'), '');
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

test('the same product can keep separate direct routes for several shops', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-multi-route-'));
  try {
    const browser = new TaobaoFlashBrowser({ profile });
    await browser.rememberKnownRoute({
      query: '瑞幸咖啡 生椰拿铁 少糖', merchant: '瑞幸咖啡（一店）', merchantId: 'luckin-1',
      itemName: '生椰拿铁', shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1',
    });
    await browser.rememberKnownRoute({
      query: '瑞幸咖啡 生椰拿铁 少糖', merchant: '瑞幸咖啡（二店）', merchantId: 'luckin-2',
      itemName: '生椰拿铁', shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-2',
    });
    const routes = await new TaobaoFlashBrowser({ profile }).knownRoutesFor('瑞幸咖啡 生椰拿铁 少冰', 6, true);
    assert.equal(routes.length, 2);
    assert.deepEqual(new Set(routes.map(route => route.merchantId)), new Set(['luckin-1', 'luckin-2']));
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test('an exact saved drink is never replaced by a shorter generic menu item', () => {
  assert.equal(productMatchesSavedItem('生椰拿铁', '生椰拿铁'), true);
  assert.equal(productMatchesSavedItem('生椰拿铁（大杯）', '生椰拿铁'), true);
  assert.equal(productMatchesSavedItem('拿铁', '生椰拿铁'), false);
  assert.equal(productMatchesSavedItem('冰吸生椰拿铁', '生椰拿铁'), true);
  assert.equal(productMatchesSavedItem('生椰拿铁+埃塞金烘美式', '生椰拿铁'), false);
  assert.equal(productMatchesSavedItem('【瑞门爆款】生椰拿铁双杯套餐', '生椰拿铁'), false);
  assert.equal(productMatchesSavedItem('生椰拿铁双杯套餐', '生椰拿铁双杯套餐'), true);
  assert.equal(preferredExactProduct([
    { name: '冰吸生椰拿铁' },
    { name: '生椰拿铁（首创）' },
    { name: '生椰拿铁+埃塞金烘美式' },
  ], '生椰拿铁')?.name, '生椰拿铁（首创）');
});

test('a closed first route is skipped and the exact product is read from the next shop', async () => {
  const browser = new TaobaoFlashBrowser();
  const first = { routeKey: 'route-1', merchant: '瑞幸咖啡（一店）', merchantId: 'luckin-1', itemName: '生椰拿铁', shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1' };
  const second = { routeKey: 'route-2', merchant: '瑞幸咖啡（二店）', merchantId: 'luckin-2', itemName: '生椰拿铁', shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-2' };
  browser.knownRoute = async () => first;
  browser.knownRoutesFor = async () => [first, second];
  browser.enterShop = async () => {
    if (browser.shops[0].name.includes('一店')) throw new Error('门店休息中');
    return { url: () => second.shopUrl };
  };
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  browser.extractMenu = async () => [
    { name: '拿铁', description: '菜单第一项', price: 12, buttonIndex: 1 },
    { name: '生椰拿铁', description: '少糖可选', price: 18, buttonIndex: 7 },
  ];
  browser.markKnownRouteClosed = async () => {};
  browser.goto = async () => { throw new Error('不应进入全平台搜索'); };
  const offers = await browser.search('瑞幸咖啡 生椰拿铁 少糖', 3, { allowGlobalSearch: false });
  assert.equal(offers[0].merchant, '瑞幸咖啡（二店）');
  assert.equal(offers[0].name, '生椰拿铁');
  assert.equal(offers[0].browserRef.buttonIndex, 7);
});

test('shop-internal search removes the brand and option words but keeps the exact product', () => {
  assert.equal(requestedItemName('瑞幸咖啡 生椰拿铁 少少甜 少冰'), '生椰拿铁');
  assert.equal(requestedItemName('KFC 香辣鸡腿堡 不要辣'), '香辣鸡腿堡');
});

test('plain-language no-sugar wording is not treated as part of a coffee product name', () => {
  assert.equal(requestedItemName('瑞幸咖啡 生椰拿铁 不加糖'), '生椰拿铁');
  assert.equal(knownRouteKey('瑞幸咖啡 生椰拿铁 不加糖'), knownRouteKey('瑞幸咖啡 生椰拿铁 无糖'));
});

test('global search always performs one exact search inside each candidate shop', async () => {
  const browser = new TaobaoFlashBrowser();
  const searchPage = { url: () => 'https://h5.ele.me/search/?keyword=luckin', waitForTimeout: async () => {} };
  const shopPage = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1' };
  browser.knownRoute = async () => null;
  browser.knownRoutesFor = async () => [];
  browser.goto = async () => searchPage;
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  browser.extractShops = async () => [{ index: 0, name: '瑞幸咖啡（测试店）', storeId: 'luckin-1', deliveryFee: 0, freeDeliveryThreshold: 0, etaMinutes: 20, rating: 5, monthlySales: 1000, couponLabel: '' }];
  browser.enterShop = async () => shopPage;
  let menuReads = 0;
  browser.extractMenu = async () => menuReads++ === 0
    ? [{ name: '冰吸生椰拿铁推荐装', description: '店铺首页推荐', price: 15, buttonIndex: 1 }]
    : [
      { name: '生椰拿铁+埃塞金烘美式', description: '店内套餐', price: 28, buttonIndex: 7 },
      { name: '【瑞门爆款】生椰拿铁双杯套餐', description: '双杯套餐', price: 37, buttonIndex: 8 },
      { name: '生椰拿铁', description: '店内精确搜索结果', price: 18, buttonIndex: 9 },
    ];
  const internalQueries = [];
  browser.searchInsideShop = async (_page, itemName) => { internalQueries.push(itemName); return true; };

  const offers = await browser.search('瑞幸咖啡 生椰拿铁 少糖', 3);

  assert.deepEqual(internalQueries, ['生椰拿铁']);
  assert.equal(menuReads, 2);
  assert.equal(offers[0].name, '生椰拿铁');
  assert.equal(offers.length, 1);
  assert.equal(offers[0].browserRef.buttonIndex, 9);
});

test('a matching bought order is returned before store-local search', async () => {
  const browser = new TaobaoFlashBrowser();
  const searchPage = { url: () => 'https://h5.ele.me/search/?keyword=tea', waitForTimeout: async () => {} };
  const shopPage = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1' };
  browser.knownRoute = async () => null;
  browser.knownRoutesFor = async () => [];
  browser.goto = async () => searchPage;
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  browser.extractShops = async () => [{ index: 0, name: '茶百道（测试店）', storeId: 'tea-1', deliveryFee: 0, freeDeliveryThreshold: 0, etaMinutes: 20, rating: 5, monthlySales: 1000, couponLabel: '' }];
  browser.enterShop = async () => shopPage;
  browser.repeatPurchase = async () => ({ summary: '4天前买过 茉莉葡萄冰奶 不额外加糖 再来一单', quantity: 1, total: 18 });
  let menuReads = 0; let internalSearches = 0;
  browser.extractMenu = async () => { menuReads += 1; return []; };
  browser.searchInsideShop = async () => { internalSearches += 1; return true; };

  const offers = await browser.search('茶百道 茉莉葡萄冰奶 无糖', 3);

  assert.equal(offers[0].browserRef.repeatPurchase, true);
  assert.equal(menuReads, 0);
  assert.equal(internalSearches, 0);
});

test('an already open matching storefront is searched before any outer marketplace navigation', async () => {
  const browser = new TaobaoFlashBrowser();
  const active = {
    isClosed: () => false,
    url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1',
    locator: () => ({ innerText: async () => '商家 茶百道（测试店） 热销 茉莉葡萄冰奶' }),
  };
  browser.page = active;
  browser.assertRiskCooldown = async () => {};
  browser.knownRoute = async () => null;
  browser.knownRoutesFor = async () => [];
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  browser.repeatPurchase = async () => null;
  browser.extractMenu = async () => [{ name: '茉莉葡萄冰奶', price: 18, description: '茉莉葡萄冰奶 ¥18', buttonIndex: 2 }];
  browser.searchInsideShop = async () => true;
  browser.rememberKnownRoute = async () => {};
  browser.goto = async () => { throw new Error('outer search must not run'); };

  const offers = await browser.search('茶百道 茉莉葡萄冰奶 无糖 少冰 大杯', 3, { allowGlobalSearch: false });

  assert.equal(offers.length, 1);
  assert.equal(offers[0].name, '茉莉葡萄冰奶');
  assert.equal(offers[0].browserRef.shopUrl, active.url());
});

test('checkout submission applies an available red packet before clicking payment', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const submit = source.slice(source.indexOf('async submitOrder('), source.indexOf('async orderStatus('));
  assert.ok(submit.indexOf('applyBestAvailableCoupon(page)') < submit.indexOf('checkoutSubmitControl(page)'));
  assert.match(submit, /riskCheck\(page/);
  assert.match(submit, /有餐具\|需要餐具/);
  assert.doesNotMatch(submit, /getByText\('无需餐具'/);
  assert.match(submit, /getByText\(\/\^付款\$\//);
  assert.match(submit, /没有到达支付宝“付款”页面/);
  assert.match(submit, /checkoutSubmitControl\(page\)/);
  assert.match(source, /async checkoutSubmitControl\(page\)[\s\S]*?for \(let wait = 0; wait < 12; wait \+= 1\)/);
  assert.match(source, /\.shtc-base-coupon__wrap:not\(\.disable\)/);
  assert.match(source, /立即兑换\|确认兑换\|兑换并使用\|确认使用/);
  assert.match(source, /吃货豆不足\|余额不足\|兑换失败/);
  assert.match(source, /renderedLocator\(nativeControls\)/);
  assert.match(submit, /alreadyAtPaymentSelection/);
  assert.match(submit, /waitForPaymentSelection\(page, beforePages\)/);
  assert.match(source, /async advancePaymentSelection\(page\)[\s\S]*?\^支付宝\$[\s\S]*?\^确认支付\$/);
  assert.match(source, /async waitForPaymentSelection\(page, beforePages = new Set\(\)\)[\s\S]*?12_000[\s\S]*?advancePaymentSelection\(candidate\)/);
});

test('payment selection waits for the asynchronously rendered Alipay chooser', async () => {
  const browser = new TaobaoFlashBrowser();
  let reads = 0; let advanced = 0;
  const candidate = {
    isClosed: () => false,
    url: () => 'https://r.ele.me/payment?trade=1',
    locator: selector => selector === 'body' ? { innerText: async () => (++reads < 2 ? '加载中' : '支付宝 微信支付 确认支付') } : {},
    getByText: () => ({ id: 'payment' }),
  };
  const page = { ...candidate, waitForTimeout: async () => {} };
  browser.context = { pages: () => [candidate] };
  browser.visibleLocator = async () => null;
  browser.advancePaymentSelection = async value => { assert.equal(value, candidate); advanced += 1; return true; };

  const result = await browser.waitForPaymentSelection(page, new Set());

  assert.equal(result, candidate);
  assert.equal(advanced, 1);
  assert.ok(reads >= 2);
});

test('option inspection re-enters the exact store-local product search', async () => {
  const browser = new TaobaoFlashBrowser();
  const page = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1' };
  browser.ensure = async () => page;
  browser.goto = async () => page;
  browser.riskCheck = async () => 0;
  browser.waitForPurchaseControls = async () => true;
  const queries = [];
  browser.searchInsideShop = async (_page, query) => { queries.push(query); return true; };
  let controlReads = 0;
  browser.productControl = async () => ++controlReads === 1 ? null : ({ id: 'exact-product-control' });
  browser.inspectOptionsControl = async (_page, button) => button.id === 'exact-product-control' ? [{ name: '糖度' }] : [];
  browser.rememberKnownRoute = async () => {};

  const groups = await browser.inspectOptionsFor({
    itemName: '杨枝甘露', shopUrl: page.url(), query: '古茗 杨枝甘露 少糖',
  });

  assert.deepEqual(queries, ['杨枝甘露']);
  assert.deepEqual(groups, [{ name: '糖度' }]);
});

test('ChaPanda brand and exact store-local drink name are preserved', () => {
  assert.equal(preferredBrand('茶百道 茉莉葡萄冰奶 无糖'), 'chabaidao');
  assert.equal(brandMatches('chabaidao', '茶百道（中心店）'), true);
  assert.equal(requestedItemName('茶百道 茉莉葡萄冰奶 无糖'), '茉莉葡萄冰奶');
});

test('an item opened from the store-local search page is not treated as navigation drift', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(source, /const startedOnInternalSearch = shopSearchUrl\(page\.url\(\)\)/);
  assert.match(source, /!startedOnInternalSearch && shopSearchUrl\(page\.url\(\)\)/);
  assert.match(source, /\\d\+天内\\d\+人下单/);
});

test('store search explicitly recognizes the storefront magnifier class', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(source, /'\.nav__search__wrap'/);
  assert.match(source, /'\.shop__search--expland'/);
  assert.match(source, /'\.nav__search'/);
  assert.match(source, /'input\.search-input'/);
  assert.match(source, /刷新\|重试\|reload\|refresh/);
});

test('store-local result extraction reads only the product title and keeps the first visible row', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(source, /node\.querySelector\('\.menuItem--info-title'\)/);
  assert.match(source, /box\.y <= \(allowTopRows \? 40 : 140\)/);
  assert.match(source, /}, shopSearchUrl\(page\.url\(\)\)\)/);
});

test('all saved shops being closed stops without any global search', async () => {
  const browser = new TaobaoFlashBrowser();
  const routes = [
    { routeKey: 'route-1', merchant: '瑞幸咖啡（一店）', itemName: '生椰拿铁', shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1' },
    { routeKey: 'route-2', merchant: '瑞幸咖啡（二店）', itemName: '生椰拿铁', shopUrl: 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-2' },
  ];
  browser.knownRoute = async () => routes[0];
  browser.knownRoutesFor = async () => routes;
  browser.enterShop = async () => { throw new Error('门店已打烊'); };
  browser.markKnownRouteClosed = async () => {};
  let globalSearches = 0;
  browser.goto = async () => { globalSearches += 1; };
  await assert.rejects(browser.search('瑞幸咖啡 生椰拿铁', 3, { allowGlobalSearch: false }), /全部打烊/);
  assert.equal(globalSearches, 0);
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

test('image captcha pauses once and resumes the same operation after manual verification', async () => {
  assert.equal(riskChallengeKind('请选择符合描述的所有图片，没有新图片可以点后，请点击“提交”'), '图片验证');
  assert.equal(riskChallengeKind('瑞幸咖啡 生椰拿铁 月售 1200'), '');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-risk-cooldown-'));
  try {
    let reads = 0;
    const frame = { locator: () => ({ innerText: async () => reads++ < 1 ? '请选择符合描述的所有图片' : '瑞幸咖啡 生椰拿铁' }) };
    const page = { frames: () => [frame], async waitForTimeout() {}, async bringToFront() {} };
    const browser = new TaobaoFlashBrowser({ profile, headless: false });
    const waited = await browser.riskCheck(page, { waitForHuman: true, maxWaitMs: 10_000 });
    assert.ok(waited >= 0);
    await new TaobaoFlashBrowser({ profile }).assertRiskCooldown();
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test('a dismissible verification overlay is closed automatically before pausing for a human', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-dismissible-risk-'));
  try {
    let open = true;
    const candidate = {
      async isVisible() { return open; },
      async evaluate() { return 'captcha-close × 关闭'; },
      async boundingBox() { return { x: 380, y: 40, width: 28, height: 28 }; },
      async click() { open = false; },
    };
    const collection = {
      async count() { return open ? 1 : 0; },
      nth() { return candidate; },
    };
    const frame = {
      async evaluate() { return open ? '请选择符合描述的所有图片，没有新图片可以点后，请点击“提交”' : '瑞幸咖啡 生椰拿铁 月售 1200'; },
      locator(selector) {
        if (selector === 'body') return { innerText: async () => open ? '请选择符合描述的所有图片' : '瑞幸咖啡 生椰拿铁' };
        return collection;
      },
    };
    const page = { frames: () => [frame], async waitForTimeout() {} };
    const browser = new TaobaoFlashBrowser({ profile, headless: false });
    const waited = await browser.riskCheck(page, { waitForHuman: true, maxWaitMs: 1 });
    assert.ok(waited >= 0);
    assert.equal(open, false);
    await new TaobaoFlashBrowser({ profile }).assertRiskCooldown();
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test('unresolved image captcha times out once and persists a retry cooldown', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-risk-timeout-'));
  try {
    const frame = { locator: () => ({ innerText: async () => '请选择符合描述的所有图片' }) };
    const page = { frames: () => [frame], async waitForTimeout() {}, async bringToFront() {} };
    const browser = new TaobaoFlashBrowser({ profile, headless: false });
    await assert.rejects(browser.riskCheck(page, { waitForHuman: true, maxWaitMs: 1 }), /等待本人完成验证已超时.*冷却30分钟/);
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

test('a manually closed browser page is replaced before the next operation', async () => {
  const browser = new TaobaoFlashBrowser({ headless: true });
  const replacement = { isClosed: () => false };
  browser.page = { isClosed: () => true };
  browser.context = { pages: () => [replacement], async newPage() { throw new Error('existing page should be reused'); } };
  let launches = 0;
  browser.start = async () => { launches += 1; };
  assert.equal(await browser.ensure(), replacement);
  assert.equal(launches, 0);
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

test('capabilities is passive and never opens or navigates the marketplace', async () => {
  const browser = new FakeBrowser();
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const first = await adapter.capabilities();
  const second = await adapter.capabilities();
  assert.equal(first.passive, true);
  assert.equal(second.addressLabel, '');
  assert.equal(browser.statusCalls, 0);
});

test('role search keeps the confirmed address and allows one bounded global search', async () => {
  let addressReads = 0; let searchOptions = null;
  const browser = {
    async currentAddress() { addressReads += 1; return { label: '家', fingerprintSource: 'secret' }; },
    async search(query, limit, options) {
      searchOptions = options;
      return [{ merchantId: 'luckin-1', merchant: '瑞幸咖啡', name: '生椰拿铁', price: 18, deliveryFee: 0, total: 18, browserRef: {} }];
    },
  };
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const result = await adapter.handle('search', {
    query: '瑞幸咖啡 生椰拿铁 少糖', roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved-address-fingerprint', allowGlobalSearch: true, limit: 3,
  }, { target: 'yb_test' });
  assert.equal(result.offers[0].name, '生椰拿铁');
  assert.equal(addressReads, 0);
  assert.deepEqual(searchOptions, { allowGlobalSearch: true });
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

test('a historical superset cannot create an order until the user explicitly approves the whole cart', async () => {
  const browser = new FakeBrowser();
  browser.search = async () => [{
    merchantId: 'meal-1', merchant: '曼玲粥', name: '燕麦牛奶粥', price: 31.73,
    deliveryFee: 0, total: 31.73, browserRef: { repeatPurchase: true },
    optionGroups: [], optionsLoaded: true, requiresConfirmation: true,
    confirmationReason: '历史整单还包含圆葱牛肉饼',
  }];
  browser.createOrder = async () => ({ total: 31.73, items: [{ name: '燕麦牛奶粥、五香茶叶蛋、圆葱牛肉饼', quantity: 3, price: 31.73 }], browserOrderRef: {} });
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const context = { target: 'yb_test' };
  const search = await adapter.handle('search', { query: '曼玲粥 牛奶燕麦粥 加一个茶叶蛋' }, context);
  assert.equal(search.offers[0].requiresConfirmation, true);
  await assert.rejects(adapter.handle('create_order', {
    offerId: search.offers[0].offerId, quoteId: search.offers[0].quoteId, clientRequestId: 'history-no',
  }, context), /圆葱牛肉饼/);
  const created = await adapter.handle('create_order', {
    offerId: search.offers[0].offerId, quoteId: search.offers[0].quoteId,
    confirmedHistoricalSuperset: true, clientRequestId: 'history-yes',
  }, context);
  assert.equal(created.total, 31.73);
});

test('existing cart is reusable only when requested items and quantities match', () => {
  const exact = checkoutCartState('确认订单 曼玲粥 燕麦牛奶粥 无糖 × 1 ¥12.9 五香茶叶蛋1个 × 1 ¥4.9 合计¥18.4', '燕麦牛奶粥', '曼玲粥 燕麦牛奶粥 加一个茶叶蛋');
  assert.equal(exact.matches, true);
  const duplicated = checkoutCartState('确认订单 燕麦牛奶粥 无糖 × 2 ¥25.8 五香茶叶蛋1个 × 2 ¥9.8 圆葱牛肉饼 × 1 ¥9.5 合计¥29.1', '燕麦牛奶粥', '曼玲粥 燕麦牛奶粥 加一个茶叶蛋', 1, { allowSuperset: true });
  assert.equal(duplicated.matches, false);
  assert.deepEqual(duplicated.duplicates, ['燕麦牛奶粥', '茶叶蛋']);
  const unrelated = checkoutCartState('确认订单 燕麦牛奶粥 无糖 × 1 ¥12.9 五香茶叶蛋1个 × 1 ¥4.9 圆葱牛肉饼 × 1 ¥9.5 合计¥27.3', '燕麦牛奶粥', '曼玲粥 燕麦牛奶粥 加一个茶叶蛋');
  assert.equal(unrelated.matches, false);
  assert.equal(unrelated.extraRows, 1);
  assert.equal(checkoutCartState('确认订单 燕麦牛奶粥 无糖 × 1 ¥12.9 五香茶叶蛋1个 × 1 ¥4.9 圆葱牛肉饼 × 1 ¥9.5 合计¥27.3', '燕麦牛奶粥', '曼玲粥 燕麦牛奶粥 加一个茶叶蛋', 1, { allowSuperset: true }).matches, true);
});

test('amount guard stops an order above the configured limit', async () => {
  const browser = new FakeBrowser(); browser.createOrder = async () => ({ total: 101, browserOrderRef: {} });
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012', maxOrderAmount: 100 });
  const context = { target: 'yb_test' };
  const search = await adapter.handle('search', { query: 'KFC' }, context);
  await assert.rejects(adapter.handle('create_order', { offerId: search.offers[0].offerId, quoteId: search.offers[0].quoteId, selectedOptions: { drink: 'cola' }, clientRequestId: 'b' }, context), /超过服务端上限/);
});

test('checkout draft replaces the search label with the real shop and real product image', async () => {
  const browser = new FakeBrowser();
  browser.createOrder = async () => ({
    total: 22.9,
    merchant: '瑞幸咖啡(活力广场店)',
    imageUrl: 'https://img.alicdn.com/real-luckin-product.jpg',
    items: [{
      name: '生椰拿铁（首创）-大杯',
      quantity: 1,
      price: 21.9,
      options: '大杯/冰/意式拼配/无奶油/不另外加糖/默认浓度',
      imageUrl: 'https://img.alicdn.com/real-luckin-product.jpg',
    }],
    browserOrderRef: { stage: 'confirm' },
  });
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const context = { target: 'yb_test' };
  const search = await adapter.handle('search', { query: '瑞幸咖啡 生椰拿铁 不另外加糖' }, context);
  const created = await adapter.handle('create_order', {
    offerId: search.offers[0].offerId,
    quoteId: search.offers[0].quoteId,
    selectedOptions: { drink: 'coffee' },
    clientRequestId: 'real-checkout-facts',
  }, context);
  assert.equal(created.merchant, '瑞幸咖啡(活力广场店)');
  assert.equal(created.items[0].name, '生椰拿铁（首创）-大杯');
  assert.equal(created.imageUrl, 'https://img.alicdn.com/real-luckin-product.jpg');
});

test('checkout reader captures CSS-background product photos from the live confirmation page', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const reader = source.slice(source.indexOf('async readCheckoutDraft('), source.indexOf('async useExistingCartIfMatching('));
  assert.match(reader, /document\.querySelector\('\.food-list__title'\)/);
  assert.match(reader, /const rowSelector = \[/);
  assert.match(reader, /document\.querySelectorAll\(rowSelector\)/);
  assert.match(reader, /\[class\*="order-item"\]/);
  assert.match(reader, /getComputedStyle\(node\)\.backgroundImage/);
  assert.match(reader, /root\.querySelectorAll\('img, div, span'\)/);
  assert.match(reader, /score \+= 30/);
  assert.match(reader, /const capturedImageUrl = await this\.readOrderImage\(page, itemNames\)/);
  assert.match(reader, /const imageUrl = capturedImageUrl \|\| checkoutFacts\.imageUrl/);
  assert.match(reader, /browserOrderRef: \{ stage: 'confirm', url: page\.url\(\), itemNames, imageUrl \}/);
});

test('menu reader prefers real square product photos over tiny campaign badges', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const reader = source.slice(source.indexOf('async extractMenu('), source.indexOf('async openProductByName('));
  assert.match(reader, /root\.querySelectorAll\('img, div, span'\)/);
  assert.ok(reader.includes('w_90[,/]h_53'));
  assert.match(reader, /Math\.abs\(rect\.width \/ rect\.height - 1\) < \.3/);
  assert.match(reader, /const imageUrl = media\[0\]\?\.url \|\| ''/);
});
