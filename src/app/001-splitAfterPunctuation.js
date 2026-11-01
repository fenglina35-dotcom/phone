//@@ web
if(window.__NORTH_SHELL_BUILD__!=='1874'){
//@@ private
if(window.__NORTH_SHELL_BUILD__!=='1878'){
//@@ end
  if(typeof window.__northBootFail==='function')window.__northBootFail('页面与脚本版本不一致，请修复页面缓存');
  throw new Error('North shell version mismatch');
}
window.__northBootStarted=true;
if(typeof window!=='undefined'&&typeof window.__northBootProgress==='function')window.__northBootProgress('正在读取本机存档和主题，请稍候…');
//@@ web
if(!Array.prototype.flatMap)Object.defineProperty(Array.prototype,'flatMap',{configurable:true,writable:true,value:function(fn,thisArg){return this.reduce((out,item,index,arr)=>out.concat(fn.call(thisArg,item,index,arr)),[]);}});
function splitAfterPunctuation(value,marks){const out=[];let line='';for(const ch of Array.from(String(value||''))){line+=ch;if(String(marks||'').indexOf(ch)>=0){out.push(line);line='';}}if(line)out.push(line);return out;}
if(!String.prototype.matchAll)Object.defineProperty(String.prototype,'matchAll',{configurable:true,writable:true,value:function(re){const flags=String(re&&re.flags||'').indexOf('g')>=0?re.flags:String(re&&re.flags||'')+'g',scan=new RegExp(re.source,flags),out=[];let m;while((m=scan.exec(String(this)))){out.push(m);if(!m[0])scan.lastIndex++;}return out;}});
//@@ end
/* =================== 存储 =================== */
const KEY='yibei_phone_v2';
const NORTH_PREVIEW_PARAMS=(()=>{try{return new URLSearchParams(location.search).get('northPreview')||'';}catch(_){return'';}})();
const NORTH_PREVIEW=!!NORTH_PREVIEW_PARAMS;
const NORTH_VIEWPORT_DIAG=(()=>{try{return new URLSearchParams(location.search).get('northViewportDiag')==='1';}catch(_){return false;}})();
const NORTH_ANDROID=(()=>{try{return /Android/i.test(String(navigator.userAgent||''));}catch(_){return false;}})();
const NORTH_IOS_WEBKIT=(()=>{try{return /iP(?:hone|ad|od)/i.test(String(navigator.userAgent||''))||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;}catch(_){return false;}})();
try{document.documentElement.classList.toggle('north-android',NORTH_ANDROID);document.documentElement.classList.toggle('north-ios-webkit',NORTH_IOS_WEBKIT);}catch(_){}
/* ☁️ 云同步（Supabase）：云地址+key 在「设置→云同步」里各自填(不写死在公开代码里)，
   你和每个网友各填各的 Supabase，数据各进各的云、互不相干 */
function cloudUrl(){return (((S.settings&&S.settings.cloudUrl)||'').trim()).replace(/\/+$/,'');}
function cloudKey(){return ((S.settings&&S.settings.cloudKey)||'').trim();}
/* ================= 邀请码门禁 =================
   true 改成 false 就是【完全关掉门禁】(谁打开都不用输)。
   不在前端写死通用口令；主邀请码在云端 invites 表里维护。
   ============================================== */
const SHARE_GATE=true, SHARE_PW='';
/* 🎟️ 邀请码验证（menkou 项目·只放邀请码、不含隐私）。谁输码进来 → 云端核销、用过即废；
   你自己用云端"主码"(可反复用)进，代码里不留后门。 */
const GATE_URL='https://lkhlyfpssmrjkkzhuzag.supabase.co';
const GATE_KEY='sb_publishable_uKytf2Tc_FmLv15SkkJyCQ_VU8IRSt2';
const LICENSE_FAILOVER_URL='https://lovbzibismsjqvjujilz.supabase.co';
const LICENSE_FAILOVER_KEY='sb_publishable_HxLFoFQXKcG2wVhVRYM1fQ_MQCkbYop';
const EXTERNAL_TTS_RELAY_URL='https://license.smallphoneapp.com/functions/v1/external-tts';
/* 独立云：只承载手机号、真实 iPhone 伴生同步和后台通知，不混入授权、AI 或好友数据。 */
const COMPANION_URL='https://qvuahlqimcfgeoetosnl.supabase.co';
const COMPANION_KEY='sb_publishable_Q2j6uyn2_cFA3RdHHnG7sw_b7vqXaz0';
/* 数据结构版本；普通网页更新不得用它让现有授权退出。 */
const SHARE_EPOCH=4;
function normalizeInviteCode(code){return String(code||'').trim().replace(/\s+/g,'').toUpperCase();}
/* 小手机好友：公开ID + 本机密钥。ID可以给别人搜，密钥只存在本机，用来防冒充。 */
function pfRand(n){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';try{const b=new Uint8Array(n);crypto.getRandomValues(b);for(let i=0;i<n;i++)s+=a[b[i]%a.length];return s;}catch(_){for(let i=0;i<n;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}}
function pfMsgList(store,key){const a=store&&store[key];return Array.isArray(a)?a:[];}
function pfEnsureMsgList(store,key){if(!store||typeof store!=='object')return [];if(!Array.isArray(store[key]))store[key]=[];return store[key];}
const _pfCleanedMsgStores=typeof WeakSet!=='undefined'?new WeakSet():null;
function pfCleanMsgBuckets(store){if(!store||typeof store!=='object')return false;if(_pfCleanedMsgStores&&_pfCleanedMsgStores.has(store))return false;let dirty=false;Object.keys(store).forEach(k=>{if(k==='__idb'||k==='id')return;const a=store[k];if(!Array.isArray(a)){delete store[k];dirty=true;return;}const b=a.filter(m=>m&&typeof m==='object');if(b.length!==a.length){store[k]=b;dirty=true;}});if(_pfCleanedMsgStores)_pfCleanedMsgStores.add(store);return dirty;}
function phoneFriendState(){S.me=S.me||{};const p=S.me.phoneFriend||(S.me.phoneFriend={});
  if(!p.id)p.id='SP'+pfRand(8);p.id=(''+p.id).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
  if(!/^SP[A-Z0-9]{8}$/.test(p.id))p.id='SP'+pfRand(8);
  if(!p.secret)p.secret='pfs_'+pfRand(32);
  if(p.allowSearch==null)p.allowSearch=true;
  if(!Array.isArray(p.friends))p.friends=[];
  if(!Array.isArray(p.requests))p.requests=[];
  if(!p.messages||typeof p.messages!=='object')p.messages={};
  if(p.messages&&p.messages.__idb&&p.messages.__idb!=='phoneFriendMessages'){p.messages={};p.lastSync=0;p._forceFullSync=1;p._repairNote='私聊缓存占位已修复，正在从云端补回';}
  if(pfCleanMsgBuckets(p.messages)){p.lastSync=0;p._forceFullSync=1;p._repairNote='私聊缓存格式已修复，正在从云端补回';}
  if(!Array.isArray(p.groups))p.groups=[];
  if(!p.groupMessages||typeof p.groupMessages!=='object')p.groupMessages={};
  if(p.groupMessages&&p.groupMessages.__idb&&p.groupMessages.__idb!=='phoneFriendGroupMessages'){p.groupMessages={};p.lastSync=0;p._forceFullSync=1;p._repairNote='群聊缓存占位已修复，正在从云端补回';}
  if(pfCleanMsgBuckets(p.groupMessages)){p.lastSync=0;p._forceFullSync=1;p._repairNote='聊天缓存格式已修复，正在从云端补回';}
  if(!p.remarks||typeof p.remarks!=='object')p.remarks={};
  if(!p.groupRemarks||typeof p.groupRemarks!=='object')p.groupRemarks={};
  if(!p.friendRead||typeof p.friendRead!=='object')p.friendRead={};
  if(!p.groupRead||typeof p.groupRead!=='object')p.groupRead={};
  if(!p.groupBubbleStyles||typeof p.groupBubbleStyles!=='object')p.groupBubbleStyles={};
  if(!p.clearBefore||typeof p.clearBefore!=='object')p.clearBefore={};
  if(!p.groupClearBefore||typeof p.groupClearBefore!=='object')p.groupClearBefore={};
  return p;}
function phoneFriendId(){return phoneFriendState().id;}
function phoneFriendById(id){id=(''+id).toUpperCase();return (phoneFriendState().friends||[]).find(f=>(''+(f.phone_id||f.id||'')).toUpperCase()===id)||null;}
function phoneFriendName(f){return (f&&(f.display_name||f.name))||'小手机好友';}
function pfFriendDisplayName(f){const p=phoneFriendState(),id=(''+((f&&f.phone_id)||(f&&f.id)||'')).toUpperCase();return (id&&p.remarks&&p.remarks[id])||phoneFriendName(f);}
function pfGroupDisplayName(g){const p=phoneFriendState(),gid=g&&(g.group_id||g.id);return (gid&&p.groupRemarks&&p.groupRemarks[gid])||(g&&g.name)||'小手机群聊';}
const PHONE_FRIEND_AVATAR_MAX=60000;
const PHONE_FRIEND_BODY_MAX=60000;
function phoneFriendAvatar(f){return storedImageDisplaySource((f&&(f.avatar||f.icon))||'🙂');}
function pfIsOnline(f){const ts=f&&f.updated_at?new Date(f.updated_at).getTime():0;return !!(ts&&Date.now()-ts<150000);}
function pfAvatarHTML(f,extra){let v=phoneFriendAvatar(f);v=(''+(v||'')).trim();
  if(isStoredImgRef(v))return av(v,extra);
  if(/^https?:\/\//i.test(v))return av(v,extra);
  if(v.indexOf('data:image')===0&&v.length>2400)return av(v,extra);
  if(v&&Array.from(v).length<=3)return av(v,extra);
  const nm=pfFriendDisplayName(f),ch=Array.from(nm||'?')[0]||'?';
  return `<div class="avatar ${extra||''}" style="background:linear-gradient(135deg,#9ec5fe,#c9b7ff);color:#fff;font-weight:800">${esc(ch)}</div>`;}
function pfAvatarOnlineHTML(f,extra){return `<span class="pfavwrap">${pfAvatarHTML(f,extra)}${pfIsOnline(f)?'<i class="pfonline"></i>':''}</span>`;}

/* v1422: protocol decisions never become dialogue/notifications. Keep actual user dialogue. */
function roleInternalControlLine(value){return /^(?:[\[【]\s*(?:保持安静|不说话|沉默|不回)\s*[\]】]|已在本轮完成[，,、；;。\s]*不再重复[。.!！]?|本轮已完成[，,、；;。\s]*不再重复[。.!！]?)$/.test(String(value||'').trim());}
function rolePublicText(value){return String(value==null?'':value).split(/\r?\n/).filter(line=>!roleInternalControlLine(line)).join('\n').trim();}
function wxUnreadBadge(n,dot){n=Math.max(0,+n||0);return dot?'<span class="wx-unread-dot" aria-label="有新朋友圈"></span>':n?'<span class="wx-unread-badge" aria-label="'+n+'条未读消息">'+(n>99?'99+':n)+'</span>':'';}
function wxUnreadAvatar(html,n){return '<span class="wx-unread-avatar">'+html+wxUnreadBadge(n)+'</span>';}
/* v1424: read decisions survive an already archived chat and immediate app closure. */
function wxUnreadState(){const v=S.me&&S.me._wxUnreadV2;return v&&v.ver===2&&v.read&&typeof v.read==='object'&&Number.isFinite(v.since)?v:null;}
function wxReadKey(kind,id){return kind==='r'?'r:'+accountMessageKey(id,actId()):'g:'+actId()+':'+id;}
function wxMessageSeen(m,key){const v=wxUnreadState();return !!(m.seenAt||v&&((+m.time||0)<v.since||v.read[key]&&v.read[key][m.id]));}
function wxUnreadJournalWrite(){try{const v=wxUnreadState();if(!v)return true;const p=S.me.phoneFriend||{};localStorage.setItem(KEY+'_wx_read_v2',JSON.stringify({ver:2,state:v,moments:S.me._wxMomentSeen||{},phoneId:p.id||'',friendRead:p.friendRead||{},groupRead:p.groupRead||{}}));return true;}catch(_){return false;}}
function wxUnreadRestore(){
  let changed=false,v=wxUnreadState(),j=null;try{j=JSON.parse(localStorage.getItem(KEY+'_wx_read_v2')||'null');}catch(_){}
  if(j&&j.ver===2&&j.state&&j.state.ver===2&&j.state.read&&Number.isFinite(j.state.since)){
    if(!v){S.me._wxUnreadV2=v=j.state;changed=true;}else if(v.since===j.state.since){Object.entries(j.state.read).forEach(([key,rows])=>{const dst=v.read[key]||(v.read[key]={});Object.entries(rows||{}).forEach(([id,at])=>{if(+at>(+dst[id]||0)){dst[id]=+at;changed=true;}});});}
    if(v.since===j.state.since){const root=S.me._wxMomentSeen||(S.me._wxMomentSeen={});Object.entries(j.moments||{}).forEach(([aid,rows])=>{const dst=root[aid]||(root[aid]={});Object.entries(rows||{}).forEach(([id,at])=>{if(+at>(+dst[id]||0)){dst[id]=+at;changed=true;}});});const p=S.me.phoneFriend;if(p&&p.id===j.phoneId){['friendRead','groupRead'].forEach(key=>{const dst=p[key]||(p[key]={});Object.entries(j[key]||{}).forEach(([id,at])=>{if(+at>(+dst[id]||0)){dst[id]=+at;changed=true;}});});}}
  }
  if(!v){
    /* First migration runs only after archive hydration: existing history is the read baseline. */
    S.me._wxUnreadV2=v={ver:2,since:Date.now(),read:{}};changed=true;
    Object.entries(S.messages||{}).forEach(([key,rows])=>{if(!Array.isArray(rows))return;rows.forEach(m=>{if(m&&m.id&&m.role==='assistant'&&(+m.time||0)>=v.since){const dst=v.read['r:'+key]||(v.read['r:'+key]={});dst[m.id]=m.seenAt||v.since;}});});
    (S.groups||[]).forEach(g=>(g.msgs||[]).forEach(m=>{if(m&&m.id&&m.senderId!=='me'&&(+m.time||0)>=v.since){const key='g:main:'+g.id,dst=v.read[key]||(v.read[key]={});dst[m.id]=m.seenAt||v.since;}}));
    const root=S.me._wxMomentSeen||(S.me._wxMomentSeen={});(S.moments||[]).forEach(m=>{if(!m||!m.id||m.authorId==='me')return;const dst=root[m.acct||'main']||(root[m.acct||'main']={});if(!dst[m.id])dst[m.id]=v.since;});
    const p=S.me.phoneFriend;if(p){['friendRead','groupRead'].forEach((key,i)=>{const dst=p[key]||(p[key]={});Object.entries(p[i?'groupMessages':'messages']||{}).forEach(([id,rows])=>{if(Array.isArray(rows))dst[id]=rows.reduce((at,m)=>Math.max(at,+m.time||0),Math.max(+dst[id]||0,v.since));});});}
  }
  /* Replay read IDs into hydrated messages so read receipts and prompts agree with the badge. */
  Object.entries(S.messages||{}).forEach(([key,rows])=>{const read=v.read['r:'+key];if(read&&Array.isArray(rows))rows.forEach(m=>{if(m&&read[m.id]&&!m.seenAt){m.seenAt=read[m.id];changed=true;}});});
  (S.groups||[]).forEach(g=>{const read=v.read['g:main:'+g.id];if(read)(g.msgs||[]).forEach(m=>{if(m&&read[m.id]&&!m.seenAt){m.seenAt=read[m.id];changed=true;}});});
  if(changed){delete _heavyStamp.messages;wxUnreadJournalWrite();}return changed;
}
function wxRoleUnread(id){return msgs(id).filter(m=>roleReadCounted(m)&&m.role==='assistant'&&!wxMessageSeen(m,wxReadKey('r',id))&&!m.recalled&&!roleInternalControlLine(m.content)).length;}
function wxGroupUnread(g){return (g.msgs||[]).filter(m=>m&&m.senderId!=='me'&&m.type!=='sys'&&!m._silent&&!wxMessageSeen(m,wxReadKey('g',g.id))&&!m.recalled&&!roleInternalControlLine(m.content)).length;}
function wxPfUnread(list,from,readAt,group){return (list||[]).filter(m=>m&&!m.recalled&&!pfIsHiddenTransport(m)&&!pfIsRpGrabTransport(m)&&!m._silent&&(group?m.from!==from:m.from===from)&&(+m.time||0)>(+readAt||0)).length;}
function wxUnreadTotal(){let n=(S.contacts||[]).filter(c=>!c.deleted&&(isMain()||addedHere(c)||msgs(c.id).length)).reduce((sum,c)=>sum+wxRoleUnread(c.id),0);if(!isMain())return n;n+=(S.groups||[]).reduce((sum,g)=>sum+wxGroupUnread(g),0);const p=phoneFriendState();(p.friends||[]).forEach(f=>{const id=String(f.phone_id||f.id).toUpperCase();n+=wxPfUnread(pfVisibleMsgList(p.messages,id),id,p.friendRead[id],false);});(p.groups||[]).forEach(g=>{const id=g.group_id||g.id;n+=wxPfUnread(pfMsgList(p.groupMessages,id),p.id,p.groupRead[id],true);});return n;}
function wxMomentSeenMap(){const root=S.me._wxMomentSeen||(S.me._wxMomentSeen={});return root[actId()]||(root[actId()]={});}
function wxMomentUnread(){const seen=wxMomentSeenMap();return (S.moments||[]).some(m=>m&&m.authorId&&m.authorId!=='me'&&((m.acct||'main')===actId())&&!seen[m.id]);}
function wxMarkPageSeen(page){
  if(!page||document.hidden||S.me.locked)return;let changed=false,archiveChanged=false,now=Date.now(),list=[],key='';const v=wxUnreadState();
  if(page.p==='chat'){key=wxReadKey('r',page.id);list=msgs(page.id).filter(m=>roleReadCounted(m)&&m.role==='assistant');}
  else if(page.p==='group'&&isMain()){key=wxReadKey('g',page.id);const g=(S.groups||[]).find(x=>x.id===page.id);list=g?(g.msgs||[]).filter(m=>m&&m.senderId!=='me'&&m.type!=='sys'&&!m._silent):[];}
  list.forEach(m=>{if(!m.seenAt){m.seenAt=now;delete m._seenPending;changed=archiveChanged=true;}if(v&&m.id&&(+m.time||0)>=v.since){const read=v.read[key]||(v.read[key]={});if(!read[m.id]){read[m.id]=m.seenAt;changed=true;}}});
  if(page.p==='wxmoment'||page.p==='roleMoments'||page.p==='roleMomentDetail'){const seen=wxMomentSeenMap();(S.moments||[]).filter(m=>m&&m.authorId&&m.authorId!=='me'&&((m.acct||'main')===actId())&&(page.p==='wxmoment'||m.authorId===page.id)).forEach(m=>{if(!seen[m.id]){seen[m.id]=now;changed=true;}});}
  if(archiveChanged&&page.p==='chat')delete _heavyStamp.messages;
  if(changed){const durable=wxUnreadJournalWrite();save(durable?500:0);}
}
/* Resolve only an explicit recipient, never infer ownership from generic blessings. */
function gRpRecipient(g,m){if(!g||!m)return '';if(m.to)return String(m.to);const note=String(m.note||'').trim();if(!note)return '';const names=[{id:'me',names:[S.me&&S.me.name]},...(g.members||[]).map(id=>{const c=getC(id);return{id,names:c?[gnm(g,id),c.name,c.remark]:[]};})],hits=[];names.forEach(x=>{if(x.names.filter(Boolean).some(n=>note==='给'+n+'的专属红包'||note===n+'的专属红包'||note==='仅限'+n+'领取'||note==='只给'+n))hits.push(x.id);});if(hits.length===1){m.to=hits[0];return m.to;}return hits.length||/专属|仅限|只给/.test(note)?'__ambiguous__':'';}
function groupTransferFind(gid,mid){const g=(S.groups||[]).find(x=>x.id===gid),m=g&&(g.msgs||[]).find(x=>x.id===mid&&x.type==='transfer');return m?{g,m}:null;}
function openGroupTransferDetail(gid,mid){if(groupTransferFind(gid,mid))go('groupTransferDetail',{id:gid,mid});}
function groupTransferDetailAction(gid,mid){const hit=groupTransferFind(gid,mid);if(!hit||hit.m.senderId==='me'||hit.m.received||(hit.m.to&&hit.m.to!=='me'))return;gGrab(gid,mid,true);}
function renderGroupTransferDetail(gid,mid){const hit=groupTransferFind(gid,mid),m=hit&&hit.m,nav='<div class="nav wx-transfer-detail-nav"><span class="l" onclick="back()">‹</span><span class="t"></span><span class="r"></span></div>';if(!m)return nav+'<main class="wx-transfer-detail">这笔转账记录不存在</main>';const mine=m.senderId==='me',forMe=!mine&&(!m.to||m.to==='me'),state=m.received?'received':'pending',title=m.received?(forMe?'你已收款':'对方已收款'):(forMe?'待你收款':'待对方收款'),to=m.to?gnm(hit.g,m.to):S.me.name;return nav+'<main class="wx-transfer-detail state-'+state+'"><section class="wx-transfer-detail-hero"><div class="wx-transfer-detail-icon">'+transferDetailGlyph(state)+'</div><p>'+esc(title)+'</p><h1>¥'+(+m.amount||0).toFixed(2)+'</h1></section><dl class="wx-transfer-detail-meta"><div><dt>收款方</dt><dd>'+esc(to)+'</dd></div><div><dt>转账说明</dt><dd>'+esc(m.note||'转账')+'</dd></div><div><dt>转账时间</dt><dd>'+transferDateTime(m.time)+'</dd></div>'+(m.received?'<div><dt>收款时间</dt><dd>'+transferDateTime(m.receivedAt)+'</dd></div>':'')+'</dl>'+(forMe&&!m.received?'<div class="wx-transfer-actions"><button type="button" onclick="groupTransferDetailAction(\''+gid+'\',\''+mid+'\')">收款</button></div>':'')+'</main>';}

function pfUnreadDot(n){return n?'<span title="有新消息" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff4b64;vertical-align:middle"></span>':'';}
function pfPack(o){try{return '[PF|'+btoa(unescape(encodeURIComponent(JSON.stringify(o||{}))))+']';}catch(_){return '';}}
function pfUnpack(t){t=(''+(t||'')).trim();let m=t.match(/^\[PF\|([A-Za-z0-9+/=]+)\]$/);if(m){try{return JSON.parse(decodeURIComponent(escape(atob(m[1]))));}catch(_){}}
  m=t.match(/^[\[【]\s*(转账|红包)\s*[\|｜]\s*([0-9.]+)\s*[\|｜]?\s*([^\]】]*)[\]】]$/);if(m)return {type:m[1]==='红包'?'redpacket':'transfer',amount:+m[2]||0,note:(m[3]||'').trim()};
  return null;}
//@@ web
function pfMsgPayload(m){return pfUnpack(m&&(m.text||m.body||m.content));}
//@@ private
const _pfPayloadCache=typeof WeakMap==='function'?new WeakMap():null;
function pfMsgPayload(m){const raw=m&&(m.text||m.body||m.content),cache=_pfPayloadCache;if(cache&&m&&typeof m==='object'){const hit=cache.get(m);if(hit&&hit.raw===raw)return hit.value;const value=pfUnpack(raw);cache.set(m,{raw,value});return value;}return pfUnpack(raw);}
//@@ end
function pfIsRoomTransport(m){const p=pfMsgPayload(m);return !!(p&&String(p.type||'').indexOf('game_room_')===0&&p.type!=='game_room_invite');}
function pfIsHiddenTransport(m){const p=pfMsgPayload(m);return !!(p&&(p.type==='style_update'||p.type==='transfer_refund'));}
/* 扫群二维码的进群申请是给对方小手机看的暗号，不存、不显示、不提醒。 */
function pfIsGroupQrTransport(m){const p=pfMsgPayload(m);return !!(p&&p.type==='group_join_request');}
/* 真人群的管理员名单、禁言、管理员踢人申请：只在各自的小手机里生效，不当消息显示。 */
function pfIsGroupManageTransport(m){const p=pfMsgPayload(m);return !!(p&&(p.type==='group_admins'||p.type==='group_mute'||p.type==='group_kick_request'));}
/* ===== 真人好友的转账，走角色转账那一整套 =====
   她说「小手机转账的那一套系统也要套用角色转账的那套卡片一模一样的流程」。
   气泡换成 .wx-transfer-card，点开是同一个转账详情页，里面同样是【收款】和【退还】。
   pf 的消息体本身是 [PF|…] 字符串，这里把它翻成角色转账那种形状给
   payCard / transferState / renderTransferDetail 用，状态再写回 pf 消息本身。
   收款照旧走云端那条 phone_friend_mark_received；退还云端没有对应的回执表，
   所以改成真的给对方发一条隐藏的「退还」消息，对方的客户端收到就把自己那张卡标成
   已退还、钱也退回去——两边看到的状态一致，又不用改数据库。 */
const PF_CID_PREFIX='pf:';
function pfMineId(){return String(phoneFriendState().id||'').toUpperCase();}
function pfMsgIsMine(m){return String(m&&m.from||'').toUpperCase()===pfMineId();}
function pfMsgFriendId(m){return String((pfMsgIsMine(m)?(m&&m.to):(m&&m.from))||'').toUpperCase();}
function pfTransferView(m){if(!m)return null;const p=pfMsgPayload(m);if(!p||p.type!=='transfer')return null;
  const me=pfMsgIsMine(m);
  return {id:m.id,type:'transfer',role:me?'user':'assistant',amount:+p.amount||0,note:p.note||'',_transferReceipt:!!m._transferReceipt,receiptOf:m.receiptOf||'',
    time:m.time,transferAt:+m.transferAt||+m.time||0,
    received:!!m.received,declined:!!m.declined,refunded:!!m.refunded,
    payState:m.payState||(m.received?'received':(m.refunded?'refunded':'pending')),
    receivedAt:+m.receivedAt||0,refundedAt:+m.refundedAt||0};}
function pfTransferReceiptMessage(m){const pl=pfMsgPayload(m);if(!m||m.recalled||!m.to||!pl||pl.type!=='transfer'||!m.received)return null;return Object.assign({},m,{id:'pf-receipt:'+m.id,from:m.to,to:m.from,time:+m.receivedAt||+m.time||0,transferAt:+m.transferAt||+m.time||0,_transferReceipt:true,receiptOf:m.id,payState:'received'});}
function pfTransferFind(fid,mid){const p=phoneFriendState();
  const scan=id=>{const receipt=String(mid||'').startsWith('pf-receipt:'),key=receipt?String(mid).slice(11):mid,original=pfMsgList(p.messages,id).find(x=>x&&x.id===key),m=receipt?pfTransferReceiptMessage(original):original;return m?{fid:String(id).toUpperCase(),m}:null;};
  if(fid){const hit=scan(fid);if(hit)return hit;}
  let out=null;Object.keys(p.messages||{}).some(id=>{const hit=scan(id);if(hit){out=hit;return true;}return false;});
  return out;}
/* 对方点了退还：把我自己发出去的那一笔标成已退还，钱也退回我的零钱 */
function pfHandleTransferRefund(m){const pl=pfMsgPayload(m);
  if(!pl||pl.type!=='transfer_refund'||!pl.of)return false;
  const hit=pfTransferFind('',pl.of);if(!hit)return false;
  const t=hit.m;if(!pfMsgIsMine(t)||t.refunded||t.received)return false;
  t.declined=true;t.refunded=true;t.payState='refunded';t.refundedAt=+m.time||Date.now();
  if(!t._refundSettled){t._refundSettled=true;
    const pay=pfMsgPayload(t),amt=+(pay&&pay.amount)||+pl.amount||0,f=phoneFriendById(hit.fid);
    if(amt)addBill('in',amt,(f?pfFriendDisplayName(f):hit.fid)+' 退还了转账');}
  return true;}
function pfTransferDetailAction(fid,mid,action){const hit=pfTransferFind(fid,mid);if(!hit)return;
  const p=phoneFriendState(),m=hit.m,pay=pfMsgPayload(m);
  if(!pay||pay.type!=='transfer'||m._transferReceipt||pfMsgIsMine(m)||m.received||m.refunded)return;
  const now=Date.now(),amt=+pay.amount||0,f=phoneFriendById(hit.fid),name=f?pfFriendDisplayName(f):hit.fid;
  m.transferAt=+m.transferAt||+m.time||now;
  if(action==='receive'){m.received=true;m.receivedBy=p.id;m.payState='received';m.receivedAt=now;
    addBill('in',amt,'收到 '+name+' 的转账');save();
    if(!String(m.id||'').startsWith('local_'))pfRpc('phone_friend_mark_received',{p_phone_id:p.id,p_secret:p.secret,p_message_id:m.id},20000).then(()=>phoneFriendSync(true)).catch(e=>toast((e&&e.message)||'领取回执同步失败'));
    toast('已收款 +¥'+amt.toFixed(2));}
  else{m.declined=true;m.refunded=true;m.payState='refunded';m.refundedAt=now;save();
    sendPhoneFriendBody(hit.fid,pfPack({type:'transfer_refund',of:m.id,amount:amt}));
    toast('已退还给'+name);}
  transferDetailBack();}
function pfVisibleMsgList(store,key){return pfMsgList(store,key).filter(m=>!pfIsRoomTransport(m)&&!pfIsHiddenTransport(m)&&!pfIsGroupQrTransport(m));}
function pfMsgPreview(m){const p=pfMsgPayload(m);if(p&&p.type==='shopshare')return '[店铺分享] '+String(p.shopShare&&p.shopShare.name||'店铺');if(!p)return (m&&m.text)||'';if(p.type==='text')return p.text||'';if(p.type==='sticker')return '[表情]'+(p.meaning?(' '+p.meaning):'');if(p.type==='image')return '[图片]'+(p.desc?(' '+p.desc):'');if(p.type==='pat')return '[拍一拍]';if(p.type==='group_invite')return '[群聊邀请] '+(p.groupName||'小手机群聊');if(p.type==='game_room_invite')return '[游戏房间] '+(p.title||'邀请你一起玩');if(p.type==='game_room_ready')return '[已准备]';if(p.type==='game_room_start')return '[游戏开始]';if(p.type==='game_room_chat')return '[房间消息] '+(p.text||'');if(p.type==='transfer')return '[转账] ¥'+(+p.amount||0).toFixed(2);if(p.type==='redpacket')return '[红包] ¥'+(+p.amount||0).toFixed(2);return '[消息]';}
function pfPayloadIsPay(m){const p=pfMsgPayload(m);return !!(p&&(p.type==='transfer'||p.type==='redpacket'));}
function pfMentionsMe(m){let t=''+((m&&m.body)||(m&&m.text)||'');const pl=pfMsgPayload(m);if(pl&&pl.type==='text')t=pl.text||'';const nm=(S.me&&S.me.name)||'我';return !!(t&&nm&&t.indexOf('@'+nm)>=0);}
function pfSafeBody(body){body=''+(body||'');return body.length>PHONE_FRIEND_BODY_MAX?body.slice(0,PHONE_FRIEND_BODY_MAX):body;}
function pfTypingActive(){try{const a=document.activeElement,p1=$('#pfpanel'),p2=$('#pfgpanel');return !!((a&&(a.id==='pf_input'||a.id==='pfg_input'||a.id==='pf_search'))||(p1&&p1.classList.contains('show'))||(p2&&p2.classList.contains('show')));}catch(_){return false;}}
function pfNotifyFriend(m,opt){opt=opt||{};if(pfIsRoomTransport(m))return;const p=phoneFriendState(),from=(''+(m.from_id||m.from||'')).toUpperCase();if(!from||from===p.id)return;
  const f=phoneFriendById(from)||{phone_id:from,display_name:from,avatar:'🙂'},msg={text:(''+(m.body||m.text||'')),time:m.created_at?new Date(m.created_at).getTime():Date.now()};
  const viewing=cur().p==='pfchat'&&cur().id===from;if(viewing){pfMarkRead(from);return;}
  if(!opt.silent&&S.settings.sound&&typeof playMessageDing==='function')playMessageDing();
  lockNotify(pfFriendDisplayName(f),pfMsgPreview(msg),{avatar:phoneFriendAvatar(f),target:{type:'pfchat',id:from}});
  const b=$('#msgBanner');if(b&&!_call&&!lockVisible()){b.innerHTML=`${pfAvatarHTML(f,'sm')}<div style="flex:1;min-width:0"><div class="bn">${esc(pfFriendDisplayName(f))}</div><div class="bm">${esc(pfMsgPreview(msg))}</div></div>`;b.className='msgbanner show';b.onclick=()=>{b.className='msgbanner';openPhoneFriendChat(from);};clearTimeout(_bannerT);_bannerT=setTimeout(()=>{b.className='msgbanner';},4500);}
  appNotify(pfFriendDisplayName(f),pfMsgPreview(msg),{tag:'pf-'+from,data:{type:'open',target:'pfchat',id:from}});}
function pfNotifyGroup(m,opt){opt=opt||{};if(pfIsHiddenTransport({text:m.body||m.text||''}))return;const p=phoneFriendState(),gid=m.group_id||m.gid,from=(''+(m.from_id||m.from||'')).toUpperCase();if(!gid||!from||from===p.id)return;
  const g=pfGroupById(gid)||{group_id:gid,name:'小手机群聊'},msg={text:(''+(m.body||m.text||'')),time:m.created_at?new Date(m.created_at).getTime():Date.now()};
  const title=pfGroupDisplayName(g),line=(pfMentionsMe(msg)?'[有人@你] ':'')+(pfNameById(from)||'成员')+'：'+pfMsgPreview(msg);
  const viewing=cur().p==='pfgroup'&&cur().gid===gid;if(viewing){pfMarkGroupRead(gid);return;}
  /* 消息免打扰：像真微信一样不响不弹，只有@我时仍提醒。 */
  if(((p.groupPrefs||{})[gid]||{}).muted&&!pfMentionsMe(msg))return;
  if(!opt.silent&&S.settings.sound&&typeof playMessageDing==='function')playMessageDing();
  lockNotify(title,line,{icon:'users',target:{type:'pfgroup',id:gid}});
  const b=$('#msgBanner');if(b&&!_call&&!lockVisible()){b.innerHTML=`${wxClassicGroupAvatarHTML('sm')}<div style="flex:1;min-width:0"><div class="bn">${esc(title)}</div><div class="bm">${esc(line)}</div></div>`;b.className='msgbanner show';b.onclick=()=>{b.className='msgbanner';openPhoneFriendGroup(gid);};clearTimeout(_bannerT);_bannerT=setTimeout(()=>{b.className='msgbanner';},4500);}
  appNotify(title,line,{tag:'pfg-'+gid,data:{type:'open',target:'pfgroup',id:gid}});}
function pfReadIds(m){let a=m&&m.readBy;if(!Array.isArray(a))a=m&&m.receivedBy?[m.receivedBy]:[];return a.map(x=>(''+x).toUpperCase()).filter(Boolean);}
function pfSetReadBy(m,rid){rid=(''+rid).toUpperCase();if(!rid)return;m.readBy=pfReadIds(m);if(m.readBy.indexOf(rid)<0)m.readBy.push(rid);m.readAt=m.readAt||Date.now();}
//@@ web
function pfAckRead(mid){const p=phoneFriendState();if(!mid||String(mid).startsWith('local_')||!readReceiptOn())return;pfRpc('phone_friend_mark_received',{p_phone_id:p.id,p_secret:p.secret,p_message_id:mid},16000).catch(()=>{});}
//@@ private
let _pfReadAckTimer=0,_pfReadAckBusy=false,_pfReadAckQueue=[],_pfReadAckQueued=new Set();
function pfReadAckSchedule(delay){if(_pfReadAckBusy||_pfReadAckTimer||!_pfReadAckQueue.length)return;_pfReadAckTimer=setTimeout(()=>{_pfReadAckTimer=0;pfReadAckDrain();},Math.max(0,+delay||0));}
async function pfReadAckDrain(){if(_pfReadAckBusy||!_pfReadAckQueue.length)return;if((typeof document!=='undefined'&&document.hidden)||(typeof northNativeMaintenancePaused==='function'&&northNativeMaintenancePaused())){pfReadAckSchedule(2500);return;}_pfReadAckBusy=true;try{while(_pfReadAckQueue.length){if((typeof document!=='undefined'&&document.hidden)||(typeof northNativeMaintenancePaused==='function'&&northNativeMaintenancePaused()))break;const job=_pfReadAckQueue.shift();try{await pfRpc('phone_friend_mark_received',{p_phone_id:job.phoneId,p_secret:job.secret,p_message_id:job.mid},16000);}catch(_){}finally{_pfReadAckQueued.delete(job.mid);}await new Promise(resolve=>setTimeout(resolve,0));}}finally{_pfReadAckBusy=false;if(_pfReadAckQueue.length)pfReadAckSchedule(2500);}}
function pfAckRead(mid){const p=phoneFriendState();mid=String(mid||'');if(!readReceiptOn())return false;if(!mid||mid.startsWith('local_')||_pfReadAckQueued.has(mid))return false;_pfReadAckQueued.add(mid);_pfReadAckQueue.push({mid,phoneId:p.id,secret:p.secret});pfReadAckSchedule(0);return true;}
//@@ end
function pfInferFriendRead(other,rid,ts){const p=phoneFriendState(),arr=pfMsgList(p.messages,other);rid=(''+rid).toUpperCase();if(!rid||rid===p.id)return false;let ch=false;arr.forEach(m=>{if(m.from===p.id&&!m.recalled&&!pfPayloadIsPay(m)&&(m.time||0)<=ts&&pfReadIds(m).indexOf(rid)<0){pfSetReadBy(m,rid);ch=true;}});return ch;}
function pfInferGroupRead(gid,rid,ts){const p=phoneFriendState(),arr=pfMsgList(p.groupMessages,gid);rid=(''+rid).toUpperCase();if(!rid||rid===p.id)return false;let ch=false;arr.forEach(m=>{if(m.from!==rid&&!m.recalled&&!pfPayloadIsPay(m)&&(m.time||0)<=ts&&pfReadIds(m).indexOf(rid)<0){pfSetReadBy(m,rid);ch=true;}});return ch;}
//@@ web
function pfReconcileReadInference(){const p=phoneFriendState();let ch=false;Object.keys(p.messages||{}).forEach(id=>{let latest=0;pfMsgList(p.messages,id).forEach(m=>{if(m.from===id)latest=Math.max(latest,m.time||0);});if(latest)ch=pfInferFriendRead(id,id,latest)||ch;});Object.keys(p.groupMessages||{}).forEach(gid=>{const latestBySender=new Map();pfMsgList(p.groupMessages,gid).forEach(m=>{if(m.from&&m.from!==p.id)latestBySender.set(m.from,Math.max(latestBySender.get(m.from)||0,m.time||0));});latestBySender.forEach((ts,id)=>{ch=pfInferGroupRead(gid,id,ts)||ch;});});return ch;}
function pfMarkRead(id){const p=phoneFriendState();id=(''+id).toUpperCase();p.friendRead[id]=Date.now();pfMsgList(p.messages,id).forEach(m=>{if(m.from===id&&!m.recalled&&!pfPayloadIsPay(m)&&pfReadIds(m).indexOf(p.id)<0){pfSetReadBy(m,p.id);pfAckRead(m.id);}});lockClearTarget({type:'pfchat',id},true);const durable=wxUnreadJournalWrite();save(durable?undefined:0);setTimeout(()=>pfReadInPlace(id),0);}
function pfMarkGroupRead(gid){const p=phoneFriendState();if(gid){p.groupRead[gid]=Date.now();pfMsgList(p.groupMessages,gid).forEach(m=>{if(m.from!==p.id&&!m.recalled&&!pfPayloadIsPay(m)&&pfReadIds(m).indexOf(p.id)<0){pfSetReadBy(m,p.id);pfAckRead(m.id);}});lockClearTarget({type:'pfgroup',id:gid},true);const durable=wxUnreadJournalWrite();save(durable?undefined:0);}}
//@@ private
async function pfReconcileReadInference(friendKeys,groupKeys,friendEvidence,groupEvidence){const p=phoneFriendState(),me=(''+p.id).toUpperCase(),readAt=Date.now(),friendIds=friendKeys==null?Object.keys(p.messages||{}):Array.from(friendKeys),groupIds=groupKeys==null?Object.keys(p.groupMessages||{}):Array.from(groupKeys);let ch=false,work=0;
  for(const id of friendIds){const rid=(''+id).toUpperCase();if(!rid||rid===me)continue;const arr=pfMsgList(p.messages,id);let latest=0;for(const m of arr){if((''+(m&&m.from||'')).toUpperCase()===rid)latest=Math.max(latest,m.time||0);const pause=pfSyncMaybeYield(++work);if(pause)await pause;}const evidence=friendEvidence&&friendEvidence.get(id);if(evidence)latest=Math.max(latest,evidence.get(rid)||0);if(!latest)continue;for(const m of arr){if(m&&(''+(m.from||'')).toUpperCase()===me&&!m.recalled&&(m.time||0)<=latest){const payload=pfMsgPayload(m);if(!(payload&&(payload.type==='transfer'||payload.type==='redpacket'))){const read=new Set(pfReadIds(m));if(!read.has(rid)){read.add(rid);m.readBy=Array.from(read);m.readAt=m.readAt||readAt;ch=true;}}}const pause=pfSyncMaybeYield(++work);if(pause)await pause;}}
  for(const gid of groupIds){const arr=pfMsgList(p.groupMessages,gid),latestBySender=new Map();for(const m of arr){const sender=(''+(m&&m.from||'')).toUpperCase();if(sender&&sender!==me)latestBySender.set(sender,Math.max(latestBySender.get(sender)||0,m.time||0));const pause=pfSyncMaybeYield(++work);if(pause)await pause;}const evidence=groupEvidence&&groupEvidence.get(gid);if(evidence)evidence.forEach((ts,sender)=>latestBySender.set(sender,Math.max(latestBySender.get(sender)||0,ts||0)));if(!latestBySender.size)continue;const readers=Array.from(latestBySender.entries());for(const m of arr){if(m&&!m.recalled){const payload=pfMsgPayload(m);if(!(payload&&(payload.type==='transfer'||payload.type==='redpacket'))){const from=(''+(m.from||'')).toUpperCase(),time=m.time||0,read=new Set(pfReadIds(m));let added=false;for(const [rid,latest] of readers)if(rid!==from&&time<=latest&&!read.has(rid)){read.add(rid);added=true;}if(added){m.readBy=Array.from(read);m.readAt=m.readAt||readAt;ch=true;}}}const pause=pfSyncMaybeYield(++work);if(pause)await pause;}}
  return ch;}
const _pfMarkReadBusy=new Set();
async function pfMarkReadMessages(scope,id){const key=scope+':'+id;if(_pfMarkReadBusy.has(key))return;_pfMarkReadBusy.add(key);const p=phoneFriendState(),started=pfSyncClock(),group=scope==='group',arr=pfMsgList(group?p.groupMessages:p.messages,id),me=(''+p.id).toUpperCase();let changed=false,acked=0;try{for(let i=0;i<arr.length;i++){const m=arr[i],from=(''+(m&&m.from||'')).toUpperCase(),already=pfReadIds(m).indexOf(me)>=0;if(m&&!m.recalled&&!already&&(group?from!==me:from===id)&&!pfPayloadIsPay(m)){pfSetReadBy(m,me);changed=true;if(pfAckRead(m.id))acked++;}const pause=pfSyncMaybeYield(i+1);if(pause)await pause;}if(changed){save(800);if(!group)pfReadInPlace(id);}pfSyncTrace(group?'groupReadMark.end':'readMark.end',{scanned:arr.length,acked,ms:Math.max(0,Math.round(pfSyncClock()-started))});}finally{_pfMarkReadBusy.delete(key);}}
function pfMarkRead(id){const p=phoneFriendState();id=(''+id).toUpperCase();p.friendRead[id]=Date.now();lockClearTarget({type:'pfchat',id},true);const durable=wxUnreadJournalWrite();save(durable?undefined:0);setTimeout(()=>pfMarkReadMessages('friend',id),0);}
function pfMarkGroupRead(gid){const p=phoneFriendState();if(gid){p.groupRead[gid]=Date.now();lockClearTarget({type:'pfgroup',id:gid},true);const durable=wxUnreadJournalWrite();save(durable?undefined:0);setTimeout(()=>pfMarkReadMessages('group',gid),0);}}
//@@ end
function pfTagOutgoing(body,localId){const pl=pfUnpack(body)||{type:'text',text:body};pl._clientSendId=phoneFriendState().id+'_'+localId;return pfPack(pl)||body;}
function pfPendingMatches(local,server){const body=String(server.body||server.text||''),a=pfUnpack(local.text||''),b=pfUnpack(body),ta=a&&a._clientSendId,tb=b&&b._clientSendId;if(ta||tb)return !!ta&&ta===tb;return local.text===body&&Date.now()-(local.time||0)<120000;}
function pfSetSendState(scope,target,localId,state){const p=phoneFriendState(),arr=pfMsgList(scope==='group'?p.groupMessages:p.messages,target),m=arr.find(x=>x.id===localId);if(m)m.sendState=state;if(state!=='sending')try{save();}catch(_){}return m;}
async function pfRecoverSend(scope,target,body,p){const token=(pfUnpack(body)||{})._clientSendId;if(!token)return false;const list=()=>pfMsgList(scope==='group'?p.groupMessages:p.messages,target),confirmed=()=>list().some(x=>!String(x.id||'').startsWith('local_')&&(pfMsgPayload(x)||{})._clientSendId===token);if(confirmed())return true;try{const d=await pfRpc('phone_friend_sync',{p_phone_id:p.id,p_secret:p.secret,p_since_ms:Math.max(0,Date.now()-300000)},15000);if(phoneFriendState()!==p)return false;const rows=scope==='group'?d&&d.group_messages:d&&d.messages;const m=(Array.isArray(rows)?rows:[]).find(x=>String(x.from_id||x.from||'').toUpperCase()===p.id&&(scope==='group'?String(x.group_id||x.gid||'')===target:String(x.to_id||x.to||'').toUpperCase()===target)&&(pfMsgPayload(x)||{})._clientSendId===token);if(m){if(scope==='group')pfStoreGroupMessage(m);else pfStoreMessage(m);try{save();}catch(_){}return true;}return confirmed();}catch(_){return phoneFriendState()===p&&confirmed();}}
function pfTransportRecord(fn,stage,base,status,start,error,detail){try{const p=phoneFriendState(),rows=p.transportDiagnostics||(p.transportDiagnostics=[]);rows.push({at:Date.now(),fn:String(fn||'').replace(/[^a-z0-9_]/gi,'').slice(0,64),stage,route:base===GATE_URL?'direct':base===PF_RELAY_BASE?'relay':'none',status:+status||0,duration:Math.max(0,Date.now()-start),error:error?String(error.name||'Error').replace(/[^a-z]/gi,'').slice(0,32):'',backendCode:detail&&/^(?:[A-Z0-9]{5}|PGRST[0-9]{3}|friend-upstream-(?:timeout|unreachable|non-json))$/.test(String(detail.code||detail.message||''))?String(detail.code||detail.message):''});if(rows.length>24)rows.splice(0,rows.length-24);}catch(_){}}
function phoneFriendDiagnostic(){const p=phoneFriendState(),text=JSON.stringify({version:APP_VER,note:'仅连接元数据，不含聊天正文、ID或密钥。',records:p.transportDiagnostics||[]},null,2);openModal('<h3>真人好友连接诊断</h3><div class="hint">长按复制。此页面不会发送消息或测试请求。</div><textarea readonly style="width:100%;height:50vh">'+esc(text)+'</textarea><button class="btn g" onclick="closeModal()">关闭</button>');}
function pfClearLocalPending(other,serverMsg){const p=phoneFriendState();other=(''+other).toUpperCase();const arr=pfMsgList(p.messages,other);if(!arr.length||!serverMsg)return null;
  const from=(''+(serverMsg.from_id||serverMsg.from||'')).toUpperCase(),to=(''+(serverMsg.to_id||serverMsg.to||'')).toUpperCase(),body=''+(serverMsg.body||serverMsg.text||'');
  for(let i=arr.length-1;i>=0;i--){const x=arr[i];if(!x||!String(x.id||'').startsWith('local_'))continue;
    if(x.from===from&&x.to===to&&pfPendingMatches(x,serverMsg)){arr.splice(i,1);return x;}}
  return null;
}
function pfHeaders(){return {'apikey':GATE_KEY,'Authorization':'Bearer '+GATE_KEY,'Content-Type':'application/json'};}
function companionHeaders(){if(typeof NorthPublicRuntime!=='undefined'&&NorthPublicRuntime.available())return {apikey:NorthPublicRuntime.config.key,'Content-Type':'application/json'};return {'apikey':COMPANION_KEY,'Authorization':'Bearer '+COMPANION_KEY,'Content-Type':'application/json'};}
async function pfRpc(fn,args,ms){if(/send|respond|create_group|invite|accept/.test(fn)&&typeof phoneFriendSyncActive==='function')phoneFriendSyncActive();const write=!['phone_friend_search','phone_friend_sync'].includes(fn),messageWrite=fn==='phone_friend_send_message'||fn==='phone_friend_send_group_message';let base;
  try{base=await pfTransportRoute(ms);}catch(e){if(messageWrite){const err=new Error('连接未成功，消息尚未提交；请稍后重试。');err.pfNotSubmitted=true;throw err;}throw e;}
  const deadline=Date.now()+(ms||25000);
  for(let attempt=0;attempt<(write?1:2);attempt++){let r,txt,timer;const started=Date.now(),remaining=Math.max(1,deadline-started),wait=write||attempt?remaining:Math.min(15000,remaining);
    try{r=await fetchT(base+'/rest/v1/rpc/'+fn,{method:'POST',headers:pfHeaders(),body:JSON.stringify(args||{})},wait);txt=await Promise.race([r.text(),new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error('response body timeout');e.name='TimeoutError';reject(e);},Math.max(1,Math.min(wait-(Date.now()-started),deadline-Date.now())));})]);}
    catch(e){_pfTransportRoute='';if(typeof pfTransportRecord==='function')pfTransportRecord(fn,r?'reading-body':'waiting-response',base,r&&r.status,started,e);if(!write&&!attempt&&Date.now()<deadline){base=base===GATE_URL?PF_RELAY_BASE:GATE_URL;continue;}const err=new Error(write?(messageWrite?'发送结果尚未确认，请先刷新聊天核对，避免重复发送。':'操作结果尚未确认，请刷新核对；请勿重复操作。'):'真人好友连接中断，请稍后重试；好友和聊天记录已保留。');err.pfSubmissionUnknown=write;throw err;}finally{clearTimeout(timer);}
    let d=null,valid=true;try{d=txt?JSON.parse(txt):null;}catch(_){valid=false;}
    if(typeof pfTransportRecord==='function')pfTransportRecord(fn,'response',base,r.status,started,null,d);
    if(!valid){if(typeof pfTransportRecord==='function')pfTransportRecord(fn,'invalid-json',base,r.status,started);if(!write&&!attempt&&(r.ok||r.status>=500)&&Date.now()<deadline){_pfTransportRoute='';base=base===GATE_URL?PF_RELAY_BASE:GATE_URL;continue;}if(write&&r.ok){const err=new Error(messageWrite?'发送结果尚未确认，请先刷新聊天核对，避免重复发送。':'操作结果尚未确认，请刷新核对；请勿重复操作。');err.pfSubmissionUnknown=true;throw err;}d=null;}
    if(!r.ok){const backendTimeout=!write&&fn==='phone_friend_sync'&&d&&d.code==='57014';if(r.status>=500&&!backendTimeout)_pfTransportRoute='';if(backendTimeout){_pfTransportRoute=base;_pfTransportAt=Date.now();const err=new Error('好友同步暂时超时，系统会稍后重试；已有好友和聊天记录已保留。');err.pfBackendTimeout=true;throw err;}if(!write&&!attempt&&r.status>=500&&Date.now()<deadline){base=base===GATE_URL?PF_RELAY_BASE:GATE_URL;continue;}let msg=(d&&d.message)||('HTTP '+r.status);if(/Could not find the function|schema cache|404/i.test(msg))msg='好友云端表还没开通，先把 supabase_phone_friends.sql 执行一次';const err=new Error(write&&r.status>=500?(messageWrite?'发送结果尚未确认，请先刷新聊天核对，避免重复发送。':'操作结果尚未确认，请刷新核对；请勿重复操作。'):String(msg).slice(0,160));err.pfSubmissionUnknown=write&&r.status>=500;throw err;}
    if(!valid||(!write&&fn==='phone_friend_sync'&&(!d||typeof d!=='object'||Array.isArray(d))))throw new Error('真人好友返回内容无效，请稍后刷新；好友和聊天记录已保留。');
    if(messageWrite&&(!d||typeof d!=='object'||!d.id)){if(typeof pfTransportRecord==='function')pfTransportRecord(fn,'unconfirmed-ack',base,r.status,started);const err=new Error('发送结果尚未确认，请先刷新聊天核对，避免重复发送。');err.pfSubmissionUnknown=true;throw err;}
    _pfTransportRoute=base;_pfTransportAt=Date.now();return d;
  }}
