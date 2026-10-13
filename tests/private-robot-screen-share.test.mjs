// Watch together with K (docs/areas/屏幕共享.md). The owner switches it on in K's page, the
// screen broadcast extension posts its latest picture to the robot's cloud function, and the
// web side only starts, stops and tidies up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../native/private-small-phone/XcodeProject/',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const voice=read('PhoneCompanionTest/PhoneWeb.bundle/private-robot-voice.js');
const face=read('PhoneCompanionTest/PhoneWeb.bundle/private-robot-face.js');
const handler=read('PhoneScreenBroadcast/SampleHandler.swift');
const coordinator=read('PhoneCompanionTest/ScreenShareCoordinator.swift');
const bridge=read('PhoneCompanionTest/PhoneNativeBridge.swift');

// The module as shipped, run against stand-ins for the App around it.
function world(over={}){
  const start=voice.indexOf('var RobotScreen = (()=>{'),end=voice.indexOf('if(typeof window!==\'undefined\'){',start);
  assert.ok(start>0&&end>start,'RobotScreen block present');
  const calls=[],toasts=[],store=new Map();
  const state={scope:'target-1',act:'main',broadcast:false,robot:false,token:'ab'.repeat(32),picker:true,configure:true,callShare:false,...over};
  const context={
    console,calls,toasts,
    privateNativeAppOn:()=>state.native!==false,
    robotFaceScope:()=>state.scope,actId:()=>state.act,
    companionOwnerSecret:()=>'owner-secret',companionCloudURL:()=>'https://project.example',
    toast:text=>toasts.push(text),
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    document:{getElementById:()=>null},
    _call:null,callScreenShareOn:()=>state.callShare,
    companionRpc:async(name,args)=>{calls.push(['rpc',name,args.p_op]);if(state.rpcFails)throw Error('网络错误');
      if(args.p_op==='start')return state.unbound?{ok:false,reason:'unbound'}:{ok:true,active:true,token:state.token};
      return {ok:true,active:false};},
    SmallPhoneNative:{request:async(name,payload)=>{calls.push(['native',name,payload]);
      if(name==='screenShare.robot.configure'){state.robot=state.configure;return {configured:state.configure};}
      if(name==='screenShare.robot.clear'){state.robot=false;return {cleared:true};}
      if(name==='screenShare.robot.status')return {configured:state.robot};
      if(name==='screenShare.status')return {active:state.broadcast};
      if(name==='screenShare.start')return {pickerPresented:state.picker};
      if(name==='screenShare.stop'){state.broadcast=false;return {stopRequested:true};}
      throw Error('unknown '+name);}},
  };
  context.globalThis=context;
  if(state.inCall)context._call={state:'active'};
  vm.createContext(context);
  vm.runInContext(voice.slice(start,end)+';globalThis.RobotScreen=RobotScreen;',context);
  return {screen:context.RobotScreen,calls,toasts,state,store,names:()=>calls.map(c=>c[0]+':'+c[1]+(c[0]==='rpc'?':'+c[2]:''))};
}

test('starting asks the cloud for a key, hands it to the extension, then opens the system panel',async()=>{
  const w=world();
  assert.equal(await w.screen.toggle(),true);
  assert.deepEqual(w.names(),['rpc:phone_robot_screen_owner:start','native:screenShare.robot.configure','native:screenShare.status','native:screenShare.start']);
  const configure=w.calls.find(c=>c[1]==='screenShare.robot.configure')[2];
  assert.deepEqual({...configure},{url:'https://project.example/functions/v1/phone-robot?action=screen',token:'ab'.repeat(32)});
  assert.equal(w.screen.active(),true);assert.equal(w.store.get('north.robotScreenShare.v1'),'target-1');
  assert.match(w.toasts.at(-1),/开始直播/);
});

test('a broadcast that is already running is reused, the panel is not opened again',async()=>{
  const w=world({broadcast:true});
  await w.screen.toggle();
  assert.ok(!w.names().includes('native:screenShare.start'));assert.equal(w.screen.active(),true);
});

test('stopping clears the key, ends the broadcast and closes the share on the cloud',async()=>{
  const w=world();await w.screen.toggle();w.state.broadcast=true;w.calls.length=0;
  assert.equal(await w.screen.toggle(),true);
  assert.deepEqual(w.names(),['native:screenShare.robot.clear','native:screenShare.stop','rpc:phone_robot_screen_owner:stop']);
  assert.equal(w.screen.active(),false);assert.equal(w.store.has('north.robotScreenShare.v1'),false);
});

test('a share that belongs to a call is not ended when K stops watching',async()=>{
  const w=world({inCall:true,callShare:true,broadcast:true});await w.screen.toggle();w.calls.length=0;
  await w.screen.toggle();
  assert.deepEqual(w.names(),['native:screenShare.robot.clear','rpc:phone_robot_screen_owner:stop']);
});

