import * as T from 'three';
import {lean,budget} from './mobile-budget024.mjs?build=050';

// Matte surfaces use a bounded solid-angle diffuse approximation. Glossy
// surfaces retain LTC; punctual highlights and the environment are untouched.
export function optimizeMatteLighting(scene){
 if(!lean)return;
 const materials=new Set();scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});
 let count=0;
 for(const m of materials){
  if(!m.isMeshStandardMaterial||m.roughness<.5||m.metalness>.1||m.transparent||m.clearcoat>0||m.sheen>0)continue;
  const before=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m);
  m.onBeforeCompile=function(s,r){before.call(this,s,r);
   const chunk=T.ShaderChunk.lights_physical_pars_fragment;
   const start=chunk.indexOf('\t\tvec2 uv = LTC_Uv( normal, viewDir, roughness );',chunk.indexOf('void RE_Direct_RectArea_Physical'));
   const end=chunk.indexOf('\t\treflectedLight.directDiffuse += lightColor',start);
   if(start>=0&&end>start){
    const finish=chunk.indexOf('\n\t}',end);
    const diffuse=`
    vec3 delta027=lightPos-position;
    float d2027=max(dot(delta027,delta027),0.0001);
    vec3 dir027=delta027*inversesqrt(d2027);
    vec3 facing027=normalize(cross(halfWidth,halfHeight));
    float area027=4.0*length(halfWidth)*length(halfHeight);
    float solid027=area027/(d2027+area027*RECIPROCAL_PI);
    float irradiance027=solid027*max(dot(normal,dir027),0.0)*max(dot(facing027,dir027),0.0);
    reflectedLight.directDiffuse+=lightColor*material.diffuseColor*irradiance027*RECIPROCAL_PI;
`;
    let fast=chunk.slice(0,start)+diffuse+chunk.slice(finish);
    fast=fast.replace('reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );',`vec3 half027=normalize(directLight.direction+geometryViewDir);
     float exponent027=mix(18.0,2.0,material.roughness);
     reflectedLight.directSpecular+=irradiance*material.specularColor*pow(max(dot(geometryNormal,half027),0.0),exponent027)*.16;`);
    s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_pars_fragment>',fast);
   }
  };
  m.customProgramCacheKey=()=>key()+'|matte-area027';m.needsUpdate=true;count++;
 }
 budget.matteAreaMaterials=count;
}
