import test from 'node:test';
import {read as currentRead,fnSource,BUNDLES} from './_helpers.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name,next='function '){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const end=source.indexOf('\n'+next,start+10);
  return source.slice(start,end<0?source.length:end).trim();
}

const render=functionSource('renderSettings');
const tools=functionSource('settingsDataToolsHTML');
const page1=render.indexOf('id="setpage1"');
const image=render.indexOf('id="set_image"');
const page2=render.indexOf('id="setpage2"');
const page3=render.indexOf('id="setpage3"');

assert.ok(page1>=0&&image>page1&&page2>image,'AI 真图 must stay on interface/model page 1');
assert.ok(page3>page2,'authorization/data page must be the third page');
assert.match(render,/settingsJump\(1,'set_image'\)/);
assert.doesNotMatch(render.slice(page2,page3),/settingsJump\(1,/,'preference page must not repeat page 1 shortcuts');
assert.doesNotMatch(render.slice(page2,page3),/id="set_image"/,'preference page must not repeat AI image settings');
assert.match(tools,/settingsJump\(3,'set_license'\)/);
assert.match(tools,/settingsJump\(3,'set_layout'\)/);
assert.match(tools,/settingsJump\(3,'set_backup'\)/);
assert.match(tools,/重要提醒：[\s\S]*?请养成定期导出备份的习惯/);
assert.match(tools,/color:#ff5c6c;font-size:15px;font-weight:700/);
assert.match(tools,/settingsJump\(3,'set_storage'\)/);
assert.match(render,/_setTab===3\?settingsDataToolsSafeHTML\(\):''/);
assert.match(render,/return settingsTabTap\(event,3\)/);
assert.ok(tools.indexOf('licenseStatusSection()')<tools.indexOf('clearAllData()'));
assert.ok(tools.indexOf('storageMeter()')<tools.indexOf('clearAllData()'));

const nodes={};
for(let i=1;i<=3;i++){
  nodes['setpage'+i]={style:{},dataset:{},innerHTML:''};
  nodes['settab'+i]={style:{}};
}
nodes.setSaveButton={style:{}};
nodes.settingsscroll={scrollTop:88};
let builds=0;
const context=vm.createContext({
  $:id=>nodes[id.slice(1)]||null,
  settingsDataToolsHTML:()=>{builds++;return '<div id="set_license"></div>';}
});
vm.runInContext(functionSource('settingsDataToolsSafeHTML')+'\n'+functionSource('setTab')+';globalThis.setTab=setTab;',context);
context.setTab(2);
assert.equal(nodes.setpage1.style.display,'none');
assert.equal(nodes.setpage2.style.display,'block');
assert.equal(nodes.setpage3.style.display,'none');
assert.equal(builds,0,'data tools must not render on preference page');
context.setTab(3);
assert.equal(nodes.setpage3.style.display,'block');
assert.equal(nodes.setSaveButton.style.display,'none');
assert.equal(builds,1,'data tools load only when page 3 is opened');
context.setTab(1);
context.setTab(3);
assert.equal(builds,1,'page 3 must reuse its loaded DOM instead of rebuilding while switching tabs');

const brokenNodes={};
for(let i=1;i<=3;i++){
  brokenNodes['setpage'+i]={style:{},dataset:{},innerHTML:''};
  brokenNodes['settab'+i]={style:{}};
}
brokenNodes.setSaveButton={style:{}};
brokenNodes.settingsscroll={scrollTop:12};
const broken=vm.createContext({
  $:id=>brokenNodes[id.slice(1)]||null,
  settingsDataToolsHTML:()=>{throw new Error('license metadata unavailable');}
});
vm.runInContext(functionSource('settingsDataToolsSafeHTML')+'\n'+functionSource('setTab')+';globalThis.setTab=setTab;',broken);
broken.setTab(3);
assert.equal(brokenNodes.setpage3.style.display,'block','an authorization read error must stay on settings page 3');
assert.match(brokenNodes.setpage3.innerHTML,/授权与数据暂时读取失败/);

console.log('settings pagination tests passed');

for(const [label,file]of BUNDLES){
 const src=currentRead(file),nodes={
 code_base:{value:'https://code.invalid/v1/'},code_key:{value:'fixture-code-key'},code_model:{value:'coder'},
 code_max:{value:'16384'},code_thinking:{checked:false},code_effort:{value:'low'}
 },role={base:'https://role.invalid',key:'fixture-role-key',model:'role'},state={settings:{chat:role,chatRoutes:[{...role}]}};
 let saved=0,lastRequest;
 const ctx=vm.createContext({S:state,URL,Math,Number,String,Object,Array,JSON,Error,$:id=>nodes[id.slice(1)],save:()=>saved++,toast(){},chatRequestDiagnostic(){},roleMoodScopeText:t=>t,
 fetchT:async(url,options)=>{lastRequest={url,options};return {ok:true,status:200};},
 chatReadDiagnosticResponse:async()=>({choices:[{message:{content:'完整文件正文'},finish_reason:'stop'}]})});
 for(const name of ['codeModelRouteCopy','codeModelRoutes','codeModelConfig','codeModelFormValues','codeModelCommit','codeModelSave','codeModelProtocol','codeModelEndpoint','codeModelPlan','codeModelNativeResult','codeModelReadNative','chatCompletionBody','chatResultText','codeModelRequest'])vm.runInContext(fnSource(src,name),ctx);
 assert.equal(ctx.codeModelSave(),true,label);assert.equal(saved,1);assert.equal(state.settings.chat,role);assert.equal(state.settings.chatRoutes[0].key,'fixture-role-key');
 assert.equal(state.settings.codeModel.base,'https://code.invalid/v1');
 assert.equal(await ctx.codeModelRequest([{role:'user',content:'做一个小游戏'}]),'完整文件正文');
 assert.equal(lastRequest.url,'https://code.invalid/v1/chat/completions');assert.equal(lastRequest.options.headers.Authorization,'Bearer fixture-code-key');
 nodes.code_max.value='1';assert.equal(ctx.codeModelSave(),false);assert.equal(saved,1);assert.equal(state.settings.codeModel.maxTokens,16384);
 ctx.chatReadDiagnosticResponse=async()=>({choices:[{message:{content:'不完整'},finish_reason:'length'}]});
 await assert.rejects(()=>ctx.codeModelRequest([]),/尚未完整/);
}

// CODE_MODEL_ROUTES_V2: deleting credentials must really persist and stop delegation.
for(const [label,file] of BUNDLES)test(label+' code settings allow deleting each field without restoring defaults',()=>{
 const src=currentRead(file),nodes={code_base:{value:'https://code.invalid/v1'},code_key:{value:'fixture-code'},code_model:{value:'coder'},code_max:{value:'16384'},code_enabled:{checked:true},code_protocol:{value:'auto'},code_thinking:{checked:false},code_effort:{value:'low'}};
 const state={settings:{codeModel:{base:'https://code.invalid/v1',key:'fixture-code',model:'coder',maxTokens:16384}}};
 const ctx=vm.createContext({S:state,URL,$:id=>nodes[id.slice(1)],save(){},toast(){}});
 for(const name of ['codeModelRouteCopy','codeModelRoutes','codeModelConfig','codeModelFormValues','codeModelCommit','codeModelSave'])if(src.includes('function '+name+'('))vm.runInContext(fnSource(src,name),ctx);
 for(const field of ['base','key','model','max']){
  const node=nodes['code_'+field],old=node.value;node.value='';
  assert.equal(ctx.codeModelSave(),true,'clearing '+field+' must save');
  const cfg=ctx.codeModelConfig();if(field!=='max')assert.equal(cfg[field],'','empty '+field+' must survive reopening');
  if(field!=='max')assert.equal(cfg.enabled,false,'incomplete configuration must disable delegation');
  node.value=old;
 }
 nodes.code_enabled.checked=false;assert.equal(ctx.codeModelSave(),true);assert.equal(ctx.codeModelConfig().enabled,false);
});

for(const [label,file] of BUNDLES)test(label+' code routes preserve credentials, disable requests and support native protocols',async()=>{
 const src=currentRead(file),nodes={code_base:{value:'https://proxy.invalid/custom/v1/chat/completions'},code_key:{value:'first-key'},code_model:{value:'claude-code'},code_max:{value:'16384'},code_enabled:{checked:true},code_protocol:{value:'auto'},code_thinking:{checked:false},code_effort:{value:'low'}};
 let calls=[],reply,saveError=false;
 const ctx=vm.createContext({S:{settings:{chat:{key:'role-key'}}},URL,$:id=>nodes[id.slice(1)],save(){if(saveError)throw Error('磁盘失败');},toast(){},render(){},chatRequestDiagnostic(){},apiErrorCN:(s,r)=>'HTTP '+s+' '+r,
 modelProbeRead:async res=>{if(!res.ok)throw Error('HTTP '+res.status);return res.text();},fetchT:async(url,opt)=>{calls.push({url,...opt,body:JSON.parse(opt.body)});return {ok:true,status:200,text:async()=>reply};},chatReadDiagnosticResponse:async()=>JSON.parse(reply)});
 for(const name of ['codeModelRouteCopy','codeModelRoutes','codeModelConfig','codeModelFormValues','codeModelCommit','codeModelSave','codeModelRouteUse','codeModelProtocol','codeModelEndpoint','codeModelPlan','codeModelNativeResult','codeModelReadNative','codeModelRequest','chatCompletionBody'])vm.runInContext(fnSource(src,name),ctx);
 assert.equal(ctx.codeModelSave(),true);
 ctx.codeModelRouteUse(1);assert.equal(ctx.codeModelConfig().key,'');assert.equal(ctx.codeModelConfig().enabled,false);
 nodes.code_base.value='https://second.invalid/v1';nodes.code_key.value='second-key';nodes.code_model.value='coder2';ctx.codeModelSave();
 ctx.codeModelRouteUse(0);assert.equal(ctx.codeModelConfig().key,'first-key');assert.equal(ctx.S.settings.codeModel.routes[1].key,'second-key');assert.equal(ctx.S.settings.chat.key,'role-key');
 const prior=JSON.stringify(ctx.S.settings.codeModel);saveError=true;assert.equal(ctx.codeModelSave(),false);assert.equal(JSON.stringify(ctx.S.settings.codeModel),prior);saveError=false;
 nodes.code_enabled.checked=false;ctx.codeModelSave();await assert.rejects(()=>ctx.codeModelRequest([]),/停用/);assert.equal(calls.length,0);
 const messages=[{role:'system',content:'制作规则'},{role:'user',content:'制作需求'}],text='{"chunk":"<html>\\n  原始代码</html>","done":true}';
 for(const [protocol,base,suffix,json,sse] of [
 ['openai','https://proxy.invalid/prefix/v1/chat/completions','/prefix/v1/chat/completions',{choices:[{message:{content:text},finish_reason:'stop'}]},null],
 ['responses','https://proxy.invalid/prefix/v1/responses','/prefix/v1/responses',{status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]},[{type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]}}]],
 ['anthropic','https://api.anthropic.com','/v1/messages',{content:[{type:'thinking',thinking:'不能混入代码'},{type:'text',text}],stop_reason:'end_turn'},[{type:'content_block_delta',delta:{type:'text_delta',text}},{type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}]],
 ['gemini','https://generativelanguage.googleapis.com','/v1beta/models/coder:generateContent',{candidates:[{content:{parts:[{thought:true,text:'不能混入代码'},{text}]},finishReason:'STOP'}]},[{candidates:[{content:{parts:[{text}]},finishReason:'STOP'}]}]]
 ]){
  const cfg={base,key:'native-key',model:'coder',protocol,maxTokens:16384};reply=JSON.stringify(json);
  assert.equal(await ctx.codeModelRequest(messages,cfg),text,protocol+' JSON exact code');const req=calls.at(-1);assert.equal(new URL(req.url).pathname,suffix);assert.equal(ctx.codeModelProtocol({...cfg,protocol:'auto'}),protocol==='anthropic'||protocol==='gemini'?protocol:protocol);
  if(protocol==='anthropic'){assert.equal(req.headers['x-api-key'],'native-key');assert.equal(req.body.system,'制作规则');assert.equal(req.body.messages.length,1);}
  if(protocol==='gemini'){assert.equal(req.headers['x-goog-api-key'],'native-key');assert.equal(req.body.contents[0].role,'user');assert.equal(req.body.systemInstruction.parts[0].text,'制作规则');}
  if(protocol==='responses'){assert.equal(req.body.store,false);assert.equal(req.body.max_output_tokens,16384);}
  if(sse){reply=sse.map(d=>'data: '+JSON.stringify(d)+'\n\n').join('');assert.equal(await ctx.codeModelRequest(messages,{...cfg,streaming:true}),text,protocol+' SSE exact code');
   if(protocol==='anthropic'){reply='data: '+JSON.stringify(sse[0])+'\n\n';await assert.rejects(()=>ctx.codeModelRequest(messages,{...cfg,streaming:true}),/提前结束/);}
  }
 }
 assert.equal(ctx.codeModelProtocol({base:'https://proxy.invalid/v1',model:'claude-code',protocol:'auto'}),'openai','proxy model names must not select native protocol');
 reply=JSON.stringify({candidates:[{content:{parts:[{text:'partial'}]},finishReason:'MAX_TOKENS'}]});await assert.rejects(()=>ctx.codeModelRequest(messages,{base:'https://gemini.invalid/v1beta',key:'k',model:'m',protocol:'gemini'}),/尚未完整/);
 const plan=ctx.codeModelPlan(messages,{base:'https://api.openai.com',key:'k',model:'gpt-5',protocol:'openai',maxTokens:16384});assert.equal(plan.body.max_completion_tokens,16384);assert.equal(plan.body.temperature,undefined);
});
