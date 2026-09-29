import * as T from 'three';
import {lean} from './mobile-budget024.mjs?build=050';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

export function createLighting(scene,renderer,house){
 RectAreaLightUniformsLib.init();
 const sky=new T.HemisphereLight('#f2f3ec','#c9b99c',.76);scene.add(sky);
 const sun=new T.DirectionalLight('#ffe0b7',2.15);sun.position.set(4,5,-12);sun.target.position.set(12,0,4);sun.castShadow=true;
 sun.shadow.mapSize.set(lean?1024:2048,lean?1024:2048);Object.assign(sun.shadow.camera,{left:-19,right:19,top:14,bottom:-14,near:.1,far:60});sun.shadow.normalBias=.008;sun.shadow.bias=-.00004;scene.add(sun,sun.target);
 const windows=[];
 for(const [x,z,w,h] of [[8.15,.09,1.7,1.75],[13.1,.09,1.7,1.75],[3.0,.09,1.8,1.75],[18.2,.09,2.1,1.75]]){
  const light=new T.RectAreaLight('#e2efff',2.5,w,h);light.position.set(x,1.6,z);light.lookAt(x,1.3,z+4);scene.add(light);windows.push(light);
 }
 const lamps=[];
 const livingBounce=new T.RectAreaLight('#fff5e8',.55,6.2,4.8);livingBounce.position.set(10.7,2.72,3.6);livingBounce.lookAt(10.7,0,3.6);scene.add(livingBounce);
 // The virtual bounce emitter must stay below furniture, not intersect its surfaces.
 // At y=.85 its one-sided emission created an abrupt light boundary through cushions.
 const ceilingBounce=new T.RectAreaLight('#fff5e9',.9,5.8,4.5);ceilingBounce.position.set(10.7,-.35,3.6);ceilingBounce.lookAt(10.7,2.9,3.6);scene.add(ceilingBounce);
 for(const [id,x,y,z,power] of [['entry',7.315,1.24,6.875,8],['chest',14.1,1.22,4.045,6],['reading',13.34,1.62,4.89,12],['living',10.75,2.52,3.6,12],['kitchen',3,2.45,4.98,26],['bedroom',18.15,2.45,3.7,24],['study',10.2,2.45,11,28],['bath',23.8,2.65,3.7,22],['workshop',19.6,-.7,12.6,28],['stair',16.2,-.55,14.5,18]]){
  const l=new T.PointLight('#ffe0af',power,10,2);l.position.set(x,y,z);l.userData={id,night:power};scene.add(l);lamps.push(l);
 }
 // One static cubemap per lighting state captures THIS room for glass/metal highlights.
 // It is not ray-traced glass or a continually updating mirror.
 const target=lean?null:new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType});const probe=lean?null:new T.CubeCamera(.08,160,target);if(probe){probe.position.set(10.7,1.225,.59);scene.add(probe);}
 // A tiny painted environment keeps soft glass/metal highlights without rendering
 // the whole house six times, or holding floating point reflection buffers.
 const painted=lean?new T.CanvasTexture((()=>{const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,64);g.addColorStop(0,'#dce6ed');g.addColorStop(.44,'#f6ecda');g.addColorStop(.55,'#8c8c87');g.addColorStop(1,'#786658');ctx.fillStyle=g;ctx.fillRect(0,0,128,64);return c;})()):null;
 if(painted){painted.mapping=T.EquirectangularReflectionMapping;painted.colorSpace=T.SRGBColorSpace;}
 const pmrem=lean?null:new T.PMREMGenerator(renderer),environments=new Map(),materials=new Set();house.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});
 let mode='day',time=0;const curtainUniforms=[],custom={};
 const editableLights=[{id:'sun',label:'窗外夕阳',light:sun,max:5},{id:'sky',label:'环境柔光',light:sky,max:2},{id:'bounce',label:'客厅顶部补光',light:livingBounce,max:3},{id:'ceiling',label:'地面反射补光',light:ceilingBounce,max:3},...windows.slice(0,2).map((light,i)=>({id:'window'+i,label:'窗边柔光 '+(i+1),light,max:5})),...lamps.filter(l=>['entry','chest','reading','living'].includes(l.userData.id)).map(light=>({id:light.userData.id,label:({entry:'玄关台灯',chest:'边柜台灯',reading:'落地灯',living:'吊灯'})[light.userData.id],light,max:30}))];
 const defaults=new Map(editableLights.map(e=>[e.id,{color:e.light.color.getHexString(),position:e.light.position.toArray()}]));
 for(const id of ['curtain_left','curtain_right'])house.main.getObjectByName(id)?.traverse(o=>{
  if(!o.isMesh||!['Sage linen','Sheer curtain'].includes(o.material.name))return;
  o.material=o.material.clone();const u={value:0};curtainUniforms.push(u);
  const inv=o.getWorldQuaternion(new T.Quaternion()).invert(),up=new T.Vector3(0,1,0).applyQuaternion(inv),wind=new T.Vector3(0,0,1).applyQuaternion(inv);
  o.material.onBeforeCompile=shader=>{shader.uniforms.homeBreeze=u;shader.uniforms.homeUp={value:up};shader.uniforms.homeWind={value:wind};shader.vertexShader='uniform float homeBreeze;\nuniform vec3 homeUp;\nuniform vec3 homeWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed += homeWind * sin(homeBreeze + position.x * 5.0) * 0.006 * pow(clamp((2.60-dot(position,homeUp))/2.3,0.0,1.0),2.0);');};
  o.material.customProgramCacheKey=()=> 'home-breeze-v009';
 });
 function setMode(next){
  for(const e of editableLights){const d=defaults.get(e.id);e.light.color.set('#'+d.color);e.light.position.fromArray(d.position);}
  house.livingFinish?.setMode(next);
  mode=next;const night=mode==='evening';sun.intensity=night?.045:2.15;sky.intensity=night?.26:.78;livingBounce.intensity=night?.18:.55;ceilingBounce.intensity=night?.12:.9;
  sky.color.set(night?'#b4c5e8':'#f2f3ec');for(const l of windows){l.intensity=night?.17:2.1;l.color.set(night?'#9ab6e6':'#eef4ef');}
  for(const l of lamps)l.intensity=l.userData.night*(night?1:(['workshop','stair','bath'].includes(l.userData.id)?.72:.22));
  for(const l of lamps)if(['entry','chest','reading','living'].includes(l.userData.id))l.intensity=night?l.userData.night*.55:0;
  for(const m of materials){if(m.name==='Warm lamp diffuser')m.emissiveIntensity=night?1.3:0;}
  house.main.traverse(o=>{if(o.name==='Window'&&o.material.name!=='Living window glass'&&o.material.name!=='Rain mist window glass'&&o.material.name!=='User day and night window picture'){o.material.color.set(night?'#293d63':'#cfe6eb');o.material.emissive.set(night?'#263c65':'#bbd6dd');}});
  scene.background.set(night?'#283851':'#d8e5ed');renderer.shadowMap.needsUpdate=true;
  for(const e of editableLights){const v=custom[mode]?.[e.id];if(v){e.light.intensity=v.intensity;e.light.color.set(v.color);e.light.position.fromArray(v.position);}}
  if(!lean&&!environments.has(mode)){
   const tv=house.assets.get('tv'),was=tv.visible,outdoor=house.livingFinish?.outdoor,wasOutdoor=outdoor?.visible;
   tv.visible=false;if(outdoor)outdoor.visible=false;
   try{scene.updateMatrixWorld(true);probe.update(renderer,scene);}finally{tv.visible=was;if(outdoor)outdoor.visible=wasOutdoor;}
   environments.set(mode,pmrem.fromCubemap(target.texture));
  }
  const env=lean?painted:environments.get(mode).texture;
  for(const m of materials){if(m.isMeshStandardMaterial){m.envMap=env;m.envMapIntensity=m.name==='Rain mist window glass'?.8:m.name.includes('mirror')?.6:m.name==='Living window glass'?.25:m.name==='Screen glass'?.85:(m.metalness>.3?.25:.08);if(m.name==='Screen glass'){m.roughness=.20;m.color.set('#344454');}m.needsUpdate=true;}}
 }
 setMode('day');
 function invalidate(){for(const e of environments.values())e.dispose();environments.clear();}
 return {setMode,editableLights,getCustom:()=>JSON.parse(JSON.stringify(custom)),
  moveFixture(id,delta){const e=editableLights.find(e=>e.id===id);if(!e)return;const d=defaults.get(id);for(const preset of ['day','evening']){custom[preset]||={};const v=custom[preset][id]||{intensity:preset==='day'?0:e.light.userData.night*.55,color:'#'+d.color,position:d.position};custom[preset][id]={...v,position:new T.Vector3().fromArray(v.position).applyMatrix4(delta).toArray()};}invalidate();setMode(mode);},
  setCustom(data){for(const key of Object.keys(custom))delete custom[key];Object.assign(custom,data);invalidate();setMode(mode);},
  adjust(id,value,refresh=false){const e=editableLights.find(e=>e.id===id);if(!e)return;custom[mode]||={};custom[mode][id]={intensity:value.intensity,color:value.color,position:[...value.position]};e.light.intensity=value.intensity;e.light.color.set(value.color);e.light.position.fromArray(value.position);renderer.shadowMap.needsUpdate=true;if(refresh){invalidate();setMode(mode);}},
  state:()=>({mode,reflection:lean?'small painted environment':'room cubemap captured for each lighting state',windowFill:windows[0].intensity}),
  update(dt){time+=dt;if(house.fan&&!house.fan.userData.paused)house.fan.rotateOnAxis(house.fan.userData.spinAxis,dt*.42);for(const u of curtainUniforms)u.value=time*.65;}
 };
}
