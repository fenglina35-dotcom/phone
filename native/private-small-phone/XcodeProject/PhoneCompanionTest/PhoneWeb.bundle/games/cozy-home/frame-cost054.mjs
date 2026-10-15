// Fixed memory, no per-frame logging, texture reads or GPU synchronization.
export function createFrameCosts(){
 const cpu=new Float32Array(300),submit=new Float32Array(300);let cursor=0,count=0,start=0,drawStart=0;
 return {begin(){start=performance.now();},draw(){drawStart=performance.now();},end(){const end=performance.now();cpu[cursor]=end-start;submit[cursor]=end-drawStart;cursor=(cursor+1)%300;count=Math.min(300,count+1);},read(){
  const summarize=a=>{const sorted=Array.from(a.subarray(0,count)).sort((a,b)=>a-b);return {meanMs:count?sorted.reduce((a,b)=>a+b,0)/count:0,p95Ms:sorted[Math.floor(count*.95)]||0};};
  return {samples:count,cpu:summarize(cpu),renderSubmission:summarize(submit)};
 }};
}
