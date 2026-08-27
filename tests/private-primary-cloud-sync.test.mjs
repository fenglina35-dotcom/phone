import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const web = fs.readFileSync(new URL('app.js', root), 'utf8');
const privateWeb = fs.readFileSync(new URL('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', root), 'utf8');

test('private primary snapshots carry source, monotonic revision, and capture time', () => {
  assert.match(web, /mode:PRIVATE_MIRROR_MODE,source:'private-ios',revision,capturedAt,updatedAt/);
  assert.match(web, /Math\.max\(localRevision,remoteMeta&&remoteMeta\.revision\|\|0\)\+1/);
  assert.match(web, /sourceBuild:String\(window\.__SMALL_PHONE_PRIVATE_BUILD__\|\|APP_VER\)/);
});

test('web mirror refuses to push over a private primary record', () => {
  assert.match(web, /当前云ID由私人版本主设备管理；网页仅作镜像，不能反向覆盖私人数据/);
  assert.match(web, /const current=await cloudFetchRow\(\)\.catch\(\(\)=>null\);if\(current\)return/);
  assert.match(web, /method='PATCH'/);
  assert.match(web, /updated_at=eq\./);
  assert.match(web, /云端修订已变化，本次没有覆盖/);
});

test('first binding and concurrent web edits never silently overwrite', () => {
  assert.match(web, /if\(!applied\)return recoveryStateMeaningful\(recoveryStateStats\(S\)\)/);
  assert.match(web, /privateMirrorConflictModal\(\{data:row\.data,row,meta\},!applied\)/);
  assert.match(web, /系统没有静默覆盖任何一端/);
  assert.match(web, /暂留网页本机/);
  assert.match(web, /PRIVATE_MIRROR_ROLLBACK_KEY/);
  assert.match(web, /privateMirrorRestoreRollback/);
});

test('web only applies a newer private revision and persists the applied revision', () => {
  assert.match(web, /if\(meta\.revision<=applied\)return \{current:true,meta\}/);
  assert.match(web, /privateMirrorAppliedRevision:meta\.revision/);
  assert.match(web, /privateMirrorAppliedAt:Date\.now\(\)/);
  assert.match(web, /window\.addEventListener\('pageshow',privatePrimaryMirrorWake\)/);
  assert.match(web, /document\.addEventListener\('visibilitychange'.*privatePrimaryMirrorWake/s);
});

test('legacy cloud ids remain restorable and media limitations are explicit', () => {
  assert.match(web, /async function cloudRestore\(idOverride\)/);
  assert.match(web, /targetId=idOverride\|\|cloudId\(\)/);
  assert.match(web, /输入旧云ID兼容恢复/);
  assert.match(web, /原生大视频和系统媒体原文件不在网页镜像范围内/);
});

test('private account backup also publishes the private-primary mirror', () => {
  assert.match(web, /source:'private-ios',revision:/);
  assert.match(web, /const mirror=await privatePrimaryMirrorUpload\(snapshot\)/);
  assert.match(web, /privateMirrorLastUploadedAt/);
  assert.match(web, /mirrorReady=!cloudUrl\(\)\|\|!cloudKey\(\)/);
});

test('manual private publish can replace a legacy web snapshot only after the explicit private action', () => {
  assert.match(web, /privatePrimaryMirrorUpload\(snapshot,\{allowLegacy:true\}\)/);
  assert.match(web, /一键同步到网页版/);
});

test('private restore is hard-routed to the phone account backup and cannot read a web snapshot', () => {
  assert.match(web, /async function cloudRestore\(idOverride\)\{if\(privateNativeAppOn\(\)\)throw new Error\('私人 App 禁止读取网页快照；请使用手机号私人备份恢复'\)/);
  assert.match(web, /async function cloudDoRestore\(\)\{if\(privateNativeAppOn\(\)\)\{privatePhoneCloudRestoreOpen\(\);return;\}return privateMirrorPullNow\(\);\}/);
  assert.match(web, /native\?'<div class="hint">私人 App 只允许恢复手机号私人备份，不提供网页旧快照恢复入口。<\/div>':'<button class="btn g" style="width:100%" onclick="cloudUseOtherId\(\)">输入旧云ID兼容恢复<\/button>'/);
});

test('web pull accepts both private mirrors and original web backups without overwriting either', () => {
  assert.match(web, /const row=await cloudFetchRow\(\),meta=row&&privateMirrorMeta\(row\.data,row\)/);
  assert.match(web, /privateMirrorApplyRemote\(row\.data,row,true\)/);
  assert.match(web, /cloudApplyLegacyRow\(row\.data,row,cloudId\(\)\)/);
  assert.match(web, /privateMirrorSaveRollback\('manual-web-cloud-restore'\)/);
  assert.match(web, /网页已读取原有云备份；读取前快照可撤回/);
  assert.doesNotMatch(web, /云端仍是旧网页备份，请先在私人 App 点“一键同步到网页版”/);
});

test('web automatic sync never overwrites an existing legacy cloud backup before manual reading', () => {
  assert.match(web, /const current=await cloudFetchRow\(\)\.catch\(\(\)=>null\);if\(current\)return;cloudBackup\(\)\.catch/);
});

test('web and private bundle keep cloud mirror implementation identical', () => {
  const block = source => source.slice(source.indexOf("const PRIVATE_MIRROR_MODE="), source.indexOf('/* ---------- 存储用量 ---------- */'));
  assert.ok(block(web).length > 5000);
  assert.equal(block(privateWeb), block(web));
});
