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
 function stopped(){return new Error('账号或设备已变化，本轮同步已停止');}
 function createJournal(options){
  const {owner,transport,storage,snapshot,apply,getOwner}=options;
  let state=null,chain=Promise.resolve(),epoch=0,closed=false;
  const ensure=token=>{if(closed||token!==epoch||getOwner()!==owner)throw stopped();};
  const run=fn=>{const token=epoch;const task=chain.then(async()=>{ensure(token);return fn(token);});chain=task.catch(()=>{});return task;};
  async function persist(next,token){ensure(token);await storage.write(owner,clone(next));ensure(token);state=next;}
  async function call(body,token){ensure(token);const result=await transport(clone(body));ensure(token);if(!result||result.ok!==true)throw new Error(String(result&&result.error||'设备同步未完成'));return result;}
  async function init(token){
   if(state){await recover(token);return;}
   const previous=await storage.read(owner);ensure(token);
   if(previous&&(previous.owner!==owner||previous.version!==1))throw new Error('同步日志与当前账号不一致，未读取');
   const next=previous?clone(previous):{version:1,owner,cursor:'0',deviceId:'',initialized:false,known:{},pending:{}};
   const result=await call({action:'register',platform:options.platform,label:options.label},token);
   // A new Auth session is a new revocable device. Keep unacknowledged mutations, not the old device ID.
   next.deviceId=result.device.id;
   await persist(next,token);
   await recover(token);
  }
  async function recover(token){
   if(!state.inbox)return;
   const inbox=clone(state.inbox);
   ensure(token);await apply(inbox.rows,()=>ensure(token));ensure(token);
   inbox.next.deviceId=state.deviceId;
   await persist(inbox.next,token);
  }
  async function capture(token){
   if(!options.canPublish())return;
   const local=await snapshot();ensure(token);
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
    if(keys.has(key)||known.deleted||pending&&pending.deleted)continue;
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
   for(const item of Object.values(state.pending)){
    if(item.blocked)continue;
    const {key,value,deleted,mutationId,baseRevision}=item,row={key,deleted,mutationId,baseRevision};
    if(!deleted)row.value=value;
    const bytes=encoder.encode(JSON.stringify(row)).length;
    if(bytes>250000)throw new Error('单条记录需要先分块，未发送');
    if(rows.length>=32||size+bytes>2_500_000)break;
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
    const next=clone(state),accepted=[];
    for(const row of result.records){
     safeKey(row.key);
     if(typeof row.revision!=='string'||!/^\d+$/.test(row.revision)||typeof row.deleted!=='boolean')throw new Error('同步版本有误');
     const fingerprint=row.deleted?'':await hash(row.value);ensure(token);
     const pending=next.pending[row.key];
     // Equal content is safe to reconcile even if a preceding journal ACK was lost.
     if(pending&&pending.deleted===row.deleted&&pending.hash===fingerprint)delete next.pending[row.key];
     if(!next.pending[row.key])accepted.push(clone(row));
     next.known[row.key]={revision:row.revision,deleted:row.deleted,hash:fingerprint};
    }
    next.cursor=result.cursor;next.seed=result.seed||null;more=result.more===true;
    if(!more)next.initialized=true;
    // Persist an inbox before touching app data; replay it after a crash before detecting local edits.
    await persist({...clone(state),inbox:{rows:accepted,next}},token);
    await recover(token);
   }
   return more;
  }
  return Object.freeze({
   cycle:()=>run(async token=>{await init(token);await capture(token);const pushed=await push(token);const more=await pull(token);return {pushed,more,pending:Object.keys(state.pending).length,conflicts:Object.values(state.pending).filter(x=>x.blocked).length};}),
   flush:()=>run(async token=>{await init(token);await capture(token);for(let n=0;n<64;n++)if(!await push(token))break;const more=await pull(token);return more||Object.values(state.pending).some(x=>!x.blocked);}),
   inspect:()=>run(async token=>{await init(token);return call({action:'inspect',deviceId:state.deviceId},token);}),
   seed:finish=>run(async token=>{await init(token);if(finish&&Object.keys(state.pending).length)throw new Error('首批数据尚未全部确认，请继续同步');const result=await call({action:'seed',deviceId:state.deviceId,finish:finish===true},token);const next=clone(state);next.seed=result.seed;await persist(next,token);return result.seed;}),
   request:body=>run(async token=>{await init(token);return call({...body,deviceId:state.deviceId},token);}),
   state:()=>state?clone(state):null,
   close(){closed=true;epoch++;},
  });
 }
 root.NorthPrivateDeviceSyncCore=Object.freeze({createJournal,canonical,hash});
})(typeof window==='undefined'?globalThis:window);
