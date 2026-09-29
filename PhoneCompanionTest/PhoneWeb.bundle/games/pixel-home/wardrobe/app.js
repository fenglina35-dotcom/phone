(async()=>{
const KEY='pixel-wardrobe:'+String(window.RoseWardrobeScope||new URLSearchParams(location.search).get('scope')||'unbound');
const blank=()=>({x:0,y:0,scale:100,width:100,height:100,rotation:0,gap:0});
function fresh(c){if(window.PixelWardrobeData?.approved)return structuredClone(window.PixelWardrobeData.approved);return {version:c.version,dress:c.outfits[c.outfits.length-1].dress,shoes:c.outfits[c.outfits.length-1].shoes,hair:c.hairs[7],face:'face2',accessory:c.outfits[c.outfits.length-1].accessory,adjustments:{},body:{size:100,legs:85,legWidth:100},motion:true};}
function contextKey(state,id){return id?.includes('accessory')||id==='retained-pink-headband'?id+'@'+state.hair:id;}
function validLook(s,c){return s?.version===c.version&&(!s.body||(Number.isFinite(s.body.size)&&s.body.size>=60&&s.body.size<=150&&Number.isFinite(s.body.legs)&&s.body.legs>=55&&s.body.legs<=110&&(s.body.legWidth===undefined||(Number.isFinite(s.body.legWidth)&&s.body.legWidth>=60&&s.body.legWidth<=140))))&&c.outfits.some(o=>o.dress===s.dress)&&c.outfits.some(o=>o.shoes===s.shoes)&&c.hairs.includes(s.hair)&&c.faces.includes(s.face)&&(!s.accessory||c.accessories.includes(s.accessory))&&s.adjustments&&typeof s.adjustments==='object'&&Object.values(s.adjustments).every(t=>t&&Object.entries(t).every(([k,v])=>['x','y','scale','width','height','rotation','gap'].includes(k)&&Number.isFinite(v)&&(k==='scale'||k==='width'||k==='height'?v>=20&&v<=250:Math.abs(v)<=1600)));}
function valid(s,c,nested=false){
 if(!validLook(s,c))return false;
 if(s.savedOutfits===undefined)return true;
 if(nested||!Array.isArray(s.savedOutfits)||s.savedOutfits.length>30)return false;
 const ids=new Set();return s.savedOutfits.every(p=>{if(!p||typeof p.id!=='string'||!/^set-[\w-]{1,80}$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>30||/[\u0000-\u001f]/.test(p.name)||!valid(p.look,c,true))return false;ids.add(p.id);return true;});
}

function getAdjust(s,id,part=''){return {...blank(),...s.adjustments[contextKey(s,id)+(part?'/'+part:'')]};}
function blink(t){const p=t%4300;return p<78?'half':p<173?'closed':p<248?'half':'open';}
async function loadCatalog(){return window.PixelHomeAssets.loadCatalog();}

function anchor(id){return id.startsWith('hair')?[512,100]:id.startsWith('face')?[512,283.5]:id.includes('shoes')?[512,1300]:id.includes('dress')?[512,650]:[512,180];}
function transform(g,v,a){g.translate(a[0]+v.x,a[1]+v.y);g.rotate(v.rotation*Math.PI/180);g.scale(v.scale*v.width/10000,v.scale*v.height/10000);g.translate(-a[0],-a[1]);}
function drawPiece(g,p,images,frame='open',adjust=blank(),frameAdjust=blank()){
 if(p.frames){const f=p.frames[frame]||p.frames.open;g.save();transform(g,adjust,[f.x,f.y]);drawPiece(g,f,images,frame,frameAdjust);g.restore();return;}
 g.save();transform(g,adjust,[p.x,p.y]);g.translate(p.x,p.y);g.rotate(p.rotation*Math.PI/180);g.scale(p.scale*p.width/100,p.scale*p.height/100);g.drawImage(images[p.file],-p.anchor[0],-p.anchor[1]);g.restore();
}
const bodyCache=new WeakMap();
function renderRaw(g,c,images,s,{frame='open',time=0,animate=false,only=null}={}){
 const ids=only?[only]:[s.shoes,s.dress,s.face,s.hair,s.accessory].filter(Boolean);
 const all=ids.flatMap(id=>c.items[id].pieces.map(p=>({id,p}))).sort((a,b)=>a.p.z-b.p.z);
 g.save();const leg=only?1:bodyParams(s).legs/100,legWidth=only?1:bodyParams(s).legWidth/100;const pose=animate&&s.motion?poseAt(time):0;const head=()=>{g.translate(512,364);g.rotate(pose*.018);g.translate(-512,-364);};
 const draw=({id,p},cover=false)=>{if((leg!==1||legWidth!==1)&&(id===s.shoes||p.id.toLowerCase().includes('legband'))){const layer=window.PixelHomeAssets.createCanvas(1024,1536),lg=layer.getContext('2d');lg.imageSmoothingEnabled=false;transform(lg,getAdjust(s,id),anchor(id));drawPiece(lg,cover?p.cover:p,images,frame,getAdjust(s,id,p.id));drawLegLayer(g,layer,leg,0,legWidth);return;}g.save();if(pose&&(id.startsWith('hair')||id.startsWith('face')||(id.includes('accessory')&&p.y<350)||id==='retained-pink-headband'))head();const a=getAdjust(s,id);transform(g,a,anchor(id));const pa=getAdjust(s,id,p.id);if(p.frames)pa.x+=(p.id.endsWith('-left')?-1:1)*a.gap/2;if(p.frames&&frame==='closed'){const ca=getAdjust(s,id,id+'-closed');transform(g,ca,anchor(id));pa.x+=(p.id.endsWith('-left')?-1:1)*ca.gap/2;}drawPiece(g,cover?p.cover:p,images,frame,pa,p.frames?getAdjust(s,id,p.id+'-'+frame):blank());g.restore();};
 for(const v of all.filter(v=>v.p.z<10))draw(v);
 if(!only){
  const key=JSON.stringify([s.dress,s.shoes,getAdjust(s,s.shoes),...c.items[s.shoes].pieces.map(p=>getAdjust(s,s.shoes,p.id))]);let cache=bodyCache.get(images);
  if(!cache||cache.key!==key){const b=c.items[s.dress].base,layer=window.PixelHomeAssets.createCanvas(1024,1536),bg=layer.getContext('2d');bg.imageSmoothingEnabled=false;drawPiece(bg,b,images);
   for(const p of c.items[s.shoes].pieces){if(!p.cover)continue;bg.save();bg.globalCompositeOperation='destination-out';transform(bg,getAdjust(s,s.shoes),anchor(s.shoes));drawPiece(bg,p.cover,images,frame,getAdjust(s,s.shoes,p.id));bg.restore();}
   cache={key,layer};bodyCache.set(images,cache);}
  if(pose){drawLegLayer(g,cache.layer,leg,368,legWidth);g.save();head();g.drawImage(cache.layer,0,0,1024,372,0,0,1024,372);g.restore();}else drawLegLayer(g,cache.layer,leg,0,legWidth);
 }
 for(const v of all.filter(v=>v.p.z>=10))draw(v);
 g.restore();
}

function migrate(s,c){if(!['wardrobe-p72-v1','wardrobe-p73-v1','wardrobe-p74-v1','wardrobe-p75-v1','wardrobe-p76-v1','wardrobe-p78-v1','wardrobe-p79-v1','wardrobe-p80-v1','wardrobe-p81-v1'].includes(s?.version))return null;const n=structuredClone(s);n.version=c.version;n.body={size:100,legs:85,legWidth:100,...n.body};if(n.dress==='outfit0-dress')n.dress=c.outfits[0].dress;if(n.shoes==='outfit0-shoes')n.shoes=c.outfits[0].shoes;if(n.accessory==='outfit0-accessory')n.accessory=null;n.adjustments=Object.fromEntries(Object.entries(n.adjustments||{}).filter(([k])=>!k.startsWith('outfit0-')));if(s.version==='wardrobe-p81-v1')for(const id of ['face-original','face2'])for(const part of [id+'-closed',id+'-left-closed',id+'-right-closed'])delete n.adjustments[id+'/'+part];return valid(n,c)?n:null;}

// Discrete, cached head poses: stable pixel contours between intentional keyframes.
function poseAt(t){const p=t%9800;return p<7000?0:p<7290?1:p<7850?2:p<8140?1:0;}
const spriteCache=new WeakMap();
function render(g,c,images,s,opts={}){
 if(opts.only){renderRaw(g,c,images,s,opts);return;}
 let cache=spriteCache.get(images);const {savedOutfits,...visibleState}=s;const key=JSON.stringify(visibleState);
 if(!cache||cache.key!==key){cache={key,frames:new Map()};spriteCache.set(images,cache);}
 const pose=opts.animate&&s.motion?poseAt(opts.time||0):0,breath=opts.animate&&s.motion?breathAt(opts.time||0):0,k=(opts.frame||'open')+':'+pose+':'+breath;
 if(!cache.frames.has(k)){const layer=window.PixelHomeAssets.createCanvas(1024,1536),ctx=layer.getContext('2d');ctx.imageSmoothingEnabled=false;renderRaw(ctx,c,images,s,opts);cache.frames.set(k,breath?breathLayer(layer,breath):layer);if(cache.frames.size>18)cache.frames.delete(cache.frames.keys().next().value);}
 const bp=bodyParams(s),size=bp.size/100;g.save();g.translate(512,1450);g.scale(size,size);g.translate(-512,-1450+legOffset(s));g.drawImage(cache.frames.get(k),0,0);g.restore();
}

const bodyParams=(s={})=>({size:100,legs:85,legWidth:100,...s.body});
const legOffset=s=>490*(1-bodyParams(s).legs/100);
// Each leg narrows around its own axis, with an ankle transition to intact shoes.
function legWidthAt(y,width){return 1+(width-1)*Math.max(0,Math.min(1,(1310-y)/60));}
function drawLegLayer(g,layer,k,start=0,width=1){
 g.drawImage(layer,0,start,1024,820-start,0,start,1024,820-start);
 let middle=layer;
 if(width!==1){middle=window.PixelHomeAssets.createCanvas(1024,1536);const m=middle.getContext('2d');m.imageSmoothingEnabled=false;
  for(let y=820;y<1310;y++){const w=legWidthAt(y,width);for(const [left,axis] of [[0,460],[512,562]])m.drawImage(layer,left,y,512,1,axis+(left-axis)*w,y,512*w,1);}
 }
 g.drawImage(middle,0,820,1024,490,0,820,1024,490*k);
 g.drawImage(layer,0,1310,1024,226,0,820+490*k,1024,226);
}

function breathAt(t){const seq=[0,0,1,2,3,4,3,2,1,0];return seq[Math.floor((t%4600)/460)];}
function breathLayer(layer,n){
 const out=window.PixelHomeAssets.createCanvas(1024,1536),g=out.getContext('2d');g.imageSmoothingEnabled=false;
 g.drawImage(layer,0,0,1024,374,0,0,1024,374);
 for(let y=374;y<810;y++){const u=(y-374)/436,w=Math.sin(Math.PI*u)**2,spread=Math.round(n*1.7*w),sy=Math.max(374,y-Math.round(n*.65*w));g.drawImage(layer,0,sy,1024,1,-spread,y,1024+spread*2,1);}
 g.drawImage(layer,0,810,1024,726,0,810,1024,726);return out;
}

const $=s=>document.querySelector(s),canvas=$('#scene'),ctx=canvas.getContext('2d');
let catalog,images,state,category='outfits',target='',part='',ready=false,zoom=false,coords={},history=[],edit=null,drag=null,last=0,reaction=0,noticeTimer,previewFrame='auto';
const categories={outfits:'套装',custom:'我的套装',dress:'裙装',shoes:'鞋袜',hairs:'发型',faces:'五官',accessories:'发饰'};
let previewScale=130;try{previewScale=Number(localStorage.getItem('rose-preview-scale'))||130;}catch{}
const fields={x:['横向位置',-500,500,.5],y:['上下位置',-600,600,.5],scale:['整体大小',20,250,1],width:['宽度',20,250,1],height:['高度',20,250,1],rotation:['旋转',-180,180,.5],gap:['眼睛间距',-80,80,.5]};
function notify(s){$('#notice').textContent=s;$('#notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),2200)}
function remember(){history.push(structuredClone(state));if(history.length>50)history.shift();$('#undo').disabled=false;}
function selectedIDs(){return [state.dress,state.shoes,state.hair,state.face,state.accessory].filter(Boolean)}
function adjustmentKey(){return contextKey(state,target)+(part?'/'+part:'')}
function change(k,v){const value=Math.max(fields[k][1],Math.min(fields[k][2],Number(v)));if(!Number.isFinite(value))return;state.adjustments[adjustmentKey()]={...getAdjust(state,target,part),[k]:value};syncSliders();}
function syncSliders(){if(!target)return;const v=getAdjust(state,target,part);for(const k in fields){$('#'+k).value=v[k];$('#'+k+'-number').value=v[k];$('#'+k+'-label').hidden=k==='gap'&&(!target.startsWith('face')||(!!part&&part!==target+'-closed'))}$('#undo').disabled=!history.length;}
for(const[k,[name,min,max,step]]of Object.entries(fields)){
 $('#sliders').insertAdjacentHTML('beforeend',`<label id="${k}-label">${name}<input type="number" id="${k}-number" aria-label="${name}数值" min="${min}" max="${max}" step="${step}"><input type="range" id="${k}" aria-label="${name}" min="${min}" max="${max}" step="${step}"></label>`);
 for(const suffix of['','-number']){$('#'+k+suffix).oninput=e=>{if(!ready)return;if(edit!==k){remember();edit=k;}change(k,e.target.value)};$('#'+k+suffix).onchange=()=>edit=null;}
}
function partName(p){if(p.name)return p.name;const id=p.id;for(const[key,name]of[['bowLeft','左蝴蝶结'],['bowRight','右蝴蝶结'],['clipStar','星星发卡'],['clipBook','小发卡'],['arms-front','手臂'],['headband','发箍'],['choker','项圈'],['legband','腿环'],['wristLeft','左手环'],['wristRight','右手环'],['left','左鞋袜'],['right','右鞋袜'],['blush','腮红'],['static','眉毛鼻嘴'],['dress','衣裙'],['bow','蝴蝶结'],['clip','发卡']])if(id.includes(key))return name;return '局部';}
function syncBody(){const bp=bodyParams(state);for(const k of ['size','legs','legWidth']){$('#body-'+k).value=bp[k];$('#body-'+k+'-value').textContent=bp[k]+'%';}if(ready)resize();}
function targets(){syncBody();const ids=selectedIDs();if(!ids.includes(target)){target=state.hair;part=''}$('#target').replaceChildren(...ids.map(id=>new Option(catalog.items[id].name,id)));$('#target').value=target;parts();}
function parts(){const item=catalog.items[target];const ps=target.startsWith('hair')?[]:[...item.pieces];if(target.startsWith('face'))ps.push({id:target+'-closed',name:'闭眼（双眼）'},{id:target+'-left-closed',name:'闭眼（左眼）'},{id:target+'-right-closed',name:'闭眼（右眼）'});$('#part').replaceChildren(new Option('整体',''),...ps.map(p=>new Option(partName(p),p.id)));if(!ps.some(p=>p.id===part))part='';$('#part').value=part;syncSliders();}
$('#target').onchange=e=>{target=e.target.value;part='';parts()};$('#part').onchange=e=>{part=e.target.value;if(part.endsWith('-closed')){previewFrame='closed';$('#frame-preview').value='closed';}syncSliders()};
function choose(id){if(!ready)return;remember();if(category==='outfits'){const o=catalog.outfits.find(x=>x.id===id);Object.assign(state,{dress:o.dress,shoes:o.shoes,accessory:o.accessory});target=state.dress;}
 else{const key={hairs:'hair',faces:'face',accessories:'accessory'}[category]||category;state[key]=id;target=id||state.hair;}part=category==='faces'&&previewFrame==='closed'?target+'-closed':'';targets();rack();}
function active(id){if(category==='outfits')return catalog.outfits.some(o=>o.id===id&&o.dress===state.dress&&o.shoes===state.shoes&&o.accessory===state.accessory);return selectedIDs().includes(id)||(!id&&!state.accessory)}
function thumb(c,id){const g=c.getContext('2d');c.width=180;c.height=160;g.imageSmoothingEnabled=false;if(!id){g.fillStyle='#bb9190';g.font='35px serif';g.textAlign='center';g.fillText('—',90,90);return;}
 const s=structuredClone(state);let only=id;const o=catalog.outfits.find(x=>x.id===id);let crop;
 if(o){Object.assign(s,{dress:o.dress,shoes:o.shoes,accessory:o.accessory,hair:catalog.hairs[0],face:catalog.faces[2]});only=null;crop=[245,70,540,1400];}
 else crop=id.startsWith('hair')?[240,70,550,680]:id.startsWith('face')?[405,220,215,150]:id.includes('shoes')?[345,990,335,490]:id.includes('dress')?[235,355,555,660]:[340,60,350,290];
 const z=Math.min(174/crop[2],150/crop[3]);g.translate((180-z*crop[2])/2-crop[0]*z,(160-z*crop[3])/2-crop[1]*z);g.scale(z,z);render(g,catalog,images,s,{only});}
function rack(){document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));if(category==='custom'){customRack();return;}const list=category==='outfits'?catalog.outfits:category==='dress'||category==='shoes'?catalog.outfits.map(o=>catalog.items[o[category]]):catalog[category].map(id=>catalog.items[id]);$('#rack').replaceChildren();if(category==='accessories')list.unshift({id:null,name:'不戴发饰'});for(const it of list){const b=document.createElement('button');b.className='card';b.setAttribute('aria-pressed',String(active(it.id)));b.setAttribute('aria-label',it.name);const c=document.createElement('canvas');c.setAttribute('aria-hidden','true');thumb(c,it.id);const label=document.createElement('span');label.textContent=it.name;b.append(c,label);b.onclick=()=>choose(it.id);$('#rack').append(b);}document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));}
for(const[k,name]of Object.entries(categories)){const b=document.createElement('button');b.textContent=name;b.dataset.category=k;b.onclick=()=>{if(!ready)return;category=k;rack();};$('#tabs').append(b);}
function resize(){const stage=$('#stage');canvas.style.height=Math.round(stage.clientHeight*(zoom?1:previewScale/100))+'px';canvas.classList.toggle('editing',$('#adjust').open);const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);const bp=bodyParams(state),top=Math.min(45,1450+(45+legOffset(state)-1450)*bp.size/100-30);const crop=zoom?[210,top,610,740]:[210,top,610,1490-top];const z=Math.min(r.width/crop[2],(r.height-20)/crop[3]);coords={d,z,x:(r.width-z*crop[2])/2-crop[0]*z,y:(r.height-20-z*crop[3])/2-crop[1]*z};}
function paint(t=performance.now()){if(!ready)return;ctx.setTransform(coords.d,0,0,coords.d,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.translate(coords.x,coords.y);ctx.scale(coords.z,coords.z);ctx.imageSmoothingEnabled=false;const paused=$('#adjust').open||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const frame=previewFrame!=='auto'?previewFrame:reaction>t?'closed':state.motion?blink(t+600):'open';render(ctx,catalog,images,state,{time:t,frame,animate:!paused&&previewFrame==='auto'});canvas.dataset.frame=frame;
 if(reaction>t){ctx.fillStyle='#c8798c';ctx.font='30px Georgia';ctx.fillText('♡',680,230-(800-reaction+t)*.05);}}
function tick(t){if(t-last>32&&!document.hidden){paint(t);last=t;}requestAnimationFrame(tick)}
function point(e){const r=canvas.getBoundingClientRect(),bp=bodyParams(state),size=bp.size/100,k=bp.legs/100;let x=512+((e.clientX-r.left-coords.x)/coords.z-512)/size;let y=1450+((e.clientY-r.top-coords.y)/coords.z-1450)/size-490*(1-k);if(target===state.shoes||part.toLowerCase().includes('legband')){const end=820+490*k;if(y>end)y+=490*(1-k);else if(y>820)y=820+(y-820)/k;if(y>820&&y<1310){const axis=x<512?460:562;x=axis+(x-axis)/legWidthAt(y,bp.legWidth/100);}}return{x,y}}
canvas.onpointerdown=e=>{if(!ready||e.button>0)return;if(!$('#adjust').open){reaction=performance.now()+800;return;}remember();drag={id:e.pointerId,start:point(e),v:getAdjust(state,target,part),key:adjustmentKey()};canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(drag?.id!==e.pointerId)return;const p=point(e);state.adjustments[drag.key]={...drag.v,x:Math.max(-500,Math.min(500,Math.round((drag.v.x+p.x-drag.start.x)*2)/2)),y:Math.max(-600,Math.min(600,Math.round((drag.v.y+p.y-drag.start.y)*2)/2))};syncSliders()};
function end(e,cancel=false){if(drag?.id!==e.pointerId)return;if(cancel){state.adjustments[drag.key]=drag.v;history.pop();}drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);syncSliders()}
canvas.onpointerup=e=>end(e);canvas.onpointercancel=e=>end(e,true);canvas.onlostpointercapture=e=>end(e,true);
function save(){if(!ready)return false;try{localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new Event('wardrobe-saved'));parent.postMessage({type:'pixel-wardrobe-saved'},location.protocol==='file:'?'*':location.origin);notify('已保存');return true}catch{notify('保存失败，请导出配置备份');return false}}
$('#save').onclick=$('#save-params').onclick=save;
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
$('#export').onclick=()=>{save();download(new Blob([JSON.stringify({schema:'rose-wardrobe',version:1,savedAt:new Date().toISOString(),state,sourceParameters:catalog.sources,assetHashes:catalog.files},null,2)],{type:'application/json'}),'我的衣柜-配置-v1205.json')};
$('#import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5e6)throw Error();const d=JSON.parse(await f.text());if(d.schema!=='rose-wardrobe'||!valid(d.state,catalog)||![catalog.files,...(catalog.compatibleAssetHashes||[])].some(h=>JSON.stringify(d.assetHashes)===JSON.stringify(h)))throw Error();remember();state={...d.state,savedOutfits:d.state.savedOutfits??state.savedOutfits??[]};targets();rack();save()}catch{notify('配置不匹配，原搭配已保留')}e.target.value=''};
$('#undo').onclick=()=>{if(history.length){state=history.pop();targets();rack();}};$('#reset').onclick=()=>{remember();delete state.adjustments[adjustmentKey()];syncSliders()};
function setPreview(v){previewScale=Math.max(85,Math.min(200,v));$('#preview-scale').value=previewScale;$('#preview-value').textContent=previewScale+'%';try{localStorage.setItem('rose-preview-scale',previewScale);}catch{}resize();paint();}
$('#preview-scale').oninput=e=>setPreview(Number(e.target.value));$('#bigger').onclick=()=>setPreview(previewScale+10);$('#smaller').onclick=()=>setPreview(previewScale-10);$('#adjust').ontoggle=()=>resize();
$('#motion').onclick=()=>{state.motion=!state.motion;$('#motion').setAttribute('aria-pressed',String(state.motion));};$('#view').onclick=()=>{zoom=!zoom;$('#view').textContent=zoom?'查看全身':'放大细节';resize();paint()};
$('#photo').onclick=()=>{const c=document.createElement('canvas');c.width=1024;c.height=1536;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#eee2d0';g.fillRect(0,0,1024,1536);render(g,catalog,images,state);c.toBlob(b=>download(b,'我的穿搭.png'))};
new ResizeObserver(()=>{resize();paint()}).observe($('#stage'));

// Each saved set is a detached look, never a recursive copy of the library.
function setLook(){const ids=selectedIDs();return{version:state.version,dress:state.dress,shoes:state.shoes,hair:state.hair,face:state.face,accessory:state.accessory,motion:state.motion,body:structuredClone(bodyParams(state)),adjustments:structuredClone(Object.fromEntries(Object.entries(state.adjustments).filter(([k])=>ids.some(id=>k===id||k.startsWith(id+'/')||k.startsWith(id+'@'))))) };}
function saveMutation(next,message){const before=state;state=next;if(!save()){state=before;return false;}history=[];targets();rack();$('#motion').setAttribute('aria-pressed',String(state.motion));notify(message);return true;}
function wearSet(p){const ids=[p.look.dress,p.look.shoes,p.look.hair,p.look.face,p.look.accessory].filter(Boolean);const keep=Object.fromEntries(Object.entries(state.adjustments).filter(([k])=>!ids.some(id=>k===id||k.startsWith(id+'/')||k.startsWith(id+'@'))));saveMutation({...state,...structuredClone(p.look),adjustments:{...keep,...structuredClone(p.look.adjustments)},savedOutfits:state.savedOutfits},'已穿上「'+p.name+'」');}
let setAction=null;
function setDialog(mode,p){if(!ready)return;if(mode==='new'&&(state.savedOutfits||[]).length>=30){notify('最多保存30套，请先整理已有套装');return;}setAction={mode,id:p?.id};$('#set-dialog-title').textContent={new:'保存自定义套装',rename:'修改套装名称',update:'更新这套搭配',delete:'删除这套搭配'}[mode];$('#set-name-row').hidden=['update','delete'].includes(mode);$('#set-name').value=p?.name||'';$('#set-name').required=!$('#set-name-row').hidden;$('#set-message').textContent=mode==='update'?'用当前穿搭和调整参数替换「'+p.name+'」。':mode==='delete'?'删除「'+p.name+'」？当前穿搭仍会保留。':'保存衣服、鞋袜、发型、五官、发饰和当前调整参数。';$('#set-confirm').textContent={new:'保存套装',rename:'保存名称',update:'确认更新',delete:'确认删除'}[mode];$('#set-dialog').showModal();if(!$('#set-name-row').hidden)$('#set-name').focus();}
$('#save-custom').onclick=()=>setDialog('new');$('#set-cancel').onclick=()=>$('#set-dialog').close();
$('#set-form').onsubmit=e=>{e.preventDefault();if(!setAction)return;const {mode,id}=setAction;const name=$('#set-name').value.trim();if(['new','rename'].includes(mode)&&(!name||name.length>30||/[\u0000-\u001f]/.test(name))){notify('请输入1至30字的套装名称');return;}let entries=structuredClone(state.savedOutfits||[]);if(mode==='new')entries.push({id:'set-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),name,look:setLook()});else{const p=entries.find(x=>x.id===id);if(!p)return;if(mode==='rename')p.name=name;if(mode==='update')p.look=setLook();if(mode==='delete')entries=entries.filter(x=>x.id!==id);}
 const beforeCategory=category;category='custom';if(saveMutation({...state,savedOutfits:entries},mode==='delete'?'套装已删除':'套装已保存')){$('#set-dialog').close();}else category=beforeCategory;
};
function customRack(){const rack=$('#rack');rack.replaceChildren();const list=state.savedOutfits||[];if(!list.length){const empty=document.createElement('p');empty.className='empty-sets';empty.textContent='搭配好后，点击「存为套装」，就能在这里一键换装。';rack.append(empty);return;}
 for(const p of list){const card=document.createElement('article');card.className='saved-set';const wear=document.createElement('button');wear.className='card';wear.setAttribute('aria-label','穿上 '+p.name);const c=document.createElement('canvas');c.width=160;c.height=200;c.setAttribute('aria-hidden','true');const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.translate(80,2);g.scale(.125,.125);g.translate(-512,0);render(g,catalog,images,{...p.look,body:{...p.look.body,size:100}});const label=document.createElement('span');label.textContent=p.name;wear.append(c,label);wear.onclick=()=>wearSet(p);const actions=document.createElement('div');actions.className='set-actions';for(const [mode,text]of [['rename','改名'],['update','更新'],['delete','删除']]){const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',text+' '+p.name);b.onclick=()=>setDialog(mode,p);actions.append(b);}card.append(wear,actions);rack.append(card);}
}

try{({catalog,images}=await loadCatalog());state=fresh(catalog);try{const saved=JSON.parse(localStorage.getItem(KEY));if(valid(saved,catalog))state=saved;}catch{}const fit=new URLSearchParams(location.search).get('edit')==='closed';if(fit){category='faces';target=state.face;part=target+'-closed';previewFrame='closed';zoom=true;$('#frame-preview').value='closed';$('#view').textContent='查看全身';$('#adjust').open=true;}else target=state.hair;ready=true;$('#counts').textContent=`${catalog.outfits.length} 套服装 · ${catalog.hairs.length} 款发型 · ${catalog.faces.length} 套五官`;$('#loading').hidden=true;$('#motion').setAttribute('aria-pressed',String(state.motion));targets();rack();setPreview(previewScale);resize();paint();requestAnimationFrame(tick);window.wardrobe={catalog,getState:()=>structuredClone(state),render:(g,s,opts)=>render(g,catalog,images,s,opts)};}catch(e){ready=false;$('#loading').hidden=false;window.PixelHomeAssets.showFailure($('#loading'),e);console.error(e)}

for(const k of ['size','legs','legWidth'])$('#body-'+k).oninput=e=>{if(!ready)return;if(edit!=='body-'+k){remember();edit='body-'+k;}state.body={...bodyParams(state),[k]:Number(e.target.value)};syncBody();};for(const k of ['size','legs','legWidth'])$('#body-'+k).onchange=()=>edit=null;

$('#frame-preview').onchange=e=>{previewFrame=e.target.value;paint();};

document.querySelector('.home').onclick=e=>{e.preventDefault();if(!save())return;parent.postMessage({type:'pixel-wardrobe-close'},location.protocol==='file:'?'*':location.origin);};

})();