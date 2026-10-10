import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const ai = fs.readFileSync(new URL('../photo-album.js', import.meta.url), 'utf8');

const helpers = sw.slice(0, sw.indexOf("self.addEventListener('install'"));
const context = {Response, AbortController, fetch:()=>{}, setTimeout, clearTimeout};
vm.createContext(context);
vm.runInContext(helpers,context);

assert.equal(context.validShellText('html',html),true,'complete HTML must pass');
assert.equal(context.validShellText('app',app),true,'complete app.js must pass');
assert.equal(context.validShellText('album',ai),true,'complete ai-account.js must pass');
assert.equal(context.validShellText('html',html.slice(0,50000)),false,'truncated HTML must fail');
assert.equal(context.validShellText('app',app.slice(0,900000)),false,'truncated app.js must fail');
assert.equal(context.validShellText('album',ai.slice(0,100)),false,'truncated ai-account.js must fail');
assert.match(sw,/Promise\.all\(CORE_FILES\.map[\s\S]*checkedResponse\(item\.url,item\.kind,3\)/);
assert.match(sw,/currentCore\(cache,'html'\)/);
assert.match(sw,/currentCore\(cache,'app'\)/);
assert.match(sw,/const GLASS_ICON_CACHE='north-glass-icons-v2'/);
assert.match(sw,/assets\\\/app-icons\\\/glass/);
assert.doesNotMatch(app,/loading="lazy" decoding="async" fetchpriority="low"/);
assert.match(app,/packed\?' decoding="sync" loading="eager" fetchpriority="high"':''/);

console.log('cache integrity tests passed');

assert.equal(context.validShellText('commerce',fs.readFileSync(new URL('../commerce-ui.js',import.meta.url),'utf8')),true,'complete commerce runtime passes');
assert.equal(context.validShellText('commerce','window.renderFood=function(){};'),false,'missing or incomplete commerce must not activate as a valid release');
assert.match(sw,/kind:'commerce'/);assert.match(sw,/currentCore\(cache,'commerce'\)/);


// A previous release's durable icon cache must not shadow the newer game artwork.
const iconEvents={},opened=[],oldIcon=new Response('OLD_ICON');let iconNetwork=0,iconResponse;
const iconContext=vm.createContext({self:{location:{origin:'https://phone.example'},addEventListener:(name,fn)=>iconEvents[name]=fn},caches:{open:async name=>{opened.push(name);return{match:async()=>name==='north-glass-icons-v1'?oldIcon:undefined,put:async()=>{}};}},fetch:async()=>{iconNetwork++;return new Response('CURRENT_ICON');},URL,Request,Response,AbortController,setTimeout,clearTimeout});
vm.runInContext(sw,iconContext);
iconEvents.fetch({request:new Request('https://phone.example/assets/app-icons/glass/black/tale.webp?v=20261008games'),respondWith:value=>iconResponse=value});
assert.equal(await(await iconResponse).text(),'CURRENT_ICON');assert.equal(iconNetwork,1);assert.ok(opened.includes('north-glass-icons-v2'));assert.ok(!opened.includes('north-glass-icons-v1'));

// iOS home-screen navigation uses a percent-encoded Chinese pathname.
for(const query of ['?open=latest','?north_update=1674','?reload=1','?northPreview=black-home']){
 const events={};let supplied,network=0,writes=0;
 const ctx=vm.createContext({self:{location:{origin:'https://phone.example'},addEventListener:(name,fn)=>events[name]=fn},caches:{open:async()=>({match:async()=>new Response('STALE_SHELL'),put:async()=>writes++})},fetch:async()=>{network++;return new Response(html+'\n<!-- fresh-shell -->');},URL,Request,Response,AbortController,setTimeout,clearTimeout});vm.runInContext(sw,ctx);
 events.fetch({request:{method:'GET',mode:'navigate',url:'https://phone.example/phone/'+encodeURIComponent('小手机.html')+query},respondWith:value=>supplied=value});
 assert.match(await(await supplied).text(),/fresh-shell/,'explicit encoded navigation must reach the network: '+query);assert.equal(network,1);
}
