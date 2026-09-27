import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const helperStart = source.indexOf('async function licensePostActivationSetup()');
const helperEnd = source.indexOf('\nfunction showGate()', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'post-activation helper must exist');

const gateStart = source.indexOf('function showGate()');
const gateEnd = source.indexOf('\nlet _licenseCheckBusy=', gateStart);
const gateSource = source.slice(gateStart, gateEnd);
assert.match(
  gateSource,
  /await NorthLicense\.activate\(v\);licenseMarkUnlocked\(\);licenseFinishGate\(\);licensePostActivationSetup\(\);/,
  'a successful activation must close the gate before optional setup starts',
);
assert.doesNotMatch(
  gateSource,
  /await NorthLicense\.activate\(v\);[^\n]*await licenseSyncAiIdentity/,
  'AI identity sync must not block entry after an invite was accepted',
);

const calls = [];
const notices = [];
const context = {
  appleHomeCompatNative: () => true,
  pfEnsure: async () => { calls.push('friend-register'); },
  licenseSyncAiIdentity: async () => { calls.push('ai'); throw new Error('sync unavailable'); },
  licenseSyncPhoneFriendIdentity: async () => { calls.push('friend'); },
  NorthLicense: { bindPasskey: async () => { calls.push('passkey'); } },
  toast: (message) => notices.push(message),
};
vm.createContext(context);
vm.runInContext(source.slice(helperStart, helperEnd), context);
await context.licensePostActivationSetup();

assert.deepEqual(calls, ['friend-register', 'ai', 'friend', 'passkey']);
assert.ok(notices.some((message) => message.includes('不影响使用')));
console.log('license activation entry tests passed');
