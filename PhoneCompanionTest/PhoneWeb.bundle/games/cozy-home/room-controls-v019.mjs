import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export const rooms018=[
 {id:'living',label:'客厅',p:[14.512,1.22,4.92],yaw:-Math.PI/2},
 {id:'kitchen',label:'厨房餐厅',p:[6.512,1.22,3.10],yaw:-Math.PI/2},
 {id:'bedroom',label:'卧室',p:[14.695,1.22,4.94],yaw:Math.PI/2},
 {id:'bath',label:'卫生间',p:[21.303,1.30,4.94],yaw:Math.PI/2},
 {id:'office',label:'书房',p:[12.712,1.22,11.38],yaw:-Math.PI/2},
 {id:'hall',label:'楼梯过道',p:[14.512,1.22,10.3],yaw:-Math.PI/2},
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
 // Only reduce shared indirect illumination and sunlight. Local direct lights and
 // self-emission remain in the physical shading sum, even with a room main off.
 const installed=new WeakSet(),darkAmbient=new T.Vector3(.12,.19,.32);
 const roomGLSL=`varying vec3 roomWorld019;uniform float roomOn019[8];uniform vec3 darkAmbient019;
 float roomState019(vec3 p){
 float a=mix(roomOn019[1],roomOn019[0],smoothstep(5.9,7.3,p.x));
 a=mix(a,roomOn019[2],smoothstep(14.0,15.2,p.x));
 a=mix(a,roomOn019[3],smoothstep(20.6,21.8,p.x));
 float back=mix(roomOn019[4],roomOn019[5],smoothstep(12.25,13.35,p.x));
 a=mix(a,back,smoothstep(7.0,8.0,p.z));
 float lower=mix(roomOn019[7],roomOn019[6],smoothstep(11.65,12.8,p.z));
 lower=mix(lower,roomOn019[5],(1.0-smoothstep(17.0,17.8,p.x))*(1.0-smoothstep(13.7,14.7,p.z)));
 return mix(lower,a,smoothstep(-.11,-.035,p.y));}`;
 function patchMaterials(){house.root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(installed.has(m)||!m.isMeshStandardMaterial)return;installed.add(m);const before=m.onBeforeCompile,oldKey=m.customProgramCacheKey();
  m.onBeforeCompile=function(s,r){before.call(this,s,r);s.uniforms.roomOn019={value:values};s.uniforms.darkAmbient019={value:darkAmbient};
   s.vertexShader='varying vec3 roomWorld019;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 rp019=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     rp019=instanceMatrix*rp019;
    #endif
    roomWorld019=(modelMatrix*rp019).xyz;`);
   s.fragmentShader=roomGLSL+'\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_begin>',T.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );','getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= mix(.10,1.0,roomState019(roomWorld019));'));
   s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    float ambientRoom019=roomState019(roomWorld019);
    reflectedLight.indirectDiffuse*=mix(darkAmbient019,vec3(1.0),ambientRoom019);
    reflectedLight.indirectSpecular*=mix(.16,1.0,ambientRoom019);`);
  };m.customProgramCacheKey=()=>oldKey+'|indirect-soft-019';m.needsUpdate=true;
 }});}
 const fixtures=new Map(),lampKey='cozy-independent-lamps-v019';let lampSaved={};try{lampSaved=JSON.parse(localStorage.getItem(lampKey)||'{}')||{};}catch{}
 function register(id,label,light,power,anchor){if(!light)return;fixtures.set(id,{id,label,light,power:Number.isFinite(lampSaved[id]?.power)?lampSaved[id].power:power,on:typeof lampSaved[id]==='boolean'?lampSaved[id]:(lampSaved[id]?.on??(light.intensity>0)),anchor:new T.Vector3(...anchor)});light.userData.independentFixture=id;}
 for(const [id,label,pow,p]of[['entry','玄关台灯',4.4,[7.315,1.24,6.875]],['chest','斗柜台灯',3.3,[14.1,1.22,4.045]],['reading','落地阅读灯',6.6,[13.34,1.62,4.89]]])register(id,label,lighting.editableLights.find(e=>e.id===id)?.light,pow,p);

 // Register scene fixtures by their actual emission positions, including the two
 // existing shadowed task spots, rather than room bounding boxes.

 scene.traverse(l=>{if(!l.isLight)return;const p=l.getWorldPosition(new T.Vector3()).toArray();
  if(l.name==='Kitchen002 table lamp')register('kitchen','餐厅台灯',l,2.5,p);
  if(l.name==='Office desk shade practical light')register('office','书桌台灯',l,3.3,p);
  if(l.isSpotLight&&p[1]<-1)register('workshop','工作台台灯',l,8,p);
  if(l.isPointLight&&p[1]<-1&&p[0]>21.3&&p[2]>16)register('candle','工作室蜡烛',l,.9,p);
 });
 function addedLamp(id,label,p,target,power){const l=new T.SpotLight('#ffe1b4',0,3.5,Math.PI/2.6,.85,2);l.name=label+' independent light';l.position.fromArray(p);l.target.position.fromArray(target);l.castShadow=false;l.shadow.mapSize.set(512,512);l.shadow.normalBias=.008;scene.add(l,l.target);register(id,label,l,power,p);}
 addedLamp('bedside','床头台灯',[19.50,.72,.80],[19.5,.3,1.18],2.4);
 // The desk shade is found from the bedroom's named source when available.
 addedLamp('beddesk','卧室书桌台灯',[16.34,1.10,.48],[16.03,.78,.75],2.8);
 addedLamp('vanity','梳妆台台灯',[20.75,.92,4.38],[20.4,.78,4.28],1.6);
 addedLamp('bedcorner','卧室角落台灯',[20.2,.81,7.02],[20.0,.35,6.7],1.8);
 const lights=[];scene.traverse(l=>{if(l.isLight&&!l.isDirectionalLight&&!l.isHemisphereLight&&!l.isAmbientLight){const p=l.getWorldPosition(new T.Vector3());const owner=l.userData.id==='stair'?5:(p.y>-.6&&p.x<14.6?roomIndex(new T.Vector3(p.x,.1,p.z)):roomIndex(p));lights.push({light:l,index:owner,source:l.intensity,applied:l.intensity});if(l.isPointLight&&!l.userData.independentFixture)l.distance=Math.min(l.distance||8,7);}});
 // Do not change visibility/light count when toggling; that recompiles all shaders.
 for(const method of ['setMode','adjust','setCustom','moveFixture']){const original=lighting[method];lighting[method]=(...args)=>{for(const r of lights)r.light.intensity=r.source;const result=original(...args);for(const r of lights)r.source=r.applied=r.light.intensity;const custom=lighting.getCustom()[lighting.state().mode]||{};for(const [id,f]of fixtures){if((method==='adjust'&&args[0]===id)||(method==='setCustom'&&custom[id])){f.power=Math.max(0,f.light.intensity);f.on=f.power>0;f.anchor.copy(f.light.position);persistLamps();}else if(method==='moveFixture'&&args[0]===id)f.anchor.copy(f.light.position);}return result;};}
 const glow=[];house.root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.emissive&&m.emissive.getHex()!==0&&/lamp|diffuser|glow|star|flame/i.test(m.name)){
  const b=new T.Box3().setFromObject(o),p=b.getCenter(new T.Vector3());let fixture=null,d=.85;for(const f of fixtures.values()){const distance=p.distanceTo(f.anchor);if(distance<d){d=distance;fixture=f.id;}}
  // Glow meshes are given separate materials so a shared bulb cannot switch an entire house.
  if(!Array.isArray(o.material)){o.material=m.clone();glow.push({material:o.material,index:roomIndex(p),fixture,power:Math.max(.6,m.emissiveIntensity)});}
 }});patchMaterials();
 function persistLamps(){try{localStorage.setItem(lampKey,JSON.stringify(Object.fromEntries([...fixtures].map(([id,f])=>[id,{on:f.on,power:f.power}]))));}catch{}}
 function toggle(i){targets[i]=targets[i]?0:1;switches[i].rocker.rotation.x=targets[i]?-.10:.10;try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(rooms018.map((r,n)=>[r.id,!!targets[n]]))));}catch{}renderer.shadowMap.needsUpdate=true;return rooms018[i].label+(targets[i]?'主灯已打开':'主灯已关闭');}
 function reachable(s,p){return Math.hypot(p.x-s.p[0],p.z-s.p[2])<1.8&&Math.abs(p.y+1.25-s.p[1])<.65&&new T.Vector3(p.x-s.p[0],0,p.z-s.p[2]).dot(new T.Vector3(0,0,1).applyQuaternion(s.object.quaternion))>0;}
 function nearby(p,camera){if(!camera)return null;const ray=new T.Raycaster();ray.far=1.75;ray.setFromCamera(new T.Vector2(),camera);return switches.find(s=>reachable(s,p)&&ray.intersectObject(s.object,true).some(h=>h.distance<1.75));}
 function nearFixture(p,camera,ndc=new T.Vector2()){const ray=new T.Raycaster();ray.setFromCamera(ndc,camera);let found=null,dist=2.1;for(const f of fixtures.values()){const v=f.anchor.clone();const along=v.clone().sub(camera.position).dot(ray.ray.direction);if(along>.1&&along<dist&&ray.ray.distanceToPoint(v)<.23&&Math.abs(p.y-v.y)<1.8){found=f;dist=along;}}return found?{kind:'lamp',lamp:found.id,label:(found.on?'关闭':'打开')+found.label}:null;}
 return {switches,toggle,nearby,reachable,nearFixture,patchMaterials,fixtures,lights,state:()=>Object.fromEntries(rooms018.map((r,i)=>[r.id,!!targets[i]])),
  toggleFixture(id){const f=fixtures.get(id);if(!f)return '未找到台灯';f.on=!f.on;persistLamps();renderer.shadowMap.needsUpdate=true;return f.label+(f.on?'已打开':'已关闭');},
  fixtureLabel:id=>{const f=fixtures.get(id);return f?(f.on?'关闭':'打开')+f.label:'';},
  update(dt){darkAmbient.set(...(lighting.state().mode==='evening'?[.40,.55,.82]:[.12,.19,.32]));for(let i=0;i<8;i++)values[i]=T.MathUtils.damp(values[i],targets[i],10,dt);for(const r of lights){if(r.light.intensity!==r.applied)r.source=r.light.intensity;const fixture=fixtures.get(r.light.userData.independentFixture);r.applied=fixture?(fixture.on?fixture.power:0):r.source*values[r.index];r.light.intensity=r.applied;}
   for(const r of glow)r.material.emissiveIntensity=r.fixture?(fixtures.get(r.fixture)?.on?r.power:0):r.power*values[r.index];},
  label:i=>(targets[i]?'关闭':'打开')+rooms018[i].label+'主灯'};
}
