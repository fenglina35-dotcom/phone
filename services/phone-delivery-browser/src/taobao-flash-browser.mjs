import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MSITE = 'https://h5.ele.me/';
const ADDRESS_URL = 'https://h5.ele.me/minisite/pages-poi/address/index';
const clean = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const number = value => Number(String(value ?? '').match(/[\d.]+/)?.[0] || 0);
const groupHeading = /^(规格|套餐|杯型|份量|容量|温度|冰度|糖度|甜度|口味|辣度|咖啡豆|奶油|咖啡浓度|(?:推荐)?(?:加料|小料|配料).{0,40}|酱料|做法|主食\d*|小食\d*|甜品(?:\/小食)?|小食\/甜品|饮料|赠送|全鸡|配餐|蘸酱)(?:\s*[（(]?(?:请选|请选择|任选)\s*\d+\s*(?:份|种)[）)]?)?$/;
const shopUrl = url => /newretail\/p\/ushop|pages\/ele-takeout-index/i.test(String(url || ''));
const shopSearchUrl = url => /pages\/ele-index-search/i.test(String(url || ''));

export function sameShopUrl(currentUrl, targetUrl) {
  try {
    const current = new URL(String(currentUrl || ''));
    const target = new URL(String(targetUrl || ''));
    if (current.href === target.href) return true;
    if (!shopUrl(current.href) || !shopUrl(target.href)) return false;
    for (const key of ['shopId', 'store_id', 'restaurant_id']) {
      const left = clean(current.searchParams.get(key), 120);
      const right = clean(target.searchParams.get(key), 120);
      if (left && right) return left === right;
    }
    return current.origin === target.origin && current.pathname === target.pathname;
  } catch {
    return false;
  }
}

const optionPanelNoise = /^(?:已选\s*[:：]?|价格计算中|选规格|选套餐|请选择|请选|确定|取消|加入购物车|数量|猜你喜欢|温馨小贴士)$/;

export function normalizeOptionPanelGroups(value = []) {
  const groups = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const originalName = clean(raw?.name, 80);
    if (!originalName) continue;
    const rawChoices = (Array.isArray(raw?.choices) ? raw.choices : []).map(label => clean(label, 80)).filter(Boolean);
    const hint = [originalName, ...rawChoices].map(label => label.match(/(?:请选|请选择|任选)\s*(\d+)\s*(?:份|种)/)).find(Boolean);
    const selectionCount = Math.max(1, Math.min(20, Number(hint?.[1]) || 1));
    const choices = [...new Set(rawChoices.filter(label => {
      if (optionPanelNoise.test(label)) return false;
      if (/^(?:请选|请选择|任选)\s*\d+\s*(?:份|种)$/.test(label)) return false;
      if (/^(?:已选\s*[:：]?.*|价格(?:计算中|待计算)|共\s*\d+\s*件)$/.test(label)) return false;
      return !/^[+×xX]$/.test(label);
    }))];
    if (!choices.length) continue;
    const baseName = clean(originalName.replace(/[（(]?(?:请选|请选择|任选)\s*\d+\s*(?:份|种)[）)]?/g, ''), 60) || '规格';
    groups.push({
      name: selectionCount > 1 ? `${baseName}（请选择${selectionCount}份）` : baseName,
      choices,
      multiple: raw?.multiple === true || selectionCount > 1,
      selectionCount,
    });
  }
  return groups;
}

export function riskChallengeKind(value) {
  const body = clean(value, 12_000);
  if (/请选择符合描述的所有图片|没有新图片可以点后.*提交|请选择所有.*图片/i.test(body)) return '图片验证';
  if (/滑块|安全验证|请完成验证|访问过于频繁|验证码/i.test(body)) return '安全验证';
  return '';
}

export function shopClosedReason(value) {
  const body = clean(value, 12_000);
  const match = body.match(/(?:休息中(?:\s*明天?\s*\d{1,2}(?::\d{2})?\s*开始营业)?|已打烊|本店休息|商家休息|暂停营业|不在营业时间|今日已休息)/i);
  return clean(match?.[0], 80);
}

export function productMatchesSavedItem(candidateName, savedItemName) {
  const candidateText = clean(candidateName, 240);
  const targetText = clean(savedItemName, 160);
  const candidate = knownRouteKey(candidateName);
  const target = knownRouteKey(savedItemName);
  if (!candidate || !target) return false;
  // A single requested drink must never be satisfied by a bundle merely
  // because the bundle title contains the same drink name.  The user may ask
  // for a bundle explicitly; only then is a bundle candidate eligible.
  const bundle = /(?:双杯|两杯|2杯|套餐|组合|买一送一|\+|＋)/i;
  if (!bundle.test(targetText) && bundle.test(candidateText)) return false;
  return candidate === target || candidate.includes(target);
}

export function preferredExactProduct(items, itemName) {
  const targetText = clean(itemName, 160);
  const targetKey = knownRouteKey(itemName);
  const chosen = (Array.isArray(items) ? items : [])
    .filter(item => productMatchesSavedItem(item?.name, itemName))
    .map((item, index) => {
      const name = clean(item?.name, 240);
      const key = knownRouteKey(name);
      const rank = name.startsWith(targetText) ? 0 : key === targetKey ? 1 : 2;
      return { item, index, rank, length: name.length };
    })
    .sort((left, right) => left.rank - right.rank || left.length - right.length || left.index - right.index)[0];
  if (chosen && chosen.rank <= 1) return chosen.item;
  // A user may intentionally leave the exact KFC single item to the role
  // ("汉堡、薯条、蛋挞、可乐").  In that case choose a real single item from
  // the requested category, but never let a combo/bucket masquerade as it.
  const categoryPatterns = {
    '汉堡': /(?:汉堡|鸡腿堡|牛肉堡|鳕鱼堡|虾堡|田园堡)/,
    '薯条': /薯条/,
    '蛋挞': /蛋挞/,
    '可乐': /可乐/,
    '鸡翅': /鸡翅/,
    '原味鸡': /原味鸡/,
  };
  const category = categoryPatterns[targetText];
  if (!category) return null;
  const bundle = /(?:双杯|两杯|2杯|套餐|组合|买一送一|全家桶|多人餐|双人餐|三人餐|四人餐|桶餐|拼盘|\+|＋)/i;
  return (Array.isArray(items) ? items : [])
    .filter(item => category.test(clean(item?.name, 240)) && !bundle.test(clean(item?.name, 240)))
    .map((item, index) => ({ item, index, length: clean(item?.name, 240).length }))
    .sort((left, right) => left.length - right.length || left.index - right.index)[0]?.item || null;
}

export function preferredBrand(value) {
  const query = clean(value, 120);
  if (/曼玲粥/i.test(query)) return 'manling';
  if (/茶百道|cha\s*pa\s*dao/i.test(query)) return 'chabaidao';
  if (/瑞幸(?:咖啡)?|luckin/i.test(query)) return 'luckin';
  if (/喜茶|heytea/i.test(query)) return 'heytea';
  if (/霸王茶姬|chagee/i.test(query)) return 'chagee';
  if (/奈雪/i.test(query)) return 'nayuki';
  if (/肯德基|\bkfc\b/i.test(query)) return 'kfc';
  return '';
}

export function brandMatches(brand, value) {
  const name = clean(value, 120);
  if (brand === 'manling') return /曼玲粥/i.test(name);
  if (brand === 'chabaidao') return /茶百道|cha\s*pa\s*dao/i.test(name);
  if (brand === 'luckin') return /瑞幸(?:咖啡)?|luckin/i.test(name);
  if (brand === 'heytea') return /喜茶|heytea/i.test(name);
  if (brand === 'chagee') return /霸王茶姬|chagee/i.test(name);
  if (brand === 'nayuki') return /奈雪/i.test(name);
  if (brand === 'kfc') return /肯德基|\bkfc\b/i.test(name);
  return false;
}

export function activeShopMatchesBrand(query, url, body = '') {
  const brand = preferredBrand(query);
  if (!brand) return true;
  let decodedUrl = String(url || '');
  try { decodedUrl = decodeURIComponent(decodedUrl); } catch {}
  return brandMatches(brand, `${decodedUrl} ${clean(body, 12_000)}`);
}

