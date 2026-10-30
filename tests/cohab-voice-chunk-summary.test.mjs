import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// COHAB_VOICE_CHUNK_SUMMARY_V1 (2026-10-30, her report and her phone data): after a 共同生活 voice session WeChat did not
// remember what happened. Her 10-25 session had 1054 lines; at the end the whole session was sent in one request and kept as
// one memory of at most 320 characters (or none when that huge request failed), while text 共同生活 is summarised every few
// rounds. Long sessions are now summarised in parts of about 80 lines, each part kept as its own memory.
function fn(src, name) {
  const i = src.indexOf('async function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const rows = n => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', type: 'text', content: '第' + i + '句', time: i }));
for (const file of ['cohab-theater.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/cohab-theater.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const load = () => {
    const ctx = { S: { me: { name: 'North' } }, sent: [], kept: [] };
    ctx.spoken = r => r.filter(m => m && m.type !== 'sys' && String(m.content || '').trim());
    ctx.chatAPI = async (messages) => { ctx.sent.push(messages[1].content); return '我记得这段。[重要度:3]'; };
    ctx.rateAndText = t => ({ text: String(t).replace(/\[重要度:\d\]/, ''), imp: 3 });
    ctx.cleanReply = t => t; ctx.trimSentence = (t, n) => String(t).slice(0, n);
    ctx.addSummary = (c, text, imp, prefix) => { ctx.kept.push(prefix); return true; };
    vm.createContext(ctx); vm.runInContext(fn(s, 'summarize'), ctx); return ctx;
  };
  test(file + ': a long voice session is remembered in several parts', async () => {
    const ctx = load(); await ctx.summarize({ id: 'r1', name: '克劳德' }, rows(1054), 'main');
    assert(ctx.kept.length >= 12, 'about one memory per 80 lines, got ' + ctx.kept.length);
    assert(ctx.sent.every(t => t.split('\n').length <= 100), 'no single huge request');
    assert(ctx.sent.join('\n').includes('第1053句'), 'the end of the session is covered');
    assert(ctx.kept.every(p => /共同生活语音/.test(p)));
  });
  test(file + ': a short session is still one memory', async () => {
    const ctx = load(); await ctx.summarize({ id: 'r1', name: '克劳德' }, rows(30), 'main');
    assert.deepEqual(ctx.kept, ['【共同生活语音】']);
  });
}

// COHAB_VOICE_MODEL_V1 (2026-10-30, her 模型与路线诊断 screenshot): 共同生活 was set to 路线四 · 副模型 but the voice mode
// asked the main model. Voice mode now uses the 共同生活 reply model and route, like typed 共同生活.
function plain(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  test(file + ': 共同生活 voice follows the 共同生活 reply model and route', () => {
    const d = { settings: { replyModel: 'aux', replyApiRoute: '3' } };
    const ctx = { S: { settings: {} }, cohabData: () => d, roleChatRouteIndex: () => 0 };
    vm.createContext(ctx);
    vm.runInContext(['cohabSettings', 'cohabReplyAux', 'cohabReplyRouteIndex', 'cohabVoiceModelOpt'].map(n => plain(s, n)).join('\n'), ctx);
    const role = { id: 'r1', model: 'chat' };
    let o = ctx.cohabVoiceModelOpt(role);
    assert.equal(o.routeIndex, 3); assert.equal(o.aux, true);
    d.settings = { replyModel: 'role', replyApiRoute: 'follow' };
    o = ctx.cohabVoiceModelOpt(role);
    assert.equal(o.routeIndex, 0, 'follow keeps the role WeChat route as before'); assert.equal(o.aux, false);
    assert(s.includes("...(_call&&_call.cohab&&typeof cohabVoiceModelOpt==='function'?cohabVoiceModelOpt(c):{routeIndex:roleChatRouteIndex(c),aux:c.model==='aux'})"), 'callAI uses it only in 共同生活 voice');
  });
}
