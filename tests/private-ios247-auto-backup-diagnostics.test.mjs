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

test('private diagnostics 336 releases the temporary automatic-backup pause', () => {
  assert.match(overlay, /OVERLAY_VERSION='336-daily-file-backup'/);
  assert.match(overlay, /__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__=false/);
  assert.doesNotMatch(overlay, /cancelAutomaticBackupTimer/);
  assert.doesNotMatch(overlay, /window\.privatePhoneCloudSchedule\s*=/);
  assert.doesNotMatch(overlay, /window\.privatePhoneCloudAutoBackup\s*=/);
  assert.doesNotMatch(overlay, /window\.privatePhoneCloudBackup\s*=/);
  assert.match(overlay, /autoBackupPaused:false/);
});

test('first bind still asks the account flow to back up after checking the cloud', () => {
  const source = functionSource(app, 'privatePhoneAccountAfterLogin');
  assert.match(source, /account\.backup\.info/);
  assert.match(source, /privatePhoneCloudBackup\(true\)/);
  assert.doesNotMatch(source, /__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__/);
});

test('manual backup and both restore actions remain free of the automatic-disable guard', () => {
  for (const name of [
    'privatePhoneCloudBackup',
    'privatePhoneCloudRestoreOpen',
    'privatePhoneCloudRestoreConfirm'
  ]) {
    const source = functionSource(app, name);
    assert.doesNotMatch(source, /__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__/);
    assert.doesNotMatch(source, /327-role-nickname/);
  }
  assert.doesNotMatch(
    overlay,
    /window\.privatePhoneCloudRestore(?:Open|Confirm)\s*=/
  );
  assert.doesNotMatch(overlay, /originalBackup\.apply\(this,arguments\)/);
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

test('native recovery UI stays outside WebKit and carries the private 356 identity', () => {
  assert.match(rootView, /SmallPhoneDiagnosticsStore\.recentText\(limit: 80\)/);
  assert.match(rootView, /聊天、角色、图片、登录信息或密钥/);
  assert.match(rootView, /安全重新打开小手机/);
  assert.match(rootView, /复制诊断给开发者/);
  assert.doesNotMatch(webView, /LocalPhoneWebView\.loadFailureHTML/);

  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.369 \(369\)'/);
  assert.match(webView, /smallPhone\.webContentTerminationTimes\.v25\.build333/);
  assert.match(bridge, /private static let build = "1\.0\.369 \(369\)"/);
  assert.match(bridge, /case "diagnostics\.read"/);
  assert.match(bridge, /"bounded": true/);
  assert.match(bridge, /"maximumBytes": 256 \* 1_024/);
  assert.match(bridge, /case "diagnostics\.clear"/);
});
