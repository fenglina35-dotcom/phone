import assert from 'node:assert/strict';
import fs from 'node:fs';

const client=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-delivery/index.ts',import.meta.url),'utf8');
const adapter=fs.readFileSync(new URL('../services/phone-delivery-browser/src/adapter.mjs',import.meta.url),'utf8');
const browser=fs.readFileSync(new URL('../services/phone-delivery-browser/src/taobao-flash-browser.mjs',import.meta.url),'utf8');

assert.match(client,/selectedOptions:selected/,'the selected real platform options must be sent when creating an order');
assert.match(client,/group\.required&&!matched\.length/,'automation must choose every required option from platform data');
assert.match(client,/function deliverySemanticChoice/,'explicit user food and drink requirements must be handled deterministically');
assert.doesNotMatch(client,/deliverySetAutoPay|deliveryOpenWallet|deliveryTopUp|deliverySaveWallet/,'manual-only delivery must not expose fake wallet or auto-pay controls');
assert.match(client,/平台结算页已自动优惠/,'the client must report only checkout-confirmed discount facts');
assert.match(client,/offer_options/,'the client must fetch options only after selecting a fast candidate');
assert.match(client,/淘宝闪购候选没有匹配本次门店和商品/,'explicit brands and products must never be silently substituted');
for(const alias of ['无糖','零糖','0糖','不加冰','去冰'])assert.ok(client.includes(alias),'option aliases must include '+alias);
assert.match(client,/matched=choices\.filter\(function\(choice\)\{return choice\.selected/,'unspecified options must preserve platform defaults');
assert.match(client,/平台“'\+name\+'”没有本次明确要求；现有选项/,'option mismatch diagnostics must name the exact missing requirement and available options');
for(const fn of ['chooseOffer','chooseOptions']){const start=client.indexOf('function '+fn),end=client.indexOf('\n  function ',start+12);assert.ok(start>=0);assert.doesNotMatch(client.slice(start,end),/chatAPI\(/,fn+' must not make an intermediate model call');}
assert.match(client,/safePayQr/,'payment QR data must pass a strict client-side allowlist');
assert.match(client,/支付宝待付款订单/,'the virtual phone must expose the official pending-payment checkout');
assert.match(edge,/optionGroups: optionGroups/,'the edge connector must preserve sanitized platform option groups');
assert.match(edge,/selected: item\.selected === true/,'the edge connector must preserve real platform-selected defaults');
assert.match(edge,/selectionCount:/,'the edge connector must preserve required multi-choice counts');
assert.match(edge,/"offer_options"/,'the edge connector must expose the second-stage option request');
assert.match(edge,/payQrDataURL/,'the edge connector must validate payment QR data');
assert.match(adapter,/automaticPayments: false/,'browser automation must never advertise automatic payment');
assert.match(adapter,/QRCode\.toDataURL/,'the official cashier URL must be convertible to a scannable QR');
assert.match(browser,/安全验证/,'captcha and risk control must stop for human handling');
assert.match(browser,/riskBlocked/,'a platform challenge must persist a browser-level verification marker');
assert.match(browser,/验证状态仍存在时不会自动重搜/,'an active verification state must stop before another platform navigation');
assert.doesNotMatch(browser,/冷却30分钟|已冷却\$\{minutes\}/,'risk handling must not impose a fixed waiting period');
assert.match(browser,/支付成功\|付款成功/,'payment status must come from an explicit platform-page receipt');
assert.match(browser,/checkoutAmounts\((?:body|raw)\)/,'the payable total must use checkout-specific parsing');
assert.match(browser,/useExistingCartIfMatching/,'an existing platform cart must be verified before reuse');
assert.match(browser,/购物车已有商品但尚未达到起送金额/,'an under-minimum existing cart must pause instead of appending duplicate items');
assert.match(browser,/searchInsideShop/,'a saved shop must try its own product search instead of taking the first menu item');
assert.match(browser,/rememberedRoutes\.slice\(0, 3\)/,'role ordering must inspect no more than three saved shops');

console.log('real delivery option and payment tests passed');
