// ROLE_BODY_V1 (2026-11-05, her design): the desk-pet role gets a body — energy, fullness, health, sickness, sleep —
// driven by real time. Only body facts reach the role; how he reacts is his own. She can feed a battery (one meal),
// give a pill (cured), put on / take off a nightcap (sleep / wake). He falls asleep only after bedtime AND 5 quiet
// minutes, and her message wakes him. The desk pet shows sick (fever patch, stays on the ground), hungry (battery
// cloud) under 50, dozing under 50 energy, weak under 50 health, and still shows his mood for a few seconds.
// COHAB_SCHEDULE_SOFT_V1: at work time he no longer vanishes mid-chat in 共同生活.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';

const pet = read('desk-pet.js');
assert.equal(read(PRIV_DIR + 'desk-pet.js'), pet, 'desk pet ships identically');
const consts = pet.match(/const BODY_MEAL=[^\n]*\n/)[0] + pet.match(/const BODY_FEVER=[^\n]*\n/)[0];
const names = ['bodyTemp', 'bodyTempLabel', 'clamp01', 'hm', 'minsOf', 'mmHM', 'bodyMealTimes', 'bodyStartEat', 'dayKey', 'atMins', 'fmtHM', 'bodyCfg', 'bodyOn', 'bodyState', 'bodyLog', 'bodyEvent', 'bodyNight', 'lastChatAt', 'lastUserAt',
  'bodyCheckHealth', 'bodyCareQuota', 'bodyTakeCare', 'bodySleep', 'bodySleepWindow', 'bodySleepInAllowed', 'bodyUserTimes', 'bodySleepAccrue', 'bodyWake', 'bodyMeal', 'bodyRollDay', 'bodySick', 'bodySickDay', 'bodySickText', 'bodyMealWindows', 'bodyTick', 'roleBodyPrompt', 'roleBodyConsume', 'bodyLookOf'];
const W = [];
let NOW = Date.now();
class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } }
const ctx = vm.createContext({ Math, Date: FakeDate, String, Number, Object, Array, JSON,
  S: { me: { name: '北' }, settings: {} }, msgs: () => W, save() {}, refreshMood() {}, rname: (c) => c.name });
ctx.cfg = () => ctx.S.settings.deskPet;
ctx.ensureCfg = () => ctx.S.settings.deskPet;
vm.runInContext(consts + names.map(n => fnSource(pet, n)).join('\n'), ctx);
const c = { id: 'r1', name: '先生' };
ctx.S.settings.deskPet = { on: true, cid: 'r1' };

const d0 = new Date(); d0.setHours(23, 0, 0, 0); const T = d0.getTime();
const b = ctx.bodyState(c); Object.assign(b, { lastTick: T, wokeAt: T - 15 * 3600000, day: ctx.dayKey(T), asleep: false });
W.push({ role: 'user', content: '还在聊', time: T + 40 * 60000 });            // she is still chatting at 23:40
ctx.bodyTick(c, T + 44 * 60000);
assert.equal(b.asleep, false, 'past bedtime but still chatting: not asleep yet');
ctx.bodyTick(c, T + 60 * 60000);
assert.equal(b.asleep, true, 'quiet five minutes after bedtime: falls asleep');
W.push({ role: 'user', content: '醒醒', time: T + 90 * 60000 });
ctx.bodyTick(c, T + 91 * 60000);
assert.equal(b.asleep, false, 'her message wakes him');
assert.match(ctx.roleBodyPrompt(c), /只是事实，不规定你的情绪和语气/, 'prompt gives facts only');

