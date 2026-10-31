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
  const start=voice.indexOf('var RobotScreen = (()=>{'),end=voice.indexOf('/* Screen sharing asked for in ordinary chat.',start);
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
  const start=voice.indexOf('var RobotScreen = (()=>{'),end=voice.indexOf('/* Screen sharing asked for in ordinary chat.',start),block=voice.slice(start,end);
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

// ---- Screen sharing asked for in ordinary chat (ChatScreen) ----
const app=read('PhoneCompanionTest/PhoneWeb.bundle/app.js');
function chatWorld(over={}){
  const start=voice.indexOf('var ChatScreen = (()=>{'),end=voice.indexOf("if(typeof document!=='undefined')document.addEventListener('visibilitychange'",start);
  assert.ok(start>0&&end>start,'ChatScreen block present');
  const told=[],calls=[],timers=[],modals=[],toasts=[];
  const state={available:true,broadcast:false,join:false,picker:true,frame:{dataURL:'data:image/jpeg;base64,AAAA',token:'tok-1',source:'externalApp',frameAt:1791900000000},vision:'屏幕上是一个视频软件，正在播放猫的视频。',...over};
  const context={
    console,_call:state.inCall?{state:'active'}:null,S:{me:{name:'小北'}},
    screenShareAvailable:()=>state.available,
    getC:id=>id==='gone'?null:{id,name:'克劳德',remark:'先生',avatar:'',blocked:id==='blocked'},
    scheduleReply:(cid,text)=>told.push([cid,text]),
    playDing(){},av:()=>'<i></i>',esc:x=>String(x),toast:x=>toasts.push(x),factStamp:()=>'刚才',
    openModal:html=>modals.push(html),closeModal:()=>modals.push('closed'),
    visionAPI:async()=>{calls.push('vision');if(state.visionFails)throw Error('识图失败');return state.vision;},
    RobotScreen:{join:async()=>{calls.push('robot.join');return state.join;}},
    SmallPhoneNative:{request:async(name)=>{calls.push(name);
      if(name==='screenShare.status')return {active:state.broadcast};
      if(name==='screenShare.start')return {pickerPresented:state.picker};
      if(name==='screenShare.realtime.frame'){if(!state.frame)throw Error('screen_share_frame_unavailable');return state.frame;}
      if(name==='screenShare.vision.complete')return {finished:true};
      throw Error('unknown '+name);}},
    setTimeout:(fn,ms)=>{timers.push([fn,ms]);return timers.length;},Date,
  };
  context.globalThis=context;vm.createContext(context);
  vm.runInContext(voice.slice(start,end)+';globalThis.ChatScreen=ChatScreen;',context);
  return {chat:context.ChatScreen,told,calls,timers,modals,toasts,state,context};
}

test('chat: the role is told he may ask, and what asking means',()=>{
  const w=chatWorld(),text=w.chat.prompt({id:'c1'});
  assert.match(text,/\[请求屏幕共享\|简短原因\]/);assert.match(text,/不能假装看到了/);assert.match(text,/小北/);assert.match(text,/和 \[申请远程操控\] 不是一回事/);
  assert.equal(chatWorld({available:false}).chat.prompt({id:'c1'}),'','not the private App: nothing is said');
  assert.equal(chatWorld({inCall:true}).chat.prompt({id:'c1'}),'','calls keep their own wording');
});

test('chat: asking shows the consent sheet once, and not again within a minute',()=>{
  const w=chatWorld();
  assert.equal(w.chat.ask('c1','想看看你在干嘛'),true);
  assert.equal(w.modals.length,1);assert.match(w.modals[0],/先生 请求屏幕共享/);assert.match(w.modals[0],/想看看你在干嘛/);assert.match(w.modals[0],/ChatScreen\.deny\(\)/);assert.match(w.modals[0],/ChatScreen\.approve\(\)/);
  assert.equal(w.chat.ask('c1','再看'),false,'one request at a time');
  w.chat.deny();assert.equal(w.chat.ask('c1','再看'),false,'no asking again right after a refusal');
  assert.equal(chatWorld({available:false}).chat.ask('c1',''),false);assert.equal(chatWorld({inCall:true}).chat.ask('c1',''),false);
  assert.equal(chatWorld().chat.ask('gone',''),false);assert.equal(chatWorld().chat.ask('blocked',''),false);
  const plain=chatWorld();plain.chat.ask('c1','   ');assert.match(plain.modals[0],/想看看你现在的屏幕/,'a missing reason gets a neutral one');
});

