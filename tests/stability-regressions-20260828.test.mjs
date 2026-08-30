import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function functionSource(name){
  const fnStart=source.indexOf('function '+name+'(');assert.ok(fnStart>=0,'missing '+name);
  const start=source.slice(Math.max(0,fnStart-6),fnStart)==='async '?fnStart-6:fnStart;
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

test('explicitly ended call session cannot be restored from a stale active snapshot',()=>{
  const storage=new Map(),sandbox=vm.createContext({
    S:{},Date,JSON,String,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  });
  vm.runInContext("const CALL_END_TOMBSTONE_KEY='yibei_call_end_v1';"+functionSource('callEndTombstoneRead')+';'+functionSource('callEndTombstoneWrite')+';'+functionSource('callEndedBeforeRestore')+';this.write=callEndTombstoneWrite;this.blocked=callEndedBeforeRestore;',sandbox);
  const active={session:'call-1',start:100,savedAt:150,state:'active'};
  sandbox.write(active.session);
  assert.equal(sandbox.blocked(active),true);
  assert.equal(sandbox.blocked({...active,session:'call-2'}),false,'a new call session is still restorable');
  assert.match(functionSource('hangupCall'),/callClearPersist\(_sess\)/);
  assert.match(functionSource('restoreActiveCall'),/callEndedBeforeRestore\(p\)/);
});

test('ordinary WeChat rejects bare third-person novel prose but keeps real dialogue about other people',()=>{
  const sandbox=vm.createContext({
    stripHiddenThoughtTags:x=>x,cleanRolePunct:x=>String(x||''),wxKnownTagLine:()=>false,
    String,RegExp,
  });
  for(const name of ['wxEscRe','wxNarrationNameRe','wechatNarrationLeakLine'])vm.runInContext('this.'+name+'='+functionSource(name),sandbox);
  const role={name:'先生',remark:'先生'};
  assert.equal(sandbox.wechatNarrationLeakLine('她发了个伤心表情，没打字，接了视频。',role),true);
  assert.equal(sandbox.wechatNarrationLeakLine('他没急着开口，就那么看了她几秒。',role),true);
  assert.equal(sandbox.wechatNarrationLeakLine('办公室门关着，整个房间只有屏幕的冷白光打在他脸上。',role),true);
  assert.equal(sandbox.wechatNarrationLeakLine('动作顿了顿，眼神沉了几分。',role),true);
  assert.equal(sandbox.wechatNarrationLeakLine('他是谁？',role),false);
  assert.equal(sandbox.wechatNarrationLeakLine('动作这个功能怎么开？',role),false);
  assert.equal(sandbox.wechatNarrationLeakLine('她今天来找我，我没理她。',role),false);
  assert.equal(sandbox.wechatNarrationLeakLine('我现在还在门诊，等会儿回你。',role),false);
});

test('unhydrated idb images use a neutral placeholder instead of WebKit broken-image question mark',()=>{
  const attrs=new Map([['src','idb:photo1']]),classes=new Set();
  const img={
    getAttribute:k=>attrs.get(k)||'',setAttribute:(k,v)=>attrs.set(k,String(v)),removeAttribute:k=>attrs.delete(k),
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},
    get src(){return attrs.get('src')||'';},set src(v){attrs.set('src',String(v));},
  };
  const document={querySelectorAll:sel=>sel==='img[src^="idb:"]'&&String(attrs.get('src')||'').startsWith('idb:')?[img]:sel==='img[data-idb-src]'&&attrs.has('data-idb-src')?[img]:[]};
  const sandbox=vm.createContext({document,_imgCache:{},IDB_IMAGE_PLACEHOLDER:'data:image/gif;base64,blank'});
  vm.runInContext('this.hydrate='+functionSource('hydrateStoredImageNodes'),sandbox);
  sandbox.hydrate();
  assert.equal(attrs.get('data-idb-src'),'photo1');
  assert.equal(attrs.get('src'),'data:image/gif;base64,blank');
  assert.equal(classes.has('idb-image-pending'),true);
  sandbox._imgCache.photo1='data:image/jpeg;base64,ready';sandbox.hydrate();
  assert.equal(attrs.get('src'),'data:image/jpeg;base64,ready');
  assert.equal(attrs.has('data-idb-src'),false);
  assert.equal(classes.has('idb-image-pending'),false);
  assert.match(source,/eligible\.slice\(0,4\)/);
  assert.match(source,/scheduleVisibleStoredImages\(_imageRouteChanged,true\)/);
});

test('recording imports probe and play with a video element while ordinary songs stay audio',()=>{
  assert.match(functionSource('musicProbePlayableBlob'),/kind==='video'\?document\.createElement\('video'\)/);
  assert.match(functionSource('musicKeepOriginalMediaBlob'),/musicProbePlayableBlob\(file,'这段录屏','video'\)/);
  assert.match(functionSource('musicMediaElement'),/kind==='video'\?document\.createElement\('video'\)/);
  assert.match(functionSource('musicPlay'),/musicMediaElement\(kind\)/);
});

test('a role cannot claim early clock-out during configured work without synchronizing cohabitation',()=>{
  const S={settings:{timeAware:true},cohabitation:{enabled:true,paused:false,cid:'role1'}};
  const sandbox=vm.createContext({
    S,String,Date,
    roleClockDate:()=>new Date(2026,7,28,15,40,0,0),
    roleLeaveOn:()=>null,roleWorkday:()=>true,
    toMin:v=>{const [h,m]=String(v).split(':').map(Number);return h*60+m;},
  });
  vm.runInContext('this.roleScheduleSyncTag='+functionSource('roleScheduleSyncTag')+';this.roleScheduleClaimIssue='+functionSource('roleScheduleClaimIssue'),sandbox);
  const role={id:'role1',sched:{on:true,amS:'08:00',amE:'12:00',pmS:'14:00',pmE:'18:00'}};
  assert.match(sandbox.roleScheduleClaimIssue('我提前下班了。',role,0),/没有同步共同生活状态/);
  assert.equal(sandbox.roleScheduleClaimIssue('我提前下班了。\n[共同生活状态|回家路上|30|刚下班]',role,0),'');
  assert.equal(sandbox.roleScheduleClaimIssue('我还在上班，六点再走。',role,0),'');
  assert.match(functionSource('roleSchedulePrompt'),/当前处于下午工作时段，默认仍在工作/);
  assert.match(functionSource('roleTimeRepairPrompt'),/使台词与顶部状态同步/);
});

test('new modals immediately hydrate stored photos and music avatars never print idb keys',()=>{
  assert.match(functionSource('openModal'),/querySelector\('\[data-idb-avatar\],img\[src\^="idb:"\],img\[data-idb-src\],\[style\*="idb:"\]'\)/);
  assert.match(functionSource('openModal'),/scheduleVisibleStoredImages\(true\)/);
  const sandbox=vm.createContext({
    isImg:()=>false,isStoredImgRef:v=>String(v).startsWith('idb:'),
    _imgCache:{},esc:v=>String(v),_avIc:()=>'<svg></svg>',Math,
  });
  vm.runInContext('this.renderAvatar='+functionSource('_mAvHTML'),sandbox);
  const pending=sandbox.renderAvatar('idb:music-avatar-1','me',66);
  assert.match(pending,/data-idb-avatar="music-avatar-1"/);
  assert.doesNotMatch(pending,/>idb:music-avatar-1</);
  sandbox._imgCache['music-avatar-1']='data:image/jpeg;base64,ready';
  assert.match(sandbox.renderAvatar('idb:music-avatar-1','me',66),/<img src="data:image\/jpeg;base64,ready"/);
});
