function gPayExtras(it,g){const parts=String(it.note||'').split(/[|｜]/).map(x=>x.trim());if(parts.length<2||!g)return it;const last=parts[parts.length-1];
  if(it.type==='redpacket'){if(parts.length>=3){const nm=last.replace(/^[@＠]/,''),hit=[S.me.name,'我','你','群主'].includes(nm)?'me':(g.members||[]).find(id=>{const c=getC(id);return c&&[gnm(g,id),c.name,c.remark].filter(Boolean).includes(nm);});if(hit){it.to=hit;parts.pop();}}const n=parseInt(parts[parts.length-1].replace(/个$/,''),10);if(/^\d{1,3}个?$/.test(parts[parts.length-1])&&n>=1){it.count=Math.min(n,GRP_MAX_COUNT);it.note=parts.slice(0,-1).join(' ');}return it;}
  const nm=last.replace(/^[@＠]/,''),me=[S.me.name,'我','你','群主'].includes(nm),hit=me?'me':(g.members||[]).find(id=>{const c=getC(id);return c&&[gnm(g,id),c.name,c.remark].filter(Boolean).includes(nm);});
  if(hit){it.to=hit;it.note=parts.slice(0,-1).join(' ');}return it;}
// 把群回复解析成「一条条」的消息项（文字气泡 + 红包/转账卡片），文字条数封顶
function gParseReply(content,cap,recent,g){const out=[];let txt=0;let pq=null;
  splitBubbles(content).forEach(l=>{l=normTag(l);if(!l)return;
    let qm=l.match(/^\[\s*引用\s*[|｜:：]?\s*(\d{1,2})\s*\]$/);if(qm){const rm=recent&&recent[+qm[1]-1];pq=rm&&rm.senderId!=='me'?{who:gName(rm,g),senderId:rm.senderId,text:gmText(rm)||''}:null;return;}
    const pay=parsePayCardLine(l);if(pay){out.push(gPayExtras({type:pay.type,amount:pay.amount,note:pay.note,received:false},g));return;}
    let m=l.match(/^\[\s*转账\s*\|\s*([0-9.]+)\s*\|?\s*([^\]]*)\]$/);if(m){out.push({type:'transfer',amount:+m[1]||0,note:(m[2]||'').trim(),received:false});return;}
    m=l.match(/^\[\s*红包\s*\|\s*([0-9.]+)\s*\|?\s*([^\]]*)\]$/);if(m){out.push({type:'redpacket',amount:+m[1]||0,note:(m[2]||'').trim(),received:false});return;}
    if(LEAKRE.test(l))return;// 别把别的指令标签当消息发出来
    splitActions(l).forEach(p=>{if(txt>=cap)return;p=(p||'').replace(/^(@[^\s@]+\s*)+/,'').trim();if(!p||/^@\S+$/.test(p))return;/* 丢掉纯@xxx气泡 */const it={type:'text',content:p};if(pq){it.q=pq;pq=null;}out.push(it);txt++;});
  });
  return out;}
const _aiGroupReplyQueues=new Map();
function aiGroupReply(id,fromText){const previous=_aiGroupReplyQueues.get(id)||Promise.resolve(),task=previous.catch(()=>{}).then(()=>aiGroupReplyRun(id,fromText)).catch(()=>{});_aiGroupReplyQueues.set(id,task);task.then(()=>{if(_aiGroupReplyQueues.get(id)===task)_aiGroupReplyQueues.delete(id);});return task;}
function groupRoleReplyNickname(content,g,c){return String(content||'').replace(/[\[【]\s*群昵称\s*[\|｜:：]\s*([^\]】]{1,16})[\]】]/g,(mm,nn)=>{const nv=(nn||'').trim();if(nv){g.nicks=g.nicks||{};g.nicks[c.id]=nv;save();}return '';});}
const GROUP_SILENT_RE=/[\[【]\s*(?:不说话|不回|沉默|潜水)\s*[\]】]/;
/* 管理员角色在群里动手：[禁言|名字|分钟] [解禁|名字] [踢出|名字]。权限按 gmCanActOn 校验，没权限就当没写。 */
function groupRoleAdminTags(g,c,content){const find=nm=>{nm=String(nm||'').replace(/[「」『』"'《》@\s]/g,'').trim();if(!nm)return'';if(nm===String(S.me.name||'').replace(/\s/g,'')||nm===String(gnm(g,'me')).replace(/\s/g,'')||/^(群主|我老婆|我老公)$/.test(nm))return'me';const hit=g.members.find(cid=>{const x=getC(cid);if(!x)return false;return [gnm(g,cid),x.name,x.remark].filter(Boolean).some(n=>{n=String(n).replace(/\s/g,'');return n===nm||nm.includes(n)||n.includes(nm);});});return hit||'';};
  return String(content||'').replace(/[\[【]\s*(禁言|解禁|踢出|移出)\s*[\|｜:：]\s*([^\]】\|｜]{1,20})(?:\s*[\|｜:：]\s*(\d{1,5}))?\s*[\]】]/g,(mm,act,nm,mins)=>{const target=find(nm);if(!target)return'';
    if(act==='禁言')gmMute('role',g.id,c.id,target,Math.max(1,Math.min(43200,+mins||10)));else if(act==='解禁')gmMute('role',g.id,c.id,target,0);else gmKick('role',g.id,c.id,target);return'';});}
function groupRoleTurnText(pcap,opt){opt=opt||{};const n=Math.max(1,+pcap||1),range=n>1?'1 到 '+n:'1';
  const mood=opt.first?'你是'+S.me.name+'最亲近的人，这句话你第一个接，按你们的关系自然回ta。':opt.temper==='quiet'?'你性格话少、慢热，群里很多时候只看不说：只在想说的时候说一句短的；实在不想接就只输出 [不说话]。':opt.temper==='lively'?'你爱说话、爱凑热闹，可以多接几句、接群友的梗、起哄。':'按你平时在群里的样子，想接就接。';
  const topic=opt.cares?'这句话正好说到你在意的事，可以多说一点。':'';
  return '[轮到你在群里说话了。看看上面大家（包括其他群友互相）说了啥，自然接话——回'+S.me.name+'、或接群友的话拌嘴起哄都行。'+mood+topic+'要专门回应某条就用 [引用|序号]，别@人、别跟别人说一样的话。最多回 '+range+' 条短消息。]';}
async function groupRoleReplyItems(g,c,recent,pcap,opt){opt=opt||{};const sys=buildSystem(c,{query:(recent||[]).slice(-6).map(m=>gmText(m)).join(' ')})+gContext(g,c,recent),turn=groupRoleTurnText(pcap,opt);let previous='';for(let attempt=0;attempt<2;attempt++){try{const request=[{role:'system',content:sys},{role:'user',content:turn}];if(attempt){if(previous)request.push({role:'assistant',content:previous.slice(0,1200)});request.push({role:'user',content:'[上一版没有形成可发送的群聊消息。请仍由你本人根据当前群聊上下文重新回复一次，只输出1到'+Math.max(1,+pcap||1)+'条自然短消息；不要解释失败，不要输出空白或系统提示。]'});}let content=roleVisibleEnvelopeText(await chatAPI(request,Object.assign({max:380,complete:true},opt.route!=null?{routeIndex:opt.route,independentRoleModel:true}:{})));previous=String(content||'');content=groupRoleReplyNickname(content,g,c);if(typeof groupRoleAdminTags==='function')content=groupRoleAdminTags(g,c,content);if(typeof relConsumeTags==='function')content=relConsumeTags(content,c);const items=gParseReply(content.replace(GROUP_SILENT_RE,''),pcap,recent,g);if(items.length)return items;/* 自己选择不开口：安静就是回答，不再追问一遍。 */if(!opt.first&&GROUP_SILENT_RE.test(content))return[];if(opt.why&&!GROUP_SILENT_RE.test(content))opt.why.push(previous.trim()?'回复里没有能发出来的内容（'+previous.trim().replace(/\s+/g,' ').slice(0,40)+'）':'模型返回了空内容');}catch(e){if(opt.why)opt.why.push((e&&e.message)||String(e||'请求失败'));}}return[];}
/* 群聊像真群：情侣空间绑定的那位先开口；其他人按性格（社恐话少、活跃话多）和这句话是否戳中ta在意的事，决定说不说、说几句。 */
const GROUP_QUIET_RE=/社恐|内向|沉默寡言|寡言|话少|少言|不爱说话|高冷|冷淡|慢热|腼腆|害羞|闷葫芦|惜字如金/;
const GROUP_LIVELY_RE=/话痨|活泼|开朗|外向|热情|健谈|爱说话|吵闹|闹腾|自来熟|社牛|嘴碎|碎碎念|八卦|爱凑热闹|咋咋呼呼/;
const GROUP_TOPIC_STOP=new Set(['你们','我们','他们','什么','怎么','今天','一下','这个','那个','就是','没有','不是','可以','知道','觉得','现在','真的','还是','然后','因为','所以','一个','自己','大家','哈哈']);
function groupRoleTemper(c){const s=String(c&&c.persona||'')+' '+String(c&&c.desc||'');return GROUP_LIVELY_RE.test(s)?'lively':GROUP_QUIET_RE.test(s)?'quiet':'normal';}
function groupRoleCares(c,text){const persona=String(c&&c.persona||'')+' '+String(c&&c.desc||'');if(!persona.trim())return false;for(const run of String(text||'').match(/[一-龥]{2,}/g)||[])for(let i=0;i+2<=run.length;i++){const w=run.slice(i,i+2);if(!GROUP_TOPIC_STOP.has(w)&&persona.includes(w))return true;}return false;}
function groupReplyPlan(g,members,fromText,rand){rand=rand||Math.random;const cap=Math.max(1,+g.msgMax||2),lo=Math.max(1,Math.min(cap,+g.msgMin||1)),coupleId=S.couple&&S.couple.cid,text=String(fromText||''),plan=[];
  /* 群设置里给某个角色单独定了条数：这个数就是ta这一轮的上限，不再被「话痨多一条」之类的性格加成顶过去。 */
  const own=c=>{const n=Math.floor(+(g.roleMsgMax&&g.roleMsgMax[c.id])||0);return n>0?Math.min(20,n):0;};
  const pick=(c,forced)=>{const temper=groupRoleTemper(c),cares=groupRoleCares(c,text),chance=forced?1:Math.min(.97,(temper==='lively'?.9:temper==='quiet'?.3:.62)+(cares?.35:0));if(rand()>=chance)return null;
    let n=lo+Math.floor(rand()*(cap-lo+1));if(temper==='quiet')n=cares?Math.min(2,cap):1;else if(temper==='lively')n=Math.min(cap+1,n+(cares?1:0));else if(cares)n=Math.min(cap,n+1);const mine=own(c);if(mine)n=mine;return{c,cap:Math.max(1,n),temper,cares};};
  /* 被点名 / @ 的人先回（按在这句话里出现的先后），然后才是情侣角色；没点名就情侣角色先回。名字、备注、群昵称都算点名。 */
  const where=c=>{if(!text)return -1;const names=[c.name,c.remark,typeof gnm==='function'?gnm(g,c.id):''].filter(n=>n&&String(n).trim().length);let at=-1;names.forEach(n=>{const i=text.indexOf(String(n).trim());if(i>=0&&(at<0||i<at))at=i;});return at;};
  const couple=members.find(c=>c.id===coupleId),mentioned=members.filter(c=>where(c)>=0).sort((a,b)=>where(a)-where(b)),rest=members.filter(c=>c!==couple&&mentioned.indexOf(c)<0).sort(()=>rand()-.5);
  mentioned.forEach(c=>plan.push(pick(c,true)));if(couple&&mentioned.indexOf(couple)<0)plan.push(pick(couple,true));
  /* 其余人里活跃的、被戳中话题的往前排；社恐的排后面，常常不开口。 */
  const others=rest.map(c=>pick(c,false)).filter(Boolean).sort((a,b)=>(b.cares-a.cares)||((b.temper==='lively')-(a.temper==='lively'))||((a.temper==='quiet')-(b.temper==='quiet')));
  /* 情侣角色不在群里、也没人被点名时，至少留一个人接话，不让整群冷场。 */
  if(!plan.length&&!others.length&&rest.length)others.push(pick(rest[0],true));
  return plan.filter(Boolean).concat(others);}
const _groupTyping={};
function groupTypingHTML(g,cid){const c=getC(cid);if(!c)return'';return `<div class="msg them group-typing${g.hideNames?'':' gnamed'}" id="gtyping">${av(c.avatar,groupBubbleAvatarClass(g,cid))}<div class="col">${g.hideNames?'':`<div class="gname">${esc(gnm(g,cid))}</div>`}<div class="bubble typing"><span></span><span></span><span></span></div></div></div>`;}
function groupTypingSet(g,cid){if(cid)_groupTyping[g.id]=cid;else delete _groupTyping[g.id];if(cur().p!=='group'||cur().id!==g.id)return;const cb=$('#chatbg');if(!cb)return;const old=$('#gtyping');if(old)old.remove();if(!cid)return;const stick=nearBottom(cb);cb.insertAdjacentHTML('beforeend',groupTypingHTML(g,cid));if(stick)cb.scrollTop=cb.scrollHeight;}
/* 把一个角色这一轮的几条消息依次发进群里 */
async function gEmitRoleItems(g,c,items){const id=g.id;let first=true;
  for(const it of items){
    if(!first)await sleep(420+Math.random()*560);first=false;
    it.senderId=c.id;it.role='assistant';it.time=Date.now();it.id=uid();if(it.type==='redpacket')gRpPrepareRole(g,it);if(it.type==='transfer'&&(!it.to||it.to===c.id))it.to='me';g.msgs.push(it);save();if(it.type==='redpacket')gRpRoleGrabs(g.id,it.id);if(it.type==='transfer'&&it.to!=='me')gRoleTransferAccept(g.id,it.id);
    if(S.settings.sound&&!c.muted&&!g.muted)playMessageDing();// 每条角色群消息都使用用户指定的提示音；群免打扰时不响
    if(cur().p==='group'&&cur().id===id){const cb=$('#chatbg');if(cb){const stick=nearBottom(cb);cb.insertAdjacentHTML('beforeend',gbubble(g,it));if(stick)chatPinBottom(cb);}}
  }
  gNotify(g,c);}
/* ===== 角色群：单独调用 / 合并调用 =====
   单独调用：每个角色一次请求，完整人设，走角色自己设置的路线（和私聊一样）。
   合并调用：这一轮里所有「合并」的角色一次请求一起写，快很多，用当前选中的路线。默认情侣角色单独、其他人合并。 */
function gCallSolo(g,cid){const m=g&&g.callSolo;if(m&&typeof m==='object'&&Object.prototype.hasOwnProperty.call(m,cid))return !!m[cid];return !!(S.couple&&S.couple.cid===cid);}
function gCallSoloToggle(gid,cid,el){const g=S.groups.find(x=>x.id===gid);if(!g)return;g.callSolo=g.callSolo&&typeof g.callSolo==='object'?g.callSolo:{};g.callSolo[cid]=!gCallSolo(g,cid);save();if(el){el.classList.toggle('on',g.callSolo[cid]);el.textContent=g.callSolo[cid]?'单独':'合并';}}
function gBatchNames(g,c){return [gnm(g,c.id),c.name,c.remark].filter(Boolean).map(String);}
function gBatchPrompt(g,batch,recent){const me=S.me.name;
  const people=batch.map(e=>{const c=e.c,admin=(g.admins||[]).includes(c.id),mood=e.temper==='quiet'?'话少慢热，很多时候只看不说，不想接就 [不说话]':e.temper==='lively'?'爱说话爱凑热闹，可以多接几句':'按平时在群里的样子';
    const fam=typeof relLinksOf==='function'?relLinksOf(c.id).slice(0,12).map(v=>(v.otherIsMy||'熟人')+relPromptName(v.other)+(relStatus(v.other)?'（'+relStatus(v.other)+'）':'')).join('、'):'';
    return '## '+gnm(g,c.id)+(c.name!==gnm(g,c.id)?'（本名'+c.name+'）':'')+(fam?'\n家人朋友：'+fam:'')+'\n人设：'+String(c.persona||c.desc||'（没写人设，按名字和群里的表现自然来）').replace(/\s+/g,' ').slice(0,700)+'\n这轮：'+mood+(e.cares?'；这句话说到ta在意的事，可以多说点':'')+'；最多 '+Math.max(1,+e.cap||1)+' 条'+(admin?'\n'+gnm(g,c.id)+'是管理员，可以在自己那段里单独一行写 [禁言|名字|分钟] [解禁|名字] [踢出|名字]（不能动群主'+me+'）':'');}).join('\n\n');
  return '你同时扮演下面这几个角色，在群里轮流说话。每个人都要按自己的人设和说话方式来，不能串味、不能说一样的话，也不要每个人都只对着'+me+'说。\n\n'+people
    +'\n\n# 输出格式（严格遵守）\n按顺序给每个人写一段，每段第一行单独写【名字】，下面是这个人要发的消息，每条一行。某个人这轮不想说话，那段就只写 [不说话]。\n例子：\n【'+gnm(g,batch[0].c.id)+'】\n[引用|3]\n第一条\n第二条\n'+(batch[1]?'【'+gnm(g,batch[1].c.id)+'】\n[不说话]\n':'')
    +gContext(g,{id:'__batch__'},recent);}
async function groupBatchReplyItems(g,batch,recent,why){const out=new Map();if(!batch.length)return out;
  const sys=gBatchPrompt(g,batch,recent),turn='[轮到这几个人在群里说话了：'+batch.map(e=>gnm(g,e.c.id)).join('、')+'。按上面的格式，给每个人各写一段。]';
  /* 合并调用用这一批里第一个人自己的路线（和他单独调用、私聊一致），不再用全局当前路线 */
  const route=typeof roleChatRouteIndex==='function'?roleChatRouteIndex(batch[0].c):null;
  let raw='';try{raw=roleVisibleEnvelopeText(await chatAPI([{role:'system',content:sys},{role:'user',content:turn}],Object.assign({max:Math.min(1400,260+batch.length*220),complete:true},route!=null?{routeIndex:route,independentRoleModel:true}:{})));}catch(e){why.push((e&&e.message)||'请求失败');out.failed=true;return out;}
  const sections=new Map();let curId=null;const lines=String(raw||'').split(/\r?\n/);
  const find=name=>{name=String(name||'').trim();const hit=batch.find(e=>gBatchNames(g,e.c).includes(name));return hit?hit.c.id:null;};
  lines.forEach(l=>{const h=l.trim().match(/^[【\[]\s*([^\]】|｜]{1,24})\s*[】\]]\s*[:：]?\s*$/);const hid=h&&find(h[1]);if(hid){curId=hid;if(!sections.has(hid))sections.set(hid,[]);return;}if(h&&!/^(?:引用|不说话|不回|沉默|潜水|红包|转账|禁言|解禁|踢出|群昵称)/.test(h[1].trim())){curId=null;return;}/* 这轮没轮到的人写的段落，不能算到上一个人头上 */
    const pre=l.trim().match(/^([^:：\s]{1,24})\s*[:：]\s*(.+)$/),pid=pre&&find(pre[1]);if(pid){curId=pid;if(!sections.has(pid))sections.set(pid,[]);sections.get(pid).push(pre[2]);return;}
    if(curId)sections.get(curId).push(l);});
  if(!sections.size&&batch.length===1&&String(raw||'').trim())sections.set(batch[0].c.id,lines);
  for(const e of batch){let content=(sections.get(e.c.id)||[]).join('\n').trim();if(!content)continue;content=groupRoleReplyNickname(content,g,e.c);if(typeof groupRoleAdminTags==='function')content=groupRoleAdminTags(g,e.c,content);if(typeof relConsumeTags==='function')content=relConsumeTags(content,e.c);if(GROUP_SILENT_RE.test(content)&&!content.replace(GROUP_SILENT_RE,'').trim())continue;
    const items=gParseReply(content.replace(GROUP_SILENT_RE,''),Math.max(1,+e.cap||1),recent,g);if(items.length)out.set(e.c.id,items);}
  if(!out.size&&String(raw||'').trim()&&!GROUP_SILENT_RE.test(raw))why.push('合并调用的回复没有按格式分给每个人（'+String(raw).replace(/\s+/g,' ').slice(0,40)+'）');
  return out;}
function groupTotalCap(g){const n=Math.floor(+(g&&g.totalMax)||0);return n>0?n:Infinity;}
async function aiGroupReplyRun(id,fromText){const g=S.groups.find(x=>x.id===id);if(!g)return;
  const allowed=(g.responders&&g.responders.length)?g.responders:g.members;
  const mutes=gmMutes('role',id),members=allowed.map(x=>getC(x)).filter(c=>c&&!c.deleted&&!c.blocked&&g.members.includes(c.id)&&!mutes[c.id]);if(!members.length)return;/* 被禁言、被踢出的角色这轮不说话 */
  const plan=groupReplyPlan(g,members,fromText),why=[],handled=new Set();let spoke=0;
  /* 每轮总条数上限：所有角色这一轮加起来不能超过它。left 为 Infinity 表示没设上限。 */
  let left=groupTotalCap(g);const take=items=>{items=items.slice(0,Math.max(0,left));left-=items.length;return items;};
  for(let i=0;i<plan.length;i++){if(left<=0)break;const entry=plan[i],{c,temper,cares}=entry,pcap=Math.min(entry.cap,left);if(handled.has(c.id))continue;await sleep((temper==='quiet'?900:450)+Math.random()*750);
    if(!g.members.includes(c.id)||gmMutedUntil('role',id,c.id)){handled.add(c.id);continue;}/* 这一轮里刚被管理员禁言或踢出的，不再开口 */
    try{const recent=g.msgs.slice(-14),before=g.msgs.length;
      if(gCallSolo(g,c.id)){handled.add(c.id);/* 单独调用：完整人设，走这个角色自己设置的路线 */
        groupTypingSet(g,c.id);let items;try{items=await groupRoleReplyItems(g,c,recent,pcap,{temper,cares,first:c.id===(S.couple&&S.couple.cid),why,route:typeof roleChatRouteIndex==='function'?roleChatRouteIndex(c):null});}finally{groupTypingSet(g,null);}
        if(g.msgs.length!==before&&cur().p==='group'&&cur().id===id)render();/* 管理员动了手（禁言/踢人），系统提示和输入框状态立刻刷新 */
        items=take(items);if(!items.length)continue;// 模型选择不开口，或两次都没有有效内容时保持安静，不伪造角色回复
        spoke++;await gEmitRoleItems(g,c,items);continue;}
      /* 合并调用：从这里往后所有「合并」的角色一次请求一起写，按原来的先后顺序一个个发出来 */
      let batch=plan.slice(i).filter(e=>!handled.has(e.c.id)&&!gCallSolo(g,e.c.id)&&g.members.includes(e.c.id)&&!gmMutedUntil('role',id,e.c.id));batch.forEach(e=>handled.add(e.c.id));
      /* 合并调用前先按剩余额度给每个人分条数，排在后面、已经没有额度的人这一轮不开口 */
      if(left!==Infinity){let room=left;batch=batch.filter(e=>{e.cap=Math.min(e.cap,room);room-=Math.max(0,e.cap);return e.cap>0;});if(!batch.length)continue;}
      groupTypingSet(g,c.id);let got;try{got=await groupBatchReplyItems(g,batch,recent,why);}finally{groupTypingSet(g,null);}
      if(g.msgs.length!==before&&cur().p==='group'&&cur().id===id)render();
      if(got.failed){/* 合并那一次请求失败了：别让这几个人都不说话，退回每人单独调用 */
        for(const e of batch){if(left<=0)break;if(!g.members.includes(e.c.id)||gmMutedUntil('role',id,e.c.id))continue;groupTypingSet(g,e.c.id);let items;try{items=await groupRoleReplyItems(g,e.c,g.msgs.slice(-14),Math.min(e.cap,left),{temper:e.temper,cares:e.cares,first:e.c.id===(S.couple&&S.couple.cid),why,route:typeof roleChatRouteIndex==='function'?roleChatRouteIndex(e.c):null});}finally{groupTypingSet(g,null);}items=take(items);if(items.length){spoke++;await gEmitRoleItems(g,e.c,items);}}
        continue;}
      let firstRole=true;for(const e of batch){const items=take(got.get(e.c.id)||[]);if(!items.length)continue;if(!firstRole){groupTypingSet(g,e.c.id);await sleep(700+Math.random()*900);groupTypingSet(g,null);}firstRole=false;spoke++;await gEmitRoleItems(g,e.c,items);}
    }catch(e){why.push((e&&e.message)||'群回复出错');}}
  /* 一个人都没回、又不是大家选择沉默：把原因说出来，别只闪一下三个点就没了 */
  if(!spoke&&why.length){g.replyFail={at:Date.now(),why:why[why.length-1]};save();toast('群里没人回上：'+String(why[why.length-1]).slice(0,80),5200);}else if(spoke&&g.replyFail){delete g.replyFail;save();}}
function groupInfo(id){const g=S.groups.find(x=>x.id===id);const resp=g.responders||g.members.slice();
  openModal(`<h3>群设置</h3>
  <div class="field"><label>群头像</label><div class="avline">${g.avatar?av(g.avatar,'sm'):'<div class="avatar sm" style="background:#7c6cc0">👥</div>'}<button class="minibtn" onclick="gAvatar('${id}')">从相册选</button></div></div>
  <div class="field"><label>群名称</label><input id="gn" value="${esc(g.name)}"></div>
  <div class="field"><label>谁会回复（不选=全部都回）</label><div id="grsp">${g.members.map(cid=>{const c=getC(cid);return c?`<span class="minibtn" id="gr_${cid}" style="margin:2px;background:${resp.indexOf(cid)>=0?'#07c160':'#2c2c2e'};color:${resp.indexOf(cid)>=0?'#fff':'#ccc'}" onclick="gToggleResp('${id}','${cid}',this)">${esc(c.name)}</span>`:'';}).join('')}</div></div>
  <div class="two"><div class="field"><label>每人回复最少</label><input id="g_min" type="number" min="1" value="${g.msgMin||1}"></div><div class="field"><label>最多</label><input id="g_max" type="number" min="1" value="${g.msgMax||2}"></div></div>
  <div class="field"><label>群昵称（留空=用本名；角色也会自己改着玩）</label>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="width:64px;flex:0 0 auto;font-size:13px;color:#bbb">${esc(S.me.name)}(我)</span><input id="gnick_me" value="${esc((g.nicks&&g.nicks.me)||'')}" placeholder="我的群昵称" style="flex:1"></div>
    ${g.members.map(cid=>{const c=getC(cid);return c?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="width:64px;flex:0 0 auto;font-size:13px;color:#bbb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span><input id="gnick_${cid}" value="${esc((g.nicks&&g.nicks[cid])||'')}" placeholder="ta的群昵称" style="flex:1"></div>`:'';}).join('')}
  </div>
  <button class="btn p" style="margin-bottom:8px;background:#7d688f" onclick="closeModal();groupBubbleList('${id}')">群聊气泡美化（每个人单独设置）</button>
  <button class="btn p" style="margin-bottom:8px;background:#19a463" onclick="closeModal();groupRels('${id}')">群关系网（结构化设置·谁和谁什么关系）</button>
  <div class="field"><label>补充关系（自由文字，选填）</label><textarea id="g_rel" rows="2" placeholder="也可以直接打一段，例如：两个人是死对头，都喜欢同一个人。">${esc(g.relations||'')}</textarea></div>
  <button class="btn p" style="margin-bottom:8px" onclick="saveGroup('${id}')">保存设置</button>
  <button class="btn g" style="margin-bottom:8px" onclick="g_addMember('${id}')">＋ 拉人进群</button>
  <button class="btn g" style="margin-bottom:8px" onclick="clearGroupMsgs('${id}')">清空群聊记录</button>
  <button class="btn d" onclick="askConfirm('解散群聊？',()=>{S.groups=S.groups.filter(x=>x.id!=='${id}');save();closeModal();back()},{danger:true})">解散群聊</button>
  <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
