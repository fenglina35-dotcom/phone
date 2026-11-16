import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { read, BUNDLES } from './_helpers.mjs';

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
  for (const key of ['feed', 'liked', 'following', 'dms', 'history', 'mine', 'visitors', 'watched', 'updates', 'closeFriends']) assert.ok(Array.isArray(ctx.S.dy[key]), key);
  /* 「我」页按真实抖音重做后多了这些展示字段；昵称/简介/性别/年龄一律留空由用户自己填，dyid 每台机器随机生成一次，只校验形状。 */
  const dyp = { ...ctx.S.dy.profile };
  assert.match(String(dyp.dyid), /^\d{11}$/, '抖音号应当自动生成 11 位');
  delete dyp.dyid;
  assert.deepEqual(dyp, { nick: '', avatar: null, bio: '', fans: 0, likes: 0, mutual: 0, gender: '', age: '', birth: '', loc: '', level: '', cover: '' });
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
  vm.runInContext(`${functionSource('homeGameEntriesMigrate')};${functionSource('appLayoutInit')};appLayoutInit();`, appCtx);
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
  vm.runInContext(`${functionSource('homeGameEntriesMigrate')}
${functionSource('homeLayoutInit')};homeLayoutInit();`, homeCtx);
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

test('moving game entries preserves customized positions and saved game data',()=>{
 const state={me:{homeLayout:[['wechat'],['tale','dread','clock']],appLayout:[['tale','dread']],appDock:['tale'],homeReferenceAppSlots:{tale:4,dread:5},appIcons:{tale:'my-old-icon',wechat:'mine'}},tale:{active:true,rules:['saved']},dread:{active:true,hp:3}};
 const before=JSON.stringify({tale:state.tale,dread:state.dread,icons:state.me.appIcons});
 const box=vm.createContext({S:state});vm.runInContext(functionSource('homeGameEntriesMigrate')+';homeGameEntriesMigrate();homeGameEntriesMigrate();',box);
 assert.deepEqual(Array.from(state.me.homeLayout[1]),['pixelhome','pet','clock']);assert.deepEqual(Array.from(state.me.appDock),['pixelhome']);
 assert.equal(JSON.stringify({tale:state.tale,dread:state.dread,icons:state.me.appIcons}),before);
 assert.equal(state.me.homeReferenceAppSlots.pixelhome,4);
});

for (const relative of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  test(relative + ' opens independent apps when optional game scripts are unavailable', () => {
    const body=fs.readFileSync(path.join(root,relative),'utf8');
    const start=body.indexOf('function openApp('),end=body.indexOf('/* ---------- 软件使用时长',start);
    for (const absent of ['openPixelHome','openPetGame','both']) {
      const routes=[],notices=[];
      const ctx=vm.createContext({S:{},appLocked:()=>false,LOCKABLE:{},toast:v=>notices.push(v),go:p=>routes.push(p),lockClearTarget:()=>false,save(){},openSpy(){},openX(){},openDouyin(){},openGames(){},openOfflineMenu(){},taleStart(){},dreadStart(){},openMusic(){},cinemaInit(){},tvInit(){}});
      if(absent!=='openPixelHome'&&absent!=='both')ctx.openPixelHome=()=>routes.push('pixelhome');
      if(absent!=='openPetGame'&&absent!=='both')ctx.openPetGame=()=>routes.push('pet');
      vm.runInContext(body.slice(start,end)+';globalThis.openApp=openApp;',ctx);
      for(const key of ['calendar','shop','food','browser','album','mail','phoneapp','roleplay'])ctx.openApp(key);
      assert.deepEqual(routes,['calendar','shop','food','browser','album','mail','phoneapp','rphub']);
      ctx.openApp(absent==='openPetGame'?'pet':'pixelhome');
      assert.equal(notices.length,1);assert.match(notices[0],/组件.*未加载/);
      const before=routes.length;ctx.appLocked=()=>true;ctx.openApp('shop');assert.equal(routes.at(-1),'couple');
      ctx.appLocked=()=>false;ctx.S.jail={active:true};ctx.openApp('food');assert.equal(routes.at(-1),'jail');assert.equal(routes.length,before+2);
    }
  });
}

