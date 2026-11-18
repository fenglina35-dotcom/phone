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
 const store={async key(owner,candidate){await db.query('insert into private_phone_sync_keys(user_id,wrapped_key) values($1,$2) on conflict(user_id) do nothing',[owner,candidate]);return(await db.query('select wrapped_key from private_phone_sync_keys where user_id=$1',[owner])).rows[0].wrapped_key;},
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
  res.end(fs.readFileSync(file));
 }catch(error){res.writeHead(500);res.end(String(error));}});
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;insert into auth.users values('${ownerA}'),('${ownerB}');`);
  await db.exec(read('supabase/migrations/202611170001_private_phone_device_sync.sql'));
  await db.exec(read('supabase/migrations/202611170003_private_phone_primary_device.sql'));
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
   const journal=core.createJournal({owner,platform:'iOS',label:'受控源手机',getOwner:()=>owner,canPublish:()=>true,transport:body=>transport(token,body),storage:{read:async()=>saved,write:async(_,value)=>{saved=value;}},snapshot:()=>codec.project(state),apply:async rows=>{codec.accept(rows);const next=await codec.materialize();if(next.complete){for(const key of Object.keys(state))delete state[key];Object.assign(state,next.state);}}});
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
  await page.waitForFunction(()=>!!_imgCache['fixture-late-home']&&document.getElementById('homeDesktop')?.style.backgroundImage.includes('data:image/'),null,{timeout:8000});


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
  await page.evaluate(()=>go('settings'));await page.waitForTimeout(1200);await page.evaluate(()=>NorthPrivateDeviceSyncClient.syncNow());
  assert.equal(modelCalls.length,0,'secondary idle and settings produce zero automatic model calls');
  await page.evaluate(()=>openChat('cloud-a'));await page.locator('#cinput').fill('请给我一句回复');await page.locator('#cinput').evaluate(input=>sendText(input._chatId));
  await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();await page.locator('#chatbg').getByText('手动微信回复成功。',{exact:true}).waitFor({timeout:30000});
  await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));assert.equal(modelCalls.length,1,'the manual secondary-device turn submits exactly one model request');
  fixtureConnectionId=await page.evaluate(async()=>{const c=MCPTools.add({name:'受控资料',url:'https://mcp-fixture.invalid/mcp',auth:'none'});await MCPTools.connect(c.id);MCPTools.setRole(c.id,'cloud-a',true);return c.id;});assert(fixtureConnectionId);
  modelMode='mcp';await page.locator('#cinput').fill('请查外部花店文档');await page.locator('#cinput').evaluate(input=>sendText(input._chatId));await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();
  await page.locator('#chatbg').getByText('工具查到了花店记录。',{exact:true}).waitFor({timeout:30000});await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));
  assert.equal(toolCalls.filter(x=>x.method==='tools/call').length,1);assert.equal(modelCalls.length,3,'the manual MCP turn has one selection and one final response');
  assert(await page.locator('.mcp-chat-trace[data-mcp-state=ok]').isVisible());assert(!(await page.locator('#chatbg').innerText()).includes('mcp_call'));
  // An existing account reloads and manually chats through a background Auth
  // outage. The shipped local persistence and model path are not replaced.
  await page.evaluate(id=>MCPTools.setRole(id,'cloud-a',false),fixtureConnectionId);
  authOutage=true;modelMode='offline';await page.reload();
  await page.waitForFunction(()=>window.__northBootReady&&NorthPrivateDeviceSyncClient?.status().phase==='network'&&NorthPrivateDeviceSyncClient.gateAllowed(),null,{timeout:10000});
  assert.equal(await page.locator('#privateSyncConnectionNotice').isVisible(),true);
  assert.equal(await page.locator('#privatePhoneNumber').count(),0,'a timeout does not replace the account view with login');
  await page.evaluate(()=>privatePhoneAccountBindOpen());await page.locator('#privatePhoneNumber').fill('13800000001');await page.locator('#privatePhonePassword').fill('fixture-password');
  await page.evaluate(()=>privatePhoneAccountPasswordLogin());await page.waitForTimeout(1300);
  assert((await page.locator('#privatePhoneLoginNote').innerText()).includes('超时'),'login errors remain readable');assert.equal(await page.locator('[data-private-auth-submit]').first().isDisabled(),false);await page.evaluate(()=>closeModal());
  await page.evaluate(()=>{S.me.locked=false;renderLockScreen();openChat('cloud-a');});
  await page.locator('#cinput').fill('断线期间继续聊天');await page.locator('#cinput').evaluate(input=>sendText(input._chatId));await page.getByRole('button',{name:'▶ 让ta回',exact:true}).click();
  await page.locator('#chatbg').getByText('认证超时期间仍能正常回复。',{exact:true}).waitFor({timeout:15000});await page.waitForFunction(()=>!replyGenerationBusy('cloud-a'));assert.equal(modelCalls.length,4,'one manual local reply is never retried by synchronization');
  await page.reload();await page.waitForFunction(()=>window.__northBootReady&&NorthPrivateDeviceSyncClient?.gateAllowed(),null,{timeout:10000});assert(await page.evaluate(()=>S.messages['cloud-a'].some(x=>x.content==='认证超时期间仍能正常回复。')),'the offline reply survives reopening');
  authOutage=false;await page.evaluate(()=>NorthPrivateDeviceSyncClient.syncNow());await page.waitForFunction(()=>NorthPrivateDeviceSyncClient.status().phase==='ready',null,{timeout:10000});await source.journal.cycle();
  assert(source.state.messages['cloud-a'].some(x=>x.content==='认证超时期间仍能正常回复。'),'the saved offline reply uploads after reconnection');assert.equal(modelCalls.length,4);assert.equal(nativeCalls.filter(x=>x.action==='account.signout').length,0);
  // Resolve a genuine same-field CAS conflict through the shipped UI, in each
  // direction. Source and browser retain their independent old revisions.
  source.state.settings.hist=48;await source.journal.flush();
  await page.evaluate(async()=>{S.settings.hist=40;save();await NorthPrivateDeviceSyncClient.syncNow();await NorthPrivateDeviceSyncClient.waitForIdle();privatePhoneSyncConflictsOpen();});
  const conflicts=page.locator('#privateSyncConflictOverlay');
  async function histConflict(){await conflicts.locator('article[data-conflict-id]').first().waitFor();for(const article of await conflicts.locator('article[data-conflict-id]').all()){await article.getByRole('button',{name:/查看不同修改/}).click();await article.getByText('云端当前内容',{exact:true}).waitFor();if((await article.innerText()).includes('设置 · 上下文长度'))return article;}throw new Error('hist conflict was not found');}
  const firstHist=await histConflict();assert((await firstHist.innerText()).includes('40'));assert((await firstHist.innerText()).includes('48'));
  assert(await conflicts.locator('[data-conflict-list]').evaluate(el=>getComputedStyle(el).overflowY==='auto'&&el.clientHeight<=innerHeight*.56));
  await firstHist.getByRole('button',{name:'采用云端内容',exact:true}).click();await firstHist.getByRole('button',{name:'确认采用',exact:true}).click();
  await page.waitForFunction(()=>S.settings.hist===48&&!Object.values(NorthPrivateDeviceSyncClient.context().journal.state().pending).some(x=>x.blocked&&x.value?.path?.at(-1)==='hist'));
  await source.journal.cycle();source.state.settings.hist=64;await source.journal.flush();
  await page.evaluate(async()=>{S.settings.hist=56;save();await NorthPrivateDeviceSyncClient.syncNow();await NorthPrivateDeviceSyncClient.waitForIdle();privatePhoneSyncConflictsOpen();});
  const secondHist=await histConflict();await secondHist.getByRole('button',{name:'保留本机修改',exact:true}).click();
  const heldResolution=new Promise(resolve=>{resolveSignal=resolve;});holdResolve=true;await secondHist.getByRole('button',{name:'确认采用',exact:true}).click();
  await Promise.race([heldResolution,new Promise((_,reject)=>setTimeout(()=>reject(new Error('fixture resolve did not enter native boundary')),3000))]);
  await page.evaluate(()=>{S.settings.hist=57;save();});resolveRelease();resolveRelease=null;
  await page.waitForFunction(()=>S.settings.hist===57&&Object.values(NorthPrivateDeviceSyncClient.context().journal.state().pending).some(x=>x.value?.path?.at(-1)==='hist'&&x.value.value===57));
  await source.journal.cycle();assert.equal(source.state.settings.hist,56,'the selected candidate is durable on the source while the newer local edit remains pending');
  assert.equal(await page.evaluate(()=>S.settings.hist),57,'an edit made while resolve ACK is in flight is never overwritten');
  await page.evaluate(()=>document.getElementById('privateSyncConflictOverlay')?.remove());
  // Real media hooks upload two encrypted 1 MiB-bounded chunks, then restore the
  // missing local image/audio through the account-scoped backend on demand.
  await page.evaluate(async()=>{window.fixtureImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4l0AAAAASUVORK5CYII=';await imgPut('fixture-sync-avatar',fixtureImage);S.me.avatar='idb:fixture-sync-avatar';const bytes=Uint8Array.from({length:1200000},(_,i)=>i%251);await mPut('fixture-sync-song',new Blob([bytes],{type:'audio/wav'}));S.music=S.music||{};S.music.songs=S.music.songs||[];S.music.songs.push({id:'fixture-sync-song',title:'同步媒体夹具',src:{t:'idb'}});save();await NorthPrivateDeviceSyncClient.syncNow();});
  try{await page.waitForFunction(()=>NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('fixture-sync-avatar')&&NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('music:fixture-sync-song')?.parts.length===2,null,{timeout:15000});}catch(error){console.log('media diagnostic',JSON.stringify({calls:nativeCalls.filter(x=>x.action==='account.sync'&&x.body.action.startsWith('media.')).map(x=>({action:x.body.action,bytes:x.body.base64?.length,result:x.result})),state:await page.evaluate(()=>({status:NorthPrivateDeviceSyncClient.status(),keys:NorthPrivateDeviceSyncClient.context()?.codec.dump().filter(x=>x.value?.kind==='media').map(x=>x.value.localKey),image:NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('fixture-sync-avatar'),audio:NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('music:fixture-sync-song'),busy:replyGenerationStore()}))}));throw error;}
  const restoredMedia=await page.evaluate(async()=>{await new Promise(async(resolve,reject)=>{const db=await imgDB(),tx=db.transaction('img','readwrite');tx.objectStore('img').delete('fixture-sync-avatar');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});await mDelIDB('fixture-sync-song');const image=await imgGet('fixture-sync-avatar'),audio=await mGet('fixture-sync-song'),bytes=new Uint8Array(await audio.arrayBuffer());return{image:image===fixtureImage,size:bytes.length,bytes:bytes.every((b,i)=>b===i%251)};});
  assert.deepEqual(restoredMedia,{image:true,size:1200000,bytes:true});assert(objects.size>=3,'image and both audio parts are stored as encrypted account objects');
  await page.evaluate(async()=>{const key='__role_call_loop_v1_fixture';await imgPutIDBWithRetry(key,new Blob([Uint8Array.from([1,2,3,4])],{type:'video/mp4'}));S.contacts.find(x=>x.id==='cloud-a').callLoopVideo={key,name:'既有通话视频',type:'video/mp4',size:4};save();await NorthPrivateDeviceSyncClient.syncNow();});
  await page.waitForFunction(()=>!!NorthPrivateDeviceSyncClient.context()?.codec.mediaManifest('__role_call_loop_v1_fixture'));
  const loopRestored=await page.evaluate(async()=>{await imgDel('__role_call_loop_v1_fixture');const blob=await imgGet('__role_call_loop_v1_fixture');return Array.from(new Uint8Array(await blob.arrayBuffer()));});assert.deepEqual(loopRestored,[1,2,3,4],'an existing raw-key call video also synchronizes without a new upload action');
  // Exercise the actual device-management UI, including server-side password and authority gates.
  const spare=(await transport('spareA',{action:'register',platform:'macOS',label:'待移除的电脑'})).device.id;
  await page.evaluate(()=>privatePhoneSyncDevicesOpen());const devicePanel=page.locator('#privateSyncDevicesOverlay');
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
  const archivedModel=await phoneProbe.evaluate(async owner=>new Promise((resolve,reject)=>{const open=indexedDB.open('smallphone-account-sync-v2-'+owner,1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('state','readonly'),get=tx.objectStore('state').get('__device_sync_v2_'+owner+'_bootstrap_before');let result;get.onsuccess=()=>{result=get.result;};tx.oncomplete=()=>{db.close();resolve(JSON.parse(result.previousCore.json).settings.chat.model);};tx.onerror=()=>reject(tx.error);};}),ownerA);assert.equal(archivedModel,'stale-idb-model','the unique old IDB core survives alignment');
  await phoneProbe.evaluate(async()=>{await saveNowAsync();const head=await SmallPhoneNative.request('storage.get',{key:'__core_state',owner:privateAccountDataIdentity(),primaryOnly:true}),state=JSON.parse(head.stateJSON);state.settings.hist=99;state._persistedAt=Date.now()+1;await SmallPhoneNative.request('storage.put',{key:'__core_state',owner:privateAccountDataIdentity(),ver:1,savedAt:state._persistedAt,stateJSON:JSON.stringify(state),expectedSHA256:head.contentSHA256});});await phoneProbe.reload();await phoneProbe.waitForFunction(()=>window.__northBootReady,null,{timeout:10000});assert.equal(await phoneProbe.evaluate(()=>S.settings.chat.model),'current-source-model');assert.equal(await phoneProbe.evaluate(()=>S.settings.hist),99,'a committed native successor survives interruption before the IDB mirror');await phoneProbe.close();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({privateHTML:true,cloudHydrated:true,noDefaultRoleLeak:true,secondaryAutomaticModelCalls:0,manualModelRequests:4,mcpCalls:1,composerPreserved:true,conflictUIBothChoices:true,media1200000Bytes:true,primaryPasswordUI:true,primaryOnlyRevocation:true,accountSwitchIsolated:true}));
 }finally{resolveRelease?.();for(const journal of sources)journal.close();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
});
