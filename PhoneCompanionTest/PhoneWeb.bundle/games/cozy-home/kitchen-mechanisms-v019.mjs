import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const inside=new T.MeshStandardMaterial({name:'019 cabinet birch interior',color:'#d6c7ae',roughness:.78});
const rail=new T.MeshStandardMaterial({name:'019 satin drawer runners',color:'#999f9d',roughness:.38,metalness:.65});
function box(p,n,x,y,z,w,h,d,m=inside){const o=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.005,w*.2,h*.2,d*.2)),m);o.name=n;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function take(root,label,objects,pivot,kind='hinge',travel=-1.3){const g=new T.Group();g.name=label;g.position.fromArray(pivot);root.add(g);root.updateWorldMatrix(true,true);for(const o of objects)g.attach(o);g.userData.mechanism018={label,kind,travel,rest:g.position.toArray(),open:false};return g;}
function drawer(g,w,h,d){box(g,'Drawer dovetailed floor',0,-h/2+.015,-d/2,w,.018,d);for(const x of[-w/2+.009,w/2-.009])box(g,'Drawer timber side',x,0,-d/2,.018,h,d);box(g,'Drawer rear panel',0,0,-d+.01,w,h,.02);for(const x of[-w/2,w/2])box(g,'Telescopic metal runner',x,-h*.15,-d*.48,.01,.016,d*.82,rail);}
function parts(root){const out=[];root.traverse(o=>{if(o.isMesh)out.push(o)});return out;}
export function baseMechanisms019(house,roots,m){
 const get=n=>roots.find(r=>r.name===n),upperDoors=[];let num=0;parts(get('dining_table')).filter(o=>o.name==='Cutlery').forEach(o=>o.removeFromParent());
 const towel=get('peninsula').getObjectByName('Folded tea towel');if(towel){const a=towel.geometry.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),y=a.getY(i);a.setY(i,Math.max(-.015,y+.0018*Math.sin(x*49+z*13)+.0012*Math.sin(z*71)));}towel.geometry.computeVertexNormals();towel.name='Soft folded woven tea towel';}
 // Framed fronts and the corresponding three-piece handles move together.
 for(const root of [get('counter'),get('peninsula'),get('kitchen_upper')]){
  const parents=[];root.traverse(g=>{if(g.isGroup)parents.push(g)});
  for(const parent of parents){const all=[...parent.children].filter(o=>o.isMesh);const anchors=all.filter(o=>/ inset$/.test(o.name)&&/^(Sink door|Drawer|End cabinet|Island panel|Cooking-side drawer|Upper door)/.test(o.name));const used=new Set();
   for(const a of anchors){a.geometry.computeBoundingBox();const size=a.geometry.boundingBox.getSize(new T.Vector3()),w=size.x+.055,h=size.y+.055,x=a.position.x,y=a.position.y,z=a.position.z;
    const selected=all.filter(o=>!used.has(o)&&(o.name.startsWith(a.name.replace(' inset',''))||/Handle mounting|Brushed handle/.test(o.name))&&Math.abs(o.position.x-x)<w/2+.012&&Math.abs(o.position.y-y)<h/2+.027&&Math.abs(o.position.z-z)<.1);selected.forEach(o=>used.add(o));
    const slide=/Drawer|drawer/.test(a.name),side=/right/.test(a.name)?1:-1;
    const label=(root.name==='peninsula'?'中岛':root.name==='kitchen_upper'?'吊柜':/Sink/.test(a.name)?'水槽柜':'料理台')+(slide?'抽屉':'柜门')+' '+(++num);
    const g=take(parent,label,selected,[slide?x:x+side*w/2,y,z],slide?'slide':'hinge',slide?(root.name==='peninsula'?.26:.38):side*1.30);
    if(slide)drawer(g,w-.06,h-.05,root.name==='peninsula'?.27:.51);
    else {for(const yy of[-h*.32,h*.32])box(g,'Concealed cabinet hinge',0,yy,-.015,.028,.035,.03,rail);}
   }
  }
 }
 // Glass display fronts must carry both their timber frame and their glazing.
 const upper=get('kitchen_upper');for(const [i,x]of[3.12,4.02].entries()){
  const selected=parts(upper).filter(o=>o.parent===upper&&/Display frame/.test(o.name)&&Math.abs(o.position.x-x)<.46);
  const g=take(upper,'玻璃吊柜 '+(i+1),selected,[x,2.515,.485],'hingeX',-1.38);upperDoors.push(g);
 }
 // Drawer runners replace the fixed mid-shelf crossing the middle drawer box.
 const counter=get('counter');parts(counter).filter(o=>o.name==='Actual shelf'&&o.position.x>2.4&&o.position.x<5&&Math.abs(o.position.y-.47)<.01).forEach(o=>o.removeFromParent());
 for(const [x,w]of[[2.87,.92],[3.83,.92],[4.63,.64]])for(const y of[.145,.338,.592])box(counter,'Drawer cabinet divider',x,y,.50,w-.08,.018,.54);
 // Real oven cavity; glass, seal and handle all rotate about the lower edge.
 const stove=get('kitchen_stove');stove.getObjectByName('Oven insulated cabinet')?.removeFromParent();
 for(const x of[4.985,5.615])box(stove,'Oven insulated side',x,.45,.52,.05,.84,.63,m['brushed nickel']);box(stove,'Oven rear',5.3,.45,.225,.62,.82,.04,m['warm charcoal']);for(const y of[.12,.72])box(stove,'Oven inner roof and floor',5.3,y,.53,.60,.025,.58,m['warm charcoal']);
 const ov=parts(stove).filter(o=>/Oven door seal|Oven glass|Handle mounting|Brushed handle/.test(o.name));take(stove,'烤箱门',ov,[5.3,.12,.86],'hingeX',Math.PI/2*.94);
 for(let j=0;j<9;j++)box(stove,'Oven wire rack',5.07+j*.057,.35,.53,.005,.005,.49,rail);for(const z of[.285,.775])box(stove,'Oven rack crossbar',5.3,.35,z,.50,.006,.006,rail);
 // Replace the previous full-height door, preserving the body and its food.
 const fridge=house.assets.get('fridge'),old=fridge.fridgeDoor;old.removeFromParent();
 const doors=[];for(const [i,y,h]of[[0,1.742,.704],[1,.724,1.302]]){
  const g=take(fridge,i===0?'冰箱上层冷冻门':'冰箱下层冷藏门',[],[-.41,0,.385],'hinge',-Math.PI*.48);doors.push(g);
  box(g,'Refrigerator continuous gasket',.41,y,-.018,.786,h-.036,.026,m['warm grey seams']);box(g,'Rounded enamel door',.41,y,.018,.815,h,.068,m['seafoam enamel']);
  const hy=i===0?1.48:1.24;for(const x of[.54,.74])box(g,'Door handle foot',x,hy,.084,.023,.025,.044,rail);box(g,'Refrigerator brushed handle',.64,hy,.110,.224,.025,.023,rail);
  for(const py of(i===0?[1.61]:[.25,.72])){box(g,'Removable door pocket bottom',.41,py,-.085,.65,.022,.13,m['glazed porcelain']);box(g,'Door pocket retaining lip',.41,py+.058,-.146,.65,.11,.015,m['glazed porcelain']);for(const x of[.093,.727])box(g,'Pocket side',x,py+.057,-.085,.014,.11,.13,m['glazed porcelain']);}
  if(i===0){box(g,'Small shopping note',.24,1.89,.056,.11,.14,.003,m['painted cream']);}
 }
 fridge.fridgeDoor=doors[0];house.kitchenMechanisms019={upperDoors,fridgeDoors:doors};return doors[0];
}
export function detailMechanisms019(house,roots){
 const get=n=>roots.find(r=>r.name===n);
 const glass=get('kitchen_glass_doors_v002');for(const [i,x]of[3.12,4.02].entries()){const g=house.kitchenMechanisms019.upperDoors[i];house.root.updateMatrixWorld(true);for(const o of [...glass.children])if(Math.abs(o.position.x-x)<.43)g.attach(o);}
 for(const id of['kitchen_tv_cabinet_v002','kitchen_drawer_chest_v002']){
  const root=get(id),all=parts(root),boxes=all.filter(o=>o.name==='Drawer box');for(const [i,b]of boxes.entries()){
   b.geometry.computeBoundingBox();const s=b.geometry.boundingBox.getSize(new T.Vector3()),y=b.position.y,z=id==='kitchen_tv_cabinet_v002'?.244:.244;
   const selected=all.filter(o=>/Drawer front|knob/i.test(o.name)&&Math.abs(o.position.y-y)<.075);b.removeFromParent();const g=take(root,(id.includes('tv')?'餐厅电视柜':'餐厅斗柜')+'抽屉 '+(i+1),selected,[0,y,z],'slide',.30);drawer(g,s.x,.14,.37);
  }
 }
 // The sideboard beside the dining table uses overlapping horizontal doors.
 const side=get('sideboard'),old=parts(side),mat=old.find(o=>o.name==='Drawer front')?.material;
 old.filter(o=>/Drawer|knob/i.test(o.name)).forEach(o=>o.removeFromParent());
 for(const y of[.16,.46])box(side,'Sliding cupboard fixed shelf',0,y,0,1.01,.023,.40);
 for(const y of[.145,.73])for(const z of[.244,.277])box(side,'Parallel recessed sliding track',0,y,z,1.03,.012,.014,rail);
 for(const [i,x,z]of[[0,-.255,.244],[1,.255,.277]]){const g=take(side,'餐桌旁横推柜门 '+(i+1),[],[x,.439,z],'slideX',i===0?.49:-.49);box(g,'Sliding oak panel',0,0,0,.526,.565,.026,mat);const inset=new T.MeshStandardMaterial({name:'019 sideboard blue frosted inset',color:'#799aa5',roughness:.48});box(g,'Inset blue panel',0,0,.017,.41,.41,.008,inset);box(g,'Recessed finger pull',i===0?-.19:.19,0,.025,.027,.085,.015,rail);}
 const pantry=get('kitchen_pantry_v002');parts(pantry).filter(o=>/knob/i.test(o.name)).forEach(o=>o.removeFromParent());const all=parts(pantry),claimed=new Set();for(const x of[-.39,.39])for(const [y,h]of[[.91,1.53],[2.04,.64]]){
  const selected=all.filter(o=>!claimed.has(o)&&o.parent===pantry&&/Louver door|Angled louver|knob/i.test(o.name)&&Math.abs(o.position.x-x)<.385&&Math.abs(o.position.y-y)<h/2+.029);selected.forEach(o=>claimed.add(o));
  const g=take(pantry,'粉色餐椅后横推柜'+(x<0?'左':'右')+(y<1?'下门':'上门'),selected,[x,y,.25],'slideX',x<0?.745:-.745);box(g,'Recessed sliding finger grip',x<0?-.32:.32,0,.029,.020,.105,.004,rail);g.position.z+=x>0?.11:0;g.position.y+=y>1?.013:0;g.userData.mechanism018.rest=g.position.toArray();
 }
 for(const y of[.13,1.70,2.385])for(const z of[.27,.38])box(pantry,'Twin sliding pantry track',0,y,z,1.55,.012,.018,rail);
 const tiny=get('kitchen_countertop_oven_v002'),ta=parts(tiny),body=ta.find(o=>o.name==='Seafoam compact oven'),enamel=body.material;body.removeFromParent();
 for(const x of[-.249,.249])box(tiny,'Compact oven side',x,.20,0,.032,.35,.40,enamel);for(const y of[.038,.363])box(tiny,'Compact oven cap',0,y,0,.53,.027,.40,enamel);box(tiny,'Compact oven rear',0,.20,-.188,.50,.33,.024,enamel);
 take(tiny,'台面小烤箱门',ta.filter(o=>/Small oven front|Small oven dark window|Small oven handle/.test(o.name)),[0,.055,.213],'hingeX',1.4);
 for(let j=0;j<7;j++)box(tiny,'Compact oven wire shelf',-.18+j*.06,.13,0,.004,.004,.30,rail);
 // Delete only the extra upright Tea book above the small west-wall shelf.
 const books=get('kitchen_clock_shelf_v002');parts(books).filter(o=>/Book |Readable book/.test(o.name)&&o.position.y>1.74&&Math.abs(o.position.x+.13)<.04).forEach(o=>o.removeFromParent());
}
// Preserve dynamic groups while the existing module combines static geometry.
export function detachMechanisms019(root){const out=[];root.traverse(o=>{if(o.userData.mechanism018)out.push({o,parent:o.parent})});for(const a of out)a.o.removeFromParent();return()=>{for(const a of out)a.parent.add(a.o);};}

export function batchKitchenMechanisms019(house){
 const groups=[];house.root.traverse(g=>{if(g.userData.mechanism018){let p=g.parent,ok=false;while(p){if(/^(kitchen_|counter$|fridge$|peninsula$|sideboard$)/.test(p.name))ok=true;p=p.parent;}if(ok)groups.push(g)}});
 for(const root of groups){const meshes=parts(root),buckets=new Map();root.updateWorldMatrix(true,true);const inv=root.matrixWorld.clone().invert();
  for(const o of meshes){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(inv.clone().multiply(o.matrixWorld));g.clearGroups();for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);}
  root.userData.sourceParts=meshes.map(o=>o.name);meshes.forEach(o=>o.removeFromParent());for(const [m,list]of buckets){const geo=mergeGeometries(list,false);if(!geo)throw Error('019 moving cabinet batching failed');const o=new T.Mesh(geo,m);o.name='Moving '+m.name;o.castShadow=o.receiveShadow=true;root.add(o);list.forEach(g=>g.dispose());}
 }
}
