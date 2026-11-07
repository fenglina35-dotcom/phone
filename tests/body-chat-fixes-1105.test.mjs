// 2026-11-05 fixes she reported on iOS 550:
// 1. Changing a time on the pet body page closed the iOS time wheel at once: every wheel stop fired change and the
//    page redrew. Now the page waits until the wheel closes (blur) before redrawing.
// 2. The sleep hat fell off after a second: by day he woke as soon as energy was >= 95. Now a hat nap lasts >= 1 hour.
// 3. MSG_MENU_LONGPRESS_V1: a light tap on a chat message no longer opens the delete/recall menu; long press does.
// 4. BODY_STATUS_LINE_V1: he said "not full" right after two batteries. He now always gets a one-line status, is told to
//    answer truthfully, a battery is "a meal" to him, and hungry/sleepy/weak start below 50 like the pet shows.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';

const pet = read('desk-pet.js');
assert.equal(read(PRIV_DIR + 'desk-pet.js'), pet, 'private desk-pet.js is the same file');

// 1. time wheel
const after = fnSource(pet, 'rerenderAfterPick');
assert.match(after, /a\.type==='time'/);
assert.match(after, /addEventListener\('blur'/);
for (const name of ['deskPetBodySet', 'deskPetSchedSet']) assert.match(fnSource(pet, name), /rerenderAfterPick\(\);\}$/, `${name} waits for the wheel`);
{
  let renders = 0, blur = null;
  const input = { tagName: 'INPUT', type: 'time', addEventListener: (k, f) => { if (k === 'blur') blur = f; } };
  const ctx = vm.createContext({ document: { activeElement: input }, setTimeout: (f) => f(), rerender: () => renders++ });
  vm.runInContext(after, ctx);
  ctx.rerenderAfterPick(); ctx.rerenderAfterPick();
  assert.equal(renders, 0, 'no redraw while the wheel is open');
  blur(); assert.equal(renders, 1, 'one redraw when it closes');
  ctx.document.activeElement = null; ctx.rerenderAfterPick(); assert.equal(renders, 2, 'switches still redraw at once');
}

// 2. sleep hat
assert.match(pet, /b\.sleepBy==='hat'&&b\.energy>=95&&t-\(b\.sleptAt\|\|0\)>=3600000/, '睡帽午睡仍至少一小时');

// 3. chat menu only on long press, both bundles
for (const [label, file] of BUNDLES) {
  const app = read(file);
  const row = fnSource(app, 'bubbleRow');
  assert.match(row, /const h=selecting\?`onclick="toggleSel\('\$\{m\.id\}'\)"`:'',/, `${label}: a tap on a message opens nothing`);
  assert.match(row, /<div class="col" \$\{h\}\$\{lp\}>/, `${label}: long press still on the bubble`);
  assert.match(fnSource(app, 'qPressStart'), /msgMenu\(cid,mid\)/, `${label}: long press opens the menu`);
  const tap = fnSource(app, 'wxImgTap');
  const calls = [];
  const ctx = vm.createContext({ _lpFired: false, _sel: null, toggleSel: (m) => calls.push('sel ' + m), viewWechatMsgImage: (c, m) => calls.push('view ' + m), msgMenu: () => calls.push('menu') });
  vm.runInContext(tap, ctx);
  ctx.wxImgTap('c', 'm1'); assert.deepEqual(calls, ['view m1'], `${label}: tap opens the picture`);
  ctx._lpFired = true; ctx.wxImgTap('c', 'm1'); assert.deepEqual(calls, ['view m1'], `${label}: right after the long-press menu, no picture`);
  ctx._sel = { id: 'c' }; ctx.wxImgTap('c', 'm2'); assert.deepEqual(calls, ['view m1', 'sel m2'], `${label}: in select mode a tap selects`);
}

// 4. body facts
const prompt = fnSource(pet, 'roleBodyPrompt');
assert.match(prompt, /BODY_STATUS_LINE_V1/);
assert.match(prompt, /f\.unshift\('现状：'\+st\+'。'\+me\+'问起你饿不饿、困不困、身体怎么样、喝没喝咖啡时，按这些照实说，不要说成相反的'\)/);
assert.match(prompt, /b\.full>100\?'撑了'/);
assert.match(prompt, /else if\(b\.full<50\)/, 'hungry below 50 like the pet');
assert.match(prompt, /else if\(b\.energy<50&&!\(b\.coffeeUntil>now\)\)f\.push\('你有点困了'\)/, 'sleepy below 50 like the pet');
assert.match(prompt, /else if\(b\.health<50\)f\.push\('你最近身子有点虚，容易累'\)/, 'weak below 50 like the pet');
assert.doesNotMatch(prompt, /if\(!f\.length\)return'';/, 'the status line is always sent');
assert.match(pet, /bodyEvent\(b,me\+'刚喂你吃了一顿饭'/);
assert.doesNotMatch(pet, /bodyEvent\([^;]*一块电池/, 'he is never told he ate a battery');
assert.doesNotMatch(pet, /North/, 'shared file never names her');
console.log('body chat fixes 1105 tests passed');

// 健康归零的真实模块回归：旧代码的风险条未到100时仍不生病。
{
  const t=new Date(2026,10,7,12).getTime();
  class Clock extends Date { constructor(...a){super(...(a.length?a:[t]));} static now(){return t;} }
  const state={settings:{deskPet:{on:true,cid:'health-zero',body:{on:true,sick:'some'}}}};
  const x=vm.createContext({Date:Clock,Math,String,Number,Object,Array,JSON,Set,S:state,msgs:()=>[]});
  x.cfg=x.ensureCfg=()=>state.settings.deskPet;
  vm.runInContext(pet.slice(pet.indexOf('const BODY_MEAL='),pet.indexOf('function bodyBar(')),x);
  const role={id:'health-zero'},b=x.bodyState(role);
  Object.assign(b,{health:0,risk:0,lastTick:t-60000});
  x.bodyTick(role,t);
  assert.ok(b.sick,'健康为零时必须生病，不能只显示身体虚');
}
