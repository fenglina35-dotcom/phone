import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export const rooms018=[
 {id:'living',label:'客厅',p:[14.54,1.22,5.02],yaw:-Math.PI/2},
 {id:'kitchen',label:'厨房餐厅',p:[6.54,1.22,5.02],yaw:-Math.PI/2},
 {id:'bedroom',label:'卧室',p:[14.66,1.22,5.02],yaw:Math.PI/2},
 {id:'bath',label:'卫生间',p:[21.26,1.22,5.02],yaw:Math.PI/2},
 {id:'office',label:'书房',p:[12.74,1.22,11.38],yaw:-Math.PI/2},
 {id:'hall',label:'楼梯过道',p:[14.54,1.22,10.3],yaw:-Math.PI/2},
 {id:'basement',label:'地下工作室',p:[21.70,-1.93,14.35],yaw:-Math.PI/2},
 {id:'cell',label:'禁闭室',p:[21.58,-1.93,11.55],yaw:-Math.PI/2}
];
export function roomIndex(p){
 if(p.y<-.03){if(p.x<17.45&&p.z<14.24)return 5;if(p.x>=17.45&&p.z<12.22)return 7;return 6;}
 if(p.z>7.42)return p.x<12.8&&p.z>=9.15?4:5;
 return p.x<6.6?1:p.x<14.6?0:p.x<21.2?2:3;
}
export function installRoomControls(house,scene,renderer,lighting){
 const key='cozy-room-switches-v018';let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
 const values=new Float32Array(8).fill(1),targets=rooms018.map(r=>saved[r.id]===false?0:1);
 values.set(targets);const switches=[];
 const plateMat=new T.MeshStandardMaterial({name:'018 ivory switch enamel',color:'#e8e5dd',roughness:.46});
 const insetMat=new T.MeshStandardMaterial({name:'018 switch recess',color:'#7b7e80',roughness:.8});
 for(const [i,r] of rooms018.entries()){
  const g=new T.Group();g.name='Wall switch / '+r.label;g.position.fromArray(r.p);g.rotation.y=r.yaw;g.userData.roomSwitch=i;house.root.add(g);
  const part=(name,size,z,m)=>{const o=new T.Mesh(new RoundedBoxGeometry(...size,3,.003),m);o.name=name;o.position.z=z;o.castShadow=o.receiveShadow=true;g.add(o);return o;};
  part('Square wall switch mounting plate',[.094,.094,.012],0,plateMat);part('Recess around rocker',[.069,.073,.009],.009,insetMat);
  const rocker=part('Single tactile rocker',[.062,.066,.013],.015,plateMat);rocker.rotation.x=targets[i]?-.10:.10;
  const indicator=new T.Mesh(new T.BoxGeometry(.012,.002,.001),new T.MeshBasicMaterial({color:'#657b91'}));indicator.name='Subtle locator mark';indicator.position.set(0,-.022,.023);g.add(indicator);
  switches.push({...r,index:i,object:g,rocker});
 }
 // A spatial material response is necessary because sky illumination and reflection
 // probes are shared. Turning point lights off alone leaves rooms visibly lit.
 // Keep existing cloth/outline shader hooks and apply the mask to final radiance.
 const installed=new WeakSet();
 function patchMaterials(){house.root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(installed.has(m)||m.isShaderMaterial||m.isShadowMaterial)return;installed.add(m);
  const before=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m),oldKey=cache();
  m.onBeforeCompile=function(s,r){before.call(this,s,r);s.uniforms.roomOn018={value:values};
   s.vertexShader='varying vec3 roomWorld018;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 roomP018=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     roomP018=instanceMatrix*roomP018;
    #endif
    roomWorld018=(modelMatrix*roomP018).xyz;`);
   s.fragmentShader=`varying vec3 roomWorld018;uniform float roomOn018[8];
    float roomState018(vec3 p){
     if(p.y<-.03){if(p.x<17.45&&p.z<14.24)return roomOn018[5];if(p.x>=17.45&&p.z<12.22)return roomOn018[7];return roomOn018[6];}
     if(p.z>7.42){if(p.x<12.8&&p.z>=9.15)return roomOn018[4];return roomOn018[5];}
     if(p.x<6.6)return roomOn018[1];if(p.x<14.6)return roomOn018[0];if(p.x<21.2)return roomOn018[2];return roomOn018[3];}
    `+s.fragmentShader;
   const marker=s.fragmentShader.includes('#include <opaque_fragment>')?'#include <opaque_fragment>':'#include <output_fragment>';
   s.fragmentShader=s.fragmentShader.replace(marker,`float roomLight018=roomState018(roomWorld018);
    float roomLum018=dot(outgoingLight,vec3(.2126,.7152,.0722));
    outgoingLight=mix(vec3(.0018,.0032,.0075)+vec3(.009,.017,.038)*min(roomLum018,1.5),outgoingLight,roomLight018);
    `+marker);
  };m.customProgramCacheKey=()=>oldKey+'|room-mask-018';m.needsUpdate=true;
 }});}
 patchMaterials();
 const lights=[],fixtureOverrides=new Map();scene.traverse(l=>{if(l.isLight&&!l.isDirectionalLight&&!l.isHemisphereLight&&!l.isAmbientLight){const pos=l.getWorldPosition(new T.Vector3());lights.push({light:l,index:roomIndex(pos),source:l.intensity,applied:l.intensity});}});
 // Keep light counts stable: changing Light.visible causes a shader recompile
 // across the whole furnished house. Zero intensity switches without that stall.
 const setMode=lighting.setMode;lighting.setMode=(...args)=>{for(const r of lights)r.light.intensity=r.source;setMode(...args);for(const r of lights)r.source=r.applied=r.light.intensity;};
 for(const method of ['adjust','setCustom','moveFixture']){const original=lighting[method];lighting[method]=(...args)=>{for(const r of lights)r.light.intensity=r.source;const result=original(...args);for(const r of lights)r.source=r.applied=r.light.intensity;return result;};}
 const fixtureNames={entry:'玄关台灯',chest:'斗柜台灯',reading:'落地阅读灯'};
 function fixtureLight(id){return lighting.editableLights.find(e=>e.id===id)?.light;}
 function toggle(i){targets[i]=targets[i]?0:1;values[i]=targets[i];switches[i].rocker.rotation.x=targets[i]?-.10:.10;
  try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(rooms018.map((r,n)=>[r.id,!!targets[n]]))));}catch{}
  renderer.shadowMap.needsUpdate=true;return rooms018[i].label+(targets[i]?'灯已打开':'灯已关闭');}
 function nearby(p,camera){const n=roomIndex(p);return switches.find(s=>{if(s.index!==n||Math.hypot(p.x-s.p[0],p.z-s.p[2])>=1.65||Math.abs(p.y+1.22-s.p[1])>=.65)return false;if(!camera)return true;const to=new T.Vector3(...s.p).sub(camera.position).normalize();return camera.getWorldDirection(new T.Vector3()).dot(to)>.87;});}
 return {switches,toggle,nearby,patchMaterials,state:()=>Object.fromEntries(rooms018.map((r,i)=>[r.id,!!targets[i]])),
  toggleFixture(id){const l=fixtureLight(id),on=!(fixtureOverrides.get(id)?.on??(l?.intensity>0));fixtureOverrides.set(id,{on,power:Math.max(l?.intensity||0,({entry:4.4,chest:3.3,reading:6.6})[id])});return fixtureNames[id]+(on?'已打开':'已关闭');},
  fixtureLabel:id=>((fixtureOverrides.get(id)?.on??(fixtureLight(id)?.intensity>0))?'关闭':'打开')+fixtureNames[id],
  update(dt){for(let i=0;i<8;i++)values[i]=T.MathUtils.damp(values[i],targets[i],16,dt);for(const r of lights){if(r.light.intensity!==r.applied)r.source=r.light.intensity;let intensity=r.source;for(const [id,v] of fixtureOverrides)if(fixtureLight(id)===r.light)intensity=v.on?v.power:0;r.applied=targets[r.index]?intensity:0;r.light.intensity=r.applied;}},
  label:i=>(targets[i]?'关闭':'打开')+rooms018[i].label+'灯'};
}
