import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const gateSource = read('license-gate.js');
const app = read('app.js');
const privateApp = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const privateGate = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/license-gate.js');
const backend = read('supabase/functions/phone-license/index.ts');

assert.doesNotMatch(backend, /MAX_SESSIONS/);
assert.doesNotMatch(backend, /slice\(MAX_SESSIONS\)/);
assert.match(backend, /select\('id,license_id,label,created_at,last_seen_at,revoked_at'\)/);
assert.match(backend, /await activeLicense\(data\.license_id\);[\s\S]*?if \(data\.revoked_at\)[\s\S]*?update\(\{ revoked_at: null/);
assert.match(backend, /activeCount: \(sessions \|\| \[\]\)\.length/);
assert.doesNotMatch(backend, /Number\(data\.epoch\) !== LICENSE_EPOCH/);

for (const source of [app, privateApp]) {
  assert.match(source, /e&&e\.server&&e\.code==='license-admin-blocked'/);
  assert.doesNotMatch(source, /e&&e\.server&&e\.permanent===true/);
  assert.doesNotMatch(source, /第4个浏览器恢复时会自动退出最早的一个/);
  assert.match(source, /新增浏览器不会再自动退出原来的入口/);
}
assert.equal(gateSource, privateGate, 'web and private license clients must remain identical');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

let failureCode = 'license-session-invalid';
const context = {
  AbortController,
  ArrayBuffer,
  Error,
  JSON,
  Math,
  Promise,
  TextDecoder,
  TextEncoder,
  Uint8Array,
  atob,
  btoa,
  clearTimeout,
  console,
  crypto: globalThis.crypto,
  localStorage: new MemoryStorage(),
  setTimeout,
  fetch: async () => new Response(JSON.stringify({
    ok: false,
    error: failureCode === 'license-admin-blocked' ? '手机授权已被管理员移出' : '旧会话暂时无效',
    code: failureCode,
    permanent: true,
  }), { status: failureCode === 'license-admin-blocked' ? 403 : 401 }),
};
context.window = context;
context.window.matchMedia = () => ({ matches: false });
context.navigator = { userAgent: 'Android', standalone: false };
vm.createContext(context);
vm.runInContext(gateSource, context);

const license = context.NorthLicense;
license.init({ baseUrl: 'https://license.example', apiKey: 'public', epoch: 4 });
license.saveSession({ token: 'saved-token', licenseId: 'saved-license', sessionId: 'saved-session' });
license.init({ baseUrl: 'https://license.example', apiKey: 'public', epoch: 99 });
assert.equal(license.isManaged(), true, 'a release marker change must not revoke a saved grant');

await assert.rejects(
  () => license.check(),
  (error) => error.code === 'license-session-invalid' && error.permanent === false,
  'an invalid/missing session response must not erase local entry by itself',
);
failureCode = 'license-admin-blocked';
await assert.rejects(
  () => license.check(),
  (error) => error.code === 'license-admin-blocked' && error.permanent === true,
  'an explicit administrator block remains terminal',
);

console.log('permanent invitation entry tests passed');