test('when the broadcast ends by itself the cloud share is closed without touching the broadcast',async()=>{
  const w=world();await w.screen.toggle();w.calls.length=0;
  w.screen.nativeEvent({active:false});await new Promise(r=>setTimeout(r,5));
  assert.deepEqual(w.names(),['native:screenShare.robot.clear','rpc:phone_robot_screen_owner:stop']);
  assert.equal(w.screen.active(),false);
  w.calls.length=0;w.screen.nativeEvent({active:false});w.screen.nativeEvent({active:true});await new Promise(r=>setTimeout(r,5));
  assert.equal(w.calls.length,0,'nothing happens when K was not watching');
});

test('failures leave nothing half open',async()=>{
  let w=world({unbound:true});assert.equal(await w.screen.toggle(),false);
  assert.equal(w.screen.active(),false);assert.match(w.toasts.at(-1),/绑定小 K/);assert.deepEqual(w.names(),['rpc:phone_robot_screen_owner:start']);
  w=world({configure:false});assert.equal(await w.screen.toggle(),false);
  assert.equal(w.screen.active(),false);assert.match(w.toasts.at(-1),/更新 App/);
  assert.equal(w.names().at(-1),'rpc:phone_robot_screen_owner:stop','an App without the new interface closes the cloud share again');
  w=world({picker:false});assert.equal(await w.screen.toggle(),false);
  assert.equal(w.screen.active(),false);assert.ok(w.names().includes('rpc:phone_robot_screen_owner:stop'));assert.equal(w.store.has('north.robotScreenShare.v1'),false);
  w=world({native:false});assert.equal(await w.screen.toggle(),false);assert.equal(w.calls.length,0);
  w=world({act:'other'});assert.equal(await w.screen.toggle(),false);assert.equal(w.calls.length,0,'only the private main account');
});

test('after a restart a share whose broadcast is gone is closed, a live one is picked up',async()=>{
  let w=world();w.store.set('north.robotScreenShare.v1','target-1');
  await w.screen.resume();
  assert.equal(w.screen.active(),false);assert.ok(w.names().includes('rpc:phone_robot_screen_owner:stop'));assert.equal(w.store.has('north.robotScreenShare.v1'),false);
  w=world({broadcast:true,robot:true});w.store.set('north.robotScreenShare.v1','target-1');
  await w.screen.resume();
  assert.equal(w.screen.active(),true);assert.ok(!w.names().some(n=>n.startsWith('rpc:')));
  w=world();await w.screen.resume();assert.equal(w.calls.length,0,'nothing remembered, nothing asked');
});

test('the web side never uploads and never runs on a timer',()=>{
  const start=voice.indexOf('var RobotScreen = (()=>{'),end=voice.indexOf('if(typeof window!==\'undefined\'){',start),block=voice.slice(start,end);
  assert.doesNotMatch(block,/setInterval|setTimeout|fetch\(|screenShare\.frame/);
  assert.match(voice,/RobotScreen\.nativeEvent\(event\)/);assert.match(voice,/RobotScreen\.resume\(\)/);
  assert.match(face,/id="robot-screen-item"[^>]*onclick="RobotScreen\.toggle\(\)"/);assert.match(face,/id="robot-screen-state"/);
});

test('native: the extension posts by itself, with the key of this share, and forgets it when told to',()=>{
  for(const source of [handler,coordinator]){assert.match(source,/"screenShare\.robotURL\.v1"/);assert.match(source,/"screenShare\.robotToken\.v1"/);}
  assert.match(handler,/robotInterval: TimeInterval = 8\b/);
  assert.match(handler,/uploadForRobot\(input, at: now, defaults: defaults\)/);
  assert.match(handler,/setValue\("Bearer \\\(token\)", forHTTPHeaderField: "Authorization"\)/);
  assert.match(handler,/setValue\("image\/jpeg", forHTTPHeaderField: "Content-Type"\)/);
  assert.match(handler,/status == 410 \|\| status == 401 \|\| status == 403/);
  assert.match(handler,/override func broadcastFinished\(\) \{\s*setActive\(false\)\s*clearLatestFrame\(\)\s*clearRobotUpload\(\)/);
  assert.match(coordinator,/parsed\.scheme == "https"/);assert.match(coordinator,/hasSuffix\("\/functions\/v1\/phone-robot"\)/);assert.match(coordinator,/parsed\.query == "action=screen"/);
  for(const name of ['screenShare.robot.configure','screenShare.robot.clear','screenShare.robot.status'])assert.ok(bridge.includes('case "'+name+'":'),name);
});
