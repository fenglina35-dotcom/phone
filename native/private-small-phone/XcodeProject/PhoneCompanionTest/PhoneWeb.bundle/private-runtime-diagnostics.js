/* Private iOS runtime overlay. This file is intentionally not part of the public web build. */
(function(){
  'use strict';
  if(window.__SMALL_PHONE_PRIVATE__!==true)return;

  const OVERLAY_VERSION='258-post-render-protection-v1';
  const lastEventAt=Object.create(null);
  const clock=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
  const COMPOSITION_CLASS='north-private-composition-b';
  let compositionMode='A',compositionEpoch=0,compositionSequence=0,lastThermalState='unknown';
  let lastNativeCompositionMode='',lastNativeCompositionAt=0;
  let renderTraceSequence=0,renderRouteEpoch=0,lastRenderPage='',lastRenderTraceID='';
  let pendingRenderTrace=null,pendingRenderRAF1=0,pendingRenderRAF2=0,renderVisibilityEpoch=0;
  let lastMeasuredSyncOp='',lastMeasuredSyncMs=0,lastMeasuredSyncAt=0;
  const cleanFields=input=>{
    const out={},src=input&&typeof input==='object'?input:{};
    Object.keys(src).slice(0,8).forEach(key=>{
      const value=src[key];
      if(typeof value==='boolean'||typeof value==='number')out[String(key).slice(0,40)]=value;
      else if(typeof value==='string')out[String(key).slice(0,40)]=value.slice(0,120);
    });
    return out;
  };
  function emit(event,fields,minGap,throttleKey){
    event=String(event||'runtime.event').slice(0,80);
    const bucket=event+'|'+String(throttleKey||'').slice(0,120);
    const now=Date.now(),gap=Math.max(0,Number(minGap==null?10000:minGap)||0);
    if(gap&&now-(lastEventAt[bucket]||0)<gap)return false;
    lastEventAt[bucket]=now;
    const payload={event,at:now,fields:cleanFields(fields)};
    try{
      if(typeof window.__smallPhoneNativeDiag==='function'){
        const nativeThrottleKey=String(throttleKey||'').slice(0,120);
        /* This overlay already applies the keyed gap above. Passing a zero gap
           for keyed events also works with an older native bootstrap that
           accepts only three arguments and would otherwise throttle solely by
           event name, hiding a different reason inside the same 15 seconds. */
        window.__smallPhoneNativeDiag(event,payload.fields,nativeThrottleKey?0:gap,nativeThrottleKey);
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

  function currentPageName(){
    try{
      const page=typeof window.cur==='function'?window.cur():null;
      return String(page&&page.p||'unknown').slice(0,40);
    }catch(_){return'unknown';}
  }
  function guardActive(){return document.documentElement.classList.contains('north-native-performance-guard');}
  function startupQuiet(){return document.documentElement.classList.contains('north-native-startup-quiet');}
  function recentSyncFields(){
    const age=lastMeasuredSyncAt?Math.max(0,Date.now()-lastMeasuredSyncAt):0;
    return age&&age<=30000?{lastOp:lastMeasuredSyncOp,lastOpMs:lastMeasuredSyncMs,lastOpAgeMs:age}:{lastOp:'',lastOpMs:0,lastOpAgeMs:0};
  }
  function watchdogEpoch(){const row=window.__SMALL_PHONE_WATCHDOG_STATE__;return Math.max(0,Number(row&&row.epoch)||0);}
  function renderTraceState(){const row=window.__SMALL_PHONE_RENDER_TRACE__;return row&&typeof row==='object'?row:{};}
  function boundedNumber(value,max){
    const number=Number(value);
    return Number.isFinite(number)?Math.max(0,Math.min(max==null?3600000:max,Math.round(number))):0;
  }
  function safeRuntimeToken(value,fallback){
    const text=String(value||'');
    return /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(text)?text:String(fallback||'unknown');
  }
  function safeSettingsCategory(page,value){
    if(page!=='settings')return'';
    const text=String(value||'home');
    return ['home','network','vision','voice','behavior','appearance','media','data'].includes(text)?text:'unknown';
  }
  function performanceReasonFamily(value){
    const text=String(value||'event-loop').slice(0,80);
    if(/^event-loop(?::|$)/.test(text))return'event-loop';
    const render=/^render-([A-Za-z][A-Za-z0-9_-]{0,39})(?::|$)/.exec(text);
    if(render)return'render-'+render[1];
    const thermal=/^thermal-(nominal|fair|serious|critical)(?::|$)/.exec(text);
    if(thermal)return'thermal-'+thermal[1];
    if(/^memory-warning(?::|$)/.test(text))return'memory-warning';
    if(/^continued(?::|$)/.test(text))return'continued';
    const family=text.replace(/:[0-9]+$/,'').replace(/[^A-Za-z0-9._-]/g,'-').slice(0,60);
    return family||'other';
  }
  function publishRenderTraceState(trace,totalMs){
    const state={
      trace:boundedNumber(trace&&typeof trace==='object'?trace.trace:trace,1000000000),
      page:safeRuntimeToken(trace&&trace.page||trace,'unknown'),
      routeEpoch:boundedNumber(renderRouteEpoch,1000000000),
      abEpoch:boundedNumber(compositionEpoch,1000000000),
      abMode:compositionMode==='B'?'B':'A',
      totalMs:boundedNumber(totalMs),
      at:Date.now()
    };
    window.__SMALL_PHONE_RENDER_TRACE__=state;
    return state;
  }
  function updateRenderRoute(page){
    if(page!==lastRenderPage){lastRenderPage=page;renderRouteEpoch+=1;}
  }
  function cancelPendingRenderPaint(){
    if(pendingRenderRAF1&&typeof cancelAnimationFrame==='function')try{cancelAnimationFrame(pendingRenderRAF1);}catch(_){}
    if(pendingRenderRAF2&&typeof cancelAnimationFrame==='function')try{cancelAnimationFrame(pendingRenderRAF2);}catch(_){}
    pendingRenderRAF1=0;pendingRenderRAF2=0;pendingRenderTrace=null;
  }
  function renderTraceStillCurrent(trace){
    if(!trace||pendingRenderTrace!==trace||trace.visibilityEpoch!==renderVisibilityEpoch||document.hidden)return false;
    if((trace.abEpoch!==compositionEpoch||trace.abMode!==compositionMode)&&!trace.autoProtection)return false;
    const page=currentPageName();
    return page==='unknown'||page===trace.page;
  }
  function renderChatCount(trace,app){
    if(!['chat','pfchat','pfgroup','group'].includes(trace.page)||!app||typeof app.getElementsByClassName!=='function')return-1;
    return boundedNumber(app.getElementsByClassName('msg').length,1000000);
  }
  function renderDOMCounts(app){
    if(!app||typeof app.getElementsByTagName!=='function')return{domCount:0,imgCount:0,canvasCount:0,videoCount:0};
    return{
      domCount:boundedNumber(app.getElementsByTagName('*').length,1000000),
      imgCount:boundedNumber(app.getElementsByTagName('img').length,1000000),
      canvasCount:boundedNumber(app.getElementsByTagName('canvas').length,1000000),
      videoCount:boundedNumber(app.getElementsByTagName('video').length,1000000)
    };
  }
  function emitRenderSync(trace,trigger){
    if(trace.syncEmitted)return;
    trace.syncEmitted=true;
    const app=document.getElementById('app');
    emit('render.context',{
      trace:trace.trace,page:trace.page,settingsCategory:trace.settingsCategory,
      chatCount:renderChatCount(trace,app),abMode:trace.abMode,
      routeEpoch:trace.routeEpoch,abEpoch:trace.abEpoch,trigger
    },0);
    emit('render.sync',{
      trace:trace.trace,page:trace.page,htmlMs:trace.htmlMs,
      innerHTMLMs:trace.innerHTMLMs,settingsMs:trace.settingsMs,
      imageSyncMs:trace.imageSyncMs,tailMs:trace.tailMs,totalMs:trace.totalMs
    },0);
  }
  function finishRenderPaint(trace,raf1At){
    pendingRenderRAF2=0;
    if(!renderTraceStillCurrent(trace)){if(pendingRenderTrace===trace)pendingRenderTrace=null;return;}
    const raf2At=clock(),raf1Ms=boundedNumber(raf1At-trace.endedAt),raf2Ms=boundedNumber(raf2At-raf1At);
    const paintSlow=raf1Ms>=250||raf2Ms>=250;
    if(compositionMode==='A'&&raf2Ms>=1200)activateSlowFrameProtection(trace,raf1Ms,raf2Ms,'render-raf2-slow');
    if(trace.syncSlow||paintSlow){
      emitRenderSync(trace,paintSlow&&!trace.syncSlow?'paint':'sync');
      const counts=renderDOMCounts(document.getElementById('app'));
      emit('render.paint',{
        trace:trace.trace,page:trace.page,raf1Ms,raf2Ms,
        domCount:counts.domCount,imgCount:counts.imgCount,
        canvasCount:counts.canvasCount,videoCount:counts.videoCount,
        autoProtection:!!trace.autoProtection
      },0);
    }
    if(pendingRenderTrace===trace)pendingRenderTrace=null;
  }
  if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{
    renderVisibilityEpoch+=1;
    cancelPendingRenderPaint();
  },{passive:true});
  window.__smallPhonePrivateRenderTrace=function(input){
    const row=input&&typeof input==='object'?input:{},page=safeRuntimeToken(row.page,'unknown');
    cancelPendingRenderPaint();
    updateRenderRoute(page);
    const trace={
      trace:++renderTraceSequence,page,
      settingsCategory:safeSettingsCategory(page,row.detail),
      routeEpoch:renderRouteEpoch,abEpoch:compositionEpoch,abMode:compositionMode,
      htmlMs:boundedNumber(row.htmlMs),innerHTMLMs:boundedNumber(row.innerHTMLMs),
      settingsMs:boundedNumber(row.settingsMs),imageSyncMs:boundedNumber(row.hydrateMs),
      tailMs:boundedNumber(row.afterMs),totalMs:boundedNumber(row.totalMs),
      endedAt:clock(),visibilityEpoch:renderVisibilityEpoch,syncEmitted:false
    };
    trace.syncSlow=trace.totalMs>=120;
    lastRenderTraceID=trace.trace;
    publishRenderTraceState(trace,trace.totalMs);
    if(trace.syncSlow)emitRenderSync(trace,'sync');
    pendingRenderTrace=trace;
    if(typeof requestAnimationFrame==='function')pendingRenderRAF1=requestAnimationFrame(()=>{
      pendingRenderRAF1=0;
      if(!renderTraceStillCurrent(trace)){if(pendingRenderTrace===trace)pendingRenderTrace=null;return;}
      const raf1At=clock(),raf1Ms=boundedNumber(raf1At-trace.endedAt);
      if(compositionMode==='A'&&raf1Ms>=1200)activateSlowFrameProtection(trace,raf1Ms,0,'render-raf1-slow');
      pendingRenderRAF2=requestAnimationFrame(()=>finishRenderPaint(trace,raf1At));
    });
    else pendingRenderTrace=null;
    return trace.trace;
  };
  window.__smallPhoneNativePerformanceSampleTrace=function(input){
    const row=input&&typeof input==='object'?input:{},rawKind=String(row.kind||'work').slice(0,60);
    const kind=/^[A-Za-z][A-Za-z0-9._-]{0,59}$/.test(rawKind)?rawKind:'work',ms=boundedNumber(row.ms);
    if(ms>=120){lastMeasuredSyncOp=kind;lastMeasuredSyncMs=ms;lastMeasuredSyncAt=Date.now();}
    const match=/^render-([A-Za-z][A-Za-z0-9_-]{0,39})$/.exec(kind);
    if(match){
      const page=safeRuntimeToken(match[1],'unknown');
      const current=renderTraceState();
      /* render() publishes the phase trace immediately before it reports the
         aggregate sample. Keep that trace id and route epoch intact so the
         timer layer can correlate a later stall with the actual render. */
      if(current.page!==page){
        updateRenderRoute(page);
        publishRenderTraceState({trace:lastRenderTraceID,page},ms);
      }
    }
    return true;
  };

  function installCompositionABStyle(){
    if(typeof document==='undefined'||
       typeof document.getElementById!=='function'||
       typeof document.createElement!=='function'||
       !document.head)return false;
    if(document.getElementById('northPrivateCompositionABStyle'))return;
    const style=document.createElement('style');
    style.id='northPrivateCompositionABStyle';
    style.textContent=`
html.north-native-app.${COMPOSITION_CLASS} .phone *,
html.north-native-app.${COMPOSITION_CLASS} .phone *::before,
html.north-native-app.${COMPOSITION_CLASS} .phone *::after{box-shadow:none!important;will-change:auto!important}
html.north-native-app.${COMPOSITION_CLASS} .phone :not(img):not(video):not(canvas),
html.north-native-app.${COMPOSITION_CLASS} .phone :not(img):not(video):not(canvas)::before,
html.north-native-app.${COMPOSITION_CLASS} .phone :not(img):not(video):not(canvas)::after{filter:none!important;-webkit-filter:none!important}
html.north-native-app.${COMPOSITION_CLASS} .home .hwid:not(.wpet),
html.north-native-app.${COMPOSITION_CLASS} .home .dock,
html.north-native-app.${COMPOSITION_CLASS} .home .home-editbar,
html.north-native-app.${COMPOSITION_CLASS} .glass-second-portrait,
html.north-native-app.${COMPOSITION_CLASS} .glass-second-photos,
html.north-native-app.${COMPOSITION_CLASS} .glass-second-avatar-picker,
html.north-native-app.${COMPOSITION_CLASS} .glass-second-polaroid,
html.north-native-app.${COMPOSITION_CLASS} .vinyl-record,
html.north-native-app.${COMPOSITION_CLASS} .vinyl-cover,
html.north-native-app.${COMPOSITION_CLASS} .glass-app>.nav,
html.north-native-app.${COMPOSITION_CLASS} .glass-app>.tabbar,
html.north-native-app.${COMPOSITION_CLASS} .glass-app .inputbar,
html.north-native-app.${COMPOSITION_CLASS} .glass-app .panel,
html.north-native-app.${COMPOSITION_CLASS} .glass-app>.scroll>.section,
html.north-native-app.${COMPOSITION_CLASS} .glass-app>.scroll>.list,
html.north-native-app.${COMPOSITION_CLASS} .glass-app>.scroll>.bill,
html.north-native-app.${COMPOSITION_CLASS} .settings-glass>.nav,
html.north-native-app.${COMPOSITION_CLASS} .settings-glass .section,
html.north-native-app.${COMPOSITION_CLASS} .msgbanner,
html.north-native-app.${COMPOSITION_CLASS} .north-glass-modal .sheet,
html.north-native-app.${COMPOSITION_CLASS} .wx-premium>.wx-main-nav,
html.north-native-app.${COMPOSITION_CLASS} .wx-premium>.wx-main-tabbar,
html.north-native-app.${COMPOSITION_CLASS} .wx-premium>.wx-quick-menu,
html.north-native-app.${COMPOSITION_CLASS} .wx-premium>.wx-directory-head,
html.north-native-app.${COMPOSITION_CLASS} .wx-chat-premium>.chat-glass-nav,
html.north-native-app.${COMPOSITION_CLASS} .wx-chat-premium>.chat-glass-mood,
html.north-native-app.${COMPOSITION_CLASS} .wx-chat-premium>.chat-inputbar,
html.north-native-app.${COMPOSITION_CLASS} .wx-chat-premium>.chat-tools-panel{box-shadow:none!important}
html.north-native-app.${COMPOSITION_CLASS} .music-ambient,
html.north-native-app.${COMPOSITION_CLASS} .dybg,
html.north-native-app.${COMPOSITION_CLASS} .vinyl-arm{filter:none!important;will-change:auto!important}
html.north-native-app.${COMPOSITION_CLASS} .home .wdisc,
html.north-native-app.${COMPOSITION_CLASS} .home .petday,
html.north-native-app.${COMPOSITION_CLASS} .home .petsleep,
html.north-native-app.${COMPOSITION_CLASS} .home .petcat .ptail,
html.north-native-app.${COMPOSITION_CLASS} .home .petcat .peyes,
html.north-native-app.${COMPOSITION_CLASS} .home .pzzz,
html.north-native-app.${COMPOSITION_CLASS} .dybg,
html.north-native-app.${COMPOSITION_CLASS} .dy-orbit,
html.north-native-app.${COMPOSITION_CLASS} .dyemoji,
html.north-native-app.${COMPOSITION_CLASS} .dydisc,
html.north-native-app.${COMPOSITION_CLASS} .locpulse,
html.north-native-app.${COMPOSITION_CLASS} .lmmarker span{animation-play-state:paused!important;will-change:auto!important}`;
    document.head.appendChild(style);
    return true;
  }
  function syncCompositionABControls(){
    const label=document.getElementById('privateCompositionProtectionLabel');
    if(label)label.textContent=compositionMode==='B'?'已自动启用':'尚未触发';
  }
  function syncCompositionABNative(mode,source){
    const text=String(source||'control').slice(0,30);
    if(/^native-/.test(text)||text==='page-finished'||
       !window.SmallPhoneNative||typeof window.SmallPhoneNative.request!=='function')return false;
    const now=Date.now();
    if(lastNativeCompositionMode===mode&&now-lastNativeCompositionAt<5000)return false;
    lastNativeCompositionMode=mode;lastNativeCompositionAt=now;
    Promise.resolve(window.SmallPhoneNative.request('diagnostics.compositionMode',{mode,source:text})).catch(()=>{});
    return true;
  }
  function setCompositionMode(mode,source){
    const next=String(mode||'A').toUpperCase()==='B'?'B':'A',previous=compositionMode;
    if(next==='A'&&previous==='B'&&(lastThermalState==='serious'||lastThermalState==='critical')){
      emit('composition.ab.denied',{requested:'A',reason:'thermal-'+lastThermalState,page:currentPageName(),guardActive:guardActive()},0);
      if(typeof window.toast==='function')window.toast('手机仍在严重发热，暂不恢复 A 效果');
      return previous;
    }
    const switchSource=String(source||'control').slice(0,30);
    if(next===previous){syncCompositionABControls();return next;}
    compositionMode=next;compositionEpoch+=1;
    const switchSequence=++compositionSequence,switchWatchdogEpoch=watchdogEpoch();
    window.__SMALL_PHONE_COMPOSITION_STATE__={mode:next,epoch:compositionEpoch};
    document.documentElement.classList.toggle(COMPOSITION_CLASS,next==='B');
    syncCompositionABControls();
    emit('composition.ab.switch',{from:previous,to:next,source:switchSource,page:currentPageName(),thermal:lastThermalState,guardActive:guardActive(),startupQuiet:startupQuiet()},0);
    syncCompositionABNative(next,switchSource);
    const started=clock();
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(switchSequence!==compositionSequence||compositionMode!==next||switchWatchdogEpoch!==watchdogEpoch())return;
      emit('composition.ab.settled',{mode:next,page:currentPageName(),ms:Math.max(0,Math.round(clock()-started)),guardActive:guardActive(),startupQuiet:startupQuiet(),abEpoch:compositionEpoch},0);
    }));
    return next;
  }
  function activateSlowFrameProtection(trace,raf1Ms,raf2Ms,source){
    if(compositionMode!=='A')return false;
    if(trace)trace.autoProtection=true;
    emit('composition.ab.auto',{
      source:String(source||'slow-frame').slice(0,30),
      trace:boundedNumber(trace&&trace.trace,1000000000),
      page:safeRuntimeToken(trace&&trace.page||currentPageName(),'unknown'),
      raf1Ms:boundedNumber(raf1Ms),raf2Ms:boundedNumber(raf2Ms),
      thermal:lastThermalState,guardActive:guardActive()
    },0);
    setCompositionMode('B',source||'slow-frame');
    return true;
  }
  window.privateCompositionABSet=(mode,source)=>setCompositionMode(mode,source||'external-control');
  window.__SMALL_PHONE_COMPOSITION_STATE__={mode:compositionMode,epoch:compositionEpoch};
  installCompositionABStyle();

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
      let syncElapsed=0;
      const finish=(status,error)=>{
        const elapsed=Math.max(0,Math.round(clock()-started));
        const fields=Object.assign({},meta,{ms:elapsed,syncMs:syncElapsed,status});
        if(error)fields.error=String(error&&error.name||'Error').slice(0,40);
        if(span)emit(name+'.end',fields,0);
        else if(elapsed>=threshold)emit('slow.'+name,fields,15000);
      };
      let result;
      try{result=original.apply(this,args);}catch(error){syncElapsed=Math.max(0,Math.round(clock()-started));finish('throw',error);throw error;}
      syncElapsed=Math.max(0,Math.round(clock()-started));
      if(syncElapsed>=120){lastMeasuredSyncOp=name;lastMeasuredSyncMs=syncElapsed;lastMeasuredSyncAt=Date.now();}
      if(result&&typeof result.then==='function'){
        if(syncElapsed>=120)emit('slow.'+name+'.sync',Object.assign({},meta,{ms:syncElapsed,status:'returned-promise'}),15000);
        return Promise.resolve(result).then(value=>{finish('ok');return value;},error=>{finish('reject',error);throw error;});
      }
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
      const text=String(reason||'event-loop').slice(0,80),thermal=/^thermal-(.+)$/.exec(text),lag=/:([0-9]+)$/.exec(text),recent=recentSyncFields();
      const page=currentPageName(),reasonFamily=performanceReasonFamily(text),guardKey=reasonFamily+'|'+page+'|'+compositionMode;
      if(thermal)lastThermalState=thermal[1].slice(0,20);
      emit('performance.guard',{reason:text,holdMs:Math.round(Number(delay)||0),lagMs:lag?Math.round(Number(lag[1])||0):0,page,abMode:compositionMode,thermal:lastThermalState,lastOp:recent.lastOp,lastOpMs:recent.lastOpMs},15000,guardKey);
      return originalGuard.apply(this,arguments);
    };
  }

  if(typeof window.__smallPhoneNativePressure==='function'){
    const originalPressure=window.__smallPhoneNativePressure;
    window.__smallPhoneNativePressure=function(payload){
      if(payload&&typeof payload==='object'&&payload.thermalState)lastThermalState=String(payload.thermalState).slice(0,20);
      emit('runtime.pressure',{thermal:lastThermalState,memoryWarning:!!(payload&&payload.memoryWarning),page:currentPageName(),abMode:compositionMode},10000);
      return originalPressure.apply(this,arguments);
    };
  }

  (function observeBoundedLongTasks(){
    if(typeof PerformanceObserver==='function')try{
      const observer=new PerformanceObserver(list=>{
        let longest=0;
        list.getEntries().forEach(entry=>{longest=Math.max(longest,Number(entry.duration)||0);});
        if(longest>=250)emit('runtime.longtask',{ms:Math.round(longest),page:currentPageName(),abMode:compositionMode,thermal:lastThermalState},5000);
      });
      observer.observe({entryTypes:['longtask']});
    }catch(_){}
  })();

  async function readDiagnostics(){
    if(!window.SmallPhoneNative||typeof window.SmallPhoneNative.request!=='function')throw new Error('原生诊断桥不可用');
    return window.SmallPhoneNative.request('diagnostics.read');
  }
  window.privatePhoneDiagnosticsOpen=async function(){
    try{
      const result=await readDiagnostics(),text=String(result&&result.text||'暂时没有异常记录');
      openModal('<h3>私人 App 卡顿诊断</h3><div class="hint" style="line-height:1.75">这里只记录耗时、温度状态、进程阶段、WebContent 终止和版本号，不记录聊天、图片、密钥或网址。自动全量云备份当前已暂停；手动备份和恢复仍可使用。</div><div style="margin-top:12px;padding:10px;border:1px solid #555;border-radius:10px"><b>渲染后低负载保护</b><small style="display:block;color:#9ca4b2;margin:5px 0 7px;line-height:1.5">页面首帧等待达到 1.2 秒时会在本次打开期间自动减轻装饰合成；不保存设置、不重载页面、不改数据，主屏不再显示 A/B 按钮。</small><div id="privateCompositionProtectionLabel" style="color:#ff9aba">尚未触发</div></div><textarea id="privateRuntimeDiagnosticsText" readonly style="width:100%;height:220px;margin-top:12px;padding:10px;box-sizing:border-box;border:1px solid #555;border-radius:10px;background:#111;color:#eee;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace"></textarea><div class="btns"><button class="btn g" onclick="privatePhoneDiagnosticsClear()">清空记录</button><button class="btn p" onclick="privatePhoneDiagnosticsCopy()">复制记录</button></div>');
      const box=document.getElementById('privateRuntimeDiagnosticsText');if(box)box.value=text;
      syncCompositionABControls();
    }catch(error){toast(String(error&&error.message||'诊断记录读取失败'));}
  };
  window.privatePhoneDiagnosticsCopy=async function(){
    const box=document.getElementById('privateRuntimeDiagnosticsText');if(!box)return;
    try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(box.value);else{box.focus();box.select();document.execCommand('copy');}toast('诊断记录已复制');}catch(_){box.focus();box.select();toast('已选中诊断记录，请点复制');}
  };
  window.privatePhoneDiagnosticsClear=async function(){
    try{await window.SmallPhoneNative.request('diagnostics.clear');const box=document.getElementById('privateRuntimeDiagnosticsText');if(box)box.value='诊断记录已清空';toast('诊断记录已清空');}catch(_){toast('诊断记录清空失败');}
  };

  async function openRequestedRecoveryScanner(){
    const modal=document.getElementById('modal');
    let modalWasShown=false,observer=null;
    if(modal){
      modal.style.setProperty('z-index','12000','important');
      observer=new MutationObserver(()=>{
        if(modal.classList.contains('show'))modalWasShown=true;
        if(modalWasShown&&!modal.classList.contains('show')){
          modal.style.removeProperty('z-index');
          observer.disconnect();
        }
      });
      observer.observe(modal,{attributes:true,attributeFilter:['class']});
    }
    emit('recovery.scanner.open',{nativeRequest:true},0);
    try{
      await Promise.resolve(window.emergencyRestoreAll());
      await window.SmallPhoneNative.request('recovery.launch.ack');
    }catch(error){
      emit('recovery.scanner.failed',{error:String(error&&error.name||'Error').slice(0,40)},0);
      if(modal){
        modal.style.removeProperty('z-index');
        if(observer)observer.disconnect();
      }
    }
  }

  async function consumeNativeRecoveryLaunch(attempt){
    attempt=Math.max(0,Number(attempt)||0);
    if(!window.__northBootReady||
       !window.SmallPhoneNative||
       typeof window.SmallPhoneNative.request!=='function'||
       typeof window.emergencyRestoreAll!=='function'){
      if(attempt<80)setTimeout(()=>consumeNativeRecoveryLaunch(attempt+1),250);
      return;
    }
    try{
      const result=await window.SmallPhoneNative.request('recovery.launch.peek');
      if(result&&result.requested===true)await openRequestedRecoveryScanner();
    }catch(error){
      emit('recovery.launch.consume.failed',{error:String(error&&error.name||'Error').slice(0,40)},0);
    }
  }

  if(typeof window.privatePhoneAccountSection==='function'){
    const originalSection=window.privatePhoneAccountSection;
    window.privatePhoneAccountSection=function(){
      return originalSection.apply(this,arguments)+'<div class="section" id="set_private_runtime_diagnostics"><div class="it"><span><b>私人 App 性能保护</b><small style="display:block;color:#8f9eb3;margin-top:4px">自动全量云备份已暂停；手动备份与恢复保留</small></span><span class="v">诊断已启用</span></div><div class="btns" style="padding:8px 14px 12px"><button class="btn g" onclick="privatePhoneDiagnosticsOpen()">查看卡顿诊断</button></div></div>';
    };
  }

  emit('runtime.overlay.ready',{version:OVERLAY_VERSION,autoBackupPaused:true,abMode:compositionMode},0);
  setTimeout(()=>consumeNativeRecoveryLaunch(0),0);
  try{
    if(typeof _bootImagesPromise!=='undefined'&&_bootImagesPromise&&typeof _bootImagesPromise.then==='function'){
      const started=clock();emit('boot.images.wait.begin',{},0);
      _bootImagesPromise.then(()=>emit('boot.images.wait.end',{ms:Math.max(0,Math.round(clock()-started)),status:'ok'},0),error=>emit('boot.images.wait.end',{ms:Math.max(0,Math.round(clock()-started)),status:'reject',error:String(error&&error.name||'Error').slice(0,40)},0));
    }
  }catch(_){}
})();
