import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundled=readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

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

function bookingSandbox(){
  let seq=0,saves=0;
  const sandbox={
    Date,Math,String,Array,Object,Set,
    S:{settings:{timeAware:true},me:{name:'用户'},travel:{trips:[],stamps:[]},cohabitation:{enabled:true,paused:false,cid:'c1'}},
    uid:()=>`u${++seq}`,save:()=>{saves++;},meHomeCity:()=> '苏州',charHomeCity:()=> '苏州',
    tvP2:n=>String(n).padStart(2,'0'),tvSameCity:(a,b)=>a===b,tvCity:n=>({n,i:/东京|首尔/.test(n)?1:0}),
    tvPrice:()=>600,tvFlightNo:seed=>`CA${1000+Math.abs(seed)%8000}`,hm:value=>new Date(value).toTimeString().slice(0,5),
    tvInit(){return sandbox.S.travel;},fmtDT:value=>new Date(value).toISOString(),tvAddStamp:(travel,to,cid,date)=>travel.stamps.push({to,cid,date}),
  };
  vm.runInNewContext([
    functionSource('cohabPushNotice'),functionSource('cohabTripRows'),functionSource('cohabTripContext'),
    functionSource('cohabTripDateAt'),functionSource('cohabTripPlan'),functionSource('cohabExtractTravelTags'),
    functionSource('cohabCommitTripPlans'),functionSource('cohabTripBookedNotice'),functionSource('cohabTravelAdvance'),
    'globalThis.extract=cohabExtractTravelTags;globalThis.commit=cohabCommitTripPlans;globalThis.advance=cohabTravelAdvance;globalThis.context=cohabTripContext;'
  ].join('\n'),sandbox);
  return Object.assign(sandbox,{saves:()=>saves});
}

test('a decided common-life trip creates exactly one hidden two-person Cloud Journey order',()=>{
  const sandbox=bookingSandbox(),role={id:'c1',name:'角色',wallet:5000},now=new Date(2026,7,28,10,0,0).getTime();
  const parsed=sandbox.extract('订好了。\n[共同生活订票|成都|2026-08-30|09:45]',role,{allow:true,now});
  assert.equal(parsed.text,'订好了。');
  assert.equal(parsed.errors.length,0);
  assert.equal(parsed.plans.length,1);
  const made=sandbox.commit(role,parsed.plans);
  assert.equal(made.length,1);
  assert.equal(sandbox.S.travel.trips.length,1);
  assert.equal(made[0].cohab,true);
  assert.equal(made[0].pax,2);
  assert.equal(made[0].flier,'both');
  assert.equal(made[0].from,'苏州');
  assert.equal(made[0].to,'成都');
  assert.equal(made[0].dep,'09:45');
  assert.equal(role.wallet,3800);
  assert.equal(sandbox.commit(role,parsed.plans).length,0,'the same order must not charge or save twice');
  assert.equal(role.wallet,3800);
});

test('undecided, malformed, same-city and isolated non-common-life tags fail closed',()=>{
  const sandbox=bookingSandbox(),role={id:'c1',name:'角色'},now=new Date(2026,7,28,10,0,0).getTime();
  const malformed=sandbox.extract('[共同生活订票|成都|明天|上午]',role,{allow:true,now});
  assert.equal(malformed.plans.length,0);
  assert.match(malformed.errors[0],/日期或出发时间无效/);
  const same=sandbox.extract('[共同生活订票|苏州|2026-08-30|09:45]',role,{allow:true,now});
  assert.equal(same.plans.length,0);
  assert.match(same.errors[0],/出发地和目的地相同/);
  const blocked=sandbox.extract('普通回复\n[共同生活订票|成都|2026-08-30|09:45]',role,{allow:false,now});
  assert.equal(blocked.text,'普通回复');
  assert.equal(blocked.plans.length,0);
});

