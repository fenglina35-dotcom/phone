import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const staff = read('admin/index.html');
const owner = read('admin-owner/index.html');
const rootServiceWorker = read('sw.js');
const app = read('admin/app.js');
const backend = read('supabase/functions/phone-license/index.ts');
const relay = read('services/phone-license-relay/worker.mjs');
const migration = read('supabase/migrations/202609280001_phone_admin_owner_pairing.sql');

assert.match(staff, /data-admin-portal="staff"/);
assert.match(staff, /其他管理员入口/);
assert.match(staff, /管理员码/);
assert.doesNotMatch(staff, /主管理员总后台/);
assert.doesNotMatch(staff, /ownerPairBtn/);

assert.match(owner, /data-admin-portal="owner"/);
assert.match(rootServiceWorker, /\/\\\/admin\(\?:-owner\)\?\(\?:\\\/\|\$\)\//, 'root service worker must bypass both admin portal paths');
assert.match(owner, /主管理员总后台/);
assert.match(owner, /一次性设备绑定码/);
assert.match(owner, /ownerPairBtn/);
assert.doesNotMatch(owner, /其他管理员入口/);

assert.match(app, /PORTAL_MODE === 'owner' \? 'north_owner_access' : 'north_staff_access'/);
assert.match(app, /function readOwnerCookie\(\)/);
assert.match(app, /function writeOwnerCookie\(value\)/);
assert.match(app, /Path=\/phone\/admin-owner\/; Max-Age=31536000; Secure; SameSite=Strict/);
assert.match(app, /readOwnerCookie\(\) \|\| localStorage\.getItem\(LEGACY_TOKEN_KEY\)/);
assert.match(app, /writeOwnerCookie\(token\)/);
assert.match(app, /clearOwnerCookie\(\)/);
assert.match(app, /PORTAL_MODE === 'staff' && ownerAccess/);
assert.match(app, /admin_owner_pair_create/);
assert.match(app, /admin_owner_pair_claim/);
assert.match(app, /new URL\('\.\.\/admin-owner\/index\.html'/);
assert.match(app, /link\.searchParams\.set\('release', '642'\)/);
assert.match(app, /const apiUrls = ownerPairAction \? \[OWNER_PAIR_API_URL\] : \[ADMIN_API_URL, OWNER_PAIR_API_URL\]/);
assert.match(app, /正在读取用户授权，当前不是 0 人/);
assert.match(app, /用户授权读取失败，请点“刷新”重试/);
assert.match(app, /link\.searchParams\.set\('bind', code\)/);
assert.match(app, /function ownerPairCodeFromLink\(\)/);
assert.match(app, /query\.get\('bind'\) \|\| fragment\.get\('bind'\)/);
assert.match(app, /query\.delete\('bind'\)/);
assert.match(app, /history\.replaceState\(null, '', location\.pathname/);
assert.match(app, /else if \(ownerPairLinkCode\) login\(ownerPairLinkCode\)/);
assert.match(app, /OWNER_PAIR_API_URL = 'https:\/\/lkhlyfpssmrjkkzhuzag\.supabase\.co\/functions\/v1\/phone-license'/);
assert.match(app, /action === 'admin_owner_pair_create' \|\| action === 'admin_owner_pair_claim'/);
assert.match(app, /localStorage\.removeItem\(LEGACY_TOKEN_KEY\)/);

assert.match(backend, /phone_admin_owner_pairings/);
assert.match(backend, /phone_admin_owner_pair_claim/);
assert.match(backend, /admin_token: ownerToken/);
assert.match(relay, /ADMIN_PUBLIC_ACTIONS = new Set\(\['admin_owner_pair_claim'\]\)/);
assert.match(migration, /used_at is null/);
assert.match(migration, /expires_at >= now\(\)/);
assert.match(migration, /grant execute on function public\.phone_admin_owner_pair_claim\(text\) to service_role/);

console.log('admin portal separation tests passed');
