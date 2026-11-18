/* =================== 渲染路由 =================== */
let stack=[{p:'home'}];
let wxTab='chats';
let _wxQuickOpen=false;
/* WECHAT_MESSAGE_MOTION_V1694: selected preview timings; presentation only. */
let _wechatMotion=null;
/* NATURAL_CHAT_MOTION_ALL_V1: presentation only; cinema deliberately excluded. */
const _naturalMotionObjects=new WeakMap(),_naturalTransientRecords=new Map();let _naturalMotionSequence=0;
function naturalMotionObjectKey(value){if(value&&typeof value==='object'){let key=_naturalMotionObjects.get(value);if(!key){key='object:'+ ++_naturalMotionSequence;_naturalMotionObjects.set(value,key);}return key;}return 'value:'+String(value);}
function naturalMotionRowKey(m){return String(m&&(m.id||m._clientSendId)||'legacy:'+JSON.stringify([m&&m.time,m&&m.t,m&&m.from,m&&m.who,m&&m.role,m&&m.text,m&&m.c,m&&m.content]));}
function naturalMotionTransient(el,source){if(!el)return;const key=String(actId())+':'+naturalMotionObjectKey(source);let rec=_naturalTransientRecords.get(key);if(!rec){rec={born:Date.now(),node:null,motion:null};_naturalTransientRecords.set(key,rec);if(_naturalTransientRecords.size>100)_naturalTransientRecords.delete(_naturalTransientRecords.keys().next().value);}if(rec.node===el)return;rec.node=el;rec.motion=wechatMotionAnimate(el,{opacity:0,transform:'translateY(12px) scale(.97)'},420,0,rec.motion&&rec.motion.currentTime!=null?rec.motion.currentTime:Date.now()-rec.born);}
function naturalMotionTransientScan(){document.querySelectorAll('[data-natural-transient]').forEach(el=>naturalMotionTransient(el,el.getAttribute('data-natural-transient')));}
function naturalChatMotionTarget(c){if(!c||c.p==='cinema')return '';const ids={chat:'chatbg',group:'chatbg',pfchat:'pfchatbg',pfgroup:'pfgroupbg',off:'offbg',rp:'rpbg',hischat:c.fid==='__me'?'hisselflog':'hischatlog',xdm:'xdmbox',dydm:'dydmbox',mgroom:'mgrbg',alter:'alterbg',tale:'talebox',dread:'dreadbox',jail:'jailbox',gs:'gsbg',shopcs:'csbox',phonesms:'smsbody'};if(c.p==='dy'&&document.querySelector('.dyg-box'))return '.dyg-box';if(c.p==='spy'&&(document.getElementById('hisselflog')||document.getElementById('hischatlog')))return document.getElementById('hisselflog')?'hisselflog':'hischatlog';return ids[c.p]||'';}
function naturalChatMotionPrepare(st){if(!st.general)return;const counts=new Map();st.box.querySelectorAll('.msg,.offnar,.offdate,.rpnar,.xmsg,.dydm-msg,.dyg-msg,.smsmsg,.imsg-row,.jnar,.jbub,[data-chat-motion-row]').forEach(row=>{if(row.querySelector('.typing,.dydm-typing')||row.id==='typing'||row.id==='gtyping')return;if(row.hasAttribute('data-message-id')&&!row.getAttribute('data-message-id').startsWith('natural:'))return;const base=row.getAttribute('data-chat-motion-row')||row.getAttribute('onclick')||row.getAttribute('onpointerdown')||row.className+'|'+row.textContent;const n=counts.get(base)||0;counts.set(base,n+1);row.setAttribute('data-message-id','natural:'+base+'|'+n);});}
function wechatMotionReadDue(rec,text,now,incoming){if(!text)return 0;if(!rec.due)rec.due=rec.initial?now:(incoming?Math.max(rec.born+2000,now):now+2000);return rec.due;}
function wechatMotionReduced(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
function wechatMotionAnimate(el,from,duration,delay,elapsed){const age=Math.max(0,elapsed||0);if(!el||typeof el.animate!=='function'||wechatMotionReduced()||age>=duration+(delay||0))return;const animation=el.animate([from,{opacity:1,transform:'translateY(0) scale(1)'}],{duration:duration,delay:delay||0,easing:'ease-out',fill:'backwards'});animation.currentTime=age;return animation;}
function wechatMotionMessageId(m){const payload=pfMsgPayload(m);return payload&&payload._clientSendId?'client:'+payload._clientSendId:'message:'+String(m.id);}
function wechatMotionDispose(){const st=_wechatMotion;if(!st)return;if(st.observer)st.observer.disconnect();cancelAnimationFrame(st.frame);st.rows.forEach(r=>clearTimeout(r.timer));_wechatMotion=null;}
function wechatMotionReadLabel(el,text){if(!el)return;if(el.getAttribute('data-wx-read')!==text)el.setAttribute('data-wx-read',text);const st=_wechatMotion;if(st&&st.box.contains(el))wechatMotionScan(st,false);else if(el.textContent!==text)el.textContent=text;}
function wechatMotionReceipt(st,row,rec,el){if(!el)return;const text=el.getAttribute('data-wx-read')||'',now=Date.now();if(!readReceiptOn()||!text){clearTimeout(rec.timer);rec.timer=0;rec.due=0;rec.shown=false;rec.readNode=null;rec.readMotions=[];rec.readShownAt=0;if(el.textContent)el.textContent='';return;}const due=wechatMotionReadDue(rec,text,now,!row.classList.contains('me'));if(now<due){if(el.textContent)el.textContent='';if(!rec.timer)rec.timer=setTimeout(()=>{rec.timer=0;if(_wechatMotion===st&&st.box.isConnected&&!document.hidden)wechatMotionScan(st,false);},due-now);return;}clearTimeout(rec.timer);rec.timer=0;if(el.textContent===text&&rec.shown&&rec.readNode===el)return;if(!rec.shown)rec.readShownAt=now;const previous=rec.readMotions||[];rec.shown=true;rec.readNode=el;rec.readMotions=[];el.textContent='';Array.from(text).forEach((letter,i)=>{const span=document.createElement('span');span.textContent=letter;span.style.display='inline-block';el.appendChild(span);if(!rec.initial)rec.readMotions[i]=wechatMotionAnimate(span,{opacity:0,transform:'translateY(4px)'},700,i*90,previous[i]&&previous[i].currentTime!=null?previous[i].currentTime:now-rec.readShownAt);});el.setAttribute('data-wx-read-shown-at',String(rec.readShownAt||now));}
function wechatMotionScan(st,initial){if(!st||_wechatMotion!==st)return;naturalChatMotionPrepare(st);st.box.querySelectorAll('[data-message-id]').forEach(row=>{const id=row.getAttribute('data-wx-motion-id')||row.getAttribute('data-message-id');let rec=st.rows.get(id);if(!rec){rec={born:Date.now(),initial:!!initial,due:0,shown:false,timer:0};st.rows.set(id,rec);if(!initial)st.added=true;}if(rec.node!==row){rec.node=row;if(!rec.initial){const age=Date.now()-rec.born;rec.colMotion=wechatMotionAnimate(row.querySelector('.col,.xmwrap,.dydm-b,.dyg-body,.smsbubble,.imsg-col')||(row.classList.contains('msg')?row.querySelector('.bubble'):row),{opacity:0,transform:'translateY(12px) scale(.97)'},420,0,rec.colMotion&&rec.colMotion.currentTime!=null?rec.colMotion.currentTime:age);rec.avatarMotion=wechatMotionAnimate(row.querySelector('.avatar')||(row.matches('.msg,.dyg-msg,.dydm-msg')?row.querySelector(':scope > span'):null),{opacity:0,transform:'translateY(6px) scale(.94)'},520,80,rec.avatarMotion&&rec.avatarMotion.currentTime!=null?rec.avatarMotion.currentTime:age);}}wechatMotionReceipt(st,row,rec,row.querySelector('.msgread-line[data-wx-read],.dydm-read[data-wx-read]'));});st.box.querySelectorAll('.tstamp,.dydm-t,.dyg-t,.dyg-time,.smsdate,.imsg-date').forEach(el=>{if(el.hasAttribute('data-wx-motion-time'))return;el.setAttribute('data-wx-motion-time','1');const next=el.nextElementSibling,anchor=next&&(next.getAttribute('data-wx-motion-id')||next.getAttribute('data-message-id')),stamp=anchor?'message:'+anchor:'time:'+el.textContent;let rec=st.times.get(stamp);if(!rec){rec={born:Date.now(),initial:!!initial,motion:null};st.times.set(stamp,rec);}if(!rec.initial)rec.motion=wechatMotionAnimate(el,{opacity:0,transform:'translateY(5px)'},600,220,rec.motion&&rec.motion.currentTime!=null?rec.motion.currentTime:Date.now()-rec.born);});}
function wechatMotionScroll(box,start){const st=_wechatMotion;if(!st||st.box!==box)return false;cancelAnimationFrame(st.frame);const from=start==null?box.scrollTop:start,target=()=>Math.max(0,box.scrollHeight-box.clientHeight);if(wechatMotionReduced()){box.scrollTop=target();return true;}const began=performance.now();st.animating=true;box.scrollTop=from;function tick(now){if(_wechatMotion!==st||!box.isConnected||document.hidden)return;const t=Math.min(1,Math.max(0,(now-began)/580));box.scrollTop=from+(target()-from)*(1-Math.pow(1-t,3));if(t<1)st.frame=requestAnimationFrame(tick);else{st.frame=0;st.animating=false;st.top=box.scrollTop;st.follow=nearBottom(box);}}st.frame=requestAnimationFrame(tick);return true;}
function wechatMotionMount(c){const target=naturalChatMotionTarget(c);const box=target&&(target[0]==='.'?document.querySelector(target):document.getElementById(target)),key=String(actId())+':'+renderPageKey(c)+':'+String(c.id||c.num||'')+':'+String(c.fid||'')+':'+String(c.mode||c.sk||c.xId||'')+':'+String(c.yId||'')+':'+String(c.p==='off'&&typeof _off!=='undefined'&&_off&&_off.mode||'')+':'+String(box&&box.getAttribute('data-render-scroll-key')||'');if(!box){wechatMotionDispose();return;}let st=_wechatMotion,initial=!st||st.key!==key;if(initial){wechatMotionDispose();st={key:key,box:box,rows:new Map(),times:new Map(),frame:0,observer:null,added:false,general:!['chat','group','pfchat','pfgroup'].includes(c.p),top:0,follow:true};_wechatMotion=st;}else{if(st.observer)st.observer.disconnect();cancelAnimationFrame(st.frame);st.box=box;st.added=false;}box.classList.add(st.general?'natural-motion-chat':'wx-motion-chat');if(!document.getElementById('wechatMessageMotionStyle')){const style=document.createElement('style');style.id='wechatMessageMotionStyle';style.textContent='.wx-motion-chat{padding-bottom:18px!important;overflow-anchor:none;scroll-behavior:auto!important}.wx-motion-chat .msg{margin-top:12px;margin-bottom:12px}.wx-motion-chat .msg.msg-enter{animation:none!important}.wx-motion-chat .msgread-line{pointer-events:none}.natural-motion-chat{overflow-anchor:none;scroll-behavior:auto!important}.natural-motion-chat .msg-enter,.natural-motion-chat .offreveal,.natural-motion-chat .jin{animation:none!important}.natural-motion-chat .offglyph{animation:none!important;opacity:1!important;filter:none!important;transform:none!important}';document.head.appendChild(style);}wechatMotionScan(st,initial);st.observer=new MutationObserver(()=>{const count=st.rows.size,top=st.top,follow=st.follow;wechatMotionScan(st,false);if(st.general&&st.rows.size>count&&follow)wechatMotionScroll(st.box,top);});st.observer.observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['data-wx-read']});if(!box._wxMotionInput){box._wxMotionInput=true;box.addEventListener('scroll',()=>{if(_wechatMotion&&_wechatMotion.box===box){_wechatMotion.top=box.scrollTop;if(!_wechatMotion.animating)_wechatMotion.follow=nearBottom(box);}},{passive:true});['wheel','touchstart','pointerdown','keydown'].forEach(type=>box.addEventListener(type,()=>{if(_wechatMotion&&_wechatMotion.box===box){cancelAnimationFrame(_wechatMotion.frame);_wechatMotion.animating=false;_wechatMotion.frame=0;_wechatMotion.follow=nearBottom(box);}},{passive:true}));} }
document.addEventListener('visibilitychange',()=>{const st=_wechatMotion;if(!st)return;if(document.hidden)cancelAnimationFrame(st.frame);else wechatMotionScan(st,false);});
let _scrollBottomOnce={};
/* SHELL_INTERACTION_MOTION_V1：只负责呈现；导航、保存、请求和输入会话仍立即按原路径执行。 */
let _shellMotionLast=null,_shellMotionOrigin=null,_shellMotionJobs=[],_shellMotionGhost=null,_shellMotionTimer=0;
/* SHELL_LIVE_SURFACES_V1：媒体/画布只淡入；独立浮层不复制、不重建、不接管手势。 */
const _shellSurfaceRecords=new Map(),_shellSurfaceJobs=new Set(),_shellFrameBindings=new WeakSet();
let _shellSurfaceMounted=false;
function shellMotionProfile(c,page){
  if(c&&c.p==='robotFace')return 'protected';
  if(c&&c.p==='couple'&&typeof privateCompanionAppOn==='function'&&privateCompanionAppOn()&&(c.sub==='device'||typeof _couTab!=='undefined'&&_couTab===3))return 'protected';
  if(c&&c.p==='couple'&&document.querySelector('#cw-holder iframe'))return 'live';
  if(c&&['cinemawatch','cinemaread','pixelhome','cozyhome','drawguess','beadstudio','pet'].includes(c.p))return 'live';
  return page&&page.querySelector('video,audio,iframe,canvas')?'live':'standard';
}
function shellSurfaceClear(){_shellSurfaceJobs.forEach(a=>{try{a.cancel();}catch(_){}});_shellSurfaceJobs.clear();}
function shellSurfaceFade(el){
  if(!el||!el.isConnected||!shellMotionAllowed()||shellMotionProfile(cur(),null)==='protected'||document.fullscreenElement)return null;
  try{const a=el.animate([{opacity:.35},{opacity:1}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});_shellSurfaceJobs.add(a);const done=()=>_shellSurfaceJobs.delete(a);a.onfinish=done;a.oncancel=done;return a;}catch(_){return null;}
}
function shellSurfaceUpdate(el){
  const rec=_shellSurfaceRecords.get(el);if(!rec)return;
  if(el.id==='callLayer'&&typeof wxCallInteractionMount==='function')try{wxCallInteractionMount(el);}catch(_){}
  const css=getComputedStyle(el),visible=!el.hidden&&css.display!=='none'&&css.visibility!=='hidden'&&(!['callLayer','viewer'].includes(el.id)||el.classList.contains('show'));
  const variant=el.id==='callLayer'?(el.classList.contains('mini')?'mini':'full'):'';
  const panel=el.matches('.nr-overlay')?el.firstElementChild:null;
  const changed=visible&&(!rec.visible||variant!==rec.variant||panel!==rec.panel),sameOwner=rec.owner===S&&rec.account===actId();
  rec.visible=visible;rec.variant=variant;rec.panel=panel;rec.owner=S;rec.account=actId();
  if(!visible||changed){if(rec.animation)rec.animation.cancel();rec.animation=null;}
  if(changed&&sameOwner){
    const existing=css.animationName!=='none'||String(css.transitionDuration).split(',').some(t=>parseFloat(t)>0);
    el.setAttribute('data-shell-surface',existing?'existing':'fade');if(!existing)rec.animation=shellSurfaceFade(el);
  }
}
function shellSurfaceBind(root){
  if(!root||root.nodeType!==1)return;
  _shellSurfaceRecords.forEach((rec,el)=>{if(!el.isConnected){rec.observer.disconnect();if(rec.animation)rec.animation.cancel();_shellSurfaceRecords.delete(el);}});
  const selector='#cw-holder,#callLayer,#viewer,#lockScreen,#msgBanner,#callBanner,.nr-root,.nr-overlay,.tn-dfull-ov,.tn-pack-ov,.tg-ov,.pc-reveal,.photo-meta-overlay';
  const candidates=(root.matches(selector)?[root]:[]).concat(Array.from(root.querySelectorAll(selector)));
  candidates.forEach(el=>{if(_shellSurfaceRecords.has(el))return;
    const rec={visible:false,variant:'',panel:null,owner:S,account:actId(),animation:null,observer:null};_shellSurfaceRecords.set(el,rec);
    rec.observer=new MutationObserver(()=>{try{shellSurfaceUpdate(el);}catch(_){}});
    const panel=el.matches('.nr-overlay');rec.observer.observe(el,{attributes:true,attributeFilter:panel?['class','style','hidden']:['class','hidden'],childList:panel||el.id==='callLayer'});
    shellSurfaceUpdate(el);
  });
}
function shellMotionSurfacesMount(){
  if(_shellSurfaceMounted||typeof MutationObserver!=='function')return;_shellSurfaceMounted=true;
  [document.body,document.querySelector('.screen')].filter(Boolean).forEach(root=>{
    shellSurfaceBind(root);
    // 只看容器的直接增删，不观察整棵聊天DOM；新页面在render收尾单独登记。
    const observer=new MutationObserver(changes=>{try{
      _shellSurfaceRecords.forEach((rec,el)=>{if(!el.isConnected){rec.observer.disconnect();if(rec.animation)rec.animation.cancel();_shellSurfaceRecords.delete(el);}});
      changes.forEach(change=>change.addedNodes.forEach(node=>shellSurfaceBind(node)));
    }catch(_){}});observer.observe(root,{childList:true});
  });
}
function shellMotionFramesMount(page,c){
  if(!page||!['pixelhome','cozyhome','cinemawatch'].includes(c.p))return;
  page.querySelectorAll('iframe').forEach(frame=>{if(_shellFrameBindings.has(frame))return;_shellFrameBindings.add(frame);
    const owner=S,account=actId(),route=c.p;
    frame.addEventListener('load',()=>{if(frame.isConnected&&owner===S&&account===actId()&&cur().p===route)shellSurfaceFade(frame);},{once:true});
  });
}
function shellMotionReset(){
  clearTimeout(_shellMotionTimer);_shellMotionTimer=0;
  _shellMotionJobs.splice(0).forEach(a=>{try{a.cancel();}catch(_){}});
  if(_shellMotionGhost){_shellMotionGhost.remove();_shellMotionGhost=null;}
}
function shellMotionAllowed(){return !document.hidden&&!wechatMotionReduced()&&typeof Element!=='undefined'&&typeof Element.prototype.animate==='function';}
function shellMotionAnimate(el,frames,duration,delay){
  if(!el||!shellMotionAllowed())return;
  try{const a=el.animate(frames,{duration:duration,delay:delay||0,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});_shellMotionJobs.push(a);const done=()=>{const i=_shellMotionJobs.indexOf(a);if(i>=0)_shellMotionJobs.splice(i,1);};a.onfinish=done;a.oncancel=done;return a;}catch(_){}
}
function shellMotionStyle(){
  if(document.getElementById('shellInteractionMotionStyle'))return;
  const style=document.createElement('style');style.id='shellInteractionMotionStyle';
  style.textContent=`
  #app>.shell-motion-ghost{pointer-events:none!important;user-select:none!important;z-index:8;contain:layout paint;overflow:hidden}
  #app>.shell-motion-ghost *{pointer-events:none!important;animation:none!important;caret-color:transparent!important}
  @media(prefers-reduced-motion:no-preference){
    #app button:not(:disabled),#modal button:not(:disabled),#app .nav .l,#app .nav .r{transition:scale 180ms cubic-bezier(.22,1,.36,1)}
    #app button:not(:disabled):active,#modal button:not(:disabled):active,#app .nav .l:active,#app .nav .r:active{scale:.94}
    #app .home:not(.home-editing) .app .b{transition:scale 260ms cubic-bezier(.22,1,.36,1)}
    #app .home:not(.home-editing) .app:active .b{scale:.88}
    #app .sw:after{transition:transform 280ms cubic-bezier(.22,1,.36,1),left 280ms cubic-bezier(.22,1,.36,1)}
    #modal.show:not(.call-modal)>.sheet{animation:shellSheetIn 360ms cubic-bezier(.22,1,.36,1) both}
    #modal.show:not(.call-modal){animation:shellVeilIn 240ms ease-out both}
    #cfm.show .cfmbox{animation:shellSheetIn 320ms cubic-bezier(.22,1,.36,1) both}
    #modal.show.call-modal,#modal.show.call-modal>.sheet{animation:shellVeilIn 220ms ease-out both}
    #callLayer .cbtn,#lockScreen .lockquick,.nr-root button{transition:scale 180ms cubic-bezier(.22,1,.36,1)}
    #callLayer .cbtn:active,#lockScreen .lockquick:active,.nr-root button:active{scale:.94}
    @keyframes shellSheetIn{from{opacity:0;transform:translateY(24px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes shellVeilIn{from{opacity:0}to{opacity:1}}
  }
  @media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){
    #app .home:not(.home-editing) .app:hover .b{scale:1.065}
  }`;
  document.head.appendChild(style);
  shellMotionSurfacesMount();
}
function shellMotionLaunch(key){
  const app=document.getElementById('app');if(!app||cur().p!=='home')return;
  const icon=Array.from(app.querySelectorAll('.app[data-token]')).find(el=>el.getAttribute('data-token')===key);
  if(!icon)return;
  const r=(icon.querySelector('.b')||icon).getBoundingClientRect(),host=app.getBoundingClientRect();
  _shellMotionOrigin={key:key,x:r.left+r.width/2-host.left,y:r.top+r.height/2-host.top,at:Date.now(),owner:S,account:actId()};
}
function shellMotionRoute(c){
  let detail=c.p==='wechat'?wxTab:c.p==='settings'?String(_setCategory)+':'+_setTab:c.p==='music'?_mView:'';
  if(c.p==='cinemaread'){const session=cinemaSession();detail=String(_cin.sessionId)+':'+String(session&&session.page||0);}
  if(c.p==='drawguess'&&typeof _dg!=='undefined'&&_dg)detail=_dg.phase;
  if(c.p==='beadstudio'&&typeof _bead!=='undefined'&&_bead)detail=_bead.phase;
  if(/^dy/.test(c.p))detail=[typeof dyTab!=='undefined'?dyTab:'',typeof _dySub!=='undefined'?_dySub:'',typeof _dyMode!=='undefined'?_dyMode:'',typeof _dyMeTab!=='undefined'?_dyMeTab:'',typeof _dyUserTab!=='undefined'?_dyUserTab:'',typeof _dyCmTab!=='undefined'?_dyCmTab:'',typeof _dyRelTab!=='undefined'?_dyRelTab:'',typeof _dyHistTab!=='undefined'?_dyHistTab:'',typeof _dyUserKey!=='undefined'?_dyUserKey:'',typeof _dyWorkId!=='undefined'?_dyWorkId:'',typeof _dyGid!=='undefined'?_dyGid:'',typeof _dyCmOpen!=='undefined'?_dyCmOpen:false,typeof _dyCmFull!=='undefined'?_dyCmFull:false].join(':');
  if(c.p==='x')detail=String(typeof xTab!=='undefined'?xTab:'')+':'+String(typeof _feedTab!=='undefined'?_feedTab:'');
  if(c.p==='phoneapp'&&typeof phState==='function'){const ph=phState();detail=String(ph.tab||'')+':'+String(ph.filter||'');}
  if(c.p==='album'||c.p==='aiaccount')detail=typeof _photoAlbumTab!=='undefined'?_photoAlbumTab:'';
  if(c.p==='travel')detail=typeof _tvTab!=='undefined'?_tvTab:'';
  if(c.p==='rphub')detail=typeof _rpStudioFilter!=='undefined'?_rpStudioFilter:'';
  return renderPageKey(c)+':'+[c.id,c.gid,c.fid,c.key,c.pid,c.mode,c.tab,c.sub,c.num,c.mid,c.type,c.view,c.page,c.index,c.date,c.saveId,c.name,c.cid,c.target].map(v=>String(v==null?'':v)).join(':')+':'+detail;
}
function shellMotionPrepare(c,app){
  shellMotionStyle();const old=_shellMotionLast,key=shellMotionRoute(c),owner=S,account=actId();
  const changed=!!old&&old.key!==key&&old.owner===owner&&old.account===account;
  if(_shellMotionOrigin&&(_shellMotionOrigin.owner!==owner||_shellMotionOrigin.account!==account))_shellMotionOrigin=null;
  shellMotionReset();
  if(!shellMotionAllowed())shellSurfaceClear();
  const plan={key:key,page:c.p,depth:stack.length,owner:owner,account:account,changed:changed,old:old};
  if(changed&&shellMotionAllowed()&&typeof wxRoleEntryGhost==='function')plan.roleGhost=wxRoleEntryGhost(c,app,old);
  return plan;
}
/* SHELL_ALL_APPS_INTERACTION_V1：常规内页背景稳定，只移动内容；媒体和受保护页面保持原边界。 */
function shellMotionContent(page){
  if(!page)return null;
  const explicit=page.querySelector('.dy-shell,.dywk-stage,.rp-studio-scroll,#dyfeed,#xscroll,#phbody,.phbody,.photo-album-scroll,.ctr-order-scroll,.ctr-scroll,.travel-scroll,#rpbg,#offbg,#settingsscroll,.wx-main-scroll,#chatbg,#pfchatbg,#pfgroupbg,.gmanage-scroll,.wx-role-moments,.wx-role-detail-scroll,.wx-real-scroll,.wx-directory-scroll,.scroll,main,.music-library,.music-app-body,.gamehub-scroll,.travel-scroll,.shop-scroll,.mail-scroll,.browser-body');
  if(explicit)return explicit;
  const candidates=Array.from(page.querySelectorAll('[class*="scroll"],[class*="feed"]')).slice(0,24);
  for(const el of candidates){const css=getComputedStyle(el);if(el.clientHeight>40&&/auto|scroll/.test(css.overflowY))return el;}
  return Array.from(page.children).find(el=>!el.matches('.nav,header,.tabbar,footer,.inputbar,.manual-reply-row')&&el.getBoundingClientRect().height>80)||null;
}
/* SHELL_INTERNAL_VIEWS_V1：页面目录、内部标签及局部视图一并识别，不把数据刷新当导航。 */
function shellViewSignature(root,c){
  if(!root||root.matches('#app>.page')&&(c.p==='home'||c.p==='settings'||naturalChatMotionTarget(c)))return '';
  const parts=Array.from(root.children).slice(0,5).map(el=>el.tagName+':'+el.id+':'+String(el.className||'').split(/\s+/).filter(x=>!['show','open','on','active','loading','busy','paused'].includes(x)).join('.'));
  const body=shellMotionContent(root);if(body){parts.push('body:'+String(body.getAttribute('data-render-scroll-key')||''));Array.from(body.children).slice(0,4).forEach(el=>parts.push('child:'+el.tagName+':'+el.id+':'+String(el.className||'').replace(/\b(on|active|loading|busy)\b/g,'')));}
  const navs=root.querySelectorAll('nav,.tabbar,.tabs,.xtabs,.phtab,.phseg,.phlineswitch,.travel-tabs,.photo-album-tabs,.rp-memory-tabs,[role="tablist"],[class*="-tabs"],[class*="-filters"],[class*="-types"],[class*="tabbar"]');
  Array.from(navs).slice(0,24).forEach((nav,i)=>{if(!nav.getClientRects().length)return;const selected=Array.from(nav.querySelectorAll('.on,.active,.selected,[aria-selected="true"],[aria-current="true"],[aria-current="page"],[aria-pressed="true"]')).slice(0,8).map(el=>el.id||el.getAttribute('data-tab')||el.getAttribute('onclick')||String(Array.from(nav.children).indexOf(el)));parts.push('nav'+i+':'+selected.join('|'));});
  Array.from(root.querySelectorAll('main,[data-view],[data-stage],[class$="-screen"],[class$="-results"],[class$="-detail"],[class$="-form"]')).slice(0,16).forEach(el=>{if(el.getClientRects().length)parts.push('view:'+el.tagName+':'+el.id+':'+el.className+':'+String(el.getAttribute('data-view')||el.getAttribute('data-stage')||''));});
  return parts.join(';');
}
/* SHELL_ANCHORED_TITLES_V3: animate independent content branches, never a title or its ancestors. */
// SHELL_WECHAT_PROFILE_STEADY_V1: keep the profile identity out of content entrance motion.
const SHELL_TITLE_SELECTOR='.nav,header,.xnav,.wx-main-title,.wxme-profile-card,.phtitle,h1,h2,[role="heading"],.page-title,.app-title,.music-app-title,.browser-title,[class*="-brand"],.ctn-hero,.ctf-hero,.cth-hero';
function shellContentMotionExcluded(c,page,old){
  if(c.p==='worldbook'||c.p==='travel'&&!page.querySelector('.ctr-app'))return true;
  return !!(old&&old.page===c.p&&/^dy/.test(c.p)&&(old.dyMeTab!==String(typeof _dyMeTab==='undefined'?'':_dyMeTab)||old.dyUserTab!==String(typeof _dyUserTab==='undefined'?'':_dyUserTab)));
}
function shellMotionTargets(page){
  const host=page.getBoundingClientRect(),queue=Array.from(page.children).map(el=>({el,depth:0})),out=[];
  let visited=0;
  while(queue.length&&visited++<96&&out.length<10){
    const {el,depth}=queue.shift(),r=el.getBoundingClientRect();
    if(!r.width||!r.height||r.bottom<=host.top||r.top>=host.bottom||el.matches('style,script,link,'+SHELL_TITLE_SELECTOR+',.tabbar,[class*="tabbar"],.phtab,.dytab,footer,.chat-inputbar,.inputbar,.manual-reply-row,input,textarea,select,canvas,video,iframe'))continue;
    const split=r.top<host.top+90||el.querySelector(SHELL_TITLE_SELECTOR+',input,textarea,select,[contenteditable="true"],canvas,video,iframe')||document.activeElement&&el.contains(document.activeElement);
    if(split){if(depth<8)queue.push(...Array.from(el.children).map(child=>({el:child,depth:depth+1})));continue;}
    out.push(el);
  }
  return out;
}
function shellContentMotion(page,c,plan){
  if(!page||!shellMotionAllowed()||shellMotionProfile(c,page)!=='standard')return;
  if(shellContentMotionExcluded(c,page,plan&&plan.old)||naturalChatMotionTarget(c)){page.setAttribute('data-shell-content-motion','none');return;}
  const launch=plan&&plan.old&&plan.old.page==='home',home=c.p==='home',backward=!!(plan&&plan.old&&plan.depth<plan.old.depth);
  const family=/^dy/.test(c.p)?'douyin':c.p==='x'?'x':/^phone/.test(c.p)?'phone':c.p==='album'?'album':c.p==='tasks'?'tasks':/^rp|^off/.test(c.p)?'roleplay':c.p==='travel'?'travel':'standard';
  const targets=home?Array.from(page.querySelectorAll('.app .b')).filter(el=>{const r=el.getBoundingClientRect();return r.top<page.getBoundingClientRect().bottom&&r.bottom>page.getBoundingClientRect().top;}).slice(0,12):shellMotionTargets(page);
  page.setAttribute('data-shell-content-motion',targets.length?family+':'+(launch?'launch':'page'):'none');
  targets.forEach((el,i)=>{const base=getComputedStyle(el).transform,from=launch?'translateY(18px) scale(.96)':'translateY('+(backward?-12:14)+'px)';shellMotionAnimate(el,[{transform:from+(base==='none'?'':' '+base)},{transform:base}],launch?440:340,Math.min(i,7)*18);});
  if(targets.length)_shellMotionTimer=setTimeout(shellMotionReset,650);
}
function shellLocalPopupSnapshot(root){
  if(!root)return [];
  return Array.from(root.querySelectorAll('[class*="popover"],[class*="drawer"],[class*="-menu"],[class*="-panel"],[class*="-overlay"],[class*="-sheet"],[role="dialog"],[role="menu"]')).slice(0,32).filter(el=>{const css=getComputedStyle(el);return !el.closest('.chat-tools-panel')&&el.getClientRects().length&&css.display!=='none'&&css.visibility!=='hidden';});
}
function shellPartialMotion(root,c,before,panels){
  if(!root||!root.isConnected||!shellMotionAllowed()||shellMotionProfile(c,root)==='protected')return;
  const after=shellViewSignature(root,c);
  if(before!==after){
    root.setAttribute('data-shell-partial-motion','content');
    if(root.matches('#app>.page'))shellContentMotion(root,c,{old:_shellMotionLast,depth:stack.length});
    if(root.matches('#app>.page')&&_shellMotionLast&&_shellMotionLast.owner===S&&_shellMotionLast.account===actId())_shellMotionLast.view=after;
  }
  for(const panel of shellLocalPopupSnapshot(root)){if(panels.includes(panel)||panel.matches('.chat-tools-panel,.moment-action-popover,.moment-inline-compose'))continue;const input=panel.querySelector('input,textarea,select,canvas,video,iframe');shellMotionAnimate(panel,input?[{opacity:.85},{opacity:1}]:[{opacity:.85,transform:'translateY(12px)'},{opacity:1,transform:'none'}],260);}
}
function shellMotionFinish(c,app,plan){
  const view=shellViewSignature(app.firstElementChild,c);
  const panels=shellLocalPopupSnapshot(app.firstElementChild),panelKey=el=>el.id||String(el.className||'').replace(/\b(show|open|active)\b/g,'').trim(),panelKeys=panels.map(panelKey);
  if(plan.old&&plan.old.owner===S&&plan.old.account===actId()&&plan.old.page===c.p&&plan.old.panelKeys){for(const panel of panels){if(plan.old.panelKeys.includes(panelKey(panel))||panel.matches('.moment-action-popover')||panel.getAnimations().length)continue;const safe=panel.querySelector('input,textarea,video,canvas,iframe');shellMotionAnimate(panel,safe?[{opacity:.85},{opacity:1}]:[{opacity:.85,transform:'translateY(12px)'},{opacity:1,transform:'none'}],260);panel.setAttribute('data-shell-panel-motion','open');}}
  if(plan.old&&plan.old.owner===S&&plan.old.account===actId()&&plan.old.page===c.p&&plan.old.view!==undefined&&plan.old.view!==view)plan.changed=true;
  _shellMotionLast={key:plan.key,view:view,panelKeys:panelKeys,page:plan.page,depth:plan.depth,owner:plan.owner,account:plan.account,dyMeTab:String(typeof _dyMeTab==='undefined'?'':_dyMeTab),dyUserTab:String(typeof _dyUserTab==='undefined'?'':_dyUserTab)};
  shellSurfaceBind(app);shellMotionFramesMount(app.firstElementChild,c);
  if(typeof shellControlMount==='function')shellControlMount(c,app,plan);
  if(typeof wxInteractionMount==='function')try{if(wxInteractionMount(c,app,plan))return;}catch(_){if(typeof wxUiClear==='function')wxUiClear();}
  if(!plan.changed||!shellMotionAllowed())return;
  const page=app.firstElementChild;if(!page)return;
  const profile=shellMotionProfile(c,page);page.setAttribute('data-shell-motion-profile',profile);
  if(profile==='protected')return;
  if(profile==='live'){
    page.setAttribute('data-shell-motion','fade');shellMotionAnimate(page,[{opacity:.8},{opacity:1}],220);_shellMotionTimer=setTimeout(shellMotionReset,320);return;
  }
  // SHELL_STEADY_CONTENT_V2: the page root and headings keep their final coordinates.
  page.setAttribute('data-shell-motion',plan.old.page==='home'?'launch':c.p==='home'?'home':'content');
  shellContentMotion(page,c,plan);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){shellMotionReset();shellSurfaceClear();}});
