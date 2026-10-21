import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// COHAB_MSG_EDIT_V1 (2026-10-21, she asked for it back): tapping a line in 共同生活 opens 编辑 / 删除 again
// (edit the text, delete just that line). On 10-18 she had asked to drop it; the multi-select delete under ＋ stays.
for (const dir of ['', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/']) {
  test((dir || 'web ') + 'cohab-theater.js no longer swallows the tap on a 共同生活 line', () => {
    const s = fs.readFileSync(dir + 'cohab-theater.js', 'utf8');
    assert(s.includes('COHAB_MSG_EDIT_V1'));
    assert(!/offMsgMenu=function\(id,mid\)\{if\(typeof _off!=='undefined'&&_off&&_off\.mode==='cohab'\)return;/.test(s), 'the old block is gone');
    assert(s.includes('function multi(){closeTray();'), 'multi-select delete under ＋ is still there');
    assert(s.includes("m.classList.toggle('cohab-glass-modal',want)"), 'pop-ups inside 共同生活 keep the liquid-glass skin');
    const app = fs.readFileSync(dir + 'app.js', 'utf8');
    assert(app.includes(`onclick="offDelMsg('\${id}','\${mid}')">删除</button><button class="btn p" onclick="offEditMsg('\${id}','\${mid}')">保存</button>`), 'the menu edits and deletes one line');
  });
}
