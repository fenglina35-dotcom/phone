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

test('the private iOS fixed-phone workaround also covers the offline date composer', () => {
  for (const page of [html, privateHtml]) {
    assert.match(page, /html\.north-native-app \.phone:has\(\.offinput\)/);
    assert.match(page, /html\.north-ios-home-safe \.phone:has\(\.offinput\)/);
    assert.match(page, /\.phone:has\(\.offinput\)[^{]*\{position:absolute\}/,
      'offline textarea must leave the fixed-position ancestor while the native keyboard is active');
  }
  assert.match(html, /html\.north-native-app \.phone\{position:fixed/,
    'the native-only fixed shell remains unchanged for screens without a text composer');
});

test('web and private iOS use the same native resize contract without a second focus', () => {
  assert.match(html, /interactive-widget=resizes-content/);
  for (const page of [privateHtml, privateIndex]) assert.match(page, /interactive-widget=resizes-content/);
  assert.doesNotMatch(privateRoot, /\.ignoresSafeArea\(\.keyboard, edges: \.bottom\)/,
    'the private root must deliver the real keyboard-safe frame instead of dismissing one animation late');
  for (const code of [app, privateApp]) {
    const runtimeCode = code.replace(functionSource(code, 'northViewportDiagnosticStart'), '');
    assert.doesNotMatch(runtimeCode, /visualViewport\.addEventListener\(['"]resize/,
      'do not restore the visualViewport keyboard listener that broke iOS caret placement');
  }
});
