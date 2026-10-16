// User-triggered, bounded GPU completion probe. Fence observations are wall-time
// bounds, NOT GPU execution time. No gl.finish, blocking waits or pixel reads.
export function createFrameProbe(renderer){
 let pending=null,active=null,running=null,last=null,preceding=null;
 const now=()=>performance.now();
 function one(){return new Promise(resolve=>{
  const request={resolve,queued:now(),timer:null};
  request.timer=setTimeout(()=>{if(pending===request){pending=null;resolve({status:'no-frame',waitMs:now()-request.queued});}},3000);
  pending=request;
 });}
 function begin(){
  if(preceding){preceding.row.nextDrawAfterSubmitMs=now()-preceding.at;preceding=null;}
  if(!pending||active)return;
  const request=pending;pending=null;clearTimeout(request.timer);
  active={...request,start:now()};
  active.timer=setTimeout(()=>{if(active?.resolve===request.resolve){active=null;request.resolve({status:'render-did-not-finish'});}},3000);
 }
 function end(){
  if(!active)return;
  const request=active;active=null;
  clearTimeout(request.timer);
  const gl=renderer.getContext(),submitted=now();
  const row={status:'pending',submissionMs:submitted-request.start,polls:0,lastUnsignaledAfterSubmitMs:null,completedObservedAfterSubmitMs:null,firstPollAfterSubmitMs:null,nextDrawAfterSubmitMs:null};
  if(gl.isContextLost()||typeof gl.fenceSync!=='function'){request.resolve({...row,status:'unavailable'});return;}
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!sync){request.resolve({...row,status:'no-fence'});return;}
  gl.flush();
  let finished=false,timer;
  const finish=status=>{
   if(finished)return;finished=true;clearTimeout(timer);
   renderer.domElement.removeEventListener('webglcontextlost',lost);
   document.removeEventListener('visibilitychange',visibility);
   if(!gl.isContextLost())gl.deleteSync(sync);
   row.status=status;preceding={row,at:submitted};request.resolve(row);
  };
  const lost=()=>finish('context-lost');
  const visibility=()=>{if(document.hidden)finish('hidden');};
  renderer.domElement.addEventListener('webglcontextlost',lost);
  document.addEventListener('visibilitychange',visibility);
  function poll(){
   if(gl.isContextLost()){finish('context-lost');return;}
   const elapsed=now()-submitted;
   row.polls++;row.firstPollAfterSubmitMs??=elapsed;
   const status=gl.clientWaitSync(sync,0,0);
   if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED){row.completedObservedAfterSubmitMs=elapsed;finish('complete');return;}
   if(status===gl.WAIT_FAILED){finish('wait-failed');return;}
   row.lastUnsignaledAfterSubmitMs=elapsed;
   if(elapsed>=600){finish('timeout');return;}
   timer=setTimeout(poll,8);
  }
  timer=setTimeout(poll,0);
 }
 return {begin,end,read:()=>last,capture({count=3}={}){
  if(running)return running;
  running=(async()=>{
   const samples=[];
   for(let i=0;i<Math.max(1,Math.min(3,count));i++){if(document.hidden)break;const row=await one();samples.push(row);if(row.status!=='complete')break;}
   last={method:'nonblocking-fence-wall-time-bounds',samples};return last;
  })().finally(()=>{running=null;});
  return running;
 }};
}
