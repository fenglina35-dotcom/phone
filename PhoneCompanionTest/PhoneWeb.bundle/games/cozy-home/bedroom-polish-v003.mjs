import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {finishDesk003} from './bedroom-desk-v003.mjs';

// Metres, Y up. Runs before source capture and batching: preview and export share geometry.
export function polishBedroom(c) {
 const {T,house,roots,mesh,box,ball,rod,tube,lathe,surface,mat,bed,desk,wardrobe,curtains,white,pink,cream,oak,dark}=c;
 const erase=(g,re)=>{const a=[];g.traverse(o=>{if(re.test(o.name))a.push(o)});a.forEach(o=>o.removeFromParent());};
 const child=(g,n,p=[0,0,0])=>{const o=new T.Group();o.name=n;o.position.fromArray(p);g.add(o);return o;};
 const clamp=T.MathUtils.clamp,gauss=(x,w)=>Math.exp(-((x/w)**2));
 const navy=mat('003 soft blue cotton','#486ca0',.96),ribbon=mat('003 muted coral ribbon','#bd736f',.91),hairMat=mat('003 violet blue hair','#363951',.83),skin=mat('003 warm porcelain skin','#edd3bc',.81),ink=mat('003 painted ink','#373443',.92);
 navy.normalMap=white.normalMap;navy.normalScale=white.normalScale.clone();

 // Fine sheets have actual front/back separation along Z, not two coplanar vertical faces.
 function sheet(g,n,nu,nv,fn,m,depth=.002,radialCentre=null) {
  const a=[],uv=[],ix=[],N=(nu+1)*(nv+1);
  for(let l=0;l<2;l++)for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const p=fn(i/nu,j/nv);if(radialCentre!==null){const d=Math.hypot(p[0],p[2]-radialCentre);p[0]-=l*depth*p[0]/d;p[2]-=l*depth*(p[2]-radialCentre)/d;}else p[2]-=l*depth;a.push(...p);uv.push(i/nu,j/nv);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const k=j*(nu+1)+i;ix.push(k,k+nu+1,k+1,k+1,k+nu+1,k+nu+2);ix.push(k+N,k+1+N,k+nu+1+N,k+1+N,k+nu+2+N,k+nu+1+N);}
  const edge=[];for(let i=0;i<=nu;i++)edge.push(i);for(let j=1;j<=nv;j++)edge.push(j*(nu+1)+nu);for(let i=nu-1;i>=0;i--)edge.push(nv*(nu+1)+i);for(let j=nv-1;j>0;j--)edge.push(j*(nu+1));
  for(let i=0;i<edge.length;i++){const x=edge[i],y=edge[(i+1)%edge.length];ix.push(x,y,x+N,y,y+N,x+N);}
  if(radialCentre!==null)for(let i=0;i<ix.length;i+=3){const b=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=b;}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(a,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();const o=mesh(g,geo,m,[0,0,0],n);o.userData.closedSheet=true;return o;
 }

 // The duvet has one unbroken inflated top, a folded upper edge and gravity-shaped skirts.
 erase(bed,/One continuous softly draped duvet|Duvet stitched side seam|Supported cotton pillow|Pillow tailored seam/);
 function top(x,z) {
  const edge=clamp((Math.abs(x)-.57)/.30,0,1);
  const broad=.012*Math.sin(x*4.7+z*2.2)+.009*Math.cos(z*6-x*3)+.018*gauss(x,.64);
  const gathered=(.011*Math.sin(z*22+x*6)+.006*Math.sin(z*39-x*9))*edge*edge;
  const fold=.054*gauss(z+.49+.045*Math.sin(x*3.8),.065);
  const crease=-.008*gauss(z-.54-x*.23,.040)*gauss(x-.33,.43)+.008*gauss(z-.47-x*.23,.060)*gauss(x-.3,.47);
  const compression=.017*gauss(x-.14,.24)*gauss(z-.39,.22)+.012*gauss(x+.35,.18)*gauss(z+.03,.17);
  return .663+broad+gathered+fold-compression+crease;
 }
 function quilt(u,v){const s=(u-.5)*2.24,t=-.60+v*2.09,sx=Math.max(0,Math.abs(s)-.82),fz=Math.max(0,t-.95),side=clamp(sx/.30,0,1),foot=clamp(fz/.54,0,1);
  const x=sx?Math.sign(s)*(.82+.115*(1-Math.exp(-sx/.06))+.016*Math.sin(v*24+Math.sign(s)*.8)*side*side):s;
  const z=fz?.95+.130*(1-Math.exp(-fz/.055))+.014*Math.sin(u*24+.5)*foot*foot:t;
  const drop=Math.sqrt((.265*side)**2+(.335*foot)**2);
  const hanging=.013*Math.sin(v*27+u*8)*side+.010*Math.sin(u*24+.5)*foot+.009*Math.sin(u*43)*foot*foot;
  return [x,top(Math.sign(s)*Math.min(Math.abs(s),.82),Math.min(t,.95))-drop+hanging,z];}
 const duvet=surface(bed,'One continuous softly draped duvet',112,112,quilt,white,p=>Math.abs(p[0])<.83&&p[2]<.95?Math.max(.020,p[1]-.595):.018);
 duvet.userData.construction='Closed loft with mattress-supported lining, inflated top and hanging hem';
 duvet.userData.refinement012='Asymmetric turned-down edge, localized diagonal folds, scalloped skirts and lower hanging corners';
 for(const u of [0,1])tube(bed,'Duvet folded sewn hem',Array.from({length:100},(_,i)=>{const p=quilt(u,i/99);p[1]+=.001;return p;}),.0014,white);
 tube(bed,'Duvet foot sewn hem',Array.from({length:100},(_,i)=>{const p=quilt(i/99,1);p[1]+=.001;return p;}),.0014,white);
 // Soft rectangular pillows: pinched corners, compressed lower surface and small radial creases.
 for(const [k,x]of[-.43,.43].entries()){
  const g=child(bed,'Supported cotton pillow '+k,[x,.595,-.76]);g.rotation.y=k?-.045:.035;
  const geo=new T.SphereGeometry(1,80,48),a=geo.attributes.position;
  const sp=(x,e)=>Math.sign(x)*Math.abs(x)**e;
  for(let i=0;i<a.count;i++){const sy=a.getY(i),ang=Math.atan2(a.getZ(i),a.getX(i)),r=(Math.max(0,1-sy*sy))**.26,xx=.385*sp(Math.cos(ang),.32)*r,zz=.236*sp(Math.sin(ang),.32)*r;
   const bulge=sy>=0?.088+.132*sy:.088*(sy+1)**2;
   const wrinkle=sy>0?.0045*Math.sin(ang*17+sy*4)*(1-sy)**3:0;
   a.setXYZ(i,xx,bulge+wrinkle,zz);
  }geo.computeVertexNormals();mesh(g,geo,white,[0,0,0],'Pinched corner cotton shell');
  tube(g,'Inset pillow welt',Array.from({length:129},(_,i)=>{const t=i/128*Math.PI*2;return[.385*sp(Math.cos(t),.32),.088,.236*sp(Math.sin(t),.32)];}),.0013,white);
 }
 // The two reference cushions are fitted to the duvet surface, with broad compressed undersides.
 for(const name of ['Soft five-point rose cushion','Round honey cushion']){
  const g=bed.getObjectByName(name),isStar=name.startsWith('Soft'),old=g.getObjectByName('Continuous filled cushion'),material=old.material;
  g.clear();g.position.y=0;const radius=isStar?.285:.215,geo=new T.SphereGeometry(1,96,48),a=geo.attributes.position;
  const profile=t=>radius*(isStar?.81+.19*Math.cos(t*5):1);
  for(let i=0;i<a.count;i++){const sy=a.getY(i),t=Math.atan2(a.getZ(i),a.getX(i)),r=(Math.max(0,1-sy*sy))**(sy<0?.23:.5),rr=profile(t),x=Math.cos(t)*rr*r,z=Math.sin(t)*rr*r;
   const h=sy<0?.065*(sy+1)**3:.065+.080*sy;
   a.setXYZ(i,x,top(x+g.position.x,z+g.position.z)+h-.001,z);
  }geo.computeVertexNormals();mesh(g,geo,material,[0,0,0],'Continuous filled cushion');
  tube(g,'Cushion soft inset welt',Array.from({length:121},(_,i)=>{const t=i/120*Math.PI*2,x=Math.cos(t)*profile(t),z=Math.sin(t)*profile(t);return[x,top(x+g.position.x,z+g.position.z)+.064,z]}),.0012,material);
  g.userData.support='Duvet height field; compressed underside follows duvet, no flat floating base';
 }

 // Preserve the reference pink striped curtain, replacing stiff tie rods with free hanging cloth.
 const cm=curtains.getObjectByName('Continuous light bedroom curtain').material.clone();cm.side=T.DoubleSide;cm.roughness=.98;
 erase(curtains,/Continuous light bedroom curtain|Soft light tieback|Curtain attachment ring/);
 for(const side of[-1,1]){
  const fn=(u,v)=>{const phase=u*Math.PI*10+.16*Math.sin(v*3.4+side),centre=side*(1.137+.009*Math.sin(v*4)),width=.344+.020*v;
   return[centre+(u-.5)*width,2.594-v*2.15+.003*Math.sin(u*19)*v**10,.039+(.021+.008*v)*Math.sin(phase)+.006*Math.sin(v*7+u*2)];};
  sheet(curtains,'Continuous light bedroom curtain',64,104,fn,cm,.0025);
  for(const v of [.026,.985])tube(curtains,'Curtain folded hem seam',Array.from({length:100},(_,i)=>{const p=fn(i/99,v);p[2]+=.001;return p;}),.0009,pink);
  for(const u of[0,1])tube(curtains,'Curtain fine fabric selvedge',Array.from({length:100},(_,i)=>fn(u,i/99)),.0012,pink);
  for(let i=0;i<6;i++){const u=(i+.5)/6,p=fn(u,0),ring=mesh(curtains,new T.TorusGeometry(.021,.0027,8,24),cream,[p[0],2.615,0],'Curtain attachment ring');ring.rotation.y=Math.PI/2;
   tube(curtains,'Fabric heading loop',[[p[0],2.600,0],[p[0],2.593,.012],[p[0],2.585,p[2]]],.003,pink);
  }
 }
 for(const x of[-1.385,1.385])ball(curtains,'Curtain pole rounded end',[x,2.63,0],[.028,.022,.022],cream);

 // A rounded continuous garment outline retains connected shoulders/arms; depth and folds
 // are geometry, including closed cuffs and a turned skirt hem, not a front-only cutout.
 const dress=wardrobe.getObjectByName('Hanging blue sailor dress');erase(dress,/Continuous shoulder|One continuous pleated|Sailor collar|Cuff woven|Soft bow loop|Tapered ribbon tail|Cloth knot/);
 const sh=new T.Shape();sh.moveTo(-.075,-.045);sh.quadraticCurveTo(-.13,-.038,-.205,-.083);sh.quadraticCurveTo(-.266,-.10,-.28,-.17);sh.lineTo(-.305,-.49);sh.quadraticCurveTo(-.272,-.513,-.233,-.493);sh.lineTo(-.204,-.276);sh.quadraticCurveTo(-.188,-.267,-.182,-.30);sh.lineTo(-.166,-.582);sh.quadraticCurveTo(0,-.60,.166,-.582);sh.lineTo(.182,-.30);sh.quadraticCurveTo(.188,-.267,.204,-.276);sh.lineTo(.233,-.493);sh.quadraticCurveTo(.272,-.513,.305,-.49);sh.lineTo(.28,-.17);sh.quadraticCurveTo(.266,-.10,.205,-.083);sh.quadraticCurveTo(.13,-.038,.075,-.045);sh.quadraticCurveTo(.068,-.105,0,-.135);sh.quadraticCurveTo(-.068,-.105,-.075,-.045);
 const initial=new T.ExtrudeGeometry(sh,{depth:.026,bevelEnabled:true,bevelSize:.014,bevelThickness:.025,bevelSegments:6,curveSegments:20});
 let pts=Array.from(initial.attributes.position.array);
 for(let p=0;p<2;p++){const out=[];for(let i=0;i<pts.length;i+=9){const a=pts.slice(i,i+3),b=pts.slice(i+3,i+6),d=pts.slice(i+6,i+9),ab=a.map((x,k)=>(x+b[k])/2),bd=b.map((x,k)=>(x+d[k])/2),da=d.map((x,k)=>(x+a[k])/2);out.push(...a,...ab,...da,...ab,...b,...bd,...da,...bd,...d,...ab,...bd,...da);}pts=out;}
 const raw=new T.BufferGeometry();raw.setAttribute('position',new T.Float32BufferAttribute(pts,3));const pa=raw.attributes.position,uv=[];
 for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),front=clamp((z+.025)/.076,0,1),fold=.009*Math.sin(x*48+y*9)*Math.sin(clamp((-y-.03)/.59,0,1)*Math.PI)+.006*Math.sin(y*26)*gauss(Math.abs(x)-.25,.055);pa.setZ(i,z+front*(.016+fold));uv.push(x+.5,-y);}
 raw.setAttribute('uv',new T.Float32BufferAttribute(uv,2));const coatGeo=mergeVertices(raw,1e-5);coatGeo.computeVertexNormals();mesh(dress,coatGeo,navy,[0,0,.009],'Rounded continuous blouse and sleeves');
 sheet(dress,'Closed pleated skirt with turned hem',128,28,(u,v)=>{const a=u*Math.PI*2,fold=1+.055*Math.cos(a*18+v*.2),r=.16+v*.063;return[Math.cos(a)*r*fold,-.572-v*.268+.003*Math.cos(a*7)*v*v,.028+Math.sin(a)*(.038+v*.016)*fold];},navy,.002,.028);
 // Collar stripes follow exactly the same curved cloth surface.
 for(const side of[-1,1]){
  const cf=(u,v)=>[side*(.065+u*.128)*(1-v*.94),-.065-v*.21-u*.027,.079+.013*Math.sin(u*Math.PI)-.007*v];
  sheet(dress,'Rounded sailor collar',28,28,cf,navy,.003);
  for(const u of[.78,.90])tube(dress,'Woven collar stripe',Array.from({length:50},(_,i)=>{const p=cf(u,i/49);p[2]+=.001;return p;}),.0022,cream);
  for(const y of[-.472,-.458])tube(dress,'Curved cuff piping',Array.from({length:32},(_,i)=>{const x=side*(.239+i/31*.053),fold=.009*Math.sin(x*48+y*9)*Math.sin(clamp((-y-.03)/.59,0,1)*Math.PI)+.006*Math.sin(y*26)*gauss(Math.abs(x)-.25,.055);return[x,y,.077+fold];}),.0023,cream);
  sheet(dress,'Folded ribbon loop',24,20,(u,v)=>[side*(.009+Math.sin(v*Math.PI)*.09),-.266+(u-.5)*(.010+.041*Math.sin(v*Math.PI)),.093+.020*Math.sin(v*Math.PI)+.006*Math.sin(u*Math.PI)],ribbon,.003);
  sheet(dress,'Drooping ribbon end',20,32,(u,v)=>[side*(.007+v*.029)+(u-.5)*(.029+.009*Math.sin(v*4)),-.275-v*.159,.093+.013*Math.sin(v*5)-.008*v+.004*Math.sin(u*Math.PI)],ribbon,.0025);
 }
 ball(dress,'Soft tied ribbon centre',[0,-.267,.103],[.018,.016,.012],ribbon);
 dress.userData.refinement='Curved shoulder silhouette, rounded volume, fitted curved collar and closed fabric ribbons';

 // Shelf figure: rebuild as a connected collectible, with small contact-fitted painted details.
 const display=roots.find(o=>o.name==='bedroom_desk_display'),doll=display.getObjectByName('Painted sailor collectible');doll.clear();
 lathe(doll,'Collectible circular base',[0,0,0],[[0,0],[.069,0],[.070,.008],[.067,.012],[0,.012]],cream);
 for(const x of[-.021,.021]){ball(doll,'Supported rounded shoe',[x,.025,.009],[.017,.013,.026],ink);rod(doll,'Stocking leg',[x,.029,0],[x,.109,0],.0115,cream);}
 lathe(doll,'Fitted blouse',[0,.149,0],[[0,0],[.028,0],[.031,.01],[.037,.045],[.033,.061],[.018,.068],[0,.068]],ribbon);
 rod(doll,'Connected porcelain neck',[0,.211,0],[0,.241,0],.014,skin);
 sheet(doll,'Fine pleated collectible skirt',64,18,(u,v)=>{const a=u*Math.PI*2,r=(.029+v*.032)*(1+.055*Math.cos(a*12));return[Math.cos(a)*r,.161-v*.077,Math.sin(a)*r];},hairMat,.0009,0);
 for(const side of[-1,1]){tube(doll,'Curved full sleeve',[[side*.028,.202,0],[side*.044,.188,0],[side*.043,.169,.020],[side*.025,.169,.030]],.0105,ribbon);ball(doll,'Joined small hand',[side*.023,.168,.030],[.008,.009,.008],skin);}
 const face=ball(doll,'Sculpted oval face',[0,.278,.006],[.050,.057,.043],skin);
 const cap=mesh(doll,new T.SphereGeometry(1,64,40,0,Math.PI*2,0,Math.PI*.64),hairMat,[0,.284,0],'Rounded hair crown');cap.scale.set(.055,.061,.049);
 // Closed tapered ellipsoids remove the paper-like open hair strips.
 for(let i=0;i<7;i++){const x=-.042+i*.014,lock=ball(doll,'Rounded fringe lock',[x,.313-(i%3)*.003,.041],[.010,.024+(i%3)*.003,.009],hairMat);lock.rotation.z=(i-3)*.13;}
 for(const side of[-1,1]){const lock=ball(doll,'Soft side hair lock',[side*.048,.268,-.001],[.012,.041,.016],hairMat);lock.rotation.z=side*.14;ball(doll,'Little ear',[side*.048,.274,.009],[.007,.012,.006],skin);}
 const fz=(x,y)=>.006+.043*Math.sqrt(Math.max(0,1-(x/.05)**2-((y-.278)/.057)**2));
 // Curved decals coincide with the face ellipsoid instead of hovering flat eye discs.
 function facePatch(n,cx,cy,rx,ry,m,offset=.00025){return surface(doll,n,24,16,(u,v)=>{const a=u*Math.PI*2,r=Math.sin(v*Math.PI/2),x=cx+Math.cos(a)*rx*r,y=cy+Math.sin(a)*ry*r;return[x,y,fz(x,y)+offset];},m);}
 for(const x of[-.018,.018]){facePatch('Painted eye white',x,.279,.009,.013,cream);facePatch('Violet painted iris',x,.278,.006,.010,hairMat,.00055);facePatch('Pupil ink',x,.278,.003,.007,ink,.0008);facePatch('Eye painted catchlight',x-.002,.282,.0018,.0025,white,.001);facePatch('Soft cheek blush',x*1.45,.262,.005,.002,ribbon);}
 ball(doll,'Small sculpted nose',[0,.267,fz(0,.267)-.001],[.003,.004,.003],skin);
 tube(doll,'Painted mouth',[[-.006,.254,fz(-.006,.254)+.0004],[0,.252,fz(0,.252)+.0004],[.006,.254,fz(.006,.254)+.0004]],.0006,ribbon);
 for(const side of[-1,1]){tube(doll,'Sailor collar edge',[[side*.018,.211,.023],[side*.010,.190,.032],[0,.184,.033]],.0018,cream);ball(doll,'Little collar bow',[side*.009,.186,.036],[.010,.005,.003],hairMat);}
 doll.userData.refinement='Supported shoe soles; connected neck and arms; curved painted face patches; solid rounded hair locks';

 // Desk joinery: legs and apron meet the underside, drawer fronts retain a narrow real reveal.
 box(desk,'Desk underside rear stretcher',[0,.717,-.252],[1.47,.044,.041],oak,.004);
 finishDesk003(c);
 roots.forEach(r=>r.userData.detailRevision='bedroom-v003');
}
