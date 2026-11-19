/* Private account backup: bounded bridge messages, daily foreground scheduling. */
(function(root){
 'use strict';
 if(root.__SMALL_PHONE_PRIVATE__!==true)return;
 const CHUNK=192*1024,RETRY=30*60*1000;
 let busy=false,retryAt=0,phase='idle',detail='',autoWait='';
 function day(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
 function key(){return 'north-private-daily-backup:'+String(_privatePhoneAccount.userId||'');}
 function read(){try{return JSON.parse(localStorage.getItem(key())||'{}');}catch(_){return {};}}
 function write(v){localStorage.setItem(key(),JSON.stringify(v));}
 function repaint(){try{if(typeof privatePhoneAccountPaint==='function')privatePhoneAccountPaint();}catch(_){} }
 function trace(stage,fields){phase=stage;repaint();try{if(root.NorthBrowserDiagnostics)NorthBrowserDiagnostics.mark('private-backup-'+stage);if(root.__smallPhoneNativeDiag)root.__smallPhoneNativeDiag('backup.'+stage,fields||{},0);}catch(_){} }
 function note(text,silent){detail=String(text||'');repaint();if(!silent)toast(detail,5000);}
 async function call(action,payload,timeoutMs){const r=await privatePhoneAccountCall(action,payload,timeoutMs);if(!r||r.ok!==true)throw new Error(r&&r.message||r&&r.error||'私人备份步骤未完成');return r;}
 // PRIVATE_BACKUP_PRIMARY_AUTHORITY_V1: trust only a fully loaded, verified current primary.
 function primaryBackupReady(owner){const client=root.NorthPrivateDeviceSyncClient;return root.__SMALL_PHONE_ACCOUNT_SYNC__===true&&root.__northBootReady===true&&S._deviceSyncOwner===owner&&client&&typeof client.status==='function'&&client.status().owner===owner&&typeof client.automaticStateAllowed==='function'&&client.automaticStateAllowed();}
 function waiting(reason){if(autoWait!==reason){autoWait=reason;repaint();}return false;}
 function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
 async function transfer(blob,meta,onProgress,onUploadProgress){
  let token='';try{if(meta.validate)meta.validate();const begun=await call('account.backup.file.begin',{bytes:blob.size,capturedAt:meta.capturedAt,sourceBuild:meta.sourceBuild});token=begun.token;
   for(let offset=0;offset<blob.size;offset+=CHUNK){if(meta.validate)meta.validate();const bytes=new Uint8Array(await blob.slice(offset,offset+CHUNK).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));await call('account.backup.file.chunk',{token,offset,base64:btoa(binary)});if(onProgress)onProgress(Math.min(offset+bytes.length,blob.size),blob.size);}
   trace('upload',{bytes:blob.size});let settled=false,result=null,failure=null;
   // A large archive is uploaded as multiple 4 MiB objects in sequence.  The
   // native bridge owns the network timeouts for each object; this outer wait
   // must cover the complete multi-object upload rather than one request.
   if(meta.validate)meta.validate();
   const committing=call('account.backup.file.commit',{token},1920000).then(value=>{result=value;settled=true;},error=>{failure=error;settled=true;});
   while(!settled){await Promise.race([committing,wait(900)]);if(settled)break;try{const p=await privatePhoneAccountCall('account.backup.file.progress',{token},10000);if(p&&p.ok===true&&onUploadProgress)onUploadProgress(+p.sentBytes||0,+p.expectedBytes||0);}catch(_){}}
   await committing;if(failure)throw failure;token='';return result;
  }finally{if(token)try{await privatePhoneAccountCall('account.backup.file.abort',{token});}catch(_){} }
 }
 async function backup(firstBind,silent){
  if(!privatePhoneAccountAvailable())return false;
  if(busy||_privatePhoneCloudBusy){note('私人备份仍在进行，请保持 App 在前台，勿重复点击',silent);return false;}
  busy=true;_privatePhoneCloudBusy=true;detail='正在准备私人云备份';repaint();let uploaded=false;
  try{
   if(!_privatePhoneAccount.loaded)await privatePhoneAccountRefresh(false);
   if(!_privatePhoneAccount.loggedIn)throw new Error('请先登录私人手机号账号');
   const owner=_privatePhoneAccount.userId,local=read();
   if(silent||firstBind){const info=await call('account.backup.info');const cloudAt=Date.parse(info.backup&&info.backup.captured_at||'')||0;if(info.found&&(!local.allowed||cloudAt>(local.capturedAt||0)+1)&&!(silent&&!firstBind&&primaryBackupReady(owner))){trace('await-owner-confirmation');return false;}}
   const verifySource=()=>{if(owner!==_privatePhoneAccount.userId||!_privatePhoneAccount.loggedIn)throw new Error('账号已变化，未上传');if(root.__SMALL_PHONE_ACCOUNT_SYNC__===true&&!primaryBackupReady(owner))throw new Error('请在已核验的主设备执行账号云备份；副设备可导出本地文件');if(silent&&root.__SMALL_PHONE_ACCOUNT_SYNC__===true&&!root.NorthPrivateDeviceSyncClient.backgroundAllowed())throw new Error('当前设备不执行后台账号备份');};
   verifySource();
   if(_bootImagesPromise)await _bootImagesPromise;
   if(!recoveryStateMeaningful(recoveryStateStats(S)))throw new Error('本机存档尚未完整恢复，未上传空备份');
   trace('save');note('正在保存本机并生成私人云备份，请保持 App 在前台',silent);
   if(!await saveNowAsync())throw new Error('本机数据尚未保存完成');
   const capturedAt=Date.now();trace('prepare');let progressAt=0;
   const blob=await fullBackupFileBlob(text=>{if(Date.now()-progressAt>2000){progressAt=Date.now();note(text,silent);}});
   if(owner!==_privatePhoneAccount.userId||!_privatePhoneAccount.loggedIn)throw new Error('账号已变化，未上传');
   trace('transfer');let lastUploadPercent=-1;const result=await transfer(blob,{capturedAt,validate:verifySource,sourceBuild:String(root.__SMALL_PHONE_PRIVATE_BUILD__||APP_VER)},(done,total)=>{if(done===total){note('备份文件已交给原生端，正在连接云端，请保持 App 在前台',silent);}else if(Date.now()-progressAt>2000){progressAt=Date.now();note('正在交给原生备份 '+Math.floor(done/total*100)+'%，完成后上传云端',silent);}},(sent,total)=>{if(total<=0)return;const percent=Math.max(0,Math.min(100,Math.floor(sent/total*100)));if(percent===lastUploadPercent)return;lastUploadPercent=percent;note(percent>=100?'云端已接收 100%，正在确认保存，请保持 App 在前台':'正在上传私人云备份 '+percent+'%，请保持 App 在前台',silent);});
   if(!result.saved)throw new Error('云端已有更新的备份，本次没有覆盖');
   uploaded=true;if(owner!==_privatePhoneAccount.userId||!_privatePhoneAccount.loggedIn)throw new Error('原账号已备份，当前账号已变化，未更新当前账号标记');write({allowed:true,lastDay:day(),lastSuccess:Date.now(),capturedAt});_privatePhoneCloudDirtyAt=0;trace('success');
   // 手机号私人备份和网页镜像是两个入口。这里确认一份账号备份后立即结束，避免再次生成并上传整份大存档。
   note('手机号云备份已更新；今日自动备份已完成',silent);return true;
  }catch(e){retryAt=Date.now()+RETRY;trace(uploaded?'local-receipt-failed':'failed');try{if(root.NorthBrowserDiagnostics)NorthBrowserDiagnostics.error('private-backup',e);}catch(_){}note((uploaded?'云端已保存，但本机成功标记写入失败：':'私人云备份未确认成功：')+String(e&&e.message||e),silent);return uploaded;}
  finally{busy=false;_privatePhoneCloudBusy=false;_privatePhoneAccount.loaded=false;repaint();try{await privatePhoneAccountRefresh(false);}catch(_){} }
 }
 async function tick(){
  if(root.__SMALL_PHONE_ACCOUNT_SYNC__===true&&(!root.NorthPrivateDeviceSyncClient||!root.NorthPrivateDeviceSyncClient.backgroundAllowed()))return waiting('等待确认本机为当前主设备');
  if(busy)return false;
  if(document.hidden)return waiting('等待 App 回到前台');
  if(Date.now()<retryAt)return waiting('上次未成功，等待稍后重试；原云备份保留');
  if(Date.now()-_privatePhoneLastInteractionAt<90000)return waiting('等待前台空闲 90 秒后自动备份');
  if(northNativeMaintenancePaused())return waiting('等待本机存档读取和性能保护结束');
  if(typeof replyGenerationStore==='function'&&Object.keys(replyGenerationStore()).length)return waiting('等待当前聊天回复完成');
  autoWait='';
  if(!_privatePhoneAccount.loaded)await privatePhoneAccountRefresh(false);
  if(!_privatePhoneAccount.loggedIn||read().lastDay===day())return false;
  // A cloud copy owned by another installation must first be reconciled by the user.
  retryAt=Date.now()+RETRY;return backup(false,true);
 }
 root.privatePhoneCloudBackup=backup;
 root.privatePhoneCloudAutoBackup=tick;
 root.privatePhoneCloudSchedule=function(delay){if(_privatePhoneCloudTimer)return;_privatePhoneCloudTimer=setTimeout(()=>{_privatePhoneCloudTimer=null;tick().catch(()=>{});},Math.max(30000,+delay||60000));};
 root.NorthPrivateCloudBackup={transfer,tick,status:()=>({busy,phase,detail,lastSuccess:read().lastSuccess||0,confirmedSource:!!read().allowed,autoWait})};
 // PRIVATE_READONLY_SNAPSHOT_UI_V1: manual, foreground-only and isolated from cloud backup.
 let snapshot={owner:'',token:'',phase:'idle',detail:'',done:0,total:0},snapshotTimer=null;
 function snapshotAvailable(){return root.__SMALL_PHONE_NATIVE_ACCOUNT__?.platform==='iOS'&&root.SmallPhoneNative&&_privatePhoneAccount.loggedIn;}
 function snapshotSection(){
  if(!snapshotAvailable())return '';
  const current=snapshot.owner===_privatePhoneAccount.userId?snapshot:{phase:'idle',detail:''};
  const running=['copying','packaging','removing'].includes(current.phase),ready=current.phase==='ready';
  return '<div class="section" id="private_readonly_snapshot"><div class="it"><span>独立原库备份<small style="display:block;margin-top:5px;color:#aaa;font-size:12px;line-height:1.65">'+esc((current.detail||'保留当前存档、数据库和本机媒体原件')+(running&&current.total?'（'+current.done+'/'+current.total+' 项）':'')+(ready&&current.capturedAt?'；固定副本时间：'+privatePhoneAccountDate(current.capturedAt):''))+'</small></span></div><div style="padding:0 14px 12px;display:flex;gap:10px;flex-wrap:wrap">'+(running?'<button class="minibtn" onclick="NorthPrivateReadOnlyBackup.cancel()">停止生成</button>':ready?'<button class="minibtn" onclick="NorthPrivateReadOnlyBackup.save()">保存备份文件</button>':'<button class="minibtn" onclick="NorthPrivateReadOnlyBackup.begin()">生成或查看独立备份</button>')+(current.token&&['ready','failed'].includes(current.phase)?'<button class="minibtn" onclick="NorthPrivateReadOnlyBackup.remove()">移除本机副本</button>':'')+'</div><div class="hint" style="padding:0 14px 14px;line-height:1.65">生成期间请保持前台并暂停聊天。文件生成后还需要保存到手机外；这是原库保全包，不能直接当普通 JSON 导入。历史已缺失的图片不会凭空恢复。</div></div>';
 }
 function snapshotPaint(){const node=document.getElementById('private_readonly_snapshot');if(node)node.outerHTML=snapshotSection();}
 async function snapshotCall(action,extra){
  if(snapshot.owner!==_privatePhoneAccount.userId||!snapshotAvailable())throw new Error('账号已变化，未继续备份操作');
  const result=await root.SmallPhoneNative.request('storage.snapshot.'+action,Object.assign({owner:snapshot.owner,token:snapshot.token},extra||{}));
  if(snapshot.owner!==_privatePhoneAccount.userId)throw new Error('账号已变化，未显示其他账号备份');
  return result;
 }
 function snapshotPoll(){clearTimeout(snapshotTimer);snapshotTimer=setTimeout(async()=>{
  try{const result=await snapshotCall('status');snapshot=Object.assign({},snapshot,result);snapshotPaint();if(['copying','packaging','removing'].includes(snapshot.phase))snapshotPoll();}
  catch(error){snapshot.phase='failed';snapshot.detail=String(error.message||error);snapshotPaint();}
 },1500);}
 root.NorthPrivateReadOnlyBackup={
  async begin(){
   if(!snapshotAvailable())return;
   if(!await uiConfirm('生成当前账号的独立备份？\n\n请暂停聊天并保持前台。它只复制存档和媒体，不恢复或覆盖数据。生成后请另存到手机外。',{yes:'继续',no:'取消'}))return;
   snapshot={owner:_privatePhoneAccount.userId,token:'',phase:'copying',detail:'正在确认当前存档已保存'};snapshotPaint();
   try{if(!root.__northBootReady||!await saveNowAsync())throw new Error('本机存档尚未确认保存，未开始备份');const result=await snapshotCall('begin');snapshot=Object.assign({},snapshot,result);snapshotPaint();if(['copying','packaging','removing'].includes(snapshot.phase))snapshotPoll();}
   catch(error){snapshot.phase='failed';snapshot.detail=String(error.message||error);snapshotPaint();}
  },
  async cancel(){try{await snapshotCall('cancel');snapshot.detail='正在停止，原件会保留';snapshotPaint();}catch(error){snapshot.detail=String(error.message||error);snapshotPaint();}},
  async remove(){if(!await uiConfirm('确认移除这次生成的本机备份副本？\n\n请先确认已另存并核验。只移除生成的副本，不删除聊天、角色、图片原件或云备份。之后可重新生成。',{yes:'移除副本',no:'保留'}))return;try{await snapshotCall('remove',{confirmed:true});snapshot.phase='removing';snapshot.detail='正在移除本机副本';snapshotPaint();snapshotPoll();}catch(error){snapshot.detail=String(error.message||error);snapshotPaint();}},
  async save(){try{const result=await snapshotCall('save');snapshot.detail=result.completed?'系统保存操作已完成，请核对保存位置':result.cancelled?'已取消保存，生成的备份仍保留':'保存尚未确认，生成的备份仍保留';snapshotPaint();}catch(error){snapshot.detail=String(error.message||error);snapshotPaint();}}
 };
 const section=root.privatePhoneAccountSection;
 if(typeof section==='function')root.privatePhoneAccountSection=function(){const status=read(),label=phase==='await-owner-confirmation'?'云端已有备份或有其他设备更新，请先手动确认本机来源':phase==='failed'?(detail||'本次未确认成功，稍后空闲时再尝试'):busy?(detail||'正在备份，请保持 App 在前台'):autoWait?autoWait:status.lastDay===day()?'今日已成功备份':'每天首次空闲时尝试一次；成功后当天不再重复';return section.apply(this,arguments).replace('自动全量云备份已暂停；手动备份与恢复保留','每日自动备份已启用；手动备份与恢复保留')+'<div class="section"><div class="it"><span>每日云备份<small style="display:block;margin-top:5px">'+esc(label)+'</small></span></div><div class="hint">需要登录、完成存档读取并保持前台空闲。App 关闭时不保证定时执行；失败保留旧云备份。手机号备份完成后立即结束；网页镜像请另点“云同步”。</div></div>'+snapshotSection();};
 setInterval(()=>{tick().catch(()=>{});},60000);
})(window);
