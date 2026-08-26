import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('private app charter fixes the product name and freezes public North', () => {
  const charter = read('docs/maintenance/私人小手机App_唯一总纲.md');
  assert.match(charter, /私人版固定叫 \*\*小手机\*\*/);
  assert.match(charter, /当前审核中的版本保持不动/);
  assert.match(charter, /绝不能同时控制同一台真实 iPhone/);
  assert.match(charter, /命令已发送.*设备已收到.*设备已执行/s);
  assert.match(charter, /采集时间、上传时间/);
});

test('private app loads bundled phone resources instead of a remote shell', () => {
  const webView = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'
  );
  assert.match(webView, /Bundle\.main\.url/);
  assert.match(webView, /appendingPathComponent\("index\.html"/);
  assert.match(webView, /let readAccessURL = fileURL[\s\S]*deletingLastPathComponent/);
  assert.match(webView, /allowingReadAccessTo: readAccessURL/);
  assert.match(webView, /didFailProvisionalNavigation/);
  assert.match(webView, /url\.scheme == "about"/);
  assert.match(webView, /loadFileURL/);
  assert.match(webView, /window\.__SMALL_PHONE_PRIVATE__ = true/);
  assert.match(webView, /window\.__smallPhoneNativeInsets/);
  assert.match(webView, /webView\.window\?\.safeAreaInsets/);
  assert.match(webView, /north-native-app/);
  assert.match(webView, /root\.classList\.add\('north-native-app'\)/);
  assert.match(webView, /__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.207 \(207\)'/);
  assert.match(webView, /\n      window\.__SMALL_PHONE_PRIVATE_BUILD__ = '1\.0\.207 \(207\)'/);
  assert.doesNotMatch(webView, /\nwindow\.__SMALL_PHONE_PRIVATE_BUILD__/);
  assert.match(webView, /SmallPhoneRolePushTapped/);
  assert.match(webView, /window\.__smallPhoneOpenRolePush/);
  assert.doesNotMatch(webView, /https?:\/\//);
});

test('private app has a versioned native bridge and shared-resource staging', () => {
  const bridge = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'
  );
  assert.match(bridge, /import CoreLocation/);
  assert.match(bridge, /\.allowBluetoothHFP/);
  assert.doesNotMatch(bridge, /requestAuthorization \{ \[weak self\]/);
  const manifest = JSON.parse(read(
    'native/private-small-phone/Resources/private-phone-web.manifest.json'
  ));
  const staging = read(
    'native/private-small-phone/scripts/stage-private-phone-web.mjs'
  );
  assert.match(bridge, /contractVersion = 25/);
  assert.match(bridge, /case "alarm\.sync"/);
  assert.match(bridge, /case "device\.snapshot"/);
  assert.match(bridge, /case "device\.command"/);
  assert.match(bridge, /"companion\.controller\.claim"/);
  assert.match(bridge, /claim_private_phone_unified_controller/);
  assert.match(bridge, /p_apns_token/);
  assert.match(bridge, /privateControllerInstanceID/);
  assert.match(bridge, /case "license\.request"/);
  assert.match(bridge, /case "storage\.get", "storage\.get\.chunk", "storage\.get\.release",\s*"storage\.put", "storage\.delete"/);
  assert.match(bridge, /case "storage\.status"/);
  assert.match(bridge, /SmallPhonePrivateStore/);
  assert.match(bridge, /data\.write\(to: url, options: \.atomic\)/);
  assert.match(bridge, /nativeStorageBackupURL/);
  assert.match(bridge, /skippedOlderWrite/);
  assert.match(bridge, /nativeStorageDataWithRecovery/);
  assert.match(bridge, /completeUntilFirstUserAuthentication/);
  assert.match(bridge, /volumeAvailableCapacityForImportantUsageKey/);
  assert.match(bridge, /nativeStorageSavedAt\(in: record\) > 0/);
  assert.match(bridge, /removeItem\(at: backupURL\)/);
  assert.doesNotMatch(bridge, /for: \.documentDirectory/);
  assert.match(bridge, /URLSession\.shared\.data/);
  assert.match(bridge, /lkhlyfpssmrjkkzhuzag\.supabase\.co/);
  assert.equal(manifest.entry, '小手机.html');
  assert.ok(manifest.files.includes('app.js'));
  assert.match(staging, /repoRoot/);
  assert.match(staging, /'PhoneCompanionTest',\s*'PhoneWeb\.bundle'/);
  assert.doesNotMatch(staging, /'Generated',\s*'PhoneWeb\.bundle'/);
  assert.match(staging, /path\.join\(outputRoot, 'index\.html'\)/);
  assert.doesNotMatch(staging, /writeFile/);
  const app = read('app.js');
  assert.match(app, /SmallPhoneNative\.request\('storage\.put'/);
  assert.match(app, /SmallPhoneNative\.request\('storage\.get'/);
  assert.match(app, /SmallPhoneNative\.request\('storage\.status'/);
  assert.match(app, /nativeCore\|\|_coreOverflowMode/);
  assert.match(app, /原生主存档/);
  assert.match(app, /原生保护副本/);
  assert.match(app, /Promise\.all\(\[privateNativeCoreGet\(k\)\.catch\(\(\)=>null\),imgGetIDB\(k\)\]\)/,'an existing web archive remains readable before native migration');
  assert.match(app, /newestStoredCore\(rows\[0\],rows\[1\]\)/,'the newest valid native or web archive wins');
});

test('bundled license requests use the restricted native network bridge', () => {
  const source = read('license-gate.js');
  assert.match(source, /window\.SmallPhoneNative && location\.protocol === 'file:'/);
  assert.match(source, /SmallPhoneNative\.request\('license\.request'/);
  assert.match(source, /else \{\s*response = await fetch/);
  assert.match(read('app.js'), /__SMALL_PHONE_PRIVATE__\?'小手机':'North'/);
});

test('controller lease contract permits exactly one named controller', () => {
  const schema = JSON.parse(read(
    'native/private-small-phone/Contracts/controller-lease.schema.json'
  ));
  assert.deepEqual(
    schema.properties.controllerKind.enum,
    ['public-north', 'private-small-phone']
  );
  assert.ok(schema.required.includes('controllerInstanceId'));
  assert.ok(schema.required.includes('leaseVersion'));
  assert.equal(schema.additionalProperties, false);
});

test('real Mac project keeps all Screen Time targets and becomes 小手机', () => {
  const project = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj'
  );
  for (const target of [
    'PhoneCompanionTest',
    'PhoneCompanionReport',
    'PhoneCompanionMonitor',
    'PhoneCompanionShield',
    'RoleNotificationService'
  ]) {
    assert.match(project, new RegExp(`name = ${target};`));
  }
  assert.match(project, /INFOPLIST_KEY_CFBundleDisplayName = "小手机";/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.qianyi\.PhoneCompanionTest;/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 207;/);
  assert.match(project, /MARKETING_VERSION = 1\.0\.207;/);

  const scheme = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/xcshareddata/xcschemes/PhoneCompanionTest.xcscheme'
  );
  assert.match(scheme, /BlueprintIdentifier = "E74615C33022636200B3739D"/);
  assert.match(scheme, /BuildableName = "PhoneCompanionTest\.app"/);
  assert.match(scheme, /<LaunchAction/);
});

test('private project removes the live map before background and has a real timeout race', () => {
  const content = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/ContentView.swift'
  );
  const sync = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift'
  );
  assert.match(content, /if scenePhase == \.active,[\s\S]*let location/);
  assert.match(sync, /AsyncStream<UsageReadOutcome>\.makeStream/);
  assert.doesNotMatch(sync, /withTaskGroup\([\s\S]{0,300}UsageReadOutcome/);
  assert.match(sync, /guard !Task\.isCancelled else \{ return nil \}/);
});

test('private app owns location permission and only asks Screen Time once', () => {
  const webView = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'
  );
  const bridge = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'
  );
  const location = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocationManager.swift'
  );
  const content = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/ContentView.swift'
  );
  const sync = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift'
  );
  const plist = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/Info.plist'
  );

  assert.match(webView, /location\.current/);
  assert.match(webView, /Object\.defineProperty\(navigator, 'geolocation'/);
  assert.match(webView, /Object\.defineProperty\(Navigator\.prototype, 'geolocation'/);
  assert.match(webView, /descriptor\.name === 'geolocation'/);
  assert.match(bridge, /case "location\.current"/);
  assert.match(bridge, /static let contractVersion = 25/);
  assert.match(bridge, /case "device\.snapshot"/);
  assert.match(bridge, /case "device\.command"/);
  assert.match(sync, /func localSnapshot\(/);
  assert.match(sync, /func performLocalCommand\(/);
  assert.match(sync, /func registerPushTokenIfAvailable\(/);
  assert.doesNotMatch(sync, /fileprivate func registerPushTokenIfAvailable\(/);
  assert.match(bridge, /registerPushTokenIfAvailable\(/);
  assert.match(bridge, /LocationManager\.shared/);
  assert.match(location, /static let shared = LocationManager\(\)/);
  assert.match(location, /pausesLocationUpdatesAutomatically = true/);
  assert.match(location, /allowsBackgroundLocationUpdates = enabled/);
  assert.match(location, /startMonitoringSignificantLocationChanges\(\)/);
  assert.match(location, /manager\.requestLocation\(\)/);
  assert.doesNotMatch(location, /manager\.startUpdatingLocation\(\)/);
  assert.match(location, /requestAlwaysAuthorizationOnce/);
  assert.match(location, /MKReverseGeocodingRequest\(location: location\)/);
  assert.match(location, /addressRepresentations\?\.fullAddress/);
  assert.doesNotMatch(location, /CLGeocoder|reverseGeocodeLocation/);
  assert.match(content, /case \.approvedWithDataAccess:/);
  assert.match(sync, /authorizationStatus ==[\s\S]{0,80}\.notDetermined/);
  assert.match(sync, /locationManager\.resumeTrackingIfAuthorized\(\)/);
  assert.match(sync, /refreshUsage: true/);
  assert.match(plist, /<string>location<\/string>/);
});

test('private app keeps device management in Settings and clears stale app badges', () => {
  const app = read('app.js');
  const rootView = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift'
  );
  const delegate = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneCompanionTestApp.swift'
  );
  const notificationService = read(
    'native/private-small-phone/XcodeProject/RoleNotificationService/NotificationService.swift'
  );
  const project = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj'
  );

  assert.match(app, /function privateNativeSettingsAction\(\)/);
  assert.match(app, /SmallPhoneNative\.request\('native\.management\.open'\)/);
  assert.match(app, /<span class="r">\$\{privateNativeSettingsAction\(\)\}<\/span>/);
  assert.doesNotMatch(rootView, /ZStack\(alignment: \.topTrailing\)/);
  assert.doesNotMatch(rootView, /iphone\.and\.arrow\.forward/);
  assert.match(rootView, /fullScreenCover\(isPresented: \$showsDeviceManagement\)/);

  assert.match(delegate, /applicationDidBecomeActive/);
  assert.match(delegate, /setBadgeCount\(0\)/);
  assert.doesNotMatch(delegate, /applicationIconBadgeNumber/);
  assert.match(delegate, /willPresent notification:[\s\S]*?await clearAppBadge\(\)/);
  assert.match(delegate, /requestAuthorization\(options: \[\.alert, \.sound, \.badge\]\)/);
  assert.match(delegate, /return \[\.banner, \.list, \.sound\]/);
  assert.match(delegate, /didReceive response: UNNotificationResponse/);
  assert.match(delegate, /smallPhone\.pendingRolePushRoute\.v1/);
  assert.match(notificationService, /content\.badge = nil/);
  assert.match(project, /Intents\.framework in Frameworks/);
  assert.match(project, /UserNotifications\.framework in Frameworks/);
});

test('private app isolates role audio from recognition and reuses the proven web keyboard flow', () => {
  const bridge = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'
  );
  const webView = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'
  );
  const privateRoot = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift'
  );
  const project = read(
    'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj'
  );
  const app = read('app.js');
  const html = read('小手机.html');

  assert.match(project, /INFOPLIST_KEY_NSMicrophoneUsageDescription/g);
  assert.match(project, /INFOPLIST_KEY_NSSpeechRecognitionUsageDescription/g);
  assert.match(webView, /WKNavigationDelegate, WKUIDelegate/);
  assert.match(webView, /createWebViewWith configuration: WKWebViewConfiguration/);
  assert.match(webView, /navigationAction\.targetFrame == nil/);
  assert.match(webView, /UIApplication\.shared\.open\(url\)/);
  assert.match(webView, /requestMediaCapturePermissionFor/);
  assert.match(webView, /type == \.cameraAndMicrophone/);
  assert.match(webView, /window\.SmallPhoneNativeSpeech = Object\.freeze/);
  assert.match(bridge, /case "speech\.start"/);
  assert.match(bridge, /SFSpeechAudioBufferRecognitionRequest/);
  assert.match(bridge, /AVAudioApplication\.requestRecordPermission/);
  assert.match(bridge, /schedulePartialCommit\(transcript\)/);
  assert.match(bridge, /Task\.sleep\(nanoseconds: 1_650_000_000\)/);
  assert.match(bridge, /transcript: self\.latestTranscript,[\s\S]{0,80}isFinal: true/);
  assert.match(bridge, /rotateRecognition\(afterNanoseconds: 220_000_000\)/);
  assert.match(bridge, /recognitionGeneration == generation/);
  assert.match(bridge, /private var audioEngine: AVAudioEngine\?/);
  assert.match(bridge, /let engine = AVAudioEngine\(\)/);
  assert.match(bridge, /engine\.reset\(\)/);
  assert.match(bridge, /case "speech\.pause"/);
  assert.match(bridge, /case "speech\.resume"/);
  assert.match(bridge, /case "speech\.rebuild"/);
  assert.match(bridge, /func rebuild\(\) throws/);
  assert.match(bridge, /func pause\(\)/);
  assert.match(bridge, /func resume\(\) throws/);
  assert.match(webView, /pause\(\)[\s\S]*speech\.pause/);
  assert.match(webView, /resume\(\)[\s\S]*speech\.resume/);
  assert.match(webView, /rebuild\(\)[\s\S]*speech\.rebuild/);
  assert.match(bridge, /cleanupCurrentRecognition\(deactivateAudioSession: true\)/);
  assert.doesNotMatch(bridge, /finishCurrentSession\(\)/);
  assert.match(app, /window\.SmallPhoneNativeSpeech&&window\.SmallPhoneNativeSpeech\.create/);
  assert.match(app, /if\(ev\.results\[i\]\.isFinal\)fin\+=text/);
  assert.match(app, /const meta=\{screenFrameToken:[\s\S]{0,500}hfHeard\(t,meta\)/);
  assert.match(app, /callHFPauseForRoleAudio/);
  assert.match(app, /callHFResumeAfterRoleAudio/);
  assert.match(app, /hfAudioPaused=true;await callHFPauseForRoleAudio\(\)/);
  assert.match(app, /await sleep\(760\)/);
  assert.match(app, /typeof _callSR\.rebuild==='function'/);
  assert.doesNotMatch(app, /_callHFPending\.push\(\{text:t,meta\}\)/);
  assert.doesNotMatch(webView, /keyboardWillChangeFrameNotification/);
  assert.doesNotMatch(webView, /keyboardFrameEndUserInfoKey/);
  assert.doesNotMatch(webView, /__smallPhoneNativeKeyboard/);
  assert.doesNotMatch(webView, /window\.scrollTo\(0,0\)/);
  assert.doesNotMatch(html, /north-native-keyboard-open/);
  assert.doesNotMatch(html, /--north-native-keyboard-offset/);
  assert.doesNotMatch(bridge, /ui\.callInput/);
  assert.doesNotMatch(webView, /bindCallInputStabilizer/);
  assert.doesNotMatch(webView, /observe\([\s\S]*\\\.contentOffset/);
  assert.doesNotMatch(webView, /setContentOffset\(target, animated: false\)/);
  assert.doesNotMatch(webView, /alwaysBounceVertical = false/);
  assert.match(privateRoot, /\.ignoresSafeArea\(\.keyboard, edges: \.bottom\)/);
  assert.doesNotMatch(app, /callinput-native|callTypingOpen|callTypingClose/);
  assert.match(app, /const callInput=_call\.state==='active'\?`<div class="callinput show"/);
  assert.match(html, /\.callinput\{[^}]*bottom:150px/);
  assert.match(html, /\.callbtns\{[^}]*bottom:40px/);
  assert.doesNotMatch(html, /html\.north-native-app[^\n{}]*\.callinput\{/);
  assert.doesNotMatch(html, /html\.north-native-app[^\n{}]*\.callbtns\{/);
  assert.match(html, /html\.north-native-app:not\(\.north-apple-remote-safe\) \.music-chat-dock:focus-within\{[^}]*position:fixed;[^}]*bottom:8px/);
  assert.match(html, /html\.north-apple-remote-safe \.phone:has\(\.music-chat-dock\)\{position:absolute\}/);
  assert.match(html, /\.callscreen\.mini\{[^}]*bottom:auto;[^}]*max-height:58px/);
});
