import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const privateBase =
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/';
const webView = read(privateBase + 'LocalPhoneWebView.swift');
const bridge = read(privateBase + 'PhoneNativeBridge.swift');
const rootView = read(privateBase + 'SmallPhonePrivateRootView.swift');
const app = read(privateBase + 'PhoneWeb.bundle/app.js');
const overlay = read(
  privateBase + 'PhoneWeb.bundle/private-runtime-diagnostics.js'
);
const css = read(privateBase + 'PhoneWeb.bundle/glass-theme.css');
const index = read(privateBase + 'PhoneWeb.bundle/index.html');
const alias = read(privateBase + 'PhoneWeb.bundle/小手机.html');
const project = read(
  'native/private-small-phone/XcodeProject/' +
  'PhoneCompanionTest.xcodeproj/project.pbxproj'
);

function loadInterceptDiagnostics() {
  const start = app.indexOf('function roleVisibleEnvelopeText');
  const end = app.indexOf('function offlineUnsafeRoleDrift', start);
  assert.ok(start >= 0 && end > start, 'intercept diagnostics helper block exists');
  const stored = new Map();
  const sessionStorage = {
    getItem(key) {
      return stored.has(key) ? stored.get(key) : null;
    },
    setItem(key, value) {
      stored.set(key, String(value));
    },
  };
  const context = {
    sessionStorage,
    cleanRolePunct: value => String(value == null ? '' : value),
    actId: () => 'main',
  };
  vm.runInNewContext(
    app.slice(start, end) + `\nthis.__diag = {
      key: ROLE_INTERCEPT_DIAG_SESSION_KEY,
      turn: roleInterceptDiagnosticTurn,
      candidate: roleInterceptDiagnosticTurnCandidate,
      select: roleInterceptDiagnosticTurnSelect,
      outcome: roleInterceptDiagnosticTurnOutcome,
      finish: roleInterceptDiagnosticTurnFinish,
      read: roleInterceptDiagnosticRead,
      readAll: roleInterceptDiagnosticReadAll,
      onlyHandled: roleInterceptDiagnosticOnlyHandled,
      handledTagLine: roleInterceptDiagnosticHandledTagLine,
    };`,
    context
  );
  return { ...context.__diag, stored };
}

test('a six-second WebContent stall has a native recovery surface outside WKWebView', () => {
  assert.match(webView, /let onRecoveryNeeded: \(String\) -> Void/);
  assert.match(webView, /scheduleResponsivenessProbe\(\)/);
  assert.match(webView, /deadline: \.now\(\) \+ 6/);
  assert.match(webView, /evaluateJavaScript\("void 0"\)/);
  assert.match(webView, /UIApplication\.shared\.applicationState == \.active/);
  assert.match(webView, /event: "native\.responsiveness\.timeout"/);
  assert.match(webView, /UIApplication\.willResignActiveNotification/);
  assert.match(webView, /UIApplication\.didBecomeActiveNotification/);
  assert.match(webView, /responsivenessProbeToken \+= 1/);
  assert.match(
    webView,
    /guard UIApplication\.shared\.applicationState == \.active,[\s\S]*let webView = bridge\.webView else \{ return \}/
  );

  assert.match(rootView, /SmallPhoneNativeRecoveryOverlay: View/);
  assert.match(rootView, /if let recoveryReason/);
  assert.match(rootView, /\.id\(webViewGeneration\)/);
  assert.match(rootView, /安全重新打开小手机/);
  assert.match(rootView, /复制诊断给开发者/);
  assert.match(rootView, /SmallPhoneDiagnosticsStore\.recentText\(limit: 200\)/);
});

