import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {MerossLocalController} from '../src/meross-local.mjs';
import {RelayWorker} from '../src/relay-worker.mjs';

const config=JSON.parse(await fs.readFile(new URL('../runtime/public-config.json',import.meta.url),'utf8'));
const endpoint=`${config.supabaseUrl}/functions/v1/phone-smart-home`;
const identity={
  target:`yb_${crypto.randomBytes(24).toString('hex')}`,
  ownerSecret:`shc_${crypto.randomBytes(32).toString('hex')}`,
  deviceId:`shw_${crypto.randomUUID()}`,
  deviceSecret:`shs_${crypto.randomBytes(32).toString('hex')}`,
};
const headers={apikey:config.publishableKey,authorization:`Bearer ${config.publishableKey}`,'content-type':'application/json'};
async function edge(action,payload={},requestKey=''){
  const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action,payload,client:{target:identity.target,ownerSecret:identity.ownerSecret,appVersion:'real-smoke',requestKey}})});
  const body=await response.json();return{response,body};
}
async function rpc(name,body){const response=await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body)}),raw=await response.text();if(!response.ok)throw new Error(raw);return raw?JSON.parse(raw):null;}
let worker;
try{
  const devices=await MerossLocalController.discover({timeout:6500});
  assert.equal(devices.length,1,'real smoke requires exactly one online MSL430');
  const controller=new MerossLocalController({host:devices[0].host}),before=await controller.snapshot();
  const pairing=await edge('pairing_begin');assert.equal(pairing.response.status,200);assert.match(pairing.body?.data?.pairCode||'',/^\d{10}$/);
  const bound=await rpc('phone_smart_home_bind_device',{p_pair_code:pairing.body.data.pairCode,p_device_id:identity.deviceId,p_device_name:'自动验收电脑',p_device_secret:identity.deviceSecret,p_agent_version:'real-smoke'});assert.equal(bound.ok,true);
  worker=new RelayWorker({config,binding:{target:identity.target,deviceSecret:identity.deviceSecret},version:'real-smoke'});worker.start();
  const requestKey=`shr_${crypto.randomUUID()}`,deadline=Date.now()+45000;let result;
  while(Date.now()<deadline){const current=await edge('control',{plan:{power:before.power?'on':'off'}},requestKey);if(current.response.status===202){await new Promise(resolve=>setTimeout(resolve,850));continue;}assert.equal(current.response.status,200,JSON.stringify(current.body));result=current.body.data;break;}
  assert.equal(result?.ok,true);assert.equal(result?.verified,true);assert.equal(result?.state?.power,before.power);assert.ok(result?.state?.readAt);
  console.log(JSON.stringify({cloud:true,model:result.state.model,verified:true,statePreserved:true,readAt:result.state.readAt}));
}finally{
  await worker?.stop();
  await edge('device_revoke',{confirmedByUser:true}).catch(()=>{});
}
