import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');

function runtime(config,options={}){
  const storage=new Map();
  for(const [key,value] of Object.entries(options.storage||{}))storage.set(key,String(value));
  const calls=[];
  const context={
    NORTH_DELIVERY_CONFIG:config,
    COMPANION_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
    COMPANION_KEY:'legacy-companion-key',
    APP_VER:'v-test',
    S:{me:{name:'Tester'},food:{
      cart:[{offerId:'old-real-cart'}],results:[{offerId:'old-result'}],
      orders:[{id:'old-real',real:true},{id:'virtual-story',real:false}],
      real:{enabled:true,addressLabel:'作者旧地址',approvedAddressFingerprint:'old-fingerprint',lastCapability:{ok:true},roleTasks:{old:{}},learnedMemories:[{id:'old'}],preferences:{milkTea:{brands:'old'}}}
    }},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    crypto:crypto.webcrypto,URL,AbortController,Date,Math,JSON,Promise,console,
    document:{hidden:false,addEventListener(){}},
    addEventListener(){},setTimeout(){return 0},clearTimeout(){},
    uid:()=>`id${Math.random().toString(36).slice(2)}000000000000000000000000`,
    cloudId:()=> 'yb_legacycloudidentity0000000000',
    companionOwnerSecret:()=> 'legacy-companion-owner-secret',
    privateNativeAppOn:()=>options.privateNativeApp===true,actId:()=> 'main',msgs:()=>[],getC:()=>null,
    save(){},render(){},toast(){},openModal(){},closeModal(){},esc:v=>String(v),
    scheduleReply(){},chatAPI:async()=>'',cur:()=>({p:'chat'}),
    fetch:async(url,fetchOptions)=>{calls.push({url,options:fetchOptions});if(options.fetch)return options.fetch(url,fetchOptions,calls.length);return{ok:true,status:200,json:async()=>({ok:true,data:{providers:['taobao_flash'],payments:['alipay'],addressLabel:'朋友本人地址',addressConfirmation:true}})};}
  };
  context.window=context;
  vm.runInNewContext(source,context,{filename:'delivery.js'});
  return{context,calls,storage};
}

const projectRef='bbbbbbbbbbbbbbbbbbbb';
const publishableKey='sb_publishable_friend_only_public_key';
const deploymentId='friend_20260825_abcd1234';
const isolated=runtime({
  endpoint:`https://${projectRef}.supabase.co/functions/v1/phone-delivery`,
  publishableKey,projectRef,deploymentId
});

assert.equal(isolated.context.S.food.real.enabled,false,'a new explicit deployment must start disabled');
assert.equal(isolated.context.S.food.real.addressLabel,'','old address labels must be removed on deployment change');
assert.equal(isolated.context.S.food.real.approvedAddressFingerprint,'','old address approval must be removed on deployment change');
assert.deepEqual(isolated.context.S.food.orders.map(row=>row.id),['virtual-story'],'old real orders must not cross into a new deployment');
assert.equal(isolated.context.S.food.cart.length,0,'old real cart must be cleared');
assert.equal(Object.keys(isolated.context.S.food.real.roleTasks).length,0,'old delivery task grants must be cleared');

isolated.context.deliverySetEnabled(true);
await isolated.context.deliveryRefreshCapabilities(false);
assert.ok(isolated.calls.length>=1,'the isolated connector should be callable');
const request=isolated.calls.at(-1);
assert.equal(request.url,`https://${projectRef}.supabase.co/functions/v1/phone-delivery`);
assert.equal(request.options.headers.apikey,publishableKey);
assert.equal(request.options.headers.Authorization,`Bearer ${publishableKey}`);
const body=JSON.parse(request.options.body);
assert.match(body.client.target,/^yb_[a-z0-9]{20,96}$/);
assert.notEqual(body.client.target,'yb_legacycloudidentity0000000000');
assert.match(body.client.ownerSecret,/^dls_/);
assert.notEqual(body.client.ownerSecret,'legacy-companion-owner-secret');

const oldTarget='yb_oldfriendidentity000000000000';
const oldSecret='dls_oldfriendsecret000000000000';

