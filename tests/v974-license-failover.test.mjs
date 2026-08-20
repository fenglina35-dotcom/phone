import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../license-gate.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url),
  'utf8',
);

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function loadGate(fetch) {
  const context = {
    AbortController, ArrayBuffer, Error, JSON, Math, Promise, Response, Set,
    Uint8Array, atob, btoa, clearTimeout, console, crypto: globalThis.crypto,
    fetch, localStorage: new MemoryStorage(), navigator: { userAgent: 'test' }, setTimeout,
  };
  context.window = context;
  context.window.matchMedia = () => ({ matches: false });
  vm.createContext(context);
  vm.runInContext(source, context);
  context.NorthLicense.init({
    epoch: 4,
    endpoints: [
      { id: 'primary', baseUrl: 'https://primary.example', apiKey: 'primary-public' },
      { id: 'license-failover', baseUrl: 'https://standby.example', apiKey: 'standby-public' },
    ],
  });
  return context.NorthLicense;
}

test('license activation fails over on a 5xx and pins the successful endpoint', async () => {
  const seen = [];
  const gate = loadGate(async (url, options) => {
    seen.push(url);
    if (url.startsWith('https://primary.example')) {
      return new Response(JSON.stringify({ ok: false, error: 'origin timeout' }), { status: 522 });
    }
    const action = JSON.parse(options.body).action;
    const payload = action === 'activate'
      ? { ok: true, session: { token: 'token-standby', licenseId: 'license-1', sessionId: 'session-1' } }
      : { ok: true, valid: true, sessionCount: 1 };
    return new Response(JSON.stringify(payload), { status: 200 });
  });
  await gate.activate('TEST-CODE');
  assert.equal(gate.session().endpointId, 'license-failover');
  seen.length = 0;
  await gate.check();
  assert.equal(seen[0].startsWith('https://standby.example'), true);
});

test('an unavailable primary plus an unsynchronized standby stays an outage', async () => {
  const gate = loadGate(async (url) => {
    if (url.startsWith('https://primary.example')) throw new TypeError('network failed');
    return new Response(JSON.stringify({ ok: false, error: 'invalid invite', code: 'license-request-failed' }), { status: 400 });
  });
  await assert.rejects(gate.activate('NOT-COPIED-YET'), (error) => error.network === true);
  assert.equal(gate.session(), null);
});

test('license and AI points use the authorization project without moving companion data', () => {
  assert.match(app, /const LICENSE_FAILOVER_URL='https:\/\/lovbzibismsjqvjujilz\.supabase\.co'/);
  assert.match(app, /endpoints:\[\s*\{id:'primary',baseUrl:GATE_URL,apiKey:GATE_KEY\},\s*\{id:'license-failover',baseUrl:LICENSE_FAILOVER_URL,apiKey:LICENSE_FAILOVER_KEY\}/);
  assert.match(app, /const AI_BACKEND_URL=LICENSE_FAILOVER_URL\+'\/functions\/v1\/phone-ai'/);
  assert.match(app, /aiCore:\{enabled:false,url:AI_BACKEND_URL/);
  assert.match(bridge, /"lovbzibismsjqvjujilz\.supabase\.co"/);
  assert.match(bridge, /privateAccountBaseURL\s*=\s*"https:\/\/qvuahlqimcfgeoetosnl\.supabase\.co"/);
});
