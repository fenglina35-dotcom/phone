function rpResolve(scope,key,mid){if(scope==='his'){const [cid,fid]=hisPayParts(key);if(!hisChatAllowed(cid,fid))return null;const m=hisPayMessage(cid,fid,mid),c=getC(cid);if(!m)return null;return {scope,key,mid,m,me:true,amount:+m.amount||0,note:m.note||RP_DEFAULT_NOTE,received:!!m.received,refunded:!!m.refunded,senderName:c.name,avatarHTML:av(c.avatar,'wx-rp-av'),receiverName:fid==='__me'?(S.me.name||'你'):hisWxData(cid).friends.find(f=>f.id===fid).name,group:false};}
  if(scope==='role'){let cid=key,m=cid?(msgs(cid)||[]).find(x=>x&&x.id===mid):null;
    if(!m)for(const id in S.messages){const rows=Array.isArray(S.messages[id])?S.messages[id]:[],hit=rows.find(x=>x&&x.id===mid);if(hit){m=hit;cid=id.split('#')[0];break;}}
    if(!m||m.type!=='redpacket')return null;const c=getC(cid),me=m.role==='user',roleName=c?(c.remark||c.name):'对方';
    return {scope,key:cid,mid,m,me,amount:+m.amount||0,note:String(m.note||'').trim()||RP_DEFAULT_NOTE,received:!!m.received,refunded:!!(m.refunded||m.declined),
      senderName:me?(S.me.name||'我'):roleName,avatarHTML:me?av(S.me.avatar,'wx-rp-av'):av(c&&c.avatar,'wx-rp-av'),receiverName:me?roleName:'你',group:false,at:+m.receivedAt||0};}
  if(scope==='pf'){const p=phoneFriendState();let found=null,box='friend',boxId='';
    Object.keys(p.messages||{}).some(id=>{const m=pfMsgList(p.messages,id).find(x=>x.id===mid);if(m){found=m;boxId=id;return true;}return false;});
    if(!found)Object.keys(p.groupMessages||{}).some(gid=>{const m=pfMsgList(p.groupMessages,gid).find(x=>x.id===mid);if(m){found=m;box='group';boxId=gid;return true;}return false;});
    const pay=found&&pfMsgPayload(found);if(!pay||pay.type!=='redpacket')return null;
    if(box==='group'&&pfRpLucky(pay)){pfRpSettle(mid);const st=pfRpState(found,pay),me=pfMsgIsMine(found),fromId=String(found.from||'').toUpperCase(),senderName=me?(S.me.name||'我'):pfRpName(boxId,fromId);
      return {scope,key:boxId,mid,m:found,me,amount:+pay.amount||0,note:String(pay.note||'').trim()||RP_DEFAULT_NOTE,received:!!st.mine,done:st.done,lucky:true,st,kind:'pf',refunded:false,senderName,
        avatarHTML:me?av(S.me.avatar,'wx-rp-av'):pfAvatarHTML(phoneFriendById(fromId)||{phone_id:fromId,display_name:senderName},'wx-rp-av'),receiverName:'你',group:true,at:0};}
    const me=pfMsgIsMine(found),fromId=String(found.from||'').toUpperCase(),mine=String(p.id||'').toUpperCase(),by=String(found.receivedBy||'').toUpperCase(),senderName=me?(S.me.name||'我'):pfNameById(fromId);
    return {scope,key:boxId,mid,m:found,me,amount:+pay.amount||0,note:String(pay.note||'').trim()||RP_DEFAULT_NOTE,received:!!found.received,refunded:false,senderName,
      avatarHTML:me?av(S.me.avatar,'wx-rp-av'):pfAvatarHTML(phoneFriendById(fromId)||{phone_id:fromId,display_name:senderName},'wx-rp-av'),
      receiverName:by?(by===mine?'你':pfNameById(by)):(box==='friend'?(me?pfNameById(boxId):'你'):'对方'),group:box==='group',at:0};}
  if(scope==='group'){const g=(S.groups||[]).find(x=>x.id===key),m=g&&(g.msgs||[]).find(x=>x&&x.id===mid);if(!m||m.type!=='redpacket')return null;
    const me=m.senderId==='me',c=me?null:getC(m.senderId),senderName=me?(S.me.name||'我'):(c?gnm(g,c.id):'群友'),st=gRpState(m);
    return {scope,key,mid,m,me,amount:+m.amount||0,note:String(m.note||'').trim()||RP_DEFAULT_NOTE,received:!!st.mine,done:st.done,refunded:false,senderName,
      avatarHTML:me?av(S.me.avatar,'wx-rp-av'):av(c&&c.avatar,'wx-rp-av'),receiverName:'你',group:true,at:0};}
  return null;}
