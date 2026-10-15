// Count actual passes, including shadow work inside renderer.render. Submission
// time is CPU wall time; it is deliberately not labelled GPU time.
export function createRenderPassStats(renderer,mirrors){
 const samples=new Array(300);let cursor=0,count=0,shadows=0,shadowCalls=0,shadowTriangles=0,last=null;
 let shadowManager;
 function bindShadows(){if(shadowManager===renderer.shadowMap)return;shadowManager=renderer.shadowMap;const renderShadow=shadowManager.render;
 shadowManager.render=function(...args){
  const before=renderer.info.render.calls,triangles=renderer.info.render.triangles;
  try{return renderShadow.apply(this,args);}finally{
   const calls=renderer.info.render.calls-before;
   if(calls){shadows++;shadowCalls+=calls;shadowTriangles+=renderer.info.render.triangles-triangles;}
  }
 };}
 bindShadows();renderer.domElement?.addEventListener('webglcontextrestored',bindShadows);
 return {begin(){shadows=shadowCalls=shadowTriangles=0;},end(){
  const reflection=mirrors.read(),total=renderer.info.render;
  last={calls:total.calls,triangles:total.triangles,mainCalls:total.calls-shadowCalls-reflection.calls,mainTriangles:total.triangles-shadowTriangles-reflection.triangles,shadowPasses:shadows,shadowCalls,shadowTriangles,reflectionPasses:reflection.passes,reflectionCalls:reflection.calls,reflectionTriangles:reflection.triangles,reflectionPixels:reflection.pixels};
  samples[cursor]=last;cursor=(cursor+1)%samples.length;count=Math.min(samples.length,count+1);
 },read(){
  const mean={};for(let i=0;i<count;i++)for(const [key,value]of Object.entries(samples[i]))mean[key]=(mean[key]||0)+value/count;
  return {samples:count,last,mean};
 }};
}
