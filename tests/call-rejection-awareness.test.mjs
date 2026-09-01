import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const localNoon = new Date();
localNoon.setHours(12, 0, 0, 0);
const noon = localNoon.getTime();
class TestDate extends Date {
  static now() { return noon; }
}
const rows = [];
const context = vm.createContext({
  msgs: () => rows,
  S: {me: {name: '小北'}},
  Date: TestDate,
});
vm.runInContext(
  functionSource('rejectedCallToday') + '\n' + functionSource('rejectedCallPrompt') +
  ';globalThis.stats=rejectedCallToday;globalThis.prompt=rejectedCallPrompt;',
  context,
);

rows.push({role: 'user', type: 'sys', content: '你拒绝了语音通话', time: noon - 60_000});
assert.deepEqual({...context.stats('r1', noon)}, {count: 1, voice: 1, video: 0, lastAt: noon - 60_000});
assert.match(context.prompt('r1', '语音通话', 'initial'), /今天第一次被ta拒接/);

rows.push({role: 'user', type: 'sys', content: '你拒绝了视频通话', time: noon});
const second = context.prompt('r1', '视频通话', 'initial');
assert.match(second, /今天此前已有拒接记录：共 2 次/);
assert.match(second, /语音 1 次、视频 1 次/);
assert.match(second, /不自动代表冷落、撒谎或感情变化/);
assert.match(second, /情绪和做法都由你决定/);

rows.push({role: 'user', type: 'sys', content: '你拒绝了语音通话', time: noon - 86_400_000});
assert.equal(context.stats('r1', noon).count, 2, 'yesterday must not leak into today count');

const decline = functionSource('declineCall');
assert.match(decline, /rejectedCallPrompt\(id,kindTxt,'initial'\)/);
assert.doesNotMatch(decline, /maybeCallBack\(/);
assert.doesNotMatch(decline, /suspicionHandleUserHangup\(/);
assert.match(functionSource('scheduleRejectedCallFollowup'), /return false/);

console.log('call rejection awareness tests passed');
