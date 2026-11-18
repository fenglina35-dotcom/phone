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
   ${m.type==='text'||m.type==='voice'?`<button class="btn g" style="margin-bottom:8px" onclick="gEditMsg('${gid}','${mid}')">编辑${me?'':'（'+esc(gSenderName(g,m))+'说的）'}</button>`:''}
    <button class="btn g" style="margin-bottom:8px" onclick="gForwardOne('${gid}','${mid}')">转发</button>
    <button class="btn d" style="margin-bottom:8px" onclick="gRecallMsg('${gid}','${mid}')">撤回${me?'':'（对方这条）'}</button>
   <button class="btn d" style="margin-bottom:8px" onclick="gDelOne('${gid}','${mid}')">删除这条</button>
   <button class="btn p" style="margin-bottom:8px" onclick="closeModal();enterGSelect('${gid}')">多选</button>
   <button class="btn g" onclick="closeModal()">取消</button>`);}
/* GROUP_MSG_EDIT_V1（2026-11-02 她要求）：角色群聊里点一条消息可以改它的文字（角色说的也能改），菜单里不放 emoji */
function gSenderName(g,m){const c=m&&m.senderId&&m.senderId!=='me'?getC(m.senderId):null;return c?(c.remark||c.name||'TA'):'TA';}
function gEditMsg(gid,mid){const g=S.groups.find(x=>x.id===gid),m=g&&g.msgs.find(x=>x.id===mid);if(!m)return;openModal(`<h3>编辑消息</h3><div class="field"><textarea id="gem_t" rows="4">${esc(m.content||'')}</textarea></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="gEditSave('${gid}','${mid}')">保存</button></div>`);}
function gEditSave(gid,mid){const g=S.groups.find(x=>x.id===gid),m=g&&g.msgs.find(x=>x.id===mid),el=document.getElementById('gem_t');if(!m||!el)return;const v=el.value.trim();if(!v){toast('内容不能为空');return;}m.content=v;m.edited=true;save();closeModal();render();toast('已修改');}
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
async function groupRoleReplyItems(g,c,recent,pcap,opt){opt=opt||{};const sys=buildSystem(c,{query:(recent||[]).slice(-6).map(m=>gmText(m)).join(' ')})+gContext(g,c,recent),turn=groupRoleTurnText(pcap,opt);let previous='';for(let attempt=0;attempt<2;attempt++){try{const request=[{role:'system',content:sys},{role:'user',content:turn}];if(attempt){if(previous)request.push({role:'assistant',content:previous.slice(0,1200)});request.push({role:'user',content:'[上一版没有形成可发送的群聊消息。请仍由你本人根据当前群聊上下文重新回复一次，只输出1到'+Math.max(1,+pcap||1)+'条自然短消息；不要解释失败，不要输出空白或系统提示。]'});}let content=roleVisibleEnvelopeText(await chatAPI(request,Object.assign({max:380,complete:true,groupOutput:true},opt.route!=null?{routeIndex:opt.route,independentRoleModel:true}:{})));previous=String(content||'');content=groupRoleReplyNickname(content,g,c);if(typeof groupRoleAdminTags==='function')content=groupRoleAdminTags(g,c,content);if(typeof relConsumeTags==='function')content=relConsumeTags(content,c);const items=gParseReply(content.replace(GROUP_SILENT_RE,''),pcap,recent,g);if(items.length)return items;/* 自己选择不开口：安静就是回答，不再追问一遍。 */if(!opt.first&&GROUP_SILENT_RE.test(content))return[];if(opt.why&&!GROUP_SILENT_RE.test(content))opt.why.push(previous.trim()?'回复里没有能发出来的内容（'+previous.trim().replace(/\s+/g,' ').slice(0,40)+'）':'模型返回了空内容');}catch(e){if(opt.why)opt.why.push((e&&e.message)||String(e||'请求失败'));if(e&&e.code==='reasoning-budget')return[];}}return[];}
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
  let raw='';try{raw=roleVisibleEnvelopeText(await chatAPI([{role:'system',content:sys},{role:'user',content:turn}],Object.assign({max:Math.min(1400,260+batch.length*220),complete:true,groupOutput:true},route!=null?{routeIndex:route,independentRoleModel:true}:{})));}catch(e){why.push((e&&e.message)||'请求失败');out.budgetExhausted=!!(e&&e.code==='reasoning-budget');out.failed=true;return out;}
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
      if(got.budgetExhausted)continue;
      if(got.failed){/* 合并那一次请求失败了：别让这几个人都不说话，退回每人单独调用 */
        for(const e of batch){if(left<=0)break;if(!g.members.includes(e.c.id)||gmMutedUntil('role',id,e.c.id))continue;groupTypingSet(g,e.c.id);let items;try{items=await groupRoleReplyItems(g,e.c,g.msgs.slice(-14),Math.min(e.cap,left),{temper:e.temper,cares:e.cares,first:e.c.id===(S.couple&&S.couple.cid),why,route:typeof roleChatRouteIndex==='function'?roleChatRouteIndex(e.c):null});}finally{groupTypingSet(g,null);}items=take(items);if(items.length){spoke++;await gEmitRoleItems(g,e.c,items);}}
        continue;}
      let firstRole=true;for(const e of batch){const items=take(got.get(e.c.id)||[]);if(!items.length)continue;if(!firstRole){groupTypingSet(g,e.c.id);await sleep(700+Math.random()*900);groupTypingSet(g,null);}firstRole=false;spoke++;await gEmitRoleItems(g,e.c,items);}
    }catch(e){why.push((e&&e.message)||'群回复出错');}}
  /* 一个人都没回、又不是大家选择沉默：把原因说出来，别只闪一下三个点就没了 */
  if(spoke&&why.some(x=>String(x).includes('输出额度已用完但没有正文'))){const reason=why.find(x=>String(x).includes('输出额度已用完但没有正文'));g.replyFail={at:Date.now(),why:reason};save();toast('部分角色未回复：'+reason,5200);return;}
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
