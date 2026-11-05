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
const consts = pet.match(/const BODY_MEAL=[^\n]*\n/)[0];
const names = ['clamp01', 'hm', 'minsOf', 'dayKey', 'atMins', 'fmtHM', 'bodyCfg', 'bodyOn', 'bodyState', 'bodyLog', 'bodyEvent', 'bodyNight', 'lastChatAt', 'lastUserAt',
  'bodySleep', 'bodyWake', 'bodyMeal', 'bodyRollDay', 'bodySick', 'bodySickDay', 'bodySickText', 'bodyMealWindows', 'bodyTick', 'roleBodyPrompt', 'roleBodyConsume', 'bodyLookOf'];
const W = [];
const ctx = vm.createContext({ Math, Date, String, Number, Object, Array, JSON,
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
assert.match(pet, /hungry:\{w:13,h:10,svg:/, 'battery cloud');
assert.match(pet, /drowsy:R\(3,4,3,1,'var\(--dp-d\)'\)/, 'dozing eyes');
assert.match(pet, /'打瞌睡':\{eyes:'drowsy',cls:'nod slow',fx:'z'\}/);
assert.match(pet, /Math\.floor\(Date\.now\(\)\/1000\)%14<5\?emo:_bm/, 'mood still shows for a few seconds');
assert.match(pet, /if\(m==='sick'\|\|m==='sleep'\)\{/, 'sick and sleeping stay on the ground');
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