test('web and private home clicks survive missing optional scripts and preserve navigation',async()=>{
 const {createServer}=await import('node:http'),{createRequire}=await import('node:module');
 const {chromium}=createRequire(import.meta.url)('playwright');
 const server=createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true])for(const missing of [[],['pixel-home.js'],['pet-game.js'],['pixel-home.js','pet-game.js']]){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
  await page.route('**/*',r=>{const url=new URL(r.request().url());if(url.origin!==origin)return r.abort();if(missing.some(n=>url.pathname.endsWith('/'+n)))return r.fulfill({status:200,contentType:'text/javascript',body:'/* simulated incomplete optional component response */'});return r.continue();});
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  for(const [key,route] of [['wechat','wechat'],['worldbook','worldbook'],['calendar','calendar'],['shop','shop'],['food','food'],['browser','browser'],['album','album'],['phoneapp','phoneapp'],['games','gameshub'],['mail','mail'],['settings','settings']]){
   await page.evaluate(()=>{S.me.locked=false;S.jail=null;S.couple={};_aNoClick=0;home();});
   await page.locator('.home-item[data-token="'+key+'"]').first().click({timeout:8000});
   await page.waitForFunction(p=>cur().p===p,route,{timeout:8000});
   await page.evaluate(()=>back());assert.equal(await page.evaluate(()=>cur().p),'home');
  }
  for(const [file,key] of [['pixel-home.js','pixelhome'],['pet-game.js','pet']])if(missing.includes(file)){
   await page.evaluate(k=>openApp(k),key);await page.waitForFunction(()=>/组件下载失败/.test(document.querySelector('#toast').innerText),null,{timeout:8000});assert.equal(await page.evaluate(()=>cur().p),'home');assert.match(await page.locator('#toast').innerText(),/组件下载失败/);
  }
  assert.deepEqual(errors,[],JSON.stringify({privateApp,missing,errors}));await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});