function pfAvatarStorageKey(id){return 'pf_avatar_v2_'+String(id||'unknown').toUpperCase().replace(/[^A-Z0-9_-]/g,'_').slice(0,48);}
function pfAvatarRevision(raw){raw=String(raw||'');if(!raw)return'';return raw.length+':'+raw.slice(0,32)+':'+raw.slice(-24);}
//@@ web
async function pfProfilePayload(){const p=phoneFriendState();let avatar='';try{avatar=await rolePushAvatarData({avatar:S.me.avatar||'🙂',remark:S.me.name||'我',name:S.me.name||'我'});}catch(_){}if(!avatar){const raw=String(storedImageDisplaySource(S.me.avatar||'🙂')||'');avatar=isStoredImgRef(raw)?'':raw;}if(!avatar||avatar.length>PHONE_FRIEND_AVATAR_MAX)avatar='🙂';return {p_phone_id:p.id,p_secret:p.secret,p_display_name:(S.me.name||'我').slice(0,40),p_avatar:avatar,p_allow_search:p.allowSearch!==false};}
//@@ private
let _pfProfilePayloadCache=null,_pfProfilePayloadSignature='';
function pfProfileSourceSignature(){const p=phoneFriendState(),raw=String(S.me.avatar||'🙂');return [p.id,S.me.name||'我',p.allowSearch!==false?'1':'0',pfAvatarRevision(raw)].join('|');}
function pfBounded(promise,ms,label){let timer=0;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label||'operation-timeout')),Math.max(1000,+ms||8000));})]).finally(()=>clearTimeout(timer));}
async function pfProfilePayload(reuse){const p=phoneFriendState(),signature=pfProfileSourceSignature();if(reuse&&_pfProfilePayloadCache&&_pfProfilePayloadSignature===signature)return Object.assign({},_pfProfilePayloadCache);let avatar='';try{avatar=await pfBounded(rolePushAvatarData({avatar:S.me.avatar||'🙂',remark:S.me.name||'我',name:S.me.name||'我'}),8000,'profile-avatar-timeout');}catch(e){if(isStoredImgRef(String(S.me.avatar||'')))throw e;}if(!avatar){const raw=String(storedImageDisplaySource(S.me.avatar||'🙂')||'');avatar=isStoredImgRef(raw)?'':raw;}if(!avatar||avatar.length>PHONE_FRIEND_AVATAR_MAX)avatar='🙂';const payload={p_phone_id:p.id,p_secret:p.secret,p_display_name:(S.me.name||'我').slice(0,40),p_avatar:avatar,p_allow_search:p.allowSearch!==false};_pfProfilePayloadSignature=signature;_pfProfilePayloadCache=Object.assign({},payload);return payload;}
//@@ end
async function pfLocalizeRemoteAvatar(row,idHint,field){row=row&&typeof row==='object'?Object.assign({},row):row;if(!row)return row;field=field||((row.avatar!=null)?'avatar':'icon');const raw=String(row[field]||'').trim(),id=String(idHint||row.phone_id||row.id||row.from_id||'').toUpperCase();if(!raw||isStoredImgRef(raw)){delete row[field];return row;}row._avatarRev=pfAvatarRevision(raw);if(!isBigImg(raw))return row;const key=pfAvatarStorageKey(id);try{await imgPut(key,raw);row[field]='idb:'+key;_imgCache[key]=raw;_imgRev.set(raw,key);_imgReady.add(key);}catch(_){}return row;}
async function pfLocalizeRemoteRows(rows,idField,avatarField){if(!Array.isArray(rows))return rows;return Promise.all(rows.map(row=>pfLocalizeRemoteAvatar(row,row&&row[idField||'phone_id'],avatarField)));}
async function pfLocalizeRemoteData(d){if(!d||typeof d!=='object')return d;d=Object.assign({},d);if(Array.isArray(d.friends))d.friends=await pfLocalizeRemoteRows(d.friends,'phone_id','avatar');if(Array.isArray(d.requests))d.requests=await Promise.all(d.requests.map(async row=>{const field=row&&row.from_avatar!=null?'from_avatar':row&&row.avatar!=null?'avatar':'icon';return pfLocalizeRemoteAvatar(row,row&&(row.from_id||row.to_id||row.phone_id),field);}));if(Array.isArray(d.groups))d.groups=await Promise.all(d.groups.map(async group=>{const copy=Object.assign({},group);copy.members=await pfLocalizeRemoteRows(copy.members,'phone_id','avatar');return copy;}));return d;}
//@@ web
let _pfSyncBusy=false,_pfLastAuto=0,_pfSendBusy={},_pfRespondBusy={},_pfSyncQueued=null,_pfRenderQueued=false;
//@@ private
let _pfSyncBusy=false,_pfLastAuto=0,_pfSendBusy={},_pfRespondBusy={},_pfSyncQueued=null,_pfRenderQueued=false,_pfSyncYieldAt=0,_pfProfileSyncBusy=null,_pfProfileRefreshTimer=0;
function pfSyncClock(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now();}
function pfSyncMaybeYield(index){if(index%32)return null;const now=pfSyncClock();if(now-_pfSyncYieldAt<8)return null;return new Promise(resolve=>setTimeout(()=>{_pfSyncYieldAt=pfSyncClock();resolve();},0));}
function pfSyncKnownIds(cache,key,list){if(!cache)return null;key=''+key;let ids=cache.get(key);if(!ids){ids=new Set((Array.isArray(list)?list:[]).map(m=>m&&m.id).filter(id=>id!=null));cache.set(key,ids);}return ids;}
function pfSyncRememberRead(evidence,bucket,rid,ts){if(!evidence||!bucket)return;rid=(''+rid).toUpperCase();if(!rid)return;let readers=evidence.get(bucket);if(!readers){readers=new Map();evidence.set(bucket,readers);}readers.set(rid,Math.max(readers.get(rid)||0,ts||0));}
function pfSyncTrace(stage,fields){const hook=typeof window!=='undefined'&&window.__smallPhonePhoneFriendSyncTrace;if(typeof hook==='function')try{hook(Object.assign({stage:String(stage||'unknown')},fields||{}));}catch(_){}}
//@@ end
function pfQueueSync(silent,forceProfile,forceFull){const q=_pfSyncQueued||{silent:true,forceProfile:false,forceFull:false};q.silent=q.silent&&!!silent;q.forceProfile=q.forceProfile||!!forceProfile;q.forceFull=q.forceFull||!!forceFull;_pfSyncQueued=q;}
function pfFriendIds(p){return (p.friends||[]).map(f=>(''+(f.phone_id||f.id||'')).toUpperCase()).filter(Boolean);}
function pfHasAnyFriendMessages(p){return Object.keys(p.messages||{}).some(k=>Array.isArray(p.messages[k])&&p.messages[k].length);}
function pfNeedsFullSync(p,forceFull){if(forceFull||p._forceFullSync)return true;const ids=pfFriendIds(p);if(!ids.length)return false;if(!p.lastSync)return true;if(Date.now()-(p._lastFullSyncAt||0)<300000)return false;if(!pfHasAnyFriendMessages(p)&&ids.length)return true;return ids.some(id=>!Array.isArray((p.messages||{})[id])&&(p.clearBefore||{})[id]==null);}
//@@ web
async function pfEnsure(force){const p=phoneFriendState();if(!force&&(p._onlineAt&&Date.now()-p._onlineAt<60000||p._registeredAt&&typeof pfRealtime==='function'&&!pfRealtime()&&!pfOnFriendPage())){licenseSyncPhoneFriendIdentity().catch(()=>{});return true;}
  await pfRpc('phone_friend_upsert_profile',await pfProfilePayload(),25000);p._registeredAt=Date.now();p._onlineAt=Date.now();licenseSyncPhoneFriendIdentity(true).catch(()=>{});return true;}
