import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const gate = fs.readFileSync(new URL('../license-gate.js', import.meta.url), 'utf8');
const bundledApp = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');
const bundledGate = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/license-gate.js', import.meta.url), 'utf8');

for (const source of [app, bundledApp]) {
  assert.match(source, /bound&&bound\.alreadyBound\?'手机验证已经绑定，无需重复绑定'/);
  assert.match(source, /检查 \/ 补绑手机验证/);
  assert.doesNotMatch(source, /重新绑定手机验证/);
}
for (const source of [gate, bundledGate]) {
  assert.match(source, /error\.name === 'InvalidStateError'/);
  assert.match(source, /alreadyBound: true/);
  assert.match(source, /error\.name === 'SecurityError'/);
}

console.log('license passkey rebind guard tests passed');
