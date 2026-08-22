import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const glass=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

assert.match(app,/\['chat','pfchat','pfgroup','group'\]\.includes\(c\.p\)\?' wx-chat-premium'/,'chat and group routes have the scoped visual skin');
assert.match(app,/class="nav chat-glass-nav/,'chat title bar uses the frosted layer');
assert.match(app,/class="moodbar chat-glass-mood/,'role mood uses the frosted chip');
assert.doesNotMatch(app,/class="nav chat-glass-nav[^`]*耳/,'chat title has no ear ornament');

assert.match(app,/class="chat-function-viewport"[^>]*onscroll="chatFunctionPanelScroll\(this\)"/);
const rolePanel=app.match(/function chatFunctionPanel\(id\)[\s\S]*?function renderChat\(id\)/)?.[0]||'';
assert.equal((rolePanel.match(/class="chat-function-page"/g)||[]).length,2,'ordinary role function panel keeps exactly two swipe pages');
assert.match(glass,/scroll-snap-type:x mandatory/,'two function pages use native horizontal snapping');
assert.match(glass,/touch-action:pan-x/,'horizontal panel gestures do not hijack vertical chat scrolling');
assert.match(app,/chatPanelToggle\('emoji'\)/,'smile opens the emoji page');
assert.match(app,/chatPanelToggle\('fn'\)/,'plus opens the function page');
assert.match(app,/function groupComposerHTML\(scope,id,inputId,placeholder,sendAction,panelId\)[\s\S]*chat-voice-toggle[\s\S]*chat-emoji-toggle[\s\S]*chat-function-toggle/,'all group composers reuse the role chat voice, emoji, and plus icon set');
assert.match(app,/groupComposerHTML\('pfgroup',gid,'pfg_input'/,'real small-phone groups use the shared composer');
assert.match(app,/groupComposerHTML\('group',id,'ginput'/,'role groups use the shared composer');
assert.match(app,/if\(c\.p==='group'\|\|c\.p==='pfgroup'\)afterGroupComposer\(c\)/,'group composers bind text input and enter-to-send after rendering');
assert.match(app,/chatFunctionItem\('多选转发'/,'only existing small-phone actions are exposed');
assert.match(glass,/\.chat-function-page\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,'both function pages share the same evenly spread four-column layout');
assert.doesNotMatch(glass,/\.chat-function-page:nth-child\(2\)/,'the second function page is not compressed into a separate narrow group');

assert.match(glass,/\.wx-chat-premium>\.chat-inputbar[\s\S]*backdrop-filter:blur\(30px\)/,'composer has a limited frosted layer');
assert.match(glass,/\.wx-chat-premium>\.chat-glass-nav[\s\S]*backdrop-filter:blur\(34px\)/,'top bar has a blurred glass layer');
assert.doesNotMatch(glass,/\.wx-chat-premium[^\n]*\.bubble[^\n]*backdrop-filter/,'chat bubbles are not individually blurred');
assert.match(glass,/\.wx-chat-premium\.wxlight/,'chat glass has a light mode');
assert.match(glass,/\.wx-chat-premium\.wxlight>\.chat-inputbar/,'composer has a light-mode glass layer');
assert.match(glass,/font-size:16px/,'composer keeps the proven 16px text size');
assert.match(glass,/font-family:inherit/,'composer keeps the existing small-phone font');
assert.match(app,/chatVoiceButtonIcon\(\)[^\n]*viewBox="0 0 28 28"[^\n]*r="12\.9"/,'voice control uses the shared 28px visible circle');
assert.match(app,/class="chat-voice-seed"[^>]*d="M7\.5 14l3\.4-3v6z"/,'voice symbol starts with a centered compact speaker seed');
assert.match(app,/M11\.8 11\.1c2 1\.5 2 4\.3 0 5\.8M14\.7 9\.2c3\.5 2\.6 3\.5 7 0 9\.6M17\.4 7\.3c5 3\.8 5 9\.6 0 13\.4/,'voice waves use a newly balanced concentric geometry');
assert.match(app,/chatEmojiButtonIcon\(\)[^\n]*viewBox="0 0 28 28"[^\n]*r="12\.9"/,'smile control uses the shared 28px visible circle');
assert.match(glass,/\.chat-voice-svg,\.chat-emoji-svg\{width:28px;height:28px;[^}]*stroke-width:1\.8/,'voice and smile use the plus control size and line weight');
assert.match(glass,/\.chat-voice-seed\{fill:currentColor;stroke:none\}/,'voice seed matches the reference filled center mark');
assert.match(app,/class="chat-emoji-eye" cx="10\.2" cy="11\.5" r="1\.25"/,'smile eyes are slightly enlarged');
assert.match(app,/class="chat-emoji-mouth" d="M9\.2 16\.5h9\.6c0 3\.8-1\.9 5\.8-4\.8 5\.8s-4\.8-2-4\.8-5\.8z"/,'smile uses the reference flat upper mouth line with a rounded open lower edge');
assert.match(glass,/\.chat-function-toggle>span\{position:relative;width:28px;height:28px;[^}]*border:1\.8px solid currentColor/,'plus control uses the smile control diameter and visual weight');
assert.match(glass,/\.chat-function-toggle>span::before,\.chat-function-toggle>span::after\{[^}]*top:calc\(50% \+ \.75px\)/,'the chat composer plus cross is optically lowered inside its circle');
assert.match(glass,/\.wx-chat-premium \.chatbg \.msgt\{display:none!important\}/,'per-message clock labels are hidden only by presentation');
assert.match(app,/const ts=m\.time\?`<div class="msgt">\$\{hm\(m\.time\)\}<\/div>`:''/,'message timestamps remain in the data/render path for compatibility');
assert.match(glass,/\.wx-chat-premium \.chatbg \.tstamp span\{[^}]*background:transparent!important;[^}]*box-shadow:none!important/,'center date and time text remains without a dark badge');

assert.match(app,/class="off-nav-actions">\$\{replyTop\}/,'offline reply action lives in the upper-right navigation area');
assert.match(app,/class="off-reply-top"/);
assert.doesNotMatch(app,/class="offactions"/,'the easy-to-mistap full-width reply strip is removed');
assert.match(html,/\.off-reply-top\{height:27px/,'upper-right reply action stays compact');

assert.match(glass,/\.wx-premium>\.wx-main-nav \.wx-main-title\{[^}]*font-size:18px/,'WeChat main title is reduced one visual step');
assert.match(glass,/\.wx-main-nav \.wx-main-add\{display:grid;place-items:center;line-height:0\}/,'the WeChat header plus is centered inside its tap target');
assert.match(app,/<line x1="17" y1="9\.5" x2="17" y2="24\.5"\/><line x1="9\.5" y1="17" x2="24\.5" y2="17"\/>/,'the WeChat header plus remains geometrically centered');
assert.match(glass,/\.wx-chats \.wx-chat-list \.avatar\{width:44px;height:44px/,'chat-list avatars are reduced proportionally');
assert.match(glass,/\.wx-chats \.wx-chat-list \.meta \.n\{[^}]*font-size:15px/,'chat-list names are reduced proportionally');
assert.match(glass,/\.wx-tab-icon\{width:28px;height:28px/,'bottom navigation icons are reduced proportionally');

console.log('wechat chat frosted UI tests passed');
