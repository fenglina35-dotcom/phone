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
  assert.match(functionSource('emergencyRestoreConfirm'),/await saveNowAsync\(\)/);
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
  assert.match(app,/APP_VER='v1183 · 共同生活键盘与唱片配色修复版'/);
  assert.match(html,/app\.js\?v=1183/);
  assert.match(sw,/BUILD='1183'/);
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
