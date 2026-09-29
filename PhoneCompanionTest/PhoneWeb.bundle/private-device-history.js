/* Private, bounded device operation ledger. Never infer execution from chat text. */
(function(){
'use strict';
if(window.__SMALL_PHONE_PRIVATE__!==true||window.DeviceHistory)return;
const LIMIT=100,states={sending:'正在发送',sent:'已发送',received:'设备已接收',verified:'已确认成功',failed:'未成功',unknown:'结果未确认',superseded:'后续指令已接管'};
const icons={history:'<path d="M3.5 10a8.5 8.5 0 1 1 .6 6M3.5 4.5V10H9"/><path d="M12 7v5l3 2"/>',light:'<path d="M9 17v-1.5a6 6 0 1 1 6 0V17M9 20h6M10 23h4M9 17h6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',air:'<rect x="3" y="4" width="18" height="10" rx="3"/><path d="M6 10h12M7 17v3M12 17v4M17 17v3"/>',k:'<rect x="3" y="4" width="18" height="16" rx="5"/><path d="M7 10h3M14 10h3M11 15h2"/>'};
function svg(kind){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[kind]||icons.history)+'</svg>';}
function text(v,n=160){return String(v==null?'':v).slice(0,n);}
function errorText(v){return text(v,1000).replace(/Bearer\s+\S+/gi,'Bearer [已隐藏]').replace(/https?:\/\/\S+/gi,'[服务地址已隐藏]').replace(/((?:password|token|secret|owner_secret|device_secret|配对码|密码)\s*[:=]\s*)[^\s,;}]+/gi,'$1[已隐藏]').replace(/[A-Za-z0-9_-]{32,}/g,'[敏感标识已隐藏]').slice(0,240);}
function escape(v){return text(v,1000).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function scope(){return String(S.settings?.cloudId||'local')+':'+(typeof actId==='function'?actId():'main');}
function store(){S.settings=S.settings||{};if(!Array.isArray(S.settings.deviceOperationHistory))S.settings.deviceOperationHistory=[];else S.settings.deviceOperationHistory=S.settings.deviceOperationHistory.filter(x=>x&&typeof x==='object'&&Number.isFinite(x.time)&&['k','home'].includes(x.group));return S.settings.deviceOperationHistory;}
function persist(){try{if(typeof save==='function')save();}catch(_){} }
function begin(group,data){
 try{
  const account=scope(),list=store(),entry={id:'op-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),group:group==='k'?'k':'home',scope:account,time:Date.now(),kind:text(data.kind||'k',12),actor:text(data.actor||'手动操作',50),roleId:text(data.roleId,128),action:text(data.action),status:'sending',detail:'',bindingId:text(data.bindingId,128),messageId:text(data.messageId,128),sequence:null};
  list.unshift(entry);
  let count=0;S.settings.deviceOperationHistory=list.filter(x=>x.scope!==account||x.group!==entry.group||++count<=LIMIT);
  persist();paint();return {entry,settings:S.settings,scope:account};
 }catch(_){return null;}
}
function finish(handle,status,detail,sequence,diagnostic){
 try{
  if(!handle||handle.settings!==S.settings||handle.scope!==scope()||!store().includes(handle.entry))return;
  Object.assign(handle.entry,{status:states[status]?status:'unknown',detail:errorText(detail),updatedAt:Date.now()});
  if(diagnostic){handle.entry.stage=text(diagnostic.stage,60);handle.entry.code=text(diagnostic.code,80);}
  if(Number.isSafeInteger(sequence)&&sequence>0)handle.entry.sequence=sequence;
  persist();paint();
 }catch(_){}
}
function rows(group){const list=store().filter(x=>x.scope===scope()&&x.group===group).slice(0,LIMIT);let changed=false;for(const row of list)if(['sending','sent'].includes(row.status)&&Date.now()-row.time>45000){row.detail=row.status==='sending'?'操作未获得最终结果；可能在等待时退出页面或中断。':'未取得独立设备接收回执，不能判断实际播放结果。';row.status='unknown';changed=true;}if(changed)persist();return list;}
function acknowledge(bindingId,accepted){
 if(!Number.isSafeInteger(accepted)||accepted<=0)return;
 let changed=false;
 for(const row of rows('k'))if(row.bindingId===bindingId&&row.sequence===accepted&&['sent','unknown'].includes(row.status)){row.status='received';row.detail='设备已报告接收此序号；不是屏幕逐帧播放证明。';row.updatedAt=Date.now();changed=true;}
 if(changed){persist();paint();}
}
function mergeRobot(items){
 const account=scope(),list=store();
 for(const item of items.slice(0,LIMIT)){
  if(!item||!Number.isFinite(item.time)||!['sent','received','failed'].includes(item.status)||typeof item.bindingId!=='string'||typeof item.messageId!=='string')continue;
  const found=list.find(x=>x.group==='k'&&x.scope===account&&x.bindingId===item.bindingId&&x.messageId===item.messageId);
  const role=typeof getC==='function'?getC(item.roleId):null,label=typeof ROBOT_FACE_CHOICES!=='undefined'?ROBOT_FACE_CHOICES.find(x=>x[0]===item.emotion)?.[1]:item.emotion;
  const status=item.status==='sent'&&Date.now()-item.time>45000?'unknown':item.status;
  const detail=item.status==='failed'?(typeof robotFaceReason==='function'?robotFaceReason(item.reason):'云端拒绝指令'):status==='received'?'设备已经确认接收此序号；不代表屏幕逐帧播放证明。':status==='unknown'?'云端已接受，但没有保存到此序号的独立设备回执。':'云端已接受，等待设备接收。';
  if(found){if(found.status==='received')continue;Object.assign(found,{status,detail,code:text(item.reason,80),stage:'云端操作记录',sequence:item.sequence});}
  else list.push({id:'cloud-'+text(item.id,64),group:'k',scope:account,time:item.time,kind:'k',actor:item.messageId.startsWith('manual:')?'手动测试':text(role?.remark||role?.name||'角色',50),roleId:text(item.roleId,128),bindingId:text(item.bindingId,128),messageId:text(item.messageId,128),sequence:item.sequence,action:'显示'+text(label||item.emotion,20)+'表情',status,detail,stage:'云端操作记录',code:text(item.reason,80)});
 }
 let count=0;S.settings.deviceOperationHistory=list.sort((a,b)=>b.time-a.time).filter(x=>x.scope!==account||x.group!=='k'||++count<=LIMIT);persist();paint();
}
function time(value){return new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});}
function listHTML(group){
 const items=rows(group);
 if(!items.length)return '<div class="dh-empty">'+svg('history')+'<h3>还没有操作记录</h3><p>从本次更新开始记录真实操作。<br>角色只说“做了”，不会产生成功记录。</p></div>';
 return items.map(row=>'<details class="dh-row" data-operation="'+escape(row.id)+'"><summary><span class="dh-icon">'+svg(row.kind)+'</span><span class="dh-summary"><b>'+escape(row.action)+'</b><small>'+escape(row.actor)+' · '+escape(time(row.time))+'</small></span><span class="dh-state '+escape(row.status)+'">'+escape(states[row.status]||states.unknown)+'</span><span class="dh-chevron">⌄</span></summary><div class="dh-detail"><dl><dt>操作来源</dt><dd>'+escape(row.actor)+'</dd><dt>设备</dt><dd>'+escape({k:'小 K',light:'小灯',lock:'门锁',air:'空调'}[row.kind]||'设备')+'</dd><dt>发起时间</dt><dd>'+escape(time(row.time))+'</dd><dt>执行结果</dt><dd>'+escape(states[row.status]||states.unknown)+'</dd>'+(row.stage?'<dt>处理环节</dt><dd>'+escape(row.stage)+'</dd>':'')+(row.code?'<dt>返回代码</dt><dd>'+escape(row.code)+'</dd>':'')+'</dl><p>'+escape(row.detail||'正在等待执行结果；尚未确认成功。')+'</p></div></details>').join('');
}
function style(){return `<style>
.dh-page,.dh-block{color:#ededed;background:#000;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.dh-page{height:100%;overflow-y:auto;padding:16px 20px 36px;box-sizing:border-box}.dh-page *,.dh-block *{box-sizing:border-box}.dh-top{display:flex;justify-content:space-between;align-items:center;color:#aaa;font-size:10px;letter-spacing:2px}.dh-top button{background:none!important;color:#eee!important;border:0;padding:10px 0;min-height:44px;font-size:15px;letter-spacing:0}.dh-hero{padding:30px 0 24px}.dh-hero>svg{width:34px;height:34px;color:#d9d9d9;margin-bottom:12px}.dh-hero h1{font-size:27px;letter-spacing:1px;margin:0 0 8px}.dh-hero p,.dh-note{font-size:12px;color:#929292;margin:0;line-height:1.8}.dh-count{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#888;padding:0 0 12px;letter-spacing:1px}.dh-row{border:1px solid #292929;background:#101010;border-radius:17px;margin-bottom:10px;overflow:hidden}.dh-row summary{display:flex;align-items:center;gap:11px;padding:16px 13px;cursor:pointer;list-style:none;min-height:80px}.dh-row summary::-webkit-details-marker{display:none}.dh-icon{flex:none;width:34px;height:38px;display:grid;place-items:center;color:#d2d2d2}.dh-icon svg{width:25px;height:25px}.dh-summary{flex:1;min-width:0}.dh-summary b{display:block;font-size:14px;font-weight:550;overflow-wrap:anywhere}.dh-summary small{display:block;font-size:10px;color:#888;margin-top:5px;overflow-wrap:anywhere}.dh-state{max-width:76px;font-size:10px;color:#b4b4b4;white-space:normal;text-align:right}.dh-state.received,.dh-state.verified{color:#81cea0}.dh-state.failed{color:#e29b98}.dh-state.sending,.dh-state.sent{color:#c2b38a}.dh-chevron{font-size:15px;color:#777;transition:transform .15s}.dh-row[open] .dh-chevron{transform:rotate(180deg)}.dh-detail{padding:0 18px 18px;border-top:1px solid #242424}.dh-detail dl{display:grid;grid-template-columns:70px minmax(0,1fr);gap:10px;margin:16px 0;font-size:12px}.dh-detail dt{color:#888}.dh-detail dd{margin:0;text-align:right;overflow-wrap:anywhere}.dh-detail p{color:#aaa;font-size:12px;line-height:1.8;margin:0;padding-top:12px;border-top:1px solid #242424;overflow-wrap:anywhere}.dh-empty{text-align:center;padding:52px 12px;color:#999}.dh-empty svg{width:38px;height:38px}.dh-empty h3{color:#ddd;font-size:16px;font-weight:500}.dh-empty p{font-size:12px;line-height:1.9}.dh-entry{display:flex!important;align-items:center;gap:13px;width:100%;background:#111!important;color:#eee!important;border:1px solid #303030!important;border-radius:18px;padding:18px!important;text-align:left;margin:16px 0}.dh-entry svg{width:26px;height:26px;flex-shrink:0}.dh-entry b{display:block;font-size:15px}.dh-entry small{display:block;font-size:11px;color:#999;margin-top:4px}.dh-entry em{margin-left:auto;font-style:normal;color:#888}.dh-refresh{background:#202020;color:#eee;border:1px solid #333;border-radius:10px;padding:9px 12px;margin-bottom:14px;min-height:44px}
</style>`;}
function block(group){return style()+'<section class="dh-block" data-history-group="'+group+'"><div class="dh-count"><span>最近操作</span><span data-history-count>'+rows(group).length+' / 100</span></div><div data-history-list>'+listHTML(group)+'</div><p class="dh-note">最多保留最近 100 条 · 点击记录展开详情</p></section>';}
function homePage(){return style()+'<section class="dh-page" aria-label="智能家居操作记录"><header class="dh-top"><button onclick="back()">‹ 智能家居</button><span>HOME ACTIVITY</span></header><div class="dh-hero">'+svg('history')+'<h1>操作记录</h1><p>小灯、门锁、空调 · 一个时间线<br>仅记录本小手机发起的操作，不是厂商完整日志。</p></div>'+block('home')+'</section>';}
function paint(){try{document.querySelectorAll('[data-history-group]').forEach(el=>{const group=el.dataset.historyGroup,open=new Set(Array.from(el.querySelectorAll('details[open]')).map(x=>x.dataset.operation));el.querySelector('[data-history-list]').innerHTML=listHTML(group);el.querySelector('[data-history-count]').textContent=rows(group).length+' / 100';el.querySelectorAll('details').forEach(x=>{x.open=open.has(x.dataset.operation);});});}catch(_){} }
function describe(kind,plan){
 const p=plan||{},parts=[];
 if(kind==='lock')return p.action==='unlock'?'解锁门锁（需 Face ID）':p.action==='lock'?'关闭门锁':'门锁操作';
 if(p.power!==undefined)parts.push(p.power===true||p.power==='on'?'打开'+(kind==='air'?'空调':'小灯'):'关闭'+(kind==='air'?'空调':'小灯'));
 if(p.mode)parts.push(({cool:'制冷',heat:'制热',auto:'自动',off:'关闭'})[p.mode]||'切换模式');
 if(p.temperature!=null)parts.push('温度 '+text(p.temperature,8)+'℃');
 if(p.brightness!=null)parts.push('亮度 '+text(p.brightness,8)+'%');
 if(p.color)parts.push('灯光颜色 '+text(({red:'红色',blue:'蓝色',green:'绿色',pink:'粉色',purple:'紫色',white:'白色',yellow:'黄色'})[p.color]||p.color,20));
 if(p.fan!=null)parts.push('风速 '+text(p.fan,8)+'%');
 return parts.join(' · ')||(kind==='air'?'调整空调':'调整小灯');
}
function result(handle,outcome){const verified=!!(outcome?.ok===true&&outcome.verified===true&&outcome.state);finish(handle,verified?'verified':'failed',verified?'HomeKit 已重新读取并确认操作后的真实状态。':text(outcome?.message||'设备接口没有返回失败原因；原因未确认，不能认定成功。',240),null,{stage:'设备执行与真实状态回读',code:/^[\w.-]{1,80}$/.test(outcome?.code||'')?outcome.code:verified?'verified':'未提供错误码'});}
function failure(handle,error,stage){finish(handle,'unknown','实际异常：'+errorText(error?.message||error||'接口未提供原因')+'；没有取得最终设备回读。',null,{stage,code:/^[\w.-]{1,80}$/.test(error?.code||'')?error.code:'未提供错误码'});}
window.DeviceHistory={begin,finish,acknowledge,rows,block,svg,paint,describe,result,errorText,mergeRobot};
// A wrapper observes existing results only. It neither changes decisions nor bypasses safety.
const oldFinalize=window.smartHomeRoleFinalize;
if(typeof oldFinalize==='function')window.smartHomeRoleFinalize=async function(content,c,...args){
 const kind=/[\[【]\s*智能家电\s*[|｜:：]\s*空调/.test(content)?'air':/[\[【]\s*智能家电\s*[|｜:：]\s*门锁/.test(content)?'lock':/[\[【]\s*智能家电\s*[|｜:：]\s*小灯/.test(content)?'light':null;
 const handle=kind?begin('home',{kind,actor:c?.remark||c?.name||'角色',roleId:c?.id,action:{air:'角色调整空调',lock:'角色操作门锁',light:'角色调整小灯'}[kind]}):null;
 try{const value=await oldFinalize.call(this,content,c,...args);if(handle){if(value?.matched){handle.entry.action=describe(kind,value.decision?.plan||value.decision);if(value.decision?.valid===false)finish(handle,'failed',value.outcome?.message||value.decision.message,null,{stage:'执行前权限与参数校验',code:'policy-rejected'});else result(handle,value.outcome);}else finish(handle,'failed','没有形成可执行的设备操作。');}return value;}
 catch(error){failure(handle,error,'角色操作执行');throw error;}
};
const manual={wxSmartHomeControl:['light',p=>describe('light',p)],wxSmartHomeBrightness:['light',v=>'亮度 '+v+'%'],wxSmartHomeColor:['light',v=>describe('light',{color:v})],privateSmartLockControl:['lock',v=>describe('lock',{action:v})],privateSmartAirPower:['air',v=>describe('air',{power:v})],privateSmartAirMode:['air',v=>describe('air',{mode:v})],privateSmartAirTemperature:['air',v=>v<0?'调低空调温度':'调高空调温度'],privateSmartAirFan:['air',v=>v<0?'调低空调风速':'调高空调风速']};
Object.entries(manual).forEach(([name,[kind,label]])=>{const original=window[name];if(typeof original!=='function')return;window[name]=async function(...args){const handle=begin('home',{kind,actor:'手动操作',action:label(args[0])});try{const out=await original.apply(this,args);result(handle,out);return out;}catch(error){failure(handle,error,'手动操作执行');throw error;}};});
const oldRender=window.renderWxSmartHome;
if(typeof oldRender==='function')window.renderWxSmartHome=function(...args){const route=typeof cur==='function'?cur():null;if(route?.device==='history')return homePage();const body=oldRender.apply(this,args);if(route?.device)return body;return body.replace(/<\/div><\/div>$/, '</div>'+style()+'<button class="dh-entry" onclick="go(\'wxsmarthome\',{device:\'history\'})">'+svg('history')+'<span><b>操作记录</b><small>小灯 · 门锁 · 空调，统一查看</small></span><em>›</em></button></div>');};
})();
