/* Cloud shortcuts: explicit owner consent; no foreground model calls or timers masquerading as automation. */
window.PhoneShortcuts=(()=>{
 'use strict';let busy=false,last=0;
 if(typeof NorthPublicRuntime==='undefined')return {open:()=>toast('自动化模块未加载，请刷新页面后再试')};
 function identity(){const publicMode=NorthPublicRuntime.available(),p=publicMode?NorthPublicRuntime.profile():null;return {target:p?p.target:cloudId(),ownerSecret:p?p.ownerSecret:companionOwnerSecret(),clientId:'phone_'+actId(),roleId:S.couple?.cid||'',url:companionCloudURL(),publicMode};}
 async function request(action,body={},auth=identity()){
  const response=await fetchT(auth.url+'/functions/v1/phone-shortcuts',{method:'POST',headers:{...companionHeaders(),'Content-Type':'application/json'},body:JSON.stringify({...body,action,target:auth.target,ownerSecret:auth.ownerSecret,clientId:auth.clientId})},30000),data=await response.json();
  if(!response.ok||data.error)throw Error(data.error||'快捷指令云端请求失败');return data;
 }
 function bound(){return !!(S.couple?.cid&&companionState()?.linked);}
 async function open(){
  if(!bound()){toast('请先在情侣空间连接 North；锁屏执行和通知使用该云连接');return;}
  try{const result=await request('list');openModal('<h3>iOS 快捷指令自动化</h3><div class="hint">触发条件在系统「快捷指令 → 自动化」设置。这里配置动作，关闭网页或锁屏后仍由云端生成。通知须 North 已允许通知。每条规则默认间隔至少 5 分钟、每天最多 24 次；会消耗模型额度。</div><button class="btn" onclick="PhoneShortcuts.createForm()">添加自动化动作</button><div style="max-height:40vh;overflow:auto">'+result.rules.map(r=>'<div class="bill" style="padding:12px"><b>'+esc(r.name)+'</b><div>'+esc(r.mode==='user_message'?'代发我的消息':'向角色报告事件')+' · '+esc(r.role_name)+'</div><small>'+esc(r.enabled?'已启用':'已撤销')+' · 资料同步 '+esc(fmtDT(Date.parse(r.synced_at)))+'</small>'+(r.enabled?'<button class="minibtn" onclick="PhoneShortcuts.revoke('+jq(r.id)+')">撤销</button>':'')+'</div>').join('')+'</div><button class="btn g" onclick="PhoneShortcuts.pull(true)">同步执行结果</button><button class="btn g" onclick="closeModal()">关闭</button>');}catch(e){toast(e.message);}
 }
 function createForm(){const c=getC(S.couple.cid);openModal('<h3>给 '+esc(c.remark||c.name)+' 添加动作</h3><div class="hint">只上传当前绑定角色。资料为创建时的快照，之后更换模型、清除记忆或修改人设，请撤销旧动作并重新创建。</div><input id="shortcut_name" placeholder="动作名称" maxlength="80"><select id="shortcut_mode"><option value="user_message">代发我的消息</option><option value="role_event">向角色报告事件</option></select><textarea id="shortcut_text" placeholder="例如：我到家了；或：手机开始充电，请角色主动联系" maxlength="2000"></textarea><button class="btn" onclick="PhoneShortcuts.create()">授权并生成动作</button><button class="btn g" onclick="PhoneShortcuts.open()">返回</button>');}
 async function create(){
  const name=$('#shortcut_name')?.value.trim(),preset=$('#shortcut_text')?.value.trim(),mode=$('#shortcut_mode')?.value;if(!name||!preset){toast('请填写动作名称和消息／事件');return;}
  const auth=identity(),c=getC(auth.roleId),route=roleServerModelRouteAt(c,c.model==='aux');if(!route){toast('请先配置该角色使用的模型');return;}
  if(!await uiConfirm('创建将把该角色的模型地址和 Key、角色设定及近期聊天加密保存在对应 North 云端，用于锁屏后的自动回复。触发时会扣除模型额度。是否同意？'))return;
  try{const config={system:buildSystem(c),history:roleInteractionRows(c).slice(-40).map(m=>({role:m.role,content:m.text})),route,unfiltered:modelOutputUnfiltered()};const result=await request('save',{name,preset,mode,roleId:c.id,roleName:c.remark||c.name,config},auth);
   if(identity().target!==auth.target||identity().clientId!==auth.clientId)return;
   S._shortcutCloudEnabled=true;save();
   openModal('<h3>动作已创建</h3><div class="hint">在系统快捷指令里添加「生成 UUID」，再添加「获取 URL 内容」：方法 POST，请求体 JSON。eventId 填入 UUID 变量，同一次事件重试必须沿用同一个 UUID。自动化选择「立即运行」。Token 相当于此动作的钥匙，不要公开。</div><textarea readonly style="width:100%;height:80px">'+esc(result.url)+'</textarea><textarea readonly style="width:100%;height:150px">'+esc(JSON.stringify({token:result.token,eventId:'替换为生成的UUID变量'},null,2))+'</textarea><div class="hint">此 Token 仅本次展示，丢失后撤销并重新创建。返回 accepted 表示云端接收，不代表模型已成功；执行结果会同步回聊天，失败保留系统记录，不伪造角色回复。</div><button class="btn g" onclick="PhoneShortcuts.open()">完成</button>');
  }catch(e){toast(e.message);}
 }
 async function revoke(id){if(!await uiConfirm('撤销后该动作 Token 立即失效，尚未完成的结果不会再送达。继续？'))return;try{await request('revoke',{id});await open();}catch(e){toast(e.message);}}
 async function pull(force=false){
  if(busy||!bound()||!S._shortcutCloudEnabled||!force&&(document.hidden||Date.now()-last<45000))return false;
  busy=true;last=Date.now();const auth=identity();try{
   const result=await request('pull',{},auth);if(identity().target!==auth.target||identity().clientId!==auth.clientId)return false;
   const ack=[];for(const j of result.jobs){const c=getC(j.role_id);if(!c)continue;if(c.deleted||roleServerPushReceiptHas('shortcut:'+j.id)){ack.push(j.id);continue;}const list=msgs(c.id),reset=+c._memoryResetAt||0;
    if(reset&&Date.parse(j.received_at)<=reset){ack.push(j.id);continue;}
    if(!list.some(m=>m._shortcutJob===j.id)){
     if(j.mode==='user_message')roleServerPushInsertByTime(list,{id:uid(),role:'user',type:'text',content:j.input_text,time:Date.parse(j.received_at),_shortcutJob:j.id,_shortcutPart:'input'});
     if(j.status==='completed'&&j.reply_text)roleServerPushInsertByTime(list,{id:uid(),role:'assistant',type:'text',content:j.reply_text,time:Date.parse(j.completed_at),_shortcutJob:j.id,_shortcutPart:'reply'});
     else roleServerPushInsertByTime(list,{id:uid(),role:'user',type:'sys',content:'快捷指令未完成：'+(j.error_code||j.status),time:Date.parse(j.completed_at)||Date.now(),_shortcutJob:j.id});
    }ack.push(j.id);
   }
   if(ack.length){if(!await persistWechatMessagesNow())return false;const remembered=ack.filter(id=>roleServerPushReceiptMark('shortcut:'+id,Date.now())).map(id=>'shortcut:'+id);if(remembered.length&&!await saveNowAsync()){roleServerPushReceiptForget(remembered);return false;}await request('ack',{ids:ack},auth);render();}if(force)toast(ack.length?'执行结果已同步':'暂时没有新结果');return true;
  }catch(e){if(force)toast(e.message);return false;}finally{busy=false;}
 }
 const settingsCore=renderSettings;
 renderSettings=function(...args){let html=settingsCore(...args);if(!_setCategory)html=html.replace('<div class="ios-settings-group">','<div class="ios-settings-group"><button class="ios-settings-row" data-settings-search="快捷指令 自动化 锁屏" onclick="PhoneShortcuts.open()"><span><b>iOS 快捷指令自动化</b><small>代发消息或报告事件 · 云端执行</small></span><em>›</em></button>');return html;};
 // Shortcut jobs retain both the user input and reply; the ordinary outbox must not insert them twice.
 const rpcCore=companionRpc;
 companionRpc=async function(name,args){const result=await rpcCore(name,args);return name==='phone_role_push_pull'&&Array.isArray(result)?result.filter(r=>r.triggerKind!=='shortcut'):result;};
 const pullCore=roleServerPushPull;
 roleServerPushPull=async function(...args){await pull(false);return pullCore(...args);};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull(false);});
 return{open,createForm,create,revoke,pull,request};
})();
