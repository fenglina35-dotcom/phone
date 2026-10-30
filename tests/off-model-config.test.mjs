import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// OFF_MODEL_CONFIG_V1 (2026-10-30, her request): 单次约会 gets the same model and route settings and 模型与路线诊断 as 共同生活.
// Before, the web version always used the role route's main model, and the private version sent no route at all, so it
// used the global current route even when the role had its own route ("我换的别的路线，他走的却是另一个").
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const ctx = { roleChatRouteIndex: c => c.chatRouteIndex ?? 0, chatRoutesInit: () => [1, 2, 3, 4] };
  vm.createContext(ctx);
  vm.runInContext(['offReplySettings', 'offReplyAux', 'offReplyRouteIndex'].map(n => fn(s, n)).join('\n'), ctx);
  const role = { id: 'r1', model: 'aux', chatRouteIndex: 3 };
  test(file + ': untouched settings keep the old rule, main model on the role route', () => {
    const o = {};
    assert.equal(ctx.offReplyAux(role, o), false); assert.equal(ctx.offReplyRouteIndex(role, o), 3);
  });
  test(file + ': a chosen model and route are used', () => {
    const o = { settings: { replyModel: 'aux', replyApiRoute: '1' } };
    assert.equal(ctx.offReplyAux(role, o), true); assert.equal(ctx.offReplyRouteIndex(role, o), 1);
    assert.equal(ctx.offReplyAux(role, { settings: { replyModel: 'role' } }), true, 'follow the WeChat role (副模型)');
  });
  test(file + ': every 单次约会 request carries the route and is recorded', () => {
    const i = s.indexOf('async function offAI(note){'), j = s.indexOf('\nasync function ', i + 10), body = s.slice(i, j);
    assert(/offReplyRouteIndex\(c,o\)/.test(body), 'route from the settings');
    assert(/aux:offReplyAux\(c,o\)/.test(body), 'main reply model from the settings');
    assert(/cohabDiagnostic:\{hostId:'off:'\+c\.id/.test(body), 'recorded for the diagnostic');
    assert(s.includes("offSettingSet('${id}','replyApiRoute',this.value)") && s.includes("offModelDiagnosticShow('${id}')"), 'settings and diagnostic in 约会设定');
  });
}
for (const file of ['cohab-model-diagnostics.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/cohab-model-diagnostics.js'])
  test(file + ': 单次约会 has its own 模型与路线诊断', () => { const s = fs.readFileSync(file, 'utf8'); assert(s.includes("window.offModelDiagnosticOpen=function(id)") && s.includes("records.get(scope('off:'+id))")); });

// OFF_MODAL_GLASS_V1 (2026-10-30, her request): boxes opened inside 单次约会 use the same glass frame as 共同生活.
for (const file of ['cohab-theater.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/cohab-theater.js']) {
  test(file + ': boxes opened in 单次约会 get the 共同生活 frame', () => {
    const s = fs.readFileSync(file, 'utf8');
    const ctx = { _off: { id: 'r1' }, cur: () => ({ p: 'off' }), getC: () => ({ id: 'r1' }), offTheme: () => ({ skin: 'glass' }) };
    vm.createContext(ctx); vm.runInContext(fn(s, 'cohabGlassSkin'), ctx);
    assert.equal(ctx.cohabGlassSkin(), true, '单次约会 (no mode) now counts');
    ctx._off.mode = 'cohab'; assert.equal(ctx.cohabGlassSkin(), true, '共同生活 as before');
    ctx.cur = () => ({ p: 'chat' }); assert.equal(ctx.cohabGlassSkin(), false, 'not outside the date pages');
    ctx.cur = () => ({ p: 'off' }); ctx.offTheme = () => ({ skin: 'classic' }); assert.equal(ctx.cohabGlassSkin(), false, 'classic skin unchanged');
  });
}