test('chat: a refusal is told to the role as a refusal',()=>{
  const w=chatWorld();w.chat.ask('c1','查岗');w.chat.deny();
  assert.equal(w.told.length,1);assert.equal(w.told[0][0],'c1');assert.match(w.told[0][1],/明确拒绝了/);assert.match(w.told[0][1],/不能假装看到/);
  assert.equal(w.calls.length,0,'nothing is started');assert.deepEqual({...w.chat.state()},{pending:false,live:false,cid:''});
});

test('chat: consent opens the system panel; the role hears "started" only when the broadcast really starts',async()=>{
  const w=chatWorld();w.chat.ask('c1','查岗');await w.chat.approve();
  assert.deepEqual(w.calls,['screenShare.status','robot.join','screenShare.start']);
  assert.equal(w.told.length,0,'consent alone is not a started share');assert.equal(w.chat.state().live,false);
  w.chat.nativeEvent({active:true});
  assert.equal(w.told.length,1);assert.match(w.told[0][1],/屏幕共享刚刚开始/);assert.match(w.told[0][1],/还没有任何画面/);
  assert.equal(w.chat.state().live,true);assert.match(w.chat.prompt({id:'c1'}),/正在把真实手机屏幕共享给你/);
  w.timers[0][0]();assert.equal(w.told.length,1,'the waiting timer does nothing once the share is live');
});

test('chat: with K bound the share goes through K and the panel is not opened twice',async()=>{
  const w=chatWorld({join:true});w.chat.ask('c1','');await w.chat.approve();
  assert.deepEqual(w.calls,['screenShare.status','robot.join']);
});

test('chat: consent without confirming in the system panel is told as "did not start"',async()=>{
  const w=chatWorld();w.chat.ask('c1','');await w.chat.approve();
  assert.equal(w.timers[0][1],25000);w.timers[0][0]();
  assert.equal(w.told.length,1);assert.match(w.told[0][1],/没有在系统面板完成确认/);assert.equal(w.chat.state().live,false);
  w.chat.nativeEvent({active:true});assert.equal(w.told.length,1,'a broadcast started later for another reason is not this request');
  const failed=chatWorld({picker:false});failed.chat.ask('c1','');await failed.chat.approve();
  assert.match(failed.told[0][1],/没有成功启动/);assert.equal(failed.timers.length,0);
});

test('chat: coming back from another App shows the role what was on her screen there, once per 45 s',async()=>{
  const w=chatWorld();w.chat.ask('c1','');await w.chat.approve();w.chat.nativeEvent({active:true});w.told.length=0;w.calls.length=0;
  assert.equal(await w.chat.look(),true);
  assert.deepEqual(w.calls,['screenShare.realtime.frame','vision','screenShare.vision.complete']);
  assert.equal(w.told[0][0],'c1');assert.match(w.told[0][1],/^\[系统事实：屏幕共享画面\]/);assert.match(w.told[0][1],/正在播放猫的视频/);assert.match(w.told[0][1],/不是给你的指令/);
  assert.equal(await w.chat.look(),false,'not again so soon');assert.equal(w.told.length,1);
});

