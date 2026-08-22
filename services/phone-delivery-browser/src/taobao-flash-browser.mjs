import fs from 'node:fs/promises';
import path from 'node:path';

const MSITE = 'https://h5.ele.me/';
const ADDRESS_URL = 'https://h5.ele.me/minisite/pages-poi/address/index';
const clean = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const number = value => Number(String(value ?? '').match(/[\d.]+/)?.[0] || 0);
const groupHeading = /^(规格|套餐|杯型|份量|容量|温度|冰度|糖度|甜度|口味|辣度|(?:推荐)?(?:加料|小料|配料).{0,40}|酱料|做法|主食\d*|小食\d*|甜品(?:\/小食)?|小食\/甜品|饮料|赠送|全鸡|配餐|蘸酱)(?:\s*[（(]?(?:请选|请选择|任选)\s*\d+\s*份[）)]?)?$/;
const shopUrl = url => /newretail\/p\/ushop|pages\/ele-takeout-index/i.test(String(url || ''));

export function riskChallengeKind(value) {
  const body = clean(value, 12_000);
  if (/请选择符合描述的所有图片|没有新图片可以点后.*提交|请选择所有.*图片/i.test(body)) return '图片验证';
  if (/滑块|安全验证|请完成验证|访问过于频繁|验证码/i.test(body)) return '安全验证';
  return '';
}

export function preferredBrand(value) {
  const query = clean(value, 120);
  if (/瑞幸(?:咖啡)?|luckin/i.test(query)) return 'luckin';
  if (/喜茶|heytea/i.test(query)) return 'heytea';
  if (/霸王茶姬|chagee/i.test(query)) return 'chagee';
  if (/奈雪/i.test(query)) return 'nayuki';
  return '';
}

export function brandMatches(brand, value) {
  const name = clean(value, 120);
  if (brand === 'luckin') return /瑞幸(?:咖啡)?|luckin/i.test(name);
  if (brand === 'heytea') return /喜茶|heytea/i.test(name);
  if (brand === 'chagee') return /霸王茶姬|chagee/i.test(name);
  if (brand === 'nayuki') return /奈雪/i.test(name);
  return false;
}

