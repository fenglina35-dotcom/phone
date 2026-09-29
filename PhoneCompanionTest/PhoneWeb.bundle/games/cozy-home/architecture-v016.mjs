import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Copy the approved living-room asset, including its continuous folds and heading.
export function reuseOfficeCurtains(house,target){
 const source=house.main.getObjectByName('curtain_right');if(!source)throw Error('Missing approved living curtain asset');
 for(const o of [...target.children])if(o.name!=='Deep oak window sill')o.removeFromParent();
 source.updateMatrixWorld(true);const copy=source.clone(true);copy.position.set(0,0,0);copy.quaternion.identity();copy.scale.set(1,1,1);
 // Retain the source's authored transform by baking it into a wrapper first.
 source.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale);
 const wrap=new T.Group();wrap.add(copy);wrap.updateMatrixWorld(true);
 const b=new T.Box3().setFromObject(wrap),s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
 copy.position.sub(new T.Vector3(c.x,b.min.y,c.z));
 wrap.scale.set(3.98/s.x,2.72/s.y,1);wrap.rotation.y=Math.PI;wrap.position.set(0,.035,-.13);
 wrap.name='Living room curtain asset reused in office';wrap.userData.reusedFrom='curtain_right';
 wrap.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.castShadow=o.receiveShadow=true;}});target.add(wrap);
 target.userData.curtainReuse={source:'curtain_right',targetWidth:3.98,targetHeight:2.72};
}

