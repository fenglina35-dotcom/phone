import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../admin/app.js', import.meta.url), 'utf8');

assert.match(source, /const attempts = action === 'admin_license_users' \? 2 : 1/);
assert.match(source, /error\.name === 'AbortError' \|\| !error\.status \|\| error\.status >= 500/);
assert.match(source, /await new Promise\(\(resolve\) => setTimeout\(resolve, 700\)\)/);
assert.match(source, /if \(loadingLicenses\)[\s\S]*licenseReloadQueued = true/);
assert.match(source, /north_\$\{PORTAL_MODE\}_license_count_v1/);
assert.match(source, /writeLicenseCountCache\(licenseTotal\)/);
assert.match(source, /本次读取失败，保留上次成功人数/);
assert.match(source, /if \(showLoading && !licenseUsers\.length\)/);
assert.doesNotMatch(source, /if \(!licenseHasLoaded\) licenseLoadFailed = true/);

console.log('admin license sync retry tests passed');
