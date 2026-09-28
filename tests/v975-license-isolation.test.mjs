import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL('../' + path, import.meta.url));
const gateSource = read('license-gate.js');
const app = read('app.js');
const adminApp = read('admin/app.js');
const adminHtml = read('admin/index.html');
const backend = read('supabase/functions/phone-license/index.ts');
const orderBackend = read('supabase/functions/phone-ai/index.ts');
const removal = read('supabase/migrations/202608180001_remove_idle_external_cloud.sql');

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
  vm.runInContext(gateSource, context);
  context.NorthLicense.init({
    epoch: 4,
    endpoints: [
      { id: 'primary', baseUrl: 'https://primary.example', apiKey: 'primary-public' },
      { id: 'license-failover', baseUrl: 'https://license.example', apiKey: 'license-public' },
    ],
  });
  return context.NorthLicense;
}

test('YB2 invitations go directly to the isolated license project', async () => {
  const seen = [];
  const gate = loadGate(async (url) => {
    seen.push(url);
    return new Response(JSON.stringify({ok:true, session:{token:'new-token', licenseId:'new-license', sessionId:'new-session'}}), {status:200});
  });
  await gate.activate('yb2-abc123');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].startsWith('https://license.example'), true);
  assert.equal(gate.session().endpointId, 'license-failover');
});

test('legacy invitation routing remains available for existing users', () => {
  const gate = loadGate(async () => new Response('{}', {status:500}));
  const endpoints = gate._test.licenseEndpoints('activate', {inviteCode:'YB-OLD-CODE'});
  assert.deepEqual(Array.from(endpoints, (item) => item.id), ['primary', 'license-failover']);
});

test('license administration and invitation generation are hosted by phone-license', () => {
  assert.match(adminApp, /ADMIN_API_URL = 'https:\/\/license\.smallphoneapp\.com\/functions\/v1\/phone-license'/);
  assert.doesNotMatch(adminApp, /lovbzibismsjqvjujilz\.supabase\.co/);
  assert.match(adminHtml, /id="licenseGenerateBtn"/);
  assert.match(adminHtml, /id="licenseListInvitesBtn"/);
  assert.match(backend, /action === 'admin_invite_generate'/);
  assert.match(backend, /action === 'admin_invite_list'/);
  assert.match(backend, /\.eq\('active', true\)[\s\S]*\.is\('used_at', null\)/);
  assert.match(backend, /action === 'admin_license_users'/);
  assert.match(backend, /action === 'admin_license_block'/);
  assert.match(backend, /action === 'admin_license_unblock'/);
  assert.match(backend, /action === 'admin_license_restore_all'/);
  assert.match(backend, /`YB2-\$\{suffix\}`/);
  assert.match(backend, /LICENSE_ADMIN_TOKENS/);
  assert.match(backend, /UNIFIED_ADMIN_TOKENS/);
  assert.match(backend, /ADMIN_ACCESS_TOKEN/);
  assert.match(backend, /action === 'admin_orders'/);
  assert.match(orderBackend, /UNIFIED_ADMIN_TOKENS/);
  assert.doesNotMatch(adminApp, /Promise\.allSettled/);
  assert.match(adminApp, /can_orders: ownerAccess/);
  assert.match(adminApp, /can_licenses: true/);
  assert.match(adminApp, /if \(canManageLicenses\) openLicenseView\(\)/);
  assert.match(adminApp, /orderSyncPaused = true/);
  assert.match(adminHtml, /不代表旧项目历史总人数/);
  assert.doesNotMatch(adminApp, /SERVICE_ROLE/);
});

test('the retired idle cloud event and forced navigation feature are removed', () => {
  assert.equal(exists('phone-idle.html'), false);
  assert.equal(exists('supabase_external_events.sql'), false);
  assert.equal(exists('supabase_idle_lock.sql'), false);
  assert.doesNotMatch(app, /idleForce|pollExternalEvents|phone_external_events|phone_idle_locks/);
  assert.match(removal, /drop table if exists public\.phone_idle_locks/);
  assert.match(removal, /drop table if exists public\.phone_external_events/);
});