test('thermal pressure and repeated termination stop WebKit self-reload loops', () => {
  assert.match(webView, /thermalState == "nominal" \|\| thermalState == "fair"/);
  assert.match(webView, /thermalState == "serious" \|\| thermalState == "critical"/);
  assert.match(webView, /native\.webcontent\.recoveryOffered/);
  assert.match(webView, /native\.webcontent\.reloadDeferred/);
  assert.match(webView, /webContentTerminationTimes\.v5\.build260/);
  assert.doesNotMatch(webView, /showingLoadFailure/);
  assert.doesNotMatch(webView, /LocalPhoneWebView\.loadFailureHTML/);
  assert.doesNotMatch(webView, /websiteDataStore\.removeData/);
  assert.match(webView, /configuration\.websiteDataStore = \.default\(\)/);
});

test('a recovered historical lag cannot force a WebView restart', () => {
  assert.doesNotMatch(bridge, /onPerformanceEmergency/);
  assert.doesNotMatch(webView, /native\.eventLoop\.recoveryOffered/);
  assert.match(rootView, /继续等待，不重开/);
  assert.match(webView, /recoveryContinueRequested/);
  assert.match(webView, /native\.recovery\.continueWaiting/);
});

test('manual recovery is heat-gated and flushes before rebuilding', () => {
  assert.match(rootView, /thermalState != \.serious/);
  assert.match(rootView, /thermalState != \.critical/);
  assert.match(webView, /native\.recovery\.flush\.begin/);
  assert.match(webView, /typeof window\.saveNowAsync === 'function'/);
  assert.match(webView, /deadline: \.now\(\) \+ 8/);
  assert.match(webView, /native\.recovery\.restartDeferred/);
  assert.match(webView, /let appIsActive =[\s\S]*UIApplication\.shared\.applicationState == \.active/);
  assert.match(webView, /onRecoveryRestartReady\(inspectArchive\)/);
  assert.match(
    webView,
    /frameLoadInterruptedByPolicyChangeCode = 102/
  );
  assert.doesNotMatch(
    webView,
    /WKError\.Code\.frameLoadInterruptedByPolicyChange/
  );
});

test('native archive inspection reuses the existing safe candidate scanner', () => {
  assert.match(rootView, /SmallPhoneRecoveryLaunchStore\.request\(\)/);
  assert.match(bridge, /case "recovery\.launch\.peek"/);
  assert.match(bridge, /case "recovery\.launch\.ack"/);
  assert.match(overlay, /SmallPhoneNative\.request\('recovery\.launch\.peek'\)/);
  assert.match(overlay, /SmallPhoneNative\.request\('recovery\.launch\.ack'\)/);
  assert.match(overlay, /await Promise\.resolve\(window\.emergencyRestoreAll\(\)\)/);
  assert.match(overlay, /window\.emergencyRestoreAll\(\)/);
  assert.match(overlay, /modal\.style\.setProperty\('z-index','12000','important'\)/);
  assert.match(app, /async function emergencyRestoreAll\(\)/);
  assert.doesNotMatch(rootView, /removeData|deleteDatabase|localStorage\.clear/);
  assert.doesNotMatch(overlay, /removeData|deleteDatabase|localStorage\.clear/);
});

test('private glass images use asynchronous decode without lazy-loading blank risk', () => {
  assert.match(app, /app-icon-fallback/);
  assert.match(app, /packed\?' decoding="async"':''/);
  assert.doesNotMatch(app, /decoding="sync" loading="eager" fetchpriority="high"/);
  assert.doesNotMatch(app, /decoding="async" loading="lazy"/);
  assert.match(app, /alt="圆形头像" decoding="async"/);
  assert.match(app, /alt="照片 \$\{i\+1\}" decoding="async"/);
  assert.match(css, /north-native-app\.north-native-performance-guard \.home \.ic/);
  assert.match(css, /north-native-app\.north-native-performance-guard \.home img\{filter:none!important\}/);
});

