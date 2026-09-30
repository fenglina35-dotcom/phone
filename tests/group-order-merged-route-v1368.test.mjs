import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1368 角色群：点名/@ 的人先回（按出现先后），然后情侣角色；没点名情侣先回。合并调用走角色自己的路线，失败时退回每人单独调用。
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const fn = name => {
  const i = app.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert.ok(i >= 0, 'missing ' + name);
  let depth = 0, quote = '', esc = false;
  for (let k = app.indexOf('{', i); k < app.length; k++) {
    const ch = app[k];
    if (quote) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === quote) quote = ''; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++; else if (ch === '}' && !--depth) return app.slice(i, k + 1);
  }
};
const line = prefix => app.split('\n').find(l => l.startsWith(prefix)) || '';

test('named roles answer first in the order they were named, then the couple role', () => {
  const ctx = { S: { couple: { cid: 'c' } }, gnm: (g, id) => (g.nicks || {})[id] || ({ c: '克劳德', h: '小助手', q: '阿言' })[id] };
  vm.runInNewContext([line('const GROUP_QUIET_RE='), line('const GROUP_LIVELY_RE='), line('const GROUP_TOPIC_STOP='), fn('groupRoleTemper'), fn('groupRoleCares'), fn('groupReplyPlan'), 'globalThis.plan=groupReplyPlan;'].join('\n'), ctx);
  const members = [{ id: 'c', name: '克劳德', remark: '先生', persona: '' }, { id: 'h', name: '小助手', persona: '' }, { id: 'q', name: '阿言', persona: '社恐' }];
  const g = { msgMin: 1, msgMax: 2, nicks: { q: '言言' } };
  const ids = t => Array.from(ctx.plan(g, members, t, () => 0.99), x => x.c.id);
  assert.deepEqual(ids('小助手你扮演系统，先生你扮演攻略者').slice(0, 2), ['h', 'c'], 'remark counts as naming and order follows the sentence');
  assert.deepEqual(ids('@言言 你怎么不说话').slice(0, 2), ['q', 'c'], 'group nickname counts too');
  assert.equal(ids('今晚干嘛')[0], 'c', 'no name: couple first');
});

test('merged calls use the first member route and fall back to separate calls when they fail', () => {
  assert.match(fn('groupBatchReplyItems'), /const route=typeof roleChatRouteIndex==='function'\?roleChatRouteIndex\(batch\[0\]\.c\):null;/);
  assert.match(fn('groupBatchReplyItems'), /out\.failed=true;return out;/);
  assert.match(fn('aiGroupReplyRun'), /if\(got\.failed\)\{[^]*?groupRoleReplyItems\(g,e\.c,/);
});