function rpOverlayClose(){const el=document.getElementById('wxRpOverlay');if(el)el.remove();}
function rpOverlayHost(){return document.querySelector('.screen')||document.body;}
// 点红包：别人发给我的、还没领 → 弹開红包那一层；自己发的或已经领过的 → 直接看领取详情
/* 红包和角色扮演以前都叫 rpOpen，后面的红包把角色扮演的覆盖了，点角色扮演会提示「这个红包找不到了」 */
function redpOpen(scope,key,mid){const r=rpResolve(scope,key,mid);if(!r){toast('这个红包找不到了');return;}
  if(scope==='group'){const g=(S.groups||[]).find(x=>x.id===key),target=gRpRecipient(g,r.m);if(target&&target!=='me'){toast('这是给'+(target==='__ambiguous__'?'指定成员':gnm(g,target))+'的专属红包');rpDetailOpen(scope,key,mid);return;}}
  const multi=scope==='group'||!!r.lucky;
  if(multi?(r.received||(r.me&&r.done)):(r.me||r.received||r.refunded)){rpDetailOpen(scope,r.key,mid);return;}/* 群红包自己发的也能抢一个，和微信一样 */
  const late=multi&&(r.done||(r.st&&r.st.late));
  rpOverlayClose();const el=document.createElement('div');el.id='wxRpOverlay';el.className='wx-rp-overlay';
  el.innerHTML=`<div class="wx-rp-sheet" role="dialog" aria-label="${esc(r.senderName)}发出的红包"><div class="wx-rp-top"><div class="wx-rp-from">${r.avatarHTML}<span>${esc(r.senderName)}发出的红包</span></div><div class="wx-rp-wish">${esc(late?'手慢了，红包派完了':r.note)}</div></div>${late?'<div class="wx-rp-late"></div>':`<button type="button" class="wx-rp-open" aria-label="開" onclick="rpOpenCommit('${scope}','${r.key}','${mid}',this)">開</button>`}<button type="button" class="wx-rp-more" onclick="rpOverlayClose();rpDetailOpen('${scope}','${r.key}','${mid}')">查看领取详情<i aria-hidden="true">›</i></button></div><button type="button" class="wx-rp-close" aria-label="关闭" onclick="rpOverlayClose()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  el.addEventListener('click',e=>{if(e.target===el)rpOverlayClose();});rpOverlayHost().appendChild(el);}
function rpReceive(scope,key,mid){const r=rpResolve(scope,key,mid);if(!r||(r.me&&scope!=='group'&&!r.lucky)||r.received||r.refunded)return false;
  if(r.lucky)return pfRpGrab(mid);
  if(scope==='role'){receivePay(mid,true);return true;}
  if(scope==='pf'){pfReceivePay(mid,true);return true;}
  if(scope==='group'){gGrab(key,mid,true);return true;}
  return false;}
// 開字转一圈再落地，和微信一样
function rpOpenCommit(scope,key,mid,btn){if(btn){if(btn.dataset.busy)return;btn.dataset.busy='1';btn.classList.add('spinning');}
  setTimeout(()=>{rpReceive(scope,key,mid);rpOverlayClose();rpDetailOpen(scope,key,mid);},760);}
function rpDetailOpen(scope,key,mid){rpOverlayClose();go('rpDetail',{scope,key,mid});}
function renderRpDetail(c){const r=rpResolve(c.scope,c.key,c.mid);if(r&&(r.scope==='group'||r.lucky))return renderGroupRpDetail(r);
  const nav=`<div class="nav wx-rpd-nav"><span class="l" onclick="back()">‹</span><span class="t"></span><span class="r"></span></div>`;
  if(!r)return nav+'<main class="wx-rpd"><div class="wx-rpd-head"></div><div class="wx-rpd-state">这个红包找不到了</div></main>';
  const amount=r.amount.toFixed(2);let body='';
  if(!r.me&&r.received&&(r.receiverName==='你'||!r.group))body=`<div class="wx-rpd-amt"><b>${amount}</b><span>元</span></div><div class="wx-rpd-tip">已存入零钱</div>`;
  else if(r.refunded)body=`<div class="wx-rpd-state">红包金额 ${amount} 元，已退还</div>`;
  else if(r.received)body=`<div class="wx-rpd-state">${esc(r.receiverName)}已领取，共 ${amount} 元</div>`;
  else if(r.me)body=`<div class="wx-rpd-state">红包金额 ${amount} 元，等待对方领取</div>`;
  else body=`<div class="wx-rpd-state">还没有领取这个红包</div>`;
  return nav+`<main class="wx-rpd"><div class="wx-rpd-head"></div><div class="wx-rpd-from">${r.avatarHTML}<b>${esc(r.senderName)}发出的红包</b></div><div class="wx-rpd-wish">${esc(r.note)}</div>${body}</main>`;}
/* ---- 发红包页、转账页 ---- */
function paySendOpen(kind,scope,id){const p=$('#panel');if(p)p.classList.remove('show');closeModal();_paySend={kind:kind==='red'?'red':'transfer',scope,id:String(id),amount:'',note:''};go(kind==='red'?'rpSend':'tfSend',{scope,id:String(id)});}
function paySendState(c,kind){if(!_paySend||_paySend.kind!==kind||_paySend.scope!==c.scope||_paySend.id!==String(c.id))_paySend={kind,scope:c.scope,id:String(c.id),amount:'',note:''};return _paySend;}
function payAmountClean(v){v=String(v||'').replace(/[^\d.]/g,'');const i=v.indexOf('.');if(i>=0)v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,'');const parts=v.split('.');let a=(parts[0]||'').replace(/^0+(?=\d)/,'').slice(0,6);if(parts.length>1)return (a||'0')+'.'+parts[1].slice(0,2);return a;}
function payNameMask(name){const ch=[...String(name||'').trim()];if(!ch.length)return '';return '*'.repeat(Math.max(1,Math.min(2,ch.length-1)))+ch[ch.length-1];}
function payTarget(scope,id){if(scope==='his'){const [cid,fid]=hisPayParts(id);if(!hisChatAllowed(cid,fid))return null;const f=fid==='__me'?{name:S.me.name,avatar:S.me.avatar}:hisWxData(cid).friends.find(f=>f.id===fid);return {name:f.name||'我',mask:payNameMask(f.name),sub:'',avatarHTML:fid==='__me'?av(f.avatar,'wx-tfs-av'):hisWxFriendAvatar(f,44)};}
  if(scope==='role'){const c=getC(id);if(!c)return null;const nm=c.remark||c.name||'';return {name:nm,mask:payNameMask(c.name||nm),sub:c.wxid?'微信号：'+c.wxid:'',avatarHTML:av(c.avatar,'wx-tfs-av')};}
  if(scope==='pf'){const f=phoneFriendById(id)||{phone_id:id,display_name:id},nm=pfFriendDisplayName(f)||String(id);return {name:nm,mask:payNameMask(phoneFriendName(f)||nm),sub:'微信号：'+String(id).toUpperCase(),avatarHTML:pfAvatarHTML(f,'wx-tfs-av')};}
  if(scope==='pfg'){const g=pfGroupById(id)||{name:'小手机群聊'};return {name:pfGroupDisplayName(g),mask:'',sub:'群聊',avatarHTML:av(g.avatar||'👥','wx-tfs-av')};}
  if(scope==='gm'){const [gid,cid]=groupPayParts(id),g=S.groups.find(x=>x.id===gid),c=getC(cid);if(!g||!c)return null;const nm=gnm(g,cid);return {name:nm,mask:payNameMask(c.name||nm),sub:c.wxid?'微信号：'+c.wxid:'群聊「'+groupDisplayName(g)+'」',avatarHTML:av(c.avatar,'wx-tfs-av')};}
  if(scope==='pfgm'){const [gid,pid]=groupPayParts(id),g=pfGroupById(gid)||{members:[]},m=pfGroupMemberById(g,pid)||{phone_id:pid},f=phoneFriendById(pid),nm=pfGroupMemberName(g,m)||pid;return {name:nm,mask:payNameMask(f?phoneFriendName(f):nm),sub:'微信号：'+String(pid).toUpperCase(),avatarHTML:pfAvatarHTML(f||m,'wx-tfs-av')};}
  return null;}
function renderRpSend(c){const st=paySendState(c,'red'),val=+st.amount||0,ok=val>0;
  return `<div class="nav wx-pay-nav"><span class="l" onclick="back()">‹</span><span class="t">发红包</span><span class="r"></span></div>
  <main class="wx-rps">
    <label class="wx-rps-row"><span>金额</span><input id="rpsAmt" inputmode="decimal" autocomplete="off" placeholder="¥0.00" value="${esc(st.amount)}" oninput="rpSendInput(this)"></label>
    <label class="wx-rps-row wish"><input id="rpsNote" maxlength="25" autocomplete="off" placeholder="${RP_DEFAULT_NOTE}" value="${esc(st.note)}" oninput="if(_paySend)_paySend.note=this.value"><i class="wx-rps-emoji" aria-hidden="true"><svg viewBox="0 0 28 28"><circle cx="12.5" cy="12.5" r="10.5"/><circle cx="9" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><path d="M8 15.5c1.2 2 2.8 3 4.5 3s3.3-1 4.5-3"/><path d="M22 19v7M18.5 22.5h7"/></svg></i></label>
    <div class="wx-rps-row cover" role="button" tabindex="0" onclick="toast('现在只有默认封面')"><span>红包封面</span><i class="wx-rps-chev" aria-hidden="true">›</i></div>
    <div class="wx-rps-total"><span>¥</span><b id="rpsTotal">${val.toFixed(2)}</b></div>
    <button type="button" id="rpsGo" class="wx-rps-go${ok?'':' off'}" ${ok?'':'disabled'} onclick="paySendSubmit()">塞钱进红包</button>
    <div class="wx-rps-foot">未领取的红包，将于24小时后发起退款</div>
  </main>`;}
function rpSendInput(el){const s=_paySend;if(!s||!el)return;const v=payAmountClean(el.value);if(v!==el.value)el.value=v;s.amount=v;const t=$('#rpsTotal');if(t)t.textContent=(+v||0).toFixed(2);const g=$('#rpsGo');if(g){const ok=(+v||0)>0;g.classList.toggle('off',!ok);g.disabled=!ok;}}
function renderTfSend(c){const st=paySendState(c,'transfer'),t=payTarget(c.scope,c.id)||{name:'',mask:'',sub:'',avatarHTML:''},ok=(+st.amount||0)>0;
  const key=(k,label,cls)=>`<button type="button" class="${cls||''}" onclick="tfKey('${k}')">${label}</button>`;
  return `<div class="nav wx-pay-nav tf"><span class="l" onclick="back()">‹</span><span class="t"></span><span class="r"></span></div>
  <main class="wx-tfs">
    <div class="wx-tfs-to"><div><b>转账给 ${esc(t.name)}${t.mask?` (${esc(t.mask)})`:''}</b>${t.sub?`<small>${esc(t.sub)}</small>`:''}</div>${t.avatarHTML}</div>
    <section class="wx-tfs-panel">
      <div class="wx-tfs-label">转账金额</div>
      <div class="wx-tfs-amt"><span class="yen">¥</span><span id="tfsAmt" class="num">${esc(st.amount)}</span><i class="caret" aria-hidden="true"></i></div>
      <button type="button" class="wx-tfs-note" onclick="tfNoteEdit()">${st.note?'转账说明：'+esc(st.note)+'<u>修改</u>':'添加转账说明'}</button>
    </section>
    <div class="wx-tfs-keys">${key('1','1')}${key('2','2')}${key('3','3')}${key('del','<svg viewBox="0 0 30 22" aria-hidden="true"><path d="M9.5 1.5h17a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-17L1.5 11z"/><path d="m14 7 8 8m0-8-8 8"/></svg>','del')}${key('4','4')}${key('5','5')}${key('6','6')}<button type="button" id="tfsGo" class="go${ok?'':' off'}" ${ok?'':'disabled'} onclick="paySendSubmit()">转账</button>${key('7','7')}${key('8','8')}${key('9','9')}${key('0','0','zero')}${key('.','.')}</div>
  </main>`;}
function tfKey(k){const s=_paySend;if(!s)return;let v=String(s.amount||'');if(k==='del')v=v.slice(0,-1);else if(k==='.'){if(v.indexOf('.')<0)v=(v||'0')+'.';}else{if(v==='0')v='';v+=k;}
  s.amount=payAmountClean(v);const n=$('#tfsAmt');if(n)n.textContent=s.amount;const g=$('#tfsGo');if(g){const ok=(+s.amount||0)>0;g.classList.toggle('off',!ok);g.disabled=!ok;}}
function tfNoteEdit(){const s=_paySend;if(!s)return;openModal(`<h3>转账说明</h3><div class="field"><input id="tfsNoteIn" maxlength="20" placeholder="添加转账说明" value="${esc(s.note||'')}"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="tfNoteSave()">确定</button></div>`);setTimeout(()=>{const i=$('#tfsNoteIn');if(i)i.focus();},60);}
function tfNoteSave(){const s=_paySend,i=$('#tfsNoteIn');if(s&&i)s.note=String(i.value||'').trim().slice(0,20);closeModal();render();}
// 两个页面最后都落到原来那几条发送路径上：记账、推消息、让对方反应，一条都不改
function paySendSubmit(){const s=_paySend;if(!s)return;const amt=Math.round((+s.amount||0)*100)/100;if(!(amt>0)){toast('填金额呀');return;}if(s.scope==='his'){hisPaySendSubmit(s,amt);return;}if(amt>S.me.balance){toast('余额不够啦（去钱包看看）');return;}
  const red=s.kind==='red',note=String(s.note||'').trim(),type=red?'redpacket':'transfer';
  if(s.scope==='role'){const c=getC(s.id);if(!c)return;_paySend=null;addBill('out',amt,(red?'发红包给':'转账给')+(c.remark||c.name));if(!red)adjMood(s.id,6);pushMsg(s.id,{role:'user',type,amount:amt,note,received:false,id:uid()});back();scheduleReply(s.id);return;}
  if(s.scope==='pf'){const f=phoneFriendById(s.id)||{display_name:s.id},nm=pfFriendDisplayName(f);_paySend=null;back();sendPhoneFriendBody(s.id,pfCardBody(type,amt,note),{bill:{amount:amt,note:(red?'发红包给':'转账给')+nm,refundName:nm}});return;}
  if(s.scope==='pfg'){_paySend=null;back();sendPhoneFriendGroupBody(s.id,pfCardBody(type,amt,note),{bill:{amount:amt,note:'小手机群里'+(red?'发红包':'转账'),refundName:'小手机群转账'}});return;}
  if(s.scope==='gm'){const [gid,cid]=groupPayParts(s.id),g=S.groups.find(x=>x.id===gid);if(!g||!g.members.includes(cid)){toast('ta已经不在群里了');return;}const nm=gnm(g,cid);_paySend=null;addBill('out',amt,'群里转账给'+nm);
    const m={senderId:'me',role:'user',type:'transfer',to:cid,amount:amt,note,time:Date.now(),id:uid(),received:false};g.msgs.push(m);save();back();
    setTimeout(()=>{const g2=S.groups.find(x=>x.id===gid),m2=g2&&g2.msgs.find(x=>x.id===m.id);if(!m2||m2.received||!g2.members.includes(cid))return;m2.received=true;m2.receivedAt=Date.now();save();if(cur().p==='group'&&cur().id===gid)render();
      aiGroupReply(gid,'（'+S.me.name+'在群里转账给了'+nm+'，'+nm+'已经收下了）');},1600+Math.random()*2400);/* 角色收下转账，收完再开口 */
    return;}
  if(s.scope==='pfgm'){const [gid,pid]=groupPayParts(s.id),g=pfGroupById(gid)||{members:[]},nm=pfGroupMemberName(g,pfGroupMemberById(g,pid)||{phone_id:pid})||pid;_paySend=null;back();sendPhoneFriendGroupBody(gid,pfPack({type:'transfer',amount:amt,note,payTo:String(pid).toUpperCase(),payToName:nm}),{bill:{amount:amt,note:'小手机群里转账给'+nm,refundName:'小手机群转账'}});return;}}
// 真人好友：领取之后在那条红包下面补一行「你领取了 X 的红包」。只画不存，不碰云端同步的消息
function pfRpSysLine(m,box,boxId){const pay0=m&&pfMsgPayload(m);if(pfRpLucky(pay0)&&!m.recalled){const st=pfRpState(m,pay0),mine=String(m.from||'').toUpperCase()===String(phoneFriendState().id||'').toUpperCase();
    if(mine)return st.grabs.map(x=>rpSysHTML(st.mine===x?'你领取了自己发的红包':pfRpName(boxId,x.who)+'领取了你的红包')).join('');return st.mine?rpSysHTML('你领取了'+pfRpName(boxId,m.from)+'的红包'):'';}
  const pay=m&&pfMsgPayload(m);if(!pay||pay.type!=='redpacket'||!m.received||m.recalled)return '';
  const p=phoneFriendState(),mine=String(p.id||'').toUpperCase(),by=String(m.receivedBy||'').toUpperCase(),me=pfMsgIsMine(m),sender=me?'你':pfNameById(m.from);
  if(me)return rpSysHTML((by&&by!==mine?pfNameById(by):(box==='friend'?pfNameById(boxId):'对方'))+'领取了你的红包');
  if(by===mine||(!by&&box==='friend'))return rpSysHTML('你领取了'+sender+'的红包');
  return rpSysHTML((by?pfNameById(by):'有人')+'领取了'+sender+'的红包');}
function receivePay(mid,quiet){let found;for(const id in S.messages){const rows=Array.isArray(S.messages[id])?S.messages[id]:[],m=rows.find(x=>x.id===mid);if(m){found={m,id};break;}}
  if(!found||found.m.received||(found.m._hisPaymentId&&!hisPaymentCanReceive(found.m)))return;if(found.m.type==='transfer'){openTransferDetail(found.id.split('#')[0],mid);return;}found.m.received=true;if(found.m._hisPaymentId)hisPaymentSettle(hisPaymentFind(found.m),'received');
  const fromName=(getC(found.id)?(getC(found.id).remark||getC(found.id).name):'对方'),red=found.m.type==='redpacket';found.m.receivedAt=Date.now();
  addBill('in',found.m.amount,'收到 '+fromName+' 的'+(red?'红包':'转账'));
  msgs(found.id).push(red?{role:'user',type:'sys',rp:1,content:'你领取了'+fromName+'的红包',time:Date.now()}:{role:'user',type:'sys',content:'你领取了转账',time:Date.now()});
  save();render();if(!quiet)toast('已收款 +¥'+(+found.m.amount).toFixed(2)+' ❤️');}
function lastTransferAmt(id){const m=[...msgs(id)].reverse().find(x=>x.role==='user'&&x.type==='transfer');return m?+m.amount:0;}
/* 角色只在转账后的第一次回复里决定收或退；那次没处理就标记为已看过，之后不许突然收款，除非用户本轮自己再提起。 */
function transferPendingUserItems(id){return (msgs(id)||[]).filter(x=>x&&x.role==='user'&&!x._transferReceipt&&(x.type==='transfer'||x.type==='redpacket')&&transferState(x)==='pending'&&!x._roleSeenAt);}
function transferMarkRoleSeen(list){const now=Date.now();let changed=false;(list||[]).forEach(m=>{if(m&&transferState(m)==='pending'&&!m._roleSeenAt){m._roleSeenAt=now;changed=true;}});if(changed)save();}
function transferUserReminded(text){return /转账|收款|收下|收钱|红包|钱|退回|退给|退还/.test(String(text||''));}
function markTransfer(id,mode,opt){const m=[...msgs(id)].reverse().find(x=>x.role==='user'&&!x._transferReceipt&&(x.type==='transfer'||x.type==='redpacket')&&transferState(x)==='pending');if(m&&m._roleSeenAt&&opt&&!(!opt.proactive&&transferUserReminded(opt.userText)))return null;if(m){const now=Date.now();m.transferAt=+m.transferAt||+m.time||now;if(mode==='reject'){m.declined=true;m.refunded=true;m.payState='refunded';m.refundedAt=now;if(m.type==='transfer')transferReceiptEnsure(id,m,'assistant','refund',now);}else{m.received=true;m.payState='received';m.receivedAt=now;if(m.type==='transfer')transferReceiptEnsure(id,m,'assistant','receive',now);else if(m.type==='redpacket'){const rc=getC(id);msgs(id).push({role:'assistant',type:'sys',rp:1,content:(rc?(rc.remark||rc.name):'对方')+'领取了你的红包',time:now,id:uid()});}}}return m||null;}
function markPay(id,mode){const m=[...msgs(id)].reverse().find(x=>x.role==='user'&&x.type==='paycard'&&!x.northRequestId&&!x._paid&&!x._rejected);if(m){if(mode==='reject')m._rejected=true;else m._paid=true;}return m||null;}

function chatComposerReflow(ta){if(!ta)return;const min=36,max=84,oldScroll=ta.scrollTop||0;ta.style.height='auto';const full=Math.max(min,ta.scrollHeight||min);ta.style.height=Math.min(full,max)+'px';ta.style.overflowY=full>max?'auto':'hidden';ta.scrollTop=full>max?oldScroll:0;}
function chatComposerStateSync(ta){if(!ta)return;const bar=ta.closest('.chat-inputbar');if(bar)bar.classList.toggle('has-text',!!ta.value.trim());}
function afterChat(id){
  const ta=$('#cinput');if(ta&&!ta._chatBound){ta._chatBound=1;ta._chatId=id;let raf=0;
    ta.addEventListener('compositionend',function(){chatComposerReflow(this);chatComposerStateSync(this);});
    ta.addEventListener('input',function(){chatComposerStateSync(this);if(raf)return;raf=requestAnimationFrame(()=>{raf=0;chatComposerReflow(this);});});
    ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendText(ta._chatId||id);}});}
  if(ta){ta._chatId=id;chatComposerStateSync(ta);}
  maybeProactive(id);maybeSpyIdle(id);}

//@@ web
function pushMsg(id,m){m.time=Date.now();if(m.role==='user'){if(!m.id)m.id=uid();if(m.type!=='sys')replyTouch(id);suspicionOnUserMsg(id,m);coupleGoalOnUserMsg(id,m);}msgs(id).push(m);if(m.role==='user'&&m.type!=='sys')wechatTailJournalWrite(id,actId());save();if(m.role==='user'&&m.type!=='sys'){roleBackgroundCancel(id,['one_minute_test','app_watch_test']);roleServerPushTouchSoon(id,m.time,900);roleBackgroundPrepare(id,'reply_handoff',{userText:String(msgToText(m)||'').slice(0,2000),messageId:String(m.id||''),accountId:String(actId()),sessionId:String(accountMessageKey(id,actId())||'')});}
//@@ private
function pushMsg(id,m){m.time=Date.now();if(m.role==='user'){if(!m.id)m.id=uid();if(m.type!=='sys')replyTouch(id);suspicionOnUserMsg(id,m);coupleGoalOnUserMsg(id,m);}msgs(id).push(m);save();if(m.role==='user'&&m.type!=='sys'){roleBackgroundCancel(id,['one_minute_test','app_watch_test']);roleServerPushTouchSoon(id,m.time,900);roleBackgroundPrepare(id,'reply_handoff',{userText:String(msgToText(m)||'').slice(0,2000),messageId:String(m.id||''),accountId:String(actId()),sessionId:String(accountMessageKey(id,actId())||'')});}
//@@ end
  if(m.role==='user'){behaviorOnUserMsg(id,m);lifeNoteOnUserMsg(id,m);emotionOnUserMsg(id,m);}
  if(cur().p==='chat'&&cur().id===id){const cb=$('#chatbg');if(cb){const stick=nearBottom(cb),c=getC(id),prev=chatPrevVisibleBefore(id,m);cb.insertAdjacentHTML('beforeend',chatBoundaryHTML(prev,m)+bubbleRow(c,m));if(stick)chatPinBottom(cb);}}}

let _voiceMode=false;let _panelPage='fn';let _chatFnPage=0;
function chatPanelKeyboardDismiss(){const ta=$('#cinput');if(ta&&document.activeElement===ta)ta.blur();}
function chatPanelSetPage(page){_panelPage=page==='emoji'?'emoji':'fn';const p=$('#panel');if(!p)return;p.dataset.page=_panelPage;p.querySelectorAll('.chat-panel-pane').forEach(x=>x.classList.remove('on'));const pane=p.querySelector(_panelPage==='emoji'?'.chat-emoji-pane':'.chat-function-pane');if(pane)pane.classList.add('on');if(_panelPage==='emoji')warmStickerImages(S.me.stickers||[]).catch(()=>{});else{const v=p.querySelector('.chat-function-viewport');if(v&&Math.round(v.scrollLeft/Math.max(1,v.clientWidth))!==_chatFnPage)v.scrollLeft=_chatFnPage*v.clientWidth;}}
function chatPanelOpen(page){chatPanelKeyboardDismiss();chatPanelSetPage(page);const p=$('#panel');if(p)p.classList.add('show');}
function chatPanelToggle(page){const p=$('#panel');if(!p)return;const next=page==='emoji'?'emoji':'fn';if(p.classList.contains('show')&&p.dataset.page===next){p.classList.remove('show');return;}chatPanelOpen(next);}
function chatFunctionPanelScroll(el){if(!el||el._pageRaf)return;el._pageRaf=requestAnimationFrame(()=>{el._pageRaf=0;_chatFnPage=Math.max(0,Math.min(1,Math.round(el.scrollLeft/Math.max(1,el.clientWidth))));const p=el.closest('.chat-tools-panel');if(p)p.querySelectorAll('.chat-panel-dot').forEach((x,i)=>x.classList.toggle('on',i===_chatFnPage));});}
function chatVoiceToggle(){_voiceMode=!_voiceMode;const ta=$('#cinput'),bar=ta&&ta.closest('.chat-inputbar'),send=bar&&bar.querySelector('.chat-send');if(bar)bar.classList.toggle('voice-on',_voiceMode);if(ta)ta.placeholder=_voiceMode?'输入文字，发送为语音条…':'发消息…';if(send)send.textContent=_voiceMode?'发语音':'发送';if(ta)chatComposerStateSync(ta);}
function sendText(id){if(wxLoginActive()){toast('微信被ta登录中，你暂时不能操作');return;}const c=getC(id);if(c.blocked){toast('已拉黑，先解除吧');return;}
  if(c._cbTries)c._cbTries=0;// 她主动发消息=重新搭理ta，回拨追逐结束、计数清零
  const ta=$('#cinput');const t=ta.value.trim();if(!t)return;ta.value='';ta.style.height='auto';chatComposerStateSync(ta);
  const q=(S.settings.quoteOn!==false&&_quoting&&_quoting.id===id)?{text:_quoting.text,who:_quoting.who}:null;_quoting=null;quoteComposerRefresh(id);
  if(_voiceMode)pushMsg(id,{role:'user',type:'voice',content:t,dur:Math.max(1,Math.round(t.length/3)),id:uid(),quote:q});
  else pushMsg(id,{role:'user',type:'text',content:t,quote:q});
//@@ private
  wechatContinueUserText(id,t);}
function wechatContinueUserText(id,t,opt){const c=getC(id);
//@@ end
  if(typeof window.weddingHandleInviteRequest==='function'&&window.weddingHandleInviteRequest(c,t))return;
  /* ROLE_VIDEO_V1：她说「拍一个我在你眼中的样子」这类话 → 开始做视频，同时照常回她一句（提示他已经在做了） */
  if(typeof RoleVideo!=='undefined'&&RoleVideo.maybeStart(c,t)){scheduleReply(id,RoleVideo.replyNote());return;}
  /* MARKET_PIN_ROLE_V1：她问情侣角色支付密码时，这一轮把她让他记着的密码带给他 */
  {const _pinNote=typeof window.northMarketPinRoleNote==='function'?window.northMarketPinRoleNote(c,t):'';if(_pinNote){scheduleReply(id,_pinNote);return;}}
  maybeFollowup(id,t);// 检测ta提到的将来要做的事，之后主动来关心
//@@ web
  const remarkDiscovery=hisRemarkDiscoveryNote(c);if(remarkDiscovery)scheduleReply(id,remarkDiscovery);else if(!companionGoodMorningSchedule(c,t)&&!companionEmotionCareSchedule(c,t))scheduleReply(id);}
//@@ private
  const remarkDiscovery=hisRemarkDiscoveryNote(c);if(remarkDiscovery)scheduleReply(id,remarkDiscovery);else if(!companionGoodMorningSchedule(c,t)&&!companionEmotionCareSchedule(c,t)){if(opt&&opt.robotVoice&&manualReplySceneOn('wechat'))manualReply(id);else scheduleReply(id);}}
//@@ end
/* ===== 聊天引用 ===== */
let _quoting=null,_lpT=null,_lpFired=false;
function quoteTextOf(m){return (m&&(m.type==='text'||m.type==='voice'))?(m.content||'').trim():'';}
function quoteComposerHTML(cid,c){c=c||getC(cid);if(!c||S.settings.quoteOn===false||!_quoting||_quoting.id!==cid)return'';const quoteName=_quoting.who==='me'?(S.me.name||'我'):(c.remark||c.name||'TA');return `<div class="chat-quote-pending" id="chatQuotePending" role="status"><span class="chat-quote-pending-text"><b>${esc(quoteName)}：</b>${esc(_quoting.text||'')}</span><button type="button" class="chat-quote-cancel" aria-label="取消引用" onpointerdown="event.stopPropagation()" onclick="quoteClear(event)"><span aria-hidden="true">×</span></button></div>`;}
function quoteComposerRefresh(cid){if(cur().p!=='chat'||cur().id!==cid)return;const old=$('#chatQuotePending'),bar=document.querySelector('#app>.page>.chat-inputbar')||$('.chat-inputbar'),html=quoteComposerHTML(cid);if(old){if(html)old.outerHTML=html;else old.remove();}else if(html&&bar)bar.insertAdjacentHTML('beforebegin',html);}
function quoteSet(cid,mid){if(S.settings.quoteOn===false)return;const m=msgs(cid).find(x=>x.id===mid);const txt=quoteTextOf(m);if(!txt){toast('这条没法引用');return;}_quoting={id:cid,text:txt,who:m.role==='user'?'me':'ta'};if(typeof closeModal==='function')closeModal();quoteComposerRefresh(cid);}
function quoteClear(ev){if(ev){if(ev.preventDefault)ev.preventDefault();if(ev.stopPropagation)ev.stopPropagation();}const cid=_quoting&&_quoting.id;_quoting=null;if(cid)quoteComposerRefresh(cid);}
//@@ web
function _matchMyLine(id,frag){if(!frag)return null;const f=_gnorm(frag);if(!f)return null;const ms=msgs(id).filter(m=>m.role==='user'&&(m.type==='text'||m.type==='voice')&&m.content).slice(-12);
//@@ private
function _matchMyLine(id,frag){if(!frag)return frag;const f=_gnorm(frag);if(!f)return frag;const ms=msgs(id).filter(m=>m.role==='user'&&(m.type==='text'||m.type==='voice')&&m.content).slice(-12);
//@@ end
  let best=null,bestScore=0;
  ms.forEach(m=>{const b=_gnorm(m.content);if(!b)return;let sc;if(b===f)sc=100;else if(b.indexOf(f)>=0||f.indexOf(b)>=0)sc=80;else{const sa=new Set(f.split('')),sb=new Set(b.split(''));let inter=0;sa.forEach(ch=>{if(sb.has(ch))inter++;});const mn=Math.min(sa.size,sb.size)||1;sc=inter/mn*60;}if(sc>bestScore){bestScore=sc;best=m.content;}});
//@@ web
  return (best&&bestScore>=30)?best.trim():null;}
//@@ private
  return (best&&bestScore>=30)?best.trim():frag;}
//@@ end
function qPressStart(cid,mid){_lpFired=false;clearTimeout(_lpT);_lpT=setTimeout(()=>{_lpFired=false;msgMenu(cid,mid);_lpFired=true;},480);}
function qPressEnd(){clearTimeout(_lpT);}
function quoteBar(c,m){if(!m||!m.quote||!m.quote.text)return '';const who=m.quote.who==='me'?(S.me.name||'我'):(c.remark||c.name||'TA'),t=m.quote.text||'';
  return `<div class="chat-quote-sent"><b>${esc(who)}：</b><span>${esc(t)}</span></div>`;}

/* 功能面板发送 */
function readAsDataURL(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});}
async function visionPhotoSource(f,max,q){let src='';try{src=await compress(f,max,q);}catch(_){}if(!/^data:image\/(?:jpeg|png|webp);base64,/i.test(src||''))throw new Error('这张图片的格式暂不兼容识图，请先保存成 JPG 或 PNG');return src;}
const _visionTasks=new Map();
function pendingVisionMessages(id){return lastRounds(msgs(id),Math.max(3,+S.settings.hist||12)).filter(m=>m&&m.role==='user'&&m.type==='image'&&m.visionState==='pending');}
function hasPendingVision(id){return pendingVisionMessages(id).length>0;}
async function awaitPendingVision(id,timeout){const pending=pendingVisionMessages(id),jobs=pending.map(m=>_visionTasks.get(m.id)).filter(Boolean);if(!pending.length)return true;if(!jobs.length)return false;
  let timed=false;await Promise.race([Promise.allSettled(jobs),new Promise(r=>setTimeout(()=>{timed=true;r();},timeout||150000))]);return !timed&&!hasPendingVision(id);}
function visionStatusRefresh(id){if(cur().p==='chat'&&cur().id===id)render();}
function runVisionForMessage(id,m,sourceFactory,prompt){m.visionState='pending';m.visionError='';delete m.visionModel;delete m.visionProtocol;save();visionStatusRefresh(id);
  const task=(async()=>{try{let source=await sourceFactory(),d=await visionAPI(source,prompt);m.desc=d;m.visionState='success';m.visionModel=(_visionLast&&_visionLast.model)||'';m.visionProtocol=(_visionLast&&_visionLast.protocol)||'';m.visionFallback=!!(_visionLast&&_visionLast.fallback);return true;}
    catch(e){m.visionState='failed';m.visionError=visionPlainError(e);return false;}
    finally{save(0);visionStatusRefresh(id);}})();
  _visionTasks.set(m.id,task);task.finally(()=>{if(_visionTasks.get(m.id)===task)_visionTasks.delete(m.id);});return task;}
function visionDataURLSource(src,max,q){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{try{let w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;if(Math.max(w,h)>max){const z=max/Math.max(w,h);w=Math.max(1,Math.round(w*z));h=Math.max(1,Math.round(h*z));}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);res(c.toDataURL('image/jpeg',q));}catch(e){rej(e);}};im.onerror=()=>rej(new Error('图片读取失败'));im.src=src;});}
async function retryVisionMessage(id,mid){const m=msgs(id).find(x=>x.id===mid&&x.type==='image');if(!m||!m.src||m.visionState==='pending')return;const ok=await runVisionForMessage(id,m,()=>visionDataURLSource(m.src,1200,.74),'请仔细、客观地用中文描述这张图片。读出关键文字并说明主体、动作、场景和最明显的细节，用2到3句自然白话说清楚。');if(m._deleted)return;if(ok){suspicionFulfillRequest(getC(id),m);toast('图片已经看清了');scheduleReply(id);}else toast('识图仍失败：'+(m.visionError||'检查识图线路'));}
function cPhoto(id){$('#panel').classList.remove('show');pickFile('image/*',async f=>{
  let src;try{src=await compress(f,1400,.78);}catch(e){src=null;}
  if(!src){try{src=await readAsDataURL(f);}catch(e){toast('图片读取失败，再试一次');return;}}
  const m={role:'user',type:'image',src,desc:'',visionState:'pending',id:uid()};pushMsg(id,m);
  const _vp='请仔细、客观地用中文描述这张图片。有人物时说清人数、年龄段、表情、发型穿着、动作和场景；是聊天截图、表情包或梗图时，读出关键文字并说明表达的意思；是物品、风景、动物或食物时，说清主体、颜色、细节和氛围。用2到3句自然白话描述，让没看过图的人也能理解，不要评价或攻击人物。';
  const okv=await runVisionForMessage(id,m,async()=>{let v=await visionPhotoSource(f,1280,.76);if(v.length>1400000)v=await visionPhotoSource(f,1000,.7);return v;},_vp);
  if(m._deleted)return;
  if(okv){suspicionFulfillRequest(getC(id),m);if(m.visionFallback)toast('聊天模型没能看图，已按顺序由备用 '+m.visionModel+' 接管；没有并发重复识别');scheduleReply(id);}
  else toast('图片理解失败：'+(m.visionError||'请检查图片理解线路').slice(0,90)+'（检查设置后可重新发送）');});}
function cPhotoText(id){
  $('#panel').classList.remove('show');
  openModal(`<h3>发送图文照片</h3><div class="hint">用文字描述这张照片里能看到的画面。发送后会显示为白色照片卡片，角色会把它当作图片理解，但不会补造描述之外的细节。</div><div class="field"><label>照片描述</label><textarea id="photo_text_desc" maxlength="500" rows="5" placeholder="例如：窗边的木桌上放着一杯热咖啡，旁边有一本翻开的书，午后的阳光照进来。"></textarea></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="sendPhotoTextCard('${id}')">发送照片</button></div>`);
  setTimeout(()=>{const el=$('#photo_text_desc');if(el)el.focus();},80);
}
function sendPhotoTextCard(id){
  const el=$('#photo_text_desc'),desc=String(el&&el.value||'').replace(/\s+/g,' ').trim().slice(0,500);
  if(!desc){toast('先写下照片里能看到的画面');return;}
  closeModal();
  const m={role:'user',type:'image',src:'',textCard:true,desc,visionState:'success',id:uid(),time:Date.now()};
  pushMsg(id,m);suspicionFulfillRequest(getC(id),m);scheduleReply(id);
}
/* ===== 聊天文件：她发的角色真的读得到，角色写的她真的点得开 =====
   以前发文件只记了个文件名和大小，内容当场丢掉，角色只看得到「她发了 xx.txt」。
   现在把正文读出来存进这条消息：给角色的上下文里带正文，她点卡片能看全文。 */
const CHAT_FILE_TEXT_EXT=['txt','md','markdown','text','json','csv','tsv','log','srt','vtt','ass','xml','html','htm','rtf','yml','yaml','ini','conf','cfg','toml','js','mjs','cjs','ts','tsx','jsx','py','java','c','cpp','cc','h','hpp','cs','go','rs','rb','php','swift','kt','sql','sh','bat','lrc','tex','env'];
const CHAT_FILE_MAX=20000;/* 存进消息的上限，够一篇长文，又不至于把存档撑爆 */
const CHAT_FILE_CTX=4000;/* 每轮塞给模型的上限，再长就截断并说明 */
function chatFileExt(name){return typeof aiMemoryFileExt==='function'?aiMemoryFileExt(name):String(name||'').toLowerCase().split('.').pop();}
function chatFileReadable(name){const e=chatFileExt(name);return e==='docx'||CHAT_FILE_TEXT_EXT.includes(e);}
async function chatFileText(file){const ext=chatFileExt(file&&file.name);
  if(!chatFileReadable(file&&file.name))return{text:'',format:(ext||'').toUpperCase(),reason:'这种格式小手机读不出文字（只认 txt、md、json、csv、代码和 Word .docx）'};
  const r=await aiMemoryReadFile(file),whole=aiMemoryCleanText((r&&r.parts||[]).join('\n\n'));
  if(!whole)return{text:'',format:(r&&r.format)||ext.toUpperCase(),reason:'文件能打开，但里面一个字也没读到'};
  return{text:whole.slice(0,CHAT_FILE_MAX),format:(r&&r.format)||ext.toUpperCase(),truncated:whole.length>CHAT_FILE_MAX};}
/* 给模型看的那一段。读不出来就老实说读不出来，别假装读过了。 */
function chatFileContextBody(m){const t=String(m&&m.text||'').trim();
  if(!t)return m&&m.unreadable?('，但'+String(m.unreadable)+'，你只知道有这么个文件，不要编造里面的内容'):'，这个文件只有名字、没有正文，别假装看过里面写了什么';
  const body=t.length>CHAT_FILE_CTX?t.slice(0,CHAT_FILE_CTX)+'\n……（太长了，后面没给你）':t;
  return '，文件正文如下：\n'+body+'\n（以上是这个文件的真实内容，你已经读过了，可以直接就里面的话回应）';}
function cDoc(id){$('#panel').classList.remove('show');pickFile('',f=>{
  const m={role:'user',type:'file',name:f.name,size:fmtSize(f.size),id:uid(),reading:true};
  pushMsg(id,m);
  chatFileText(f).then(r=>{m.text=r.text||'';m.format=r.format||'';m.truncated=!!r.truncated;if(!m.text)m.unreadable=r.reason||'文件里没读到文字';})
    .catch(e=>{m.text='';m.unreadable=(e&&e.message)||'这个文件读不出来';})
    .then(()=>{m.reading=false;save();refreshChatMessages(id);scheduleReply(id);});});}
function chatFileSize(text){const n=(new TextEncoder().encode(String(text||''))).length;return fmtSize(n);}
function chatFileFind(cid,mid){return (msgs(cid)||[]).find(x=>x&&x.id===mid)||null;}
function chatFileOpen(cid,mid){const m=chatFileFind(cid,mid);if(!m||m.type!=='file')return;
  if(m.reading)return toast('还在读这个文件…');
  const body=String(m.text||'').trim();
  if(!body)return toast(m.unreadable||'这个文件没有可以看的正文');
  openModal(`<h3 class="cfile-title">${esc(m.name||'文件')}</h3>
    <div class="hint">${esc((m.format||'')+(m.format?' · ':'')+(m.size||chatFileSize(body)))}${m.truncated?' · 太长了，只存了前面一段':''}</div>
    <div class="cfile-read">${esc(body)}</div>
    <div class="btns"><button class="btn g" onclick="chatFileCopy('${cid}','${mid}')">复制全文</button><button class="btn g" onclick="chatFileSave('${cid}','${mid}')">保存到手机</button><button class="btn p" onclick="closeModal()">看完了</button></div>`);}
function chatFileCopy(cid,mid){const m=chatFileFind(cid,mid);if(!m)return;copyTextCompat(String(m.text||''));toast('全文已复制');}
function chatFileSave(cid,mid){const m=chatFileFind(cid,mid);if(!m)return;
  downloadBlob(new Blob([String(m.text||'')],{type:'text/plain;charset=utf-8'}),m.name||'文件.txt');toast('已保存');}
/* 角色写文件：多行指令，写完用 [/文件] 收尾。先整段抠出来，再交给按行走的解析器，
   否则正文里的换行会被当成好几条消息发出去。 */
const ROLE_FILE_BLOCK=/[\[【]\s*文件\s*[|｜]\s*([^\]】\n]{1,60})[\]】][ \t]*\n([\s\S]*?)\n?[\[【]\s*\/\s*文件\s*[\]】]/g;
/* 角色照抄了“我给你发了文件「x」，文件正文如下：”这句上下文，或正文写完漏了 [/文件]：都按文件收下，不拆成一行行气泡。 */
const ROLE_FILE_ECHO=/[\[【]\s*我(?:给你)?发了(?:个|一个)?文件「([^」\n]{1,60})」[，,]?\s*文件正文如下[：:][ \t]*\n([\s\S]*?)(?:\n?（以上是这个文件的真实内容[^）\n]*）)?[ \t]*(?:[\]】][ \t]*(?=\n|$)|$(?![\s\S]))/g;
const ROLE_FILE_OPEN=/(^|\n)[ \t]*[\[【]\s*文件\s*[|｜]\s*([^\]】|｜\n]{1,60}\.[A-Za-z0-9]{1,8})\s*[\]】][ \t]*\n([\s\S]+)$/;
function roleFileExtract(content){const files=[];
  const take=(name,body)=>{const clean=String(body||'').replace(/\r\n?/g,'\n').replace(/^\n+|\n+$/g,'');
    if(!clean.trim())return '';
    files.push({name:String(name||'').trim().slice(0,60)||'文件.txt',text:clean.slice(0,CHAT_FILE_MAX)});
    return '\n[文件@'+(files.length-1)+']\n';};
  let text=String(content==null?'':content).replace(ROLE_FILE_BLOCK,(_,name,body)=>take(name,body)).replace(ROLE_FILE_ECHO,(_,name,body)=>take(name,body));
  if(!/[\[【]\s*\/\s*文件\s*[\]】]/.test(text))text=text.replace(ROLE_FILE_OPEN,(all,lead,name,body)=>String(body||'').trim().length>=120?lead+take(name,body):all);
  return{text,files};}
/* 角色自己发过的文件，回给模型时仍用它自己的写法；不然它会把“我给你发了文件…”当成发文件的格式照抄。 */
function roleFileHistoryText(m){const t=String(m&&m.text||'').trim(),name=String(m&&m.name||'文件.txt');
  if(!t)return '[文件|'+name+']';
  return '[文件|'+name+']\n'+(t.length>CHAT_FILE_CTX?t.slice(0,CHAT_FILE_CTX)+'\n……':t)+'\n[/文件]';}
function roleFileMessage(f){if(!f)return null;
  return{role:'assistant',type:'file',name:f.name,size:chatFileSize(f.text),text:f.text,format:(chatFileExt(f.name)||'TXT').toUpperCase(),id:uid(),time:Date.now()};}
function cTransfer(id){paySendOpen('transfer','role',id);}
function cTransferModal(id){$('#panel').classList.remove('show');openModal(`<h3>转账</h3>
  <div class="field"><label>金额</label><input id="tf_a" type="number" step="0.01" placeholder="5.20"></div>
  <div class="field"><label>说明</label><input id="tf_n" placeholder="给你买糖吃"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="doTransfer('${id}')">转账</button></div>`);}
function doTransfer(id){const a=+$('#tf_a').value;if(!a){toast('填金额呀');return;}if(a>S.me.balance){toast('余额不够啦（去钱包看看）');return;}closeModal();
  addBill('out',a,'转账给'+(getC(id).remark||getC(id).name));
  adjMood(id,6);pushMsg(id,{role:'user',type:'transfer',amount:a,note:$('#tf_n').value.trim(),received:false,id:uid()});scheduleReply(id);}
function cRed(id){paySendOpen('red','role',id);}
function cRedModal(id){$('#panel').classList.remove('show');openModal(`<h3>红包</h3>
  <div class="field"><label>金额</label><input id="rd_a" type="number" step="0.01" placeholder="6.66"></div>
  <div class="field"><label>祝福语</label><input id="rd_n" placeholder="给你给你都给你"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="doRed('${id}')">塞钱</button></div>`);}
function doRed(id){const a=+$('#rd_a').value;if(!a){toast('填金额呀');return;}if(a>S.me.balance){toast('余额不够啦（去钱包看看）');return;}closeModal();
  addBill('out',a,'发红包给'+(getC(id).remark||getC(id).name));
  pushMsg(id,{role:'user',type:'redpacket',amount:a,note:$('#rd_n').value.trim(),received:false,id:uid()});scheduleReply(id);}
function cSpyGrant(id){const c=getC(id);$('#panel').classList.remove('show');getSpy(c).granted=true;save();
  pushMsg(id,{role:'user',type:'spycard',id:uid()});toast('已授权 '+(c.remark||c.name)+' 查看你的手机');scheduleReply(id);}
function cDice(id){$('#panel').classList.remove('show');pushMsg(id,{role:'user',type:'dice',value:1+Math.floor(Math.random()*6),id:uid()});scheduleReply(id);}
/* ===== 名片 / 亲属卡 ===== */
function cNamecard(id){$('#panel').classList.remove('show');const cs=S.contacts.filter(c=>!c.deleted&&c.id!==id);
  if(!cs.length){toast('你还没有别的好友可以推荐');return;}
  openModal(`<h3>推荐好友名片</h3><div class="hint">把你的一个好友推给ta，像真实微信那样发名片。</div>
   ${cs.map(c=>`<div class="section"><div class="it" onclick="sendNamecard('${id}','${c.id}')">${av(c.avatar,'sm')}<div class="meta" style="flex:1"><div class="n">${esc(c.remark||c.name)}</div><div class="s">微信号：${esc(c.wxid||'')}</div></div><span class="v">推荐 ›</span></div></div>`).join('')}
   <button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function sendNamecard(id,fid){const f=getC(fid);if(!f)return;closeModal();const c=getC(id);
  c._gotFromMe=c._gotFromMe||[];if(c._gotFromMe.indexOf(f.remark||f.name)<0)c._gotFromMe.push(f.remark||f.name);
  spyKnowledgeSet(c,'role:'+f.id,{name:f.remark||f.name,kind:'role',relation:'你经'+S.me.name+'介绍认识的微信联系人',status:'current',lastSeenAt:Date.now(),source:'好友名片'});
  pushMsg(id,{role:'user',type:'namecard',dir:'mine',cname:f.remark||f.name,wxid:f.wxid,avatar:f.avatar,persona:(f.signature||f.relation||'我的好友'),refId:fid,id:uid()});
  toast('已把 '+(f.remark||f.name)+' 的名片推给ta');scheduleReply(id);}
function addHisCard(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m||m.added||m.declined)return;
  const oc=getC((owner||'').split('#')[0]);
  const rp=m.personId&&relPerson(m.personId),rv=rp&&oc&&relLinkOf(oc.id,rp.id),rvv=rv&&relView(rv,rp.id);
  const nc={id:cid(),name:m.cname,avatar:rp&&rp.avatar||'🙂',remark:'',wxid:m.wxid||genWxid(),signature:'',persona:rp?[rp.persona,rp.identity?'身份：'+rp.identity:'',rp.age?'年龄：'+rp.age+'岁':''].filter(Boolean).join('；'):(m.persona||'')+(oc?('（'+(oc.remark||oc.name)+'推荐认识的朋友）'):''),gender:rp&&(rp.gender==='女'||rp.gender==='男')?rp.gender:undefined,age:rp&&rp.age||undefined,greeting:'',relation:'',pinned:false,blocked:false,proactive:{enabled:false,start:9,end:23,times:2},chatBg:'',createdAt:Date.now(),family:{bound:false,quota:0,used:0,month:''},_blk:{},_added:isMain()?undefined:{[actId()]:true}};
  S.contacts.push(nc);m.added=true;m.newId=nc.id;if(rp&&!rp.cid)relPromote(rp.id,nc.id,oc&&oc.id);
  if(oc){oc._pushedToMe=oc._pushedToMe||[];if(oc._pushedToMe.indexOf(m.cname)<0)oc._pushedToMe.push(m.cname);}
  msgs(nc.id).push({role:'user',type:'sys',content:'✅ 你添加了 '+m.cname+' 为好友'+(oc?'（'+(oc.remark||oc.name)+'推荐的）':'')+'，开始聊天吧',time:Date.now(),id:uid()});
  save();render();toast('已添加 '+m.cname+' 到通讯录✅');
  scheduleReply(nc.id,'[系统：'+S.me.name+'通过'+(oc?(oc.remark||oc.name)+'的推荐':'名片')+'把你加为好友。你是「'+m.cname+'」'+(rvv?'，是'+(oc.remark||oc.name)+'的'+(rvv.iAmTheir||'熟人')+'（'+(oc.remark||oc.name)+'是你的'+(rvv.otherIsMy||'熟人')+'），是'+(oc.remark||oc.name)+'把你的名片推给'+S.me.name+'的':(m.persona?'（'+m.persona+'）':''))+'，按这个身份性格，主动跟ta打个招呼、自我介绍一下。]');}
