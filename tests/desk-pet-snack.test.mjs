// DESK_PET_SNACK_V1 (2026-11-05): the desk pet has a snack box. With the switch on, a double tap on the pet opens it;
// long-press an emoji and drag it to the pet's mouth to feed. Every food is one model call (he reacts in chat) and a
// care log line. Snacks never change fullness, energy or health. With the switch off a double tap opens nothing.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';

const web = read('desk-pet.js');
assert.equal(read(PRIV_DIR + 'desk-pet.js'), web, 'private desk-pet.js is the same file');
assert.ok(web.includes('DESK_PET_SNACK_V1'), 'snack box present');

const block = web.slice(web.indexOf('const SNACK_GROUPS='), web.indexOf('const SNACK_REACT='));
const ctx = vm.createContext({});
vm.runInContext(block.replace(/^const /gm, 'var '), ctx);
const foods = ctx.SNACKS;
assert.ok(foods.length >= 150, `lots of foods (${foods.length})`);
const names = foods.map(f => f.e);
assert.equal(new Set(names).size, names.length, 'no food twice');
for (const e of ['🌶️', '🍋', '🍰', '🍺', '🍜', '🧋', '💩', '🪳', '🧦', '🪨'])
  assert.ok(names.includes(e), `has ${e}`);
assert.ok(foods.filter(f => f.g === '整蛊').length >= 20, 'plenty of prank items');
assert.ok(foods.every(f => /[一-龥]/.test(f.n)), 'every food has a Chinese name');

const fn = (name) => fnSource(web, name);
// double tap opens only when the switch is on
assert.match(web, /if\(p&&p\.snack!==false&&now-lastPetTapAt<330\)\{lastPetTapAt=0;snackOpen\(\);return;\}/);
assert.match(fn('snackOpen'), /if\(!p\.snack\)/);
// long press, then drop near the mouth
assert.match(fn('snackDown'), /setTimeout\(\(\)=>snackPick\(e\.clientX,e\.clientY\),220\)/);
assert.match(fn('snackUp'), /if\(P\.picked&&snackNearMouth\(x,y\)\)snackFeed\(P\.food\);else snackDropGhost\(\);/);
// one model call per food, a care log line, and no body numbers touched
const feed = web.slice(web.indexOf('function snackFeed('), web.indexOf('function snackFx('));
assert.equal((feed.match(/scheduleReply\(/g) || []).length, 1, 'one model call per food');
assert.match(feed, /bodyLog\(b,'你喂了他 '/);
assert.doesNotMatch(feed, /\.(full|energy|health|risk)\s*[+\-]?=/, 'snacks never change the body');
assert.doesNotMatch(feed, /North/, 'shared file never names her');
// the pet climbs on the box so the box never hides it
assert.match(web, /function bubbleOk\(el\)\{if\(el&&typeof snackEl!=='undefined'&&el===snackEl\)return el\.isConnected;/);
assert.match(web, /Object\.assign\(window,\{deskPetSnackSet,deskPetSnackOpen:/);
// flipping a switch on the pet page keeps the scroll position instead of jumping to the top
assert.match(fnSource(web, 'rerender'), /const sc=dpScroller\(\),top=sc\?sc\.scrollTop:0;render\(\);/);
// prank food makes him shake on the box, never run off behind it
assert.doesNotMatch(fnSource(web, 'snackFeed'), /runAway/);
for (const [, file] of BUNDLES) assert.doesNotMatch(read(file), /DESK_PET_SNACK_V1/, `${file}: snack code stays in desk-pet.js`);
console.log('desk pet snack tests passed');
