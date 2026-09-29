import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export async function finishLivingRoom(house){
 const outdoor=new T.Group();outdoor.name='Window exterior ledges';house.root.add(outdoor);
 const landscape=new T.Group();landscape.name='Scenery removed';
 // A real window recess and outside ledge add near parallax in front of the distant painting.
 const stone=new T.MeshStandardMaterial({name:'Window sill porcelain',color:'#ece6db',roughness:.67});
 const glass=new T.MeshPhysicalMaterial({name:'Living window glass',color:'#e1edf0',roughness:.075,metalness:0,transparent:true,opacity:.085,depthWrite:false,side:T.FrontSide,envMapIntensity:.25,clearcoat:.18,clearcoatRoughness:.055});
 const panes=[];house.main.updateMatrixWorld(true);
 house.main.traverse(o=>{if(o.name==='Window'&&o.position.x>6.6&&o.position.x<14.6&&Math.abs(o.position.z)<.1){o.material=glass;o.castShadow=false;o.receiveShadow=false;panes.push(o);}});
 for(const x of [8.15,13.1]){
  const sill=new T.Mesh(new T.BoxGeometry(1.97,.07,.43),stone);sill.name='Living window deep sill';sill.position.set(x,.675,-.07);sill.castShadow=true;sill.receiveShadow=true;house.main.add(sill);
  const lip=new T.Mesh(new T.BoxGeometry(1.98,.035,.04),stone);lip.position.set(x,.68,-.295);outdoor.add(lip);
 }
 // Fine, low-contrast plank grain is local to the living room.
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d');
 let seed=701;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let row=0;row<8;row++){
  const tone=Math.round(rand()*7);ctx.fillStyle=`rgb(${213+tone},${186+tone},${151+tone})`;ctx.fillRect(0,row*64,1024,64);
  for(let j=0;j<32;j++){const y=row*64+rand()*64;ctx.strokeStyle=`rgba(111,82,53,${.016+rand()*.033})`;ctx.lineWidth=.5+rand()*.6;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(250,y+rand()*4,700,y-rand()*4,1024,y);ctx.stroke();}
  ctx.strokeStyle='rgba(118,91,61,.17)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,row*64);ctx.lineTo(1024,row*64);const split=120+rand()*780;ctx.moveTo(split,row*64);ctx.lineTo(split,(row+1)*64);ctx.stroke();
 }
 const grain=new T.CanvasTexture(canvas);grain.name='Living fine plank grain';grain.colorSpace=T.SRGBColorSpace;grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3.9,3.65);grain.anisotropy=8;
 const floor=new T.Mesh(new T.PlaneGeometry(7.84,7.24),new T.MeshStandardMaterial({name:'Living natural oak floor',map:grain,roughness:.77}));floor.rotation.x=-Math.PI/2;floor.position.set(10.6,.0015,3.7);floor.receiveShadow=true;floor.name='Living oak floor finish';house.main.add(floor);
 // One merged hull per furniture root. A translucent warm charcoal contour,
 // not wireframe; it does not draw triangulation or cross flat image surfaces.
 const hulls=[];
 const contourRoots=[...house.main.children];house.main.traverse(o=>{if(o.userData.editablePart&&o.parent!==house.main)contourRoots.push(o)});
 for(const root of contourRoots){
  if((!root.userData.sourceAsset&&!root.userData.editablePart)||['curtain_left','curtain_right','ceiling_fan','rug_detail','botanicals'].includes(root.userData.sourceAsset))continue;
  const geos=[];root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert();
  root.traverse(o=>{if(o.parent?.userData.mechanism018||!o.visible||!o.isMesh||Array.isArray(o.material)||o.material.transparent||/glass|paper|light|printed|leaves/i.test(o.material.name))return;
   for(let p=o.parent;p&&p!==root;p=p.parent)if(p.userData.editablePart)return;
   const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const name of Object.keys(g.attributes))if(!['position','normal'].includes(name))g.deleteAttribute(name);g.clearGroups();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,o.matrixWorld));geos.push(g);
  });
  if(!geos.length)continue;
  const m=new T.MeshBasicMaterial({name:'Fine charcoal contour',color:'#51473f',side:T.BackSide,transparent:true,opacity:.34,depthWrite:false});
  m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed += normal * 0.0011;');};m.customProgramCacheKey=()=> 'fine-contour-009';
  const g=mergeGeometries(geos);geos.forEach(g=>g.dispose());const hull=new T.Mesh(g,m);hull.name='Fine contour / '+root.name;hull.userData.runtimeContour=true;hull.renderOrder=1;root.add(hull);hulls.push(hull);
 }
 const oldReview=house.reviewMode;house.reviewMode=mode=>{oldReview(mode);outdoor.visible=mode==='walk'};
 house.livingFinish={outdoor,glass,panes,hulls,landscape,
  setMode(mode){},
  setContours(enabled){house.root.traverse(h=>{if(h.userData.runtimeContour)h.visible=enabled})},
  state:()=>({windows:panes.length,originalArt:'2x2 atlas mapped onto frames, spines and books',exterior:'mist glass without outdoor images',panorama:'removed',contourBatches:hulls.length,glass:'transparent physical material with room reflection probe; not ray tracing'})};
}

