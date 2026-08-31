import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MSITE = 'https://h5.ele.me/';
const ADDRESS_URL = 'https://h5.ele.me/minisite/pages-poi/address/index';
const clean = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const collapseRepeatedOptionText = value => {
  let text = clean(value, 1000);
  while (text.length >= 12 && text.length % 2 === 0) {
    const half = text.length / 2;
    if (text.slice(0, half) !== text.slice(half)) break;
    text = text.slice(0, half);
  }
  return text;
};
export const checkoutItemOptionsFromText = (value, itemName) => {
  const text = clean(value, 12_000);
  const name = clean(itemName, 180);
  if (!text || !name) return '';
  let offset = 0;
  while (offset < text.length) {
    const found = text.indexOf(name, offset);
    if (found < 0) break;
    const tail = text.slice(found + name.length, found + name.length + 500);
    const match = tail.match(/^\s*(.{0,360}?)\s*[×x]\s*\d+(?=\s|¥|￥|$)/u);
    if (match) {
      const options = collapseRepeatedOptionText(match[1]);
      if (options && !/[¥￥]/.test(options)) return options;
    }
    offset = found + name.length;
  }
  return '';
};
const number = value => Number(String(value ?? '').match(/[\d.]+/)?.[0] || 0);
const groupHeading = /^(规格|套餐|杯型|份量|容量|温度|冰度|糖度|甜度|口味|辣度|咖啡豆|奶油|咖啡浓度|(?:推荐)?(?:加料|小料|配料)(?:专区)?|酱料|做法|主食\d*|小食\d*|甜品(?:\/小食)?|小食\/甜品|饮料|选择麦满分|(?:选择)?套餐内(?:主食|小食|甜品|饮料)|赠送|全鸡|配餐|蘸酱)(?:\s*[【\[(（][^】\])）]{1,40}[】\])）])?(?:\s*[（(]?(?:请选|请选择|任选)\s*\d+\s*(?:份|种)[）)]?)?$/;
export const mcdonaldsBreakfastBundleOptions = Object.freeze({
  product: '麦满分单人餐随心选',
  mains: Object.freeze(['大脆鸡扒麦满分', '火腿扒麦满分', '吉士蛋麦满分', '原味板烧鸡腿麦满分', '猪柳麦满分']),
  sides: Object.freeze(['脆薯饼', '脆香油条']),
  drinks: Object.freeze(['小杯鲜萃咖啡', '小杯优品豆浆', '鲜萃冰咖']),
});
const mcdonaldsDefaultBundleRequested = value => {
  const text = clean(value, 400);
  if (!/麦当劳|mcdonald/i.test(text)) return false;
  if (/麦满分单人餐随心选/.test(text)) return true;
  return /(?:^|[\s；;，,、=])套餐(?:$|[\s；;，,、])/u.test(text)
    || /(?:随便|任意|都(?:可以|行)|你(?:来)?(?:决定|点|选)|你看着)(?:点|选)?[^；;，,。]{0,12}(?:套餐|早餐|麦当劳)?/u.test(text);
};
export const kfcSignatureBundle = Object.freeze({
  product: '【夜宵专享】吃堡堡4件套',
  legacyProducts: Object.freeze(['招牌汉堡4件套']),
  mains: Object.freeze(['香辣鸡腿汉堡(辣)', '滋滋YES烤鸡腿堡', '黄金SPA鸡排堡(藤椒风味)']),
  snacks1: Object.freeze(['香辣鸡翅(2块装)', '【夜宵专享】生炸大鸡腿串.', '老北京鸡肉卷']),
  snacks2: Object.freeze(['黄金鸡块(5块装)', '薯条(中)', '劲爆鸡米花(小)', '热辣香骨鸡(3块装)']),
  drinks: Object.freeze(['百事可乐(冷/中)', '九珍果汁饮料(冷)', '爆汁三柠茶(冷/中)']),
});
const shopUrl = url => /newretail\/p\/ushop|pages\/ele-takeout-index/i.test(String(url || ''));
const shopSearchUrl = url => /pages\/ele-index-search|newretail\/p\/ushopsearch/i.test(String(url || ''));
export const retailShopSearchUrl = url => /newretail\/p\/ushopsearch/i.test(String(url || ''));
export function storeSearchTermMatches(url, itemName) {
  try {
    const current = new URL(String(url || '')).searchParams.get('keyword') || '';
    const currentKey = knownRouteKey(current);
    const requestedKey = knownRouteKey(itemName);
    return Boolean(currentKey && requestedKey && currentKey === requestedKey);
  } catch {
    return false;
  }
}

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

const optionPanelNoise = /^(?:已选\s*[:：]?|默认\s*[:：]\s*标准\.?|价格计算中|选规格|选套餐|请选择|请选|确定|取消|加入购物车|数量|猜你喜欢|温馨小贴士)$/;

export function normalizeOptionPanelGroups(value = []) {
  const groups = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const originalName = clean(raw?.name, 80);
    if (!originalName) continue;
    const rawChoices = (Array.isArray(raw?.choices) ? raw.choices : []).map(label => clean(label, 80)).filter(Boolean);
    // Some Eleme SKU dialogs expose only the first heading as a DOM heading
    // and flatten later decorated headings (for example “温度【…】” and
    // “甜度【…】”) into that first group's choices. Split those markers back
    // into independent single-select groups before assigning stable ids.
    const sections = [{ name: originalName, choices: [], multiple: raw?.multiple === true }];
    for (const label of rawChoices) {
      const embeddedHeading = label.match(groupHeading);
      if (embeddedHeading && clean(embeddedHeading[1], 60) !== clean(sections.at(-1).name.match(groupHeading)?.[1], 60)) {
        sections.push({ name: label, choices: [], multiple: false });
      } else {
        sections.at(-1).choices.push(label);
      }
    }
    for (const section of sections) {
      const hint = [section.name, ...section.choices].map(label => label.match(/(?:请选|请选择|任选)\s*(\d+)\s*(?:份|种)/)).find(Boolean);
      const selectionCount = Math.max(1, Math.min(20, Number(hint?.[1]) || 1));
      const choices = [...new Set(section.choices.filter(label => {
        if (optionPanelNoise.test(label)) return false;
        if (/^(?:请选|请选择|任选)\s*\d+\s*(?:份|种)$/.test(label)) return false;
        if (/^(?:已选\s*[:：]?.*|价格(?:计算中|待计算)|共\s*\d+\s*件)$/.test(label)) return false;
        return !/^[+×xX]$/.test(label);
      }))];
      if (!choices.length) continue;
      const baseName = clean(section.name
        .replace(/\s*[【\[].{1,40}[】\]]\s*$/g, '')
        .replace(/[（(]?(?:请选|请选择|任选)\s*\d+\s*(?:份|种)[）)]?/g, ''), 60) || '规格';
      groups.push({
        name: selectionCount > 1 ? `${baseName}（请选择${selectionCount}份）` : baseName,
        choices,
        multiple: section.multiple === true || selectionCount > 1,
        selectionCount,
        selectionRequired: Boolean(hint),
      });
    }
  }
  return groups;
}

