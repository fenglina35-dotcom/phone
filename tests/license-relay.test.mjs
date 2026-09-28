import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const sourceOf=path=>process.env.NORTH_LICENSE_TEST_OLD==='1'?execFileSync('git',['show','84d63859:'+path],{encoding:'utf8',maxBuffer:16*1024*1024}):fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
import {createHandler} from '../services/phone-license-relay/worker.mjs';
const paths=['license-gate.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/license-gate.js'];
function load(path,fetch,native){
 const values=new Map();const context={AbortController,ArrayBuffer,Error,JSON,Math,Promise,Response,Set,Uint8Array,atob,btoa,clearTimeout,crypto:globalThis.crypto,setTimeout,fetch,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},navigator:{userAgent:'Android OPPO fixture'},location:{protocol:native?'file:':'https:'},matchMedia:()=>({matches:false})};
 context.window=context;if(native)context.SmallPhoneNative={request:native};
 vm.createContext(context);vm.runInContext(sourceOf(path),context);
 context.NorthLicense.init({epoch:4,endpoints:[{id:'primary',baseUrl:'https://primary.example',apiKey:'fixture-primary'},{id:'license-failover',baseUrl:'https://lovbzibismsjqvjujilz.supabase.co',apiKey:'fixture-public'}]});
 return context.NorthLicense;
}
for(const path of paths){
 test(path+': blocked Supabase browser path activates via relay and keeps admin backend IDs',async()=>{
  const calls=[];const upstream=[];
  const handle=createHandler(async(url,init)=>{
   upstream.push(url);const body=JSON.parse(init.body);
   return Response.json(body.action==='activate'?{ok:true,session:{token:'fixture-token',licenseId:'same-admin-license',sessionId:'same-session'}}:{ok:true,valid:true,sessionCount:1});
  });
  const gate=load(path,async(url,init)=>{calls.push(url);if(url.includes('supabase.co'))throw new TypeError('ERR_CONNECTION_RESET');
   assert.equal(url,'https://license.smallphoneapp.com/functions/v1/phone-license');assert.equal(init.headers.apikey,undefined);assert.equal(init.headers.Authorization,undefined);
   return handle(new Request(url,{...init,headers:{...init.headers,Origin:'https://fenglina35-dotcom.github.io','User-Agent':'Android OPPO fixture'}}));
  });
  await gate.activate('YB2-FIXTURE');assert.equal(gate.session().licenseId,'same-admin-license');assert.equal(gate.session().endpointId,'license-failover');
  await gate.check();assert.equal(calls.length,2);assert.ok(upstream.every(u=>u==='https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-license'));
 });
 test(path+': lost activation response is not retried and no fabricated session is saved',async()=>{
  let calls=0;const gate=load(path,async()=>{calls++;throw new TypeError('reset');});
  await assert.rejects(gate.activate('YB2-FIXTURE'));assert.equal(calls,1);assert.equal(gate.session(),null);
 });
 test(path+': private file bridge retains original host and endpoint identity',async()=>{
  let calls=0;const gate=load(path,async()=>{throw Error('browser transport must not run');},async(command,data)=>{
   calls++;assert.equal(command,'license.request');assert.equal(data.baseUrl,'https://lovbzibismsjqvjujilz.supabase.co');
   return {status:200,payload:{ok:true,session:{token:'fixture',licenseId:'existing',sessionId:'device'}}};
  });await gate.activate('YB2-FIXTURE');assert.equal(calls,1);assert.equal(gate.session().endpointId,'license-failover');
 });
}
test('entry closes before an unavailable optional phone-friend service',async()=>{
 for(const path of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
  const source=sourceOf(path);const start=source.indexOf('function showGate()');const end=source.indexOf('\nlet _licenseCheckBusy=',start);
  const elements=new Map(['gate','gateInp','gateErr','gateBtn','gateRestore'].map(id=>[id,{value:'YB2-FIXTURE',focus(){}}]));let entered=false,activated=0;
  const context={document:{getElementById:id=>elements.get(id)},gateOK:()=>false,svgIc:()=>'',normalizeInviteCode:v=>v,SHARE_PW:'',SHARE_EPOCH:4,NorthLicense:{activate:async()=>{activated++;}},licenseMarkUnlocked(){},licenseFinishGate(){entered=true;},licensePostActivationSetup(){},pfEnsure:()=>new Promise(()=>{}),setTimeout(){}};
  context.window=context;vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.showGate();
  const done=elements.get('gateBtn').onclick();await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(Error('activation blocked by optional service')),100))]);
  assert.equal(entered,true);assert.equal(activated,1);
 }
});
