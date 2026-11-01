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
async function licenseBindCurrent(){if(!window.NorthLicense){toast('授权组件没有加载，请刷新页面');return;}try{
  toast('正在准备手机授权…');if(!NorthLicense.isManaged()||!NorthLicense.session())await NorthLicense.legacyActivate();licenseMarkUnlocked();const bound=await NorthLicense.bindPasskey();toast(bound&&bound.alreadyBound?'手机验证已经绑定，无需重复绑定':(appleHomeCompatNative()?'绑定成功，以后重装或换设备可直接恢复':'绑定成功，以后换浏览器或添加到主屏幕可直接恢复'));if(cur().p==='settings')render();
}catch(e){toast((e&&e.message)||'绑定失败');if(cur().p==='settings')render();}}
async function licenseSyncPhoneFriendIdentity(force){if(!window.NorthLicense||!NorthLicense.isManaged()||!NorthLicense.session())return null;const p=phoneFriendState(),s=NorthLicense.session(),markKey='north_license_phone_friend_sync_v1',expected=(s.sessionId||s.licenseId)+'|'+p.id;let old='';try{old=localStorage.getItem(markKey)||'';}catch(_){}if(!force&&old===expected)return null;const result=await NorthLicense.syncPhoneFriendIdentity(p.id,p.secret);try{localStorage.setItem(markKey,expected);}catch(_){}return result;}
function licenseRelinkModal(){openModal('<h3>合并到已有手机授权</h3><div class="hint" style="line-height:1.8">用于 Safari、Edge 被识别成两组不同授权的情况。合并后两个浏览器会进入同一组授权。<b>本机聊天、角色和设置不会删除。</b><br><br>请扫脸或验证指纹，并选择原来 Safari 的 North 通行密钥。</div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="licenseRelinkPasskey()">扫脸 / 指纹合并</button></div>');}
async function licenseRelinkPasskey(){if(!await uiConfirm('当前浏览器会改绑到你接下来选择的已有手机授权，并退出这里原来的独立授权。继续吗？'))return;try{toast('请验证原来那张手机授权…');const r=await NorthLicense.relinkPasskey();closeModal();toast('已合并，现在共有 '+((r.session&&r.session.activeCount)||1)+' 个浏览器');if(cur().p==='settings')render();}catch(e){toast((e&&e.message)||'合并失败');}}
function licenseTimeText(value){const t=new Date(value||0).getTime();return t?fmtDur(Math.max(0,Date.now()-t))+'前':'未知';}
let _licenseStatusRefreshBusy=false;
function licenseUpdateCount(count){const btn=document.getElementById('license_devices_btn');if(btn)btn.textContent='已授权浏览器 '+Math.max(0,+count||0);}
async function licenseRefreshStatus(){if(_licenseStatusRefreshBusy||!window.NorthLicense||!NorthLicense.isManaged()||!NorthLicense.session())return;_licenseStatusRefreshBusy=true;try{const r=await NorthLicense.check();licenseUpdateCount(r.sessionCount);}catch(e){}finally{_licenseStatusRefreshBusy=false;}}
async function licenseDevicesModal(){openModal('<h3>已授权浏览器</h3><div class="hint">正在读取…</div>');try{const r=await NorthLicense.listSessions(),count=r.sessions.length;licenseUpdateCount(count);openModal('<h3>已授权浏览器 '+count+'</h3><div class="hint">新增浏览器不会再自动退出原来的入口。移除只会退出该入口，不会删除聊天和设置。</div><div class="section">'+r.sessions.map(s=>'<div class="it"><span>'+esc(s.label)+(s.current?' <small style="color:#07c160">当前</small>':'')+'<br><small style="color:#777">最近使用：'+esc(licenseTimeText(s.last_seen_at))+'</small></span><button class="minibtn" onclick="licenseRevokeDevice(\''+s.id+'\','+!!s.current+')">移除</button></div>').join('')+'</div><button class="btn g" onclick="closeModal()">关闭</button>');}catch(e){toast((e&&e.message)||'读取失败');closeModal();}}
async function licenseRevokeDevice(id,current){if(!await uiConfirm(current?'退出当前浏览器授权？不会删除任何数据。':'移除这个浏览器授权？'))return;try{await NorthLicense.revokeSession(id);if(current){try{localStorage.removeItem('yibei_unlocked');}catch(_){}closeModal();showGate();}else{toast('已移除');licenseDevicesModal();}}catch(e){toast((e&&e.message)||'移除失败');}}
function licenseStatusSection(){if(!window.NorthLicense)return '';const managed=NorthLicense.isManaged()&&!!NorthLicense.session(),m=NorthLicense.meta(),count=Math.max(0,+m.sessionCount||0),passkeys=Math.max(0,+m.passkeyCount||0);
  if(appleHomeCompatNative())return '<div class="section" id="set_license"><div style="padding:12px 14px 5px;font-weight:600;color:#f0c78e">私人 App 授权</div><div class="hint" style="padding:0 14px 9px">'+(managed?(passkeys?'已绑定系统扫脸/指纹；重装 App 或更换设备后可以恢复。':'当前 App 已授权；请绑定扫脸或指纹，以便重装或更换设备后恢复。'):'当前 App 尚未绑定手机验证；邀请码成功后仍永久失效。')+'<br><b>授权恢复只允许本人进行人脸或指纹验证。</b></div><div class="btns" style="padding:0 14px 10px"><button class="btn p" onclick="licenseBindCurrent()">'+(passkeys?'检查 / 补绑手机验证':'绑定扫脸 / 指纹恢复')+'</button></div></div>';
  if(managed)setTimeout(licenseRefreshStatus,0);
  return '<div class="section" id="set_license"><div style="padding:12px 14px 5px;font-weight:600;color:#f0c78e">手机授权</div><div class="hint" style="padding:0 14px 9px">'+(managed?(passkeys?'已绑定系统扫脸/指纹。换浏览器或添加到主屏幕后，点“恢复授权”即可。':'当前浏览器已授权；请立即绑定扫脸或指纹，设备恢复不接受任何迁移码或恢复码。'):'当前还是旧版浏览器授权。绑定后，邀请码仍永久失效，之后只能用扫脸或指纹恢复。')+'<br><b>设备恢复和浏览器合并只允许本人进行人脸或指纹验证。</b></div><div class="btns" style="padding:0 14px 8px"><button class="btn p" onclick="licenseBindCurrent()">'+(passkeys?'检查 / 补绑手机验证':'绑定扫脸 / 指纹恢复')+'</button></div>'+(managed?'<div class="btns" style="padding:0 14px 8px"><button class="btn g" id="license_devices_btn" onclick="licenseDevicesModal()">已授权浏览器 '+count+'</button></div><div class="btns" style="padding:0 14px 10px"><button class="btn g" onclick="licenseRelinkModal()">Safari / Edge 授权合并</button></div>':'')+'</div>';}
