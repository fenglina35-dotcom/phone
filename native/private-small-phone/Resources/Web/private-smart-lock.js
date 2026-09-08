(function(){
'use strict';
if(window.__SMALL_PHONE_PRIVATE__!==true||window.__NORTH_PRIVATE_SMART_LOCK__)return;
window.__NORTH_PRIVATE_SMART_LOCK__='333-a100-lock-v2';

var memory={locks:[],state:null,busy:false,error:'',lastEvent:null};
var originalRender=window.renderWxSmartHome;
var originalRolePrompt=window.smartHomeRolePrompt;
var originalRoleFinalize=window.smartHomeRoleFinalize;

function clean(value,max){return String(value==null?'':value).replace(/[<>]/g,'').trim().slice(0,max||160);}
function html(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
function nativeReady(){return !!(window.SmallPhoneNative&&typeof window.SmallPhoneNative.request==='function');}
function config(){
  S.settings=S.settings||{};
  var c=S.settings.smartHomeLock&&typeof S.settings.smartHomeLock==='object'?S.settings.smartHomeLock:(S.settings.smartHomeLock={});
  if(!c.target||typeof c.target!=='object')c.target={accessoryId:'',serviceId:''};
  if(!Array.isArray(c.processedEventIds))c.processedEventIds=[];
  return c;
}
function persist(){try{if(typeof save==='function')save();}catch(_){}}
function target(){var t=config().target;return memory.locks.find(function(x){return String(x.accessoryId||'')===String(t.accessoryId||'')&&String(x.serviceId||'')===String(t.serviceId||'');})||null;}
function remember(lock){if(!lock)return;config().target={accessoryId:String(lock.accessoryId||''),serviceId:String(lock.serviceId||'')};persist();}
function applySnapshot(result){
  if(!result||result.ok!==true||!Array.isArray(result.locks))throw new Error(clean(result&&result.message||'没有取得苹果家庭的门锁状态',220));
  memory.locks=result.locks.filter(function(x){return x&&x.accessoryId&&x.serviceId;});
  var lock=target();
  if(!lock&&memory.locks.length===1){lock=memory.locks[0];remember(lock);}
  memory.state=lock||null;
  if(!memory.locks.length)memory.error='苹果家庭中没有发现可控制的门锁';
  else if(!lock)memory.error='发现多把门锁，请选择要控制的门锁';
  else if(lock.reachable!==true)memory.error='门锁当前离线';
  else if(lock.complete!==true)memory.error='门锁真实状态读取不完整';
  else memory.error='';
  return lock;
}
function rerender(){try{if(typeof cur==='function'&&cur().p==='wxsmarthome'&&typeof render==='function')render();}catch(_){}}
function stateLabel(state){return state==='locked'?'已锁':state==='unlocked'?'已解锁':state==='jammed'?'可能卡住':'状态未知';}
function stateTone(state){return state==='locked'?'locked':state==='unlocked'?'unlocked':'unknown';}
function timeText(value){var d=new Date(value);if(!Number.isFinite(d.getTime()))return'';var pad=function(n){return String(n).padStart(2,'0');};return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());}
function shortTime(value){var d=new Date(value);if(!Number.isFinite(d.getTime()))return'';var pad=function(n){return String(n).padStart(2,'0');};return pad(d.getHours())+':'+pad(d.getMinutes());}
function selectedReady(){var s=memory.state;return !!(s&&s.reachable===true&&s.complete===true&&(s.currentState==='locked'||s.currentState==='unlocked'));}
function lockDisplayName(){var c=config(),s=memory.state;return clean(c.displayName||s&&s.accessoryName||'家庭门锁',20);}
function lockPageNav(title){return '<div class="wx-directory-head wx-smart-home-nav"><div class="wx-real-nav titled"><button onclick="back()">‹</button><b>'+html(title)+'</b><span></span></div></div>';}

async function refresh(quiet){
  if(memory.busy||!nativeReady())return null;
  memory.busy=true;if(!quiet)rerender();
  try{var result=await SmallPhoneNative.request('homekit.locks.snapshot',{});return applySnapshot(result);}
  catch(error){memory.error=clean(error&&error.message||error,220)||'门锁读取失败';if(!quiet&&typeof toast==='function')toast(memory.error);return null;}
  finally{memory.busy=false;rerender();}
}

async function command(action,source){
  if(memory.busy)return{ok:false,verified:false,message:'上一条门锁操作还没有结束'};
  if(!target())await refresh(true);
  var lock=target();
  if(!lock)return{ok:false,verified:false,message:memory.error||'请先选择门锁'};
  if(!nativeReady())return{ok:false,verified:false,message:'当前私人包没有载入 HomeKit 门锁桥'};
  memory.busy=true;rerender();
  try{
    var result=await SmallPhoneNative.request('homekit.lock.command',{accessoryId:String(lock.accessoryId),serviceId:String(lock.serviceId),action:action,source:source||'manual'});
    if(result&&result.state){memory.state=result.state;var i=memory.locks.findIndex(function(x){return x.accessoryId===result.state.accessoryId&&x.serviceId===result.state.serviceId;});if(i>=0)memory.locks[i]=result.state;}
    if(!result||result.ok!==true||result.verified!==true||!result.state)return{ok:false,verified:false,message:clean(result&&result.message||'HomeKit 没有确认门锁真实状态',220),state:result&&result.state};
    memory.error='';return result;
  }catch(error){return{ok:false,verified:false,message:clean(error&&error.message||error,220)||'门锁操作失败'};}
  finally{memory.busy=false;rerender();}
}

function renderLock(){
  var s=memory.state,ready=selectedReady(),disabled=memory.busy||!ready,name=lockDisplayName(),state=s&&s.currentState||'unknown';
  var battery=Number(s&&s.battery),batteryText=Number.isFinite(battery)?Math.max(0,Math.min(100,Math.round(battery)))+'%':'未提供';
  var event=memory.lastEvent,eventText='';
  if(event){eventText=event.timing==='known'?'HomeKit 状态回调：'+timeText(event.eventAt):'恢复时于 '+timeText(event.observedAt)+' 发现状态变化；实际发生时间无法确认';}
  var controls=ready?'<div class="private-lock-actions"><button '+(disabled?'disabled':'')+' onclick="privateSmartLockControl(\'lock\')" class="lock-button '+(state==='locked'?'active':'')+'"><i></i>关锁</button><button '+(disabled?'disabled':'')+' onclick="privateSmartLockControl(\'unlock\')" class="unlock-button '+(state==='unlocked'?'active':'')+'"><i></i>Face ID 解锁</button></div>':'<button class="private-lock-connect" '+(memory.busy?'disabled':'')+' onclick="privateSmartLockRefresh()">读取苹果家庭门锁</button>';
  return '<section class="wx-smart-home-panel private-lock-panel"><header><button class="private-lock-name" onclick="privateSmartLockRename()"><small>HomeKit 安全门锁</small><h2>'+html(name)+'</h2><em>轻触名称修改</em></button><span class="'+(ready?'online':'')+'">'+(ready?'在线':'未就绪')+'</span></header><div class="private-lock-state '+stateTone(state)+'"><div class="private-lock-door"><i></i><span></span></div><div class="private-lock-state-copy"><small>当前状态</small><b>'+html(stateLabel(state))+'</b><em>电量 '+html(batteryText)+'</em></div></div>'+controls+'<div class="private-lock-meta"><span>型号 '+html(s&&s.model||'未提供')+'</span><span>固件 '+html(s&&s.firmware||'未提供')+'</span></div>'+(eventText?'<p class="private-lock-event">'+html(eventText)+'</p>':'')+(memory.error?'<div class="wx-smart-home-error">'+html(memory.error)+'</div>':'')+'<p class="private-lock-safety">“开门”只解锁锁舌，不会把门物理推开。角色关锁后必须回读为“已锁”才算成功；解锁每次都需要你本人通过 Face ID。</p>'+(memory.locks.length>1?'<button class="private-lock-choose" onclick="privateSmartLockChoose()">更换门锁</button>':'')+'</section>';
}

function renderChooser(){
  var state=memory.state&&memory.state.currentState,lockStatus=memory.busy?'正在读取':stateLabel(state||'unknown');
  return lockPageNav('智能家电')+'<div class="scroll wx-smart-home-page private-smart-home-chooser"><section class="private-smart-home-choice-head"><small>MY HOME</small><h1>选择设备</h1><p>每件设备都有自己的控制页面</p></section><div class="private-smart-home-choices"><button class="light-card" onclick="go(\'wxsmarthome\',{device:\'light\'})"><i class="device-shape lamp"><span></span></i><span><b>卧室小灯</b><small>灯光控制</small></span><em>›</em></button><button class="door-card '+stateTone(state||'unknown')+'" onclick="go(\'wxsmarthome\',{device:\'lock\'})"><i class="device-shape door"><span></span></i><span><b>'+html(lockDisplayName())+'</b><small>'+html(lockStatus)+'</small></span><em>›</em></button></div></div>';
}
function renderLockPage(){return lockPageNav('智能门锁')+'<div class="scroll wx-smart-home-page private-lock-page">'+renderLock()+'<p class="wx-smart-home-foot">私人版直接使用 iPhone 的家庭权限，不依赖电脑。</p></div>';}

function choose(){if(!memory.locks.length){if(typeof toast==='function')toast('请先读取苹果家庭门锁');return;}if(typeof openModal!=='function')return;openModal('<h3>选择要控制的门锁</h3><div class="hint">这里只保存 HomeKit 设备标识，不保存密码、指纹或配对码。</div>'+memory.locks.map(function(x,i){return'<button class="btn g" style="margin-top:8px" onclick="privateSmartLockChooseAt('+i+')">'+html(x.homeName||'家庭')+' · '+html(x.accessoryName||x.serviceName||'门锁')+'</button>';}).join('')+'<div class="btns"><button class="btn g" onclick="closeModal()">取消</button></div>');}
function rename(){if(typeof openModal!=='function')return;openModal('<h3>设置门锁名称</h3><div class="hint">这个名称只用于小手机显示，不会修改苹果家庭里的名称。</div><input id="privateLockNameInput" maxlength="20" value="'+html(lockDisplayName())+'" placeholder="门锁名称"><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="privateSmartLockSaveName()">保存</button></div>');}

function eventKnownText(event){
  var happened=timeText(event.eventAt),noticed=timeText(new Date().toISOString()),delay=Math.max(0,Date.now()-new Date(event.eventAt).getTime());
  return '门锁「'+clean(event.accessoryName||'家庭门锁',40)+'」在 '+happened+' 由 HomeKit 报告为“'+stateLabel(event.currentState)+'”。本轮补同步发起时间是 '+noticed+'。'+(delay>=60000?'这是延迟补上的事件；原始 HomeKit 报告时间是 '+shortTime(event.eventAt)+'，当前时间只是补同步时间。':'这是刚收到的状态变化。')+'HomeKit 回调时间不是独立门锁日志证明的物理操作瞬间。'+(event.currentState==='unlocked'?'用户已经明确约定：没有相反证据时，默认视为用户本人开的门；这是用户指定的默认归因，不是 HomeKit 识别出的操作者身份。':'HomeKit 没有提供具体操作人的身份。');
}
function eventUnknownText(event){
  return '小手机在 '+timeText(event.observedAt)+' 恢复连接时发现门锁「'+clean(event.accessoryName||'家庭门锁',40)+'」已经变为“'+stateLabel(event.currentState)+'”。标准 HomeKit 当前状态没有给出这次变化实际发生的历史时间，因此实际'+(event.currentState==='unlocked'?'解锁':'关锁')+'时间无法确认；'+shortTime(event.observedAt)+' 只是恢复观察时间，不是实际发生时间。'+(event.currentState==='unlocked'?'用户已经明确约定：没有相反证据时，默认视为用户本人开的门；这是用户指定的默认归因，不是 HomeKit 识别出的操作者身份。':'HomeKit 没有提供具体操作人的身份。');
}
async function acknowledge(eventId){try{await SmallPhoneNative.request('homekit.locks.events.ack',{eventIds:[eventId]});}catch(_){}}
function roleForEvent(){try{var id=S&&S.couple&&S.couple.cid,c=id&&typeof getC==='function'&&getC(id);return c&&!c.deleted&&!c.blocked?c:null;}catch(_){return null;}}
function seen(eventId){return config().processedEventIds.indexOf(eventId)>=0;}
function markSeen(eventId){var c=config();if(c.processedEventIds.indexOf(eventId)<0)c.processedEventIds.push(eventId);c.processedEventIds=c.processedEventIds.slice(-100);persist();}
async function processEvent(event){
  if(!event||!event.eventId||seen(event.eventId))return false;
  memory.lastEvent=event;rerender();
  var role=roleForEvent();
  if(!role||typeof scheduleFeatureReply!=='function'||typeof featureEventNote!=='function')return false;
  var detail=event.timing==='known'?eventKnownText(event):eventUnknownText(event);
  var note=featureEventNote('真实门锁状态变化',detail+'\n请按你本人性格自然回应这个真实事件；不要像系统播报，不要假装看到了操作过程，也不要重新回答旧聊天。');
  var queued=scheduleFeatureReply(role.id,note,120);
  if(!queued)return false;
  markSeen(event.eventId);await acknowledge(event.eventId);return true;
}
async function drainEvents(){if(!nativeReady())return;try{var result=await SmallPhoneNative.request('homekit.locks.events',{}),events=result&&Array.isArray(result.events)?result.events:[];for(var i=0;i<events.length;i++)await processEvent(events[i]);}catch(_){}}

function lockTags(content){return String(content||'').match(/[\[【]\s*智能家电\s*[|｜:：]\s*门锁\s*[|｜:：][^\]】]+[\]】]/g)||[];}
function stripLockTags(content){return String(content||'').replace(/[\[【]\s*智能家电\s*[|｜:：]\s*门锁\s*[|｜:：][^\]】]+[\]】]/g,'').replace(/\n{3,}/g,'\n\n').trim();}
function lockDecision(content,c){
  var tags=lockTags(content);if(!tags.length)return null;
  if(!(c&&S&&S.couple&&S.couple.cid===c.id))return{valid:false,message:'当前角色没有绑定门锁控制权限'};
  if(tags.length!==1||/[\[【]\s*智能家电\s*[|｜:：]\s*小灯\s*[|｜:：]/.test(String(content||'')))return{valid:false,message:'一轮只能选择一种智能家电动作，未执行'};
  var body=tags[0].replace(/^[\[【]|[\]】]$/g,'').split(/[|｜]/).slice(2),action='';
  if(body.length!==1)return{valid:false,message:'门锁动作参数不完整，未执行'};
  var match=String(body[0]).trim().match(/^action\s*=\s*(lock|unlock)$/i);if(!match)return{valid:false,message:'门锁动作不在安全白名单中，未执行'};
  action=match[1].toLowerCase();return{valid:true,action:action};
}
function falseLockSuccess(text){var t=String(text||'').replace(/[\[【][^\]】]*[\]】]/g,'');if(/(?:没|没有|未|不能|失败|无法|不确定|不能确认)/.test(t))return false;return /(?:已经|已|现在|给你|我把).{0,14}(?:锁上|锁好|关锁|解锁|开门|打开门)/.test(t);}
function oppositeClaim(text,state){var t=String(text||'');return state==='locked'&&/(?:解锁了|门开了|打开门了|已经开门)/.test(t)||state==='unlocked'&&/(?:锁上了|锁好了|已经关锁|门已锁)/.test(t);}

