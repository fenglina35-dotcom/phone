import * as T from 'three';
import {lean,budget} from './mobile-budget024.mjs?build=050';

// Materials keep a stable shader while a uniform mask removes lights that
// cannot reach their geometry. Mobile render slots are preferred over authored
// source lights, which stay in the scene only as editable state.
export function bindSurfaceLights(scene,root){
 if(!lean)return {update(){},refresh(){}};
 const all={area:[],point:[],spot:[]};scene.traverse(l=>{
  if(l.userData?.mobileRenderSource)return;
  if(l.isRectAreaLight)all.area.push(l);else if(l.isPointLight)all.point.push(l);else if(l.isSpotLight)all.spot.push(l);
 });
 const slots=Object.values(all).flat().some(l=>l.userData?.mobileRenderSlot);
 const types=slots?Object.fromEntries(Object.entries(all).map(([k,list])=>[k,list.filter(l=>l.userData?.mobileRenderSlot)])):all;
 const records=new Map();
 root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(!m?.isMeshStandardMaterial)continue;
  if(!records.has(m))records.set(m,{m,objects:[],box:new T.Box3(),masks:Object.fromEntries(Object.entries(types).map(([k,a])=>[k,{value:new Float32Array(a.length).fill(1)}]))});
  records.get(m).objects.push(o);
 }});
 const box=new T.Box3(),tmp=new T.Box3(),pos=new T.Vector3();
 function rebuildGeometry(){
  root.updateMatrixWorld(true);for(const r of records.values())r.objects=[];
  root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])records.get(m)?.objects.push(o)});
  for(const r of records.values()){r.box.makeEmpty();for(const o of r.objects){tmp.setFromObject(o);r.box.union(tmp);}r.box.expandByScalar(1.5);}
 }
 function refresh(allOn=false){
  for(const r of records.values()){
   for(const mask of Object.values(r.masks))mask.value.fill(1);if(allOn||!r.objects.length)continue;
   box.copy(r.box);const ranked=types.area.map((l,i)=>({i,d:box.distanceToPoint(l.getWorldPosition(pos))})).sort((a,b)=>a.d-b.d);
   const keep=new Set(ranked.slice(0,4).map(x=>x.i));for(const x of ranked)if(x.d<.75)keep.add(x.i);
   for(let i=0;i<types.area.length;i++)r.masks.area.value[i]=keep.has(i)?1:0;
   for(const kind of ['point','spot'])types[kind].forEach((l,i)=>{r.masks[kind].value[i]=(!l.distance||box.distanceToPoint(l.getWorldPosition(pos))<=l.distance)?1:0;});
  }
 }
 rebuildGeometry();refresh();
 for(const r of records.values()){
  const before=r.m.onBeforeCompile,key=r.m.customProgramCacheKey.bind(r.m);
  r.m.onBeforeCompile=function(shader,renderer){
   before.call(this,shader,renderer);
   for(const [kind,array] of Object.entries(types)){shader.uniforms['surface_'+kind+'029']=r.masks[kind];shader.fragmentShader=`uniform float surface_${kind}029[${array.length}];\n`+shader.fragmentShader;}
   if(shader.fragmentShader.includes('#include <lights_fragment_begin>'))shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',T.ShaderChunk.lights_fragment_begin);
   for(const [kind,variable,array,call] of [['point','pointLight','pointLights','RE_Direct'],['spot','spotLight','spotLights','RE_Direct'],['area','rectAreaLight','rectAreaLights','RE_Direct_RectArea']]){
    const start=shader.fragmentShader.indexOf(`${variable} = ${array}[ i ];`);if(start<0)continue;
    const end=shader.fragmentShader.indexOf(';',shader.fragmentShader.indexOf(call+'(',start))+1;if(end<=0)continue;
    shader.fragmentShader=shader.fragmentShader.slice(0,start)+`if(surface_${kind}029[ UNROLLED_LOOP_INDEX ] > 0.5) {\n`+shader.fragmentShader.slice(start,end)+'\n }'+shader.fragmentShader.slice(end);
   }
  };
  r.m.customProgramCacheKey=()=>key()+'|surface-slots048';r.m.needsUpdate=true;
 }
 let editing=false;budget.surfaceAreaMaterials=records.size;budget.surfaceLightSlots=Object.fromEntries(Object.entries(types).map(([k,a])=>[k,a.length]));
 return {update(active){if(active!==editing){editing=active;if(!active)rebuildGeometry();refresh(active);}},refresh};
}
