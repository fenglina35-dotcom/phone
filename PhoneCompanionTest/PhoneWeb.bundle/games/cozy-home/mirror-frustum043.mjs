import * as T from 'three';
const scratch=new WeakMap();

// The reflector texture only contributes pixels under the mirror's projected
// rectangle. Cull against that smaller cone without changing its projection,
// texture resolution, update rate, or the main camera's visibility.
export function installMirrorFrustum(mirror,renderer){
 if(mirror.userData.fullReflectionFrustum)return ()=>{};
 const original=renderer.render,box=mirror.geometry.boundingBox;
 if(!box)mirror.geometry.computeBoundingBox();
 const b=mirror.geometry.boundingBox,uvMatrix=mirror.material.uniforms.textureMatrix.value;
 let state=scratch.get(mirror);
 if(!state){state={corner:new T.Vector4(),crop:new T.Matrix4(),projection:new T.Matrix4(),frustum:new T.Frustum(),hidden:[]};scratch.set(mirror,state);}
 const {corner,crop,projection,frustum,hidden}=state;
 renderer.render=function(scene,camera){
  if(camera!==mirror.camera)return original.call(this,scene,camera);
  let minX=1,minY=1,maxX=0,maxY=0;
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){
   corner.set(x,y,b.max.z,1).applyMatrix4(uvMatrix);
   if(corner.w<=.0001)return original.call(this,scene,camera);
   const u=corner.x/corner.w,v=corner.y/corner.w;
   minX=Math.min(minX,u);maxX=Math.max(maxX,u);minY=Math.min(minY,v);maxY=Math.max(maxY,v);
  }
  const target=mirror.getRenderTarget(),padX=4/target.width,padY=4/target.height;
  minX=Math.max(0,minX-padX);minY=Math.max(0,minY-padY);maxX=Math.min(1,maxX+padX);maxY=Math.min(1,maxY+padY);
  const width=maxX-minX,height=maxY-minY;
  if(width<=0||height<=0)return original.call(this,scene,camera);
  crop.set(1/width,0,0,(1-minX-maxX)/width,0,1/height,0,(1-minY-maxY)/height,0,0,1,0,0,0,0,1);
  projection.multiplyMatrices(crop,camera.projectionMatrix).multiply(camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projection);
  hidden.length=0;
  scene.traverse(o=>{
   if(!o.isMesh||!o.visible||o.children.length||o.isSkinnedMesh||o.morphTargetInfluences||!o.frustumCulled)return;
   if(Array.isArray(o.material)?o.material.some(m=>m.displacementMap):o.material.displacementMap)return;
   if(!frustum.intersectsObject(o)){hidden.push(o);o.visible=false;}
  });
  mirror.userData.culledOutsideSurface=hidden.length;
  try{return original.call(this,scene,camera);}finally{for(const o of hidden)o.visible=true;hidden.length=0;}
 };
 return ()=>{renderer.render=original;};
}
