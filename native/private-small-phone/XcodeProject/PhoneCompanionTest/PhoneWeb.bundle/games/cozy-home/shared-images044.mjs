import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const sharedImages=new Map(),installed=Symbol('sharedImages044');
export const sharedImageStats={decoded:0,reused:0};
export function shareGLTFImages(){
 const parse=GLTFLoader.prototype.parse;
 if(parse[installed])return;
 function sharedParse(...args){
  if(!this[installed]){
   this[installed]=true;
   this.register(parser=>({name:'COZY_shared_images044',beforeRoot(){
    const load=parser.loadImageSource.bind(parser);
    parser.loadImageSource=async function(index,loader){
     const source=parser.json.images[index];
     if(source.bufferView===undefined||!globalThis.crypto?.subtle||!loader.isImageBitmapLoader)return load(index,loader);
     const bytes=await parser.getDependency('bufferView',source.bufferView);
     const digest=await crypto.subtle.digest('SHA-256',bytes);
     const key=source.mimeType+':'+JSON.stringify(loader.options)+':'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
     let promise=sharedImages.get(key);
     if(!promise){sharedImageStats.decoded++;promise=load(index,loader);sharedImages.set(key,promise);promise.catch(()=>sharedImages.delete(key));}
     else sharedImageStats.reused++;
     // Clone sampler/UV/color settings while sharing the exact decoded pixels.
     const texture=(await promise).clone();
     texture.userData={...texture.userData,...(source.extras||{})};
     return texture;
    };
   }}));
  }
  return parse.apply(this,args);
 }
 sharedParse[installed]=true;GLTFLoader.prototype.parse=sharedParse;
}
