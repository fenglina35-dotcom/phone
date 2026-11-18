function wxUiPanelMotion(panel,open){
  if(!open)panel.setAttribute('data-wx-ui-closing','');
  const prior=panel._wxUiMotion,current=prior?panel.getBoundingClientRect().height:0;
  if(prior)prior.cancel();
  if(!shellMotionAllowed()){panel.removeAttribute('data-wx-ui-closing');return;}
  if(!open)panel.setAttribute('data-wx-ui-closing','');
  const full=panel.getBoundingClientRect().height;
  const from=prior?current:open?0:full,to=open?full:0;
  let animation;const finish=()=>{if(panel._wxUiMotion===animation){panel._wxUiMotion=null;panel.removeAttribute('data-wx-ui-closing');_wxUiMovingPanels.delete(panel);}};
  animation=wxUiAnimate(panel,[{height:from+'px',minHeight:'0px',opacity:open?.45:1},{height:to+'px',minHeight:'0px',opacity:open?1:0}],open?380:300,0,finish);
  panel._wxUiMotion=animation;if(animation)_wxUiMovingPanels.add(panel);else{panel.removeAttribute('data-wx-ui-closing');_wxUiMovingPanels.delete(panel);}
}
function wxInteractionPanels(page,key){
  _wxUiPanels.forEach(o=>o.disconnect());_wxUiPanels=[];
  page.querySelectorAll('.chat-tools-panel').forEach(panel=>{
    const id=panel.id||'panel';const update=()=>{if(!panel.isConnected||!_wxUiLast||_wxUiLast.key!==key||_wxUiLast.owner!==S||_wxUiLast.account!==actId())return;
      const open=panel.classList.contains('show'),kind=panel.dataset.page||'fn',state=open?kind:'closed',old=_wxUiPanelStates[id];_wxUiPanelStates[id]=state;
      const bar=page.querySelector('.chat-inputbar');if(bar){const more=bar.querySelector('.chat-function-toggle'),emoji=bar.querySelector('.chat-emoji-toggle');if(more)more.setAttribute('aria-expanded',String(open&&kind==='fn'));if(emoji)emoji.setAttribute('aria-expanded',String(open&&kind==='emoji'));}
      if(old!==state&&old!==undefined){
        if(open&&old==='closed'||!open)wxUiPanelMotion(panel,open);
        const more=page.querySelector('.chat-function-toggle>span');
        if(more){const start=getComputedStyle(more).transform;more.getAnimations().forEach(a=>a.cancel());const expanded=open&&kind==='fn';wxUiAnimate(more,[{transform:start},{transform:'rotate('+(expanded?53:-7)+'deg)',offset:.72},{transform:'rotate('+(expanded?45:0)+'deg)'}],420);}
        if(open){const pane=panel.querySelector('.chat-panel-pane.on')||panel;wxUiAnimate(pane,[{opacity:.2,transform:'translateY(22px)'},{opacity:1,transform:'none'}],380);
          if(kind==='fn')Array.from(pane.querySelectorAll('.chat-function-page:first-child>.it')).slice(0,8).forEach((item,i)=>wxUiAnimate(item,[{opacity:0,transform:'translateY(12px) scale(.94)'},{opacity:1,transform:'none'}],300,40+i*18));}
      }
    };
    const observer=new MutationObserver(()=>{try{update();}catch(_){}});observer.observe(panel,{attributes:true,attributeFilter:['class','data-page']});_wxUiPanels.push(observer);update();
  });
}
/* WECHAT_CALL_PAYMENT_MOTION_V1：只动画通话装饰/控制与支付呈现，不调用通话或支付动作。 */
let _wxCallUiRecord=null;
const _wxCallUiJobs=new Set();
function wxCallUiClear(){_wxCallUiJobs.forEach(a=>{try{a.cancel();}catch(_){}});_wxCallUiJobs.clear();const layer=document.getElementById('callLayer');if(layer)layer.querySelectorAll('[data-wx-call-waiting]').forEach(el=>el.removeAttribute('data-wx-call-waiting'));}
function wxCallUiAnimate(el,frames,duration,delay){
  if(!el||!el.isConnected||!shellMotionAllowed())return;
  try{const a=el.animate(frames,{duration:duration||460,delay:delay||0,easing:'cubic-bezier(.2,.85,.25,1)',fill:'backwards'});_wxCallUiJobs.add(a);const done=()=>_wxCallUiJobs.delete(a);a.onfinish=done;a.oncancel=done;}catch(_){}
}
function wxCallInteractionMount(layer){
  const call=typeof _call==='undefined'?null:_call,visible=layer.classList.contains('show');
  if(!call||!visible||call.cohab||call.accountId&&call.accountId!==actId()){wxCallUiClear();_wxCallUiRecord=null;return;}
  wxInteractionStyle();
  if(call._motionPreview&&typeof NORTH_PREVIEW!=='undefined'&&NORTH_PREVIEW)layer.querySelectorAll('.cbtn.red').forEach(button=>{button.onclick=wxInteractionPreviewCallEnd;});
  const key=String(call.session||call.id)+':'+call.kind+':'+call.state+':'+(call.min?'mini':'full'),old=_wxCallUiRecord;
  if(!shellMotionAllowed()){wxCallUiClear();_wxCallUiRecord={key:key,owner:S,account:actId()};return;}
  _wxCallUiJobs.forEach(a=>{if(!a.effect||!a.effect.target||!a.effect.target.isConnected)a.cancel();});
  if(old&&old.key===key&&old.owner===S&&old.account===actId())return;
  wxCallUiClear();_wxCallUiRecord={key:key,owner:S,account:actId()};
  layer.setAttribute('data-wx-call-motion',call.min?'mini':call.state);
  if(call.min){wxCallUiAnimate(layer.querySelector('.cav'),[{opacity:.2,scale:'.7'},{opacity:1,scale:'1'}],360);return;}
  const avatar=layer.querySelector(':scope>.cav');
  if(avatar){
    // 不缩放承载角色视频的容器；等待光环只是无点击装饰，最多呼吸两轮。
    if(!avatar.querySelector('video,canvas,iframe'))wxCallUiAnimate(avatar,[{opacity:.1,transform:'translateY(22px) scale(.84)'},{opacity:1,transform:'translateY(-3px) scale(1.025)',offset:.74},{opacity:1,transform:'none'}],560);
    if(call.state!=='active')avatar.setAttribute('data-wx-call-waiting','true');
  }
  layer.querySelectorAll('.callbtns>.cbtncol,.call-camera-tools,.call-screen-tools').forEach((el,i)=>wxCallUiAnimate(el,[{opacity:0,transform:'translateY(36px) scale(.9)'},{opacity:1,transform:'none'}],480,100+Math.min(i,5)*45));
}
function wxPaymentInteractionMount(page,c){
  if(!['tfSend','rpSend','transferDetail','groupTransferDetail'].includes(c.p))return;
  page.setAttribute('data-wx-payment-motion','enter');
  if(c.p==='tfSend')page.querySelectorAll('.wx-tfs-keys>button').forEach((key,i)=>wxUiAnimate(key,[{opacity:0,transform:'translateY(32px) scale(.94)'},{opacity:1,transform:'none'}],430,100+Math.floor(i/4)*50+(i%4)*14));
}
function wxInteractionPreviewCallEnd(){if(typeof NORTH_PREVIEW==='undefined'||!NORTH_PREVIEW||typeof _call==='undefined'||!_call||!_call._motionPreview)return false;_call=null;renderCall();return true;}
function wxInteractionPreviewCall(){
  if(typeof NORTH_PREVIEW==='undefined'||!NORTH_PREVIEW||!['localhost','127.0.0.1'].includes(location.hostname))return;
  if(typeof _call==='undefined'||_call&&!_call._motionPreview)return;
  const contact=getC('preview_1')||S.contacts[0];if(!contact)return;
  _call={id:contact.id,accountId:actId(),kind:'voice',state:'outgoing',dir:'outgoing',opened:true,session:'wx-motion-preview',_motionPreview:true,sub:null};renderCall();
}
/* WECHAT_ROLE_SLIDE_ENTRY_V1: one coherent page enters from the right; the name shares its motion. */
let _wxRoleEntry=null;
function wxRoleEntryGhost(c,app,old){
  if(c.p!=='chat'||!old||!['wechat','contactInfo'].includes(old.page))return null;
  const page=app.firstElementChild;if(!page||page.querySelectorAll('*').length>650||page.querySelector('video,audio,iframe,canvas'))return null;
  const ghost=page.cloneNode(true),original=[page,...page.querySelectorAll('*')],copies=[ghost,...ghost.querySelectorAll('*')],scrolls=[];
  original.forEach((el,i)=>{if(copies[i]&&(el.scrollTop||el.scrollLeft))scrolls.push({node:copies[i],top:el.scrollTop,left:el.scrollLeft});});
  Array.from(ghost.querySelectorAll('input,textarea,select,[contenteditable]')).forEach(el=>{const block=document.createElement('span');block.style.cssText='display:inline-block;min-height:1em;min-width:3em';el.replaceWith(block);});
  [ghost,...ghost.querySelectorAll('*')].forEach(el=>{Array.from(el.attributes).forEach(a=>{if(['id','name','for','autofocus','data-wx-ui-pressed'].includes(a.name)||a.name.startsWith('on'))el.removeAttribute(a.name);});if(el.matches('button,a,[tabindex]'))el.setAttribute('tabindex','-1');});
  ghost.querySelectorAll('script,style,link,object,embed').forEach(el=>el.remove());ghost.classList.add('shell-motion-ghost');ghost.setAttribute('inert','');ghost.setAttribute('aria-hidden','true');
  return {node:ghost,scrolls};
}
function wxRoleEntryClear(){
  const rec=_wxRoleEntry;if(!rec)return;_wxRoleEntry=null;clearTimeout(rec.timer);if(rec.page)rec.page.removeAttribute('data-wx-role-entry');
  if(rec.animation)rec.animation.cancel();if(rec.ghostAnimation)rec.ghostAnimation.cancel();if(rec.ghost)rec.ghost.remove();
}
function wxRoleEntryMount(c,app,plan){
  const page=app.firstElementChild,key=plan.key,now=performance.now();
  if(!shellMotionAllowed()){wxRoleEntryClear();return false;}
  let rec=_wxRoleEntry;
  if(rec&&(rec.owner!==S||rec.account!==actId()||rec.key!==key)){wxRoleEntryClear();rec=null;}
  if(!rec){
    if(c.p!=='chat'||!plan.old||!['wechat','contactInfo'].includes(plan.old.page))return false;
    rec={owner:S,account:actId(),key,start:now,duration:360,width:app.getBoundingClientRect().width,page:null,animation:null,ghost:plan.roleGhost&&plan.roleGhost.node,timer:0,ghostAnimation:null};_wxRoleEntry=rec;
    if(rec.ghost){app.appendChild(rec.ghost);plan.roleGhost.scrolls.forEach(s=>{s.node.scrollTop=s.top;s.node.scrollLeft=s.left;});rec.ghostAnimation=rec.ghost.animate([{transform:'none',opacity:1},{transform:'translateX('+(-rec.width*.16)+'px)',opacity:.8}],{duration:rec.duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});}
    rec.timer=setTimeout(()=>{if(_wxRoleEntry===rec)wxRoleEntryClear();},rec.duration+100);
  }
  if(now-rec.start>=rec.duration){wxRoleEntryClear();return false;}
  if(rec.page!==page){
    const prior=rec.animation;rec.animation=null;if(prior)prior.cancel();rec.page=page;page.setAttribute('data-wx-role-entry','slide-left');
    const a=page.animate([{transform:'translateX('+rec.width+'px)'},{transform:'none'}],{duration:rec.duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});rec.animation=a;a.currentTime=Math.max(0,now-rec.start);a.onfinish=()=>{if(_wxRoleEntry===rec&&rec.animation===a)wxRoleEntryClear();};
  }
  return true;
}
function wxInteractionMount(c,app,plan){
  const previous=_wxUiLast,page=app.firstElementChild,inside=wxInteractionPage(c);
  const key=shellMotionRoute(c);
  const same=previous&&previous.owner===S&&previous.account===actId(),changed=!!same&&(previous.key!==key||c.p==='wechat'&&previous.tab!==wxTab);
  if(!inside||!page){if(previous)wxUiClear();_wxUiLast=null;_wxUiPanels.forEach(o=>o.disconnect());_wxUiPanels=[];_wxUiPanelStates={};return false;}
  wxInteractionStyle();if(changed||!same){wxUiClear();_wxUiPanelStates={};}
  if(!shellMotionAllowed())wxUiClear();
  _wxUiJobs.forEach(a=>{if(!a.effect||!a.effect.target||!a.effect.target.isConnected)a.cancel();});if(_wxUiPress&&!_wxUiPress.el.isConnected)wxUiRelease();
  page.classList.add('wx-ui-scope');_wxUiLast={key:key,page:c.p,tab:wxTab,quick:!!_wxQuickOpen,owner:S,account:actId(),depth:stack.length};
  const tabs=['chats','contacts','moments','me'],tabbar=page.querySelector('.wx-main-tabbar'),tabIndex=tabs.indexOf(wxTab);
  if(tabbar&&tabIndex>=0){
    const marker=document.createElement('i');marker.className='wx-ui-tab-glide';marker.setAttribute('aria-hidden','true');marker.style.left='calc('+tabIndex*25+'% + 11px)';tabbar.appendChild(marker);
    if(changed&&previous.page==='wechat'&&c.p==='wechat'){
      const distance=(tabs.indexOf(previous.tab)-tabIndex)*tabbar.getBoundingClientRect().width/4;
      wxUiAnimate(marker,[{transform:'translateX('+distance+'px)'},{transform:'translateX(0)'}],380);
      wxUiAnimate(tabbar.querySelector('.tb.on .wx-tab-icon'),[{transform:'translateY(2px) scale(.88)'},{transform:'translateY(-2px) scale(1.09)',offset:.58},{transform:'none'}],360);
    }
  }
  if(_wxQuickOpen&&c.p==='wechat'&&(!same||!previous.quick)){
    const menu=page.querySelector('.wx-quick-menu');if(menu){menu.style.transformOrigin='calc(100% - 22px) 0';wxUiAnimate(menu,[{opacity:0,transform:'translateY(-7px) scale(.94)'},{opacity:1,transform:'none'}],270);}
    wxUiAnimate(page.querySelector('.wx-quick-shade'),[{opacity:0},{opacity:1}],180);
  }
  if(same&&previous.page==='wechat'&&previous.tab==='chats'&&c.p==='wechat'&&wxTab==='chats'&&previous.quick!==!!_wxQuickOpen){
    wxUiAnimate(page.querySelector('.wx-main-add>svg'),[{transform:'rotate('+(_wxQuickOpen?0:45)+'deg)'},{transform:'rotate('+(_wxQuickOpen?45:0)+'deg)'}],250);
  }
  wxInteractionPanels(page,key);
  if(wxRoleEntryMount(c,app,plan)){page.setAttribute('data-wx-ui-navigation','push');return true;}
  const owns=changed&&wxInteractionPage({p:previous.page})&&shellMotionProfile(c,page)==='standard';
  if(!owns)return false;
  wxPaymentInteractionMount(page,c);
  if(wxSocialPageMotion(c,page)){shellContentMotion(page,c,plan);return true;}
  const tabSwitch=previous.page==='wechat'&&c.p==='wechat',backward=stack.length<previous.depth;
  page.setAttribute('data-wx-ui-navigation',tabSwitch?'tab':backward?'back':'push');
  // Animate content branches while keeping the title and all its ancestors fixed.
  shellContentMotion(page,c,plan);
  return true;
}
function renderWeChat(){
  if(S.wxLogin){if(!wxLoginActive())setTimeout(wxLogout,0);else{if(!_wxLoginTimer)wxLoginStartTimer();return wxLockedScreen();}}
  let body='';
  if(wxTab==='chats')body=wxChats();
  else if(wxTab==='contacts')body=wxContacts();
  else if(wxTab==='moments')body=wxDiscover();
  else if(wxTab==='me')body=wxMe();
  const titles={chats:'微信',contacts:'通讯录',moments:'发现',me:'我'};
  const showAdd=wxTab==='chats'||wxTab==='contacts';
  if(wxTab!=='chats')_wxQuickOpen=false;
  const previewStatus=NORTH_PREVIEW?`<div class="wx-preview-status"><span><b>${hm()}</b>${wxPawIcon()}</span><span class="wx-preview-radio"><i></i><i></i><i></i><i></i>${wxWifiIcon()}<em>17</em></span></div>`:'';
  const addIcon=wxTab==='contacts'?wxContactAddIcon():wxPlusIcon();
  return `${previewStatus}<div class="nav wx-main-nav"><button class="l wx-main-exit" type="button" onclick="home()" aria-label="返回主屏"></button><span class="t wx-main-title"><b>${titles[wxTab]}</b></span><button class="r wx-main-add" type="button" onclick="${wxTab==='chats'?'toggleWxQuickMenu()':wxTab==='contacts'?'editContact()':''}" aria-label="${showAdd?'添加':''}" aria-expanded="${wxTab==='chats'&&_wxQuickOpen?'true':'false'}">${showAdd?addIcon:''}</button></div>
    ${wxTab==='chats'&&_wxQuickOpen?wxQuickMenuHTML():''}
    ${wxTab==='contacts'?wxContactSearchHTML():''}
    <div class="scroll wx-main-scroll">${body}</div>
    ${wxTab==='contacts'?wxAlphabetRail():''}
    <div class="tabbar wx-main-tabbar">
      ${tb('chats',wxTabIcon('chats'),'微信')}${tb('contacts',wxTabIcon('contacts'),'通讯录')}${tb('moments',wxTabIcon('moments'),'发现')}${tb('me',wxTabIcon('me'),'我')}
    </div>`;
}
function wxPlusIcon(){return `<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="14.5"/><line x1="17" y1="9.5" x2="17" y2="24.5"/><line x1="9.5" y1="17" x2="24.5" y2="17"/></svg>`;}
function wxContactAddIcon(){return `<svg class="wx-contact-add-icon" viewBox="0 0 34 34" aria-hidden="true"><circle cx="13" cy="10.2" r="4.7"/><path d="M4.7 27c.6-6.3 3.4-9.5 8.3-9.5s7.7 3.2 8.3 9.5"/><path d="M25.5 11.5v9M21 16h9"/></svg>`;}
function wxQuickMenuIcon(kind){if(kind==='scan')return `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M5 14V6h8M23 6h8v8M31 22v8h-8M13 30H5v-8M9 18h18" fill="none"/></svg>`;return kind==='group'?`<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 5C10 5 4 10 4 16.3c0 3.7 2.1 6.9 5.5 9l-1.2 5 5.1-2.8c1.5.4 3 .6 4.6.6 8 0 14-5 14-11.8S26 5 18 5Z"/></svg>`:`<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="13" cy="10.5" r="5"/><path d="M3.5 29c.8-7.2 4.1-10.8 9.5-10.8s8.7 3.6 9.5 10.8H3.5Z"/><path d="M28 16.5v11M22.5 22h11" fill="none"/></svg>`;}
function wxQuickMenuHTML(){return `<div class="wx-quick-shade" onclick="_wxQuickOpen=false;render()"></div><div class="wx-quick-menu" role="menu"><button type="button" onclick="_wxQuickOpen=false;createGroup()">${wxQuickMenuIcon('group')}<span>发起群聊</span></button><button type="button" onclick="_wxQuickOpen=false;editContact()">${wxQuickMenuIcon('friend')}<span>添加朋友</span></button><button type="button" onclick="_wxQuickOpen=false;go('wxscan')">${wxQuickMenuIcon('scan')}<span>扫一扫</span></button></div>`;}
function toggleWxQuickMenu(){_wxQuickOpen=!_wxQuickOpen;render();}
function wxContactAddMenu(){openModal(`<h3>添加联系人</h3><button class="btn p" onclick="closeModal();editContact()">添加角色</button><button class="btn g" style="margin-top:8px" onclick="closeModal();openPhoneFriends()">添加小手机好友</button><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function wxPawIcon(){return `<svg class="wx-paw" viewBox="0 0 26 24" aria-hidden="true"><ellipse cx="13" cy="16" rx="6.5" ry="5.7"/><ellipse cx="5" cy="10" rx="3" ry="4"/><ellipse cx="10" cy="5.5" rx="2.8" ry="4"/><ellipse cx="16.2" cy="5.3" rx="2.8" ry="4"/><ellipse cx="21.4" cy="10.2" rx="3" ry="4"/></svg>`;}
function wxWifiIcon(){return `<svg class="wx-wifi" viewBox="0 0 26 20" aria-hidden="true"><path d="M2 6.8C8.6.8 17.4.8 24 6.8M6 11.2c4.1-3.5 9.9-3.5 14 0M10.2 15.2c1.7-1.4 3.9-1.4 5.6 0"/><circle cx="13" cy="18" r="1.2"/></svg>`;}
function wxMonitorIcon(){return `<svg viewBox="0 0 28 24" aria-hidden="true"><rect x="3" y="3" width="22" height="15" rx="1.5"/><path d="M10 22h8M14 18v4"/></svg>`;}
function wxTabIcon(k){const icons={
  chats:`<path class="wx-tab-outline" d="M16 4.9C8.6 4.9 3.1 9 3.1 14.4c0 3.1 1.7 5.9 4.7 7.7l-1.4 5.2 5.3-3c1.4.4 2.8.6 4.3.6 7.4 0 12.9-4.2 12.9-10.5S23.4 4.9 16 4.9Z"/><path class="wx-tab-solid" d="M16 3.9C8 3.9 2 8.4 2 14.4c0 3.4 1.8 6.4 5 8.4l-1.6 6 6.2-3.5c1.4.4 2.9.6 4.4.6 8 0 14-4.6 14-11.5S24 3.9 16 3.9Z"/>`,
  contacts:`<path class="wx-tab-outline" d="M14.5 4.3c3.3 0 5.3 2.6 5.3 6.1 0 4-2.2 7-5.3 7s-5.3-3-5.3-7c0-3.5 2-6.1 5.3-6.1ZM4.4 28c.9-5.3 4.4-8.2 10.1-8.2s9.2 2.9 10.1 8.2H4.4Zm20.5-14.6h5.6m-5.6 4.3h5.6m-5.6 4.3h5.6"/><path class="wx-tab-solid" d="M14.5 3.2c3.8 0 6.1 2.9 6.1 6.9 0 4.4-2.5 7.6-6.1 7.6s-6.1-3.2-6.1-7.6c0-4 2.3-6.9 6.1-6.9ZM2.9 29c.8-6 5-9.4 11.6-9.4S25.3 23 26.1 29H2.9Zm23-16.9h5.7v2.8h-5.7v-2.8Zm0 5h5.7v2.8h-5.7v-2.8Zm0 5h5.7v2.8h-5.7v-2.8Z"/>`,
  moments:`<circle class="wx-tab-outline" cx="16" cy="16" r="12.5"/><path class="wx-tab-outline" d="m10.6 21.2 3-7.7 7.8-3-3 7.8-7.8 2.9Z"/><circle class="wx-tab-solid" cx="16" cy="16" r="14"/><path class="wx-tab-solid-cut" d="m10.2 21.8 3.3-8.3 8.3-3.3-3.3 8.3-8.3 3.3Z"/>`,
  me:`<path class="wx-tab-outline" d="M16 4.4c3.2 0 5.1 2.6 5.1 6.1 0 3.9-2 6.8-5.1 6.8s-5.1-2.9-5.1-6.8c0-3.5 1.9-6.1 5.1-6.1ZM5.2 28.1c.9-5.5 4.7-8.6 10.8-8.6s9.9 3.1 10.8 8.6H5.2Z"/><path class="wx-tab-solid" d="M16 3.4c3.8 0 6.1 3 6.1 7 0 4.5-2.4 7.7-6.1 7.7s-6.1-3.2-6.1-7.7c0-4 2.3-7 6.1-7ZM3.7 29.3c.9-6.3 5.3-9.9 12.3-9.9s11.4 3.6 12.3 9.9H3.7Z"/>`};return `<svg class="wx-tab-icon wx-tab-${k}" viewBox="0 0 32 32" aria-hidden="true">${icons[k]}</svg>`;}
function tb(k,i,t){return `<button type="button" class="tb ${wxTab===k?'on':''}" onclick="_wxQuickOpen=false;wxTab='${k}';render()" aria-label="${t}" data-wx-tab="${k}" aria-pressed="${wxTab===k?'true':'false'}"><div class="i">${i}${k==='chats'?wxUnreadBadge(wxUnreadTotal()):k==='moments'&&wxMomentUnread()?wxUnreadBadge(0,true):''}</div><span>${t}</span></button>`;}
function wxDiscoverIcon(kind){const icons={
  moments:'<path d="M16 4.5 19.4 11.6 15.5 12.8Z" stroke="#f2c94c"/><path d="M23.8 8.2 20.4 15.4 17.2 13Z" stroke="#f2994a"/><path d="M27.5 16 20.4 19.4 19.2 15.5Z" stroke="#eb5757"/><path d="M23.8 23.8 16.6 20.4 19 17.2Z" stroke="#bb6bd9"/><path d="M16 27.5 12.6 20.4 16.5 19.2Z" stroke="#2f80ed"/><path d="M8.2 23.8 11.6 16.6 14.8 19Z" stroke="#2d9cdb"/><path d="M4.5 16 11.6 12.6 12.8 16.5Z" stroke="#27ae60"/><path d="M8.2 8.2 15.4 11.6 13 14.8Z" stroke="#6fcf97"/>',
  channels:'<path d="M7 9.2c3.7-4.7 8.1-3.7 9 1.5.9-5.2 5.3-6.2 9-1.5 3.2 4.1 1.5 11.5-9 17-10.5-5.5-12.2-12.9-9-17Z"/>',
  live:'<circle cx="16" cy="16" r="10.5"/><circle cx="16" cy="16" r="4.5"/>',
  music:'<path d="M11.5 8.8v13.4M11.5 9l11-2.2v12.8M11.5 14.2l11-2.2"/><ellipse cx="8.3" cy="22.4" rx="3.5" ry="2.7" transform="rotate(-18 8.3 22.4)"/><ellipse cx="19.3" cy="19.8" rx="3.5" ry="2.7" transform="rotate(-18 19.3 19.8)"/>',
  cinema:'<path d="m16 5 3.1 5.9 6.6.8-4.8 4.7 1.2 6.6-6.1-3.1L9.9 23l1.2-6.6-4.8-4.7 6.6-.8L16 5Z"/>',
  search:'<circle cx="14" cy="14" r="7.5"/><path d="m19.6 19.6 6.4 6.4"/>',
  nearby:'<circle cx="16" cy="16" r="3.3"/><path d="M9.2 22.8a9.6 9.6 0 0 1 0-13.6M22.8 9.2a9.6 9.6 0 0 1 0 13.6M5 26.8a15.2 15.2 0 0 1 0-21.6M27 5.2a15.2 15.2 0 0 1 0 21.6"/>',
  games:'<path d="m10.5 5.5 5.5 5-5.5 5-5.5-5Z" stroke="#2f80ed"/><path d="m21.5 5.5 5.5 5-5.5 5-5.5-5Z" stroke="#27ae60"/><path d="m10.5 16.5 5.5 5-5.5 5-5.5-5Z" stroke="#eb5757"/><path d="m21.5 16.5 5.5 5-5.5 5-5.5-5Z" stroke="#9b51e0"/>'};return `<svg viewBox="0 0 32 32" aria-hidden="true">${icons[kind]||icons.moments}</svg>`;}
function wxDiscoverRow(kind,label,action,lockKey,sub){const locked=!!(lockKey&&appLocked(lockKey));return `<button type="button" class="wx-discover-row tone-${kind}${locked?' locked':''}" ${locked?'disabled':''} onclick="${locked?'':action}"><i>${wxDiscoverIcon(kind)}</i><span>${esc(label)}${kind==='moments'&&wxMomentUnread()?wxUnreadBadge(0,true):''}${sub?`<small>${esc(sub)}</small>`:''}</span><em>${locked?`<b>${svgIc('lock',14,'currentColor')}</b><small>已锁定</small>`:'›'}</em></button>`;}
function wxDiscover(){return `<div class="wx-discover-list">
  <section>${wxDiscoverRow('moments','朋友圈',"wxDiscoverOpen('moments')",'moments')}</section>
  <section>${wxDiscoverRow('channels','视频号',"wxDiscoverOpen('channels')",'douyin')}</section>
  <section>${wxDiscoverRow('music','听一听',"wxDiscoverOpen('music')",'music')}</section>
  <section>${wxDiscoverRow('cinema','看一看',"wxDiscoverOpen('cinema')",'cinema')}${wxDiscoverRow('search','搜一搜',"wxDiscoverOpen('browser')",'browser')}</section>
  <section>${wxDiscoverRow('nearby','附近的人',"wxDiscoverOpen('nearby')",'nearby', '发现匿名新朋友')}</section>
  <section>${wxDiscoverRow('games','游戏',"wxDiscoverOpen('games')",'games')}</section>
  </div>`;}
function wxDiscoverOpen(kind){if(kind==='nearby'){openApp('nearby');return;}if(kind==='channels'){if(appLocked('douyin'))return;_dyFromWx=true;if(dyInit())save(0);dyTab='feed';go('dy',{from:'wechat'});if(!S.dy.feed.length)dyGenFeed('',true);return;}const map={moments:'moments',music:'music',cinema:'cinema',browser:'browser',games:'games'};if(map[kind]){window._wxReturnToDiscover=true;openApp(map[kind]);}}
function renderWxLive(){return `<div class="wx-directory-head">${wxDirectoryNav('直播')}</div><div class="scroll wx-directory-scroll wx-live-coming"><div class="wx-live-orbit"><i>${wxDiscoverIcon('live')}</i></div><b>直播功能开发中</b><p>入口已经保留，后续会在这里接入真实直播内容。</p><button type="button" onclick="back()">返回发现</button></div>`;}
function renderWxMomentFeed(){return `<div class="wx-directory-head">${wxDirectoryNav('朋友圈',`<button type="button" class="r wx-dir-plus" onclick="momentTools()">＋</button>`)}</div><div class="scroll wx-directory-scroll wx-moment-feed" id="wxMomentScroll">${wxMoments()}</div>`;}

let _wxNearbyBusy=false;
const WX_NEARBY_FALLBACK=['雾岛来信','晚风未眠','十七码头','雨停之后','匿名旅人','旧唱片','凌晨两点','半糖气泡','海盐日落','北岸微光','纸飞机','沿途看海','只问不答','复制广告','边界试探','话痨路人'];
function wxNearbyState(){if(!S.wxNearby||typeof S.wxNearby!=='object')S.wxNearby={people:[],requests:[]};const d=S.wxNearby;d.people=Array.isArray(d.people)?d.people.filter(Boolean):[];d.requests=Array.isArray(d.requests)?d.requests.filter(Boolean):[];d.refreshSeq=Math.max(0,Number(d.refreshSeq)||0);return d;}
function wxNearbyFallbackPeople(seed){const seq=Math.max(0,Number(seed)||0),salt=Math.floor(Date.now()/60000)+seq*7,types=[
  ['友善健谈','刚搬来这附近，想找人聊聊吃喝和日常。','热情但尊重边界，会主动找话题，也会认真听对方说话。','你好，刚刚看到你在附近，方便认识一下吗？'],
  ['安静慢热','不公开照片，熟悉以后再慢慢认识。','慢热谨慎，不轻易交心，熟悉后回复认真。','你好，我不太会开场，先打个招呼。'],
  ['直接爽快','不喜欢猜来猜去，有话就直说。','说话直接、节奏快，有好感会表达，不合适也会明确说。','嗨，看你顺眼，想聊两句。'],
  ['古怪跳脱','脑回路有点怪，但没有恶意。','思维跳跃、冷幽默、偶尔答非所问，但不编造共同经历。','你相信附近的人会随机遇到有趣的人吗？'],
  ['功利社交','只聊资源和机会，没兴趣就很冷淡。','功利、现实，会先打听职业和资源；发现没有利用价值会敷衍。','你做什么工作的？也许能互相帮忙。'],
  ['广告推销','加好友只是为了推销课程和产品。','把聊天当获客渠道，会反复推销并回避私人话题；被明确拒绝后应停止。','附近新店体验券要不要了解一下？'],
  ['越界搭讪','很会搭讪，也经常试探别人底线。','轻浮、自来熟、容易说冒犯话；可以表现为令人厌烦的骚扰者，但不得威胁、仇恨或违法。被拉黑后不能绕过系统继续联系。','美女/帅哥，一个人在附近吗？'],
  ['纯骚扰','没有认真认识的打算，只想连续发无聊消息找存在感。','烦人、重复、缺乏边界，会连续搭讪和催回复；不得威胁人身安全、泄露隐私或使用仇恨内容。','在吗？怎么不回？认识一下呗。']
],start=Math.abs(salt)%types.length;return Array.from({length:12},(_,i)=>{const name=WX_NEARBY_FALLBACK[(i+salt)%WX_NEARBY_FALLBACK.length],t=types[(start+i)%types.length];return{id:'near_'+salt+'_'+seq+'_'+i,nickname:name,signature:t[1],distance:(120+(i*173+salt+seq*43)%4800)+'m',gender:(i+seq)%3===0?'女':(i+seq)%3===1?'男':'保密',persona:'你是微信附近的人里出现的匿名用户「'+name+'」，类型是「'+t[0]+'」。'+t[2]+'你和对方此前没有共同经历，关系必须从陌生人开始。',greeting:t[3]};});}
function wxNearbyFingerprint(rows){return (rows||[]).map(x=>[x&&x.nickname,x&&x.gender,x&&x.distance,x&&x.signature].join('|')).join('||');}
function wxNearbyNormalize(x,i){x=x&&typeof x==='object'?x:{};const base=WX_NEARBY_FALLBACK[i%WX_NEARBY_FALLBACK.length];return{id:'near_'+uid(),nickname:String(x.nickname||base).trim().slice(0,16)||base,signature:String(x.signature||'想认识一个聊得来的人。').trim().slice(0,54),distance:String(x.distance||((i+1)*260+'m')).trim().slice(0,12),gender:['男','女','保密'].includes(x.gender)?x.gender:'保密',persona:String(x.persona||'你是一个通过微信附近的人认识的普通匿名网友，慢热、真实、尊重边界。').trim().slice(0,500),greeting:String(x.greeting||'你好，刚刚在附近的人看到你，想认识一下。').trim().slice(0,80)};}
function wxNearbyAvatar(){return `<span class="wx-nearby-avatar"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="15" r="8"/><path d="M8 39c1-10 6-14 14-14s13 4 14 14"/></svg></span>`;}
function wxNearbyRequest(personId){return wxNearbyState().requests.slice().reverse().find(x=>x&&x.personId===personId)||null;}
function wxNearbyCard(p){const req=wxNearbyRequest(p.id),pending=req&&req.status==='pending',accepted=req&&req.status==='accepted',click=accepted&&req.contactId?`wxNearbyOpen('${req.id}')`:`wxNearbyAdd('${p.id}')`;return `<article class="wx-nearby-card${pending?' pending':accepted?' accepted':''}">${wxNearbyAvatar()}<div class="wx-nearby-copy"><b>${esc(p.nickname)}</b><span>${esc(p.gender)} · ${esc(p.distance)}</span><p>${esc(p.signature)}</p></div><button type="button" ${pending?'disabled':''} onclick="${click}">${pending?'等待通过':accepted?'发消息':'添加'}</button></article>`;}
function wxNearbyBlocked(){if(!appLocked('nearby'))return false;toast('「附近的人」已被ta锁定，去情侣空间求ta解开');return true;}
function renderWxNearby(){if(appLocked('nearby'))return `<div class="wx-directory-head">${wxDirectoryNav('附近的人','')}</div><div class="empty">附近的人已被锁定，请去情侣空间求ta解开</div>`;wxNearbySweep(true);const d=wxNearbyState();if(!d.people.length){d.people=wxNearbyFallbackPeople(d.refreshSeq);save(500);}return `<div class="wx-directory-head">${wxDirectoryNav('附近的人',`<button type="button" class="r wx-dir-text" onclick="wxNearbyRefresh()" ${_wxNearbyBusy?'disabled':''}>${_wxNearbyBusy?'刷新中':'刷新'}</button>`)}</div><div class="scroll wx-directory-scroll wx-nearby-page" id="wxNearbyScroll"><div class="wx-nearby-hero"><i>${wxDiscoverIcon('nearby')}</i><span><b>附近的新朋友</b><small>匿名资料 · 添加后约 10 秒自动通过</small></span></div><div class="wx-nearby-list">${d.people.map(wxNearbyCard).join('')}</div><p class="wx-nearby-foot">不会展示真实照片和精确位置。成为好友后会出现在微信通讯录中。</p></div>`;}
async function wxNearbyRefresh(){if(wxNearbyBlocked()||_wxNearbyBusy)return;const d=wxNearbyState(),before=wxNearbyFingerprint(d.people),seq=++d.refreshSeq;_wxNearbyBusy=true;render();let people=[];try{const arr=await aiGen([{role:'system',content:'你是微信“附近的人”匿名资料生成器。生成12个彼此不同、像真实普通网友的匿名资料：必须混合友善、慢热、直率、古怪、功利、推销、边界感差和纯骚扰等类型，不能全部温柔友好。骚扰型可以烦人、重复搭讪、催回复或试探边界，但不得出现人身威胁、仇恨、违法、精确定位或隐私泄露。不给真实姓名、电话、住址、公司，不要明星和现有角色。只输出JSON数组：[{"nickname":"匿名昵称","gender":"男/女/保密","distance":"120m到5km","signature":"一句自然个签","persona":"成为好友后会持续保持的性格、动机、说话方式和边界表现，不编共同经历","greeting":"通过好友后的第一句"}]'},{role:'user',content:'换一批附近的匿名用户。好坏混合、来意混合、性格明显不同，避免模板化。刷新批次：'+seq}],{max:2200,aux:true},parseArr);people=(arr||[]).slice(0,12).map(wxNearbyNormalize);}catch(_){}if(people.length<8||wxNearbyFingerprint(people)===before)people=wxNearbyFallbackPeople(seq);d.people=people;_wxNearbyBusy=false;save();if(cur().p==='wxnearby')render();toast('已换一批不同性格的附近的人');}
function wxNearbyAdd(id){if(wxNearbyBlocked())return;const d=wxNearbyState(),p=d.people.find(x=>x.id===id);if(!p||wxNearbyRequest(id))return;const req={id:'wnr_'+uid(),personId:id,person:Object.assign({},p),status:'pending',time:Date.now(),acceptAt:Date.now()+10000,contactId:''};d.requests.push(req);save();render();toast('好友申请已发送，等待对方通过');setTimeout(()=>wxNearbySweep(false),10050);}
function initialFriendInnerThought(c,opt){if(!c||String(c.innerThought||'').trim())return false;opt=opt||{};const readd=!!opt.readd,nearby=String(opt.kind||c.friendOrigin&&c.friendOrigin.kind||'')==='nearby';c.innerThought=readd?'终于重新加回好友，心里还有些话想慢慢说清楚。':nearby?'刚通过好友，想先认真认识你。':'刚正式加上好友，对接下来的相处有点期待。';c.innerThoughtAt=+opt.at||Date.now();return true;}
function wxNearbyContact(req){if(req.contactId){const old=getC(req.contactId);if(old)return old;}const old=(S.contacts||[]).find(c=>c&&c.friendOrigin&&c.friendOrigin.nearbyRequestId===req.id);if(old)return old;const p=req.person||{},now=Date.now(),c={id:cid(),name:String(p.nickname||'附近的人').slice(0,20),avatar:'👤',remark:'',wxid:genWxid(),signature:String(p.signature||'').slice(0,60),persona:String(p.persona||'你是通过微信附近的人认识的普通网友，真实、慢热、尊重边界。').slice(0,800),greeting:String(p.greeting||'你好，刚刚通过了你的好友申请。').slice(0,80),relation:'附近认识的朋友',gender:['男','女'].includes(p.gender)?p.gender:'',star:false,pinned:false,blocked:false,proactive:{enabled:false,start:9,end:23,times:2},chatBg:'',createdAt:now,deleted:false,_friendPending:false,_friendAcceptedAt:now};c.friendOrigin={kind:'nearby',source:'附近的人',intent:'从陌生人开始认识',requestMsg:'我想添加你为朋友',acceptedAt:now,everAdded:true,nearbyRequestId:req.id};initialFriendInnerThought(c,{kind:'nearby',at:now});S.contacts.push(c);msgs(c.id).push({role:'user',type:'sys',content:'对方通过了你从「附近的人」发出的好友申请',time:now,id:uid()});return c;}
function wxNearbySweep(silent){const d=wxNearbyState(),now=Date.now(),due=d.requests.filter(x=>x&&x.status==='pending'&&(+x.acceptAt||0)<=now);if(!due.length)return false;const accepted=[];due.forEach(req=>{const c=wxNearbyContact(req);req.status='accepted';req.acceptedAt=now;req.contactId=c.id;accepted.push(c);});save();if(!silent&&cur().p==='wxnearby')render();if(!silent){if(S.settings.sound)playDing();toast(accepted.length>1?accepted.length+' 位附近好友已通过申请':(accepted[0].remark||accepted[0].name)+' 已通过好友申请');}accepted.forEach(c=>setTimeout(()=>scheduleReply(c.id,'[系统：你刚刚通过了'+S.me.name+'从微信“附近的人”发来的好友申请。你们此前没有共同经历，从普通陌生人开始；按你的人设发一条自然、克制、能继续认识的第一句微信，不要说系统或AI，不要动作描写。]'),650));return true;}
function wxNearbyOpen(rid){if(wxNearbyBlocked())return;const req=wxNearbyState().requests.find(x=>x.id===rid);if(req&&req.contactId)openChat(req.contactId);}
//@@ web
/* ===== 搜索聊天记录：按聊天分组的结果页（微信样式），点进去跳到那条消息所在的位置 ===== */
//@@ private
/* PRIVATE_WEB_PARITY_V1769: audited shared search, translation, group limits, summary and role-WeChat repeat fixes. */
//@@ end
function openWxSearch(){go('wxsearch');setTimeout(()=>{const i=$('#wxs_in');if(i)i.focus();},80);}
function openChatSearch(id){go('wxsearch',{id});setTimeout(()=>{const i=$('#wxs_in');if(i)i.focus();},80);}
function wxSearchPage(){const page=cur();return page&&page.p==='wxsearch'?page:{};}
function wxSearchWhen(ms){if(!ms)return'';const d=new Date(ms),now=new Date(),day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(),gap=Math.round((day(now)-day(d))/86400000);if(gap<=0)return hm(ms);if(gap<7)return'星期'+'日一二三四五六'[d.getDay()];return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}
function wxHi(t,q){t=String(t||'').replace(/\s+/g,' ');const lt=t.toLowerCase();const i=lt.indexOf(q);if(i<0)return esc(t.slice(0,42))+(t.length>42?'…':'');const s=i>14?i-10:0;return (s>0?'…':'')+esc(t.slice(s,i))+'<b>'+esc(t.slice(i,i+q.length))+'</b>'+esc(t.slice(i+q.length,i+q.length+40))+(t.length>i+q.length+40?'…':'');}
function wxSearchMsgText(m){if(!m||m.type==='sys'||m._call||m._silent)return'';return m.type==='text'||m.type==='voice'?String(m.content||''):'';}
/* 返回 [{kind,id,name,avatar,hits:[{m,t,who,avatar}]}]，每个聊天里的命中按时间从新到旧，聊天之间按最近一条命中排序。 */
function wxSearchChats(q,scopeId,scopeGid){const chats=[];
  if(!scopeGid)S.contacts.filter(c=>!c.deleted&&(!scopeId||c.id===scopeId)).forEach(c=>{const arr=msgs(c.id),hits=[];for(let i=arr.length-1;i>=0;i--){const m=arr[i],t=wxSearchMsgText(m);if(t&&t.toLowerCase().indexOf(q)>=0){if(!m.id)m.id=uid();hits.push({m,t,who:m.role==='user'?(S.me.name||'我'):(c.remark||c.name),avatar:av(m.role==='user'?S.me.avatar:c.avatar)});}}if(hits.length)chats.push({kind:'role',id:c.id,name:c.remark||c.name,avatar:av(c.avatar),hits});});
  if(!scopeId)(S.groups||[]).filter(g=>g&&Array.isArray(g.msgs)&&(!scopeGid||g.id===scopeGid)).forEach(g=>{const hits=[];for(let i=g.msgs.length-1;i>=0;i--){const m=g.msgs[i],t=wxSearchMsgText(m);if(t&&t.toLowerCase().indexOf(q)>=0){if(!m.id)m.id=uid();const sc=m.senderId==='me'?null:getC(m.senderId);hits.push({m,t,who:gnm(g,m.senderId),avatar:av(m.senderId==='me'?S.me.avatar:(sc?sc.avatar:'🙂'))});}}if(hits.length)chats.push({kind:'group',id:g.id,name:groupDisplayName(g),avatar:g.avatar?av(g.avatar):wxClassicGroupAvatarHTML(),hits});});
  chats.forEach(x=>x.hits.sort((a,b)=>(b.m.time||0)-(a.m.time||0)));chats.sort((a,b)=>(b.hits[0].m.time||0)-(a.hits[0].m.time||0));return chats;}
function wxSearchRowHTML(o){return `<div class="wxs-row" onclick="${o.click}"><span class="wxs-av">${o.avatar}</span><div class="wxs-main"><div class="wxs-line"><b>${esc(o.name)}</b><small>${esc(o.when)}</small></div><div class="wxs-snip">${o.snip}</div>${o.count>1?`<div class="wxs-count">共 <i>${o.count}</i> 条相关聊天记录</div>`:''}</div></div>`;}
function wxSearchBodyHTML(q){q=String(q||'').trim().toLowerCase();const page=wxSearchPage(),scopeId=page.id||'',scopeGid=page.gid||'',c=scopeId&&getC(scopeId),g=scopeGid&&S.groups.find(x=>x.id===scopeGid),scoped=c||g,scope=c?'你和'+(c.remark||c.name)+'的聊天记录':g?'「'+groupDisplayName(g)+'」的聊天记录':'你和所有角色、群聊的聊天记录';
  if(!q)return '<div class="wxs-empty">输入关键词<br>搜'+esc(scope)+'</div>';
  const chats=wxSearchChats(q,scopeId,scopeGid);
  const pf=!scoped&&/^sp[a-z0-9]{4,12}$/i.test(q)?`<div class="wxs-row" onclick="phoneFriendSearchFromWx('${esc(q)}')"><span class="wxs-av"><div class="avatar" style="background:#6574ff">${svgIc('users',21,'#fff')}</div></span><div class="wxs-main"><div class="wxs-line"><b>搜索小手机ID</b></div><div class="wxs-snip">查找 ${esc(q.toUpperCase())} 并申请添加</div></div></div>`:'';
  if(!chats.length)return pf+'<div class="wxs-empty">没找到包含「'+esc(q)+'」的聊天记录</div>';
  /* 进到某一个聊天里：一条命中一行，点哪条跳哪条 */
  if(scoped){const chat=chats[0];return `<div class="wxs-head">${chat.hits.length} 条与“${esc(q)}”相关的聊天记录</div>`+chat.hits.slice(0,300).map(h=>wxSearchRowHTML({click:`wxSearchJump('${chat.kind}','${chat.id}','${h.m.id}')`,avatar:h.avatar,name:h.who,when:wxSearchWhen(h.m.time),snip:wxHi(h.t,q),count:1})).join('');}
  return pf+'<div class="wxs-head">聊天记录</div>'+chats.slice(0,80).map(chat=>{const h=chat.hits[0];return wxSearchRowHTML({click:`wxSearchOpen('${chat.kind}','${chat.id}')`,avatar:chat.avatar,name:chat.name,when:wxSearchWhen(h.m.time),snip:wxHi(h.t,q),count:chat.hits.length});}).join('');}
const _wxSearchTop={};
function wxSearchTopKey(page){page=page||wxSearchPage();return page.gid?'g:'+page.gid:page.id||'all';}
function wxSearchKeepTop(){const page=wxSearchPage(),box=$('#wxs_res');if(box&&page.p)_wxSearchTop[wxSearchTopKey(page)]=box.scrollTop;}
function renderWxSearch(id){const page=wxSearchPage(),q=String(page.q||'');
  /* 从聊天返回结果页：列表回到刚才点的位置 */
  const topKey=wxSearchTopKey(page),top=_wxSearchTop[topKey];if(top)setTimeout(()=>{const box=$('#wxs_res'),now=wxSearchPage();if(box&&now.p&&wxSearchTopKey(now)===topKey)box.scrollTop=top;},0);
  return `<div class="wxs-page"><div class="wxs-top"><button type="button" class="wxs-back" aria-label="返回" onclick="back()"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><label class="wxs-box">${svgIc('search',19,'currentColor')}<input id="wxs_in" placeholder="搜索" value="${esc(q)}" oninput="wxSearchRun(this.value)" autocomplete="off" enterkeyhint="search"><button type="button" class="wxs-clear" id="wxs_clear" aria-label="清空" onclick="wxSearchClear()"${q?'':' hidden'}>×</button></label><button type="button" class="wxs-cancel" onclick="wxSearchCancel()">取消</button></div><div class="wxs-scroll" id="wxs_res">${wxSearchBodyHTML(q)}</div></div>`;}
function wxSearchRun(q){const box=$('#wxs_res');if(!box)return;const page=cur(),scopeId=page&&page.p==='wxsearch'?page.id:'';if(page&&page.p==='wxsearch')page.q=String(q||'');const clear=$('#wxs_clear');if(clear)clear.hidden=!String(q||'');
  /* 在某个角色里搜索时只看这一个角色：S.contacts.filter(c=>!c.deleted&&(!scopeId||c.id===scopeId))，分组与排序在 wxSearchChats 里完成 */
  box.innerHTML=wxSearchBodyHTML(q);box.scrollTop=0;if(page&&page.p==='wxsearch')delete _wxSearchTop[wxSearchTopKey(page)];}
function wxSearchClear(){const i=$('#wxs_in');if(i){i.value='';try{i.focus();}catch(_){}}wxSearchRun('');}
function wxSearchCancel(){while(stack.length>1&&cur().p==='wxsearch')stack.pop();render();}
function wxSearchOpen(kind,id){const q=String(wxSearchPage().q||'').trim();if(!q)return;wxSearchKeepTop();const chat=wxSearchChats(q.toLowerCase(),kind==='group'?'':id,kind==='group'?id:'')[0];if(!chat)return;if(chat.hits.length===1){wxSearchJump(kind,id,chat.hits[0].m.id);return;}go('wxsearch',kind==='group'?{gid:id,q}:{id,q});}
/* 跳到某条消息：聊天页照常打开，只是这一次不贴底，而是把那条消息放到屏幕中间并闪一下。
   只管这一次——返回后再正常点开这个聊天，还是回到最底下。 */
let _chatJump=null;
function wxSearchJump(kind,id,mid){wxSearchKeepTop();
  if(kind==='group'){const g=S.groups.find(x=>x.id===id);if(!g||!g.msgs.some(m=>m.id===mid)){toast('这条消息已经不在了');return;}delete _scrollBottomOnce['group:'+id];_chatJump={key:'group:'+id,mid};go('group',{id});return;}
  const c=getC(id),all=c?msgs(id):[],i=all.findIndex(m=>m.id===mid);if(i<0){toast('这条消息已经不在了');return;}
  /* 聊天页默认只画最近一段，先把窗口放大到够得着那条消息 */
  _chatRenderExtra[id]=Math.max(_chatRenderExtra[id]||0,all.length-i+20-CHAT_RENDER_LIMIT,0);
  wxChatRestore('role:'+id);stack=stack.filter(x=>x.p!=='chat');delete _scrollBottomOnce['chat:'+id];_chatJump={key:'chat:'+id,mid};go('chat',{id});}
function chatJumpToMessage(el,mid){const find=()=>Array.from(el.querySelectorAll('[data-message-id]')).find(n=>n.getAttribute('data-message-id')===String(mid));const node=find();if(!node)return false;
  const place=()=>{const n=find();if(!n||!el.isConnected)return;const er=el.getBoundingClientRect(),nr=n.getBoundingClientRect();el.scrollTop=Math.max(0,el.scrollTop+(nr.top-er.top)-Math.max(0,(el.clientHeight-nr.height)/2));};
  place();requestAnimationFrame(place);setTimeout(place,180);setTimeout(place,520);node.classList.add('msg-jump-hit');setTimeout(()=>{const n=find();if(n)n.classList.remove('msg-jump-hit');},2400);return true;}

function renderPhoneFriends(){const p=phoneFriendState();phoneFriendMaybeSync(false);const incoming=pfReqs('incoming'),outgoing=pfReqs('outgoing'),search=p.search||{};
  const found=(search.items||[]).map(x=>{const id=(''+(x.phone_id||x.id||'')).toUpperCase();const already=id===p.id||phoneFriendById(id);return `<div class="row">${already?av(x.avatar||'🙂','sm'):wxNearbyAvatar()}<div class="meta"><div class="n">${esc(x.display_name||'小手机用户')}</div><div class="s">小手机ID：${esc(id)}</div></div>${already?'<span class="pfsoft">已是好友</span>':`<button class="minibtn" style="background:#07c160;color:#fff" onclick="phoneFriendRequest('${id}')">添加</button>`}</div>`;}).join('');
  return `<div class="nav pf-friends-nav"><span class="l" onclick="back()">‹</span><span class="t">小手机好友</span><span class="r" onclick="phoneFriendSync(false,true)">${svgIc('refresh',20,'currentColor')}</span></div>
  <div class="scroll pf-friends-page">
    <div class="section pf-friends-section" style="margin:12px">
      <div class="pf-friends-kicker pf-id-title">我的小手机ID</div><button class="minibtn" onclick="phoneFriendDiagnostic()">连接诊断</button>
      <div class="it"><span style="font-size:22px;font-weight:800;letter-spacing:1px">${esc(p.id)}</span><button class="minibtn" onclick="copyPhoneFriendId()">复制</button></div>
      <div class="it"><span>允许别人通过ID搜到我</span><span class="sw ${p.allowSearch!==false?'on':''}" onclick="phoneFriendToggleSearch()"></span></div><div class="it"><span>实时接收消息<small style="display:block;color:#888;font-weight:400">关闭时省流量：不在真人好友页面时每 5 分钟收一次新消息，打开好友页马上同步</small></span><span class="sw ${pfRealtime()?'on':''}" onclick="phoneFriendToggleRealtime()"></span></div>
      ${p._repairNote?`<div class="hint" style="color:#9ec5fe">${esc(p._repairNote)}</div>`:''}${p.lastError?`<div class="hint" style="color:#e8a85b">${esc(p.lastError)}</div>`:''}
    </div>
    <div class="section pf-friends-section" style="margin:12px">
      <div class="pf-friends-kicker">添加好友</div>
      <div class="pf-friends-search-row"><input class="pf-friends-search" id="pf_search" value="${esc(search.q||'')}" placeholder="输入对方小手机ID，如 SPXXXXXX">${(search.q||(search.items&&search.items.length))?'<button class="minibtn" onclick="phoneFriendSearchClear()">清空</button>':''}<button class="send" onclick="phoneFriendSearch()">搜索</button></div>
      ${search.busy?'<div class="empty" style="padding:14px;color:#888">搜索中…</div>':search.err?`<div class="hint" style="color:#e8a85b">${esc(search.err)}</div>`:(found||((search.q||'')?'<div class="empty" style="padding:14px;color:#888">没搜到这个ID</div>':''))}
    </div>
    ${incoming.length?`<div class="section pf-friends-section" style="margin:12px"><div class="pf-friends-kicker pf-request-title">新的申请</div>${incoming.map(r=>{const busy=!!_pfRespondBusy[r.id]||!!r._responding;return `<div class="it">${wxNearbyAvatar()}<span style="flex:1">${esc(r.from_name||r.from_id)}</span><button class="minibtn" style="background:#07c160;color:#fff" onclick="phoneFriendRespond('${r.id}',true)" ${busy?'disabled':''}>${busy?'处理中…':'通过'}</button><button class="minibtn" onclick="phoneFriendRespond('${r.id}',false)" ${busy?'disabled':''}>忽略</button></div>`;}).join('')}</div>`:''}
    ${outgoing.length?`<div class="section pf-friends-section" style="margin:12px"><div class="pf-friends-kicker pf-outgoing-title">已发送申请</div>${outgoing.map(r=>`<div class="it"><span>${esc(r.to_name||r.to_id)}</span><span class="v">等待通过</span></div>`).join('')}</div>`:''}
    <div class="section pf-friends-section" style="margin:12px">
      <div class="it" onclick="phoneFriendCreateGroupModal()"><span class="pf-friends-create-group">${svgIc('users',18,'currentColor')}新建小手机群</span><span class="v">›</span></div>
    </div>
    <div class="list pf-friends-list">${pfGroupRowsHTML()}${pfFriendRowsHTML()||'<div class="empty" style="padding:24px;color:#888">还没有小手机好友<br>让对方把小手机ID发给你，或复制你的ID给对方</div>'}</div>
    <div style="height:30px"></div>
  </div>`;}
//@@ web
function renderPhoneFriendChat(id){const p=phoneFriendState();id=(''+id).toUpperCase();const f=phoneFriendById(id)||{phone_id:id,display_name:id,avatar:'🙂'};const arr=phoneFriendChatMessages(id);
  let body='';arr.forEach((m,i)=>{
//@@ private
function renderPhoneFriendChat(id){const started=pfSyncClock(),p=phoneFriendState();id=(''+id).toUpperCase();const f=phoneFriendById(id)||{phone_id:id,display_name:id,avatar:'🙂'},all=phoneFriendChatMessages(id),limit=_pfFriendRenderLimit[id]||60,hidden=Math.max(0,all.length-limit),arr=hidden?all.slice(-limit):all;
  let body=hidden?`<button class="btn g" style="width:calc(100% - 32px);margin:12px 16px" onclick="phoneFriendChatShowEarlier('${id}')">查看更早消息（还有 ${hidden} 条）</button>`:'';arr.forEach((m,i)=>{
//@@ end
    const prev=i?arr[i-1]:null;body+=chatBoundaryHTML(prev,m);
    if(m.recalled){body+=pfRecalledRow();return;}
    const me=m.from===p.id,rs=me&&!m._transferReceipt?pfReadStatus(m,'friend',id):(!me&&!m._transferReceipt&&readReceiptOn()?(pfReadIds(m).indexOf(p.id)>=0?'已读':''):''),rec=me&&!m._transferReceipt?`<button type="button" class="pfrecall" aria-label="撤回这条消息" onclick="event.stopPropagation();phoneFriendRecallMessage('${m.id}','friend','${id}')">撤回</button>`:'';
    body+=`<div data-message-id="${esc(m.id)}" data-wx-motion-id="${esc(wechatMotionMessageId(m))}" class="msg ${me?'me':'them'}"><span>${me?av(S.me.avatar):pfAvatarHTML(f)}</span><div class="col" onclick="pfMsgMenu('${m.id}','friend','${id}')">${pfBubblePart(m,me)}<div class="msgt">${rec}${hm(m.time)}</div>${!m._transferReceipt&&readReceiptOn()?`<div class="msgread-line"${me?'':` data-pf-in="${m.id}"`}${/已读/.test(rs)?` data-wx-read="${esc(rs)}"`:rs?'':' data-wx-read=""'}>${rs}</div>`:''}</div></div>`+pfRpSysLine(m,'friend',id);
  });
//@@ web
  const gag=S.couple&&S.couple.gags&&S.couple.gags[pfGagKey(id)];
//@@ private
  const gag=S.couple&&S.couple.gags&&S.couple.gags[pfGagKey(id)];pfSyncTrace('chatRender.end',{messages:all.length,rendered:arr.length,hidden,ms:Math.max(0,Math.round(pfSyncClock()-started))});
//@@ end
  return `<div class="nav chat-glass-nav"><span class="l" onclick="back()">‹</span><span class="t">${esc(pfFriendDisplayName(f))}</span><span class="r" onclick="phoneFriendManage('${id}')">⋯</span></div>
    <div class="chatbg" id="pfchatbg">${body||'<div class="empty" style="padding:40px;color:#888">你们已经是小手机好友了</div>'}</div>
    ${gag?`<div class="inputbar" style="justify-content:center;color:#fa5151;font-size:13px;padding:16px;text-align:center">ta把你和「${esc(pfFriendDisplayName(f))}」的聊天锁了，<span onclick="gagAskUnlock()" style="color:inherit;text-decoration:underline;cursor:pointer">去求他解锁</span></div>`:groupComposerHTML('pffriend',id,'pf_input','发消息…',`sendPhoneFriend('${id}')`,'pfpanel')}
    ${pfPanelHTML(id)}`;}
function renderPhoneFriendGroup(gid){const g=pfGroupById(gid)||{name:'小手机群聊',members:[]};const p=phoneFriendState(),all=pfGroupMessages(gid),limit=_pfGroupRenderLimit[gid]||120,hidden=Math.max(0,all.length-limit),arr=hidden?all.slice(-limit):all;
  let body=hidden?`<button class="btn g" style="width:calc(100% - 32px);margin:12px 16px" onclick="phoneFriendGroupShowEarlier('${gid}')">查看更早消息（还有 ${hidden} 条）</button>`:'';arr.forEach((m,i)=>{
    const prev=i?arr[i-1]:null;body+=chatBoundaryHTML(prev,m);
    if(m.recalled){body+=pfRecalledRow();return;}
    const pl=pfMsgPayload(m);if(pl&&pl.type==='pat'){body+=pfPatRow(m);return;}
    /* 真人群里的角色（pf-group-role.js）：角色发的消息按单独的群成员显示 */
    if(pl&&typeof pfRoleRow==='function'){const rr=pfRoleRow(m,pl,gid,g);if(rr){body+=rr;return;}}
    const me=m.from===p.id,sid=me?'me':(''+m.from).toUpperCase(),bs=pfGroupBubbleCfg(gid,sid),ac=bs&&bs.avatar==='round'?'av-round':'',member=pfGroupMemberById(g,m.from),ff=phoneFriendById(m.from)||member,name=pfGroupMemberName(g,member||{phone_id:m.from}),rs=me?pfReadStatus(m,'group',gid):'',rec=me?`<button type="button" class="pfrecall" aria-label="撤回这条消息" onclick="event.stopPropagation();phoneFriendRecallMessage('${m.id}','group','${gid}')">撤回</button>`:'',at=me?'':`onpointerdown="pfAtStart(event,'${gid}','${m.from}')" onpointerup="pfGroupAvatarTap(event,'${gid}','${m.from}')" onpointercancel="pfAtEnd()" onpointerleave="pfAtEnd()" ondblclick="pfGroupAvatarDouble(event,'${gid}','${m.from}')" title="双击拍一拍，长按@"`;
    const showName=!me&&!pfGroupPref(gid).hideNames;
    body+=`<div data-message-id="${esc(m.id)}" data-wx-motion-id="${esc(wechatMotionMessageId(m))}" class="msg ${me?'me':'them'}${showName?' gnamed':''}"><span ${at}>${me?av(S.me.avatar,ac):pfAvatarHTML(ff||{phone_id:m.from,display_name:name},ac)}</span><div class="col" onclick="pfMsgMenu('${m.id}','group','${gid}')">${showName?`<div class="gname">${esc(name||'成员')}</div>`:''}${pfBubblePart(m,me,bs)}<div class="msgt">${rec}${hm(m.time)}</div>${!m._transferReceipt&&readReceiptOn()?`<div class="msgread-line"${me?'':` data-pf-in="${m.id}"`}${/已读/.test(rs)?` data-wx-read="${esc(rs)}"`:rs?'':' data-wx-read=""'}>${rs}</div>`:''}</div></div>`+pfRpSysLine(m,'group',gid);
  });
  const gag=S.couple&&S.couple.gags&&S.couple.gags[pfgGagKey(gid)];
  const pref=pfGroupPref(gid),bgSource=pref.chatBg?storedImageDisplaySource(pref.chatBg):'';
  return `<div class="nav chat-glass-nav"><span class="l" onclick="back()">‹</span><span class="t">${esc(pfGroupDisplayName(g))}</span><span class="r" onclick="ginfoOpen('pf','${gid}')">⋯</span></div>
    <div class="chatbg" id="pfgroupbg"${bgSource?` style="background:url(${bgSource}) center/cover"`:''}>${body||'<div class="empty" style="padding:40px;color:#888">群聊已创建</div>'}</div>
    ${gag?`<div class="inputbar" style="justify-content:center;color:#fa5151;font-size:13px;padding:16px;text-align:center">ta把「${esc(pfGroupDisplayName(g))}」锁了，<span onclick="gagAskUnlock()" style="color:inherit;text-decoration:underline;cursor:pointer">去求他解锁</span></div>`:gmMuteNoticeHTML('pf',gid)?gmMuteNoticeHTML('pf',gid):groupComposerHTML('pfgroup',gid,'pfg_input','发群消息…',`sendPhoneFriendGroup('${gid}')`,'pfgpanel')}
    ${pfGroupPanelHTML(gid)}`;}

/* WX_STEPS_NEW_ICON_V1（2026-10-18 她说：把微信运动里那个绿色方块图标，换成查他手机银行页那个新的微信图标）：不要绿色方块底，直接用那两个气泡 */
function wxStepsAppIcon(extraClass=''){return `<span class="wx-steps-icon wx-steps-new ${extraClass}" aria-hidden="true">${spyBankIcon('wechat',40)}</span>`;}
function wxStepsSummary(){ensureDailySteps();const steps=Math.max(0,Math.round(+S.me.steps||0));return S.me.stepOn?`今日 ${northLocaleNumber(steps,'zh-CN')} 步 · 已启用`:'[链接] 开启微信运动，记录每天步数';}
function wxStepsChatRow(){return `<button type="button" class="row wx-chat-row wx-steps-chat-row" onclick="go('wxsteps')">${wxStepsAppIcon('avatar')}<span class="meta"><b class="n">微信运动</b><small class="s">${esc(wxStepsSummary())}</small></span><span class="meta time">${S.me.stepOn?hm():''}</span></button>`;}
async function wxStepsToggle(){if(S.me.stepOn&&!_stepOn){S.me.stepOn=false;if(!flushStepSave())save();render();toast('已停止计步');return;}await toggleSteps();}
function renderWxSteps(){ensureDailySteps();const on=!!S.me.stepOn,steps=Math.max(0,Math.round(+S.me.steps||0));return `<div class="wxsteps-page"><div class="wxsteps-nav"><button type="button" onclick="back()" aria-label="返回">‹</button></div><div class="scroll wxsteps-scroll"><section class="wxsteps-hero">${wxStepsAppIcon()}<div><b>微信运动</b><small>${on?`今日 ${northLocaleNumber(steps,'zh-CN')} 步 · 已启用`:'未启用'}</small></div></section><section class="wxsteps-about"><b>功能介绍</b><p>加入微信运动，和朋友分享运动的快乐。参与步数排行榜需允许微信读取系统“健康”应用中的步数数据。</p></section><button class="wxsteps-toggle ${on?'stop':''}" type="button" onclick="wxStepsToggle()">${on?'停用该功能':'启用该功能'}</button></div></div>`;}

function wxHiddenChatStore(){const owner=actId();if(!S.wxHiddenChats||typeof S.wxHiddenChats!=='object')S.wxHiddenChats={};if(!Object.prototype.hasOwnProperty.call(S.wxHiddenChats,owner))Object.defineProperty(S.wxHiddenChats,owner,{value:{},writable:true,enumerable:true,configurable:true});return S.wxHiddenChats[owner];}
function wxChatIsHidden(key,time){const at=+wxHiddenChatStore()[key]||0;return at>0&&(+time||0)<=at;}
function wxChatHide(key){if(!key)return;wxHiddenChatStore()[key]=Date.now();_wxConversationSwipe=null;save();render();toast('已隐藏聊天，联系人和聊天记录保留');}
function wxChatRestore(key){const store=wxHiddenChatStore();if(Object.prototype.hasOwnProperty.call(store,key)){delete store[key];save();}}
let _wxConversationSwipe=null,_wxConversationIgnoreUntil=0;
function wxConversationSwipeStart(e,key){if(!e.isPrimary||e.button>0||e.target.closest('button'))return;_wxConversationSwipe={key,x:e.clientX,y:e.clientY,pointer:e.pointerId,owner:actId(),state:S,dx:0};}
function wxConversationSwipeMove(e,key){const t=_wxConversationSwipe;if(!t||t.key!==key||t.pointer!==e.pointerId)return;const dx=e.clientX-t.x,dy=e.clientY-t.y;if(Math.abs(dy)>18&&Math.abs(dy)>Math.abs(dx)){_wxConversationSwipe=null;return;}t.dx=dx;if(Math.abs(dx)>18&&Math.abs(dx)>Math.abs(dy)*1.5){if(e.cancelable)e.preventDefault();}}
function wxConversationSwipeEnd(e,key){const t=_wxConversationSwipe;_wxConversationSwipe=null;if(!t||t.key!==key||t.pointer!==e.pointerId||t.state!==S||t.owner!==actId())return;const dx=e.clientX-t.x,dy=e.clientY-t.y;if(Math.abs(dx)<34||Math.abs(dx)<Math.abs(dy)*1.5)return;_wxConversationIgnoreUntil=Date.now()+500;const row=e.currentTarget;document.querySelectorAll('.wx-conversation-swipe.open').forEach(x=>{if(x!==row)x.classList.remove('open');});row.classList.toggle('open',dx<0);}
function wxConversationClickGuard(e){if(e.target.closest&&e.target.closest('.wx-hide-conversation'))return;if(Date.now()>=_wxConversationIgnoreUntil||!e.target.closest||!e.target.closest('.wx-conversation-swipe'))return;e.preventDefault();e.stopPropagation();}
if(typeof document!=='undefined')document.addEventListener('click',wxConversationClickGuard,true);
function wxConversationSwipeHTML(key,html){return `<div class="wx-conversation-swipe" data-chat-key="${esc(key)}" onpointerdown="wxConversationSwipeStart(event,'${key}')" onpointermove="wxConversationSwipeMove(event,'${key}')" onpointerup="wxConversationSwipeEnd(event,'${key}')" onpointercancel="_wxConversationSwipe=null"><button type="button" class="wx-hide-conversation" onclick="event.stopPropagation();wxChatHide('${key}')">不显示该聊天</button><div class="wx-conversation-front">${html}</div></div>`;}
function wxChats(){
  const list=[...S.contacts].filter(c=>!c.deleted&&(isMain()||addedHere(c)||msgs(c.id).length));
  const groups=isMain()?(S.groups||[]):[];
  const banner=isMain()?'':`<div style="padding:8px 12px;background:#3a2d4a;color:#d6c2f0;font-size:12px;text-align:center;display:flex;align-items:center;justify-content:center;gap:6px">${svgIc('idcard',14,'#d6c2f0')}当前身份：${esc(S.me.name)}（在「我」里可切换/搜微信号加人）</div>`;
  const searchbar=`<button class="wx-chat-search" type="button" onclick="openWxSearch()">${svgIc('search',20,'currentColor')}<span>搜索</span></button>`;
  const desktop=`<div class="wx-desktop-login" role="status"><span>${wxMonitorIcon()}</span><b>Windows 微信已登录</b></div>`;
  const roleRow=c=>{const lm=lastMsg(c.id);return `<div class="row wx-chat-row ${c.pinned?'pin':''}" onclick="openChat('${c.id}')">${wxUnreadAvatar(av(c.avatar),wxRoleUnread(c.id))}
      <div class="meta"><div class="n">${esc(c.remark||c.name)} ${c.blocked?'<span class=tag>已拉黑</span>':''}</div>
      <div class="s">${lm?esc(previewOf(lm)):'打个招呼吧～'}</div></div>
      <div style="text-align:right"><div class="meta time">${lm?hm(lm.time):''}</div>${c.pinned?'<div style="font-size:10px;color:#ccc">置顶</div>':''}</div></div>`;};
  const entries=[],add=(time,pinned,html,key)=>{if(key&&wxChatIsHidden(key,time))return;entries.push({time:+time||0,pinned:!!pinned,html:key?wxConversationSwipeHTML(key,html):html,order:entries.length});};
  list.forEach(c=>{const lm=lastMsg(c.id);add(lm&&lm.time,c.pinned,roleRow(c),'role:'+c.id);});
  groups.forEach(g=>{const lm=g.msgs[g.msgs.length-1];add(lm&&lm.time,g.pinned,`<div class="row wx-chat-row ${g.pinned?'pin':''}" onclick="go('group',{id:'${g.id}'})">${wxUnreadAvatar(g.avatar?av(g.avatar):'<div class="avatar" style="background:#7c6cc0">👥</div>',wxGroupUnread(g))}<div class="meta"><div class="n">${esc(groupDisplayName(g))}(${g.members.length+1})${g.muted?' 🔕':''}</div><div class="s">${lm?esc(gpreview(lm,g)):'群聊已创建'}</div></div><div style="text-align:right"><div class="meta time">${lm?hm(lm.time):''}</div>${g.pinned?'<div style="font-size:10px;color:#ccc">置顶</div>':''}</div></div>`,'group:'+g.id);});
  if(isMain()){const p=phoneFriendState();(p.groups||[]).forEach(g=>{const gid=g.group_id||g.id,arr=pfMsgList(p.groupMessages,gid),lm=arr[arr.length-1],unread=wxPfUnread(arr,p.id,p.groupRead[gid],true),pref=(p.groupPrefs&&p.groupPrefs[gid])||{},pinned=!!(g.pinned||pref.pinned);add(lm&&lm.time,pinned,`<div class="row ${pinned?'pin':''}" onclick="openPhoneFriendGroup('${gid}')">${wxUnreadAvatar(wxClassicGroupAvatarHTML(),unread)}<div class="meta"><div class="n">${esc(pfGroupDisplayName(g))}${pref.muted?' 🔕':''}</div><div class="s">${lm?esc(lm.recalled?'[已撤回一条消息]':((pfNameById(lm.from)||'成员')+'：'+pfMsgPreview(lm))):'群聊已创建'}</div></div><div style="text-align:right"><div class="meta time">${lm?hm(lm.time):''}</div>${g.pinned?'<div style="font-size:10px;color:#ccc">置顶</div>':''}</div></div>`,'friend-group:'+gid);});(p.friends||[]).forEach(f=>{const id=(''+(f.phone_id||f.id)).toUpperCase(),arr=pfVisibleMsgList(p.messages,id),lm=arr[arr.length-1],unread=wxPfUnread(arr,id,p.friendRead[id],false);add(lm&&lm.time,f.pinned,`<div class="row ${f.pinned?'pin':''}" onclick="openPhoneFriendChat('${id}')">${wxUnreadAvatar(pfAvatarOnlineHTML(f),unread)}<div class="meta"><div class="n">${esc(pfFriendDisplayName(f))}</div><div class="s">${lm?esc(lm.recalled?'[已撤回一条消息]':((lm.from===p.id?'我：':'')+pfMsgPreview(lm))):'已经是好友，打个招呼吧'}</div></div><div style="text-align:right"><div class="meta time">${lm?hm(lm.time):''}</div>${f.pinned?'<div style="font-size:10px;color:#ccc">置顶</div>':''}</div></div>`,'friend:'+id);});}
  if(!entries.length)return banner+searchbar+desktop+'<div class="list wx-chat-list">'+wxStepsChatRow()+'</div><div class="empty">'+(isMain()?'欢迎来到 North～<br>右上角 ＋ 新建你的第一个角色就能开聊<br><br><button class="btn p" style="max-width:220px;margin:14px auto 0" onclick="showManual()">使用说明书</button>':'这个身份还没加谁～<br>去「通讯录」搜微信号加人')+'</div>';
  entries.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||b.time-a.time||a.order-b.order);
  const firstRegular=entries.findIndex(x=>!x.pinned),motionAt=firstRegular<0?entries.length:firstRegular;
  const chatRows=entries.slice(0,motionAt).map(x=>x.html).join('')+wxStepsChatRow()+entries.slice(motionAt).map(x=>x.html).join('');
  return banner+searchbar+desktop+'<div class="list wx-chat-list">'+chatRows+'</div>';
}
function gpreview(m,g){const nm=gnm(g,m.senderId);return nm+'：'+gmText(m);}
function gmText(m){if(m&&m.type==='image'&&m._albumShare&&typeof photoAlbumChatSourceText==='function')return photoAlbumChatSourceText(m)+'[图片] '+(m.desc||'尚未取得画面描述');return m.type==='sys'?String(m.content||'')||'[消息]':m.type==='text'?m.content:m.type==='voice'?'[语音] '+(m.content||''):m.type==='image'?'[图片] '+(m.desc||'尚未取得画面描述'):m.type==='sticker'?'[表情] '+(m.meaning||''):m.type==='transfer'?'[转账'+(m.to&&m.to!=='me'?'给'+((getC(m.to)||{}).name||'群友'):'')+(m.received?'，已收款':'')+']':m.type==='redpacket'?'[红包'+(m.count>1?' 共'+m.count+'个':'')+(Array.isArray(m.grabs)&&m.grabs.length?'，'+m.grabs.map(x=>(x.who==='me'?S.me.name:((getC(x.who)||{}).name||'群友'))+'抢到'+(+x.amount||0).toFixed(2)+'元').join('、'):'')+']':'[消息]';}
/* ===== 群聊 ===== */
function showManual(section){openModal(`<h3>North · 使用说明与常见问题</h3>
  <div id="manual_scroll" style="font-size:13.5px;line-height:1.85;color:#e6e6e6;max-height:65vh;overflow:auto;text-align:left;padding-right:3px">
    <div style="padding:2px 0 14px;color:#b8bdc8">第一次使用先看“快速开始”和“聊天模型”；语音、图片及字幕识别均使用用户自行配置的外置接口。</div>

    <div style="padding:13px 0;border-top:1px solid rgba(255,255,255,.12)">
      <b style="font-size:15px;color:#ffd0df">一、快速开始</b><br>
      1. 主屏进入<b>设置 → 聊天模型</b>，填写接口地址、API Key 和准确模型名，先点“测试连接”。<br>
      2. 进入<b>微信 → 右上角＋ → 新建角色</b>，填写名字、头像、人设、关系和角色对你的称呼。人设越具体，角色越稳定。<br>
      3. 保存后打开聊天。文字、图片、语音、转账、朋友圈、语音/视频电话等功能都围绕这个角色工作。<br>
      4. 世界书负责共同设定，记忆负责已经发生的事，上下文条数在设置中按自己的模型能力调整，并非固定值。<br>
      5. 主屏应用可长按拖动换页；壁纸、App图标和组件在<b>设置 → 外观美化</b>中调整。
    </div>

    <div style="padding:13px 0;border-top:1px solid rgba(255,255,255,.12)">
      <b style="font-size:15px;color:#ffd0df">二、聊天模型与外置接口</b><br>
      · 日常微信、电话、线下约会和多数游戏回复，使用<b>设置里的聊天模型</b>。<br>
      · 聊天模型支持<b>路线一至路线四</b>。每条路线会一起保存主聊天与辅助模型；点击路线会先保存当前两组输入，再一键回填目标路线。主聊天和辅助模型标题右上角都有就近“保存”按钮。<br>
      · 接口地址填写平台给你的 Base URL。OpenAI兼容接口通常以 <b>/v1</b> 结尾，不要填写控制台、注册页或模型广场网址。<br>
      · API Key 只填密钥本身，不要带“Bearer”、引号、空格或换行。模型名必须和平台模型列表完全一致。<br>
      · 主模型负责普通回复；副模型可用于总结或部分省钱功能。副模型留空时会回到主模型。<br>
      · 识图、语音和生图可以填写独立接口。填完必须点对应的<b>测试</b>，看到成功后再保存。能拉到模型名不等于聊天、生图或语音一定可用。
    </div>

    <div id="manual_ai" style="padding:13px 0;border-top:1px solid rgba(255,143,171,.5)">
      <b style="font-size:16px;color:#ffabc8">三、外置语音与字幕</b><br>语音在设置 → 角色语音中配置外置接口；字幕识别在设置 → 语音转文字中配置，也可以在放映室手动导入 SRT / VTT。未配置时不发送请求。
    </div>

    <div style="padding:13px 0;border-top:1px solid rgba(255,255,255,.12)">
      <b style="font-size:15px;color:#ffd0df">四、角色、世界书与记忆</b><br>
      · 人设适合写身份、性格、说话方式、关系、习惯和重要经历；临时事件交给聊天与记忆。<br>
      · 世界书写共同世界设定，并通过世界书里的应用开关决定哪些软件读取。<br>
      · 上下文负责近期对话，记忆负责长期事件。上下文越长通常花费越高、等待越久，不代表越长一定越好。<br>
      · 微信和线下约会可分别选择主模型或副模型总结；总结失败时先使用“重新总结”，不要直接清记录。<br>
      · 新一场线下约会会保留过往总结并标记时间；约会进行中微信角色消息会暂停，结束后恢复。
    </div>

    <div style="padding:13px 0;border-top:1px solid rgba(255,255,255,.12)">
      <b style="font-size:15px;color:#ffd0df">五、数据、备份与换设备</b><br>
      · 角色、聊天、设置、美化和多数记录主要保存在当前浏览器，不要随意清除网站数据或浏览器存储。<br>
      · 定期在<b>设置 → 备份</b>使用云同步或导出备份文件。换设备前先导出，导入后检查角色、聊天和设置。<br>
      · “导出美化 / 导入美化”只处理壁纸、图标、头像、气泡和音乐背景，不会覆盖聊天、人设或API。<br>
      · “清理缓存垃圾”不会删角色、文字聊天和美化；清空聊天或全部数据不可恢复，操作前先备份。<br>
      · 聊天、角色与图片数据请定期备份。
    </div>

    <div style="padding:13px 0;border-top:1px solid rgba(255,255,255,.12)">
      <b style="font-size:15px;color:#ffd0df">六、常见报错</b><br>
      · <b>400</b>：请求格式或模型名不兼容，检查模型名、接口协议和功能支持。<br>
      · <b>401</b>：Key无效、过期或复制错误，去掉空格、引号和“Bearer”。<br>
      · <b>402</b>：接口余额或AI点数不足，先确认是哪一套账户在计费。<br>
      · <b>403</b>：Key无权限，或平台限制地区、IP、分组。<br>
      · <b>404</b>：Base URL、接口路径或模型不存在，确认地址是否应带 /v1。<br>
      · <b>408 / timeout</b>：网络或模型太慢，不要连续发送，稍后重试。<br>
      · <b>429</b>：请求过快、并发限制、渠道拥堵或额度上限，等待后再试。<br>
      · <b>500</b>：平台内部错误；若提示“模型无可用渠道”，需要平台为该模型挂载线路。<br>
      · <b>501</b>：当前路径或功能未实现，常见于只兼容聊天、不兼容生图或语音。<br>
      · <b>502 / 503 / 504</b>：上游故障、维护、拥堵或网关超时。<br>
      · <b>Failed to fetch / Network / CORS</b>：网页没连到接口，或平台不允许浏览器跨域。<br>
      · 返回 <b>&lt;!doctype html&gt;</b>：填的是网页首页/注册页，或请求被跳转到网页，不是真正的API Base URL。
    </div>

    <div style="padding:13px 0;border-top:1px solid rgba(255,255,255,.12)">
      <b style="font-size:15px;color:#ffd0df">七、黑屏、打不开或还是旧版本</b><br>
      1. 先等约10秒，启动失败时会出现中文修复页。<br>
      2. 点“修复页面缓存后重开”，这不会主动删除角色、聊天或密钥。<br>
      3. 安卓更新 <b>Chrome</b> 和 <b>Android System WebView</b>，再用Chrome打开；微信/QQ内置浏览器兼容性可能较差。<br>
      4. Safari或PWA仍是旧版时，彻底关闭后重开，必要时从首页入口进入，不要先清网站数据。<br>
      5. 反馈问题请带：版本号、手机型号与系统、浏览器、操作步骤和完整截图；API Key 与付款隐私要打码。
    </div>
  </div>
  <div class="btns" style="margin-top:14px"><button class="btn p" onclick="closeModal()">我知道了</button></div>`);
  if(section==='ai')setTimeout(()=>{const box=document.getElementById('manual_scroll'),target=document.getElementById('manual_ai');if(box&&target)box.scrollTop=Math.max(0,target.offsetTop-box.offsetTop-6);},30);}
const PHONE_NOTICE_ACCEPTED_KEY='north_ai_account_notice_accepted';
let _phoneNoticeRequired=false;
function phoneNoticeAccepted(){try{return localStorage.getItem(PHONE_NOTICE_ACCEPTED_KEY)==='1';}catch(_){return false;}}
function phoneNoticeContent(){return `<div style="line-height:1.75;font-size:13px;color:#bbb">
    <p>欢迎来到小手机。</p>
    <p>这里的角色由人工智能生成，是基于设定与用户互动的虚拟角色，并非现实中的真人。AI可能会出现理解偏差、虚构内容或不准确回复，请理性看待互动内容。</p>
    <p>小手机希望为大家提供轻松、有趣的陪伴体验，但AI无法替代现实中的亲友关系，也无法代替专业人士提供医疗、心理、法律、金融等方面的帮助。</p>
    <p>本产品主要面向成年用户。未满18岁的用户如需使用或购买相关服务，请提前取得监护人同意，并遵守相关年龄限制。</p>
    <p>请大家理性体验、合理消费，不上传他人的隐私信息、照片、声音或违法违规内容。</p>
    <p>购买前请确认相关价格、规则及消耗说明。正常调用成功产生的消耗不支持退还，调用失败将按照页面规则处理，法律另有规定的除外。</p>
    <p>感谢大家喜欢小手机，希望它能给大家带来快乐和陪伴</p>
  </div>`;}
function showPhoneNotice(required){_phoneNoticeRequired=required!==false;openModal(`<h3 style="text-align:center">小手机使用须知</h3>
  ${phoneNoticeContent()}
  <div class="hint" style="margin-top:10px">继续进入，即表示您已阅读并同意以上内容。</div>
  ${_phoneNoticeRequired?`<div class="btns" style="margin-top:14px"><button class="btn g" onclick="exitPhoneNotice()">暂不进入</button><button class="btn p" onclick="acceptPhoneNotice()">我已阅读并同意</button></div>`:
  `<div class="btns" style="margin-top:14px"><button class="btn p" onclick="closeModal()">我知道了</button></div>`}`);}
function acceptPhoneNotice(){try{localStorage.setItem(PHONE_NOTICE_ACCEPTED_KEY,'1');}catch(_){} _phoneNoticeRequired=false;closeModal();}
function exitPhoneNotice(){_phoneNoticeRequired=false;closeModal();if(typeof cur==='function'&&cur().p==='aiaccount')back();}
function maybePhoneNotice(){try{if(!gateOK()||phoneNoticeAccepted())return false;if(_phoneNoticeRequired)return true;showPhoneNotice(true);return true;}catch(_){return false;}}
function maybeFirstRun(){try{if(!gateOK())return;if(localStorage.getItem('yibei_manual_seen'))return;
    const noContacts=!(S.contacts||[]).filter(c=>!c.deleted).length;
    const noKey=!(S.settings&&S.settings.chat&&S.settings.chat.key);
    if(noContacts&&noKey){localStorage.setItem('yibei_manual_seen','1');showManual();}}catch(e){}}
function licenseMarkUnlocked(){try{localStorage.setItem('yibei_unlocked',String(SHARE_EPOCH));}catch(e){}}
function licenseFinishGate(){licenseMarkUnlocked();const g=document.getElementById('gate');if(g)g.remove();render();setTimeout(maybeFirstRun,400);}
function licenseEvictedNotice(result){const a=result&&result.session&&result.session.evicted;if(a&&a.length)toast('已恢复，并退出最早的'+(appleHomeCompatNative()?'授权设备：':'浏览器：')+a.join('、'));}
async function licensePostActivationSetup(){
  try{await pfEnsure(true);}catch(_){}
  try{await licenseSyncPhoneFriendIdentity(true);}catch(_){}
  try{
    await NorthLicense.bindPasskey();
    toast(appleHomeCompatNative()?'手机验证已绑定，以后重装或换设备可通过扫脸或指纹恢复':'已绑定手机，以后换浏览器可通过扫脸或指纹恢复');
  }catch(bindErr){const m=(bindErr&&bindErr.message)||'';if(!/取消/.test(m))toast(m+'；设备恢复必须使用扫脸或指纹');}
}
function showGate(){if(gateOK())return;let el=document.getElementById('gate');
  if(!el){el=document.createElement('div');el.id='gate';el.className='gate';document.body.appendChild(el);}
  el.innerHTML='<div class="glogo">'+svgIc('lock',30,'#fff')+'</div><h2>'+(window.__SMALL_PHONE_PRIVATE__?'小手机':'North')+'</h2><p>第一次使用请输入邀请码<br>邀请码成功后永久失效</p><input id="gateInp" inputmode="text" placeholder="邀请码" autocomplete="one-time-code"><button id="gateBtn">使用邀请码进入</button><div class="gerr" id="gateErr"></div><div class="gline"><span>已经在这部手机使用过</span></div><button id="gateRestore" class="gsecondary">扫脸 / 指纹恢复授权</button><div class="hint" style="margin-top:12px;text-align:center">设备恢复只允许使用本人的人脸或指纹验证</div>';
  const inp=document.getElementById('gateInp'),err=document.getElementById('gateErr'),btn=document.getElementById('gateBtn'),restore=document.getElementById('gateRestore');
  let busy=false;
  const setBusy=(on,label)=>{busy=on;[btn,restore].forEach(x=>{if(x)x.disabled=on;});if(label)err.textContent=label;};
  const tryIn=async()=>{if(busy)return;const v=normalizeInviteCode(inp.value);inp.value=v;if(!v){err.textContent='请输入邀请码';inp.focus();return;}
    if(SHARE_PW&&v===SHARE_PW){licenseFinishGate();return;}
    if(!window.NorthLicense){err.textContent='授权组件没有加载，请刷新页面';return;}
    setBusy(true,'正在核销邀请码…');btn.textContent='验证中…';
    try{
      await NorthLicense.activate(v);licenseMarkUnlocked();licenseFinishGate();licensePostActivationSetup();
    }catch(e){err.textContent=(e&&e.message)||'邀请码验证失败';inp.value='';inp.focus();}
    finally{setBusy(false,'');btn.textContent='使用邀请码进入';}};
  const tryRestore=async()=>{if(busy)return;if(!window.NorthLicense){err.textContent='授权组件没有加载，请刷新页面';return;}setBusy(true,'请按手机提示完成验证…');restore.textContent='等待手机验证…';
    try{const result=await NorthLicense.restorePasskey();try{await licenseSyncPhoneFriendIdentity(true);}catch(_){}licenseFinishGate();licenseEvictedNotice(result);}catch(e){err.textContent=(e&&e.message)||'恢复授权失败';}
    finally{setBusy(false,'');restore.textContent='扫脸 / 指纹恢复授权';}};
  btn.onclick=tryIn;restore.onclick=tryRestore;
  inp.onkeydown=e=>{if(e.key==='Enter')tryIn();};
  setTimeout(()=>{if(document.getElementById('gate'))inp.focus();},120);}
//@@ web
let _licenseCheckBusy=false,_licenseCheckFailures=0,_licenseCheckNextAt=0;
async function licenseCheckSession(){const now=Date.now();if(_licenseCheckBusy||now<_licenseCheckNextAt||!window.NorthLicense||!NorthLicense.isManaged()||!NorthLicense.session())return;_licenseCheckBusy=true;
  try{await NorthLicense.check();_licenseCheckFailures=0;_licenseCheckNextAt=0;try{await licenseSyncPhoneFriendIdentity();}catch(_){}}
  catch(e){if(e&&e.server&&e.code==='license-admin-blocked'){_licenseCheckFailures=0;_licenseCheckNextAt=0;NorthLicense.clearSession();try{localStorage.removeItem('yibei_unlocked');}catch(_){}showGate();toast('该授权已被管理员移出');}else if(e&&e.server||e&&e.network){_licenseCheckFailures=Math.min(8,_licenseCheckFailures+1);_licenseCheckNextAt=Date.now()+Math.min(30*60000,60000*Math.pow(2,_licenseCheckFailures-1));}}
//@@ private
const LICENSE_CHECK_STARTUP_DELAY_MS=12000,LICENSE_CHECK_SUCCESS_COOLDOWN_MS=300000,LICENSE_CHECK_ROUTE_QUIET_MS=4000,LICENSE_CHECK_ROUTE_MAX_DEFER_MS=15000;
const _licenseCheckBootAt=Date.now();
let _licenseCheckBusy=false,_licenseCheckFailures=0,_licenseCheckNextAt=0,_licenseCheckLastSuccessAt=0,_licenseCheckTimer=0,_licenseCheckTimerDue=0,_licenseCheckSource='unknown',_licenseRouteActivityAt=Date.now(),_licenseRouteDeferralAt=0,_licenseIdentityTimer=0,_licenseIdentitySource='unknown',_licenseIdentityBusy=false;
function licenseNoteRouteActivity(){_licenseRouteActivityAt=Date.now();}
function licenseRouteQuietDelay(){return Math.max(0,LICENSE_CHECK_ROUTE_QUIET_MS-(Date.now()-_licenseRouteActivityAt));}
function licenseScheduleCheck(delay,source){const now=Date.now(),requested=now+Math.max(0,Number(delay)||0),startupAt=_licenseCheckBootAt+LICENSE_CHECK_STARTUP_DELAY_MS,cooldownAt=_licenseCheckLastSuccessAt?_licenseCheckLastSuccessAt+LICENSE_CHECK_SUCCESS_COOLDOWN_MS:0,due=Math.max(requested,startupAt,cooldownAt,_licenseCheckNextAt||0);if(_licenseCheckTimer&&_licenseCheckTimerDue<=due)return _licenseCheckTimerDue;if(_licenseCheckTimer)clearTimeout(_licenseCheckTimer);_licenseCheckSource=String(source||'scheduled').slice(0,24);_licenseCheckTimerDue=due;_licenseCheckTimer=setTimeout(()=>{_licenseCheckTimer=0;_licenseCheckTimerDue=0;const source=_licenseCheckSource,started=northNativeBackgroundTask('license-session',()=>licenseCheckSession({source}));if(started===false)licenseScheduleCheck(PRIVATE_RESUME_SYNC_RETRY_MS,source);},Math.max(0,due-now));return due;}
function licenseIdentityTrace(event,fields){if(typeof window.__smallPhoneLicenseIdentityTrace!=='function')return;try{window.__smallPhoneLicenseIdentityTrace(Object.assign({event},fields||{}));}catch(_){}}
function licenseManagedIdentitySyncPlan(){if(!window.NorthLicense||!NorthLicense.isManaged()||!NorthLicense.session())return {needed:false,aiNeeded:false,phoneFriendNeeded:false,reason:'unavailable'};try{const s=NorthLicense.session(),p=phoneFriendState(),aiExpected=(s.sessionId||s.licenseId)+'|'+aiCoreUrl(),phoneExpected=(s.sessionId||s.licenseId)+'|'+p.id,aiMark=localStorage.getItem('north_license_ai_sync_v2')||'',phoneMark=localStorage.getItem('north_license_phone_friend_sync_v1')||'',aiNeeded=aiMark!==aiExpected,phoneFriendNeeded=phoneMark!==phoneExpected;return {needed:aiNeeded||phoneFriendNeeded,aiNeeded,phoneFriendNeeded,reason:aiNeeded||phoneFriendNeeded?'identity-changed':'already-synced'};}catch(_){return {needed:true,aiNeeded:true,phoneFriendNeeded:true,reason:'state-unavailable'};}}
function licenseScheduleManagedIdentitySync(delay,source){const plan=licenseManagedIdentitySyncPlan(),why=String(source||'scheduled').slice(0,24);if(!plan.needed){licenseIdentityTrace('license.identityAutoSkipped',{source:why,reason:plan.reason,aiNeeded:false,phoneFriendNeeded:false});return 0;}if(_licenseIdentityTimer)clearTimeout(_licenseIdentityTimer);_licenseIdentitySource=why;licenseIdentityTrace('license.identityAutoScheduled',{source:why,reason:plan.reason,aiNeeded:plan.aiNeeded,phoneFriendNeeded:plan.phoneFriendNeeded,delayMs:Math.max(0,Number(delay)||0)});_licenseIdentityTimer=setTimeout(()=>{_licenseIdentityTimer=0;const source=_licenseIdentitySource,started=northNativeBackgroundTask('license-identities',()=>licenseSyncManagedIdentities({source}));if(started===false)licenseScheduleManagedIdentitySync(PRIVATE_RESUME_SYNC_RETRY_MS,source);},Math.max(0,Number(delay)||0));return _licenseIdentityTimer;}
async function licenseSyncManagedIdentities(options){if(_licenseIdentityBusy||!window.NorthLicense||!NorthLicense.isManaged()||!NorthLicense.session())return;const source=String(options&&options.source||'direct').slice(0,24);if(typeof document!=='undefined'&&document.hidden){licenseScheduleManagedIdentitySync(2500,source);return;}const quiet=licenseRouteQuietDelay();if(quiet>0){licenseScheduleManagedIdentitySync(quiet+250,source);return;}const plan=licenseManagedIdentitySyncPlan();if(!plan.needed){licenseIdentityTrace('license.identityAutoSkipped',{source,reason:plan.reason,aiNeeded:false,phoneFriendNeeded:false});return;}_licenseIdentityBusy=true;licenseIdentityTrace('license.identityAutoStarted',{source,reason:plan.reason,aiNeeded:plan.aiNeeded,phoneFriendNeeded:plan.phoneFriendNeeded});try{if(plan.aiNeeded)try{}catch(_){}if(plan.phoneFriendNeeded)try{await licenseSyncPhoneFriendIdentity();}catch(_){}}finally{_licenseIdentityBusy=false;}}
async function licenseCheckSession(options){const now=Date.now();if(_licenseCheckBusy||now<_licenseCheckNextAt||!window.NorthLicense||!NorthLicense.isManaged()||!NorthLicense.session())return;if(typeof document!=='undefined'&&document.hidden){licenseScheduleCheck(2500,'hidden');return;}const quiet=licenseRouteQuietDelay();if(quiet>0){if(!_licenseRouteDeferralAt)_licenseRouteDeferralAt=now;if(now-_licenseRouteDeferralAt<LICENSE_CHECK_ROUTE_MAX_DEFER_MS){licenseScheduleCheck(quiet+250,'route-quiet');return;}}_licenseRouteDeferralAt=0;_licenseCheckBusy=true;
  try{await NorthLicense.check();_licenseCheckFailures=0;_licenseCheckNextAt=0;_licenseCheckLastSuccessAt=Date.now();licenseScheduleManagedIdentitySync(1800,'post-check');}
  catch(e){if(e&&e.server&&e.code==='license-admin-blocked'){_licenseCheckFailures=0;_licenseCheckNextAt=0;NorthLicense.clearSession();try{localStorage.removeItem('yibei_unlocked');}catch(_){}showGate();toast('该授权已被管理员移出');}else if(e&&e.server||e&&e.network){_licenseCheckFailures=Math.min(8,_licenseCheckFailures+1);_licenseCheckNextAt=Date.now()+Math.min(30*60000,60000*Math.pow(2,_licenseCheckFailures-1));licenseScheduleCheck(0,'backoff');}}
//@@ end
  finally{_licenseCheckBusy=false;}}
