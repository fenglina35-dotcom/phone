// Real web/private common-life pages. Only model transport and the 190s timer are simulated.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,''));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
  try{for(const privateApp of [false,true]){
    const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false})};});
    await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');
    await page.waitForFunction(()=>window.__northBootReady&&window.DailyEventLedger);
    await page.waitForTimeout(1200);
    await page.evaluate(()=>{
      S.me.locked=false;S.me.active='main';window.testId=S.contacts[0].id;
      const c=getC(testId);c.spy={granted:true};S.couple={cid:c.id};S.settings.replyDelay=0;
      S.settings.chat={base:'https://fixture.invalid/v1',key:'fixture',model:'main',maxTokens:3000,temp:.7};
      S.settings.aux={base:'https://fixture.invalid/v1',key:'fixture',model:'aux'};
      S.settings.chatRoutes=[];chatRoutesInit();aiCoreOn=()=>false;
      for(const role of S.contacts){role.taskOff=true;role.proactive={enabled:false};}
      S.mood=S.contacts.map(role=>({id:uid(),date:todayStr(),who:role.id,emoji:'calm',note:'测试夹具',time:Date.now()}));
      const nativeTimeout=window.setTimeout.bind(window);
      window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===190000?200:ms,...args);
      window.testCalls=[];window.scenario='fallback';
      fetchT=async(url,opt)=>{
        if(!String(url).startsWith('https://fixture.invalid/'))return new Response('false');
        const body=JSON.parse(opt.body);testCalls.push(body);
        if(scenario==='both-timeout'||scenario==='fallback'&&body.model==='main')return new Promise(()=>{});
        let content='【他抬眼看向她，放下手里的杯子，让出身边的位置。】\n吃过就好，过来坐一会儿。',reason='stop';
        if(scenario==='continuation'){
          await new Promise(r=>nativeTimeout(r,120));
          if(testCalls.length===1){content='【他抬眼看向她，放下手里的杯子，让出身边的位置。】\n吃过就好，';reason='length';}
          else content='过来坐一会儿。';
        }
        return new Response(JSON.stringify({choices:[{message:{content},finish_reason:reason}]}),{headers:{'content-type':'application/json'}});
      };
    });
    for(const scenario of ['fallback','continuation','both-timeout']){
      const result=await page.evaluate(async scenario=>{
        window.scenario=scenario;testCalls.length=0;const c=getC(testId),r=cohabRoot();r.enabled=true;r.paused=false;r.cid=c.id;
        const d=cohabData(c.id);d.started=true;d.introSeen=true;d.phase='home';d.nextAt=0;d.pendingArrival=null;d.summaryRounds=0;
        cohabSettings(d).replyApiRoute='follow';cohabSettings(d).replyModel='main';
        d.msgs=[{id:uid(),who:'me',text:'今天已经吃过午饭了',time:Date.now()}];
        S.settings.modelOutputUnfiltered=false;_off={id:c.id,mode:'cohab',busy:false};go('off',{id:c.id,mode:'cohab'});
        await offAI();
        const result={scenario,calls:testCalls.map(x=>x.model),rows:d.msgs.filter(x=>x.who!=='me').map(x=>x.text),busy:_off.busy,visible:document.body.innerText};
        cohabModelDiagnosticOpen(c.id);result.diagnostics=document.body.innerText;closeModal();return result;
      },scenario);
      assert.equal(result.busy,false,JSON.stringify(result));
      assert.deepEqual(result.calls,scenario==='continuation'?['main','main']:['main','aux'],JSON.stringify(result));
      if(scenario==='both-timeout'){
        assert.equal(result.rows.length,0,JSON.stringify(result));assert.match(result.diagnostics,/单次请求超时/);
        assert.match(result.diagnostics,/单次等待上限/);assert.doesNotMatch(result.visible,/检查地址、密钥和模型名/);
      }else{
        assert.equal(result.rows.filter(x=>x.includes('吃过就好')).length,1,JSON.stringify(result));
        assert.match(result.visible,/吃过就好/);assert.match(result.visible,/过来坐一会儿/);
      }
      console.log(JSON.stringify({privateApp,scenario,calls:result.calls,visibleReply:result.rows.length>0,busyReleased:true,pageErrors:errors.length}));
    }
    assert.deepEqual(errors,[]);await page.close();
  }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
