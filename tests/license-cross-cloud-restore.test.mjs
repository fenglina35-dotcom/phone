import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../license-gate.js',import.meta.url),'utf8');
class MemoryStorage{
  constructor(){this.values=new Map();}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}
const bytes=(...values)=>new Uint8Array(values).buffer;

function loadGate(fetch,getCredential){
  let prompts=0;
  const context={AbortController,ArrayBuffer,Error,JSON,Math,Number,Promise,Response,Set,String,Uint8Array,atob,btoa,clearTimeout,console,crypto:globalThis.crypto,fetch,localStorage:new MemoryStorage(),setTimeout};
  context.window=context;context.window.isSecureContext=true;context.window.PublicKeyCredential=function PublicKeyCredential(){};context.window.matchMedia=()=>({matches:false});
  context.navigator={userAgent:'Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile Safari/537.36',credentials:{async get({publicKey}){prompts++;assert.ok(publicKey.challenge instanceof ArrayBuffer);if(getCredential)return getCredential();return{id:'credential-from-new-cloud',rawId:bytes(1,2,3),type:'public-key',getClientExtensionResults:()=>({}),response:{clientDataJSON:bytes(4),authenticatorData:bytes(5),signature:bytes(6),userHandle:bytes(7)}};}}};
  vm.createContext(context);vm.runInContext(source,context);
  context.NorthLicense.init({epoch:4,endpoints:[{id:'primary',baseUrl:'https://old.example',apiKey:'old-public'},{id:'license-failover',baseUrl:'https://new.example',apiKey:'new-public'}]});
  return{gate:context.NorthLicense,prompts:()=>prompts,storage:context.localStorage};
}

test('a new browser checks the current authorization cloud first',async()=>{
  const seen=[];
  const {gate,prompts}=loadGate(async(url,options)=>{
    const action=JSON.parse(options.body).action;seen.push([url,action]);
    if(action==='restore_options')return new Response(JSON.stringify({ok:true,challengeId:url.includes('old')?'old-challenge':'new-challenge',options:{challenge:'AQID',rpId:'example.com',allowCredentials:[]}}),{status:200});
    if(url.includes('old'))return new Response(JSON.stringify({ok:false,error:'这台手机没有可恢复的授权',code:'license-request-failed',permanent:false}),{status:400});
    return new Response(JSON.stringify({ok:true,session:{token:'restored-token',licenseId:'license-new',sessionId:'session-new',activeCount:1,evicted:[]}}),{status:200});
  });
  const result=await gate.restorePasskey();
  assert.equal(result.session.licenseId,'license-new');
  assert.equal(gate.session().endpointId,'license-failover');
  assert.equal(prompts(),1);
  assert.deepEqual(seen.map(x=>x[1]),['restore_options','restore_verify']);
  assert.equal(seen[0][0].startsWith('https://new.example'),true);
});

test('a legacy passkey can still fall back to the older authorization cloud',async()=>{
  const seen=[];
  const {gate,prompts}=loadGate(async(url,options)=>{
    const action=JSON.parse(options.body).action;seen.push([url,action]);
    if(action==='restore_options')return new Response(JSON.stringify({ok:true,challengeId:url.includes('old')?'old-challenge':'new-challenge',options:{challenge:'AQID',rpId:'example.com',allowCredentials:[]}}),{status:200});
    if(url.includes('new'))return new Response(JSON.stringify({ok:false,error:'这台手机没有可恢复的授权',code:'license-request-failed',permanent:false}),{status:400});
    return new Response(JSON.stringify({ok:true,session:{token:'legacy-token',licenseId:'license-old',sessionId:'session-old',activeCount:1,evicted:[]}}),{status:200});
  });
  const result=await gate.restorePasskey();
  assert.equal(result.session.licenseId,'license-old');
  assert.equal(gate.session().endpointId,'primary');
  assert.equal(prompts(),2);
  assert.deepEqual(seen.map(x=>x[1]),['restore_options','restore_verify','restore_options','restore_verify']);
});

test('a user cancellation does not trigger extra biometric prompts',async()=>{
  const {gate,prompts}=loadGate(async()=>new Response(JSON.stringify({ok:true,challengeId:'challenge',options:{challenge:'AQID',rpId:'example.com',allowCredentials:[]}}),{status:200}),()=>{throw{name:'NotAllowedError'};});
  await assert.rejects(()=>gate.restorePasskey(),/已取消恢复授权/);
  assert.equal(prompts(),1);
});

test('a temporary authorization-cloud outage is not downgraded to a missing binding',async()=>{
  const {gate}=loadGate(async(url,options)=>{
    const action=JSON.parse(options.body).action;
    if(url.includes('old')&&action==='restore_options')throw new TypeError('network failed');
    if(action==='restore_options')return new Response(JSON.stringify({ok:true,challengeId:'new-challenge',options:{challenge:'AQID',rpId:'example.com',allowCredentials:[]}}),{status:200});
    return new Response(JSON.stringify({ok:false,error:'这台手机没有可恢复的授权',code:'license-request-failed',permanent:false}),{status:400});
  });
  await assert.rejects(()=>gate.restorePasskey(),error=>error&&error.network===true);
});

test('missing browser session checks the other existing authorization cloud without minting a grant',async()=>{
 const seen=[];const w=loadGate(async(url,opt)=>{const body=JSON.parse(opt.body);seen.push(body);return url.includes('old')?new Response(JSON.stringify({ok:false,error:'本浏览器授权记录暂时无法恢复',code:'license-session-missing'}),{status:409}):new Response(JSON.stringify({ok:true,sessionCount:1}),{status:200});});
 w.storage.setItem('north_license_session_v1',JSON.stringify({token:'existing-token',licenseId:'existing-license',endpointId:'primary'}));
 assert.equal((await w.gate.check()).ok,true);assert.equal(seen.length,2);assert(seen.every(x=>x.action==='session_check'&&x.sessionToken==='existing-token'));assert.equal(w.gate.session().token,'existing-token');assert.equal(w.gate.session().endpointId,'license-failover');
});
