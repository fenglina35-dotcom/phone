import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

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

function roleTimeSources(){return[
  'const ROLE_TIME_ZONE_CACHE_MS=5*60*1000;let _deviceTimeZoneCache={value:"",at:0};const _timeZoneValidCache=new Map(),_roleTimeFormatterCache=new Map();',
  functionSource('privateNativeShellOn'),
  'function privateNativeAppOn(){return false;}',
  functionSource('nativeTimeEnvironment'),functionSource('nativeTimeZoneOffsets'),
  functionSource('nativeTimeZoneOffset'),
  functionSource('deviceTimeZone'),functionSource('timeZoneValid'),functionSource('roleTimeZone'),
  functionSource('roleTimeFormatter'),functionSource('localRoleTimeParts'),functionSource('roleTimeParts'),
];}

test('a direct current-time answer is corrected at delivery time',()=>{
  const fixed=new Date(2026,7,19,20,24,0).getTime();
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
  const sandbox={Date:FakeDate,Math,String,S:{settings:{timeAware:true}}};
  vm.runInNewContext([
    ...roleTimeSources(),
    functionSource('clockCNNumber'),functionSource('currentClockSpoken'),
    functionSource('directClockQuestion'),functionSource('refreshDirectClockReply'),
    'globalThis.refresh=refreshDirectClockReply;'
  ].join('\n'),sandbox);
  assert.equal(sandbox.refresh('看看现在几点了，小狗。晚上八点十九分。','现在几点了？'),'看看现在几点了，小狗。晚上八点二十四分。');
  assert.equal(sandbox.refresh('昨天晚上八点聊过。','昨天聊了什么？'),'昨天晚上八点聊过。');
});

test('waking in an overnight call closes lull and records the actual interval',()=>{
  const end=new Date(2026,7,19,8,10,0).getTime(),start=new Date(2026,7,18,23,40,0).getTime();
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[end]));}static now(){return end;}}
  const sandbox={Date:FakeDate,Math,String,S:{settings:{timeAware:true},me:{name:'用户',sleep:{active:null,records:[]}},contacts:[]},callPersist:()=>{},roleServerPushSyncSoon:()=>{}};
  vm.runInNewContext([
    'let _call={lull:true,sleepStartedAt:'+start+',lastSleep:null};',
    ...roleTimeSources(),
    functionSource('callWakeIntent'),functionSource('sleepRecordAdd'),
    functionSource('dayStartMs'),functionSource('dayGap'),functionSource('callCompleteWake'),
    'globalThis.complete=callCompleteWake;globalThis.state=()=>_call;'
  ].join('\n'),sandbox);
  const row=sandbox.complete('我醒了',end),state=sandbox.state();
  assert.ok(row);
  assert.equal(state.lull,false);
  assert.equal(state.sleepStartedAt,0);
  assert.equal(state.lastSleep.duration,8.5*3600000);
  assert.equal(state.lastSleep.crossedDays,1);
  assert.equal(sandbox.S.me.sleep.records.length,1);
  assert.equal(sandbox.S.me.sleep.records[0].source,'call');
});

test('wake-up wording cannot be mistaken for another sleep request',()=>{
  const sandbox={String};
  vm.runInNewContext([
    functionSource('callWakeIntent'),functionSource('callSleepIntent'),functionSource('callSleepStartIntent'),
    'globalThis.wake=callWakeIntent;globalThis.sleep=callSleepIntent;globalThis.start=callSleepStartIntent;'
  ].join('\n'),sandbox);
  assert.equal(sandbox.wake('我醒了，我睡了多久？'),true);
  assert.equal(sandbox.sleep('我醒了，我睡了多久？'),false);
  assert.equal(sandbox.start('我要睡了，晚安'),true);
});

test('call prompt makes wake-up the new cross-day event without inventing measured sleep',()=>{
  const prompt=functionSource('callSleepWakePrompt');
  assert.match(prompt,/刚刚结束通话陪睡/);
  assert.match(prompt,/不是手表或 HealthKit 测得的真实睡眠/);
  assert.match(prompt,/绝不能说“你睡了这么久”/);
  assert.match(prompt,/睡前的话题属于过去/);
  assert.match(prompt,/跨过了【/);
  assert.match(functionSource('callPersist'),/sleepStartedAt:\+_call\.sleepStartedAt\|\|0,lastSleep:_call\.lastSleep\|\|null/);
  assert.match(functionSource('restoreActiveCall'),/sleepStartedAt:\+p\.sleepStartedAt\|\|0,lastSleep:p\.lastSleep\|\|null/);
});
