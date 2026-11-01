function dyGroupMsgRow(g,m,prev){if(m.type==='sys')return `${dyGStamp(g,m,prev)}<div class="dyg-sys">${dyGSysHTML(m.text)}</div>`;
  const mem=dyGFind(g,m.k),me=m.k==='me',role=dyGRole(g,m.k);
  /* 自己那条不要留一个空的 onclick：点了什么都不会发生，只会让「每个按钮都点得动」这句话变成假的。 */
  const open=me?'':` onclick="dyOpenUser('${esc(m.k)}')"`;
  return `${dyGStamp(g,m,prev)}<div class="dyg-msg${me?' me':''}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}"><span${open}>${me?av(dyAvatar(),'sm'):dyFace(dyGMemberAvatar(mem),'sm')}</span>
    <div class="dyg-body"><div class="dyg-who"${open}>${esc(dyGMemberName(mem))}${dyGBadge(role)}${dyGMuteLeft(g,m.k)>0?'<em class="dyg-badge muted">禁言中</em>':''}</div>
    ${m.kind?`<div class="dyg-b${m.kind==='red'||m.kind==='transfer'||m.kind==='sticker'?' bare':' plain'}" onclick="dyGroupMsgMenu('${g.id}','${m.id}')">${dyMsgBodyHTML(m,'g',g.id)}</div>`:`<div class="dyg-b" onclick="dyGroupMsgMenu('${g.id}','${m.id}')">${dyGAtHTML(g,m.text)}</div>`}</div></div>`;}
function dyGStamp(g,m,prev){if(!m.time)return '';if(prev&&prev.time&&m.time-prev.time<5*60000)return '';
  const t=new Date(m.time),hm=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'),day=dyListTime(m.time);
  return '<div class="dyg-t">'+esc(day===hm?hm:day+' '+hm)+'</div>';}
function dyGSysHTML(t){return esc(String(t||'')).replace(/^(\S{1,12})\s(邀请|通过申请)/,'<b>$1</b> $2').replace(/(邀请)\s(\S{1,12})/,'$1 <b>$2</b>');}
function dyGroupQuickChips(){return [['🌟','晚上好'],['🤲','比心'],['@','群聊 AI'],['👍','赞'],['🌚','黑脸']];}
function dyGroupView(){const g=dyGroup(_dyGid);if(!g)return `<div class="dyvi"><div class="dyvi-nav"><i onclick="dySubClose()">‹</i><b>群聊</b><span></span></div><div class="dyvi-empty">这个群已经不在了</div></div>`;
  const rows=dyGMsgs(g),tabs=['聊天','公告','置顶','收藏','设置'];
  const body=_dyGTab==='公告'?`<div class="dyg-pane">${g.notice?esc(g.notice):'群主还没写公告'}<div style="margin-top:12px"><button class="dybtn out" onclick="dyGNotice('${g.id}')">${g.notice?'改公告':'写一条公告'}</button></div></div>`
    :_dyGTab==='置顶'?'<div class="dyg-pane">还没有置顶的消息～长按一条消息可以置顶</div>'
    :_dyGTab==='收藏'?'<div class="dyg-pane">群收藏还没做～</div>'
    :`<div class="dyg-box" data-render-scroll-key="dyg:${esc(g.id)}">${rows.length?rows.map((m,i)=>dyGroupMsgRow(g,m,rows[i-1])).join(''):'<div class="dyvi-empty">还没人说话～发一条，看看他们怎么接。</div>'}${dyTypingShown('g:'+g.id)?dyTypingHTML(''):''}</div>`;
  return `<div class="dyg">
    <div class="dyg-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i>${av(g.avatar||'👥','sm')}<b>${esc(g.name)} (${dyGCount(g)})</b><i onclick="dyOpenGroupInfo('${g.id}')">${svgIc('dots',20,'#f2f2f4',2)}</i></div>
    <div class="dyg-tabs">${tabs.map(t=>`<span class="${_dyGTab===t?'on':''}" onclick="dyGSetTab('${t}')">${t}</span>`).join('')}</div>
    ${body}
    ${_dyGTab==='聊天'?`<div class="dydm-quick">${dyGroupQuickChips().map(c=>`<span onclick="dyGroupQuick('${g.id}','${esc(c[1])}')">${c[0]} ${esc(c[1])}</span>`).join('')}</div>
    ${dyGMeMuted(g)?dyGMutedBarHTML(g):`${dyEmojiPanelHTML('g',g.id)}<div class="dydm-bar${dyVoiceOn('g',g.id)?' voice-on':''}"><i onclick="dyGroupPlus('${g.id}')">${svgIc('expand',20,'#c8c8d0',2)}</i><i onclick="dyGroupAt('${g.id}')">@</i><input id="dyg_in" placeholder="${dyVoiceOn('g',g.id)?'打字，发出来是语音条…':'发消息…'}" onkeydown="if(event.key==='Enter')dyGroupSend('${g.id}')"><i class="${dyVoiceOn('g',g.id)?'on':''}" onclick="dyVoiceToggle('g','${g.id}')">${svgIc('volume',20,dyVoiceOn('g',g.id)?'#fe2c55':'#c8c8d0',2)}</i><i class="${dyPanelOpen('g',g.id)?'on':''}" onclick="dyPanelToggle('g','${g.id}','emo')">${svgIc('smile',20,dyPanelOpen('g',g.id)?'#fe2c55':'#c8c8d0',2)}</i><i class="send" onclick="dyGroupSend('${g.id}')">${svgIc('forward',19,'#fff',2.2)}</i></div>`}`:''}
  </div>`;}
