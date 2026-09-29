/* Local metadata only. This observer never retries, changes a reply, or uploads diagnostics. */
(function(root){
 'use strict';
 const KEY='north-request-diagnostics-v1',MAX=80,previews=new Map();
 let rows=[],loaded=false,sequence=0;
 function account(){try{return String(actId()||'main');}catch(_){return 'main';}}
 function scrub(value){
  let text=String(value==null?'':value);
  try{const walk=(obj,depth)=>{if(!obj||typeof obj!=='object'||depth>5)return;for(const [key,val] of Object.entries(obj)){if(typeof val==='string'&&/key|token|secret|password/i.test(key)&&val.length>=4)text=text.split(val).join('[已隐藏]');else if(val&&typeof val==='object')walk(val,depth+1);}};walk(S.settings,0);}catch(_){}
  return text.replace(/Bearer\s+[^\s"'<>]+/gi,'Bearer [已隐藏]').replace(/\bsk-[\w-]+/g,'[已隐藏]').replace(/("?(?:api[_-]?key|access[_-]?token|authorization|secret)"?\s*[:=]\s*")[^"]*/gi,'$1[已隐藏]').slice(0,400);
 }
 function all(){if(!loaded){loaded=true;try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(data))rows=data.slice(-MAX);}catch(_){}}return rows;}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(rows));}catch(_){}}
 function patch(row,fields){if(!row)return;Object.assign(row,fields);persist();}
 function add(fields){all();const row=Object.assign({id:Date.now().toString(36)+'-'+(++sequence),at:Date.now(),account:account(),version:typeof APP_VER==='string'?APP_VER:'unknown'},fields);rows.push(row);if(rows.length>MAX){for(const old of rows.splice(0,rows.length-MAX))previews.delete(old.id);}persist();return row;}
 function turn(turn){if(!turn||!turn.c)return;turn.requestDiagnostic=add({kind:'turn',roleId:String(turn.c.id),account:String(turn.channel==='online'?turn.account||account():account()),channel:String(turn.channel||'online'),state:'preparing',reason:'准备聊天上下文，尚未调用模型'});}
 function begin(messages,opt){
  const audit=opt.roleInterceptAudit,owner=audit&&audit.c;
  let count=0;try{count=JSON.stringify(messages||[]).length;}catch(_){}
  return add({kind:'request',roleId:String(owner&&owner.id||opt.diagnosticRoleId||''),account:String(audit&&audit.channel==='online'?audit.account||account():account()),channel:String(audit&&audit.channel||opt.diagnosticChannel||'other'),turnId:audit&&audit.requestDiagnostic&&audit.requestDiagnostic.id||'',state:'started',reason:'请求准备中',messageCount:Array.isArray(messages)?messages.length:0,requestChars:count,rawMode:!!opt.unfilteredOutput,slot:opt.aux?'副模型':'主模型',routeIndex:Number.isInteger(opt.routeIndex)?opt.routeIndex:null});
 }
 function configured(row,opt,config,relay){patch(row,{model:scrub(opt.model||config&&config.model||''),slot:opt.aux?'副模型':'主模型',maxTokens:Number(opt.max||config&&config.maxTokens)||900,temperature:Number(opt.temp!=null?opt.temp:config&&config.temp)||0.8,transport:relay?'relay':'external-chat',state:'sent',reason:'已发起请求，等待响应'});}
 function data(row,value){
  const choice=value&&value.choices&&value.choices[0],message=choice&&choice.message,content=message&&message.content;
  let format='missing-content';if(typeof content==='string')format=content.trim()?'text':'empty-content';else if(content!=null)format='non-string-content';else if(value&&(value.output_text!=null||value.candidates||value.content))format='alternate-format';
  patch(row,{inputTokens:typeof(value&&value.usage&&value.usage.prompt_tokens)==='number'?value.usage.prompt_tokens:null,outputTokens:typeof(value&&value.usage&&value.usage.completion_tokens)==='number'?value.usage.completion_tokens:null,format,bodyChars:typeof content==='string'?content.length:0,finishReason:scrub(choice&&choice.finish_reason||''),responseModel:scrub(value&&value.model||''),responseId:scrub(value&&value.id||'')});
 }
 async function read(res,row){
  const header=name=>{try{return res.headers.get(name)||'';}catch(_){return '';}};
  patch(row,{status:Number(res.status)||0,contentType:scrub(header('content-type')),requestId:scrub(header('x-request-id')||header('request-id')||header('x-trace-id')),state:'reading',reason:'已收到响应头，读取正文'});
  let result=null;
  try{
   if(typeof res.text==='function'){
    const raw=await res.text();patch(row,{responseChars:raw.length});
    if(row)previews.set(row.id,scrub(raw.slice(0,400)));
    try{result=JSON.parse(raw);}catch(_){patch(row,{format:/^\s*(?:data:|event:)/.test(raw)?'sse':raw.trim()?'invalid-json':'empty-body'});}
   }else result=await res.json();
  }catch(_){patch(row,{format:'body-read-failed'});}
  if(result!=null)data(row,result);
  return result;
 }
 const reasons={'empty-content':'接口正文字段为空','missing-content':'返回数据缺少聊天正文字段','alternate-format':'有其他格式字段，当前聊天解析未读取','non-string-content':'聊天正文字段不是字符串','sse':'收到流式数据，当前路径要求完整 JSON','invalid-json':'响应不是有效 JSON','empty-body':'HTTP 响应正文为空','body-read-failed':'响应正文读取失败'};
 function result(row,text){const size=typeof text==='string'?text.length:0;patch(row,{state:size?'returned':'empty',parsedChars:size,duration:Date.now()-(row&&row.at||Date.now()),reason:size?'已取得正文；是否显示需看聊天轮次结果':reasons[row&&row.format]||'解析后没有正文'});return text;}
 function error(row,e){patch(row,{state:'failed',status:Number(e&&e.status)||row&&row.status||0,errorCode:scrub(e&&e.code||''),reason:Number(e&&e.status)>=400?'上游 HTTP 请求失败':reasons[row&&row.format]||'请求或回复处理抛出错误',error:scrub(e&&e.message||e),duration:Date.now()-(row&&row.at||Date.now())});}
 function finishTurn(turn,text,opt){
  const row=turn&&turn.requestDiagnostic;if(!row)return;
  const children=all().filter(item=>item.turnId===row.id),hasBody=children.some(item=>item.parsedChars>0);
  patch(row,{state:opt&&opt.delivered?'handled':'not-visible',reason:opt&&opt.delivered?'本轮已有可见回复或合法功能处理':hasBody?'接口曾返回正文，但本轮未形成可见回复':children.length?'本轮未形成可见回复；请查看对应请求原因':'未到模型请求阶段或已被其他流程接管',duration:Date.now()-row.at,requests:children.length});
 }
 function list(id){return all().filter(row=>row.account===account()&&(id==null||row.roleId===String(id))).slice().reverse();}
 function escape(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
 function report(id){return JSON.stringify({schema:1,note:'仅本机故障元数据；不含请求正文、响应片段或 API Key。returned 不等于聊天已显示。',records:list(id).slice(0,24)},null,2);}
 function open(id){
  const items=list(id).slice(0,24),body=items.map(row=>'<div style="margin:12px 0;padding:10px;border:1px solid #555;border-radius:8px;overflow-wrap:anywhere"><b>'+escape(new Date(row.at).toLocaleString())+' · '+escape(row.kind==='turn'?'聊天轮次':row.slot||'模型请求')+'</b><br>'+escape(row.reason)+'<br>'+escape(row.model||'')+(row.kind==='request'?'<br>'+escape('HTTP '+(row.status||'未取得')+' · '+(row.contentType||'格式未记录')+' · 请求 '+(row.requestChars||0)+' 字符 · 返回正文 '+(row.bodyChars||0)+' 字符'):'')+(row.error?'<br>'+escape(row.error):'')+(previews.has(row.id)?'<details><summary>本机响应片段（不包含在复制内容中）</summary><pre style="white-space:pre-wrap">'+escape(previews.get(row.id))+'</pre></details>':'')+'</div>').join('');
  const arg=id==null?'null':JSON.stringify(String(id));
  openModal('<h3>请求故障诊断</h3><div class="hint">只观察，不额外调用模型。记录实际请求与本轮显示结果；切换路线不删除旧记录。响应片段仅当前页面内存保留，关闭页面即丢失。</div>'+ (body||'<p>本机暂无记录。更新后下一次正常请求将留下记录，不必反复测试。</p>')+'<button class="btn p" onclick="NorthRequestDiagnostics.copy('+escape(arg)+')">复制故障诊断</button><button class="btn g" onclick="closeModal()">关闭</button>');
 }
 async function copy(id){const text=report(id);try{await navigator.clipboard.writeText(text);toast('已复制故障诊断（不含正文和密钥）');}catch(_){openModal('<h3>请长按复制故障诊断</h3><textarea readonly style="width:100%;height:45vh">'+escape(text)+'</textarea><button class="btn g" onclick="closeModal()">关闭</button>');}}
 function button(id){return '<button class="btn g" style="margin:10px 0" onclick="NorthRequestDiagnostics.open('+escape(JSON.stringify(String(id)))+')">请求故障诊断 · 复制记录</button>';}
 function route(c){const row=list(c&&c.id).find(r=>r.kind==='request');if(!row)return null;const pending=['started','sent','reading'].includes(row.state),name=typeof CHAT_ROUTE_NAMES!=='undefined'&&CHAT_ROUTE_NAMES[row.routeIndex]||'实际请求路线';return{at:row.at,outcome:pending?'pending':row.state==='returned'?'success':'failed',routeName:name,actualRoute:name,slot:row.slot,actualSlot:row.slot,model:row.model,actualModel:row.model,status:row.status,reason:row.reason,messageCount:row.messageCount,requestChars:row.requestChars};}
 root.NorthRequestDiagnostics={begin,configured,data,read,result,error,turn,finishTurn,list,report,open,copy,button,route};
})(globalThis);