function pfStoreMessage(m){const p=phoneFriendState();if(!m)return false;const me=p.id;const from=(''+(m.from_id||m.from||'')).toUpperCase(),to=(''+(m.to_id||m.to||'')).toUpperCase();
//@@ private
async function pfEnsure(force,reusePayload,skipIdentity){const p=phoneFriendState();if(!force&&p._registeredAt){if(!skipIdentity)licenseSyncPhoneFriendIdentity().catch(()=>{});return true;}if(_pfProfileSyncBusy){await _pfProfileSyncBusy;if(force&&_pfProfilePayloadSignature!==pfProfileSourceSignature())return pfEnsure(true,false,skipIdentity);return true;}const task=(async()=>{const started=pfSyncClock(),payloadStarted=pfSyncClock();pfSyncTrace('profile.begin',{forceProfile:!!force});try{const payload=await pfProfilePayload(!!reusePayload);pfSyncTrace('profilePayload.end',{ms:Math.max(0,Math.round(pfSyncClock()-payloadStarted))});const rpcStarted=pfSyncClock();await pfRpc('phone_friend_upsert_profile',payload,25000);pfSyncTrace('profileUpsert.end',{ms:Math.max(0,Math.round(pfSyncClock()-rpcStarted))});p._registeredAt=p._registeredAt||Date.now();p._onlineAt=Date.now();if(!skipIdentity)licenseSyncPhoneFriendIdentity(true).catch(()=>{});return true;}catch(e){pfSyncTrace('profile.error',{ms:Math.max(0,Math.round(pfSyncClock()-started)),error:String(e&&e.name||'Error').slice(0,40)});throw e;}})();_pfProfileSyncBusy=task;try{return await task;}finally{if(_pfProfileSyncBusy===task)_pfProfileSyncBusy=null;}}
function pfProfileRefreshSoon(delay){const p=phoneFriendState();if(!p._registeredAt||_pfProfileSyncBusy||_pfProfileRefreshTimer)return false;_pfProfileRefreshTimer=setTimeout(()=>{_pfProfileRefreshTimer=0;if((typeof document!=='undefined'&&document.hidden)||(typeof northNativeMaintenancePaused==='function'&&northNativeMaintenancePaused())){pfProfileRefreshSoon(5000);return;}pfEnsure(true,true,true).catch(()=>{});},Math.max(800,+delay||1200));return true;}
async function pfEnsureForSync(forceProfile){const p=phoneFriendState();if(!p._registeredAt){await pfEnsure(true,false,false);return false;}const due=!!forceProfile||(!p._onlineAt||Date.now()-p._onlineAt>=120000)&&(pfRealtime()||pfOnFriendPage());if(due)pfProfileRefreshSoon(1200);else licenseSyncPhoneFriendIdentity().catch(()=>{});return due;}
function pfStoreMessage(m,bulk){const p=phoneFriendState();if(!m)return false;const me=(''+p.id).toUpperCase();const from=(''+(m.from_id||m.from||'')).toUpperCase(),to=(''+(m.to_id||m.to||'')).toUpperCase();
//@@ end
  const other=from===me?to:from;if(!other)return false;p.messages[other]=pfEnsureMsgList(p.messages,other);
  const id=m.id||('m_'+(m.created_at||m.time||Date.now())+'_'+from+'_'+to);
  const ts=+(m.time||m.ts||0)||(m.created_at?new Date(m.created_at).getTime():Date.now());
//@@ web
  if(p.messages[other].some(x=>x.id===id))return false;
  if(from&&from!==me)pfInferFriendRead(other,from,ts);
//@@ private
  const known=bulk&&pfSyncKnownIds(bulk.friendIds,other,p.messages[other]);if(known?known.has(id):p.messages[other].some(x=>x.id===id))return false;
  if(from&&from!==me){if(bulk){pfSyncRememberRead(bulk.friendReads,other,from,ts);bulk.friendTouched.add(other);}else pfInferFriendRead(other,from,ts);}
//@@ end
  const oldLocal=!String(id).startsWith('local_')?pfClearLocalPending(other,m):null;
  if(ts<=(p.clearBefore[other]||0))return false;
  const kept={id,from,to,text:pfSafeBody(m.body||m.text||''),time:ts,recalled:!!m.recalled||!!(oldLocal&&oldLocal.recalled),received:!!m.received||!!(oldLocal&&oldLocal.received),receivedBy:m.received_by||m.receiver_id||(oldLocal&&oldLocal.receivedBy)||''};
  if(pfHandleTransferRefund(kept))return true;
  if(pfIsRoomTransport(kept)){pfHandleGamePayload(kept);return false;}
  const prev=p.messages[other][p.messages[other].length-1];p.messages[other].push(kept);
//@@ web
  if(prev&&(prev.time||0)>ts)p.messages[other].sort((a,b)=>(a.time||0)-(b.time||0));if(p.messages[other].length>300)p.messages[other]=p.messages[other].slice(-300);pfHandleGamePayload(kept);return true;}
//@@ private
  if(known)known.add(id);if(bulk)bulk.friendTouched.add(other);if(prev&&(prev.time||0)>ts)p.messages[other].sort((a,b)=>(a.time||0)-(b.time||0));if(p.messages[other].length>300)p.messages[other]=p.messages[other].slice(-300);pfHandleGamePayload(kept);return true;}
