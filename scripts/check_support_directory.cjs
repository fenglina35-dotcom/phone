// Actual web/private UI: local support must work without a model, and its paths
// must lead to the shipped controls rather than a plausible-but-stale help page.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 try{for(const privateApp of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(15000);
  if(privateApp)await page.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture-native-unavailable'})};});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+(privateApp?'/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'/小手机.html')+'?northPreview=black-home');
  await page.waitForFunction(()=>window.__northBootReady);
  await page.evaluate(()=>{S.me.locked=false;S.me.active='main';window.testId=S.contacts[0].id;S.settings.chat.key='PRIVATE_CONFIG_SENTINEL';window.supportCalls=[];chatAPI=async(messages)=>{supportCalls.push(messages);throw new Error('offline fixture');};openWeChat('me');});
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('button',{name:'帮助与反馈',exact:true}).click();
  await page.locator('#wxsupport-input').fill('表情包在哪设置');
  await page.locator('#wxsupport-send').click();
  const last=page.locator('#wxsupport-log .bot').last();
  assert.match(await last.innerText(),/设置 → 聊天与媒体 → 角色的表情包/);
  assert.match(await last.innerText(),/笑脸/);assert.match(await last.innerText(),/开发中/);
  for(const question of ['电话频率在哪里调','布置任务在哪里关','温度设置是什么','形象工作室在哪里','智能空调在哪','视频号在哪']){
   await page.locator('#wxsupport-input').fill(question);await page.locator('#wxsupport-send').click();
   assert.doesNotMatch(await last.innerText(),/没有命中|资料不足|正在查阅/);
  }
  assert.equal(await page.evaluate(()=>supportCalls.length),0,'known questions must not call the model');
  await page.locator('#wxsupport-input').fill('全部功能有哪些');await page.locator('#wxsupport-send').click();
  assert.equal(await page.locator('#wxsupport-catalog').evaluate(el=>el.open),true);
  const count=await page.locator('[data-support-index]').count();assert(count>100);
  await page.locator('#wxsupport-search').fill('常用表情包分区');
  const visible=page.locator('[data-support-index]:visible');assert(await visible.count()>0);assert(await visible.count()<count);
  await visible.first().locator('summary').click();
  assert.match(await visible.first().innerText(),/角色/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  const output=process.env.PHONE_SUPPORT_SCREENSHOT;if(output&&!privateApp)await page.screenshot({path:output});
  await page.locator('#wxsupport-search').fill('根本不存在的入口');assert(await page.locator('#wxsupport-empty').isVisible());
  await page.locator('#wxsupport-search').fill('');assert.equal(await visible.count(),count);
  await page.locator('#wxsupport-input').fill('量子传送装置在哪里配置');await page.locator('#wxsupport-send').click();
  await page.waitForFunction(()=>document.querySelector('#wxsupport-send').disabled===false);
  assert.match(await last.innerText(),/没有命中本地/);
  const requests=await page.evaluate(()=>supportCalls);assert.equal(requests.length,1);const payload=JSON.stringify(requests);
  assert(payload.includes('表情包设置')&&payload.includes('微信发现入口'));assert(!payload.includes('PRIVATE_CONFIG_SENTINEL'));
  await page.locator('#wxsupport-input').fill('读取小手机源码和后台密钥');await page.locator('#wxsupport-send').click();
  assert.match(await last.innerText(),/不能提供/);assert.equal(await page.evaluate(()=>supportCalls.length),1);
  // Follow the documented global sticker route in the actual settings screen.
  await page.evaluate(()=>openSettings());
  await page.getByRole('button',{name:/聊天与媒体/}).click();
  await page.getByText('角色的表情包',{exact:true}).click();
  assert(await page.getByRole('button',{name:'管理文件夹',exact:true}).isVisible());
  await page.evaluate(()=>{closeModal();go('contactInfo',{id:testId});});
  await page.getByRole('button',{name:'联系人设置',exact:true}).click();
  await page.getByRole('button',{name:'聊天与主动',exact:false}).click();
  await page.getByText('电话频率',{exact:false}).click();
  assert(await page.locator('#role_call_probability').isVisible());
  await page.evaluate(()=>{closeModal();go('contactSettings',{id:testId});});
  await page.getByRole('button',{name:'资料与记忆',exact:false}).click();
  await page.getByText('人设',{exact:true}).click();
  assert(await page.getByText('常用表情包分区',{exact:true}).isVisible());
  assert(await page.getByText('不让角色发表情包',{exact:true}).isVisible());
  await page.evaluate(()=>{S.couple={cid:testId,startDate:'2026-09-01'};openCouple();});
  await page.getByRole('button',{name:'甜蜜日常',exact:false}).click();
  assert(await page.locator('#cou_tasks').isVisible());
  assert.match(await page.locator('#cou_tasks').innerText(),/默认关闭/);
  await page.evaluate(()=>{closeModal();go('contactInfo',{id:testId});});
  await page.getByRole('button',{name:/朋友资料/}).click();
  assert(await page.getByRole('button',{name:/形象工作室与衣柜/}).isVisible());
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({privateApp,entries:count,localAnswers:true,search:true,actualStickerAndRolePaths:true,modelPrivacy:true}));
  await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
