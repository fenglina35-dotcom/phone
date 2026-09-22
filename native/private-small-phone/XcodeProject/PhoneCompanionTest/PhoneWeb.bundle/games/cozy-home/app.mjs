import {shareGLTFImages,sharedImageStats} from './shared-images044.mjs';
import {createOpaqueSort} from './opaque-order043.mjs';
import {findStandingPoint} from './player-exit037.mjs?build=041';
import {installFemalePlayer} from './house-player036.mjs?build=051';
import {installHouseMirrors} from './house-mirrors036.mjs?build=050';
import {installHouseCharacter} from './house-character.mjs?build=050';
import {advanceWalk,walkSeconds} from './walk030.mjs';
import {bindSurfaceLights} from './surface-lights029.mjs?build=050';
import {optimizeMatteLighting} from './material-performance027.mjs?build=050';
import {indexStaticGeometry} from './geometry026.mjs?build=050';
import {createFrameTiming} from './frame-timing026.mjs?build=041';
import {createTouchLook} from './touch-look026.mjs';
import {installMobileRendering} from './mobile-render025.mjs?build=050';
import {mobile,lean,budget,stage,prepareMobileScene,resolution,bootComplete,toggleSharp,isSharp,qualityName} from './mobile-budget024.mjs?build=050';
import {installWaterLife020} from './water-life-v020.mjs';
import {installRoomControls} from './room-controls-v019.mjs';
import {installLivingInteractions} from './living-interactions-v018.mjs';
import {refineLivingMaterials018,installWindowPictures018} from './living-materials-v018.mjs';
import {finishAtmosphere017,bindStar017} from './refinements-v017.mjs';
import {finishArchitecture,bindOfficeLighting} from './architecture-v016.mjs';
import {finishOffice} from './office-v002.mjs';
import {finishBasement} from './basement-v003.mjs?build=035';
import {finishBedroom} from './bedroom-base-v003.mjs?build=041';
import {finishBathroom} from './bathroom-v001.mjs?build=041';
import * as T from 'three';
import {refineEntrance} from './entry-door.mjs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildHouse} from './scene.mjs';
import {HouseWorld} from './world.mjs?build=041';
import {applyDetailAssets} from './detail-assets.mjs';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {createLighting} from './lighting.mjs?build=045';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {finishLivingRoom} from './living-finish.mjs';
import {createLayoutEditor} from './layout-editor.mjs';
import {finishKitchen} from './kitchen-finish-v003.mjs';
import {enrichKitchen} from './kitchen-details-v010.mjs';

const elementCache=new Map();const $=id=>{if(!elementCache.has(id))elementCache.set(id,document.getElementById(id));return elementCache.get(id);};
const text=(id,value)=>{const el=$(id);if(el.textContent!==value)el.textContent=value;};
const show=(id,visible)=>{const el=$(id);if(el.hidden===visible)el.hidden=!visible;};
const error=e=>{console.error(e);$('error').hidden=false;$('error').textContent='场景暂时没有加载成功。\n'+e.message;$('intro').hidden=true;};
window.addEventListener('error',e=>error(e.error||new Error(e.message)));
window.addEventListener('unhandledrejection',e=>error(e.reason));
let mobileWarmResources=[];

