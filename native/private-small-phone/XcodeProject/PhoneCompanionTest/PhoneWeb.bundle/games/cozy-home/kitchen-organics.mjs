import * as T from 'three';

// Continuous surfaces: folds and cupped leaves are geometry, not stacked rods.
function surface(nu,nv,point){
 const p=[],uv=[],ix=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
  p.push(...point(i/nu,j/nv));uv.push(i/nu,j/nv);
  if(i<nu&&j<nv){const a=j*(nu+1)+i;ix.push(a,a+1,a+nu+1,a+1,a+nu+2,a+nu+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function add(parent,geometry,material,name){const m=new T.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function tube(parent,points,r,material,name){return add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(16,points.length*3),r,6,false),material,name);}
const doubleMaterials=new WeakMap();
const veinMaterials=new WeakMap();
function twoSided(m){if(!doubleMaterials.has(m)){const c=m.clone();c.side=T.DoubleSide;doubleMaterials.set(m,c);}return doubleMaterials.get(m);}

export function botanicalLeaf(g,p,size,angle,material){
 const geo=surface(8,12,(u,v)=>{
  const across=(u*2-1),width=Math.pow(Math.sin(Math.PI*v),.8)*size*.43;
  return [across*width,size*1.8*v,size*(.24*Math.sin(Math.PI*v)-.22*v*v+.20*across*across*Math.sin(Math.PI*v))];
 });
 const o=add(g,geo,twoSided(material),'Cupped tapered leaf');o.position.fromArray(p);o.rotation.set(.9+.22*Math.sin(angle*1.7),angle,.18*Math.sin(angle));
 if(!veinMaterials.has(material))veinMaterials.set(material,new T.MeshStandardMaterial({color:material.color.clone().multiplyScalar(1.13),roughness:.96,name:'Kitchen010 subtle leaf midrib'}));
 const vein=veinMaterials.get(material);
 tube(o,Array.from({length:9},(_,i)=>{const v=i/8;return [0,size*1.8*v,size*(.24*Math.sin(Math.PI*v)-.22*v*v)+.0006]}),.0006,vein,'Leaf midrib');return o;
}
export function botanicalPlant(g,p,s,trailing,{lathe,cyl,white,soil,green,light}){
 const [x,y,z]=p;
 lathe(g,'Rimmed hollow ceramic pot',p,[[0,0],[.085,0],[.090,.014],[.121,.188],[.124,.199],[.119,.206],[.108,.204],[.105,.192],[.079,.027],[0,.027]].map(([r,h])=>[r*s,h*s]),white);
 cyl(g,'Recessed potting soil',[x,y+.174*s,z],.105*s,.008,soil);
 for(let k=0;k<(trailing?3:5);k++){
  const a=k*2.399,pts=[],length=trailing?.44+.09*(k%2):.24+.045*k;
  for(let j=0;j<=8;j++){
   const t=j/8,r=(trailing?.22:.16)*Math.sin(t*Math.PI/2),h=trailing?.175+.11*Math.sin(t*Math.PI)-length*t:.175+length*t;
   const q=[x+Math.cos(a)*r*s,y+h*s,z+Math.sin(a)*r*s];pts.push(q);
   if(j===4||j===6||j===8){const angle=a+(j===6?-.65:.45);botanicalLeaf(g,q,(trailing?.037:.053)*s*(1-.10*(j===8)),angle,k%2?light:green);}
  }
  tube(g,pts,.0022*s,green,'Rooted arching stem');
 }
}
export function botanicalRose(g,p,s,material){
 const m=twoSided(material);m.vertexColors=true;
 for(let layer=0;layer<4;layer++)for(let k=0;k<5;k++){
  const a=k*Math.PI*2/5+layer*.71;
  const geo=surface(12,12,(u,v)=>{
   const theta=a+(u-.5)*(1.18+.14*layer),r=s*(.045+(.18+.18*layer)*Math.sin(v*Math.PI*.55)),edge=Math.sin(Math.PI*u);
   return [Math.cos(theta)*r,s*(.04+v*(.74-.105*layer)-.08*v*v*layer+.15*edge*v-.12*(2*u-1)**2*v),Math.sin(theta)*r];
  });
  const colors=[];for(let j=0;j<=12;j++)for(let i=0;i<=12;i++){const v=j/12,u=i/12,shade=.70+.27*v+.03*Math.sin(u*Math.PI);colors.push(shade,shade*.94,shade*.95);}
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const petal=add(g,geo,m,'Cupped overlapping rose petal');petal.position.fromArray(p);
 }
}

export function tailoredKitchenCurtains(root,{pink,lace,silver}){
 const cloth=twoSided(pink),trim=twoSided(lace);cloth.name='Kitchen010 soft rose linen';
 tube(root,[[-1.18,2.65,0],[0,2.65,0],[1.18,2.65,0]],.014,silver,'Curtain rail');
 function point(side,u,t){
  const y=2.60-t*2.17,gather=Math.exp(-(((y-1.04)/.36)**2)),width=.48-.25*gather;
  const centre=side*(.83+.10*gather),phase=u*Math.PI*8+.18*Math.sin(t*4.2+u*3);
  const z=.028+(.039-.026*gather)*(Math.cos(phase)+.16*Math.sin(u*21+t*2))+.009*Math.sin(t*5);
  return [centre+(u-.5)*width,y+.009*Math.sin(u*24)*t*t,z];
 }
 for(const side of [-1,1]){
  add(root,surface(64,80,(u,t)=>point(side,u,t)),cloth,'Continuous tailored rose panel');
  // Flat sewn band follows the actual cloth surface; no rigid cuboid tied across it.
  add(root,surface(64,6,(u,v)=>{const p=point(side,u,(2.60-(1.062-v*.044))/2.17);p[2]+=.003;return p;}),trim,'Soft fitted cotton tie');
  for(const u of [0,1])tube(root,Array.from({length:81},(_,j)=>{const p=point(side,u,j/80);p[2]+=.001;return p;}),.0015,trim,'Sewn curtain selvedge');
  // Thin scalloped ribbon follows the inside edge in the same continuous surface.
  add(root,surface(4,160,(u,t)=>{const p=point(side,side<0?1:0,t);p[0]-=side*u*(.009+.004*Math.sin(t*Math.PI*72));p[2]+=.001;return p;}),trim,'Fine scalloped inner ribbon');
  for(let i=0;i<5;i++){
   const p=point(side,(i+.5)/5,0),r=add(root,new T.TorusGeometry(.021,.003,6,20),silver,'Supporting curtain ring');r.position.set(p[0],2.625,0);r.rotation.y=Math.PI/2;
  }
 }
 root.userData.refinement='010 continuous panels, fitted ties, curved hems';
}

export function connectKitchenWindows(house){
 const panes=[];house.main.traverse(o=>{if(o.name==='Window'&&o.position.x<6.5){o.material=house.livingFinish.glass;o.castShadow=false;o.receiveShadow=false;panes.push(o);}});
 house.kitchenWindows=panes;
}
