// COHAB_SETTINGS_SCROLL_V1 (2026-11-04): the open 共同生活设置 panel (790px) is taller than a 700px phone screen and its
// stage is overflow:hidden, so 「模型与路线诊断」 at the bottom could not be reached by finger. The open panel now scrolls
// by itself, and a page refresh (e.g. his reply) keeps it open at the same scroll position instead of jumping back.
// Checked in a real page at 568/700/844px: reachable, kept after render and a new role line, no outer page scroll.
import assert from 'node:assert/strict';
import { read, BUNDLES, PRIV_DIR } from './_helpers.mjs';

for (const shell of ['小手机.html', PRIV_DIR + 'index.html', PRIV_DIR + '小手机.html']) {
  assert.match(read(shell), /\.cohab-settings-wrap:has\(>\.cohab-settings\[open\]\)\{flex:0 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain\}/,
    `${shell}: open settings scroll inside their own area`);
}
for (const [label, file] of BUNDLES) {
  const src = read(file);
  assert.match(src, /let _cohabSetOpen=false,_cohabSetScroll=0;/, `${label}: open state survives a re-render`);
  assert.match(src, /'<details class="cohab-settings"'\+\(_cohabSetOpen\?' open':''\)/, `${label}: re-render keeps the panel open`);
  assert.match(src, /<div class="cohab-settings-wrap" onscroll="_cohabSetScroll=this\.scrollTop">/, `${label}: scroll position is remembered`);
  assert.match(src, /if\(w&&_cohabSetOpen\)w\.scrollTop=keep;/, `${label}: scroll position is restored after re-render`);
}
console.log('cohab settings scroll tests passed');
