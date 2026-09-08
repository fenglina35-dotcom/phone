// Local browser regression. Only server transport is stubbed; never call user services.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage({viewport:{width:430,height:900},timezoneId:'America/Los_Angeles'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');
  await page.waitForFunction(()=>window.__northBootReady);
  const clocks=await page.evaluate(()=>{
   S.me.active='main';S.me.locked=false;const c=S.contacts[0];window.fixtureRoleId=c.id;
   S.messages[c.id]=[{id:uid(),role:'user',type:'text',content:'时间测试用户',time:Date.parse('2026-09-08T16:00:00Z')},{id:uid(),role:'assistant',type:'text',content:'时间测试角色',time:Date.parse('2026-09-08T16:00:02Z')}];
   S.settings.beijingMessageTimes=false;openChat(c.id);const before=document.querySelectorAll('.beijing-message-time').length;
   messageBeijingTimeToggle();const times=[...document.querySelectorAll('.beijing-message-time')].map(n=>({text:n.textContent,display:getComputedStyle(n).display}));
   messageBeijingTimeToggle();const after=document.querySelectorAll('.beijing-message-time').length;
   return{before,after,times};
  });
  assert.equal(clocks.before,0);assert.equal(clocks.after,0);assert.deepEqual(clocks.times.map(x=>x.text),['2026-09-09 00:00:00 北京时间','2026-09-09 00:00:02 北京时间']);assert(clocks.times.every(x=>x.display!=='none'));
  if(privateApp){
   const result=await page.evaluate(async()=>{
    const c=getC(fixtureRoleId),ack=[];S.couple={cid:c.id};S.messages[c.id]=[];
    c.proactive={serverPush:true,enabled:true};gateOK=()=>true;privateCompanionAppOn=()=>true;roleServerPushSyncEnabled=async()=>{};roleServerPushDeliveryBlocked=()=>false;
    const body='I cannot fulfill this request. I am programmed to be a helpful and harmless AI assistant. My safety guidelines prohibit this content.\n[来电|语音]\n[送礼|热茶|10|暖暖手]';
    let source=[],actions=0;const originalAction=roleServerPushApplyAction;roleServerPushApplyAction=async(...args)=>{actions++;return originalAction(...args);};
    companionRpc=async(name,args)=>{if(name==='phone_role_push_pull')return source;if(name==='phone_role_push_ack'){ack.push(...args.p_ids);return true;}throw Error('Unexpected test RPC '+name);};
    for(const raw of [false,true]){S.settings.modelOutputUnfiltered=raw;_roleServerPushPullAt=0;source=[{id:'refusal-'+raw,roleId:c.id,body,createdAt:new Date().toISOString(),triggerKind:'scheduled'}];if(!await roleServerPushPull(true))throw Error('pull failed');}
    const rejected=msgs(c.id).length,diagnostic=c._privateBackgroundModelError&&c._privateBackgroundModelError.code;
    _roleServerPushPullAt=0;source=[{id:'normal-reply',roleId:c.id,body:'我不同意，我们换个话题。',createdAt:new Date().toISOString(),triggerKind:'scheduled',pushStatus:'sent'}];await roleServerPushPull(true);
    const normal=msgs(c.id).filter(m=>m.role==='assistant').map(m=>m.content);const before=msgs(c.id).length;
    _roleServerPushPullAt=0;await roleServerPushPull(true);
    await saveNowAsync();return{rejected,diagnostic,normal,replaySafe:before===msgs(c.id).length,actions,ack,busy:_roleServerPushPullBusy};
   });
   assert.equal(result.rejected,0);assert.equal(result.diagnostic,'private-model-refusal');assert.equal(result.actions,0);assert.equal(result.busy,false);assert(result.replaySafe);assert.deepEqual(result.normal,['我不同意，我们换个话题。']);assert(result.ack.includes('refusal-true')&&result.ack.includes('refusal-false'));
   await page.goto(page.url().split('?')[0]);await page.waitForFunction(()=>window.__northBootReady);
   assert.equal(await page.evaluate(()=>S.contacts[0]._privateBackgroundModelError.code),'private-model-refusal');
   console.log(JSON.stringify({privateApp,clocks,result,persisted:true}));
  }else console.log(JSON.stringify({privateApp,clocks}));
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
