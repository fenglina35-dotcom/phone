// Explicitly armed, one foreground return only. No extra RAF or normal-play GPU work.
// Fence observations include browser/driver scheduling and are not GPU execution time.
export function createResumeTrace({probe,read,now=()=>performance.now(),doc=document,win=window,setTimer=setTimeout,clearTimer=clearTimeout}){
 let state='idle',hiddenSeen=false,run=null,last=null,timer=null,frame=null,previous=null,busy=false;
 const listeners=new Set(),probeTimes=[0,3000,8000,15000];let probeIndex=0;
 const notify=()=>{for(const fn of listeners)fn(state);};
 function stop(reason){
  if(state!=='recording')return;
  clearTimer(timer);timer=null;run.status=reason;run.durationMs=now()-run.startAt;
  last=run;state='done';frame=null;notify();
 }
 function start(){
  if(state!=='armed'||!hiddenSeen||doc.hidden||busy)return;
  previous=null;probeIndex=0;
  run={method:'foreground-return-20s-with-marked-sparse-fences',startAt:now(),status:'recording',frames:[],probes:[],notes:['Fence polling/flush can affect scheduling. Compare unprobed frames separately.','Completion observations are wall-time bounds, not GPU execution times.']};
  state='recording';timer=setTimer(()=>stop('complete'),20000);notify();
  sample();
 }
 function sample(){
  if(state!=='recording'||busy||probeIndex>=probeTimes.length||now()-run.startAt<probeTimes[probeIndex])return;
  probeIndex++;busy=true;
  const target=run,row={atMs:now()-run.startAt};target.probes.push(row);
  // capture queues the fence on the next actual draw; no extra render is requested.
  try{Promise.resolve(probe.capture({count:1})).then(result=>{row.result=result;},error=>{row.error=String(error);}).finally(()=>{row.finishedAtMs=now()-target.startAt;busy=false;});}
  catch(error){row.error=String(error);row.finishedAtMs=now()-target.startAt;busy=false;}
 }
 function visibility(){
  if(doc.hidden){if(state==='armed')hiddenSeen=true;stop('hidden-before-completion');}
  else start();
 }
 function pagehide(){if(state==='armed')hiddenSeen=true;stop('page-hidden');}
 doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',pagehide);win.addEventListener('pageshow',start);
 return {
  arm(){if(busy||state==='recording')return false;state='armed';hiddenSeen=doc.hidden;notify();return true;},
  cancel(){if(state==='recording')stop('cancelled');else{state='idle';notify();}},
  subscribe(fn){listeners.add(fn);fn(state);return()=>listeners.delete(fn);},
  state:()=>state,read:()=>state==='recording'?run:last,
  begin(){
   if(state!=='recording')return;
   if(now()-run.startAt>=20000){stop('complete');return;}
   sample();const at=now();frame={atMs:at-run.startAt,intervalMs:previous===null?null:at-previous,probeActive:busy};previous=at;
  },
  draw(){if(frame)frame.drawAt=now();},
  end(){if(!frame||state!=='recording')return;const at=now();frame.cpuMs=at-(run.startAt+frame.atMs);frame.submissionMs=frame.drawAt===undefined?null:at-frame.drawAt;delete frame.drawAt;
   Object.assign(frame,read());run.frames.push(frame);frame=null;if(run.frames.length>=3000)stop('frame-limit');
  },
  dispose(){stop('disposed');clearTimer(timer);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',pagehide);win.removeEventListener('pageshow',start);listeners.clear();}
 };
}
