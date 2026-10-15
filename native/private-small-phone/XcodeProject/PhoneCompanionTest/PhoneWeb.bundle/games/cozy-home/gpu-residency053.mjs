// Release only image textures that have not contributed to any main/reflection
// pass for a while. CPU sources stay intact for re-entry and context restoration.
// Shared sources are one eviction unit: never dispose a sibling still in use.
export function installTextureResidency(scene,renderer,{idleMs=20000}={}){
 const records=new Map(),materials=new WeakMap();
 let now=performance.now(),nextSweep=now+2000,evictions=0;
 const history=[],events=[];
 function maps(material){
  let entry=materials.get(material);
  if(!entry||entry.version!==material.version){
   entry={version:material.version,textures:Object.values(material).filter(t=>t?.isTexture&&t.image&&!t.isRenderTargetTexture&&!t.isDataTexture&&!t.isCubeTexture&&t.mapping===300)};
   materials.set(material,entry);
   for(const t of entry.textures){let r=records.get(t.source);if(!r){r={last:now,textures:new Set()};records.set(t.source,r);}r.textures.add(t);}
  }
  return entry.textures;
 }
 scene.traverse(o=>{
  if(!o.isMesh||o.userData.liveMirror)return;
  for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)maps(m);
  const after=o.onAfterRender;
  o.onAfterRender=function(r,s,c,g,m,...rest){
   for(const t of maps(m))records.get(t.source).last=now;
   after.call(this,r,s,c,g,m,...rest);
  };
 });
 function snapshot(){
  const handles=new Map();let invalidSources=0;
  for(const [source,r]of records){
   const im=source.data;if(!im?.width||!im?.height)invalidSources++;
   for(const t of r.textures){const h=renderer.properties.get(t).__webglTexture;if(h)handles.set(h,Math.ceil((im?.width||0)*(im?.height||0)*4*(t.generateMipmaps?4/3:1)));}
  }
  return {at:Math.round(now),textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,programs:renderer.info.programs?.length||0,imageTextureBytes:[...handles.values()].reduce((a,b)=>a+b,0),invalidSources,evictions};
 }
 function begin(time){now=time;}
 function end(){
  if(now<nextSweep||renderer.getContext().isContextLost())return;
  nextSweep=now+2000;
  for(const r of records.values()){
   if(now-r.last<idleMs)continue;
   for(const t of r.textures)if(renderer.properties.get(t).__webglTexture){t.dispose();evictions++;}
  }
  history.push(snapshot());if(history.length>180)history.shift();
 }
 function event(type){events.push({at:Math.round(performance.now()),type});if(events.length>20)events.shift();}
 renderer.domElement.addEventListener('webglcontextlost',()=>event('context-lost'));
 renderer.domElement.addEventListener('webglcontextrestored',()=>event('context-restored'));
 return {begin,end,snapshot,report:()=>({current:snapshot(),history:[...history],events:[...events]})};
}
