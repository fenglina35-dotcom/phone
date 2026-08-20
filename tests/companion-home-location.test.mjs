import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const push = readFileSync(join(root, 'supabase', 'functions', 'phone-role-push', 'index.ts'), 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('home geofence treats overlapping GPS uncertainty as home and only confident distance as away', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${functionSource('companionNormalizeHomeLocation')}
    ${functionSource('companionHomeLocation')}
    ${functionSource('companionDistanceMeters')}
    ${functionSource('companionLocationAtHome')}
    ${functionSource('companionApplyHomeLocation')}
    this.apply=companionApplyHomeLocation;
  `, context);
  const home = { lat: 31.2304, lng: 121.4737, radius: 250, setAt: Date.now() };
  const exact = { homeLocation: home, location: { lat: 31.2304, lng: 121.4737, accuracy: 20, place: '某小区' }, footprints: [] };
  context.apply(exact);
  assert.equal(exact.location.place, '家');
  assert.equal(exact.location.sourcePlace, '某小区');

  const uncertain = { homeLocation: home, location: { lat: 31.2364, lng: 121.4737, accuracy: 500, place: '附近道路' }, footprints: [] };
  context.apply(uncertain);
  assert.equal(uncertain.location.place, '家', 'uncertainty overlapping the home radius must not claim the user is outside');

  const away = { homeLocation: home, location: { lat: 31.2504, lng: 121.4737, accuracy: 50, place: '公司' }, footprints: [] };
  context.apply(away);
  assert.equal(away.location.place, '公司');
  assert.equal(away.location.atHome, false);
});

test('home setting is user-driven, fresh-location-only, and copied into every role read', () => {
  assert.match(functionSource('companionSetHomeLocation'), /10\*60000/);
  assert.match(functionSource('companionSetHomeLocation'), /companionApplyHomeLocation\(st\)/);
  assert.match(functionSource('companionClearHomeLocation'), /st\.homeLocation=null/);
  assert.match(functionSource('companionRolePullNativeSnapshot'), /st\.homeLocation=companionNormalizeHomeLocation\(config\.homeLocation\)/);
  assert.match(functionSource('companionRolePullServerSnapshot'), /st\.homeLocation=companionNormalizeHomeLocation\(config\.homeLocation\)/);
  assert.match(app, /定位误差与范围重叠时按在家处理，只有明确离开才显示其他地点/);
});

test('background role automation receives the same home geofence instead of leaking the raw place', () => {
  assert.match(functionSource('roleServerAutomationConfig'), /homeLocation:companionHomeLocation\(st\)/);
  assert.match(push, /function snapshotLocationPlace\(/);
  assert.match(push, /distance - accuracy <= radius \? "家" : fallback/);
  assert.match(push, /snapshotAutomationFacts\(snapshot, kind, config\)/);
  assert.match(push, /最近位置\$\{snapshotLocationPlace\(config, location\)\}/);
});
