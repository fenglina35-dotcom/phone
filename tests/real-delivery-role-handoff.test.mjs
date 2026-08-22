import assert from 'node:assert/strict';
import fs from 'node:fs';

const delivery=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const browser=fs.readFileSync(new URL('../services/phone-delivery-browser/src/taobao-flash-browser.mjs',import.meta.url),'utf8');

assert.match(delivery,/var roleRequests=\{\}/,'role delivery must keep an in-flight lock');
assert.match(delivery,/if\(roleRequests\[cid\]\)return true/,'a repeated role command must not start a second browser order');
assert.match(delivery,/finally\{delete roleRequests\[cid\];\}/,'the in-flight lock must always be released');
assert.match(delivery,/r\.roleAttempts\[cid\]=attempt/,'a completed or failed role attempt must be remembered');
assert.match(delivery,/Date\.now\(\)-a\.startedAt>180000/,'a stale restored attempt must terminate instead of remaining busy forever');
assert.match(delivery,/lastUserAt<=attempt\.endedAt/,'a terminal result cannot restart until the user sends a new message');
assert.match(delivery,/绝对不要再次说“等一下\/我再找找”/,'the role must not repeat the search prelude while an attempt is running or terminal');
assert.match(delivery,/pushRoleOrderCard\(c,order\);await payOrder\(order\)/,'the real order card must appear before payment-link retrieval');
assert.match(delivery,/必须先按你自己的语气自然问清楚并等待回答/,'vague delivery wishes must be clarified before automation');
assert.match(delivery,/始终保留自己的判断和意愿/,'the role may accept or refuse the delivery request according to its persona');
assert.match(delivery,/必须先发一句符合你本人语气的简短可见消息/,'the role must acknowledge before starting automation');
assert.match(delivery,/function rolePreludeAllowed/,'only a safe pre-order acknowledgement may be shown beside a command');
assert.match(app,/_realDeliveryCommandSeen=false/,'the parser must track the command boundary');
assert.match(app,/_realDeliveryPreludeShown=false/,'automation must require a visible acknowledgement first');
assert.match(app,/if\(!_realDeliveryPreludeShown\)\{got=false;continue;\}/,'a bare order tag must never start the browser silently');
assert.match(app,/deliveryRolePreludeAllowed\(line\)/,'the parser must retain the safe pre-order acknowledgement');
assert.match(browser,/这个真实套餐要求选择\$\{count\}份\$\{label\}/,'multi-item bundles must stop safely instead of hanging at an option panel');

console.log('real delivery role handoff tests passed');