function dyGroupQuick(gid,t){const i=$('#dyg_in');if(i)i.value=t;dyGroupSend(gid);}
function dyGroupAt(gid){const g=dyGroup(gid);if(!g)return;const ms=dyGMemberList(g).filter(m=>m.k!=='me');if(!ms.length)return toast('群里还没有别人');
  openModal(`<h3>@ 谁</h3><div style="max-height:46vh;overflow:auto">${ms.map(m=>`<div class="row" onclick="dyGroupAtPick('${gid}','${esc(m.k)}')" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${dyFace(dyGMemberAvatar(m),'sm')}<b style="flex:1;font-size:14px;font-weight:500">${esc(dyGMemberName(m))}</b></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function dyGroupAtPick(gid,k){const g=dyGroup(gid),m=g&&dyGFind(g,k);closeModal();if(!m)return;const i=$('#dyg_in');if(i){i.value=(i.value||'')+'@'+dyGMemberName(m)+' ';i.focus();}}
function dyGroupSend(gid){const g=dyGroup(gid);if(!g)return;
  if(dyGMeMuted(g))return toast('你被禁言了，还剩 '+dyGMuteText(dyGMeMuted(g)));
  const inp=$('#dyg_in'),t=inp?String(inp.value||'').trim():'';if(!t)return;
  const voice=dyVoiceOn('g',gid);
  dyGMsgs(g).push(voice?{id:uid(),k:'me',kind:'voice',text:t.slice(0,300),time:Date.now()}:{id:uid(),k:'me',text:t.slice(0,300),time:Date.now()});
  save();if(inp)inp.value='';render();dyGroupReply(gid,t);}
function dyGroupMsgMenu(gid,mid){const g=dyGroup(gid),m=g&&dyGMsgs(g).find(x=>x.id===mid);if(!m)return;
  openModal(`<h3>这条消息</h3><div class="btns" style="flex-direction:column;gap:8px">
    <button class="dybtn out" onclick="dyGroupMsgCopy('${gid}','${mid}')">复制</button>
    <button class="btn d" onclick="dyGroupMsgDelete('${gid}','${mid}')">删除</button>
    <button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function dyGroupMsgCopy(gid,mid){const g=dyGroup(gid),m=g&&dyGMsgs(g).find(x=>x.id===mid);closeModal();if(!m)return;copyTextCompat(m.text||'').then(()=>toast('已复制'));}
function dyGroupMsgDelete(gid,mid){const g=dyGroup(gid);if(!g)return;g.msgs=dyGMsgs(g).filter(x=>x.id!==mid);save();closeModal();render();toast('已删除');}
/* ===== 群里谁开口 ===== */
function dyGroupTranscript(g,n){return dyGMsgs(g).slice(-n).map(m=>m.type==='sys'?('（'+String(m.text||'')+'）'):(dyGMemberName(dyGFind(g,m.k))+'：'+dyMsgPlain(m))).join('\n');}
/* ===== 群聊出场机制：主角＋配角 =====
   以前是「你一说话，必定 1～3 个人随机接」。现在按性格来：
   恋人是主角，你每次说话他一定接；管理员优先但有上限；其余的人靠
   「话痨度 + 有没有踩到他在意的话题 + 有没有被点名」打分，分不够就不说话，
   所以群里可以出现你说了一句、内向的人集体沉默的情况——那才像真的。 */
/* ===== 群管理：禁言 / 踢出 / 拉回 / 解禁 =====
   角色靠指令表达，规矩由代码硬卡——不信任模型：
   · 只有群主和管理员的指令才算数
   · 不能踢群主、不能踢管理员
   · 只有你的恋人能禁言你，别的管理员发了一律驳回
   · 被禁言的人这段时间不参与出场，也说不了话 */
function dyGMuteLeft(g,k){const m=dyGFind(g,k);if(!m)return 0;
  const t=+m.mutedUntil||0;if(!t)return 0;
  const left=t-Date.now();if(left<=0){if(m.mutedUntil){m.mutedUntil=0;m.mutedBy='';}return 0;}
  return left;}
function dyGMuteText(ms){ms=Math.max(0,+ms||0);const mins=Math.ceil(ms/60000);
  if(mins<60)return mins+' 分钟';
  const h=Math.floor(mins/60),m=mins%60;
  if(h<24)return h+' 小时'+(m?' '+m+' 分钟':'');
  return Math.floor(h/24)+' 天'+(h%24?' '+(h%24)+' 小时':'');}
function dyGKicked(g){if(!Array.isArray(g.kicked))g.kicked=[];return g.kicked;}
function dyGSys(g,text){dyGMsgs(g).push({id:uid(),type:'sys',text:String(text||''),time:Date.now()});}
function dyGFindByName(g,name){name=String(name||'').replace(/^@/,'').trim();if(!name)return null;
  if(name===(S.me.name||'我')||name===dyNick())return dyGFind(g,'me');
  let hit=dyGMemberList(g).find(m=>dyGMemberName(m)===name);
  if(!hit)hit=dyGMemberList(g).find(m=>dyGMemberName(m).indexOf(name)>=0);
  return hit||null;}
/* 一条指令能不能执行。返回 '' 表示可以，否则返回驳回的原因（只进日志，不给用户弹窗）。 */
function dyGCmdDeny(g,actorKey,kind,target){
  if(!dyGCanManage(g,actorKey))return '不是管理员';
  if(!target)return '找不到这个人';
  const tRole=dyGRole(g,target.k),actorM=dyGFind(g,actorKey);
  if(kind==='kick'){
    if(target.k==='me'||tRole==='owner')return '不能踢群主';
    if(tRole==='admin')return '不能踢管理员';
    return '';}
  if(kind==='mute'){
    if(target.k==='me'){
      const cid=S.couple&&S.couple.cid;
      if(!(actorM&&actorM.cid&&cid&&actorM.cid===cid))return '只有恋人能禁言群主';
      return '';}
    if(tRole==='owner')return '不能禁言群主';
    if(tRole==='admin'&&target.k!==actorKey)return '不能禁言管理员';
    return '';}
  if(kind==='unmute')return dyGMuteLeft(g,target.k)>0?'':'这个人没有被禁言';
  if(kind==='back')return dyGKicked(g).some(x=>x&&x.k===target.k)?'':'这个人不在被踢出的名单里';
  return '未知指令';}
/* ===== 角色在抖音群里把她禁言之后，去微信找她 =====
   她说「如果当时角色在抖音群给我禁言，他可以按照发生的事情和自己的性格来给我微信发来消息」。
   所以给他的不是一句干巴巴的通知，而是【当时群里真的发生了什么】——
   禁言前的那几句原话（她说的单独标出来），加上群名和禁多久；
   怎么说、是生气还是心疼、要不要先解禁，全按他自己的人设决定。 */
function dyGMuteContext(g,n){
  const rows=dyGMsgs(g).slice(-(n||10)).map(m=>{
    if(!m)return '';
    if(m.type==='sys')return '（系统）'+String(m.text||'').slice(0,60);
    const who=m.k==='me'?(S.me.name||'我'):dyGMemberName(dyGFind(g,m.k));
    const body=m.kind==='voice'?('[语音]'+String(m.text||'')):String(m.text||'');
    return (m.k==='me'?'【'+who+'】':who)+'：'+body.replace(/\s+/g,' ').slice(0,80);
  }).filter(Boolean);
  return rows.join('\n');}
function dyGMuteWechatFollowup(g,actorKey,mins){
  const actor=dyGFind(g,actorKey),cid=actor&&actor.cid,c=cid?getC(cid):null;
  if(!c||c.deleted||c.blocked)return false;
  if(typeof _call!=='undefined'&&_call)return false;              /* 正在通话就别插一脚 */
  if(S.jail&&S.jail.active)return false;
  const ctx=dyGMuteContext(g,10),gname=String(g&&g.name||'群聊').slice(0,30);
  const note='[系统：真实操作变化——你刚刚在抖音群「'+gname+'」里把'+(S.me.name||'她')
    +'禁言了 '+dyGMuteText(Math.max(1,mins)*60000)+'。这是你自己动的手，不是别人干的，也不是系统随机事件。\n'
    +'禁言前群里真的发生了这些（【】里是'+(S.me.name||'她')+'自己说的话）：\n'+(ctx||'（群里没留下什么记录）')+'\n'
    +'现在用微信私聊找ta，就这件事说话。按你自己的性格和你们此刻的关系决定态度：'
    +'可以是板着脸讲道理、可以是吃醋后的强势、可以是嘴上凶心里软、也可以是先哄再说，'
    +'但必须是【因为这件事】来的，不能装作什么都没发生，也不能凭空编造群里没发生过的事。'
    +'只发一到两句自然的微信，不要复述这段提示，不要写成系统通知或第三人称旁白。'
    +'如果你自己想通了要放过ta，可以在回复里单独一行写 [解禁] 真的把禁言解掉。]';
  return scheduleReply(c.id,note);}
function dyGCmdApply(g,actorKey,kind,name,minutes){
  const actorName=dyGMemberName(dyGFind(g,actorKey))||'管理员';
  let target=kind==='back'?(dyGKicked(g).find(x=>x&&(dyGMemberName(x)===String(name||'').replace(/^@/,'').trim()))||null):dyGFindByName(g,name);
  const deny=dyGCmdDeny(g,actorKey,kind,target);
  if(deny)return {ok:false,reason:deny};
  const tName=dyGMemberName(target);
  if(kind==='mute'){const mins=Math.max(1,Math.min(10080,parseInt(minutes,10)||60));
    const m=dyGFind(g,target.k);if(!m)return {ok:false,reason:'找不到这个人'};
    m.mutedUntil=Date.now()+mins*60000;m.mutedBy=actorKey;
    dyGSys(g,actorName+' 把 '+tName+' 禁言了 '+dyGMuteText(mins*60000));
    /* 被禁的是她、动手的是个角色 → 他会带着这件事去微信找她 */
    let wx=false;
    if(target.k==='me'&&actorKey!=='me')wx=dyGMuteWechatFollowup(g,actorKey,mins);
    return {ok:true,kind,target:target.k,name:tName,minutes:mins,wechat:wx};}
  if(kind==='unmute'){const m=dyGFind(g,target.k);if(!m)return {ok:false,reason:'找不到这个人'};
    m.mutedUntil=0;m.mutedBy='';
    dyGSys(g,actorName+' 解除了 '+tName+' 的禁言');
    return {ok:true,kind,target:target.k,name:tName};}
  if(kind==='kick'){const i=dyGMemberList(g).findIndex(m=>m.k===target.k);if(i<0)return {ok:false,reason:'找不到这个人'};
    const [gone]=g.members.splice(i,1);gone.kickedAt=Date.now();gone.kickedBy=actorKey;
    dyGKicked(g).unshift(gone);g.kicked=dyGKicked(g).slice(0,40);
    dyGSys(g,actorName+' 把 '+tName+' 移出了群聊');
    return {ok:true,kind,target:gone.k,name:tName};}
  if(kind==='back'){const i=dyGKicked(g).findIndex(x=>x&&x.k===target.k);if(i<0)return {ok:false,reason:'不在名单里'};
    const [come]=g.kicked.splice(i,1);come.kickedAt=0;come.kickedBy='';come.joinedAt=Date.now();
    dyGMemberList(g).push(come);
    dyGSys(g,actorName+' 把 '+tName+' 拉回了群聊');
    return {ok:true,kind,target:come.k,name:tName};}
  return {ok:false,reason:'未知指令'};}
/* 从一句话里把管理指令抠出来执行，返回剩下的可见文字。 */
/* 他在微信里想通了，单独一行写 [解禁] 就真的把她的禁言解掉——
   不用她再回抖音群里求一次 */
const DY_UNGAG_RE=/(^|\n)\s*[\[【]\s*解禁\s*[\]】]\s*(?=\n|$)/g;
/* 他在微信里写了 [解禁]：真的把她的禁言解掉，标签本身不会显示出来 */
function consumeDouyinUngag(content,c,audit){content=String(content||'');
  if(!c||!DY_UNGAG_RE.test(content))return content;
  DY_UNGAG_RE.lastIndex=0;
  const n=dyGUngagFromWechat(c.id);
  if(n){if(audit)audit.handled=true;toast('ta把你在抖音群里的禁言解了');if(cur().p==='dygroup')render();}
  else if(audit)audit.failed=true;
  return content.replace(DY_UNGAG_RE,'$1').replace(/\n{3,}/g,'\n\n').trim();}
function dyGUngagFromWechat(cid){const s=(S.dy&&S.dy.groups)||[];let n=0;
  for(const g of s){const me=dyGFind(g,'me');
    if(!me||dyGMuteLeft(g,'me')<=0)continue;
    const by=dyGFind(g,me.mutedBy);
    if(!by||by.cid!==cid)continue;                    /* 只能解他自己下的那道禁 */
    me.mutedUntil=0;me.mutedBy='';
    dyGSys(g,dyGMemberName(by)+' 解除了 '+(S.me.name||'我')+' 的禁言');n++;}
  if(n)save();
  return n;}
const DY_GCMD_RE=/[\[【]\s*(禁言|解禁|踢出|移出|拉回|请回)\s*[|｜]\s*([^|｜\]】]{1,24})(?:\s*[|｜]\s*([^\]】]{0,12}))?\s*[\]】]/g;
function dyGRunCommands(g,actorKey,text){text=String(text||'');let did=[];
  const out=text.replace(DY_GCMD_RE,(_,verb,who,extra)=>{
    const kind=verb==='禁言'?'mute':verb==='解禁'?'unmute':(verb==='踢出'||verb==='移出')?'kick':'back';
    const mins=String(extra||'').match(/\d+/);
    const r=dyGCmdApply(g,actorKey,kind,who,mins?mins[0]:60);
    if(r&&r.ok)did.push(r);
    return '';});
  return {text:out.replace(/\s{2,}/g,' ').trim(),did};}
/* 我被禁言了吗 */
function dyGMeMuted(g){return dyGMuteLeft(g,'me');}
function dyGMeMutedBy(g){const m=dyGFind(g,'me');return m&&m.mutedBy?m.mutedBy:'';}
function dyGNum(v,dflt,lo,hi){const n=parseInt(v,10);return Number.isFinite(n)&&n>0?Math.max(lo,Math.min(hi,n)):dflt;}
function dyGMaxSpeak(g){return dyGNum(g&&g.maxSpeak,3,1,6);}
function dyGMaxAdmin(g){return dyGNum(g&&g.maxAdmin,2,1,6);}
function dyGIdleHours(g){return dyGNum(g&&g.idleHours,3,1,24);}
function dyGIdleMax(g){return dyGNum(g&&g.idleMax,3,0,20);}
function dyGBubAdmin(g){return dyGNum(g&&g.bubAdmin,4,1,8);}
function dyGBubMember(g){return dyGNum(g&&g.bubMember,1,1,8);}
/* 话痨度 0～100：从人设里猜一次存下来，之后你随时能手动改。 */
const DY_TALKY=[[/(话痨|社牛|活泼|开朗|外向|热情|闹腾|嘴碎|爱说|健谈|逗|沙雕|抽风)/,88],
  [/(温柔|随和|好脾气|爱笑|暖)/,66],
  [/(内向|安静|话少|沉默|寡言|冷淡|高冷|清冷|闷|不爱说话|慢热|社恐)/,22],
  [/(严肃|正经|克制|寡淡|疏离)/,34]];
function dyGGuessTalk(text){text=String(text||'');for(const [re,v] of DY_TALKY)if(re.test(text))return v;return 55;}
function dyGPersonaText(m){if(!m)return '';if(m.cid){const c=getC(m.cid);return String((c&&c.persona)||'')+' '+String((c&&c.signature)||'');}return String(m.persona||'');}
function dyGTalk(m){if(!m)return 0;
  if(typeof m.talk!=='number'){m.talk=dyGGuessTalk(dyGPersonaText(m));}
  return Math.max(0,Math.min(100,m.talk));}
/* 他在意的词：踩中了，平时不说话的人也会冒出来。 */
const DY_CARE_SEED=[[/(吃|饭|饿|外卖|好吃|零食|甜|辣)/,['吃','饿','饭','外卖','好吃','零食']],
  [/(猫|狗|宠物|仓鼠)/,['猫','狗','宠物','仓鼠']],
  [/(游戏|打游戏|光遇|开黑)/,['游戏','开黑','上号']],
  [/(健身|运动|跑步|减肥)/,['健身','运动','跑步','减肥']],
  [/(睡|熬夜|困)/,['困','睡','熬夜']],
  [/(音乐|唱歌|听歌)/,['歌','音乐','耳机']],
  [/(学习|上班|工作|加班)/,['上班','加班','工作','累']]];
function dyGCare(m){if(!m)return [];
  if(!Array.isArray(m.care)){const t=dyGPersonaText(m),out=[];
    DY_CARE_SEED.forEach(([re,ws])=>{if(re.test(t))ws.forEach(w=>{if(out.indexOf(w)<0)out.push(w);});});
    m.care=out.slice(0,12);}
  return m.care;}
function dyGCareHit(m,text){text=String(text||'');const ws=dyGCare(m);
  for(const w of ws)if(w&&text.indexOf(w)>=0)return true;return false;}
function dyGLoverKey(g){const cid=S.couple&&S.couple.cid;if(!cid)return '';
  const m=dyGMemberList(g).find(x=>x&&x.cid===cid);return m?m.k:'';}
function dyGRecentCount(g,k){return dyGMsgs(g).slice(-6).filter(m=>m&&m.k===k&&m.type!=='sys').length;}
/* 排出这一轮谁开口、按什么顺序。forceKeys 是被 @ 或上一轮被点名的人。 */
function dyGCast(g,fromText,forceKeys){
  const muted=k=>dyGMuteLeft(g,k)>0;
  const pool=dyGMemberList(g).filter(m=>m&&m.k!=='me'&&!muted(m.k)&&!(m.cid&&(!getC(m.cid)||getC(m.cid).deleted)));
  if(!pool.length)return [];
  const force=new Set(forceKeys||[]);
  const lover=dyGLoverKey(g);
  const named=m=>fromText&&String(fromText).indexOf(dyGMemberName(m))>=0;
  const rows=pool.map(m=>{
    const admin=dyGRole(g,m.k)==='admin'||dyGRole(g,m.k)==='owner';
    /* 分数几乎全由话痨度决定：话痨的人经常上，内向的人光靠性格永远够不着门槛，
       只有踩中他在意的话题、被点名、或者是恋人，才会把他拽出来。 */
    let sc=dyGTalk(m)*(0.55+Math.random()*0.9)-dyGRecentCount(g,m.k)*18;
    if(admin)sc+=12;
    const hard=force.has(m.k)||named(m)||m.k===lover;/* 一定开口，连管理员上限都挡不住 */
    const soft=!hard&&dyGCareHit(m,fromText);/* 在意的话题：一定开口，但仍受人数上限 */
    return {m,admin,hard,soft,sc:hard?9999:(soft?5000:sc)};});
  rows.sort((a,b)=>b.sc-a.sc);
  const out=[];let adminN=0;
  const maxAll=dyGMaxSpeak(g),maxAdm=dyGMaxAdmin(g);
  for(const r of rows){
    if(out.length>=maxAll)break;
    if(!r.hard&&!r.soft&&r.sc<62)continue;/* 分不够就不说话，所以群里是可以冷场的 */
    if(r.admin){if(adminN>=maxAdm&&!r.hard)continue;adminN++;}
    out.push(r.m);}
  /* 恋人不一定非要第一个开口，第一第二都行，看起来更自然 */
  if(lover&&out.length>1){const i=out.findIndex(m=>m.k===lover);
    if(i>=0){const [lv]=out.splice(i,1);out.splice(Math.random()<.5?0:1,0,lv);}}
  return out;}
/* 告诉他自己是谁、能干什么。不说清楚他会去踢管理员，然后被代码驳回，看着很蠢。 */
/* 一条回复拆成一条条气泡，跟微信一样。管理员能连发 1～4 条，其余人一条就够——
   管理员是主角，话多是应该的；配角刷屏就吵了。 */
function dyGBubbleMax(g,m){const admin=dyGRole(g,m.k)==='admin'||dyGRole(g,m.k)==='owner';
  return admin?dyGBubAdmin(g):dyGBubMember(g);}
function dyGBubbleRule(g,m){const n=dyGBubbleMax(g,m);
  return n>1?('\n你可以一次说 1 到 '+n+' 条短消息，每条单独占一行用换行分开；平常一两条就够，情绪上来才多说几句。'
    +'\n要 @ 不同的人时，一条消息只 @ 一个人，分开成几条发——不要在同一条里同时 @ 好几个人。')
    :'\n只说一句，别分行。要 @ 人的话一条里只 @ 一个人。';}
/* 把模型写的一整段切成气泡：先按换行切，再把「一条里 @ 了好几个人」的那种拆开。 */
function dyGSplitAt(line){line=String(line||'').trim();if(!line)return [];
  const hits=[...line.matchAll(/@\s*[^\s，,。！!？?：:@]{1,16}/g)];
  if(hits.length<2)return [line];
  /* 从第二个 @ 开始，每个 @ 都另起一条 */
  const out=[];let last=0;
  hits.forEach((h,i)=>{if(i===0)return;
    const piece=line.slice(last,h.index).trim();if(piece)out.push(piece);last=h.index;});
  const tail=line.slice(last).trim();if(tail)out.push(tail);
  return out.length?out:[line];}
function dyGBubbles(g,m,raw){const t=String(raw||'').trim();if(!t)return [];
  const rows=t.split(/\n+/).map(x=>x.replace(/^[\d.、\-\s]*/,'').trim()).filter(Boolean);
  const out=[];
  (rows.length?rows:[t]).forEach(line=>{dyGSplitAt(line).forEach(x=>{if(x)out.push(x.slice(0,300));});});
  return out.slice(0,dyGBubbleMax(g,m));}
function dyGRoleBrief(g,m){const role=dyGRole(g,m.k),lover=dyGLoverKey(g)===m.k,me=S.me.name||'我';
  if(role!=='owner'&&role!=='admin')return '\n你在这个群里是普通成员，没有管理权限。';
  let s='\n你是这个群的管理员。群主是'+me+'。你可以禁言或移出【普通成员】，但不能踢群主，也不能踢或禁言其他管理员。';
  s+=lover?('\n你是'+me+'的恋人，所以只有你能禁言'+me+'本人——吃醋了、她太闹了、她说了让你不舒服的话，你都可以直接禁言她。'):('\n你不能禁言'+me+'，只有她的恋人可以。');
  s+='\n真要动手时，在你那句话里单独带上指令，系统会执行，指令本身不会显示出来：'
    +'\n[禁言|名字|分钟数]  [解禁|名字]  [踢出|名字]  [拉回|名字]'
    +'\n别没事就用，按你的性格来，平时就正常聊天。';
  return s;}
function dyGSceneBrief(g,m){const others=dyGMemberList(g).filter(x=>x.k!==m.k).map(x=>dyGMemberName(x)).join('、');
  return '\n\n# 场景\n你在抖音群聊「'+g.name+'」里说话，群主是'+(S.me.name||'我')+'，群里还有：'+others+'。'+(g.intro?'群简介：'+g.intro+'。':'')
    +dyGRoleBrief(g,m)
    +'\n口语、简短，像真的在群里接话。想跟谁说话就在开头写 @那个人的名字。'+dyGBubbleRule(g,m)
    +'\n别复述别人的话，别带方括号动作，别自报家门，别说自己是AI。只输出你要说的话。';}
function dyGroupSpeakerPrompt(g,m){
  if(m.cid){const c=getC(m.cid);if(c)return buildSystem(c)+dyGSceneBrief(g,m);}
  return '你是抖音用户「'+dyGMemberName(m)+'」。'+(dyGMemberPersona(m)||'一个普通网友。')+dyGSceneBrief(g,m);}
/* 网友合并成一次调用：他们本来就是氛围组，一次生成出来的几句话互相衔接得更自然，
   而且一轮能省下好几次调用——以后开好几个群，这个差距很明显。 */
function dyGCrowdPrompt(g,crowd){
  const roster=crowd.map(m=>'· '+dyGMemberName(m)+'：'+(dyGMemberPersona(m).replace(/\s+/g,' ').slice(0,600)||'一个普通网友')+'（'+(dyGRole(g,m.k)==='admin'?'管理员':'普通成员')+'）').join('\n');
  return '你在给一个抖音群聊写这一轮几个人的台词。群名「'+g.name+'」，群主是'+(S.me.name||'我')+'。'
    +(g.intro?'群简介：'+g.intro+'。':'')
    +'\n\n这一轮要说话的人（严格按这个顺序，一人一行）：\n'+roster
    +'\n\n要求：每行格式是「名字：这个人说的话」，一人只写一行，一两句就够。一条里最多 @ 一个人。'
    +'\n每个人说的话必须像他自己的人设，别写成一个人的口气。想跟谁说话就在话里写 @那个人的名字。'
    +'\n口语、有网感，别带方括号动作，别复述别人的话，别自报家门，别说自己是AI，别写编号。'
    +'\n管理员可以在自己那行带上 [禁言|名字|分钟数]、[踢出|名字]、[解禁|名字]、[拉回|名字]，但不能动群主和其他管理员，也别没事就用。';}
function dyGCrowdParse(crowd,raw){const out={};
  String(cleanReply(raw)||'').split(/\n+/).forEach(line=>{
    const t=line.replace(/^[\d.、\-\s]*/,'').trim();if(!t)return;
    const m=t.match(/^([^：:]{1,20})[：:]\s*(.+)$/);if(!m)return;
    const who=m[1].trim(),said=m[2].trim();
    const hit=crowd.find(x=>dyGMemberName(x)===who)||crowd.find(x=>{const c=x.cid&&typeof getC==='function'?getC(x.cid):null;return !!c&&(c.name===who||c.remark===who);})||crowd.find(x=>dyGMemberName(x).indexOf(who)>=0);/* 合并进来的角色，模型可能写本名也可能写备注 */
    if(hit&&said&&!out[hit.k])out[hit.k]=said.slice(0,160);});
  return out;}
function dyGAtKeys(g,text){const out=[];String(text||'').replace(/@\s*([^\s，,。！!？?：:@]{1,16})/g,(_,n)=>{
  const hit=dyGFindByName(g,n);if(hit&&hit.k!=='me'&&out.indexOf(hit.k)<0)out.push(hit.k);return '';});return out;}
/* 收到消息的提示音。现合成一个柔和的「叮～」：两个正弦音叠一起、指数衰减，
   不用音频文件，所以不占安装包体积、也不用联网。 */
let _dyDingCtx=null,_dyDingAt=0;
function dyDingOn(){return !(S.settings&&S.settings.dyDing===false);}
function dyDing(){if(!dyDingOn())return;
  const now=Date.now();if(now-_dyDingAt<380)return;/* 连着几条消息只响一次，不然像敲木鱼 */
  _dyDingAt=now;
  try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    if(!_dyDingCtx)_dyDingCtx=new AC();
    const ctx=_dyDingCtx;if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const t0=ctx.currentTime,gain=ctx.createGain();
    gain.gain.setValueAtTime(0.0001,t0);
    gain.gain.exponentialRampToValueAtTime(0.14,t0+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001,t0+0.62);
    gain.connect(ctx.destination);
    [[1318.5,1],[1975.5,0.35]].forEach(([hz,mix])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine';o.frequency.setValueAtTime(hz,t0);
      g.gain.setValueAtTime(mix,t0);o.connect(g);g.connect(gain);
      o.start(t0);o.stop(t0+0.66);});
  }catch(_){}}
function dyGPush(g,m,text){const t=String(text||'').trim();if(!t)return false;
  dyGMsgs(g).push({id:uid(),k:m.k,text:t.slice(0,300),time:Date.now()});dyDing();
  if(!(_dySub==='group'&&_dyGid===g.id))g.unread=(+g.unread||0)+1;
  save();if(_dySub==='group'&&_dyGid===g.id)render();return true;}
async function dyGroupReply(gid,fromText){if(_dyGBusy[gid])return;_dyGBusy[gid]=true;
  try{let force=[],text=fromText;
    for(let round=0;round<2;round++){
      const said=await dyGroupReplyRun(gid,text,force);
      if(!said||!said.length)break;
      const g=dyGroup(gid);if(!g)break;
      force=[];said.forEach(x=>{dyGAtKeys(g,x.text).forEach(k=>{if(force.indexOf(k)<0&&!said.some(y=>y.k===k))force.push(k);});});
      if(!force.length)break;
      text=said.map(x=>x.text).join(' ');}}
  finally{delete _dyGBusy[gid];}}
/* 抖音群：每个人可以单独调用模型（完整人设、一个人一次请求），也可以合并进一次请求（几个人一起写，快、省）。
   默认角色单独、网友合并，和以前一样。 */
function dyGCallSolo(g,m){const map=g&&g.callSolo;if(map&&typeof map==='object'&&m&&Object.prototype.hasOwnProperty.call(map,m.k))return !!map[m.k];return !!(m&&m.cid);}
function dyGCallSummary(g){const ms=dyGMemberList(g).filter(m=>m.k!=='me'),n=ms.filter(m=>dyGCallSolo(g,m)).length;return n+'人单独 · '+(ms.length-n)+'人合并';}
function dyGCallSetup(gid){const g=dyGroup(gid);if(!g)return;const ms=dyGMemberList(g).filter(m=>m.k!=='me');
  openModal(`<h3>模型调用</h3><div class="hint">单独：这个人自己一次请求，完整人设，最像本人。合并：几个人一次请求一起写，快、省调用。</div><div class="section">${ms.map(m=>{const solo=dyGCallSolo(g,m);return `<div class="it"><span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">${dyFace(dyGMemberAvatar(m),'sm')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(dyGMemberName(m))}${m.cid?'<small style="color:#888;margin-left:6px">角色</small>':''}</span></span><button type="button" class="minibtn dyg-call-chip" style="background:${solo?'#fe2c55':'#2c2c2e'};color:${solo?'#fff':'#ccc'};min-width:56px" onclick="dyGCallToggle('${gid}','${m.k}',this)">${solo?'单独':'合并'}</button></div>`;}).join('')||'<div class="hint" style="padding:10px">群里还没有别人</div>'}</div><button class="btn g" style="margin-top:10px" onclick="closeModal();render()">完成</button>`);}
function dyGCallToggle(gid,k,el){const g=dyGroup(gid);if(!g)return;const m=dyGFind(g,k);if(!m)return;g.callSolo=g.callSolo&&typeof g.callSolo==='object'?g.callSolo:{};g.callSolo[k]=!dyGCallSolo(g,m);save();if(el){const on=g.callSolo[k];el.textContent=on?'单独':'合并';el.style.background=on?'#fe2c55':'#2c2c2e';el.style.color=on?'#fff':'#ccc';}}
async function dyGroupReplyRun(gid,fromText,forceKeys){const g0=dyGroup(gid);if(!g0||g0.aiOn===false)return [];
  const cast=dyGCast(g0,fromText,forceKeys);if(!cast.length)return [];
  const said=[];let crowdLines=null;
  for(const m of cast){
    await sleep(700+Math.random()*900);
    const g=dyGroup(gid);if(!g)return said;
    if(!dyGFind(g,m.k))continue;/* 这一轮里已经被踢出去了，就不能再说话 */
    if(dyGMuteLeft(g,m.k)>0)continue;/* 这一轮里被别人禁言了，就闭嘴 */
    dyTypingOn('g:'+gid);
    try{
      let line='';
      if(dyGCallSolo(g,m)){
        const r=await dyAuxChat([{role:'system',content:dyGroupSpeakerPrompt(g,m)},
          {role:'user',content:'群里刚才说了这些：\n'+dyGroupTranscript(g,dyChatCtxRows(g))+'\n\n现在轮到你，说一句。'}],{max:dyReplyBudget()});
        line=cleanReply(r).replace(/^[^：:]{1,12}[：:]\s*/,'');
      }else{
        if(!crowdLines){/* 第一个网友开口时才生成，这样他们能接住前面角色说的话 */
          const crowd=cast.filter(x=>!dyGCallSolo(g,x)&&dyGFind(g,x.k)&&dyGMuteLeft(g,x.k)<=0);
          const r=await dyAuxChat([{role:'system',content:dyGCrowdPrompt(g,crowd)},
            {role:'user',content:'群里刚才说了这些：\n'+dyGroupTranscript(g,dyChatCtxRows(g))+'\n\n按上面的名单和顺序，每人写一行。'}],{max:Math.max(240,dyReplyBudget())});
          crowdLines=dyGCrowdParse(crowd,r);}
        line=crowdLines[m.k]||'';}
      const ran=dyGRunCommands(g,m.k,line);
      const parts=dyGBubbles(g,m,ran.text);
      if(parts.length){for(let bi=0;bi<parts.length;bi++){
        if(bi)await sleep(380+Math.random()*620);/* 一条一条冒出来，不要糊成一坨 */
        const live=dyGroup(gid);if(!live)return said;
        if(dyGPush(live,m,parts[bi]))said.push({k:m.k,text:parts[bi]});}}
      else if(ran.did.length){save();if(_dySub==='group'&&_dyGid===gid)render();}
    }catch(e){dyModelFail('群里的人接话',e);return said;}
    finally{dyTypingOff('g:'+gid);}}
  return said;}
/* 群里自己活起来：隔太久没人说话，你一打开群就有人冒泡。每天有次数上限，不会烧钱。 */
function dyGIdleState(g){const day=dyApplyDayKey();
  if(g.idleDay!==day){g.idleDay=day;g.idleCount=0;}
  return g;}
async function dyGroupIdleChat(gid){const g=dyGroup(gid);if(!g||g.aiOn===false||_dyGBusy[gid])return;
  dyGIdleState(g);
  if((+g.idleCount||0)>=dyGIdleMax(g))return;
  const rows=dyGMsgs(g).filter(m=>m&&m.type!=='sys');
  const last=rows.length?(+rows[rows.length-1].time||0):0;
  if(!last)return;/* 一句话都没有的新群先不自己聊 */
  if(Date.now()-last<dyGIdleHours(g)*3600000)return;
  g.idleCount=(+g.idleCount||0)+1;g.lastIdleAt=Date.now();save();
  await dyGroupReply(gid,'');}
/* ===== 群设置 ===== */
function dyOpenGroupInfo(id){_dyGid=id;_dySub='ginfo';render();}
function dyGRow(label,value,act,arrow){return `<div class="dyg-row"${act?` onclick="${act}"`:''}><span>${esc(label)}</span><b>${value||''}</b>${arrow===false?'':'<i>›</i>'}</div>`;}
function dyGSwitch(label,on,act){return `<div class="dyg-row"><span>${esc(label)}</span><i class="dyg-sw${on?' on':''}" onclick="${act}"></i></div>`;}
function dyGroupInfoView(){const g=dyGroup(_dyGid);if(!g)return `<div class="dyvi"><div class="dyvi-nav"><i onclick="dySubClose()">‹</i><b>聊天信息</b><span></span></div><div class="dyvi-empty">这个群已经不在了</div></div>`;
  const ms=dyGMemberList(g),owner=dyGCanManage(g,'me');
  return `<div class="dyvi" style="background:#0b0b0c">
    <div class="dyvi-nav dy-safe-nav2"><i onclick="dyGInfoBack()">‹</i><b>聊天信息</b><em style="width:21px"></em></div>
    <div class="dyvi-list" data-render-scroll-key="dyg:info:${esc(g.id)}">
      <div class="dyg-card dyg-head">
        <div class="dyg-head-top">${av(g.avatar||'👥','lg')}<div class="dyg-head-txt"><b>${esc(g.name)}</b><span onclick="dyGCopyNum('${g.id}')">群号码：${esc(g.gnum||'')} ⧉</span></div><i class="dyg-qr" onclick="toast('群二维码还没做～')">${svgIc('idcard',20,'#d4d4da',2)}</i></div>
        <div class="dyg-head-acts"><span onclick="dyGShare('${g.id}')">${svgIc('forward',18,'#e6e6ea',2)} 分享群聊</span><em></em><span onclick="dyGRecruit('${g.id}')">${svgIc('image',18,'#e6e6ea',2)} 发作品招募</span></div>
      </div>
      <div class="dyg-card">
        <div class="dyg-row" onclick="dyOpenGMembers('${g.id}')"><span>群聊成员</span><b>${ms.length}/500</b><i>›</i></div>
        <div class="dyg-mems">${ms.slice(0,3).map(m=>`<div class="dyg-mem">${dyFace(dyGMemberAvatar(m),'sm')}<span>${esc(dyGMemberName(m))}</span></div>`).join('')}
          <div class="dyg-mem" onclick="dyGInvite('${g.id}')"><div class="dyg-mem-btn">＋</div><span>邀请</span></div>
          ${owner?`<div class="dyg-mem" onclick="dyGRemoveMember('${g.id}')"><div class="dyg-mem-btn">－</div><span>移除</span></div>`:''}</div>
      </div>
      <div class="dyg-card">
        <div class="dyg-row"><span>群数据</span><b>${g.open?'公开群':'私密群'}</b><i></i></div>
        <div class="dyg-stats"><div><b>${dyGCount(g)}</b><span>群成员</span></div><div><b>${dyApplies().filter(a=>a.gid===g.id&&a.state==='passed').length}</b><span>加群人数</span></div><div><b>${dyApplies().filter(a=>a.gid===g.id&&a.state==='expired').length}</b><span>被忽略</span></div></div>
      </div>
      ${owner?`<div class="dyg-card">
        <div class="dyg-row"><span>群管理</span><b></b><i></i></div>
        <div class="dyg-manage">
          ${[['users','设置管理员',"dyGAdmins('"+g.id+"')"],['user','移除群成员',"dyGRemoveMember('"+g.id+"')"],['lock','禁言 / 解除',"dyGMuteMember('"+g.id+"')"],['refresh','被移出的人',"dyGKickedList('"+g.id+"')"],['lock',g.open?'转为私密群':'转为公开群',"dyGOpenToggle('"+g.id+"')"],['file','加群管理',"dyOpenActs('群通知')"]].map(x=>`<div class="dyg-mg" onclick="${x[2]}">${svgIc(x[0],23,'#e6e6ea',1.8)}<span>${esc(x[1])}</span></div>`).join('')}
        </div></div>`:''}
      <div class="dyg-card">
        <div class="dyg-row"><span>群名称与头像</span><b onclick="dyGRename('${g.id}')">${esc(g.name)}</b><i class="dyg-avbtn" onclick="changeDyGroupAvatar('${g.id}')">${av(g.avatar||'\u{1F465}','sm')}</i><i onclick="dyGRename('${g.id}')">›</i></div>
        ${dyGRow('群简介',esc(g.intro||'还没写'),`dyGIntro('${g.id}')`)}
        ${dyGRow('群公告',esc(String(g.notice||'还没写').slice(0,18)),`dyGNotice('${g.id}')`)}
        ${dyGRow('我在本群的昵称',esc(g.myNick||S.me.name||''),`dyGMyNick('${g.id}')`)}
      </div>
      <div class="dyg-card">${dyGRow('模型调用',dyGCallSummary(g),`dyGCallSetup('${g.id}')`)}</div>
      <div class="dyg-card">${dyGRow('群聊 AI',g.aiOn===false?'已关闭':'已开启',`dyGToggle('${g.id}','aiOn')`)}
        ${dyGRow('上下文条数',dyChatCtxRows(g)+' 条',`dyChatCtxEdit('group','${g.id}')`)}
        ${dyGRow('说话的规矩',dyGMaxSpeak(g)+' 人/轮 · 管理员 '+dyGMaxAdmin(g)+' · 冷场 '+dyGIdleHours(g)+'h',`dyGCastEdit('${g.id}')`)}
        ${dyGRow('一次几条气泡','管理员 '+dyGBubAdmin(g)+' · 成员 '+dyGBubMember(g),`dyGCastEdit('${g.id}')`)}
        ${dyGRow('回复长度',dyReplyBudget()+' token · 跟设置里的线上聊天','toast(\'去 设置 → API 路线 改「回复长度（线上聊天）」，抖音跟着它走\')')}</div>
      <div class="dyg-card">${dyGRow('查找聊天内容','',`dyGSearch('${g.id}')`)}</div>
      <div class="dyg-card">
        ${dyGSwitch('消息免打扰',!!g.mute,`dyGToggle('${g.id}','mute')`)}
        ${dyGSwitch('折叠群聊',!!g.fold,`dyGToggle('${g.id}','fold')`)}
        ${dyGSwitch('置顶聊天',!!g.top,`dyGToggle('${g.id}','top')`)}
      </div>
      <div class="dyg-card">
        ${dyGRow('清空聊天记录','',`dyGClear('${g.id}')`)}
      </div>
      <div class="dyg-card dyg-danger" onclick="dyGDisband('${g.id}')"><span>解散群聊</span><i>⊖</i></div>
      <div style="height:26px"></div>
    </div></div>`;}
function dyGInfoBack(){if(_dyGid&&dyGroup(_dyGid)){_dySub='group';_dyGTab='聊天';render();}else dySubClose();}
function dyGCopyNum(gid){const g=dyGroup(gid);if(!g)return;copyTextCompat(g.gnum||'').then(()=>toast('群号码已复制'));}
function dyGShare(gid){const g=dyGroup(gid);if(!g)return;const cs=(S.contacts||[]).filter(c=>!c.deleted);if(!cs.length)return toast('还没有角色可以分享');
  openModal(`<h3>分享群聊</h3><div style="max-height:44vh;overflow:auto">${cs.map(c=>`<div class="row" onclick="dyGShareTo('${gid}','${c.id}')" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${av(dyRA(c.id,c.avatar),'sm')}<b style="flex:1;font-size:14px;font-weight:500">${esc(c.remark||c.name)}</b></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function dyGShareTo(gid,cid){const g=dyGroup(gid),c=getC(cid);closeModal();if(!g||!c)return;
  openDyDMName(c.remark||c.name,cid,c.avatar);const d=(S.dy.dms||[]).find(x=>x.cid===cid);
  if(d){d.msgs.push({from:'me',text:'[群聊分享] '+g.name+'（'+dyGCount(g)+'人）',time:Date.now()});save();}toast('已分享');}
function dyGRecruit(gid){const g=dyGroup(gid);if(!g)return;dyGMsgs(g).push({id:uid(),type:'sys',text:'群主发起了一次作品招募',time:Date.now()});save();render();toast('已在群里发起招募');}
function dyGMembersPage(gid){const g=dyGroup(gid);if(!g)return;const ms=dyGMemberList(g);
  openModal(`<h3>群聊成员（${ms.length}）</h3><div style="max-height:48vh;overflow:auto">${ms.map(m=>{const r=dyGRole(g,m.k);
    return `<div class="row" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${dyFace(dyGMemberAvatar(m),'sm')}<span style="flex:1;min-width:0"><b style="display:block;font-size:14px">${esc(dyGMemberName(m))}</b><small style="color:#888">${r==='owner'?'群主':r==='admin'?'管理员':(m.cid?'角色':'网友')}${dyPersonBio({k:m.k,cid:m.cid||''})?' · '+esc(dyPersonBio({k:m.k,cid:m.cid||''}).slice(0,22)):''}</small></span></div>`;}).join('')}</div>
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
function dyGInvite(gid){const g=dyGroup(gid);if(!g)return;const inside=new Set(dyGMemberList(g).map(m=>m.k));
  const cs=(S.contacts||[]).filter(c=>!c.deleted&&!inside.has('c:'+c.id));if(!cs.length)return toast('角色都已经在群里了');
  openModal(`<h3>邀请进群</h3><div style="max-height:46vh;overflow:auto">${cs.map(c=>`<div class="row" onclick="dyGInviteDo('${gid}','${c.id}')" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${av(dyRA(c.id,c.avatar),'sm')}<b style="flex:1;font-size:14px;font-weight:500">${esc(c.remark||c.name)}</b></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function dyGInviteDo(gid,cid){const g=dyGroup(gid),c=getC(cid);if(!g||!c)return;
  dyGMemberList(g).push({k:'c:'+cid,cid,role:'member',joinedAt:Date.now()});
  dyGMsgs(g).push({id:uid(),type:'sys',text:(S.me.name||'我')+' 邀请 '+(c.remark||c.name)+' 加入了群聊，新成员可查看历史消息',time:Date.now()});
  save();closeModal();render();toast('已邀请进群');}
/* 你自己动手禁言、放人、拉回被踢的人 */
function dyGMuteMember(gid){const g=dyGroup(gid);if(!g||!dyGCanManage(g,'me'))return toast('只有群主和管理员可以禁言');
  const ms=dyGMemberList(g).filter(m=>m.k!=='me');if(!ms.length)return toast('群里没有别人');
  openModal(`<h3>禁言 / 解除</h3><div style="max-height:46vh;overflow:auto">${ms.map(m=>{const left=dyGMuteLeft(g,m.k);
    return `<div class="row" onclick="${left>0?`dyGUnmuteDo('${gid}','${esc(m.k)}')`:`dyGMutePick('${gid}','${esc(m.k)}')`}" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${dyFace(dyGMemberAvatar(m),'sm')}<b style="flex:1;font-size:14px;font-weight:500">${esc(dyGMemberName(m))}</b><span style="font-size:13px;color:${left>0?'#f1c40f':'#888'}">${left>0?'禁言中 '+esc(dyGMuteText(left))+' · 点击解除':'点击禁言'}</span></div>`;}).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function dyGMutePick(gid,k){const g=dyGroup(gid),m=g&&dyGFind(g,k);if(!g||!m)return;
  const opts=[['10 分钟',10],['1 小时',60],['12 小时',720],['1 天',1440],['7 天',10080]];
  openModal(`<h3>禁言 ${esc(dyGMemberName(m))}</h3><div class="btns" style="flex-direction:column;gap:8px">
    ${opts.map(o=>`<button class="dybtn out" onclick="dyGMuteDo('${gid}','${esc(k)}',${o[1]})">${o[0]}</button>`).join('')}
    <button class="btn g" onclick="closeModal()">取消</button></div>`);}
function dyGMuteDo(gid,k,mins){const g=dyGroup(gid),m=g&&dyGFind(g,k);if(!g||!m)return;
  const r=dyGCmdApply(g,'me','mute',dyGMemberName(m),mins);
  if(!r||!r.ok)return toast(r&&r.reason||'不能这么做');
  save();closeModal();render();toast('已禁言 '+dyGMuteText(mins*60000));}
function dyGUnmuteDo(gid,k){const g=dyGroup(gid),m=g&&dyGFind(g,k);if(!g||!m)return;
  const r=dyGCmdApply(g,'me','unmute',dyGMemberName(m));
  if(!r||!r.ok)return toast(r&&r.reason||'不能这么做');
  save();closeModal();render();toast('已解除禁言');}
function dyGKickedList(gid){const g=dyGroup(gid);if(!g)return;const ks=dyGKicked(g);
  if(!ks.length)return toast('还没有踢出过谁');
  openModal(`<h3>被移出的人（${ks.length}）</h3><div style="max-height:46vh;overflow:auto">${ks.map(m=>`<div class="row" onclick="dyGBackDo('${gid}','${esc(m.k)}')" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${dyFace(dyGMemberAvatar(m),'sm')}<span style="flex:1;min-width:0"><b style="display:block;font-size:14px">${esc(dyGMemberName(m))}</b><small style="color:#888">${esc(dyTimeAgo(m.kickedAt))}被 ${esc(dyGMemberName(dyGFind(g,m.kickedBy))||'管理员')} 移出</small></span><span style="color:#2a5cff;font-size:13px">拉回来</span></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function dyGBackDo(gid,k){const g=dyGroup(gid);if(!g)return;
  const gone=dyGKicked(g).find(x=>x&&x.k===k);if(!gone)return;
  const r=dyGCmdApply(g,'me','back',dyGMemberName(gone));
  if(!r||!r.ok)return toast(r&&r.reason||'拉不回来');
  save();closeModal();render();toast('已经拉回来了');}
/* 这个群一轮最多几个人开口、管理员占几个、多久自己聊一次、一天自己聊几次 */
function dyGCastEdit(gid){const g=dyGroup(gid);if(!g)return;
  openModal(`<h3>群里说话的规矩</h3><div class="hint">恋人是主角，你每次说话他一定接。其余的人按性格和话题决定要不要开口，分不够就不说话——所以群里是可以冷场的。</div>
    <div class="field"><label>一轮最多几个人开口</label><input id="dyg_max" type="number" min="1" max="6" value="${dyGMaxSpeak(g)}"></div>
    <div class="field"><label>其中管理员最多几个</label><input id="dyg_adm" type="number" min="1" max="6" value="${dyGMaxAdmin(g)}"></div>
    <div class="field"><label>冷场多少小时后自己聊起来</label><input id="dyg_idle" type="number" min="1" max="24" value="${dyGIdleHours(g)}"></div>
    <div class="field"><label>一天最多自己聊几次（0＝不自己聊）</label><input id="dyg_idlen" type="number" min="0" max="20" value="${dyGIdleMax(g)}"></div>
    <div class="hint" style="margin-top:10px">下面这两个是「一个人一次能连发几条气泡」。填 1 就是一次只说一句。</div>
    <div class="field"><label>管理员一次最多几条气泡</label><input id="dyg_buba" type="number" min="1" max="8" value="${dyGBubAdmin(g)}"></div>
    <div class="field"><label>普通成员一次最多几条气泡</label><input id="dyg_bubm" type="number" min="1" max="8" value="${dyGBubMember(g)}"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyGCastSave('${gid}')">保存</button></div>`);}