window.renderWxSmartHome=function(){var route=typeof cur==='function'?cur():null,device=route&&route.device;if(device==='light')return typeof originalRender==='function'?originalRender():'';if(device==='lock')return renderLockPage();return renderChooser();};
window.smartHomeRolePrompt=function(c){
  var base=typeof originalRolePrompt==='function'?originalRolePrompt(c):'';
  if(!(c&&S&&S.couple&&S.couple.cid===c.id&&selectedReady()))return base;
  var s=memory.state,name=lockDisplayName(),status=stateLabel(s.currentState);
  return base+'\n\n# 真实家庭门锁（私人版，由你自主决定）\n你可以控制「'+name+'」，当前由 HomeKit 刚回读的真实状态是“'+status+'”。'+clean(S.me&&S.me.name||'对方',30)+'说“关锁、锁门、开门、解锁”只是向你提出请求，不是关键词强制命令；是否同意由你按本人性格和上下文决定。拒绝时只自然回复，不输出动作标签。\n你决定关锁时，只能额外单独输出一行：[智能家电|门锁|action=lock]。你决定解锁或“开门”时，只能输出：[智能家电|门锁|action=unlock]；这里的开门只表示解锁锁舌，不会物理推开门，并且必须由'+clean(S.me&&S.me.name||'对方',30)+'在这台 iPhone 上亲自通过 Face ID，失败就不会解锁。每轮最多一个门锁或小灯动作，不能混合。\n第一版动作回复不会展示。程序只在真实锁态回读一致后让你生成最终回复；离线、状态未知、Face ID 失败、写入失败或回读不一致时，绝不能说已经锁好、解锁或开门。不要解释标签、系统或内部规则。';
};
window.smartHomeRoleFinalize=async function(content,c,userText,replyFactory){
  var decision=lockDecision(content,c);if(!decision)return typeof originalRoleFinalize==='function'?originalRoleFinalize(content,c,userText,replyFactory):{content:content,matched:false};
  var outcome=decision.valid?await command(decision.action,'role').catch(function(error){return{ok:false,verified:false,message:clean(error&&error.message||error,220)};}):{ok:false,verified:false,message:decision.message};
  var verified=!!(outcome&&outcome.ok===true&&outcome.verified===true&&outcome.state),base=stripLockTags(content),state=outcome&&outcome.state&&outcome.state.currentState;
  var fact=verified?'HomeKit 已重新读取门锁并确认成功；最终真实状态是“'+stateLabel(state)+'”，验证时间 '+timeText(outcome.verifiedAt||outcome.state.readAt)+'.': 'HomeKit 没有确认门锁成功；原因：'+clean(outcome&&outcome.message||'真实状态回读失败',220)+'。即使门锁看起来变化了，也不能声称完成。';
  var prompt='[真实门锁执行结果｜只供你生成本轮最终回复]\n你上一版自主决定'+(decision.action==='unlock'?'解锁':'关锁')+'，但那一版不会展示。'+fact+'\n现在仍以你本人身份，根据真实结果和对方原话自然回复1到3条短消息。'+(verified?'只能按最终真实锁态准确回应。':'必须如实说这次没有确认成功，绝不能说已经锁好、解锁或开门。')+'不要再次输出任何智能家电标签，不要解释程序、系统、Face ID规则或回读过程。对方原话：'+String(userText||'').slice(0,500);
  var final='';for(var attempt=0;attempt<2;attempt++){try{final=typeof roleVisibleEnvelopeText==='function'?roleVisibleEnvelopeText(await replyFactory(prompt+(attempt?'\n上一版仍与真实门锁结果冲突，只按上面的真实状态重写。':''))):String(await replyFactory(prompt)||'');}catch(_){final='';}final=stripLockTags(final);if(final&&(verified?!oppositeClaim(final,state):!falseLockSuccess(final)))break;final='';}
  if(!final&&verified&&!oppositeClaim(base,state))final=base;
  if(!final&&typeof toast==='function')toast(verified?'角色最终门锁描述与真实状态不一致，本轮未显示错误回复':'门锁操作未确认：'+clean(outcome&&outcome.message||'真实状态读取失败',160));
  return{content:final,matched:true,verified:verified,outcome:outcome,decision:decision};
};

