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
