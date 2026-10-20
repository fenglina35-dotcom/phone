/* SKY_ROLE_SYNC_V1 — private-only role channel; transport metadata never renders. */
(function(root){
 'use strict';
 function resolveBinding(state){
  const accounts=(state.me&&state.me.accounts||[]).filter(a=>[a.name,a.nickname,a.label].includes('虚空间'));
  if(accounts.length!==1)throw new Error('无法唯一确认「虚空间」账号，请先检查账号名称');
  const accountId=accounts[0].id,roles=(state.contacts||[]).filter(c=>c&&!c.deleted&&[c.remark,c.name].includes('先生')&&(accountId==='main'||c._added&&c._added[accountId]));
  if(roles.length!==1)throw new Error('无法唯一确认「虚空间／先生」，未绑定其他角色');
  return {accountId,roleId:roles[0].id};
 }
 function eventMessage(e){
  if(!e||['memory','summary'].includes(e.kind)||!['user','assistant'].includes(e.role)||!e.id||typeof e.text!=='string'||!e.text.trim())return null;
  return {id:'sky:'+e.id,role:e.role,type:'text',content:e.text,time:+e.at||Date.now(),_skySource:'sky',_skySession:e.session||''};
 }
 function mergeEvents(rows,events){const ids=new Set(rows.map(m=>m.id));for(const e of events){const m=eventMessage(e);if(m&&!ids.has(m.id)){rows.push(m);ids.add(m.id);}}rows.sort((a,b)=>(+a.time||0)-(+b.time||0));return rows;}
 const api={resolveBinding,eventMessage,mergeEvents};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
 if(!root||root.__SMALL_PHONE_PRIVATE__!==true)return;
 const SKY_SYNC_URL='https://qvuahlqimcfgeoetosnl.supabase.co';
 let flight=null,timer=null,publishTimer=null,lastError='',foregroundChecked=false;
 function config(){return S.settings&&S.settings.skyRoleSync;}
 function active(c){const cfg=config();return !!(cfg&&cfg.enabled&&cfg.accountId===actId()&&(!c||cfg.roleId===c.id));}
 function identity(){const cfg=config();return {state:S,account:actId(),target:cloudId(),cfg};}
 function valid(owner){return S===owner.state&&actId()===owner.account&&cloudId()===owner.target&&config()===owner.cfg;}
 function text(v){return typeof v==='string'?v:String(v&&v.text||'');}
 async function fingerprint(snapshot,cursor){
  if(!root.crypto||!root.crypto.subtle||typeof TextEncoder==='undefined')return '';
  const material=JSON.stringify(Object.assign({},snapshot,{sourceAt:0,phoneCursor:cursor}));
  return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(material))),n=>n.toString(16).padStart(2,'0')).join('');
 }
 function packet(c){
  const cfg=config(),scope=actId(),meta=scope==='main'?c:friendMeta(c,false)||{},history=lastRounds(msgs(c.id),Math.max(2,Math.min(100,+S.settings.hist||12))).filter(m=>m&&['user','assistant'].includes(m.role)&&m.type!=='sys').map(m=>({id:m._skySource==='sky'?String(m.id).replace(/^sky:/,''):m.id,role:m.role,content:String(msgToText(m)||''),at:+m.time||0,source:m._skySource==='sky'?'sky':'phone'})).filter(m=>m.content);
  return {accountId:cfg.accountId,roleId:c.id,roleName:c.remark||c.name,userName:S.me.name,
   persona:String(c.persona||'')+'\n'+String(scope==='main'?c.relation||'':meta.relation||'')+(typeof altIdentityPrompt==='function'&&scope!=='main'?altIdentityPrompt(c):''),
   facts:memoryList(c,scope).map(v=>({text:text(v)})).concat(scope==='main'&&typeof aiMemoryDocs==='function'?aiMemoryDocs(c).flatMap(d=>(d.chunks||[]).map(v=>({text:text(v)}))):[]).filter(v=>v.text),summaries:summaryList(c,scope).map(v=>({text:text(v),time:v&&v.time||''})),
   contextRounds:Math.max(2,Math.min(100,+S.settings.hist||12)),recall:onlineMemoryRecallLimits(),history,sourceAt:Date.now()};
 }
 async function rpc(action,fields){
  const cfg=config(),owner=identity();if(!cfg||cfg.accountId!==owner.account)throw new Error('当前账号不是已绑定的虚空间');
  const response=await fetch(SKY_SYNC_URL+'/rest/v1/rpc/phone_sky_owner',{method:'POST',headers:companionHeaders(),body:JSON.stringify(Object.assign({p_target:owner.target,p_secret:companionOwnerSecret(),p_account:cfg.accountId,p_role:cfg.roleId,p_action:action},fields||{})),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('光遇同步失败（'+response.status+'），保留本机记录');
  const result=await response.json();if(!valid(owner))throw new Error('账号已变化，未应用同步结果');
  if(!result||result.ok!==true)throw new Error('云端未确认光遇同步');return result;
 }
 async function syncInner(phone){
  const owner=identity(),cfg=config();if(!active())return false;const c=getC(cfg.roleId);if(!c||c.deleted||!addedHere(c))throw new Error('绑定角色已变化');
  // Import before publishing so an old phone snapshot cannot discard game events.
  let result=await rpc(phone?'phone':'sync',{p_after:+cfg.cursor||0}),changed=false;
  while(true){
   if(!valid(owner))throw new Error('账号已变化');
   const events=(result.events||[]).map(x=>x.event),rows=msgs(c.id);
   const before=rows.length;mergeEvents(rows,events);if(rows.length!==before)changed=true;
   for(const e of events)for(const fact of (e.kind==='memory'?[e.text]:[])){
    if(typeof fact==='string'&&fact.trim()&&!memoryList(c).some(v=>text(v)===fact))rememberForChar(c,fact,{rolePerspective:true});
   }
   for(const e of events)if(e.kind==='summary'&&typeof e.text==='string'&&e.text.trim()&&!summaryList(c).some(v=>text(v)===e.text))summaryList(c).push({text:e.text,time:fmtDT(+e.at||Date.now()),accountId:actId(),_skySource:'sky',id:'sky:'+e.id});
   cfg.cursor=+result.cursor||cfg.cursor||0;cfg.scene=result.scene;cfg.sceneVersion=result.sceneVersion;
   if(!await saveNowAsync())throw new Error('本机未保存，暂不继续同步');
   if(!valid(owner))throw new Error('账号已变化');
   if((result.events||[]).length<200)break;
   result=await rpc('sync',{p_after:cfg.cursor});
  }
  const snapshot=packet(c),signature=await fingerprint(snapshot,cfg.cursor);
  if(!valid(owner))throw new Error('账号已变化');
  if(!signature||signature!==cfg.sentSignature){
   result=await rpc('sync',{p_packet:snapshot,p_after:cfg.cursor});
   if(signature)cfg.sentSignature=signature;
  }
  if(!valid(owner))return false;cfg.scene=result.scene;cfg.sceneVersion=result.sceneVersion;cfg.lastSync=Date.now();lastError='';
  if(!await saveNowAsync())throw new Error('同步回执尚未保存');
  if(changed&&!phone&&typeof refreshChatMessages==='function')refreshChatMessages(c.id);
  return true;
 }
 async function sync(phone){
  if(flight)await flight;
  const task=syncInner(phone);flight=task;
  try{return await task;}catch(e){lastError=String(e.message||e);throw e;}finally{if(flight===task)flight=null;}
 }
 async function publishInner(){
  if(!active())return false;const owner=identity(),cfg=config(),c=getC(cfg.roleId);
  if(!c||c.deleted||!addedHere(c))return false;
  const snapshot=packet(c),signature=await fingerprint(snapshot,cfg.cursor);
  if(signature&&signature===cfg.sentSignature)return false;
  if(!valid(owner)||!await saveNowAsync()||!valid(owner))return false;
  await rpc('sync',{p_packet:snapshot,p_after:+cfg.cursor||0});
  if(!valid(owner))return false;if(signature)cfg.sentSignature=signature;
  cfg.lastSync=Date.now();await saveNowAsync();return true;
 }
 async function publish(){if(flight)return false;const task=publishInner();flight=task;try{return await task;}catch(e){lastError=String(e.message||e);throw e;}finally{if(flight===task)flight=null;}}
 async function bind(){
  try{const found=resolveBinding(S);if(found.accountId!==actId())throw new Error('请先切换到「虚空间」账号');
   const previous=config();if(previous&&previous.enabled){
    if(previous.accountId!==found.accountId||previous.roleId!==found.roleId)throw new Error('已有连接归属不同，未覆盖其他角色');
    if(typeof uiConfirm!=='function'||!await uiConfirm('重新生成连接码后，电脑的旧连接码会失效；已有聊天和记忆保留。继续重新连接吗？'))return;
   }
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
   S.settings.skyRoleSync=Object.assign({enabled:true,cursor:0},previous||{},found);const owner=identity();
   try{const result=await rpc('bind',{p_device_token:token,p_packet:packet(getC(found.roleId))});if(!valid(owner))throw new Error('账号已变化');
    config().linkId=result.linkId;config().sceneVersion=result.sceneVersion;if(!await saveNowAsync())throw new Error('连接尚未保存');
    const code=JSON.stringify({url:SKY_SYNC_URL,linkId:result.linkId,token,accountId:found.accountId,roleId:found.roleId});
    openModal('<h3>连接光遇里的先生</h3><div class="hint">将此连接码填入电脑光遇控制台，仅授权当前角色同步。不要分享给其他人。</div><textarea readonly rows="5" style="width:100%">'+esc(code)+'</textarea>');
   }catch(e){if(valid(owner)){if(previous)S.settings.skyRoleSync=previous;else delete S.settings.skyRoleSync;}throw e;}
  }catch(e){toast(e.message||'光遇连接失败');}
 }
 api.sync=sync;api.publish=publish;api.bind=bind;api.active=active;api.status=()=>({enabled:active(),lastSync:config()&&config().lastSync||0,error:lastError});
 api.preparePhone=async function(c){if(active(c))await sync(true);};
 api.historyContent=function(m,content){return m&&m._skySource==='sky'?'（这条历史对话发生在光遇游戏里，已经聊过，不是新的微信消息）'+content:content;};
 root.NorthSkyRoleSync=api;
 const originalSystem=root.buildSystem;if(typeof originalSystem==='function')root.buildSystem=function(c){const base=originalSystem.apply(this,arguments);return base+(active(c)?'\n\n# 光遇交流连续性（内部信息，不显示标签）\n历史中标明光遇来源的对话是在游戏里发生的。你仍是同一个人。North现在正在小手机微信里和你交流，当前交流渠道已切回微信；自然接着聊，不重答旧消息，不能假定North此刻仍在游戏，也不声称游戏软件已退出。':'');};
 const originalSummary=root.wechatSummarySystem;if(typeof originalSummary==='function')root.wechatSummarySystem=function(c){return originalSummary.apply(this,arguments)+(active(c)?'\n其中明确注明光遇来源的内容发生在光遇游戏里，游戏动作不能记成现实见面。重要场景要自然写入记忆正文，不输出系统标签或同步说明。':'');};
 const originalSection=root.privatePhoneAccountSection;if(typeof originalSection==='function')root.privatePhoneAccountSection=function(){return originalSection.apply(this,arguments)+'<div class="section"><div class="it"><span>光遇里的先生<small>同步当前角色人设、记忆与设置范围内的聊天</small></span><button class="btn g" onclick="NorthSkyRoleSync.bind()">连接光遇</button></div></div>';};
 function wake(){if(flight||document.hidden||foregroundChecked||!active())return;foregroundChecked=true;if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=null;sync(false).catch(()=>{foregroundChecked=false;});},1500);}
 function changed(){if(flight||document.hidden||!active()||!config().linkId)return;if(publishTimer)clearTimeout(publishTimer);publishTimer=setTimeout(()=>{publishTimer=null;publish().catch(()=>{});},1500);}
 const originalSave=root.save;if(typeof originalSave==='function')root.save=function(){const result=originalSave.apply(this,arguments);if(result!==false)changed();return result;};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){foregroundChecked=false;return;}wake();});wake();
})(typeof window!=='undefined'?window:null);
