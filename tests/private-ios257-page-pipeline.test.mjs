import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const overlay=fs.readFileSync(path.join(
  root,
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/' +
    'PhoneWeb.bundle/private-runtime-diagnostics.js'
),'utf8');

function runtime(initialPage='home'){
  let perfNow=0,wallNow=1000000,page=initialPage,nextRAF=0,nextTimer=0;
  const events=[],nativeRequests=[],nativeCalls=[],rafCallbacks=new Map();
  const elements=new Map(),listeners=new Map(),classes=new Set();
  const nativeEventAt=new Map();
  class FakeDate extends Date{static now(){return wallNow;}}
  const classList={
    add:value=>classes.add(value),
    remove:value=>classes.delete(value),
    contains:value=>classes.has(value),
    toggle(value,force){if(force)classes.add(value);else classes.delete(value);return!!force;}
  };
  const app={
    innerHTML:'PRIVATE_CHAT_TEXT role_private_842 sk-private-key ' +
      'https://private.invalid/image.png',
    privateRoleID:'role_private_842',
    privateAPIKey:'sk-private-key',
    privateImageURL:'https://private.invalid/image.png',
    getElementsByClassName:name=>({length:name==='msg'?3:0}),
    getElementsByTagName:name=>({length:{'*':42,img:4,canvas:1,video:2}[name]||0})
  };
  elements.set('app',app);
  const makeElement=()=>({
    id:'',innerHTML:'',textContent:'',style:{setProperty(){},removeProperty(){}},
    classList:{add(){},remove(){},contains(){return false;}},
    setAttribute(){},addEventListener(){},querySelectorAll:()=>[],appendChild(){}
  });
  const document={
    hidden:false,
    documentElement:{classList},
    getElementById:id=>elements.get(id)||null,
    createElement:()=>makeElement(),
    addEventListener(name,callback){
      const rows=listeners.get(name)||[];rows.push(callback);listeners.set(name,rows);
    },
    head:{appendChild(node){if(node.id)elements.set(node.id,node);}},
    body:{appendChild(node){if(node.id)elements.set(node.id,node);}}
  };
  const sandbox={
    document,Date:FakeDate,Math,Object,Promise,String,Number,Map,Set,
    performance:{now:()=>perfNow},navigator:{},webkit:null,
    requestAnimationFrame(callback){const id=++nextRAF;rafCallbacks.set(id,callback);return id;},
    cancelAnimationFrame(id){rafCallbacks.delete(id);},
    setTimeout(){return++nextTimer;},clearTimeout(){},
    setInterval(){return++nextTimer;},clearInterval(){},
    northNativePerformanceGuard(){return true;}
  };
  sandbox.window=sandbox;
  sandbox.window.__SMALL_PHONE_PRIVATE__=true;
  sandbox.window.cur=()=>({p:page});
  /* Deliberately simulate the older second throttle layer: it ignores the
     fourth key and buckets only by event. Keyed overlay calls must therefore
     pass gap=0 or a different reason would still disappear here. */
  sandbox.window.__smallPhoneNativeDiag=(event,fields,gap,key)=>{
    const now=FakeDate.now(),last=nativeEventAt.get(event)||0;
    nativeCalls.push({event,gap,key});
    if(gap&&now-last<gap)return false;
    nativeEventAt.set(event,now);
    events.push({event:String(event),fields:JSON.parse(JSON.stringify(fields))});
    return true;
  };
  sandbox.window.SmallPhoneNative={
    request(action,payload){nativeRequests.push({action,payload});return Promise.resolve({ok:true});}
  };
  vm.runInNewContext(overlay,sandbox);
  const frame=ms=>{
    perfNow+=ms;wallNow+=ms;
    const pending=[...rafCallbacks.entries()];
    rafCallbacks.clear();
    for(const [,callback]of pending)callback(perfNow);
  };
  return{
    sandbox,events,nativeRequests,nativeCalls,app,frame,
    setPage:value=>{page=value;},
    advance:ms=>{perfNow+=ms;wallNow+=ms;},
    clear(){events.length=0;nativeRequests.length=0;nativeCalls.length=0;}
  };
}

const renderRows=events=>events.filter(row=>row.event.startsWith('render.'));
const assertBoundedFields=rows=>{
  for(const row of rows)assert.ok(
    Object.keys(row.fields).length<=8,
    `${row.event} exceeded the eight-field native diagnostic bound`
  );
};

