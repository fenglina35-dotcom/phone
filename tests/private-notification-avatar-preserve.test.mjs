import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const path='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js';
const app=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const block=app.slice(app.indexOf('function rolePushAvatarSource('),app.indexOf('// Same user turn, one result owner.'));
function fixture({source='data:image/png;base64,PHOTO',loadFail=false,readFail=false,tainted=false,oversize=false,readHang=false,loadHang=false}={}){
 const state={fallback:0,draw:0,sent:[],remote:'LAST_GOOD_PHOTO'};
 const ctx2d={fillRect(){},beginPath(){},arc(){},fill(){},createLinearGradient(){return {addColorStop(){}}},fillText(){state.fallback++},drawImage(){state.draw++}};
 const role={id:'role-a',avatar:'idb:photo-a',name:'先生',proactive:{enabled:true,serverPush:true}};
 const context={document:{createElement(){return {getContext:()=>ctx2d,toDataURL(){if(tainted)throw Error('tainted');return oversize?'x'.repeat(50001):state.draw?'data:image/jpeg;base64,PHOTO':'data:image/jpeg;base64,MONOGRAM'}}}},
  Image:class {naturalWidth=96;naturalHeight=96;set src(v){if(!loadHang)queueMicrotask(()=>loadFail?this.onerror():this.onload())}},
  setTimeout:(fn,ms)=>setTimeout(fn,ms===5000?10:ms),clearTimeout,_imgCache:{},_imgRev:new Map(),_imgReady:new Set(),
  isStoredImgRef:v=>typeof v==='string'&&v.startsWith('idb:'),isImg:v=>/^(https?:|data:|blob:)/i.test(v),
  imgGet:async()=>{if(readFail)throw Error('idb unavailable');if(readHang)return new Promise(()=>{});return source},
  gateOK:()=>true,roleServerPushProfile:c=>({roleId:c.id,enabled:c.proactive.enabled}),cloudId:()=> 'target-a',companionOwnerSecret:()=> 'fixture-secret',
  companionRpc:async(name,args)=>{state.sent.push(args);if(args.p_profile.avatarData)state.remote=args.p_profile.avatarData;return true},
  roleServerPushCheckStatus(){},toast(){},_roleServerPushStatusById:{}};
 vm.createContext(context);vm.runInContext(block,context);return {context,role,state};
}
for(const problem of [{source:''},{loadFail:true},{readFail:true},{tainted:true},{oversize:true},{readHang:true},{loadHang:true}]){
 test('notification photo failure preserves photo without blocking profile '+JSON.stringify(problem),async()=>{
  const {context,role,state}=fixture(problem);
  assert.equal(await context.roleServerPushSync(role,true),true);
  assert.equal(state.sent.length,1);assert.equal(state.sent[0].p_profile.enabled,true);
  assert.equal(state.sent[0].p_profile.avatarData,'');assert.equal(state.remote,'LAST_GOOD_PHOTO');
  assert.equal(state.fallback,0,'a configured photo must never become a letter');
 });
}
test('successful stored photo is uploaded and restores a previous monogram',async()=>{
 const {context,role,state}=fixture();state.remote='MONOGRAM';
 assert.equal(await context.roleServerPushSync(role,true),true);
 assert.equal(state.remote,'data:image/jpeg;base64,PHOTO');assert.equal(state.fallback,0);
});
test('explicit emoji avatar remains supported',async()=>{
 const {context,role,state}=fixture();role.avatar='🌸';await context.roleServerPushSync(role,true);
 assert.equal(state.fallback,1);assert.equal(state.sent.length,1);
});
test('shared friend serializer keeps its old fallback when not in notification mode',async()=>{
 const {context,role,state}=fixture({loadFail:true});
 assert.equal(await context.rolePushAvatarData(role),'data:image/jpeg;base64,MONOGRAM');assert.equal(state.fallback,1);
});
test('changed avatar during decoding cannot upload old photo',async()=>{
 const {context,role,state}=fixture();
 context.imgGet=async()=>{role.avatar='idb:new-photo';return 'data:image/png;base64,OLD'};
 await context.roleServerPushSync(role,true);assert.equal(state.sent[0].p_profile.avatarData,'');
});
