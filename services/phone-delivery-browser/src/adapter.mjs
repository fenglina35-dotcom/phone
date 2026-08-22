import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { opaqueFingerprint } from './security.mjs';

const money = value => Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);

export class DeliveryAdapter {
  constructor({ browser, secret, maxOrderAmount = 100, maxOffers = 12 }) {
    this.browser = browser;
    this.secret = secret;
    this.maxOrderAmount = money(maxOrderAmount);
    this.maxOffers = Math.max(1, Math.min(30, Number(maxOffers) || 12));
    this.quotes = new Map();
    this.orders = new Map();
    this.createAttempts = new Map();
    this.payAttempts = new Map();
    this.capabilitiesCache = null;
    this.capabilitiesPromise = null;
  }

  async handle(action, payload = {}, context = {}) {
    if (action === 'diagnostic' && process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) return this.browser.diagnostic(process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH);
    if (action === 'diagnostic_options' && process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) return this.browser.diagnosticOptions(`${process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH}.options.png`);
    if (action === 'diagnostic_reenter' && process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) return this.browser.diagnosticReenter();
    if (action === 'diagnostic_first_options' && process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) return this.browser.diagnosticFirstOptions(`${process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH}.first-options.png`);
    if (action === 'diagnostic_control_map' && process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) return this.browser.diagnosticControlMap();
    if (action === 'diagnostic_cart' && process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) return this.browser.diagnosticCart(`${process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH}.cart.png`);
    if (action === 'diagnostic_cleanup_item' && process.env.PHONE_DELIVERY_DIAGNOSTIC_PATH) return this.browser.diagnosticCleanupItem(clean(payload.itemName, 140));
    if (action === 'capabilities') return this.capabilities();
    if (action === 'confirm_address') return this.confirmAddress(payload);
    if (action === 'search') return this.search(payload, context);
    if (action === 'offer_options') return this.offerOptions(payload, context);
    if (action === 'create_order') return this.createOrder(payload, context);
    if (action === 'pay_order') return this.payOrder(payload, context);
    if (action === 'order_status') return this.orderStatus(payload, context);
    throw new Error('不支持的真实外卖操作');
  }

  async capabilities() {
    if (this.capabilitiesCache && Date.now() - this.capabilitiesCache.cachedAt < 60_000) return { ...this.capabilitiesCache.value };
    if (!this.capabilitiesPromise) this.capabilitiesPromise = (async () => {
      const status = await this.browser.status();
      const value = {
        providers: ['taobao_flash'],
        payments: ['alipay'],
        automaticPayments: false,
        addressConfirmation: true,
        realtimeWebhooks: false,
        addressLabel: clean(status.addressLabel, 80),
        loginRequired: status.loggedIn !== true,
        loginUrl: clean(status.loginUrl, 500),
      };
      this.capabilitiesCache = { cachedAt: Date.now(), value };
      return value;
    })();
    try { return { ...await this.capabilitiesPromise }; } finally { this.capabilitiesPromise = null; }
  }

  async confirmAddress(payload) {
    if (payload.confirmedByUser !== true) throw new Error('必须由本人确认收货地址');
    const address = await this.browser.currentAddress();
    if (!address?.label || !address?.fingerprintSource) throw new Error('未能从淘宝闪购读取当前默认地址');
    const result = {
      addressLabel: clean(address.label, 80),
      addressFingerprint: opaqueFingerprint(this.secret, address.fingerprintSource),
    };
    if (this.capabilitiesCache) this.capabilitiesCache = { cachedAt: Date.now(), value: { ...this.capabilitiesCache.value, addressLabel: result.addressLabel, loginRequired: false, loginUrl: '' } };
    return result;
  }

