import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {fields,defaults as baseDefaults,deform as baseDeform,sanitize} from './face-shape030.mjs';
const alternative=new URLSearchParams(location.search).get('head')==='sakurada',headOffset=alternative ? .128 : 0,defaults={...baseDefaults,...(alternative?{hair:'#c2aa7d',iris:'#82aab2'}:{})};
const $=id=>document.getElementById(id),key='cozy-character-face030'+(alternative?'-sakurada':''),host=$('viewport');let p={...defaults},compare=false,expression='neutral',strength=.65,dirty=false;
try{const saved=JSON.parse(localStorage.getItem(key));if(saved)p=sanitize(saved)}catch{}
function deform(x,y,z,p,h){const q=baseDeform(x,y-headOffset,z,p,h);q[1]+=headOffset;return q;}
function status(s){$('status').textContent=s;}
function fail(e){console.error(e);$('error').hidden=false;$('error').textContent='头部暂时无法加载，请重新打开。'+e.message;status('加载遇到问题');}
async function boot(){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.01,20);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.647,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=.43;controls.maxDistance=1.45;controls.minPolarAngle=.35;controls.maxPolarAngle=2.65;
 scene.add(new T.HemisphereLight(0xffffff,0xc6b4c9,1.0));const light=new T.DirectionalLight(0xfff5ed,1.3);light.position.set(-2,3,4);scene.add(light);const fill=new T.DirectionalLight(0xe8efff,.35);fill.position.set(3,1,1);scene.add(fill);
 const gltf=await new GLTFLoader().loadAsync(alternative?'./models/face-sakurada030.glb':'./models/face-base030.glb');const model=gltf.scene;model.rotation.y=Math.PI;model.position.y=-headOffset;scene.add(model);
 document.querySelectorAll('[data-head]').forEach(b=>b.setAttribute('aria-current',b.dataset.head===(alternative?'sakurada':'base')?'page':'false'));
 const gradient=new T.DataTexture(new Uint8Array([175,181,191,206,220,237,250,255]),8,1,T.RedFormat);gradient.minFilter=T.LinearFilter;gradient.magFilter=T.LinearFilter;gradient.needsUpdate=true;
 const data=[],seen=new Set(),faceMeshes=[],colorUniforms=[];
 model.traverse(o=>{if(!o.isMesh)return;const old=o.material,name=old.name,isHair=name.includes('_HAIR'),hair=isHair,iris=name.includes('EyeIris'),skin=name.includes('_SKIN'),mouth=name.includes('FaceMouth');
  const opts={name,map:old.map,side:old.side,transparent:old.transparent,alphaTest:old.alphaTest,depthWrite:old.depthWrite};const mat=isHair?new T.MeshToonMaterial({...opts,gradientMap:gradient}):new T.MeshBasicMaterial(opts);mat.color.copy(old.color);
  // Retain painted albedo detail, and tint by luminance without flattening it.
  if(isHair||iris||skin||mouth){const tint={value:new T.Color(isHair?p.hair:iris?p.iris:skin?'#ffe9df':'#aa8182')};colorUniforms.push({kind:isHair?'hair':iris?'iris':skin?'skin':'mouth',tint});
   mat.onBeforeCompile=shader=>{shader.uniforms.faceTint=tint;shader.fragmentShader='uniform vec3 faceTint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));\n'+(isHair?'diffuseColor.rgb=mix(faceTint*0.38,faceTint*2.1,clamp(lum*4.8,0.0,1.0));':iris?'diffuseColor.rgb=mix(faceTint*.14,faceTint*1.65,clamp(lum*1.7,0.0,1.0));':skin?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(lum),.48)*faceTint;':'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(lum),.65)*faceTint;'));};mat.customProgramCacheKey=()=>`face030-${isHair?'hair':iris?'iris':skin?'skin':'mouth'}`;
  }
  o.material=mat;const g=o.geometry;if(o.morphTargetInfluences)faceMeshes.push(o);
  if(!seen.has(g.attributes.position)){seen.add(g.attributes.position);data.push({hair,pos:g.attributes.position,original:g.attributes.position.array.slice(),normal:g.attributes.normal,origNormal:g.attributes.normal?.array.slice(),morph:g.morphAttributes.position||[],originalMorph:(g.morphAttributes.position||[]).map(a=>a.array.slice())});}
 });
 function shape(){const values=compare?{...defaults,...Object.fromEntries(fields.map(([k])=>[k,0])),hair:'#38323f',iris:'#5a65bd'}:p;
  const J=new T.Matrix3(),normal=new T.Vector3();
  for(const d of data){const src=d.original,dst=d.pos.array;for(let i=0;i<src.length;i+=3){const v=deform(src[i],src[i+1],src[i+2],values,d.hair);dst.set(v,i);
    // Deform each expression endpoint with the neutral face, preserving alignment.
    for(let m=0;m<d.morph.length;m++){const a=d.originalMorph[m],q=deform(src[i]+a[i],src[i+1]+a[i+1],src[i+2]+a[i+2],values,d.hair);for(let k=0;k<3;k++)d.morph[m].array[i+k]=q[k]-v[k];}
    if(d.normal){const n=d.origNormal,e=1e-4,A=deform(src[i]+e,src[i+1],src[i+2],values,d.hair),B=deform(src[i],src[i+1]+e,src[i+2],values,d.hair),C=deform(src[i],src[i+1],src[i+2]+e,values,d.hair);J.set((A[0]-v[0])/e,(B[0]-v[0])/e,(C[0]-v[0])/e,(A[1]-v[1])/e,(B[1]-v[1])/e,(C[1]-v[1])/e,(A[2]-v[2])/e,(B[2]-v[2])/e,(C[2]-v[2])/e).invert().transpose();normal.set(n[i],n[i+1],n[i+2]).applyMatrix3(J).normalize();d.normal.array.set(normal.toArray(),i);}
   }d.pos.needsUpdate=true;if(d.normal)d.normal.needsUpdate=true;d.morph.forEach(a=>a.needsUpdate=true);}
  // The old morph-normal basis does not survive reshaping. Position morphs remain;
  // smooth, deformed neutral normals are used in this expression proof of concept.
  model.traverse(o=>{if(o.isMesh){delete o.geometry.morphAttributes.normal;o.geometry.computeBoundingSphere();o.geometry.computeBoundingBox();}});
  for(const u of colorUniforms)if(u.kind==='hair'||u.kind==='iris')u.tint.value.set(values[u.kind]);
 }
 function save(){try{localStorage.setItem(key,JSON.stringify(p));status('捏脸已保存到此浏览器')}catch{status('浏览器未允许保存，请导出参数备份')}}
 function sync(){for(const [k] of fields){$(k).value=p[k];document.querySelector(`[data-output="${k}"]`).textContent=Math.round((p[k]-defaults[k])*1000)/1000;}for(const k of ['hair','iris'])$(k).value=p[k];}
 const presets={'原始基础':{},'柔和圆脸':{faceWidth:.10,jawWidth:.15,chinLength:-.010,eyeOpen:.10},'清冷长脸':{faceWidth:-.06,jawWidth:-.05,chinLength:.017,eyeOpen:-.48,eyeSlope:.002},'成熟宽颌':{faceWidth:.04,jawWidth:.18,chinLength:.006,eyeOpen:-.35,mouthWidth:.14,noseDepth:.003}};let beforePreset=null;
 for(const [label,params] of Object.entries(presets)){const b=document.createElement('button');b.textContent=label;b.dataset.facePreset=label;b.onclick=()=>{beforePreset={...p};p={...defaults,...params,hair:p.hair,iris:p.iris,hairLift:p.hairLift};compare=false;$('compare').setAttribute('aria-pressed','false');sync();shape();save();$('undoPreset').hidden=false;};$('facePresets').append(b);}
 $('undoPreset').onclick=()=>{if(beforePreset){p=beforePreset;beforePreset=null;compare=false;$('compare').setAttribute('aria-pressed','false');sync();shape();save();$('undoPreset').hidden=true;}};
 for(const [k,label,min,max,step] of fields){const row=document.createElement('label');row.className='field';row.innerHTML=`<span>${label}<output data-output="${k}"></output></span><input id="${k}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}">`;$('fields').append(row);$(k).oninput=()=>{p[k]=Number($(k).value);compare=false;$('compare').setAttribute('aria-pressed','false');dirty=true;sync();};$(k).onchange=save;}
 for(const k of ['hair','iris'])$(k).oninput=()=>{p[k]=$(k).value;compare=false;$('compare').setAttribute('aria-pressed','false');dirty=true;save();};
 const sourceExpressions=gltf.parser.json.extras.expressions;
 const expressionIndex=name=>sourceExpressions.find(e=>e.presetName===name)?.binds.find(b=>b.mesh===0)?.index;
 const blinkIndex=expressionIndex('blink'),aIndex=expressionIndex('a'),uIndex=expressionIndex('u');
 const expressions={neutral:['平静',null],smile:['微笑',expressionIndex('joy')],angry:['认真',expressionIndex('angry')],sad:['失落',expressionIndex('sorrow')],surprise:['惊讶',expressionIndex('unknown')],blink:['闭眼',blinkIndex]};
 for(const [k,[label]] of Object.entries(expressions)){const b=document.createElement('button');b.textContent=label;b.dataset.expression=k;b.setAttribute('aria-pressed',k===expression);b.onclick=()=>{expression=k;document.querySelectorAll('[data-expression]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.expression===k));};$('expressions').append(b);}
 $('strength').oninput=()=>strength=Number($('strength').value);
 const downloads=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 $('preset').onclick=()=>downloads(new Blob([JSON.stringify({format:'cozy-face030',version:1,head:alternative?'sakurada':'base',parameters:p},null,2)],{type:'application/json'}),'男主捏脸参数.json');
 $('import').onchange=async()=>{const f=$('import').files[0];if(!f)return;try{if(f.size>20000)throw Error('文件过大');const obj=JSON.parse(await f.text());if(obj.format!=='cozy-face030'||obj.version!==1)throw Error('请选择本页导出的参数文件');if((obj.head||'base')!==(alternative?'sakurada':'base'))throw Error('请先切换到此文件对应的头模');p=sanitize(obj.parameters);compare=false;$('compare').setAttribute('aria-pressed','false');sync();shape();save();}catch(e){status('导入失败：'+e.message)}$('import').value='';};
 $('snapshot').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(b=>b&&downloads(b,'男主头部样板.png'));};
 $('reset').onclick=()=>{beforePreset={...p};$('undoPreset').hidden=false;p={...defaults};compare=false;$('compare').setAttribute('aria-pressed','false');sync();shape();save();};
 $('compare').onclick=()=>{compare=!compare;$('compare').setAttribute('aria-pressed',compare);shape();status(compare?'正在查看未调整的基础脸':'正在查看你的捏脸结果');};
 function view(name){camera.position.set(...(name==='side'?[1.02,1.65,.01]:name==='three'?[.59,1.66,.88]:[0,1.647,1.08]));controls.target.set(0,1.647,0);controls.update();}
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(host);resize();view('front');sync();shape();
 const clock=new T.Clock(),weights=new Float32Array(faceMeshes[0].morphTargetInfluences.length),target=new Float32Array(faceMeshes[0].morphTargetInfluences.length);let blinkAt=2.5,lastT=0;
 function frame(){requestAnimationFrame(frame);if(document.hidden)return;const t=clock.getElapsedTime(),dt=Math.min(.1,t-lastT);lastT=t;if(dirty){dirty=false;shape();}if(t>blinkAt+.19)blinkAt=t+2.8+Math.random()*2;
  const blink=$('blink').checked&&t>blinkAt?Math.sin(Math.PI*(t-blinkAt)/.19):0;
  target.fill(0);const idx=expressions[expression][1];if(idx!==null)target[idx]=strength;
  if($('speaking').checked){target[aIndex]=Math.max(0,Math.sin(t*7))*.5;target[uIndex]=Math.max(0,Math.sin(t*7+2))*.24;}
  for(let i=0;i<weights.length;i++)weights[i]+=(target[i]-weights[i])*(1-Math.exp(-dt/0.09));
  for(const o of faceMeshes){for(let i=0;i<weights.length;i++)o.morphTargetInfluences[i]=weights[i];o.morphTargetInfluences[blinkIndex]=Math.max(weights[blinkIndex],blink);}
  controls.update();renderer.render(scene,camera);
 }frame();status('头部样板已就绪 · 可捏脸 / 测试表情');
 window.faceLab={model,gltf,renderer,scene,camera,controls,ready:true,shape,view,get parameters(){return {...p}},setParameters(v){p=sanitize(v);sync();shape();save();},getData:()=>data};
}
boot().catch(fail);
