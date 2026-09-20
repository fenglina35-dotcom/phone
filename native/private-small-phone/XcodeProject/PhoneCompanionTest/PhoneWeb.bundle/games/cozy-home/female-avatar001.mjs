import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeHeightAdapter} from './female-proportions001.mjs';
import {defaults,sanitize,deform} from './female-shape001.mjs';
import {sanitizeMotions} from './female-motion001.mjs';
// Independent female rig. Shape and cloth are shared with the adjustment preview.
export async function createFemaleAvatar(){
 const selected=await fetch('./character/female-selected001.json').then(r=>r.json());
 let p=sanitize(selected.face.parameters),settings=sanitizeMotions(selected.motion.motions);
 try{const face=JSON.parse(localStorage.getItem('cozy-female-misaka-face001')),motions=JSON.parse(localStorage.getItem('cozy-female-misaka-motion001'));if(face?.format==='cozy-female-misaka001')p=sanitize(face.parameters);if(motions?.format==='cozy-female-motion001')settings=sanitizeMotions(motions.motions)}catch{}
 for(const k of ['skirtFrontHeight','skirtFrontLength'])settings.SitDown[k]=settings.SitIdle[k];
 const compare=false,root=new T.Group();root.name='Your female avatar';
 const gltf=await new GLTFLoader().loadAsync('./character/female-misaka001.glb'),model=gltf.scene;root.add(model);model.updateMatrixWorld(true);
 const data=[],faceMeshes=[],colors=[];model.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;const old=o.material,n=old.name,kind=n.includes('EyeIris')?'iris':n.includes('EyeHighlight')?'highlight':n.includes('FaceBrow')?'brow':n.includes('HAIR')?'hair':n.includes('FaceMouth')?'mouth':o.morphTargetInfluences?'skin':'body';
  const mat=new T.MeshBasicMaterial({name:n,map:old.map,color:old.color,side:T.DoubleSide,alphaTest:.35});o.material=mat;
  if(kind==='iris'||kind==='hair'){const tint={value:new T.Color(p[kind])},enabled={value:p.tint?1:0};colors.push({kind,tint,enabled});mat.onBeforeCompile=s=>{s.uniforms.faceTint=tint;s.uniforms.tintEnabled=enabled;s.fragmentShader='uniform vec3 faceTint;uniform float tintEnabled;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat l=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,faceTint*(.25+l*1.4),tintEnabled);')};mat.customProgramCacheKey=()=>kind+'female001'}
  if(o.morphTargetInfluences)faceMeshes.push(o);
  {const g=o.geometry;data.push({g,kind,pos:g.attributes.position,src:g.attributes.position.array.slice(),morph:g.morphAttributes.position||[],original:(g.morphAttributes.position||[]).map(a=>a.array.slice()),relative:g.morphTargetsRelative});delete g.morphAttributes.normal;}
 });
 function shape(){const v=compare?defaults:p;for(const d of data){for(let i=0;i<d.src.length;i+=3){const[x,y,z]=d.src.slice(i,i+3),q=deform(x,y,z,v,d.kind);d.pos.array.set(q,i);for(let m=0;m<d.morph.length;m++){const a=d.original[m],r=deform(d.relative?x+a[i]:a[i],d.relative?y+a[i+1]:a[i+1],d.relative?z+a[i+2]:a[i+2],v,d.kind);for(let k=0;k<3;k++)d.morph[m].array[i+k]=r[k]-(d.relative?q[k]:0)}}d.pos.needsUpdate=true;d.morph.forEach(a=>a.needsUpdate=true);d.g.computeBoundingSphere()}for(const c of colors){c.tint.value.set(v[c.kind]);c.enabled.value=v.tint?1:0}heightAdapter(v.bodyHeight)}
 const mixer=new T.AnimationMixer(model),bones={},rest={};model.traverse(o=>{if(o.isBone){bones[o.name]=o;rest[o.name]={q:o.quaternion.clone(),p:o.position.clone(),world:o.getWorldQuaternion(new T.Quaternion())}}});
 const heightAdapter=makeHeightAdapter(model,bones,rest,gltf.animations);
 const clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));let landingAction=null,landingWeight=0,editor=null,motionElapsed=0,action=null,motion='Idle',motionStart=0,sit=0,sitFrom=0,sitTo=0;
 // A separate skinned-cloth correction lets the pleats cover bent thighs.
 // It is evaluated from this model's hip/leg pose, never the male correction table.
 const skirts=[];model.traverse(o=>{if(o.isSkinnedMesh&&o.material.name.includes('Bottoms'))skirts.push(o)});
 const cloth=skirts.map(o=>{const g=o.geometry.clone(),mesh=new T.Mesh(g,o.material);mesh.name='Female skirt corrected';root.add(mesh);o.visible=false;return {o,mesh,src:o.geometry.attributes.position,hipRestInv:bones.J_Bip_C_Hips.matrixWorld.clone().invert(),v:new T.Vector3()}});
 const clothInverse=new T.Matrix4(),clothTransform=new T.Matrix4(),offsetTransform=new T.Matrix3(),native=new T.Vector3(),offset=new T.Vector3(),lf=new T.Vector3(),rf=new T.Vector3();
 function clothUpdate(){model.updateMatrixWorld(true);const hip=bones.J_Bip_C_Hips;clothInverse.copy(hip.matrixWorld).invert();bones.J_Bip_L_LowerLeg.getWorldPosition(lf).applyMatrix4(clothInverse);bones.J_Bip_R_LowerLeg.getWorldPosition(rf).applyMatrix4(clothInverse);const bend=Math.max(0,Math.min(1,(Math.max(lf.z,rf.z)-.08)/.22)),bodyScale=1+p.bodyHeight,skirt=editor.skirt(landingWeight),lying=['LieDown','LieIdle','GetUp'].includes(motion);
  for(const c of cloth){c.o.skeleton.update();c.hipRestInv.copy(c.o.skeleton.boneInverses[c.o.skeleton.bones.indexOf(hip)]);clothTransform.multiplyMatrices(hip.matrixWorld,c.hipRestInv).multiply(c.o.bindMatrix);offsetTransform.setFromMatrix4(clothTransform);const pos=c.mesh.geometry.attributes.position;
   for(let i=0;i<pos.count;i++){c.v.fromBufferAttribute(c.src,i);native.copy(c.v);c.o.applyBoneTransform(i,native);native.applyMatrix4(c.o.matrixWorld);const x=c.v.x,y=c.v.y,z=c.v.z,t=Math.max(0,Math.min(1,(.985-y/bodyScale)/.245)),front=Math.max(0,Math.min(1,(z+.10)/.23));
    c.v.set(x*(1-.20*t*bend),y+(t*.19-Math.max(0,t-.78)*.10)*front*bend*bodyScale,z+t*.23*front*bend).applyMatrix4(clothTransform);native.lerp(c.v,lying?1:bend);const f=Math.max(0,Math.min(1,(z-.015)/.085)),frontOnly=f*f*(3-2*f)*t*t;
    offset.set(0,(skirt.height-skirt.length*(1-bend))*frontOnly,skirt.length*bend*frontOnly).applyMatrix3(offsetTransform);native.add(offset);pos.setXYZ(i,native.x,native.y,native.z);
   }pos.needsUpdate=true;c.mesh.geometry.computeBoundingSphere();
  }
 }
 const proceduralDeltas=[['J_Bip_L_UpperArm',-.12,-1.30],['J_Bip_R_UpperArm',-.12,1.30],['J_Bip_L_LowerArm',-.9,-1.40],['J_Bip_R_LowerArm',-.9,1.40],['J_Bip_L_Hand',-.9,-1.4],['J_Bip_R_Hand',-.9,1.4],['J_Bip_L_UpperLeg',-1.48,0],['J_Bip_R_UpperLeg',-1.48,0],['J_Bip_L_LowerLeg',-.03,0],['J_Bip_R_LowerLeg',-.03,0],['J_Bip_L_Foot',0,0],['J_Bip_R_Foot',0,0]],proceduralEuler=new T.Euler(),proceduralWorld=new T.Quaternion(),proceduralParent=new T.Quaternion();
 function procedural(amount){for(const[n,b]of Object.entries(bones)){b.quaternion.copy(rest[n].q);b.position.copy(rest[n].p)}model.updateMatrixWorld(true);
  // Reuse scratch transforms without skipping the authored standing-arm pose:
  // amount=0 still needs the fixed Z rotations below to avoid a T-pose.
  for(const[n,xScale,z]of proceduralDeltas){const b=bones[n];if(!b)continue;proceduralWorld.setFromEuler(proceduralEuler.set(amount*xScale,0,z)).multiply(rest[n].world);b.parent.getWorldQuaternion(proceduralParent).invert();b.quaternion.copy(proceduralParent.multiply(proceduralWorld));b.updateWorldMatrix(false,true)}
  const hip=bones.J_Bip_C_Hips;if(hip)hip.position.y-=amount*.38;model.updateMatrixWorld(true);
 }

 const q=a=>new T.Quaternion().setFromEuler(new T.Euler(...(a||[0,0,0]).map(x=>x*Math.PI/180)));
 function values(){return settings[motion==='GetUp'?'LieDown':motion]}
 editor={skirt(w){const v=values(),end=settings.LieIdle;return {height:v.skirtFrontHeight*(1-w)+end.skirtFrontHeight*w,length:v.skirtFrontLength*(1-w)+end.skirtFrontLength*w}}};
 shape();
 // Direct sampling avoids AnimationMixer's cached writes after restoring the rig.
 // Otherwise constant tracks can retain the preceding action's pose.
 const sampledClips=Object.fromEntries(Object.entries(clips).map(([n,c])=>[n,c.tracks.map(track=>({binding:T.PropertyBinding.create(model,track.name),curve:track.createInterpolant()}))]));
 function applyClip(name,time){for(const t of sampledClips[name]||[])t.binding.setValue(t.curve.evaluate(time),0);}
 let lastSample=null;
 function sample(name,t,{bathing=false}={}){
  const sampleT=['Idle','SitIdle'].includes(name)?0:t;
  motion=name;root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
  if(lastSample&&lastSample.name===name&&lastSample.t===sampleT&&lastSample.bathing===bathing)return {hip:lastSample.hip.clone(),head:lastSample.head.clone()};
  model.position.set(0,0,0);mixer.stopAllAction();landingWeight=0;
  if(['Idle','SitDown','SitIdle','StandUp'].includes(name)){let u=name==='SitIdle'?1:name==='Idle'?0:name==='StandUp'?1-t:t;u=Math.max(0,Math.min(1,u));procedural(u*u*(3-2*u));}
  else{procedural(0);const clipName=name==='GetUp'?'LieDown':name,clip=clips[clipName];if(clip){const time=clip.duration*(name==='GetUp'?1-t:t);applyClip(clipName,time);if(['LieDown','GetUp'].includes(name)){const u=Math.max(0,Math.min(1,(time/clip.duration-.72)/.28));landingWeight=u*u*(3-2*u);if(landingWeight){const from=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone()}]));applyClip('LieIdle',0);for(const[n,b]of Object.entries(bones)){b.position.lerpVectors(from[n].p,b.position,landingWeight);b.quaternion.slerpQuaternions(from[n].q,b.quaternion,landingWeight)}}}}}
  const v=values(),end=settings.LieIdle,w=landingWeight;
  for(const n of new Set([...Object.keys(v.joints),...(w?Object.keys(end.joints):[])]))if(bones[n])bones[n].quaternion.multiply(q(v.joints[n]).slerp(q(end.joints[n]),w));
  if(bathing&&['SitDown','SitIdle','StandUp'].includes(name)){const u=name==='SitIdle'?1:name==='StandUp'?1-t:t,w=T.MathUtils.smoothstep(u,0,1);for(const side of ['L','R']){bones['J_Bip_'+side+'_LowerLeg'].rotateX(1.4*w);bones['J_Bip_'+side+'_Foot'].rotateX(-1.4*w);}}
  model.position.fromArray(v.root).lerp(new T.Vector3().fromArray(end.root),w);model.updateMatrixWorld(true);clothUpdate();
  const result={hip:bones.J_Bip_C_Hips.getWorldPosition(new T.Vector3()),head:bones.J_Bip_C_Head.getWorldPosition(new T.Vector3())};lastSample={name,t:sampleT,bathing,hip:result.hip.clone(),head:result.head.clone()};return result;
 }
 function duration(name){return clips[name==='GetUp'?'LieDown':name]?.duration||1.1}
 sample('Idle',0);
 return {root,model,bones,settings,parameters:p,sample,duration,speed:name=>settings[name==='GetUp'?'LieDown':name].speed};
}
