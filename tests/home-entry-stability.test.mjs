import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, '小手机.html'), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('cancelled taps retain the click fallback while real drags stay suppressed', () => {
  const ctx = vm.createContext({
    clearTimeout() {},
    $() { return null; },
  });
  vm.runInContext(`let _aTimer=null,_aFlip=null,_aFlipDir=0,_aPend={k:'douyin'},_aDrag=null,_aNoClick=7;function appTouchGuardDetach(){};${functionSource('appCancel')};globalThis.api={cancel:appCancel,noClick:()=>_aNoClick,setDrag:v=>{_aDrag=v}};`, ctx);
  ctx.api.cancel();
  assert.equal(ctx.api.noClick(), 7, 'a simple pointercancel must not block the browser click fallback');
  ctx.api.setDrag({ ghost: { remove() {} } });
  ctx.api.cancel();
  assert.ok(ctx.api.noClick() > 7, 'a real drag must still suppress the trailing click');
});

test('pointerup launches on the next task so WeChat cannot click through into a chat', () => {
  const queued = [];
  const calls = [];
  const ctx = vm.createContext({
    appLocked: () => false,
    privateNativeAppOn: () => false,
    toast() {},
    LOCKABLE: {},
    APPRUN: { wechat: () => calls.push('wechat'), douyin: () => calls.push('douyin') },
    setTimeout: fn => { queued.push(fn); return queued.length; },
  });
  vm.runInContext(`let _aNoClick=0;${functionSource('appLaunch')};globalThis.appLaunch=appLaunch;`, ctx);
  ctx.appLaunch('wechat');
  assert.deepEqual(calls, [], 'the page must not change inside pointerup');
  assert.equal(queued.length, 1);
  queued.shift()();
  assert.deepEqual(calls, ['wechat']);
  assert.match(functionSource('openWeChat'), /wxTab=tab\|\|'chats';go\('wechat'\)/);
});

