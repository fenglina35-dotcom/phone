// Actual web/private page; model and native transports isolated, no user data.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
try{for(const privateApp of [false,true]){
 const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false})};});
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady&&window.DailyEventLedger);
 await page.waitForTimeout(1200);
 await page.evaluate(()=>{
  S.me.locked=false;S.me.active='main';window.testId=S.contacts[0].id;const c=getC(testId);S.couple={cid:c.id,grant:{wechat:true,music:true},locks:{wechat:{pwd:'1234'},music:{pwd:'1234'}}};c.spy={granted:true};c.proactive={enabled:false};S.settings.replyDelay=0;S.settings.chat={base:'https://fixture.invalid/v1',key:'fixture',model:'fixture',maxTokens:3000,temp:.7};aiCoreOn=()=>false;
  // Isolate requested replies from existing optional daily-task/mood timers.
  for(const role of S.contacts){role.taskOff=true;role.proactive={enabled:false};}S.mood=S.contacts.map(role=>({id:uid(),date:todayStr(),who:role.id,emoji:'calm',note:'测试夹具已记录',time:Date.now()}));
  window.testCalls=[];window.fixtureRaw='';fetchT=async(url,opt)=>{if(!String(url).startsWith('https://fixture.invalid/'))return new Response('false');testCalls.push(JSON.parse(opt.body));return new Response(JSON.stringify({choices:[{message:{content:fixtureRaw},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});};
  dailyEventLedgerSet(encodeURIComponent(c.id),'enabled',true);openChat(c.id);
 });
 for(const raw of [false,true]){
  const result=await page.evaluate(async raw=>{S.settings.modelOutputUnfiltered=raw;const c=getC(testId),s=DailyEventLedger.state(c);s.items=[];S.messages[testId]=[{id:uid(),role:'user',type:'text',content:'我昨天吃过晚饭了',time:Date.parse('2026-09-09T19:00:00+08:00')}];fixtureRaw='[内心|记住她说的事]\n知道了，不再追问昨天的晚饭。\n[事件簿|新|已发生|我昨天吃过晚饭了|用户昨天吃过晚饭。]';testCalls.length=0;await aiReply(testId);return{calls:testCalls.length,rows:msgs(testId).filter(m=>m.role==='assistant').map(m=>m.content),items:s.items,prompt:testCalls[0]?.messages?.map(m=>m.content).join('\n'),busy:replyGenerationBusy(testId,actId())};},raw);
  assert.equal(result.calls,1,JSON.stringify(result));assert.equal(result.items.length,1,JSON.stringify(result));assert.equal(result.items[0].eventDate,'2026-09-08');assert(!result.busy);assert(result.rows.some(x=>x.includes('知道了')));assert(!result.rows.join('').includes('事件簿|'));assert.match(result.prompt,/日常事件簿/);
 }
 const check=await page.evaluate(()=>{
  const c=getC(testId),mood='[心情|这只小狗又想拿撒娇糊弄过去]',input=mood+'\n【他站在门边。】\n过来。';
  const normal=offReplyItems(input),raw=modelUnfilteredOfflineItems(input);const o=offData(c.id);o.msgs=[{id:'mood',who:'ta',text:mood},{id:'nar',who:'旁白',source:'ta',text:'心情|旧旁白标签'},{id:'ok',who:'ta',text:'过来。'}];o.introSeen=true;_off={id:c.id,busy:false};const archive=renderOff(c.id);
  const before=JSON.stringify(S.couple.locks),out=applyControlTags('全部解锁？想得美，北。今天的账还挂着呢。',c,'把我的全部软件解锁。');
  return{normal:normal.map(x=>x.text),raw:raw.map(x=>x.text),archive,before,after:JSON.stringify(S.couple.locks),out};
 });
 assert.deepEqual(check.normal,['他站在门边。','过来。']);assert.deepEqual(check.raw,check.normal);assert(!check.archive.includes('小狗'));assert(!check.archive.includes('旧旁白标签'));assert(check.archive.includes('过来。'));assert.equal(check.before,check.after);
 for(const channel of ['offline','cohab'])for(const raw of [false,true]){
  const result=await page.evaluate(async({channel,raw})=>{
   const c=getC(testId),r=cohabRoot();r.enabled=channel==='cohab';r.paused=false;r.cid=c.id;const d=channel==='cohab'?cohabData(c.id):offData(c.id);d.started=true;d.introSeen=true;d.phase='home';d.nextAt=0;d.pendingArrival=null;d.msgs=[{id:uid(),who:'me',text:'今天已经吃过午饭了',time:Date.now()}];d.summaryRounds=0;
   DailyEventLedger.state(c).items=[];S.settings.modelOutputUnfiltered=raw;_off={id:c.id,mode:channel==='cohab'?'cohab':undefined,busy:false};go('off',{id:c.id,mode:channel==='cohab'?'cohab':undefined});
   fixtureRaw='[心情|她吃过饭就放心了]\n【他抬眼看向她，放下手里的杯子，往旁边挪了挪，让出身边的位置。】\n吃过就好，过来坐一会儿。\n[事件簿|新|已发生|今天已经吃过午饭了|用户今天吃过午饭了。]';testCalls.length=0;await offAI();
   return{channel,raw,calls:testCalls.length,requests:testCalls.map(x=>({max:x.max_tokens,first:String(x.messages?.[0]?.content).slice(0,110),last:String(x.messages?.at(-1)?.content).slice(0,180)})),audit:{unsafe:offlineUnsafeRoleDrift(fixtureRaw),parts:offResponseParts(fixtureRaw)},rows:d.msgs.filter(x=>x.who!=='me').map(x=>x.text),items:DailyEventLedger.state(c).items,busy:_off&&_off.busy,html:document.body.innerText};
  },{channel,raw});
  assert(result.rows.some(x=>x.includes('吃过就好')),JSON.stringify(result));assert(!result.rows.join('').includes('心情|'));assert(!result.rows.join('').includes('事件簿|'));assert.equal(result.items.length,1,JSON.stringify(result));assert(!result.busy);assert.equal(result.calls,1,JSON.stringify(result));console.log(JSON.stringify({privateApp,channel,raw,wholeReplyDelivered:true,eventRecorded:true,moodHidden:true}));
 }
 await page.evaluate(()=>{_off=null;cohabRoot().enabled=false;_spyUnlock[testId]=true;getSpy(getC(testId)).granted=true;S.spy[testId]=S.spy[testId]||{time:Date.now()};_spyApp=null;go('spy',{id:testId});});
 const eventTile=page.locator('[onclick]').filter({hasText:/^日常事件簿$/}).filter({has:page.locator('svg')});
 const icons=await page.evaluate(()=>{const tiles=[...document.querySelectorAll('[onclick]')];const icon=key=>tiles.find(x=>(x.getAttribute('onclick')||'').includes(",\u0027"+key+"\u0027)"))?.querySelector('svg')?.outerHTML;return{events:icon('events'),grudge:icon('grudge')};});
 assert(icons.events,'daily event ledger must render a line icon, not the old character fallback');assert.equal(icons.events,icons.grudge);
 await eventTile.click();
 await page.getByRole('checkbox',{name:'自动记录日常事件'}).waitFor();assert(await page.getByRole('checkbox',{name:'自动记录日常事件'}).isChecked());
 await page.getByRole('spinbutton',{name:'事件记录上限'}).fill('80');await page.getByRole('spinbutton',{name:'事件记录上限'}).blur();
 await page.screenshot({path:path.join(root,'.qa',`daily-events-${privateApp?'private':'web'}.png`),fullPage:true});
 await page.evaluate(()=>saveNowAsync());await page.goto(page.url().split('?')[0]);await page.waitForFunction(()=>window.__northBootReady&&window.DailyEventLedger);
 const restored=await page.evaluate(()=>{const s=DailyEventLedger.state(S.contacts[0]);return{enabled:s.enabled,limit:s.limit,count:s.items.length};});assert.deepEqual(restored,{enabled:true,limit:80,count:1});assert.deepEqual(errors,[]);console.log(JSON.stringify({privateApp,actualChatBothModes:true,offlineMoodHidden:true,refusalLocksPreserved:true,uiAndPersistence:restored,pageErrors:0}));await page.close();
}}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