if(typeof matchMedia==='function'){const preference=matchMedia('(prefers-reduced-motion: reduce)');if(preference.addEventListener)preference.addEventListener('change',()=>{if(preference.matches){shellMotionReset();shellSurfaceClear();}});}
function go(p,params){if(['gameshub','rphub','worldbook'].includes(p)&&typeof northPageArtWarm==='function')northPageArtWarm().catch(()=>{});if(p==='group'&&params&&params.id)wxChatRestore('group:'+params.id);if(p==='wxnearby'&&wxNearbyBlocked())return;stack.push(Object.assign({p},params));render();}
function back(){if(typeof window!=='undefined'&&window.NorthRunner&&NorthRunner.back())return;const leaving=cur();if(leaving&&leaving.p==='food'&&typeof northMarketBack==='function'&&northMarketBack())return;if(leaving&&leaving.p==='wxscan'&&window.wxScanStop)window.wxScanStop();if(stack.length>1){stack.pop();render();}}
function home(){if(window.wxScanStop)window.wxScanStop();window._wxReturnToDiscover=false;stack=[{p:'home'}];render();}
function cur(){return stack[stack.length-1];}
/* SHELL_PAGE_FALLBACK_NAV_V1：失效内容仍有安全返回，不调用未定义的旧nav助手。 */
function shellPageNav(title){return '<div class="nav"><button type="button" class="l" aria-label="返回" onclick="back()">‹</button><span class="t">'+esc(String(title||''))+'</span><span class="r"></span></div>';}
function renderPageKey(c){if(!c)return'';if(c.p==='chat')return'chat:'+c.id;if(c.p==='pfchat')return'pfchat:'+c.id;if(c.p==='pfgroup')return'pfgroup:'+c.gid;if(c.p==='group')return'group:'+c.id;if(c.p==='mgroom')return'mgroom:'+c.id;if(c.p==='hischat')return'hischat:'+c.id+':'+c.fid;if(c.p==='dydm')return'dydm:'+c.id;return c.p;}
function renderScrollTarget(c){if(!c)return null;if(c.p==='travel'&&typeof NorthTravelHotel!=='undefined'&&NorthTravelHotel.active())return NorthTravelHotel.scrollTarget();if(c.p==='hischat'&&c.fid==='__me')return{id:'hisselflog',stick:true};/* ROLE_FEATURES_KEEP_SCROLL_V1：角色「聊天与主动」等功能页重新画时停在原位置；以前后台检查一做完就重画，一往下滑就弹回顶部 */const map={healthcheck:['healthscroll',0],mcp:['mcpscroll',0],roleFeatures:['roleFeatureScroll',0],settings:['settingsscroll',0],couple:['couplescroll',0],wxmoment:['wxMomentScroll',0],wxalbum:['.wxalbum-page',0],wxfavorites:['.wxfav-page',0],spy:['spyAppScroll',0],x:['xscroll',0],dy:['dyfeed',0],wxnearby:['wxNearbyScroll',0],chat:['chatbg',1],pfchat:['pfchatbg',1],pfgroup:['pfgroupbg',1],group:['chatbg',1],mgroom:['mgrbg',1],alter:['alterbg',1],tale:['talebox',1],dread:['dreadbox',1],xdm:['xdmbox',1],dydm:['dydmbox',1],shopcs:['csbox',1],off:['offbg',1],rp:['rpbg',1],jail:['jailbox',1],gs:['gsbg',1],hischat:['hischatlog',1],phonesms:['smsbody',1],calllog:['cllog',0],shop:['.shop-scroll',0],mail:['.mail-scroll',0],travel:['.travel-scroll',0]};if(c.p==='dy'){const sub=typeof _dySub==='string'?_dySub:'';
    if(sub==='group')return{id:'.dyg-box',stick:true};/* 群聊要贴着底部，跟微信一样 */
    if(sub==='work')return{id:'.dywk-box',stick:false};}
  const x=map[c.p];return x?{id:x[0],stick:!!x[1]}:null;}
