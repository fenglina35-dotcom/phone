function dyPutEmoji(inputId,e){const el=$('#'+inputId);if(!el)return;el.value=(el.value||'')+e;el.focus();}
function dySendSticker(scope,id,i){const s=(S.me.stickers||[])[i];if(!s)return;
  dyPanelClose(scope,id);
  if(scope==='g'){const g=dyGroup(id);if(!g)return;
    if(dyGMeMuted(g))return toast('你被禁言了，发不出去');
    dyGMsgs(g).push({id:uid(),k:'me',kind:'sticker',img:s.img,meaning:s.meaning||'',text:'[表情]',time:Date.now()});
    save();render();dyGroupReply(id,'[发了个表情：'+(s.meaning||'表情')+']');return;}
  const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return;
  d.msgs.push({from:'me',kind:'sticker',img:s.img,meaning:s.meaning||'',text:'[表情]',time:Date.now()});
  dySparkTick(d);save();render();dyDMReply(d);}
/* 消息体：表情包画图，语音画一条可点开看文字的语音条 */
function dyVoiceSeconds(text){return Math.max(1,Math.min(60,Math.round(String(text||'').length/3)+1));}
function dyMsgBodyHTML(m,scope,id){
  if(m&&m.kind==='work')return dyWorkCardHTML2(m);
  if(m&&(m.kind==='red'||m.kind==='transfer'))return dyMoneyCardHTML(scope,id,m);
  if(m&&m.kind==='sticker')return `<div class="dycp-msg">${stickerImageHTML(m.img)}</div>`;
  if(m&&m.kind==='voice'){const sec=dyVoiceSeconds(m.text);
    return `<div class="dyvo" onclick="event.stopPropagation();toast(${jq(String(m.text||''))})"><i></i><span>${sec}″</span></div>`;}
  return '';}
function dyMsgPlain(m){if(!m)return '';
  if(m.kind==='work')return '[转发了一条抖音作品，作者@'+(m.author||'')+'，文案：'+(m.desc||m.body||'')+']';
  if(m.kind==='transfer')return '[转账 ¥'+(+m.amount||0).toFixed(2)+(m.toName?('，转给'+m.toName):'')+(m.note?'，'+m.note:'')+']';
  if(m.kind==='red')return '[红包 ¥'+(+m.amount||0).toFixed(2)+(m.count>1?('，'+m.count+'个，手快的抢'):'')+(m.note?'，'+m.note:'')+']';
  if(m.kind==='sticker')return '[表情'+(m.meaning?'：'+m.meaning:'')+']';
  if(m.kind==='voice')return '[语音：'+String(m.text||'')+']';
  return String(m.text||'');}
/* ===== 抖音的转账和红包：钱走微信那一套账本（addBill、S.me.balance）=====
   群里多两样：转账可以指定转给谁；红包可以塞好几个让他们抢，
   抢不抢、抢多快由性格决定——爱钱的角色手最快。 */
function dyDMPlus(id){const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return;
  dyPanelClose('d',id);
  openModal(`<h3>发点什么</h3><div class="btns" style="flex-direction:column;gap:8px">
    <button class="dybtn out" onclick="closeModal();dyMoneyForm('d','${id}','transfer')">转账</button>
    <button class="dybtn out" onclick="closeModal();dyMoneyForm('d','${id}','red')">红包</button>
    <button class="btn g" onclick="closeModal()">取消</button></div>`);}
function dyGroupPlus(gid){const g=dyGroup(gid);if(!g)return;
  if(dyGMeMuted(g))return toast('你被禁言了，发不出去');
  dyPanelClose('g',gid);
  openModal(`<h3>发点什么</h3><div class="btns" style="flex-direction:column;gap:8px">
    <button class="dybtn out" onclick="closeModal();dyMoneyForm('g','${gid}','transfer')">转账（指定转给谁）</button>
    <button class="dybtn out" onclick="closeModal();dyMoneyForm('g','${gid}','red')">发红包（大家抢）</button>
    <button class="btn g" onclick="closeModal()">取消</button></div>`);}
function dyMoneyTargets(gid){const g=dyGroup(gid);if(!g)return [];
  return dyGMemberList(g).filter(m=>m&&m.k!=='me');}
function dyMoneyForm(scope,id,kind){const red=kind==='red',group=scope==='g';
  const who=group?`<div class="field"><label>${red?'谁能抢':'转给谁'}</label><select id="dym_who">${red?'<option value="">群里所有人</option>':''}${dyMoneyTargets(id).map(m=>`<option value="${esc(m.k)}">${esc(dyGMemberName(m))}</option>`).join('')}</select></div>`:'';
  const count=(group&&red)?`<div class="field"><label>红包个数<small style="color:#888">谁手快谁抢到，爱钱的人抢得积极</small></label><input id="dym_n" type="number" min="1" max="20" value="3"></div>`:'';
  openModal(`<h3>${red?'红包':'转账'}</h3>
    <div class="hint">钱从你的钱包扣，跟微信同一个账本。余额 ¥${(+S.me.balance||0).toFixed(2)}</div>
    ${who}
    <div class="field"><label>金额</label><input id="dym_a" type="number" step="0.01" placeholder="${red?'6.66':'5.20'}"></div>
    ${count}
    <div class="field"><label>${red?'祝福语':'说明'}</label><input id="dym_note" placeholder="${red?'恭喜发财':'给你买糖吃'}"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyMoneySend('${scope}','${id}','${kind}')">${red?'塞钱':'转账'}</button></div>`);}
function dyMoneySend(scope,id,kind){const red=kind==='red',group=scope==='g';
  const a=+(($('#dym_a')||{}).value||0);
  if(!(a>0))return toast('填金额呀');
  if(a>(+S.me.balance||0))return toast('余额不够啦（去钱包看看）');
  const note=String((($('#dym_note')||{}).value||'')).trim().slice(0,30);
  const whoK=String((($('#dym_who')||{}).value||''));
  if(group){const g=dyGroup(id);if(!g)return;
    const n=red?Math.max(1,Math.min(20,parseInt((($('#dym_n')||{}).value||'3'),10)||3)):1;
    const target=whoK?dyGFind(g,whoK):null;
    if(!red&&!target)return toast('选一个人转给他');
    addBill('out',a,red?('抖音群「'+g.name+'」发红包'):('抖音群里转账给'+dyGMemberName(target)));
        const msg=red
      ?{id:uid(),k:'me',kind:'red',amount:a,note:note||'恭喜发财',count:n,left:n,rest:a,taken:[],only:whoK||'',time:Date.now(),text:'[红包]'}
      :{id:uid(),k:'me',kind:'transfer',amount:a,note,to:whoK,toName:dyGMemberName(target),time:Date.now(),text:'[转账]'};
    dyGMsgs(g).push(msg);save();closeModal();render();
    if(red)setTimeout(()=>dyRedGrabRun(id,msg.id),700);
    dyGroupReply(id,red?('[发了个红包，'+n+'个，共'+a.toFixed(2)+'元]'):('[转账给'+dyGMemberName(target)+' '+a.toFixed(2)+'元]'));
    return;}
  const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return;
  addBill('out',a,(red?'抖音私信发红包给':'抖音私信转账给')+d.name);
    d.msgs.push({from:'me',kind:red?'red':'transfer',amount:a,note,time:Date.now(),text:red?'[红包]':'[转账]'});
  dySparkTick(d);save();closeModal();render();dyDMReply(d);}
/* 谁来抢：爱钱的人手快。性格里带钱、贪、抠、穷这些字的排前面，其余按话痨度。 */
function dyGreed(m){const t=dyGPersonaText(m);let g=30;
  if(/(爱钱|贪|财迷|抠|小气|穷|打工|省)/.test(t))g+=55;
  if(/(大方|不在乎钱|有钱|阔)/.test(t))g-=20;
  return Math.max(0,Math.min(100,g+dyGTalk(m)*0.3));}