async function boot(){
 shareGLTFImages();
 let character=null,femalePlayer=null,mirrors=null;
 const bootAt=performance.now();
 await stage('正在读取房屋布局…');
 const L=await fetch('./layout.json').then(r=>{if(!r.ok)throw new Error('无法读取户型数据');return r.json()});
 const world=new HouseWorld(L);
 const [bossX,bossZ]=L.office_sight.chair;
 // The outer door is visible and closed in this spatial prototype.
 
 // DPR-3 phones already have high edge density. Avoid a second full-size
 // multisample framebuffer and an unused stencil plane while retaining native
 // canvas resolution, original textures and all scene detail.
 const renderer=new T.WebGLRenderer({canvas:$('view'),antialias:!mobile,stencil:false,powerPreference:'high-performance'});
 renderer.setOpaqueSort(createOpaqueSort(renderer));
 renderer.setPixelRatio(resolution());renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const scene=new T.Scene();scene.background=new T.Color('#d6e5e5');
 const camera=new T.PerspectiveCamera(62,innerWidth/innerHeight,.05,200);camera.rotation.order='YXZ';const interactionCamera=camera.clone();
 await stage('正在准备客厅家具…');
 const house=buildHouse(L);refineEntrance(house);await applyDetailAssets(house);await finishLivingRoom(house);
 await stage('正在准备厨房与餐厅…');finishKitchen(house);await enrichKitchen(house);house.kitchenDetails.applyColliders(world);
 await stage('正在准备卧室…');await finishBedroom(house,L);house.bedroom.applyColliders(world);
 await stage('正在准备浴室与书房…');finishBathroom(house,world);finishOffice(house,world,L);
 await stage('正在准备地下手作间…');await finishBasement(house,world);finishArchitecture(house,world,L);finishAtmosphere017(house,L);scene.add(house.root);
 await stage('正在准备房间灯光…');
 refineLivingMaterials018(house);
 const life=installWaterLife020(house);house.life020=life;
 const lighting=createLighting(scene,renderer,house);bindStar017(house,scene);house.basementFinish.bindLighting(scene,lighting);house.kitchenFinish.bindLighting(scene,lighting);house.kitchenDetails.bindLighting(scene,lighting);bindOfficeLighting(house,scene,lighting);const windowPictures=await installWindowPictures018(house,lighting);const roomControls=installRoomControls(house,scene,renderer,lighting);const livingInteractions=installLivingInteractions(house,renderer,world,roomControls);let pendingInteraction=null;
 $('lighting').onclick=()=>{const next=lighting.state().mode==='day'?'evening':'day';lighting.setMode(next);$('lighting').textContent=next==='day'?'时段：白天':'时段：夜晚';editor?.syncLight();};
 prepareMobileScene(scene);await indexStaticGeometry(house.root);
 const mobileRendering=installMobileRendering(scene,house,camera);const surfaceLights=bindSurfaceLights(scene,house.root);optimizeMatteLighting(scene);
 let composer=null,ao=null;
 if(!lean){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));ao=new SSAOPass(scene,camera,innerWidth,innerHeight,32);ao.kernelRadius=1.7;ao.minDistance=.00035;ao.maxDistance=.003;ao.ssaoMaterial.fragmentShader=ao.ssaoMaterial.fragmentShader.replace('1.0 - occlusion','1.0 - occlusion * 0.55');composer.addPass(ao);composer.addPass(new OutputPass());budget.postprocessing=true;}
 let contextLost=false,recoveryFramePending=false;$('view').addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;});
 $('view').addEventListener('webglcontextrestored',()=>{contextLost=false;recoveryFramePending=true;renderer.shadowMap.needsUpdate=true;});
 let fine=!lean&&renderer.extensions.has('EXT_color_buffer_float');
 function setQuality(){ $('quality').textContent=lean?('画质：'+qualityName()):(fine?'画质：细腻':'画质：流畅'); }
 $('quality').onclick=()=>{if(lean){toggleSharp();resize();}else fine=!fine&&renderer.extensions.has('EXT_color_buffer_float');setQuality();};setQuality();renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 const touchLook=createTouchLook(),frameTiming=createFrameTiming();
 const player={x:10.7,y:0,z:6.5,yaw:0,pitch:-.04};
 let mode='walk',started=false,seated=false,posture=null,postureEye=null,lastStand=null,eyeY=1.42,keys=new Set(),drag=null,joy={x:0,z:0},joyPointer=null,lastTime=0,noticeTimer,editor=null;
 let lastHintTime=-Infinity,cachedAction=null;
 let orbit={yaw:.58,elevation:1.00,distance:22,target:new T.Vector3(7,0,6)},frames=0,soundOn=false,audioContext=null,lastFoot=0;
 function notice(s){$('notice').textContent=s;$('notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('show'),2300);}
 function setMode(next){
  if(editor?.active)editor.setActive(false);
  mode=next;touchLook.reset(player);house.reviewMode(mode);renderer.shadowMap.needsUpdate=true;keys.clear();joy={x:0,z:0};$('stick').style.transform='';
  $('walk').classList.toggle('active',mode==='walk');$('overview').classList.toggle('active',mode==='main');$('basement').classList.toggle('active',mode==='basement');
  $('crosshair').hidden=mode!=='walk';$('joystick').hidden=mode!=='walk';$('interact').hidden=true;
  if(mode==='main')orbit={yaw:.45,elevation:1.03,distance:31,target:new T.Vector3(13,0,6.8)};
  if(mode==='basement')orbit={yaw:.5,elevation:1.04,distance:15,target:new T.Vector3(18.2,-3.15,13.6)};
  $('hint').textContent=mode==='walk'?'WASD 移动 · 拖动转头 · E 互动 · 右上可切换观察位置':'拖动旋转 · 滚轮缩放 · 俯瞰为同一场景的剖切显示';
 }
 function home(){seated=false;posture=null;postureEye=null;Object.assign(player,{x:10.7,y:0,z:6.5,yaw:0,pitch:-.04});eyeY=1.42;setMode('walk');notice('回到玄关');}
 let peopleMode='off',wardrobeMovingUntil=0;
 const pairs=['off','kitchen','living','dining','bedroom'];
 function dynamic(){const objects=[];
  if(peopleMode!=='off')for(const a of house.avatars)objects.push({x:a.g.position.x-.25,z:a.g.position.z-.25,w:.5,d:.5,base:0,height:1.8,kind:'person'});return objects;}
 function setPeople(value){renderer.shadowMap.needsUpdate=true;const old=peopleMode;peopleMode=value;house.setPeople(value);world.dynamic=dynamic();if(world.collides(player.x,player.z,player.y)&&!seated){peopleMode=old;house.setPeople(old);world.dynamic=dynamic();notice('当前位置与临时人物重叠，请先走开一点');return false;}
  $('people').textContent=({off:'双人占位：关',kitchen:'双人：备菜',living:'双人：沙发',dining:'双人：餐桌',bedroom:'双人：床边'})[value];return true;}
 function nearby(){if(seated)return 'stand';const sw=roomControls.nearby(player,interactionCamera);if(sw){pendingInteraction={kind:'switch',index:sw.index,label:roomControls.label(sw.index)};return 'custom';}const li=livingInteractions.near(player,interactionCamera);if(li){pendingInteraction=li;return 'custom';}if(house.architecture.nearStairs(player))return 'stairdoor';if(house.basementFinish.nearGate(player))return 'cellgate';if(house.architecture.nearOffice(player))return 'officedoor';if(player.y<-2.5&&Math.hypot(player.x-19.55,player.z-16.45)<1.1)return 'workchair';if(player.y<-.1)return null;if(Math.hypot(player.x-bossX,player.z-bossZ)<1.4&&player.x<10.65)return 'boss';return null;}
 function standUp(keepInput=false){const exit=findStandingPoint(world,player,lastStand);if(!exit){notice('座位周围没有足够的起身空间，请先移开旁边的家具');return;}Object.assign(player,exit);player.yaw=femalePlayer?.standingYaw()??player.yaw;player.pitch=-.08;seated=false;posture=null;postureEye=null;house.releasePlayerSeat?.();femalePlayer?.update(0);if(!keepInput){keys.clear();joy={x:0,z:0};}lastHintTime=-Infinity;notice('已起身');}
 function interact(){if(mode!=='walk')return;const action=nearby();
  if(action==='stand')standUp();
  else if(action==='custom'){if(pendingInteraction.kind==='switch')notice(roomControls.toggle(pendingInteraction.index));else{const result=livingInteractions.activate(pendingInteraction,player);if(result?.seat){lastStand={...player};seated=true;posture=result.posture||null;postureEye=result.eye??null;Object.assign(player,result.seat);}if(result?.message)notice(result.message);}}
  else if(action==='stairdoor'){notice(house.architecture.toggleStairs(player).message);renderer.shadowMap.needsUpdate=true;}
  else if(action==='officedoor'){notice(house.architecture.toggleOffice(player).message);renderer.shadowMap.needsUpdate=true;}
  else if(action==='cellgate'){const result=house.basementFinish.toggleGate(player);renderer.shadowMap.needsUpdate=true;notice(result.message);}
  else if(action==='wardrobe'){const open=house.bedroom.toggleWardrobe();wardrobeMovingUntil=performance.now()+1800;renderer.shadowMap.needsUpdate=true;notice(open?'衣柜滑门已打开':'衣柜滑门已关闭');}
  else if(action==='boss'||action==='workchair'){const r=house.playerSeat(action==='boss'?'boss_chair':'work_chair');if(r.seat){lastStand={...player};seated=true;posture=r.posture;postureEye=r.eye;Object.assign(player,r.seat);}notice(r.message);}


 }
 const viewpoints={office_entry:[12.68,0,12.4,Math.PI/2,-.18],office_work:[8.55,0,11.45,-2.18,-.55],office_chair:[10.7,0,14.12,.65,-.38],office_books:[10.7,0,10.55,1.90,-.12],office_window:[10.40,0,14.16,2.50,-.12],office_overhead:[9.9,6.5,12.5,0,-Math.PI/2],cell_front:[19.55,-3.15,14.15,0,-.16],cell_inside:[20.77,-3.15,11.65,.85,-.48],basement_tools:[20.70,-3.15,14.35,-2.45,-.20],basement_desk:[19.55,-3.15,17.27,0,-.38],basement_reverse:[19.55,-3.15,13.2,Math.PI,-.16],melody:[16.98,0,1.00,.37,.12],bath_wide:[23.6,0,6.35,0,-.10],bath_basin:[22.6,0,1.72,.18,-.32],bath_tub:[23.40,0,2.9,-.65,-.5],bath_laundry:[23.3,0,4.1,1.30,-.12],bath_toilet:[23.75,0,5.8,-1.51,-.45],bath_reverse_view:[23.6,0,2.4,3.14,-.1],bed_front:[18.175,0,4.65,0,-.18],bed_left:[16.82,0,3.50,-.56,-.22],bed_right:[19.72,0,3.16,.65,-.20],bed_desk:[16.45,0,2.25,.42,-.16],bed_closet:[19.55,0,2.8,-.63,-.04],bed_vanity:[19.0,0,4.4,-1.31,-.13],bed_reverse:[18.175,0,3.3,Math.PI,-.03],bed_curtain:[18.1,0,3.5,0,.20],curtain_side:[11.8,0,1.65,-.74,.12],curtain_heading:[12.9,0,1.15,-.05,.65],entry_detail:[8.3,0,5.45,Math.PI,-.24],entry_shoes:[7.80,0,5.95,Math.PI,-.92],entry_rack:[8.97,0,5.95,Math.PI,.03],curtain_close:[13,0,2.2,0,.04],books_close:[12.65,0,2.65,-.80,-.08],lamp_close:[12.8,0,4.10,-1.25,-.06],sofa_side:[12.72,0,3.7,1.96,-.5],sofa_close:[10.65,0,3.50,Math.PI,-.66],table_close:[11.88,0,3.67,.84,-.69],work_close:[19.55,-3.15,17.27,0,-.38],entry:[10.7,0,6.5,0,-.03],living:[8.35,0,5.9,-.42,-.03],tv:[10.7,0,1.75,Math.PI,-.06],kitchen:[5.65,0,6.35,.36,-.08],kitchen_window:[1.5,0,4.65,Math.PI/2,-.02],kitchen_flowers:[1.3,0,4.6,Math.PI/2,-.29],cooking:[5.65,0,1.6,Math.PI,-.05],bedroom:[17.95,0,6.25,0,-.08],bedside:[16.45,0,3.7,-.62,-.08],bath:[23.4,0,6.5,0,-.12],bath_reverse:[24.6,0,2.3,Math.PI,-.12],office:[12.68,0,12.4,Math.PI/2,-.18],stairs:[16.7,0,15,0,-.25],workshop:[17.6,-3.15,16.85,-.56,-.10]};
 function officeOverview(){setMode('main');orbit={yaw:0,elevation:Math.PI/2,distance:8.3,target:new T.Vector3(9.9,0,12.5)};}
 $('jump').onchange=()=>{if($('jump').value==='office_overhead'){officeOverview();$('jump').value='';return;}const v=viewpoints[$('jump').value];if(!v)return;seated=false;posture=null;postureEye=null;setPeople('off');Object.assign(player,{x:v[0],y:v[1],z:v[2],yaw:v[3],pitch:v[4]});eyeY=player.y+1.42;setMode('walk');$('jump').value='';};
 $('people').onclick=()=>setPeople(pairs[(pairs.indexOf(peopleMode)+1)%pairs.length]);
 function feetSound(speed,dt){if(!soundOn||speed<.3||seated)return;lastFoot+=dt*speed;if(lastFoot<.8)return;lastFoot=0;
  const ctx=audioContext;if(!ctx)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(85,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(38,ctx.currentTime+.07);gain.gain.setValueAtTime(.025,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.09);osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.1);
 }
 $('start').onclick=()=>{started=true;$('intro').hidden=true;};
 $('home').onclick=home;$('walk').onclick=()=>setMode('walk');$('overview').onclick=()=>setMode('main');$('basement').onclick=()=>setMode('basement');$('interact').onclick=interact;
 $('sound').onclick=async()=>{soundOn=!soundOn;if(soundOn){audioContext||=new AudioContext();await audioContext.resume();}$('sound').textContent=soundOn?'声音开':'声音关';$('sound').setAttribute('aria-pressed',String(soundOn));};
 addEventListener('keydown',e=>{
  if(editor?.active||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code!=='Space'&&started&&seated&&mode==='walk')standUp(true);}
  if(e.code==='KeyE'&&!e.repeat)interact();
  if(e.code==='Escape'){if(seated)interact();keys.clear();drag=null;}
 });
 addEventListener('keyup',e=>keys.delete(e.code));
 const clearInput=()=>{lastTime=0;touchLook.reset(player);keys.clear();drag=null;joyPointer=null;joy={x:0,z:0};$('stick').style.transform='';};
 addEventListener('blur',clearInput);addEventListener('pagehide',clearInput);addEventListener('orientationchange',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
 $('view').addEventListener('pointerdown',e=>{if(!started||editor?.active)return;if(drag)return;touchLook.begin(player);drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};$('view').setPointerCapture(e.pointerId);});
 $('view').addEventListener('pointermove',e=>{
  if(editor?.active||!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(mode==='walk'){player.yaw-=dx*.0042;player.pitch=Math.max(-1.45,Math.min(1.55,player.pitch-dy*.0042));}
  else{orbit.yaw-=dx*.005;orbit.elevation=Math.max(.4,Math.min(1.48,orbit.elevation+dy*.004));}
 });
 const pointerNdc=e=>{const r=$('view').getBoundingClientRect();return new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2)};
 $('view').addEventListener('pointerup',e=>{if(editor?.active||mode!=='walk'||!drag||Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6)return;if(seated)return;const ndc=pointerNdc(e),waterAction=life.near(player,interactionCamera,ndc);if(waterAction){const result=life.activate(waterAction,player);if(result?.seat){lastStand={...player};seated=true;posture=result.posture;postureEye=result.eye;Object.assign(player,result.seat);}if(result?.message)notice(result.message);return;}const ray=new T.Raycaster();ray.far=2.6;ray.setFromCamera(ndc,interactionCamera);const hits=ray.intersectObjects(roomControls.switches.map(s=>s.object),true);if(hits[0]?.distance<2.15){let o=hits[0].object;while(o&&o.userData.roomSwitch===undefined)o=o.parent;if(o&&roomControls.reachable(roomControls.switches[o.userData.roomSwitch],player))notice(roomControls.toggle(o.userData.roomSwitch));return;}const h=ray.intersectObjects(livingInteractions.mechanisms,true)[0];if(h?.distance<2.6){let o=h.object;while(o&&!o.userData.mechanism018)o=o.parent;const r=livingInteractions.activate({kind:'mechanism',object:o},player);notice(r.message);return;}const a=livingInteractions.near(player,interactionCamera,ndc);if(a){const r=livingInteractions.activate(a,player);if(r?.seat&&!seated){lastStand={...player};seated=true;posture=r.posture||null;postureEye=r.eye??null;Object.assign(player,r.seat);}if(r?.message)notice(r.message);}});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('view').addEventListener(ev,e=>{if(drag?.id===e.pointerId){touchLook.end(performance.now());drag=null;}});
 $('view').addEventListener('wheel',e=>{if(editor?.active||mode==='walk')return;e.preventDefault();orbit.distance=Math.max(7,Math.min(48,orbit.distance+e.deltaY*.014));},{passive:false});
 function updateJoy(e){const r=$('joystick').getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2),dz=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dz),div=Math.max(42,len);joy={x:dx/div,z:dz/div};if(seated&&mode==='walk'&&!editor?.active&&Math.hypot(joy.x,joy.z)>.12)standUp(true);$('stick').style.transform=`translate(${joy.x*36}px,${joy.z*36}px)`;}
 $('joystick').addEventListener('pointerdown',e=>{if(!started||joyPointer!==null)return;joyPointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);updateJoy(e);e.preventDefault();});
 $('joystick').addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)updateJoy(e);});
 const endJoy=e=>{if(e.pointerId===joyPointer){joyPointer=null;joy={x:0,z:0};$('stick').style.transform='';}};
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])addEventListener(ev,endJoy,true);
 for(const ev of ['touchend','touchcancel'])addEventListener(ev,e=>{if(!e.touches.length){joyPointer=null;joy={x:0,z:0};$('stick').style.transform='';}},{capture:true,passive:true});
 const viewportSize=()=>{const v=mobile?visualViewport:null;return {width:Math.max(1,Math.round(v?.width||document.documentElement.clientWidth||innerWidth)),height:Math.max(1,Math.round(v?.height||document.documentElement.clientHeight||innerHeight))}};
 function resize(){const {width,height}=viewportSize();camera.aspect=width/height;camera.updateProjectionMatrix();interactionCamera.aspect=camera.aspect;interactionCamera.updateProjectionMatrix();renderer.setPixelRatio(resolution(width,height));renderer.setSize(width,height,false);composer?.setSize(width,height);ao?.setSize(Math.round(width*.7),Math.round(height*.7));document.documentElement.style.setProperty('--cozy-vh',height+'px');}let resizeFrame=0;const scheduleResize=()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>requestAnimationFrame(resize));};addEventListener('resize',scheduleResize);addEventListener('orientationchange',scheduleResize);visualViewport?.addEventListener('resize',scheduleResize);visualViewport?.addEventListener('scroll',scheduleResize);resize();
  function render(time){
  if(contextLost){lastTime=0;requestAnimationFrame(render);return;}
  if(recoveryFramePending){clearInput();frameTiming.reset();renderer.resetState();resize();renderer.shadowMap.needsUpdate=true;}
  if(document.hidden){lastTime=0;frameTiming.reset();requestAnimationFrame(render);return;}

  if(lastTime)frameTiming.record(time-lastTime);

  // After a main-thread stall, never replay a stale held direction.
  if(lastTime&&time-lastTime>350)clearInput();
  let cameraLook=player;
  const elapsed=lastTime?(time-lastTime)/1000:.016,walkDt=walkSeconds(elapsed),dt=Math.min(.04,elapsed);lastTime=time;frames++;house.update(dt);const gateMoved=house.basementFinish.update(dt,player),doorMoved=house.architecture.update(dt,player);if(gateMoved||doorMoved)renderer.shadowMap.needsUpdate=true;if(time<wardrobeMovingUntil)renderer.shadowMap.needsUpdate=true;lighting.update(dt);windowPictures.update();life.update(dt,camera);const timeLabel=lighting.state().mode==='day'?'时段：白天':'时段：夜晚';if($('lighting').textContent!==timeLabel)$('lighting').textContent=timeLabel;roomControls.update(dt);livingInteractions.update(dt);
  character?.update(dt);
  if(editor?.active){editor.update();$('interact').hidden=true;}
  else if(mode==='walk'){
   const moveIntent=[...keys].some(k=>['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k))||Math.hypot(joy.x,joy.z)>.12;
   const exiting=started&&seated&&moveIntent;
   if(exiting)standUp(true);
   if(started&&!exiting&&!seated&&!femalePlayer?.isGettingUp()&&!character?.controlsPlayer()){
    let side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joy.x;
    let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joy.z;
    const distance=advanceWalk(world,player,side,forward,walkDt);if(walkDt)feetSound(distance/walkDt,walkDt);
   }
   const wanted=player.y+(seated?(postureEye??(player.y===0&&player.z<7.4?1.04:1.23)):1.42);eyeY=T.MathUtils.lerp(eyeY,wanted,1-Math.exp(-14*dt));
   const look=lean?touchLook.sample(player,walkDt||dt,time):player;cameraLook=look;camera.position.set(player.x,eyeY,player.z);camera.rotation.set(look.pitch,look.yaw,0,'YXZ');interactionCamera.position.copy(camera.position);interactionCamera.quaternion.copy(camera.quaternion);interactionCamera.updateMatrixWorld(true);
   if(time-lastHintTime>100){cachedAction=nearby();lastHintTime=time;}const action=cachedAction;show('interact',started&&!seated&&!!action&&action!=='stand');text('interact',({custom:pendingInteraction?.label,stairdoor:house.architecture.doors.find(d=>d.room==='stairs').open?'关上地下室门':'打开地下室门',officedoor:house.architecture.doors.find(d=>d.room==='office').open?'关上书房门':'打开书房门',cellgate:house.basementFinish.state().locked?'禁闭室已上锁':house.basementFinish.state().open?'关上铁门':'打开铁门',wardrobe:house.bedroom.state().wardrobeOpen?'关上衣柜':'打开衣柜',stand:posture==='bathing'?'离开浴缸':posture==='lying'?'从床上起身':'起身',workchair:'坐到工作椅上',boss:'坐到老板椅上'})[action]||'互动');
   text('roomName',posture?world.room(player)+(posture==='lying'?' · 已躺下':posture==='bathing'?' · 洗澡中':' · 已坐下'):seated?(player.y<-2.5?'皮具工作室 · 已坐下':player.z<7.4?(player.x<6.6?'餐厅 · 已坐下':'客厅 · 已坐下'):'书房 · 已坐下'):world.room(player));text('floorName',player.y<-2.5?'地下层':player.y<-.1?'楼梯':'主层');
  }else{
   camera.position.set(orbit.target.x+Math.sin(orbit.yaw)*Math.cos(orbit.elevation)*orbit.distance,orbit.target.y+Math.sin(orbit.elevation)*orbit.distance,orbit.target.z+Math.cos(orbit.yaw)*Math.cos(orbit.elevation)*orbit.distance);
   camera.lookAt(orbit.target);$('roomName').textContent=mode==='main'?'主层全景':'地下层全景';$('floorName').textContent='同一场景 · 剖切';
  }
  surfaceLights.update(!!editor?.active);if(mobileRendering.update(player,dt,mode!=='walk',!!editor?.active))surfaceLights.refresh();
  femalePlayer?.update(dt,cameraLook);renderer.info.reset();if(fine)composer.render();else renderer.render(scene,camera);
  if(recoveryFramePending&&!renderer.getContext().isContextLost()&&renderer.info.render.calls>0){recoveryFramePending=false;$('view').dispatchEvent(new Event('cozy-render-restored'));}
  requestAnimationFrame(render);
 }
 editor=createLayoutEditor({scene,camera,renderer,house,world,lighting,notify:notice,onActive:active=>{
  mobileRendering.restore();livingInteractions.refresh();clearInput();seated=false;setPeople('off');
  if(active){started=true;$('intro').hidden=true;house.reviewMode('walk');$('joystick').hidden=true;$('crosshair').hidden=true;$('hint').textContent='布置模式 · 拖动物品箭头 · 拖空白转视角 · 修改自动保存';}
  else{if(world.collides(player.x,player.z,player.y)){const candidates=[[10.7,0,6.5],[8.35,0,5.9],[12.65,0,2.65]];let safe=candidates.find(([x,y,z])=>world.valid(x,z,y)!==null);if(!safe){for(let z=.5;z<7;z+=.4)for(let x=6.9;x<14.4;x+=.4)if(!safe&&world.valid(x,z,0)!==null)safe=[x,0,z];}if(safe){[player.x,player.y,player.z]=safe;eyeY=player.y+1.42;}}
   house.reviewMode(mode);$('joystick').hidden=mode!=='walk';$('crosshair').hidden=mode!=='walk';$('hint').textContent='WASD 移动 · 拖动转头 · E 互动 · 布置模式可继续调整';}
 }});
 await stage('正在准备第一帧画面…');
 camera.position.set(10.7,1.42,6.5);scene.updateMatrixWorld(true);
 // On iPhone, never draw the six rooms with their real materials during boot.
 // Doing so keeps every HD texture, geometry buffer and mirror target resident
 // at once; WebKit then degrades live materials to black/white under GPU pressure.
 if(!mobile)await renderer.compileAsync(scene,camera);mobileRendering.update(player,.13,false,false);
 await stage('正在接入罗兰与动作…');character=await installHouseCharacter({scene,house,world,renderer,camera,player,roomControls,livingInteractions,getPlayerPosture:()=>({seated,eyeY})});
 await stage('正在接入你的角色与实时镜面…');femalePlayer=await installFemalePlayer({scene,camera,world,player,house,getState:()=>({seated,posture,mode,editing:!!editor?.active})});mirrors=installHouseMirrors(scene,house,{mobile:matchMedia('(pointer:coarse)').matches,world});
 if(mobile){
  // Compile room shader variants with isolated one-pixel stand-ins. Formal
  // scene materials are restored before every warm draw finishes, so Safari
  // cannot cache a stand-in against a character, floor or furniture material.
  await stage('正在准备房间光影…');const savedPosition=camera.position.clone(),savedQuaternion=camera.quaternion.clone();
  const warmDraw=()=>{const warmMaps=new Map(),materialClones=new Map(),objectSwaps=[],warmTexture=source=>{const key=source.colorSpace||'';if(warmMaps.has(key))return warmMaps.get(key);const t=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1,T.RGBAFormat);t.colorSpace=source.colorSpace;t.needsUpdate=true;warmMaps.set(key,t);return t;};
   const cloneMaterial=source=>{if(materialClones.has(source))return materialClones.get(source);const clone=source.clone();clone.onBeforeCompile=source.onBeforeCompile;clone.customProgramCacheKey=source.customProgramCacheKey;for(const key of Object.keys(clone)){const texture=clone[key];if(texture?.isTexture&&key!=='envMap')clone[key]=warmTexture(texture);}materialClones.set(source,clone);return clone;};
   scene.traverse(o=>{if(!o.material||o.userData.liveMirror)return;objectSwaps.push([o,o.material]);o.material=Array.isArray(o.material)?o.material.map(cloneMaterial):cloneMaterial(o.material);});
   try{renderer.render(scene,camera);}finally{for(const [o,material]of objectSwaps)o.material=material;mobileWarmResources.push(...materialClones.values(),...warmMaps.values());}
  };
  for(const name of ['living','kitchen','bed_vanity','bath_basin','office_work','cell_front']){
   const [x,y,z,yaw,pitch]=viewpoints[name],warm={x,y,z};mobileRendering.update(warm,.13,false,false);surfaceLights.refresh();
   const focus=new T.Vector3(x,y+1.05,z),offset=new T.Vector3(0,.42,2.1).applyEuler(new T.Euler(pitch*.65,yaw,0,'YXZ'));camera.position.copy(focus).add(offset);camera.lookAt(focus);scene.updateMatrixWorld(true);await renderer.compileAsync(scene,camera);
   if(name==='bed_vanity'||name==='bath_basin')warmDraw();
  }
  // Keep the compiled programs but release warm geometry and mirror buffers.
  // CPU input smoothing and allocation reductions remain active; stability
  // takes priority over keeping all rooms resident on a phone GPU.
  mirrors.releaseGPU();const geometries=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(geometry=>geometry.dispose());
  const warmSet=new Set(mobileWarmResources);let warmResourceLeaks=0;scene.traverse(o=>{for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){if(warmSet.has(material))warmResourceLeaks++;for(const value of Object.values(material))if(warmSet.has(value))warmResourceLeaks++;}});budget.warmResourceLeaks=warmResourceLeaks;if(warmResourceLeaks)throw new Error('临时预热材质没有完全退出正式场景');
  camera.position.copy(savedPosition);camera.quaternion.copy(savedQuaternion);mobileRendering.update(player,.13,false,false);surfaceLights.refresh();
 }
 renderer.render(scene,camera);budget.firstFrameMs=Math.round(performance.now()-bootAt);bootComplete();
 editor.setActive(false);$('start').disabled=false;$('start').innerHTML='进入小家 <span>→</span>';setMode('walk');requestAnimationFrame(render);
 // Test/export entry points. Presentation controls don't bypass collision during normal walking.
 window.cozy={ready:true,revision:52,sharedImageStats,femalePlayer,mirrors,touchLook,frameTiming,budget,mobileRendering,life,windowPictures,roomControls,livingInteractions,lighting,L,world,player,house,camera,scene,renderer,editor,
  state:()=>({lighting:lighting.state(),mode,seated,posture,started,player:{...player},frames,peopleMode,fridgeOpen:house.kitchenMechanisms019.fridgeDoors.some(g=>g.userData.mechanism018.open),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),
  start:()=>{$('start').click()},officeOverview,setMode,setPeople,viewpoints,
  useSeat:id=>{if(seated)return notice('请先起身');const r=house.playerSeat(id);if(r.seat){lastStand={...player};seated=true;posture=r.posture;postureEye=r.eye;Object.assign(player,r.seat);}notice(r.message);},
  setPosition:(x,y,z,yaw=0,pitch=0)=>{seated=false;posture=null;postureEye=null;Object.assign(player,{x,y,z,yaw,pitch});eyeY=y+1.42;setMode('walk');},
  step:(dx,dz)=>world.move(player,dx,dz),interact,
  exportBasement:async()=>{const previous=mode;house.reviewMode('walk');const g=house.basement.clone(true);g.name='Basement003 metres Y-up';let bytes;try{bytes=await new GLTFExporter().parseAsync(g,{binary:true,onlyVisible:true});}finally{house.reviewMode(previous);}const u=new Uint8Array(bytes);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(s);},
  exportKitchen:async()=>{const bytes=await new GLTFExporter().parseAsync(house.kitchenDetails.exportFullRoot(),{binary:true,onlyVisible:false});const view=new Uint8Array(bytes);let s='';for(let i=0;i<view.length;i+=32768)s+=String.fromCharCode(...view.subarray(i,i+32768));return btoa(s);},
  exportBedroom:async()=>{const bytes=await new GLTFExporter().parseAsync(house.bedroom.exportRoot(),{binary:true,onlyVisible:false});const a=new Uint8Array(bytes);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);},
  exportOffice:async()=>{const bytes=await new GLTFExporter().parseAsync(house.office.exportRoot(),{binary:true,onlyVisible:false});const a=new Uint8Array(bytes);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);},
  exportBathroom:async()=>{const bytes=await new GLTFExporter().parseAsync(house.bathroom.exportRoot(),{binary:true,onlyVisible:false});const a=new Uint8Array(bytes);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);},
  exportGLB:async()=>{
   const old=mode;house.reviewMode('walk');house.livingFinish.setContours(false);house.root.updateMatrixWorld(true);
   let bytes;try{bytes=await new GLTFExporter().parseAsync(house.root,{binary:true,onlyVisible:true});}finally{house.livingFinish.setContours(true);house.reviewMode(old);}
   const view=new Uint8Array(bytes);let binary='';for(let i=0;i<view.length;i+=32768)binary+=String.fromCharCode(...view.subarray(i,i+32768));return btoa(binary);
  }
 };
}
boot().then(()=>{const v=new URLSearchParams(location.search).get('view');if(window.cozy?.viewpoints[v]){cozy.start();if(v==='office_overhead')cozy.officeOverview();else cozy.setPosition(...cozy.viewpoints[v]);}}).catch(error);




