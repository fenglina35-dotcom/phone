import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const bytes = (...values) => new Uint8Array(values).buffer;
const seen = [];
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
};
context.window = context;
context.window.isSecureContext = true;
context.window.PublicKeyCredential = function PublicKeyCredential() {};
context.window.matchMedia = () => ({ matches: false });
context.navigator = {
  standalone: false,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  credentials: {
    async create({ publicKey }) {
      assert.ok(publicKey.challenge instanceof ArrayBuffer);
      assert.ok(publicKey.user.id instanceof ArrayBuffer);
      return {
        id: 'register-credential',
        rawId: bytes(1, 2, 3),
        type: 'public-key',
        authenticatorAttachment: 'platform',
        getClientExtensionResults: () => ({}),
        response: {
          clientDataJSON: bytes(4, 5),
          attestationObject: bytes(6, 7),
          getTransports: () => ['internal'],
          getPublicKey: () => bytes(8, 9),
          getPublicKeyAlgorithm: () => -7,
        },
      };
    },
    async get({ publicKey }) {
      assert.ok(publicKey.challenge instanceof ArrayBuffer);
      return {
        id: 'register-credential',
        rawId: bytes(1, 2, 3),
        type: 'public-key',
        authenticatorAttachment: 'platform',
        getClientExtensionResults: () => ({}),
        response: {
          clientDataJSON: bytes(4, 5),
          authenticatorData: bytes(6, 7),
          signature: bytes(8, 9),
          userHandle: bytes(10),
        },
      };
    },
  },
};

context.fetch = async (_url, options) => {
  const body = JSON.parse(options.body);
  seen.push(body);
  const responses = {
    activate: { ok: true, session: { token: 'token-1', licenseId: 'license-1', sessionId: 'session-1', activeCount: 1 } },
    register_options: {
      ok: true,
      challengeId: 'challenge-register',
      options: {
        challenge: 'AQID',
        rp: { id: 'example.com', name: 'North' },
        user: { id: 'BAUG', name: 'north-test', displayName: 'North' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        excludeCredentials: [{ id: 'BwgJ', type: 'public-key' }],
      },
    },
    register_verify: { ok: true, session: { token: 'token-1', licenseId: 'license-1', sessionId: 'session-1' }, passkeyCount: 1 },
    restore_options: { ok: true, challengeId: 'challenge-auth', options: { challenge: 'AQID', rpId: 'example.com', allowCredentials: [] } },
    restore_verify: { ok: true, session: { token: 'token-2', licenseId: 'license-1', sessionId: 'session-2', activeCount: 2, evicted: [] } },
    session_check: { ok: true, valid: true, licenseId: 'license-1', sessionId: 'session-2', sessionCount: 2, passkeyCount: 1 },
    session_list: { ok: true, currentSessionId: 'session-2', sessions: [{ id: 'session-2', label: 'iPhone · Edge', current: true }, { id: 'session-1', label: 'iPhone · Safari', current: false }] },
    session_revoke: { ok: true, revokedCurrent: true },
    ai_identity_sync: { ok: true, userId: 'ph_shared', clientSecret: 'sec_shared_1234567890', existing: true },
    phone_friend_identity_sync: { ok: true, phoneFriendId: 'SPABCDEFGH' },
  };
  const payload = responses[body.action];
  return new Response(JSON.stringify(payload || { ok: false, error: 'missing mock' }), {
    status: payload ? 200 : 400,
    headers: { 'Content-Type': 'application/json' },
  });
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../license-gate.js', import.meta.url), 'utf8'), context);
const license = context.NorthLicense;
license.init({ baseUrl: 'https://example.supabase.co', apiKey: 'public-key', epoch: 3 });

assert.equal(license.deviceLabel(), 'iPhone · Safari');
context.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 EdgA/130.0';
assert.equal(license.deviceLabel(), '安卓手机 · Edge');
context.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
assert.equal(license.supportsPasskey(), true);
const source = new Uint8Array([0, 1, 2, 253, 254, 255]);
const encoded = license._test.bufferToB64url(source);
assert.deepEqual(Array.from(new Uint8Array(license._test.b64urlToBuffer(encoded))), Array.from(source));

await license.activate('TEST-CODE');
assert.equal(license.isManaged(), true);
assert.equal(license.session().token, 'token-1');

await license.bindPasskey();
assert.equal(license.meta().passkeyCount, 1);
const registerVerify = seen.find((item) => item.action === 'register_verify');
assert.equal(registerVerify.credential.response.transports[0], 'internal');
assert.equal(registerVerify.credential.response.publicKeyAlgorithm, -7);

const createCredential = context.navigator.credentials.create;
context.navigator.credentials.create = async () => { throw { name: 'InvalidStateError' }; };
const verifyCountBefore = seen.filter((item) => item.action === 'register_verify').length;
const alreadyBound = await license.bindPasskey();
assert.equal(alreadyBound.alreadyBound, true);
assert.equal(license.meta().passkeyCount, 1);
assert.equal(seen.filter((item) => item.action === 'register_verify').length, verifyCountBefore);
context.navigator.credentials.create = async () => { throw { name: 'SecurityError' }; };
await assert.rejects(() => license.bindPasskey(), /当前打开地址与手机验证绑定域名不一致/);
context.navigator.credentials.create = createCredential;

await license.relinkPasskey();
assert.equal(license.session().token, 'token-2');
assert.equal(seen.some((item) => item.action === 'session_revoke' && item.targetSessionId === 'session-1'), true);
await license.check();
assert.equal(license.meta().sessionCount, 2);
const sessionList = await license.listSessions();
assert.equal(sessionList.sessions.length, 2);
assert.equal(license.meta().sessionCount, 2);
const restoredIdentity = await license.syncAIIdentity('ph_new', 'sec_new_1234567890');
assert.equal(restoredIdentity.userId, 'ph_shared');

assert.equal(license.createTransfer, undefined);
assert.equal(license.createRecovery, undefined);
assert.equal(license.redeemTransfer, undefined);
assert.equal(license.redeemRecovery, undefined);
assert.equal(license.relinkTransfer, undefined);
assert.equal(license.restoreLocalIdentity, undefined);
await license.syncPhoneFriendIdentity('SPABCDEFGH', 'pfs_abcdefghijklmnopqrstuvwxyz123456');
assert.equal(seen.some((item) => item.action === 'phone_friend_identity_sync' && item.phoneFriendId === 'SPABCDEFGH'), true);

console.log('license gate browser contract tests passed');
