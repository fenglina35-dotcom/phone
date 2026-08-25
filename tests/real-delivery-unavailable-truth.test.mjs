import assert from 'node:assert/strict';
import fs from 'node:fs';

const web = fs.readFileSync(new URL('../delivery.js', import.meta.url), 'utf8');
const privateBundle = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/delivery.js', import.meta.url), 'utf8');

for (const [name, source] of [['web', web], ['private', privateBundle]]) {
  assert.match(source, /function requestRoleSelectionFailure/,
    `${name} must classify platform selection failures separately`);
  assert.match(source, /这不是售罄证据，绝不能说商品卖完、下架或要求换口味/,
    `${name} must not turn a click-adapter failure into fake stock information`);
  assert.match(source, /售罄\|已售完\|卖完\|库存不足\|已下架\|商品已失效/,
    `${name} may report unavailable only from explicit stock evidence`);
}

console.log('real delivery unavailable truth tests passed');
