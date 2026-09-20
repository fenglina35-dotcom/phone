import * as T from 'three';
import {budget} from './mobile-budget024.mjs?build=050';

// Safari pays the lighting loop cost for every light in every lit fragment,
// including lights whose intensity is zero. Keep the authored lights as the
// source of truth, but feed the renderer a small, fixed-size cohort for the
// current room. The slot count never changes, so walking between rooms cannot
// trigger shader recompilation or the accompanying long frame.
export function installMobileRendering(scene,house,camera){
 const sources={area:[],point:[],spot:[]};
 scene.traverse(l=>{
  if(l.userData?.mobileRenderSlot)return;
  if(l.isRectAreaLight)sources.area.push(l);
  else if(l.isPointLight)sources.point.push(l);
  else if(l.isSpotLight)sources.spot.push(l);
 });
 const originalCount=sources.area.length+sources.point.length+sources.spot.length;
 for(const list of Object.values(sources))for(const light of list){light.userData.mobileRenderSource=true;light.visible=false;}

 const slots={area:[],point:[],spot:[]};
 const addSlot=(kind,light)=>{light.name=`Mobile ${kind} light slot`;light.userData.mobileRenderSlot=true;light.castShadow=false;light.intensity=0;scene.add(light);slots[kind].push(light);return light;};
 for(let i=0;i<4;i++)addSlot('area',new T.RectAreaLight(0xffffff,0,1,1));
 for(let i=0;i<3;i++)addSlot('point',new T.PointLight(0xffffff,0,0,2));
 for(let i=0;i<2;i++){const light=addSlot('spot',new T.SpotLight(0xffffff,0,0,Math.PI/4,0,2));light.target.name='Mobile spot target';light.target.userData.mobileRenderSlot=true;scene.add(light.target);}

 const anchors={
  kitchen:new T.Vector3(3.4,1.2,3.7),living:new T.Vector3(10.7,1.2,3.7),bedroom:new T.Vector3(18.3,1.2,3.7),bath:new T.Vector3(23.7,1.2,3.7),
  office:new T.Vector3(10.2,1.2,12.3),rear:new T.Vector3(16.8,.4,11.8),basement:new T.Vector3(19.5,-1.6,14)
 };
 const zoneAt=p=>p.y<-.7?'basement':p.z>7.8?(p.x<13.2?'office':'rear'):p.x<6.6?'kitchen':p.x<14.6?'living':p.x<21.2?'bedroom':'bath';
 const structural=/door|hinge|finish|floor|ceiling|wallpaper|casing|roof/i,roomGroups=[];
 for(const object of house.main.children){
  if(!object.name||structural.test(object.name))continue;
  let meshes=0;object.traverse(o=>{if(o.isMesh)meshes++;});if(!meshes)continue;
  const bounds=new T.Box3().setFromObject(object);if(bounds.isEmpty())continue;
  let zone=null;
  if(bounds.max.z<=7.5&&bounds.min.x>=21.05)zone='bath';
  else if(bounds.max.z<=7.5&&bounds.min.x>=14.45&&bounds.max.x<=21.3)zone='bedroom';
  else if(bounds.min.z>=9.15&&bounds.max.x<=12.95)zone='office';
  else if(bounds.max.z<=7.5&&bounds.max.x<=6.7)zone='kitchen';
  else if(bounds.max.z<=7.5&&bounds.min.x>=6.5&&bounds.max.x<=14.7)zone='living';
  if(zone)roomGroups.push({object,zone,visible:object.visible});
 }
 const worldPos=new T.Vector3(),worldQuat=new T.Quaternion(),playerPos=new T.Vector3(),sourceForSlot=new Map();
 let cohort='',sourceState='',visibilityState='';
 const intensityState=()=>Object.values(sources).flat().map(l=>`${l.visible?1:0}:${Math.round(l.intensity*1000)}`).join(',');
 const score=(light,anchor)=>{
  const distance=light.getWorldPosition(worldPos).distanceToSquared(anchor);
  // Prefer lights that can currently contribute. A zero-intensity lamp remains
  // eligible as a spare slot, so a day/night switch can be copied immediately.
  return distance+(light.intensity>0?0:400);
 };
 function select(zone,force=false){
  const state=intensityState();if(!force&&zone===cohort&&state===sourceState)return false;
  cohort=zone;sourceState=state;const anchor=anchors[zone]||anchors.living;
  for(const kind of Object.keys(slots)){
   const ranked=[...sources[kind]].sort((a,b)=>score(a,anchor)-score(b,anchor));
   slots[kind].forEach((slot,i)=>sourceForSlot.set(slot,ranked[i]||null));
  }
  budget.lightCohort=cohort;return true;
 }
 function copyCommon(slot,source){
  if(!source){slot.intensity=0;return;}
  slot.visible=true;slot.color.copy(source.color);slot.intensity=source.intensity;
  source.getWorldPosition(worldPos);source.getWorldQuaternion(worldQuat);slot.position.copy(worldPos);slot.quaternion.copy(worldQuat);
 }
 function sync(){
  for(const slot of slots.area){const source=sourceForSlot.get(slot);copyCommon(slot,source);if(source){slot.width=source.width;slot.height=source.height;}}
  for(const slot of slots.point){const source=sourceForSlot.get(slot);copyCommon(slot,source);if(source){slot.distance=source.distance;slot.decay=source.decay;}}
  for(const slot of slots.spot){const source=sourceForSlot.get(slot);copyCommon(slot,source);if(source){slot.distance=source.distance;slot.decay=source.decay;slot.angle=source.angle;slot.penumbra=source.penumbra;source.target.getWorldPosition(worldPos);slot.target.position.copy(worldPos);}}
 }
 function roomVisibility(position,zone,overview,editing){
  const near=(x,z,d=3.2)=>Math.hypot(position.x-x,position.z-z)<d;
  const key=overview||editing?'all':`${zone}:${near(14.6,6)?1:0}${near(21.2,6)?1:0}${near(12.8,12.4)?1:0}`;if(key===visibilityState)return false;visibilityState=key;
  const keep=new Set(zone==='kitchen'||zone==='living'?['kitchen','living']:zone==='bedroom'?['bedroom','living']:zone==='bath'?['bath']:zone==='office'?['office']:zone==='rear'?['office','bedroom']:[]);
  if(near(14.6,6)){keep.add('bedroom');keep.add('living');}
  if(near(21.2,6)){keep.add('bath');keep.add('bedroom');keep.add('living');}
  if(near(12.8,12.4)){keep.add('office');keep.add('living');}
  let hidden=0;for(const record of roomGroups){const visible=record.visible&&(overview||editing||keep.has(record.zone));record.object.visible=visible;if(!visible)hidden++;}
  budget.culledRoomGroups=hidden;return true;
 }
 function update(player,dt,overview=false,editing=false){
  const position=Number.isFinite(player?.x)?playerPos.set(player.x,player.y,player.z):camera.position,zone=zoneAt(position),changed=select(zone);sync();return roomVisibility(position,zone,overview,editing)||changed;
 }
 function restore(){cohort='';sourceState='';visibilityState='';for(const record of roomGroups)record.object.visible=record.visible;}
 select('living',true);sync();roomVisibility(anchors.living,'living',false,false);
 budget.hiddenMeshes=0;budget.occlusionGroups=0;budget.localLightSlots=slots.area.length+slots.point.length+slots.spot.length;budget.persistentLights=originalCount;
 budget.localLightTypes={area:slots.area.length,point:slots.point.length,spot:slots.spot.length};budget.roomCullCandidates=roomGroups.length;budget.visibilityPolicy='fixed-room-light-cohort-and-occluded-rooms';
 return {update,restore,lights:Object.values(slots).flat(),sources,slots};
}
