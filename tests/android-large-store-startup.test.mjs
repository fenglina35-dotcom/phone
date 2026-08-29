import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const html=readFileSync(join(root,'小手机.html'),'utf8');
const app=readFileSync(join(root,'app.js'),'utf8');
const sw=readFileSync(join(root,'sw.js'),'utf8');
const repair=readFileSync(join(root,'repair.html'),'utf8');

function functionSource(name){
  const marker=`function ${name}(`,found=app.indexOf(marker),start=found>=6&&app.slice(found-6,found)==='async '?found-6:found;
  assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);let depth=0,quote='',escape=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

function bootGuardSource(){
  const marker='/* 安卓启动保护：资源或旧缓存出错时显示自救页，不让用户只看到黑屏。 */';
  const start=html.indexOf(marker),end=html.indexOf('</script>',start);
  assert.ok(start>=0&&end>start,'missing Android boot guard');
  return html.slice(start+marker.length,end);
}

test('the 12 second Android watchdog reports progress without replacing the app',()=>{
  const timers=new Map(),listeners={},message={textContent:''};
  const host={_html:'',querySelector:sel=>sel==='.bootmsg'?message:null,set innerHTML(v){this._html=v;},get innerHTML(){return this._html;}};
  const window={__NORTH_SHELL_BUILD__:'1105',addEventListener:(type,fn)=>{listeners[type]=fn;}};
  const context=vm.createContext({window,document:{getElementById:id=>id==='app'?host:null},location:{pathname:'/小手机.html',hash:''},setTimeout:(fn,ms)=>{timers.set(ms,fn);return ms;},String,Date});
  vm.runInContext(bootGuardSource(),context);
  timers.get(12000)();
  assert.match(message.textContent,/网络较慢/);
  assert.equal(host.innerHTML,'');
  window.__northBootStarted=true;
  timers.get(12000)();
  assert.match(message.textContent,/存档较大/);
  assert.equal(host.innerHTML,'');
  timers.get(60000)();
  assert.match(host.innerHTML,/小手机没有正常启动/);
  assert.match(host.innerHTML,/不会删除聊天、角色或密钥/);
});

test('real critical script errors still fail immediately',()=>{
  const listeners={},host={innerHTML:'',querySelector:()=>null};
  const window={addEventListener:(type,fn)=>{listeners[type]=fn;}};
  const context=vm.createContext({window,document:{getElementById:id=>id==='app'?host:null},location:{pathname:'/小手机.html',hash:''},setTimeout:()=>0,String,Date});
  vm.runInContext(bootGuardSource(),context);
  listeners.error({message:'app.js syntax error',filename:'http://local/app.js',target:window});
  assert.match(host.innerHTML,/小手机没有正常启动/);
  assert.match(host.innerHTML,/浏览器内核过旧或脚本没有完整加载/);
});

test('Android uses visible image hydration while desktop web keeps full hydration',()=>{
  assert.match(app,/function lazyStoredImagesOn\(\)\{return privateNativeAppOn\(\)\|\|NORTH_ANDROID;\}/);
  assert.match(app,/const lazy=lazyStoredImagesOn\(\),keys=lazy\?privateBootImageKeys\(\):imageRefKeys\(S\)/);
  assert.match(app,/if\(!lazy\)_rehydrate\(S\)/);
  assert.match(app,/function scheduleVisibleStoredImages\(force,alreadyHydrated\)\{if\(!lazyStoredImagesOn\(\)\)return;/);
});

test('the cache repair page bypasses the app shell and explicit recovery is network first',()=>{
  assert.match(sw,/request\.mode==='navigate'&&\/\(\?:\^\|\\\/\)\(\?:repair\|index\)\\\.html\$\//);
  assert.match(sw,/fetch\(request,\{cache:'no-store'\}\)/);
  assert.match(sw,/url\.searchParams\.has\('reload'\).*?url\.searchParams\.has\('open'\).*?url\.searchParams\.has\('from'\)/s);
  const install=sw.slice(sw.indexOf("self.addEventListener('install'"),sw.indexOf("self.addEventListener('activate'"));
  assert.doesNotMatch(install,/warmOptionalFiles\(/,'optional media and icon warming must not block the new worker takeover');
  assert.match(sw.slice(sw.indexOf("self.addEventListener('activate'")),/setTimeout\(\(\)=>warmOptionalFiles\(\)\.catch\(\(\)=>\{\}\),15000\)/);
  assert.doesNotMatch(repair,/localStorage\.(?:clear|removeItem)|sessionStorage\.clear|indexedDB\.deleteDatabase/,'cache repair must never delete user state');
});

test('Android never renders the empty core shell while a large store is still restoring',()=>{
  assert.match(app,/if\(!_coreBootRef&&!_androidOrphanCoreProbe\)finishAppBoot\(\);else if\(!NORTH_ANDROID&&_coreBootRef\)/);
  assert.match(app,/完成前不会显示空数据/);
});

test('Android recovers a meaningful orphaned IndexedDB core before treating the browser as new',async()=>{
  const stored={settings:{chat:{}},me:{name:'保留的用户'},contacts:[{id:'c1'}],messages:{c1:[{id:'m1'}]}};
  const sandbox={
    _coreBootRef:null,_androidOrphanCoreProbe:true,_coreOverflowMode:false,_coreLogicalBytes:0,
    CORE_IDB_KEY:'__core_state',RECOVERY_IDB_KEY:'__recovery_state',S:{_fresh:true},
    imgGet:async key=>key==='__core_state'?{ver:1,savedAt:321,json:JSON.stringify(stored)}:null,
    recoveryStateStats:d=>({contacts:Array.isArray(d&&d.contacts)?d.contacts.length:0}),
    recoveryStateMeaningful:stats=>!!(stats&&stats.contacts),mergeStateData:d=>d,
    storedTextBytes:s=>s.length,normalizeLoadedState:()=>{},window:{__northBootProgress:s=>{sandbox.progress=s;}},
    writeCoreBootShell:at=>{sandbox.shellAt=at;},imgPut:async()=>{},setTimeout:()=>0,toast:()=>{},Date,JSON
  };
  vm.createContext(sandbox);
  vm.runInContext(functionSource('bootOverflowCore'),sandbox);
  assert.equal(await sandbox.bootOverflowCore(),true);
  assert.equal(sandbox.S.me.name,'保留的用户');
  assert.equal(sandbox.shellAt,321,'the compact local index is rebuilt without rewriting the recovered core');
  assert.equal(sandbox._androidOrphanCoreProbe,false);
  assert.match(sandbox.progress,/已找回安卓浏览器中的原核心存档/);
});
