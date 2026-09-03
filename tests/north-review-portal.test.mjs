import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../north-role-controller.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../north-role-controller.js',import.meta.url),'utf8');
const reviewMigration=readFileSync(new URL('../supabase/migrations/202608210001_north_review_portal.sql',import.meta.url),'utf8');
const controllerMigration=readFileSync(new URL('../supabase/migrations/202608210002_north_controller_self_service.sql',import.meta.url),'utf8');
const swift=readFileSync(new URL('../native/public-north-review/PhoneCompanionTest/PhoneCompanionTest/CompanionSyncView.swift',import.meta.url),'utf8');
const contentView=readFileSync(new URL('../native/public-north-review/PhoneCompanionTest/PhoneCompanionTest/ContentView.swift',import.meta.url),'utf8');
const project=readFileSync(new URL('../native/public-north-review/PhoneCompanionTest/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');
const notes=readFileSync(new URL('../docs/north-app-review-notes-template.md',import.meta.url),'utf8');

test('ordinary users can create, recover and delete a strong local role controller',()=>{
  for(const phrase of ['创建角色控制端','创建并开始配对','导出恢复文件','导入以前导出的恢复文件','删除控制端']){
    assert.match(html,new RegExp(phrase));
  }
  assert.match(js,/crypto\.getRandomValues\(secretBytes\)/);
  assert.match(js,/new Uint8Array\(32\)/);
  assert.match(js,/target:'yb_'\+randomHex\(20\)/);
  assert.match(js,/phone_companion_begin_pairing/);
  assert.match(js,/phone_companion_pull_snapshot/);
  assert.match(js,/phone_companion_enqueue_command/);
  assert.match(js,/phone_companion_delete_controller/);
  assert.equal((js.match(/localStorage\.setItem\(/g)||[]).length,1);
  assert.match(js,/localStorage\.setItem\(profileStorageKey,JSON\.stringify\(ordinaryProfile\)\)/);
  assert.doesNotMatch(js,/localStorage\.setItem\([^\n]*(?:email|password|accessToken)/i);
});

test('review portal keeps permanent demo login separate and embeds no reviewer credentials',()=>{
  assert.match(html,/审核演示登录/);
  assert.doesNotMatch(html,/type="email"[^>]*\bvalue=/i);
  assert.match(html,/type="password"/i);
  assert.doesNotMatch(html,/REVIEW_ACCOUNT_EMAIL|REVIEW_ACCOUNT_PASSWORD/);
  assert.doesNotMatch(js,/service[_-]?role|deviceSecret|pair_secret|@(?:icloud|gmail|outlook|qq)\./i);
  assert.match(js,/auth\/v1\/token\?grant_type=password/);
  assert.match(js,/phone_companion_review_session/);
  assert.match(js,/phone_companion_review_begin_pairing/);
  assert.match(js,/phone_companion_review_enqueue_command/);
});

test('review RPCs are auth-bound and never expose location, health, or long-lived secrets',()=>{
  assert.match(reviewMigration,/auth\.uid\(\)/);
  assert.match(reviewMigration,/grant execute on function public\.phone_companion_review_session\(\) to authenticated/i);
  assert.match(reviewMigration,/revoke all on function public\.phone_companion_review_session\(\) from public, anon/i);
  assert.match(reviewMigration,/revoke all on function public\.phone_companion_review_begin_pairing\(\) from public, anon/i);
  assert.match(reviewMigration,/revoke all on function public\.phone_companion_review_enqueue_command\(text, text, integer\) from public, anon/i);
  assert.match(reviewMigration,/interval '10 minutes'/i);
  assert.match(reviewMigration,/'screenTime', coalesce\(v_link\.snapshot->'screenTime'/);
  assert.doesNotMatch(reviewMigration,/'location', v_link\.snapshot|\bhealth\b.*v_link\.snapshot/i);
  assert.doesNotMatch(reviewMigration,/returns[\s\S]{0,240}owner_secret|returns[\s\S]{0,240}device_secret/i);
});

test('ordinary controller deletion requires the owner secret and cascades server data',()=>{
  assert.match(controllerMigration,/security definer/i);
  assert.match(controllerMigration,/phone_companion_owner_ok\(v_target, p_owner_secret\)/);
  assert.match(controllerMigration,/delete from public\.phone_companion_links/);
  assert.match(controllerMigration,/owner_secret_hash = public\.phone_companion_hash\(p_owner_secret\)/);
  assert.match(controllerMigration,/revoke all on function public\.phone_companion_delete_controller\(text, text\)[\s\S]*from public, anon/i);
  assert.match(controllerMigration,/grant execute on function public\.phone_companion_delete_controller\(text, text\)[\s\S]*to anon, authenticated/i);
});

test('public North visibly identifies role remote management for ordinary users',()=>{
  assert.match(swift,/Label\("角色远程管理", systemImage:/);
  assert.match(swift,/navigationTitle\("角色远程管理"\)/);
  assert.match(swift,/north-support\.html\?role-controller=1/);
  for(const phrase of ['查看、锁定、解锁和每日限额命令','打开角色控制台','填写角色名称','控制端恢复文件']){
    assert.match(swift,new RegExp(phrase));
  }
  assert.doesNotMatch(swift,/TestFlight|appStoreReceiptURL|isAppReview|reviewDevice|审核设备/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 8;/g)||[]).length,10);
  assert.doesNotMatch(project,/CURRENT_PROJECT_VERSION = [0-7];/);
  assert.match(project,/INFOPLIST_KEY_CFBundleDisplayName = North;/);
  assert.match(project,/PRODUCT_BUNDLE_IDENTIFIER = com\.qianyi\.PhoneCompanionTest;/);
});

test('review notes give permanent demo access and exact three-step test flow',()=>{
  assert.match(notes,/Permanent demo access/);
  assert.match(notes,/REVIEW_ACCOUNT_EMAIL/);
  assert.match(notes,/REVIEW_ACCOUNT_PASSWORD/);
  assert.match(notes,/No registration or role creation is required/);
  assert.match(notes,/1\. Open the Role Controller/);
  assert.match(notes,/2\. On the review iPhone/);
  assert.match(notes,/3\. Keep North open/);
});

test('remote daily limits replace the selected app state and refresh local management',()=>{
  assert.match(swift,/stableExternalID\(for: \$0\.token\) == externalID/);
  assert.match(swift,/persisted\.minutes == minutes/);
  assert.match(swift,/companionDailyLimitSettingsDidChange/);
  assert.match(swift,/本机存储读回确认/);
  assert.match(contentView,/reloadDailyLimitSettingsFromSharedDefaults\(\)/);
  assert.match(contentView,/NotificationCenter\.default\.publisher/);
  assert.match(contentView,/for: \.companionDailyLimitSettingsDidChange/);
});
