import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const prefix='native/private-small-phone/XcodeProject/';
const bundle=prefix+'PhoneCompanionTest/PhoneWeb.bundle/';
const bridge=read(prefix+'PhoneCompanionTest/PhoneNativeBridge.swift');
const webView=read(prefix+'PhoneCompanionTest/LocalPhoneWebView.swift');
const project=read(prefix+'PhoneCompanionTest.xcodeproj/project.pbxproj');
const backup=read(bundle+'private-cloud-backup.js');
const privateApp=read(bundle+'app.js');
const publicApp=read('app.js');

test('private v1313 loads daily backup after the diagnostic overlay while public advances independently',()=>{
  for(const name of ['index.html','小手机.html']){
    const html=read(bundle+name);
    assert.match(html,/window\.__NORTH_SHELL_BUILD__='1313'/);
    assert.ok(html.indexOf('private-cloud-backup.js?v=1313')>html.indexOf('private-runtime-diagnostics.js?v=339'));
  }
  assert.match(privateApp,/APP_VER='v1313 · 短信效果听她的、多选删除、一键清空、记仇本真的记（私人）'/);
  assert.match(publicApp,/APP_VER='v1312 · 短信效果听她的、多选删除、一键清空、记仇本真的记'/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 390;/g)||[]).length,12);
  assert.equal((project.match(/MARKETING_VERSION = 1.0.390;/g)||[]).length,12);
});

test('web backup sends bounded ordered chunks and records a day only after confirmed save',()=>{
  assert.match(backup,/const CHUNK=192\*1024/);
  assert.match(backup,/account\.backup\.file\.begin/);
  assert.match(backup,/blob\.slice\(offset,offset\+CHUNK\)\.arrayBuffer\(\)/);
  assert.match(backup,/account\.backup\.file\.chunk/);
  assert.match(backup,/account\.backup\.file\.commit/);
  assert.match(backup,/account\.backup\.file\.abort/);
  assert.ok(backup.indexOf('if(!result.saved)')<backup.indexOf('write({allowed:true,lastDay:day()'));
  assert.match(backup,/recoveryStateMeaningful\(recoveryStateStats\(S\)\)/);
  assert.match(backup,/cloudAt>\(local\.capturedAt\|\|0\)\+1/);
  assert.match(backup,/document\.hidden/);
  assert.match(backup,/Date\.now\(\)-_privatePhoneLastInteractionAt<90000/);
});

test('native bridge persists account-bound backup chunks and confirms a small manifest',()=>{
  for(const action of ['begin','chunk','commit','abort'])assert.match(bridge,new RegExp(`account\\.backup\\.file\\.${action}`));
  assert.match(bridge,/static let contractVersion = 41/);
  assert.match(bridge,/private actor PrivateBackupFileStore/);
  assert.match(bridge,/offset == current\.written/);
  assert.match(bridge,/current\.owner == owner/);
  assert.match(bridge,/data\.count <= 262144/);
  assert.match(bridge,/current\.written == current\.size/);
  assert.match(bridge,/privateBackupChunkBytes = 4 \* 1_024 \* 1_024/);
  assert.match(bridge,/PrivateBackupUploadProgressDelegate/);
  assert.match(bridge,/account\.backup\.file\.progress/);
  assert.match(bridge,/\/storage\/v1\/object\//);
  assert.match(bridge,/from: part/);
  assert.match(bridge,/save_private_phone_backup_manifest/);
  assert.match(bridge,/private_phone_backup_files/);
  assert.match(bridge,/restorePrivateBackupFile/);
  assert.match(bridge,/actualChecksum == expectedChecksum/);
  assert.doesNotMatch(bridge,/Data\("\{\\"p_payload\\":"\.utf8\)/);
  assert.match(bridge,/backup_upload_timeout/);
  assert.match(bridge,/backup_storage_failed/);
  assert.match(bridge,/nativeError\.domain == "PrivateBackupStorage"/);
  assert.match(bridge,/nativeError\.domain == "PrivateBackupManifest"/);
  assert.match(backup,/正在上传私人云备份/);
  assert.match(bridge,/config\.timeoutIntervalForRequest = 180/);
  assert.match(bridge,/config\.timeoutIntervalForResource = 600/);
  assert.match(bridge,/row\?\["saved"\] as\? Bool == true/);
  assert.match(bridge,/await PrivateBackupFileStore\.shared\.remove\(token: token\)/);
  assert.match(webView,/action === 'account\.backup\.file\.commit' \? 1800000 : 60000/);
  assert.match(backup,/account\.backup\.file\.commit',\{token\},1920000/);
});