function chatAddMenu(){openModal(`<h3>＋</h3>
  <button class="btn p" style="margin-bottom:8px" onclick="closeModal();editContact()">新建角色</button>
  <button class="btn g" onclick="closeModal();createGroup()">发起群聊</button>
  <button class="btn g" style="margin-top:8px" onclick="closeModal();showManual()">使用说明书</button>
  <button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
let _wxGroupCreateSel=[],_wxGroupCreateQuery='',_wxFaceCode='';
function createGroup(){const cs=wxRoleContacts();if(cs.length<1){toast('先创建角色');return;}_wxGroupCreateSel=[];_wxGroupCreateQuery='';_wxFaceCode='';go('wxgroupcreate');}
function wxGroupCreateSearch(v){_wxGroupCreateQuery=v;const box=$('#wx-group-create-list');if(box)box.innerHTML=wxGroupCreateListHTML();}
function wxGroupCreateListHTML(){const q=_wxGroupCreateQuery.trim().toLowerCase(),rows=wxRoleContacts().filter(c=>!q||[c.name,c.remark,c.wxid].some(v=>String(v||'').toLowerCase().includes(q))).map(c=>Object.assign({},c,{name:c.remark||c.name}));if(!rows.length)return'<div class="wx-contact-empty">没有找到联系人</div>';return wxDirectorySections(rows,c=>`<button class="wx-group-pick ${_wxGroupCreateSel.includes(c.id)?'on':''}" onclick="wxGroupCreateToggle('${c.id}',this)"><i></i>${av(c.avatar,'sm')}<span>${esc(c.remark||c.name)}</span></button>`);}
function wxGroupCreateToggle(id,el){const i=_wxGroupCreateSel.indexOf(id);if(i<0)_wxGroupCreateSel.push(id);else _wxGroupCreateSel.splice(i,1);if(el)el.classList.toggle('on',i<0);const done=$('#wx-group-done');if(done){done.disabled=!_wxGroupCreateSel.length;done.textContent=_wxGroupCreateSel.length?'完成('+_wxGroupCreateSel.length+')':'完成';}}
function renderWxGroupCreate(){return `<div class="wx-directory-head">${wxDirectoryNav('发起群聊',`<button type="button" id="wx-group-done" class="r wx-dir-done" onclick="wxGroupCreateDone()" ${_wxGroupCreateSel.length?'':'disabled'}>${_wxGroupCreateSel.length?'完成('+_wxGroupCreateSel.length+')':'完成'}</button>`)}${wxDirectorySearch('wx-group-create-search',_wxGroupCreateQuery,'wxGroupCreateSearch')}</div><div class="scroll wx-directory-scroll"><div class="wx-group-create-actions"><button onclick="wxGroupCreateExisting()"><span>选择一个已有的群</span><b>›</b></button><small>创建新群聊</small><button onclick="wxFaceGroupModal()"><span>面对面建群</span><b>›</b></button><button onclick="wxGroupCreateFromGroup()"><span>选择群聊中的朋友</span><b>›</b></button></div><div class="wx-contact-directory" id="wx-group-create-list">${wxGroupCreateListHTML()}</div>${wxAlphabetRail()}</div>`;}
function wxGroupCreateExisting(){go('wxgroups');}
function wxGroupCreateFromGroup(){const gs=(S.groups||[]).filter(g=>(g.members||[]).length);openModal(`<h3>选择群聊</h3><div class="hint">会把该群里仍在通讯录中的角色预选出来，你还可以继续增减。</div>${gs.map(g=>`<button class="btn g" style="margin-bottom:8px" onclick="wxGroupCreateUseGroup('${g.id}')">${esc(g.name||'群聊')} · ${(g.members||[]).length} 人</button>`).join('')||'<div class="empty">还没有角色群聊</div>'}<button class="btn g" onclick="closeModal()">取消</button>`);}
function wxGroupCreateUseGroup(id){const g=(S.groups||[]).find(x=>x.id===id);if(!g)return;_wxGroupCreateSel=Array.from(new Set((g.members||[]).filter(cid=>wxRoleContacts().some(c=>c.id===cid))));closeModal();render();}
function wxFaceGroupModal(){openModal(`<h3>面对面建群</h3><div class="hint">输入同一个四位数字，并从下方联系人中选择要加入的人。完成后会创建一个本地角色群聊。</div><div class="field"><label>四位数字</label><input id="wx_face_code" inputmode="numeric" maxlength="4" value="${esc(_wxFaceCode)}" placeholder="0000"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="wxFaceGroupCodeSave()">确定</button></div>`);}
function wxFaceGroupCodeSave(){const v=String($('#wx_face_code')&&$('#wx_face_code').value||'').replace(/\D/g,'').slice(0,4);if(v.length!==4){toast('请输入四位数字');return;}_wxFaceCode=v;closeModal();toast('面对面群号 '+v+' 已设置，请选择联系人');}
function wxGroupCreateDone(){if(!_wxGroupCreateSel.length){toast('至少选择一个联系人');return;}const cs=_wxGroupCreateSel.map(getC).filter(Boolean),nm=_wxFaceCode?'面对面群聊 '+_wxFaceCode:(cs.map(c=>c.remark||c.name).slice(0,3).join('、')+'的群'),g={id:'g'+uid(),name:nm,members:cs.map(c=>c.id),msgs:[]};S.groups.unshift(g);save();stack.pop();go('group',{id:g.id});toast('群聊已创建');}
function gtoggle(id){const i=window._gsel.indexOf(id);if(i<0)window._gsel.push(id);else window._gsel.splice(i,1);const e=$('#gp_'+id);if(e)e.textContent=i<0?'✓':'＋';}
function doCreateGroup(){if(!window._gsel||!window._gsel.length){toast('至少选一个角色');return;}
  const nm=($('#g_name').value||'').trim()||(window._gsel.map(id=>getC(id).name).slice(0,3).join('、')+'的群');
  const g={id:'g'+uid(),name:nm,members:window._gsel.slice(),msgs:[]};S.groups.unshift(g);save();closeModal();go('group',{id:g.id});}
function groupEmojiPanelHTML(id){const stk=S.me.stickers||[];return `<div class="ppage"><div class="estk">${stk.map((s,i)=>`<div class="s" onclick="groupSendSticker('${id}',${i})"><span class="x" onclick="event.stopPropagation();delSticker(${i})">×</span>${stickerImageHTML(s.img)}<small>${esc(s.meaning||'')}</small></div>`).join('')||'<div style="color:#777;font-size:12px;padding:8px">还没有自定义表情，点加号里的「添加表情」上传</div>'}</div></div>`;}
function groupSendSticker(id,i){const g=S.groups.find(x=>x.id===id),s=(S.me.stickers||[])[i];if(!g||!s)return;const p=$('#gpanel');if(p)p.classList.remove('show');g.msgs.push({senderId:'me',role:'user',type:'sticker',img:s.img,meaning:s.meaning||'',content:s.meaning||'[表情]',time:Date.now(),id:uid()});save();render();aiGroupReply(id,'[发送了一个表情：'+(s.meaning||'表情')+']');}
function renderGroup(id){const g=S.groups.find(x=>x.id===id);if(!g)return '';
  if(S.wxLogin){if(!wxLoginActive())setTimeout(wxLogout,0);else{if(!_wxLoginTimer)wxLoginStartTimer();return wxLockedScreen();}}
  g.msgs.forEach(m=>{if(!m.id)m.id=uid();});
  let body='';g.msgs.forEach((m,i)=>{body+=chatBoundaryHTML(i?g.msgs[i-1]:null,m);body+=gbubble(g,m);});
  if(_groupTyping[id])body+=groupTypingHTML(g,_groupTyping[id]);
  const sel=_gmsel&&_gmsel.id===id;
  const panel=`<div class="panel chat-tools-panel group-chat-tools" id="gpanel" data-page="fn"><div class="chat-panel-pane chat-function-pane on"><div class="chat-function-viewport"><section class="chat-function-page">
      <button type="button" class="it" onclick="groupRpSendOpen('${id}')"><span class="b">${svgIc('redpacket',26,'currentColor')}</span><span>红包</span></button>
      <button type="button" class="it" onclick="groupPayPick('role','${id}')"><span class="b">${svgIc('money',26,'currentColor')}</span><span>转账</span></button>
      <button type="button" class="it" onclick="document.getElementById('gpanel').classList.remove('show');groupAt('${id}')"><span class="b" style="font-size:24px">@</span><span>提到谁</span></button>
      <button type="button" class="it" onclick="enterGSelect('${id}')"><span class="b">${svgIc('forward',26,'currentColor')}</span><span>多选转发</span></button>
      <button type="button" class="it" onclick="enterGSelect('${id}','delete')"><span class="b">${svgIc('trash',26,'currentColor')}</span><span>多选删除</span></button>
      <button type="button" class="it" onclick="addSticker()"><span class="b">${svgIc('smile',26,'currentColor')}</span><span>添加表情</span></button>
      <button type="button" class="it" onclick="openStickerBatchImport()"><span class="b">${svgIc('image',26,'currentColor')}</span><span>批量添加</span></button>
    </section></div></div><div class="chat-panel-pane chat-emoji-pane">${groupEmojiPanelHTML(id)}</div></div>`;
  const inbar=sel
    ?`<div class="inputbar"><button class="btn g" style="flex:1" onclick="exitGSelect()">取消</button>${_gmsel.mode==='delete'?`<button class="btn d" style="flex:1" onclick="gDelSelected('${id}')">删除(<span id="gfwdcnt">${_gmsel.ids.length}</span>)</button>`:`<button class="btn" style="flex:1;background:#07c160;color:#fff" onclick="gForwardSelected('${id}')">转发(<span id="gfwdcnt">${_gmsel.ids.length}</span>)</button>`}</div>`
    :(gmMuteNoticeHTML('role',id)||gQuoteHTML(id)+groupComposerHTML('group',id,'ginput','群里说点啥…',`sendGroup('${id}')`,'gpanel'));
  const bgSource=g.chatBg?storedImageDisplaySource(g.chatBg):'';
  return `<div class="nav chat-glass-nav"><span class="l" onclick="back()">‹</span><span class="t">${esc(groupDisplayName(g))}(${g.members.length+1})</span><span class="r" onclick="ginfoOpen('role','${id}')">⋯</span></div>
    <div class="chatbg" id="chatbg"${bgSource?` style="background:url(${bgSource}) center/cover"`:''}>${body}</div>
    ${panel}
    ${inbar}`;}
/* 群聊长按引用：和单聊一样按住半秒，输入框上面出现引用条，发出去的那句带着引用 */
let _gquoting=null;
function gqPressStart(gid,mid){if(S.settings.quoteOn===false)return;_lpFired=false;clearTimeout(_lpT);_lpT=setTimeout(()=>{_lpFired=true;gQuoteSet(gid,mid);},480);}
function gQuoteSet(gid,mid){const g=S.groups.find(x=>x.id===gid),m=g&&g.msgs.find(x=>x.id===mid),txt=quoteTextOf(m);if(!txt){toast('这条没法引用');return;}_gquoting={gid,text:txt,who:gnm(g,m.senderId)};try{closeModal();}catch(_){}gQuoteRefresh(gid);const ta=$('#ginput');if(ta)ta.focus();}
function gQuoteHTML(gid){if(S.settings.quoteOn===false||!_gquoting||_gquoting.gid!==gid)return '';const t=_gquoting.text||'';return `<div class="chat-quote-pending" id="chatQuotePending" role="status"><span class="chat-quote-pending-text"><b>${esc(_gquoting.who||'')}：</b>${esc(t)}</span><button type="button" class="chat-quote-cancel" aria-label="取消引用" onpointerdown="event.stopPropagation()" onclick="gQuoteClear(event)"><span aria-hidden="true">×</span></button></div>`;}
function gQuoteRefresh(gid){if(cur().p!=='group'||cur().id!==gid)return;const old=$('#chatQuotePending'),bar=document.querySelector('#app>.page>.chat-inputbar')||$('.chat-inputbar'),html=gQuoteHTML(gid);if(old){if(html)old.outerHTML=html;else old.remove();}else if(html&&bar)bar.insertAdjacentHTML('beforebegin',html);}
function gQuoteClear(ev){if(ev){if(ev.preventDefault)ev.preventDefault();if(ev.stopPropagation)ev.stopPropagation();}const gid=_gquoting&&_gquoting.gid;_gquoting=null;if(gid)gQuoteRefresh(gid);}
function gMsgMenu(gid,mid){if(_lpFired){_lpFired=false;return;}/* 刚长按过=去引用了，别再弹菜单 */const g=S.groups.find(x=>x.id===gid);if(!g)return;const m=g.msgs.find(x=>x.id===mid);if(!m||m.type==='sys')return;const me=m.senderId==='me';
  openModal(`<h3>消息操作</h3>
   <button class="btn g" style="margin-bottom:8px" onclick="gForwardOne('${gid}','${mid}')">↗️ 转发</button>
   <button class="btn d" style="margin-bottom:8px" onclick="gRecallMsg('${gid}','${mid}')">↩️ 撤回${me?'':'（对方这条）'}</button>
   <button class="btn d" style="margin-bottom:8px" onclick="gDelOne('${gid}','${mid}')">删除这条</button>
   <button class="btn p" style="margin-bottom:8px" onclick="closeModal();enterGSelect('${gid}')">多选</button>
   <button class="btn g" onclick="closeModal()">取消</button>`);}
function gDelOne(gid,mid){const g=S.groups.find(x=>x.id===gid);if(!g)return;g.msgs=g.msgs.filter(m=>m.id!==mid);save();closeModal();render();toast('已删除');}
function gRecallMsg(gid,mid){const g=S.groups.find(x=>x.id===gid);if(!g)return;const i=g.msgs.findIndex(m=>m.id===mid);if(i<0)return;const me=g.msgs[i].senderId==='me';g.msgs[i]={senderId:'me',role:'user',type:'sys',content:(me?'你':'对方')+'撤回了一条消息',time:g.msgs[i].time,id:mid};save();closeModal();render();}
function enterGSelect(id,mode){_gmsel={id,ids:[],mode:mode==='delete'?'delete':'forward'};const p=document.getElementById('gpanel');if(p)p.classList.remove('show');try{closeModal();}catch(e){}render();}
function exitGSelect(){_gmsel=null;render();}
function gToggleSel(mid){if(!_gmsel)return;const i=_gmsel.ids.indexOf(mid);if(i<0)_gmsel.ids.push(mid);else _gmsel.ids.splice(i,1);render();}
async function gDelSelected(id){if(!_gmsel||!_gmsel.ids.length){toast('先选几条');return;}if(!await uiConfirm('删除选中的 '+_gmsel.ids.length+' 条？'))return;const g=S.groups.find(x=>x.id===id);if(g)g.msgs=g.msgs.filter(m=>_gmsel.ids.indexOf(m.id)<0);_gmsel=null;save();render();toast('已删除');}
function gForwardOne(gid,mid){closeModal();_gfwd={gid,ids:[mid]};pickTarget(gDoForward);}
function gForwardSelected(id){if(!_gmsel||!_gmsel.ids.length){toast('先选几条');return;}_gfwd={gid:id,ids:_gmsel.ids.slice()};pickTarget(gDoForward);}
function gDoForward(toId){if(!_gfwd)return;const g=S.groups.find(x=>x.id===_gfwd.gid);const c=getC(toId);if(!g||!c){_gfwd=null;return;}
  const picked=g.msgs.filter(m=>_gfwd.ids.indexOf(m.id)>=0&&m.type!=='sys');
  const lines=picked.map(m=>({who:m.senderId==='me'?S.me.name:(getC(m.senderId)?getC(m.senderId).name:'?'),text:gmText(m)}));
  if(!lines.length){toast('没有可转发的内容');_gfwd=null;return;}
  msgs(toId).push({role:'user',type:'chatlog',title:'群聊「'+g.name+'」的聊天记录',lines,time:Date.now(),id:uid()});
  _gfwd=null;_gmsel=null;save();toast('已转发给 '+(c.remark||c.name));openChat(toId);scheduleReply(toId);}
function groupSendCard(id,type){const g=S.groups.find(x=>x.id===id);if(!g){closeModal();return;}
  const v=prompt(type==='redpacket'?'发个群红包，金额：':'转账金额：',type==='redpacket'?'5.20':'13.14');if(v==null){closeModal();return;}
  const amt=Math.max(0,+v||0);if(!amt){toast('金额填错了');return;}
  if(amt>S.me.balance){toast('余额不够哦💸');return;}
  const note=(prompt('附言（可空）：',type==='redpacket'?'恭喜发财，大吉大利':'给你～')||'').trim();
  addBill('out',amt,'群里'+(type==='redpacket'?'发红包':'转账'));
  g.msgs.push({senderId:'me',role:'user',type,amount:amt,note,time:Date.now(),id:uid(),received:false});save();closeModal();render();
  toast((type==='redpacket'?'🧧 红包':'💸 转账')+'已发出 ¥'+amt.toFixed(2));aiGroupReply(id,'');}
async function clearGroupMsgs(id){const g=S.groups.find(x=>x.id===id);if(!g)return;if(!await uiConfirm('清空这个群的全部聊天记录？'))return;g.msgs=[];save();closeModal();render();toast('已清空群聊');}
function groupRels(id){const g=S.groups.find(x=>x.id===id);if(!g)return;g.rels=g.rels||[];_grelGid=id;
  const people=[['me',S.me.name]].concat(g.members.map(cid=>{const c=getC(cid);return c?[cid,(c.remark||c.name)]:null;}).filter(Boolean));
  const opt=()=>people.map(p=>`<option value="${p[0]}">${esc(p[1])}</option>`).join('');
  const chips=()=>people.map(p=>`<span class="minibtn" onclick="grelChip('${p[0]}')" style="margin:2px;background:${_grelPick.indexOf(p[0])>=0?'#19a463':'#2c2c2e'};color:${_grelPick.indexOf(p[0])>=0?'#fff':'#ccc'}">${esc(p[1])}</span>`).join('');
  const arrow={'1v1':'↔','1vN':'→','Nv1':'→'};
  const relRows=g.rels.length?g.rels.map((r,i)=>{const aN=Array.isArray(r.a)?r.a.map(grelName).join('、'):grelName(r.a);const bN=Array.isArray(r.b)?r.b.map(grelName).join('、'):grelName(r.b);
    return `<div class="section" style="margin-bottom:6px"><div class="it" onclick="(function(){var d=document.getElementById('reld_${i}');if(d)d.style.display=d.style.display==='none'?'block':'none';})()"><span style="flex:1;font-size:14px">${esc(aN)} ${arrow[r.mode]||'↔'} ${esc(bN)} <span style="color:#19a463;font-size:12px;background:rgba(25,164,99,.18);border-radius:6px;padding:1px 7px">${esc(r.rel||'')}</span></span><span class="v">⌄</span></div><div id="reld_${i}" style="display:none;padding:6px 14px 10px;font-size:12px;color:#999">${r.story?esc(r.story)+'<br>':''}<span onclick="grelDel('${id}',${i})" style="color:#fa5151;cursor:pointer">🗑 删除这条关系</span></div></div>`;}).join(''):'<div class="hint" style="padding:6px 0">还没设关系，下面加一条～</div>';
  let picker;
  if(_grelMode==='1v1')picker=`<div class="two"><div class="field"><select id="grel_a" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${opt()}</select></div><div class="field"><select id="grel_b" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${opt()}</select></div></div>`;
  else if(_grelMode==='1vN')picker=`<div class="field"><label>谁</label><select id="grel_a" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${opt()}</select></div><div class="field"><label>对这些人（点选可多选）</label><div>${chips()}</div></div>`;
  else picker=`<div class="field"><label>这些人（点选可多选）</label><div>${chips()}</div></div><div class="field"><label>对谁</label><select id="grel_b" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${opt()}</select></div>`;
  openModal(`<h3>群关系网</h3><div class="hint">关系网每次 AI 回复前必读，帮 AI 理解群内人物关系。直接选人物，不用手写名字。</div>
   ${relRows}
   <div class="section" style="margin-top:10px;padding:12px"><div style="font-weight:600;margin-bottom:8px">添加关系</div>
   <div style="display:flex;gap:6px;margin-bottom:10px">${[['1v1','单对单'],['1vN','1对多'],['Nv1','多对1']].map(m=>`<button class="minibtn" style="flex:1;background:${_grelMode===m[0]?'#19a463':'#2c2c2e'};color:${_grelMode===m[0]?'#fff':'#ccc'}" onclick="_grelMode='${m[0]}';_grelPick=[];groupRels('${id}')">${m[1]}</button>`).join('')}</div>
   ${picker}
   <div class="field"><input id="grel_rel" placeholder="关系（如：情侣、闺蜜、死对头、上司）"></div>
   <div class="field"><textarea id="grel_story" rows="2" placeholder="故事设定（选填，两人之间的背景故事）"></textarea></div>
   <button class="btn p" onclick="grelAdd('${id}')">＋ 添加关系</button></div>
   <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function grelChip(k){const i=_grelPick.indexOf(k);if(i<0)_grelPick.push(k);else _grelPick.splice(i,1);if(_grelGid)groupRels(_grelGid);}
function grelAdd(id){const g=S.groups.find(x=>x.id===id);if(!g)return;g.rels=g.rels||[];const rel=($('#grel_rel').value||'').trim();if(!rel){toast('填一下是什么关系');return;}const story=($('#grel_story').value||'').trim();let a,b;
  if(_grelMode==='1v1'){a=$('#grel_a').value;b=$('#grel_b').value;if(a===b){toast('选两个不同的人');return;}}
  else if(_grelMode==='1vN'){a=$('#grel_a').value;b=_grelPick.filter(x=>x!==a);if(!b.length){toast('给"多"的一方点选几个人');return;}}
  else{b=$('#grel_b').value;a=_grelPick.filter(x=>x!==b);if(!a.length){toast('给"多"的一方点选几个人');return;}}
  g.rels.push({mode:_grelMode,a,b,rel,story});_grelPick=[];save();groupRels(id);toast('已添加关系');}
function grelDel(id,i){const g=S.groups.find(x=>x.id===id);if(!g||!g.rels)return;g.rels.splice(i,1);save();groupRels(id);}
/* 群聊引用：和单聊一样的新版引用框，放在气泡下面。 */
function groupQuoteBar(q){if(!q||!q.text)return '';const s=String(q.text||'');return `<div class="chat-quote-sent"><b>${esc(q.who||'')}：</b><span>${esc(s)}</span></div>`;}
function gbubble(g,m){const me=m.senderId==='me';if(m.type==='sys')return rpSysIs(m)?rpSysHTML(m.content):`<div class="tstamp"><span>${esc(m.content)}</span></div>`;
  const c=me?null:getC(m.senderId),_gbl=groupBubbleLook(g,m.senderId),_gbi=groupBubbleIcon(g,m.senderId),_gav=groupBubbleAvatarClass(g,m.senderId);const av0=av(me?S.me.avatar:(c?c.avatar:'🙂'),_gav);const nm=me||g.hideNames?'':`<div class="gname">${esc(gnm(g,m.senderId))}</div>`;
  const q=groupQuoteBar(!me&&m.q&&(m.q.senderId==='me'||m.q.who===gnm(g,'me'))?null:m.q);
  let inner;
  if(m.type==='redpacket'){const st=gRpState(m),opened=me?st.done:!!(st.mine||st.done);
    inner=rpCardHTML({me,opened,note:m.note,status:st.mine&&!me?'已领取':st.done?'已被领完':'',click:`redpOpen('group','${g.id}','${m.id}')`});
  }else if(m.type==='transfer'){const got=m.received,forMe=!me&&(!m.to||m.to==='me'),toName=m.to&&m.to!=='me'?gnm(g,m.to):'';
    inner=groupTransferCardHTML({me,received:got,amount:m.amount,note:m.note,toName:forMe?'':toName,click:`openGroupTransferDetail('${g.id}','${m.id}')`});
  }else if(m.type==='image')inner=`<div class="imagemsg" onclick="event.stopPropagation();viewImg(${esc(jq(m.src||''))})">${stickerImageHTML(m.src||'')}</div>`;
  else if(m.type==='sticker')inner=`<div class="stickermsg">${isImg(storedImageDisplaySource(m.img))?`<img src="${storedImageDisplaySource(m.img)}">`:''}${m.meaning?`<div class="stkm">${esc(m.meaning)}</div>`:''}</div>`;
  else if(m.type==='voice')inner=`<div class="bubble group-voice-bubble${_gbl.cls}"${_gbl.css?` style="${_gbl.css}"`:''}>${_gbi}<span aria-hidden="true">◖ )))</span><span>${esc(m.content||'语音消息')}</span></div>${q}`;
  else inner=`<div class="bubble${_gbl.cls}"${_gbl.css?` style="${_gbl.css}"`:''}>${_gbi}${esc(m.content)}</div>${q}`;
  const selecting=_gmsel&&_gmsel.id===g.id;
  const tick=selecting?`<span style="align-self:center;font-size:20px;margin:0 4px;color:${_gmsel.ids.includes(m.id)?'#07c160':'#666'}">${_gmsel.ids.includes(m.id)?'☑':'⚪'}</span>`:'';
  const click=selecting?`onclick="gToggleSel('${m.id}')"`:`onclick="gMsgMenu('${g.id}','${m.id}')"`;
  const lp=!selecting&&(m.type==='text'||m.type==='voice')?` onmousedown="gqPressStart('${g.id}','${m.id}')" onmouseup="qPressEnd()" onmouseleave="qPressEnd()" ontouchstart="gqPressStart('${g.id}','${m.id}')" ontouchend="qPressEnd()" ontouchmove="qPressEnd()" oncontextmenu="event.preventDefault()"`:'';
  return `<div data-message-id="${esc(m.id)}" data-wx-motion-id="${esc(wechatMotionMessageId(m))}" class="msg ${me?'me':'them'}${nm?' gnamed':''}" ${click}${lp} style="cursor:pointer">${selecting&&me?tick:''}${av0}<div class="col">${nm}${inner}${(typeof messageBeijingTimeHTML==='function'&&messageBeijingTimeHTML(m))||`<div class="msgt">${hm(m.time)}</div>`}</div>${selecting&&!me?tick:''}</div>`;}
function gGrab(gid,mid,quiet){const g=S.groups.find(x=>x.id===gid);if(!g)return;const m=g.msgs.find(x=>x.id===mid);if(!m||(m.type!=='transfer'&&m.type!=='redpacket'))return;
  if(m.type==='redpacket'){const got=gRpTake(g,m,'me');if(got&&!quiet)toast('已领取 ¥'+got.amount.toFixed(2));return;}
  if(m.received||(m.to&&m.to!=='me'))return;/* 群转账指定了收款人，只有那个人能收 */
  m.received=true;m.receivedAt=Date.now();const nm=getC(m.senderId)?getC(m.senderId).name:'群友';addBill('in',+m.amount||0,nm+'的群转账');save();render();if(!quiet)toast('已收款 ¥'+(+m.amount).toFixed(2));}
/* ===== 群红包：拼手气/普通，按个数让大家抢；群转账：先选收款方再转 =====
   红包消息存 count(个数)、splits(每一份多少)、grabs(谁抢了哪一份)；老的单个红包第一次被读到时补成 1 个。 */
const GRP_MAX_COUNT=100;
function rpSplitCents(total,count,rand){rand=rand||Math.random;let left=Math.round(total*100),n=Math.max(1,count|0);const out=[];
  while(n>1){const max=Math.max(1,Math.floor(left/n*2));let a=Math.max(1,Math.floor(rand()*max));a=Math.min(a,left-(n-1));out.push(a);left-=a;n--;}
  out.push(left);return out.map(c=>c/100);}
function gRpState(m){if(!m||m.type!=='redpacket')return null;
  if(!Array.isArray(m.splits)||!m.count){m.count=1;m.splits=[+m.amount||0];m.lucky=false;m.grabs=Array.isArray(m.grabs)?m.grabs:(m.received?[{who:'me',amount:+m.amount||0,time:+m.receivedAt||+m.time||Date.now()}]:[]);}
  if(!Array.isArray(m.grabs))m.grabs=[];
  const grabs=m.grabs,done=grabs.length>=m.count,mine=grabs.find(x=>x.who==='me')||null,got=Math.round(grabs.reduce((a,x)=>a+(+x.amount||0),0)*100)/100;
  let best=-1;if(done&&m.count>1&&m.lucky!==false)grabs.forEach((x,i)=>{if(best<0||x.amount>grabs[best].amount)best=i;});
  return {count:m.count,splits:m.splits,grabs,done,mine,got,best,lucky:m.lucky!==false,total:+m.amount||0};}
function gRpTake(g,m,who){const target=gRpRecipient(g,m);if(target&&target!==who)return null;const st=gRpState(m);if(!st||st.done||st.grabs.some(x=>x.who===who))return null;
  const one={who,amount:+st.splits[st.grabs.length]||0,time:Date.now()};st.grabs.push(one);if(who==='me'){m.received=true;m.receivedAt=one.time;}
  const sender=m.senderId==='me'?'你':gnm(g,m.senderId);
  if(who==='me'){addBill('in',one.amount,(m.senderId==='me'?'自己':sender)+'的群红包');g.msgs.push({senderId:'me',type:'sys',rp:1,content:m.senderId==='me'?'你领取了自己发的红包':'你领取了'+sender+'的红包',time:one.time,id:uid()});}
  else if(m.senderId==='me')g.msgs.push({senderId:'me',type:'sys',rp:1,content:gnm(g,who)+'领取了你的红包',time:one.time,id:uid()});
  save();return one;}
function gRpRefresh(gid){const c=cur();if((c.p==='group'&&c.id===gid)||(c.p==='rpDetail'&&c.scope==='group'&&c.key===gid))render();}
// 角色抢红包：情侣角色一定抢而且抢得快，其他人看心情，抢的先后随机
function gRpRoleGrabs(gid,mid){const g=S.groups.find(x=>x.id===gid),m=g&&g.msgs.find(x=>x.id===mid);if(!m)return;const couple=S.couple&&S.couple.cid;
  const target=gRpRecipient(g,m),people=g.members.filter(cid=>getC(cid)&&cid!==m.senderId&&(!target||cid===target)).sort(()=>Math.random()-.5).sort((a,b)=>(b===couple)-(a===couple));
  let t=700;people.forEach(cid=>{if(cid!==couple&&Math.random()<.22)return;t+=500+Math.random()*2400;setTimeout(()=>{const g2=S.groups.find(x=>x.id===gid),m2=g2&&g2.msgs.find(x=>x.id===mid);if(!m2||!g2.members.includes(cid))return;if(gRpTake(g2,m2,cid))gRpRefresh(gid);},t);});
  /* 我发的红包：大家抢完再一起开口（谁抢得多、谁手慢），角色自己发的红包本来就在说话，不再多催一轮 */
  if(m.senderId==='me')setTimeout(()=>{const g2=S.groups.find(x=>x.id===gid),m2=g2&&g2.msgs.find(x=>x.id===mid);if(!m2)return;const st=gRpState(m2),who=st.grabs.map(x=>gnm(g2,x.who)+'抢到'+(+x.amount).toFixed(2)+'元').join('、');aiGroupReply(gid,'（'+S.me.name+'发了红包'+(who?'，'+who:'，还没人抢')+'）');},t+900);}
// 角色在群里发的红包：按群人数自动拆成拼手气
function gRpPrepareRole(g,it){const target=gRpRecipient(g,it);if(target)it.to=target;const others=g.members.length;let n=it.count>=1?Math.min(it.count,GRP_MAX_COUNT):Math.max(1,Math.min(others,6));const cents=Math.round((+it.amount||0)*100);if(cents<1){it.amount=0.01;}n=Math.max(1,Math.min(n,Math.max(1,cents)));if(target)n=1;it.count=n;it.lucky=!target;it.splits=rpSplitCents(+it.amount||0.01,n);it.grabs=[];}
// 角色转给别的角色：对方几秒后收下
function gRoleTransferAccept(gid,mid){setTimeout(()=>{const g=S.groups.find(x=>x.id===gid),m=g&&g.msgs.find(x=>x.id===mid);if(!m||m.received||!g.members.includes(m.to))return;m.received=true;m.receivedAt=Date.now();save();if(cur().p==='group'&&cur().id===gid)render();},2000+Math.random()*4000);}
function gRpDuration(ms){const s=Math.max(1,Math.round(ms/1000));return s<60?s+'秒':s<3600?Math.round(s/60)+'分钟':Math.round(s/3600)+'小时';}
function groupRpSendOpen(id,kind){kind=kind==='pf'?'pf':'role';const p=$(kind==='pf'?'#pfgpanel':'#gpanel');if(p)p.classList.remove('show');_paySend={kind:'gred',scope:kind==='pf'?'pfg':'group',id:String(id),amount:'',count:'',note:'',lucky:true};go('grpSend',{id:String(id),kind});}
function groupRpSendState(id,kind){const scope=kind==='pf'?'pfg':'group';if(!_paySend||_paySend.kind!=='gred'||_paySend.id!==String(id)||_paySend.scope!==scope)_paySend={kind:'gred',scope,id:String(id),amount:'',count:'',note:'',lucky:true};return _paySend;}
function groupRpTotal(st){const a=+st.amount||0,n=parseInt(st.count,10)||0;return Math.round((st.lucky?a:a*n)*100)/100;}
function groupRpOk(st){const n=parseInt(st.count,10)||0,t=groupRpTotal(st);return n>=1&&n<=GRP_MAX_COUNT&&t>0&&Math.round(t*100)>=n;}
function renderGroupRpSend(c){const pf=c.kind==='pf',st=groupRpSendState(c.id,c.kind),ok=groupRpOk(st),total=groupRpTotal(st),people=pf?((pfGroupById(c.id)||{members:[]}).members||[]).length:((S.groups.find(x=>x.id===c.id)||{members:[]}).members.length+1);
  return `<div class="nav wx-pay-nav"><span class="l" onclick="back()">‹</span><span class="t">发红包</span><span class="r"></span></div>
  <main class="wx-rps wx-grps">
    <button type="button" class="wx-grps-type" onclick="groupRpTypeToggle()">${st.lucky?'拼手气红包':'普通红包'}<i aria-hidden="true"></i></button>
    <label class="wx-rps-row"><span>红包个数</span><input id="grpsCount" inputmode="numeric" autocomplete="off" placeholder="填写红包个数" value="${esc(st.count)}" oninput="groupRpInput(this,'count')"><em class="wx-grps-unit">个</em></label>
    <div class="wx-grps-hint">本群共${people}人</div>
    <label class="wx-rps-row"><span class="wx-grps-lab">${st.lucky?'<i class="wx-grps-pin" aria-hidden="true">拼</i>总金额':'单个金额'}</span><input id="grpsAmt" inputmode="decimal" autocomplete="off" placeholder="¥0.00" value="${esc(st.amount)}" oninput="groupRpInput(this,'amount')"></label>
    <label class="wx-rps-row wish"><input id="rpsNote" maxlength="25" autocomplete="off" placeholder="${RP_DEFAULT_NOTE}" value="${esc(st.note)}" oninput="if(_paySend)_paySend.note=this.value"><i class="wx-rps-emoji" aria-hidden="true"><svg viewBox="0 0 28 28"><circle cx="12.5" cy="12.5" r="10.5"/><circle cx="9" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><path d="M8 15.5c1.2 2 2.8 3 4.5 3s3.3-1 4.5-3"/><path d="M22 19v7M18.5 22.5h7"/></svg></i></label>
    <div class="wx-rps-row cover" role="button" tabindex="0" onclick="toast('现在只有默认封面')"><span>红包封面</span><i class="wx-rps-chev" aria-hidden="true">›</i></div>
    <div class="wx-rps-total"><span>¥</span><b id="rpsTotal">${total.toFixed(2)}</b></div>
    <button type="button" id="rpsGo" class="wx-rps-go${ok?'':' off'}" ${ok?'':'disabled'} onclick="groupRpSubmit()">塞钱进红包</button>
    <div class="wx-rps-foot">未领取的红包，将于24小时后发起退款</div>
  </main>`;}
function groupRpTypeToggle(){const s=_paySend;if(!s||s.kind!=='gred')return;s.lucky=!s.lucky;render();toast(s.lucky?'已改为拼手气红包':'已改为普通红包');}
function groupRpInput(el,field){const s=_paySend;if(!s||!el)return;let v=field==='count'?String(el.value||'').replace(/\D/g,'').replace(/^0+/,'').slice(0,3):payAmountClean(el.value);if(v!==el.value)el.value=v;s[field]=v;
  const t=$('#rpsTotal');if(t)t.textContent=groupRpTotal(s).toFixed(2);const ok=groupRpOk(s),b=$('#rpsGo');if(b){b.classList.toggle('off',!ok);b.disabled=!ok;}}
function groupRpSubmit(){const s=_paySend;if(!s||s.kind!=='gred')return;const pf=s.scope==='pfg',g=pf?pfGroupById(s.id):S.groups.find(x=>x.id===s.id);if(!g){toast('群不在了');return;}
  const n=parseInt(s.count,10)||0,total=groupRpTotal(s);if(!(n>=1)){toast('填一下红包个数');return;}if(n>GRP_MAX_COUNT){toast('一次最多发'+GRP_MAX_COUNT+'个');return;}if(!(total>0)){toast('填金额呀');return;}if(Math.round(total*100)<n){toast('单个红包金额不可低于0.01元');return;}if(total>S.me.balance){toast('余额不够啦（去钱包看看）');return;}
  const note=String(s.note||'').trim(),splits=s.lucky?rpSplitCents(total,n):Array(n).fill(Math.round(total*100/n)/100);_paySend=null;
  if(pf){back();sendPhoneFriendGroupBody(s.id,pfPack({type:'redpacket',amount:total,note,count:n,lucky:!!s.lucky,splits}),{bill:{amount:total,note:'小手机群里发红包',refundName:'小手机群红包'}});return;}
  addBill('out',total,'群里发红包');const m={senderId:'me',role:'user',type:'redpacket',amount:total,count:n,lucky:!!s.lucky,splits,grabs:[],note,time:Date.now(),id:uid(),received:false};g.msgs.push(m);save();back();
  gRpRoleGrabs(g.id,m.id);}
function renderGroupRpDetail(r){const pf=r.kind==='pf',g=pf?null:(S.groups||[]).find(x=>x.id===r.key),m=r.m,st=pf?r.st:gRpState(m);save();
  const myKey=pf?String(phoneFriendState().id||'').toUpperCase():'me';
  const nav=`<div class="nav wx-rpd-nav"><span class="l" onclick="back()">‹</span><span class="t"></span><span class="r"></span></div>`;
  const mine=st.mine,sumLine=st.done?`${st.count}个红包共${st.total.toFixed(2)}元，${gRpDuration(Math.max(...st.grabs.map(x=>+x.time||0))-(+m.time||0))}被抢光`:(r.me?`已领取${st.grabs.length}/${st.count}个，共${st.got.toFixed(2)}/${st.total.toFixed(2)}元`:`领取${st.grabs.length}/${st.count}个`);
  const rows=st.grabs.slice().map((x,i)=>({x,i})).sort((a,b)=>(+b.x.time||0)-(+a.x.time||0)).map(({x,i})=>{const isMe=x.who===myKey,c=isMe||pf?null:getC(x.who),name=isMe?(S.me.name||'我'):pf?pfRpName(r.key,x.who):(g?gnm(g,x.who):(c&&c.name)||'群友'),face=isMe?av(S.me.avatar,''):pf?pfAvatarHTML(phoneFriendById(x.who)||{phone_id:x.who,display_name:name},''):av(c&&c.avatar,'');
    return `<div class="wx-grpd-row"><span class="wx-grpd-av">${face}</span><span class="wx-grpd-who"><b>${esc(name)}</b><small>${hm(x.time)}</small></span><span class="wx-grpd-amt"><b>${(+x.amount||0).toFixed(2)}元</b>${i===st.best?'<em><svg viewBox="0 0 16 12" aria-hidden="true"><path d="M1 3l3.6 3L8 1l3.4 5L15 3l-1.6 8H2.6z"/></svg>手气最佳</em>':''}</span></div>`;}).join('');
  const got=mine?`<div class="wx-rpd-amt"><b>${(+mine.amount).toFixed(2)}</b><span>元</span></div><div class="wx-rpd-tip wx-grpd-tip">已存入零钱，可直接消费<i aria-hidden="true">›</i></div><button type="button" class="wx-grpd-reply" onclick="groupRpReplySticker('${r.key}','${pf?'pf':'role'}')">${svgIc('smile',18,'currentColor')}<span>回复表情到聊天</span></button>`:(st.done?'<div class="wx-rpd-state">手慢了，红包派完了</div>':'');
  return nav+`<main class="wx-rpd wx-grpd"><div class="wx-rpd-head"></div><div class="wx-rpd-from">${r.avatarHTML}<b>${esc(r.senderName)}发出的红包</b>${st.lucky&&st.count>1?'<i class="wx-grps-pin" aria-hidden="true">拼</i>':''}</div><div class="wx-rpd-wish">${esc(r.note)}</div>${got}
    <section class="wx-grpd-list"><div class="wx-grpd-sum">${sumLine}</div>${rows}</section>${r.me&&!st.done?'<div class="wx-grpd-foot">未领取的红包，将于24小时后发起退款</div>':''}</main>`;}
function groupRpReplySticker(gid,kind){back();setTimeout(()=>{const c=cur();if(kind==='pf'?(c.p==='pfgroup'&&c.gid===gid):(c.p==='group'&&c.id===gid))groupComposerPanelToggle(kind==='pf'?'pfgpanel':'gpanel','emoji');},60);}
// 群转账：选择收款方页面点一个人，直接进那个人的转账键盘页
function groupPayPick(kind,id){const p=$(kind==='pf'?'#pfgpanel':'#gpanel');if(p)p.classList.remove('show');_gpick={kind,id,mode:'pay',sel:[],q:''};go('gpick',{kind,id,mode:'pay'});}
function groupPayPickGo(key){const {kind,id}=_gpick;back();paySendOpen('transfer',kind==='pf'?'pfgm':'gm',id+'|'+key);}
function groupPayParts(id){const s=String(id||''),i=s.indexOf('|');return i<0?[s,'']:[s.slice(0,i),s.slice(i+1)];}
function gNotify(g,c){if(cur().p==='group'&&cur().id===g.id)return;if(g.muted)return;/* 消息免打扰：不响、不弹横幅，聊天列表照常更新 */playMessageDing();const lm=g.msgs[g.msgs.length-1],line=gnm(g,c.id)+'：'+(lm?gmText(lm):'');lockNotify(g.name,line,{avatar:g.avatar,icon:'users',target:{type:'group',id:g.id}});appNotify(g.name,line,{tag:'group-'+g.id,data:{type:'open',target:'group',id:g.id}});if(lockVisible())return;const b=$('#msgBanner');if(!b)return;
  b.innerHTML=`${g.avatar?av(g.avatar,'sm'):'<div class="avatar sm" style="background:#7c6cc0">👥</div>'}<div style="flex:1;min-width:0"><div class="bn">${esc(g.name)}</div><div class="bm">${esc(gnm(g,c.id)+'：'+(lm?gmText(lm):''))}</div></div>`;
  b.className='msgbanner show';b.onclick=()=>{b.className='msgbanner';go('group',{id:g.id});};clearTimeout(_bannerT);_bannerT=setTimeout(()=>{b.className='msgbanner';},4500);}
function sendGroup(id){const g=S.groups.find(x=>x.id===id);if(gmMutedUntil('role',id,'me')){toast('你已被禁言');render();return;}const ta=$('#ginput');const t=ta.value.trim();if(!t)return;ta.value='';ta.style.height='auto';chatComposerStateSync(ta);const voice=groupComposerVoiceOn('group',id);
  const q=S.settings.quoteOn!==false&&_gquoting&&_gquoting.gid===id?{who:_gquoting.who,text:_gquoting.text}:null;_gquoting=null;
  g.msgs.push({senderId:'me',role:'user',type:voice?'voice':'text',content:t,dur:voice?Math.max(1,Math.round(t.length/3)):undefined,q:q||undefined,time:Date.now(),id:uid()});save();render();aiGroupReply(id,q?'（引用了 '+q.who+'：「'+q.text.slice(0,60)+'」）'+t:t);}
function groupAt(id){const g=S.groups.find(x=>x.id===id);openModal(`<h3>@ 谁</h3>${g.members.map(cid=>{const c=getC(cid);return c?`<div class="section"><div class="it" onclick="closeModal();var ta=$('#ginput');ta.value+='@${esc(c.name)} ';ta.focus()">${esc(c.name)}</div></div>`:'';}).join('')}<button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
// 群昵称：优先用群里设置的昵称，没有才用本名
function gnm(g,sid){const nk=g&&g.nicks&&g.nicks[sid];if(nk)return nk;if(sid==='me')return S.me.name;const c=getC(sid);return c?c.name:'?';}
function gName(m,g){return gnm(g,m.senderId);}
let _grelMode='1v1',_grelPick=[],_grelGid=null;
function grelName(k){return k==='me'?S.me.name:((getC(k)||{}).remark||(getC(k)||{}).name||'?');}
function relToText(r){const aN=Array.isArray(r.a)?r.a.map(grelName).join('、'):grelName(r.a);const bN=Array.isArray(r.b)?r.b.map(grelName).join('、'):grelName(r.b);return aN+(r.mode==='1v1'?' 和 ':' 对 ')+bN+' 是 '+r.rel+(r.story?'（背景：'+r.story+'）':'');}
function gContext(g,c,recent){const others=g.members.filter(x=>x!==c.id&&getC(x)).map(x=>gnm(g,x));
  recent=recent||g.msgs.slice(-14);
  const _myNick=(g.nicks&&g.nicks[c.id])||'';
  let s='\n\n# 你在群聊「'+g.name+'」里\n群里有：'+gnm(g,'me')+'(你们共同的恋人/主人)、'+others.join('、')+'。这是真实的多人群聊。'
   +(_myNick?'\n（你在这个群里的群昵称是「'+_myNick+'」，大家看到的你就是这个名字。）':'')
   +'\n- 你可以随心情【改自己在这个群里的群昵称】增加趣味：单独一行 [群昵称|新昵称]（比如改成搞怪的、或宣示主权的），改不改看你心情、别频繁乱改。这行不会被当成消息发出来。\n'
   +'- 你能看到上面【所有人】说的话，包括其他群友彼此之间的对话。要像真群聊那样：可以接群友的话、附和、拌嘴、调侃、起哄、吃醋——【不要每个人都只对着'+S.me.name+'说话】，不要和别人说一样的话、不要复读别人。\n'
   +'- 【绝对不要用 @某人】这种格式。想专门回应某一条消息，就在你那句话【前面单独占一行】写 [引用|序号]（序号见下面群记录），只允许引用其他角色/群友的消息；回复'+S.me.name+'时直接说话，不要引用ta的消息；不是每句都要引用，一次最多引用一两条。\n'
   +'- 群记录里用（）括起来的是群里发生的事，不是谁说的话。看到「撤回了一条消息」时，你只知道有人撤回了，看不到原内容，绝对不要编造被撤回的是什么；可以像真人那样好奇、追问、调侃或干脆不理，看你心情，不必每次都提。\n'
   +'- 【你引用谁、就是在对谁说话】：如果你 [引用] 的是【另一个群友】说的话，那你这句就是【冲着那个群友】说的——按你和ta的关系来（怼ta、附和ta、阴阳怪气、跟ta争风吃醋抢'+S.me.name+'都行），【不是】在对'+S.me.name+'说话，别把对群友说的话说得像在哄'+S.me.name+'。只有当你引用'+S.me.name+'、或者没引用谁时，才是在跟'+S.me.name+'说话。\n'
   +'- 像真人发微信，每条短消息单独占一行，条数按轮到你时的提示来；可以只回一条，话不投机也可以就接一句，别凑数、别每个人都发一样多。\n'
   +'- 红包、转账你想发就发（哄'+S.me.name+'、庆祝、赔罪、跟群友斗富、起哄都行，看你心情和性格）：单独一行 [红包|金额|祝福语|个数]（默认大家来抢）；专属红包必须写 [红包|金额|祝福语|1|收款人名字]，只有这个人能领，或 [转账|金额|说明|给谁]（给谁不写就是转给'+S.me.name+'，也可以写群友的名字）。金额自己定。\n'
   +'- 口语、自然、有情绪，符合你的人设和心情值。';
  if(g.notice)s+='\n# 群公告（群里每个人都看过，说话要照着公告来）\n'+String(g.notice).slice(0,500);
  {const admins=(g.admins||[]).filter(x=>getC(x)),mutes=typeof gmMutes==='function'?gmMutes('role',g.id):{},muted=Object.keys(mutes).map(k=>gnm(g,k)+'（还剩'+gmMinutesText(mutes[k])+'）');
   s+='\n# 群管理\n群主是'+gnm(g,'me')+'。'+(admins.length?'管理员：'+admins.map(x=>gnm(g,x)).join('、')+'。':'现在没有管理员。')+(muted.length?'被禁言中：'+muted.join('、')+'，被禁言的人现在发不了言。':'');
   if(admins.includes(c.id)){const isCouple=!!(S.couple&&S.couple.cid===c.id);s+='\n- 你是本群管理员，按你的性格和情绪决定要不要管人（别滥用、别每轮都用）：单独一行 [禁言|名字|分钟] 禁言某人，[解禁|名字] 解除，[踢出|名字] 把人移出群。这些行不会显示成消息，群里会出现系统提示。'+(isCouple?'你和'+S.me.name+'是情侣，只有你可以禁言群主'+S.me.name+'（写 [禁言|'+S.me.name+'|分钟]），但不能把ta踢出群。':'你不能禁言或踢出群主'+S.me.name+'，群里其他任何人（包括别的管理员）你都可以管。');}}
  {let relTxt=(g.rels&&g.rels.length)?g.rels.map(relToText).join('\n'):'';if(g.relations)relTxt+=(relTxt?'\n':'')+g.relations;{const net=typeof relAmongText==='function'?relAmongText(g.members):'';if(net)relTxt+=(relTxt?'\n':'')+net;}if(relTxt)s+='\n# 群里的人物关系（必读，严格按这些关系来理解谁跟谁、谁对谁是什么态度）\n'+relTxt;}
  s+='\n# 最近群聊记录（带序号，引用时用这个号）\n'+(recent.length?recent.map((m,i)=>'['+(i+1)+'] '+(m.type==='sys'?'（'+gmText(m)+'）':gName(m,g)+'：'+(m.q&&m.q.text?'（引用 '+m.q.who+'：「'+String(m.q.text).slice(0,40)+'」）':'')+gmText(m))).join('\n'):'（还没人说话）');
  return s;}
// 角色在群里发的红包/转账：说明后面可以再跟 |个数（红包）或 |给谁（转账）
