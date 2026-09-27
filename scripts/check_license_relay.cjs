const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,''));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(f)]||'application/octet-stream')+';charset=utf-8');res.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const priv of [false,true]){
  const page=await browser.newPage({viewport:{width:430,height:900}});const calls=[];
  await page.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin===origin)return r.continue();
   if(u.origin==='https://license.smallphoneapp.com'){
    const body=r.request().postDataJSON();calls.push(body.action);
    const payload=body.action==='activate'?{ok:true,session:{token:'fixture-token',licenseId:'original-admin-license',sessionId:'original-admin-session'}}:body.action==='session_check'?{ok:true,valid:true,sessionCount:1}:{ok:false,error:'fixture: optional setup unavailable'};
    return r.fulfill({status:payload.ok?200:400,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify(payload)});
   }
   return r.abort('connectionreset');
  });
  await page.goto(origin+(priv?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html'));
  await page.waitForFunction(()=>window.__northBootReady);
  await page.locator('#gateInp').fill('YB2-FIXTURE');await page.locator('#gateBtn').click();await page.waitForFunction(()=>!document.getElementById('gate'));
  const session=await page.evaluate(()=>NorthLicense.session());assert.equal(session.licenseId,'original-admin-license');assert.equal(session.endpointId,'license-failover');assert.equal(calls.filter(x=>x==='activate').length,1);
  await page.reload();await page.waitForFunction(()=>window.__northBootReady);assert.equal(await page.locator('#gate').count(),0);
  assert.equal((await page.evaluate(()=>NorthLicense.session())).licenseId,'original-admin-license');
  await page.screenshot({path:path.join(process.env.TEMP,priv?'phone-v1333-license-private.png':'phone-v1332-license-web.png')});
  console.log(JSON.stringify({runtime:priv?'private-bundle':'web',entered:true,activationRequests:1,backendIdentity:'license-failover',sessionSurvivedReload:true}));await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
