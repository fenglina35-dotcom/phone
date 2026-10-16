import assert from 'node:assert/strict';
import {createResumeTrace} from './resume-trace061.mjs';
let time=0,calls=0,reads=0,nextId=0;const timers=new Map(),doc=new EventTarget(),win=new EventTarget();doc.hidden=false;
const trace=createResumeTrace({doc,win,now:()=>time,read:()=>{reads++;return {draw:{calls:123}};},probe:{capture:async({count})=>{assert.equal(count,1);calls++;return {samples:[{status:'complete'}]};}},setTimer:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,at:time+ms});return id;},clearTimer:id=>timers.delete(id)});
const hidden=value=>{doc.hidden=value;doc.dispatchEvent(new Event('visibilitychange'));};
async function flush(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
function frame(){trace.begin();time+=5;trace.draw();time+=8;trace.end();}
for(let i=0;i<100;i++)frame();assert.equal(calls,0);assert.equal(reads,0);assert.equal(timers.size,0);
assert(trace.arm());win.dispatchEvent(new Event('pageshow'));assert.equal(trace.state(),'armed');
hidden(true);time+=5000;hidden(false);win.dispatchEvent(new Event('pageshow'));assert.equal(calls,1,'duplicate lifecycle events must not start duplicate runs');assert.equal(timers.size,1);assert.equal(trace.arm(),false);
const start=time;frame();assert.equal(trace.read().frames[0].intervalMs,null,'background time must not count as frame time');assert(trace.read().frames[0].probeActive);await flush();
time=start+100;frame();assert.equal(trace.read().frames[1].probeActive,false);
for(const offset of [3000,8000,15000]){time=start+offset;frame();await flush();}
assert.equal(calls,4);assert.equal(trace.read().probes.length,4);
time=start+20000;for(const t of [...timers.values()])t.fn();assert.equal(trace.state(),'done');assert.equal(timers.size,0);assert.equal(trace.read().status,'complete');const n=trace.read().frames.length;frame();assert.equal(trace.read().frames.length,n);
hidden(true);hidden(false);assert.equal(calls,4,'completed run never automatically rearms');
assert(trace.arm());hidden(true);hidden(false);await flush();frame();hidden(true);assert.equal(trace.read().status,'hidden-before-completion');assert.equal(timers.size,0);trace.dispose();
console.log('061: idle zero probes, explicit arm, lifecycle dedup, bounded recording, marked samples, hidden interruption and cleanup passed');
