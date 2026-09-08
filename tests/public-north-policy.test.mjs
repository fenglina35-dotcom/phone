import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../public-north-policy.js', import.meta.url), 'utf8'), ctx);
const p = ctx.NorthPublicPolicy, now = Date.parse('2026-09-08T15:00:00Z');
const payload = () => ({ linked:true,deviceId:'public-phone',lastSyncAt:now,snapshot:{
  generatedAt:now,snapshotSequence:10,
  screenTime:{reportAvailable:true,generatedAt:now,totalSeconds:340,apps:[{id:'app1',name:'音乐',usedSeconds:123,locked:true}]},
  deviceTelemetry:{batteryLevel:0.34,batteryState:'充电中',generatedAt:now},
  health:{steps:100,generatedAt:now,heartRateBpm:98,sleepSeconds:20000,hrvMs:88}
}});
test('public command requires permission and the exact device App ID',()=>{
 const facts=p.normalize(payload(),now),permission={roleAccess:true,permissions:{appControl:true,limits:true}};
 const result=p.command(facts,permission,'lock','app1',0,'角色',now);
 assert.equal(result.externalAppId,'app1');assert.equal(result.scope,'external');assert.equal(result.internalAppId,'');
 assert.throws(()=>p.command(facts,permission,'lock','音乐',0,'角色',now),/稳定 ID/);
 assert.throws(()=>p.command(facts,{roleAccess:false,permissions:permission.permissions},'unlock','app1',0,'角色',now),/权限/);
 assert.throws(()=>p.command(facts,permission,'limit','app1',0,'角色',now),/限额/);
 assert.equal(p.command(facts,permission,'limit','app1',30,'角色',now).minutes,30);
 assert.throws(()=>p.command(facts,permission,'heartRate','',0,'角色',now),/不支持/);
});
test('public location and footprints preserve original time and permission boundaries',()=>{
 const x=payload();x.snapshot.location={lat:'',lng:false};x.snapshot.footprints=[{lat:31,lng:121,place:'公园',ts:now-60000},{lat:null,lng:121}];
 const n=p.normalize(x,now);assert.equal(n.location,null);assert.equal(n.footprints.length,1);assert.equal(n.footprints[0].generatedAt,now-60000);
 assert.doesNotMatch(p.prompt(n,{roleAccess:true,permissions:{location:true}},now),/公园/);
 assert.match(p.prompt(n,{roleAccess:true,permissions:{footprints:true}},now),/公园/);
});
test('North 1.0(8) legacy report stays usable without inventing a date or timezone',()=>{
  const n=p.normalize(payload(),now);
  assert.equal(n.screen.available,true);assert.equal(n.screen.totalSeconds,340);
  assert.equal(n.screen.apps[0].usedSeconds,123);assert.equal(n.screen.usageDay,'');
  assert.equal(n.battery.level,.34);assert.equal(n.health.steps,100);
  assert.deepEqual(Object.keys(n.health).sort(),['availability','fresh','generatedAt','source','steps']);
});
test('public zero steps are ambiguous in the actual shipped binary',()=>{
  const x=payload();x.snapshot.health.steps=0;const n=p.normalize(x,now);
  assert.equal(n.health.availability,'zero-or-unavailable');
  assert.match(p.prompt(n,{roleAccess:true,permissions:{health:true}},now),/无法确认真实零步/);
});
test('no manual unlock attribution without a native event capability',()=>{
  assert.equal(p.capabilities.explicitManualUnlockEvents,false);
  assert.match(p.prompt(p.normalize(payload(),now),{roleAccess:true,permissions:{appControl:true}},now),/不能证明用户手动解锁/);
});
test('old production parser rejects the real public report shape',()=>{
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const line=source.split(/\r?\n/).find(x=>x.startsWith('function companionUsagePayloadDecision('));
  const actual=vm.createContext({Date,companionTime:v=>typeof v==='number'?v:Date.parse(v)||0,
    companionUsageDayAt:()=> '2026-09-08'});
  vm.runInContext(line+';this.decide=companionUsagePayloadDecision;',actual);
  const report=payload().snapshot.screenTime;
  assert.equal(actual.decide({},report).accept,false);
  assert.equal(actual.decide({},report).reason,'not-current-day');
  assert.equal(p.normalize(payload(),now).screen.available,true);
});
test('missing and explicit null are not coerced to real zero',()=>{
  const x=payload();x.snapshot.deviceTelemetry.batteryLevel=null;x.snapshot.health.steps=null;
  x.snapshot.screenTime.totalSeconds=null;delete x.snapshot.screenTime.apps[0].usedSeconds;
  const n=p.normalize(x,now);assert.equal(n.battery,null);assert.equal(n.health,null);
  assert.equal(n.screen.totalSeconds,null);assert.equal(n.screen.apps[0].usedSeconds,null);
  x.snapshot.health.steps=0;assert.equal(p.normalize(x,now).health.steps,0);
});
test('unlinked payload cannot expose cached private facts',()=>{
  const x=payload();x.linked=false;const n=p.normalize(x,now);
  assert.equal(n.health,null);assert.equal(n.battery,null);assert.equal(n.screen.apps.length,0);
});
test('older or foreign device response cannot replace current state',()=>{
  const n=p.normalize(payload(),now);assert.equal(p.canReplace(n,n),false);
  const newer={...n,sequence:11,generatedAt:now+1};assert.equal(p.canReplace(n,newer),true);
  assert.equal(p.canReplace(n,{...newer,deviceId:'other'}),false);
  assert.equal(p.canReplace(n,{...newer,generatedAt:now-1}),false);
});
test('foreground and background share permission-aware public prompt',()=>{
  const n=p.normalize(payload(),now);
  assert.equal(p.prompt(n,{roleAccess:false,permissions:{battery:true}},now),'');
  const battery=p.prompt(n,{roleAccess:true,permissions:{battery:true}},now);
  assert.match(battery,/34%/);assert.doesNotMatch(battery,/100 步|340 秒|123 秒/);
  const all=p.prompt(n,{roleAccess:true,permissions:{battery:true,screenTime:true,health:true}},now);
  assert.match(all,/340 秒/);assert.match(all,/不能断言这是今天/);assert.match(all,/100 步/);
  assert.doesNotMatch(all,/98|20000|88/);
  assert.match(p.prompt(n,{roleAccess:true,permissions:{battery:true}},now+3600000),/旧或时间未知/);
});