test('normal sync and normal RAF produce no render diagnostics',()=>{
  const r=runtime('home');r.clear();
  r.sandbox.__smallPhoneNativePerformanceSampleTrace({kind:'render-home',ms:20});
  r.sandbox.__smallPhonePrivateRenderTrace({
    page:'home',detail:'',htmlMs:5,innerHTMLMs:6,settingsMs:0,
    hydrateMs:3,afterMs:6,totalMs:20,htmlChars:98765
  });
  r.frame(16);r.frame(16);
  assert.deepEqual(renderRows(r.events),[]);
});

test('slow sync writes accurate bounded context sync and paint records',()=>{
  const r=runtime('settings');r.clear();
  r.sandbox.__smallPhoneNativePerformanceSampleTrace({kind:'render-settings',ms:775});
  const trace=r.sandbox.__smallPhonePrivateRenderTrace({
    page:'settings',detail:'appearance',htmlMs:400,innerHTMLMs:300,
    settingsMs:25,hydrateMs:20,afterMs:30,totalMs:775,
    htmlChars:123456
  });
  r.frame(16);r.frame(17);
  const rows=renderRows(r.events),context=rows.find(x=>x.event==='render.context'),
    sync=rows.find(x=>x.event==='render.sync'),paint=rows.find(x=>x.event==='render.paint');
  assert.ok(context&&sync&&paint);
  assert.equal(context.fields.trace,trace);
  assert.equal(context.fields.page,'settings');
  assert.equal(context.fields.settingsCategory,'appearance');
  assert.equal(context.fields.chatCount,-1);
  assert.equal(context.fields.trigger,'sync');
  assert.deepEqual(
    [sync.fields.htmlMs,sync.fields.innerHTMLMs,sync.fields.settingsMs,
      sync.fields.imageSyncMs,sync.fields.tailMs,sync.fields.totalMs],
    [400,300,25,20,30,775]
  );
  assert.equal(paint.fields.trace,trace);
  assert.deepEqual(
    [paint.fields.raf1Ms,paint.fields.raf2Ms,paint.fields.domCount,
      paint.fields.imgCount,paint.fields.canvasCount,paint.fields.videoCount],
    [16,17,42,4,1,2]
  );
  assertBoundedFields(rows);
});

test('slow RAF after normal sync emits one fully linked trace',()=>{
  const r=runtime('chat');r.clear();
  const trace=r.sandbox.__smallPhonePrivateRenderTrace({
    page:'chat',detail:'role-chat',htmlMs:20,innerHTMLMs:20,
    settingsMs:0,hydrateMs:10,afterMs:20,totalMs:70
  });
  assert.equal(renderRows(r.events).length,0);
  r.frame(500);r.frame(350);
  const rows=renderRows(r.events);
  assert.deepEqual(rows.map(x=>x.event),['render.context','render.sync','render.paint']);
  assert.ok(rows.every(row=>row.fields.trace===trace));
  assert.equal(rows[0].fields.trigger,'paint');
  assert.equal(rows[0].fields.chatCount,3);
  assert.equal(rows[2].fields.raf1Ms,500);
  assert.equal(rows[2].fields.raf2Ms,350);
  assertBoundedFields(rows);
});

test('RAF1 switches to B at 1200ms but stays in A below the threshold',()=>{
  const below=runtime('home');below.clear();
  below.sandbox.__smallPhonePrivateRenderTrace({
    page:'home',detail:'',htmlMs:5,innerHTMLMs:5,settingsMs:0,
    hydrateMs:5,afterMs:5,totalMs:20
  });
  below.frame(1199);
  below.frame(16);
  assert.equal(below.sandbox.__SMALL_PHONE_COMPOSITION_STATE__.mode,'A');
  assert.equal(below.events.some(row=>row.event==='composition.ab.auto'),false);
  assert.equal(
    below.nativeRequests.some(row=>
      row.action==='diagnostics.compositionMode'&&row.payload.mode==='B'
    ),
    false
  );

  const threshold=runtime('home');threshold.clear();
  threshold.sandbox.__smallPhonePrivateRenderTrace({
    page:'home',detail:'',htmlMs:5,innerHTMLMs:5,settingsMs:0,
    hydrateMs:5,afterMs:5,totalMs:20
  });
  threshold.frame(1200);
  assert.equal(threshold.sandbox.__SMALL_PHONE_COMPOSITION_STATE__.mode,'B');
  const automatic=threshold.events.filter(row=>row.event==='composition.ab.auto');
  assert.equal(automatic.length,1);
  assert.equal(automatic[0].fields.source,'render-raf1-slow');
  assert.equal(automatic[0].fields.raf1Ms,1200);
  assert.deepEqual(
    threshold.nativeRequests.map(row=>[row.action,row.payload.mode]),
    [['diagnostics.compositionMode','B']]
  );
});

