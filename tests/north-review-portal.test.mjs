import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../north-role-controller.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../north-role-controller.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/202608210001_north_review_portal.sql',import.meta.url),'utf8');
const swift=readFileSync(new URL('../native/public-north-review/PhoneCompanionTest/PhoneCompanionTest/CompanionSyncView.swift',import.meta.url),'utf8');
const project=readFileSync(new URL('../native/public-north-review/PhoneCompanionTest/PhoneCompanionTest.xcodeproj/project.pbxproj',import.meta.url),'utf8');
const notes=readFileSync(new URL('../docs/north-app-review-notes-template.md',import.meta.url),'utf8');

test('review portal requires a login and contains no embedded reviewer credentials',()=>{
  assert.match(html,/登录测试角色/);
  assert.doesNotMatch(html,/type="email"[^>]*\bvalue=/i);
  assert.match(html,/type="password"/i);
  assert.doesNotMatch(html,/REVIEW_ACCOUNT_EMAIL|REVIEW_ACCOUNT_PASSWORD/);
  assert.doesNotMatch(js,/service[_-]?role|ownerSecret|deviceSecret|pair_secret|@(?:icloud|gmail|outlook|qq)\./i);
  assert.match(js,/auth\/v1\/token\?grant_type=password/);
  assert.doesNotMatch(js,/localStorage|sessionStorage/);
});

test('review RPCs are auth-bound and never expose location, health, or long-lived secrets',()=>{
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/grant execute on function public\.phone_companion_review_session\(\) to authenticated/i);
  assert.match(migration,/grant execute on function public\.phone_companion_review_begin_pairing\(\) to authenticated/i);
  assert.match(migration,/grant execute on function public\.phone_companion_review_enqueue_command\(text, text, integer\) to authenticated/i);
  assert.match(migration,/interval '10 minutes'/i);
  assert.match(migration,/'screenTime', coalesce\(v_link\.snapshot->'screenTime'/);
  assert.doesNotMatch(migration,/'location', v_link\.snapshot|\bhealth\b.*v_link\.snapshot/i);
  assert.doesNotMatch(migration,/returns[\s\S]{0,240}owner_secret|returns[\s\S]{0,240}device_secret/i);
});

test('public North visibly identifies role remote management without review-device hiding',()=>{
  assert.match(swift,/Label\("角色远程管理", systemImage:/);
  assert.match(swift,/navigationTitle\("角色远程管理"\)/);
  assert.match(swift,/north-support\.html\?role-controller=1/);
  for(const phrase of ['查看、锁定、解锁和每日限额命令','打开角色控制台','测试角色已预先创建']){
    assert.match(swift,new RegExp(phrase));
  }
  assert.doesNotMatch(swift,/TestFlight|appStoreReceiptURL|isAppReview|reviewDevice|审核设备/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 5;/g)||[]).length,10);
  assert.doesNotMatch(project,/CURRENT_PROJECT_VERSION = [0-4];/);
  assert.match(project,/INFOPLIST_KEY_CFBundleDisplayName = North;/);
  assert.match(project,/PRODUCT_BUNDLE_IDENTIFIER = com\.qianyi\.PhoneCompanionTest;/);
});

test('review notes give complete access and exact three-step test flow',()=>{
  assert.match(notes,/Permanent demo access/);
  assert.match(notes,/REVIEW_ACCOUNT_EMAIL/);
  assert.match(notes,/REVIEW_ACCOUNT_PASSWORD/);
  assert.match(notes,/No registration or role creation is required/);
  assert.match(notes,/1\. Open the Role Controller/);
  assert.match(notes,/2\. On the review iPhone/);
  assert.match(notes,/3\. Keep North open/);
});
