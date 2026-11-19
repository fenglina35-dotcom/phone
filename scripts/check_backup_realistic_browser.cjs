// Both engines, many short chat fields, distinct media, normal boot and active persistence.
// A desktop WebKit build is not the user's physical iPhone.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');fs.createReadStream(file).pipe(res);});
// NORTH_BACKUP_FILE audits a user-authorized local export in disposable browser storage.
// No request may leave the loopback test origin; credentials/content are never logged.
async function auditExistingBackup(file){
 const crypto=require('node:crypto'),input=fs.readFileSync(file),decoded=JSON.parse(input),envelope=decoded.format==='smallphone-primary-core-audit-v1',expected=envelope?decoded.state:decoded,digest=x=>crypto.createHash('sha256').update(x).digest('hex');
 const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
 const hashes=Object.fromEntries(Object.entries(expected).filter(([k])=>!['_persistedAt','_backupMedia','presence','roleBody'].includes(k)).map(([k,v])=>[k,digest(JSON.stringify(canonical(v)))]));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
 const reports=[];
 try{for(const privateApp of [true]){
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let externalRequestsBlocked=0;
  page.on('pageerror',()=>errors.push('pageerror'));await page.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();externalRequestsBlocked++;return r.abort();});
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.__SMALL_PHONE_MAC__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'audit-native-unavailable'})};});
  const entry=origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html');
  await page.goto(entry);await page.waitForFunction(()=>window.__northBootReady);await page.evaluate(()=>_bootImagesPromise);
  await page.evaluate(()=>{localStorage.setItem('yibei_unlocked',String(SHARE_EPOCH));S.me.locked=false;const gate=document.getElementById('gate');if(gate)gate.remove();openSettings('data');closeModal();window.auditNotices=[];const original=toast;toast=t=>{auditNotices.push(String(t));return original(t);};uiConfirm=async()=>true;});
  await page.evaluate(()=>{const input=document.createElement('input');input.id='auditBackupInput';input.type='file';input.onchange=()=>readJsonFile(input.files[0],async d=>{await applyFullBackupData(d);window.auditImportComplete=true;});document.body.appendChild(input);});
  await page.locator('#auditBackupInput').setInputFiles(envelope?{name:'primary-core-audit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(expected))}:path.resolve(file));
  await page.waitForFunction(()=>window.auditImportComplete||auditNotices.some(x=>x.startsWith('导入失败')),null,{timeout:240000});
  assert(await page.evaluate(()=>!!window.auditImportComplete),'local backup import did not complete');
  const inspect=()=>page.evaluate(async hashes=>{
   const restored=JSON.parse(await(await fullBackupFileBlob(null,{skippedImages:0})).text()),canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v,diffs=[];
   for(const [key,hash]of Object.entries(hashes)){const text=JSON.stringify(canonical(restored[key]));if(text===undefined){diffs.push(key);continue;}const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');if(actual!==hash)diffs.push(key);}
   let audioRefs=0,readableAudioRefs=0;const refs=new Set();(function walk(v){if(typeof v==='string'&&v.startsWith('idb-audio:')){audioRefs++;refs.add(v);}else if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);})(restored);
   for(const ref of refs)if(await imgGet('__audio_'+ref.slice(10)))readableAudioRefs++;
   return{differentRoots:diffs,contacts:restored.contacts.length,messages:Object.values(restored.messages).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0),notes:(restored.me.lifeNotes||[]).length,audioReferences:audioRefs,uniqueAudioReferences:refs.size,readableAudioReferences:readableAudioRefs,missingMediaPositions:restored._backupMedia?.missing?.length||0};
  },hashes);
  const afterImport=await inspect();
  // Read persisted data on an inert page before normal boot updates hardware/runtime fields.
  await page.goto(origin+'/__backup-audit-storage');
  const persisted=await page.evaluate(async hashes=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('yibeiImg');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}),cache=new Map();
   const get=async key=>{if(cache.has(key))return cache.get(key);const value=await new Promise((resolve,reject)=>{const r=db.transaction('img','readonly').objectStore('img').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});cache.set(key,value);return value;};
   try{const shell=JSON.parse(localStorage.getItem('yibei_phone_v2')||'null'),record=await get('__core_state'),state=shell?.__coreIdb?JSON.parse(record.json):shell;
    async function expand(v){if(typeof v==='string'&&v.startsWith('idb:')){const data=await get(v.slice(4));return typeof data==='string'&&data?data:v;}if(!v||typeof v!=='object')return v;
     if(v.__idb){const kind=v.__idb,p=state.me?.phoneFriend,key=kind==='messages'?'__messages':kind==='phoneFriendMessages'?'__pf_messages_'+(v.id||p?.id||'main'):kind==='phoneFriendGroupMessages'?'__pf_group_messages_'+(v.id||p?.id||'main'):'';if(key){const data=await get(key);if(typeof data!=='string')throw Error('persisted chat archive unavailable');return expand(JSON.parse(data));}}
     for(const key of Object.keys(v))v[key]=await expand(v[key]);return v;}
    const restored=await expand(state),canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v,differentRoots=[];
    for(const [key,expected]of Object.entries(hashes)){const text=JSON.stringify(canonical(restored[key]));const hash=text===undefined?'':Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected)differentRoots.push(key);}
    return{differentRoots};
   }finally{db.close();}
  },hashes);
  await page.goto(entry);await page.waitForFunction(()=>window.__northBootReady);await page.evaluate(()=>_bootImagesPromise);const afterReload=await inspect();
  const changed=Object.fromEntries(afterReload.differentRoots.map(k=>[k,expected[k]]));
  afterReload.providedFieldDifferences=await page.evaluate(async original=>{const restored=JSON.parse(await(await fullBackupFileBlob(null,{skippedImages:0})).text()),diffs=[];function compare(a,b,p){if(diffs.length>=30)return;if(a&&typeof a==='object'){if(!b||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)){diffs.push(p.join('/'));return;}if(Array.isArray(a)&&a.length!==b.length)diffs.push(p.join('/')+'/length');for(const k of Object.keys(a))compare(a[k],b[k],p.concat(Array.isArray(a)?Number(k):k));}else if(a!==b)diffs.push(p.join('/'));}for(const k of Object.keys(original))compare(original[k],restored[k],[k]);return{paths:diffs,originalMemoriesRetained:!original.contacts||original.contacts.every(c=>{const after=restored.contacts.find(x=>x.id===c.id);return after&&(!Array.isArray(c.memory)||c.memory.every((m,i)=>JSON.stringify(m)===JSON.stringify(after.memory?.[i])));})};},changed);
  reports.push({privateApp,afterImport,persisted,afterReload,pageErrors:errors.length,externalRequestsBlocked});console.log(JSON.stringify(reports[reports.length-1]));await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
 const localMusicFiles=(expected.music?.songs||[]).filter(s=>s?.src?.t==='idb').length,localCinemaFiles=(expected.cinema?.library||[]).filter(s=>s?.source==='idb').length;
 const report={scope:'core JSON restoration; not a claim that all local media is embedded',sourceKind:envelope?'primary core audit envelope':'exported backup',sourceNativeCoreSHA256:envelope?decoded.sourceNativeCoreSHA256:undefined,backupBytes:input.length,backupSHA256:digest(input),reports,mediaCompleteness:{missingImagePositions:envelope?(reports[0]?.afterReload.missingMediaPositions||0):(expected._backupMedia?.missing?.length||0),unembeddedAudioReferences:reports[0]?.afterReload.uniqueAudioReferences||0,unembeddedLocalMusicFiles:localMusicFiles,unembeddedLocalCinemaFiles:localCinemaFiles}};
 report.coreRestorePassed=reports.every(r=>!r.afterImport.differentRoots.length&&!r.persisted.differentRoots.length&&r.afterReload.providedFieldDifferences.originalMemoriesRetained&&!r.afterReload.providedFieldDifferences.paths.some(p=>!/^me\/(?:locked|battery|charging)$/.test(p)&&!/^contacts\/\d+\/memory\/length$/.test(p))&&!r.pageErrors);
 report.completeMediaBackup=Object.values(report.mediaCompleteness).every(n=>n===0);
 if(process.env.NORTH_BACKUP_REPORT){const target=process.env.NORTH_BACKUP_REPORT,data=JSON.parse(fs.readFileSync(target,'utf8'));if(data.backupRestoreValidation&&data.backupRestoreValidation.backupSHA256!==report.backupSHA256){const history=data.backupRestoreValidationHistory||(data.backupRestoreValidationHistory=[]);if(!history.some(x=>x.backupSHA256===data.backupRestoreValidation.backupSHA256))history.push(data.backupRestoreValidation);}data.backupRestoreValidation=report;fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');}
 for(const result of reports){assert.deepEqual(result.afterImport.differentRoots,[]);assert.deepEqual(result.persisted.differentRoots,[]);assert.equal(result.afterReload.providedFieldDifferences.originalMemoriesRetained,true);assert.deepEqual(result.afterReload.providedFieldDifferences.paths.filter(p=>!/^me\/(?:locked|battery|charging)$/.test(p)&&!/^contacts\/\d+\/memory\/length$/.test(p)),[]);assert.equal(result.pageErrors,0);}
}
// Materialize only explicitly referenced chat archives from a verified cold copy.
// Never append an unreferenced old __messages archive to intentionally deleted chats.
function materializePrimaryCore(directory){
 const cp=require('node:child_process');
 const code=String.raw`
from pathlib import Path
import json,sqlite3,hashlib,uuid,os
root=Path(__import__('sys').argv[1]).resolve()
proof=json.loads((root/'backup-manifest.json').read_text())
assert proof.get('format')=='smallphone-primary-preservation-v1' and proof.get('verified') is True,'raw snapshot is not verified'
pin=json.loads((root/'Library/Application Support/SmallPhonePrivateAccounts/sync-source.v2.json').read_text())
assert pin.get('source') in ('legacy','account'),'unknown approved source'
owner=str(uuid.UUID(pin['owner']))
assert pin['owner'].lower()==owner,'noncanonical account owner'
store=root/'Library/Application Support'/('SmallPhonePrivateStore' if pin['source']=='legacy' else 'SmallPhonePrivateAccounts/'+owner)
core=store/'__core_state.json';assert core.resolve().is_relative_to(root),'core path escapes snapshot';raw=core.read_bytes();record=json.loads(raw);state=json.loads(record['json'])
assert state.get('_deviceSyncOwner')==owner,'core owner differs from source pin'
row=next(x for x in proof['files'] if x['path']==str(core.relative_to(root)))
assert hashlib.sha256(raw).hexdigest()==row['sha256'],'core changed after verification'
databases=[]
for p in (root/'Library/WebKit').rglob('IndexedDB.sqlite3'):
 c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)
 try:
  name=c.execute("SELECT value FROM IDBDatabaseInfo WHERE key='DatabaseName'").fetchone()[0]
  name=name.decode('utf-16-le') if isinstance(name,bytes) else name
  if name in ('yibeiImg','yibeiImg-account-'+owner):databases.append(p)
 finally:c.close()
assert len(databases)==1,'image store scope is ambiguous'
db=databases[0];assert db.resolve().is_relative_to(root),'image store escapes snapshot';wal=Path(str(db)+'-wal');assert not wal.exists() or wal.stat().st_size==0,'image WAL must be checkpointed for immutable inspection'
dbrow=next(x for x in proof['files'] if x['path']==str(db.relative_to(root)))
h=hashlib.sha256()
with db.open('rb') as f:
 for block in iter(lambda:f.read(8388608),b''):h.update(block)
assert h.hexdigest()==dbrow['sha256'],'image store changed after verification'
c=sqlite3.connect(db.as_uri()+'?mode=ro&immutable=1',uri=True);c.text_factory=bytes;keys={}
for key,identifier in c.execute('SELECT key,recordID FROM Records'):
 if isinstance(key,bytes) and key[:2]==b'\x00\x60':
  count=int.from_bytes(key[2:6],'little')
  if len(key)==6+count*2:keys[key[6:].decode('utf-16-le')]=identifier
def text_value(key):
 assert key in keys,'required active chat archive is absent'
 data=c.execute('SELECT value FROM Records WHERE recordID=?',(keys[key],)).fetchone()[0]
 assert len(data)>=9 and data[:5]==b'\x0f\x00\x00\x00\x10','unsupported structured text version'
 length=int.from_bytes(data[5:9],'little');latin=bool(length&0x80000000);length&=0x7fffffff
 assert len(data)==9+length*(1 if latin else 2),'structured text is truncated'
 return data[9:].decode('latin-1' if latin else 'utf-16-le')
archives=[]
def resolve(value,path=()):
 if isinstance(value,dict):
  if '__idb' in value:
   kind=value['__idb'];person=state.get('me',{}).get('phoneFriend',{})
   assert all(k in ('__idb','id') for k in value),'live archive tail requires separate review'
   if path==('messages',) and kind=='messages':key='__messages'
   elif path==('me','phoneFriend','messages') and kind=='phoneFriendMessages':key='__pf_messages_'+str(value.get('id') or person.get('id') or 'main')
   elif path==('me','phoneFriend','groupMessages') and kind=='phoneFriendGroupMessages':key='__pf_group_messages_'+str(value.get('id') or person.get('id') or 'main')
   else:raise ValueError('unknown active archive pointer')
   text=text_value(key);result=json.loads(text);archives.append({'kind':kind,'sha256':hashlib.sha256(text.encode()).hexdigest()});return result
  return {k:resolve(v,path+(k,)) for k,v in value.items()}
 if isinstance(value,list):return [resolve(v,path+('*',)) for v in value]
 return value
try:resolved=resolve(state)
finally:c.close()
envelope={'format':'smallphone-primary-core-audit-v1','sourceNativeCoreSHA256':hashlib.sha256(raw).hexdigest(),'sourceStateSHA256':hashlib.sha256(record['json'].encode()).hexdigest(),'source':'verified cold primary Library','notStandaloneMediaBackup':True,'resolvedActiveArchives':archives,'state':resolved}
target=root/'core-restore-audit.json';assert not target.is_symlink(),'audit output must not be a symlink'
if target.exists():assert json.loads(target.read_text())==envelope,'unique prior audit material must not be overwritten'
else:
 fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as out:json.dump(envelope,out,ensure_ascii=True,separators=(',',':'))
print(str(target))
`;
 return cp.execFileSync('python3',['-c',code,path.resolve(directory)],{encoding:'utf8',maxBuffer:1024*1024}).trim();
}
async function auditSnapshotUI(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
 try{for(const width of [320,430]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.__SMALL_PHONE_MAC__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'audit-native-unavailable'})};});
  await page.goto(origin+'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html');await page.waitForFunction(()=>window.__northBootReady);await page.evaluate(()=>_bootImagesPromise);
  await page.evaluate(()=>{
   const owner='10000000-0000-0000-0000-000000000001';window.__SMALL_PHONE_NATIVE_ACCOUNT__={platform:'iOS',userId:owner};
   localStorage.setItem('yibei_unlocked',String(SHARE_EPOCH));S.me.locked=false;document.getElementById('gate')?.remove();
   window.snapshotRequests=[];window.SmallPhoneNative={request:async(action,payload)=>{snapshotRequests.push({action,owner:payload?.owner,token:payload?.token,retryFailed:payload?.retryFailed});if(action==='account.status')return {ok:true,loggedIn:true,userId:owner};if(action==='account.backup.info')return {ok:true,found:false};if(action==='storage.snapshot.begin')return snapshotRequests.filter(x=>x.action===action).length===1?{ok:true,token:'old-failed-token',phase:'failed',detail:'已有未完成副本已保留；请先核查'}:{ok:true,token:'ui-audit-token',phase:'copying',detail:'正在生成固定副本'};if(action==='storage.snapshot.status')return {ok:true,token:'ui-audit-token',phase:'ready',detail:'独立备份已生成；请点保存，尚未复制到手机外'};if(action==='storage.snapshot.save')return {ok:true,completed:true};return {ok:true};}};
   uiConfirm=async()=>true;saveNowAsync=async()=>true;openSettings('data');_setTab=3;
   _privatePhoneAccount={loaded:true,loading:false,loggedIn:true,userId:owner,maskedPhone:'测试账号',backup:{found:false},error:''};privatePhoneAccountPaint();closeModal();
  });
  if(await page.locator('#privateAccountRecoveryDetails').count())await page.locator('#privateAccountRecoveryDetails').evaluate(node=>node.open=true);const section=page.locator('#private_readonly_snapshot');await section.waitFor();assert.equal(await page.evaluate(()=>snapshotRequests.filter(x=>x.action.startsWith('storage.snapshot')).length),0);
  await section.getByRole('button',{name:'生成或查看独立备份'}).click();await section.getByRole('button',{name:'保留失败副本并重试'}).waitFor();
  const failedGeometry=await section.evaluate(node=>[...node.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width};}));assert(failedGeometry.every(r=>r.left>=0&&r.right<=width+1),JSON.stringify(failedGeometry));
  await section.getByRole('button',{name:'保留失败副本并重试'}).click();await section.getByRole('button',{name:'保存备份文件'}).waitFor({timeout:10000});
  await page.evaluate(()=>closeModal());await section.scrollIntoViewIfNeeded();const geometry=await section.evaluate(node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,width:innerWidth,buttons:[...node.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{width:r.width,height:r.height,left:r.left,right:r.right};})};});
  assert(geometry.left>=0&&geometry.right<=width+1,JSON.stringify(geometry));assert(geometry.buttons.every(x=>x.width>=80&&x.height>=24&&x.left>=0&&x.right<=width+1));
  await page.screenshot({path:path.join(root,'.codex_tmp',`private-sync-dialog-${width}.png`)});
  await section.getByRole('button',{name:'保存备份文件'}).click();await section.getByText('系统保存操作已完成，请核对保存位置').waitFor();
  assert.deepEqual(await page.evaluate(()=>snapshotRequests.filter(x=>x.action.startsWith('storage.snapshot')).map(x=>x.action)),['storage.snapshot.begin','storage.snapshot.begin','storage.snapshot.status','storage.snapshot.save']);assert.equal(await page.evaluate(()=>snapshotRequests.filter(x=>x.action==='storage.snapshot.begin')[1].retryFailed),true);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({snapshotUI:true,width,pageErrors:errors.length,geometry,nativeRequests:'simulated; real native engine tested separately'}));await context.close();
 }}finally{await browser.close();server.close();}
}
if(process.env.NORTH_SNAPSHOT_UI_AUDIT){auditSnapshotUI().catch(e=>{console.error(e);server.close();process.exitCode=1;});}
else if(process.env.NORTH_RAW_PRIMARY_DIR||process.env.NORTH_BACKUP_FILE){Promise.resolve().then(()=>process.env.NORTH_RAW_PRIMARY_DIR?materializePrimaryCore(process.env.NORTH_RAW_PRIMARY_DIR):process.env.NORTH_BACKUP_FILE).then(auditExistingBackup).catch(e=>{console.error(e);server.close();process.exitCode=1;});}
else (async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try{for(const engine of (process.env.NORTH_BACKUP_ENGINE?[process.env.NORTH_BACKUP_ENGINE]:['edge','webkit'])){
  const browser=await(engine==='edge'?chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'}):webkit.launch({headless:true}));
  try{const context=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844},userAgent:engine==='webkit'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1':'Mozilla/5.0 (Linux; Android 12; Huawei) AppleWebKit/537.36 Chrome/134.0.0.0 Mobile Safari/537.36 EdgA/134.0.0.0'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const entry=origin+'/小手机.html';await page.goto(entry+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);await page.evaluate(()=>_bootImagesPromise);
   const fixtureCount=Math.max(1,Number(process.env.NORTH_BACKUP_MESSAGES)||10000);await page.evaluate(async fixtureCount=>{S.me.locked=false;S.settings.backupFixture='realistic-fields';S._backupImages=[];
    for(let i=0;i<48;i++){const key='realistic_'+i;await imgPut(key,'data:image/png;base64,'+String(i).padStart(3,'0')+'A'.repeat(65536));S._backupImages.push('idb:'+key);}
    const id=S.contacts[0].id;S.messages[id]=Array.from({length:fixtureCount},(_,i)=>({id:'fixture-'+i,role:i%2?'assistant':'user',type:'text',content:'真实结构聊天测试'.repeat(12),time:Date.now()-100000+i,meta:{seen:true,account:'main'}}));S.settings.fixtureRole=id;await prepareImportedStateForSave();await saveNowAsync();
   },fixtureCount);
   await page.goto(entry);await page.waitForFunction(()=>window.__northBootReady);await page.evaluate(()=>_bootImagesPromise);await page.evaluate(()=>{const g=document.getElementById('gate');if(g)g.remove();S.me.locked=false;openSettings('data');});await page.waitForTimeout(300);await page.evaluate(()=>closeModal());
   const geometry=await page.evaluate(()=>{const e=document.getElementById('set_storage'),s=e.querySelector('svg');return{meterHeight:e.getBoundingClientRect().height,svgHeight:s.getBoundingClientRect().height};});assert(geometry.meterHeight<400,JSON.stringify(geometry));assert(geometry.svgHeight<40,JSON.stringify(geometry));
   await page.evaluate(()=>{window.parseMs=0;window.applyMs=0;const realRead=readBackupJson;readBackupJson=async(...args)=>{const at=performance.now();try{return await realRead(...args);}finally{parseMs=Math.round(performance.now()-at);}};const realApply=applyFullBackupData;applyFullBackupData=async(...args)=>{const at=performance.now();try{return await realApply(...args);}finally{applyMs=Math.round(performance.now()-at);}};window.importNotices=[];const realToast=toast;toast=text=>{importNotices.push(text);return realToast(text);};window.backupTicks=0;window.backupMaxGap=0;let last=performance.now();window.backupTimer=setInterval(()=>{backupTicks++;backupMaxGap=Math.max(backupMaxGap,performance.now()-last);last=performance.now();},16);});
   const at=Date.now();const [download]=await Promise.all([page.waitForEvent('download',{timeout:180000}),page.locator('button[onclick="exportData()"]').click()]);const exportMs=Date.now()-at;assert.equal(await download.failure(),null);const file=await download.path();const data=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(data.messages[data.settings.fixtureRole].length,fixtureCount);assert.equal(data._backupImages.length,48);assert(data._backupImages.every(x=>x.startsWith('data:image')));
   const importAt=Date.now();const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('button[onclick="importData()"]').click()]);await chooser.setFiles(file);await page.waitForFunction(()=>typeof _fullBackupImportBusy!=='undefined'&&_fullBackupImportBusy);await page.waitForFunction(()=>!_fullBackupImportBusy,null,{timeout:180000});
   const metrics=await page.evaluate(()=>{clearInterval(backupTimer);return{parseMs,applyMs,ticks:backupTicks,maxGap:Math.round(backupMaxGap),count:S.messages[S.settings.fixtureRole].length,images:S._backupImages.length,retainedArchiveChars:Object.values(_heavy||{}).reduce((n,v)=>n+(typeof v==='string'?v.length:0),0)};});assert(await page.evaluate(()=>importNotices.some(s=>s==='完整备份已安全导入')),'must confirm successful import, not retain old fixture after a caught failure');assert.equal(metrics.count,fixtureCount);assert.equal(metrics.images,48);assert.equal(metrics.retainedArchiveChars,0,'a completed import must release duplicate archive JSON from mobile memory');assert(exportMs<Math.max(20000,fixtureCount*1.5),'short-field timer regression: '+exportMs);assert(metrics.maxGap<2000,JSON.stringify(metrics));
   await page.goto(entry);await page.waitForFunction(()=>window.__northBootReady);await page.evaluate(()=>_bootImagesPromise);const reload=await page.evaluate(async()=>{const raw=await imgGet('__messages'),local=JSON.parse(localStorage.getItem(KEY)||'{}');return{count:S.messages&&S.messages[S.settings.fixtureRole]&&S.messages[S.settings.fixtureRole].length,role:S.settings.fixtureRole,keys:Object.keys(S.messages||{}),localMessageRef:local.messages,bootRef:!!_coreBootRef,rawBytes:raw&&raw.length,rawCount:raw&&JSON.parse(raw)[S.settings.fixtureRole]&&JSON.parse(raw)[S.settings.fixtureRole].length,retainedArchiveChars:Object.values(_heavy||{}).reduce((n,v)=>n+(typeof v==='string'?v.length:0),0),openFailure:_idbOpenFailure,errors:window.__northBootError};});console.log(JSON.stringify({engine,reload}));assert.equal(reload.count,fixtureCount);assert.equal(reload.retainedArchiveChars,0,'boot restoration must not pin the archive JSON after parsing');assert.deepEqual(errors,[]);
   console.log(JSON.stringify({engine,exportMs,importAndReloadMs:Date.now()-importAt,bytes:fs.statSync(file).size,...geometry,...metrics,pageErrors:errors.length}));await context.close();
  }finally{await browser.close();}
 }}finally{server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
