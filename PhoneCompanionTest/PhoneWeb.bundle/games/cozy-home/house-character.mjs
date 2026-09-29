import {createCompanion} from './actor-companion.mjs?build=040';
import {sceneReferences} from './scene-reference.mjs';
import {installCleanUI} from './clean-ui.mjs?build=041';
import {createDialogue} from './actor-dialogue.mjs?build=035';
import {crossingDoor,centeredAtDoor} from './actor-door-route.mjs?build=035';
import {createSeating} from './actor-seating.mjs?build=040';
import {createHousehold} from './actor-household.mjs';
import {createGaze,measureEyeReference} from './actor-gaze.mjs?build=035';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createNavigation} from './actor-navigation.mjs?build=040';
import {createTalkController} from './character/talk-controller.mjs';
import {prepareMobileCharacter} from './mobile-budget024.mjs?build=050';

export async function installHouseCharacter({scene,house,world,renderer,camera,player,roomControls,livingInteractions,getPlayerPosture}){
 const [gltf,poses]=await Promise.all([new GLTFLoader().loadAsync('./character/roland-expressions-actions-v012.glb'),fetch('./character/poses.json').then(r=>r.json())]);
 for(const clip of gltf.animations)if(['Idle','Walk','OpenDoor','SitDown','SitIdle','StandUp'].includes(clip.name))clip.tracks=clip.tracks.filter(t=>!t.name.includes('morphTargetInfluences'));
 const root=gltf.scene;prepareMobileCharacter(root);root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),heightScale=1.89/(bounds.max.y-bounds.min.y);root.scale.multiplyScalar(heightScale);root.position.y-=bounds.min.y*heightScale;root.updateMatrixWorld(true);const actor=new T.Group();actor.name='Roland model-controlled character';actor.add(root);scene.add(actor);
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,30);gradient.addColorStop(0,'rgba(35,25,35,.30)');gradient.addColorStop(1,'rgba(35,25,35,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const contactShadow=new T.Mesh(new T.PlaneGeometry(.72,.5),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=.016;scene.add(contactShadow);
 const mixer=new T.AnimationMixer(root),clips=new Map(gltf.animations.map(c=>[c.name,c])),nav=createNavigation(world),speech=createTalkController(()=>root),bones=new Map();
 root.traverse(o=>{if(o.isBone)bones.set(o.name.replace(/[._-]/g,''),o);if(o.isMesh){o.frustumCulled=false;o.castShadow=false;o.receiveShadow=false;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const t of [m.map,m.emissiveMap].filter(Boolean)){t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;}}});
 // These authored black-base, emissive-textured materials contain their own painted shading.
 // Basic shading preserves that image while removing unnecessary per-light fragment work.
 const paintedMaterials=new Map();root.traverse(o=>{if(!o.isMesh)return;const convert=m=>{if(!['EyeMaterial','HeadMaterial'].includes(m.name)||!m.emissiveMap||!m.color||m.color.r!==0||m.color.g!==0||m.color.b!==0||m.transparent)return m;if(!paintedMaterials.has(m)){const n=new T.MeshBasicMaterial({name:m.name,map:m.emissiveMap,color:m.emissive.clone().multiplyScalar(m.emissiveIntensity),side:m.side,depthTest:m.depthTest,depthWrite:m.depthWrite,toneMapped:m.toneMapped,fog:m.fog});paintedMaterials.set(m,n);}return paintedMaterials.get(m);};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});
 const bone=id=>bones.get(id.replace(/[._-]/g,''));
 const mapping={spine:'DEF-spine',chest:'DEF-spine.003',head:'DEF-spine.006'};
 for(const side of ['L','R']){for(const[id,b]of [['arm','upper_arm'],['elbow','forearm'],['wrist','hand'],['hip','thigh'],['knee','shin'],['ankle','foot']])mapping[id+side]=`DEF-${b}.${side}`;for(const id of ['thumb','f_index','f_middle','f_ring','f_pinky'])mapping[id+side]=`DEF-${id}.01.${side}`;for(const j of [2,3])mapping['thumb'+j+side]=`DEF-thumb.0${j}.${side}`;}
 let bathLegSaved=[];
 function restoreBathPose(){for(const [b,q]of bathLegSaved)b.quaternion.copy(q);bathLegSaved=[];}
 function applyBathPose(){if(!anchor?.tub)return;let blend=clipName==='SitIdle'?1:clipName==='SitDown'?T.MathUtils.smoothstep(elapsed/clips.get('SitDown').duration,0,1):clipName==='StandUp'?1-T.MathUtils.smoothstep(elapsed/clips.get('StandUp').duration,0,1):0;if(!blend)return;for(const side of ['L','R'])for(const [name,angle]of [['shin',-1.25],['foot',1.25]]){const b=bone('DEF-'+name+'.'+side);bathLegSaved.push([b,b.quaternion.clone()]);b.rotateX(angle*blend);}}
 let previous=[];function restorePose(){for(const[b,q]of previous)b.quaternion.copy(q);previous=[];}
 function applyPose(name){for(const[id,v]of Object.entries(poses.clips[name]||{})){const b=bone(mapping[id]||'');if(!b)continue;previous.push([b,b.quaternion.clone()]);b.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(T.MathUtils.degToRad(v.x||0),T.MathUtils.degToRad(v.y||0),T.MathUtils.degToRad(v.z||0),'XYZ')));}}
 const eyeReference=measureEyeReference(root,bone('DEF-spine.006'));
 const neutralHeadRotation=bone('DEF-spine.006').getWorldQuaternion(new T.Quaternion());
 const point=b=>bone(b).getWorldPosition(new T.Vector3());
 function sample(name,t){restorePose();mixer.stopAllAction();const a=mixer.clipAction(clips.get(name));a.reset().setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();a.time=t;mixer.update(0);applyPose(name);root.updateMatrixWorld(true);return {hip:point('DEF-spine'),head:point('DEF-spine.006'),foot:point('DEF-foot.L').add(point('DEF-foot.R')).multiplyScalar(.5)};}
 const end={};for(const name of ['Idle','SitIdle','SitDown','StandUp','LieDown','LieIdle','GetUp'])end[name]=sample(name,name==='Idle'||name==='LieIdle'||name==='SitIdle'?0:clips.get(name).duration);
 restorePose();mixer.stopAllAction();
 let action,clipName='Idle',state='idle',elapsed=0,path=[],arrival=null,transition=null,anchor=null,standAt=null,emotion=null,follow=false,doorWait=null,lastCommand=null;
 const bodyColliders=[];world.characters=bodyColliders;
 let p={x:12.95,y:0,z:5.95},yaw=0;actor.position.set(p.x,p.y,p.z);
 const doors=[...house.architecture.doors.map(d=>{d.y=0;return d;}),{id:'cell gate',room:'cell',y:-3.15,center:[20.66,12.1],closedYaw:Math.PI,get angle(){return house.basementFinish.state().gateAngle;},get open(){return house.basementFinish.state().open;},set open(v){if(v!==this.open)house.basementFinish.toggleGate(p);}}];
 const rugSurface=scene.getObjectByName('Thick rounded plush rug');
 const gaze=createGaze(root,bone('DEF-spine.006'),neutralHeadRotation,eyeReference),household=createHousehold({house,world,roomControls,livingInteractions,nav});
 let approachingDoor=false,routeRetries=0,routeAudit={},roaming=false,roamTimer=3,controlWait=null,roamLast='',randomNumber=0;
 const locations={living:{x:12.9,y:0,z:3.2},kitchen:{x:5.65,y:0,z:5.9},bedroom:{x:18.6,y:0,z:3.8},bath:{x:23.4,y:0,z:5.5},office:{x:11.8,y:0,z:13.8},hall:{x:13.7,y:0,z:10.7},basement:{x:18.25,y:-3.15,z:16.5},cell:{x:20.7,y:-3.15,z:11.45}};
 const events=[],completed=new Map();
 let companion=null,awarenessTimer=0,lastPlayerObservation=null;
 let pendingCommand=null,feedback='',feedbackUntil=0;
 const tell=message=>{feedback=message;feedbackUntil=performance.now()+8000;};
 const describe=c=>c.type==='sit'?'坐到'+(seating.list().find(s=>s.id===c.target)?.label||'座位'):c.type==='sleep'?'去床上睡觉':c.type==='get_up'?'起身':c.type==='speak'?'站着说话':c.type==='go_room'?'前往'+({living:'客厅',kitchen:'厨房',bedroom:'卧室',bath:'卫浴',office:'书房',hall:'过道',basement:'地下室',cell:'禁闭室'}[c.target]||c.target):c.type==='control'?'操作家具／灯光':c.type==='walk_to'?'走到目标位置':'开关门';
 const emit=(type,detail={})=>{const e={type,time:Date.now(),...detail};events.push(e);if(events.length>30)events.shift();dispatchEvent(new CustomEvent('cozy-character-event',{detail:e}));};
 function play(name){restoreBathPose();restorePose();const a=mixer.clipAction(clips.get(name));if(action===a&&clipName===name)return;const old=action;a.reset().setEffectiveWeight(1).setLoop(['Idle','Walk','SitIdle','LieIdle'].includes(name)?T.LoopRepeat:T.LoopOnce,Infinity);a.clampWhenFinished=true;a.play();if(old&&old!==a){old.fadeOut(.14);a.fadeIn(.14);}action=a;clipName=name;elapsed=0;}
 play('Idle');
 const seating=createSeating({house,nav}),available=seating.list().map(s=>s.id);
 const wrap=owner=>{const original=owner.activate.bind(owner);owner.activate=(a,p)=>{const id=seating.identify(a);return id?seating.playerSeat(id):original(a,p);};};wrap(livingInteractions);wrap(house.life020);
 house.playerSeat=id=>seating.playerSeat(id);house.releasePlayerSeat=()=>seating.release('player');house.playerSeatGeometry=()=>{const t=seating.ownerSeat('player');if(!t)return null;const g=seating.geometry(t.id,t.slot);if(t.id==='sofa'){g.hip.y+=.13;g.hip.addScaledVector(g.forward,.14);}if(t.id==='tub')g.hip.y+=.035;if(t.id==='bed'){g.hip.y+=.035;g.hip.addScaledVector(g.forward,.13);}return g;};
 function navigate(to,then){approachingDoor=false;routeRetries=0;path=nav.route(p,to);arrival=then;state='walking';play('Walk');}
 function finish(){emit('completed',{command:lastCommand,state});if(lastCommand?.id)completed.set(lastCommand.id,{ok:true,state});lastCommand=null;}
 function idle(){seating.release('npc');state='idle';play('Idle');actor.position.set(p.x,p.y,p.z);anchor=null;transition=null;}
 function beginPosture(t){standAt={...p};anchor=t;const name=t.bed?'LieDown':'SitDown';const start=actor.position.clone(),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),t.yaw);const dest=t.hip.clone().sub(end[name].hip.clone().applyQuaternion(q));yaw=t.yaw;actor.rotation.y=yaw;transition={start,end:dest,name,next:t.bed?'LieIdle':'SitIdle'};state=t.bed?'lying_down':'sitting_down';play(name);}
 function getUp(){if(!['sleeping','seated'].includes(state))throw Error('人物当前没有坐下或睡下');const name=state==='sleeping'?'GetUp':'StandUp';transition={start:actor.position.clone(),end:new T.Vector3(standAt.x,standAt.y,standAt.z),name,next:'Idle'};state='getting_up';play(name);}
 function command(c){
  if(!c||typeof c!=='object'||typeof c.type!=='string')return {ok:false,error:'指令格式无效'};
  if(c.id&&completed.has(c.id))return completed.get(c.id);
  if(c.id&&lastCommand?.id===c.id)return {ok:true,accepted:true,state};
  if(c.id&&pendingCommand?.id===c.id)return {ok:true,accepted:true,queued:true,state};
  try{
   const companionResult=companion?.accept(c);if(companionResult){roaming=false;return companionResult;}
   if(c.type==='go_room'&&!c.arrivalOnly){const purpose={office:'boss_chair',bath:'tub',kitchen:'dining_a',basement:'work_chair',living:'sofa'}[c.target];if(purpose)c={...c,type:'sit',target:purpose};else if(c.target==='bedroom')c={...c,type:'sleep'};}
   if(c.type==='expression'){if(!['Happy','Sad','Angry','Tired','Neutral'].includes(c.name))throw Error('未知表情');if(['sleeping','lying_down'].includes(state))throw Error('睡眠闭眼优先，请先起床');if(emotion)emotion.stop();if(c.name!=='Neutral'){const source=clips.get('Expression_'+c.name),filtered=source.tracks.filter(t=>t.name.includes('morphTargetInfluences'));emotion=mixer.clipAction(new T.AnimationClip('face-'+c.name,source.duration,filtered));emotion.reset().setLoop(T.LoopOnce,1).play();}return {ok:true};}
   if(c.type==='talk'){if(!c.active)dialogue.stop();if(c.active&&['sleeping','lying_down'].includes(state))throw Error('睡眠期间不能说话');c.active?speech.start():speech.stop();return {ok:true};}
   if(c.type==='roam'){if(typeof c.active!=='boolean')throw Error('巡游开关格式无效');roaming=c.active;roamTimer=2;return {ok:true,roaming};}
   if(!['walk_to','go_room','control','sit','sleep','get_up','open_door','set_door','speak'].includes(c.type))throw Error('不支持的动作');
   const sameTarget=lastCommand&&['type','target','x','y','z','slot','open','on','text'].every(k=>c[k]===lastCommand[k]);
   const alreadyThere=(state==='seated'&&c.type==='sit'&&anchor?.id===c.target||state==='sleeping'&&c.type==='sleep')&&(c.slot===undefined||c.slot===anchor?.slot);
   if(sameTarget||alreadyThere){
    if(pendingCommand)emit('superseded',{command:pendingCommand,replacement:c});
    pendingCommand=null;tell(alreadyThere?'已经在这个位置了':'正在执行：'+describe(c));
    if(alreadyThere){const result={ok:true,state};if(c.id)completed.set(c.id,result);emit('completed',{command:c,state});return result;}
    return {ok:true,accepted:true,state};
   }
   if(c.type==='walk_to'&&c._companion&&state==='walking'&&!approachingDoor){const next=nav.route(p,{x:c.x,y:c.y??0,z:c.z});path=next;lastCommand={...c};pendingCommand=null;return {ok:true,accepted:true,retargeted:true};}
   if(state!=='idle'&&!(c.type==='get_up'&&['seated','sleeping'].includes(state))){
    if(pendingCommand)emit('superseded',{command:pendingCommand,replacement:c});
    pendingCommand={...c};roaming=false;
    emit('queued',{command:c});tell('已安排：'+describe(c)+'；'+(['seated','sleeping'].includes(state)?'先自动起身':'完成当前动作后执行')+'。再次选择会替换待办目标');
    return {ok:true,accepted:true,queued:true};
   }
   if(c.type==='get_up'){lastCommand=c;if(state==='idle')finish();else getUp();return {ok:true,accepted:true};}
   if(c.type==='speak'){if(typeof c.text!=='string'||!c.text.trim()||c.text.length>180)throw Error('说话内容需要1到180个字');state='speaking';play('Idle');speech.stop();lastCommand={...c};emit('accepted',{command:c});if(c.external){dialogue.prepareExternal(c.text);dispatchEvent(new CustomEvent('cozy-speech-ready',{detail:{id:c.id}}));}else dialogue.say(c.spokenText!=null?{displayText:c.text,spokenText:c.spokenText,language:c.language}:c.text);return {ok:true,accepted:true};}
   if(c.type==='walk_to'){if(!Number.isFinite(c.x)||!Number.isFinite(c.z))throw Error('目标坐标无效');navigate({x:c.x,y:c.y??0,z:c.z},()=>{idle();finish();});}
   if(c.type==='go_room'){const to=locations[c.target];if(!to)throw Error('房间不存在');navigate(to,()=>{idle();finish();});}
   if(c.type==='control'){const task=household.resolve(c.target,c.on,p);path=task.path;arrival=()=>{controlWait=task;state='controlling';yaw=Math.atan2(task.point.x-p.x,task.point.z-p.z);play('OpenDoor');};state='walking';play('Walk');}
   if(c.type==='sit'||c.type==='sleep'){const id=c.type==='sleep'?'bed':c.target;if(!available.includes(id)||(c.type==='sit'&&id==='bed'))throw Error('请选择已标定的座位');const t=seating.actorTarget(id,p,end,c.slot);if(c.type==='sleep')speech.stop();navigate(t.approach,()=>beginPosture(t));}
   if(c.type==='open_door'||c.type==='set_door'){if(c.type==='set_door'&&typeof c.open!=='boolean')throw Error('门开关格式无效');const d=doors.find(d=>d.room===c.target);if(!d)throw Error('本版不支持该门；出口保持锁闭');if(d.room==='cell'&&house.basementFinish.state().locked)throw Error('禁闭室已锁，请先解除门锁');const n=new T.Vector3(Math.sin(d.closedYaw),0,Math.cos(d.closedYaw));const side=(p.x-d.center[0])*n.x+(p.z-d.center[1])*n.z>=0?1:-1;const to={x:d.center[0]+n.x*.95*side,y:d.y,z:d.center[1]+n.z*.95*side};navigate(to,()=>startDoor(d,()=>{idle();finish();},c.open??true));}
   lastCommand={...c};feedback='';emit('accepted',{command:c});return {ok:true,accepted:true};
  }catch(e){if(state==='idle')seating.release('npc');tell(e.message);emit('rejected',{command:c,error:e.message});return {ok:false,error:e.message};}
 }
 function startDoor(d,then,desired=true){if(!centeredAtDoor(p,d)){idle();tell('开门需要先站到门前中央');emit('failed',{command:lastCommand,reason:'开门位置未对齐'});lastCommand=null;return;}const side=Math.sin(d.closedYaw)*(p.x-d.center[0])+Math.cos(d.closedYaw)*(p.z-d.center[1]);if(!d.open)d.sign=side>=0?1:-1;d.npcHold=true;emit('door_started',{door:d.room,position:{...p},center:[...d.center]});doorWait={d,then,desired,triggered:false};state='opening_door';yaw=Math.atan2(d.center[0]-p.x,d.center[1]-p.z);play('OpenDoor');}
 function update(dt){
  if(!getPlayerPosture?.().seated)seating.release('player');
  for(const d of doors){const b=world.colliders.find(b=>b.id===d.id);if(b)b.navigationOpen=Math.abs(d.angle)>1.35;}
  dt=Math.min(.05,Math.max(0,dt));restoreBathPose();gaze.restore();speech.beforeUpdate();restorePose();mixer.update(dt);applyPose(clipName);applyBathPose();speech.update(dt);elapsed+=dt;
  const userDistance=Math.hypot(player.x-p.x,player.z-p.z);
  if(state==='waiting_user'&&(userDistance>(lastCommand?._companion ? .7 : .95)||Math.abs(player.y-p.y)>.5)){state='walking';play('Walk');}
  if(!companion?.controlsPlayer()&&state==='walking'&&path[0]&&Math.abs(player.y-p.y)<.5&&userDistance<(lastCommand?._companion ? .58 : .72)&&((path[0].x-p.x)*(player.x-p.x)+(path[0].z-p.z)*(player.z-p.z))>0){state='waiting_user';play('Idle');}
  if(state==='walking'){
   while(path.length>1&&Math.hypot(path[0].x-p.x,path[0].z-p.z)<.015)path.shift();
   const node=path[0];if(node){const dist=Math.hypot(node.x-p.x,node.z-p.z),speed=.85*(companion?.movementScale()??1);
    const crossing=!approachingDoor?crossingDoor(p,path,doors):null;
    if(crossing&&Math.hypot(p.x-crossing.door.center[0],p.z-crossing.door.center[1])<2.1){
     const goal=path.at(-1),then=arrival;
     try{path=nav.route(p,crossing.approach,true);approachingDoor=true;arrival=()=>startDoor(crossing.door,()=>{approachingDoor=false;try{navigate(goal,then);}catch(e){idle();tell(e.message);emit('failed',{reason:e.message,command:lastCommand});lastCommand=null;}});}
     catch(e){idle();tell('门前通道被挡住了：'+e.message);emit('failed',{reason:e.message,command:lastCommand});lastCommand=null;}
    }
    else{const step=Math.min(dist,speed*dt),x=p.x+(node.x-p.x)/Math.max(dist,1e-6)*step,z=p.z+(node.z-p.z)/Math.max(dist,1e-6)*step;const y=world.support(x,z,p.y);if(y!==null&&Math.abs(y-p.y)<=.205&&nav.valid(x,z,true,y)){yaw=Math.atan2(node.x-p.x,node.z-p.z);p={x,y,z};if(dist<=step+1e-6)path.shift();}else{try{if(++routeRetries>3)throw Error('通道发生阻挡');path=nav.route(p,path.at(-1));}catch(e){idle();emit('failed',{reason:e.message,command:lastCommand});lastCommand=null;}}}
   }else{const f=arrival;arrival=null;f?.();}
  }
  if(state==='controlling'&&controlWait&&elapsed>1.1){try{const result=controlWait.perform(p);emit('household_changed',result);idle();finish();}catch(e){idle();emit('failed',{command:lastCommand,reason:e.message});lastCommand=null;}controlWait=null;}
  if(state==='opening_door'&&doorWait){if(elapsed>.55&&!doorWait.triggered){doorWait.d.open=doorWait.desired;doorWait.triggered=true;renderer.shadowMap.needsUpdate=true;}if(elapsed>=clips.get('OpenDoor').duration&&(!doorWait.desired||Math.abs(doorWait.d.angle)>1.569)){const f=doorWait.then;doorWait=null;f();}}
  for(const d of doors)if(d.npcHold&&!doorWait&&Math.hypot(p.x-d.center[0],p.z-d.center[1])>2.3)d.npcHold=false;
  if(transition){const f=T.MathUtils.smoothstep(elapsed/clips.get(transition.name).duration,0,1);actor.position.lerpVectors(transition.start,transition.end,f);if(anchor?.tub)actor.position.y+=.85*Math.sin(Math.PI*f);if(elapsed>=clips.get(transition.name).duration){const next=transition.next;transition=null;if(next==='Idle'){p={...standAt};idle();}else{state=next==='LieIdle'?'sleeping':'seated';const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);actor.position.copy(anchor.hip).sub(end[next].hip.clone().applyQuaternion(q));play(next);}finish();}}
  else if(['walking','waiting_user','idle','opening_door','controlling','speaking'].includes(state))actor.position.set(p.x,p.y,p.z);
  if(state==='speaking'&&Math.abs(player.y-p.y)<.65&&Math.hypot(player.x-p.x,player.z-p.z)>.3)yaw=Math.atan2(player.x-actor.position.x,player.z-actor.position.z);
  actor.rotation.y+=Math.atan2(Math.sin(yaw-actor.rotation.y),Math.cos(yaw-actor.rotation.y))*(1-Math.exp(-12*dt));
  if(['walking','waiting_user','idle','opening_door','controlling','speaking'].includes(state)){
   const rug=rugSurface;if(rug){rug.updateWorldMatrix(true,false);const local=rug.worldToLocal(new T.Vector3(p.x,p.y,p.z)),r2=local.x*local.x+local.z*local.z;if(r2<1){const top=rug.localToWorld(new T.Vector3(local.x,Math.sqrt(1-r2),local.z)).y;actor.position.y+=Math.max(0,top-p.y)+.004;}}
  }
  actor.updateMatrixWorld(true);gaze.update(dt,actor,{x:player.x,y:player.y,z:player.z,eyeY:player.eyeHeightWorld??camera.position.y},state);const foot=point('DEF-foot.L').add(point('DEF-foot.R')).multiplyScalar(.5);contactShadow.position.set(foot.x,p.y+.016,foot.z);contactShadow.visible=!['sleeping','lying_down','getting_up'].includes(state);
  if(follow){const focus=actor.position.clone().add(new T.Vector3(0,state==='sleeping'?.75:1.2,0)),offset=new T.Vector3(2.2,.75,2.5).applyAxisAngle(new T.Vector3(0,1,0),yaw);const len=offset.length(),dir=offset.clone().normalize(),ray=new T.Ray(focus,dir);let distance=len;for(const b of world.colliders){if(!['wall','door','entry','divider'].includes(b.kind))continue;const hit=ray.intersectBox(new T.Box3(new T.Vector3(b.x,b.base,b.z),new T.Vector3(b.x+b.w,b.base+b.height,b.z+b.d)),new T.Vector3());if(hit)distance=Math.min(distance,Math.max(.3,focus.distanceTo(hit)-.18));}camera.position.copy(focus).addScaledVector(dir,distance);camera.lookAt(focus);}
  if(roaming&&state==='idle'){roamTimer-=dt;if(roamTimer<=0){roamTimer=3+Math.random()*4;const local=household.list().filter(e=>Math.abs((e.position[1]<0?-3.15:0)-p.y)<.2&&Math.hypot(e.position[0]-p.x,e.position[2]-p.z)<2.8);if(Math.random()<.22&&local.length){const item=local[Math.floor(Math.random()*local.length)];command({id:'roam-control-'+(++randomNumber),type:'control',target:item.id,on:!item.on});}else{const keys=Object.keys(locations).filter(k=>k!==roamLast),key=keys[Math.floor(Math.random()*keys.length)];const result=command({id:'roam-'+(++randomNumber),type:'go_room',target:key});if(result.ok)roamLast=key;}}}
  if(pendingCommand){
   if(['seated','sleeping'].includes(state)){getUp();}
   else if(state==='idle'){const next=pendingCommand;pendingCommand=null;command(next);}
  }
  awarenessTimer-=dt;if(awarenessTimer<=0){awarenessTimer=.5;const current={x:player.x,y:player.y,z:player.z,room:world.room(player)};if(!lastPlayerObservation||current.room!==lastPlayerObservation.room||Math.hypot(current.x-lastPlayerObservation.x,current.y-lastPlayerObservation.y,current.z-lastPlayerObservation.z)>.35){lastPlayerObservation=current;dispatchEvent(new CustomEvent('cozy-player-observed',{detail:{...current,observedAt:Date.now()}}));}}
  bodyColliders.length=0;const hp=point('DEF-spine'),hd=point('DEF-spine.006');for(const v of [hp,hd])bodyColliders.push({x:v.x,z:v.z,base:Math.min(p.y,hp.y-.25),height:Math.max(.55,hd.y-p.y+.2),radius:.28});
  companion?.update(dt);
  dialogue.update();
  updatePanel();
 }
 const panel=document.createElement('details');panel.open=true;panel.id='character-test';panel.innerHTML='<summary>人物接入检查</summary><p>模型控制接口已准备 · 尚未连接对话模型</p><div class="buttons"></div><p class="status" role="status" aria-live="polite"></p><details><summary>执行记录</summary><pre></pre></details>';
 document.body.append(panel);const css=document.createElement('style');css.textContent='#character-test{position:fixed;right:12px;top:112px;z-index:30;background:#fff6e9ed;color:#40372f;border-radius:14px;padding:12px;max-width:280px;font:13px sans-serif;max-height:65vh;overflow:auto}#character-test button{margin:3px;padding:9px;border:1px solid #c6b5a2;border-radius:9px;background:#fff}#character-test .status{position:sticky;bottom:0;background:#fff6e9;padding:10px 6px;border-top:1px solid #c6b5a2;z-index:1}#character-test pre{white-space:pre-wrap;max-height:160px;overflow:auto}';document.head.append(css);
 let seq=0,lastUI=0;const btn=(name,fn)=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>{try{const r=fn();if(r?.error)tell(r.error);}catch(e){tell(e.message);}lastUI=-Infinity;updatePanel();};panel.querySelector('.buttons').append(b);};
 btn('检查各房间路线',()=>{routeAudit={};for(const [id,to]of Object.entries(locations)){try{const r=nav.route(p,to);routeAudit[id]={ok:true,points:r.length};}catch(e){routeAudit[id]={ok:false,error:e.message};}}emit('route_audit',routeAudit);});
 for(const [label,sign]of [['站到他面前',1],['站到他身后',-1]])btn(label,()=>{const x=p.x+Math.sin(yaw)*.85*sign,z=p.z+Math.cos(yaw)*.85*sign;if(!nav.valid(x,z,true,p.y))return {error:'这个方向空间不足，请换个开阔位置'};follow=false;window.cozy.setPosition(x,p.y,z,Math.atan2(x-p.x,z-p.z),0);});
 btn('跟随观察',()=>{follow=!follow;});btn('随机巡游 开／关',()=>{roaming=!roaming;roamTimer=1;return {ok:true};});
 for(const [name,key]of [['厨房','kitchen'],['客厅','living'],['卧室','bedroom'],['卫浴','bath'],['书房','office'],['地下室','basement'],['禁闭室','cell']])btn('前往'+name,()=>command({id:'test-room-'+(++seq),type:'go_room',target:key}));
 btn('本房间开／关灯',()=>{const room=world.room(p),entry=household.list().filter(e=>e.id.startsWith('room:')).sort((a,b)=>Math.hypot(a.position[0]-p.x,a.position[2]-p.z, a.position[1]-(p.y+1.22))-Math.hypot(b.position[0]-p.x,b.position[2]-p.z,b.position[1]-(p.y+1.22)))[0];return command({id:'test-light-'+(++seq),type:'control',target:entry.id,on:!entry.on});});
 const select=document.createElement('select');select.style.maxWidth='240px';for(const e of household.list()){const o=document.createElement('option');o.value=e.id;o.textContent=e.label;select.append(o);}panel.append(select);btn('操作选中物件',()=>{const item=household.list().find(e=>e.id===select.value);return command({id:'test-item-'+(++seq),type:'control',target:item.id,on:!item.on});});
 for(const[label,c]of [['走到客厅',{type:'walk_to',x:12.9,z:3.2}],['坐到沙发',{type:'sit',target:'sofa'}],['去床上睡觉',{type:'sleep'}],['起身',{type:'get_up'}],['打开卧室门',{type:'open_door',target:'bedroom'}],['微笑',{type:'expression',name:'Happy'}],['说话',{type:'speak',text:'你回来啦。今天过得怎么样？我一直在这里等你。'}],['停止说话',{type:'talk',active:false}]])btn(label,()=>command({...c,id:'test-'+(++seq)}));
 for(const seat of seating.list().filter(s=>!['sofa','bed'].includes(s.id)))btn('坐到'+seat.label,()=>command({id:'test-seat-'+(++seq),type:'sit',target:seat.id}));
 btn('检查全部座位',()=>{const results={};if(state!=='idle')return {error:'请先让人物起身'};for(const s of seating.list()){try{const t=seating.actorTarget(s.id,p,end);results[s.id]={ok:true,slot:t.slot,hip:t.hip.toArray(),approach:t.approach};}catch(e){results[s.id]={ok:false,error:e.message};}finally{seating.release('npc');}}routeAudit.seating=results;emit('seat_audit',results);});
 for(const [label,id]of [['我坐沙发空位','sofa'],['我躺床的空位','bed'],['我坐浴缸空位','tub']])btn(label,()=>{follow=false;return window.cozy.useSeat(id);});
 const labels={waiting_user:'等你让出通道',idle:'站立待机',walking:'寻路行走',controlling:'操作家具／灯光',opening_door:'开关门',lying_down:'躺下',sleeping:'睡觉',sitting_down:'坐下',seated:'坐在沙发上',getting_up:'起身',speaking:'站着说话'};
 function snapshot(){return {state,clip:clipName,position:{...p},actorPosition:actor.position.toArray(),target:anchor?.id,routeRemaining:path.length,modelConnected:!!window.cozyPrivateConnected,routeAudit,roaming,gaze:gaze.state(),height:1.89,viewerEyeHeight:1.42,speech:speech.state(),seats:seating.snapshot(),lastCommand,pendingCommand,events:[...events],samples:end};}
 function updatePanel(){if(panel.offsetParent===null)return;if(performance.now()-lastUI<300)return;lastUI=performance.now();panel.querySelector('.status').textContent=(feedback&&performance.now()<feedbackUntil?feedback+' · ':'')+(pendingCommand?'待办：'+describe(pendingCommand)+' · ':'')+(state==='seated'?'已坐到'+(anchor?.label||'座位'):labels[state])+(roaming?' · 随机巡游已开启':'')+(gaze.state().tracking?' · 正在看向你':'');panel.querySelector('pre').textContent=JSON.stringify(snapshot(),null,2);}
 const dialogue=createDialogue({camera,chest:()=>point('DEF-spine.003'),onStart:()=>speech.start(),onFinish:()=>{speech.stop();if(state==='speaking'){idle();finish();}},notice:tell});
 dialogue.bindDemo(text=>command({type:'speak',text,id:'voice-'+(++seq)}));
 function references(){
 const origin=camera.getWorldPosition(new T.Vector3()),direction=camera.getWorldDirection(new T.Vector3());
 return sceneReferences({player,actor:p,camera:{position:origin,direction},doors,controls:household.list(),room:q=>world.room(q),visible:(a,b)=>{
  const dest=new T.Vector3(b.x,b.y,b.z),delta=dest.clone().sub(a),distance=delta.length(),ray=new T.Ray(a,delta.normalize());
  for(const c of world.colliders){if(!['wall','divider','entry'].includes(c.kind))continue;const hit=ray.intersectBox(new T.Box3(new T.Vector3(c.x,c.base,c.z),new T.Vector3(c.x+c.w,c.base+c.height,c.z+c.d)),new T.Vector3());if(hit&&hit.distanceTo(a)<distance-.18)return false;}return true;
 }});
 }
 const api={command,snapshot,references,controlsPlayer:()=>companion?.controlsPlayer(),companionState:()=>companion?.state(),cancelExternalSpeech:id=>{if(pendingCommand?.external&&pendingCommand.id===id)pendingCommand=null;if(lastCommand?.external&&lastCommand.id===id)dialogue.endExternal();},externalSpeech:stage=>stage==='start'?dialogue.startExternal():dialogue.endExternal(),userSubtitle:text=>dialogue.userSubtitle(text),update,observe:()=>({player:{position:{x:player.x,y:player.y,z:player.z},room:world.room(player),observedAt:Date.now()},seat:seating.ownerSeat('npc'),state,room:world.room(p),position:{...p},busy:!['idle','seated','sleeping'].includes(state),sleeping:state==='sleeping',talking:speech.active,modelConnected:!!window.cozyPrivateConnected}),targets:()=>({locations,controls:household.list(),furniture:seating.list(),doors:doors.map(d=>d.room),floors:['main','basement']}),setFollow:v=>follow=!!v};
 installCleanUI();
 const diagnostic=document.createElement('details');diagnostic.innerHTML='<summary>画面与视线诊断</summary><pre></pre>';document.querySelector('#home-settings').append(diagnostic);let diagnosticTimer=0;
 diagnostic.addEventListener('toggle',()=>{clearInterval(diagnosticTimer);if(!diagnostic.open)return;const refresh=()=>{const size=renderer.getDrawingBufferSize(new T.Vector2());diagnostic.querySelector('pre').textContent=JSON.stringify({viewport:[innerWidth,innerHeight],devicePixelRatio,renderPixels:size.toArray(),renderRatio:renderer.getPixelRatio(),antialias:renderer.getContext().getContextAttributes().antialias,gaze:gaze.state(),player:api.observe().player},null,2);};refresh();diagnosticTimer=setInterval(refresh,1000);});

 companion=createCompanion({player,observe:api.observe,command,nav,world,gate:house.basementFinish,locations,emit,pairing:()=>seating.companionTarget(),cancelNavigation:(ownedOnly=false)=>{if(pendingCommand?._companion)pendingCommand=null;if(ownedOnly&&!lastCommand?._companion)return;if(state==='opening_door'&&doorWait){doorWait.then=()=>{approachingDoor=false;idle();};lastCommand=null;}if(["walking","waiting_user"].includes(state)){path=[];arrival=null;pendingCommand=null;lastCommand=null;idle();}}});
 btn('过来找我',()=>command({type:'come_to_player'}));btn('跟着我',()=>command({type:'follow',active:true}));btn('带我去禁闭室',()=>command({type:'escort',target:'cell'}));btn('结束当前互动',()=>command({type:'release'}));
 window.cozyCharacter=api;emit('ready');return api;
}
