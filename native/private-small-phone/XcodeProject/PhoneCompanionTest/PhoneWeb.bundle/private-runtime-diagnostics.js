/* Private iOS runtime overlay. This file is intentionally not part of the public web build. */
(function(){
  'use strict';
  if(window.__SMALL_PHONE_PRIVATE__!==true)return;

  const OVERLAY_VERSION='249-safe-chat-recovery-v1';
  const lastEventAt=Object.create(null);
  const clock=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
  const cleanFields=input=>{
    const out={},src=input&&typeof input==='object'?input:{};
    Object.keys(src).slice(0,8).forEach(key=>{
      const value=src[key];
      if(typeof value==='boolean'||typeof value==='number')out[String(key).slice(0,40)]=value;
      else if(typeof value==='string')out[String(key).slice(0,40)]=value.slice(0,120);
    });
    return out;
  };
  function emit(event,fields,minGap){
    event=String(event||'runtime.event').slice(0,80);
    const now=Date.now(),gap=Math.max(0,Number(minGap==null?10000:minGap)||0);
    if(gap&&now-(lastEventAt[event]||0)<gap)return false;
    lastEventAt[event]=now;
    const payload={event,at:now,fields:cleanFields(fields)};
    try{
      if(typeof window.__smallPhoneNativeDiag==='function'){
        window.__smallPhoneNativeDiag(event,payload.fields,gap);
        return true;
      }
      const handler=window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.smallPhoneNative;
      if(handler&&typeof handler.postMessage==='function'){
        handler.postMessage({action:'diagnostics.append',payload});
        return true;
      }
    }catch(_){}
    return false;
  }

  window.__SMALL_PHONE_PRIVATE_RUNTIME__=OVERLAY_VERSION;
  window.__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__=true;

  function cancelAutomaticBackupTimer(){
    try{
      if(typeof _privatePhoneCloudTimer!=='undefined'&&_privatePhoneCloudTimer){
        clearTimeout(_privatePhoneCloudTimer);
        _privatePhoneCloudTimer=null;
      }
    }catch(_){}
  }
  cancelAutomaticBackupTimer();

  if(typeof window.privatePhoneCloudSchedule==='function'){
    window.privatePhoneCloudSchedule=function(){
      cancelAutomaticBackupTimer();
      return false;
    };
  }
  if(typeof window.privatePhoneCloudAutoBackup==='function'){
    window.privatePhoneCloudAutoBackup=async function(){
      cancelAutomaticBackupTimer();
      emit('cloud.auto.blocked',{paused:true},60000);
      return false;
    };
  }

  if(typeof window.privatePhoneCloudBackup==='function'){
    const originalBackup=window.privatePhoneCloudBackup;
    window.privatePhoneCloudBackup=function(firstBind,silent){
      if(firstBind===true){
        emit('cloud.first-bind-auto.blocked',{paused:true},60000);
        if(typeof openModal==='function')openModal('<h3>手机号已绑定</h3><div class="hint" style="line-height:1.8">为排查私人 App 的间歇性卡顿和发热，自动全量云备份现已暂停。当前本机数据没有删除；需要备份时请手动点击下面按钮。</div><div class="btns"><button class="btn g" onclick="closeModal()">稍后</button><button class="btn p" onclick="closeModal();privatePhoneCloudBackup(false)">立即手动备份</button></div>');
        return Promise.resolve(false);
      }
      return originalBackup.apply(this,arguments);
    };
  }

  function wrapMeasured(name,options){
    options=options||{};
    const original=window[name];
    if(typeof original!=='function'||original.__smallPhoneMeasured)return false;
    const threshold=Math.max(0,Number(options.threshold)||0),span=options.span===true;
    function measured(){
      const started=clock(),args=arguments;
      const meta=typeof options.meta==='function'?cleanFields(options.meta(args)):{};
      if(span)emit(name+'.begin',meta,0);
      const finish=(status,error)=>{
        const elapsed=Math.max(0,Math.round(clock()-started));
        const fields=Object.assign({},meta,{ms:elapsed,status});
        if(error)fields.error=String(error&&error.name||'Error').slice(0,40);
        if(span)emit(name+'.end',fields,0);
        else if(elapsed>=threshold)emit('slow.'+name,fields,15000);
      };
      let result;
      try{result=original.apply(this,args);}catch(error){finish('throw',error);throw error;}
      if(result&&typeof result.then==='function')return Promise.resolve(result).then(value=>{finish('ok');return value;},error=>{finish('reject',error);throw error;});
      finish('ok');
      return result;
    }
    measured.__smallPhoneMeasured=true;
    measured.__smallPhoneOriginal=original;
    window[name]=measured;
    return true;
  }

  wrapMeasured('render',{threshold:120});
  wrapMeasured('saveNow',{threshold:120});
  wrapMeasured('persistWechatMessagesNow',{threshold:800});
  wrapMeasured('phoneFriendSync',{threshold:800});
  wrapMeasured('companionPollSnapshot',{threshold:800});
  wrapMeasured('privateNativeCoreGet',{threshold:800});
  wrapMeasured('privateNativeCorePut',{threshold:800});
  wrapMeasured('fullBackupState',{span:true});
  wrapMeasured('privatePhoneCloudBackup',{span:true,meta:args=>({firstBind:args[0]===true,silent:args[1]===true})});

  if(typeof window.northNativePerformanceGuard==='function'){
    const originalGuard=window.northNativePerformanceGuard;
    window.northNativePerformanceGuard=function(reason,delay){
      emit('performance.guard',{reason:String(reason||'event-loop').slice(0,80),holdMs:Math.round(Number(delay)||0)},15000);
      return originalGuard.apply(this,arguments);
    };
  }

  async function readDiagnostics(){
    if(!window.SmallPhoneNative||typeof window.SmallPhoneNative.request!=='function')throw new Error('原生诊断桥不可用');
    return window.SmallPhoneNative.request('diagnostics.read');
  }
  window.privatePhoneDiagnosticsOpen=async function(){
    try{
      const result=await readDiagnostics(),text=String(result&&result.text||'暂时没有异常记录');
      openModal('<h3>私人 App 卡顿诊断</h3><div class="hint" style="line-height:1.75">这里只记录耗时、温度状态、WebContent 终止和版本号，不记录聊天、图片、密钥或网址。自动全量云备份当前已暂停；手动备份和恢复仍可使用。</div><textarea id="privateRuntimeDiagnosticsText" readonly style="width:100%;height:220px;margin-top:12px;padding:10px;box-sizing:border-box;border:1px solid #555;border-radius:10px;background:#111;color:#eee;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace"></textarea><div class="btns"><button class="btn g" onclick="privatePhoneDiagnosticsClear()">清空记录</button><button class="btn p" onclick="privatePhoneDiagnosticsCopy()">复制记录</button></div>');
      const box=document.getElementById('privateRuntimeDiagnosticsText');if(box)box.value=text;
    }catch(error){toast(String(error&&error.message||'诊断记录读取失败'));}
  };
  window.privatePhoneDiagnosticsCopy=async function(){
    const box=document.getElementById('privateRuntimeDiagnosticsText');if(!box)return;
    try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(box.value);else{box.focus();box.select();document.execCommand('copy');}toast('诊断记录已复制');}catch(_){box.focus();box.select();toast('已选中诊断记录，请点复制');}
  };
  window.privatePhoneDiagnosticsClear=async function(){
    try{await window.SmallPhoneNative.request('diagnostics.clear');const box=document.getElementById('privateRuntimeDiagnosticsText');if(box)box.value='诊断记录已清空';toast('诊断记录已清空');}catch(_){toast('诊断记录清空失败');}
  };

  if(typeof window.privatePhoneAccountSection==='function'){
    const originalSection=window.privatePhoneAccountSection;
    window.privatePhoneAccountSection=function(){
      return originalSection.apply(this,arguments)+'<div class="section" id="set_private_runtime_diagnostics"><div class="it"><span><b>私人 App 性能保护</b><small style="display:block;color:#8f9eb3;margin-top:4px">自动全量云备份已暂停；手动备份与恢复保留</small></span><span class="v">诊断已启用</span></div><div class="btns" style="padding:8px 14px 12px"><button class="btn g" onclick="privatePhoneDiagnosticsOpen()">查看卡顿诊断</button></div></div>';
    };
  }

  emit('runtime.overlay.ready',{version:OVERLAY_VERSION,autoBackupPaused:true},0);
  try{
    if(typeof _bootImagesPromise!=='undefined'&&_bootImagesPromise&&typeof _bootImagesPromise.then==='function'){
      const started=clock();emit('boot.images.wait.begin',{},0);
      _bootImagesPromise.then(()=>emit('boot.images.wait.end',{ms:Math.max(0,Math.round(clock()-started)),status:'ok'},0),error=>emit('boot.images.wait.end',{ms:Math.max(0,Math.round(clock()-started)),status:'reject',error:String(error&&error.name||'Error').slice(0,40)},0));
    }
  }catch(_){}
})();
