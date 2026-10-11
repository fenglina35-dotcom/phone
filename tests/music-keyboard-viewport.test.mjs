import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function viewportSource() {
  const start = app.indexOf('let _mChatViewportHeight=');
  const endMark = "window.addEventListener('resize',musicChatViewportResize,{passive:true});";
  const end = app.indexOf(endMark, start);
  assert.ok(start >= 0 && end > start, 'missing music keyboard viewport helpers');
  return app.slice(start, end + endMark.length);
}

function harness() {
  const queued = [];
  const root = { scrollTop: 61, scrollLeft: 7, scrollHeight: 1600 };
  const dock = { scrollIntoView: options => { dock.lastScrollOptions = options; } };
  const documentElement = { scrollTop: 62, clientHeight: 800 };
  const body = { scrollTop: 63, scrollLeft: 9 };
  let playerPresent = true;
  let appleSafe = false;
  const listeners = {};
  const sandbox = {
    document: {
      scrollingElement: root,
      documentElement,
      body,
      getElementById: id => id === 'musicChatDock' && playerPresent ? dock : null,
      querySelector: selector => selector === '.music-premium' && playerPresent ? {} : null,
    },
    window: {
      innerHeight: 800,
      scrollTo: (x, y) => { sandbox.window.lastScroll = [x, y]; },
      addEventListener: (name, fn) => { listeners[name] = fn; },
    },
    setTimeout: fn => { queued.push(fn); return queued.length; },
    clearTimeout: () => {},
  };
  documentElement.classList = { contains: name => name === 'north-apple-remote-safe' && appleSafe };
  vm.createContext(sandbox);
  vm.runInContext(`let _mView='player';${viewportSource()};globalThis.api={
    reset:musicViewportReset,
    dockToKeyboard:musicChatDockToKeyboard,
    focus:musicChatViewportFocus,
    blur:musicChatViewportBlur,
    resize:musicChatViewportResize,
    setView:v=>{_mView=v},
    focused:()=>_mChatViewportFocused,
    baseline:()=>_mChatViewportHeight
  };`, sandbox);
  return { sandbox, root, documentElement, body, dock, listeners, queued, setPlayerPresent: value => { playerPresent = value; }, setAppleSafe: value => { appleSafe = value; } };
}

test('music player resets only its residual document pan', () => {
  const h = harness();
  assert.equal(h.sandbox.api.reset(), true);
  assert.equal(h.root.scrollTop, 0);
  assert.equal(h.root.scrollLeft, 0);
  assert.equal(h.documentElement.scrollTop, 0);
  assert.equal(h.body.scrollTop, 0);
  assert.equal(h.body.scrollLeft, 0);
  assert.deepEqual(h.sandbox.window.lastScroll, [0, 0]);

  h.root.scrollTop = 42;
  h.sandbox.api.setView('home');
  assert.equal(h.sandbox.api.reset(), false);
  assert.equal(h.root.scrollTop, 42);

  h.sandbox.api.setView('player');
  h.setPlayerPresent(false);
  assert.equal(h.sandbox.api.reset(), false);
  assert.equal(h.root.scrollTop, 42);
});

test('web keyboard events never move the document or detach the music composer',()=>{const h=harness();h.sandbox.window.visualViewport={height:500,offsetTop:0};h.sandbox.api.focus();h.sandbox.window.innerHeight=500;h.listeners.resize();h.sandbox.api.blur();assert.equal(h.root.scrollTop,61);assert.equal(h.queued.length,0);assert.equal(h.dock.lastScrollOptions,undefined);});
test('private music keyboard does not use the previous document jump loop',()=>{const h=harness();h.sandbox.window.__SMALL_PHONE_PRIVATE__=true;h.sandbox.api.focus();h.listeners.resize();h.sandbox.api.blur();assert.equal(h.root.scrollTop,61);assert.equal(h.queued.length,0);assert.equal(h.dock.lastScrollOptions,undefined);});

test('music input owns the recovery hooks without restoring a global viewport hack', () => {
  assert.match(app, /id="m_chat"[^>]*onfocus="musicChatViewportFocus\(\)"[^>]*onblur="musicChatViewportBlur\(\)"/);
  assert.match(app, /function musicToggleChat\(\)[\s\S]*?input\.blur\(\)[\s\S]*?musicChatViewportBlur\(\)/);
  assert.match(app, /function musicChatNaturalKeyboardFlow\(\)[\s\S]*?north-apple-remote-safe/);
  const ordinaryApp=app.replace(/function northViewportDiagnosticStart\([^\n]*\n/,'');
  assert.doesNotMatch(ordinaryApp, /visualViewport\.addEventListener\(['"](?:resize|scroll)['"]/, 'the optional diagnostic observer is not a keyboard layout hook');
  assert.doesNotMatch(app, /--north-app-height/);
});