test('private wardrobe exposes exact and overnight time ranges without removing random mode', () => {
  assert.match(app, /function roleImageTimeRangeActive\(row,minutes\)/);
  assert.match(app, /function roleImageTimeRangeLabel\(row\)/);
  assert.match(app, /id="rio_time_start" type="time"/);
  assert.match(app, /id="rio_time_end" type="time"/);
  assert.match(app, /启用固定穿着时间/);
  assert.match(app, /结束时间早于开始时间时会自动按跨午夜处理/);
  assert.match(app, /eligible=fixed\.length\?fixed:unfixed;if\(!eligible\.length\)return null/);
  assert.match(app, /if\(named\.length\)return named/);
});

test('both private entry files and every iOS target carry build 260', () => {
  assert.equal(index, alias);
  assert.match(index, /app\.js\?v=1128&r=v1128-backup-offline-failure-evidence-1/);
  assert.match(index, /private-runtime-diagnostics\.js\?v=260/);
  assert.match(overlay, /258-post-render-protection-v1/);
  assert.match(webView, /1\.0\.260 \(260\)/);
  assert.match(bridge, /1\.0\.260 \(260\)/);
  assert.equal(
    (project.match(/CURRENT_PROJECT_VERSION = 260;/g) || []).length,
    12
  );
  assert.equal(
    (project.match(/MARKETING_VERSION = 1\.0\.260;/g) || []).length,
    12
  );
});