export function finishArchitecture(house,world,L){
 const cream=house.bedroom.materials['warm cream'];
 const edge=new T.MeshStandardMaterial({name:'Connected honey oak architectural trim',color:'#ad825e',roughness:.82});
 const plaster=new T.MeshStandardMaterial({name:'Continuous warm plaster envelope',color:'#f8eddf',roughness:.91});
 const roofGroups=[],doors=[],seals=[],audit=[];
 const box=(parent,name,p,s,m,r=0)=>{const o=new T.Mesh(r?new RoundedBoxGeometry(...s,2,r):new T.BoxGeometry(...s),m);o.name=name;o.position.fromArray(p);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const roof=(parent,name,p,s,m=cream)=>{const o=box(parent,name,p,s,m);house.roofs.push(o);seals.push({name,p,s});return o;};
 function boardCeiling(parent,name,b,y){
  const g=new T.Group();g.name=name;parent.add(g);const[x,z,w,d]=b,geos=[];
  // Same 287 mm white tongue-and-groove boards and 4 mm joints as the bedroom.
  for(let t=0;t<d;t+=.291){const depth=Math.min(.287,d-t),geo=new T.BoxGeometry(w,.008,depth);geo.translate(x+w/2,y,z+t+depth/2);geos.push(geo);}
  const o=new T.Mesh(mergeGeometries(geos,false),cream);o.name='Bedroom white tongue and groove finish reused';o.receiveShadow=true;g.add(o);geos.forEach(x=>x.dispose());house.roofs.push(g);roofGroups.push(g);
 }
 for(const r of L.rooms.filter(r=>r.id!=='bedroom')){const[x,z,w,d]=r.box;boardCeiling(house.main,r.id+' shared bedroom ceiling',[x+.04,z+.04,w-.08,d-.08],2.894);}
 boardCeiling(house.main,'Stair upper landing shared ceiling',[14.6,14.2,2.8,1.6],2.894);
 roof(house.main,'Sealed roof above complete stairwell',[16,2.97,11.8],[2.85,.14,4.85]);
 boardCeiling(house.main,'Stairwell shared bedroom ceiling',[14.6,9.4,2.8,4.8],2.894);
 boardCeiling(house.basement,'Workshop east shared ceiling',[17.4,9.4,4.4,8.4],-.166);
 boardCeiling(house.basement,'Workshop west shared ceiling',[14.6,14.2,2.8,3.6],-.166);
 boardCeiling(house.basement,'Plush enclosure shared ceiling',[17.51,9.51,4.18,2.68],-.554);
 // A continuous opaque wall head closes the 90 mm basement wall/ceiling joint.
 for(const [x,z,u,v]of L.basement.walls){const h=z===v,w=h?Math.abs(u-x)+.04:.17,d=h?.17:Math.abs(v-z)+.04;roof(house.basement,'Sealed basement perimeter joint',[(x+u)/2,-.15,(z+v)/2],[w,.32,d],plaster);}
 // These three boundaries pass through the open stair void; bridge the floor-level seam.
 for(const[p,s]of [[[16,-.12,9.4],[2.85,.40,.17]],[[14.6,-.12,11.8],[.17,.40,4.85]],[[17.4,-.12,11.8],[.17,.40,4.85]]])roof(house.stairs.parent,'Sealed stair wall floor-level seam',p,s,plaster);
 // Continue the brown upper trim across every doorway, without putting a beam in the opening.
 for(const d of L.doors){const h=d.a[1]===d.b[1],len=Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1]),p=[(d.a[0]+d.b[0])/2,2.82,(d.a[1]+d.b[1])/2];
  roof(house.main,d.id+' continuous door cornice',p,[h?len+.18:.19,.10,h?.19:len+.18],edge);
  for(const a of[d.a,d.b])box(house.main,d.id+' joined casing return',[a[0],2.255,a[1]],[.115,.07,.115],edge,.003);
 }
 // Match the living-room board scale and world-space phase all the way to the first stair.
 const floor=house.main.getObjectByName('Living oak floor finish');if(!floor)throw Error('Missing finished oak floor');
 for(const b of [[12.8,7.4,1.8,8.4],[14.6,14.2,2.8,1.6],[16.15,12.94,1.1,1.26]]){
  const[x,z,w,d]=b,m=floor.material.clone();m.map=floor.material.map.clone();m.map.repeat.set(1,1);m.map.offset.set(0,0);
  const geo=new T.PlaneGeometry(w,d),uv=geo.attributes.uv,pos=geo.attributes.position;
  for(let i=0;i<uv.count;i++){const wx=x+w/2+pos.getX(i),wz=z+d/2-pos.getY(i);uv.setXY(i,(wx-6.68)/2.01,(7.32-wz)/1.98);}
  const o=new T.Mesh(geo,m);o.name='Continuous matching oak corridor floor';o.rotation.x=-Math.PI/2;o.position.set(x+w/2,.0022,z+d/2);o.receiveShadow=true;house.main.add(o);
 }
 const entrance=house.entranceDetail;if(!entrance)throw Error('Missing reusable entrance door');
 for(const d of L.doors.filter(d=>d.id!=='entry')){
  const h=d.a[1]===d.b[1],span=Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1]),width=span-.10;
  const pivot=new T.Group();pivot.name=d.id+' automatic door hinge';pivot.position.set(d.a[0]+(h?.05:0),0,d.a[1]+(h?0:.05));const closedYaw=h?0:-Math.PI/2;pivot.rotation.y=closedYaw;house.main.add(pivot);
  const leaf=entrance.clone(true);leaf.name=d.id+' reused detailed entrance leaf';leaf.position.set(width/2,0,0);leaf.quaternion.identity();leaf.scale.set(width/1.4,.975,1);
  for(const o of [...leaf.children])if(/Door frame moulding|Upper moulding|Threshold/.test(o.name))o.removeFromParent();
  // The same joinery is visible from either side of an internal door.
  const rear=new T.Group();rear.name='Matching reverse door panels';
  for(const o of [...leaf.children])if(!/solid slab|Door hinge/.test(o.name)){const c=o.clone();c.position.z=-c.position.z;c.rotation.y+=Math.PI;rear.add(c);}leaf.add(rear);pivot.add(leaf);
  const id='automatic door '+d.id;world.colliders.push({id,x:0,z:0,w:.01,d:.01,base:0,height:2.18,kind:'door'});
  doors.push({id,room:d.id,pivot,width,closedYaw,angle:0,open:false,center:[(d.a[0]+d.b[0])/2,(d.a[1]+d.b[1])/2],sign:1,manual:['office','stairs'].includes(d.id)});
 }
 function syncCollider(d){const a=d.closedYaw+d.angle,c=Math.cos(a),s=-Math.sin(a),x=d.pivot.position.x,z=d.pivot.position.z;
  const current=world.colliders.find(o=>o.id===d.id);if(current)Object.assign(current,{x:Math.min(x,x+c*d.width)-.055,z:Math.min(z,z+s*d.width)-.055,w:Math.abs(c*d.width)+.11,d:Math.abs(s*d.width)+.11});
 }
 function chooseSide(d,p){const side=Math.sin(d.closedYaw)*(p.x-d.center[0])+Math.cos(d.closedYaw)*(p.z-d.center[1]);d.sign=side>=0?1:-1;}
 const office=doors.find(d=>d.room==='office');
 const api={doors,seals,roofGroups,audit,nearStairs:p=>p.y>-.55&&Math.hypot(p.x-16.7,p.z-14.2)<1.65,toggleStairs(p){const d=doors.find(d=>d.room==='stairs');if(!d.open&&Math.abs(d.angle)<.02)chooseSide(d,p);if(d.open&&Math.hypot(p.x-d.center[0],p.z-d.center[1])<.42)return {message:'请稍离门口再关门'};d.open=!d.open;return {message:d.open?'地下室入口门打开':'地下室入口门关闭'};},nearOffice:p=>p.y>-.55&&Math.hypot(p.x-office.center[0],p.z-office.center[1])<1.65,toggleOffice(p){if(!office.open){if(Math.abs(office.angle)<.02)chooseSide(office,p);}else if(Math.hypot(p.x-office.center[0],p.z-office.center[1])<.42)return {changed:false,message:'请稍离门口再关门'};office.open=!office.open;return {changed:true,message:office.open?'书房门打开':'书房门关闭'};},update(dt,p){let changed=false;
  for(const d of doors){const dist=Math.hypot(p.x-d.center[0],p.z-d.center[1]),vertical=p.y>-.55;
   if(!d.manual&&!d.npcHold){const dx=p.x-d.center[0],dz=p.z-d.center[1],across=Math.cos(d.closedYaw)*dx-Math.sin(d.closedYaw)*dz,normal=Math.sin(d.closedYaw)*dx+Math.cos(d.closedYaw)*dz;const centered=Math.abs(across)<Math.min(.38,d.width*.30);if(vertical&&centered&&Math.abs(normal)<1.45){if(!d.open&&Math.abs(d.angle)<.02)chooseSide(d,p);d.open=true;}else if(!vertical||dist>2.2||(Math.abs(normal)>.60&&Math.abs(across)>.65))d.open=false;}
   const target=d.open?d.sign*Math.PI/2:0,previous=d.angle;d.angle=T.MathUtils.damp(d.angle,target,7,dt);if(Math.abs(target-d.angle)<.0002)d.angle=target;
   d.pivot.rotation.y=d.closedYaw+d.angle;syncCollider(d);if(Math.abs(previous-d.angle)>.00001)changed=true;
  }return changed;
 },state:()=>({exitLocked:true,doors:doors.map(d=>({id:d.room,manual:d.manual,open:d.open,angle:d.angle,center:d.center})),sealedJoints:seals.length,sharedCeilings:roofGroups.length})};
 doors.forEach(syncCollider);house.architecture=api;return api;
}

