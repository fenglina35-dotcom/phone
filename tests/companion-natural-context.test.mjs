import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const edge = readFileSync(join(root, 'supabase/functions/phone-role-push/index.ts'), 'utf8');
const functionSource = name => {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  let depth = 0, seen = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; seen = true; }
    else if (app[i] === '}') {
      depth -= 1;
      if (seen && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
};

function ambientHarness(state, recent = null) {
  const now = new Date(2026, 7, 15, 20, 0, 0).getTime();
  const context = vm.createContext({
    S: { couple: { cid: 'role' } },
    companionState: () => state,
    companionAutomationFresh: (ts, age, at) => ts > 0 && at - ts >= 0 && at - ts <= age,
    companionBatteryIsCharging: battery => /充电|已充满/i.test(String(battery?.state || '')),
    companionDuration: seconds => `${Math.round(seconds / 60)}分钟`,
    companionUsageSnapshotFresh: (st, at, age) => at - st.usageGeneratedAt <= age,
    initiativeRecentUser: () => recent,
  });
  vm.runInContext(`${functionSource('companionAmbientContext')};this.ambient=companionAmbientContext`, context);
  return { context, now };
}

test('fresh meaningful facts can enter daily context without becoming a report', () => {
  const now = new Date(2026, 7, 15, 20, 0, 0).getTime();
  const { context } = ambientHarness({
    linked: true, demo: false, roleAccess: true,
    permissions: { battery: true, health: true, screenTime: true, location: true },
    battery: { level: 0.12, state: '使用电池', lowPower: true, ts: now - 5 * 60_000 },
    health: null, location: null,
    screenTimeSec: 7200,
    usageGeneratedAt: now - 10 * 60_000,
  });
  const output = context.ambient({ id: 'role' }, now);
  assert.match(output, /当前电量 12%/);
  assert.match(output, /屏幕总使用 120分钟/);
  assert.match(output, /最多一项/);
  assert.match(output, /否则完全忽略/);
  assert.match(output, /禁止逐项念数据/);
});

test('stale, ordinary or contextless sensitive facts stay out', () => {
  const now = new Date(2026, 7, 15, 20, 0, 0).getTime();
  const { context } = ambientHarness({
    linked: true, demo: false, roleAccess: true,
    permissions: { battery: true, health: true, screenTime: true, location: true },
    battery: { level: 0.85, state: '使用电池', ts: now - 60 * 60_000 },
    health: null,
    screenTimeSec: 0,
    usageGeneratedAt: 0,
    location: { place: '某处', ts: now - 5 * 60_000 },
  });
  assert.equal(context.ambient({ id: 'role' }, now), '');
});

test('server ambient context is permission scoped, fresh and optional', () => {
  assert.match(edge, /function snapshotAmbientFacts/);
  assert.match(edge, /permissions\.battery === true/);
  assert.match(edge, /permissions\.health === true/);
  assert.match(edge, /permissions\.screenTime === true/);
  assert.match(edge, /permissions\.location === true/);
  assert.match(edge, /fresh\(telemetry\.generatedAt, 20 \* 60_000\)/);
  assert.match(edge, /split\(\/\\r\?\\n\/\)\.slice\(-4\)/);
  assert.match(edge, /其中某一项与本轮联系自然相关时，才带入最多一项；否则完全忽略/);
  assert.match(edge, /roleMessage\(profile, recentBodies, ambientInstruction, ambientFacts, true, true\)/);
});
