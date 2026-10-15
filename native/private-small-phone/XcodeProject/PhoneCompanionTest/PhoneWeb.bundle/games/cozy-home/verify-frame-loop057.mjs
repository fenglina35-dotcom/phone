import assert from 'node:assert/strict';
import {createFrameClock,createFrameLoop} from './frame-loop057.mjs';
import {advanceWalk} from './walk030.mjs';
// A held direction cannot accumulate a multi-frame leap; walking and animation
// consume exactly the same simulated time at 60/30/10 FPS and after a stall.
for(const fps of [60,30,10]){
 const clock=createFrameClock(),p={x:0,z:0,yaw:0},world={move(p,x,z){p.x+=x;p.z+=z}};let animation=0;
 clock.tick(0);for(let i=1;i<=fps;i++){const {seconds}=clock.tick(i*1000/fps);animation+=seconds;const distance=advanceWalk(world,p,0,1,seconds);assert(distance<=2.15*.04+1e-9);}
 assert(Math.abs(-p.z-2.15*animation)<1e-9);if(fps>=30)assert(Math.abs(-p.z-2.15)<1e-9);
 assert.equal(clock.tick(10000).seconds,0);clock.reset();assert.equal(clock.tick(20000).seconds,0);
}
let next=0,draws=0;const queued=new Map(),cancelled=[];
const loop=createFrameLoop(()=>draws++,{request:fn=>{queued.set(++next,fn);return next},cancel:id=>{cancelled.push(queued.get(id));queued.delete(id)}});
loop.start();for(let i=0;i<20;i++){loop.start();loop.resume('page')}assert.equal(queued.size,1);
loop.pause('page');loop.pause('hidden');assert.equal(queued.size,0);
loop.resume('page');assert.equal(queued.size,0);loop.resume('hidden');assert.equal(queued.size,1);
cancelled[0](1000);assert.equal(draws,0,'late cancelled callback cannot fork a second chain');
const [id,callback]=[...queued][0];queued.delete(id);callback(1016);assert.equal(draws,1);assert.equal(queued.size,1);
loop.pause('context');loop.resume('page');assert.equal(queued.size,0);loop.resume('context');assert.equal(queued.size,1);
console.log('057 consistent motion clock, no resume catch-up, single RAF owner passed');
