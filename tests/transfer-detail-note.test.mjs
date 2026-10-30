import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// TRANSFER_NOTE_DETAIL_V1 (2026-10-30, her request): the words a role sends with a transfer were cut off in the bubble
// and the detail page did not show them at all. The detail page now has a 附言 row under 收款时间 with the full text.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const NOTE = '看吧。这是先生给你的，别舍不得花，想买什么就买，买完了告诉我一声，不够再要。';
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const render = (m) => {
    const ctx = { cur: () => ({}), transferMessageFind: () => ({ cid: 'r1', m }), transferState: x => x.received ? 'received' : 'pending', transferDetailGlyph: () => '', transferDateTime: () => '2026年10月23日 21:51:41', esc: t => String(t).replace(/[&<>"']/g, '') };
    vm.createContext(ctx); vm.runInContext(fn(s, 'renderTransferDetail'), ctx); return ctx.renderTransferDetail('r1', m.id);
  };
  test(file + ': the role\'s words show in full under 收款时间', () => {
    const html = render({ id: 'm1', role: 'assistant', type: 'transfer', amount: 52000, note: NOTE, received: true, transferAt: 1, receivedAt: 2 });
    assert(html.includes('附言') && html.includes(NOTE), 'full note shown');
    assert(html.indexOf('附言') > html.indexOf('收款时间'), 'under 收款时间');
  });
  test(file + ': no empty 附言 row without words', () => {
    assert(!render({ id: 'm2', role: 'assistant', type: 'transfer', amount: 1, note: '', received: false, transferAt: 1 }).includes('附言'));
  });
}
for (const css of ['glass-theme.css', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css'])
  test(css + ': the 附言 wraps instead of running off the screen', () => { assert(/\.wx-transfer-detail-note dd\{[^}]*white-space:pre-wrap/.test(fs.readFileSync(css, 'utf8'))); });
