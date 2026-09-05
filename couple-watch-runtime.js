/* Only names and foreground routes cross this permission boundary. */
const COUPLE_WATCH_APPS={browser:'浏览器',moments:'朋友圈',spy:'查他手机',shop:'购物',calendar:'日历',x:'X',douyin:'抖音',food:'外卖',games:'游戏大厅',mail:'信箱',phoneapp:'电话',offline:'线下约会',roleplay:'角色扮演',tale:'规则怪谈',dread:'惊悚抉择',music:'音乐',cinema:'放映室',travel:'云程',pet:'电子宠物'};
var _coupleWatchEngine=null,_coupleWatchBusy=false;
function coupleWatchParticipants(p){
  const one=g=>g&&g.cid?[g.cid]:[];
  if(p==='gs')return one(_gs);
  if(p==='wg')return one(_wg);
  if(p==='drawguess')return one(_dg);
  if(p==='heartquiz')return typeof _hq==='undefined'?[]:one(_hq);
  if(p==='beadstudio')return typeof _bead==='undefined'?[]:one(_bead);
  if(p==='uc')return _uc?(_uc.players||[]).filter(x=>!x.isMe&&!x.bot&&String(x.id).startsWith('p_')).map(x=>x.id.slice(2)):[];
  if(p==='mgroom'){const room=mgrRoom(cur().id);return room?(room.roleIds||[]):[];}
  if(p==='tale')return S.tale&&S.tale.active?(S.tale.companions||[]):[];
  if(p==='dread')return S.dread&&S.dread.active?[S.dread.gm]:[];
  if(p==='cinemawatch'||p==='cinemaread'){const s=cinemaSession();return s&&s.status==='active'?one(s):[];}
  if(p==='off'){
    if(!_off)return[];
    const ids=[_off.id];
    if(_off.mode==='cohab'&&typeof theaterState==='function'){
      const t=theaterState(cohabData(_off.id));
      if(t&&t.enabled){if(!theaterPresent(t,'host'))ids.length=0;if(theaterPresent(t,'guest')&&t.guest.contactId)ids.push(t.guest.contactId);}
    }
    return ids;
  }
  if(p==='rp')return rpMembers(cur().id).map(x=>x.id);
  return [];
}
function coupleWatchRead(){
  const cp=S.couple;
  if(cp&&cp.watchDaily&&cp.watchDaily.day!==CoupleWatch.localDay(Date.now())){delete cp.watchDaily;save();}
  if(!cp||cp.chatWatch!==true&&cp.softwareWatch!==true)return null;
  const c=(S.contacts||[]).find(x=>x.id===cp.cid);
  if(!cp||!c||c.deleted||c.blocked||!isMain()||document.hidden||S.me.locked||_call||S.jail&&S.jail.active)return null;
  const page=cur(),p=page.p;
  if(p==='chat'){
    const target=(S.contacts||[]).find(x=>x.id===page.id&&!x.deleted);
    if(cp.chatWatch!==true||!target||target.id===cp.cid)return null;
    return{owner:cp,account:actId(),cid:cp.cid,kind:'chat',key:target.id,context:target.id,name:target.remark||target.name};
  }
  if(cp.softwareWatch!==true)return null;
  const key=p==='travel'?'travel':p==='pet'?'pet':p==='wg'?'games':curAppKey();
  if(!Object.hasOwn(COUPLE_WATCH_APPS,key)||!cp.watchApps||cp.watchApps[key]!==true)return null;
  const ids=coupleWatchParticipants(p).filter(Boolean),names=ids.map(id=>(S.contacts||[]).find(x=>x.id===id)).filter(Boolean).map(x=>x.remark||x.name);
  return{owner:cp,account:actId(),cid:cp.cid,kind:'app',key,name:COUPLE_WATCH_APPS[key],context:key+'|'+ids.slice().sort().join(','),partners:names,exempt:ids.includes(cp.cid)};
}
function coupleWatchTick(){if(_coupleWatchEngine)_coupleWatchEngine.tick();}
function coupleWatchToggle(kind){
  const cp=S.couple;if(!cp||!['chatWatch','softwareWatch'].includes(kind))return;
  cp[kind]=cp[kind]!==true;
  if(_coupleWatchEngine)_coupleWatchEngine.reset();save();render();
}
function coupleWatchAppToggle(key){
  if(!S.couple||!Object.hasOwn(COUPLE_WATCH_APPS,key))return;
  const list=document.getElementById('cou_watch_apps'),top=list?list.scrollTop:0;
  const selected=S.couple.watchApps||(S.couple.watchApps={});selected[key]=selected[key]!==true;
  if(_coupleWatchEngine)_coupleWatchEngine.reset();save();coupleWatchManage();
  const next=document.getElementById('cou_watch_apps');if(next)next.scrollTop=top;
}
function coupleWatchManage(){
  if(!S.couple)return;
  openModal('<h3>管理软件</h3><div id="cou_watch_apps" class="section" style="max-height:60vh;overflow:auto;margin:0">'+Object.entries(COUPLE_WATCH_APPS).map(([key,name])=>'<div class="it"><span>'+name+'</span><span role="switch" aria-label="'+name+'" aria-checked="'+!!(S.couple.watchApps&&S.couple.watchApps[key])+'" class="sw '+(S.couple.watchApps&&S.couple.watchApps[key]?'on':'')+'" onclick="coupleWatchAppToggle(\''+key+'\')"></span></div>').join('')+'</div>');
}
function coupleWatchPermissionHTML(){
  const cp=S.couple;if(!cp)return'';
  return '<div class="section" style="margin:12px;border-radius:16px;overflow:hidden"><div class="it"><span>聊天监管</span><span role="switch" aria-label="聊天监管" aria-checked="'+(cp.chatWatch===true)+'" class="sw '+(cp.chatWatch===true?'on':'')+'" onclick="coupleWatchToggle(\'chatWatch\')"></span></div><div class="it"><span>软件监管</span><span role="switch" aria-label="软件监管" aria-checked="'+(cp.softwareWatch===true)+'" class="sw '+(cp.softwareWatch===true?'on':'')+'" onclick="coupleWatchToggle(\'softwareWatch\')"></span></div>'+(cp.softwareWatch===true?'<div class="it" onclick="coupleWatchManage()"><span>管理软件</span><span class="v">›</span></div>':'')+'</div>';
}
function coupleWatchFact(event){
  const safe=x=>String(x||'').replace(/[\r\n\[\]【】]/g,' ').slice(0,80);
  const activity=event.kind==='chat'?'停留在与「'+safe(event.name)+'」的聊天页面':'正在使用「'+safe(event.name)+'」'+(event.partners&&event.partners.length?'，当前一起参与的是：'+event.partners.map(safe).join('、'):'，没有已确认的同行角色');
  return '这次获得的唯一新事实：对方'+activity+'。这是今天第 '+event.count+' 次进入同一'+(event.kind==='chat'?'聊天':'软件')+'。次数包含之前短暂进入，但之前短暂停留没有发给你，也不代表你当时就知道；跨午夜重新计数。\n你只知道对象或软件名称和本日进入次数，不能看到他们的聊天正文、输入草稿、游戏对话或电影内容。停留不等于已经发言，更不能编造暧昧内容。请结合你本人的人设、关系和最近已完成的对话，自然主动给对方发来一至三句微信。情绪由你自己判断，不强制吃醋或责问，不重复回答上一条旧消息，不说系统、监管、权限、检测、计时或规则。不输出操作标签、旁白或卡片，只输出角色本人对对方说的话。';
}
function coupleWatchReady(event){
  const key=replyStateKey(event.cid,event.account),last=msgsForAccount(event.cid,event.account).at(-1);
  return !_coupleWatchBusy&&!replyGenerationBusy(event.cid,event.account)&&!_replyTimers[key]&&!featureEventQueueEntries(event.cid,event.account).length&&!roleOnlineProactiveBlocked(event.cid)&&!cinemaRoleOccupied(event.cid)&&!wxLoginActive()&&!remoteControlActive()&&!_call&&!(last&&last.role==='user');
}
async function coupleWatchReact(event,valid){
  const c=getC(event.cid),aid=event.account,key=replyStateKey(event.cid,aid);
  const busy=()=>replyGenerationBusy(event.cid,aid)||!!_replyTimers[key]||featureEventQueueEntries(event.cid,aid).length>0||roleOnlineProactiveBlocked(event.cid)||cinemaRoleOccupied(event.cid)||wxLoginActive()||remoteControlActive()||_call;
  if(_coupleWatchBusy||!c||busy()||!valid())return false;
  const epoch=replyEpoch(c.id,aid),rows=msgsForAccount(c.id,aid),last=rows[rows.length-1];
  const fresh=()=>valid()&&!busy()&&!replyStale(c.id,epoch,aid)&&msgsForAccount(c.id,aid).at(-1)===last;
  if(last&&last.role==='user')return false;
  _coupleWatchBusy=true;
  try{
    // Only the bound role's own context is used; never read the observed role's messages.
    const history=lastRounds(rows,S.settings.hist||12).filter(m=>m&&['user','assistant'].includes(m.role)&&m.type!=='sys').map(m=>({role:m.role,content:msgToText(m)})).filter(m=>m.content);
    const fact=coupleWatchFact(event),system=buildSystem(c,{natural:true,query:fact});
    if(!fresh())return false;
    const raw=await chatAPI([{role:'system',content:system},...history,{role:'user',content:fact}],{routeIndex:roleChatRouteIndex(c),aux:c.model==='aux',independentRoleModel:true,complete:true,timeout:60000});
    if(!fresh())return false;
    const text=roleVisibleEnvelopeText(raw),lines=splitBubbles(text).map(x=>x.trim()).filter(x=>x&&!/^[\[【](?:心情|心情值|心声|内心独白)[|｜:：][^\]】]*[\]】]$/.test(x));
    // A failed/invalid generation is silent. No fabricated reply or automatic retry.
    if(!lines.length||lines.length>3||lines.some(x=>/[\[【][^\]】]*[\]】]/.test(x)||isOOCLine(x)||/系统提示|聊天监管|软件监管/.test(x)))return false;
    if(initiativeRecentlyRepeated(c.id,text))return false;
    const messages=lines.map(content=>({id:uid(),role:'assistant',type:'text',content,time:Date.now()}));
    if(!fresh())return false;
    msgsForAccount(c.id,aid).push(...messages);save();messages.forEach(m=>notifyIncoming(c,m));
    return true;
  }catch(_){return false;}finally{_coupleWatchBusy=false;}
}
if(typeof CoupleWatch!=='undefined'){
  _coupleWatchEngine=CoupleWatch.create({read:coupleWatchRead,save:()=>save(),ready:coupleWatchReady,react:coupleWatchReact});
  setInterval(coupleWatchTick,250);
  document.addEventListener('visibilitychange',()=>{_coupleWatchEngine.reset();coupleWatchTick();});
  window.addEventListener('pagehide',()=>_coupleWatchEngine.reset());
  coupleWatchTick();
}