  async search(payload, context) {
    const query = clean(payload.query, 120);
    if (!query) throw new Error('请输入要搜索的餐品或店铺');
    const address = await this.browser.currentAddress();
    const found = await this.browser.search(query, Math.min(this.maxOffers, Number(payload.limit) || this.maxOffers));
    const addressFingerprint = opaqueFingerprint(this.secret, address.fingerprintSource);
    const offers = found.slice(0, this.maxOffers).map(item => {
      const offerId = `tb_${crypto.randomUUID()}`;
      const quoteId = `q_${crypto.randomUUID()}`;
      const offer = {
        offerId, quoteId, provider: 'taobao_flash', merchantId: clean(item.merchantId, 120),
        merchant: clean(item.merchant, 100), name: clean(item.name, 140), description: clean(item.description, 240),
        price: money(item.price), deliveryFee: money(item.deliveryFee), total: money(item.total ?? (money(item.price) + money(item.deliveryFee))),
        rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : null,
        reviewCount: Number.isFinite(Number(item.reviewCount)) ? Number(item.reviewCount) : null,
        monthlySales: Number.isFinite(Number(item.monthlySales)) ? Number(item.monthlySales) : null,
        etaMinutes: Number.isFinite(Number(item.etaMinutes)) ? Number(item.etaMinutes) : null,
        couponLabel: clean(item.couponLabel, 100), imageUrl: clean(item.imageUrl, 800),
        optionGroups: Array.isArray(item.optionGroups) ? item.optionGroups : [],
        optionsLoaded: item.optionsLoaded === true,
        addressLabel: clean(address.label, 80), addressFingerprint, quoteExpiresAt: Date.now() + 8 * 60_000,
        rawVersion: clean(item.rawVersion || 'taobao-flash-browser-v1', 80),
      };
      this.quotes.set(`${context.target || ''}:${offerId}`, { ...offer, browserRef: item.browserRef, expiresAt: offer.quoteExpiresAt });
      return offer;
    });
    return { offers, addressLabel: clean(address.label, 80) };
  }

  async offerOptions(payload, context) {
    const key = `${context.target || ''}:${clean(payload.offerId, 160)}`;
    const quote = this.quotes.get(key);
    if (!quote || quote.quoteId !== clean(payload.quoteId, 160) || quote.expiresAt < Date.now()) throw new Error('真实报价已过期，请重新搜索');
    if (!quote.optionsLoaded) {
      quote.optionGroups = await this.browser.inspectOptionsFor(quote.browserRef);
      quote.optionsLoaded = true;
    }
    return { offerId: quote.offerId, quoteId: quote.quoteId, optionGroups: quote.optionGroups, optionsLoaded: true };
  }

  async createOrder(payload, context) {
    const requestId = clean(payload.clientRequestId, 160);
    if (!requestId) throw new Error('下单请求缺少幂等标识');
    const requestKey = `${context.target || ''}:${requestId}`;
    if (this.createAttempts.has(requestKey)) return this.createAttempts.get(requestKey);
    const attempt = this.createOrderOnce(payload, context);
    this.createAttempts.set(requestKey, attempt);
    try { return await attempt; } catch (error) { this.createAttempts.delete(requestKey); throw error; }
  }

  async createOrderOnce(payload, context) {
    const key = `${context.target || ''}:${clean(payload.offerId, 160)}`;
    const quote = this.quotes.get(key);
    if (!quote || quote.quoteId !== clean(payload.quoteId, 160) || quote.expiresAt < Date.now()) throw new Error('真实报价已过期，请重新搜索');
    if (!quote.optionsLoaded) {
      quote.optionGroups = await this.browser.inspectOptionsFor(quote.browserRef);
      quote.optionsLoaded = true;
    }
    const selectedOptions = payload.selectedOptions && typeof payload.selectedOptions === 'object' ? payload.selectedOptions : {};
    this.validateOptions(quote.optionGroups, selectedOptions);
    const quantity = Math.max(1, Math.min(20, Number(payload.quantity) || 1));
    const draft = await this.browser.createOrder({ ref: quote.browserRef, selectedOptions, optionGroups: quote.optionGroups, quantity });
    const total = money(draft.total);
    if (!total) throw new Error('平台没有返回有效订单金额');
    if (this.maxOrderAmount > 0 && total > this.maxOrderAmount) throw new Error(`订单金额 ¥${total.toFixed(2)} 超过服务端上限`);
    const orderId = `tbd_${crypto.randomUUID()}`;
    const address = await this.browser.currentAddress();
    const order = {
      orderId, provider: 'taobao_flash', merchantId: quote.merchantId, merchant: quote.merchant,
      items: Array.isArray(draft.items) && draft.items.length ? draft.items : [{ name: quote.name, quantity, price: quote.price, options: this.optionText(quote.optionGroups, selectedOptions) }],
      total, discount: money(draft.discount), couponLabel: clean(draft.couponLabel, 100), status: 'created', paymentMethod: 'alipay', addressLabel: clean(address.label, 80),
      addressFingerprint: opaqueFingerprint(this.secret, address.fingerprintSource), risk: Array.isArray(draft.risk) ? draft.risk : [],
      browserOrderRef: draft.browserOrderRef, createdAt: Date.now(), clientRequestId: clean(payload.clientRequestId, 160),
    };
    this.orders.set(`${context.target || ''}:${orderId}`, order);
    return this.publicOrder(order);
  }

