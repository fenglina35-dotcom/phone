(function(){
'use strict';
const records=new Map(),baseChat=chatAPI,baseResult=chatResultText,baseRoleChat=cohabRoleChat,basePanel=cohabSettingsPanel;
const scope=id=>String(typeof actId==='function'?actId():'main')+'|'+String(id);
function meta(opt){
  const route=chatRequestRoute(opt.routeIndex),settings=S.settings||{},main=route||settings.chat||{},aux=opt.aux?(route?route.aux:settings.aux):null;
  const index=route?parseInt(opt.routeIndex,10):Math.max(0,parseInt(settings.chatRouteActive,10)||0),relay=aiCoreOn()&&!opt.noRelay;
  return {routeName:relay?'内置 AI':CHAT_ROUTE_NAMES[index]||('路线'+(index+1)),slot:opt.aux&&aux&&aux.model?'副模型':'主模型',model:relay?(opt.model||'服务端选择，等待上游返回'):String(opt.model||(aux&&aux.model)||main.model||'未填写'),maxTokens:+opt.max||+main.maxTokens||900};
}
function add(key,row){const list=records.get(key)||[];list.push(row);records.set(key,list.slice(-12));if(records.size>40)records.delete(records.keys().next().value);}
function response(row,opt,data){
  const choice=data&&data.choices&&data.choices[0],usage=data&&data.usage||{},reason=String(choice&&choice.finish_reason||'未提供').slice(0,80);
  row.responses.push({maxTokens:+opt.max||row.maxTokens,reason,model:String(data&&data.model||'').slice(0,160),outputTokens:Number.isFinite(+usage.completion_tokens)&&usage.completion_tokens!=null?+usage.completion_tokens:null});
  row.responses=row.responses.slice(-8);
}
chatResultText=async function(messages,opt,data){
  if(opt&&opt._cohabModelDiagnosticRow){try{response(opt._cohabModelDiagnosticRow,opt,data);}catch(_){}}
  return baseResult.apply(this,arguments);
};
chatAPI=async function(messages,opt){
  if(!opt||!opt.cohabDiagnostic)return baseChat.apply(this,arguments);
  // Continuations belong to the same request record; never create another request here.
  if(opt._cohabModelDiagnosticRow)return baseChat.apply(this,arguments);
  let row;
  try{const tag=opt.cohabDiagnostic;row=Object.assign({at:Date.now(),actorName:String(tag.actorName||'主角').slice(0,80),kind:tag.kind||'host',stage:String(opt.roleInterceptStage||'共同生活回复').slice(0,80),status:'请求中',responses:[]},meta(opt),wechatRequestStats(messages));add(scope(tag.hostId),row);}catch(_){return baseChat.apply(this,arguments);}
  const requestOpt=Object.assign({},opt,{_cohabModelDiagnosticRow:row});
  try{const result=await baseChat.call(this,messages,requestOpt);row.status=String(result||'').trim()?'已返回':'返回空内容';row.returnedChars=Array.from(String(result||'')).length;return result;}
  catch(e){row.status=e&&e.code==='OFFLINE_RESUME_CANCELLED'?'后台恢复取消':'请求失败';row.httpStatus=+e.status||0;throw e;}
  finally{row.elapsedMs=Math.max(0,Date.now()-row.at);}
};
cohabRoleChat=function(c,messages,opt,state,d){
  const tag={hostId:c.id,actorName:c.remark||c.name||'主角',kind:'host'};
  return baseRoleChat.call(this,c,messages,Object.assign({},opt,{cohabDiagnostic:tag}),state,d);
};
function field(label,value){return '<div class="it"><span>'+esc(label)+'</span><span class="v" style="max-width:68%;white-space:normal;overflow-wrap:anywhere">'+esc(String(value))+'</span></div>';}
function config(name,opt){const m=meta(opt);return '<div class="section">'+field(name,m.routeName+' · '+m.slot)+field('配置模型',m.model)+'</div>';}
window.cohabModelDiagnosticOpen=function(id){
  const c=getC(id);if(!c)return;const d=cohabData(id),t=d&&d.theater||{},rows=(records.get(scope(id))||[]).slice().reverse();
  let current=config('主角当前配置',{routeIndex:cohabReplyRouteIndex(d),aux:cohabReplyAux(c,d)});
  if(t.enabled&&t.guest){const guest=getC(t.guest.contactId);if(guest)current+=config('微信来客：'+(guest.remark||guest.name),{routeIndex:roleChatRouteIndex(guest),aux:guest.model==='aux'});}
  if(t.enabled&&t.extra)current+=config('临时路人：'+(t.extra.name||'路人'),{routeIndex:roleChatRouteIndex(c),aux:c.model==='aux'});
  const history=rows.map(row=>'<div class="section">'+field(row.kind==='host'?'主角':'配角',row.actorName)+field('请求时间',fmtDT(row.at))+field('请求阶段',row.stage)+field('当时请求配置',row.routeName+' · '+row.slot+' · '+row.model)+field('请求输出上限',row.maxTokens+' tokens')+field('请求规模',row.messageCount+' 条 · '+row.requestChars+' 字符')+requestSizeDetailsHtml(row)+field('状态',row.status+(row.httpStatus?' · HTTP '+row.httpStatus:''))+(row.responses||[]).map((r,i)=>field(i?'续写结束原因':'首次结束原因',r.reason)+field(i?'续写输出上限':'首次输出上限',r.maxTokens+' tokens')+(r.model?field('上游返回模型',r.model):'')+(r.outputTokens!=null?field('上游输出用量',r.outputTokens+' tokens'):'')).join('')+(row.returnedChars!=null?field('返回文本长度',row.returnedChars+' 字符'):'')+'</div>').join('');
  openModal('<h3>模型与路线诊断</h3><div class="hint">共同生活专用。上方为当前配置，下方为最近真实请求；更改配置不会改写旧记录。微信来客跟随来客角色自己的线路。</div>'+current+'<h4>最近请求</h4>'+(history||'<div class="hint">尚无本次打开小手机后的共同生活请求记录。让角色回复后再查看。</div>')+'<div class="hint">length / max_tokens 表示上游报告达到输出上限；stop 不代表内容已通过格式检查。tokens 与中文字数不同。这里只显示本次打开小手机后的最近 12 次请求，不保存聊天原文、接口 Key 或地址，也不会调用模型。主角、配角的实际请求上限以各自记录为准。</div><button class="btn g" style="margin-top:12px" onclick="closeModal()">关闭</button>');
};
cohabSettingsPanel=function(id,o){const html=basePanel.apply(this,arguments),entry='<button type="button" class="cohab-memory-open" onclick="cohabModelDiagnosticOpen(\''+id+'\')"><span>模型与路线诊断</span><small>共同生活请求 ›</small></button>';return html.replace('</details>','<div class="cohab-settings-grid">'+entry+'</div></details>');};
})();