//@@ end
/* ===== 真人群拼手气红包：谁点了「開」，就往群里发一条看不见的 rp_grab。
   每台小手机都把同一个红包收到的 rp_grab 按服务器时间排好，前 count 个依次拿 splits 里对应的那一份，
   所以几个人同时抢，所有手机算出来的谁抢了多少都一样；钱在自己那条 rp_grab 被服务器确认后才进零钱。 */
function pfIsRpGrabTransport(m){const p=pfMsgPayload(m);return !!(p&&p.type==='rp_grab');}
function pfRpGrabStore(){const p=phoneFriendState();return p.rpGrabs||(p.rpGrabs={});}
function pfAbsorbRpGrab(gid,from,kept){const pl=pfMsgPayload(kept);if(!pl||pl.type!=='rp_grab'||!from||!pl.mid)return;const mid=String(pl.mid),store=pfRpGrabStore(),list=store[mid]||(store[mid]=[]),local=String(kept.id).startsWith('local_'),one={who:from,id:String(kept.id),time:+kept.time||Date.now(),gid};
  const i=list.findIndex(x=>x.who===from);if(i>=0){const x=list[i],xLocal=String(x.id).startsWith('local_');if(local||(!xLocal&&x.time<=one.time))return;list[i]=one;}else list.push(one);
  pfRpSettle(mid);}
