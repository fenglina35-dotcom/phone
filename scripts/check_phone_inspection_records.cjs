// Execute actual inspection and prompt construction; only the remote model is simulated.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const entry=privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html';
  await page.goto(origin+entry+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{
   S.me.locked=false;S.me.active='main';const c=S.contacts[0];window.testId=c.id;c.spy={granted:true,loc:false};c.proactive={enabled:false};
   S.contacts=[c,{id:'inspection-other',name:'乙',relation:'朋友'}];S.groups=[];S.moments=[{id:'p',authorId:'inspection-other',text:'朋友动态',time:1,likes:[S.me.name],comments:[{id:'c1',cid:'me',name:S.me.name,text:'OLD_COMMENT',time:2}]}];
   S.messages['inspection-other']=[{id:'one',role:'user',type:'text',content:'OLD_CHAT',time:1}];
   S.settings.chat={base:'https://fake.invalid/v1',key:'fixture',model:'fixture',maxTokens:2000,temp:.7};S.settings.replyDelay=0;aiCoreOn=()=>false;sleep=async()=>{};
   window.inspectionCalls=[];window.inspectionFail=false;window.inspectionN=0;
   fetchT=async(url,opt)=>{if(!String(url).startsWith('https://fake.invalid/'))return{ok:true,json:async()=>false,text:async()=>'false'};inspectionCalls.push(JSON.parse(opt.body));if(inspectionFail)throw Error('simulated provider failure');return{ok:true,json:async()=>({choices:[{message:{content:'核对完成 '+(++inspectionN)+'，我们接着聊。'},finish_reason:'stop'}]})};};openChat(testId);
  });
  async function inspect(focus){return page.evaluate(async focus=>{inspectionCalls.length=0;const ok=await doSpyViewCore(testId,true,{intent:true,bySheTold:true,forceResult:true,focus});const body=inspectionCalls[0];return{ok,calls:inspectionCalls.length,note:body?.messages?.at(-1)?.content||'',system:body?.messages?.[0]?.content||'',facts:rolePhoneLocalRead(testId,rolePhoneLocalScope(focus)).records.length};},focus);}
  let r=await inspect('微信聊天');assert(r.ok);assert.match(r.note,/OLD_CHAT/);assert.doesNotMatch(r.system,/OLD_CHAT/);
  r=await inspect('微信聊天');assert(r.ok);assert.match(r.note,/没有新的内容/);assert.doesNotMatch(r.note,/OLD_CHAT/);
  await page.evaluate(()=>S.messages['inspection-other'].push({id:'two',role:'user',type:'text',content:'NEW_CHAT',time:1}));
  r=await inspect('微信聊天');assert(r.ok);assert.match(r.note,/NEW_CHAT/);assert.doesNotMatch(r.note,/OLD_CHAT/);
  r=await inspect('朋友圈');assert(r.ok);assert.match(r.note,/OLD_COMMENT/);
  await page.evaluate(()=>S.moments[0].comments.push({id:'c2',cid:'me',name:S.me.name,text:'NEW_COMMENT',time:2}));
  r=await inspect('朋友圈');assert(r.ok);assert.match(r.note,/NEW_COMMENT/);assert.doesNotMatch(r.note,/OLD_COMMENT|点了赞/);
  await page.evaluate(()=>{S.messages['inspection-other'].push({id:'retry',role:'user',type:'text',content:'RETRY_UNREAD',time:3});inspectionFail=true;});
  r=await inspect('微信聊天');assert(!r.ok);assert(r.facts>0);
  await page.evaluate(()=>inspectionFail=false);r=await inspect('微信聊天');assert(r.ok);assert.match(r.note,/RETRY_UNREAD/);
  const replyDisplay=await page.evaluate(()=>{const p={id:'display',comments:[{name:'甲',cid:testId,replyToName:'乙',text:'收到'}]};return ['feed','detail'].map(kind=>momentSocialHTML(p,kind));});
  for(const html of replyDisplay){assert.doesNotMatch(html,/@<b>/);assert.match(html,/回复<\/span><b>乙<\/b>/);assert.match(html,/momentCommentFocus/);}
  const cohab=await page.evaluate(async()=>{
   const d=cohabData(testId);d.settings.model='main';inspectionCalls.length=0;
   S.messages['inspection-other'].push({id:'cohab-new',role:'user',type:'text',content:'COHAB_NEW_RECORD',time:4});
   const before=d.msgs.length,ok=await cohabPhoneDeliverFact(testId,'微信聊天',spyFocusData(testId,'微信聊天'),{forceResult:true});
   return{ok,delivered:d.msgs.length>before,request:inspectionCalls.map(x=>x.messages.at(-1).content).join('\n'),unread:rolePhoneLocalRead(testId,'wechat').records.length};
  });
  assert(cohab.ok&&cohab.delivered,JSON.stringify(cohab));assert.match(cohab.request,/COHAB_NEW_RECORD/);assert.equal(cohab.unread,0);
  r=await inspect('微信聊天');assert.match(r.note,/没有新的内容/);assert.doesNotMatch(r.note,/COHAB_NEW_RECORD/);
  assert.equal(await page.evaluate(()=>saveNowAsync()),true);await page.goto(origin+entry);await page.waitForFunction(()=>window.__northBootReady);
  const restored=await page.evaluate(()=>{const id=S.contacts[0].id;return{wechat:rolePhoneLocalRead(id,'wechat').records.length,moments:rolePhoneLocalRead(id,'moments').records.length,status:rolePhoneLocalStatus(getC(id)),debug:rolePhoneLocalRead(id,'overview').data,seen:getC(id)._phoneInspectionSeen};});
  assert.equal(restored.wechat,0,JSON.stringify(restored));assert.equal(restored.moments,0,JSON.stringify(restored));assert.deepEqual(errors,[]);
  console.log(JSON.stringify({privateApp,repeatSuppressed:true,newRecordsOnly:true,failedReplyRetried:true,persisted:true,pageErrors:errors.length}));await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
