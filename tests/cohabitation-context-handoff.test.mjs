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

test('co-living may use the role-selected auxiliary model without changing old session defaults',async()=>{
  const calls=[];
  const sandbox={
    S:{settings:{chat:{base:'https://main.example',key:'m',model:'main-model',temp:.8,maxTokens:300},aux:{base:'https://aux.example',key:'a',model:'aux-model'}}},
    gameModelSessionPage:()=>false,chatRouteSessionPage:()=>true,aiCoreOn:()=>false,
    chatRequestRoute:()=>null,chatMainCopy:x=>({...x}),
    fetchT:async(url,opt)=>{calls.push({url,body:JSON.parse(opt.body)});return{ok:true,json:async()=>({choices:[{message:{content:'ok'}}]})};},
    chatResultText:async(_m,_o,d)=>d.choices[0].message.content,apiErrorCN:()=>'',Object
  };
  vm.runInNewContext([
    functionSource('chatModelIsTtsOnly'),functionSource('chatModelTypeError'),functionSource('chatModelAssertText'),
    functionSource('chatAPI'),'globalThis.run=chatAPI;'
  ].join('\n'),sandbox);
  await sandbox.run([],{aux:true,allowSessionModel:true});
  await sandbox.run([],{aux:true});
  assert.equal(calls[0].body.model,'aux-model');
  assert.match(calls[0].url,/aux\.example/);
  assert.equal(calls[1].body.model,'main-model');
  assert.match(calls[1].url,/main\.example/);
});

test('recent co-living context crosses into WeChat only as hidden background',()=>{
  const sandbox={S:{me:{name:'我'}},String,Math};
  vm.runInNewContext(functionSource('cohabRecentContext')+';globalThis.run=cohabRecentContext;',sandbox);
  const d={msgs:[{who:'日期',text:'start'},{who:'旁白',text:'他把钥匙放在桌上。'},{who:'ta',text:'我先去洗手。'}]},c={name:'先生'};
  const prompt=sandbox.run(d,c,10);
  assert.match(prompt,/隐藏背景/);
  assert.match(prompt,/他把钥匙放在桌上/);
  assert.match(prompt,/我先去洗手/);
  assert.match(prompt,/不要在微信里照抄旁白/);
  assert.deepEqual(d.msgs.map(x=>x.text),['start','他把钥匙放在桌上。','我先去洗手。']);
});

test('returning to common life continues newer online plot exactly once',()=>{
  let online=[
    {time:200,source:'微信',speaker:'user',who:'我',text:'那我在线上等你解释。'},
    {time:250,source:'微信',speaker:'assistant',who:'先生',text:'回去以后我当面说。'}
  ];
  let scene=[
    {time:100,source:'线下现场',speaker:'assistant',who:'先生',text:'旧现场回应。',current:false},
    {time:150,source:'线下现场',speaker:'user',who:'我',text:'离开前悬着的旧输入。',current:true},
    {time:300,source:'线下现场',speaker:'user',who:'我',text:'现在你说吧。',current:true}
  ];
  const sandbox={S:{me:{name:'我'}},String,Math,offlineWechatLiveOn:()=>true,cohabContextLimit:()=>20,offlineOnlineTimelineRows:()=>online,offlineSceneTimelineRows:()=>scene,offlineCurrentTurnPrompt:()=> '旧共同生活续演'};
  vm.runInNewContext(`${functionSource('cohabOnlineReturnState')}\n${functionSource('cohabCurrentTurnPrompt')}\nglobalThis.run=cohabCurrentTurnPrompt;globalThis.state=cohabOnlineReturnState;`,sandbox);
  const prompt=sandbox.run({name:'先生'},{},'');
  assert.match(prompt,/从线上聊天返回共同生活/);
  assert.match(prompt,/回去以后我当面说/);
  assert.match(prompt,/现在你说吧/);
  assert.doesNotMatch(prompt,/离开前悬着的旧输入/);
  scene=scene.concat({time:350,source:'线下现场',speaker:'assistant',who:'先生',text:'已经接住线上剧情。',current:false});
  assert.equal(sandbox.state({name:'先生'},{}),null,'a delivered face-to-face reply consumes the online handoff');
  assert.equal(sandbox.run({name:'先生'},{}),'旧共同生活续演');
});

