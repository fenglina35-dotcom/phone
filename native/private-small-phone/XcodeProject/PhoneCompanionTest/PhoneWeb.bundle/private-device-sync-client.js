/* PRIVATE_ACCOUNT_CLOUD_SYNC_V1: app adapter, isolated from the pure journal and provider credentials. */
(function(root){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function createClient(host){
  const core=host.core;let context=null,owner='',epoch=0,busy=false,wakeTimer=0,stopped=false,error='',phase='authentication',loginError='',queuedReason='',scheduledReason='',retryCount=0,retryAt=0,lastLocalNetworkAt=0,localDeferredUntil=0;
  const permits=new Map();let account=host.account||{loggedIn:false,userId:''};
  const current=ctx=>!stopped&&context===ctx&&ctx.epoch===epoch&&owner===ctx.owner;
  function check(ctx){if(!current(ctx)){const failure=new Error('账号已变化，本轮同步已停止');failure.deviceSyncCancelled=true;throw failure;}}
  function busyError(){const failure=new Error('等待本机当前回复保存后继续同步');failure.deviceSyncBusy=true;return failure;}
  function stateKey(user,kind){return '__device_sync_v2_'+user+'_'+kind;}
  async function read(ctx,kind){check(ctx);const value=await host.read(stateKey(ctx.owner,kind));check(ctx);return value;}
  async function write(ctx,kind,value){check(ctx);await host.write(stateKey(ctx.owner,kind),value);check(ctx);}
  function announce(next,detail){phase=next;error=detail||'';host.status?.({phase,error,owner,ready:!!context?.ready,conflicts:context?.conflicts||0});}
  async function native(ctx,body){check(ctx);const value=await host.native('account.sync',body);check(ctx);if(value?.ok!==true){const failure=new Error(value?.message||value?.error||'账号同步暂时不可用');failure.code=value?.error||value?.code;throw failure;}if(body.action==='pull'){ctx.observedSeed=value.seed;ctx.pullMore=value.more===true;}return value;}
  function schedule(ms,reason='continue'){if(stopped||reason==='local'&&wakeTimer&&scheduledReason==='manual')return;clearTimeout(wakeTimer);scheduledReason=reason;wakeTimer=setTimeout(()=>{wakeTimer=0;scheduledReason='';tick(reason).catch(()=>{});},Math.max(0,ms));}
  function invalidate(){permits.clear();context?.journal?.close();context=null;epoch++;host.cancelReplies?.();}
  async function saveCodec(ctx,pendingView){await write(ctx,'codec',{version:1,records:ctx.codec.dump(),pendingView:!!pendingView});}
  async function visible(ctx,retainLocal){
   check(ctx);if(!ctx.authorized||!ctx.viewPending||host.isBusy())return false;
   ctx.applyingRemote=true;try{
   const unpacked=await ctx.codec.materialize();check(ctx);if(!unpacked.complete)return false;
   if(ctx.observedSeed?.phase!=='ready'&&ctx.seed?.phase!=='ready')return false;
   if(ctx.pullMore)return false;
   let incoming=unpacked.state;
   // Local edits made while an HTTP request was in flight are overlaid as records, never lost to a full S replacement.
   if(ctx.hasBase&&ctx.visibleRecords){
    const local=await host.snapshot();check(ctx);const projected=await ctx.codec.project(local),delta=[];
    for(const key of new Set([...Object.keys(ctx.visibleRecords),...Object.keys(projected)])){
     if(core.canonical(projected[key])===core.canonical(ctx.visibleRecords[key]))continue;
     delta.push(projected[key]===undefined?{key,deleted:true}:{key,value:projected[key],deleted:false});
    }
    if(delta.length){if(retainLocal)await retainLocal(delta);else if(ctx.seeding&&ctx.journal?.queue)await ctx.journal.queue(delta);else throw new Error('本机内容正在变化，请稍后同步');ctx.codec.accept(delta);await saveCodec(ctx,true);const merged=await ctx.codec.materialize();if(!merged.complete)throw new Error('本机新内容尚未完成整理');incoming=merged.state;ctx.dirtySeq++;}
   }
   if(host.isBusy())throw busyError();
   const preserved=ctx.codec.preserveDeviceState(incoming,host.getState());
   await host.replaceState(preserved,()=>check(ctx));check(ctx);
   ctx.visibleRecords=await ctx.codec.project(await host.snapshot());check(ctx);
   await write(ctx,'local',{version:1,owner:ctx.owner,state:await host.snapshot()});
   ctx.viewPending=false;await saveCodec(ctx,false);ctx.hasBase=true;ctx.ready=true;ctx.localTrusted=true;ctx.canPublish=true;
   host.reveal?.(ctx.owner,Math.max(1,ctx.codec.dump().filter(x=>x.key.startsWith('state/')).length));
   return true;
   }finally{ctx.applyingRemote=false;}
  }
  async function capture(ctx){
   check(ctx);if(ctx.dirtySeq===ctx.capturedSeq)return null;
   const stamp=ctx.dirtySeq,snapshot=await host.snapshot();check(ctx);
   const projected=await ctx.codec.project(snapshot);check(ctx);
   if(typeof ctx.codec.setLocalProjection==='function')ctx.codec.setLocalProjection(projected,ctx.visibleRecords);
   else ctx.codec.accept(Object.entries(projected).map(([key,value])=>({key,value,deleted:false})));
   await saveCodec(ctx,false);await write(ctx,'local',{version:1,owner:ctx.owner,state:snapshot});
   ctx.visibleRecords=projected;ctx.capturedSeq=stamp;
   return Object.assign(projected,ctx.codec.mediaRecords?.()||{});
  }
  async function build(status){
   const user=String(status.userId||'');if(!UUID.test(user))throw new Error('账号身份没有完整读取');
   if(owner!==user){invalidate();owner=user;}
   const ctx={owner:user,epoch,codec:core.createStateCodec(),ready:false,hasBase:false,canPublish:false,seed:null,observedSeed:null,pullMore:false,viewPending:false,dirtySeq:1,capturedSeq:0,visibleRecords:null,conflicts:0,conflictItems:[]};context=ctx;
   const bound=host.boundOwner(),marker=host.stateOwner?host.stateOwner():bound;ctx.legacySource=host.platform==='iOS'&&(!marker||marker===user)&&host.legacyOwner?.()===user&&host.nativeOwner?.()===user&&(host.hasPersistedSource?.()??true);
   if(!marker&&host.meaningful(host.getState())&&!ctx.legacySource)throw new Error('本机存档账号归属尚未核实，已保留原数据并停止自动迁移');
   if(bound&&(bound!==user||!marker)&&!ctx.legacySource){
    const previous=await host.snapshot();if(marker===bound||!marker&&host.legacyOwner?.()===bound&&host.meaningful(previous))await host.write(stateKey(bound,'local'),{version:1,owner:bound,state:previous});check(ctx);
    const local=await read(ctx,'local');await host.replaceState(local?.owner===user&&local.state?local.state:host.emptyState(),()=>check(ctx));check(ctx);
   }else if(!bound){
    const local=await read(ctx,'local');if(local?.owner===user&&local.state&&!host.meaningful(host.getState()))await host.replaceState(local.state,()=>check(ctx));
   }
   await host.bindOwner(user);check(ctx);
   const cached=await read(ctx,'codec');if(cached?.version===1){ctx.codec.load(cached.records);ctx.viewPending=!!cached.pendingView;}
   let previous=await read(ctx,'journal');if(previous?.initialized&&(!cached?.records?.length||!cached.records.some(row=>row.key==='state/schema'))){previous={...previous,cursor:0,initialized:false,known:{},inbox:null};await write(ctx,'journal',previous);}ctx.seed=previous?.seed||null;ctx.observedSeed=ctx.seed;ctx.pullMore=previous?.initialized!==true;
   const locallyOwned=host.boundOwner()===user&&(host.meaningful(host.getState())||previous?.initialized===true&&previous.seed?.phase==='ready'&&cached?.records?.length);
   ctx.hasBase=!!locallyOwned;ctx.ready=false;
   if(ctx.hasBase)ctx.visibleRecords=await ctx.codec.project(await host.snapshot());
   ctx.journal=core.createJournal({owner:user,platform:host.platform,label:host.label,getOwner:()=>owner,
    canPublish:()=>current(ctx)&&ctx.canPublish,
    transport:body=>native(ctx,body),
    storage:{read:()=>read(ctx,'journal'),write:(_,value)=>write(ctx,'journal',value)},
    snapshot:()=>capture(ctx),
    async apply(rows,guard,retainLocal){check(ctx);guard();if(host.isBusy()){const error=new Error('等待本机当前回复保存后继续同步');error.deviceSyncBusy=true;throw error;}ctx.codec.accept(rows);ctx.viewPending=true;await saveCodec(ctx,true);check(ctx);guard();await visible(ctx,retainLocal);}
   });
   // PRIVATE_TRUSTED_LOCAL_RESUME_V1: an existing verified account can open its
   // own local data while background authentication is pending. New/unproven
   // accounts still wait for the server before any account data is revealed.
   ctx.access=await read(ctx,'access');check(ctx);
   ctx.localTrusted=!!(!ctx.access?.revoked&&ctx.hasBase&&(marker===user||ctx.legacySource)&&(ctx.legacySource||previous?.initialized===true&&previous.seed?.phase==='ready'&&cached?.records?.some(row=>row.key==='state/schema')));
   if(ctx.localTrusted){ctx.ready=true;host.reveal?.(ctx.owner,Math.max(1,Object.keys(ctx.visibleRecords||{}).length));}
   return ctx;
  }
  async function sync(ctx){
   check(ctx);if(host.isBusy()){schedule(1500);return;}
   if(ctx.viewPending)await visible(ctx);
   if(ctx.needsRegister){await ctx.journal.reregister();check(ctx);ctx.needsRegister=false;}
   const info=await ctx.journal.inspect();check(ctx);ctx.authorized=true;ctx.seed=info.seed||null;ctx.observedSeed=ctx.seed;ctx.authority={isPrimary:info.isPrimary===true,primaryDeviceId:info.primaryDeviceId||null,primaryRevision:String(info.primaryRevision||'0')};ctx.conflictItems=info.conflicts||[];ctx.conflicts=ctx.conflictItems.length;
   if(ctx.access?.revoked){await write(ctx,'access',{revoked:false});ctx.access={revoked:false};}
   if(ctx.hasBase)ctx.localTrusted=true;
   // A fresh or previously removed account view requires server acceptance.
   if(ctx.hasBase&&!ctx.ready){ctx.ready=true;host.reveal?.(ctx.owner,Math.max(1,Object.keys(ctx.visibleRecords||{}).length));}
   if(ctx.viewPending)await visible(ctx);
   host.syncConnections?.();
   const device=ctx.journal.state()?.deviceId;
   if(!ctx.seed){
    if(host.platform==='iOS'){
     let allowed=host.meaningful(host.getState());
     if(!allowed){const old=await host.native('account.backup.info',{});check(ctx);allowed=old?.ok===true&&old.found===false;}
     if(allowed){announce('saving');ctx.seed=await ctx.journal.seed(false);ctx.observedSeed=ctx.seed;ctx.hasBase=true;ctx.canPublish=true;ctx.visibleRecords=await ctx.codec.project(await host.snapshot());}
    }
    if(!ctx.seed){announce('waiting');await ctx.journal.cycle();return;}
   }
   if(ctx.seed.phase==='pending'){
    if(ctx.seed.sourceDeviceId!==device){announce('waiting');await ctx.journal.cycle();return;}
    ctx.canPublish=true;ctx.seeding=true;announce('saving');
    // Each call is bounded; persist and yield between batches so a large first login can resume safely.
    await ctx.journal.flush(4);check(ctx);
    if(ctx.pullMore||!ctx.journal.canFinishSeed()){schedule(40);return;}
    ctx.seed=await ctx.journal.seed(true);ctx.observedSeed=ctx.seed;ctx.viewPending=true;ctx.pullMore=false;await visible(ctx);ctx.seeding=false;
   }else{
    ctx.canPublish=ctx.hasBase;announce('pulling');const result=await ctx.journal.cycle();check(ctx);
    if(result.more||result.pushed&&result.pending>0){schedule(40);return;}
    if(ctx.viewPending)await visible(ctx);
   }
   check(ctx);ctx.conflicts=new Set([...ctx.conflictItems.map(x=>x.id),...Object.values(ctx.journal.state()?.pending||{}).map(x=>x.blocked).filter(Boolean)]).size;
   announce(ctx.ready?'ready':'waiting');
  }
  // PRIVATE_SYNC_CHANGE_DRIVEN_V1: upload real local deltas; open/resume pulls
  // immediately. Quiet foreground uses one small watermark/authority check per
  // five minutes, without transferring records or running full reconciliation.
  async function tick(reason='manual'){
   if(stopped)return;if(busy){if(reason==='manual'||!queuedReason)queuedReason=reason;return;}busy=true;let failed=false,waiting=false,waitingReason='continue';
   try{
    if(!host.isVisible())return;
    const status=await host.native('account.status',{});if(stopped)return;
    if(status?.ok===false){const failure=new Error(status.message||status.error||'暂时无法读取本机账号，原登录仍保留');failure.code=status.error||status.code;throw failure;}
    account=status||{loggedIn:false};await host.onAccount?.(account);
    if(!account.loggedIn||!UUID.test(String(account.userId||''))){if(owner){invalidate();owner='';}announce('authentication');return;}
    let ctx=context;if(!ctx||owner!==String(account.userId))ctx=await build(account);
    if(reason==='local'&&ctx.ready&&ctx.journal.deviceId()){
     if(host.isBusy()){waiting=true;waitingReason='local';return;}
     const local=await ctx.journal.collectLocal();check(ctx);
     if(!local.needsConnect&&!local.pending){if(phase!=='network')announce('ready');return;}
     if(retryAt>Date.now())return;
     if(!local.urgent&&!host.recentInteraction?.()&&lastLocalNetworkAt&&Date.now()-lastLocalNetworkAt<60000){localDeferredUntil=lastLocalNetworkAt+60000;schedule(localDeferredUntil-Date.now(),'local');return;}
     localDeferredUntil=0;
    }
    if(reason==='check'&&ctx.ready&&ctx.authorized){
     const info=await ctx.journal.check();check(ctx);
     ctx.authority={isPrimary:info.isPrimary===true,primaryDeviceId:info.primaryDeviceId||null,primaryRevision:String(info.primaryRevision||'0')};
     if(info.changed!==true){retryCount=0;retryAt=0;announce('ready');return;}
    }
    await sync(ctx);if(reason==='local')lastLocalNetworkAt=Date.now();retryCount=0;retryAt=0;
   }catch(e){
    if(stopped||e?.deviceSyncCancelled)return;
    if(e?.deviceSyncBusy){waiting=true;return;}
    failed=true;retryCount++;retryAt=Date.now()+[30000,120000,300000,900000][Math.min(retryCount-1,3)];
    const message=String(e?.message||'连接暂时中断');
    if((e?.code||message)==='device_revoked'){
     // PRIVATE_DEVICE_REVOKED_GATE_V1: stop all consumers before touching login UI.
     // Keep per-account local data and the outbox; only discard session authority.
     if(context)await write(context,'access',{revoked:true}).catch(()=>{});
     invalidate();owner='';host.accountReset?.();account={loggedIn:false,userId:''};
     await host.onAccount?.(account);announce('authentication','此设备已退出账号，请重新登录');
     await host.native('account.signout',{}).catch(()=>{});
    }else if((e?.code||message)==='device_revoked_or_unknown'){
     // Registration confirms an actual removal; an unknown/stale device ID is
     // insufficient evidence to destroy the native login credential.
     if(context){context.authorized=false;context.needsRegister=true;}
     announce('network','正在重新确认设备连接，账号和本机内容已保留');schedule(0);
    }else{
     if(context&&!context.journal)context=null;
     const ctx=context;
     if(ctx&&['authentication_required','account_auth_timeout','account_auth_temporarily_unavailable','account_network_error'].includes(e?.code||message))ctx.authorized=false;
     // PRIVATE_AUTH_SESSION_RETENTION_V1: a transient verification failure never
     // changes identity or substitutes another account's cached content.
     const marker=host.stateOwner?host.stateOwner():host.boundOwner();
     if(ctx?.journal&&ctx.localTrusted&&account.loggedIn&&String(account.userId)===owner&&host.boundOwner()===owner&&(marker===owner||ctx.legacySource)&&!ctx.ready){
      ctx.ready=true;host.reveal?.(ctx.owner,Math.max(1,Object.keys(ctx.visibleRecords||{}).length));
     }
     if(!stopped)announce('network',(e?.code||message)==='authentication_required'?'暂时无法验证账号，登录和本机内容已保留，请重试连接':message);
    }
   }
   finally{
    busy=false;
    if(!stopped&&host.isVisible()){
     if(queuedReason){const next=queuedReason;queuedReason='';schedule(0,next);}
     else if(waiting)schedule(1500,waitingReason);
     else if(!wakeTimer){
      if(failed||retryAt>Date.now()){if(retryCount<=4)schedule(Math.max(0,retryAt-Date.now()),'retry');}
      else if(context?.ready)schedule(300000,'check');
     }
    }
   }
  }
  function manualKey(id,aid){return String(aid||'main')+'|'+String(id);}
  const api={
   start:()=>{stopped=false;schedule(0);},
   // PRIVATE_SYNC_REFRESH_RETAIN_CONTEXT_V1: refresh/retry are not account switches.
   retry(){retryCount=0;retryAt=0;localDeferredUntil=0;announce(context?.ready?'pulling':'waiting');if(busy){queuedReason='manual';return;}schedule(0,'manual');},
   syncNow:()=>{retryCount=0;retryAt=0;localDeferredUntil=0;clearTimeout(wakeTimer);wakeTimer=0;scheduledReason='';return tick('manual');},
   suspend(){clearTimeout(wakeTimer);wakeTimer=0;scheduledReason='';queuedReason='';},
   async waitForIdle(localUse=false){const activeOwner=owner;while(busy&&!stopped&&owner===activeOwner&&!(context?.localTrusted&&context.ready&&!context.applyingRemote&&!host.applying()&&(localUse||phase==='network'||!context.authorized)))await wait(20);if(stopped||owner!==activeOwner)throw new Error('账号已变化');},
   async prepareAccountSwitch(){if(!context||!owner)return;const ctx=context,state=await host.snapshot();check(ctx);await write(ctx,'local',{version:1,owner:ctx.owner,state});if(host.persistCurrent&&!await host.persistCurrent())throw new Error('当前账号内容尚未保存');},
   accountChanged(nextOwner,refreshSession=false){if(typeof nextOwner==='string'&&nextOwner===owner&&context){if(refreshSession)context.needsRegister=true;api.retry();return;}invalidate();schedule(0,'manual');},
   stop(){stopped=true;clearTimeout(wakeTimer);invalidate();owner='';},
   markDirty(){if(host.applying())return;if(context){context.dirtySeq++;if(host.isVisible())schedule(host.recentInteraction?.()?1500:Math.max(1500,localDeferredUntil-Date.now()),'local');}},
   status:()=>({owner,phase,error,ready:!!context?.ready,secondary:context?.authority?context.authority.isPrimary!==true:null,conflicts:context?.conflicts||0,syncing:busy}),
   gateAllowed:()=>!!(owner&&context?.ready&&host.boundOwner()===owner),
   legacySourceOwned:user=>!!(context?.legacySource&&owner===user&&host.boundOwner()===user&&host.legacyOwner?.()===user&&host.nativeOwner?.()===user),
   automaticStateAllowed:()=>!!(context?.ready&&context.authorized&&context.seed?.phase==='ready'&&context.authority?.isPrimary),
   backgroundAllowed:()=>api.automaticStateAllowed()&&host.platform==='iOS',
   authorizeReply(id,aid,token){if(!context?.ready)return '';const key=manualKey(id,aid),permit={token:root.crypto.randomUUID(),epoch:token,expires:Date.now()+15*60000,owner};permits.set(key,permit);return permit.token;},
   revokeReply(id,aid){permits.delete(manualKey(id,aid));},
   replyPermit(id,aid,token,manual){const permit=permits.get(manualKey(id,aid));return manual&&permit&&permit.owner===owner&&permit.epoch===token&&permit.expires>Date.now()?permit.token:'';},
   modelAllowed(options){if(api.backgroundAllowed())return true;return !!context?.ready&&Array.from(permits.values()).some(x=>x.token===options?.deviceSyncManual&&x.owner===owner&&x.expires>Date.now());},
   // PRIVATE_MEDIA_READ_LANE_V1: immutable reads do not wait behind a large
   // journal transaction. The native boundary still checks the captured owner
   // before and after HTTP, and the server checks this registered device.
   async request(body){const ctx=context;if(!ctx)throw new Error('请先登录账号');if(body?.action==='media.get'&&ctx.ready&&ctx.journal.deviceId())return native(ctx,{...body,deviceId:ctx.journal.deviceId(),protocolVersion:2});return ctx.journal.request(body);},
   async devices(){await api.waitForIdle();const ctx=context;if(!ctx?.ready)throw new Error('请先完成账号连接');const info=await ctx.journal.inspect();check(ctx);ctx.authority={isPrimary:info.isPrimary===true,primaryDeviceId:info.primaryDeviceId||null,primaryRevision:String(info.primaryRevision||'0')};return {...copy(info),deviceId:ctx.journal.state()?.deviceId};},
   async revokeDevice(targetId){await api.waitForIdle();const ctx=context;if(!ctx?.ready||!UUID.test(String(targetId)))throw new Error('登录设备信息已变化');const result=await ctx.journal.request({action:'revoke',targetId});check(ctx);return result;},
   async makePrimary(password,primaryRevision){await api.waitForIdle();const ctx=context;if(!ctx?.ready||typeof password!=='string'||!/^\d+$/.test(String(primaryRevision)))throw new Error('请重新读取登录设备');const result=await ctx.journal.request({action:'primary',password,primaryRevision:String(primaryRevision)});check(ctx);ctx.authority={isPrimary:result.isPrimary===true,primaryDeviceId:result.primaryDeviceId,primaryRevision:result.primaryRevision};schedule(0);return result;},
   async conflicts(){await api.waitForIdle();const ctx=context;if(!ctx?.ready)throw new Error('账号内容仍在同步，请稍后查看');check(ctx);const info=await ctx.journal.inspect();check(ctx);ctx.conflictItems=info.conflicts||[];ctx.conflicts=ctx.conflictItems.length;announce(phase);return copy(ctx.conflictItems);},
   async conflict(id){await api.waitForIdle();const ctx=context;if(!ctx?.ready||!UUID.test(String(id)))throw new Error('这项修改已变化，请刷新列表');const result=await ctx.journal.request({action:'conflict',conflictId:id});check(ctx);return result;},
   async resolveConflict(id,choice,revision){await api.waitForIdle();const ctx=context;if(!ctx?.ready||host.isBusy())throw new Error('请等当前回复或保存完成后再处理');if(!UUID.test(String(id))||!['server','candidate'].includes(choice)||!/^\d+$/.test(String(revision)))throw new Error('修改信息已变化，请重新查看');check(ctx);if(typeof ctx.journal.resolve!=='function')throw new Error('同步服务仍在更新，请稍后重试');const result=await ctx.journal.resolve(id,choice,String(revision));check(ctx);if(result?.ok!==true)throw new Error('此次选择尚未确认，两份修改仍然保留');const info=await ctx.journal.inspect();check(ctx);ctx.conflictItems=info.conflicts||[];ctx.conflicts=ctx.conflictItems.length;announce(phase);schedule(0);return result;},

   context:()=>context,
   flush:async()=>{if(!context)return false;const more=await context.journal.flush();await visible(context);return !more;}
  };
  return Object.freeze(api);
 }
 root.NorthPrivateDeviceSyncRuntime=Object.freeze({createClient});
 if(root.__SMALL_PHONE_PRIVATE__!==true||root.__SMALL_PHONE_ACCOUNT_SYNC__!==true||!root.SmallPhoneNative||!root.NorthPrivateDeviceSyncCore)return;
 const platform=root.__SMALL_PHONE_MAC__===true?'macOS':'iOS';let applying=false,client,overlay=null,activeModels=0,waitingReplies=0,finishingReplies=0,accountRecoveryExpanded=false;
 const BOUND='north-private-device-owner-v1';
 const labels={authentication:'登录小手机账号',waiting:'正在等待账号数据',saving:'正在同步本机已有数据',pulling:'正在读取账号内容',ready:'账号同步已连接',network:'同步暂时中断'};
 async function native(action,body){return root.SmallPhoneNative.request(action,body||{});}
 async function syncStore(key,value,put){
  const match=String(key).match(/^__device_sync_v2_([0-9a-f-]{36})_/i);if(!match||!UUID.test(match[1]))throw new Error('账号同步缓存标识有误');
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('smallphone-account-sync-v2-'+match[1],1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('state'))request.result.createObjectStore('state');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  return new Promise((resolve,reject)=>{const transaction=db.transaction('state',put?'readwrite':'readonly'),store=transaction.objectStore('state');let result=null;
   const request=put?store.put(value,key):store.get(key);request.onsuccess=()=>{result=request.result;};transaction.oncomplete=()=>{db.close();resolve(put?true:result||null);};transaction.onerror=transaction.onabort=()=>{db.close();reject(transaction.error||new Error('账号缓存未保存'));};});
 }
 async function ownerImage(key,user){const db=await imgDB(user);return new Promise((resolve,reject)=>{let result=null;const transaction=db.transaction('img','readonly'),request=transaction.objectStore('img').get(key);request.onsuccess=()=>{result=request.result;};transaction.oncomplete=()=>{db.close();resolve(result);};transaction.onerror=()=>{db.close();reject(transaction.error);};});}
 async function snapshot(){
  if(typeof _bootImagesPromise!=='undefined'&&_bootImagesPromise)await _bootImagesPromise;
  const old=typeof _recoveryInlineSave==='undefined'?false:_recoveryInlineSave;
  let state;try{if(typeof _recoveryInlineSave!=='undefined')_recoveryInlineSave=true;state=JSON.parse(JSON.stringify(S,typeof _imgReplacer==='function'?_imgReplacer:undefined));}finally{if(typeof _recoveryInlineSave!=='undefined')_recoveryInlineSave=old;}
  const stores=[[state,'messages','__messages'],[state.me?.phoneFriend,'messages','__pf_messages_'+(state.me?.phoneFriend?.id||'main')],[state.me?.phoneFriend,'groupMessages','__pf_group_messages_'+(state.me?.phoneFriend?.id||'main')]];
  for(const [object,key,id] of stores)if(object?.[key]?.__idb){const raw=await ownerImage(id,String(S._deviceSyncOwner||privateAccountLegacyIdentity()));if(typeof raw!=='string')throw new Error('本机聊天仍在读取，请稍后继续');object[key]=JSON.parse(raw);}
  await compactImages(state,String(S._deviceSyncOwner||privateAccountDataIdentity()));queueMediaRefs(state);return state;
 }
 // Media bytes use account-scoped object storage. Text hydration never waits for an album or a video.
 const mediaPending=new Map(),mediaDownloads=new Map();let mediaTimer=0,mediaRunning=false,mediaSequence=0;
 const mediaOriginal={imgGet:root.imgGet,imgPut:root.imgPut,mGet:root.mGet,mPut:root.mPut,cinGet:root.cinGet,cinPut:root.cinPut};
 const mediaDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 function mediaBase64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
 function mediaDecode(text){const raw=atob(String(text).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,x=>x.charCodeAt(0));}
 function mediaTarget(key){return key.startsWith('music:')?{store:'music',key:key.slice(6)}:key.startsWith('cinema:')?{store:'cinema',key:key.slice(7)}:{store:'img',key};}
 function mediaAllowed(key){if(typeof key!=='string'||!key||key.length>512)return false;const local=mediaTarget(key).key;return !!local&&!/^__(?:core|recovery|private|device|messages|pf_messages|pf_group_messages|music_manifest)/i.test(local);}
 function queueMedia(key,force){if(!mediaAllowed(key))return;const user=String(S._deviceSyncOwner||privateAccountDataIdentity());if(!UUID.test(user))return;const id=user+'|'+key,old=mediaPending.get(id);if(old&&!force)return;mediaPending.set(id,{user,key,force:!!force||!!old?.force,priority:force?++mediaSequence:old?.priority||0});scheduleMedia(300);}
 function queueMediaRefs(state){const walk=value=>{if(typeof value==='string'){if(value.startsWith('idb:'))queueMedia(value.slice(4));else if(value.startsWith('album:'))queueMedia(value.slice(6));else if(value.startsWith('idb-audio:'))queueMedia('__audio_'+value.slice(10));else value.replace(/idb-audio:([^"'\\\s\[\]]+)/g,(_,id)=>{queueMedia('__audio_'+id);return _;});}else if(value&&typeof value==='object')for(const child of Object.values(value))walk(child);};walk(state);
  for(const song of state.music?.songs||[])if(song?.src?.t==='idb'&&song.id)queueMedia('music:'+song.id);
  for(const item of state.cinema?.library||[])if(item?.source==='idb'&&item.mediaKey)queueMedia('cinema:'+(item.storeKey||cinemaStoreKey(item.kind,item.mediaKey)));
  for(const contact of state.contacts||[])if(contact?.callLoopVideo?.key)queueMedia(contact.callLoopVideo.key);
 }
 async function compactImages(state,user){async function walk(object){if(!object||typeof object!=='object')return;for(const key of Object.keys(object)){const value=object[key];if(typeof value==='string'&&/^data:image\//i.test(value)&&value.length>2048){const id='sync-img-'+await mediaDigest(new TextEncoder().encode(value));await imgPutIDBWithRetry(id,value,user);object[key]='idb:'+id;}else if(value&&typeof value==='object')await walk(value);}}await walk(state);}
 async function mediaRead(key,user){const target=mediaTarget(key);if(target.store==='img')return ownerImage(target.key,user);return target.store==='music'?mediaOriginal.mGet(target.key,user):mediaOriginal.cinGet(target.key,user);}
 async function mediaWrite(key,value,user){const target=mediaTarget(key);if(target.store==='img')return imgPutIDBWithRetry(target.key,value,user);return target.store==='music'?mediaOriginal.mPut(target.key,value,user):mediaOriginal.cinPut(target.key,value,user);}
 function scheduleMedia(ms){if(mediaTimer||document.hidden)return;mediaTimer=setTimeout(()=>{mediaTimer=0;pumpMedia().catch(()=>{});},ms||500);}
 async function pumpMedia(){
  const ctx=client?.context();if(mediaRunning||!ctx?.ready||ctx.seed?.phase!=='ready'||!ctx.canPublish||document.hidden||isBusy()){scheduleMedia(5000);return;}mediaRunning=true;
  try{for(const [id,item] of Array.from(mediaPending).sort((a,b)=>(b[1].priority||0)-(a[1].priority||0))){if(client.context()!==ctx)break;if(item.user!==ctx.owner){mediaPending.delete(id);continue;}if(!item.force&&ctx.codec.mediaManifest(item.key)){mediaPending.delete(id);continue;}
   const value=await mediaRead(item.key,item.user);if(client.context()!==ctx)break;if(value==null){mediaPending.delete(id);continue;}
   const type=value instanceof Blob?'blob':typeof value==='string'?'string':'json',bytes=type==='blob'?new Uint8Array(await value.arrayBuffer()):new TextEncoder().encode(type==='string'?value:JSON.stringify(value)),hash=await mediaDigest(bytes),existing=ctx.codec.mediaManifest(item.key);
   if(existing?.hash===hash){mediaPending.delete(id);continue;}const parts=[];
   for(let offset=0;offset<bytes.length;offset+=1048576){if(client.context()!==ctx)throw new Error('账号已变化');const part=bytes.subarray(offset,Math.min(offset+1048576,bytes.length)),partHash=await mediaDigest(part);await client.request({action:'media.put',hash:partHash,base64:mediaBase64(part)});parts.push(partHash);await wait(0);}
   if(client.context()!==ctx)break;const row=await ctx.codec.addMediaManifest({localKey:item.key,type,mime:type==='blob'?value.type||'application/octet-stream':undefined,bytes:bytes.length,hash,parts});
   await syncStore('__device_sync_v2_'+ctx.owner+'_codec',{version:1,records:ctx.codec.dump(),pendingView:ctx.viewPending},true);await ctx.journal.queue([row]);await ctx.journal.flush(1);if(mediaPending.get(id)===item)mediaPending.delete(id);
   // One file per idle turn keeps chat and foreground synchronization responsive.
   break;
  }}catch(_){scheduleMedia(30000);}finally{mediaRunning=false;if(mediaPending.size)scheduleMedia(700);}
 }
 async function fetchMedia(key){
  const ctx=client?.context(),manifest=ctx?.codec.mediaManifest(key);if(!ctx?.ready||!ctx.authorized||!manifest||!mediaAllowed(key))return null;
  const id=ctx.owner+'|'+key;if(mediaDownloads.has(id))return mediaDownloads.get(id);
  const task=(async()=>{const parts=[];let totalBytes=0;for(const hash of manifest.parts){if(client.context()!==ctx)throw new Error('账号已变化');const row=await client.request({action:'media.get',hash}),bytes=mediaDecode(row.base64);if(await mediaDigest(bytes)!==hash)throw new Error('媒体分块校验未通过');parts.push(bytes);totalBytes+=bytes.length;}if(totalBytes!==manifest.bytes)throw new Error('媒体文件尚未完整同步');const bytes=new Uint8Array(totalBytes);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}if(await mediaDigest(bytes)!==manifest.hash)throw new Error('媒体文件校验未通过');if(client.context()!==ctx)throw new Error('账号已变化');const text=manifest.type==='blob'?null:new TextDecoder().decode(bytes),value=manifest.type==='blob'?new Blob([bytes],{type:manifest.mime||'application/octet-stream'}):manifest.type==='json'?JSON.parse(text):text;await mediaWrite(key,value,ctx.owner);if(client.context()!==ctx)throw new Error('账号已变化');return value;})().finally(()=>mediaDownloads.delete(id));mediaDownloads.set(id,task);return task;
 }
 function installMediaHooks(){for(const [getName,putName,prefix] of [['imgGet','imgPut',''],['mGet','mPut','music:'],['cinGet','cinPut','cinema:']]){const originalGet=mediaOriginal[getName],originalPut=mediaOriginal[putName];if(typeof originalGet==='function')root[getName]=async function(key,owner){const active=String(S._deviceSyncOwner||privateAccountDataIdentity()),value=await originalGet.apply(this,arguments);if(value!=null||owner&&owner!==active||!mediaAllowed(prefix+key))return value;try{return await fetchMedia(prefix+key);}catch(_){return null;}};if(typeof originalPut==='function')root[putName]=async function(key,value,owner){const captured=String(owner||value?.owner||S._deviceSyncOwner||privateAccountDataIdentity()),result=await originalPut.apply(this,arguments);if(captured===String(S._deviceSyncOwner||privateAccountDataIdentity()))queueMedia(prefix+key,true);return result;};}}
 function isBusy(){return !!(activeModels||typeof replyGenerationStore==='function'&&Object.keys(replyGenerationStore()).length>waitingReplies+finishingReplies||typeof _fullBackupImportBusy!=='undefined'&&_fullBackupImportBusy||typeof _off!=='undefined'&&_off?.busy||typeof _call!=='undefined'&&_call||typeof _momentReplyBusy!=='undefined'&&_momentReplyBusy.size);}
 // PRIVATE_SYNC_COMPOSER_OWNER_V1: preserve the editor session while adopting only a verified same-owner publication.
 function adoptPublishedComposer(previous,owner){
  if(!owner||String(previous?._deviceSyncOwner||'')!==owner||String(S._deviceSyncOwner||'')!==owner||typeof cur!=='function'||typeof actId!=='function')return;
  const page=cur(),ta=typeof document.getElementById==='function'?document.getElementById('cinput'):null,role=page?.p==='chat'&&typeof getC==='function'?getC(page.id):null;
  if(!ta||!ta.isConnected||!role||role.deleted||ta._chatOwner!==previous||ta._chatId!==page.id||ta._chatAccount!==actId())return;
  ta._chatOwner=S;if(typeof chatComposerStateSync==='function')chatComposerStateSync(ta);
 }
 async function replaceState(next,guard){
  guard();const previous=S;applying=true;
  try{
   const user=client.status().owner;if(String(previous._deviceSyncOwner||'')!==user){_imgCache={};_imgRev=new Map();_imgReady=new Set();_heavy={};_heavyStamp={};_heavyReady=new Set();}
   S=mergeStateData(next);S._deviceSyncOwner=user;normalizeLoadedState();guard();if(!await saveNowAsync())throw new Error('账号内容保存未完成');guard();if(typeof phoneFriendState==='function')phoneFriendState();adoptPublishedComposer(previous,user);
   if(typeof cur==='function'&&cur().p==='chat'&&typeof refreshChatMessages==='function')refreshChatMessages(cur().id);
   else if(!document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]')&&typeof render==='function')render();
  }
  catch(e){const failed=S;S=previous;adoptPublishedComposer(failed,String(previous._deviceSyncOwner||''));throw e;}finally{applying=false;}
 }
 function cancelReplies(){closeConflictPanel();closeDevicePanel();try{const aids=(S.me?.accounts||[]).map(x=>x.id);if(!aids.length)aids.push('main');for(const contact of S.contacts||[])for(const aid of aids)if(typeof replyTouch==='function')replyTouch(contact.id,aid);}catch(_){} }
 async function onAccount(status){
  if(!status||status.ok===false)throw new Error(status?.message||'暂时无法读取本机账号，原登录已保留');
  const previous=typeof _privatePhoneAccount!=='undefined'?String(_privatePhoneAccount.userId||''):'';
  if(previous&&previous!==String(status.userId||'')){accountRecoveryExpanded=false;cancelReplies();if(typeof MCPTools!=='undefined')MCPTools.accountReset?.();for(const task of [typeof _coreMirrorWrite==='undefined'?null:_coreMirrorWrite,typeof _messageArchiveWrite==='undefined'?null:_messageArchiveWrite])if(task)await Promise.resolve(task).catch(()=>{});}
  if(typeof _privatePhoneAccount!=='undefined')Object.assign(_privatePhoneAccount,{loaded:true,loggedIn:!!status.loggedIn,userId:status.userId||'',maskedPhone:status.maskedPhone||'',error:''});
  if(!status.loggedIn)return;
  if(typeof _bootImagesPromise!=='undefined'&&_bootImagesPromise)try{await _bootImagesPromise;}catch(error){
   if(!privateAccountStorageReady())throw error;
   const different=String(S._deviceSyncOwner||privateAccountLegacyIdentity())!==String(status.userId)||!!(_coreBootRef?.accountSwitch||_coreBootRef?.recovery&&privateAccountLegacyIdentity()!==String(status.userId));
   if(!different)throw error;
   _coreBootRef=null;_coreOverflowMode=false;_coreQueuedSave=null;_coreMirrorWrite=Promise.resolve(true);S=defState();S._deviceSyncOwner=status.userId;_bootImagesPromise=Promise.resolve();_appBootFinished=false;finishAppBoot();
  }
 }
 function notify(stage,phase,recordCount){if(platform!=='macOS')return;const state=client?.status();native('account.sync.ui',{stage,phase,owner:state?.owner||'',hydrated:stage==='ready',recordCount:recordCount||0}).catch(()=>{});}
 // PRIVATE_ACCOUNT_CRITICAL_MEDIA_V1: a newly hydrated account can have no
 // wallpaper DOM marker yet. Restore the startup images after the account view
 // becomes usable, and again as media manifests arrive, without saving S.
 let criticalImageTimer=0,criticalImageBusy=false,criticalImageAgain=false;
 function scheduleAccountImages(){
  if(criticalImageBusy){criticalImageAgain=true;return;}
  if(criticalImageTimer||document.hidden)return;
  criticalImageTimer=setTimeout(()=>{criticalImageTimer=0;hydrateAccountImages().catch(()=>{});},0);
 }
 async function hydrateAccountImages(){
  const ctx=client?.context();if(criticalImageBusy||!ctx?.ready||!ctx.authorized||document.hidden||typeof privateBootImageKeys!=='function')return;
  const keys=privateBootImageKeys().filter(key=>!_imgCache[key]&&ctx.codec.mediaManifest(key));if(!keys.length)return;
  criticalImageBusy=true;let changed=false;
  try{
   for(let at=0;at<keys.length;at+=4){
    if(client.context()!==ctx||document.hidden)return;
    const found=await root.imgMany(keys.slice(at,at+4));if(client.context()!==ctx)return;
    for(const [key,value] of Object.entries(found)){if(value==null)continue;_imgCache[key]=value;_imgRev.set(value,key);_imgReady.add(key);_visibleImageMisses.delete(key);changed=true;}
    if(changed&&client.context()===ctx){
     hydrateStoredImageNodes();
     if(!document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]')&&typeof render==='function')render();
     changed=false;
    }
   }
  }finally{criticalImageBusy=false;if(criticalImageAgain){criticalImageAgain=false;scheduleAccountImages();}}
 }
 function removeGate(){const gate=document.getElementById('gate');if(gate)gate.remove();}
 function reveal(user,count){if(client?.status().owner!==user)return;removeGate();scheduleAccountImages();if(typeof scheduleVisibleStoredImages==='function')scheduleVisibleStoredImages(true);scheduleMedia(100);if(overlay){overlay.remove();overlay=null;}notify('ready','ready',count);}
 // PRIVATE_ACCOUNT_STATUS_SETTINGS_ONLY_V1: background connection failures
 // are visible only inside the account section of authorization and data.
 function accountStatusText(status){return (labels[status.phase]||'正在连接账号')+(status.phase==='network'&&status.error?' · '+status.error:'')+(status.conflicts?' · '+status.conflicts+' 项不同修改已安全保留':'');}
 function showStatus(status){
  const accountStatus=document.getElementById('privateSyncAccountStatus');if(accountStatus)accountStatus.textContent=accountStatusText(status);
  const counter=document.getElementById('privateSyncConflictCount');if(counter){counter.hidden=!status.conflicts;counter.style.display=status.conflicts?'':'none';counter.textContent='查看 '+status.conflicts+' 项不同修改';}
  if(status.ready){scheduleAccountImages();if(overlay){overlay.remove();overlay=null;}if(status.phase==='ready')notify('ready','ready',client.context()?.codec.dump().length||1);return;}
  notify(status.phase==='network'?'error':'progress',status.phase);
  // PRIVATE_SYNC_NONBLOCKING_V1: startup and network progress belong in
  // authorization/data. Never create a second, non-dismissable login/sync gate.
  // gateAllowed still protects unverified/foreign account contents.
  if(overlay){overlay.remove();overlay=null;}

 }
 client=createClient({core:root.NorthPrivateDeviceSyncCore,platform,label:platform==='macOS'?'小手机 Mac':'小手机 iPhone',native,
  read:key=>syncStore(key,null,false),write:(key,value)=>syncStore(key,value,true),snapshot,getState:()=>S,replaceState,
  emptyState:()=>defState(),meaningful:state=>recoveryStateMeaningful(recoveryStateStats(state)),
  hasPersistedSource:()=>_privateCoreVerifiedOwner===privateAccountDataIdentity(),
  stateOwner:()=>String(S._deviceSyncOwner||''),boundOwner:()=>String(S._deviceSyncOwner||localStorage.getItem(BOUND)||''),legacyOwner:()=>privateAccountLegacyIdentity(),nativeOwner:()=>String((root.__SMALL_PHONE_NATIVE_ACCOUNT__||root.__SMALL_PHONE_ACCOUNT__||{}).userId||''),
  async bindOwner(user){const previous=S._deviceSyncOwner;applying=true;try{S._deviceSyncOwner=user;if(!await saveNowAsync())throw new Error('账号归属保存未完成');localStorage.setItem(BOUND,user);}catch(e){if(previous===undefined)delete S._deviceSyncOwner;else S._deviceSyncOwner=previous;throw e;}finally{applying=false;}},
  applying:()=>applying,isBusy,isVisible:()=>!document.hidden,recentInteraction:()=>typeof _privatePhoneLastInteractionAt!=='undefined'&&Date.now()-_privatePhoneLastInteractionAt<5000,onAccount,status:showStatus,reveal,cancelReplies,persistCurrent:()=>saveNowAsync(),
  accountReset:()=>{if(typeof MCPTools!=='undefined')MCPTools.accountReset?.();},syncConnections:()=>{if(typeof MCPTools!=='undefined')Promise.resolve(MCPTools.accountSync?.()).catch(()=>{});}});
 root.NorthPrivateDeviceSyncClient=client;root.privatePhoneAutomaticStateAllowed=()=>client.automaticStateAllowed();installMediaHooks();
 const originalMany=root.imgMany;if(typeof originalMany==='function')root.imgMany=async function(keys){const user=client.status().owner,found=await originalMany.apply(this,arguments);if(!client.context()?.ready)return found;for(const key of (keys||[]).filter(key=>found[key]==null&&mediaAllowed(key)).slice(0,4)){if(client.status().owner!==user)break;try{const value=await fetchMedia(key);if(value!=null)found[key]=value;}catch(_){}}return found;};
 const originalChatAPI=root.chatAPI;
 if(typeof originalChatAPI==='function')root.chatAPI=async function(messages,opt){/* MODEL_SOURCE_BEFORE_SYNC_WAIT_V1 */opt=Object.assign({},opt);if(typeof modelFeatureOf==='function'){const originOpt=Object.assign({},opt);delete originOpt._modelFeatureOrigin;opt._modelFeatureOrigin=modelFeatureOf(originOpt);}await client.waitForIdle(true);activeModels++;try{return await originalChatAPI.call(this,messages,opt);}finally{activeModels--;}};
 const originalReply=root.aiReply,localReplyTurns=new Map();
 const runDeviceReply=async function(id,note,token,aid,intent,options,hasLocalLock=false){
  aid=aid||actId();waitingReplies++;
  try{await client.waitForIdle(true);}finally{waitingReplies--;}
  const ctx=client.context();if(!ctx?.ready)return false;
  // PRIVATE_USER_EVENT_REPLY_PERMIT_V1: a fresh user turn may carry a real feature event without becoming autonomous work.
  const userEvent=!!note&&typeof featureEventNoteActive==='function'&&featureEventNoteActive(note)&&typeof replyPendingUserText==='function'&&!!replyPendingUserText(id,aid);
  const manualToken=client.replyPermit(id,aid,token,!note||!!options?.reopenCompleted||userEvent);
  if(!client.backgroundAllowed()&&!manualToken)return false;
  const generation=ctx.epoch,threadKey=await root.NorthPrivateDeviceSyncCore.hash([aid,id]);
  const rows=msgsForAccount(id,aid),lastUser=[...rows].reverse().find(x=>x?.role==='user'&&x.type!=='sys');
  // PRIVATE_REPLY_ATTEMPT_OWNERSHIP_V1: an explicit regeneration is a new
  // attempt. The durable token recovers only this device's exact old lease.
  const leaseToken=crypto.randomUUID(),regenerate=!!(manualToken&&options?.reopenCompleted&&lastUser?._replyHandoffCompleted);
  const turnKey=String(note&&options?.reopenCompleted||regenerate?'continue:'+crypto.randomUUID():!note&&lastUser?.id?lastUser.id:'event:'+crypto.randomUUID()).slice(0,240);
  const localKey=ctx.owner+'|'+threadKey,leaseKey='__device_sync_v2_'+ctx.owner+'_turn_'+threadKey;
  if(localReplyTurns.has(localKey))return false;
  localReplyTurns.set(localKey,leaseToken);
  let lease=false,lost=false,renewing=false,renewTimer=0,result=false;
  const assert=()=>{if(client.context()!==ctx||ctx.epoch!==generation||client.status().owner!==ctx.owner)throw new Error('账号已变化');};
  const direct=async body=>{assert();const response=await native('account.sync',Object.assign({deviceId:ctx.journal.state()?.deviceId,threadKey,turnKey,leaseToken},body));assert();if(response?.ok!==true){const error=new Error('当前回复状态暂时无法确认');error.code=response?.error||response?.code;throw error;}return response;};
  try{
   // PRIVATE_MANUAL_OFFLINE_REPLY_V1: preserve manual use of a verified local
   // account during an authentication outage. Save the result locally; the
   // durable outbox uploads it when authentication returns, without replaying
   // the model request. Automatic replies still require primary authority.
   if(manualToken&&ctx.localTrusted&&(!ctx.authorized||client.status().phase==='network')){
    result=!!(await originalReply.call(this,id,note,token,aid,intent,options));assert();
    client.markDirty();if(!await saveNowAsync())throw new Error('回复尚未保存');return result;
   }
   const previous=await syncStore(leaseKey,null,false);assert();
   if(hasLocalLock&&previous&&previous.deviceId===ctx.journal.deviceId()&&previous.threadKey===threadKey&&UUID.test(previous.leaseToken||'')&&typeof previous.turnKey==='string'){
    const released=await direct({...previous,action:'turn.finish',completed:false}).catch(error=>{if(error.code==='turn_lease_lost')return {ok:true};throw error;});
    if(released.ok!==true)throw new Error('上一轮回复状态尚未确认');
   }
   await syncStore(leaseKey,{deviceId:ctx.journal.deviceId(),threadKey,turnKey,leaseToken},true);assert();
   const acquired=await direct({action:'turn.acquire'});if(acquired.acquired!==true){await syncStore(leaseKey,null,true);if(manualToken&&typeof toast==='function')toast(acquired.completed?'这条消息已有回复，正在同步聊天记录':'当前会话仍有回复尚未结束，请稍候');client.retry();return false;}lease=true;
   renewTimer=setInterval(async()=>{if(renewing||lost)return;renewing=true;try{const response=await direct({action:'turn.renew'});if(response.renewed!==true&&response.acquired!==true)throw new Error('lease lost');}catch(_){lost=true;permitsForLostTurn();}finally{renewing=false;}},60000);
   function permitsForLostTurn(){client.revokeReply(id,aid);try{replyTouch(id,aid);}catch(_){} }
   result=!!(await originalReply.call(this,id,note,token,aid,intent,options));
   assert();if(lost)return false;
   finishingReplies++;try{client.markDirty();const saved=await saveNowAsync();if(!saved)throw new Error('回复尚未保存');const syncConfirmed=await client.flush();await direct({action:'turn.finish',completed:result&&syncConfirmed});lease=false;await syncStore(leaseKey,null,true);}finally{finishingReplies--;}
   return result;
  }catch(error){if(!result&&!lost&&client.context()===ctx&&manualToken&&typeof toast==='function')toast('本轮回复暂未完成，请稍后重试');return result;}
  finally{clearInterval(renewTimer);try{if(lease)try{await direct({action:'turn.finish',completed:false});await syncStore(leaseKey,null,true);}catch(_){} }finally{if(localReplyTurns.get(localKey)===leaseToken)localReplyTurns.delete(localKey);} }
 };
 // Web Locks cover separate live WebViews of this account on the same device.
 // Without that proof, retain the server lease until expiry instead of stealing it.
 if(typeof originalReply==='function')root.aiReply=async function(id,note,token,aid,intent,options){
  const locks=root.navigator?.locks;
  if(!locks?.request)return runDeviceReply.call(this,id,note,token,aid,intent,options,false);
  const name='smallphone-reply:'+client.status().owner+':'+String(aid||actId())+':'+String(id);
  let entered=false;try{return await locks.request(name,{ifAvailable:true},lock=>{entered=true;return lock?runDeviceReply.call(this,id,note,token,aid,intent,options,true):false;});}catch(e){if(!entered&&['SecurityError','NotSupportedError'].includes(e?.name))return runDeviceReply.call(this,id,note,token,aid,intent,options,false);throw e;}
 };

 // PRIVATE_SYNC_CONFLICT_UI_V1: bounded review, explicit field-level choice, no raw keys or credentials.
 let conflictPanel=null,conflictPanelContext=null,conflictOperation=false;
 const conflictFields={hist:'上下文长度',histUnit:'上下文单位',chat:'聊天模型',chatRoutes:'模型路线',chatRouteActive:'当前模型路线',aux:'辅助模型',tts:'语音设置',name:'名字',remark:'备注',persona:'人设',signature:'签名',avatar:'头像',model:'模型选择',maxTokens:'回复长度',memory:'记忆',summaries:'聊天总结',worldbook:'世界书',worldbookCategories:'世界书分类',music:'音乐',cinema:'放映室',calendar:'日历',tasks:'任务',moments:'朋友圈',proactive:'主动消息设置',spy:'授权设置',voice:'声音',chatBg:'聊天背景',homeBg:'主屏幕背景',homeDashboard:'主屏幕组件',wxTheme:'微信外观',accounts:'微信账号',active:'当前微信账号',sound:'提示音',timeAware:'时间感知',timeZone:'时区',manualReply:'手动回复',initiative:'主动消息',replyDelay:'回复间隔',settings:'设置',me:'个人资料',couple:'共同生活',offline:'约会存档',roleplay:'角色扮演',appIcons:'应用图标'};
 function conflictType(node,key){if(node?.kind==='message')return '聊天消息';if(node?.kind==='thread')return '聊天会话';if(node?.kind==='media')return '媒体文件';if(node?.kind==='contact')return '角色资料';if(node?.kind==='contactField'){const role=(S.contacts||[]).find(x=>x.id===node.id),label=conflictFields[node.field]||'资料';return (role?.remark||role?.name||'角色')+' · '+label;}if(node?.kind==='field'){const path=node.path||[],label=conflictFields[path.at(-1)]||'应用内容';return path[0]==='settings'?'设置 · '+label:path[0]==='me'?'个人资料 · '+label:label;}return String(key||'').startsWith('state/contact')?'角色资料':String(key||'').startsWith('state/message')?'聊天消息':'应用内容';}
 function conflictSummary(row){if(!row||row.deleted)return '此项已删除';const node=row.value;if(!node)return '此项目前为空';if(node.kind==='parts')return '较长内容（'+Math.ceil((node.bytes||0)/1024)+' KB），原始内容已安全保留';if(node.kind==='media')return '媒体文件（'+Math.ceil((node.bytes||0)/1024)+' KB）';const path=node.kind==='field'?node.path||[]:[node.field||''];if(path.some(x=>/key|token|secret|password|credential|authorization/i.test(String(x))))return '凭据内容已隐藏';let value=node.kind==='message'?node.value?.content:node.kind==='contact'?node.value?.name||'角色基本资料':node.value;
  const short=v=>{if(v==null)return '未设置';if(typeof v==='boolean')return v?'已开启':'已关闭';if(typeof v==='number')return String(v);if(typeof v==='string'){if(/^(?:data:|idb:|album:|blob:)/i.test(v))return '图片或媒体内容';return v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,150)||'空白内容';}if(Array.isArray(v))return '共 '+v.length+' 项';if(typeof v==='object'){if(v.model||v.base||v.key)return '模型：'+String(v.model||'未设置').slice(0,80)+(v.key?' · 已配置密钥':'');for(const key of ['title','name','text','content'])if(typeof v[key]==='string')return short(v[key]);return '包含 '+Object.keys(v).length+' 项内容';}return '应用内容';};return short(value);
 }
 function closeConflictPanel(){if(conflictPanel)conflictPanel.remove();conflictPanel=null;conflictPanelContext=null;conflictOperation=false;}
 function conflictCurrent(ctx){return !!conflictPanel?.isConnected&&conflictPanelContext===ctx&&client.context()===ctx&&client.status().owner===ctx.owner;}
 function conflictNote(text){const note=conflictPanel?.querySelector('[data-conflict-note]');if(note)note.textContent=text;}
 // PRIVATE_ACCOUNT_DIALOG_THEME_V1: scoped settings dialogs keep a black surface and a white hairline, with
 // a compact header and a fixed circular close target, never .btn's full width.
 function ensureAccountDialogStyle(){if(document.getElementById('privateAccountDialogStyle'))return;const style=document.createElement('style');style.id='privateAccountDialogStyle';style.textContent='.private-account-dialog button{touch-action:manipulation;transition:transform .16s ease,background-color .16s ease,opacity .16s ease}.private-account-dialog button:active:not(:disabled){transform:scale(.97)}.private-account-dialog .private-account-close:active{transform:scale(.9)}.private-account-dialog button:focus-visible{outline:2px solid #8dbdff;outline-offset:3px}.private-account-dialog button:disabled{opacity:.5}.private-account-dialog .hint{color:#a3b7d2;line-height:1.65}.private-account-dialog .field input{background:#17253a;color:#e6efff;border-color:rgba(255,255,255,.22)}.private-account-dialog .field input:focus{border-color:#73abf0;box-shadow:0 0 0 3px rgba(64,139,233,.12)}#modalSheet:has(>.private-account-dialog){background:#111113;color:#f1f1f5;border:1px solid rgba(255,255,255,.22);padding:22px}@media(prefers-reduced-motion:reduce){.private-account-dialog button{transition:none}}';document.head.appendChild(style);}
 function accountDialogClose(closePanel){ensureAccountDialogStyle();const button=document.createElement('button');button.className='private-account-close';button.type='button';button.setAttribute('aria-label','关闭');button.textContent='×';button.style.cssText='flex:0 0 36px;width:36px;height:36px;min-width:36px;padding:0;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(255,255,255,.05);color:#ececf2;display:grid;place-items:center;font:26px/1 system-ui;cursor:pointer';button.addEventListener('click',closePanel);return button;}
 function accountDialogHeader(label,closePanel){const header=document.createElement('header');header.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:16px;flex:none;min-width:0';const title=document.createElement('h2');title.textContent=label;title.style.cssText='flex:1;min-width:0;margin:0;white-space:nowrap;color:#f1f1f5;font:650 20px/1.45 system-ui';const close=accountDialogClose(closePanel);header.append(title,close);return {header,close};}
 function conflictButton(text,kind){const button=document.createElement('button');button.type='button';button.className='btn '+(kind||'g');button.textContent=text;button.style.cssText='width:auto;min-height:44px;padding:11px 15px;border-radius:15px;white-space:normal;line-height:1.4;border:1px solid rgba(255,255,255,.16);background:'+(kind==='p'?'var(--north-account-accent,#307fe5)':'rgba(255,255,255,.05)')+';color:'+(kind==='p'?'#fff':'#d4e5fc')+';box-shadow:none';return button;}
 async function loadConflicts(ctx){
  const panel=conflictPanel,isCurrent=()=>panel===conflictPanel&&conflictCurrent(ctx);
  if(!isCurrent())return;conflictNote('正在读取保留的修改…');const list=conflictPanel.querySelector('[data-conflict-list]');list.replaceChildren();
  try{const rows=await client.conflicts();if(!isCurrent())return;conflictNote(rows.length?'同一项在多台设备改动时，两份都会保留。展开后选择要采用的内容。':'不同修改已处理完成，账号内容将继续自动同步。');
   for(const item of rows){if(!UUID.test(String(item.id)))continue;const card=document.createElement('article');card.style.cssText='border:1px solid rgba(255,255,255,.12);background:#1a1a1e;border-radius:18px;padding:14px;display:grid;gap:12px';card.dataset.conflictId=item.id;
    const open=conflictButton(conflictType(null,item.key)+' · 查看不同修改','g');open.style.textAlign='left';card.appendChild(open);list.appendChild(card);let detail=null;
    open.addEventListener('click',async()=>{if(!isCurrent()||conflictOperation)return;if(detail){detail.hidden=!detail.hidden;detail.style.display=detail.hidden?'none':'grid';open.textContent=detail.hidden?'展开查看不同修改':'收起详情';return;}if(isBusy()){conflictNote('当前回复或保存尚未完成，请稍后查看。');return;}open.disabled=true;
     try{const result=await client.conflict(item.id);if(!isCurrent())return;const candidate=result.conflict,current=result.current;if(!candidate||candidate.resolvedAt){await loadConflicts(ctx);return;}
      const local=item.deviceId===ctx.journal.state()?.deviceId,candidateLabel=local?'本机修改':'另一设备修改';open.textContent=conflictType(candidate.value||current?.value,item.key)+' · 收起详情';
      detail=document.createElement('div');detail.style.cssText='display:grid;gap:12px';const text=document.createElement('div');text.style.cssText='display:grid;gap:12px;font-size:14px;line-height:1.65;overflow-wrap:anywhere';
      for(const [label,row] of [[candidateLabel,candidate],['云端当前内容',current]]){const section=document.createElement('div'),title=document.createElement('b'),summary=document.createElement('p');title.textContent=label;title.style.color='#a8ceff';summary.textContent=conflictSummary(row);summary.style.cssText='margin:4px 0 0;color:#d0d0d6;white-space:pre-wrap';section.append(title,summary);text.appendChild(section);}detail.appendChild(text);
      const actions=document.createElement('div');actions.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px';detail.appendChild(actions);const confirmation=document.createElement('div');confirmation.hidden=true;detail.appendChild(confirmation);
      for(const [choice,label] of [['candidate',local?'保留本机修改':'保留这份修改'],['server','采用云端内容']]){const button=conflictButton(label,choice==='candidate'?'p':'g');actions.appendChild(button);button.addEventListener('click',()=>{if(!isCurrent()||conflictOperation)return;confirmation.replaceChildren();confirmation.hidden=false;confirmation.style.cssText='border-top:1px solid #37373c;padding-top:12px;display:grid;gap:10px';const prompt=document.createElement('p');prompt.textContent='确认'+label+'？仅处理上面这一项，结果将同步到同账号的其他设备。';prompt.style.cssText='margin:0;color:#b4b4bd;line-height:1.6';const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:10px';const cancel=conflictButton('返回','g'),confirm=conflictButton('确认采用','p');buttons.append(cancel,confirm);confirmation.append(prompt,buttons);cancel.addEventListener('click',()=>{confirmation.hidden=true;confirmation.style.display='none';});confirm.addEventListener('click',async()=>{
       if(!isCurrent()||conflictOperation)return;if(isBusy()){conflictNote('请等当前回复或保存完成后再确认。');return;}conflictOperation=true;conflictPanel.querySelectorAll('button:not([data-conflict-close])').forEach(x=>x.disabled=true);conflictNote('正在保存你的选择…');
       try{const result=await client.resolveConflict(item.id,choice,String(current?.revision||'0'));if(!isCurrent())return;await loadConflicts(ctx);if(!result.resolved&&isCurrent())conflictNote('另一设备又修改了这项内容，两份仍然保留。请重新展开核对。');}catch(_){if(isCurrent())conflictNote('此次选择尚未完成，两份修改仍然保留。可以稍后重试。');}finally{if(panel===conflictPanel&&conflictPanelContext===ctx){conflictOperation=false;if(isCurrent())conflictPanel.querySelectorAll('button').forEach(x=>x.disabled=false);}}
      });});}
      card.appendChild(detail);
     }catch(_){if(isCurrent())conflictNote('暂时无法读取详情，原有两份修改仍然保留。请稍后重试。');}finally{if(isCurrent())open.disabled=false;}
    });
   }
  }catch(_){if(isCurrent())conflictNote('暂时无法读取修改列表，本机内容仍然保留。请稍后重试。');}
 }
 root.privatePhoneSyncConflictsOpen=async function(){const ctx=client.context();if(!ctx?.ready){if(typeof toast==='function')toast('账号内容仍在同步，请稍后查看');return;}closeConflictPanel();conflictPanelContext=ctx;conflictPanel=document.createElement('section');conflictPanel.id='privateSyncConflictOverlay';conflictPanel.style.cssText='position:fixed;inset:0;z-index:2147483610;background:rgba(0,0,0,.7);padding:24px 16px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-family:system-ui;color:#f5f5f7';
  const frame=document.createElement('div');frame.className='private-account-dialog';frame.style.cssText='width:min(100%,440px);max-height:78vh;max-height:78dvh;display:flex;flex-direction:column;gap:14px;border:1px solid rgba(255,255,255,.22);border-radius:24px;background:#111113;padding:22px;box-sizing:border-box';const {header,close}=accountDialogHeader('查看不同修改',closeConflictPanel);close.dataset.conflictClose='1';const note=document.createElement('p');note.dataset.conflictNote='1';note.style.cssText='margin:0;color:#999aa4;font-size:13px;line-height:1.65';const list=document.createElement('div');list.dataset.conflictList='1';list.style.cssText='overflow:auto;overscroll-behavior:contain;min-height:0;max-height:55vh;display:grid;gap:12px;padding:1px 2px';frame.append(header,note,list);conflictPanel.appendChild(frame);document.body.appendChild(conflictPanel);await loadConflicts(ctx);
 };
 // PRIVATE_PRIMARY_DEVICE_V1: password confirmation is transient, never an app-state field.
 let devicePanel=null,devicePanelContext=null;
 function closeDevicePanel(){if(devicePanel){for(const field of devicePanel.querySelectorAll('input'))field.value='';devicePanel.remove();}devicePanel=null;devicePanelContext=null;}
 root.privatePhoneSyncDevicesOpen=async function(){
  const ctx=client.context();if(!ctx?.ready){toast('请先完成账号连接');return;}closeDevicePanel();devicePanelContext=ctx;
  const panel=devicePanel=document.createElement('section');panel.id='privateSyncDevicesOverlay';panel.style.cssText='position:fixed;inset:0;z-index:2147483610;background:rgba(0,0,0,.7);padding:24px 16px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-family:system-ui;color:#f5f5f7';
  const frame=document.createElement('div');frame.className='private-account-dialog';frame.style.cssText='width:min(100%,440px);max-height:80vh;overflow:auto;display:grid;gap:14px;border:1px solid rgba(255,255,255,.22);border-radius:24px;background:#111113;padding:22px;box-sizing:border-box';panel.appendChild(frame);
  const {header}=accountDialogHeader('登录设备',closeDevicePanel);
  const note=document.createElement('p');note.style.cssText='margin:0;color:#a5a5b0;font-size:13px;line-height:1.65';note.textContent='正在读取登录设备…';
  const list=document.createElement('div');list.style.cssText='display:grid;gap:10px';const transfer=document.createElement('div');transfer.style.cssText='display:grid;gap:10px';frame.append(header,note,list,transfer);document.body.appendChild(panel);
  const current=()=>devicePanel===panel&&devicePanelContext===ctx&&client.context()===ctx;
  let operating=false;
  async function load(){
   const info=await client.devices();if(!current())return;list.replaceChildren();transfer.replaceChildren();
   const devices=(info.devices||[]).filter(x=>!x.revokedAt);
   note.textContent='此账号有 '+devices.length+' 台登录设备。'+(info.isPrimary?'本机是主设备，可以移除其他设备。':'本机是副设备，可以同步数据；设备管理由主设备负责。');
   for(const item of devices){
    const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border:1px solid rgba(255,255,255,.12);background:#1a1a1e;border-radius:17px';
    const text=document.createElement('div'),name=document.createElement('b'),detail=document.createElement('small');name.textContent=String(item.label||item.platform||'登录设备')+(item.id===info.deviceId?' · 本机':'');detail.textContent=(item.id===info.primaryDeviceId?'主设备':'副设备')+(item.lastSeenAt?' · 最近连接 '+privatePhoneAccountDate(item.lastSeenAt):'');detail.style.cssText='display:block;color:#999aa4;margin-top:5px;line-height:1.5';text.append(name,detail);row.appendChild(text);
    if(info.isPrimary&&item.id!==info.deviceId){const remove=conflictButton('移除','g');row.appendChild(remove);remove.addEventListener('click',async()=>{
     if(!current()||operating)return;if(!await uiConfirm('移除此登录设备？\n\n它联网后会退出小手机账号，停止同步。本账号数据会保留。')||!current())return;
     operating=true;remove.disabled=true;
     try{await client.revokeDevice(item.id);if(current())await load();}catch(_){if(current())note.textContent='移除未确认，请刷新设备列表。只有当前主设备可以移除其他设备。';}finally{operating=false;remove.disabled=false;}
    });}list.appendChild(row);
   }
   if(!info.isPrimary){
    const open=conflictButton('将本机设为主设备','g');open.style.cssText+=';justify-self:end;min-height:36px;padding:7px 11px;font-size:13px;color:#89b9f6;background:transparent;border-color:transparent';transfer.appendChild(open);open.addEventListener('click',()=>{
     if(!current()||operating)return;transfer.replaceChildren();const hint=document.createElement('p');hint.textContent='请再次输入此小手机账号的密码。确认后，本机成为唯一主设备，原主设备降为副设备；账号内容继续同步。';hint.style.cssText='margin:0;color:#aaaab5;font-size:13px;line-height:1.65';
     const password=document.createElement('input');password.type='password';password.autocomplete='current-password';password.maxLength=72;password.placeholder='小手机账号密码';password.setAttribute('aria-label','小手机账号密码');password.style.cssText='padding:14px;border:1px solid #3a3a40;border-radius:15px;background:#1c1c1e;color:#fff;font:inherit;min-width:0';
     const confirm=conflictButton('验证密码并设为主设备','p');transfer.append(hint,password,confirm);password.focus();confirm.addEventListener('click',async()=>{
      if(!current()||operating)return;if(password.value.length<8){note.textContent='请输入至少 8 位的账号密码。';return;}operating=true;confirm.disabled=true;
      try{await client.makePrimary(password.value,info.primaryRevision);password.value='';if(current())await load();}catch(error){if(current())note.textContent=error?.message==='primary_changed'?'主设备刚有变化，请关闭并重新打开设备列表。':error?.message==='password_verification_failed'?'密码没有通过验证，请重新输入。':'主设备切换尚未确认，请稍后刷新。';}finally{password.value='';operating=false;confirm.disabled=false;}
     });
    });
   }
  }
  try{await load();}catch(_){if(current())note.textContent='暂时无法读取设备列表，本机数据保留。请稍后重试。';}
 };
 // Reuse the existing account settings surface; backups remain an optional recovery tool.
 const backupSection=root.privatePhoneAccountSection;
 root.privatePhoneAccountSection=function(){if(!privatePhoneAccountAvailable())return '';const a=_privatePhoneAccount,status=client.status();
  const main='<div class="section" id="set_private_account"><div class="it"><span><b style="color:#bfeaff">私人小手机账号</b><small id="privateSyncAccountStatus" style="display:block;color:#8f9eb3;margin-top:5px;line-height:1.6">'+esc(accountStatusText(status))+'</small></span><span class="v">'+esc(a.loggedIn?a.maskedPhone||'已登录':'尚未登录')+'</span></div><div class="hint">同一个手机号登录后，角色、聊天和设置自动同步；系统权限按设备单独授权。</div><button class="btn g" id="privateSyncConflictCount" style="margin:8px 14px;width:calc(100% - 28px);color:#9bcaff;'+(status.conflicts?'':'display:none;')+'" '+(status.conflicts?'':'hidden')+' onclick="privatePhoneSyncConflictsOpen()">查看 '+status.conflicts+' 项不同修改</button><div class="btns" style="padding:10px 14px 14px;gap:10px">'+(a.loggedIn?'<button class="btn p" onclick="NorthPrivateDeviceSyncClient.syncNow()">立即同步</button><button class="btn g" onclick="privatePhoneSyncDevicesOpen()">登录设备</button><button class="btn g" onclick="privatePhoneAccountSignOut()">退出此设备</button>':'<button class="btn p" onclick="privatePhoneAccountBindOpen()">创建或登录账号</button>')+'</div></div>';
  const extra=typeof backupSection==='function'?backupSection.apply(this,arguments).replace(/id="set_private_account"/g,'id="privateAccountRecovery"'):'';
  return main+(extra?'<details id="privateAccountRecoveryDetails" '+(accountRecoveryExpanded?'open ':'')+'class="section" style="padding:14px"><summary style="cursor:pointer;color:#999">额外备份与恢复</summary><div style="margin-top:14px">'+extra+'</div></details>':'');
 };
 root.privatePhoneAccountLoginFeedback=function(message,busy){
  const note=document.getElementById('privatePhoneLoginNote');
  if(!note){if(message&&typeof toast==='function')toast(message);return true;}
  if(busy&&note.dataset.busy==='1')return false;
  note.dataset.busy=busy?'1':'0';if(message)note.textContent=message;
  for(const button of note.parentElement.querySelectorAll('[data-private-auth-submit]'))button.disabled=!!busy;
  return true;
 };
 root.privatePhoneAccountBindOpen=function(){
  ensureAccountDialogStyle();openModal('<section class="private-account-dialog" data-private-account-login><div class="hint" style="margin-top:16px">使用同一手机号和密码，自动显示此账号的角色、聊天和设置。</div><p id="privatePhoneLoginNote" role="alert" style="margin:12px 0;color:#adc3df;line-height:1.6"></p><div class="field"><input id="privatePhoneNumber" inputmode="tel" autocomplete="tel" maxlength="13" placeholder="中国大陆手机号"></div><div class="field"><input id="privatePhonePassword" type="password" autocomplete="current-password" maxlength="72" placeholder="账号密码（至少 8 位）"></div><button class="btn p" data-private-auth-submit onclick="privatePhoneAccountPasswordLogin()">登录并同步</button><button class="btn g" data-private-auth-submit onclick="privatePhoneAccountPasswordSignup()">创建新账号</button></section>');
  const content=document.querySelector('[data-private-account-login]');if(!content)return;content.prepend(accountDialogHeader('登录小手机账号',()=>closeModal()).header);
  for(const button of content.querySelectorAll('[data-private-auth-submit]')){const primary=button.classList.contains('p');button.style.cssText=conflictButton('',primary?'p':'g').style.cssText+(primary?';width:100%;margin-top:8px':';min-height:34px;font-size:13px;margin-top:10px;border-color:transparent;background:transparent');}
 };

 const automaticBackup=root.privatePhoneCloudAutoBackup;if(typeof automaticBackup==='function')root.privatePhoneCloudAutoBackup=function(){if(!client.backgroundAllowed())return Promise.resolve(false);return automaticBackup.apply(this,arguments);};
 // Hooks execute only in this private entry; the public build keeps its original account/backup flow.
 root.privatePhoneAccountAfterLogin=async()=>{client.accountChanged(String(_privatePhoneAccount.userId||''),true);};
 root.privatePhoneAccountRefresh=async function(showToast){try{await onAccount(await native('account.status'));if(typeof privatePhoneAccountPaint==='function')privatePhoneAccountPaint();if(showToast&&typeof toast==='function')toast(_privatePhoneAccount.loggedIn?'账号已连接，数据自动同步':'请登录小手机账号');client.accountChanged(String(_privatePhoneAccount.userId||''));}catch(e){if(showToast&&typeof toast==='function')toast('账号连接暂时不可用');}};
 const originalSignOut=root.privatePhoneAccountSignOut;
 if(typeof originalSignOut==='function')root.privatePhoneAccountSignOut=async function(){await client.flush().catch(()=>{});const result=await originalSignOut.apply(this,arguments);client.accountChanged();return result;};
  // PRIVATE_BACKUP_DETAILS_EXPANSION_V1: transient UI state stays outside S.
 document.addEventListener('toggle',event=>{if(event.target?.id==='privateAccountRecoveryDetails')accountRecoveryExpanded=event.target.open;},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)client.suspend();else{client.syncNow();scheduleMedia(100);scheduleAccountImages();}});
 root.addEventListener('focus',()=>{if(!document.hidden)client.syncNow();});
 root.addEventListener('online',()=>{if(!document.hidden)client.syncNow();});
 root.addEventListener('pagehide',()=>client.suspend());
 root.addEventListener('pageshow',()=>client.syncNow());
 client.start();
})(typeof window==='undefined'?globalThis:window);
