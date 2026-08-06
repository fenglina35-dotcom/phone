import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

function lineFunctionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, end < 0 ? source.length : end).trim();
}

const fixedNow = new Date();
fixedNow.setHours(12, 0, 0, 0);
const now = fixedNow.getTime();
class FixedDate extends Date {
  static now() { return now; }
}
const rows = Array.from({length: 7}, (_, i) => ({
  id: `loc-${i + 1}`,
  role: 'assistant',
  type: 'location',
  name: `真实地点${i + 1}`,
  address: `英国 · 伦敦 · 真实地点${i + 1}`,
  time: now - (7 - i) * 60_000,
  loc: {x: 300 + i, y: 240 + i, city: '伦敦', country: '英国'},
}));
rows.push({id: 'text', role: 'assistant', type: 'text', content: '不是位置', time: now - 30_000});
rows.push({id: 'future', role: 'assistant', type: 'location', name: '未来地点', time: now + 60_000, loc: {x: 1, y: 1}});

const context = vm.createContext({
  Date: FixedDate,
  msgs: () => rows,
  liveLocForMsg: (_c, m) => ({...m.loc, name: m.name, address: m.address}),
  liveLocJitter: (loc) => ({x: loc.x, y: loc.y}),
  hm: (ts) => new Date(ts).toISOString().slice(11, 16),
});
vm.runInContext(lineFunctionSource('liveLocTrail') + ';globalThis.trail=liveLocTrail;', context);
const trail = context.trail({id: 'role-1'});

assert.equal(trail.length, 5, 'map and list should share the same five latest real location records');
assert.deepEqual(Array.from(trail, x => x.id), ['loc-3', 'loc-4', 'loc-5', 'loc-6', 'loc-7']);
assert.ok(trail.every(x => x.source === '位置分享'));
assert.ok(trail.every(x => /^真实地点/.test(x.label)));
assert.doesNotMatch(lineFunctionSource('liveLocTrail'), /08:10|10:35|14:20|18:40|21:05/);
assert.match(source, /function liveLocDailyTrail/);
assert.match(lineFunctionSource('liveLocTrail'), /liveLocDailyTrail\(c,now,5-real\.length\)/);

const render = lineFunctionSource('renderLiveMap');
assert.equal((render.match(/trail\.map\(\(p,i\)=>/g) || []).length, 2, 'the markers and foot list must render from the identical trail array');
assert.match(render, /地图标记与记录一一对应/);
assert.match(render, /liveMapCityLabels\(roleLoc,myLoc\)/);
assert.match(render, /liveMapRegionSVG\(\)/);
assert.match(render, /lmfootrow/);
assert.match(render, /trail\.length>3\?' lmdense'/);

assert.match(html, /\.lmcarto\{/);
assert.match(html, /\.lmcity\{/);
assert.match(html, /\.lmtrail b,\.lmtrail small\{display:block/);
assert.match(html, /\.lmfoot\{[^}]*max-height:none/);
assert.match(html, /\.livemap\.lmdense \.lmtrail/);
assert.match(html, /\.lmzones path/);
assert.match(html, /\.lmroutes path/);
assert.match(lineFunctionSource('liveMapRegionSVG'), /class="lmzones"/);
assert.match(lineFunctionSource('liveMapRegionSVG'), /class="lmroutes"/);
assert.match(html, /app\.js\?v=824/);

console.log('live map footprint tests passed');
