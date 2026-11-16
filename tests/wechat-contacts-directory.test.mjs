import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { read, BUNDLES, ROOT } from './_helpers.mjs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const glass=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==='\\')escaped=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const contacts=functionSource('wxContacts');
assert.match(contacts,/新的朋友/);
assert.match(contacts,/仅聊天的朋友/);
assert.match(contacts,/群聊/);
assert.match(contacts,/标签/);
assert.match(contacts,/小手机好友/);
assert.doesNotMatch(contacts,/公众号|服务号|企业微信联系人/);

assert.match(functionSource('renderWxGroupCreate'),/选择一个已有的群/);
assert.match(functionSource('renderWxGroupCreate'),/面对面建群/);
assert.match(functionSource('renderWxGroupCreate'),/选择群聊中的朋友/);
assert.doesNotMatch(functionSource('renderWxGroupCreate'),/企业微信/);

assert.match(functionSource('wxQuickMenuHTML'),/发起群聊/);
assert.match(functionSource('wxQuickMenuHTML'),/添加朋友/);
assert.match(functionSource('wxQuickMenuHTML'),/go\('wxscan'\)[\s\S]*扫一扫/);
assert.doesNotMatch(functionSource('wxQuickMenuHTML'),/收付款/);
assert.match(functionSource('toggleWxQuickMenu'),/_wxQuickOpen/);

assert.match(app,/else if\(c\.p==='wxonlychat'\)html=renderWxOnlyChat\(\)/);
assert.match(app,/else if\(c\.p==='wxlabels'\)html=renderWxLabels\(\)/);
assert.match(app,/else if\(c\.p==='wxgroupcreate'\)html=renderWxGroupCreate\(\)/);
assert.match(app,/else if\(c\.p==='contactEdit'\)html=renderContactEditor\(c\.id,c\.isNew\)/);
assert.match(functionSource('editContactAutonomy'),/go\('contactEdit'/);
assert.match(functionSource('ctListHTML'),/pfAvatarOnlineHTML\(x\.f,'sm'\)[\s\S]*wx-contact-name/);
assert.doesNotMatch(contacts,/wx-contact-sticky-search|wxAlphabetRail/);
assert.match(functionSource('renderWeChat'),/wxTab==='contacts'\?wxContactSearchHTML\(\):''[\s\S]*wx-main-scroll[\s\S]*wxTab==='contacts'\?wxAlphabetRail\(\):''/);

assert.match(glass,/\.wx-contacts>\.wx-contact-sticky-search\{[^}]*position:relative/);
assert.match(glass,/\.wx-contacts>\.wx-alpha-rail\{[^}]*position:absolute;[^}]*top:106px;bottom:76px/);
assert.match(glass,/\.wx-contacts>\.wx-contact-sticky-search input\{[^}]*width:2em;flex:0 0 2em;text-align:left/);
assert.match(glass,/\.wx-contacts>\.wx-contact-sticky-search label:focus-within input\{[^}]*flex:1/);
assert.match(glass,/\.wx-contact-letter>h4\{[^}]*position:sticky;top:0/);
assert.match(glass,/\.wx-contact-person>\.pfavwrap\{[^}]*flex:0 0 40px/);
assert.match(glass,/\.wx-directory-head\{[^}]*backdrop-filter:blur/);
assert.match(glass,/\.wx-chat-premium>\.manual-reply-row,[^{]+\{[^}]*background:transparent!important/);
assert.match(glass,/\.wx-chat-premium>\.chat-glass-mood\{[^}]*width:calc\(100% - 24px\)[^}]*flex:0 0 auto/);