test('shell motion keeps real navigation immediate, cancellable, isolated and optional',async()=>{
 const {createServer}=await import('node:http'),{createRequire}=await import('node:module');
 const {chromium}=createRequire(import.meta.url)('playwright');
 const server=createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(name.endsWith('app.js')?read(name):fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{for(const [kind,file] of BUNDLES){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+'/'+(kind==='web'?'小手机.html':path.dirname(file)+'/index.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  const first=await page.evaluate(()=>{S.me.locked=false;S.jail=null;S.couple={};home();shellMotionLaunch('wechat');openWeChat();const p=document.querySelector('#app>.page');return {route:cur().p,motion:p.dataset.shellMotion,active:p.getAnimations().length,ghostIds:document.querySelectorAll('.shell-motion-ghost [id]').length,ghostInteractive:document.querySelectorAll('.shell-motion-ghost [onclick]').length};});
  assert.equal(first.route,'wechat');assert.equal(first.motion,'launch');assert.equal(first.active,0,'the root does not move its title');assert(await page.evaluate(()=>document.querySelector('#app>.page').getAnimations({subtree:true}).some(a=>_shellMotionJobs.includes(a))),'app content entrance is restored');assert.equal(first.ghostIds,0);assert.equal(first.ghostInteractive,0);
  const stable=await page.evaluate(()=>{shellMotionReset();render();return {active:document.querySelector('#app>.page').getAnimations().length,ghosts:document.querySelectorAll('.shell-motion-ghost').length};});assert.deepEqual(stable,{active:0,ghosts:0},'same-page background redraw must not replay entry');
  const immediate=await page.evaluate(()=>{go('worldbook');back();home();openSettings();home();return {route:cur().p,pages:document.querySelectorAll('#app>.page:not(.shell-motion-ghost)').length,ghosts:document.querySelectorAll('.shell-motion-ghost').length};});assert.equal(immediate.route,'home');assert.equal(immediate.pages,1);assert(immediate.ghosts<=1);
  await page.waitForFunction(()=>document.querySelectorAll('.shell-motion-ghost').length===0&&document.querySelector('#app>.page').getAnimations().length===0).catch(async e=>{console.log('motion settle diagnostic',await page.evaluate(()=>({last:_shellMotionLast&&{key:_shellMotionLast.key,view:_shellMotionLast.view,page:_shellMotionLast.page},ghosts:document.querySelectorAll('.shell-motion-ghost').length,animations:document.querySelector('#app>.page').getAnimations().map(a=>({state:a.playState,name:a.animationName,frames:a.effect.getKeyframes()}))})));throw e;});
  await page.evaluate(()=>{home();openSettings();});await page.waitForFunction(()=>document.querySelector('#app>.page').getAnimations().length===0);
  for(const category of ['voice','appearance','network','media','vision','behavior','data','code']){
   const settingsFrame=await page.evaluate(category=>{settingsCategoryOpen(category);const p=document.querySelector('#app>.page'),meta=settingsCategoryMeta(),host=document.querySelector('#setpage'+meta.tab);return {category,wrong:meta.tab===3||category==='code'?[]:Array.from(host.children).filter(e=>e.id&&!meta.ids.includes(e.id)&&getComputedStyle(e).display!=='none').map(e=>e.id),rootFades:p.getAnimations().flatMap(a=>a.effect.getKeyframes()).filter(k=>k.opacity!==undefined&&Number(k.opacity)<1).map(k=>k.opacity),contentMoves:!!p.querySelector('#settingsscroll')?.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.transform)),hiddenGroups:_shellMotionJobs.filter(a=>a.effect?.target?.matches('.section,.ios-settings-group')&&a.effect.getKeyframes().some(k=>Number(k.opacity)===0)).length};},category);
   assert.deepEqual(settingsFrame.wrong,[],kind+': '+category+' hides unrelated settings synchronously before the first paint');assert.deepEqual(settingsFrame.rootFades,[],kind+': '+category+' keeps the full page background opaque');assert.equal(settingsFrame.hiddenGroups,0,'settings sections never disappear in staggered entry');assert.equal(settingsFrame.contentMoves,false,'settings titles and content never shift on navigation');
   const repaint=await page.evaluate(()=>{render();const p=document.querySelector('#app>.page');return {root:p.getAnimations().length,body:p.querySelector('#settingsscroll')?.getAnimations().length||0};});assert.deepEqual(repaint,{root:0,body:0},'same settings category redraw never restarts navigation animation');
  }
  await page.evaluate(()=>settingsCategoryOpen('voice'));await page.locator('#set_tts .sw').first().click();const toggled=await page.evaluate(()=>({category:_setCategory,wrong:Array.from(document.querySelector('#setpage1').children).filter(e=>e.id&&e.id!=='set_tts'&&getComputedStyle(e).display!=='none').map(e=>e.id),root:document.querySelector('#app>.page').getAnimations().length}));assert.deepEqual(toggled,{category:'voice',wrong:[],root:0},'a real settings switch redraw is immediately filtered and has no page fade');
  await page.evaluate(()=>home());
  for(const route of ['wechat','wxsettings','wxwallet','music','worldbook','gameshub','travel','mail','browser','tasks']){
   const audit=await page.evaluate(async route=>{home();go(route);openModal('<h3>本地动效排查</h3>');const sheet=document.querySelector('#modalSheet'),motion=sheet.getAnimations()[0];render();await new Promise(requestAnimationFrame);const p=document.querySelector('#app>.page'),result={route:cur().p,pages:document.querySelectorAll('#app>.page:not(.shell-motion-ghost)').length,opacity:getComputedStyle(p).opacity,rootAnimations:p.getAnimations().length,ghosts:document.querySelectorAll('.shell-motion-ghost').length,sameSheet:sheet===document.querySelector('#modalSheet'),sameAnimation:!motion||sheet.getAnimations()[0]===motion};closeModal();back();home();return result;},route);
   assert.equal(audit.route,route);assert.equal(audit.pages,1);assert.equal(audit.opacity,'1',route+' background repaint remains opaque');assert.equal(audit.rootAnimations,0,route+' same-page redraw never repeats navigation');assert.equal(audit.ghosts,0,route+' redraw has no stale outgoing copy');assert(audit.sameSheet&&audit.sameAnimation,route+' modal is preserved without replay while its page repaints');
  }
  await page.waitForFunction(()=>!document.querySelector('.shell-motion-ghost'));
  const inventory=await page.evaluate(()=>Object.keys(APPRUN));assert(inventory.length>=23,'inventory follows all real main-screen app definitions');
  for(const appKey of inventory){
   const coverage=await page.evaluate(async key=>{S.couple=S.couple||{};S.couple.cid=S.contacts[0].id;home();const observed=[],original=Element.prototype.animate;Element.prototype.animate=function(...args){const motion=original.apply(this,args);if(this.closest('#app>.page,#cw-holder'))observed.push(motion);return motion;};try{appLaunch(key);await new Promise(r=>setTimeout(r,30));await new Promise(requestAnimationFrame);}finally{Element.prototype.animate=original;}const p=document.querySelector('#app>.page'),profile=shellMotionProfile(cur(),p);const buttons=Array.from(p.querySelectorAll('button,[role="button"],.sw[onclick]')).filter(e=>!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&e.getClientRects().length&&e.getBoundingClientRect().height>0&&!e.closest('[inert]')&&!e.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"]'));return {key,route:cur().p,scope:p.classList.contains('shell-ui-scope'),profile,buttons:buttons.length,uncovered:buttons.filter(e=>!wxUiTarget(e)).map(e=>({tag:e.tagName,cls:e.className,text:(e.textContent||'').trim().slice(0,35)})).slice(0,4),pages:document.querySelectorAll('#app>.page:not(.shell-motion-ghost)').length,contentMotions:observed.filter(a=>a.effect.getKeyframes().some(k=>k.transform&&!(new DOMMatrix(k.transform)).isIdentity||k.opacity!==undefined&&Number(k.opacity)<1)).length,excluded:shellContentMotionExcluded(cur(),p,null),surface:key==='couple'?{mark:document.querySelector('#cw-holder')?.dataset.shellSurface,known:_shellSurfaceRecords.has(document.querySelector('#cw-holder')),state:_shellSurfaceRecords.get(document.querySelector('#cw-holder'))?.animation?.playState,transition:document.querySelector('#cw-holder')&&getComputedStyle(document.querySelector('#cw-holder')).transitionDuration}:null};},appKey);
   assert.notEqual(coverage.route,'home',kind+': '+appKey+' launches through the real app entry');assert.equal(coverage.pages,1);if(coverage.profile!=='protected'){assert(coverage.scope,kind+': '+appKey+' mounts common interaction');if(!coverage.excluded)assert(coverage.contentMotions>0,kind+': '+appKey+' retains an actual app animation '+JSON.stringify(coverage));assert.deepEqual(coverage.uncovered,[],kind+': '+appKey+' existing buttons all reach the passive feedback layer');}
  }
  console.log(kind+' main app interaction inventory passed: '+inventory.length);
  await page.evaluate(()=>{home();openSettings('voice');});const sw=page.locator('#set_tts .sw').first();const beforeSwitch=await page.evaluate(()=>ttsEnabled(S.settings.tts));await sw.click();assert.equal(await page.evaluate(()=>ttsEnabled(S.settings.tts)),!beforeSwitch,'settings switch business runs exactly once');const afterSwitch=page.locator('#set_tts .sw').first();assert.equal(await afterSwitch.getAttribute('data-shell-switch'),!beforeSwitch?'on':'off','rebuilt switch retains its thumb animation');assert(await afterSwitch.evaluate(e=>e.getAnimations({subtree:true}).some(a=>String(a.animationName||'').startsWith('shellSwitch'))));await page.evaluate(()=>render());assert.equal(await page.locator('#set_tts .sw').first().getAttribute('data-shell-switch'),null,'ordinary repaint never replays a switch');
  await page.locator('#s_tbase').fill('https://draft.invalid');assert.equal(await page.evaluate(()=>wxUiTarget(document.querySelector('#s_tbase'))),null);assert.equal(await page.locator('#s_tbase').inputValue(),'https://draft.invalid');
  await page.evaluate(()=>home());
  const modal=await page.evaluate(()=>{openModal('<h3>动效测试</h3><button onclick="closeModal()">关闭</button>');const active=document.querySelector('#modalSheet').getAnimations().length;closeModal();return{active:active,closed:!document.querySelector('#modal').classList.contains('show')};});assert(modal.active>0);assert(modal.closed);
  const games=await page.evaluate(()=>{
   const rows=[];const sample=()=>{const p=document.querySelector('#app>.page');rows.push({route:cur().p,profile:p.dataset.shellMotionProfile,opacityOnly:p.getAnimations().every(a=>a.effect.getKeyframes().every(f=>!f.transform)),ghosts:document.querySelectorAll('.shell-motion-ghost').length});};
   home();openPetGame();sample();home();beadStartNew(S.contacts[0].id);sample();home();dgStartNew(S.contacts[0].id,'me');sample();dgStopRuntime();home();return rows;
  });for(const game of games){assert.equal(game.profile,'live');assert(game.opacityOnly);assert.equal(game.ghosts,0);}
  const reader=await page.evaluate(()=>{cinemaInit();S.cinema.settings.autoComment=false;const s={id:'motion-book',cid:S.contacts[0].id,kind:'book',title:'动效回归书',items:[],page:0};S.cinema.sessions.push(s);_cin.sessionId=s.id;_cin.bookPages=['第一页内容','第二页内容'];go('cinemaread');const p=document.querySelector('#app>.page'),first=p.dataset.shellMotionProfile;cinemaBookPage(1);return{first,page:s.page,route:cur().p,profile:document.querySelector('#app>.page').dataset.shellMotionProfile,ghosts:document.querySelectorAll('.shell-motion-ghost').length};});assert.equal(reader.first,'live');assert.equal(reader.profile,'live');assert.equal(reader.page,1);assert.equal(reader.ghosts,0);
  // A real, silent PCM source exercises the production video element without a paid model or external media.
  await page.evaluate(()=>{home();cinemaInit();const bytes=new ArrayBuffer(44+16000*2*3),d=new DataView(bytes),str=(at,s)=>{for(let i=0;i<s.length;i++)d.setUint8(at+i,s.charCodeAt(i));};str(0,'RIFF');d.setUint32(4,bytes.byteLength-8,true);str(8,'WAVEfmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,16000,true);d.setUint32(28,32000,true);d.setUint16(32,2,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,bytes.byteLength-44,true);const s={id:'motion-video',cid:S.contacts[0].id,kind:'video',title:'静音媒体回归',items:[],progress:0};S.cinema.sessions.push(s);_cin.sessionId=s.id;_cin.provider='';_cin.videoUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));go('cinemawatch');window.motionMedia=document.querySelector('#cinVideo');window.motionMedia.muted=true;});
  await page.locator('#cinVideo').evaluate(v=>v.play());await page.locator('#cinInput').fill('尚未发送的草稿');
  await page.evaluate(()=>{window.motionMediaAt=motionMedia.currentTime;shellSurfaceFade(motionMedia);openModal('<h3>播放不中断</h3>');closeModal();});
  await page.waitForFunction(()=>motionMedia.currentTime>motionMediaAt+.05);
  const media=await page.evaluate(()=>({same:motionMedia===document.querySelector('#cinVideo'),playing:!motionMedia.paused,draft:document.querySelector('#cinInput').value,profile:document.querySelector('#app>.page').dataset.shellMotionProfile,transform:getComputedStyle(document.querySelector('#app>.page')).transform}));assert(media.same&&media.playing);assert.equal(media.draft,'尚未发送的草稿');assert.equal(media.profile,'live');assert.equal(media.transform,'none');
  await page.evaluate(()=>{cinemaReleaseMedia();home();S.couple={cid:S.contacts[0].id};openPixelHome();window.motionFrame=document.querySelector('#pixel-home-frame');window.motionFrameWindow=motionFrame.contentWindow;render();});
  assert(await page.evaluate(()=>motionFrame===document.querySelector('#pixel-home-frame')&&motionFrame.contentWindow===motionFrameWindow));assert.equal(await page.locator('#app>.page').getAttribute('data-shell-motion-profile'),'live');await page.evaluate(()=>home());
  if(kind==='private'){const cozy=await page.evaluate(()=>{openCozyHome();const frame=document.querySelector('#cozy-home-frame'),win=frame&&frame.contentWindow;render();const same=!!frame&&frame===document.querySelector('#cozy-home-frame')&&win===frame.contentWindow,profile=document.querySelector('#app>.page').dataset.shellMotionProfile;home();return{same,profile};});assert(cozy.same);assert.equal(cozy.profile,'live');}
  await page.evaluate(()=>{_call={id:S.contacts[0].id,kind:'video',state:'outgoing',opened:true,min:false};renderCall();window.motionCall=document.querySelector('#callLayer');});await page.waitForFunction(()=>document.querySelector('#callLayer').dataset.shellSurface==='fade');
  const call=await page.evaluate(()=>{const before=motionCall.getAnimations()[0];renderCall();return{same:before===motionCall.getAnimations()[0],plain:motionCall.getAnimations().every(a=>a.effect.getKeyframes().every(k=>!k.transform))};});assert(call.same&&call.plain);await page.evaluate(()=>{_call.min=true;renderCall();});await page.waitForFunction(()=>_shellSurfaceRecords.get(document.querySelector('#callLayer')).variant==='mini');await page.evaluate(()=>{_call=null;renderCall();});
  await page.evaluate(()=>viewImg(S.contacts[0].avatar));await page.waitForFunction(()=>document.querySelector('#viewer').dataset.shellSurface==='fade');await page.locator('#viewer').click();assert.equal(await page.locator('#viewer').getAttribute('class').then(v=>v.split(' ').includes('show')),false);
  await page.evaluate(()=>{const n=document.createElement('section');n.className='nr-root';n.innerHTML='<canvas></canvas><div class="nr-overlay"><section class="nr-panel">独立画布浮层生命周期夹具<button id="motionOwnedOverlayButton">本地按钮</button></section></div>';document.body.appendChild(n);window.motionSurface=n;window.motionSurfaceCanvas=n.querySelector('canvas');});await page.waitForFunction(()=>motionSurface.dataset.shellSurface==='fade');
  assert(await page.locator('#motionOwnedOverlayButton').evaluate(e=>wxUiTarget(e)===e),'owned game pause overlay buttons share feedback without touching the canvas');
  assert(await page.evaluate(()=>{render();return motionSurfaceCanvas===motionSurface.querySelector('canvas');}));await page.evaluate(()=>motionSurface.remove());await page.waitForFunction(()=>!_shellSurfaceRecords.has(motionSurface));
  const protectedProfile=await page.evaluate(()=>shellMotionProfile({p:'robotFace'},null));assert.equal(protectedProfile,'protected');
  await page.emulateMedia({reducedMotion:'reduce'});const reduced=await page.evaluate(()=>{home();go('worldbook');return{route:cur().p,active:document.querySelector('#app>.page').getAnimations().length,ghosts:document.querySelectorAll('.shell-motion-ghost').length,surfaces:_shellSurfaceJobs.size};});assert.deepEqual(reduced,{route:'worldbook',active:0,ghosts:0,surfaces:0});
  await page.emulateMedia({reducedMotion:'no-preference'});const isolated=await page.evaluate(()=>{home();const old=S;S=Object.assign({},S);go('worldbook');const active=document.querySelector('#app>.page').getAnimations().length;S=old;return active;});assert.equal(isolated,0,'replaced account state never crossfades private old content');
  const fallback=await page.evaluate(()=>{Element.prototype.animate=undefined;home();openSettings();return cur().p;});assert.equal(fallback,'settings');assert.deepEqual(errors,[],kind);await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});


test('all registered internal routes render under the shared motion boundary',async()=>{
 const {createServer}=await import('node:http'),{createRequire}=await import('node:module'),{chromium}=createRequire(import.meta.url)('playwright');
 const server=createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(name.endsWith('app.js')?read(name):fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{for(const [kind,file] of BUNDLES){
  const code=read(file),begin=code.indexOf("if(c.p==='home')html=renderHome()"),end=code.indexOf('const _wxGlassPages=',begin),routes=[...new Set([...code.slice(begin,end).matchAll(/c\.p==='([^']+)'/g)].map(m=>m[1]))].filter(r=>!['robotFace','momentDetail'].includes(r));
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'no-preference'}),errors=[];let routeNow='boot';page.on('pageerror',e=>errors.push({route:routeNow,message:e.message}));await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();if(/\/(couple-windowsill|games\/(pixel-home|cozy-home))\/index\.html$/.test(u.pathname))return r.fulfill({contentType:'text/html',body:'<!doctype html><canvas aria-label="独立场景边界夹具"></canvas>'});return r.continue();});await page.goto(origin+'/'+(kind==='web'?'小手机.html':path.dirname(file)+'/index.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{S.me.locked=false;S.jail=null;S.settings.sound=false;S.settings.manualReply=true;S.settings.manualReplyScenes={wechat:true,games:true,offline:true,roleplay:true};S.contacts.forEach(c=>c.proactive={enabled:false});S.couple={cid:S.contacts[0].id};S.groups=S.groups||[];if(!S.groups.length)S.groups.push({id:'matrix-group',name:'仅本地页面检查',members:[S.contacts[0].id],msgs:[],owner:'me'});msgs(S.contacts[0].id).push({id:'matrix-transfer',role:'assistant',type:'transfer',amount:1,time:Date.now()});S.moments.push({id:'matrix-moment',authorId:S.contacts[0].id,acct:actId(),text:'页面检查',time:Date.now(),likes:[],comments:[],images:[]});cinemaInit();const book={id:'matrix-book',cid:S.contacts[0].id,kind:'book',title:'检查用书',items:[],page:0};S.cinema.sessions.push(book);_cin.sessionId=book.id;_cin.bookPages=['检查用文本'];});
  await page.evaluate(()=>{window.internalCatalogSeed=JSON.stringify(S);});
  const registered=await page.evaluate(()=>Object.keys(window.NorthExtraPages||{}));registered.forEach(r=>{if(!routes.includes(r))routes.push(r);});
  if(process.env.MOTION_ROUTE_FOCUS){const only=process.env.MOTION_ROUTE_FOCUS.split(',');routes.splice(0,routes.length,...routes.filter(r=>only.includes(r)));}
  const failures=[],empty=[];
  for(const route of routes){routeNow=route;const result=await page.evaluate(async route=>{try{S=JSON.parse(internalCatalogSeed);_couTab=1;_dySub='';_hisLogin=null;home();if(typeof dgStopRuntime==='function')dgStopRuntime();if(typeof _gs!=='undefined'&&_gs&&_gs._tm)clearInterval(_gs._tm);const cid=S.contacts[0].id,gid=S.groups[0].id;
S.x.tweets=[{id:'matrix-tweet',who:cid,name:S.contacts[0].name,handle:'@matrix',text:'本地检查',time:Date.now(),likes:[],comments:[]}];S.x.dms=[{id:'matrix-xdm',cid,name:S.contacts[0].name,avatar:'',msgs:[]}];S.dy.dms=[{id:'matrix-dydm',cid,name:S.contacts[0].name,avatar:'',msgs:[]}];
if(['hiswx','hismoments','hischat'].includes(route)){_hisLogin={cid,until:Date.now()+600000};hisSeed(cid);}
if(route==='wg')_wg={cid,phase:'meGuess',word:'检查',desc:'本地界面',len:2,guesses:[],score:0,t:60,showWord:false};
if(route==='uc')_uc={phase:'desc',players:[{id:'me',name:'我',isMe:true,alive:true,word:'本地'},{id:cid,cid,name:'检查角色',alive:true,word:'本地'}],order:[0,1],turn:0,round:1,civWord:'本地',ucWord:'检查',showWord:false,busy:false};
const params={id:cid,cid,gid,key:cid,pid:'matrix-moment',mid:'matrix-transfer',num:'13800000001',fid:'__me',name:S.contacts[0].name,scope:'role',kind:'group',type:'text'};if(route==='drawguess'){dgStartNew(cid,'me');}else if(route==='beadstudio'&&typeof beadStartNew==='function'){beadStartNew(cid);}else{if(route==='xtweet')params.id='matrix-tweet';if(route==='xdm')params.id='matrix-xdm';if(route==='dydm')params.id='matrix-dydm';if(route==='group'||['ginfo','gmanage','gsettings','gqr','gsearch'].includes(route))params.id=gid;if(route==='gs')_gs={cid,kind:'truth',title:'本地检查',intro:'',msgs:[{id:'matrix-gs',who:'me',text:'检查'}],t:60,busy:false};go(route,params);}await new Promise(requestAnimationFrame);if(route==='couple')await new Promise(r=>setTimeout(r,60));const p=document.querySelector('#app>.page');return {route:cur().p,empty:!p||!p.textContent.trim(),html:p?.innerHTML.slice(0,160),visual:!!p?.querySelector('iframe,canvas')||!!document.querySelector('#cw-holder iframe'),headingMotion:Array.from(p?.querySelectorAll('.nav .t,.wx-main-title,.xnav,.phtitle,h1,h2,header h3,[role=heading]')||[]).flatMap(el=>{const bad=[];for(let n=el;n&&p.contains(n);n=n.parentElement)for(const a of n.getAnimations())if(a.effect.getKeyframes().some(k=>k.transform&&!(new DOMMatrix(k.transform)).isIdentity))bad.push(el.textContent.trim().slice(0,30));return bad;}),scope:p?.classList.contains('shell-ui-scope'),profile:shellMotionProfile(cur(),p),pages:document.querySelectorAll('#app>.page:not(.shell-motion-ghost)').length};}catch(e){return {error:String(e&&e.message||e)};}},route);if(result.error)failures.push({route,error:result.error});else{if(result.headingMotion.length)failures.push({route,error:'moving page title',titles:result.headingMotion});if(result.route!==route)failures.push({route,error:'unexpected redirect to '+result.route});if(result.empty)empty.push({route,actual:result.route,html:result.html,visual:result.visual});if(result.empty&&!result.visual)failures.push({route,error:'empty page without a visual surface'});if(result.pages!==1)failures.push({route,error:'business page count '+result.pages});if(route!=='home'&&result.profile!=='protected'&&!result.scope)failures.push({route,error:'missing interaction boundary'});}}
  console.log(kind+' internal route catalog: '+routes.length+'; empty contexts: '+JSON.stringify(empty));assert.deepEqual(failures,[],kind+' route rendering failures');assert.deepEqual(errors,[],kind+' asynchronous route errors');await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});


test('internal app tabs, album panels, tasks, roleplay and travel preserve real interactions',async()=>{
 const {createServer}=await import('node:http'),{createRequire}=await import('node:module'),{chromium}=createRequire(import.meta.url)('playwright');const server=createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(name.endsWith('app.js')?read(name):fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{for(const [kind,file] of BUNDLES){const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin+'/'+(kind==='web'?'小手机.html':path.dirname(file)+'/index.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);await page.evaluate(()=>{S.me.locked=false;S.settings.sound=false;S.settings.manualReply=true;S.settings.manualReplyScenes={wechat:true,games:true,offline:true,roleplay:true};S.contacts.forEach(c=>c.proactive={enabled:false});S.couple={cid:S.contacts[0].id};});
 const check=async (family,excluded=false)=>{const result=await page.evaluate(()=>{const p=document.querySelector('#app>.page'),headings=Array.from(p.querySelectorAll(SHELL_TITLE_SELECTOR));return {design:p.dataset.shellContentMotion,root:p.getAnimations().length,ghosts:document.querySelectorAll('.shell-motion-ghost').length,active:p.getAnimations({subtree:true}).filter(a=>_shellMotionJobs.includes(a)).length,movingTitle:headings.some(el=>{for(let n=el;n&&p.contains(n);n=n.parentElement)if(n.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.transform&&!(new DOMMatrix(k.transform)).isIdentity)))return true;return false;})};});assert.equal(result.movingTitle,false,kind+' '+family+' title is anchored');assert.equal(result.root,0);assert.equal(result.ghosts,0);if(excluded)assert.equal(result.design,'none',kind+' excluded content stays still');else{assert(result.active>0,kind+' '+family+' retains real content motion '+JSON.stringify(result));assert.notEqual(result.design,'none');}};
 await page.evaluate(()=>go('dy'));for(const tab of ['friend','dm','me','feed']){await page.locator('.dytab .t').filter({hasText:({friend:'朋友',dm:'消息',me:'我',feed:'首页'})[tab]}).click();assert.equal(await page.evaluate(()=>dyTab),tab);await check('douyin');}await page.locator('.dytab .t').filter({hasText:'我'}).click();for(const tab of ['喜欢','收藏','作品']){await page.locator('.dyme-tabs>span').filter({hasText:tab}).click();assert.equal(await page.evaluate(()=>_dyMeTab),tab);await check('douyin',true);}
 await page.evaluate(()=>go('x'));for(const tab of ['search','dm','me','feed']){await page.evaluate(tab=>{const el=Array.from(document.querySelectorAll('[onclick]')).find(e=>e.getAttribute('onclick')===`xTab='${tab}';render()`);if(!el)throw new Error('missing real X tab '+tab);el.click();},tab);assert.equal(await page.evaluate(()=>xTab),tab);await check('x');}await page.locator('.xtabs .xt').filter({hasText:'发现'}).click();await check('x');
 await page.evaluate(()=>go('phoneapp'));for(const tab of ['contacts','keypad','sms','voicemail','fav','recents']){await page.locator('.phtab [onclick]').evaluateAll((els,tab)=>{const el=els.find(e=>e.getAttribute('onclick')===`phTab('${tab}')`);if(!el)throw new Error('missing phone tab '+tab);el.click();},tab);assert.equal(await page.evaluate(()=>phState().tab),tab);await check('phone');}await page.evaluate(()=>phTab('keypad'));await page.locator('.phkey').filter({hasText:/^1$/}).click();assert.equal(await page.evaluate(()=>phState().keypad),'1');
 await page.evaluate(()=>go('album'));for(const text of ['图库','精选集']){await page.locator('.photo-album-tabs button').filter({hasText:text}).click();await check('album');}await page.getByRole('button',{name:'精选集更多选项'}).click();await page.waitForFunction(()=>document.querySelector('.photo-collection-menu')?.getAnimations().length>0);assert(await page.locator('.photo-collection-menu').evaluate(e=>e.getAnimations().length>0),'album menu has an actual transition');await page.locator('.photo-album-sort-dismiss').click({position:{x:5,y:5}});
 await page.evaluate(()=>{const c=S.contacts[0];S.couple.tasksEnabled=true;c.relation='恋人';c.tasks={date:todayStr(),assignTs:Date.now(),list:[{id:'internal-essay',text:'本地作业检查',verify:'essay',target:100,done:false,due:'23:59'}]};go('tasks');});await check('tasks');await page.locator('.tn-card[data-id="internal-essay"] .tn-check').click();await page.locator('#essay_t').fill('动画不应丢失这段尚未提交的作业');assert.equal(await page.locator('#essay_t').inputValue(),'动画不应丢失这段尚未提交的作业');assert.equal(await page.evaluate(()=>tasksToday(taskC()).list[0].done),false);await page.evaluate(()=>closeModal());for(const tab of ['all','reward','me','today']){await page.locator("[onclick=\"TaskNotes.tab('"+tab+"')\"]").click();await check('tasks');}
 await page.evaluate(()=>go('rphub'));for(const filter of ['active','ready','all']){await page.locator('.rp-studio-tabs button').filter({hasText:({active:'进行中',ready:'未开局',all:'全部'})[filter]}).click();await check('roleplay');}await page.evaluate(()=>go('rpset',{id:S.contacts[0].id}));await check('roleplay');await page.evaluate(()=>rpMemory(S.contacts[0].id,'saves'));await page.locator('.rp-mem-tabs button').filter({hasText:'总结'}).click();await page.waitForFunction(()=>document.querySelector('#modal').dataset.shellPartialMotion==='content');assert.equal(await page.evaluate(()=>_rpMemTab),'sum');await page.evaluate(()=>closeModal());
 await page.evaluate(()=>{go('travel');NorthTravelHome.home();});for(const action of ['train','flight','hotel','concert','guide','tickets']){await page.locator('[data-travel-action="'+action+'"]').first().click();await check('travel',true);if(action==='train'||action==='flight'){for(const name of ['往返','多程','单程']){await page.getByRole('button',{name,exact:true}).click();await check('travel',true);}}await page.evaluate(()=>NorthTravelHome.home());await check('travel');}await page.locator('.ctr-account').click();await check('travel',true);await page.evaluate(()=>NorthTravelHome.home());
 await page.evaluate(()=>{go('x');render();});assert.equal(await page.locator('#app>.page').evaluate(e=>e.getAnimations().length),0);assert.deepEqual(errors,[],kind);console.log(kind+' deep tab flows passed: Douyin/X/phone/album/tasks/roleplay/travel');await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
