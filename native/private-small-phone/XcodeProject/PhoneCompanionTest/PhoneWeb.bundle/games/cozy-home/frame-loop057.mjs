// A single owner for the main RAF chain. Repeated Safari lifecycle notifications
// must neither duplicate callbacks nor replay time spent suspended.
export function createFrameClock({maxStep=.04,stallMs=350}={}){
 let last=null,rawMs=0,seconds=0,clamped=0,stalls=0,resets=0;
 return {reset(){last=null;rawMs=seconds=0;resets++;},tick(time){
  rawMs=last===null?0:Math.max(0,time-last);last=time;
  const stalled=rawMs>stallMs;if(stalled)stalls++;
  seconds=stalled?0:Math.min(maxStep,rawMs/1000);
  if(!stalled&&rawMs>maxStep*1000)clamped++;
  return {rawMs,seconds,stalled};
 },snapshot:()=>({rawMs,seconds,maxStep,clamped,stalls,resets})};
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
