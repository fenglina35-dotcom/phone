function phoneFriendChatMessages(id){const p=phoneFriendState();id=(''+id).toUpperCase();return pfVisibleMsgList(p.messages,id).flatMap(m=>{const receipt=pfTransferReceiptMessage(m);return receipt?[m,receipt]:[m];}).sort((x,y)=>(x.time||0)-(y.time||0));}
//@@ private
function phoneFriendChatShowEarlier(id){id=(''+id).toUpperCase();const el=$('#pfchatbg'),oldHeight=el?el.scrollHeight:0;_pfFriendRenderLimit[id]=(_pfFriendRenderLimit[id]||60)+60;render();requestAnimationFrame(()=>{const next=$('#pfchatbg');if(next)next.scrollTop=Math.max(0,next.scrollHeight-oldHeight);});}
//@@ end
async function sendPhoneFriendBody(id,body,opt){id=(''+id).toUpperCase();body=(''+(body||'')).trim();opt=opt||{};const silent=!!opt.silent,transport=!!opt.transport;if(!body)return;if(body.length>PHONE_FRIEND_BODY_MAX){if(!transport)toast('这条消息太大，发不出去');return;}if(!silent&&_pfSendBusy[id]){toast('上一条还在发送');return;}const p=phoneFriendState();const localId='local_'+uid();body=pfTagOutgoing(body,localId);if(body.length>PHONE_FRIEND_BODY_MAX){if(!transport)toast('这条消息太大，发不出去');return;}if(!silent)_pfSendBusy[id]=true;
  if(S.couple&&S.couple.gags&&S.couple.gags[pfGagKey(id)]){if(!silent)delete _pfSendBusy[id];if(!transport)toast('这段聊天被ta禁言了，先去求ta解开');return;}
  pfStoreMessage({id:localId,from_id:p.id,to_id:id,body,created_at:new Date().toISOString(),time:Date.now()});
  pfSetSendState('friend',id,localId,'sending');if(opt.bill) addBill('out',opt.bill.amount,opt.bill.note);
  save();if(!silent)render();
  if(!silent&&S.settings.sound&&typeof playDing==='function')playDing();
  let submitted=false,confirmed=false;try{await pfEnsure();submitted=true;const m=await pfRpc('phone_friend_send_message',{p_from_id:p.id,p_secret:p.secret,p_to_id:id,p_body:body},30000);confirmed=true;pfStoreMessage(m);p.lastSync=0;save();phoneFriendSync(true);}
  catch(e){if(confirmed){if(!transport)toast('消息已发送，本机刷新暂时失败；请刷新聊天查看。');return;}const unknown=submitted&&!!e.pfSubmissionUnknown;if(unknown){pfSetSendState('friend',id,localId,'unknown');if(await pfRecoverSend('friend',id,body,p))return;}else pfSetSendState('friend',id,localId,'not-sent');if(opt.bill&&!unknown){addBill('in',opt.bill.amount,'发送失败退款：'+(opt.bill.refundName||'小手机转账'));const arr=pfMsgList(p.messages,id);if(arr.length){const i=arr.findIndex(x=>x.id===localId);if(i>=0)arr.splice(i,1);}}if(!transport)toast(!submitted?'连接未成功，消息尚未提交；请稍后重试。':e.message||'发送失败');}
  finally{if(!silent)delete _pfSendBusy[id];if(!silent&&cur().p==='pfchat'&&cur().id===id)render();}}
async function sendPhoneFriend(id){const ta=$('#pf_input'),text=(ta&&ta.value||'').trim();if(!text)return;if(ta){ta.value='';ta.style.height='auto';chatComposerStateSync(ta);}
  const voice=groupComposerVoiceOn('pffriend',id);
  sendPhoneFriendBody(id,voice?pfPack({type:'voice',text,dur:Math.max(1,Math.round(text.length/3))}):text);}
function pfSpyMsgText(m){if(!m)return '';if(m.recalled)return '[已撤回一条消息]';const p=pfMsgPayload(m);if(!p)return (m.text||'').replace(/\n/g,' ').slice(0,80);if(p.type==='sticker')return '[表情]'+(p.meaning?' '+p.meaning:'');if(p.type==='transfer'||p.type==='redpacket'){const got=m.received?('（'+(m.receivedBy?pfNameById(m.receivedBy):'对方')+'已收）'):'（未收）';return (p.type==='redpacket'?'[红包] ':'[转账] ')+'¥'+(+p.amount||0).toFixed(2)+(p.note?' '+p.note:'')+got;}return pfMsgPreview(m);}
function pfSpyLine(m,peer){const p=phoneFriendState();return '['+factStamp(m.time||Date.now())+'] '+(m.from===p.id?S.me.name:(peer||pfNameById(m.from)||'对方'))+'：'+pfSpyMsgText(m);}
function phoneFriendWechatDump(limit,since){try{const p=phoneFriendState(),out=[];limit=limit||12;since=+since||0;(p.friends||[]).forEach(f=>{const id=(''+(f.phone_id||f.id)).toUpperCase(),arr=pfMsgList(p.messages,id).filter(m=>(m.time||0)>since).slice(-limit);if(arr.length)out.push('【小手机好友｜真人｜'+pfFriendDisplayName(f)+'｜ID '+id+'】\n'+arr.map(m=>pfSpyLine(m,pfFriendDisplayName(f))).join('\n'));});
  (p.groups||[]).forEach(g=>{const gid=g.group_id||g.id,arr=pfMsgList(p.groupMessages,gid).filter(m=>(m.time||0)>since).slice(-limit);if(arr.length)out.push('【小手机群聊｜真人群｜'+pfGroupDisplayName(g)+'】\n'+arr.map(m=>pfSpyLine(m,pfNameById(m.from)||'成员')).join('\n'));});
  return out.length?'【小手机真人好友/群聊记录】\n说明：下面是'+S.me.name+'和真实小手机用户的聊天，不是虚拟角色记忆；必须按标题区分“一对一好友”和“群聊”，不要把不同会话混在一起。\n'+out.join('\n\n'):'';}catch(_){return '';}}
