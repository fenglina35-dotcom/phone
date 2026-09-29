import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const FLOOR=-3.15;
export const basementPlan={version:2,cell:[17.55,9.55,4.10,2.55],table:[17.95,14.95,3.20,.95],seat:[19.55,16.45],gate:[20.10,12.10,1.12],chairFacing:[0,-1]};
export async function finishBasement(house,world){
 const root=new T.Group();root.name='Basement craft studio 002';root.position.y=FLOOR;house.basement.add(root);
 const fixtures=new T.Group();fixtures.name='Workshop joinery and leather tools';root.add(fixtures);
 const cell=new T.Group();cell.name='Enclosed plush room';root.add(cell);
 const toys=new T.Group();toys.name='Reused enlarged plush collection';cell.add(toys);
 const mat=(name,color,roughness=.82,metalness=0)=>new T.MeshStandardMaterial({name,color,roughness,metalness});
 const wall=mat('Warm plaster','#d6caba'),wood=mat('Honey oak workshop','#a88761'),edge=mat('Oak end grain','#b99a72'),dark=mat('Warm thin joinery shadows','#665242'),iron=mat('Soft charcoal iron','#485150',.54,.55),brass=mat('Brushed brass','#b6a17a',.45,.6),cream=mat('Linen upholstery','#d9cfb9'),sage=mat('Sage work mat','#8b9b8a'),leather=mat('Blush vegetable tanned leather','#b77771'),tan=mat('Natural leather','#b78b5b'),paper=mat('Ivory paper','#eee3ce'),blue=mat('Dusky teal leather','#668f93'),wax=mat('Beeswax candle','#e0c9a1');
 const mesh=(parent,name,geo,m,pos)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const box=(p,n,x,y,z,w,h,d,m,r=.015)=>mesh(p,n,new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3)),m,[x,y,z]);
 const ball=(p,n,x,y,z,s,m,scale=[1,1,1])=>{const o=mesh(p,n,new T.SphereGeometry(s,24,16),m,[x,y,z]);o.scale.set(...scale);return o;};
 const cyl=(p,n,x,y,z,rt,rb,h,m)=>mesh(p,n,new T.CylinderGeometry(rt,rb,h,24),m,[x,y,z]);
 const tube=(p,n,points,r,m,closed=false)=>mesh(p,n,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)),closed),Math.max(16,points.length*8),r,6,closed),m,[0,0,0]);
 const rod=(p,n,a,b,r,m)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),o=mesh(p,n,new T.CylinderGeometry(r,r,va.distanceTo(vb),12),m,va.clone().add(vb).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return o;};
 function grain(){const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#ddc9aa';ctx.fillRect(0,0,512,256);let seed=123;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let j=0;j<280;j++){const y=rnd()*256;ctx.strokeStyle=`rgba(92,65,38,${.02+rnd()*.05})`;ctx.lineWidth=.4+rnd();ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(180,y+6,320,y-5,512,y+2);ctx.stroke();}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;}wood.map=grain();edge.map=wood.map;
 // Old objects and colliders must both disappear; the original stair core stays intact.
 for(const id of ['workbench','tools','leather']){house.assets.get(id)?.removeFromParent();house.assets.delete(id);}
 world.colliders=world.colliders.filter(c=>!['workbench','work_chair','tools','leather'].includes(c.id));
 const existingFloor=house.main.getObjectByName('Living oak floor finish');
 if(existingFloor){const m=existingFloor.material.clone();if(m.map){m.map=m.map.clone();m.map.repeat.set(7.04/2.01,8.24/1.98);}const f=mesh(root,'Basement matching oak floor',new T.PlaneGeometry(7.04,8.24),m,[18.2,.002,13.6]);f.rotation.x=-Math.PI/2;f.castShadow=false;}
 const addCollider=(id,x,z,w,d,height=1)=>world.colliders.push({id,x,z,w,d,base:FLOOR,height,kind:'basement'});
 const wallParts=[];
 for(const [n,x,z,w,d] of [['Cell back',19.6,9.57,4.1,.12],['Cell left',17.56,10.85,.12,2.55],['Cell right',21.64,10.85,.12,2.55]]){
  const o=box(cell,n,x,1.30,z,w,2.60,d,wall,.008);wallParts.push(o);house.wallMeshes.push({mesh:o,base:FLOOR,height:2.6});
  // reviewMode expects absolute-y meshes. Attach walls to world-identity basement.
  house.basement.attach(o);addCollider(n,x-w/2,z-d/2,w,d,2.6);
  box(fixtures,n+' skirting',x,.08,z,w+.025,.12,d+.025,edge,.005);
 }
 const roof=box(cell,'Solid cell ceiling',19.6,2.65,10.85,4.18,.10,2.68,wall,.01);house.roofs.push(roof);
 house.roofs.push(box(cell,'Cell front lintel',19.6,2.53,12.10,4.16,.17,.10,wall,.008));
 for(const [x,z,w,d] of [[19.6,9.42,4.4,.16],[21.76,13.6,.16,8.4],[18.2,17.76,7.2,.16],[14.64,16,.16,3.6]])house.roofs.push(box(root,'Ceiling perimeter frieze',x,2.94,z,w,.23,d,wall,.008));
 // The front is a real bar wall. The 1.12m gate swings inward, never across the aisle.
 const rail=(p,x,z,width)=>{for(const y of [.10,2.38])box(p,'Iron horizontal frame',x,y,z,width,.065,.065,iron,.012);for(let a=-width/2+.09;a<width/2-.04;a+=.155)rod(p,'Round iron bar',[x+a,.13,z],[x+a,2.36,z],.013,iron);};
 rail(cell,18.85,12.10,2.50);rail(cell,21.435,12.10,.43);
 for(const x of [17.60,20.10,21.22,21.65])box(cell,'Barred frame upright',x,1.24,12.10,.055,2.48,.07,iron,.009);
 addCollider('cell fixed grille',17.55,12.065,2.55,.07,2.48);addCollider('cell fixed grille east',21.22,12.065,.46,.07,2.48);
 const hinge=new T.Group();hinge.name='Inward opening iron gate';hinge.position.set(20.10,0,12.10);cell.add(hinge);rail(hinge,.56,0,1.06);
 for(const x of [.03,1.09])box(hinge,'Gate stile',x,1.24,0,.05,2.48,.065,iron,.009);
 for(const y of [.35,1.2,2.05])cyl(hinge,'Gate hinge',0,y,0,.034,.034,.11,brass);
 box(hinge,'Latch plate',1.0,1.08,-.008,.12,.20,.025,iron,.015);
 tube(hinge,'Gate pull handle',[[1,1.03,.025],[1,1.04,.08],[1,1.17,.08],[1,1.18,.025]],.013,brass);
 const doorCollider={id:'cell gate',x:20.10,z:12.055,w:1.12,d:.09,base:FLOOR,height:2.48,kind:'basement'};world.colliders.push(doorCollider);
 let open=false;
 function toggleGate(player){
  // Conservatively reserve the whole inward sweep while toggling, including body radius.
  const a=player.x,b=player.z;if(player.y<-2.5&&a>19.83&&a<21.48&&b>10.70&&b<12.08)return {changed:false,message:'请站到门外，给铁门向内打开留出空间'};
  open=!open;hinge.rotation.y=open?Math.PI/2:0;
  syncGateCollider();return {changed:true,message:open?'铁门已向内打开':'铁门已关闭'};
 }
 function syncGateCollider(){const current=world.colliders.find(c=>c.id==='cell gate');if(current)Object.assign(current,open?{x:20.055,z:10.98,w:.09,d:1.12}:{x:20.10,z:12.055,w:1.12,d:.09});}
 // A thick continuous rug surface plus short bent fibres; no floating layered disks.
 const pileMat=mat('Rose oatmeal plush pile','#c6aaa0',1);const fibreMat=mat('Short soft rug fibres','#ccb3a8',1);
 const rug=mesh(cell,'Thick rounded plush rug',new T.SphereGeometry(1,128,48),pileMat,[19.61,.030,10.88]);rug.scale.set(1.82,.05,1.03);
 const fibrePositions=[],fibreColors=[];let seed=901;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<60000;i++){const a=rnd()*Math.PI*2,rr=Math.sqrt(rnd())*.993,x=Math.cos(a)*rr*1.82,z=Math.sin(a)*rr*1.03,y=.03+.05*Math.sqrt(1-rr*rr),h=.008+rnd()*.016,w=.0015+rnd()*.0015,angle=rnd()*Math.PI*2,dx=Math.cos(angle)*w,dz=Math.sin(angle)*w,lean=(rnd()-.5)*.01;const xx=19.61+x,zz=10.88+z;fibrePositions.push(xx-dx,y,zz-dz,xx+dx,y,zz+dz,xx+Math.sin(angle)*lean,y+h,zz+Math.cos(angle)*lean);const shade=.91+rnd()*.09;for(let j=0;j<3;j++)fibreColors.push(shade,shade,shade);}
 const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(fibrePositions,3));fg.setAttribute('color',new T.Float32BufferAttribute(fibreColors,3));fg.computeVertexNormals();fibreMat.vertexColors=true;fibreMat.side=T.DoubleSide;fibreMat.emissive.set('#b49a90');fibreMat.emissiveIntensity=.24;const fibres=mesh(cell,'60000 short soft pile fibres',fg,fibreMat,[0,0,0]);fibres.castShadow=false;
 const fuzzCanvas=document.createElement('canvas');fuzzCanvas.width=fuzzCanvas.height=256;const fq=fuzzCanvas.getContext('2d');fq.fillStyle='#b6aaa3';fq.fillRect(0,0,256,256);for(let i=0;i<10000;i++){const x=rnd()*256,y=rnd()*256;fq.strokeStyle=i%2?'#c7bdb7':'#a99d96';fq.globalAlpha=.25;fq.lineWidth=.5;fq.beginPath();fq.moveTo(x,y);fq.quadraticCurveTo(x+2,y-1,x+2,y-3);fq.stroke();}const fuzz=new T.CanvasTexture(fuzzCanvas);fuzz.wrapS=fuzz.wrapT=T.RepeatWrapping;fuzz.repeat.set(9,5);fuzz.anisotropy=4;pileMat.bumpMap=fuzz;pileMat.bumpScale=.004;
 // Low-opacity contact shading follows the actual rug surface, beneath the pile.
 const sc=document.createElement('canvas');sc.width=sc.height=128;const sq=sc.getContext('2d'),grad=sq.createRadialGradient(64,64,8,64,64,64);grad.addColorStop(0,'rgba(59,42,38,.35)');grad.addColorStop(.45,'rgba(59,42,38,.18)');grad.addColorStop(1,'rgba(59,42,38,0)');sq.fillStyle=grad;sq.fillRect(0,0,128,128);const shadowTex=new T.CanvasTexture(sc);
 for(const [x,z,rx,rz] of [[18.43,10.35,.43,.34],[18.89,11.41,.30,.24],[19.51,10.27,.26,.24]]){const geo=new T.PlaneGeometry(rx*2,rz*2,16,16),a=geo.attributes.position;for(let i=0;i<a.count;i++){const wx=x+a.getX(i),wz=z-a.getY(i),r2=((wx-19.61)/1.82)**2+((wz-10.88)/1.03)**2;a.setXYZ(i,wx,.0308+.05*Math.sqrt(Math.max(0,1-r2)),wz);}geo.computeVertexNormals();const m=new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,side:T.DoubleSide});const o=mesh(cell,'Plush contact shadow on rug',geo,m,[0,0,0]);o.castShadow=false;}
 const load=async(file,height,name,x,z,angle)=>{const raw=(await new GLTFLoader().loadAsync(file)).scene;raw.updateMatrixWorld(true);const b=new T.Box3().setFromObject(raw),sz=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3()),s=height/sz.y;raw.scale.multiplyScalar(s);raw.position.set(-c.x*s,-b.min.y*s,-c.z*s);raw.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){m.roughness=.94;m.metalness=0;if(m.map)m.map.anisotropy=4;}}});const g=new T.Group();g.name=name;g.position.set(x,.078,z);g.rotation.y=angle;g.add(raw);g.userData={source:file,height,static:true,support:'rug surface at 0.078 m'};toys.add(g);return g;};
 const teddy=await load('./models/teddy-ai-v001.glb',.96,'Large reused teddy',18.43,10.29,.10);teddy.position.y=.048;
 const melody=await load('./models/my-melody-game-v001.glb',.81,'Reused My Melody plush',19.51,10.25,-.12);melody.position.y=.065;
 const smaller=teddy.clone(true);smaller.name='Smaller reused teddy';smaller.scale.setScalar(.69);smaller.position.set(18.89,.065,11.38);smaller.rotation.y=-.32;smaller.userData={...teddy.userData,height:.6624};toys.add(smaller);
 // Gate sweep x20.1..21.22,z10.98..12.1 remains completely free of toys.
 for(const [id,x,z,w,d,h] of [['large teddy',18.05,9.93,.77,.65,.99],['melody plush',19.12,9.97,.78,.6,.84],['small teddy',18.6,11.12,.55,.5,.70]])addCollider(id,x,z,w,d,h);
 const yarn=mat('Lavender twisted wool','#9b91ae',1);ball(cell,'Single small yarn ball',19.48,.182,11.63,.109,yarn);for(let i=0;i<25;i++){const pts=[];for(let j=0;j<=36;j++){const a=j/36*Math.PI*2,b=i*.44;pts.push([19.48+.11*Math.cos(a)*Math.cos(b),.182+.11*Math.sin(a),11.63+.11*Math.cos(a)*Math.sin(b)]);}tube(cell,'Wound wool strand',pts,.0028,yarn);}
 tube(cell,'Loose resting yarn end',[[19.48,.075,11.7],[19.59,.069,11.76],[19.7,.06,11.75],[19.77,.045,11.84]],.003,yarn);
 // Freestanding joinery, facing the cell. North edge is kept free of tall equipment.
 const desk=new T.Group();desk.name='Freestanding leathercraft bench';fixtures.add(desk);house.assets.set('workbench',desk);
 box(desk,'Solid rounded oak top',19.55,.8475,15.425,3.2,.085,.95,edge,.032);
 for(const x of [18.08,21.02])for(const z of [15.07,15.78]){box(desk,'Tapered oak leg',x,.39,z,.115,.78,.115,wood,.016);box(desk,'Leg ferrule',x,.045,z,.12,.06,.12,brass,.009);}
 for(const z of [15.06,15.80])box(desk,'Table apron',19.55,.69,z,2.94,.20,.075,wood);
 for(const x of [18.10,21.00])box(desk,'End stretcher',x,.26,15.425,.07,.065,.69,wood);
 for(const x of [18.48,20.62]){box(desk,'Drawer casing',x,.69,15.42,.64,.24,.73,wood);box(desk,'Inset drawer shadow',x,.683,15.813,.60,.185,.02,dark,.006);box(desk,'Drawer front',x,.683,15.828,.57,.16,.026,edge,.007);rod(desk,'Drawer brass handle',[x-.08,.69,15.859],[x+.08,.69,15.859],.009,brass);}
 box(desk,'Self healing work mat',19.55,.890,15.43,1.12,.013,.63,sage,.026);
 const fine=mat('Cutting mat grid','#b1bba6');for(let i=0;i<17;i++)box(desk,'Mat measured line',19.06+i*.06,.897,15.43,.0015,.001,.55,fine,.0001);for(let i=0;i<9;i++)box(desk,'Mat measured line',19.55,.897,15.19+i*.06,.98,.001,.0015,fine,.0001);
 box(desk,'Leather strap being stitched',19.49,.906,15.47,.69,.013,.065,leather,.01);
 for(let i=0;i<32;i++)for(const z of [15.445,15.495])box(desk,'Saddle stitches',19.18+i*.02,.914,z,.006,.0015,.002,paper,.0005);
 // Buckles lie on their straps; round rivets and punched holes are legible at desk distance.
 for(const x of [18.45,20.42]){box(desk,'Finished collar strap',x,.896,15.38,.41,.017,.064,x<19?blue:tan,.009);const buckle=mesh(desk,'Rectangular collar buckle',new T.TorusGeometry(.045,.007,6,4),brass,[x-.19,.916,15.38]);buckle.rotation.x=Math.PI/2;buckle.rotation.z=Math.PI/4;for(let i=0;i<5;i++)cyl(desk,'Punched strap hole',x+.035+i*.025,.907,15.38,.0025,.0025,.001,dark);}
 const loop=(p,name,cx,cy,cz,rx,rz,m)=>{const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([cx+rx*Math.cos(a),cy,cz+rz*Math.sin(a)]);}const shape=new T.Shape();shape.moveTo(-.016,-.005);shape.lineTo(.016,-.005);shape.lineTo(.016,.005);shape.lineTo(-.016,.005);shape.closePath();return mesh(p,name,new T.ExtrudeGeometry(shape,{steps:96,bevelEnabled:false,extrudePath:new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v)),true)}),m,[0,0,0]);};
 loop(desk,'Coiled stitched leash',20.52,.906,15.66,.30,.11,tan);loop(desk,'Coiled leather belt',18.45,.906,15.64,.26,.12,blue);
 for(let i=0;i<17;i++){const a=i*.9,x=20.73+Math.cos(a)*(.10+i*.002),z=15.15+Math.sin(a)*(.075+i*.001);const o=mesh(desk,'Loose chain link',new T.TorusGeometry(.019,.0035,6,10),iron,[x,.895+(i%2)*.013,z]);o.rotation.set(Math.PI/2,i%2*.75,0);}
 for(const [x,z] of [[18.73,15.18],[18.84,15.20]]){cyl(desk,'Thread reel core',x,.94,z,.029,.029,.09,paper);cyl(desk,'Thread spool',x,.94,z,.033,.033,.063,blue);}
 box(desk,'Leather pattern paper',18.45,.889,15.08,.45,.003,.18,paper,.005);
 rod(desk,'Awl wooden grip',[19.93,.926,15.53],[20.07,.926,15.61],.014,wood);rod(desk,'Awl steel tip',[19.87,.914,15.495],[19.94,.926,15.54],.003,iron);
 rod(desk,'Craft knife handle',[19.77,.912,15.17],[19.94,.912,15.17],.013,wood);box(desk,'Craft knife blade',19.73,.912,15.17,.08,.004,.025,iron,.002);
 const tray=box(desk,'Small hardware tray',20.44,.906,15.08,.32,.04,.16,wood,.018);for(let i=0;i<9;i++)ball(desk,'Brass rivet',20.34+(i%3)*.055,.934,15.04+Math.floor(i/3)*.035,.009,brass,[1,.4,1]);
 addCollider('workbench',17.95,14.95,3.2,.95,.89);
 // Reuse the established detailed chair mesh. Translate its real bounds, not its old pivot.
 const chair=house.assets.get('work_chair');if(chair){chair.updateMatrixWorld(true);const b=new T.Box3().setFromObject(chair),c=b.getCenter(new T.Vector3());chair.position.add(new T.Vector3(19.55-c.x,FLOOR-b.min.y,16.45-c.z));chair.userData.basementFacing=[0,-1];}
 addCollider('work_chair',19.175,16.075,.75,.75,1.12);
 // Tools are hung on the EAST wall: pegboard, short pegs, connected handles and blades.
 box(fixtures,'Wall mounted tool board',21.665,1.48,15.42,.07,1.35,1.66,wood,.022);
 for(let iy=0;iy<9;iy++)for(let iz=0;iz<12;iz++){const o=cyl(fixtures,'Pegboard perforation',21.626,.91+iy*.135,14.69+iz*.132,.006,.006,.002,dark);o.rotation.z=Math.PI/2;}
 for(let i=0;i<7;i++){const z=14.80+i*.205,y=1.78;rod(fixtures,'Tool peg',[21.62,y,z],[21.53,y,z],.010,brass);tube(fixtures,'Tool hanging loop',[[21.54,y-.075,z-.015],[21.52,y+.01,z-.025],[21.51,y+.028,z],[21.52,y+.01,z+.025],[21.54,y-.075,z+.015]],.004,iron);rod(fixtures,'Tool wood handle',[21.54,y-.07,z],[21.54,y-.26,z],.023,i%2?wood:tan);rod(fixtures,'Steel tool shaft',[21.54,y-.26,z],[21.54,y-.43,z],.008,iron);if(i%3===0)box(fixtures,'Pricking iron head',21.54,y-.44,z,.018,.018,.075,iron,.004);if(i%3===1)box(fixtures,'Leather knife head',21.54,y-.42,z,.015,.10,.05,iron,.004);}
 rod(fixtures,'Mallet handle',[21.50,1.28,14.90],[21.50,.98,14.90],.027,wood);rod(fixtures,'Mallet head',[21.50,1.31,14.80],[21.50,1.31,15.0],.064,cream);
 box(fixtures,'Wall tool ledge',21.54,.88,15.42,.28,.055,1.64,edge);
 addCollider('toolboard ledge',21.40,14.59,.37,1.67,2.2);
 // Shallow leather storage remains outside the plush enclosure and clear of its gate.
 for(const y of [.28,.84,1.38])box(fixtures,'Leather storage shelf',21.47,y,13.42,.42,.045,.94,edge);
 for(const z of [12.97,13.87])box(fixtures,'Storage upright',21.54,.70,z,.31,1.4,.055,wood);
 for(let i=0;i<5;i++){const o=cyl(fixtures,'Rolled leather stock',21.46,.3575,13.10+i*.15,.055,.055,.40,i%2?tan:leather);o.rotation.z=Math.PI/2;const end=cyl(fixtures,'Visible roll core',21.252,.3575,13.10+i*.15,.018,.018,.003,dark);end.rotation.z=Math.PI/2;}
 for(let i=0;i<3;i++)box(fixtures,'Flat leather offcuts',21.45,.873+i*.022,13.40,.30,.02,.55,i%2?blue:tan,.018);
 addCollider('leather stock shelf',21.24,12.95,.54,.95,1.42);
 // Articulated task lamp with a real emitter, placed to the side of the viewing axis.
 cyl(desk,'Task lamp weighted base',18.14,.908,15.22,.105,.12,.06,iron);
 rod(desk,'Lamp lower arm',[18.14,.93,15.22],[18.10,1.28,15.13],.014,iron);ball(desk,'Lamp elbow',18.10,1.28,15.13,.030,brass);
 rod(desk,'Lamp upper arm',[18.10,1.28,15.13],[18.42,1.49,15.26],.014,iron);
 const shade=cyl(desk,'Task lamp metal shade',18.42,1.445,15.26,.065,.13,.15,sage);const glow=new T.MeshStandardMaterial({name:'Workshop lamp glass',color:'#fff0cc',emissive:'#ffdf9c',emissiveIntensity:.7,roughness:.5});cyl(desk,'Lamp luminous inner face',18.42,1.37,15.26,.11,.11,.008,glow);
 const cable=tube(desk,'Resting lamp cable',[[18.14,.90,15.22],[18.05,.90,15.5],[18.0,.86,15.76],[18.0,.2,15.76],[18.0,.015,15.77],[17.6,.015,15.90]],.0035,dark);const ca=cable.geometry.attributes.position;for(let i=0;i<ca.count;i++)ca.setY(i,Math.max(.004,ca.getY(i)));cable.geometry.computeVertexNormals();
 // Candles sit on a separate iron tray. They do not share the cutting surface.
 box(fixtures,'Candle wall shelf',21.54,1.15,16.80,.30,.05,.63,edge);box(fixtures,'Candle fireproof tray',21.50,1.19,16.80,.25,.025,.54,iron,.02);
 const flame=new T.MeshStandardMaterial({name:'Candle glow',color:'#ffe9b2',emissive:'#ffd187',emissiveIntensity:1.5});
 for(const [z,h] of [[16.67,.16],[16.9,.23]]){cyl(fixtures,'Wax candle',21.50,1.202+h/2,z,.042,.044,h,wax);rod(fixtures,'Candle wick',[21.50,1.202+h,z],[21.50,1.217+h,z],.002,dark);ball(fixtures,'Small candle flame',21.50,1.232+h,z,.009,flame,[.7,2,1]);}
 // Quiet wall trim and a plaster ceiling fitting keep the craft room visually cohesive.
 for(const z of [14.95,16.45])house.roofs.push(box(root,'Ceiling oak batten',19.62,2.99,z,4.05,.09,.10,edge,.008));
 house.roofs.push(box(root,'Workshop ceiling diffuser',19.55,2.94,14.0,1.30,.055,.43,cream,.025));
 const bindLighting=(scene,lighting)=>{
  const prior=scene.children.find(l=>l.isPointLight&&l.userData.id==='workshop');if(prior){prior.position.set(19.55,FLOOR+2.35,14.15);prior.userData.night=12;prior.intensity=9;}
  const fill=new T.RectAreaLight('#ffe6c7',2.4,3,1.7);fill.position.set(19.55,FLOOR+2.20,13.25);fill.lookAt(19.55,FLOOR+.35,10.7);scene.add(fill);
  const task=new T.SpotLight('#ffe4b6',8,4,Math.PI/3,.7,2);task.position.set(18.42,FLOOR+1.355,15.26);task.target.position.set(19.1,FLOOR+.89,15.45);task.castShadow=true;task.shadow.mapSize.set(1024,1024);task.shadow.normalBias=.012;task.shadow.bias=-.0001;scene.add(task,task.target);
  const candle=new T.PointLight('#ffd6a1',.9,1.4,2);candle.position.set(21.45,FLOOR+1.48,16.8);scene.add(candle);
 };
 // Merge only fixed craft parts by material. Toys and moving gate remain independent.
 const parts=[];
 function batch(group){group.updateMatrixWorld(true);const inv=group.matrixWorld.clone().invert(),buckets=new Map();group.traverse(o=>{if(!o.isMesh)return;parts.push(o.name);const g=o.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,o.matrixWorld));const flat=g.index?g.toNonIndexed():g;const key=o.material.uuid;if(!buckets.has(key))buckets.set(key,{mat:o.material,geo:[]});buckets.get(key).geo.push(flat);});group.clear();for(const b of buckets.values()){const geo=mergeGeometries(b.geo,false);if(!geo)throw Error('Basement static batching failed');mesh(group,b.mat.name,geo,b.mat,[0,0,0]);b.geo.forEach(g=>g.dispose());}}
 fixtures.remove(desk);root.add(desk);batch(desk);batch(fixtures);fixtures.userData.sourceParts=parts;

 root.userData={version:2,plan:basementPlan,reusedAssets:['teddy-ai-v001.glb','my-melody-game-v001.glb'],cellContents:['3 plush toys','plush rug','one yarn ball'],newModelCredits:0};
 house.basementFinish={root,cell,toys,hinge,update:syncGateCollider,bindLighting,toggleGate,state:()=>({open,plan:basementPlan,parts:parts.length,cellContents:root.userData.cellContents}),nearGate:p=>p.y<-2.5&&Math.hypot(p.x-20.66,p.z-12.1)<1.35};
 return house.basementFinish;
}