test('weak-model ticket variants stay inside common life and never degrade to a single-person order',()=>{
  const sandbox=bookingSandbox(),role={id:'c1',name:'角色',wallet:5000},now=new Date(2026,7,28,10,0,0).getTime();
  const generic=sandbox.extract('我来订。\n[订票|成都|2026-08-30|09:45]',role,{allow:true,now});
  assert.equal(generic.text,'我来订。');
  assert.equal(generic.errors.length,0);
  const made=sandbox.commit(role,generic.plans);
  assert.equal(made.length,1);
  assert.equal(made[0].pax,2);
  assert.equal(made[0].flier,'both');
  assert.equal(made[0].cohab,true);

  const missingTime=sandbox.extract('先订票。\n[订票|杭州|2026-09-02]',role,{allow:true,now});
  assert.equal(missingTime.text,'先订票。');
  assert.equal(missingTime.plans.length,0);
  assert.deepEqual(Array.from(missingTime.errors),['缺少准确出发时间']);
});

test('a validated tag-only two-person plan is not discarded merely because the model omitted dialogue',()=>{
  const core=functionSource('cohabReplyCore');
  assert.match(core,/\(items\.length\|\|travel\.plans\.length\)\?cohabCommitTripPlans/);
});

test('departure and arrival advance from exact timestamps without creating chat messages',()=>{
  const sandbox=bookingSandbox(),depart=new Date(2026,7,30,9,45,0).getTime(),arrive=depart+2*3600000,d={phase:'home',activity:'在家',place:'卧室',notices:[]};
  sandbox.S.travel.trips.push({id:'t1',cid:'c1',cohab:true,status:'upcoming',from:'苏州',to:'成都',no:'CA1234',date:'2026-08-30',departAt:depart,arriveAt:arrive});
  assert.equal(sandbox.advance('c1',d,depart-1),false);
  assert.equal(sandbox.advance('c1',d,depart),true);
  assert.equal(sandbox.S.travel.trips[0].status,'traveling');
  assert.equal(d.phase,'together-away');
  assert.equal(d.phaseAt,depart);
  assert.equal(d.notices.length,1);
  assert.match(d.notices[0].text,/已到出发时间.*CA1234.*成都/);
  assert.equal(sandbox.advance('c1',d,arrive),true);
  assert.equal(sandbox.S.travel.trips[0].status,'done');
  assert.equal(d.place,'成都');
  assert.equal(d.phaseAt,arrive);
  assert.equal(d.notices.length,2);
  assert.equal(sandbox.advance('c1',d,arrive+1000),false);
  assert.equal(d.notices.length,2,'rechecks must not duplicate system notices');
});

test('common-life travel stays separate from WeChat cards and ordinary one-time dates',()=>{
  const commit=functionSource('cohabCommitTripPlans'),advance=functionSource('cohabTravelAdvance'),due=functionSource('tvCheckDue'),build=functionSource('buildSystem'),cohab=functionSource('cohabSystem'),render=functionSource('renderCohab');
  assert.doesNotMatch(commit,/msgs\(|pushMsg\(|scheduleReply\(|notifyIncoming\(/);
  assert.match(source,/if\(tr&&tr\.cohab\).*cohabTravelAdvance/);
  assert.match(due,/if\(tr&&tr\.cohab\)/);
  assert.doesNotMatch(advance,/offBeginSession|tvStartDate|scheduleReply|msgs\(/);
  assert.match(build,/x\.status==='upcoming'&&!x\.cohab/);
  assert.match(cohab,/共同生活订票\|目的地\|YYYY-MM-DD\|HH:MM/);
  assert.match(cohab,/cohabTripContext\(c,o\)/);
  assert.match(render,/o\.notices/);
  assert.match(render,/rgba\(123,132,151,.12\)/);
});

test('web source and private bundle keep the same common-life travel implementation',()=>{
  for(const name of ['cohabExtractTravelTags','cohabCommitTripPlans','cohabTravelAdvance','renderCohab']){
    const rootFn=functionSource(name),start=bundled.indexOf(`function ${name}(`);
    assert.ok(start>=0,`private bundle missing ${name}`);
    assert.ok(bundled.includes(rootFn));
  }
});
