import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// TASK_DUE_SLOT_V1 / TASK_PUNISH_V1: run the real helpers from both bundles, not a copy of them.
const BUNDLES = ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'];
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const grab = (src, name) => {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return src.slice(start, i + 1);
};
const load = (file, now) => {
  const src = read(file), slots = src.match(/const TASK_SLOTS=\[[^\n]*\];/);
  assert.ok(slots, 'TASK_SLOTS must exist');
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
  const ctx = vm.createContext({ Date: FakeDate });
  vm.runInContext([slots[0], ...['taskDueFor', 'taskDueAt', 'taskOverdue', 'taskPunishDue'].map(n => grab(src, n))].join('\n') + ';this.f={taskDueFor,taskDueAt,taskOverdue,taskPunishDue};', ctx);
  return ctx.f;
};

for (const file of BUNDLES) {
  test(file + ': a task that names a time of day gets a deadline and goes overdue after it', () => {
    const at = new Date(2026, 9, 18, 12, 0).getTime(), f = load(file, at), t = { date: '2026-10-18' };
    assert.deepEqual({ ...f.taskDueFor({}, '早上起床先拍一张自拍给我') }, { due: '10:00', slot: '早上' });
    assert.deepEqual({ ...f.taskDueFor({ due: '8:30' }, '早上喝杯水') }, { due: '08:30', slot: '早上' });
    assert.equal(f.taskDueFor({}, '写三句想我的话'), null);
    assert.equal(f.taskOverdue({ due: '10:00' }, t), true);
    assert.equal(f.taskOverdue({ due: '10:00', done: true }, t), false);
    assert.equal(f.taskOverdue({ due: '18:00' }, t), false);
    assert.equal(f.taskOverdue({}, t), false);
  });
  test(file + ': a punishment task always has a deadline later today', () => {
    const f = load(file, new Date(2026, 9, 18, 21, 0).getTime());
    assert.equal(f.taskPunishDue('22:30'), '22:30');
    assert.equal(f.taskPunishDue(''), '23:30');
    assert.equal(f.taskPunishDue('21:10'), '23:30', 'less than an hour is not a fair deadline');
    assert.equal(load(file, new Date(2026, 9, 18, 23, 20).getTime()).taskPunishDue(''), '23:59');
  });
}