// 抢红包的人不一定是我的好友，名字优先用好友备注，其次用群里的名字
function pfRpName(gid,id){id=String(id||'').toUpperCase();if(phoneFriendById(id))return pfNameById(id);const g=pfGroupById(gid),m=g&&pfGroupMemberById(g,id);return (m&&pfGroupMemberName(g,m))||pfNameById(id)||'群成员';}
function pfRpFind(mid){const p=phoneFriendState();let hit=null;Object.keys(p.groupMessages||{}).some(gid=>{const m=pfMsgList(p.groupMessages,gid).find(x=>x.id===mid);if(m){hit={m,gid,pay:pfMsgPayload(m)};return true;}return false;});return hit;}
function pfRpLucky(pay){return !!(pay&&pay.type==='redpacket'&&(+pay.count||0)>=1&&Array.isArray(pay.splits)&&pay.splits.length===+pay.count);}
function pfRpState(m,pay){if(!m||!pfRpLucky(pay))return null;const myId=String(phoneFriendState().id||'').toUpperCase(),count=+pay.count;
  const list=(pfRpGrabStore()[m.id]||[]).slice().sort((a,b)=>((+a.time||0)-(+b.time||0))||String(a.id).localeCompare(String(b.id)));
  const grabs=list.slice(0,count).map((x,i)=>({who:x.who,amount:+pay.splits[i]||0,time:+x.time||0,pending:String(x.id).startsWith('local_')}));
  const done=grabs.length>=count,mine=grabs.find(x=>x.who===myId)||null,got=Math.round(grabs.reduce((a,x)=>a+x.amount,0)*100)/100;
  let best=-1;if(done&&count>1&&pay.lucky!==false)grabs.forEach((x,i)=>{if(best<0||x.amount>grabs[best].amount)best=i;});
  return {count,splits:pay.splits,grabs,done,mine,got,best,lucky:pay.lucky!==false,total:+pay.amount||0,late:!mine&&list.some(x=>x.who===myId)};}
