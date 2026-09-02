import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const main = read('services/phone-smart-home-agent/src/main.mjs');
const relay = read('services/phone-smart-home-agent/src/relay-worker.mjs');
const local = read('services/phone-smart-home-agent/src/meross-local.mjs');
const preload = read('services/phone-smart-home-agent/src/preload.cjs');
const guide = read('services/phone-smart-home-agent/guide/新手教程.html');
const migration = read('supabase/migrations/202609020006_phone_smart_home_verified_lamp.sql');

assert.match(main, /pair-start[\s\S]*controller\.identify\(\)/, 'pairing must physically identify the candidate lamp before confirmation');
assert.match(main, /pair-confirm[\s\S]*phone_smart_home_bind_verified_device/, 'only explicit confirmation may bind the fingerprint');
assert.match(main, /lampFingerprint:\s*pending\.fingerprint/, 'the encrypted local binding must retain the confirmed fingerprint');
assert.match(preload, /pairStart[\s\S]*pairConfirm[\s\S]*pairCancel/, 'the renderer may only use the three-step confirmation API');
assert.match(local, /sha256:[^\n]+msl430/, 'raw HomeKit accessory identity must be one-way hashed');
assert.match(relay, /devices\.find\(device => device\.fingerprint === this\.binding\.lampFingerprint\)/, 'reconnect must select only the previously confirmed lamp');
assert.match(relay, /不会改连其他灯/, 'a missing bound lamp must fail instead of falling back to another MSL430');
assert.match(migration, /unique index[\s\S]*lamp_id_hash/i, 'cloud must prevent active duplicate lamp claims');
assert.match(migration, /lamp-already-bound-to-another-home/, 'duplicate claims must return an explicit error');
assert.match(migration, /revoke execute on function public\.phone_smart_home_bind_device[\s\S]*from anon,authenticated/, 'the unverified legacy bind RPC must be disabled');
assert.match(migration, /phone_smart_home_pull_verified/, 'jobs may only be pulled by the agent bound to the same lamp fingerprint');
assert.match(guide, /亲眼确认闪烁的是自己的灯/);
assert.match(guide, /公共Wi‑Fi/);
assert.doesNotMatch(guide, /Wi-Fi 密码.{0,20}(?:填写|输入|上传)/);

console.log('smart-home unique lamp security tests passed');