test('render diagnostics never serialize chat text role ID API key or image URL',()=>{
  const r=runtime('chat');r.clear();
  r.sandbox.__smallPhonePrivateRenderTrace({
    page:'chat',detail:'https://private.invalid/sk-private-key',
    htmlMs:150,innerHTMLMs:40,settingsMs:0,hydrateMs:5,afterMs:5,
    totalMs:200,id:'role_private_842',key:'sk-private-key',
    url:'https://private.invalid/image.png',html:r.app.innerHTML
  });
  r.frame(16);r.frame(16);
  const serialized=JSON.stringify(renderRows(r.events));
  for(const secret of [
    'PRIVATE_CHAT_TEXT','role_private_842','sk-private-key',
    'https://private.invalid/image.png'
  ])assert.equal(serialized.includes(secret),false,`leaked ${secret}`);
});

test('a render performance sample preserves a just-published trace ID',()=>{
  const r=runtime('settings');r.clear();
  const trace=r.sandbox.__smallPhonePrivateRenderTrace({
    page:'settings',detail:'data',htmlMs:10,innerHTMLMs:10,
    settingsMs:2,hydrateMs:2,afterMs:6,totalMs:30
  });
  assert.equal(r.sandbox.__SMALL_PHONE_RENDER_TRACE__.trace,trace);
  r.sandbox.__smallPhoneNativePerformanceSampleTrace({kind:'render-settings',ms:900});
  assert.equal(r.sandbox.__SMALL_PHONE_RENDER_TRACE__.trace,trace);
});

test('rapid A B A keeps only the latest settled mode and same-mode taps are native no-ops',()=>{
  const r=runtime('home');r.clear();
  assert.equal(r.sandbox.privateCompositionABSet('A','same-mode'),'A');
  assert.equal(r.nativeRequests.length,0);
  assert.equal(r.sandbox.privateCompositionABSet('B','test'),'B');
  assert.equal(r.sandbox.privateCompositionABSet('A','test'),'A');
  r.frame(16);r.frame(16);
  const settled=r.events.filter(x=>x.event==='composition.ab.settled');
  assert.deepEqual(settled.map(x=>x.fields.mode),['A']);
  assert.deepEqual(
    r.nativeRequests.map(x=>[x.action,x.payload.mode]),
    [['diagnostics.compositionMode','B'],['diagnostics.compositionMode','A']]
  );
  const before=r.nativeRequests.length;
  r.sandbox.privateCompositionABSet('A','same-mode-again');
  assert.equal(r.nativeRequests.length,before);
});

test('guard throttle separates reason family page and A B mode across both layers',()=>{
  const r=runtime('home');r.clear();
  r.sandbox.northNativePerformanceGuard('event-loop:900',120000);
  r.sandbox.northNativePerformanceGuard('thermal-serious',120000);
  r.setPage('settings');
  r.sandbox.northNativePerformanceGuard('event-loop:901',120000);
  r.sandbox.privateCompositionABSet('B','test');
  r.sandbox.northNativePerformanceGuard('event-loop:902',120000);
  r.sandbox.northNativePerformanceGuard('event-loop:999',120000);
  const guards=r.events.filter(x=>x.event==='performance.guard');
  assert.deepEqual(
    guards.map(x=>[x.fields.reason,x.fields.page,x.fields.abMode]),
    [
      ['event-loop:900','home','A'],
      ['thermal-serious','home','A'],
      ['event-loop:901','settings','A'],
      ['event-loop:902','settings','B']
    ]
  );
  assert.ok(
    r.nativeCalls.filter(x=>x.event==='performance.guard').every(x=>x.gap===0),
    'keyed guard events must bypass an older event-only native throttle'
  );
});

test('page pipeline instrumentation has no layout forcing timer or business-content reads',()=>{
  const start=overlay.indexOf('function boundedNumber');
  const end=overlay.indexOf('function installCompositionABStyle');
  assert.ok(start>=0&&end>start);
  const source=overlay.slice(start,end);
  assert.doesNotMatch(source,/(?:getBoundingClientRect|getComputedStyle)\s*\(/);
  assert.doesNotMatch(source,/\.(?:offset|client|scroll)(?:Width|Height|Top|Left)\b/);
  assert.doesNotMatch(source,/\b(?:setTimeout|setInterval)\s*\(/);
  assert.doesNotMatch(
    source,
    /\b(?:localStorage|sessionStorage|indexedDB|renderPageKey|innerHTML|textContent|getAttribute|querySelector)\b/
  );
  assert.doesNotMatch(source,/row\.(?:htmlChars|html|id|key|url|text|content)\b/);
  assert.match(source,/getElementsByTagName\('\*'\)\.length/);
  assert.match(source,/trace\.totalMs>=120/);
  assert.match(source,/raf1Ms>=250\|\|raf2Ms>=250/);
});