function phoneFriendActivity(since){try{const dump=phoneFriendWechatDump(4,since);if(!dump)return '';return '·她最近的小手机真人好友/群聊活动：\n'+dump+'\n';}catch(_){return '';}}
function wxLoginMsgBrief(m){const t=(msgToText(m)||previewOf(m)||'').replace(/\s+/g,' ').trim();return t?t.slice(0,90):'[消息]';}
function wxLoginSummaryLines(arr,whoFn,limit){arr=arr||[];limit=limit||10;return arr.slice(-limit).map(m=>'['+factStamp(m.time||m.t||Date.now())+'] '+whoFn(m)+'：'+wxLoginMsgBrief(m)).join('\n');}
function wxLoginMessageWho(m,cid,me,fallback){if(m&&m._wxlogin){const actor=getC(m._wxloginBy||cid),nm=m._wxloginByName||(actor&&wxLoginSelfName(actor))||'你';return nm+'（借'+me+'的账号代发）';}return fallback;}
function wxLoginWechatSummary(cid){const since=Date.now()-2*86400000,out=[],me=S.me.name||'我';
  S.contacts.filter(x=>!x.deleted&&x.id!==cid).forEach(x=>{const nm=x.remark||x.name,arr=msgs(x.id).filter(m=>!m._call&&(m.time||0)>=since);out.push('【角色好友｜'+nm+(typeof relLoginTag==='function'?relLoginTag(cid,x.id):'')+(x.star?'｜重点盯防':'')+'】最近两天 '+arr.length+' 条'+(arr.length?'\n'+wxLoginSummaryLines(arr,m=>wxLoginMessageWho(m,cid,me,m.role==='user'?me:nm),10):'\n（最近两天没有聊天）'));});
  (S.groups||[]).forEach(g=>{const arr=(g.msgs||[]).filter(m=>(m.time||0)>=since);out.push('【角色群聊｜'+g.name+'｜'+((g.members||[]).length+1)+'人】最近两天 '+arr.length+' 条'+(arr.length?'\n'+arr.slice(-12).map(m=>'['+factStamp(m.time||Date.now())+'] '+gnm(g,m.senderId)+'：'+gmText(m).replace(/\s+/g,' ').slice(0,90)).join('\n'):'\n（最近两天没有聊天）'));});
  try{const p=phoneFriendState();(p.friends||[]).forEach(f=>{const id=(''+(f.phone_id||f.id)).toUpperCase(),nm=pfFriendDisplayName(f),arr=pfMsgList(p.messages,id).filter(m=>(m.time||0)>=since);out.push('【小手机真人好友｜'+nm+'｜ID '+id+'】最近两天 '+arr.length+' 条'+(arr.length?'\n'+arr.slice(-10).map(m=>pfSpyLine(m,nm)).join('\n'):'\n（最近两天没有聊天）'));});
    (p.groups||[]).forEach(g=>{const gid=g.group_id||g.id,nm=pfGroupDisplayName(g),arr=pfMsgList(p.groupMessages,gid).filter(m=>(m.time||0)>=since);out.push('【小手机真人群聊｜'+nm+'】最近两天 '+arr.length+' 条'+(arr.length?'\n'+arr.slice(-12).map(m=>pfSpyLine(m,pfNameById(m.from)||'成员')).join('\n'):'\n（最近两天没有聊天）'));});}catch(_){}
  const body=out.join('\n\n')||'（最近两天没有其它微信聊天）';
  return '【最近两天微信上下文摘要】\n说明：这是'+me+'微信里最近两天的聊天摘要，包含角色好友、角色群聊、小手机真人好友和小手机真人群聊；已删除/已清空的聊天不会出现在这里。小手机开头的都是真人，不是虚拟角色；群聊要看每行发言人，别把群聊成员说混。\n'+body.slice(0,9000);
}
function pfNameById(id){id=(''+id).toUpperCase();const p=phoneFriendState();if(id===p.id)return S.me.name||'我';const f=phoneFriendById(id);return f?pfFriendDisplayName(f):id;}
const _pfGroupRenderLimit={};
function openPhoneFriendGroup(gid){phoneFriendSyncActive();wxChatRestore('friend-group:'+gid);_pfGroupRenderLimit[gid]=120;pfMarkGroupRead(gid);_scrollBottomOnce['pfgroup:'+gid]=Date.now();go('pfgroup',{gid});setTimeout(()=>phoneFriendMaybeSync(true),60);}
function pfGroupById(gid){return (phoneFriendState().groups||[]).find(g=>(g.group_id||g.id)===gid)||null;}
function pfGroupMessages(gid){const p=phoneFriendState();return pfMsgList(p.groupMessages,gid).slice().sort((a,b)=>(a.time||0)-(b.time||0));}
function pfGroupMemberById(g,id){id=(''+id).toUpperCase();return (g&&Array.isArray(g.members)?g.members:[]).find(m=>pfKeyOf(m)===id)||null;}
function pfGroupMemberName(g,m){const id=pfKeyOf(m),f=id&&phoneFriendById(id);if(id===phoneFriendState().id)return S.me.name||'我';return f?pfFriendDisplayName(f):((m&&(m.display_name||m.name))||id||'群成员');}
function pfGroupIsOwner(g){return !!(g&&(''+(g.owner_id||'')).toUpperCase()===phoneFriendState().id);}
function phoneFriendGroupShowEarlier(gid){const el=$('#pfgroupbg'),oldHeight=el?el.scrollHeight:0;_pfGroupRenderLimit[gid]=(_pfGroupRenderLimit[gid]||120)+120;render();requestAnimationFrame(()=>{const next=$('#pfgroupbg');if(next)next.scrollTop=Math.max(0,next.scrollHeight-oldHeight);});}
function phoneFriendManage(id){id=(''+id).toUpperCase();const f=phoneFriendById(id)||{phone_id:id,display_name:id};
  openModal(`<h3>${esc(pfFriendDisplayName(f))}</h3>
    <div class="it" onclick="phoneFriendRemark('${id}')"><span>备注</span><span class="v">${esc((phoneFriendState().remarks||{})[id]||'未设置')} ›</span></div>
    <div class="it danger" onclick="phoneFriendClearChat('${id}')"><span>清空聊天记录</span><span class="v">›</span></div>
    <div class="it danger" onclick="phoneFriendDeleteFriend('${id}')"><span>删除好友</span><span class="v">›</span></div>
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
function phoneFriendRemark(id){const p=phoneFriendState(),f=phoneFriendById(id)||{display_name:id};openModal(`<h3>好友备注</h3><div class="field"><label>原昵称：${esc(phoneFriendName(f))}</label><input id="pfr_name" value="${esc((p.remarks||{})[id]||'')}" placeholder="给ta起个备注"></div><div class="btns"><button class="btn g" onclick="phoneFriendManage('${id}')">返回</button><button class="btn p" onclick="(function(){var p=phoneFriendState();p.remarks=p.remarks||{};var v=$('#pfr_name').value.trim();if(v)p.remarks['${id}']=v;else delete p.remarks['${id}'];save();closeModal();render();toast('已保存备注');})()">保存</button></div>`);}
async function phoneFriendClearChat(id){const p=phoneFriendState();if(!pfMsgList(p.messages,id).length){toast('没有聊天记录');return;}if(!await uiConfirm('清空和「'+pfFriendDisplayName(phoneFriendById(id))+'」的本地聊天记录？\n云端不会删除，对方那边不受影响。'))return;p.clearBefore[id]=Date.now();p.messages[id]=[];p.friendRead[id]=Date.now();p.lastSync=Date.now();save();closeModal();render();toast('已清空');}
async function phoneFriendDeleteFriend(id){id=(''+id).toUpperCase();const f=phoneFriendById(id);if(!f)return;if(!await uiConfirm('删除小手机好友「'+pfFriendDisplayName(f)+'」？\n会解除好友关系，并清空你本地和ta的聊天记录。'))return;
  const p=phoneFriendState();try{await pfRpc('phone_friend_delete_friend',{p_phone_id:p.id,p_secret:p.secret,p_friend_id:id},25000);}catch(e){toast(e.message||'删除失败');return;}
  p.friends=(p.friends||[]).filter(x=>(''+(x.phone_id||x.id)).toUpperCase()!==id);if(p.messages)delete p.messages[id];if(p.remarks)delete p.remarks[id];if(p.friendRead)delete p.friendRead[id];if(p.clearBefore)delete p.clearBefore[id];p.lastSync=0;save();closeModal();if(cur().p==='pfchat'||cur().p==='pffriends')openPhoneFriends();else render();toast('已删除好友');}
function phoneFriendGroupManage(gid){const g=pfGroupById(gid)||{group_id:gid,name:'小手机群聊'};
  openModal(`<h3>${esc(pfGroupDisplayName(g))}</h3>
    <div class="it" onclick="phoneFriendGroupMembers('${gid}')"><span>群成员</span><span class="v">${Math.max(1,+(g.member_count||0),(g.members||[]).length)}人 ›</span></div>
    <div class="it" onclick="phoneFriendGroupRemark('${gid}')"><span>群聊备注</span><span class="v">${esc((phoneFriendState().groupRemarks||{})[gid]||'未设置')} ›</span></div>
    <div class="it" onclick="pfGroupBubbleList('${gid}')"><span>群聊气泡美化</span><span class="v">每个人单独设置 ›</span></div>
    <div class="it" onclick="phoneFriendInviteToGroupModal('${gid}')"><span>邀请小手机好友进群</span><span class="v">›</span></div>
    <div class="it danger" onclick="phoneFriendClearGroup('${gid}')"><span>清空群聊天记录</span><span class="v">›</span></div>
    ${pfGroupIsOwner(g)?`<div class="it danger" onclick="phoneFriendDisbandGroup('${gid}')"><span>解散群聊</span><span class="v">仅群主 ›</span></div>`:`<div class="it danger" onclick="phoneFriendLeaveGroup('${gid}')"><span>退出群聊</span><span class="v">›</span></div>`}
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
function phoneFriendGroupMembers(gid){const g=pfGroupById(gid);if(!g){toast('群聊资料正在同步，请稍后重试');return;}const p=phoneFriendState(),owner=(''+(g.owner_id||'')).toUpperCase(),canKick=pfGroupIsOwner(g),members=(Array.isArray(g.members)?g.members:[]).slice().sort((a,b)=>{const ai=pfKeyOf(a),bi=pfKeyOf(b);return ai===owner?-1:bi===owner?1:0;});
  openModal(`<h3>群成员（${members.length}）</h3><div class="hint">成员昵称和头像来自群资料，即使没有互加好友也可以查看。</div>${members.map(m=>{const id=pfKeyOf(m),isOwner=id===owner,isMe=id===p.id,action=canKick&&!isOwner&&!isMe?`<button class="minibtn" style="color:#ff6b7a" onclick="phoneFriendGroupRemoveMember('${gid}','${id}')">移出</button>`:'';return `<div class="it">${pfAvatarHTML(m,'sm')}<span style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pfGroupMemberName(g,m))}</b><small style="color:#888">${esc(id)}${isOwner?' · 群主':isMe?' · 我':''}</small></span>${action}</div>`;}).join('')||'<div class="empty">成员资料正在同步</div>'}<button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
async function phoneFriendGroupRemoveMember(gid,memberId){const p=phoneFriendState(),g=pfGroupById(gid),m=g&&pfGroupMemberById(g,memberId);if(!g||!pfGroupIsOwner(g)){toast('只有群主可以移出成员');return;}if(!m||memberId===p.id||memberId===(''+g.owner_id).toUpperCase()){toast('不能移出群主');return;}if(!await uiConfirm('将「'+pfGroupMemberName(g,m)+'」移出群聊？',{danger:true}))return;
  try{const ok=await pfRpc('phone_friend_group_remove_member',{p_owner_id:p.id,p_secret:p.secret,p_group_id:gid,p_member_id:memberId},25000);if(ok!==true)throw new Error('该成员已不在群里');g.members=(g.members||[]).filter(x=>pfKeyOf(x)!==memberId);g.member_count=g.members.length;save();await phoneFriendSync(true,false,true);phoneFriendGroupMembers(gid);render();toast('已移出群聊');}
  catch(e){const msg=e&&e.message||'移出失败';toast(/Could not find|schema cache|好友云端表还没开通/i.test(msg)?'群成员管理尚未部署，请先更新云端补丁':msg);}}
function phoneFriendGroupRemark(gid){const p=phoneFriendState(),g=pfGroupById(gid)||{name:'小手机群聊'};openModal(`<h3>群聊备注</h3><div class="field"><label>原群名：${esc(g.name||'小手机群聊')}</label><input id="pfg_remark" value="${esc((p.groupRemarks||{})[gid]||'')}" placeholder="给这个群起个备注"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="(function(){var p=phoneFriendState();p.groupRemarks=p.groupRemarks||{};var v=$('#pfg_remark').value.trim();if(v)p.groupRemarks['${gid}']=v;else delete p.groupRemarks['${gid}'];save();closeModal();render();toast('已保存备注');})()">保存</button></div>`);}
async function phoneFriendClearGroup(gid){const p=phoneFriendState();if(!pfMsgList(p.groupMessages,gid).length){toast('没有群聊天记录');return;}if(!await uiConfirm('清空这个群的本地聊天记录？\n云端不会删除，其他成员不受影响。'))return;p.groupClearBefore[gid]=Date.now();p.groupMessages[gid]=[];p.groupRead[gid]=Date.now();p.lastSync=Date.now();save();closeModal();render();toast('已清空');}
async function phoneFriendDisbandGroup(gid){const p=phoneFriendState(),g=pfGroupById(gid);if(!g||!pfGroupIsOwner(g)){toast('只有群主可以解散群聊');return;}if(!await uiConfirm('确认解散「'+pfGroupDisplayName(g)+'」？\n\n群聊、成员、邀请和消息会从云端永久删除，所有成员下次同步后都将看不到这个群。',{danger:true}))return;
  try{const ok=await pfRpc('phone_friend_group_disband',{p_owner_id:p.id,p_secret:p.secret,p_group_id:gid},30000);if(ok!==true)throw new Error('群聊已不存在或你已不是群主');}
  catch(e){const msg=e&&e.message||'解散失败';toast(/Could not find|schema cache|好友云端表还没开通/i.test(msg)?'解散群聊功能尚未部署，请先更新云端补丁':msg);return;}
  p.groups=(p.groups||[]).filter(x=>(x.group_id||x.id)!==gid);if(p.groupMessages)delete p.groupMessages[gid];if(p.groupRemarks)delete p.groupRemarks[gid];if(p.groupRead)delete p.groupRead[gid];if(p.groupClearBefore)delete p.groupClearBefore[gid];if(p.groupBubbleStyles)delete p.groupBubbleStyles[gid];delete _pfGroupRenderLimit[gid];p.lastSync=0;save();closeModal();openPhoneFriends();toast('群聊已解散');try{await phoneFriendSync(true,false,true);}catch(_){}
}
async function phoneFriendLeaveGroup(gid){const p=phoneFriendState(),g=pfGroupById(gid);if(!g){toast('群聊资料正在同步，请稍后重试');return;}if(pfGroupIsOwner(g)){toast('群主不能直接退出，请先解散群聊');return;}if(!await uiConfirm('退出「'+pfGroupDisplayName(g)+'」？\n退出后群聊会从你的列表移除，其他成员和原有消息不受影响。',{danger:true}))return;
  try{const ok=await pfRpc('phone_friend_group_leave',{p_phone_id:p.id,p_secret:p.secret,p_group_id:gid},25000);if(ok!==true)throw new Error('你已不在这个群聊里');}
  catch(e){const msg=e&&e.message||'退出失败';toast(/Could not find|schema cache|好友云端表还没开通/i.test(msg)?'退出群聊功能尚未部署，请先更新云端补丁':msg);return;}
  p.groups=(p.groups||[]).filter(x=>(x.group_id||x.id)!==gid);if(p.groupMessages)delete p.groupMessages[gid];if(p.groupRemarks)delete p.groupRemarks[gid];if(p.groupRead)delete p.groupRead[gid];if(p.groupClearBefore)delete p.groupClearBefore[gid];if(p.groupBubbleStyles)delete p.groupBubbleStyles[gid];delete _pfGroupRenderLimit[gid];p.lastSync=0;save();closeModal();openPhoneFriends();toast('已退出群聊');try{await phoneFriendSync(true,false,true);}catch(_){}
}
function phoneFriendCreateGroupModal(){const fs=phoneFriendState().friends||[];if(fs.length<1){toast('先添加小手机好友');return;}window._pfGroupSel=[];
  openModal(`<h3>新建小手机群</h3><div class="field"><label>群名</label><input id="pfg_name" value="小手机群聊"></div>
    <div class="hint">选择要邀请进群的好友。对方会收到群聊邀请卡片，点同意后才会加入。</div>
    ${fs.map(f=>{const id=(''+(f.phone_id||f.id)).toUpperCase();return `<div class="it" onclick="pfGroupPick('${id}')">${pfAvatarHTML(f,'sm')}<span style="flex:1">${esc(pfFriendDisplayName(f))}</span><span class="v" id="pfg_${id}">＋</span></div>`;}).join('')}
    <div class="btns" style="margin-top:10px"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="phoneFriendCreateGroup()">创建群聊</button></div>`);}
function pfGroupPick(id){window._pfGroupSel=window._pfGroupSel||[];const i=window._pfGroupSel.indexOf(id);if(i>=0)window._pfGroupSel.splice(i,1);else window._pfGroupSel.push(id);const el=$('#pfg_'+id);if(el)el.textContent=i>=0?'＋':'✓';}
async function phoneFriendCreateGroup(){const ids=(window._pfGroupSel||[]).slice();if(!ids.length){toast('至少选一个好友');return;}const p=phoneFriendState(),name=(($('#pfg_name')&&$('#pfg_name').value)||'小手机群聊').trim().slice(0,40)||'小手机群聊';
  try{await pfEnsure();const g=await pfRpc('phone_friend_create_group',{p_owner_id:p.id,p_secret:p.secret,p_name:name,p_member_ids:[]},30000);const gid=(g&&g.group_id)||g;closeModal();toast('群聊已创建，已发送邀请');await phoneFriendSendGroupInvites(gid,ids);await phoneFriendSync(true);openPhoneFriendGroup(gid);}
  catch(e){toast(e.message||'创建失败');}}
function phoneFriendInviteToGroupModal(gid){const p=phoneFriendState(),g=pfGroupById(gid)||{},inGroup=new Set((g.members||[]).map(m=>(''+(m.phone_id||m.id||m)).toUpperCase()));inGroup.add(p.id);
  const fs=(p.friends||[]).filter(f=>!inGroup.has((''+(f.phone_id||f.id)).toUpperCase()));if(!fs.length){toast('没有可邀请的新好友');return;}window._pfGroupSel=[];
  openModal(`<h3>邀请进群</h3><div class="hint">选择要邀请进「${esc(pfGroupDisplayName(g))}」的好友。对方同意后才会加入。</div>
    ${fs.map(f=>{const id=(''+(f.phone_id||f.id)).toUpperCase();return `<div class="it" onclick="pfGroupPick('${id}')">${pfAvatarHTML(f,'sm')}<span style="flex:1">${esc(pfFriendDisplayName(f))}</span><span class="v" id="pfg_${id}">＋</span></div>`;}).join('')}
    <div class="btns" style="margin-top:10px"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="phoneFriendGroupAddMembers('${gid}')">邀请进群</button></div>`);}
async function phoneFriendGroupAddMembers(gid){const ids=(window._pfGroupSel||[]).slice();if(!ids.length){toast('至少选一个好友');return;}const p=phoneFriendState();
  try{await pfEnsure();await phoneFriendSendGroupInvites(gid,ids);toast('已发送群聊邀请');closeModal();await phoneFriendSync(true);openPhoneFriendGroup(gid);}
  catch(e){toast(e.message||'邀请失败');}}
async function phoneFriendSendGroupInvites(gid,ids){const p=phoneFriendState(),g=pfGroupById(gid)||{group_id:gid,name:'小手机群聊'};const invs=await pfRpc('phone_friend_group_invite',{p_phone_id:p.id,p_secret:p.secret,p_group_id:gid,p_invitee_ids:ids},30000);
  (Array.isArray(invs)?invs:[]).forEach(v=>{const to=(''+(v.invitee_id||v.to_id||'')).toUpperCase();if(to)sendPhoneFriendBody(to,pfPack({type:'group_invite',inviteId:v.id,groupId:gid,groupName:pfGroupDisplayName(g),inviterId:p.id,inviterName:S.me.name||'我'}),{silent:true});});}
async function pfGroupInviteAccept(mid,inviteId,ok){const p=phoneFriendState();let found=null;Object.keys(p.messages||{}).some(id=>{found=pfMsgList(p.messages,id).find(x=>x.id===mid);return !!found;});if(!found)return;found.inviteStatus=ok?'accepted':'declined';save();render();
  try{await pfRpc('phone_friend_group_accept_invite',{p_phone_id:p.id,p_secret:p.secret,p_invite_id:inviteId,p_accept:!!ok},25000);toast(ok?'已加入群聊':'已拒绝邀请');await phoneFriendSync(true);const pl=pfMsgPayload(found);if(ok&&pl&&pl.groupId)openPhoneFriendGroup(pl.groupId);}
  catch(e){found.inviteStatus='';save();render();toast(e.message||'操作失败');}}
async function sendPhoneFriendGroup(gid){const ta=$('#pfg_input'),text=(ta&&ta.value||'').trim();if(!text)return;const p=phoneFriendState();if(ta)ta.value='';
  if(ta){ta.style.height='auto';chatComposerStateSync(ta);}const voice=groupComposerVoiceOn('pfgroup',gid);sendPhoneFriendGroupBody(gid,voice?pfPack({type:'voice',text,dur:Math.max(1,Math.round(text.length/3))}):text);}
async function sendPhoneFriendGroupBody(gid,body,opt){body=(''+(body||'')).trim();opt=opt||{};if(!body)return;const silent=!!opt.silent;body=pfGroupOutgoingBody(gid,body);if(body.length>PHONE_FRIEND_BODY_MAX){if(!silent)toast('这条消息太大，发不出去');return;}const p=phoneFriendState(),localId='local_'+uid();body=pfTagOutgoing(body,localId);if(body.length>PHONE_FRIEND_BODY_MAX){if(!silent)toast('这条消息太大，发不出去');return;}
  if(S.couple&&S.couple.gags&&S.couple.gags[pfgGagKey(gid)]){if(!silent)toast('这个群聊被ta禁言了，先去求ta解开');return;}
  if(!silent&&typeof gmMutedUntil==='function'&&gmMutedUntil('pf',gid,p.id)){toast('你已被禁言');render();return;}
  pfStoreGroupMessage({id:localId,group_id:gid,from_id:p.id,body,time:Date.now()});pfSetSendState('group',gid,localId,'sending');if(opt.bill) addBill('out',opt.bill.amount,opt.bill.note);save();if(!silent)render();
  if(!silent&&S.settings.sound&&typeof playDing==='function')playDing();
  let submitted=false,confirmed=false;try{await pfEnsure();submitted=true;const m=await pfRpc('phone_friend_send_group_message',{p_from_id:p.id,p_secret:p.secret,p_group_id:gid,p_body:body},30000);confirmed=true;pfStoreGroupMessage(m);save();phoneFriendSync(true);}
  catch(e){if(confirmed){if(!silent)toast('消息已发送，本机刷新暂时失败；请刷新聊天查看。');return;}const unknown=submitted&&!!e.pfSubmissionUnknown;if(unknown){pfSetSendState('group',gid,localId,'unknown');if(await pfRecoverSend('group',gid,body,p))return;}else pfSetSendState('group',gid,localId,'not-sent');if(opt.bill&&!unknown){addBill('in',opt.bill.amount,'发送失败退款：'+(opt.bill.refundName||'小手机群转账'));const arr=pfMsgList(p.groupMessages,gid);if(arr.length){const i=arr.findIndex(x=>x.id===localId);if(i>=0)arr.splice(i,1);}}if(!silent)toast(!submitted?'连接未成功，消息尚未提交；请稍后重试。':e.message||'发送失败');return {pending:unknown};}
  finally{if(!silent&&cur().p==='pfgroup'&&cur().gid===gid)render();}}
function pfCardBody(type,amount,note){return pfPack({type,amount:+amount||0,note:(note||'').trim()});}
function phoneFriendTransferModal(id,type){id=(''+id).toUpperCase();paySendOpen(type==='redpacket'?'red':'transfer','pf',id);}
function phoneFriendTransferModalLegacy(id,type){id=(''+id).toUpperCase();const f=phoneFriendById(id)||{display_name:id};const red=type==='redpacket';
  openModal(`<h3>${red?'红包':'转账'}给 ${esc(pfFriendDisplayName(f))}</h3><div class="field"><label>金额</label><input id="pft_amt" type="number" step="0.01" placeholder="${red?'6.66':'13.14'}"></div><div class="field"><label>${red?'祝福语':'说明'}</label><input id="pft_note" placeholder="${red?'恭喜发财，大吉大利':'给你～'}"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="phoneFriendSendMoney('${id}','${type}')">${red?'塞钱':'转账'}</button></div>`);}
function phoneFriendSendMoney(id,type){const amt=+($('#pft_amt')&&$('#pft_amt').value);if(!amt){toast('填金额呀');return;}if(amt>S.me.balance){toast('余额不够啦（去钱包看看）');return;}const f=phoneFriendById(id)||{display_name:id},red=type==='redpacket',note=(($('#pft_note')&&$('#pft_note').value)||'').trim();
  closeModal();sendPhoneFriendBody(id,pfCardBody(type,amt,note),{bill:{amount:amt,note:(red?'发红包给':'转账给')+pfFriendDisplayName(f),refundName:pfFriendDisplayName(f)}});}
function phoneFriendGroupTransferModal(gid,type){if(type==='transfer'){groupPayPick('pf',gid);return;}if(type==='redpacket'){groupRpSendOpen(gid,'pf');return;}/* 群红包：个数 + 拼手气，大家来抢 *//* 群转账先选收款方 */paySendOpen(type==='redpacket'?'red':'transfer','pfg',gid);}
function phoneFriendGroupTransferModalLegacy(gid,type){const g=pfGroupById(gid)||{name:'小手机群聊'},red=type==='redpacket';
  openModal(`<h3>群${red?'红包':'转账'}</h3><div class="hint">${esc(pfGroupDisplayName(g))}</div><div class="field"><label>金额</label><input id="pft_amt" type="number" step="0.01" placeholder="${red?'6.66':'13.14'}"></div><div class="field"><label>${red?'祝福语':'说明'}</label><input id="pft_note" placeholder="${red?'恭喜发财，大吉大利':'给你～'}"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="phoneFriendGroupSendMoney('${gid}','${type}')">${red?'发红包':'转账'}</button></div>`);}
function phoneFriendGroupSendMoney(gid,type){const amt=+($('#pft_amt')&&$('#pft_amt').value);if(!amt){toast('填金额呀');return;}if(amt>S.me.balance){toast('余额不够啦（去钱包看看）');return;}const red=type==='redpacket',note=(($('#pft_note')&&$('#pft_note').value)||'').trim();closeModal();
  sendPhoneFriendGroupBody(gid,pfCardBody(type,amt,note),{bill:{amount:amt,note:'小手机群里'+(red?'发红包':'转账'),refundName:'小手机群转账'}});}
/* ===== 真人好友发表情包 =====
   她说「私人版本的真人好友发表情包显示不出来，我自己的显示不出来，网页版本的确实可以」。
   根子在存档的图片是怎么回填的：保存时大图会被换成 'idb:xxxx' 这么一个短引用，
   而 lazyStoredImagesOn()（私人 App、安卓、iOS 网页都算）读档时【不回填】——
   所以在她手机上 S.me.stickers[i].img 拿到的就是字符串 'idb:xxxx' 本身。
   原来这里直接把它塞进要发出去的包，isImg() 认不出 idb:，自己和对面都渲染成空白。
   桌面网页会完整回填，所以一直看不出问题，正好对上她说的「网页版可以」。
   真人好友的消息是要发到服务器的，包必须自带真图，不能带一个只有本机认识的引用。 */
async function pfStickerImage(s){const raw=String(s&&s.img||'');
  if(!isStoredImgRef(raw))return raw;
  const key=raw.slice(4);
  if(_imgCache[key])return _imgCache[key];
  try{const src=await imgGet(key);
    if(src){_imgCache[key]=src;_imgRev.set(src,key);_imgReady.add(key);return src;}}catch(_){}
  return '';}
async function pfStickerBody(s){const img=await pfStickerImage(s);
  if(!img)return {body:'',why:'这个表情图读不出来，重新上传一次试试'};
  const body=pfPack({type:'sticker',img,meaning:(s&&s.meaning)||''});
  if(!body)return {body:'',why:'这个表情打不开'};
  /* 真图比引用大得多，所以大小要在【读出真图之后】再判一次 */
  if(body.length>PHONE_FRIEND_BODY_MAX)return {body:'',why:'这个表情太大，先换个小一点的'};
  return {body,why:''};}
async function phoneFriendSendSticker(id,i){const s=(S.me.stickers||[])[i];if(!s)return;
  const r=await pfStickerBody(s);if(!r.body){toast(r.why);return;}
  const p=$('#pfpanel');if(p)p.classList.remove('show');sendPhoneFriendBody(id,r.body);}
async function phoneFriendGroupSendSticker(gid,i){const s=(S.me.stickers||[])[i];if(!s)return;
  const r=await pfStickerBody(s);if(!r.body){toast(r.why);return;}
  const p=$('#pfgpanel');if(p)p.classList.remove('show');sendPhoneFriendGroupBody(gid,r.body);}
function phoneFriendPanelToggle(panelId){const p=$('#'+panelId);if(!p)return;const show=!p.classList.contains('show');p.classList.toggle('show',show);if(show)warmStickerImages(S.me.stickers||[]).catch(()=>{});}
function pfDeleteSticker(i,panelId){if(!S.me.stickers||!S.me.stickers[i])return;S.me.stickers.splice(i,1);save();render();setTimeout(()=>{const p=$('#'+panelId);if(p)p.classList.add('show');},0);}
function pfImagePack(src){return pfPack({type:'image',img:src,desc:''});}
function phoneFriendSendImage(id){const p=$('#pfpanel');if(p)p.classList.remove('show');pickFile('image/*',async f=>{let src;try{src=await compress(f,620,.68);}catch(e){try{src=await readAsDataURL(f);}catch(_){toast('图片读取失败');return;}}let body=pfImagePack(src);if(!body||body.length>PHONE_FRIEND_BODY_MAX){try{src=await compress(f,420,.58);body=pfImagePack(src);}catch(_){body='';}}if(!body||body.length>PHONE_FRIEND_BODY_MAX){toast('图片太大，换一张小一点的');return;}sendPhoneFriendBody(id,body);});}
function phoneFriendGroupSendImage(gid){const p=$('#pfgpanel');if(p)p.classList.remove('show');pickFile('image/*',async f=>{let src;try{src=await compress(f,620,.68);}catch(e){try{src=await readAsDataURL(f);}catch(_){toast('图片读取失败');return;}}let body=pfImagePack(src);if(!body||body.length>PHONE_FRIEND_BODY_MAX){try{src=await compress(f,420,.58);body=pfImagePack(src);}catch(_){body='';}}if(!body||body.length>PHONE_FRIEND_BODY_MAX){toast('图片太大，换一张小一点的');return;}sendPhoneFriendGroupBody(gid,body);});}
function phoneFriendGroupPatModal(gid){const p=phoneFriendState(),g=pfGroupById(gid)||{members:[]},ids=['me'].concat(pfGroupMemberIds(g));const rows=ids.map(id=>{const me=id==='me',tid=me?p.id:id,f=me?null:phoneFriendById(id),nm=me?(S.me.name||'我'):(pfNameById(id)||id),avh=me?av(S.me.avatar,'sm'):pfAvatarHTML(f||{phone_id:id,display_name:nm},'sm');return `<div class="it" onclick="phoneFriendGroupPat('${gid}','${tid}')">${avh}<span style="flex:1">${esc(nm)}${me?'（我）':''}</span><span class="v">拍一拍</span></div>`;}).join('');
  const panel=$('#pfgpanel');if(panel)panel.classList.remove('show');openModal(`<h3>拍一拍</h3><div class="hint">会作为群消息发出去，群里所有人都能看见。</div><div class="section">${rows}</div><button class="btn g" style="margin-top:10px" onclick="closeModal()">取消</button>`);}
let _pfLastPat=null;
function phoneFriendGroupPat(gid,targetId){targetId=(''+(targetId||'')).toUpperCase();const key=gid+'|'+targetId,now=Date.now();if(_pfLastPat&&_pfLastPat.key===key&&now-_pfLastPat.t<900)return;_pfLastPat={key,t:now};const targetName=pfNameById(targetId)||targetId;closeModal();sendPhoneFriendGroupBody(gid,pfPack({type:'pat',targetId,targetName,fromName:S.me.name||'我'}));}
/* 她说真人好友这边「聊天框和角色的那种会看着舒服一点，功能不会在聊天框的上面，
   而是在聊天框的下面弹出来，跟那个微信角色的一样就行」——所以这里和微信角色、
   好友群聊共用同一套 chat-tools-panel（表情和功能各一页），功能项还是好友自己的。 */
function pfPanelHTML(id){const stk=S.me.stickers||[];return `<div class="panel chat-tools-panel group-chat-tools" id="pfpanel" data-page="fn"><div class="chat-panel-pane chat-function-pane on"><div class="chat-function-viewport"><section class="chat-function-page"><button type="button" class="it" onclick="phoneFriendSendImage('${id}')"><span class="b">${svgIc('image',26,'currentColor')}</span><span>相册</span></button><button type="button" class="it" onclick="document.getElementById('pfpanel').classList.remove('show');phoneFriendTransferModal('${id}','transfer')"><span class="b">${svgIc('money',26,'currentColor')}</span><span>转账</span></button><button type="button" class="it" onclick="document.getElementById('pfpanel').classList.remove('show');phoneFriendTransferModal('${id}','redpacket')"><span class="b">${svgIc('redpacket',26,'currentColor')}</span><span>红包</span></button><button type="button" class="it" onclick="addSticker()"><span class="b">${svgIc('smile',26,'currentColor')}</span><span>添加表情</span></button><button type="button" class="it" onclick="openStickerBatchImport()"><span class="b">${svgIc('image',26,'currentColor')}</span><span>批量添加</span></button></section></div></div><div class="chat-panel-pane chat-emoji-pane"><div class="ppage"><div class="estk">${stk.map((s,i)=>`<div class="s" onclick="phoneFriendSendSticker('${id}',${i})"><span class="x" onclick="event.stopPropagation();pfDeleteSticker(${i},'pfpanel')">×</span>${stickerImageHTML(s.img)}<small>${esc(s.meaning||'')}</small></div>`).join('')||'<div style="color:#777;font-size:12px;padding:8px">还没有自定义表情，点加号里的「添加表情」上传</div>'}</div></div></div></div>`;}
function pfGroupPanelHTML(gid){const stk=S.me.stickers||[];return `<div class="panel chat-tools-panel group-chat-tools" id="pfgpanel" data-page="fn"><div class="chat-panel-pane chat-function-pane on"><div class="chat-function-viewport"><section class="chat-function-page"><button type="button" class="it" onclick="phoneFriendGroupSendImage('${gid}')"><span class="b">${svgIc('image',26,'currentColor')}</span><span>相册</span></button><button type="button" class="it" onclick="document.getElementById('pfgpanel').classList.remove('show');phoneFriendGroupTransferModal('${gid}','transfer')"><span class="b">${svgIc('money',26,'currentColor')}</span><span>转账</span></button><button type="button" class="it" onclick="document.getElementById('pfgpanel').classList.remove('show');phoneFriendGroupTransferModal('${gid}','redpacket')"><span class="b">${svgIc('redpacket',26,'currentColor')}</span><span>红包</span></button><button type="button" class="it" onclick="phoneFriendGroupPatModal('${gid}')"><span class="b" style="font-size:24px">↟</span><span>拍一拍</span></button><button type="button" class="it" onclick="addSticker()"><span class="b">${svgIc('smile',26,'currentColor')}</span><span>添加表情</span></button><button type="button" class="it" onclick="openStickerBatchImport()"><span class="b">${svgIc('image',26,'currentColor')}</span><span>批量添加</span></button></section></div></div><div class="chat-panel-pane chat-emoji-pane"><div class="ppage"><div class="estk">${stk.map((s,i)=>`<div class="s" onclick="phoneFriendGroupSendSticker('${gid}',${i})"><span class="x" onclick="event.stopPropagation();pfDeleteSticker(${i},'pfgpanel')">×</span>${stickerImageHTML(s.img)}<small>${esc(s.meaning||'')}</small></div>`).join('')||'<div style="color:#777;font-size:12px;padding:8px">还没有自定义表情，点加号里的「添加表情」上传</div>'}</div></div></div></div>`;}
// 真人群转账可以指定收款人（payTo）：只有那个人能点收款，别人看到「转账给X」
function pfGroupTransferOpts(m,p,me,done){const to=String(p.payTo||'').toUpperCase(),forMe=!me&&(!to||to===String(phoneFriendState().id||'').toUpperCase()),toName=to&&!forMe?(p.payToName||pfNameById(to)||'群成员'):'';return {me,received:done,amount:p.amount,note:p.note,toName,click:forMe&&!done?`pfReceivePay('${m.id}')`:''};}
function pfBubblePart(m,me,bstyle){if(m&&m.recalled)return `<div class="bubble recalled">已撤回一条消息</div>`;const p=pfMsgPayload(m);if(!p){if(String(m.text||'').indexOf('[PF|')===0)return bubbleSingleHTML('[消息]','',bstyle,me);/* 别人@我的消息和普通消息一样是灰色气泡（@我的提醒照常） */return bubbleSingleHTML(m.text,'',bstyle,me);}
  if(p.type==='shopshare'&&typeof NorthMarketBusiness!=='undefined')return NorthMarketBusiness.shareCard(p.shopShare);if(p.type==='text')return bubbleSingleHTML(p.text||'','',bstyle,me);
  if(p.type==='pat')return bubbleSingleHTML(pfPatText(m,p),'',bstyle,me);
  if(p.type==='game_room_invite'){const g=mgrGame(p.game);return `<div class="card" style="width:250px;background:linear-gradient(145deg,#172033,#251f38);border:1px solid #4b5a78;box-shadow:0 8px 20px rgba(0,0,0,.22)" onclick="event.stopPropagation();openMixedGameRoom('${p.roomId}')"><div style="padding:13px"><div style="font-size:11px;color:#aeb9d4;margin-bottom:6px">${svgIc('dice',13,'#aeb9d4')} 多人游戏房间</div><div style="font-size:16px;color:#fff;font-weight:700">${esc(p.title||((g.e||'')+' '+g.n))}</div><div style="font-size:12px;color:#a9b1c5;line-height:1.6;margin-top:7px">房主：${esc(p.hostName||'小手机好友')}<br>等待所有真人玩家准备</div></div><div class="cfoot" style="color:#9fb0d8;background:rgba(255,255,255,.06)">点击进入房间</div></div>`;}
  if(p.type==='group_invite'){const st=m.inviteStatus||'',done=st==='accepted'||st==='declined';return `<div class="card" style="width:250px;background:linear-gradient(145deg,#291d34,#1c2636);border:1px solid #51415f" ${done||me?'':`onclick="event.stopPropagation()"`}><div style="padding:13px"><div style="font-size:11px;color:#d9b8ff;margin-bottom:6px">${svgIc('users',13,'#d9b8ff')} 小手机群聊邀请</div><div style="font-size:16px;color:#fff;font-weight:700">${esc(p.groupName||'小手机群聊')}</div><div style="font-size:12px;color:#b8b0c6;line-height:1.6;margin-top:7px">${me?'已发送邀请':'邀请人：'+esc(p.inviterName||'小手机好友')}</div>${(!me&&!done)?`<div style="display:flex;gap:8px;margin-top:12px"><button class="minibtn" style="background:#07c160;color:#fff" onclick="event.stopPropagation();pfGroupInviteAccept('${m.id}','${p.inviteId}',true)">同意</button><button class="minibtn" onclick="event.stopPropagation();pfGroupInviteAccept('${m.id}','${p.inviteId}',false)">拒绝</button></div>`:st?`<div style="font-size:12px;color:#9ea0aa;margin-top:10px">${st==='accepted'?'已同意':'已拒绝'}</div>`:''}</div><div class="cfoot" style="color:#bda8d8;background:rgba(255,255,255,.06)">群聊邀请</div></div>`;}
  if(p.type==='game_room_ready'||p.type==='game_room_start'||p.type==='game_room_chat')return bubbleSingleHTML(pfMsgPreview(m),'',bstyle,me);
  /* 兜一层：修复之前已经发出去的那些消息里存的是 idb: 引用，
     在她自己这台机器上还能从图库里取出来显示 */
  if(p.type==='sticker'){const stk=storedImageDisplaySource(p.img);
    return `<div class="stickermsg">${isImg(stk)?`<img src="${stk}">`:''}${p.meaning?`<div class="stkm">${esc(p.meaning)}</div>`:''}${!me?`<button class="minibtn pfcollect" onclick="event.stopPropagation();pfSaveSticker('${m.id}')">收藏</button>`:''}</div>`;}
  if(p.type==='voice')return bubbleSingleHTML('◖ )))  '+(p.text||'语音消息'),'group-voice-bubble',bstyle,me);
  if(p.type==='image')return `<div class="imagemsg" onclick="event.stopPropagation();${p.img?`viewImg('${p.img||''}')`:''}">${isImg(p.img)?`<img src="${p.img}">`:(p.cleaned?'[图片缓存已清理]':'[图片]')}</div>`;
  if(p.type==='transfer'&&m&&m.to){const view=pfTransferView(m);
    if(view)return payCard('t',view,pfMsgIsMine(m),PF_CID_PREFIX+pfMsgFriendId(m));}
  if(p.type==='redpacket'&&pfRpLucky(p)){const st=pfRpState(m,p);return rpCardHTML({me,opened:me?st.done:!!(st.mine||st.done),note:p.note,status:st.mine&&!me?'已领取':st.done?'已被领完':'',click:`redpOpen('pf','','${m.id}')`});}
  if(p.type==='redpacket'){const done=!!m.received,byMe=String(m.receivedBy||'').toUpperCase()===String(phoneFriendState().id||'').toUpperCase(),grp=!m.to,status=done?(me?(grp?'已被领完':'已被领取'):(byMe||!grp?'已领取':'已被领完')):'';
    return rpCardHTML({me,opened:done,note:p.note,status,click:`redpOpen('pf','','${m.id}')`});}
  if(p.type==='transfer'){const done=!!m.received;return groupTransferCardHTML(pfGroupTransferOpts(m,p,me,done));}
  return bubbleSingleHTML(pfMsgPreview(m),'',bstyle,me);}
function pfPatName(id,fallback){const p=phoneFriendState();id=(''+(id||'')).toUpperCase();if(id&&id===p.id)return '你';return (id&&pfNameById(id))||fallback||'成员';}
function pfPatSuffix(m,pl){const p=phoneFriendState(),fromId=String(m&&m.from||'').toUpperCase(),targetId=String(pl&&pl.targetId||'').toUpperCase(),raw=String(S.me&&S.me.wxPatText||'').trim();if(!raw||targetId!==p.id||fromId===p.id)return '';return raw.startsWith('的')||/^[，。！？、；：,.!?;:]/.test(raw)?raw:'的'+raw;}
function pfPatText(m,pl){pl=pl||pfMsgPayload(m)||{};const from=pfPatName(m&&m.from,pl.fromName),target=pfPatName(pl.targetId,pl.targetName);return from+'拍了拍'+target+pfPatSuffix(m,pl);}
function pfPatRow(m){return `<div class="pfpat">${esc(pfPatText(m))}</div>`;}
function pfRecalledRow(){return '<div class="pfrecalled">已撤回一条消息</div>';}
function pfReceivePay(mid,quiet){const p=phoneFriendState();let found=null,kind='friend',name='小手机好友';
  Object.keys(p.messages||{}).some(id=>{const m=pfMsgList(p.messages,id).find(x=>x.id===mid);if(m){const f=phoneFriendById(id);found=m;name=f?pfFriendDisplayName(f):id;return true;}return false;});
  if(!found)Object.keys(p.groupMessages||{}).some(gid=>{const m=pfMsgList(p.groupMessages,gid).find(x=>x.id===mid);if(m){found=m;kind='group';name=pfNameById(m.from)||'群成员';return true;}return false;});
  const pay=found&&pfMsgPayload(found);if(!found||!pay||found.received||!(pay.type==='transfer'||pay.type==='redpacket'))return;if(pay.payTo&&String(pay.payTo).toUpperCase()!==String(p.id||'').toUpperCase()){toast('这笔转账不是给你的');return;}found.received=true;found.receivedBy=p.id;addBill('in',+pay.amount||0,'收到 '+name+' 的'+(pay.type==='redpacket'?'红包':'转账'));save();render();if(!quiet)toast('已收款 +¥'+(+pay.amount||0).toFixed(2));
  if(!String(found.id||'').startsWith('local_'))pfRpc('phone_friend_mark_received',{p_phone_id:p.id,p_secret:p.secret,p_message_id:found.id},20000).then(()=>phoneFriendSync(true)).catch(e=>{toast((e&&e.message)||'领取回执同步失败');});}
function pfSaveSticker(mid){const p=phoneFriendState();let found=null;Object.keys(p.messages||{}).some(id=>{found=pfMsgList(p.messages,id).find(x=>x.id===mid);return !!found;});if(!found)Object.keys(p.groupMessages||{}).some(gid=>{found=pfMsgList(p.groupMessages,gid).find(x=>x.id===mid);return !!found;});const pl=found&&pfMsgPayload(found);if(!pl||pl.type!=='sticker'||!pl.img){toast('这个表情收藏不了');return;}S.me.stickers=S.me.stickers||[];if(S.me.stickers.some(s=>s.img===pl.img)){toast('已经收藏过啦');return;}S.me.stickers.push({img:pl.img,meaning:pl.meaning||''});save();toast('已收藏到我的表情');}
/* 点气泡弹出消息操作。真人好友的气泡以前没有任何点击入口，撤回只能靠时间戳旁边那颗小按钮，找不到就等于功能不存在；
   气泡内的「收藏」「撤回」早就写着 event.stopPropagation()，本来就是按"外层有这层菜单"设计的，这里把缺的那一层补回来。 */
function pfMsgMenu(mid,scope,key){
  if(String(mid||'').startsWith('pf-receipt:'))return;
  const p=phoneFriendState(),list=scope==='group'?pfMsgList(p.groupMessages,key):pfMsgList(p.messages,key),m=list.find(x=>x.id===mid);
  if(!m||m.recalled)return;
  const me=m.from===p.id,pl=pfMsgPayload(m),pending=String(mid||'').startsWith('local_');
  const text=pl?(pl.type==='text'?String(pl.text||''):''):String(m.text||'');
  const canSticker=!me&&pl&&pl.type==='sticker'&&pl.img;
  openModal(`<h3>消息操作</h3>
    ${text?`<button class="btn g" style="margin-bottom:8px" onclick="pfCopyMsgText('${mid}','${scope}','${key}')">复制文字</button>`:''}
    ${canSticker?`<button class="btn g" style="margin-bottom:8px" onclick="closeModal();pfSaveSticker('${mid}')">收藏这个表情</button>`:''}
    ${me?`<button class="btn d" style="margin-bottom:8px" onclick="closeModal();phoneFriendRecallMessage('${mid}','${scope}','${key}')">撤回这条消息</button>`:''}
    ${me&&pending?`<div class="hint" style="margin:-4px 0 8px">这条还在发送，要等它同步到云端才能撤回。</div>`:''}
    <button class="btn g" onclick="closeModal()">取消</button>`);
}
function pfCopyMsgText(mid,scope,key){const p=phoneFriendState(),list=scope==='group'?pfMsgList(p.groupMessages,key):pfMsgList(p.messages,key),m=list.find(x=>x.id===mid);if(!m)return;const pl=pfMsgPayload(m),text=pl?(pl.type==='text'?String(pl.text||''):''):String(m.text||'');if(!text){toast('这条没有可复制的文字');return;}closeModal();Promise.resolve(copyTextCompat(text)).then(ok=>toast(ok?'已复制':'复制失败，请长按手动选择'));}
async function phoneFriendRecallMessage(mid,scope,gidOrId){const p=phoneFriendState();let found=null;if(scope==='group'){found=pfMsgList(p.groupMessages,gidOrId).find(x=>x.id===mid);}else{found=pfMsgList(p.messages,gidOrId).find(x=>x.id===mid);}
  if(!found||found.from!==p.id||found.recalled)return;if(String(mid||'').startsWith('local_')){toast('消息还在发送，稍后再撤回');return;}if(!await uiConfirm('撤回这条小手机消息？'))return;found.recalled=true;found.text='';save();render();
  pfRpc('phone_friend_recall_message',{p_phone_id:p.id,p_secret:p.secret,p_message_id:mid},25000).then(()=>phoneFriendSync(true)).catch(e=>toast(e.message||'云端撤回失败'));}
let _pfAtTimer=null;
function pfAtStart(ev,gid,id){try{ev.preventDefault();ev.stopPropagation();}catch(_){}clearTimeout(_pfAtTimer);_pfAtTimer=setTimeout(()=>{const ta=$('#pfg_input'),nm=pfNameById(id)||id;if(ta){ta.value=(ta.value||'')+'@'+nm+' ';ta.focus();}toast('@'+nm);},460);}
function pfAtEnd(){clearTimeout(_pfAtTimer);_pfAtTimer=null;}
let _pfTapLast=null;
//@@ web
function pfGroupAvatarTap(ev,gid,id){try{ev.preventDefault();ev.stopPropagation();}catch(_){}const now=Date.now(),key=gid+'|'+((''+id).toUpperCase());if(_pfTapLast&&_pfTapLast.key===key&&now-_pfTapLast.t<340){_pfTapLast=null;pfAtEnd();phoneFriendGroupPat(gid,id);return;}_pfTapLast={key,t:now};pfAtEnd();}
//@@ private
function pfGroupAvatarTap(ev,gid,id){try{ev.preventDefault();ev.stopPropagation();}catch(_){}const now=Date.now(),key=gid+'|'+((''+id).toUpperCase());if(_pfTapLast&&_pfTapLast.key===key&&now-_pfTapLast.t<341){_pfTapLast=null;pfAtEnd();phoneFriendGroupPat(gid,id);return;}_pfTapLast={key,t:now};pfAtEnd();}
//@@ end
function pfGroupAvatarDouble(ev,gid,id){try{ev.preventDefault();ev.stopPropagation();}catch(_){}pfAtEnd();_pfTapLast=null;phoneFriendGroupPat(gid,id);}
/* 授权只由后台明确移出；网页版本更新和服务故障不能让现有用户退出。 */
if(window.NorthLicense)window.NorthLicense.init({baseUrl:GATE_URL,apiKey:GATE_KEY,epoch:SHARE_EPOCH,endpoints:[
  {id:'primary',baseUrl:GATE_URL,apiKey:GATE_KEY},
  {id:'license-failover',baseUrl:LICENSE_FAILOVER_URL,apiKey:LICENSE_FAILOVER_KEY},
]});
function gateOK(){if(NORTH_PREVIEW)return true;if(!SHARE_GATE)return true;try{
  if(window.NorthLicense&&NorthLicense.session())return true;
  return localStorage.getItem('yibei_unlocked')===String(SHARE_EPOCH);
}catch(e){return false;}}
//@@ web
const APP_VER='v1874 · 卡片与联网备用';
//@@ private
const APP_VER='v1878 · 卡片与联网备用';
//@@ end
const VOICE_MAX_CHARS=300;
const VOICE_MAX_SECONDS=60;
const VOICE_AUDIO_TTL_MS=24*60*60*1000;
const DEFAULT_TTS_VOICE='male-qn-qingse';
function defState(){return{
  settings:{
    chat:{base:'https://vg.v1api.cc/v1',key:'',model:'gpt-4o-mini',temp:0.8,maxTokens:4096,offlineMaxTokens:4096,letterMaxTokens:4096,callMaxTokens:4096},chatRoutes:[],chatRouteActive:0,ttsRoutes:[],ttsRouteActive:0,
    aux:{base:'',key:'',model:''},
    search:{mode:'jina',base:'https://s.jina.ai',key:'',model:''},
    vision:{base:'',key:'',model:''},
hist:12, histUnit:'rounds', timeAware:true, timeZone:'', memoryFreq:1, onlineMemoryRecall:4, onlineSummaryRecall:4, onlineRecallTotal:6, replyDelay:2, sound:true, incomingRing:'default', incomingRingSongId:'', showMoodTag:true, roleMomentImages:true, web:{enabled:false}, summaryRounds:16, summaryModel:'main', offSummaryModel:'main', offlineWechatLive:true, proactiveIdleMin:0, callProb:35, callSilentMin:3, callPace:1, videoVisionIntervalMin:0, videoVisionMaxPerCall:6, screenShareRealtimeVision:false, screenShareSpeechVision:false, manualReply:true, initiative:true, personaGuard:true,
    voiceAuto:true, voiceProgressive:false, tts:{base:'',key:'',model:'',voice:''}, stt:{base:'',key:'',model:'',relay:false}, imgGen:false, imgModel:'gpt-image-2', imgBase:'', imgKey:''
  },
  me:{name:'我',wxid:'wx_'+Math.random().toString(36).slice(2,9),avatar:'🐱',signature:'这个人很懒，什么都没写～',persona:'',city:'',age:18,adultConsent:true,balance:520.00,bills:[],momentCover:'',lockBg:'',uiMaterial:'glass',appIconPack:'black',locked:true,lockNotes:[],status:'',place:'',battery:null,charging:false,onlineMode:'auto',steps:0,stepDate:stepDayKey(),sleep:{active:null,records:[]},appUsage:{date:'',used:{},bonus:{}}},
  worldbook:[],
  worldbookCategories:[],
  contacts:[],
  messages:{},
  moments:[],
  alarms:[],
  groups:[],
  couple:null,
  weather:null,
  spy:{},
  offline:{},
  offlineFocus:null,
  cohabitation:{enabled:false,paused:true,cid:'',homes:{}},
  cinema:{selectedCid:'',settings:{danmaku:true,autoComment:true,autoVision:false,voiceComment:false,chatPanelHeight:104,readerPaneHeight:0,replyCount:1,companionMode:'soft',autoLimit:4},sessions:[],library:[],progress:{}},
  shop:{cart:[],results:[],q:'',orders:[],cs:{msgs:[]},co:{on:false,cid:null,pace:'slow',feed:[],hisPending:[],myPending:[],lastActTs:0}},
  food:{cart:[],results:[],q:''},
  calendar:[],
  x:{profile:{handle:'@yibei_0414',bio:'做一只无忧无虑的小猫～',fans:328,following:12,cover:'',netCommentTone:'mixed',netCommentCustomOn:false,netCommentCustom:''},tweets:[],dms:[],following:[],blocked:[],circle:{},users:{}},
  friendRequests:[],
  friendDiscovery:{enabled:false,freq:180,max:2,today:'',n:0,nextAt:0},
  mail:[],
  phoneapp:{tab:'recents',line:'main',aliasNum:'',recents:[],sms:{},read:{},contacts:[],voicemail:[],favorites:[],blocked:{},keypad:'',rolePhones:{},roleAvatars:{},regions:{},aliasThreads:{},simCall:null,trash:[],stranger:{enabled:false,freq:60,max:3,today:'',n:0,nextAt:0,smsEnabled:false,smsFreq:90,smsMax:3,smsToday:'',smsN:0,smsNextAt:0}},
  _proactiveDone:{},
  _proactiveCount:{},
  _mailCount:{},
  _rolePushReceipts:[]
};}
const CORE_IDB_KEY='__core_state',RECOVERY_IDB_KEY='__recovery_state',RECOVERY_HISTORY_IDB_KEY='__recovery_history_state',CORE_INLINE_LIMIT=3.5*1024*1024;
let _bootFreshInstall=false;
//@@ web
let _coreBootRef=null,_coreOverflowMode=false,_coreMirrorWrite=Promise.resolve(true),_coreQueuedSave=null,_coreLogicalBytes=0,_coreSavePending=false,_coreFailureAt=0,_appBootFinished=false,_recoverySnapshotAt=0,_recoverySnapshotWrite=Promise.resolve(true),_androidOrphanCoreProbe=false,_idbOpenFailure='';
//@@ private
let _coreBootRef=null,_coreOverflowMode=false,_coreMirrorWrite=Promise.resolve(true),_coreQueuedSave=null,_coreLogicalBytes=0,_coreSavePending=false,_coreFailureAt=0,_appBootFinished=false,_recoverySnapshotAt=0,_recoverySnapshotWrite=Promise.resolve(true),_androidOrphanCoreProbe=false;
//@@ end
let S=load();
function normalizeLoadedState(){try{S.me=S.me||{};S.me.uiMaterial='glass';if(!['blue','pink','gray','black'].includes(S.me.appIconPack))S.me.appIconPack='black';S.me.theme='';if(typeof S.me.locked!=='boolean')S.me.locked=true;if(!Array.isArray(S.me.lockNotes))S.me.lockNotes=[];}catch(_){}
  try{S.settings=S.settings||{};if(!Object.prototype.hasOwnProperty.call(S.settings,'videoVisionIntervalMin')){const legacy=Number(S.settings.videoVisionIntervalSec);S.settings.videoVisionIntervalMin=Number.isFinite(legacy)?(legacy<=0?0:Math.max(1,Math.min(60,Math.round(legacy/60)))):0;}delete S.settings.videoVisionIntervalSec;}catch(_){}
  try{S.settings=S.settings||{};if(!S.settings.initiativeSchedulerV2){(S.contacts||[]).forEach(c=>{if(c)delete c._initiative;});S._proactiveCount={};S.settings.initiativeSchedulerV2=1;}}catch(_){}
  try{S.settings=S.settings||{};if(!S.settings.initiativeSchedulerV3){(S.contacts||[]).forEach(c=>{if(c)delete c._initiative;});S._proactiveCount={};S.settings.initiativeSchedulerV3=1;}}catch(_){}
  try{S.settings=S.settings||{};if(!S.settings.proactiveIdlePerRoleV1){const legacy=Math.max(0,Math.min(1440,Number(S.settings.proactiveIdleMin)||0));(S.contacts||[]).forEach(c=>{if(!c)return;c.proactive=c.proactive||{enabled:false,start:9,end:23,times:2};if(c.proactive.idleMin==null)c.proactive.idleMin=legacy;});S.settings.proactiveIdlePerRoleV1=1;}}catch(_){}
  try{S.settings=S.settings||{};if(!S.settings.roleAutonomyV1){delete S.settings.humanLike;delete S.settings.currentActivity;if(S.settings.callProb!=null)S.settings.callProb=Math.max(0,Math.min(100,+S.settings.callProb||0));if(S.couple)delete S.couple.extremeLove;(S.contacts||[]).forEach(c=>{if(!c)return;delete c.traits;delete c.power;delete c.affection;delete c.affectionLocked;delete c.mood;delete c.moodVal;delete c.moodAt;delete c.coldUntil;delete c.emotionTailUntil;delete c.emotionTailReason;delete c._dialogueEmotion;delete c.suspicion;delete c._currentActivity;delete c._esc;});S.settings.roleAutonomyV1=1;}}catch(_){}
  try{repairRunawaySummaries();}catch(_){}
  // 把旧的默认绘图模型切到更适合日常照片的新默认；如果用户自己填了别的名字，就尊重原设置
  try{if(S.settings&&!S.settings.imgModelV3){if(!S.settings.imgModel||S.settings.imgModel==='gpt-4o-image')S.settings.imgModel='gpt-image-2';S.settings.imgModelV3=1;}}catch(_){}}
normalizeLoadedState();
function mergeStateData(d,opt){const n=Object.assign(defState(),d||{});if(opt&&opt.keepPhoneFriend){const old=S&&S.me&&S.me.phoneFriend,has=d&&d.me&&d.me.phoneFriend&&d.me.phoneFriend.id;if(old&&!has){n.me=n.me||{};n.me.phoneFriend=old;}if(n.messages&&n.messages.__idb==='messages'&&S.messages&&!S.messages.__idb)n.messages=S.messages;}return n;}
function load(){if(NORTH_PREVIEW){const s=previewSeed(NORTH_PREVIEW_PARAMS);if(String(NORTH_PREVIEW_PARAMS).includes('restrictedapps')){s.couple=s.couple||{};s.couple.locks={moments:{preview:true},douyin:{preview:true},music:{preview:true},cinema:{preview:true},browser:{preview:true},games:{preview:true}};}return s;}let raw=null;try{raw=localStorage.getItem(KEY);if(!raw){if(NORTH_ANDROID)_androidOrphanCoreProbe=true;return seed();}const v=JSON.parse(raw);if(v&&v.settings){if(v.__coreIdb){_coreBootRef=v.__coreIdb;_coreOverflowMode=true;}return mergeStateData(v);}}catch(e){}if(raw){_coreBootRef={ver:1,savedAt:0,recovery:true};_coreOverflowMode=true;return mergeStateData(coreBootShell(0));}if(NORTH_ANDROID)_androidOrphanCoreProbe=true;return seed();}
let _bootImagesPromise=null;
let _saveTimer=null,_saveIdleHandle=0,_savePending=false,_saveLast=0,_saveOkLast=0;
const PRIVATE_NATIVE_SAVE_GAP_MS=15000;
const WECHAT_TAIL_KEY='yibei_wechat_tail_v1';
//@@ web
const TASK_DAILY_JOURNAL_KEY='yibei_task_daily_v1';
const SOCIAL_DAILY_JOURNAL_KEY='yibei_social_daily_v1';
let _socialDailyJournalStamp='';
//@@ end
function isQuotaError(e){const n=(e&&e.name||'')+' '+(e&&e.message||'');return /quota|storage|exceeded|full/i.test(n);}
function storedTextBytes(v){v=String(v||'');try{return new Blob([v]).size;}catch(_){try{return unescape(encodeURIComponent(v)).length;}catch(__){return v.length*2;}}}
function recoveryStateStats(d){d=d&&typeof d==='object'?d:{};const accounts=Math.max(1,Array.isArray(d.me&&d.me.accounts)?d.me.accounts.length:0),contacts=Array.isArray(d.contacts)?d.contacts.filter(c=>c&&!c.deleted).length:0,moments=Array.isArray(d.moments)?d.moments.length:0,groups=Array.isArray(d.groups)?d.groups.length:0;let messages=0,memories=0;const ms=d.messages&&typeof d.messages==='object'?d.messages:{};Object.keys(ms).forEach(k=>{if(Array.isArray(ms[k]))messages+=ms[k].length;});(d.contacts||[]).forEach(c=>{if(!c)return;messages+=Array.isArray(c.mail)?c.mail.length:0;memories+=(Array.isArray(c.memory)?c.memory.length:0)+(Array.isArray(c.summaries)?c.summaries.length:0);Object.values(c._accountMemory||{}).forEach(x=>{memories+=Array.isArray(x)?x.length:0;});Object.values(c._accountSummaries||{}).forEach(x=>{memories+=Array.isArray(x)?x.length:0;});(Array.isArray(c.aiMemoryImports)?c.aiMemoryImports:[]).forEach(x=>{memories+=Array.isArray(x&&x.chunks)?x.chunks.length:0;});});const pf=d.me&&d.me.phoneFriend||{};[pf.messages,pf.groupMessages].forEach(store=>{if(!store||typeof store!=='object')return;Object.keys(store).forEach(k=>{if(Array.isArray(store[k]))messages+=store[k].length;});});const score=accounts*40+contacts*140+messages*3+memories*12+moments*5+groups*20;return {accounts,contacts,messages,memories,moments,groups,score};}
function recoveryStateMeaningful(st){return !!(st&&(st.accounts>1||st.contacts||st.messages||st.memories||st.moments||st.groups));}
//@@ web
function queueRecoverySnapshot(json,savedAt,force){savedAt=+savedAt||Date.now();if(!force&&_recoverySnapshotAt&&savedAt-_recoverySnapshotAt<300000)return _recoverySnapshotWrite;let data;try{data=JSON.parse(json);}catch(_){return Promise.resolve(false);}const stats=recoveryStateStats(data);if(!recoveryStateMeaningful(stats))return Promise.resolve(false);_recoverySnapshotAt=savedAt;_recoverySnapshotWrite=_recoverySnapshotWrite.then(async()=>{const old=await imgGet(RECOVERY_IDB_KEY),oldSavedAt=+(old&&old.savedAt)||0,oldStats=old&&old.stats||null;if(old&&old.json&&oldSavedAt>savedAt)return false;if(old&&old.json&&oldStats&&recoveryStateMeaningful(oldStats)&&(+oldStats.score||0)>(+stats.score||0)){const history=await imgGet(RECOVERY_HISTORY_IDB_KEY),historyStats=history&&history.stats||null;if(!history||!history.json||!recoveryStateMeaningful(historyStats)||(+oldStats.score||0)>(+historyStats.score||0)||oldSavedAt>(+history.savedAt||0))await imgPut(RECOVERY_HISTORY_IDB_KEY,old);}await imgPut(RECOVERY_IDB_KEY,{ver:1,savedAt,json,stats});return true;}).catch(()=>false);return _recoverySnapshotWrite;}
//@@ private
function queueRecoverySnapshot(json,savedAt){savedAt=+savedAt||Date.now();if(_recoverySnapshotAt&&savedAt-_recoverySnapshotAt<300000)return _recoverySnapshotWrite;let data;try{data=JSON.parse(json);}catch(_){return Promise.resolve(false);}const stats=recoveryStateStats(data);if(!recoveryStateMeaningful(stats))return Promise.resolve(false);_recoverySnapshotAt=savedAt;_recoverySnapshotWrite=_recoverySnapshotWrite.then(async()=>{const old=await imgGet(RECOVERY_IDB_KEY),oldSavedAt=+(old&&old.savedAt)||0,oldStats=old&&old.stats||null;if(old&&old.json&&oldSavedAt>savedAt)return false;if(old&&old.json&&oldStats&&recoveryStateMeaningful(oldStats)&&(+oldStats.score||0)>(+stats.score||0)){const history=await imgGet(RECOVERY_HISTORY_IDB_KEY),historyStats=history&&history.stats||null;if(!history||!history.json||!recoveryStateMeaningful(historyStats)||(+oldStats.score||0)>(+historyStats.score||0)||oldSavedAt>(+history.savedAt||0))await imgPut(RECOVERY_HISTORY_IDB_KEY,old);}await imgPut(RECOVERY_IDB_KEY,{ver:1,savedAt,json,stats});return true;}).catch(()=>false);return _recoverySnapshotWrite;}
//@@ end
function coreBootShell(savedAt){const d=defState();return {settings:d.settings,me:d.me,__coreIdb:{ver:1,savedAt:+savedAt||Date.now()},_fresh:false};}
function writeCoreBootShell(savedAt){localStorage.setItem(KEY,JSON.stringify(coreBootShell(savedAt)));_coreBootRef={ver:1,savedAt:+savedAt||Date.now()};}
function queueCoreMirror(json,savedAt,activateOverflow){_coreQueuedSave={json,savedAt,activateOverflow:!!activateOverflow};_coreLogicalBytes=storedTextBytes(json);if(_coreSavePending)return _coreMirrorWrite;_coreSavePending=true;
  _coreMirrorWrite=(async()=>{let ok=true;while(_coreQueuedSave){const job=_coreQueuedSave;_coreQueuedSave=null;try{await imgPut(CORE_IDB_KEY,{ver:1,savedAt:job.savedAt,json:job.json});queueRecoverySnapshot(job.json,job.savedAt);if(job.activateOverflow||_coreOverflowMode){_coreOverflowMode=true;writeCoreBootShell(job.savedAt);}_saveOkLast=Date.now();_coreFailureAt=0;ok=true;}catch(e){ok=false;storageSaveFailure(e,true);}}_coreSavePending=false;return ok;})();return _coreMirrorWrite;}
function cancelScheduledSave(){if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}if(_saveIdleHandle&&typeof cancelIdleCallback==='function')try{cancelIdleCallback(_saveIdleHandle);}catch(_){}_saveIdleHandle=0;}
function saveNow(){try{const _a=(S.me&&S.me.accounts||[]).find(x=>x.id===(S.me&&S.me.active||'main'));if(_a){if(S.me.balance!=null)_a.balance=S.me.balance;if(S.me.bills)_a.bills=S.me.bills;}}catch(_){}
  cancelScheduledSave();_savePending=false;
//@@ web
  if((_coreBootRef||(typeof _androidOrphanCoreProbe!=='undefined'&&_androidOrphanCoreProbe))&&!_appBootFinished)return true;
//@@ private
  if(_coreBootRef&&!_appBootFinished)return true;
//@@ end
  const savedAt=Date.now();musicManifestQueueSave(savedAt);let json;try{S._persistedAt=savedAt;json=northNativeTimedJSON(S,_imgReplacer,'core-save');}catch(e){storageSaveFailure(e,false);return false;}
  const bytes=storedTextBytes(json),nativeCore=privateNativeCoreStorageKey(CORE_IDB_KEY),overflow=nativeCore||_coreOverflowMode||bytes>CORE_INLINE_LIMIT;_coreLogicalBytes=bytes;_saveLast=savedAt;
  if(overflow){_coreOverflowMode=true;queueCoreMirror(json,savedAt,true);if(typeof privatePhoneCloudMarkDirty==='function')privatePhoneCloudMarkDirty(savedAt);return true;}
  try{localStorage.setItem(KEY,json);queueRecoverySnapshot(json,savedAt);_saveOkLast=savedAt;if(typeof privatePhoneCloudMarkDirty==='function')privatePhoneCloudMarkDirty(savedAt);return true;}catch(e){if(isQuotaError(e)){_coreOverflowMode=true;queueCoreMirror(json,savedAt,true);if(typeof privatePhoneCloudMarkDirty==='function')privatePhoneCloudMarkDirty(savedAt);if(Date.now()-_coreFailureAt>60000){_coreFailureAt=Date.now();toast('核心存档偏大，正在自动迁入大容量存储');}return true;}storageSaveFailure(e,false);return false;}}
function saveNowAsync(){const ok=saveNow();return _coreOverflowMode?_coreMirrorWrite.then(Boolean):Promise.resolve(ok);}
//@@ web
function save(delay){if(NORTH_PREVIEW)return true;socialDailyJournalWrite();_savePending=true;cancelScheduledSave();const requested=delay==null?350:Math.max(0,delay),native=privateNativeAppOn(),gap=native&&requested>0&&_saveLast?Math.max(0,PRIVATE_NATIVE_SAVE_GAP_MS-(Date.now()-_saveLast)):0,d=native&&requested>0?Math.max(700,requested,gap):requested,idle=(native||NORTH_ANDROID)&&d>0&&typeof requestIdleCallback==='function';if(!idle){_saveTimer=setTimeout(saveNow,d);return;}_saveTimer=setTimeout(()=>{_saveTimer=null;_saveIdleHandle=requestIdleCallback(()=>{_saveIdleHandle=0;if(_savePending)saveNow();},{timeout:2600});},d);}
//@@ private
function save(delay){if(NORTH_PREVIEW)return true;_savePending=true;cancelScheduledSave();const requested=delay==null?350:Math.max(0,delay),native=privateNativeAppOn(),gap=native&&requested>0&&_saveLast?Math.max(0,PRIVATE_NATIVE_SAVE_GAP_MS-(Date.now()-_saveLast)):0,d=native&&requested>0?Math.max(700,requested,gap):requested,idle=native&&d>0&&typeof requestIdleCallback==='function';if(!idle){_saveTimer=setTimeout(saveNow,d);return;}_saveTimer=setTimeout(()=>{_saveTimer=null;_saveIdleHandle=requestIdleCallback(()=>{_saveIdleHandle=0;if(_savePending)saveNow();},{timeout:2600});},d);}
//@@ end
/* ===== 图片转存 IndexedDB（把大图从 localStorage 这个~5MB小盒子挪进大空间；内存里的 S 始终是完整图，渲染层一律不变）===== */
//@@ web
let _imgCache={},_imgRev=new Map(),_imgReady=new Set(),_imgSeq=0,_heavy={},_heavyStamp={},_heavyReady=new Set(),_messageArchiveWrite=Promise.resolve(),_imageReferenceCompactTimer=0,_imgGCWrite=Promise.resolve();
//@@ private
let _imgCache={},_imgRev=new Map(),_imgReady=new Set(),_imgSeq=0,_heavy={},_heavyStamp={},_heavyReady=new Set(),_messageArchiveWrite=Promise.resolve(),_imageReferenceCompactTimer=0,_imgGCWrite=Promise.resolve(),_recoveryInlineSave=false;
//@@ end
const PRIVATE_IMAGE_CACHE_CHAR_LIMIT=48*1024*1024,IOS_WEB_IMAGE_CACHE_CHAR_LIMIT=24*1024*1024;
const IMG_DB_VERSION=2;
//@@ web
function imgDB(){return new Promise((res,rej)=>{let settled=false,r=null,timer=0;const fail=err=>{if(settled)return;settled=true;clearTimeout(timer);const e=err||r&&r.error||new Error('IndexedDB unavailable');_idbOpenFailure=String(e&&e.message||e||'IndexedDB unavailable').slice(0,160);rej(e);};try{r=indexedDB.open('yibeiImg',IMG_DB_VERSION);}catch(e){fail(e);return;}timer=setTimeout(()=>fail(new Error('IndexedDB open timeout')),7000);r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains('img'))db.createObjectStore('img');};r.onsuccess=e=>{if(settled){try{e.target.result.close();}catch(_){}return;}settled=true;clearTimeout(timer);_idbOpenFailure='';const db=e.target.result;db.onversionchange=()=>{try{db.close();}catch(_){}};res(db);};r.onerror=()=>fail(r.error||new Error('IndexedDB open failed'));r.onblocked=()=>fail(new Error('IndexedDB open blocked'));});}
//@@ private
function imgDB(){return new Promise((res,rej)=>{let settled=false;const r=indexedDB.open('yibeiImg',IMG_DB_VERSION),fail=()=>{if(settled)return;settled=true;rej(r.error||new Error('IndexedDB unavailable'));};r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains('img'))db.createObjectStore('img');};r.onsuccess=e=>{if(settled){try{e.target.result.close();}catch(_){}return;}settled=true;const db=e.target.result;db.onversionchange=()=>{try{db.close();}catch(_){}};res(db);};r.onerror=fail;r.onblocked=fail;});}
//@@ end
function privateNativeCoreStorageKey(k){return (k===CORE_IDB_KEY||k===RECOVERY_IDB_KEY||k===RECOVERY_HISTORY_IDB_KEY)&&typeof window!=='undefined'&&window.__SMALL_PHONE_PRIVATE__===true&&window.SmallPhoneNative&&typeof window.SmallPhoneNative.request==='function';}
async function privateNativeCorePut(k,v){v=v&&typeof v==='object'?v:{};const args={key:k,ver:+v.ver||1,savedAt:+v.savedAt||Date.now(),stateJSON:String(v.json||'')};if(v.stats&&typeof v.stats==='object')args.stats=v.stats;let last;for(let attempt=0;attempt<3;attempt++){try{const r=await window.SmallPhoneNative.request('storage.put',args);if(!r||r.saved!==true)throw new Error('Native storage write failed');return;}catch(e){last=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)));}}throw last||new Error('Native storage write failed after retry');}
//@@ web
async function privateNativeCoreGet(k){const r=await window.SmallPhoneNative.request('storage.get',{key:k});if(!r||!r.found)return null;let stateJSON=typeof r.stateJSON==='string'?r.stateJSON:'';if(r.chunked===true){const token=String(r.transferToken||''),total=Math.max(0,+r.totalBytes||0),decoder=new TextDecoder('utf-8'),parts=[];let offset=0,turns=0;try{if(!token||!total)throw new Error('Native storage transfer metadata missing');while(offset<total&&turns++<4096){const row=await window.SmallPhoneNative.request('storage.get.chunk',{key:k,transferToken:token,offset}),b64=String(row&&row.chunkBase64||''),next=+((row&&row.nextOffset)||0);if(!b64||next<=offset||next>total)throw new Error('Native storage chunk invalid');const raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);parts.push(decoder.decode(bytes,{stream:row.done!==true}));offset=next;if(row.done===true)break;}if(offset!==total)throw new Error('Native storage transfer incomplete');stateJSON=parts.join('');}catch(e){window.SmallPhoneNative.request('storage.get.release',{key:k,transferToken:token}).catch(()=>{});throw e;}}if(stateJSON){const v={ver:+r.ver||1,savedAt:+r.savedAt||0,json:stateJSON};if(r.stats&&typeof r.stats==='object')v.stats=r.stats;return v;}return r.value||null;}
//@@ private
async function privateNativeCoreGet(k,opt){opt=opt||{};const r=await window.SmallPhoneNative.request('storage.get',{key:k,backup:opt.backup===true,primaryOnly:opt.primaryOnly===true});if(!r||!r.found)return null;if(opt.backup===true&&r.backup!==true)throw new Error('Native storage bridge does not support backup-only reads');if(opt.primaryOnly===true&&r.primaryOnly!==true)throw new Error('Native storage bridge does not support primary-only reads');let stateJSON=typeof r.stateJSON==='string'?r.stateJSON:'';if(r.chunked===true){const token=String(r.transferToken||''),total=Math.max(0,+r.totalBytes||0),decoder=new TextDecoder('utf-8'),parts=[];let offset=0,turns=0;try{if(!token||!total)throw new Error('Native storage transfer metadata missing');while(offset<total&&turns++<4096){const row=await window.SmallPhoneNative.request('storage.get.chunk',{key:k,transferToken:token,offset}),b64=String(row&&row.chunkBase64||''),next=+((row&&row.nextOffset)||0);if(!b64||next<=offset||next>total)throw new Error('Native storage chunk invalid');const raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);parts.push(decoder.decode(bytes,{stream:row.done!==true}));offset=next;if(row.done===true)break;}if(offset!==total)throw new Error('Native storage transfer incomplete');stateJSON=parts.join('');}catch(e){window.SmallPhoneNative.request('storage.get.release',{key:k,transferToken:token}).catch(()=>{});throw e;}}if(stateJSON){const v={ver:+r.ver||1,savedAt:+r.savedAt||0,json:stateJSON};if(r.stats&&typeof r.stats==='object')v.stats=r.stats;return v;}return r.value||null;}
//@@ end
function privateNativeCoreDelete(k){return window.SmallPhoneNative.request('storage.delete',{key:k}).then(()=>{});}
function imgPutIDB(k,v){return imgDB().then(db=>new Promise((res,rej)=>{let tx;try{tx=db.transaction('img','readwrite');tx.objectStore('img').put(v,k);}catch(e){try{db.close();}catch(_){}rej(e);return;}const done=(ok,e)=>{try{db.close();}catch(_){}ok?res():rej((e&&e.target&&e.target.error)||tx.error||new Error('IndexedDB write failed'));};tx.oncomplete=()=>done(true);tx.onerror=e=>done(false,e);tx.onabort=e=>done(false,e);}));}
async function imgPutIDBWithRetry(k,v){if(String(k).indexOf('__audio_')===0)_audioPutAt.set(String(k),Date.now());let last;for(let attempt=0;attempt<3;attempt++){try{await imgPutIDB(k,v);return;}catch(e){last=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,180*(attempt+1)));}}throw last||new Error('IndexedDB write failed after retry');}
const _audioPutAt=new Map();
function imgPut(k,v){if(privateNativeCoreStorageKey(k))return privateNativeCorePut(k,v).catch(()=>imgPutIDBWithRetry(k,v));return imgPutIDBWithRetry(k,v);}
//@@ web
function imgGetIDBOnce(k){return imgDB().then(db=>new Promise(res=>{let value=null,tx;try{tx=db.transaction('img','readonly');const q=tx.objectStore('img').get(k);q.onsuccess=()=>{value=q.result;};q.onerror=()=>{};}catch(_){try{db.close();}catch(__){}res(null);return;}const done=()=>{try{db.close();}catch(_){}res(value);};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>null);}
async function imgGetIDB(k){_idbOpenFailure='';let value=await imgGetIDBOnce(k);if(value!=null||!_idbOpenFailure)return value;await new Promise(resolve=>setTimeout(resolve,240));_idbOpenFailure='';value=await imgGetIDBOnce(k);return value;}
//@@ private
function imgGetIDB(k){return imgDB().then(db=>new Promise(res=>{let value=null,tx;try{tx=db.transaction('img','readonly');const q=tx.objectStore('img').get(k);q.onsuccess=()=>{value=q.result;};q.onerror=()=>{};}catch(_){try{db.close();}catch(__){}res(null);return;}const done=()=>{try{db.close();}catch(_){}res(value);};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>null);}
//@@ end
function newestStoredCore(a,b){if(!a)return b||null;if(!b)return a;return (+b.savedAt||0)>(+a.savedAt||0)?b:a;}
function imgGet(k){if(privateNativeCoreStorageKey(k))return Promise.all([privateNativeCoreGet(k).catch(()=>null),imgGetIDB(k)]).then(rows=>newestStoredCore(rows[0],rows[1]));return imgGetIDB(k);}
function imgAll(){return imgDB().then(db=>new Promise(res=>{const out={};let tx;try{tx=db.transaction('img','readonly');const cur=tx.objectStore('img').openCursor();cur.onsuccess=e=>{const c=e.target.result;if(c){if(String(c.key).indexOf('__')!==0)out[c.key]=c.value;c.continue();}};cur.onerror=()=>{};}catch(_){try{db.close();}catch(__){}res(out);return;}const done=()=>{try{db.close();}catch(_){}res(out);};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>({}));}
function imgKeys(){return imgDB().then(db=>new Promise(res=>{const out=[];let tx;try{tx=db.transaction('img','readonly');const cur=tx.objectStore('img').openKeyCursor();cur.onsuccess=e=>{const c=e.target.result;if(c){out.push(String(c.key));c.continue();}};cur.onerror=()=>{};}catch(_){try{db.close();}catch(__){}res(out);return;}const done=()=>{try{db.close();}catch(_){}res(out);};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>[]);}
function imageRefKeys(root){const keys=new Set(),seen=typeof WeakSet!=='undefined'?new WeakSet():null;(function walk(o){if(!o||typeof o!=='object')return;if(seen){if(seen.has(o))return;seen.add(o);}for(const k in o){const v=o[k];if(typeof v==='string'&&v.indexOf('idb:')===0)keys.add(v.slice(4));else if(v&&typeof v==='object')walk(v);}})(root);return [...keys].filter(Boolean);}
function privateTrimImageMemoryCache(extraKeys){if(!lazyStoredImagesOn())return 0;const rows=Object.entries(_imgCache||{}),sizeOf=v=>typeof v==='string'?v.length:0,limit=NORTH_IOS_WEBKIT&&!privateNativeAppOn()?IOS_WEB_IMAGE_CACHE_CHAR_LIMIT:NORTH_ANDROID&&!privateNativeAppOn()?24*1024*1024:PRIVATE_IMAGE_CACHE_CHAR_LIMIT;let total=rows.reduce((n,x)=>n+sizeOf(x[1]),0);if(total<=limit)return 0;const keep=new Set([...(extraKeys||[]),...privateBootImageKeys(),...(typeof routeCriticalStoredImageKeys==='function'?routeCriticalStoredImageKeys():[]),...(typeof visibleStoredImageKeys==='function'?visibleStoredImageKeys():[])]);let removed=0;for(const [key,value] of rows){if(total<=limit)break;if(keep.has(key)||String(key).indexOf('__')===0)continue;delete _imgCache[key];if(value)_imgRev.delete(value);total-=sizeOf(value);removed++;}return removed;}
function imgManyChunk(keys){return imgDB().then(db=>new Promise(res=>{const out={};let tx;try{tx=db.transaction('img','readonly');const store=tx.objectStore('img');keys.forEach(k=>{const q=store.get(k);q.onsuccess=()=>{if(q.result!=null)out[k]=q.result;};q.onerror=()=>{};});}catch(_){try{db.close();}catch(__){}res(out);return;}const done=()=>{try{db.close();}catch(_){}res(out);};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>({}));}
async function imgMany(keys){keys=[...new Set((keys||[]).filter(Boolean))];const out={};for(let i=0;i<keys.length;i+=48){const part=keys.slice(i,i+48),found=await imgManyChunk(part);Object.assign(out,found);const missing=part.filter(k=>out[k]==null);for(let j=0;j<missing.length;j+=12)Object.assign(out,await imgManyChunk(missing.slice(j,j+12)));}return out;}
function imgDelIDB(k){return imgDB().then(db=>new Promise(res=>{let tx;try{tx=db.transaction('img','readwrite');tx.objectStore('img').delete(k);}catch(_){try{db.close();}catch(__){}res();return;}const done=()=>{try{db.close();}catch(_){}res();};tx.oncomplete=done;tx.onerror=done;tx.onabort=done;})).catch(()=>{});}
function imgDel(k){if(privateNativeCoreStorageKey(k))return privateNativeCoreDelete(k).catch(()=>{}).then(()=>imgDelIDB(k));return imgDelIDB(k);}
function isBigImg(v){return typeof v==='string'&&v.length>2000&&v.indexOf('data:image')===0;}
async function primeImageForSave(v){if(!isBigImg(v))return;let key=_imgRev.get(v);if(!key){key='i'+(_imgSeq++)+Date.now().toString(36);_imgRev.set(v,key);_imgCache[key]=v;}await imgPut(key,v);_imgReady.add(key);}
//@@ web
function stateBigImages(root){const rows=[],images=new Set(),seen=typeof WeakSet!=='undefined'?new WeakSet():null;(function walk(value){if(!value||typeof value!=='object')return;if(seen){if(seen.has(value))return;seen.add(value);}for(const key in value){const item=value[key];if(isBigImg(item)){if(!images.has(item)){images.add(item);rows.push(item);}}else if(item&&typeof item==='object')walk(item);}})(root);return rows;}
async function primeStateImagesForSave(root){const rows=stateBigImages(root);for(let i=0;i<rows.length;i+=2){await Promise.all(rows.slice(i,i+2).map(primeImageForSave));if(i+2<rows.length)await new Promise(resolve=>setTimeout(resolve,0));}return rows.length;}
function compactReadyStateImages(root){let changed=0;const seen=typeof WeakSet!=='undefined'?new WeakSet():null;(function walk(value){if(!value||typeof value!=='object')return;if(seen){if(seen.has(value))return;seen.add(value);}for(const key in value){const item=value[key];if(isBigImg(item)){const imageKey=_imgRev.get(item);if(imageKey&&_imgReady.has(imageKey)){value[key]='idb:'+imageKey;changed++;}}else if(item&&typeof item==='object')walk(item);}})(root);return changed;}
//@@ end
function imageReferenceCompactSoon(){if(_imageReferenceCompactTimer||NORTH_PREVIEW)return;_imageReferenceCompactTimer=setTimeout(()=>{_imageReferenceCompactTimer=0;if(_appBootFinished)save(0);},240);}
// 存档时：已确认写进 IndexedDB 的大图→换成短引用 idb:key；新图先照旧存、并异步写进库，下次保存才精简（确保绝不丢图）
function pfMsgStoreKey(){try{return '__pf_messages_'+((S&&S.me&&S.me.phoneFriend&&S.me.phoneFriend.id)||'main');}catch(_){return '__pf_messages_main';}}
function pfGroupMsgStoreKey(){try{return '__pf_group_messages_'+((S&&S.me&&S.me.phoneFriend&&S.me.phoneFriend.id)||'main');}catch(_){return '__pf_group_messages_main';}}
function messageArchiveStamp(store){if(!store||typeof store!=='object')return'0:0:0';const keys=Object.keys(store).filter(k=>Array.isArray(store[k])).sort();let count=0,hash=2166136261>>>0;const mix=value=>{const s=String(value==null?'':value);for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}},row=m=>{if(!m||typeof m!=='object'){mix('null');return;}const body=String(m.content!=null?m.content:m.text!=null?m.text:m.body!=null?m.body:''),media=String(m.audio||m.img||m.src||'');mix(m.id);mix(m.time||m.ts||m.created_at);mix(m.role);mix(m.type);mix(body.length);mix(body.slice(0,18));mix(body.slice(-18));mix(media.length);mix(media.slice(-18));mix(m.recalled);mix(m.received);mix(m.receivedBy);mix(m.declined);mix(m.refunded);mix(m.payState);mix(m.receivedAt);mix(m.refundedAt);mix(m._transferReceipt);mix(m.receiptOf);mix(m.receiptAction);mix(m._walletSettled);mix(m._walletRefunded);mix(m.read);mix(m.seenAt);mix(m.readAt);mix(m.liked);mix(m.visionState);mix(m._roleReplyStatus);};for(const key of keys){const rows=store[key],n=rows.length;mix(key);mix(n);count+=n;if(n)row(rows[0]);if(n>2)row(rows[n-2]);if(n>1)row(rows[n-1]);}return keys.length+':'+count+':'+hash;}
//@@ web
function writeMessageArchive(blob,stamp){if((typeof _msgArchiveLost!=='undefined'&&_msgArchiveLost))return Promise.resolve();blob=String(blob||'{}');_heavy.messages=blob;_heavyReady.delete('messages');_messageArchiveWrite=_messageArchiveWrite.catch(()=>{}).then(()=>imgPut('__messages',blob)).then(()=>{if(_heavy.messages===blob){_heavyStamp.messages=stamp||messageArchiveStamp(S.messages);_heavyReady.add('messages');delete _heavy.messages;}});return _messageArchiveWrite;}
function writeHeavyMessageArchive(rk,key,blob,stamp){_heavy[rk]=blob;_heavyReady.delete(rk);return imgPut(key,blob).then(()=>{if(_heavy[rk]===blob){_heavyStamp[rk]=stamp;_heavyReady.add(rk);delete _heavy[rk];save(0);}}).catch(()=>{});}
//@@ private
function writeMessageArchive(blob,stamp){if((typeof _msgArchiveLost!=='undefined'&&_msgArchiveLost))return Promise.resolve();blob=String(blob||'{}');_heavy.messages=blob;_heavyReady.delete('messages');_messageArchiveWrite=_messageArchiveWrite.catch(()=>{}).then(()=>imgPut('__messages',blob)).then(()=>{if(_heavy.messages===blob){_heavyStamp.messages=stamp||messageArchiveStamp(S.messages);_heavyReady.add('messages');}});return _messageArchiveWrite;}
function writeHeavyMessageArchive(rk,key,blob,stamp){_heavy[rk]=blob;_heavyReady.delete(rk);imgPut(key,blob).then(()=>{if(_heavy[rk]===blob){_heavyStamp[rk]=stamp;_heavyReady.add(rk);save(0);}}).catch(()=>{});}
//@@ end
/* MSG_ARCHIVE_NO_WIPE_V1（2026-10-18 事故：私人 App 打开时长聊天库 __messages 读了 3 分钟没读出来，
   以前把「读不到」当成「没有聊天」，角色 22:00 发来新消息一保存，看聊天只剩几条，就把整个长聊天库删了，
   16:30 之后的聊天全没了）。现在：存档里写着聊天在长库里、却读不出来时，记下「长库暂时读不到」，
   这期间不删、不覆盖长库，存档里继续留着「去长库找」的记号，新消息照常存进存档；后台每 20 秒再读一次，读到了就合并回来。 */
let _msgArchiveLost=false,_msgArchiveRetryTimer=0,_msgArchiveRetries=0;
async function msgArchiveBootRead(){for(let i=0;i<3;i++){const b=await imgGetIDB('__messages');if(b)return b;await new Promise(r=>setTimeout(r,1200));}return null;}
function msgArchiveMarkLost(){_msgArchiveLost=true;delete _heavy.messages;delete _heavyStamp.messages;_heavyReady.delete('messages');if(typeof toast==='function')try{toast('聊天记录库这次没读出来，已保护不删，正在自动重试');}catch(_){}msgArchiveRetryLater();}
function msgArchiveRetryLater(){if(_msgArchiveRetryTimer||!_msgArchiveLost||_msgArchiveRetries>=30)return;_msgArchiveRetryTimer=setTimeout(async()=>{_msgArchiveRetryTimer=0;_msgArchiveRetries++;let b=null;try{b=await imgGetIDB('__messages');}catch(_){b=null;}
  if(b&&_msgArchiveLost){try{const restored=JSON.parse(b);if(restored&&typeof restored==='object'){const live={};for(const k of Object.keys(S.messages||{}))if(Array.isArray(S.messages[k]))live[k]=S.messages[k];S.messages=mergeBootMessages(restored,live);_msgArchiveLost=false;save(0);try{if(typeof render==='function')render();}catch(_){}return;}}catch(_){}}
  msgArchiveRetryLater();},20000);}
function deleteMessageArchive(){if((typeof _msgArchiveLost!=='undefined'&&_msgArchiveLost))return _messageArchiveWrite;delete _heavy.messages;delete _heavyStamp.messages;_heavyReady.delete('messages');_messageArchiveWrite=_messageArchiveWrite.catch(()=>{}).then(()=>imgDel('__messages'));return _messageArchiveWrite;}
//@@ web
async function persistWechatMessagesNow(){let blob;try{blob=JSON.stringify(S.messages||{});}catch(_){blob='{}';}if(blob.length>20000)await writeMessageArchive(blob,messageArchiveStamp(S.messages));else await deleteMessageArchive();return saveNowAsync();}
async function primeImportedMessageStore(value,key,rk){let blob;try{blob=JSON.stringify(value||{});}catch(e){throw new Error('导入的聊天记录无法安全整理：'+String(e&&e.message||e));}if(blob.length<=20000){delete _heavy[rk];delete _heavyStamp[rk];_heavyReady.delete(rk);await imgDel(key);return false;}const stamp=messageArchiveStamp(value);_heavy[rk]=blob;_heavyReady.delete(rk);await imgPut(key,blob);if(_heavy[rk]!==blob)throw new Error('导入期间聊天记录又发生了变化，请重试');_heavyStamp[rk]=stamp;_heavyReady.add(rk);delete _heavy[rk];return true;}
//@@ private
let _persistWechatRequested=0,_persistWechatCompleted=0,_persistWechatRunning=false,_persistWechatWaiters=[];
function persistWechatClock(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now();}
function persistWechatTrace(stage,fields){try{if(typeof window.__smallPhoneWechatPersistTrace==='function')window.__smallPhoneWechatPersistTrace(Object.assign({stage},fields||{}));}catch(_){}}
function persistWechatSettle(upto,value,error){const keep=[];for(const row of _persistWechatWaiters){if(row.target<=upto){if(error)row.reject(error);else row.resolve(value);}else keep.push(row);}_persistWechatWaiters=keep;}
function persistWechatDrain(){if(_persistWechatRunning)return;_persistWechatRunning=true;const started=persistWechatClock();let passes=0,coalesced=0,observed=_persistWechatCompleted,maxBlobChars=0,archiveMs=0,coreMs=0;persistWechatTrace('begin',{queued:Math.max(1,_persistWechatRequested-_persistWechatCompleted)});(async()=>{try{while(_persistWechatCompleted<_persistWechatRequested){const target=_persistWechatRequested;coalesced+=Math.max(0,target-observed-1);observed=target;passes++;let blob;try{blob=JSON.stringify(S.messages||{});}catch(_){blob='{}';}maxBlobChars=Math.max(maxBlobChars,blob.length);const stamp=messageArchiveStamp(S.messages),archiveStarted=persistWechatClock();if(blob.length>20000){if(!(_heavyReady.has('messages')&&_heavyStamp.messages===stamp&&_heavy.messages===blob))await writeMessageArchive(blob,stamp);}else await deleteMessageArchive();archiveMs+=Math.max(0,Math.round(persistWechatClock()-archiveStarted));if(target!==_persistWechatRequested)continue;const coreStarted=persistWechatClock(),saved=await saveNowAsync();coreMs+=Math.max(0,Math.round(persistWechatClock()-coreStarted));if(target!==_persistWechatRequested)continue;_persistWechatCompleted=target;persistWechatSettle(target,!!saved,null);}}catch(error){const failedThrough=_persistWechatRequested;_persistWechatCompleted=failedThrough;persistWechatSettle(failedThrough,false,error);persistWechatTrace('error',{passes,coalesced,blobChars:maxBlobChars,ms:Math.round(persistWechatClock()-started),error:String(error&&error.name||'Error')});}finally{_persistWechatRunning=false;persistWechatTrace('end',{passes,coalesced,blobChars:maxBlobChars,archiveMs,coreMs,ms:Math.round(persistWechatClock()-started)});if(_persistWechatCompleted<_persistWechatRequested)persistWechatDrain();}})();}
function persistWechatMessagesNow(){const target=++_persistWechatRequested,promise=new Promise((resolve,reject)=>_persistWechatWaiters.push({target,resolve,reject}));if(_persistWechatRunning)persistWechatTrace('coalesced',{queued:Math.max(1,_persistWechatRequested-_persistWechatCompleted)});else persistWechatDrain();return promise;}
async function primeImportedMessageStore(value,key,rk){let blob;try{blob=JSON.stringify(value||{});}catch(e){throw new Error('导入的聊天记录无法安全整理：'+String(e&&e.message||e));}if(blob.length<=20000){delete _heavy[rk];delete _heavyStamp[rk];_heavyReady.delete(rk);await imgDel(key);return false;}const stamp=messageArchiveStamp(value);_heavy[rk]=blob;_heavyReady.delete(rk);await imgPut(key,blob);if(_heavy[rk]!==blob)throw new Error('导入期间聊天记录又发生了变化，请重试');_heavyStamp[rk]=stamp;_heavyReady.add(rk);return true;}
//@@ end
async function compactImportedImages(root){
  const images=new Map(),seen=new WeakSet(),stack=[root];let scanned=0,count=0;
  while(stack.length){const value=stack.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
    for(const key of Object.keys(value)){const item=value[key];if(isBigImg(item)){let refs=images.get(item);if(!refs){refs=[];images.set(item,refs);}refs.push([value,key]);}else if(item&&typeof item==='object')stack.push(item);}
    if(++scanned%128===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  const lazy=lazyStoredImagesOn();
  for(const [image,refs] of images){const oldKey=_imgRev.get(image),cached=oldKey&&_imgCache[oldKey]===image;
    await primeImageForSave(image);const key=_imgRev.get(image);
    if(!key||!_imgReady.has(key))throw new Error('备份图片未能安全写入，请检查存储空间');
    for(const [parent,field] of refs)if(parent[field]===image)parent[field]='idb:'+key;
    images.delete(image);count++;
    // Only release newly imported cache entries; persisted image data and active-page caches stay intact.
    if(lazy&&!cached){delete _imgCache[key];_imgRev.delete(image);}
    if(count%2===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return count;
}
async function prepareImportedStateForSave(){await compactImportedImages(S);if(lazyStoredImagesOn())privateTrimImageMemoryCache();await primeImportedMessageStore(S.messages||{},'__messages','messages');const pf=S.me&&S.me.phoneFriend;if(pf){const messageKey=pfMsgStoreKey(),groupKey=pfGroupMsgStoreKey();await primeImportedMessageStore(pf.messages||{},messageKey,'pfMessages:'+messageKey);await primeImportedMessageStore(pf.groupMessages||{},groupKey,'pfGroupMessages:'+groupKey);}return true;}
function wechatTailSafeRow(m){if(!m||typeof m!=='object')return null;let x;try{x=JSON.parse(JSON.stringify(m));}catch(_){return null;}['audio','src','img'].forEach(k=>{const v=x[k];if(typeof v==='string'&&v.length>1800&&/^(?:data:|blob:)/i.test(v)){delete x[k];if(k==='audio')x._audioExpired=true;}});return x;}
function wechatTailJournalWrite(id,aid){try{const key=accountMessageKey(id,aid||actId()),arr=S.messages&&S.messages[key];if(!Array.isArray(arr)||!arr.length)return false;const rows=arr.slice(-18).map(wechatTailSafeRow).filter(Boolean);if(!rows.length)return false;const at=Math.max(Date.now(),(+S._persistedAt||0)+1);localStorage.setItem(WECHAT_TAIL_KEY,JSON.stringify({ver:1,at,key,rows}));return true;}catch(_){return false;}}
function wechatTailJournalMerge(){try{const raw=localStorage.getItem(WECHAT_TAIL_KEY);if(!raw)return false;const j=JSON.parse(raw),persisted=+S._persistedAt||0;if(!j||j.ver!==1||!j.key||!Array.isArray(j.rows)||(+j.at||0)<=persisted)return false;S.messages=S.messages&&typeof S.messages==='object'?S.messages:{};const dst=Array.isArray(S.messages[j.key])?S.messages[j.key]:(S.messages[j.key]=[]),seen=new Set(dst.map(m=>m&&m.id).filter(Boolean));let added=false;for(const m of j.rows){if(!m||!m.id||seen.has(m.id))continue;dst.push(m);seen.add(m.id);added=true;}if(added)dst.sort((a,b)=>(+a.time||0)-(+b.time||0));return added;}catch(_){return false;}}
//@@ web
function socialDailyDate(ts){try{const d=new Date(+ts||0);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}catch(_){return'';}}
function socialDailySafeRow(row){let x;try{x=JSON.parse(JSON.stringify(row));}catch(_){return null;}if(Array.isArray(x.images)){const total=x.images.length;x.images=x.images.filter(v=>typeof v==='string'&&!/^(?:data:|blob:)/i.test(v)).slice(0,4);if(total>x.images.length)x._journalImageCount=total;}return x;}
function socialDailyPayload(){const date=todayStr(),moments=(S.moments||[]).filter(p=>p&&p.id&&socialDailyDate(p.time)===date).slice(0,60),tweets=(S.x&&S.x.tweets||[]).filter(t=>t&&t.id&&t.who!=='net'&&socialDailyDate(t.time)===date).slice(0,60),stamp=[date,moments.map(p=>[p.id,p.time,p.text,p.regeneratedAt,(p.likes||[]).length,(p.comments||[]).length].join(':')).join('|'),tweets.map(t=>[t.id,t.time,t.text,t.regeneratedAt,(t.likes||[]).length,(t.comments||[]).length].join(':')).join('|')].join('~');return{date,stamp,moments:moments.map(socialDailySafeRow).filter(Boolean),tweets:tweets.map(socialDailySafeRow).filter(Boolean)};}
function socialDailyJournalWrite(){try{if((_coreBootRef||_androidOrphanCoreProbe)&&!_appBootFinished)return true;const p=socialDailyPayload();if(p.stamp===_socialDailyJournalStamp)return true;const at=Math.max(Date.now(),(+S._persistedAt||0)+1);localStorage.setItem(SOCIAL_DAILY_JOURNAL_KEY,JSON.stringify({ver:1,at,...p}));_socialDailyJournalStamp=p.stamp;return true;}catch(_){return false;}}
function socialDailyJournalMerge(){try{const raw=localStorage.getItem(SOCIAL_DAILY_JOURNAL_KEY),j=raw&&JSON.parse(raw),persisted=+S._persistedAt||0;if(!j||j.ver!==1||j.date!==todayStr()||(+j.at||0)<=persisted||!Array.isArray(j.moments)||!Array.isArray(j.tweets))return false;const day=j.date,oldMoments=Array.isArray(S.moments)?S.moments:[],oldTweets=S.x&&Array.isArray(S.x.tweets)?S.x.tweets:[],momentById=new Map(oldMoments.map(p=>[p&&p.id,p])),tweetById=new Map(oldTweets.map(t=>[t&&t.id,t])),hydrate=(row,old)=>{const x=JSON.parse(JSON.stringify(row));if(x._journalImageCount){if(old&&Array.isArray(old.images)&&old.images.length)x.images=old.images;delete x._journalImageCount;}return x;};S.moments=[...j.moments.map(p=>hydrate(p,momentById.get(p.id))),...oldMoments.filter(p=>!p||socialDailyDate(p.time)!==day)];S.x=S.x||{};S.x.tweets=[...j.tweets.map(t=>hydrate(t,tweetById.get(t.id))),...oldTweets.filter(t=>t&&t.who==='net'||!t||socialDailyDate(t.time)!==day)];_socialDailyJournalStamp=j.stamp||'';return true;}catch(_){return false;}}
//@@ end
function _imgReplacer(k,v){
//@@ web
  if(typeof _webRecoveryInlineSave!=='undefined'&&_webRecoveryInlineSave&&(k==='messages'||k==='groupMessages')&&v&&typeof v==='object')return v;
//@@ private
  const pf=S&&S.me&&S.me.phoneFriend;
  if(_recoveryInlineSave&&((k==='messages'&&v&&typeof v==='object'&&(v===S.messages||pf&&v===pf.messages))||(k==='groupMessages'&&pf&&v===pf.groupMessages)))return v;
//@@ end
  // 重量级文字(聊天记录)也搬进大空间：只有确认入库后才在存档里换成占位，绝不丢消息
  if((typeof _msgArchiveLost!=='undefined'&&_msgArchiveLost)&&k==='messages'&&v&&typeof v==='object'&&v===S.messages)return Object.assign({__idb:'messages'},v);
  if(k==='messages'&&v&&typeof v==='object'&&v===S.messages){const stamp=messageArchiveStamp(v);if(_heavyReady.has('messages')&&_heavyStamp.messages===stamp)return {__idb:'messages'};let blob;try{blob=JSON.stringify(v);}catch(_){blob=null;}
//@@ web
    if(blob&&blob.length>20000){if(_heavy.messages!==blob){writeMessageArchive(blob,stamp).then(()=>{if(_heavyReady.has('messages')&&_heavyStamp.messages===stamp)save(0);}).catch(()=>{});}
//@@ private
    if(blob&&blob.length>20000){if(_heavy.messages!==blob){writeMessageArchive(blob,stamp).then(()=>{if(_heavy.messages===blob)save(0);}).catch(()=>{});}
//@@ end
      if(_heavyReady.has('messages')&&_heavyStamp.messages===stamp)return {__idb:'messages'};}}
//@@ web
  const pf=S&&S.me&&S.me.phoneFriend;
//@@ end
  if(k==='messages'&&pf&&v&&typeof v==='object'&&v===pf.messages){const key=pfMsgStoreKey(),rk='pfMessages:'+key,stamp=messageArchiveStamp(v);if(_heavyReady.has(rk)&&_heavyStamp[rk]===stamp)return {__idb:'phoneFriendMessages',id:pf.id};let blob;try{blob=JSON.stringify(v);}catch(_){blob=null;}
    if(blob&&blob.length>20000){if(_heavy[rk]!==blob)writeHeavyMessageArchive(rk,key,blob,stamp);
      if(_heavyReady.has(rk)&&_heavyStamp[rk]===stamp)return {__idb:'phoneFriendMessages',id:pf.id};}}
  if(k==='groupMessages'&&pf&&v&&typeof v==='object'&&v===pf.groupMessages){const key=pfGroupMsgStoreKey(),rk='pfGroupMessages:'+key,stamp=messageArchiveStamp(v);if(_heavyReady.has(rk)&&_heavyStamp[rk]===stamp)return {__idb:'phoneFriendGroupMessages',id:pf.id};let blob;try{blob=JSON.stringify(v);}catch(_){blob=null;}
    if(blob&&blob.length>20000){if(_heavy[rk]!==blob)writeHeavyMessageArchive(rk,key,blob,stamp);
      if(_heavyReady.has(rk)&&_heavyStamp[rk]===stamp)return {__idb:'phoneFriendGroupMessages',id:pf.id};}}
  if(isBigImg(v)){let key=_imgRev.get(v);
    if(!key){key='i'+(_imgSeq++)+Date.now().toString(36);_imgRev.set(v,key);_imgCache[key]=v;imgPut(key,v).then(()=>{_imgReady.add(key);imageReferenceCompactSoon();}).catch(()=>{});}
    if(_imgReady.has(key))return 'idb:'+key;}
  return v;}
// 读档时：桌面网页仍完整回填；私人 App、安卓与 iOS 网页保留短引用并按当前页面懒加载，避免大存档启动时把历史照片全部复制进 JS 内存。
function _rehydrateWithCache(o,cache){if(!o||typeof o!=='object')return;for(const k in o){const v=o[k];
    if(typeof v==='string'){if(v.indexOf('idb:')===0)o[k]=(cache&&cache[v.slice(4)])||v;}
    else if(v&&typeof v==='object')_rehydrateWithCache(v,cache);}}
function _rehydrate(o){_rehydrateWithCache(o,_imgCache);}
function lazyStoredImagesOn(){return privateNativeAppOn()||NORTH_ANDROID||NORTH_IOS_WEBKIT;}
function privateBootImageKeys(){const me=S.me||{},critical={avatar:me.avatar,homeBg:me.homeBg,lockBg:me.lockBg,callBg:me.callBg,momentCover:me.momentCover,wPic:me.wPic,homeAvMe:me.homeAvMe,homeAvTa:me.homeAvTa,homeDashboard:me.homeDashboard,homeSweetie:me.homeSweetie,appIcons:me.appIcons,contacts:(S.contacts||[]).map(c=>c&&c.avatar),groups:(S.groups||[]).map(g=>g&&g.avatar)};return imageRefKeys(critical);}
function mergeBootMessages(restored,live){restored=restored&&typeof restored==='object'?restored:{};if(!live||typeof live!=='object')return restored;for(const k of Object.keys(live)){if(k==='__idb'||!Array.isArray(live[k])||!live[k].length)continue;const dst=Array.isArray(restored[k])?restored[k]:(restored[k]=[]),seen=new Set(dst.map(m=>m&&m.id).filter(Boolean));for(const m of live[k]){if(!m)continue;if(m.id&&seen.has(m.id))continue;dst.push(m);if(m.id)seen.add(m.id);}dst.sort((a,b)=>(+a.time||0)-(+b.time||0));}return restored;}
function repairWxLogoutEmoji(){let changed=false;try{for(const k in S.messages){const a=S.messages[k];if(!Array.isArray(a))continue;const next=a.filter(m=>!(m&&m.type==='sys'&&typeof m.content==='string'&&/(?:登录了你的微信|退出了你的微信登录)$/.test(m.content.replace(/^🔓\s+/,''))));if(next.length!==a.length){S.messages[k]=next;changed=true;}}}catch(_){}return changed;}
function repairStaleVisionStates(){let changed=false;try{for(const k in S.messages){const a=S.messages[k];if(!Array.isArray(a))continue;a.forEach(m=>{if(m&&m.type==='image'&&m.role==='user'&&m.visionState==='pending'&&!_visionTasks.has(m.id)){m.visionState='failed';m.visionError='上次图片理解被页面刷新中断';changed=true;}});}}catch(_){}return changed;}
function repairStaleGeneratedImageStates(){let changed=false;try{for(const k in S.messages){const a=S.messages[k];if(!Array.isArray(a))continue;a.forEach(m=>{if(m&&m.type==='image'&&m.role==='assistant'&&m.pending){m.pending=false;m.failed=true;m.errText='上次生图在完成写入前被页面关闭，请点图片位置重试';changed=true;}});}}catch(_){}return changed;}
//@@ web
async function bootOverflowCore(){
  const orphanProbe=!_coreBootRef&&_androidOrphanCoreProbe;
  if(!_coreBootRef&&!orphanProbe)return false;
  const needed=+(_coreBootRef&&_coreBootRef.savedAt||0),primary=await imgGet(CORE_IDB_KEY);
  if(orphanProbe&&typeof _idbOpenFailure!=='undefined'&&_idbOpenFailure){_androidOrphanCoreProbe=false;throw new Error('安卓浏览器的本机存储暂时无法打开（'+_idbOpenFailure+'）；已停止空白启动以保护原存档，请完全关闭浏览器后重开');}
  let rec=primary,restored=null,recovered=false;
  const parse=x=>{if(!x||!x.json)return null;try{const d=JSON.parse(x.json);return d&&d.settings?d:null;}catch(_){return null;}},meaningful=d=>d&&recoveryStateMeaningful(recoveryStateStats(d));
  restored=parse(rec);
  if(orphanProbe&&(!restored||!meaningful(restored))){
    const backup=await imgGet(RECOVERY_IDB_KEY);
    if(typeof _idbOpenFailure!=='undefined'&&_idbOpenFailure){_androidOrphanCoreProbe=false;throw new Error('安卓浏览器的恢复存档暂时无法打开（'+_idbOpenFailure+'）；没有载入空白数据，请完全关闭浏览器后重开');}
    const candidate=parse(backup),stats=backup&&backup.stats||recoveryStateStats(candidate);
    if(candidate&&recoveryStateMeaningful(stats)){rec=backup;restored=candidate;recovered=true;}else{_androidOrphanCoreProbe=false;return false;}
  }else if(!restored||+(rec&&rec.savedAt||0)<needed){
    const backup=await imgGet(RECOVERY_IDB_KEY),candidate=parse(backup),stats=backup&&backup.stats||recoveryStateStats(candidate);
    if(candidate&&recoveryStateMeaningful(stats)){rec=backup;restored=candidate;recovered=true;}
  }
  if(!restored)throw new Error('大容量存档无法读取，且没有找到可用的本机恢复副本，请不要清除网站数据');
  const savedAt=+(rec&&rec.savedAt||0)||Date.now();S=mergeStateData(restored);_coreOverflowMode=true;_coreBootRef={ver:1,savedAt};_androidOrphanCoreProbe=false;_coreLogicalBytes=storedTextBytes(rec.json);normalizeLoadedState();
  if(typeof window!=='undefined'&&typeof window.__northBootProgress==='function')window.__northBootProgress(orphanProbe?'已找回安卓浏览器中的原核心存档，正在恢复聊天…':'核心存档和主题已读取，正在恢复聊天…');
  if(recovered){S.settings=S.settings||{};S.settings.storageRecoveredAt=Date.now();await imgPut(CORE_IDB_KEY,{ver:1,savedAt,json:rec.json});}
  if(recovered||orphanProbe){writeCoreBootShell(savedAt);if(recovered)setTimeout(()=>toast('检测到主存档异常，已自动恢复最近的完整副本'),120);}
  return true;
}
//@@ private
async function bootOverflowCore(){const orphanProbe=!_coreBootRef&&_androidOrphanCoreProbe;if(!_coreBootRef&&!orphanProbe)return false;const needed=+(_coreBootRef&&_coreBootRef.savedAt||0),primary=await imgGet(CORE_IDB_KEY);let rec=primary,restored=null,recovered=false;const parse=x=>{if(!x||!x.json)return null;try{const d=JSON.parse(x.json);return d&&d.settings?d:null;}catch(_){return null;}},meaningful=d=>d&&recoveryStateMeaningful(recoveryStateStats(d));restored=parse(rec);if(orphanProbe&&(!restored||!meaningful(restored))){const backup=await imgGet(RECOVERY_IDB_KEY),candidate=parse(backup),stats=backup&&backup.stats||recoveryStateStats(candidate);if(candidate&&recoveryStateMeaningful(stats)){rec=backup;restored=candidate;recovered=true;}else{_androidOrphanCoreProbe=false;return false;}}else if(!restored||+(rec&&rec.savedAt||0)<needed){const backup=await imgGet(RECOVERY_IDB_KEY),candidate=parse(backup),stats=backup&&backup.stats||recoveryStateStats(candidate);if(candidate&&recoveryStateMeaningful(stats)){rec=backup;restored=candidate;recovered=true;}}if(!restored)throw new Error('大容量存档无法读取，且没有找到可用的本机恢复副本，请不要清除网站数据');const savedAt=+(rec&&rec.savedAt||0)||Date.now();S=mergeStateData(restored);_coreOverflowMode=true;_coreBootRef={ver:1,savedAt};_androidOrphanCoreProbe=false;_coreLogicalBytes=storedTextBytes(rec.json);normalizeLoadedState();if(typeof window!=='undefined'&&typeof window.__northBootProgress==='function')window.__northBootProgress(orphanProbe?'已找回安卓浏览器中的原核心存档，正在恢复聊天…':'核心存档和主题已读取，正在恢复聊天…');if(recovered){S.settings=S.settings||{};S.settings.storageRecoveredAt=Date.now();await imgPut(CORE_IDB_KEY,{ver:1,savedAt,json:rec.json});}if(recovered||orphanProbe){writeCoreBootShell(savedAt);if(recovered)setTimeout(()=>toast('检测到主存档异常，已自动恢复最近的完整副本'),120);}return true;}
//@@ end