test('private online and offline replies restore the v1125 format and repetition guards', () => {
  assert.doesNotMatch(app, /function roleReplyNaturalOutputPin\(c\)/);
  assert.match(app, /function offlineRoleDrift\(t\)\{t=roleVisibleEnvelopeText\(t\);if\(offlineUnsafeRoleDrift\(t\)\)return true;const parts=offResponseParts\(t\)/);
  assert.match(app, /const repeatAudit=offlineRepeatAudit/);
  assert.match(app, /const _ordinaryRepeat=ordinaryReplyRepeatInfo/);
  assert.match(app, /const _clauseRepeat=ordinaryReplyClauseRepeatInfo/);
  assert.match(app, /wechatNarrationLeak\(content,c\)/);
});

test('private package exposes session-only last-intercept diagnostics in every role chat surface', () => {
  assert.match(app, /const ROLE_INTERCEPT_DIAG_SESSION_KEY='north-role-intercept-last-v2'/);
  assert.match(app, /sessionStorage\.setItem\(ROLE_INTERCEPT_DIAG_SESSION_KEY/);
  assert.match(app, /function roleInterceptDiagnosticChannel\(channel\)\{return channel==='online'\?'online':channel==='cohab'\?'cohab':'offline';\}/);
  assert.match(app, /function roleInterceptDiagnosticOpen\(cid,channel\)/);
  assert.match(app, /不会发给模型，也不会写进聊天、角色记忆或云同步/);
  assert.match(app, /roleInterceptDiagnosticOpen\('\$\{id\}','online'\)/);
  assert.match(app, /roleInterceptDiagnosticOpen\('\$\{id\}','cohab'\)/);
  assert.match(app, /roleInterceptDiagnosticOpen\('\$\{id\}','offline'\)/);
  assert.match(app, /function roleInterceptDiagnosticTurnCandidate\(turn,raw,stage\)/);
  assert.match(app, /function roleInterceptDiagnosticTurnFinish\(turn,finalText,opt\)/);
  assert.match(app, /roleInterceptDiagnosticTurnCandidate\(opt\.roleInterceptAudit,out,opt\.roleInterceptStage\)/);
  assert.match(app, /roleInterceptDiagnosticTurnFinish\(_replyAudit,_replyAuditFinal/);
  assert.match(app, /roleInterceptDiagnosticTurnFinish\(_offAudit,_offAuditFinal/);
  assert.match(app, /cohabReplyAuditFinish\(result,delivered,partial\)/);
  assert.match(app, /按模型实际返回顺序保留这一轮全部未原样展示的回复候选/);
  assert.match(app, /已正常执行的功能指令不算拦截/);
  assert.match(app, /roleInterceptDiagnosticTransportText\(text\)/);
  assert.doesNotMatch(app, /S\.settings\.roleIntercept/);
});

test('private v2 diagnostics settle only after display outcome and keep every discarded candidate', () => {
  const diag = loadInterceptDiagnostics();
  const role = { id: 'role-a', name: '甲' };
  const turn = diag.turn(role, 'online', 'account-a', '微信回复');

  diag.candidate(turn, '第一份重复候选', '主候选');
  diag.candidate(turn, '第一份重复候选', '格式纠正候选');
  diag.candidate(turn, '最终正常展示', '复读纠正候选');
  assert.equal(diag.read(role, 'online', 'account-a'), null);
  assert.equal(diag.stored.size, 0, 'candidate collection must not write before display settles');

  assert.equal(diag.select(turn, '最终正常展示'), true);
  assert.equal(diag.read(role, 'online', 'account-a'), null);
  assert.equal(diag.finish(turn, '最终正常展示', { delivered: true }), true);

  const row = diag.read(role, 'online', 'account-a');
  assert.equal(diag.key, 'north-role-intercept-last-v2');
  assert.equal(row.version, 2);
  assert.equal(row.channel, 'online');
  assert.equal(row.account, 'account-a');
  assert.equal(row.items.length, 2);
  assert.deepEqual(
    Array.from(row.items, item => [item.stage, item.raw]),
    [
      ['主候选', '第一份重复候选'],
      ['格式纠正候选', '第一份重复候选'],
    ]
  );
  assert.equal(diag.read(role, 'online', 'other-account'), null);
});

test('private v2 diagnostics isolate online, cohab and offline lanes', () => {
  const diag = loadInterceptDiagnostics();
  const role = { id: 'role-lanes', name: '乙' };
  const hidden = (channel, raw) => {
    const turn = diag.turn(role, channel, 'ignored-account', channel);
    diag.candidate(turn, raw, channel + '候选');
    diag.finish(turn, '', { delivered: false });
  };

  hidden('online', '线上未展示');
  hidden('cohab', '共同生活未展示');
  hidden('offline', '单次约会未展示');

  assert.equal(diag.read(role, 'online', 'ignored-account').items[0].raw, '线上未展示');
  assert.equal(diag.read(role, 'cohab').items[0].raw, '共同生活未展示');
  assert.equal(diag.read(role, 'offline').items[0].raw, '单次约会未展示');
  assert.equal(diag.read(role, 'online', 'main'), null);
  assert.equal(diag.read(role, 'cohab', 'any-other-account').account, 'cohab');
  assert.equal(diag.read(role, 'offline', 'any-other-account').account, 'offline');
});

test('private v2 diagnostics do not report successfully consumed function tags as intercepted prose', () => {
  const diag = loadInterceptDiagnostics();
  const role = { id: 'role-tags', name: '丙' };
  const handledText = '[心情|开心]\n[闹钟|07:30|起床]';
  const handled = diag.turn(role, 'online', 'tag-account', '功能标签');

  assert.equal(diag.handledTagLine('[心情|开心]'), true);
  assert.equal(diag.handledTagLine('[闹钟|07:30|起床]'), true);
  assert.equal(diag.onlyHandled(handledText), true);
  diag.candidate(handled, handledText, '主候选');
  diag.select(handled, handledText);
  diag.outcome(handled, { handled: 1 });
  assert.equal(diag.finish(handled, '', { delivered: true }), false);
  assert.equal(diag.read(role, 'online', 'tag-account'), null);

  const unknown = diag.turn(role, 'online', 'unknown-account', '未知标签');
  diag.candidate(unknown, '[指令解析|不应展示]', '主候选');
  diag.select(unknown, '[指令解析|不应展示]');
  assert.equal(diag.finish(unknown, '', { delivered: true }), true);
  assert.equal(
    diag.read(role, 'online', 'unknown-account').items[0].raw,
    '[指令解析|不应展示]'
  );
});