const publicWeb=runtime(undefined);
publicWeb.context.S.food.real.enabled=true;
await publicWeb.context.deliveryRefreshCapabilities(false);
assert.equal(publicWeb.calls.length,1,'the shared public web page should call the built-in delivery service once');
const publicClient=JSON.parse(publicWeb.calls[0].options.body).client;
assert.equal(publicClient.privateApp,false);
assert.match(publicClient.target,/^yb_[a-z0-9]{20,96}$/);
assert.match(publicClient.ownerSecret,/^dls_/);
assert.notEqual(publicClient.target,'yb_legacycloudidentity0000000000','public web delivery must not reuse an imported cloudId');
assert.notEqual(publicClient.ownerSecret,'legacy-companion-owner-secret','public web delivery must not reuse the general companion secret');
assert.equal(publicWeb.storage.get('north_delivery_client_target_v2_public_web'),publicClient.target);
assert.equal(publicWeb.storage.get('north_delivery_connector_secret_v2_public_web'),publicClient.ownerSecret);

const publicTargetKey='north_delivery_client_target_v2_public_web';
const publicSecretKey='north_delivery_connector_secret_v2_public_web';
const publicRecovered=runtime(undefined,{
  storage:{[publicTargetKey]:oldTarget,[publicSecretKey]:oldSecret,unrelated_key:'keep-me'},
  fetch:async(_url,_options,index)=>index===1
    ?{ok:false,status:401,json:async()=>({ok:false,error:'delivery-client-auth-failed'})}
    :{ok:true,status:200,json:async()=>({ok:true,data:{providers:['taobao_flash'],payments:['alipay'],addressLabel:'',addressConfirmation:true}})}
});
publicRecovered.context.S.food.real.enabled=true;
await publicRecovered.context.deliveryRefreshCapabilities(false);
assert.equal(publicRecovered.calls.length,2,'the public web identity should self-recover once when its own scoped secret mismatches');
const publicFirst=JSON.parse(publicRecovered.calls[0].options.body).client;
const publicSecond=JSON.parse(publicRecovered.calls[1].options.body).client;
assert.equal(publicFirst.target,oldTarget);
assert.equal(publicFirst.ownerSecret,oldSecret);
assert.notEqual(publicSecond.target,publicFirst.target);
assert.notEqual(publicSecond.ownerSecret,publicFirst.ownerSecret);
assert.equal(publicRecovered.storage.get('unrelated_key'),'keep-me');

const privateLegacy=runtime(undefined,{
  privateNativeApp:true,
  fetch:async()=>({ok:false,status:401,json:async()=>({ok:false,error:'delivery-client-auth-failed'})})
});
privateLegacy.context.S.food.real.enabled=true;
await privateLegacy.context.deliveryRefreshCapabilities(false);
assert.equal(privateLegacy.calls.length,1,'the private app legacy identity must never be rotated by the public web recovery path');
const privateClient=JSON.parse(privateLegacy.calls[0].options.body).client;
assert.equal(privateClient.privateApp,true);
assert.equal(privateClient.target,'yb_legacycloudidentity0000000000');
assert.equal(privateClient.ownerSecret,'legacy-companion-owner-secret');

const invalid=runtime({
  endpoint:'https://cccccccccccccccccccc.supabase.co/functions/v1/phone-delivery',
  publishableKey,projectRef,deploymentId
});
assert.equal(invalid.context.S.food.real.connectorUrl,'','a mismatched project endpoint must fail closed');
assert.match(invalid.context.S.food.real.connectorConfigError,/禁止回退到伴生云/);
invalid.context.deliverySetEnabled(true);
await invalid.context.deliveryRefreshCapabilities(false);
assert.equal(invalid.calls.length,0,'an invalid explicit config must never call the legacy companion URL');