export function knownRouteKey(value) {
  return clean(value, 160).toLowerCase()
    .replace(/(?:无糖|零糖|不加糖|少糖|微糖|半糖|全糖|正常糖|不(?:额外|另外)加糖|少冰|少少冰|去冰|正常冰|多冰|热饮|冷饮|常温|大杯|中杯|小杯)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function requestedKfcItems(value) {
  const source = clean(value, 300);
  if (!/(?:肯德基|\bkfc\b)/i.test(source)) return [];
  const stripped = source
    .replace(/(?:肯德基|\bkfc\b)/gi, ' ')
    .replace(/(?:帮我|给我|想吃|要吃|来点|点一份|点一些|随便点|单点|单品)/g, ' ');
  const items = stripped.split(/[\s，,、；;和与]+/u)
    .map(item => clean(item.replace(/^(?:再来|加|配|还有)(?:一个|一份)?/u, ''), 60))
    .filter(item => item && !/^(?:不要|不加|少|多|无糖|零糖|常温|热|冰|去冰|微辣|中辣|特辣)/.test(item));
  return [...new Set(items)];
}

export function requestedItemName(value) {
  const kfcItems = requestedKfcItems(value);
  if (kfcItems.length) return kfcItems[0];
  const source = clean(value, 160);
  const stripped = source
    .replace(/(?:曼玲粥|茶百道|cha\s*pa\s*dao|瑞幸(?:咖啡)?|luckin|喜茶|heytea|霸王茶姬|chagee|奈雪(?:的茶)?|肯德基|kfc|麦当劳|星巴克|库迪(?:咖啡)?|manner)/gi, ' ')
    .replace(/(?:加|再来|配)(?:一个|一份)?\s*(?:茶叶蛋)/g, ' ')
    .replace(/(?:无糖|零糖|不加糖|少少甜|少糖|微糖|半糖|全糖|正常糖|不(?:额外|另外)加糖|少冰|少少冰|去冰|正常冰|多冰|热饮|冷饮|常温|大杯|中杯|小杯|不加冰|不要香菜|不要辣|微辣|中辣|特辣|不加奶油|椰乳|燕麦奶|加珍珠|加料)/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/牛奶燕麦粥/g, '燕麦牛奶粥');
  return stripped || source;
}

export function requestedMealSide(value) {
  return requestedExtraItems(value).find(item => /茶叶蛋/.test(item)) || '';
}

export function requestedExtraItems(value) {
  const kfcItems = requestedKfcItems(value);
  if (kfcItems.length) return kfcItems.slice(1);
  const source = clean(value, 240);
  const items = [...source.matchAll(/(?<!不)(?:加|再来|配)(?:一个|一份)?\s*([^\s，,、；;]{1,24})/gu)]
    .map(match => clean(match[1], 60))
    .filter(item => item && !/^(?:糖|冰|热|温|奶油|椰乳|燕麦奶|辣|香菜)/.test(item));
  return [...new Set(items)];
}

export function requestedStandaloneItems(value) {
  const kfcItems = requestedKfcItems(value);
  if (kfcItems.length) return kfcItems.slice(1);
  const modifiers = /^(?:珍珠|椰果|冻冻|奶冻|芋圆|西米|布丁|仙草|红豆|椰奶冻|脆啵啵|麻薯|糖|冰|热|温|奶油|椰乳|燕麦奶|浓缩|辣|香菜)$/;
  return requestedExtraItems(value).filter(item => !modifiers.test(item));
}

export function repeatPurchaseMatchKind(raw, itemName, request = '') {
  const body = clean(raw, 4000);
  const target = clean(itemName, 140);
  if (!body || !target || !/买过|再来一单/.test(body) || !productMatchesSavedItem(body, target)) return 'none';
  const query = clean(request, 300);
  // KFC requests are intentionally assembled one single item at a time.  A
  // historical "再来一单" may contain a combo or unrequested goods and must
  // never short-circuit the explicit item checklist.
  if (requestedKfcItems(query).length) return 'none';
  const requestedExtras = requestedExtraItems(query);
  if (requestedExtras.some(item => !productMatchesSavedItem(body, item))) return 'none';
  // “再来一单” repeats the whole historical cart.  An exact cart can be used
  // immediately; a superset (for example porridge + tea egg + an old beef pie)
  // remains a valid candidate but must be confirmed by the user first.
  const historicalCount = Number(body.match(/共\s*(\d+)\s*件/)?.[1]) || 0;
  const expectedCount = 1 + requestedExtras.length + (/双杯|两杯|2\s*杯/.test(query) ? 1 : 0);
  const required = [
    [/无糖|零糖|不加糖|不(?:额外|另外)加糖/, /无糖|零糖|不加糖|不(?:额外|另外)加糖/],
    [/少少甜|少糖|三分糖|3分糖/, /少少甜|少糖|三分糖|3分糖/],
    [/微糖|五分糖|5分糖|半糖/, /微糖|五分糖|5分糖|半糖/],
    [/少冰/, /少冰/],
    [/去冰|不加冰/, /去冰|不加冰/],
    [/常温/, /常温/],
    [/热饮|温热|热的|温的/, /热饮|温热|热的|温的/],
    [/大杯/, /大杯/],
    [/中杯/, /中杯/],
    [/小杯/, /小杯/],
  ];
  if (!required.every(([wanted, matched]) => !wanted.test(query) || matched.test(body))) return 'none';
  return historicalCount > expectedCount ? 'superset' : 'exact';
}

export function repeatPurchaseMatches(raw, itemName, request = '') {
  return repeatPurchaseMatchKind(raw, itemName, request) !== 'none';
}

export function availableCouponAmount(raw) {
  const body = clean(raw, 12_000);
  const matches = [...body.matchAll(/(?:未选红包[^。；\n]{0,40}?最高\s*|最高\s*)(\d+(?:\.\d+)?)\s*元可用/g)]
    .map(match => Number(match[1]) || 0).filter(value => value > 0);
  return matches.length ? Math.max(...matches) : 0;
}

export function appliedCouponAmount(raw) {
  const body = clean(raw, 12_000).replace(/(\d)\s+\.(\d)/g, '$1.$2');
  const matches = [...body.matchAll(/(?:闪购红包|红包优惠|配送费红包)[^。；\n]{0,24}?[-−]\s*[¥￥]?\s*(\d+(?:\.\d+)?)/g)]
    .map(match => Number(match[1]) || 0).filter(value => value > 0);
  return matches.length ? Math.max(...matches) : 0;
}

export function savedTopUpItems(raw, mainItem = '') {
  const body = clean(raw, 12_000);
  if (!/买过|再来一单/.test(body)) return [];
  const main = knownRouteKey(mainItem);
  const common = ['冻冻', '椰果', '奶冻', '珍珠', '芋圆', '西米', '布丁', '仙草', '红豆', '椰奶冻', '脆啵啵', '麻薯'];
  return common.filter((name, index) => body.includes(name)
    && knownRouteKey(name) !== main
    && common.findIndex(other => other === name) === index);
}

export function milkTeaTopUpEligible(value) {
  const text = clean(value, 300);
  if (!text) return false;
  // Coffee and meal orders must never be padded with milk-tea toppings.  Those
  // categories need a normal same-category item or an explicit user choice.
  if (/咖啡|美式|馥芮白|摩卡|卡布奇诺|浓缩|生椰拿铁|主食|米饭|炒饭|盖饭|面|粉|粥|汉堡|炸鸡|鸡翅|薯条|披萨|卷饼|套餐|肯德基|\bkfc\b|麦当劳/i.test(text)) return false;
  return /奶茶|果茶|茶饮|冰奶|鲜奶茶|茶拿铁|奶绿|奶盖|茉莉|葡萄|杨枝甘露|柠檬茶|椰椰|啵啵|茶百道|喜茶|霸王茶姬|奈雪/i.test(text);
}

export function multiServingEligible(value) {
  const text = clean(value, 300);
  if (!text) return false;
  if (/肯德基|\bkfc\b|麦当劳|主食|米饭|炒饭|盖饭|面|粉|粥|汉堡|炸鸡|鸡翅|薯条|披萨|卷饼|便当|套餐饭/i.test(text)) return false;
  if (/瑞幸(?:咖啡)?|luckin/i.test(text)) return true;
  return milkTeaTopUpEligible(text);
}

export function mealSideTopUpEligible(value) {
  const text = clean(value, 300);
  if (!text || /咖啡|美式|拿铁|奶茶|果茶|茶饮|冰奶|肯德基|\bkfc\b|麦当劳|汉堡|炸鸡|鸡翅|薯条|披萨/i.test(text)) return false;
  return /主食|米饭|炒饭|盖饭|面|粉|粥|便当|馄饨|饺子|包子/i.test(text);
}

export function publicAddressLabel(raw) {
  const value = clean(raw, 300);
  const common = value.match(/(?:常用|标签)\s*(家|公司|学校)/);
  if (common) return common[1];
  const standalone = value.split(/[\s，,。；;|/]+/).find(part => /^(家|公司|学校)$/.test(part));
  if (standalone) return standalone;
  const candidate = value.split(/[\s，,。；;|/]+/).find(part =>
    /^[\u4e00-\u9fa5A-Za-z]{2,12}$/.test(part)
    && !/^(北京|上海|天津|重庆|请输入收货地址|无定位信息|新增收货地址|编辑|删除|常用)$/.test(part)
  );
  return candidate || '平台默认地址';
}

export function checkoutAmounts(raw) {
  const body = clean(raw, 12_000);
  const values = (pattern, valueIndex = 1) => [...body.matchAll(pattern)].map(match =>
    number(`${match[valueIndex]}${match[valueIndex + 1] ? `.${match[valueIndex + 1]}` : ''}`)
  ).filter(value => value > 0);
  const directTotals = values(/合计\s*[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/g);
  const discountedTotals = values(/合计\s*已优惠\s*[¥￥]\s*\d+(?:\s*\.\s*\d+)?\s*[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/g);
  const paymentTotals = values(/(?:实付款|需支付|应付|待支付|立即支付)\s*[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/g);
  const discounts = values(/已优惠\s*[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/g);
  return {
    total: directTotals.at(-1) || discountedTotals.at(-1) || paymentTotals.at(-1) || 0,
    discount: discounts.at(-1) || 0,
  };
}

const flexibleTextPattern = value => clean(value, 120).split('').map(char => {
  if (/\s/.test(char)) return '\\s*';
  return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}).join('\\s*');

export function checkoutCartState(raw, itemName, query = '', quantity = 1, { allowSuperset = false, requiredItems = [] } = {}) {
  const body = clean(raw, 12_000);
  const required = (Array.isArray(requiredItems) && requiredItems.length
    ? requiredItems
    : [clean(itemName, 120), ...requestedStandaloneItems(query)]).filter(Boolean);
  const expectedMainQuantity = Math.max(1, Number(quantity) || 1);
  const rows = required.map((name, index) => {
    const pattern = flexibleTextPattern(name);
    const match = pattern
      ? body.match(new RegExp(`${pattern}[^×]{0,180}×\\s*(\\d+)`, 'i'))
      : null;
    return { name, quantity: Number(match?.[1]) || 0, expected: index === 0 ? expectedMainQuantity : 1 };
  });
  const renderedRows = [...body.matchAll(/×\s*(\d+)\s*[¥￥]/g)].map(match => Number(match[1]) || 0);
  const missing = rows.filter(row => row.quantity === 0).map(row => row.name);
  const duplicates = rows.filter(row => row.quantity > row.expected).map(row => row.name);
  const wrongQuantities = rows.filter(row => row.quantity > 0 && row.quantity !== row.expected).map(row => row.name);
  const extraRows = Math.max(0, renderedRows.length - rows.filter(row => row.quantity > 0).length);
  const matches = !missing.length && !wrongQuantities.length && (allowSuperset || extraRows === 0);
  return { matches, required: rows, missing, duplicates, extraRows, renderedRows: renderedRows.length };
}

export function checkoutPageReady(url, raw) {
  const body = clean(raw, 12_000);
  return /checkout|confirm|buy/i.test(String(url || ''))
    || (/确认订单/.test(body) && /提交订单|提交并支付|立即支付|餐具|订单备注/.test(body));
}

export function checkoutEtaText(raw) {
  const body = clean(raw, 20_000).replace(/[：﹕]/g, ':');
  const match = body.match(/预计(?:送达|到达)?(?:时间)?\s*[:：]?\s*(\d{1,2})\s*:\s*(\d{2})\s*[-–—至~～]\s*(\d{1,2})\s*:\s*(\d{2})(?:\s*(?:送达|到达))?/);
  if (!match) return '';
  const [, startHour, startMinute, endHour, endMinute] = match;
  const valid = (hour, minute) => Number(hour) >= 0 && Number(hour) <= 23 && Number(minute) >= 0 && Number(minute) <= 59;
  if (!valid(startHour, startMinute) || !valid(endHour, endMinute)) return '';
  const clock = (hour, minute) => `${String(Number(hour)).padStart(2, '0')}:${minute}`;
  return `${clock(startHour, startMinute)}-${clock(endHour, endMinute)}送达`;
}

export function minimumOrderInfo(raw, itemPrice = 0, quantity = 1) {
  const body = clean(raw, 12_000);
  const amount = value => Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
  const thresholdMatch = body.match(/[¥￥]\s*(\d+(?:\.\d+)?)\s*起送/) || body.match(/起送(?:价|金额)?\s*[¥￥]?\s*(\d+(?:\.\d+)?)/);
  const shortfallMatch = body.match(/(?:还差|差)\s*[¥￥]?\s*(\d+(?:\.\d+)?)\s*(?:元)?(?:起送|可结算)/);
  const threshold = number(thresholdMatch?.[1]);
  const shortfall = number(shortfallMatch?.[1]);
  const unitPrice = amount(itemPrice);
  const currentQuantity = Math.max(1, Number(quantity) || 1);
  const current = threshold > 0 && shortfall > 0 ? Math.max(0, amount(threshold - shortfall)) : amount(unitPrice * currentQuantity);
  const minimumQuantity = threshold > 0 && unitPrice > 0 ? Math.max(currentQuantity + 1, Math.ceil(threshold / unitPrice)) : 0;
  return { threshold, shortfall: shortfall || (threshold > current ? amount(threshold - current) : 0), current, minimumQuantity };
}

export class TaobaoFlashBrowser {
  constructor({ profile, headless = false, timeout = 30_000, cdpUrl = '' } = {}) {
    this.profile = profile || './profile';
    this.headless = headless;
    this.timeout = timeout;
    this.executablePath = process.env.PHONE_DELIVERY_CHROME_PATH || '';
    this.cdpUrl = clean(cdpUrl || process.env.PHONE_DELIVERY_CDP_URL, 500);
    this.browser = null;
    this.attached = false;
    this.context = null;
    this.page = null;
    this.startPromise = null;
    this.prewarmPromise = null;
    this.prewarmed = false;
    this.searchUrl = '';
    this.shops = [];
    this.addressCache = null;
    this.knownRoutes = null;
    this.knownRoutesWrite = Promise.resolve();
    this.knownRoutesPath = path.join(path.resolve(this.profile), 'known-product-routes.json');
    this.riskStateLoaded = false;
    this.riskBlockedUntil = 0;
    this.riskBlockReason = '';
    this.riskStatePath = path.join(path.resolve(this.profile), 'risk-state.json');
  }

  async start() {
    if (this.context) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startOnce();
    try { await this.startPromise; }
    catch (error) {
      if (!this.attached) await this.context?.close().catch(() => {});
      this.browser = null; this.context = null; this.page = null; this.attached = false;
      this.prewarmed = false;
      throw error;
    } finally { this.startPromise = null; }
  }

  async startOnce() {
    await fs.mkdir(this.profile, { recursive: true });
    await this.loadRiskState();
    const { chromium } = await import('playwright');
    if (this.cdpUrl) {
      await this.attachCdp(chromium, this.cdpUrl);
      return;
    }
    if (process.platform === 'win32' && this.executablePath) {
      await this.launchWindowsVisibleCdp(chromium);
      return;
    }
    this.context = await chromium.launchPersistentContext(this.profile, {
      headless: this.headless,
      ...(this.executablePath ? { executablePath: this.executablePath } : {}),
      viewport: { width: 430, height: 932 },
      locale: 'zh-CN', timezoneId: 'Asia/Shanghai',
      args: ['--disable-dev-shm-usage'],
    });
    await this.context.route('**/*', async route => {
      if (route.request().resourceType() === 'media') return route.abort().catch(() => {});
      return route.continue().catch(() => {});
    });
    this.context.setDefaultTimeout(this.timeout);
    this.page = this.context.pages()[0] || await this.context.newPage();
    await this.reveal(this.page);
  }

  async attachCdp(chromium, endpoint) {
    this.browser = await chromium.connectOverCDP(endpoint);
    this.context = this.browser.contexts()[0];
    if (!this.context) throw new Error('没有找到可连接的 Chrome/Edge 浏览器上下文');
    this.attached = true;
    this.cdpUrl = endpoint;
    this.context.setDefaultTimeout(this.timeout);
    const pages = this.context.pages().filter(page => !page.isClosed());
    this.page = pages.find(page => /(?:h5\.ele\.me|taobao\.com|alipay\.com)/i.test(page.url())) || pages[0] || await this.context.newPage();
    await this.reveal(this.page);
  }

  async launchWindowsVisibleCdp(chromium) {
    const endpoint = 'http://127.0.0.1:9222';
    const profile = path.resolve(this.profile);
    let ready = false;
    try { ready = (await fetch(`${endpoint}/json/version`, { cache: 'no-store' })).ok; } catch {}
    if (!ready) {
      const child = spawn(this.executablePath, [
        '--remote-debugging-port=9222', `--user-data-dir=${profile}`, '--no-first-run', MSITE,
      ], { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));
        try { if ((await fetch(`${endpoint}/json/version`, { cache: 'no-store' })).ok) { ready = true; break; } } catch {}
      }
    }
    if (!ready) throw new Error('专用 Edge 没有启动成功，请运行 start-visible-edge-session.ps1 后重试');
    await this.attachCdp(chromium, endpoint);
  }

  async reveal(page = this.page) {
    if (this.headless || !page) return;
    await page.bringToFront().catch(() => {});
  }

  async ensure() {
    let alive = false;
    if (this.context) {
      try {
        const pages = this.context.pages().filter(page => !page.isClosed());
        if (!this.page || this.page.isClosed()) this.page = pages[0] || await this.context.newPage();
        alive = Boolean(this.page && !this.page.isClosed());
      } catch (_) {
        alive = false;
      }
    }
    if (!alive) {
      this.browser = null;
      this.context = null;
      this.page = null;
      this.attached = false;
      this.prewarmed = false;
      await this.start();
    }
    await this.reveal(this.page);
    return this.page;
  }

  async close() {
    if (!this.attached) await this.context?.close().catch(() => {});
    this.browser = null; this.context = null; this.page = null; this.attached = false; this.prewarmed = false;
  }

  async tapPoint(page, x, y) {
    await page.mouse.click(x, y);
  }
  pageReady(url, text) {
    if (/\/search\//i.test(url)) return /起送|月售|配送|暂无搜索结果|未找到/.test(text);
    if (/address/i.test(url)) return /编辑|新增收货地址|请选择收货地址/.test(text);
    if (shopUrl(url)) return /选规格|加购|点餐|月售|商品/.test(text);
    if (/buy|order|confirm/i.test(url)) return /提交订单|立即支付|实付款|合计/.test(text);
    return text.length >= 120;
  }

  async waitForContent(page, maxWait = 2500) {
    const limit = Math.max(300, Number(maxWait) || 2500);
    const minimum = Math.min(220, limit);
    await page.waitForTimeout(minimum);
    const deadline = Date.now() + Math.max(0, limit - minimum);
    let previous = '';
    let stable = 0;
    while (Date.now() < deadline) {
      const snapshot = await page.evaluate(() => {
        const rows = [];
        const visit = root => {
          const text = (root.innerText || root.textContent || '').replace(/\s+/g, ' ').trim();
          if (text) rows.push(text);
          for (const node of root.querySelectorAll?.('*') || []) if (node.shadowRoot) visit(node.shadowRoot);
        };
        visit(document); return rows.join(' ').slice(0, 12_000);
      }).catch(() => '');
      if (snapshot && this.pageReady(page.url(), snapshot)) return true;
      stable = snapshot && snapshot === previous ? stable + 1 : 0;
      if (stable >= 2 && !/\/search\/|address|newretail\/p\/ushop|pages\/ele-takeout-index|buy|order|confirm/i.test(page.url())) return true;
      previous = snapshot;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await page.waitForTimeout(Math.min(180, remaining));
    }
    return false;
  }

  async goto(url, wait = 2500) {
    const page = await this.ensure();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.reveal(page);
    await this.waitForContent(page, wait);
    return page;
  }

  async prewarm() {
    if (this.prewarmed && this.context && this.page) return true;
    if (this.prewarmPromise) return this.prewarmPromise;
    this.prewarmPromise = (async () => {
      const page = await this.ensure();
      if (page.url() === 'about:blank') await this.goto(MSITE, 1800);
      this.prewarmed = true;
      return true;
    })();
    try { return await this.prewarmPromise; } finally { this.prewarmPromise = null; }
  }

  async loadKnownRoutes() {
    if (this.knownRoutes) return this.knownRoutes;
    let saved = {};
    try { saved = JSON.parse(await fs.readFile(this.knownRoutesPath, 'utf8')); } catch {}
    const now = Date.now();
    this.knownRoutes = Object.fromEntries(Object.entries(saved && typeof saved === 'object' ? saved : {}).filter(([, entry]) =>
      entry && typeof entry === 'object' && shopUrl(entry.shopUrl) && clean(entry.itemName, 140) && now - Number(entry.savedAt || 0) < 30 * 24 * 60 * 60_000
    ));
    return this.knownRoutes;
  }

  async writeKnownRoutes() {
    const target = this.knownRoutesPath;
    this.knownRoutesWrite = this.knownRoutesWrite.catch(() => {}).then(async () => {
      const snapshot = JSON.stringify(await this.loadKnownRoutes(), null, 2);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, snapshot, 'utf8');
    });
    return this.knownRoutesWrite;
  }

  async knownRoutesFor(query, limit = 6, includeClosed = false) {
    const key = knownRouteKey(query);
    if (!key) return [];
    const routes = await this.loadKnownRoutes();
    const now = Date.now();
    const brand = preferredBrand(query);
    const found = Object.entries(routes)
      .filter(([, entry]) => !brand || brandMatches(brand, `${entry.merchant} ${entry.query}`))
      .filter(([, entry]) => includeClosed || Number(entry.closedUntil || 0) <= now)
      .filter(([, entry]) => {
        const itemKey = knownRouteKey(entry.itemName);
        return itemKey && (key.includes(itemKey) || itemKey.includes(key));
      })
      .sort(([leftKey, left], [rightKey, right]) => Number(rightKey === key) - Number(leftKey === key) || Number(right.savedAt || 0) - Number(left.savedAt || 0))
      .slice(0, Math.max(1, Math.min(20, Number(limit) || 6)))
      .map(([routeKey, entry]) => ({ ...entry, routeKey }));
    return found;
  }

  async knownRoute(query) {
    return (await this.knownRoutesFor(query, 1, false))[0] || null;
  }

  async listKnownRoutes() {
    const routes = await this.loadKnownRoutes();
    return Object.entries(routes).map(([routeKey, entry]) => ({
      routeKey, query: clean(entry.query, 160), merchant: clean(entry.merchant, 100),
      itemName: clean(entry.itemName, 140), savedAt: Number(entry.savedAt || 0),
      closedUntil: Number(entry.closedUntil || 0), closedReason: clean(entry.closedReason, 80),
    })).sort((left, right) => right.savedAt - left.savedAt);
  }

  async markKnownRouteClosed(routeKey, reason, durationMs = 12 * 60 * 60_000) {
    const routes = await this.loadKnownRoutes();
    if (!routeKey || !routes[routeKey]) return;
    routes[routeKey].closedUntil = Date.now() + Math.max(30 * 60_000, Number(durationMs) || 0);
    routes[routeKey].closedReason = clean(reason, 80) || '门店休息中';
    await this.writeKnownRoutes();
  }

  async forgetKnownRoute(query) {
    const routes = await this.loadKnownRoutes();
    const directKey = clean(query, 300);
    const key = routes[directKey] ? directKey : knownRouteKey(query);
    if (!key || !routes[key]) return;
    delete routes[key];
    await this.writeKnownRoutes();
  }

  async rememberKnownRoute(ref) {
    const queryKey = knownRouteKey(ref?.query);
    if (!queryKey || !shopUrl(ref?.shopUrl) || !clean(ref?.itemName, 140)) return;
    const routes = await this.loadKnownRoutes();
    const merchantKey = knownRouteKey(ref?.merchantId || ref?.merchant || ref?.shopUrl).slice(0, 100);
    const key = merchantKey ? `${queryKey}::${merchantKey}` : queryKey;
    for (const [routeKey, entry] of Object.entries(routes)) {
      if (routeKey !== key && knownRouteKey(entry.itemName) === knownRouteKey(ref.itemName) && clean(entry.shopUrl, 1000) === clean(ref.shopUrl, 1000)) delete routes[routeKey];
    }
    routes[key] = {
      query: clean(ref.query, 160), merchant: clean(ref.merchant, 100), merchantId: clean(ref.merchantId, 120),
      itemName: clean(ref.itemName, 140), shopUrl: clean(ref.shopUrl, 1000), savedAt: Date.now(), closedUntil: 0, closedReason: '',
    };
    await this.writeKnownRoutes();
  }
  async loadRiskState() {
    if (this.riskStateLoaded) return;
    this.riskStateLoaded = true;
    try {
      const parsed = JSON.parse(await fs.readFile(this.riskStatePath, 'utf8'));
      this.riskBlockedUntil = Number(parsed?.blockedUntil || 0);
      this.riskBlockReason = clean(parsed?.reason, 40);
    } catch (_) {
      this.riskBlockedUntil = 0;
      this.riskBlockReason = '';
    }
    if (this.riskBlockedUntil <= Date.now()) {
      this.riskBlockedUntil = 0;
      this.riskBlockReason = '';
    }
  }
  async recordRiskChallenge(kind) {
    await fs.mkdir(this.profile, { recursive: true });
    await this.loadRiskState();
    this.riskBlockedUntil = Math.max(this.riskBlockedUntil, Date.now() + 30 * 60_000);
    this.riskBlockReason = clean(kind, 40) || '安全验证';
    await fs.writeFile(this.riskStatePath, JSON.stringify({ blockedUntil: this.riskBlockedUntil, reason: this.riskBlockReason }, null, 2), 'utf8');
  }
  async clearRiskChallenge() {
    this.riskBlockedUntil = 0;
    this.riskBlockReason = '';
    await fs.mkdir(this.profile, { recursive: true });
    await fs.writeFile(this.riskStatePath, JSON.stringify({ blockedUntil: 0, reason: '' }, null, 2), 'utf8');
  }
  async assertRiskCooldown() {
    await this.loadRiskState();
    if (this.riskBlockedUntil <= Date.now()) return;
    // A closeable image challenge can disappear between operations (for
    // example after its X is pressed).  Do not keep blocking a live, clean
    // storefront merely because an older cooldown file still exists.
    if (this.page && !this.page.isClosed?.()) {
      const kind = riskChallengeKind(await this.riskText(this.page));
      if (!kind || await this.dismissCloseableRiskOverlay(this.page, kind)) {
        await this.clearRiskChallenge();
        return;
      }
    }
    const minutes = Math.max(1, Math.ceil((this.riskBlockedUntil - Date.now()) / 60_000));
    throw new Error(`淘宝闪购刚触发${this.riskBlockReason || '安全验证'}，自动搜索已冷却${minutes}分钟，期间不会再次打开或重搜；稍后再试`);
  }
  needsLogin(page) { return /\/login|login\.ele\.me|passport/i.test(page.url()); }
  async requireLogin(page) { if (this.needsLogin(page)) throw new Error('淘宝闪购登录已失效，请在浏览器窗口用手机号、短信验证码和滑块重新登录'); }
  async riskText(page) {
    const frames = typeof page.frames === 'function' ? page.frames() : [page];
    const rows = [];
    for (const frame of frames.length ? frames : [page]) {
      const value = typeof frame.evaluate === 'function' ? await frame.evaluate(() => {
        const rows = [];
        const visit = root => {
          const body = root.body || root;
          const text = String(body?.innerText || body?.textContent || '').trim();
          if (text) rows.push(text);
          for (const el of root.querySelectorAll?.('*') || []) if (el.shadowRoot) visit(el.shadowRoot);
        };
        visit(document);
        return rows.join(' ');
      }).catch(() => frame.locator('body').innerText().catch(() => '')) : await frame.locator('body').innerText().catch(() => '');
      if (value) rows.push(value);
    }
    return clean(rows.join(' '), 12_000);
  }

  async dismissCloseableRiskOverlay(page, expectedKind = '') {
    const currentKind = riskChallengeKind(await this.riskText(page));
    if (!currentKind || (expectedKind && currentKind !== expectedKind)) return false;
    const frames = typeof page.frames === 'function' ? page.frames() : [page];
    for (const frame of frames.length ? frames : [page]) {
      const candidates = frame.locator([
        'button[aria-label*="关闭"]', '[role="button"][aria-label*="关闭"]',
        'button[title*="关闭"]', '[role="button"][title*="关闭"]',
        '[class*="close" i]',
        '[class*="captcha" i] [class*="close" i]', '[class*="verify" i] [class*="close" i]',
        'button:has-text("×")', '[role="button"]:has-text("×")',
        'button:has-text("✕")', '[role="button"]:has-text("✕")',
      ].join(', '));
      if (!candidates || typeof candidates.count !== 'function') continue;
      const visible = [];
      for (let index = 0; index < await candidates.count(); index += 1) {
        const candidate = candidates.nth(index);
        if (!await candidate.isVisible().catch(() => false)) continue;
        const signature = clean(await candidate.evaluate(node => [
          node.getAttribute('aria-label'), node.getAttribute('title'), node.className, node.textContent,
        ].filter(Boolean).join(' ')).catch(() => ''), 500);
        if (!/关闭|close|cancel|×|✕|^x$/i.test(signature)) continue;
        const box = await candidate.boundingBox().catch(() => null);
        visible.push({ candidate, score: box ? box.x + box.y * 0.25 : 0 });
      }
      visible.sort((left, right) => right.score - left.score);
      for (const { candidate } of visible) {
        await candidate.click({ timeout: 1800, noWaitAfter: true }).catch(() => {});
        await page.waitForTimeout(500);
        if (!riskChallengeKind(await this.riskText(page))) return true;
      }
    }
    return false;
  }

  async riskCheck(page, { waitForHuman = false, maxWaitMs = 0 } = {}) {
    const startedAt = Date.now();
    let kind = riskChallengeKind(await this.riskText(page));
    if (!kind) return Date.now() - startedAt;
    if (await this.dismissCloseableRiskOverlay(page, kind)) {
      await this.clearRiskChallenge();
      return Date.now() - startedAt;
    }
    if (waitForHuman && !this.headless && maxWaitMs > 0) {
      await this.reveal(page);
      const deadline = Date.now() + Math.max(1_000, Number(maxWaitMs) || 0);
      while (Date.now() < deadline) {
        await page.waitForTimeout(Math.min(1_000, Math.max(100, deadline - Date.now())));
        kind = riskChallengeKind(await this.riskText(page));
        if (!kind) {
          await this.clearRiskChallenge();
          return Date.now() - startedAt;
        }
      }
    }
    await this.recordRiskChallenge(kind);
    throw new Error(`淘宝闪购出现${kind}，等待本人完成验证已超时；本轮已暂停并冷却30分钟，期间不会重复搜索`);
  }

  async status() {
    const page = await this.goto(MSITE, 3500);
    const loggedIn = !this.needsLogin(page);
    let addressLabel = '';
    if (loggedIn) addressLabel = (await this.currentAddress().catch(() => ({}))).label || '';
    return { loggedIn, addressLabel, loginUrl: loggedIn ? '' : page.url() };
  }

  async currentAddress() {
    if (this.addressCache && Date.now() - this.addressCache.cachedAt < 5 * 60_000) return this.addressCache.value;
    const page = await this.goto(ADDRESS_URL, 3200);
    await this.requireLogin(page);
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    const rows = await page.evaluate(() => {
      const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const values = [];
      const edits = [...document.querySelectorAll('*')].filter(el => visible(el) && (el.textContent || '').trim() === '编辑');
      for (const edit of edits) {
        let el = edit.parentElement;
        for (let depth = 0; el && depth < 8; depth += 1, el = el.parentElement) {
          const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
          if (text.length >= 4 && text.length <= 220 && /编辑/.test(text)) { values.push(text.replace(/编辑|删除/g, '').trim()); break; }
        }
      }
      for (const el of document.querySelectorAll('div,li,section')) {
        if (!visible(el)) continue;
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (text.length < 4 || text.length > 180 || !/编辑|删除/.test(text)) continue;
        values.push(text.replace(/编辑|删除/g, '').trim());
      }
      return [...new Set(values)].slice(0, 20);
    });
    const raw = clean(rows[0], 300);
    if (!raw) throw new Error('没有读取到淘宝闪购默认收货地址，请在浏览器窗口先选择一次地址');
    const value = { label: publicAddressLabel(raw), fingerprintSource: raw };
    this.addressCache = { cachedAt: Date.now(), value };
    return value;
  }

  async search(query, limit = 12, { allowGlobalSearch = true } = {}) {
    await this.assertRiskCooldown();
    if (requestedKfcItems(query).some(item => /(?:套餐|组合|全家桶|多人餐|双人餐|桶餐|拼盘)/.test(item))) {
      throw new Error('KFC 只允许逐件选择单品，不会搜索或加入套餐、组合或全家桶');
    }
    const startedAt = Date.now();
    let humanWaitMs = 0;
    const assertWithinSearchTime = () => {
      if (Date.now() - startedAt - humanWaitMs > 35_000) throw new Error('淘宝闪购搜索超过35秒，本轮已结束且不会自动重试');
    };
    const waitForHumanVerification = async page => {
      humanWaitMs += await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      assertWithinSearchTime();
    };
    const remembered = await this.knownRoute(query);
    const stored = await this.knownRoutesFor(query, 12, true);
    const rememberedRoutes = [];
    if (remembered) rememberedRoutes.push(remembered);
    for (const route of stored) if (!rememberedRoutes.some(row => row.routeKey === route.routeKey) && Number(route.closedUntil || 0) <= Date.now()) rememberedRoutes.push(route);
    const closedRoutes = stored.filter(route => Number(route.closedUntil || 0) > Date.now());
    const closedMerchants = [];
    for (const rememberedRoute of rememberedRoutes.slice(0, 3)) {
      const shop = {
        index: 0, name: rememberedRoute.merchant || '已记住的商家', storeId: rememberedRoute.merchantId || '',
        anchorUrl: rememberedRoute.shopUrl, directUrl: rememberedRoute.shopUrl, deliveryFee: 0, freeDeliveryThreshold: 0,
        etaMinutes: 0, rating: 0, monthlySales: 0, couponLabel: '',
      };
      this.searchUrl = '';
      this.shops = [shop];
      try {
        const page = await this.enterShop(0, { preferSaved: true });
        await this.requireLogin(page); await waitForHumanVerification(page);
        const repeat = await this.repeatPurchase(page, rememberedRoute.itemName, query);
        if (repeat) {
          return [{
            merchantId: shop.storeId || 'saved-shop', merchant: shop.name, name: rememberedRoute.itemName,
            description: clean(`历史订单：${repeat.summary}`, 240), price: repeat.total, deliveryFee: 0,
            total: repeat.total, rating: shop.rating, monthlySales: shop.monthlySales, etaMinutes: shop.etaMinutes,
            couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: true,
            requiresConfirmation: repeat.requiresConfirmation,
            confirmationReason: repeat.confirmationReason,
            browserRef: {
              shopIndex: 0, itemName: rememberedRoute.itemName, unitPrice: repeat.total,
              buttonIndex: -1, detailUrl: '', shopUrl: shop.anchorUrl || shop.directUrl, query,
              merchant: shop.name, merchantId: shop.storeId || '', repeatPurchase: true,
              repeatSummary: repeat.summary, repeatQuantity: repeat.quantity,
              requiresConfirmation: repeat.requiresConfirmation,
            },
          }];
        }
        let items = await this.extractMenu(page, Math.max(12, limit), query);
        let item = items.find(row => productMatchesSavedItem(row.name, rememberedRoute.itemName));
        if (!item && await this.searchInsideShop(page, rememberedRoute.itemName)) {
          await waitForHumanVerification(page);
          items = await this.extractMenu(page, Math.max(12, limit), rememberedRoute.itemName);
          item = items.find(row => productMatchesSavedItem(row.name, rememberedRoute.itemName));
        }
        if (item) {
          const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
          return [{
            merchantId: shop.storeId || 'saved-shop', merchant: shop.name, name: item.name,
            description: item.description, price: item.price, deliveryFee, total: item.price + deliveryFee,
            rating: shop.rating, monthlySales: shop.monthlySales, etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel,
            optionGroups: [], optionsLoaded: false,
            browserRef: { shopIndex: 0, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex, detailUrl: '', shopUrl: shop.anchorUrl || shop.directUrl, query, merchant: shop.name, merchantId: shop.storeId || '' },
          }];
        }
        await this.forgetKnownRoute(rememberedRoute.routeKey || query);
      } catch (error) {
        const message = String(error?.message || error);
        if (/门店已打烊|门店休息中|暂停营业|不在营业时间/.test(message)) {
          const reason = clean(message.replace(/^.*?(?=门店已打烊|门店休息中|暂停营业|不在营业时间)/, ''), 80) || '门店休息中';
          closedMerchants.push(shop.name);
          await this.markKnownRouteClosed(rememberedRoute.routeKey, reason).catch(() => {});
          continue;
        }
        if (!/真实商家已失效|未能进入淘宝闪购商家|没有在真实商家中定位到同一件商品/.test(message)) throw error;
        await this.forgetKnownRoute(rememberedRoute.routeKey || query).catch(() => {});
      }
    }
    // If the user already has the intended merchant open, treat that visible
    // storefront as the safest route.  This avoids an unnecessary outer
    // marketplace search (and its verification risk) on a clean live page.
    const activePage = this.page && !this.page.isClosed?.() && (shopUrl(this.page.url()) || shopSearchUrl(this.page.url())) ? this.page : null;
    if (activePage) {
      await this.requireLogin(activePage); await waitForHumanVerification(activePage);
      const activeUrl = activePage.url();
      const activeBody = clean(await activePage.locator('body').innerText().catch(() => ''), 12_000);
      const brand = preferredBrand(query);
      if (activeShopMatchesBrand(query, activeUrl, activeBody)) {
        const itemQuery = requestedItemName(query);
        const repeat = await this.repeatPurchase(activePage, itemQuery, query);
        if (repeat) {
          return [{
            merchantId: 'active-shop', merchant: clean(activeBody.match(/(?:商家|环境)\s+(.{2,50}?)(?:\s+评分|\s+买过|\s+热销)/)?.[1], 50) || '当前商家',
            name: itemQuery, description: clean(`历史订单：${repeat.summary}`, 240), price: repeat.total,
            deliveryFee: 0, total: repeat.total, rating: 0, monthlySales: 0, etaMinutes: 0,
            couponLabel: '', optionGroups: [], optionsLoaded: true,
            requiresConfirmation: repeat.requiresConfirmation,
            confirmationReason: repeat.confirmationReason,
            browserRef: {
              shopIndex: 0, itemName: itemQuery, unitPrice: repeat.total, buttonIndex: -1,
              detailUrl: '', shopUrl: activeUrl, query, merchant: '当前商家', merchantId: 'active-shop',
              repeatPurchase: true, repeatSummary: repeat.summary, repeatQuantity: repeat.quantity,
              requiresConfirmation: repeat.requiresConfirmation,
            },
          }];
        }
        let items = await this.extractMenu(activePage, Math.max(12, limit), itemQuery);
        let item = preferredExactProduct(items, itemQuery);
        if (!item && await this.searchInsideShop(activePage, itemQuery)) {
          await waitForHumanVerification(activePage);
          items = await this.extractMenu(activePage, Math.max(12, limit), itemQuery);
          item = preferredExactProduct(items, itemQuery);
        }
        if (item) {
          const merchant = clean(activeBody.match(/(?:商家|环境)\s+(.{2,50}?)(?:\s+评分|\s+买过|\s+热销)/)?.[1], 50)
            || (brand === 'chabaidao' ? '茶百道（当前门店）' : '当前商家');
          const ref = {
            shopIndex: 0, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex,
            detailUrl: item.detailUrl || '', shopUrl: activeUrl, query, merchant, merchantId: 'active-shop',
          };
          await this.rememberKnownRoute(ref).catch(() => {});
          return [{
            merchantId: 'active-shop', merchant, name: item.name, description: item.description,
            price: item.price, deliveryFee: 0, total: item.price, rating: 0, monthlySales: 0,
            etaMinutes: 0, couponLabel: '', optionGroups: [], optionsLoaded: false, browserRef: ref,
          }];
        }
      }
    }
    if (!allowGlobalSearch && (closedMerchants.length || closedRoutes.length)) {
      const names = [...new Set([...closedMerchants, ...closedRoutes.map(route => route.merchant).filter(Boolean)])].slice(0, 3).join('、');
      throw new Error(`已登记的${names || '匹配门店'}目前全部打烊或休息中；本轮已停止，没有重新全网搜索`);
    }
    if (!allowGlobalSearch && (stored.length || rememberedRoutes.length)) throw new Error('已登记的同品牌同商品路线当前均不可用；本轮已停止，没有重新全网搜索');
    if (!allowGlobalSearch) throw new Error('还没有登记这个品牌和商品的常用直达路线；为了避免人机验证，角色不会发起全网自动搜索，请由本人先在外卖页成功打开并读取一次规格');
    // The marketplace search only locates the merchant and first requested
    // product. Remaining cart items are searched inside that storefront.
    const brandQuery = /(?:肯德基|\bkfc\b)/i.test(query) ? '肯德基' : clean(query, 160).split(/\s+/)[0];
    const marketplaceQuery = [brandQuery, requestedItemName(query)].filter(Boolean).join(' ');
    const page = await this.goto(`https://h5.ele.me/search/?keyword=${encodeURIComponent(marketplaceQuery)}`, 2500);
    await this.requireLogin(page); await waitForHumanVerification(page);
    let shops = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      assertWithinSearchTime();
      await waitForHumanVerification(page);
      shops = await this.extractShops(page);
      if (shops.length) break;
      await page.waitForTimeout(500);
    }
    const brand = preferredBrand(query);
    if (brand) {
      const exact = shops.filter(shop => brandMatches(brand, shop.name));
      if (exact.length) shops = exact.slice(0, Math.min(3, Math.max(1, limit)));
    }
    this.searchUrl = page.url();
    this.shops = shops;
    if (!this.shops.length) throw new Error('淘宝闪购没有解析到可配送商家，请确认地址或在浏览器窗口处理验证');
    const offers = [];
    const maxShops = Math.min(this.shops.length, 3, Math.max(1, limit));
    for (let shopIndex = 0; shopIndex < maxShops && offers.length < limit; shopIndex += 1) {
      assertWithinSearchTime();
      const shop = this.shops[shopIndex];
      let shopPage;
      try { shopPage = await this.enterShop(shopIndex); }
      catch (error) {
        if (/门店已打烊|门店休息中|暂停营业|不在营业时间/.test(String(error?.message || error))) continue;
        throw error;
      }
      await waitForHumanVerification(shopPage);
      const itemQuery = requestedItemName(query);
      const repeat = await this.repeatPurchase(shopPage, itemQuery, query);
      if (repeat) {
        offers.push({
          merchantId: shop.storeId || String(shopIndex), merchant: shop.name, name: itemQuery,
          description: clean(`历史订单：${repeat.summary}`, 240), price: repeat.total, deliveryFee: 0,
          total: repeat.total, rating: shop.rating, monthlySales: shop.monthlySales,
          etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: true,
          requiresConfirmation: repeat.requiresConfirmation,
          confirmationReason: repeat.confirmationReason,
          browserRef: {
            shopIndex, itemName: itemQuery, unitPrice: repeat.total, buttonIndex: -1, detailUrl: '',
            shopUrl: shop.anchorUrl || '', query, merchant: shop.name, merchantId: shop.storeId || '',
            repeatPurchase: true, repeatSummary: repeat.summary, repeatQuantity: repeat.quantity,
            requiresConfirmation: repeat.requiresConfirmation,
          },
        });
        if (offers.length >= limit) break;
        continue;
      }
      let items = await this.extractMenu(shopPage, Math.max(4, Math.ceil(limit / maxShops)), itemQuery);
      let exactItem = preferredExactProduct(items, itemQuery);
      let exactItems = exactItem ? [exactItem] : [];
      // The outer search is only for finding candidate shops. Storefront preview
      // cards are incomplete and can contain a fuzzy match that hides the exact
      // product deeper in the menu.  A precise single item already visible on
      // the storefront (for example Luckin's signature coconut latte) is safe
      // to use directly; otherwise perform one store-local search.
      const searchedInsideShop = exactItems.length ? false : await this.searchInsideShop(shopPage, itemQuery);
      if (searchedInsideShop) {
        await waitForHumanVerification(shopPage);
        items = await this.extractMenu(shopPage, Math.max(4, Math.ceil(limit / maxShops)), itemQuery);
        exactItem = preferredExactProduct(items, itemQuery);
        exactItems = exactItem ? [exactItem] : [];
      }
      for (const item of exactItems) {
        const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
        offers.push({
          merchantId: shop.storeId || String(shopIndex), merchant: shop.name, name: item.name,
          description: item.description, price: item.price, deliveryFee,
          total: item.price + deliveryFee, rating: shop.rating, monthlySales: shop.monthlySales,
          etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: false,
          browserRef: { shopIndex, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex, detailUrl: item.detailUrl || '', shopUrl: shop.anchorUrl || '', query, merchant: shop.name, merchantId: shop.storeId || '' },
        });
        if (offers.length >= limit) break;
      }
    }
    return offers;
  }

  async extractShops(page) {
    const leaves = await page.evaluate(() => {
      const out = [];
      function visit(root) {
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) visit(el.shadowRoot);
          if (el.children.length) continue;
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          const r = el.getBoundingClientRect();
          if (text && text.length <= 60 && r.width > 0 && r.height > 0) out.push({ text, x: r.x, y: r.y + r.height / 2 });
        }
      }
      visit(document); return out.slice(0, 1000);
    });
    const anchors = leaves.filter(item => /起送/.test(item.text)).sort((a, b) => a.y - b.y);
    return anchors.slice(0, 12).map((anchor, index) => {
      const nextY = anchors[index + 1]?.y ?? anchor.y + 260;
      const lines = leaves.filter(item => item.y >= anchor.y - 150 && item.y < nextY - 20).map(item => item.text);
      const name = lines.find(text => text.length >= 2 && text.length <= 30 && !/月售|评分|起送|配送|分钟|公里|优惠|¥/.test(text)) || `商家${index + 1}`;
      return {
        index, name, anchorY: anchor.y,
        rating: number(lines.find(text => /评分|\d\.\d分/.test(text))),
        monthlySales: number(lines.find(text => /月售/.test(text))),
        deliveryFee: number(lines.find(text => /配送费/.test(text))),
        etaMinutes: number(lines.find(text => /分钟/.test(text))),
        couponLabel: clean(lines.find(text => /减|券|折/.test(text)), 100),
      };
    });
  }

  async enterShop(index, { preferSaved = false } = {}) {
    const shop = this.shops[index];
    if (!shop) throw new Error('真实商家已失效，请重新搜索');
    const current = await this.ensure();
    let page = current;
    if (preferSaved && shop.directUrl && !sameShopUrl(page.url(), shop.directUrl)) page = await this.goto(shop.directUrl, 2200);
    else {
      if (!preferSaved && shopUrl(page.url())) page = await this.goto(this.searchUrl, 2200);
      if (!shopUrl(page.url())) {
      if (preferSaved && shop.directUrl) page = await this.goto(shop.directUrl, 2200);
      else {
        page = page.url() === this.searchUrl ? page : await this.goto(this.searchUrl, 2200);
        for (const x of [110, 190, 280]) {
          await this.tapPoint(page, x, Math.max(80, shop.anchorY - 75));
          await page.waitForTimeout(900);
          if (shopUrl(page.url())) break;
        }
      }
      }
    }
    if (!shopUrl(page.url())) throw new Error('未能进入淘宝闪购商家，页面可能已变化');
    if (!shop.anchorUrl) shop.anchorUrl = page.url();
    const parsed = new URL(page.url());
    const direct = new URL(`${parsed.origin}${parsed.pathname}`);
    for (const key of ['shopId', 'store_id', 'restaurant_id', 'brandId', 'geohash', 'longitude', 'latitude']) {
      const value = parsed.searchParams.get(key);
      if (value) direct.searchParams.set(key, value);
    }
    shop.directUrl = direct.toString();
    const storeId = parsed.searchParams.get('store_id') || parsed.searchParams.get('shopId') || '';
    shop.storeId = storeId;
    await page.waitForTimeout(500);
    await this.dismissPromoOverlays(page);
    const earlyBody = clean(await page.locator('body').innerText().catch(() => ''), 4000);
    const closedReason = shopClosedReason(earlyBody);
    if (closedReason) throw new Error(`门店已打烊：${shop.name}（${closedReason}）`);
    await this.waitForPurchaseControls(page, 8000);
    const shopBody = clean(await page.locator('body').innerText().catch(() => ''), 1800);
    const merchantMatch = shopBody.match(/环境\s+(.{2,50}?)\s+评分\s*([0-5](?:\.\d)?)/) || shopBody.match(/商家\s+(.{2,50}?)\s+(?:刚刚搜过|买过|热销|点餐)/);
    if (merchantMatch?.[1]) shop.name = clean(merchantMatch[1], 50);
    if (merchantMatch?.[2]) shop.rating = number(merchantMatch[2]);
    const eta = shopBody.match(/约(?:快)?\s*(\d+)分钟/);
    if (eta) shop.etaMinutes = number(eta[1]);
    const baseFee = shopBody.match(/配送费(?:约)?\s*[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/);
    if (baseFee) shop.deliveryFee = number(`${baseFee[1]}${baseFee[2] ? `.${baseFee[2]}` : ''}`);
    const freeDelivery = shopBody.match(/满\s*(\d+(?:\.\d+)?)\s*免配送费/);
    shop.freeDeliveryThreshold = freeDelivery ? number(freeDelivery[1]) : 0;
    return page;
  }

  async dismissPromoOverlays(page) {
    const promo = page.getByText(/^(红包优惠|闪购红包|配送费红包|优惠活动)$/).last();
    if (!await promo.isVisible().catch(() => false)) return;
    const closes = page.locator('[aria-label*="关闭"]').or(page.getByText(/^(关闭|×|✕|X)$/i));
    for (let index = (await closes.count()) - 1; index >= 0; index -= 1) {
      const close = closes.nth(index);
      if (!await close.isVisible().catch(() => false)) continue;
      await this.tapControl(page, close).catch(() => {});
      break;
    }
    if (await promo.isVisible().catch(() => false)) await this.tapPoint(page, 402, 194).catch(() => {});
    await page.waitForTimeout(350);
  }

  async repeatPurchase(page, itemName, request = '', { click = false } = {}) {
    if (!page || typeof page.getByText !== 'function') return null;
    const controls = page.getByText(/^再来一单$/);
    for (let index = 0; index < await controls.count(); index += 1) {
      const control = controls.nth(index);
      if (!await control.isVisible().catch(() => false)) continue;
      const summary = clean(await control.evaluate((node, name) => {
        const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
        let best = '';
        for (let parent = node, depth = 0; parent && depth < 10; parent = parent.parentElement, depth += 1) {
          const text = normalized(parent.innerText);
          if (text.includes(name) && /买过|再来一单/.test(text) && (!best || text.length < best.length)) best = text;
        }
        return best;
      }, clean(itemName, 140)).catch(() => ''), 4000);
      const matchKind = repeatPurchaseMatchKind(summary, itemName, request);
      if (matchKind === 'none') continue;
      const quantity = Math.max(1, number(summary.match(/共\s*(\d+)\s*件/)?.[1]));
      const total = number(summary.match(/共\s*\d+\s*件\s*[¥￥]\s*(\d+(?:\.\d+)?)/)?.[1]);
      if (click) await this.tapControl(page, control);
      return {
        control, summary, quantity, total, matchKind,
        requiresConfirmation: matchKind === 'superset',
        confirmationReason: matchKind === 'superset'
          ? `匹配的历史订单包含本次指定商品，但整单还有额外商品：${summary}`
          : '',
      };
    }
    return null;
  }

  async boughtOrderSummary(page, itemName) {
    if (!page || typeof page.getByText !== 'function') return '';
    const controls = page.getByText(/^再来一单$/);
    for (let index = 0; index < await controls.count(); index += 1) {
      const control = controls.nth(index);
      if (!await control.isVisible().catch(() => false)) continue;
      const summary = clean(await control.evaluate((node, name) => {
        const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
        let best = '';
        for (let parent = node, depth = 0; parent && depth < 10; parent = parent.parentElement, depth += 1) {
          const text = normalized(parent.innerText);
          if (text.includes(name) && /买过|再来一单/.test(text) && (!best || text.length < best.length)) best = text;
        }
        return best;
      }, clean(itemName, 140)).catch(() => ''), 4000);
      if (summary) return summary;
    }
    return '';
  }

  async applyBestAvailableCoupon(page) {
    const beforeBody = await this.riskText(page);
    const appliedBefore = appliedCouponAmount(beforeBody);
    if (appliedBefore > 0) return { applied: true, amount: appliedBefore };
    const advertised = availableCouponAmount(beforeBody);
    if (!advertised) return { applied: false, amount: 0 };
    const beforeTotal = checkoutAmounts(beforeBody).total;
    const entryText = await this.visibleLocator(page.getByText(/未选红包[^\n]{0,40}最高\s*\d+(?:\.\d+)?\s*元可用/, { exact: false }), true)
      || await this.visibleLocator(page.getByText(/最高\s*\d+(?:\.\d+)?\s*元可用/, { exact: false }), true);
    const entry = await this.visibleLocator(page.locator('.food-extra__hongbao'), true) || entryText;
    if (!entry) throw new Error(`订单显示有¥${advertised.toFixed(2)}红包可用，但没有找到红包选择入口，已停止提交`);
    await this.tapControl(page, entry); await page.waitForTimeout(650);
    let openedBody = await this.riskText(page);
    const amountPattern = String(Number(advertised)).replace('.', '\\.');
    let alreadySelected = new RegExp(`已选\s*\d+\s*张[^。；\n]{0,30}可减\s*[¥￥]?\s*${amountPattern}\s*元?`).test(openedBody);
    let directCoupon = null;
    if (!alreadySelected) {
      const enabledCoupons = page.locator('.shtc-base-coupon__wrap:not(.disable)');
      for (let index = 0; index < await enabledCoupons.count().catch(() => 0); index += 1) {
        const candidate = enabledCoupons.nth(index);
        if (!await candidate.isVisible().catch(() => false)) continue;
        const text = clean(await candidate.innerText().catch(() => ''), 500);
        if (/不可用原因|已失效/.test(text)) continue;
        if (new RegExp(`(?:[¥￥]\\s*${amountPattern}(?:\\.0+)?|${amountPattern}(?:\\.0+)?\\s*元)`).test(text)) {
          directCoupon = candidate;
          break;
        }
      }
    }
    if (!alreadySelected && directCoupon) {
      await this.tapControl(page, directCoupon); await page.waitForTimeout(500);
      let redemptionBody = await this.riskText(page);
      if (/是否兑换|兑换将消耗\s*\d+\s*吃货豆/.test(redemptionBody)) {
        const redeem = await this.visibleLocator(page.getByText(/^(?:立即兑换|确认兑换|兑换并使用|确认使用)$/), true);
        if (!redeem) throw new Error(`¥${advertised.toFixed(2)}红包需要消耗吃货豆，但没有找到兑换确认按钮，已停止提交`);
        await this.tapControl(page, redeem); await page.waitForTimeout(650);
        redemptionBody = await this.riskText(page);
        if (/吃货豆不足|余额不足|兑换失败/.test(redemptionBody)) {
          throw new Error(`¥${advertised.toFixed(2)}红包兑换失败或吃货豆不足，已停止提交`);
        }
      }
      openedBody = await this.riskText(page);
      alreadySelected = new RegExp(`已选\s*\d+\s*张[^。；\n]{0,30}可减\s*[¥￥]?\s*${amountPattern}\s*元?`).test(openedBody);
    }
    if (alreadySelected) {
      const done = await this.visibleLocator(page.getByText(/^(确定|完成|使用)$/), true);
      if (!done) throw new Error(`¥${advertised.toFixed(2)}红包已自动选中，但没有找到确认按钮，已停止提交`);
      await this.activateControl(page, done);
      for (let wait = 0; wait < 16; wait += 1) {
        await page.waitForTimeout(250);
        if (!/ele-select-hongbao|选择红包|已选\s*\d+\s*张[^。；\n]{0,30}可减/i.test(`${page.url()} ${await this.riskText(page)}`)) break;
      }
    }
    await page.locator('[data-phone-delivery-coupon]').evaluateAll(nodes => nodes.forEach(node => node.removeAttribute('data-phone-delivery-coupon'))).catch(() => {});
    const marked = alreadySelected || Boolean(directCoupon) || await page.evaluate(amount => {
      const visible = node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
      const normalized = value => String(value || '').replace(/\s+/g, ' ').replace(/(\d)\s+\.(\d)/g, '$1.$2').trim();
      const amountText = String(Number(amount));
      const leaves = [...document.querySelectorAll('*')].filter(node => visible(node) && node.children.length === 0);
      const seeds = leaves.filter(node => {
        const text = normalized(node.textContent);
        if (!text || text.length > 100 || /不可用|已失效|最高|未选|返豆|吃货卡/.test(text)) return false;
        return new RegExp(`(?:减\\s*[¥￥]?\\s*${amountText}(?:\\.0+)?\\s*元?|[¥￥]\\s*${amountText}(?:\\.0+)?|${amountText}(?:\\.0+)?\\s*元(?:红包|券)?|^${amountText}(?:\\.0+)?\\s*元$)`).test(text);
      });
      let best = null; let bestLength = Infinity;
      for (const seed of seeds) {
        for (let node = seed, depth = 0; node && depth < 7; node = node.parentElement, depth += 1) {
          const text = normalized(node.innerText);
          if (!text || text.length > 600 || /不可用|已失效/.test(text)) continue;
          const clickable = node.getAttribute?.('role') === 'button' || typeof node.onclick === 'function'
            || /coupon|红包|优惠券|select|radio/i.test(String(node.className || ''));
          if (clickable && text.length < bestLength) { best = node; bestLength = text.length; }
        }
      }
      if (!best && seeds[0]) best = seeds[0];
      if (!best) return false;
      best.setAttribute('data-phone-delivery-coupon', '1');
      return true;
    }, advertised).catch(() => false);
    if (!marked) throw new Error(`订单显示有¥${advertised.toFixed(2)}红包可用，但没有识别到对应可用券，已停止提交`);
    if (!alreadySelected && !directCoupon) {
      await this.tapControl(page, page.locator('[data-phone-delivery-coupon="1"]').first());
      await page.waitForTimeout(550);
    }
    const done = await this.visibleLocator(page.getByText(/^(确定|完成|使用)$/), true);
    if (done && /ele-select-hongbao|选择红包|已选\s*\d+\s*张/i.test(`${page.url()} ${await this.riskText(page)}`)) {
      await this.tapControl(page, done); await page.waitForTimeout(550);
    }
    for (let wait = 0; wait < 16 && /ele-select-hongbao|选择红包/i.test(`${page.url()} ${await this.riskText(page)}`); wait += 1) {
      await page.waitForTimeout(250);
    }
    const afterBody = await this.riskText(page);
    const afterTotal = checkoutAmounts(afterBody).total;
    const stillUnselected = availableCouponAmount(afterBody) > 0;
    const explicitApplied = new RegExp(`(?:已选|已减|优惠)[^。；\\n]{0,30}${String(Number(advertised))}(?:\\.0+)?\\s*元`).test(afterBody);
    if (stillUnselected || (!explicitApplied && !(beforeTotal > 0 && afterTotal > 0 && afterTotal < beforeTotal))) {
      throw new Error(`¥${advertised.toFixed(2)}红包没有确认选中，已停止提交，避免按原价创建订单`);
    }
    return { applied: true, amount: beforeTotal > 0 && afterTotal > 0 ? Math.round((beforeTotal - afterTotal) * 100) / 100 : advertised };
  }

  async dismissPointsRedemption(page) {
    const body = await this.riskText(page);
    if (!/是否兑换|兑换将消耗\s*\d+\s*吃货豆|未兑换\s*需\s*\d+\s*吃货豆/.test(body)) return false;
    const semantic = page.locator('[aria-label*="关闭"], [aria-label*="取消"], [class*="close" i], [class*="cancel" i]')
      .or(page.getByText(/^(?:×|✕|X|关闭|取消|暂不兑换|以后再说)$/i));
    for (let index = (await semantic.count().catch(() => 0)) - 1; index >= 0; index -= 1) {
      const control = semantic.nth(index);
      if (!await control.isVisible().catch(() => false)) continue;
      const label = clean(await control.getAttribute('aria-label').catch(() => ''), 60);
      const text = clean(await control.textContent().catch(() => ''), 60);
      if (/立即兑换/.test(`${label} ${text}`)) continue;
      await this.tapControl(page, control).catch(() => {});
      await page.waitForTimeout(350);
      if (!/是否兑换|兑换将消耗\s*\d+\s*吃货豆/.test(await this.riskText(page))) return true;
    }
    const marked = await page.evaluate(() => {
      const visible = node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
      const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
      const nodes = [...document.querySelectorAll('button, [role="button"], div, span')].filter(visible);
      const modal = nodes.filter(node => /是否兑换/.test(normalized(node.innerText)) && /吃货豆/.test(normalized(node.innerText)))
        .sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      if (!modal) return false;
      const box = modal.getBoundingClientRect();
      const candidates = [...modal.querySelectorAll('button, [role="button"], [class*="close" i], [class*="cancel" i], div, span')]
        .filter(node => {
          if (!visible(node) || /立即兑换/.test(normalized(node.innerText))) return false;
          const rect = node.getBoundingClientRect();
          const text = normalized(node.textContent);
          const label = normalized(node.getAttribute?.('aria-label'));
          const explicit = /^(?:×|✕|X|关闭|取消|暂不兑换|以后再说)$/i.test(text) || /关闭|取消/.test(label) || /close|cancel/i.test(String(node.className || ''));
          const iconSized = rect.width >= 18 && rect.width <= 80 && rect.height >= 18 && rect.height <= 80;
          const nearEdge = rect.right >= box.right - 90 || rect.bottom >= box.bottom - 90;
          return explicit || (iconSized && nearEdge && !text);
        })
        .sort((a, b) => {
          const at = /关闭|取消|close|cancel|×|✕|X/i.test(`${a.getAttribute?.('aria-label') || ''} ${a.className || ''} ${a.textContent || ''}`) ? 0 : 1;
          const bt = /关闭|取消|close|cancel|×|✕|X/i.test(`${b.getAttribute?.('aria-label') || ''} ${b.className || ''} ${b.textContent || ''}`) ? 0 : 1;
          return at - bt;
        });
      if (!candidates[0]) return false;
      candidates[0].setAttribute('data-phone-delivery-points-close', '1');
      return true;
    }).catch(() => false);
    if (marked) {
      await this.tapControl(page, page.locator('[data-phone-delivery-points-close="1"]').first()).catch(() => {});
      await page.waitForTimeout(350);
    }
    if (/是否兑换|兑换将消耗\s*\d+\s*吃货豆/.test(await this.riskText(page))) {
      throw new Error('吃货豆兑换弹窗没有安全关闭，已停止提交；不会消耗吃货豆');
    }
    return true;
  }

  async extractMenu(page, limit, query = '') {
    const controls = this.purchaseControls(page);
    await this.waitForPurchaseControls(page, 8000);
    const items = [];
    for (let buttonIndex = 0; buttonIndex < Math.min(await controls.count(), 80); buttonIndex += 1) {
      const control = controls.nth(buttonIndex);
      const card = await control.evaluate((button, allowTopRows) => {
        const box = button.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0 || box.y <= (allowTopRows ? 40 : 140)) return null;
        let node = button;
        for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
          if (!node.classList?.contains('menuItem--info')) continue;
          const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
          // The box also contains the description. Use the dedicated title
          // node so the next step can locate the same product exactly.
          const nameNode = node.querySelector('.menuItem--info-title')
            || node.querySelector('.menuItem--info-title--warp')
            || node.querySelector('.menuItem--info--box') || node;
          const nameText = (nameNode.innerText || '').replace(/\s+/g, ' ').trim();
          if (/¥|￥/.test(text)) {
            let imageRoot = node;
            for (let parentDepth = 0; imageRoot?.parentElement && parentDepth < 4; parentDepth += 1) imageRoot = imageRoot.parentElement;
            const absoluteImage = value => {
              const raw = String(value || '').trim();
              if (!raw) return '';
              if (raw.startsWith('//')) return `${location.protocol}${raw}`;
              try { return new URL(raw, location.href).href; } catch { return ''; }
            };
            const media = [...(imageRoot?.querySelectorAll?.('img, div, span') || [])].map(candidate => {
              const rect = candidate.getBoundingClientRect();
              const raw = candidate.tagName === 'IMG'
                ? candidate.currentSrc || candidate.src || candidate.getAttribute('data-src')
                : String(getComputedStyle(candidate).backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/i)?.[1];
              const url = absoluteImage(raw);
              const square = rect.width > 0 && rect.height > 0 && Math.abs(rect.width / rect.height - 1) < .3;
              const promo = /(?:w_90[,/]h_53|w_\d{1,2}[,/]h_\d{1,2})/i.test(url) || rect.width < 72 || rect.height < 72;
              let score = promo || !url ? -1 : 0;
              if (square) score += 30;
              if (Math.min(rect.width, rect.height) >= 88) score += 25;
              if (/(?:w_192[,/]h_192|resize[^?]*192)/i.test(url)) score += 40;
              if (/cube\.eleme\.cn/i.test(url)) score += 10;
              return { url, score };
            }).filter(candidate => candidate.score >= 0).sort((left, right) => right.score - left.score);
            const imageUrl = media[0]?.url || '';
            return { text, nameText, imageUrl };
          }
        }
        return null;
      }, shopSearchUrl(page.url())).catch(() => null);
      if (!card || /非卖品|请勿下单|单点不送/.test(card.text)) continue;
      const text = card.text;
      const priceSource = /预估到手|预估价/.test(text) ? text.split(/预估到手|预估价/)[0] : text;
      const prices = [...priceSource.matchAll(/[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/g)]
        .map(match => number(`${match[1]}${match[2] ? `.${match[2]}` : ''}`)).filter(value => value > 0);
      const price = prices.at(-1) || 0;
      const name = clean(card.nameText.split(/月售|近期\d+人|[¥￥]/)[0], 60)
        .replace(/^(热销|大家喜欢吃，才叫真好吃)\s*/, '')
        .replace(/\s*\d+天内\d+人下单.*$/, '')
        .replace(/\s+\d+次$/, '');
      if (name && price > 0) items.push({ buttonIndex, name, price, description: clean(text, 240), imageUrl: /^https:\/\//i.test(card.imageUrl || '') ? clean(card.imageUrl, 800) : '' });
    }
    const unique = items.filter((item, index) => items.findIndex(other => other.name === item.name) === index);
    const normalizedQuery = clean(query, 120).toLowerCase().replace(/\s+/g, '');
    const pairs = new Set();
    for (let index = 0; index + 1 < normalizedQuery.length; index += 1) pairs.add(normalizedQuery.slice(index, index + 2));
    const score = item => {
      const haystack = clean(`${item.name} ${item.description}`, 400).toLowerCase().replace(/\s+/g, '');
      const name = clean(item.name, 100).toLowerCase().replace(/\s+/g, '');
      let value = normalizedQuery.includes(name) || name.includes(normalizedQuery) ? 100 : 0;
      for (const pair of pairs) if (haystack.includes(pair)) value += 1;
      return value;
    };
    return unique.map((item, index) => ({ item, index, score: score(item) }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, limit).map(row => row.item);
  }

  async searchInsideShop(page, itemName) {
    if (!(shopUrl(page?.url?.()) || shopSearchUrl(page?.url?.())) || !clean(itemName, 140)) return false;
    const query = clean(itemName, 140);
    const fields = page.locator([
      'input[placeholder*="搜索店内"]', 'input[placeholder*="搜索商品"]',
      'input[aria-label*="搜索店内"]', 'input[aria-label*="搜索商品"]',
      'input[type="search"][placeholder*="搜索"]',
      'input.search-input', 'input.mor-comp-input-content',
    ].join(', '));
    let field = await this.visibleLocator(fields, true);
    if (!field) {
      // Open the store-local search with the actual magnifier control. Do not
      // use a broad icon/coordinate fallback: on the H5 storefront the refresh
      // control can sit beside the search icon and was previously mistaken for
      // search after a layout change.
      const triggerCandidates = page.locator([
        'button[aria-label*="搜索"]', '[role="button"][aria-label*="搜索"]',
        '[title*="搜索"]', '[data-testid*="search" i]', '[data-test*="search" i]',
        // The current H5 storefront binds the React handler to the whole
        // "搜一搜" wrapper. Clicking only the nested magnifier does nothing.
        '.nav__search__wrap', '.shop__search--expland', '.nav__search',
        '[class*="searchIcon" i]', '[class*="search-icon" i]',
      ].join(', ')).or(page.getByText(/^(店内搜索|搜索店内|搜索商品)$/));
      let trigger = null;
      for (let index = 0; index < await triggerCandidates.count(); index += 1) {
        const candidate = triggerCandidates.nth(index);
        if (!await candidate.isVisible().catch(() => false)) continue;
        const signature = clean(await candidate.evaluate(node => [
          node.getAttribute('aria-label'), node.getAttribute('title'),
          node.getAttribute('data-testid'), node.getAttribute('data-test'),
          node.className, node.textContent,
          node.innerHTML,
        ].filter(Boolean).join(' ')).catch(() => ''), 1200);
        if (/刷新|重试|reload|refresh/i.test(signature)) continue;
        if (!/搜索|search/i.test(signature)) continue;
        trigger = candidate;
        break;
      }
      if (trigger) {
        await this.tapControl(page, trigger).catch(() => {});
        await page.waitForTimeout(350);
        field = await this.visibleLocator(fields, true);
      }
    }
    if (!field) return false;
    await this.tapControl(page, field).catch(() => {});
    await field.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
    await field.pressSequentially(query, { delay: 35 });
    const submit = await this.visibleLocator(page.getByText(/^搜索$/), true);
    if (submit) await this.tapControl(page, submit);
    else await field.press('Enter');
    await this.waitForContent(page, 1800);
    const value = clean(await field.inputValue().catch(() => ''), 140);
    if (value !== query) throw new Error('店内搜索没有正确输入商品名称，已停止而不是刷新页面');
    return true;
  }

  purchaseControls(page) {
    return page.locator('[aria-label*="加购"], [aria-label*="选规格"], [aria-label*="选套餐"]').or(page.getByText(/^(选规格|选套餐|加购)$/));
  }

  async waitForPurchaseControls(page, timeout = 8000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.renderedLocator(this.purchaseControls(page))) return true;
      await page.waitForTimeout(300);
    }
    return false;
  }

  async visibleDialog(page) {
    const candidates = page.locator('[role="dialog"]');
    for (let index = (await candidates.count()) - 1; index >= 0; index -= 1) {
      const item = candidates.nth(index);
      if (!await item.isVisible().catch(() => false)) continue;
      const text = clean(await item.innerText().catch(() => ''), 6000);
      if (/加入购物车|选好了/.test(text) && /份量|规格|温度|糖度|甜度|口味|主食|小食|饮料|赠送|请选/.test(text)) return item;
    }
    let anchor = await this.renderedLocator(page.locator('[aria-label*="关闭"]'));
    if (!anchor) anchor = await this.visibleLocator(page.getByText(/^(加入购物车|确定|选好了)$/), true);
    if (!anchor) return null;
    const ancestors = anchor.locator('xpath=ancestor::*');
    let best = null; let bestArea = Infinity;
    for (let index = 0; index < await ancestors.count(); index += 1) {
      const item = ancestors.nth(index);
      const box = await item.boundingBox().catch(() => null);
      if (!box || box.width < 280 || box.height < 240) continue;
      const text = clean(await item.innerText().catch(() => ''), 6000);
      const area = box.width * box.height;
      if (/加入购物车|选好了/.test(text) && /份量|规格|温度|糖度|甜度|口味|主食|小食|饮料|赠送|请选/.test(text) && area < bestArea) { best = item; bestArea = area; }
    }
    return best;
  }

  async inspectOptions(page, buttonIndex, itemRef = null) {
    return this.inspectOptionsControl(page, this.purchaseControls(page).nth(buttonIndex), itemRef);
  }

  async inspectOptionsFor(ref) {
    const current = await this.ensure();
    const page = ref.shopUrl
      ? (sameShopUrl(current.url(), ref.shopUrl) ? current : await this.goto(ref.shopUrl, 900))
      : await this.enterShop(ref.shopIndex, { preferSaved: true });
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    await this.waitForPurchaseControls(page, 8000);
    if (ref.repeatPurchase) {
      const repeat = await this.repeatPurchase(page, ref.itemName, ref.query);
      if (!repeat) throw new Error('匹配的历史订单已经失效，将在下一次搜索时改用店内搜索');
      return [];
    }
    // A quote discovered through the storefront search page loses that search
    // state when we later re-enter the shop to inspect its options.  Re-run the
    // exact store-local query before locating the product so a homepage promo
    // or similarly named first item can never replace the quoted drink.
    let button = await this.productControl(page, ref.itemName);
    if (!button && await this.searchInsideShop(page, ref.itemName)) {
      await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      await this.waitForPurchaseControls(page, 8000);
      button = await this.productControl(page, ref.itemName);
    }
    if (!button) throw new Error('没有在真实商家中定位到同一件商品，请重新搜索');
    const groups = await this.inspectOptionsControl(page, button, ref);
    await this.rememberKnownRoute(ref).catch(() => {});
    return groups;
  }

  async inspectOptionsControl(page, button, itemRef = null) {
    const originUrl = page.url();
    await this.tapControl(page, button); await page.waitForTimeout(700);
    const enteredDetail = /pages\/ele-product-detail/i.test(page.url());
    if (enteredDetail) {
      if (itemRef) itemRef.detailUrl = page.url();
      const detailActions = page.locator('[aria-label*="选规格"], [aria-label*="选套餐"], [aria-label*="加入购物车"]').or(page.getByText(/^(选规格|选套餐|加入购物车)$/));
      const detailAction = await this.visibleLocator(detailActions, true) || await this.renderedLocator(detailActions);
      const label = detailAction ? clean(`${await detailAction.getAttribute('aria-label').catch(() => '')} ${await detailAction.innerText().catch(() => '')}`) : '';
      if (!detailAction || !/选规格|选套餐/.test(label)) {
        await page.goto(originUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(700);
        return [];
      }
      await this.activateControl(page, detailAction); await page.waitForTimeout(700);
    }
    const dialog = await this.optionPanel(page);
    if (!dialog) {
      await this.undoSimpleAdd(page, button);
      if (enteredDetail) { await page.goto(originUrl, { waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(700); }
      return [];
    }
    const groups = await dialog.evaluate((root, headingSource) => {
      const heading = new RegExp(headingSource);
      const leaves = [...root.querySelectorAll('*')].filter(el => !el.children.length).map(el => {
        const r = el.getBoundingClientRect(); return { text: (el.textContent || '').replace(/\s+/g, ' ').trim(), x: r.x, y: r.y, w: r.width, h: r.height };
      }).filter(item => item.text && item.w > 0 && item.h > 0 && item.text.length <= 30).sort((a, b) => a.y - b.y || a.x - b.x);
      const classHeadings = [...root.querySelectorAll('[class*="sku--body_h2"], [class*="sku--body_h3"]')].map(el => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent || '').replace(/\s+/g, ' ').trim(), x: r.x, y: r.y, w: r.width, h: r.height };
      }).filter(item => item.text && item.w > 0 && item.h > 0 && heading.test(item.text));
      const headings = (classHeadings.length ? classHeadings : leaves.filter(item => heading.test(item.text)))
        .sort((a, b) => a.y - b.y || a.x - b.x);
      const result = [];
      for (let i = 0; i < headings.length; i += 1) {
        const start = headings[i].y + headings[i].h;
        const end = headings[i + 1]?.y ?? Infinity;
        const choices = leaves.filter(item => item.y >= start && item.y < end && item.x > headings[i].x - 5
          && !/确定|取消|加入购物车|¥|￥|\d+(?:\.\d+)?折|数量|预估到手/.test(item.text)
          && !/^\d+(?:\.\d+)?$/.test(item.text));
        const unique = [...new Set(choices.map(item => item.text))].slice(0, 30);
        if (unique.length) result.push({ name: headings[i].text, choices: unique });
      }
      if (!result.length) {
        const choices = [...new Set(leaves.filter(item => !/确定|取消|加入购物车|¥|￥|请选择/.test(item.text)).map(item => item.text))].slice(0, 20);
        if (choices.length > 1) result.push({ name: '规格', choices });
      }
      return result;
    }, groupHeading.source);
    await this.closeOptionPanel(page);
    if (enteredDetail) { await page.goto(originUrl, { waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(700); }
    const normalizedGroups = [];
    for (const group of normalizeOptionPanelGroups(groups)) {
      const singleChoiceAddOn = /任选\s*1\s*种/.test(group.name) || group.choices.some(label => /任选\s*1\s*种/.test(label));
      const choices = group.choices.filter(label => !/^(猜你喜欢|温馨小贴士|数量|\d+|[（(]任选\s*\d+\s*种[）)])$/.test(label));
      if (/温度|冰度/.test(group.name)) {
        const extraStart = choices.findIndex((label, index) => index > 0 && !/冰|常温|温|热|冷/.test(label));
        if (extraStart > 0) {
          normalizedGroups.push({ name: group.name, choices: choices.slice(0, extraStart), multiple: false });
          let tail = choices.slice(extraStart).filter(label => !/^(甜度|糖度)(?:[【（(].*)?$/.test(label));
          const toppingStart = tail.findIndex((label, index) => index > 0 && /小料|珍珠|椰果|啵啵|波波|麻薯|布丁|仙草|奶盖|芋圆|红豆|西米|爆珠/.test(label));
          if (tail.some(label => /糖|甜/.test(label))) {
            const sugar = toppingStart > 0 ? tail.slice(0, toppingStart) : tail;
            const toppings = toppingStart > 0 ? tail.slice(toppingStart) : [];
            if (sugar.length) normalizedGroups.push({ name: '糖度', choices: sugar, multiple: false });
            if (toppings.length) normalizedGroups.push({ name: '加料', choices: toppings, multiple: !singleChoiceAddOn });
          } else if (tail.length) normalizedGroups.push({ name: '加料', choices: tail, multiple: !singleChoiceAddOn });
          continue;
        }
      }
      normalizedGroups.push({ name: group.name, choices, multiple: group.multiple || /加料|小料|配料/.test(group.name) && !singleChoiceAddOn });
    }
    return normalizedGroups.map((group, groupIndex) => {
      return {
        id: `g${groupIndex}`, name: clean(group.name, 80), required: true,
        multiple: group.multiple,
        choices: group.choices.map((label, choiceIndex) => ({ id: `g${groupIndex}c${choiceIndex}`, label: clean(label, 80), priceDelta: number(label.match(/\+\s*¥?([\d.]+)/)?.[1]), available: true })),
      };
    }).filter(group => group.choices.length);
  }

  async undoSimpleAdd(page, originalButton) {
    const box = await originalButton.boundingBox().catch(() => null);
    if (!box) return;
    const minus = page.locator('[aria-label*="减少"], [aria-label*="减购"]');
    let best = null; let distance = Infinity;
    for (let i = 0; i < await minus.count(); i += 1) {
      const b = await minus.nth(i).boundingBox().catch(() => null); if (!b) continue;
      const d = Math.abs((b.y + b.height / 2) - (box.y + box.height / 2)); if (d < distance) { best = minus.nth(i); distance = d; }
    }
    if (best && distance < 80) await best.click().catch(() => {});
  }

  async optionPanel(page) {
    const dialog = await this.visibleDialog(page);
    if (dialog) return dialog;
    const body = page.locator('body');
    const raw = await body.innerText().catch(() => '');
    return /已选[:：]/.test(raw) && /加入购物车/.test(raw) && /(?:^|\n)(规格|套餐|份量|温度|糖度|甜度|口味|主食|小食|饮料|赠送)/m.test(raw) ? body : null;
  }

  async closeOptionPanel(page) {
    const close = await this.renderedLocator(page.locator('[aria-label*="关闭"]'));
    if (close) await this.activateControl(page, close).catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }

  async tapControl(page, control) {
    await control.scrollIntoViewIfNeeded().catch(() => {});
    const box = await control.boundingBox().catch(() => null);
    if (!box) throw new Error('真实商品按钮当前不可见，请重新搜索');
    await this.tapPoint(page, box.x + box.width / 2, box.y + box.height / 2);
  }

  async activateControl(page, control) {
    try { await this.tapControl(page, control); }
    catch { await control.click({ force: true, noWaitAfter: true, timeout: 3000 }); }
  }

  async visibleLocator(locator, reverse = false) {
    const count = await locator.count();
    for (let step = 0; step < count; step += 1) {
      const index = reverse ? count - 1 - step : step;
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) return item;
    }
    return null;
  }

  async renderedLocator(locator) {
    let best = null; let bestArea = 0;
    for (let index = 0; index < await locator.count(); index += 1) {
      const item = locator.nth(index);
      const box = await item.boundingBox().catch(() => null);
      const area = box ? box.width * box.height : 0;
      if (area > bestArea) { best = item; bestArea = area; }
    }
    return best;
  }

  async checkoutSubmitControl(page) {
    const labels = /提交订单|提交并支付|去支付|立即支付/;
    for (let wait = 0; wait < 12; wait += 1) {
      let control = await this.visibleLocator(page.getByText(labels, { exact: false }), true).catch(() => null);
      const nativeControls = page.locator('.submit-btn__button').filter({ hasText: labels });
      if (!control) control = await this.visibleLocator(nativeControls, true).catch(() => null);
      if (!control) control = await this.renderedLocator(nativeControls).catch(() => null);
      if (control) return control;
      await page.waitForTimeout(250);
    }
    return null;
  }

  async advancePaymentSelection(page) {
    const body = clean(await page.locator('body').innerText().catch(() => ''), 5000);
    if (!/支付宝/.test(body) || !/确认支付/.test(body)) return false;
    const alipay = await this.visibleLocator(page.locator('.payment-option__item').filter({ hasText: /^支付宝$/ }), true)
      || await this.visibleLocator(page.getByText(/^支付宝$/, { exact: true }), true);
    if (!alipay) throw new Error('在线支付页没有识别到支付宝选项，已停止，不会改用其他付款方式');
    await this.activateControl(page, alipay); await page.waitForTimeout(350);
    const confirm = await this.visibleLocator(page.locator('.payment-footer__button').filter({ hasText: /^确认支付$/ }), true)
      || await this.visibleLocator(page.getByText(/^确认支付$/, { exact: true }), true);
    if (!confirm) throw new Error('在线支付页没有识别到“确认支付”按钮，已停止');
    await this.activateControl(page, confirm); await page.waitForTimeout(700);
    return true;
  }

  async waitForPaymentSelection(page, beforePages = new Set()) {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const pages = this.context.pages().filter(candidate => !candidate.isClosed());
      const preferred = pages.find(candidate => !beforePages.has(candidate)) || pages.at(-1) || page;
      const candidates = [preferred, ...pages].filter((candidate, index, list) => candidate && list.indexOf(candidate) === index);
      for (const candidate of candidates) {
        const body = clean(await candidate.locator('body').innerText().catch(() => ''), 5000);
        const paymentButton = await this.visibleLocator(candidate.getByText(/^付款$/, { exact: true }), true).catch(() => null);
        if (/alipay|cashier|counter|tradepay|payment|\/pay/i.test(candidate.url()) && paymentButton && /(?:^|\s)付款(?:\s|$)/.test(body)) {
          this.page = candidate;
          return candidate;
        }
        if (/支付宝/.test(body) && /确认支付/.test(body)) {
          this.page = candidate;
          await this.advancePaymentSelection(candidate);
          return candidate;
        }
      }
      await page.waitForTimeout(250);
    }
    return page;
  }

  async nearestControlAtY(locator, targetY) {
    let best = null; let bestDistance = Infinity;
    for (let index = 0; index < await locator.count(); index += 1) {
      const item = locator.nth(index);
      const box = await item.boundingBox().catch(() => null);
      if (!box) continue;
      const distance = Math.abs(box.y + box.height / 2 - targetY);
      if (distance < bestDistance) { best = item; bestDistance = distance; }
    }
    return bestDistance <= 120 ? best : null;
  }

  async productControl(page, itemName) {
    await page.locator('[data-phone-delivery-target]').evaluateAll(nodes => nodes.forEach(node => node.removeAttribute('data-phone-delivery-target'))).catch(() => {});
    const marked = await page.evaluate(({ name, allowTopRows }) => {
      const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
      const canonicalTitle = value => normalized(value)
        .replace(/[（(](?:首创|招牌|经典)[）)]/g, '')
        .replace(/[【[].*$/, '')
        .trim();
      const bundle = /(?:双杯|两杯|2杯|套餐|组合|买一送一|\+|＋)/i;
      const targetIsBundle = bundle.test(name);
      const controls = [...document.querySelectorAll('[aria-label*="加购"], [aria-label*="选规格"], [aria-label*="选套餐"]')]
        .map(node => ({ node, box: node.getBoundingClientRect() }))
        .filter(item => item.box.width > 0 && item.box.height > 0 && item.box.y > (allowTopRows ? 40 : 140));
      const targetTitle = canonicalTitle(name);
      const titleNodes = [...document.querySelectorAll('[class*="menuItem--info-title"], [class*="goods-title"], [class*="product-title"]')];
      const exactTitles = titleNodes.filter(node => {
        const box = node.getBoundingClientRect();
        const text = normalized(node.innerText || node.textContent);
        return box.width > 0 && box.height > 0 && box.y > (allowTopRows ? 40 : 140) && text.length <= 80
          && canonicalTitle(text) === targetTitle
          && (targetIsBundle || !bundle.test(text));
      }).map(node => ({ node, box: node.getBoundingClientRect(), text: normalized(node.innerText || node.textContent) }))
        .sort((left, right) => left.box.width * left.box.height - right.box.width * right.box.height || left.box.y - right.box.y);
      for (const title of exactTitles) {
        let card = title.node;
        for (let depth = 0; card && depth < 8; depth += 1, card = card.parentElement) {
          const cardControls = [...card.querySelectorAll('[aria-label*="加购"], [aria-label*="选规格"], [aria-label*="选套餐"]')]
            .filter(node => {
              const box = node.getBoundingClientRect();
              return box.width > 0 && box.height > 0;
          });
          if (cardControls.length !== 1) continue;
          cardControls[0].setAttribute('data-phone-delivery-target', '1');
          return true;
        }
      }
      for (const title of exactTitles) {
        const targetY = title.box.y + title.box.height / 2;
        const closest = controls.map(control => ({ control, distance: Math.abs(control.box.y + control.box.height / 2 - targetY) }))
          .sort((left, right) => left.distance - right.distance)[0];
        if (closest && closest.distance <= 160) {
          closest.control.node.setAttribute('data-phone-delivery-target', '1');
          return true;
        }
      }
      let best = null; let bestRank = Infinity; let bestLength = Infinity;
      for (const control of controls) {
        let parent = control.node.parentElement;
        for (let depth = 0; parent && depth < 6; depth += 1, parent = parent.parentElement) {
          const text = normalized(parent.innerText);
          if (!text.includes(name) || text.length > 900) continue;
          if (!targetIsBundle && bundle.test(text)) continue;
          const rank = text.startsWith(name) ? 0 : 1;
          if (rank < bestRank || (rank === bestRank && text.length < bestLength)) {
            best = control.node; bestRank = rank; bestLength = text.length;
            break;
          }
        }
      }
      if (best) { best.setAttribute('data-phone-delivery-target', '1'); return true; }
      return false;
    }, { name: itemName, allowTopRows: shopSearchUrl(page.url()) }).catch(() => false);
    return marked ? page.locator('[data-phone-delivery-target="1"]').first() : null;
  }

  async productTitle(page, itemName) {
    await page.locator('[data-phone-delivery-title]').evaluateAll(nodes => nodes.forEach(node => node.removeAttribute('data-phone-delivery-title'))).catch(() => {});
    const marked = await page.evaluate(name => {
      const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
      const candidates = [...document.querySelectorAll('*')].filter(node => {
        const box = node.getBoundingClientRect();
        return normalized(node.textContent) === name && box.width > 0 && box.height > 0 && box.y > 140;
      }).sort((left, right) => {
        const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect();
        return a.width * a.height - b.width * b.height;
      });
      if (!candidates[0]) return false;
      candidates[0].setAttribute('data-phone-delivery-title', '1'); return true;
    }, itemName).catch(() => false);
    return marked ? page.locator('[data-phone-delivery-title="1"]').first() : null;
  }

  async productQuantityPlus(page, itemName, fallbackY = null) {
    const pluses = page.locator('[aria-label*="增加"], [aria-label*="添加"], [aria-label*="加购"]');
    const title = await this.productTitle(page, itemName);
    const titleBox = title ? await title.boundingBox().catch(() => null) : null;
    const targetY = titleBox ? titleBox.y + titleBox.height / 2 : fallbackY;
    return targetY == null ? this.visibleLocator(pluses) : this.nearestControlAtY(pluses, targetY);
  }

  async cleanupFailureSuffix(itemName) {
    try {
      const result = await this.cleanupCartItem(itemName);
      return result.cartAmount === 0
        ? '本次加购已撤回'
        : '淘宝闪购购物车仍有商品，请先在官方页面核对后再试';
    } catch {
      return '无法确认本次加购是否已撤回，请先在淘宝闪购购物车核对';
    }
  }

  async readCheckoutDraft(page, ref, quantity = 1, { validateCart = true } = {}) {
    let raw = '';
    let amounts = { total: 0, discount: 0 };
    for (let attempt = 0; attempt < 24; attempt += 1) {
      raw = await page.locator('body').innerText().catch(() => '');
      amounts = checkoutAmounts(raw);
      if (amounts.total > 0) break;
      await page.waitForTimeout(250);
    }
    if (!amounts.total) throw new Error('没有从淘宝闪购确认页读到有效金额，本轮已停止');
    const cart = checkoutCartState(raw, ref.itemName, ref.query, quantity, {
      allowSuperset: ref.requiresConfirmation === true,
      requiredItems: ref.cartItems,
    });
    if (validateCart && !cart.matches) {
      if (cart.duplicates.length) {
        throw new Error(`购物车里的“${cart.duplicates.join('、')}”数量已经重复，本轮不会继续叠加或提交`);
      }
      if (cart.missing.length) {
        throw new Error(`购物车缺少本次要求的“${cart.missing.join('、')}”，本轮不会把其他商品混入订单`);
      }
      if (cart.extraRows > 0) {
        throw new Error('购物车含有本次没有确认的其他商品，本轮不会继续混单');
      }
      throw new Error('购物车商品或数量与本次要求不一致，本轮不会继续提交');
    }
    const checkoutFacts = await page.evaluate(requiredNames => {
      const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();
      const absoluteImage = value => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('//')) return `${location.protocol}${raw}`;
        try { return new URL(raw, location.href).href; } catch { return ''; }
      };
      const backgroundUrl = node => {
        if (!node) return '';
        const match = String(getComputedStyle(node).backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/i);
        return absoluteImage(match && match[1]);
      };
      const bestImage = root => [...root.querySelectorAll('img, div, span')].map(node => {
        const rect = node.getBoundingClientRect();
        const url = node.tagName === 'IMG'
          ? absoluteImage(node.currentSrc || node.src || node.getAttribute('data-src'))
          : backgroundUrl(node);
        const square = rect.width > 0 && rect.height > 0 && Math.abs(rect.width / rect.height - 1) < .3;
        const promo = /(?:w_90[,/]h_53|w_\d{1,2}[,/]h_\d{1,2})/i.test(url) || rect.width < 64 || rect.height < 64;
        let score = promo || !url ? -1 : 0;
        if (square) score += 30;
        if (Math.min(rect.width, rect.height) >= 80) score += 25;
        if (/(?:w_192[,/]h_192|resize[^?]*192)/i.test(url)) score += 40;
        if (/cube\.eleme\.cn/i.test(url)) score += 10;
        return { url, score };
      }).filter(candidate => candidate.score >= 0).sort((left, right) => right.score - left.score)[0]?.url || '';
      const rowSelector = [
        '.food-item', '[class*="food-item"]', '[class*="foodItem"]',
        '[class*="order-item"]', '[class*="orderItem"]',
        '[class*="goods-item"]', '[class*="goodsItem"]',
      ].join(',');
      const rows = [...new Set(document.querySelectorAll(rowSelector))].map(node => {
        const imageUrl = bestImage(node);
        const priceText = cleanText(node.querySelector('.food-item__price-unit-price')?.textContent)
          || cleanText(node.querySelector('.food-item__price')?.textContent);
        const prices = [...priceText.matchAll(/\d+(?:\.\d+)?/g)].map(match => Number(match[0])).filter(Number.isFinite);
        return {
          name: cleanText(node.querySelector('.food-item__title-text-checkout, .food-item__title')?.textContent),
          options: cleanText(node.querySelector('.food-item__subTitle-text, .food-item__subTitle')?.textContent),
          quantity: Math.max(1, Number(cleanText(node.querySelector('.food-item__number')?.textContent).match(/\d+/)?.[0]) || 1),
          price: prices.length ? prices.at(-1) : 0,
          imageUrl,
        };
      }).filter(row => row.name);
      const normalized = value => cleanText(value).replace(/[\s·•()（）【】\[\]_-]+/g, '');
      const wanted = (requiredNames || []).map(normalized).filter(Boolean);
      const matchedPageImage = [...document.querySelectorAll('img, div, span')].map(node => {
        const rect = node.getBoundingClientRect();
        const url = node.tagName === 'IMG'
          ? absoluteImage(node.currentSrc || node.src || node.getAttribute('data-src'))
          : backgroundUrl(node);
        if (!url || rect.width < 56 || rect.height < 56 || /(?:qrcode|qr-code|avatar|logo|icon)/i.test(url)) return null;
        let parent = node;
        let nearby = '';
        for (let depth = 0; depth < 6 && parent; depth += 1, parent = parent.parentElement) {
          nearby += ` ${cleanText(parent.textContent).slice(0, 500)}`;
        }
        const haystack = normalized(nearby);
        const nameMatch = wanted.some(name => name && (haystack.includes(name) || name.includes(haystack)));
        if (!nameMatch) return null;
        let score = 100;
        if (Math.abs(rect.width / rect.height - 1) < .35) score += 25;
        if (Math.min(rect.width, rect.height) >= 80) score += 20;
        if (/cube\.eleme\.cn/i.test(url)) score += 10;
        return { url, score };
      }).filter(Boolean).sort((left, right) => right.score - left.score)[0]?.url || '';
      return {
        merchant: cleanText(document.querySelector('.food-list__title')?.textContent),
        imageUrl: rows.find(row => row.imageUrl)?.imageUrl || matchedPageImage || '',
        rows,
      };
    }, cart.required.map(row => row.name)).catch(() => ({ merchant: '', imageUrl: '', rows: [] }));
    const items = cart.required.map(row => {
      const live = checkoutFacts.rows.find(item => item.name.includes(row.name) || row.name.includes(item.name));
      return {
        name: row.name,
        quantity: row.quantity || row.expected,
        price: live?.price || 0,
        options: live?.options || (ref.repeatPurchase ? '沿用购物车中已经核对的真实规格' : ''),
        imageUrl: live?.imageUrl || '',
      };
    });
    const itemNames = cart.required.map(row => row.name);
    // Capture the genuine product thumbnail while the confirmation page still
    // owns it. Alibaba image URLs can be short-lived or reject a later iOS
    // WebView request, and the cashier page no longer contains the product
    // tile. Persisting a small data URL here survives both transitions.
    const capturedImageUrl = await this.readOrderImage(page, itemNames);
    const imageUrl = capturedImageUrl || checkoutFacts.imageUrl;
    return {
      total: amounts.total,
      discount: amounts.discount,
      etaText: checkoutEtaText(raw),
      merchant: checkoutFacts.merchant,
      imageUrl,
      items,
      browserOrderRef: { stage: 'confirm', url: page.url(), itemNames, imageUrl },
      risk: [],
    };
  }

  async useExistingCartIfMatching(page, ref, quantity = 1) {
    let cartLabel = '';
    let checkout = null;
    // The storefront often paints the cart footer after the menu itself.  A
    // single immediate read can miss a real existing cart and then duplicate
    // it with “再来一单”, so give only this passive footer read a short bound.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      cartLabel = clean(await page.locator('[aria-label*="购物车总计金额"]').first()
        .getAttribute('aria-label', { timeout: 400 }).catch(() => ''));
      checkout = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
      if (number(cartLabel) > 0 || checkout) break;
      await page.waitForTimeout(250);
    }
    if (!(number(cartLabel) > 0 || checkout)) return null;
    if (!checkout) {
      throw new Error('当前门店购物车已有商品但尚未达到起送金额；系统不会重复加购，请先确认要补充的商品');
    }
    await this.tapControl(page, checkout);
    let body = '';
    for (let attempt = 0; attempt < 18; attempt += 1) {
      await page.waitForTimeout(250);
      body = await page.locator('body').innerText().catch(() => '');
      if (checkoutPageReady(page.url(), body)) break;
    }
    if (!checkoutPageReady(page.url(), body)) {
      throw new Error('购物车已有商品，但平台没有进入订单确认页；本轮不会重复加购');
    }
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    return this.readCheckoutDraft(page, ref, quantity, { validateCart: true });
  }

  async createRepeatPurchaseOrder(ref) {
    const current = await this.ensure();
    const page = ref.shopUrl
      ? (sameShopUrl(current.url(), ref.shopUrl) ? current : await this.goto(ref.shopUrl, 900))
      : await this.enterShop(ref.shopIndex, { preferSaved: true });
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    const existing = await this.useExistingCartIfMatching(page, ref, 1);
    if (existing) return existing;
    const repeat = await this.repeatPurchase(page, ref.itemName, ref.query, { click: true });
    if (!repeat) throw new Error('匹配的历史订单已经失效，本轮没有误点其他订单');
    await page.waitForTimeout(900);
    let body = clean(await page.locator('body').innerText().catch(() => ''), 12_000);
    if (!checkoutPageReady(page.url(), body)) {
      const checkout = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
      if (!checkout) throw new Error('历史订单已加入购物车，但平台没有提供可用的去结算按钮');
      await this.tapControl(page, checkout);
      for (let attempt = 0; attempt < 14; attempt += 1) {
        await page.waitForTimeout(300);
        body = clean(await page.locator('body').innerText().catch(() => ''), 12_000);
        if (checkoutPageReady(page.url(), body)) break;
      }
    }
    if (!checkoutPageReady(page.url(), body)) throw new Error('历史订单没有进入订单确认页，本轮已停止');
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    return this.readCheckoutDraft(page, ref, 1, { validateCart: true });
  }

  async returnToStorefrontWithoutRefresh(page) {
    for (let attempt = 0; attempt < 3 && !shopUrl(page.url()); attempt += 1) {
      if (typeof page.goBack !== 'function') break;
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(450);
    }
    if (!shopUrl(page.url())) throw new Error('无法在不刷新页面的情况下返回商家主页，已停止凑单');
    return page;
  }

  async topUpWithSavedItems(page, ref) {
    if (!milkTeaTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
      return { checkout: null, added: [], expected: [], exhausted: true, eligible: false };
    }
    await this.returnToStorefrontWithoutRefresh(page);
    const historySummary = ref.repeatSummary || await this.boughtOrderSummary(page, ref.itemName);
    const names = savedTopUpItems(historySummary, ref.itemName);
    const added = [];
    for (const name of names) {
      let control = await this.productControl(page, name);
      if (!control && await this.searchInsideShop(page, name)) {
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        await this.waitForPurchaseControls(page, 8000);
        control = await this.productControl(page, name);
      }
      if (!control) {
        if (!shopUrl(page.url())) await this.returnToStorefrontWithoutRefresh(page);
        continue;
      }
      await this.activateControl(page, control); await page.waitForTimeout(550);
      const dialog = await this.optionPanel(page);
      if (dialog) {
        const raw = clean(await dialog.innerText().catch(() => ''), 3000);
        const selectedDefault = raw.match(/已选\s*[:：]\s*([^¥￥\n]{1,100})/)?.[1]?.trim() || '';
        const confirm = await this.visibleLocator(dialog.getByText(/^(加入购物车|确定|选好了)$/), true);
        if (selectedDefault && confirm) {
          await this.tapControl(page, confirm); await page.waitForTimeout(650);
        } else {
          const cancel = await this.visibleLocator(dialog.getByText(/^(取消|关闭)$/), true)
            || await this.visibleLocator(dialog.locator('[aria-label*="关闭"]'), true);
          if (cancel) await this.tapControl(page, cancel).catch(() => {});
          throw new Error(`历史凑单小料“${name}”现在要求重新选规格且没有安全默认项，请让角色先问你再继续`);
        }
      }
      added.push(name);
      const checkout = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
      if (checkout) return { checkout, added, expected: names, exhausted: false, eligible: true };
      if (!shopUrl(page.url())) await this.returnToStorefrontWithoutRefresh(page);
    }
    return { checkout: null, added, expected: names, exhausted: true, eligible: true };
  }

  async topUpWithMealSide(page, ref, sideName) {
    if (!mealSideTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' ')) || !clean(sideName, 60)) {
      return { checkout: null, added: [] };
    }
    await this.returnToStorefrontWithoutRefresh(page);
    let control = await this.productControl(page, sideName);
    if (!control && await this.searchInsideShop(page, sideName)) {
      await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      await this.waitForPurchaseControls(page, 8000);
      control = await this.productControl(page, sideName);
    }
    if (!control) return { checkout: null, added: [] };
    await this.activateControl(page, control); await page.waitForTimeout(550);
    const dialog = await this.optionPanel(page);
    if (dialog) {
      const raw = clean(await dialog.innerText().catch(() => ''), 3000);
      const selectedDefault = raw.match(/已选\s*[:：]\s*([^¥￥\n]{1,100})/)?.[1]?.trim() || '';
      const confirm = await this.visibleLocator(dialog.getByText(/^(加入购物车|确定|选好了)$/), true);
      if (!selectedDefault || !confirm) throw new Error(`主食凑单小吃“${sideName}”现在要求选择规格，请让角色先问你再继续`);
      await this.tapControl(page, confirm); await page.waitForTimeout(650);
    }
    const checkout = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
    return { checkout, added: [sideName] };
  }

  async addRequestedStandaloneItems(page, ref) {
    const requested = requestedStandaloneItems(ref.query);
    const added = [];
    for (const requestedName of requested) {
      if (!shopUrl(page.url())) await this.returnToStorefrontWithoutRefresh(page);
      let menu = await this.extractMenu(page, 24, requestedName).catch(() => []);
      let chosen = preferredExactProduct(menu, requestedName);
      if (!chosen && await this.searchInsideShop(page, requestedName)) {
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        await this.waitForPurchaseControls(page, 8000);
        menu = await this.extractMenu(page, 24, requestedName).catch(() => []);
        chosen = preferredExactProduct(menu, requestedName);
      }
      const actualName = clean(chosen?.name || requestedName, 140);
      let control = await this.productControl(page, actualName);
      if (!control && actualName !== requestedName) control = await this.productControl(page, requestedName);
      if (!control) {
        throw new Error(`购物车还缺少本次明确要求的“${requestedName}”，系统不会因为达到起送价而提前结算`);
      }
      await this.activateControl(page, control); await page.waitForTimeout(550);
      const dialog = await this.optionPanel(page);
      if (dialog) {
        const raw = clean(await dialog.innerText().catch(() => ''), 3000);
        const selectedDefault = raw.match(/已选\s*[:：]\s*([^¥￥\n]{1,100})/)?.[1]?.trim() || '';
        const confirm = await this.visibleLocator(dialog.getByText(/^(加入购物车|确定|选好了)$/), true);
        if (!confirm || (!selectedDefault && /请选择|必选/.test(raw))) {
          throw new Error(`单品“${actualName}”还需要确认真实规格，系统已暂停且不会跳过这件商品`);
        }
        await this.tapControl(page, confirm); await page.waitForTimeout(650);
      }
      added.push(actualName);
      // Do not inspect or click checkout here.  Every requested item must run
      // through this loop even if the first item already reached the minimum.
    }
    if (!shopUrl(page.url())) await this.returnToStorefrontWithoutRefresh(page);
    const checkout = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
    return { checkout, added };
  }

  async createOrder({ ref, selectedOptions, optionGroups = [], quantity }) {
    if (quantity > 1 && !multiServingEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
      throw new Error('双杯/同款多份只允许用于奶茶或瑞幸咖啡；KFC、正餐和主食不会自动复制数量');
    }
    if (ref.repeatPurchase) return this.createRepeatPurchaseOrder(ref);
    let page; let targetControlY = null; let addedStandaloneItems = [];
    if (ref.detailUrl) {
      page = await this.goto(ref.detailUrl, 1800);
      const body = clean(await page.locator('body').innerText().catch(() => ''), 2400);
      if (!body.includes(ref.itemName)) throw new Error('真实商品详情已失效，请重新搜索');
    } else {
      const current = await this.ensure();
      page = ref.shopUrl
        ? (sameShopUrl(current.url(), ref.shopUrl) ? current : await this.goto(ref.shopUrl, 900))
        : await this.enterShop(ref.shopIndex, { preferSaved: true });
      await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      await this.waitForPurchaseControls(page, 8000);
      const existing = await this.useExistingCartIfMatching(page, ref, quantity);
      if (existing) return existing;
      // Prefer an exact single item already visible on the storefront.  Only
      // open store-local search when the signature item is not on the page.
      let add = await this.productControl(page, ref.itemName);
      if (!add && await this.searchInsideShop(page, ref.itemName)) {
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        await this.waitForPurchaseControls(page, 8000);
        add = await this.productControl(page, ref.itemName);
      }
      for (let attempt = 0; attempt < 20 && !add; attempt += 1) {
        add = await this.productControl(page, ref.itemName);
        if (!add) await page.waitForTimeout(500);
      }
      if (!add) {
        const title = await this.productTitle(page, ref.itemName);
        if (!title) throw new Error('没有在真实商家中定位到同一件商品，请重新搜索');
        await title.evaluate(node => {
          let target = node;
          for (let depth = 0; target && depth < 6; depth += 1, target = target.parentElement) {
            if (target.getAttribute('role') === 'button' || typeof target.onclick === 'function') { target.click(); return; }
          }
          node.click();
        });
        await page.waitForTimeout(1000);
        if (!/pages\/ele-product-detail/i.test(page.url())) throw new Error('真实商品标题没有打开对应详情，请重新搜索');
      }
      if (!add) {
        targetControlY = null;
      } else {
      if (process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) {
        const debug = await add.evaluate(node => {
          const box = node.getBoundingClientRect(); let parent = node.parentElement; let summary = '';
          for (let depth = 0; parent && depth < 6; depth += 1, parent = parent.parentElement) {
            const text = (parent.innerText || '').replace(/\s+/g, ' ').trim();
            if (text.length >= 4 && text.length <= 360) { summary = text; if (/¥|￥/.test(text)) break; }
          }
          return { aria: node.getAttribute('aria-label') || '', text: (node.textContent || '').trim(), x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), summary };
        }).catch(() => ({}));
        console.error('[phone-delivery-browser] exact product control:', JSON.stringify(debug));
      }
      const targetBox = await add.boundingBox().catch(() => null);
      if (targetBox) targetControlY = targetBox.y + targetBox.height / 2;
      const startedOnInternalSearch = shopSearchUrl(page.url());
      await this.activateControl(page, add); await page.waitForTimeout(700);
      if (!startedOnInternalSearch && shopSearchUrl(page.url())) throw new Error('真实商品按钮发生页面漂移，请重新搜索');
      }
    }
    if (/pages\/ele-product-detail/i.test(page.url())) {
      const detailActions = page.locator('[aria-label*="选规格"], [aria-label*="选套餐"], [aria-label*="加入购物车"]').or(page.getByText(/^(选规格|选套餐|加入购物车)$/));
      const detailAdd = await this.visibleLocator(detailActions, true) || await this.renderedLocator(detailActions);
      if (!detailAdd) throw new Error('商品详情页没有可用的加入购物车按钮');
      await this.activateControl(page, detailAdd); await page.waitForTimeout(900);
    }
    const dialog = await this.optionPanel(page);
    const selectedLabels = [];
    const applySelectedOptions = async (panel, collectLabels = false) => {
      for (const [groupId, ids] of Object.entries(selectedOptions || {})) {
        const group = optionGroups.find(item => String(item.id) === String(groupId));
        if (!group) throw new Error('真实规格映射已经失效，请重新搜索');
        for (const id of (Array.isArray(ids) ? ids : [ids])) {
          const choice = (group.choices || []).find(item => String(item.id) === String(id));
          if (!choice) throw new Error(`${group.name}的真实选项已经失效，请重新搜索`);
          const target = await this.visibleLocator(panel.getByText(choice.label, { exact: true }), true);
          if (!target) throw new Error(`平台规格“${choice.label}”当前不可选择，请重新搜索`);
          await this.activateControl(page, target);
          if (collectLabels) selectedLabels.push(`${group.name}：${choice.label}`);
        }
      }
      const confirm = await this.visibleLocator(panel.getByText(/加入购物车|确定|选好了/), true);
      if (!confirm) throw new Error('未找到规格确认按钮，请在浏览器窗口处理');
      await this.tapControl(page, confirm); await page.waitForTimeout(900);
    };
    if (dialog) {
      await applySelectedOptions(dialog, true);
    }
    for (let i = 1; i < quantity; i += 1) {
      const plus = await this.productQuantityPlus(page, ref.itemName, targetControlY);
      if (!plus) {
        // Products that use a specification dialog often keep the “choose
        // options” button after being added instead of rendering a quantity +.
        // Re-open the same product and apply the exact same choices again.
        const addAgain = await this.productControl(page, ref.itemName);
        if (addAgain) {
          await this.activateControl(page, addAgain); await page.waitForTimeout(700);
          const repeatDialog = await this.optionPanel(page);
          if (repeatDialog) {
            await applySelectedOptions(repeatDialog, false);
            continue;
          }
        }
        const suffix = await this.cleanupFailureSuffix(ref.itemName);
        throw new Error(`平台没有找到第${i + 1}份同规格商品的增加入口，${suffix}`);
      }
      await this.activateControl(page, plus);
      await page.waitForTimeout(350);
    }
    const explicitItems = await this.addRequestedStandaloneItems(page, ref);
    addedStandaloneItems = explicitItems.added;
    ref.cartItems = [ref.itemName, ...addedStandaloneItems];
    let checkout = explicitItems.checkout || await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
    if (!checkout) {
      const checkoutBody = clean(await page.locator('body').innerText().catch(() => ''), 12_000);
      const minimum = minimumOrderInfo(checkoutBody, ref.unitPrice, quantity);
      if (minimum.threshold > 0) {
        const explicitMealSide = requestedMealSide(ref.query);
        if (explicitMealSide && !addedStandaloneItems.some(item => productMatchesSavedItem(item, explicitMealSide)) && mealSideTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
          const mealTopUp = await this.topUpWithMealSide(page, ref, explicitMealSide);
          checkout = mealTopUp.checkout;
          addedStandaloneItems.push(...mealTopUp.added);
          ref.cartItems = [ref.itemName, ...addedStandaloneItems];
          if (!checkout) throw new Error(`已按你的要求加入“${explicitMealSide}”，但仍未达到该门店起送金额；请让角色先问你是否继续加其他主食小吃`);
        } else {
        const toppedUp = await this.topUpWithSavedItems(page, ref);
        checkout = toppedUp.checkout;
        if (checkout && !toppedUp.exhausted) {
          addedStandaloneItems.push(...toppedUp.added);
          ref.cartItems = [ref.itemName, ...addedStandaloneItems];
          // Continue with the same checkout path below.  The saved add-ons are
          // added one at a time and stop as soon as the minimum is met.
        } else if (toppedUp.eligible === false) {
          const quantityHint = minimum.minimumQuantity > quantity ? `；同款至少需要${minimum.minimumQuantity}份` : '';
          throw new Error(`该门店最低起送金额为¥${minimum.threshold.toFixed(2)}，咖啡、主食和非茶饮商品不会自动加入奶茶小料凑单${quantityHint}；请让角色先问你要添加哪件同类商品`);
        } else if (toppedUp.added.length) {
          const missing = toppedUp.expected.filter(name => !toppedUp.added.includes(name));
          const missingText = missing.length ? `；尚缺历史小料：${missing.join('、')}` : '';
          throw new Error(`已按历史记录加入凑单小料（${toppedUp.added.join('、')}），但本轮没有完整进入结算${missingText}；请让角色问你后再继续`);
        } else {
          const quantityHint = minimum.minimumQuantity > quantity ? `；同款至少需要${minimum.minimumQuantity}份` : '';
          throw new Error(`该门店最低起送金额为¥${minimum.threshold.toFixed(2)}，没有找到可复用的历史凑单小料${quantityHint}；请让角色先问你要加什么`);
        }
        }
      }
      if (!checkout) {
        const suffix = await this.cleanupFailureSuffix(ref.itemName);
        if (minimum.threshold > 0) {
        const quantityHint = minimum.minimumQuantity > quantity ? `；同款至少需要${minimum.minimumQuantity}份` : '';
        throw new Error(`该门店最低起送金额为¥${minimum.threshold.toFixed(2)}，当前商品合计约¥${minimum.current.toFixed(2)}，还差约¥${minimum.shortfall.toFixed(2)}${quantityHint}；${suffix}`);
        }
        throw new Error(`未达到起送金额或无法结算，${suffix}，请重新选择商品或数量`);
      }
    }
    const checkoutState = async () => ({ url: page.url(), body: clean(await page.locator('body').innerText().catch(() => ''), 12_000) });
    await this.tapControl(page, checkout);
    let state = await checkoutState();
    for (let attempt = 0; attempt < 14 && !checkoutPageReady(state.url, state.body); attempt += 1) {
      await page.waitForTimeout(300);
      state = await checkoutState();
    }
    if (!checkoutPageReady(state.url, state.body)) {
      const retry = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
      if (retry) await this.activateControl(page, retry);
      await page.waitForTimeout(1400);
      state = await checkoutState();
    }
    if (!checkoutPageReady(state.url, state.body)) {
      const suffix = await this.cleanupFailureSuffix(ref.itemName);
      throw new Error(`淘宝闪购没有进入订单确认页，${suffix}，请重新搜索后再试`);
    }
    await page.waitForTimeout(1800);
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    const draft = await this.readCheckoutDraft(page, ref, quantity, { validateCart: true });
    draft.items = [{ name: ref.itemName, quantity, price: draft.total, options: selectedLabels.join('、') }, ...addedStandaloneItems.map(name => ({ name, quantity: 1, price: 0, options: '逐项加购的单品' }))];
    return draft;
  }

  async dialogGroups(dialog) {
    const raw = await dialog.innerText().catch(() => '');
    const lines = String(raw).split(/\n+/).map(value => clean(value, 80)).filter(Boolean);
    const groups = []; let current = null;
    for (const line of lines) {
      if (groupHeading.test(line)) { current = { name: line, choices: [] }; groups.push(current); }
      else if (current && /^(数量|猜你喜欢|温馨小贴士)$/.test(line)) current = null;
      else if (current && !/确定|取消|加入购物车|¥|￥|\d+(?:\.\d+)?折/.test(line)) current.choices.push(line);
    }
    return groups;
  }

  async readOrderImage(page, itemNames = []) {
    const candidate = await page.evaluate(requiredNames => {
      const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();
      const normalized = value => cleanText(value).replace(/[\s·•()（）【】\[\]_-]+/g, '');
      const absoluteImage = value => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('//')) return `${location.protocol}${raw}`;
        try { return new URL(raw, location.href).href; } catch { return ''; }
      };
      const backgroundUrl = node => {
        const match = String(getComputedStyle(node).backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/i);
        return absoluteImage(match && match[1]);
      };
      const wanted = (requiredNames || []).map(normalized).filter(Boolean);
      document.querySelectorAll('[data-phone-delivery-order-image]').forEach(node => node.removeAttribute('data-phone-delivery-order-image'));
      const candidates = [...document.querySelectorAll('img, div, span')].map((node, index) => {
        const rect = node.getBoundingClientRect();
        const url = node.tagName === 'IMG'
          ? absoluteImage(node.currentSrc || node.src || node.getAttribute('data-src'))
          : backgroundUrl(node);
        if (!/^(?:https:\/\/|data:image\/(?:png|jpe?g|webp)[;,])/i.test(url) || rect.width < 48 || rect.height < 48 || /(?:qrcode|qr-code|avatar|icon)/i.test(url)) return null;
        let parent = node;
        let nearby = '';
        for (let depth = 0; depth < 7 && parent; depth += 1, parent = parent.parentElement) {
          nearby += ` ${cleanText(parent.textContent).slice(0, 700)}`;
        }
        const haystack = normalized(nearby);
        const nameMatch = Boolean(haystack) && wanted.some(name => name && (haystack.includes(name) || name.includes(haystack)));
        const orderDetailThumbnail = /(?:minimized-fee__content-left-logo|order[^ ]*(?:item|goods)[^ ]*(?:image|logo)|(?:item|goods)[^ ]*(?:image|logo))/i.test(String(node.className || ''));
        if (wanted.length && !nameMatch && !orderDetailThumbnail) return null;
        let score = 1000 - Math.min(index, 800);
        if (nameMatch) score += 500;
        if (orderDetailThumbnail) score += 700;
        if (node.tagName === 'IMG') score += 320;
        if (Math.abs(rect.width / rect.height - 1) < .35) score += 120;
        if (Math.min(rect.width, rect.height) >= 80) score += 80;
        if (Math.max(rect.width, rect.height) <= 360) score += 90;
        if (Math.max(rect.width, rect.height) > 720) score -= 500;
        if (/(?:alicdn\.com|cube\.eleme\.cn)/i.test(url)) score += 60;
        if (/logo/i.test(url)) score -= 20;
        return { node, url, score, index, tag: node.tagName };
      }).filter(Boolean).sort((left, right) => right.score - left.score);
      const best = candidates[0];
      if (!best) return null;
      best.node.setAttribute('data-phone-delivery-order-image', '1');
      return { url: best.url, score: best.score, index: best.index, tag: best.tag };
    }, itemNames).catch(() => null);
    if (!candidate) return '';
    let helper = null;
    try {
      const ready = await page.evaluate(url => new Promise(resolve => {
        document.getElementById('phone-delivery-order-image-capture')?.remove();
        const host = document.createElement('div');
        host.id = 'phone-delivery-order-image-capture';
        host.setAttribute('aria-hidden', 'true');
        Object.assign(host.style, {
          position: 'fixed', left: '8px', top: '8px', width: '192px', height: '192px', zIndex: '2147483647',
          overflow: 'hidden', borderRadius: '18px', background: '#f4f1ea', pointerEvents: 'none', opacity: '1',
        });
        const image = document.createElement('img');
        image.alt = '';
        Object.assign(image.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' });
        let settled = false;
        const done = ok => { if (settled) return; settled = true; resolve(ok); };
        image.onload = () => done(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => done(false);
        host.appendChild(image);
        document.body.appendChild(host);
        image.src = url;
        if (image.complete) done(image.naturalWidth > 0 && image.naturalHeight > 0);
        setTimeout(() => done(false), 3500);
      }), candidate.url).catch(() => false);
      if (ready) {
        helper = page.locator('#phone-delivery-order-image-capture');
        const image = await helper.screenshot({ type: 'jpeg', quality: 82, animations: 'disabled', caret: 'hide' });
        if (image.length > 0 && image.length <= 440_000) return `data:image/jpeg;base64,${image.toString('base64')}`;
      }
      const original = page.locator('[data-phone-delivery-order-image="1"]').first();
      if (await original.count()) {
        const image = await original.screenshot({ type: 'jpeg', quality: 76, animations: 'disabled', caret: 'hide' });
        if (image.length > 0 && image.length <= 440_000) return `data:image/jpeg;base64,${image.toString('base64')}`;
      }
    } catch {}
    finally {
      await page.evaluate(() => {
        document.getElementById('phone-delivery-order-image-capture')?.remove();
        document.querySelectorAll('[data-phone-delivery-order-image]').forEach(node => node.removeAttribute('data-phone-delivery-order-image'));
      }).catch(() => {});
    }
    return candidate.url || '';
  }

  async submitOrder(browserOrderRef) {
    const page = await this.ensure();
    if (!/buy|order|confirm/i.test(page.url()) && browserOrderRef?.url) await this.goto(browserOrderRef.url, 1800);
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    const beforePages = new Set(this.context.pages());
    const initialBody = clean(await page.locator('body').innerText().catch(() => ''), 20_000);
    let etaText = checkoutEtaText(initialBody);
    const itemNames = Array.isArray(browserOrderRef?.itemNames) ? browserOrderRef.itemNames.map(name => clean(name, 160)).filter(Boolean) : [];
    const existingImageUrl = clean(browserOrderRef?.imageUrl, 440_000);
    const initialImageUrl = (existingImageUrl.startsWith('data:image/') ? existingImageUrl : '')
      || await this.readOrderImage(page, itemNames)
      || existingImageUrl;
    const alreadyAtPaymentSelection = /支付宝/.test(initialBody) && /确认支付/.test(initialBody);
    if (!alreadyAtPaymentSelection) {
      await this.applyBestAvailableCoupon(page);
      await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      etaText = checkoutEtaText(await page.locator('body').innerText().catch(() => '')) || etaText;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const button = await this.checkoutSubmitControl(page);
        if (!button) throw new Error('未找到淘宝闪购提交订单按钮，请在浏览器窗口核对');
        await this.tapControl(page, button); await page.waitForTimeout(700);
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        const promptBody = clean(await page.locator('body').innerText().catch(() => ''), 7000);
        if (/选择餐具份数/.test(promptBody)) {
          const utensils = await this.visibleLocator(page.getByText(/^(?:有餐具|需要餐具|(?:需要|选择)?\s*(?:1|一)\s*份餐具|(?:1|一)\s*份)$/, { exact: false }), true);
          if (!utensils) throw new Error('淘宝闪购要求选择餐具，但没有识别到“有餐具/1份餐具”选项，已停止提交');
          await this.tapControl(page, utensils); await page.waitForTimeout(450);
          const confirmUtensils = await this.visibleLocator(page.getByText(/^(确定|完成)$/, { exact: true }), true);
          if (confirmUtensils) await this.tapControl(page, confirmUtensils);
          // The React sheet needs time to close and restore the submit control.
          // Do not mistake the temporary absence of that control for success.
          for (let wait = 0; wait < 12; wait += 1) {
            await page.waitForTimeout(250);
            const currentBody = clean(await page.locator('body').innerText().catch(() => ''), 4000);
            if (!/选择餐具份数/.test(currentBody)) break;
          }
          continue;
        }
        break;
      }
    }
    const paymentPage = await this.waitForPaymentSelection(page, beforePages);
    await this.riskCheck(paymentPage, { waitForHuman: true, maxWaitMs: 120_000 });
    for (let i = 0; i < 25; i += 1) {
      await page.waitForTimeout(500);
      const candidate = this.context.pages().find(item => !beforePages.has(item)) || this.context.pages().at(-1) || page;
      const candidateBody = clean(await candidate.locator('body').innerText().catch(() => ''), 20_000);
      const paymentButton = await this.visibleLocator(candidate.getByText(/^付款$/, { exact: true }), true).catch(() => null);
      if (/alipay|cashier|counter|tradepay|payment|\/pay/i.test(candidate.url()) && paymentButton && /(?:^|\s)付款(?:\s|$)/.test(candidateBody)) {
        this.page = candidate;
        const imageUrl = initialImageUrl || await this.readOrderImage(candidate, itemNames);
        const exactEtaText = checkoutEtaText(candidateBody) || checkoutEtaText(await page.locator('body').innerText().catch(() => '')) || etaText;
        return { status: 'pending_payment', payUrl: candidate.url(), etaText: exactEtaText, imageUrl, browserOrderRef: { stage: 'cashier', url: candidate.url(), itemNames, imageUrl } };
      }
    }
    const body = clean(await page.locator('body').innerText().catch(() => ''), 3000);
    if (/支付成功|付款成功/.test(body)) return { status: 'paid', payUrl: '', etaText, browserOrderRef: { stage: 'paid', url: page.url() } };
    if (/确认订单/.test(body) && /立即支付|提交订单/.test(body)) throw new Error('淘宝闪购仍停留在订单确认页，没有完成真实订单提交');
    if (/网络不太好|刷新页面|加载失败/.test(body)) throw new Error('淘宝闪购提交后出现网络错误，没有到达支付宝“付款”页面，本轮不能算创建成功');
    throw new Error('淘宝闪购没有到达支付宝“付款”页面，本轮不能算创建成功');
  }

  async orderStatus(browserOrderRef) {
    const page = await this.ensure();
    if (browserOrderRef?.url && page.url() !== browserOrderRef.url) await this.goto(browserOrderRef.url, 1800).catch(() => {});
    const body = clean(await page.locator('body').innerText().catch(() => ''), 5000);
    const itemNames = Array.isArray(browserOrderRef?.itemNames) ? browserOrderRef.itemNames.map(name => clean(name, 160)).filter(Boolean) : [];
    const imageUrl = await this.readOrderImage(page, itemNames) || clean(browserOrderRef?.imageUrl, 440_000);
    const states = [
      [/已送达|订单完成/, 'delivered'], [/配送中|骑手正在配送/, 'delivering'], [/骑手已取餐|已取货/, 'picked_up'],
      [/骑手已接单|等待骑手取餐/, 'courier_assigned'], [/备餐中|商家制作中/, 'preparing'], [/商家已接单|商家已确认/, 'merchant_confirmed'],
      [/支付成功|付款成功|已支付/, 'paid'], [/已取消|订单取消/, 'canceled'], [/退款成功|已退款/, 'refunded'],
    ];
    const etaText = checkoutEtaText(body);
    for (const [pattern, status] of states) if (pattern.test(body)) return { status, etaText, imageUrl };
    return { status: browserOrderRef?.stage === 'cashier' ? 'pending_payment' : 'created', etaText, imageUrl };
  }

  async diagnostic(path) {
    const page = await this.ensure();
    await page.screenshot({ path, fullPage: false });
    const body = clean(await page.locator('body').innerText().catch(() => ''), 1200)
      .replace(/(外卖配送|到店自取).{0,240}?(立即送出|预约配送)/, '$1 [收货信息已隐藏] $2')
      .replace(/1\d{10}/g, '***').replace(/\d{4,}/g, '***');
    return {
      url: page.url(), title: clean(await page.title().catch(() => ''), 120), body,
      tigaTextCount: await page.locator('tiga-text').count().catch(() => 0),
      ariaCount: await page.locator('[aria-label]').count().catch(() => 0), path,
    };
  }

  async diagnosticOptions(path) {
    const page = await this.ensure();
    const control = page.locator('[aria-label*="选规格"]').or(page.getByText('选规格', { exact: true })).first();
    if (!await control.count()) throw new Error('当前页面没有可检查的规格按钮');
    await this.tapControl(page, control);
    await page.waitForTimeout(900);
    await page.screenshot({ path, fullPage: false });
    const body = clean(await page.locator('body').innerText().catch(() => ''), 2200)
      .replace(/1\d{10}/g, '***').replace(/\d{4,}/g, '***');
    const aria = await page.locator('[aria-label]').evaluateAll(nodes => nodes.slice(0, 40).map(node => ({
      tag: node.tagName, aria: node.getAttribute('aria-label') || '', text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    }))).catch(() => []);
    return { url: page.url(), body, aria, path };
  }

  async diagnosticReenter() {
    const page = await this.enterShop(0, { preferSaved: true });
    await page.waitForTimeout(4000);
    const controls = this.purchaseControls(page);
    let visibleControls = 0;
    for (let index = 0; index < await controls.count(); index += 1) {
      if (await controls.nth(index).isVisible().catch(() => false)) visibleControls += 1;
    }
    return { url: page.url(), controls: await controls.count(), visibleControls };
  }

  async diagnosticFirstOptions(path) {
    const page = await this.enterShop(0, { preferSaved: true });
    const control = this.purchaseControls(page).first();
    if (!await control.count()) throw new Error('当前门店没有可检查的商品按钮');
    await this.tapControl(page, control); await page.waitForTimeout(700);
    if (/pages\/ele-product-detail/i.test(page.url())) {
      const actions = page.locator('[aria-label*="选规格"], [aria-label*="选套餐"]').or(page.getByText(/^(选规格|选套餐)$/));
      const action = await this.visibleLocator(actions, true) || await this.renderedLocator(actions);
      if (!action) throw new Error('商品详情页没有可检查的选规格按钮');
      await this.activateControl(page, action); await page.waitForTimeout(800);
    }
    await page.screenshot({ path, fullPage: false });
    const body = clean(await page.locator('body').innerText().catch(() => ''), 2600)
      .replace(/1\d{10}/g, '***').replace(/\d{4,}/g, '***');
    const aria = await page.locator('[aria-label]').evaluateAll(nodes => nodes.slice(0, 60).map(node => ({
      tag: node.tagName, aria: node.getAttribute('aria-label') || '', text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
    }))).catch(() => []);
    return { url: page.url(), body, aria, path };
  }

  async diagnosticControlMap() {
    const page = await this.ensure();
    return page.evaluate(() => {
      const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
      return [...document.querySelectorAll('[aria-label*="加购"], [aria-label*="选规格"], [aria-label*="选套餐"]')].map((node, index) => {
        const box = node.getBoundingClientRect();
        const ancestors = [];
        let parent = node.parentElement;
        for (let depth = 0; parent && depth < 7; depth += 1, parent = parent.parentElement) {
          const text = normalized(parent.innerText);
          if (text && text.length <= 500) ancestors.push({ depth, tag: parent.tagName, cls: String(parent.className || '').slice(0, 120), text: text.slice(0, 420) });
        }
        return { index, aria: node.getAttribute('aria-label') || '', x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), ancestors };
      }).filter(item => item.w > 0 && item.h > 0).slice(0, 80);
    });
  }

  async diagnosticCart(path) {
    const page = await this.ensure();
    const cartTrigger = await this.renderedLocator(page.locator('[aria-label*="购物车总计金额"]'));
    if (cartTrigger) await this.activateControl(page, cartTrigger);
    else await this.tapPoint(page, 42, 866);
    await page.waitForTimeout(700);
    await page.screenshot({ path, fullPage: false });
    const body = clean(await page.locator('body').innerText().catch(() => ''), 3200)
      .replace(/1\d{10}/g, '***').replace(/\d{4,}/g, '***');
    const aria = await page.locator('[aria-label]').evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect();
      return { aria: node.getAttribute('aria-label') || '', text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80), x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
    }).filter(item => item.w > 0 && item.h > 0).slice(-80)).catch(() => []);
    return { url: page.url(), body, aria, path };
  }

  async cleanupCartItem(itemName) {
    if (!itemName) throw new Error('缺少要清理的测试商品名');
    let page = await this.ensure();
    if (/checkout|confirm|buy/i.test(page.url())) {
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    const decrementControls = page.locator('[aria-label*="减少"], [aria-label*="减购"]');
    let openedMinus = await this.visibleLocator(decrementControls, true);
    if (!openedMinus) {
      const cartTrigger = await this.renderedLocator(page.locator('[aria-label*="购物车总计金额"]'));
      if (cartTrigger) await this.activateControl(page, cartTrigger);
      else await this.tapPoint(page, 42, 866);
      await page.waitForTimeout(600);
      openedMinus = await this.visibleLocator(decrementControls, true);
    }
    let removed = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      // The shop page also contains a “bought before” history card with the same
      // product title.  Only decrement controls rendered by the opened cart are
      // safe to use here; the adapter already refuses to mix with a pre-existing
      // cart before adding the test item.
      const minus = await this.visibleLocator(decrementControls, true);
      if (!minus) break;
      await minus.evaluate(node => node.click()).catch(() => this.activateControl(page, minus));
      removed += 1; await page.waitForTimeout(350);
    }
    const cartLabels = page.locator('[aria-label*="购物车总计金额"]');
    const cartLabel = clean(await cartLabels.first().getAttribute('aria-label', { timeout: 1500 }).catch(() => ''));
    const remainingMinus = await this.visibleLocator(decrementControls, true);
    const cartAmount = cartLabel ? number(cartLabel) : (removed > 0 && !remainingMinus ? 0 : null);
    if (cartAmount !== 0 && !remainingMinus) throw new Error('没有找到购物车商品对应的减少按钮');
    return { removed, cartAmount };
  }

  async diagnosticCleanupItem(itemName) {
    return this.cleanupCartItem(itemName);
  }
}
