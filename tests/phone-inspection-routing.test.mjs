import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const routingSource = app.match(/const PHONE_NON_WECHAT_TARGET=[\s\S]*?(?=\nfunction applyAuxTags)/)?.[0] || '';
const restoreAllSource = app.match(/function phoneInspectionRestoreAllPermissionsIntent\(text\)[\s\S]*?(?=\nfunction remoteControlIntentContext)/)?.[0] || '';

function routingHarness(wxLoginAuth) {
  const context = {
    S: { couple: { cid: 'role-1', wxLoginAuth } },
    _remoteIntentPurpose: {},
    _remoteIntentContext: {},
  };
  vm.runInNewContext(`${restoreAllSource}
${routingSource}
this.routePhoneInspectionTags = routePhoneInspectionTags;`, context);
  return context;
}

test('inspection tags preserve the role chosen entry point while recording remote purpose', () => {
  assert.match(app, /function phoneInspectionNonWechatIntent\(text\)/);
  assert.match(app, /function phoneInspectionWechatOnly\(text\)/);
  assert.match(app, /function phoneInspectionRestoreAllPermissionsIntent\(text\)/);
  assert.match(app, /function routePhoneInspectionTags\(content,c,requestText\)/);
  assert.match(app, /if\(_wxLoginCompletion\)\{const before=content;content=wxLoginCompletionVisibleContent\(content\);if\(roleInterceptDiagnosticComparable\(before,false\)!==roleInterceptDiagnosticComparable\(content,false\)\)_replyAuditPartial=true;\}else content=routePhoneInspectionTags\(content,c,_userText\)/);
  assert.match(app, /if\(!_rawOutput&&!_wxLoginCompletion\)\{const _nativeInspectionQueued=maybeSpyIntent/);
  assert.match(app, /content=\(_videoVision\|\|_screenShareEvent\)\?content:routePhoneInspectionTags\(content,c,_luc&&msgToText\(_luc\)\)/);
  assert.match(app, /if\(hasRemote\)[\s\S]*?remember\(restoreAll\?'restore_all_permissions'/);
  assert.doesNotMatch(app, /入口分流是硬规则/);
});

test('routing behavior no longer rewrites a single entry tag chosen by the role', () => {
  const enabled = routingHarness(true);
  assert.match(enabled.routePhoneInspectionTags('我只看微信。\\n[申请远程操控]', { id: 'role-1' }, '你查一下微信'), /\[申请远程操控\]/);
  assert.match(enabled.routePhoneInspectionTags('我去看看。\\n[登录微信]', { id: 'role-1' }, '帮我查一下抖音私信'), /\[登录微信\]/);
  assert.match(enabled.routePhoneInspectionTags('我去查抖音。\\n[登录微信]', { id: 'role-1' }, '随便你'), /\[申请远程操控\]/);

  const disabled = routingHarness(false);
  const restore = disabled.routePhoneInspectionTags('我去看微信。\\n[登录微信]', { id: 'role-1' }, '你查一下微信');
  assert.match(restore, /\[登录微信\]/);
  assert.equal(disabled._remoteIntentPurpose['role-1'], undefined);
});

test('a disabled WeChat login permission is restored through a consented narrow remote session', () => {
  assert.match(app, /remember\(restoreAll\?'restore_all_permissions':\(onlyWx&&!\(S\.couple&&S\.couple\.cid===c\.id&&S\.couple\.wxLoginAuth\)\)\?'restore_wx':'inspect_phone'\)/);
  assert.match(app, /purpose==='restore_wx'/);
  assert.match(app, /targetId:'wxLoginAuth'/);
  assert.match(app, /resumeWx[\s\S]*?wxDoLogin\(c\.id\)/);
  const request = app.match(/function remoteControlRequest\(cid\)[\s\S]*?(?=\nfunction remoteControlDeny)/)?.[0] || '';
  assert.doesNotMatch(request, /remote-consent-copy|ta这次只会进入情侣空间/);
});

test('disabled couple permissions remain visible and can be re-enabled by the role', () => {
  assert.match(app, /function remoteControlCouplePermissions\(\)/);
  assert.match(app, /function remoteControlEnableCouplePermission\(key\)/);
  assert.match(app, /'enable_couple_permission'/);
  assert.match(app, /closedCouplePermissions/);
  assert.match(app, /app==='couple'[\s\S]*?couplescroll[\s\S]*?behavior:'smooth'/);
  assert.match(app, /remoteControlDesktopKey\(app\)[\s\S]*?couple:'wechat'/);
});

test('turning off the remote-request switch does not bypass per-session consent', () => {
  assert.match(app, /function remoteControlAllowed\(cid\)\{return !!\(S\.couple&&S\.couple\.cid===cid\);\}/);
  assert.match(app, /remoteControlRequest\(cid\)[\s\S]*?_remoteRequest=\{cid,ts:Date\.now\(\),purpose,intentContext\}/);
  assert.match(app, /remoteControlApprove\('\$\{c\.id\}'\)/);
  assert.match(app, /remoteControlDeny\('\$\{c\.id\}'\)/);
});

// Role-phone desktop: retain real app targets, independent customization and refresh budget.
function spyDesktopFunction(name,text=app){const start=text.indexOf('function '+name+'(');assert.notEqual(start,-1);const rest=text.slice(start);return rest.slice(0,rest.search(/\n(?:async )?function /));}
function spyDesktopFixture(){const roles={a:{id:'a',name:'Alice',avatar:'🐱'},b:{id:'b',name:'Bob'}},ctx={roles,getC:id=>roles[id],actId:()=> 'main',esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'),jq:s=>"'"+s+"'",svgIc:()=>'<svg/>',av:s=>'<div class="avatar">'+s+'</div>',hm:()=> '09:30',_spyBusy:false,_spyHomePage:{},_spyPin:'',_spyWrong:{},_spyLockUntil:{},_spyLockTimer:1,_spyShake:false,spyLockAvatar:()=>'<div>avatar</div>',setTimeout(){},save(){ctx.saved=(ctx.saved||0)+1;},render(){ctx.rendered=(ctx.rendered||0)+1;},toast(){},closeModal(){},$:()=>ctx.input,openModal:s=>ctx.modal=s,pickFile:(type,fn)=>ctx.pick=fn,compressChatBackground:async()=> 'data:image/jpeg;base64,small',compress:async()=> 'data:image/jpeg;base64,small',compressSquare:async()=> 'data:image/jpeg;base64,square',primeImageForSave:async()=>{}};vm.createContext(ctx);const defs=app.match(/const SPY_APPS=.*\r?\nconst SPYICON=.*\r?\n/)[0];vm.runInContext(defs+['spyAppearance','spyAppearanceImage','spyAppearanceName','spyAppearanceNameKey','spyAppearanceNameSave','spyAppearanceWallpaperReset','spyAppearanceLockWallpaperReset','spyLockScreen','spyAppearanceSettings','spyHomePageChanged','spyHomePageGo','spyHomeMount','spyHome'].map(n=>spyDesktopFunction(n)).join('\n'),ctx);return ctx;}
test('role desktop keeps all 15 app targets split into eight and three with four persistent dock apps with no model request on open',()=>{const x=spyDesktopFixture(),html=x.spyHome('a',x.roles.a,{messageToYou:'Hello <script>',location:'Paris'});assert.equal((html.match(/class="spy-home-app"/g)||[]).length,15);const sections=[...html.matchAll(/<section class="spy-app-page"[^>]*>([\s\S]*?)<\/section>/g)];assert.equal((sections[0][1].match(/class="spy-home-app"/g)||[]).length,8);assert.equal((sections[1][1].match(/class="spy-home-app"/g)||[]).length,3);const dock=html.match(/<section class="spy-glass spy-app-dock"[^>]*>([\s\S]*?)<\/section>/)[1];assert.equal((dock.match(/class="spy-home-app"/g)||[]).length,4);assert.match(html,/Hello &lt;script&gt;/);assert.match(html,/spyOpen[^\n]*settings/);assert.doesNotMatch(html,/搜索|chatAPI/);assert.doesNotMatch(sections[0][1],/spyReset/);assert.match(sections[1][1],/spyReset[^>]*>重置存档/);assert.doesNotMatch(x.spyAppearanceSettings('a',x.roles.a),/spyReset/);assert.equal(x.saved,undefined);assert.equal(x.roles.a._spyAppearance,undefined);});
test('role wallpaper, cover, avatar and display name stay independent of each other and other roles',async()=>{const x=spyDesktopFixture();x.spyAppearanceImage('a','cover');await x.pick({});x.spyAppearanceImage('a','wallpaper');await x.pick({});x.spyAppearanceImage('a','avatar');await x.pick({});x.input={value:'My Alice'};x.spyAppearanceNameSave('a');x.spyAppearanceWallpaperReset('a');assert.equal(x.roles.a._spyAppearance.cover,'data:image/jpeg;base64,small');assert.equal(x.roles.a._spyAppearance.avatar,'data:image/jpeg;base64,square');assert.equal(x.roles.a._spyAppearance.name,'My Alice');assert.equal(x.roles.a._spyAppearance.wallpaper,undefined);assert.equal(x.roles.a.name,'Alice');assert.equal(x.roles.b._spyAppearance,undefined);assert.match(x.spyAppearanceSettings('a',x.roles.a),/设置手机壁纸/);const persisted=JSON.parse(JSON.stringify(x.roles.a));assert.equal(persisted._spyAppearance.name,'My Alice');});
test('swiping changes dots and page restoration without rebuilding or saving the role phone',()=>{const x=spyDesktopFixture(),dots=[0,1].map(()=>({classList:{toggle(){}},setAttribute(){}})),el={scrollLeft:390,clientWidth:390,parentNode:{querySelectorAll:()=>dots}};x.spyHomePageChanged(el,'a');assert.equal(x._spyHomePage['main@a'],1);el.scrollLeft=0;x.$=()=>el;x.spyHomeMount('a');assert.equal(el.scrollLeft,390);assert.equal(x.rendered,undefined);assert.equal(x.saved,undefined);});
test('web and private keep the same role desktop and only manual existing refresh generates today words',()=>{const priv=readFileSync(join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),'utf8');for(const name of ['spyHome','spyAppearanceImage','spyAppearanceSettings','spyHomeMount'])assert.equal(spyDesktopFunction(name,priv),spyDesktopFunction(name));const refresh=spyDesktopFunction('spyRefresh');assert.match(refresh,/messageToYou/);assert.equal((refresh.match(/await chatAPI\(/g)||[]).length,1);const css=readFileSync(join(root,'glass-theme.css'),'utf8');assert.match(css,/\.spy-glass:before\{[^}]*padding:\.8px[^}]*mask-composite:exclude/);assert.doesNotMatch(css.match(/\.spy-glass\{[^}]+\}/)[0],/rgba\(255,255,255/);});

test('role full-screen photographs reuse the bounded clear chat background pipeline',()=>{assert.match(spyDesktopFunction('spyAppearanceImage'),/compressChatBackground\(f\)/);assert.doesNotMatch(spyDesktopFunction('spyAppearanceImage'),/1200|1000|\.78/);const pipeline=spyDesktopFunction('compressChatBackground');assert.match(pipeline,/2600,\.93/);assert.match(pipeline,/3000000/);assert.match(pipeline,/1800,\.84/);});

test('inline role-name editing avoids a modal and cancelled or empty edits preserve the saved name',()=>{const x=spyDesktopFixture();assert.doesNotMatch(spyDesktopFunction('spyAppearanceName'),/openModal/);assert.match(spyDesktopFunction('spyAppearanceName'),/outerHTML/);x.input={value:' ',dataset:{}};x.spyAppearanceNameSave('a');assert.equal(x.roles.a._spyAppearance,undefined);x.input={value:'Changed',dataset:{cancel:'1'}};x.spyAppearanceNameSave('a');assert.equal(x.roles.a._spyAppearance,undefined);assert.equal(x.saved,undefined);x.input={value:'Alice',dataset:{}};x.spyAppearanceNameSave('a');assert.equal(x.saved,undefined);let blurred=false;const ev={key:'Enter',preventDefault(){},currentTarget:{blur(){blurred=true;},dataset:{}}};x.spyAppearanceNameKey(ev,'a');assert.equal(blurred,true);ev.key='Escape';x.spyAppearanceNameKey(ev,'a');assert.equal(ev.currentTarget.dataset.cancel,'1');});

test('role passcode background is independent and ten glass numeric keys and plain cancel/delete controls retain the original PIN actions',async()=>{const x=spyDesktopFixture();x.roles.a._spyAppearance={wallpaper:'home',cover:'cover',avatar:'avatar'};x.spyAppearanceImage('a','lockWallpaper');await x.pick({});assert.equal(x.roles.a._spyAppearance.lockWallpaper,'data:image/jpeg;base64,small');assert.equal(x.roles.a._spyAppearance.wallpaper,'home');assert.equal(x.roles.a._spyAppearance.cover,'cover');assert.equal(x.roles.b._spyAppearance,undefined);assert.match(x.spyAppearanceSettings('a',x.roles.a),/更换拨号盘背景/);const html=x.spyLockScreen('a',x.roles.a);assert.equal((html.match(/class="spy-glass spy-lock-key/g)||[]).length,10);assert.equal((html.match(/class="spy-lock-action"/g)||[]).length,2);assert.doesNotMatch(html,/spy-glass spy-lock-key spy-lock-action/);assert.match(html,/spyPinDel/);assert.match(html,/spyExit/);assert.match(html,/spy-lock-avatar/);x._spyLockUntil.a=Date.now()+60000;assert.equal((x.spyLockScreen('a',x.roles.a).match(/ disabled/g)||[]).length,11);x.spyAppearanceLockWallpaperReset('a');assert.equal(x.roles.a._spyAppearance.lockWallpaper,undefined);assert.equal(x.roles.a._spyAppearance.wallpaper,'home');assert.equal(x.roles.a._spyAppearance.avatar,'avatar');});
test('glass passcode UI still requires the right PIN and preserves three-failure cooldown',()=>{const x=spyDesktopFixture();Object.assign(x,{S:{spy:{a:{}}},_spyUnlock:{},_spyEnter:{},spyPwd:()=> '1234',recordVisit(){},spyRefresh(){throw Error('unexpected model refresh');},spyBusted(){x.busted=true;},spyStartLockTimer(){x.timerStarted=true;},cur:()=>({p:'spy'})});vm.runInContext(spyDesktopFunction('spyPin')+'\n'+spyDesktopFunction('spyPinDel'),x);x.spyPin('a','1');x.spyPin('a','2');x.spyPinDel('a');assert.equal(x._spyPin,'1');x.spyPin('a','2');x.spyPin('a','3');x.spyPin('a','4');assert.equal(x._spyUnlock.a,true);x._spyUnlock.a=false;for(let i=0;i<3;i++)for(const n of '0000')x.spyPin('a',n);assert.equal(x._spyUnlock.a,false);assert.equal(x.busted,true);assert.equal(x.timerStarted,true);for(const n of '1234')x.spyPin('a',n);assert.equal(x._spyUnlock.a,false);assert.equal(x._spyPin,'');});
