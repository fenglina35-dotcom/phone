import {NoColorSpace} from 'three';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';

let manifest={},renderer,loader;
export const gpuImageStats={supported:false,loaded:0,fallbacks:0,encodedBytes:0,rgbaBytes:0,formats:[]};
function getLoader(){return loader||(loader=new KTX2Loader().setTranscoderPath('./vendor/three/examples/jsm/libs/basis/').setWorkerLimit(1).detectSupport(renderer));}
export async function prepareGpuImages(value){
 renderer=value;
 // Avoid decoding to RGBA as a hidden fallback: use the proven image path on
 // devices without an appropriate GPU format. No browser/UA guessing.
 gpuImageStats.supported=['WEBGL_compressed_texture_astc','EXT_texture_compression_bptc','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_etc'].some(name=>renderer.extensions.has(name));
 if(!gpuImageStats.supported||new URLSearchParams(location.search).get('texturepath')==='original')return;
 try{const r=await fetch('./textures/gpu056/manifest.json');if(!r.ok)throw Error('Texture manifest unavailable');manifest=await r.json();}catch{gpuImageStats.fallbacks++;}
}
export async function loadGpuImage(digest){
 const entry=manifest[digest];if(!entry)return null;
 // Desktop characters retain their original larger sheets. The 1024px
 // character encodings match only the existing touch-device texture budget.
 if(entry.mobileOnly&&!matchMedia('(pointer:coarse)').matches)return null;
 try{
  const texture=await getLoader().loadAsync(entry.url);
  if(!texture.isCompressedTexture||texture.image.width!==entry.width||texture.image.height!==entry.height||entry.width%4||entry.height%4)throw Error('Compressed texture dimensions/format mismatch');
  // GLTF assigns sRGB only to colour maps; data/normal maps remain linear.
  texture.colorSpace=NoColorSpace;texture.flipY=false;texture.userData.gpuImage056=true;texture.userData.gpuDigest056=digest;
  gpuImageStats.loaded++;gpuImageStats.encodedBytes+=texture.mipmaps.reduce((n,m)=>n+m.data.byteLength,0);
  gpuImageStats.rgbaBytes+=Math.ceil(entry.width*entry.height*4*4/3);
  if(!gpuImageStats.formats.includes(texture.format))gpuImageStats.formats.push(texture.format);
  return texture;
 }catch{gpuImageStats.fallbacks++;return null;}
}
// CPU-side compressed mip levels stay alive for GPU eviction/re-upload and
// context recovery. Only the transcoding worker and its WASM heap are released.
export function finishGpuImages(){if(loader){loader.dispose();loader=null;}}
