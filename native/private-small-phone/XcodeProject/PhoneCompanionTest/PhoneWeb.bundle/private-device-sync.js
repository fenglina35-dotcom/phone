/* PRIVATE_DEVICE_SYNC_V1: durable incremental journal. App adapters opt in after account/seed checks. */
(function(root){
 'use strict';
 const encoder=new TextEncoder();
 function clone(v){return JSON.parse(JSON.stringify(v));}
 function canonical(v){
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
 }
 async function hash(value){const text=canonical(value);if(text===undefined)throw new Error('同步记录不完整');const bytes=await root.crypto.subtle.digest('SHA-256',encoder.encode(text));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
 function safeKey(key){if(typeof key!=='string'||!/^(state|blob)\/[A-Za-z0-9_./:%-]+$/.test(key)||encoder.encode(key).length>512||key.split('/').some(x=>['__proto__','constructor','prototype'].includes(x)))throw new Error('同步记录标识有误');return key;}
 function stopped(){const error=new Error('账号或设备已变化，本轮同步已停止');error.deviceSyncCancelled=true;return error;}
 function createJournal(options){
  const {owner,transport,storage,snapshot,apply,getOwner}=options;
  let state=null,chain=Promise.resolve(),epoch=0,closed=false;
  const ensure=token=>{if(closed||token!==epoch||getOwner()!==owner)throw stopped();};
  const run=fn=>{const token=epoch;const task=chain.then(async()=>{ensure(token);return fn(token);});chain=task.catch(()=>{});return task;};
  async function persist(next,token){ensure(token);await storage.write(owner,clone(next));ensure(token);state=next;}
  async function call(body,token){ensure(token);const result=await transport({...clone(body),protocolVersion:2});ensure(token);if(!result||result.ok!==true)throw new Error(String(result&&result.error||'设备同步未完成'));return result;}
  async function init(token){
   if(state){await recover(token);await recoverResolutions(token);return;}
   const previous=await storage.read(owner);ensure(token);
   if(previous&&(previous.owner!==owner||previous.version!==1))throw new Error('同步日志与当前账号不一致，未读取');
   const next=previous?clone(previous):{version:1,owner,cursor:'0',deviceId:'',initialized:false,known:{},pending:{}};
   const result=await call({action:'register',platform:options.platform,label:options.label},token);
   // A new Auth session is a new revocable device. Keep unacknowledged mutations, not the old device ID.
   next.deviceId=result.device.id;
   await persist(next,token);
   await recover(token);
   await recoverResolutions(token);
  }
  async function recover(token){
   if(!state.inbox)return;
   const inbox=clone(state.inbox);
   async function retainLocal(rows){
    ensure(token);const blockedKeys=new Set();
    for(const row of rows){const key=safeKey(row.key),deleted=row.deleted===true,fingerprint=deleted?'':await hash(row.value);ensure(token);const pending=inbox.next.pending[key],known=state.known[key];
     if(pending&&pending.deleted===deleted&&pending.hash===fingerprint){blockedKeys.add(key);continue;}
     inbox.next.pending[key]={key,deleted,hash:fingerprint,mutationId:root.crypto.randomUUID(),baseRevision:pending?pending.baseRevision:known?known.revision:'0'};
     if(!deleted)inbox.next.pending[key].value=clone(row.value);blockedKeys.add(key);
    }
    inbox.rows=inbox.rows.filter(row=>!blockedKeys.has(row.key));await persist({...clone(state),inbox:clone(inbox)},token);
   }
   ensure(token);await apply(inbox.rows,()=>ensure(token),retainLocal);ensure(token);
   inbox.next.deviceId=state.deviceId;
   await persist(inbox.next,token);
  }
  // PRIVATE_SYNC_CONFLICT_RESOLUTION_V1: choices are durable before HTTP; resolved candidates
  // enter the same crash-safe inbox as ordinary records, including on the original blocked device.
  async function adoptResolution(detail,conflictId,token){
   const conflict=detail?.conflict,row=detail?.current;
   if(!conflict||conflict.id!==conflictId||!conflict.resolvedAt||!row||row.key!==conflict.key
      ||typeof row.revision!=='string'||!/^\d+$/.test(row.revision)||typeof row.deleted!=='boolean')throw new Error('冲突处理回执不完整，原修改已保留');
   const key=safeKey(row.key),fingerprint=row.deleted?'':await hash(row.value);ensure(token);
   const next=clone(state),pending=next.pending[key];
   if(pending?.blocked===conflictId)delete next.pending[key];
   if(next.resolutions)delete next.resolutions[conflictId];
   next.known[key]={revision:row.revision,deleted:row.deleted,hash:fingerprint};
   if(next.pending[key]){await persist(next,token);return;}
   await persist({...clone(state),inbox:{rows:[clone(row)],next}},token);
   await recover(token);
  }
  async function finishResolution(conflictId,item,token){
   let result;
   try {result=await call({action:'resolve',deviceId:state.deviceId,conflictId,choice:item.choice,
     baseRevision:item.baseRevision,mutationId:item.mutationId},token);}
   catch(error){
    if(error.message!=='mutation_payload_changed')throw error;
    const detail=await call({action:'conflict',deviceId:state.deviceId,conflictId},token);
    if(!detail.conflict?.resolvedAt)throw error;
    result={...detail,resolved:true};
   }
   if(result.resolved===true){await adoptResolution(result,conflictId,token);return result;}
   if(result.resolved!==false||result.reason!=='revision_changed')throw new Error('冲突处理尚未确认，原修改已保留');
   const next=clone(state);if(next.resolutions)delete next.resolutions[conflictId];await persist(next,token);
   return result;
  }
  async function recoverResolutions(token){
   for(const [id,item] of Object.entries(state.resolutions||{}))await finishResolution(id,item,token);
  }
  async function reconcileBlocked(token){
   const ids=[...new Set(Object.values(state.pending).map(item=>item.blocked).filter(Boolean))];
   for(const conflictId of ids){
    const detail=await call({action:'conflict',deviceId:state.deviceId,conflictId},token);
    if(detail.conflict?.resolvedAt)await adoptResolution(detail,conflictId,token);
   }
  }
  async function capture(token){
   if(!options.canPublish())return;
   const local=await snapshot();ensure(token);if(local===null)return;
   const next=clone(state),keys=new Set(Object.keys(local));
   for(const key of keys){
    safeKey(key);const value=local[key],fingerprint=await hash(value);ensure(token);
    const pending=next.pending[key],known=next.known[key];
    if(pending&&!pending.deleted&&pending.hash===fingerprint)continue;
    if(!pending&&known&&!known.deleted&&known.hash===fingerprint)continue;
    next.pending[key]={key,value:clone(value),deleted:false,hash:fingerprint,mutationId:root.crypto.randomUUID(),
      baseRevision:pending?pending.baseRevision:known?known.revision:'0'};
   }
   // A partial initial download must never be interpreted as a local mass deletion.
   if(next.initialized)for(const key of Object.keys(next.known)){
    const known=next.known[key],pending=next.pending[key];
    if(key.startsWith('blob/')||key.startsWith('state/media/')||keys.has(key)||known.deleted||pending&&pending.deleted)continue;
    next.pending[key]={key,deleted:true,hash:'',mutationId:root.crypto.randomUUID(),baseRevision:pending?pending.baseRevision:known.revision};
   }
   for(const key of Object.keys(next.pending))if(!keys.has(key)&&!next.known[key]){
    const pending=next.pending[key];
    if(!pending.submitted)delete next.pending[key];
    else if(!pending.deleted)next.pending[key]={key,deleted:true,hash:'',mutationId:root.crypto.randomUUID(),baseRevision:pending.baseRevision};
   }
   await persist(next,token);
  }
  async function push(token){
   const rows=[];let size=0;
   const available=Object.values(state.pending).filter(x=>!x.blocked),chunks=available.filter(x=>x.key.startsWith('blob/record/'));
   for(const item of chunks.length?chunks:available){
    if(item.blocked)continue;
    if(item.value?.kind==='parts'&&item.value.parts.some(id=>!state.known['blob/record/'+id]||state.known['blob/record/'+id].deleted))continue;
    const {key,value,deleted,mutationId,baseRevision}=item,row={key,deleted,mutationId,baseRevision};
    if(!deleted)row.value=value;
    const bytes=encoder.encode(JSON.stringify(row)).length;
    if(bytes>250000)throw new Error('单条记录需要先分块，未发送');
    if(rows.length>=64||size+bytes>2_500_000)break;
    rows.push(row);size+=bytes;
   }
   if(!rows.length)return false;
   const submitting=clone(state);
   for(const row of rows)submitting.pending[row.key].submitted=true;
   await persist(submitting,token);
   const result=await call({action:'push',deviceId:state.deviceId,changes:rows},token);
   const next=clone(state),sent=new Map(rows.map(x=>[x.mutationId,x]));
   if(!Array.isArray(result.outcomes)||result.outcomes.length!==rows.length)throw new Error('同步回执不完整，原提交已保留');
   const seen=new Set();
   for(const ack of result.outcomes){
    const row=sent.get(ack.mutationId);
    if(!row||row.key!==ack.key||seen.has(ack.mutationId)||!['applied','conflict'].includes(ack.status)||typeof ack.revision!=='string'||!/^\d+$/.test(ack.revision))throw new Error('同步回执不匹配，原提交已保留');
    seen.add(ack.mutationId);
    const pending=next.pending[row.key];
    if(!pending||pending.mutationId!==row.mutationId)throw new Error('同步日志已变化');
    if(ack.status==='conflict')pending.blocked=ack.conflictId;
    else {
     next.known[row.key]={revision:ack.revision,deleted:row.deleted,hash:pending.hash};
     delete next.pending[row.key];
    }
   }
   await persist(next,token);return true;
  }
  async function pull(token){
   let pages=0,more=true;
   while(more&&pages++<32){
    const result=await call({action:'pull',deviceId:state.deviceId,cursor:state.cursor},token);
    if(!Array.isArray(result.records)||typeof result.cursor!=='string'||!/^\d+$/.test(result.cursor)||BigInt(result.cursor)<BigInt(state.cursor))throw new Error('同步游标有误');
    // Capture edits made while the pull was in flight against the old revisions, before advancing known.
    await capture(token);
    const next=clone(state),accepted=[];
    for(const row of result.records){
     safeKey(row.key);
     if(typeof row.revision!=='string'||!/^\d+$/.test(row.revision)||typeof row.deleted!=='boolean')throw new Error('同步版本有误');
     const fingerprint=row.deleted?'':await hash(row.value);ensure(token);
     const pending=next.pending[row.key],old=next.known[row.key],unchanged=old&&old.deleted===row.deleted&&old.hash===fingerprint;
     // Equal content is safe to reconcile even if a preceding journal ACK was lost.
     if(pending&&pending.deleted===row.deleted&&pending.hash===fingerprint)delete next.pending[row.key];
     if(!next.pending[row.key]&&!unchanged)accepted.push(clone(row));
     next.known[row.key]={revision:row.revision,deleted:row.deleted,hash:fingerprint};
    }
    next.cursor=result.cursor;next.seed=result.seed||null;more=result.more===true;
    if(!more)next.initialized=true;
    if(!accepted.length){await persist(next,token);continue;}
    // Persist an inbox before touching app data; replay it after a crash before detecting local edits.
    await persist({...clone(state),inbox:{rows:accepted,next}},token);
    await recover(token);
   }
   return more;
  }
  // PRIVATE_SYNC_SEED_CHECKPOINT_V1: live counters may keep changing after the
  // initial records were acknowledged. Preserve those newer mutations in the
  // outbox; only never-acknowledged logical records and parts block first reveal.
  function canFinishSeed(){
   if(!state?.known?.['state/schema']||state.known['state/schema'].deleted)return false;
   return !Object.values(state.pending).some(row=>row.blocked||
    !row.key.startsWith('state/media/')&&(!state.known[row.key]||state.known[row.key].deleted));
  }
  return Object.freeze({
   canFinishSeed,
   // PRIVATE_SYNC_LOCAL_COLLECTION_V1: dirty notifications can be inspected and
   // journaled locally without performing any network request.
   collectLocal:()=>run(async token=>{if(!state)return {needsConnect:true,pending:0};await capture(token);const pending=Object.values(state.pending).filter(x=>!x.blocked);return {needsConnect:false,pending:pending.length,urgent:pending.some(x=>['message','thread','contact','contactField'].includes(x.value?.kind))};}),
   check:()=>run(async token=>{await init(token);return call({action:'check',deviceId:state.deviceId,cursor:state.cursor},token);}),
   deviceId:()=>state?.deviceId||'',
   queue:values=>run(async token=>{await init(token);if(!options.canPublish())throw new Error('此设备尚未完成账号数据读取');const next=clone(state),rows=Array.isArray(values)?values:Object.entries(values).map(([key,value])=>({key,value,deleted:false}));for(const row of rows){const key=safeKey(row.key),deleted=row.deleted===true,fingerprint=deleted?'':await hash(row.value);ensure(token);const pending=next.pending[key],known=next.known[key];if(pending&&pending.deleted===deleted&&pending.hash===fingerprint||!pending&&known&&known.deleted===deleted&&known.hash===fingerprint)continue;next.pending[key]={key,deleted,hash:fingerprint,mutationId:root.crypto.randomUUID(),baseRevision:pending?pending.baseRevision:known?known.revision:'0'};if(!deleted)next.pending[key].value=clone(row.value);}await persist(next,token);}),
   cycle:()=>run(async token=>{await init(token);await reconcileBlocked(token);await capture(token);const pushed=await push(token);const more=await pull(token);return {pushed,more,pending:Object.keys(state.pending).length,conflicts:Object.values(state.pending).filter(x=>x.blocked).length};}),
   flush:(maxBatches=64)=>run(async token=>{await init(token);await reconcileBlocked(token);await capture(token);const limit=Math.max(1,Math.min(64,Math.floor(Number(maxBatches)||64)));for(let n=0;n<limit;n++)if(!await push(token))break;const more=await pull(token);return more||Object.values(state.pending).some(x=>!x.blocked);}),
   resolve:(conflictId,choice,expectedRevision)=>run(async token=>{
    await init(token);
    if(typeof conflictId!=='string'||!['server','candidate'].includes(choice))throw new Error('请选择要保留的修改');
    const detail=await call({action:'conflict',deviceId:state.deviceId,conflictId},token);
    if(detail.conflict?.resolvedAt){await adoptResolution(detail,conflictId,token);return {...detail,resolved:true};}
    const revision=expectedRevision===undefined?detail.current?.revision:expectedRevision;
    if(typeof revision!=='string'||!/^\d+$/.test(revision))throw new Error('请重新查看最新的云端修改');
    const next=clone(state);if(!next.resolutions)next.resolutions={};
    const item={choice,baseRevision:revision,mutationId:root.crypto.randomUUID()};next.resolutions[conflictId]=item;
    await persist(next,token);return finishResolution(conflictId,item,token);
   }),
   reregister:()=>run(async token=>{state=null;await init(token);return {ok:true};}),
   inspect:()=>run(async token=>{await init(token);return call({action:'inspect',deviceId:state.deviceId},token);}),
   seed:finish=>run(async token=>{await init(token);if(finish&&!canFinishSeed())throw new Error('首批数据尚未全部确认，请继续同步');const result=await call({action:'seed',deviceId:state.deviceId,finish:finish===true},token);const next=clone(state);next.seed=result.seed;await persist(next,token);return result.seed;}),
   request:body=>run(async token=>{await init(token);return call({...body,deviceId:state.deviceId},token);}),
   state:()=>state?clone(state):null,
   close(){closed=true;epoch++;},
  });
 }
 // Normal app data is split by setting/role/message, so adding a message never uploads an entire archive.
 // Device grants and rotating MCP credentials use their separate native/account protocols.
 function createStateCodec(){
  const records=new Map(),orders=new Map(),pathKeys=new Map(),media=new Map();
  const forbidden=new Set(['__proto__','prototype','constructor']);
  const localSettings=new Set(['deviceOperationHistory','smartHomeAir','smartHomeLock','skyRoleSync','cloudId','cloudUrl','cloudKey']);
  const localMe=new Set(['locked','battery','charging','steps','stepDate','appUsage']);
  async function pathKey(kind,path){const id=kind+':'+canonical(path);if(!pathKeys.has(id))pathKeys.set(id,'state/'+kind+'/'+await hash(path));return pathKeys.get(id);}
  function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
  function decode(text){if(typeof text!=='string'||!/^[A-Za-z0-9_-]*$/.test(text))throw new Error('同步分块编码有误');return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));}
  async function put(out,key,node){
   const text=canonical(node),bytes=encoder.encode(text);
   if(bytes.length<=160000){out[key]=node;return;}
   const parts=[];
   for(let start=0;start<bytes.length;start+=96000){const part=bytes.slice(start,start+96000),id=await hash(base64(part));parts.push(id);out['blob/record/'+id]={base64:base64(part)};}
   out[key]={kind:'parts',parts,bytes:bytes.length,hash:await hash(text)};
  }
  async function project(state){
   if(!state||typeof state.settings!=='object'||!Array.isArray(state.contacts)||!state.messages||state.messages.__idb)throw new Error('聊天存档尚未完整读取，同步稍后继续');
   const out={'state/schema':{kind:'schema',version:1}};
   async function field(path,value){for(const key of path)if(forbidden.has(key))throw new Error('同步字段不合法');await put(out,await pathKey('field',path),{kind:'field',path,value});}
   for(const key of Object.keys(state)){
    if(['contacts','messages','settings','me','_persistedAt','__coreIdb','_deviceSyncOwner','_proactiveDone','_proactiveCount','_mailCount'].includes(key))continue;
    if(key==='couple'&&state.couple){const value=clone(state.couple);delete value.companion;await field([key],value);}
    else await field([key],state[key]);
   }
   for(const key of Object.keys(state.settings||{}))if(!localSettings.has(key))await field(['settings',key],state.settings[key]);
   for(const key of Object.keys(state.me||{}))if(!localMe.has(key))await field(['me',key],state.me[key]);
   const ids=new Set();
   for(let index=0;index<state.contacts.length;index++){
    const contact=state.contacts[index];if(!contact||typeof contact.id!=='string'||!contact.id||ids.has(contact.id))throw new Error('角色标识不完整，未上传不完整列表');ids.add(contact.id);
    const key=await pathKey('contact',[contact.id]),order=orders.has(key)?orders.get(key):index;orders.set(key,order);
    await put(out,key,{kind:'contact',id:contact.id,order});
    for(const field of Object.keys(contact)){if(['id','_initiative','_initiativeLast'].includes(field))continue;if(forbidden.has(field))throw new Error('角色字段不合法');await put(out,await pathKey('contact-field',[contact.id,field]),{kind:'contactField',id:contact.id,field,value:contact[field]});}
   }
   for(const thread of Object.keys(state.messages)){
    const list=state.messages[thread];if(!Array.isArray(list))continue;
    await put(out,await pathKey('thread',[thread]),{kind:'thread',thread});const seen=new Set(),legacy=new Map();
    for(let index=0;index<list.length;index++){
     const message=list[index];if(!message||typeof message!=='object')throw new Error('聊天内容不完整');
     let id=message.id?String(message.id):'';if(!id){const digest=await hash(message),ordinal=legacy.get(digest)||0;legacy.set(digest,ordinal+1);id='legacy-'+digest+'-'+ordinal;}
     if(seen.has(id))throw new Error('聊天消息标识重复，未上传');seen.add(id);
     const key=await pathKey('message',[thread,id]),order=orders.has(key)?orders.get(key):index;orders.set(key,order);
     await put(out,key,{kind:'message',thread,id,order,value:{...message,id}});
    }
   }
   for(const [key,value] of records)if(key.startsWith('state/media/'))out[key]=clone(value);
   return out;
  }
  async function unpack(value){
   if(value&&value.kind==='parts'){
    if(!Array.isArray(value.parts)||!Number.isSafeInteger(value.bytes)||value.bytes<0)throw new Error('同步分块清单有误');
    const arrays=[];let size=0;
    for(const id of value.parts){const row=records.get('blob/record/'+id);if(!row)return null;const bytes=decode(row.base64);if(await hash(row.base64)!==id)throw new Error('同步分块校验失败');arrays.push(bytes);size+=bytes.length;}
    if(size!==value.bytes)throw new Error('同步分块长度不符');const bytes=new Uint8Array(size);let at=0;for(const part of arrays){bytes.set(part,at);at+=part.length;}
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(await hash(text)!==value.hash)throw new Error('同步记录校验失败');return JSON.parse(text);
   }
   return value;
  }
  async function materialize(){
   const state={settings:{},me:{},contacts:[],messages:{}},contacts=[],fields=new Map(),threads=new Map();let schema=false;
   for(const [key,packed] of records){
    if(!key.startsWith('state/'))continue;const node=await unpack(packed);if(!node)return {complete:false};
    if(node.kind==='schema'){if(node.version!==1)throw new Error('同步格式版本尚不支持');schema=true;continue;}
    if(node.kind==='media')continue;
    if(node.kind==='field'){
     if(!Array.isArray(node.path)||node.path.length<1||node.path.length>2||node.path.some(k=>typeof k!=='string'||forbidden.has(k)))throw new Error('同步字段路径有误');
     if(node.path.length===2&&!['settings','me'].includes(node.path[0]))throw new Error('同步字段不受支持');
     if(node.path.length===1)Object.defineProperty(state,node.path[0],{value:clone(node.value),writable:true,enumerable:true,configurable:true});
     else Object.defineProperty(state[node.path[0]],node.path[1],{value:clone(node.value),writable:true,enumerable:true,configurable:true});
    }else if(node.kind==='contact'){
     if(typeof node.id!=='string'||!node.id)throw new Error('同步角色标识不符');orders.set(key,node.order);contacts.push(node);
    }else if(node.kind==='contactField'){
     if(typeof node.id!=='string'||typeof node.field!=='string'||forbidden.has(node.field)||['id','_initiative','_initiativeLast'].includes(node.field))throw new Error('同步角色字段有误');if(!fields.has(node.id))fields.set(node.id,{});Object.defineProperty(fields.get(node.id),node.field,{value:clone(node.value),writable:true,enumerable:true,configurable:true});
    }else if(node.kind==='thread'||node.kind==='message'){
     if(typeof node.thread!=='string'||forbidden.has(node.thread))throw new Error('同步会话标识有误');if(!threads.has(node.thread))threads.set(node.thread,[]);
     if(node.kind==='message'){orders.set(key,node.order);threads.get(node.thread).push(node);}
    }else throw new Error('同步记录类型不受支持');
   }
   contacts.sort((a,b)=>(a.order-b.order)||a.id.localeCompare(b.id));state.contacts=contacts.map(x=>Object.assign({id:x.id},x.value?clone(x.value):{},fields.get(x.id)||{}));
   for(const [thread,list] of threads){list.sort((a,b)=>(+a.value.time||0)-(+b.value.time||0)||(a.order-b.order)||a.id.localeCompare(b.id));Object.defineProperty(state.messages,thread,{value:list.map(x=>({...clone(x.value),id:x.id})),writable:true,enumerable:true,configurable:true});}
   return {complete:schema,state};
  }
  function accept(rows){for(const row of rows){safeKey(row.key);if(row.deleted){const old=records.get(row.key);if(old?.kind==='media')media.delete(old.localKey);records.delete(row.key);}else{const value=clone(row.value);records.set(row.key,value);if(value?.kind==='media')media.set(value.localKey,value);}}}
  return Object.freeze({project,materialize,accept,
   // PRIVATE_SYNC_LOCAL_DELETION_V2: a full local projection replaces its previous
   // logical keys. Keep not-yet-visible remote pages and content-addressed parts.
   setLocalProjection(values,previous){
    const prior=previous?Object.keys(previous):Array.from(records.keys());
    for(const key of prior)if(key.startsWith('state/')&&!key.startsWith('state/media/')&&!Object.hasOwn(values,key))records.delete(key);
    accept(Object.entries(values).map(([key,value])=>({key,value,deleted:false})));
   },
   mediaManifest:localKey=>media.has(localKey)?clone(media.get(localKey)):null,
   mediaRecords:()=>Object.fromEntries(Array.from(records).filter(([key])=>key.startsWith('state/media/')).map(([key,value])=>[key,clone(value)])),
   async addMediaManifest(meta){
    if(!meta||typeof meta.localKey!=='string'||!meta.localKey||meta.localKey.length>512||/^__(?:core|recovery|private.*sync|device.*sync)/i.test(meta.localKey)||!['string','blob','json'].includes(meta.type)||!Number.isSafeInteger(meta.bytes)||meta.bytes<0||!Array.isArray(meta.parts)||meta.parts.some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))||!/^[a-f0-9]{64}$/.test(meta.hash||''))throw new Error('媒体同步清单有误');
    const key='state/media/'+await hash(meta.localKey),value={...clone(meta),kind:'media',version:1};accept([{key,value}]);return {key,value};
   },
   dump:()=>Array.from(records,([key,value])=>({key,value})),
   load(rows){records.clear();media.clear();accept((rows||[]).map(row=>({...row,deleted:false})));},
   preserveDeviceState(incoming,current){
    const result=clone(incoming);for(const key of localSettings)if(current.settings&&Object.hasOwn(current.settings,key))result.settings[key]=clone(current.settings[key]);
    for(const key of localMe)if(current.me&&Object.hasOwn(current.me,key))result.me[key]=clone(current.me[key]);
    for(const key of ['_proactiveDone','_proactiveCount','_mailCount'])if(Object.hasOwn(current,key))result[key]=clone(current[key]);
    const previous=new Map((current.contacts||[]).filter(Boolean).map(c=>[c.id,c]));
    for(const c of result.contacts||[]){const old=previous.get(c.id);if(old)for(const key of ['_initiative','_initiativeLast'])if(Object.hasOwn(old,key))c[key]=clone(old[key]);}
    if(current.couple?.companion&&result.couple&&current.couple.cid===result.couple.cid)result.couple.companion=clone(current.couple.companion);return result;
   }
  });
 }
 root.NorthPrivateDeviceSyncCore=Object.freeze({createJournal,createStateCodec,canonical,hash});
})(typeof window==='undefined'?globalThis:window);