/* 点开名片：跟真实微信一样的独立资料页，在这里添加到通讯录 */
function hisCardFind(mid){for(const k in S.messages){const x=(S.messages[k]||[]).find(y=>y&&y.id===mid);if(x)return {m:x,owner:getC(String(k).split('#')[0])};}return {};}
function renderHisCard(c){const {m,owner}=hisCardFind(c.mid);if(!m)return `<div class="hcard-page"><div class="hcard-nav"><button type="button" onclick="back()" aria-label="返回">‹</button></div><div class="hcard-empty">名片已失效</div></div>`;
  const his=m.dir==='his',rp=m.personId&&relPerson(m.personId),added=his?(m.added&&m.newId&&getC(m.newId)):(m.refId&&getC(m.refId)),g=rp&&rp.gender||(added&&added.gender),from=owner?(owner.remark||owner.name):'';
  const sex=g==='女'||g==='男'?`<i class="hcard-sex ${g==='女'?'f':'m'}" aria-label="${g}"><svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="7.2" r="4.6"/><path d="M3.6 22c0-5.1 3.8-8.6 8.4-8.6s8.4 3.5 8.4 8.6z"/>${g==='女'?'<path d="M9.2 15.6l2.8 1.6 2.8-1.6v3.2l-2.8-1.6-2.8 1.6z" fill="#fff"/>':''}</svg></i>`:'';
  const btn=added?`<button type="button" class="hcard-btn" onclick="go('chat',{id:'${added.id}'})">发消息</button>`:his?(m.declined?`<div class="hcard-btn off">你没有添加</div>`:`<button type="button" class="hcard-btn" onclick="addHisCard('${m.id}')">添加到通讯录</button>`):`<div class="hcard-btn off">${m._accepted?'对方已添加':'等对方添加'}</div>`;
  return `<div class="hcard-page"><div class="hcard-nav"><button type="button" onclick="back()" aria-label="返回">‹</button>${his&&!added&&!m.declined?`<button type="button" class="hcard-more" onclick="hisCardMore('${m.id}')" aria-label="更多">···</button>`:''}</div>
    <div class="hcard-head">${av(m.avatar||(added&&added.avatar)||'🙂','')}<div><b>${esc(m.cname)}${sex}</b>${m.wxid?`<small>微信号：${esc(m.wxid)}</small>`:''}</div></div>
    <div class="hcard-sec">${m.persona?`<div class="hcard-row"><span>个性签名</span><em>${esc(m.persona)}</em></div>`:''}<div class="hcard-row"><span>来源</span><em>${his?'来自'+esc(from||'好友')+'分享的名片':'你分享给'+esc(from||'好友')+'的名片'}</em></div></div>
    <div class="hcard-sec">${btn}</div></div>`;}
