import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function refineEntrance(house){
 const old=house.main.getObjectByName('ClosedEntrance');if(!old)return;
 const oak=old.material.clone();oak.name='010 entrance warm oak';oak.color.set('#9f7956');oak.roughness=.74;
 old.removeFromParent();for(const o of [...house.main.children])if(o.isMesh&&Math.abs(o.position.x-11.22)<.005&&Math.abs(o.position.y-1.04)<.005&&Math.abs(o.position.z-7.32)<.005)o.removeFromParent();
 const root=new T.Group();root.name='Detailed closed entrance 010';root.position.set(10.7,0,7.4);house.main.add(root);
 const recess=new T.MeshStandardMaterial({color:'#614b3c',roughness:.88,name:'010 door recessed joint'}),wood=oak.clone();wood.color.set('#ad8864');
 const metal=new T.MeshStandardMaterial({name:'010 satin door hardware',color:'#aaa59a',metalness:.72,roughness:.26});
 function box(name,p,s,m,r=.004){const o=new T.Mesh(new RoundedBoxGeometry(...s,2,Math.min(r,...s.map(x=>x*.3))),m);o.name=name;o.position.fromArray(p);o.castShadow=o.receiveShadow=true;root.add(o);return o;}
 function cyl(name,p,r,h,m){const o=new T.Mesh(new T.CylinderGeometry(r,r,h,32),m);o.name=name;o.position.fromArray(p);o.rotation.x=Math.PI/2;o.castShadow=o.receiveShadow=true;root.add(o);return o;}
 box('Closed door solid slab',[0,1.12,0],[1.40,2.24,.08],oak,.008);
 for(const x of [-.70,.70])box('Door frame moulding',[x,1.12,-.047],[.075,2.24,.038],wood,.006);
 box('Upper moulding',[0,2.20,-.047],[1.40,.065,.038],wood,.006);
 box('Inset shadow bed',[-.04,1.20,-.044],[1.03,1.83,.012],recess,.004);
 for(let i=0;i<5;i++)box('Inset oak panel '+i,[-.04,.478+i*.359,-.052],[1.018,.352,.018],wood,.006);
 for(const x of [-.572,.492])box('Panel bevel stile',[x,1.20,-.056],[.042,1.88,.033],oak,.006);
 for(const y of [.273,2.124])box('Panel bevel rail',[-.04,y,-.056],[1.10,.042,.033],oak,.006);
 cyl('Peephole rim',[0,1.55,-.081],.014,.024,metal);cyl('Peephole lens',[0,1.55,-.095],.006,.004,recess);
 cyl('Handle rose',[.535,1.02,-.065],.037,.04,metal);cyl('Handle spindle',[.535,1.02,-.108],.013,.058,metal);
 box('Rounded lever grip',[.468,1.02,-.139],[.16,.024,.025],metal,.01);
 cyl('Lock escutcheon',[.535,.916,-.065],.029,.025,metal);box('Keyhole',[.535,.916,-.080],[.005,.018,.003],recess,.001);
 for(const y of [.36,1.85])box('Door hinge',[-.674,y,-.045],[.029,.095,.035],metal,.003);
 box('Threshold',[0,.009,-.027],[1.40,.018,.095],oak,.005);
 house.entranceDetail=root;
}
