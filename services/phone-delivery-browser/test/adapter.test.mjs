import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DeliveryAdapter } from '../src/adapter.mjs';
import { sign, verifySignedRequest } from '../src/security.mjs';
import { activeShopMatchesBrand, appliedCouponAmount, availableCouponAmount, brandMatches, cartItemVerification, checkoutAmounts, checkoutCartState, checkoutEtaText, checkoutItemOptionsFromText, checkoutPageReady, collapseRepeatedOptionText, couponCheckoutState, dessertTopUpCandidates, dessertTopUpEligible, fruitServingEligible, fruitServingWeightGrams, fruitTopUpCandidates, fruitTopUpEligible, kfcDefaultSignatureBundleRequested, kfcHomepageSignatureBundle, kfcItemCoveredByText, kfcSignatureBundle, kfcStandaloneSearchTerm, knownRouteKey, mcdonaldsBreakfastBundleOptions, mealSideTopUpEligible, mealSnackCandidates, menuCardName, menuCardPrice, merchantNameMatchScore, milkTeaToppingCandidates, milkTeaTopUpEligible, minimumOrderInfo, missingSelectedOptionRequirements, multiServingEligible, normalizeOptionPanelGroups, preferredBrand, preferredExactProduct, productMatchesSavedItem, publicAddressLabel, repeatPurchaseMatches, repeatPurchaseMatchKind, requestedExtraItems, requestedFruitExclusions, requestedItemName, requestedKfcItems, requestedMaxDistanceKm, requestedMealSide, requestedMilkTeaToppingPreferences, requestedStandaloneItems, requestedStoreItemName, retailShopSearchUrl, riskChallengeKind, sameShopUrl, savedTopUpItems, selectedOptionsCoverItem, shortFoodTitleAliasEligible, shopClosedReason, shopRowsFromVisibleText, singleFruitItemMatches, singleFruitKeyword, snackTopUpCandidates, snackTopUpEligible, standaloneItemSpecIntent, TaobaoFlashBrowser } from '../src/taobao-flash-browser.mjs';
import { storeSearchTermMatches } from '../src/taobao-flash-browser.mjs';
import { merchantFromShopText } from '../src/taobao-flash-browser.mjs';
import { requestedSinglePersonSoupCombo } from '../src/taobao-flash-browser.mjs';
import { optionChoiceMatchesSummary } from '../src/taobao-flash-browser.mjs';

class FakeBrowser {
  constructor() { this.submits = 0; this.statusCalls = 0; this.statusValue = 'pending_payment'; }
  async status() { this.statusCalls += 1; return { loggedIn: true, addressLabel: '家' }; }
  async currentAddress() { return { label: '家', fingerprintSource: 'secret-full-address' }; }
  async search() { return [{ merchantId: 'kfc-1', merchant: '肯德基', name: '原味鸡套餐', price: 39, deliveryFee: 3, total: 42, browserRef: { item: 1 }, optionGroups: [], optionsLoaded: false }]; }
  async inspectOptionsFor() { return [{ id: 'drink', name: '饮料', required: true, multiple: false, choices: [{ id: 'cola', label: '可乐', available: true }, { id: 'coffee', label: '咖啡', available: true }] }]; }
  async createOrder({ selectedOptions }) { return { total: 42, items: [{ name: '原味鸡套餐', quantity: 1, price: 42, options: selectedOptions.drink }], browserOrderRef: { id: 1 } }; }
  async submitOrder() {
    this.submits += 1;
    const couponCheck = { status: 'none', amount: 0, evidence: 'checkout_explicit_none' };
    return { status: 'pending_payment', payUrl: 'https://cashier.example.test/pay?id=1', couponCheck, browserOrderRef: { id: 1, couponCheck } };
  }
  async orderStatus() { return { status: this.statusValue }; }
}

const roleTask = (overrides = {}) => ({
  taskId: 'delivery-task-1', authorizationSource: 'user_explicit', roleId: 'role-1',
  accountId: 'main', sessionId: 'role-1:main', turnId: 'message-1', messageId: 'message-1',
  createdAt: Date.now(), intentSummary: '瑞幸咖啡 / 生椰拿铁', status: 'running', revision: 1,
  ...overrides,
});

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

test('a below-minimum shortfall is not misreported as the minimum threshold', () => {
  assert.deepEqual(minimumOrderInfo('还差\n9.1元\n起送\n凑单\n立减\n5\n1\n¥\n10.9\n免配送费\n¥2.8\n差¥9.1起送', 8.9, 1), {
    threshold: 20, shortfall: 9.1, current: 10.9, minimumQuantity: 3,
  });
});

test('checkout option text collapses an exact duplicated platform subtitle', () => {
  const options = '大脆鸡扒麦满分/脆薯饼/小杯鲜萃咖啡';
  assert.equal(collapseRepeatedOptionText(options + options), options);
  assert.equal(collapseRepeatedOptionText(options), options);
});

test('checkout option fallback reads only the text between a product title and its quantity', () => {
  const raw = '确认订单 招牌汉堡4件套 劲脆鸡腿汉堡/劲爆鸡米花(小)/红豆派(1只装)/桂花酸梅汤(大) × 1 ¥39.9 经典草莓圣代 × 1 ¥13.5';
  assert.equal(checkoutItemOptionsFromText(raw, '招牌汉堡4件套'), '劲脆鸡腿汉堡/劲爆鸡米花(小)/红豆派(1只装)/桂花酸梅汤(大)');
  assert.equal(checkoutItemOptionsFromText(raw, '经典草莓圣代'), '');
});

test('a sticky storefront product card uses its discounted price instead of the crossed-out price', () => {
  assert.equal(menuCardPrice('招牌皮蛋瘦肉粥 9.22折 ¥11.8 ¥12.8'), 11.8);
  assert.equal(menuCardPrice('香稠南瓜粥 ¥11.8'), 11.8);
});

test('the largest advertised checkout red packet is recognized', () => {
  assert.equal(availableCouponAmount('闪购红包 未选红包，最高10元可用 下单返豆'), 10);
  assert.equal(availableCouponAmount('闪购红包 无可用红包'), 0);
});

test('an already applied checkout red packet is not reopened', () => {
  assert.equal(appliedCouponAmount('闪购红包 -¥ 6.5 下单返豆 合计¥16.4'), 6.5);
  assert.equal(appliedCouponAmount('闪购红包 未选红包，最高6.5元可用'), 0);
});

test('an automatically applied retail store coupon counts as a completed coupon check', () => {
  assert.equal(appliedCouponAmount('店铺/商品红包 - ¥ 4 平台红包 无可用红包 合计¥31.68'), 4);
  assert.deepEqual(couponCheckoutState('店铺/商品红包 - ¥ 4 平台红包 无可用红包 合计¥31.68', 'https://h5.ele.me/newretail/tr/buy/'), {
    status: 'applied', amount: 4, evidence: 'checkout_applied_discount',
  });
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

test('brand-drink top-up accepts only toppings and rejects snacks, full drinks, and merchandise', () => {
  assert.deepEqual(milkTeaToppingCandidates([
    { name: '爆酥脆干脆面', price: 1.5 }, { name: '麻辣鸡丝', price: 2.6 },
    { name: '雪王积木Q粒-水果系列盲袋', price: 2.5 }, { name: '椰果奶茶', price: 9 },
  ], '黄桃果霸'), []);
  assert.deepEqual(milkTeaToppingCandidates([
    { name: '脆波波', price: 1 }, { name: '脆啵啵', price: 1 }, { name: '奶冻', price: 1 },
    { name: '小西米', price: 1 }, { name: '黑糖珍珠', price: 2 }, { name: '冻冻', price: 1 },
    { name: '椰果', price: 1 }, { name: '奶麻薯', price: 2 }, { name: '芝士奶盖', price: 3 },
    { name: '雪糯米', price: 2 }, { name: '芝士奶盖茶', price: 12 },
  ], '茉莉奶绿'), ['脆波波', '脆啵啵', '奶冻', '小西米', '黑糖珍珠', '冻冻', '椰果', '奶麻薯', '芝士奶盖', '雪糯米']);
  assert.deepEqual(milkTeaToppingCandidates([
    { name: '小多肉', price: 2, description: '适合添加水果茶类' },
    { name: '厚芋泥', price: 2, description: '不适合添加到任何含水果饮品里' },
    { name: '血糯米', price: 2, description: '香甜软糯' },
    { name: '大多肉', price: 2, description: '适合添加水果茶类' },
    { name: '黑糖波波', price: 2, description: '无法添加在含水果饮品里' },
    { name: '西柚粒', price: 3, description: '红西柚果粒' },
  ], '西瓜椰椰 少冰'), ['小多肉', '厚芋泥', '血糯米', '大多肉', '黑糖波波', '西柚粒']);
});

test('explicit milk-tea topping preferences prioritize the requested item and exclude aliases', async () => {
  assert.deepEqual(requestedMilkTeaToppingPreferences('茶百道 青提茉莉 加奶冻 不要脆波波'), {
    preferred: ['奶冻'], excluded: ['脆波波'],
  });
  assert.deepEqual(requestedMilkTeaToppingPreferences('青提茉莉 加奶冻 不要脆啵啵'), {
    preferred: ['奶冻'], excluded: ['脆波波'],
  });
  assert.deepEqual(requestedMilkTeaToppingPreferences('蜜雪冰城 芋圆葡萄 三分糖 加葡萄肉和芋圆'), {
    preferred: ['葡萄肉', '芋圆'], excluded: [],
  });
  assert.deepEqual(requestedMilkTeaToppingPreferences('茶百道 杨枝甘露 不加糖 热的 去除西柚粒 加一份椰果'), {
    preferred: ['椰果'], excluded: ['西柚粒'],
  });
  assert.deepEqual(requestedStandaloneItems('蜜雪冰城 芋圆葡萄 三分糖 加葡萄肉和芋圆'), []);
  const browser = new TaobaoFlashBrowser();
  const page = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1', async waitForTimeout() {} };
  browser.returnToStorefrontWithoutRefresh = async () => page;
  browser.boughtOrderSummary = async () => '';
  browser.openStoreMenuCategory = async () => true;
  browser.waitForPurchaseControls = async () => {};
  browser.extractMenu = async () => [
    { name: '脆啵啵', price: 1.5 }, { name: '冻冻', price: 1.5 },
    { name: '奶冻', price: 1.5 }, { name: '椰果', price: 1.5 },
  ];
  browser.topUpWithCandidateItems = async (_page, _ref, names, _excluded, _label, options) => ({ names, options });

  const result = await browser.topUpWithSavedItems(page, {
    itemName: '青提茉莉', merchant: '茶百道', query: '茶百道 青提茉莉 加奶冻 不要脆波波',
  });
  assert.deepEqual(result.names, ['奶冻', '冻冻', '椰果']);
  assert.deepEqual(result.options.requiredNames, ['奶冻']);
});

test('explicit milk-tea toppings are completed before checkout is accepted', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const create = source.slice(source.indexOf('async createOrder({ ref'), source.indexOf('async applyAvailableCoupon('));
  const toppingGate = create.indexOf('const explicitToppingPreferences = milkTeaOrder');
  const checkoutGate = create.indexOf('let checkout = explicitToppingCheckout');
  assert.ok(toppingGate > 0 && checkoutGate > toppingGate);
  assert.match(create, /missingToppings\.length[\s\S]*?不能提前结算/);
});

test('two coordinated requested toppings stay first and both must exist in the live add-on category', async () => {
  const browser = new TaobaoFlashBrowser();
  const page = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=mixue-1', async waitForTimeout() {} };
  browser.returnToStorefrontWithoutRefresh = async () => page;
  browser.boughtOrderSummary = async () => '';
  browser.openStoreMenuCategory = async () => true;
  browser.waitForPurchaseControls = async () => {};
  browser.extractMenu = async () => [
    { name: '椰果', price: 1 }, { name: '芋圆小料', price: 2 },
    { name: '葡萄肉', price: 2 }, { name: '脆啵啵', price: 1 },
  ];
  browser.topUpWithCandidateItems = async (_page, _ref, names) => ({ names });

  const result = await browser.topUpWithSavedItems(page, {
    itemName: '芋圆葡萄', merchant: '蜜雪冰城', query: '蜜雪冰城 芋圆葡萄 三分糖 加葡萄肉和芋圆',
  });
  assert.deepEqual(result.names.slice(0, 2), ['葡萄肉', '芋圆小料']);
});

test('snack orders can fall back to distinct edible products when the requested snack cannot repeat', () => {
  assert.equal(snackTopUpEligible('薯片大礼包'), true);
  assert.deepEqual(snackTopUpCandidates([
    { name: '乐事原味薯片', price: 8 }, { name: '海苔脆片', price: 6 },
    { name: '海苔脆片', price: 6 }, { name: '【2件装】烧烤味薯片', price: 9 },
    { name: '雪王盲盒周边', price: 12 },
  ], '乐事原味薯片'), ['海苔脆片']);
});

test('fruit and dessert orders use distinct same-category top-ups without drinks or bundles', () => {
  assert.equal(fruitTopUpEligible('鲜切水果捞'), true);
  assert.deepEqual(fruitTopUpCandidates([
    { name: '鲜切水果捞', price: 16 }, { name: '哈密瓜果切200g', price: 8 },
    { name: '葡萄果茶', price: 12 }, { name: '水果拼盘2件装', price: 20 },
  ], '鲜切水果捞'), ['哈密瓜果切200g']);
  assert.equal(dessertTopUpEligible('巧克力蛋糕'), true);
  assert.deepEqual(dessertTopUpCandidates([
    { name: '巧克力蛋糕', price: 18 }, { name: '香草泡芙', price: 6 },
    { name: '拿铁咖啡', price: 15 }, { name: '曲奇3件装', price: 12 },
  ], '巧克力蛋糕'), ['香草泡芙']);
});

test('broad fruit choice keeps every explicit dislike as a hard exclusion', () => {
  assert.deepEqual(requestedFruitExclusions('除了香蕉不要点，其他都可以'), ['香蕉']);
  assert.deepEqual(requestedFruitExclusions('我不爱吃橙子，也不喜欢芒果，其他都行'), ['芒果', '橙子']);
  assert.deepEqual(fruitTopUpCandidates([
    { name: '鲜切西瓜200g', price: 9 }, { name: '香蕉切果180g', price: 8 },
    { name: '赣南脐橙切250g', price: 10 }, { name: '水仙芒果切200g', price: 12 },
    { name: '芒果夹乌梅150g', price: .99 },
  ], '鲜切西瓜200g', '不喜欢橙子，香蕉不要点，其他都可以'), ['水仙芒果切200g']);
});

test('retail coupon checkout is recognized before top-up can run away', async () => {
  const browser = new TaobaoFlashBrowser();
  browser.visibleLocator = async locator => locator === marker ? marker : null;
  const marker = {};
  const page = { getByText(pattern) { return pattern instanceof RegExp && pattern.test('领券结算') ? marker : {}; } };
  assert.equal(await browser.checkoutControl(page), marker);
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(added\.length >= 8\) break/);
  assert.match(source, /!candidates\.length && await this\.searchInsideShop\(page, '零食'\)/);
});

