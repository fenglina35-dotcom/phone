import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url),
  'utf8'
);
const migration = fs.readFileSync(
  new URL('../supabase/migrations/202608110001_private_phone_accounts.sql', import.meta.url),
  'utf8'
);
const controllerMigration = fs.readFileSync(
  new URL('../supabase/migrations/202608110002_private_phone_companion_controller.sql', import.meta.url),
  'utf8'
);

test('phone account UI is private-app only and preserves local data before a choice', () => {
  assert.match(app, /window\.__SMALL_PHONE_PRIVATE__===true/);
  assert.match(app, /if\(!info\.found\)\{await privatePhoneCloudBackup\(true\)/);
  assert.match(app, /系统没有自动上传或下载/);
  assert.match(app, /当前本机不会在确认前发生任何变化/);
  assert.match(app, /S=mergeStateData\(d\);normalizeLoadedState\(\);phoneFriendState\(\)/);
  assert.match(app, /PRIVATE_PHONE_RESTORE_ROLLBACK_KEY='__private_phone_restore_rollback'/);
  assert.match(app, /before=await fullBackupState\(\);await imgPut\(PRIVATE_PHONE_RESTORE_ROLLBACK_KEY/);
  assert.match(app, /撤回上次恢复/);
  assert.match(app, /async function privatePhoneCloudRestoreRollback\(\)/);
});

test('private app stores auth tokens in Keychain and never returns them to JavaScript', () => {
  assert.match(bridge, /import Security/);
  assert.match(bridge, /kSecClassGenericPassword/);
  assert.match(bridge, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(bridge, /privateAccountKeychainService/);
  assert.doesNotMatch(bridge, /"accessToken": session\.accessToken/);
  assert.doesNotMatch(bridge, /"refreshToken": session\.refreshToken/);
});

test('phone and password login, refresh, backup, and restore all use the native bridge', () => {
  for (const action of [
    'account.password.signup',
    'account.password.signin',
    'account.backup.info',
    'account.backup.upload',
    'account.backup.restore',
  ]) {
    assert.match(bridge, new RegExp(action.replaceAll('.', '\\.') ));
  }
  assert.match(bridge, /\/auth\/v1\/signup/);
  assert.match(bridge, /\/auth\/v1\/token\?grant_type=password/);
  assert.match(bridge, /smallphone\." \+ digits \+ "@example\.com/);
  assert.doesNotMatch(bridge, /\/auth\/v1\/otp/);
  assert.doesNotMatch(bridge, /account\.otp\.(?:send|verify)/);
  assert.match(app, /autocomplete="current-password"/);
  assert.match(app, /account\.password\.signup/);
  assert.match(app, /account\.password\.signin/);
  assert.match(app, /创建并绑定/);
  assert.match(app, /独立的私人小手机云账号/);
  assert.doesNotMatch(app, /privatePhoneAccountSendOTP|privatePhoneAccountVerifyOTP/);
  assert.match(bridge, /\/auth\/v1\/token\?grant_type=refresh_token/);
  assert.match(bridge, /SHA256\.hash\(data: snapshotData\)/);
  assert.match(app, /privatePhoneCloudMarkDirty\(savedAt\)/);
  assert.match(app, /privatePhoneCloudAutoBackup/);
});

test('cloud backup table is auth-owned and rejects stale snapshot overwrite', () => {
  assert.match(migration, /alter table public\.private_phone_backups enable row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/g);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /where private_phone_backups\.captured_at <= excluded\.captured_at/i);
  assert.match(migration, /references auth\.users\(id\) on delete cascade/i);
  assert.doesNotMatch(migration, /^\s*phone(?:_number)?\s+/im);
});

test('private phone account can claim the sole companion controller without unpairing the device', () => {
  assert.match(controllerMigration, /auth\.uid\(\)/i);
  assert.match(controllerMigration, /payload\s*#>>\s*'\{settings,cloudId\}'/i);
  assert.match(controllerMigration, /backup-target-mismatch/i);
  assert.match(controllerMigration, /device_secret_hash is not null/i);
  assert.match(controllerMigration, /owner_secret_hash = public\.phone_companion_hash\(p_new_owner_secret\)/i);
  assert.match(controllerMigration, /controller_kind = 'private-small-phone'/i);
  assert.doesNotMatch(controllerMigration, /device_secret_hash\s*=/i);
  assert.match(controllerMigration, /grant execute[\s\S]+to authenticated/i);
  assert.match(app, /privatePhoneClaimCompanionController/);
  assert.match(app, /async function companionRpc\([^\n]+let claimError=null/,'an account outage must not preempt an already-linked owner RPC');
  assert.match(app, /async function companionRpc\([^\n]+catch\(e\)[^\n]+claimError=e[^\n]+fetchT\(/,'the existing secure link is verified by the server after a failed account refresh');
  assert.match(app, /async function companionRpc\([^\n]+if\(claimError&&unlinked\)throw claimError/,'first-time or genuinely unlinked devices still require the private account claim');
  assert.match(app, /name!==['"]phone_companion_begin_pairing['"]/);
  assert.match(bridge, /companion\.controller\.claim/);
});
