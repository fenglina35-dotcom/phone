import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../smart-home.js',import.meta.url),'utf8');

function fixture({linked=false,known=false,page='chat'}={}){
  let nextTimer=1,currentPage=page;
  const timers=new Map(),intervals=[],requests=[],store=new Map();
  if(known)store.set('north_smart_home_linked_v1','1');
  const responses={
    device_status:{ok:true,data:{linked,online:linked}},
    control:{ok:true,data:{ok:true,verified:true,state:{power:true,brightness:40,hue:335,saturation:60}}},
    snapshot:{ok:true,data:{ok:true,verified:true,state:{power:true,brightness:40,hue:335,saturation:60}}}
  };
  const runtime={
    window:null,S:{settings:{}},COMPANION_URL:'https://example.test',COMPANION_KEY:'public-key',
    document:{hidden:false,getElementById:()=>null,addEventListener:()=>{}},
    uid:()=> 'test-id',crypto:{getRandomValues:value=>value.fill(7),randomUUID:()=> '00000000-0000-4000-8000-000000000000'},
    localStorage:{getItem:key=>store.get(key)||'',setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},
    setTimeout(fn,ms){const id=nextTimer++;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
    setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},
    esc:String,save:()=>{},render:()=>{},cur:()=>({p:currentPage}),toast:()=>{},openModal:()=>{},closeModal:()=>{},confirm:()=>false,
    fetch:async(_url,opt)=>{const body=JSON.parse(opt.body);requests.push(body.action);return{ok:true,status:200,json:async()=>responses[body.action]};},
    AbortController:globalThis.AbortController,Number,Math,String,Object,Array,Promise,Error,RegExp,JSON,Date,Set,console
  };
  runtime.window=runtime;
  vm.runInNewContext(source,runtime);
  return{runtime,timers,intervals,requests,store,setPage:value=>{currentPage=value;}};
}

test('public web makes zero automatic smart-home requests or polling timers',async()=>{
  const f=fixture({linked:false});
  for(let i=0;i<6;i++)await Promise.resolve();
  assert.deepEqual(f.requests,[]);
  assert.equal(f.intervals.length,0,'web runtime must not keep the native 20-second interval');
  assert.equal([...f.timers.values()].some(row=>row.ms===1200||row.ms===180000||row.ms===300000),false);
});

test('new web pairing is paused without spending an Edge invocation',async()=>{
  const f=fixture({linked:false,page:'wxsmarthome'});
  const page=f.runtime.renderWxSmartHome();
  assert.match(page,/网页配对暂时关闭/);
  assert.match(page,/恢复已有配对/);
  assert.doesNotMatch(page,/生成十位配对码/);
  assert.equal(await f.runtime.wxSmartHomePairCode(),false);
  assert.deepEqual(f.requests,[]);
});

test('explicit restore records an existing pairing and reads real state once',async()=>{
  const f=fixture({linked:true,page:'wxsmarthome'});
  assert.equal(await f.runtime.wxSmartHomeRestore(),true);
  assert.deepEqual(f.requests,['device_status','snapshot']);
  assert.equal(f.store.get('north_smart_home_linked_v1'),'1');
  assert.equal(f.runtime.wxSmartHomeRoleAvailable(),true);
});

test('saved paired browser stays idle until a real role control',async()=>{
  const f=fixture({linked:true,known:true});
  assert.equal(f.runtime.wxSmartHomeRoleAvailable(),true);
  assert.deepEqual(f.requests,[]);
  const result=await f.runtime.wxSmartHomeRoleExecute({power:'on'});
  assert.equal(result.verified,true);
  assert.deepEqual(f.requests,['control']);
});

test('unpaired browser cannot accidentally invoke role control',async()=>{
  const f=fixture({linked:false});
  assert.equal(f.runtime.wxSmartHomeRoleAvailable(),false);
  const result=await f.runtime.wxSmartHomeRoleExecute({power:'on'});
  assert.equal(result.verified,false);
  assert.match(result.message,/恢复已有配对/);
  assert.deepEqual(f.requests,[]);
});
