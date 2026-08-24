import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { opaqueFingerprint } from './security.mjs';
import { knownRouteKey, requestedFruitExclusions } from './taobao-flash-browser.mjs';

const money = value => Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const cleanImage = value => {
  const raw = clean(value, 440_000);
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  return /^https:\/\//i.test(raw) ? raw.slice(0, 800) : '';
};
const TERMINAL_TASKS = new Set(['completed', 'canceled', 'expired', 'failed']);

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
    this.roleTasks = new Map();
    this.roleSearchAttempts = new Map();
    this.roleCreateAttempts = new Map();
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
    if (action === 'confirm_risk_cleared') return this.confirmRiskCleared(payload);
    if (action === 'saved_routes') return this.savedRoutes();
    if (action === 'search') return this.search(payload, context);
    if (action === 'offer_options') return this.offerOptions(payload, context);
    if (action === 'create_order') return this.createOrder(payload, context);
    if (action === 'pay_order') return this.payOrder(payload, context);
    if (action === 'order_status') return this.orderStatus(payload, context);
    throw new Error('不支持的真实外卖操作');
  }

  async capabilities() {
    if (this.capabilitiesCache && Date.now() - this.capabilitiesCache.cachedAt < 10 * 60_000) return { ...this.capabilitiesCache.value };
    // This endpoint is called when the phone page is refreshed and when the
    // settings panel is opened. It must remain passive: probing the live
    // marketplace here used to launch/navigate the automated browser even
    // though the user had not started an order, which needlessly increased
    // marketplace risk challenges. Login and address are verified only by the
    // explicit confirm/search/order actions that actually need the browser.
    const value = {
      providers: ['taobao_flash'],
      payments: ['alipay'],
      automaticPayments: false,
      addressConfirmation: true,
      realtimeWebhooks: false,
      addressLabel: '',
      loginRequired: null,
      loginUrl: '',
      passive: true,
    };
    this.capabilitiesCache = { cachedAt: Date.now(), value };
    return { ...value };
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

  async confirmRiskCleared(payload) {
    if (payload.confirmedByUser !== true) throw new Error('必须由本人确认已经完成平台安全验证');
    return this.browser.confirmRiskClearedByUser();
  }

  authorizeRoleTask(payload, context) {
    const source = payload?.task && typeof payload.task === 'object' ? payload.task : {};
    const task = {
      taskId: clean(source.taskId, 160), authorizationSource: clean(source.authorizationSource, 40),
      roleId: clean(source.roleId, 120), accountId: clean(source.accountId, 120),
      sessionId: clean(source.sessionId, 160), turnId: clean(source.turnId, 160),
      messageId: clean(source.messageId, 160), createdAt: Number(source.createdAt) || 0,
      intentSummary: clean(source.intentSummary, 200), status: clean(source.status, 40),
      revision: Math.max(1, Math.floor(Number(source.revision) || 1)),
      autonomous: source.autonomous === true,
      authorizationConstraints: clean(source.authorizationConstraints || source.userConstraints, 800),
      userConstraints: clean(source.userConstraints, 800),
    };
    if (!task.taskId || !task.roleId || !task.accountId || !task.sessionId || !task.turnId || !task.createdAt || !task.intentSummary) throw new Error('角色点单缺少完整的结构化授权任务');
    if (!['user_explicit', 'role_current_turn'].includes(task.authorizationSource)) throw new Error('角色点单授权来源无效');
    if (TERMINAL_TASKS.has(task.status)) throw new Error('已完成、过期、取消或失败的授权任务不能恢复');
    if (Date.now() - task.createdAt > 30 * 60_000 || task.createdAt > Date.now() + 60_000) throw new Error('角色点单授权任务已过期');
    const key = `${context.target || ''}:${task.taskId}`;
    const known = this.roleTasks.get(key);
    if (known) {
      for (const field of ['authorizationSource', 'roleId', 'accountId', 'sessionId', 'turnId', 'createdAt', 'intentSummary', 'autonomous', 'authorizationConstraints']) {
        if (known[field] !== task[field]) throw new Error('角色点单授权任务与原始回合不一致');
      }
      if (TERMINAL_TASKS.has(known.status)) throw new Error('已结束的角色点单授权任务不能恢复');
      if (task.revision < known.revision || task.revision > known.revision + 1) throw new Error('角色点单澄清修订不连续');
      if (task.revision === known.revision && known.userConstraints !== task.userConstraints) throw new Error('同一角色点单修订不能改变用户约束');
      if (task.revision === known.revision + 1) {
        known.revision = task.revision;
        known.userConstraints = task.userConstraints;
      }
      return { key, task: known };
    }
    this.roleTasks.set(key, { ...task, status: 'authorized' });
    return { key, task: this.roleTasks.get(key) };
  }

  async search(payload, context) {
    const query = clean(payload.query, 120);
    if (!query) throw new Error('请输入要搜索的餐品或店铺');
    const routeOnly = Boolean(clean(payload.roleId, 120));
    const authorization = routeOnly ? this.authorizeRoleTask(payload, context) : null;
    const intent = payload.orderIntent && typeof payload.orderIntent === 'object' ? payload.orderIntent : {};
    const merchant = clean(intent.merchant, 100);
    const items = [...new Set((Array.isArray(intent.items) ? intent.items : []).map(item => clean(item, 100)).filter(Boolean))].slice(0, 12);
    if (routeOnly && (authorization.task.roleId !== clean(payload.roleId, 120) || !merchant || !items.length)) throw new Error('角色点单必须分别提供一个门店和逐项商品清单');
    const attemptKey = authorization ? `${authorization.key}:${authorization.task.revision}` : '';
    if (attemptKey && this.roleSearchAttempts.has(attemptKey)) return this.roleSearchAttempts.get(attemptKey);
    const attempt = (async () => {
      const suppliedFingerprint = clean(payload.addressFingerprint, 180);
      if (routeOnly && !suppliedFingerprint) throw new Error('角色点单前需要由本人先确认一次平台默认收货地址');
      const address = routeOnly ? { label: clean(payload.addressLabel, 80) || '平台默认地址' } : await this.browser.currentAddress();
      const allowGlobalSearch = !routeOnly || payload.allowGlobalSearch === true;
      const browserQuery = routeOnly ? [merchant, items[0], ...items.slice(1).map(item => `加${item}`)].join(' ') : query;
      const userAllowsMenuChoice = /(?:随便(?:点|选)?|任意(?:一|单)?(?:杯|份|个)?|什么都(?:可以|行)|都(?:可以|行)|你(?:来)?(?:决定|点|选)|你看着(?:点|选)?)/u.test(query);
      const intentText = [query, authorization?.task.userConstraints].filter(Boolean).join('\n');
      const found = await this.browser.search(browserQuery, Math.min(this.maxOffers, Number(payload.limit) || this.maxOffers), {
        allowGlobalSearch, storeQuery: routeOnly ? merchant : '', intentText,
        menuSelectionAllowed: authorization?.task.autonomous === true,
        // A broad explicit request (for example “古茗随便点一杯”) may scan the
        // current store-search results, but remains user_explicit and must not
        // silently widen to an arbitrary homepage category.
        searchResultSelectionAllowed: userAllowsMenuChoice,
        forceMerchantEntry: payload.forceMerchantEntry === true,
      });
      const addressFingerprint = routeOnly ? suppliedFingerprint : opaqueFingerprint(this.secret, address.fingerprintSource);
      const excludedFruits = requestedFruitExclusions(intentText);
      const permitted = found.filter(item => !excludedFruits.some(fruit => {
        const name = knownRouteKey(item?.name);
        if (fruit === '橙子') return /橙子|脐橙|鲜橙/.test(name);
        return name.includes(knownRouteKey(fruit));
      }));
      if (found.length && !permitted.length && excludedFruits.length) throw new Error(`真实候选全部命中了明确禁止的水果：${excludedFruits.join('、')}`);
      const offers = permitted.slice(0, this.maxOffers).map(item => {
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
          couponLabel: clean(item.couponLabel, 100), imageUrl: cleanImage(item.imageUrl),
          optionGroups: Array.isArray(item.optionGroups) ? item.optionGroups : [], optionsLoaded: item.optionsLoaded === true,
          requiresConfirmation: item.requiresConfirmation === true, confirmationReason: clean(item.confirmationReason, 240),
          addressLabel: clean(address.label, 80), addressFingerprint, quoteExpiresAt: Date.now() + (routeOnly ? 30 : 8) * 60_000,
          rawVersion: clean(item.rawVersion || 'taobao-flash-browser-v1', 80),
        };
        this.quotes.set(`${context.target || ''}:${offerId}`, { ...offer, browserRef: item.browserRef, expiresAt: offer.quoteExpiresAt, taskId: authorization?.task.taskId || '', taskRevision: authorization?.task.revision || 0 });
        return offer;
      });
      if (authorization) authorization.task.status = 'quoted';
      return { offers, addressLabel: clean(address.label, 80) };
    })();
    if (attemptKey) this.roleSearchAttempts.set(attemptKey, attempt);
    try { return await attempt; } catch (error) {
      // A browser search miss can become a same-task product-name or option
      // clarification in the phone client.  Keep the server-side grant alive;
      // only a terminal task received from the client may be terminal here.
      if (authorization) authorization.task.status = 'authorized';
      throw error;
    }
  }

  async savedRoutes() {
    const routes = await this.browser.listKnownRoutes();
    return { routes: routes.map(route => ({
      query: clean(route.query, 160), merchant: clean(route.merchant, 100), itemName: clean(route.itemName, 140),
      savedAt: Number(route.savedAt || 0), closedUntil: Number(route.closedUntil || 0), closedReason: clean(route.closedReason, 80),
    })) };
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
    const roleId = clean(payload.roleId, 120);
    const authorization = roleId ? this.authorizeRoleTask(payload, context) : null;
    const roleAttemptKey = authorization ? `${authorization.key}:${authorization.task.revision}` : '';
    if (roleAttemptKey && this.roleCreateAttempts.has(roleAttemptKey)) return this.roleCreateAttempts.get(roleAttemptKey);
    const requestId = clean(payload.clientRequestId, 160);
    if (!requestId) throw new Error('下单请求缺少幂等标识');
    const requestKey = `${context.target || ''}:${requestId}`;
    if (this.createAttempts.has(requestKey)) return this.createAttempts.get(requestKey);
    const attempt = this.createOrderOnce(payload, context);
    this.createAttempts.set(requestKey, attempt);
    if (roleAttemptKey) this.roleCreateAttempts.set(roleAttemptKey, attempt);
    try { const result = await attempt; if (authorization) authorization.task.status = 'ordered'; return result; } catch (error) { this.createAttempts.delete(requestKey); if (roleAttemptKey) this.roleCreateAttempts.delete(roleAttemptKey); throw error; }
  }

  async createOrderOnce(payload, context) {
    const key = `${context.target || ''}:${clean(payload.offerId, 160)}`;
    const quote = this.quotes.get(key);
    if (!quote || quote.quoteId !== clean(payload.quoteId, 160) || quote.expiresAt < Date.now()) throw new Error('真实报价已过期，请重新搜索');
    const taskId = clean(payload.task?.taskId, 160);
    if ((taskId || quote.taskId) && quote.taskId !== taskId) throw new Error('真实报价不属于当前授权任务');
    if (quote.requiresConfirmation && payload.confirmedHistoricalSuperset !== true) {
      throw new Error(quote.confirmationReason || '这笔历史订单包含本次没有明确要求的额外商品，必须先由本人确认');
    }
    if (!quote.optionsLoaded) {
      quote.optionGroups = await this.browser.inspectOptionsFor(quote.browserRef);
      quote.optionsLoaded = true;
    }
    const selectedOptions = payload.selectedOptions && typeof payload.selectedOptions === 'object' ? payload.selectedOptions : {};
    this.validateOptions(quote.optionGroups, selectedOptions);
    const quantity = Math.max(1, Math.min(20, Number(payload.quantity) || 1));
    const draft = await this.browser.createOrder({
      ref: quote.browserRef, selectedOptions, optionGroups: quote.optionGroups, quantity,
      replaceMismatchedCart: Boolean(taskId),
    });
    const total = money(draft.total);
    if (!total) throw new Error('平台没有返回有效订单金额');
    if (this.maxOrderAmount > 0 && total > this.maxOrderAmount) throw new Error(`订单金额 ¥${total.toFixed(2)} 超过服务端上限`);
    const orderId = `tbd_${crypto.randomUUID()}`;
    const order = {
      orderId, provider: 'taobao_flash', merchantId: quote.merchantId, merchant: clean(draft.merchant || quote.merchant, 100),
      items: Array.isArray(draft.items) && draft.items.length ? draft.items : [{ name: quote.name, quantity, price: quote.price, options: this.optionText(quote.optionGroups, selectedOptions) }],
      total, discount: money(draft.discount), couponLabel: clean(draft.couponLabel, 100), status: 'created', paymentMethod: 'alipay', addressLabel: clean(quote.addressLabel, 80),
      couponCheckStatus: 'pending', couponCheckAmount: 0, couponCheckEvidence: '',
      imageUrl: cleanImage(draft.imageUrl || draft.items?.find(item => item?.imageUrl)?.imageUrl || quote.imageUrl), etaMinutes: Number.isFinite(Number(quote.etaMinutes)) ? Math.max(0, Math.floor(Number(quote.etaMinutes))) : null,
      etaText: clean(draft.etaText, 80),
      // The address was already confirmed and fingerprinted when this quote
      // was created.  Reading it again here navigates away from the live
      // checkout page and makes the one-time confirmation URL stale.
      addressFingerprint: clean(quote.addressFingerprint, 180), risk: Array.isArray(draft.risk) ? draft.risk : [],
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
        if (submitted.etaText) order.etaText = clean(submitted.etaText, 80);
        if (submitted.imageUrl) order.imageUrl = cleanImage(submitted.imageUrl);
        if (Number(submitted.total) > 0) order.total = money(submitted.total);
        if (submitted.discount != null) order.discount = money(submitted.discount);
        if (submitted.couponLabel) order.couponLabel = clean(submitted.couponLabel, 100);
        order.couponCheckStatus = clean(submitted.couponCheck?.status, 40);
        order.couponCheckAmount = money(submitted.couponCheck?.amount);
        order.couponCheckEvidence = clean(submitted.couponCheck?.evidence, 100);
        if (!['applied', 'none'].includes(order.couponCheckStatus)) {
          throw new Error('订单没有可核验的优惠券检查结果，不能进入待支付状态');
        }
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
    if (update?.etaText) order.etaText = clean(update.etaText, 80);
    if (update?.imageUrl) order.imageUrl = cleanImage(update.imageUrl);
    if (update?.discount != null) order.discount = money(update.discount);
    if (update?.couponLabel) order.couponLabel = clean(update.couponLabel, 100);
    return this.publicOrder(order);
  }

  validateOptions(groups = [], selected = {}) {
    for (const group of groups) {
      const raw = selected[group.id];
      const ids = (group.multiple ? (Array.isArray(raw) ? raw : [raw]) : [Array.isArray(raw) ? raw[0] : raw]).filter(Boolean).map(String);
      const allowed = new Set((group.choices || []).filter(choice => choice.available !== false).map(choice => String(choice.id)));
      if (group.required !== false && !ids.length) throw new Error(`请选择${group.name}`);
      const selectionCount = Number(String(group.name || '').match(/(?:请选|请选择|任选)\s*(\d+)\s*份/)?.[1] || 0);
      if (selectionCount > 1 && ids.length !== selectionCount) throw new Error(`${group.name}需要准确选择${selectionCount}份`);
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
      couponCheckStatus: order.couponCheckStatus || 'pending', couponCheckAmount: order.couponCheckAmount || 0,
      couponCheckEvidence: order.couponCheckEvidence || '',
      payUrl: order.payUrl || '', payQrDataUrl: order.payQrDataUrl || '', addressLabel: order.addressLabel,
      imageUrl: order.imageUrl || '', etaMinutes: order.etaMinutes, etaText: order.etaText || '',
      addressFingerprint: order.addressFingerprint, risk: order.risk || [],
    };
  }
}