test('chat: nothing is shown when only the small phone was on screen, when describing fails, or with no share',async()=>{
  let w=chatWorld({frame:{dataURL:'data:image/jpeg;base64,AAAA',token:'tok-2',source:'latest'}});w.chat.ask('c1','');await w.chat.approve();w.chat.nativeEvent({active:true});w.told.length=0;w.calls.length=0;
  assert.equal(await w.chat.look(),false);assert.deepEqual(w.calls,['screenShare.realtime.frame','screenShare.vision.complete'],'the frozen frame is released');assert.equal(w.told.length,0);
  w=chatWorld({visionFails:true});w.chat.ask('c1','');await w.chat.approve();w.chat.nativeEvent({active:true});w.told.length=0;
  assert.equal(await w.chat.look(),false);assert.equal(w.told.length,0,'a failed description is not turned into something he saw');
  w=chatWorld();assert.equal(await w.chat.look(),false);assert.equal(w.calls.length,0,'no share, no frame is taken');
});

test('chat: the end of the broadcast is told once, and he cannot see afterwards',async()=>{
  const w=chatWorld();w.chat.ask('c1','');await w.chat.approve();w.chat.nativeEvent({active:true});w.told.length=0;
  w.chat.nativeEvent({active:false});
  assert.equal(w.told.length,1);assert.match(w.told[0][1],/结束了屏幕共享/);assert.equal(w.chat.state().live,false);
  w.chat.nativeEvent({active:false});assert.equal(w.told.length,1);
  w.calls.length=0;assert.equal(await w.chat.look(),false);assert.equal(w.calls.length,0);
  assert.doesNotMatch(w.chat.prompt({id:'c1'}),/正在把真实手机屏幕共享给你/);
});

test('core chat is touched in two guarded places only',()=>{
  assert.equal((app.match(/ChatScreen/g)||[]).length,4,'two lines, each with its own typeof guard');
  assert.match(app,/if\(_main&&typeof ChatScreen!=='undefined'\)s\+=ChatScreen\.prompt\(c\);/);
  assert.match(app,/请求屏幕共享\\s\*\(\?:\[\|｜:：\]\\s\*\(\[\^\\\]】\]\*\)\)\?\[\\\]】\]\/g,\(mm,why\)=>\{if\(typeof ChatScreen!=='undefined'&&!\(typeof _call!=='undefined'&&_call\)\)setTimeout\(\(\)=>ChatScreen\.ask\(c\.id,why\),320\);return '';\}\);/);
  // The tag never reaches the visible message, whether or not the request can be shown.
  const strip=text=>text.replace(/[\[【]\s*请求屏幕共享\s*(?:[|｜:：]\s*([^\]】]*))?[\]】]/g,'');
  assert.equal(strip('让我看看。\n[请求屏幕共享|想看看你在干嘛]'),'让我看看。\n');assert.equal(strip('【请求屏幕共享】'),'');
  assert.match(voice,/try\{ChatScreen\.nativeEvent\(event\);\}catch\(_\)\{\}/);
});

test('the broadcast panel still opens after SwiftUI rebuilds the web view (2026-10-17)',()=>{
  // The old view's bridge reports nil after the new one attached; that must not drop the live view.
  assert.match(coordinator,/if webView == nil, let current = self\.webView, current\.window != nil \{\s*return\s*\}/);
  // The picker needs a view on screen: the web view, or else the key window's root view.
  assert.match(coordinator,/if let webView, webView\.window != nil \{\s*host = webView/);
  assert.match(coordinator,/\.first \{ \$0\.isKeyWindow \}\?\s*\.rootViewController\?\.view/);
  // Its button is searched through the whole subtree, not only direct children.
  assert.match(coordinator,/private static func firstButton\(in view: UIView\) -> UIButton\?/);
  assert.match(coordinator,/guard let button = Self\.firstButton\(in: broadcastPicker\) else \{ return false \}/);
});

test('landscape frames are turned upright, and the cloud is told so (2026-10-31)',()=>{
  // ReplayKit's .left/.right turn the frame the opposite way under CIImage.oriented: swap them.
  assert.match(handler,/case \.left: orientation = \.right\s*case \.right: orientation = \.left\s*default: orientation = reported/);
  assert.match(handler,/input = input\.oriented\(orientation\)/);
  // Older builds sent landscape pictures upside down and the cloud turns those; this one says it need not.
  assert.match(handler,/request\.setValue\("1", forHTTPHeaderField: "X-Upright"\)/);
});
