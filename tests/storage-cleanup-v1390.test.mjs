import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// v1390 删掉的消息/通话留下的语音（__audio_）以前永远不删；临时文件夹里音乐视频播放副本一直累积。
const bridge = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url), 'utf8');
const files = [['web', '../app.js'], ['private', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']];

for (const [label, path] of files) {
  const app = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  test(label + ': orphan voice audio is collected only when nothing references it', () => {
    const gc = app.slice(app.indexOf('async function audioOrphanGC('), app.indexOf('function clearStoreVoiceAudio('));
    assert.match(gc, /try\{scan\(JSON\.stringify\(S\)\);\}catch\(_\)\{return \{n:0,failed:true\};\}/, 'gives up if the live data cannot be read');
    assert.match(gc, /\/\^__\(\?:messages\|pf_messages\|pf_group_messages\)\/\.test\(k\)\)\)\{try\{scan\(await imgGetIDB\(k\)\);\}catch\(_\)\{return \{n:0,failed:true\};\}\}/, 'long chat archives are scanned too');
    assert.match(gc, /if\(at&&now-at<600000\)continue;/, 'audio written in the last 10 minutes is kept');
    assert.match(app, /function imgPutIDBWithRetry\(k,v\)\{if\(String\(k\)\.indexOf\('__audio_'\)===0\)_audioPutAt\.set\(String\(k\),Date\.now\(\)\);/);
    assert.match(app, /let orphan=\{n:0\};try\{orphan=await audioOrphanGC\(\);\}catch\(_\)\{\}/, 'runs from the manual cleanup only');
  });
  test(label + ': temp files are cleaned after launch and by a button', () => {
    assert.match(app, /window\.SmallPhoneNative\.request\('storage\.clearTemp',\{olderThan:manual\?600:3600\}\)/);
    assert.match(app, /setTimeout\(\(\)=>\{try\{if\(typeof privateNativeAppOn==='function'&&privateNativeAppOn\(\)\)privateClearTemp\(false\);\}catch\(_\)\{\}\},45000\)/);
    assert.match(app, /onclick="privateClearTemp\(true\)">清理临时文件/);
  });
}

test('native temp cleanup only removes old files and skips the backup staging folder', () => {
  assert.match(bridge, /case "storage\.clearTemp":[^]*?let olderThan = max\(600,/);
  const fn = bridge.slice(bridge.indexOf('nonisolated private static func nativeClearTemporaryFiles('), bridge.indexOf('/// Clears only WebKit HTTP caches.'));
  assert.match(fn, /at: fileManager\.temporaryDirectory/);
  assert.match(fn, /if file\.path\.contains\("\/NorthPrivateBackupStaging\/"\) \{ continue \}/);
  assert.match(fn, /modified < cutoff else \{ continue \}/);
});