// lunch: at meal time while chatting he must announce first; her messages slow him down; quiet → he goes himself
{ctx.S.settings.deskPet.body.meals = { b: '', l: '12:00', d: '' };
 const L = new Date(); L.setHours(12, 0, 0, 0); const T0 = L.getTime();
 Object.assign(b, { lastTick: T0, asleep: false, eating: null, due: null, mealWin: {}, lastMealAt: T0 - 5 * 3600000, day: ctx.dayKey(T0), wokeAt: T0 - 5 * 3600000, meals: 0 });
 W.length = 0; W.push({ role: 'user', content: '在干嘛', time: T0 + 5 * 60000 });
 NOW = T0 + 6 * 60000; ctx.bodyTick(c, NOW);
 assert.equal(b.due && b.due.name, '午饭', 'meal time while chatting: he is told to go eat, not sent away');
 assert.equal(b.eating, null, 'he does not vanish to eat on his own mid-chat');
 assert.match(ctx.roleBodyPrompt(c), /先跟北说一声（比如“我先去吃饭了”）再去/);
 assert.equal(ctx.roleBodyConsume('那我先去吃午饭啦\n[身体|吃饭]', c), '那我先去吃午饭啦');
 assert.ok(b.eating && b.eating.name === '午饭', 'after saying so he goes to eat');
 W.push({ role: 'user', content: '吃什么呀', time: NOW + 60000 }); NOW += 2 * 60000; ctx.bodyTick(c, NOW);
 assert.equal(b.eating.extra, 3, 'her message slows his meal a little; he still replies');
 NOW += 40 * 60000; ctx.bodyTick(c, NOW);
 assert.equal(b.eating, null); assert.equal(b.meals, 1, 'meal finished and counted');
 // dinner with nobody chatting: he goes by himself
 ctx.S.settings.deskPet.body.meals.d = '18:30'; const D = new Date(); D.setHours(18, 30, 0, 0);
 NOW = D.getTime() + 20 * 60000; ctx.bodyTick(c, NOW); assert.ok(b.eating && b.eating.name === '晚饭', 'quiet: he goes to eat by himself');
 NOW = D.getTime(); }
NOW = Date.now(); b.lastTick = NOW;
// BODY_RISK_V1: sickness follows care, not luck
{const bb = { meals: 3, dayLate: false, sleptOnTime: true, health: 85, risk: 0, sick: null, log: [], mealWin: {} };
 for (let d = 0; d < 10; d++) { bb.meals = 3; bb.dayLate = false; bb.sleptOnTime = true; ctx.bodyRollDay(bb, Date.now() + d * 86400000); }
 assert.equal(bb.sick, null, 'ten well-cared days: never sick'); assert.equal(bb.risk, 0);
 const bad = { meals: 1, dayLate: true, sleptOnTime: false, health: 85, risk: 0, sick: null, log: [], mealWin: {} }; let day = 0;
 while (!bad.sick && day < 10) { bad.meals = 1; bad.dayLate = true; bad.sleptOnTime = false; ctx.bodyRollDay(bad, Date.now() + day * 86400000); day++; }
 assert.ok(bad.sick && day >= 6 && day <= 8, 'skipping meals and staying up gets him sick only after about a week, got day ' + day);
 const mixed = { meals: 2, dayLate: false, sleptOnTime: false, health: 85, risk: 0, sick: null, log: [], mealWin: {} };
 for (let d = 0; d < 20; d++) { mixed.meals = d % 2 ? 3 : 2; mixed.dayLate = d % 3 === 0; mixed.sleptOnTime = !mixed.dayLate; ctx.bodyRollDay(mixed, Date.now() + d * 86400000); }
 assert.equal(mixed.sick, null, 'an occasional bad day is absorbed');
 const h = { meals: 1, dayLate: true, health: 80, risk: 0, sick: null, log: [], mealWin: {} }; ctx.bodyRollDay(h, Date.now());
 assert.ok(80 - h.health <= 6, 'health drops slowly');}
// temperature follows severity
{const t = Date.now(); const sk = (sev, peak) => ({ sick: { kind: '发烧', fever: true, sev, peak, start: t - 3 * 3600000, until: t + 9 * 3600000 } });
 assert.equal(ctx.bodyTempLabel(ctx.bodyTemp(sk('high', 39.1), t)), '高烧');
 assert.equal(ctx.bodyTempLabel(ctx.bodyTemp(sk('low', 37.6), t)), '低烧');
 assert.equal(ctx.bodyTempLabel(ctx.bodyTemp({ sick: null }, t)), '正常');}
// meals and fullness
const full0 = b.full; ctx.bodyMeal(b, Date.now(), 'me');
assert.equal(Math.round(b.full - full0), 35, 'one battery is one meal');
b.full = 95; ctx.bodyMeal(b, Date.now(), 'me'); assert.ok(b.full > 100, 'too many batteries: stuffed');

