import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const gate = read('license-gate.js');
const licenseBackend = read('supabase/functions/phone-license/index.ts');
const aiBackend = read('supabase/functions/phone-ai/index.ts');
const migration = read('supabase/migrations/202607300001_license_incident_recovery.sql');
const adminHtml = read('admin/index.html');
const adminApp = read('admin/app.js');

assert.match(licenseBackend, /class LicenseHttpError extends Error/);
assert.match(licenseBackend, /temporaryLicenseError[\s\S]*?503[\s\S]*?license-service-unavailable/);
assert.match(licenseBackend, /if \(error\) throw temporaryLicenseError\(\)/);
assert.match(licenseBackend, /license-admin-blocked'[\s\S]*?true/);
assert.match(licenseBackend, /license-awaiting-admin-restore/);
assert.match(licenseBackend, /'local_identity_restore'\]\.includes\(action\)/);
assert.match(licenseBackend, /biometric-required/);
assert.match(licenseBackend, /permanent: error\.permanent/);

assert.match(gate, /out\.code = String\(payload && payload\.code/);
assert.match(gate, /const permanentCodes = new Set\(/);
assert.match(gate, /out\.permanent = !!\(payload && payload\.permanent\) && permanentCodes\.has\(out\.code\)/);
assert.match(gate, /license-admin-blocked/);
assert.doesNotMatch(gate, /'license-session-invalid',[\s\S]*?'license-admin-blocked'/);
assert.doesNotMatch(gate, /'license-not-found'/);
assert.doesNotMatch(gate, /async function restoreLocalIdentity/);

assert.match(app, /e&&e\.server&&e\.code==='license-admin-blocked'/);
assert.doesNotMatch(app, /e&&e\.server&&e\.permanent===true/);
assert.doesNotMatch(app, /e&&e\.server&&e\.status===400/);
assert.match(app, /_licenseCheckFailures=0,_licenseCheckNextAt=0/);
assert.match(app, /Math\.min\(30\*60000,60000\*Math\.pow\(2,_licenseCheckFailures-1\)\)/);
assert.doesNotMatch(app, /授权检查暂时未连通，当前登录不受影响，稍后会自动重试/);
assert.doesNotMatch(app, /licenseTryIncidentRecovery/);

assert.match(migration, /create table if not exists public\.phone_license_incident_recovery/);
assert.match(migration, /create or replace function public\.phone_license_restore_all_safe/);
assert.match(migration, /select count\(\*\) into v_total from public\.phone_licenses/);
assert.match(migration, /where l\.status <> 'active' or l\.epoch <> p_epoch/);
assert.doesNotMatch(migration, /phone_license_admin_actions/);
assert.match(migration, /now\(\) \+ interval '24 hours'/);
assert.match(migration, /grant execute on function public\.phone_license_restore_all_safe[\s\S]*?to service_role/);

assert.match(aiBackend, /action === "admin_license_restore_all"/);
assert.match(adminHtml, /id="licenseRestoreAllBtn"/);
assert.doesNotMatch(adminHtml, /id="licenseRestoreAllBtn" data-owner-only/);
assert.match(adminApp, /openRestoreAllLicenses/);

console.log('license incident recovery tests passed');
