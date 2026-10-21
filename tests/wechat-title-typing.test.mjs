import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// WX_TITLE_TYPING_V1 (2026-10-21, she asked, like the real WeChat): while the role is really writing a reply
// (exactly the time the old three-dot bubble #typing lived), the name at the top reads 「对方正在输入…」; when the
// reply lands or fails it is the name again. The reply flow is untouched: only how #typing is shown changed.
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  test(file + ': the title says 对方正在输入… while he is typing, and the dots are hidden', () => {
    const s = fs.readFileSync(file, 'utf8');
    assert(s.includes('WX_TITLE_TYPING_V1'));
    assert(s.includes('<b><span class="wx-title-name">${esc(c.remark||c.name)}</span><span class="wx-title-typing">对方正在输入…</span>${c.muted?\' 🔕\':\'\'}</b>'));
    assert(s.includes('.wx-title-typing{display:none}.page:has(#chatbg #typing) .wx-title-name{display:none}.page:has(#chatbg #typing) .wx-title-typing{display:inline}#chatbg #typing{display:none!important}'));
    assert(s.includes('typingEl=appendChatHTML(cb,`<div class="msg them" id="typing">'), 'the typing marker still comes and goes with the real reply');
  });
}