test('an online arrival queues and writes one real face-to-face handoff without copying the WeChat line',async()=>{
  const d={phase:'away',msgs:[],pendingArrival:null},root={enabled:true,paused:false,cid:'c1'},scheduled=[];
  const sandbox={
    S:{me:{name:'我'}},Date,Set,String,Math,
    cohabWechatState:()=>d,
    cohabApplyScheduleTags:text=>({text}),
    cohabApplyStateTags:text=>{d.phase='home';return{matched:true,text:String(text).replace(/\[[^\]]+\]/g,'').trim()};},
    cohabInferOnlineState:()=>false,
    cohabRoot:()=>root,cohabData:()=>d,getC:()=>({id:'c1',name:'先生',model:'aux'}),
    uid:(()=>{let n=0;return()=>`id${++n}`;})(),save:()=>{},
    setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},
    cohabSceneActive:()=>false,_off:null,offRender:()=>{},toast:()=>{},
    offlineReplyBudget:()=>600,
    cohabReplyCore:async()=>({items:[{id:'n1',who:'旁白',source:'ta',text:'他推门进屋，把外套挂好。'},{id:'t1',who:'ta',source:'ta',text:'我回来了。'}]}),
    cohabPushMessage:(_d,m)=>{_d.msgs.push(m);return m;},cohabMaybeSummarize:()=>{}
  };
  vm.runInNewContext([
    functionSource('cohabConsumeOnlineState'),
    functionSource('cohabQueueArrival'),
    functionSource('cohabScheduleArrival'),
    'const _cohabArrivalBusy=new Set();',
    functionSource('cohabGenerateArrival'),
    'globalThis.consume=cohabConsumeOnlineState;globalThis.generate=cohabGenerateArrival;'
  ].join('\n'),sandbox);
  const visible=sandbox.consume('进来了。\n[共同生活状态|到家|在玄关]',{id:'c1'},'c1');
  assert.equal(d.phase,'home');
  assert.ok(d.pendingArrival);
  assert.match(d.pendingArrival.wechatText,/进来了/);
  assert.equal(scheduled.length,1);
  const delivered=await sandbox.generate('c1',{interactive:true});
  assert.equal(delivered,true);
  assert.equal(d.pendingArrival,null);
  assert.deepEqual(d.msgs.map(x=>x.text),['他推门进屋，把外套挂好。','我回来了。']);
  assert.ok(!d.msgs.some(x=>x.text.includes('进来了')));
});

test('common-life reply core is wired to the common-life repair prompt and arrival retry',async()=>{
  assert.match(source,/async function cohabReplyCore\(/);
  assert.match(source,/cohabRepairMessages\(c,o,turn/);
  assert.match(source,/cohabRoleChat\(c,offlineRequestMessages/);
  assert.match(source,/allowSessionModel:true/);
  assert.match(source,/function offReply\(\).*pendingArrival.*cohabGenerateArrival/s);
  assert.match(source,/cohabSystem\(c,o,query\).*offlineUnifiedTimelinePrompt/s);
  const notices=[],calls=[];
  const sandbox={
    String,Object,Map,
    cohabData:()=>({settings:{replyModel:'main',replyApiRoute:'follow'}}),
    cohabReplyAux:()=>false,
    cohabReplyRouteIndex:()=>null,
    wechatAuxConfigured:()=>true,
    toast:(text,ms)=>notices.push([text,ms]),
    chatAPI:async(_messages,opt)=>{calls.push(opt.aux?'aux':'main');if(calls.length===1)throw new Error('primary failed');return calls.length===2?'aux rewrite':'main reply';}
  };
  vm.runInNewContext(`const _cohabActualModelRoute=new Map();${functionSource('cohabModelRouteNotice')}${functionSource('cohabRoleChat')}globalThis.run=cohabRoleChat;`,sandbox);
  await sandbox.run({id:'c1'},[],{},{});
  await sandbox.run({id:'c1'},[],{},{});
  assert.deepEqual(calls,['main','aux','main']);
  assert.deepEqual(notices,[['已切换副模型',3000],['已切换主模型',3000]]);
});

test('the existing online-offline sync switch also gates common-life context',()=>{
  assert.match(source,/function cohabWechatState\(c\)\{[^}]*!offlineWechatLiveOn\(\)/);
  assert.match(source,/const contextLimit=cohabContextLimit\(o\),shared=offlineWechatLiveOn\(\)\?offlineUnifiedTimelinePrompt\(c,o,contextLimit\)/);
  assert.match(source,/约会中同步到线上 · 含共同生活/);
  assert.match(source,/可见记录与格式不互相复制/);
  assert.match(source,/const _wechatLive=_main\?wechatLiveScene\(c\):null/);
  assert.match(source,/const _liveScene=!!_wechatLive/);
  assert.match(source,/if\(!_natural&&!_liveScene&&lu\)/);
});

test('common-life supplies exact current time and elapsed state durations',()=>{
  const now=Date.UTC(2026,7,10,4,0,0),sandbox={
    S:{settings:{timeAware:true}},
    Date:{now:()=>now},Math,
    fmtDT:ts=>new globalThis.Date(ts).toISOString(),fmtDur:ms=>`${Math.round(ms/60000)}m`,cohabClockText:()=>`2026年8月10日 周一 12:00`,
    cohabStatusLabel:d=>d.phase
  };
  vm.runInNewContext(functionSource('cohabTimeContext')+';globalThis.run=cohabTimeContext;',sandbox);
  const out=sandbox.run({phase:'away',startedAt:now-180*60000,phaseAt:now-35*60000,returnedAt:0});
  assert.match(out,/当前准确时间/);
  assert.match(out,/已经持续约180m/);
  assert.match(out,/已经约35m/);
  assert.match(source,/以前重要及相关的线下见面记忆/);
  assert.match(source,/不能把旧事说成刚刚/);
});
