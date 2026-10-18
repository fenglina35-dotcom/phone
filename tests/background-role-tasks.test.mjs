import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const edge = readFileSync(join(root, 'supabase/functions/phone-role-push/index.ts'), 'utf8');
const sql = readFileSync(join(root, 'supabase/migrations/202608120002_background_role_tasks.sql'), 'utf8');

test('reply and device work can be handed to the server without racing user activity', () => {
  assert.match(app, /roleBackgroundPrepare\(id,'reply_handoff'/);
  assert.match(app, /roleBackgroundPrepare\(id,'device_handoff'/);
  assert.doesNotMatch(app, /roleServerPushTouchActivity\(id,m\.time,true\);roleBackgroundCancel\(id\);roleBackgroundPrepare/);
  assert.match(sql, /kind = 'app_followup' and status = 'pending'/);
  assert.match(edge, /currentTask\?\.status === "canceled"/);
});

test('chat media settings expose an explicit real background message test', () => {
  assert.match(app, /function roleServerPushSettingsTestHTML\(\)/);
  assert.match(app, /立即模拟后台主动消息/);
  assert.match(app, /async function roleServerPushOneMinuteTest\(id\)/);
  assert.match(app, /roleBackgroundPreflight\(id,false\)/);
  assert.match(app, /roleBackgroundEnqueue\(id,'one_minute_test'/);
  assert.match(app, /roleBackgroundEnqueue\(id,'one_minute_test',[^\n]*Date\.now\(\),baseline,false\)/);
  assert.match(app, /roleBackgroundDispatchNow\(true\)/);
  assert.match(app, /request\.keepalive=true/);
  assert.match(app, /roleBackgroundDispatchNow=async function\(\.\.\.args\)/);
  assert.match(app, /roleBackgroundDispatchNowPrivateCore\(\.\.\.args\)/);
  assert.doesNotMatch(app, /setTimeout\(\(\)=>roleBackgroundDispatchNow\(\),12000\)/);
  assert.match(app, /不会生成本地假回复/);
  const begin = app.indexOf('async function roleServerPushOneMinuteTest');
  const end = app.indexOf('function roleAppWatchToggle', begin);
  assert.doesNotMatch(app.slice(begin, end), /msgs\(|pushMsg|notifyIncoming/);
  assert.match(edge, /task\.kind === "one_minute_test"/);
  assert.match(sql, /one_minute_test/);
});

test('background generation uses the role current model and reports the real task and APNs result', () => {
  assert.match(app, /function roleServerModelRoute\(c\)/);
  assert.match(app, /function roleServerModelRoutes\(c\)/);
  assert.match(app, /modelRoute:routes\[0\]\|\|null,modelRoutes:routes/);
  assert.match(app, /关闭后清除模型线路/);
  assert.match(app, /if\(!roleServerModelRoute\(c\)\)missing\.push/);
  assert.match(edge, /index === 0 \? "profile-current" : "profile-secondary"/);
  assert.match(edge, /automation\.modelRoutes/);
  assert.match(edge, /name: index === 0 \? "profile-current" : "profile-secondary"/);
  assert.ok(edge.indexOf('index === 0 ? "profile-current" : "profile-secondary"') < edge.indexOf('Deno.env.get("OPENAI_API_KEY")'));
  assert.match(app, /action:'task_status'/);
  assert.match(edge, /input\?\.action === "task_status"/);
  assert.match(edge, /providerReason:/);
  assert.match(edge, /pushStatus:/);
  assert.match(app, /APNs 已被 Apple 接受/);
});

test('an explicit background test tries each synchronized external route once and then releases the queue', () => {
  assert.match(edge, /automation\.modelRoutes\.slice\(0, 2\)/);
  assert.match(edge, /Math\.min\(18_000, remaining\)/);
  assert.match(edge, /task\.kind === "one_minute_test" \|\| task\.kind === "app_watch_test"[\s\S]{0,80}\? 1/);
  assert.doesNotMatch(edge, /task\.kind === "one_minute_test" \|\| task\.kind === "app_watch_test" \|\| task\.kind === "reply_handoff"[\s\S]{0,80}\? 2/);
});

test('app awareness is gated, limited, mutually exclusive and cooled down', () => {
  assert.match(app, /appWatchEnabled:!!\(c\.proactive&&c\.proactive\.appWatch\)/);
  assert.match(app, /roleAppLockEnabled:!!\(c&&c\.proactive&&c\.proactive\.appWatchRoleLock\)/);
  assert.match(app, /Math\.max\(0,Math\.min\(5,/);
  assert.match(edge, /Math\.random\(\) < 0\.5/);
  assert.match(edge, /nextDue\(profile, 90\)/);
  assert.match(edge, /stage: "awaiting_lock"/);
  assert.match(edge, /commandStatus === "completed"/);
  assert.doesNotMatch(edge, /followupChoice: Math\.random/);
});

test('background automations require fresh device facts and only record delivered events', () => {
  for (const kind of ['morningSleep', 'eveningScreen', 'absenceBattery', 'criticalBattery', 'emotionCare', 'manualUnlock']) {
    assert.match(edge, new RegExp(kind));
  }
  assert.match(edge, /freshWithin\(telemetry\.generatedAt, 10 \* 60_000\)/);
  assert.match(edge, /freshWithin\(screen\.generatedAt, 20 \* 60_000\)/);
  assert.match(edge, /if \(!automationDelivered\)/);
  assert.match(sql, /attempts smallint not null default 0/);
});

test('foreground and background automations have one owner and respect occupied scenes', () => {
  assert.match(app, /roleBackgroundAvailable==='function'&&roleBackgroundAvailable\(c\.id\)\)return false/);
  assert.match(app, /localRuns:Object\.assign\(\{\},st\.automationRuns\|\|\{\}\)/);
  assert.match(app, /suspended=!!\(roleServerPushDeliveryBlocked\(c\.id\)/);
  assert.doesNotMatch(app.match(/function roleServerAutomationConfig\(c\)[^\n]+/)?.[0]||'',/cohabOnlineQuiet/);
  assert.match(edge, /if \(profileTemporarilySuspended\(profile\) && !pendingManualUnlock\) return null/);
  assert.match(edge, /!candidate && profileTemporarilySuspended\(profile\)/);
  assert.doesNotMatch(edge, /if \(config\.suspended === true\) return null/);
  assert.match(edge, /localRuns\.morningSleep/);
  assert.match(edge, /Math\.max\(serverCount, localCount\)/);
});

test('time awareness and cohabitation state are synchronized explicitly', () => {
  assert.match(app, /timeAware:S\.settings\.timeAware!==false/);
  assert.match(app, /if\(!S\.settings\.timeAware\)return'';const sc=/);
  assert.match(app, /timeOn\?initiativeAwayPrompt\(c\):''/);
  assert.match(app, /时间感知已关闭：不得使用或推断日期/);
  assert.match(app, /id="cohab_manual_phase"/);
  assert.match(app, /id="cohab_manual_activity"/);
  assert.match(app, /id="cohab_manual_place"/);
});

// Owner-entered role plans are explicit due events, not random proactive chat.
test('owner plan server candidate validates time, scope, revisions, retry budget and receipt deduplication', async()=>{
 const {stripTypeScriptTypes}=await import('node:module');const vm=await import('node:vm');
 const start=edge.indexOf('// ROLE_OWNER_TODO_REPORT_V1:'),end=edge.indexOf('// END_ROLE_OWNER_TODO_REPORT_V1',start);assert(start>=0);
 const ctx=vm.createContext({profileTemporarilySuspended:p=>p.suspended===true});vm.runInContext(stripTypeScriptTypes(edge.slice(start,end)),ctx);
 const now=Date.parse('2026-10-18T03:00:00Z'),due=now,day='2026-10-18',row={id:'plan1',key:'ownerTodo:2026-10-18:plan1:1',revision:1,text:'喝水',time:'11:00',dueAt:due},p={enabled:true,role_id:'r1',automation_config:{ownerTodo:{schema:1,accountId:'main',roleId:'r1',day,expiresAt:now+12*3600000,items:[row]}},automation_state:{}};
 assert.equal(ctx.ownerTodoCandidate(p,now-1),null);assert.equal(ctx.ownerTodoCandidate(p,now).key,row.key);assert.match(ctx.ownerTodoCandidate(p,now).facts,/执行人是你/);assert.match(ctx.ownerTodoCandidate(p,now+120000).facts,/已过约定时间/);
 for(const mutate of [p=>p.enabled=false,p=>p.suspended=true,p=>p.automation_config.ownerTodo.accountId='other',p=>p.automation_config.ownerTodo.roleId='other',p=>p.automation_config.ownerTodo.expiresAt=now-1,p=>p.automation_config.ownerTodo.items=[],p=>p.automation_config.ownerTodo.items[0].revision=2,p=>p.automation_state.runs={[row.key]:now},p=>p.automation_state.ownerTodoAttempts={[row.key]:{count:3,nextAt:0}},p=>p.automation_state.ownerTodoAttempts={[row.key]:{count:1,nextAt:now+1}}]){const copy=structuredClone(p);mutate(copy);assert.equal(ctx.ownerTodoCandidate(copy,now),null);}
 const reserved=structuredClone(p);reserved.automation_state.ownerTodoAttempts={[row.key]:{count:1,nextAt:now+180000}};assert.equal(ctx.ownerTodoCandidate(reserved,now,row.key).key,row.key);
});
for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/'])test(prefix+'owner plan payload keeps actor/account/status boundaries and parses human times',()=>{
 const source=readFileSync(join(root,prefix+'app.js'),'utf8'),start=source.indexOf('// ROLE_OWNER_TODO_REPORT_V1:'),end=source.indexOf('// END_ROLE_OWNER_TODO_REPORT_V1',start);assert(start>=0);
 const vmSource=source.slice(start,end),now=new Date(),day=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0'),c={id:'r1'},row={id:'p1',source:'owner',accountId:'main',reportRevision:1,text:'喝水',time:'11点',done:false};let account='main';
 const ctx={S:{couple:{cid:'r1'},spy:{r1:{todo:{date:day,items:[row,{text:'自动生成的旧安排',time:'11:00'}]}}}},isMain:()=>account==='main',actId:()=>account,todayStr:()=>day,deviceTimeZone:()=> 'Asia/Shanghai',setInterval(){},document:{addEventListener(){}},window:{addEventListener(){}}};
 return import('node:vm').then(vm=>{vm.createContext(ctx);vm.runInContext(vmSource,ctx);assert.equal(ctx.spyTodoTime('11点'),'11:00');assert.equal(ctx.spyTodoTime('晚上11点半'),'23:30');assert.equal(ctx.spyTodoTime('25:00'),'');assert.equal(ctx.spyTodoOwnerRows(null).length,0);assert.equal(ctx.spyTodoCloudConfig(c).items.length,1);assert.match(ctx.spyTodoPrompt(c),/不是让对方去做/);row.done=true;assert.equal(ctx.spyTodoCloudConfig(c).items.length,0);row.done=false;row.reportedAt=Date.now();assert.equal(ctx.spyTodoCloudConfig(c).items.length,0);delete row.reportedAt;account='other';assert.equal(ctx.spyTodoCloudConfig(c).items.length,0);account='main';const key=ctx.spyTodoKey(day,row),push={triggerKind:'automation:'+key};assert.equal(ctx.spyTodoServerRow(c,push),row);row.reportRevision++;assert.equal(ctx.spyTodoServerRow(c,push),null);});
});

for(const prefix of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/'])test(prefix+'public consent gate forwards synchronization state without bypassing consent',async()=>{const vm=await import('node:vm');const source=readFileSync(join(root,prefix+'public-north-runtime.js'),'utf8'),match=source.match(/roleServerPushSync=async\([^\n]+/);assert(match);let allowed=false;const calls=[],c={id:'r1'},ctx={state:()=>({backgroundConsent:{r1:allowed}}),syncCore:async(...args)=>{calls.push(args);return true;}};vm.createContext(ctx);vm.runInContext(match[0],ctx);assert.equal(await ctx.roleServerPushSync(c,true,true),false);assert.equal(calls.length,0);allowed=true;assert.equal(await ctx.roleServerPushSync(c,true,true),true);assert.equal(calls.length,1);assert.equal(calls[0][2],true);});
