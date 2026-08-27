import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

assert.match(app,/class="chat-quote-pending" id="chatQuotePending"/,'the active quote must render as a dedicated composer row');
assert.match(app,/class="chat-quote-cancel" aria-label="取消引用"/,'the active quote must always expose a cancel action');
assert.match(app,/class="chat-quote-cancel"[^>]*onpointerdown="event\.stopPropagation\(\)" onclick="quoteClear\(event\)"/,'the cancel action must receive the WKWebView event explicitly and isolate parent gestures');
assert.match(app,/function quoteClear\(ev\)\{if\(ev\)\{if\(ev\.preventDefault\)ev\.preventDefault\(\);if\(ev\.stopPropagation\)ev\.stopPropagation\(\);\}/,'the cancel handler must clear safely even when an event object is not implicit');
assert.match(css,/\.wx-chat-premium>\.chat-quote-pending\{order:1;/,'the active quote must sit below the order-zero input bar and above the order-two tool panel');
assert.match(css,/\.wx-chat-premium:has\(>\.chat-quote-pending\)>\.manual-reply-row\{bottom:111px\}/,'the fixed manual-reply chip must move above the composer when a quote row is present');
assert.match(app,/function quoteComposerRefresh\(cid\)[\s\S]*?draft[\s\S]*?focus\(\{preventScroll:true\}\)/,'quoting and cancelling must preserve the draft and restore input focus');
assert.match(app,/return `<div class="bubble\$\{_bl\.cls\}"[\s\S]*?\$\{quoteBar\(c,m\)\}`;/,'a sent text quote must follow its message bubble');
assert.match(app,/m\.showText\?[\s\S]*?\$\{quoteBar\(c,m\)\}`;/,'a sent voice quote must follow the voice bubble and translation');
assert.match(css,/\.chat-quote-sent\{/,'sent quotes must use the dedicated card styling');
assert.match(css,/\.wxlight \.chat-quote-sent/,'sent quotes must have a light-theme treatment');
assert.match(css,/\.chat-quote-cancel\{[^}]*pointer-events:auto/,'the quote cancel target must stay interactive above the composer');
assert.match(css,/\.chat-quote-cancel span\{pointer-events:none/,'the glyph must not steal the button target');

console.log('wechat quote layout tests passed');
