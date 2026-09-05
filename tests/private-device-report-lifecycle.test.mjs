import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootView = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift',
    import.meta.url
  ),
  'utf8'
);
const webView = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift',
    import.meta.url
  ),
  'utf8'
);
const bridge = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',
    import.meta.url
  ),
  'utf8'
);
const privateApp = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',
    import.meta.url
  ),
  'utf8'
);
const privateIndex = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',
    import.meta.url
  ),
  'utf8'
);
const privateAlias = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    import.meta.url
  ),
  'utf8'
);
const privateRepair = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/repair.html',
    import.meta.url
  ),
  'utf8'
);

test('Screen Time report is isolated from the private phone root lifecycle', () => {
  assert.match(rootView, /SmallPhoneUsageReportMountController: UIViewController/);
  assert.match(rootView, /SmallPhoneUsageReportMountView: UIViewControllerRepresentable/);
  assert.match(rootView, /DeviceActivityReport\(reportContext, filter: todayFilter\)/);
  assert.match(rootView, /forName: \.companionUsageReportRefreshRequested/);
  assert.match(rootView, /SmallPhoneUsageReportMountView\(\)[\s\S]*?frame\(width: 2, height: 2\)/);
  assert.match(rootView, /Task\.sleep\(nanoseconds: 12_000_000_000\)/);
  assert.doesNotMatch(rootView, /@State private var reportMounted/);
  assert.doesNotMatch(rootView, /if reportMounted \{/);
  assert.doesNotMatch(rootView, /reportRequestGeneration/);
});

test('report mount and private WKWebView instances leave bounded diagnostics', () => {
  assert.match(rootView, /"native\.usageReport\.mount"/);
  assert.match(rootView, /"native\.usageReport\.unmount"/);
  assert.match(rootView, /"native\.usageReport\.host\.init"/);
  assert.match(rootView, /"native\.usageReport\.host\.deinit"/);
  assert.match(rootView, /"hostID": hostID/);
  assert.match(webView, /let coordinatorID = String\(UUID\(\)\.uuidString\.prefix\(8\)\)/);
  assert.match(webView, /"native\.webview\.make"/);
  assert.match(webView, /"native\.webview\.dismantle"/);
  assert.match(webView, /"native\.coordinator\.deinit"/);
  assert.match(webView, /processSessionID/);
  assert.match(
    webView,
    /"native\.webcontent\.terminated"[\s\S]*?"webViewID": webViewID/
  );
});

test('status-bar theme does not force an avoidable first root transition', () => {
  assert.match(rootView, /static var persisted: SmallPhoneStatusBarTheme/);
  assert.match(rootView, /@State private var statusBarTheme = SmallPhoneStatusBarTheme\.persisted/);
  assert.doesNotMatch(rootView, /\.onAppear\s*\{[\s\S]*?statusBarTheme = theme/);
  assert.match(bridge, /\) \?\? "black"/);
  assert.match(bridge, /if previous != theme\s*\{[\s\S]*?smallPhoneStatusBarThemeChanged/);
});

test('private build and bundled recovery page advance together', () => {
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.309 \(309\)'/);
  assert.match(webView, /smallPhone\.webContentTerminationTimes\.v18\.build309/);
  assert.match(privateApp, /APP_VER='v1183 · 共同生活键盘与唱片配色修复版'/);
  assert.equal(privateAlias, privateIndex);
  assert.match(privateIndex, /window\.__NORTH_SHELL_BUILD__='1183'/);
  assert.match(privateIndex, /app\.js\?v=1183/);
  assert.match(privateIndex, /private-runtime-diagnostics\.js\?v=309/);
  assert.match(privateRepair, /index\.html\?repair=1&v=1183/);
  assert.match(privateApp, /__NORTH_SHELL_BUILD__!==\'1183\'/);
});

test('glass home widgets can be restored after an old-build over-install', () => {
  assert.match(privateApp, /function glassWidgetsRestoreAll\(\)/);
  assert.match(
    privateApp,
    /const order=\['dashboard','vinyl','sweetie'\]/
  );
  assert.match(privateApp, /filter\(v=>!String\(v\)\.startsWith\('w:'\)\)/);
  assert.match(privateApp, /onclick="glassWidgetsRestoreAll\(\)"/);
  assert.match(
    privateApp,
    /for\(let n=tokens\.length-1;n>=slots\.length;n--\)/
  );
  assert.match(
    privateApp,
    /fixed\.map\(k=>wManRow\(k,meta\[k\],S\.me\.widgets\.includes\(k\)\)\)/
  );
  assert.doesNotMatch(privateApp, />已保留<\/span>/);
});

test('local recovery lists physical candidates and remains rollback-safe', () => {
  const start = privateApp.indexOf('const PRIVATE_LOCAL_RECOVERY_ROLLBACK_KEY');
  const end = privateApp.indexOf('function pickObj', start);
  const recoverySection = privateApp.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(privateApp, /let _recoveryCandidate=null,_recoveryCandidates=\[\]/);
  assert.match(privateApp, /function emergencyRestorePreview\(index\)/);
  assert.match(privateApp, /找到 \$\{rows\.length\} 份本机候选/);
  assert.match(privateApp, /安全合并全部角色聊天/);
  assert.match(privateApp, /推荐选择角色、记忆和朋友圈较完整的新存档作为基底/);
  assert.match(privateApp, /privateNativeCoreGet\(row\[0\],\{primaryOnly:true\}\)/);
  assert.match(privateApp, /privateNativeCoreGet\(row\[0\],\{backup:true\}\)/);
  assert.match(privateApp, /imgGetIDB\(row\[0\]\)/);
  assert.match(privateApp, /recoveryReadCandidateRaw\(row\.x\)/);
  assert.match(privateApp, /'native-primary',row\[0\]/);
  assert.match(privateApp, /safe-message-merge/);
  assert.match(privateApp, /PRIVATE_LOCAL_RECOVERY_ROLLBACK_KEY/);
  assert.match(privateApp, /imgPutIDBWithRetry\(PRIVATE_LOCAL_RECOVERY_ROLLBACK_KEY/);
  assert.match(privateApp, /function emergencyRestoreRollback\(\)/);
  assert.match(privateApp, /function recoveryRollbackState\(\)/);
  assert.match(privateApp, /function recoveryRollbackArchive\(blob,live,label\)/);
  assert.match(privateApp, /JSON\.stringify\(S\)/);
  assert.doesNotMatch(recoverySection, /JSON\.stringify\(S,_imgReplacer\)/);
  assert.match(privateApp, /当前数据没有改变，请稍后重试/);
  assert.match(privateApp, /opt\.backup===true&&r\.backup!==true/);
  assert.match(privateApp, /opt\.primaryOnly===true&&r\.primaryOnly!==true/);
  assert.match(privateApp, /snapshotSaved=false,stateMutated=false/);
  assert.match(privateApp, /if\(stateMutated&&snapshotSaved&&beforeJSON\)/);
  assert.match(privateApp, /function recoveryPersistStateNow\(\)/);
  assert.match(privateApp, /recoveryHydrateCandidate\(raw,\{mergeArchive:false\}\)/);
  assert.doesNotMatch(recoverySection, /fullBackupState\(/);
  assert.doesNotMatch(recoverySection, /imgAll\(/);
  assert.match(privateApp, /已自动回到恢复前状态/);
  assert.match(privateApp, /已自动回到合并前状态/);
  assert.match(privateApp, /原生保护副本/);
  assert.match(bridge, /let readBackup = arguments\["backup"\] as\? Bool \?\? false/);
  assert.match(bridge, /let readPrimaryOnly = arguments\["primaryOnly"\] as\? Bool \?\? false/);
  assert.match(bridge, /nativeStorageBackupURL\(for: url\)/);
});

test('old native bridges cannot masquerade as primary-only or backup reads', async () => {
  const start = privateApp.indexOf('async function privateNativeCoreGet');
  const end = privateApp.indexOf('function privateNativeCoreDelete', start);
  const context = vm.createContext({
    window: {
      SmallPhoneNative: {
        request: async () => ({
          found: true,
          stateJSON: '{"settings":{}}',
          savedAt: 1,
          backup: false,
          primaryOnly: false
        })
      }
    },
    TextDecoder,
    Uint8Array,
    atob
  });
  vm.runInContext(privateApp.slice(start, end), context);
  await assert.rejects(
    context.privateNativeCoreGet('core', { backup: true }),
    /does not support backup-only reads/
  );
  await assert.rejects(
    context.privateNativeCoreGet('core', { primaryOnly: true }),
    /does not support primary-only reads/
  );
  context.window.SmallPhoneNative.request = async () => ({
    found: true,
    stateJSON: '{"settings":{}}',
    savedAt: 2,
    backup: true,
    primaryOnly: false
  });
  const record = await context.privateNativeCoreGet('core', { backup: true });
  assert.equal(record.savedAt, 2);
});

test('rollback archive refuses to replace unreadable chats with an empty object', () => {
  const start = privateApp.indexOf('function recoveryRollbackArchive');
  const end = privateApp.indexOf('async function recoveryRollbackState', start);
  const context = vm.createContext({});
  vm.runInContext(privateApp.slice(start, end), context);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.recoveryRollbackArchive(
      null,
      { __idb: 'messages', role: [{ id: 'm1' }] },
      '聊天'
    ))),
    { role: [{ id: 'm1' }] }
  );
  assert.throws(
    () => context.recoveryRollbackArchive(
      null,
      { __idb: 'messages' },
      '聊天'
    ),
    /当前数据没有改变/
  );
});