// role tags are applied and hidden
const out = ctx.roleBodyConsume('那我先去吃饭\n[身体|吃饭]', c);
assert.equal(out, '那我先去吃饭', 'the tag line is never shown');

// looks with her thresholds
assert.equal(ctx.bodyLookOf({ full: 45, energy: 80, health: 80 }), 'hungry');
assert.equal(ctx.bodyLookOf({ full: 80, energy: 45, health: 80 }), 'doze');
assert.equal(ctx.bodyLookOf({ full: 80, energy: 80, health: 45 }), 'weak');
assert.equal(ctx.bodyLookOf({ full: 60, energy: 60, health: 60 }), '', 'above 50 nothing shows');
assert.equal(ctx.bodyLookOf({ full: 80, energy: 80, health: 80, sick: { kind: '感冒' } }), 'sick');

// desk pet visuals and wiring
assert.match(pet, /<g class="dp-hat dp-hat-fever">/, 'fever patch');
assert.match(pet, /\['coffee','咖啡'/, 'coffee item'); assert.match(pet, /\['temp','体温计'/, 'thermometer item');
assert.match(pet, /&&!\(b\.coffeeUntil>t\)\)\{/, 'coffee keeps him awake');
assert.match(pet, /hungry:\{w:13,h:10,svg:/, 'battery cloud');
assert.match(pet, /drowsy:R\(3,4,3,1,'var\(--dp-d\)'\)/, 'dozing eyes');
assert.match(pet, /'打瞌睡':\{eyes:'drowsy',cls:'nod slow',fx:'z'\}/);
assert.match(pet, /Math\.floor\(Date\.now\(\)\/1000\)%14<5\?emo:_bm/, 'mood still shows for a few seconds');
assert.match(pet, /if\(m==='sick'\|\|m==='sleep'\|\|m==='eat'\)\{/, 'sick, sleeping and eating stay on the ground');
assert.match(pet, /怎么反应是他自己的事。<\/div>\n  <div class="dp-label">照顾记录<\/div><div class="dp-group dp-log">\$\{log\}<\/div>`;\}/, 'care log is always the last block');
assert.match(pet, /\.dp-page \.sw\.on\{background:#d97757!important/, 'switches are orange');
assert.match(pet, /\.dp-page input\[type=time\]\{color:#f5f5f7;color-scheme:dark/, 'times are white');
assert.match(pet, /schedSet=function\(id\)\{const p=cfg\(\);if\(p&&p\.on&&p\.cid===id&&bodyCfg\(\)\.on\)/, 'old schedule entries open the pet body page for its role');
assert.match(pet, /Object\.assign\(window,\{roleBodyPrompt,roleBodyConsume,deskPetBodyUse,deskPetBodySet,bodyCfgSickToggle,deskPetTab,deskPetSchedSet,deskPetLeaves,/, 'page handlers are reachable');
assert.match(pet, /\(MOVES\[k\]\|\|\['跳舞','蹦跶','转圈'\]\.includes\(k\)\)&&\(state\.mood==='sleep'\|\|state\.mood==='sick'\)/, 'asleep or sick: no running around even when told');
// care log keeps the last three days
{const old = Date.now() - 4 * 86400000; const bb = { log: [{ t: old, text: '很早以前' }] }; ctx.bodyLog(bb, '今天喂了电池'); assert.deepEqual(bb.log.map(x => x.text), ['今天喂了电池'], 'entries older than three days are dropped');}
for (const [label, file] of BUNDLES) {
  const src = read(file);
  assert.match(src, /if\(typeof roleBodyPrompt==='function'\)s\+=roleBodyPrompt\(c\);/, `${label}: 共同生活 knows his body`);
  assert.match(src, /roleBodyConsume\(out,typeof getC==='function'\?getC\(id\):null\)/, `${label}: 共同生活 applies body tags`);
  assert.match(src, /COHAB_SCHEDULE_SOFT_V1[\s\S]*?if\(instant-lastAt<10\*60000\)/, `${label}: no sudden leave for work mid-chat`);
  assert.match(src, /const CTLLEAK=\/\^\[\\\[【\]\\s\*\(身体\|/, `${label}: body tags never leak`);
}
console.log('role body tests passed');

// BODY_SLEEP_WINDOW_V1：真实时间回放，夜间多次叫醒、离开、跨日和重开都按整晚累计。
{
 const H = 3600000, M = 60000;
 const date = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
 const setup = (start, sleepAt = '23:30', wakeAt = '07:30') => {
   let clock = start, messages = [];
   class Clock extends Date { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } }
   const x = vm.createContext({ Date: Clock, Math, String, Number, Object, Array, JSON,
     S: { settings: { deskPet: { on: true, cid: 'r1', body: { on: true, sleepAt, wakeAt, sick: 'off' } } } },
     msgs: () => messages });
   x.ensureCfg = x.cfg = () => x.S.settings.deskPet;
   // 使用完整身体模块，避免用测试替身重写睡眠计算。
   vm.runInContext(pet.slice(pet.indexOf('const BODY_MEAL='), pet.indexOf('function bodyBar(')) + '\n' + fnSource(pet, 'roleBodyConsume'), x);
   x.roleDayOff = () => false;
   const state = x.bodyState(c); state.lastTick = start; state.wokeAt = start - 12 * H;
   return { x, get b() { return x.S.roleBody.r1; }, messages,
     tick(t) { clock = t; return x.bodyTick({ ...c, sched: { on: true } }, t); } };
 };
 const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: ${actual} != ${expected}`);
 // 整晚关闭：只保存睡前状态，中途不执行计时器；用新运行环境模拟第二天重开。
 const closed = setup(date(5, 23, 20));
 const saved = JSON.stringify(closed.x.S);
 const reopened = setup(date(6, 8)); reopened.x.S = JSON.parse(saved);
 reopened.tick(date(6, 8));
 assert.equal(reopened.b.asleep, false, '关闭整晚后重开，工作日已起床');
 assert.equal(reopened.b.wokeAt, date(6, 7, 30), '起床时间按设定补算，不按重开时间');
 close(reopened.b.lastSleepH, 8, '关闭期间从睡觉点到起床点的八小时完整补算');
 const closedRest = setup(date(6, 23, 20));
 closedRest.messages.push({ role: 'user', time: date(6, 23, 29) });
 const restSaved = JSON.stringify(closedRest.x.S);
 const reopenedRest = setup(date(7, 7, 32)); reopenedRest.x.S = JSON.parse(restSaved);
 reopenedRest.messages.push(...closedRest.messages); reopenedRest.x.roleDayOff = () => ({ kind: 'weekend' });
 reopenedRest.tick(date(7, 7, 32));
 assert.equal(reopenedRest.b.asleep, true, '关闭整晚后休息日重开，未补够仍在睡');
 close(reopenedRest.b.lastSleepH, (8 * 60 - 4 + 2) / 60, '夜间与起床点后的补觉一起补算');
 reopenedRest.tick(date(7, 7, 34));
 assert.equal(reopenedRest.b.asleep, false, '补足后按正确时间醒来');
 close(reopenedRest.b.lastSleepH, 8, '多次读取恢复结果不重复累计');
 const s = setup(date(5, 23, 20));
 s.messages.push({ role: 'user', time: date(5, 23, 29) }, { role: 'assistant', time: date(5, 23, 33) });
 s.tick(date(5, 23, 34) + 15000);
 assert.equal(s.b.asleep, true, '用户安静五分钟就睡，角色自己的回复不延后');
 assert.equal(s.b.sleptAt, date(5, 23, 34), '准确从五分钟届满开始睡');
 s.messages.push({ role: 'user', time: date(5, 23, 34) + 30000 });
 s.tick(date(5, 23, 34) + 30000);
 assert.equal(s.b.asleep, false, '消息当下就叫醒，不忽略入睡一分钟内的互动');
 s.tick(date(5, 23, 42));
 assert.equal(s.b.asleep, true, '再次离开五分钟就继续睡，不必再等一小时');
 s.messages.push({ role: 'user', time: date(6, 0) }, { role: 'user', time: date(6, 1) });
 // 模拟退出后重开，恢复已存状态；期间两次互动都要回放，不能只取最后一条。
 const restored = setup(date(5, 23, 20)); restored.x.S.roleBody.r1 = JSON.parse(JSON.stringify(s.b));
 restored.messages.push(...s.messages);
 restored.tick(date(6, 7, 33));
 assert.equal(restored.b.asleep, false, '到设置起床点自动醒');
 assert.equal(restored.b.wokeAt, date(6, 7, 30), '离线补算仍使用真实起床边界');
 close(restored.b.lastSleepH, (8 * 60 - 4 - 5 - 5 - 5) / 60, '整晚扣掉入睡等待和各次清醒时间');
 const total = restored.b.lastSleepH;
 restored.tick(date(6, 8)); close(restored.b.lastSleepH, total, '起床后不重复计时');
 restored.x.bodySleep(restored.b, 'hat', date(6, 13)); restored.b.lastTick = date(6, 13);
 restored.tick(date(6, 14, 5)); close(restored.b.lastSleepH, total, '白天睡帽午睡不计入夜间累计');
 restored.tick(date(6, 23, 40)); close(restored.b.lastSleepH, 10 / 60, '下一晚重新累计，不继承前晚');
 const day = setup(date(5, 7, 50), '08:00', '12:00');
 day.tick(date(5, 12, 3));
 close(day.b.lastSleepH, 4, '支持同一天内的自定义睡眠时段');
 const fresh = setup(date(5, 23, 20));
 fresh.b.wokeAt = date(5, 23, 28); fresh.tick(date(5, 23, 34));
 assert.equal(fresh.b.asleep, true, '刚被叫醒也只需闲置五分钟');
 assert.equal(fresh.b.sleptAt, date(5, 23, 33));
 const co = setup(date(5, 23, 20));
 co.x.S.cohabitation = { homes: { r1: { msgs: [{ who: 'me', time: date(6, 0) }, { who: 'me', time: date(6, 1) }] } } };
 co.tick(date(6, 7, 30)); close(co.b.lastSleepH, 8 - 10 / 60, '共同生活互动同样唤醒并扣除清醒时间');
 // 使用现有的真实休息日判断，覆盖周末、法定假期、请假和调休工作日。
 const schedule = read('src/app/005-imageResultURL.js');
 const scheduleFns = ['roleWorkday', 'scheduleDateKey', 'scheduleDateParse', 'scheduleLeaves', 'roleLeaveOn', 'roleHolidaysOn', 'roleHolidayTables', 'roleHolidayAt', 'roleHolidayOn', 'roleMakeupWorkday', 'roleDayOff'];
 for (const [label, start, end, sched, shouldSleep] of [
   ['周末', date(6, 23, 20), date(7, 7, 40), { on: true }, true],
   ['工作日', date(5, 23, 20), date(6, 7, 40), { on: true }, false],
   ['没启用上班', date(5, 23, 20), date(6, 7, 40), { on: false }, true],
   ['请假', date(5, 23, 20), date(6, 7, 40), { on: true, leaves: [{ start: '2026-11-06', end: '2026-11-06' }] }, true],
   ['国庆节', new Date(2026, 8, 30, 23, 20).getTime(), new Date(2026, 9, 1, 7, 40).getTime(), { on: true }, true],
   ['周末调休上班', new Date(2026, 9, 9, 23, 20).getTime(), new Date(2026, 9, 10, 7, 40).getTime(), { on: true }, false]
 ]) {
   const q = setup(start); q.x.roleClockDate = t => new Date(t);
   vm.runInContext(scheduleFns.map(n => fnSource(schedule, n)).join('\n'), q.x);
   // 半夜一条消息让他少睡五分钟以上，确保需要补觉。
   q.messages.push(...[40,35,30].map(n => ({ role: 'user', time: end - n * M })));
   q.tick(end - 11 * M);
   const rc = { ...c, sched };
   q.x.bodyTick(rc, end);
   assert.equal(q.b.asleep, shouldSleep, `${label}：按真实作息判断是否允许补觉`);
 }
 const nap = setup(date(6, 23, 20)); nap.x.roleDayOff = () => ({ kind: 'weekend' });
 nap.messages.push({ role: 'user', time: date(7, 2) });
 nap.tick(date(7, 7, 32)); assert.equal(nap.b.asleep, true, '休息日没睡够继续补觉');
 nap.tick(date(7, 7, 35)); assert.equal(nap.b.asleep, false, '补足八小时自动醒');
 close(nap.b.lastSleepH, 8, '补觉继续累计到同一晚');
 const chosen = setup(date(6, 23, 20)); chosen.x.roleDayOff = () => ({ kind: 'weekend' });
 chosen.tick(date(7, 6, 59));
 chosen.x.save = () => {}; chosen.x.refreshMood = () => {};
 assert.equal(chosen.x.roleBodyConsume('[身体|睡到09:30]', c), '', '选择醒来时间的指令不外露');
 chosen.tick(date(7, 9, 29)); assert.equal(chosen.b.asleep, true);
 chosen.tick(date(7, 9, 30)); assert.equal(chosen.b.asleep, false, '按角色选择的时间醒来');
 const wait = setup(date(6, 23, 20)); wait.x.roleDayOff = () => ({ kind: 'weekend' });
 wait.tick(date(7, 6, 59)); wait.x.save = () => {}; wait.x.refreshMood = () => {};
 wait.x.roleBodyConsume('[身体|睡到她叫醒]', c);
 wait.tick(date(7, 10)); assert.equal(wait.b.asleep, true, '可选择一直睡到被叫醒');
 wait.messages.push({ role: 'user', time: date(7, 10) + 1000 });
 wait.tick(date(7, 10) + 1000); assert.equal(wait.b.asleep, false, '等待叫醒也必须响应用户');
 const coffee = setup(date(5, 23, 20)); coffee.b.coffeeUntil = date(6, 0);
 coffee.tick(date(5, 23, 59)); assert.equal(coffee.b.asleep, false, '咖啡提神仍有效');
 coffee.tick(date(6, 0)); assert.equal(coffee.b.asleep, true, '咖啡到期可入睡');
 const hat = setup(date(6, 12)); hat.b.energy = 100;
 hat.x.bodySleep(hat.b, 'hat', date(6, 12)); hat.tick(date(6, 12, 59));
 assert.equal(hat.b.asleep, true, '睡帽午睡至少一小时');
 hat.tick(date(6, 13)); assert.equal(hat.b.asleep, false);
 console.log('夜间自动回睡与累计时长回归通过');
}

// BODY_CARE_LIMITS_V1：健康归零必须生病，不再等另一个独立风险条。
{ const now=NOW; const before=JSON.parse(JSON.stringify(ctx.S.roleBody));
 Object.assign(b,{health:0,risk:0,sick:null,lastTick:now-60000});ctx.bodyTick(c,now);
 assert.ok(b.sick,'开启会生病时，健康归零必须触发生病');ctx.S.roleBody=before; }

{ const t=new Date(2026,10,7,8).getTime(),b={asleep:false,health:80,energy:10};
 assert.equal(ctx.bodyTakeCare(b,'vitamin',t).ok,true);assert.equal(b.health,85);
 assert.equal(ctx.bodyTakeCare(b,'vitamin',t+1000).ok,false);assert.equal(b.health,85);
 assert.equal(ctx.bodyTakeCare(b,'coffee',t).ok,true);assert.equal(b.energy,30);
 assert.equal(ctx.bodyTakeCare(b,'coffee',t+60000).ok,false);
 assert.equal(ctx.bodyTakeCare(b,'coffee',t+4*3600000).ok,true);assert.equal(b.energy,40);
 assert.equal(ctx.bodyTakeCare(b,'coffee',t+8*3600000).ok,false);
 const restored=JSON.parse(JSON.stringify(b));assert.equal(ctx.bodyTakeCare(restored,'vitamin',t+2000).ok,false);
 assert.equal(ctx.bodyTakeCare(b,'vitamin',t+86400000).ok,true);
 b.health=0;b.sick=null;b.recoverUntil=t+86400000;ctx.bodyCheckHealth(b,t);assert.equal(b.sick,null);
 console.log('健康底线与道具限额通过'); }