// 只按服务器确认过的名次记账；万一晚到的抢包记录把名次挤了，差额补一笔校正
function pfRpSettle(mid){const hit=pfRpFind(mid);if(!hit)return;const st=pfRpState(hit.m,hit.pay);if(!st)return;const p=phoneFriendState(),cred=p.rpCredited||(p.rpCredited={}),mine=st.mine&&!st.mine.pending?st.mine.amount:0,had=+cred[mid]||0;
  if(Math.round(mine*100)===Math.round(had*100))return;cred[mid]=mine;const diff=Math.round((mine-had)*100)/100,from=String(hit.m.from||'').toUpperCase()===String(p.id||'').toUpperCase()?'自己':pfRpName(hit.gid,hit.m.from);
  if(!had)addBill('in',mine,'收到 '+from+' 的群红包');else addBill(diff>0?'in':'out',Math.abs(diff),'群红包金额校正');}
function pfRpGrab(mid){const hit=pfRpFind(mid);if(!hit)return false;if(String(mid).startsWith('local_')){toast('红包还在发出去的路上，等一下');return false;}const st=pfRpState(hit.m,hit.pay),myId=String(phoneFriendState().id||'').toUpperCase();if(!st||st.done||st.mine||st.late)return false;
  sendPhoneFriendGroupBody(hit.gid,pfPack({type:'rp_grab',mid:String(mid)}),{silent:true}).then(result=>{if(result&&result.pending){toast('领取结果尚未确认，请稍后刷新核对。');return;}const l=pfRpGrabStore()[mid]||[],i=l.findIndex(x=>x.who===myId&&String(x.id).startsWith('local_'));if(i>=0){l.splice(i,1);save();toast('网络不好，红包没抢到，再点一次试试');render();}else{save();const c=cur();if(c.p==='pfgroup'||c.p==='rpDetail')render();}});
  return true;}
//@@ web
function pfStoreGroupMessage(m){const p=phoneFriendState();if(!m)return false;const gid=m.group_id||m.gid;if(!gid)return false;p.groupMessages[gid]=pfEnsureMsgList(p.groupMessages,gid);
  const id=m.id||('gm_'+gid+'_'+(m.created_at||m.time||Date.now())+'_'+(m.from_id||'')),ts=+(m.time||m.ts||0)||(m.created_at?new Date(m.created_at).getTime():Date.now()),from=(''+(m.from_id||m.from||'')).toUpperCase();if(p.groupMessages[gid].some(x=>x.id===id))return false;if(from&&from!==p.id)pfInferGroupRead(gid,from,ts);
//@@ private
function pfStoreGroupMessage(m,bulk){const p=phoneFriendState();if(!m)return false;const gid=m.group_id||m.gid;if(!gid)return false;p.groupMessages[gid]=pfEnsureMsgList(p.groupMessages,gid);
  const id=m.id||('gm_'+gid+'_'+(m.created_at||m.time||Date.now())+'_'+(m.from_id||'')),ts=+(m.time||m.ts||0)||(m.created_at?new Date(m.created_at).getTime():Date.now()),from=(''+(m.from_id||m.from||'')).toUpperCase(),me=(''+p.id).toUpperCase(),known=bulk&&pfSyncKnownIds(bulk.groupIds,gid,p.groupMessages[gid]);if(known?known.has(id):p.groupMessages[gid].some(x=>x.id===id))return false;if(from&&from!==me){if(bulk){pfSyncRememberRead(bulk.groupReads,gid,from,ts);bulk.groupTouched.add(gid);}else pfInferGroupRead(gid,from,ts);}
//@@ end
  let oldLocal=null;if(!String(id).startsWith('local_')){const from=(''+(m.from_id||m.from||'')).toUpperCase(),body=''+(m.body||m.text||'');const arr=p.groupMessages[gid];for(let i=arr.length-1;i>=0;i--){const x=arr[i];if(String(x.id||'').startsWith('local_')&&x.from===from&&pfPendingMatches(x,m)){oldLocal=arr.splice(i,1)[0];break;}}}
  if(ts<=(p.groupClearBefore[gid]||0))return false;
  const kept={id,gid,from,text:pfSafeBody(m.body||m.text||''),time:ts,recalled:!!m.recalled||!!(oldLocal&&oldLocal.recalled),received:!!m.received||!!(oldLocal&&oldLocal.received),receivedBy:m.received_by||m.receiver_id||(oldLocal&&oldLocal.receivedBy)||''};
  pfAbsorbGroupBubbleStyle(gid,from,kept);
  if(typeof pfAbsorbGroupManage==='function')pfAbsorbGroupManage(gid,from,kept);
  if(pfIsRpGrabTransport(kept)){pfAbsorbRpGrab(gid,from,kept);return false;}
  if(pfIsHiddenTransport(kept)||pfIsGroupQrTransport(kept)||pfIsGroupManageTransport(kept))return false;
  const prev=p.groupMessages[gid][p.groupMessages[gid].length-1];p.groupMessages[gid].push(kept);
//@@ web
  if(prev&&(prev.time||0)>ts)p.groupMessages[gid].sort((a,b)=>(a.time||0)-(b.time||0));if(p.groupMessages[gid].length>400)p.groupMessages[gid]=p.groupMessages[gid].slice(-400);return true;}
//@@ private
  if(known)known.add(id);if(bulk)bulk.groupTouched.add(gid);if(prev&&(prev.time||0)>ts)p.groupMessages[gid].sort((a,b)=>(a.time||0)-(b.time||0));if(p.groupMessages[gid].length>400)p.groupMessages[gid]=p.groupMessages[gid].slice(-400);return true;}
