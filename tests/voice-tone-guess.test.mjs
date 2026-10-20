/* VOICE_TONE_GUESS_V1 + CALL_DESKPET_TAG_V1（2026-10-20 她的通话截图）：
   ①通话里「[语气变低] You owe me…」方括号露在台词里，也没念出那种语气——列表外的语气提示以前不认；
   ②「[桌宠|开心]」在通话里被当成台词显示——通话没有像聊天那样处理桌宠指令。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function sandbox(settings = {}, kind = 'fish') {
  const ctx = vm.createContext({S: {settings, me: {name: '用户'}}, Math, Date, String, Array, Promise, Map, Set, RegExp, Object, setTimeout,
    ttsStyleKind: () => kind, ttsCfg: () => ({}), ttsCleanBase: t => String(t || ''), ttsCueKind: () => ''});
  vm.runInContext(read('voice-expressive.js'), ctx); return ctx.NorthVoiceExpressive;
}

test('tone hints outside the list are not shown in call lines', () => {
  const V = sandbox({});
  assert.equal(V.stripTags('[语气变低] You owe me twenty-six episodes worth of kisses.'), 'You owe me twenty-six episodes worth of kisses.');
  assert.equal(V.stripTags('[声音放轻]别动'), '别动');
  assert.equal(V.stripTags('【压低声音靠近你】'), '【压低声音靠近你】', 'video action lines in 【】 stay');
  assert.equal(V.stripTags('[冷冷地]说吧'), '说吧');
  assert.equal(V.stripTags('[挂断] 好'), '[挂断] 好', 'brackets that are not about the voice stay');
  assert.equal(V.stripTags('[桌宠|开心]'), '[桌宠|开心]', 'commands are left to their own handlers');
});

test('tone hints outside the list become the nearest gentle cue, so the voice carries them', () => {
  const V = sandbox({voiceExpressive: true});
  const low = V.performance('[语气变低]你欠我二十六集的亲亲', {id: 'r1'}, {}, {});
  assert.ok(low && low.includes('[soft voice]') && !low.includes('语气变低'), low);
  const cold = V.performance('[冷冷地]说吧', {id: 'r2'}, {}, {});
  assert.ok(cold && !cold.includes('冷冷地'), cold);
  const sp = V.split('[语气变低]想你');
  assert.ok(sp && sp.perf.includes('[小声]') && sp.text === '想你', JSON.stringify(sp));
  assert.equal(V.split('[挂断]好'), null, 'no cue, nothing to split');
});

test('both bundles carry the same voice file and calls handle the desk pet command', () => {
  assert.equal(read('voice-expressive.js'), read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/voice-expressive.js'));
  for (const p of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
    const s = read(p);
    assert.match(s, /\/\* CALL_DESKPET_TAG_V1[^*]*\*\/content=typeof deskPetConsume==='function'\?deskPetConsume\(content,c\):content;content=callStripForeignActions\(content\);/, p);
    assert.match(s, /NorthVoiceExpressive\.stripTags\(m\.content\)!==m\.content/, p);
  }
});
