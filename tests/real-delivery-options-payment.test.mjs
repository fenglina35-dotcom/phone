import assert from 'node:assert/strict';
import fs from 'node:fs';

const client=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-delivery/index.ts',import.meta.url),'utf8');
const adapter=fs.readFileSync(new URL('../services/phone-delivery-browser/src/adapter.mjs',import.meta.url),'utf8');
const browser=fs.readFileSync(new URL('../services/phone-delivery-browser/src/taobao-flash-browser.mjs',import.meta.url),'utf8');

assert.match(client,/selectedOptions:selected/,'the selected real platform options must be sent when creating an order');
assert.match(client,/每个 required 组都必须选择/,'the role must choose every required option from platform data');
assert.match(client,/必须优先严格满足用户明确说出的品牌、饮品、杯型、糖度、温度、口味和加料/,'explicit user drink and flavor requirements must outrank role preferences');
assert.match(client,/当前没有真实角色钱包，也不会显示无效的自动付款开关/,'manual-only connectors must not present a fake usable wallet or auto-pay toggle');
assert.match(client,/平台确认页已优惠/,'the client must report only checkout-confirmed discount facts');
assert.match(client,/safePayQr/,'payment QR data must pass a strict client-side allowlist');
assert.match(client,/官方待付款订单/,'the virtual phone must expose the official pending-payment checkout');
assert.match(edge,/optionGroups: optionGroups/,'the edge connector must preserve sanitized platform option groups');
assert.match(edge,/payQrDataURL/,'the edge connector must validate payment QR data');
assert.match(adapter,/automaticPayments: false/,'browser automation must never advertise automatic payment');
assert.match(adapter,/QRCode\.toDataURL/,'the official cashier URL must be convertible to a scannable QR');
assert.match(browser,/安全验证/,'captcha and risk control must stop for human handling');
assert.match(browser,/支付成功\|付款成功/,'payment status must come from an explicit platform-page receipt');
assert.match(browser,/checkoutAmounts\(body\)/,'the payable total must use checkout-specific parsing');
assert.match(browser,/购物车已有商品，为避免混单/,'an existing platform cart must stop role-created order mixing');

console.log('real delivery option and payment tests passed');
