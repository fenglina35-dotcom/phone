import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1380 多人剧场配角：JSON 里台词带没转义的引号时不再整段原样显示；动作/台词分错时纠正。
const src = fs.readFileSync(new URL('../cohab-theater.js', import.meta.url), 'utf8');
const lines = src.split('\n');
const grab = n => { const i = lines.findIndex(l => l.startsWith('function ' + n + '(')); assert.ok(i >= 0, 'missing ' + n); let j = i + 1; while (j < lines.length && /^\s/.test(lines[j])) j++; return lines.slice(i, j).join('\n'); };
const ctx = { modelUnfilteredLines: s => s.split('\n'), roleVisibleEnvelopeText: s => s, theaterText: (s, n) => String(s || '').trim().slice(0, n) };
vm.runInNewContext(['theaterLooseBubbles', 'theaterFixBubbles', 'theaterRawActor', 'theaterBubble', 'theaterParseActor'].map(grab).join('\n') + ';globalThis.R=theaterRawActor;globalThis.P=theaterParseActor;globalThis.F=theaterFixBubbles;', ctx);
const broken = '{"bubbles":[{"type":"action","text":"罗拉听到那声"妈"，目光移过去。"},{"type":"speak","text":"叫得倒是甜。"},{"type":"speak","text":"过来，先把汤喝了。"}]}';

test('broken JSON with inner quotes still becomes separate action and speech bubbles', () => {
  for (const out of [ctx.R(broken), ctx.P(broken, 6)]) {
    assert.deepEqual(Array.from(out.bubbles, b => b.type + ':' + b.text), ['action:罗拉听到那声"妈"，目光移过去。', 'speak:叫得倒是甜。', 'speak:过来，先把汤喝了。']);
  }
});

test('speech labelled as action and narration labelled as speech are put right', () => {
  const out = ctx.F([{ type: 'action', text: '提前说？提前说你就把人藏起来，我还看不见这出了？' }, { type: 'action', text: '她没有再往前走，双手交叠在身前。' }, { type: 'action', text: '她冷笑着说：“自己处理。行，我看看。”' }, { type: 'speak', text: '罗拉脚步没停，走到走廊中间站定，目光越过儿子的肩膀。' }, { type: 'speak', text: '汤在玄关柜上。' }], '罗拉');
  assert.deepEqual(Array.from(out, b => b.type), ['speak', 'action', 'action', 'speak', 'action', 'speak']);
  assert.match(src, /out\.bubbles=theaterFixBubbles\(out\.bubbles,plan\.name\);/);
});
