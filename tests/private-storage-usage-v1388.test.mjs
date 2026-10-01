import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// v1388 私人 App 存储明细：原生量 App 里各文件夹大小（只读文件信息，不读内容），音乐/放映室只读文件大小，图片聊天语音只数个数；可一键清理网页缓存。
const bridge = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url), 'utf8');
const priv = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');
const web = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('native measures folder sizes off the main thread and clears only HTTP caches', () => {
  assert.match(bridge, /case "storage\.usage":\n\s*performStorageUsage\(requestID: requestID\)/);
  assert.match(bridge, /case "storage\.clearWebCache":\n\s*performClearWebCache\(requestID: requestID\)/);
  assert.match(bridge, /DispatchQueue\.global\(qos: \.utility\)\.async \{\n\s*let result = Self\.nativeContainerUsage\(\)/);
  assert.match(bridge, /nonisolated private static func nativeFolderBytes\(_ url: URL\) -> Int64/);
  assert.match(bridge, /"webkitBytes": nativeFolderBytes\(library\.appendingPathComponent\("WebKit"/);
  const clear = bridge.slice(bridge.indexOf('private func performClearWebCache('), bridge.indexOf('nonisolated private func nativeStorageDataWithRecovery('));
  assert.match(clear, /WKWebsiteDataTypeDiskCache,\n\s*WKWebsiteDataTypeMemoryCache,\n\s*WKWebsiteDataTypeFetchCache/);
  assert.doesNotMatch(clear, /IndexedDB|LocalStorage|removeItem/, 'chats, pictures and the archive are never touched');
});

for (const [label, app] of [['private', priv], ['web', web]]) {
  test(label + ': the breakdown lists media separately and offers the cache cleanup', () => {
    assert.match(app, /\.\.\.privateUsageRows\(parts,total\),/);
    assert.match(app, /'图片 · 聊天 · 语音',rest,'约 '\+\(n\.images\|\|0\)\+' 张图片/);
    assert.match(app, /onclick="privateClearWebCache\(\)">清理网页缓存（\$\{storageSizeLabel\(pu\.cachesBytes\)\}）/);
    assert.match(app, /window\.SmallPhoneNative\.request\('storage\.clearWebCache'\)/);
    assert.match(app, /上面这根条是整台手机的存储用量，不是小手机自己的/);
  });
}
