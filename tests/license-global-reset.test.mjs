import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const edge = fs.readFileSync(path.join(root, 'supabase/functions/phone-license/index.ts'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/202607230002_invalidate_pre_v625_licenses.sql'),
  'utf8',
);

assert.match(app, /const SHARE_EPOCH=4;/);
assert.match(edge, /LICENSE_EPOCH'\) \|\| 4/);
assert.doesNotMatch(edge, /Number\(data\.epoch\) !== LICENSE_EPOCH/);
assert.match(app, /普通网页更新不得用它让现有授权退出/);
assert.match(migration, /where epoch < 4/);
assert.match(migration, /update public\.phone_license_sessions/);
assert.match(migration, /update public\.phone_license_bootstraps/);
assert.match(migration, /update public\.phone_license_challenges/);
assert.match(migration, /update public\.phone_license_transfers/);
assert.match(migration, /set status = 'blocked'/);
assert.doesNotMatch(migration, /\bdelete\s+from\b/i);

console.log('global license reset tests passed');
