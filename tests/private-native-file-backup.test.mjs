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

test('private v1242 loads daily backup after the diagnostic overlay while public remains v1244',()=>{
  for(const name of ['index.html','小手机.html']){
    const html=read(bundle+name);
    assert.match(html,/window\.__NORTH_SHELL_BUILD__='1242'/);
    assert.ok(html.indexOf('private-cloud-backup.js?v=1242')>html.indexOf('private-runtime-diagnostics.js?v=336'));
  }
  assert.match(privateApp,/APP_VER='v1242 · 私人大存档备份流畅修复'/);
  assert.match(publicApp,/APP_VER='v1244 · 导入后内存卡顿修复'/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 356;/g)||[]).length,12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.356;/g)||[]).length,12);
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

test('native bridge streams one account-bound backup file and confirms the RPC result',()=>{
  for(const action of ['begin','chunk','commit','abort'])assert.match(bridge,new RegExp(`account\\.backup\\.file\\.${action}`));
  assert.match(bridge,/static let contractVersion = 38/);
  assert.match(bridge,/private actor PrivateBackupFileStore/);
  assert.match(bridge,/offset == current\.written/);
  assert.match(bridge,/current\.owner == owner/);
  assert.match(bridge,/data\.count <= 262144/);
  assert.match(bridge,/current\.written == current\.size/);
  assert.match(bridge,/uploader\.upload\(for: request, fromFile: file\.url\)/);
  assert.match(bridge,/config\.timeoutIntervalForRequest = 180/);
  assert.match(bridge,/config\.timeoutIntervalForResource = 600/);
  assert.match(bridge,/status >= 200 && status < 300 && rows\?\.first\?\["saved"\] as\? Bool == true/);
  assert.match(bridge,/await PrivateBackupFileStore\.shared\.remove\(token: token\)/);
  assert.match(webView,/action === 'account\.backup\.file\.commit' \? 660000 : 60000/);
});
