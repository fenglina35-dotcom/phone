import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const project = path.join(root, 'native/private-small-phone/XcodeProject');
const source = path.join(project, 'PhoneCompanionTest');
const bundle = path.join(source, 'PhoneWeb.bundle');
const app = fs.readFileSync(path.join(bundle, 'app.js'), 'utf8');
const heartQuiz = fs.readFileSync(path.join(bundle, 'heart-quiz.js'), 'utf8');
const overlay = fs.readFileSync(path.join(bundle, 'private-runtime-diagnostics.js'), 'utf8');
const index = fs.readFileSync(path.join(bundle, 'index.html'), 'utf8');
const alias = fs.readFileSync(path.join(bundle, '小手机.html'), 'utf8');
const bridge = fs.readFileSync(path.join(source, 'PhoneNativeBridge.swift'), 'utf8');
const webview = fs.readFileSync(path.join(source, 'LocalPhoneWebView.swift'), 'utf8');
const pbx = fs.readFileSync(path.join(project, 'PhoneCompanionTest.xcodeproj/project.pbxproj'), 'utf8');
const publicApp = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const publicEntry = fs.readFileSync(path.join(root, '小手机.html'), 'utf8');

function functionSource(sourceText, name) {
  const marker = `function ${name}(`;
  let start = sourceText.indexOf(marker);
  assert.ok(start >= 0, `${name} exists`);
  if (sourceText.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
  const bodyStart = sourceText.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return sourceText.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('v1189 private identifiers retain the performance chain while public stays v1184', () => {
  assert.equal(index, alias);
  assert.match(index, /window\.__NORTH_SHELL_BUILD__='1190'/);
  assert.match(index, /app\.js\?v=1190&r=v1190-couple-watch-1/);
  assert.match(index, /private-runtime-diagnostics\.js\?v=316/);
  assert.match(app, /APP_VER='v1190 · 情侣空间聊天与软件监管版'/);
  assert.match(overlay, /316-couple-watch-1/);
  assert.match(webview, /1\.0\.316 \(316\)/);
  assert.match(bridge, /private static let build = "1\.0\.316 \(316\)"/);
  assert.match(bridge, /static let contractVersion = 35/);
  assert.equal((pbx.match(/CURRENT_PROJECT_VERSION = 316;/g) || []).length, 12);
  assert.equal((pbx.match(/MARKETING_VERSION = 1\.0\.316;/g) || []).length, 12);
  assert.match(publicApp, /APP_VER='v1191 · 情侣空间监管触发修复版'/);
  assert.match(publicEntry, /window\.__NORTH_SHELL_BUILD__='1191'/);
  assert.doesNotMatch(publicApp, /licenseManagedIdentitySyncPlan/);
});

test('latest private features remain present after performance repair', () => {
  for (const token of [
    'function cohabRepairRows',
    'function xForgetTweet',
    'function roleStaleRecentReferenceIssue',
    'function alarmPendingDuplicate',
  ]) assert.ok(app.includes(token), token);
  assert.match(heartQuiz, /async function heartQuizGenerate\(c,g\)/);
  assert.match(heartQuiz, /while\(out\.length<HEART_QUIZ_TOTAL&&batch<12\)/);
  assert.match(heartQuiz, /while\(out\.length<HEART_QUIZ_TOTAL&&single<singleLimit/);
  assert.match(heartQuiz, /heartQuizTextRows/);
});

test('friend sync yields, caches payload parsing and reconciles touched buckets', () => {
  const sync = functionSource(app, 'phoneFriendSync');
  assert.match(app, /const _pfPayloadCache=typeof WeakMap/);
  assert.match(app, /function pfSyncMaybeYield\(index\)/);
  assert.match(app, /function pfStoreMessage\(m,bulk\)/);
  assert.match(app, /function pfStoreGroupMessage\(m,bulk\)/);
  assert.match(sync, /pfStoreMessage\(m,bulk\)/);
  assert.match(sync, /pfStoreGroupMessage\(m,bulk\)/);
  assert.match(sync, /pfSyncMaybeYield\(i\+1\)/);
  assert.match(sync, /pfReconcileReadInference\(full\?null:bulk\.friendTouched,full\?null:bulk\.groupTouched/);
  assert.doesNotMatch(sync, /srvMsgs\.forEach|srvGroupMsgs\.forEach/);
  assert.doesNotMatch(sync, /_pfPayloadCache=/);
  assert.match(app, /function phoneFriendMaybeSync\(force\)[\s\S]{0,260}?northNativeMaintenancePaused\(\)/);
  assert.doesNotMatch(functionSource(app, 'phoneFriendMaybeSync'), /!active/);
});

test('automatic license work is delayed and unchanged identities are skipped', () => {
  const plan = functionSource(app, 'licenseManagedIdentitySyncPlan');
  const check = functionSource(app, 'licenseCheckSession');
  const managed = functionSource(app, 'licenseSyncManagedIdentities');
  assert.match(plan, /north_license_ai_sync_v2/);
  assert.match(plan, /north_license_phone_friend_sync_v1/);
  assert.match(plan, /'identity-changed':'already-synced'/);
  assert.match(check, /licenseScheduleManagedIdentitySync\(1800,'post-check'\)/);
  assert.doesNotMatch(check, /await licenseSyncAiIdentity/);
  assert.match(managed, /if\(plan\.aiNeeded\)/);
  assert.match(managed, /if\(plan\.phoneFriendNeeded\)/);
  assert.match(app, /LICENSE_CHECK_STARTUP_DELAY_MS=12000/);
  assert.match(app, /licenseScheduleCheck\(LICENSE_CHECK_STARTUP_DELAY_MS,'boot'\)/);
});

test('native license transport leaves the main actor until its bounded reply', () => {
  const start = bridge.indexOf('private func performLicenseRequest(');
  const end = bridge.indexOf('private struct PrivateAccountSession', start);
  const request = bridge.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(request, /URLSession\.shared\.dataTask\(with: request\)/);
  assert.doesNotMatch(request, /try await URLSession\.shared\.data\(for: request\)/);
  assert.match(request, /Task \{ @MainActor \[weak self\] in/);
  for (const event of [
    'native.license.request.begin',
    'native.license.request.networkEnd',
    'native.license.request.decodeEnd',
    'native.license.request.replyDispatched',
    'native.license.request.replyCompleted',
  ]) assert.ok(request.includes(event), event);
});

test('terminated WebContent remounts a fresh view and invalidates stale probes', () => {
  const start = webview.indexOf('func webViewWebContentProcessDidTerminate');
  const end = webview.indexOf('        func webView(', start + 1);
  const terminated = webview.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(terminated, /responsivenessProbeToken \+= 1/);
  assert.match(terminated, /cancelAutomaticWebContentRecovery\(\)/);
  assert.match(terminated, /native\.webcontent\.remountScheduled/);
  assert.match(terminated, /native\.webcontent\.remountStarted/);
  assert.match(terminated, /onRecoveryRestartReady\(false\)/);
  assert.doesNotMatch(terminated, /webView\.loadFileURL/);
  assert.match(webview, /private func cancelAutomaticWebContentRecovery\(\)/);
});

test('diagnostics identify the protected stage without collecting content', () => {
  assert.match(overlay, /window\.__smallPhonePhoneFriendSyncTrace=function/);
  assert.match(overlay, /window\.__smallPhoneLicenseIdentityTrace=function/);
  assert.match(overlay, /slow\.\+'\+name\+'\.sync|slow\.'\+name\+'\.sync/);
  assert.match(overlay, /lastOp:recent\.lastOp/);
  assert.match(overlay, /Object\.keys\(src\)\.slice\(0,8\)/);
  assert.doesNotMatch(overlay, /messageBody|chatContent|authorizationToken/);
});

test('Mac guides state the private v1189 and unchanged public web v1184 boundary', () => {
  const install = fs.readFileSync(
    path.join(project, '第三百一十六次安装_v1190_情侣空间监管_请先读.md'),
    'utf8',
  );
  const mac = fs.readFileSync(path.join(project, '请在Mac编译前先读.md'), 'utf8');
  for (const guide of [install, mac]) {
    assert.match(guide, /v1190/);
    assert.match(guide, /网页不推送/);
    assert.match(guide, /1\.0\.316 \(316\)/);
    assert.match(guide, /原生桥.*35/);
    assert.match(guide, /不要先删除.*App/);
    assert.match(guide, /不要.*覆盖.*旧工程目录/);
    assert.match(guide, /Mac.*编译/);
    assert.match(guide, /真机|真实 iPhone/);
  }
  assert.match(mac, /当前候选：网页源码与私人内置网页 v1190/);
  assert.match(mac, /网页不推送/);
  assert.match(install, /网页源码与私人内置网页均为 v1190/);
  assert.match(install, /两边共有/);
});
