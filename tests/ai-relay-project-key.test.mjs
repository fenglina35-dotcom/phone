import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const privateSource = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');

function functionSource(name) {
  let start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('phone-ai relay uses the public key belonging to its selected Supabase project', () => {
  const context = vm.createContext({
    String, URL,
    LICENSE_FAILOVER_URL: 'https://new-project.supabase.co',
    LICENSE_FAILOVER_KEY: 'new-public-key',
    GATE_KEY: 'old-public-key',
    aiCoreUrl: () => 'https://new-project.supabase.co/functions/v1/phone-ai',
  });
  vm.runInContext(functionSource('aiCoreKey'), context);
  assert.equal(context.aiCoreKey('https://new-project.supabase.co/functions/v1/phone-ai'), 'new-public-key');
  assert.equal(context.aiCoreKey('https://old-project.supabase.co/functions/v1/phone-ai'), 'old-public-key');
  const relay = source.slice(source.indexOf('async function aiRelay'), source.indexOf('function joinAIContinuation'));
  assert.match(relay, /relayKey=aiCoreKey\(url\)/);
  assert.match(relay, /'apikey':relayKey,'Authorization':'Bearer '\+relayKey/);
  assert.doesNotMatch(relay, /'apikey':GATE_KEY|'Authorization':'Bearer '\+GATE_KEY/);
});

test('existing installs migrate the saved phone-ai endpoint before any internal voice request', () => {
  const S = { settings: { aiCore: { enabled: false, url: 'https://old-project.supabase.co/functions/v1/phone-ai' } } };
  const context = vm.createContext({
    String, S,
    GATE_URL: 'https://old-project.supabase.co',
    AI_BACKEND_URL: 'https://new-project.supabase.co/functions/v1/phone-ai',
  });
  vm.runInContext(functionSource('aiCoreUrl'), context);
  assert.equal(context.aiCoreUrl(), 'https://new-project.supabase.co/functions/v1/phone-ai');
  assert.equal(S.settings.aiCore.url, 'https://new-project.supabase.co/functions/v1/phone-ai');
  assert.match(privateSource, /function aiCoreUrl\(\).*legacy=GATE_URL\+'\/functions\/v1\/phone-ai'.*core\.url=url/s);
});

test('AI identity sync marker is invalidated when the phone-ai backend moves', async () => {
  const values = new Map([['north_license_ai_sync_v1', 'session-1']]);
  let syncCalls = 0;
  const context = vm.createContext({
    window: {},
    localStorage: { getItem: key => values.get(key) || '', setItem: (key, value) => values.set(key, String(value)) },
    aiCoreUrl: () => 'https://new-project.supabase.co/functions/v1/phone-ai',
    aiUserId: () => 'ph_existing_user',
    aiUserSecret: () => 'sec_existing_user_123456789',
  });
  context.window.NorthLicense = context.NorthLicense = {
    isManaged: () => true,
    session: () => ({ sessionId: 'session-1', licenseId: 'license-1' }),
    syncAIIdentity: async () => {
      syncCalls += 1;
      return { userId: 'ph_bound_user', clientSecret: 'sec_bound_user_123456789' };
    },
  };
  vm.runInContext(functionSource('licenseSyncAiIdentity'), context);
  await context.licenseSyncAiIdentity(false);
  assert.equal(syncCalls, 1, 'the legacy v1 marker must not skip post-migration identity sync');
  assert.equal(values.get('north_license_ai_sync_v2'), 'session-1|https://new-project.supabase.co/functions/v1/phone-ai');
  await context.licenseSyncAiIdentity(false);
  assert.equal(syncCalls, 1, 'the backend-qualified marker should suppress duplicate syncs');
  assert.match(privateSource, /markKey='north_license_ai_sync_v2',expected=\(s\.sessionId\|\|s\.licenseId\)\+'\|'\+aiCoreUrl\(\)/);
});
