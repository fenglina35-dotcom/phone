import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const mat=(name,color,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({name:'017 / '+name,color,roughness,metalness});
const pink=mat('blush woven upholstery','#d8b9b7',.94),seam=mat('soft sewn piping','#b99d99',.91),cream=mat('pearl enamel','#e9e4db',.43),metal=mat('satin nickel','#bac1c0',.31,.72),dark=mat('soft graphite rubber','#49494b',.83),oak=mat('satin honey oak','#bb9872',.61),linen=mat('ivory cotton hem','#e5d9c9',.94);
function mesh(p,n,g,m,pos=[0,0,0]){const o=new T.Mesh(g,m);o.name=n;o.position.fromArray(pos);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
const box=(p,n,pos,s,m,r=.008)=>mesh(p,n,new RoundedBoxGeometry(...s,3,Math.min(r,...s.map(x=>x/2.1))),m,pos);
function tube(p,n,pts,r,m,closed=false){return mesh(p,n,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v)),closed),Math.max(24,pts.length*6),r,8,closed),m);}
function rod(p,n,a,b,r,m){const v=new T.Vector3(...a),w=new T.Vector3(...b),o=mesh(p,n,new T.CylinderGeometry(r,r,v.distanceTo(w),16),m,v.clone().add(w).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),w.sub(v).normalize());return o;}
function ball(p,n,pos,s,m){const o=mesh(p,n,new T.SphereGeometry(1,32,24),m,pos);o.scale.fromArray(s);return o;}
const sp=(v,e)=>Math.sign(v)*Math.abs(v)**e;
function pillow(p,n,pos,w,h,d,m){const g=new T.SphereGeometry(1,56,36),a=g.attributes.position;for(let i=0;i<a.count;i++){let x=a.getX(i),y=a.getY(i),z=a.getZ(i);a.setXYZ(i,w/2*sp(x,.43),h/2*sp(y,.67)*(1-.10*x*x),d/2*sp(z,.43));}g.computeVertexNormals();return mesh(p,n,g,m,pos);}
function removeMatches(root,rx){const out=[];root.traverse(o=>{if(rx.test(o.name))out.push(o)});out.forEach(o=>o.removeFromParent());}
function frame(p,pos,w,h,d){const[x,y,z]=pos;for(const xx of[-w/2,w/2])box(p,'Rounded dimensional mirror stile',[x+xx,y,z],[.026,h+.04,d],cream,.009);for(const yy of[-h/2,h/2])box(p,'Rounded dimensional mirror rail',[x,y+yy,z],[w,.026,d],cream,.009);for(const xx of[-w/2+.022,w/2-.022])box(p,'Mirror inset metallic reveal',[x+xx,y,z+d*.49],[.004,h-.02,.003],metal,.001);}

export function refineBedroom017(house,roots){
 const find=n=>roots.find(r=>r.name===n)||house.main.getObjectByName(n);
 const chair=find('bed_chair');chair.clear();
 // Continuous cushions, connected yoke and paired casters; every part has a support.
 rod(chair,'Chair gas lift',[0,.15,0],[0,.40,0],.029,metal);
 box(chair,'Swivel mechanism',[0,.415,0],[.27,.052,.24],dark,.018);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.cos(a)*.235,z=Math.sin(a)*.235;
  tube(chair,'Curved five star base',[[0,.19,0],[x*.5,.145,z*.5],[x,.096,z]],.018,cream);
  const caster=new T.Group();caster.position.set(x,.048,z);caster.rotation.y=a;chair.add(caster);
  box(caster,'Caster fork',[0,.025,0],[.068,.034,.056],cream,.009);
  for(const s of[-1,1]){const o=mesh(caster,'Rubber twin caster',new T.CylinderGeometry(.042,.042,.021,24),dark,[s*.033,0,0]);o.rotation.z=Math.PI/2;const cap=mesh(caster,'Caster axle cap',new T.CylinderGeometry(.013,.013,.003,20),metal,[s*.045,0,0]);cap.rotation.z=Math.PI/2;}
 }
 pillow(chair,'Sculpted softly compressed seat',[0,.487,.012],.47,.107,.45,pink);
 const edge=[];for(let i=0;i<65;i++){const a=i/64*Math.PI*2;edge.push([.229*sp(Math.cos(a),.45),.476,.012+.218*sp(Math.sin(a),.45)]);}tube(chair,'Seat tailored welt',edge,.0017,seam);
 tube(chair,'Continuous backrest support',[[0,.41,-.1],[0,.46,-.19],[0,.64,-.24],[0,.82,-.255]],.016,cream);
 const back=pillow(chair,'Curved padded ergonomic back',[0,.753,-.221],.445,.405,.102,pink);back.rotation.x=-.10;
 for(const x of[-.135,.135])tube(chair,'Backrest stitched seam',[[x,.60,-.165],[x,.72,-.164],[x,.88,-.178]],.0013,seam);
 for(const side of[-1,1]){tube(chair,'Connected curved armrest frame',[[side*.19,.424,-.12],[side*.25,.49,-.12],[side*.25,.638,-.105],[side*.25,.642,.12]],.014,cream);pillow(chair,'Soft armrest cap',[side*.25,.655,.026],.056,.046,.25,pink);}
 rod(chair,'Seat height adjustment lever',[.06,.409,0],[.205,.396,.07],.006,metal);box(chair,'Lever grip',[.211,.397,.076],[.055,.015,.034],dark);
 const desk=find('bed_desk'),headphones=desk.getObjectByName('Over ear headphones');
 if(headphones)headphones.removeFromParent();
 removeMatches(desk,/Headphone jack metal tip/);
 const mirror=find('bedroom_full_length_mirror');if(mirror){frame(mirror,[0,0,.047],.440,1.64,.110);box(mirror,'Mirror solid recessed rear',[0,0,-.024],[.454,1.68,.045],cream,.015);for(const x of[-.185,.185])box(mirror,'Floor mirror supported foot',[x,-.858,.024],[.07,.046,.16],cream,.012);for(const y of[-.55,.55])box(mirror,'Mirror wall mounting block',[0,y,-.078],[.12,.07,.084],metal,.008);}
 const vanity=find('vanity');frame(vanity,[0,1.14,-.153],.514,.648,.056);box(vanity,'Mirror weighted desktop base',[0,.803,-.18],[.25,.02,.17],cream,.009);
 house.detail017={bedroom:['continuous upholstered chair','paired casters','headphones removed','dimensional mirrors']};
}