test('Douyin repairs incomplete restored data every time it opens', () => {
  const ctx = vm.createContext({ S: { dy: { profile: null, feed: 'legacy', users: [] } } });
  vm.runInContext(`${functionSource('dyInit')};globalThis.dyInit=dyInit;`, ctx);
  assert.equal(ctx.dyInit(), true);
  for (const key of ['feed', 'liked', 'following', 'dms', 'history', 'mine']) assert.ok(Array.isArray(ctx.S.dy[key]), key);
  assert.deepEqual({ ...ctx.S.dy.profile }, { nick: '', avatar: null, bio: '记录美好生活✨' });
  assert.deepEqual({ ...ctx.S.dy.users }, {});
  assert.equal(ctx.dyInit(), false, 'a repaired store must remain stable');
  assert.match(functionSource('openDouyin'), /if\(dyInit\(\)\)save\(0\)/);
  assert.match(functionSource('renderDouyin'), /^function renderDouyin\(\)\{dyInit\(\)/);
});

test('the restored four-app dock and page dots stay fixed above scrollable home content', () => {
  assert.match(source, /<div class="home-scroll">[\s\S]*?<div class="appswipe"/);
  assert.match(source, /<div class="dock home-dropzone" data-zone="dock">\$\{homeDockHtml\(\)\}<\/div>/);
  assert.match(source, /const HOME_DOCK_DEFAULT=\['calendar','games','mail','settings'\];/);
  assert.match(html, /\.home\{[^}]*overflow:hidden/);
  assert.match(html, /\.home-scroll\{[^}]*flex:1;[^}]*overflow-y:auto/);
  assert.match(html, /\.pgdots\{position:relative;[^}]*flex:none/);
  assert.match(html, /\.dock\{position:relative;[^}]*flex:none/);
  assert.doesNotMatch(html, /\.apps,\.dock\{position:relative/);
});

test('home widgets, apps, and dock share live reorder data without browser text selection', () => {
  assert.match(source, /function homeLayoutInit\(\)/);
  assert.match(source, /function homeTokenCell\(k\)/);
  assert.match(source, /function appLiveReorder\(x,y\)/);
  assert.match(source, /appSwapNodes\(d\.item,target\)/);
  assert.match(source, /function homeReferenceSlotsRefresh\(page\)/);
  assert.match(source, /function homeSecondSlotsRefresh\(page\)/);
  assert.match(source, /refresh=\(\)=>\{homeReferenceSlotsRefresh\(document\.querySelector\('#appswipe \.glass-reference-page'\)\);homeSecondSlotsRefresh\(document\.querySelector\('#appswipe \.glass-second-page'\)\);\}/);
  assert.match(source, /function homeLayoutReadDom\(\)/);
  assert.match(source, /data-token="w:\$\{k\}" onpointerdown="appDown\(event,'w:\$\{k\}'\)"/);
  assert.match(html, /\.home,\.home \*\{[^}]*-webkit-user-select:none;user-select:none;-webkit-touch-callout:none/);
  assert.match(html, /\.home\.home-editing \.dock \.app/);
});

test('home paging uses native touch scrolling and only a real long press takes ownership', () => {
  const scroll = functionSource('homePgScroll');
  assert.doesNotMatch(scroll, /setTimeout\(\(\)=>homeSnapPage/);
  assert.match(source, /onscrollend="homeSnapPage\(this\)" onpointerup="homeSnapPage\(this\)" onpointercancel="homeSnapPage\(this\)"/);
  const css = fs.readFileSync(path.join(root, 'glass-theme.css'), 'utf8');
  assert.match(css, /#homeDesktop \.home-item\{touch-action:manipulation\}/);
  assert.match(css, /body\.home-drag-active #homeDesktop \.home-item\{touch-action:none\}/);
  assert.match(source, /function appPendingMove\(x,y\)/);
  assert.doesNotMatch(source, /p\.sw\.scrollLeft=p\.swLeft-dx/);
  assert.doesNotMatch(source, /function appPanMove\(/);
  assert.match(scroll, /if\(next!==_homePage\)/);
});

test('the first glass page persists empty app slots instead of compacting every drop', () => {
  assert.match(source, /function homeReferenceAppSlotMap\(pg\)/);
  assert.match(source, /function homeReferencePageAtPoint\(x,y\)/);
  assert.match(source, /function homeReferenceSlotAtPoint\(page,x,y\)/);
  assert.match(source, /function homeReferenceMoveToSlot\(page,item,n\)/);
  assert.match(source, /homeReferenceAppSlots=map/);
  assert.match(source, /homeReferenceAppSlots','appIcons/);
  assert.match(source, /glass-app-drop-slot/);
  const live = functionSource('appLiveReorder');
  assert.match(live, /homeReferencePageAtPoint\(x,y\)/, 'transparent Android empty slots must not depend only on elementFromPoint');
  assert.match(live, /homeReferenceSlotAtPoint\(ref,x,y\)/);
  assert.match(live, /homeReferenceMoveToSlot\(ref,d\.item,refSlot\)/);
  assert.match(functionSource('appDrop'), /appLiveReorder\(x,y\).*?_aDrag=null/, 'the final Android touch coordinate must be committed before drag teardown');
  const read = functionSource('homeLayoutReadDom');
  assert.match(read, /beforeSet\.size!==afterSet\.size/);
  assert.match(read, /some\(k=>!afterSet\.has\(k\)\)/, 'a transient missing app must not replace the stored layout');
});

test('layout repair never forces overflow or newly discovered apps into the eight-slot first page', () => {
  const appDefs = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`app${i}`, {}]));
  const appCtx = vm.createContext({
    S: { me: { appLayout: [['app0'], [], []], appDock: [] } },
    APPDEFS: appDefs,
    APP_DEFLAYOUT: [[], [], []],
    APP_PAGES: 3,
  });
  vm.runInContext(`${functionSource('appLayoutInit')};appLayoutInit();`, appCtx);
  assert.deepEqual(Array.from(appCtx.S.me.appLayout[0]), ['app0']);
  assert.equal(appCtx.S.me.appLayout[1].length, 13);

  const homeCtx = vm.createContext({
    S: { me: {
      _glassReferenceLayoutV2: 1,
      appDock: [],
      appLayout: [[], [], []],
      homeLayout: [['w:dashboard', ...Object.keys(appDefs).slice(0, 11)], [], []],
      widgets: ['dashboard'],
    } },
    APPDEFS: appDefs,
    APP_PAGES: 3,
    HOME_DOCK_DEFAULT: [],
    HOME_REFERENCE_APP_SLOTS: Array(8).fill('slot'),
    HOME_SHORTCUTS: {},
    WIDS: [['dashboard']],
    widInit() {},
    appLayoutInit() {},
    homeTokenValid(k) { return k === 'w:dashboard' || !!appDefs[k]; },
    homeLayoutSyncLegacy() {},
    save() {},
  });
  vm.runInContext(`${functionSource('homeLayoutInit')};homeLayoutInit();`, homeCtx);
  assert.equal(homeCtx.S.me.homeLayout[0].filter(k => appDefs[k]).length, 8);
  assert.ok(homeCtx.S.me.homeLayout[1].includes('app8'));
  assert.equal(new Set(homeCtx.S.me.homeLayout.flat()).size, homeCtx.S.me.homeLayout.flat().length);

  const css = fs.readFileSync(path.join(root, 'glass-theme.css'), 'utf8');
  assert.doesNotMatch(css, /\.glass-reference-page>\.app\{[^}]*width:auto/);
});

test('preferences adjust all home app icons and labels with portable state', () => {
  assert.match(source, /function homeAppAppearanceVars\(\)/);
  assert.match(source, /id="homeAppIconTone" type="range"/);
  assert.match(source, /id="homeAppTextTone" type="range"/);
  assert.match(source, /homeAppAppearanceSet\('icon',this\.value\)/);
  assert.match(source, /homeAppAppearanceSet\('text',this\.value\)/);
  assert.match(source, /'appIconTone','appTextTone'/);
  assert.match(html, /\.home \.app \.ic\{filter:brightness\(var\(--home-app-icon-tone,100%\)\)/);
  assert.match(html, /\.home \.app>span\{opacity:var\(--home-app-text-opacity,1\);\}/);
});
