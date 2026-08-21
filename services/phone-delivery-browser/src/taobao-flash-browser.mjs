import fs from 'node:fs/promises';

const MSITE = 'https://h5.ele.me/';
const ADDRESS_URL = 'https://h5.ele.me/minisite/pages-poi/address/index';
const clean = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const number = value => Number(String(value ?? '').match(/[\d.]+/)?.[0] || 0);
const groupHeading = /^(规格|套餐|杯型|份量|容量|温度|冰度|糖度|甜度|口味|辣度|(?:推荐)?(?:加料|小料|配料).{0,40}|酱料|做法|主食\d*|小食\d*|甜品(?:\/小食)?|小食\/甜品|饮料|赠送|全鸡|配餐|蘸酱)(?:\s*请选\d+份)?$/;
const shopUrl = url => /newretail\/p\/ushop|pages\/ele-takeout-index/i.test(String(url || ''));

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
    this.searchUrl = '';
    this.shops = [];
    this.addressCache = null;
  }

  async start() {
    if (this.context) return;
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
    this.context.setDefaultTimeout(this.timeout);
    this.page = this.context.pages()[0] || await this.context.newPage();
  }

  async ensure() { await this.start(); return this.page; }
  async goto(url, wait = 2500) { const page = await this.ensure(); await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(wait); return page; }
  needsLogin(page) { return /\/login|login\.ele\.me|passport/i.test(page.url()); }
  async requireLogin(page) { if (this.needsLogin(page)) throw new Error('淘宝闪购登录已失效，请在浏览器窗口用手机号、短信验证码和滑块重新登录'); }
  async riskCheck(page) { const body = clean(await page.locator('body').innerText().catch(() => ''), 2000); if (/滑块|安全验证|请完成验证|访问过于频繁/.test(body)) throw new Error('淘宝闪购触发安全验证，请在浏览器窗口人工完成后重试'); }

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
    const page = await this.goto(`https://h5.ele.me/search/?keyword=${encodeURIComponent(query)}`, 4800);
    await this.requireLogin(page); await this.riskCheck(page);
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const ready = await page.locator('body').innerText().then(text => /左滑进店|加载更多数据/.test(text)).catch(() => false);
      if (ready) break;
      await page.waitForTimeout(750);
    }
    this.searchUrl = page.url();
    this.shops = await this.extractShops(page);
    if (!this.shops.length) throw new Error('淘宝闪购没有解析到可配送商家，请确认地址或在浏览器窗口处理验证');
    const offers = [];
    for (let shopIndex = 0; shopIndex < Math.min(this.shops.length, 4) && offers.length < limit; shopIndex += 1) {
      const shop = this.shops[shopIndex];
      const shopPage = await this.enterShop(shopIndex);
      const items = await this.extractMenu(shopPage, Math.max(2, Math.ceil(limit / Math.min(4, this.shops.length))));
      for (const item of items) {
        const optionGroups = await this.inspectOptions(shopPage, item.buttonIndex, item).catch(error => {
          if (process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) console.error('[phone-delivery-browser] option inspection failed:', clean(error?.message || error, 240));
          return [];
        });
        const deliveryFee = shop.freeDeliveryThreshold > 0 && item.price >= shop.freeDeliveryThreshold ? 0 : shop.deliveryFee;
        offers.push({
          merchantId: shop.storeId || String(shopIndex), merchant: shop.name, name: item.name,
          description: item.description, price: item.price, deliveryFee,
          total: item.price + deliveryFee, rating: shop.rating, monthlySales: shop.monthlySales,
          etaMinutes: shop.etaMinutes, couponLabel: shop.couponLabel, optionGroups,
          browserRef: { shopIndex, itemName: item.name, buttonIndex: item.buttonIndex, detailUrl: item.detailUrl || '', shopUrl: shop.anchorUrl || '' },
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
    await page.waitForTimeout(700);
    await this.dismissPromoOverlays(page);
    await this.purchaseControls(page).first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
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

  async extractMenu(page, limit) {
    const controls = this.purchaseControls(page);
    await controls.first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
    const items = [];
    for (let buttonIndex = 0; buttonIndex < await controls.count() && items.length < limit; buttonIndex += 1) {
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
    return items.filter((item, index) => items.findIndex(other => other.name === item.name) === index);
  }

  purchaseControls(page) {
    return page.locator('[aria-label*="加购"], [aria-label*="选规格"], [aria-label*="选套餐"]').or(page.getByText(/^(选规格|选套餐|加购)$/));
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
    const buttons = this.purchaseControls(page);
    const button = buttons.nth(buttonIndex);
    const originUrl = page.url();
    const before = clean(await page.locator('[aria-label*="购物车总计金额"]').first().getAttribute('aria-label').catch(() => ''));
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
    if (enteredDetail) { await page.goto(originUrl, { waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(700); }
    const normalizedGroups = [];
    for (const group of groups) {
      const singleChoiceAddOn = /任选\s*1\s*种/.test(group.name) || group.choices.some(label => /任选\s*1\s*种/.test(label));
      const choices = group.choices.filter(label => !/^(猜你喜欢|温馨小贴士|数量|\d+|[（(]任选\s*\d+\s*种[）)])$/.test(label));
      if (/温度|冰度/.test(group.name)) {
        const addOnStart = choices.findIndex((label, index) => index > 0 && !/冰|常温|温|热|冷/.test(label));
        if (addOnStart > 0) {
          normalizedGroups.push({ name: group.name, choices: choices.slice(0, addOnStart), multiple: false });
          normalizedGroups.push({ name: '加料', choices: choices.slice(addOnStart), multiple: !singleChoiceAddOn });
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

  async createOrder({ ref, selectedOptions, quantity }) {
    let page; let targetControlY = null;
    if (ref.detailUrl) {
      page = await this.goto(ref.detailUrl, 1800);
      const body = clean(await page.locator('body').innerText().catch(() => ''), 2400);
      if (!body.includes(ref.itemName)) throw new Error('真实商品详情已失效，请重新搜索');
    } else {
      page = ref.shopUrl ? await this.goto(ref.shopUrl, 900) : await this.enterShop(ref.shopIndex, { preferSaved: true });
      await this.purchaseControls(page).first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
      const existingCartLabel = clean(await page.locator('[aria-label*="购物车总计金额"]').first().getAttribute('aria-label').catch(() => ''));
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
    if (dialog) {
      const inspected = await this.dialogGroups(dialog);
      for (const ids of Object.values(selectedOptions || {})) {
        for (const id of (Array.isArray(ids) ? ids : [ids])) {
          const match = String(id).match(/^g(\d+)c(\d+)$/); if (!match) continue;
          const group = inspected[Number(match[1])];
          const label = group?.choices?.[Number(match[2])];
          if (label) {
            await dialog.getByText(label, { exact: true }).first().click();
            selectedLabels.push(`${group.name}：${label}`);
          }
        }
      }
      const confirm = await this.visibleLocator(dialog.getByText(/加入购物车|确定|选好了/), true);
      if (!confirm) throw new Error('未找到规格确认按钮，请在浏览器窗口处理');
      await this.tapControl(page, confirm); await page.waitForTimeout(900);
    }
    for (let i = 1; i < quantity; i += 1) {
      const pluses = page.locator('[aria-label*="增加"], [aria-label*="添加"], [aria-label*="加购"]');
      const plus = targetControlY == null ? await this.visibleLocator(pluses) : await this.nearestControlAtY(pluses, targetControlY);
      if (plus) { await plus.evaluate(node => node.click()).catch(() => this.activateControl(page, plus)); await page.waitForTimeout(350); }
    }
    const checkout = await this.visibleLocator(page.getByText('去结算', { exact: false }), true);
    if (!checkout) throw new Error('未达到起送金额或无法结算，请重新选择商品');
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
    if (!/checkout|confirm|buy/i.test(page.url())) throw new Error('淘宝闪购没有进入订单确认页，请重新搜索后再试');
    await page.waitForTimeout(1800); await this.riskCheck(page);
    const body = clean(await page.locator('body').innerText(), 6000);
    const amounts = checkoutAmounts(body);
    const total = amounts.total;
    if (!total) throw new Error('没有从淘宝闪购确认页读到有效金额');
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
    const button = await this.visibleLocator(page.getByText(/提交订单|提交并支付|去支付|立即支付/, { exact: false }), true);
    if (!button) throw new Error('未找到淘宝闪购提交订单按钮，请在浏览器窗口核对');
    const beforePages = new Set(this.context.pages());
    await this.tapControl(page, button);
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

  async diagnosticCleanupItem(itemName) {
    if (!itemName) throw new Error('缺少要清理的测试商品名');
    let page = await this.ensure();
    if (/checkout|confirm|buy/i.test(page.url())) {
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    const cartTrigger = await this.renderedLocator(page.locator('[aria-label*="购物车总计金额"]'));
    if (cartTrigger) await this.activateControl(page, cartTrigger);
    else await page.touchscreen.tap(42, 884);
    await page.waitForTimeout(600);
    let removed = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const title = await this.visibleLocator(page.getByText(itemName, { exact: true }), true);
      if (!title) break;
      const box = await title.boundingBox().catch(() => null);
      if (!box) break;
      const minus = await this.nearestControlAtY(page.locator('[aria-label*="减少"], [aria-label*="减购"]'), box.y + box.height / 2);
      if (!minus) {
        if (removed > 0) break;
        throw new Error('没有找到测试商品对应的减少按钮');
      }
      await minus.evaluate(node => node.click()).catch(() => this.activateControl(page, minus));
      removed += 1; await page.waitForTimeout(350);
    }
    const cartLabel = clean(await page.locator('[aria-label*="购物车总计金额"]').first().getAttribute('aria-label').catch(() => ''));
    return { removed, cartAmount: number(cartLabel) };
  }
}
