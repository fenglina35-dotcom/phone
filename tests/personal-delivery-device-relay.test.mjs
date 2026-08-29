import assert from 'node:assert/strict';
import fs from 'node:fs';

const edge = fs.readFileSync(new URL('../supabase/functions/phone-delivery/index.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/202608300001_phone_delivery_personal_device_relay.sql', import.meta.url), 'utf8');
const delivery = fs.readFileSync(new URL('../delivery.js', import.meta.url), 'utf8');
const agent = fs.readFileSync(new URL('../services/phone-delivery-agent/src/relay-worker.mjs', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../services/phone-delivery-agent/src/main.mjs', import.meta.url), 'utf8');
const secureStore = fs.readFileSync(new URL('../services/phone-delivery-agent/src/secure-store.mjs', import.meta.url), 'utf8');

assert.match(migration, /phone_delivery_devices/);
assert.match(migration, /phone_delivery_device_jobs/);
assert.match(migration, /gen_random_bytes\(6\)/, 'pairing code must use cryptographic randomness');
assert.match(migration, /device_id text not null unique/, 'one agent installation cannot silently attach to multiple owners');
assert.match(migration, /revoke all on public\.phone_delivery_device_jobs from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.phone_delivery_pull_device_jobs\([^)]*\) to anon, authenticated/);
assert.doesNotMatch(migration, /grant (?:select|insert|update|delete).*phone_delivery_device_jobs.*anon/i, 'devices may only use scoped security-definer RPCs');

assert.match(edge, /PHONE_DELIVERY_LEGACY_TARGETS/);
assert.match(edge, /尚未绑定本人的外卖电脑，已禁止连接其他人的后台/);
assert.match(edge, /phone_delivery_enqueue_device_job/);
assert.match(edge, /retryAfterMs:\s*1200,[\s\S]*?\},\s*202\)/);
assert.doesNotMatch(edge, /context\s*=\s*\{[^}]*ownerSecret/s, 'owner secret must not be sent to the friend computer');

assert.match(delivery, /relayRequestId=deliveryRelayRequestId\(\)/);
assert.match(delivery, /res\.status===202&&body&&body\.pending===true/);
assert.match(delivery, /未绑定时禁止连接任何其他人的后台/);

assert.match(agent, /p_target:\s*this\.binding\.target/);
assert.match(agent, /p_device_secret:\s*this\.binding\.deviceSecret/);
assert.match(agent, /PHONE_DELIVERY_CDP_PORT\s*=\s*'9333'/);
assert.doesNotMatch(agent, /SUPABASE_SERVICE_ROLE_KEY|ownerSecret/, 'friend agent must never contain owner or service-role credentials');
assert.match(main, /delivery-edge-profile/);
assert.match(secureStore, /safeStorage\.encryptString/);
assert.match(secureStore, /safeStorage\.decryptString/);
assert.match(main, /if \(!SecureStore\.available\(\)\) throw new Error/);

console.log('personal delivery device relay isolation tests passed');
