import * as T from 'three';
export function measureEyeReference(root,head){
 const mesh=root.getObjectByName('iris');if(!mesh?.isSkinnedMesh||!mesh.geometry.index)return null;
 // Only the 32 eye vertices are sampled; reuse vectors and retain animated eye-bone offsets.
 const vertices=Array.from({length:mesh.geometry.attributes.position.count},()=>new T.Vector3()),center=new T.Vector3(),forward=new T.Vector3(),edgeA=new T.Vector3(),edgeB=new T.Vector3(),index=mesh.geometry.index;
 return {sample(){const blink=mesh.morphTargetDictionary?.Blink,savedBlink=blink===undefined?0:mesh.morphTargetInfluences[blink];if(blink!==undefined)mesh.morphTargetInfluences[blink]=0;mesh.skeleton.update();center.set(0,0,0);forward.set(0,0,0);
  for(let i=0;i<vertices.length;i++){mesh.getVertexPosition(i,vertices[i]).applyMatrix4(mesh.matrixWorld);center.add(vertices[i]);}
  for(let i=0;i<index.count;i+=3){const a=vertices[index.getX(i)],b=vertices[index.getX(i+1)],c=vertices[index.getX(i+2)];forward.add(edgeA.subVectors(b,a).cross(edgeB.subVectors(c,a)));}
  center.divideScalar(vertices.length);forward.normalize();if(blink!==undefined)mesh.morphTargetInfluences[blink]=savedBlink;return {center,forward};
 }};
}
export function createGaze(root,head,neutralRotation,eyeReference){
 const forwardLocal=eyeReference?.forward?.clone()||new T.Vector3(0,0,1).applyQuaternion((neutralRotation||head.getWorldQuaternion(new T.Quaternion())).clone().invert());
 const eyeRig=root.getObjectByName('Armature');let eyeParent=eyeRig?.parent;while(eyeParent&&eyeParent!==head)eyeParent=eyeParent.parent;const eyes=eyeParent===head?null:eyeRig;let saved=[],pitch=0,turn=0,tracking=false;
 function restore(){for(const[o,p,q]of saved){o.position.copy(p);o.quaternion.copy(q);}saved=[];}
 function update(dt,actor,player,state){
  root.updateMatrixWorld(true);const measured=eyeReference?.sample?.();const pivot=head.getWorldPosition(new T.Vector3()),eye=measured?.center||(eyeReference?.center?head.localToWorld(eyeReference.center.clone()):pivot.clone().add(new T.Vector3(0,.08,0))),dx=player.x-eye.x,dz=player.z-eye.z,d=Math.hypot(dx,dz),yaw=actor.rotation.y;
  const localAngle=Math.atan2(Math.sin(Math.atan2(dx,dz)-yaw),Math.cos(Math.atan2(dx,dz)-yaw));
  tracking=['idle','seated','walking','waiting_user','speaking'].includes(state)&&d<2.5&&Math.abs(localAngle)<Math.PI*.56&&Math.abs(player.y-actor.position.y)<.65;
  const currentForward=measured?.forward||forwardLocal.clone().applyQuaternion(head.getWorldQuaternion(new T.Quaternion()));const authoredPitch=Math.atan2(-currentForward.y,Math.hypot(currentForward.x,currentForward.z)),authoredYaw=Math.atan2(Math.sin(Math.atan2(currentForward.x,currentForward.z)-yaw),Math.cos(Math.atan2(currentForward.x,currentForward.z)-yaw));
  const targetPitch=tracking?T.MathUtils.clamp(Math.atan2(eye.y-(player.eyeY??(player.y+1.42)),Math.max(.12,d))-authoredPitch,-.35,.68):0,targetTurn=tracking?T.MathUtils.clamp(localAngle-authoredYaw,-1.15,1.15):0;
  const blend=1-Math.exp(-4*dt);pitch=T.MathUtils.lerp(pitch,targetPitch,blend);turn=T.MathUtils.lerp(turn,targetTurn,blend);
  const axis=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),delta=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),turn).multiply(new T.Quaternion().setFromAxisAngle(axis,pitch));
  for(const o of [head,eyes].filter(Boolean)){
   saved.push([o,o.position.clone(),o.quaternion.clone()]);const worldP=o.getWorldPosition(new T.Vector3()),worldQ=o.getWorldQuaternion(new T.Quaternion());
   if(o===eyes){worldP.sub(pivot).applyQuaternion(delta).add(pivot);o.position.copy(o.parent.worldToLocal(worldP));}
   o.quaternion.copy(o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(delta.clone().multiply(worldQ)));
  }
 }
 return {restore,update,state:()=>({tracking,pitchDegrees:T.MathUtils.radToDeg(pitch),turnDegrees:T.MathUtils.radToDeg(turn),frontConeDegrees:202,maxRange:2.5})};
}

