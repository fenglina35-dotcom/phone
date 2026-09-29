export const groups={
 '头颅与脸部轮廓':[['headHeight','头颅高度',-.10,.12],['headWidth','头部宽度',-.06,.06],['headDepth','头颅前后厚度',-.10,.12],['faceWidth','脸宽',-.12,.12],['jawWidth','下颌宽度',-.14,.14],['chin','下巴长度',-.008,.01],['cheeks','脸颊饱满',-.006,.008],['profile','侧脸厚度',-.08,.08]],
 '眉毛':[['browHeight','眉毛高低',-.006,.006],['browSlope','眉尾角度',-.006,.006],['browThickness','眉毛粗细',-.25,.3]],
 '眼睛':[['eyeLower','眼睛整体下置',0,.012],['eyeRotation','眼睛旋转（度）',-12,12],['eyeHeight','眼睛高度',-.004,.004],['eyeWidth','眼睛宽度',-.15,.15],['eyeOpen','眼睛开合',-.22,.15],['eyeSlope','眼尾角度',-.004,.004],['eyeSpace','眼间距',-.003,.003],['irisSize','瞳孔大小',-.18,.15],['irisX','瞳孔左右位置',-.003,.003],['irisY','瞳孔上下位置',-.003,.003]],
 '鼻子与嘴':[['nose','鼻梁立体度',-.003,.004],['noseHeight','鼻子高度',-.003,.003],['smileLip','微笑唇（嘴角上扬）',0,1],['mouthHeight','嘴巴高度',-.008,.008],['mouthWidth','嘴唇宽度',-.12,.12],['mouthFullness','嘴唇厚度',-.15,.20]],
 '头发':[['hairLength','整体发长',-.045,.09],['bangLength','刘海长度',-.03,.025],['hairVolume','头发蓬松度',-.04,.10]],
 '身体与衣服':[['bodyHeight','身体高矮（头部大小不变）',-.15,.20],['neckLength','脖子长度',-.025,.05],['bodyDepth','身体侧面厚度',-.20,.25],['waistCurve','正面收腰',0,.30],['waistDepth','腰部侧面厚度',-.15,.15],['bodyWidth','身体宽度',-.10,.10]]};
export const fields=Object.values(groups).flat(),defaults={...Object.fromEntries(fields.map(([k])=>[k,0])),iris:'#a6734c',hair:'#996c4b',tint:false};
export function sanitize(v){const p={...defaults};for(const[k,,a,b]of fields)if(Number.isFinite(v?.[k]))p[k]=Math.max(a,Math.min(b,v[k]));for(const k of ['iris','hair'])if(/^#[\da-f]{6}$/i.test(v?.[k]))p[k]=v[k];p.tint=v?.tint===true;return p;}
const g=(x,c,s)=>Math.exp(-(((x-c)/s)**2)),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// Source-specific coordinates, in metres. Morph endpoints use this same function.
export function deform(x,y,z,p,kind='skin'){
 const cx=-.00024,xx=x-cx,front=smooth(-.005,.05,z),head=smooth(1.30,1.39,y),jaw=(1-smooth(1.34,1.42,y))*front;
 let nx=cx+xx*(1+p.headWidth*head),ny=y+Math.min(y,1.30)*p.bodyHeight+(y-1.32)*p.headHeight*head+p.neckLength*smooth(1.235,1.34,y),nz=z+(z-.012)*p.headDepth*head;
 if(kind==='body'){
  const torso=smooth(.72,.87,y)*(1-smooth(1.23,1.32,y)),waist=g(y,1.02,.13),centerMask=1-smooth(.18,.32,Math.abs(xx));
  return[nx+xx*(p.bodyWidth-p.waistCurve*g(y,1.035,.085))*torso*centerMask,ny,nz+(z-.005)*(p.bodyDepth+p.waistDepth*waist)*torso*centerMask];
 }
 if(kind==='hair'){
  const low=1-smooth(1.35,1.57,y),bang=front*(1-smooth(.065,.105,Math.abs(xx))),extension=p.hairLength*low*(1-bang)+p.bangLength*low*bang;
  nx+=xx*p.hairVolume*head;ny-=extension;nz+=(z-.012)*p.hairVolume*head;
  // Longer side strands open gently around the neck instead of stretching into it.
  nx+=Math.sign(xx)*Math.max(0,extension)*.28*(1-bang);return[nx,ny,nz];
 }
 nx+=xx*(p.faceWidth+p.jawWidth*jaw);nz+=(z-.012)*p.profile*head;ny-=p.chin*(1-smooth(1.34,1.40,y))*front;
 nz+=p.cheeks*g(Math.abs(xx),.06,.028)*g(y,1.397,.025)*front;
 const eye=g(Math.abs(xx),.045,.04)*g(y,1.438,.04)*front;
 const lowerMask=(1-smooth(.076,.108,Math.abs(xx)))*(1-smooth(.029,.051,Math.abs(y-1.437)))*front;
 if(kind!=='brow')ny-=p.eyeLower*lowerMask;
 const ex=xx-Math.sign(xx)*.044,ey=y-1.437,angle=p.eyeRotation*Math.PI/180*Math.sign(xx),co=Math.cos(angle),si=Math.sin(angle);
 nx+=Math.sign(xx)*p.eyeSpace*eye+ex*p.eyeWidth*eye+(ex*co-ey*si-ex)*eye;ny+=(y-1.437)*p.eyeOpen*eye+p.eyeSlope*((Math.abs(xx)-.035)/.035)*eye+p.eyeHeight*eye+(ex*si+ey*co-ey)*eye;
 if(kind==='iris'||kind==='highlight'){nx+=(xx-Math.sign(xx)*.044)*p.irisSize+p.irisX;ny+=(y-1.436)*p.irisSize+p.irisY;}
 if(kind==='brow'){ny+=p.browHeight+p.browSlope*((Math.abs(xx)-.04)/.035)+(y-1.477)*p.browThickness;}
 nz+=p.nose*g(xx,0,.018)*g(y,1.395,.02)*front;ny+=p.noseHeight*g(xx,0,.018)*g(y,1.395,.016)*front;
 ny+=.006*p.smileLip*smooth(.005,.024,Math.abs(xx))*(1-smooth(.029,.048,Math.abs(xx)))*g(y,1.371,.016)*front;
 const mouth=kind==='mouth'?1:g(xx,0,.034)*g(y,1.371,.016)*front;ny+=p.mouthHeight*mouth+(y-1.371)*p.mouthFullness*mouth;
 nx+=xx*p.mouthWidth*g(xx,0,.03)*g(y,1.37,.018)*front;
 return[nx,ny,nz];
}
