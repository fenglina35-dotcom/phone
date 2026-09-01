import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const projectRoot = path.join(root, 'native/private-small-phone/XcodeProject');
const bundle = path.join(projectRoot, 'PhoneCompanionTest/PhoneWeb.bundle');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');

test('private v1128 shell and both entry aliases are complete and identical', () => {
  const index = read(bundle, 'index.html');
  const alias = read(bundle, '小手机.html');
  assert.equal(index, alias);
  assert.match(index, /__NORTH_SHELL_BUILD__='1128'/);
  assert.match(index, /app\.js\?v=1128&r=v1128-backup-offline-failure-evidence-1/);
  assert.match(index, /private-runtime-diagnostics\.js\?v=260/);
  assert.doesNotMatch(index, /1127|private-runtime-diagnostics\.js\?v=259/);
});

test('private v1128 app includes chunked backup and offline failure evidence', () => {
  const app = read(bundle, 'app.js');
  for (const token of [
    "APP_VER='v1128 · 备份与线下回复修复版'",
    'async function privatePhoneAccountBackupUpload(',
    "privatePhoneAccountCall('account.backup.begin'",
    "privatePhoneAccountCall('account.backup.chunk'",
    "privatePhoneAccountCall('account.backup.commit'",
    'async function offlineReplyChatRequest(',
    'routeIndex=roleChatRouteIndex(c)',
    "kind:'request-failure'",
    '上一轮回复失败依据',
  ]) assert.ok(app.includes(token), token);
});

test('private iOS260 and bridge 25 identities are consistent', () => {
  const project = read(projectRoot, 'PhoneCompanionTest.xcodeproj', 'project.pbxproj');
  const webview = read(projectRoot, 'PhoneCompanionTest', 'LocalPhoneWebView.swift');
  const bridge = read(projectRoot, 'PhoneCompanionTest', 'PhoneNativeBridge.swift');
  assert.equal(project.match(/CURRENT_PROJECT_VERSION = 260;/g)?.length, 12);
  assert.equal(project.match(/MARKETING_VERSION = 1\.0\.260;/g)?.length, 12);
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 259;|MARKETING_VERSION = 1\.0\.259;/);
  assert.match(webview, /smallPhone\.webContentTerminationTimes\.v5\.build260/);
  assert.match(webview, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.260 \(260\)'/);
  assert.match(bridge, /contractVersion = 25/);
  assert.match(bridge, /private static let build = "1\.0\.260 \(260\)"/);
});

test('iOS260 guide preserves data and real-device verification boundaries', () => {
  const guide = read(projectRoot, '第二百六十次安装_v1128_备份与线下回复失败依据修复_请先读.md');
  assert.match(guide, /不要先删除手机上的小手机 App/);
  assert.match(guide, /Mac 编译、签名、覆盖安装和真实 iPhone 验收仍待完成/);
  assert.match(guide, /不删除、迁移或清空聊天、通话、真人好友、角色、图片/);
});
