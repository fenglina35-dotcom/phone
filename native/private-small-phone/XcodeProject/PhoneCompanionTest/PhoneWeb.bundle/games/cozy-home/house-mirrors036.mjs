import {installMirrorFrustum} from './mirror-frustum043.mjs?build=055';
import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

export function installHouseMirrors(scene,house,{mobile=false,world}={}){
 const names=new Set(['Vanity mirror inset','Quiet mirror surface','Full length mirror inset','Small round mirror']);
 const sources=[];house.root.traverse(o=>{if(o.isMesh&&names.has(o.name))sources.push(o)});
 const mirrors=[],release=[];
 for(const source of sources){
  source.geometry.computeBoundingBox();const b=source.geometry.boundingBox,size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
  const geometry=source.name==='Small round mirror'?new T.CircleGeometry(size.x/2,64):new T.PlaneGeometry(size.x,size.y);
  const mirror=new Reflector(geometry,{color:0x808080,textureWidth:mobile?768:1536,textureHeight:mobile?768:1536,clipBias:.001,multisample:mobile?0:2});
  mirror.name='Live '+source.name;mirror.userData.liveMirror=true;mirror.camera.layers.enable(1);
  const holder=new T.Group();holder.name=source.name+' reflection mount';holder.position.copy(source.position);holder.quaternion.copy(source.quaternion);holder.scale.copy(source.scale);
  mirror.position.set(center.x,center.y,b.max.z+.001);holder.add(mirror);source.parent.add(holder);source.visible=false;
  mirror.userData.sourceName=source.name;mirror.userData.frames=0;mirrors.push(mirror);
 }
 // Render only mirrors actually drawn by the main camera. Other mirrors are
 // excluded during each reflection pass, preventing recursive full-scene work.
 let reflecting=false,restoreVisibility=fn=>fn(),chosen,now=0;
 const lastUpdate=new Map(),position=new T.Vector3(),cameraPosition=new T.Vector3(),normal=new T.Vector3(),toward=new T.Vector3(),rotation=new T.Matrix4(),projection=new T.Matrix4(),frustum=new T.Frustum(),ray=new T.Ray(),hit=new T.Vector3();
 const blockers=(world?.colliders||[]).filter(b=>['wall','divider','entry'].includes(b.kind)).map(b=>new T.Box3(new T.Vector3(b.x,b.base,b.z),new T.Vector3(b.x+b.w,b.base+b.height,b.z+b.d)));
 const stats={passes:0,calls:0,triangles:0,pixels:0};
 function eligible(m,camera){
  for(let p=m;p;p=p.parent)if(!p.visible)return false;
  m.getWorldPosition(position);camera.getWorldPosition(cameraPosition);
  const distance=position.distanceTo(cameraPosition);
  const initialized=lastUpdate.has(m);
  if(initialized&&mobile&&distance>5.5)return false;
  rotation.extractRotation(m.matrixWorld);normal.set(0,0,1).applyMatrix4(rotation);
  if(toward.copy(position).sub(cameraPosition).dot(normal)>0||!frustum.intersectsObject(m))return false;
  // A lost render target has no previous picture to retain. Capture it once
  // when front-facing/in frame, even if a distance/blocker heuristic would
  // defer subsequent refreshes. Still obey the one-reflection-per-frame limit.
  if(!initialized)return true;
  ray.origin.copy(cameraPosition);ray.direction.copy(position).sub(cameraPosition).normalize();
  return !blockers.some(b=>ray.intersectBox(b,hit)&&hit.distanceTo(cameraPosition)<distance-.12);
 }
 function select(camera){
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
  let oldest=null,oldestTime=Infinity;for(const m of mirrors){const time=lastUpdate.get(m)??-Infinity;if(now-time>=72&&time<oldestTime&&eligible(m,camera)){oldest=m;oldestTime=time;}}return oldest;
 }
 const api={mirrors,invalidate(){lastUpdate.clear();chosen=undefined;},beginFrame(time=performance.now()){now=time;chosen=undefined;stats.passes=stats.calls=stats.triangles=stats.pixels=0;},setVisibilityGuard(fn){restoreVisibility=fn;},read:()=>({...stats}),releaseGPU:()=>release.forEach(fn=>fn()),snapshot:()=>mirrors.map(m=>({name:m.userData.sourceName,frames:m.userData.frames,position:m.getWorldPosition(new T.Vector3()).toArray()}))};
 mirrors.forEach(m=>{const render=m.onBeforeRender;release.push(()=>{m.getRenderTarget().dispose();lastUpdate.delete(m);});m.onBeforeRender=function(renderer,scene,camera){
  if(reflecting||scene.overrideMaterial)return;
  // One reflection per MAIN frame, even when a slow frame exceeds 72 ms.
  // Oldest eligible surface wins, so a nearby large mirror cannot starve another.
  if(mobile){if(chosen===undefined)chosen=select(camera);if(chosen!==m)return;chosen=null;}
  else {projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);if(!eligible(m,camera))return;}
  reflecting=true;const states=mirrors.map(o=>o.visible),calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;
  try{restoreVisibility(()=>{
   const restoreRender=installMirrorFrustum(m,renderer);
   try{for(const o of mirrors)if(o!==m)o.visible=false;render.call(m,renderer,scene,camera);m.userData.frames++;lastUpdate.set(m,now);}
   finally{restoreRender();}
  });stats.passes++;stats.calls+=renderer.info.render.calls-calls;stats.triangles+=renderer.info.render.triangles-triangles;stats.pixels+=m.userData.reflectionPixels??m.getRenderTarget().width*m.getRenderTarget().height;}
  finally{mirrors.forEach((o,i)=>o.visible=states[i]);reflecting=false;}
 };});
 return api;
}