window.privateSmartLockRefresh=function(){return refresh(false).then(function(lock){if(lock&&typeof toast==='function')toast('已读取门锁真实状态');return drainEvents();});};
window.privateSmartLockControl=async function(action){var result=await command(action,'manual');if(typeof toast==='function')toast(result.verified?(action==='lock'?'已回读确认门锁已锁':'Face ID 已通过，门锁已回读为解锁'):result.message);return result;};
window.privateSmartLockChoose=choose;
window.privateSmartLockRename=rename;
window.privateSmartLockSaveName=function(){var input=document.getElementById&&document.getElementById('privateLockNameInput'),name=clean(input&&input.value||'',20);if(!name){if(typeof toast==='function')toast('请输入门锁名称');return;}config().displayName=name;persist();if(typeof closeModal==='function')closeModal();rerender();if(typeof toast==='function')toast('门锁名称已保存');};
window.privateSmartLockChooseAt=function(index){var lock=memory.locks[Math.max(0,Math.floor(Number(index)||0))];if(!lock)return;remember(lock);memory.state=lock;memory.error=lock.reachable===true&&lock.complete===true?'':lock.reachable!==true?'门锁当前离线':'门锁真实状态读取不完整';if(typeof closeModal==='function')closeModal();rerender();if(typeof toast==='function')toast(memory.error||'门锁已选择并读取真实状态');};
window.__privateSmartLockTest={applySnapshot:applySnapshot,processEvent:processEvent,lockDecision:lockDecision,eventKnownText:eventKnownText,eventUnknownText:eventUnknownText,renderChooser:renderChooser,renderLockPage:renderLockPage,lockDisplayName:lockDisplayName,memory:memory};

if(typeof window.addEventListener==='function'){
  window.addEventListener('small-phone-homekit-lock-event',function(event){processEvent(event&&event.detail);});
  window.addEventListener('small-phone-native-ready',function(){refresh(true).then(drainEvents);});
  window.addEventListener('pageshow',function(){refresh(true).then(drainEvents);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh(true).then(drainEvents);});
}
setTimeout(function(){refresh(true).then(drainEvents);},1500);
setInterval(function(){if(!document.hidden)refresh(true).then(drainEvents);},20000);
})();
