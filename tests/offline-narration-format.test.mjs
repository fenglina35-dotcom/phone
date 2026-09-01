import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const parserStart = source.indexOf('function offNarrationText(part)');
const parserEnd = source.indexOf('function offGeneratedTalk(text)', parserStart);
const visibleStart = source.indexOf('function roleVisibleEnvelopeText(value)');
const visibleEnd = source.indexOf('\n', visibleStart);

assert.ok(parserStart >= 0 && parserEnd > parserStart, 'offline narration parser must exist');
assert.ok(visibleStart >= 0 && visibleEnd > visibleStart, 'visible reply envelope parser must exist');

const sandbox = {
  splitBubbles(text) {
    return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  },
  splitActions(line) {
    const out = [];
    const re = /[（(【][^）)】]*[）)】]/g;
    let last = 0;
    let match;
    while ((match = re.exec(line))) {
      const before = line.slice(last, match.index).trim();
      if (before) out.push(before);
      out.push(match[0].trim());
      last = re.lastIndex;
    }
    const tail = line.slice(last).trim();
    if (tail) out.push(tail);
    return out.length ? out : [line];
  },
};

vm.runInNewContext(
  source.slice(visibleStart, visibleEnd) + '\n' + source.slice(parserStart, parserEnd) +
    ';globalThis.parse=offResponseParts;' +
    'globalThis.narration=offNarrationText;' +
    'globalThis.implicitNarration=offImplicitNarrationText;',
  sandbox,
);

for (const [input, expected] of [
  ['【他把外套披到她肩上。】', '他把外套披到她肩上。'],
  ['（两人沿着河边慢慢往前走。）', '两人沿着河边慢慢往前走。'],
  ['旁白：她抬头看向他。', '她抬头看向他。'],
  ['[旁白|夜风吹过树梢。]', '夜风吹过树梢。'],
  ['动作旁白：他把杯子推到她面前。', '他把杯子推到她面前。'],
]) {
  assert.equal(sandbox.narration(input), expected, `must normalize narration: ${input}`);
}

assert.equal(sandbox.narration('他是谁？'), null, 'ordinary dialogue must not be guessed as narration');
assert.equal(sandbox.implicitNarration('他没动。'), '他没动。', 'bare third-person action must be detected before it becomes role dialogue');
assert.equal(sandbox.implicitNarration('她的声音从十几米外砸过来，视线已经锁在那个方向。'), '她的声音从十几米外砸过来，视线已经锁在那个方向。', 'long bare action prose must be detected');
assert.equal(sandbox.implicitNarration('过来。'), null, 'short spoken imperative must remain dialogue');
assert.equal(sandbox.implicitNarration('他是谁？'), null, 'spoken third-person question must remain dialogue');
assert.equal(sandbox.implicitNarration('他不爱我。'), null, 'ordinary spoken reference to a third party must remain dialogue');
assert.deepEqual(
  Array.from(sandbox.parse('【他停下脚步。】\n别怕，我在这里。'), (part) => ({ ...part })),
  [
    { kind: 'nar', text: '他停下脚步。' },
    { kind: 'talk', text: '别怕，我在这里。' },
  ],
);
assert.deepEqual(
  Array.from(sandbox.parse('旁白：她笑了一下。\n跟我走吧。'), (part) => ({ ...part })),
  [
    { kind: 'nar', text: '她笑了一下。' },
    { kind: 'talk', text: '跟我走吧。' },
  ],
);

assert.match(source, /!parts\.some\(x=>x\.kind==='nar'\)/, 'malformed replies without narration must be rewritten');
assert.match(source, /parts\.some\(x=>x\.implicit\)/, 'mixed replies with bare narration must also be rewritten');
assert.match(source, /personaPin\(c\)\+offlineFormatPin\(c\)/, 'format contract must be repeated at the end of the offline request');
assert.match(source, /const whole=offResponsePart\(l\);if\(whole\.kind==='nar'\)\{items\.push\(\{id:uid\(\),who:'旁白'/, 'explicit narration must be stored as narration');
assert.match(source, /who:part\.kind==='nar'\?'旁白':'ta'/, 'mixed narration and dialogue must keep separate storage roles');

console.log('offline narration format tests passed');
