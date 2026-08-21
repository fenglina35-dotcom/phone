import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const privateApp = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneCompanionTestApp.swift');
const privateSync = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift');
const edge = read('supabase/functions/phone-role-push/index.ts');
const pet = read('pet-game.js');
const petCss = read('pet-game.css');
const migration = read('supabase/migrations/202608130003_background_delivery_diagnostics.sql');

test('private app installs its wake handler at app launch, not inside a settings page', () => {
  const launch = privateApp.slice(
    privateApp.indexOf('didFinishLaunchingWithOptions'),
    privateApp.indexOf('func applicationDidBecomeActive'),
  );
  assert.match(launch, /setBackgroundWakeHandler/);
  assert.match(launch, /service\.synchronize\(/);
  assert.match(launch, /refreshUsage: true/);
  assert.doesNotMatch(privateSync, /pushCoordinator\.setBackgroundWakeHandler/);
});

test('explicit server tasks cannot be canceled by the autonomous quiet response', () => {
  assert.match(edge, /const explicitHandoff = \["reply_handoff", "device_handoff", "one_minute_test", "app_watch_test", "delivery_status"\]/);
  assert.match(edge, /!explicitHandoff,/);
  assert.match(edge, /if \(allowSilent\) return \{ kind: "silent", body: "" \}/);
  assert.match(edge, /这次是用户明确发起并等待结果的任务，不能保持安静/);
});

test('APNs and device acknowledgements leave diagnostics without exposing credentials', () => {
  assert.match(edge, /response\.headers\.get\("apns-id"\)/);
  assert.match(edge, /wake:\s*\{/);
  assert.match(edge, /push_diagnostic: push\.diagnostic/);
  assert.match(privateSync, /"deviceAcknowledgedAt": iso8601\(Date\(\)\)/);
  assert.match(migration, /push_diagnostic jsonb/);
  assert.match(migration, /coalesce\(result, '\{\}'::jsonb\) \|\| case/);
  assert.doesNotMatch(migration, /device.token|private.key/i);
});

test('sleeping pets are species-sized and anchored below the kennel rim inside the pink cushion', () => {
  assert.match(pet, /1:\[\{x:20\.5,y:45\.0\}\]/);
  assert.match(pet, /4:\[\{x:15\.1,y:42\.7\},\{x:25\.9,y:42\.7\},\{x:15\.1,y:47\.1\},\{x:25\.9,y:47\.1\}\]/);
  assert.match(pet, /petSleepWidth\(q\.species,total\)/);
  assert.match(petCss, /width:min\(var\(--pet-sleep-width,30%\),132px\)/);
  assert.doesNotMatch(pet, /PET_SLEEP_SPOTS/);
});
