import * as T from 'three';
import {budget} from './mobile-budget024.mjs?build=053';

// Light ownership follows manual switches, never the player's location.
// Surface masks bound the fragment work using object/light positions.
export function installMobileRendering(scene,house,camera){
 const sources={area:[],point:[],spot:[]};
 scene.traverse(l=>{
  if(l.userData?.mobileRenderSlot)return;
  if(l.isRectAreaLight)sources.area.push(l);
  else if(l.isPointLight)sources.point.push(l);
  else if(l.isSpotLight)sources.spot.push(l);
 });
 const originalCount=sources.area.length+sources.point.length+sources.spot.length;
 const slots=sources;
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
 const playerPos=new T.Vector3();
 let visibilityState='';
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
  const position=Number.isFinite(player?.x)?playerPos.set(player.x,player.y,player.z):camera.position,zone=zoneAt(position);
  budget.lightCohort='manual-all-rooms';
  return roomVisibility(position,zone,overview,editing);
 }
 function restore(){visibilityState='';for(const record of roomGroups)record.object.visible=record.visible;}
 budget.hiddenMeshes=0;budget.occlusionGroups=0;budget.localLightSlots=originalCount;budget.persistentLights=originalCount;
 budget.localLightTypes={area:slots.area.length,point:slots.point.length,spot:slots.spot.length};budget.roomCullCandidates=roomGroups.length;budget.visibilityPolicy='manual-lights-and-occluded-rooms';
 return {update,restore,lights:Object.values(slots).flat(),sources,slots};
}