  async payOrder(payload, context) {
    const order = this.orders.get(`${context.target || ''}:${clean(payload.orderId, 160)}`);
    if (!order) throw new Error('真实订单不存在');
    if (payload.automatic === true) return { ...this.publicOrder(order), status: 'pending_payment', reason: '当前淘宝闪购浏览器通道只允许本人在官方收银台付款' };
    const requestId = clean(payload.clientRequestId, 160);
    if (!requestId) throw new Error('付款请求缺少幂等标识');
    const requestKey = `${context.target || ''}:${order.orderId}:${requestId}`;
    if (this.payAttempts.has(requestKey)) return this.payAttempts.get(requestKey);
    const attempt = (async () => {
      if (!order.payUrl && order.status !== 'paid') {
        const submitted = await this.browser.submitOrder(order.browserOrderRef);
        order.payUrl = clean(submitted.payUrl, 1000);
        order.browserOrderRef = submitted.browserOrderRef || order.browserOrderRef;
        order.status = submitted.status === 'paid' ? 'paid' : 'pending_payment';
        if (order.payUrl) order.payQrDataUrl = await QRCode.toDataURL(order.payUrl, { errorCorrectionLevel: 'M', margin: 2, width: 420 });
      }
      return { ...this.publicOrder(order), reason: order.status === 'pending_payment' ? (order.payUrl ? '请本人在支付宝官方收银台确认付款' : '支付宝收银台没有返回可外发链接，请在受保护的浏览器窗口完成付款') : '' };
    })();
    this.payAttempts.set(requestKey, attempt);
    try { return await attempt; } catch (error) { this.payAttempts.delete(requestKey); throw error; }
  }

  async orderStatus(payload, context) {
    const order = this.orders.get(`${context.target || ''}:${clean(payload.orderId, 160)}`);
    if (!order) throw new Error('真实订单不存在');
    const update = await this.browser.orderStatus(order.browserOrderRef);
    if (update?.status) order.status = update.status;
    if (Number(update?.total) > 0) order.total = money(update.total);
    return this.publicOrder(order);
  }

  validateOptions(groups = [], selected = {}) {
    for (const group of groups) {
      const raw = selected[group.id];
      const ids = (group.multiple ? (Array.isArray(raw) ? raw : [raw]) : [Array.isArray(raw) ? raw[0] : raw]).filter(Boolean).map(String);
      const allowed = new Set((group.choices || []).filter(choice => choice.available !== false).map(choice => String(choice.id)));
      if (group.required !== false && !ids.length) throw new Error(`请选择${group.name}`);
      if (ids.some(id => !allowed.has(id))) throw new Error(`${group.name}包含平台不存在的选项`);
    }
  }

  optionText(groups = [], selected = {}) {
    const labels = [];
    for (const group of groups) {
      const ids = Array.isArray(selected[group.id]) ? selected[group.id] : [selected[group.id]];
      for (const id of ids.filter(Boolean)) {
        const choice = (group.choices || []).find(item => String(item.id) === String(id));
        if (choice) labels.push(`${group.name}：${choice.label}`);
      }
    }
    return labels.join('、');
  }

  publicOrder(order) {
    return {
      orderId: order.orderId, provider: order.provider, merchantId: order.merchantId, merchant: order.merchant,
      items: order.items, total: order.total, status: order.status, paymentMethod: order.paymentMethod,
      discount: order.discount || 0, couponLabel: order.couponLabel || '',
      payUrl: order.payUrl || '', payQrDataUrl: order.payQrDataUrl || '', addressLabel: order.addressLabel,
      addressFingerprint: order.addressFingerprint, risk: order.risk || [],
    };
  }
}
