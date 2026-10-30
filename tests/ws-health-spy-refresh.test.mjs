import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// WS_HEALTH_LAST_V1 (2026-10-30, her report, private only): the 窗台 tea mug always said 「健康数据还没同步过来」. It read
// companionRoleDataState(), which only has data while a role is inspecting her phone. It now falls back to the stored
// companion health (which keeps the last heart rate) and shows when the heart rate was measured.
// SPY_REFRESH_COMPLETE_V1 (2026-10-30, her web screenshot): 查他手机 refresh kept failing with 「模型没有按格式写完」. The long
// JSON was cut at the output limit and this request did not ask for the automatic continuation.
const PB = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
test('private 窗台 mug reads the stored health when no role is inspecting', () => {
  const s = fs.readFileSync(PB + 'private-couple-windowsill.js', 'utf8');
  const i = s.indexOf('cards.mug'), block = s.slice(s.lastIndexOf('var st', i), s.indexOf('\n', i));
  assert(/companionRoleDataState\(\)\) \|\| \(S\.couple && typeof companionState === 'function' \? companionState\(\) : null\)/.test(block), 'falls back to companionState');
  assert(/heartRateAt/.test(block) && /心率测于/.test(block), 'shows when the heart rate was measured');
});
for (const file of ['app.js', PB + 'app.js']) {
  test(file + ': 查他手机 refresh asks to finish a cut-off answer', () => {
    const s = fs.readFileSync(file, 'utf8');
    // SPY_PARSE_LENIENT_V1（2026-10-30）把请求拆成 _spyMsgs + spyContinueJson，自动续写 complete:true 仍保留。
    assert(s.includes("_spyMsgs=[{role:'system',content:_sys},...hist,{role:'user',content:prompt}]"));
    assert(s.includes("let content=await chatAPI(_spyMsgs,{max:4000,complete:true,aux:_spyAuxOn})"));
  });
}
