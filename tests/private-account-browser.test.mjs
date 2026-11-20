import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import {ROOT,PRIV_DIR,read} from './_helpers.mjs';
import {createSyncHandler} from '../supabase/functions/phone-device-sync/core.mjs';

// This mounts the shipped private HTML and all its real adapters. Only the native
// transport/provider HTTP boundaries are fixtures; prompt, persistence, journal,
// compositor and manual-reply code remain the production implementation.
test('private HTML account sync: real hydration, secondary manual tools, stable composer and account switch',async()=>{
 const require=createRequire(import.meta.url),{chromium}=require('playwright');
 const {PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite(),ownerA='10000000-0000-0000-0000-000000000001',ownerB='10000000-0000-0000-0000-000000000002';
 const codecVM=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob});
 vm.runInContext(read(PRIV_DIR+'private-device-sync.js'),codecVM);
 const core=codecVM.NorthPrivateDeviceSyncCore,identity={
  sourceA:{userID:ownerA,sessionID:'20000000-0000-0000-0000-000000000001'},
  sourceB:{userID:ownerB,sessionID:'20000000-0000-0000-0000-000000000002'},
  browserA:{userID:ownerA,sessionID:'20000000-0000-0000-0000-000000000003'},
  browserB:{userID:ownerB,sessionID:'20000000-0000-0000-0000-000000000004'},
  spareA:{userID:ownerA,sessionID:'20000000-0000-0000-0000-000000000005'}
 };
 const nativeCalls=[],modelCalls=[],toolCalls=[],errors=[],sources=[],objects=new Map();let authOutage=false,modelMode='ordinary',fixtureConnectionId='',browser,holdResolve=false,resolveSignal,resolveRelease;
 const store={async changed(owner,after){return (await db.query("select seq from private_phone_sync_records where user_id=$1 and seq>$2 and (record_key like 'state/sync2/%' or record_key like 'blob/sync2/%') limit 1",[owner,after])).rows.length>0;},async key(owner,candidate){await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[owner,candidate]);return(await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[owner])).rows[0].wrapped_key;},
  async rpc(name,args){return(await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=>$'+(i+1)).join(',')+') value',Object.values(args).map(x=>Array.isArray(x)?JSON.stringify(x):x))).rows[0].value;},async putBlob(key,value){objects.set(key,value);},async getBlob(key){return objects.get(key);}};
 const backend=createSyncHandler({store,authenticate:async token=>identity[token],verifyPassword:async(_,password)=>password==='fixture-correct-password',masterKey:'b'.repeat(43),cryptoAPI:webcrypto});
 async function transport(token,body){return(await backend(new Request('https://fixture.invalid/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({protocolVersion:2,...body})}))).json();}
 async function bodyOf(req){let text='';for await(const part of req)text+=part;return JSON.parse(text);}
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__native'){
   const {token,action,body}=await bodyOf(req);nativeCalls.push({token,action,body});let result={ok:false,error:'fixture_unsupported'};
   if(action==='account.status')result={ok:true,loggedIn:true,userId:identity[token].userID,maskedPhone:token==='browserA'?'138****0001':'138****0002'};
   else if(action==='account.sync')result=authOutage?{ok:false,code:'account_auth_timeout',message:'账号认证服务器响应超时；登录凭证仍保留在本机'}:await transport(token,body);
   else if(action==='account.password.signin')result={ok:false,code:'account_auth_timeout',message:'账号认证服务器响应超时；登录凭证仍保留在本机'};
   else if(action==='account.mcp'&&body.action==='list')result={ok:true,connections:[],nextCursor:null};
   else if(action==='account.sync.ui')result={ok:true};
   if(action==='account.sync'&&body.action==='resolve'&&holdResolve){holdResolve=false;await new Promise(resolve=>{resolveRelease=resolve;resolveSignal();});}
   if(action==='account.sync'&&body.action.startsWith('media.'))nativeCalls.at(-1).result={ok:result.ok,error:result.error};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  const file=path.resolve(ROOT,decodeURIComponent(url.pathname).replace(/^\//,''));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream'));
  res.end(file.endsWith('private-device-sync-client.js')||process.env.FIX_TEST_OLD==='1'&&/\.(?:js|html)$/.test(file)?read(path.relative(ROOT,file)):fs.readFileSync(file));
 }catch(error){res.writeHead(500);res.end(String(error));}});
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;insert into auth.users values('${ownerA}'),('${ownerB}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));
  await db.exec(read('supabase/migrations/202611170003_private_phone_primary_device.sql'));
  await db.exec(read('supabase/migrations/202611190001_private_phone_primary_writes.sql'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
  // Use a real default state/role as the schema baseline, without enabling sync.
  const probe=await browser.newPage();await probe.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await probe.addInitScript(()=>{window.__SMALL_PHONE_PRIVATE__=true;window.SmallPhoneNative={request:async()=>({ok:false,error:'fixture_unsupported'})};});
  await probe.goto(origin+'/'+PRIV_DIR+'index.html?northPreview=black-home');await probe.waitForFunction(()=>window.__northBootReady);
  const baseline=await probe.evaluate(()=>({state:defState(),role:S.contacts[0],storageKey:KEY}));await probe.close();
  assert(baseline.role,'the browser schema fixture includes a real role');
  function fixture(owner,name){const state=structuredClone(baseline.state),role=structuredClone(baseline.role);role.id=owner===ownerA?'cloud-a':'cloud-b';role.name=name;role.remark='';role.persona='你是受控账号同步测试角色，用中文简短回复。';role.proactive={enabled:true};role.spy={granted:false};
   state.contacts=[role];state.messages={[role.id]:[{id:'history-'+role.id,role:'assistant',type:'text',content:name+'的云端历史消息',time:Date.now()-60000}]};state.me.name='测试本人';state.me.locked=false;state.me.active='main';state.settings.chat={base:'https://model-fixture.invalid/v1',key:'fixture-only',model:'fixture',maxTokens:4096,temp:.7};state.settings.chatRoutes=[];state.settings.replyDelay=0;state.settings.sound=false;state.settings.manualReply=true;state.settings.timeAware=false;state.settings.memoryFreq=0;return state;}
  async function seed(token,state){let saved=null;const codec=core.createStateCodec(),owner=identity[token].userID;
   codec.setLocalProjection(await codec.project(state));
   const journal=core.createJournal({owner,platform:'iOS',label:'受控源手机',getOwner:()=>owner,canPublish:()=>true,transport:body=>transport(token,body),storage:{read:async()=>saved,write:async(_,value)=>{saved=value;}},snapshot:async()=>{const projected=await codec.project(state);codec.setLocalProjection(projected);return projected;},apply:async rows=>{codec.accept(rows);const next=await codec.materialize();if(next.complete){for(const key of Object.keys(state))delete state[key];Object.assign(state,next.state);}}});
   sources.push(journal);await journal.inspect();await journal.seed(false);while(await journal.flush(4)){}await journal.seed(true);return {journal,state,codec};
  }
  const source=await seed('sourceA',fixture(ownerA,'云端角色甲'));await seed('sourceB',fixture(ownerB,'云端角色乙'));
  const initialImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4l0AAAAASUVORK5CYII=';
  source.state.me.homeBg='idb:fixture-first-home';source.state.me.lockBg='idb:fixture-first-home';source.state.me.appIcons={...source.state.me.appIcons,wechat:'idb:fixture-first-icon'};
  for(const key of ['fixture-first-home','fixture-first-icon']){
   const bytes=new TextEncoder().encode(initialImage),hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
   const uploaded=await transport('sourceA',{action:'media.put',deviceId:source.journal.state().deviceId,hash,base64:Buffer.from(bytes).toString('base64url')});assert.equal(uploaded.ok,true);
   await source.codec.addMediaManifest({localKey:key,type:'string',bytes:bytes.length,hash,parts:[hash]});
  }
  await source.journal.flush();

  const page=await browser.newPage({viewport:{width:430,height:900}});page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({origin,owner})=>{
   window.__SMALL_PHONE_PRIVATE__=true;window.__SMALL_PHONE_MAC__=true;window.__SMALL_PHONE_ACCOUNT_SYNC__=true;window.__SMALL_PHONE_NATIVE_ACCOUNT__={loggedIn:true,userId:owner};window.__SMALL_PHONE_LEGACY_OWNER__='';window.fixtureToken='browserA';
   window.SmallPhoneNative={request:async(action,body={})=>(await fetch(origin+'/__native',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:window.fixtureToken,action,body})})).json()};
  },{origin,owner:ownerA});
  await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());
   if(url.origin===origin)return route.continue();
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'*'}});
   if(url.hostname==='model-fixture.invalid'){
    const body=request.postDataJSON();modelCalls.push(body);const done=body.messages.some(x=>String(x.content).includes('[外部工具真实回执'));
    const content=modelMode==='mcp'&&!done?JSON.stringify({mcp_call:{tool:fixtureConnectionId+'__read_doc',arguments:{query:'花店'}}}):modelMode==='mcp'?'工具查到了花店记录。':modelMode==='offline'?'认证超时期间仍能正常回复。':'手动微信回复成功。';
    return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({choices:[{message:{content},finish_reason:'stop'}]})});
   }
   if(url.hostname==='mcp-fixture.invalid'){
    const body=request.postDataJSON();toolCalls.push(body);const result=body.method==='initialize'?{protocolVersion:'2025-11-25',capabilities:{tools:{}}}:body.method==='tools/list'?{tools:[{name:'read_doc',description:'读取文档',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']},annotations:{readOnlyHint:true}}]}:{content:[{type:'text',text:'受控真实工具结果：花店记录'}]};
    return route.fulfill({status:body.method==='notifications/initialized'?202:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:body.method==='notifications/initialized'?'':JSON.stringify({jsonrpc:'2.0',id:body.id,result})});
   }
   return route.abort();
  });
  await page.goto(origin+'/'+PRIV_DIR+'index.html');
  try{await page.waitForFunction(()=>window.__northBootReady&&window.NorthPrivateDeviceSyncClient?.status().ready&&S.contacts.some(x=>x.id==='cloud-a'),null,{timeout:15000});}catch(error){console.log('initial sync diagnostic',JSON.stringify({errors,native:nativeCalls.slice(-12).map(x=>({action:x.action,sync:x.body.action})),state:await page.evaluate(()=>({boot:window.__northBootReady,finished:_appBootFinished,status:window.NorthPrivateDeviceSyncClient?.status(),roles:S.contacts.map(x=>x.id),ref:_coreBootRef&&{savedAt:_coreBootRef.savedAt,discover:_coreBootRef.discover,accountSwitch:_coreBootRef.accountSwitch},screen:document.body.innerText.slice(0,700)}))}));throw error;}
  assert.deepEqual(await page.evaluate(()=>S.contacts.map(x=>x.id)),['cloud-a'],'only the cloud roles are shown, with no default fixture roles');
  assert(await page.evaluate(()=>NorthPrivateDeviceSyncClient.status().secondary));
  await page.waitForFunction(()=>_imgCache['fixture-first-home']&&_imgCache['fixture-first-icon'],null,{timeout:8000});
  assert.equal(await page.evaluate(()=>_imgCache['fixture-first-home']),initialImage,'first remote hydration restores home/lock wallpaper without a manual image getter');
  assert.equal(await page.evaluate(()=>_imgCache['fixture-first-icon']),initialImage,'first remote hydration restores customized icons');
  await page.waitForFunction(()=>document.getElementById('homeDesktop')?.style.backgroundImage.includes('data:image/')&&Array.from(document.querySelectorAll('.custom-app-icon img')).some(img=>img.complete&&img.naturalWidth===1),null,{timeout:8000});
  source.state.me.homeBg='idb:fixture-late-home';source.state.me.lockBg='idb:fixture-late-home';await source.journal.flush();
  await page.evaluate(async()=>{await NorthPrivateDeviceSyncClient.syncNow();await NorthPrivateDeviceSyncClient.waitForIdle();});
  assert.equal(await page.evaluate(()=>!!_imgCache['fixture-late-home']),false,'a missing future manifest is not replaced with an empty image');
  const lateBytes=new TextEncoder().encode(initialImage),lateHash=Buffer.from(await webcrypto.subtle.digest('SHA-256',lateBytes)).toString('hex');
  await source.codec.addMediaManifest({localKey:'fixture-late-home',type:'string',bytes:lateBytes.length,hash:lateHash,parts:[lateHash]});await source.journal.flush();
  await page.evaluate(async()=>{await NorthPrivateDeviceSyncClient.syncNow();await NorthPrivateDeviceSyncClient.waitForIdle();});
  try{await page.waitForFunction(()=>!!_imgCache['fixture-late-home']&&document.getElementById('homeDesktop')?.style.backgroundImage.includes('data:image/'),null,{timeout:8000});}catch(error){console.log('late media diagnostic',JSON.stringify({errors,sourceHome:source.state.me.homeBg,sourceLock:source.state.me.lockBg,client:await page.evaluate(()=>({status:NorthPrivateDeviceSyncClient.status(),home:S.me.homeBg,manifest:!!NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('fixture-late-home'),cache:!!_imgCache['fixture-late-home']}))}));throw error;}


  await page.evaluate(()=>{S.me.locked=false;renderLockScreen();});
  await page.evaluate(()=>openChat('cloud-a'));await page.locator('#chatbg').getByText('云端角色甲的云端历史消息',{exact:true}).waitFor();
  const input=page.locator('#cinput');await input.fill('尚未发送的草稿');await input.focus();
  await page.evaluate(()=>{window.fixtureComposer=document.querySelector('#cinput');});
  await page.evaluate(async()=>{await NorthPrivateDeviceSyncClient.syncNow();await NorthPrivateDeviceSyncClient.waitForIdle();});
  assert(await page.evaluate(()=>fixtureComposer===document.querySelector('#cinput')&&document.activeElement===fixtureComposer&&fixtureComposer.value==='尚未发送的草稿'),'unchanged poll preserves the focused composer');
  source.state.messages['cloud-a'].push({id:'remote-new',role:'assistant',type:'text',content:'另一设备新增的消息',time:Date.now()});await source.journal.flush();
  await page.evaluate(async()=>{await NorthPrivateDeviceSyncClient.syncNow();await NorthPrivateDeviceSyncClient.waitForIdle();});
  await page.locator('#chatbg').getByText('另一设备新增的消息',{exact:true}).waitFor();
  assert(await page.evaluate(()=>fixtureComposer===document.querySelector('#cinput')&&document.activeElement===fixtureComposer&&fixtureComposer.value==='尚未发送的草稿'),'remote arrival preserves draft, node and focus');
  await input.fill('同步后回车发送验证');await input.press('Enter');await page.locator('#chatbg').getByText('同步后回车发送验证',{exact:true}).waitFor({timeout:5000});assert.equal(modelCalls.length,0,'sending after remote publication keeps manual-reply mode');
  await page.evaluate(()=>openSettings('data'));
  await page.getByText('额外备份与恢复',{exact:true}).click();
  await page.evaluate(()=>{window.fixtureRefreshContext=NorthPrivateDeviceSyncClient.context();});
  await page.evaluate(()=>privatePhoneAccountRefresh(false));
  assert(await page.evaluate(()=>NorthPrivateDeviceSyncClient.context()===fixtureRefreshContext),'refreshing the same account never destroys the active synchronization or reply context');
  assert(await page.locator('details').filter({has:page.locator('#privateAccountRecovery')}).evaluate(node=>node.open),'refresh keeps extra backup and recovery expanded');
  await page.evaluate(()=>privatePhoneAccountRefresh(false));assert(await page.locator('details').filter({has:page.locator('#privateAccountRecovery')}).evaluate(node=>node.open));
  await page.evaluate(()=>go('settings'));await page.waitForTimeout(1200);await page.evaluate(()=>NorthPrivateDeviceSyncClient.syncNow());
  assert.equal(modelCalls.length,0,'secondary idle and settings produce zero automatic model calls');
  await page.evaluate(()=>openChat('cloud-a'));await page.locator('#cinput').fill('请给我一句回复');await page.locator('#cinput').evaluate(input=>sendText(input._chatId));
  await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();await page.locator('#chatbg').getByText('手动微信回复成功。',{exact:true}).waitFor({timeout:30000});
  await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));assert.equal(modelCalls.length,1,'the manual secondary-device turn submits exactly one model request');
  // Explicitly asking for another reply to the same message is a new manual
  // attempt, not another physical device and not an automatic model replay.
  await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();
  await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));
  assert.equal(modelCalls.length,2,'a completed cloud turn must not block an explicit second manual reply on the same device');
  // Persist the exact lease owned by this device, then simulate a process
  // interruption after acquisition. The next manual attempt may release that
  // precise old lease, but must never clear an unknown/foreign lease.
  await page.evaluate(async()=>{const ctx=NorthPrivateDeviceSyncClient.context(),threadKey=await NorthPrivateDeviceSyncCore.hash(['main','cloud-a']),old={deviceId:ctx.journal.state().deviceId,threadKey,turnKey:'interrupted-local-turn',leaseToken:crypto.randomUUID()};await SmallPhoneNative.request('account.sync',{...old,action:'turn.acquire'});await new Promise((resolve,reject)=>{const open=indexedDB.open('smallphone-account-sync-v2-'+ctx.owner,1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put(old,'__device_sync_v2_'+ctx.owner+'_turn_'+threadKey);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});});
  await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));
  assert.equal(modelCalls.length,3,'the exact persisted local lease is recovered without waiting three minutes');
  await page.evaluate(()=>{window.fixtureLocalLockStarted=false;window.fixtureLocalLock=navigator.locks.request('smallphone-reply:'+NorthPrivateDeviceSyncClient.status().owner+':main:cloud-a',()=>{fixtureLocalLockStarted=true;return new Promise(resolve=>{window.fixtureReleaseLocalLock=resolve;});});});
  await page.waitForFunction(()=>fixtureLocalLockStarted);await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));
  assert.equal(modelCalls.length,3,'a live local window lock cannot be mistaken for an abandoned local lease');
  await page.evaluate(async()=>{fixtureReleaseLocalLock();await fixtureLocalLock;});
  const foreignLease={deviceId:source.journal.deviceId(),threadKey:await core.hash(['main','cloud-a']),turnKey:'active-foreign-turn',leaseToken:webcrypto.randomUUID()};
  assert.equal((await transport('sourceA',{...foreignLease,action:'turn.acquire'})).acquired,true);
  await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));
  assert.equal(modelCalls.length,3,'an active foreign-device lease cannot be stolen or trigger another model call');
  assert.equal((await transport('sourceA',{...foreignLease,action:'turn.renew'})).acquired,true);
  await transport('sourceA',{...foreignLease,action:'turn.finish',completed:false});
  await page.evaluate(()=>{window.fixtureLocks=navigator.locks;Object.defineProperty(navigator,'locks',{configurable:true,value:{request:()=>Promise.reject(new DOMException('opaque origin','SecurityError'))}});});
  await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));assert.equal(modelCalls.length,4,'WebKit without usable Web Locks still allows a normal manual reply without stealing a lease');
  await page.evaluate(()=>Object.defineProperty(navigator,'locks',{configurable:true,value:fixtureLocks}));
  fixtureConnectionId=await page.evaluate(async()=>{const c=MCPTools.add({name:'受控资料',url:'https://mcp-fixture.invalid/mcp',auth:'none'});await MCPTools.connect(c.id);MCPTools.setRole(c.id,'cloud-a',true);return c.id;});assert(fixtureConnectionId);
  modelMode='mcp';await page.locator('#cinput').fill('请查外部花店文档');await page.locator('#cinput').evaluate(input=>sendText(input._chatId));await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();
  await page.locator('.mcp-approval').waitFor();assert.equal(toolCalls.filter(x=>x.method==='tools/call').length,0,'read-only waits for approval');await page.locator('.mcp-approval').getByRole('button',{name:'允许本次',exact:true}).click();
  await page.locator('#chatbg').getByText('工具查到了花店记录。',{exact:true}).waitFor({timeout:30000});await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));
  assert.equal(toolCalls.filter(x=>x.method==='tools/call').length,1);assert.equal(modelCalls.length,6,'the manual MCP turn has one selection and one final response');
  assert(await page.locator('.mcp-chat-trace[data-mcp-state=ok]').isVisible());assert(!(await page.locator('#chatbg').innerText()).includes('mcp_call'));
  // An existing account reloads and manually chats through a background Auth
  // outage. The shipped local persistence and model path are not replaced.
  await page.evaluate(id=>MCPTools.setRole(id,'cloud-a',false),fixtureConnectionId);
  authOutage=true;modelMode='offline';await page.reload();
  await page.waitForFunction(()=>window.__northBootReady&&NorthPrivateDeviceSyncClient?.status().phase==='network'&&NorthPrivateDeviceSyncClient.gateAllowed(),null,{timeout:10000});
  assert.equal(await page.locator('#privateSyncConnectionNotice').count(),0,'background account failures never create a global banner');
  await page.evaluate(()=>{S.me.locked=false;renderLockScreen();openSettings('data');});
  await page.waitForFunction(()=>document.querySelector('#privateSyncAccountStatus')?.textContent.includes('超时'));
  assert(await page.locator('#set_private_account').isVisible(),'connection details are readable inside authorization and data');
  await page.evaluate(()=>go('home'));assert.equal(await page.locator('#privateSyncAccountStatus').count(),0,'leaving settings removes the status from view');
  assert.equal(await page.locator('#privatePhoneNumber').count(),0,'a timeout does not replace the account view with login');
  await page.evaluate(()=>privatePhoneAccountBindOpen());await page.locator('#privatePhoneNumber').fill('13800000001');await page.locator('#privatePhonePassword').fill('fixture-password');
  await page.evaluate(()=>privatePhoneAccountPasswordLogin());await page.waitForTimeout(1300);
  assert((await page.locator('#privatePhoneLoginNote').innerText()).includes('超时'),'login errors remain readable');assert.equal(await page.locator('[data-private-auth-submit]').first().isDisabled(),false);await page.evaluate(()=>closeModal());
  await page.evaluate(()=>{S.me.locked=false;renderLockScreen();openChat('cloud-a');});
  await page.locator('#cinput').fill('断线期间继续聊天');await page.locator('#cinput').evaluate(input=>sendText(input._chatId));await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();
  await page.locator('#chatbg').getByText('认证超时期间仍能正常回复。',{exact:true}).waitFor({timeout:15000});await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));assert.equal(modelCalls.length,7,'one manual local reply is never retried by synchronization');
  await page.reload();await page.waitForFunction(()=>window.__northBootReady&&NorthPrivateDeviceSyncClient?.gateAllowed(),null,{timeout:10000});assert(await page.evaluate(()=>S.messages['cloud-a'].some(x=>x.content==='认证超时期间仍能正常回复。')),'the offline reply survives reopening');
  authOutage=false;await page.evaluate(()=>NorthPrivateDeviceSyncClient.syncNow());await page.waitForFunction(()=>NorthPrivateDeviceSyncClient.status().phase==='ready',null,{timeout:10000});await source.journal.cycle();
  assert(!source.state.messages['cloud-a'].some(x=>x.content==='认证超时期间仍能正常回复。'),'a saved secondary reply never uploads to overwrite primary data');assert.equal(modelCalls.length,7);assert.equal(nativeCalls.filter(x=>x.action==='account.signout').length,0);
  // Secondary state is local only; a manual pull applies the primary, including deletions.
  source.state.settings.hist=64;await source.journal.flush();
  const beforeSecondaryPushes=nativeCalls.filter(x=>x.action==='account.sync'&&x.body.action==='push').length;
  await page.evaluate(async()=>{S.settings.hist=40;save();await NorthPrivateDeviceSyncClient.syncNow();});
  assert.equal(await page.evaluate(()=>S.settings.hist),64);assert.equal(source.state.settings.hist,64);
  assert.equal(nativeCalls.filter(x=>x.action==='account.sync'&&x.body.action==='push').length,beforeSecondaryPushes);
  // Exercise the actual device-management UI, including server-side password and authority gates.
  const spare=(await transport('spareA',{action:'register',platform:'macOS',label:'待移除的电脑'})).device.id;
  await page.evaluate(()=>privatePhoneSyncDevicesOpen());
  await page.waitForFunction(()=>document.querySelector('#privateSyncDevicesOverlay')?.textContent.includes('本机是副设备'));
  for(const width of [430,320]){
   await page.setViewportSize({width,height:900});
   const layout=await page.locator('#privateSyncDevicesOverlay').evaluate(panel=>{const frame=panel.firstElementChild,header=frame.firstElementChild,title=header.firstElementChild,close=header.lastElementChild,b=close.getBoundingClientRect(),t=title.getBoundingClientRect(),primary=Array.from(panel.querySelectorAll('button')).find(button=>button.textContent==='将本机设为主设备');return{closeWidth:b.width,closeHeight:b.height,titleHeight:t.height,titleLineHeight:parseFloat(getComputedStyle(title).lineHeight),titleRight:t.right,closeLeft:b.left,overflow:frame.scrollWidth>frame.clientWidth,primaryBackground:getComputedStyle(primary).backgroundColor,primaryImage:getComputedStyle(primary).backgroundImage,primaryColor:getComputedStyle(primary).color,primaryWidth:primary.getBoundingClientRect().width,frameBackground:getComputedStyle(frame).backgroundColor,frameBorder:getComputedStyle(frame).borderTopColor};});
   assert.equal(layout.closeWidth,layout.closeHeight,'close is circular, never a wide strip');assert(layout.closeWidth>=32&&layout.closeWidth<=44);assert(layout.titleHeight<=layout.titleLineHeight+1,'title remains one comfortable line');assert(layout.titleRight<layout.closeLeft);assert.equal(layout.overflow,false);assert.equal(layout.frameBackground,'rgb(17, 17, 19)');assert.equal(layout.frameBorder,'rgba(255, 255, 255, 0.22)');assert.equal(layout.primaryImage,'none','account action does not inherit the unrelated pink gradient');assert.equal(layout.primaryColor,'rgb(137, 185, 246)');assert(layout.primaryWidth<230,'a secondary management action stays compact');
   fs.mkdirSync(path.join(ROOT,'.codex_tmp'),{recursive:true});await page.screenshot({path:path.join(ROOT,'.codex_tmp','private-sync-dialog-'+width+'.png')});
  }
  await page.setViewportSize({width:430,height:900});
