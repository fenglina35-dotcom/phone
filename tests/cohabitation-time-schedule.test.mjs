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

function roleTimeSources(){return[
  'const ROLE_TIME_ZONE_CACHE_MS=5*60*1000;let _deviceTimeZoneCache={value:"",at:0};const _timeZoneValidCache=new Map(),_roleTimeFormatterCache=new Map();',
  functionSource('privateNativeShellOn'),
  'function privateNativeAppOn(){return false;}',
  functionSource('nativeTimeEnvironment'),functionSource('nativeTimeZoneOffsets'),
  functionSource('nativeTimeZoneOffset'),
  functionSource('deviceTimeZone'),functionSource('timeZoneValid'),functionSource('roleTimeZone'),
  functionSource('roleTimeFormatter'),functionSource('localRoleTimeParts'),functionSource('roleTimeParts'),
];}

test('the shared role schedule distinguishes weekdays from weekends',()=>{
  const sandbox={Date,Math,String};
  vm.runInNewContext([
    functionSource('toMin'),functionSource('weekdayCN'),functionSource('roleWorkday'),
    functionSource('scheduleDateKey'),functionSource('scheduleDateParse'),functionSource('scheduleLeaveDays'),
    functionSource('scheduleLeaves'),functionSource('roleLeaveOn'),
    functionSource('activityHash'),functionSource('activityPick'),
    functionSource('whereNow'),functionSource('activitySpec'),
    'globalThis.spec=activitySpec;globalThis.where=whereNow;'
  ].join('\n'),sandbox);
  const role={id:'c1',job:'医生',sched:{on:true,work:'医院',home:'家',amS:'08:00',amE:'12:00',pmS:'14:00',pmE:'18:00'}};
  const monday=new Date(2026,7,10,9,0,0);
  const sunday=new Date(2026,7,9,9,0,0);
  assert.equal(sandbox.spec(role,monday).key,'work-am');
  assert.match(sandbox.where(role,monday),/医院.*上班/);
  assert.equal(sandbox.spec(role,sunday).key,'weekend-morning');
  assert.doesNotMatch(sandbox.where(role,sunday),/上班|公司|医院/);
  role.sched.leaves=[{start:'2026-08-10',end:'2026-08-10',reason:'临时请假'}];
  assert.equal(sandbox.spec(role,monday).key,'leave-morning');
  assert.match(sandbox.where(role,monday),/请假日/);
  assert.equal(sandbox.spec(role,new Date(2026,7,11,9,0,0)).key,'work-am');
});

test('role leave and schedule tags persist real dated exceptions and stay hidden',()=>{
  let saves=0,seq=0;
  const sandbox={Date,Math,String,Array,Object,uid:()=>`u${++seq}`,save:()=>{saves++;}};
  vm.runInNewContext([
    functionSource('toMin'),functionSource('scheduleDateKey'),functionSource('scheduleDateParse'),
    functionSource('scheduleLeaveDays'),functionSource('cohabApplyScheduleTags'),
    'globalThis.apply=cohabApplyScheduleTags;'
  ].join('\n'),sandbox);
  const role={id:'c1'};
  const text='我明天请一天假。\n[共同生活请假|2026-08-11|2026-08-11|处理私事]\n[共同生活作息|08:30|12:00|13:30|18:30]';
  const applied=sandbox.apply(text,role,{source:'role'});
  assert.equal(applied.text,'我明天请一天假。');
  assert.equal(applied.leaveChanged,true);
  assert.equal(applied.scheduleChanged,true);
  assert.equal(role.sched.on,true);
  assert.deepEqual([role.sched.amS,role.sched.amE,role.sched.pmS,role.sched.pmE],['08:30','12:00','13:30','18:30']);
  assert.equal(role.sched.leaves.length,1);
  assert.equal(role.sched.leaves[0].reason,'处理私事');
  const cancelled=sandbox.apply('[共同生活销假|2026-08-11|2026-08-11]',role,{source:'role'});
  assert.equal(cancelled.text,'');
  assert.equal(role.sched.leaves.length,0);
  assert.ok(saves>=2);
});