/* ===== 聊天信息页（照真微信，角色群与真人群共用；原来的群设置弹窗保留为「群管理」）===== */
function pfGroupPref(gid){const p=phoneFriendState();p.groupPrefs=p.groupPrefs||{};return p.groupPrefs[gid]||(p.groupPrefs[gid]={});}
function groupDisplayName(g){return (g&&(g.remark||g.name))||'群聊';}
function ginfoTarget(kind,id){
  if(kind==='pf'){const g=pfGroupById(id)||{group_id:id,name:'小手机群聊',members:[]},p=phoneFriendState(),pref=pfGroupPref(id),owner=pfGroupIsOwner(g),ms=(Array.isArray(g.members)?g.members:[]);
    const people=[{html:av(S.me.avatar),name:S.me.name||'我'}].concat(ms.filter(m=>pfKeyOf(m)!==p.id).map(m=>({html:pfAvatarHTML(m),name:pfGroupMemberName(g,m)})));
    return{kind,id,g,pref,count:Math.max(people.length,+(g.member_count||0)),people,name:g.name||'小手机群聊',remark:(p.groupRemarks||{})[id]||'',notice:pref.notice||'',muted:!!pref.muted,pinned:!!(pref.pinned||g.pinned),saved:!!pref.saved,myNick:S.me.name||'',showNames:!pref.hideNames,chatBg:pref.chatBg||'',canRemove:owner||gmIsAdmin('pf',id,p.id),owner};}
  const g=S.groups.find(x=>x.id===id)||{id,name:'群聊',members:[],msgs:[]};
  const people=[{html:av(S.me.avatar),name:gnm(g,'me')}].concat(g.members.map(cid=>{const c=getC(cid);return c?{html:av(c.avatar,groupBubbleAvatarClass(g,cid)),name:gnm(g,cid)}:null;}).filter(Boolean));
  return{kind:'role',id,g,count:g.members.length+1,people,name:g.name,remark:g.remark||'',notice:g.notice||'',muted:!!g.muted,pinned:!!g.pinned,saved:!!g.savedContact,myNick:(g.nicks&&g.nicks.me)||S.me.name||'',showNames:!g.hideNames,chatBg:g.chatBg||'',canRemove:g.members.length>0,owner:true};}
