// Check the real phone grid, empty-phone shortcut and persistence, including extracted packages.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const privateApp=process.argv.includes('--private');
const server=http.createServer((req,res)=>{const p=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(p)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(p));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false})};});
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+'/小手机.html?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady&&window.DailyEventLedger);await page.waitForTimeout(1200);
  await page.evaluate(()=>{S.me.locked=false;S.me.active='main';window.testId=S.contacts[0].id;const c=getC(testId);S.couple={cid:c.id};c.spy={granted:true};_spyUnlock[testId]=true;S.spy=S.spy||{};delete S.spy[testId];_spyApp=null;go('spy',{id:testId});});
  await page.getByRole('button',{name:'打开日常事件簿',exact:true}).click();
  const toggle=page.getByRole('checkbox',{name:'自动记录日常事件'});await toggle.waitFor();assert.equal(await toggle.isChecked(),false);await toggle.check();
  await page.getByRole('spinbutton',{name:'事件记录上限'}).fill('80');await page.getByRole('spinbutton',{name:'事件记录上限'}).blur();
  await page.evaluate(()=>{S.spy[testId]={time:Date.now(),location:'家里'};_spyApp=null;render();});
  const icons=await page.evaluate(()=>{const tiles=[...document.querySelectorAll('[onclick]')],icon=k=>tiles.find(x=>(x.getAttribute('onclick')||'').includes(",\u0027"+k+"\u0027)"))?.querySelector('svg')?.outerHTML;return{events:icon('events'),grudge:icon('grudge')};});
  assert(icons.events);assert.equal(icons.events,icons.grudge);
  await page.screenshot({path:path.join(process.env.TEMP||root,`event-grid-${privateApp?'private':'web'}.png`)});
  await page.locator('[onclick]').filter({hasText:/^日常事件簿$/}).filter({has:page.locator('svg')}).click();assert(await toggle.isChecked());
  await page.evaluate(()=>saveNowAsync());await page.goto(origin+'/小手机.html');await page.waitForFunction(()=>window.__northBootReady&&window.DailyEventLedger);
  const saved=await page.evaluate(()=>{const s=DailyEventLedger.state(S.contacts[0]);return{enabled:s.enabled,limit:s.limit};});assert.deepEqual(saved,{enabled:true,limit:80});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({root,privateApp,emptyPhoneEntry:true,gridEntry:true,sameLineIconAsGrudge:true,saved,pageErrors:0}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
