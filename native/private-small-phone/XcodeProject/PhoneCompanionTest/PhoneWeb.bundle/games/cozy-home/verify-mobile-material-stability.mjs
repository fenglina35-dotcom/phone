import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('./app.mjs',import.meta.url),'utf8');
const female=fs.readFileSync(new URL('./female-avatar001.mjs',import.meta.url),'utf8');

assert.match(app,/const warmDraw=\(\)=>\{const warmMaps=new Map\(\),materialClones=new Map\(\),objectSwaps=\[\]/,
 'mobile warmup must use isolated cloned materials');
assert.match(app,/finally\{for\(const \[o,material\]of objectSwaps\)o\.material=material/,
 'every warm draw must restore formal scene materials');
assert.match(app,/mirrors\.releaseGPU\(\);const geometries=new Set\(\)/,
 'temporary mirror and geometry allocations must be released before entry');
assert.doesNotMatch(app,/renderer\.setSize\(96,96,false\)/,
 'mobile boot must not preload all real room resources into a tiny live canvas');
assert.doesNotMatch(app,/renderer\.shadowMap\.needsUpdate=true;renderer\.render\(scene,camera\);await stage\('正在准备房间光影…'\)/,
 'mobile room loop must not draw formal materials for every room');
assert.match(app,/revision:52/,'the repaired build must carry a new revision');
assert.doesNotMatch(female,/if\(Math\.abs\(amount\)<1e-7\)return/,
 'standing pose must not be skipped when procedural movement amount is zero');
assert.match(female,/proceduralDeltas=.*proceduralEuler=new T\.Euler\(\),proceduralWorld=new T\.Quaternion\(\),proceduralParent=new T\.Quaternion\(\)/,
 'standing pose should reuse scratch transforms without per-limb frame allocations');

console.log('mobile material stability guard passed');
