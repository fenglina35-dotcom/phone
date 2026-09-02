import assert from 'node:assert/strict';
import fs from 'node:fs';

const delivery=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const commerce=fs.readFileSync(new URL('../commerce-ui.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../native/private-small-phone/Resources/private-phone-web.manifest.json',import.meta.url),'utf8'));

assert.match(delivery,/if\(typeof r\.enabled!=='boolean'\)r\.enabled=false/,'real delivery must default off');
assert.match(delivery,/r\.autoPay=false/,'legacy auto-pay state must be permanently disabled');
assert.doesNotMatch(delivery,/单笔自动付款上限|每日自动付款总上限|角色自动付款授权/,'unavailable wallet controls must be absent');
assert.match(delivery,/paymentPreference:\['alipay'\]/,'the implemented payment route must be Alipay only');
assert.match(delivery,/providers:\['taobao_flash'\]/,'the implemented provider route must be Taobao Flash only');
assert.match(delivery,/functions\/v1\/phone-delivery/,'the official companion cloud must be the built-in connector');
assert.match(delivery,/identityScope=cfg\.explicit&&cfg\.valid\?cfg\.deploymentId:\(!privateApp&&official\?'public_web':''\)/,'public web and explicit friend deployments must use delivery-only identity scopes');
assert.match(delivery,/identityScope\?.*ownerSecret:deliveryConnectorSecret\(identityScope\).*ownerSecret:official&&typeof companionOwnerSecret/s,'only a private legacy client may retain the companion owner proof');
assert.match(delivery,/deliveryConnectorSecret\(\)/,'custom connectors must receive a separate scoped secret');
assert.match(delivery,/headers\.apikey=COMPANION_KEY/,'built-in connector calls must use the companion project key');
assert.match(delivery,/朋友专用外卖配置无效或项目不一致，已禁止回退到伴生云/,'invalid explicit delivery config must fail closed instead of falling back to companion sync');
assert.match(delivery,/S\.food\.results=\[\];foodState\(\)\.lastError/,'real search failure must leave no generated results');
assert.match(delivery,/clientRequestId:requestId/,'real order creation must carry an idempotency key');
assert.match(delivery,/pendingCreates=Array\.isArray/,'unfinished order creation must retain its idempotency key for retry');
assert.match(delivery,/automatic:false/,'the role-created order must stop for user payment');
assert.match(delivery,/safePayUrl\(data\.payUrl\)/,'payment links must be scheme allowlisted');
assert.match(delivery,/deliveryConfirmAddress/,'the user must have an explicit address-confirmation action');
assert.doesNotMatch(delivery,/deliverySaveConnector/,'ordinary users must not be asked to configure a connector URL');
assert.match(delivery,/奶茶偏好/);
assert.match(delivery,/主食偏好/);
assert.match(delivery,/咖啡偏好/);
assert.match(delivery,/KFC 偏好/);
assert.match(delivery,/deliveryOpenSavedRoutes/,'users must be able to inspect the routes available to role ordering');
assert.match(delivery,/没有路线时自动进行一次受限搜索/,'role ordering must prefer verified routes and retain one bounded automatic-search fallback');
assert.match(delivery,/最多检查三家匹配门店/,'role ordering must bound automatic shop switching');
assert.match(delivery,/本次口头要求永远优先/);
assert.doesNotMatch(delivery,/Math\.random\(\).*rating|生成6个相关餐品|骑手已接单🛵/,'real layer must not fabricate commerce facts');

assert.match(app,/\[真实外卖\\\|\(\[\^\\\]\]\*\)\\\]\$\/\)/,'chat parser must consume the real-delivery tag');
assert.match(app,/deliveryRealEnabled\(\)\)\{if\(typeof deliveryHandleRoleRequest/,'legacy delivery tag must route to real handling while real mode is on');
assert.match(app,/if\(_realDeliveryCommandTurn&&!_realDeliveryTag\)/,'a command turn must filter unsafe premature result text');
assert.match(app,/_safeDeliveryPrelude=!_realDeliveryCommandSeen&&!_realDeliveryPreludeShown/,'a command turn may show exactly one current-model role prelude before the action');
assert.doesNotMatch(app,/if\(!_realDeliveryPreludeShown\)[^\n]*deliveryRequestPreludeRetry/,'a bare structured action must start directly instead of asking the model to repeat it');
assert.match(app,/if\(_callRealDeliveryCommandTurn\)content=_callDeliveryPrelude/,'call ordering must retain only the current-model role prelude');
assert.match(delivery,/必须先用你此刻真实的人设、关系和语气说一句简短自然的可见开场白/,'the same real model response must include a persona-grounded opening line');
assert.match(delivery,/过程中保持安静/,'automation must stay quiet after the opening line until a real result or block');
assert.match(app,/if\(_main&&typeof deliveryRolePrompt==='function'\)s\+=deliveryRolePrompt\(c\)/,'main role prompt must receive delivery capability facts');
assert.match(commerce,/var real=typeof deliveryRealEnabled/);
assert.match(commerce,/仅展示平台实际返回/);
assert.match(commerce,/p\.rating!=null/,'real rating may render only when supplied');
assert.match(commerce,/p\.couponLabel\?/,'real coupon may render only when supplied');

assert.match(html,/delivery\.js\?v=/);
assert.match(sw,/delivery\.js\?v=/);
assert.ok(manifest.files.includes('delivery.js'),'private iOS bundle must include delivery.js');

console.log('real delivery mode tests passed');
