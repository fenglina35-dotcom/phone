import assert from 'node:assert/strict';
import fs from 'node:fs';

const delivery=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const commerce=fs.readFileSync(new URL('../commerce-ui.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../native/private-small-phone/Resources/private-phone-web.manifest.json',import.meta.url),'utf8'));

assert.match(delivery,/if\(typeof r\.enabled!=='boolean'\)r\.enabled=false/,'real delivery must default off');
assert.match(delivery,/if\(!r\.enabled\)r\.autoPay=false/,'auto-pay must turn off with real delivery');
assert.match(delivery,/w\.singleLimit==null\?100/,'single-payment default must be 100');
assert.match(delivery,/w\.dailyLimit==null\?200/,'daily-payment default must be 200');
assert.match(delivery,/paymentPreference:\['wechat','alipay'\]/,'payment priority must be WeChat then Alipay');
assert.match(delivery,/providers:\['taobao_flash','meituan'\]/,'provider priority must be Taobao Flash then Meituan');
assert.match(delivery,/S\.food\.results=\[\];foodState\(\)\.lastError/,'real search failure must leave no generated results');
assert.match(delivery,/if\(order\.status==='paid'&&automatic&&c&&!order\.walletDebited\)/,'wallet debit must require a paid receipt');
assert.match(delivery,/新地址需要本人确认/);
assert.match(delivery,/下单价格与报价不一致/);
assert.match(delivery,/短时间内存在重复订单/);
assert.match(delivery,/你无权充值角色外卖钱包、改额度或开关自动付款/);
assert.doesNotMatch(delivery,/Math\.random\(\).*rating|生成6个相关餐品|骑手已接单🛵/,'real layer must not fabricate commerce facts');

assert.match(app,/\[真实外卖\\\|\(\[\^\\\]\]\*\)\\\]\$\/\)/,'chat parser must consume the real-delivery tag');
assert.match(app,/deliveryRealEnabled\(\)\)\{if\(typeof deliveryHandleRoleRequest/,'legacy delivery tag must route to real handling while real mode is on');
assert.match(app,/_realDeliveryCommandTurn&&!\/\^\[\\\[【\]/,'visible text from the command turn must wait for the real result reply');
assert.match(app,/if\(_main&&typeof deliveryRolePrompt==='function'\)s\+=deliveryRolePrompt\(c\)/,'main role prompt must receive delivery capability facts');
assert.match(commerce,/var real=typeof deliveryRealEnabled/);
assert.match(commerce,/仅展示平台实际返回/);
assert.match(commerce,/p\.rating!=null/,'real rating may render only when supplied');
assert.match(commerce,/p\.couponLabel\?/,'real coupon may render only when supplied');

assert.match(html,/delivery\.js\?v=/);
assert.match(sw,/delivery\.js\?v=/);
assert.ok(manifest.files.includes('delivery.js'),'private iOS bundle must include delivery.js');

console.log('real delivery mode tests passed');
