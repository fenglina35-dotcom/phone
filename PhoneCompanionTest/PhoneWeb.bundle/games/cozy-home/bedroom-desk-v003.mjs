// Desk props rebuilt in the same footprint. All support heights derive from the 0.7925 m top.
export function finishDesk003(c){
 const {T,mesh,box,ball,rod,tube,lathe,mat,desk,pink,cream,dark,brass}=c;
 const remove=[];desk.traverse(o=>{if(/^(Monitor |Dark monitor|Keyboard |Computer mouse|Articulated pink task lamp|Over ear headphones|Headphone loose cable|Desktop computer tower|Monitor routed cable)/.test(o.name))remove.push(o)});remove.forEach(o=>o.removeFromParent());
 const shell=mat('003 rose electronics','#d6b3b7',.47),rubber=mat('003 soft charcoal rubber','#42434a',.9),metal=mat('003 satin aluminium','#a6a8a6',.33,.65),light=mat('003 frosted LED','#fff0db',.5);light.emissive.set('#ffe1b2');light.emissiveIntensity=.3;
 const child=(n,p)=>{const o=new T.Group();o.name=n;o.position.fromArray(p);desk.add(o);return o;};
 const torus=(g,n,p,r,t,m,rot=[0,0,0])=>{const o=mesh(g,new T.TorusGeometry(r,t,10,48),m,p,n);o.rotation.set(...rot);return o;};
 const top=.7925;
 const monitor=child('Detailed desktop monitor',[-.22,top,-.15]);
 box(monitor,'Monitor rubber support foot',[0,.003,.018],[.23,.006,.151],rubber,.002);
 box(monitor,'Monitor sculpted base',[0,.011,.018],[.26,.013,.175],shell,.013);
 const stem=box(monitor,'Monitor neck',[0,.098,-.018],[.057,.17,.037],shell,.012);stem.rotation.x=-.08;
 rod(monitor,'Monitor tilt hinge',[-.046,.182,-.036],[.046,.182,-.036],.017,metal);
 const panel=new T.Group();panel.name='Tiltable monitor panel';panel.position.set(0,.365,-.017);panel.rotation.x=-.035;monitor.add(panel);
 box(panel,'Tapered rear monitor housing',[0,0,-.010],[.714,.411,.040],shell,.018);
 box(panel,'Screen black inset gasket',[0,.009,.013],[.679,.371,.005],rubber,.007);
 const cv=document.createElement('canvas');cv.width=1024;cv.height=560;const q=cv.getContext('2d'),grad=q.createLinearGradient(0,0,1024,560);grad.addColorStop(0,'#bdc9d3');grad.addColorStop(1,'#e7c6be');q.fillStyle=grad;q.fillRect(0,0,1024,560);
 q.fillStyle='rgba(249,243,235,.80)';q.beginPath();q.roundRect(558,83,347,365,18);q.fill();q.fillStyle='#716978';q.font='28px sans-serif';q.fillText('A quiet afternoon',585,133);q.font='17px sans-serif';q.fillText('NOTES',585,175);q.fillStyle='#b9aaa9';for(let i=0;i<7;i++)q.fillRect(585,199+i*29,250-(i%3)*42,3);
 q.fillStyle='#f4ede6';q.font='54px sans-serif';q.fillText('16:24',82,146);q.font='19px sans-serif';q.fillText('OUR LITTLE HOME',86,181);q.fillStyle='rgba(238,231,225,.75)';q.fillRect(0,517,1024,43);for(let i=0;i<6;i++){q.fillStyle=['#abbfc6','#c7a8b8','#b1b79d'][i%3];q.beginPath();q.roundRect(395+i*40,526,25,25,6);q.fill();}
 const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;const screen=new T.MeshStandardMaterial({name:'003 monitor desktop glass',map:tex,emissiveMap:tex,emissive:'#ffffff',emissiveIntensity:.10,roughness:.22,metalness:.13});
 box(panel,'Inset display glass',[0,.009,.017],[.661,.354,.003],screen,.004);
 for(let i=0;i<18;i++)box(panel,'Rear ventilation slot',[-.255+i*.030,.13,-.031],[.018,.003,.003],rubber,.001);
 ball(panel,'Screen power LED',[.303,-.19,.013],[.002,.002,.0015],light);
 for(let i=0;i<3;i++)ball(panel,'Monitor underside button',[.25+i*.021,-.200,0],[.004,.002,.003],rubber);
 box(panel,'Rear cable socket',[.052,-.11,-.033],[.025,.017,.008],rubber,.001);
 tube(desk,'Monitor cable with fitted rear plug',[[-.17,top+.25,-.207],[-.16,top+.10,-.23],[-.21,top-.11,-.265],[-.56,.470,-.204]],.0028,rubber);

 const keyboard=child('Detailed keyboard',[-.22,top,.155]);
 box(keyboard,'Keyboard rubber bottom',[0,.002,0],[.477,.004,.137],rubber,.005);
 box(keyboard,'Rounded keyboard case',[0,.010,0],[.50,.014,.155],shell,.012);
 const keys=[];for(let j=0;j<4;j++)for(let i=0;i<13;i++){const x=-.23+i*.038,z=-.058+j*.029;box(keyboard,'Separate sculpted keycap',[x,.021,z],[.030,.010,.024],cream,.003);keys.push([x,z,('1234567890-=QWERTYUIOP[]ASDFGHJKL;ZXCVBNM')[j*11+i]||'·']);}
 box(keyboard,'Long space bar',[0,.021,.061],[.20,.010,.023],cream,.004);
 const kc=document.createElement('canvas');kc.width=1024;kc.height=320;const kq=kc.getContext('2d');kq.clearRect(0,0,1024,320);kq.fillStyle='#8e7b80';kq.font='20px sans-serif';kq.textAlign='center';kq.textBaseline='middle';for(const[x,z,label]of keys)kq.fillText(label,(x/.5+.5)*1024,(z/.155+.5)*320);
 const kt=new T.CanvasTexture(kc);kt.colorSpace=T.SRGBColorSpace;const keyInk=new T.MeshStandardMaterial({name:'Printed key legends',map:kt,transparent:true,depthWrite:false,roughness:.91});
 const labels=mesh(keyboard,new T.PlaneGeometry(.5,.155),keyInk,[0,.0262,0],'Printed keycap legends');labels.rotation.x=-Math.PI/2;
 tube(desk,'Keyboard USB lead',[[-.44,top+.012,.080],[-.47,top+.005,-.03],[-.51,top+.003,-.25],[-.58,.40,-.204]],.0018,rubber);

 const pad=box(desk,'Stitched soft mouse mat',[.202,top+.0015,.160],[.242,.003,.235],pink,.015);pad.userData.supportTop=top;
 const mouse=child('Recognisable two button mouse',[.207,top+.003,.158]);
 const geo=new T.SphereGeometry(1,48,32),a=geo.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i);a.setXYZ(i,a.getX(i)*.032,.005+(y+1)*.014,a.getZ(i)*.052);}geo.computeVertexNormals();mesh(mouse,geo,cream,[0,0,0],'Ergonomic rounded mouse shell');
 const mouseBase=lathe(mouse,'Mouse supported bottom',[0,0,0],[[0,0],[.025,0],[.027,.003],[.025,.006],[0,.006]],rubber);mouseBase.scale.z=1.65;
 tube(mouse,'Mouse button dividing seam',[[0,.032,-.035],[0,.033,-.013],[0,.033,0]],.0007,dark);
 const wheel=mesh(mouse,new T.CylinderGeometry(.006,.006,.005,24),rubber,[0,.033,-.017],'Rubber scroll wheel');wheel.rotation.z=Math.PI/2;
 for(const x of[-.028,.028])ball(mouse,'Mouse side thumb inset',[x,.017,.007],[.0015,.004,.011],shell);

 const hp=child('Over ear headphones',[.563,top,.169]);hp.rotation.y=-.25;
 const band=[];for(let i=0;i<=56;i++){const t=Math.PI*i/56;band.push([Math.cos(t)*.094,.023,-Math.sin(t)*.113]);}
 tube(hp,'Continuous cushioned headband',band,.012,shell);tube(hp,'Inner soft headband lining',band.map(p=>[p[0]*.98,p[1]-.003,p[2]*.94]),.008,rubber);
 for(const side of[-1,1]){
  const cup=new T.Group();cup.name='Connected ear cup';cup.position.set(side*.094,0,.006);hp.add(cup);
  const shellGeo=new T.SphereGeometry(1,48,32),pos=shellGeo.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setXYZ(i,pos.getX(i)*.038,.010+(y<0?.010*y:.016*y),pos.getZ(i)*.046);}shellGeo.computeVertexNormals();mesh(cup,shellGeo,shell,[0,0,0],'Ear cup rests on shell');
  const cushion=torus(cup,'Deep soft ear pad',[0,.034,0],.029,.009,rubber,[Math.PI/2,0,0]);cushion.scale.y=1.15;
  box(cup,'Recessed ear fabric',[0,.025,0],[.044,.004,.055],rubber,.014);
  tube(cup,'Ear cup swivel yoke',[[side*-.012,.023,-.035],[side*.023,.025,-.027],[side*.034,.020,0]],.003,metal);
  ball(cup,'Yoke pivot',[side*.033,.020,0],[.004,.004,.004],metal);
 }
 tube(desk,'Headphone cable resting on desk',[[.471,top+.014,.157],[.43,top+.003,.238],[.364,top+.003,.263],[.387,top+.003,.212],[.400,top+.003,.232]],.0015,rubber);
 rod(desk,'Headphone jack metal tip',[.400,top+.003,.232],[.417,top+.003,.236],.0018,metal);

 const lamp=child('Articulated pink task lamp',[.641,top,-.155]);
 lathe(lamp,'Weighted lamp base with felt bottom',[0,0,0],[[0,0],[.077,0],[.088,.008],[.086,.018],[.070,.027],[0,.027]],shell);
 box(lamp,'Lamp rocker switch',[.037,.024,.031],[.020,.006,.014],cream,.003);
 const joints=[[0,.03,0],[0,.245,-.024],[-.044,.421,.066]];
 for(const dx of[-.013,.013])for(let i=0;i<2;i++)rod(lamp,'Joined parallel lamp arm',joints[i].map((v,k)=>k===0?v+dx:v),joints[i+1].map((v,k)=>k===0?v+dx:v),.0045,shell);
 for(const p of joints)rod(lamp,'Round metal pivot pin',[p[0]-.024,p[1],p[2]],[p[0]+.024,p[1],p[2]],.009,metal);
 const spring=[];for(let i=0;i<=120;i++){const t=i/120;spring.push([.019+.003*Math.cos(t*Math.PI*22),.078+t*.11,-.006-t*.012+.003*Math.sin(t*Math.PI*22)]);}tube(lamp,'Tension spring',spring,.0009,metal);
 const hood=new T.Group();hood.name='Downward open lamp hood';hood.position.set(-.044,.421,.066);hood.rotation.set(-.20,0,-.75);lamp.add(hood);
 lathe(hood,'Hollow conical shade with rolled rim',[0,-.104,0],[[.090,0],[.092,.006],[.084,.020],[.037,.113],[.020,.124],[.014,.119],[.030,.103],[.077,.019],[.083,.006],[.083,0]],shell);
 rod(hood,'Lamp socket',[0,.012,0],[0,-.044,0],.017,cream);ball(hood,'Frosted bulb inside shade',[0,-.058,0],[.026,.031,.026],light);
 lathe(hood,'Closed shade neck cap',[0,.012,0],[[0,0],[.019,0],[.020,.005],[.013,.012],[0,.012]],shell);
 torus(hood,'Shade rolled rim',[0,-.102,0],.087,.003,shell,[Math.PI/2,0,0]);
 const lampCord=tube(lamp,'Lamp cable follows arm',[[.018,.416,.06],[.026,.244,-.023],[.026,.044,0],[.075,.007,-.03],[.077,.006,-.13]],.0018,rubber);
 const cordPos=lampCord.geometry.attributes.position;for(let i=0;i<cordPos.count;i++)cordPos.setY(i,Math.max(.0002,cordPos.getY(i)));lampCord.geometry.computeVertexNormals();

 const pc=child('Desktop computer tower',[-.582,.004,-.01]);
 for(const x of[-.077,.077])for(const z of[-.135,.135])box(pc,'Computer rubber foot',[x,.005,z],[.033,.01,.048],rubber,.005);
 box(pc,'Rounded PC metal enclosure',[0,.244,0],[.218,.47,.372],cream,.012);
 box(pc,'Separate rose PC front',[0,.244,.190],[.20,.451,.017],shell,.009);
 box(pc,'Drive bay reveal',[0,.398,.200],[.151,.023,.003],rubber,.002);box(pc,'Drive loading tray',[0,.399,.202],[.144,.017,.002],cream,.001);
 for(let i=0;i<18;i++)box(pc,'Front ventilation groove',[0,.079+i*.010,.200],[.145,.003,.004],rubber,.001);
 const power=torus(pc,'Metal power button ring',[.055,.438,.202],.009,.0015,metal);ball(pc,'Power button centre',[.055,.438,.202],[.006,.006,.002],light);
 for(const x of[-.052,-.022]){box(pc,'USB port metal surround',[x,.439,.202],[.019,.009,.003],metal,.001);box(pc,'USB port cavity',[x,.439,.204],[.014,.004,.002],rubber,.001);}
 for(const z of[-.12,.12])for(const y of[.06,.43])ball(pc,'Side panel captive screw',[.110,y,z],[.001,.003,.003],metal);
 for(let i=0;i<12;i++)box(pc,'Side cooling vent',[.110,.15+i*.012,-.045],[.002,.003,.105],rubber,.001);
 for(const [x,y]of[[.002,.396],[.022,.466]])box(pc,'Connected rear cable plug',[x,y,-.191],[.013,.008,.009],rubber,.001);
 for(const g of[monitor,keyboard,mouse,hp,lamp,pc])g.userData.detailRevision='bedroom-v003';
}