test('time awareness pins today, yesterday and tomorrow to the real calendar',()=>{
  const fixed=new Date(2026,7,10,3,5,0).getTime();
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
  const sandbox={Date:FakeDate,String,S:{settings:{timeAware:true}}};
  vm.runInNewContext([
    ...roleTimeSources(),functionSource('roleClockDate'),
    functionSource('timeZoneOffsetText'),functionSource('timeZoneName'),
    functionSource('hm'),functionSource('weekdayCN'),functionSource('ymdFull'),
    functionSource('dayPartNow'),functionSource('timeAwarenessPrompt'),
    'globalThis.prompt=timeAwarenessPrompt;'
  ].join('\n'),sandbox);
  const prompt=sandbox.prompt('用户','cohab');
  assert.match(prompt,/2026年8月10日 周一 03:05/);
  assert.match(prompt,/今天是周一，昨天是周日，明天是周二/);
  assert.doesNotMatch(prompt,/明天是周日/);
  assert.match(prompt,/共同生活里最高优先级事实/);
});

test('the selected role timezone changes its clock, calendar and daypart',()=>{
  const fixed=Date.parse('2026-08-19T12:24:00Z');
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
  const sandbox={Date:FakeDate,String,S:{settings:{timeAware:true,timeZone:'Asia/Shanghai'}}};
  vm.runInNewContext([
    ...roleTimeSources(),functionSource('roleClockDate'),
    functionSource('timeZoneOffsetText'),functionSource('timeZoneName'),functionSource('hm'),functionSource('weekdayCN'),functionSource('ymdFull'),
    functionSource('dayPartNow'),functionSource('timeAwarenessPrompt'),
    'globalThis.clock=hm;globalThis.prompt=timeAwarenessPrompt;'
  ].join('\n'),sandbox);
  assert.equal(sandbox.clock(fixed),'20:24');
  assert.match(sandbox.prompt('用户','wechat'),/北京时间，Asia\/Shanghai，UTC\+08:00/);
  sandbox.S.settings.timeZone='America/New_York';
  assert.equal(sandbox.clock(fixed),'08:24');
  assert.match(sandbox.prompt('用户','wechat'),/美国纽约时间，America\/New_York，UTC-04:00/);
  assert.match(sandbox.prompt('用户','wechat'),/当前时段是【清晨】/);
});

test('settings expose local, Beijing and all supported global timezones',()=>{
  assert.match(source,/function timeZoneOptions\(/);
  assert.match(source,/Intl\.supportedValuesOf\('timeZone'\)/);
  assert.match(source,/角色所在时区/);
  assert.match(source,/setTimeZone\(this\.value\)/);
  assert.match(source,/const timezone=roleTimeZone\(\)/);
});

test('common life shows a live calendar and reuses the editable role schedule',()=>{
  const system=functionSource('cohabSystem'),online=functionSource('cohabWechatPrompt'),panel=functionSource('cohabSettingsPanel'),schedule=functionSource('schedSet'),render=functionSource('renderCohab');
  assert.match(system,/timeAwarenessPrompt\(S\.me\.name,'cohab'\)/);
  assert.match(system,/roleSchedulePrompt\(c\)/);
  assert.match(system,/作息表会按真实钟点自动把共同生活状态推进/);
  assert.match(panel,/作息时间表/);
  assert.match(panel,/schedSet\('\$\{id\}'\)/);
  assert.match(panel,/roleScheduleBrief\(c\)/);
  assert.match(system,/共同生活请假\|开始日期YYYY-MM-DD/);
  assert.match(online,/共同生活作息\|上午上班HH:MM/);
  assert.match(schedule,/请假安排/);
  assert.match(schedule,/角色也能在共同生活或同步微信里自主请假/);
  assert.match(render,/id="cohabLiveTime"/);
  assert.match(source,/const cohabClock=\$\('#cohabLiveTime'\),cohab=cohabClock&&cohabClockText\(\);if\(cohabClock&&cohabClock\.textContent!==cohab\)cohabClock\.textContent=cohab/);
  assert.match(html,/\.cohab-meta time\{/);
});

test('phone inspection reactions reuse the normal progressive reveal cadence',()=>{
  const deliver=functionSource('cohabPhoneDeliverFact');
  assert.match(deliver,/offRevealTiming\(item\)/);
  assert.match(deliver,/_revealStep/);
  assert.match(deliver,/await new Promise/);
  assert.match(deliver,/回复形式、句数和是否分开发送由你自己决定/);
  assert.match(deliver,/回复是一段还是多句由你自己决定/);
  assert.match(deliver,/cohabPhonePlaybackItems\(result\.items\)/);
  const playback=functionSource('cohabPhonePlaybackItems');
  assert.match(playback,/item\.who!=='ta'/);
  assert.match(playback,/parts\.forEach/);
});
