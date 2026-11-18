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
/* ---------- 放映室：单角色陪看 / 陪读 ---------- */
let _cin={videoUrl:'',videoFile:null,videoInfo:null,videoErrorShown:false,videoRetryCount:0,remote:false,provider:'',externalId:'',externalReady:false,externalPaused:true,externalTimer:null,bookText:'',bookPages:[],cues:[],subtitleName:'',sessionId:'',mediaKey:'',busy:false,token:0,lastSaveAt:0,lane:0,wantPlay:false,extracting:false,asrMode:'',asrCoveredUntil:0,asrGuardPaused:false,visionBusy:false,voiceSubTimer:null,shootQueue:[],shootBusy:false,shootTimer:null,shootNode:null,shootResolve:null,shootEpoch:0,micKind:'',micBusy:false,micSR:null,micIgnoreUntil:0,micKeepVideoPlaying:false,micVideoPlayToken:0,topOpen:true,chatOpen:false,mediaOpen:true};
function cinemaInit(){
  if(!S.cinema||typeof S.cinema!=='object')S.cinema={};
  const x=S.cinema,oldSettings=x.settings&&typeof x.settings==='object'?x.settings:{},hadBookVoice=typeof oldSettings.bookVoice==='boolean',hadDisplay=oldSettings.commentDisplay==='barrage'||oldSettings.commentDisplay==='subtitle',hadCompanion=oldSettings.companionMode==='quiet'||oldSettings.companionMode==='soft'||oldSettings.companionMode==='lively';x.settings=Object.assign({danmaku:true,commentDisplay:'barrage',captionSpeed:'base',autoComment:true,visionEnabled:true,autoVision:false,visionInterval:150,visionOnAsk:true,visionByRole:true,voiceComment:false,bookVoice:false,voiceLang:'role',chatPanelHeight:104,readerPaneHeight:0,replyCount:1,companionMode:'soft',autoLimit:4},oldSettings);delete x.settings.transcribe;delete x.settings.bookInputHeight;delete x.settings.barrageFx;delete x.settings.youkuClientId;if(!hadBookVoice)x.settings.bookVoice=!!x.settings.voiceComment;if(!hadDisplay)x.settings.commentDisplay=oldSettings.danmaku===false?'subtitle':'barrage';if(!hadCompanion)x.settings.companionMode=oldSettings.autoComment===false?'quiet':'soft';x.settings.autoComment=x.settings.companionMode!=='quiet';x.settings.danmaku=x.settings.commentDisplay==='barrage';if(!['faster','base','slower','slowest'].includes(x.settings.captionSpeed))x.settings.captionSpeed='base';x.settings.visionInterval=Math.max(30,Math.min(900,+x.settings.visionInterval||150));x.settings.replyCount=Math.max(1,Math.min(5,+x.settings.replyCount||1));x.settings.autoLimit=Math.max(0,Math.min(20,+x.settings.autoLimit||4));if(!['quiet','soft','lively'].includes(x.settings.companionMode))x.settings.companionMode='soft';if(!['role','zh','yue','en','ja','ko'].includes(x.settings.voiceLang))x.settings.voiceLang='role';x.sessions=Array.isArray(x.sessions)?x.sessions:[];x.library=(Array.isArray(x.library)?x.library:[]).filter(item=>!(item&&item.source==='platform'&&item.provider==='youku'));x.progress=x.progress||{};x.asrTasks=x.asrTasks&&typeof x.asrTasks==='object'?x.asrTasks:{};
  const uniqueTasks={};Object.values(x.asrTasks).filter(t=>t&&t.id).sort((a,b)=>(a.updatedAt||0)-(b.updatedAt||0)).forEach(t=>{const id=t.mediaKey?cinemaStoreKey('asr-task',t.mediaKey):t.id;uniqueTasks[id]=Object.assign({},t,{id});});x.asrTasks=uniqueTasks;
  const roles=(S.contacts||[]).filter(c=>c&&!c.deleted&&!c.blocked);
  if(!roles.some(c=>c.id===x.selectedCid))x.selectedCid=roles[0]?roles[0].id:'';
  return x;
}
function cinemaRole(){cinemaInit();return getC(S.cinema.selectedCid);}
function cinemaSession(){cinemaInit();return S.cinema.sessions.find(x=>x&&x.id===_cin.sessionId)||null;}
function cinemaRoleOccupied(cid){const p=cur().p,s=(p==='cinemawatch'||p==='cinemaread')&&cinemaSession();return !!(s&&s.status==='active'&&s.cid===cid);}
function cinemaRoleName(c){return c?esc(c.remark||c.name):'未选择';}
function cinemaFmt(sec){sec=Math.max(0,Math.floor(+sec||0));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');}
function cinemaDate(ts){const d=new Date(ts||Date.now());return (d.getMonth()+1)+'月'+d.getDate()+'日 '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function cinemaFriendlyTitle(name,fallback){const raw=String(name||'').replace(/\.[^.]+$/,'').trim();return !raw||/^[a-z0-9_-]{20,}$/i.test(raw)?(fallback+' · '+cinemaDate(Date.now()).replace(/\s.*$/,'')):raw;}
function cinemaProgressText(s){if(!s)return'';if(s.kind==='book')return '读到 '+Math.min((s.page||0)+1,s.totalPages||1)+' / '+(s.totalPages||1)+' 页';return (s.status==='finished'?'看至 ':'进度 ')+cinemaFmt(s.progress||0)+(s.duration?' / '+cinemaFmt(s.duration):'');}
function cinemaAsrTaskRows(){const seen=new Set();return Object.values(cinemaInit().asrTasks||{}).filter(x=>x&&x.id).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).filter(x=>{const key=x.mediaKey||x.id;if(seen.has(key))return false;seen.add(key);return true;});}
function cinemaAsrTaskDisplayWait(t,running){if(!t)return'正在估算等待时间';if(t.status==='done')return'无需等待 · 已完整保存';if(t.status==='error')return'已暂停 · 可从断点续提';const remainingSeconds=Math.max(60,(+t.duration||0)-(+t.coveredSeconds||0)),low=Math.max(1,Math.ceil(remainingSeconds/600)),high=Math.max(low+1,Math.ceil(remainingSeconds/180)),raw=String(t.waitText||''),m=raw.match(/约还需\s*(\d+)\s*分钟/),unstableLimit=Math.max(10,Math.ceil(remainingSeconds/60)*3);if(!running)return'已保留进度 · 继续后预计 '+low+'～'+high+' 分钟';if(m&&+m[1]>unstableLimit)return'识别服务速度波动，剩余时间暂不稳定';return raw||('预计还需 '+low+'～'+high+' 分钟');}
function cinemaAsrTasksHTML(){const rows=cinemaAsrTaskRows();if(!rows.length)return'';return `<section class="cin-asr-tasks"><div class="cin-section-head"><b>字幕提取任务</b><span>主页面可随时查看</span></div><div class="cin-asr-task-row">${rows.slice(0,6).map(x=>{const pct=Math.max(0,Math.min(100,+x.percent||0)),running=x.status==='working'&&_cin.extracting&&_cin.mediaKey===x.mediaKey,state=x.status==='done'?'已完成':x.status==='error'?'可续提':running?'后台提取中':'等待继续',waitText=cinemaAsrTaskDisplayWait(x,running);return `<button class="cin-asr-task ${running?'working':x.status==='working'?'paused':x.status||'working'}" onclick="cinemaAsrTaskOpen('${x.id}')"><i style="--p:${pct}%"><b>${pct}%</b></i><span><b>${esc(x.title||'未命名影片')}</b><small>${state} · ${Math.max(0,+x.completed||0)} / ${Math.max(1,+x.total||1)} 段<br>${esc(waitText)}</small></span></button>`;}).join('')}</div></section>`;}
function cinemaAsrTaskFind(id){return cinemaAsrTaskRows().find(x=>x.id===id)||null;}
function cinemaAsrRemainingText(job,total,completed,duration){if(job&&job.status==='done')return'无需等待 · 已完整保存';if(job&&job.status==='error')return'已暂停 · 可从断点续提';const left=Math.max(0,Math.max(1,+total||1)-Math.max(0,+completed||0));if(!left)return'正在完成最后整理';const parts=Object.values(job&&job.parts&&typeof job.parts==='object'?job.parts:{}).sort((a,b)=>(+a.end||0)-(+b.end||0)),samples=parts.map(x=>+x.processingMs||0).filter(x=>x>=1000&&x<=30*60*1000).slice(-4),covered=cinemaAsrContiguousSeconds(job),remainingSeconds=Math.max(0,(+duration||0)-covered)||Math.max(60,(+duration||0)*left/Math.max(1,+total||1));if(samples.length){const activeMs=samples.reduce((n,v)=>n+v,0)/samples.length,leftMinutes=Math.max(1,Math.ceil(activeMs*left/60000)),unstableLimit=Math.max(10,Math.ceil(remainingSeconds/60)*3);return leftMinutes>unstableLimit?'识别服务速度波动，剩余时间暂不稳定':'约还需 '+leftMinutes+' 分钟';}const low=Math.max(1,Math.ceil(remainingSeconds/600)),high=Math.max(low+1,Math.ceil(remainingSeconds/180));return'预计还需 '+low+'～'+high+' 分钟';}
function cinemaAsrTaskUpdate(s,job,patch){if(!s||!s.mediaKey)return null;const x=cinemaInit(),id=cinemaStoreKey('asr-task',s.mediaKey),parts=job&&job.parts&&typeof job.parts==='object'?job.parts:{},completed=Object.keys(parts).length,total=Math.max(1,Number(job&&job.totalSegments)||Number(patch&&patch.total)||completed||1),covered=cinemaAsrContiguousSeconds(job),duration=Number(job&&job.duration)||Number(s.duration)||0,percent=job&&job.status==='done'?100:Math.max(0,Math.min(99,Math.round(covered/Math.max(1,duration)*100))),lib=x.library.find(v=>v&&v.mediaKey===s.mediaKey),old=x.asrTasks[id]||{},startedAt=Number(job&&job.startedAt)||Number(old.startedAt)||Date.now(),waitText=cinemaAsrRemainingText(job,total,completed,duration);Object.keys(x.asrTasks).forEach(k=>{if(k!==id&&x.asrTasks[k]&&x.asrTasks[k].mediaKey===s.mediaKey)delete x.asrTasks[k];});x.asrTasks[id]=Object.assign(old,{id,mediaKey:s.mediaKey,libraryId:(lib&&lib.id)||s.libraryId||old.libraryId||'',sessionId:s.id,title:s.title||old.title||'未命名影片',status:job&&job.status||old.status||'working',completed,total,percent,coveredSeconds:covered,duration,startedAt,waitText,updatedAt:Date.now()},patch||{});save();if(cur().p==='cinema')cinemaRenderKeepScroll();return x.asrTasks[id];}
function cinemaAsrWatchCurrent(){if(_cin.extracting)_cin.asrMode='watch';closeModal();go('cinemawatch');}
async function cinemaAsrTaskResume(id){const t=cinemaAsrTaskFind(id);if(!t)return toast('这条字幕任务已不存在');const same=_cin.mediaKey===t.mediaKey&&!!_cin.videoFile;if(t.status==='done'){if(same)return cinemaAsrWatchCurrent();if(t.libraryId)return cinemaLibraryPlay(t.libraryId,false);return toast('完整字幕仍在，但源视频需要重新关联');}if(_cin.extracting){if(_cin.mediaKey===t.mediaKey)return cinemaAsrWatchCurrent();return toast('另一部视频正在提取字幕，请稍后再继续');}closeModal();if(!same&&t.libraryId)await cinemaLibraryPlay(t.libraryId,false);if(_cin.mediaKey!==t.mediaKey||!_cin.videoFile)return toast('源视频不在本机，请先在视频盒重新关联');go('cinemawatch');setTimeout(()=>cinemaExtractAudioSubtitles(90,'background'),80);}
function cinemaAsrTaskOpen(id){const t=cinemaAsrTaskFind(id);if(!t)return toast('这条字幕任务已不存在');const running=t.status==='working'&&_cin.extracting&&_cin.mediaKey===t.mediaKey,done=t.status==='done',same=_cin.mediaKey===t.mediaKey&&!!_cin.videoUrl,left=Math.max(1,(+t.total||1)-(+t.completed||0)),waitText=cinemaAsrTaskDisplayWait(t,running);let action='';if(running)action=`<button class="btn p" onclick="cinemaAsrWatchCurrent()">边看边继续提取</button>`;else if(done&&(same||t.libraryId))action=`<button class="btn p" onclick="${same?'cinemaAsrWatchCurrent()':`closeModal();cinemaLibraryPlay('${t.libraryId}',false)`}">查看完整字幕</button>`;else if(same||t.libraryId)action=`<button class="btn p" onclick="cinemaAsrTaskResume('${t.id}')">继续提取剩余 ${left} 段</button>`;openModal(`<h3>字幕提取进度</h3><div class="cin-asr-detail ${running?'working':t.status==='working'?'paused':t.status||'working'}"><i style="--p:${Math.max(0,Math.min(100,+t.percent||0))}%"><b>${Math.max(0,Math.min(100,+t.percent||0))}%</b></i><div><b>${esc(t.title||'未命名影片')}</b><span>${done?'完整字幕已保存在本机':running?'正在后台逐段识别':'任务已中断，继续后会从下一段接着提取；已完成部分不会重复提取或扣点'}<br>已完成 ${Math.max(0,+t.completed||0)} / ${Math.max(1,+t.total||1)} 段 · 覆盖到 ${cinemaFmt(t.coveredSeconds||0)}<br>${esc(waitText)}</span></div></div><div class="btns"><button class="btn g" onclick="closeModal();cinemaAsrTaskOpen('${t.id}')">刷新进度</button>${action}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
//@@ web
function cinDB(){return new Promise((res,rej)=>{let settled=false;const r=indexedDB.open('yibeiCinema',1),fail=()=>{if(settled)return;settled=true;rej(r.error||new Error('Cinema storage unavailable'));};r.onupgradeneeded=e=>{try{e.target.result.createObjectStore('media');}catch(_){}};r.onsuccess=e=>{if(settled){try{e.target.result.close();}catch(_){}return;}settled=true;const db=e.target.result;db.onversionchange=()=>{try{db.close();}catch(_){}};res(db);};r.onerror=fail;r.onblocked=fail;});}
function cinPut(k,v){return cinDB().then(db=>new Promise((res,rej)=>{let tx;try{tx=db.transaction('media','readwrite');tx.objectStore('media').put(v,k);}catch(e){try{db.close();}catch(_){}rej(e);return;}const done=(ok,e)=>{try{db.close();}catch(_){}ok?res():rej((e&&e.target&&e.target.error)||tx.error||new Error('Cinema storage write failed'));};tx.oncomplete=()=>done(true);tx.onerror=e=>done(false,e);tx.onabort=e=>done(false,e);}));}
function cinGet(k){return cinDB().then(db=>new Promise(res=>{let value=null,tx;try{tx=db.transaction('media','readonly');const q=tx.objectStore('media').get(k);q.onsuccess=()=>{value=q.result;};q.onerror=()=>{};}catch(_){try{db.close();}catch(__){}res(null);return;}const done=()=>{try{db.close();}catch(_){}res(value);};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>null);}
function cinDel(k){return cinDB().then(db=>new Promise(res=>{let tx;try{tx=db.transaction('media','readwrite');tx.objectStore('media').delete(k);}catch(_){try{db.close();}catch(__){}res();return;}const done=()=>{try{db.close();}catch(_){}res();};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>{});}
//@@ private
function cinDB(owner){return new Promise((res,rej)=>{let settled=false;const r=indexedDB.open(typeof privateScopedDatabaseName==='function'?privateScopedDatabaseName('yibeiCinema',owner):'yibeiCinema',1),fail=()=>{if(settled)return;settled=true;rej(r.error||new Error('Cinema storage unavailable'));};r.onupgradeneeded=e=>{try{e.target.result.createObjectStore('media');}catch(_){}};r.onsuccess=e=>{if(settled){try{e.target.result.close();}catch(_){}return;}settled=true;const db=e.target.result;db.onversionchange=()=>{try{db.close();}catch(_){}};res(db);};r.onerror=fail;r.onblocked=fail;});}
function cinPut(k,v,owner){return cinDB(owner).then(db=>new Promise((res,rej)=>{let tx;try{tx=db.transaction('media','readwrite');tx.objectStore('media').put(v,k);}catch(e){try{db.close();}catch(_){}rej(e);return;}const done=(ok,e)=>{try{db.close();}catch(_){}ok?res():rej((e&&e.target&&e.target.error)||tx.error||new Error('Cinema storage write failed'));};tx.oncomplete=()=>done(true);tx.onerror=e=>done(false,e);tx.onabort=e=>done(false,e);}));}
function cinGet(k,owner){return cinDB(owner).then(db=>new Promise(res=>{let value=null,tx;try{tx=db.transaction('media','readonly');const q=tx.objectStore('media').get(k);q.onsuccess=()=>{value=q.result;};q.onerror=()=>{};}catch(_){try{db.close();}catch(__){}res(null);return;}const done=()=>{try{db.close();}catch(_){}res(value);};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>null);}
function cinDel(k,owner){return cinDB(owner).then(db=>new Promise(res=>{let tx;try{tx=db.transaction('media','readwrite');tx.objectStore('media').delete(k);}catch(_){try{db.close();}catch(__){}res();return;}const done=()=>{try{db.close();}catch(_){}res();};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>{});}
//@@ end
function cinemaStoreKey(kind,key){let h=2166136261;for(const ch of String(key||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return '__cinema_'+kind+'_'+(h>>>0).toString(36);}
function cinemaContextRounds(){return Math.max(2,Math.min(40,+((S.settings||{}).hist)||12));}
function cinemaComposerHeight(){const set=cinemaInit().settings,vh=typeof window!=='undefined'&&window.innerHeight||640,max=Math.max(112,Math.min(360,Math.round(vh*.48)));return Math.max(72,Math.min(max,+set.chatPanelHeight||104));}
function cinemaApplyComposerHeight(height,persist){const set=cinemaInit().settings,vh=typeof window!=='undefined'&&window.innerHeight||640,max=Math.max(112,Math.min(360,Math.round(vh*.48))),h=Math.max(72,Math.min(max,Math.round(+height||cinemaComposerHeight()))),el=$('#cinChatDock');set.chatPanelHeight=h;if(el)el.style.height=h+'px';const stage=$('#cinStage');if(stage)stage.style.setProperty('--cin-chat-h',h+'px');if(persist)save();return h;}
function cinemaComposerResizeStart(e){if(!e)return;e.preventDefault();const el=$('#cinChatDock');if(!el)return;const startY=e.clientY,startH=el.getBoundingClientRect().height,move=ev=>cinemaApplyComposerHeight(startH+(startY-ev.clientY),false),end=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);save();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);}
function cinemaReaderPaneHeight(){const set=cinemaInit().settings,vh=typeof window!=='undefined'&&window.innerHeight||720,max=Math.max(190,vh-300),fallback=Math.round(vh*.55);return Math.max(150,Math.min(max,+set.readerPaneHeight||fallback));}
function cinemaApplyReaderPaneHeight(height,persist){const set=cinemaInit().settings,vh=typeof window!=='undefined'&&window.innerHeight||720,max=Math.max(190,vh-300),h=Math.max(150,Math.min(max,Math.round(+height||cinemaReaderPaneHeight()))),el=$('#cinPaperWrap');set.readerPaneHeight=h;if(el)el.style.flexBasis=h+'px';if(persist)save();return h;}
function cinemaReaderResizeStart(e){if(!e)return;e.preventDefault();const el=$('#cinPaperWrap');if(!el)return;const startY=e.clientY,startH=el.getBoundingClientRect().height,move=ev=>cinemaApplyReaderPaneHeight(startH+(ev.clientY-startY),false),end=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);save();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);}
function cinemaStopEvent(e){if(e&&e.stopPropagation)e.stopPropagation();}
function cinemaRenderKeepScroll(){const box=$('.cin-home-scroll'),top=box?box.scrollTop:0;render();requestAnimationFrame(()=>{const next=$('.cin-home-scroll');if(next)next.scrollTop=top;});}
function cinemaLibraryHTML(kind){const rows=(cinemaInit().library||[]).filter(x=>x&&x.kind===kind).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));if(!rows.length)return `<div class="cin-shelf-empty">${kind==='video'?'导入或添加在线视频后，会在这里形成可重复观看的视频盒。':'导入作品后，会在这里形成可继续阅读的书架。'}</div>`;return `<div class="cin-shelf-row">${rows.map(x=>`<button class="cin-shelf-item ${kind}" onclick="cinemaLibraryOpen('${x.id}')"><i>${kind==='video'?svgIc('video',22,'#e8e1ed'):svgIc('book',22,'#dce8e7')}</i><b>${esc(x.title||'未命名')}</b><span>${x.source==='saving'?'正在保存…':x.source==='missing'?'需重新选择文件':x.source==='platform'?cinemaPlatformName(x.provider)+'官方播放器 · 可重播':x.source==='url'?'在线视频 · 可重播':kind==='video'?'已保存在本机':'已收入书架'}</span></button>`).join('')}</div>`;}
function cinemaHistoryHTML(){const rows=(cinemaInit().sessions||[]).slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,8);if(!rows.length)return '<div class="cin-empty">第一次放映，会从你们按下播放的那一刻开始记住。</div>';
  return rows.map(s=>{const c=getC(s.cid),live=s.id===_cin.sessionId&&s.status!=='finished'&&((s.kind==='video'&&_cin.videoUrl)||(s.kind==='book'&&_cin.bookPages.length));return `<div class="cin-history ${live?'live':''}" ${live?`onclick="cinemaResume('${s.id}')"`:''}><div class="cin-history-icon">${s.kind==='book'?svgIc('book',19,'#e9e7f4'):svgIc('video',19,'#e9e7f4')}</div><div class="cin-history-main"><b>${esc(s.title||'未命名')}</b><span>${cinemaRoleName(c)} · ${cinemaProgressText(s)}</span></div><button class="cin-view" aria-label="查看本场上下文" onclick="cinemaStopEvent(arguments[0]);cinemaSessionContext('${s.id}')">${svgIc('message',14,'#9db5c8')}</button><button class="cin-rename" aria-label="修改片名" onclick="cinemaStopEvent(arguments[0]);cinemaRename('${s.id}')">${svgIc('edit',14,'#b9b4c3')}</button><button class="cin-delete" aria-label="删除片段记忆" onclick="cinemaStopEvent(arguments[0]);cinemaDeleteSession('${s.id}')">${svgIc('trash',14,'#c88d9e')}</button><em>${live?'继续本场':s.status==='finished'?'已收进记忆':'上次离场'}</em></div>`;}).join('');}
function cinemaSessionContext(id){const s=(cinemaInit().sessions||[]).find(v=>v&&v.id===id),c=s&&getC(s.cid);if(!s)return;const rows=(s.items||[]).slice(-100),body=rows.length?rows.map(m=>`<div class="cin-memory-line ${m.who==='me'?'mine':'role'}"><b>${m.who==='me'?'我':cinemaRoleName(c)}</b><span>${s.kind==='video'?cinemaFmt(m.at||0):'第 '+((m.page||0)+1)+' 页'}</span><p>${esc(m.text||'')}</p></div>`).join(''):'<div class="empty">本场还没有聊天</div>',chars=rows.reduce((n,m)=>n+String(m.text||'').length,0)+(s.visionTrail||[]).reduce((n,m)=>n+String(m.text||'').length,0);openModal(`<h3>片段记忆 · ${esc(s.title||'未命名')}</h3><div class="hint">${cinemaRoleName(c)} · ${cinemaProgressText(s)} · 聊天 ${(s.items||[]).length} 条 · 画面 ${(s.visionTrail||[]).length} 条<br>约 ${chars} 个文字。识图只保存文字描述，不保存截图。</div><div class="cin-memory-scroll">${body}</div>${s.summary?`<details class="cin-memory-summary"><summary>查看结束总结</summary><p>${esc(s.summary)}</p></details>`:''}<div class="btns"><button class="btn g" onclick="cinemaClearSessionContext('${s.id}')">清除本场聊天上下文</button><button class="btn d" onclick="closeModal();cinemaDeleteSession('${s.id}')">删除整条片段记忆</button></div><button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function cinemaRemoveWechatContext(id){Object.keys(S.messages||{}).forEach(k=>{if(Array.isArray(S.messages[k]))S.messages[k]=S.messages[k].filter(m=>!(m&&m._cinemaSessionId===id));});}
async function cinemaClearSessionContext(id){const s=(cinemaInit().sessions||[]).find(v=>v&&v.id===id);if(!s||!await uiConfirm('清除《'+(s.title||'未命名')+'》本场聊天、字幕记录和画面文字上下文？\n\n保留播放进度、导入/提取的字幕和结束总结。'))return;s.items=[];s.transcript=[];s.visionTrail=[];s.sceneDesc='';s.sceneAt=0;if(_cin.sessionId===id)_cin.cues=_cin.cues.filter(v=>v&&v.source!=='speech');cinemaRemoveWechatContext(id);s.updatedAt=Date.now();save();closeModal();cinemaRenderKeepScroll();toast('本场聊天上下文已清除');}
async function cinemaDeleteSession(id){const x=cinemaInit(),s=x.sessions.find(v=>v&&v.id===id);if(!s||!await uiConfirm('删除《'+(s.title||'未命名')+'》这条片段记忆？\n\n会删除本场对话、画面记录和同步给角色的放映室长期记忆；视频盒或书架里的源文件不会删除。',{danger:true}))return;const c=getC(s.cid),full=summaryCleanText(c||{},'【放映室】'+(s.summary||''));if(c&&Array.isArray(c.summaries))c.summaries=c.summaries.filter(m=>!(m&&(m.cinemaSessionId===id||(s.summary&&summarySimilarity(summaryCleanText(c,m.text||''),full)>=.92))));cinemaRemoveWechatContext(id);x.sessions=x.sessions.filter(v=>v&&v.id!==id);if(!x.sessions.some(v=>v&&v.mediaKey===s.mediaKey))delete x.progress[s.mediaKey];if(_cin.sessionId===id){cinemaStopTranscribe();_cin.sessionId='';_cin.token++;}save();cinemaRenderKeepScroll();toast('片段记忆已删除，源文件仍保留');}
function renderCinema(){const x=cinemaInit(),roles=(S.contacts||[]).filter(c=>c&&!c.deleted&&!c.blocked),chosen=cinemaRole();
  const roleStrip=roles.length?roles.map(c=>`<button class="cin-role ${c.id===x.selectedCid?'on':''}" onclick="cinemaChooseRole('${c.id}')">${av(c.avatar,'sm')}<span>${esc(c.remark||c.name)}</span>${c.id===x.selectedCid?'<i>本场陪同</i>':''}</button>`).join(''):'<div class="cin-empty">还没有可邀请的角色，先去微信创建一名角色。</div>';
  return `<div class="cinema-home"><div class="cin-nav"><button onclick="back()">${calIcon('back')}</button><div><b>放映室</b><span>PRIVATE SCREENING ROOM</span></div><i>${svgIc('video',21,'#ddd9ef')}</i></div>
    <div class="cin-home-scroll"><section class="cin-session-card"><div class="cin-session-mark">${svgIc('video',20,'#e7deea',1.55)}</div><div class="cin-session-copy"><span>私人放映 · 单人陪同</span><b>${chosen?'已为 '+cinemaRoleName(chosen)+' 留座':'选择今晚的陪同角色'}</b><p>字幕与当前画面只用于理解已经播放的内容，不读取未看到的剧情。</p></div><div class="cin-session-role">${chosen?av(chosen.avatar,'sm'):'<div class="avatar sm">+</div>'}<i>${chosen?'READY':'EMPTY'}</i></div></section>${cinemaAsrTasksHTML()}
      <section class="cin-section"><div class="cin-section-head"><b>选择陪同角色</b><span>仅一名</span></div><div class="cin-role-strip">${roleStrip}</div></section>
      <section class="cin-start-grid"><button onclick="cinemaPickVideo()"><i>${svgIc('video',26,'#fff')}</i><b>一起看剧</b><span>MP4 · WebM · M4V</span><em>导入本地视频</em></button><button onclick="cinemaOpenPlatformModal()"><i>${svgIc('search',26,'#fff')}</i><b>正版视频片库</b><span>BILIBILI</span><em>粘贴B站分享链接</em></button><button onclick="cinemaOpenOnlineModal()"><i>${svgIc('link',26,'#fff')}</i><b>在线视频</b><span>DIRECT VIDEO URL</span><em>打开可播放直链</em></button><button onclick="cinemaPickBook()"><i>${svgIc('book',26,'#fff')}</i><b>一起读</b><span>TXT · MD · EPUB 检测</span><em>打开本地作品</em></button><button onclick="cinemaOpenSearchModal()"><i>${svgIc('search',26,'#fff')}</i><b>更多搜索</b><span>夸克 · 百度 · 必应</span><em>查找影片或书籍</em></button></section>
      <section class="cin-truth"><i>${svgIc('shield',18,'#aea8c5')}</i><div><b>角色怎样知道剧情？</b><p>按时间轴读取导入或提取的字幕，也可手动或定时理解当前画面。只使用已看到的内容，不偷看后文。</p></div></section>
      <section class="cin-section"><div class="cin-section-head"><b>视频盒</b><span>${x.library.filter(i=>i&&i.kind==='video').length} 部 · 可继续或重播</span></div>${cinemaLibraryHTML('video')}</section>
      <section class="cin-section"><div class="cin-section-head"><b>书架</b><span>${x.library.filter(i=>i&&i.kind==='book').length} 本</span></div>${cinemaLibraryHTML('book')}</section>
      <section class="cin-section"><div class="cin-section-head"><b>你们的片单记忆</b><span>${x.sessions.length} 场</span></div>${cinemaHistoryHTML()}</section>
    </div></div>`;}
function cinemaChooseRole(cid){const c=getC(cid);if(!c||c.deleted||c.blocked)return;cinemaInit().selectedCid=cid;save();render();}
function cinemaResume(id){const s=(cinemaInit().sessions||[]).find(x=>x&&x.id===id);if(!s||s.id!==_cin.sessionId)return toast('本地源文件已失效，请重新导入');if(s.kind==='video'&&_cin.videoUrl)go('cinemawatch');else if(s.kind==='book'&&_cin.bookPages.length)go('cinemaread');else toast('本地源文件已失效，请重新导入');}
function cinemaRequireRole(){const c=cinemaRole();if(!c){toast('先选择一名陪同角色');return null;}return c;}
function cinemaStopTranscribe(){}
function cinemaReleaseMedia(){cinemaStopTranscribe();cinemaMicCancel();cinemaClearShots();clearInterval(_cin.externalTimer);_cin.externalTimer=null;if(_cin.platformScreenShare&&privateNativeAppOn())window.SmallPhoneNative.request('screenShare.stop',{}).catch(()=>{});_cin.platformScreenShare=false;try{if(/^blob:/i.test(_cin.videoUrl||''))URL.revokeObjectURL(_cin.videoUrl);}catch(_){}_cin.videoUrl='';_cin.videoFile=null;_cin.videoInfo=null;_cin.videoErrorShown=false;_cin.videoRetryCount=0;_cin.remote=false;_cin.provider='';_cin.externalId='';_cin.externalReady=false;_cin.externalPaused=true;_cin.bookText='';_cin.bookPages=[];_cin.cues=[];_cin.subtitleName='';_cin.mediaKey='';_cin.asrMode='';_cin.asrCoveredUntil=0;_cin.asrGuardPaused=false;_cin.topOpen=true;_cin.chatOpen=false;_cin.mediaOpen=true;}
function cinemaMediaKey(f,kind){return kind+'|'+(f.name||'')+'|'+(+f.size||0)+'|'+(+f.lastModified||0);}
function cinemaWechatMessages(s){return msgsForAccount(s.cid,s.accountId||actId());}
function cinemaMirrorLifecycle(s,stage,detail){if(!s||!s.cid)return;const c=getC(s.cid),start=stage==='start',text=start?'🎬 放映室开始 · '+S.me.name+'邀请'+(c&&c.name||'角色')+(s.kind==='book'?'一起读':'一起看')+'《'+s.title+'》':'🎬 放映室结束 · 《'+s.title+'》 · '+cinemaProgressText(s)+(detail?' · '+String(detail).replace(/\s+/g,' ').slice(0,260):'');cinemaWechatMessages(s).push({role:'user',type:'sys',content:text,time:Date.now(),id:uid(),_silent:true,_cinemaCtx:true,_cinemaSessionId:s.id,_cinemaLifecycle:stage});}
function cinemaNewSession(kind,title,key){const c=cinemaRequireRole();if(!c)return null;cinemaInit();const old=S.cinema.progress[key]||{},lib=S.cinema.library.find(x=>x&&x.mediaKey===key),now=Date.now(),s={id:uid(),cid:c.id,accountId:actId(),kind,title:((lib&&lib.title)||old.title||title||'未命名').slice(0,120),mediaKey:key,libraryId:lib&&lib.id||'',startedAt:now,updatedAt:now,status:'active',progress:kind==='video'?(+old.progress||0):0,duration:+old.duration||0,page:kind==='book'?(+old.page||0):0,totalPages:0,items:[],transcript:[],visionTrail:[],autoCount:0,lastAuto:0,lastVision:0,nextVisionAt:0,summary:'',sceneDesc:'',sceneAt:0};S.cinema.sessions.push(s);if(S.cinema.sessions.length>30)S.cinema.sessions=S.cinema.sessions.slice(-30);_cin.sessionId=s.id;_cin.mediaKey=key;_cin.token++;cinemaMirrorLifecycle(s,'start');save();return s;}
function cinemaUpsertLibrary(s,data){if(!s)return null;const x=cinemaInit(),old=x.library.find(i=>i&&i.mediaKey===s.mediaKey),item=old||{id:uid(),kind:s.kind,mediaKey:s.mediaKey,createdAt:Date.now()};Object.assign(item,data||{},{title:s.title,updatedAt:Date.now()});if(!old)x.library.unshift(item);s.libraryId=item.id;save();return item;}
function cinemaPickVideo(){if(!cinemaRequireRole())return;pickFile('video/mp4,video/webm,video/quicktime,.mp4,.webm,.m4v,.mov',f=>cinemaOpenVideo(f));}
function cinemaAndroidBrowser(){return /Android/i.test(String(typeof navigator!=='undefined'&&navigator.userAgent||''))&&!privateNativeAppOn();}
function cinemaPlayableVideoBlob(blob,name,mime){if(!blob||typeof blob.slice!=='function')return blob;const label=String(name||blob.name||'').toLowerCase(),raw=String(mime||blob.type||'').toLowerCase();let target=raw;if(/\.(?:mp4|m4v)$/i.test(label))target='video/mp4';else if(/\.webm$/i.test(label))target='video/webm';else if(/\.mov$/i.test(label))target=cinemaAndroidBrowser()?'video/mp4':'video/quicktime';else if(!/^video\//.test(target)||/octet-stream/.test(target))target='video/mp4';return target&&target!==raw?blob.slice(0,blob.size,target):blob;}
function cinemaOpenVideo(f){if(!f)return;cinemaReleaseMedia();const key=cinemaMediaKey(f,'video'),title=cinemaFriendlyTitle(f.name,'未命名影片'),playable=cinemaPlayableVideoBlob(f,f.name,f.type);_cin.videoFile=f;_cin.videoUrl=URL.createObjectURL(playable);const s=cinemaNewSession('video',title,key);if(!s){cinemaReleaseMedia();return;}cinemaSaveLocalVideo(f,s);go('cinemawatch');cinemaRestoreStoredSubtitles(s,_cin.token);}
function cinemaDirectPlayOnly(f){const size=Math.max(0,Number(f&&f.size)||0);return cinemaAndroidBrowser()&&size>=256*1024*1024;}
async function cinemaSaveLocalVideo(f,s){const direct=cinemaDirectPlayOnly(f),item=cinemaUpsertLibrary(s,{source:direct?'missing':'saving',size:+f.size||0,mime:f.type||'video/mp4',fileName:f.name||''}),key=cinemaStoreKey('video',s.mediaKey);if(direct){delete item.storeKey;save();toast('长视频已直接播放，不再复制到浏览器存储；下次需要重新选择原文件');return;}try{let est=null;if(navigator.storage&&navigator.storage.estimate)est=await navigator.storage.estimate();if(est&&est.quota&&f.size>Math.max(0,(est.quota-est.usage)*.86))throw new Error('设备剩余空间不足');try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();}catch(_){}await cinPut(key,f);if(!S.cinema.library.includes(item)){await cinDel(key);return;}item.source='idb';item.storeKey=key;item.updatedAt=Date.now();save();}catch(e){item.source='missing';delete item.storeKey;save();toast(((e&&e.message)||'设备空间不足')+'，本次仍可观看；下次需重新选择文件');}}
function cinemaOpenOnlineModal(){if(!cinemaRequireRole())return;openModal(`<h3>打开在线视频</h3><div class="hint">支持浏览器可直接播放的 MP4、WebM 等媒体直链；普通视频网站分享页、登录页或受版权保护的地址不能直接解析。跨域视频可播放时，也可能不允许画面识别。</div><div class="field"><label>视频地址</label><input id="cinOnlineUrl" type="url" placeholder="https://example.com/video.mp4"></div><div class="field"><label>片名（可稍后修改）</label><input id="cinOnlineTitle" maxlength="80" placeholder="未命名影片"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="cinemaOpenOnline()">开始观看</button></div>`);}
function cinemaOpenOnline(){const u=(($('#cinOnlineUrl')||{}).value||'').trim(),name=(($('#cinOnlineTitle')||{}).value||'').trim();if(!/^https?:\/\/[^\s]+$/i.test(u)){toast('请填写完整的 http 或 https 视频直链');return;}cinemaReleaseMedia();_cin.remote=true;_cin.videoUrl=u;const path=decodeURIComponent(u.split(/[?#]/)[0].split('/').pop()||''),title=name||cinemaFriendlyTitle(path,'在线视频'),s=cinemaNewSession('video',title,'url|'+u);if(!s){cinemaReleaseMedia();return;}cinemaUpsertLibrary(s,{source:'url',url:u});closeModal();go('cinemawatch');}
function cinemaPlatformName(provider){return provider==='bilibili'?'哔哩哔哩':'视频平台';}
function cinemaNativeMediaAudioOn(){return privateNativeAppOn()&&typeof _cin!=='undefined'&&_cin.provider==='bilibili'&&cur().p==='cinemawatch';}
function callNativeSharedMediaAudioOn(){return privateNativeAppOn()&&(cinemaNativeMediaAudioOn()||callScreenShareOn());}
function callNativeCameraMediaOn(){return privateNativeAppOn()&&callVideoCameraOn();}
function cinemaPlatformParse(raw){
  raw=String(raw||'').trim();if(!raw)return null;
  const bangumi=raw.match(/(?:b23\.tv\/|\/bangumi\/play\/|\b)(ep|ss)(\d{5,})\b/i),bv=raw.match(/\b(BV[0-9A-Za-z]{10})\b/i),av=raw.match(/(?:\/video\/|\b)(?:av)(\d{5,})\b/i),short=raw.match(/(?:https?:\/\/)?b23\.tv\/([0-9A-Za-z_-]{4,32})/i);
  if(bangumi){const kind=bangumi[1].toLowerCase(),id=bangumi[2],slug=kind+id;return{provider:'bilibili',id,idType:kind==='ep'?'episode':'season',pageUrl:'https://www.bilibili.com/bangumi/play/'+slug};}
  if(bv){const id='BV'+bv[1].slice(2);return{provider:'bilibili',id,idType:'bvid',pageUrl:'https://www.bilibili.com/video/'+id};}
  if(av)return{provider:'bilibili',id:av[1],idType:'aid',pageUrl:'https://www.bilibili.com/video/av'+av[1]};
  if(short)return{provider:'bilibili',id:short[1],idType:'short',shortUrl:'https://b23.tv/'+short[1],pageUrl:'https://b23.tv/'+short[1]};
  return null;
}
async function cinemaBilibiliResolveShort(meta){
  if(!meta||meta.idType!=='short')return meta;
  let finalUrl='';
  if(privateNativeAppOn())try{const r=await window.SmallPhoneNative.request('media.resolveBilibiliShort',{url:meta.shortUrl});finalUrl=String(r&&r.url||'');}catch(_){}
  if(!finalUrl&&typeof fetch==='function')try{const r=await fetch(meta.shortUrl,{method:'GET',mode:'no-cors',redirect:'follow',cache:'no-store'});finalUrl=String(r&&r.url||'');}catch(_){}
  const parsed=cinemaPlatformParse(finalUrl);
  if(!parsed||parsed.provider!=='bilibili'||parsed.idType==='short')throw new Error('这条B站短链接没有自动展开，请复制完整分享链接后再试');
  return parsed;
}
function cinemaBilibiliJSONP(params){
  return new Promise((resolve,reject)=>{const callback='__northBiliView'+Date.now()+Math.random().toString(36).slice(2),script=document.createElement('script');let done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);try{delete window[callback];}catch(_){window[callback]=undefined;}script.remove();error?reject(error):resolve(value);};window[callback]=data=>finish(null,data);script.async=true;script.referrerPolicy='no-referrer';script.src='https://api.bilibili.com/x/web-interface/view?'+params+'&jsonp=jsonp&callback='+encodeURIComponent(callback);script.onerror=()=>finish(new Error('无法连接B站视频信息接口'));const timer=setTimeout(()=>finish(new Error('读取B站视频信息超时')),15000);(document.head||document.documentElement).appendChild(script);});
}
async function cinemaBilibiliPrepare(meta){
  meta=await cinemaBilibiliResolveShort(meta);if(!meta||meta.provider!=='bilibili')return meta;
  if(meta.idType==='episode'||meta.idType==='season')return meta;
  const query=meta.idType==='aid'?'aid='+encodeURIComponent(meta.id):'bvid='+encodeURIComponent(meta.id),payload=await cinemaBilibiliJSONP(query),data=payload&&payload.data;
  if(!data||payload.code!==0||!data.bvid||!data.aid)throw new Error(String(payload&&payload.message||'B站没有返回可播放的视频信息'));
  const page=(Array.isArray(data.pages)&&data.pages[0])||{};
  if(!page.cid)throw new Error('B站没有返回当前分P的播放编号');
  return Object.assign({},meta,{id:String(data.bvid),idType:'bvid',bvid:String(data.bvid),aid:String(data.aid),cid:String(page.cid),title:String(data.title||meta.title||'B站视频'),duration:+data.duration||+meta.duration||0,thumbnail:String(data.pic||meta.thumbnail||''),pageUrl:'https://www.bilibili.com/video/'+data.bvid});
}
function cinemaOpenPlatformModal(){
  if(!cinemaRequireRole())return;
  openModal(`<div class="cin-platform-modal"><h3>B站视频片库</h3><div class="hint">可直接粘贴整段分享文字、完整链接、b23.tv 短链接、BV 号或番剧 ep / ss 链接，小手机会自动提取并补全播放信息。会员、登录、广告、地区和版权限制均由B站决定。</div><div class="field"><label>在B站搜索视频 / 片段</label><div class="cin-platform-search"><input id="cinPlatformKeyword" maxlength="80" autocomplete="off" placeholder="输入电影、电视剧或片段名" onkeydown="if(event.key==='Enter'){event.preventDefault();cinemaPlatformLaunchSearch()}"><button onclick="cinemaPlatformLaunchSearch()">去B站搜索</button></div></div><div class="field"><label>整段分享文字 / B站链接 / 视频 ID</label><input id="cinPlatformPaste" maxlength="500" autocomplete="off" placeholder="直接粘贴B站分享文字、b23短链接或BV号"></div><div class="btns"><button class="btn g" onclick="closeModal()">关闭</button><button class="btn p" onclick="cinemaPlatformOpenPaste()">自动识别并导入</button></div></div>`);setTimeout(()=>{const e=$('#cinPlatformPaste');if(e)e.focus();},80);
}
async function cinemaPlatformOpenPaste(){const raw=String((($('#cinPlatformPaste')||{}).value)||'').trim(),parsed=cinemaPlatformParse(raw),name=String((($('#cinPlatformKeyword')||{}).value)||'').trim();if(!parsed){toast('没有识别到有效的B站分享链接、BV号、番剧 ep / ss 链接');return;}try{toast('正在读取B站视频信息…');const ready=await cinemaBilibiliPrepare(parsed);ready.title=name||ready.title||'哔哩哔哩视频';cinemaOpenPlatformMedia(ready);}catch(e){toast((e&&e.message)||'B站视频导入失败');}}
function cinemaPlatformLaunchSearch(){const q=String((($('#cinPlatformKeyword')||{}).value)||'').trim();if(!q){toast('先输入想看的名称');return;}const a=document.createElement('a');a.href='https://search.bilibili.com/all?keyword='+encodeURIComponent(q);a.target='_blank';a.rel='noopener noreferrer external';document.body.appendChild(a);a.click();a.remove();toast('已打开B站官方搜索，选中视频后复制分享链接回来');}
function cinemaOpenPlatformMedia(meta){
  if(!meta||!meta.provider||!meta.id||!cinemaRequireRole())return;cinemaReleaseMedia();_cin.remote=true;_cin.provider=meta.provider;_cin.externalId=String(meta.id);_cin.videoInfo=Object.assign({},meta);_cin.videoUrl='platform://'+meta.provider+'/'+encodeURIComponent(meta.id);const title=cinemaFriendlyTitle(meta.title,cinemaPlatformName(meta.provider)+'视频'),key='platform|'+meta.provider+'|'+meta.id,s=cinemaNewSession('video',title,key);if(!s){cinemaReleaseMedia();return;}s.duration=+meta.duration||s.duration||0;cinemaUpsertLibrary(s,{source:'platform',provider:meta.provider,externalId:String(meta.id),idType:meta.idType||'vid',bvid:meta.bvid||'',aid:meta.aid||'',cid:meta.cid||'',pageUrl:meta.pageUrl||'',thumbnail:meta.thumbnail||'',duration:+meta.duration||0});closeModal();go('cinemawatch');
}
function cinemaSearchUrl(engine,kind,keyword){const suffix=kind==='book'?' 小说 在线阅读':' 电影 电视剧 在线观看',q=String(keyword||'').trim()+suffix,encoded=encodeURIComponent(q);if(engine==='quark')return 'https://quark.sm.cn/s?q='+encoded;if(engine==='bing')return 'https://www.bing.com/search?q='+encoded;return 'https://m.baidu.com/s?word='+encoded;}
function cinemaOpenSearchModal(){openModal(`<h3>在线找片 / 搜书</h3><div class="hint">输入作品名后直接打开搜索结果，不用复制链接。搜索页会在新标签打开，返回小手机时放映室不会被关掉。</div><div class="two"><div class="field"><label>想找什么</label><select id="cinSearchKind"><option value="video">电影 / 剧集</option><option value="book">小说 / 作品</option></select></div><div class="field"><label>搜索应用</label><select id="cinSearchEngine"><option value="quark">夸克</option><option value="baidu">百度</option><option value="bing">必应</option></select></div></div><div class="field"><label>作品名</label><input id="cinSearchKeyword" maxlength="100" autocomplete="off" placeholder="例如：海绵宝宝" onkeydown="if(event.key==='Enter'){event.preventDefault();cinemaLaunchSearch(event)}"></div><div class="hint" style="color:#a49eaa">第三方平台的登录、会员及版权限制仍然有效。搜索网页本身不能让角色看到剧情；要和角色同步观看或阅读，请使用平台允许播放的内容，或回到这里导入本地文件。</div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><a id="cinSearchGo" class="btn p" href="#" target="_blank" rel="noopener noreferrer external" onclick="return cinemaLaunchSearch(event)">打开应用搜索</a></div>`);setTimeout(()=>{const e=$('#cinSearchKeyword');if(e)e.focus();},80);}
function cinemaLaunchSearch(e){const keyword=(($('#cinSearchKeyword')||{}).value||'').trim(),kind=(($('#cinSearchKind')||{}).value||'video'),engine=(($('#cinSearchEngine')||{}).value||'quark');if(!keyword){if(e&&e.preventDefault)e.preventDefault();toast('先输入电影、剧集或小说名');return false;}const url=cinemaSearchUrl(engine,kind,keyword),a=e&&e.currentTarget;if(a&&String(a.tagName||'').toLowerCase()==='a')a.href=url;else{const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer external';document.body.appendChild(link);link.click();link.remove();}S.browser=S.browser||{};S.browser.history=S.browser.history||[];S.browser.history.unshift({q:keyword+(kind==='book'?' 小说':' 电影/剧集'),time:Date.now(),source:'cinema',engine});S.browser.history=S.browser.history.slice(0,40);save();setTimeout(()=>{closeModal();toast('已打开'+(engine==='quark'?'夸克':engine==='baidu'?'百度':'必应')+'搜索');},0);return true;}
function cinemaRename(id){const s=(cinemaInit().sessions||[]).find(x=>x&&x.id===id);if(!s)return;openModal(`<h3>修改${s.kind==='book'?'作品名':'片名'}</h3><div class="hint">修改后会保存在片单记忆里，下次导入同一个文件也会沿用。</div><div class="field"><input id="cinRenameInput" maxlength="80" value="${esc(s.title||'')}"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="cinemaRenameSave('${s.id}')">保存</button></div>`);setTimeout(()=>{const e=$('#cinRenameInput');if(e){e.focus();e.select();}},80);}
function cinemaRenameSave(id){const s=(cinemaInit().sessions||[]).find(x=>x&&x.id===id),e=$('#cinRenameInput'),name=(e&&e.value||'').trim().replace(/[\r\n]+/g,' ').slice(0,80);if(!s||!name){toast('名字不能为空');return;}s.title=name;s.updatedAt=Date.now();if(s.mediaKey){const old=S.cinema.progress[s.mediaKey]||{};S.cinema.progress[s.mediaKey]=Object.assign({},old,{kind:s.kind,title:name,updatedAt:Date.now()});const lib=S.cinema.library.find(x=>x&&x.mediaKey===s.mediaKey);if(lib){lib.title=name;lib.updatedAt=Date.now();}}save();closeModal();const t=$('#cinWatchTitle');if(t)t.textContent=name;else render();toast('名字已保存');}
function cinemaDecodeText(buf){const bytes=new Uint8Array(buf||new ArrayBuffer(0));let t='',enc='';if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)enc='utf-16le';else if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)enc='utf-16be';else if(bytes.length>=4){let even=0,odd=0,sample=Math.min(bytes.length,512);for(let i=0;i<sample;i++){if(bytes[i]===0){if(i%2)odd++;else even++;}}if(odd>sample*.18&&even<sample*.05)enc='utf-16le';else if(even>sample*.18&&odd<sample*.05)enc='utf-16be';}if(enc)try{t=new TextDecoder(enc).decode(bytes);}catch(_){}if(!t)try{t=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(_){try{t=new TextDecoder('gb18030').decode(bytes);}catch(__){t=new TextDecoder().decode(bytes);}}return t.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();}
function cinemaPaginate(text,limit){text=String(text||'').replace(/\r\n?/g,'\n').trim();limit=Math.max(500,+limit||1150);if(!text)return[];const paras=text.split(/\n{2,}/),pages=[];let page='';const push=()=>{if(page.trim())pages.push(page.trim());page='';};paras.forEach(p=>{p=p.trim();if(!p)return;while(p.length>limit){const room=Math.max(180,limit-page.length-2),part=p.slice(0,room),cut=Math.max(part.lastIndexOf('。'),part.lastIndexOf('！'),part.lastIndexOf('？'),part.lastIndexOf('\n'));const n=cut>room*.55?cut+1:room;page+=(page?'\n\n':'')+p.slice(0,n);push();p=p.slice(n).trim();}if(page&&page.length+p.length+2>limit)push();page+=(page?'\n\n':'')+p;});push();return pages;}
async function cinemaDecodeEpub(f){if(!window.JSZip)throw new Error('当前设备未启用 EPUB 解析组件，请先转为 TXT 再导入');const zip=await window.JSZip.loadAsync(await f.arrayBuffer()),container=await zip.file('META-INF/container.xml').async('text'),doc=new DOMParser().parseFromString(container,'application/xml'),root=doc.querySelector('rootfile');if(!root)throw new Error('EPUB 目录无效');const opfPath=root.getAttribute('full-path'),opf=await zip.file(opfPath).async('text'),od=new DOMParser().parseFromString(opf,'application/xml'),base=opfPath.includes('/')?opfPath.slice(0,opfPath.lastIndexOf('/')+1):'',manifest={};od.querySelectorAll('manifest item').forEach(x=>manifest[x.getAttribute('id')]={href:x.getAttribute('href'),type:x.getAttribute('media-type')});const parts=[];for(const ref of od.querySelectorAll('spine itemref')){const it=manifest[ref.getAttribute('idref')];if(!it)continue;const file=zip.file(base+decodeURIComponent(it.href||''));if(!file)continue;const html=await file.async('text'),hd=new DOMParser().parseFromString(html,'text/html'),tx=(hd.body&&hd.body.innerText||hd.documentElement.textContent||'').replace(/\n{3,}/g,'\n\n').trim();if(tx)parts.push(tx);}if(!parts.length)throw new Error('没有读到 EPUB 正文');return parts.join('\n\n');}
function cinemaPickBook(){if(!cinemaRequireRole())return;pickFile('.txt,.md,.epub,text/plain,text/markdown,application/epub+zip',async f=>{try{const isEpub=/\.epub$/i.test(f.name||''),text=isEpub?await cinemaDecodeEpub(f):cinemaDecodeText(await f.arrayBuffer()),pages=cinemaPaginate(text,1150);if(!pages.length)throw new Error('文件里没有可阅读的正文');cinemaReleaseMedia();_cin.bookText=text;_cin.bookPages=pages;const key=cinemaMediaKey(f,'book'),title=cinemaFriendlyTitle(f.name,'未命名作品'),s=cinemaNewSession('book',title,key);if(!s)return;s.totalPages=pages.length;const old=S.cinema.progress[key]||{};s.page=Math.min(Math.max(0,+old.page||0),pages.length-1);const item=cinemaUpsertLibrary(s,{source:'saving',fileName:f.name||'',size:+f.size||0}),storeKey=cinemaStoreKey('book',key);try{await cinPut(storeKey,text);item.source='idb';item.storeKey=storeKey;}catch(_){item.source='missing';toast('作品正文未能保存到书架，下次需要重新选择文件');}save();go('cinemaread');}catch(e){toast((e&&e.message)||'作品读取失败');}});}
function cinemaLibraryOpen(id){const item=(cinemaInit().library||[]).find(x=>x&&x.id===id);if(!item)return;const unavailable=item.source==='missing'||item.source==='saving';openModal(`<h3>${item.kind==='video'?'视频盒':'书架'}</h3><div class="cin-lib-dialog"><i>${item.kind==='video'?svgIc('video',28,'#e9dfea'):svgIc('book',28,'#dfe9e7')}</i><div><b>${esc(item.title||'未命名')}</b><span>${item.source==='saving'?'正在保存到本机，请稍候':item.source==='missing'?'原文件未保存在设备中，需要重新选择':item.source==='platform'?cinemaPlatformName(item.provider)+'官方播放器':item.source==='url'?'在线视频直链':item.kind==='video'?'本地视频已保存':'作品正文已保存'}</span></div></div>${unavailable?(item.source==='saving'?'<button class="btn g" onclick="closeModal()">稍后再来</button>':`<button class="btn p" onclick="cinemaLibraryRelink('${item.id}')">重新选择源文件</button>`):`<div class="btns"><button class="btn g" onclick="cinemaLibraryPlay('${item.id}',false)">继续${item.kind==='video'?'观看':'阅读'}</button><button class="btn p" onclick="cinemaLibraryPlay('${item.id}',true)">从头开始</button></div><button class="btn p" style="margin-top:8px" onclick="cinemaInviteLibrary('${item.id}')">发微信邀请给 ${cinemaRoleName(cinemaRole())}</button>`}<div class="btns"><button class="btn g" onclick="cinemaLibraryRename('${item.id}')">修改名字</button><button class="btn g" style="color:#e88" onclick="cinemaLibraryDelete('${item.id}')">移出${item.kind==='video'?'视频盒':'书架'}</button></div>`);}
async function cinemaLibraryPlay(id,restart){const item=(cinemaInit().library||[]).find(x=>x&&x.id===id);if(!item||!cinemaRequireRole())return;cinemaReleaseMedia();try{if(item.kind==='video'){if(item.source==='platform'){if(item.provider!=='bilibili')throw new Error('这个平台入口已移除');if(!item.cid&&!['episode','season'].includes(item.idType)){toast('正在补全B站播放信息…');const ready=await cinemaBilibiliPrepare({provider:'bilibili',id:item.externalId,idType:item.idType||'bvid',pageUrl:item.pageUrl||''});Object.assign(item,{externalId:ready.id,idType:ready.idType,bvid:ready.bvid,aid:ready.aid,cid:ready.cid,title:ready.title||item.title,thumbnail:ready.thumbnail||item.thumbnail,duration:ready.duration||item.duration,pageUrl:ready.pageUrl||item.pageUrl});} _cin.remote=true;_cin.provider=item.provider;_cin.externalId=item.externalId;_cin.videoInfo=Object.assign({},item);_cin.videoUrl='platform://'+item.provider+'/'+encodeURIComponent(item.externalId);}else if(item.source==='url'){_cin.remote=true;_cin.videoUrl=item.url;}else{const blob=await cinGet(item.storeKey||cinemaStoreKey('video',item.mediaKey));if(!blob)throw new Error('保存的视频已被系统清理，请重新选择文件');_cin.videoFile=blob;_cin.videoUrl=URL.createObjectURL(cinemaPlayableVideoBlob(blob,item.fileName,item.mime));}}else{const text=await cinGet(item.storeKey||cinemaStoreKey('book',item.mediaKey));if(!text)throw new Error('保存的作品已被系统清理，请重新选择文件');_cin.bookText=String(text);_cin.bookPages=cinemaPaginate(_cin.bookText,1150);if(!_cin.bookPages.length)throw new Error('作品正文为空');}const s=cinemaNewSession(item.kind,item.title,item.mediaKey);if(!s)throw new Error('无法创建本场');s.libraryId=item.id;if(item.kind==='book')s.totalPages=_cin.bookPages.length;if(item.kind==='video'&&item.duration)s.duration=+item.duration||s.duration;if(restart){s.progress=0;s.page=0;s.status='active';}item.updatedAt=Date.now();save();closeModal();go(item.kind==='video'?'cinemawatch':'cinemaread');if(item.kind==='video'&&item.source!=='platform')cinemaRestoreStoredSubtitles(s,_cin.token);}catch(e){if(item.source!=='platform')item.source='missing';save();toast((e&&e.message)||'内容无法打开');cinemaLibraryOpen(item.id);}}
function cinemaLibraryRelink(id){const item=(cinemaInit().library||[]).find(x=>x&&x.id===id);if(!item)return;const accept=item.kind==='video'?'video/mp4,video/webm,video/quicktime,.mp4,.webm,.m4v':'.txt,.md,.epub,text/plain,text/markdown,application/epub+zip';pickFile(accept,async f=>{try{if(item.kind==='video'){const key=cinemaStoreKey('video',item.mediaKey);await cinPut(key,f);item.storeKey=key;item.source='idb';item.size=+f.size||0;item.fileName=f.name||'';}else{const isEpub=/\.epub$/i.test(f.name||''),text=isEpub?await cinemaDecodeEpub(f):cinemaDecodeText(await f.arrayBuffer());if(!text)throw new Error('作品正文为空');const key=cinemaStoreKey('book',item.mediaKey);await cinPut(key,text);item.storeKey=key;item.source='idb';item.size=+f.size||0;item.fileName=f.name||'';}item.updatedAt=Date.now();save();closeModal();toast('源文件已重新保存，可以继续了');render();}catch(e){toast((e&&e.message)||'保存失败');}});}
function cinemaLibraryRename(id){const item=(cinemaInit().library||[]).find(x=>x&&x.id===id);if(!item)return;const s=(S.cinema.sessions||[]).slice().reverse().find(x=>x&&x.mediaKey===item.mediaKey);if(s){closeModal();cinemaRename(s.id);return;}openModal(`<h3>修改名字</h3><div class="field"><input id="cinLibraryRename" maxlength="80" value="${esc(item.title||'')}"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="cinemaLibraryRenameSave('${item.id}')">保存</button></div>`);}
function cinemaLibraryRenameSave(id){const item=(cinemaInit().library||[]).find(x=>x&&x.id===id),name=((($('#cinLibraryRename')||{}).value)||'').trim().replace(/[\r\n]+/g,' ').slice(0,80);if(!item||!name){toast('名字不能为空');return;}item.title=name;item.updatedAt=Date.now();(S.cinema.sessions||[]).filter(x=>x&&x.mediaKey===item.mediaKey).forEach(x=>x.title=name);const p=S.cinema.progress[item.mediaKey];if(p)p.title=name;save();closeModal();render();toast('名字已保存');}
async function cinemaDeleteStoredSubtitles(mediaKey){if(!mediaKey)return;const x=cinemaInit(),taskKey=cinemaStoreKey('asr-task',mediaKey),jobKey=cinemaStoreKey('asr-job',mediaKey),manualKey=cinemaStoreKey('subtitle-file',mediaKey);delete x.asrTasks[taskKey];(x.sessions||[]).filter(s=>s&&s.mediaKey===mediaKey).forEach(s=>{delete s.subtitleName;delete s.subtitleCount;delete s.subtitleSource;});if(_cin.mediaKey===mediaKey){_cin.token++;_cin.extracting=false;_cin.asrMode='';_cin.asrCoveredUntil=0;_cin.asrGuardPaused=false;_cin.cues=_cin.cues.filter(c=>c&&c.source==='speech');_cin.subtitleName='';}await cinDel(jobKey);await cinDel(manualKey);}
async function cinemaLibraryDelete(id){const item=(cinemaInit().library||[]).find(x=>x&&x.id===id),video=item&&item.kind==='video',message=video?'从视频盒移除《'+item.title+'》？\n本机视频、已提取的完整/部分字幕和提取进度都会删除；观看记录和角色记忆仍会保留。':'从书架移除《'+(item&&item.title||'')+'》？\n作品正文会从本机删除；阅读记录和角色记忆仍会保留。';if(!item||!await uiConfirm(message))return;S.cinema.library=S.cinema.library.filter(x=>x&&x.id!==id);const contentKey=item.storeKey||cinemaStoreKey(item.kind,item.mediaKey),subtitleDelete=video?cinemaDeleteStoredSubtitles(item.mediaKey):Promise.resolve();save();await Promise.all([cinDel(contentKey),subtitleDelete]);closeModal();render();toast(video?'已移出视频盒，视频和字幕已删除':'已移出书架，作品正文已删除');}
function cinemaFindLibrary(title){title=String(title||'').trim();const rows=(cinemaInit().library||[]).filter(x=>x&&x.source!=='missing'&&x.source!=='saving');return rows.find(x=>x.title===title)||rows.find(x=>x.title&&title&&(x.title.includes(title)||title.includes(x.title)))||null;}
function cinemaInviteCard(cid,item,role){const c=getC(cid);if(!c||!item)return null;const card={role:role==='assistant'?'assistant':'user',type:'cinemainvite',title:item.title||'未命名',kind:item.kind||'video',libraryId:item.id,status:'pending',byRole:role==='assistant',time:Date.now(),id:uid()};msgs(cid).push(card);if(card.role==='assistant')notifyIncoming(c,card);save();refreshChatMessages(cid);return card;}
function cinemaInviteLibrary(id){const item=(cinemaInit().library||[]).find(x=>x&&x.id===id),c=cinemaRole();if(!item||!c)return toast('先选择陪同角色');const card=cinemaInviteCard(c.id,item,'user');if(!card)return;closeModal();openChat(c.id);toast('邀请卡已发送，等待 '+(c.remark||c.name)+' 回应');if(!c.blocked)scheduleReply(c.id,'[系统：'+S.me.name+'刚通过放映室邀请卡邀请你'+(item.kind==='book'?'共读':'一起看')+'《'+item.title+'》。请按你真实的性格和当下关系决定。愿意就单独输出 [同意放映] 并自然回应；不愿意就单独输出 [拒绝放映] 并说一句自然理由。]');}
function cinemaRoleInvite(cid,title){const item=cinemaFindLibrary(title),c=getC(cid);if(!item||!c)return false;cinemaInviteCard(cid,item,'assistant');return true;}
function cinemaRoleAnswerInvite(cid,ok){const card=[...msgs(cid)].reverse().find(x=>x&&x.role==='user'&&x.type==='cinemainvite'&&x.status==='pending');if(!card)return false;card.status=ok?'accepted':'declined';card.answeredAt=Date.now();save();refreshChatMessages(cid);return true;}
async function cinemaRespondInvite(cid,mid,ok){const c=getC(cid),card=msgs(cid).find(x=>x&&x.id===mid&&x.type==='cinemainvite');if(!c||!card||card.status!=='pending')return;card.status=ok?'accepted':'declined';card.answeredAt=Date.now();msgs(cid).push({role:'user',type:'sys',content:ok?'🎬 '+S.me.name+'接受了《'+card.title+'》的放映室邀请':'🎬 '+S.me.name+'拒绝了《'+card.title+'》的放映室邀请',time:Date.now(),id:uid(),_silent:true});save();if(!ok){render();scheduleReply(cid,'[系统：'+S.me.name+'拒绝了你发来的《'+card.title+'》放映室邀请。按你本人性格自然回应一句，不要继续假装已经进入放映室。]');return;}cinemaInit().selectedCid=cid;save();await cinemaOpenInviteCard(cid,mid);}
async function cinemaOpenInviteCard(cid,mid){const card=msgs(cid).find(x=>x&&x.id===mid&&x.type==='cinemainvite'),item=card&&(cinemaInit().library||[]).find(x=>x&&x.id===card.libraryId);if(!card||card.status!=='accepted')return toast('邀请还没有被同意');if(!item||item.source==='missing'||item.source==='saving')return toast('源文件暂不可用，请先在放映室重新关联');cinemaInit().selectedCid=cid;save();await cinemaLibraryPlay(item.id,false);}
function cinemaParseTime(v){const p=String(v||'').trim().replace(',','.').split(':').map(Number);if(p.some(n=>!Number.isFinite(n)))return NaN;return p.length===3?p[0]*3600+p[1]*60+p[2]:p.length===2?p[0]*60+p[1]:NaN;}
function cinemaParseSubtitles(raw){const lines=String(raw||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/^WEBVTT[^\n]*\n+/i,'').split('\n'),out=[];for(let i=0;i<lines.length;i++){const timing=String(lines[i]||'').trim();if(!timing.includes('-->'))continue;const sides=timing.split('-->'),start=cinemaParseTime(sides[0]),end=cinemaParseTime(String(sides[1]||'').trim().split(/\s+/)[0]);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;const body=[];let j=i+1;for(;j<lines.length;j++){const row=String(lines[j]||'').trim();if(!row)break;if(row.includes('-->'))break;if(/^\d+$/.test(row)&&String(lines[j+1]||'').includes('-->'))break;body.push(row);}const text=body.join(' ').replace(/<[^>]+>/g,'').replace(/\{\\[^}]+\}/g,'').trim();if(text)out.push({start,end,text:text.slice(0,500)});i=Math.max(i,j-1);}return out.sort((a,b)=>a.start-b.start);}
function cinemaCueAt(t){let hit=null;for(const cue of _cin.cues){if(cue.start>t)break;if(t<=cue.end)hit=cue;}return hit;}
function cinemaSubtitleContext(t){return _cin.cues.filter(x=>x.source!=='speech'&&x.start<=t+.5&&x.end>=Math.max(0,t-90)).slice(-18).map(x=>'['+cinemaFmt(x.start)+'] '+x.text).join('\n');}
