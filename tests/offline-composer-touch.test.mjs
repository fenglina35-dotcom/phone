import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const privateApp = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');
const privateHtml = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html', import.meta.url), 'utf8');
const privateIndex = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html', import.meta.url), 'utf8');
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

test('a focused iOS touch toggles narration once and preserves the text selection', () => {
  const ta = { selectionStart: 2, selectionEnd: 4, focus() {}, setSelectionRange(a, b) { this.restored = [a, b]; } };
  const state = { busy: false, narrateMode: false };
  const sandbox = vm.createContext({
    Date,
    Number,
    String,
    _off: state,
    $: selector => selector === '#off_in' ? ta : null,
    offNarrationDecorate() {},
    requestAnimationFrame: fn => fn(),
  });
  vm.runInContext(`let _offComposerGuardUntil=0,_offNarrationPointerAt=0;${functionSource(app, 'offNarrationMode')}\n${functionSource(app, 'offComposerEvent')}\n${functionSource(app, 'offNarrationPress')}\n${functionSource(app, 'offNarrate')}\nthis.press=offNarrationPress;this.click=offNarrate;`, sandbox);
  const event = { type: 'pointerdown', pointerType: 'touch', preventDefault() {}, stopPropagation() {} };
  sandbox.press(event);
  assert.equal(state.narrateMode, true);
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
    assert.match(code, /document\.addEventListener\('pointerdown',[\s\S]*?\.off-note/);
    assert.match(code, /if\(Date\.now\(\)<_offComposerGuardUntil\)return/);
    assert.match(code, /document\.activeElement!==ta/);
    const toggle = functionSource(code, 'offNarrate');
    assert.match(toggle, /ta\.focus\(\{preventScroll:true\}\)[\s\S]*requestAnimationFrame/,
      'the textarea must regain focus synchronously inside the user gesture before the next paint');
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

test('Android keyboards resize the shared layout instead of covering the co-living composer', () => {
  for (const page of [html, privateHtml, privateIndex]) {
    assert.match(page, /interactive-widget=resizes-content/);
  }
  for (const code of [app, privateApp]) {
    const runtimeCode = code.replace(functionSource(code, 'northViewportDiagnosticStart'), '');
    assert.doesNotMatch(runtimeCode, /visualViewport\.addEventListener\(['"]resize/,
      'do not restore the visualViewport keyboard listener that broke iOS caret placement');
  }
});
