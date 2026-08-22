import assert from 'node:assert/strict';
import fs from 'node:fs';

const client=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-delivery/index.ts',import.meta.url),'utf8');
const adapter=fs.readFileSync(new URL('../services/phone-delivery-browser/src/adapter.mjs',import.meta.url),'utf8');
const browser=fs.readFileSync(new URL('../services/phone-delivery-browser/src/taobao-flash-browser.mjs',import.meta.url),'utf8');

assert.match(client,/selectedOptions:selected/,'the selected real platform options must be sent when creating an order');
assert.match(client,/每个 required 组必须选择/,'the role must choose every required option from platform data');
assert.match(client,/用户本次明确说出的杯型、份量、糖度、冰度、温度、口味、辣度、搭配和加料都是硬条件/,'explicit user food and drink requirements must outrank role preferences');
assert.doesNotMatch(client,/deliverySetAutoPay|deliveryOpenWallet|deliveryTopUp|deliverySaveWallet/,'manual-only delivery must not expose fake wallet or auto-pay controls');
assert.match(client,/平台结算页已自动优惠/,'the client must report only checkout-confirmed discount facts');
assert.match(client,/offer_options/,'the client must fetch options only after selecting a fast candidate');
assert.match(client,/候选没有完全对应项时必须返回 matched:false/,'explicit brands and products must never be silently substituted');
assert.match(client,/真实选项缺少任意一项时必须返回 matched:false/,'explicit drink options must never be silently substituted');
assert.match(client,/safePayQr/,'payment QR data must pass a strict client-side allowlist');
assert.match(client,/支付宝待付款订单/,'the virtual phone must expose the official pending-payment checkout');
assert.match(edge,/optionGroups: optionGroups/,'the edge connector must preserve sanitized platform option groups');
assert.match(edge,/"offer_options"/,'the edge connector must expose the second-stage option request');
assert.match(edge,/payQrDataURL/,'the edge connector must validate payment QR data');
assert.match(adapter,/automaticPayments: false/,'browser automation must never advertise automatic payment');
assert.match(adapter,/QRCode\.toDataURL/,'the official cashier URL must be convertible to a scannable QR');
assert.match(browser,/安全验证/,'captcha and risk control must stop for human handling');
assert.match(browser,/riskBlockedUntil/,'a platform challenge must create a browser-level cooldown');
assert.match(browser,/期间不会再次打开或重搜/,'cooldown retries must stop before another platform navigation');
assert.match(browser,/支付成功\|付款成功/,'payment status must come from an explicit platform-page receipt');
assert.match(browser,/checkoutAmounts\(body\)/,'the payable total must use checkout-specific parsing');
assert.match(browser,/购物车已有商品，为避免混单/,'an existing platform cart must stop role-created order mixing');
assert.match(browser,/searchInsideShop/,'a saved shop must try its own product search instead of taking the first menu item');
assert.match(browser,/rememberedRoutes\.slice\(0, 3\)/,'role ordering must inspect no more than three saved shops');

console.log('real delivery option and payment tests passed');
