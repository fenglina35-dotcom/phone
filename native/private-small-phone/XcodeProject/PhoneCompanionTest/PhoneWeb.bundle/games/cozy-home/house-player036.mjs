import * as T from 'three';
import {createFemaleAvatar} from './female-avatar001.mjs?build=051';
import {prepareMobileCharacter} from './mobile-budget024.mjs?build=050';

export async function installFemalePlayer({scene,camera,world,player,house,getState}){
 const avatar=await createFemaleAvatar();prepareMobileCharacter(avatar.root);scene.add(avatar.root);const pillows=[];const cushions=[];house.root.traverse(o=>{if(o.name.startsWith('Supported cotton pillow'))pillows.push({o,scale:o.scale.y});if(['Supported blue lumbar cushion','Soft five-point rose cushion','Round honey cushion'].includes(o.name))cushions.push(o)});
 avatar.root.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();const head=/HAIR|FACE|EYE|Face_/.test(o.material.name)||o.geometry.boundingBox.min.y>1.27;o.layers.set(head?1:0);o.castShadow=true;}});
 const headBone=avatar.bones.J_Bip_C_Head;avatar.sample('Idle',0);
 const headRest=headBone.getWorldQuaternion(new T.Quaternion()),eyeLocal=avatar.bones.J_Adj_L_FaceEye.getWorldPosition(new T.Vector3()).add(avatar.bones.J_Adj_R_FaceEye.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
 eyeLocal.z+=.025;headBone.worldToLocal(eyeLocal);const eyeRotation=headRest.clone().invert().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI)),eyeRotationInverse=eyeRotation.clone().invert();
 const up=new T.Vector3(0,1,0),viewEuler=new T.Euler(0,0,0,'YXZ'),viewQuaternion=new T.Quaternion(),desiredHeadWorld=new T.Quaternion(),parentWorld=new T.Quaternion(),viewForward=new T.Vector3(),cameraOffset=new T.Vector3(),eyeWorld=new T.Vector3();
 let transitionFromT=0,stopTime=1,walkPhase=0,postureRotation=new T.Quaternion(),transitionEnd=null,bedLook=null,exitLook=null;
 let perspective='third',motion='Idle',elapsed=0,last={...player},wasSeated=false,wasLying=false,anchor=null,transitionStart=null;
 const button=document.createElement('button');button.id='player-perspective';button.type='button';button.textContent='第三人称 · 切换第一人称';(document.querySelector('#home-settings nav')||document.querySelector('header nav')).append(button);
 function setPerspective(v){perspective=v==='first'?'first':'third';button.textContent=perspective==='third'?'第三人称 · 切换第一人称':'第一人称 · 切换第三人称';camera.layers[perspective==='third'?'enable':'disable'](1);button.setAttribute('aria-label',button.textContent)}button.onclick=()=>{setPerspective(perspective==='third'?'first':'third');try{localStorage.setItem('cozy-player-perspective037',perspective)}catch{}};let savedPerspective='third';try{savedPerspective=localStorage.getItem('cozy-player-perspective037')||'third'}catch{}setPerspective(savedPerspective);
 function play(n){motion=n;elapsed=0;transitionFromT=0;}
 // Camera input is sampled once per frame; animation/navigation still use player.
 function update(dt,cameraLook=player){
  const state=getState(),lying=state.posture==='lying';
  const moved=Math.hypot(player.x-last.x,player.z-last.z);
  if(state.seated&&!wasSeated){
   anchor=house.playerSeatGeometry?.();transitionStart=avatar.root.position.clone();
   const idlePose=avatar.sample(lying?'LieIdle':'SitIdle',0,{bathing:anchor?.tub}),native=lying?idlePose.head.clone().sub(idlePose.hip):new T.Vector3(0,0,1);
   const yaw=anchor?Math.atan2(anchor.forward.x,anchor.forward.z)-Math.atan2(native.x,native.z):player.yaw+Math.PI;
   postureRotation.setFromAxisAngle(new T.Vector3(0,1,0),yaw);
   // Establish facing before the action, as for the male actor; never orbit the body while seated.
   transitionEnd=anchor?anchor.hip.clone().sub(idlePose.hip.clone().applyQuaternion(postureRotation)):new T.Vector3(player.x,player.y,player.z);
   bedLook=lying?{yaw:player.yaw,pitch:player.pitch}:null;play(lying?'LieDown':'SitDown');
  }
  else if(!state.seated&&wasSeated){
   transitionStart=avatar.root.position.clone();transitionEnd=new T.Vector3(player.x,player.y,player.z);
   exitLook={yaw:player.yaw,pitch:player.pitch};const progress=['LieDown','SitDown'].includes(motion)?Math.min(1,elapsed/avatar.duration(motion)):1;
   play(wasLying?'GetUp':'StandUp');transitionFromT=1-progress;elapsed=transitionFromT*avatar.duration(motion);
  }
  else if(['Idle','Walk'].includes(motion)) {stopTime=moved>.00015?0:stopTime+dt;const n=stopTime<.18?'Walk':'Idle';if(n!==motion){play(n);if(n==='Walk')elapsed=walkPhase;}}
  elapsed+=dt*avatar.speed(motion);if(motion==='Walk')walkPhase=elapsed;let duration=avatar.duration(motion);
  if(elapsed>=duration&&['SitDown','StandUp','LieDown','GetUp'].includes(motion)){play(state.seated?(lying?'LieIdle':'SitIdle'):'Idle');duration=avatar.duration(motion);}
  const loop=['Walk','LieIdle'].includes(motion),t=loop?(elapsed%duration)/duration:Math.min(1,elapsed/duration);
  const blendT=T.MathUtils.clamp((t-transitionFromT)/Math.max(.001,1-transitionFromT),0,1),pose=avatar.sample(motion,t,{bathing:anchor?.tub}),rotation=new T.Quaternion();
  const postureMotion=state.seated||['StandUp','GetUp'].includes(motion);
  // Touch input is resampled on animation frames. Use that same visual yaw for
  // the standing avatar; rotating the body from the newer raw pointer value
  // while the eyes still use the smoothed value exposed the shoulder/torso in
  // first person during a turn.
  const visualYaw=!postureMotion&&state.mode==='walk'?cameraLook.yaw:player.yaw;
  rotation.copy(postureMotion?postureRotation:viewQuaternion.setFromAxisAngle(up,visualYaw+Math.PI));
  const destination=new T.Vector3(player.x,player.y,player.z);
  if(state.seated&&anchor)destination.copy(anchor.hip).sub(pose.hip.clone().applyQuaternion(rotation));
  const u=blendT*blendT*(3-2*blendT);
  if(transitionStart&&transitionEnd&&['SitDown','LieDown','StandUp','GetUp'].includes(motion)){destination.lerpVectors(transitionStart,transitionEnd,u);if(anchor?.tub)destination.y+=.85*Math.sin(Math.PI*u);}
  avatar.root.position.copy(destination);avatar.root.quaternion.copy(rotation);
  const surfaceTransition=['SitDown','StandUp','LieDown','GetUp'].includes(motion);
  // Walking and looking only need the head's ancestor chain immediately. The
  // renderer updates the complete rig before drawing; traversing it here too
  // made Safari upload/update the same character twice on every camera frame.
  if(surfaceTransition)avatar.root.updateMatrixWorld(true);else headBone.updateWorldMatrix(true,false);
  const onBed=lying||(anchor?.bed&&motion==='GetUp');
  for(const o of cushions)o.visible=!onBed;for(const {o,scale}of pillows)o.scale.y=scale*(onBed?.45:1);
  // The animation is authored on a flat floor. Keep its moving mesh above the
  // mattress while it crosses the bed edge, and above the room floor on exit.
  // Sparse surface probes also include shoes and cloth, rather than only hips.
  if(surfaceTransition){
   let lift=0;const point=new T.Vector3(),local=new T.Vector3(),bed=onBed?anchor.object:null;
   avatar.root.traverse(o=>{if(!o.isMesh||!o.visible)return;o.skeleton?.update();const count=o.geometry.attributes.position.count,step=Math.max(1,Math.floor(count/256));
    for(let i=0;i<count;i+=step){o.getVertexPosition(i,point);point.applyMatrix4(o.matrixWorld);let support=anchor?.floor??player.y;
     if(bed){local.copy(point);bed.worldToLocal(local);const edge=Math.min(.90-Math.abs(local.x),1.05-Math.abs(local.z));support=Math.max(support,bed.position.y+.675*T.MathUtils.smoothstep(edge,-.18,.03));}
     lift=Math.max(lift,support-point.y);
    }
   });
   destination.y+=lift;avatar.root.position.copy(destination);avatar.root.updateMatrixWorld(true);
  }
  const bedMotion=['LieDown','LieIdle','GetUp'].includes(motion);
  if(state.mode==='walk'&&!state.editing&&!bedMotion){
   // A head world orientation followed by eyeRotation is the actual view
   // orientation used by the authored rig. Solve that relation directly so
   // mirrors and third person both show the head looking where the camera looks.
   viewQuaternion.setFromEuler(viewEuler.set(cameraLook.pitch,cameraLook.yaw,0,'YXZ'));
   desiredHeadWorld.copy(viewQuaternion).multiply(eyeRotationInverse);
   headBone.parent.getWorldQuaternion(parentWorld).invert();
   // Only the head matrix is needed to place the eye camera. Descendant face
   // bones are updated once by the renderer; recursively updating them here as
   // well caused a measurable Safari frame spike while turning.
   headBone.quaternion.copy(parentWorld.multiply(desiredHeadWorld));headBone.updateWorldMatrix(false,false);
  }
  headBone.localToWorld(eyeWorld.copy(eyeLocal));player.eyeHeightWorld=eyeWorld.y;
  if(state.mode==='walk'&&!state.editing){
   camera.layers[perspective==='first'?'disable':'enable'](1);
   if(perspective==='first'){
    camera.position.copy(eyeWorld);
    if(bedMotion){
     camera.quaternion.copy(headBone.getWorldQuaternion(new T.Quaternion())).multiply(eyeRotation);
     // Pointer look is relative to the eyes while the body lies down / rises.
     const look=motion==='GetUp'?exitLook:bedLook;
     const extra=new T.Quaternion().setFromEuler(new T.Euler(cameraLook.pitch-(look?.pitch||0),cameraLook.yaw-(look?.yaw||0),0,'YXZ'));
     camera.quaternion.multiply(extra);

    }else{
     camera.quaternion.copy(viewQuaternion);viewForward.set(0,0,-1).applyQuaternion(viewQuaternion);camera.position.addScaledVector(viewForward,.045);
     const lean=.18*T.MathUtils.smoothstep(-cameraLook.pitch,.35,1.2);
     cameraOffset.set(0,0,lean).applyQuaternion(rotation);camera.position.add(cameraOffset);
    }

   }else{
    const focus=destination.clone().add(new T.Vector3(0,state.seated?.90:1.05,0));
    if(state.seated&&anchor)focus.copy(anchor.hip).add(new T.Vector3(0,.40,0));
    const offset=lying?new T.Vector3(1.5,1.15,1.65).applyAxisAngle(new T.Vector3(0,1,0),cameraLook.yaw):new T.Vector3(0,.42,2.1).applyEuler(new T.Euler((state.seated?Math.min(.25,cameraLook.pitch):cameraLook.pitch)*.65,cameraLook.yaw,0,'YXZ'));
    function clearance(v){const ray=new T.Ray(focus,v.clone().normalize());let distance=v.length();for(const b of world.colliders){if(b.height<.9||(state.seated&&b.id===anchor?.id))continue;const hit=ray.intersectBox(new T.Box3(new T.Vector3(b.x,b.base,b.z),new T.Vector3(b.x+b.w,b.base+b.height,b.z+b.d)),new T.Vector3());if(hit)distance=Math.min(distance,Math.max(.08,focus.distanceTo(hit)-.16));}return {direction:ray.direction,distance};}
    let shot=clearance(offset);
    if(shot.distance<.75)for(const angle of [.7,-.7,1.4,-1.4,Math.PI]){const candidate=clearance(offset.clone().applyAxisAngle(new T.Vector3(0,1,0),angle));if(candidate.distance>shot.distance)shot=candidate;if(shot.distance>.9)break;}
    if(shot.distance<.55){camera.layers.disable(1);camera.position.copy(headBone.localToWorld(eyeLocal.clone()));camera.rotation.set(cameraLook.pitch,cameraLook.yaw,0,'YXZ');}
    else{camera.position.copy(focus).addScaledVector(shot.direction,shot.distance);camera.lookAt(focus);}

   }
  }
  wasSeated=state.seated;wasLying=lying;last.x=player.x;last.y=player.y;last.z=player.z;last.yaw=player.yaw;last.pitch=player.pitch;
 }
 return {avatar,update,standingYaw:()=>new T.Euler().setFromQuaternion(postureRotation,'YXZ').y-Math.PI,isGettingUp:()=>['GetUp','StandUp'].includes(motion),setPerspective,snapshot:()=>{const headView=headBone.getWorldQuaternion(new T.Quaternion()).multiply(eyeRotation),bodyView=new T.Euler().setFromQuaternion(avatar.root.quaternion,'YXZ').y-Math.PI;return {perspective,motion,elapsed,position:avatar.root.position.toArray(),bodyYaw:bodyView,headView:headView.toArray(),parameters:avatar.parameters}}};
}
