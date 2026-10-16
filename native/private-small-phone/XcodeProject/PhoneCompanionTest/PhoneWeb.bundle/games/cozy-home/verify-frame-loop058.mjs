import assert from 'node:assert/strict';
import {createFrameClock,createFrameLoop} from './frame-loop058.mjs';
import {advanceWalk} from './walk030.mjs';
// Equal distance and animation time at both fast and slow refresh rates.
for(const fps of [120,60,30,25,15,10,8,5,4]){
 const clock=createFrameClock(),p={x:0,z:0,yaw:0},world={move(p,x,z){p.x+=x;p.z+=z}};let animation=0;
 clock.tick(0);for(let i=1;i<=fps;i++){
  const tick=clock.tick(i*1000/fps);
  for(let j=0;j<tick.steps;j++){
   animation+=tick.stepSeconds;
   assert(advanceWalk(world,p,0,1,tick.stepSeconds)<=2.15*.025+1e-9);
  }
 }
 assert(Math.abs(animation-1)<1e-9);assert(Math.abs(-p.z-2.15)<1e-9,`${fps} FPS must retain walking speed`);
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
console.log('058 frame-rate-independent substepped motion, no resume catch-up, single RAF owner passed');
