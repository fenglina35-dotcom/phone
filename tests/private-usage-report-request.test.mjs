import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='native/private-small-phone/XcodeProject/';
const sync=fs.readFileSync(base+'PhoneCompanionTest/CompanionSyncView.swift','utf8');
function region(start,end){const a=sync.indexOf(start);assert(a>=0,start);const b=sync.indexOf(end,a+start.length);assert(b>a,end);return sync.slice(a,b);}
test('visible usage report refresh follows the persisted request, not a pre-request health refresh',()=>{
 const manual=region('private func requestLiveUsageAndSynchronize()', 'fileprivate struct CompanionSelectedApp');
 assert.doesNotMatch(manual,/reportFilterEnd\s*=/);
 assert.match(sync,/\.onReceive\(NotificationCenter\.default\.publisher\([\s\S]*?companionUsageReportRefreshRequested/);
 assert.match(sync,/\.id\(reportRefreshID\)/);
 const read=region('private func fetchTodayExtensionUsage()', 'private var sharedDefaults:');
 assert(read.indexOf('defaults.set(requestData')<read.indexOf('NotificationCenter.default.post'));
 assert.match(read,/"requestID": request\.requestID/);assert.match(read,/"requestedAt": request\.requestedAt/);
 assert.match(read,/shared\.requestID == request\.requestID/);assert.match(read,/shared\.generatedAt >= request\.requestedAt/);
});
test('parallel local and upload callers join a bounded usage read instead of replacing the request ID',()=>{
 const wrapper=region('private func fetchTodayDirectUsageWithTimeout()', 'private func performTodayUsageReadWithTimeout()');
 assert.match(wrapper,/if let usageReadTask/);assert.match(wrapper,/return await usageReadTask\.value/);
 assert.match(wrapper,/defer \{ usageReadTask = nil \}/);
 assert.match(sync,/private var usageReadTask: Task<UsageReadOutcome, Never>\?/);
 const read=region('private func performTodayUsageReadWithTimeout()', 'private func fetchTodayDirectUsage()');
 assert.match(read,/readTask\.cancel\(\)/);assert.match(read,/timeoutTask\.cancel\(\)/);
 assert.match(read,/continuation\.yield\(\.timedOut\)/);
});
test('missing report exposes metadata diagnostics, not an automatic permission reset or invented zero',()=>{
 assert.match(sync,/Button\("复制屏幕同步诊断"\)/);assert.match(sync,/usageReadDiagnosticText/);
 const read=region('private func fetchTodayExtensionUsage()', 'private var sharedDefaults:');
 assert.match(read,/snapshotState = "request-mismatch"/);assert.match(read,/snapshotState = "stale"/);
 assert.match(read,/snapshotState = "missing"/);assert.match(read,/snapshotState = "decode-failed"/);
 assert.doesNotMatch(read,/requestAuthorization|removeObject|clearAllSettings/);
 assert.match(read,/latestDirectUsageSnapshot = nil/);
});
test('September 8 report implementation and signed identifiers are not replaced by public North',()=>{
 for(const p of ['PhoneCompanionReport/TotalActivityReport.swift','PhoneCompanionReport/PhoneCompanionReport.entitlements','PhoneCompanionTest/PhoneCompanionTest.entitlements']){
  const old=execFileSync('git',['show','afe3b4cb:'+base+p],{encoding:'utf8'});
  // HomeKit was added to the main entitlement separately; compare the report and app-group identity.
  const current=fs.readFileSync(base+p,'utf8').replaceAll('\r\n','\n');
  if(!p.startsWith('PhoneCompanionTest/'))assert.equal(current,old.replaceAll('\r\n','\n'));
  else assert.match(current,/<string>group\.com\.qianyi\.PhoneCompanionTest<\/string>/);
 }
});
