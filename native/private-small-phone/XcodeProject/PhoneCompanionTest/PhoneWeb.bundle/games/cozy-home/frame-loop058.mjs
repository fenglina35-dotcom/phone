// A single owner for the main RAF chain. Repeated Safari lifecycle notifications
// must neither duplicate callbacks nor replay time spent suspended.
// Preserve real elapsed time during ordinary slow frames. Subdivide simulation,
// never discard part of each frame: a 10 FPS display must not mean 40% walking speed.
export function createFrameClock({maxStep=.025,stallMs=250}={}){
 let last=null,rawMs=0,seconds=0,steps=0,stalls=0,resets=0;
 return {reset(){last=null;rawMs=seconds=steps=0;resets++;},tick(time){
  rawMs=last===null?0:Math.max(0,time-last);last=time;
  const stalled=rawMs>stallMs;if(stalled)stalls++;
  seconds=stalled?0:rawMs/1000;steps=Math.max(1,Math.ceil(seconds/maxStep));
  return {rawMs,seconds,steps,stepSeconds:seconds/steps,stalled};
 },snapshot:()=>({rawMs,seconds,maxStep,steps,stalls,resets})};
}
export function createFrameLoop(draw,{request=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
 let handle=null,started=false,generation=0,frames=0;const pauses=new Set();
 function schedule(){
  if(!started||pauses.size||handle!==null)return;
  const token=generation;
  handle=request(time=>{if(token!==generation)return;handle=null;if(pauses.size||!started)return;frames++;draw(time);schedule();});
 }
 return {start(){started=true;schedule();},pause(reason){
  if(pauses.has(reason))return;pauses.add(reason);generation++;
  if(handle!==null){cancel(handle);handle=null;}
 },resume(reason){pauses.delete(reason);schedule();},snapshot:()=>({started,pending:handle!==null,pauses:[...pauses],frames})};
}
