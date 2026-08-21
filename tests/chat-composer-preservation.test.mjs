import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

let input = {
  value: '我正在写但还没发',
  selectionStart: 4,
  selectionEnd: 7,
  scrollTop: 9,
  style: {height: '54px'},
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
  focus() { document.activeElement = this; this.focused = true; },
};
const document = {activeElement: input};
const context = vm.createContext({
  document,
  $: selector => selector === '#cinput' ? input : null,
  renderPageKey: route => route.p === 'chat' ? `chat:${route.id}` : route.p,
});
vm.runInContext(`${functionSource('captureChatComposer')}\n${functionSource('restoreChatComposer')}`, context);

const route = {p: 'chat', id: 'role-1'};
const saved = context.captureChatComposer(route);
input = {
  value: '', selectionStart: 0, selectionEnd: 0, scrollTop: 0, style: {},
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
  focus() { document.activeElement = this; this.focused = true; },
};
context.restoreChatComposer(route, saved);
assert.equal(input.value, '我正在写但还没发', 'a full repaint must restore the unsent draft');
assert.equal(input.selectionStart, 4, 'selection start must survive a repaint');
assert.equal(input.selectionEnd, 7, 'selection end must survive a repaint');
assert.equal(input.style.height, '54px', 'composer height must survive a repaint');
assert.equal(input.scrollTop, 9, 'composer scroll offset must survive a repaint');
assert.equal(input.focused, true, 'focused composer must regain focus after a fallback repaint');

const render = functionSource('render');
assert.ok(render.indexOf('captureChatComposer(c)') < render.indexOf('app.innerHTML='), 'composer state must be captured before replacing the page');
assert.ok(render.indexOf('restoreChatComposer(c,_composerState)') > render.indexOf('app.innerHTML='), 'composer state must be restored after replacing the page');

const refresh = functionSource('refreshChatMessages');
assert.match(refresh, /cb\.innerHTML=chatMessageListHTML\(id,c\)/, 'incoming messages must repaint only the message list');
assert.doesNotMatch(refresh, /app\.innerHTML|render\(\)/, 'incoming message refresh must never replace the composer');

const serverPull = functionSource('roleServerPushPull');
assert.match(serverPull, /if\(cur\(\)\.p==='chat'\)refreshChatMessages\(cur\(\)\.id\)/, 'server push pull must preserve the open composer');

const replyRefresh = functionSource('replyGenerationRefresh');
assert.match(replyRefresh, /document\.querySelector\('\.manual-reply-chip'\)/, 'reply state must update its chip in place');
assert.doesNotMatch(replyRefresh, /render\(\)/, 'reply completion must not repaint and clear a draft');

const afterChat = functionSource('afterChat');
const reflow = functionSource('chatComposerReflow');
assert.match(afterChat, /compositionend[\s\S]*chatComposerReflow\(this\)/,'textarea height must settle after Chinese composition finishes');
assert.match(afterChat, /addEventListener\('input'[\s\S]*chatComposerReflow\(this\)/,'typing must resize only the textarea');
assert.match(reflow, /style\.overflowY=full>max\?'auto':'hidden'/,'a one-line caret must remain clipped to the textarea instead of leaking below it');
assert.doesNotMatch(reflow, /setSelectionRange|getBoundingClientRect|visualViewport/,'textarea resizing must not force WebKit to repaint the caret from stale keyboard geometry');
assert.doesNotMatch(source, /function chatComposerViewportBind|_northChatCaretBound/,'keyboard viewport movement must remain owned by iOS and WKWebView');
assert.match(source,/class="inputbar chat-inputbar\$\{_voiceMode/,'the normal WeChat composer has a shared web/native layout hook');
const panelOpen = functionSource('chatPanelOpen');
const panelToggle = functionSource('chatPanelToggle');
assert.doesNotMatch(panelOpen, /render\(\)/, 'opening the emoji or function panel must not repaint the page');
assert.doesNotMatch(panelToggle, /render\(\)/, 'closing or switching the panel must not repaint the page');
assert.match(source, /chatComposerStateSync\(ta\)/, 'composer send state must update in place');
assert.match(html,/\.chat-inputbar\{position:static;top:auto;gap:2px;padding:7px 2px 13px;\}/,'the composer moves up through reserved layout space and cannot cover the manual-reply row');
assert.match(html,/\.chat-inputbar \.plus\{width:30px;\}/,'only the chat side controls use a narrower footprint');
assert.match(html,/\.chat-inputbar \.send\{padding-left:10px;padding-right:10px;\}/,'the send button remains in place while yielding visible width to the textarea');
assert.match(html,/\.chat-inputbar textarea\{padding-top:6px;padding-bottom:10px;line-height:20px;\}/,'the caret keeps more room below its line without changing the proven 36px box');
assert.match(html,/\.manual-reply-row\{display:flex;justify-content:flex-end;padding:5px 10px 0;background:#0b0b0c;\}/,'the manual reply button keeps its established position');
assert.match(html,/html\.north-native-app \.phone:has\(\.chat-inputbar\),html\.north-ios-home-safe \.phone:has\(\.chat-inputbar\)\{position:absolute\}/,'Apple chat alone must remove the fixed ancestor that desynchronizes the iOS 26 caret');
assert.doesNotMatch(html,/html[^\n]*Android[^\n]*\.phone:has\(\.chat-inputbar\)/i,'the iOS caret workaround must not alter Android geometry');

assert.match(source, /\[点外卖\\\|[\s\S]*?refreshChatMessages\(id\);continue;/, 'special role cards must use the safe message-only refresh');
assert.match(source, /\[表情\\\|[\s\S]*?refreshChatMessages\(id\);/, 'role stickers must use the safe message-only refresh');

console.log('chat composer preservation tests passed');
