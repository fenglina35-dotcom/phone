/* Private account backup: bounded bridge messages, daily foreground scheduling. */
(function(root){
 'use strict';
 if(root.__SMALL_PHONE_PRIVATE__!==true)return;
 const CHUNK=192*1024,RETRY=30*60*1000;
 let busy=false,retryAt=0,phase='idle';
 function day(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
 function key(){return 'north-private-daily-backup:'+String(_privatePhoneAccount.userId||'');}
 function read(){try{return JSON.parse(localStorage.getItem(key())||'{}');}catch(_){return {};}}
 function write(v){localStorage.setItem(key(),JSON.stringify(v));}
 function trace(stage,fields){phase=stage;try{if(root.NorthBrowserDiagnostics)NorthBrowserDiagnostics.mark('private-backup-'+stage);if(root.__smallPhoneNativeDiag)root.__smallPhoneNativeDiag('backup.'+stage,fields||{},0);}catch(_){} }
 function note(text,silent){if(!silent)toast(text);}
 async function call(action,payload){const r=await privatePhoneAccountCall(action,payload);if(!r||r.ok!==true)throw new Error(r&&r.message||r&&r.error||'私人备份步骤未完成');return r;}
 async function transfer(blob,meta,onProgress){
  let token='';try{const begun=await call('account.backup.file.begin',{bytes:blob.size,capturedAt:meta.capturedAt,sourceBuild:meta.sourceBuild});token=begun.token;
   for(let offset=0;offset<blob.size;offset+=CHUNK){const bytes=new Uint8Array(await blob.slice(offset,offset+CHUNK).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));await call('account.backup.file.chunk',{token,offset,base64:btoa(binary)});if(onProgress)onProgress(Math.min(offset+bytes.length,blob.size),blob.size);}
   trace('upload');const result=await call('account.backup.file.commit',{token});token='';return result;
  }finally{if(token)try{await privatePhoneAccountCall('account.backup.file.abort',{token});}catch(_){} }
 }
 async function backup(firstBind,silent){
  if(!privatePhoneAccountAvailable())return false;
  if(busy||_privatePhoneCloudBusy){note('私人备份仍在进行，请保持 App 在前台，勿重复点击',silent);return false;}
  busy=true;_privatePhoneCloudBusy=true;let uploaded=false;
  try{
   if(!_privatePhoneAccount.loaded)await privatePhoneAccountRefresh(false);
   if(!_privatePhoneAccount.loggedIn)throw new Error('请先登录私人手机号账号');
   const owner=_privatePhoneAccount.userId,local=read();
   if(silent||firstBind){const info=await call('account.backup.info');const cloudAt=Date.parse(info.backup&&info.backup.captured_at||'')||0;if(info.found&&(!local.allowed||cloudAt>(local.capturedAt||0)+1)){trace('await-owner-confirmation');return false;}}
   if(_bootImagesPromise)await _bootImagesPromise;
   if(!recoveryStateMeaningful(recoveryStateStats(S)))throw new Error('本机存档尚未完整恢复，未上传空备份');
   trace('save');note('正在保存本机并生成私人云备份，请保持 App 在前台',silent);
   if(!await saveNowAsync())throw new Error('本机数据尚未保存完成');
   const capturedAt=Date.now();trace('prepare');let progressAt=0;
   const blob=await fullBackupFileBlob(text=>{if(Date.now()-progressAt>2000){progressAt=Date.now();note(text,silent);}});
   if(owner!==_privatePhoneAccount.userId||!_privatePhoneAccount.loggedIn)throw new Error('账号已变化，未上传');
   trace('transfer');const result=await transfer(blob,{capturedAt,sourceBuild:String(root.__SMALL_PHONE_PRIVATE_BUILD__||APP_VER)},(done,total)=>{if(done===total){note('备份文件已交给原生端，正在上传云端，请保持 App 在前台',silent);}else if(Date.now()-progressAt>2000){progressAt=Date.now();note('正在交给原生备份 '+Math.floor(done/total*100)+'%，完成后上传云端',silent);}});
   if(!result.saved)throw new Error('云端已有更新的备份，本次没有覆盖');
   uploaded=true;if(owner!==_privatePhoneAccount.userId||!_privatePhoneAccount.loggedIn)throw new Error('原账号已备份，当前账号已变化，未更新当前账号标记');write({allowed:true,lastDay:day(),lastSuccess:Date.now(),capturedAt});_privatePhoneCloudDirtyAt=0;trace('success');
   // Existing optional web mirror remains a separate operation and cannot turn a successful account upload into failure.
   if(!silent&&cloudUrl()&&cloudKey())try{note('手机号云备份已成功，正在更新网页镜像',false);await privatePrimaryMirrorUpload(await fullBackupState());}catch(e){note('手机号云备份已成功；网页镜像未更新：'+String(e&&e.message||e),false);return true;}
   note('手机号云备份已更新；今日自动备份已完成',silent);return true;
  }catch(e){retryAt=Date.now()+RETRY;trace(uploaded?'local-receipt-failed':'failed');try{if(root.NorthBrowserDiagnostics)NorthBrowserDiagnostics.error('private-backup',e);}catch(_){}note((uploaded?'云端已保存，但本机成功标记写入失败：':'私人云备份未确认成功：')+String(e&&e.message||e),silent);return uploaded;}
  finally{busy=false;_privatePhoneCloudBusy=false;_privatePhoneAccount.loaded=false;try{await privatePhoneAccountRefresh(false);}catch(_){} }
 }
 async function tick(){
  if(busy||document.hidden||Date.now()<retryAt||Date.now()-_privatePhoneLastInteractionAt<90000||northNativeMaintenancePaused())return false;
  if(typeof replyGenerationStore==='function'&&Object.keys(replyGenerationStore()).length)return false;
  if(!_privatePhoneAccount.loaded)await privatePhoneAccountRefresh(false);
  if(!_privatePhoneAccount.loggedIn||read().lastDay===day())return false;
  // A cloud copy owned by another installation must first be reconciled by the user.
  retryAt=Date.now()+RETRY;return backup(false,true);
 }
 root.privatePhoneCloudBackup=backup;
 root.privatePhoneCloudAutoBackup=tick;
 root.privatePhoneCloudSchedule=function(delay){if(_privatePhoneCloudTimer)return;_privatePhoneCloudTimer=setTimeout(()=>{_privatePhoneCloudTimer=null;tick().catch(()=>{});},Math.max(30000,+delay||60000));};
 root.NorthPrivateCloudBackup={transfer,tick,status:()=>({busy,phase,lastSuccess:read().lastSuccess||0,confirmedSource:!!read().allowed})};
 const section=root.privatePhoneAccountSection;
 if(typeof section==='function')root.privatePhoneAccountSection=function(){const status=read(),label=phase==='await-owner-confirmation'?'云端已有备份或有其他设备更新，请先手动确认本机来源':phase==='failed'?'本次未确认成功，稍后空闲时再尝试':busy?'正在备份，请保持 App 在前台':status.lastDay===day()?'今日已成功备份':'每天首次空闲时尝试一次；成功后当天不再重复';return section.apply(this,arguments).replace('自动全量云备份已暂停；手动备份与恢复保留','每日自动备份已启用；手动备份与恢复保留')+'<div class="section"><div class="it"><span>每日云备份<small style="display:block;margin-top:5px">'+label+'</small></span></div><div class="hint">需要登录、完成存档读取并保持前台空闲。App 关闭时不保证定时执行；失败保留旧云备份。独立网页镜像仍通过手动备份或云同步更新。</div></div>';};
 setInterval(()=>{tick().catch(()=>{});},60000);
})(window);
