import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const privateProject = path.resolve(
  import.meta.dirname,
  '../native/private-small-phone/XcodeProject/PhoneCompanionTest'
);
const readPrivate = relative => fs.readFileSync(
  path.join(privateProject, relative),
  'utf8'
);

// This regression intentionally reads only the private iOS runtime. Public
// web entrypoints are outside its evidence boundary.
const app = readPrivate('PhoneWeb.bundle/app.js');
const overlay = readPrivate('PhoneWeb.bundle/private-runtime-diagnostics.js');
const webView = readPrivate('LocalPhoneWebView.swift');
const bridge = readPrivate('PhoneNativeBridge.swift').replace(/\r\n/g, '\n');
const rootView = readPrivate('SmallPhonePrivateRootView.swift');

function functionSource(source, name) {
  const functionStart = source.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `missing function ${name}`);
  const asyncStart = source.lastIndexOf('async ', functionStart);
  const start = asyncStart >= 0 && asyncStart + 6 === functionStart
    ? asyncStart
    : functionStart;
  let depth = 0;
  let quote = '';
  let escaped = false;
  let opened = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      opened = true;
    } else if (ch === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

function between(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0, `missing start token: ${startToken}`);
  assert.ok(end > start, `missing end token: ${endToken}`);
  return source.slice(start, end);
}

function makeAutoBackupHarness() {
  const calls = {
    cleared: [],
    timers: [],
    originalAuto: 0,
    originalBackups: [],
    account: [],
    diagnostics: [],
    modals: []
  };
  let now = 1_787_520_000_000;
  const context = vm.createContext({
    calls,
    Date: class extends Date {
      static now() { return now; }
    },
    Math,
    Map,
    Number,
    Object,
    Promise,
    String,
    performance: { now: () => now },
    document: { hidden: false },
    clearTimeout(id) { calls.cleared.push(id); },
    setTimeout(callback, delay) {
      calls.timers.push({ callback, delay });
      return calls.timers.length;
    },
    openModal(html) { calls.modals.push(String(html)); },
    closeModal() {},
    toast() {},
    esc: value => String(value),
    privatePhoneAccountDate: value => String(value || ''),
    privatePhoneAccountBytes: value => String(value || 0),
    window: null
  });
  context.window = context;
  context.__SMALL_PHONE_PRIVATE__ = true;
  context.__smallPhoneNativeDiag = (event, fields, minGap) => {
    calls.diagnostics.push({ event, fields, minGap });
    return true;
  };

  vm.runInContext(`
    const PRIVATE_PHONE_AUTO_BACKUP_DELAY=30*60*1000;
    let _privatePhoneCloudDirtyAt=0,_privatePhoneCloudTimer=null;
    let S={_persistedAt:0,settings:{}};
    function privatePhoneAccountAvailable(){return true;}
    function privatePhoneCloudSchedule(delay){
      if(!privatePhoneAccountAvailable()||_privatePhoneCloudTimer)return;
      _privatePhoneCloudTimer=setTimeout(()=>{
        _privatePhoneCloudTimer=null;
        privatePhoneCloudAutoBackup();
      },Math.max(1000,+delay||PRIVATE_PHONE_AUTO_BACKUP_DELAY));
    }
    ${functionSource(app, 'privatePhoneCloudMarkDirty')}
    ${functionSource(app, 'privatePhoneCloudWake')}
    async function privatePhoneCloudAutoBackup(){calls.originalAuto++;return true;}
    async function privatePhoneCloudBackup(firstBind,silent){
      calls.originalBackups.push({firstBind,silent});
      return 'manual-uploaded';
    }
    async function privatePhoneAccountCall(action){
      calls.account.push(action);
      if(action==='account.backup.info')return {ok:true,found:false};
      return {ok:true};
    }
    ${functionSource(app, 'privatePhoneAccountAfterLogin')}
    globalThis.__testPrivateCloud={
      dirty:()=>_privatePhoneCloudDirtyAt,
      timer:()=>_privatePhoneCloudTimer,
      setTimer:value=>{_privatePhoneCloudTimer=value;},
      setPersisted:value=>{S._persistedAt=value;}
    };
  `, context);
  context.__testPrivateCloud.setTimer(41);
  vm.runInContext(overlay, context);
  return { context, calls, advance: ms => { now += ms; } };
}

test('private iOS 313 overlay owns the disable marker and cancels automatic scheduling', async () => {
  const { context, calls } = makeAutoBackupHarness();
  assert.equal(
    context.__SMALL_PHONE_PRIVATE_RUNTIME__,
    '313-private-v1187-v1179-keyboard-baseline-1'
  );
  assert.equal(context.__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__, true);
  assert.equal(context.__testPrivateCloud.timer(), null);
  assert.deepEqual(calls.cleared, [41]);

  context.__testPrivateCloud.setTimer(73);
  assert.equal(context.privatePhoneCloudSchedule(1000), false);
  assert.equal(context.__testPrivateCloud.timer(), null);
  assert.deepEqual(calls.cleared, [41, 73]);
  assert.equal(calls.timers.length, 1, 'only the one-shot native recovery handoff is scheduled');

  context.privatePhoneCloudMarkDirty(15_000);
  assert.equal(context.__testPrivateCloud.dirty(), 15_000);
  assert.equal(context.__testPrivateCloud.timer(), null);
  assert.equal(calls.timers.length, 1);

  context.__testPrivateCloud.setPersisted(18_000);
  context.privatePhoneCloudWake();
  assert.equal(context.__testPrivateCloud.dirty(), 18_000);
  assert.equal(context.__testPrivateCloud.timer(), null);
  assert.equal(calls.timers.length, 1);

  assert.equal(await context.privatePhoneCloudAutoBackup(), false);
  assert.equal(await context.privatePhoneCloudAutoBackup(), false);
  assert.equal(calls.originalAuto, 0);
  assert.equal(
    calls.diagnostics.filter(row => row.event === 'cloud.auto.blocked').length,
    1,
    'repeated blocked callbacks inside the minimum gap emit only once'
  );
});

