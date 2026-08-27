import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bundled = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');
const edge = readFileSync(new URL('../supabase/functions/phone-role-push/index.ts', import.meta.url), 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let quote = '';
  let escape = false;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function mealRuntime(rows) {
  const context = {
    Date,
    Math,
    String,
    roleInteractionRows: () => rows,
    fmtDT: (at) => new Date(at).toISOString(),
  };
  vm.createContext(context);
  for (const name of ['recentMealProgressState', 'recentMealBaselineQuestion', 'recentMealProgress', 'recentMealProgressPrompt']) {
    vm.runInContext(functionSource(app, name), context);
  }
  return context;
}

test('meal care advances from going to eat instead of asking the baseline question again', () => {
  const now = Date.parse('2026-08-27T12:00:00+08:00');
  const rows = [
    { at: Date.parse('2026-08-27T11:25:00+08:00'), channel: 'online', role: 'assistant', text: '午饭吃了没有？' },
    { at: Date.parse('2026-08-27T11:30:00+08:00'), channel: 'online', role: 'user', text: '我去吃饭了' },
  ];
  const runtime = mealRuntime(rows);
  const progress = runtime.recentMealProgress({}, now);
  assert.equal(progress.state, 'started');
  assert.equal(progress.asked, true);
  const prompt = runtime.recentMealProgressPrompt({}, now);
  assert.match(prompt, /已经明确准备去吃/);
  assert.match(prompt, /你此前已经问过是否吃饭/);
  assert.match(prompt, /问吃好了吗、吃得怎么样或吃了什么/);
  assert.match(prompt, /不能退回去再问“吃饭了吗\/吃饭没有”/);
});

test('meal care recognizes completion, expires, and ignores questions about the role', () => {
  const now = Date.parse('2026-08-27T12:00:00+08:00');
  let runtime = mealRuntime([
    { at: Date.parse('2026-08-27T11:55:00+08:00'), channel: 'call', role: 'user', text: '我刚刚吃完午饭了' },
  ]);
  assert.equal(runtime.recentMealProgress({}, now).state, 'finished');
  assert.match(runtime.recentMealProgressPrompt({}, now), /如果用户已说吃完，也不能再问吃好没有/);

  runtime = mealRuntime([
    { at: Date.parse('2026-08-27T11:55:00+08:00'), channel: 'online', role: 'user', text: '你吃午饭了吗？' },
  ]);
  assert.equal(runtime.recentMealProgress({}, now), null);

  runtime = mealRuntime([
    { at: Date.parse('2026-08-27T07:00:00+08:00'), channel: 'cohab', role: 'user', text: '我去吃早饭了' },
  ]);
  assert.equal(runtime.recentMealProgress({}, now), null, 'old meal state must not leak into a later meal');
});

test('foreground, private bundle, and server proactive prompts share the same progress rule', () => {
  assert.equal(functionSource(app, 'recentMealProgressPrompt'), functionSource(bundled, 'recentMealProgressPrompt'));
  assert.match(app, /# 最近关心事项必须沿用进度/);
  assert.match(functionSource(app, 'roleServerPushRecentContext'), /recentMealProgressPrompt\(c\)/);
  assert.match(edge, /若最近上下文包含“最近关心事项进度”/);
  assert.match(edge, /只能询问下一步，不能退回去重问已经得到答案的基础问题/);
});
