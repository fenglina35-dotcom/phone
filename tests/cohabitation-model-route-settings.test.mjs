import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}(`),syncStart=source.indexOf(`function ${name}(`),start=asyncStart>=0?asyncStart:syncStart;
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escape=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('old combined common-life route settings migrate into separate model and api route fields',()=>{
  const sandbox={S:{settings:{offHist:50,offSummaryMode:'split',offSummaryModel:'aux'}},Math,String};
  vm.runInNewContext(functionSource('cohabSettings')+';globalThis.run=cohabSettings;',sandbox);
  const migrated=sandbox.run({settings:{replyRoute:'aux',summaryRoute:'main'}});
  assert.equal(migrated.replyModel,'aux');
  assert.equal(migrated.replyApiRoute,'follow');
  assert.equal(migrated.summaryModel,'main');
  assert.equal(migrated.summaryApiRoute,'reply');
  const configured=sandbox.run({settings:{replyModel:'main',replyApiRoute:'2',summaryModel:'aux',summaryApiRoute:'3'}});
  assert.equal(configured.replyModel,'main');
  assert.equal(configured.replyApiRoute,'2');
  assert.equal(configured.summaryModel,'aux');
  assert.equal(configured.summaryApiRoute,'3');
});

test('common-life model and api route choices resolve independently',()=>{
  const sandbox={S:{settings:{}},Math,String,Number,CHAT_ROUTE_NAMES:['路线一','路线二','路线三','路线四']};
  vm.runInNewContext([
    functionSource('cohabSettings'),functionSource('cohabReplyAux'),functionSource('cohabReplyRouteIndex'),
    functionSource('cohabSummaryAux'),functionSource('cohabSummaryRouteIndex'),
    'globalThis.replyAux=cohabReplyAux;globalThis.replyRoute=cohabReplyRouteIndex;globalThis.summaryAux=cohabSummaryAux;globalThis.summaryRoute=cohabSummaryRouteIndex;'
  ].join('\n'),sandbox);
  const role={model:'aux'},d={settings:{replyModel:'role',replyApiRoute:'1',summaryModel:'reply',summaryApiRoute:'reply'}};
  assert.equal(sandbox.replyAux(role,d),true);
  assert.equal(sandbox.replyRoute(d),1);
  assert.equal(sandbox.summaryAux(role,d),true);
  assert.equal(sandbox.summaryRoute(d),1);
  d.settings.replyModel='main';d.settings.replyApiRoute='follow';d.settings.summaryModel='aux';d.settings.summaryApiRoute='3';
  assert.equal(sandbox.replyAux(role,d),false);
  assert.equal(sandbox.replyRoute(d),null);
  assert.equal(sandbox.summaryAux(role,d),true);
  assert.equal(sandbox.summaryRoute(d),3);
});

test('common-life settings visibly separate models from api routes',()=>{
  const sandbox={
    S:{settings:{}},Math,String,Number,CHAT_ROUTE_NAMES:['路线一','路线二','路线三','路线四'],
    getC:()=>({sched:{on:false}}),roleScheduleBrief:()=>'未启用',esc:x=>String(x??''),
    cohabTogetherScene:()=>true,_offSel:null,manualReplySceneOn:()=>false,_off:null
  };
  vm.runInNewContext([
    functionSource('cohabSettings'),functionSource('cohabModelLabel'),functionSource('cohabApiRouteLabel'),
    functionSource('cohabSettingsBrief'),functionSource('cohabSettingsPanel'),'globalThis.panel=cohabSettingsPanel;'
  ].join('\n'),sandbox);
  const html=sandbox.panel('c1',{settings:{replyModel:'role',replyApiRoute:'follow',summaryModel:'reply',summaryApiRoute:'reply'},summaries:[]});
  assert.match(html,/对话模型/);
  assert.match(html,/对话 API 路线/);
  assert.match(html,/总结模型/);
  assert.match(html,/总结 API 路线/);
  assert.match(html,/跟随微信角色/);
  assert.match(html,/跟随微信当前路线/);
  assert.match(html,/路线四/);
  assert.match(html,/固定路线只影响共同生活，不会切换微信/);
});

test('chat api can use a fixed saved route without changing the active WeChat route',async()=>{
  const calls=[],fixed={base:'https://route-two.example/v1',key:'r2',model:'route-two-main',temp:.6,maxTokens:700,aux:{base:'https://route-two-aux.example/v1',key:'r2a',model:'route-two-aux'}};
  const sandbox={
    S:{settings:{chat:{base:'https://wechat.example/v1',key:'wx',model:'wechat-main',temp:.8,maxTokens:900},aux:{base:'https://wechat-aux.example/v1',key:'wxa',model:'wechat-aux'}}},
    gameModelSessionPage:()=>false,chatRouteSessionPage:()=>false,chatRequestRoute:i=>i===1?fixed:null,chatMainCopy:x=>({...x}),
    aiCoreOn:()=>false,fetchT:async(url,opt)=>{calls.push({url,body:JSON.parse(opt.body)});return{ok:true,json:async()=>({choices:[{message:{content:'ok'}}]})};},
    chatResultText:async(_m,_o,d)=>d.choices[0].message.content,apiErrorCN:()=>'',Object
  };
  vm.runInNewContext([
    functionSource('chatModelIsTtsOnly'),functionSource('chatModelTypeError'),functionSource('chatModelAssertText'),
    functionSource('chatAPI'),'globalThis.run=chatAPI;'
  ].join('\n'),sandbox);
  await sandbox.run([],{routeIndex:1});
  await sandbox.run([],{routeIndex:1,aux:true});
  assert.equal(calls[0].body.model,'route-two-main');
  assert.match(calls[0].url,/route-two\.example/);
  assert.equal(calls[1].body.model,'route-two-aux');
  assert.match(calls[1].url,/route-two-aux\.example/);
  assert.equal(sandbox.S.settings.chat.model,'wechat-main');
});
