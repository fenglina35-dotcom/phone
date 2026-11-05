// SPY_LIST_REPAIR_V1 (2026-11-04): her WeChat reply failed with
// 「模型未回复：(sp.wechat||[]).forEach is not a function」. A 查他手机 refresh had stored the model's "wechat" as an
// object instead of a list, and every reply reads it through hisSeed. Lists are now repaired before saving, at boot,
// and when hisSeed reads them, so an already-broken save heals itself.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const ctx = vm.createContext({ Object, Array, String });
  vm.runInContext(fnSource(src, 'spyListFix') + ';' + fnSource(src, 'spyContentRepair'), ctx);
  const sp = { wechat: { 阿哲: ['他：在吗', '对方：在呢'] }, contacts: { name: '老周' }, album: '一张晚霞', orders: [] };
  assert.equal(ctx.spyContentRepair(sp), true, `${label}: broken lists are reported as repaired`);
  assert.deepEqual(JSON.parse(JSON.stringify(sp.wechat)), [{ who: '阿哲', lines: ['他：在吗', '对方：在呢'] }], `${label}: wechat object becomes a list`);
  assert.deepEqual(JSON.parse(JSON.stringify(sp.contacts)), [{ name: '老周' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(sp.album)), ['一张晚霞']);
  const single = { wechat: { who: '妈妈', lines: '他：吃了\n对方：好' } };
  ctx.spyContentRepair(single);
  assert.deepEqual(JSON.parse(JSON.stringify(single.wechat)), [{ who: '妈妈', lines: ['他：吃了', '对方：好'] }], `${label}: one chat and text lines are fixed`);
  const ok = { wechat: [{ who: 'a', lines: ['x'] }] };
  assert.equal(ctx.spyContentRepair(ok), false, `${label}: good data is left alone`);

  assert.match(fnSource(src, 'hisSeed'), /if\(typeof spyContentRepair==='function'&&spyContentRepair\(sp\)\)save\(\);/, `${label}: reply path heals old saves`);
  assert.match(src, /const data=Object\.assign\(\{\},prev\|\|\{\},ng\);spyContentRepair\(data\);/, `${label}: refresh repairs before saving`);
  assert.match(src, /window\.__northBootReady=true;defaultBeautyApplyOnFirstRun\(\)\.catch\(\(\)=>\{\}\);try\{if\(typeof spyContentRepair==='function'&&S\.spy\)/, `${label}: boot repairs all saves`);
}
console.log('spy list repair tests passed');
