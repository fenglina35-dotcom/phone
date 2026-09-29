import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export const timber=new T.MeshStandardMaterial({name:'020 drawer inner birch',color:'#d9c9b0',roughness:.79});
const steel=new T.MeshStandardMaterial({name:'020 satin hardware',color:'#a7afaf',metalness:.65,roughness:.36});
export function block(g,n,p,s,m=timber){const o=new T.Mesh(new RoundedBoxGeometry(...s,2,Math.min(.004,...s.map(x=>x*.20))),m);o.name=n;o.position.fromArray(p);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
export function collect(root,test){const a=[];root.traverse(o=>{if(o.isMesh&&test(o))a.push(o)});return a;}
export function moving(root,label,parts,pivot,kind,travel){
 if(parts.some(o=>{for(let p=o.parent;p&&p!==root;p=p.parent)if(p.userData.mechanism018)return true;return false;}))throw Error('Moving part already owned: '+label);
 const g=new T.Group();g.name=label;g.position.fromArray(pivot);root.add(g);root.updateWorldMatrix(true,true);g.userData.partNames020=parts.map(o=>o.name);g.userData.partIds020=parts.map(o=>o.uuid);for(const o of parts)g.attach(o);g.userData.mechanism018={label,kind,travel,rest:g.position.toArray(),open:false};return g;
}
export function drawerBox(g,w,h,d){block(g,'Real drawer floor',[0,-h/2+.012,-d/2],[w,.014,d]);for(const x of[-w/2+.008,w/2-.008])block(g,'Drawer fitted side',[x,0,-d/2],[.016,h,d]);block(g,'Drawer rear',[0,0,-d+.01],[w,h,.02]);for(const x of[-w/2,w/2])block(g,'Drawer slide rail',[x,-.01,-d/2],[.009,.012,d*.9],steel);}
function solidDrawer(root,body,knobs,label){body.geometry.computeBoundingBox();const sz=body.geometry.boundingBox.getSize(new T.Vector3()),p=body.position.clone(),mat=body.material,front=p.z+sz.z/2;
 body.removeFromParent();const panel=block(root,label+' front',[p.x,p.y,front],[sz.x,sz.y,.024],mat),g=moving(root,label,[panel,...knobs],[p.x,p.y,front],'slide',Math.min(.32,sz.z*.72));drawerBox(g,sz.x-.028,sz.y-.018,sz.z-.03);return g;
}
export function bedroomMechanisms020(house,roots,slider){
 const get=n=>roots.find(r=>r.name===n),side=get('bedside'),vanity=get('vanity'),desk=get('bed_desk'),ward=get('wardrobe');
 solidDrawer(side,side.getObjectByName('Bedside drawer'),collect(side,o=>o.name==='Drawer small knob'),'床头柜抽屉');
 for(const body of collect(vanity,o=>o.name==='Vanity drawer'))solidDrawer(vanity,body,collect(vanity,o=>o.parent===vanity&&o.name==='Vanity knob'&&Math.abs(o.position.x-body.position.x)<.1),body.position.x<0?'梳妆台左抽屉':'梳妆台右抽屉');
 for(const body of collect(desk,o=>o.name==='Desk drawer carcass')){const y=body.position.y;body.removeFromParent();const front=collect(desk,o=>o.parent===desk&&/Desk pink drawer|Desk drawer knob/.test(o.name)&&Math.abs(o.position.y-y)<.04);const g=moving(desk,'电脑桌'+(y<.6?'下':'上')+'抽屉',front,[.53,y,.285],'slide',.29);drawerBox(g,.34,.065,.46);}
 const south=get('bedroom_south_cabinet'),c=south.getObjectByName('Cabinet case'),m=c.material;c.removeFromParent();for(const x of[-.56,.56])block(south,'Cabinet hollow side',[x,.38,0],[.028,.59,.39],m);for(const y of[.095,.365,.67])block(south,'Cabinet inner shelf',[0,y,0],[1.11,.023,.37],m);block(south,'Cabinet back',[0,.38,-.183],[1.10,.58,.023],m);
 for(const x of[-.285,.285]){const selected=collect(south,o=>o.parent===south&&/Inset cabinet door|Door panel stile|Door panel rail|Cabinet porcelain knob/.test(o.name)&&(o.name.includes('knob')?Math.sign(o.position.x)===Math.sign(x):Math.abs(o.position.x-x)<.27));moving(south,x<0?'卧室矮柜左门':'卧室矮柜右门',selected,[x+(x<0?-.266:.266),.39,.204],'hinge',x<0?-1.35:1.35);}
 // Both wardrobe leaves retain independent tracks and mechanisms; no second animator.
 slider.name='衣柜左横推门';slider.userData.mechanism018={label:slider.name,kind:'slideX',travel:.985,rest:slider.position.toArray(),open:false};
 const right=collect(ward,o=>o.parent===ward&&/Cream wardrobe sliding panel|Wardrobe recessed panel|Wardrobe handle/.test(o.name));moving(ward,'衣柜右横推门',right,[.527,0,.299],'slideX',-.985);
 block(south,'Folded storage linen',[.25,.405,0],[.35,.06,.25],house.bedroom?.materials?.['cotton white']||timber);
}
export function bathroomMechanisms020(house,roots){
 const get=n=>roots.find(r=>r.name===n),basin=get('basin'),storage=get('bath_shelf'),laundry=get('laundry');
 const mirror=new T.Group();mirror.name='bathroom_fixed_mirror';house.main.add(mirror);roots.push(mirror);house.root.updateMatrixWorld(true);
 const mirrorParts=collect(basin,o=>/Mirror frame|Vanity mirror inset|Round opal mirror light/.test(o.name));for(const o of mirrorParts)mirror.attach(o);for(const o of basin.children)o.position.z+=.16;
 for(const [root,name,points,radius]of[[basin,'Curved brass basin spout',[[0,.896,-.28],[0,1.105,-.28],[0,1.15,-.22],[0,1.11,-.10]],.012],[get('tub'),'Sweeping bath mixer spout',[[.72,.023,-.53],[.72,.73,-.53],[.71,.81,-.48],[.66,.82,-.35],[.63,.77,-.28]],.015]]){const o=root.getObjectByName(name);o.geometry=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),72,radius,12,false);}
 for(const x of[-.30,.30]){const selected=collect(basin,o=>o.parent===basin&&/Louver door|Angled cabinet louver|Brass cabinet knob/.test(o.name)&&(o.name.includes('knob')?Math.sign(o.position.x)===Math.sign(x):Math.abs(o.position.x-x)<.29));moving(basin,x<0?'洗手柜左门':'洗手柜右门',selected,[x+(x<0?-.274:.274),.56,.445],'hinge',x<0?-1.32:1.32);}
 for(const y of[1.63,.95]){const selected=collect(storage,o=>o.parent===storage&&/Linen cabinet paneled door|Door recessed field|Vertical brass cabinet handle/.test(o.name)&&Math.abs(o.position.y-y)<.12);moving(storage,y>1?'浴室储物柜上门':'浴室储物柜下门',selected,[-.316,y,.21],'hinge',-1.32);}
 // Cut a real circular aperture in the washer front instead of a glass disk on a solid cube.
 const body=laundry.getObjectByName('Washing machine rounded cabinet'),mat=body.material;body.removeFromParent();for(const x of[-.326,.326])block(laundry,'Washer hollow side',[x,.445,0],[.027,.85,.66],mat);for(const y of[.028,.852])block(laundry,'Washer hollow cap',[0,y,0],[.65,.027,.66],mat);block(laundry,'Washer rear casing',[0,.445,-.314],[.65,.83,.032],mat);
 const shape=new T.Shape();shape.moveTo(-.34,.02);shape.lineTo(.34,.02);shape.lineTo(.34,.87);shape.lineTo(-.34,.87);shape.closePath();const hole=new T.Path();hole.absarc(0,.435,.214,0,Math.PI*2,true);shape.holes.push(hole);const trayHole=new T.Path();trayHole.moveTo(-.315,.730);trayHole.lineTo(-.315,.823);trayHole.lineTo(-.095,.823);trayHole.lineTo(-.095,.730);trayHole.closePath();shape.holes.push(trayHole);const panel=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:false,curveSegments:48}),mat);panel.position.z=.31;panel.name='Washer front with open circular aperture';panel.castShadow=panel.receiveShadow=true;laundry.add(panel);
 laundry.getObjectByName('Recessed washer drum')?.removeFromParent();const drumMat=steel.clone();drumMat.color.set('#7e9195');drumMat.side=T.DoubleSide;const drum=new T.Mesh(new T.CylinderGeometry(.202,.202,.43,48,1,true),drumMat);drum.rotation.x=Math.PI/2;drum.position.set(0,.435,.10);drum.name='Open stainless steel washer drum';laundry.add(drum);const back=new T.Mesh(new T.CircleGeometry(.202,48),drumMat);back.position.set(0,.435,-.115);back.name='Washer recessed drum back';laundry.add(back);
 for(let j=0;j<30;j++){const a=j*Math.PI*2/30;const hole=new T.Mesh(new T.CircleGeometry(.007,8),new T.MeshStandardMaterial({color:'#394c51',roughness:.7}));hole.position.set(Math.cos(a)*.165,.435+Math.sin(a)*.165,-.113);hole.name='Drum perforation';laundry.add(hole);}
 moving(laundry,'洗衣机圆门',collect(laundry,o=>/Moulded washer door rim|Domed washer door glass|Washer recessed door handle/.test(o.name)),[-.25,.435,.375],'hinge',-1.55);
 const drawer=laundry.getObjectByName('Detergent drawer');const g=moving(laundry,'洗衣机洗涤剂抽屉',[drawer],[-.205,.777,.337],'slide',.16);drawerBox(g,.196,.065,.23);
 const toilet=get('toilet');toilet.getObjectByName('Toilet water recess')?.removeFromParent();
 house.bathStructure020={mirror,basin,mirrorShift:0,basinShift:.16};
}
export function protectMovingBatch020(root,batch){const parts=[];root.traverse(o=>{if(o.userData.mechanism018)parts.push({o,p:o.parent})});for(const {o}of parts)o.removeFromParent();batch(root);for(const {o,p}of parts){p.add(o);batch(o);}}
