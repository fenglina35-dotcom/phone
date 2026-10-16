import * as T from 'three';
// Cull only boxes wholly hidden by one actual opaque cuboid mesh. Collision
// walls are deliberately not used: they can span transparent window openings.
export function installWallOcclusion(renderer,scene,house,mainCamera,{enabled=()=>true}={}){
 const occluderObjects=[];house.root.traverse(o=>{if(!o.isMesh||o.geometry.type!=='BoxGeometry'||Array.isArray(o.material)||o.material.transparent||o.material.alphaTest||o.material.opacity<1)return;const p=o.geometry.parameters;if(p.width*p.height+p.width*p.depth+p.height*p.depth>.35)occluderObjects.push(o);});
 const bounds=new WeakMap(),frustum=new T.Frustum(),projection=new T.Matrix4(),origin=new T.Vector3(),corner=new T.Vector3(),hit=new T.Vector3(),ray=new T.Ray(),walls=[],hidden=[];
 let culled=0,passes=0,active=false,fullVisibility=0;const api={enabled:true,snapshot:()=>({culled,passes}),withFullVisibility(work){if(!active||fullVisibility)return work();fullVisibility++;for(const o of hidden)o.visible=true;try{return work();}finally{for(const o of hidden)o.visible=false;fullVisibility--;}}};
 function worldBox(o){let r=bounds.get(o);const version=o.geometry.attributes.position?.version||0;if(!r){r={box:new T.Box3(),matrix:new T.Matrix4(),version:-1};bounds.set(o,r);}
  if(r.geometry!==o.geometry||r.version!==version||!r.matrix.equals(o.matrixWorld)){if(r.geometry!==o.geometry||r.version!==version||!o.geometry.boundingBox)o.geometry.computeBoundingBox();r.box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);r.matrix.copy(o.matrixWorld);r.version=version;r.geometry=o.geometry;}
  return r.box;
 }
 function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
 function behind(box,wall){
  if(wall.containsPoint(origin)||wall.intersectsBox(box))return false;
  for(let i=0;i<8;i++){
   corner.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z);
   const distance=corner.distanceTo(origin);ray.origin.copy(origin);ray.direction.copy(corner).sub(origin).normalize();
   if(!ray.intersectBox(wall,hit)||hit.distanceToSquared(origin)>=(distance-.025)**2)return false;
  }return true;
 }
 const original=renderer.render,expanded=new T.Box3();let shadowManager;
 // Shadow casters need full scene visibility, but the color pass after them
 // can still skip hidden surfaces while doors or furniture are moving.
 function bindShadows(){if(shadowManager===renderer.shadowMap)return;shadowManager=renderer.shadowMap;const renderShadows=shadowManager.render;shadowManager.render=function(...args){return api.withFullVisibility(()=>renderShadows.apply(this,args));};}
 bindShadows();renderer.domElement.addEventListener('webglcontextrestored',bindShadows);
 renderer.render=function(s,c){
  // Reflections keep their independent visibility and the exact original scene.
  if(active)return api.withFullVisibility(()=>original.call(this,s,c));
  if(s!==scene||c!==mainCamera||!api.enabled||!enabled())return original.call(this,s,c);
  scene.updateMatrixWorld();c.updateMatrixWorld();origin.setFromMatrixPosition(c.matrixWorld);projection.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
  walls.length=0;for(const o of occluderObjects){const m=o.material,e=o.matrixWorld.elements;if(!visible(o)||o.geometry.type!=='BoxGeometry'||Array.isArray(m)||!m.depthWrite||!m.depthTest||!m.colorWrite||m.transparent||m.alphaTest||m.opacity<1||m.blending!==T.NormalBlending||o.geometry.drawRange.start!==0||Number.isFinite(o.geometry.drawRange.count)||Math.abs(e[1])+Math.abs(e[2])+Math.abs(e[4])+Math.abs(e[6])+Math.abs(e[8])+Math.abs(e[9])>1e-7)continue;const b=worldBox(o);if(!b.isEmpty()&&!b.containsPoint(origin)&&frustum.intersectsBox(b))walls.push(b);}
  walls.sort((a,b)=>a.distanceToPoint(origin)-b.distanceToPoint(origin));if(walls.length>40)walls.length=40;
  hidden.length=0;house.root.traverseVisible(o=>{
   if(!o.isMesh||o.children.length||o.isSkinnedMesh||o.isInstancedMesh||o.morphTargetInfluences||o.userData.liveMirror||!o.frustumCulled)return;
   const b=worldBox(o);if(!frustum.intersectsBox(b))return;expanded.copy(b).expandByScalar(.04);
   if(walls.some(w=>behind(expanded,w))){hidden.push(o);o.visible=false;}
  });
  active=true;culled=hidden.length;passes++;const auto=scene.matrixWorldAutoUpdate;scene.matrixWorldAutoUpdate=false;
  try{return original.call(this,s,c);}finally{for(const o of hidden)o.visible=true;hidden.length=0;active=false;scene.matrixWorldAutoUpdate=auto;}
 };
 return api;
}