function ginfoOpen(kind,id){go('ginfo',{kind,id});}
function ginfoRow(label,value,action,opt){opt=opt||{};return `<button type="button" class="ginfo-row${opt.danger?' danger':''}${opt.center?' center':''}${opt.plain?' plain':''}" onclick="${action}"><span class="ginfo-label">${label}</span>${value!=null?`<span class="ginfo-value">${value}</span>`:''}${opt.center?'':'<span class="ginfo-chev" aria-hidden="true">›</span>'}</button>`;}
function ginfoSwitch(label,on,action){return `<div class="ginfo-row" onclick="${action}"><span class="ginfo-label">${label}</span><span class="sw ginfo-sw ${on?'on':''}" role="switch" aria-checked="${on?'true':'false'}"></span></div>`;}
function renderGroupInfoPage(kind,id){const t=ginfoTarget(kind,id),k=`'${kind}','${id}'`,qr=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>`;
  const grid=t.people.map(x=>`<div class="ginfo-member">${x.html}<span>${esc(x.name)}</span></div>`).join('')
    +`<button type="button" class="ginfo-member ginfo-add" onclick="ginfoAddMember(${k})" aria-label="添加成员"><i>＋</i><span></span></button>`
    +(t.canRemove?`<button type="button" class="ginfo-member ginfo-add" onclick="ginfoRemoveMember(${k})" aria-label="移出成员"><i>－</i><span></span></button>`:'');
  const gap='<div class="ginfo-gap"></div>';
  return `<div class="ginfo-page"><div class="nav ginfo-nav"><span class="l" onclick="back()">‹</span><span class="t">聊天信息(${t.count})</span><span class="r" onclick="ginfoSearch(${k})" aria-label="查找聊天内容">${svgIc('search',20,'currentColor')}</span></div>
  <div class="scroll ginfo-scroll"><section class="ginfo-grid">${grid}</section>${gap}
  <section class="ginfo-group">${ginfoRow('群聊名称',esc(t.name),`ginfoRename(${k})`)}${ginfoRow('群二维码',qr,`go('gqr',{kind:'${kind}',id:'${id}'})`)}${ginfoRow('群公告',t.notice?esc(t.notice.slice(0,14))+(t.notice.length>14?'…':''):'未设置',`ginfoNotice(${k})`)}${ginfoRow('群管理','',`go('gmanage',{kind:'${kind}',id:'${id}'})`)}${ginfoRow('备注',t.remark?esc(t.remark):'',`ginfoRemark(${k})`)}</section>${gap}
  <section class="ginfo-group">${ginfoRow('查找聊天内容','',`ginfoSearch(${k})`)}</section>${gap}
  ${kind==='pf'&&typeof pfRoleInfoRow==='function'?pfRoleInfoRow(id)+gap:''}
  <section class="ginfo-group">${ginfoSwitch('消息免打扰',t.muted,`ginfoToggle(${k},'muted')`)}${ginfoSwitch('置顶聊天',t.pinned,`ginfoToggle(${k},'pinned')`)}${ginfoSwitch('保存到通讯录',t.saved,`ginfoToggle(${k},'saved')`)}</section>${gap}
  <section class="ginfo-group">${ginfoRow('我在本群的昵称',esc(t.myNick),`ginfoMyNick(${k})`)}${ginfoSwitch('显示群成员昵称',t.showNames,`ginfoToggle(${k},'showNames')`)}</section>${gap}
  <section class="ginfo-group">${ginfoRow('设置当前聊天背景',t.chatBg?'已设置':'',`ginfoBg(${k})`)}</section>${gap}
  <section class="ginfo-group">${ginfoRow('清空聊天记录',null,kind==='pf'?`phoneFriendClearGroup('${id}')`:`clearGroupMsgs('${id}')`,{plain:true})}</section>${gap}
  <section class="ginfo-group">${ginfoRow('投诉','',`toast('已收到，小手机不会把群聊内容发到任何地方')`)}</section>${gap}
  <section class="ginfo-group">${ginfoRow(kind==='pf'&&t.owner?'解散群聊':'退出群聊',null,`ginfoLeave(${k})`,{danger:true,center:true})}</section><div class="ginfo-end"></div></div></div>`;}
function ginfoToggle(kind,id,key){if(kind==='pf'){const pref=pfGroupPref(id);if(key==='showNames')pref.hideNames=!pref.hideNames;else pref[key]=!pref[key];}
  else{const g=S.groups.find(x=>x.id===id);if(!g)return;if(key==='saved')g.savedContact=!g.savedContact;else if(key==='showNames')g.hideNames=!g.hideNames;else g[key]=!g[key];}save();render();}
function ginfoRename(kind,id){if(kind==='pf'){toast('群名称由群主设置；你可以在「备注」里给这个群起自己的名字');return;}const g=S.groups.find(x=>x.id===id);if(!g)return;openModal(`<h3>群聊名称</h3><div class="field"><input id="gi_name" value="${esc(g.name)}" maxlength="30"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="(function(){var g=S.groups.find(function(x){return x.id==='${id}'});var v=$('#gi_name').value.trim();if(v){g.name=v;save();}closeModal();render();})()">保存</button></div>`);}
function ginfoRemark(kind,id){if(kind==='pf'){phoneFriendGroupRemark(id);return;}const g=S.groups.find(x=>x.id===id);if(!g)return;openModal(`<h3>备注</h3><div class="hint">备注只有你自己看得到，会显示在聊天列表和群聊标题上。</div><div class="field"><input id="gi_remark" value="${esc(g.remark||'')}" maxlength="30" placeholder="给这个群起个备注"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="(function(){var g=S.groups.find(function(x){return x.id==='${id}'});var v=$('#gi_remark').value.trim();if(v)g.remark=v;else delete g.remark;save();closeModal();render();})()">保存</button></div>`);}
function ginfoNotice(kind,id){const t=ginfoTarget(kind,id);openModal(`<h3>群公告</h3><div class="hint">${kind==='pf'?'只保存在你这台小手机上，其他成员看不到。':'群里的角色都会看到公告，并按公告说话。'}</div><div class="field"><textarea id="gi_notice" rows="5" maxlength="500" placeholder="例如：本群只报备bug，禁止闲聊">${esc(t.notice)}</textarea></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="ginfoNoticeSave('${kind}','${id}')">保存</button></div>`);}
function ginfoNoticeSave(kind,id){const v=String(($('#gi_notice')||{}).value||'').trim().slice(0,500);if(kind==='pf'){const pref=pfGroupPref(id);if(v)pref.notice=v;else delete pref.notice;}else{const g=S.groups.find(x=>x.id===id);if(!g)return;if(v)g.notice=v;else delete g.notice;}save();closeModal();render();toast(v?'群公告已保存':'已清空群公告');}
function ginfoMyNick(kind,id){if(kind==='pf'){toast('真人群里的昵称跟随你的小手机好友昵称');return;}const g=S.groups.find(x=>x.id===id);if(!g)return;openModal(`<h3>我在本群的昵称</h3><div class="hint">昵称修改后，只会在此群内显示，群内成员都可以看见。</div><div class="field"><input id="gi_nick" value="${esc((g.nicks&&g.nicks.me)||'')}" maxlength="16" placeholder="${esc(S.me.name||'')}"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="(function(){var g=S.groups.find(function(x){return x.id==='${id}'});g.nicks=g.nicks||{};var v=$('#gi_nick').value.trim().slice(0,16);if(v)g.nicks.me=v;else delete g.nicks.me;save();closeModal();render();})()">保存</button></div>`);}
function ginfoBg(kind,id){openModal(`<h3>设置当前聊天背景</h3><div class="hint">只改这个群的聊天背景。</div><div class="btns"><button class="btn g" onclick="ginfoBgSet('${kind}','${id}','')">恢复默认</button><button class="btn p" onclick="pickFile('image/*',async f=>{ginfoBgSet('${kind}','${id}',await compressChatBackground(f));})">选图片</button></div>`);}
function ginfoBgSet(kind,id,src){if(kind==='pf'){const pref=pfGroupPref(id);if(src)pref.chatBg=src;else delete pref.chatBg;}else{const g=S.groups.find(x=>x.id===id);if(!g)return;if(src)g.chatBg=src;else delete g.chatBg;}save();closeModal();render();toast(src?'背景已设置':'已恢复默认');}
function ginfoQr(kind,id){const t=ginfoTarget(kind,id);openModal(`<h3>群二维码</h3><div style="text-align:center;padding:10px 0 4px"><div style="font-weight:600;margin-bottom:12px">${esc(groupDisplayName(t))}（${t.count}）</div><div style="width:190px;height:190px;margin:0 auto;border-radius:10px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="150" height="150" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg></div><div class="hint" style="margin-top:12px">${kind==='pf'?'邀请好友请用「＋」，从小手机好友里直接拉进群。':'角色群只在你的小手机里，拉人请用「＋」。'}</div></div><button class="btn g" onclick="closeModal()">关闭</button>`);}
function ginfoAddMember(kind,id){_gpick={kind,id,mode:'add',sel:[],q:''};go('gpick',{kind,id,mode:'add'});}
function ginfoRemoveMember(kind,id){_gpick={kind,id,mode:'remove',sel:[],q:''};go('gpick',{kind,id,mode:'remove'});}
/* ===== 群管理：群主设最多 3 个管理员；群主和管理员可以禁言、踢人（管理员能管除群主以外的任何人，包括别的管理员）。
   角色群里我是群主；只有和我是情侣关系的管理员角色才可以禁言我。 ===== */
const GROUP_ADMIN_MAX=3;
function gmGroup(kind,id){return kind==='pf'?pfGroupById(id):S.groups.find(x=>x.id===id);}
function gmMeKey(kind){return kind==='pf'?phoneFriendState().id:'me';}
function gmOwnerKey(kind,id){if(kind==='pf'){const g=pfGroupById(id);return (''+(g&&g.owner_id||'')).toUpperCase();}return 'me';}
function gmAdmins(kind,id){const src=kind==='pf'?pfGroupPref(id).admins:(gmGroup(kind,id)||{}).admins;return Array.isArray(src)?src.slice(0,GROUP_ADMIN_MAX):[];}
function gmMutes(kind,id){const holder=kind==='pf'?pfGroupPref(id):gmGroup(kind,id);if(!holder)return{};const m=holder.mutes&&typeof holder.mutes==='object'?holder.mutes:{},now=Date.now();Object.keys(m).forEach(k=>{if(!(+m[k]>now))delete m[k];});holder.mutes=m;return m;}
function gmMutedUntil(kind,id,key){return +(gmMutes(kind,id)[key]||0);}
function gmIsOwner(kind,id){return kind==='pf'?gmOwnerKey(kind,id)===phoneFriendState().id:true;}
function gmIsAdmin(kind,id,key){return gmAdmins(kind,id).includes(key);}
function gmCanManage(kind,id){return gmIsOwner(kind,id)||gmIsAdmin(kind,id,gmMeKey(kind));}
/* actor 能不能对 target 动手：群主谁都能管（除了自己）；管理员只能管普通成员；情侣管理员角色额外可以禁言群主（我）。 */
function gmCanActOn(kind,id,actor,target,action){if(!target||actor===target)return false;const owner=gmOwnerKey(kind,id);if(actor===owner)return true;if(!gmIsAdmin(kind,id,actor))return false;
  if(target===owner)return kind==='role'&&action==='mute'&&!!(S.couple&&S.couple.cid===actor);return true;}/* 管理员可以禁言、踢任何人（包括别的管理员），只有群主动不了 */
function gmMemberName(kind,id,key){if(kind==='pf'){const g=pfGroupById(id)||{members:[]};if(key===phoneFriendState().id)return S.me.name||'我';return pfGroupMemberName(g,pfGroupMemberById(g,key)||{phone_id:key});}const g=gmGroup(kind,id);return gnm(g,key);}
function gmMinutesText(ms){const m=Math.max(1,Math.ceil((ms-Date.now())/60000));return m>=1440?Math.ceil(m/1440)+'天':m>=60?Math.ceil(m/60)+'小时':m+'分钟';}
function gmSys(kind,id,text){if(kind==='role'){const g=gmGroup(kind,id);if(g)g.msgs.push({senderId:'me',type:'sys',content:text,time:Date.now(),id:uid()});}}
function gmSetAdmins(kind,id,list){list=[...new Set(list)].filter(Boolean).slice(0,GROUP_ADMIN_MAX);
  if(kind==='pf'){if(!gmIsOwner(kind,id)){toast('只有群主可以设置管理员');return false;}pfGroupPref(id).admins=list;save();sendPhoneFriendGroupBody(id,pfPack({type:'group_admins',admins:list}),{silent:true});return true;}
  const g=gmGroup(kind,id);if(!g)return false;const before=g.admins||[];g.admins=list;list.filter(k=>!before.includes(k)).forEach(k=>gmSys(kind,id,gmMemberName(kind,id,k)+' 成为了群管理员'));before.filter(k=>!list.includes(k)).forEach(k=>gmSys(kind,id,gmMemberName(kind,id,k)+' 不再是群管理员'));save();return true;}
function gmMute(kind,id,actor,target,minutes){if(!gmCanActOn(kind,id,actor,target,'mute'))return false;const until=minutes>0?Date.now()+Math.min(43200,minutes)*60000:0,mutes=gmMutes(kind,id);if(until)mutes[target]=until;else delete mutes[target];
  if(kind==='pf'){save();sendPhoneFriendGroupBody(id,pfPack({type:'group_mute',target,until}),{silent:true});return true;}
  gmSys(kind,id,until?gmMemberName(kind,id,target)+' 被 '+gmMemberName(kind,id,actor)+' 禁言 '+gmMinutesText(until):gmMemberName(kind,id,target)+' 被 '+gmMemberName(kind,id,actor)+' 解除禁言');
  const g=gmGroup(kind,id);if(g){g.muteBy=g.muteBy||{};if(until)g.muteBy[target]=actor;else delete g.muteBy[target];}
  if(target==='me'&&until&&actor!=='me'&&getC(actor))gmMuteDM(id,actor);save();return true;}
/* 角色在群里禁言了我：过一会儿私下发微信来，说什么按群里刚发生的事和他自己的性格来；私聊里他知道这件事，能用 [群解禁] 放我出来 */
function gmMuteDM(gid,cid){setTimeout(()=>{const g=S.groups.find(x=>x.id===gid),c=getC(cid);if(!g||!c||c.blocked||c.deleted)return;const until=gmMutedUntil('role',gid,'me');if(!until||(g.muteBy&&g.muteBy.me)!==cid)return;
  const lines=g.msgs.slice(-12).map(m=>m.type==='sys'?'（'+gmText(m)+'）':gnm(g,m.senderId)+'：'+gmText(m)).join('\n');
  scheduleFeatureReply(cid,featureEventNote('你在群里禁言了'+S.me.name,'你刚在群聊「'+groupDisplayName(g)+'」里把'+S.me.name+'禁言了，还剩'+gmMinutesText(until)+'。群里最近发生的事：\n'+lines+'\n现在你私下单独给ta发微信。想说什么都行——为什么禁言ta、得意、吃醋、逗ta、心疼、警告、让ta求你，完全按你的性格、心情和你们的关系来，别像系统通知。要放ta出来，就在回复里单独一行写 [群解禁]，这一行不会显示出来。'),200);},6000+Math.random()*10000);}
function wxGroupMutedByRole(cid){for(const g of S.groups||[]){const until=gmMutedUntil('role',g.id,'me');if(until&&g.muteBy&&g.muteBy.me===cid)return {g,until};}return null;}
function wxGroupMutePrompt(c){const hit=c&&wxGroupMutedByRole(c.id);if(!hit)return '';return '\n\n# 群里的事\n你在群聊「'+groupDisplayName(hit.g)+'」里把'+S.me.name+'禁言了，还剩'+gmMinutesText(hit.until)+'。ta现在在群里说不了话。放不放ta出来按你的性格和心情来；真要放，就在回复里单独一行写 [群解禁]，这一行不会显示出来。';}
function applyGroupUnmuteTag(content,c){const re=/^\s*[\[【]\s*群解禁\s*[\]】]\s*$/m;if(!c||!re.test(String(content||'')))return content;const hit=wxGroupMutedByRole(c.id);if(hit&&gmMute('role',hit.g.id,c.id,'me',0))toast((c.remark||c.name)+'把你在「'+groupDisplayName(hit.g)+'」的禁言解除了');return String(content).replace(new RegExp(re.source,'gm'),'').replace(/\n{3,}/g,'\n\n').trim();}
async function gmKick(kind,id,actor,target){if(!gmCanActOn(kind,id,actor,target,'kick'))return false;
  if(kind==='pf'){const p=phoneFriendState();if(gmIsOwner(kind,id)){try{const ok=await pfRpc('phone_friend_group_remove_member',{p_owner_id:p.id,p_secret:p.secret,p_group_id:id,p_member_id:target},25000);if(ok===true){const g=pfGroupById(id);if(g){g.members=(g.members||[]).filter(x=>pfKeyOf(x)!==target);g.member_count=g.members.length;}save();return true;}}catch(_){}return false;}
    sendPhoneFriendGroupBody(id,pfPack({type:'group_kick_request',target}),{silent:true});return 'requested';}
  const g=gmGroup(kind,id);if(!g)return false;const name=gmMemberName(kind,id,target);g.members=g.members.filter(x=>x!==target);if(Array.isArray(g.responders))g.responders=g.responders.filter(x=>x!==target);if(Array.isArray(g.admins))g.admins=g.admins.filter(x=>x!==target);delete gmMutes(kind,id)[target];
  gmSys(kind,id,name+' 被 '+gmMemberName(kind,id,actor)+' 移出了群聊');save();return true;}
/* 真人群：收到管理类隐藏消息时按发送者身份校验后生效；管理员的踢人申请由群主的小手机代为执行。 */
function pfAbsorbGroupManage(gid,from,kept){const pl=pfMsgPayload(kept);if(!pl||!from)return;const p=phoneFriendState(),pref=pfGroupPref(gid),owner=gmOwnerKey('pf',gid);
  if(pl.type==='group_admins'){if(from!==owner||!Array.isArray(pl.admins))return;pref.admins=pl.admins.map(x=>(''+x).toUpperCase()).filter(x=>x&&x!==owner).slice(0,GROUP_ADMIN_MAX);return;}
  if(pl.type==='group_mute'){const target=(''+(pl.target||'')).toUpperCase();if(!gmCanActOn('pf',gid,from,target,'mute'))return;const until=+pl.until||0,mutes=gmMutes('pf',gid);if(until>Date.now())mutes[target]=until;else delete mutes[target];return;}
  if(pl.type==='group_kick_request'){const target=(''+(pl.target||'')).toUpperCase();pref.kickDone=Array.isArray(pref.kickDone)?pref.kickDone:[];if(owner!==p.id||pref.kickDone.includes(kept.id)||!gmCanActOn('pf',gid,from,target,'kick'))return;pref.kickDone.push(kept.id);pref.kickDone=pref.kickDone.slice(-100);setTimeout(()=>gmKick('pf',gid,p.id,target).then(()=>{if(cur().p==='pfgroup'||cur().p==='ginfo')render();}),60);}}
function gmMuteNoticeHTML(kind,id){const until=gmMutedUntil(kind,id,gmMeKey(kind));if(!until)return'';return `<div class="inputbar group-muted-bar">你已被禁言，${gmMinutesText(until)}后解除</div>`;}
/* 群管理页 */
function renderGroupManagePage(kind,id){const g=gmGroup(kind,id);if(!g)return `<div class="gpick-page"><div class="gpick-nav"><button type="button" class="gpick-cancel" onclick="back()">‹</button><b>群管理</b><span></span></div><div class="gpick-empty">群聊资料正在同步</div></div>`;
  const owner=gmIsOwner(kind,id),canManage=gmCanManage(kind,id),admins=gmAdmins(kind,id),mutes=gmMutes(kind,id),k=`'${kind}','${id}'`;
  const person=key=>{if(kind==='pf'){const m=pfGroupMemberById(g,key)||{phone_id:key};return pfAvatarHTML(phoneFriendById(key)||m);}const c=getC(key);return key==='me'?av(S.me.avatar):av(c?c.avatar:'🙂');};
  const adminRows=admins.map(a=>`<div class="gmanage-row"><span class="gpick-av">${person(a)}</span><span class="gmanage-name">${esc(gmMemberName(kind,id,a))}${kind==='role'&&S.couple&&S.couple.cid===a?'<small>情侣 · 可以禁言群主</small>':''}</span>${owner?`<button type="button" class="gmanage-link" onclick="gmanageRemoveAdmin(${k},'${a}')">移除</button>`:''}</div>`).join('');
  const muteRows=Object.keys(mutes).map(t=>`<div class="gmanage-row"><span class="gpick-av">${person(t)}</span><span class="gmanage-name">${esc(gmMemberName(kind,id,t))}<small>还剩 ${gmMinutesText(mutes[t])}</small></span>${gmCanActOn(kind,id,gmMeKey(kind),t,'mute')?`<button type="button" class="gmanage-link" onclick="gmanageUnmute(${k},'${t}')">解除</button>`:''}</div>`).join('');
  return `<div class="gmanage-page"><div class="gpick-nav"><button type="button" class="gpick-cancel gmanage-back" onclick="back()" aria-label="返回">‹</button><b>群管理</b><span></span></div><div class="gmanage-scroll">
  <h3 class="gmanage-title">群管理员</h3><ul class="gmanage-rules"><li>管理员可协助群主管理群聊，拥有发布群公告、禁言和移除群成员等能力。</li><li>只有群主具备设置管理员、解散群聊的能力。</li>${kind==='role'?'<li>只有和你是情侣关系的管理员，才可以禁言群主。</li>':''}<li>最多可设置${GROUP_ADMIN_MAX}个管理员。</li></ul>
  <div class="gmanage-list">${adminRows}${owner&&admins.length<GROUP_ADMIN_MAX?`<button type="button" class="gmanage-row gmanage-add" onclick="gmanagePick(${k},'admin')"><span class="gmanage-plus"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10"/></svg></span><span class="gmanage-name">添加成员</span></button>`:''}</div>
  <h3 class="gmanage-title small">禁言</h3><div class="gmanage-list">${muteRows||'<div class="gmanage-none">暂时没有人被禁言</div>'}${canManage?`<button type="button" class="gmanage-row gmanage-add" onclick="gmanagePick(${k},'mute')"><span class="gmanage-plus"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10"/></svg></span><span class="gmanage-name">禁言成员</span></button>`:''}</div>
  ${kind==='role'?`<div class="gmanage-list gmanage-more"><button type="button" class="gmanage-row" onclick="go('gsettings',{id:'${id}'})"><span class="gmanage-name">角色设置<small>谁会回复、回复条数、群关系网、气泡美化</small></span><span class="ginfo-chev">›</span></button></div>`:`<div class="gmanage-list gmanage-more"><button type="button" class="gmanage-row" onclick="pfGroupBubbleList('${id}')"><span class="gmanage-name">群聊气泡美化<small>每个人单独设置</small></span><span class="ginfo-chev">›</span></button></div>`}
  </div></div>`;}
function gmanagePick(kind,id,mode){_gpick={kind,id,mode,sel:[],q:''};go('gpick',{kind,id,mode});}
function gmanageRemoveAdmin(kind,id,key){gmSetAdmins(kind,id,gmAdmins(kind,id).filter(x=>x!==key));render();}
function gmanageUnmute(kind,id,key){gmMute(kind,id,gmMeKey(kind),key,0);render();}
function gmanageMuteChoose(kind,id,keys){openModal(`<h3>禁言时长</h3>${[[10,'10分钟'],[60,'1小时'],[720,'12小时'],[1440,'1天'],[10080,'7天']].map(([m,t])=>`<button class="btn g" style="margin-bottom:8px" onclick="gmanageMuteApply('${kind}','${id}',${m})">${t}</button>`).join('')}<button class="btn g" onclick="closeModal()">取消</button>`);window._gmanageMuteKeys=keys;}
function gmanageMuteApply(kind,id,minutes){const keys=(window._gmanageMuteKeys||[]).slice(),me=gmMeKey(kind);let n=0;keys.forEach(k=>{if(gmMute(kind,id,me,k,minutes))n++;});closeModal();stack=stack.filter(x=>x.p!=='gpick');render();toast(n?'已禁言 '+n+' 人':'没有可以禁言的成员');}
/* 角色群：群设置（只放角色相关的设置，群名、昵称等已在聊天信息页） */
function renderGroupSettingsPage(id){const g=S.groups.find(x=>x.id===id);if(!g)return '';const resp=g.responders||g.members.slice();
  return `<div class="gmanage-page"><div class="gpick-nav"><button type="button" class="gpick-cancel gmanage-back" onclick="back()" aria-label="返回">‹</button><b>角色设置</b><button type="button" class="gpick-done on" onclick="gsettingsSave('${id}')">完成</button></div><div class="gmanage-scroll gsettings">
  <div class="gmanage-list"><div class="gmanage-row"><span class="gmanage-name">群头像</span>${g.avatar?av(g.avatar,'sm'):'<div class="avatar sm" style="background:#7c6cc0">👥</div>'}<button type="button" class="gmanage-link" onclick="gAvatar('${id}')">从相册选</button></div></div>
  <h3 class="gmanage-title small">谁会回复（都不选 = 全部都回）</h3><div class="gmanage-list gsettings-chips">${g.members.map(cid=>{const c=getC(cid);return c?`<button type="button" class="gsettings-chip${resp.indexOf(cid)>=0?' on':''}" onclick="gToggleResp('${id}','${cid}',this)">${esc(gnm(g,cid))}</button>`:'';}).join('')}</div>
  <h3 class="gmanage-title small">模型调用（单独 = 走角色自己的路线、完整人设；合并 = 几个人一次请求，更快）</h3><div class="gmanage-list">${g.members.map(cid=>{const c=getC(cid);if(!c)return '';const solo=gCallSolo(g,cid);return `<div class="gmanage-row"><span class="gpick-av">${av(c.avatar)}</span><span class="gmanage-name">${esc(gnm(g,cid))}</span><button type="button" class="gsettings-chip gcall-chip${solo?' on':''}" onclick="gCallSoloToggle('${id}','${cid}',this)">${solo?'单独':'合并'}</button></div>`;}).join('')}</div>
  <h3 class="gmanage-title small">每人每轮回复条数</h3><div class="gmanage-list"><div class="gmanage-row"><span class="gmanage-name">最少</span><input id="g_min" type="number" min="1" value="${g.msgMin||1}"></div><div class="gmanage-row"><span class="gmanage-name">最多</span><input id="g_max" type="number" min="1" value="${g.msgMax||2}"></div></div>
  <h3 class="gmanage-title small">每轮总条数上限（所有角色加起来，留空 = 不限）</h3><div class="gmanage-list"><div class="gmanage-row"><span class="gmanage-name">总条数</span><input id="g_total" type="number" min="1" inputmode="numeric" placeholder="不限" value="${g.totalMax>0?g.totalMax:''}"></div></div>
  <h3 class="gmanage-title small">单独设定某个角色的回复条数（留空 = 按上面的最少/最多）</h3><div class="gmanage-list">${g.members.map(cid=>{const c=getC(cid);if(!c)return '';const n=g.roleMsgMax&&+g.roleMsgMax[cid]>0?+g.roleMsgMax[cid]:'';return `<div class="gmanage-row"><span class="gpick-av">${av(c.avatar)}</span><span class="gmanage-name">${esc(gnm(g,cid))}</span><input class="g-role-max" data-cid="${esc(cid)}" type="number" min="1" max="20" inputmode="numeric" placeholder="默认" value="${n}"></div>`;}).join('')}</div>
  <div class="gmanage-list gmanage-more"><button type="button" class="gmanage-row" onclick="groupRels('${id}')"><span class="gmanage-name">群关系网<small>结构化设置谁和谁是什么关系</small></span><span class="ginfo-chev">›</span></button><button type="button" class="gmanage-row" onclick="groupBubbleList('${id}')"><span class="gmanage-name">群聊气泡美化<small>每个人单独设置</small></span><span class="ginfo-chev">›</span></button></div>
  <h3 class="gmanage-title small">补充关系（自由文字，选填）</h3><div class="gmanage-list"><textarea id="g_rel" rows="3" class="gsettings-text" placeholder="例如：两个人是死对头，都喜欢同一个人。">${esc(g.relations||'')}</textarea></div>
  </div></div>`;}
function gsettingsSave(id){const g=S.groups.find(x=>x.id===id);if(!g)return;g.msgMin=Math.max(1,+(($('#g_min')||{}).value)||1);g.msgMax=Math.max(g.msgMin,+(($('#g_max')||{}).value)||2);const total=Math.floor(+(($('#g_total')||{}).value)||0);if(total>0)g.totalMax=Math.min(200,total);else delete g.totalMax;const roleMax={};document.querySelectorAll('.g-role-max').forEach(el=>{const cid=el.getAttribute('data-cid'),n=Math.floor(+el.value||0);if(cid&&n>0&&g.members.includes(cid))roleMax[cid]=Math.min(20,n);});if(Object.keys(roleMax).length)g.roleMsgMax=roleMax;else delete g.roleMsgMax;g.relations=String(($('#g_rel')||{}).value||'').trim();save();back();toast('已保存');}
/* ===== 群二维码：真实可扫。真人群扫码后，由出示二维码的人的小手机自动发出邀请、扫码人自动接受 ===== */
const GROUP_QR_DAYS=7;
function groupQrBase(){return location.origin&&location.origin!=='null'?(location.origin+location.pathname):'https://smallphoneapp.com/';}
function groupQrPayload(kind,id){const base=groupQrBase(),sep=base.includes('?')?'&':'?',exp=Date.now()+GROUP_QR_DAYS*86400000;
  if(kind==='pf'){const p=phoneFriendState(),pref=pfGroupPref(id),now=Date.now();pref.qrTokens=Object.fromEntries(Object.entries(pref.qrTokens||{}).filter(([,e])=>+e>now));const t=uid().replace(/[^a-z0-9]/gi,'').slice(-12);pref.qrTokens[t]=exp;save();
    return{url:base+sep+'smallphone_group='+encodeURIComponent(id)+'&from='+encodeURIComponent(p.id||'')+'&t='+t+'&exp='+exp,exp};}
  return{url:base+sep+'smallphone_rolegroup='+encodeURIComponent(id)+'&exp='+exp,exp};}
function groupQrParse(raw){try{const u=new URL(String(raw),location.href),gid=u.searchParams.get('smallphone_group'),rid=u.searchParams.get('smallphone_rolegroup'),exp=+u.searchParams.get('exp')||0;
  if(gid)return{kind:'pf',id:gid,from:String(u.searchParams.get('from')||'').toUpperCase(),t:String(u.searchParams.get('t')||''),exp};
  if(rid)return{kind:'role',id:rid,exp};}catch(_){}return null;}
function groupQrAvatarGrid(kind,id){const t=ginfoTarget(kind,id),list=t.people.slice(0,9),n=list.length,cols=n<=1?1:n<=4?2:3;return `<div class="gqr-grid" style="grid-template-columns:repeat(${cols},1fr)">${list.map(x=>`<span>${x.html}</span>`).join('')}</div>`;}
let _gqrLast=null;
function renderGroupQrPage(kind,id){const t=ginfoTarget(kind,id),q=groupQrPayload(kind,id),d=new Date(q.exp);_gqrLast={kind,id,url:q.url,name:groupDisplayName(t)};
  let svg='<div class="empty">二维码组件未载入</div>';try{if(typeof qrcode==='function'){const qr=qrcode(0,'M');qr.addData(q.url);qr.make();svg=qr.createSvgTag({cellSize:6,margin:0,scalable:true});}}catch(_){}
  return `<div class="gqr-page"><div class="gqr-nav"><button type="button" onclick="back()" aria-label="返回">‹</button><button type="button" onclick="groupQrMenu()" aria-label="更多">⋯</button></div>
  <div class="gqr-body">${groupQrAvatarGrid(kind,id)}<div class="gqr-title">群聊: ${esc(groupDisplayName(t))}</div><div class="gqr-code">${svg}<span class="gqr-logo"><svg viewBox="0 0 40 34" width="30" height="26" fill="currentColor"><path d="M15 2C7.3 2 1 7.2 1 13.6c0 3.6 2 6.8 5.1 8.9L5 26.5l4.6-2.4c1.7.5 3.5.8 5.4.8h.9a10 10 0 0 1-.4-2.8C15.5 16 21.6 11 29 11h.8C28.5 5.8 22.4 2 15 2z"/><path d="M29 13c-6.4 0-11.6 4.3-11.6 9.6S22.6 32.2 29 32.2c1.5 0 3-.2 4.3-.7l3.8 2-1-3.3c2.6-1.8 4.3-4.5 4.3-7.6C40.4 17.3 35.3 13 29 13z"/></svg></span></div>
  <div class="gqr-tip">该二维码${GROUP_QR_DAYS}天内(${d.getMonth()+1}月${d.getDate()}日前)有效，重新进入将更新</div>${kind==='role'?'<div class="gqr-tip">角色群只在这台小手机里，扫码会直接打开这个群</div>':''}</div>
  <button type="button" class="gqr-save" onclick="groupQrSave()">保存图片</button></div>`;}
function groupQrMenu(){openModal(`<h3>群二维码</h3><button class="btn g" style="margin-bottom:8px" onclick="closeModal();groupQrSave()">保存图片</button><button class="btn g" style="margin-bottom:8px" onclick="closeModal();go('wxscan')">扫一扫</button><button class="btn g" onclick="closeModal()">取消</button>`);}
function groupQrSave(){const q=_gqrLast;if(!q||typeof qrcode!=='function'){toast('二维码组件未载入');return;}try{const qr=qrcode(0,'M');qr.addData(q.url);qr.make();const a=document.createElement('a');a.download='群聊-'+String(q.name||'群聊').slice(0,20)+'.png';a.href=qr.createDataURL(8,4);a.click();toast('已保存二维码图片');}catch(_){toast('保存失败');}}
/* 扫一扫识别群二维码；识别成功返回 true，交给好友二维码之前先判断。 */
function groupQrScanResult(raw){const q=groupQrParse(raw);if(!q)return false;if(q.exp&&q.exp<Date.now()){toast('该群二维码已过期，请让对方重新打开二维码');return true;}
  if(q.kind==='role'){const g=S.groups.find(x=>x.id===q.id);if(!g){toast('这是别的小手机里的角色群，只能在那台小手机里打开');return true;}stack=stack.filter(x=>x.p!=='wxscan');go('group',{id:q.id});return true;}
  const p=phoneFriendState();if(pfGroupById(q.id)){stack=stack.filter(x=>x.p!=='wxscan');openPhoneFriendGroup(q.id);return true;}
  if(!q.from||q.from===p.id){toast('这张二维码无法识别');return true;}
  p.groupJoinPending=p.groupJoinPending||{};p.groupJoinPending[q.id]={from:q.from,t:q.t,exp:q.exp,at:Date.now(),sent:false};save();
  if(phoneFriendById(q.from)){pfGroupJoinSend(q.id);toast('已申请进群，对方小手机收到后会自动拉你进群');}
  else{if(typeof phoneFriendRequest==='function')phoneFriendRequest(q.from);toast('需要先和出示二维码的人成为小手机好友，通过后会自动申请进群');}
  stack=stack.filter(x=>x.p!=='wxscan');if(!stack.length)stack.push({p:'wechat'});render();return true;}
function pfGroupJoinSend(gid){const p=phoneFriendState(),j=p.groupJoinPending&&p.groupJoinPending[gid];if(!j||j.sent||!phoneFriendById(j.from))return false;j.sent=true;save();sendPhoneFriendBody(j.from,pfPack({type:'group_join_request',groupId:gid,token:j.t,name:S.me.name||''}),{silent:true});return true;}
/* 同步时处理：出示人收到进群申请→校验自己发出的二维码→用现有好友邀请拉人；扫码人收到对应邀请→自动接受。 */
function pfGroupQrProcess(rows){const p=phoneFriendState();p.groupQrHandled=Array.isArray(p.groupQrHandled)?p.groupQrHandled:[];let dirty=false;
  Object.keys(p.groupJoinPending||{}).forEach(gid=>{const j=p.groupJoinPending[gid];if(j.exp&&j.exp<Date.now()){delete p.groupJoinPending[gid];dirty=true;return;}if(pfGroupById(gid)){delete p.groupJoinPending[gid];dirty=true;return;}if(!j.sent&&pfGroupJoinSend(gid))dirty=true;});
  (rows||[]).forEach(m=>{const id=''+(m.id||''),from=(''+(m.from_id||m.from||'')).toUpperCase();if(!id||!from||from===p.id||p.groupQrHandled.includes(id))return;const pl=pfUnpack(String(m.body||m.text||''));if(!pl)return;
    if(pl.type==='group_join_request'&&pl.groupId){p.groupQrHandled.push(id);dirty=true;const g=pfGroupById(pl.groupId),exp=g&&(pfGroupPref(pl.groupId).qrTokens||{})[pl.token];
      if(g&&exp&&+exp>Date.now()&&phoneFriendById(from)&&!pfGroupMemberById(g,from))phoneFriendSendGroupInvites(pl.groupId,[from]).catch(()=>{});}
    else if(pl.type==='group_invite'&&pl.groupId&&pl.inviteId){const j=p.groupJoinPending&&p.groupJoinPending[pl.groupId];if(j&&from===j.from){p.groupQrHandled.push(id);dirty=true;delete p.groupJoinPending[pl.groupId];setTimeout(()=>pfGroupInviteAccept(id,pl.inviteId,true),50);}}});
  if(p.groupQrHandled.length>300)p.groupQrHandled=p.groupQrHandled.slice(-300);if(dirty)save();}
/* 选择联系人（加人）/ 移出成员：照真微信的独立页面 */
let _gpick={kind:'',id:'',mode:'',sel:[],q:''};
function gpickItems(kind,id,mode){
  if(mode==='pay'){if(kind==='pf'){const p=phoneFriendState(),g=pfGroupById(id)||{members:[]};return (g.members||[]).filter(m=>pfKeyOf(m)&&pfKeyOf(m)!==String(p.id||'').toUpperCase()).map(m=>{const k=pfKeyOf(m),f=phoneFriendById(k);return{key:k,name:pfGroupMemberName(g,m)||k,avatar:pfAvatarHTML(f||m)};});}
    const g=S.groups.find(x=>x.id===id)||{members:[]};return g.members.map(cid=>{const c=getC(cid);return c?{key:cid,name:gnm(g,cid),avatar:av(c.avatar)}:null;}).filter(Boolean);}
  if(mode==='admin'||mode==='mute'){const me=gmMeKey(kind),owner=gmOwnerKey(kind,id),admins=gmAdmins(kind,id),mutes=gmMutes(kind,id);
    const keys=kind==='pf'?((pfGroupById(id)||{}).members||[]).map(pfKeyOf):['me'].concat((gmGroup(kind,id)||{members:[]}).members);
    return keys.filter(k=>k&&(mode==='admin'?k!==owner&&!admins.includes(k):k!==me&&!mutes[k]&&gmCanActOn(kind,id,me,k,'mute'))).map(k=>{let avatar,nick='';if(kind==='pf'){const g=pfGroupById(id),m=pfGroupMemberById(g,k)||{phone_id:k},f=phoneFriendById(k);avatar=pfAvatarHTML(f||m);if(f&&m.display_name&&pfFriendDisplayName(f)!==m.display_name)nick=m.display_name;}else{const c=k==='me'?null:getC(k),g=gmGroup(kind,id);avatar=av(k==='me'?S.me.avatar:(c?c.avatar:'🙂'));const nk=g.nicks&&g.nicks[k];if(c&&nk&&nk!==(c.remark||c.name))nick=nk;}return{key:k,name:kind==='pf'?gmMemberName(kind,id,k):(k==='me'?(S.me.name||'我'):((getC(k)||{}).remark||(getC(k)||{}).name||'成员')),nick,avatar};});}
  if(kind==='pf'){const p=phoneFriendState(),g=pfGroupById(id)||{members:[]},inGroup=new Set((g.members||[]).map(pfKeyOf)),owner=(''+(g.owner_id||'')).toUpperCase();
    if(mode==='remove')return (g.members||[]).filter(m=>{const k=pfKeyOf(m);return k!==p.id&&k!==owner&&gmCanActOn('pf',id,p.id,k,'kick');}).map(m=>{const k=pfKeyOf(m),f=phoneFriendById(k);return{key:k,name:pfGroupMemberName(g,m),nick:f&&pfFriendDisplayName(f)!==(m.display_name||'')?(m.display_name||''):'',avatar:pfAvatarHTML(m),info:`phoneFriendManage('${k}')`};});
    return (p.friends||[]).map(f=>{const k=(''+(f.phone_id||f.id)).toUpperCase();return{key:k,name:pfFriendDisplayName(f),avatar:pfAvatarHTML(f),inGroup:inGroup.has(k)};});}
  const g=S.groups.find(x=>x.id===id)||{members:[]};
  if(mode==='remove')return g.members.map(cid=>{const c=getC(cid);if(!c)return null;const nk=g.nicks&&g.nicks[cid];return{key:cid,name:c.remark||c.name,nick:nk&&nk!==(c.remark||c.name)?nk:'',avatar:av(c.avatar),info:`go('contactInfo',{id:'${cid}'})`};}).filter(Boolean);
  return wxRoleContacts().map(c=>({key:c.id,name:c.remark||c.name,avatar:av(c.avatar),inGroup:g.members.includes(c.id)}));}
function gpickCircle(on,locked){return `<span class="gpick-check${on?' on':''}${locked?' locked':''}" aria-hidden="true">${on?'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':''}</span>`;}
function gpickRowsHTML(){const {kind,id,mode,sel,q}=_gpick,all=gpickItems(kind,id,mode),qq=String(q||'').trim().toLowerCase(),items=qq?all.filter(x=>String(x.name||'').toLowerCase().includes(qq)||String(x.nick||'').toLowerCase().includes(qq)):all;
  if(mode==='pay'&&!items.length)return `<div class="gpick-empty">${qq?'没有找到':'群里还没有别人'}</div>`;
  if(mode==='pay'){const map={};items.forEach(x=>{const k=wxContactInitial(x.name);(map[k]||(map[k]=[])).push(x);});
    return Object.keys(map).sort((a,b)=>a==='#'?1:b==='#'?-1:a.localeCompare(b)).map(k=>`<section class="gpick-list" id="gpick-${k==='#'?'hash':k}"><h4>${k}</h4>${map[k].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hans-CN')).map(x=>`<div class="gpick-row gpay-row" onclick="groupPayPickGo('${x.key}')"><span class="gpick-av">${x.avatar}</span><span class="gpick-name"><b>${esc(x.name)}</b></span></div>`).join('')}</section>`).join('');}
  const row=x=>{const on=x.inGroup||sel.includes(x.key);return `<div class="gpick-row${x.inGroup?' locked':''}" onclick="${x.inGroup?'':`gpickToggle('${x.key}')`}">${gpickCircle(on,x.inGroup)}<span class="gpick-av">${x.avatar}</span><span class="gpick-name"><b>${esc(x.name)}</b>${x.nick?`<small>昵称：${esc(x.nick)}</small>`:''}</span>${x.info?`<button type="button" class="gpick-info" aria-label="查看资料" onclick="event.stopPropagation();${x.info}"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none"/></svg></button>`:''}</div>`;};
  if(!items.length)return `<div class="gpick-empty">${qq?'没有找到':'没有可选的'+(mode==='remove'?'成员':'联系人')}</div>`;
  if(mode==='remove')return `<section class="gpick-list">${items.map(row).join('')}</section>`;
  if(mode==='admin'){const left=GROUP_ADMIN_MAX-gmAdmins(kind,id).length;if(sel.length>left)_gpick.sel=sel.slice(0,left);}
  const map={};items.forEach(x=>{const k=wxContactInitial(x.name);(map[k]||(map[k]=[])).push(x);});
  return Object.keys(map).sort((a,b)=>a==='#'?1:b==='#'?-1:a.localeCompare(b)).map(k=>`<section class="gpick-list" id="gpick-${k==='#'?'hash':k}"><h4>${k}</h4>${map[k].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hans-CN')).map(row).join('')}</section>`).join('');}
function gpickDoneHTML(){const n=_gpick.sel.length;return `<button type="button" class="gpick-done${n?' on':''}" ${n?'':'disabled'} onclick="gpickDone()">完成${n?'('+n+')':''}</button>`;}
function renderGroupPick(kind,id,mode){if(_gpick.kind!==kind||_gpick.id!==id||_gpick.mode!==mode)_gpick={kind,id,mode,sel:[],q:''};const add=mode==='add';
  if(mode==='pay')return `<div class="gpick-page gpay-page"><div class="gpick-nav"><button type="button" class="gpick-close" onclick="back()" aria-label="关闭"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19"/></svg></button><b>选择收款方</b><span></span></div>
    <label class="gpick-search">${svgIc('search',18,'currentColor')}<input id="gpick-q" placeholder="搜索" value="${esc(_gpick.q)}" oninput="gpickSearch(this.value)" autocomplete="off"></label>
    <div class="gpick-scroll" id="gpick-rows">${gpickRowsHTML()}</div><nav class="gpick-rail">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map(k=>`<button type="button" onclick="gpickJump('${k}')">${k}</button>`).join('')}</nav></div>`;
  if(mode==='admin'||mode==='mute'){const rail2=`<nav class="gpick-rail">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map(k=>`<button type="button" onclick="gpickJump('${k}')">${k}</button>`).join('')}</nav>`;
    return `<div class="gpick-page"><div class="gpick-nav"><button type="button" class="gpick-cancel" onclick="back()">取消</button><b>选择群成员</b><span class="gpick-top-done">${gpickDoneHTML()}</span></div>
    <label class="gpick-search">${svgIc('search',18,'currentColor')}<input id="gpick-q" placeholder="搜索" value="${esc(_gpick.q)}" oninput="gpickSearch(this.value)" autocomplete="off"></label>
    <div class="gpick-scroll" id="gpick-rows">${gpickRowsHTML()}</div>${rail2}</div>`;}
  const rail=add?`<nav class="gpick-rail">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map(k=>`<button type="button" onclick="gpickJump('${k}')">${k}</button>`).join('')}</nav>`:'';
  return `<div class="gpick-page"><div class="gpick-nav">${add?`<button type="button" class="gpick-close" onclick="back()" aria-label="关闭"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19"/></svg></button>`:`<button type="button" class="gpick-cancel" onclick="back()">取消</button>`}<b>${add?'选择联系人':'移出成员'}</b><span class="gpick-top-done">${add?'':gpickDoneHTML()}</span></div>
  <label class="gpick-search">${svgIc('search',18,'currentColor')}<input id="gpick-q" placeholder="搜索" value="${esc(_gpick.q)}" oninput="gpickSearch(this.value)" autocomplete="off"></label>
  <div class="gpick-scroll" id="gpick-rows">${gpickRowsHTML()}</div>${rail}
  ${add?`<div class="gpick-bottom"><span></span><span class="gpick-bottom-done">${gpickDoneHTML()}</span></div>`:''}</div>`;}
function gpickRefresh(){const r=$('#gpick-rows');if(r)r.innerHTML=gpickRowsHTML();document.querySelectorAll(_gpick.mode==='add'?'.gpick-bottom-done':'.gpick-top-done').forEach(el=>{el.innerHTML=gpickDoneHTML();});}
function gpickToggleLimit(key){if(_gpick.mode==='admin'&&!_gpick.sel.includes(key)&&_gpick.sel.length>=GROUP_ADMIN_MAX-gmAdmins(_gpick.kind,_gpick.id).length){toast('最多可设置'+GROUP_ADMIN_MAX+'个管理员');return true;}return false;}
function gpickToggle(key){if(gpickToggleLimit(key))return;const i=_gpick.sel.indexOf(key);if(i>=0)_gpick.sel.splice(i,1);else _gpick.sel.push(key);gpickRefresh();}
function gpickSearch(v){_gpick.q=String(v||'');gpickRefresh();}
function gpickJump(k){const e=$('#gpick-'+(k==='#'?'hash':k));if(e)try{e.scrollIntoView({block:'start'});}catch(_){}}
async function gpickDone(){const {kind,id,mode}=_gpick,sel=_gpick.sel.slice();if(!sel.length)return;
  if(mode==='admin'){if(gmSetAdmins(kind,id,gmAdmins(kind,id).concat(sel)))toast('已设置管理员');back();return;}
  if(mode==='mute'){gmanageMuteChoose(kind,id,sel);return;}
  if(kind==='pf'){if(mode==='add'){try{await pfEnsure();await phoneFriendSendGroupInvites(id,sel);toast('已发送群聊邀请，对方同意后加入');back();await phoneFriendSync(true);}catch(e){toast(e.message||'邀请失败');}return;}
    const p=phoneFriendState(),g=pfGroupById(id);if(!g||!gmCanManage('pf',id)){toast('只有群主和管理员可以移出成员');return;}if(!await uiConfirm('将选中的 '+sel.length+' 人移出群聊？',{danger:true}))return;let ok=0,asked=0;
    for(const mid of sel){const r=await gmKick('pf',id,p.id,mid);if(r===true)ok++;else if(r==='requested')asked++;}
    save();back();toast(ok?'已移出 '+ok+' 人':asked?'已通知群主的小手机移出 '+asked+' 人，群主小手机同步后生效':'移出失败，请稍后重试');phoneFriendSync(true,false,true).catch(()=>{});return;}
  const g=S.groups.find(x=>x.id===id);if(!g)return;
  if(mode==='add'){sel.forEach(cid=>{const c=getC(cid);if(!c||g.members.includes(cid))return;g.members.push(cid);g.msgs.push({senderId:'me',type:'sys',content:'你邀请'+(c.remark||c.name)+'加入了群聊',time:Date.now(),id:uid()});});}
  else{if(!await uiConfirm('将选中的 '+sel.length+' 人移出群聊？',{danger:true}))return;sel.forEach(cid=>{const c=getC(cid);g.members=g.members.filter(x=>x!==cid);if(Array.isArray(g.responders))g.responders=g.responders.filter(x=>x!==cid);g.msgs.push({senderId:'me',type:'sys',content:(c?(c.remark||c.name):'成员')+' 被移出了群聊',time:Date.now(),id:uid()});});}
  save();back();}
async function ginfoLeave(kind,id){if(kind==='pf'){const g=pfGroupById(id);if(g&&pfGroupIsOwner(g))phoneFriendDisbandGroup(id);else phoneFriendLeaveGroup(id);return;}const g=S.groups.find(x=>x.id===id);if(!g)return;if(!await uiConfirm('退出「'+groupDisplayName(g)+'」？\n角色群只在你的小手机里，退出后这个群和聊天记录会一起删除。',{danger:true}))return;S.groups=S.groups.filter(x=>x.id!==id);save();stack=stack.filter(x=>!((x.p==='group'&&x.id===id)||(x.p==='ginfo'&&x.id===id)));if(!stack.length)stack.push({p:'wechat'});render();}
/* ===== 查找聊天内容：照真微信的独立页面 ===== */
const GSEARCH_CATS=['群成员','日期','图片与视频','文件','链接','音乐与音频','交易','小程序','视频号','名片','位置','笔记','商品与小店','礼物','表情'];
let _gsearch={kind:'',id:'',q:'',cat:'',member:'',day:''};
function gsearchRows(kind,id){
  if(kind==='pf'){const g=pfGroupById(id)||{members:[]},p=phoneFriendState();return pfGroupMessages(id).filter(m=>!m.recalled).map(m=>{const pl=pfMsgPayload(m)||{},me=m.from===p.id,ff=me?null:(phoneFriendById(m.from)||pfGroupMemberById(g,m.from)||{phone_id:m.from});return{who:me?(S.me.name||'我'):pfGroupMemberName(g,pfGroupMemberById(g,m.from)||{phone_id:m.from}),whoKey:me?'me':(''+m.from).toUpperCase(),avatar:me?av(S.me.avatar):pfAvatarHTML(ff),type:pl.type||'text',text:pfMsgPreview(m),time:+m.time||0};});}
  const g=S.groups.find(x=>x.id===id);if(!g)return[];return g.msgs.filter(m=>m.type!=='sys').map(m=>{const c=m.senderId==='me'?null:getC(m.senderId);return{who:gnm(g,m.senderId),whoKey:m.senderId,avatar:av(m.senderId==='me'?S.me.avatar:(c?c.avatar:'🙂')),type:m.type||'text',text:gmText(m),time:+m.time||0,jump:m.id?"wxSearchJump('group','"+id+"','"+m.id+"')":''};});}
function gsearchCatOf(r){const t=String(r.type||'');if(t==='sticker')return'表情';if(t==='image'||t==='video'||t==='photo')return'图片与视频';if(t==='file')return'文件';if(t==='weblink'||t==='link'||(t==='text'&&/https?:\/\//i.test(r.text||'')))return'链接';if(t==='voice'||t==='music'||t==='audio')return'音乐与音频';if(t==='transfer'||t==='redpacket'||t==='familycard')return'交易';if(t==='namecard')return'名片';if(t==='location')return'位置';if(t==='gift')return'礼物';if(t==='note')return'笔记';if(t==='shop'||t==='product'||t==='deliveryorder')return'商品与小店';if(t==='miniapp')return'小程序';if(t==='channel')return'视频号';return'';}
function gsearchDay(ms){const d=new Date(ms);return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';}
function gsearchResultHTML(r){return `<div class="gsearch-hit"${r.jump?` onclick="${r.jump}"`:''}><span class="gsearch-av">${r.avatar}</span><span class="gsearch-main"><b>${esc(r.who)}</b><span>${esc(String(r.text||'').slice(0,90))}</span></span><small>${r.time?(gsearchDay(r.time)===gsearchDay(Date.now())?hm(r.time):gsearchDay(r.time).replace(/^\d+年/,'')):''}</small></div>`;}
function gsearchBodyHTML(){const s=_gsearch,rows=gsearchRows(s.kind,s.id),q=String(s.q||'').trim();
  if(!q&&!s.cat)return `<div class="gsearch-quick"><div class="gsearch-quick-title">快速搜索聊天内容</div><div class="gsearch-grid">${GSEARCH_CATS.map(c=>`<button type="button" onclick="gsearchPick('${c}')">${c}</button>`).join('')}</div></div>`;
  let list=rows;
  if(s.cat==='群成员'&&!s.member){const seen=new Map();rows.forEach(r=>{if(!seen.has(r.whoKey))seen.set(r.whoKey,r);});const people=[...seen.values()].filter(r=>!q||r.who.includes(q));return `<div class="gsearch-head">群成员</div>${people.map(r=>`<div class="gsearch-hit" onclick="gsearchMember('${r.whoKey}')"><span class="gsearch-av">${r.avatar}</span><span class="gsearch-main"><b>${esc(r.who)}</b></span></div>`).join('')||'<div class="gsearch-empty">暂无群成员消息</div>'}`;}
  if(s.cat==='日期'&&!s.day){const days=[...new Set(rows.filter(r=>r.time).map(r=>gsearchDay(r.time)))].reverse();return `<div class="gsearch-head">日期</div>${days.map(d=>`<div class="gsearch-hit" onclick="gsearchDayPick('${d}')"><span class="gsearch-main"><b>${d}</b><span>${rows.filter(r=>r.time&&gsearchDay(r.time)===d).length} 条消息</span></span></div>`).join('')||'<div class="gsearch-empty">暂无聊天记录</div>'}`;}
  if(s.cat==='群成员')list=list.filter(r=>r.whoKey===s.member);else if(s.cat==='日期')list=list.filter(r=>r.time&&gsearchDay(r.time)===s.day);else if(s.cat)list=list.filter(r=>gsearchCatOf(r)===s.cat);
  if(q)list=list.filter(r=>String(r.text||'').includes(q)||String(r.who||'').includes(q));
  list=list.slice(-80).reverse();
  return `${s.cat?`<div class="gsearch-head">${esc(s.cat)}${s.member?' · '+esc((list[0]||{}).who||''):''}${s.day?' · '+esc(s.day):''}</div>`:''}${list.map(gsearchResultHTML).join('')||`<div class="gsearch-empty">${q?'没有找到“'+esc(q)+'”相关的聊天记录':'暂无'+esc(s.cat||'相关')+'内容'}</div>`}`;}
function renderGroupSearchPage(kind,id){if(_gsearch.kind!==kind||_gsearch.id!==id)_gsearch={kind,id,q:'',cat:'',member:'',day:''};
  setTimeout(()=>{const el=$('#gsearch-q');if(el&&!_gsearch.cat&&!_gsearch.q)try{el.focus();}catch(_){}},80);
  return `<div class="gsearch-page"><div class="gsearch-top"><label class="gsearch-box">${svgIc('search',18,'currentColor')}<input id="gsearch-q" placeholder="搜索" value="${esc(_gsearch.q)}" oninput="gsearchInput(this.value)" autocomplete="off">${_gsearch.cat?`<button type="button" class="gsearch-chip" onclick="gsearchPick('')">${esc(_gsearch.cat)} ✕</button>`:''}</label><button type="button" class="gsearch-cancel" onclick="back()">取消</button></div><div class="gsearch-scroll" id="gsearch-body">${gsearchBodyHTML()}</div></div>`;}
function gsearchRefresh(){const b=$('#gsearch-body');if(b)b.innerHTML=gsearchBodyHTML();}
function gsearchInput(v){_gsearch.q=String(v||'');gsearchRefresh();}
function gsearchPick(cat){_gsearch.cat=cat;_gsearch.member='';_gsearch.day='';render();}
function gsearchMember(k){_gsearch.member=k;gsearchRefresh();}
function gsearchDayPick(d){_gsearch.day=d;gsearchRefresh();}
function ginfoSearch(kind,id){go('gsearch',{kind,id});}
function ginfoSearchModal(kind,id){openModal(`<h3>查找聊天内容</h3><div class="field"><input id="gi_q" placeholder="搜索" oninput="ginfoSearchRun('${kind}','${id}')" autocomplete="off"></div><div id="gi_hits" class="ginfo-hits"></div><button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);setTimeout(()=>{const el=$('#gi_q');if(el)el.focus();},60);}
function ginfoSearchRun(kind,id){const q=String(($('#gi_q')||{}).value||'').trim(),box=$('#gi_hits');if(!box)return;if(!q){box.innerHTML='';return;}let rows;
  if(kind==='pf'){const g=pfGroupById(id)||{members:[]},p=phoneFriendState();rows=pfGroupMessages(id).filter(m=>!m.recalled).map(m=>({who:m.from===p.id?(S.me.name||'我'):pfGroupMemberName(g,pfGroupMemberById(g,m.from)||{phone_id:m.from}),text:pfMsgPreview(m),time:m.time}));}
  else{const g=S.groups.find(x=>x.id===id);rows=g?g.msgs.filter(m=>m.type!=='sys').map(m=>({who:gnm(g,m.senderId),text:gmText(m),time:m.time})):[];}
  const hits=rows.filter(r=>String(r.text||'').includes(q)).slice(-50).reverse();
  box.innerHTML=hits.length?hits.map(r=>`<div class="ginfo-hit"><b>${esc(r.who)}</b><span>${esc(String(r.text||'').slice(0,80))}</span><small>${r.time?hm(r.time):''}</small></div>`).join(''):'<div class="hint" style="text-align:center">没有找到相关聊天记录</div>';}
function gToggleResp(gid,cid,el){const g=S.groups.find(x=>x.id===gid);g.responders=g.responders||g.members.slice();const i=g.responders.indexOf(cid);if(i>=0)g.responders.splice(i,1);else g.responders.push(cid);const on=g.responders.indexOf(cid)>=0;if(el.classList.contains('gsettings-chip')){el.classList.toggle('on',on);save();return;}el.style.background=on?'#07c160':'#2c2c2e';el.style.color=on?'#fff':'#ccc';}
function gAvatar(id){pickFile('image/*',async f=>{const g=S.groups.find(x=>x.id===id);g.avatar=await compress(f,256,.8);save();render();});}
function saveGroup(id){const g=S.groups.find(x=>x.id===id);g.name=$('#gn').value.trim()||g.name;g.msgMin=Math.max(1,+$('#g_min').value||1);g.msgMax=Math.max(g.msgMin,+$('#g_max').value||2);g.relations=$('#g_rel').value.trim();
  g.nicks=g.nicks||{};{const mv=($('#gnick_me')||{}).value;if(mv!=null){const v=mv.trim().slice(0,16);if(v)g.nicks.me=v;else delete g.nicks.me;}g.members.forEach(cid=>{const el=$('#gnick_'+cid);if(el){const v=(el.value||'').trim().slice(0,16);if(v)g.nicks[cid]=v;else delete g.nicks[cid];}});}
  save();closeModal();render();toast('已保存');}
function g_addMember(id){const g=S.groups.find(x=>x.id===id);const avail=S.contacts.filter(c=>!c.deleted&&g.members.indexOf(c.id)<0);if(!avail.length){toast('没有可拉的角色了');return;}
  openModal(`<h3>拉人进群</h3>${avail.map(c=>`<div class="section"><div class="it" onclick="S.groups.find(x=>x.id==='${id}').members.push('${c.id}');S.groups.find(x=>x.id==='${id}').msgs.push({senderId:'me',type:'sys',content:'${esc(c.name)} 加入了群聊',time:Date.now(),id:uid()});save();closeModal();render()">${esc(c.remark||c.name)}<span class="v">＋</span></div></div>`).join('')}<button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
/* ===== 情侣空间 ===== */
function coupleDefaultState(id){const gr={};Object.keys(LOCKABLE).forEach(k=>gr[k]=true);const ga=S.contacts.filter(x=>!x.deleted&&x.id!==id).map(x=>x.id);return {cid:id,startDate:todayStr(),married:false,anniversaries:[],goals:[],grant:gr,gagAuth:ga,locks:{},gags:{},walletAuth:true,jailAuth:true,wxLoginAuth:true,remoteControlAuth:true,remoteControlAutoApprove:true,escalate:true,behavior:{enabled:true,items:[]},companion:companionDefaultState()};}
function coupleHasActiveRole(){const c=S.couple&&S.couple.cid&&getC(S.couple.cid);return !!(c&&!c.deleted);}
async function bindCouple(id){const c=getC(id);
  if(S.couple&&S.couple.cid===id){go('couple');return;}/* 已经绑定的就是这个角色 → 直接进情侣空间，绝不重置天数/纪念日/授权 */
  if(S.couple&&S.couple.cid&&S.couple.cid!==id){if(!await uiConfirm('已绑定其他角色，换成 '+(c.remark||c.name)+'？这会重置在一起的天数和授权哦。'))return;}
  S.couple=coupleDefaultState(id);save();render();toast('已绑定情侣空间');}
function coupleGoalStore(){if(!S.couple)return[];if(!Array.isArray(S.couple.goals))S.couple.goals=[];return S.couple.goals;}
function coupleGoalTitle(v){return String(v||'').replace(/[\[\]【】|｜]/g,' ').replace(/\s+/g,' ').trim().slice(0,30);}
function coupleGoalActive(g,date){date=date||todayStr();return !!(g&&g.active!==false&&calDateParts(g.startDate)&&calDayDiff(date,g.startDate)>=0&&(!calDateParts(g.endDate)||calDayDiff(g.endDate,date)>=0));}
function coupleGoalKey(g){return'couple_goal_'+String(g&&g.id||'');}
function coupleGoalDone(g,date){return !!(g&&g.completedDays&&g.completedDays[date||todayStr()]);}
function coupleGoalUpsert(title,startDate,endDate,time,source){if(!S.couple)return null;title=coupleGoalTitle(title);startDate=calDateParts(startDate)?startDate:todayStr();endDate=calDateParts(endDate)?endDate:'';time=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time||''))?String(time):'20:00';if(!title||endDate&&calDayDiff(endDate,startDate)<0)return null;const goals=coupleGoalStore(),same=goals.find(g=>g.active!==false&&coupleGoalTitle(g.title)===title);if(same){same.startDate=startDate;same.endDate=endDate;same.time=time;same.source=source||same.source||'manual';return same;}const g={id:uid(),title,startDate,endDate,time,active:true,source:source||'manual',createdAt:Date.now(),completedDays:{}};goals.unshift(g);return g;}
function coupleGoalModal(id){const g=id&&coupleGoalStore().find(x=>x.id===id),today=todayStr();openModal(`<h3>${g?'编辑共同目标':'制定共同目标'}</h3><div class="hint" style="line-height:1.7;margin-bottom:12px">角色会在设定时间后自然监督；当天成功提醒一次后不会反复催。完成后会显示“今天已完成，明天继续”。</div><div class="field"><label>目标</label><input id="cg_title" maxlength="30" value="${esc(g&&g.title||'')}" placeholder="健身 / 学习 / 按时吃饭"></div><div class="field"><label>开始日期</label><input id="cg_start" type="date" value="${g&&g.startDate||today}"></div><div class="field"><label>截止日期</label><input id="cg_end" type="date" value="${g&&g.endDate||''}"><div class="hint">留空表示长期坚持</div></div><div class="field"><label>每天提醒时间</label><input id="cg_time" type="time" value="${g&&g.time||'20:00'}"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="coupleGoalSave('${g&&g.id||''}')">保存</button></div>`);}
function coupleGoalSave(id){const title=coupleGoalTitle(($('#cg_title')||{}).value),start=($('#cg_start')||{}).value,end=($('#cg_end')||{}).value,time=($('#cg_time')||{}).value;if(!title){toast('请填写目标');return;}if(!calDateParts(start)||end&&(!calDateParts(end)||calDayDiff(end,start)<0)){toast('请检查开始和截止日期');return;}const old=id&&coupleGoalStore().find(x=>x.id===id);if(old){old.title=title;old.startDate=start;old.endDate=end;old.time=time||'20:00';old.active=true;}else coupleGoalUpsert(title,start,end,time,'manual');save();closeModal();render();toast('共同目标已保存');}
function coupleGoalComplete(id,quiet){const g=coupleGoalStore().find(x=>x.id===id);if(!g)return false;const today=todayStr();g.completedDays=g.completedDays||{};g.completedDays[today]=Date.now();save();if(cur().p==='couple')render();if(!quiet){toast('今天已完成，明天继续');const c=getC(S.couple.cid);if(c&&!c.blocked)scheduleFeatureReply(c.id,featureEventNote('共同目标今日完成',S.me.name+'刚把共同目标「'+g.title+'」标记为今天已完成。今天不再需要监督这项；请结合最近上下文和你本人性格自然回应ta的完成，不要像打卡系统。明天仍按计划继续。'),120);}return true;}
function coupleGoalToggle(id){const g=coupleGoalStore().find(x=>x.id===id);if(!g)return;g.active=g.active===false;save();render();toast(g.active?'已继续监督':'已暂停监督');}
function coupleGoalDelete(id){askConfirm('删除这个共同目标？',()=>{S.couple.goals=coupleGoalStore().filter(x=>x.id!==id);save();render()},{danger:true});}
function coupleGoalRows(){const today=todayStr(),F=S._calFired||{},goals=coupleGoalStore();if(!goals.length)return'<div class="empty" style="padding:14px">还没有共同目标，可以自己添加，也可以在聊天里请ta每天监督你</div>';return goals.map(g=>{const done=coupleGoalDone(g,today),active=coupleGoalActive(g,today),reminded=F[coupleGoalKey(g,today)]===today,status=done?'今天已完成 · 明天继续':g.active===false?'已暂停':!active?(calDayDiff(today,g.startDate)<0?'将于 '+g.startDate+' 开始':'已到截止日期'):reminded?'今天已监督':'今天等待 '+(g.time||'20:00')+' 监督',range=g.startDate+' → '+(g.endDate||'长期');return `<div style="margin:0 11px 9px;padding:13px;border-radius:14px;background:linear-gradient(135deg,rgba(232,157,181,.13),rgba(104,75,126,.12));border:1px solid rgba(232,157,181,.15)"><div style="display:flex;align-items:flex-start;gap:9px"><div style="width:34px;height:34px;border-radius:11px;background:rgba(232,157,181,.15);display:flex;align-items:center;justify-content:center">${svgIc(done?'check':'heart',17,done?'#75d7a2':'#e89db5')}</div><div style="flex:1;min-width:0"><b style="display:block;color:#f5eaf0;font-size:14px">${esc(g.title)}</b><small style="display:block;color:#8f8490;margin-top:3px">${range} · 每天 ${esc(g.time||'20:00')}</small><span style="display:block;color:${done?'#75d7a2':'#d3a8bb'};font-size:12px;margin-top:6px">${status}</span></div><span onclick="coupleGoalModal('${g.id}')" style="color:#aaa;cursor:pointer;padding:3px">${svgIc('edit',15,'currentColor')}</span><span onclick="coupleGoalDelete('${g.id}')" style="color:#d96b82;cursor:pointer;padding:3px">${svgIc('trash',15,'currentColor')}</span></div><div style="display:flex;gap:7px;margin-top:10px"><button class="minibtn" style="flex:1;background:${done?'#2b3631':'#8d5272'};color:${done?'#75d7a2':'#fff'}" onclick="coupleGoalComplete('${g.id}')" ${done?'disabled':''}>${done?'今天已完成':'标记今天完成'}</button><button class="minibtn" onclick="coupleGoalToggle('${g.id}')">${g.active===false?'继续':'暂停'}</button></div></div>`;}).join('');}
function consumeCoupleGoalTags(content,c){if(!(S.couple&&c&&S.couple.cid===c.id))return false;let changed=false;for(const m of String(content||'').matchAll(/[\[【]\s*监督目标\s*[|｜:：]([^\]】]+)[\]】]/g)){const p=m[1].split(/[|｜]/).map(x=>x.trim()),g=coupleGoalUpsert(p[0],p[1],p[2],p[3],'role');if(g)changed=true;}for(const m of String(content||'').matchAll(/[\[【]\s*目标完成\s*[|｜:：]([^\]】]+)[\]】]/g)){const title=coupleGoalTitle(m[1]),g=coupleGoalStore().find(x=>x.active!==false&&(coupleGoalTitle(x.title)===title||title.includes(coupleGoalTitle(x.title))));if(g){coupleGoalComplete(g.id,true);changed=true;}}if(changed){save();if(cur().p==='couple')render();}return changed;}
function roleWeddingCalendarAdd(c,date,time){if(!(S.couple&&c&&S.couple.cid===c.id)||!calDateParts(date))return false;time=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time||''))?String(time):'19:00';const eventAt=new Date(date+'T'+time+':00').getTime();if(!Number.isFinite(eventAt))return false;let e=(S.calendar||[]).find(x=>x&&x.type==='wedding'&&x.contactId===c.id&&x.date===date&&x.time===time);if(!e){e={id:uid(),date,time,eventAt,title:'我们的婚礼',type:'wedding',contactId:c.id,weddingStyle:'choice',source:'role-agreement',createdAt:Date.now()};S.calendar.push(e);}save();if(typeof weddingScheduleCalendarEvent==='function')weddingScheduleCalendarEvent(e);toast('已由 '+(c.remark||c.name)+' 记下结婚日期 '+date+' '+time);return true;}
function consumeWeddingCalendarTags(content,c){if(!(S.couple&&c&&S.couple.cid===c.id))return false;let changed=false;for(const m of String(content||'').matchAll(/[\[【]\s*婚礼日程\s*[|｜:：]\s*(\d{4}-\d{2}-\d{2})(?:\s*[|｜]\s*((?:[01]\d|2[0-3]):[0-5]\d))?\s*[\]】]/g))if(roleWeddingCalendarAdd(c,m[1],m[2]||'19:00'))changed=true;return changed;}
function coupleGoalOnUserMsg(id,m){if(!(S.couple&&S.couple.cid===id&&m&&m.type!=='sys'))return;const text=String(m.content||'').trim();if(!text)return;const goals=coupleGoalStore();if(!/(没|未|还没|没有).{0,4}(完成|做完|打卡)/.test(text)&&/(完成|做完|打卡了|已经.{0,8}了)/.test(text)){const g=goals.find(x=>coupleGoalActive(x)&&!coupleGoalDone(x)&&text.includes(x.title));if(g)coupleGoalComplete(g.id,true);}const recurring=/(?:每天|每日).{0,20}(?:监督|提醒|督促)|(?:监督|提醒|督促).{0,20}(?:每天|每日)/.test(text);if(!recurring)return;const tm=(text.match(/(?:^|\D)((?:[01]?\d|2[0-3])[:：][0-5]\d)(?:\D|$)/)||[])[1]||((text.match(/(?:每天|每日)?\s*(\d{1,2})\s*点/)||[])[1]?String(+((text.match(/(?:每天|每日)?\s*(\d{1,2})\s*点/)||[])[1])).padStart(2,'0')+':00':'20:00');let title=((text.match(/(?:监督|提醒|督促)(?:我)?(?:每天|每日)?\s*([^，。,.!?！？]{1,24})/)||[])[1]||(text.match(/(?:每天|每日)\s*(?:监督|提醒|督促)(?:我)?\s*([^，。,.!?！？]{1,24})/)||[])[1]||'').replace(/(?:从|自)?\d{4}-\d{2}-\d{2}.*$/,'').replace(/(?:每天)?\s*\d{1,2}(?::\d{2}|点).*$/,'').replace(/^(?:去|要|坚持)/,'').trim();if(title)coupleGoalUpsert(title,todayStr(),'',tm,'chat');save();}
function openCouple(){go('couple');}
function pfGagKey(id){return 'pf:'+(''+id).toUpperCase();}
function pfgGagKey(gid){return 'pfg:'+gid;}
function gagKeyName(k){k=''+k;if(k.indexOf('pf:')===0){const id=k.slice(3),f=phoneFriendById(id);return f?pfFriendDisplayName(f):id;}if(k.indexOf('pfg:')===0){const gid=k.slice(4),g=pfGroupById(gid);return g?pfGroupDisplayName(g):'小手机群聊';}const c=getC(k);return c?(c.remark||c.name):k;}
function gagTargetAll(){const cp=S.couple||{},p=phoneFriendState(),out=[];
  S.contacts.filter(x=>!x.deleted&&x.id!==cp.cid).forEach(x=>out.push({key:x.id,name:x.remark||x.name,type:'role'}));
  (p.friends||[]).forEach(f=>{const id=(''+(f.phone_id||f.id||'')).toUpperCase();if(id)out.push({key:pfGagKey(id),name:pfFriendDisplayName(f),type:'pf'});});
  (p.groups||[]).forEach(g=>{const gid=g.group_id||g.id;if(gid)out.push({key:pfgGagKey(gid),name:pfGroupDisplayName(g),type:'pfg'});});
  return out;}
function gagAuthTargets(){const au=(S.couple&&S.couple.gagAuth)||[];return gagTargetAll().filter(t=>au.indexOf(t.key)>=0);}
function gagFind(nm,authOnly){nm=(''+(nm||'')).replace(/[「」『』"'《》\s]/g,'').trim();if(!nm)return null;const list=authOnly?gagAuthTargets():gagTargetAll();return list.find(t=>{const n=(''+t.name).replace(/[「」『』"'《》\s]/g,'');return n===nm||nm.indexOf(n)>=0||n.indexOf(nm)>=0;})||null;}
function gagSetKey(k,pwd){if(!k)return false;S.couple.gags=S.couple.gags||{};if(!S.couple.gags[k])S.couple.gags[k]={pwd:pwd||genPwd(),time:Date.now()};return true;}
function gagDelKey(k){if(k&&S.couple&&S.couple.gags&&S.couple.gags[k]){delete S.couple.gags[k];return true;}return false;}
function gagAskUnlock(){const cid=S.couple&&S.couple.cid;if(cid&&getC(cid)){openChat(cid);return;}toast('当前没有可联系的绑定角色');}
function gagLockedTargets(){const g=(S.couple&&S.couple.gags)||{};return gagTargetAll().filter(t=>g[t.key]);}
function gagNormName(v){return (''+(v||'')).replace(/[「」『』"'《》\s]/g,'').trim();}
function gagLockedFromText(text){const locked=gagLockedTargets();if(!locked.length)return [];const raw=''+(text||''),t=gagNormName(raw);if(!t)return [];
  const exact=locked.filter(x=>{const n=gagNormName(x.name);return n&&(t===n||t.indexOf(n)>=0||n.indexOf(t)>=0);});
  if(exact.length)return exact;
  if(/全部|所有|都给你解|都解|全都/.test(raw))return locked;
  if(/小手机好友|真人好友|手机好友|好友/.test(raw))return locked.filter(x=>x.type==='pf');
  if(/小手机群|群聊|群消息|群/.test(raw))return locked.filter(x=>x.type==='pfg');
  return locked.length===1?locked:[];}
function gagAuthRows(){const cp=S.couple;if(!cp)return '';cp.gagAuth=cp.gagAuth||[];const list=gagTargetAll();if(!list.length)return '<div class="hint" style="padding:8px 14px">好友里还没有可禁言对象</div>';let last='';
  return list.map(t=>{const lab=t.type==='pf'?'小手机好友':t.type==='pfg'?'小手机群聊':'角色';const head=lab!==last?`<div style="padding:10px 14px 3px;color:#8f91a0;font-size:12px">${last=lab}</div>`:'';return head+`<div class="it" data-couple-permission="${esc('gag:'+t.key)}"><span>${esc(t.name)}<small style="color:#777;margin-left:6px">${lab}</small></span><span class="sw ${cp.gagAuth.indexOf(t.key)>=0?'on':''}" onclick="coupleGagAuth('${t.key}')"></span></div>`;}).join('');}
function setHomeBg(){pickFile('image/*',async f=>{S.me.homeBg=await compressBackground(f);save();render();toast('主屏壁纸已换 🖼️');});}
function resetHomeBg(){S.me.homeBg='';save();render();toast('已恢复默认');}
function setLockBg(){pickFile('image/*',async f=>{S.me.lockBg=await compressBackground(f);save();renderLockScreen(true);if(cur().p==='settings')render();toast('锁屏壁纸已换');});}
function setCallBg(){pickFile('image/*',async f=>{S.me.callBg=await compressBackground(f);save();if(cur().p==='settings')render();if(_call)renderCall();toast('通话背景已换');});}
const GAMES=[
  {k:'tale',e:'',n:'规则怪谈',tag:'辨别真假规则 · 活过三晚'},
  {k:'dread',e:'',n:'惊悚抉择',tag:'恐怖选项剧情 · 选择与生存'},
  {k:'drawguess',e:'',n:'你画我猜',tag:'逐笔画布'},
  {k:'beads',e:'',n:'像素拼拼乐',tag:'上传图片 · 百级精细方格'},
  {k:'heartquiz',e:'',n:'心动审判',tag:'30题 · 双人锁答 · 多结局'},
  {k:'soup',e:'',n:'海龟汤'},
  {k:'escape',e:'',n:'小黑屋(自定义密室)'},
  {k:'wordguess',e:'',n:'你说我猜'},
  {k:'undercover',e:'',n:'谁是卧底'},
  {k:'tod',e:'',n:'真心话大冒险',kick:'我们玩真心话大冒险：用骰子比大小，你也掷一个（直接在话里说你掷出几点1-6），点数小的人要选「真心话」或「大冒险」并完成。先让ta掷，或你先掷都行。'},
  {k:'quiz',e:'',n:'默契考验',kick:'我们玩默契大考验：轮流出一道关于彼此的问题考对方，看谁更懂谁。你先出第一题。'},
  {k:'drama',e:'',n:'即兴小剧场',kick:'我们来即兴小剧场，你给我们设定一个情境或开场白，然后一起把剧情演下去。开场吧。'},
  {k:'quick',e:'',n:'快问快答',kick:'我们玩快问快答，你连续快速地问我问题、我来答，答完你也可以让我问你。开始。'}
];
//@@ web
/* v1664：像素少女、电子宠物这类组件如果开机时没下载下来（部分网络下 GitHub Pages 偶发失败），打开时现场重新下载，最多三次，再不行才提示 */
//@@ private
/* v1662：像素少女、电子宠物这类组件如果开机时没下载下来（部分网络下 GitHub Pages 偶发失败），打开时现场重新下载，最多三次，再不行才提示 */
//@@ end
const NORTH_LAZY_COMPONENTS={pixelhome:[['pixel-home-policy.js',()=>typeof PixelHomePolicy!=='undefined'],['pixel-wardrobe-info.js',()=>typeof PixelHomeWardrobeInfo!=='undefined'],['pixel-home.js',()=>typeof openPixelHome==='function']],pet:[['pet-game.js',()=>typeof openPetGame==='function']]};
const _northLazyLoading={};
function northLazyScript(file,attempt){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=file+'?v='+(window.__NORTH_SHELL_BUILD__||'0')+(attempt?'&retry='+attempt+'-'+Date.now():'');el.onload=()=>resolve();el.onerror=()=>{el.remove();reject(new Error(file));};document.head.appendChild(el);});}
function northEnsureComponent(key){const parts=NORTH_LAZY_COMPONENTS[key];if(!parts)return Promise.resolve(false);if(parts.every(p=>p[1]()))return Promise.resolve(true);if(_northLazyLoading[key])return _northLazyLoading[key];
  const job=(async()=>{for(const [file,ready] of parts){for(let attempt=0;!ready()&&attempt<3;attempt++){try{await northLazyScript(file,attempt);}catch(_){await new Promise(r=>setTimeout(r,600*(attempt+1)));}}if(!ready())return false;}return true;})();
  _northLazyLoading[key]=job;job.finally(()=>{delete _northLazyLoading[key];});return job;}
function northOpenComponent(key,label,open){const parts=NORTH_LAZY_COMPONENTS[key];if(!parts||parts.every(p=>p[1]()))return open();toast(label+'组件正在重新下载…');northEnsureComponent(key).then(ok=>{if(ok)open();else toast(label+'组件下载失败，请检查网络后再点一次；其他应用仍可使用');});}
function gameDefinition(k){return GAMES.find(x=>x.k===k)||(k==='pixelhome'?{k,e:'',n:'像素少女'}:k==='pet'?{k,e:'',n:'电子宠物'}:null);}
function gameContextRounds(){S.settings=S.settings||{};const n=Math.floor(Number(S.settings.gameHistRounds));return Number.isFinite(n)&&n>=2?Math.min(100,n):24;}
function gameContextRows(rows){rows=Array.isArray(rows)?rows:[];const starts=[],human=m=>m&&(m.who==='me'||m.kind==='me'||m.kind==='pf'||m.kind==='host');for(let i=0;i<rows.length;i++){if(human(rows[i])&&(i===0||!human(rows[i-1])))starts.push(i);}const rounds=gameContextRounds(),start=starts.length>rounds?starts[starts.length-rounds]:0;return rows.slice(start);}
function gameContextLimit(){return gameContextRounds();}
function gameContextSave(){const el=$('#game_hist'),n=Math.floor(Number(el&&el.value));if(!Number.isFinite(n)){toast('请输入游戏上下文回合数');return false;}S.settings=S.settings||{};S.settings.gameHistRounds=Math.max(2,Math.min(100,n));if(el)el.value=S.settings.gameHistRounds;save();toast('游戏上下文已设为 '+S.settings.gameHistRounds+' 回合');return true;}
function gameHandoffWho(row,c){if(row.who==='me'||row.kind==='me')return S.me.name;if(row.kind==='sys'||row.who==='sys')return'游戏事件';return row.name||row.roleName||(c&&(c.remark||c.name))||'角色';}
function gameSetHandoff(cid,title,rows){const c=getC(cid);if(!c)return false;rows=(rows||[]).filter(x=>x&&String(x.text||'').trim()&&x.kind!=='sys'&&x.who!=='sys');const rounds=gameContextRounds(),picked=gameContextRows(rows).map((x,i)=>(i+1)+'. '+gameHandoffWho(x,c)+'：'+String(x.text||'').replace(/\s+/g,' ').trim().slice(0,700));if(!picked.length)return false;c._gameHandoff={ts:Date.now(),expiresAt:Date.now()+12*3600000,turns:3,title:String(title||'游戏').slice(0,80),rounds,count:picked.length,text:picked.join('\n')};save();return true;}
function gameHandoffRecallQuery(text){text=String(text||'').replace(/\s+/g,'');return/(?:游戏|刚才那局|上一局|海龟汤|小黑屋|你说我猜|你画我猜|拼豆|谁是卧底|真心话|默契考验|心动审判|情侣问卷|小剧场|快问快答).{0,18}(?:最后|刚才|说了什么|发生了什么|玩了什么|画了什么|拼了什么|还记得)|还记得.{0,18}(?:游戏|那局|刚才玩|刚才画|刚才拼)/.test(text);}
function gameWechatHandoffPrompt(c,query){const h=c&&c._gameHandoff,explicit=gameHandoffRecallQuery(query),active=h&&h.turns>0&&Date.now()<=(h.expiresAt||0),recent=h&&Date.now()-(h.ts||0)<=30*86400000;if(!h||!h.text||(!active&&!(explicit&&recent)))return'';return '\n\n# 刚结束的游戏大厅上下文（微信隐藏承接·不属于长期记忆或对话总结）\n你和'+S.me.name+'刚结束「'+h.title+'」。下面是按游戏上下文保留的最近 '+(h.rounds||'?')+' 回合，共 '+h.count+' 条真实游戏记录：\n'+h.text+'\n你已经参与并理解这局发生的内容。回到微信后只用普通微信文字自然承接；不要把游戏记录逐条复述，不要继续假装还在游戏房间，不要输出编号、旁白格式或系统提示，也不要把它写成新的长期记忆。'+(explicit?' 用户正在核对这局内容，只能依据上面的真实记录回答，记录没有的细节不要猜。':'');}
function gameWechatHandoffConsume(c){const h=c&&c._gameHandoff;if(!h)return;h.turns=Math.max(0,(+h.turns||0)-1);save();}
function gameLineIcon(k){const paths={drawguess:'<path d="M5 17.5 14.8 7.7l2.5 2.5L7.5 20H5v-2.5Z"/><path d="m13.7 8.8 1.7-1.7a1.8 1.8 0 0 1 2.5 0l.9.9a1.8 1.8 0 0 1 0 2.5l-1.7 1.7"/><path d="M4 5.5h6M4 9h3"/>',soup:'<path d="M4 10h16c0 5-3.2 8-8 8s-8-3-8-8Z"/><path d="M8 6c0-1 1-1.3 1-2.3M12 6c0-1 1-1.3 1-2.3M16 6c0-1 1-1.3 1-2.3"/>',escape:'<path d="M6 3h12v18H6z"/><path d="M10 7h8v10h-8z"/><circle cx="15" cy="12" r=".8"/>',wordguess:'<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/>',undercover:'<path d="M7 9c1-4 9-4 10 0M5 10h14"/><path d="M8 14c1.3 2 2.5 3 4 3s2.7-1 4-3"/><circle cx="9" cy="12.5" r="1"/><circle cx="15" cy="12.5" r="1"/>',tod:'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>',quiz:'<path d="M9.4 9a2.8 2.8 0 1 1 4.5 2.2c-1.2.9-1.9 1.4-1.9 2.8"/><path d="M12 18h.01"/><circle cx="12" cy="12" r="9"/>',drama:'<path d="M5 5c3 0 5 1 7 3v10c-2-2-4-3-7-3V5Z"/><path d="M19 5c-3 0-5 1-7 3v10c2-2 4-3 7-3V5Z"/>',quick:'<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[k]||paths.quiz}</svg>`;}
const gameLineIconBase=gameLineIcon;
gameLineIcon=function(k){if(k==='tale')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10h8v11H8zM12 10V8M12 2c3 3 3 5 0 6-3-1-3-3 0-6ZM6 21h12"/></svg>';if(k==='dread')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20v-5a3 3 0 0 1 3-3h6a3 3 0 0 0 3-3V4M6 4v5a3 3 0 0 0 3 3M3 7l3-3 3 3M15 7l3-3 3 3"/></svg>';if(k==='heartquiz')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S4 15.6 4 9.6C4 6.6 7.6 5 10 7.4L12 9.5l2-2.1c2.4-2.4 6-.8 6 2.2 0 6-8 10.4-8 10.4Z"/><path d="M8.2 12h2.1l1.2-2.3 1.7 4.5 1.1-2.2h1.8"/></svg>';if(k==='beads')return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>';if(k==='pet')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8 6 4 4 8v6c0 4 3 7 8 7s8-3 8-7V8l-2-4-2 4M8 8q4-2 8 0"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M10 17q2 2 4 0"/></svg>';return gameLineIconBase(k);};
function openGames(){closeModal();if(cur().p==='gameshub')return render();if(cur().p==='pet'){if(stack.length>1&&stack[stack.length-2].p==='gameshub')stack.pop();else stack=[{p:'home'},{p:'gameshub'}];render();return;}go('gameshub');}
function gameModelToggle(){S.settings=S.settings||{};S.settings.gameUseAux=!gameModelUseAux();save();render();if(S.settings.gameUseAux&&!(S.settings.aux&&S.settings.aux.model))toast('已选副模型，但还没配置副模型，暂时仍会使用主模型');else toast(S.settings.gameUseAux?'游戏大厅已切换到副模型':'游戏大厅已切换到主模型');}
function gameHubModal(html){openModal(html);const m=$('#modal');if(!m)return;m.classList.add('gamehub-modal','dy-solid-modal');m.classList.remove('dy-solid-light','dy-solid-wx','dy-solid-dy','dy-solid-pet');}
function gameHubSettings(){gameHubModal(`<h3>游戏设置</h3><div class="hint">上下文按完整回合保留，只影响需要文字对话的游戏。</div><div class="section"><div class="it"><span style="flex:1">游戏上下文回合数</span><input id="game_hist" type="number" min="2" max="100" step="1" value="${gameContextRounds()}" style="width:68px;text-align:center;border:1px solid #444;border-radius:8px;padding:6px;background:#202024;color:#fff"></div></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="gameContextSave();closeModal()">保存</button></div>`);}
// GAMEHUB_REFERENCE_V1: reference layout; real entries, drafts and invitations retained.
let _gameHubFilter='all';
function gameHubFilterSet(key){if(!['all','duo','story','casual'].includes(key))return;_gameHubFilter=key;render();}
function gameHubOpen(key){if(key==='tale'||key==='dread')return openApp(key);return pickGameChar(key);}
function gameHubRandom(){const list=gameHubVisible();if(list.length)gameHubOpen(list[Math.floor(Math.random()*list.length)].k);}
function gameHubVisible(){const order=['tale','dread','drawguess','heartquiz','soup','beads','escape','tod','quiz','drama','undercover','quick','wordguess'];return order.map(k=>GAMES.find(g=>g.k===k)).filter(Boolean).filter(g=>_gameHubFilter==='all'||(_gameHubFilter==='story'?['tale','dread','escape','drama'].includes(g.k):_gameHubFilter==='duo'?['drawguess','heartquiz','beads','tod','quiz','wordguess'].includes(g.k):['soup','beads','undercover','quick','tod','wordguess'].includes(g.k)));}
function renderGameHub(){const drafts=gsDraftList(),dd=dgDraftList(),bd=typeof beadDraftCardsHTML==='function'?beadDraftCardsHTML():'',aux=gameModelUseAux();return `<div class="gamehub gamehub-reference"><div class="nav gamehub-nav"><button type="button" class="l" onclick="home()" aria-label="返回主屏幕">‹</button><span class="t" aria-hidden="true"></span><span class="r gamehub-actions"><button type="button" class="gamehub-model ${aux?'aux':''}" onclick="gameModelToggle()" title="切换游戏回复模型" aria-label="切换游戏回复模型，当前${aux?'副模型':'主模型'}">${svgIc('route',13,aux?'#d9c4f1':'#cbd4df')}<b>${aux?'副模型':'主模型'}</b></button><button type="button" class="gamehub-settings" onclick="gameHubSettings()">设置</button></span></div><div class="gamehub-scroll">
  <section class="gamehub-hero"><div><small>PLAY TOGETHER</small><h2>游戏大厅</h2><span class="gamehub-english">GAME STUDIO</span><p>选一场游戏，邀请喜欢的人一起。</p><button class="gamehub-random" onclick="gameHubRandom()">${gameLineIcon('tod')}<b>随机一局</b><span>›</span></button></div></section>
  ${(drafts.length||dd.length||bd)?`<div class="gamehub-title"><b>继续游戏 <span>›</span></b></div><div class="gamehub-drafts">${bd}${dd.map((d,i)=>{const c=getC(d.cid);return `<button onclick="dgOpenSetup('${d.cid}')"><i>${gameLineIcon('drawguess')}</i><span><b>继续画作</b><small>${esc((c&&(c.remark||c.name))||'角色')} · 可继续或重新选择</small></span><em>›</em></button>`;}).join('')}${drafts.map((d,i)=>`<button onclick="gsResumeDraft(${i})"><i>${gameLineIcon(d.kind)}</i><span><b>${esc(d.title||'未结束的游戏')}</b><small>${esc(((getC(d.cid)||{}).remark||(getC(d.cid)||{}).name||'角色'))} · ${(d.msgs||[]).length} 条记录</small></span><em>›</em></button>`).join('')}</div>`:''}
  <div class="gamehub-filters" role="group" aria-label="游戏分类">${[['all','全部'],['duo','双人'],['story','剧情'],['casual','轻松']].map(([k,n])=>`<button class="${_gameHubFilter===k?'on':''}" aria-pressed="${_gameHubFilter===k}" onclick="gameHubFilterSet('${k}')">${n}</button>`).join('')}</div><div class="gamehub-grid">${gameHubVisible().map(g=>{const number={tale:'01',dread:'02',drawguess:'03',heartquiz:'04',soup:'05',beads:'06',escape:'07',tod:'08',quiz:'09',drama:'10',undercover:'11',quick:'12',wordguess:'13'};return `<article tabindex="0" role="button" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();gameHubOpen('${g.k}')}" data-game="${g.k}" class="gamehub-card ${g.k==='tale'?'wide story':g.k==='heartquiz'?'wide featured':''}" onclick="gameHubOpen('${g.k}')"><i class="gamehub-art gamehub-icon-${g.k}">${gameLineIcon(g.k)}</i><div class="gamehub-card-copy"><div class="gamehub-meta">${number[g.k]} ${g.k==='tale'?'<span>剧情</span>':g.k==='heartquiz'?'<span class="hot">热门</span>':''}</div><b>${esc(g.n)}</b><small>${esc(g.tag||(MIX_GAME_KEYS.indexOf(g.k)>=0?'支持单人 / 多人房':'单人游戏'))}</small></div>${g.k==='tale'?'<div class="gamehub-mystery" aria-hidden="true"><i>?</i></div>':g.k==='heartquiz'?'<div class="gamehub-orbit" aria-hidden="true"><svg viewBox="0 0 16 16"><defs><pattern id="hub-heart-pixels" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#bb7b9b" stroke="#75465f" stroke-width=".09"/></pattern></defs><path d="M2 2h3v1h1v1h1V3h1V2h3v1h2v2h1v4h-2v2h-2v2H8v2H6v-2H4v-2H2V9H0V5h1V3h1Z" fill="url(#hub-heart-pixels)"/></svg></div>':''}${MIX_GAME_KEYS.indexOf(g.k)>=0?`<button class="gamehub-multi" onclick="event.stopPropagation();openMixedGamePicker('${g.k}')">多人</button>`:'<span class="gamehub-chevron">›</span>'}</article>`;}).join('')}</div>
  <button class="gamehub-gallery" onclick="dgOpenGallery()"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="m12 32 22-22 5 5-22 22-8 2 3-7Zm18-18 5 5M9 10v6M6 13h6M38 34v6M35 37h6M17 42v3M15.5 43.5h3"/></svg><span><b>我的画作</b><small>查看、保留或删除已经完成的画布</small></span><em>›</em></button>
  </div></div>`;}
function pickGameChar(k){if(k==='pixelhome')return northOpenComponent('pixelhome','像素少女',()=>openPixelHome());const cs=S.contacts.filter(c=>!c.deleted);if(!cs.length){toast('先创建一个角色');return;}
  gameHubModal(`<h3>邀请谁一起玩？</h3><div class="hint">会给ta发一张【游戏邀请卡片】，ta同意之后，你才能和ta进游戏空间一起玩～</div>${cs.map(c=>`<div class="section"><div class="it" onclick="sendGameInvite('${k}','${c.id}')">${esc(c.remark||c.name)}<span class="v">›</span></div></div>`).join('')}<button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function sendGameInvite(k,cid){const g=gameDefinition(k);const c=getC(cid);if(!g||!c)return;closeModal();
  if(c.blocked){toast('ta把你拉黑了，没法邀请');return;}
  const mc={role:'user',type:'gameinvite',game:k,gname:g.n,ge:g.e,status:'pending',id:uid(),time:Date.now()};
  msgs(cid).push(mc);save();openChat(cid);
  const note='[系统：'+S.me.name+'给你发来一张【游戏邀请卡片】，想拉你一起玩「'+g.e+' '+g.n+'」。请你按当下心情和人设决定：愿意陪ta玩，就【单独一行】输出 [同意游戏] 再说一句答应的话；这会儿不想玩/在忙，就【单独一行】输出 [拒绝游戏] 并温柔说明。注意：只有你[同意游戏]，ta才能进去和你一起玩；这两个标记不会被读出来。]';
  scheduleReply(cid,note);}
function gameInviteDecide(id,ok){const c=getC(id);if(!c)return false;const inv=[...msgs(id)].reverse().find(x=>x.type==='gameinvite'&&x.role==='user'&&x.status==='pending');if(!inv)return false;
  inv.status=ok?'accepted':'declined';
  if(ok){c.gamesPlayed=c.gamesPlayed||[];if(inv.gname&&c.gamesPlayed.indexOf(inv.gname)<0){c.gamesPlayed.push(inv.gname);if(c.gamesPlayed.length>30)c.gamesPlayed.shift();}}
  save();if(cur().p==='chat'&&cur().id===id)refreshChatMessages(id);else if(cur().p==='wechat')render();return true;}
