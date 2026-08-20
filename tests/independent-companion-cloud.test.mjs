import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const syncView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift');
const migration = read('supabase/migrations/202608200001_independent_companion_cloud_endpoint.sql');

test('companion, background push, and private account use the dedicated cloud', () => {
  assert.match(app, /const COMPANION_URL='https:\/\/qvuahlqimcfgeoetosnl\.supabase\.co'/);
  assert.match(app, /fetchT\(COMPANION_URL\+'\/rest\/v1\/rpc\/'\+name/);
  assert.match(app, /fetchT\(COMPANION_URL\+'\/functions\/v1\/phone-companion-push'/);
  assert.match(app, /fetch\(COMPANION_URL\+'\/rest\/v1\/rpc\/phone_role_background_enqueue'/);
  assert.match(app, /fetchT\(COMPANION_URL\+'\/functions\/v1\/phone-role-push'/);
  assert.match(bridge, /privateAccountBaseURL\s*=\s*"https:\/\/qvuahlqimcfgeoetosnl\.supabase\.co"/);
  assert.match(syncView, /https:\/\/qvuahlqimcfgeoetosnl\.supabase\.co/);
});

test('license and AI points share the authorization project while companion remains isolated', () => {
  assert.match(app, /const GATE_URL='https:\/\/lkhlyfpssmrjkkzhuzag\.supabase\.co'/);
  assert.match(app, /const LICENSE_FAILOVER_URL='https:\/\/lovbzibismsjqvjujilz\.supabase\.co'/);
  assert.match(app, /const AI_BACKEND_URL=LICENSE_FAILOVER_URL\+'\/functions\/v1\/phone-ai'/);
  assert.match(app, /aiCore:\{enabled:false,url:AI_BACKEND_URL/);
  assert.doesNotMatch(app, /LICENSE_FAILOVER_URL\+'\/functions\/v1\/(?:phone-role-push|phone-companion-push)'/);
});

test('new users can create an isolated private account without overwriting existing backups', () => {
  assert.match(app, /account\.password\.signup/);
  assert.match(bridge, /case "account\.password\.signup", "account\.password\.signin"/);
  assert.match(bridge, /\? "\/auth\/v1\/signup"/);
  assert.match(app, /if\(!info\.found\)\{await privatePhoneCloudBackup\(true\)/);
  assert.match(app, /系统没有自动上传或下载/);
});

test('tracked scheduler migration points only to the dedicated cloud', () => {
  assert.match(migration, /qvuahlqimcfgeoetosnl\.supabase\.co\/functions\/v1\/phone-role-push/);
  assert.doesNotMatch(migration, /lkhlyfpssmrjkkzhuzag|lovbzibismsjqvjujilz/);
});