function cloth(p,n,x,y,z,w,h,m){
 const g=new T.PlaneGeometry(w,h,32,48),a=g.attributes.position;
 for(let i=0;i<a.count;i++){const u=a.getX(i)/w+.5,v=.5-a.getY(i)/h;a.setXYZ(i,x+(u-.5)*w*(.75+.25*v),y-v*h-.014*Math.sin(u*Math.PI)*v,z+.013*Math.sin(u*Math.PI*5+.3*v)*(.35+.65*v)+.028*v*v);}
 g.computeVertexNormals();m.side=T.DoubleSide;const o=mesh(p,n,g,m);const left=[],right=[],bottom=[];
 const sample=(u,v)=>[x+(u-.5)*w*(.75+.25*v),y-v*h-.014*Math.sin(u*Math.PI)*v,z+.013*Math.sin(u*Math.PI*5+.3*v)*(.35+.65*v)+.028*v*v];
 for(let i=0;i<=32;i++){left.push(sample(.014,i/32));right.push(sample(.986,i/32));bottom.push(sample(i/32,.987));}
 for(const pts of[left,right,bottom])tube(p,'Cloth rolled stitched hem',pts,.0018,linen);
 return o;
}
export function refineKitchenCloth017(roots){const r=roots.find(o=>o.name==='kitchen_hanging_linen_v002');if(!r)return;r.clear();
 const rose=mat('rose cotton cloth','#d8aba8',.96),sage=mat('sage quilted cotton','#a8b49e',.96);
 cloth(r,'Draped gathered tea towel',3.90,1.425,.257,.24,.36,rose);
 tube(r,'Towel sewn hanging loop',[[3.90,1.425,.257],[3.895,1.482,.208],[3.912,1.493,.205],[3.92,1.425,.257]],.003,linen);
 const s=new T.Shape();s.moveTo(-.035,.09);s.bezierCurveTo(-.07,.11,-.078,.068,-.074,.015);s.bezierCurveTo(-.122,.07,-.14,.028,-.105,-.022);s.lineTo(-.069,-.054);s.lineTo(-.055,-.13);s.quadraticCurveTo(0,-.147,.047,-.124);s.lineTo(.067,.045);s.quadraticCurveTo(.065,.115,-.035,.09);
 const glove=mesh(r,'Continuous padded oven glove',new T.ExtrudeGeometry(s,{depth:.017,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:3,curveSegments:18}),sage,[3.61,1.30,.251]);glove.rotation.z=.1;
 for(let i=0;i<5;i++)tube(glove,'Glove quilt stitching',[[-.051,-.095+i*.035,.024],[0,-.093+i*.035,.027],[.047,-.088+i*.035,.024]],.0008,linen);
 tube(r,'Mitten fabric hanging loop',[[3.60,1.398,.265],[3.60,1.48,.204],[3.623,1.488,.207],[3.63,1.398,.266]],.0035,linen);
}
export function refineUtensils017(roots){const r=roots.find(o=>o.name==='kitchen_splash');if(!r)return;const remove=new Set();r.traverse(o=>{if(/Concave carved|Spoon bowl|Utensil handle/.test(o.name))remove.add(o.parent===r?o:o.parent);});remove.forEach(o=>o.removeFromParent());
 for(const [i,x]of [2.92,3.2,4.32].entries()){
  const g=new T.Group();g.name=['Hanging soup ladle','Hanging slotted spatula','Hanging wooden spoon'][i];g.position.set(x,1.15,.247);r.add(g);
  tube(g,'Tapered utensil grip',[[0,.09,0],[0,.18,-.004],[0,.25,-.009]],.010,i===2?oak:cream);
  const loop=mesh(g,'Utensil hanging eye',new T.TorusGeometry(.014,.003,8,24),metal,[0,.268,-.011]);
  rod(g,'Connected utensil neck',[0,.02,.013],[0,.108,0],.004,i===2?oak:metal);
  if(i===1){for(const sx of[-.041,-.013,.013,.041])box(g,'Spatula blade rib',[sx,-.015,.016],[.012,.09,.006],metal,.004);for(const yy of[-.06,.028])box(g,'Spatula blade bridge',[0,yy,.016],[.093,.013,.006],metal,.004);}
  else {const geo=new T.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI/2),bowl=mesh(g,'Concave utensil bowl',geo,i===2?oak:metal,[0,-.035,.029]);bowl.rotation.x=Math.PI/2;bowl.scale.set(.041,i===2?.012:.036,.055);bowl.material=bowl.material.clone();bowl.material.side=T.DoubleSide;const pts=[];for(let j=0;j<=48;j++){const a=j/48*Math.PI*2;pts.push([.041*Math.cos(a),-.035+.055*Math.sin(a),.029]);}tube(g,'Rounded utensil rim',pts,.002,i===2?oak:metal);}
  tube(g,'Connected rail hook',[[0,.30,-.047],[0,.291,-.01],[0,.276,.0],[0,.266,-.011]],.003,metal);
 }
}

