export const fields=[
 ['faceWidth','脸部宽度',-.14,.12,.01],['jawWidth','下颌宽度',-.12,.18,.01],['chinLength','下巴长度',-.012,.02,.001],
 ['eyeOpen','眼睛开合',-.55,.16,.01],['eyeSlope','眼尾角度',-.006,.006,.001],['eyeSpace','眼间距离',-.004,.004,.001],
 ['noseDepth','鼻梁立体度',-.004,.006,.001],['mouthWidth','嘴唇宽度',-.18,.18,.01],['hairLift','刘海上提（可选）',0,1,.01]];
export const defaults={faceWidth:0,jawWidth:0,chinLength:0,eyeOpen:0,eyeSlope:0,eyeSpace:0,noseDepth:0,mouthWidth:0,hairLift:0,hair:'#292b31',iris:'#87988e'};
const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const gauss=(x,c,s)=>Math.exp(-(((x-c)/s)**2));
export function deform(x,y,z,p,hair=false){
 const center=.0005088,xx=x-center;
 if(hair){const front=1-smooth(-.11,-.015,z),low=1-smooth(1.69,1.78,y),w=front*low*p.hairLift;return [center+xx*(1+p.faceWidth*.65)+.026*w,y+.07*w,z-.008*w];}
 const front=1-smooth(-.06,-.005,z),jaw=(1-smooth(1.51,1.595,y))*front;
 let nx=center+xx*(1+p.faceWidth+p.jawWidth*jaw),ny=y-p.chinLength*(1-smooth(1.5,1.60,y))*front,nz=z;
 const eye=gauss(Math.abs(xx),.042,.045)*gauss(y,1.604,.039)*front;
 ny+=(y-1.604)*p.eyeOpen*eye+p.eyeSlope*((Math.abs(xx)-.027)/.026)*eye;nx+=Math.sign(xx)*p.eyeSpace*eye;
 nz-=p.noseDepth*gauss(xx,0,.018)*gauss(y,1.565,.024)*front;
 nx+=xx*p.mouthWidth*gauss(xx,0,.033)*gauss(y,1.542,.019)*front;
 return [nx,ny,nz];
}
export function sanitize(input){const p={...defaults};for(const [key,,min,max] of fields)if(Number.isFinite(input?.[key]))p[key]=Math.max(min,Math.min(max,input[key]));for(const key of ['hair','iris'])if(/^#[0-9a-f]{6}$/i.test(input?.[key]))p[key]=input[key];return p;}