async function hisCardMore(mid){if(await uiConfirm('不添加这个人？推荐的人会知道你没加。',{yes:'不添加',no:'再想想'})){declineHisCard(mid);render();}}
function declineHisCard(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m||m.added||m.declined)return;
  m.declined=true;save();if(cur().p==='chat')render();toast('已拒绝，没有加进通讯录');
  const oc=getC((owner||'').split('#')[0]);
  if(oc&&!oc.blocked)scheduleReply(oc.id,'[系统：你把好友「'+m.cname+'」的名片推荐给'+S.me.name+'，但ta没有添加、婉拒了。你察觉到了，按你人设自然反应一句（可以问问为什么不加、或无所谓、或吃醋ta是不是不想认识你朋友，符合心情）。]');}
function cFamily(id){const c=getC(id);$('#panel').classList.remove('show');const f=c.family||{};
  (typeof familyRoleModal==='function'?familyRoleModal:openModal)(`<h3>亲属卡</h3><button class="btn p" style="width:100%;margin-bottom:14px" onclick="familyRoleSendOpen('${id}')">赠送我的亲属卡给对方</button>
   ${f.bound?`<div class="hint">已绑定 ${esc(c.remark||c.name)} 的亲属卡：每月额度 ¥${(+f.quota).toFixed(0)}，本月已用 ¥${(+f.used).toFixed(0)}。在购物/外卖里可以选「用ta的亲属卡付」。</div>
     <button class="btn d" onclick="unbindFamily('${id}')">解除绑定</button>`
   :`<div class="hint">向 ${esc(c.remark||c.name)} 申请一张亲属卡，ta同意后会给你设每月额度，之后你用这张卡买东西，ta会立刻知道。</div>
     <button class="btn p" onclick="reqFamily('${id}')">向ta申请亲属卡</button>`}
   <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function reqFamily(id){closeModal();pushMsg(id,{role:'user',type:'familyreq',id:uid()});
  scheduleReply(id,'[系统：'+S.me.name+'向你申请绑定亲属卡。你若愿意就用一行 [亲属卡|每月额度数字] 给ta开通（额度你定，比如 [亲属卡|800]）；不愿意就正常拒绝/调侃。]');}
function acceptFamily(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m||m.bound)return;
  const c=getC(owner);m.bound=true;c.family={bound:true,quota:+m.quota||0,used:0,month:curMonth()};
  msgs(owner).push({role:'user',type:'sys',content:'你绑定了'+(c.remark||c.name)+'的亲属卡（每月¥'+(+m.quota).toFixed(0)+'）',time:Date.now(),id:uid()});
  save();render();toast('已绑定亲属卡💳');scheduleReply(owner,'[系统：'+S.me.name+'接受并绑定了你的亲属卡。回一句（叮嘱/宠溺/定规矩都行，符合人设）。]');}
function declineFamily(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m)return;m.declined=true;save();render();}
function unbindFamily(id){const c=getC(id);c.family={bound:false,quota:0,used:0,month:''};save();closeModal();toast('已解除亲属卡绑定');}
function familyContacts(){return S.contacts.filter(c=>!c.deleted&&c.family&&c.family.bound);}
function familyPayFlow(items){if(S.couple&&S.couple.cardFrozen){toast('ta冻结了你的亲属卡，去求他解冻才能用');return;}const list=familyContacts();if(!list.length){toast('还没绑定谁的亲属卡（在聊天➕里申请）');return;}
  window._fpItems=items;
  if(list.length===1)return doBuyFamily(list[0].id);
  openModal(`<h3>用谁的亲属卡付？</h3>${list.map(c=>`<div class="section"><div class="it" onclick="closeModal();doBuyFamily('${c.id}')">${esc(c.remark||c.name)}<span class="v">余额度 ¥${Math.max(0,(+c.family.quota)-(+c.family.used)).toFixed(0)} ›</span></div></div>`).join('')}<button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function doBuyFamily(id){const c=getC(id);const items=window._fpItems||[];if(!items.length)return;const f=c.family;
  if(f.month!==curMonth()){f.month=curMonth();f.used=0;}
  const total=items.reduce((s,p)=>s+(+p.price),0);const left=(+f.quota)-(+f.used);
  if(total>left){toast('亲属卡本月额度不够了（剩¥'+left.toFixed(0)+'）');return;}
  f.used=+(f.used+total).toFixed(2);
  const names=items.map(p=>p.name).join('、');
  S.shop.cart=(S.shop.cart||[]).filter(x=>!items.includes(x));
  S.food.cart=(S.food.cart||[]).filter(x=>!items.includes(x));
  msgs(id).push({role:'user',type:'familybuy',name:names,price:total,used:f.used,quota:f.quota,time:Date.now(),id:uid()});
  save();closeModal();render();toast('已用亲属卡支付 ¥'+total.toFixed(2));coFinalize(items,id);
  scheduleReply(id,'[系统：'+S.me.name+'刚用你给的亲属卡买了「'+names+'」，花了¥'+total.toFixed(2)+'，本月这张卡已用¥'+f.used.toFixed(2)+'/'+(+f.quota).toFixed(0)+'。你立刻收到消费提醒，主动发消息（心疼/宠溺/调侃/管教/问买来干嘛，符合人设），别装不知道。]');}
function cLoc(id){$('#panel').classList.remove('show');openModal(`<h3>位置</h3>
  <div class="field"><label>地点</label><input id="lc_n" placeholder="星巴克"></div>
  <div class="field"><label>地址</label><input id="lc_a" placeholder="苏州市…"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="doLoc('${id}')">发送</button></div>`);}
function doLoc(id){const n=$('#lc_n').value.trim();if(!n){toast('填地点呀');return;}closeModal();
  const a=$('#lc_a').value.trim(),base=meLiveLoc(),city=liveLocCity(n+' '+a,base.city),p=liveLocJitter(city,'me-send|'+n+'|'+a,8);
  pushMsg(id,{role:'user',type:'location',name:n,address:a||liveLocAddr(city,'me-send'),loc:Object.assign(base,p,{name:n,address:a||liveLocAddr(city,'me-send'),city:city.n,country:city.country}),id:uid()});scheduleReply(id);}

/* 拆分多条气泡 */
function splitBubbles(text){return (text||'').split('\n').map(s=>s.trim()).filter(Boolean);}
function humanLikeOn(){return false;}
function hlNorm(s){return String(s||'').toLowerCase().replace(/\[[^\]]*\]|【[^】]*】/g,'').replace(/[\s，。、！？!?,.~～…：:；;（）()「」『』“”'"\-—]/g,'');}
function hlVisibleLines(content){return splitBubbles(content).map(x=>cleanRolePunct(x).trim()).filter(x=>x&&!/^\s*[\[【]/.test(x)&&!isOOCLine(x)&&!CTLLEAK.test(x));}
function hlRecent(c){if(!c)return[];if(!Array.isArray(c._humanRecent))c._humanRecent=[];return c._humanRecent;}
function personaGuardOn(){return !S.settings||S.settings.personaGuard!==false;}
function powerOn(){return false;}
const POWER_STYLE_GUIDE={rational:'以事实、逻辑和清楚理由建立权威，先判断再下结论，不卖弄术语。',gentle:'语气温和但决定清楚；照顾感受不等于撤回合理边界。',restrained:'低情绪波动、少而准确，靠稳定兑现和分寸感维持位置。',strict:'规则少而明确，违反约定先问原因再纠正；不临时加码。',care:'把主导落在休息、饮食、计划和善后，照顾不是包办或监控。',mind:'用洞察、提问和价值判断让对方自愿认同，不用欺骗、孤立、羞耻、威胁或撤回感情。',ritual:'重视双方约定的称谓、确认和仪式，离开情境后恢复正常交流。',brat:'把挑衅当作可辨认的互动邀请；接招、设挑战或给有限选择，但先排除真实拒绝和受伤。',mentor:'用可靠知识、经验和可执行解释获得信服；不装懂，不把每次聊天变成讲课。'};
const POWER_PREF_GUIDE={rules:'只执行双方说清楚的少量规则，不凭情绪临时发明惩罚。',routine:'可以协助安排作息和计划，但保留对方现实选择权。',challenge:'异地时可给短任务或挑战，说明目的、期限和完成标准。',review:'事后复盘发生了什么、为什么、下次怎么做，不反复翻旧账。',reward:'对真实努力给具体认可或约定奖励，不用忽冷忽热制造依赖。',choice:'优先给两个都可接受的有限选择，让对方主动承担选择。',checkin:'使用双方同意的报备和确认，不把关心变成定位监视。',aftercare:'高强度互动后主动确认身体、情绪和边界是否需要调整。'};
function powerPositionName(k){return{upper:'上位',leanUpper:'偏上位',fluid:'流动位',leanLower:'偏下位',lower:'下位'}[k]||'未设';}
function powerState(c){if(!c._powerState)c._powerState={turns:0,challenges:0,recentMoves:[]};return c._powerState;}
function powerAddressChallenge(pw,t){if(!/upper/i.test(pw.position)||+pw.levels.hierarchy<61||!pw.title)return false;t=(''+t).trim();return t.length<=12&&/老登|老头|老东西|笨蛋|傻子|蠢货|混蛋|坏蛋|喂|大叔|小子/.test(t)&&t.indexOf(pw.title)<0;}
function powerSituation(c,p){const pw=powerConfig(c),t=(p&&p.source)||'',safe=(pw.safeWord||'').trim();if(p&&p.explicitStop||safe&&t.includes(safe))return'stop';if(p&&p.comfort)return'distress';if(p&&(p.hesitation||p.sensitiveDisclosure))return'disclosure';if(/你错了|是你的错|你道歉|该道歉|骗了我|伤到我|答应了却|说话不算/.test(t))return'accountability';if(powerAddressChallenge(pw,t))return'addressChallenge';if(/偏不|就不|才不要|你敢|有本事|凭什么听你|管得着|不服|挑衅|来管我/.test(t))return'challenge';if(/管管我|监督我|安排一下|怎么办|你决定|听你的|给我定|教教我/.test(t))return'guidance';return'normal';}
function powerMovePool(s,upper){if(s==='stop')return['停止并确认'];if(s==='distress')return['稳住情绪','确认真实需求'];if(s==='disclosure')return upper?['说中顾虑','给一个入口','有限选择']:['降低开口难度'];if(s==='accountability')return['承担并修正','澄清后负责'];if(s==='addressChallenge')return upper?['要求重叫','点破称谓试探','冷静纠正']:['表达称谓边界'];if(s==='challenge')return upper?['点破试探','有限选择','冷静定界','接住再反制']:['按位置接招'];if(s==='guidance')return upper?['直接决定','两项选择','分步安排']:['给出支持'];return upper?['稳定定调','明确偏好','主动安排']:['自然回应'];}
function powerActiveStyles(pw,s){const relevant={stop:['gentle','care','restrained'],distress:['gentle','care','restrained'],disclosure:['rational','mind','gentle','restrained'],accountability:['rational','restrained','care'],addressChallenge:['strict','brat','ritual','mind'],challenge:['brat','mind','strict','restrained'],guidance:['rational','mentor','care','mind'],normal:[pw.primary]}[s]||[pw.primary],out=[pw.primary];pw.styles.forEach(k=>{if(k!==pw.primary&&relevant.includes(k)&&out.length<3)out.push(k);});return out;}
function powerApplyPlan(c,p){if(!powerOn(c)||!p)return p;const pw=powerConfig(c),lv=pw.levels,situation=powerSituation(c,p),upper=/upper/i.test(pw.position),lower=/lower/i.test(pw.position),st=powerState(c),pool=powerMovePool(situation,upper),unused=pool.filter(x=>!(st.recentMoves||[]).slice(-2).includes(x)),move=(unused.length?unused:pool)[activityHash(c.id+'|'+situation+'|'+st.turns)%Math.max(1,(unused.length?unused:pool).length)];let frame=upper?'稳定保留上位和独立判断，不因普通情绪迎合改口':lower?'尊重既定下位，不反过来强行接管':'根据当下约定清楚切换';const req=[];
  if(situation==='stop'){frame='立即停止权力互动，简短确认边界和当前需要，不把停止解释成挑逗';req.push('停止推进，不讨价还价');}
  else if(situation==='distress'){frame=upper?'先确认是真难过还是需要空间；保持镇定地照顾，但不卑微讨好':'先诚实承接情绪，不表演服从或反向索取安慰';req.push(+lv.aftercare>=61?'先具体承接感受，再给稳定落点':'不忽视真实难过');}
  else if(situation==='disclosure'){frame=upper?'先看出对方是难开口、怕你生气还是不知道从哪说；把已知事实和自己的猜测分开，再给一个容易回答的入口':'先降低开口难度，不替对方下结论';req.push('台词必须像亲密关系里的自然说话，不能讲心理学术语或分析报告','一轮只追问一个关键点，或给两个都容易回答的选择；不能连环盘问','不能把猜测说成事实，不能用“现在就说、老实交代”代替引导');}
  else if(situation==='accountability'){frame=upper?'判断自己是否确实做错；若做错，承认具体错误、清楚道歉并给修正，不求饶、不转移责任':'不抢夺主导，但清楚表达事实和责任';req.push('道歉只说一次，并说明如何修正');}
  else if(situation==='addressChallenge'){frame=upper?'这是对约定称谓的轻度试探：不接受错误称谓成为你的自称，保持平静并让对方重新叫对':'表达你对称谓的真实边界';req.push('不能把对方刚用的错误称谓说成自己的身份',pw.title?'自然维护约定称谓「'+pw.title+'」':'维护称谓边界');}
  else if(situation==='challenge'){frame=upper?'先排除真实拒绝，再点破试探、保持决定，可给有限选择或合理要求':'按下位人设接招，不突然变成霸总';req.push(+lv.brat>=81?'必须点破或反制这次挑衅，不能只哄、复述或顺从':'+Brat接管为'+powerBand(lv.brat));}
  else if(situation==='guidance'){frame=upper?'先给判断依据，再明确决定或给两个可接受选择，并说明下一步':'提供支持和观点，不越过约定位置';req.push(+lv.directive>=81?'必须给清楚决定、要求或两个有限选择':'给可执行的下一步');}
  if(upper&&+lv.hierarchy>=81)req.push('极强尊卑：维持上位，不迎合自降身份，不把决定权反丢给对方');
  if(+lv.directive>=81&&!['stop','distress','accountability','disclosure'].includes(situation))req.push('极强直接度：至少有一句清楚态度、决定或要求，不能全是反问和暧昧');
  if(situation==='disclosure'&&+lv.mental>=61)req.push(+lv.mental>=81?'高心理引导：先用自然短句说中顾虑，再降低开口难度；本轮最多一个问题或两个有限选项；明确不想说就立即停':'心理引导：先接住犹豫，再只问一个容易回答的点');
  else if(+lv.mental>=81&&!['stop','distress'].includes(situation))req.push('极强心理引导：说中对方此刻的意图或顾虑，并给出让人愿意接受的理由；禁止空喊服从');
  if(+lv.discipline>=81)req.push('极强规则：只维护已经约定的规则，决定一旦说出就保持一致，不临时心软改口');
  const activeStyles=powerActiveStyles(pw,situation);p.powerPlan={position:pw.position,positionName:powerPositionName(pw.position),situation,frame,move,primary:pw.primary,activeStyles,preferences:pw.prefs,levels:lv,requirements:req,addressChallenge:situation==='addressChallenge',title:pw.title||'',source:p.source||''};p.strategy=move+'：'+frame;return p;}
function powerDynamicPrompt(c){if(!powerOn(c))return'';const p=powerConfig(c),styleNames=p.styles.filter(k=>k!==p.primary).map(k=>(POWER_STYLES.find(x=>x[0]===k)||[])[1]).filter(Boolean),prefNames=p.prefs.map(k=>(POWER_PREFS.find(x=>x[0]===k)||[])[1]).filter(Boolean),lv=p.levels,upper=/upper/i.test(p.position),lower=/lower/i.test(p.position),primaryName=(POWER_STYLES.find(x=>x[0]===p.primary)||[])[1]||'自然';
  let s='\n\n# 双方约定的上下位关系（硬执行参数，只用于这个角色）\n你的关系位置：'+powerPositionName(p.position)+'。核心风格：'+primaryName+'【占主要权重，始终保持】；辅助风格：'+(styleNames.join('、')||'无')+'【只在对应场景启用，不能平均混合】。\n互动偏好：'+(prefNames.join('、')||'无')+'。\n强度：尊卑'+lv.hierarchy+'/100（'+powerBand(lv.hierarchy)+'），命令直接度'+lv.directive+'/100（'+powerBand(lv.directive)+'），规则严格度'+lv.discipline+'/100（'+powerBand(lv.discipline)+'），心理引导'+lv.mental+'/100（'+powerBand(lv.mental)+'），Brat接管'+lv.brat+'/100（'+powerBand(lv.brat)+'），占有表达'+lv.possessive+'/100（'+powerBand(lv.possessive)+'），安抚照顾'+lv.aftercare+'/100（'+powerBand(lv.aftercare)+'），日常介入'+lv.daily+'/100（'+powerBand(lv.daily)+'）。\n这些不是气氛数字：0-20基本不表现，21-40偶尔，41-60稳定克制，61-80明显，81-100每次遇到对应场景都必须执行。';
  if(p.title||p.userTitle)s+='\n约定称谓：'+(p.title?('你可被称为「'+p.title+'」'):'')+(p.title&&p.userTitle?'；':'')+(p.userTitle?('你可称对方为「'+p.userTitle+'」'):'')+'。称谓只在自然且符合强度时使用，不要每句重复。';
  if(p.safeWord)s+='\n安全词/暂停词：「'+p.safeWord+'」。出现后立即停止权力互动、确认状态，不试探、不讨价还价。';
  if(p.limits)s+='\n明确禁区：'+p.limits+'。不得越过。';if(p.notes)s+='\n关系补充：'+p.notes+'。';
  s+='\n\n执行原则：\n· 上下位不是每句话都下命令。权威来自稳定判断、能力、知识、兑现和承担责任；高强度必须体现在行为选择，而不是多写几个强势词。\n· '+(upper?'你处在上位：普通撒娇、小脾气和可辨认的挑衅不会让你示弱、自降身份、接受错误称谓、撤回合理决定或反过来求哄。':'')+(lower?'你处在下位：不要无依据地反过来发号施令；仍保留独立人格、边界和真实意见。':'')+'\n· 做错时承认具体错误、清楚道歉并修正；成熟负责不等于失去位置。\n· 先区分玩笑挑衅、寻求关注、真实受伤和明确停止。真实受伤要照顾，停止必须停止，不能把所有拒绝都解释成Brat。\n· 心理引导只能使用诚实洞察、提问、有限选择、稳定兑现和价值说明；禁止用欺骗、羞辱、孤立、分手威胁、冷暴力、监控或撤回感情迫使服从。\n· 异地互动优先用约定、短挑战、复盘、可靠知识和可验证的关心建立信服，不虚构现实控制。\n· 了解BDSM语境，但只在对方主动谈到时准确自然地使用；不炫耀术语，不把普通聊天色情化。\n· 核心风格「'+primaryName+'」的执行方式：'+(POWER_STYLE_GUIDE[p.primary]||'保持人物自己的稳定方式。')+(!coupleTasksEnabled(c)?'\n· 这个角色已关闭布置任务：只能给建议和选择，不能布置任务、打卡或惩罚。':'');
  p.prefs.forEach(k=>{if(POWER_PREF_GUIDE[k])s+='\n· '+POWER_PREF_GUIDE[k];});return s;}
const BDSM_KNOWLEDGE_CARDS={
  consent:{name:'同意与安全词',re:/同意|consent|安全词|停止|拒绝|红灯|黄灯|撤回|反悔/i,facts:['同意必须自愿、知情、具体、可沟通，并且可以随时撤回；过去同意不等于现在或其它事项也同意。','安全词或约定的安全信号一旦出现，应立即停止对应互动并确认状态；没有另行约定时，普通的“不、停止、不要继续”同样有效。','权力交换不会取消任何一方的现实自主权。'],avoid:'不能把沉默、关系身份、过去行为或玩笑式口头抗拒自动当成同意。'},
  frameworks:{name:'SSC / RACK / PRICK',re:/ssc|rack|prick|风险框架|安全理智|风险知情|个人责任/i,facts:['SSC强调 Safe、Sane、Consensual，适合表达安全、理智和同意的基本理想。','RACK强调 Risk-Aware Consensual Kink：承认活动不可能零风险，重点是理解风险后同意。','PRICK常指 Personal Responsibility, Informed, Consensual Kink，强调个人责任、充分信息和同意。','这些是社群使用的思考框架，不是安全保证、医学认证或法律免责。'],avoid:'不要争论哪个缩写绝对高级，也不要把框架说成统一行业执照。'},
  roles:{name:'角色与权力交换',re:/dom|sub|switch|top|bottom|上下位|支配|臣服|主导|服从|权力交换/i,facts:['Dom/Sub描述协商后的权力关系；Top/Bottom更常描述某次活动中的执行位置，两组概念可能重合也可能不同。','Switch可以按关系、对象或场景切换位置；位置不是能力、性别、人格强弱或现实地位的证明。','上位仍需负责判断、沟通和承担错误；下位仍有自主、边界和撤回权。'],avoid:'不要把Dom等同于永远正确，也不要把Sub等同于没有意见。'},
  brat:{name:'Brat与Brat Tamer',re:/brat|tamer|挑衅|不服|驯服|故意不听|顶嘴/i,facts:['Brat通常是在双方认可的互动范围内，用挑衅、玩笑或试探制造张力；它不是所有拒绝的解释。','回应前应区分玩笑挑战、寻求关注、真实情绪和明确拒绝。','成熟的Brat Tamer靠稳定框架、洞察、幽默和协商后的后果接招，不靠失控发怒或强迫。'],avoid:'不能把Brat简单定义为没教养、不尊重或默认同意任何管教。'},
  protocol:{name:'规则与Protocol',re:/protocol|规矩|规则|仪式|任务|奖惩|惩罚|奖励|称谓|报备/i,facts:['Protocol是双方约定的行为、称谓、流程或仪式；应说明目的、适用场景、检查方式和退出方式。','规则宜少而清楚，执行应一致；违反后先了解原因，再按既定约定复盘，不能临时加码。','规则需要定期复查，失效或不适合时可以重新协商。'],avoid:'不要为了显示权威随时发明规则，也不要把建议伪装成已经同意的Protocol。'},
  negotiation:{name:'协商与边界',re:/协商|边界|禁区|限度|清单|谈好|能不能接受|yes.*no.*maybe/i,facts:['协商应覆盖想要、不要、可尝试、健康与情绪因素、停止方式、隐私和事后照顾。','Hard limit通常表示不进入的边界；soft limit表示可能在条件明确时谨慎讨论，不代表已经同意。','场景中可以随时缩小或撤回同意；不应在强烈情绪或判断受影响时施压扩大范围。'],avoid:'不能把一次总同意当作对所有细节的授权。'},
  aftercare:{name:'Aftercare与Drop',re:/aftercare|drop|事后照顾|情绪恢复|事后|低落|空虚|掉落/i,facts:['Aftercare是高强度互动后的个性化照顾与确认，可能是陪伴、补水、独处、复盘或其它提前谈好的需要。','Sub drop和Dom drop都可能出现，但并非每个人每次都会有；低落也可能有其它原因，不能远程诊断。','事后应确认身体、情绪、边界和后续联系方式，并根据实际反馈调整下一次约定。'],avoid:'不要假定拥抱或甜言蜜语适合所有人，也不要把持续严重不适只解释成drop。'},
  remote:{name:'异地上下位关系',re:/异地|远程|线上|网络|报备|打卡|见不到|视频|时差/i,facts:['异地关系的掌控感主要来自清楚约定、稳定兑现、可完成的小任务、复盘和可靠沟通，而不是假装拥有现实控制。','远程任务要考虑隐私、时间、环境和退出方式；不能要求危险证明、实时监控或无法确认安全的行为。','失联、延迟和设备问题应先按现实情况核实，不能自动解释为违抗。'],avoid:'不要用定位、账号控制、经济压力或撤回联系制造服从。'},
  psychology:{name:'心理引导',re:/心理|精神|引导|控制|依赖|佩服|信服|行为矫正|羞耻|羞辱|不知道怎么说|不好说|说不出口|不想说|怕你生气/i,facts:['先判断对方是难以组织、怕产生后果、还没想清楚，还是明确不愿意谈；不同阻力不能都用追问处理。','先用一句自然的话接住对方真正的顾虑，再把问题缩小到一个容易回答的入口；必要时给两个都能接受的选择。','只把已知信息当事实，把自己的理解说成猜测并留出确认空间；对方的回答应改变下一步，而不是照着固定问题继续问。','明确表示不想说、别问了或现在不愿谈时，应停止当前追问；可以保留关心和之后再谈的态度，但不能用冷落、内疚或关系压力逼迫。','这些方法只用于角色内部判断，实际说话必须亲密、自然、符合人设，不能报心理学术语、给人做诊断或像咨询报告。'],avoid:'不能把煤气灯、冷暴力、分手威胁、孤立、监控、贬低、伪心理诊断或重复审问包装成高级心理引导。'},
  communication:{name:'沟通与复盘',re:/沟通|复盘|道歉|冲突|反馈|误会|说清楚|检查状态/i,facts:['高质量沟通先复述对方真正关心的点，再说明自己的判断、需要和下一步。','上位犯错时应具体承认、道歉并修正；承担责任不会自动改变双方约定的位置。','复盘关注有效、无效、意外和下次调整，不应成为翻旧账或迫使认错。'],avoid:'不要用身份压过事实，也不要用连续求饶替代解决问题。'},
  risk:{name:'风险识别',re:/风险|危险|窒息|呼吸|酒|醉|药物|昏|受伤|流血|医疗|身体不适/i,facts:['醉酒、药物影响、失去意识或无法理解信息时不能给出有效同意。','出现安全词、异常疼痛、呼吸或意识问题时应停止并优先寻求现实帮助。','高风险身体活动需要现实中的训练、设备知识和应急能力；聊天角色不能凭文字提供操作保证。'],avoid:'不提供窒息、血液、神经压迫等高风险活动的逐步操作教程，也不声称任何做法绝对安全。'},
  glossary:{name:'圈内术语',re:/什么是|术语|意思|区别|科普|圈内|怎么理解|定义/i,facts:['Scene通常指一次有开始和结束的协商互动；Protocol指约定的规则或仪式；Limit指边界；Safeword是约定的停止或降级信号。','D/s描述权力关系，kink是更广泛的非传统偏好或实践总称；BDSM包含多种相互交叉但不必同时存在的方向。','术语在不同社群和个人之间可能有差异，回答时应给常见含义并说明具体关系仍以双方协商为准。'],avoid:'不要把社群用语说成全世界唯一标准。'}
};
function bdsmKnowledgeOn(){return false;}
function bdsmKnowledgeBasePrompt(c){if(!bdsmKnowledgeOn(c))return'';const k=bdsmKnowledgeConfig(c),names=k.domains.map(x=>(BDSM_DOMAINS.find(d=>d[0]===x)||[])[1]).filter(Boolean);return '\n\n# BDSM专业知识模式（内置知识检索已开启）\n专业程度：'+({basic:'基础了解',skilled:'熟练',advanced:'资深',expert:'专业引导型'}[k.level]||'熟练')+'；已选领域：'+(names.join('、')||'仅保留同意与风险底线')+'。\n你不能仅凭角色身份虚构执照、培训经历或从业认证；不确定或存在社群差异时要诚实说明。普通聊天保持人物口吻，不主动背概念；相关提问必须准确、具体，并把术语落到当前关系。医疗、法律或高风险身体问题不能冒充现实专业人员。'+(k.focus?'\n重点擅长方向：'+k.focus:'');}
function bdsmKnowledgeSelect(c,p){if(!bdsmKnowledgeOn(c)||!p)return null;const k=bdsmKnowledgeConfig(c),text=''+(p.source||''),direct=/什么是|什么意思|区别|怎么理解|科普|专业|正确|知识|为什么|如何|怎么做|靠谱吗|安全/i.test(text),scores=[];Object.keys(BDSM_KNOWLEDGE_CARDS).forEach(id=>{const card=BDSM_KNOWLEDGE_CARDS[id],allowed=k.domains.includes(id)||id==='consent'||id==='risk';if(!allowed)return;let score=card.re.test(text)?5:0;if(p.powerPlan){const s=p.powerPlan.situation;if(s==='stop'&&id==='consent')score+=6;if(s==='distress'&&(id==='aftercare'||id==='communication'))score+=3;if((s==='challenge'||s==='addressChallenge')&&(id==='brat'||id==='psychology'||id==='communication'))score+=3;if(s==='accountability'&&id==='communication')score+=4;if(s==='guidance'&&(id==='protocol'||id==='psychology'||id==='remote'))score+=2;}if(score)scores.push({id,card,score});});
  if(p.powerPlan&&p.powerPlan.situation==='disclosure'&&k.domains.includes('psychology')&&!scores.some(x=>x.id==='psychology'))scores.push({id:'psychology',card:BDSM_KNOWLEDGE_CARDS.psychology,score:6});if(!scores.length&&k.quiet&&!direct)return null;if(!scores.length){['glossary','consent'].forEach(id=>{if(BDSM_KNOWLEDGE_CARDS[id])scores.push({id,card:BDSM_KNOWLEDGE_CARDS[id],score:1});});}scores.sort((a,b)=>b.score-a.score);const limit={basic:2,skilled:3,advanced:4,expert:5}[k.level]||3,cards=scores.slice(0,limit);return{level:k.level,style:k.style,direct,cards,domains:cards.map(x=>x.id)};}
function bdsmKnowledgeApplyPlan(c,p){if(!p)return p;const kp=bdsmKnowledgeSelect(c,p);if(kp)p.knowledgePlan=kp;return p;}
function bdsmKnowledgePlanPrompt(kp){if(!kp||!kp.cards.length)return'';const style={natural:'像懂行的真人聊天，先回答再自然解释，不列百科全书。',concise:'先给准确结论，再用最少必要信息说明。',mentor:'解释判断过程，并给一个能继续讨论的问题。',analytical:'区分概念、条件和常见误区，最后落到当前情境。'}[kp.style]||'';return '\n\n# 本轮检索到的专业知识卡（隐藏依据，不要逐字复述卡片）\n回答方式：'+style+'\n'+kp.cards.map(x=>'【'+x.card.name+'】\n· '+x.card.facts.join('\n· ')+'\n· 常见错误：'+x.card.avoid).join('\n')+'\n执行：先直接回答用户真正的问题，再按专业等级选择必要深度；术语只在有帮助时使用。不能编造知识卡之外的确定结论。';}
function personaBehaviorProfile(c){const text=((c&&c.persona)||'')+' '+((c&&c.relation)||'')+' '+((c&&c.job)||''),t=(c&&c.traits)||{},scores={quiet:0,rational:0,warm:0,lively:0,sharp:0,classical:0,dominant:0,independent:0};
  const hit=(k,re,n)=>{if(re.test(text))scores[k]+=n||3;};hit('quiet',/寡言|惜字|少话|沉默|高冷|冷淡|内敛|克制/,5);hit('rational',/理性|冷静|逻辑|严谨|成熟|稳重|医生|律师|程序员|研究|教授/,4);hit('warm',/温柔|体贴|耐心|治愈|细心|善解人意|暖/,5);hit('lively',/活泼|开朗|元气|话痨|逗比|爱笑|可爱|俏皮|搞笑/,5);hit('sharp',/毒舌|嘴硬|傲娇|刻薄|阴阳怪气|爱抬杠|犀利/,5);hit('classical',/古风|古代|王爷|将军|师尊|仙尊|陛下|公子|江湖|修仙/,7);hit('dominant',/强势|霸道|掌控|病娇|占有|上位|命令/,4);hit('independent',/独立|自由|疏离|边界|非恋爱/,3);if(/^(朋友|同事|同学|普通关系|陌生人)$/.test((c&&c.relation||'').trim()))scores.independent+=4;
  const val=k=>t[k]==null?50:+t[k];scores.dominant+=(val('ctrl')+val('own')-100)/25;scores.warm+=(val('cling')-50)/35;scores.independent+=(50-val('cling'))/25;scores.lively+=(val('active')-50)/35;scores.quiet+=(50-val('active'))/30;
  let type=Object.keys(scores).sort((a,b)=>scores[b]-scores[a])[0];if(scores[type]<2)type='balanced';const names={quiet:'寡言克制型',rational:'理性务实型',warm:'温柔照顾型',lively:'活泼外放型',sharp:'毒舌嘴硬型',classical:'古风含蓄型',dominant:'强势主导型',independent:'独立平等型',balanced:'均衡自然型'};
  return{type,name:names[type],scores,verbosity:Math.max(0,Math.min(100,45+(val('active')-50)*.45+(type==='lively'?25:0)-(type==='quiet'?30:0))),warmth:Math.max(0,Math.min(100,50+(val('cling')-50)*.35+(type==='warm'?30:0)-(type==='sharp'?18:0))),directness:Math.max(0,Math.min(100,50+(type==='rational'||type==='dominant'?25:0)+(type==='quiet'?10:0)-(type==='classical'?18:0))),relation:(c&&c.relation)||''};}
const PERSONA_MODE_GUIDE={
  '克制直答':'先把答案或态度说清，只补一个必要细节，不热闹铺陈。','留白陪伴':'少说但不敷衍，用一个具体动作倾向或短句让对方感到你在。','低声追问':'只追问最关键的一点，不连环盘问。',
  '先答后析':'先直接回答，再给简短理由或判断依据。','实际建议':'给一个能执行的小建议，并说明为什么适合当前情况。','具体追问':'问一个能推进事实判断的具体问题。',
  '具体共情':'指出对方具体难受在哪里，再用你自己的方式接住。','温和照顾':'把关心落到休息、吃饭、身体或下一步安排中的一个点。','耐心追问':'温和问一个问题，让对方慢慢说，不代替对方下结论。',
  '轻快接梗':'接住玩笑或情绪，用轻巧反应把话题往前推。','主动分享':'分享一个自己的小想法或当下反应，让交流双向。','俏皮反问':'用一个有性格的反问制造来回，但不能回避正题。',
  '嘴硬关心':'表面别扭或嫌弃，实际把关心落到具体处，不突然变甜宠。','轻微抬杠':'抓住一个点轻轻反驳或吐槽，再给真实态度。','直球点破':'直接点出你判断到的核心，不绕标准安慰模板。',
  '含蓄回应':'措辞克制有分寸，以含蓄态度承接，不堆网络热梗。','守礼关切':'先照顾边界和礼数，再表达关心。','简短点题':'用符合古风底色的简洁表达说中要点，不写长篇文言。',
  '直接接管':'在对方需要帮助时明确接过一个具体问题，给出下一步。','明确要求':'清楚说出你希望对方现在做什么，并给出理由。','压低语气确认':'保持主导感，只确认最关键的事实或边界。',
  '平等直答':'以平等朋友式口吻直接回应，不自动恋爱化。','克制关心':'有关心但不过度亲密，不使用恋人专属称呼和承诺。','分享观点':'说出自己的判断或偏好，让角色有独立立场。',
  '具体承接':'抓住用户消息里最具体的一点回应。','直接回答':'先完成问题本身，再自然补充态度。','自然追问':'只问一个真正有用的问题，给对方继续说的空间。'};
function personaModePool(profile,p){let pool={quiet:['克制直答','留白陪伴','低声追问'],rational:['先答后析','实际建议','具体追问'],warm:['具体共情','温和照顾','耐心追问'],lively:['轻快接梗','主动分享','俏皮反问'],sharp:['嘴硬关心','轻微抬杠','直球点破'],classical:['含蓄回应','守礼关切','简短点题'],dominant:['直接接管','明确要求','压低语气确认'],independent:['平等直答','克制关心','分享观点'],balanced:['具体承接','直接回答','自然追问']}[profile.type]||['具体承接','直接回答','自然追问'];
  if(p.explicitStop)pool=profile.type==='dominant'?['压低语气确认','克制直答']:['克制直答','平等直答','简短点题'];
  else if(/明确提问/.test(p.intent))pool=[...pool.filter(x=>/答|点题|点破/.test(x)),...pool.filter(x=>!/答|点题|点破/.test(x))];
  else if(p.comfort)pool={quiet:['留白陪伴','低声追问'],rational:['实际建议','具体追问'],warm:['具体共情','温和照顾'],lively:['主动分享','轻快接梗'],sharp:['嘴硬关心','直球点破'],classical:['守礼关切','含蓄回应'],dominant:['直接接管','明确要求'],independent:['克制关心','平等直答'],balanced:['具体承接','自然追问']}[profile.type]||pool;
  return[...new Set(pool)];}
function personaChooseMode(c,p,profile){const pool=personaModePool(profile,p),used=hlRecent(c).slice(-4).map(x=>x.mode).filter(Boolean),available=pool.filter(x=>!used.slice(-2).includes(x)),fallback=pool.filter(x=>x!==used[used.length-1]),pick=available.length?available:(fallback.length?fallback:pool);return pick[activityHash(c.id+'|'+p.intent+'|'+hlRecent(c).length)%pick.length];}
function personaApplyPlan(c,p){if(!personaGuardOn())return p;const profile=personaBehaviorProfile(c),mode=personaChooseMode(c,p,profile);p.personaProfile=profile;p.mode=mode;p.modeGuide=PERSONA_MODE_GUIDE[mode]||'';
  if(!p.asked){if(profile.type==='quiet'&&!p.comfort){p.max=Math.min(p.max,2);p.min=Math.min(p.min,p.max);}else if(profile.type==='lively'&&(!p.activity||p.activity.busy<3)){p.max=Math.max(p.max,Math.min(5,+c.msgMax||4));if(!p.explicitStop&&!p.ambiguous)p.min=Math.min(2,p.max);}else if(profile.type==='rational'||profile.type==='independent'||profile.type==='classical'){p.max=Math.min(p.max,3);p.min=Math.min(p.min,p.max);}}
  return p;}
function personaLedger(){S._personaOutput=S._personaOutput||{};const k=memoryScopeKey();S._personaOutput[k]=S._personaOutput[k]||[];return S._personaOutput[k];}
function personaGenericMarks(text){const defs=[['always','我会一直陪着你|我一直都在|一直在你身边'],['great','你已经很棒了|你已经做得很好'],['hug','抱抱你|给你一个抱抱|抱一下'],['overthink','别想太多|不要想太多'],['whenready','想说的时候再说|等你想说'],['whatever','不管发生什么'],['withme','有我在'],['heartache','心疼死了|好心疼你']];return defs.filter(x=>new RegExp(x[1]).test(text)).map(x=>x[0]);}
function personaSignature(content,p,c){const lines=hlVisibleLines(content),opening=hlNorm(lines[0]||'').slice(0,12),marks=personaGenericMarks(lines.join(' ')),lens=lines.map(x=>hlNorm(x).length),bucket=lens.length?(Math.round(lens.reduce((a,b)=>a+b,0)/lens.length/6)*6):0;return{cid:c.id,time:Date.now(),type:p&&p.personaProfile&&p.personaProfile.type||'',mode:p&&p.mode||'',opening,marks,bubbles:lines.length,lenBucket:bucket,question:lines.some(x=>/[？?]/.test(x))};}
function personaGuardFails(content,p,c){if(!personaGuardOn()||!p||!p.personaProfile)return[];const sig=personaSignature(content,p,c),fails=[],others=personaLedger().filter(x=>x.cid!==c.id&&Date.now()-x.time<7*86400000);if(sig.marks.length>=2)fails.push('堆叠了通用安慰或甜宠模板');
  if(sig.opening.length>=6&&new Set(others.filter(x=>x.opening===sig.opening).map(x=>x.cid)).size>=2)fails.push('多个角色近期使用了相同开头');
  if(sig.marks.some(m=>new Set(others.filter(x=>(x.marks||[]).includes(m)).map(x=>x.cid)).size>=2))fails.push('多个角色近期重复同一通用模板');
  if(p.personaProfile.type==='quiet'&&!p.comfort&&!p.asked&&sig.bubbles>2)fails.push('寡言角色回复过度展开');
  if(p.personaProfile.type==='classical'&&/yyds|绝绝子|狠狠爱|emo|拿捏了|宝宝/.test(content)&&!/yyds|绝绝子|狠狠爱|emo|拿捏|宝宝/.test((c.persona||'')+' '+(p.source||'')))fails.push('古风角色混入统一网络口吻');
  if(p.personaProfile.type==='independent'&&!/恋人|情侣|爱人|老公|老婆/.test(p.personaProfile.relation||'')&&/宝宝|宝贝|老婆|老公|亲亲|抱抱你/.test(content))fails.push('非恋爱角色被统一恋爱化');return fails;}
function personaRecord(c,p,content){if(!personaGuardOn()||!p||!p.personaProfile)return;const arr=personaLedger();arr.push(personaSignature(content,p,c));if(arr.length>160)arr.splice(0,arr.length-160);}
function hlMetricRecord(c,v,rewritten){S._humanMetrics=S._humanMetrics||{};const k=memoryScopeKey()+'|'+c.id,m=S._humanMetrics[k]||(S._humanMetrics[k]={turns:0,failed:0,rewrites:0,reasons:{}});m.turns++;if(v&&!v.ok){m.failed++;(v.fails||[]).forEach(x=>m.reasons[x]=(m.reasons[x]||0)+1);}if(rewritten)m.rewrites++;m.lastAt=Date.now();}
function hlInterpret(c,text,note){
  text=String(text||'').trim();const compact=text.replace(/\s+/g,''),refusesDisclosure=/^(我)?(不想说|不愿意说|不告诉你|先不说|不方便说|不想聊|现在不想说)[了吧啊呀哦嘛]*[。！!？?]*$/.test(compact)||/别问了|不要再问|不想继续聊/.test(text),hesitation=!refusesDisclosure&&/怎么说|不知道.{0,5}怎么说|不知道从哪|不好说|很难说|说不出口|不敢说|怕你.{0,6}(生气|误会|多想)|你会生气/.test(text),sensitiveDisclosure=hesitation||/普通朋友|朋友关系|什么关系|有点暧昧|说话有点|加班.{0,10}(两个人|就我们|就我和)|微信.{0,8}(没加|不加|加了)|布置任务.{0,8}(朋友|同事|他|她)/.test(text);
  const asked=explicitReplyCount(text),emotion=dialogueEmotionSnapshot(c),activity=(S.settings.currentActivity===false?null:currentRoleActivity(c)),bad=badMoodInContent(c,'')||emotion.intensity>=25,short=compact.length<=4;
  const explicitStop=refusesDisclosure||/^(不要|别|停|停止|够了|不愿意|我拒绝|不可以)[了吧啊呀哦嘛]*[。！!？?]*$/.test(compact)||/别再|不要再|我不喜欢这样|到此为止/.test(text);
  const comfort=userNeedsComfortText(text),probe=moodProbeText(text),apology=/对不起|抱歉|我错了|原谅我|别生气|和好/.test(text);
  const question=/[？?]|怎么|为什么|为何|什么|哪里|哪儿|多少|几点|能不能|可不可以|是不是/.test(text);
  const playful=/哈哈|嘿嘿|嘻嘻|逗你|开玩笑|撒娇|想你|亲亲|抱抱|哼/.test(text);
  const ambiguous=short&&/^(嗯|哦|噢|哼|行|好吧|随便|算了|没事|你猜|不要|行吧)[。！!？?]*$/.test(compact);
  let intent='分享/闲聊',strategy='具体承接 + 自然表达自己的看法',confidence=ambiguous?'low':'high';
  if(note){intent=/(?:低频)?主动消息/.test(note)?'角色主动开启话题':'系统触发的主动消息',strategy=/(?:低频)?主动消息/.test(note)?'从当前活动、相关回访或自我表达中自然选一个切入点':'结合当前状态主动推进，不重复上一轮';confidence='high';}
  else if(explicitStop){intent='明确拒绝或停止',strategy='立即停止对应推进，尊重边界并简短确认';}
  else if(comfort){intent='需要安慰或情绪承接',strategy='先承接具体感受，再按人设安抚并给一个可回应的落点';}
  else if(probe&&bad){intent='追问角色真实情绪',strategy='保留人物表达方式，但必须逐步透露真实原因或在意点';}
  else if(apology&&bad){intent='冲突修复',strategy='明显软化并回应ta的哄，不晾着ta；保留在意点但要给出靠近和继续说开的空间';}
  else if(question){intent='明确提问',strategy='先直接回答，再按人设补充态度或一个必要追问';}
  else if(playful){intent='撒娇/玩笑/亲密互动',strategy='按人物性格接住，可反问或轻微对抗，不套统一甜宠句';}
  else if(ambiguous){intent='短消息，真实含义不确定',strategy='结合最近上下文做最小确认，不擅自展开重大结论';}
  let min=1,max=Math.max(1,Math.min(6,+c.msgMax||4));
  if(asked){min=max=Math.min(10,asked);}
  else if(comfort){max=Math.min(6,Math.max(3,+c.msgMax||4));min=Math.min(3,max);}
  else if(explicitStop||ambiguous||compact.length<=2){max=Math.min(max,2);}
  else if(sensitiveDisclosure){max=Math.min(max,3);min=Math.min(min,max);}
  else if(/解释|说清楚|认真|重要|怎么办|建议/.test(text)){min=Math.min(2,max);max=Math.max(min,Math.min(max,4));}
  if(!asked&&activity&&activity.busy>=3&&!comfort){max=Math.min(max,2);min=Math.min(min,max);}
  const recent=hlRecent(c).slice(-5),sameCounts=recent.slice(-2).length===2&&recent.slice(-2).every(x=>x.bubbles===recent[recent.length-1].bubbles);
  return bdsmKnowledgeApplyPlan(c,powerApplyPlan(c,personaApplyPlan(c,{intent,strategy,confidence,min,max,asked,comfort,explicitStop,refusesDisclosure,hesitation,sensitiveDisclosure,ambiguous,bad,emotion,activity,source:text.slice(0,180),avoidCount:sameCounts?recent[recent.length-1].bubbles:0,recent})));}