export function knownRouteKey(value) {
  return clean(value, 160).toLowerCase()
    .replace(/(?:无糖|零糖|少糖|微糖|半糖|全糖|正常糖|不另外加糖|少冰|少少冰|去冰|正常冰|多冰|热饮|冷饮|常温|大杯|中杯|小杯)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
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

export class TaobaoFlashBrowser {
  constructor({ profile, headless = false, timeout = 30_000 } = {}) {
    this.profile = profile || './profile';
    this.headless = headless;
    this.timeout = timeout;
    this.executablePath = process.env.PHONE_DELIVERY_CHROME_PATH || '';
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
  }

  async start() {
    if (this.context) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startOnce();
    try { await this.startPromise; }
    catch (error) {
      await this.context?.close().catch(() => {});
      this.context = null; this.page = null;
      this.prewarmed = false;
      throw error;
    } finally { this.startPromise = null; }
  }

  async startOnce() {
    await fs.mkdir(this.profile, { recursive: true });
    const { chromium } = await import('playwright');
    this.context = await chromium.launchPersistentContext(this.profile, {
      headless: this.headless,
      ...(this.executablePath ? { executablePath: this.executablePath } : {}),
      viewport: { width: 430, height: 932 },
      locale: 'zh-CN', timezoneId: 'Asia/Shanghai', isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
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

  async reveal(page = this.page) {
    if (this.headless || !page) return;
    await page.bringToFront().catch(() => {});
  }

  async ensure() { await this.start(); await this.reveal(this.page); return this.page; }
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

  async knownRoute(query) {
    const key = knownRouteKey(query);
    if (!key) return null;
    const routes = await this.loadKnownRoutes();
    if (routes[key]) return { ...routes[key], routeKey: key };
    const brand = preferredBrand(query);
    const found = Object.entries(routes)
      .filter(([, entry]) => !brand || brandMatches(brand, `${entry.merchant} ${entry.query}`))
      .filter(([, entry]) => {
        const itemKey = knownRouteKey(entry.itemName);
        return itemKey && (key.includes(itemKey) || itemKey.includes(key));
      })
      .sort(([, left], [, right]) => Number(right.savedAt || 0) - Number(left.savedAt || 0))[0];
    return found ? { ...found[1], routeKey: found[0] } : null;
  }

  async forgetKnownRoute(query) {
    const key = knownRouteKey(query);
    const routes = await this.loadKnownRoutes();
    if (!key || !routes[key]) return;
    delete routes[key];
    await this.writeKnownRoutes();
  }

  async rememberKnownRoute(ref) {
    const key = knownRouteKey(ref?.query);
    if (!key || !shopUrl(ref?.shopUrl) || !clean(ref?.itemName, 140)) return;
    const routes = await this.loadKnownRoutes();
    for (const [routeKey, entry] of Object.entries(routes)) {
      if (routeKey !== key && knownRouteKey(entry.itemName) === knownRouteKey(ref.itemName) && clean(entry.shopUrl, 1000) === clean(ref.shopUrl, 1000)) delete routes[routeKey];
    }
    routes[key] = {
      query: clean(ref.query, 160), merchant: clean(ref.merchant, 100), merchantId: clean(ref.merchantId, 120),
      itemName: clean(ref.itemName, 140), shopUrl: clean(ref.shopUrl, 1000), savedAt: Date.now(),
    };
    await this.writeKnownRoutes();
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

  async riskCheck(page, { waitForHuman = false, maxWaitMs = 0 } = {}) {
    const startedAt = Date.now();
    for (;;) {
      const kind = riskChallengeKind(await this.riskText(page));
      if (!kind) return Date.now() - startedAt;
      if (!waitForHuman || Date.now() - startedAt >= maxWaitMs) {
        throw new Error(`淘宝闪购出现${kind}，本轮已暂停且不会自动重试；请在电脑浏览器手动完成后重新告诉角色开始`);
      }
      await this.reveal(page);
      await page.waitForTimeout(1000);
    }
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
    await this.requireLogin(page); await this.riskCheck(page);
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

  async search(query, limit = 12) {
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
    if (remembered) {
      const shop = {
        index: 0, name: remembered.merchant || '已记住的商家', storeId: remembered.merchantId || '',
        anchorUrl: remembered.shopUrl, directUrl: remembered.shopUrl, deliveryFee: 0, freeDeliveryThreshold: 0,
        etaMinutes: 0, rating: 0, monthlySales: 0, couponLabel: '',
      };
      this.searchUrl = '';
      this.shops = [shop];
      try {
        const page = await this.enterShop(0, { preferSaved: true });
        await this.requireLogin(page); await waitForHumanVerification(page);
        const items = await this.extractMenu(page, Math.max(12, limit), query);
        const target = knownRouteKey(remembered.itemName);
        const item = items.find(row => knownRouteKey(row.name) === target) || items.find(row => knownRouteKey(row.name).includes(target) || target.includes(knownRouteKey(row.name)));
        if (item) {
          const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
          return [{
            merchantId: shop.storeId || 'saved-shop', merchant: shop.name, name: item.name,
            description: item.description, price: item.price, deliveryFee, total: item.price + deliveryFee,
            rating: shop.rating, monthlySales: shop.monthlySales, etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel,
            optionGroups: [], optionsLoaded: false,
            browserRef: { shopIndex: 0, itemName: item.name, buttonIndex: item.buttonIndex, detailUrl: '', shopUrl: shop.anchorUrl || shop.directUrl, query, merchant: shop.name, merchantId: shop.storeId || '' },
          }];
        }
        await this.forgetKnownRoute(remembered.routeKey || query);
      } catch (error) {
        const message = String(error?.message || error);
        if (!/真实商家已失效|未能进入淘宝闪购商家|没有在真实商家中定位到同一件商品/.test(message)) throw error;
        await this.forgetKnownRoute(remembered.routeKey || query).catch(() => {});
      }
    }
    const page = await this.goto(`https://h5.ele.me/search/?keyword=${encodeURIComponent(query)}`, 2500);
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
      if (exact.length) shops = exact.slice(0, 1);
    }
    this.searchUrl = page.url();
    this.shops = shops;
    if (!this.shops.length) throw new Error('淘宝闪购没有解析到可配送商家，请确认地址或在浏览器窗口处理验证');
    const offers = [];
    const maxShops = Math.min(this.shops.length, 2, Math.max(1, limit));
    for (let shopIndex = 0; shopIndex < maxShops && offers.length < limit; shopIndex += 1) {
      assertWithinSearchTime();
      const shop = this.shops[shopIndex];
      const shopPage = await this.enterShop(shopIndex);
      await waitForHumanVerification(shopPage);
      const items = await this.extractMenu(shopPage, Math.max(1, Math.ceil(limit / maxShops)), query);
      for (const item of items) {
        const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
        offers.push({
          merchantId: shop.storeId || String(shopIndex), merchant: shop.name, name: item.name,
          description: item.description, price: item.price, deliveryFee,
          total: item.price + deliveryFee, rating: shop.rating, monthlySales: shop.monthlySales,
          etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel, optionGroups: [], optionsLoaded: false,
          browserRef: { shopIndex, itemName: item.name, buttonIndex: item.buttonIndex, detailUrl: item.detailUrl || '', shopUrl: shop.anchorUrl || '', query, merchant: shop.name, merchantId: shop.storeId || '' },
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
    if (preferSaved && shop.directUrl) page = await this.goto(shop.directUrl, 2200);
    else if (!shopUrl(page.url())) {
      if (preferSaved && shop.directUrl) page = await this.goto(shop.directUrl, 2200);
      else {
        page = page.url() === this.searchUrl ? page : await this.goto(this.searchUrl, 2200);
        for (const x of [110, 190, 280]) {
          await page.touchscreen.tap(x, Math.max(80, shop.anchorY - 75));
          await page.waitForTimeout(900);
          if (shopUrl(page.url())) break;
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
    if (await promo.isVisible().catch(() => false)) await page.touchscreen.tap(402, 194).catch(() => {});
    await page.waitForTimeout(350);
  }

  async extractMenu(page, limit, query = '') {
    const controls = this.purchaseControls(page);
    await this.waitForPurchaseControls(page, 8000);
    const items = [];
    for (let buttonIndex = 0; buttonIndex < Math.min(await controls.count(), 80); buttonIndex += 1) {
      const control = controls.nth(buttonIndex);
      const card = await control.evaluate(button => {
        const box = button.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0 || box.y <= 140) return null;
        let node = button;
        for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
          if (!node.classList?.contains('menuItem--info')) continue;
          const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
          const nameNode = node.querySelector('.menuItem--info--box') || node;
          const nameText = (nameNode.innerText || '').replace(/\s+/g, ' ').trim();
          if (/¥|￥/.test(text)) return { text, nameText };
        }
        return null;
      }).catch(() => null);
      if (!card || /非卖品|请勿下单|单点不送/.test(card.text)) continue;
      const text = card.text;
      const priceSource = /预估到手|预估价/.test(text) ? text.split(/预估到手|预估价/)[0] : text;
      const prices = [...priceSource.matchAll(/[¥￥]\s*(\d+)(?:\s*\.\s*(\d+))?/g)]
        .map(match => number(`${match[1]}${match[2] ? `.${match[2]}` : ''}`)).filter(value => value > 0);
      const price = prices.at(-1) || 0;
      const name = clean(card.nameText.split(/月售|近期\d+人|[¥￥]/)[0], 60).replace(/^(热销|大家喜欢吃，才叫真好吃)\s*/, '').replace(/\s+\d+次$/, '');
      if (name && price > 0) items.push({ buttonIndex, name, price, description: clean(text, 240) });
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
    const page = ref.shopUrl ? await this.goto(ref.shopUrl, 900) : await this.enterShop(ref.shopIndex, { preferSaved: true });
    await this.waitForPurchaseControls(page, 8000);
    const button = await this.productControl(page, ref.itemName);
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
      const headings = leaves.filter(item => heading.test(item.text));
      const result = [];
      for (let i = 0; i < headings.length; i += 1) {
        const start = headings[i].y + headings[i].h;
        const end = headings[i + 1]?.y ?? Infinity;
        const choices = leaves.filter(item => item.y >= start && item.y < end && item.x > headings[i].x - 5 && !/确定|取消|加入购物车|¥|￥|\d+(?:\.\d+)?折|数量/.test(item.text));
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
    const multiBundle = groups.find(group => {
      const match = String(group.name || '').match(/(?:请选|请选择|任选)\s*(\d+)\s*份/);
      return match && Number(match[1]) > 1;
    });
    if (enteredDetail) { await page.goto(originUrl, { waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(700); }
    if (multiBundle) {
      const count = Number(String(multiBundle.name).match(/(?:请选|请选择|任选)\s*(\d+)\s*份/)?.[1] || 2);
      const label = clean(String(multiBundle.name).replace(/[（(]?(?:请选|请选择|任选)\s*\d+\s*份[）)]?/g, ''), 40) || '商品';
      throw new Error(`这个真实套餐要求选择${count}份${label}，暂不能安全代选组合；请先告诉我具体想要哪${count}份，或换成单杯商品`);
    }
    const normalizedGroups = [];
    for (const group of groups) {
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
      normalizedGroups.push({ name: group.name, choices, multiple: /加料|小料|配料/.test(group.name) && !singleChoiceAddOn });
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
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
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
    const marked = await page.evaluate(name => {
      const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
      const controls = [...document.querySelectorAll('[aria-label*="加购"], [aria-label*="选规格"], [aria-label*="选套餐"]')]
        .map(node => ({ node, box: node.getBoundingClientRect() })).filter(item => item.box.width > 0 && item.box.height > 0 && item.box.y > 140);
      let best = null; let bestLength = Infinity;
      for (const control of controls) {
        let parent = control.node.parentElement;
        for (let depth = 0; parent && depth < 6; depth += 1, parent = parent.parentElement) {
          const text = normalized(parent.innerText);
          if (text.includes(name) && text.length <= 900 && text.length < bestLength) {
            best = control.node; bestLength = text.length;
            break;
          }
        }
      }
      if (best) { best.setAttribute('data-phone-delivery-target', '1'); return true; }
      return false;
    }, itemName).catch(() => false);
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

  async createOrder({ ref, selectedOptions, optionGroups = [], quantity }) {
    let page; let targetControlY = null;
    if (ref.detailUrl) {
      page = await this.goto(ref.detailUrl, 1800);
      const body = clean(await page.locator('body').innerText().catch(() => ''), 2400);
      if (!body.includes(ref.itemName)) throw new Error('真实商品详情已失效，请重新搜索');
    } else {
      page = ref.shopUrl ? await this.goto(ref.shopUrl, 900) : await this.enterShop(ref.shopIndex, { preferSaved: true });
      await this.waitForPurchaseControls(page, 8000);
      const existingCartLabel = clean(await page.locator('[aria-label*="购物车总计金额"]').first().getAttribute('aria-label', { timeout: 1500 }).catch(() => ''));
      const existingCheckout = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
      if (number(existingCartLabel) > 0 || existingCheckout) throw new Error('淘宝闪购当前门店购物车已有商品，为避免混单请先在官方页面处理购物车');
      let add = null;
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
      await add.evaluate(node => node.click()); await page.waitForTimeout(700);
      if (/pages\/ele-index-search/i.test(page.url())) throw new Error('真实商品按钮发生页面漂移，请重新搜索');
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
      await plus.evaluate(node => node.click()).catch(() => this.activateControl(page, plus));
      await page.waitForTimeout(350);
    }
    const checkout = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
    if (!checkout) {
      const suffix = await this.cleanupFailureSuffix(ref.itemName);
      throw new Error(`未达到起送金额或无法结算，${suffix}，请重新选择商品或数量`);
    }
    const checkoutUrl = page.url();
    await checkout.evaluate(node => {
      let target = node;
      for (let depth = 0; target && depth < 6; depth += 1, target = target.parentElement) {
        const role = target.getAttribute?.('role') || '';
        const cls = String(target.className || '');
        if (role === 'button' || typeof target.onclick === 'function' || /submit|checkout|cart.*button|settle/i.test(cls)) { target.click(); return; }
      }
      node.click();
    }).catch(() => this.activateControl(page, checkout));
    for (let attempt = 0; attempt < 12 && page.url() === checkoutUrl; attempt += 1) await page.waitForTimeout(300);
    if (page.url() === checkoutUrl) {
      await this.activateControl(page, checkout); await page.waitForTimeout(1800);
    }
    if (!/checkout|confirm|buy/i.test(page.url())) {
      const suffix = await this.cleanupFailureSuffix(ref.itemName);
      throw new Error(`淘宝闪购没有进入订单确认页，${suffix}，请重新搜索后再试`);
    }
    await page.waitForTimeout(1800); await this.riskCheck(page);
    const body = clean(await page.locator('body').innerText(), 6000);
    const amounts = checkoutAmounts(body);
    const total = amounts.total;
    if (!total) {
      const suffix = await this.cleanupFailureSuffix(ref.itemName);
      throw new Error(`没有从淘宝闪购确认页读到有效金额，${suffix}`);
    }
    return { total, discount: amounts.discount, items: [{ name: ref.itemName, quantity, price: total, options: selectedLabels.join('、') }], browserOrderRef: { stage: 'confirm', url: page.url() }, risk: [] };
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

  async submitOrder(browserOrderRef) {
    const page = await this.ensure();
    if (!/buy|order|confirm/i.test(page.url()) && browserOrderRef?.url) await this.goto(browserOrderRef.url, 1800);
    const beforePages = new Set(this.context.pages());
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const button = await this.visibleLocator(page.getByText(/提交订单|提交并支付|去支付|立即支付/, { exact: false }), true);
      if (!button) throw new Error('未找到淘宝闪购提交订单按钮，请在浏览器窗口核对');
      await this.tapControl(page, button); await page.waitForTimeout(700);
      const promptBody = clean(await page.locator('body').innerText().catch(() => ''), 7000);
      if (/选择餐具份数/.test(promptBody)) {
        const noUtensils = await this.visibleLocator(page.getByText('无需餐具', { exact: true }), true);
        if (!noUtensils) throw new Error('淘宝闪购要求选择餐具，但没有提供“无需餐具”选项');
        await this.tapControl(page, noUtensils); await page.waitForTimeout(600);
        continue;
      }
      break;
    }
    for (let i = 0; i < 25; i += 1) {
      await page.waitForTimeout(500);
      const candidate = this.context.pages().find(item => !beforePages.has(item)) || this.context.pages().at(-1) || page;
      if (/alipay|cashier|counter|tradepay|payment|\/pay/i.test(candidate.url())) {
        this.page = candidate;
        return { status: 'pending_payment', payUrl: candidate.url(), browserOrderRef: { stage: 'cashier', url: candidate.url() } };
      }
    }
    const body = clean(await page.locator('body').innerText().catch(() => ''), 3000);
    if (/支付成功|付款成功/.test(body)) return { status: 'paid', payUrl: '', browserOrderRef: { stage: 'paid', url: page.url() } };
    if (/确认订单/.test(body) && /立即支付|提交订单/.test(body)) throw new Error('淘宝闪购仍停留在订单确认页，没有完成真实订单提交');
    return { status: 'pending_payment', payUrl: '', browserOrderRef: { stage: 'cashier', url: page.url() } };
  }

  async orderStatus(browserOrderRef) {
    const page = await this.ensure();
    if (browserOrderRef?.url && page.url() !== browserOrderRef.url) await this.goto(browserOrderRef.url, 1800).catch(() => {});
    const body = clean(await page.locator('body').innerText().catch(() => ''), 5000);
    const states = [
      [/已送达|订单完成/, 'delivered'], [/配送中|骑手正在配送/, 'delivering'], [/骑手已取餐|已取货/, 'picked_up'],
      [/骑手已接单|等待骑手取餐/, 'courier_assigned'], [/备餐中|商家制作中/, 'preparing'], [/商家已接单|商家已确认/, 'merchant_confirmed'],
      [/支付成功|付款成功|已支付/, 'paid'], [/已取消|订单取消/, 'canceled'], [/退款成功|已退款/, 'refunded'],
    ];
    for (const [pattern, status] of states) if (pattern.test(body)) return { status };
    return { status: browserOrderRef?.stage === 'cashier' ? 'pending_payment' : 'created' };
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
    else await page.touchscreen.tap(42, 866);
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
      else await page.touchscreen.tap(42, 866);
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
