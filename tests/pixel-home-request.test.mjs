import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),policy=require('../pixel-home-policy.js');
const source=fs.readFileSync(new URL('../pixel-home.js',import.meta.url),'utf8');
const result=JSON.stringify({actions:['feed','touch'],looks:[0,1,0,1,0,1,0]});
function fixture({storage=()=>Promise.resolve(true),model=()=>Promise.resolve(result)}={}){
  const timers=new Map(),messages=[],calls=[];let next=0;
  const c={id:'role',name:'伴侣'},ctx=vm.createContext({S:{couple:{cid:c.id},me:{name:'玩家'}},getC:()=>c,actId:()=>1,cur:()=>({p:'pixelhome'}),PixelHomePolicy:policy,Date,console,
    window:{addEventListener(){}},location:{protocol:'https:',origin:'https://fixture.invalid'},
    document:{getElementById:()=>({contentWindow:{postMessage:m=>messages.push(m)}})},
    setInterval(){},setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
    saveNowAsync:storage,roleChatRouteIndex:()=>2,chatAPI:(messages,opt)=>{calls.push(opt);return model(messages,opt);}});
  vm.runInContext(source+"\n_pixelHome={...pixelHomeIdentity(),token:'test'};",ctx);
  return {ctx,calls,messages,timers,run:()=>vm.runInContext('pixelHomePlan(_pixelHome,true)',ctx),entry:()=>vm.runInContext('pixelHomeEntry(_pixelHome)',ctx)};
}
test('care reaches model and returns despite a stalled phone storage queue',async()=>{
  const f=fixture({storage:()=>new Promise(()=>{})}),r=await f.run();
  assert.equal(r.actions[0],'feed');assert.equal(f.calls.length,1);assert.equal(f.calls[0].complete,false);assert.equal(f.calls[0].routeIndex,2);
  assert.equal(f.calls[0].max,1000);
});
test('simultaneous automatic/manual care requests share one model result',async()=>{
  let resolve;const f=fixture({model:()=>new Promise(r=>resolve=r)}),a=f.run(),b=f.run();
  assert.equal(f.calls.length,1);resolve(result);assert.deepEqual(await a,await b);
});
test('whole-request timeout rejects, retains latch and discards a late result',async()=>{
  let resolve;const f=fixture({model:()=>new Promise(r=>resolve=r)}),p=f.run();
  const rejected=assert.rejects(p,/等待超时/);[...f.timers.values()].find(t=>t.ms===65000).fn();await rejected;
  await assert.rejects(f.run(),/等待超时/);assert.equal(f.calls.length,1);
  resolve(result);await new Promise(r=>setImmediate(r));assert.equal(Object.keys(f.entry().plan).length,0);
  assert.equal(vm.runInContext('_pixelHome.pending',f.ctx),null);
});
test('invalid plan does not retry or invent actions',async()=>{
  const f=fixture({model:async()=>'{"actions":['});await assert.rejects(f.run());assert.equal(f.calls.length,1);
  assert.equal(Object.keys(f.entry().plan).length,0);
});
test('storage failure stays visible while valid care still returns',async()=>{
  const f=fixture({storage:async()=>false});await f.run();await new Promise(r=>setImmediate(r));
  assert(f.messages.some(m=>m.id==='storage'&&m.error.includes('尚未保存')));
});
test('unbinding before model completion never applies old plans',async()=>{
  let resolve;const f=fixture({model:()=>new Promise(r=>resolve=r)}),p=f.run();
  vm.runInContext('S.couple.cid=null',f.ctx);resolve(result);await assert.rejects(p,/已停止/);
  assert.equal(Object.keys(f.entry().plan).length,0);
});
test('bundled file canvas data is byte-identical to original art in both entries',()=>{
  for(const root of ['games/pixel-home/','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/games/pixel-home/']){
    for(const name of fs.readdirSync(root+'assets').filter(n=>n.endsWith('.png'))){
      const text=fs.readFileSync(root+'asset-data/'+name+'.js','utf8');
      const encoded=text.match(/^window.PixelHomeLocalImage='data:image\/png;base64,([A-Za-z0-9+/=]+)';\r?\n$/)?.[1];
      assert(encoded,name);assert.deepEqual(Buffer.from(encoded,'base64'),fs.readFileSync(root+'assets/'+name));
    }
  }
});