test('only snack orders may repeat the same product while other categories still reject duplicates', () => {
  assert.equal(cartItemVerification([{ name: '烧烤味薯片', quantity: 4 }], ['烧烤味薯片'], { allowRepeatedSnack: true }).ok, true);
  assert.equal(cartItemVerification([{ name: '牛肉面', quantity: 2 }], ['牛肉面'], { allowRepeatedSnack: true }).ok, false);
  assert.equal(cartItemVerification([{ name: '茉莉葡萄冰奶', quantity: 2 }], ['茉莉葡萄冰奶'], { allowRepeatedSnack: true }).ok, false);
});

test('milk-tea toppings are never used to pad coffee, meals, or fast food', async () => {
  assert.equal(milkTeaTopUpEligible('茶百道 茉莉葡萄冰奶'), true);
  assert.equal(milkTeaTopUpEligible('蜜雪冰城 棒打鲜橙'), true);
  assert.equal(milkTeaTopUpEligible('蜜雪冰城 芋圆葡萄 去商家主页面包含小料两个字的分类'), true);
  assert.equal(milkTeaTopUpEligible('瑞幸咖啡 生椰拿铁'), false);
  assert.equal(milkTeaTopUpEligible('肯德基 原味鸡套餐'), false);
  assert.equal(milkTeaTopUpEligible('牛肉炒饭'), false);

  const browser = new TaobaoFlashBrowser();
  browser.returnToStorefrontWithoutRefresh = async () => { throw new Error('non-tea order must not inspect saved toppings'); };
  const result = await browser.topUpWithSavedItems({}, { itemName: '生椰拿铁', merchant: '瑞幸咖啡' });
  assert.deepEqual(result, { checkout: null, added: [], expected: [], exhausted: true, eligible: false });
});

test('milk tea and meals never duplicate the main item to reach minimum order', async () => {
  assert.equal(multiServingEligible('茶百道 茉莉葡萄冰奶'), false);
  assert.equal(multiServingEligible('瑞幸咖啡 生椰拿铁'), true);
  assert.equal(multiServingEligible('星巴克 生椰拿铁'), false);
  assert.equal(multiServingEligible('KFC 原味鸡套餐'), false);
  assert.equal(multiServingEligible('牛肉炒饭'), false);
  assert.deepEqual(milkTeaToppingCandidates([{ name: '冻冻', price: 1 }, { name: '椰果', price: 1 }, { name: '冻冻', price: 1 }, { name: '珍珠', price: 0 }, { name: '茉莉奶绿', price: 18 }, { name: '椰果奶茶', price: 8 }], '茉莉奶绿'), ['冻冻', '椰果']);
  assert.deepEqual(milkTeaToppingCandidates([{ name: '豆乳米麻薯', price: 19 }, { name: '麻薯小料', price: 2 }], '茉莉奶绿'), ['麻薯小料']);
  assert.deepEqual(mealSnackCandidates([{ name: '手工兰州牛肉拉面', price: 19 }, { name: '茶叶蛋', price: .99, description: '单点不送' }, { name: '卤蛋', price: 2 }, { name: '蒸饺', price: .5, description: '+5份起售' }, { name: '牛肉炒饭', price: 20 }, { name: '茶叶蛋', price: .99 }], '手工兰州牛肉拉面'), ['茶叶蛋', '卤蛋']);

  const browser = new TaobaoFlashBrowser();
  await assert.rejects(browser.createOrder({
    ref: { merchant: '肯德基', itemName: '原味鸡套餐', query: 'KFC 原味鸡套餐' },
    selectedOptions: {}, optionGroups: [], quantity: 2,
  }), /只能点一份/);
});

test('every live cart add is rejected when the intended item is missing or any product is duplicated', () => {
  assert.equal(cartItemVerification([
    { name: '招牌皮蛋瘦肉粥', quantity: 1 }, { name: '现煎荷包蛋', quantity: 1 },
  ], ['皮蛋瘦肉粥', '现煎荷包蛋']).ok, true);
  assert.equal(cartItemVerification([
    { name: '百事可乐(中)', quantity: 1 }, { name: '香辣鸡腿汉堡(辣)', quantity: 1 },
  ], ['百事可乐(冷/中)', '汉堡']).ok, true);
  assert.equal(cartItemVerification([{ name: '汉堡套餐', quantity: 1 }], ['汉堡']).ok, false);
  const bad = cartItemVerification([
    { name: '现煎荷包蛋', quantity: 1 }, { name: '*三米豆浆（450ml）请于两小时内饮用', quantity: 2 },
  ], ['皮蛋瘦肉粥', '现煎荷包蛋', '三米豆浆']);
  assert.deepEqual(bad.duplicates, ['*三米豆浆（450ml）请于两小时内饮用']);
  assert.deepEqual(bad.missing, ['皮蛋瘦肉粥']);
  assert.equal(bad.ok, false);
});

test('new label-only SKU cards still verify selected choices without inventing sold-out state', async () => {
  assert.equal(optionChoiceMatchesSummary('已选：现蒸白糯米', '现蒸白糯米'), true);
  assert.equal(optionChoiceMatchesSummary('已选：白糯米', '现蒸白糯米'), true);
  assert.equal(optionChoiceMatchesSummary('已选：黑糯米', '现蒸白糯米'), false);
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(source, /const box = \(card \|\| node\)\.getBoundingClientRect\(\)/);
  assert.match(source, /target\.click\(\{ force: true \}\)/);
});

test('single-fruit cart verification accepts platform title variation but never a mixed fruit product', () => {
  const actual = '【超值单品】麒麟西瓜果切200g';
  assert.equal(singleFruitItemMatches(actual, '鲜切西瓜200g'), true);
  assert.equal(cartItemVerification([{ name: actual, quantity: 1 }], ['鲜切西瓜200g']).ok, true);
  assert.equal(singleFruitItemMatches('【带头吃瓜】麒麟西瓜桶（含桶约1000g）鲜果现切', '鲜切西瓜200g'), false);
  assert.equal(singleFruitItemMatches('西瓜芒果双拼', '鲜切西瓜'), false);
  assert.equal(cartItemVerification([{ name: '西瓜芒果双拼', quantity: 1 }], ['鲜切西瓜']).ok, false);
});

test('cart verification retries a transient missing row but never retries a duplicate quantity', async () => {
  const browser = new TaobaoFlashBrowser(); let reads = 0;
  browser.readSelectedCartItems = async () => ++reads === 1
    ? [{ name: '招牌皮蛋瘦肉粥', quantity: 1 }]
    : [{ name: '招牌皮蛋瘦肉粥', quantity: 1 }, { name: '招牌蒸饺5个', quantity: 1 }];
  const rows = await browser.verifyUniqueCartItems({ waitForTimeout: async () => {} }, ['皮蛋瘦肉粥', '招牌蒸饺5个']);
  assert.equal(reads, 2); assert.equal(rows.length, 2);
  reads = 0;
  browser.readSelectedCartItems = async () => { reads += 1; return [{ name: '三米豆浆', quantity: 2 }]; };
  await assert.rejects(browser.verifyUniqueCartItems({ waitForTimeout: async () => {} }, ['三米豆浆']), /重复商品/);
  assert.equal(reads, 1);
});

test('saved milk-tea add-ons are selected only from the live storefront add-on category', async () => {
  const browser = new TaobaoFlashBrowser();
  const added = [];
  const checkout = { id: 'checkout' };
  const page = {
    url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1',
    getByText(value) { return { id: value instanceof RegExp ? 'none' : 'checkout-locator' }; },
    async waitForTimeout() {},
  };
  browser.returnToStorefrontWithoutRefresh = async () => { searches.push('returned'); return page; };
  browser.boughtOrderSummary = async () => '4天前买过 茉莉葡萄冰奶 冻冻 椰果 奶冻 再来一单';
  const searches = [];
  browser.openStoreMenuCategory = async (_page, name) => { searches.push(name); return true; };
  browser.searchInsideShop = async () => { throw new Error('奶茶凑单不应提交店内搜索'); };
  browser.riskCheck = async () => {};
  browser.waitForPurchaseControls = async () => {};
  browser.extractMenu = async () => [{ name: '冻冻', price: 1 }, { name: '椰果', price: 1 }, { name: '豆乳米麻薯', price: 19 }];
  browser.productControl = async (_page, name) => ({ name });
  browser.activateProductControl = async (_page, control) => { added.push(control.name); };
  browser.verifyUniqueCartItems = async () => [];
  browser.optionPanel = async () => null;
  browser.visibleLocator = async locator => locator?.id === 'checkout-locator' ? checkout : null;

  const result = await browser.topUpWithSavedItems(page, { itemName: '茉莉葡萄冰奶' });

  assert.deepEqual(added, ['冻冻']);
  assert.deepEqual(searches, ['returned', '加小料区']);
  assert.equal(result.checkout, checkout);
  assert.deepEqual(result.expected, ['冻冻', '椰果']);
  assert.equal(result.exhausted, false);
});

test('minimum-order top-up never adds an already completed snack twice', async () => {
  const browser = new TaobaoFlashBrowser(); const added = [];
  const page = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1', getByText: () => ({ id: 'none' }), async waitForTimeout() {} };
  browser.returnToStorefrontWithoutRefresh = async () => page;
  browser.boughtOrderSummary = async () => '4天前买过 茉莉葡萄冰奶 冻冻 椰果 再来一单';
  browser.openStoreMenuCategory = async () => true;
  browser.searchInsideShop = async () => { throw new Error('奶茶凑单不应提交店内搜索'); };
  browser.riskCheck = async () => {};
  browser.waitForPurchaseControls = async () => {};
  browser.extractMenu = async () => [{ name: '冻冻', price: 1 }, { name: '椰果', price: 1 }];
  browser.productControl = async (_page, name) => ({ name });
  browser.activateProductControl = async (_page, control) => { added.push(control.name); };
  browser.verifyUniqueCartItems = async () => [];
  browser.optionPanel = async () => null;
  browser.visibleLocator = async () => null;
  const result = await browser.topUpWithSavedItems(page, { itemName: '茉莉葡萄冰奶' }, ['冻冻']);
  assert.deepEqual(added, ['椰果']);
  assert.deepEqual(result.expected, ['椰果']);
  assert.equal(result.added.includes('冻冻'), false);
});

test('milk-tea top-up opens the storefront add-on category without issuing a search', async () => {
  const browser = new TaobaoFlashBrowser(); const categories = [];
  const page = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1', getByText: () => ({ id: 'none' }), async waitForTimeout() {} };
  browser.returnToStorefrontWithoutRefresh = async () => page;
  browser.boughtOrderSummary = async () => '';
  browser.visibleLocator = async () => null;
  browser.openStoreMenuCategory = async (_page, name) => { categories.push(name); return true; };
  browser.searchInsideShop = async () => { throw new Error('奶茶凑单不应提交店内搜索'); };
  browser.waitForPurchaseControls = async () => {};
  browser.extractMenu = async () => [{ name: '椰果小料', price: 2 }];
  browser.topUpWithCandidateItems = async (_page, _ref, names) => ({ names });

  const result = await browser.topUpWithSavedItems(page, { itemName: '黄桃果霸', merchant: '蜜雪冰城' });

  assert.deepEqual(categories, ['加小料区']);
  assert.deepEqual(result.names, ['椰果小料']);
});

test('the storefront add-on category accepts any short menu label containing 小料', async () => {
  const browser = new TaobaoFlashBrowser(); const clicked = [];
  const empty = { count: async () => 0 };
  const category = {
    count: async () => 1,
    nth: () => ({
      scrollIntoViewIfNeeded: async () => {}, isVisible: async () => true,
      click: async () => { clicked.push('小料常点区'); },
    }),
  };
  const page = {
    url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=mixue-1',
    getByText: value => typeof value === 'string' ? empty : category,
    async waitForTimeout() {},
  };
  browser.tapControl = async (_page, control) => control.click();

  assert.equal(await browser.openStoreMenuCategory(page, '加小料区'), true);
  assert.deepEqual(clicked, ['小料常点区']);
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
    getByText: value => ({ id: value instanceof RegExp ? 'none' : 'checkout-locator' }),
    async waitForTimeout() {},
  };
  browser.returnToStorefrontWithoutRefresh = async () => page;
  browser.boughtOrderSummary = async () => '4天前买过 茉莉葡萄冰奶 冻冻 再来一单';
  browser.openStoreMenuCategory = async () => true;
  browser.searchInsideShop = async () => { throw new Error('奶茶凑单不应提交店内搜索'); };
  browser.waitForPurchaseControls = async () => {};
  browser.extractMenu = async () => [{ name: '冻冻', price: 1 }];
  browser.productControl = async () => ({ id: 'top-up' });
  browser.activateProductControl = async () => {};
  browser.verifyUniqueCartItems = async () => [];
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

test('shared checkout resolves the wheel-style utensil sheet before retrying submit', async () => {
  const browser = new TaobaoFlashBrowser();
  let open = true;
  const selected = [];
  const oneServing = { evaluate: async callback => { selected.push('1份'); await callback({ click() {} }); } };
  const confirm = { evaluate: async callback => { selected.push('确认餐具'); open = false; await callback({ click() {} }); } };
  const page = {
    locator: () => ({ innerText: async () => open ? '确认订单 选择餐具份数 无需餐具 1份 需要餐具，商家依据餐量提供' : '确认订单 立即支付' }),
    getByText: pattern => ({ pattern }),
    async waitForTimeout() {},
  };
  browser.renderedLocator = async locator => /1/.test(String(locator.pattern)) ? oneServing : confirm;

  assert.equal(await browser.resolveCheckoutUtensils(page), true);
  assert.deepEqual(selected, ['1份', '确认餐具']);
  assert.equal(open, false);
});

test('a merchant required-item gate selects only the free no-utensils row', async () => {
  const browser = new TaobaoFlashBrowser();
  const prompt = { kind: 'required-prompt' };
  const add = { kind: 'no-utensils-add' };
  const checkout = { kind: 'checkout' };
  const page = {
    getByText: value => ({ value }),
    waitForTimeout: async () => {},
  };
  const tapped = [];
  const productNames = [];
  let verified = [];
  browser.visibleLocator = async locator => locator.value === '未选必选品' ? prompt : null;
  browser.tapControl = async (_page, control) => { tapped.push(control.kind); };
  browser.productControl = async (_page, name) => { productNames.push(name); return name.startsWith('无需餐具') ? add : null; };
  browser.activateProductControl = async (_page, control) => { tapped.push(control.kind); };
  browser.verifyUniqueCartItems = async (_page, names) => { verified = names; };
  browser.checkoutControl = async () => checkout;

  const result = await browser.satisfyRequiredStoreItem(page, ['爆浆巧克力古早蛋糕']);

  assert.deepEqual(tapped, ['required-prompt', 'no-utensils-add']);
  assert.equal(productNames[0], '无需餐具（默认任何餐具都不配备）我坚决不要任何餐具');
  assert.deepEqual(verified, ['爆浆巧克力古早蛋糕', '无需餐具（默认任何餐具都不配备）我坚决不要任何餐具']);
  assert.equal(result.checkout, checkout);
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

test('minimum order text reports threshold metadata without authorizing a quantity bump', () => {
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
    selectionRequired: true,
  }]);
});

