import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const bundled = fs.readFileSync(path.join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'), 'utf8');

function functionSource(name, text = source) {
  const start = text.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = text.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

test('period records expand to complete day ranges and calculate factual cycle context', () => {
  const names = ['calDateParts', 'calUtcValue', 'calDayDiff', 'calAddDays', 'periodStore', 'periodNormalize', 'periodRecords', 'periodEstimate', 'periodFactsText'];
  const context = vm.createContext({
    S: { periods: [
      { id: 'p1', startDate: '2026-07-01', endDate: '2026-07-05' },
      { id: 'p2', startDate: '2026-07-29', endDate: '2026-08-02' },
    ] },
    todayStr: () => '2026-07-31',
    Date,
    Number,
    Math,
    String,
    Array,
    Object,
  });
  vm.runInContext(`${names.map((name) => functionSource(name)).join('\n')}this.api={calDayDiff,calAddDays,periodEstimate,periodFactsText};`, context);
  assert.equal(context.api.calDayDiff('2026-08-02', '2026-07-29') + 1, 5);
  assert.equal(context.api.calAddDays('2026-07-29', 4), '2026-08-02');
  assert.equal(context.api.periodEstimate().date, '2026-08-26');
  assert.match(context.api.periodFactsText(), /共5天/);
  assert.match(context.api.periodFactsText(), /距离上一次结束间隔23天/);
  assert.match(context.api.periodFactsText(), /第3天/);
});

test('couple goals preserve date, time, daily completion and exact-once reminder state', () => {
  const goalNames = ['coupleGoalStore', 'coupleGoalTitle', 'coupleGoalActive', 'coupleGoalKey', 'coupleGoalDone', 'coupleGoalUpsert'];
  const dateNames = ['calDateParts', 'calUtcValue', 'calDayDiff'];
  const context = vm.createContext({
    S: { couple: { cid: 'r1', goals: [] } },
    todayStr: () => '2026-08-18',
    uid: () => 'goal-1',
    Date,
    Number,
    Math,
    String,
    Array,
    Object,
  });
  vm.runInContext(`${dateNames.concat(goalNames).map((name) => functionSource(name)).join('\n')}this.api={coupleGoalUpsert,coupleGoalActive,coupleGoalKey,coupleGoalDone};`, context);
  const goal = context.api.coupleGoalUpsert('每天健身', '2026-08-18', '2026-09-18', '19:30', 'manual');
  assert.equal(goal.time, '19:30');
  assert.equal(context.api.coupleGoalActive(goal, '2026-08-18'), true);
  assert.equal(context.api.coupleGoalKey(goal, '2026-08-18'), 'couple_goal_goal-1');
  goal.completedDays['2026-08-18'] = 1;
  assert.equal(context.api.coupleGoalDone(goal, '2026-08-18'), true);
});

test('goal and period UI and proactive safeguards are wired into existing reliable paths', () => {
  assert.match(source, /id="cou_goals"/);
  assert.match(source, /每项每天最多提醒一次/);
  assert.match(source, /function coupleGoalReminder\([\s\S]*scheduleFeatureReply/);
  assert.match(source, /function checkCalendar\([\s\S]*coupleGoalKey/);
  assert.match(source, /function renderCalendar\([\s\S]*periodRecords\(\)[\s\S]*_periodDay/);
  assert.match(source, /经期临近生活提醒/);
  assert.match(source, /预测只依据你的历史记录/);
  assert.match(source, /consumeCoupleGoalTags\(content,c\)/);
  assert.match(source, /监督目标\|目标名称/);
});

test('goal and period implementation stays synchronized in the private app bundle', () => {
  const names = [
    'calUtcValue', 'calDayDiff', 'calAddDays', 'periodStore', 'periodNormalize',
    'periodRecords', 'periodEstimate', 'periodFactsText', 'periodSummaryCard',
    'calDeletePeriod', 'calEventRow', 'renderCalendar', 'addCalEvent',
    'calEventTypeChanged', 'saveCalEvent',
    'coupleGoalStore', 'coupleGoalTitle', 'coupleGoalActive', 'coupleGoalKey',
    'coupleGoalDone', 'coupleGoalUpsert', 'coupleGoalModal', 'coupleGoalSave',
    'coupleGoalComplete', 'coupleGoalToggle', 'coupleGoalDelete', 'coupleGoalRows',
    'consumeCoupleGoalTags', 'coupleGoalOnUserMsg', 'coupleGoalReminder',
    'periodForecastReminder', 'checkCalendar',
  ];
  const normalized = (value) => value.replace(/\r\n/g, '\n');
  for (const name of names) assert.equal(normalized(functionSource(name, bundled)), normalized(functionSource(name)));
});
