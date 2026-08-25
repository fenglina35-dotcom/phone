import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');

function runtime(config){
  const storage=new Map();
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
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},
    crypto:crypto.webcrypto,URL,AbortController,Date,Math,JSON,Promise,console,
    document:{hidden:false,addEventListener(){}},
    addEventListener(){},setTimeout(){return 0},clearTimeout(){},
    uid:()=>`id${Math.random().toString(36).slice(2)}000000000000000000000000`,
    cloudId:()=> 'yb_legacycloudidentity0000000000',
    companionOwnerSecret:()=> 'legacy-companion-owner-secret',
    privateNativeAppOn:()=>false,actId:()=> 'main',msgs:()=>[],getC:()=>null,
    save(){},render(){},toast(){},openModal(){},closeModal(){},esc:v=>String(v),
    scheduleReply(){},chatAPI:async()=>'',cur:()=>({p:'chat'}),
    fetch:async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>({ok:true,data:{providers:['taobao_flash'],payments:['alipay'],addressLabel:'朋友本人地址',addressConfirmation:true}})};}
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

const invalid=runtime({
  endpoint:'https://cccccccccccccccccccc.supabase.co/functions/v1/phone-delivery',
  publishableKey,projectRef,deploymentId
});
assert.equal(invalid.context.S.food.real.connectorUrl,'','a mismatched project endpoint must fail closed');
assert.match(invalid.context.S.food.real.connectorConfigError,/禁止回退到伴生云/);
invalid.context.deliverySetEnabled(true);
await invalid.context.deliveryRefreshCapabilities(false);
assert.equal(invalid.calls.length,0,'an invalid explicit config must never call the legacy companion URL');

console.log('friend delivery config isolation tests passed');
