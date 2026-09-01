import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const nativeBase =
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/';
const overlay = read(
  nativeBase + 'PhoneWeb.bundle/private-runtime-diagnostics.js'
);
const bridge = read(nativeBase + 'PhoneNativeBridge.swift');
const webView = read(nativeBase + 'LocalPhoneWebView.swift');
const rootView = read(nativeBase + 'SmallPhonePrivateRootView.swift');
const appDelegate = read(nativeBase + 'PhoneCompanionTestApp.swift');
const project = read(
  'native/private-small-phone/XcodeProject/' +
  'PhoneCompanionTest.xcodeproj/project.pbxproj'
);
const privateIndex = read(nativeBase + 'PhoneWeb.bundle/index.html');
const privateAlias = read(nativeBase + 'PhoneWeb.bundle/小手机.html');
const publicApp = read('app.js');
const publicIndex = read('index.html');
const publicGlass = read('glass-theme.css');

test('private low-composition protection keeps its setter without exposing A/B controls', () => {
  assert.match(overlay, /if\(window\.__SMALL_PHONE_PRIVATE__!==true\)return/);
  assert.match(
    overlay,
    /classList\.toggle\(COMPOSITION_CLASS,next==='B'\)/
  );
  assert.match(overlay, /composition\.ab\.switch/);
  assert.match(overlay, /composition\.ab\.settled/);
  assert.match(overlay, /north-private-composition-b/);
  assert.match(overlay, /box-shadow:none!important/);
  assert.match(overlay, /animation-play-state:paused!important/);
  assert.doesNotMatch(
    overlay,
    /north-private-composition-b[\s\S]*\*\s*\{[^}]*animation:none/
  );
  assert.doesNotMatch(overlay, /north-private-composition-b[\s\S]*music-vinyl/);

  const setterStart = overlay.indexOf('function setCompositionMode');
  const setterEnd = overlay.indexOf('function activateSlowFrameProtection');
  assert.ok(setterStart >= 0 && setterEnd > setterStart);
  const setter = overlay.slice(setterStart, setterEnd);
  assert.doesNotMatch(
    setter,
    /\b(?:localStorage|sessionStorage|indexedDB|save|render|reload|backup)\b/
  );
  assert.match(overlay, /window\.privateCompositionABSet=/);
  assert.match(overlay, /页面首帧等待达到 1\.2 秒/);
  for (const visibleControl of [
    /COMPOSITION_CONTROL_ID/,
    /showCompositionABControl/,
    /privateCompositionABShow/,
    /floating-control/,
    /privateCompositionModeA/,
    /privateCompositionModeB/,
    />切到 A</,
    />切到 B</,
    /显示悬浮 A\/B/
  ]) {
    assert.doesNotMatch(overlay, visibleControl);
  }
  for (const publicSource of [publicApp, publicIndex, publicGlass]) {
    assert.doesNotMatch(publicSource, /north-private-composition-b/);
    assert.doesNotMatch(publicSource, /privateCompositionABSet/);
  }
  assert.equal(privateIndex, privateAlias);
});

test('A to B to A toggles only one root class and emits bounded evidence', async () => {
  const classes = new Set();
  const elements = new Map();
  const events = [],nativeRequests = [];
  let now=100,resolveFriendSync;
  const classList = {
    add: value => classes.add(value),
    remove: value => classes.delete(value),
    contains: value => classes.has(value),
    toggle: (value, force) => {
      if (force) classes.add(value);
      else classes.delete(value);
      return force;
    }
  };
  const makeElement = () => ({
    id: '',
    style: {},
    classList: { add() {}, remove() {} },
    setAttribute() {},
    addEventListener() {},
    querySelectorAll: () => [],
    appendChild() {},
    innerHTML: '',
    textContent: ''
  });
  const document = {
    hidden: false,
    documentElement: { classList },
    getElementById: id => elements.get(id) || null,
    createElement: () => makeElement(),
    head: {
      appendChild(node) {
        if (node.id) elements.set(node.id, node);
      }
    },
    body: {
      appendChild(node) {
        if (node.id) elements.set(node.id, node);
      }
    }
  };
  const sandbox = {
    document,
    Date,
    Math,
    Object,
    Promise,
    String,
    performance: { now: () => now },
    requestAnimationFrame: callback => {
      callback();
      return 1;
    },
    setInterval: () => 1,
    setTimeout: () => 1,
    clearTimeout() {},
    navigator: {},
    webkit: null
  };
  sandbox.window = sandbox;
  sandbox.window.__SMALL_PHONE_PRIVATE__ = true;
  sandbox.window.__smallPhoneNativeDiag = (event, fields) => {
    events.push({ event, fields });
    return true;
  };
  sandbox.window.SmallPhoneNative = {
    request(action,payload){
      nativeRequests.push({action,payload});
      return Promise.resolve({requestedMode:payload&&payload.mode});
    }
  };
  sandbox.window.phoneFriendSync=()=>{
    now+=2;
    return new Promise(resolve=>{resolveFriendSync=resolve;});
  };
  vm.runInNewContext(overlay, sandbox);

  assert.equal(
    sandbox.window.privateCompositionABSet('A', 'test-current'),
    'A'
  );
  assert.equal(
    sandbox.window.privateCompositionABSet('B', 'test'),
    'B'
  );
  assert.equal(classes.has('north-private-composition-b'), true);
  assert.equal(
    sandbox.window.privateCompositionABSet('A', 'test'),
    'A'
  );
  assert.equal(classes.has('north-private-composition-b'), false);
  assert.deepEqual(
    events
      .filter(row => row.event === 'composition.ab.switch')
      .map(row => row.fields.to),
    ['B', 'A']
  );
  assert.deepEqual(
    nativeRequests.map(row=>[row.action,row.payload.mode]),
    [
      ['diagnostics.compositionMode','B'],
      ['diagnostics.compositionMode','A']
    ]
  );
  sandbox.window.privateCompositionABSet('B','native-recovery');
  assert.equal(nativeRequests.length,2,'native re-application cannot recurse');

  const pending=sandbox.window.phoneFriendSync();
  now+=57345;
  resolveFriendSync(true);
  await pending;
  const slow=events.find(row=>row.event==='slow.phoneFriendSync');
  assert.ok(slow);
  assert.equal(slow.fields.syncMs,2);
  assert.ok(slow.fields.ms>=57347);
});