const targetKey=`north_delivery_client_target_v2_${deploymentId}`;
const secretKey=`north_delivery_connector_secret_v2_${deploymentId}`;
const recovered=runtime({
  endpoint:`https://${projectRef}.supabase.co/functions/v1/phone-delivery`,
  publishableKey,projectRef,deploymentId
},{
  storage:{[targetKey]:oldTarget,[secretKey]:oldSecret,unrelated_key:'keep-me'},
  fetch:async(_url,_options,index)=>index===1
    ?{ok:false,status:401,json:async()=>({ok:false,error:'delivery-client-auth-failed'})}
    :{ok:true,status:200,json:async()=>({ok:true,data:{providers:['taobao_flash'],payments:['alipay'],addressLabel:'',addressConfirmation:true}})}
});
recovered.context.S.food.real.enabled=true;
recovered.context.S.food.real.addressLabel='朋友旧地址';
recovered.context.S.food.real.approvedAddressFingerprint='old-address-proof';
recovered.context.S.food.real.lastCapability={ok:true};
recovered.context.S.food.real.deviceLinkStatus={linked:true,online:true};
recovered.context.S.food.real.pendingCreates=[{id:'old'}];
recovered.context.S.food.real.roleTasks={old:{status:'running'}};
recovered.context.S.food.real.roleAttempts={old:{status:'running'}};
recovered.context.S.food.real.roleClarifications={old:{taskId:'old'}};
recovered.context.S.food.real.learnedMemories=[{id:'memory-kept',roleId:'r1',active:true}];
recovered.context.S.food.real.preferences={milkTea:{brands:'朋友自己的偏好'}};
recovered.context.S.food.cart=[{offerId:'stale-real-cart'}];
recovered.context.S.food.results=[{offerId:'stale-result'}];
recovered.context.S.food.orders=[{id:'stale-real',real:true},{id:'story-kept',real:false}];
await recovered.context.deliveryRefreshCapabilities(false);
assert.equal(recovered.calls.length,2,'an explicit auth mismatch should rotate identity and retry exactly once');
const firstAuth=JSON.parse(recovered.calls[0].options.body).client;
const secondAuth=JSON.parse(recovered.calls[1].options.body).client;
assert.equal(firstAuth.target,oldTarget);
assert.equal(firstAuth.ownerSecret,oldSecret);
assert.match(secondAuth.target,/^yb_[a-z0-9]{20,96}$/);
assert.match(secondAuth.ownerSecret,/^dls_/);
assert.notEqual(secondAuth.target,firstAuth.target);
assert.notEqual(secondAuth.ownerSecret,firstAuth.ownerSecret);
assert.equal(recovered.storage.get('unrelated_key'),'keep-me','identity recovery must not clear unrelated site data');
assert.equal(recovered.context.S.food.real.enabled,true,'identity recovery should keep the user setting enabled');
assert.equal(recovered.context.S.food.real.addressLabel,'');
assert.equal(recovered.context.S.food.real.approvedAddressFingerprint,'');
assert.equal(recovered.context.S.food.real.deviceLinkStatus,null);
assert.deepEqual(recovered.context.S.food.orders.map(row=>row.id),['story-kept']);
assert.equal(recovered.context.S.food.cart.length,0);
assert.equal(recovered.context.S.food.results.length,0);
assert.equal(recovered.context.S.food.real.learnedMemories[0].id,'memory-kept','learned preferences must survive identity recovery');
assert.equal(recovered.context.S.food.real.preferences.milkTea.brands,'朋友自己的偏好','manual preferences must survive identity recovery');

const repeatedFailure=runtime({
  endpoint:`https://${projectRef}.supabase.co/functions/v1/phone-delivery`,
  publishableKey,projectRef,deploymentId
},{
  storage:{[targetKey]:oldTarget,[secretKey]:oldSecret},
  fetch:async()=>({ok:false,status:401,json:async()=>({ok:false,error:'delivery-client-auth-failed'})})
});
repeatedFailure.context.S.food.real.enabled=true;
await repeatedFailure.context.deliveryRefreshCapabilities(false);
assert.equal(repeatedFailure.calls.length,2,'a repeated auth failure must stop after one identity rotation');
assert.equal(repeatedFailure.context.S.food.real.lastCapability.error,'delivery-client-auth-failed');

console.log('friend delivery config isolation tests passed');