//@@ end
function pfMessageIndex(){const p=phoneFriendState(),idx=new Map();Object.keys(p.messages||{}).forEach(id=>{pfMsgList(p.messages,id).forEach(m=>{if(m&&m.id)idx.set(''+m.id,m);});});Object.keys(p.groupMessages||{}).forEach(gid=>{pfMsgList(p.groupMessages,gid).forEach(m=>{if(m&&m.id)idx.set(''+m.id,m);});});return idx;}
function pfApplyReceipt(r,idx){const mid=''+(r&&r.message_id||''),rid=(''+(r&&r.receiver_id||'')).toUpperCase(),m=mid&&idx&&idx.get(mid);if(!m||!rid)return false;if(pfPayloadIsPay(m)){const at=r.received_at?new Date(r.received_at).getTime():Date.now();if(m.received&&m.receivedBy===rid&&m.receivedAt===at)return false;m.received=true;m.receivedBy=rid;m.receivedAt=at;return true;}if(pfReadIds(m).indexOf(rid)>=0)return false;pfSetReadBy(m,rid);return true;}
function pfApplyRecall(r,idx){const mid=''+(r&&r.message_id||''),m=mid&&idx&&idx.get(mid);if(!m||m.recalled)return false;m.recalled=true;m.text='';return true;}
function pfCleanBubbleStyle(o){if(!o||typeof o!=='object')return null;const b=groupBubbleBase('them',o),out={bg:bubbleSolid(b.bg,'#2c2c2e'),text:bubbleSolid(b.text,'#ececec'),shape:BUBBLE_SHAPES[b.shape]?b.shape:'soft',avatar:b.avatar==='round'?'round':'original',icon:BUBBLE_ICONS[b.icon]?b.icon:'none',iconColor:bubbleIconColor(b.iconColor,'#e777a5'),glow:!!b.glow};return out;}
function pfAbsorbGroupBubbleStyle(gid,from,m){const pl=pfMsgPayload(m),st=pl&&pl.style,p=phoneFriendState();from=(''+(from||'')).toUpperCase();if(!gid||!from||from===p.id||!st)return;const clean=pfCleanBubbleStyle(st);if(!clean)return;const map=pfGroupBubbleMap(gid);map[from]=clean;}
function pfOwnGroupBubbleStyle(gid){const st=pfGroupBubbleCfg(gid,'me');return st?pfCleanBubbleStyle(st):null;}
function pfGroupOutgoingBody(gid,body){const st=pfOwnGroupBubbleStyle(gid);if(!st)return body;const pl=pfUnpack(body);if(pl){pl.style=st;return pfPack(pl)||body;}return pfPack({type:'text',text:body,style:st})||body;}
function pfKeyOf(x){return (''+((x&&x.phone_id)||(x&&x.group_id)||(x&&x.id)||'')).toUpperCase();}
function pfMergeRemote(local,remote,kind){local=Array.isArray(local)?local:[];if(!Array.isArray(remote))return local;if(!remote.length&&local.length)return local;const m=new Map();local.forEach(x=>{const k=pfKeyOf(x);if(k)m.set(k,x);});remote.forEach(x=>{const k=pfKeyOf(x);if(k)m.set(k,Object.assign({},m.get(k)||{},x));});return Array.from(m.values());}
function pfMergeGroupsAuthoritative(local,remote){local=Array.isArray(local)?local:[];if(!Array.isArray(remote))return local;const prev=new Map(local.map(x=>[pfKeyOf(x),x]));return remote.map(x=>Object.assign({},prev.get(pfKeyOf(x))||{},x));}
function pfRemoteListStamp(a,kind){if(!Array.isArray(a))return '';return a.map(x=>{const k=pfKeyOf(x),avatar=x&&(x._avatarRev||pfAvatarRevision(x.avatar||x.icon||x.from_avatar||'')),base=[k,x&&x.status||'',x&&x.direction||'',x&&x.display_name||x&&x.name||'',x&&x.updated_at||'',x&&x.member_count||'',avatar];if(kind==='group')base.push((x&&x.owner_id||'').toUpperCase(),...(Array.isArray(x&&x.members)?x.members.map(m=>pfKeyOf(m)+'@'+(m.updated_at||'')+'@'+(m._avatarRev||pfAvatarRevision(m.avatar||m.icon||''))):[]));return base.join('|');}).join('||');}
function pfRememberNotification(p,key){if(!key)return false;p._notifiedMessageIds=Array.isArray(p._notifiedMessageIds)?p._notifiedMessageIds:[];if(p._notifiedMessageIds.includes(key))return false;p._notifiedMessageIds.push(key);if(p._notifiedMessageIds.length>300)p._notifiedMessageIds.splice(0,p._notifiedMessageIds.length-300);return true;}
//@@ web
async function phoneFriendSync(silent,forceProfile,forceFull){if(_pfSyncBusy){pfQueueSync(silent,forceProfile,forceFull);return;}const p=phoneFriendState();_pfSyncBusy=true;
  try{await pfEnsure(!!forceProfile);const full=pfNeedsFullSync(p,!!forceFull),since=full?0:Math.max(0,(p.lastSync||0)-60000);const d=await pfLocalizeRemoteData(await pfRpc('phone_friend_sync',{p_phone_id:p.id,p_secret:p.secret,p_since_ms:since},30000));
//@@ private
async function phoneFriendSync(silent,forceProfile,forceFull){if(_pfSyncBusy){pfQueueSync(silent,forceProfile,forceFull);return;}const p=phoneFriendState(),started=pfSyncClock();let traceBulk=false;_pfSyncBusy=true;pfSyncTrace('begin',{forceProfile:!!forceProfile,forceFull:!!forceFull});
  try{const ensureStarted=pfSyncClock(),profileDeferred=await pfEnsureForSync(!!forceProfile);pfSyncTrace('ensure.end',{profileDeferred,ms:Math.max(0,Math.round(pfSyncClock()-ensureStarted))});
    const full=pfNeedsFullSync(p,!!forceFull),since=full?0:Math.max(0,(p.lastSync||0)-60000),rpcStarted=pfSyncClock(),raw=await pfRpc('phone_friend_sync',{p_phone_id:p.id,p_secret:p.secret,p_since_ms:since},30000),rawMsgs=Array.isArray(raw&&raw.messages)?raw.messages:[],rawGroupMsgs=Array.isArray(raw&&raw.group_messages)?raw.group_messages:[],rawReceipts=Array.isArray(raw&&raw.receipts)?raw.receipts:[],rawRecalls=Array.isArray(raw&&raw.recalls)?raw.recalls:[],bodyChars=rawMsgs.reduce((n,m)=>n+String(m&&(m.body||m.text)||'').length,0)+rawGroupMsgs.reduce((n,m)=>n+String(m&&(m.body||m.text)||'').length,0),remoteCount=rawMsgs.length+rawGroupMsgs.length;
    traceBulk=full||remoteCount>=16||bodyChars>=262144||rawReceipts.length+rawRecalls.length>=64;pfSyncTrace('rpc.end',{bulk:traceBulk,full,messages:rawMsgs.length,groupMessages:rawGroupMsgs.length,bodyChars,ms:Math.max(0,Math.round(pfSyncClock()-rpcStarted))});
    const localizeStarted=pfSyncClock(),d=await pfLocalizeRemoteData(raw);pfSyncTrace('localize.end',{bulk:traceBulk,full,ms:Math.max(0,Math.round(pfSyncClock()-localizeStarted))});_pfSyncYieldAt=pfSyncClock();
//@@ end
    const oldFriendMsgMax={};Object.keys(p.messages||{}).forEach(k=>{oldFriendMsgMax[k]=Math.max(0,...pfMsgList(p.messages,k).map(m=>m.time||0));});
    const oldGroupMsgMax={};Object.keys(p.groupMessages||{}).forEach(k=>{oldGroupMsgMax[k]=Math.max(0,...pfMsgList(p.groupMessages,k).map(m=>m.time||0));});
//@@ web
    const srvMsgs=Array.isArray(d&&d.messages)?d.messages:[],srvGroupMsgs=Array.isArray(d&&d.group_messages)?d.group_messages:[],srvReceipts=Array.isArray(d&&d.receipts)?d.receipts:[],srvRecalls=Array.isArray(d&&d.recalls)?d.recalls:[],friendStamp=pfRemoteListStamp(p.friends,'friend'),requestStamp=pfRemoteListStamp(p.requests,'request'),groupStamp=pfRemoteListStamp(p.groups,'group');
    let changed=full;const insertedFriend=new Set(),insertedGroup=new Set();p.friends=pfMergeRemote(p.friends,d&&d.friends,'friend');p.requests=Array.isArray(d&&d.requests)?d.requests:[];changed=pfRemoteListStamp(p.friends,'friend')!==friendStamp||pfRemoteListStamp(p.requests,'request')!==requestStamp||changed;srvMsgs.forEach(m=>{if(pfStoreMessage(m)){insertedFriend.add(''+(m.id||''));changed=true;}});
    const oldGroupIds=new Set((p.groups||[]).map(pfKeyOf));p.groups=pfMergeGroupsAuthoritative(p.groups,d&&d.groups);if(Array.isArray(d&&d.groups)){const activeGroupIds=new Set(p.groups.map(pfKeyOf));oldGroupIds.forEach(gid=>{if(activeGroupIds.has(gid))return;delete p.groupMessages[gid];delete p.groupRead[gid];delete p.groupClearBefore[gid];delete p.groupBubbleStyles[gid];delete p.groupRemarks[gid];changed=true;});}changed=pfRemoteListStamp(p.groups,'group')!==groupStamp||changed;srvGroupMsgs.forEach(m=>{if(pfStoreGroupMessage(m)){insertedGroup.add(''+(m.id||''));changed=true;}});const msgIndex=pfMessageIndex();srvReceipts.forEach(r=>{changed=pfApplyReceipt(r,msgIndex)||changed;});srvRecalls.forEach(r=>{changed=pfApplyRecall(r,msgIndex)||changed;});
    changed=pfReconcileReadInference()||changed;
    srvMsgs.forEach(m=>{const from=(''+(m.from_id||'')).toUpperCase(),ts=m.created_at?new Date(m.created_at).getTime():0,key='f:'+(m.id||'');if(from&&from!==p.id&&(full||insertedFriend.has(''+(m.id||'')))){const fresh=pfRememberNotification(p,key);if(!full&&fresh&&ts>(oldFriendMsgMax[from]||0))pfNotifyFriend(m);}});
    srvGroupMsgs.forEach(m=>{const gid=m.group_id,from=(''+(m.from_id||'')).toUpperCase(),ts=m.created_at?new Date(m.created_at).getTime():0,key='g:'+(m.id||'');if(from&&from!==p.id&&gid&&(full||insertedGroup.has(''+(m.id||'')))){const fresh=pfRememberNotification(p,key);if(!full&&fresh&&ts>(oldGroupMsgMax[gid]||0))pfNotifyGroup(m);}});
//@@ private
    const srvMsgs=Array.isArray(d&&d.messages)?d.messages:[],srvGroupMsgs=Array.isArray(d&&d.group_messages)?d.group_messages:[],srvReceipts=Array.isArray(d&&d.receipts)?d.receipts:[],srvRecalls=Array.isArray(d&&d.recalls)?d.recalls:[],friendStamp=pfRemoteListStamp(p.friends,'friend'),requestStamp=pfRemoteListStamp(p.requests,'request'),groupStamp=pfRemoteListStamp(p.groups,'group'),bulk={friendIds:new Map(),groupIds:new Map(),friendReads:new Map(),groupReads:new Map(),friendTouched:new Set(),groupTouched:new Set()};
    let changed=full;const mergeStarted=pfSyncClock(),insertedFriend=new Set(),insertedGroup=new Set();p.friends=pfMergeRemote(p.friends,d&&d.friends,'friend');p.requests=Array.isArray(d&&d.requests)?d.requests:[];changed=pfRemoteListStamp(p.friends,'friend')!==friendStamp||pfRemoteListStamp(p.requests,'request')!==requestStamp||changed;
    for(let i=0;i<srvMsgs.length;i++){const m=srvMsgs[i];if(pfStoreMessage(m,bulk)){insertedFriend.add(''+(m.id||''));changed=true;}const pause=pfSyncMaybeYield(i+1);if(pause)await pause;}
    const oldGroupIds=new Set((p.groups||[]).map(pfKeyOf));p.groups=pfMergeGroupsAuthoritative(p.groups,d&&d.groups);if(Array.isArray(d&&d.groups)){const activeGroupIds=new Set(p.groups.map(pfKeyOf));oldGroupIds.forEach(gid=>{if(activeGroupIds.has(gid))return;delete p.groupMessages[gid];delete p.groupRead[gid];delete p.groupClearBefore[gid];delete p.groupBubbleStyles[gid];delete p.groupRemarks[gid];changed=true;});}changed=pfRemoteListStamp(p.groups,'group')!==groupStamp||changed;
    for(let i=0;i<srvGroupMsgs.length;i++){const m=srvGroupMsgs[i];if(pfStoreGroupMessage(m,bulk)){insertedGroup.add(''+(m.id||''));changed=true;}const pause=pfSyncMaybeYield(i+1);if(pause)await pause;}
    const msgIndex=pfMessageIndex();for(let i=0;i<srvReceipts.length;i++){changed=pfApplyReceipt(srvReceipts[i],msgIndex)||changed;const pause=pfSyncMaybeYield(i+1);if(pause)await pause;}for(let i=0;i<srvRecalls.length;i++){changed=pfApplyRecall(srvRecalls[i],msgIndex)||changed;const pause=pfSyncMaybeYield(i+1);if(pause)await pause;}
    pfSyncTrace('merge.end',{bulk:traceBulk,full,friendInserted:insertedFriend.size,groupInserted:insertedGroup.size,ms:Math.max(0,Math.round(pfSyncClock()-mergeStarted))});
    if(full||bulk.friendTouched.size||bulk.groupTouched.size){const reconcileStarted=pfSyncClock();changed=(await pfReconcileReadInference(full?null:bulk.friendTouched,full?null:bulk.groupTouched,bulk.friendReads,bulk.groupReads))||changed;pfSyncTrace('reconcile.end',{bulk:traceBulk,full,friendBuckets:bulk.friendTouched.size,groupBuckets:bulk.groupTouched.size,ms:Math.max(0,Math.round(pfSyncClock()-reconcileStarted))});}
    for(let i=0;i<srvMsgs.length;i++){const m=srvMsgs[i],from=(''+(m.from_id||'')).toUpperCase(),ts=m.created_at?new Date(m.created_at).getTime():0,key='f:'+(m.id||'');if(from&&from!==p.id&&(full||insertedFriend.has(''+(m.id||'')))){const fresh=pfRememberNotification(p,key);if(!full&&fresh&&ts>(oldFriendMsgMax[from]||0))pfNotifyFriend(m);}const pause=pfSyncMaybeYield(i+1);if(pause)await pause;}
    for(let i=0;i<srvGroupMsgs.length;i++){const m=srvGroupMsgs[i],gid=m.group_id,from=(''+(m.from_id||'')).toUpperCase(),ts=m.created_at?new Date(m.created_at).getTime():0,key='g:'+(m.id||'');if(from&&from!==p.id&&gid&&(full||insertedGroup.has(''+(m.id||'')))){const fresh=pfRememberNotification(p,key);if(!full&&fresh&&ts>(oldGroupMsgMax[gid]||0))pfNotifyGroup(m);}const pause=pfSyncMaybeYield(i+1);if(pause)await pause;}
//@@ end
    if(typeof pfGroupQrProcess==='function')pfGroupQrProcess(srvMsgs);
//@@ web
    const hadError=!!p.lastError;p.lastSync=+(d&&d.server_time_ms)||Date.now();if(full){p._lastFullSyncAt=Date.now();delete p._forceFullSync;delete p._repairNote;}p.lastError='';p._syncFailures=0;p._syncRetryAt=0;if(changed)_pfIdleSyncs=0;else _pfIdleSyncs++;const persistCursor=Date.now()-(p._lastCursorPersistAt||0)>300000;if(changed||hadError||persistCursor){p._lastCursorPersistAt=Date.now();save();}const c=cur&&cur(),paintable=c&&(c.p==='pffriends'||c.p==='pfchat'||c.p==='pfgroup'||c.p==='wechat');if(changed&&paintable&&pfTypingActive())_pfRenderQueued=true;else if(paintable&&!pfTypingActive()&&(changed||_pfRenderQueued)){_pfRenderQueued=false;render();}}
  catch(e){const msg=e&&e.message||'好友同步失败',changed=p.lastError!==msg;p.lastError=msg;p._syncFailures=Math.min(5,(p._syncFailures||0)+1);p._syncRetryAt=Date.now()+Math.min(30000,3000*Math.pow(2,p._syncFailures-1));if(changed)save();if(!silent)toast(p.lastError);}
//@@ private
    const hadError=!!p.lastError;p.lastSync=+(d&&d.server_time_ms)||Date.now();if(full){p._lastFullSyncAt=Date.now();delete p._forceFullSync;delete p._repairNote;}p.lastError='';p._syncFailures=0;p._syncRetryAt=0;if(changed)_pfIdleSyncs=0;else _pfIdleSyncs++;const persistCursor=Date.now()-(p._lastCursorPersistAt||0)>300000;if(changed||hadError||persistCursor){const persistStarted=pfSyncClock();pfSyncTrace('persist.begin',{bulk:traceBulk,full,changed,hadError});p._lastCursorPersistAt=Date.now();save();pfSyncTrace('persist.end',{bulk:traceBulk,full,ms:Math.max(0,Math.round(pfSyncClock()-persistStarted))});}const c=cur&&cur(),paintable=c&&(c.p==='pffriends'||c.p==='pfchat'||c.p==='pfgroup'||c.p==='wechat');if(changed&&paintable&&pfTypingActive())_pfRenderQueued=true;else if(paintable&&!pfTypingActive()&&(changed||_pfRenderQueued)){_pfRenderQueued=false;render();}pfSyncTrace('complete',{bulk:traceBulk,full,changed,ms:Math.max(0,Math.round(pfSyncClock()-started))});}
  catch(e){const msg=e&&e.message||'好友同步失败',changed=p.lastError!==msg;p.lastError=msg;p._syncFailures=Math.min(5,(p._syncFailures||0)+1);p._syncRetryAt=Date.now()+Math.min(30000,3000*Math.pow(2,p._syncFailures-1));pfSyncTrace('error',{bulk:traceBulk,ms:Math.max(0,Math.round(pfSyncClock()-started)),error:String(e&&e.name||'Error').slice(0,40)});if(changed)save();if(!silent)toast(p.lastError);}
//@@ end
  finally{_pfSyncBusy=false;const queued=_pfSyncQueued;_pfSyncQueued=null;if(queued)setTimeout(()=>phoneFriendSync(queued.silent,queued.forceProfile,queued.forceFull),queued.silent&&!queued.forceProfile&&!queued.forceFull?Math.max(0,(p._syncRetryAt||0)-Date.now()):0);}}
/* v1732：数据库后台实测 phone_friend_sync 一个接口就占了全部数据库时间的 42%（一万多次调用），
   最小规格的服务器 CPU 100%、读写额度 96%，最后卡死，授权、好友、店铺一起不可用。
   原来只要小手机开着就每 15 秒同步一次（在微信 6 秒、在聊天里 2.5 秒），不管有没有新消息。
   现在：一直没有新东西就逐渐放慢；一有新消息、自己发消息、切回小手机、打开好友页，立刻恢复快速。
   - 真人好友聊天里：2.5 秒起，最慢 8 秒（正在聊天的体验不变）
   - 微信 / 好友列表：6 秒起，最慢 30 秒
   - 其他页面：30 秒起，最慢 3 分钟（这时只是为了通知，晚一点没关系） */
let _pfIdleSyncs=0;
function phoneFriendSyncActive(){_pfIdleSyncs=0;}
/* PF_LOW_TRAFFIC_V1（2026-10-30 她要求：真人好友平时用不到，把它的流量压到最低，还能用就行）：menkou 项目一小时 1.8 万次请求，大头是真人好友——停在微信页也 6～30 秒同步一次、每次重下全部好友头像，还每 1～2 分钟上传一次自己的头像当在线心跳。现在默认省流量：聊天页照旧快；好友列表 30 秒；其他页面有好友时 5 分钟、完全没有好友/群/待处理申请时 30 分钟；在线心跳只在真人好友页面上传；线路探测 30 分钟一次。真人好友页里「实时接收消息」打开后恢复原来的节奏。服务器不动。 */
function pfRealtime(){return !!(S.settings&&S.settings.pfRealtime===true);}
function pfOnFriendPage(){const c=typeof cur==='function'&&cur();return !!(c&&['pfchat','pfgroup','pffriends','mgroom'].includes(c.p));}
function pfHasAnyFriend(){const p=phoneFriendState();return (p.friends||[]).length>0||(p.groups||[]).length>0||(p.requests||[]).some(r=>r&&(r.status==='pending'||!r.status));}
function phoneFriendToggleRealtime(){S.settings=S.settings||{};S.settings.pfRealtime=!pfRealtime();save();render();toast(pfRealtime()?'已打开实时接收：新消息几秒内就到，流量会多一些':'已改为省流量：不在真人好友页面时每 5 分钟收一次新消息');}
function phoneFriendPollDelay(){const c=typeof cur==='function'&&cur(),grow=Math.pow(1.5,Math.min(_pfIdleSyncs,12));if(c&&(c.p==='pfchat'||c.p==='pfgroup'))return Math.min(8000,2500*grow);if(c&&c.p==='mgroom')return Math.min(180000,30000*grow);if(pfRealtime()){if(c&&(c.p==='pffriends'||c.p==='wechat'))return Math.min(30000,6000*grow);return Math.min(180000,30000*grow);}if(c&&c.p==='pffriends')return 30000;return pfHasAnyFriend()?300000:1800000;}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{if(!document.hidden)phoneFriendSyncActive();});
//@@ web
function phoneFriendMaybeSync(force){const now=Date.now(),c=typeof cur==='function'?cur():null,active=!!(c&&['pfchat','pfgroup','pffriends','wechat'].includes(c.p));if(!force&&(northNativeMaintenancePaused()&&!active||(typeof document!=='undefined'&&document.hidden)||phoneFriendState()._syncRetryAt>now||now-_pfLastAuto<phoneFriendPollDelay()))return;_pfLastAuto=now;phoneFriendSync(true,false);}
//@@ private
function phoneFriendMaybeSync(force){const now=Date.now();if(!force&&(northNativeMaintenancePaused()||(typeof document!=='undefined'&&document.hidden)||phoneFriendState()._syncRetryAt>now||now-_pfLastAuto<phoneFriendPollDelay()))return false;_pfLastAuto=now;return phoneFriendSync(true,false);}
//@@ end
function openPhoneFriends(){phoneFriendSyncActive();go('pffriends');setTimeout(()=>phoneFriendMaybeSync(true),60);}
function pfReqs(dir){const p=phoneFriendState();return (p.requests||[]).filter(r=>r.direction===dir&&r.status==='pending');}
function pfOnlineText(f){return pfIsOnline(f)?'在线':'离线';}
function pfReadStatus(m,scope,gid){if(m&&String(m.id||'').startsWith('local_')&&m.sendState)return m.sendState==='sending'?'发送中…':m.sendState==='unknown'?'发送结果待确认':'尚未发送';if(!readReceiptOn())return '';if(!m||m.recalled||String(m.id||'').startsWith('local_')||pfPayloadIsPay(m))return '';const p=phoneFriendState(),ids=pfReadIds(m).filter(x=>x&&x!==p.id);if(scope==='group'){const g=pfGroupById(gid)||{},total=Math.max(0,((g.members||[]).length||1)-1),n=ids.length;return n?`${n}${total?'/'+total:''}人已读`:'';}return ids.length?'已读':'';}
function pfFriendRowsHTML(){const p=phoneFriendState(),fs=p.friends||[];if(!fs.length)return '';
  return fs.map(f=>{const id=(''+(f.phone_id||f.id)).toUpperCase(),arr=pfVisibleMsgList(p.messages,id),lm=arr[arr.length-1],unread=wxPfUnread(arr,id,p.friendRead[id],false);
    return `<div class="row" onclick="openPhoneFriendChat('${id}')">${wxUnreadAvatar(pfAvatarOnlineHTML(f),unread)}<div class="meta"><div class="n">${esc(pfFriendDisplayName(f))}</div><div class="s">${lm?esc(lm.recalled?'[已撤回一条消息]':((lm.from===p.id?'我：':'')+pfMsgPreview(lm))):'已经是好友，打个招呼吧'}</div></div><div style="text-align:right"><div class="meta time">${lm?hm(lm.time):''}</div></div></div>`;}).join('');}
