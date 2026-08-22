import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('one-off date and common-life rows share one chronological hidden timeline',()=>{
  const date={startedAt:100,msgs:[
    {id:'d1',who:'me',text:'线下说过的事',time:120},
    {id:'d2',who:'ta',text:'线下已经回应',time:130}
  ]};
  const cohab={startedAt:200,msgs:[
    {id:'c1',who:'旁白',source:'ta',text:'他回到客厅。',time:210},
    {id:'c2',who:'me',text:'共同生活里的最新一句',time:300}
  ]};
  const sandbox={
    S:{me:{name:'用户'},offline:{role:date},cohabitation:{homes:{role:cohab}}},
    String,Math,Number,
    msgs:()=>[{id:'w1',role:'assistant',type:'text',content:'较早微信回复',time:80}],
    msgToText:m=>m.content||'',callToCN:x=>x
  };
  const names=['offlineIsUserMsg','offlineIsAssistantMsg','offlinePendingStart','offlineOnlineTimelineRows','offlineSceneTimelineRows','offlineUnifiedSceneRows','offlineUnifiedTimelineState'];
  vm.runInNewContext(names.map(functionSource).join('\n')+';globalThis.run=offlineUnifiedTimelineState;',sandbox);
  const state=sandbox.run({id:'role',name:'角色'},cohab,20);
  assert.deepEqual(Array.from(state.rows,x=>x.source),['微信','线下约会现场','线下约会现场','共同生活旁白','共同生活现场']);
  assert.equal(state.current.text,'共同生活里的最新一句');
  assert.equal(state.previousUser.text,'线下说过的事');
  assert.equal(state.previousRole.text,'线下已经回应');
  assert.equal(state.rows.find(x=>x.text==='线下说过的事').current,false,'the non-current scene must not become the pending turn');
});

test('active one-off WeChat prompt carries the latest real face-to-face progress',()=>{
  const sandbox={
    S:{me:{name:'用户'}},Math,
    offlineWechatLiveState:()=>null,offlineContextLimit:()=>20,
    offlineSceneTimelineRows:()=>[
      {time:100,who:'用户',text:'我想去买杯奶茶'},
      {time:110,who:'角色',text:'好，刚好一起过去'}
    ],
    fmtDT:t=>`T${t}`
  };
  vm.runInNewContext(functionSource('offlineWechatLivePrompt')+';globalThis.run=offlineWechatLivePrompt;',sandbox);
  const prompt=sandbox.run({name:'角色'},{started:true,loc:'商场',when:'今天',daypart:'下午'});
  assert.match(prompt,/本场线下约会最近真实进展/);
  assert.match(prompt,/我想去买杯奶茶/);
  assert.match(prompt,/好，刚好一起过去/);
  assert.match(prompt,/不能回到约会开始前悬着的旧微信话题/);
});

test('role remembers only its own Moments from the current WeChat account',()=>{
  const sandbox={
    S:{moments:[
      {authorId:'role',acct:'main',time:300,text:'今天一起看了海',images:['a']},
      {authorId:'role',acct:'other',time:400,text:'另一个账号的内容',images:[]},
      {authorId:'other',acct:'main',time:500,text:'别人发的内容',images:[]}
    ]},
    actId:()=> 'main',fmtDT:t=>`T${t}`,cleanMomentText:x=>String(x||''),Math
  };
  vm.runInNewContext(functionSource('roleOwnMomentsPrompt')+';globalThis.run=roleOwnMomentsPrompt;',sandbox);
  const prompt=sandbox.run({id:'role'},6);
  assert.match(prompt,/今天一起看了海/);
  assert.match(prompt,/配图 1 张/);
  assert.doesNotMatch(prompt,/另一个账号的内容|别人发的内容/);
});

test('all three role contexts receive own-Moments memory without changing reply routes',()=>{
  assert.match(functionSource('buildSystem'),/roleOwnMomentsPrompt\(c,6\)/);
  assert.match(functionSource('offlineSystem'),/offlineLifeNotesPrompt\(c,query\)\+roleOwnMomentsPrompt\(c,6\)/);
  assert.match(functionSource('cohabSystem'),/offlineLifeNotesPrompt\(c,query\)\+roleOwnMomentsPrompt\(c,6\)/);
  assert.match(functionSource('offlineSystem'),/offlineWechatLiveOn\(\)\?offlineUnifiedTimelinePrompt/);
  assert.match(source,/线上\/线下同步已关闭[\s\S]{0,120}平行独立世界处理/);
});
