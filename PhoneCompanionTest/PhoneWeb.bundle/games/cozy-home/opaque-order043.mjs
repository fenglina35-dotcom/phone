// Keep authored group/render ordering and transparent sorting unchanged.
// Nearby opaque depth bands reject hidden fragments early while retaining
// material batching inside each band. Reflection passes retain material order.
export function createOpaqueSort(renderer){
 return (a,b)=>{
  const band=renderer.getRenderTarget()===null?2048:0;
  return a.groupOrder-b.groupOrder||a.renderOrder-b.renderOrder||
   Math.floor(a.z*band)-Math.floor(b.z*band)||a.material.id-b.material.id||a.z-b.z||a.id-b.id;
 };
}
