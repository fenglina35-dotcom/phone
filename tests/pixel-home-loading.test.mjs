import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const sw=fs.readFileSync(new URL('sw.js',root),'utf8');
async function gameFetch(failure){
  const listeners={};let responsePromise,network=0;
  const cached=new Response('offline asset');
  const cache={match:async()=>{if(failure==='match')throw Error('storage unavailable');return failure==='hit'?cached:undefined;},put:async()=>{if(failure==='put')throw Error('QuotaExceededError');}};
  const context={URL,Request,Response,console,setTimeout,clearTimeout,caches:{open:async()=>{if(failure==='open')throw Error('storage unavailable');return cache;}},fetch:async()=>{network++;if(failure==='network')throw Error('network down');return new Response('network asset');},self:{location:{origin:'https://phone.test'},addEventListener:(kind,fn)=>listeners[kind]=fn}};
  vm.runInNewContext(sw,context);
  listeners.fetch({request:new Request('https://phone.test/games/pixel-home/assets/rooms.png?v=test'),respondWith:p=>responsePromise=p,waitUntil:()=>{}});
  return {response:await responsePromise,network};
}
for(const failure of ['open','match','put'])test('pixel network success survives cache '+failure+' failure',async()=>{const result=await gameFetch(failure);assert.equal(await result.response.text(),'network asset');assert.equal(result.network,1);});
test('pixel cached asset remains available offline',async()=>{const result=await gameFetch('hit');assert.equal(await result.response.text(),'offline asset');assert.equal(result.network,0);});
test('pixel true network failure is not replaced by phone shell',async()=>{await assert.rejects(gameFetch('network'),/network down/);});
test('image loading works without HTMLImageElement.decode',async()=>{
  class Image {naturalWidth=20;naturalHeight=20;set src(value){queueMicrotask(()=>this.onload?.());}}
  const context={window:{},Image,URL,location:{protocol:'https:',href:'https://phone.test/games/pixel-home/'},document:{currentScript:{src:'https://phone.test/games/pixel-home/assets.js'}},setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(new URL('games/pixel-home/assets.js',root),'utf8'),context);
  assert.equal((await context.window.PixelHomeAssets.load('rooms.png')).naturalWidth,20);
});
test('broken and stalled images reject with resource name rather than hang',async()=>{
  let mode='error';class Image {set src(value){if(mode==='error')queueMicrotask(()=>this.onerror?.());}}
  const context={window:{},Image,URL,location:{protocol:'https:',href:'https://phone.test/games/pixel-home/'},document:{currentScript:{src:'https://phone.test/games/pixel-home/assets.js'}},setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(new URL('games/pixel-home/assets.js',root),'utf8'),context);
  await assert.rejects(context.window.PixelHomeAssets.loadImage('bad','rooms.png',10),/rooms.png/);
  mode='hang';await assert.rejects(context.window.PixelHomeAssets.loadImage('stalled','bedroom.png',10),/超时.*bedroom.png/);
});
test('wardrobe image decoding has a bounded concurrency and canvas fallback',async()=>{
  let active=0,peak=0;
  class Image {naturalWidth=20;set src(value){active++;peak=Math.max(peak,active);setTimeout(()=>{active--;this.onload?.();},1);}}
  const context={window:{PixelWardrobeData:{catalog:{version:1},images:Object.fromEntries(Array.from({length:15},(_,i)=>[String(i),'data:image/png;base64,test']))}},Image,URL,location:{protocol:'https:',href:'https://phone.test/games/pixel-home/'},document:{currentScript:{src:'https://phone.test/games/pixel-home/assets.js'},createElement:()=>({getContext:()=>({})})},setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(new URL('games/pixel-home/assets.js',root),'utf8'),context);
  assert.equal(Object.keys((await context.window.PixelHomeAssets.loadCatalog()).images).length,15);assert.equal(peak,3);
  const canvas=context.window.PixelHomeAssets.createCanvas(1024,1536);assert.equal(canvas.width,1024);assert.equal(canvas.height,1536);
});