assert.match(app,/_wxLightDirectory=\[[^\]]*'pffriends'/,'小手机好友页必须进入微信白色主题目录');
assert.match(functionSource('renderPhoneFriends'),/class="scroll pf-friends-page"/);
assert.match(functionSource('renderPhoneFriends'),/class="pf-friends-search"/);
assert.match(functionSource('renderPhoneFriends'),/svgIc\('refresh',20,'currentColor'\)/);
assert.match(glass,/\.wxlight \.pf-friends-page\{background:#ededed!important;color:#111\}/);
assert.match(glass,/\.wxlight \.pf-friends-search\{[^}]*background:#f2f2f4!important/);

console.log('wechat contacts directory tests passed');

test('WeChat interaction: tabs, buttons, menu, swipe, composer and reduced-motion remain independent',async()=>{
 const {createServer}=await import('node:http'),path=await import('node:path'),{createRequire}=await import('node:module'),{chromium}=createRequire(import.meta.url)('playwright');
 const server=createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(ROOT,name);if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(name.endsWith('app.js')?read(name):fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{for(const [kind,file] of BUNDLES){
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+'/'+(kind==='web'?'小手机.html':path.dirname(file)+'/index.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{S.me.locked=false;S.settings.sound=false;S.settings.manualReply=true;S.settings.manualReplyScenes={wechat:true};S.contacts.forEach(c=>c.proactive={enabled:false});openWeChat();});
  assert.equal(await page.locator('.wx-ui-tab-glide').count(),1);
  await page.waitForFunction(()=>document.querySelector('#app>.page').getAnimations().length===0&&!document.querySelector('.shell-motion-ghost'));
  const start=await page.locator('.wx-main-tabbar').boundingBox();
  await page.locator('[data-wx-tab="contacts"]').click();assert.equal(await page.locator('#app>.page').getAttribute('data-wx-ui-navigation'),'tab');
  const changed=await page.evaluate(()=>({tab:wxTab,root:document.querySelector('#app>.page').getAnimations().length,marker:document.querySelector('.wx-ui-tab-glide').getAnimations().length,body:document.querySelector('.wx-main-scroll').getAnimations().length,content:document.querySelector('.wx-main-scroll').getAnimations({subtree:true}).filter(a=>_shellMotionJobs.includes(a)).length,pressed:document.querySelector('[data-wx-tab="contacts"]').getAttribute('aria-pressed')}));assert.equal(changed.tab,'contacts');assert.equal(changed.root,0);assert(changed.marker>0&&changed.content>0);assert.equal(changed.pressed,'true');
  const end=await page.locator('.wx-main-tabbar').boundingBox();assert.deepEqual(end,start,'tabbar stays in place while content moves');
  await page.waitForFunction(()=>document.querySelector('.wx-main-scroll').getAnimations().length===0);
  const input=page.locator('#wx-contact-search');await input.fill('北');assert.equal(await page.evaluate(()=>document.querySelector('.wx-main-scroll').getAnimations().length),0);assert.equal(await page.locator('#ctlist .wx-contact-person').count(),1);
  await page.locator('[data-wx-tab="me"]').click();
  const meAvatar=await page.evaluate(async()=>{const p=document.querySelector('#app>.page'),avatar=p.querySelector('.wxme-profile-card .avatar,.wxme-profile-card .av'),card=p.querySelector('.wxme-profile-card'),active=[];for(let n=avatar;n&&p.contains(n);n=n.parentElement)active.push(...n.getAnimations());const menuMotion=p.getAnimations({subtree:true}).filter(a=>_shellMotionJobs.includes(a)&&a.effect.target.closest('.wxme-home>section')).length,rows=[];for(let i=0;i<28;i++){const r=avatar.getBoundingClientRect();rows.push([r.x,r.y]);await new Promise(requestAnimationFrame);}return {animations:active.length,dx:Math.max(...rows.map(r=>r[0]))-Math.min(...rows.map(r=>r[0])),dy:Math.max(...rows.map(r=>r[1]))-Math.min(...rows.map(r=>r[1])),menuMotion,card:!!card};});assert(meAvatar.card);assert.equal(meAvatar.animations,0,'Me avatar and profile ancestors never enter content motion');assert(meAvatar.dx<.1&&meAvatar.dy<.1,'Me avatar has no end-of-animation snap '+JSON.stringify(meAvatar));assert(meAvatar.menuMotion>0,'Me menu content still animates');
  await page.locator('[data-wx-tab="chats"]').click();await page.evaluate(()=>{window.wxMenuMotionObserved=false;document.addEventListener('click',()=>{const el=document.querySelector('.wx-quick-menu');window.wxMenuMotionObserved=!!el&&el.getAnimations().length>0;},{once:true});});await page.locator('.wx-main-add').click();assert.equal(await page.locator('.wx-main-add').getAttribute('aria-expanded'),'true');assert(await page.evaluate(()=>wxMenuMotionObserved),'the real click creates menu motion before its natural end');
  await page.locator('.wx-quick-shade').click({position:{x:10,y:120}});assert.equal(await page.locator('.wx-quick-menu').count(),0);
  const row=page.locator('.wx-conversation-swipe').first(),box=await row.boundingBox(),x=box.x+box.width*.75,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();assert.equal(await page.locator('[data-wx-ui-pressed]').count(),1);await page.mouse.move(x-110,y,{steps:8});await page.mouse.up();assert.equal(await page.evaluate(()=>cur().p),'wechat');assert.equal(await page.locator('[data-wx-ui-pressed]').count(),0);assert.equal(await page.locator('.wx-ui-touch-bloom').count(),0,'a swipe does not produce a tap bloom');
  await page.evaluate(()=>{document.querySelectorAll('.wx-conversation-swipe.open').forEach(e=>e.classList.remove('open'));_wxConversationIgnoreUntil=0;});
  const roleEntry=await page.evaluate(()=>{openChat(S.contacts[0].id);const p=document.querySelector('#app>.page'),a=p.getAnimations()[0],title=p.querySelector('.nav .t'),frames=a&&a.effect.getKeyframes(),ghost=document.querySelector('.shell-motion-ghost');return {kind:p.dataset.wxRoleEntry,start:frames&&new DOMMatrix(frames[0].transform).m41,end:frames&&new DOMMatrix(frames.at(-1).transform).m41,titleAnimations:title.getAnimations().length,ghost:!!ghost,unsafe:ghost?ghost.querySelectorAll('[id],[onclick],input,textarea,select,[contenteditable]').length:0};});assert.equal(roleEntry.kind,'slide-left');assert(roleEntry.start>300);assert.equal(roleEntry.end,0);assert.equal(roleEntry.titleAnimations,0,'the name enters with the page, never with a second bounce');assert(roleEntry.ghost);assert.equal(roleEntry.unsafe,0,'outgoing visual has no live fields, IDs or handlers');
  const entryReplay=await page.evaluate(()=>{const before=_wxRoleEntry,age=before.animation.currentTime;render();return {same:before===_wxRoleEntry,age:!!_wxRoleEntry&&_wxRoleEntry.animation.currentTime>=age-5};});assert(entryReplay.same&&entryReplay.age,'same-role redraw keeps the entry progress');
  await page.waitForFunction(()=>!document.querySelector('.shell-motion-ghost')&&!_wxRoleEntry);assert.equal(await page.locator('#app>.page').getAttribute('data-wx-ui-navigation'),'push');
  await page.locator('#cinput').fill('动画不能丢掉这段草稿');await page.evaluate(()=>{window.wxUiInput=document.querySelector('#cinput');wxUiInput.focus();render();});assert(await page.evaluate(()=>wxUiInput===document.querySelector('#cinput')&&document.activeElement===wxUiInput));
  await page.locator('#cinput').click();assert.equal(await page.locator('[data-wx-ui-pressed]').count(),0,'the native editor is never a motion button');
  const emoji=page.locator('.chat-emoji-toggle');await emoji.click();await page.waitForFunction(()=>document.querySelector('#panel').classList.contains('show'));assert.equal(await emoji.getAttribute('aria-expanded'),'true');assert(await page.locator('#panel .chat-panel-pane.on').evaluate(e=>e.getAnimations().length>0));assert.equal(await page.locator('#cinput').inputValue(),'动画不能丢掉这段草稿');
  await emoji.click();await page.waitForFunction(()=>!document.querySelector('#panel')._wxUiMotion);await page.locator('#cinput').fill('');await page.locator('.chat-function-toggle').click();await page.waitForFunction(()=>document.querySelector('#panel').dataset.page==='fn');assert.equal(await page.locator('.chat-function-toggle').getAttribute('aria-expanded'),'true');
  const panelMotion=await page.evaluate(()=>{const p=document.querySelector('#panel'),icon=document.querySelector('.chat-function-toggle>span');return {heightFrames:p.getAnimations().flatMap(a=>a.effect.getKeyframes()).filter(f=>f.height).map(f=>parseFloat(f.height)),iconFrames:icon.getAnimations().flatMap(a=>a.effect.getKeyframes()).map(f=>f.transform)};});
  assert(panelMotion.heightFrames.includes(0)&&panelMotion.heightFrames.some(h=>h>100),'composer panel visibly expands from zero height');assert(panelMotion.iconFrames.includes('rotate(53deg)'),'composer plus has a visible rotation and gentle overshoot');
  await page.waitForFunction(()=>!document.querySelector('#panel')._wxUiMotion);const fullPanelHeight=await page.locator('#panel').evaluate(e=>e.getBoundingClientRect().height);
  await page.locator('.chat-function-toggle').click();assert.equal(await page.locator('#panel').evaluate(e=>e.classList.contains('show')),false,'business close is immediate');
  assert.equal(await page.locator('#panel').getAttribute('data-wx-ui-closing'),'');assert(await page.locator('#panel').evaluate(e=>e.getAnimations().some(a=>a.effect.getKeyframes().some(f=>f.height==='0px'))));
  await page.waitForFunction(()=>!document.querySelector('#panel').hasAttribute('data-wx-ui-closing'));assert.equal(await page.locator('#panel').evaluate(e=>e.getBoundingClientRect().height),0);
  await page.evaluate(()=>{chatPanelToggle('fn');});await page.waitForTimeout(90);await page.evaluate(()=>{chatPanelToggle('fn');});await page.waitForTimeout(60);await page.evaluate(()=>{chatPanelToggle('fn');});await page.waitForFunction(()=>!document.querySelector('#panel')._wxUiMotion);
  assert.equal(await page.locator('#panel').evaluate(e=>e.getBoundingClientRect().height),fullPanelHeight,'rapid reversal restores the exact natural panel height');assert.equal(await page.locator('#panel').getAttribute('style'),null,'motion leaves no inline height or display overrides');
  await page.locator('.chat-function-toggle').click();await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>wxUiClear());assert.equal(await page.locator('#panel').getAttribute('data-wx-ui-closing'),null);assert.equal(await page.locator('#panel').evaluate(e=>e.getBoundingClientRect().height),0);await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#cinput').fill('只发送一次的验证消息');
  const before=await page.evaluate(()=>msgs(cur().id).filter(m=>m.role==='user').length);await page.locator('.chat-send').click();assert.equal(await page.evaluate(()=>msgs(cur().id).filter(m=>m.role==='user').length),before+1,'one button tap sends exactly one message');
  await page.evaluate(()=>cTransfer(cur().id));assert.equal(await page.evaluate(()=>cur().p),'tfSend');
  assert.equal(await page.locator('#app>.page').getAttribute('data-wx-payment-motion'),'enter');
  assert(await page.locator('.wx-tfs-panel').evaluate(e=>e.getAnimations({subtree:true}).some(a=>_shellMotionJobs.includes(a))),'payment content motion is restored');assert(await page.locator('.wx-tfs-keys>button').first().evaluate(e=>e.getAnimations().length>0),'payment keypad buttons retain their entrance');
  assert(await page.locator('.wx-tfs-keys>button').first().evaluate(e=>e.getAnimations().some(a=>a.effect.getTiming().duration>=430)));
  await page.waitForFunction(()=>_wxUiJobs.size===0);await page.evaluate(()=>render());assert.equal(await page.locator('.wx-tfs-panel').evaluate(e=>e.getAnimations().length),0,'same payment page refresh does not replay entrance');
  for(const digit of ['1','2','.','3','4'])await page.locator('.wx-tfs-keys').getByRole('button',{name:digit,exact:true}).click();assert.equal(await page.locator('#tfsAmt').textContent(),'12.34','animated keypad applies each digit exactly once');
  await page.evaluate(()=>{window.wxPayDraft=_paySend.amount;render();});assert.equal(await page.locator('#tfsAmt').textContent(),'12.34');await page.evaluate(()=>back());assert.equal(await page.evaluate(()=>cur().p),'chat');
  await page.evaluate(()=>{const id=cur().id;msgs(id).push({id:'motion-transfer-fixture',role:'assistant',type:'transfer',amount:18.8,note:'仅本地动效示例',time:Date.now()});openTransferDetail(id,'motion-transfer-fixture');});
  assert.equal(await page.locator('.wx-transfer-detail-hero').evaluate(e=>e.getAnimations().length),0);await page.evaluate(()=>back());
  await page.evaluate(()=>{openWeChat('contacts');relOpen('');});assert.equal(await page.locator('#app>.page').getAttribute('data-wx-social-motion'),'relationships');const relation=await page.evaluate(()=>{const overview=shellMotionRoute(cur());relOpen(S.contacts[0].id);return {overview,person:shellMotionRoute(cur()),root:document.querySelector('#app>.page').getAnimations().length,body:document.querySelector('.gmanage-scroll').getAnimations().length};});assert.notEqual(relation.overview,relation.person,'relationship person key is part of the navigation identity');assert.equal(relation.root,0);assert.equal(relation.body,0);await page.evaluate(()=>render());assert.equal(await page.locator('.gmanage-scroll').evaluate(e=>e.getAnimations().length),0);
  await page.evaluate(()=>{const c=S.contacts[0];S.moments=[{id:'motion-post-a',acct:actId(),authorId:c.id,text:'只用于本地互动检查',time:Date.now(),likes:[],comments:[],images:[]},{id:'motion-post-b',acct:actId(),authorId:c.id,text:'第二条动态',time:Date.now()-1000,likes:[],comments:[],images:[]}];go('wxmoment');});assert.equal(await page.locator('#app>.page').getAttribute('data-wx-social-motion'),'moments');assert(await page.locator('.mpost').first().evaluate(e=>e.getAnimations({subtree:true}).some(a=>_shellMotionJobs.includes(a))));
  await page.locator('.mpost').first().locator('.acts').click();await page.waitForFunction(()=>document.querySelector('#moment-actions-motion-post-a').getAnimations().length>0);assert(await page.locator('#moment-actions-motion-post-a').evaluate(e=>e.getAnimations().length>0));await page.locator('#moment-actions-motion-post-a').getByRole('button',{name:'赞',exact:true}).click();assert.equal(await page.evaluate(()=>S.moments[0].likes.filter(x=>x===S.me.name).length),1,'moment like executes once');
  await page.locator('#moment-actions-motion-post-a').getByRole('button',{name:'评论',exact:true}).click();await page.locator('#moment-comment-motion-post-a').fill('尚未发送的朋友圈评论');await page.evaluate(()=>momentSocialRefresh('motion-post-a'));assert.equal(await page.locator('#moment-comment-motion-post-a').inputValue(),'尚未发送的朋友圈评论');assert(await page.locator('#moment-comment-motion-post-a').evaluate(e=>document.activeElement===e),'comment animation preserves input focus');
  await page.evaluate(()=>go('roleMoments',{id:S.contacts[0].id}));assert.equal(await page.locator('#app>.page').getAttribute('data-wx-social-motion'),'moments');assert(await page.locator('.wx-role-moments').evaluate(e=>e.getAnimations({subtree:true}).some(a=>_shellMotionJobs.includes(a))));
  const detailMotion=await page.evaluate(()=>{roleMomentDetail(S.contacts[0].id,'motion-post-a');const first=shellMotionRoute(cur());roleMomentDetail(S.contacts[0].id,'motion-post-b');return {first,second:shellMotionRoute(cur()),motion:document.querySelector('.wx-role-detail-scroll').getAnimations().length,root:document.querySelector('#app>.page').getAnimations().length};});assert.notEqual(detailMotion.first,detailMotion.second);assert.equal(detailMotion.motion,0);assert.equal(detailMotion.root,0);await page.evaluate(()=>openChat(S.contacts[0].id));
  const beforePreviewCall=await page.evaluate(()=>msgs(S.contacts[0].id).length);await page.evaluate(()=>wxInteractionPreviewCall());await page.waitForFunction(()=>document.querySelector('#callLayer').dataset.wxCallMotion==='outgoing');
  const callMotion=await page.locator('#callLayer').evaluate(e=>({ring:!!e.querySelector('[data-wx-call-waiting]'),avatar:e.querySelector('.cav').getAnimations().length,control:e.querySelector('.callbtns>.cbtncol').getAnimations().flatMap(a=>a.effect.getKeyframes()).some(k=>k.transform&&new DOMMatrix(k.transform).m42===36),root:e.getAnimations().every(a=>a.effect.getKeyframes().every(k=>!k.transform))}));assert(callMotion.ring&&callMotion.avatar>0&&callMotion.control&&callMotion.root,'call identity and controls animate while the media root stays fixed: '+JSON.stringify(callMotion));
  await page.waitForFunction(()=>_wxCallUiJobs.size===0);await page.evaluate(()=>renderCall());assert.equal(await page.locator('#callLayer .cname').evaluate(e=>e.getAnimations().length),0,'same call refresh does not replay entrance');
  await page.evaluate(()=>{_call.min=true;renderCall();});await page.waitForFunction(()=>document.querySelector('#callLayer').dataset.wxCallMotion==='mini');await page.evaluate(()=>{_call.min=false;renderCall();});await page.waitForFunction(()=>document.querySelector('#callLayer').dataset.wxCallMotion==='outgoing');
  await page.evaluate(()=>{_call.kind='video';_call.state='active';_call.start=Date.now();renderCall();});await page.waitForFunction(()=>document.querySelector('#callLayer').dataset.wxCallMotion==='active');assert.equal(await page.locator('#callLayer [data-wx-call-waiting]').count(),0);assert.equal(await page.locator('#callCameraPreview').evaluate(e=>e.getAnimations().length),0,'active camera element is never animated');assert(await page.locator('#callLayer').evaluate(e=>e.getAnimations().every(a=>a.effect.getKeyframes().every(k=>!k.transform))));
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>wxUiClear());assert.equal(await page.evaluate(()=>_wxCallUiJobs.size),0);assert.equal(await page.locator('#callLayer [data-wx-call-waiting]').count(),0);await page.locator('#callLayer .callbtns .cbtn.red').click();assert.equal(await page.evaluate(()=>_call),null);assert.equal(await page.evaluate(()=>msgs(S.contacts[0].id).length),beforePreviewCall,'ending the local animation demo never writes a real call record');await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{openModal('<h3>微信按钮反馈</h3><button id="wxMotionFixtureButton">只改本地计数</button>');window.wxMotionFixtureCount=0;document.querySelector('#wxMotionFixtureButton').onclick=()=>window.wxMotionFixtureCount++;});
  const action=page.locator('#wxMotionFixtureButton'),rect=await action.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();assert.equal(await action.getAttribute('data-wx-ui-pressed'),'true');await page.mouse.up();await page.waitForFunction(()=>wxMotionFixtureCount===1);assert.equal(await page.locator('.wx-ui-touch-bloom').count(),1);
  await action.dispatchEvent('pointerdown',{isPrimary:true,pointerId:90,button:0,clientX:rect.x+5,clientY:rect.y+5});await action.dispatchEvent('pointercancel',{pointerId:90});assert.equal(await page.locator('[data-wx-ui-pressed]').count(),0);assert.equal(await page.evaluate(()=>wxMotionFixtureCount),1);
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>render());assert.equal(await page.evaluate(()=>_wxUiJobs.size+_shellSurfaceJobs.size),0);await action.tap();assert.equal(await page.evaluate(()=>wxMotionFixtureCount),2);assert.equal(await page.locator('.wx-ui-touch-bloom').count(),0);await action.press('Enter');assert.equal(await page.evaluate(()=>wxMotionFixtureCount),3);await page.evaluate(()=>closeModal());
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{S.me.wxTheme='white';openWeChat('chats');});assert(await page.locator('#app>.wx-ui-scope.wxlight').count());await page.locator('[data-wx-tab="me"]').click();assert.equal(await page.locator('[data-wx-tab="me"]').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>{const old=S;S=Object.assign({},S);render();window.wxUiOldOwner=old;});assert.equal(await page.evaluate(()=>_wxUiJobs.size),0);await page.evaluate(()=>{S=wxUiOldOwner;Element.prototype.animate=undefined;openWeChat('me');});assert.equal(await page.evaluate(()=>wxTab),'me');assert.deepEqual(errors,[],kind);await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
