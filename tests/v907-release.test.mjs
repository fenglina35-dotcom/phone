import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('小手机.html');
const pet = read('pet-game.js');
const petCss = read('pet-game.css');
const edge = read('supabase/functions/phone-role-push/index.ts');
const migration = read('supabase/migrations/202608130001_background_app_watch_test.sql');
const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const nativeWeb = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');

test('v1026 web source keeps private 1.0.147 compatibility', () => {
  assert.match(app, /APP_VER='v1026 · 手机验证重复绑定修复'/);
  assert.match(html, /app\.js\?v=1026/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 147;/);
  assert.match(project, /MARKETING_VERSION = 1\.0\.147;/);
  assert.match(nativeWeb, /1\.0\.147 \(147\)/);
});

test('Apple compatibility alone moves call identity and mood updates live', () => {
  assert.match(html, /north-apple-remote-safe \.callscreen:not\(\.mini\) \.cname/);
  assert.match(html, /north-apple-remote-safe \.callscreen:not\(\.mini\) \.cstat\{transform:translateY\(8px\)\}/);
  assert.match(app, /function refreshChatMood\(id\)/);
  assert.match(app, /id="chatMoodBar"/);
  assert.match(app, /appendChatHTML\(cb,html,opt\|\|\{\}\);refreshChatMood\(id\)/);
});

test('pet family supports four members, forward-only growth, sickness and medicine', () => {
  assert.match(pet, /const PET_MAX=4/);
  assert.match(pet, /function petThinFactor\(\)\{return 1;\}/);
  assert.doesNotMatch(pet, /unfed>=2\*PET_DAY/);
  assert.match(pet, /highestNaturalStage/);
  assert.match(pet, /unfed>3\*PET_DAY/);
  assert.match(pet, /pet-sick-bubble/);
  assert.match(pet, /function petBuyMedicine\(\)/);
  assert.match(pet, /function petUseMedicine\(\)/);
  assert.match(pet, /x\.pets\.length<PET_MAX/);
  assert.match(petCss, /pet-sick-card/);
});

test('background tests expose failures and app test is durable', () => {
  assert.match(app, /function roleBackgroundPreflight\(id,needWatch\)/);
  assert.match(app, /Date\.now\(\)\+60000,_roleBackgroundPending\[id\]\.baseline/);
  assert.doesNotMatch(app, /roleAppWatchImmediateTest\('\$\{id\}'\)/);
  assert.doesNotMatch(app, /roleAppWatchImmediateTest|'app_watch_test'.*Date\.now\(\)\+60000/s);
  assert.match(migration, /'app_watch_test'/);
  assert.match(edge, /task\.kind === "app_watch_test"/);
  assert.match(edge, /Date\.now\(\) \+ 5 \* 60_000/);
});