function nearBottom(el){return !el||Math.max(0,el.scrollHeight-el.scrollTop-el.clientHeight)<80;}
function chatPinBottom(cb){if(!cb)return;if(typeof wechatMotionScroll==='function'&&wechatMotionScroll(cb))return;const pin=()=>{if(!cb.isConnected)return;cb.scrollTop=Math.max(0,cb.scrollHeight-cb.clientHeight);};pin();requestAnimationFrame(pin);}
function appendChatHTML(cb,html,opt){if(!cb||!html)return null;opt=opt||{};const stick=nearBottom(cb),typing=opt.replaceTyping?cb.querySelector('#typing'):null;let node=null;
  if(typing&&typing.isConnected){typing.insertAdjacentHTML('afterend',html);node=typing.nextElementSibling;typing.remove();}
  else{cb.insertAdjacentHTML('beforeend',html);node=cb.lastElementChild;}
  if(node&&node.classList&&node.classList.contains('msg')&&opt.animate!==false)node.classList.add('msg-enter');
  if(stick)chatPinBottom(cb);return node;}
function appendChatMessageHTML(id,c,m,opt){const cb=$('#chatbg');if(!cb||!m)return null;const prev=chatPrevVisibleBefore(id,m),html=chatBoundaryHTML(prev,m)+bubbleRow(c,m),node=appendChatHTML(cb,html,opt||{});refreshChatMood(id);roleReadRefresh(id);return node;}
function chatMessageListHTML(id,c){const all=msgs(id).filter(m=>!(m.type==='ticket'&&m.trip&&m.trip.taxiV2&&typeof NorthTravelTaxi!=='undefined'&&!NorthTravelTaxi.visible(NorthTravelTaxi.current(m.trip)))&&!(m.type==='ticket'&&(m.trip&&m.trip.concertV2)&&typeof NorthConcertBooking!=='undefined'&&!NorthConcertBooking.visible(NorthConcertBooking.current(m.trip)))&&!(m.type==='ticket'&&m.trip&&m.trip.railV2&&typeof NorthTrainBooking!=='undefined'&&!NorthTrainBooking.visible(NorthTrainBooking.current(m.trip)))&&!m._call&&!(m.type==='ticket'&&m.trip&&m.trip.flightV2&&typeof NorthFlightBooking!=='undefined'&&!NorthFlightBooking.visible(NorthFlightBooking.current(m.trip))));all.forEach(m=>{if(!m.id)m.id=uid();});const renderLimit=CHAT_RENDER_LIMIT+(_chatRenderExtra[id]||0),skipped=Math.max(0,all.length-renderLimit),list=skipped?all.slice(skipped):all;let body=skipped?`<div class="tstamp"><span onclick="showOlderChat('${id}')" style="cursor:pointer">加载更早 ${Math.min(CHAT_RENDER_LIMIT,skipped)} 条 · 还剩 ${skipped} 条</span></div>`:'';let prevVisible=null;list.forEach(m=>{if(m._silent)return;body+=chatBoundaryHTML(prevVisible,m);body+=bubbleRow(c,m);if(m._mcpTrace)body+=MCPTools.chatTraceHTML(m,id);prevVisible=m;});return body;}
function naturalInnerThoughtText(value){if(typeof value!=='string')return'';const text=value.replace(/[\u200B-\u200F\u2060\uFEFF]/g,'').replace(/\s+/g,' ').trim();if(!text||/[\[\]【】<>]/.test(text)||/^(?:null|undefined|none|nan)$/i.test(text)||!text.replace(/[\s.…·，。！？!?、:：;；|｜\-_]/g,''))return'';return text.slice(0,120);}
function rememberValidInnerThought(c){if(!c)return false;const text=naturalInnerThoughtText(c.innerThought);if(!text||c.innerThoughtLastValid===text)return false;c.innerThoughtLastValid=text;c.innerThoughtLastValidAt=+c.innerThoughtAt||0;return true;}
function visibleRoleThought(c){if(!wechatNaturalOn())return String(c&&c.mood||'');if(!c)return'';if(rememberValidInnerThought(c)&&typeof save==='function')save(500);return naturalInnerThoughtText(c.innerThought)||naturalInnerThoughtText(c.innerThoughtLastValid);}
function refreshChatMood(id){if(cur().p!=='chat'||cur().id!==id)return false;const c=getC(id),bar=$('#chatMoodBar'),label=$('#chatMoodText');if(!c||!bar||!label)return false;const natural=wechatNaturalOn(),thought=visibleRoleThought(c),visible=S.settings.showMoodTag!==false;bar.style.display=visible?'flex':'none';bar.setAttribute('onclick',"toggleChatThought('"+id+"')");const full=$('#chatThoughtFullText');if(full)full.textContent=thought||'…';label.textContent=bar.getAttribute&&bar.getAttribute('aria-expanded')==='true'?'心声':thought?thought.slice(0,24)+(thought.length>24?'…':''):'…';return true;}
function refreshChatMessages(id){if(cur().p!=='chat'||cur().id!==id)return false;const cb=$('#chatbg'),c=getC(id);if(!cb||!c)return false;const stick=nearBottom(cb),top=cb.scrollTop;cb.innerHTML=chatMessageListHTML(id,c);refreshChatMood(id);if(stick)chatPinBottom(cb);else cb.scrollTop=top;return true;}
/* CHAT_COMPOSER_SESSION_V1: preserve the live editor, not just its text; never carry a native input session to another role/account. */
function chatComposerOwnsRoute(ta,c){return !!(ta&&ta.isConnected&&c&&c.p==='chat'&&ta._chatId===c.id&&ta._chatAccount===actId()&&ta._chatOwner===S);}
function chatComposerCopyAttributes(target,next,preserveStyle){for(const a of Array.from(target.attributes)){if(preserveStyle&&a.name==='style')continue;if(!next.hasAttribute(a.name))target.removeAttribute(a.name);}for(const a of Array.from(next.attributes)){if(preserveStyle&&a.name==='style')continue;if(target.getAttribute(a.name)!==a.value)target.setAttribute(a.name,a.value);}}
function chatComposerPatchPage(c,app,html,className,st){
 if(!st||c.p!=='chat')return false;
 const ta=app.querySelector('#cinput'),page=app.firstElementChild,bar=ta&&ta.closest('.chat-inputbar');
 if(!chatComposerOwnsRoute(ta,c)||!page||!bar||bar.parentNode!==page)return false;
 const next=document.createElement('div');next.innerHTML=html;
 const nextInput=next.querySelector('#cinput'),nextBar=nextInput&&nextInput.closest('.chat-inputbar');
 // Locking, selection and login screens must still remove the editable composer immediately.
 if(!nextInput||!nextBar||nextBar.parentNode!==next)return false;
 if(bar.childNodes.length!==nextBar.childNodes.length)return false;
 const oldChildren=Array.from(bar.childNodes),newChildren=Array.from(nextBar.childNodes);
 if(oldChildren.indexOf(ta)!==newChildren.indexOf(nextInput))return false;
 page.className=className;chatComposerCopyAttributes(bar,nextBar,false);chatComposerCopyAttributes(ta,nextInput,true);
 for(let i=0;i<oldChildren.length;i++)if(oldChildren[i]!==ta)bar.replaceChild(newChildren[i],oldChildren[i]);
 const before=document.createDocumentFragment(),after=document.createDocumentFragment();let passed=false;
 for(const node of Array.from(next.childNodes)){if(node===nextBar){passed=true;continue;}(passed?after:before).appendChild(node);}
 for(const node of Array.from(page.childNodes))if(node!==bar)page.removeChild(node);
 page.insertBefore(before,bar);page.appendChild(after);
 return true;
}
function captureChatComposer(c){if(!c||!['chat','music'].includes(c.p))return null;const ta=$(c.p==='music'?'#m_chat':'#cinput');if(!ta||c.p==='chat'&&!chatComposerOwnsRoute(ta,c))return null;let start=null,end=null;try{start=ta.selectionStart;end=ta.selectionEnd;}catch(_){}return{key:renderPageKey(c),value:ta.value||'',start,end,focused:document.activeElement===ta,height:ta.style.height||'',scrollTop:ta.scrollTop||0};}
function restoreChatComposer(c,st){if(!st||!c||st.key!==renderPageKey(c))return;const ta=$(c.p==='music'?'#m_chat':'#cinput');if(!ta)return;ta.value=st.value;ta.style.height=st.height||'auto';ta.scrollTop=st.scrollTop||0;if(c.p==='chat'&&typeof chatComposerStateSync==='function')chatComposerStateSync(ta);if(st.start!=null)try{ta.setSelectionRange(st.start,st.end==null?st.start:st.end);}catch(_){}if(st.focused)try{ta.focus({preventScroll:true});if(st.start!=null)ta.setSelectionRange(st.start,st.end==null?st.start:st.end);}catch(_){} }
function renderScrollStateKey(c,el){return String(el&&el.getAttribute&&el.getAttribute('data-render-scroll-key')||renderPageKey(c));}
function renderScrollElement(t){return !t?null:(String(t.id).charAt(0)==='.'?document.querySelector(t.id):document.getElementById(t.id));}
function captureRenderScroll(c){const t=renderScrollTarget(c);if(!t)return null;const el=renderScrollElement(t);if(!el)return{key:renderPageKey(c),id:t.id,had:false};const bottom=Math.max(0,el.scrollHeight-el.scrollTop-el.clientHeight);return{key:renderScrollStateKey(c,el),id:t.id,had:true,top:el.scrollTop,bottom,nearBottom:bottom<80||!!(typeof _wechatMotion!=='undefined'&&_wechatMotion&&_wechatMotion.box===el&&_wechatMotion.animating&&_wechatMotion.follow)};}
function restoreRenderScroll(c,st){const t=renderScrollTarget(c);if(!t)return;const el=renderScrollElement(t);if(!el)return;const key=renderScrollStateKey(c,el);if(typeof _chatJump!=='undefined'&&_chatJump&&_chatJump.key===key){const mid=_chatJump.mid;_chatJump=null;if(typeof chatJumpToMessage==='function'&&chatJumpToMessage(el,mid)){if(_scrollBottomOnce)delete _scrollBottomOnce[key];return;}}const force=_scrollBottomOnce&&_scrollBottomOnce[key];if(force){delete _scrollBottomOnce[key];requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight;});el.scrollTop=el.scrollHeight;return;}const same=st&&st.had&&st.key===key&&st.id===t.id;if(t.stick){if(same&&st.nearBottom&&typeof _wechatMotion!=='undefined'&&_wechatMotion&&_wechatMotion.box===el&&_wechatMotion.added)wechatMotionScroll(el,st.top);else if(!same||st.nearBottom)el.scrollTop=el.scrollHeight;else el.scrollTop=st.top;}else if(same){el.scrollTop=st.top;requestAnimationFrame(()=>{if(el.isConnected)el.scrollTop=st.top;});}}
function render(){
//@@ web
  const c=cur();wxMarkPageSeen(c);const app=$('#app'),_renderStarted=privateNativeAppOn()?(typeof performance!=='undefined'&&performance.now?performance.now():Date.now()):0;
//@@ private
  const c=cur();wxMarkPageSeen(c);if(typeof licenseNoteRouteActivity==='function')licenseNoteRouteActivity();const app=$('#app'),_renderStarted=privateNativeAppOn()?(typeof performance!=='undefined'&&performance.now?performance.now():Date.now()):0;
//@@ end
  hisPaymentsExpire();
  if(typeof coupleWatchTick==='function')coupleWatchTick();
  if(typeof pixelHomeKeepFrame==='function'&&pixelHomeKeepFrame())return;
//@@ private
  if(typeof cozyHomeKeepFrame==='function'&&cozyHomeKeepFrame())return;
//@@ end
  applyAppleHomeCompat();
  applyGlassTheme();
  let _shellPlan=null;try{_shellPlan=shellMotionPrepare(c,app);}catch(_){shellMotionReset();}
  const _sb=$('#statusbar');if(_sb)_sb.className='statusbar'+(c.p==='home'?'':' dark');
  const _scrollState=captureRenderScroll(c),_composerState=captureChatComposer(c);
  let html='';
  if(c.p==='home')html=renderHome();
  else if(c.p==='music')html=renderMusic();
  else if(c.p==='cinema')html=renderCinema();
  else if(c.p==='cinemawatch')html=renderCinemaWatch();
  else if(c.p==='cinemaread')html=renderCinemaRead();
  else if(c.p==='settings')html=renderSettings();
  else if(c.p==='mcp')html=MCPTools.render();
  else if(c.p==='healthcheck')html=renderHealthCheck();
  else if(c.p==='album'||c.p==='aiaccount')html=renderPhotoAlbum();
  else if(c.p==='worldbook')html=renderWorldbook();
  else if(c.p==='wechat')html=renderWeChat();
  else if(c.p==='wxmoment')html=renderWxMomentFeed();
  else if(c.p==='wxlive')html=renderWxLive();
  else if(c.p==='wxnearby')html=renderWxNearby();
  else if(c.p==='wxprofile')html=renderWxProfile();
  else if(c.p==='wxqr')html=renderWxQr();
  else if(c.p==='wxscan')html=renderWxScan();
  else if(c.p==='wxservices')html=renderWxServices();
  else if(c.p==='wxsmarthome')html=renderWxSmartHome();
//@@ private
  else if(c.p==='robotFace'&&typeof renderRobotFace==='function')html=renderRobotFace();
//@@ end
  else if(c.p==='wxwallet')html=renderWxWallet();
  else if(c.p==='wxchange')html=renderWxChange();
  else if(c.p==='wxbank')html=renderWxBank();
  else if(c.p==='wxfamily')html=renderWxFamily();
  else if(c.p==='wxbills')html=renderWxBills();
  else if(c.p==='wxsupport')html=renderWxSupport();
  else if(c.p==='wxfavorites')html=renderWxFavorites();
  else if(c.p==='wxalbum')html=renderWxAlbum();
  else if(c.p==='wxemoji')html=renderWxEmoji();
  else if(c.p==='wxbubbles'&&typeof renderWxBubbleSettings==='function')html=renderWxBubbleSettings();
  else if(c.p==='wxsettings')html=renderWxSettings();
  else if(c.p==='wxaccounts')html=renderWxAccounts();
  else if(c.p==='wxsteps')html=renderWxSteps();
  else if(c.p==='newfriends')html=renderNewFriends();
  else if(c.p==='wxonlychat')html=renderWxOnlyChat();
  else if(c.p==='wxgroups')html=renderWxGroups();
  else if(c.p==='wxlabels')html=renderWxLabels();
  else if(c.p==='wxgroupcreate')html=renderWxGroupCreate();
  else if(c.p==='contactEdit')html=renderContactEditor(c.id,c.isNew);
  else if(c.p==='chat')html=renderChat(c.id);
  else if(c.p==='transferDetail')html=renderTransferDetail(c.id,c.mid);
  else if(c.p==='groupTransferDetail')html=renderGroupTransferDetail(c.id,c.mid);
  else if(c.p==='rpSend')html=renderRpSend(c);
  else if(c.p==='grpSend')html=renderGroupRpSend(c);
  else if(c.p==='tfSend')html=renderTfSend(c);
  else if(c.p==='rpDetail')html=renderRpDetail(c);
  else if(c.p==='livemap')html=renderLiveMap(c.id,c.mid);
  else if(c.p==='pffriends')html=renderPhoneFriends();
  else if(c.p==='pfchat')html=renderPhoneFriendChat(c.id);
  else if(c.p==='pfgroup')html=renderPhoneFriendGroup(c.gid);
  else if(c.p==='group')html=renderGroup(c.id);
  else if(c.p==='ginfo')html=renderGroupInfoPage(c.kind,c.id);
  else if(c.p==='gpick')html=renderGroupPick(c.kind,c.id,c.mode);
  else if(c.p==='gmanage')html=renderGroupManagePage(c.kind,c.id);
  else if(c.p==='gsettings')html=renderGroupSettingsPage(c.id);
  else if(c.p==='relnet')html=renderRelNet(c);
  else if(c.p==='reledit')html=renderRelEdit();
  else if(c.p==='relperson')html=renderRelPerson(c);
  else if(c.p==='hiscard')html=renderHisCard(c);
  else if(c.p==='gqr')html=renderGroupQrPage(c.kind,c.id);
  else if(c.p==='gsearch')html=renderGroupSearchPage(c.kind,c.id);
  else if(c.p==='couple')html=renderCouple();
  else if(c.p==='jail')html=renderJail();
  else if(c.p==='wg')html=renderWG();
  else if(c.p==='mail')html=renderMail();
  else if(c.p==='mailRead')html=renderMailRead(c);
  else if(c.p==='mailWrite')html=typeof renderMailWrite==='function'?renderMailWrite():'';
  else if(c.p==='phoneapp')html=renderPhoneApp();
  else if(c.p==='phonesms')html=renderPhoneSMS(c.num,c.sk);
  else if(c.p==='phonecontact')html=renderPhoneContact(c.num);
  else if(c.p==='phonecall')html=renderPhoneCall();
  else if(c.p==='gameshub')html=renderGameHub();
  else if(c.p==='pixelhome')html=renderPixelHome();
//@@ private
  else if(c.p==='cozyhome')html=renderCozyHome();
//@@ end
  else if(c.p==='heartquiz')html=renderHeartQuiz();
  else if(c.p==='beadstudio')html=typeof renderBeadStudio==='function'?renderBeadStudio():'<div class="empty">像素拼拼乐组件尚未载入</div>';
  else if(c.p==='pet')html=renderPetGame();
  else if(c.p==='gs')html=renderGS();
  else if(c.p==='drawguess')html=renderDrawGuess();
  else if(c.p==='mgroom')html=renderMGRoom(c.id);
  else if(c.p==='uc')html=renderUC();
  else if(c.p==='calllog')html=renderCallLog(c.id);
  else if(c.p==='offline')html=renderOfflineHub();
  else if(c.p==='off')html=renderOff(c.id,c.mode);
  else if(c.p==='offlast')html=renderOffLast(c.id);
  else if(c.p==='rphub')html=renderRPHub();
  else if(c.p==='rpset')html=renderRPSetup(c.id);
  else if(c.p==='rp')html=renderRP(c.id);
  else if(c.p==='browser')html=renderBrowser();
  else if(c.p==='contactInfo')html=renderContactInfo(c.id);
  else if(c.p==='chatDetails')html=renderChatDetails(c.id);
  else if(c.p==='friendInfo')html=renderFriendInfo(c.id);
  else if(c.p==='roleImageStudio')html=renderRoleImageStudio(c.id);
  else if(c.p==='contactSettings')html=renderContactSettings(c.id);
  else if(c.p==='roleMoments')html=renderRoleMoments(c.id);
  else if(c.p==='roleMomentDetail')html=renderRoleMomentDetail(c.id,c.pid);
  else if(c.p==='roleFeatures')html=renderRoleManagement(c.id,c.group);
  else if(c.p==='deskPet')html=typeof renderDeskPetPage==='function'?renderDeskPetPage():'';
  else if(c.p==='hislogin')html=renderHisLogin(c.id);
  else if(c.p==='hiswx')html=renderHisWx();
  else if(c.p==='hismoments')html=renderHisWxMoments(c.id);
  else if(['hisservices','hiswallet','hischange','hisbills','hisfavorites','hisalbum'].includes(c.p))html=renderHisWxUtility(c.id,c.p.slice(3));
  else if(c.p==='hischat')html=renderHisChat(c.id,c.fid);
  else if(c.p==='alter')html=renderAlter(c.x,c.y);
  else if(c.p==='wxsearch')html=renderWxSearch(c.id);
  else if(c.p==='spy')html=renderSpy(c.id);
  else if(c.p==='tale')html=renderTale();
  else if(c.p==='dread')html=renderDread();
  else if(c.p==='shop')html=renderShop();
  else if(c.p==='shopcs')html=renderShopCS();
  else if(c.p==='food')html=renderFood();
  else if(c.p==='travel')html=renderTravel();
  else if(c.p==='calendar')html=renderCalendar();
  else if(c.p==='calendarShared')html=renderCalShared(c);
  else if(c.p==='calendarDetail')html=renderCalDetail(c);
  else if(c.p==='x')html=renderX();
  else if(c.p==='xtweet')html=renderXTweet(c.id);
  else if(c.p==='xdm')html=renderXDM(c.id);
  else if(c.p==='xuser')html=renderXUser(c.name);
  else if(c.p==='dy')html=renderDouyin();
  else if(c.p==='tasks')html=renderTasks();
  else if(c.p==='dydm')html=renderDyDM(c.id);
  else if(c.p==='dyuser')html=dyUserView();
  else if(c.p==='dywork')html=dyWorkView()+dyCmLayer();
  else if(c.p==='dypost')html=renderDyPost();
  else if(c.p==='momentDetail')html='';
  else if(typeof window!=='undefined'&&window.NorthExtraPages&&typeof window.NorthExtraPages[c.p]==='function')html=window.NorthExtraPages[c.p]();
  const _wxGlassPages=['wechat','wxmoment','wxlive','wxnearby','wxprofile','wxqr','wxscan','wxservices','wxsmarthome','wxwallet','wxchange','wxbank','wxfamily','wxbills','wxsupport','wxfavorites','wxalbum','wxemoji','wxsettings','wxaccounts','wxsteps','chat','transferDetail','groupTransferDetail','chatDetails','contactInfo','friendInfo','contactSettings','roleMoments','roleMomentDetail','roleFeatures','roleImageStudio','newfriends','wxonlychat','wxgroups','wxlabels','wxgroupcreate','contactEdit','wxsearch','pffriends','pfchat','pfgroup','group'];
  const _isWxPage=_wxGlassPages.includes(c.p);
  const _glass=glassThemeOn()&&!_isWxPage?' glass-app':'';
  const _wxG='';
  const _settingsAppearance=c.p==='settings'||c.p==='shortcutSettings';document.body.toggleAttribute('data-settings-appearance',_settingsAppearance);
  const _setG=(glassThemeOn()&&c.p==='settings'?' settings-glass':'')+(_settingsAppearance?' settings-appearance':'');
  const _wxLightBase=['wechat','wxsearch','chat','pfchat','pfgroup','group','chatDetails','contactInfo','friendInfo','contactSettings','roleMoments','roleMomentDetail','roleFeatures'].includes(c.p)||c.p==='roleImageStudio'||c.p==='transferDetail'||c.p==='groupTransferDetail'||c.p==='grpSend'||c.p==='rpSend'||c.p==='tfSend'||c.p==='rpDetail';
  const _wxLightDirectory=['wxmoment','wxlive','wxnearby','wxprofile','wxqr','wxscan','wxservices','wxsmarthome','wxwallet','wxchange','wxbank','wxfamily','wxbills','wxsupport','wxfavorites','wxalbum','wxemoji','wxsettings','wxaccounts','wxsteps','newfriends','wxonlychat','wxgroups','wxlabels','wxgroupcreate','contactEdit','hiscard','pffriends','pfchat','pfgroup','group','ginfo','gpick','gqr','gsearch','gmanage','gsettings','relnet','reledit','relperson'].includes(c.p);
  document.body.toggleAttribute('data-wechat-switches',_isWxPage||_wxLightBase||_wxLightDirectory||['hiswx','hischat','hislogin','hismoments','hisservices','hiswallet','hischange','hisbills','hisfavorites','hisalbum'].includes(c.p)||(c.p==='spy'&&_spyApp==='wechat'));
  const _wxL=(S.me.wxTheme==='white'&&(_wxLightBase||_wxLightDirectory))?' wxlight':'';
  const _wxStandalonePremium=['wxprofile','wxqr','wxscan','wxservices','wxsmarthome','wxwallet','wxchange','wxbank','wxfamily','wxbills','wxsupport','wxfavorites','wxalbum','wxemoji','wxsettings','wxaccounts','wxsteps'].includes(c.p);
  const _wxP=(c.p==='wechat'||_wxStandalonePremium)?' wx-premium':['chat','pfchat','pfgroup','group'].includes(c.p)?' wx-chat-premium':'';
  const _wxSection=c.p==='wechat'?' wx-'+String(wxTab==='moments'?'discover':(wxTab||'chats')):'';
  const _wxFont=S.me&&S.me.wxFeatures&&S.me.wxFeatures.fontScale!=='normal'?' wx-font-'+S.me.wxFeatures.fontScale:'';
  const _pageClass='page'+_glass+_wxG+_setG+_wxL+_wxP+_wxSection+_wxFont;
  const _composerKept=chatComposerPatchPage(c,app,html,_pageClass,_composerState);
  if(!_composerKept){
    const active=document.activeElement;if(active&&active.id==='cinput')active.blur();
    app.innerHTML='<div class="'+_pageClass+'">'+html+'</div>';
  }
  if(typeof MCPTools!=='undefined'&&typeof MCPTools.syncOfficial==='function')setTimeout(()=>MCPTools.syncOfficial(),0);
  // SETTINGS_STEADY_PAINT_V1：先筛选设置分类，再恢复滚动和播放动画，不露出其他分类一帧。
  if(c.p==='settings')settingsCategoryApply();
  if(c.p==='spy'&&!_spyApp)requestAnimationFrame(()=>spyHomeMount(c.id));
  if(c.p==='music'){const b=app.querySelector('.music-app-head>button:first-child');if(b)b.onclick=back;}
  if(c.p==='browser'){const b=app.querySelector('.br-nav .l');if(b)b.onclick=back;}
  if(c.p==='gameshub'){const b=app.querySelector('.gamehub-nav .l');if(b)b.onclick=back;}
  /* Private App pages keep stored images as short idb: references. Restore
     already-cached sources in the same paint so a busy event loop cannot leave
     the freshly rebuilt page black until a later timer gets CPU time. */
  if(lazyStoredImagesOn())hydrateStoredImageNodes();
  if(lazyStoredImagesOn())hydrateRouteCriticalStoredImages();
  if(typeof secretFieldsMount==='function')secretFieldsMount(app);
  chatRouteMount(c);
  if(['wxmoment','wxlive','wxnearby','newfriends','wxonlychat','wxgroups','wxlabels','wxgroupcreate','contactEdit'].includes(c.p)&&app.firstElementChild)app.firstElementChild.classList.add('wx-directory-page');
  if(c.p==='drawguess'){const usage=$('#useBadge');if(usage)usage.style.display='none';}
  renderLockScreen();renderLockPull();
  if(c.p==='chat'){afterChat(c.id);}
  if(c.p==='group'||c.p==='pfgroup'||c.p==='pfchat')afterGroupComposer(c);
  if(!_composerKept)restoreChatComposer(c,_composerState);
  if(c.p==='cinemawatch')cinemaAfterVideoRender();
  if(c.p==='cinemaread')cinemaAfterReaderRender();
  if(c.p==='drawguess')requestAnimationFrame(dgMount);
  wechatMotionMount(c);naturalMotionTransientScan();momentReplyMotionScan();
  restoreRenderScroll(c,_scrollState);
  if((c.p==='tale'&&S.tale&&S.tale.active)||(c.p==='dread'&&S.dread&&S.dread.active)){setTimeout(jailAmbientStart,40);}
  else if(c.p!=='jail'){jailAmbientStop();}
  if(c.p==='music'){if(S.music&&S.music.session&&S.music.session.startTs){if(!_mSessTimer)_mSessTimer=setInterval(mSessTick,1000);mSessTick();}else if(_mSessTimer){clearInterval(_mSessTimer);_mSessTimer=null;}requestAnimationFrame(()=>{mTick();if(_ma&&!_ma.paused)mLyricLoopStart();});}
  if(c.p==='wechat'&&wxTab==='moments'){}
  if(c.p==='home')homeRestorePage();
  if(c.p==='roleImageStudio')setTimeout(()=>roleImageStudioWarm(c.id),0);
  if(c.p==='phonesms'&&typeof phInvMountAll==='function')requestAnimationFrame(phInvMountAll);/* 隐形墨水的沙子要重新盖上 */
  if(c.p==='phonesms'&&typeof phFxSwellAll==='function')requestAnimationFrame(phFxSwellAll);/* 被字撑大的气泡要重新量 */
  const _imageRouteKey=renderPageKey(c),_imageRouteChanged=_imageRouteKey!==_visibleImageRouteKey;_visibleImageRouteKey=_imageRouteKey;
  scheduleVisibleStoredImages(_imageRouteChanged,true);
  if(_shellPlan)try{shellMotionFinish(c,app,_shellPlan);}catch(_){shellMotionReset();}
  if(_renderStarted)northNativePerformanceSample('render-'+c.p,(typeof performance!=='undefined'&&performance.now?performance.now():Date.now())-_renderStarted);
}

/* ---------- 主屏幕 ---------- */
