import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import vm from 'node:vm';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const app=readFileSync(join(root,'app.js'),'utf8');

function functionSource(name){
  const asyncStart=app.indexOf(`async function ${name}`);
  const start=asyncStart>=0?asyncStart:app.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('recovery scoring counts accounts, roles, chats and memories',()=>{
  const context=vm.createContext({});
  vm.runInContext(functionSource('recoveryStateStats')+';'+functionSource('recoveryStateMeaningful')+';globalThis.stats=recoveryStateStats;globalThis.meaningful=recoveryStateMeaningful;',context);
  const state={me:{accounts:[{id:'main'},{id:'alt'}],phoneFriend:{messages:{friend:[{id:1}]},groupMessages:{group:[{id:2}]}}},contacts:[{id:'a',memory:['m'],summaries:[{text:'s'}]},{id:'b',deleted:true}],messages:{a:[{id:3},{id:4}]},moments:[{}],groups:[{}]};
  const stats=context.stats(state);
  assert.equal(stats.accounts,2);
  assert.equal(stats.contacts,1);
  assert.equal(stats.messages,4);
  assert.equal(stats.memories,2);
  assert.equal(stats.moments,1);
  assert.equal(stats.groups,1);
  assert.equal(context.meaningful(stats),true);
  assert.equal(context.meaningful(context.stats({me:{accounts:[{id:'main'}]},contacts:[],messages:{}})),false);
});

test('recovery button scans residual core, snapshot and long-chat storage before replacing data',()=>{
  assert.match(app,/const CORE_IDB_KEY='__core_state',RECOVERY_IDB_KEY='__recovery_state',RECOVERY_HISTORY_IDB_KEY='__recovery_history_state'/);
  assert.match(app,/恢复所有数据（扫描本机存档）/);
  assert.match(functionSource('recoveryCollectCandidates'),/\[RECOVERY_IDB_KEY,'本机安全快照'\],\[CORE_IDB_KEY,'大容量核心存档'\],\[RECOVERY_HISTORY_IDB_KEY,'历史完整快照'\]/);
  assert.match(functionSource('recoveryCollectCandidates'),/imgGet\('__messages'\)/);
  assert.match(functionSource('recoveryCollectCandidates'),/out\.sort\(\(a,b\)=>\(b\.savedAt-a\.savedAt\)\|\|\(b\.stats\.score-a\.stats\.score\)/);
  assert.match(functionSource('emergencyRestoreAll'),/账号：/);
  assert.match(functionSource('emergencyRestoreAll'),/聊天：/);
  assert.match(functionSource('emergencyRestoreConfirm'),/await uiConfirm/);
  assert.match(functionSource('emergencyRestoreConfirm'),/S=mergeStateData\(c\.state\)/);
  assert.match(functionSource('emergencyRestoreConfirm'),/await webRecoveryPersistState\(\)/);
  assert.match(functionSource('webRecoveryPersistState'),/await saveNowAsync\(\)/);
  assert.match(functionSource('emergencyRestoreConfirm'),/原始残留副本没有被删除/);
});

test('automatic safety snapshot rolls forward to current time and archives an older richer copy',async()=>{
  const writes=new Map();
  const old={json:'{}',savedAt:1,stats:{accounts:3,contacts:5,messages:120,memories:8,moments:10,groups:2,score:1200}};
  const context=vm.createContext({JSON,Date,Promise,imgGet:async key=>key==='__recovery_state'?old:null,imgPut:async(key,value)=>{writes.set(key,value);}});
  vm.runInContext('let _recoverySnapshotAt=0,_recoverySnapshotWrite=Promise.resolve(true);const RECOVERY_IDB_KEY="__recovery_state",RECOVERY_HISTORY_IDB_KEY="__recovery_history_state";',context);
  for(const name of ['recoveryStateStats','recoveryStateMeaningful','queueRecoverySnapshot'])vm.runInContext(functionSource(name),context);
  const sparse={settings:{},me:{accounts:[{id:'main'},{id:'alt'}]},contacts:[],messages:{}};
  const now=Date.now();
  await vm.runInContext(`queueRecoverySnapshot(${JSON.stringify(JSON.stringify(sparse))},${now})`,context);
  assert.equal(writes.get('__recovery_history_state'),old);
  assert.equal(writes.get('__recovery_state').savedAt,now);
  assert.equal(writes.get('__recovery_state').stats.accounts,2);
});

test('automatic safety snapshot rejects an out-of-order older write',async()=>{
  let written=false;
  const current={json:'{}',savedAt:5000,stats:{accounts:2,contacts:1,messages:1,memories:0,moments:0,groups:0,score:223}};
  const context=vm.createContext({JSON,Date,Promise,imgGet:async()=>current,imgPut:async()=>{written=true;}});
  vm.runInContext('let _recoverySnapshotAt=0,_recoverySnapshotWrite=Promise.resolve(true);const RECOVERY_IDB_KEY="__recovery_state",RECOVERY_HISTORY_IDB_KEY="__recovery_history_state";',context);
  for(const name of ['recoveryStateStats','recoveryStateMeaningful','queueRecoverySnapshot'])vm.runInContext(functionSource(name),context);
  const older={settings:{},me:{accounts:[{id:'main'}]},contacts:[{id:'a'}],messages:{a:[{}]}};
  await vm.runInContext(`queueRecoverySnapshot(${JSON.stringify(JSON.stringify(older))},4000)`,context);
  assert.equal(written,false);
});

test('v914 shell and service worker are aligned',()=>{
  const html=readFileSync(join(root,'小手机.html'),'utf8');
  const sw=readFileSync(join(root,'sw.js'),'utf8');
  assert.match(app,/APP_VER='v1846 · 发送不闪'/);
  assert.match(html,/app\.js\?v=1846/);
  assert.match(sw,/BUILD='1846'/);
});

test('service worker activation never reloads the active app page',()=>{
  const html=readFileSync(join(root,'小手机.html'),'utf8');
  const sw=readFileSync(join(root,'sw.js'),'utf8');
  const start=html.indexOf("addEventListener('controllerchange'");
  const end=html.indexOf("var url='sw.js",start);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(html.slice(start,end),/location\.replace/);
  const activateStart=sw.indexOf("self.addEventListener('activate'");
  const fetchStart=sw.indexOf("self.addEventListener('fetch'",activateStart);
  assert.ok(activateStart>=0&&fetchStart>activateStart);
  const activation=sw.slice(activateStart,fetchStart);
  assert.match(activation,/self\.clients\.claim\(\)/);
  assert.doesNotMatch(activation,/client\.navigate|location\.(?:replace|reload)|clients\.openWindow/);
});


test('web recovery scanning respects lazy images and does not load the whole image database',async()=>{
 const liveCache={live:'data:image/png;base64,live'},c=vm.createContext({JSON,Map,Set,mergeStateData:x=>x,imgGet:async()=>null,imgAll:async()=>{throw Error('bulk image read during recovery');},imgMany:async()=>{throw Error('lazy recovery must not eagerly read images');},lazyStoredImagesOn:()=>true,imageRefKeys:()=>['avatar'],_imgCache:liveCache,_imgRev:new Map([['live','live']]),_imgReady:new Set(['live']),_rehydrate:()=>{throw Error('lazy refs must not expand');},mergeBootMessages:(a,b)=>({...a,...b})});
 vm.runInContext(functionSource('recoveryHydrateCandidate'),c);const input={settings:{},me:{avatar:'idb:avatar'},messages:{}};const out=await c.recoveryHydrateCandidate(input);assert.equal(out.me.avatar,'idb:avatar');assert.equal(c._imgCache,liveCache);assert.deepEqual(Object.keys(c._imgCache),['live']);
});

test('desktop manual recovery reads only candidate image references',async()=>{
 const calls=[],c=vm.createContext({JSON,Map,Set,mergeStateData:x=>x,imgGet:async()=>null,imgAll:async()=>{throw Error('must not scan every media value');},imgMany:async keys=>{calls.push(Array.from(keys));return{wanted:'data:image/png;base64,ok'};},lazyStoredImagesOn:()=>false,imageRefKeys:()=>['wanted'],_imgCache:{live:'existing'},_imgRev:new Map(),_imgReady:new Set(),_rehydrate:n=>{n.me.avatar='data:image/png;base64,ok';},mergeBootMessages:(a,b)=>({...a,...b})});vm.runInContext(functionSource('recoveryHydrateCandidate'),c);await c.recoveryHydrateCandidate({settings:{},me:{avatar:'idb:wanted'}});assert.deepEqual(calls,[['wanted']]);assert.equal(c._imgCache.live,'existing');
});

test('manual recovery save failure restores the previous in-memory state',async()=>{
 const before={settings:{},marker:'live',messages:{r:[{id:'kept'}]}},db=new Map();let saves=0;const c=vm.createContext({JSON,Date,Promise,Set,S:before,actId:()=> 'main',_recoveryCandidate:{state:{settings:{},marker:'older',messages:{r:[]}}},_webRecoveryBusy:false,_fullBackupImportBusy:false,WEB_RECOVERY_BEFORE_KEY:'__before',WEB_RECOVERY_PINS_KEY:'__pins',uiConfirm:async()=>true,closeModal(){},toast(){},mergeStateData:x=>JSON.parse(JSON.stringify(x)),normalizeLoadedState(){},initAccounts(){},syncBlocks(){},phoneFriendState(){},saveNowAsync:async()=>false,webRecoveryBeforeState:async()=>JSON.parse(JSON.stringify(before)),webRecoveryPersistState:async()=>++saves>1,webRecoveryImageStatus:async()=>({total:0,missing:0,available:0}),imageRefKeys:()=>[],imgGet:async key=>db.get(key),imgPut:async(key,v)=>{db.set(key,v);},_coreBootRef:null,_coreOverflowMode:false,_coreLogicalBytes:0,stack:[],home(){},setTimeout(){},openModal(){},esc:String});
 vm.runInContext(functionSource('emergencyRestoreConfirm'),c);await c.emergencyRestoreConfirm();assert.equal(c.S.marker,'live');assert.equal(c.S.messages.r[0].id,'kept');
});

test('recovery cannot replace live data when saving the before snapshot fails',async()=>{
 const before={settings:{},marker:'live',messages:{}},c=vm.createContext({JSON,Date,Promise,Set,S:before,actId:()=> 'main',_recoveryCandidate:{state:{settings:{},marker:'older'}},_webRecoveryBusy:false,_fullBackupImportBusy:false,WEB_RECOVERY_BEFORE_KEY:'__before',WEB_RECOVERY_PINS_KEY:'__pins',uiConfirm:async()=>true,closeModal(){},toast(){},mergeStateData:x=>x,normalizeLoadedState(){},initAccounts(){},syncBlocks(){},phoneFriendState(){},saveNowAsync:async()=>true,webRecoveryBeforeState:async()=>before,webRecoveryPersistState:async()=>true,webRecoveryImageStatus:async()=>({total:0,missing:0,available:0}),imageRefKeys:()=>[],imgGet:async()=>null,imgPut:async()=>{throw Error('quota fixture');},_coreBootRef:null,_coreOverflowMode:false,_coreLogicalBytes:0,stack:[],home(){},setTimeout(){},openModal(){},esc:String});vm.runInContext(functionSource('emergencyRestoreConfirm'),c);await c.emergencyRestoreConfirm();assert.equal(c.S,before);
});


test('manual recovery reports missing refs without reading image bodies or changing the snapshot',async()=>{
 const state={me:{avatar:'idb:present',stickers:[{img:'idb:missing'}]}},original=JSON.stringify(state),c=vm.createContext({imageRefKeys:()=>['present','missing'],imgKeys:async()=>['present','unrelated'],Set,_idbOpenFailure:''});vm.runInContext(functionSource('webRecoveryImageStatus'),c);const st=await c.webRecoveryImageStatus(state);assert.equal(st.total,2);assert.equal(st.available,1);assert.equal(st.missing,1);assert.equal(JSON.stringify(state),original);
});

test('selected recovery images and the before-copy image manifest survive cleanup; unrelated orphans still delete',async()=>{
 const removed=[],c=vm.createContext({S:{},_recoveryCandidate:{state:{avatar:'idb:selected'}},imageRefKeys:o=>o.avatar?['selected']:[],_backupImportPins:new Set(),_imgCache:{},_imgRev:new Map(),_imgReady:new Set(),isBigImg:()=>false,_imgGCWrite:Promise.resolve(),imgKeys:async()=>['selected','before','orphan','__core_state'],webRecoveryProtectedImageKeys:async()=>['before'],imgDel:async k=>removed.push(k),Set,Promise});vm.runInContext(functionSource('imgUsedKeys')+'\n'+functionSource('imgGC'),c);await c.imgGC();assert.deepEqual(removed,['orphan']);
});

test('confirmed recovery evicts only selected stale image cache values and miss flags',()=>{
 const c=vm.createContext({lazyStoredImagesOn:()=>true,imageRefKeys:()=>['selected'],_imgCache:{selected:'bad-data',other:'healthy'},_imgRev:new Map([['bad-data','selected'],['healthy','other']]),_imgReady:new Set(['selected','other']),_visibleImageMisses:new Set(['selected','other'])});vm.runInContext(functionSource('webRecoveryRefreshImages'),c);c.webRecoveryRefreshImages({});assert.equal(c._imgCache.selected,undefined);assert.equal(c._imgCache.other,'healthy');assert(!c._visibleImageMisses.has('selected'));assert(c._imgReady.has('other'));
});

test('actual iPhone-like web recovery keeps refs, warns on missing media, restores available images and preserves its before copy',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const page=await browser.newPage({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/18.7 Mobile/15E148 Safari/604.1'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:8778')return route.abort();const f=join(root,decodeURIComponent(u.pathname.slice(1)));if(!f.startsWith(root)||!require('node:fs').existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({status:200,body:require('node:fs').readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});});await page.goto('http://127.0.0.1:8778/小手机.html?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
 const image='data:image/png;base64,'+readFileSync(join(root,'assets/meituan-kangaroo.png')).toString('base64');await page.evaluate(async image=>{S.me.locked=false;S.me.active='main';S.me.name='恢复前';S.me.accounts.find(a=>a.id==='main').name='恢复前';S.contacts.forEach(c=>c.proactive={enabled:false});await primeStateImagesForSave(S);compactReadyStateImages(S);await imgPut('recover-avatar',image);await imgPut('unrelated-media',image);const state=JSON.parse(JSON.stringify(S));state.me.name='恢复后';state.me.avatar='idb:recover-avatar';const account=state.me.accounts.find(a=>a.id==='main');account.name='恢复后';account.avatar='idb:recover-avatar';_imgCache['recover-avatar']='data:image/png;base64,broken';_visibleImageMisses.set('recover-avatar',Date.now());state.me.stickers=[{img:'idb:missing-media',meaning:'原图暂未找到'}];await imgPut(RECOVERY_IDB_KEY,{json:JSON.stringify(state),savedAt:Date.now()+100000});imgAll=async()=>{throw Error('bulk media read must not happen');};await emergencyRestoreAll();},image);
 assert((await page.locator('.modal').innerText()).includes('暂未找到'));assert.equal(await page.evaluate(()=>S.me.name),'恢复前');
 await page.evaluate(async()=>{uiConfirm=async()=>true;await emergencyRestoreConfirm();});assert.equal(await page.evaluate(()=>S.me.name),'恢复后');assert.equal(await page.evaluate(()=>S.me.stickers[0].img),'idb:missing-media');assert.equal(await page.evaluate(async()=>JSON.parse((await imgGet(WEB_RECOVERY_BEFORE_KEY)).json).me.name),'恢复前');assert.equal(await page.evaluate(async()=>!!await imgGet('unrelated-media')),true);
 await page.evaluate(()=>go('settings'));await page.waitForFunction(()=>{const img=document.querySelector('.ios-settings-account .avatar img');return img&&img.complete&&img.naturalWidth>0;});assert.deepEqual(errors,[]);await page.close();}finally{await browser.close();}
});


test('incoming live messages during before-copy IO abort recovery before state replacement',async()=>{
 const before={settings:{},marker:'live',messages:{r:[{id:'kept'}]}},db=new Map(),c=vm.createContext({JSON,Date,Promise,Set,S:before,actId:()=> 'main',_recoveryCandidate:{state:{settings:{},marker:'older',messages:{r:[]}}},_webRecoveryBusy:false,_fullBackupImportBusy:false,WEB_RECOVERY_BEFORE_KEY:'__before',WEB_RECOVERY_PINS_KEY:'__pins',uiConfirm:async()=>true,closeModal(){},toast(){},mergeStateData:x=>JSON.parse(JSON.stringify(x)),normalizeLoadedState(){},initAccounts(){},syncBlocks(){},phoneFriendState(){},webRecoveryBeforeState:async()=>JSON.parse(JSON.stringify(before)),webRecoveryPersistState:async()=>{throw Error('must not apply');},imageRefKeys:()=>[],imgGet:async key=>db.get(key),imgPut:async(key,v)=>{db.set(key,v);if(key==='__before')before.messages.r.push({id:'arrived'});},_coreBootRef:null,_coreOverflowMode:false,_coreLogicalBytes:0,stack:[],home(){},setTimeout(){},openModal(){},esc:String});vm.runInContext(functionSource('emergencyRestoreConfirm'),c);await c.emergencyRestoreConfirm();assert.equal(c.S,before);assert.equal(c.S.messages.r.at(-1).id,'arrived');assert.equal(c._webRecoveryBusy,false);
});

test('unreadable recovery protection metadata stops cleanup rather than deleting before-copy media',async()=>{
 const removed=[],c=vm.createContext({S:{},imageRefKeys:()=>[],_backupImportPins:new Set(),_imgCache:{},_imgRev:new Map(),_imgReady:new Set(),isBigImg:()=>false,_imgGCWrite:Promise.resolve(),imgKeys:async()=>['image'],webRecoveryProtectedImageKeys:async()=>null,imgDel:async k=>removed.push(k),Set,Promise});vm.runInContext(functionSource('imgUsedKeys')+'\n'+functionSource('imgGC'),c);assert.equal(await c.imgGC(),false);assert.deepEqual(removed,[]);
});


test('web recovery stops archive writes when account changes during inline-core IO',async()=>{
 let writes=0;const c=vm.createContext({JSON,S:{messages:{},me:{}},account:'main',actId:()=>c.account,webRecoveryInlineSave:async()=>{c.account='alt';return true;},writeMessageArchive:async()=>{writes++;},deleteMessageArchive:async()=>{writes++;},saveNowAsync:async()=>true});vm.runInContext(functionSource('webRecoveryPersistState'),c);await assert.rejects(c.webRecoveryPersistState(),/账号已切换/);assert.equal(writes,0);
});
