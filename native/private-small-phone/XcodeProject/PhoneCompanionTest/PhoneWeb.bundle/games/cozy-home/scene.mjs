import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function buildHouse(L){
 const root=new T.Group();root.name='CozyHome_009_metres';const main=new T.Group(),basement=new T.Group(),stairs=new T.Group(),people=new T.Group();root.add(main,basement,stairs,people);
 main.name='MainFloor';basement.name='Basement';stairs.name='SharedStaircase';people.name='TemporaryScaleFigures';
 const roofs=[],wallMeshes=[],assets=new Map(),windows=[],labels=[];
 const materials={};for(const [k,c] of Object.entries({wall:'#f8eddf',wood:'#cda77e',edge:'#ad825e',cream:'#fff4e2',pink:'#dfb3be',mint:'#b9cbb2',blue:'#a9c7cc',dark:'#544c49',metal:'#a2a2a0',white:'#fff9ef',water:'#a7d3d5',green:'#779477'}))materials[k]=new T.MeshStandardMaterial({color:c,roughness:.88});
 const mesh=(g,geo,m,x,y,z,name='')=>{const o=new T.Mesh(geo,typeof m==='string'?materials[m]:m);o.position.set(x,y,z);o.name=name;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const box=(g,x,y,z,w,h,d,m='wood',r=0,name='')=>mesh(g,r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),m,x,y,z,name);
 const cyl=(g,x,y,z,r,h,m='wood')=>mesh(g,new T.CylinderGeometry(r,r,h,16),m,x,y,z);
 const ball=(g,x,y,z,a,b,c,m='pink')=>{const o=mesh(g,new T.SphereGeometry(1,14,10),m,x,y,z);o.scale.set(a,b,c);return o;};
 const ring=(g,x,y,z,r,t,m='metal',flat=false)=>{const o=mesh(g,new T.TorusGeometry(r,t,7,24),m,x,y,z);if(flat)o.rotation.x=-Math.PI/2;return o;};
 const rod=(g,a,b,r,m='edge')=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),dir=vb.clone().sub(va);const o=cyl(g,...va.clone().add(vb).multiplyScalar(.5).toArray(),r,dir.length(),m);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return o;};
 const text=(g,s,x,y,z,w=.9)=>{const c=document.createElement('canvas');c.width=512;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='#fffaf0';ctx.fillRect(0,0,512,100);ctx.fillStyle='#70574d';ctx.font='36px Microsoft YaHei';ctx.textAlign='center';ctx.fillText(s,256,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const o=mesh(g,new T.PlaneGeometry(w,w/5),new T.MeshBasicMaterial({map:t,side:T.DoubleSide}),x,y,z);return o;};
 function floor(g,b,y,tile=false){const [x,z,w,d]=b;const m=materials.wood.clone();m.color.set(0xffffff);const c=document.createElement('canvas');c.width=c.height=256;const q=c.getContext('2d');q.fillStyle=tile?'#e3edeb':'#d7b58e';q.fillRect(0,0,256,256);q.strokeStyle=tile?'#bbc9c6':'#b6937160';q.lineWidth=2;
  if(tile){q.strokeRect(0,0,256,256);}else for(let i=0;i<8;i++){q.fillStyle=i%3?'#d6b38b':'#dcbe9a';q.fillRect(0,i*32,256,32);q.beginPath();q.moveTo(0,i*32);q.lineTo(256,i*32);q.moveTo(i%2?68:196,i*32);q.lineTo(i%2?68:196,(i+1)*32);q.stroke();}
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(tile?w/.6:w/2,tile?d/.6:d/2);m.map=t;box(g,x+w/2,y-.1,z+d/2,w,.2,d,m,0,'Floor');
 }
 for(const b of L.floors){floor(main,b,0);const [x,z,w,d]=b;roofs.push(box(main,x+w/2,2.97,z+d/2,w,.14,d,'cream',0,'Ceiling'));}
 floor(main,[21.28,.08,4.64,7.24],.004,true);floor(basement,L.basement.box,-3.15);
 // Basement ceiling leaves the exact same stairwell opening as the upper floor.
 for(const b of [[17.4,9.4,4.4,8.4],[14.6,14.2,2.8,3.6]]){const [x,z,w,d]=b;roofs.push(box(basement,x+w/2,-.1,z+d/2,w,.12,d,'cream'));}
 function wall(g,w,base,win=[]){const [x,z,u,v]=w,h=z===v,c=h?z:x,a=h?x:z,b=h?u:v;const spans=win.filter(q=>h?q.a[1]===c&&q.b[1]===c:q.a[0]===c&&q.b[0]===c).map(q=>h?[q.a[0],q.b[0]]:[q.a[1],q.b[1]]).filter(([s,e])=>s>=a&&e<=b);const cuts=[a,b,...spans.flat()].sort((a,b)=>a-b);
  const seg=(s,e,lo,hi)=>{if(e<=s)return;const o=box(g,h?(s+e)/2:c,base+(lo+hi)/2,h?c:(s+e)/2,h?e-s:.15,hi-lo,h?.15:e-s,'wall');wallMeshes.push({mesh:o,base:base+lo,height:hi-lo});};
  for(let i=0;i<cuts.length-1;i++){const s=cuts[i],e=cuts[i+1],has=spans.some(([p,q])=>(s+e)/2>p&&(s+e)/2<q);if(!has){seg(s,e,0,2.9);continue;}seg(s,e,0,.7);seg(s,e,2.5,2.9);const mid=(s+e)/2;
   const pane=box(g,h?mid:c,base+1.6,h?c:mid,h?e-s:.03,1.8,h?.03:e-s,new T.MeshStandardMaterial({color:'#cfe6eb',emissive:'#bbd6dd',emissiveIntensity:.3,roughness:.6}),0,'Window');pane.castShadow=false;windows.push(pane);
   for(const p of [s,mid,e])box(g,h?p:c,base+1.6,h?c:p,h?.055:.18,1.85,h?.18:.055,'cream');
   for(const y of [.7,1.6,2.5])box(g,h?mid:c,base+y,h?c:mid,h?e-s+.1:.2,.06,h?.2:e-s+.1,'cream');
   if(base===0&&!(h&&c===0&&s>=7.2&&e<=14.1)){const material=mid<14.6?'mint':'pink';for(const p of [s+.12,e-.12])for(let j=0;j<3;j++){const shift=(j-1)*.085;box(g,h?p+shift:c+.15,1.53,h?c+(c===0?.17:-.17):p+shift,h?.09:.13,2.12,h?.13:.09,material,.025);} }
  }
  box(g,h?(a+b)/2:c,base+.07,h?c:(a+b)/2,h?b-a:.19,.14,h?.19:b-a,'edge');
  const trim=box(g,h?(a+b)/2:c,base+2.82,h?c:(a+b)/2,h?b-a:.19,.1,h?.19:b-a,'edge');roofs.push(trim);
 }
 L.walls.forEach(w=>wall(main,w,0,L.windows));L.basement.walls.forEach(w=>wall(basement,w,-3.15));
 for(const d of L.doors){const h=d.a[1]===d.b[1],x=(d.a[0]+d.b[0])/2,z=(d.a[1]+d.b[1])/2,len=Math.hypot(d.a[0]-d.b[0],d.a[1]-d.b[1]);for(const p of [d.a,d.b])box(main,p[0],1.12,p[1],.09,2.24,.09,'edge');box(main,x,2.27,z,h?len+.1:.12,.12,h?.12:len+.1,'edge');const upper=box(main,x,2.6,z,h?len:.15,.6,h?.15:len,'wall');roofs.push(upper);}
 box(main,10.7,1.12,7.4,1.4,2.24,.08,'wood',.02,'ClosedEntrance');ball(main,11.22,1.04,7.32,.035,.035,.035,'metal');
 const [ox,oz]=L.stairs.offset;stairs.position.set(ox,0,oz);
 for(let i=0;i<8;i++){box(stairs,2.1,-(i+1)*.175-.09,3.54-(i+.5)*.28,1.1,.18,.28,'wood',0,'EastStep');box(stairs,.7,-1.575-(i+1)*.175-.09,1.3+(i+.5)*.28,1.1,.18,.28,'wood',0,'WestStep');}
 box(stairs,1.4,-1.665,.75,2.5,.18,1.1,'wood');box(stairs,2.1,-.09,4.17,1.1,.18,1.26,'wood');box(stairs,.7,-3.24,4.17,1.1,.18,1.26,'wood');
 const divider=box(stairs,1.4,-.125,2.95,.16,6.05,3.3,'wall');wallMeshes.push({mesh:divider,base:-3.15,height:6.05});

 function plant(g,x,z,y=0){cyl(g,x,y+.13,z,.14,.26,'cream');for(let i=0;i<6;i++){const a=i*2.4;rod(g,[x,y+.2,z],[x+Math.sin(a)*.15,y+.65,z+Math.cos(a)*.15],.012,'green');const o=ball(g,x+Math.sin(a)*.19,y+.55+i*.035,z+Math.cos(a)*.19,.14,.22,.04,'green');o.rotation.y=a;}}
 function mug(g,x,y,z){cyl(g,x,y+.055,z,.045,.11,'cream');cyl(g,x,y+.112,z,.035,.002,'dark');ring(g,x+.055,y+.06,z,.03,.009,'cream');}
 function asset(f,g,base=0){const [x,z,w,d]=f.box;const c=new T.Group();c.name=f.id;c.userData={id:f.id,kind:f.kind,box:f.box,independent:true};c.position.set(x+w/2,base,z+d/2);g.add(c);assets.set(f.id,c);const k=f.kind;
  if(k==='chair'||k==='sofa'){const [fx,fz]=f.facing||[0,-1];c.rotation.y=Math.atan2(-fx,-fz);const a=fx?d:w,b=fx?w:d;
   if(k==='chair'){box(c,0,.46,0,a,.12,b,f.boss?'dark':'pink',.045);box(c,0,f.boss?.96:.79,b/2-.06,a,f.boss?.98:.65,.13,f.boss?'dark':'wood',.04);for(const xx of [-a*.35,a*.35])for(const zz of [-b*.3,b*.3])box(c,xx,.22,zz,.05,.44,.05,'edge');}
   else{box(c,0,.25,0,a,.4,b,'cream',.08);box(c,0,.72,b/2-.13,a,.8,.23,'cream',.07);for(const xx of [-a/2+.13,a/2-.13])box(c,xx,.56,0,.26,.5,b,'cream',.06);const n=Math.max(1,Math.round(a));for(let i=0;i<n;i++)box(c,-a/2+.27+(i+.5)*(a-.54)/n,.51,-.05,(a-.58)/n,.19,b-.27,'white',.07);for(const xx of [-a*.28,a*.28]){const p=box(c,xx,.85,b*.19,.48,.43,.18,f.id==='side_seat'?'mint':'pink',.07);p.rotation.x=-.15;}}
  }else if(['table','desk','workbench'].includes(k)){const h=f.height||.76;box(c,0,h,0,w,.1,d,'wood',.03);for(const xx of [-w/2+.12,w/2-.12])for(const zz of [-d/2+.12,d/2-.12])box(c,xx,h/2,zz,.07,h,.07,'edge');
   if(f.id==='dining_table'){box(c,0,h+.056,0,w-.06,.014,d-.03,'pink');for(const zz of [-d*.31,d*.31]){cyl(c,0,h+.08,zz,.13,.018,'cream');mug(c,.48,h+.07,zz);} }
   if(f.id==='coffee'){box(c,.4,h+.07,0,.27,.03,.19,'pink',.015);box(c,-.4,h+.07,0,.25,.035,.12,'dark',.03);}
   if(f.id==='bed_desk'){box(c,0,h+.38,0,.8,.46,.05,'dark',.02);box(c,0,h+.04,.16,.6,.025,.17,'cream');}
   if(f.id==='executive_desk'){box(c,0,1.1,-.75,.05,.48,.75,'dark',.02);box(c,-.12,.835,-.55,.24,.025,.5,'dark');mug(c,.1,.82,.9);}
   if(k==='workbench'){box(c,0,.825,0,w*.8,.02,d*.7,'mint');for(let i=0;i<4;i++){ring(c,-.85+i*.55,.855,0,.13,.025,i%2?'pink':'edge',true);box(c,-.85+i*.55,.885,-.12,.075,.04,.04,'metal');}}
  }else if(k==='bed'){box(c,0,.26,0,w,.42,d,'wood',.04);box(c,0,.51,0,w,.24,d,'cream',.09);box(c,0,.78,-d/2+.04,w+.08,1.3,.16,'pink',.08);box(c,0,.66,.25,w-.03,.15,d-.6,'pink',.07);for(const xx of [-.45,.45])box(c,xx,.68,-.68,.7,.2,.43,'white',.07);}
  else if(k==='fridge'){box(c,0,1.05,-.035,w,2.1,d-.07,'mint',.035);const door=new T.Group();door.name='FridgeDoor';door.position.set(-w/2,0,d/2+.005);c.add(door);box(door,w/2,1.05,0,w,2.06,.055,'mint',.025);box(door,w-.1,1.45,.06,.035,.32,.04,'metal');box(door,w/2,1.37,.035,w-.06,.023,.014,'cream');c.fridgeDoor=door;}
  else if(k==='counter'){box(c,0,.44,0,w,.88,d,'cream',.02);box(c,0,.9,0,w+.04,.06,d+.03,'wood');for(let a=-w/2+.38;a<w/2;a+=.76){box(c,a,.44,d/2+.01,.69,.77,.025,'wood',.012);box(c,a,.73,d/2+.03,.22,.024,.025,'metal');}
   const sx=2.05-(x+w/2),px=3.55-(x+w/2),hx=5.3-(x+w/2);box(c,sx,.942,0,.63,.022,.46,'metal',.035);box(c,sx,.951,0,.51,.02,.34,'water',.04);rod(c,[sx,.95,-.22],[sx,1.27,-.22],.017,'metal');rod(c,[sx,1.27,-.22],[sx,1.27,.04],.017,'metal');box(c,px,.95,0,.72,.025,.44,'edge',.015);box(c,hx,.943,0,.75,.024,.53,'dark');for(const a of [-.18,.18])ring(c,hx+a,.96,0,.11,.014,'metal',true);box(c,hx,2.06,-.04,.95,.23,.54,'metal',.025);box(c,hx,2.4,-.13,.48,.6,.32,'metal');box(c,px,2.1,-.05,1.2,.6,.43,'wood',.015);
  }else if(k==='tv'){box(c,0,.29,0,w,.58,d,'wood',.025);box(c,0,.65,0,.38,.18,.24,'dark');box(c,0,1.18,0,1.8,1,.07,'dark',.02);box(c,0,1.18,.04,1.68,.88,.01,new T.MeshStandardMaterial({color:'#293641',roughness:.45}));}
  else if(k==='tub'){const shape=new T.Shape();shape.absellipse(0,0,w/2,d/2,0,Math.PI*2,false);const hole=new T.Path();hole.absellipse(0,0,w/2-.14,d/2-.14,0,Math.PI*2,true);shape.holes.push(hole);const o=mesh(c,new T.ExtrudeGeometry(shape,{depth:.5,bevelEnabled:true,bevelSegments:2,bevelSize:.03,bevelThickness:.025,curveSegments:32}),'cream',0,.12,0);o.rotation.x=-Math.PI/2;const water=mesh(c,new T.CircleGeometry(1,40),'water',0,.36,0);water.rotation.x=-Math.PI/2;water.scale.set(w/2-.15,d/2-.15,1);rod(c,[0,0,-d/2-.1],[0,.8,-d/2-.1],.025,'metal');rod(c,[0,.8,-d/2-.1],[0,.8,-d/2+.12],.025,'metal');}
  else if(k==='toilet'){c.rotation.y=-Math.PI/2;box(c,0,.57,-.34,.52,.88,.24,'cream',.06);ball(c,0,.26,.05,.27,.23,.36,'cream');const seat=ring(c,0,.47,.07,.22,.045,'cream',true);seat.scale.y=1.3;}
  else if(k==='laundry'){box(c,0,.45,0,w,.9,d,'cream',.025);const p=ring(c,w/2+.01,.44,0,.24,.04,'metal');p.rotation.y=Math.PI/2;const glass=cyl(c,w/2+.015,.44,0,.2,.025,'dark');glass.rotation.z=Math.PI/2;}
  else if(k==='shelf'||k==='tools'){const fx=f.facing?.[0];const a=w<d?d:w,b=w<d?w:d;c.rotation.y=w<d?(fx===1?-Math.PI/2:Math.PI/2):Math.PI;box(c,0,1.05,b/2-.03,a,2.1,.06,'wood');for(const xx of [-a/2+.025,a/2-.025])box(c,xx,1.05,0,.05,2.1,b,'wood');for(let j=0;j<5;j++){box(c,0,.12+j*.47,0,a,.055,b,'wood');if(k==='shelf'&&f.id!=='bath_shelf'&&f.id!=='leather')for(let i=0;i<Math.min(14,a/.14);i++)box(c,-a/2+.12+i*.16,.29+j*.47,0,.1,.28+(i%3)*.035,b*.65,['cream','pink','mint'][i%3]);}
   if(f.id==='bath_shelf')for(let j=0;j<4;j++)for(let i=0;i<3;i++)box(c,0,.24+j*.47+i*.055,0,a*.72,.045,b*.8,i%2?'blue':'cream',.015); if(f.id==='leather')for(let i=0;i<9;i++){const roll=cyl(c,-a/2+.2+i*.36,.43,0,.11,.48,i%2?'pink':'edge');roll.rotation.x=Math.PI/2;} if(k==='tools')for(let i=0;i<5;i++){const a=-1+i*.45;ring(c,a,1.7,-b/2-.02,.12,.027,i%2?'pink':'edge');box(c,a,1.08,-b/2-.03,.045,.85,.025,i%2?'pink':'edge');ring(c,a,.65,-b/2-.04,.036,.01,'metal');}
  }else{const h=k==='wardrobe'?2.35:(f.height||.8);box(c,0,h/2,0,w,h,d,'wood',.018);if(k==='wardrobe'){for(const zz of [-d*.25,d*.25]){box(c,-w/2-.015,h/2,zz,.025,h-.1,d*.47,'cream',.01);box(c,-w/2-.04,1.15,zz+.14,.035,.2,.035,'metal');}}
   if(k==='basin'){box(c,0,.84,0,w,.07,d,'cream',.02);ball(c,0,.88,0,.3,.03,.19,'water');rod(c,[0,.84,-.2],[0,1.15,-.2],.016,'metal');box(c,0,1.62,-d/2+.01,w*.7,.85,.035,'blue',.02);}
  }
  return c;
 }
 L.furniture.forEach(f=>asset(f,main));L.basement.furniture.forEach(f=>asset(f,basement,-3.15));
 box(main,10.75,.012,3.6,4.15,.02,3.5,'cream',.03,'LivingRug');box(main,18.15,.012,2.25,3.6,.02,3.7,'pink',.02,'BedroomRug');
 // Living plants now use shaped botanical meshes in the independent asset pack.
 for(const [x,z,m] of [[3.0,4.98,'pink'],[18.15,3.7,'pink'],[10.2,11,'cream']]){rod(main,[x,2.9,z],[x,2.55,z],.012,'metal');const lamp=mesh(main,new T.ConeGeometry(.3,.22,24,1,true),'wood',x,2.48,z);roofs.push(lamp);}
 for(const r of L.rooms.filter(r=>r.id!=='office')){const [x,z,w,d]=r.box;const p=text(main,`${r.name} ${w}×${d}m`,x+w/2,.03,z+d-.35,Math.min(w*.8,2.7));p.rotation.x=-Math.PI/2;labels.push(p);}

 // Articulated scale figures: basic procedural poses, not final characters or IK.
 function figure(color,height){const g=new T.Group();g.name=`ScaleFigure_${height}m`;people.add(g);const mat=new T.MeshStandardMaterial({color,roughness:.85});const torso=box(g,0,1.22,0,.36,.48,.23,mat,.05);const head=ball(g,0,1.63,0,.13,.16,.13,'cream');const joints=[];
  for(let i=0;i<8;i++)joints.push(cyl(g,0,0,0,i<4?.055:.072,1,mat));
  const tag=text(g,`临时 ${height.toFixed(2)}m`,0,1.97,0,.85);g.scale.setScalar(height/1.8);
  const segment=(o,a,b)=>{const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);o.position.copy(p.add(q).multiplyScalar(.5));o.scale.y=v.length();o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());};
  function pose(t,sit=0,reach=0){const hip=.96-.38*sit,shoulder=hip+.42;torso.position.y=hip+.23;head.position.y=hip+.67;tag.position.y=hip+1.0;let idx=0;
   for(const sign of [-1,1]){const sh=[sign*.23,shoulder,0],el=[sign*.26,shoulder-.27,-reach*.16],hand=[sign*.24,shoulder-.5+reach*.25,-reach*.46];segment(joints[idx++],sh,el);segment(joints[idx++],el,hand);}
   for(const sign of [-1,1]){const h=[sign*.11,hip,0],k=[sign*.12,.52,-.39*sit],foot=[sign*.12,.09,-.43*sit];segment(joints[idx++],h,k);segment(joints[idx++],k,foot);}
  }pose(0);return {g,pose};
 }
 const avatars=[figure('#a7bec8',1.8),figure('#d9b1ba',1.65)];let preset='off',poseT=0;
 const presets={kitchen:[[2.05,1.38,0,0,1],[3.55,1.38,0,0,1]],living:[[10.1,4.52,0,1,0],[11.4,4.52,0,1,0]],dining:[[3,4.06,Math.PI,1,0],[3,5.89,0,1,0]]};
 function setPeople(value){preset=value;poseT=0;people.visible=value!=='off';const p=presets[value];if(p)avatars.forEach((a,i)=>{a.g.position.set(p[i][0],0,p[i][1]);a.g.rotation.y=p[i][2];a.pose(0,p[i][3],p[i][4]);});}
 function update(dt){poseT+=dt;const p=presets[preset];if(p)avatars.forEach((a,i)=>a.pose(poseT,p[i][3],p[i][4]*(.85+.15*Math.sin(poseT*1.2))));}
 function reviewMode(mode){main.visible=mode!=='basement';basement.visible=mode==='basement'||mode==='walk';stairs.visible=true;people.visible=preset!=='off'&&mode!=='basement';roofs.forEach(o=>o.visible=mode==='walk');labels.forEach(o=>o.visible=mode==='main');wallMeshes.forEach(({mesh,base,height})=>{const h=mode==='walk'?height:Math.min(.6,height);mesh.scale.y=h/height;mesh.position.y=base+h/2;});windows.forEach(o=>o.visible=mode==='walk');}
 setPeople('off');return {root,main,basement,stairs,assets,avatars,people,reviewMode,setPeople,update,roofs,wallMeshes};
}