test('diagnostics retain pre-failure context without rewriting every append', () => {
  assert.match(bridge, /private static let maximumBytes = 256 \* 1_024/);
  assert.match(bridge, /private static let retainedBytes = 192 \* 1_024/);
  assert.match(bridge, /private static let maximumLines = 300/);
  assert.match(bridge, /private static let retainedLines = 200/);
  assert.match(bridge, /kept\.count >= retainedLines/);
  assert.match(bridge, /keptBytes \+ rowBytes > retainedBytes/);
  assert.match(bridge, /recentText\(limit: 200\)/);
  assert.match(rootView, /recentText\(limit: 200\)/);
  assert.match(bridge, /"processSessionID": processSessionID/);
  assert.match(
    webView,
    /SmallPhoneDiagnosticsStore\.processSessionID/
  );
});

test('native lifecycle labels process restarts without claiming an exact kill cause', () => {
  assert.match(appDelegate, /native\.app\.launch/);
  assert.match(appDelegate, /native\.app\.phase/);
  assert.match(appDelegate, /case "terminated": previousExit = "clean"/);
  assert.match(
    appDelegate,
    /case "background": previousExit = "prior-background"/
  );
  assert.match(
    appDelegate,
    /default: previousExit = "unclean-or-force-close"/
  );
  assert.match(project, /UIApplicationSceneManifest_Generation = YES/);
  assert.match(appDelegate, /installDiagnosticLifecycleObservers\(\)/);
  for (const notification of [
    'UIApplication.didBecomeActiveNotification',
    'UIApplication.willResignActiveNotification',
    'UIApplication.didEnterBackgroundNotification',
    'UIApplication.willEnterForegroundNotification',
    'UIApplication.willTerminateNotification'
  ]) {
    assert.match(appDelegate, new RegExp(notification.replaceAll('.', '\\.')));
  }
  assert.match(appDelegate, /self\?\.recordDiagnosticLifecycle\(phase\)/);
  assert.match(rootView, /generation: webViewGeneration/);
  assert.match(
    rootView,
    /webViewGeneration == 0[\s\S]*?"initial" : "manual-recovery"/
  );
  assert.match(webView, /let generation: Int/);
  assert.match(webView, /let mountReason: String/);
  for (const event of ['native.webview.make','native.webview.dismantle']) {
    const start=webView.indexOf(`"${event}"`);
    const block=webView.slice(start,start+500);
    assert.match(block,/"generation": generation/);
    assert.match(block,/"mountReason": mountReason/);
  }

  const sample = [
    { pid: 9612, processSessionID: '2B2CA49B' },
    { pid: 9616, processSessionID: '933ECB21' },
    { pid: 9621, processSessionID: '6C3919C4' },
    { pid: 9625, processSessionID: '04B2046C' }
  ];
  assert.equal(new Set(sample.map(row => row.pid)).size, 4);
  assert.equal(
    new Set(sample.map(row => row.processSessionID)).size,
    4
  );
});

test('single long stalls and synchronous timer work are measured separately', () => {
  assert.match(overlay, /slow\.'\+name\+'\.sync'/);
  assert.match(overlay, /status:'returned-promise'/);
  assert.match(overlay, /syncMs:syncElapsed/);
  assert.match(webView, /const measuredTimerCallback/);
  assert.match(webView, /scheduleLag >= 650/);
  assert.match(webView, /'event-loop\.lag'/);
  assert.match(webView, /'runtime\.heartbeat'/);
  assert.match(webView, /source: 'timer-piggyback'/);
  assert.match(webView, /elapsed >= 650 &&/);
  assert.match(webView, /typeof window\.__smallPhoneNativeDiag === 'function'/);
  assert.match(webView, /'timer\.callback\.slow'/);
  assert.match(webView, /callback: callbackName/);
  assert.match(webView, /delay: declaredDelay/);
  assert.match(
    webView,
    /callback\.name === '' && Number\(delay\) === 2000/
  );
  assert.match(webView, /'native-performance-watch'/);
  assert.match(webView, /observedWatchdogEpoch !== callbackWatchdogEpoch/);
  assert.match(bridge, /case "diagnostics\.compositionMode"/);
  assert.match(bridge, /LocalPhoneWebView\.compositionModeRequested/);
  assert.match(webView, /source: "native-thermal-denied"/);
});

test('native recovery remains available while offering a no-reload B action', () => {
  assert.match(rootView, /切到 B 低合成并继续等待/);
  assert.match(rootView, /native\.compositionAB\.userRequested/);
  assert.match(rootView, /compositionModeRequested/);
  assert.match(rootView, /recoveryContinueRequested/);
  assert.match(webView, /native\.compositionAB\.request/);
  assert.match(webView, /native\.compositionAB\.applied/);
  assert.match(webView, /native\.compositionAB\.denied/);
  assert.match(
    webView,
    /thermalState == "serious" \|\| thermalState == "critical"/
  );
});
