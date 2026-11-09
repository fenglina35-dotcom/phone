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
 for(const name of ['codeModelConfig','codeModelFormValues','codeModelSave','chatCompletionBody','chatResultText','codeModelRequest'])vm.runInContext(fnSource(src,name),ctx);
 assert.equal(ctx.codeModelSave(),true,label);assert.equal(saved,1);assert.equal(state.settings.chat,role);assert.equal(state.settings.chatRoutes[0].key,'fixture-role-key');
 assert.equal(state.settings.codeModel.base,'https://code.invalid/v1');
 assert.equal(await ctx.codeModelRequest([{role:'user',content:'做一个小游戏'}]),'完整文件正文');
 assert.equal(lastRequest.url,'https://code.invalid/v1/chat/completions');assert.equal(lastRequest.options.headers.Authorization,'Bearer fixture-code-key');
 nodes.code_max.value='1';assert.equal(ctx.codeModelSave(),false);assert.equal(saved,1);assert.equal(state.settings.codeModel.maxTokens,16384);
 ctx.chatReadDiagnosticResponse=async()=>({choices:[{message:{content:'不完整'},finish_reason:'length'}]});
 await assert.rejects(()=>ctx.codeModelRequest([]),/尚未完整/);
}
