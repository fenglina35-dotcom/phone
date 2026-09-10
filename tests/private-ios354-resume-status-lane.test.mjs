import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const app=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const index=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html');
const alias=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html');
const diagnostics=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-runtime-diagnostics.js');
const sync=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift');
const bridge=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
const webView=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
const project=read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
const publicApp=read('app.js');

function pollHarness(){
  const calls=[],state={};
  const context={
    S:{couple:{}},Date,document:{hidden:false},_couTab:1,
    _companionPollBusy:false,_companionPollAt:0,
    _companionPanelHealthPending:false,
    northNativeMaintenancePaused:()=>false,
    companionLocalNativeAvailable:()=>true,
    companionPollMinDelay:()=>0,
    companionState:()=>state,
    companionSnapshotPersistSignature:()=>'',
    companionNativeSnapshot:async focus=>{calls.push(focus);return state;},
    $:()=>null,cur:()=>({p:'home'})
  };
  const line=app.split(/\r?\n/).find(row=>row.startsWith('async function companionPollSnapshot('));
  assert.ok(line,'private poll function is present');
  vm.runInNewContext(line+';globalThis.poll=companionPollSnapshot;',context);
  return {context,calls};
}

test('private candidate is v1232 and iOS 355 while public remains v1232',()=>{
  assert.match(app,/APP_VER='v1232 · 共同生活回复等待修复'/);
  for(const html of [index,alias]){
    assert.match(html,/window\.__NORTH_SHELL_BUILD__='1232'/);
    assert.match(html,/app\.js\?v=1232&r=v1232-cohab-request-timeout-1/);
    assert.match(html,/private-runtime-diagnostics\.js\?v=335/);
  }
  assert.match(diagnostics,/OVERLAY_VERSION='335-resume-status-lane'/);
  assert.match(webView,/1\.0\.355 \(355\)/);
  assert.match(bridge,/private static let build = "1\.0\.355 \(355\)"/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 355;/g)||[]).length,12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.355;/g)||[]).length,12);
  assert.match(publicApp,/APP_VER='v1232 · 共同生活回复等待修复'/);
});

test('ordinary foreground polling is lightweight while explicit control verification stays complete',async()=>{
  const {context,calls}=pollHarness();
  await context.poll(false);
  context._companionPollAt=0;
  await context.poll(true);
  assert.deepEqual(calls,['状态','控制状态']);
});

test('native passive status bypasses MainActor token limit and footprint reconstruction',()=>{
  const start=sync.indexOf('func localSnapshot(');
  const helper=sync.indexOf('private func makePassiveStatusSnapshot(',start);
  const after=sync.indexOf('private func ',helper+'private func '.length);
  assert.ok(start>=0&&helper>start&&after>helper);
  const local=sync.slice(start,helper),passive=sync.slice(helper,after);
  assert.match(local,/if focus == "状态"[\s\S]{0,180}return makePassiveStatusSnapshot/);
  assert.ok(local.indexOf('if focus == "状态"')<local.indexOf('let normalized = focus.lowercased()'));
  assert.match(local,/let normalized = focus\.lowercased\(\)[\s\S]*?makeSnapshot\(/,
    'named owner and role reads retain the complete snapshot path');
  assert.match(passive,/"controlOnly": true/);
  assert.match(passive,/"deviceTelemetry": telemetry/);
  assert.match(passive,/loadExplicitManualUnlockEvents\(\)/);
  assert.doesNotMatch(passive,/loadSelection\(|loadLimitSettings\(|stableExternalID\(|loadFreshTodayPoints\(|makeSnapshot\(/);
});

test('native diagnostics bracket every status snapshot without recording private content',()=>{
  const start=bridge.indexOf('private func performLocalDeviceSnapshot(');
  const end=bridge.indexOf('private func performLocalDeviceCommand(',start);
  const source=bridge.slice(start,end);
  assert.match(source,/native\.deviceSnapshot\.begin/);
  assert.match(source,/native\.deviceSnapshot\.end/);
  assert.match(source,/focusKind = "passive-status"/);
  assert.match(source,/focusKind = "control-status"/);
  assert.match(source,/Date\(\)\.timeIntervalSince\(startedAt\)/);
  assert.doesNotMatch(source,/snapshot\[|JSONSerialization|chat|message/i);
});
