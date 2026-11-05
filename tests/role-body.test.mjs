// ROLE_BODY_V1 (2026-11-05, her design): the desk-pet role gets a body — energy, fullness, health, sickness, sleep —
// driven by real time. Only body facts reach the role; how he reacts is his own. She can feed a battery (one meal),
// give a pill (cured), put on / take off a nightcap (sleep / wake). He falls asleep only after bedtime AND 15 quiet
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
  'bodySleep', 'bodyWake', 'bodyMeal', 'bodyRollDay', 'bodySick', 'bodySickDay', 'bodySickText', 'bodyMealWindows', 'bodyTick', 'roleBodyPrompt', 'roleBodyConsume', 'bodyLookOf'];
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
ctx.bodyTick(c, T + 45 * 60000);
assert.equal(b.asleep, false, 'past bedtime but still chatting: not asleep yet');
ctx.bodyTick(c, T + 60 * 60000);
assert.equal(b.asleep, true, 'quiet 15 minutes after bedtime: falls asleep');
W.push({ role: 'user', content: '醒醒', time: T + 90 * 60000 });
ctx.bodyTick(c, T + 95 * 60000);
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
assert.match(pet, /&&!\(b\.coffeeUntil>t2\)\)\{/, 'coffee keeps him awake');
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