function pfGroupRowsHTML(){const p=phoneFriendState(),gs=p.groups||[];if(!gs.length)return '';
  return gs.map(g=>{const gid=g.group_id||g.id,arr=pfMsgList(p.groupMessages,gid),lm=arr[arr.length-1],unread=wxPfUnread(arr,p.id,p.groupRead[gid],true);
    return `<div class="row" onclick="openPhoneFriendGroup('${gid}')">${wxUnreadAvatar(wxClassicGroupAvatarHTML(),unread)}<div class="meta"><div class="n">${esc(pfGroupDisplayName(g))}</div><div class="s">${lm?esc(lm.recalled?'[已撤回一条消息]':((pfNameById(lm.from)||'成员')+'：'+pfMsgPreview(lm))):'群聊已创建'}</div></div><div style="text-align:right"><div class="meta time">${lm?hm(lm.time):''}</div></div></div>`;}).join('');}
function phoneFriendEntryHTML(){const n=pfReqs('incoming').length;return `<div class="list"><div class="row" onclick="openPhoneFriends()"><div class="avatar sm" style="background:#6574ff">${svgIc('users',22,'#fff')}</div><div class="meta"><div class="n">小手机好友</div><div class="s">我的小手机ID：${esc(phoneFriendId())}</div></div>${n?pfUnreadDot(n):'<span class="v">›</span>'}</div></div>`;}
function phoneFriendContactRowsHTML(){const p=phoneFriendState(),fs=p.friends||[];if(!fs.length)return '';
  return `<div class="list">${fs.map(f=>{const id=(''+(f.phone_id||f.id)).toUpperCase();return `<div class="row" onclick="openPhoneFriendChat('${id}')">${pfAvatarOnlineHTML(f,'sm')}<div class="meta"><div class="n">${esc(pfFriendDisplayName(f))}</div><div class="s">小手机ID：${esc(id)}</div></div><span class="v">›</span></div>`;}).join('')}</div>`;}
let _pfSwipe=null;
function pfSwipeStart(e,id){_pfSwipe={id,x:e.clientX,y:e.clientY,dx:0};}
function pfSwipeMove(e,id){if(!_pfSwipe||_pfSwipe.id!==id)return;_pfSwipe.dx=e.clientX-_pfSwipe.x;if(Math.abs(_pfSwipe.dx)>18&&Math.abs(_pfSwipe.dx)>Math.abs(e.clientY-_pfSwipe.y)){try{e.preventDefault();}catch(_){} }}
function pfSwipeEnd(e,id){if(!_pfSwipe||_pfSwipe.id!==id)return;const el=$('#pfsw_'+id);if(el){if(_pfSwipe.dx<-34)el.classList.add('open');else if(_pfSwipe.dx>16)el.classList.remove('open');} _pfSwipe=null;}
function legacyCopyText(text,input){let el=input,own=false;try{if(!el){el=document.createElement('textarea');el.value=text;el.setAttribute('readonly','');el.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(el);own=true;}el.focus();el.select();if(el.setSelectionRange)el.setSelectionRange(0,String(text).length);const ok=!!(document.execCommand&&document.execCommand('copy'));if(own&&el.parentNode)el.parentNode.removeChild(el);return ok;}catch(_){try{if(own&&el&&el.parentNode)el.parentNode.removeChild(el);}catch(__){}return false;}}
function copyTextCompat(text,input){text=String(text||'');try{if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).then(()=>true).catch(()=>legacyCopyText(text,input));}catch(_){}return Promise.resolve(legacyCopyText(text,input));}
function copyPhoneFriendId(){const id=phoneFriendId();copyTextCompat(id).then(ok=>toast((ok?'已复制小手机ID：':'请手动复制小手机ID：')+id));}
async function phoneFriendToggleSearch(){const p=phoneFriendState();p.allowSearch=p.allowSearch===false;save();render();try{await pfEnsure(true);toast(p.allowSearch?'别人可以搜到你':'已关闭被搜索');}catch(e){toast(e.message||'同步失败');}}
async function phoneFriendSearch(q){q=(q||($('#pf_search')&&$('#pf_search').value)||'').trim().toUpperCase();if(!q){toast('输入对方的小手机ID');return;}const p=phoneFriendState();p.search={q,busy:true,items:[]};render();
  try{await pfEnsure();const items=await pfLocalizeRemoteRows(await pfRpc('phone_friend_search',{p_query:q},20000),'phone_id','avatar');p.search={q,busy:false,items:Array.isArray(items)?items:[]};save();render();}
  catch(e){p.search={q,busy:false,items:[],err:e.message};save();render();toast(e.message||'搜索失败');}}
function phoneFriendSearchClear(){const p=phoneFriendState();p.search={q:'',busy:false,items:[]};save();render();setTimeout(()=>{const i=$('#pf_search');if(i)i.focus();},60);}
function phoneFriendSearchFromWx(q){openPhoneFriends();setTimeout(()=>{const i=$('#pf_search');if(i)i.value=(''+q).trim().toUpperCase();phoneFriendSearch((''+q).trim().toUpperCase());},120);}
async function phoneFriendRequest(toId){toId=(''+toId).toUpperCase();const p=phoneFriendState();if(toId===p.id){toast('这是你自己的小手机ID');return;}if(phoneFriendById(toId)){toast('你们已经是好友了');return;}
  try{await pfEnsure();await pfRpc('phone_friend_send_request',{p_from_id:p.id,p_secret:p.secret,p_to_id:toId,p_message:''},25000);toast('好友申请已发送');phoneFriendSync(true);}
  catch(e){toast(e.message||'发送失败');}}
async function phoneFriendRespond(rid,ok){rid=''+(rid||'');if(!rid||_pfRespondBusy[rid])return;const p=phoneFriendState(),req=(p.requests||[]).find(r=>(''+r.id)===rid&&r.direction==='incoming');if(!req){toast('这条申请已经更新，请刷新后再看');phoneFriendSync(true,false,true);return;}_pfRespondBusy[rid]=true;req._responding=true;render();
  try{await pfEnsure();const changed=await pfRpc('phone_friend_respond_request',{p_to_id:p.id,p_secret:p.secret,p_request_id:rid,p_accept:!!ok},25000);if(changed!==true){p.lastSync=0;await phoneFriendSync(false,false,true);const other=(''+(req.from_id||'')).toUpperCase();if(ok&&other&&phoneFriendById(other)){req.status='accepted';delete req._responding;save();render();toast('你们已经是好友了');return;}throw new Error('这条申请已失效或被处理，请刷新后重试');}
    req.status=ok?'accepted':'rejected';delete req._responding;if(ok){const other=(''+(req.from_id||'')).toUpperCase();if(other&&!phoneFriendById(other))p.friends.unshift({phone_id:other,display_name:req.from_name||other,avatar:req.from_avatar||'🙂',since:new Date().toISOString()});}p.lastSync=0;save();render();toast(ok?'已通过':'已忽略');await phoneFriendSync(true,false,true);}
  catch(e){delete req._responding;delete _pfRespondBusy[rid];render();toast(e.message||'操作失败');}
  finally{delete _pfRespondBusy[rid];}}
//@@ web
function openPhoneFriendChat(id){phoneFriendSyncActive();wxChatRestore('friend:'+String(id).toUpperCase());id=(''+id).toUpperCase();pfMarkRead(id);go('pfchat',{id});setTimeout(()=>{const p=phoneFriendState(),empty=!pfMsgList(p.messages,id).length;if(empty)phoneFriendSync(true,false,true);else phoneFriendMaybeSync(true);},60);}
//@@ private
const _pfFriendRenderLimit={};
function openPhoneFriendChat(id){phoneFriendSyncActive();wxChatRestore('friend:'+String(id).toUpperCase());id=(''+id).toUpperCase();const started=pfSyncClock();_pfFriendRenderLimit[id]=60;pfMarkRead(id);go('pfchat',{id});pfSyncTrace('chatOpen.end',{ms:Math.max(0,Math.round(pfSyncClock()-started))});setTimeout(()=>{const p=phoneFriendState(),empty=!pfMsgList(p.messages,id).length;if(empty)phoneFriendSync(true,false,true);else phoneFriendMaybeSync(true);},60);}
//@@ end
