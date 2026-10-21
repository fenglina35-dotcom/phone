import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

// COUPLE_REDESIGN_V1 (2026-10-21, her own design): the couple space is three card home pages. Every old block
// must still be reachable on its own page, and old deep links (coupleJump, the companion entry) still land on it.
const PRIVATE = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const OLD_BLOCKS = ['cou_tasks', 'cou_goals', 'cou_anniv', 'cou_sleep', 'cou_report', 'cou_behavior', 'cou_album', 'cou_grant', 'cou_gag_auth',
  'cou_wallet', 'cou_limit', 'cou_star', 'cou_jail', 'cou_outpass', 'cou_wxlogin', 'cou_remote'];
const PICTURES = ['sweet-anniversary.jpg', 'sweet-sleep.jpg', 'sweet-report.jpg', 'rules-hero.jpg', 'perm-chat.jpg', 'perm-wallet.jpg',
  'device-hero.jpg', 'device-health.jpg', 'device-map.jpg', 'header-cats.png'];

for (const file of ['app.js', PRIVATE + 'app.js']) {
  test(file + ': every old couple-space block is still rendered on a card page', () => {
    const s = fs.readFileSync(file, 'utf8');
    const start = s.indexOf('function renderCouple(){'), body = s.slice(start, s.indexOf('\nfunction ', start + 10));
    assert(s.includes('COUPLE_REDESIGN_V1'));
    for (const id of OLD_BLOCKS) assert(body.includes('id="' + id + '"'), id + ' kept');
    assert(body.includes('id="cou_locks"'), 'the list of what ta locked (with its unlock time) is still shown');
    assert(body.includes("${coupleDash2(cp,c,locksHTML)}"), 'and it sits on the 管控授权 home page');
    assert(body.includes('renderCompanionPage(c,SEC,HD)'), 'the whole companion page is one tap away');
    const subs = s.slice(s.indexOf('const COUPLE_SUBS={'), s.indexOf('const COUPLE_ID_SUB={'));
    for (const id of OLD_BLOCKS.filter(x => x !== 'cou_gag_auth')) assert(subs.includes("'" + id + "'"), id + ' has a page');   // 禁言 is inside the 授权 block (cou_grant)
    for (const id of ['cou_album', 'cou_grant', 'cou_locks', 'cou_wallet', 'cou_limit', 'cou_jail', 'cou_remote', 'cou_goals', 'cou_sleep'])
      assert(new RegExp(id + ":'[a-z0-9]+'").test(s.slice(s.indexOf('const COUPLE_ID_SUB={'), s.indexOf('function coupleOpen('))), id + ' deep link');
    assert(s.includes("if(COUPLE_ID_SUB[id]){coupleOpen(COUPLE_ID_SUB[id],id);return;}"), 'coupleJump opens the right page');
    assert(s.includes("if(companionEntryUnlocked()){if(target){coupleOpen('device',target);return;}couTab(3);return;}"), 'companion deep links too');
    assert(s.includes("if(target){coupleOpen('device',target);return;}couTab(3);}"), 'and after the entry password');
    assert(s.includes("if(n===3){const p3=$('#coupage3');if(p3&&!p3.innerHTML.trim()&&typeof coupleDash3==='function')p3.innerHTML=coupleDash3();}"), 'the companion home fills in when its tab opens');
    assert(s.includes("const BG='background:#000';"), 'pure black, as she chose');
    assert(s.includes('#coupage1:not(.cs-sub-screen)>#cou_shortcut_screen_time,#coupage1:not(.cs-sub-screen)>#cou_screen_cloud{display:none}'), 'screen-time import lives on its own page');
  });
}

test('the windowsill entry rows go into the slot at the bottom of 甜蜜日常', () => {
  for (const f of ['couple-windowsill.js', PRIVATE + 'private-couple-windowsill.js']) {
    const s = fs.readFileSync(f, 'utf8');
    assert(s.includes("return html.replace('<div id=\"cou_extra_slot\"></div>', '<div id=\"cou_extra_slot\">' + bar + '</div>');"), f);
    assert(s.includes("(typeof COUPLE_CSS === 'string' ? COUPLE_CSS : '') + '<div class=\"cs-sub\">'"), f + ': the 窗台画面 page wears the same theme');
  }
});

test('the redesign pictures ship in both bundles, identical, and git keeps the private copy', () => {
  for (const name of PICTURES) {
    const a = fs.readFileSync('assets/couple-space/' + name), b = fs.readFileSync(PRIVATE + 'assets/couple-space/' + name);
    assert(a.length > 1000 && a.length < 220 * 1024, name + ' size');
    assert.equal(createHash('sha256').update(a).digest('hex'), createHash('sha256').update(b).digest('hex'), name);
  }
  const ignore = fs.readFileSync('native/private-small-phone/.gitignore', 'utf8');
  assert(ignore.includes('!XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/assets/couple-space/**'));
});