test('KFC bundle option parser removes the visual default badge from drink choices', () => {
  const groups = normalizeOptionPanelGroups([{ name: '饮料（请选择1份）', choices: ['默认: 标准.', '百事可乐(冷/中)', '桂花酸梅汤(大)'] }]);
  assert.deepEqual(groups[0].choices, ['百事可乐(冷/中)', '桂花酸梅汤(大)']);
});

test('milk tea option parser restores decorated temperature and sweetness headings flattened by the platform', () => {
  const groups = normalizeOptionPanelGroups([{
    name: '规格',
    choices: [
      '大杯（芝士不分装l易融）', '大杯（芝士分装l不满杯）',
      '中杯（芝士不分装l易融）', '中杯（芝士分装l不满杯）',
      '温度【热饮建议分装】', '少冰', '正常冰', '去冰', '常温（凉）', '热',
      '甜度【选推荐更好喝】', '3分糖(口感偏淡)', '7分糖(推荐)', '不额外加糖(口感淡)', '全糖',
    ],
  }]);
  assert.deepEqual(groups.map(group => ({ name: group.name, choices: group.choices })), [
    { name: '规格', choices: ['大杯（芝士不分装l易融）', '大杯（芝士分装l不满杯）', '中杯（芝士不分装l易融）', '中杯（芝士分装l不满杯）'] },
    { name: '温度', choices: ['少冰', '正常冰', '去冰', '常温（凉）', '热'] },
    { name: '甜度', choices: ['3分糖(口感偏淡)', '7分糖(推荐)', '不额外加糖(口感淡)', '全糖'] },
  ]);
});

test('meal bundle parser recognizes explicit in-combo food and drink groups', () => {
  const groups = normalizeOptionPanelGroups([
    { name: '选择套餐内小食请选1份', choices: ['草莓麦旋风', '香芋派', '菠萝派', '脆薯饼'] },
    { name: '选择套餐内饮料请选1份', choices: ['可乐', '鲜萃冰咖'] },
  ]);
  assert.deepEqual(groups.map(group => ({ name: group.name, selectionCount: group.selectionCount, choices: group.choices })), [
    { name: '选择套餐内小食', selectionCount: 1, choices: ['草莓麦旋风', '香芋派', '菠萝派', '脆薯饼'] },
    { name: '选择套餐内饮料', selectionCount: 1, choices: ['可乐', '鲜萃冰咖'] },
  ]);
});

test('McDonalds default bundle is read from the storefront and keeps the learned live option names', () => {
  assert.equal(preferredBrand('麦当劳随便点一个套餐'), 'mcdonalds');
  assert.equal(brandMatches('mcdonalds', '麦当劳&麦咖啡(测试店)'), true);
  assert.equal(requestedStoreItemName('麦当劳 套餐', '麦当劳'), '麦满分单人餐随心选');
  assert.equal(requestedStoreItemName('麦当劳随便点一个套餐', '麦当劳'), '麦满分单人餐随心选');
  assert.equal(requestedStoreItemName('麦当劳 巨无霸', '麦当劳'), '巨无霸');
  assert.deepEqual(mcdonaldsBreakfastBundleOptions, {
    product: '麦满分单人餐随心选',
    mains: ['大脆鸡扒麦满分', '火腿扒麦满分', '吉士蛋麦满分', '原味板烧鸡腿麦满分', '猪柳麦满分'],
    sides: ['脆薯饼', '脆香油条'],
    drinks: ['小杯鲜萃咖啡', '小杯优品豆浆', '鲜萃冰咖'],
  });
  const groups = normalizeOptionPanelGroups([
    { name: '选择麦满分（请选1份）', choices: mcdonaldsBreakfastBundleOptions.mains },
    { name: '选择套餐内小食（请选择1份）', choices: mcdonaldsBreakfastBundleOptions.sides },
    { name: '选择套餐内饮料（请选择1份）', choices: mcdonaldsBreakfastBundleOptions.drinks },
  ]);
  assert.deepEqual(groups.map(group => group.name), ['选择麦满分', '选择套餐内小食', '选择套餐内饮料']);
});

test('McDonalds default bundle never falls back to a store-local search', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(source, /const mcdonaldsHomepageOnly = mcdonaldsDefaultBundleRequested/);
  assert.match(source, /const homepageOnly = mcdonaldsHomepageOnly \|\| kfcHomepageOnly/);
  assert.match(source, /menuSelectionAllowed && !homepageOnly/);
  assert.match(source, /searchResultSelectionAllowed && !homepageOnly/);
  assert.match(source, /!searchedInsideShop && !exactItems\.length && !homepageOnly[\s\S]*?searchInsideShop\(shopPage, itemQuery\)/);
  assert.match(source, /!button && !mcdonaldsHomepageOnly && !kfcHomepageOnly && await this\.searchInsideShop/);
  assert.match(source, /!resumeExistingMain && !add && !mcdonaldsHomepageOnly && !kfcHomepageOnly && await this\.searchInsideShop/);
});

test('checkout option verification distinguishes exact ice and sweetness requirements', () => {
  const selected = ['规格：中杯（芝士不分装l易融）', '温度：去冰', '甜度：7分糖(推荐)'];
  assert.deepEqual(missingSelectedOptionRequirements('中杯（芝士不分装）/去冰/七分糖', selected), []);
  assert.deepEqual(missingSelectedOptionRequirements('中杯（芝士不分装）/少冰/三分糖', selected), ['去冰', '7分糖']);
});

test('checkout option verification enforces the exact McDonalds bundle selections', () => {
  const selected = ['火腿巴麦满分', '脆香油条', '小杯优品豆浆'];
  assert.deepEqual(missingSelectedOptionRequirements('火腿扒麦满分/脆香油条/小杯优品豆浆', selected), []);
  assert.deepEqual(missingSelectedOptionRequirements('吉士蛋麦满分/脆薯饼/鲜萃冰咖', selected), ['火腿扒麦满分', '脆香油条', '小杯优品豆浆']);
});

