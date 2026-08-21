import assert from 'node:assert/strict';
import fs from 'node:fs';

const delivery=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const theme=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

assert.match(delivery,/type:'deliveryorder'/,'a successful role order must create a dedicated chat card');
assert.match(delivery,/pushRoleOrderCard\(c,order\)/,'the card must be inserted before the role result reply');
assert.match(delivery,/imageUrl:safeUrl\(data\.imageUrl\|\|offer\.imageUrl/,'the real platform product image must follow the selected offer');
assert.match(delivery,/etaMinutes:Number\.isFinite\(\+data\.etaMinutes\)/,'the platform ETA must follow the selected offer without fabrication');
assert.match(delivery,/平台暂未给出预计送达时间/,'missing ETA must be disclosed instead of invented');
assert.match(delivery,/可以截图后，在支付宝“扫一扫”中从相册选择/,'the official payment QR must explain the screenshot workflow');
assert.match(delivery,/不要固定使用“宝宝”或任何模板称呼/,'the short companion reply must remain persona-driven');
assert.match(app,/m\.type==='deliveryorder'.*deliveryRealChatCardHTML/s,'chat rendering must use the real delivery card component');
assert.match(theme,/\.wx-real-delivery-card/,'the card must have dedicated dark-theme styling');
assert.match(theme,/\.wxlight \.wx-real-delivery-card/,'the card must have dedicated light-theme styling');

console.log('real delivery chat-card tests passed');
