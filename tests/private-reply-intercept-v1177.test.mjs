import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const script=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-reply-intercept.js');

test('private v1178 loads diagnostic parity between app core and theater extension',()=>{
  for(const file of ['index.html','小手机.html']){
    const html=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/'+file);
    assert.match(html,/app\.js\?v=1214[^\n]*<\/script>\s*<script src="private-reply-intercept\.js\?v=1213&r=v1178-private-intercept-parity-1"[^\n]*<\/script>\s*<script src="cohab-theater\.js\?v=1213/);
  }
  assert.doesNotMatch(read('小手机.html'),/private-reply-intercept\.js/);
});

test('online, offline and cohab settings expose the last intercepted model text',()=>{
  assert.match(script,/window\.__NORTH_PRIVATE_REPLY_INTERCEPT__='v1178-private-intercept-parity-1'/);
  assert.match(script,/roleInterceptDiagnosticOpen\('\$\{id\}','online'\)/);
  assert.match(script,/roleInterceptDiagnosticOpen\('\$\{_off&&_off\.id\|\|''\}','offline'\)/);
  assert.match(script,/roleInterceptDiagnosticOpen\('\$\{id\}','cohab'\)/);
  assert.ok((script.match(/查看上一轮拦截内容/g)||[]).length>=3);
  assert.match(script,/sessionStorage\.setItem\(KEY,JSON\.stringify\(rows\)\)/);
});

test('diagnostic capture excludes theater JSON and release is explicit and rollback-safe',()=>{
  assert.match(script,/if\(!\(opt&&opt\.theaterActor\)\)turnCandidate\(activeTurn,out,opt\)/);
  assert.match(script,/if\(!await uiConfirm\('把这一轮全部/);
  assert.match(script,/_interceptReleased:true/);
  assert.match(script,/if\(list&&list\.length>before\)list\.splice\(before\)/);
  assert.match(script,/只写入原文，不重新执行其中的功能标签/);
});


async function captureTurn(candidates,shown){
  const values=new Map(),rows=[],role={id:'r1',name:'先生'};
  let index=0,modal='';
  const ctx={chatRequestDiagnostic:()=>null,console,sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
    actId:()=> 'main',getC:()=>role,msgsForAccount:()=>rows,msgs:()=>rows,
    roleVisibleEnvelopeText:String,cleanRolePunct:String,renderContactSettings:()=>'',
    openModal:html=>{modal=html;},cohabSettingsPanel:()=>'',offAI:async()=>{},
    fmtDT:String,esc:String,chatAPI:async()=>candidates[index++].raw};
  ctx.window=ctx;
  ctx.aiReply=async()=>{for(const item of candidates)await ctx.chatAPI([],item.opt||{});rows.push(...shown.map(content=>({role:'assistant',type:'text',content})));};
  vm.runInNewContext(script,ctx);
  await ctx.aiReply('r1');
  ctx.roleInterceptDiagnosticOpen('r1','online');
  return{rows,index,modal,records:[...values.values()].flatMap(v=>Object.values(JSON.parse(v)))};
}

test('private diagnostic does not discard a delivered reply just because an auxiliary request followed it',async()=>{
  const primary='[内心|在听你说]\n咬。\n过来厨房。\n[记住|不吃香菜]';
  const result=await captureTurn([{raw:primary},{raw:'[不启动外卖]',opt:{roleInterceptPurpose:'delivery-action'}}],['咬。','过来厨房。']);
  assert.equal(result.index,2);
  assert.equal(result.records[0].items.length,1);
  assert.equal(result.records[0].items[0].raw,'[不启动外卖]');
  assert.match(result.modal,/外卖动作补判/);
  assert.match(result.modal,/不是聊天格式错误/);
});

test('ordinary canonical thought and memory processing creates no private intercept record',async()=>{
  const result=await captureTurn([{raw:'[内心|在听你说]\n咬。\n过来厨房。\n[记住|不吃香菜]'}],['咬。','过来厨房。']);
  assert.equal(result.index,1);
  assert.equal(result.records.length,0);
});

test('private diagnostic keeps a partially truncated candidate instead of accepting any short matching bubble',async()=>{
  const result=await captureTurn([{raw:'第一句。\n后面被丢了。'}],['第一句。']);
  assert.equal(result.records[0].items.length,1);
  assert.equal(result.records[0].items[0].raw,'第一句。\n后面被丢了。');
});

test('a genuinely replaced private candidate remains available',async()=>{
  const result=await captureTurn([{raw:'第一份错误回复。'},{raw:'第二份采用回复。'}],['第二份采用回复。']);
  assert.equal(result.records[0].items.length,1);
  assert.equal(result.records[0].items[0].raw,'第一份错误回复。');
});
