import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const P='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const fnSrc=(s,n)=>{const i=s.indexOf(`function ${n}(`);assert.ok(i>=0,n);return s.slice(i,s.indexOf('\n',i));};
for(const [label,p,h] of [['web','app.js','小手机.html'],['private',P+'app.js',P+'index.html']]){
  const s=read(p),html=read(h);
  test(`${label}: read receipts for roles and real friends share one switch in 角色、时间与消息`,()=>{
    assert.match(s,/function readReceiptOn\(\)\{return !\(S\.settings&&S\.settings\.readReceipt===false\);\}/);
    assert.match(s,/<span>微信已读<br>/);assert.match(s,/onclick="readReceiptToggle\(\)"/);
    assert.match(s,/function pfReadStatus\(m,scope,gid\)\{[^\n]*if\(!readReceiptOn\(\)\)return '';/);
    assert.match(s,/function pfAckRead\(mid\)\{[^}]*readReceiptOn\(\)/,'关掉后不再告诉真人好友读没读');
  });
  test(`${label}: the role marks her messages read when he starts replying, shown on a line the premium theme does not hide`,()=>{
    assert.match(s,/roleMarkRead\(id\);\n  \/\/ typing/);
    assert.match(s,/\$\{inner\}\$\{ts\}\$\{readLine\}<\/div>/);
    assert.match(s,/class="msgread msgread-line" data-read-for=/);
    assert.match(s,/class="msgread-line"[\s\S]*data-pf-in=[\s\S]*data-wx-read=/,'真人好友已读独立显示且等待真实回执');
    assert.doesNotMatch(s,/\$\{rs\?`<span style="margin-right:8px;color:#8d8d96">/,'真人好友的已读不能再塞进被隐藏的时间行');
    assert.match(html,/\.msgread-line\{position:absolute;bottom:1px;right:calc\(100% \+ 6px\)/);assert.match(html,/\.msg\.them \.msgread-line\{right:auto;left:calc\(100% \+ 6px\)\}/);
    assert.match(s,/const readLine=me\?roleReadLabelHTML\(c,m\):roleSeenLabelHTML\(c,m\);/,'他发来的消息旁边也显示你读没读');
    assert.match(s,/setInterval\(roleSeenTick,500\);/);
    assert.match(s,/pfReadIds\(m\)\.indexOf\(p\.id\)>=0\?'已读':''/,'真人好友未读留白，已读依据回执');
    assert.match(s,/function pfReadInPlace\(id\)/);
    assert.doesNotMatch(fnSrc(s,'roleReadLabelHTML'),/display:none/,'每一条都显示，不能后面读了前面就藏起来');
    assert.doesNotMatch(fnSrc(s,'roleSeenLabelHTML'),/display:none/);
    assert.match(s,/if\(_main&&typeof roleReadPrompt==='function'\)s\+=roleReadPrompt\(c\);/,'角色知道你已读没回');
  });
}

for(const file of ['app.js',P+'app.js']){
 test(file+': unread is blank and each incoming message has its own two-second deadline',()=>{
  const app=read(file),fn=fnSrc(app,'wechatMotionReadDue'),ctx=vm.createContext({Math,readReceiptOn:()=>true,roleReadCounted:()=>true,roleMsgRead:()=>false});vm.runInContext(fn+'\n'+fnSrc(app,'roleReadLabelHTML')+'\n'+fnSrc(app,'roleSeenLabelHTML'),ctx);assert(!ctx.roleReadLabelHTML({id:'c'},{id:'u',role:'user'}).includes('未读'));assert(!ctx.roleSeenLabelHTML({id:'c'},{id:'a',role:'assistant'}).includes('未读'));
  const first={born:1000,initial:false,due:0},second={born:1800,initial:false,due:0};
  assert.equal(ctx.wechatMotionReadDue(first,'',1200,true),0,'no receipt means no fabricated read');
  assert.equal(ctx.wechatMotionReadDue(first,'已读',1200,true),3000);
  assert.equal(ctx.wechatMotionReadDue(second,'已读',1900,true),3800);
  assert.equal(ctx.wechatMotionReadDue(first,'已读',2500,true),3000,'refresh cannot restart the first timer');
  assert.equal(ctx.wechatMotionReadDue({born:1000,initial:false,due:0},'已读',6000,false),8000,'outgoing uses actual receipt arrival');
  assert.equal(ctx.wechatMotionReadDue({born:1000,initial:true,due:0},'已读',6000,true),6000,'historical read never replays');
 });
}

for(const file of ['app.js',P+'app.js']){
 test(file+': message animation identity survives friend/group server acknowledgement',()=>{
  const app=read(file),ctx=vm.createContext({pfMsgPayload:m=>m.payload});
  vm.runInContext(fnSrc(app,'wechatMotionMessageId'),ctx);
  assert.equal(ctx.wechatMotionMessageId({id:'local_1',payload:{_clientSendId:'SPME_local_1'}}),ctx.wechatMotionMessageId({id:'server_88',payload:{_clientSendId:'SPME_local_1'}}));
  assert.notEqual(ctx.wechatMotionMessageId({id:'a'}),ctx.wechatMotionMessageId({id:'b'}));
 });
 test(file+': replaced message elements resume elapsed entrance instead of flashing or replaying',()=>{
  const app=read(file),calls=[],ctx=vm.createContext({Math,wechatMotionReduced:()=>false});
  vm.runInContext(fnSrc(app,'wechatMotionAnimate'),ctx);
  const el={animate:(frames,options)=>{const a={currentTime:0};calls.push({frames,options,a});return a;}};
  ctx.wechatMotionAnimate(el,{opacity:0},520,80,240);
  assert.equal(calls[0].a.currentTime,240,'replacement resumes original timeline including avatar delay');
  ctx.wechatMotionAnimate(el,{opacity:0},520,80,700);
  assert.equal(calls.length,1,'finished history must not animate again');
 });
}

test('real browser: friend ACK and role/group redraw keep entrance progress on both sources',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const file of ['app.js',P+'app.js']){
  const app=read(file),page=await browser.newPage();
  await page.setContent('<div id="chatbg"></div><div id="pfchatbg"></div><div id="pfgroupbg"></div>');
  await page.addScriptTag({content:'function actId(){return "main";}function renderPageKey(c){return c.p+":"+c.id;}function readReceiptOn(){return false;}function pfMsgPayload(m){return m.payload;}'+app.slice(app.indexOf('let _wechatMotion=null;'),app.indexOf('let _scrollBottomOnce'))});
  for(const kind of ['chat','group','pfchat','pfgroup']){
   await page.evaluate(kind=>{window.kind=kind;window.box=document.getElementById(kind==='pfchat'?'pfchatbg':kind==='pfgroup'?'pfgroupbg':'chatbg');box.innerHTML='';wechatMotionDispose();wechatMotionMount({p:kind,id:'fixture'});window.rowHTML=id=>'<div class="msg me" data-message-id="'+id+'" data-wx-motion-id="client:fixture"><div class="avatar">头像</div><div class="col">消息</div></div>';box.innerHTML=rowHTML('local_1');},kind);
   await page.waitForTimeout(180);
   const before=await page.evaluate(()=>({opacity:Number(getComputedStyle(box.querySelector('.avatar')).opacity),time:box.querySelector('.avatar').getAnimations()[0].currentTime}));
   await page.evaluate(()=>{box.innerHTML=rowHTML('server_1');wechatMotionMount({p:kind,id:'fixture'});});
   const after=await page.evaluate(()=>({opacity:Number(getComputedStyle(box.querySelector('.avatar')).opacity),size:_wechatMotion.rows.size,time:box.querySelector('.avatar').getAnimations()[0]?.currentTime}));
   assert.equal(after.size,1,file+' '+kind+' acknowledgement keeps one record');assert(after.time>=before.time&&after.time>0,file+' '+kind+' resumed timeline');assert(Math.abs(after.opacity-before.opacity)<.16,file+' '+kind+' no reset: '+JSON.stringify({before,after}));
   await page.waitForTimeout(650);
   await page.evaluate(()=>{box.innerHTML=rowHTML('server_1');wechatMotionMount({p:kind,id:'fixture'});});
   assert.equal(await page.evaluate(()=>box.querySelector('.avatar').getAnimations().length),0,'finished message does not replay');
  }await page.close();
 }}finally{await browser.close();}
});

test('browser: timestamps and read letters keep progress through friend acknowledgement and redraw',async()=>{
 const {createRequire}=await import('node:module'),{chromium}=createRequire(import.meta.url)('playwright');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const file of ['app.js',P+'app.js']){
  const app=read(file),page=await browser.newPage();await page.setContent('<div id="pfchatbg"></div>');
  await page.addScriptTag({content:'function actId(){return "main";}function renderPageKey(){return "pfchat:fixture";}function readReceiptOn(){return true;}'+app.slice(app.indexOf('let _wechatMotion=null;'),app.indexOf('let _scrollBottomOnce'))});
  await page.evaluate(()=>{window.box=document.getElementById('pfchatbg');wechatMotionMount({p:'pfchat'});window.html=(id,time)=>'<div class="tstamp">'+time+'</div><div class="msg me" data-message-id="'+id+'" data-wx-motion-id="client:fixture"><div class="col">消息<div class="msgread-line" data-wx-read="已读">已读</div></div></div>';box.innerHTML=html('local_1','12:00');});
  await page.waitForTimeout(330);
  const before=await page.evaluate(()=>box.querySelector('.tstamp').getAnimations()[0].currentTime);
  await page.evaluate(()=>{box.innerHTML=html('server_1','12:01');wechatMotionMount({p:'pfchat'});});
  assert(await page.evaluate(()=>box.querySelector('.tstamp').getAnimations()[0]?.currentTime>=0) ,'timestamp exists');
  const after=await page.evaluate(()=>box.querySelector('.tstamp').getAnimations()[0]?.currentTime);assert(after>=before,'ACK must resume timestamp rather than restart');
  // Use the real timer deadline; do not wait an additional two seconds after redraw.
  await page.waitForFunction(()=>box.querySelector('.msgread-line span')!==null,null,{timeout:4000});await page.waitForTimeout(220);
  const readBefore=await page.evaluate(()=>box.querySelector('.msgread-line span').getAnimations()[0].currentTime);
  await page.evaluate(()=>{box.innerHTML=html('server_1','12:01');wechatMotionMount({p:'pfchat'});});
  const readAfter=await page.evaluate(()=>box.querySelector('.msgread-line span')?.getAnimations()[0]?.currentTime);assert(readAfter>=readBefore,'read letters resume instead of jumping straight to full opacity');
  await page.waitForTimeout(850);await page.evaluate(()=>{box.innerHTML=html('server_1','12:01');wechatMotionMount({p:'pfchat'});});
  assert.equal(await page.evaluate(()=>box.querySelector('.tstamp').getAnimations().length),0,'finished timestamp does not replay');assert.equal(await page.evaluate(()=>box.querySelector('.msgread-line').getAnimations({subtree:true}).length),0,'finished read does not replay');await page.close();
 }}finally{await browser.close();}
});

test('natural chat motion: all bubble surfaces animate, preserve history and exclude cinema',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const file of ['app.js',P+'app.js']){
  const app=process.env.NORTH_CHAT_OLD?require('node:child_process').execFileSync('git',['show','HEAD:'+file],{maxBuffer:10e6}).toString():read(file),page=await browser.newPage();
  await page.addScriptTag({content:'function actId(){return "main";}function renderPageKey(c){return c.p+":"+(c.id||"");}function readReceiptOn(){return false;}function nearBottom(b){return b.scrollHeight-b.scrollTop-b.clientHeight<80;}'+app.slice(app.indexOf('let _wechatMotion=null;'),app.indexOf('let _scrollBottomOnce'))});
  for(const [p,id,cls] of [['off','offbg','offnar'],['rp','rpbg','rpnar'],['hischat','hischatlog','msg'],['hischat','hisselflog','msg'],['dydm','dydmbox','dydm-msg'],['dy','dy-group','dyg-msg'],['xdm','xdmbox','xmsg'],['phonesms','smsbody','imsg-row'],['shopcs','csbox','custom'],['mgroom','mgrbg','msg'],['gs','gsbg','msg'],['jail','jailbox','jnar'],['tale','talebox','jbub'],['dread','dreadbox','jnar'],['alter','alterbg','custom']]){
   await page.evaluate(({p,id,cls})=>{document.body.innerHTML='<div id="'+id+'" '+(p==='dy'?'class="dyg-box" data-render-scroll-key="dyg:fixture"':'')+' style="height:100px;overflow:auto"></div>';window.box=document.getElementById(id);window.context={p,id:'role',fid:id==='hisselflog'?'__me':'friend'};wechatMotionDispose();box.innerHTML='<div data-chat-motion-row="old" class="'+cls+'" style="height:150px"><div class="col">已有内容</div></div>';wechatMotionMount(context);box.scrollTop=box.scrollHeight;window.row='<div data-chat-motion-row="new" class="'+cls+'" style="height:100px"><div class="col">新回复和旁白</div></div>';box.insertAdjacentHTML('beforeend',row);},{p,id,cls});
   await page.waitForTimeout(120);
   const before=await page.evaluate(()=>{const row=box.querySelector('[data-chat-motion-row="new"]');return{n:row.getAnimations({subtree:true}).length,time:row.getAnimations({subtree:true})[0]?.currentTime};});assert(before.n>0,file+' '+p+' new bubble/narration animates');
   await page.evaluate(()=>{const content=box.innerHTML;box.innerHTML=content;wechatMotionMount(context);});
   assert(await page.evaluate(()=>box.querySelector('[data-chat-motion-row="new"]').getAnimations({subtree:true})[0]?.currentTime)>=before.time,'redraw resumes');
   await page.waitForTimeout(650);await page.evaluate(()=>{box.innerHTML=box.innerHTML;wechatMotionMount(context);});assert.equal(await page.evaluate(()=>box.querySelector('[data-chat-motion-row="new"]').getAnimations({subtree:true}).length),0,'history never replays');
  }
  await page.evaluate(()=>{document.body.innerHTML='<div id="cinLog"><div class="msg">放映室</div></div>';wechatMotionMount({p:'cinema'});});assert.equal(await page.evaluate(()=>document.querySelector('#cinLog').className),'','cinema is outside the shared presentation layer');
  await page.evaluate(()=>{document.body.innerHTML='<div id="single">音乐或电话</div>';window.cue={text:'你好'};naturalMotionTransient(document.getElementById('single'),cue);});await page.waitForTimeout(180);const t=await page.evaluate(()=>document.getElementById('single').getAnimations()[0].currentTime);await page.evaluate(()=>{document.body.innerHTML='<div id="single">音乐或电话</div>';naturalMotionTransient(document.getElementById('single'),cue);});assert(await page.evaluate(()=>document.getElementById('single').getAnimations()[0].currentTime)>=t,'single music/call cue resumes');await page.close();
 }}finally{await browser.close();}
});

test('actual web/private renderers: narration, role login, Douyin, music, calls and other bubble pages',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),path=require('node:path');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const priv of [false,true]){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const origin='http://127.0.0.1:8778';
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();const f=path.resolve(decodeURIComponent(u.pathname.slice(1)));if(!f.startsWith(process.cwd()+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({status:200,contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream',body:fs.readFileSync(f)});});
  await page.goto(origin+(priv?'/'+P+'index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  const result=await page.evaluate(()=>{
   S.me.locked=false;S.me.active='main';S.settings.sound=false;S.contacts.forEach(c=>c.proactive={enabled:false});const cid=S.contacts[0].id,now=Date.now();window.fixtureOut=[];
   const show=(name,html,c,selector)=>{document.getElementById('app').innerHTML='<div class="page">'+html+'</div>';wechatMotionMount(c);naturalMotionTransientScan();const box=renderScrollElement({id:selector});fixtureOut.push({name,mounted:box&&box.classList.contains('natural-motion-chat'),rows:box&&box.querySelectorAll('[data-message-id]').length});};
   const o=offData(cid);o.introSeen=true;o.msgs=[{id:'off-1',who:'旁白',text:'【轻轻走近】',_reveal:true,_revealStep:50,time:now}];_off={id:cid,mode:'offline',busy:false};show('offline',renderOff(cid),{p:'off',id:cid},'offbg');const glyph=document.querySelector('.offglyph');fixtureOut.push({name:'narration-glyph',plain:getComputedStyle(glyph).animationName==='none'&&getComputedStyle(glyph).opacity==='1'});
   const r=cohabRoot();r.enabled=true;r.paused=false;r.cid=cid;const d=cohabData(cid);d.phase='home';d.nextAt=now+86400000;d.msgs=[{id:'cohab-1',who:'旁白',text:'【一起坐下】',time:now}];_off={id:cid,mode:'cohab',busy:false};show('cohab',renderCohab(cid),{p:'off',id:cid,mode:'cohab'},'offbg');
   rpData(cid).msgs=[{id:'rp-1',who:'旁白',text:'【抬起眼睛】',time:now}];show('roleplay',renderRP(cid),{p:'rp',id:cid},'rpbg');
   S.dy.dms=[{id:'dm-fixture',cid,name:'测试角色',msgs:[{id:'dy-1',from:'me',text:'你好',time:now}]}];show('douyin',renderDyDM('dm-fixture'),{p:'dydm',id:'dm-fixture'},'dydmbox');dyTypingHTML('');
   S.x.dms=[{id:'x-fixture',name:'测试',msgs:[{id:'x-1',from:'me',text:'你好',time:now}]}];show('x',renderXDM('x-fixture'),{p:'xdm',id:'x-fixture'},'xdmbox');
   _hisLogin={cid};msgs(cid).push({id:'his-1',role:'assistant',type:'text',content:'你好',time:now});show('role-wechat',renderHisChat(cid,'__me'),{p:'hischat',id:cid,fid:'__me'},'hisselflog');
   show('imessage',renderPhoneIMsg('10086','fixture',[{id:'sms-1',from:'me',text:'你好',time:now}],null),{p:'phonesms',num:'10086',sk:'fixture'},'smsbody');
   csList().push({from:'me',text:'订单怎么样',time:now});show('customer-service',renderShopCS(),{p:'shopcs'},'csbox');
   _gs={cid,kind:'tod',title:'测试',msgs:[{id:'game-1',who:'me',text:'你好',time:now}],start:now,busy:false};show('game',renderGS(),{p:'gs'},'gsbg');
   const cue={side:'l',text:'音乐聊天'};document.getElementById('app').innerHTML=_mBubHTML(cue);naturalMotionTransientScan();fixtureOut.push({name:'music',animated:document.querySelector('[data-natural-transient]').getAnimations().length>0});
   _call={id:cid,session:'fixture',state:'active',sub:{who:'them',text:'电话字幕'}};document.getElementById('app').innerHTML='<div id="callSub"></div>';updateCallSub();fixtureOut.push({name:'call',animated:document.querySelector('.csline').getAnimations().length>0});_call=null;
   const prose='他没有擦。他甚至不知道那滴东西在那里。';
   const oldRow={id:'old-prose',who:'ta',source:'ta',text:prose,time:now};o.msgs=[oldRow];d.msgs=[oldRow];
   _off={id:cid,mode:'offline',busy:false};const offlineHTML=renderOff(cid,'offline');_off={id:cid,mode:'cohab',busy:false};const cohabHTML=renderCohab(cid);
   document.getElementById('app').innerHTML=cohabHTML;
   fixtureOut.push({name:'reported-history-narration',plain:!!document.querySelector('.offnar')&&!document.querySelector('.offbubble')&&oldRow.who==='ta'&&oldRow.text===prose&&offlineHTML.includes('class="offnar')});
   fixtureOut.push({name:'reported-raw-narration',plain:modelUnfilteredOfflineItems(prose)[0].who==='旁白'});
   _setCategory='network';document.getElementById('app').innerHTML=renderSettings();
   const on=document.getElementById('s_reasoning_on'),effort=document.getElementById('s_reasoning_effort');
   on.checked=true;effort.value='max';chatRouteCaptureForm();const saved=S.settings.chatRouteActive;
   chatRouteSwitch((saved+1)%4);const offDefault=!on.checked;chatRouteSwitch(saved);
   fixtureOut.push({name:'reasoning-route-ui',plain:offDefault&&on.checked&&effort.value==='max'&&S.settings.chat.reasoningEffort==='max'});
   return fixtureOut;
  });
  for(const item of result){if('mounted' in item)assert(item.mounted&&item.rows>0,JSON.stringify({priv,item}));if('plain' in item)assert(item.plain);if('animated' in item)assert(item.animated);}assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

for(const scenario of ['X reply typing','X reply failure','X reply empty','global gray group bubbles','narration clarity','rapid Douyin follow','cold music avatar','music composer and reply','music request failure','music stable click','music fallback and budget','music draft continuity','music pre-request failure','music missing contact','music status survives redraw','music delivery failure'])test('reported natural chat regression: '+scenario,async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),path=require('node:path'),cp=require('node:child_process');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const priv of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],musicRequests=[];page.on('pageerror',e=>errors.push(e.message));const origin='http://127.0.0.1:8778';
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/chat/completions')&&scenario.startsWith('X reply')){await new Promise(r=>setTimeout(r,700));if(scenario==='X reply failure')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'fixture X model unavailable'}})});return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:scenario==='X reply empty'?'':'推特正常回复'}}]})});}if(u.pathname.endsWith('/chat/completions')){const body=JSON.parse(route.request().postData()||'{}');musicRequests.push({url:u.pathname,...body});if(scenario==='music fallback and budget'&&body.model==='main-broken')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'primary unavailable'}})});}if(u.pathname.endsWith('/chat/completions')&&['music request failure','music status survives redraw'].includes(scenario))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'fixture model unavailable'}})});if(u.pathname.endsWith('/chat/completions'))return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'嗯，这首很好听'}}]})});if(u.origin!==origin)return route.abort();const rel=decodeURIComponent(u.pathname.slice(1)),f=path.resolve(rel);if(!f.startsWith(process.cwd()+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:''});const body=process.env.NORTH_REPORTED_OLD==='1'&&(rel.endsWith('app.js')||rel.endsWith('.html'))?cp.execFileSync('git',['show','HEAD:'+rel],{maxBuffer:32*1024*1024}):fs.readFileSync(f);return route.fulfill({status:200,contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream',body});});
  await page.goto(origin+(priv?'/'+P+'index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{S.me.locked=false;S.me.active='main';S.settings.sound=false;S.contacts.forEach(c=>c.proactive={enabled:false});window.testCid=S.contacts[0].id;});
  if(scenario.startsWith('X reply')){
   await page.evaluate(()=>{S.settings.chat={base:'http://127.0.0.1:8778/v1',key:'fixture',model:'fixture'};S.settings.aux={};S.settings.chatRoutes=null;S.x.dms=[{id:'x-reply-fixture',cid:testCid,name:'测试角色',msgs:[]}];stack=[{p:'xdm',id:'x-reply-fixture'}];render();document.getElementById('xdm_in').value='你好';xSendDM('x-reply-fixture');});
   await page.waitForSelector('.xdm-typing',{timeout:4000});assert.equal(await page.locator('.xdm-typing .typing span').count(),3);
   await page.evaluate(()=>render());assert.equal(await page.locator('.xdm-typing .typing span').count(),3,'typing survives redraw');
   await page.waitForFunction(()=>!document.querySelector('.xdm-typing'),null,{timeout:10000});
   if(scenario==='X reply typing')assert.match(await page.locator('#xdmbox').innerText(),/推特正常回复/);
   else{assert.match(await page.locator('#toast').innerText(),/推特私信回复失败/);assert.equal(await page.evaluate(()=>S.x.dms[0].msgs.length),1,'failure keeps sent message without fake reply');}
  }else if(scenario==='global gray group bubbles'){
   const result=await page.evaluate(()=>{S.me.wxFeatures=S.me.wxFeatures||{};S.me.wxFeatures.globalBubble=Object.assign({},BUBBLE_PRESETS.gray);const g={id:'gray-group',name:'测试群',members:[testCid],msgs:[]};const m={id:'gray-msg',senderId:testCid,type:'text',content:'群里也使用灰色',time:Date.now()};document.getElementById('app').innerHTML='<div class="page"><div id="chatbg">'+gbubble(g,m)+'</div></div>';const el=document.querySelector('.bubble');return {bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color,html:el.outerHTML};});
   assert.equal(result.bg,'rgb(44, 44, 46)');assert.equal(result.fg,'rgb(236, 236, 236)');
  }else if(scenario==='narration clarity'){
   const r=await page.evaluate(()=>{const o=offData(testCid);o.introSeen=true;o.msgs=[{id:'clear',who:'旁白',text:'一起坐下来',_reveal:true,_revealStep:100}];_off={id:testCid,mode:'offline',busy:false};stack=[{p:'off',id:testCid}];render();const glyph=document.querySelector('.offglyph');return{filter:getComputedStyle(glyph).filter,opacity:getComputedStyle(glyph).opacity};});assert.equal(r.filter,'none');assert.equal(r.opacity,'1');
  }else if(scenario==='rapid Douyin follow'){
   await page.evaluate(()=>{S.dy.dms=[{id:'rapid',cid:testCid,name:'测试',msgs:Array.from({length:16},(_,i)=>({id:'d'+i,from:'them',text:'已有消息 '+i,time:Date.now()+i}))}];stack=[{p:'dydm',id:'rapid'}];render();});await page.waitForTimeout(100);
   await page.evaluate(()=>{S.dy.dms[0].msgs.push({id:'long1',from:'them',text:'第一条新消息。'.repeat(70),time:Date.now()+100});render();});await page.waitForTimeout(170);
   await page.evaluate(()=>{S.dy.dms[0].msgs.push({id:'long2',from:'them',text:'第二条新消息。'.repeat(70),time:Date.now()+200});render();});await page.waitForTimeout(750);
   const remaining=await page.evaluate(()=>{const b=document.getElementById('dydmbox');return b.scrollHeight-b.scrollTop-b.clientHeight;});assert(remaining<3,'new replies must remain fully visible; remaining='+remaining);
  }else{
   await page.evaluate(()=>{musicInit();S.music.songs=[{id:'song-test',title:'测试曲',artist:'测试',url:''}];_mCur='song-test';_mView='player';S.music.session={cid:testCid,songId:_mCur,startTs:Date.now()};S.settings.chat={base:'http://127.0.0.1:8778/v1',key:'fixture',model:'fixture'};S.settings.chatRoutes=null;S.contacts[0].model='main';stack=[{p:'music'}];});
   if(scenario==='music pre-request failure'){await page.evaluate(()=>{render();musicFindSongByText=()=>{throw new Error('fixture song scan failed');};document.getElementById('m_chat').value='这首歌很好听';musicChatSend();});assert.equal(musicRequests.length,0);assert.match(await page.locator('#musicReplyStatus').innerText(),/匹配歌曲.*fixture song scan failed/);await page.evaluate(()=>render());assert.match(await page.locator('#musicReplyStatus').innerText(),/匹配歌曲.*fixture song scan failed/);assert(await page.locator('#musicReplyStatus').isVisible());assert.deepEqual(await page.evaluate(()=>{const a=document.getElementById('musicReplyStatus').getBoundingClientRect(),b=document.getElementById('musicChatInput').getBoundingClientRect();return a.bottom<=b.top;}),true,'failure stays above composer');
   }else if(scenario==='music missing contact'){await page.evaluate(async()=>{render();const original=getC;getC=id=>id===testCid?null:original(id);document.getElementById('m_chat').value='你好';await musicChatSend();getC=original;render();});assert.equal(musicRequests.length,0);assert.match(await page.locator('#musicReplyStatus').innerText(),/角色已不存在/);assert.equal(await page.evaluate(()=>_mReplyBusy),false);
   }else if(scenario==='music status survives redraw'){await page.evaluate(()=>{render();document.getElementById('m_chat').value='你好';musicChatSend();});await page.waitForFunction(()=>document.getElementById('musicReplyStatus').textContent.includes('一起听回复失败'));const text=await page.locator('#musicReplyStatus').innerText();await page.evaluate(()=>{render();});assert.equal(await page.locator('#musicReplyStatus').innerText(),text);assert.match(text,/请求角色模型/);assert(await page.locator('#musicReplyStatus').isVisible());assert(await page.evaluate(()=>!_mReplyBusy));
   }else if(scenario==='music delivery failure'){await page.evaluate(()=>{render();const original=mShowBub;mShowBub=(side,text)=>{if(side==='r')throw new Error('fixture reply paint failed');return original(side,text);};document.getElementById('m_chat').value='你好';musicChatSend();});await page.waitForFunction(()=>document.getElementById('musicReplyStatus').textContent.includes('fixture reply paint failed'));await page.evaluate(()=>render());assert.match(await page.locator('#musicReplyStatus').innerText(),/显示角色回复.*fixture reply paint failed/);assert(await page.evaluate(()=>!_mReplyBusy));
   }else if(scenario==='music draft continuity'){await page.evaluate(()=>{render();const input=document.getElementById('m_chat');input.value='输入中的草稿';input.focus();render();});assert.equal(await page.locator('#m_chat').inputValue(),'输入中的草稿');assert(await page.evaluate(()=>document.activeElement===document.getElementById('m_chat')),'music redraw keeps focused draft');}else if(scenario==='music stable click'){await page.evaluate(()=>{render();});await page.locator('#m_chat').fill('真实点击发送');const before=await page.evaluate(()=>({top:document.scrollingElement.scrollTop,position:document.getElementById('musicChatDock').style.position}));assert.equal(before.position,'','web composer must stay in normal flow');await page.locator('#musicChatInput .send').click();await page.waitForTimeout(900);assert(await page.evaluate(()=>S.music.chat.some(m=>m.role==='assistant')),'real pointer click reaches model and reply');}else if(scenario==='music fallback and budget'){await page.evaluate(()=>{S.settings.chatRoutes=[{base:'http://127.0.0.1:8778/unused',key:'fixture',model:'unused',maxTokens:1000,aux:{}},{base:'http://127.0.0.1:8778/primary',key:'fixture',model:'main-broken',maxTokens:8192,aux:{base:'http://127.0.0.1:8778/secondary',key:'fixture',model:'secondary-good'}}];S.contacts[0].chatRouteIndex=1;render();document.getElementById('m_chat').value='你好';musicChatSend();});await page.waitForTimeout(1000);assert(await page.evaluate(()=>S.music.chat.some(m=>m.role==='assistant')),'same-route secondary model replies after main fails');assert.deepEqual(musicRequests.map(r=>({url:r.url,model:r.model,max:r.max_tokens})),[{url:'/primary/chat/completions',model:'main-broken',max:8192},{url:'/secondary/chat/completions',model:'secondary-good',max:8192}]);}else if(scenario==='music request failure'){await page.evaluate(async()=>{render();document.getElementById('m_chat').value='你好';musicChatSend();await new Promise(r=>setTimeout(r,800));});assert(await page.evaluate(()=>document.body.textContent.includes('一起听回复失败')),'request failures must be visible');assert(await page.evaluate(()=>!_mReplyBusy),'failed model releases composer');}else if(scenario==='cold music avatar'){
    const r=await page.evaluate(()=>{S.music.meAvatar='idb:music-cold';delete _imgCache['music-cold'];render();const node=document.querySelector('.music-headphone-avatars [data-idb-avatar]');_imgCache['music-cold']='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="red"/></svg>');hydrateStoredImageNodes();return{hadPending:!!node,critical:routeCriticalStoredImageKeys().includes('music-cold'),imageWidth:node.querySelector('img').getBoundingClientRect().width};});assert(r.hadPending);assert(r.critical);assert(r.imageWidth<=66&&r.imageWidth>0,'hydrated avatar fits first render '+JSON.stringify(r));
   }else{
    await page.evaluate(()=>{render();window.__SMALL_PHONE_PRIVATE__=true;document.getElementById('m_chat').focus();});await page.waitForTimeout(220);
    assert(await page.evaluate(()=>document.getElementById('musicChatDock').style.position===''&&document.querySelector('.music-premium').style.height!==''),'private composer keeps normal flow within its viewport');
    const result=await page.evaluate(async()=>{const input=document.getElementById('m_chat');input.value='这一首好好听\n'.repeat(10);input.scrollTop=200;musicChatSend();await new Promise(r=>setTimeout(r,900));return{user:S.music.chat.some(m=>m.role==='user'),reply:S.music.chat.some(m=>m.role==='assistant'),busy:_mReplyBusy,scroll:input.scrollTop,box:getComputedStyle(input).boxSizing,height:input.clientHeight,line:parseFloat(getComputedStyle(input).lineHeight)+parseFloat(getComputedStyle(input).paddingTop)+parseFloat(getComputedStyle(input).paddingBottom)};});assert(result.user&&result.reply&&!result.busy,JSON.stringify(result));assert.equal(result.scroll,0);assert.equal(result.box,'border-box');assert(result.height>=result.line);
   }
  }
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});

for(const file of ['app.js',P+'app.js']){
 test(file+': Douyin receipts enter the shared independent deadline renderer',()=>{
  const s=read(file);assert.match(s,/<span class="dydm-read" data-wx-read="已读"><\/span>/);
  assert.ok(fnSrc(s,'wechatMotionScan').includes('.dydm-read[data-wx-read]'));
  const ctx=vm.createContext({Math});vm.runInContext(fnSrc(s,'wechatMotionReadDue'),ctx);
  const a={born:1000,initial:false},b={born:1600,initial:false};
  assert.equal(ctx.wechatMotionReadDue(a,'已读',1000,false),3000);
  assert.equal(ctx.wechatMotionReadDue(b,'已读',1600,false),3600);
  assert.equal(ctx.wechatMotionReadDue(a,'已读',2000,false),3000);
 });
 test(file+': new moment replies animate once, first comment works, redraw resumes and history stays still',()=>{
  const s=read(file),calls=[];let now=1000,nodes=[],page={p:'wxmoment'};
  const ctx=vm.createContext({Date:{now:()=>now},Map,cur:()=>page,actId:()=> 'main',renderPageKey:p=>p.p,document:{querySelectorAll:()=>nodes},wechatMotionAnimate:(el,from,duration,delay,age)=>{calls.push({el,age});return {currentTime:age};}});
  vm.runInContext('let _momentReplyMotion=null;'+fnSrc(s,'momentReplyMotionScan'),ctx);
  const row=id=>({getAttribute:()=>id});ctx.momentReplyMotionScan();
  nodes=[row('post:first')];ctx.momentReplyMotionScan();assert.equal(calls.length,1);
  ctx.momentReplyMotionScan();assert.equal(calls.length,1);
  now=1100;calls[0].el=null;nodes=[row('post:first'),row('post:second')];ctx.momentReplyMotionScan();assert.equal(calls.length,3);
  assert.equal(calls[2].age,0);ctx.momentReplyMotionScan();assert.equal(calls.length,3);
  page={p:'roleMomentDetail',pid:'post'};ctx.momentReplyMotionScan();assert.equal(calls.length,3,'existing replies stay still on entry');
  assert.ok(fnSrc(s,'momentCommentLine').includes('momentCommentMotionAttr'));
  assert.ok(fnSrc(s,'momentSocialHTML').includes('momentCommentMotionAttr'));
  assert.equal(fnSrc(s,'momentSocialRefresh').split('momentReplyMotionScan()').length-1,2,'scan both sides of local refresh');
 });
}

test('browser: Douyin staggered read and moment first reply survive DOM redraw',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const file of ['app.js',P+'app.js']){
  const app=process.env.NORTH_CHAT_OLD?require('node:child_process').execFileSync('git',['show','HEAD:'+file],{maxBuffer:32e6}).toString():read(file),page=await browser.newPage();
  await page.setContent('<div id="dydmbox" style="height:200px;overflow:auto"></div><div id="social"></div>');
  await page.addScriptTag({content:'function actId(){return "main";}function cur(){return {p:"wxmoment"};}function renderPageKey(c){return c.p;}function nearBottom(){return true;}function readReceiptOn(){return true;}'+app.slice(app.indexOf('let _wechatMotion=null;'),app.indexOf('let _scrollBottomOnce'))});
  await page.evaluate(()=>{window.box=document.getElementById('dydmbox');window.dy={p:'dydm',id:'role'};wechatMotionMount(dy);window.row=id=>'<div class="dydm-msg me" data-chat-motion-row="'+id+'"><div class="dydm-b">hello</div><span class="dydm-read" data-wx-read="已读"></span></div>';box.innerHTML=row('a');wechatMotionMount(dy);});
  await page.waitForTimeout(650);await page.evaluate(()=>{box.insertAdjacentHTML('beforeend',row('b'));wechatMotionMount(dy);});
  assert.equal(await page.locator('.dydm-read').first().textContent(),'');
  await page.waitForFunction(()=>document.querySelector('.dydm-read').textContent==='已读',null,{timeout:3000});
  assert.equal(await page.locator('.dydm-read').nth(1).textContent(),'','second receipt remains pending');
  await page.waitForFunction(()=>[...document.querySelectorAll('.dydm-read')].every(el=>el.textContent==='已读'),null,{timeout:2000});
  const stamps=await page.locator('.dydm-read').evaluateAll(els=>els.map(el=>+el.dataset.wxReadShownAt));assert(stamps[1]-stamps[0]>=500);
  await page.waitForTimeout(850);await page.evaluate(()=>{box.innerHTML=row('a')+row('b');wechatMotionMount(dy);});
  assert.equal(await page.locator('.dydm-read').evaluateAll(els=>els.reduce((n,el)=>n+el.getAnimations({subtree:true}).length,0)),0);
  await page.addScriptTag({content:'let _momentReplyMotion=null;'+fnSrc(app,'momentReplyMotionScan')});
  await page.evaluate(()=>{momentReplyMotionScan();document.getElementById('social').innerHTML='<div data-moment-comment-motion="post:first">角色回复</div>';momentReplyMotionScan();});
  assert.equal(await page.locator('[data-moment-comment-motion]').evaluate(el=>el.getAnimations().length),1);
  await page.waitForTimeout(500);await page.evaluate(()=>{const slot=document.getElementById('social');slot.innerHTML=slot.innerHTML;momentReplyMotionScan();});
  assert.equal(await page.locator('[data-moment-comment-motion]').evaluate(el=>el.getAnimations().length),0);
  await page.close();
 }}finally{await browser.close();}
});