export function optionChoiceMatchesSummary(summary = '', label = '') {
  const key = value => clean(value, 240).toLowerCase().replace(/[\s·•，,。:：；;、（）()【】\[\]"'“”‘’/\\+＋\-]/g, '');
  const selected = key(summary); const wanted = key(label);
  if (!selected || !wanted) return false;
  if (selected.includes(wanted)) return true;
  const core = wanted.replace(/^(?:默认|现蒸|现做|现煮|现烤|现炸|新鲜现做|招牌|经典)/, '');
  return core.length >= 2 && selected.includes(core);
}

export function missingSelectedOptionRequirements(actualValue, selectedLabels = []) {
  const canonicalize = value => clean(value, 1000).toLowerCase()
    .replace(/火腿[巴扒]麦满分/g, '火腿扒麦满分')
    .replace(/七分糖/g, '7分糖').replace(/三分糖/g, '3分糖')
    .replace(/不(?:额外|另外)?加糖|无糖|零糖|0糖/g, '无糖')
    .replace(/[\s（）()【】\[\]：:、,，/|l]/g, '');
  const actual = canonicalize(actualValue);
  const requirements = [...new Set((selectedLabels || []).flatMap(value => {
    const label = canonicalize(value);
    return label.match(/大脆鸡扒麦满分|火腿扒麦满分|吉士蛋麦满分|原味板烧鸡腿麦满分|猪柳麦满分|脆薯饼|脆香油条|小杯鲜萃咖啡|小杯优品豆浆|鲜萃冰咖|香辣鸡腿汉堡|滋滋yes烤鸡腿堡|黄金spa鸡排堡|香辣鸡翅|生炸大鸡腿串|老北京鸡肉卷|黄金鸡块|薯条|劲爆鸡米花|热辣香骨鸡|百事可乐|九珍果汁饮料|爆汁三柠茶|劲脆鸡腿汉堡|葡式蛋挞|红豆派|醇香土豆泥|经典草莓圣代|原味圣代|冰球杯|桂花酸梅汤|美式|中杯|大杯|芝士不分装|芝士分装|去冰|少冰|正常冰|常温|温热|热|[1375]分糖|全糖|无糖/g) || [];
  }))];
  return requirements.filter(requirement => !actual.includes(canonicalize(requirement)));
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

export function merchantFromShopText(value) {
  const body = clean(value, 4000);
  const match = body.match(/环境\s+(.{2,80}?)\s+评分\s*([0-5](?:\.\d)?)/)
    || body.match(/商家\s+(.{2,80}?)\s+(?:刚刚搜过|买过|热销|点餐)/)
    || body.match(/返红包\s+(.{2,80}?)\s+评分\s*([0-5](?:\.\d)?)/);
  return { name: clean(match?.[1], 80), rating: number(match?.[2]) };
}

function comparableProductKey(value) {
  return knownRouteKey(value)
    .replace(/^(?:手工|招牌|特色|经典)+/u, '')
    .replace(/牛肉拉面/g, '牛肉面');
}

function productKeysEquivalent(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  // Real menu titles occasionally repeat one Han character while the search
  // keyword does not (for example “酸奶奶昔” vs “酸奶昔”).  Accept only a
  // single adjacent duplicate and only when the complete remaining title is
  // identical.  This fixes a platform-title typo without weakening matching
  // to arbitrary fuzzy or two-character containment.
  const removeOneAdjacentDuplicate = value => {
    const chars = Array.from(value);
    const variants = [];
    for (let index = 1; index < chars.length; index += 1) {
      if (chars[index] !== chars[index - 1] || !/\p{Script=Han}/u.test(chars[index])) continue;
      variants.push(chars.slice(0, index).concat(chars.slice(index + 1)).join(''));
    }
    return variants;
  };
  return Array.from(left).length >= 4 && Array.from(right).length >= 4
    && (removeOneAdjacentDuplicate(left).includes(right)
      || removeOneAdjacentDuplicate(right).includes(left));
}

export function merchantNameMatchScore(requested, candidate) {
  const target = knownRouteKey(requested);
  const name = knownRouteKey(candidate);
  if (!target || !name) return 0;
  if (name === target) return 120;
  if (name.startsWith(target)) return 110;
  if (name.includes(target)) return 100;
  if (target.startsWith(name) && name.length >= Math.max(4, target.length - 2)) return 90;
  const targetChars = Array.from(target);
  const namePairs = new Set();
  const nameChars = Array.from(name);
  for (let index = 0; index + 1 < nameChars.length; index += 1) namePairs.add(`${nameChars[index]}${nameChars[index + 1]}`);
  const targetPairs = [];
  for (let index = 0; index + 1 < targetChars.length; index += 1) targetPairs.push(`${targetChars[index]}${targetChars[index + 1]}`);
  const uniquePairs = [...new Set(targetPairs)];
  const matched = uniquePairs.filter(pair => namePairs.has(pair)).length;
  const ratio = uniquePairs.length ? matched / uniquePairs.length : 0;
  // Require several adjacent fragments. This accepts inserted descriptors such
  // as “DQ·蛋糕·冰淇淋” while rejecting a generic first card like “手工拉面”
  // for “兰州牛肉面”.
  if (matched >= 2 && ratio >= 0.5) return 70 + Math.round(ratio * 20);
  return 0;
}

export function requestedMaxDistanceKm(value) {
  const text = clean(value, 300);
  const match = text.match(/(?:不超过|最多|小于等于|不大于|限|≤)\s*(\d+(?:\.\d+)?)\s*(?:公里|km)/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(?:公里|km)\s*(?:内|以内|范围内)/i);
  return match ? Math.max(0, number(match[1])) : 0;
}

function marketplaceMatchScore(shop, itemName) {
  const nameScore = merchantNameMatchScore(itemName, shop?.name);
  if (nameScore) return nameScore;
  const target = comparableProductKey(itemName);
  const merchant = comparableProductKey(shop?.name);
  // Retail cards put the merchant metadata first and product previews much
  // later. Keep enough normalized preview text to reach those titles; the
  // ordinary route key is intentionally capped at 160 characters.
  const preview = clean(shop?.previewText, 4000).toLowerCase()
    .replace(/(?:无糖|零糖|不加糖|少糖|微糖|半糖|全糖|正常糖|不(?:额外|另外)加糖|少冰|少少冰|去冰|正常冰|多冰|热饮|冷饮|常温|大杯|中杯|小杯)/g, '')
    .replace(/鸡腿汉堡/g, '鸡腿堡')
    .replace(/牛肉拉面/g, '牛肉面')
    .replace(/[^\p{L}\p{N}]+/gu, '');
  if (!target) return 0;
  if (merchant === target) return 120;
  if (merchant.startsWith(target)) return 110;
  if (merchant.includes(target)) return 100;
  if (target.startsWith(merchant) && merchant.length >= Math.max(4, target.length - 2)) return 90;
  if (preview.includes(target)) return 80;
  // Product previews commonly insert flavour/style words between the user's
  // qualifier and category, e.g. “巧克力巴斯克芝士蛋糕” for “巧克力蛋糕”.
  // Score adjacent fragments across the full preview (not the 160-character
  // route key) so the relevant merchant can be entered; the exact product is
  // still verified again inside that shop before anything is added.
  const targetChars = Array.from(target);
  const previewChars = Array.from(preview);
  const previewPairs = new Set();
  for (let index = 0; index + 1 < previewChars.length; index += 1) previewPairs.add(`${previewChars[index]}${previewChars[index + 1]}`);
  const targetPairs = [];
  for (let index = 0; index + 1 < targetChars.length; index += 1) targetPairs.push(`${targetChars[index]}${targetChars[index + 1]}`);
  const uniquePairs = [...new Set(targetPairs)];
  const matched = uniquePairs.filter(pair => previewPairs.has(pair)).length;
  const ratio = uniquePairs.length ? matched / uniquePairs.length : 0;
  if (matched >= 2 && ratio >= 0.5) return 60 + Math.round(ratio * 20);
  return 0;
}

export function shopRowsFromVisibleText(rawLeaves, storeQuery = '') {
  const leaves = (Array.isArray(rawLeaves) ? rawLeaves : [])
    .map(item => ({ text: clean(item?.text, 80), x: Number(item?.x) || 0, y: Number(item?.y) || 0 }))
    .filter(item => item.text && Number.isFinite(item.y));
  const rawAnchors = leaves.filter(item => /起送/.test(item.text)).sort((a, b) => a.y - b.y);
  const anchors = rawAnchors.filter((item, index) => index === 0 || item.y - rawAnchors[index - 1].y > 24);
  const storeKey = knownRouteKey(storeQuery);
  return anchors.slice(0, 12).map((anchor, index) => {
    const nextY = anchors[index + 1]?.y ?? anchor.y + 260;
    const lineRows = leaves.filter(item => item.y >= anchor.y - 150 && item.y < nextY - 20);
    const lines = lineRows.map(item => item.text);
    const nameRows = lineRows.filter(item => item.text.length >= 2 && item.text.length <= 60
      && !/^\d+(?:\.\d+)?\+?$/.test(item.text)
      && !/月售|评分|起送|配送|分钟|公里|km|\d+(?:\.\d+)?m\b|优惠|¥/i.test(item.text)
      && !/^(?:综合排序|销量优先|速度优先|距离优先|商家好评优先|人均价低到高|筛选|清空|查看|蜂鸟准时达|支持商家会员|支持预订|支持自取|开发票)$/.test(item.text)
      && !/周边优质商家|近期\d+人好评|浏览过\d+次|已售\d+/.test(item.text));
    const matchingNames = nameRows.filter(item => storeKey && merchantNameMatchScore(storeQuery, item.text) > 0)
      .sort((left, right) => Math.abs(left.y - anchor.y) - Math.abs(right.y - anchor.y));
    const fallbackNames = [...nameRows].sort((left, right) => Math.abs(left.y - anchor.y) - Math.abs(right.y - anchor.y));
    const name = matchingNames[0]?.text || fallbackNames[0]?.text || `商家${index + 1}`;
    return {
      index, name, anchorY: anchor.y,
      rating: number(lines.find(text => /评分|\d\.\d分/.test(text))),
      monthlySales: number(lines.find(text => /月售/.test(text))),
      deliveryFee: number(lines.find(text => /配送费/.test(text))),
      etaMinutes: number(lines.find(text => /分钟/.test(text))),
      distanceKm: number(lines.find(text => /\d+(?:\.\d+)?\s*km/i.test(text))),
      couponLabel: clean(lines.find(text => /减|券|折/.test(text)), 100),
      previewText: clean(lines.join(' '), 1000),
    };
  });
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
  const bundle = /(?:双杯|两杯|2杯|套餐|组合|礼包|整箱|多包|多罐|买一送一|(?:推荐|分享|家庭)装|\d+杯装|\+|＋)/i;
  if (!bundle.test(targetText) && bundle.test(candidateText)) return false;
  const comparableCandidate = comparableProductKey(candidateName);
  const comparableTarget = comparableProductKey(savedItemName);
  if (candidate === target || candidate.includes(target)
    || productKeysEquivalent(comparableCandidate, comparableTarget)
    || comparableCandidate.includes(comparableTarget)) return true;
  // Explicit pack requests commonly have flavour/weight copy inserted between
  // the product and pack words (for example “薯片原味…大礼包”).  Accept the
  // separated adjacent fragments only when the user also asked for a pack;
  // this keeps a single “薯片” request from silently becoming a whole box.
  const packCore = comparableTarget.replace(/(?:双杯|两杯|2杯|套餐|组合|大礼包|礼包|整箱|多包|多罐|买一送一)/gi, '');
  return bundle.test(targetText) && packCore.length >= 2 && comparableCandidate.includes(packCore)
    && merchantNameMatchScore(targetText, candidateText) >= 80;
}

export function preferredExactProduct(items, itemName, { allowContainedAlias = false, allowShortFoodAlias = false, preferSinglePersonCombo = false } = {}) {
  const targetText = clean(itemName, 160);
  const targetKey = comparableProductKey(itemName);
  const requiredTitleTerms = /套餐/.test(targetText)
    ? [comparableProductKey(targetText.replace(/套餐/g, '')), '套餐'].filter(Boolean)
    : [targetKey].filter(Boolean);
  const targetFruit = singleFruitKeyword(targetText);
  const multiServingPattern = /(?:双份|两份|二份|2\s*份|双杯|两杯|2杯|\d+\s*件装|套餐|组合|礼包|整箱|多包|多罐|买一送一|\+|＋)/i;
  const explicitPack = multiServingPattern.test(targetText);
  // A bare product name means one serving. A candidate whose own title says
  // “2份/双份” is a different quantity and must not win merely because it
  // starts with the requested name. The user must explicitly request that pack.
  const candidateItems = (Array.isArray(items) ? items : []).filter(item => {
    const name = clean(item?.name, 240);
    const singlePersonSoupCombo = targetText === '撒汤' && /(?:1|一)\s*人套餐/.test(name)
      && !/(?:双人|多人|2\s*人|两人|三人|四人|全家)/.test(name);
    return (explicitPack || singlePersonSoupCombo || !multiServingPattern.test(name))
      && (!targetFruit || fruitServingEligible(fruitServingWeightGrams(item?.name) > 0
        ? item?.name : `${item?.name || ''} ${item?.description || ''}`));
  });
  if (preferSinglePersonCombo && targetText === '撒汤') {
    const firstSoupCombo = candidateItems.map((item, index) => ({
      item, index, visibleIndex: Number.isInteger(item?.buttonIndex) ? item.buttonIndex : index,
    })).filter(({ item }) => {
      const name = clean(item?.name, 240);
      return /撒汤/.test(name) && /(?:1|一)\s*人套餐/.test(name)
        && !/(?:双人|多人|2\s*人|两人|三人|四人|全家)/.test(name);
    }).sort((left, right) => left.visibleIndex - right.visibleIndex || left.index - right.index)[0]?.item;
    return firstSoupCombo || null;
  }
  // When the user asks for wings without a quantity, prefer the smallest real
  // single-product serving. Do not let a large assorted “辣翅/烤翅” SKU or a
  // buy-one-get-one promotion outrank the first inexpensive two-piece item just
  // because its title starts with the shorter requested word.
  if (/^(?:辣翅|鸡翅)$/.test(targetText) && !/\d+\s*(?:块|只|份)/.test(targetText)) {
    const singleWings = candidateItems.map((item, index) => {
      const name = clean(item?.name, 240);
      const count = Number(name.match(/(\d+)\s*(?:块|只)装/)?.[1]) || Number.POSITIVE_INFINITY;
      const price = Number(item?.price) > 0 ? Number(item.price) : Number.POSITIVE_INFINITY;
      const visibleIndex = Number.isInteger(item?.buttonIndex) ? item.buttonIndex : index;
      return { item, name, count, price, visibleIndex, index };
    }).filter(row => /(?:辣翅|香辣鸡翅|鸡翅)/.test(row.name)
      && !/(?:[\/／]|买一送一|套餐|组合|拼盘|任选|二选一)/.test(row.name));
    const preferredWing = singleWings.sort((left, right) => left.count - right.count
      || left.price - right.price || left.visibleIndex - right.visibleIndex || left.index - right.index)[0]?.item;
    return preferredWing || null;
  }
  const qualifiedCategories = [
    { label: '薯片', pattern: /(?:薯片|马铃薯片|土豆片)/ },
    { label: '冰淇淋', pattern: /(?:冰淇淋|冰激凌)/ },
    { label: '水果捞', pattern: /水果捞/ },
    { label: '水果拼盘', pattern: /(?:水果拼盘|果盘|(?:[大一二三四五六七八九十\d]+拼|多拼|混合)果切)/ },
    { label: '西瓜', pattern: /(?:西瓜(?:果切|切盒|切|桶)|(?:鲜切|现切|切盒|果切)[^+，,、]{0,20}西瓜)/, exclude: /(?:拼|混合|果盘|水果捞|组合)/ },
    { label: '芒果', pattern: /(?:芒果(?:果切|切盒|切|桶)|(?:鲜切|现切|切盒|果切)[^+，,、]{0,20}芒果)/, exclude: /(?:拼|混合|果盘|水果捞|组合)/ },
    { label: '橙子', pattern: /(?:(?:橙子|脐橙|鲜橙)(?:果切|切盒|切|桶)|(?:鲜切|现切|切盒|果切)[^+，,、]{0,20}(?:橙子|脐橙|鲜橙))/, exclude: /(?:拼|混合|果盘|水果捞|组合)/ },
    { label: '茶叶蛋', pattern: /茶叶蛋/, exclude: /(?:套餐|组合|多份|双份|两份|2\s*份)/ },
    { label: '牛肉饼', pattern: /牛肉饼/, exclude: /(?:套餐|组合|多份|双份|两份|2\s*份)/ },
    { label: '酱香饼', pattern: /酱香饼/, exclude: /(?:套餐|组合|多份|双份|两份|2\s*份)/ },
    { label: '蛋糕', pattern: /蛋糕/ },
    { label: '奶茶', pattern: /奶茶/ },
    { label: '咖啡', pattern: /咖啡/ },
  ];
  const qualifiedCategory = qualifiedCategories.find(row => targetText.includes(row.label));
  const qualifierKey = qualifiedCategory
    ? knownRouteKey(targetText.replace(qualifiedCategory.label, ''))
    : '';
  if (qualifiedCategory && qualifierKey.length >= 2) {
    const qualified = candidateItems.map((item, index) => ({ item, index })).filter(({ item }) => {
      const name = clean(item?.name, 240);
      if (!qualifiedCategory.pattern.test(name) || qualifiedCategory.exclude?.test(name) || !knownRouteKey(name).includes(qualifierKey)) return false;
      return true;
    }).sort((left, right) => {
      const leftPromo = Number(left.item?.price) > 0 && Number(left.item.price) <= 1.01 ? 0 : 1;
      const rightPromo = Number(right.item?.price) > 0 && Number(right.item.price) <= 1.01 ? 0 : 1;
      const leftVisibleIndex = Number.isInteger(left.item?.buttonIndex) ? left.item.buttonIndex : left.index;
      const rightVisibleIndex = Number.isInteger(right.item?.buttonIndex) ? right.item.buttonIndex : right.index;
      return leftPromo - rightPromo || leftVisibleIndex - rightVisibleIndex || left.index - right.index;
    })[0]?.item;
    if (qualified) return qualified;
  }
  if (qualifiedCategory && qualifierKey.length < 2) {
    const firstCategoryItem = candidateItems.map((item, index) => ({ item, index })).filter(({ item }) => {
      const name = clean(item?.name, 240);
      return qualifiedCategory.pattern.test(name) && !qualifiedCategory.exclude?.test(name);
    }).sort((left, right) => {
      const leftPromo = Number(left.item?.price) > 0 && Number(left.item.price) <= 1.01 ? 0 : 1;
      const rightPromo = Number(right.item?.price) > 0 && Number(right.item.price) <= 1.01 ? 0 : 1;
      const leftVisibleIndex = Number.isInteger(left.item?.buttonIndex) ? left.item.buttonIndex : left.index;
      const rightVisibleIndex = Number.isInteger(right.item?.buttonIndex) ? right.item.buttonIndex : right.index;
      return leftPromo - rightPromo || leftVisibleIndex - rightVisibleIndex || left.index - right.index;
    })[0]?.item;
    if (firstCategoryItem) return firstCategoryItem;
  }
  if (allowShortFoodAlias && (Array.from(targetKey).length === 2 || requiredTitleTerms.length > 1)) {
    const firstContained = candidateItems.map((item, index) => ({
      item, index,
      visibleIndex: Number.isInteger(item?.buttonIndex) ? item.buttonIndex : index,
    })).filter(({ item }) => {
      const candidateKey = comparableProductKey(item?.name);
      const allTermsPresent = requiredTitleTerms.every(term => candidateKey.includes(term));
      if (!allTermsPresent) return false;
      return explicitPack || targetText === '撒汤' || productMatchesSavedItem(item?.name, itemName);
    })
      .sort((left, right) => left.visibleIndex - right.visibleIndex || left.index - right.index)[0]?.item;
    if (firstContained) return firstContained;
  }
  const chosen = candidateItems
    .filter(item => productMatchesSavedItem(item?.name, itemName))
    .map((item, index) => {
      const name = clean(item?.name, 240);
      const key = comparableProductKey(name);
      const undecoratedName = name.replace(/^(?:(?:[（(【[]\s*)?(?:招牌|热销|推荐)(?:\s*[）)】\]])?[\s·:：-]*)+/u, '');
      const rank = (name.startsWith(targetText) || undecoratedName.startsWith(targetText)) ? 0
        : (productKeysEquivalent(key, targetKey) || key.startsWith(targetKey)) ? 1 : 2;
      return { item, index, rank, length: name.length };
    })
    .sort((left, right) => left.rank - right.rank || left.length - right.length || left.index - right.index)[0];
  if (chosen && chosen.rank <= 1) return chosen.item;
  // A user-provided contiguous core term of at least two characters is a valid
  // match when the real menu adds a long flavour/style prefix or suffix, e.g.
  // “西瓜” -> “当季鲜切麒麟西瓜”. Bundle and fruit-serving filtering already
  // happened above, so a single item still cannot silently become a multi-cup,
  // mixed-fruit or multi-person offer.
  const containedAliasMinimum = allowShortFoodAlias ? 2 : 4;
  if (allowContainedAlias && chosen && Array.from(targetKey).length >= containedAliasMinimum) {
    const chosenName = clean(chosen.item?.name, 240);
    const keywordAt = chosenName.indexOf(targetText);
    if (keywordAt >= 0) return chosen.item;
  }
  if (chosen && /(?:套餐|组合|礼包|整箱|多包|多罐)/i.test(targetText)
    && merchantNameMatchScore(targetText, chosen.item?.name) >= 80) return chosen.item;
  // A user may intentionally leave the exact KFC single item to the role
  // ("汉堡、薯条、蛋挞、可乐").  In that case choose a real single item from
  // the requested category, but never let a combo/bucket masquerade as it.
  const categoryPatterns = {
    '汉堡': /(?:汉堡|鸡腿堡|牛肉堡|鳕鱼堡|虾堡|田园堡)/,
    '薯条': /(?:薯条|[大中小]薯)/,
    '蛋挞': /蛋挞/,
    '可乐': /可乐/,
    '鸡翅': /(?:鸡翅|烤翅|翅中|翅根)/,
    '辣翅': /(?:辣翅|香辣鸡翅)/,
    '炸鸡': /(?:炸鸡|原味鸡|鸡块|鸡米花)/,
    '脆鸡腿堡': /(?:劲脆鸡腿汉堡|脆鸡腿(?:汉堡|堡))/,
    '香辣鸡腿堡': /(?:香辣鸡腿汉堡|香辣鸡腿堡)/,
    '鸡米花': /鸡米花/,
    '红豆派': /红豆派/,
    '草莓圣代': /草莓圣代/,
    '酸梅汤': /酸梅汤/,
    // A clarified restaurant request may deliberately relax an unavailable
    // full title to the visible core word “撒汤”.  In that narrow case the
    // first real card containing the exact core word is the requested item;
    // a one-person combo is allowed because that is how these shops expose the
    // soup together with its sides.
    '撒汤': /撒汤/,
    // The user may intentionally leave the soup/drink unspecified. In that
    // case any real single item whose title contains “汤” is acceptable, and
    // the first visible qualified result should win.
    '汤': /汤/,
    '原味鸡': /原味鸡/,
    '薯片': /(?:薯片|马铃薯片|土豆片)/,
  };
  const category = categoryPatterns[targetText];
  if (!category) return null;
  const bundle = targetText === '撒汤'
    ? /(?:双杯|两杯|2杯|双人餐|多人餐|三人餐|四人餐|全家桶|整箱|买一送一)/i
    : /(?:双杯|两杯|2杯|套餐|组合|礼包|整箱|多包|多罐|买一送一|全家桶|多人餐|双人餐|三人餐|四人餐|桶餐|拼盘|\+|＋)/i;
  const categoryItems = (Array.isArray(items) ? items : [])
    .filter(item => category.test(clean(item?.name, 240)) && !bundle.test(clean(item?.name, 240)))
    .map((item, index) => ({ item, index, length: clean(item?.name, 240).length }));
  if (targetText === '薯片' || targetText === '汤' || targetText === '撒汤') return categoryItems[0]?.item || null;
  return categoryItems.sort((left, right) => left.length - right.length || left.index - right.index)[0]?.item || null;
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
  if (/麦当劳|mcdonald/i.test(query)) return 'mcdonalds';
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
  if (brand === 'mcdonalds') return /麦当劳|mcdonald/i.test(name);
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
    .replace(/鸡腿汉堡/g, '鸡腿堡')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function requestedKfcItems(value) {
  const source = clean(value, 300);
  if (!/(?:肯德基|\bkfc\b)/i.test(source)) return [];
  // Client role actions carry structured fields such as
  // “用户明确；门店=肯德基；商品=汉堡、薯条”.  Only the 商品 field is a cart
  // checklist; treating 门店= or 用户明确 as products blocks checkout after
  // the real requested items have already been added.
  const structuredItems = source.match(/(?:^|[；;])\s*商品\s*=\s*([^；;]+)/)?.[1];
  const stripped = clean(structuredItems || source, 300)
    .replace(/(?:肯德基|\bkfc\b)/gi, ' ')
    .replace(/(?:帮我|给我|想吃|要吃|来点|点一份|点一些|随便点|单点|单品)/g, ' ');
  const items = stripped.split(/[\s，,、；;和与]+/u)
    .map(item => clean(item.replace(/^(?:再来|加|配|还有)(?:一个|一份)?/u, ''), 60))
    .filter(item => item && !/^(?:不要|不加|少|多|无糖|零糖|常温|热|冰|去冰|微辣|中辣|特辣)/.test(item));
  return [...new Set(items)];
}

export function kfcDefaultSignatureBundleRequested(value) {
  const source = clean(value, 500);
  if (!/(?:肯德基|\bkfc\b)/i.test(source)) return false;
  // “不得重复单点套餐内商品” protects the bundle from duplicate add-ons;
  // it is not a request to abandon the bundle and order a standalone item.
  // Remove negated single-item clauses before detecting an affirmative
  // “单点” choice, and do not mistake “不要套餐内重复商品” for “不要套餐”.
  const affirmativeChoice = source.replace(/(?:不要|不得|不能|禁止|避免|不可|不许)[^，,；;。]{0,40}单点[^，,；;。]*/gu, ' ');
  const rejectsBundle = /(?:不要|不点|排除)(?:这(?:个|份)?|任何)?(?:招牌汉堡4件套|吃堡堡4件套|门店首页现有四件套|套餐)(?!内|中|里|已有|包含)/u.test(source);
  if (rejectsBundle || /(?:只|全部|单独)?(?:要)?单点/u.test(affirmativeChoice)) return false;
  if (/(?:招牌(?:汉堡)?|吃堡堡)(?:4件套|套餐)|门店(?:首页)?(?:现有|当前)(?:的)?(?:4|四)件套/u.test(source)) return true;
  if (/套餐(?:里|内|中)(?:已经|已有|包含|有)/u.test(source)) return true;
  if (/(?:随便(?:点|选)?|任意|都(?:可以|行)|你(?:来)?(?:决定|点|选)|你看着(?:点|选)?)/u.test(source)) return true;
  return requestedKfcItems(source).length >= 2;
}

export function kfcHomepageSignatureBundle(items) {
  return (Array.isArray(items) ? items : []).find(item => {
    const name = clean(item?.name, 140);
    if (!/(?:4|四)件套/u.test(name) || !/(?:汉堡|吃堡|堡堡)/u.test(name)) return false;
    return !/(?:双人|多人|全家|分享|桶|十块|10块|3拼|三拼)/u.test(name);
  }) || null;
}

export function kfcItemCoveredByText(itemName, value) {
  const item = clean(itemName, 80);
  const text = clean(value, 2000);
  const patterns = {
    '汉堡': /汉堡|鸡腿堡|牛肉堡|鳕鱼堡|虾堡|田园堡|肉霸堡/,
    '薯条': /薯条|(?:大|中|小)薯/,
    '可乐': /可乐|百事/,
    '蛋挞': /蛋挞/,
    '鸡翅': /鸡翅|烤翅|辣翅|翅中|翅根/,
    '辣翅': /辣翅|香辣鸡翅/,
    '炸鸡': /炸鸡|原味鸡|鸡块|鸡米花/,
    '脆鸡腿堡': /劲脆鸡腿汉堡|脆鸡腿(?:汉堡|堡)/,
    '香辣鸡腿堡': /香辣鸡腿汉堡|香辣鸡腿堡/,
    '鸡米花': /鸡米花/,
    '红豆派': /红豆派/,
    '草莓圣代': /草莓圣代/,
    '酸梅汤': /酸梅汤/,
    '汤': /汤/,
  };
  const pattern = patterns[item] || (item ? new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : null);
  return Boolean(pattern && pattern.test(text));
}

export function selectedOptionsCoverItem(itemName, selectedOptionsText) {
  const item = clean(itemName, 140);
  const selected = clean(selectedOptionsText, 3000);
  if (!item || !selected) return false;
  if (kfcItemCoveredByText(item, selected)) return true;
  const itemKey = knownRouteKey(item);
  const selectedKey = knownRouteKey(selected);
  return itemKey.length >= 2 && selectedKey.includes(itemKey);
}

export function kfcStandaloneSearchTerm(itemName) {
  const item = clean(itemName, 80);
  // KFC exposes these standalone products under their full menu titles. The
  // conversational shorthands can otherwise produce a false empty result.
  if (item === '辣翅') return '香辣鸡翅';
  if (item === '草莓圣代') return '经典草莓圣代';
  return item;
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

export function requestedStoreItemName(value, storeQuery = '') {
  if (mcdonaldsDefaultBundleRequested(`${value} ${storeQuery}`)) return mcdonaldsBreakfastBundleOptions.product;
  if (kfcDefaultSignatureBundleRequested(`${value} ${storeQuery}`)) return kfcSignatureBundle.product;
  const kfcItems = requestedKfcItems(value);
  if (kfcItems.length) return kfcItems[0];
  let source = clean(value, 160);
  const store = clean(storeQuery, 100);
  if (store) {
    const index = source.indexOf(store);
    if (index >= 0) source = clean(`${source.slice(0, index)} ${source.slice(index + store.length)}`, 160);
  }
  // The adapter deliberately serializes a multi-item checklist as
  // “主商品 加商品2 加商品3”. Only the first item belongs in the current
  // store-search field; the remaining items are handled one at a time by
  // addRequestedStandaloneItems after the first add succeeds.
  source = source.replace(/\s+(?:加|再来|配)(?:一个|一份)?\s*[^\s，,、；;。！？!?]{1,24}/gu, ' ');
  return requestedItemName(source);
}

export function requestedMealSide(value) {
  return requestedExtraItems(value).find(item => /茶叶蛋/.test(item)) || '';
}

export function requestedExtraItems(value) {
  const kfcItems = requestedKfcItems(value);
  if (kfcItems.length) return kfcItems.slice(1);
  const source = clean(value, 240);
  // `加` is an action word here, not the first character of a longer verb.
  // Without the boundary, an explanatory phrase such as “添加标题含冰豆浆的
  // 唯一商品” was misread as a second product literally named
  // “标题含冰豆浆的唯一商品”.
  const items = [...source.matchAll(/(?:(?<!添)加(?:一个|一份)?|添加(?:一个|一份)|(?:再来|配)(?:一个|一份)?)\s*([^\s，,、；;。！？!?]{1,24})/gu)]
    .filter(match => {
      const prefix = source.slice(Math.max(0, (match.index || 0) - 28), match.index || 0);
      // Only positive add-on instructions may create cart requirements.  A
      // sentence such as “不得再加第二杯饮品” used to be misread as a request
      // for another drink because the old guard only recognised immediate
      // “不加”.  Keep the check local to this action so “不足起送价时加小料”
      // remains a valid positive instruction.
      return !/(?:不(?:额外|另外)?$|(?:不得|不能|不要|不再|不允许|不可以|不准|不许|勿|别|禁止|严禁|避免)[^，,、；;。！？!?]{0,16}$)/u.test(prefix);
    })
    .map(match => clean(match[1], 60)
      // Natural requests commonly put the quantity after the product name
      // (“加茶叶蛋一份”) while the canonical checklist puts it before the
      // name (“加一份茶叶蛋”).  Both mean one identical required item; keeping
      // the trailing counter created a phantom fourth product and restarted
      // store search after the real three-item cart was already complete.
      .replace(/(?:一|1)\s*(?:份|个|杯)$/u, '')
      .trim())
    .filter(item => item
      // Exclude bare specification words, but do not reject genuine products
      // whose names begin with one of them (for example “冰豆浆”).
      && !/^(?:糖|冰|热|温|奶油|椰乳|燕麦奶|辣|香菜)$/u.test(item)
      // Generic category words authorize the bounded top-up flow; they are
      // not product names and must never be submitted as an in-shop search.
      && !/^(?:(?:不同|不重复|其他|其它|任意|随便|若干|多种|几个|几份)(?:的)?)?(?:(?:同店|店内|本店|可凑单)(?:的)?)?(?:小料|加料|配料|小吃)$/u.test(item)
      && !/(?:^|的)(?:小料|加料|配料|小吃)$/u.test(item)
      && !/(?:第二杯|另一杯|再一杯|额外一杯).*(?:饮品|奶茶|咖啡|果茶)/.test(item));
  return [...new Set(items)];
}

const milkTeaToppingKey = value => {
  const text = clean(value, 100);
  const aliases = [
    ['脆波波', /脆(?:波波|啵啵)/], ['奶冻', /奶冻/], ['小西米', /小西米|西米/],
    ['黑糖珍珠', /黑糖(?:珍珠|波波)/], ['珍珠', /珍珠/], ['冻冻', /冻冻/], ['椰果', /椰果/],
    ['葡萄肉', /葡萄肉/], ['奶麻薯', /奶麻薯/], ['麻薯', /麻薯/], ['芝士奶盖', /芝士奶盖/],
    ['雪糯米', /(?:雪|血)糯米/], ['大多肉', /大多肉/], ['小多肉', /小多肉/], ['厚芋泥', /厚芋泥/], ['西柚粒', /西柚粒/],
    ['芋圆', /芋圆/], ['布丁', /布丁/], ['仙草', /仙草/], ['红豆', /红豆/], ['椰奶冻', /椰奶冻/],
  ];
  return aliases.find(([, pattern]) => pattern.test(text))?.[0] || '';
};

export function requestedMilkTeaToppingPreferences(value) {
  const source = clean(value, 300);
  const preferred = requestedExtraItems(source).map(milkTeaToppingKey).filter(Boolean);
  // One add verb can govern several coordinated toppings: “加葡萄肉和芋圆”
  // must create two hard requirements rather than one merged label.
  for (const segment of source.matchAll(/(?:加|放|配)([^，,；;。！？!?]{1,80})/gu)) {
    for (const mention of segment[1].matchAll(/脆(?:波波|啵啵)|奶冻|小西米|西米|黑糖(?:珍珠|波波)|珍珠|冻冻|椰果|葡萄肉|奶麻薯|麻薯|芝士奶盖|(?:雪|血)糯米|大多肉|小多肉|厚芋泥|西柚粒|芋圆|布丁|仙草|红豆|椰奶冻/gu)) {
      const key = milkTeaToppingKey(mention[0]);
      if (key) preferred.push(key);
    }
  }
  const excluded = [];
  const mentions = /脆(?:波波|啵啵)|奶冻|小西米|西米|黑糖(?:珍珠|波波)|珍珠|冻冻|椰果|葡萄肉|奶麻薯|麻薯|芝士奶盖|(?:雪|血)糯米|大多肉|小多肉|厚芋泥|西柚粒|芋圆|布丁|仙草|红豆|椰奶冻/gu;
  for (const match of source.matchAll(mentions)) {
    const prefix = source.slice(Math.max(0, (match.index || 0) - 20), match.index || 0);
    if (/(?:不要|别|不得|不能|不允许|不可以|不准|不许|勿|禁止|排除|去除|去掉|移除)(?:再)?(?:加|放|要|选)?[^，,、；;。！？!?]{0,6}$/u.test(prefix)) {
      const key = milkTeaToppingKey(match[0]);
      if (key) excluded.push(key);
    }
  }
  return {
    preferred: [...new Set(preferred)].filter(key => !excluded.includes(key)),
    excluded: [...new Set(excluded)],
  };
}

const milkTeaToppingPhrase = value => {
  const remainder = clean(value, 120)
    .replace(/脆(?:波波|啵啵)|奶冻|小西米|西米|黑糖(?:珍珠|波波)|珍珠|冻冻|椰果|葡萄肉|奶麻薯|麻薯|芝士奶盖|(?:雪|血)糯米|大多肉|小多肉|厚芋泥|西柚粒|芋圆|布丁|仙草|红豆|椰奶冻/gu, '')
    .replace(/(?:和|与|及|以及|还有|再|、|\/)/gu, '')
    .trim();
  return !remainder;
};

export function requestedStandaloneItems(value, coveredBy = '') {
  const kfcItems = requestedKfcItems(value);
  if (kfcItems.length) {
    // Generic bundle descriptors identify the one homepage product. They are
    // never standalone add-ons and must not be submitted to store search.
    let explicitItems = kfcItems.filter(item => !/(?:招牌汉堡4件套|吃堡堡4件套|门店(?:首页)?(?:现有|当前)(?:的)?(?:4|四)件套|首页(?:现有|当前)(?:的)?(?:4|四)件套)/u.test(item));
    const hasStructuredChecklist = /(?:^|[；;])\s*商品\s*=/u.test(clean(value, 800));
    if (kfcDefaultSignatureBundleRequested(value) && !hasStructuredChecklist) {
      // Conversational task text also contains workflow clauses such as
      // “重新测试”“不得搜索套餐名”. Only real food words may become KFC
      // standalone add-ons when there is no explicit 商品= checklist.
      explicitItems = explicitItems.filter(item => /汉堡|鸡腿堡|鸡排堡|鸡翅|辣翅|烤翅|鸡块|鸡米花|蛋挞|薯条|派|圣代|土豆泥|可乐|果汁|饮料|酸梅汤|三柠茶|咖啡|鸡肉卷|鸡腿串|香骨鸡|原味鸡|炸鸡/u.test(item));
    }
    const items = kfcDefaultSignatureBundleRequested(value) ? explicitItems : kfcItems.slice(1);
    return items.filter(item => !selectedOptionsCoverItem(item, coveredBy));
  }
  const modifiers = /^(?:珍珠|椰果|冻冻|奶冻|芋圆|西米|布丁|仙草|红豆|椰奶冻|脆啵啵|麻薯|糖|冰|热|温|奶油|椰乳|燕麦奶|浓缩|辣|香菜)$/;
  return requestedExtraItems(value).filter(item => !modifiers.test(item) && !milkTeaToppingPhrase(item)
    && !selectedOptionsCoverItem(item, coveredBy));
}

// Some meal-side requests put a hard size before the product name even though
// Eleme exposes that size only inside the product's SKU sheet.  Keep the menu
// search bounded to the real product title, then require the exact live option
// before it can be added.  This is intentionally narrow: words such as “大份”
// remain part of ordinary product titles unless the item is a known meal side
// whose size is selected separately on the current platform.
export function standaloneItemSpecIntent(value) {
  const requestedName = clean(value, 120);
  const match = requestedName.match(/^(大份|中份|小份)\s*((?:土家)?酱香饼)$/u);
  return match
    ? { requestedName, productName: match[2], requiredOption: match[1] }
    : { requestedName, productName: requestedName, requiredOption: '' };
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
  const matches = [...body.matchAll(/(?:闪购红包|红包优惠|配送费红包|店铺\/商品红包)[^。；\n]{0,24}?[-−]\s*[¥￥]?\s*(\d+(?:\.\d+)?)/g)]
    .map(match => Number(match[1]) || 0).filter(value => value > 0);
  return matches.length ? Math.max(...matches) : 0;
}

const singleItemCategoryPattern = value => {
  const name = clean(value, 160);
  return [/(?:汉堡|鸡腿堡|牛肉堡|鳕鱼堡|虾堡|田园堡)/, /(?:薯条|[大中小]薯)/, /(?:鸡翅|烤翅|翅中|翅根)/, /蛋挞/, /可乐/]
    .find(pattern => pattern.test(name)) || null;
};

const singleItemCategoryMatches = (actualName, expectedName) => {
  const actual = clean(actualName, 160);
  if (/(?:套餐|组合|全家桶|多人餐|双人餐|桶餐|拼盘)/.test(actual)) return false;
  const category = singleItemCategoryPattern(expectedName);
  return Boolean(category && category.test(actual));
};

export function cartItemVerification(items = [], expectedNames = [], { allowRepeatedSnack = false } = {}) {
  const rows = (Array.isArray(items) ? items : []).map(item => ({
    name: clean(item?.name, 160), quantity: Math.max(0, Math.floor(Number(item?.quantity) || 0)),
  })).filter(item => item.name);
  const duplicates = rows.filter(item => item.quantity !== 1
    && !(allowRepeatedSnack && snackTopUpEligible(item.name))).map(item => item.name);
  const missing = (Array.isArray(expectedNames) ? expectedNames : []).map(name => clean(name, 160)).filter(Boolean)
    .filter(name => !rows.some(item => productMatchesSavedItem(item.name, name)
      || productMatchesSavedItem(name, item.name) || singleItemCategoryMatches(item.name, name)
      || singleFruitItemMatches(item.name, name)));
  return { ok: !duplicates.length && !missing.length, rows, duplicates, missing };
}

export function couponCheckoutState(raw, url = '') {
  const body = clean(raw, 12_000).replace(/(\d)\s+\.(\d)/g, '$1.$2');
  const applied = appliedCouponAmount(body);
  if (applied > 0) return { status: 'applied', amount: applied, evidence: 'checkout_applied_discount' };
  const available = availableCouponAmount(body);
  if (available > 0) return { status: 'available', amount: available, evidence: 'checkout_available_coupon' };
  if (/(?:闪购红包|配送费红包|优惠券|红包)[^。；\n]{0,36}(?:无可用|暂无可用|没有可用|0\s*张可用|均不可用)/.test(body)) {
    return { status: 'none', amount: 0, evidence: 'checkout_explicit_none' };
  }
  // A fully rendered checkout page with no coupon offer is still a completed
  // coupon inspection.  A loading/non-checkout page remains unknown and must
  // never be allowed to submit as if it had been checked.
  if (checkoutPageReady(url, body) && /(?:合计|实付|商品金额|配送费)/.test(body)) {
    return { status: 'none', amount: 0, evidence: 'checkout_scanned_no_offer' };
  }
  return { status: 'unknown', amount: 0, evidence: 'checkout_not_verifiable' };
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

const foodCategoryContext = value => clean(value, 300)
  .replace(/(?:主)?页面|界面|方面|表面|里面|外面|前面|后面/gu, '');

export function milkTeaTopUpEligible(value) {
  const text = foodCategoryContext(value);
  if (!text) return false;
  // Coffee and meal orders must never be padded with milk-tea toppings.  Those
  // categories need a normal same-category item or an explicit user choice.
  if (/咖啡|美式|馥芮白|摩卡|卡布奇诺|浓缩|生椰拿铁|主食|米饭|炒饭|盖饭|面|粉|粥|汉堡|炸鸡|鸡翅|薯条|披萨|卷饼|套餐|肯德基|\bkfc\b|麦当劳/i.test(text)) return false;
  return /奶茶|果茶|茶饮|冰奶|鲜奶茶|茶拿铁|奶绿|奶盖|茉莉|葡萄|杨枝甘露|柠檬茶|椰椰|啵啵|茶百道|喜茶|霸王茶姬|奈雪|蜜雪冰城|古茗/i.test(text);
}

export function shortFoodTitleAliasEligible(value) {
  const text = foodCategoryContext(value);
  if (!text) return false;
  // The user's two-character title shortcut is for ordinary food whose real
  // menu name is long.  Trained drink routes keep their existing exact
  // product/specification logic, so “茉莉” or “葡萄” cannot bypass cup size,
  // sugar, temperature, toppings, or single-cup safeguards.
  return !/(?:奶茶|果茶|茶饮|冰奶|鲜奶茶|茶拿铁|奶绿|奶盖|茉莉|葡萄|杨枝甘露|柠檬茶|椰椰|啵啵|茶百道|喜茶|霸王茶姬|奈雪|蜜雪冰城|古茗|咖啡|美式|拿铁|馥芮白|摩卡|卡布奇诺|浓缩|瑞幸|luckin|库迪|星巴克|manner)/i.test(text);
}

export function requestedSinglePersonSoupCombo(value, itemName) {
  const text = clean(value, 800);
  return clean(itemName, 80) === '撒汤'
    && /(?:单人套餐|一人套餐|1\s*人套餐|(?:要|选|点|判断)[^。；;，,]{0,16}套餐|套餐[^。；;，,]{0,16}(?:要|选|点|判断))/.test(text);
}

export function multiServingEligible(value) {
  const text = clean(value, 300);
  if (!text) return false;
  if (/肯德基|\bkfc\b|麦当劳|主食|米饭|炒饭|盖饭|面|粉|粥|汉堡|炸鸡|鸡翅|薯条|披萨|卷饼|便当|套餐饭|奶茶|果茶|茶饮|冰奶|鲜奶茶|茶拿铁|奶绿|奶盖|茉莉|葡萄|杨枝甘露|柠檬茶|椰椰|啵啵|茶百道|喜茶|霸王茶姬|奈雪/i.test(text)) return false;
  if (/瑞幸(?:咖啡)?|luckin/i.test(text)) return true;
  return false;
}

export function mealSideTopUpEligible(value) {
  const text = foodCategoryContext(value);
  if (!text || /咖啡|美式|拿铁|奶茶|果茶|茶饮|冰奶|肯德基|\bkfc\b|麦当劳|汉堡|炸鸡|鸡翅|薯条|披萨/i.test(text)) return false;
  return /主食|米饭|炒饭|盖饭|面|粉|粥|便当|馄饨|饺子|包子/i.test(text);
}

export function milkTeaToppingCandidates(items = [], mainItem = '') {
  const main = knownRouteKey(mainItem);
  // Milk-tea-only vocabulary learned from the user's normal add-on choices.
  // Keep both common platform spellings (脆波波/脆啵啵) and longer labels;
  // matching these words never authorizes a full second drink.
  const topping = /冻冻|椰果|葡萄肉|奶冻|黑糖(?:珍珠|波波)|珍珠|芋圆|小西米|西米|布丁|仙草|红豆|椰奶冻|脆(?:啵啵|波波)|奶麻薯|麻薯|芝士奶盖|(?:雪|血)糯米|大多肉|小多肉|厚芋泥|西柚粒|小料/i;
  const fullDrink = /奶茶|果茶|茶饮|冰奶|鲜奶茶|茶拿铁|奶绿|奶盖(?:茶|奶茶|果茶|饮品)|柠檬水|果霸|咖啡|美式|拿铁|豆乳.*麻薯|米麻薯|\d+\s*杯(?:装|套餐)?|双杯|两杯|买一送一/i;
  const nonFood = /盲盒|盲袋|积木|玩具|挂件|冰箱贴|钥匙扣|周边/i;
  const eligible = (Array.isArray(items) ? items : []).filter(item => {
    const name = clean(item?.name || item, 140);
    const description = clean(item?.description, 500);
    // Storefront add-on products are ordered with their platform default
    // (normally 分装), so a warning against mixing one into a fruit/hot drink
    // does not make that separately packed topping ineligible.
    return !/\+?\s*\d+\s*份起售/.test(description)
      && Number(item?.price ?? 1) > 0 && !fullDrink.test(name) && !nonFood.test(name);
  });
  return eligible.map(item => clean(item?.name || item, 140)).filter((name, index, all) => {
    const key = knownRouteKey(name);
    return name && topping.test(name) && key !== main && all.findIndex(other => knownRouteKey(other?.name || other) === key) === index;
  });
}

export function mealSnackCandidates(items = [], mainItem = '') {
  const main = knownRouteKey(mainItem);
  const snack = /茶叶蛋|卤蛋|煎蛋|荷包蛋|鸡蛋|小酥肉|鸡排|鸡腿|鸡翅|锅贴|春卷|小笼包|小笼|蒸饺|煎饺|凉菜|小菜|海带|豆皮|豆腐|拍黄瓜|酸梅汤|豆浆/i;
  const eligible = (Array.isArray(items) ? items : []).filter(item => !/\+?\s*\d+\s*份起售/.test(clean(item?.description, 300)) && Number(item?.price ?? 1) > 0);
  return eligible.map(item => clean(item?.name || item, 140)).filter((name, index, all) => {
    const key = knownRouteKey(name);
    return name && snack.test(name) && key !== main && all.findIndex(other => knownRouteKey(other?.name || other) === key) === index;
  });
}

export function snackTopUpEligible(value) {
  const text = clean(value, 300);
  return /薯片|零食|饼干|锅巴|辣条|海苔|坚果|肉脯|果冻|糖果|巧克力/i.test(text);
}

export function snackTopUpCandidates(items = [], mainItem = '') {
  const main = knownRouteKey(mainItem);
  const snack = /薯片|饼干|锅巴|辣条|海苔|坚果|肉脯|果冻|糖果|巧克力|豆干|面筋|小鱼仔|鸡丝|干脆面/i;
  const nonFood = /盲盒|盲袋|玩具|挂件|钥匙扣|周边/i;
  const bundle = /(?:双杯|两杯|2杯|\d+\s*件装|套餐|组合|礼包|整箱|多包|多罐|买一送一|\+|＋)/i;
  return (Array.isArray(items) ? items : []).filter(item => {
    const name = clean(item?.name || item, 140);
    return name && snack.test(name) && !nonFood.test(name) && !bundle.test(name)
      && !/\+?\s*\d+\s*份起售/.test(clean(item?.description, 300))
      && Number(item?.price ?? 1) > 0;
  }).map(item => clean(item?.name || item, 140)).filter((name, index, all) => {
    const key = knownRouteKey(name);
    return key !== main && all.findIndex(other => knownRouteKey(other?.name || other) === key) === index;
  });
}

export function fruitTopUpEligible(value) {
  return /水果捞|水果拼盘|果切|切果|西瓜|哈密瓜|葡萄|草莓|芒果|火龙果|菠萝|橙子|脐橙|猕猴桃|蓝莓|香蕉/i.test(clean(value, 300));
}

export function singleFruitKeyword(value) {
  const source = clean(value, 240);
  if (!source || /(?:拼|混合|果盘|水果捞|组合|套餐)/.test(source)) return '';
  if (/西瓜/.test(source)) return '西瓜';
  if (/芒果/.test(source)) return '芒果';
  if (/(?:橙子|脐橙|鲜橙)/.test(source)) return '橙子';
  return '';
}

export function fruitServingWeightGrams(value) {
  const source = clean(value, 500).toLowerCase();
  const weights = [...source.matchAll(/(\d+(?:\.\d+)?)\s*(kg|千克|公斤|g|克|斤)/giu)].map(match => {
    const amount = Number(match[1]) || 0;
    if (/^(?:kg|千克|公斤)$/iu.test(match[2])) return amount * 1000;
    if (match[2] === '斤') return amount * 500;
    return amount;
  }).filter(weight => weight > 0);
  return weights.length ? Math.max(...weights) : 0;
}

export function fruitServingEligible(value) {
  const source = clean(value, 500);
  if (/(?:大桶|桶装|水果桶|果桶|西瓜桶|芒果桶|橙子桶|含桶|半个|整个|夹心|夹馅|夹乌梅|乌梅|酸奶|奶油|果酱|蘸料|爆珠|大口吃芒果)/u.test(source)) return false;
  const weight = fruitServingWeightGrams(source);
  const maximum = singleFruitKeyword(source) === '西瓜' ? 500 : 250;
  return weight > 0 && weight <= maximum;
}

export function singleFruitItemMatches(actualName, expectedName) {
  const expected = singleFruitKeyword(expectedName);
  return Boolean(expected && singleFruitKeyword(actualName) === expected && fruitServingEligible(actualName));
}

export function requestedFruitExclusions(value) {
  const source = clean(value, 1200);
  const fruits = ['西瓜', '哈密瓜', '葡萄', '草莓', '芒果', '火龙果', '菠萝', '橙子', '脐橙', '猕猴桃', '蓝莓', '香蕉'];
  return fruits.filter(fruit => {
    const escaped = fruit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const before = new RegExp(`(?:不要(?:点|加|选|买|放)?|别(?:点|加|选|买|放)?|禁止(?:点|加|选|买|放)?|排除|去掉|不吃|不爱吃|不喜欢|不想吃|不点)\\s*${escaped}(?=[，。；、\\s]|$)`, 'u');
    const after = new RegExp(`${escaped}\\s*(?:不要(?:点|加|选|买|放)?|别(?:点|加|选|买|放)?|禁止(?:点|加|选|买|放)?|排除|去掉|不吃|不爱吃|不喜欢|不想吃|不点)(?=[，。；、\\s]|$)`, 'u');
    const except = new RegExp(`除了\\s*${escaped}(?=[，。；、\\s]|不要|别|都|其|外|以|$)`, 'u');
    return before.test(source) || after.test(source) || except.test(source);
  });
}

function fruitExclusionMatches(name, excluded = []) {
  const key = knownRouteKey(name);
  return excluded.some(fruit => {
    const fruitKey = knownRouteKey(fruit);
    if (fruit === '橙子') return /橙子|脐橙|鲜橙/.test(key);
    if (fruit === '脐橙') return /脐橙/.test(key);
    return fruitKey && key.includes(fruitKey);
  });
}

export function fruitTopUpCandidates(items = [], mainItem = '', request = '') {
  const main = knownRouteKey(mainItem);
  const excluded = requestedFruitExclusions(request);
  const fruit = /水果捞|水果拼盘|果切|切果|西瓜|哈密瓜|葡萄|草莓|芒果|火龙果|菠萝|橙|猕猴桃|蓝莓|香蕉/i;
  const drink = /果茶|奶茶|饮料|果汁|冰淇淋|冰激凌|酸奶饮品/i;
  const bundle = /(?:双杯|两杯|2杯|\d+\s*件装|套餐|组合|礼包|整箱|多盒|多杯|买一送一|\+|＋)/i;
  return (Array.isArray(items) ? items : []).filter(item => {
    const name = clean(item?.name || item, 140);
    return name && fruit.test(name) && !fruitExclusionMatches(name, excluded) && !drink.test(name) && !bundle.test(name)
      && fruitServingEligible(fruitServingWeightGrams(name) > 0 ? name : `${name} ${item?.description || ''}`)
      && !/\+?\s*\d+\s*份起售/.test(clean(item?.description, 300)) && Number(item?.price ?? 1) > 0;
  }).map(item => clean(item?.name || item, 140)).filter((name, index, all) => {
    const key = knownRouteKey(name);
    return key !== main && all.findIndex(other => knownRouteKey(other?.name || other) === key) === index;
  });
}

export function dessertTopUpEligible(value) {
  return /巧克力蛋糕|蛋糕|甜品|慕斯/i.test(clean(value, 300));
}

export function dessertTopUpCandidates(items = [], mainItem = '') {
  const main = knownRouteKey(mainItem);
  const dessert = /蛋糕|甜品|慕斯|泡芙|布丁|蛋挞|曲奇|面包|可颂|司康/i;
  const drink = /奶茶|果茶|咖啡|饮料|果汁/i;
  const bundle = /(?:双杯|两杯|2杯|\d+\s*件装|套餐|组合|礼包|整箱|买一送一|\+|＋)/i;
  return (Array.isArray(items) ? items : []).filter(item => {
    const name = clean(item?.name || item, 140);
    return name && dessert.test(name) && !drink.test(name) && !bundle.test(name)
      && !/\+?\s*\d+\s*份起售/.test(clean(item?.description, 300)) && Number(item?.price ?? 1) > 0;
  }).map(item => clean(item?.name || item, 140)).filter((name, index, all) => {
    const key = knownRouteKey(name);
    return key !== main && all.findIndex(other => knownRouteKey(other?.name || other) === key) === index;
  });
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
    let match = pattern
      ? body.match(new RegExp(`${pattern}[^×]{0,180}×\\s*(\\d+)`, 'i'))
      : null;
    const category = singleItemCategoryPattern(name);
    const bundle = /(?:套餐|组合|全家桶|多人餐|双人餐|桶餐|拼盘)/;
    if (match && category && !bundle.test(name) && bundle.test(match[0])) match = null;
    if (!match) {
      const candidates = category ? [...body.matchAll(new RegExp(`([^×]{0,100}${category.source}[^×]{0,100})×\\s*(\\d+)`, 'gi'))] : [];
      const categoryMatch = candidates.find(candidate => !bundle.test(candidate[1]));
      if (categoryMatch) match = [categoryMatch[0], categoryMatch[2]];
    }
    if (!match) {
      const fruit = singleFruitKeyword(name);
      const fruitPattern = fruit === '橙子' ? '(?:橙子|脐橙|鲜橙)' : fruit;
      const candidates = fruitPattern
        ? [...body.matchAll(new RegExp(`([^×]{0,100}${fruitPattern}[^×]{0,100})×\\s*(\\d+)`, 'gi'))]
        : [];
      const fruitMatch = candidates.find(candidate => singleFruitKeyword(candidate[1]) === fruit);
      if (fruitMatch) match = [fruitMatch[0], fruitMatch[2]];
    }
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

export function minimumOrderInfo(raw, itemPrice = 0, quantity = 1, visibleCartAmount = 0) {
  const body = clean(raw, 12_000);
  const amount = value => Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
  const shortfallMatch = body.match(/(?:还差|差)\s*[¥￥]?\s*(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:起送|可结算)/);
  // “差¥9.1起送” describes the shortfall, not a ¥9.1 minimum.  Exclude
  // amounts immediately owned by 差/还差 before accepting an explicit
  // “¥20起送” label.  When the storefront only exposes the shortfall, the
  // cart footer's genuine total lets us reconstruct the threshold exactly.
  const thresholdMatch = [...body.matchAll(/[¥￥]\s*(\d+(?:\.\d+)?)\s*起送/g)]
    .find(match => !/(?:还差|差)\s*$/.test(body.slice(Math.max(0, (match.index || 0) - 8), match.index)))
    || body.match(/起送(?:价|金额)?\s*[¥￥]?\s*(\d+(?:\.\d+)?)/);
  const shortfall = number(shortfallMatch?.[1]);
  const unitPrice = amount(itemPrice);
  const currentQuantity = Math.max(1, Number(quantity) || 1);
  const followingAmounts = shortfallMatch
    ? [...body.slice((shortfallMatch.index || 0) + shortfallMatch[0].length, (shortfallMatch.index || 0) + shortfallMatch[0].length + 180)
      .matchAll(/[¥￥]\s*(\d+(?:\.\d+)?)/g)].map(match => amount(match[1])).filter(value => value > 0)
    : [];
  const cartAmount = amount(visibleCartAmount) || followingAmounts[0] || 0;
  const baseCurrent = cartAmount > 0 ? cartAmount : amount(unitPrice * currentQuantity);
  const threshold = number(thresholdMatch?.[1]) || (shortfall > 0 && baseCurrent > 0 ? amount(baseCurrent + shortfall) : 0);
  const current = threshold > 0 && shortfall > 0 ? Math.max(0, amount(threshold - shortfall)) : baseCurrent;
  const minimumQuantity = threshold > 0 && unitPrice > 0 ? Math.max(currentQuantity + 1, Math.ceil(threshold / unitPrice)) : 0;
  return { threshold, shortfall: shortfall || (threshold > current ? amount(threshold - current) : 0), current, minimumQuantity };
}

export function menuCardPrice(raw) {
  const text = clean(raw, 1200);
  const priceSource = /预估到手|预估价/.test(text) ? text.split(/预估到手|预估价/)[0] : text;
  const prices = [...priceSource.matchAll(/[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/g)]
    .map(match => number(`${match[1]}${match[2] ? `.${match[2]}` : ''}`)).filter(value => value > 0);
  if (!prices.length) return 0;
  return prices.length > 1 && /折|特价|限\s*\d+\s*份/.test(text) ? Math.min(...prices) : prices.at(-1);
}

export function menuCardName(titleText, cardText) {
  const direct = clean(titleText, 1000);
  // Some Mor custom-title wrappers exist but expose empty innerText. Recover
  // only from the same product card so a neighbouring title can never leak in.
  const source = !direct || /^(?:选规格|选套餐|加购|加入购物车)$/.test(direct)
    ? clean(cardText, 1200) : direct;
  return clean(source.split(/月售|近期\d+人|\d+(?:\.\d+)?折|限\s*\d+\s*份|[¥￥]/)[0], 60)
    .replace(/^(热销|大家喜欢吃，才叫真好吃)\s*/, '')
    .replace(/\s*\d+天内\d+人下单.*$/, '')
    .replace(/\s+\d+次$/, '');
}

export class TaobaoFlashBrowser {
  constructor({ profile, headless = false, timeout = 30_000, cdpUrl = '', cdpPort = 0 } = {}) {
    this.profile = profile || './profile';
    this.headless = headless;
    this.timeout = timeout;
    this.executablePath = process.env.PHONE_DELIVERY_CHROME_PATH || '';
    this.cdpUrl = clean(cdpUrl || process.env.PHONE_DELIVERY_CDP_URL, 500);
    const requestedPort = Number(cdpPort || process.env.PHONE_DELIVERY_CDP_PORT || 9222);
    this.cdpPort = Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535 ? requestedPort : 9222;
    this.browser = null;
    this.edgeProcess = null;
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
    this.riskBlocked = false;
    this.riskBlockReason = '';
    this.riskStatePath = path.join(path.resolve(this.profile), 'risk-state.json');
    this.lastStoreSearchAt = 0;
    this.lastStoreSearchKey = '';
    this.lastStoreSearchUrl = '';
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
    const endpoint = `http://127.0.0.1:${this.cdpPort}`;
    const profile = path.resolve(this.profile);
    let ready = false;
    try { ready = (await fetch(`${endpoint}/json/version`, { cache: 'no-store' })).ok; } catch {}
    if (!ready) {
      const child = spawn(this.executablePath, [
        `--remote-debugging-port=${this.cdpPort}`, `--user-data-dir=${profile}`, '--no-first-run', MSITE,
      ], { detached: true, stdio: 'ignore', windowsHide: false });
      this.edgeProcess = child;
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

  async forceClose() {
    if (this.attached) await this.browser?.close().catch(() => {});
    else await this.context?.close().catch(() => {});
    if (this.edgeProcess && !this.edgeProcess.killed) this.edgeProcess.kill();
    this.edgeProcess = null;
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

  async openMarketplaceSearch(query) {
    const target = `https://h5.ele.me/search/?keyword=${encodeURIComponent(clean(query, 100))}`;
    let page = await this.goto(target, 2500);
    if (shopSearchUrl(page.url())) {
      // After leaving a store, the marketplace search URL can be hijacked by
      // the store-local SPA router and keep the merchant name as an in-store
      // keyword.  Reset to the marketplace home once, then retry the exact
      // merchant-only URL.  Never continue from a store-local search page.
      await this.goto(MSITE, 1800);
      page = await this.goto(target, 2500);
    }
    if (shopSearchUrl(page.url())) throw new Error('淘宝闪购全局商家搜索被店内搜索页拦截，本轮已停止且没有把门店名当成商品名');
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
      entry && typeof entry === 'object' && (shopUrl(entry.shopUrl) || shopSearchUrl(entry.shopUrl)) && clean(entry.itemName, 140) && now - Number(entry.savedAt || 0) < 30 * 24 * 60 * 60_000
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
    // A verified store-local result is a better product route than the store
    // homepage: reopening it avoids another search submission and preserves
    // the exact card used for option inspection and cart creation.
    if (!queryKey || !(shopUrl(ref?.shopUrl) || shopSearchUrl(ref?.shopUrl)) || !clean(ref?.itemName, 140)) return;
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
      // Fixed cooldown timestamps belonged to the retired policy and must not
      // block a new user request after this upgrade. Only the new state marker
      // means that the current page still needs to be checked once.
      this.riskBlocked = parsed?.blocked === true;
      this.riskBlockReason = clean(parsed?.reason, 40);
    } catch (_) {
      this.riskBlocked = false;
      this.riskBlockReason = '';
    }
    if (!this.riskBlocked) this.riskBlockReason = '';
  }
  async recordRiskChallenge(kind) {
    await fs.mkdir(this.profile, { recursive: true });
    await this.loadRiskState();
    this.riskBlocked = true;
    this.riskBlockReason = clean(kind, 40) || '安全验证';
    await fs.writeFile(this.riskStatePath, JSON.stringify({ blocked: true, reason: this.riskBlockReason, observedAt: Date.now() }, null, 2), 'utf8');
  }
  async clearRiskChallenge() {
    this.riskBlocked = false;
    this.riskBlockReason = '';
    await fs.mkdir(this.profile, { recursive: true });
    await fs.writeFile(this.riskStatePath, JSON.stringify({ blocked: false, reason: '', observedAt: 0 }, null, 2), 'utf8');
  }
  async assertRiskCooldown() {
    await this.loadRiskState();
    if (!this.riskBlocked) return;
    // A challenge blocks only the operation that encountered it. Each new,
    // explicitly authorized request may inspect the current page once. If the
    // challenge has disappeared, continue immediately without a fixed timer.
    const page = this.page && !this.page.isClosed?.() ? this.page : await this.ensure().catch(() => null);
    if (!page) throw new Error('无法确认淘宝闪购验证状态，本轮已停止且不会自动重搜');
    const kind = riskChallengeKind(await this.riskText(page));
    if (!kind || await this.dismissCloseableRiskOverlay(page, kind)) {
      await this.clearRiskChallenge();
      return;
    }
    throw new Error(`当前页面仍显示${kind || this.riskBlockReason || '安全验证'}，本轮已停止；验证状态仍存在时不会自动重搜`);
  }
  async confirmRiskClearedByUser() {
    const page = await this.ensure();
    const kind = riskChallengeKind(await this.riskText(page));
    if (kind) throw new Error(`页面仍显示${kind}，请本人完成后再确认`);
    const body = clean(await page.locator('body').innerText().catch(() => ''), 12_000);
    if (!body || this.needsLogin(page)) throw new Error('当前外卖页面尚未恢复到可用状态，不能提前解除安全验证状态');
    await this.clearRiskChallenge();
    return { cleared: true, url: clean(page.url(), 1000) };
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
        '[class*="punish" i] [class*="close" i]', '[id*="captcha" i] [class*="close" i]',
        'img[alt*="关闭"]', '[data-spm*="close" i]',
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
    throw new Error(`淘宝闪购出现${kind}，等待本人完成验证已超时；本轮已暂停，新的用户请求可在验证消失后立即继续，系统不会自动重复搜索`);
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

  async search(query, limit = 12, { allowGlobalSearch = true, storeQuery = '', intentText = '', menuSelectionAllowed = false, searchResultSelectionAllowed = false, forceMerchantEntry = false } = {}) {
    // `query` is the adapter's canonical structured checklist (for example
    // “曼玲粥 皮蛋瘦肉粥 加茶叶蛋 加酱香饼”).  `intentText` carries the
    // original conversational constraints.  Never let the latter replace the
    // checklist: a natural sentence may name all products without repeating
    // the add verb, which previously made explicit sides disappear and opened
    // the generic minimum-order top-up path.
    const requestQuery = clean([query, intentText].filter(Boolean).join(' '), 600);
    const maxDistanceKm = requestedMaxDistanceKm(requestQuery);
    const autonomousMenuItems = items => (Array.isArray(items) ? items : []).filter(item => {
      const name = clean(item?.name, 240);
      if (!name) return false;
      if (milkTeaTopUpEligible(`${storeQuery} ${query} ${name}`)
        && /(?:双杯|两杯|\d+\s*杯(?:装|套餐)?|买一送一|多人分享|组合装)/i.test(name)) return false;
      return true;
    });
    await this.assertRiskCooldown();
    if (requestedKfcItems(query).some(item => /(?:组合|全家桶|多人餐|双人餐|桶餐|拼盘)/.test(item))) {
      throw new Error('KFC 默认只使用首页招牌套餐并逐件补齐缺项，不会用组合、全家桶或多人分享餐替代');
    }
    const startedAt = Date.now();
    let humanWaitMs = 0;
    const assertWithinSearchTime = () => {
      if (Date.now() - startedAt - humanWaitMs > 35_000) throw new Error('淘宝闪购搜索超过35秒，本轮已结束且不会自动重试');
    };
    const waitForHumanVerification = async page => {
      humanWaitMs += await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      // Do not reject a result that finished painting at the deadline. Callers
      // read the current page immediately after this gate; the next loop or
      // navigation still invokes assertWithinSearchTime before taking another
      // search action. Thus a visible exact card can finish the same task
      // without granting any extra search submission.
    };
    const routeItemQuery = requestedStoreItemName(query, storeQuery);
    const allowShortFoodAlias = shortFoodTitleAliasEligible(`${storeQuery} ${requestQuery} ${routeItemQuery}`);
    const preferSinglePersonCombo = requestedSinglePersonSoupCombo(requestQuery, routeItemQuery);
    const mcdonaldsHomepageOnly = mcdonaldsDefaultBundleRequested(`${requestQuery} ${storeQuery} ${routeItemQuery}`);
    const kfcHomepageOnly = kfcDefaultSignatureBundleRequested(`${requestQuery} ${storeQuery} ${routeItemQuery}`);
    const homepageOnly = mcdonaldsHomepageOnly || kfcHomepageOnly;
    const fruitHomepageFirst = Boolean(singleFruitKeyword(routeItemQuery));
    // A fresh merchant-entry request is used for an explicit end-to-end test
    // (or when the current store-search history cannot safely return home).
    // It bypasses shortcuts but still performs the normal bounded merchant
    // search -> merchant storefront -> single product search sequence.
    // A user-authorized broad choice must inspect today's live search results;
    // a remembered SKU or an already open homepage could otherwise select a
    // different product than the first eligible result the user can see.
    const freshMerchantEntry = forceMerchantEntry || searchResultSelectionAllowed;
    const remembered = freshMerchantEntry ? null : await this.knownRoute(query);
    const stored = freshMerchantEntry ? [] : await this.knownRoutesFor(query, 12, true);
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
        let page = await this.enterShop(0, { preferSaved: true });
        if ((fruitHomepageFirst || homepageOnly) && shopSearchUrl(page.url())) page = await this.returnToStorefrontWithoutRefresh(page);
        await this.requireLogin(page); await waitForHumanVerification(page);
        if (menuSelectionAllowed && !mcdonaldsHomepageOnly) {
          const visibleMenu = autonomousMenuItems(await this.extractMenu(page, Math.max(12, limit), ''));
          const menuOffers = visibleMenu.slice(0, limit).map(item => ({
            merchantId: shop.storeId || 'saved-shop', merchant: shop.name, name: item.name,
            description: item.description, price: item.price, deliveryFee: 0, total: item.price,
            rating: shop.rating, monthlySales: shop.monthlySales, etaMinutes: shop.etaMinutes,
            couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: false,
            browserRef: {
              shopIndex: 0, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex,
              detailUrl: item.detailUrl || '', shopUrl: page.url(),
              query: `${shop.name} ${item.name}`, merchant: shop.name, merchantId: shop.storeId || '',
            },
          }));
          if (menuOffers.length) return menuOffers;
        }
        const repeat = await this.repeatPurchase(page, rememberedRoute.itemName, requestQuery);
        if (repeat && !repeat.requiresConfirmation) {
          return [{
            merchantId: shop.storeId || 'saved-shop', merchant: shop.name, name: rememberedRoute.itemName,
            description: clean(`历史订单：${repeat.summary}`, 240), price: repeat.total, deliveryFee: 0,
            total: repeat.total, rating: shop.rating, monthlySales: shop.monthlySales, etaMinutes: shop.etaMinutes,
            couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: true,
            requiresConfirmation: repeat.requiresConfirmation,
            confirmationReason: repeat.confirmationReason,
            browserRef: {
              shopIndex: 0, itemName: rememberedRoute.itemName, unitPrice: repeat.total,
              buttonIndex: -1, detailUrl: '', shopUrl: shop.anchorUrl || shop.directUrl, query: requestQuery,
              merchant: shop.name, merchantId: shop.storeId || '', repeatPurchase: true,
              repeatSummary: repeat.summary, repeatQuantity: repeat.quantity,
              requiresConfirmation: repeat.requiresConfirmation,
            },
          }];
        }
        if (fruitHomepageFirst) await this.openFruitPromotionCategory(page).catch(() => false);
        let searchedInsideShop = false;
        if (!homepageOnly && shopSearchUrl(page.url()) && !storeSearchTermMatches(page.url(), routeItemQuery)) {
          searchedInsideShop = await this.searchInsideShop(page, routeItemQuery);
          if (searchedInsideShop) await waitForHumanVerification(page);
        }
        let items = await this.extractMenu(page, Math.max(12, limit), routeItemQuery);
        // A remembered shop is only a route shortcut. It must not pin a
        // previously chosen SKU when the current request deliberately leaves
        // several matching flavours/sizes open; choose the first currently
        // visible qualified product for this request instead.
        let item = preferredExactProduct(items, routeItemQuery, { allowContainedAlias: searchedInsideShop, allowShortFoodAlias, preferSinglePersonCombo })
          || (kfcHomepageOnly ? kfcHomepageSignatureBundle(items) : null)
          || items.find(row => productMatchesSavedItem(row.name, rememberedRoute.itemName));
        if (!item && !searchedInsideShop && !homepageOnly && await this.searchInsideShop(page, routeItemQuery)) {
          await waitForHumanVerification(page);
          items = await this.extractMenu(page, Math.max(12, limit), routeItemQuery);
          item = preferredExactProduct(items, routeItemQuery, { allowContainedAlias: true, allowShortFoodAlias, preferSinglePersonCombo })
            || items.find(row => productMatchesSavedItem(row.name, rememberedRoute.itemName));
        }
        if (item) {
          const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
          return [{
            merchantId: shop.storeId || 'saved-shop', merchant: shop.name, name: item.name,
            description: item.description, price: item.price, deliveryFee, total: item.price + deliveryFee,
            rating: shop.rating, monthlySales: shop.monthlySales, etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel,
            optionGroups: [], optionsLoaded: false,
            browserRef: { shopIndex: 0, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex, detailUrl: '', shopUrl: page.url(), query: requestQuery, merchant: shop.name, merchantId: shop.storeId || '' },
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
    let activePage = !freshMerchantEntry && this.page && !this.page.isClosed?.() && (shopUrl(this.page.url()) || shopSearchUrl(this.page.url())) ? this.page : null;
    if (activePage && (fruitHomepageFirst || homepageOnly) && shopSearchUrl(activePage.url())) activePage = await this.returnToStorefrontWithoutRefresh(activePage);
    if (activePage) {
      await this.requireLogin(activePage); await waitForHumanVerification(activePage);
      const activeUrl = activePage.url();
      const activeBody = clean(await activePage.locator('body').innerText().catch(() => ''), 12_000);
      const brand = preferredBrand(query);
      const requestedStoreKey = knownRouteKey(storeQuery);
      const activeStoreMatches = requestedStoreKey
        ? (preferredBrand(storeQuery) ? activeShopMatchesBrand(storeQuery, activeUrl, activeBody) : knownRouteKey(activeBody).includes(requestedStoreKey))
        : activeShopMatchesBrand(query, activeUrl, activeBody);
      if (activeStoreMatches) {
        const itemQuery = requestedStoreItemName(query, storeQuery);
        const merchant = clean(activeBody.match(/(?:商家|环境)\s+(.{2,50}?)(?:\s+评分|\s+买过|\s+热销)/)?.[1], 50)
          || (brand === 'chabaidao' ? '茶百道（当前门店）' : '当前商家');
        if (menuSelectionAllowed && !mcdonaldsHomepageOnly) {
          const visibleMenu = autonomousMenuItems(await this.extractMenu(activePage, Math.max(12, limit), ''));
          const menuOffers = visibleMenu.slice(0, limit).map(item => ({
            merchantId: 'active-shop', merchant, name: item.name, description: item.description,
            price: item.price, deliveryFee: 0, total: item.price, rating: 0, monthlySales: 0,
            etaMinutes: 0, couponLabel: '', optionGroups: [], optionsLoaded: false,
            browserRef: {
              shopIndex: 0, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex,
              detailUrl: item.detailUrl || '', shopUrl: activeUrl, query: `${merchant} ${item.name}`,
              merchant, merchantId: 'active-shop',
            },
          }));
          if (menuOffers.length) return menuOffers;
        }
        const repeat = await this.repeatPurchase(activePage, itemQuery, requestQuery);
        if (repeat && !repeat.requiresConfirmation) {
          return [{
            merchantId: 'active-shop', merchant: clean(activeBody.match(/(?:商家|环境)\s+(.{2,50}?)(?:\s+评分|\s+买过|\s+热销)/)?.[1], 50) || '当前商家',
            name: itemQuery, description: clean(`历史订单：${repeat.summary}`, 240), price: repeat.total,
            deliveryFee: 0, total: repeat.total, rating: 0, monthlySales: 0, etaMinutes: 0,
            couponLabel: '', optionGroups: [], optionsLoaded: true,
            requiresConfirmation: repeat.requiresConfirmation,
            confirmationReason: repeat.confirmationReason,
            browserRef: {
              shopIndex: 0, itemName: itemQuery, unitPrice: repeat.total, buttonIndex: -1,
              detailUrl: '', shopUrl: activeUrl, query: requestQuery, merchant: '当前商家', merchantId: 'active-shop',
              repeatPurchase: true, repeatSummary: repeat.summary, repeatQuantity: repeat.quantity,
              requiresConfirmation: repeat.requiresConfirmation,
            },
          }];
        }
        if (fruitHomepageFirst) await this.openFruitPromotionCategory(activePage).catch(() => false);
        let searchedInsideShop = false;
        if (!homepageOnly && shopSearchUrl(activePage.url()) && !storeSearchTermMatches(activePage.url(), itemQuery)) {
          searchedInsideShop = await this.searchInsideShop(activePage, itemQuery);
          if (searchedInsideShop) await waitForHumanVerification(activePage);
        }
        let items = await this.extractMenu(activePage, Math.max(12, limit), itemQuery);
        let item = preferredExactProduct(items, itemQuery, { allowContainedAlias: searchedInsideShop, allowShortFoodAlias, preferSinglePersonCombo })
          || (kfcHomepageOnly ? kfcHomepageSignatureBundle(items) : null);
        if (!item && !searchedInsideShop && !homepageOnly && await this.searchInsideShop(activePage, itemQuery)) {
          await waitForHumanVerification(activePage);
          items = await this.extractMenu(activePage, Math.max(12, limit), itemQuery);
          item = preferredExactProduct(items, itemQuery, { allowContainedAlias: true, allowShortFoodAlias, preferSinglePersonCombo });
        }
        if (item) {
          const ref = {
            shopIndex: 0, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex,
            detailUrl: item.detailUrl || '', shopUrl: activePage.url(), query: requestQuery, merchant, merchantId: 'active-shop',
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
    // The marketplace search locates only the merchant. Every product is
    // searched separately after entering that storefront.
    const brandQuery = clean(storeQuery, 100) || (/(?:肯德基|\bkfc\b)/i.test(query) ? '肯德基' : clean(query, 160).split(/\s+/)[0]);
    const marketplaceQuery = brandQuery;
    const page = await this.openMarketplaceSearch(marketplaceQuery);
    await this.requireLogin(page); await waitForHumanVerification(page);
    const brand = preferredBrand(query);
    const productOnlyItem = requestedStoreItemName(query, '');
    let shops = [];
    // Product-search cards can paint their prices and skeletons several
    // seconds before the structured merchant/product titles arrive.  Reusing
    // the same loaded result page is safer than declaring "not found" and
    // issuing another marketplace search, which also raises verification risk.
    for (let attempt = 0; attempt < 36; attempt += 1) {
      assertWithinSearchTime();
      await waitForHumanVerification(page);
      // A product-only marketplace search renders product previews beneath
      // each merchant. Passing the product as a "store name" makes those
      // previews outrank the real merchant title and the click opens nothing.
      shops = await this.extractShops(page, storeQuery ? brandQuery : '');
      const completeCard = storeQuery
        ? shops.some(shop => marketplaceMatchScore(shop, storeQuery) > 0)
        : brand ? shops.some(shop => brandMatches(brand, shop.name))
          : shops.some(shop => marketplaceMatchScore(shop, productOnlyItem) > 0);
      if (shops.length && completeCard) break;
      shops = [];
      await page.waitForTimeout(500);
    }
    if (storeQuery) {
      // Sponsored cards can still appear before the requested merchant. Rank
      // every visible card and exclude zero-overlap merchants; branch suffixes
      // and product aliases remain valid through the normalized score.
      shops = shops.map((shop, order) => ({ shop, order, score: marketplaceMatchScore(shop, storeQuery) }))
        .filter(row => row.score > 0 && (!maxDistanceKm || (row.shop.distanceKm > 0 && row.shop.distanceKm <= maxDistanceKm)))
        .sort((left, right) => right.score - left.score || left.order - right.order)
        .slice(0, 1)
        .map(row => row.shop);
    } else if (brand) {
      const exact = shops.filter(shop => brandMatches(brand, shop.name));
      if (exact.length) shops = exact.slice(0, Math.min(3, Math.max(1, limit)));
    } else {
      // With only a product name, the first outer card may be an unrelated
      // sponsored merchant. Scan every visible card and move cards that expose
      // the requested product in their shop title or preview ahead of the rest.
      const itemName = requestedStoreItemName(query, '');
      shops = shops.map((shop, order) => ({ shop, order, score: marketplaceMatchScore(shop, itemName) }))
        .filter(row => row.score > 0)
        .sort((left, right) => right.score - left.score || left.order - right.order)
        .map(row => row.shop);
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
      if (homepageOnly && shopSearchUrl(shopPage.url())) shopPage = await this.returnToStorefrontWithoutRefresh(shopPage);
      await waitForHumanVerification(shopPage);
      const itemQuery = requestedStoreItemName(query, storeQuery);
      if (searchResultSelectionAllowed && !homepageOnly && await this.searchInsideShop(shopPage, itemQuery)) {
        await waitForHumanVerification(shopPage);
        const searchItems = autonomousMenuItems(await this.extractMenu(shopPage, Math.max(20, limit), itemQuery));
        for (const item of searchItems.slice(0, Math.max(1, limit - offers.length))) {
          const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
          offers.push({
            merchantId: shop.storeId || String(shopIndex), merchant: shop.name, name: item.name,
            description: item.description, price: item.price, deliveryFee, total: item.price + deliveryFee,
            rating: shop.rating, monthlySales: shop.monthlySales, etaMinutes: shop.etaMinutes,
            couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: false,
            browserRef: {
              shopIndex, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex,
              detailUrl: item.detailUrl || '', shopUrl: shopPage.url(), query: requestQuery,
              merchant: shop.name, merchantId: shop.storeId || '',
            },
          });
        }
        if (searchItems.length) continue;
      }
      if (menuSelectionAllowed && !homepageOnly) {
        const visibleMenu = autonomousMenuItems(await this.extractMenu(shopPage, Math.max(12, limit), ''));
        for (const item of visibleMenu.slice(0, Math.max(1, limit - offers.length))) {
          const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
          offers.push({
            merchantId: shop.storeId || String(shopIndex), merchant: shop.name, name: item.name,
            description: item.description, price: item.price, deliveryFee, total: item.price + deliveryFee,
            rating: shop.rating, monthlySales: shop.monthlySales, etaMinutes: shop.etaMinutes,
            couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: false,
            browserRef: {
              shopIndex, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex,
              detailUrl: item.detailUrl || '', shopUrl: shopPage.url(), query: `${shop.name} ${item.name}`,
              merchant: shop.name, merchantId: shop.storeId || '',
            },
          });
        }
        if (visibleMenu.length) continue;
      }
      const repeat = await this.repeatPurchase(shopPage, itemQuery, requestQuery);
      if (repeat && !repeat.requiresConfirmation) {
        offers.push({
          merchantId: shop.storeId || String(shopIndex), merchant: shop.name, name: itemQuery,
          description: clean(`历史订单：${repeat.summary}`, 240), price: repeat.total, deliveryFee: 0,
          total: repeat.total, rating: shop.rating, monthlySales: shop.monthlySales,
          etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: true,
          requiresConfirmation: repeat.requiresConfirmation,
          confirmationReason: repeat.confirmationReason,
          browserRef: {
            shopIndex, itemName: itemQuery, unitPrice: repeat.total, buttonIndex: -1, detailUrl: '',
            shopUrl: shop.anchorUrl || '', query: requestQuery, merchant: shop.name, merchantId: shop.storeId || '',
            repeatPurchase: true, repeatSummary: repeat.summary, repeatQuantity: repeat.quantity,
            requiresConfirmation: repeat.requiresConfirmation,
          },
        });
        if (offers.length >= limit) break;
        continue;
      }
      // The offer quota is not a safe scan quota. A highly relevant second
      // card can outrank the first visually matching product, so retain enough
      // real rows to apply the user's first-visible rule after extraction.
      if (fruitHomepageFirst) await this.openFruitPromotionCategory(shopPage).catch(() => false);
      let searchedInsideShop = false;
      if (!homepageOnly && shopSearchUrl(shopPage.url()) && !storeSearchTermMatches(shopPage.url(), itemQuery)) {
        searchedInsideShop = await this.searchInsideShop(shopPage, itemQuery);
        if (searchedInsideShop) await waitForHumanVerification(shopPage);
      }
      let items = await this.extractMenu(shopPage, Math.max(20, Math.ceil(limit / maxShops)), itemQuery);
      let exactItem = preferredExactProduct(items, itemQuery, { allowContainedAlias: searchedInsideShop, allowShortFoodAlias, preferSinglePersonCombo });
      if (!exactItem && kfcHomepageOnly) exactItem = kfcHomepageSignatureBundle(items);
      let exactItems = exactItem ? [exactItem] : [];
      // The outer search is only for finding candidate shops. Storefront preview
      // cards are incomplete and can contain a fuzzy match that hides the exact
      // product deeper in the menu.  A precise single item already visible on
      // the storefront (for example Luckin's signature coconut latte) is safe
      // to use directly; otherwise perform one store-local search.
      if (!searchedInsideShop && !exactItems.length && !homepageOnly) searchedInsideShop = await this.searchInsideShop(shopPage, itemQuery);
      if (searchedInsideShop) {
        await waitForHumanVerification(shopPage);
        items = await this.extractMenu(shopPage, Math.max(20, Math.ceil(limit / maxShops)), itemQuery);
        exactItem = preferredExactProduct(items, itemQuery, { allowContainedAlias: true, allowShortFoodAlias, preferSinglePersonCombo });
        exactItems = exactItem ? [exactItem] : [];
        // If the requested name is already visible, a component repaint must
        // not become a one-shot failure. Re-read this same page only: no new
        // search submission, shop switch, or widened product name.
        const wantedKey = comparableProductKey(itemQuery);
        for (let reread = 0; !exactItems.length && reread < 2; reread += 1) {
          const visibleKey = comparableProductKey(await this.riskText(shopPage));
          if (!wantedKey || !visibleKey.includes(wantedKey)) break;
          await shopPage.waitForTimeout(450);
          items = await this.extractMenu(shopPage, Math.max(20, Math.ceil(limit / maxShops)), itemQuery);
          exactItem = preferredExactProduct(items, itemQuery, { allowContainedAlias: true, allowShortFoodAlias, preferSinglePersonCombo });
          exactItems = exactItem ? [exactItem] : [];
        }
      }
      for (const item of exactItems) {
        const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
        offers.push({
          merchantId: shop.storeId || String(shopIndex), merchant: shop.name, name: item.name,
          description: item.description, price: item.price, deliveryFee,
          total: item.price + deliveryFee, rating: shop.rating, monthlySales: shop.monthlySales,
          etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: false,
          browserRef: { shopIndex, itemName: item.name, unitPrice: item.price, buttonIndex: item.buttonIndex, detailUrl: item.detailUrl || '', shopUrl: shopPage.url(), query: requestQuery, merchant: shop.name, merchantId: shop.storeId || '' },
        });
        if (offers.length >= limit) break;
      }
    }
    return offers;
  }

  async extractShops(page, storeQuery = '') {
    const leaves = await page.evaluate(() => {
      const out = [];
      function visit(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const el = node.parentElement;
          const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
          if (!el || !text || text.length > 80) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) out.push({ text, x: r.x, y: r.y + r.height / 2 });
        }
        for (const el of root.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot);
      }
      visit(document);
      // The current marketplace renders merchant and preview titles through a
      // custom rich-text element.  Its visible glyphs come from the JSON in the
      // `nodes` attribute and therefore do not exist as DOM text nodes.
      for (const rich of document.querySelectorAll('tiga-rich-text[nodes]')) {
        const box = rich.getBoundingClientRect();
        if (!(box.width > 0 && box.height > 0)) continue;
        let nodes;
        try { nodes = JSON.parse(rich.getAttribute('nodes') || '[]'); } catch { continue; }
        const rows = [];
        const read = value => {
          if (!value) return;
          if (Array.isArray(value)) { for (const item of value) read(item); return; }
          if (typeof value !== 'object') return;
          if (value.type === 'text' && typeof value.text === 'string') rows.push(value.text);
          read(value.children);
        };
        read(nodes);
        const text = rows.join('').replace(/\s+/g, ' ').trim();
        if (text && text.length <= 80) out.push({ text, x: box.x, y: box.y + box.height / 2 });
      }
      return out.slice(0, 3000);
    });
    return shopRowsFromVisibleText(leaves, storeQuery);
  }

  async enterShop(index, { preferSaved = false } = {}) {
    const shop = this.shops[index];
    if (!shop) throw new Error('真实商家已失效，请重新搜索');
    const current = await this.ensure();
    let page = current;
    if (preferSaved && shop.directUrl && !sameShopUrl(page.url(), shop.directUrl)) page = await this.goto(shop.directUrl, 2200);
    else {
      if (!preferSaved && shopUrl(page.url())) page = await this.goto(this.searchUrl, 2200);
      if (!(shopUrl(page.url()) || (preferSaved && shopSearchUrl(page.url())))) {
      if (preferSaved && shop.directUrl) page = await this.goto(shop.directUrl, 2200);
      else {
        page = page.url() === this.searchUrl ? page : await this.goto(this.searchUrl, 2200);
        // Prefer the exact structured merchant title. Marketplace card heights
        // vary with promo tags and product carousels, so a coordinate derived
        // from the “起送” row can otherwise land on a product preview.
        const richTitles = page.locator('tiga-rich-text[nodes]');
        let merchantTitle = null;
        const richTitleCount = typeof richTitles?.count === 'function' ? await richTitles.count() : 0;
        for (let titleIndex = 0; titleIndex < richTitleCount; titleIndex += 1) {
          const candidate = richTitles.nth(titleIndex);
          if (!await candidate.isVisible().catch(() => false)) continue;
          const titleText = await candidate.evaluate(node => {
            let value;
            try { value = JSON.parse(node.getAttribute('nodes') || '[]'); } catch { return ''; }
            const rows = [];
            const read = item => {
              if (!item) return;
              if (Array.isArray(item)) { for (const child of item) read(child); return; }
              if (typeof item !== 'object') return;
              if (item.type === 'text' && typeof item.text === 'string') rows.push(item.text);
              read(item.children);
            };
            read(value);
            return rows.join('').replace(/\s+/g, ' ').trim();
          }).catch(() => '');
          if (merchantNameMatchScore(shop.name, titleText) < 90) continue;
          merchantTitle = candidate;
          break;
        }
        if (merchantTitle) {
          await this.tapControl(page, merchantTitle);
          await page.waitForTimeout(900);
        }
        if (!shopUrl(page.url()) && typeof page.getByText === 'function') {
          const plainMerchantTitle = await this.visibleLocator(page.getByText(shop.name, { exact: true }), true);
          if (plainMerchantTitle) {
            await this.tapControl(page, plainMerchantTitle);
            await page.waitForTimeout(900);
          }
        }
        // `anchorY` is the selected card's own "起送" header row. The old
        // anchorY-75 offset can fall back into the previous card on the current
        // compact marketplace layout, so click around this card's header itself.
        if (!shopUrl(page.url())) {
          const cardYs = [shop.anchorY, shop.anchorY + 35, Math.max(80, shop.anchorY - 35)];
          for (const y of cardYs) {
            for (const x of [110, 190, 280]) {
              await this.tapPoint(page, x, y);
              await page.waitForTimeout(900);
              if (shopUrl(page.url())) break;
            }
            if (shopUrl(page.url())) break;
          }
        }
      }
      }
    }
    if (!(shopUrl(page.url()) || (preferSaved && shopSearchUrl(page.url())))) throw new Error('未能进入淘宝闪购商家，页面可能已变化');
    if (!shop.anchorUrl) shop.anchorUrl = page.url();
    const parsed = new URL(page.url());
    if (shopSearchUrl(page.url())) {
      shop.directUrl = page.url();
    } else {
      const direct = new URL(`${parsed.origin}${parsed.pathname}`);
      for (const key of ['shopId', 'store_id', 'restaurant_id', 'brandId', 'geohash', 'longitude', 'latitude']) {
        const value = parsed.searchParams.get(key);
        if (value) direct.searchParams.set(key, value);
      }
      shop.directUrl = direct.toString();
    }
    const storeId = parsed.searchParams.get('store_id') || parsed.searchParams.get('shopId') || '';
    shop.storeId = storeId;
    await page.waitForTimeout(500);
    await this.dismissPromoOverlays(page);
    const earlyBody = clean(await page.locator('body').innerText().catch(() => ''), 4000);
    const closedReason = shopClosedReason(earlyBody);
    if (closedReason) throw new Error(`门店已打烊：${shop.name}（${closedReason}）`);
    await this.waitForPurchaseControls(page, 8000);
    const shopBody = clean(await page.locator('body').innerText().catch(() => ''), 1800);
    const merchant = merchantFromShopText(shopBody);
    if (merchant.name) shop.name = merchant.name;
    if (merchant.rating) shop.rating = merchant.rating;
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
    let beforeBody = '';
    let initialState = { status: 'unknown', amount: 0, evidence: 'checkout_not_verifiable' };
    // The checkout shell renders before its promotion rows.  Wait only for a
    // verifiable coupon state; never turn a temporarily incomplete page into
    // “no coupon” and never continue past the bounded wait while still unknown.
    for (let attempt = 0; attempt < 16; attempt += 1) {
      beforeBody = await this.riskText(page);
      initialState = couponCheckoutState(beforeBody, page.url());
      if (initialState.status !== 'unknown') break;
      await page.waitForTimeout(250);
    }
    if (initialState.status === 'applied') return initialState;
    if (initialState.status === 'none') return initialState;
    if (initialState.status !== 'available') {
      throw new Error('没有确认优惠券检查结果，已停止提交，避免漏用可用优惠券');
    }
    const advertised = initialState.amount;
    const beforeTotal = checkoutAmounts(beforeBody).total;
    const entryText = await this.visibleLocator(page.getByText(/未选红包[^\n]{0,40}最高\s*\d+(?:\.\d+)?\s*元可用/, { exact: false }), true)
      || await this.visibleLocator(page.getByText(/最高\s*\d+(?:\.\d+)?\s*元可用/, { exact: false }), true);
    const entry = await this.visibleLocator(page.locator('.food-extra__hongbao'), true) || entryText;
    if (!entry) throw new Error(`订单显示有¥${advertised.toFixed(2)}红包可用，但没有找到红包选择入口，已停止提交`);
    // The checkout's sticky payment bar can visually cover the coupon row's
    // center point.  Dispatch on the exact verified row before falling back to
    // a coordinate tap.
    await entry.evaluate(node => node.click()).catch(() => this.tapControl(page, entry));
    await page.waitForTimeout(650);
    let openedBody = await this.riskText(page);
    const amountPattern = String(Number(advertised)).replace('.', '\\.');
    let alreadySelected = /已选\s*[1-9]\d*\s*张/.test(openedBody)
      || new RegExp(`已选\s*\d+\s*张[^。；\n]{0,30}可减\s*[¥￥]?\s*${amountPattern}\s*元?`).test(openedBody);
    const hasUnredeemedPointsOffer = /未兑换\s*(?:需|需要)\s*\d+\s*吃货豆/.test(openedBody);
    let directCoupon = null;
    const couponCardSelected = async coupon => Boolean(coupon && await coupon.evaluate(node => {
      const selected = current => {
        const state = `${current.getAttribute?.('aria-checked') || ''} ${current.getAttribute?.('aria-selected') || ''} ${current.className || ''}`;
        return /(?:^|\s)(?:true|checked|selected|active)(?:\s|$)/i.test(state);
      };
      return selected(node) || [...node.querySelectorAll('*')].some(selected);
    }).catch(() => false));
    const pointsRedemptionPromptVisible = body => /是否兑换/.test(body) && /吃货豆/.test(body)
      || /兑换将消耗\s*\d+\s*吃货豆/.test(body);
    const redeemPointsCouponIfPrompted = async (coupon, { afterConfirm = false } = {}) => {
      let promptBody = '';
      let promptVisible = false;
      let selectedAt = -1;
      const expectPointsPrompt = /未兑换\s*(?:需|需要)\s*\d+\s*吃货豆/.test(clean(await coupon.innerText().catch(() => ''), 700));
      const extendedPromptWait = afterConfirm && expectPointsPrompt;
      const promptWaitAttempts = extendedPromptWait ? 40 : 8;
      const maxPromptAttempts = extendedPromptWait ? 44 : 24;
      // The redemption dialog is painted after the coupon row first looks
      // selected.  Wait for either the real dialog or a verifiable selection;
      // otherwise a covered “确定” button can be mistaken for the next action.
      for (let attempt = 0; attempt < maxPromptAttempts; attempt += 1) {
        promptBody = await this.riskText(page);
        if (/吃货豆不足|余额不足|兑换失败/.test(promptBody)) {
          throw new Error(`¥${advertised.toFixed(2)}红包兑换失败或吃货豆不足，已停止提交`);
        }
        promptVisible = pointsRedemptionPromptVisible(promptBody);
        if (promptVisible) break;
        const selected = /已选\s*[1-9]\d*\s*张/.test(promptBody) || await couponCardSelected(coupon);
        if (selected && selectedAt < 0) selectedAt = attempt;
        // Points-backed cards can paint the dialog several seconds after the
        // transient checkmark, especially after repeated checkout attempts.
        // Only those explicit cards get the longer bounded observation.
        if (selectedAt >= 0 && attempt - selectedAt >= promptWaitAttempts) return false;
        await page.waitForTimeout(250);
      }
      if (!promptVisible) return false;
      const redeem = await this.visibleLocator(page.getByText(/^(?:立即兑换|确认兑换|兑换并使用|确认使用)$/), true);
      if (!redeem) throw new Error(`¥${advertised.toFixed(2)}红包需要消耗吃货豆，但没有找到兑换确认按钮，已停止提交`);
      // The modal button owns a framework click handler, but an overlay in
      // this H5 build can absorb a coordinate tap at the same visual center.
      // Dispatch the click on the exact verified button node first.
      await redeem.evaluate(node => node.click()).catch(() => this.tapControl(page, redeem));
      let sawSuccess = false;
      for (let attempt = 0; attempt < 32; attempt += 1) {
        await page.waitForTimeout(250);
        const body = await this.riskText(page);
        if (/吃货豆不足|余额不足|兑换失败/.test(body)) {
          throw new Error(`¥${advertised.toFixed(2)}红包兑换失败或吃货豆不足，已停止提交`);
        }
        if (/兑换成功|已成功兑换|兑换完成/.test(body)) sawSuccess = true;
        if (!pointsRedemptionPromptVisible(body)
          && (sawSuccess || /已选\s*[1-9]\d*\s*张/.test(body) || await couponCardSelected(coupon))) return true;
      }
      throw new Error(`¥${advertised.toFixed(2)}红包已点击立即兑换，但平台没有确认兑换成功，已停止提交`);
    };
    if (!alreadySelected || hasUnredeemedPointsOffer) {
      // The platform orders usable red packets before the disabled section.
      // Follow the user's stable rule: choose the first visible usable card,
      // rather than depending on a brittle amount-text match.  The list often
      // renders later than its shell, so wait for the real card rows first.
      for (let attempt = 0; attempt < 16 && !directCoupon; attempt += 1) {
        const panelBody = await this.riskText(page);
        if (/系统问题[，,]?我来康康|尝试刷新一下吧/.test(panelBody)) {
          throw new Error('平台红包页暂时异常，已停止本次优惠券检查；不会重复打开或按原价提交');
        }
        if (!/ele-select-hongbao|选择红包/i.test(`${page.url()} ${panelBody}`)) {
          throw new Error('平台红包页没有保持打开，已停止本次优惠券检查；不会重复打开或按原价提交');
        }
        const couponCards = page.locator('.shtc-base-coupon__wrap');
        for (let index = 0; index < await couponCards.count().catch(() => 0); index += 1) {
          const candidate = couponCards.nth(index);
          if (!await candidate.isVisible().catch(() => false)) continue;
          const text = clean(await candidate.innerText().catch(() => ''), 700);
          const classes = clean(await candidate.getAttribute('class').catch(() => ''), 300);
          if (!text || /不可用原因|已失效/.test(text) || /(?:^|\s)disable(?:d)?(?:\s|$)/i.test(classes)) continue;
          directCoupon = candidate;
          break;
        }
        if (!directCoupon) await page.waitForTimeout(250);
      }
    }
    const panelBody = await this.riskText(page);
    if (/系统问题[，,]?我来康康|尝试刷新一下吧/.test(panelBody)) {
      throw new Error('平台红包页暂时异常，已停止本次优惠券检查；不会重复打开或按原价提交');
    }
    if (!/ele-select-hongbao|选择红包/i.test(`${page.url()} ${panelBody}`)) {
      throw new Error('平台红包页没有保持打开，已停止本次优惠券检查；不会重复打开或按原价提交');
    }
    let directRequiresPoints = false;
    if (directCoupon) {
      const directText = clean(await directCoupon.innerText().catch(() => ''), 700);
      // Eleme paints “已选1张” before the points-backed coupon has actually
      // been redeemed.  The coupon card's own “未兑换” state wins.
      directRequiresPoints = /未兑换\s*(?:需|需要)\s*\d+\s*吃货豆/.test(directText);
      if (directRequiresPoints) alreadySelected = false;
    }
    if (!alreadySelected && directCoupon) {
      const explicitUse = await this.visibleLocator(directCoupon.getByText(/^(?:选择|使用|立即使用|兑换|立即兑换)$/), true).catch(() => null);
      const toggle = explicitUse
        // The points-backed card itself owns Eleme's real click handler.  Its
        // descendant `right-checkstyle` node is only artwork and does not
        // bubble a usable selection event on this H5 build.
        || (directRequiresPoints ? directCoupon : await this.visibleLocator(directCoupon.locator('[role="radio"], [role="checkbox"], [aria-checked], [class*="radio"], [class*="check"], [class*="select"]'), true).catch(() => null))
        || directCoupon;
      const promptAlreadyOpen = pointsRedemptionPromptVisible(await this.riskText(page));
      if (!promptAlreadyOpen) await this.tapControl(page, toggle);
      const redeemed = await redeemPointsCouponIfPrompted(directCoupon);
      for (let attempt = 0; attempt < 24; attempt += 1) {
        openedBody = await this.riskText(page);
        alreadySelected = /已选\s*[1-9]\d*\s*张/.test(openedBody)
          || new RegExp(`(?:已选\s*\d+\s*张[^。；\n]{0,30}可减|已选择|已使用)[^。；\n]{0,30}[¥￥]?\s*${amountPattern}\s*元?`).test(openedBody)
          || await couponCardSelected(directCoupon);
        if (alreadySelected) break;
        await page.waitForTimeout(250);
      }
      if (!alreadySelected) {
        throw new Error(redeemed
          ? `¥${advertised.toFixed(2)}红包已兑换，但平台没有确认选中，已停止提交`
          : `¥${advertised.toFixed(2)}红包点击后没有出现兑换确认或选中结果，已停止提交`);
      }
    }
    if (alreadySelected) {
      const done = await this.visibleLocator(page.getByText(/^(?:确定|完成|使用|确认|确认使用|选好了)$/), true);
      if (!done) throw new Error(`¥${advertised.toFixed(2)}红包已自动选中，但没有找到确认按钮，已停止提交`);
      await this.activateControl(page, done);
      // Points-backed coupons ask for redemption only after the first bottom
      // confirmation.  Redeem there, then confirm the now-real coupon once
      // more before returning to checkout.
      const redeemedAfterConfirm = directCoupon
        ? await redeemPointsCouponIfPrompted(directCoupon, { afterConfirm: true })
        : false;
      if (redeemedAfterConfirm && /ele-select-hongbao|选择红包/i.test(`${page.url()} ${await this.riskText(page)}`)) {
        const finalDone = await this.visibleLocator(page.getByText(/^(?:确定|完成|使用|确认|确认使用|选好了)$/), true);
        if (!finalDone) throw new Error(`¥${advertised.toFixed(2)}红包已兑换，但没有找到最终确认按钮，已停止提交`);
        await this.activateControl(page, finalDone);
      }
      for (let wait = 0; wait < 16; wait += 1) {
        await page.waitForTimeout(250);
        if (!/ele-select-hongbao|选择红包|已选\s*\d+\s*张[^。；\n]{0,30}可减/i.test(`${page.url()} ${await this.riskText(page)}`)) break;
      }
    }
    await page.locator('[data-phone-delivery-coupon]').evaluateAll(nodes => nodes.forEach(node => node.removeAttribute('data-phone-delivery-coupon'))).catch(() => {});
    const marked = alreadySelected || await page.evaluate(amount => {
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
    if (!alreadySelected && marked) {
      await this.tapControl(page, page.locator('[data-phone-delivery-coupon="1"]').first());
      const markedCoupon = page.locator('[data-phone-delivery-coupon="1"]').first();
      const redeemed = await redeemPointsCouponIfPrompted(markedCoupon);
      for (let attempt = 0; attempt < 24; attempt += 1) {
        openedBody = await this.riskText(page);
        alreadySelected = /已选\s*[1-9]\d*\s*张/.test(openedBody)
          || new RegExp(`(?:已选\s*\d+\s*张[^。；\n]{0,30}可减|已选择|已使用)[^。；\n]{0,30}[¥￥]?\s*${amountPattern}\s*元?`).test(openedBody)
          || await couponCardSelected(markedCoupon);
        if (alreadySelected) break;
        await page.waitForTimeout(250);
      }
      if (!alreadySelected) {
        throw new Error(redeemed
          ? `¥${advertised.toFixed(2)}红包已兑换，但平台没有确认选中，已停止提交`
          : `¥${advertised.toFixed(2)}红包点击后没有出现兑换确认或选中结果，已停止提交`);
      }
    }
    const done = await this.visibleLocator(page.getByText(/^(?:确定|完成|使用|确认|确认使用|选好了)$/), true);
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
    return {
      status: 'applied',
      amount: beforeTotal > 0 && afterTotal > 0 ? Math.round((beforeTotal - afterTotal) * 100) / 100 : advertised,
      evidence: 'coupon_selected_and_total_verified',
    };
  }

  async selectEarliestDeliveryWindow(page) {
    let body = await this.riskText(page);
    if (!/选择送达\s*时间/.test(body)) return '';
    const entry = await this.visibleLocator(page.getByText(/选择送达\s*时间/, { exact: false }), true);
    if (entry) {
      await this.tapControl(page, entry);
      await page.waitForTimeout(500);
      body = await this.riskText(page);
    }
    if (!/选择送达时间/.test(body)) throw new Error('预约门店要求选择送达时间，但时间面板没有打开');
    const windows = page.getByText(/^\d{1,2}:\d{2}\s*[-–—至]\s*\d{1,2}:\d{2}/, { exact: false });
    let first = null;
    let selectedText = '';
    for (let index = 0; index < await windows.count(); index += 1) {
      const candidate = windows.nth(index);
      if (!await candidate.isVisible().catch(() => false)) continue;
      first = candidate;
      selectedText = clean(await candidate.innerText().catch(() => ''), 120).match(/\d{1,2}:\d{2}\s*[-–—至]\s*\d{1,2}:\d{2}/)?.[0] || '';
      break;
    }
    if (!first || !selectedText) throw new Error('预约门店没有可验证的送达时间选项，已停止提交');
    await this.tapControl(page, first);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.waitForTimeout(250);
      body = await this.riskText(page);
      if (!/选择送达时间\s+今日/.test(body) && body.includes(selectedText)) return selectedText;
    }
    throw new Error('平台没有确认最早送达时间，已停止提交');
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

  async extractMenu(page, limit, query = '', { includeAddOnOnly = false } = {}) {
    const controls = this.purchaseControls(page);
    await this.waitForPurchaseControls(page, 8000);
    // Retail search paints the most relevant rows first, then fills selected
    // and top-ranked rows. Reading on the first add button can therefore omit
    // the actual first card. Give this one page type a small passive settle.
    if (shopSearchUrl(page.url())) await page.waitForTimeout?.(650);
    const items = [];
    for (let buttonIndex = 0; buttonIndex < Math.min(await controls.count(), 80); buttonIndex += 1) {
      const control = controls.nth(buttonIndex);
      const card = await control.evaluate((button, allowTopRows) => {
        const box = button.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0 || box.y <= 20) return null;
        let node = button;
        for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
          const retailCardWrapper = allowTopRows && /cardWrapper/i.test(String(node.className || ''));
          const accessibleNameNode = allowTopRows ? [...node.querySelectorAll('[aria-label]')].find(candidate => {
            const label = (candidate.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
            const rect = candidate.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && label.length >= 2 && label.length <= 160
              && !/按钮|价格信息|领取|搜索|购物车|综合|销量|价格|切换.*图|减购|加购|选规格|选套餐|加入购物车/.test(label);
          }) : null;
          if (!node.classList?.contains('menuItem--info') && !node.classList?.contains('cell__props') && !accessibleNameNode && !retailCardWrapper) continue;
          const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
          // The box also contains the description. Use the dedicated title
          // node so the next step can locate the same product exactly.
          const nameNode = node.querySelector('.menuItem--info-title')
            || node.querySelector('.menuItem--info-title--warp')
            || node.querySelector('.menuItem--info--box') || node.querySelector('.cell__props') || accessibleNameNode || node;
          const nameText = (retailCardWrapper ? text.split(/买过\s*\d+\s*次|[¥￥]/)[0]
            : (accessibleNameNode && nameNode === accessibleNameNode ? nameNode.getAttribute('aria-label') : nameNode.innerText) || '').replace(/\s+/g, ' ').trim();
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
            const retailPrices = retailCardWrapper ? [...text.matchAll(/[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/g)]
              .map(match => Number(`${match[1]}${match[2] ? `.${match[2]}` : ''}`)).filter(value => value > 0) : [];
            return { text, nameText, imageUrl, price: retailPrices[0] || 0 };
          }
        }
        return null;
      }, shopSearchUrl(page.url())).catch(() => null);
      if (!card || /非卖品|请勿下单/.test(card.text) || (!includeAddOnOnly && /单点不送/.test(card.text))) continue;
      const text = card.text;
      const price = Number(card.price) > 0 ? Number(card.price) : menuCardPrice(text);
      const name = menuCardName(card.nameText, text);
      if (name && price > 0) items.push({ buttonIndex, name, price, description: clean(text, 240), imageUrl: /^https:\/\//i.test(card.imageUrl || '') ? clean(card.imageUrl, 800) : '' });
    }
    if (retailShopSearchUrl(page.url())) {
      // Retail/supermarket results use accessibility labels instead of the
      // restaurant menuItem classes. Bind each visible add button to the
      // nearest product-title and price labels in its own horizontal card.
      // Do not mix these exact rows with the generic ancestor parser: its
      // button indexes can collide while referring to a different ancestor,
      // which previously dropped the first visible retail product.
      const genericItems = [...items];
      items.length = 0;
      const retailCards = await page.evaluate(() => {
        const visible = element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const adds = [...document.querySelectorAll('[aria-label*="加购"]')].filter(visible);
        const labelled = [...document.querySelectorAll('[aria-label]')].filter(visible).map(element => ({
          element, label: (element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
          box: element.getBoundingClientRect(),
        }));
        return adds.map((button, buttonIndex) => {
          const box = button.getBoundingClientRect();
          const names = labelled.filter(row => row.box.x < box.x && row.box.y >= box.y - 150 && row.box.y <= box.y + 12
            && row.label.length >= 2 && row.label.length <= 160
            && !/按钮|价格信息|领取|搜索|购物车|综合|销量|价格|切换.*图|减购|加购|选规格|选套餐|加入购物车/.test(row.label)
            && !/^(?:共\s*\d+\s*件|第\s*\d+\s*份.*|已优惠.*|[\d.]+\s*元)$/.test(row.label))
            .sort((left, right) => Math.abs(left.box.y - box.y) - Math.abs(right.box.y - box.y));
          const prices = labelled.filter(row => /价格信息/.test(row.label)
            && Math.abs(row.box.y - box.y) <= 70).sort((left, right) => Math.abs(left.box.y - box.y) - Math.abs(right.box.y - box.y));
          const name = names[0]?.label || '';
          const price = Number(prices[0]?.label.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
          let root = button;
          let description = '';
          let imageUrl = '';
          for (let depth = 0; root && depth < 12; depth += 1, root = root.parentElement) {
            const text = (root.innerText || '').replace(/\s+/g, ' ').trim();
            if (name && text.includes(name) && /¥|￥/.test(text)) {
              description = text;
              const image = root.querySelector('img');
              imageUrl = image?.currentSrc || image?.src || '';
              break;
            }
          }
          return { buttonIndex, name, price, description, imageUrl };
        }).filter(card => card.name && card.price > 0);
      }).catch(() => []);
      for (const card of retailCards) {
        if (items.some(item => item.buttonIndex === card.buttonIndex || item.name === card.name)) continue;
        items.push({
          buttonIndex: card.buttonIndex, name: clean(card.name, 140), price: card.price,
          description: clean(card.description, 240),
          imageUrl: /^https:\/\//i.test(card.imageUrl || '') ? clean(card.imageUrl, 800) : '',
        });
      }
      if (!items.length) items.push(...genericItems);
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

  async searchInsideShop(page, itemName, { riskRetry = 0 } = {}) {
    if (!(shopUrl(page?.url?.()) || shopSearchUrl(page?.url?.())) || !clean(itemName, 140)) return false;
    await this.assertRiskCooldown();
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    const query = clean(itemName, 140);
    const searchKey = knownRouteKey(query);
    const searchUrl = clean(page.url(), 1000);
    const hiddenRiskCount = () => page.evaluate(() => performance.getEntriesByType('resource')
      .filter(entry => /\/_____tmd_____\/(?:punish|newslidecaptcha)/i.test(String(entry.name || ''))).length).catch(() => 0);
    const riskResourcesBefore = await hiddenRiskCount();
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
    const currentValue = clean(await field.inputValue().catch(() => ''), 140);
    if (riskRetry === 0 && currentValue === query && this.lastStoreSearchKey === searchKey
      && this.lastStoreSearchUrl === searchUrl && Date.now() - this.lastStoreSearchAt < 30_000) return true;
    // Rapidly submitting several store-local searches is one of the strongest
    // triggers for Alibaba's image/slider challenge.  Keep each item separate,
    // but space actual submissions and never re-submit an identical live result.
    const searchGap = 3_000 - (Date.now() - this.lastStoreSearchAt);
    if (searchGap > 0) await page.waitForTimeout(searchGap);
    await this.tapControl(page, field).catch(() => {});
    await field.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
    await field.pressSequentially(query, { delay: 35 });
    const submit = await this.visibleLocator(page.getByText(/^搜索$/), true);
    if (submit) await this.tapControl(page, submit);
    else await field.press('Enter');
    this.lastStoreSearchAt = Date.now();
    this.lastStoreSearchKey = searchKey;
    this.lastStoreSearchUrl = searchUrl;
    // The SPA keeps the previous result DOM briefly after a new keyword is
    // submitted. Without a render floor, waitForContent can accept those stale
    // cards and the subsequent extraction sees the transition's empty state.
    await page.waitForTimeout(650);
    await this.waitForContent(page, 2200);
    const suggestionBody = clean(await page.locator('body').innerText().catch(() => ''), 6000);
    if (/历史搜索/.test(suggestionBody) && /猜你想搜/.test(suggestionBody)) {
      // On the retail search page the visible “搜索” text can be a plain label
      // rather than the node that owns the submit handler. The input value is
      // correct but the page remains on suggestions. Submit the same query by
      // keyboard once; this is not a second keyword or a new search task.
      await field.press('Enter');
      this.lastStoreSearchAt = Date.now();
      await page.waitForTimeout(650);
      await this.waitForContent(page, 2200);
    }
    const riskResourcesAfter = await hiddenRiskCount();
    if (riskResourcesAfter > riskResourcesBefore) {
      const visibleKind = riskChallengeKind(await this.riskText(page));
      if (visibleKind && await this.dismissCloseableRiskOverlay(page, visibleKind)) {
        await this.clearRiskChallenge();
        if (riskRetry < 1) {
          await page.waitForTimeout(3_000);
          return this.searchInsideShop(page, itemName, { riskRetry: riskRetry + 1 });
        }
      }
      await this.recordRiskChallenge('隐式安全验证');
      throw new Error('淘宝闪购店内搜索被平台隐式安全验证拦截；页面显示的“没结果”不代表商品缺失，本轮已暂停；新的用户请求可立即重新检查当前页面，但系统不会自动连续重搜');
    }
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
    const mcdonaldsHomepageOnly = mcdonaldsDefaultBundleRequested(`${ref?.merchant} ${ref?.itemName} ${ref?.query}`);
    const kfcHomepageOnly = kfcDefaultSignatureBundleRequested(`${ref?.merchant} ${ref?.itemName} ${ref?.query}`);
    if ((mcdonaldsHomepageOnly || kfcHomepageOnly) && shopSearchUrl(page.url())) page = await this.returnToStorefrontWithoutRefresh(page);
    await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
    await this.waitForPurchaseControls(page, 8000);
    if (ref.repeatPurchase) {
      const repeat = await this.repeatPurchase(page, ref.itemName, ref.query);
      if (!repeat) throw new Error('匹配的历史订单已经失效，将在下一次搜索时改用店内搜索');
      return [];
    }
    // Keep an exact product card already visible on the storefront. Store-local
    // search is a fallback only when the homepage does not expose that item.
    let button = await this.productControl(page, ref.itemName);
    if (!button && !mcdonaldsHomepageOnly && !kfcHomepageOnly && await this.searchInsideShop(page, ref.itemName)) {
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
    await this.activateProductControl(page, button); await page.waitForTimeout(700);
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
    const selectedSummary = clean((await dialog.innerText().catch(() => '')).match(/已选\s*[:：]\s*([^\n]+)/)?.[1], 240);
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
        id: `g${groupIndex}`, name: clean(group.name, 80),
        required: group.selectionRequired === true || !/加料|小料|配料/.test(group.name),
        multiple: group.multiple, selectionCount: group.selectionCount,
        choices: group.choices.map((label, choiceIndex) => ({ id: `g${groupIndex}c${choiceIndex}`, label: clean(label, 80), priceDelta: number(label.match(/\+\s*¥?([\d.]+)/)?.[1]), available: true, selected: Boolean(selectedSummary && selectedSummary.includes(clean(label.replace(/\+\s*¥?[\d.]+/g, ''), 80))) })),
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

  async activateProductControl(page, control) {
    // A fixed recommendation strip can cover a scrolled menu button. Dispatch
    // to the exact bound DOM control first so the coordinate cannot land on a
    // different product painted above it.
    if (typeof control?.scrollIntoViewIfNeeded === 'function') await control.scrollIntoViewIfNeeded().catch(() => {});
    if (typeof control?.evaluate !== 'function') return this.activateControl(page, control);
    try { await control.evaluate(node => node.click()); }
    catch {
      try { await control.click({ force: true, noWaitAfter: true, timeout: 3000 }); }
      catch { await this.tapControl(page, control); }
    }
  }

  async readSelectedCartItems(page, { close = true } = {}) {
    let openedHere = false;
    let cards = page.locator('.mod-mes-card');
    const visibleCards = async () => {
      const rows = [];
      for (let index = 0; index < await cards.count().catch(() => 0); index += 1) {
        const card = cards.nth(index);
        if (await card.isVisible().catch(() => false)) rows.push(card);
      }
      return rows;
    };
    let rendered = await visibleCards();
    if (!rendered.length) {
      const retailPanelOpen = Boolean(await this.visibleLocator(page.locator('[aria-label="清空购物车"]'), true));
      if (!retailPanelOpen) {
        const basket = await this.visibleLocator(page.locator('[aria-label*="购物车篮子"]'), true);
        if (basket) await this.tapControl(page, basket);
        else {
          const height = await page.evaluate(() => window.innerHeight).catch(() => 896);
          await this.tapPoint(page, 58, Math.max(120, height - 54));
        }
        await page.waitForTimeout(500);
        openedHere = true;
      }
      cards = page.locator('.mod-mes-card');
      rendered = await visibleCards();
    }
    const items = [];
    for (const card of rendered) {
      const name = clean(await card.locator('.menu__info_name__text').first().innerText().catch(() => ''), 160);
      const quantityText = clean(await card.locator('.cartNum').first().innerText().catch(() => ''), 20)
        || clean(await card.locator('[aria-label]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')).find(value => /^\d+$/.test(value || '')) || '').catch(() => ''), 20);
      const quantity = Math.max(0, Math.floor(Number(quantityText) || 0));
      if (name) items.push({ name, quantity });
    }
    if (!items.length) {
      const retailCards = page.locator('[class*="groupItem__"]');
      for (let index = 0; index < await retailCards.count().catch(() => 0); index += 1) {
        const card = retailCards.nth(index);
        if (!await card.isVisible().catch(() => false)) continue;
        const raw = clean(await card.innerText().catch(() => ''), 1200);
        const name = clean(raw.split(/\s+(?:特价|限\s*\d+\s*份|优惠价|¥|￥)/)[0], 160);
        const quantityLabel = clean(await card.locator('[aria-label^="共"]').first().getAttribute('aria-label').catch(() => ''), 40);
        const quantity = Math.max(0, Math.floor(Number(quantityLabel.match(/共\s*(\d+)\s*件/)?.[1]) || 0));
        if (name && quantity) items.push({ name, quantity });
      }
    }
    if (close && (openedHere || rendered.length)) {
      const panelClose = await this.visibleLocator(page.locator('[aria-label*="关闭面板"]'), true);
      if (panelClose) await this.tapControl(page, panelClose).catch(() => {});
      else {
        const height = await page.evaluate(() => window.innerHeight).catch(() => 896);
        await this.tapPoint(page, 58, Math.max(120, height - 54)).catch(() => {});
      }
      await page.waitForTimeout(350);
    }
    return items;
  }

  async verifyUniqueCartItems(page, expectedNames, { allowRepeatedSnack = false } = {}) {
    let verification = { rows: [], duplicates: [], missing: [...expectedNames] };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      verification = cartItemVerification(await this.readSelectedCartItems(page), expectedNames, { allowRepeatedSnack });
      // Quantity duplication is a hard failure and must never be treated as a
      // transient render delay.
      if (verification.duplicates.length) {
        throw new Error(`购物车出现重复商品（${verification.duplicates.join('、')}），系统已停止且不会提交订单`);
      }
      if (!verification.missing.length) return verification.rows;
      if (attempt < 3) await page.waitForTimeout(300);
    }
    throw new Error(`加购后购物车没有真实出现（${verification.missing.join('、')}），系统已停止且不会把点击动作当成成功`);
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

  async resolveCheckoutUtensils(page) {
    const body = clean(await page.locator('body').innerText().catch(() => ''), 7000);
    if (!/选择餐具份数/.test(body)) return false;

    // The current checkout uses a wheel plus a large orange footer, not a
    // normal radio dialog. Select one serving explicitly, then click the
    // largest rendered “需要餐具” node (the footer rather than the wheel row).
    const oneServing = await this.renderedLocator(page.getByText(/^(?:1|一)\s*份$/, { exact: true })).catch(() => null);
    if (oneServing) {
      await oneServing.evaluate(node => node.click()).catch(() => this.activateControl(page, oneServing));
      await page.waitForTimeout(250);
    }
    const confirm = await this.renderedLocator(page.getByText(/^需要餐具，商家依据餐量提供$/, { exact: true })).catch(() => null)
      || await this.renderedLocator(page.getByText(/^(?:有餐具|需要餐具)$/, { exact: true })).catch(() => null);
    if (!confirm) throw new Error('淘宝闪购要求选择餐具，但没有识别到餐具面板的确认按钮，已停止提交');
    await confirm.evaluate(node => node.click()).catch(() => this.activateControl(page, confirm));
    for (let wait = 0; wait < 16; wait += 1) {
      await page.waitForTimeout(250);
      const currentBody = clean(await page.locator('body').innerText().catch(() => ''), 4000);
      if (!/选择餐具份数/.test(currentBody)) return true;
    }
    throw new Error('已选择1份餐具，但平台餐具面板没有关闭；已停止且不会继续盲点提交按钮');
  }

  async checkoutControl(page) {
    return await this.visibleLocator(page.getByText('去结算', { exact: false }), true)
      || this.visibleLocator(page.getByText(/^(?:领券结算|结算)$/), true);
  }

  async satisfyRequiredStoreItem(page, expectedNames = []) {
    const requiredPrompt = await this.visibleLocator(page.getByText('未选必选品', { exact: true }), true).catch(() => null);
    if (!requiredPrompt) return { checkout: null, added: [] };
    await this.tapControl(page, requiredPrompt);
    await page.waitForTimeout(500);
    // Some restaurants require one explicit row from a “下单必选” section.
    // Prefer the real zero-price “无需餐具” row: it satisfies the merchant's
    // form without inventing a paid candle, glove, fork or spoon request.
    const noUtensils = '无需餐具（默认任何餐具都不配备）我坚决不要任何餐具';
    const control = await this.productControl(page, noUtensils)
      || await this.productControl(page, '无需餐具');
    if (!control) throw new Error('门店要求选择下单必选品，但没有识别到免费的“无需餐具”选项；已停止且不会擅自购买收费餐具');
    await this.activateProductControl(page, control);
    await page.waitForTimeout(550);
    await this.verifyUniqueCartItems(page, [...expectedNames, noUtensils]);
    const checkout = await this.checkoutControl(page);
    if (!checkout) throw new Error('已选择免费的“无需餐具”，但门店仍未提供可用的结算按钮；已停止且不会重复添加必选品');
    return { checkout, added: [noUtensils] };
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
    const marked = await page.evaluate(({ name, allowTopRows, fruitKeyword, strictFruitTitle }) => {
      const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
      const canonicalTitle = value => normalized(value)
        .replace(/[（(](?:首创|招牌|经典)[）)]/g, '')
        .replace(/^(?:招牌|热销|推荐)[\s·:：-]*/u, '')
        .replace(/^【[^】]{1,30}】\s*/u, '')
        .replace(/^\[[^\]]{1,30}\]\s*/u, '')
        .replace(/[【[].*$/, '')
        .trim();
      const bundle = /(?:双杯|两杯|2杯|套餐|组合|买一送一|\+|＋)/i;
      const targetIsBundle = bundle.test(name);
      const fruitSizeAndPurityAllowed = value => {
        const title = normalized(value);
        if (/(?:大桶|桶装|水果桶|果桶|西瓜桶|芒果桶|橙子桶|含桶|半个|整个|夹心|夹馅|夹乌梅|乌梅|酸奶|奶油|果酱|蘸料|爆珠|大口吃芒果)/.test(title)) return false;
        const weight = title.match(/(\d+(?:\.\d+)?)\s*(kg|千克|公斤|g|克|斤)/i);
        if (!weight) return true;
        const grams = /^(?:kg|千克|公斤)$/i.test(weight[2]) ? Number(weight[1]) * 1000
          : weight[2] === '斤' ? Number(weight[1]) * 500 : Number(weight[1]);
        return grams > 0 && grams <= 250;
      };
      const fruitTitleMatches = value => {
        if (!fruitKeyword) return false;
        if (strictFruitTitle) return canonicalTitle(value) === targetTitle;
        const title = normalized(value).replace(/^【[^】]{1,30}】\s*/u, '');
        if (/(?:拼|混合|果盘|水果捞|组合|套餐)/.test(title) || !fruitSizeAndPurityAllowed(title)) return false;
        return fruitKeyword === '橙子' ? /(?:橙子|脐橙|鲜橙)/.test(title) : title.includes(fruitKeyword);
      };
      const titleMatches = value => (!fruitKeyword || fruitSizeAndPurityAllowed(value))
        && (canonicalTitle(value) === targetTitle || fruitTitleMatches(value));
      const controls = [...document.querySelectorAll('[aria-label*="加购"], [aria-label*="选规格"], [aria-label*="选套餐"]')]
        .map(node => ({ node, box: node.getBoundingClientRect() }))
        .filter(item => item.box.width > 0 && item.box.height > 0 && item.box.y > 20);
      const targetTitle = canonicalTitle(name);
      {
        // Retail search results expose each product title and add button as
        // separate accessibility nodes. Bind the full exact title to the
        // nearest button on the same row before any ancestor fallback; a large
        // virtual-list wrapper can otherwise connect an off-screen title to the
        // first visible cart button.
        const exactRetailTitles = [...document.querySelectorAll('[aria-label]')].map(node => ({
          node,
          label: normalized(node.getAttribute('aria-label')).replace(/^商品标题[：:]\s*/u, ''),
          box: node.getBoundingClientRect(),
        })).filter(item => item.box.width > 0 && item.box.height > 0
          && canonicalTitle(item.label) === targetTitle
          && (!fruitKeyword || fruitSizeAndPurityAllowed(item.label)));
        for (const title of exactRetailTitles) {
          const targetY = title.box.y + title.box.height / 2;
          const closest = controls.map(control => ({ control, distance: Math.abs(control.box.y + control.box.height / 2 - targetY) }))
            .sort((left, right) => left.distance - right.distance)[0];
          if (closest && closest.distance <= 120) {
            closest.control.node.setAttribute('data-phone-delivery-target', '1');
            closest.control.node.setAttribute('data-phone-delivery-binding', 'exact-title-row');
            return true;
          }
        }
      }
      // Sticky recommendation cards share one large wrapper. Bind each button
      // to its own small `.cell__props` card before considering any fallback;
      // otherwise the first + button can inherit a title from a sibling card.
      for (const control of controls) {
        const cell = control.node.closest('.cell__props');
        const cellTitle = cell?.querySelector('.cell__props-name');
        const cellText = normalized(cellTitle?.innerText || cellTitle?.textContent);
        if (cellText && titleMatches(cellText) && (targetIsBundle || !bundle.test(cellText))) {
          control.node.setAttribute('data-phone-delivery-target', '1');
          return true;
        }
      }
      const titleNodes = [...document.querySelectorAll('[class*="menuItem--info-title"], [class*="goods-title"], [class*="product-title"], .cell__props-name')];
      const exactTitles = titleNodes.filter(node => {
        const box = node.getBoundingClientRect();
        const text = normalized(node.innerText || node.textContent);
        return box.width > 0 && box.height > 0 && box.y > (allowTopRows ? 40 : 140) && text.length <= 80
          && titleMatches(text)
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
      if (fruitKeyword) {
        const accessibleFruitTitles = [...document.querySelectorAll('[aria-label]')].map(node => ({
          node,
          label: normalized(node.getAttribute('aria-label')),
          box: node.getBoundingClientRect(),
        })).filter(item => item.box.width > 0 && item.box.height > 0 && item.box.y > (allowTopRows ? 40 : 140)
          && item.label.length <= 100 && !/(?:加购|选规格|选套餐|价格信息|按钮)/.test(item.label)
          && fruitTitleMatches(item.label));
        for (const title of accessibleFruitTitles) {
          const targetY = title.box.y + title.box.height / 2;
          const closest = controls.map(control => ({ control, distance: Math.abs(control.box.y + control.box.height / 2 - targetY) }))
            .sort((left, right) => left.distance - right.distance)[0];
          if (closest && closest.distance <= 160) {
            closest.control.node.setAttribute('data-phone-delivery-target', '1');
            return true;
          }
        }
      }
      let best = null; let bestRank = Infinity; let bestLength = Infinity;
      for (const control of controls) {
        let parent = control.node.closest('[data-item-id], .menuItem, .food-item--wrap, .cell__props, [class*="goods-item"], [class*="product-item"], [class*="food-item"]');
        for (let depth = 0; parent && depth < 3; depth += 1, parent = parent.parentElement) {
          const text = normalized(parent.innerText);
          if ((!text.includes(name) && !fruitTitleMatches(text)) || text.length > 900) continue;
          if (!targetIsBundle && bundle.test(text)) continue;
          const exactCardTitle = [...parent.querySelectorAll('[class*="menuItem--info-title"], [class*="goods-title"], [class*="product-title"], .cell__props-name')]
            .some(node => titleMatches(node.innerText || node.textContent)) || fruitTitleMatches(text);
          if (!exactCardTitle) continue;
          const parentControls = [...parent.querySelectorAll('[aria-label*="加购"], [aria-label*="选规格"], [aria-label*="选套餐"]')]
            .filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; });
          if (parentControls.length !== 1 || parentControls[0] !== control.node) continue;
          const rank = text.startsWith(name) ? 0 : 1;
          if (rank < bestRank || (rank === bestRank && text.length < bestLength)) {
            best = control.node; bestRank = rank; bestLength = text.length;
            break;
          }
        }
      }
      if (best) { best.setAttribute('data-phone-delivery-target', '1'); return true; }
      return false;
    }, {
      name: itemName,
      allowTopRows: shopSearchUrl(page.url()),
      fruitKeyword: singleFruitKeyword(itemName),
      strictFruitTitle: Boolean(singleFruitKeyword(itemName) && fruitServingWeightGrams(itemName) > 0),
    }).catch(() => false);
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
    const expandItems = await this.visibleLocator(page.getByText(/^(?:展开|查看全部)(?:[（(]?共\s*\d+\s*件[）)]?)?$/, { exact: true }), true).catch(() => null);
    if (expandItems) {
      await this.tapControl(page, expandItems);
      await page.waitForTimeout(500);
    }
    let raw = '';
    let amounts = { total: 0, discount: 0 };
    for (let attempt = 0; attempt < 24; attempt += 1) {
      raw = await page.locator('body').innerText().catch(() => '');
      amounts = checkoutAmounts(raw);
      if (amounts.total > 0) break;
      await page.waitForTimeout(250);
    }
    if (!amounts.total) throw new Error('没有从淘宝闪购确认页读到有效金额，本轮已停止');
    const retailCheckoutRows = await page.evaluate(() => {
      const list = document.querySelector('[class*="goodsListWrap"]');
      if (!list) return [];
      return [...list.querySelectorAll('[role="button"][aria-label]')].map(node => ({
        name: String(node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
        quantity: Math.max(1, Number(String(node.innerText || node.textContent || '').match(/[x×]\s*(\d+)/i)?.[1]) || 1),
      })).filter(row => row.name && !/^共\s*\d+\s*件/.test(row.name));
    }).catch(() => []);
    const validationRaw = retailCheckoutRows.length
      ? `${raw}\n${retailCheckoutRows.map(row => `${row.name} × ${row.quantity} ¥0`).join('\n')}`
      : raw;
    const cart = checkoutCartState(validationRaw, ref.itemName, ref.query, quantity, {
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
      let rows = [...new Set(document.querySelectorAll(rowSelector))].map(node => {
        const imageUrl = bestImage(node);
        const priceText = cleanText(node.querySelector('.food-item__price-unit-price')?.textContent)
          || cleanText(node.querySelector('.food-item__price')?.textContent);
        const prices = [...priceText.matchAll(/\d+(?:\.\d+)?/g)].map(match => Number(match[0])).filter(Number.isFinite);
        return {
          name: cleanText(node.querySelector('.food-item__title-text-checkout, .food-item__title')?.textContent),
          options: collapseRepeatedOptionText(cleanText(node.querySelector('.food-item__subTitle-text, .food-item__subTitle')?.textContent)),
          quantity: Math.max(1, Number(cleanText(node.querySelector('.food-item__number')?.textContent).match(/\d+/)?.[0]) || 1),
          price: prices.length ? prices.at(-1) : 0,
          imageUrl,
        };
      }).filter(row => row.name);
      if (!rows.length) {
        const retailList = document.querySelector('[class*="goodsListWrap"]');
        rows = [...(retailList?.querySelectorAll?.('[role="button"][aria-label]') || [])].map(node => ({
          name: cleanText(node.getAttribute('aria-label')),
          options: '',
          quantity: Math.max(1, Number(cleanText(node.innerText || node.textContent).match(/[x×]\s*(\d+)/i)?.[1]) || 1),
          price: 0,
          imageUrl: bestImage(node),
        })).filter(row => row.name && !/^共\s*\d+\s*件/.test(row.name));
      }
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
        options: live?.options || checkoutItemOptionsFromText(raw, row.name)
          || (ref.repeatPurchase ? '沿用购物车中已经核对的真实规格' : ''),
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

  async useExistingCartIfMatching(page, ref, quantity = 1, { replaceMismatchedCart = false, requiredOptionLabels = [] } = {}) {
    let cartLabel = '';
    let checkout = null;
    // The storefront often paints the cart footer after the menu itself.  A
    // single immediate read can miss a real existing cart and then duplicate
    // it with “再来一单”, so give only this passive footer read a short bound.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      cartLabel = clean(await page.locator('[aria-label*="购物车总计金额"]').first()
        .getAttribute('aria-label', { timeout: 400 }).catch(() => ''));
      checkout = await this.checkoutControl(page);
      if (number(cartLabel) > 0 || checkout) break;
      await page.waitForTimeout(250);
    }
    if (!(number(cartLabel) > 0 || checkout)) {
      // Store-local result pages can temporarily hide the cart footer even
      // though the same shop still owns an unfinished cart.  Inspect the real
      // cart rows once before adding; otherwise a retry can turn quantity 1
      // into quantity 2 and only discover it after the click.
      const hiddenRows = await this.readSelectedCartItems(page).catch(() => []);
      if (!hiddenRows.length) return null;
      if (requiredOptionLabels.length) {
        if (!replaceMismatchedCart) throw new Error('当前门店已有一份无法核对规格的未结算购物车；系统不会复用或覆盖');
        const cleared = await this.cleanupCartItem(ref.itemName, { clearAll: true });
        if (cleared.cartAmount === 0) return null;
        throw new Error('新任务需要重新核对真实规格，但平台没有确认清空旧购物车，已安全停止');
      }
      const exactExisting = hiddenRows.length === 1 && hiddenRows[0].quantity === quantity
        && (productMatchesSavedItem(hiddenRows[0].name, ref.itemName)
          || singleFruitItemMatches(hiddenRows[0].name, ref.itemName));
      if (exactExisting) return { resumeBelowMinimum: true, items: hiddenRows };
      if (!replaceMismatchedCart) throw new Error('当前门店已有另一份未结算购物车；系统不会覆盖或重复加购');
      const cleared = await this.cleanupCartItem(ref.itemName, { clearAll: true });
      if (cleared.cartAmount === 0) return null;
      throw new Error('本次授权检测到页面隐藏的旧购物车，但平台没有确认清空，已安全停止');
    }
    if (requiredOptionLabels.length) {
      // A previous failed task may have the same bundle title but different
      // options. Storefront cart rows do not expose enough SKU detail to prove
      // equality, so a newly authorized option-sensitive task must rebuild the
      // unsubmitted cart instead of inheriting stale drink or side choices.
      if (!replaceMismatchedCart) throw new Error('当前门店已有一份无法核对规格的未结算购物车；系统不会复用或覆盖');
      const cleared = await this.cleanupCartItem(ref.itemName, { clearAll: true });
      if (cleared.cartAmount === 0) return null;
      throw new Error('新任务需要重新核对真实规格，但平台没有确认清空旧购物车，已安全停止');
    }
    // A below-minimum storefront can briefly expose a rendered node whose text
    // looks like a checkout action even though the footer still says that more
    // items are required.  The threshold text is the authoritative state: keep
    // the verified main item and continue with the remaining explicit items
    // instead of tapping the false checkout control and stopping the task.
    let storefrontBody = '';
    let explicitlyBelowMinimum = false;
    // Closing the real cart panel repaints the sticky footer.  During that
    // repaint a stale “结算” descendant can become visible a few frames before
    // the authoritative “还差…起送” label.  Read the same page passively for a
    // short bound before any click so clarification resumes the existing main
    // item and reaches addRequestedStandaloneItems without duplicating it.
    for (let attempt = 0; attempt < 7; attempt += 1) {
      storefrontBody = await page.locator('body').innerText().catch(() => '');
      explicitlyBelowMinimum = /(?:还差|差)\s*(?:¥|￥)?\s*\d+(?:\.\d+)?\s*元?\s*起送/.test(storefrontBody);
      if (explicitlyBelowMinimum) break;
      if (attempt < 6) await page.waitForTimeout(250);
    }
    if (explicitlyBelowMinimum) {
      const belowMinimumRows = await this.readSelectedCartItems(page).catch(() => []);
      const exactExisting = belowMinimumRows.length === 1 && belowMinimumRows[0].quantity === quantity
        && (productMatchesSavedItem(belowMinimumRows[0].name, ref.itemName)
          || singleFruitItemMatches(belowMinimumRows[0].name, ref.itemName));
      if (exactExisting) return { resumeBelowMinimum: true, items: belowMinimumRows };
      if (replaceMismatchedCart) {
        const cleared = await this.cleanupCartItem(ref.itemName, { clearAll: true });
        if (cleared.cartAmount === 0) return null;
      }
      throw new Error('当前门店购物车已有商品但尚未达到起送金额；系统不会重复加购，请先确认要补充的商品');
    }
    if (!checkout) {
      const belowMinimumRows = await this.readSelectedCartItems(page).catch(() => []);
      const exactExisting = belowMinimumRows.length === 1 && belowMinimumRows[0].quantity === quantity
        && (productMatchesSavedItem(belowMinimumRows[0].name, ref.itemName)
          || singleFruitItemMatches(belowMinimumRows[0].name, ref.itemName));
      if (exactExisting) return { resumeBelowMinimum: true, items: belowMinimumRows };
      if (replaceMismatchedCart) {
        const cleared = await this.cleanupCartItem(ref.itemName, { clearAll: true });
        if (cleared.cartAmount === 0) return null;
      }
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
    try {
      return await this.readCheckoutDraft(page, ref, quantity, { validateCart: true });
    } catch (error) {
      const mismatch = /购物车(?:里的|缺少|含有|商品或数量)/.test(String(error?.message || error));
      if (!replaceMismatchedCart || !mismatch) throw error;
      const cleared = await this.cleanupCartItem(ref.itemName, { clearAll: true });
      if (cleared.cartAmount !== 0) throw new Error('本次授权允许替换未提交的旧购物车，但平台没有确认清空，已安全停止');
      return null;
    }
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
      const checkout = await this.checkoutControl(page);
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
    for (let attempt = 0; attempt < 3 && (!shopUrl(page.url()) || shopSearchUrl(page.url())); attempt += 1) {
      if (typeof page.goBack !== 'function') break;
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(450);
    }
    if (!shopUrl(page.url()) || shopSearchUrl(page.url())) throw new Error('无法在不刷新页面的情况下返回商家主页，已停止凑单');
    return page;
  }

  async topUpWithCandidateItems(page, ref, candidateNames = [], excludedItems = [], kindLabel = '凑单商品', { searchResultsOnly = false, categoryOnly = false, requiredNames = [] } = {}) {
    const excluded = [ref.itemName, ...excludedItems].map(item => clean(item, 140)).filter(Boolean);
    const names = candidateNames.map(name => clean(name, 140)).filter((name, index, all) => name && all.indexOf(name) === index && !excluded.some(item => productMatchesSavedItem(item, name) || productMatchesSavedItem(name, item)));
    const required = requiredNames.map(name => clean(name, 140)).filter(Boolean);
    const added = [];
    for (const name of names) {
      if (searchResultsOnly && !shopSearchUrl(page.url())) throw new Error('奶茶凑单必须从店内“小料”搜索结果继续，不能改从首页推荐区点商品');
      if (categoryOnly && (!shopUrl(page.url()) || shopSearchUrl(page.url()))) throw new Error('奶茶凑单必须留在商家“加小料区”，不能改走店内搜索');
      let control = await this.productControl(page, name);
      if (!searchResultsOnly && !categoryOnly && !control && await this.searchInsideShop(page, name)) {
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        await this.waitForPurchaseControls(page, 8000);
        control = await this.productControl(page, name);
      }
      if (!control) {
        if (!shopUrl(page.url())) await this.returnToStorefrontWithoutRefresh(page);
        continue;
      }
      await this.activateProductControl(page, control); await page.waitForTimeout(550);
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
          throw new Error(`${kindLabel}“${name}”现在要求重新选规格且没有安全默认项，请让角色先问你再继续`);
        }
      }
      await this.verifyUniqueCartItems(page, [ref.itemName, ...excludedItems, ...added, name]);
      added.push(name);
      const checkout = await this.checkoutControl(page);
      const requiredComplete = required.every(wanted => added.some(item => productMatchesSavedItem(item, wanted) || productMatchesSavedItem(wanted, item)));
      if (checkout && requiredComplete) return { checkout, added, expected: names, exhausted: false, eligible: true };
      if (added.length >= 8) break;
      if (!searchResultsOnly && !shopUrl(page.url())) await this.returnToStorefrontWithoutRefresh(page);
    }
    return { checkout: null, added, expected: names, exhausted: true, eligible: true };
  }

  async openStoreMenuCategory(page, categoryName) {
    if (!shopUrl(page?.url?.()) || shopSearchUrl(page?.url?.()) || !clean(categoryName, 80)) return false;
    let target = null;
    const requested = clean(categoryName, 80);
    const groups = [
      page.getByText(requested, { exact: true }),
      // Stores use several names for the same section, including “加小料区”
      // and “小料常点区”. A short category label containing 小料 is enough;
      // full product descriptions and recommendation copy remain excluded.
      page.getByText(/^(?=.{2,10}$).*小料.*$/u, { exact: true }),
    ];
    for (const candidates of groups) {
      for (let index = 0; index < await candidates.count(); index += 1) {
        const candidate = candidates.nth(index);
        // The category can start below the fold in the left menu. Scrolling the
        // exact category node is page-local navigation and does not submit a
        // search request, so it also avoids the marketplace search risk gate.
        await candidate.scrollIntoViewIfNeeded().catch(() => {});
        if (await candidate.isVisible().catch(() => false)) { target = candidate; break; }
      }
      if (target) break;
    }
    if (!target) return false;
    await this.tapControl(page, target).catch(async () => target.click({ force: true, noWaitAfter: true, timeout: 3000 }));
    await page.waitForTimeout(650);
    return true;
  }

  async openFruitPromotionCategory(page) {
    if (!shopUrl(page?.url?.()) || shopSearchUrl(page?.url?.())) return false;
    // This category is page-local navigation, not a search request. Stores may
    // label the same one-item promotion differently; use only the two observed
    // exact headings and still validate the product title, purity and weight.
    return await this.openStoreMenuCategory(page, '超值单品任选一件')
      || await this.openStoreMenuCategory(page, '活动商品');
  }

  async topUpWithSavedItems(page, ref, excludedItems = []) {
    if (!milkTeaTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
      return { checkout: null, added: [], expected: [], exhausted: true, eligible: false };
    }
    await this.returnToStorefrontWithoutRefresh(page);
    const historySummary = ref.repeatSummary || await this.boughtOrderSummary(page, ref.itemName);
    // Milk-tea top-ups stay on the current storefront. Open the merchant's
    // exact “加小料区” category and read its real products without issuing a
    // second search request; this both preserves the user's one-drink rule and
    // avoids an unnecessary marketplace risk trigger.
    if (!await this.openStoreMenuCategory(page, '加小料区')) {
      return { checkout: null, added: [], expected: [], exhausted: true, eligible: true };
    }
    await this.waitForPurchaseControls(page, 8000);
    const menu = await this.extractMenu(page, 50, '', { includeAddOnOnly: true }).catch(() => []);
    const preferences = requestedMilkTeaToppingPreferences(ref.query);
    const excludedKeys = new Set(preferences.excluded);
    const completedKeys = new Set(excludedItems.map(milkTeaToppingKey).filter(Boolean));
    const liveNames = milkTeaToppingCandidates(menu, `${ref.itemName} ${ref.query || ''}`)
      .filter(name => !excludedKeys.has(milkTeaToppingKey(name)));
    const preferredNames = preferences.preferred.map(key => liveNames.find(name => milkTeaToppingKey(name) === key)).filter(Boolean);
    const missingPreferred = preferences.preferred.filter(key => !completedKeys.has(key) && !preferredNames.some(name => milkTeaToppingKey(name) === key));
    if (missingPreferred.length) {
      throw new Error(`商家“加小料区”没有找到你明确要求的${missingPreferred.join('、')}，本轮不会用其他小料代替`);
    }
    const savedNames = savedTopUpItems(historySummary, ref.itemName)
      .filter(saved => !excludedKeys.has(milkTeaToppingKey(saved)))
      .filter(saved => liveNames.some(name => productMatchesSavedItem(name, saved) || productMatchesSavedItem(saved, name)));
    const pendingPreferredNames = preferredNames.filter(name => !completedKeys.has(milkTeaToppingKey(name)));
    const names = [...pendingPreferredNames, ...savedNames, ...liveNames].filter((name, index, all) => all.indexOf(name) === index);
    return this.topUpWithCandidateItems(page, ref, names, excludedItems, '奶茶凑单小料', { categoryOnly: true, requiredNames: pendingPreferredNames });
  }

  async topUpWithMealSnacks(page, ref, excludedItems = []) {
    if (!mealSideTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
      return { checkout: null, added: [], expected: [], exhausted: true, eligible: false };
    }
    await this.returnToStorefrontWithoutRefresh(page);
    const menu = await this.extractMenu(page, 50, '', { includeAddOnOnly: true }).catch(() => []);
    return this.topUpWithCandidateItems(page, ref, mealSnackCandidates(menu, ref.itemName), excludedItems, '主食凑单小吃');
  }

  async topUpWithSnackItems(page, ref, excludedItems = []) {
    if (!snackTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
      return { checkout: null, added: [], expected: [], exhausted: true, eligible: false };
    }
    // When no other snack was explicitly named, the user allows the same snack
    // to be repeated solely to reach the minimum order. Other categories keep
    // the one-item rule.
    let rows = await this.readSelectedCartItems(page).catch(() => []);
    let repeatedMainQuantity = rows.find(item => productMatchesSavedItem(item.name, ref.itemName))?.quantity || 1;
    let repeatUnsupported = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const checkout = await this.checkoutControl(page);
      if (checkout) return { checkout, added: [], expected: [], exhausted: false, eligible: true, repeatedMainQuantity };
      const plus = await this.productQuantityPlus(page, ref.itemName);
      if (!plus) { repeatUnsupported = true; break; }
      await this.activateProductControl(page, plus);
      await page.waitForTimeout(450);
      rows = await this.readSelectedCartItems(page).catch(() => []);
      const main = rows.find(item => productMatchesSavedItem(item.name, ref.itemName));
      if (!main || main.quantity <= repeatedMainQuantity) { repeatUnsupported = true; break; }
      repeatedMainQuantity = main.quantity;
      await this.verifyUniqueCartItems(page, [ref.itemName], { allowRepeatedSnack: true });
    }
    if (repeatUnsupported) {
      // Some retail promotions expose a plus button but enforce one unit per
      // SKU. Keep the requested snack, then fall back to distinct edible
      // snacks from the same real menu instead of misreporting a repeat.
      let menu = await this.extractMenu(page, 50, '', { includeAddOnOnly: true }).catch(() => []);
      let candidates = snackTopUpCandidates(menu, ref.itemName);
      if (!candidates.length && await this.searchInsideShop(page, '零食')) {
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        await this.waitForPurchaseControls(page, 8000);
        menu = await this.extractMenu(page, 50, '', { includeAddOnOnly: true }).catch(() => []);
        candidates = snackTopUpCandidates(menu, ref.itemName);
      }
      const fallback = await this.topUpWithCandidateItems(page, ref, candidates, excludedItems, '零食凑单商品');
      return { ...fallback, repeatedMainQuantity };
    }
    return { checkout: null, added: [], expected: [ref.itemName], exhausted: true, eligible: true, repeatedMainQuantity };
  }

  async topUpWithCategoryItems(page, ref, excludedItems, { eligible, candidatesFor, searchTerm, kindLabel }) {
    if (!eligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
      return { checkout: null, added: [], expected: [], exhausted: true, eligible: false };
    }
    let menu = await this.extractMenu(page, 50, '', { includeAddOnOnly: true }).catch(() => []);
    let candidates = candidatesFor(menu, ref.itemName, ref.query);
    if (!candidates.length && await this.searchInsideShop(page, searchTerm)) {
      await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      await this.waitForPurchaseControls(page, 8000);
      menu = await this.extractMenu(page, 50, '', { includeAddOnOnly: true }).catch(() => []);
      candidates = candidatesFor(menu, ref.itemName, ref.query);
    }
    return this.topUpWithCandidateItems(page, ref, candidates, excludedItems, kindLabel);
  }

  async topUpWithFruitItems(page, ref, excludedItems = []) {
    return this.topUpWithCategoryItems(page, ref, excludedItems, {
      eligible: fruitTopUpEligible, candidatesFor: fruitTopUpCandidates,
      searchTerm: '水果', kindLabel: '水果凑单商品',
    });
  }

  async topUpWithDessertItems(page, ref, excludedItems = []) {
    return this.topUpWithCategoryItems(page, ref, excludedItems, {
      eligible: dessertTopUpEligible, candidatesFor: dessertTopUpCandidates,
      searchTerm: '甜品', kindLabel: '甜品凑单商品',
    });
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
    await this.activateProductControl(page, control); await page.waitForTimeout(550);
    const dialog = await this.optionPanel(page);
    if (dialog) {
      const raw = clean(await dialog.innerText().catch(() => ''), 3000);
      const selectedDefault = raw.match(/已选\s*[:：]\s*([^¥￥\n]{1,100})/)?.[1]?.trim() || '';
      const confirm = await this.visibleLocator(dialog.getByText(/^(加入购物车|确定|选好了)$/), true);
      if (!selectedDefault || !confirm) throw new Error(`主食凑单小吃“${sideName}”现在要求选择规格，请让角色先问你再继续`);
      await this.tapControl(page, confirm); await page.waitForTimeout(650);
    }
    await this.verifyUniqueCartItems(page, [ref.itemName, sideName]);
    const checkout = await this.checkoutControl(page);
    return { checkout, added: [sideName] };
  }

  async addRequestedStandaloneItems(page, ref, coveredBy = '') {
    const requested = requestedStandaloneItems(ref.query, coveredBy);
    const kfcOrder = /肯德基|\bkfc\b/i.test([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '));
    const added = [];
    const selections = [];
    for (const requestedName of requested) {
      const specIntent = standaloneItemSpecIntent(requestedName);
      const productName = specIntent.productName;
      const allowShortFoodAlias = shortFoodTitleAliasEligible([ref?.merchant, ref?.itemName, ref?.query, productName].filter(Boolean).join(' '));
      if (!shopUrl(page.url())) await this.returnToStorefrontWithoutRefresh(page);
      const mcdonaldsDessert = /麦当劳|mcdonald/i.test([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))
        && /麦(?:旋|炫)风|香芋派|菠萝派|脆薯饼/.test(requestedName);
      if (mcdonaldsDessert) {
        // McDonald's exposes these as separate storefront products under the
        // stable “小食甜品/其他” category. Open that category before reading
        // the item and do not submit a store-search request for it.
        const opened = await this.openStoreMenuCategory(page, '小食甜品/其他');
        if (!opened) throw new Error('麦当劳当前页面没有找到“小食甜品/其他”分类，本轮不会用其他商品替代');
        await this.waitForPurchaseControls(page, 8000);
      }
      const storeSearchName = kfcOrder ? kfcStandaloneSearchTerm(productName) : productName;
      let menu = await this.extractMenu(page, 24, storeSearchName).catch(() => []);
      let chosen = preferredExactProduct(menu, productName, { allowShortFoodAlias });
      if (!chosen && !mcdonaldsDessert && await this.searchInsideShop(page, storeSearchName)) {
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        await this.waitForPurchaseControls(page, 8000);
        menu = await this.extractMenu(page, 24, storeSearchName).catch(() => []);
        chosen = preferredExactProduct(menu, productName, { allowContainedAlias: true, allowShortFoodAlias });
      }
      if (!chosen) {
        // Some restaurant search pages render a perfectly visible product title
        // and add button but omit the card metadata used by extractMenu. Read
        // only those visible title nodes, resolve the bounded core category, and
        // pass the resulting full platform name to productControl.
        const visibleNames = await page.locator('[class*="menuItem--info-title"]').evaluateAll(nodes => [...new Set(nodes.map(node => {
          const box = node.getBoundingClientRect();
          return box.width > 0 && box.height > 0 ? (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim() : '';
        }).filter(Boolean))]).catch(() => []);
        chosen = preferredExactProduct(visibleNames.map(name => ({ name, price: 1 })), productName, { allowContainedAlias: true, allowShortFoodAlias });
      }
      const actualName = clean(chosen?.name || productName, 140);
      let control = await this.productControl(page, actualName);
      if (!control && actualName !== productName) control = await this.productControl(page, productName);
      if (!control) {
        throw new Error(`购物车还缺少本次明确要求的“${requestedName}”，系统不会因为达到起送价而提前结算`);
      }
      await this.activateProductControl(page, control); await page.waitForTimeout(550);
      const dialog = await this.optionPanel(page);
      if (dialog) {
        let raw = clean(await dialog.innerText().catch(() => ''), 3000);
        let selectedDefault = raw.match(/已选\s*[:：]\s*([^¥￥\n]{1,100})/)?.[1]?.trim() || '';
        if (specIntent.requiredOption) {
          const target = await this.visibleLocator(dialog.getByText(specIntent.requiredOption, { exact: true }), true);
          if (!target) throw new Error(`单品“${actualName}”当前没有可选择的“${specIntent.requiredOption}”规格，本轮已停止`);
          const choiceSelected = async () => target.evaluate(node => {
            for (let current = node, depth = 0; current && depth < 6; current = current.parentElement, depth += 1) {
              if (current.getAttribute('aria-checked') === 'true' || current.getAttribute('aria-selected') === 'true') return true;
              if (/(?:^|[\s_-])(?:is-)?selected(?:$|[\s_-])|(?:^|[\s_-])checked(?:$|[\s_-])/.test(String(current.className || '').toLowerCase())) return true;
            }
            return false;
          }).catch(() => false);
          if (!optionChoiceMatchesSummary(selectedDefault, specIntent.requiredOption) && !await choiceSelected()) {
            await this.tapControl(page, target);
            for (let attempt = 0; attempt < 12; attempt += 1) {
              await page.waitForTimeout(100);
              raw = clean(await dialog.innerText().catch(() => ''), 3000);
              selectedDefault = raw.match(/已选\s*[:：]\s*([^¥￥\n]{1,100})/)?.[1]?.trim() || '';
              if (optionChoiceMatchesSummary(selectedDefault, specIntent.requiredOption) || await choiceSelected()) break;
            }
          }
          if (!optionChoiceMatchesSummary(selectedDefault, specIntent.requiredOption) && !await choiceSelected()) {
            throw new Error(`平台没有真实选中单品“${actualName}”的“${specIntent.requiredOption}”规格，本轮已停止`);
          }
        }
        const confirm = await this.visibleLocator(dialog.getByText(/^(加入购物车|确定|选好了)$/), true);
        if (!confirm || (!selectedDefault && /请选择|必选/.test(raw))) {
          throw new Error(`单品“${actualName}”还需要确认真实规格，系统已暂停且不会跳过这件商品`);
        }
        await this.tapControl(page, confirm); await page.waitForTimeout(650);
      } else if (specIntent.requiredOption && !clean(actualName, 140).includes(specIntent.requiredOption)) {
        throw new Error(`单品“${actualName}”没有显示可核对的“${specIntent.requiredOption}”规格，本轮已停止`);
      }
      await this.verifyUniqueCartItems(page, [ref.itemName, ...added, actualName]);
      added.push(actualName);
      if (specIntent.requiredOption) selections.push({ requestedName, actualName, requiredOption: specIntent.requiredOption });
      // Do not inspect or click checkout here.  Every requested item must run
      // through this loop even if the first item already reached the minimum.
    }
    if (added.length !== requested.length) throw new Error('用户明确指定的商品尚未全部完成，不能检查起送金额或进入结算');
    if (!shopUrl(page.url())) await this.returnToStorefrontWithoutRefresh(page);
    const checkout = await this.checkoutControl(page);
    return { checkout, added, selections };
  }

  async createOrder({ ref, selectedOptions, optionGroups = [], quantity, replaceMismatchedCart = false }) {
    if (quantity > 1 && !multiServingEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
      throw new Error('同一种奶茶、主食、KFC 或其他正餐只能点一份；达到起送价只能逐个添加小料或同店小吃');
    }
    if (ref.repeatPurchase) return this.createRepeatPurchaseOrder(ref);
    let page; let targetControlY = null; let addedStandaloneItems = []; let resumeExistingMain = false;
    const requiredOptionLabels = [];
    for (const [groupId, ids] of Object.entries(selectedOptions || {})) {
      const group = optionGroups.find(item => String(item.id) === String(groupId));
      for (const id of (Array.isArray(ids) ? ids : [ids])) {
        const choice = (group?.choices || []).find(item => String(item.id) === String(id));
        if (choice) requiredOptionLabels.push(`${group.name}：${choice.label}`);
      }
    }
    if (ref.detailUrl) {
      page = await this.goto(ref.detailUrl, 1800);
      const body = clean(await page.locator('body').innerText().catch(() => ''), 2400);
      if (!body.includes(ref.itemName)) throw new Error('真实商品详情已失效，请重新搜索');
    } else {
      const current = await this.ensure();
      page = ref.shopUrl
        ? (sameShopUrl(current.url(), ref.shopUrl) ? current : await this.goto(ref.shopUrl, 900))
        : await this.enterShop(ref.shopIndex, { preferSaved: true });
      const mcdonaldsHomepageOnly = mcdonaldsDefaultBundleRequested(`${ref?.merchant} ${ref?.itemName} ${ref?.query}`);
      const kfcHomepageOnly = kfcDefaultSignatureBundleRequested(`${ref?.merchant} ${ref?.itemName} ${ref?.query}`);
      if ((mcdonaldsHomepageOnly || kfcHomepageOnly) && shopSearchUrl(page.url())) page = await this.returnToStorefrontWithoutRefresh(page);
      await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      await this.waitForPurchaseControls(page, 8000);
      const existing = await this.useExistingCartIfMatching(page, ref, quantity, { replaceMismatchedCart, requiredOptionLabels });
      if (existing?.resumeBelowMinimum) resumeExistingMain = true;
      else if (existing) return existing;
      // Prefer an exact single item already visible on the storefront.  Only
      // open store-local search when the signature item is not on the page.
      let add = resumeExistingMain ? null : await this.productControl(page, ref.itemName);
      if (!resumeExistingMain && !add && !mcdonaldsHomepageOnly && !kfcHomepageOnly && await this.searchInsideShop(page, ref.itemName)) {
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        await this.waitForPurchaseControls(page, 8000);
        add = await this.productControl(page, ref.itemName);
      }
      for (let attempt = 0; !resumeExistingMain && attempt < 20 && !add; attempt += 1) {
        add = await this.productControl(page, ref.itemName);
        if (!add) await page.waitForTimeout(500);
      }
      if (!resumeExistingMain && !add) {
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
      if (resumeExistingMain) {
        targetControlY = null;
      } else if (!add) {
        targetControlY = null;
      } else {
      if (process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) {
        const debug = await add.evaluate(node => {
          const box = node.getBoundingClientRect(); let parent = node.parentElement; let summary = '';
          for (let depth = 0; parent && depth < 6; depth += 1, parent = parent.parentElement) {
            const text = (parent.innerText || '').replace(/\s+/g, ' ').trim();
            if (text.length >= 4 && text.length <= 360) { summary = text; if (/¥|￥/.test(text)) break; }
          }
          return { aria: node.getAttribute('aria-label') || '', binding: node.getAttribute('data-phone-delivery-binding') || '', text: (node.textContent || '').trim(), x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), summary };
        }).catch(() => ({}));
        console.error('[phone-delivery-browser] exact product control:', JSON.stringify({ ...debug, url: page.url() }));
      }
      const targetBox = await add.boundingBox().catch(() => null);
      if (targetBox) targetControlY = targetBox.y + targetBox.height / 2;
      const startedOnInternalSearch = shopSearchUrl(page.url());
      await this.activateProductControl(page, add); await page.waitForTimeout(700);
      if (!startedOnInternalSearch && shopSearchUrl(page.url())) throw new Error('真实商品按钮发生页面漂移，请重新搜索');
      }
    }
    if (!resumeExistingMain && /pages\/ele-product-detail/i.test(page.url())) {
      const detailActions = page.locator('[aria-label*="选规格"], [aria-label*="选套餐"], [aria-label*="加入购物车"]').or(page.getByText(/^(选规格|选套餐|加入购物车)$/));
      const detailAdd = await this.visibleLocator(detailActions, true) || await this.renderedLocator(detailActions);
      if (!detailAdd) throw new Error('商品详情页没有可用的加入购物车按钮');
      await this.activateControl(page, detailAdd); await page.waitForTimeout(900);
    }
    const dialog = resumeExistingMain ? null : await this.optionPanel(page);
    const selectedLabels = [];
    const applySelectedOptions = async (panel, collectLabels = false) => {
      const selectedSummary = async () => String(await panel.innerText().catch(() => ''))
        .split(/\n+/).map(line => clean(line, 600)).find(line => /^已选\s*[:：]/.test(line)) || '';
      const choiceStepperPoint = async (label, direction) => {
        const labelNode = await this.visibleLocator(panel.getByText(label, { exact: true }), true);
        if (!labelNode) return null;
        await labelNode.scrollIntoViewIfNeeded().catch(() => {});
        return labelNode.evaluate((node, wanted) => {
          const card = node.closest('.sku-option__root');
          const control = card?.querySelector(wanted === 'minus'
            ? '.essmnpv-minus-btn:not(.disabled)'
            : '.essmnpv-plus-btn:not(.disabled)');
          if (!control) return null;
          const box = control.getBoundingClientRect();
          return box.width > 0 && box.height > 0
            ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
            : null;
        }, direction).catch(() => null);
      };
      const tapChoiceStepper = async (label, direction) => {
        const point = await choiceStepperPoint(label, direction);
        if (!point) return false;
        await this.tapPoint(page, point.x, point.y);
        return true;
      };
      const tapChoiceCard = async label => {
        const labelNode = await this.visibleLocator(panel.getByText(label, { exact: true }), true);
        if (!labelNode) return false;
        await labelNode.scrollIntoViewIfNeeded().catch(() => {});
        const point = await labelNode.evaluate(node => {
          // Eleme serves multiple SKU DOM versions. Newer cards can leave the
          // exact visible label as the only stable target; clicking it bubbles
          // to the real React option and must not be mistaken for sold-out.
          const card = node.closest('.sku-option__root, [role="radio"], [role="option"], [aria-checked], [aria-selected], button, [class*="sku-option"], [class*="spec-option"]');
          const box = (card || node).getBoundingClientRect();
          return box && box.width > 0 && box.height > 0
            ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
            : null;
        }).catch(() => null);
        if (!point) return false;
        await this.tapPoint(page, point.x, point.y);
        return true;
      };
      const choiceNodeSelected = target => target.evaluate(node => {
        for (let current = node, depth = 0; current && depth < 6; current = current.parentElement, depth += 1) {
          if (current.getAttribute('aria-checked') === 'true' || current.getAttribute('aria-selected') === 'true') return true;
          if (/(?:^|[\s_-])(?:is-)?selected(?:$|[\s_-])|(?:^|[\s_-])checked(?:$|[\s_-])/.test(String(current.className || '').toLowerCase())) return true;
        }
        return false;
      }).catch(() => false);
      const waitForSelectedChoice = async label => {
        let summary = await selectedSummary();
        for (let attempt = 0; attempt < 12 && !optionChoiceMatchesSummary(summary, label); attempt += 1) {
          await page.waitForTimeout(100);
          summary = await selectedSummary();
        }
        return summary;
      };
      for (const [groupId, ids] of Object.entries(selectedOptions || {})) {
        const group = optionGroups.find(item => String(item.id) === String(groupId));
        if (!group) throw new Error('真实规格映射已经失效，请重新搜索');
        for (const id of (Array.isArray(ids) ? ids : [ids])) {
          const choice = (group.choices || []).find(item => String(item.id) === String(id));
          if (!choice) throw new Error(`${group.name}的真实选项已经失效，请重新搜索`);
          const target = await this.visibleLocator(panel.getByText(choice.label, { exact: true }), true);
          if (!target) throw new Error(`平台规格“${choice.label}”当前不可选择，请重新搜索`);
          let summary = await selectedSummary();
          if (!optionChoiceMatchesSummary(summary, choice.label) && !await choiceNodeSelected(target)) {
            const current = (group.choices || []).find(item => optionChoiceMatchesSummary(summary, item.label));
            const currentMinus = current && current.label !== choice.label
              ? await choiceStepperPoint(current.label, 'minus') : null;
            const desiredPlus = await choiceStepperPoint(choice.label, 'plus');
            if (currentMinus && desiredPlus) {
              // Only a real quantity-stepper group (currently KFC drinks) uses
              // minus then plus. Ordinary free or surcharge cards have no such
              // controls and must never be sent down this branch.
              await this.tapPoint(page, currentMinus.x, currentMinus.y);
              await page.waitForTimeout(220);
              if (!await tapChoiceStepper(choice.label, 'plus')) throw new Error(`平台规格“${choice.label}”没有可用的添加入口`);
              summary = await waitForSelectedChoice(choice.label);
            } else {
              // Radio-style cards—including +¥ surcharge choices—switch by a
              // single card click. React can commit just after the old 180ms
              // check, so wait adaptively for the genuine “已选” text.
              if (!await tapChoiceCard(choice.label)) throw new Error(`平台规格“${choice.label}”当前不可点击，请重新搜索`);
              summary = await waitForSelectedChoice(choice.label);
              if (!optionChoiceMatchesSummary(summary, choice.label) && !await choiceNodeSelected(target)) {
                await target.click({ force: true }).catch(() => target.evaluate(node => node.click()).catch(() => {}));
                summary = await waitForSelectedChoice(choice.label);
              }
            }
            if (!optionChoiceMatchesSummary(summary, choice.label) && !await choiceNodeSelected(target)) throw new Error(`平台没有真实选中规格“${choice.label}”，本轮已停止`);
          }
          if (collectLabels) selectedLabels.push(`${group.name}：${choice.label}`);
        }
      }
      if (collectLabels && process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) {
        await page.screenshot({ path: `${process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH}.selected-options.png`, fullPage: true }).catch(() => {});
      }
      const confirm = await this.visibleLocator(panel.getByText(/加入购物车|确定|选好了/), true);
      if (!confirm) throw new Error('未找到规格确认按钮，请在浏览器窗口处理');
      await this.tapControl(page, confirm); await page.waitForTimeout(900);
    };
    if (dialog) {
      await applySelectedOptions(dialog, true);
    }
    await this.verifyUniqueCartItems(page, [ref.itemName]);
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
    const mainCoverage = [ref.itemName, ...selectedLabels].join(' ');
    const explicitItems = await this.addRequestedStandaloneItems(page, ref, mainCoverage);
    addedStandaloneItems = explicitItems.added;
    let explicitToppingCheckout = null;
    const milkTeaOrder = milkTeaTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '));
    // Product names from other categories can contain topping words (for
    // example KFC “红豆派”).  Only a real milk-tea order may interpret those
    // words as an explicit topping request.
    const explicitToppingPreferences = milkTeaOrder
      ? requestedMilkTeaToppingPreferences(ref.query)
      : { preferred: [], excluded: [] };
    if (explicitToppingPreferences.preferred.length) {
      const explicitToppings = await this.topUpWithSavedItems(page, ref, addedStandaloneItems);
      const completedToppingKeys = new Set([...addedStandaloneItems, ...explicitToppings.added].map(milkTeaToppingKey).filter(Boolean));
      const missingToppings = explicitToppingPreferences.preferred.filter(key => !completedToppingKeys.has(key));
      if (missingToppings.length) throw new Error(`购物车还缺少本次明确要求的${missingToppings.join('、')}，不能提前结算`);
      addedStandaloneItems.push(...explicitToppings.added);
      explicitToppingCheckout = explicitToppings.checkout;
    }
    ref.cartItems = [ref.itemName, ...addedStandaloneItems];
    ref.explicitItemsComplete = true;
    let checkout = explicitToppingCheckout || await this.checkoutControl(page) || explicitItems.checkout;
    if (!checkout) {
      const required = await this.satisfyRequiredStoreItem(page, ref.cartItems);
      checkout = required.checkout;
      if (required.added.length) {
        addedStandaloneItems.push(...required.added);
        ref.cartItems = [ref.itemName, ...addedStandaloneItems];
      }
    }
    if (!checkout) {
      const checkoutBody = clean(await page.locator('body').innerText().catch(() => ''), 12_000);
      const visibleCartLabel = clean(await page.locator('[aria-label*="购物车总计金额"]').first()
        .getAttribute('aria-label', { timeout: 500 }).catch(() => ''), 120);
      const minimum = minimumOrderInfo(checkoutBody, ref.unitPrice, quantity, number(visibleCartLabel));
      if (minimum.threshold > 0) {
        const explicitMealSide = requestedMealSide(ref.query);
        if (explicitMealSide && !addedStandaloneItems.some(item => productMatchesSavedItem(item, explicitMealSide)) && mealSideTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '))) {
          const mealTopUp = await this.topUpWithMealSide(page, ref, explicitMealSide);
          checkout = mealTopUp.checkout;
          addedStandaloneItems.push(...mealTopUp.added);
          ref.cartItems = [ref.itemName, ...addedStandaloneItems];
        }
        if (!ref.explicitItemsComplete) throw new Error('用户明确指定的商品尚未全部完成，不能开始凑单');
        const mealOrder = mealSideTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '));
        const snackOrder = snackTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '));
        const fruitOrder = fruitTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '));
        const dessertOrder = dessertTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' '));
        const randomMainChoiceAuthorized = /(?:随便(?:点|选)?|任意(?:一|单)?(?:杯|份|个)?|什么都(?:可以|行)|都(?:可以|行)|你(?:来)?(?:决定|点|选)|你看着(?:点|选)?)/u.test(clean(ref?.query, 400));
        if (!checkout && fruitOrder && !randomMainChoiceAuthorized) {
          throw new Error(`该门店最低起送金额为¥${minimum.threshold.toFixed(2)}，明确指定的水果已经全部完成，但你没有授权随机添加其他水果；请让角色先问你还要哪一种`);
        }
        const toppedUp = checkout ? { checkout, added: [], expected: [], exhausted: false, eligible: true }
          : mealOrder ? await this.topUpWithMealSnacks(page, ref, addedStandaloneItems)
            : snackOrder ? await this.topUpWithSnackItems(page, ref, addedStandaloneItems)
              : fruitOrder ? await this.topUpWithFruitItems(page, ref, addedStandaloneItems)
                : dessertOrder ? await this.topUpWithDessertItems(page, ref, addedStandaloneItems)
                  : await this.topUpWithSavedItems(page, ref, addedStandaloneItems);
        checkout = toppedUp.checkout;
        let requiredAdded = [];
        if (!checkout) {
          const required = await this.satisfyRequiredStoreItem(page, [ref.itemName, ...addedStandaloneItems, ...toppedUp.added]);
          checkout = required.checkout;
          requiredAdded = required.added;
        }
        if (Number(toppedUp.repeatedMainQuantity) > quantity) quantity = Number(toppedUp.repeatedMainQuantity);
        if (checkout) {
          addedStandaloneItems.push(...toppedUp.added, ...requiredAdded);
          ref.cartItems = [ref.itemName, ...addedStandaloneItems];
          // Continue with the same checkout path below.  The saved add-ons are
          // added one at a time and stop as soon as the minimum is met.
        } else if (toppedUp.eligible === false) {
          throw new Error(`该门店最低起送金额为¥${minimum.threshold.toFixed(2)}，当前类别没有可自动添加的同店小料或小吃；请让角色先问你要加什么`);
        } else if (toppedUp.added.length) {
          const missing = toppedUp.expected.filter(name => !toppedUp.added.includes(name));
          const missingText = missing.length ? `；尚未加入：${missing.join('、')}` : '';
          throw new Error(`已逐个加入凑单商品（${toppedUp.added.join('、')}），但本轮没有完整进入结算${missingText}；请让角色问你后再继续`);
        } else {
          throw new Error(`该门店最低起送金额为¥${minimum.threshold.toFixed(2)}，没有找到可验证且不重复的${mealOrder ? '同店小吃' : snackOrder ? '同店零食' : fruitOrder ? '同店水果' : dessertOrder ? '同店甜品' : '奶茶小料'}；请让角色先问你要加什么`);
        }
      }
      if (!checkout) {
        const suffix = await this.cleanupFailureSuffix(ref.itemName);
        if (minimum.threshold > 0) {
        throw new Error(`该门店最低起送金额为¥${minimum.threshold.toFixed(2)}，当前商品合计约¥${minimum.current.toFixed(2)}，还差约¥${minimum.shortfall.toFixed(2)}；系统不会复制同款，只能加不重复的小料或同店小吃；${suffix}`);
        }
        throw new Error(`未达到起送金额或无法结算，${suffix}，请重新选择商品或数量`);
      }
    }
    if (!ref.explicitItemsComplete || !checkout) throw new Error('结算条件不完整：必须先完成全部指定商品并达到起送金额');
    await this.verifyUniqueCartItems(page, ref.cartItems, { allowRepeatedSnack: snackTopUpEligible([ref?.merchant, ref?.itemName, ref?.query].filter(Boolean).join(' ')) });
    const checkoutState = async () => ({ url: page.url(), body: clean(await page.locator('body').innerText().catch(() => ''), 12_000) });
    await this.tapControl(page, checkout);
    let state = await checkoutState();
    for (let attempt = 0; attempt < 14 && !checkoutPageReady(state.url, state.body); attempt += 1) {
      await page.waitForTimeout(300);
      state = await checkoutState();
    }
    if (!checkoutPageReady(state.url, state.body)) {
      const retry = await this.checkoutControl(page);
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
    for (const selection of explicitItems.selections || []) {
      const live = draft.items.find(item => String(item.name || '').includes(selection.actualName)
        || String(selection.actualName).includes(item.name));
      const evidence = clean(`${live?.name || ''} ${live?.options || ''}`, 1000);
      if (!evidence.includes(selection.requiredOption)) {
        throw new Error(`订单确认页没有显示单品“${selection.actualName}”的“${selection.requiredOption}”规格，本轮不会提交`);
      }
    }
    const excludedFruits = requestedFruitExclusions(ref.query);
    const forbiddenFruitItems = draft.items.filter(item => fruitExclusionMatches(item?.name, excludedFruits));
    if (forbiddenFruitItems.length) {
      throw new Error(`订单确认页包含明确禁止的水果“${forbiddenFruitItems.map(item => item.name).join('、')}”，本轮不会继续提交`);
    }
    const unsafeFruitItems = draft.items.filter(item => singleFruitKeyword(item?.name)
      && !fruitServingEligible(`${item?.name || ''} ${item?.options || ''}`));
    if (unsafeFruitItems.length) {
      throw new Error(`订单确认页的水果不符合纯单果、无夹心、非桶装，且西瓜单份不超过500克、其他水果不超过250克的硬性要求：“${unsafeFruitItems.map(item => item.name).join('、')}”`);
    }
    const liveMain = draft.items.find(item => String(item.name || '').includes(ref.itemName)
      || String(ref.itemName || '').includes(item.name)
      || singleFruitItemMatches(item.name, ref.itemName));
    const intendedRequirements = missingSelectedOptionRequirements('', selectedLabels);
    if (intendedRequirements.length && !clean(liveMain?.options, 1000)) {
      throw new Error('订单确认页没有显示可核对的真实规格，本轮不会继续提交');
    }
    const missingRequirements = missingSelectedOptionRequirements(liveMain?.options, selectedLabels);
    if (missingRequirements.length) {
      throw new Error(`订单确认页的真实规格缺少“${missingRequirements.join('、')}”，本轮不会继续提交`);
    }
    const duplicatedBundleComponents = draft.items.filter(item => item !== liveMain
      && selectedOptionsCoverItem(item?.name, liveMain?.options));
    if (duplicatedBundleComponents.length) {
      throw new Error(`订单确认页把套餐已包含的“${duplicatedBundleComponents.map(item => item.name).join('、')}”又作为单品重复加入，本轮不会提交`);
    }
    draft.items = [{
      name: liveMain?.name || ref.itemName,
      quantity,
      price: liveMain?.price || draft.total,
      options: liveMain?.options || selectedLabels.join('、'),
      imageUrl: liveMain?.imageUrl || '',
    }, ...addedStandaloneItems.map(name => {
      const live = draft.items.find(item => String(item.name || '').includes(name)
        || String(name).includes(item.name)
        || singleFruitItemMatches(item.name, name));
      return { name: live?.name || name, quantity: 1, price: live?.price || 0, options: live?.options || '逐项加购的单品', imageUrl: live?.imageUrl || '' };
    })];
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
    let initialBody = clean(await page.locator('body').innerText().catch(() => ''), 20_000);
    let etaText = checkoutEtaText(initialBody);
    const itemNames = Array.isArray(browserOrderRef?.itemNames) ? browserOrderRef.itemNames.map(name => clean(name, 160)).filter(Boolean) : [];
    const assertRetailCartUnchanged = async () => {
      if (!itemNames.length) return;
      const currentNames = await page.evaluate(() => {
        const list = document.querySelector('[class*="goodsListWrap"]');
        if (!list) return [];
        return [...list.querySelectorAll('[role="button"][aria-label]')]
          .map(node => String(node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
          .filter(name => name && !/^共\s*\d+\s*件/.test(name));
      }).catch(() => []);
      if (!currentNames.length) return;
      const same = currentNames.length === itemNames.length
        && itemNames.every(name => currentNames.some(current => productMatchesSavedItem(current, name) || productMatchesSavedItem(name, current)));
      if (!same) throw new Error('提交前零售购物车发生变化，已停止；不会把换购或其他商品混入订单');
    };
    const existingImageUrl = clean(browserOrderRef?.imageUrl, 440_000);
    const initialImageUrl = (existingImageUrl.startsWith('data:image/') ? existingImageUrl : '')
      || await this.readOrderImage(page, itemNames)
      || existingImageUrl;
    const alreadyAtPaymentSelection = /支付宝/.test(initialBody) && /确认支付/.test(initialBody);
    let couponCheck = browserOrderRef?.couponCheck || null;
    if (!alreadyAtPaymentSelection) {
      const selectedWindow = await this.selectEarliestDeliveryWindow(page);
      if (selectedWindow) {
        initialBody = clean(await page.locator('body').innerText().catch(() => ''), 20_000);
        etaText = selectedWindow;
      }
      couponCheck = await this.applyBestAvailableCoupon(page);
      if (!['applied', 'none'].includes(couponCheck?.status)) {
        throw new Error('优惠券检查没有得到“已使用”或“确认无券”的结果，已停止提交');
      }
      await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
      etaText = checkoutEtaText(await page.locator('body').innerText().catch(() => '')) || etaText;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await assertRetailCartUnchanged();
        const button = await this.checkoutSubmitControl(page);
        if (!button) throw new Error('未找到淘宝闪购提交订单按钮，请在浏览器窗口核对');
        await button.evaluate(node => node.click()).catch(() => this.activateControl(page, button));
        await page.waitForTimeout(700);
        await this.riskCheck(page, { waitForHuman: true, maxWaitMs: 120_000 });
        if (await this.resolveCheckoutUtensils(page)) {
          continue;
        }
        break;
      }
    }
    if (alreadyAtPaymentSelection && !['applied', 'none'].includes(couponCheck?.status)) {
      throw new Error('订单已在收银台，但缺少本单提交前的优惠券核验记录，不能把本轮算作完整成功');
    }
    const paymentPage = await this.waitForPaymentSelection(page, beforePages);
    await this.riskCheck(paymentPage, { waitForHuman: true, maxWaitMs: 120_000 });
    let paymentSelectionFallback = null;
    for (let i = 0; i < 25; i += 1) {
      await page.waitForTimeout(500);
      const candidate = this.context.pages().find(item => !beforePages.has(item)) || this.context.pages().at(-1) || page;
      const candidateBody = clean(await candidate.locator('body').innerText().catch(() => ''), 20_000);
      if (/支付宝/.test(candidateBody) && /确认支付/.test(candidateBody)) paymentSelectionFallback = candidate;
      const paymentButton = await this.visibleLocator(candidate.getByText(/^付款$/, { exact: true }), true).catch(() => null);
      if (/alipay|cashier|counter|tradepay|payment|\/pay/i.test(candidate.url()) && paymentButton && /(?:^|\s)付款(?:\s|$)/.test(candidateBody)) {
        this.page = candidate;
        const imageUrl = initialImageUrl || await this.readOrderImage(candidate, itemNames);
        const exactEtaText = checkoutEtaText(candidateBody) || checkoutEtaText(await page.locator('body').innerText().catch(() => '')) || etaText;
        return {
          status: 'pending_payment', payUrl: candidate.url(), etaText: exactEtaText, imageUrl, couponCheck,
          browserOrderRef: { stage: 'cashier', url: candidate.url(), itemNames, imageUrl, couponCheck },
        };
      }
    }
    if (paymentSelectionFallback && !paymentSelectionFallback.isClosed()) {
      const selectionBody = clean(await paymentSelectionFallback.locator('body').innerText().catch(() => ''), 20_000);
      if (/支付宝/.test(selectionBody) && /确认支付/.test(selectionBody)) {
        this.page = paymentSelectionFallback;
        const selectionUrl = paymentSelectionFallback.url();
        const imageUrl = initialImageUrl || await this.readOrderImage(paymentSelectionFallback, itemNames);
        const exactEtaText = checkoutEtaText(selectionBody) || checkoutEtaText(await page.locator('body').innerText().catch(() => '')) || etaText;
        return {
          status: 'pending_payment', payUrl: /alipay|cashier|counter|tradepay|payment|\/pay/i.test(selectionUrl) ? selectionUrl : '', etaText: exactEtaText, imageUrl, couponCheck,
          browserOrderRef: { stage: 'payment_selection', url: selectionUrl, itemNames, imageUrl, couponCheck },
        };
      }
    }
    const body = clean(await page.locator('body').innerText().catch(() => ''), 3000);
    if (/支付成功|付款成功/.test(body)) return { status: 'paid', payUrl: '', etaText, browserOrderRef: { stage: 'paid', url: page.url() } };
    if (/确认订单/.test(body) && /立即支付|提交订单/.test(body)) throw new Error('淘宝闪购仍停留在订单确认页，没有完成真实订单提交');
    if (/网络不太好|刷新页面|加载失败/.test(body)) throw new Error('淘宝闪购提交后出现网络错误，没有到达支付宝“付款”页面，本轮不能算创建成功');
    throw new Error('淘宝闪购没有到达支付宝“付款”页面，本轮不能算创建成功');
  }

  async orderStatus(browserOrderRef) {
    let page = await this.ensure();
    const targetUrl = clean(browserOrderRef?.url, 1000);
    if (targetUrl && page.url() !== targetUrl) {
      page = await this.goto(targetUrl, 1800);
    } else if (targetUrl && ['cashier', 'payment_selection'].includes(browserOrderRef?.stage)) {
      // The user may have completed this checkout in Alipay or another browser.
      // A still-open cashier tab otherwise keeps its pre-payment DOM forever and
      // makes the role believe an already paid meal is still unpaid.
      await this.riskCheck(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await this.reveal(page);
      await this.waitForContent(page, 1200);
    }
    await this.riskCheck(page);
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
    return { status: ['cashier', 'payment_selection'].includes(browserOrderRef?.stage) ? 'pending_payment' : 'created', etaText, imageUrl };
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
    else {
      const height = await page.evaluate(() => window.innerHeight).catch(() => 896);
      await this.tapPoint(page, 58, Math.max(120, height - 54));
    }
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

  async cleanupCartItem(itemName, { clearAll = false } = {}) {
    if (!itemName) throw new Error('缺少要清理的测试商品名');
    let page = await this.ensure();
    if (/checkout|confirm|buy/i.test(page.url())) {
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    const retailPanelOpen = async () => Boolean(await this.visibleLocator(page.locator('[aria-label="清空购物车"]'), true));
    if (clearAll && await retailPanelOpen()) {
      const clearCart = await this.visibleLocator(page.locator('[aria-label="清空购物车"]'), true);
      await clearCart.evaluate(node => node.click()).catch(() => this.activateControl(page, clearCart));
      await page.waitForTimeout(300);
      const confirm = await this.visibleLocator(page.getByText(/^(?:确定|确认)$/), true);
      if (confirm) await confirm.evaluate(node => node.click()).catch(() => this.activateControl(page, confirm));
      await page.waitForTimeout(500);
      const remainingRows = await this.readSelectedCartItems(page).catch(() => []);
      if (!remainingRows.length) return { removed: 1, cartAmount: 0 };
      throw new Error('本次授权允许清空旧购物车，但平台没有确认清空，已安全停止');
    }
    const decrementControls = page.locator('.mod-mes-card [aria-label*="减少"], .mod-mes-card [aria-label*="减购"]');
    let openedMinus = await this.visibleLocator(decrementControls, true);
    if (!openedMinus) {
      const basket = await this.visibleLocator(page.locator('[aria-label*="购物车篮子"]'), true);
      const cartTrigger = await this.renderedLocator(page.locator('[aria-label*="购物车总计金额"]'));
      if (basket) await this.activateControl(page, basket);
      else if (cartTrigger) await this.activateControl(page, cartTrigger);
      else {
        const height = await page.evaluate(() => window.innerHeight).catch(() => 896);
        await this.tapPoint(page, 58, Math.max(120, height - 54));
      }
      await page.waitForTimeout(600);
      if (clearAll && await retailPanelOpen()) {
        const clearCart = await this.visibleLocator(page.locator('[aria-label="清空购物车"]'), true);
        await clearCart.evaluate(node => node.click()).catch(() => this.activateControl(page, clearCart));
        await page.waitForTimeout(300);
        const confirm = await this.visibleLocator(page.getByText(/^(?:确定|确认)$/), true);
        if (confirm) await confirm.evaluate(node => node.click()).catch(() => this.activateControl(page, confirm));
        await page.waitForTimeout(500);
        const remainingRows = await this.readSelectedCartItems(page).catch(() => []);
        if (!remainingRows.length) return { removed: 1, cartAmount: 0 };
        throw new Error('本次授权允许清空旧购物车，但平台没有确认清空，已安全停止');
      }
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
    const cartAmount = removed > 0 && !remainingMinus ? 0 : (cartLabel ? number(cartLabel) : null);
    if (cartAmount !== 0 && !remainingMinus) throw new Error('没有找到购物车商品对应的减少按钮');
    return { removed, cartAmount };
  }

  async diagnosticCleanupItem(itemName) {
    return this.cleanupCartItem(itemName);
  }
}
