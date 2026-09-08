/* Public North adapter. Private native paths, secrets and snapshots stay separate. */
window.NorthPublicRuntime=(()=>{
 'use strict';
 const config={url:'https://lkhlyfpssmrjkkzhuzag.supabase.co',key:'sb_publishable_uKytf2Tc_FmLv15SkkJyCQ_VU8IRSt2'};
 const available=()=>typeof NorthPublicPolicy!=='undefined'&&!privateNativeAppOn();
 function state(){
  if(!S.couple)return null;const cp=S.couple,id=String(cp.cid||''),slot=actId()+':'+id;
  cp.publicNorthByRole=cp.publicNorthByRole||{};
  let st=cp.publicNorthByRole[slot];
  if(!st||st.schema!==1)st=cp.publicNorthByRole[slot]={...companionDefaultState(),schema:1,roleId:id,backgroundConsent:{},publicFacts:null};
  st.demo=false;st.transport='public-north';st.defaultScope='external';st.readScope='external';
  st.automations={eveningScreen:true,absenceBattery:false,criticalBattery:false,...st.automations,morningSleep:false,emotionCare:false,manualUnlockAlert:false};
  return st;
 }
 function profile(){
  if(!S.couple?.cid)throw Error('请先绑定情侣空间角色');
  const key='north-public-controller.v1:'+cloudId()+':'+actId()+':'+S.couple.cid;
  let p;try{p=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
  if(!p||!/^yb_[a-z0-9]{20,96}$/.test(p.target)||typeof p.ownerSecret!=='string'||p.ownerSecret.length<32){
   const hex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
   p={schema:1,target:'yb_'+hex(20),ownerSecret:hex(32),roleName:String(getC(S.couple.cid)?.name||'我的角色')};localStorage.setItem(key,JSON.stringify(p));
  }
  return p;
 }
 async function rpc(name,args){
  if(!/^phone_(companion|role)_/.test(name))throw Error('不支持的公开接口');
  if(name.startsWith('phone_role_')){
   const st=state(),id=args?.p_role_id||args?.p_profile?.roleId;
   if(!st?.linked)return false;
   if(!['phone_role_push_history','phone_role_push_status'].includes(name)&&!(id?st.backgroundConsent[id]:Object.values(st.backgroundConsent).some(Boolean)))return false;
  }
  const p=profile(),body={...args,p_target:p.target,p_owner_secret:p.ownerSecret};
  const r=await fetchT(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(body)},25000);
  const raw=await r.text();let data;try{data=JSON.parse(raw);}catch(_){throw Error('公开 North 返回格式异常');}
  if(!r.ok)throw Error(String(data?.message||data?.error||'公开 North 请求失败').slice(0,180));return data;
 }
 function apply(st,data){
  if(!data||typeof data.linked!=='boolean')return false;
  const facts=NorthPublicPolicy.normalize(data);
  // Command receipts can advance without a new telemetry snapshot.
  for(const row of Array.isArray(data.commands)?data.commands:[]){const item=st.commands.find(x=>x.serverId===row.id);if(item){item.status=row.status||item.status;item.result=row.result;item.acknowledgedAt=companionTime(row.acknowledgedAt);}}
  if(!NorthPublicPolicy.canReplace(st.publicFacts,facts))return false;
  if(facts.controlOnly&&st.publicFacts?.linked){const old=st.publicFacts;
   if(!facts.screen.available)facts.screen={...old.screen,apps:old.screen.apps.map(a=>({...a,...facts.screen.apps.find(b=>b.id===a.id),usedSeconds:a.usedSeconds})),fresh:false};
   for(const key of ['battery','health','location'])if(!facts[key])facts[key]=old[key];
   if(!facts.footprints.length)facts.footprints=old.footprints;
  }
  const oldApps=new Map(st.apps.map(a=>[a.id,a]));
  st.publicFacts=facts;st.linked=facts.linked;st.deviceId=facts.deviceId;st.deviceName=facts.deviceName||'North iPhone';st.lastSync=facts.uploadedAt||facts.generatedAt;
  st.screenTimeAvailable=facts.screen.available&&facts.screen.totalSeconds!==null;st.screenTimeSec=facts.screen.totalSeconds;st.screenTimeMode=st.screenTimeAvailable?'per_app':'total_only';
  st.usageGeneratedAt=facts.screen.generatedAt;st.usageDay=facts.screen.usageDay;st.usageTimeZone='';st.dynamicSync=facts.generatedAt;
  st.apps=facts.screen.apps.map(a=>({...a,name:a.name||oldApps.get(a.id)?.name||('App '+a.bindingCode),usedSec:a.usedSeconds,limitMin:a.limitMinutes,reportedLocked:a.locked===true,locked:a.locked===true}));
  st.battery=facts.battery?{...facts.battery,ts:facts.battery.generatedAt}:null;
  st.health=facts.health?{steps:facts.health.availability==='reported'?facts.health.steps:null,ts:facts.health.generatedAt,source:'HealthKit 步数'}:null;
  st.location=facts.location?{...facts.location,ts:facts.location.generatedAt}:null;st.footprints=facts.footprints.map(x=>({...x,ts:x.generatedAt}));
  if(!facts.linked){st.bindings=[];st.roleAccess=false;st.backgroundConsent={};}
  companionApplyHomeLocation(st);return true;
 }
 function prompt(c){
  const st=state();if(!st||!c||String(c.id)!==st.roleId)return '';
  let out=NorthPublicPolicy.prompt(st.publicFacts,st);
  if(!out||!st.linked)return out;
  if(st.permissions.appControl)out+='\n真实手机动作必须单独一行：[锁定|准确App名称|仅外置] 或 [解锁|准确App名称|仅外置]。只能对已经同步的 App 操作，多个 App 逐一列名，不能把“这些”擅自扩大为全部。命令排队不是设备执行成功。';
  if(st.permissions.limits)out+='\n每日限额使用 [限时|准确App名称|30|内外同时]；必须先在页面明确关联，实际时长与限额分别说明，不能将两端使用相加。';
  if(st.permissions.location)out+='\n可以用 [伴生刷新定位] 请求更新；新结果返回前不能声称已经知道新位置。';
  return out;
 }
 function renderPage(c,SEC,HD){
  const st=state(),template=document.createElement('template');
  template.innerHTML=renderCompanionPageCore(c,SEC,HD).replaceAll('查看 Apple Watch / 健康摘要','查看步数').replaceAll('外置 iPhone 今日概览','North 最近报告').replaceAll('今日足迹','已返回足迹');
  template.content.querySelectorAll('[onclick*="companionLoadDemo"],[onclick*="companionClearDemo"]').forEach(e=>e.remove());
  const facts=st.publicFacts,fmt=v=>v?fmtDT(v):'未知',section=(id,title,body)=>`<div id="${id}" ${SEC}>${HD('phone',title,'#9ec5fe')}${body}</div>`;
  let html=template.innerHTML;
  const wellness=section('cou_companion_wellness','电量与步数',`<div class="it"><span>iPhone 电量</span><span class="v">${facts?.battery?Math.round(facts.battery.level*100)+'%':'尚未返回'}</span></div><div class="it"><span>设备步数报告</span><span class="v">${facts?.health?.availability==='reported'?facts.health.steps+' 步':'尚不能确认'}</span></div><div class="hint" style="padding:12px">屏幕报告采集：${esc(fmt(facts?.screen?.generatedAt))}。公开 App 未提供报告所属日和时区，因此不会把旧报告冒充今天；步数 0 在当前公开版也可能表示没有取得数据。</div>`);
  const auto=section('cou_companion_automations','角色主动查看规则',`<div class="hint" style="padding:12px">按授权读取公开 North 实际支持的数据。关闭网页后由服务器执行；iOS 是否及时上传新数据和显示通知仍取决于系统权限与调度。</div><div class="it"><span>每天查看屏幕报告</span><span class="sw ${st.automations.eveningScreen?'on':''}" onclick="NorthPublicRuntime.toggleAutomation('eveningScreen')"></span></div><div class="it"><span>查看开始<input id="comp_auto_usage_start" type="time" value="${st.automationWindows.usageStart}"></span><span>结束<input id="comp_auto_usage_end" type="time" value="${st.automationWindows.usageEnd}"></span><button class="minibtn" onclick="NorthPublicRuntime.saveWindows()">保存</button></div>${[['absenceBattery','长时间未回时查看电量与位置'],['criticalBattery','新鲜数据确认低电量时提醒']].map(([k,label])=>`<div class="it"><span>${label}</span><span class="sw ${st.automations[k]?'on':''}" onclick="NorthPublicRuntime.toggleAutomation('${k}')"></span></div>`).join('')}`);
  const background=section('cou_companion_notifications','后台消息与通知记录',`<div class="it"><span>允许该角色在关闭网页后联系</span><span class="sw ${st.backgroundConsent[c.id]&&c.proactive?.serverPush?'on':''}" onclick="roleServerPushToggle(${jq(c.id)})"></span></div>${roleServerPushStatusHTML(c.id)}<div style="padding:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="minibtn" onclick="NorthPublicRuntime.history()">查看后台记录</button><button class="minibtn" onclick="roleServerPushOneMinuteTest(${jq(c.id)})">测试通知链路</button><button class="minibtn" onclick="NorthPublicRuntime.exportProfile()">导出连接凭据</button><button class="minibtn" onclick="NorthPublicRuntime.importProfile()">导入公开连接</button></div>`);
  return html.replace('<div id="cou_companion_apps"',wellness+auto+background+'<div id="cou_companion_apps"');
 }
 function sync(){save();render();const c=getC(S.couple?.cid);if(c&&state()?.backgroundConsent[c.id])roleServerPushSync(c,true);}
 async function history(){
  const c=getC(S.couple?.cid);if(!c)return;
  try{const rows=await companionRpc('phone_role_push_history',{p_target:companionCloudTarget(),p_owner_secret:companionOwnerSecret(),p_role_id:c.id});openModal('<h3>后台消息与通知记录</h3><div style="max-height:60vh;overflow:auto">'+(Array.isArray(rows)&&rows.length?rows.map(r=>'<div class="bill" style="padding:12px"><b>'+esc(fmtDT(companionTime(r.at)))+'</b><div>'+esc(r.body||r.reason||'没有可显示正文')+'</div><small>'+esc(r.outcome||'')+' · 通知 '+esc(r.pushStatus||'未发送')+'</small></div>').join(''):'暂无记录')+'</div><button class="btn g" onclick="closeModal()">关闭</button>');}catch(e){toast(e.message);}
 }
 async function exportProfile(){if(!await uiConfirm('连接凭据可控制你的公开 North，请只保存在自己的设备，不要发给别人。继续导出？'))return;const blob=new Blob([JSON.stringify(profile())],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='North公开连接凭据.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
 function importProfile(){pickFile('application/json',async file=>{try{const p=JSON.parse(await file.text());if(p.schema!==1||!/^yb_[a-z0-9]{20,96}$/.test(p.target)||typeof p.ownerSecret!=='string'||p.ownerSecret.length<32)throw Error('不是有效的公开 North 连接凭据');if(!await uiConfirm('将替换当前角色的公开连接。不会修改私人 App 绑定，是否继续？'))return;const account=cloudId(),aid=actId(),id=S.couple.cid;localStorage.setItem('north-public-controller.v1:'+account+':'+aid+':'+id,JSON.stringify(p));delete S.couple.publicNorthByRole[aid+':'+id];const st=state(),data=await rpc('phone_companion_pull_snapshot',{});if(cloudId()!==account||actId()!==aid||S.couple.cid!==id)return;apply(st,data);save();render();}catch(e){toast(e.message);}});}
 function install(){
  if(!available()){
   if(!privateNativeAppOn())return;
   const pageCore=renderCompanionPage;
   renderCompanionPage=function(...args){return pageCore(...args)+'<div style="padding:12px"><button class="minibtn" onclick="NorthPublicRuntime.history()">查看后台通知记录</button></div>';};
   return;
  }
  companionState=state;companionOwnerSecret=()=>profile().ownerSecret;companionRpc=rpc;companionApplyServerPayload=apply;
  companionEnter=target=>{couTab(3);if(target)setTimeout(()=>jumpToSection(String(target)),60);};
  companionRolePrompt=prompt;companionAmbientContext=prompt;
  companionRoleReadsExternal=(c,k)=>!!(c&&state()?.roleId===String(c.id)&&state().roleAccess&&state().permissions[k||'screenTime']);
  companionRoleExternalFocus=focus=>/iPhone|North|外置|伴生|屏幕|使用时长|使用时间|步数|电量|充电|定位|位置/i.test(String(focus||''));
  companionRoleProgressSteps=()=>['正在读取公开 North 最近返回的授权数据'];
  companionRoleDataState=()=>state();
  companionRolePullLatest=async focus=>{
   if(!companionRoleExternalFocus(focus))return true;
   const st=state(),id=st?.roleId,account=cloudId();if(!st?.linked||!st.roleAccess){_companionRoleReadError='公开 North 未连接或没有角色读取授权';return false;}
   try{const data=await rpc('phone_companion_pull_snapshot',{});if(cloudId()!==account||state()?.roleId!==id)return false;apply(st,data);save();if(!st.linked)throw Error('公开 North 已断开连接');return true;}catch(e){_companionRoleReadError=e.message;return false;}
  };
  const focusCore=spyFocusData;
  spyFocusData=function(id,focus){if(companionRoleExternalFocus(focus))return {label:'公开 North 最近授权报告',data:prompt(getC(id))||'当前没有这项读取授权，不能声称已经查看。'};return focusCore(id,focus);};
  const targetsCore=cohabPhoneTargets,cohabPromptCore=cohabPhonePrompt;
  cohabPhoneTargets=function(c){const out=targetsCore(c),st=state();if(String(c?.id)!==st?.roleId||!st.roleAccess)return out;for(const [key,label]of [['screenTime','iPhone屏幕使用时间'],['health','iPhone步数'],['battery','iPhone电量'],['location','iPhone定位']])if(st.permissions[key])out.push(label);return [...new Set(out)];};
  cohabPhonePrompt=function(c){let text=cohabPromptCore(c);const facts=prompt(c);if(!facts)return text;text=text.replace(/- 当前环境没有真实 iPhone 伴生读取能力[^\n]*\n/,'- 当前支持公开 North 最近授权报告；不是实时读取保证，必须保留原采集时间。\n');return text+facts+'\n共同生活可写 [共同生活查看|准确项目]。只读取公开版已支持项目，不请求睡眠、心率或手动解锁事件。';};
  for(const name of ['initiativeQueueNote','initiativeGroundingContext']){const old=window[name];if(typeof old==='function')window[name]=function(c,...args){return old(c,...args)+prompt(c);};}
  const commandCore=companionSendCommand;
  companionSendCommand=function(st,action,app,opt,log){
   try{NorthPublicPolicy.command(st.publicFacts,{roleAccess:opt?.by==='role'?st.roleAccess:true,permissions:st.permissions},action,app?.id,Number(opt?.minutes),opt?.actor);}
   catch(e){if(log){log.status='failed';log.error=e.message;}save();toast(e.message);return;}
   return commandCore(st,action,app,{...opt,scope:'external',internalId:''},log);
  };
  renderCompanionPage=renderPage;
  const pollCore=companionPollSnapshot,pullCore=roleServerPushPull,backgroundCore=roleBackgroundAvailable;
  companionPollSnapshot=async force=>{const st=state();if(!st||!st.linked&&!st.pairing)return false;return pollCore(force);};
  roleServerPushPull=async force=>{const st=state();if(!st?.linked||!Object.values(st.backgroundConsent).some(Boolean))return false;return pullCore(force);};
  roleBackgroundAvailable=id=>!!state()?.linked&&!!state()?.backgroundConsent[id]&&backgroundCore(id);
  companionHelp=()=>openModal('<h3>公开 North 权限</h3><div class="hint">在已上架的 North 内连接并授权步数、电量、屏幕时间或定位。小手机只在你允许后提供给绑定角色。公开版不支持手表心率、睡眠、心境、私人智能家居或手动解锁事件提醒。排队不代表执行成功。</div><button class="btn g" onclick="closeModal()">关闭</button>');
  const syncCore=roleServerPushSync;
  roleServerPushSync=async(c,silent)=>{if(!state()?.backgroundConsent[c?.id])return false;return syncCore(c,silent);};
  roleServerPushToggle=async id=>{
   const st=state(),c=getC(id);if(!st||!c)return false;
   if(!st.linked){toast('请先连接公开 North');return false;}
   c.proactive=c.proactive||{};const enabled=!!(st.backgroundConsent[id]&&c.proactive.serverPush);
   if(!enabled&&!await uiConfirm('开启后会将这个角色的 API 地址、Key、模型配置、角色设定、近期聊天与记忆同步到公开 North 云端，用于关闭网页后的生成与通知。会产生正常模型费用。是否开启？'))return false;
   st.backgroundConsent[id]=true;c.proactive.serverPush=!enabled;if(!enabled)c.proactive.enabled=true;
   const ok=await syncCore(c,false);if(!ok)c.proactive.serverPush=enabled;save();render();return ok;
  };
  const autoCore=roleServerAutomationConfig;
  roleServerAutomationConfig=c=>{const value=autoCore(c),st=state(),bound=st?.roleId===String(c.id)&&st.roleAccess;return{...value,publicNorth:true,permissions:bound?{...st.permissions}:{},flags:bound?{...st.automations,morningSleep:false,emotionCare:false,manualUnlockAlert:false}:{},automationEvents:[],publicNorthPrompt:bound?prompt(c):''};};
  const effectiveCore=roleServerPushEffectiveEnabled;
  roleServerPushEffectiveEnabled=c=>!!state()?.backgroundConsent[c?.id]&&effectiveCore(c);
  // Do not execute private-only health/manual-unlock timers in a public browser.
  companionAutomationMaybeSend=()=>false;
 }
 return {config,available,state,profile,rpc,apply,prompt,install,history,exportProfile,importProfile,
  toggleAutomation:k=>{if(!['eveningScreen','absenceBattery','criticalBattery'].includes(k))return;const st=state();st.automations[k]=!st.automations[k];sync();},
  saveWindows:()=>{const st=state();for(const [key,id]of [['usageStart','comp_auto_usage_start'],['usageEnd','comp_auto_usage_end']]){const value=document.getElementById(id)?.value;if(/^\d{2}:\d{2}$/.test(value))st.automationWindows[key]=value;}sync();}};
})();
NorthPublicRuntime.install();