test('empty first bind is blocked while explicit manual backup still reaches the original action', async () => {
  const { context, calls } = makeAutoBackupHarness();
  await context.privatePhoneAccountAfterLogin();
  assert.deepEqual(calls.account, ['account.backup.info']);
  assert.equal(calls.originalBackups.length, 0, 'empty cloud must not start a full backup');
  assert.match(calls.modals.at(-1) || '', /自动全量云备份现已暂停/);
  assert.match(calls.modals.at(-1) || '', /privatePhoneCloudBackup\(false\)/);

  assert.equal(
    await context.privatePhoneCloudBackup(false, false),
    'manual-uploaded'
  );
  assert.equal(calls.originalBackups.length, 1);
  assert.equal(calls.originalBackups[0].firstBind, false);
  assert.equal(calls.originalBackups[0].silent, false);
});

test('manual backup and both restore actions remain free of the automatic-disable guard', () => {
  for (const name of [
    'privatePhoneCloudBackup',
    'privatePhoneCloudRestoreOpen',
    'privatePhoneCloudRestoreConfirm'
  ]) {
    const source = functionSource(app, name);
    assert.doesNotMatch(source, /__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__/);
    assert.doesNotMatch(source, /313-private-v1187-v1179-keyboard-baseline-1/);
  }
  assert.doesNotMatch(
    overlay,
    /window\.privatePhoneCloudRestore(?:Open|Confirm)\s*=/
  );
  assert.match(
    overlay,
    /return originalBackup\.apply\(this,arguments\)/,
    'non-first-bind manual backup must pass through unchanged'
  );
});

test('diagnostic append is fire-and-forget, bounded, rate-limited and not a timer hot source', () => {
  const emit = functionSource(overlay, 'emit');
  assert.match(emit, /lastEventAt\[bucket\]/);
  assert.match(emit, /minGap==null\?10000:minGap/);
  assert.match(emit, /action:'diagnostics\.append'/);
  assert.doesNotMatch(emit, /\bawait\b|\.then\s*\(|console\.|localStorage|JSON\.stringify/);
  assert.doesNotMatch(overlay, /setInterval\s*\(/);

  const appendBranch = between(
    bridge,
    'if action == "diagnostics.append" {',
    'guard let requestID = payload["requestId"] as? String else {'
  );
  assert.match(appendBranch, /SmallPhoneDiagnosticsStore\.appendScriptPayload/);
  assert.match(appendBranch, /\breturn\b/);
  assert.doesNotMatch(appendBranch, /requestID|reply\s*\(/);

  const append = between(
    bridge,
    'static func append(',
    'static func appendScriptPayload('
  );
  assert.match(append, /queue\.async\s*\{/);
  assert.doesNotMatch(append, /queue\.sync/);

  const appendLine = between(
    bridge,
    'private static func appendLine(_ line: Data)',
    '\n}\n\n@MainActor'
  );
  assert.match(bridge, /private static let maximumBytes = 256 \* 1_024/);
  assert.match(bridge, /private static let maximumLines = 200/);
  assert.match(appendLine, /FileHandle\(forWritingTo: url\)/);
  assert.match(appendLine, /cachedLineCount == nil/);
  assert.match(appendLine, /try handle\.seekToEnd\(\)/);
  assert.match(appendLine, /try handle\.write\(contentsOf: line\)/);
  assert.match(appendLine, /data\.count > maximumBytes/);
  assert.match(appendLine, /lines\.count > maximumLines/);
  assert.match(appendLine, /for row in lines\.reversed\(\)/);
  assert.match(appendLine, /kept\.count >= maximumLines/);
  assert.match(appendLine, /keptBytes \+ rowBytes > maximumBytes/);
  assert.match(appendLine, /kept\.reversed\(\)\.joined/);
  assert.match(appendLine, /isExcludedFromBackup = true/);
});

test('native recovery UI stays outside WebKit and carries the private 313 identity', () => {
  assert.match(rootView, /SmallPhoneDiagnosticsStore\.recentText\(limit: 80\)/);
  assert.match(rootView, /聊天、角色、图片、登录信息或密钥/);
  assert.match(rootView, /安全重新打开小手机/);
  assert.match(rootView, /复制诊断给开发者/);
  assert.doesNotMatch(webView, /LocalPhoneWebView\.loadFailureHTML/);

  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.313 \(313\)'/);
  assert.match(webView, /smallPhone\.webContentTerminationTimes\.v22\.build313/);
  assert.match(bridge, /private static let build = "1\.0\.313 \(313\)"/);
  assert.match(bridge, /case "diagnostics\.read"/);
  assert.match(bridge, /"bounded": true/);
  assert.match(bridge, /"maximumBytes": 256 \* 1_024/);
  assert.match(bridge, /case "diagnostics\.clear"/);
});
