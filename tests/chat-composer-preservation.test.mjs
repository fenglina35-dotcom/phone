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
assert.match(refresh, /if\(stick\)chatPinBottom\(cb\)/, 'a message-list refresh must keep a bottom-pinned conversation stable');

const pinBottom = functionSource('chatPinBottom');
const pinFrames = [];
const pinBox = {isConnected: true, scrollHeight: 900, clientHeight: 600, scrollTop: 0};
const pinContext = vm.createContext({Math, requestAnimationFrame: fn => pinFrames.push(fn)});
vm.runInContext(`${pinBottom}\nchatPinBottom(box)`, Object.assign(pinContext, {box: pinBox}));
assert.equal(pinBox.scrollTop, 300, 'the reply must pin to the final layout synchronously instead of first scrolling toward a stale height');
pinBox.scrollHeight = 930;
pinFrames.shift()();
assert.equal(pinBox.scrollTop, 330, 'the next paint may correct late layout growth without an animated bounce');
assert.doesNotMatch(pinBottom, /scrollTo\(|smooth/, 'iOS WebView must not animate while the typing bubble is being replaced');

const appendChat = functionSource('appendChatHTML');
assert.match(appendChat, /typing\.remove\(\)[\s\S]*if\(stick\)chatPinBottom\(cb\)/, 'the typing bubble must be replaced before the final bottom position is applied');
assert.doesNotMatch(appendChat, /behavior:\s*['"]smooth['"]/, 'role replies must not start a competing smooth scroll');

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
assert.match(html,/html\.north-native-app \.phone:has\(\.chat-inputbar\),html\.north-native-app \.phone:has\(\.offinput\),html\.north-ios-home-safe \.phone:has\(\.chat-inputbar\),html\.north-ios-home-safe \.phone:has\(\.offinput\)\{position:absolute\}/,'Apple WeChat and offline-date composers must remove the fixed ancestor that desynchronizes the iOS 26 caret');
assert.doesNotMatch(html,/html[^\n]*Android[^\n]*\.phone:has\(\.chat-inputbar\)/i,'the iOS caret workaround must not alter Android geometry');

assert.match(source, /\[点外卖\\\|[\s\S]*?refreshChatMessages\(id\);continue;/, 'special role cards must use the safe message-only refresh');
assert.match(source, /\[表情\\\|[\s\S]*?refreshChatMessages\(id\);/, 'role stickers must use the safe message-only refresh');

console.log('chat composer preservation tests passed');


// CHAT_SEND_KEEP_HISTORY_V1: exercise real sendText, DOM and scheduleReply on both entrypoints.
const {default: test} = await import('node:test');
test('sending preserves old message nodes in manual, busy and automatic chat flows', async () => {
  const {createRequire} = await import('node:module');
  const require = createRequire(import.meta.url);
  const {chromium} = require('playwright');
  const path = require('node:path');
  const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    for (const privateApp of [false,true]) {
      const page = await browser.newPage({viewport:{width:390,height:844}});
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      if(privateApp) await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false})};});
      await page.route('**/*', route=>{
        const u=new URL(route.request().url());
        if(u.origin!=='http://127.0.0.1:8778') return route.abort();
        const f=path.resolve(decodeURIComponent(u.pathname.slice(1)));
        const ok=f.startsWith(process.cwd()+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile();
        return route.fulfill({status:ok?200:404,body:ok?fs.readFileSync(f):'',contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});
      });
      await page.goto('http://127.0.0.1:8778/'+(privateApp?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'小手机.html')+'?northPreview=black-home');
      await page.waitForFunction(()=>window.__northBootReady);
      for(const mode of ['manual','busy','automatic']) {
        const result=await page.evaluate(mode=>{
          S.me.locked=false;S.settings.sound=false;S.settings.manualReply=mode!=='automatic';
          S.settings.manualReplyScenes={wechat:mode!=='automatic'};S.settings.replyDelay=60;
          const c=S.contacts[0];c.blocked=false;c.proactive={enabled:false};
          S.couple=Object.assign(S.couple||{},{cid:c.id});
          c.wechatBusy={modeVersion:2,enabled:true,active:mode==='busy',status:'busy',sessionId:'fixture',accountId:actId(),startedAt:Date.now()-1000,until:Date.now()+600000,pendingMessageIds:[]};
          const rows=msgs(c.id);rows.splice(0,rows.length,...Array.from({length:200},(_,i)=>({id:'history-'+i,role:i%2?'user':'assistant',type:'text',content:'历史消息 '+i,time:Date.now()-600000+i*1000})));
          stack=[{p:'home'},{p:'chat',id:c.id}];render();
          const box=document.getElementById('chatbg'),input=document.getElementById('cinput');
          const oldRows=Array.from(box.querySelectorAll('[data-message-id]'));
          S.settings.quoteOn=true;_quoting={id:c.id,text:'引用旧消息',who:'ta'};quoteComposerRefresh(c.id);
          const before=rows.length;input.value='这是一条新消息';sendText(c.id);
          const key=replyStateKey(c.id,actId()),queued=!!_replyTimers[key];clearTimeout(_replyTimers[key]);delete _replyTimers[key];
          return {quoteGone:!document.getElementById('chatQuotePending'),quoteStored:rows[rows.length-1].quote&&rows[rows.length-1].quote.text==='引用旧消息',boxKept:box===document.getElementById('chatbg'),inputKept:input===document.getElementById('cinput'),oldKept:oldRows.length>0&&oldRows.every(n=>n.isConnected&&box.contains(n)),count:rows.length-before,newVisible:document.getElementById('chatbg').textContent.includes('这是一条新消息'),queued,busyPending:c.wechatBusy.pendingMessageIds.length,manual:manualReplySceneOn('wechat')};
        },mode);
        assert.equal(result.boxKept,true,`${privateApp}/${mode}: the message container was replaced`);
        assert.equal(result.inputKept,true,`${privateApp}/${mode}: the input was replaced`);
        assert.equal(result.oldKept,true,`${privateApp}/${mode}: historical messages were removed`);
        assert.equal(result.count,1);assert.equal(result.newVisible,true);
        assert.equal(result.quoteGone,true);assert.equal(result.quoteStored,true);
        assert.equal(result.queued,mode==='automatic');
        if(mode==='busy')assert.equal(result.busyPending,1);
      }
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally {await browser.close();}
});