export function bindOfficeLighting(house,scene,lighting){
 const lights=[];
 const rect=(n,p,target,color,intensity,w,h)=>{const l=new T.RectAreaLight(color,intensity,w,h);l.name=n;l.position.fromArray(p);l.lookAt(...target);scene.add(l);lights.push(l);return l;};
 const windowFill=rect('Office broad soft window bounce',[10,2.05,15.40],[10,1.15,12.35],'#e9e8db',2.1,3.1,1.6);
 const overhead=rect('Office ceiling diffuse bounce',[10.35,2.74,12.35],[10.35,.5,12.35],'#ffe5bc',1.8,3.0,2.5);
 const task=new T.SpotLight('#ffe3ae',2.1,3.1,Math.PI/3,.85,2);task.name='Office desk shade practical light';
 const p=house.main.getObjectByName('executive_desk').localToWorld(new T.Vector3(-.946,1.121,-.163));task.position.copy(p);task.target.position.set(10.50,.765,12.75);task.castShadow=true;task.shadow.mapSize.set(1024,1024);task.shadow.normalBias=.01;scene.add(task,task.target);lights.push(task);
 const library=rect('Office bookcase reflected warm fill',[8.35,2.32,11.80],[7.46,1.3,11.80],'#ffdfb5',1.1,2.8,.55);
 const old=lighting.setMode.bind(lighting);lighting.setMode=mode=>{const result=old(mode),night=mode==='evening';windowFill.intensity=night?.42:2.1;overhead.intensity=night?2.8:1.8;task.intensity=night?3.3:2.1;library.intensity=night?1.45:1.1;return result;};lighting.setMode(lighting.state().mode);
 house.office.lighting=lights.map(o=>({name:o.name,position:o.position.toArray()}));
}