function surfaceTexture(size,draw){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;}
export function finishAtmosphere017(house,L){
 let seed=1701;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const plaster=surfaceTexture(256,(q,n)=>{q.fillStyle='#888';q.fillRect(0,0,n,n);for(let i=0;i<24000;i++){const v=116+Math.floor(random()*25);q.fillStyle=`rgb(${v},${v},${v})`;q.fillRect(random()*n,random()*n,1,1);}});plaster.repeat.set(8,8);
 let walls=0;const wallMats=new Set();for(const w of house.wallMeshes){const o=w.mesh;if(o?.isMesh){const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)if(m.isMeshStandardMaterial)wallMats.add(m);}}
 house.root.traverse(o=>{if(o.isMesh&&/plaster|wall finish|wallpaper/i.test(o.material?.name))wallMats.add(o.material);});
 for(const m of wallMats){m.bumpMap=plaster;m.bumpScale=.0012;m.roughness=.91;m.needsUpdate=true;walls++;}
 const drops=surfaceTexture(512,(q,n)=>{q.fillStyle='#808080';q.fillRect(0,0,n,n);for(let i=0;i<600;i++){let x=random()*n,y=random()*n,r=.8+random()*2;const g=q.createRadialGradient(x-.4,y-.7,.1,x,y,r*1.6);g.addColorStop(0,'#dadada');g.addColorStop(.5,'#999999');g.addColorStop(1,'#808080');q.fillStyle=g;q.beginPath();q.ellipse(x,y,r,r*1.7,0,0,Math.PI*2);q.fill();}for(let i=0;i<32;i++){const x=random()*n,y=random()*n;q.strokeStyle='rgba(200,200,200,.3)';q.lineWidth=.8+random();q.beginPath();q.moveTo(x,y);q.bezierCurveTo(x+2,y+15,x-2,y+30,x+1,y+60+random()*100);q.stroke();}});
 const rainColor=surfaceTexture(768,(q,n)=>{q.fillStyle='#d7e0df';q.fillRect(0,0,n,n);for(let i=0;i<420;i++){const x=random()*n,y=random()*n,r=1+random()*2.3;q.lineWidth=.7;q.strokeStyle='rgba(78,106,114,.26)';q.beginPath();q.ellipse(x,y,r,r*1.65,0,0,Math.PI*2);q.stroke();q.strokeStyle='rgba(255,255,255,.66)';q.beginPath();q.ellipse(x-.4,y-.6,r*.75,r*1.25,0,Math.PI,Math.PI*1.9);q.stroke();if(i%8===0){q.strokeStyle='rgba(94,124,130,.13)';q.lineWidth=1.4;q.beginPath();q.moveTo(x,y);q.bezierCurveTo(x+2,y+20,x-2,y+55,x+1,y+100);q.stroke();}}});rainColor.colorSpace=T.SRGBColorSpace;
 const glass=new T.MeshPhysicalMaterial({name:'Rain mist window glass',map:rainColor,color:'#edf5f4',roughness:.12,metalness:.09,clearcoat:1,clearcoatRoughness:.06,transmission:.28,thickness:.04,ior:1.5,bumpMap:drops,bumpScale:.004,envMapIntensity:.8,side:T.DoubleSide});
 const mist=surfaceTexture(256,(q,n)=>{const g=q.createLinearGradient(0,0,0,n);g.addColorStop(0,'#b3c7cc');g.addColorStop(.52,'#e0e7df');g.addColorStop(1,'#c8d4d4');q.fillStyle=g;q.fillRect(0,0,n,n);for(let i=0;i<40;i++){const x=random()*n,y=random()*n,r=20+random()*65;const g=q.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(248,246,230,.08)');g.addColorStop(1,'rgba(248,246,230,0)');q.fillStyle=g;q.fillRect(0,0,n,n);}});mist.colorSpace=T.SRGBColorSpace;
 const backing=new T.MeshStandardMaterial({name:'Opaque luminous mist behind glass',map:mist,color:'#dce6e0',emissive:'#aec2bf',emissiveIntensity:.26,roughness:1});
 const windows=[];house.main.traverse(o=>{if(o.name==='Window'&&o.isMesh){o.material=glass;o.castShadow=false;windows.push(o);}});
 for(const win of windows){const b=new T.Box3().setFromObject(win),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());const g=win.geometry.clone();const back=new T.Mesh(g,backing);back.name='Sealed opaque mist backing';back.position.copy(win.position);back.quaternion.copy(win.quaternion);back.scale.copy(win.scale);if(size.x>size.z)back.position.z+=center.z>7? .047:-.047;else back.position.x-=.047;win.parent.add(back);back.receiveShadow=true;}
 // Wall-mounted wood handrails follow the slope and return into their brackets.
 const stairs=house.stairs;
 for(const [x,y1,z1,y2,z2,wallx]of [[2.64,1,3.54,-.575,1.3,2.73],[.16,-.575,1.3,-2.15,3.54,.07]]){
  const path=[[wallx,y1,z1],[x,y1,z1],[x,y1+(y2-y1)*.12,z1+(z2-z1)*.12],[x,y2,z2],[wallx,y2,z2]];if(z1===1.3)path.shift();if(z2===1.3)path.pop();tube(stairs,'Continuous rounded oak stair handrail',path,.026,oak);
  for(const t of[.12,.44,.76]){const y=T.MathUtils.lerp(y1,y2,t),z=T.MathUtils.lerp(z1,z2,t);tube(stairs,'Handrail bent wall bracket',[[wallx,y-.085,z],[x,y-.085,z],[x,y-.02,z]],.006,metal);const flange=mesh(stairs,'Wall mounted handrail flange',new T.CylinderGeometry(.029,.029,.012,24),metal,[wallx,y-.085,z]);flange.rotation.z=Math.PI/2;}
 }
 tube(stairs,'Landing continuous return handrail',[[2.64,-.575,1.3],[2.64,-.575,.27],[2.52,-.575,.20],[.28,-.575,.20],[.16,-.575,.27],[.16,-.575,1.3]],.026,oak);
 for(const x of[.5,1.4,2.3])rod(stairs,'Landing rail wall support',[x,-.575,.20],[x,-.575,.08],.008,metal);
 const star=new T.Group();star.name='Flush ceiling star light';star.position.set(19.60,2.564,10.85);house.basementFinish.cell.add(star);house.roofs.push(star);
 const shape=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.105:.205;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();
 const shell=mesh(star,'Star flush mounting body',new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:3}),cream);shell.rotation.x=-Math.PI/2;
 const glow=mat('Star opal diffuser','#eee0b6',.4);glow.emissive.set('#ffe3a1');glow.emissiveIntensity=.5;glow.side=T.DoubleSide;const diffuser=mesh(star,'Star luminous underside',new T.ShapeGeometry(shape),glow,[0,-.005,0]);diffuser.rotation.x=-Math.PI/2;diffuser.scale.set(.91,.91,1);
 house.atmosphere017={windows:windows.length,wallMaterials:walls,star,glass,backing,outdoorImages:0};
 house.basementFinish.root.userData.cellContents.push('flush ceiling star light');
}
export function bindStar017(house,scene){const l=new T.RectAreaLight('#ffe3b0',2.6,.35,.35);l.name='Plush room star practical light';l.position.set(19.6,-.63,10.85);l.lookAt(19.6,-3.1,10.85);scene.add(l);house.atmosphere017.starLight=l;}
