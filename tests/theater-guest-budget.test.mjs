import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// THEATER_GUEST_BUDGET_V1 (2026-10-30, her report): in 共同生活多人剧场 every role except the host failed at once with
// most models (only one worked), while the same models worked online. Guests asked for max(240, bubbles*120) tokens;
// thinking models such as gemini-2.5-pro use that up before writing. Guests now get the same budget as the host reply.
function fn(src, name, isAsync) {
  const i = src.indexOf((isAsync ? 'async ' : '') + 'function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const app = fs.readFileSync('app.js', 'utf8');
for (const file of ['cohab-theater.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/cohab-theater.js']) {
  const s = fs.readFileSync(file, 'utf8');
  test(file + ': a guest role asks for the host reply budget', async () => {
    const guest = { id: 'g1', name: '林晓宇' }, seen = [];
    const ctx = {
      S: { settings: { chat: { offlineMaxTokens: 4096 } } },
      modelOutputUnfiltered: () => false,
      theaterActorPrompt: () => ({ actor: guest, name: '林晓宇', messages: [{ role: 'user', content: 'hi' }] }),
      cohabData: () => ({}), theaterState: () => ({ supportBubbleLimit: 2, extra: null }),
      getC: () => guest, roleChatRouteIndex: () => null, chatRequestRoute: () => null, chatMainCopy: x => x,
      offlineForegroundRequest: work => work(),
      chatAPI: async (messages, opt) => { seen.push(opt.max); return '{"bubbles":[{"type":"say","text":"你好"}]}'; },
      theaterParseActor: () => ({ bubbles: [{ type: 'say', text: '你好' }], leave: false }),
      theaterFixBubbles: b => b, theaterGuestKind: () => true, theaterGuestEntry: () => ({ contactId: 'g1', episodeId: 'e1' }), uid: () => 'u',
    };
    vm.createContext(ctx);
    vm.runInContext(fn(app, 'offlineReplyBudget') + '\n' + fn(s, 'cohabTheaterActorItems', true), ctx);
    await ctx.cohabTheaterActorItems('host', 'guest', '你好', 80, []);
    assert.equal(seen[0], 4096, 'same budget the host gets from the route setting');
    ctx.S.settings.chat = {};
    await ctx.cohabTheaterActorItems('host', 'guest', '你好', 80, []);
    assert(seen[1] >= 600, 'without a setting a guest still gets at least the host default, not 240');
  });
}
