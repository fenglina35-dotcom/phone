import * as T from 'three';

// Rough surfaces receive point/spot/area lighting from a GPU-generated L2
// spherical-harmonic volume instead of looping over every light per pixel.
// The volume is evaluated from the live Light objects (manual switches,
// day/evening, editor moves), never from the player's position. Local lights in
// this house cast no shadows, so their diffuse field is smooth and a 20 cm grid
// reproduces it closely. Glossy, clearcoat, transmissive, character and
// near-light materials (lamp shades, bulbs) keep the exact per-light shading.
export function installLightVolume(renderer,scene,{min=new T.Vector3(-.4,-3.5,-.4),max=new T.Vector3(26.6,3.3,18),cell=.2,tilesX=8,nearField=.6,smallObject=1.2,minInterval=90}={}){
 const lights={point:[],spot:[],area:[]};
 scene.traverse(l=>{if(l.isPointLight)lights.point.push(l);else if(l.isSpotLight)lights.spot.push(l);else if(l.isRectAreaLight)lights.area.push(l);});
 const nx=Math.ceil((max.x-min.x)/cell),ny=Math.ceil((max.y-min.y)/cell),nz=Math.ceil((max.z-min.z)/cell);
 const tilesY=Math.ceil(ny/tilesX),width=nx*tilesX,height=nz*tilesY;
 const target=new T.WebGLRenderTarget(width,height,{count:7,type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
 const NP=Math.max(1,lights.point.length),NS=Math.max(1,lights.spot.length),NA=Math.max(1,lights.area.length);
 const vec=(n,C)=>Array.from({length:n},()=>new C());
 const u={vMin:{value:min.clone()},vCell:{value:cell},vDims:{value:new T.Vector3(nx,ny,nz)},vTiles:{value:tilesX},
  pPos:{value:vec(NP,T.Vector3)},pCol:{value:vec(NP,T.Vector3)},pRange:{value:vec(NP,T.Vector2)},
  sPos:{value:vec(NS,T.Vector3)},sDir:{value:vec(NS,T.Vector3)},sCol:{value:vec(NS,T.Vector3)},sRange:{value:vec(NS,T.Vector4)},
  aPos:{value:vec(NA,T.Vector3)},aFacing:{value:vec(NA,T.Vector3)},aCol:{value:vec(NA,T.Vector4)}};
 // Same formulas as Three's punctual lights and material-performance027's area
 // diffuse, projected onto L2 SH with the clamped-cosine kernel folded in.
 const gen=new T.RawShaderMaterial({glslVersion:T.GLSL3,uniforms:u,depthTest:false,depthWrite:false,
  vertexShader:'in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`precision highp float;
#define NP ${NP}
#define NS ${NS}
#define NA ${NA}
uniform vec3 vMin;uniform float vCell;uniform vec3 vDims;uniform float vTiles;
uniform vec3 pPos[NP];uniform vec3 pCol[NP];uniform vec2 pRange[NP];
uniform vec3 sPos[NS];uniform vec3 sDir[NS];uniform vec3 sCol[NS];uniform vec4 sRange[NS];
uniform vec3 aPos[NA];uniform vec3 aFacing[NA];uniform vec4 aCol[NA];
layout(location=0) out vec4 o0;layout(location=1) out vec4 o1;layout(location=2) out vec4 o2;layout(location=3) out vec4 o3;layout(location=4) out vec4 o4;layout(location=5) out vec4 o5;layout(location=6) out vec4 o6;
vec3 c[9];
float att(float d,float cutoff,float decay){float f=1./max(pow(d,decay),.01);if(cutoff>0.){float r=clamp(1.-pow(d/cutoff,4.),0.,1.);f*=r*r;}return f;}
void lobe(vec3 l,vec3 w){
 const float A0=3.14159265*.282095,A1=2.0943951*.488603,A2=.785398*1.092548,A20=.785398*.315392,A22=.785398*.546274;
 c[0]+=w*A0;c[1]+=w*(A1*l.y);c[2]+=w*(A1*l.z);c[3]+=w*(A1*l.x);
 c[4]+=w*(A2*l.x*l.y);c[5]+=w*(A2*l.y*l.z);c[6]+=w*(A20*(3.*l.z*l.z-1.));c[7]+=w*(A2*l.x*l.z);c[8]+=w*(A22*(l.x*l.x-l.y*l.y));
}
void main(){
 vec2 f=floor(gl_FragCoord.xy);float tx=floor(f.x/vDims.x),ty=floor(f.y/vDims.z);
 vec3 g=vec3(f.x-tx*vDims.x,ty*vTiles+tx,f.y-ty*vDims.z);
 for(int i=0;i<9;i++)c[i]=vec3(0.);
 if(g.y<vDims.y){
  vec3 p=vMin+(g+.5)*vCell;
  for(int i=0;i<NP;i++){vec3 v=pPos[i]-p;float d=length(v);if(pRange[i].x>0.&&d>pRange[i].x)continue;lobe(v/max(d,1e-4),pCol[i]*att(d,pRange[i].x,pRange[i].y)*.3183099);}
  for(int i=0;i<NS;i++){vec3 v=sPos[i]-p;float d=length(v);vec3 l=v/max(d,1e-4);float a=smoothstep(sRange[i].z,sRange[i].w,dot(l,sDir[i]));if(a<=0.)continue;lobe(l,sCol[i]*a*att(d,sRange[i].x,sRange[i].y)*.3183099);}
  for(int i=0;i<NA;i++){vec3 v=aPos[i]-p;float d2=max(dot(v,v),1e-4);vec3 l=v*inversesqrt(d2);float area=aCol[i].w;float solid=area/(d2+area*.3183099);float face=max(dot(aFacing[i],l),0.);if(face<=0.)continue;lobe(l,aCol[i].rgb*solid*face*.3183099);}
 }
 o0=vec4(c[0],c[1].r);o1=vec4(c[1].gb,c[2].rg);o2=vec4(c[2].b,c[3]);o3=vec4(c[4],c[5].r);o4=vec4(c[5].gb,c[6].rg);o5=vec4(c[6].b,c[7]);o6=vec4(c[8],0.);
}`});
 const quad=new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3)),gen);quad.frustumCulled=false;
 const genScene=new T.Scene();genScene.add(quad);const genCamera=new T.Camera();
 // Change detection without per-frame allocation: every light writes its
 // world-space parameters into one numeric signature.
 const signature=new Float64Array(lights.point.length*8+lights.spot.length*14+lights.area.length*10);
 const tmp=new T.Vector3(),q=new T.Quaternion();let dirty=true,pending=false,lastGeneration=-Infinity,generations=0;
 function collect(){
  let k=0,changed=false;const put=v=>{if(signature[k]!==v){signature[k]=v;changed=true;}k++;};
  lights.point.forEach((l,i)=>{const p=l.getWorldPosition(u.pPos.value[i]),on=l.visible?l.intensity:0,c=u.pCol.value[i].set(l.color.r,l.color.g,l.color.b).multiplyScalar(on);u.pRange.value[i].set(l.distance,l.decay);put(p.x);put(p.y);put(p.z);put(c.x);put(c.y);put(c.z);put(l.distance);put(l.decay);});
  lights.spot.forEach((l,i)=>{const p=l.getWorldPosition(u.sPos.value[i]);l.target.getWorldPosition(tmp);const d=u.sDir.value[i].copy(p).sub(tmp).normalize(),on=l.visible?l.intensity:0,c=u.sCol.value[i].set(l.color.r,l.color.g,l.color.b).multiplyScalar(on),r=u.sRange.value[i].set(l.distance,l.decay,Math.cos(l.angle),Math.cos(l.angle*(1-l.penumbra)));put(p.x);put(p.y);put(p.z);put(d.x);put(d.y);put(d.z);put(c.x);put(c.y);put(c.z);put(r.x);put(r.y);put(r.z);put(r.w);put(0);});
  lights.area.forEach((l,i)=>{const p=l.getWorldPosition(u.aPos.value[i]);l.getWorldQuaternion(q);const f=u.aFacing.value[i].set(0,0,1).applyQuaternion(q),on=l.visible?l.intensity:0,c=u.aCol.value[i].set(l.color.r*on,l.color.g*on,l.color.b*on,l.width*l.height);put(p.x);put(p.y);put(p.z);put(f.x);put(f.y);put(f.z);put(c.x);put(c.y);put(c.z);put(c.w);});
  return changed;
 }
 function generate(){
  const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
  renderer.autoClear=false;renderer.setRenderTarget(target);renderer.render(genScene,genCamera);renderer.setRenderTarget(previous);renderer.autoClear=autoClear;
  generations++;lastGeneration=performance.now();pending=false;
 }
 // While a switch fades, regenerate at most every minInterval ms and once more
 // when the fade settles, so a light change never costs a volume every frame.
 function update(force=false){
  if(collect()||dirty)pending=true;dirty=false;
  if(!pending)return false;
  if(!force&&performance.now()-lastGeneration<minInterval)return false;
  generate();return true;
 }
 const shared={volTex:{value:target.textures},volMin:u.vMin,volCell:u.vCell,volDims:u.vDims,volTiles:u.vTiles,volAtlas:{value:new T.Vector2(width,height)}};
 const sampleChunk=`
uniform sampler2D volTex[7];uniform vec3 volMin;uniform float volCell;uniform vec3 volDims;uniform float volTiles;uniform vec2 volAtlas;
vec2 volUV(vec2 xz,float y){float tx=mod(y,volTiles),ty=floor(y/volTiles);return (vec2(tx*volDims.x,ty*volDims.z)+xz)/volAtlas;}
vec3 vc062[9];
void volSample(vec3 p){
 vec3 g=clamp((p-volMin)/volCell-.5,vec3(0.),volDims-1.);
 vec2 xz=g.xz+.5;float y0=floor(g.y),y1=min(y0+1.,volDims.y-1.),fy=g.y-y0;
 vec2 a=volUV(xz,y0),b=volUV(xz,y1);
 vec4 t0=mix(texture(volTex[0],a),texture(volTex[0],b),fy),t1=mix(texture(volTex[1],a),texture(volTex[1],b),fy),t2=mix(texture(volTex[2],a),texture(volTex[2],b),fy),t3=mix(texture(volTex[3],a),texture(volTex[3],b),fy),t4=mix(texture(volTex[4],a),texture(volTex[4],b),fy),t5=mix(texture(volTex[5],a),texture(volTex[5],b),fy),t6=mix(texture(volTex[6],a),texture(volTex[6],b),fy);
 vc062[0]=t0.rgb;vc062[1]=vec3(t0.a,t1.rg);vc062[2]=vec3(t1.ba,t2.r);vc062[3]=t2.gba;vc062[4]=t3.rgb;vc062[5]=vec3(t3.a,t4.rg);vc062[6]=vec3(t4.ba,t5.r);vc062[7]=t5.gba;vc062[8]=t6.rgb;
}
vec3 volEval(vec3 n){
 vec3 r=vc062[0]*.282095+vc062[1]*(.488603*n.y)+vc062[2]*(.488603*n.z)+vc062[3]*(.488603*n.x)+vc062[4]*(1.092548*n.x*n.y)+vc062[5]*(1.092548*n.y*n.z)+vc062[6]*(.315392*(3.*n.z*n.z-1.))+vc062[7]*(1.092548*n.x*n.z)+vc062[8]*(.546274*(n.x*n.x-n.y*n.y));
 return max(r,vec3(0.));
}`;
 // Fabrics/curtains (non-matte rough materials) take point/spot highlights and
 // sheen from one dominant virtual light derived from SH band 1.
 const specularChunk=` {const vec3 lum062=vec3(.2126,.7152,.0722);vec3 lw062=vec3(dot(vc062[3],lum062),dot(vc062[1],lum062),dot(vc062[2],lum062));float ll062=length(lw062);
 if(ll062>1e-5){vec3 d062=lw062/ll062;IncidentLight vl062;vl062.direction=normalize(mat3(viewMatrix)*d062);vl062.color=max((vc062[3]*d062.x+vc062[1]*d062.y+vc062[2]*d062.z)/1.0233,vec3(0.))*3.14159265;vl062.visible=true;
  ReflectedLight tmp062=ReflectedLight(vec3(0.),vec3(0.),vec3(0.),vec3(0.));RE_Direct(vl062,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,tmp062);reflectedLight.directSpecular+=tmp062.directSpecular;}}`;
 const converted=new Set(),matte=m=>!!m.customProgramCacheKey?.().includes('matte-area027');
 const blocks=['#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )','#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )','#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )'];
 function convert(material){
  if(converted.has(material))return false;
  const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),specular=!matte(material);
  material.onBeforeCompile=function(shader,r){
   before.call(this,shader,r);
   let fs=shader.fragmentShader;
   if(fs.includes('#include <lights_fragment_begin>'))fs=fs.replace('#include <lights_fragment_begin>',T.ShaderChunk.lights_fragment_begin);
   // An unexpected Three chunk layout keeps the exact per-light shader.
   const at=blocks.every(line=>fs.includes(line))?fs.indexOf('#if defined( RE_IndirectDiffuse )',fs.lastIndexOf(blocks[2])):-1;
   if(at<0){shader.fragmentShader=fs;return;}
   for(const line of blocks)fs=fs.replace(line,'#if 0 // light-volume062');
   const insert=fs.indexOf('#if defined( RE_IndirectDiffuse )',fs.lastIndexOf('light-volume062'));
   fs=fs.slice(0,insert)+`{mat3 rot062=transpose(mat3(viewMatrix));vec3 vp062=rot062*(geometryPosition-viewMatrix[3].xyz);vec3 vn062=normalize(rot062*geometryNormal);
 volSample(vp062);reflectedLight.directDiffuse+=volEval(vn062)*material.diffuseColor;
${specular?specularChunk:''}
}
`+fs.slice(insert);
   fs=fs.replace('void main() {',sampleChunk+'\nvoid main() {');
   Object.assign(shader.uniforms,shared);shader.fragmentShader=fs;
  };
  material.customProgramCacheKey=()=>key()+'|light-volume062';material.needsUpdate=true;converted.add(material);return true;
 }
 // Lamp shades, bulbs and anything else small inside a light's near field keep
 // exact shading: a 20 cm grid cannot represent light a few centimetres away.
 const materials=new Set(),near=new Set(),box=new T.Box3(),size=new T.Vector3();scene.updateMatrixWorld(true);
 const sources=[...lights.point,...lights.spot].map(l=>l.getWorldPosition(new T.Vector3()));
 scene.traverse(o=>{
  if(!o.isMesh)return;const list=(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean);list.forEach(m=>materials.add(m));
  box.setFromObject(o);if(box.isEmpty())return;box.getSize(size);
  if(Math.max(size.x,size.y,size.z)<smallObject&&sources.some(p=>box.distanceToPoint(p)<nearField))list.forEach(m=>near.add(m));
 });
 const eligible=m=>m.isMeshStandardMaterial&&m.roughness>=.5&&!(m.clearcoat>0)&&!(m.transmission>0)&&!near.has(m)&&typeof m.customProgramCacheKey==='function';
 for(const m of materials)if(eligible(m))convert(m);
 return {update,converted,target,
  // Render target contents do not survive WebGL context loss.
  invalidate(){dirty=true;lastGeneration=-Infinity;},
  stats:()=>({nx,ny,nz,width,height,cell,generations,converted:converted.size,nearField:near.size,lights:{point:lights.point.length,spot:lights.spot.length,area:lights.area.length}})};
}
