import {LAYOUT_KEY,LAYOUT_SCHEMA,normalizeLayout,loadLayout,persistLayout} from './layout-storage.mjs';
import * as T from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const KEY=LAYOUT_KEY;
export function createLayoutEditor({scene,camera,renderer,house,world,lighting,onActive,notify}){
 const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='./editor.css';document.head.append(stylesheet);
 const entries=new Map(),originals=new Map(),templates=new Map(),history=[],future=[];let selected=null,active=false,serial=0,gesture=null,restoring=false;
 const panel=document.createElement('aside');panel.id='layoutEditor';panel.hidden=true;panel.setAttribute('aria-label','布置与灯光');
 panel.innerHTML=`<div class="editor-head"><strong>布置与灯光</strong><button id="edClose">完成布置</button></div>
 <p>拖动箭头移动；拖动空白处转动视角。滚轮缩放，双指可缩放和平移。</p>
 <label>选中物品<select id="edSelect"></select></label>
 <div class="editor-row"><button id="edMove">移动</button><button id="edRotate">旋转</button><button id="edCopy">复制</button><button id="edDelete">删除副本</button></div>
 <fieldset><legend>位置（米）</legend><div class="editor-three">${['x','y','z'].map((a,i)=>`<label>${['左右 X','高度 Y','前后 Z'][i]}<input id="ed${a}" type="number" step="0.01" min="-50" max="50"></label>`).join('')}</div></fieldset>
 <fieldset><legend>角度（度）</legend><div class="editor-three">${['rx','ry','rz'].map((a,i)=>`<label>${['前后倾','朝向','侧倾'][i]}<input id="ed${a}" type="number" step="1" min="-360" max="360"></label>`).join('')}</div></fieldset>
 <div class="editor-row"><button id="edDown">落到下方表面</button><button id="edResetObject">复原此物品</button></div>
 <div class="editor-row"><button id="edUndo">撤销</button><button id="edRedo">重做</button></div>
 <details open><summary>调节灯光</summary><label>光源<select id="edLight"></select></label><label>亮度 <output id="edPowerValue"></output><input id="edPower" type="range" min="0" max="5" step="0.01"></label><label class="editor-color">光的颜色<input id="edColor" type="color"></label><label>画面曝光 <output id="edExposureValue"></output><input id="edExposure" type="range" min="0.5" max="1.8" step="0.01"></label><details><summary>光源位置</summary><div class="editor-three">${['lx','ly','lz'].map((a,i)=>`<label>${['X','Y','Z'][i]}<input id="ed${a}" type="number" step="0.1" min="-50" max="50"></label>`).join('')}</div></details></details>
 <div class="editor-row"><button id="edSave">保存布局</button><button id="edExport">导出布局</button><button id="edImport">导入布局</button></div><button id="edDefault">恢复初始布置</button><input id="edFile" type="file" accept="application/json,.json" hidden><p id="edStatus" role="status">修改会自动保存在本机；导出文件可留作备份。</p><small>靠枕为静态模型，可重叠或悬空；落到表面后再微调，目前不模拟布料挤压。</small>`;
 document.body.append(panel);const $=id=>document.getElementById(id);
 const toggle=document.createElement('button');toggle.id='editLayout';toggle.textContent='布置 / 灯光';document.querySelector('header nav').prepend(toggle);
 const controls=new TransformControls(camera,renderer.domElement);controls.setSpace('world');controls.setSize(.72);const helper=controls.getHelper();helper.name='Layout editor gizmo';helper.visible=false;scene.add(helper);
 const orbit=new OrbitControls(camera,renderer.domElement);orbit.enabled=false;orbit.enableDamping=true;orbit.dampingFactor=.12;orbit.minDistance=.35;orbit.maxDistance=20;
 const selectionBox=new T.Box3Helper(new T.Box3(),0xb78674);selectionBox.visible=false;selectionBox.material.depthTest=false;selectionBox.renderOrder=10;scene.add(selectionBox);
 const baselineColliders=world.colliders.map(c=>({...c}));
 const furniture=[['sofa','主沙发'],['coffee','茶几与小物'],['tv','电视与电视柜'],['living_books','书柜'],['living_chest','边柜与台灯'],['entry_console','鞋柜与台灯'],['side_seat','绿色侧沙发'],['floor_lamp','落地灯']];
 function register(id,label,object,kind,source=null){object.userData.editorId=id;const e={id,label,object,kind,source};entries.set(id,e);return e;}
 // Independent handles have world-aligned axes and a pivot at the model centre.
 for(const [id,label] of furniture){const model=house.assets.get(id);if(!model)continue;model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model);const g=new T.Group();g.name='Editable '+id;model.parent.add(g);g.position.copy(model.userData.legacyEditorWorldPivot?new T.Vector3(...model.userData.legacyEditorWorldPivot):box.getCenter(new T.Vector3()));g.updateMatrixWorld(true);g.attach(model);register(id,label,g,'furniture');}
 house.root.traverse(o=>{if(o.userData.editablePart){const {id,label,kind}=o.userData.editablePart;register(id,label,o,kind)}});
 const values=a=>a.map(v=>Math.round(v*1e9)/1e9||0);
 const transform=o=>({position:values(o.position.toArray()),quaternion:values(o.quaternion.toArray()),scale:values(o.scale.toArray())});
 const childPose=o=>o.children.map(c=>({...transform(c),children:childPose(c)}));
 function applyPose(o,pose){if(!pose)return;pose.forEach((p,i)=>{const c=o.children[i];if(!c)return;c.position.fromArray(p.position);c.quaternion.fromArray(p.quaternion);c.scale.fromArray(p.scale);applyPose(c,p.children)})}
 for(const [id,e] of entries){originals.set(id,transform(e.object));templates.set(id,e.object.clone(true));}
 const snapshot=()=>({schema:LAYOUT_SCHEMA,items:[...entries.values()].map(e=>({id:e.id,source:e.source,label:e.label,kind:e.kind,...transform(e.object),...(e.source?{pose:childPose(e.object)}:{})})),lights:lighting.getCustom(),exposure:renderer.toneMappingExposure});
 const initial=snapshot();let storageBlocked=false;
 function save(){if(storageBlocked){$('edStatus').textContent='原存档未成功读取，已保护不覆盖；可先导出当前布置。';return;}try{persistLayout(localStorage,snapshot());$('edStatus').textContent='已自动保存到本机 '+new Date().toLocaleTimeString();}catch{$('edStatus').textContent='本机存储不可用，请使用“导出布局”备份。';}}
 function commit(before,followFixture=true){
  const fixture=followFixture&&({floor_lamp:'reading',living_chest:'chest',entry_console:'entry'})[selected?.id];
  if(fixture){const old=before.items.find(i=>i.id===selected.id),o=selected.object;if(old&&JSON.stringify({position:old.position,quaternion:old.quaternion,scale:old.scale})!==JSON.stringify(transform(o))){o.updateMatrix();o.parent.updateMatrixWorld(true);const previous=new T.Matrix4().compose(new T.Vector3().fromArray(old.position),new T.Quaternion().fromArray(old.quaternion),new T.Vector3().fromArray(old.scale));const delta=o.parent.matrixWorld.clone().multiply(o.matrix).multiply(previous.invert()).multiply(o.parent.matrixWorld.clone().invert());lighting.moveFixture(fixture,delta);syncLight();}}
  const a=JSON.stringify(before),b=JSON.stringify(snapshot());if(a!==b){history.push(before);if(history.length>40)history.shift();future.length=0;syncColliders();save();}refresh();}
 function options(){const select=$('edSelect');select.replaceChildren();for(const e of entries.values())select.add(new Option(e.label,e.id));if(selected)select.value=selected.id;}
 function select(id){selected=entries.get(id)||null;if(selected){controls.attach(selected.object);selectionBox.box.setFromObject(selected.object);}else controls.detach();helper.visible=active&&!!selected;selectionBox.visible=active&&!!selected;options();refresh();}
 function syncColliders(){
  const originalIds=new Set([...entries.values()].filter(e=>e.kind==='furniture'&&!e.source).map(e=>e.id));world.colliders=baselineColliders.filter(c=>!originalIds.has(c.id)).map(c=>({...c}));
  for(const e of entries.values())if(e.kind==='furniture'){
   const original=originals.get(e.id),base=baselineColliders.find(c=>c.id===e.id);
   if(base&&JSON.stringify(transform(e.object))===JSON.stringify(original)){world.colliders.push({...base});continue;}
   e.object.updateMatrixWorld(true);const b=new T.Box3().setFromObject(e.object);world.colliders.push({id:e.id,kind:'edited furniture',x:b.min.x,z:b.min.z,w:b.max.x-b.min.x,d:b.max.z-b.min.z,base:b.min.y,height:b.max.y-b.min.y});
  }
 }
 function refresh(){
  if(selected){const p=selected.object.getWorldPosition(new T.Vector3()),q=selected.object.getWorldQuaternion(new T.Quaternion()),r=new T.Euler().setFromQuaternion(q,'XYZ');for(const [id,v] of Object.entries({x:p.x,y:p.y,z:p.z,rx:T.MathUtils.radToDeg(r.x),ry:T.MathUtils.radToDeg(r.y),rz:T.MathUtils.radToDeg(r.z)}))if(document.activeElement!==$('ed'+id))$('ed'+id).value=v.toFixed(id.length===1?3:1);selectionBox.box.setFromObject(selected.object);}
  $('edDelete').disabled=!selected?.source;$('edUndo').disabled=!history.length;$('edRedo').disabled=!future.length;
  renderer.shadowMap.needsUpdate=true;
 }
 function setWorldPosition(o,p){o.position.copy(o.parent.worldToLocal(p));o.updateMatrixWorld(true);}
 function setActive(value){active=!!value;document.body.classList.toggle('layout-editing',active);panel.hidden=!active;helper.visible=active&&!!selected;selectionBox.visible=active&&!!selected;controls.enabled=active;orbit.enabled=active;
  if(active){const target=selected?new T.Box3().setFromObject(selected.object).getCenter(new T.Vector3()):new T.Vector3(10.75,.75,4.45);orbit.target.copy(target);if(camera.position.distanceTo(target)>8)camera.position.set(11.7,2.15,2.9);camera.lookAt(target);orbit.update();syncLight();}
  toggle.textContent=active?'正在布置':'布置 / 灯光';onActive(active);refresh();}
 function changeField(){if(!selected)return;const before=snapshot(),p=new T.Vector3(...['x','y','z'].map(a=>Number($('ed'+a).value))),angles=['rx','ry','rz'].map(a=>Number($('ed'+a).value));if(![...p.toArray(),...angles].every(Number.isFinite))return;
  p.clampScalar(-50,50);setWorldPosition(selected.object,p);const q=new T.Quaternion().setFromEuler(new T.Euler(...angles.map(T.MathUtils.degToRad),'XYZ'));selected.object.quaternion.copy(selected.object.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));selected.object.updateMatrixWorld(true);commit(before);}
 for(const a of ['x','y','z','rx','ry','rz'])$('ed'+a).onchange=changeField;
 function copy(){if(!selected)return;if(entries.size>=80){notify('当前最多保留 80 件可编辑物品');return;}const before=snapshot(),base=selected,source=base.source||base.id,id='copy-'+(++serial),o=base.object.clone(true);const nested=[];o.traverse(n=>{if(n!==o&&n.userData.editorId?.startsWith('copy-'))nested.push(n)});nested.forEach(n=>n.removeFromParent());o.traverse(n=>{delete n.userData.editorId;delete n.userData.editablePart;});base.object.parent.add(o);register(id,base.label.replace(/ · 副本.*$/,'')+' · 副本 '+serial,o,base.kind,source);o.updateMatrixWorld(true);const b=new T.Box3().setFromObject(o),p=o.getWorldPosition(new T.Vector3());p.x+=base.kind==='pillow'?.28:Math.min(1,(b.max.x-b.min.x)*.6);setWorldPosition(o,p);select(id);commit(before);}
 function remove(){if(!selected?.source)return;const before=snapshot(),id=selected.id;controls.detach();selected.object.removeFromParent();entries.delete(id);select('pillow_melody');commit(before);}
 function settle(){if(!selected)return;const before=snapshot(),o=selected.object;o.updateMatrixWorld(true);const box=new T.Box3().setFromObject(o),center=box.getCenter(new T.Vector3());
  const excluded=new Set();o.traverse(n=>excluded.add(n));const surfaces=[];house.root.traverse(n=>{if(n.isMesh&&!excluded.has(n)&&!n.userData.runtimeContour&&n.visible&&!n.material?.transparent&&!n.name.includes('backdrop'))surfaces.push(n)});
  const ray=new T.Raycaster(new T.Vector3(center.x,box.min.y+.16,center.z),new T.Vector3(0,-1,0),0,6);const hit=ray.intersectObjects(surfaces,false)[0];
  if(!hit){notify('下方没有找到可放置表面，请先移到沙发或地面上方');return;}const p=o.getWorldPosition(new T.Vector3());p.y+=hit.point.y-box.min.y+.001;setWorldPosition(o,p);commit(before);}
 function validate(data){
  if(data?.schema!==LAYOUT_SCHEMA||!Array.isArray(data.items)||data.items.length>80)throw Error('这不是本版导出的布局文件');
  function validTransform(i){for(const [key,size,limit] of [['position',3,100],['quaternion',4,1.01],['scale',3,3]])if(!Array.isArray(i[key])||i[key].length!==size||!i[key].every(v=>Number.isFinite(v)&&Math.abs(v)<=limit))throw Error('位置或角度无效');if(i.scale.some(v=>v<=.000001)||Math.abs(Math.hypot(...i.quaternion)-1)>.001)throw Error('模型大小或旋转无效');}
  function validPose(p,depth=0){if(!Array.isArray(p)||p.length>300||depth>12)throw Error('物品结构无效');for(const c of p){validTransform(c);validPose(c.children,depth+1);}}
  const ids=new Set();for(const i of data.items){if(!i||typeof i.id!=='string'||ids.has(i.id))throw Error('物品编号重复或无效');ids.add(i.id);if(i.source?(!originals.has(i.source)||!/^copy-\d+$/.test(i.id)):!originals.has(i.id))throw Error('找不到对应家具');validTransform(i);if(i.source&&i.pose)validPose(i.pose);}
  for(const id of originals.keys())if(!ids.has(id))throw Error('布局缺少原始家具');if(!Number.isFinite(data.exposure)||data.exposure<.5||data.exposure>1.8)throw Error('曝光值无效');
  if(!data.lights||typeof data.lights!=='object')throw Error('灯光数据无效');for(const [mode,settings] of Object.entries(data.lights)){if(!['day','evening'].includes(mode))throw Error('灯光场景无效');for(const [id,v] of Object.entries(settings)){const light=lighting.editableLights.find(e=>e.id===id);if(!light||!Number.isFinite(v.intensity)||v.intensity<0||v.intensity>light.max||!/^#[0-9a-f]{6}$/i.test(v.color)||!Array.isArray(v.position)||v.position.length!==3||!v.position.every(x=>Number.isFinite(x)&&Math.abs(x)<=50))throw Error('灯光参数无效');}}
  return data;
 }
 function restore(data){validate(data);restoring=true;try{controls.detach();for(const [id,e] of entries)if(e.source){e.object.removeFromParent();entries.delete(id);}
  for(const i of data.items.filter(i=>!i.source)){const o=entries.get(i.id).object;o.position.fromArray(i.position);o.quaternion.fromArray(i.quaternion);o.scale.fromArray(i.scale);}
  for(const i of data.items.filter(i=>i.source)){const base=entries.get(i.source),o=templates.get(i.source).clone(true);applyPose(o,i.pose);o.traverse(n=>{delete n.userData.editorId;delete n.userData.editablePart});base.object.parent.add(o);o.position.fromArray(i.position);o.quaternion.fromArray(i.quaternion);o.scale.fromArray(i.scale);register(i.id,base.label+' · 副本 '+i.id.replace('copy-',''),o,base.kind,i.source);serial=Math.max(serial,Number(i.id.replace('copy-',''))||0);}
  house.root.updateMatrixWorld(true);lighting.setCustom(data.lights);renderer.toneMappingExposure=data.exposure;syncColliders();select(selected&&entries.has(selected.id)?selected.id:'pillow_melody');syncLight();
 }finally{restoring=false;}}
 function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());save();refresh();}
 function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());save();refresh();}
 function reset(){const before=snapshot();restore(initial);commit(before,false);}
 function syncLight(){const e=lighting.editableLights.find(e=>e.id===$('edLight').value)||lighting.editableLights[0];$('edPower').max=e.max;$('edPower').value=e.light.intensity;$('edPowerValue').textContent=e.light.intensity.toFixed(2);$('edColor').value='#'+e.light.color.getHexString();for(const [i,a] of ['lx','ly','lz'].entries())$('ed'+a).value=e.light.position.toArray()[i].toFixed(2);$('edExposure').value=renderer.toneMappingExposure;$('edExposureValue').textContent=renderer.toneMappingExposure.toFixed(2);}
 lighting.editableLights.forEach(e=>$('edLight').add(new Option(e.label,e.id)));$('edLight').onchange=syncLight;
 let lightBefore=null;
 function adjustLight(final=false){lightBefore||=snapshot();const e=lighting.editableLights.find(e=>e.id===$('edLight').value),position=['lx','ly','lz'].map(a=>Number($('ed'+a).value));if(!position.every(Number.isFinite))return;const v={intensity:Math.min(e.max,Math.max(0,Number($('edPower').value))),color:$('edColor').value,position:position.map(x=>Math.max(-50,Math.min(50,x)))};lighting.adjust(e.id,v,final);renderer.toneMappingExposure=Number($('edExposure').value);$('edPowerValue').textContent=v.intensity.toFixed(2);$('edExposureValue').textContent=renderer.toneMappingExposure.toFixed(2);if(final){const b=lightBefore;lightBefore=null;commit(b);}}
 for(const id of ['edPower','edColor','edExposure']){$(id).oninput=()=>adjustLight(false);$(id).onchange=()=>adjustLight(true);}
 for(const a of ['lx','ly','lz'])$('ed'+a).onchange=()=>adjustLight(true);
 toggle.onclick=()=>setActive(!active);$('edClose').onclick=()=>setActive(false);$('edSelect').onchange=()=>select($('edSelect').value);$('edMove').onclick=()=>controls.setMode('translate');$('edRotate').onclick=()=>controls.setMode('rotate');$('edCopy').onclick=copy;$('edDelete').onclick=remove;$('edDown').onclick=settle;$('edUndo').onclick=undo;$('edRedo').onclick=redo;$('edDefault').onclick=reset;
 $('edResetObject').onclick=()=>{if(!selected)return;const before=snapshot(),t=originals.get(selected.source||selected.id);selected.object.position.fromArray(t.position);selected.object.quaternion.fromArray(t.quaternion);selected.object.scale.fromArray(t.scale);commit(before)};
 $('edSave').onclick=save;$('edExport').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='我的海岛小家布局.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $('edImport').onclick=()=>$('edFile').click();$('edFile').onchange=async()=>{const f=$('edFile').files[0];if(!f)return;try{if(f.size>500000)throw Error('文件过大');const raw=await f.text(),data=validate(normalizeLayout(JSON.parse(raw),initial)),before=snapshot();localStorage.setItem(KEY+'-import-source',raw);restore(data);storageBlocked=false;commit(before,false);notify('布局已导入，可撤销')}catch(e){notify('未导入：'+e.message)}finally{$('edFile').value='';}};
 controls.addEventListener('dragging-changed',e=>{orbit.enabled=active&&!e.value});controls.addEventListener('mouseDown',()=>{gesture=snapshot()});controls.addEventListener('objectChange',()=>{if(!restoring)refresh()});controls.addEventListener('mouseUp',()=>{if(gesture){commit(gesture);gesture=null}});
 let down=null;renderer.domElement.addEventListener('pointerdown',e=>{if(active)down={x:e.clientX,y:e.clientY,axis:controls.axis}});
 renderer.domElement.addEventListener('pointerup',e=>{if(!active||!down)return;const start=down;down=null;if(start.axis||controls.axis||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;const r=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);for(const hit of ray.intersectObject(house.root,true)){if(hit.object.userData.runtimeContour)continue;let o=hit.object;while(o&&!o.userData.editorId)o=o.parent;if(o){select(o.userData.editorId);break;}}});
 addEventListener('keydown',e=>{if(!active||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo()}if(e.code==='Escape'){if(controls.dragging){controls.reset();return;}setActive(false)}});
 select('pillow_melody');try{const loaded=loadLayout(localStorage,initial,validate);if(loaded){restore(loaded.data);$('edStatus').textContent=loaded.source===KEY?'已载入本机布置':'已承接旧版布置，原存档保留。';}}catch(e){storageBlocked=true;$('edStatus').textContent='原布局未载入：'+e.message+'；已保护，不会自动覆盖。';}syncLight();controls.enabled=false;
 return {get active(){return active},setActive,select,copy,remove,settle,undo,redo,reset,snapshot,validate,restore,save,entries,storageKey:KEY,update(){orbit.update();if(selected)selectionBox.box.setFromObject(selected.object)},syncLight};
}

