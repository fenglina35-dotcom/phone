import assert from 'node:assert/strict';
import {createFrameProbe} from './frame-probe060.mjs';
globalThis.document=new EventTarget();document.hidden=false;
let made=0,deleted=0,polls=0,flushes=0,mode='complete';
const gl={SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,WAIT_FAILED:4,isContextLost:()=>mode==='lost',fenceSync:()=>({id:++made}),deleteSync:()=>deleted++,flush:()=>flushes++,clientWaitSync:()=>{polls++;return mode==='fail'?4:2}};
const renderer={getContext:()=>gl,domElement:new EventTarget()},probe=createFrameProbe(renderer);
for(let i=0;i<100;i++){probe.begin();probe.end()};assert.equal(made,0,'ordinary frames must not allocate syncs or poll');
const a=probe.capture();assert.equal(a,probe.capture(),'duplicate clicks share one request');
const clock=setInterval(()=>{probe.begin();probe.end()},1);
try{
 const r=await a;assert.equal(r.samples.length,3);assert(r.samples.every(x=>x.status==='complete'));assert.equal(made,deleted);assert.equal(flushes,3);assert.equal(polls,3);
 mode='fail';const failed=await probe.capture();assert.equal(failed.samples.length,1);assert.equal(failed.samples[0].status,'wait-failed');assert.equal(made,deleted);
 mode='lost';const lost=await probe.capture();assert.equal(lost.samples[0].status,'unavailable');assert.equal(made,deleted);
 document.hidden=true;assert.equal((await probe.capture()).samples.length,0);
}finally{clearInterval(clock)}
console.log('060 on-demand probe: no idle GL work, single request, bounded samples, sync cleanup passed');
