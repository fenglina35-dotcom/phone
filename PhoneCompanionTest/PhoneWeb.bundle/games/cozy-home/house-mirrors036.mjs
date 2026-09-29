import {installMirrorFrustum} from './mirror-frustum043.mjs';
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
 let reflecting=false;
 mirrors.forEach((m,index)=>{const render=m.onBeforeRender;let lastMobileRender=-Infinity;release.push(()=>{m.getRenderTarget?.().dispose();lastMobileRender=-Infinity;});m.onBeforeRender=function(renderer,scene,camera){
  if(reflecting||scene.overrideMaterial)return;
  const point=m.getWorldPosition(new T.Vector3()),distance=point.distanceTo(camera.position),ray=new T.Ray(camera.position,point.clone().sub(camera.position).normalize());
  // A 768px reflection that occupies only a few pixels still renders the whole
  // house. On phones, retain full mirror resolution nearby and reuse the last
  // reflection while it is distant. Nearby mirrors refresh on staggered ticks
  // so two mirrors never force two complete house renders in the same frame.
  if(mobile&&distance>5.5)return;
  if(mobile){const now=performance.now();if(lastMobileRender===-Infinity)lastMobileRender=now-1000-index*24;if(now-lastMobileRender<72)return;lastMobileRender=now;}
  // Opaque structural walls can completely occlude mirrors in other rooms.
  // Leave the already rendered texture alone when no reflected pixel is visible.
  for(const b of world?.colliders||[]){if(!['wall','divider','entry'].includes(b.kind))continue;const hit=ray.intersectBox(new T.Box3(new T.Vector3(b.x,b.base,b.z),new T.Vector3(b.x+b.w,b.base+b.height,b.z+b.d)),new T.Vector3());if(hit&&hit.distanceTo(camera.position)<distance-.12)return;}
  reflecting=true;const states=mirrors.map(o=>o.visible),restoreRender=installMirrorFrustum(m,renderer);
  try{for(const o of mirrors)if(o!==m)o.visible=false;render.call(m,renderer,scene,camera);m.userData.frames++;}
  finally{restoreRender();mirrors.forEach((o,i)=>o.visible=states[i]);reflecting=false;}
 };});
 return {mirrors,releaseGPU:()=>release.forEach(fn=>fn()),snapshot:()=>mirrors.map(m=>({name:m.userData.sourceName,frames:m.userData.frames,position:m.getWorldPosition(new T.Vector3()).toArray()}))};
}
