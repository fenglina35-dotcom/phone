import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),P=require('../pixel-home-policy.js');
const sandbox={};vm.runInNewContext(fs.readFileSync('pixel-wardrobe-info.js','utf8'),sandbox);const info=JSON.parse(JSON.stringify(sandbox.PixelHomeWardrobeInfo));
const at=(day,h,m=0)=>new Date(2026,8,day,h,m).getTime();
const looks=()=>({...structuredClone(info.approved),adjustments:{hair6:{x:12,y:-4}},savedOutfits:[{id:'set-a',name:'月牙白裙',look:{...structuredClone(info.approved),hair:'hair6',adjustments:{hair6:{x:12,y:-4}}}}]});
const choice=(o={})=>JSON.stringify({setId:null,dress:'outfit7-dress',shoes:'outfit1-shoes',accessory:'retained-pink-headband',hair:'hair6',reason:'我喜欢温柔的粉色和轻巧的小辫子',...o});
test('08/19 slots run once; night spans midnight; catch-up applies only current period',()=>{
 const e={appliedDay:'2026-09-07',pajamasDay:'2026-09-06'};
 assert.equal(P.wardrobeSlot(e,at(7,7,59)),null);assert.equal(P.wardrobeSlot(e,at(7,18,59)),null);
 assert.equal(P.wardrobeSlot(e,at(7,19)).key,'2026-09-07:evening');e.pajamasDay='2026-09-07';
 assert.equal(P.wardrobeSlot(e,at(8,7,59)),null);assert.equal(P.wardrobeSlot(e,at(8,8)).key,'2026-09-08:morning');
 assert.equal(P.wardrobeSlot({},at(8,1)).key,'2026-09-07:evening');assert.equal(P.wardrobeSlot(e,at(6,8)),null);
});
test('role selects all built-ins despite named sets, preserving fitting/body/face',()=>{
 const w=looks(),e={state:{wardrobe:w}};
 for(const o of info.outfits){const r=P.roleWardrobe(e,info,at(7,8),choice({dress:o.dress}));assert.equal(r.wardrobe.dress,o.dress);assert.deepEqual(r.wardrobe.body,w.body);assert.equal(r.wardrobe.face,w.face);assert.deepEqual(r.wardrobe.savedOutfits,w.savedOutfits);assert.deepEqual(r.wardrobe.adjustments.hair6,{x:12,y:-4});assert.equal(r.source,'role-model');}
});
test('named outfit fitting is restored with independently chosen hair',()=>{
 const w=looks();w.savedOutfits[0].look.adjustments['outfit1-dress']={x:9};const r=P.roleWardrobe({state:{wardrobe:w}},info,at(7,8),choice({setId:'set-a',dress:'outfit1-dress',shoes:'outfit1-shoes',accessory:'outfit1-accessory',hair:'hair1'}));
 assert.equal(r.setName,'月牙白裙');assert.equal(r.wardrobe.hair,'hair1');assert.deepEqual(r.wardrobe.adjustments['outfit1-dress'],{x:9});assert.equal(w.hair,info.approved.hair);
});
test('night requires pajamas, accepts all 8 hairs, rejects fabricated items',()=>{
 const e={state:{wardrobe:looks()}};
 for(let n=0;n<8;n++){const r=P.roleWardrobe(e,info,at(7,19),choice({dress:'outfit3-dress',shoes:'outfit3-shoes',accessory:'outfit3-accessory',hair:'hair'+n}));assert.equal(r.items.hair.id,'hair'+n);assert.equal(r.setId,'outfit3');}
 for(const raw of ['bad',choice({hair:'hair8'}),choice({dress:'outfit0-dress'}),choice({accessory:'outfit6-accessory'}),choice({setId:'set-missing'})])assert.throws(()=>P.roleWardrobe(e,info,at(7,8),raw));
 assert.throws(()=>P.roleWardrobe(e,info,at(7,19),choice()));
});
function fixture(model){
 const c={id:'one',name:'伴侣',persona:'偏爱温柔田园风',model:'aux'},other={id:'two',name:'其他'};
 const ctx={S:{couple:{cid:'one'},me:{name:'玩家'}},actId:()=>1,getC:id=>id==='one'?c:other,cur:()=>({p:'pixelhome'}),PixelHomePolicy:P,PixelHomeWardrobeInfo:info,Date,console,window:{addEventListener(){}},document:{getElementById:()=>null},setInterval(){},setTimeout,clearTimeout,saveNowAsync:()=>Promise.resolve(true),location:{protocol:'file:',origin:'null'},chatAPI:model,roleChatRouteIndex:()=>3};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('pixel-home.js','utf8'),ctx);ctx.looks=looks();ctx.now=at(7,8);vm.runInContext('var i=pixelHomeIdentity();pixelHomeEntry(i).state={version:3,wardrobe:looks};',ctx);return ctx;
}
test('persona model sees all items; concurrent calls deduplicate; facts only after execution',async()=>{
 let resolve,calls=0,request,opts;const ctx=fixture((m,o)=>{calls++;request=m;opts=o;return new Promise(r=>resolve=r);});
 const a=vm.runInContext('pixelHomeApplyDaily(i,now)',ctx),b=vm.runInContext('pixelHomeApplyDaily(i,now)',ctx);assert.equal(calls,1);assert(request[0].content.includes('偏爱温柔田园风'));const data=JSON.parse(request[1].content);assert.equal(Object.keys(data.items).filter(k=>/^hair\d$/.test(k)).length,8);assert(data.items['outfit11-dress']);assert.equal(data.savedSets[0].name,'月牙白裙');assert.equal(opts.routeIndex,3);assert.equal(opts.aux,true);
 resolve(choice());const r=await a;assert.equal((await b).setName,r.setName);assert.equal(r.items.hair.name,'月牙双小揪揪');assert.equal(await vm.runInContext('pixelHomeApplyDaily(i,now)',ctx),null);assert.equal(calls,1);
 const text=vm.runInContext('pixelHomeRoleContext(getC("one"))',ctx);assert(text.includes(r.reason));assert(text.includes('猫咪格纹裙'));assert.equal(vm.runInContext('pixelHomeRoleContext(getC("two"))',ctx),'');ctx.actId=()=>2;assert.equal(vm.runInContext('pixelHomeRoleContext(getC("one"))',ctx),'');assert.equal(calls,1);
});
test('model failure preserves outfit/history and does not retry each second',async()=>{
 let calls=0;const ctx=fixture(async()=>{calls++;return 'bad format';});vm.runInContext('pixelHomeEntry(i).outfitAttempt="2026-09-07:morning"',ctx);assert.equal(await vm.runInContext('pixelHomeApplyDaily(i,now)',ctx),null);assert.equal(await vm.runInContext('pixelHomeApplyDaily(i,now)',ctx),null);assert.equal(calls,1);const e=vm.runInContext('pixelHomeEntry(i)',ctx);assert.equal(e.dailyOutfit,undefined);assert.equal(e.state.wardrobe.dress,info.approved.dress);assert(e.outfitError);
});
test('late responses cannot overwrite manual adjustments, editor, or other role',async()=>{
 for(const change of ['pixelHomeEntry(i).state.wardrobe.hair="hair3"','_pixelHome={wardrobeEditing:true}','S.couple.cid="two"']){
  let resolve;const ctx=fixture(()=>new Promise(r=>resolve=r));const promise=vm.runInContext('pixelHomeApplyDaily(i,now)',ctx);vm.runInContext(change,ctx);resolve(choice());assert.equal(await promise,null);assert.equal(vm.runInContext('pixelHomeEntry(i).dailyOutfit',ctx),undefined);
 }
});
test('role context is read-only, never triggers a nested model request',()=>{
 let calls=0;const ctx=fixture(()=>{calls++;throw Error('unexpected');});ctx.cur=()=>({p:'chat'});assert(vm.runInContext('pixelHomeRoleContext(getC("one"))',ctx).includes('月牙白裙'));assert.equal(calls,0);
});
