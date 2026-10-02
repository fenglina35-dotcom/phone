/* Private app only. Optional adapter: a failure here must never block chat. */
'use strict';
var _robotFaceBinding = null, _robotFaceBusy = false;
var _robotFacePresence=null,_robotFaceCheckTask=null,_robotFacePageTimer=0,_robotFacePageEpoch=0,_robotFaceCode='',_robotFaceCodeUntil=0;
var _robotFaceControlEpoch=0,_robotFaceManualBusy=false,_robotFaceManualPending=null,_robotFaceLast=null;
var _robotFacePaused=false,_robotFaceManualAt=0;
var _robotFaceView='home';
var _robotFaceEnabled=false,_robotFaceSwitchBusy=false,_robotFaceRequestEpoch=0,_robotFaceSwitchAt=0;
var _robotFaceError='',_robotFaceReceiptEpoch=0;
function robotFaceFailure(reason){_robotFaceError=reason||'network';_robotFacePaused=true;if(reason==='disabled')_robotFaceEnabled=false;robotFacePaint();}
function robotFaceReason(reason){return ({offline:'云端返回 offline：近30秒没有鉴权设备心跳。心跳为何中断尚未确认，不能据此判定 Wi-Fi 密码或表情有误。',disabled:'云端返回 disabled：联动已关闭。',expired:'云端返回 expired：指令时间超出有效窗口，没有重放。',superseded:'云端返回 superseded：较新的操作已接管。','rate-limit':'云端返回 rate-limit：超过发送频率限制。',unbound:'云端返回 unbound：找不到匹配的有效设备绑定。','robot-timeout':'手机等待云端响应超过8秒；请求最终是否成功尚未确认。',network:'请求失败，没有取得有效云端结果；具体网络原因未确认。'})[reason]||'云端未确认成功，未提供可识别的原因。';}
function robotFaceDiagnostic(error,stage){const code=String(error?.code||error?.reason||error?.message||'');return {stage,code:/^[a-zA-Z0-9_.:-]{1,80}$/.test(code)?code:'未提供错误码'};}
function robotFaceErrorText(error){return robotFaceReason(error?.message==='robot-timeout'?'robot-timeout':'network')+(globalThis.DeviceHistory?.errorText&&error?.message?' 实际返回：'+DeviceHistory.errorText(error.message):'');}
function robotFaceLog(source,emotion,b,messageId){const role=b&&getC(b.roleId);return globalThis.DeviceHistory?.begin('k',{kind:'k',actor:source==='manual'?'手动测试':role?.remark||role?.name||'角色',roleId:b?.roleId,bindingId:b?.bindingId,messageId,action:'显示'+(ROBOT_FACE_CHOICES.find(x=>x[0]===emotion)?.[1]||emotion)+'表情'});}
var _robotFaceHistoryBusy=false,_robotFaceHistoryAt=0;
async function robotFaceHistoryRefresh(){
  if(!robotFacePageActive()||_robotFaceView!=='history'||_robotFaceHistoryBusy)return;
  const feedback=document.getElementById('robot-face-history-status'),button=document.getElementById('robot-face-history-refresh');
  if(Date.now()-_robotFaceHistoryAt<10000){if(feedback)feedback.textContent='刚刚已刷新，十秒后可再次更新。';return;}
  const target=robotFaceScope(),epoch=_robotFacePageEpoch;
  _robotFaceHistoryBusy=true;_robotFaceHistoryAt=Date.now();if(button){button.disabled=true;button.textContent='正在读取…';}
  try{const data=await robotFaceRequest('phone_robot_history',{p_target:target,p_owner_secret:companionOwnerSecret()});if(robotFaceScope()!==target||epoch!==_robotFacePageEpoch)return;if(!data?.ok||!Array.isArray(data.items))throw Error('invalid-history');globalThis.DeviceHistory?.mergeRobot(data.items);if(feedback)feedback.textContent='已合并云端记录，包括后台角色操作；最多保留100条。';}
  catch(error){if(robotFaceScope()===target&&feedback)feedback.textContent='云端记录未更新，本地记录保留。'+(globalThis.DeviceHistory?.errorText(error?.message)||'原因未确认。');}
  finally{_robotFaceHistoryBusy=false;if(button){button.disabled=false;button.textContent='刷新云端记录';}}
}
async function robotFaceReceipt(b,sequence,handle){
  if(!Number.isSafeInteger(sequence)||sequence<1){globalThis.DeviceHistory?.finish(handle,'unknown','云端响应缺少有效指令序号，不能查询设备回执。',null,{stage:'云端响应校验',code:'invalid-sequence'});return;}
  const epoch=++_robotFaceReceiptEpoch,requestEpoch=_robotFaceRequestEpoch,controlEpoch=_robotFaceControlEpoch,target=b.target;
  const active=()=>epoch===_robotFaceReceiptEpoch&&requestEpoch===_robotFaceRequestEpoch&&controlEpoch===_robotFaceControlEpoch&&_robotFaceEnabled&&robotFaceScope()===target&&_robotFaceBinding?.bindingId===b.bindingId;
  let receiptError=null;
  // Only a sent command gets up to three receipt reads. No background polling loop.
  for(const delay of [600,1800,3600]){
    await new Promise(r=>setTimeout(r,delay));if(!active())return;
    try{
      const data=await robotFaceRequest('phone_robot_status',{p_target:target,p_owner_secret:companionOwnerSecret()});
      if(!active())return;
      if(!data?.ok||!data.bound||data.bindingId!==b.bindingId){receiptError=Error('binding-or-status-mismatch');break;}
      receiptError=null;
      _robotFacePresence={target,data,receivedAt:Date.now()};
      globalThis.DeviceHistory?.acknowledge(b.bindingId,data.acceptedSequence);
      if(data.enabled===false){_robotFaceEnabled=false;_robotFacePaused=true;globalThis.DeviceHistory?.finish(handle,'unknown','云端联动已关闭，本次未取得独立接收确认。',sequence,{stage:'设备接收回执',code:'disabled'});robotFacePaint();return;}
      if(data.acceptedSequence===sequence){_robotFaceError='';_robotFacePaused=false;globalThis.DeviceHistory?.finish(handle,'received','设备已报告接收该指令；请以 K 实际屏幕为准。',sequence);robotFacePaint();return;}
      if(data.acceptedSequence>sequence){globalThis.DeviceHistory?.finish(handle,'superseded','设备已接收后续指令，本条没有独立接收回执。',sequence);robotFacePaint();return;}
      robotFacePaint();
    }catch(error){if(!active())return;receiptError=error;}
  }
  if(active()){const detail=receiptError?'回执查询实际异常：'+(globalThis.DeviceHistory?.errorText(receiptError.message)||'接口未提供原因')+'。没有拿到接收证明，不能判定 K 断线。':'云端已接受，但三次有界查询内没有收到该序号的设备回执。无法确定是传输、设备校验还是其他原因；不会自动重放。';globalThis.DeviceHistory?.finish(handle,'unknown',detail,sequence,receiptError?robotFaceDiagnostic(receiptError,'手机查询设备回执'):{stage:'云端 → K 接收回执',code:'receipt-unconfirmed'});robotFaceStatus('云端已接受指令，但 K 尚未确认接收。具体原因待确认，请查看操作记录。');}
}
function robotFaceReady(){return _robotFaceEnabled&&!_robotFacePaused&&!!_robotFaceBinding&&_robotFaceBinding.target===robotFaceScope();}
async function robotFaceRequest(name,args){
  let timer;try{return await Promise.race([companionRpc(name,args),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('robot-timeout')),8000);})]);}finally{clearTimeout(timer);}
}
var ROBOT_FACE_CHOICES=Object.freeze([['calm','默认'],['happy','开心'],['pout','委屈'],['angry','生气'],['sad','伤心'],['helpless','无奈'],['scrutiny','审视'],['sleep','睡着'],['shy','害羞'],['surprised','惊讶'],['miss','想你'],['smug','得意'],['confused','疑惑'],['kiss','亲亲'],['adoring','痴迷']]);
function robotFaceAvailable(){return typeof privateNativeAppOn==='function' && privateNativeAppOn() && typeof actId==='function' && actId()==='main' && typeof companionCloudURL==='function' && companionCloudURL()==='https://qvuahlqimcfgeoetosnl.supabase.co';}
function robotFaceScope(){return robotFaceAvailable()?String(S.settings&&S.settings.cloudId||''):'';}
function robotFaceCapture(c,aid,replyToken){
  const b=_robotFaceBinding,scope=robotFaceScope();
  if(!b || !scope || aid!=='main' || b.target!==scope || b.roleId!==c.id || c.blocked || c.deleted)return null;
  return {target:scope,roleId:c.id,bindingId:b.bindingId,replyToken,startedAt:Date.now(),controlEpoch:_robotFaceControlEpoch,before:new Set(msgsForAccount(c.id,aid).filter(Boolean).map(m=>m.id))};
}
async function robotFacePrepareTurn(c,aid,replyToken){
  if(!robotFaceReady()||!robotFaceAvailable()||aid!=='main')return null;
  return robotFaceCapture(c,aid,replyToken);
}
function robotFacePrompt(turn){if(!turn||!globalThis.RobotFaceProtocol)return '';const last=_robotFaceLast;return RobotFaceProtocol.prompt+(last&&last.bindingId===turn.bindingId?'\n本机上次发送的表情指令为 '+last.emotion+'（不是屏幕执行回执）。本轮重新选择，不要为了延续旧指令而保持过时心情。':'');}
function robotFaceExtract(text){return globalThis.RobotFaceProtocol?RobotFaceProtocol.extract(text):{text,emotion:null};}
async function robotFaceRefresh(){
  if(!robotFaceAvailable()){_robotFaceBinding=null;_robotFacePresence=null;return null;}
  const target=cloudId(),epoch=_robotFaceRequestEpoch;
  const data=await robotFaceRequest('phone_robot_status',{p_target:target,p_owner_secret:companionOwnerSecret()});
  if(epoch!==_robotFaceRequestEpoch)return _robotFaceBinding;
  if(robotFaceScope()!==target)return null;
  if(!data?.ok)throw new Error('status-unconfirmed');
  const previous=_robotFaceBinding;_robotFaceBinding=null;
  _robotFacePresence={target,data,receivedAt:Date.now()};
  if(data.enabled===false)_robotFaceEnabled=false;
  _robotFacePaused=!robotFaceOnline();
  _robotFaceError=data.online?'':data.bound?'offline':'';
  globalThis.DeviceHistory?.acknowledge(data.bindingId,data.acceptedSequence);
  if(data&&data.ok&&data.bound&&getC(data.roleId)){
    _robotFaceBinding={target,roleId:data.roleId,bindingId:data.bindingId};
    if(!previous||previous.target!==target||previous.bindingId!==data.bindingId)void roleServerPushSync(getC(data.roleId),true);
  }
  return _robotFaceBinding;
}
async function robotFacePublish(turn,emotion,aid){
  if(!turn||turn.sent||turn.publishing||!robotFaceReady()||!globalThis.RobotFaceProtocol?.emotions.includes(emotion))return;
  let log;
  try{
    const b=_robotFaceBinding;
    if(!turn || !emotion || aid!=='main' || actId()!==aid || robotFaceScope()!==turn.target || !b || b.bindingId!==turn.bindingId || b.roleId!==turn.roleId)return;
    if(turn.replyToken!=null && typeof replyStale==='function' && replyStale(turn.roleId,turn.replyToken,aid))return;
    if(turn.controlEpoch!==_robotFaceControlEpoch)return;
    const c=getC(turn.roleId);if(!c||c.blocked||c.deleted)return;
    const message=msgsForAccount(turn.roleId,aid).filter(m=>m&&m.role==='assistant'&&['text','voice'].includes(m.type)&&m.id&&!turn.before.has(m.id)&&(+m.time||0)>=turn.startedAt).pop();
    if(!message)return;
    turn.publishing=true;
    if(!robotFaceReady())return;
    // First visible text/voice starts delivery; storage/network never delay later bubbles.
    if(!await persistWechatMessagesNow())return;
    if(_robotFacePaused||robotFaceScope()!==turn.target||actId()!==aid||_robotFaceBinding?.bindingId!==turn.bindingId||turn.controlEpoch!==_robotFaceControlEpoch||replyStale(turn.roleId,turn.replyToken,aid))return;
    log=robotFaceLog('role',emotion,b,message.id);
    const result=await robotFaceRequest('phone_robot_publish',{p_target:turn.target,p_owner_secret:companionOwnerSecret(),p_role_id:turn.roleId,p_binding_id:turn.bindingId,p_message_id:message.id,p_emotion:emotion,p_issued_at:message.time});
    if(turn.controlEpoch!==_robotFaceControlEpoch||robotFaceScope()!==turn.target){globalThis.DeviceHistory?.finish(log,'unknown','操作期间控制权已切换，未继续查询回执。');return;}
    if(result?.ok){turn.sent=true;_robotFaceLast={bindingId:turn.bindingId,emotion};globalThis.DeviceHistory?.finish(log,'sent','云端已接受，等待设备接收。',result.sequence);void robotFaceReceipt(b,result.sequence,log);}
    else globalThis.DeviceHistory?.finish(log,'failed',robotFaceReason(result?.reason),null,robotFaceDiagnostic(result,'云端接收指令'));
    if(result&&!result.ok&&['offline','disabled'].includes(result.reason))robotFaceFailure(result.reason);
    if(result&&result.reason==='unbound')_robotFaceBinding=null;
  }catch(error){globalThis.DeviceHistory?.finish(log,'unknown',robotFaceErrorText(error),null,robotFaceDiagnostic(error,'手机 → 云端请求'));if(turn&&turn.controlEpoch===_robotFaceControlEpoch&&robotFaceScope()===turn.target)robotFaceFailure('network');/* No retry storm or made-up fallback emotion. */}
  finally{if(turn)turn.publishing=false;}
}
function robotFaceFirstVisible(turn,emotion,aid){if(turn&&!turn.firstVisible){turn.firstVisible=true;void robotFacePublish(turn,emotion,aid);}}
async function robotFaceManual(emotion){
  if(_robotFaceManualBusy||!robotFacePageActive()||_robotFaceView!=='faces'||!ROBOT_FACE_CHOICES.some(x=>x[0]===emotion))return;
  if(Date.now()-_robotFaceManualAt<1000){robotFaceStatus('请稍等一秒，再测试下一个表情。');return;}
  const b=_robotFaceBinding,target=robotFaceScope(),selected=document.getElementById('robot-face-role')?.value;
  if(!b||b.target!==target||selected!==b.roleId||!_robotFaceEnabled){robotFaceStatus('请先在设备连接中开启联动，并确认 K 已联网。');return;}
  const c=getC(b.roleId);if(!c||c.deleted||c.blocked)return;
  _robotFaceManualBusy=true;_robotFaceManualAt=Date.now();_robotFaceControlEpoch++;_robotFaceManualPending=null;robotFacePaint();
  const label=ROBOT_FACE_CHOICES.find(x=>x[0]===emotion)[1];
  const messageId='manual:'+uid(),log=robotFaceLog('manual',emotion,b,messageId);
  try{
    const epoch=_robotFaceControlEpoch;
    if(!robotFaceReady()||!robotFaceOnline()){
      robotFaceStatus('正在按需确认 K 的连接…');await robotFaceRefresh();
      if(epoch!==_robotFaceControlEpoch||robotFaceScope()!==target||_robotFaceBinding?.bindingId!==b.bindingId||!_robotFaceEnabled){globalThis.DeviceHistory?.finish(log,'failed','操作已取消：联动或账号状态发生变化。');return;}
      if(!robotFaceReady()){globalThis.DeviceHistory?.finish(log,'failed',robotFaceReason('offline'),null,{stage:'发送前设备心跳检查',code:'offline'});robotFaceStatus(robotFaceReason('offline'));return;}
    }
    const result=await robotFaceRequest('phone_robot_publish',{p_target:target,p_owner_secret:companionOwnerSecret(),p_role_id:b.roleId,p_binding_id:b.bindingId,p_message_id:messageId,p_emotion:emotion,p_issued_at:Date.now()});
    if(epoch!==_robotFaceControlEpoch||!robotFaceReady()||robotFaceScope()!==target||_robotFaceBinding?.bindingId!==b.bindingId){globalThis.DeviceHistory?.finish(log,'unknown','操作期间联动或账号状态发生变化，未确认设备结果。');return;}
    if(result&&!result.ok&&['offline','disabled'].includes(result.reason))robotFaceFailure(result.reason);
    if(!result?.ok){globalThis.DeviceHistory?.finish(log,'failed',robotFaceReason(result?.reason),null,robotFaceDiagnostic(result,'云端接收指令'));robotFaceStatus(robotFaceReason(result?.reason));return;}
    _robotFaceError='';globalThis.DeviceHistory?.finish(log,'sent','云端已接受，等待设备接收。',result.sequence);
    _robotFaceLast={bindingId:b.bindingId,emotion};_robotFaceManualPending={target,bindingId:b.bindingId,sequence:result.sequence,label,emotion};
    robotFaceStatus('已发送「'+label+'」，等待设备接收；以 K 屏幕为准。');
    void robotFaceReceipt(b,result.sequence,log);
  }catch(error){globalThis.DeviceHistory?.finish(log,'unknown',robotFaceErrorText(error),null,robotFaceDiagnostic(error,'手机 → 云端请求'));robotFaceFailure('network');robotFaceStatus(robotFaceErrorText(error));}
  finally{_robotFaceManualBusy=false;robotFacePaint();}
}
function robotFaceOpen(){
  if(!robotFaceAvailable()){toast('桌面机器人目前只支持私人 App 的主账号');return;}
  _robotFaceCode='';_robotFaceCodeUntil=0;_robotFacePageEpoch++;_robotFaceView='home';
  go('robotFace');
}
function robotFaceClose(){if(_robotFaceView!=='home'){robotFaceNavigate('home');return;}_robotFacePageEpoch++;clearTimeout(_robotFacePageTimer);_robotFaceCode='';_robotFaceCodeUntil=0;back();}
function robotFaceNavigate(view){
  if(!robotFacePageActive()||!['home','connection','faces','usage','history'].includes(view))return;
  if(_robotFaceView==='connection'&&view!=='connection'){_robotFacePageEpoch++;robotFaceClearCode();}
  _robotFaceView=view;
  document.querySelectorAll('#robot-face-page [data-k-view]').forEach(el=>el.hidden=el.dataset.kView!==view);
  const title=document.getElementById('robot-face-view-title');if(title)title.textContent={home:'YOUR LITTLE COMPANION',connection:'设备连接',faces:'表情测试',usage:'云端用量',history:'操作记录'}[view];
  const backButton=document.querySelector('#robot-face-page .rk-back');if(backButton){backButton.textContent=view==='home'?'‹ 返回':'‹ 小 K';backButton.setAttribute('aria-label',view==='home'?'返回':'返回小 K 首页');}
  document.getElementById('robot-face-page').scrollTop=0;
  const feedback=document.getElementById('robot-face-feedback');if(feedback){feedback.textContent='';feedback.hidden=true;}
  robotFacePaint();
  if(view==='faces'&&!robotFaceReady())robotFaceStatus(_robotFaceEnabled?'点选表情时会按需确认连接，无需重复配对。':'请返回“设备连接”开启联动；无需重复配对。');
  if(view==='history')globalThis.DeviceHistory?.paint();
  if(view==='usage'&&typeof cloudUsageOpen==='function')cloudUsageOpen();
}
function robotFacePageActive(){return robotFaceAvailable()&&typeof cur==='function'&&cur().p==='robotFace'&&!!document.getElementById('robot-face-page');}
function robotFaceOnline(now=Date.now()){
  const p=_robotFacePresence,d=p?.data;
  if(!p||p.target!==robotFaceScope()||!d?.bound||d.online!==true||!Number.isFinite(d.lastSeenAt)||!Number.isFinite(d.serverNow))return false;
  const age=d.serverNow-d.lastSeenAt+Math.max(0,now-p.receivedAt);
  return age>=0&&age<30000;
}
function renderRobotFace(){
  if(!robotFaceAvailable())return '<div class="robot-k-unavailable">小 K 仅在私人主账号可用</div>';
  const contacts=S.contacts.filter(c=>c&&!c.deleted&&!c.blocked);
  const options=contacts.map(c=>`<option value="${esc(c.id)}"${_robotFaceBinding&&_robotFaceBinding.roleId===c.id?' selected':''}>${esc(c.remark||c.name||'角色')}（${esc(c.name||'')}）</option>`).join('');
  setTimeout(robotFacePageMount,0);
  return `<style>
  #robot-face-page{height:100%;overflow-y:auto;background:#f6f5f2;color:#252827;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:0 22px 36px;box-sizing:border-box;-webkit-overflow-scrolling:touch}
  #robot-face-page *{box-sizing:border-box}#robot-face-page button{font:inherit;cursor:pointer;min-height:44px;border:0;border-radius:13px;padding:10px 16px;background:#eae9e5;color:#303733}#robot-face-page button:disabled{opacity:.48;cursor:default}
  #robot-face-page .rk-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 0 8px;gap:12px}#robot-face-page .rk-back{background:none;padding:8px 2px;font-size:15px}#robot-face-page .rk-nav small{font-size:11px;letter-spacing:2px;color:#858780}
  #robot-face-page .rk-hero{text-align:center;padding:24px 0 27px}#robot-face-page .rk-face{width:116px;height:96px;border-radius:27px;background:#242b29;margin:0 auto 17px;display:flex;align-items:center;justify-content:center;gap:14px;box-shadow:0 12px 26px #27332c18;color:#f2f4ed;font-size:30px;font-weight:700;position:relative}#robot-face-page .rk-face:after{content:'';position:absolute;bottom:25px;left:17px;width:12px;height:5px;background:#de9ca9;border-radius:50%;box-shadow:70px 0 #de9ca9}#robot-face-page .rk-face span{font-size:21px;align-self:center;margin-top:9px}
  #robot-face-page h1{font-size:29px;letter-spacing:1px;line-height:1.2;margin:0 0 12px;font-weight:650}#robot-face-page .rk-badge{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:#74786f;background:#eaece6;border-radius:30px;padding:5px 12px}#robot-face-page .rk-dot{width:7px;height:7px;border-radius:50%;background:#999e95}#robot-face-page .rk-badge[data-online="true"]{background:#e3f0e5;color:#2d6b41}#robot-face-page .rk-badge[data-online="true"] .rk-dot{background:#39a864;box-shadow:0 0 0 3px #39a86418}
  #robot-face-page .rk-sub{color:#83867e;font-size:12px;margin:10px 0 0}#robot-face-page .rk-card{background:#fff;border:1px solid #e8e9e3;border-radius:20px;margin-bottom:14px;padding:19px}#robot-face-page h2{font-size:15px;font-weight:600;margin:0 0 12px}#robot-face-page label{font-size:12px;color:#878b83;display:block;margin-bottom:7px}#robot-face-page select{width:100%;min-width:0;min-height:46px;border:1px solid #e6e8e1;border-radius:12px;padding:10px;background:#fafaf7;color:#303733;font:inherit}#robot-face-page .rk-note{font-size:12px;line-height:1.7;color:#83867e;margin:10px 0 0}#robot-face-page .rk-actions{display:flex;gap:10px;flex-wrap:wrap}#robot-face-page .rk-primary{background:#354b40;color:#fff;flex:1}#robot-face-page .rk-secondary{background:#eef0eb;flex:1}
  #robot-face-page .rk-code-wrap{margin-top:14px;padding-top:14px;border-top:1px solid #eeeee9}#robot-face-page .rk-code-row{display:flex;gap:8px;align-items:center}#robot-face-page textarea{font:12px/1.6 ui-monospace,monospace;resize:none;border:0;background:#f3f4ef;border-radius:10px;padding:10px;flex:1;width:0;min-width:0;height:62px;color:#4d5a50;word-break:break-all;-webkit-user-select:text;user-select:text}#robot-face-page .rk-copy{background:#e5ece3;color:#36533f;flex-shrink:0}#robot-face-page .rk-foot{text-align:center;color:#90938b;font-size:11px;margin-top:20px}#robot-face-page .rk-unbind{display:block;margin:8px auto 0;background:none;color:#9b7069;font-size:12px}#robot-face-page [hidden]{display:none!important}#robot-face-page :focus-visible{outline:2px solid #64816b;outline-offset:3px}
  #robot-face-page{background:#000;color:#f5f5f5;color-scheme:dark}
  #robot-face-page button{background:#202020;color:#f5f5f5}
  #robot-face-page .rk-nav small,#robot-face-page label{color:#aaa}
  #robot-face-page .rk-back,#robot-face-page .rk-unbind{background:none}
  #robot-face-page .rk-face{width:128px;height:128px;box-sizing:border-box;aspect-ratio:1;padding:0;border:2px solid #fff;border-radius:23px;background:#000;box-shadow:none;overflow:hidden}
  #robot-face-page .rk-face:after{content:none}
  #robot-face-page .rk-face img{display:block;width:100%;height:100%;object-fit:contain}
  #robot-face-page .rk-badge{background:#1c1c1c;color:#aaa}
  #robot-face-page .rk-dot{background:#888}
  #robot-face-page .rk-badge[data-online="true"]{background:#10251a;color:#79dea0}
  #robot-face-page .rk-badge[data-online="true"] .rk-dot{background:#45d580;box-shadow:0 0 0 3px #45d58018}
  #robot-face-page .rk-sub,#robot-face-page .rk-note,#robot-face-page .rk-foot{color:#999}
  #robot-face-page .rk-card{background:#101010;border-color:#282828}
  #robot-face-page select{background:#171717;border-color:#333;color:#f5f5f5}
  #robot-face-page .rk-primary{background:#f5f5f5;color:#111}
  #robot-face-page .rk-secondary{background:#252525;color:#eee}
  #robot-face-page .rk-code-wrap{border-color:#303030}
  #robot-face-page textarea{background:#1b1b1b;color:#ddd}
  #robot-face-page .rk-copy{background:#303030;color:#fff}
  #robot-face-page .rk-unbind{color:#c49690}
  #robot-face-page :focus-visible{outline-color:#fff}
  #robot-face-page .rk-faces{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  #robot-face-page .rk-face-choice{padding:8px;background:#080808;border:1px solid #333;overflow:hidden}
  #robot-face-page .rk-face-choice img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;border-radius:9px}
  #robot-face-page .rk-face-choice span{display:block;font-size:13px;margin:5px 0 1px}
  #robot-face-page .rk-face-choice[aria-pressed="true"]{border-color:#fff;background:#191919}
  #robot-face-page .rk-menu{display:grid;gap:10px}
  #robot-face-page .rk-menu-item{width:100%;display:flex;align-items:center;gap:13px;text-align:left;min-height:76px;padding:14px 17px;background:#101010;border:1px solid #282828;border-radius:18px}
  #robot-face-page .rk-menu-icon{display:grid;place-items:center;width:36px;height:36px;background:#181818;border-radius:11px;color:#eee;flex-shrink:0}
  #robot-face-page .rk-menu-icon svg{display:block;width:24px;height:24px;pointer-events:none}
  #robot-face-page .rk-menu-item b{display:block;font-size:15px;font-weight:600}#robot-face-page .rk-menu-item small{display:block;color:#999;font-size:11px;margin-top:3px}
  #robot-face-page .rk-menu-item em{margin-left:auto;color:#888;font-size:22px;font-style:normal}
  #robot-face-page .rk-inner-title{margin:22px 0 18px;font-size:24px}
  #robot-face-page .rk-hero{padding:15px 0 20px}#robot-face-page .rk-menu-item{min-height:68px;padding:11px 15px}
  </style><section id="robot-face-page" aria-label="小 K 独立页面">
  <header class="rk-nav"><button class="rk-back" onclick="robotFaceClose()" aria-label="返回">‹ 返回</button><small id="robot-face-view-title">YOUR LITTLE COMPANION</small></header>
  <div data-k-view="home">
  <div class="rk-hero"><div class="rk-face"><img src="assets/k-default-face.png" alt="小 K 的默认表情"></div><h1>小 K</h1><div id="robot-face-badge" class="rk-badge" data-online="false"><i class="rk-dot"></i><span id="robot-face-online">正在检查</span></div><p class="rk-sub">同一个他，在你身边</p></div>
  <nav class="rk-menu" aria-label="小 K 功能">
  <button class="rk-menu-item" data-k-open="connection" onclick="robotFaceNavigate('connection')"><span class="rk-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="m9 15 6-6"/><path d="m9.5 7.5 2.7-2.7a4.25 4.25 0 0 1 6 6l-2.7 2.7M14.5 16.5l-2.7 2.7a4.25 4.25 0 0 1-6-6l2.7-2.7"/></svg></span><span><b>设备连接</b><small>角色绑定 · 配对与连接状态</small></span><em aria-hidden="true">›</em></button>
  <button class="rk-menu-item" data-k-open="faces" onclick="robotFaceNavigate('faces')"><span class="rk-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M8 9.5h1M15 9.5h1M8.5 14a4.1 4.1 0 0 0 7 0"/></svg></span><span><b>表情测试</b><small>十五种专属表情 · 点选测试</small></span><em aria-hidden="true">›</em></button>
  <button class="rk-menu-item" data-k-open="usage" onclick="robotFaceNavigate('usage')"><span class="rk-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false"><rect x="3.5" y="4" width="3.5" height="16" rx="1.2"/><rect x="10.25" y="9" width="3.5" height="11" rx="1.2"/><rect x="17" y="14" width="3.5" height="6" rx="1.2"/></svg></span><span><b>云端用量</b><small>两家云端 · 用量与额度提醒</small></span><em aria-hidden="true">›</em></button>
  <button class="rk-menu-item" data-k-open="history" onclick="robotFaceNavigate('history')"><span class="rk-menu-icon">${globalThis.DeviceHistory?.svg('history')||''}</span><span><b>操作记录</b><small>角色与手动测试 · 结果与失败日志</small></span><em aria-hidden="true">›</em></button>
  </nav><p class="rk-foot">当前支持表情联动 · 声音与动作暂未启用</p></div>
  <div data-k-view="connection" hidden><h1 class="rk-inner-title">设备连接</h1>
  <div class="rk-card"><h2>与谁联动</h2><label for="robot-face-role">选择小手机中已有的角色</label><select id="robot-face-role" onchange="robotFaceClearCode();robotFacePaint()" ${contacts.length?'':'disabled'}>${options||'<option>请先添加角色</option>'}</select><p id="robot-face-binding" class="rk-note">正在核对绑定</p></div>
  <div class="rk-card"><h2>手动联动</h2><div class="rk-actions"><button class="rk-primary" id="robot-face-enable" onclick="robotFaceSetEnabled(true)">开启联动</button><button class="rk-secondary" id="robot-face-disable" onclick="robotFaceSetEnabled(false)">关闭联动</button></div><p id="robot-face-switch-state" class="rk-note">尚未手动开启</p><p class="rk-note">不开启自动检查。开关控制表情联动，不是机器人电源；K 需先开机并联网。关闭后保留角色绑定。</p><button class="rk-secondary" id="robot-face-check" onclick="robotFaceCheck()">刷新设备状态</button><div class="rk-actions"><button class="rk-secondary" id="robot-face-pair" onclick="robotFacePair()" ${contacts.length?'':'disabled'}>生成配对码</button></div>
  <div id="robot-face-code-wrap" class="rk-code-wrap" hidden><label for="robot-face-code">一次性配对码</label><div class="rk-code-row"><textarea id="robot-face-code" readonly aria-label="一次性配对码" spellcheck="false"></textarea><button id="robot-face-copy" class="rk-copy" onclick="robotFaceCopy()">复制</button></div><p id="robot-face-code-expiry" class="rk-note"></p></div>
  <p id="robot-face-status" class="rk-note" role="status" aria-live="polite">点击开启联动，或手动刷新设备状态。</p><p class="rk-note">配对码只用于电脑配置工具，请勿发送到聊天。</p></div>
  <button class="rk-unbind" onclick="robotFaceRevoke()">解除设备绑定</button><p class="rk-foot">状态只在手动操作时刷新；绿标依据近期设备记录<br>关闭联动不等于关机，现有固件仍有联网请求</p></div>
  <div data-k-view="faces" hidden><h1 class="rk-inner-title">表情测试</h1><div class="rk-card"><p class="rk-note">点击原版表情，直接发送给 K，不会向角色发消息。先手动测试，再回聊天测试角色；下一轮角色回复会自动接管。</p><div class="rk-faces">${ROBOT_FACE_CHOICES.map(([id,label])=>`<button class="rk-face-choice" data-emotion="${id}" aria-pressed="false" onclick="robotFaceManual('${id}')" disabled><img src="assets/k-faces/${id}.gif" alt="${label}表情" loading="lazy"><span>${label}</span></button>`).join('')}</div><p id="robot-face-manual-status" class="rk-note">尚未发送手动测试。图片是原版动画预览，不是设备屏幕实时画面。</p></div></div>
  <div data-k-view="usage" hidden><h1 class="rk-inner-title">云端用量</h1>${typeof cloudUsageHTML==='function'?cloudUsageHTML(true):'<p class="rk-note">用量组件暂未加载。</p>'}</div>
  <div data-k-view="history" hidden><h1 class="rk-inner-title">操作记录</h1><p class="rk-note" style="margin-bottom:14px">角色的表情选择与手动测试，在这里留痕。<br>“已发送”不代表 K 已接收。</p><button id="robot-face-history-refresh" class="dh-refresh" onclick="robotFaceHistoryRefresh()">刷新云端记录</button><p id="robot-face-history-status" class="rk-note" style="margin:0 0 16px">本机记录即时保存；后台角色操作按需刷新。</p>${globalThis.DeviceHistory?.block('k')||'<p>记录组件未加载。</p>'}</div>
  <p id="robot-face-feedback" class="rk-note" role="status" aria-live="polite" hidden></p></section>`;
}
function robotFaceStatus(text){if(typeof document==='undefined')return;const el=document.getElementById('robot-face-status');if(el)el.textContent=text;const feedback=document.getElementById('robot-face-feedback');if(feedback&&_robotFaceView==='faces'){feedback.textContent=text;feedback.hidden=false;}}
function robotFaceClearCode(){_robotFaceCode='';_robotFaceCodeUntil=0;const el=document.getElementById('robot-face-code');if(el)el.value='';const box=document.getElementById('robot-face-code-wrap');if(box)box.hidden=true;}
function robotFacePaint(){
  if(!robotFacePageActive())return;
  const b=_robotFaceBinding,p=_robotFacePresence,known=p?.target===robotFaceScope(),online=robotFaceOnline();
  document.getElementById('robot-face-badge').dataset.online=String(online&&_robotFaceEnabled&&!_robotFaceError);
  document.getElementById('robot-face-online').textContent=!_robotFaceEnabled?'联动未开启':_robotFaceError==='offline'?'暂未收到设备心跳':_robotFaceError?'发送结果待确认':online?'在线':known?(b?'联动已开启 · 状态待刷新':'未绑定'):'联动已开启 · 尚无状态记录';
  const enabled=document.getElementById('robot-face-enable'),disabled=document.getElementById('robot-face-disable'),check=document.getElementById('robot-face-check');
  if(enabled){enabled.disabled=_robotFaceSwitchBusy;enabled.textContent=_robotFaceSwitchBusy?'正在处理…':_robotFaceEnabled?'确认设备状态':'开启联动';}
  if(disabled)disabled.disabled=_robotFaceSwitchBusy;
  if(check){check.disabled=!!_robotFaceCheckTask||_robotFaceSwitchBusy;check.textContent=_robotFaceCheckTask?'正在检查…':'刷新设备状态';}
  const state=document.getElementById('robot-face-switch-state');if(state)state.textContent=_robotFaceEnabled?'联动已开启 · 状态只在手动操作时查询':'本机联动未开启 · 不会自动检查或发送表情';
  const role=b&&getC(b.roleId);document.getElementById('robot-face-binding').textContent=role?'已绑定 · '+(role.remark||role.name):'配对后沿用所选角色，不会新建聊天。';
  if(_robotFaceCode&&Date.now()>=_robotFaceCodeUntil){robotFaceClearCode();robotFaceStatus('配对码已过期，需要时重新生成。');}
  const copy=document.getElementById('robot-face-copy');if(copy)copy.disabled=!_robotFaceCode||Date.now()>=_robotFaceCodeUntil;
  document.querySelectorAll('.rk-face-choice').forEach(el=>{el.disabled=_robotFaceManualBusy||!_robotFaceEnabled||!b||b.target!==robotFaceScope()||document.getElementById('robot-face-role')?.value!==b.roleId;el.setAttribute('aria-pressed',String(!!(_robotFaceLast&&_robotFaceLast.bindingId===b?.bindingId&&_robotFaceLast.emotion===el.dataset.emotion)));});
  const pending=_robotFaceManualPending,manual=document.getElementById('robot-face-manual-status');
  if(manual&&pending&&pending.target===robotFaceScope()&&pending.bindingId===b?.bindingId){const d=p?.data;manual.textContent=d?.acceptedSequence===pending.sequence?'设备已接收「'+pending.label+'」；请以 K 实际屏幕为准。':d?.sequence>pending.sequence?'后续表情指令已接管，本条未逐条确认。':'已发送「'+pending.label+'」，等待设备接收。';}
}
function robotFacePageMount(){
  clearTimeout(_robotFacePageTimer);if(!robotFacePageActive())return;
  robotFaceNavigate(_robotFaceView);
  const tick=()=>{if(!robotFacePageActive()){robotFaceClearCode();return;}robotFacePaint();_robotFacePageTimer=setTimeout(tick,10000);};
  _robotFacePageTimer=setTimeout(tick,10000);
}
async function robotFaceCheck(){
  if(_robotFaceCheckTask||_robotFaceSwitchBusy)return _robotFaceCheckTask;
  const epoch=_robotFaceRequestEpoch;
  robotFaceStatus('正在检查设备连接，最多等待 8 秒…');
  _robotFaceCheckTask=(async()=>{
    try{const b=await robotFaceRefresh();if(epoch===_robotFaceRequestEpoch&&robotFacePageActive()){robotFacePaint();robotFaceStatus(robotFaceOnline()?(_robotFaceEnabled?'K 在线，联动已开启。':'K 在线；点击“开启联动”后才能控制表情。'):b?'K 未确认在线：请确认机器人已开机并连上 Wi-Fi，然后手动重试；无需解绑。':'尚未绑定。选择角色后生成配对码。');}}
    catch(e){if(epoch!==_robotFaceRequestEpoch)return;robotFaceFailure('network');if(robotFacePageActive()){robotFaceStatus(e.message==='robot-timeout'?'检查超时：8 秒未收到云端结果，保留上次状态与绑定。':'检查失败：保留上次状态与绑定，没有自动解绑。');}}
    finally{_robotFaceCheckTask=null;robotFacePaint();}
  })();robotFacePaint();return _robotFaceCheckTask;
}
async function robotFaceSetEnabled(enabled){
  if(_robotFaceSwitchBusy||!robotFaceAvailable())return;
  if(enabled&&_robotFaceEnabled)return robotFaceCheck();
  const target=robotFaceScope(),epoch=++_robotFaceRequestEpoch;
  _robotFaceSwitchBusy=true;_robotFaceEnabled=false;_robotFacePaused=true;_robotFaceControlEpoch++;_robotFaceManualPending=null;
  robotFacePaint();robotFaceStatus(enabled?'正在开启联动，最多等待 8 秒…':'本机已停止发送，正在确认云端关闭…');
  _robotFaceSwitchAt=Math.max(Date.now(),_robotFaceSwitchAt+1);
  try{
    const data=await robotFaceRequest('phone_robot_set_enabled',{p_target:target,p_owner_secret:companionOwnerSecret(),p_enabled:enabled,p_issued_at:_robotFaceSwitchAt});
    if(epoch!==_robotFaceRequestEpoch||target!==robotFaceScope())return;
    if(!data?.ok){if(data?.reason==='unbound'){robotFaceStatus('尚未绑定，请先选择角色并完成配对。');return;}throw Error('unconfirmed');}
    if(data.enabled!==enabled)throw Error('unconfirmed');
    _robotFaceEnabled=enabled;_robotFacePresence={target,data,receivedAt:Date.now()};_robotFacePaused=!enabled||!robotFaceOnline();
    _robotFaceError=enabled&&!robotFaceOnline()?'offline':'';
    if(data.bound&&getC(data.roleId)){_robotFaceBinding={target,roleId:data.roleId,bindingId:data.bindingId};if(enabled)void Promise.resolve(roleServerPushSync(getC(data.roleId),true)).catch(()=>{});}
    robotFaceStatus(!enabled?'云端联动已关闭。绑定保留，机器人仍保持供电；已在传输中的指令可能完成。':robotFaceOnline()?'联动已开启，K 在线。可以手动测试表情或与先生聊天。':'联动开关已开启，但 K 未在线。请先让机器人开机联网，再点“重新连接”；无需解绑。');
  }catch(e){if(epoch===_robotFaceRequestEpoch&&target===robotFaceScope())robotFaceStatus(enabled?'开启未确认成功，本机保持停止。请检查网络；若云端开关尚未部署，需要先更新云端服务。':'本机已停止，但云端关闭未确认。请联网后再次点“关闭联动”；暂不能保证后台已停止。');}
  finally{_robotFaceSwitchBusy=false;robotFacePaint();}
}
async function robotFaceCopy(){
  if(!robotFacePageActive()||!_robotFaceCode||Date.now()>=_robotFaceCodeUntil){robotFaceClearCode();robotFaceStatus('配对码已过期，请重新生成。');return;}
  const epoch=_robotFacePageEpoch,el=document.getElementById('robot-face-code');
  try{const ok=await copyTextCompat(_robotFaceCode,el);if(epoch!==_robotFacePageEpoch||!robotFacePageActive())return;document.getElementById('robot-face-copy').textContent=ok?'已复制':'重试复制';robotFaceStatus(ok?'已复制配对码，粘贴到电脑配置工具即可。':'复制未成功，请点击重试。');}
  catch(_){if(robotFacePageActive())robotFaceStatus('复制未成功，请点击重试。');}
}
async function robotFacePair(){
  if(_robotFaceBusy||!robotFaceAvailable())return;
  _robotFaceBusy=true;
  try{
    const epoch=_robotFacePageEpoch,target=cloudId(),id=document.getElementById('robot-face-role')?.value,c=getC(id);
    if(!c||c.deleted||c.blocked)throw new Error('role');
    robotFaceStatus('正在准备角色配对…');
    if(!await roleServerPushSync(c,true)||robotFaceScope()!==target)throw new Error('sync');
    const data=await companionRpc('phone_robot_begin_pairing',{p_target:target,p_owner_secret:companionOwnerSecret(),p_role_id:id});
    if(robotFaceScope()!==target||!data?.ok||!/^[0-9a-f]{48}$/.test(data.code))throw new Error('pair');
    if(epoch!==_robotFacePageEpoch||!robotFacePageActive()||document.getElementById('robot-face-role').value!==id)return;
    _robotFaceCode=data.code;_robotFaceCodeUntil=Math.min(Number(data.expiresAt)||Date.now()+600000,Date.now()+600000);
    const el=document.getElementById('robot-face-code');if(el)el.value=data.code;
    document.getElementById('robot-face-code-wrap').hidden=false;document.getElementById('robot-face-copy').textContent='复制';document.getElementById('robot-face-code-expiry').textContent='十分钟内有效 · 使用后失效';robotFacePaint();
    robotFaceStatus('配对码已生成，十分钟有效。设备配对完成后点“开启联动”。');
  }catch(_){robotFaceStatus('配对准备失败，原绑定未被主动删除，原聊天不受影响。');}
  finally{_robotFaceBusy=false;}
}
async function robotFaceRevoke(){
  if(_robotFaceBusy||!robotFaceAvailable())return;
  if(!confirm('解除小 K 的设备绑定？手机聊天和角色不会删除。'))return;
  _robotFaceBusy=true;
  try{const target=cloudId(),data=await companionRpc('phone_robot_revoke',{p_target:target,p_owner_secret:companionOwnerSecret()});if(robotFaceScope()!==target||!data?.ok)throw Error('revoke-unconfirmed');_robotFaceBinding=null;_robotFacePresence={target,data:{bound:false},receivedAt:Date.now()};robotFaceClearCode();robotFacePaint();robotFaceStatus('机器人已解绑，手机聊天保持不变');}
  catch(_){robotFaceStatus('解绑未确认成功，请稍后重试');}finally{_robotFaceBusy=false;}
}
// Keep the existing settings renderer intact; absent/failed module adds nothing.
// Use the existing launcher cell and its dimensions; preserve custom user icons.
if(typeof APPDEFS!=='undefined'&&typeof APPRUN!=='undefined'&&typeof privateNativeAppOn==='function'&&privateNativeAppOn()){
  APPDEFS.robotFace={e:'K',c:'#000',t:'小 K'};
  APPRUN.robotFace=()=>robotFaceOpen();
  if(typeof aIco==='function'){
    const original=aIco;
    aIco=function(key,emoji,bg,extra){
      if(key!=='robotFace'||S.me.appIcons?.[key])return original.apply(this,arguments);
      return '<div class="ic robot-k-app-icon" style="background:#000!important;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;box-sizing:border-box;border:2px solid #fff!important"><img src="assets/k-default-face.png" alt="小 K" draggable="false" style="display:block;width:100%;height:100%;object-fit:contain">'+(extra||'')+'</div>';
    };
  }
}
if(typeof roleServerAutomationConfig==='function'){
  const original=roleServerAutomationConfig;
  roleServerAutomationConfig=function(c){const result=original(c),b=_robotFaceBinding;
    result.robotFace=!!(b&&robotFaceAvailable()&&b.target===robotFaceScope()&&b.roleId===c.id);return result;};
}
/* 设置页最下面原来有一个重复的「小 K」入口；主屏已经有小 K 图标，这里换成了虚拟桌面宠物的入口（desk-pet.js）。 */
// Manual control only: no launch, visibility, page-entry or timer status requests.