async function dyRedGrabRun(gid,mid){const g=dyGroup(gid);if(!g)return;
  const red=dyGMsgs(g).find(x=>x&&x.id===mid&&x.kind==='red');if(!red||red.left<=0)return;
  let pool=dyGMemberList(g).filter(m=>m&&m.k!=='me'&&dyGMuteLeft(g,m.k)<=0);
  if(red.only)pool=pool.filter(m=>m.k===red.only);
  pool=pool.map(m=>({m,g:dyGreed(m)+Math.random()*40})).sort((a,b)=>b.g-a.g).map(x=>x.m);
  for(const m of pool){
    const live=dyGroup(gid),cur=live&&dyGMsgs(live).find(x=>x&&x.id===mid);
    if(!cur||cur.left<=0)return;
    await sleep(500+Math.random()*1400);
    const again=dyGroup(gid),r=again&&dyGMsgs(again).find(x=>x&&x.id===mid);
    if(!r||r.left<=0)return;
    /* 手气：最后一个拿走剩下的，其余随机分 */
    const share=r.left===1?r.rest:Math.max(0.01,+(Math.random()*r.rest/r.left*1.8).toFixed(2));
    const got=Math.min(r.rest,Math.max(0.01,share));
    r.left--;r.rest=+(r.rest-got).toFixed(2);
    (r.taken=r.taken||[]).push({k:m.k,name:dyGMemberName(m),amount:got});
    dyGSys(again,dyGMemberName(m)+' 领取了红包 ¥'+got.toFixed(2));
    dyDing();save();if(_dySub==='group'&&_dyGid===gid)render();}
}
function dyRedOpen(gid,mid){const g=dyGroup(gid),r=g&&dyGMsgs(g).find(x=>x&&x.id===mid&&x.kind==='red');if(!r)return;
  const rows=(r.taken||[]).map(t=>`<div class="row" style="display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:.5px solid rgba(127,127,135,.2)"><b style="flex:1;font-size:14px;font-weight:500">${esc(t.name)}</b><span style="color:#fa5151">¥${(+t.amount||0).toFixed(2)}</span></div>`).join('');
  openModal(`<h3>${esc(r.note||'恭喜发财')}</h3>
    <div class="hint">共 ${r.count} 个 · ¥${(+r.amount||0).toFixed(2)}${r.left>0?(' · 还剩 '+r.left+' 个'):' · 已被抢光'}</div>
    <div style="max-height:44vh;overflow:auto">${rows||'<div class="dycp-empty">还没有人抢～</div>'}</div>
    ${r.left>0&&!(r.taken||[]).some(t=>t.k==='me')?`<button class="dybtn out" style="margin-top:8px" onclick="dyRedGrabMe('${gid}','${mid}')">我也抢一个</button>`:''}
    <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function dyRedGrabMe(gid,mid){const g=dyGroup(gid),r=g&&dyGMsgs(g).find(x=>x&&x.id===mid&&x.kind==='red');if(!r||r.left<=0)return toast('手慢了，红包派完了');
  const got=r.left===1?r.rest:Math.max(0.01,+(Math.random()*r.rest/r.left*1.8).toFixed(2));
  const take=Math.min(r.rest,Math.max(0.01,got));
  r.left--;r.rest=+(r.rest-take).toFixed(2);
  (r.taken=r.taken||[]).push({k:'me',name:S.me.name||'我',amount:take});
  addBill('in',take,'抢到抖音群红包');
  dyGSys(g,(S.me.name||'我')+' 领取了红包 ¥'+take.toFixed(2));
  save();closeModal();render();toast('抢到 ¥'+take.toFixed(2));}
/* 卡片直接用微信那一套 markup 和样式（wx-transfer-card / cpay），
   只有点击行为换成抖音自己的——我上一版自己画了个蓝方块，长得完全不像。 */
function dyMoneyCardHTML(scope,id,m){const me=(m.from==='me'||m.k==='me');
  if(m.kind==='transfer'){const st=transferState(m),copy=dyTransferCopy(m,me),amount=(+m.amount||0).toFixed(2);
    const click=`event.stopPropagation();dyMoneyOpen('${scope}','${id}','${m.id||''}')`;
    return `<div class="wx-transfer-card ${me?'outgoing':'incoming'} state-${st}" role="button" tabindex="0" onclick="${click}"><div class="wx-transfer-main"><span class="wx-transfer-glyph">${transferGlyph(st)}</span><span class="wx-transfer-copy"><b>¥${amount}</b><em>${esc(copy)}</em></span></div><div class="wx-transfer-foot">${esc(m.toName?('转给 '+m.toName):'转账')}</div></div>`;}
  if(m.kind==='red'){const done=dyRedDone(m),cls='cpay '+(done?'done':'r'),ic=svgIc('redpacket',30,'#fff');
    const t1=done?'已领取':esc(m.note||'恭喜发财');
    const t2=done?('¥'+(+m.amount||0).toFixed(2)):(m.count>1?('抢红包 · 还剩 '+Math.max(0,+m.left||0)+' 个'):'领取红包');
    const click=`event.stopPropagation();dyMoneyOpen('${scope}','${id}','${m.id||''}')`;
    return `<div class="card" onclick="${click}"><div class="${cls}"><div class="big">${ic}</div><div><div class="t1">${t1}</div><div class="t2">${t2}</div></div></div><div class="cfoot">${m.count>1?'抖音群红包':'抖音红包'}</div></div>`;}
  return '';}
function dyTransferCopy(m,me){const st=transferState(m);
  if(st==='received')return me?'已被接收':'已收款';
  if(st==='refunded')return me?'已被退还':'已退还';
  return me?'你发起了一笔转账':'请收款';}
function dyRedDone(m){if(!m)return false;
  if(m.count>1)return (m.taken||[]).some(t=>t&&t.k==='me');
  return !!m.received;}
function dyMoneyFind(scope,id,mid){if(scope==='g'){const g=dyGroup(id);return g?(dyGMsgs(g).find(x=>x&&x.id===mid)||null):null;}
  const d=(S.dy.dms||[]).find(x=>x.id===id);return d?((d.msgs||[]).find(x=>x&&x.id===mid)||null):null;}
function dyMoneyOpen(scope,id,mid){const m=dyMoneyFind(scope,id,mid);if(!m)return;
  if(m.kind==='red'&&m.count>1)return dyRedOpen(id,mid);
  const me=(m.from==='me'||m.k==='me');
  if(m.kind==='red'){
    if(me)return toast(m.received?'对方已经领取了':'等对方领取');
    if(m.received)return toast('这个红包你已经收下了');
    m.received=true;addBill('in',+m.amount||0,'抖音收到红包');save();render();return toast('收下 ¥'+(+m.amount||0).toFixed(2));}
  const st=transferState(m);
  if(me)return toast(st==='received'?'对方已收款':st==='refunded'?'对方退还了这笔转账':'等对方收款');
  if(st!=='pending')return toast(st==='received'?'你已经收过了':'这笔你退还了');
  openModal(`<h3>收到一笔转账</h3><div class="hint">¥${(+m.amount||0).toFixed(2)}${m.note?' · '+esc(m.note):''}</div>
    <div class="btns"><button class="btn g" onclick="dyMoneyAct('${scope}','${id}','${mid}','refuse')">退还</button><button class="btn p" onclick="dyMoneyAct('${scope}','${id}','${mid}','take')">收下</button></div>`);}
function dyMoneyAct(scope,id,mid,act){const m=dyMoneyFind(scope,id,mid);if(!m)return;
  const amount=+m.amount||0;
  if(act==='take'){m.received=true;m.payState='received';addBill('in',amount,'抖音收到转账');toast('已收下 ¥'+amount.toFixed(2));}
  else{m.declined=true;m.payState='refunded';toast('已退还');}
  save();closeModal();render();}
function dyDMKey(d){return d?(d.cid?'c:'+d.cid:'n:'+String(d.name||'')):'';}
function dyOpenDMUser(id){const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return;dyOpenUser(dyDMKey(d));}
function dyDMQuick(){return ['在吗','刚看到你的作品','想你了','晚安'];}
function dyDMQuickSend(id,t){const inp=$('#dydm_in');if(inp){inp.value=t;}dySendDM(id);}
/* 点头像就进那个人的主页——真实抖音到处都是这样，所以每一个露头像的地方都要通。
   私信里的人可能是角色（c:<id>），也可能是个没有角色的网友（n:<名字>）。 */
function dyDMStamp(rows,mi){const m=rows[mi],prev=rows[mi-1];if(!m||!m.time)return '';
  if(prev&&prev.time&&m.time-prev.time<5*60000)return '';
  const t=new Date(m.time),hm=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'),day=dyListTime(m.time);
  return '<div class="dydm-t">'+esc(day===hm?hm:day+' '+hm)+'</div>';}
function renderDyDM(id){const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return '';
  if(d.unread){d.unread=0;save(0);}
  const rows=(d.msgs||[]);
  return `<div class="dydm">
    <div class="dydm-nav dy-safe-nav2"><i onclick="back()">‹</i><span class="dydm-who" onclick="dyOpenDMUser('${id}')">${dyFace(dyRA(d.cid,d.avatar),'sm')}</span><b class="dydm-who" onclick="dyOpenDMUser('${id}')">${esc(d.name)}</b>${dySparkBadge(d)}${d.cid?`<i onclick="placeCall('${d.cid}','voice')">${svgIc('phonecall',21,'#f2f2f4',2)}</i>`:''}<i onclick="dyDMMenu('${id}')">···</i></div>
    <div class="dydm-box" id="dydmbox" data-render-scroll-key="dydm:${esc(id)}">
      ${rows.length?rows.map((m,mi)=>`<div class="dydm-msg${m.from==='me'?' me':''}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}">${dyDMStamp(rows,mi)}<div class="dydm-line"><span class="dydm-who" onclick="${m.from==='me'?`dyTab='me';_dySub='';render()`:`dyOpenDMUser('${id}')`}">${m.from==='me'?av(dyAvatar(),'sm'):dyFace(dyRA(d.cid,d.avatar),'sm')}</span>${m.kind?`<div class="dydm-b${m.kind==='red'||m.kind==='transfer'||m.kind==='sticker'?' bare':' plain'}" onclick="dyDelDMMsg('${id}',${mi})">${dyMsgBodyHTML(m,'d',id)}</div>`:`<div class="dydm-b" onclick="dyDelDMMsg('${id}',${mi})">${esc(m.text)}</div>`}${m.from==='me'?'<span class="dydm-read" data-wx-read="已读"></span>':''}</div></div>`).join(''):'<div class="dyvi-empty">还没说过话～发条消息打个招呼吧。</div>'}
      ${dyTypingShown('dm:'+id)?dyTypingHTML(dyFace(dyRA(d.cid,d.avatar),'sm')):''}
    </div>
    <div class="dydm-quick">${dyDMQuick().map(t=>`<span onclick="dyDMQuickSend('${id}','${esc(t)}')">${esc(t)}</span>`).join('')}</div>
    ${dyEmojiPanelHTML('d',id)}
    <div class="dydm-bar${dyVoiceOn('d',id)?' voice-on':''}"><i onclick="dyDMPlus('${id}')">${svgIc('expand',20,'#c8c8d0',2)}</i><input id="dydm_in" placeholder="${dyVoiceOn('d',id)?'打字，发出来是语音条…':'发消息…'}" onkeydown="if(event.key==='Enter')dySendDM('${id}')"><i class="${dyVoiceOn('d',id)?'on':''}" onclick="dyVoiceToggle('d','${id}')">${svgIc('volume',20,dyVoiceOn('d',id)?'#fe2c55':'#c8c8d0',2)}</i><i class="${dyPanelOpen('d',id)?'on':''}" onclick="dyPanelToggle('d','${id}','emo')">${svgIc('smile',20,dyPanelOpen('d',id)?'#fe2c55':'#c8c8d0',2)}</i><i class="send" onclick="dySendDM('${id}')">${svgIc('forward',19,'#fff',2.2)}</i></div>
  </div>`;}
function dyDMMenu(id){const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return;
  openModal(`<h3>${esc(d.name)}</h3><div class="btns" style="flex-direction:column;gap:8px">
    <button class="dybtn out" onclick="closeModal();dyDMMute('${id}')">${d.mute?'取消消息免打扰':'消息免打扰'}</button>
    ${d.cid?`<button class="dybtn out" onclick="closeModal();dyVisitorOpenChar('${d.cid}')">看 TA 的抖音主页</button>`:''}
    <button class="dybtn out" onclick="closeModal();dyChatCtxEdit('dm','${id}')">上下文条数（现在 ${dyChatCtxRows(d)} 条）</button>
    <button class="dybtn out" onclick="closeModal();dyClearDM('${id}')">清空聊天记录</button>
    <button class="btn d" onclick="closeModal();deleteSocialDMThread('douyin','${id}')">删除这个会话</button>
    <button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function dyDMMute(id){const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return;d.mute=!d.mute;save();render();toast(d.mute?'已设为免打扰':'已取消免打扰');}
async function dyClearDM(id){const d=S.dy.dms.find(x=>x.id===id);if(!d)return;if(!await uiConfirm('清空和「'+d.name+'」的全部私信记录？'))return;d.msgs=[];save();render();toast('已清空');}
function removeSocialDMMsg(app,id,mi){const list=app==='x'?(S.x&&S.x.dms||[]):(S.dy&&S.dy.dms||[]),d=list.find(x=>x.id===id);if(!d||!Number.isInteger(mi)||mi<0||mi>=d.msgs.length)return null;return d.msgs.splice(mi,1)[0]||null;}
function removeSocialDMThread(app,id){const list=app==='x'?(S.x&&S.x.dms||[]):(S.dy&&S.dy.dms||[]),i=list.findIndex(x=>x.id===id);if(i<0)return null;return list.splice(i,1)[0]||null;}
function deleteSocialDMThread(app,id){if(!removeSocialDMThread(app,id))return;save();const open=cur();/* 正在看的会话被删后留在原页会渲染成空白黑屏，必须退回列表。 */if(open&&open.id===id&&open.p===(app==='x'?'xdm':'dydm'))back();else render();toast('已删除整段私信');}
async function dyDelDMMsg(id,mi){const d=S.dy.dms.find(x=>x.id===id);if(!d||!d.msgs[mi])return;if(!await uiConfirm('删除这条私信？'))return;if(!removeSocialDMMsg('douyin',id,mi))return;save();render();toast('已删除');}
function dySendDM(id){const d=S.dy.dms.find(x=>x.id===id);const inp=$('#dydm_in');const v=inp?inp.value.trim():'';if(!v)return;
  const voice=dyVoiceOn('d',id);
  d.msgs.push(voice?{from:'me',kind:'voice',text:v,time:Date.now()}:{from:'me',text:v,time:Date.now()});
  dySparkTick(d);save();render();dyDMReply(d);}
/* 群聊和私聊是通的：他在群里禁言了你，私信里他知道这件事，也能在私信里放你出来。 */
function dyMutedByChar(cid){if(!cid)return null;
  for(const g of dyGroups()){const left=dyGMuteLeft(g,'me');if(left<=0)continue;
    const by=dyGFind(g,dyGMeMutedBy(g));if(by&&by.cid===cid)return {g,left};}
  return null;}
function dyDMMutePrompt(cid){const hit=dyMutedByChar(cid);if(!hit)return '';
  return '\n\n# 现在的状况\n你刚在抖音群聊「'+hit.g.name+'」里把'+(S.me.name||'她')+'禁言了，还剩 '+dyGMuteText(hit.left)
    +'。她现在私信来找你，多半是想让你放她出来。放不放、要她说什么话才放，完全按你的性格来——心软就放，还在气头上就晾着她。'
    +'\n真要放她出来，就在你那句话里带上 [解禁|'+(S.me.name||'她')+']，指令本身不会显示出来。';}
function dyDMRunUnmute(cid,text){text=String(text||'');if(!cid)return text;
  return text.replace(/[\[【]\s*解禁\s*[|｜]\s*([^\]】]{1,24})[\]】]/g,(whole,who)=>{
    for(const g of dyGroups()){
      const by=dyGFind(g,dyGMeMutedBy(g));
      if(dyGMuteLeft(g,'me')>0&&by&&by.cid===cid){
        const r=dyGCmdApply(g,by.k,'unmute',who||(S.me.name||'我'));
        if(r&&r.ok){save();toast('他把你放出来了');return '';}}}
    return '';});}
/* 角色回的 [收款] [拒收] 这类指令以前原样当文字显示出来了。
   跟微信一样：抠出来执行掉，不让它出现在气泡里。 */
const DY_PAY_RE=/[\[【]\s*(收款|收下|领取|收红包|拒收|退还|退回)\s*[\]】]/g;
function dyPayLast(rows,fromMe){for(let i=rows.length-1;i>=0;i--){const m=rows[i];
  if(!m||(m.kind!=='transfer'&&m.kind!=='red'))continue;
  const me=(m.from==='me'||m.k==='me');if(me!==!!fromMe)continue;
  if(transferState(m)!=='pending'||m.received||m.declined)continue;
  return m;}
  return null;}
function dyRunPayCommands(rows,text){text=String(text||'');let did=0;
  const out=text.replace(DY_PAY_RE,(_,verb)=>{
    const take=/收款|收下|领取|收红包/.test(verb);
    const m=dyPayLast(rows,true);if(!m)return '';
    if(take){m.received=true;m.payState='received';}
    else{m.declined=true;m.payState='refunded';addBill('in',+m.amount||0,'抖音对方退还的'+(m.kind==='red'?'红包':'转账'));}
    did++;return '';});
  return {text:out.replace(/\s{2,}/g,' ').trim(),did};}
function dyPayRule(rows){const m=dyPayLast(rows,true);if(!m)return '';
  return '\n\n她刚给你发了一个'+(m.kind==='red'?'红包':'转账')+'，¥'+(+m.amount||0).toFixed(2)+(m.note?('，写着「'+m.note+'」'):'')
    +'。收不收由你自己决定：想收就在你那句话里带上 [收款]，不想要就带上 [拒收]，指令本身不会显示出来，别把方括号写进正文里。';}
async function dyDMReply(d){try{dyTypingOn('dm:'+d.id);const hist=d.msgs.slice(-dyChatCtxRows(d)).map(m=>({role:m.from==='me'?'user':'assistant',content:dyMsgPlain(m)}));let sys;
  const c=d.cid?getC(d.cid):null;
  if(c)sys=buildSystem(c)+'\n\n# 场景\n现在在【抖音私信】里和'+S.me.name+'聊天，口语、简短自然，别带方括号动作。'+dyDMMutePrompt(d.cid);
  else sys='你是抖音上的普通网友「'+d.name+'」，你自己的性格和说话方式：'+dyStrangerPersona(d)+'。与你聊天的是'+S.me.name+'，沿用你们真实私信的关系进度。保持自己的性格和兴趣，不强求暧昧，不要每次先说从谁的视频过来，不编造共同经历或对方隐私。口语、简短、自然，别带方括号。';
  sys+=dyDMBubbleRule()+dyPayRule(d.msgs||[]);
  const r=await dyAuxChat([{role:'system',content:sys},...hist],{max:dyReplyBudget()});
    const paid=dyRunPayCommands(d.msgs||[],dyDMRunUnmute(d.cid,cleanReply(r)));
    if(paid.did){save();if(cur().p==='dydm')render();}
    const parts=dyDMBubbles(paid.text);if(!parts.length)return;
    for(let i=0;i<parts.length;i++){
      if(i)await sleep(420+Math.random()*680);/* 一条条冒出来，不要糊成一坨 */
      const live=(S.dy.dms||[]).find(x=>x.id===d.id);if(!live)return;
      live.msgs.push({from:'them',text:parts[i],time:Date.now()});dyDing();
      if(!(cur().p==='dydm'&&cur().id===d.id))live.unread=(+live.unread||0)+1;
      dySparkTick(live);save();if(cur().p==='dydm')render();}
  }catch(e){dyModelFail('私信回复',e);}finally{dyTypingOff('dm:'+d.id);}}
/* 抖音私信跟微信一样能连发几条，1～4 条。抖音比微信随口，所以给的是「通常 1～2 条」，
   有情绪、有话说的时候才到 3～4 条。 */
function dyDMBubbleRule(){return '\n一次回复可以发 1 到 4 条短消息，每条单独占一行，用换行分开。平常 1 到 2 条就够，情绪上来、想多说几句时才发 3 到 4 条。不要写成一大段，也不要编号。';}
function dyDMBubbles(raw){const t=cleanReply(raw);if(!t)return [];
  const rows=String(t).split(/\n+/).map(x=>x.replace(/^[\d.、\-\s]*/,'').trim()).filter(Boolean);
  const out=(rows.length?rows:[t]).slice(0,4).map(x=>x.slice(0,300)).filter(Boolean);
  return out.length?out:[String(t).slice(0,300)];}
/* 我的主页 */
/* 抖音「我」页按真实抖音重做：封面＋头像行、四项数据、简介与标签、五个快捷入口、
   活动位、作品/日常/推荐/收藏/喜欢分栏、私密作品入口、九宫格。按钮以仿真为主，
   已有实现的（换头像、编辑资料、打开作品）照旧接上，其余只做展示不误导。 */
let _dyMeTab='作品';const DY_LOCS=['北京','上海','广东','江苏','浙江','四川','湖北','湖南','山东','福建','河南','重庆','陕西','辽宁','安徽'];
/* 真实抖音保留一位小数直到四位数（120.5万），再往上才取整；末尾的 .0 不显示。 */
function dyNum(n){n=Math.max(0,Math.floor(+n||0));if(n<10000)return String(n);const cut=(v,u)=>((v<1000?Math.round(v*10)/10:Math.round(v))+'').replace(/\.0$/,'')+u;return n<100000000?cut(n/10000,'万'):cut(n/100000000,'亿');}
function dyMeTabs(){return ['作品','收藏','喜欢'];}
function dyMeSetTab(t){_dyMeTab=t;render();}
function dyMeGridRows(){if(_dyMeTab==='喜欢')return (S.dy.liked||[]).filter(v=>!v.priv);
  if(_dyMeTab==='收藏')return [].concat(S.dy.mine||[],S.dy.feed||[],S.dy.liked||[]).filter((v,i,a)=>v.starred&&a.findIndex(x=>x.id===v.id)===i);
  const rows=(S.dy.mine||[]).filter(v=>!v.priv);
  return _dyWorkSort==='hot'?rows.slice().sort((a,b)=>(b.lk||0)-(a.lk||0)):rows.slice().sort((a,b)=>(b.top?1:0)-(a.top?1:0)||(b.ts||0)-(a.ts||0));}
function dyMeStat(v,label,act){return '<div class="dyme-stat"'+(act?' onclick="'+act+'"':'')+'><b>'+esc(v)+'</b><span>'+esc(label)+'</span></div>';}
function dyMeAction(icon,label,act){return '<div class="dyme-act"'+(act?' onclick="'+act+'"':'')+'>'+svgIc(icon,23,'#e9e9ec',1.7)+'<span>'+esc(label)+'</span></div>';}
function dyProfile(){const p=S.dy.profile||{},mine=S.dy.mine||[],priv=dyPrivateRows();
  const rows=dyMeGridRows(),cover=storedImageDisplaySource(p.cover||(isImg(dyAvatar())?dyAvatar():'')||'');
  const grid=rows.length?`<div class="dyme-grid">${rows.map((v,i)=>`<div class="dyme-cell" onclick="dyOpenWork('${v.id}')" style="background:${v.grad||DY_GRADS[i%DY_GRADS.length]}">${dyWorkThumbHTML(v)}${v.top&&_dyMeTab==='作品'?'<span class="dyme-top">置顶</span>':''}<span class="dyme-play">${svgIc('heart',11,'#fff',2.4)} ${dyNum(v.lk||0)}</span></div>`).join('')}</div>`
    :`<div class="dyme-empty">${_dyMeTab==='作品'?'还没发过作品～点下面的 ＋ 发一条':_dyMeTab==='收藏'?'还没收藏过作品～点开一条按右边的 ☆':'还没点过喜欢～'}</div>`;
  const ownCover=isImg(storedImageDisplaySource(p.cover||'')),ink=ownCover?'#fff':'#111';
  return `<div class="dyme" id="dyme">
    <div class="dyme-cover${ownCover?' has-img':''}" style="${isImg(cover)?`background-image:url(${cover})`:''}">
      <div class="dyme-topbar">
        <div class="dyme-addfriend" onclick="dyFollowList()">${svgIc('user',17,'#111',2)}<span>添加好友</span></div>
        <div class="dyme-cover-edit" onclick="changeDyCover()">${svgIc('image',15,ink,2)}<span>换背景</span></div>
        <div class="dyme-tools"><i class="dyme-tool" onclick="dyOpenUpdate()">${svgIc('route',19,ink,2)}</i><i class="dyme-tool" onclick="dyOpenVisitors()">${svgIc('users',19,ink,2)}${dyVisitorUnseen()?`<b class="dyme-badge">${dyVisitorUnseen()>99?'99+':dyVisitorUnseen()}</b>`:''}</i><i class="dyme-tool" onclick="dyOpenMeSearch()">${svgIc('search',19,ink,2)}</i><i class="dyme-tool" onclick="dyAllFeatures()">${svgIc('dots',19,ink,2)}</i></div>
      </div>
      <div class="dyme-idrow">
        <div class="dyme-avwrap" onclick="changeDyAvatar()">${av(dyAvatar(),'lg')}<i class="dyme-avplus">＋</i></div>
        <div class="dyme-idtext">
          <div class="dyme-name">${esc(dyNick())}${p.level?`<em class="dyme-lv">${esc(p.level)}</em>`:''}</div>
          <div class="dyme-dyid" onclick="dyCopyDyid()">抖音号：${esc(p.dyid||'')} ${svgIc('idcard',13,'#5a5a5f',2)}</div>
          <div class="dyme-ai" onclick="dyCompose()">${av(dyAvatar(),'sm')}<span>创作 AI 作品</span><b>›</b></div>
        </div>
      </div>
    </div>
    <div class="dyme-body">
      <div class="dyme-stats">
        ${dyMeStat(dyNum(p.likes),'获赞',"toast('这些赞来自你发过的作品')")}${dyMeStat(dyNum(p.mutual),'互关',"dyOpenRel('互关')")}${dyMeStat(dyNum((S.dy.following||[]).length),'关注',"dyOpenRel('关注')")}${dyMeStat(dyNum(p.fans),'粉丝',"dyOpenRel('粉丝指数')")}
        <button class="dyme-edit" onclick="editDyProfile()">编辑主页</button>
      </div>
      ${dyMeLoverLine()}
      <div class="dyme-bio${p.bio?'':' dim'}" onclick="${p.bio?'':'editDyProfile()'}">${String(p.bio||'点「编辑主页」写点什么吧～').split('\n').map(l=>`<div>${esc(l).replace(/@[^\s，,。]{1,20}/g,m=>'<b class="dyme-at">'+m+'</b>')||'&nbsp;'}</div>`).join('')}</div>
      <div class="dyme-tags">${(()=>{const bits=[p.gender,(p.age===''||p.age==null)?'':p.age+'岁',p.loc||''].filter(Boolean);return bits.length?`<span class="dyme-tag" onclick="editDyProfile()">${esc(bits.join(' · '))}</span>`:'';})()}<span class="dyme-tag dim" onclick="editDyProfile()">＋ 添加所在地等标签</span></div>
      <div class="dyme-acts">${dyMeAction('bag','我的订单',"dyGoOrders()")}${dyMeAction('clock','观看历史',"dyOpenHistory()")}${dyMeAction('wallet','我的钱包',"dyGoWallet()")}${dyMeAction('star','我的收藏',"dyMeSetTab('收藏')")}${dyMeAction('expand','全部功能',"dyAllFeatures()")}</div>
      ${S.dy.hidePromo?'':`<div class="dyme-promo"><div class="dyme-promo-thumb">🎬</div><div class="dyme-promo-text"><b>参与今天的话题</b><span>一起参与话题吧</span></div><button class="dyme-promo-btn" onclick="dyCompose()">● 去发布</button><i class="dyme-promo-x" onclick="S.dy.hidePromo=true;save();render();toast('不再显示了')">✕</i></div>`}
      <div class="dyme-tabs">${dyMeTabs().map(t=>`<span class="${_dyMeTab===t?'on':''}" onclick="dyMeSetTab('${t}')">${t}${t==='作品'?'<b onclick="event.stopPropagation();dyWorkSortMenu()"> ▾</b>':''}</span>`).join('')}</div>
      <div class="dyme-private" onclick="dyPrivateWorks()">${svgIc('lock',15,'#d8d8dc',2)}<span>私密作品</span><b>${priv.length}</b><i>›</i></div>
      ${grid}
      <div style="height:18px"></div>
    </div>
  </div>`;}
/* 绑了情侣空间，我的主页也该挂着恋人是谁——角色主页有，我这儿不能没有。
   点恋人的名字直接跳到 TA 的抖音主页。 */
function dyCoupleCid(){const cid=S.couple&&S.couple.cid;if(!cid)return '';const c=getC(cid);return c&&!c.deleted?cid:'';}
function dyMeLoverLine(){const cid=dyCoupleCid();if(!cid)return '';const c=getC(cid);
  return `<div class="dyus-line dyme-line">恋人：<em onclick="dyOpenUser('c:${esc(cid)}')">@${esc(c.remark||c.name)}</em></div>`;}
function dyGoMyProfile(){try{if(cur().p!=='dy')go('dy');}catch(_){go('dy');}
  dyTab='me';_dySub='';_dyWorkId='';render();}
function changeDyAvatar(){pickFile('image/*',async f=>{S.dy.profile.avatar=await compress(f,300,.8);save();render();toast('头像已换 🎨');});}
function editDyProfile(){_dySub='edit';_dyCmOpen=false;render();}
let _dySub='';let _dyWorkId='';let _dyCmOpen=false;let _dyCmTab='评论';let _dyCmFull=false;let _dyCmReply=-1;let _dyCmExpand={};
function dySubClose(){if(_dyCmOpen)return dyCmClose();
  try{if(cur().p==='dywork'){if(_dyWorkId)dyWatchFinish(_dyWorkId);_dySub='';_dyWorkId='';return back();}}catch(_){}
  if(_dySub==='work'&&_dyWorkId)dyWatchFinish(_dyWorkId);_dySub='';_dyWorkId='';render();}
function dyCmLayer(){if(!_dyCmOpen)return '';const v=dyVid(_dyWorkId);if(!v)return '';return dyCmSheet(v);}
/* ===== 抖音「编辑资料」页 ===== */
function dyProfileRows(){return [['nick','名字'],['bio','简介'],['gender','性别'],['birth','生日'],['loc','所在地'],['dyid','抖音号']];}
function dyProfileValue(k){const p=S.dy.profile||{};if(k==='nick')return p.nick||dyNick()||'';return String(p[k]===undefined||p[k]===null?'':p[k]);}
function dyProfileDone(){const p=S.dy.profile||{};const got=['nick','bio','gender','birth','loc','dyid'].filter(k=>String(dyProfileValue(k)||'').trim()).length+(p.avatar||S.me.avatar?1:0)+(p.cover?1:0);return Math.round(got/8*100);}
function dyAgeFromBirth(b){const t=Date.parse(b);if(!b||isNaN(t))return '';const d=new Date(t),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return (a>=0&&a<130)?a:'';}
function dyEditRow(k,label){const v=dyProfileValue(k);return `<div class="dyed-row" onclick="dyEditField('${k}')"><label>${esc(label)}</label><div class="v${v?'':' dim'}">${v?esc(v):'暂不设置'}</div><i>›</i></div>`;}
function dyEditNumRow(k,label){const p=S.dy.profile||{};const raw=k==='level'?(p.level||''):dyNum(p[k]||0);return `<div class="dyed-row" onclick="dyEditField('${k}')"><label>${esc(label)}</label><div class="v${raw?'':' dim'}">${raw?esc(String(raw)):'暂不设置'}</div><i>›</i></div>`;}
function dyEditView(){const p=S.dy.profile||{},cover=storedImageDisplaySource(p.cover||''),done=dyProfileDone();
  return `<div class="dyed" id="dyed">
    <div class="dyed-cover" style="${isImg(cover)?`background-image:url(${cover})`:''}">
      <div class="dyed-top"><i class="dyed-back" onclick="dySubClose()">‹</i><button class="dyed-coverbtn" onclick="changeDyCover()">${svgIc('camera',19,'#fff',2)}更换封面</button></div>
      <div class="dyed-avwrap" onclick="changeDyAvatar()">${av(dyAvatar(),'lg')}<span class="dyed-avmask">${svgIc('camera',26,'#fff',2)}更换头像</span></div>
    </div>
    <div class="dyed-sheet">
      <div class="dyed-prog"><i><b style="width:${done}%"></b></i><span>资料完成度 <b>${done}%</b></span></div>
      <div class="dyed-rows">${dyProfileRows().map(r=>dyEditRow(r[0],r[1])).join('')}</div>
    </div>
    <div class="dyed-gap"></div>
    <div class="dyed-sheet"><div class="dyed-row" onclick="toast('服务挂件只是摆设，点不进去～')"><label>服务挂件</label><div class="v">群聊</div><i>›</i></div></div>
    <div class="dyed-gap"></div>
    <div class="dyed-cap">下面这几项真实抖音不让改，小手机让你自己写</div>
    <div class="dyed-sheet">${dyEditNumRow('likes','获赞')}${dyEditNumRow('fans','粉丝')}${dyEditNumRow('mutual','互关')}${dyEditNumRow('level','等级牌')}</div>
    <div style="height:26px"></div>
  </div>`;}
function dyEditField(k){const p=S.dy.profile,L={nick:'名字',bio:'简介',gender:'性别',birth:'生日',loc:'所在地',dyid:'抖音号',likes:'获赞',fans:'粉丝',mutual:'互关',level:'等级牌'};
  if(k==='gender')return openModal(`<h3>性别</h3><div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">${['女','男','不展示'].map(g=>{const val=g==='不展示'?'':g;return `<button class="btn ${p.gender===val?'p':'g'}" onclick="dySetField('gender','${val}')">${g}</button>`;}).join('')}</div><button class="btn g" style="margin-top:10px" onclick="closeModal()">取消</button>`);
  const num=['likes','fans','mutual'].includes(k),cur=k==='birth'?(p.birth||''):String(p[k]===undefined||p[k]===null?'':p[k]);
  const ctl=k==='bio'?`<textarea id="dyed_v" rows="5" placeholder="介绍一下自己～可以换行">${esc(cur)}</textarea>`
    :`<input id="dyed_v" ${k==='birth'?'type="date"':num?'type="number"':''} value="${esc(cur)}" placeholder="${k==='nick'?esc(S.me.name||'昵称'):k==='loc'?'例如 江苏 苏州':k==='level'?'例如 15，留空不显示':''}">`;
  openModal(`<h3>${L[k]||''}</h3><div class="field">${ctl}</div>${k==='birth'?'<div style="font-size:12px;color:#888;margin-top:-4px">填了生日，主页上的年龄会自己算</div>':''}
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dySaveField('${k}')">保存</button></div>`);}
function dySetField(k,v){S.dy.profile[k]=v;save();closeModal();render();toast('已保存');}
function dySaveField(k){const el=$('#dyed_v'),raw=el?String(el.value||'').trim():'',p=S.dy.profile;
  if(['likes','fans','mutual'].includes(k))p[k]=Math.max(0,parseInt(raw,10)||0);
  else if(k==='level')p.level=raw.slice(0,4);
  else if(k==='birth'){p.birth=raw;p.age=dyAgeFromBirth(raw);}
  else if(k==='bio')p.bio=raw.slice(0,300);
  else p[k]=raw.slice(0,40);
  save();closeModal();render();toast('已保存');}
function changeDyCover(){pickFile('image/*',async f=>{S.dy.profile.cover=await compress(f,900,.82);save();render();toast('封面已换 🖼');});}
/* ===== 抖音「主页访客」页 ===== */
function dyVisitorSync(){dyInit();const d=S.dy;if(!Array.isArray(d.visitors))d.visitors=[];const seen=new Set(d.visitors.map(x=>x.k));let added=0;
  (d.following||[]).forEach(cid=>{const c=getC(cid);if(!c||c.deleted)return;const k='c:'+cid;if(seen.has(k))return;seen.add(k);d.visitors.unshift({k,cid,name:c.remark||c.name,avatar:c.avatar,ts:Date.now()-(added++)*36e5,seen:false,follows:true});});
  (d.mine||[]).forEach(v=>(v.comments||[]).forEach(cm=>{if(cm.me||cm.cid||!cm.name)return;const k='n:'+cm.name;if(seen.has(k))return;seen.add(k);d.visitors.unshift({k,name:cm.name,avatar:cm.avatar||'',ts:Date.now()-(added++)*36e5,seen:false,follows:((cm.name.length+cm.text.length)%3)!==0});}));
  if(d.visitors.length>60)d.visitors=d.visitors.slice(0,60);
  return added>0;}
function dyVisitorUnseen(){dyInit();return (S.dy.visitors||[]).filter(x=>!x.seen).length;}
function dyVisitorFollowed(x){return x.cid?(S.dy.following||[]).includes(x.cid):!!x.iFollow;}
function dyOpenVisitors(){if(dyVisitorSync())save(0);dyMarkAllSeen('vis',S.dy.visitors||[]);_dySub='visitors';render();}
function dyVisitorFollow(k){const x=(S.dy.visitors||[]).find(v=>v.k===k);if(!x)return;
  if(x.cid){const i=S.dy.following.indexOf(x.cid);if(i<0)S.dy.following.push(x.cid);else S.dy.following.splice(i,1);save();render();return toast(i<0?'已关注':'已取关');}
  x.iFollow=!x.iFollow;save();render();toast(x.iFollow?'已关注':'已取关');}
function dyVisitorTap(k){const x=(S.dy.visitors||[]).find(v=>v.k===k);if(!x)return;if(!x.seen){x.seen=true;save();}
  if(x.cid)return dyVisitorOpenChar(x.cid);render();toast('这是网友，点不进去主页～');}
function dyVisitorOpenChar(cid){const c=getC(cid);if(!c)return;_dySub='';render();openDyDMName(c.remark||c.name,cid,c.avatar);}
function dyVisitorRow(x){const fol=dyVisitorFollowed(x),lbl=fol?(x.follows?'相互关注':'已关注'):(x.follows?'回关':'关注');
  return `<div class="dyvi-row${dyWasFresh('vis',x.k)?' fresh':''}" onclick="dyOpenUser('${esc(x.k)}')"><i class="dyvi-dot${dyWasFresh('vis',x.k)?'':' off'}"></i>${dyFace(dyRA(x.cid,x.avatar),'sm')}<span class="dyvi-name">${esc(x.name)}</span><button class="dyvi-btn${fol?' on':''}" onclick="event.stopPropagation();dyVisitorFollow('${esc(x.k)}')">${lbl}</button><b class="dyvi-go">›</b></div>`;}
function dyVisitorsView(){const rows=S.dy.visitors||[];
  return `<div class="dyvi">
    <div class="dyvi-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i><b>主页访客</b><span onclick="dyVisitorSettings()">设置</span></div>
    <div class="dyvi-tip">仅展示 30 天内已授权的访客，访客记录仅你可见</div>
    <div class="dyvi-list" data-render-scroll-key="dy:visitors">${rows.length?rows.map(dyVisitorRow).join(''):'<div class="dyvi-empty">还没有人来过你的主页～<br>关注几个角色、或者让作品有人评论，<br>他们就会出现在这里。</div>'}</div>
  </div>`;}
function dyVisitorSettings(){const on=!S.dy.visitorHide;openModal(`<h3>访客记录</h3>
  <div class="row" style="display:flex;align-items:center;gap:10px;padding:8px 0"><div style="flex:1"><b style="font-size:14px">向他人展示我的访客记录</b><div style="font-size:12px;color:#888;margin-top:3px">关掉之后，别人看不到你去过他的主页</div></div><button class="btn ${on?'p':'g'}" onclick="S.dy.visitorHide=${on?'true':'false'};save();dyVisitorSettings()">${on?'已开启':'已关闭'}</button></div>
  <div class="btns" style="margin-top:8px"><button class="btn d" onclick="dyVisitorClear()">清空访客记录</button><button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function dyVisitorClear(){S.dy.visitors=[];save();closeModal();render();toast('访客记录已清空');}
/* ===== 抖音「作品详情」页（含漂浮弹幕） ===== */
function dyWorkViews(v){if(v.views==null){v.views=Math.round((v.lk||0)*(5+Math.random()*4))+Math.floor(Math.random()*900);save();}return v.views;}
function dyWorkCurId(){try{const c=cur();if(c&&c.p==='dywork'&&c.id)return c.id;}catch(_){}return _dyWorkId;}
function dyOpenWork(id){const v=dyVid(id);if(!v)return;_dyWorkId=id;_dySub='work';_dyCmOpen=false;_dyCmFull=false;_dyCmExpand={};_dyCmReply=-1;dyWorkViews(v);dyWatchRecord(v);
  /* 作品详情以前只是抖音页里的一个子状态，在角色主页（dyuser 是独立一页）上点它
     render() 画的还是主页——点了没反应。现在不在抖音页上就推成独立一页。 */
  try{const c=cur();
    if(c&&c.p==='dywork'){render();return dyMusicSoon();}
    if(!c||c.p!=='dy')return go('dywork',{id});}catch(_){}
  render();dyMusicSoon();}
function dyOpenLiked(id){dyOpenWork(id);}
function dyHash(t){return esc(String(t||'')).replace(/#[^\s#<]{1,20}/g,m=>'<b>'+m+'</b>')
  .replace(/@[^\s#@<，,。！!？?：:；;]{1,20}/g,m=>'<b class="dyat-tx">'+m+'</b>');}
function dyWorkDate(v){if(v.date)return v.date;if(!v.ts)return '';const d=new Date(v.ts);return (d.getMonth()+1)+'-'+d.getDate();}
function dyWorkDanmu(v){const mine=v.cid==='me',cs=(v.comments||[]).slice(0,2);
  const head=`<div class="dywk-dm">${(mine?av(dyAvatar(),'sm'):dyFace(dyRA(v.cid,v.avatar),'sm'))}<div class="dywk-dm-b"><span>${esc(mine?dyNick():(v.author||'用户'))}${dyWorkDate(v)?' · '+esc(dyWorkDate(v)):''}</span>${dyHash(v.desc||'')}</div></div>`;
  return `<div class="dywk-danmu" onclick="dyComments('${v.id}')">${head}${cs.map(cm=>`<div class="dywk-dm">${dyFace(dyRA(cm.cid,cm.avatar),'sm')}<div class="dywk-dm-b"><span>${esc(cm.name)}：</span>${dyHash(cm.text)}</div></div>`).join('')}</div>`;}
/* 首页和作品详情用的是同一条右边栏——她要的就是「位置一模一样」。
   两边各写一份，迟早又走偏，所以合成一个函数。
   每个按钮都要 stopPropagation：整块屏幕挂着双击点赞，不拦住的话点个爱心
   也会顺手被当成一次「轻触」。 */
function dyRailHTML(v){const liked=!!v.liked,lc=(v.lk||0)+(liked?1:0),starred=!!v.starred,sc=(v.st||0)+(starred?1:0);
  const mine=v.cid==='me',isChar=v.cid&&v.cid!=='me',fol=isChar&&(S.dy.following||[]).includes(v.cid);
  const same=v.img?`<img src="${storedImageDisplaySource(v.img)}" alt="">`:esc(v.emoji||'🎬');
  const stop='event.stopPropagation();';
  return `<div class="dywk-rail">
    <div class="dywk-av" onclick="${stop}dyVideoAuthor('${v.id}')"><span class="dywk-avwrap">${(mine?av(dyAvatar(),'sm'):dyFace(dyRA(v.cid,v.avatar),'sm'))}${isChar&&!fol?'<span class="dyrail-plus">+</span>':''}</span></div>
    <div class="dywk-r" onclick="${stop}dyLike('${v.id}')">${dyIc('heart',30,liked,'#f5243d','#fff')}${dyNum(lc)}</div>
    <div class="dywk-r" onclick="${stop}dyComments('${v.id}')">${dyCmIcon(29)}${dyNum((v.comments||[]).length)}</div>
    <div class="dywk-r" onclick="${stop}dyStar('${v.id}')">${dyIc('star',29,starred,'#f5c518','#fff',2)}${dyNum(sc)}</div>
    <div class="dywk-r" onclick="${stop}dyFwd('${v.id}')">${svgIcFill('forward',29,'#fff',1.1)}${dyNum(v.fw||0)}</div>
    <div class="dywk-r" onclick="${stop}dyWorkSame('${v.id}')"><span class="dywk-same">${same}</span>拍同款</div>
  </div>`;}
function dyWorkRail(v){return dyRailHTML(v);}
/* 拍同款：把这条的配乐带上，直接去发自己的一条 */
function dyWorkSame(id){const v=dyVid(id);if(!v)return;
  const s=dyMusicSongOf(v);
  _dyPost={kind:'img',src:'',desc:'',at:[],songId:s?s.id:'',music:s?((s.title||'未命名')+(s.artist?' · '+s.artist:'')):''};
  dyPostOpen('camera');
  toast(s?('配乐带上了：'+(s.title||'这首歌')):'挑张照片，发一条同款');}
function dyStar(id){const v=dyVid(id);if(!v)return;v.starred=!v.starred;save();render();toast(v.starred?'已收藏 ⭐':'已取消收藏');}
function dyWorkAuthor(id){const v=dyVid(id);if(!v)return;if(v.cid&&v.cid!=='me')return dyVisitorOpenChar(v.cid);_dySub='';dyTab='me';render();}
/* 「更多」并进转发那张单子了，这里留个别名，别处还叫得到 */
function dyWorkMore(id){return dyFwd(id);}
async function dyWorkDelete(id){closeModal();if(!await uiConfirm('删除这条作品？'))return;S.dy.feed=S.dy.feed.filter(v=>v.id!==id);S.dy.liked=S.dy.liked.filter(v=>v.id!==id);S.dy.mine=(S.dy.mine||[]).filter(v=>v.id!==id);save();_dySub='';_dyWorkId='';_dyCmOpen=false;render();toast('已删除');}
function dyWorkTopToggle(id){const v=dyVid(id);if(!v)return;v.top=!v.top;save();render();toast(v.top?'已置顶':'已取消置顶');}
function dyWorkAnalyze(id){const v=dyVid(id);if(!v)return;const views=dyWorkViews(v),lk=(v.lk||0)+(v.liked?1:0),cm=(v.comments||[]).length,st=(v.st||0)+(v.starred?1:0);
  const rate=views?Math.min(99,Math.round(lk/views*1000)/10):0;
  openModal(`<h3>视频分析</h3><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:6px">
    ${[['播放量',dyNum(views)],['点赞',dyNum(lk)],['评论',dyNum(cm)],['收藏',dyNum(st)],['点赞率',rate+'%'],['状态',v.top?'已置顶':'公开']].map(r=>`<div style="background:#f4f4f6;border-radius:10px;padding:11px"><div style="font-size:12px;color:#888">${r[0]}</div><div style="font-size:19px;font-weight:800;margin-top:3px">${esc(String(r[1]))}</div></div>`).join('')}
  </div><button class="btn g" style="margin-top:12px" onclick="closeModal()">关闭</button>`);}
function dyWorkView(){const v=dyVid(dyWorkCurId());if(!v)return `<div class="dyvi"><div class="dyvi-nav"><i onclick="dySubClose()">‹</i><b>作品</b><span></span></div><div class="dyvi-empty">这条作品已经不在了</div></div>`;
  const mine=v.cid==='me',grad=v.grad||DY_GRADS[0];
  return `<div class="dywk">
    <div class="dywk-stage">
      <div class="dywk-top dy-safe-nav2"><i onclick="dySubClose()">‹</i><i onclick="dyTab='search';_dySub='';render()">${svgIc('search',24,'#fff',2)}</i></div>
      <div class="dywk-frame${v.img?' photo':''}"${v.img?'':` style="background-image:${grad}"`} onclick="dyCardTap('${v.id}',event)">${dyWorkCardHTML(v,{full:true})}</div>
      ${dyWorkDanmu(v)}
      <div class="dynarr" id="narr_${v.id}" onclick="dyTapVideo('${v.id}')" style="display:${_dyNarr[v.id]?'block':'none'}"><div style="font-weight:800;color:#fff;margin-bottom:7px">视频内容</div>${esc(v.narration||v.desc||'（这条还没有内容描写）')}<div style="text-align:center;color:#777;margin-top:10px;font-size:11px">轻触收起</div></div>
    </div>
    ${dyWorkRail(v)}
    <div class="dywk-music">${dyWorkMusicHTML(v)}</div>
    <div class="dywk-bar">${mine?`<span>▶ ${dyNum(dyWorkViews(v))}浏览</span><button class="an" onclick="dyWorkAnalyze('${v.id}')">${svgIc('disk',17,'#f2f2f4',2)}视频分析 ⌃</button><span class="pub">公开</span>`:`<span>▶ ${dyNum(dyWorkViews(v))}浏览</span><button class="an" onclick="dyFwd('${v.id}')">${svgIc('forward',17,'#f2f2f4',2)}转发给角色</button><span class="pub">@${esc(v.author||'用户')}</span>`}</div>
  </div>`;}
/* ===== 抖音评论区（从屏幕下方弹出） ===== */
function dyComments(id){const v=dyVid(id);if(!v)return;v.comments=v.comments||[];_dyWorkId=id;_dyCmOpen=true;_dyCmTab='评论';_dyCmReply=-1;_dyCmFull=false;render();}
function dyCmClose(){_dyCmOpen=false;_dyCmReply=-1;render();}
function dyCmSetTab(t){_dyCmTab=t;render();}
function dyCmToggleFull(){_dyCmFull=!_dyCmFull;render();}
function dyCmRefresh(v){if(_dyCmOpen&&_dyWorkId===v.id)render();}
function dyCmToggle(ci){_dyCmExpand[ci]=!_dyCmExpand[ci];render();}
function dyCmReplyTo(ci){_dyCmReply=_dyCmReply===ci?-1:ci;render();const i=$('#dycm_in');if(i)i.focus();}
function dyCmLike(id,ci){const v=dyVid(id);if(!v||!v.comments||!v.comments[ci])return;const cm=v.comments[ci];cm.liked=!cm.liked;cm.lk=Math.max(0,(cm.lk||0)+(cm.liked?1:-1));save();render();}
function dyCmDelete(id,ci){const v=dyVid(id);if(!v||!v.comments)return;v.comments.splice(ci,1);save();_dyCmReply=-1;_dyCmExpand={};render();toast('已删除');}
function dyCmIsAuthor(v,cm){if(!v||!cm)return false;
  if(cm.me)return v.cid==='me';/* 我只有在自己的作品下才是作者 */
  return !!(cm.cid&&v.cid&&cm.cid===v.cid);}
function dyCmMeta(cm){const bits=[];if(cm.d)bits.push(esc(cm.d));if(cm.loc)bits.push('·&nbsp;'+esc(cm.loc));return bits.join(' ');}
function dyCmRow(v,cm,ci){const reps=cm.replies||[],open=!!_dyCmExpand[ci],author=dyCmIsAuthor(v,cm);
  const sub=reps.length?(open?reps.map(r=>`<div class="dycm-sub">${dyFace(r.avatar,'sm')}<div class="dycm-main"><div class="dycm-name">${esc(r.name)}${r.me?'<em class="dycm-author">我</em>':''}</div><div class="dycm-text">${dyHash(r.text)}</div><div class="dycm-meta">${dyCmMeta(r)}</div></div></div>`).join('')+`<div class="dycm-more" onclick="dyCmToggle(${ci})">收起 ⌃</div>`:`<div class="dycm-more" onclick="dyCmToggle(${ci})">展开 ${reps.length} 条回复 ⌄</div>`):'';
  return `<div class="dycm-row"><span onclick="dyOpenUser('${cm.cid?'c:'+cm.cid:'n:'+esc(String(cm.name||''))}')">${dyFace(dyRA(cm.cid,cm.avatar),'sm')}</span>
    <div class="dycm-main">
      <div class="dycm-name">${esc(cm.name)}${author?'<em class="dycm-author">作者</em>':cm.me?'<em class="dycm-author" style="background:#2c2c30;color:#b9b9c1">我</em>':cm.cid?'<em class="dycm-author" style="background:#2c2c30;color:#b9b9c1">角色</em>':''}</div>
      <div class="dycm-text">${dyHash(cm.text)}</div>
      <div class="dycm-meta">${dyCmMeta(cm)}<span class="a" onclick="dyCmReplyTo(${ci})">回复</span>${cm.me?`<span class="a" onclick="dyCmDelete('${v.id}',${ci})">删除</span>`:''}</div>
      ${sub}
    </div>
    <div class="dycm-like${cm.liked?' on':''}" onclick="dyCmLike('${v.id}',${ci})">${dyIc('heart',19,cm.liked,'#f5243d','#7b7b83',1.8)}${cm.lk||0}</div>
  </div>`;}
function dyCmCaptionRow(v){const mine=v.cid==='me';return `<div class="dycm-row">${mine?av(dyAvatar(),'sm'):dyFace(dyRA(v.cid,v.avatar),'sm')}<div class="dycm-main"><div class="dycm-name">${esc(mine?dyNick():(v.author||'用户'))}<em class="dycm-author">作者</em></div><div class="dycm-text">${dyHash(v.desc||'')}</div><div class="dycm-meta">${esc(dyWorkDate(v))}</div></div></div>`;}
function dyCmFanRows(v,kind){const names=[];const push=(n,a)=>{if(n&&!names.some(x=>x[0]===n))names.push([n,a]);};
  if(kind==='赞'&&v.liked)push(dyNick(),dyAvatar());if(kind==='收藏'&&v.starred)push(dyNick(),dyAvatar());
  (v.comments||[]).forEach(cm=>{if(cm.me)return;push(cm.name,cm.avatar||'');});
  const cut=kind==='收藏'?Math.ceil(names.length/2):names.length,rows=names.slice(0,cut);
  if(!rows.length)return `<div class="dycm-empty">还没有人${kind==='赞'?'点赞':'收藏'}～</div>`;
  return rows.map(r=>`<div class="dycm-row">${dyFace(r[1],'sm')}<div class="dycm-main"><div class="dycm-text" style="margin-top:0">${esc(r[0])}</div><div class="dycm-meta">${kind==='赞'?'赞过这条作品':'收藏了这条作品'}</div></div></div>`).join('');}
function dyCmSheet(v){const cs=v.comments||[],lk=(v.lk||0)+(v.liked?1:0),st=(v.st||0)+(v.starred?1:0);
  const tab=(k,n)=>`<span class="${_dyCmTab===k?'on':''}" onclick="dyCmSetTab('${k}')">${k} ${dyNum(n)}</span>`;
  const list=_dyCmTab==='评论'?(cs.length?dyCmCaptionRow(v)+cs.map((cm,ci)=>dyCmRow(v,cm,ci)).join(''):dyCmCaptionRow(v)+'<div class="dycm-empty">还没有评论，自己评一条，<br>或者点右边的 ✨ 让网友来热闹一下。</div>'):dyCmFanRows(v,_dyCmTab);
  const rep=_dyCmReply>=0&&cs[_dyCmReply]?('回复 @'+cs[_dyCmReply].name+'：'):'有爱评论，说点儿好听的';
  return `<div class="dycm-mask" onclick="dyCmClose()"></div>
  <div class="dycm${_dyCmFull?' full':''}">
    <div class="dycm-head">${tab('评论',cs.length)}${tab('赞',lk)}${tab('收藏',st)}<span class="sp"></span><i onclick="dyCmToggleFull()">${_dyCmFull?'⤡':'⤢'}</i><i onclick="dyCmClose()">✕</i></div>
    <div class="dycm-list" data-render-scroll-key="dycm:${esc(v.id)}:${esc(_dyCmTab)}">${list}</div>
    <div class="dycm-bar">${av(dyAvatar(),'sm')}<input id="dycm_in" placeholder="${esc(rep)}" onkeydown="if(event.key==='Enter')dyCmSend('${v.id}')"><i onclick="dyGenComments('${v.id}')">✨</i><i onclick="dyCmAt('${v.id}')">@</i><i class="send" onclick="dyCmSend('${v.id}')">${svgIc('forward',19,'#fff',2.2)}</i></div>
  </div>`;}
/* ===== 「我」页上原先点不动的地方，这一批全部接上 ===== */
let _dyRelTab='互关';let _dyRelQ='';let _dyHistTab='视频';let _dyHistOnly='';let _dyHistQ='';let _dyHistSearch=false;let _dyMeQ='';let _dyMeQRan=false;let _dyWorkSort='new';
function dyDayLabel(ts){if(!ts)return '';const d=new Date(ts),t=new Date(),y=new Date(t.getTime()-864e5);
  if(d.toDateString()===t.toDateString())return '今天';if(d.toDateString()===y.toDateString())return '昨天';
  return (d.getMonth()+1)+'-'+d.getDate();}
function dyWeekLabel(ts){if(!ts)return '';const d=new Date(ts),t=new Date();
  if(d.toDateString()===t.toDateString())return '今天';
  if(t-d<6*864e5)return '周'+'日一二三四五六'[d.getDay()];
  return (d.getMonth()+1)+'-'+d.getDate();}
