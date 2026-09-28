import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202607250001_license_invite_attribution.sql');
const adminApp = read('admin/app.js');
const adminHtml = read('admin/index.html');
const adminWorker = read('admin/sw.js');

assert.match(migration, /add column if not exists invite_code_hash text/);
assert.match(migration, /add column if not exists invite_code_hint text/);
assert.match(migration, /phone_licenses_invite_code_hash_created_idx/);
assert.match(migration, /coalesce\(reusable, false\) = false/);
assert.match(migration, /join single_invites i on i\.used_at = l\.created_at/);
assert.match(migration, /having count\(\*\) = 1/g);
assert.match(migration, /public\.normalize_invite_code\(p_code\)/);
assert.match(migration, /extensions\.digest\(v_invite_norm, 'sha256'\)/);
assert.match(migration, /insert into public\.phone_licenses\([\s\S]*invite_code_hash,[\s\S]*invite_code_hint/);
assert.match(migration, /l\.invite_code_hash = v_invite_hash/g);
assert.match(migration, /l\.invite_code_hint/);
assert.doesNotMatch(migration, /add column if not exists invite_code text/);
assert.match(migration, /grant execute on function public\.redeem_invite_license[\s\S]*to service_role/);
assert.match(migration, /grant execute on function public\.phone_license_admin_page[\s\S]*to service_role/);

assert.match(adminHtml, /完整邀请码或授权编号/);
assert.match(adminHtml, /完整邀请码可查询已迁入的使用者/);
assert.match(adminApp, /<b>使用邀请码<\/b>/);
assert.match(adminApp, /user\.invite_code_hint \|\| '旧记录未保存'/);
assert.match(adminHtml, /app\.js\?v=641/);
assert.match(adminApp, /sw\.js\?v=641/g);
assert.match(adminWorker, /north-admin-v641/);

console.log('license admin invite search tests passed');
