import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
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

function stateSandbox(){
  const d={phase:'home',activity:'在玄关',place:'玄关',phaseAt:1,placeAt:1,unreadReturn:false};
  const sandbox={
    d,Date,Math,String,RegExp,
    cohabData:()=>d,save:()=>{},cohabSceneActive:()=>false,render:()=>{},
    getC:()=>({name:'角色'}),toast:()=>{}
  };
  vm.runInNewContext([
    functionSource('cohabPhaseLabel'),functionSource('cohabPhaseDefaultActivity'),
    functionSource('cohabActivityClean'),functionSource('cohabPlaceClean'),functionSource('cohabHomeRoom'),
    functionSource('cohabTogetherScene'),functionSource('cohabSetPlace'),
    functionSource('cohabStatusLabel'),functionSource('cohabSetPhase'),
    functionSource('cohabInferVisiblePlace'),functionSource('cohabApplyStateTags'),
    'globalThis.apply=cohabApplyStateTags;globalThis.label=cohabStatusLabel;globalThis.together=cohabTogetherScene;globalThis.infer=cohabInferVisiblePlace;'
  ].join('\n'),sandbox);
  return sandbox;
}

test('an actual room move updates the single persisted place and top status',()=>{
  const s=stateSandbox();
  const result=s.apply('抱我回去。\n[共同生活位置|卧室]','c1',{source:'role'});
  assert.equal(result.text,'抱我回去。');
  assert.equal(s.d.phase,'home');
  assert.equal(s.d.place,'卧室');
  assert.equal(s.d.activity,'在卧室');
  assert.equal(s.label(s.d),'在家 · 在卧室');
});

test('visible-action fallback ignores questions and accepts completed movement',()=>{
  const s=stateSandbox();
  assert.equal(s.infer('要不要回卧室？','c1',s.d),false);
  assert.equal(s.d.place,'玄关');
  assert.equal(s.infer('他把她抱起来，转身回了卧室。','c1',s.d),true);
  assert.equal(s.d.place,'卧室');
  assert.equal(s.label(s.d),'在家 · 在卧室');
});

test('a room location tag completes a stale returning state before persisting the room',()=>{
  const s=stateSandbox();
  s.d.phase='returning';s.d.activity='刚忙完在回家的路上';s.d.place='公司';
  const result=s.apply('走。\n[共同生活位置|卧室]','c1',{source:'wechat'});
  assert.equal(result.text,'走。');
  assert.equal(s.d.phase,'home');
  assert.equal(s.d.place,'卧室');
  assert.equal(s.label(s.d),'在家 · 在卧室');
});

test('an agreed shared room move reconciles the exact online turn without a hidden tag',()=>{
  const d={phase:'returning',activity:'刚忙完在回家的路上',place:'公司',phaseAt:1,placeAt:1,unreadReturn:false},queued=[];
  const sandbox={
    d,Date,Math,String,RegExp,
    cohabData:()=>d,cohabWechatState:()=>d,cohabApplyScheduleTags:text=>({text}),
    save:()=>{},cohabSceneActive:()=>false,render:()=>{},getC:()=>({name:'先生'}),toast:()=>{},
    cohabQueueArrival:(_id,text)=>queued.push(text)
  };
  vm.runInNewContext([
    functionSource('cohabPhaseLabel'),functionSource('cohabPhaseDefaultActivity'),
    functionSource('cohabActivityClean'),functionSource('cohabPlaceClean'),functionSource('cohabHomeRoom'),
    functionSource('cohabTogetherScene'),functionSource('cohabSetPlace'),functionSource('cohabStatusLabel'),
    functionSource('cohabSetPhase'),functionSource('cohabApplyStateTags'),functionSource('cohabOnlineVisibleClauses'),
    functionSource('cohabOnlineRoomTarget'),functionSource('cohabOnlineRoomMoveAgreed'),
    functionSource('cohabInferOnlineSharedMove'),functionSource('cohabInferOnlineState'),functionSource('cohabConsumeOnlineState'),
    'globalThis.consume=cohabConsumeOnlineState;globalThis.label=cohabStatusLabel;'
  ].join('\n'),sandbox);
  const visible=sandbox.consume('走。\n先生带你去。',{id:'c1'},'c1',{userText:'去卧室说'});
  assert.equal(visible,'走。\n先生带你去。');
  assert.equal(d.phase,'home');
  assert.equal(d.place,'卧室');
  assert.equal(sandbox.label(d),'在家 · 在卧室');
  assert.deepEqual(queued,['走。\n先生带你去。']);
});

test('questions, refusals and deferred moves do not fabricate an arrival',()=>{
  const s=stateSandbox();
  vm.runInNewContext([
    functionSource('cohabOnlineVisibleClauses'),functionSource('cohabOnlineRoomTarget'),
    functionSource('cohabOnlineRoomMoveAgreed'),
    'globalThis.target=cohabOnlineRoomTarget;globalThis.agreed=cohabOnlineRoomMoveAgreed;'
  ].join('\n'),s);
  assert.equal(s.target('要不要去卧室说？'),'');
  assert.equal(s.target('等你到家再去卧室说'),'');
  assert.equal(s.agreed('我还在路上，等我回家。'),false);
  assert.equal(s.agreed('不去卧室。'),false);
});

test('together outing stays face-to-face while a solo outing does not',()=>{
  const s=stateSandbox();
  s.apply('[共同生活状态|一起外出|公园]','c1',{source:'role'});
  assert.equal(s.d.phase,'together-away');
  assert.equal(s.d.place,'公园');
  assert.equal(s.label(s.d),'一起外出 · 公园');
  assert.equal(s.together(s.d),true);

  s.apply('[共同生活状态|一起回家|玄关]','c1',{source:'role'});
  assert.equal(s.d.phase,'home');
  assert.equal(s.d.place,'玄关');
  assert.equal(s.d.unreadReturn,false,'returning together must not create a solo-arrival banner');

  vm.runInNewContext("cohabSetPhase('c1','home',0,{silent:true,place:'书房'})",s);
  assert.equal(s.d.place,'书房','an explicit place option must not depend on an activity label');

  s.apply('[共同生活状态|外出|买东西]','c1',{source:'role'});
  assert.equal(s.d.phase,'away');
  assert.equal(s.together(s.d),false);
});

test('prompts and UI preserve the together-outing boundary',()=>{
  assert.match(source,/\[共同生活位置\|准确地点\]/);
  assert.match(source,/\[共同生活状态\|一起外出\|准确地点\]/);
  assert.match(source,/“在家”和“一起外出”都代表两个人仍在同一个面对面共同生活现场/);
  assert.match(functionSource('offSay'),/!cohabTogetherScene\(o\)/);
  assert.match(functionSource('offAI'),/!cohabTogetherScene\(o\)/);
  assert.match(functionSource('renderCohab'),/away=!cohabTogetherScene\(o\)/);
  assert.match(functionSource('cohabConsumeOnlineState'),/before!==['"]together-away['"]/);
  assert.match(html,/\.cohab-status-chip\.phase-together-away i/);
  assert.match(html,/\.cohab-wx-state\.phase-together-away i/);
});