test('checkout option verification enforces the exact KFC signature-bundle selections', () => {
  const selected = ['主食：劲脆鸡腿汉堡', '小食：劲爆鸡米花(小)', '甜品/小食：红豆派(1只装)', '饮料：桂花酸梅汤(大)'];
  assert.deepEqual(missingSelectedOptionRequirements('劲脆鸡腿汉堡/劲爆鸡米花(小)/红豆派(1只装)/桂花酸梅汤(大)', selected), []);
  assert.deepEqual(missingSelectedOptionRequirements('香辣鸡腿汉堡/黄金鸡块/葡式蛋挞/百事可乐', selected), ['劲脆鸡腿汉堡', '劲爆鸡米花', '红豆派', '桂花酸梅汤']);
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

test('merchant similarity accepts inserted descriptors but rejects unrelated first cards', () => {
  assert.deepEqual(merchantFromShopText('返红包 杨姥佬家de撒汤·煎饺·灌汤包(平江万达店) 评分 4.8 月售1000+'), {
    name: '杨姥佬家de撒汤·煎饺·灌汤包(平江万达店)', rating: 4.8,
  });
  assert.ok(merchantNameMatchScore('DQ冰淇淋', 'DQ·蛋糕·冰淇淋(苏州宫巷店)') >= 70);
  assert.ok(merchantNameMatchScore('兰州牛肉面', '兰州牛肉拉面(相城店)') >= 70);
  assert.equal(merchantNameMatchScore('兰州牛肉面', '手工拉面'), 0);
  assert.equal(requestedMaxDistanceKm('门店正常；距离不超过10公里'), 10);
  assert.equal(requestedMaxDistanceKm('随便选一家'), 0);
});

test('structured DQ title is assigned to its merchant row with the visible distance', () => {
  const rows = shopRowsFromVisibleText([
    { text: 'DQ·蛋糕·冰淇淋(苏州宫巷店)', x: 86, y: 94 },
    { text: '月售1000+', x: 111, y: 108 }, { text: '起送', x: 145, y: 114 },
    { text: '7.8km', x: 350, y: 114 }, { text: '52分钟', x: 310, y: 114 },
  ], 'DQ冰淇淋');
  assert.equal(rows[0].name, 'DQ·蛋糕·冰淇淋(苏州宫巷店)');
  assert.equal(rows[0].distanceKm, 7.8);
});

test('product-only retail cards keep the merchant title instead of a numeric or product preview row', () => {
  const rows = shopRowsFromVisibleText([
    { text: '综合排序', x: 16, y: 109 }, { text: '蜂鸟准时达', x: 425, y: 94 },
    { text: '淘宝便利店(苏州相城店)', x: 86, y: 85 },
    { text: '8000', x: 112, y: 96 }, { text: '起送', x: 145, y: 114 },
    { text: '3.2km', x: 350, y: 114 },
    { text: '可比克 烧烤味薯片55g/袋', x: 90, y: 243 },
  ], '');
  assert.equal(rows[0].name, '淘宝便利店(苏州相城店)');
});

test('meal brands, products, and explicit side dishes remain separate', () => {
  assert.equal(preferredBrand('曼玲粥 牛奶燕麦粥 加一个茶叶蛋'), 'manling');
  assert.equal(brandMatches('manling', '曼玲粥（测试店）'), true);
  assert.equal(requestedItemName('曼玲粥 牛奶燕麦粥 加一个茶叶蛋'), '燕麦牛奶粥');
  assert.equal(requestedMealSide('曼玲粥 牛奶燕麦粥 加一个茶叶蛋'), '茶叶蛋');
  assert.deepEqual(requestedExtraItems('茶百道 茉莉葡萄冰奶 加珍珠 少冰'), ['珍珠']);
  assert.deepEqual(requestedExtraItems('瑞幸 生椰拿铁 不加糖'), []);
  assert.deepEqual(requestedExtraItems('茶百道 葡萄冰奶；只点一杯；不足起送价时店内搜索小料且不得再加第二杯饮品'), []);
  assert.deepEqual(requestedStandaloneItems('茶百道 葡萄冰奶；不能再加另一杯奶茶；不要再加第二杯饮品'), []);
  assert.deepEqual(requestedExtraItems('不足起送价时加小料'), []);
  assert.deepEqual(requestedExtraItems('不足起送价时逐个添加不同小料'), []);
  assert.deepEqual(requestedExtraItems('不足起送价时添加其他小料'), []);
  assert.deepEqual(requestedExtraItems('不足起送价时添加任意小料'), []);
  assert.deepEqual(requestedExtraItems('不足起送价时逐个添加不同的同店小吃'), []);
  assert.deepEqual(requestedExtraItems('不足起送价时添加其他店内小吃'), []);
  assert.deepEqual(requestedExtraItems('撒汤 加冰豆浆；然后单独搜索并添加标题含冰豆浆的唯一商品'), ['冰豆浆']);
  assert.deepEqual(requestedStandaloneItems('不足起送价时回商家主页，在小料专区添加小料'), []);
  assert.deepEqual(requestedStandaloneItems('逐个添加不同且与水果饮品兼容的小料'), []);
  assert.deepEqual(requestedExtraItems('加一个茶叶蛋；再来一份薯条；配可乐'), ['茶叶蛋', '薯条', '可乐']);
  assert.equal(mealSideTopUpEligible('曼玲粥 燕麦牛奶粥'), true);
  assert.equal(mealSideTopUpEligible('瑞幸咖啡 生椰拿铁'), false);
  assert.equal(mealSideTopUpEligible('KFC 原味鸡套餐'), false);
  assert.equal(mealSideTopUpEligible('蜜雪冰城 芋圆葡萄 去商家主页面包含小料两个字的分类'), false);
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

test('historical exact and superset rules remain for drinks and coffee, while KFC never blindly repeats a historical cart', () => {
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

test('KFC starts with the signature four-item bundle and adds only uncovered explicit items', async () => {
  const query = '肯德基 汉堡 加薯条 加蛋挞 加可乐';
  assert.equal(preferredBrand(query), 'kfc');
  assert.equal(brandMatches('kfc', '肯德基（测试店）'), true);
  assert.deepEqual(requestedKfcItems(query), ['汉堡', '薯条', '蛋挞', '可乐']);
  const structured = '用户明确；门店=肯德基；商品=汉堡、薯条、鸡翅、蛋挞、可乐';
  assert.deepEqual(requestedKfcItems(structured), ['汉堡', '薯条', '鸡翅', '蛋挞', '可乐']);
  assert.equal(kfcDefaultSignatureBundleRequested(structured), true);
  assert.equal(kfcDefaultSignatureBundleRequested('用户明确；门店=肯德基；商品=招牌汉堡4件套；不得改成全家桶或重复单点套餐内商品'), true);
  assert.equal(kfcDefaultSignatureBundleRequested('肯德基 套餐里已经有的商品不要重复单点'), true);
  assert.equal(kfcDefaultSignatureBundleRequested('肯德基 单点香辣鸡腿堡'), false);
  assert.equal(kfcDefaultSignatureBundleRequested('肯德基 不要套餐，只要单点香辣鸡腿堡'), false);
  assert.equal(kfcHomepageSignatureBundle([
    { name: '【夜宵专享】美味炸鸡桶' },
    { name: '【夜宵专享】吃堡堡4件套', price: 40.9 },
    { name: '炸鸡吃堡堡双人餐' },
  ])?.name, '【夜宵专享】吃堡堡4件套');
  assert.equal(kfcHomepageSignatureBundle([{ name: '炸鸡吃堡堡双人餐' }, { name: '美味炸鸡桶' }]), null);
  assert.equal(requestedStoreItemName(structured, '肯德基'), '【夜宵专享】吃堡堡4件套');
  assert.deepEqual(requestedStandaloneItems(structured), ['汉堡', '薯条', '鸡翅', '蛋挞', '可乐']);
  assert.deepEqual(requestedStandaloneItems(structured, '招牌汉堡4件套 主食：香辣鸡腿汉堡(辣) 甜品/小食：葡式蛋挞(1只装) 饮料：百事可乐(冷/中)'), ['薯条', '鸡翅']);
  assert.equal(kfcItemCoveredByText('辣翅', '主食：香辣鸡腿汉堡(辣)'), false);
  assert.equal(kfcItemCoveredByText('辣翅', '新奥尔良辣翅'), true);
  assert.equal(kfcItemCoveredByText('香辣鸡腿堡', '主食：香辣鸡腿汉堡(辣)'), true);
  assert.equal(selectedOptionsCoverItem('香辣鸡腿堡', '主食：香辣鸡腿汉堡(辣)'), true);
  assert.equal(selectedOptionsCoverItem('脆香油条', '小食：脆香油条 饮料：小杯优品豆浆'), true);
  assert.equal(selectedOptionsCoverItem('豆浆', '小食：脆香油条 饮料：小杯优品豆浆'), true);
  assert.equal(selectedOptionsCoverItem('香芋派', '小食：脆香油条 饮料：小杯优品豆浆'), false);
  assert.deepEqual(requestedStandaloneItems(
    '麦当劳 麦满分单人餐随心选 加脆香油条 加豆浆 加香芋派',
    '小食：脆香油条 饮料：小杯优品豆浆',
  ), ['香芋派']);
  assert.equal(kfcStandaloneSearchTerm('辣翅'), '香辣鸡翅');
  assert.equal(kfcStandaloneSearchTerm('草莓圣代'), '经典草莓圣代');
  const shorthand = '用户明确；门店=肯德基；商品=脆鸡腿堡、鸡米花、红豆派、草莓圣代、酸梅汤、辣翅';
  assert.equal(requestedStoreItemName(shorthand, '肯德基'), '【夜宵专享】吃堡堡4件套');
  assert.deepEqual(requestedStandaloneItems(shorthand, '主食：劲脆鸡腿汉堡 小食：劲爆鸡米花(小) 甜品/小食：红豆派(1只装) 饮料：桂花酸梅汤(大)'), ['草莓圣代', '辣翅']);
  const spicyBundle = '用户明确；门店=肯德基；商品=香辣鸡腿堡、黄金鸡块、薯条、百事可乐、蛋挞';
  assert.deepEqual(requestedStandaloneItems(spicyBundle, '主食：香辣鸡腿汉堡(辣) 小食：黄金鸡块(5块装) 甜品/小食：薯条(中) 饮料：百事可乐(冷/中)'), ['蛋挞']);
  assert.equal(preferredExactProduct([{ name: '劲爆鸡米花(小)' }], '鸡米花')?.name, '劲爆鸡米花(小)');
  assert.equal(preferredExactProduct([{ name: '桂花酸梅汤(大)' }], '酸梅汤')?.name, '桂花酸梅汤(大)');
  assert.equal(preferredExactProduct([
    { name: '草莓桃儿白糯米酸奶奶昔', price: 24, buttonIndex: 0 },
  ], '草莓桃儿白糯米酸奶昔')?.name, '草莓桃儿白糯米酸奶奶昔');
  assert.equal(preferredExactProduct([
    { name: '草莓桃儿白糯米酸奶茶', price: 24, buttonIndex: 0 },
  ], '草莓桃儿白糯米酸奶昔'), null);
  assert.equal(preferredExactProduct([
    { name: '桂花酸梅汤(大)', buttonIndex: 7 },
    { name: '鸡茸玉米汤', buttonIndex: 9 },
  ], '汤')?.name, '桂花酸梅汤(大)');
  assert.equal(preferredExactProduct([
    { name: '乌鸡撒汤、煎饺、韭菜盒子1人套餐', buttonIndex: 3, price: 21.8 },
    { name: '撒汤多加一个鸡蛋', buttonIndex: 4, price: 2.9 },
    { name: '乌鸡撒汤/网红拇指生煎套餐', buttonIndex: 5, price: 22.7 },
  ], '撒汤', { allowShortFoodAlias: true })?.name, '乌鸡撒汤、煎饺、韭菜盒子1人套餐');
  assert.equal(preferredExactProduct([
    { name: '（招牌）营养鸡丝撒汤', buttonIndex: 1, price: 8.9 },
    { name: '乌鸡撒汤、煎饺、韭菜盒子1人套餐', buttonIndex: 2, price: 21.8 },
  ], '撒汤', { allowShortFoodAlias: true, preferSinglePersonCombo: true })?.name, '乌鸡撒汤、煎饺、韭菜盒子1人套餐');
  assert.equal(preferredExactProduct([
    { name: '撒汤多加一个鸡蛋', buttonIndex: 2, price: 2.9 },
    { name: '乌鸡撒汤、煎饺、韭菜盒子1人套餐', buttonIndex: 3, price: 21.8 },
    { name: '胡辣汤一人套餐', buttonIndex: 4, price: 20 },
  ], '撒汤套餐', { allowShortFoodAlias: true })?.name, '乌鸡撒汤、煎饺、韭菜盒子1人套餐');
  assert.equal(preferredExactProduct([{ name: '胡辣汤套餐', buttonIndex: 1 }], '撒汤'), null);
  assert.equal(kfcItemCoveredByText('汤', '饮料：桂花酸梅汤(大)'), true);
  assert.equal(preferredExactProduct([{ name: '新奥尔良辣翅(2只)' }], '辣翅')?.name, '新奥尔良辣翅(2只)');
  assert.equal(preferredExactProduct([{ name: '辣翅/烤翅(10块装)-香辣鸡翅(10块装)' }], '辣翅'), null);
  assert.equal(preferredExactProduct([
    { name: '香辣鸡翅(2块装)', price: 15.5, buttonIndex: 0 },
    { name: '香辣鸡翅(20块装)', price: 99, buttonIndex: 1 },
    { name: '辣翅/烤翅(10块装)', price: 54, buttonIndex: 2 },
    { name: '辣翅买一送一', description: '香辣鸡翅(2块装)x2', price: 15.5, buttonIndex: 3 },
  ], '辣翅')?.name, '香辣鸡翅(2块装)');
  assert.equal(kfcSignatureBundle.product, '【夜宵专享】吃堡堡4件套');
  assert.deepEqual(kfcSignatureBundle.mains, ['香辣鸡腿汉堡(辣)', '滋滋YES烤鸡腿堡', '黄金SPA鸡排堡(藤椒风味)']);
  assert.deepEqual(kfcSignatureBundle.snacks1, ['香辣鸡翅(2块装)', '【夜宵专享】生炸大鸡腿串.', '老北京鸡肉卷']);
  assert.deepEqual(kfcSignatureBundle.snacks2, ['黄金鸡块(5块装)', '薯条(中)', '劲爆鸡米花(小)', '热辣香骨鸡(3块装)']);
  const currentBundle = '用户明确；门店=肯德基；商品=门店首页现有四件套；规格=从平台当前真实可选项中选择；套餐已有商品不得重复单点';
  assert.equal(kfcDefaultSignatureBundleRequested(currentBundle), true);
  assert.equal(requestedStoreItemName(currentBundle, '肯德基'), '【夜宵专享】吃堡堡4件套');
  assert.deepEqual(requestedStandaloneItems(currentBundle, '主食：香辣鸡腿汉堡(辣) 小食1：香辣鸡翅(2块装) 小食2：黄金鸡块(5块装) 饮料：百事可乐(冷/中)'), []);
  const currentRuntimeQuery = '肯德基 门店首页当前四件套 重新测试肯德基门店首页当前四件套，不搜索套餐名 用户明确要求重新测试KFC套餐；必须直接使用门店首页当前真实四件套，不得搜索套餐名；套餐已有商品不得重复单点；只有套餐未包含的明确商品才允许店内搜索';
  assert.deepEqual(requestedStandaloneItems(currentRuntimeQuery, '主食：香辣鸡腿汉堡(辣) 小食1：香辣鸡翅(2块装) 小食2：黄金鸡块(5块装) 饮料：百事可乐(冷/中)'), []);
  const kfcSearchSource = TaobaoFlashBrowser.prototype.search.toString();
  assert.doesNotMatch(kfcSearchSource, /!mcdonaldsHomepageOnly && await this\.searchInsideShop/);
  assert.match(kfcSearchSource, /kfcHomepageOnly \? kfcHomepageSignatureBundle\(items\) : null/);
  assert.match(kfcSearchSource, /fruitHomepageFirst \|\| homepageOnly/);
  const kfcCreateSource = TaobaoFlashBrowser.prototype.createOrder.toString();
  assert.match(kfcCreateSource, /\(mcdonaldsHomepageOnly \|\| kfcHomepageOnly\) && shopSearchUrl\(page\.url\(\)\)/);
  assert.match(kfcCreateSource, /!mcdonaldsHomepageOnly && !kfcHomepageOnly && await this\.searchInsideShop/);
  assert.doesNotMatch(requestedStandaloneItems(structured).join(' '), /门店|商品|用户明确/);
  assert.equal(requestedItemName(query), '汉堡');
  assert.equal(requestedStoreItemName(query, '肯德基'), '【夜宵专享】吃堡堡4件套');
  assert.deepEqual(requestedExtraItems(query), ['薯条', '蛋挞', '可乐']);
  assert.deepEqual(requestedStandaloneItems(query), ['汉堡', '薯条', '蛋挞', '可乐']);
  assert.equal(preferredExactProduct([
    { name: '香辣鸡腿堡套餐' },
    { name: '香辣鸡腿堡' },
  ], '汉堡')?.name, '香辣鸡腿堡');
  assert.equal(preferredExactProduct([{ name: '香辣鸡腿汉堡(辣)' }], '香辣鸡腿堡')?.name, '香辣鸡腿汉堡(辣)');

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
  browser.verifyUniqueCartItems = async () => [];
  browser.optionPanel = async () => null;
  browser.visibleLocator = async locator => locator?.id === 'checkout-locator' ? { id: 'checkout' } : null;
  const result = await browser.addRequestedStandaloneItems(page, { query, itemName: '招牌汉堡4件套' }, '招牌汉堡4件套 主食：香辣鸡腿汉堡(辣) 甜品/小食：葡式蛋挞(1只装)');
  assert.deepEqual(clicks, ['薯条', '可乐']);
  assert.deepEqual(result.added, ['薯条', '可乐']);
  assert.equal(result.checkout.id, 'checkout');
});

test('KFC red-bean pie never enters the milk-tea topping flow', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const create = source.slice(source.indexOf('async createOrder({ ref'), source.indexOf('async applyAvailableCoupon('));
  assert.match(create, /const milkTeaOrder = milkTeaTopUpEligible/);
  assert.match(create, /milkTeaOrder\s*\? requestedMilkTeaToppingPreferences\(ref\.query\)\s*:\s*\{ preferred: \[\], excluded: \[\] \}/);
  assert.doesNotMatch(create, /当前商品不支持按奶茶小料流程完成明确加料要求/);
});

test('bundle selections wait for the live option sheet before confirming', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const create = source.slice(source.indexOf('async createOrder({ ref'), source.indexOf('async applyAvailableCoupon('));
  assert.match(create, /tapChoiceCard\(choice\.label\)[\s\S]{0,500}waitForSelectedChoice\(choice\.label\)/);
  assert.match(create, /if \(collectLabels\) selectedLabels\.push/);
  assert.match(create, /currentMinus && desiredPlus[\s\S]{0,700}tapChoiceStepper\(choice\.label, 'plus'\)/);
  assert.match(create, /Radio-style cards—including \+¥ surcharge choices/);
  assert.match(create, /平台没有真实选中规格/);
});

test('checkout blocks any standalone item already represented inside bundle options', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const create = source.slice(source.indexOf('async createOrder({ ref'), source.indexOf('async applyAvailableCoupon('));
  assert.match(create, /duplicatedBundleComponents/);
  assert.match(create, /selectedOptionsCoverItem\(item\?\.name, liveMain\?\.options\)/);
  assert.match(create, /又作为单品重复加入，本轮不会提交/);
});

test('McDonalds explicit dessert opens the storefront category and never submits a store search', async () => {
  const browser = new TaobaoFlashBrowser();
  const actions = [];
  const page = { url: () => 'https://h5.ele.me/2021001185671035/pages/ele-takeout-index/ele-takeout-index?shopId=mcd-1', async waitForTimeout() {} };
  browser.openStoreMenuCategory = async (_page, name) => { actions.push(`category:${name}`); return true; };
  browser.waitForPurchaseControls = async () => {};
  browser.extractMenu = async () => [{ name: '草莓麦旋风', price: 13 }];
  browser.searchInsideShop = async () => { throw new Error('麦当劳明确小食不应提交店内搜索'); };
  browser.productControl = async (_page, name) => ({ name });
  browser.activateProductControl = async (_page, control) => { actions.push(`add:${control.name}`); };
  browser.optionPanel = async () => null;
  browser.verifyUniqueCartItems = async () => [];
  browser.checkoutControl = async () => ({ id: 'checkout' });

  const result = await browser.addRequestedStandaloneItems(page, {
    merchant: '麦当劳&麦咖啡', itemName: '单人套餐',
    query: '用户明确；门店=麦当劳；商品=套餐；从小食甜品/其他添加一个草莓麦旋风',
  });

  assert.deepEqual(actions, ['category:小食甜品/其他', 'add:草莓麦旋风']);
  assert.deepEqual(result.added, ['草莓麦旋风']);
  assert.equal(result.checkout.id, 'checkout');
});

test('a bare McDonalds pie means one serving and never aliases to the two-serving product', () => {
  const menu = [
    { name: '香芋派2份', price: 17, buttonIndex: 0 },
    { name: '香芋派(1份)', price: 9, buttonIndex: 1 },
    { name: '菠萝派2份', price: 17, buttonIndex: 2 },
    { name: '菠萝派', price: 9, buttonIndex: 3 },
  ];
  assert.equal(preferredExactProduct(menu, '香芋派')?.name, '香芋派(1份)');
  assert.equal(preferredExactProduct(menu.slice(0, 1), '香芋派'), null);
  assert.equal(preferredExactProduct(menu, '香芋派2份')?.name, '香芋派2份');
  assert.equal(preferredExactProduct(menu, '菠萝派')?.name, '菠萝派');
  assert.equal(preferredExactProduct(menu.slice(0, 3), '菠萝派'), null);
  assert.equal(preferredExactProduct(menu, '菠萝派2份')?.name, '菠萝派2份');
});

test('checkout rejects any missing requested item even when the order amount is already sufficient', () => {
  const query = '肯德基 汉堡 加薯条 加蛋挞 加可乐';
  const missing = checkoutCartState('确认订单 香辣鸡腿堡 × 1 ¥21 薯条 × 1 ¥12 蛋挞 × 1 ¥8 合计¥41', '香辣鸡腿堡', query);
  assert.equal(missing.matches, false);
  assert.deepEqual(missing.missing, ['可乐']);
  const complete = checkoutCartState('确认订单 香辣鸡腿堡 × 1 ¥21 薯条 × 1 ¥12 蛋挞 × 1 ¥8 可乐 × 1 ¥9 合计¥50', '香辣鸡腿堡', query);
  assert.equal(complete.matches, true);
  const platformAliases = checkoutCartState('确认订单 香辣鸡腿汉堡(辣) × 1 ¥23.5 中薯 × 1 ¥12 新奥尔良烤翅 × 1 ¥16 原味蛋挞 × 1 ¥8 百事可乐(中) × 1 ¥9 合计¥68.5', '香辣鸡腿汉堡(辣)', query, 1, {
    requiredItems: ['香辣鸡腿汉堡(辣)', '薯条(中)', '鸡翅', '蛋挞', '百事可乐(冷/中)'],
  });
  assert.equal(platformAliases.matches, true);
  assert.equal(checkoutCartState('确认订单 汉堡套餐 × 1 ¥39 合计¥39', '汉堡', '肯德基 汉堡').matches, false);
});

test('checkout accepts the real single-fruit title selected by the platform', () => {
  const state = checkoutCartState(
    '确认订单 【超值单品】麒麟西瓜果切200g × 1 ¥0.99 合计¥0.99',
    '鲜切西瓜200g',
  );
  assert.equal(state.matches, true);
  assert.deepEqual(state.missing, []);
  assert.equal(checkoutCartState('确认订单 西瓜芒果双拼 × 1 ¥18 合计¥18', '鲜切西瓜').matches, false);
});

test('fruit servings are pure, watermelon is at most 500g, others at most 250g, and promotional singles win', () => {
  assert.equal(fruitServingWeightGrams('鲜切芒果150g'), 150);
  assert.equal(fruitServingWeightGrams('麒麟西瓜 0.3kg'), 300);
  assert.equal(fruitServingWeightGrams('半个麒麟西瓜约3斤'), 1500);
  assert.equal(fruitServingEligible('橙子果切250g'), true);
  assert.equal(fruitServingEligible('西瓜果切500g'), true);
  assert.equal(fruitServingEligible('西瓜果切501g'), false);
  assert.equal(fruitServingEligible('芒果果切251g'), false);
  assert.equal(fruitServingEligible('麒麟西瓜桶（含桶约200g）'), false);
  assert.equal(fruitServingEligible('芒果夹乌梅150g'), false);
  assert.equal(fruitServingEligible('【爆品】大口吃芒果果切.150g'), false);
  assert.equal(fruitServingEligible('鲜切西瓜'), false);
  const chosen = preferredExactProduct([
    { name: '鲜切西瓜250g', price: 8.9, buttonIndex: 0 },
    { name: '【超值单品】西瓜果切200g', description: '相邻卡片还有西瓜桶1000g', price: 0.99, buttonIndex: 4 },
    { name: '麒麟西瓜桶1000g', price: 15.8, buttonIndex: 1 },
  ], '西瓜');
  assert.equal(chosen?.name, '【超值单品】西瓜果切200g');
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
  browser.verifyUniqueCartItems = async () => [];
  browser.optionPanel = async () => null;
  browser.visibleLocator = async locator => locator?.id === 'checkout-locator' ? checkout : null;

  const result = await browser.topUpWithMealSide(page, { merchant: '曼玲粥', itemName: '燕麦牛奶粥', query: '曼玲粥 牛奶燕麦粥 加一个茶叶蛋' }, '茶叶蛋');

  assert.deepEqual(result.added, ['茶叶蛋']);
  assert.equal(result.checkout, checkout);
  assert.deepEqual(clicks, ['茶叶蛋']);
  assert.deepEqual(searches, []);
});

test('short meal-side requests accept decorated single-item names but never bundles', () => {
  assert.equal(shortFoodTitleAliasEligible('杨姥姥 撒汤套餐'), true);
  assert.equal(shortFoodTitleAliasEligible('茶百道 清提茉莉 不额外加糖'), false);
  assert.equal(shortFoodTitleAliasEligible('瑞幸 生椰拿铁'), false);
  assert.equal(storeSearchTermMatches('https://h5.ele.me/pages/ele-index-search?keyword=%E6%92%92%E6%B1%A4', '撒汤'), true);
  assert.equal(storeSearchTermMatches('https://h5.ele.me/pages/ele-index-search?keyword=%E6%9D%A8%E5%A7%A5%E5%A7%A5', '撒汤'), false);
  assert.equal(requestedSinglePersonSoupCombo('店内只搜撒汤；候选必须点一人套餐', '撒汤'), true);
  assert.equal(requestedSinglePersonSoupCombo('店内只搜撒汤，不说套餐', '撒汤'), false);
  assert.equal(preferredExactProduct([
    { name: '五香茶叶蛋1个', price: 4.9 },
    { name: '茶叶蛋2份组合', price: 8.8 },
  ], '茶叶蛋', { allowContainedAlias: true })?.name, '五香茶叶蛋1个');
  assert.equal(preferredExactProduct([{ name: '圆葱牛肉饼', price: 8.9 }], '牛肉饼', { allowContainedAlias: true })?.name, '圆葱牛肉饼');
  assert.equal(preferredExactProduct([{ name: '土家酱香饼', price: 8.9 }], '酱香饼', { allowContainedAlias: true })?.name, '土家酱香饼');
  assert.equal(preferredExactProduct([{ name: '现烤酥皮梅干菜烧饼', price: 6.9 }], '烧饼', { allowContainedAlias: true, allowShortFoodAlias: true })?.name, '现烤酥皮梅干菜烧饼');
  assert.equal(preferredExactProduct([{ name: '清提茉莉奶绿', price: 12 }], '茉莉', { allowContainedAlias: true }), null);
  assert.equal(preferredExactProduct([{ name: '酱香饼2份套餐', price: 15 }], '酱香饼', { allowContainedAlias: true }), null);
});

test('structured meal items cannot be replaced by conversational intent text or generic top-up', async () => {
  const canonical = '曼玲粥 皮蛋瘦肉粥 加茶叶蛋 加酱香饼';
  assert.deepEqual(requestedStandaloneItems(canonical), ['茶叶蛋', '酱香饼']);
  assert.deepEqual(
    requestedStandaloneItems(`${canonical} 明确商品清单为皮蛋瘦肉粥一份；加茶叶蛋一份；加酱香饼一个`),
    ['茶叶蛋', '酱香饼'],
  );
  const wrongCart = checkoutCartState(
    '确认订单 招牌皮蛋瘦肉粥 × 1 ¥14.9 杭州小笼包一笼5个 × 1 ¥6.9 合计¥25.3',
    '皮蛋瘦肉粥', canonical,
  );
  assert.equal(wrongCart.matches, false);
  assert.deepEqual(wrongCart.missing, ['茶叶蛋', '酱香饼']);
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const search = source.slice(source.indexOf('async search(query'), source.indexOf('async offerOptions('));
  assert.match(search, /\[query, intentText\]\.filter\(Boolean\)\.join\(' '\)/);
  assert.doesNotMatch(search, /intentText \|\| query/);
});

test('standalone meal sides pass the visible full platform title to the add-button locator', async () => {
  assert.deepEqual(standaloneItemSpecIntent('大份酱香饼'), {
    requestedName: '大份酱香饼', productName: '酱香饼', requiredOption: '大份',
  });
  assert.deepEqual(standaloneItemSpecIntent('茶叶蛋'), {
    requestedName: '茶叶蛋', productName: '茶叶蛋', requiredOption: '',
  });
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('async addRequestedStandaloneItems('), source.indexOf('async createOrder({ ref'));
  assert.match(method, /locator\('\[class\*="menuItem--info-title"\]'\)/);
  assert.match(method, /preferredExactProduct\(visibleNames\.map\(name => \(\{ name, price: 1 \}\)\), productName/);
  assert.ok(method.indexOf('const actualName =') > method.indexOf('visibleNames.map'));
  assert.match(method, /this\.productControl\(page, actualName\)/);
  assert.match(method, /getByText\(specIntent\.requiredOption, \{ exact: true \}\)/);
  assert.match(method, /平台没有真实选中单品/);
});

test('a below-minimum storefront resumes the verified main item before any checkout click', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('async useExistingCartIfMatching('), source.indexOf('async createRepeatPurchaseOrder('));
  const thresholdGuard = method.indexOf('let explicitlyBelowMinimum =');
  assert.ok(thresholdGuard >= 0);
  assert.match(method, /for \(let attempt = 0; attempt < 7; attempt \+= 1\)/);
  assert.match(method, /storefrontBody = await page\.locator\('body'\)\.innerText/);
  assert.match(method, /\(\?:还差\|差\).*起送/);
  assert.ok(method.indexOf('return { resumeBelowMinimum: true', thresholdGuard) > thresholdGuard);
  assert.ok(method.indexOf('await this.tapControl(page, checkout)') > thresholdGuard);
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

test('a verified store-local result can be persisted as the exact product route', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-search-route-'));
  try {
    const browser = new TaobaoFlashBrowser({ profile });
    await browser.rememberKnownRoute({
      query: '茶百道 茉莉奶绿', merchant: '茶百道(测试店)', merchantId: 'tea-search-1', itemName: '茉莉奶绿',
      shopUrl: 'https://h5.ele.me/2021001185671035/pages/ele-index-search/ele-index-search?restaurant_id=tea-search-1&shopId=tea-search-1',
    });
    const route = await new TaobaoFlashBrowser({ profile }).knownRoute('茶百道 茉莉奶绿');
    assert.match(route.shopUrl, /pages\/ele-index-search/);
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test('a persisted store-local result is accepted as a saved in-shop context', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const enter = source.slice(source.indexOf('async enterShop('), source.indexOf('async dismissPromoOverlays('));
  assert.match(enter, /preferSaved && shopSearchUrl\(page\.url\(\)\)/);
  assert.match(enter, /if \(shopSearchUrl\(page\.url\(\)\)\) \{\s*shop\.directUrl = page\.url\(\)/);
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

test('a complete distinctive product keyword survives campaign prefixes without accepting a bundle', () => {
  const prefixed = preferredExactProduct([
    { name: '【自选巧拼】自选水果拼盘500g', price: 26.9 },
    { name: '西瓜切盒', price: 12.9 },
  ], '水果拼盘');
  assert.equal(prefixed?.name, '【自选巧拼】自选水果拼盘500g');
  assert.equal(preferredExactProduct([{ name: '水果拼盘双人套餐', price: 39.9 }], '水果拼盘'), null);
  assert.equal(preferredExactProduct([
    { name: '切盒脆甜哈密瓜200克', price: 12.9, buttonIndex: 0 },
    { name: '大6拼任性选果盘', price: 65, buttonIndex: 1 },
    { name: '（大4拼）四拼果切任你选约680克', price: 32, buttonIndex: 2 },
  ], '水果拼盘')?.name, '大6拼任性选果盘');
  assert.equal(preferredExactProduct([
    { name: '爆款混合果切300克（随机切）', price: 14.8 },
  ], '水果拼盘')?.name, '爆款混合果切300克（随机切）');
  assert.equal(preferredExactProduct([
    { name: '切盒哈密瓜250克', price: 9.8 },
    { name: '切盒甜桃+龙眼双拼组合', price: 29 },
  ], '水果拼盘'), null);
});

test('individual cut-fruit requests stay separate and reject mixed platters', () => {
  const query = '呱果森林(相城店) 西瓜 加芒果 加橙子';
  assert.equal(requestedStoreItemName(query, '呱果森林(相城店)'), '西瓜');
  assert.deepEqual(requestedStandaloneItems(query), ['芒果', '橙子']);
  assert.equal(preferredExactProduct([
    { name: '麒麟西瓜+脆甜哈密瓜', buttonIndex: 0 },
    { name: '【超值单品】鲜切麒麟西瓜200g', price: .99, buttonIndex: 1 },
    { name: '麒麟西瓜桶1000g', price: 15.8, buttonIndex: 2 },
  ], '西瓜')?.name, '【超值单品】鲜切麒麟西瓜200g');
  assert.equal(preferredExactProduct([
    { name: '芒果拼拼', buttonIndex: 0 },
    { name: '【鲜切】水仙芒果切 200g', buttonIndex: 1 },
  ], '芒果')?.name, '【鲜切】水仙芒果切 200g');
  assert.equal(preferredExactProduct([
    { name: '橙子+苹果双拼组合', buttonIndex: 0 },
    { name: '【鲜切】赣南脐橙果切250g', buttonIndex: 1 },
  ], '橙子')?.name, '【鲜切】赣南脐橙果切250g');
  assert.equal(preferredExactProduct([{ name: '酷熊缤纷混合果切' }], '西瓜'), null);
  assert.equal(fruitTopUpEligible('呱果森林 西瓜 加芒果 加橙子'), true);
});

test('explicit fruit first opens the homepage promotion category without submitting a search', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const search = source.slice(source.indexOf('async search(query'), source.indexOf('async offerOptions('));
  assert.match(search, /fruitHomepageFirst\) await this\.openFruitPromotionCategory\(page\)/);
  assert.match(search, /fruitHomepageFirst\) await this\.openFruitPromotionCategory\(activePage\)/);
  assert.match(search, /fruitHomepageFirst\) await this\.openFruitPromotionCategory\(shopPage\)/);
  const promotion = source.slice(source.indexOf('async openFruitPromotionCategory('), source.indexOf('async topUpWithSavedItems('));
  assert.match(promotion, /openStoreMenuCategory\(page, '超值单品任选一件'\)/);
  assert.match(promotion, /openStoreMenuCategory\(page, '活动商品'\)/);
  assert.doesNotMatch(promotion, /searchInsideShop/);
});

test('single-fruit cart lookup uses the fruit keyword while rejecting mixed products', () => {
  assert.equal(singleFruitKeyword('【现切大份】鲜切麒麟西瓜500g'), '西瓜');
  assert.equal(singleFruitKeyword('【冰镇】麒麟西瓜果切.500g'), '西瓜');
  assert.equal(singleFruitKeyword('赣南脐橙鲜切盒'), '橙子');
  assert.equal(singleFruitKeyword('西瓜芒果双拼果切'), '');
  assert.equal(singleFruitKeyword('水果捞组合'), '');
});

test('retail fruit controls accept bracketed promotional titles through the qualified keyword path', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const productControl = source.slice(source.indexOf('async productControl('), source.indexOf('async productTitle('));
  assert.match(productControl, /replace\(\/\^【\[\^】\]\{1,30\}】\\s\*\/u, ''\)/);
  assert.ok(productControl.indexOf("replace(/^【[^】]{1,30}】\\s*/u, '')") < productControl.indexOf("replace(/[【[].*$/, '')"));
  assert.match(productControl, /!text\.includes\(name\) && !fruitTitleMatches\(text\)/);
  assert.match(productControl, /\|\| fruitTitleMatches\(text\)/);
  assert.match(productControl, /accessibleFruitTitles/);
  assert.match(productControl, /exactRetailTitles/);
  assert.match(productControl, /canonicalTitle\(item\.label\) === targetTitle/);
  assert.match(productControl, /closest\.distance <= 120/);
  assert.match(productControl, /data-phone-delivery-binding', 'exact-title-row'/);
  assert.match(productControl, /strictFruitTitle: Boolean\(singleFruitKeyword\(itemName\) && fruitServingWeightGrams\(itemName\) > 0\)/);
  assert.match(productControl, /if \(strictFruitTitle\) return canonicalTitle\(value\) === targetTitle/);
  assert.match(productControl, /getAttribute\('aria-label'\)/);
  assert.match(productControl, /closest\.distance <= 160/);
});

test('explicit fruit lists cannot randomly top up without a broad choice grant', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const create = source.slice(source.indexOf('async createOrder({ ref'), source.indexOf('async applyAvailableCoupon('));
  assert.match(create, /const randomMainChoiceAuthorized =/);
  assert.match(create, /fruitOrder && !randomMainChoiceAuthorized/);
  assert.match(create, /你没有授权随机添加其他水果/);
  assert.ok(create.indexOf('fruitOrder && !randomMainChoiceAuthorized') < create.indexOf('topUpWithFruitItems'));
});

test('an explicitly requested snack pack accepts inserted descriptors but a single snack does not', () => {
  const pack = '快递发货乐事薯片原味12g*32小包装整箱休闲小吃办公室解馋大礼包零食';
  assert.equal(productMatchesSavedItem(pack, '薯片大礼包'), true);
  assert.equal(preferredExactProduct([{ name: pack, price: 28 }], '薯片大礼包')?.name, pack);
  assert.equal(productMatchesSavedItem(pack, '薯片'), false);
  assert.equal(productMatchesSavedItem('饼干办公室解馋大礼包', '薯片大礼包'), false);
  assert.equal(preferredExactProduct([
    { name: '百草味素食零食大礼包土豆片', price: 21.2 },
    { name: '乐事无限原味薯片90g', price: 8.9 },
  ], '薯片')?.name, '乐事无限原味薯片90g');
  assert.equal(preferredExactProduct([
    { name: '乐事美国经典原味薯片70g', price: 7.5 },
    { name: '好丽友薯片45g', price: 5 },
  ], '薯片')?.name, '乐事美国经典原味薯片70g');
  assert.equal(preferredExactProduct([
    { name: '可比克烧烤味小罐装薯片45g', price: 5.5 },
    { name: '乐事得克萨斯烧烤味薯片70g', price: 7.4 },
    { name: '乐事经典原味薯片70g', price: 7.4 },
  ], '烧烤味薯片')?.name, '可比克烧烤味小罐装薯片45g');
  assert.equal(preferredExactProduct([
    { name: '【一桶水果捞】超大份秘制豪华水果捞1000ml', price: 35.8, buttonIndex: 0 },
    { name: '【10种纯水果】秘制爆款水果捞', price: 22.8, buttonIndex: 1 },
  ], '水果捞')?.name, '【一桶水果捞】超大份秘制豪华水果捞1000ml');
  assert.equal(preferredExactProduct([
    { name: '乐事得克萨斯烧烤味薯片70g', price: 7.4, buttonIndex: 1 },
    { name: '可比克烧烤味罐装薯片105g', price: 8.5, buttonIndex: 0 },
  ], '烧烤味薯片')?.name, '可比克烧烤味罐装薯片105g');
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
  assert.equal(requestedStoreItemName('杨姥姥家 营养鸡丝糊汤', '杨姥姥家'), '营养鸡丝糊汤');
  assert.equal(preferredExactProduct([{ name: '（招牌）营养鸡丝撒汤' }], '营养鸡丝撒汤')?.name, '（招牌）营养鸡丝撒汤');
  assert.equal(preferredExactProduct([{ name: '手工兰州牛肉拉面' }], '兰州牛肉面')?.name, '手工兰州牛肉拉面');
  assert.equal(preferredExactProduct([{ name: '冰吸生椰拿铁推荐装' }], '生椰拿铁'), null);
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

test('global merchant search escapes a stale store-local search before using the merchant keyword', async () => {
  const browser = new TaobaoFlashBrowser();
  const localSearch = { url: () => 'https://h5.ele.me/2021001185671035/pages/ele-index-search/ele-index-search?keyword=%E4%B8%89%E7%B1%B3%E7%B2%A5%E9%93%BA' };
  const home = { url: () => 'https://h5.ele.me/' };
  const globalSearch = { url: () => 'https://h5.ele.me/search/?keyword=%E4%B8%89%E7%B1%B3%E7%B2%A5%E9%93%BA' };
  const pages = [localSearch, home, globalSearch];
  const urls = [];
  browser.goto = async url => { urls.push(url); return pages.shift(); };

  const page = await browser.openMarketplaceSearch('三米粥铺');

  assert.equal(page, globalSearch);
  assert.deepEqual(urls, [
    'https://h5.ele.me/search/?keyword=%E4%B8%89%E7%B1%B3%E7%B2%A5%E9%93%BA',
    'https://h5.ele.me/',
    'https://h5.ele.me/search/?keyword=%E4%B8%89%E7%B1%B3%E7%B2%A5%E9%93%BA',
  ]);
});

test('an explicit store search excludes an unrelated sponsored card and enters the highest matching merchant', async () => {
  const browser = new TaobaoFlashBrowser();
  const searchPage = { url: () => 'https://h5.ele.me/search/?keyword=grandma', waitForTimeout: async () => {} };
  const shopPage = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=grandma-1' };
  browser.knownRoute = async () => null;
  browser.knownRoutesFor = async () => [];
  browser.goto = async () => searchPage;
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  browser.extractShops = async (_page, storeQuery) => {
    assert.equal(storeQuery, '杨姥姥家');
    return [
      { index: 0, name: '蜂鸟准时达', storeId: 'grandma-1', deliveryFee: 0.3, freeDeliveryThreshold: 0, etaMinutes: 25, rating: 4.8, monthlySales: 5000, couponLabel: '' },
      { index: 1, name: '杨姥姥家另一分店', storeId: 'grandma-2', deliveryFee: 2.7, freeDeliveryThreshold: 0, etaMinutes: 40, rating: 4.8, monthlySales: 1000, couponLabel: '' },
    ];
  };
  let entered = -1;
  browser.enterShop = async index => { entered = browser.shops[index].index; return shopPage; };
  browser.repeatPurchase = async () => null;
  browser.extractMenu = async () => [{ name: '营养鸡丝糊汤', description: '营养鸡丝糊汤 ¥8.9', price: 8.9, buttonIndex: 3 }];
  browser.searchInsideShop = async () => true;

  const offers = await browser.search('杨姥姥家 营养鸡丝糊汤', 4, { allowGlobalSearch: true, storeQuery: '杨姥姥家' });

  assert.equal(entered, 1);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].name, '营养鸡丝糊汤');
});

test('custom-component text nodes reconstruct the visible merchant card', () => {
  const leaves = [
    { text: '茶百道(相城中环百汇店)', x: 109, y: 92 },
    { text: '月售 4000+', x: 120, y: 113 },
    { text: '起送¥22', x: 185, y: 113 },
    { text: '配送约¥2.6', x: 250, y: 113 },
    { text: '25分钟 3.1km', x: 360, y: 113 },
    { text: '豆乳米麻薯', x: 220, y: 260 },
    { text: '纳百汇(百货 鞋服 箱包 相城店)', x: 120, y: 388 },
    { text: '月售39+', x: 120, y: 409 },
    { text: '起送¥49', x: 185, y: 409 },
  ];
  const shops = shopRowsFromVisibleText(leaves, '茶百道(相城中环百汇店)');
  assert.equal(shops.length, 2);
  assert.equal(shops[0].name, '茶百道(相城中环百汇店)');
  assert.match(shops[0].previewText, /豆乳米麻薯/);
  assert.equal(shops[0].anchorY, 113);
});

test('merchant extraction reads titles rendered only by structured rich-text nodes', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const extract = source.slice(source.indexOf('async extractShops('), source.indexOf('async enterShop('));
  assert.match(extract, /tiga-rich-text\[nodes\]/);
  assert.match(extract, /JSON\.parse\(rich\.getAttribute\('nodes'\)/);
  assert.match(extract, /value\.type === 'text'/);
});

test('entering a marketplace shop clicks its structured merchant title before coordinate fallbacks', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const enter = source.slice(source.indexOf('async enterShop('), source.indexOf('async dismissPromoOverlays('));
  assert.match(enter, /tiga-rich-text\[nodes\]/);
  assert.ok(enter.indexOf('tapControl(page, merchantTitle)') < enter.indexOf('const cardYs'));
  assert.ok(enter.indexOf('plainMerchantTitle') < enter.indexOf('const cardYs'));
  assert.match(enter, /if \(!shopUrl\(page\.url\(\)\)\) \{\s*const cardYs/);
});

test('a product-only search scans visible cards and enters the card that exposes the requested item', async () => {
  const browser = new TaobaoFlashBrowser();
  const searchPage = { url: () => 'https://h5.ele.me/search/?keyword=noodles', waitForTimeout: async () => {} };
  const shopPage = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=noodles-2' };
  browser.knownRoute = async () => null;
  browser.knownRoutesFor = async () => [];
  browser.goto = async () => searchPage;
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  browser.extractShops = async () => [
    { index: 0, name: '山野板扎云贵川菜', previewText: '毛辣果空心菜', deliveryFee: 88, freeDeliveryThreshold: 0, etaMinutes: 180, rating: 0, monthlySales: 1, couponLabel: '' },
    { index: 1, name: '实验小学面馆', previewText: '手工兰州牛肉拉面 牛肉拌面', deliveryFee: 5.1, freeDeliveryThreshold: 0, etaMinutes: 15, rating: 4.7, monthlySales: 900, couponLabel: '' },
    { index: 2, name: '兰州牛肉面(含景店)', previewText: '手工兰州牛肉拉面 牛肉拌面', deliveryFee: 5.1, freeDeliveryThreshold: 0, etaMinutes: 15, rating: 4.7, monthlySales: 200, couponLabel: '' },
  ];
  let entered = -1;
  browser.enterShop = async index => { entered = browser.shops[index].index; return shopPage; };
  browser.repeatPurchase = async () => null;
  browser.extractMenu = async () => [{ name: '手工兰州牛肉拉面', description: '店内商品', price: 19.6, buttonIndex: 2 }];
  browser.searchInsideShop = async () => true;

  const offers = await browser.search('兰州牛肉面', 1, { allowGlobalSearch: true });

  assert.equal(entered, 2,'a high title match must outrank an earlier preview-only match and an unrelated first card');
  assert.equal(offers[0].merchant, '兰州牛肉面(含景店)');
  assert.equal(offers[0].name, '手工兰州牛肉拉面');
});

test('a product-only search waits for late structured merchant cards instead of issuing another search', async () => {
  const browser = new TaobaoFlashBrowser();
  const searchPage = { url: () => 'https://h5.ele.me/minisearch/result?keyword=cake', waitForTimeout: async () => {} };
  const shopPage = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=cake-1' };
  browser.knownRoute = async () => null;
  browser.knownRoutesFor = async () => [];
  browser.goto = async () => searchPage;
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  let reads = 0;
  browser.extractShops = async () => {
    reads += 1;
    if (reads <= 12) return [];
    return [{ index: 0, name: '月野现烤蛋糕', previewText: '巧克力巴斯克芝士蛋糕', deliveryFee: 0, freeDeliveryThreshold: 0, etaMinutes: 15, rating: 4.7, monthlySales: 300, couponLabel: '' }];
  };
  browser.enterShop = async () => shopPage;
  browser.repeatPurchase = async () => null;
  browser.extractMenu = async () => [{ name: '巧克力巴斯克芝士蛋糕', description: '店内商品', price: 25, buttonIndex: 0 }];
  browser.searchInsideShop = async () => false;

  const offers = await browser.search('巧克力蛋糕', 1, { allowGlobalSearch: true });

  assert.equal(reads, 13);
  assert.equal(offers[0].merchant, '月野现烤蛋糕');
  assert.equal(offers[0].name, '巧克力巴斯克芝士蛋糕');
});

test('entering a later marketplace card clicks its own header instead of the previous card', async () => {
  const browser = new TaobaoFlashBrowser();
  const outerUrl = 'https://h5.ele.me/minisearch/result?keyword=noodles';
  let currentUrl = outerUrl;
  const taps = [];
  const page = {
    url: () => currentUrl,
    waitForTimeout: async () => {},
    locator: () => ({ innerText: async () => '' }),
  };
  browser.searchUrl = outerUrl;
  browser.shops = [{ index: 1, name: '兰州牛肉面(含景店)', anchorY: 520 }];
  browser.ensure = async () => page;
  browser.tapPoint = async (_page, x, y) => {
    taps.push({ x, y });
    if (y >= 500) currentUrl = 'https://h5.ele.me/newretail/p/ushop/?store_id=noodles-2';
  };
  browser.dismissPromoOverlays = async () => {};
  browser.waitForPurchaseControls = async () => {};

  await browser.enterShop(0);

  assert.equal(taps[0].y, 520);
  assert.equal(new URL(currentUrl).searchParams.get('store_id'), 'noodles-2');
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

test('autonomous role selection reads the current menu without submitting a store search', async () => {
  const browser = new TaobaoFlashBrowser();
  const active = {
    isClosed: () => false,
    url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=mixue-1',
    locator: () => ({ innerText: async () => '商家 蜜雪冰城（测试店） 热销' }),
  };
  browser.page = active;
  browser.assertRiskCooldown = async () => {};
  browser.knownRoute = async () => null;
  browser.knownRoutesFor = async () => [];
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  let repeats = 0; let searches = 0;
  browser.repeatPurchase = async () => { repeats += 1; return null; };
  browser.searchInsideShop = async () => { searches += 1; return true; };
  browser.extractMenu = async () => [
    { name: '桃之夭夭-4杯装', price: 28, description: '桃之夭夭-4杯装 ¥28', buttonIndex: 1 },
    { name: '棒打鲜橙', price: 8, description: '棒打鲜橙 ¥8', buttonIndex: 2 },
    { name: '珍珠奶茶', price: 9, description: '珍珠奶茶 ¥9', buttonIndex: 3 },
  ];
  browser.goto = async () => { throw new Error('outer search must not run'); };

  const offers = await browser.search('蜜雪冰城 随便点一杯饮品', 4, {
    allowGlobalSearch: false, storeQuery: '蜜雪冰城', menuSelectionAllowed: true,
  });

  assert.deepEqual(offers.map(item => item.name), ['棒打鲜橙', '珍珠奶茶']);
  assert.equal(searches, 0);
  assert.equal(repeats, 0);
  assert.match(offers[0].browserRef.query, /棒打鲜橙/);
});

test('checkout submission applies an available red packet before clicking payment', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const submit = source.slice(source.indexOf('async submitOrder('), source.indexOf('async orderStatus('));
  assert.ok(submit.indexOf('applyBestAvailableCoupon(page)') < submit.indexOf('checkoutSubmitControl(page)'));
  assert.match(submit, /riskCheck\(page/);
  assert.match(submit, /resolveCheckoutUtensils\(page\)/);
  assert.doesNotMatch(submit, /getByText\('无需餐具'/);
  assert.match(submit, /getByText\(\/\^付款\$\//);
  assert.match(submit, /没有到达支付宝“付款”页面/);
  assert.match(submit, /checkoutSubmitControl\(page\)/);
  assert.match(source, /async checkoutSubmitControl\(page\)[\s\S]*?for \(let wait = 0; wait < 12; wait \+= 1\)/);
  assert.match(source, /async resolveCheckoutUtensils\(page\)[\s\S]*?\^需要餐具，商家依据餐量提供\$[\s\S]*?平台餐具面板没有关闭/);
  assert.match(source, /async applyBestAvailableCoupon\(page\)[\s\S]*?attempt < 16[\s\S]*?initialState\.status !== 'unknown'/);
  assert.match(source, /async selectEarliestDeliveryWindow\(page\)[\s\S]*?const windows = page\.getByText[\s\S]*?windows\.nth\(index\)/);
  assert.ok(submit.indexOf('selectEarliestDeliveryWindow(page)') < submit.indexOf('applyBestAvailableCoupon(page)'));
  assert.match(source, /const couponCards = page\.locator\('\.shtc-base-coupon__wrap'\)/);
  assert.match(source, /entry\.evaluate\(node => node\.click\(\)\)/);
  assert.match(source, /不可用原因\|已失效/);
  assert.match(source, /attempt < 16 && !directCoupon/);
  assert.match(source, /已选\\s\*\[1-9\]/);
  assert.match(source, /directCoupon\.getByText\(\/\^\(\?:选择\|使用\|立即使用/);
  assert.match(source, /couponCardSelected\(directCoupon\)/);
  assert.doesNotMatch(source, /alreadySelected \|\| Boolean\(directCoupon\)/);
  assert.match(source, /确认使用\|选好了/);
  assert.match(source, /立即兑换\|确认兑换\|兑换并使用\|确认使用/);
  assert.match(source, /吃货豆不足\|余额不足\|兑换失败/);
  assert.match(source, /const redeemPointsCouponIfPrompted = async \(coupon, \{ afterConfirm = false \} = \{\}\) =>/);
  assert.match(source, /hasUnredeemedPointsOffer[\s\S]*?未兑换\\s\*\(\?:需\|需要\)[\s\S]*?directCoupon/);
  assert.match(source, /directRequiresPoints \? directCoupon/);
  assert.match(source, /promptAlreadyOpen[\s\S]*?if \(!promptAlreadyOpen\) await this\.tapControl/);
  assert.match(source, /平台红包页暂时异常[\s\S]*?不会重复打开或按原价提交/);
  assert.match(source, /平台红包页没有保持打开[\s\S]*?不会重复打开或按原价提交/);
  assert.match(source, /afterConfirm && expectPointsPrompt/);
  assert.match(source, /extendedPromptWait \? 40 : 8/);
  assert.match(source, /extendedPromptWait \? 44 : 24/);
  assert.match(source, /attempt < maxPromptAttempts[\s\S]*?selectedAt[\s\S]*?attempt - selectedAt >= promptWaitAttempts/);
  assert.match(source, /redeemPointsCouponIfPrompted\(directCoupon, \{ afterConfirm: true \}\)[\s\S]*?finalDone/);
  assert.match(source, /redeem\.evaluate\(node => node\.click\(\)\)[\s\S]*?attempt < 32[\s\S]*?兑换成功\|已成功兑换\|兑换完成/);
  assert.match(source, /redeemPointsCouponIfPrompted\(directCoupon\)[\s\S]*?if \(!alreadySelected\)/);
  assert.ok(source.indexOf('redeemPointsCouponIfPrompted(directCoupon)') < source.indexOf('const done = await this.visibleLocator(page.getByText(/^(?:确定'));
  assert.match(submit, /\['applied', 'none'\]\.includes\(couponCheck\?\.status\)/);
  assert.match(submit, /缺少本单提交前的优惠券核验记录/);
  assert.match(source, /renderedLocator\(nativeControls\)/);
  assert.match(submit, /alreadyAtPaymentSelection/);
  assert.match(submit, /waitForPaymentSelection\(page, beforePages\)/);
  assert.match(source, /async advancePaymentSelection\(page\)[\s\S]*?\^支付宝\$[\s\S]*?\^确认支付\$/);
  assert.match(source, /async waitForPaymentSelection\(page, beforePages = new Set\(\)\)[\s\S]*?12_000[\s\S]*?advancePaymentSelection\(candidate\)/);
  assert.match(source, /_____tmd_____[\s\S]*?隐式安全验证/);
  assert.doesNotMatch(source, /riskBlockReason !== '隐式安全验证'/);
  assert.match(source, /continue immediately without a fixed timer/);
  assert.match(source, /Date\.now\(\) - this\.lastStoreSearchAt < 30_000/);
  assert.match(source, /const searchGap = 3_000/);
  assert.match(source, /Do not reject a result that finished painting at the deadline/);
  assert.match(source, /历史搜索[\s\S]*?猜你想搜[\s\S]*?field\.press\('Enter'\)/);
  assert.match(source, /this is not a second keyword or a new search task/);
  assert.match(source, /retailCardWrapper = allowTopRows && \/cardWrapper\/i/);
  assert.match(source, /text\.split\(\/买过\\s\*\\d\+\\s\*次\|\[¥￥\]\//);
  assert.match(source, /price: retailPrices\[0\] \|\| 0/);
  assert.match(source, /const fruitHomepageFirst = Boolean\(singleFruitKeyword\(routeItemQuery\)\)/);
  assert.match(source, /\(fruitHomepageFirst \|\| homepageOnly\) && shopSearchUrl\(page\.url\(\)\)[\s\S]*?returnToStorefrontWithoutRefresh\(page\)/);
  assert.match(source, /activePage && \(fruitHomepageFirst \|\| homepageOnly\) && shopSearchUrl\(activePage\.url\(\)\)[\s\S]*?returnToStorefrontWithoutRefresh\(activePage\)/);
  assert.match(source, /forceMerchantEntry[\s\S]*?normal bounded merchant/);
  assert.match(source, /dismissCloseableRiskOverlay\(page, visibleKind\)[\s\S]*?riskRetry < 1[\s\S]*?waitForTimeout\(3_000\)/);
  assert.match(source, /async readCheckoutDraft\(page[\s\S]*?展开\|查看全部[\s\S]*?tapControl\(page, expandItems\)/);
  const milkTeaTopUp = source.slice(source.indexOf('async topUpWithSavedItems('), source.indexOf('async topUpWithMealSnacks('));
  assert.match(milkTeaTopUp, /openStoreMenuCategory\(page, '加小料区'\)/);
  assert.match(milkTeaTopUp, /categoryOnly: true/);
  assert.doesNotMatch(milkTeaTopUp, /searchInsideShop\(/);
});

test('coupon checkout inspection has explicit applied, none, available, and unknown states', () => {
  assert.deepEqual(couponCheckoutState('确认订单 商品金额 25 闪购红包 -¥ 6.5 合计¥18.5', 'https://h5.ele.me/checkout'), {
    status: 'applied', amount: 6.5, evidence: 'checkout_applied_discount',
  });
  assert.deepEqual(couponCheckoutState('确认订单 商品金额 25 闪购红包 无可用红包 合计¥25', 'https://h5.ele.me/checkout'), {
    status: 'none', amount: 0, evidence: 'checkout_explicit_none',
  });
  assert.deepEqual(couponCheckoutState('确认订单 商品金额 25 未选红包，最高10元可用 合计¥25', 'https://h5.ele.me/checkout'), {
    status: 'available', amount: 10, evidence: 'checkout_available_coupon',
  });
  assert.deepEqual(couponCheckoutState('确认订单 商品金额 25 配送费 2 合计¥27', 'https://h5.ele.me/checkout'), {
    status: 'none', amount: 0, evidence: 'checkout_scanned_no_offer',
  });
  assert.equal(couponCheckoutState('加载中', 'https://h5.ele.me/loading').status, 'unknown');
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

test('option inspection keeps an exact homepage card without opening store-local search', async () => {
  const browser = new TaobaoFlashBrowser();
  const page = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=luckin-1' };
  browser.ensure = async () => page;
  browser.goto = async () => page;
  browser.riskCheck = async () => 0;
  browser.waitForPurchaseControls = async () => true;
  const queries = [];
  browser.searchInsideShop = async (_page, query) => { queries.push(query); return true; };
  let controlReads = 0;
  browser.productControl = async () => { controlReads += 1; return { id: 'exact-product-control' }; };
  browser.inspectOptionsControl = async (_page, button) => button.id === 'exact-product-control' ? [{ name: '糖度' }] : [];
  browser.rememberKnownRoute = async () => {};

  const groups = await browser.inspectOptionsFor({
    itemName: '杨枝甘露', shopUrl: page.url(), query: '古茗 杨枝甘露 少糖',
  });

  assert.deepEqual(queries, []);
  assert.equal(controlReads, 1);
  assert.deepEqual(groups, [{ name: '糖度' }]);
});

test('option inspection opens store-local search only when the homepage lacks the exact item', async () => {
  const browser = new TaobaoFlashBrowser();
  const page = { url: () => 'https://h5.ele.me/newretail/p/ushop/?store_id=tea-1' };
  browser.ensure = async () => page;
  browser.riskCheck = async () => 0;
  browser.waitForPurchaseControls = async () => {};
  const queries = [];
  browser.searchInsideShop = async (_page, query) => { queries.push(query); return true; };
  let reads = 0;
  browser.productControl = async () => ++reads === 1 ? null : ({ id: 'searched-control' });
  browser.inspectOptionsControl = async (_page, button) => button.id === 'searched-control' ? [{ name: '辣度' }] : [];
  browser.rememberKnownRoute = async () => {};

  const groups = await browser.inspectOptionsFor({ shopUrl: page.url(), itemName: '兰州牛肉面' });

  assert.deepEqual(queries, ['兰州牛肉面']);
  assert.equal(reads, 2);
  assert.deepEqual(groups, [{ name: '辣度' }]);
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

test('store result extraction reads exact product titles including visible sticky recommendation cards', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(source, /node\.querySelector\('\.menuItem--info-title'\)/);
  assert.match(source, /node\.classList\?\.contains\('cell__props'\)/);
  assert.match(source, /box\.y <= 20/);
  assert.match(source, /}, shopSearchUrl\(page\.url\(\)\)\)/);
});

test('a visible matching restaurant title survives an empty custom title wrapper', () => {
  assert.equal(menuCardName('', '茉莉葡萄冰奶 7天内50人下单 月售 200+ ¥ 15 起 选规格'), '茉莉葡萄冰奶');
  assert.equal(menuCardName('选规格', '茉莉葡萄冰奶 月售 200+ ¥ 15 起 选规格'), '茉莉葡萄冰奶');
  assert.equal(preferredExactProduct([{ name: '茉莉葡萄冰奶', price: 15, buttonIndex: 27 }], '葡萄冰奶', { allowContainedAlias: true })?.name, '茉莉葡萄冰奶');
  assert.equal(preferredExactProduct([{ name: '茉莉葡萄冰奶推荐装', price: 20 }], '葡萄冰奶', { allowContainedAlias: true }), null);
});

test('a visible matching product is reread in place without another search', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('const wantedKey = comparableProductKey(itemQuery)'), source.indexOf('for (const item of exactItems)'));
  assert.match(block, /reread < 2/);
  assert.match(block, /visibleKey\.includes\(wantedKey\)/);
  assert.doesNotMatch(block, /searchInsideShop|openMarketplaceSearch|enterShop/);
});

test('restaurant store search never enters the retail accessibility-card parser', () => {
  assert.equal(retailShopSearchUrl('https://h5.ele.me/2021001185671035/pages/ele-index-search/ele-index-search'), false);
  assert.equal(retailShopSearchUrl('https://h5.ele.me/newretail/p/ushopsearch/?store_id=1'), true);
});

test('restaurant search controls cannot masquerade as product titles', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const extract = source.slice(source.indexOf('async extractMenu('), source.indexOf('async searchInsideShop('));
  assert.match(extract, /选规格\|选套餐\|加入购物车/);
  assert.ok(extract.indexOf('accessibleNameNode') < extract.indexOf("node.querySelector('.menuItem--info-title')"));
});

test('sticky recommendation controls bind only to their own product card', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const locator = source.slice(source.indexOf('async productControl('), source.indexOf('async productTitle('));
  assert.match(locator, /control\.node\.closest\('\.cell__props'\)/);
  assert.match(locator, /cell\?\.querySelector\('\.cell__props-name'\)/);
  assert.match(locator, /parentControls\.length !== 1/);
  assert.match(locator, /const exactCardTitle =/);
  assert.match(locator, /if \(!exactCardTitle\) continue/);
  assert.doesNotMatch(locator, /for \(let depth = 0; parent && depth < 6/);
});

test('a store-local result keeps its live result URL for later options and cart actions', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const activeBlock = source.slice(source.indexOf('let activePage ='), source.indexOf('if (!allowGlobalSearch'));
  const globalBlock = source.slice(source.indexOf('const offers = [];'), source.indexOf('return offers;'));
  assert.match(activeBlock, /shopUrl: activePage\.url\(\)/);
  assert.match(globalBlock, /shopUrl: shopPage\.url\(\)/);
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

test('a remembered shop never pins an older sku over the current first qualified match', async () => {
  const browserSource = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const rememberedBlock = browserSource.slice(browserSource.indexOf('for (const rememberedRoute'), browserSource.indexOf('// If the user already has'));
  assert.match(browserSource, /const routeItemQuery = requestedStoreItemName\(query, storeQuery\)/);
  assert.match(rememberedBlock, /let item = preferredExactProduct\(items, routeItemQuery, \{ allowContainedAlias: searchedInsideShop, allowShortFoodAlias, preferSinglePersonCombo \}\)[\s\S]*?items\.find\(row => productMatchesSavedItem\(row\.name, rememberedRoute\.itemName\)\)/);
  assert.match(rememberedBlock, /searchInsideShop\(page, routeItemQuery\)/);
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

test('unresolved image captcha stops once and persists only while the challenge remains visible', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'phone-delivery-risk-timeout-'));
  try {
    let challenged = true;
    const frame = { locator: () => ({ innerText: async () => challenged ? '请选择符合描述的所有图片' : '肯德基 汉堡 炸鸡 可乐 蛋挞 薯条' }) };
    const page = { frames: () => [frame], async waitForTimeout() {}, async bringToFront() {} };
    const browser = new TaobaoFlashBrowser({ profile, headless: false });
    await assert.rejects(browser.riskCheck(page, { waitForHuman: true, maxWaitMs: 1 }), /等待本人完成验证已超时.*不会自动重复搜索/);
    const persisted = new TaobaoFlashBrowser({ profile });
    persisted.page = page;
    await assert.rejects(persisted.assertRiskCooldown(), /验证状态仍存在时不会自动重搜/);
    challenged = false;
    await persisted.assertRiskCooldown();
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

test('only an explicit user confirmation can invoke the manual risk-state clear endpoint', async () => {
  const browser = new FakeBrowser();
  let clears = 0;
  browser.confirmRiskClearedByUser = async () => { clears += 1; return { cleared: true }; };
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });

  await assert.rejects(adapter.handle('confirm_risk_cleared', { confirmedByUser: false }), /必须由本人确认/);
  assert.equal(clears, 0);
  assert.deepEqual(await adapter.handle('confirm_risk_cleared', { confirmedByUser: true }), { cleared: true });
  assert.equal(clears, 1);
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
    query: '用户明确；门店=瑞幸咖啡；商品=生椰拿铁', orderIntent: { merchant: '瑞幸咖啡', items: ['生椰拿铁'] }, task: roleTask(), roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved-address-fingerprint', allowGlobalSearch: true, limit: 3,
  }, { target: 'yb_test' });
  assert.equal(result.offers[0].name, '生椰拿铁');
  assert.equal(addressReads, 0);
  assert.deepEqual(searchOptions, { allowGlobalSearch: true, storeQuery: '瑞幸咖啡', intentText: '用户明确；门店=瑞幸咖啡；商品=生椰拿铁', menuSelectionAllowed: false, searchResultSelectionAllowed: false, forceMerchantEntry: false });
});

test('one authorized task is idempotent and specifications never enter either search term', async () => {
  let searches = 0; let seenQuery = ''; let seenOptions = null;
  const browser = {
    async search(query, _limit, options) { searches += 1; seenQuery = query; seenOptions = options; return [{ merchantId: 'tea-1', merchant: '茶百道', name: '茉莉葡萄冰奶', price: 18, total: 18, browserRef: {} }]; },
  };
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const task = roleTask({ intentSummary: '茶百道 / 茉莉葡萄冰奶' });
  const payload = { query: '茶百道 茉莉葡萄冰奶 不加糖 少冰', orderIntent: { merchant: '茶百道', items: ['茉莉葡萄冰奶'] }, task, roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved', allowGlobalSearch: true };
  const first = await adapter.handle('search', payload, { target: 'yb_test' });
  const second = await adapter.handle('search', payload, { target: 'yb_test' });
  assert.equal(searches, 1);
  assert.equal(first.offers[0].offerId, second.offers[0].offerId);
  assert.equal(seenQuery, '茶百道 茉莉葡萄冰奶');
  assert.deepEqual(seenOptions, { allowGlobalSearch: true, storeQuery: '茶百道', intentText: '茶百道 茉莉葡萄冰奶 不加糖 少冰', menuSelectionAllowed: false, searchResultSelectionAllowed: false, forceMerchantEntry: false });
  assert.doesNotMatch(seenQuery + seenOptions.storeQuery, /少冰|无糖|大杯|热饮/);
  assert.match(seenOptions.intentText, /不加糖|少冰/);
});

test('terminal and expired role tasks cannot be restored', async () => {
  const adapter = new DeliveryAdapter({ browser: new FakeBrowser(), secret: '12345678901234567890123456789012' });
  const base = { query: '用户明确；门店=瑞幸；商品=生椰拿铁', orderIntent: { merchant: '瑞幸', items: ['生椰拿铁'] }, roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved' };
  for (const status of ['completed', 'canceled', 'failed', 'expired']) {
    await assert.rejects(adapter.handle('search', { ...base, task: roleTask({ taskId: `terminal-${status}`, status }) }, { target: 'yb_test' }), /不能恢复/);
  }
  await assert.rejects(adapter.handle('search', { ...base, task: roleTask({ taskId: 'old-task', createdAt: Date.now() - 31 * 60_000 }) }, { target: 'yb_test' }), /已过期/);
});

test('a failed search may resume the same task under one newer clarification revision', async () => {
  let searches = 0;
  const browser = new FakeBrowser();
  browser.search = async () => {
    searches += 1;
    if (searches === 1) throw new Error('真实平台没有返回可下单商品');
    return [{ merchantId: 'meal-1', merchant: '曼玲粥', name: '五香茶叶蛋1个', price: 4.9, total: 4.9, browserRef: {} }];
  };
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const context = { target: 'yb_test' };
  const task = roleTask({ taskId: 'clarify-product-name', authorizationConstraints: '我想吃营养鸡丝撒汤', userConstraints: '我想吃营养鸡丝撒汤' });
  const base = { query: '用户明确；门店=曼玲粥；商品=茶叶蛋', orderIntent: { merchant: '曼玲粥', items: ['茶叶蛋'] }, roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved' };
  await assert.rejects(adapter.handle('search', { ...base, task }, context), /没有返回可下单商品/);
  const resumed = await adapter.handle('search', { ...base, task: { ...task, revision: 2, status: 'running', userConstraints: '我想吃营养鸡丝撒汤\n名称含撒汤就点第一个' } }, context);
  assert.equal(resumed.offers[0].name, '五香茶叶蛋1个');
  assert.equal(searches, 2);
});

test('clarification cannot mutate the original authorization or skip task revisions', async () => {
  const browser = new FakeBrowser();
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const context = { target: 'yb_test' };
  const base = { query: '用户明确；门店=杨姥姥；商品=撒汤', orderIntent: { merchant: '杨姥姥', items: ['撒汤'] }, roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved' };
  const task = roleTask({ taskId: 'clarify-guard', authorizationConstraints: '我要营养鸡丝撒汤', userConstraints: '我要营养鸡丝撒汤' });
  await adapter.handle('search', { ...base, task }, context);
  await assert.rejects(adapter.handle('search', { ...base, task: { ...task, revision: 1, userConstraints: '偷偷换商品' } }, context), /同一角色点单修订不能改变用户约束/);
  await assert.rejects(adapter.handle('search', { ...base, task: { ...task, revision: 3, userConstraints: '名称含撒汤就点第一个' } }, context), /澄清修订不连续/);
  await assert.rejects(adapter.handle('search', { ...base, task: { ...task, revision: 2, authorizationConstraints: '伪造的新授权', userConstraints: '名称含撒汤就点第一个' } }, context), /与原始回合不一致/);
});

test('a current-turn structured autonomous action is a valid authorization source', async () => {
  let searchOptions = null;
  const browser = new FakeBrowser();
  browser.search = async (_query, _limit, options) => {
    searchOptions = options;
    return [{ merchantId: 'kfc-1', merchant: '肯德基', name: '原味鸡', price: 39, deliveryFee: 3, total: 42, browserRef: {} }];
  };
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const result = await adapter.handle('search', {
    query: '主动关心；门店=肯德基；商品=原味鸡', orderIntent: { merchant: '肯德基', items: ['原味鸡'] },
    task: roleTask({ taskId: 'autonomous-1', authorizationSource: 'role_current_turn', intentSummary: '肯德基 / 原味鸡', autonomous: true }),
    roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved',
  }, { target: 'yb_test' });
  assert.equal(result.offers.length, 1);
  assert.equal(searchOptions.menuSelectionAllowed, true);
});

test('an explicit broad choice lets the current task select from the live merchant menu', async () => {
  let searchOptions = null;
  const browser = new FakeBrowser();
  browser.search = async (_query, _limit, options) => {
    searchOptions = options;
    return [{ merchantId: 'guming-1', merchant: '古茗', name: '苦尽柑来拿铁', price: 21, deliveryFee: 0, total: 21, browserRef: {} }];
  };
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const task = roleTask({ taskId: 'explicit-broad-1', intentSummary: '古茗 / 任意单杯饮品' });
  const result = await adapter.handle('search', {
    query: '用户明确；门店=古茗；商品=奶茶；普通奶茶测试，当前门店任意单杯在售饮品均可',
    orderIntent: { merchant: '古茗', items: ['奶茶'] }, task,
    roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved', allowGlobalSearch: true,
  }, { target: 'yb_test' });
  assert.equal(result.offers[0].name, '苦尽柑来拿铁');
  assert.equal(task.authorizationSource, 'user_explicit');
  assert.equal(searchOptions.menuSelectionAllowed, false);
  assert.equal(searchOptions.searchResultSelectionAllowed, true);
});

test('authorized fruit constraints remove forbidden candidates before a quote is created', async () => {
  let intentText = '';
  const browser = new FakeBrowser();
  browser.search = async (_query, _limit, options) => {
    intentText = options.intentText;
    return [
      { merchantId: 'fruit-1', merchant: '鲜果店', name: '香蕉切果', price: 9, total: 9, browserRef: {} },
      { merchantId: 'fruit-1', merchant: '鲜果店', name: '鲜切西瓜', price: 10, total: 10, browserRef: {} },
    ];
  };
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const result = await adapter.handle('search', {
    query: '用户明确；门店=鲜果店；商品=水果', orderIntent: { merchant: '鲜果店', items: ['水果'] },
    task: roleTask({ taskId: 'fruit-exclusion-1', intentSummary: '鲜果店 / 随机水果', autonomous: true, userConstraints: '除了香蕉不要点，其他都可以' }),
    roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved', allowGlobalSearch: true,
  }, { target: 'yb_test' });
  assert.match(intentText, /除了香蕉不要点/);
  assert.deepEqual(result.offers.map(offer => offer.name), ['鲜切西瓜']);
});

test('broad explicit selection scans live in-shop results and skips double drinks', async () => {
  const browser = new TaobaoFlashBrowser();
  const shopPage = { url: () => 'https://h5.ele.me/2021001185671035/pages/ele-takeout-index/ele-takeout-index' };
  browser.assertRiskCooldown = async () => {};
  browser.openMarketplaceSearch = async () => ({
    url: () => 'https://h5.ele.me/2021001185671035/pages/ele-index-search/ele-index-search',
    locator: () => ({ innerText: async () => '古茗(水韵花都店)' }),
    waitForTimeout: async () => {},
  });
  browser.requireLogin = async () => {};
  browser.riskCheck = async () => 0;
  browser.extractShops = async () => [{ index: 0, name: '古茗(水韵花都店)', storeId: 'guming-1', deliveryFee: 0, freeDeliveryThreshold: 22 }];
  browser.enterShop = async () => shopPage;
  const searches = [];
  browser.searchInsideShop = async (_page, value) => { searches.push(value); return true; };
  browser.extractMenu = async () => [
    { name: '【古茗原创】双杯苦尽柑来拿铁', price: 42, buttonIndex: 0 },
    { name: '苦尽柑来拿铁', price: 21, buttonIndex: 1 },
  ];
  const offers = await browser.search('古茗 奶茶', 8, {
    allowGlobalSearch: true, storeQuery: '古茗', intentText: '古茗什么都可以，排除双杯',
    searchResultSelectionAllowed: true,
  });
  assert.deepEqual(searches, ['奶茶']);
  assert.deepEqual(offers.map(offer => offer.name), ['苦尽柑来拿铁']);
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
  assert.equal(manual.couponCheckStatus, 'none'); assert.equal(manual.couponCheckEvidence, 'checkout_explicit_none');
  await adapter.handle('pay_order', { orderId: created.orderId, automatic: false, clientRequestId: 'pay-a' }, context);
  assert.equal(browser.submits, 1, 'retries with the same payment request id must not submit twice');
});

test('repeating create_order for the same task revision never creates a second cart', async () => {
  const browser = new FakeBrowser(); let creates = 0;
  const originalCreate = browser.createOrder.bind(browser);
  browser.createOrder = async input => { creates += 1; return originalCreate(input); };
  const adapter = new DeliveryAdapter({ browser, secret: '12345678901234567890123456789012' });
  const context = { target: 'yb_test' };
  const task = roleTask({ taskId: 'create-once' });
  const search = await adapter.handle('search', {
    query: '用户明确；门店=肯德基；商品=原味鸡', orderIntent: { merchant: '肯德基', items: ['原味鸡'] },
    task, roleId: 'role-1', addressLabel: '家', addressFingerprint: 'approved',
  }, context);
  const payload = { offerId: search.offers[0].offerId, quoteId: search.offers[0].quoteId, selectedOptions: { drink: 'cola' }, task, roleId: 'role-1' };
  const first = await adapter.handle('create_order', { ...payload, clientRequestId: 'create-a' }, context);
  const second = await adapter.handle('create_order', { ...payload, clientRequestId: 'create-b' }, context);
  assert.equal(creates, 1);
  assert.equal(first.orderId, second.orderId);
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

test('a new option-sensitive task rebuilds an unsubmitted cart instead of inheriting stale bundle choices', async () => {
  const browser = new TaobaoFlashBrowser();
  const page = {
    locator: () => ({ first: () => ({ getAttribute: async () => '购物车总计金额 ¥39.9' }) }),
  };
  browser.checkoutControl = async () => ({ id: 'checkout' });
  browser.cleanupCartItem = async (_name, options) => {
    assert.deepEqual(options, { clearAll: true });
    return { cartAmount: 0 };
  };
  const result = await browser.useExistingCartIfMatching(page, { itemName: '招牌汉堡4件套' }, 1, {
    replaceMismatchedCart: true,
    requiredOptionLabels: ['饮料：桂花酸梅汤(大)'],
  });
  assert.equal(result, null);
});

test('retail checkout thumbnail rows validate every selected item and expose extras', () => {
  const names = ['可比克烧烤味薯片105g', '乐事原味薯片70g', '海苔脆片'];
  const raw = names.map(name => `${name} × 1 ¥0`).join('\n');
  const exact = checkoutCartState(raw, names[0], '', 1, { requiredItems: names });
  assert.equal(exact.matches, true);
  const extra = checkoutCartState(`${raw}\n锅巴 × 1 ¥0`, names[0], '', 1, { requiredItems: names });
  assert.equal(extra.matches, false);
  assert.equal(extra.extraRows, 1);
});

test('retail order submission rechecks cart membership and clicks the exact submit node', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const submit = source.slice(source.indexOf('async submitOrder('), source.indexOf('async orderStatus('));
  assert.match(submit, /await assertRetailCartUnchanged\(\)/);
  assert.match(submit, /button\.evaluate\(node => node\.click\(\)\)/);
  assert.match(submit, /不会把换购或其他商品混入订单/);
});

test('checkout stops if any explicitly forbidden fruit survives into the final cart', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(source, /const excludedFruits = requestedFruitExclusions\(ref\.query\)/);
  assert.match(source, /订单确认页包含明确禁止的水果/);
});

test('only an authorized role task may replace a mismatched unsubmitted cart', async () => {
  const adapterSource = await fs.readFile(new URL('../src/adapter.mjs', import.meta.url), 'utf8');
  const browserSource = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  assert.match(adapterSource, /replaceMismatchedCart: Boolean\(taskId\)/);
  assert.match(browserSource, /if \(!replaceMismatchedCart \|\| !mismatch\) throw error/);
  assert.match(browserSource, /const cleared = await this\.cleanupCartItem\(ref\.itemName, \{ clearAll: true \}\)/);
  assert.match(browserSource, /\[aria-label="清空购物车"\]/);
  assert.match(browserSource, /cleared\.cartAmount !== 0/);
  assert.match(browserSource, /readSelectedCartItems\(page\)[\s\S]*?cleanupCartItem\(ref\.itemName, \{ clearAll: true \}\)[\s\S]*?页面隐藏的旧购物车/);
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

test('payment status reloads the existing cashier before reading the platform receipt', async () => {
  const source = await fs.readFile(new URL('../src/taobao-flash-browser.mjs', import.meta.url), 'utf8');
  const reader = source.slice(source.indexOf('async orderStatus('), source.indexOf('async diagnostic('));
  assert.match(reader, /browserOrderRef\?\.stage === 'cashier'/);
  assert.match(reader, /await this\.riskCheck\(page\);[\s\S]*?await page\.reload\(\{ waitUntil: 'domcontentloaded' \}\)/);
  assert.match(reader, /支付成功\|付款成功\|已支付/);
  assert.doesNotMatch(reader, /openMarketplaceSearch|searchWithinStore|submitOrder/);
});