const devicePanel=page.locator('#privateSyncDevicesOverlay');
  await devicePanel.getByText(/本机是副设备/).waitFor();assert.equal(await devicePanel.getByRole('button',{name:'移除',exact:true}).count(),0);
  await devicePanel.getByRole('button',{name:'将本机设为主设备',exact:true}).click();await devicePanel.getByLabel('小手机账号密码').fill('fixture-wrong-password');await devicePanel.getByRole('button',{name:'验证密码并设为主设备',exact:true}).click();await devicePanel.getByText('密码没有通过验证，请重新输入。',{exact:true}).waitFor();
  await devicePanel.getByLabel('小手机账号密码').fill('fixture-correct-password');await devicePanel.getByRole('button',{name:'验证密码并设为主设备',exact:true}).click();await devicePanel.getByText(/本机是主设备/).waitFor();
  const sourceAuthority=await source.journal.inspect();assert.equal(sourceAuthority.isPrimary,false);assert.equal(sourceAuthority.seed.sourceDeviceId,source.journal.state().deviceId,'changing primary never resets the initial data source');
  await assert.rejects(source.journal.request({action:'revoke',targetId:spare}),/primary_required/);
  await page.evaluate(()=>{window.fixtureOriginalConfirm=uiConfirm;window.uiConfirm=async()=>true;});
  await devicePanel.locator('div').filter({has:page.getByText('待移除的电脑',{exact:true}),has:page.getByRole('button',{name:'移除',exact:true})}).last().getByRole('button',{name:'移除',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('privateSyncDevicesOverlay').textContent.includes('待移除的电脑'));
  assert.equal((await transport('spareA',{action:'inspect',deviceId:spare})).error,'device_revoked_or_unknown');
  await devicePanel.getByRole('button',{name:'关闭',exact:true}).click();await page.evaluate(()=>{window.uiConfirm=fixtureOriginalConfirm;delete window.fixtureOriginalConfirm;});
  // An explicit, confirmed single-field choice is still available on the primary.
  async function createHistConflict(value){return page.evaluate(async value=>{
   const ctx=NorthPrivateDeviceSyncClient.context(),row=ctx.codec.dump().find(x=>x.value?.kind==='field'&&JSON.stringify(x.value.path)==='["settings","hist"]');
   const result=await ctx.journal.request({action:'push',changes:[{key:row.key,value:{...row.value,value},deleted:false,baseRevision:'0',mutationId:crypto.randomUUID()}]});
   await privatePhoneSyncConflictsOpen();return result.outcomes[0].conflictId;
  },value);}
  const conflicts=page.locator('#privateSyncConflictOverlay');
  async function histConflict(id){const article=conflicts.locator('article[data-conflict-id="'+id+'"]');await article.getByRole('button',{name:/查看不同修改/}).click();await article.getByText('云端当前内容',{exact:true}).waitFor();return article;}
  const firstId=await createHistConflict(40),firstHist=await histConflict(firstId);assert((await firstHist.innerText()).includes('40'));assert((await firstHist.innerText()).includes('64'));
  assert(await conflicts.locator('[data-conflict-list]').evaluate(el=>getComputedStyle(el).overflowY==='auto'&&el.clientHeight<=innerHeight*.56));
  await firstHist.getByRole('button',{name:'采用云端内容',exact:true}).click();await firstHist.getByRole('button',{name:'确认采用',exact:true}).click();
  await firstHist.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>S.settings.hist),64);
  const secondId=await createHistConflict(56),secondHist=await histConflict(secondId);await secondHist.getByRole('button',{name:'保留本机修改',exact:true}).click();
  const heldResolution=new Promise(resolve=>{resolveSignal=resolve;});holdResolve=true;await secondHist.getByRole('button',{name:'确认采用',exact:true}).click();
  await Promise.race([heldResolution,new Promise((_,reject)=>setTimeout(()=>reject(new Error('fixture resolve did not enter native boundary')),3000))]);
  await page.evaluate(()=>{S.settings.hist=57;save();});resolveRelease();resolveRelease=null;
  await secondHist.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>S.settings.hist),57,'a newer primary edit survives an explicit field-level resolution');
  await page.evaluate(async()=>{for(let n=0;n<3;n++)await NorthPrivateDeviceSyncClient.syncNow();await NorthPrivateDeviceSyncClient.waitForIdle();});
  await conflicts.getByRole('button',{name:'关闭',exact:true}).click();
  await page.evaluate(async()=>{window.fixtureImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4l0AAAAASUVORK5CYII=';await imgPut('fixture-sync-avatar',fixtureImage);S.me.avatar='idb:fixture-sync-avatar';const bytes=Uint8Array.from({length:1200000},(_,i)=>i%251);await mPut('fixture-sync-song',new Blob([bytes],{type:'audio/wav'}));S.music=S.music||{};S.music.songs=S.music.songs||[];S.music.songs.push({id:'fixture-sync-song',title:'同步媒体夹具',src:{t:'idb'}});save();await NorthPrivateDeviceSyncClient.syncNow();});
  try{await page.waitForFunction(()=>NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('fixture-sync-avatar')&&NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('music:fixture-sync-song')?.parts.length===2,null,{timeout:15000});}catch(error){console.log('media diagnostic',JSON.stringify({calls:nativeCalls.filter(x=>x.action==='account.sync'&&x.body.action.startsWith('media.')).map(x=>({action:x.body.action,bytes:x.body.base64?.length,result:x.result})),state:await page.evaluate(()=>({status:NorthPrivateDeviceSyncClient.status(),keys:NorthPrivateDeviceSyncClient.context()?.codec.dump().filter(x=>x.value?.kind==='media').map(x=>x.value.localKey),image:NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('fixture-sync-avatar'),audio:NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('music:fixture-sync-song'),busy:replyGenerationStore()}))}));throw error;}
  const restoredMedia=await page.evaluate(async()=>{await new Promise(async(resolve,reject)=>{const db=await imgDB(),tx=db.transaction('img','readwrite');tx.objectStore('img').delete('fixture-sync-avatar');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});await mDelIDB('fixture-sync-song');const image=await imgGet('fixture-sync-avatar'),audio=await mGet('fixture-sync-song'),bytes=new Uint8Array(await audio.arrayBuffer());return{image:image===fixtureImage,size:bytes.length,bytes:bytes.every((b,i)=>b===i%251)};});
  assert.deepEqual(restoredMedia,{image:true,size:1200000,bytes:true});assert(objects.size>=3,'image and both audio parts are stored as encrypted account objects');
  await page.evaluate(async()=>{const key='__role_call_loop_v1_fixture';await imgPutIDBWithRetry(key,new Blob([Uint8Array.from([1,2,3,4])],{type:'video/mp4'}));S.contacts.find(x=>x.id==='cloud-a').callLoopVideo={key,name:'既有通话视频',type:'video/mp4',size:4};save();await NorthPrivateDeviceSyncClient.syncNow();});
  await page.waitForFunction(()=>!!NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('__role_call_loop_v1_fixture'));
  const loopRestored=await page.evaluate(async()=>{await imgDel('__role_call_loop_v1_fixture');const blob=await imgGet('__role_call_loop_v1_fixture');return Array.from(new Uint8Array(await blob.arrayBuffer()));});assert.deepEqual(loopRestored,[1,2,3,4],'an existing raw-key call video also synchronizes without a new upload action');

  await page.evaluate(async({owner})=>{await NorthPrivateDeviceSyncClient.prepareAccountSwitch();fixtureToken='browserB';__SMALL_PHONE_NATIVE_ACCOUNT__={loggedIn:true,userId:owner};NorthPrivateDeviceSyncClient.accountChanged();}, {owner:ownerB});
  await page.waitForFunction(()=>NorthPrivateDeviceSyncClient.status().owner==='10000000-0000-0000-0000-000000000002'&&NorthPrivateDeviceSyncClient.status().ready&&S.contacts.some(x=>x.id==='cloud-b'),{timeout:30000});
  assert.deepEqual(await page.evaluate(()=>S.contacts.map(x=>x.id)),['cloud-b']);assert(!(await page.evaluate(()=>JSON.stringify(S))).includes('云端角色甲的云端历史消息'));
  assert.equal(await page.evaluate(()=>MCPTools.data().connections.length),0,'the next private account cannot see A connections');
  await page.evaluate(()=>openChat('cloud-b'));await page.locator('#chatbg').getByText('云端角色乙的云端历史消息',{exact:true}).waitFor();
  assert(!nativeCalls.some(x=>x.token==='browserB'&&x.action==='account.sync'&&x.body.action==='push'&&JSON.stringify(x.body).includes('cloud-a')),'A data is never uploaded into B');
  // A reviewed native source is a one-content approval. Preserve the displaced
  // IDB core before alignment, then prove the next boot needs no approval bypass.
  const phoneProbe=await browser.newPage();phoneProbe.on('pageerror',error=>errors.push(error.message));
  await phoneProbe.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('/private-device-sync-client.js'))return route.fulfill({contentType:'text/javascript',body:''});return url.origin===origin?route.continue():route.abort();});
  await phoneProbe.goto(origin+'/__empty-source-fixture');
  const approvedState=fixture(ownerA,'当前手机角色'),oldState=fixture(ownerA,'应保留的旧副本');approvedState.settings.chat.model='current-source-model';approvedState._persistedAt=200;oldState.settings.chat.model='stale-idb-model';oldState._persistedAt=100;
  await phoneProbe.evaluate(async({key,state})=>{localStorage.setItem(key,JSON.stringify({settings:{},__coreIdb:{ver:1,savedAt:300}}));await new Promise((resolve,reject)=>{const open=indexedDB.open('yibeiImg',2);open.onupgradeneeded=()=>open.result.createObjectStore('img');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('img','readwrite');tx.objectStore('img').put({ver:1,savedAt:100,json:JSON.stringify(state)},'__core_state');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},{key:baseline.storageKey,state:oldState});
  await phoneProbe.addInitScript(({owner,state})=>{
   window.__SMALL_PHONE_PRIVATE__=true;window.__SMALL_PHONE_ACCOUNT_SYNC__=true;window.__SMALL_PHONE_NATIVE_ACCOUNT__={userId:owner,storageReady:true};window.__SMALL_PHONE_LEGACY_OWNER__=owner;
   let record=JSON.parse(localStorage.getItem('__fixture_native_current')||'null')||{ver:1,savedAt:state._persistedAt,json:JSON.stringify(state),contentSHA256:'1'.repeat(64)},approved=!localStorage.getItem('__fixture_native_saved');
   const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
   window.SmallPhoneNative={async request(action,body={}){if(action==='storage.get')return body.key==='__core_state'?{found:true,primaryOnly:true,...record,stateSHA256:await hash(record.json),stateJSON:record.json,...(approved?{sourceApproval:'1'.repeat(64)}:{})}:{found:false,primaryOnly:true};if(action==='storage.put'){if(body.key==='__core_state'){if(body.expectedSHA256!==record.contentSHA256)throw new Error('storage_revision_changed');const next={ver:body.ver,savedAt:body.savedAt,json:body.stateJSON,parentSHA256:record.contentSHA256};record={...next,contentSHA256:await hash(JSON.stringify(next)),stateSHA256:await hash(next.json)};approved=false;localStorage.setItem('__fixture_native_current',JSON.stringify(record));localStorage.setItem('__fixture_native_saved','1');return {saved:true,contentSHA256:record.contentSHA256,stateSHA256:record.stateSHA256,parentSHA256:record.parentSHA256};}return {saved:true};}if(action==='account.status')return {ok:true,loggedIn:true,userId:owner};return {ok:false,error:'fixture_unsupported'};}};
  },{owner:ownerA,state:approvedState});
  await phoneProbe.goto(origin+'/'+PRIV_DIR+'index.html');await phoneProbe.waitForFunction(()=>window.__northBootReady,null,{timeout:10000});
  assert.equal(await phoneProbe.evaluate(()=>S.settings.chat.model),'current-source-model');
  const receiptProbe=await phoneProbe.evaluate(async()=>{await saveNowAsync();const original=SmallPhoneNative.request,oldFailure=storageSaveFailure;let lost=0,failures=0;SmallPhoneNative.request=async function(action,body){const result=await original.call(this,action,body);if(action==='storage.put'&&body.key===CORE_IDB_KEY&&!lost){lost++;throw new Error('原生请求超时：storage.put');}return result;};storageSaveFailure=()=>{failures++;};try{S.settings.hist=37;await saveNowAsync();const native=await original.call(SmallPhoneNative,'storage.get',{key:CORE_IDB_KEY,owner:privateAccountDataIdentity(),primaryOnly:true}),mirror=await imgGetIDB(CORE_IDB_KEY);return{lost,failures,same:native.stateJSON===mirror.json,hist:JSON.parse(mirror.json).settings.hist};}finally{SmallPhoneNative.request=original;storageSaveFailure=oldFailure;}});
  assert.deepEqual(receiptProbe,{lost:1,failures:0,same:true,hist:37},'actual save path mirrors a committed write after a lost receipt without a false save failure');
  for(const width of [320,430]){await phoneProbe.setViewportSize({width,height:932});await phoneProbe.evaluate(()=>storageFullAlert(new Error('storage_revision_changed'),true));const view=await phoneProbe.evaluate(()=>{const root=document.querySelector('#modal'),text=root.textContent,box=root.getBoundingClientRect();return{text,within:box.left>=-1&&box.right<=innerWidth+1};});assert(view.text.includes('本次保存尚未确认'));assert(!view.text.includes('原生主存档与备用数据库本次都没有确认写入'));assert(!view.text.includes('退出无痕模式'));assert(view.within);await phoneProbe.evaluate(()=>closeModal());}
  const archivedModel=await phoneProbe.evaluate(async owner=>new Promise((resolve,reject)=>{const open=indexedDB.open('smallphone-account-sync-v2-'+owner,1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('state','readonly'),get=tx.objectStore('state').get('__device_sync_v2_'+owner+'_bootstrap_before');let result;get.onsuccess=()=>{result=get.result;};tx.oncomplete=()=>{db.close();resolve(JSON.parse(result.previousCore.json).settings.chat.model);};tx.onerror=()=>reject(tx.error);};}),ownerA);assert.equal(archivedModel,'stale-idb-model','the unique old IDB core survives alignment');
  await phoneProbe.evaluate(async()=>{await saveNowAsync();const head=await SmallPhoneNative.request('storage.get',{key:'__core_state',owner:privateAccountDataIdentity(),primaryOnly:true}),state=JSON.parse(head.stateJSON);state.settings.hist=99;state._persistedAt=Date.now()+1;await SmallPhoneNative.request('storage.put',{key:'__core_state',owner:privateAccountDataIdentity(),ver:1,savedAt:state._persistedAt,stateJSON:JSON.stringify(state),expectedSHA256:head.contentSHA256});});await phoneProbe.reload();await phoneProbe.waitForFunction(()=>window.__northBootReady,null,{timeout:10000});assert.equal(await phoneProbe.evaluate(()=>S.settings.chat.model),'current-source-model');assert.equal(await phoneProbe.evaluate(()=>S.settings.hist),99,'a committed native successor survives interruption before the IDB mirror');
  const runtimeBefore=await phoneProbe.evaluate(async()=>{localStorage.setItem('yibei_unlocked',String(SHARE_EPOCH));await saveNowAsync();const mirror=await imgGetIDB(CORE_IDB_KEY),head=await SmallPhoneNative.request('storage.get',{key:CORE_IDB_KEY,owner:privateAccountDataIdentity(),primaryOnly:true}),state=JSON.parse(head.stateJSON);let parent=head.contentSHA256;
    for(const n of [17,18]){state.presence=Object.assign({},state.presence,{fixture:{at:n}});state.roleBody=Object.assign({},state.roleBody,{fixture:{energy:n}});state._persistedAt=Date.now()+n;const r=await SmallPhoneNative.request('storage.put',{key:CORE_IDB_KEY,owner:privateAccountDataIdentity(),ver:1,savedAt:state._persistedAt,stateJSON:JSON.stringify(state),expectedSHA256:parent});parent=r.contentSHA256;}
    return{mirror,source:JSON.stringify(state),hash:parent};});
  await phoneProbe.reload();try{await phoneProbe.locator('[data-core-runtime-review]').waitFor({state:'visible',timeout:10000});}catch(error){console.log('runtime review diagnostic',JSON.stringify(await phoneProbe.evaluate(async()=>{const native=JSON.parse(localStorage.getItem('__fixture_native_current')),mirror=await imgGetIDB(CORE_IDB_KEY),a=JSON.parse(native.json),b=JSON.parse(mirror.json);return{ready:window.__northBootReady,pending:typeof _privateCoreBootConflict!=='undefined'&&!!_privateCoreBootConflict,message:document.querySelector('.bootmsg')?.textContent,nativeVerified:!!native.stateSHA256,mirrorVerified:!!mirror.stateSHA256,changed:Object.keys({...a,...b}).filter(k=>typeof privateCoreJSONSame==='function'?!privateCoreJSONSame(a[k],b[k]):JSON.stringify(a[k])!==JSON.stringify(b[k])),runtimeMatch:typeof privateCoreOnlyRuntimeDiff==='function'?privateCoreOnlyRuntimeDiff(native.json,mirror.json):null,persisted:[a._persistedAt,b._persistedAt],owner:privateAccountDataIdentity()};})));throw error;}
  assert.equal(await phoneProbe.evaluate(()=>window.__northBootReady),false,'runtime divergence still requires an explicit choice');
  const beforeReview=await phoneProbe.evaluate(async()=>{const message=document.querySelector('.bootmsg').textContent;__northBootProgress('still waiting');return{stable:message===document.querySelector('.bootmsg').textContent,mirror:await imgGetIDB(CORE_IDB_KEY),native:JSON.parse(localStorage.getItem('__fixture_native_current')).json};});assert(beforeReview.stable,'a progress timer cannot erase the actual boot failure');assert.equal(beforeReview.mirror.json,runtimeBefore.mirror.json);assert.equal(beforeReview.native,runtimeBefore.source);
  for(const width of [320,430]){await phoneProbe.setViewportSize({width,height:900});assert(await phoneProbe.locator('#coreBootReviewDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'review must fit narrow screens');assert(await phoneProbe.locator('[data-core-runtime-review]').isVisible());const box=await phoneProbe.locator('#coreBootReviewDialog').boundingBox();assert(Math.abs(box.x+box.width/2-width/2)<3&&Math.abs(box.y+box.height/2-450)<3,'review stays centered');assert.notEqual(await phoneProbe.locator('#coreBootReviewDialog .boottitle').evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 0)','title contrasts with the dark card');}
  if(process.env.NORTH_CORE_REVIEW_PREVIEW==='1')await phoneProbe.screenshot({path:path.join(ROOT,'.codex_tmp/private-sync-dialog-430.png')});
  await phoneProbe.locator('[data-core-runtime-review]').click();await phoneProbe.waitForFunction(()=>window.__northBootReady,null,{timeout:15000});
  assert.equal(await phoneProbe.evaluate(()=>S.settings.chat.model),'current-source-model');assert.equal(await phoneProbe.evaluate(()=>S.settings.hist),99);
  const runtimeArchive=await phoneProbe.evaluate(async owner=>new Promise((resolve,reject)=>{const open=indexedDB.open('smallphone-account-sync-v2-'+owner,1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('state','readonly'),get=tx.objectStore('state').openCursor();let row;get.onsuccess=()=>{const c=get.result;if(!c)return;if(String(c.key).startsWith('__core_runtime_review_v1_'))row=c.value;c.continue();};tx.oncomplete=()=>{db.close();resolve(row);};tx.onerror=()=>reject(tx.error);};}),ownerA);
  assert.equal(runtimeArchive.native.json,runtimeBefore.source);assert.equal(runtimeArchive.mirror.json,runtimeBefore.mirror.json,'both exact originals survive the choice');
  const lateMirror=await phoneProbe.evaluate(async old=>{const before=await imgGetIDB(CORE_IDB_KEY);let code='';try{await privateCommitCoreMirror(old,privateAccountDataIdentity(),{previousJSON:'unrelated predecessor'});}catch(e){code=e.code;}return{code,unchanged:(await imgGetIDB(CORE_IDB_KEY)).json===before.json};},runtimeBefore.mirror);assert.deepEqual(lateMirror,{code:'CORE_REVISION_CHANGED',unchanged:true},'late stale writes cannot replace the selected mirror');
  await phoneProbe.reload();await phoneProbe.waitForFunction(()=>window.__northBootReady,null,{timeout:15000});assert.equal(await phoneProbe.locator('[data-core-runtime-review]').count(),0,'a completed choice does not recur on a clean restart');await phoneProbe.close();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({privateHTML:true,cloudHydrated:true,noDefaultRoleLeak:true,secondaryAutomaticModelCalls:0,manualModelRequests:7,mcpCalls:1,composerPreserved:true,conflictUIBothChoices:true,media1200000Bytes:true,primaryPasswordUI:true,primaryOnlyRevocation:true,accountSwitchIsolated:true}));
 }finally{resolveRelease?.();for(const journal of sources)journal.close();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
});


// Removal acceptance: keep local storage/credentials, but do not start the archived journal.
test('local-only adapter rejects late model and login responses after account changes',async()=>{
 const source=read(PRIV_DIR+'private-device-sync-client.js'),a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002';
 let releaseStatus,releaseModel;const nativeCalls=[];
 const c={console,Promise,Map,Set,JSON,String,Number,Math,Date,URL,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,
  __SMALL_PHONE_PRIVATE__:true,__SMALL_PHONE_DEVICE_SYNC_RETIRED__:true,__northBootReady:true,
  S:{_deviceSyncOwner:a},_privatePhoneAccount:{userId:a,loggedIn:true},identity:a,
  privateAccountDataIdentity:()=>c.identity,privateAccountStorageReady:()=>true,actId:()=> 'main',
  SmallPhoneNative:{request:async(action)=>{nativeCalls.push(action);return new Promise(r=>releaseStatus=r);}},
  chatAPI:async()=>new Promise(r=>releaseModel=r),privatePhoneAccountPaint(){},saveNowAsync:async()=>true};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);await Promise.resolve();
 const refresh=c.privatePhoneAccountRefresh(false);c.identity=b;c.S={_deviceSyncOwner:b};releaseStatus({ok:true,loggedIn:true,userId:a});await refresh;
 assert.equal(c._privatePhoneAccount.userId,a,'a stale status cannot select a different local namespace');assert.equal(c.S._deviceSyncOwner,b);
 const request=c.chatAPI([]);c.identity=a;c.S={_deviceSyncOwner:a};releaseModel('late result');await assert.rejects(request,/所属的账号或存档已变化/);
 assert.deepEqual(nativeCalls,['account.status']);assert.equal(c.NorthPrivateDeviceSyncClient.status().retired,true);
});

test('retired device sync preserves local chats and MCP connections without remote gates or leases',async()=>{
 const require=createRequire(import.meta.url),{chromium}=require('playwright'),owner='10000000-0000-0000-0000-000000000001';
 const calls=[],errors=[],models=[];let browser;
 const connection={id:'retained-mcp',name:'保留的MCP',url:'https://mcp-fixture.invalid/mcp',auth:'none',state:'connected',enabled:true,roles:['local-kept'],tools:[],accountManaged:true,cloudRevision:'1',token:'',refresh:'',clientSecret:''};
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/__native'){
   let input='';for await(const chunk of req)input+=chunk;const q=JSON.parse(input);calls.push(q);let result={ok:false,error:'unsupported_fixture'};
   if(q.action==='account.status')result={ok:true,loggedIn:true,userId:owner,maskedPhone:'138****0001'};
   if(q.action==='account.sync'&&q.body.action==='register')result={ok:true,device:{id:'30000000-0000-0000-0000-000000000001'}};
   if(q.action==='account.mcp'&&q.body.action==='list')result={ok:true,connections:[connection]};
   if(q.action==='account.backup.info')result={ok:true,found:false};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  const file=path.resolve(ROOT,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(/\.(?:js|html)$/.test(file)?read(path.relative(ROOT,file)):fs.readFileSync(file));
 });
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
  const probe=await browser.newPage();await probe.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await probe.goto(origin+'/'+PRIV_DIR+'index.html?northPreview=black-home');await probe.waitForFunction(()=>window.__northBootReady);
  const base=await probe.evaluate(()=>({state:defState(),role:S.contacts[0],key:KEY}));await probe.close();
  const state=base.state,role=base.role;role.id='local-kept';role.name='本机角色';role.remark='';role.persona='受控本机聊天测试';
  state._deviceSyncOwner=owner;state._persistedAt=100;state.contacts=[role];state.messages={[role.id]:[{id:'kept',role:'assistant',type:'text',content:'原有本机消息',time:100}]};
  state.settings.chat={base:'https://model-fixture.invalid/v1',key:'fixture',model:'fixture',temp:.7,maxTokens:4096};state.settings.manualReply=true;state.settings.replyDelay=0;state.settings.sound=false;state.settings.memoryFreq=0;
  const page=await browser.newPage({viewport:{width:390,height:850}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({origin,owner,state,key,connection})=>{
   window.__SMALL_PHONE_PRIVATE__=true;window.__SMALL_PHONE_MAC__=true;window.__SMALL_PHONE_ACCOUNT_SYNC__=true;window.__SMALL_PHONE_DEVICE_SYNC_RETIRED__=true;window.__SMALL_PHONE_NATIVE_ACCOUNT__={userId:owner,platform:'macOS'};
   if(!localStorage.getItem('retirement-baseline-seeded')){localStorage.setItem(key,JSON.stringify(state));localStorage.setItem('smallphone-mcp-local-v1',JSON.stringify({['account:'+owner+':main']:{connections:[connection],receipts:[]}}));localStorage.setItem('retirement-baseline-seeded','1');}localStorage.setItem('yibei_manual_seen','1');
   window.SmallPhoneNative={request:async(action,body={})=>(await fetch(origin+'/__native',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,body})})).json()};
  },{origin,owner,state,key:base.key,connection});
  await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin===origin)return route.continue();
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'*'}});if(url.hostname==='model-fixture.invalid'){models.push(req.postDataJSON());return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({choices:[{message:{content:'本机正常回复。'},finish_reason:'stop'}]})});}return route.abort();});
  await page.goto(origin+'/'+PRIV_DIR+'index.html');await page.waitForFunction(()=>window.__northBootReady&&_privatePhoneAccount.loggedIn);
  assert.equal(await page.evaluate(()=>NorthPrivateDeviceSyncClient.status().retired),true);
  assert.deepEqual(await page.evaluate(()=>S.contacts.map(x=>x.id)),['local-kept']);assert(await page.evaluate(()=>msgs('local-kept').some(x=>x.id==='kept')));
  await page.evaluate(()=>{S.me.locked=false;document.getElementById('gate')?.remove();openChat('local-kept');});
  await page.locator('#cinput').fill('你好，继续聊天');await page.locator('#cinput').evaluate(input=>sendText(input._chatId));await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();await page.waitForFunction(()=>msgs('local-kept').some(x=>x.role==='assistant'&&String(x.content).includes('本机正常回复'))&&!replyGenerationBusy('local-kept'));assert.equal(models.length,1);
  await page.evaluate(async()=>{S.settings.hist=37;await saveNowAsync();openSettings('data');_setTab=3;privatePhoneAccountPaint();});
  assert(!/登录设备|立即同步|退出此设备|查看\s*\d+\s*项不同修改/.test(await page.locator('#setpage3').innerText()));
  const mcp=await page.evaluate(()=>JSON.parse(localStorage.getItem('smallphone-mcp-local-v1'))['account:'+_privatePhoneAccount.userId+':main'].connections[0]);assert.equal(mcp.id,connection.id);assert.equal(mcp.state,'connected');assert.deepEqual(mcp.roles,connection.roles);
  assert(!calls.some(x=>x.action==='account.sync'&&x.body.action!=='register'),'no data pulls, pushes, seeds, leases or device management');
  // Do not re-seed localStorage on reload: verify the actual saved database and deleted state.
  await page.evaluate(async()=>{S.messages['local-kept']=msgs('local-kept').filter(x=>x.id!=='kept');await saveNowAsync();});
  await page.reload();await page.waitForFunction(()=>window.__northBootReady&&_privatePhoneAccount.loggedIn);assert.deepEqual(await page.evaluate(()=>S.contacts.map(x=>x.id)),['local-kept']);assert.equal(await page.evaluate(()=>msgs('local-kept').some(x=>x.id==='kept')),false,'intentional deletion survives reloading the actual saved database');assert(await page.evaluate(()=>msgs('local-kept').some(x=>x.role==='assistant'&&String(x.content).includes('本机正常回复'))));
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
