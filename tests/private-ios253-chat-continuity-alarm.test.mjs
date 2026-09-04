import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

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
  assert.match(rootView, /SmallPhoneDiagnosticsStore\.recentText\(limit: 80\)/);
});

test('thermal pressure and repeated termination stop WebKit self-reload loops', () => {
  assert.match(webView, /thermalState == "nominal" \|\| thermalState == "fair"/);
  assert.match(webView, /thermalState == "serious" \|\| thermalState == "critical"/);
  assert.match(webView, /native\.webcontent\.recoveryOffered/);
  assert.match(webView, /native\.webcontent\.remountDeferred/);
  assert.match(webView, /webContentTerminationTimes\.v7\.build296/);
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

test('both private entry files and every iOS target carry build 296', () => {
  assert.equal(index, alias);
  assert.match(index, /private-runtime-diagnostics\.js\?v=296/);
  assert.match(overlay, /296-heartquiz-progressive-fill-v1/);
  assert.match(webView, /1\.0\.296 \(296\)/);
  assert.match(bridge, /1\.0\.296 \(296\)/);
  assert.equal(
    (project.match(/CURRENT_PROJECT_VERSION = 296;/g) || []).length,
    12
  );
  assert.equal(
    (project.match(/MARKETING_VERSION = 1\.0\.296;/g) || []).length,
    12
  );
});
