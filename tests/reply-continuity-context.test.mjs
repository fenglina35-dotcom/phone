import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bundled = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');

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

test('100 configured WeChat rounds are real complete ordinary rounds', () => {
  const context = vm.createContext({ Math });
  vm.runInContext(`${functionSource(app, 'lastRounds')};this.lastRounds=lastRounds`, context);
  const rows = [];
  for (let round = 0; round < 120; round += 1) {
    rows.push({ id: `u${round}`, role: 'user', content: `用户${round}` });
    for (let bubble = 0; bubble < 4; bubble += 1) rows.push({ id: `a${round}-${bubble}`, role: 'assistant', content: `回复${round}-${bubble}` });
  }
  const selected = context.lastRounds(rows, 100);
  assert.equal(selected.length, 500);
  assert.equal(selected[0].id, 'u20');
  assert.equal(selected.at(-1).id, 'a119-3');
  assert.equal(selected.filter(row => row.role === 'user').length, 100);
});

test('the settings UI and save path both state and enforce the 2 to 100 range', () => {
  assert.match(app, /带几个回合（2–100，最高100回合）/);
  assert.match(app, /整通语音\/视频算1回合/);
  assert.match(app, /id="s_hist" type="number" min="2" max="100"/);
  assert.match(app, /S\.settings\.hist=Math\.max\(2,Math\.min\(100,/);
  assert.doesNotMatch(app, /S\.settings\.hist=Math\.max\(2,Math\.min\(40,/);
});

test('continuity pin keeps raw cross-channel statements without turning examples into facts', () => {
  const now = Date.parse('2026-08-28T20:00:00+08:00');
  const rows = Array.from({ length: 10 }, (_, index) => ({
    at: now - (10 - index) * 60_000,
    channel: index === 7 ? 'call' : index === 8 ? 'cohab' : 'online',
    role: index % 2 ? 'assistant' : 'user',
    text: index === 8 ? '比如说已经回家又说还在路上' : index === 9 ? '我刚答应等你回来再说' : `原话${index}`,
  }));
  const context = vm.createContext({
    Date,
    String,
    S: { settings: { timeAware: true }, me: { name: '用户' } },
    roleInteractionRows: () => rows,
    offlineWechatLiveOn: () => true,
    fmtDT: value => new Date(value).toISOString(),
  });
  vm.runInContext(`${functionSource(app, 'roleReplyContinuityPin')};this.pin=roleReplyContinuityPin`, context);
  const prompt = context.pin({ name: '角色' }, now);
  assert.doesNotMatch(prompt, /原话0|原话1/);
  assert.match(prompt, /\[电话\]/);
  assert.match(prompt, /\[共同生活\]/);
  assert.match(prompt, /我刚答应等你回来再说/);
  assert.match(prompt, /假设、举例、引用、玩笑、询问和尚未实行的计划不能当成已经发生/);
  assert.match(prompt, /不得无依据推翻、倒退或改写上一轮状态/);
  assert.match(prompt, /资料不足就自然询问/);
  assert.doesNotMatch(functionSource(app, 'roleReplyContinuityPin'), /chatAPI\(/);
});

test('continuity is limited to reply routes and excluded from global and visual-special prompts', () => {
  assert.doesNotMatch(functionSource(app, 'buildSystem'), /roleReplyContinuityPin/);
  assert.match(app, /roleReplyTimelinePin\(c\)\+roleReplyContinuityPin\(c,Date\.now\(\)\)/);
  assert.match(functionSource(app, 'roleServerPushRecentContext'), /roleReplyContinuityPin\(c,Date\.now\(\)\)/);
  assert.match(functionSource(app, 'cohabReplyCore'), /offlineFormatPin\(c\)\+roleReplyContinuityPin\(c,Date\.now\(\),\{channel:'cohab'\}\)/);
  assert.match(functionSource(app, 'cohabRepairMessages'), /offlineFormatPin\(c\)\+roleReplyContinuityPin\(c,Date\.now\(\),\{channel:'cohab'\}\)/);
  assert.match(app, /const _ordinaryCallContinuity=!_videoVision&&!_screenShareEvent&&!_connectionEvent&&!_inspectionCompletion\?roleReplyContinuityPin/);
});

test('disabled online and co-living sync keeps both continuity worlds isolated', () => {
  const now = Date.parse('2026-08-28T20:00:00+08:00');
  const rows = [
    { at: now - 3_000, channel: 'online', role: 'user', text: '微信里的事情' },
    { at: now - 2_000, channel: 'call', role: 'assistant', text: '电话里的回答' },
    { at: now - 1_000, channel: 'cohab', role: 'user', text: '共同生活里的事情' },
  ];
  const context = vm.createContext({
    Date,
    String,
    S: { settings: { timeAware: true }, me: { name: '用户' } },
    roleInteractionRows: () => rows,
    offlineWechatLiveOn: () => false,
    fmtDT: value => new Date(value).toISOString(),
  });
  vm.runInContext(`${functionSource(app, 'roleReplyContinuityPin')};this.pin=roleReplyContinuityPin`, context);
  const online = context.pin({ name: '角色' }, now);
  assert.match(online, /微信里的事情/);
  assert.match(online, /电话里的回答/);
  assert.doesNotMatch(online, /共同生活里的事情/);
  const cohab = context.pin({ name: '角色' }, now, { channel: 'cohab' });
  assert.match(cohab, /共同生活里的事情/);
  assert.doesNotMatch(cohab, /微信里的事情|电话里的回答/);
});

test('web source and private iOS bundle stay byte-for-byte synchronized', () => {
  assert.equal(bundled, app);
  assert.equal(functionSource(bundled, 'roleReplyContinuityPin'), functionSource(app, 'roleReplyContinuityPin'));
  assert.equal(functionSource(bundled, 'lastRounds'), functionSource(app, 'lastRounds'));
});
