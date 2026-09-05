import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const privateApp = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');
const privateHtml = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html', import.meta.url), 'utf8');
const privateIndex = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html', import.meta.url), 'utf8');
const privateRoot = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift', import.meta.url), 'utf8');
const privateWebView = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift', import.meta.url), 'utf8');
const theater = readFileSync(new URL('../cohab-theater.js', import.meta.url), 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; opened = true; }
    if (source[i] === '}' && opened && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('a focused iOS touchstart toggles narration once and suppresses pointer/click duplicates', () => {
  const ta = { selectionStart: 2, selectionEnd: 4, focus() {}, setSelectionRange(a, b) { this.restored = [a, b]; } };
  const state = { busy: false, narrateMode: false };
  const sandbox = vm.createContext({
    Date,
    Number,
    String,
    document: { activeElement: ta },
    _off: state,
    $: selector => selector === '#off_in' ? ta : null,
    offNarrationDecorate() {},
    requestAnimationFrame: fn => fn(),
  });
  vm.runInContext(`let _offComposerGuardUntil=0,_offNarrationPointerAt=0;${functionSource(app, 'offNarrationMode')}\n${functionSource(app, 'offComposerEvent')}\n${functionSource(app, 'offNarrationPress')}\n${functionSource(app, 'offNarrate')}\nthis.press=offNarrationPress;this.click=offNarrate;`, sandbox);
  const touch = { type: 'touchstart', preventDefault() {}, stopPropagation() {} };
  sandbox.press(touch);
  assert.equal(state.narrateMode, true);
  sandbox.press({ type: 'pointerdown', pointerType: 'touch', preventDefault() {}, stopPropagation() {} });
  assert.equal(state.narrateMode, true, 'the pointer event following touchstart must not toggle again');
  sandbox.click();
  assert.equal(state.narrateMode, true, 'the click following the touch must not toggle the mode back');
  assert.deepEqual(ta.restored, [2, 4]);
});

test('offline composer uses iOS-safe typography and guards send taps from opening edit/delete', () => {
  for (const page of [html, privateHtml]) {
    assert.match(page, /\.offinput\{position:relative;z-index:20/);
    assert.match(page, /font-family:-apple-system,BlinkMacSystemFont/);
    assert.match(page, /font-size:16px!important/);
  }
  for (const code of [app, privateApp]) {
    assert.match(code, /document\.addEventListener\('touchstart',offComposerTouchStart,\{capture:true,passive:false\}\)/,
      'iOS must cancel the focus-changing touch before the narration button receives it');
    assert.match(code, /document\.addEventListener\('pointerdown',[\s\S]*?\.off-note/);
    assert.match(code, /if\(Date\.now\(\)<_offComposerGuardUntil\)return/);
    assert.match(code, /document\.activeElement!==ta/);
    const toggle = functionSource(code, 'offNarrate');
    assert.match(toggle, /document\.activeElement===ta/);
    assert.doesNotMatch(toggle, /\.focus\(/,
      'the narration switch must not close and reopen the private WKWebView keyboard');
  }
  assert.match(theater, /offSay=function\(e\)/);
  assert.match(theater, /offComposerEvent==='function'/);
});

test('private offline focus does not move the conversation during iOS caret hit testing', () => {
  assert.doesNotMatch(privateApp, /function offComposerPinLatest\(target\)/,
    'touching the textarea must not rewrite scrollTop while WebKit calculates the caret');
  assert.doesNotMatch(privateApp, /offComposerPinLatest\(target\);/,
    'touchstart and pointerdown must stay free of pre-focus scrolling');
  assert.doesNotMatch(privateApp, /target\.id\s*===?\s*['"]off_in['"][\s\S]{0,160}scrollTop\s*=/,
    'the private composer must not add another equivalent touch-time scroll mutation');
});

test('the public workaround stays intact while private offline returns to normal document flow', () => {
  assert.match(html, /html\.north-native-app \.phone:has\(\.offinput\)/);
  assert.match(html, /html\.north-ios-home-safe \.phone:has\(\.offinput\)/);
  for (const page of [privateHtml, privateIndex]) {
    assert.doesNotMatch(page, /html\.north-native-app \.phone:has\(\.offinput\)/);
    assert.doesNotMatch(page, /html\.north-ios-home-safe \.phone:has\(\.offinput\)/);
    assert.match(page, /html\.north-native-app \.phone:has\(\.chat-inputbar\),html\.north-ios-home-safe \.phone:has\(\.chat-inputbar\)\{position:absolute\}/,
      'private WeChat must keep its exact v1179 fixed-ancestor workaround');
  }
  assert.match(html, /html\.north-native-app \.phone\{position:fixed/,
    'the native-only fixed shell remains unchanged for screens without a text composer');
});

test('private iOS restores the v1179 single-owner keyboard contract', () => {
  assert.match(html, /interactive-widget=resizes-content/);
  for (const page of [privateHtml, privateIndex]) assert.doesNotMatch(page, /interactive-widget=resizes-content/);
  assert.match(privateRoot, /ignoresSafeArea\(\.keyboard, edges: \.bottom\)/,
    'the private host must stay on the known-good v1179 keyboard timeline');
  assert.doesNotMatch(privateWebView, /KeyboardSynchronizedContainer|keyboardLayoutGuide/,
    'the failed global keyboard guide must be removed');
  assert.match(privateWebView, /func makeUIView\(context: Context\) -> WKWebView/);
  assert.doesNotMatch(privateWebView, /smallPhoneOfflineKeyboardScope|keyboardWillChangeFrameNotification|keyboardDidHideNotification/);
  assert.doesNotMatch(privateWebView, /scrollView\.isScrollEnabled|setContentOffset|\.contentOffset[\s\S]{0,80}observe/,
    'native code must not compete with WebKit for focus scrolling or dismissal');
  assert.doesNotMatch(privateApp, /function offComposerPinLatest\(target\)/,
    'the private offline composer must leave caret placement and keyboard movement to WebKit');
  assert.doesNotMatch(app, /function offComposerPinLatest\(target\)/,
    'the public web build is outside this private-only repair');
  for (const code of [app, privateApp]) {
    const runtimeCode = code.replace(functionSource(code, 'northViewportDiagnosticStart'), '');
    assert.doesNotMatch(runtimeCode, /visualViewport\.addEventListener\(['"]resize/,
      'do not restore the visualViewport keyboard listener that broke iOS caret placement');
  }
});
