import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {read as currentRead, fnSource, BUNDLES} from './_helpers.mjs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('app.js');
const serviceWorker=read('sw.js');
const manifest=read('native/private-small-phone/Resources/private-phone-web.manifest.json');
const ringtone=fs.readFileSync(new URL('../assets/incoming-wechat-call-default-v2.mp3',import.meta.url));
const bundledRingtone=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/assets/incoming-wechat-call-default-v2.mp3',import.meta.url));
const bundledApp=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const oldRingtones=[
  'incoming-morning-chime-v1.wav',
  'incoming-soft-ring-v1.wav',
  'incoming-warm-night-v1.wav',
  'incoming-wechat-ding-low-v1.wav',
  'incoming-wechat-ding-v1.wav'
];

function functionSource(name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

test('the exact new user MP3 is the only bundled WeChat incoming-call ringtone',()=>{
  assert.equal(ringtone.length,144468);
  assert.equal(crypto.createHash('sha256').update(ringtone).digest('hex'),'e25d9464a128b5991d6b688e07c98233cab83c73a64143a8dd9315bed3d36bba');
  assert.deepEqual(bundledRingtone,ringtone);
  assert.match(bundledApp,/const INCOMING_RING_URL='assets\/incoming-wechat-call-default-v2\.mp3'/);
  assert.match(source,/const INCOMING_RING_URL='assets\/incoming-wechat-call-default-v2\.mp3'/);
  assert.match(serviceWorker,/\.\/assets\/incoming-wechat-call-default-v2\.mp3/);
  assert.match(manifest,/assets\/incoming-wechat-call-default-v2\.mp3/);
  for(const file of oldRingtones){
    assert.equal(fs.existsSync(new URL('../assets/'+file,import.meta.url)),false,file+' must be removed');
    assert.doesNotMatch(source,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.doesNotMatch(serviceWorker,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.doesNotMatch(manifest,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('preferences keep the user MP3 as default and restore the music-library override',()=>{
  assert.match(source,/微信来电铃声/);
  assert.match(source,/默认使用本次 MP3，也可以从音乐库选择/);
  assert.match(source,/incomingRingMusicModal|incomingRingSongSelect|incomingRingMusicStart/);
  assert.match(source,/从音乐库选择来电铃声/);
  assert.match(source,/incomingRingSongId|incomingRing:'default'/);
  assert.doesNotMatch(source,/INCOMING_RING_CHOICES|微信高低轻响|清脆双响|木质叮咚/);
});

test('incoming calls use the selected library song or fixed MP3 fallback with iOS media fallback and vibration',()=>{
  assert.equal(functionSource('incomingRingUrl'),"function incomingRingUrl(){return INCOMING_RING_URL;}");
  const start=functionSource('ringStart');
  const assetStart=functionSource('ringAssetStart');
  const selectedStart=functionSource('incomingRingMusicStart');
  const sharedStart=functionSource('incomingRingAssetStart');
  assert.match(sharedStart,/ringToneElement\(\)/);
  assert.match(sharedStart,/uiToneElement\(\)/);
  assert.match(start,/S\.settings\.sound/);
  assert.match(start,/navigator\.vibrate/);
  assert.match(start,/incomingRingKey\(\)==='music'/);
  assert.match(selectedStart,/incomingRingMusicSource\(\)/);
  assert.match(selectedStart,/incomingRingUrl\(\)/);
  assert.match(assetStart,/a\.loop=true/);
  assert.match(assetStart,/a\.src=url\|\|incomingRingUrl\(\)/);
  assert.doesNotMatch(start+assetStart+sharedStart,/playMediaTone|webToneSequence/);
});

test('sound-off incoming calls do not start ringtone playback',()=>{
  const start=functionSource('ringStart');
  const soundCheck=start.indexOf('if(S.settings.sound)');
  const selected=start.indexOf("incomingRingKey()==='music'");
  const fallback=start.indexOf('incomingRingAssetStart(incomingRingUrl(),false)');
  assert.ok(soundCheck>=0&&selected>soundCheck&&fallback>soundCheck);
});

for(const [name,file] of BUNDLES)test(`${name}: missed calls require the presented session and current account`,()=>{
 const src=currentRead(file),rows=[],timers=[],events=[],role={id:'r',name:'角色'};let aid='main',banner={className:'',innerHTML:''};
 const c=vm.createContext({S:{me:{name:'测试'},settings:{}},Date,Math,actId:()=>aid,uid:()=>String(timers.length+1),
  cohabCallRestricted:()=>false,roleOnlineProactiveBlocked:()=>false,cinemaRoleOccupied:()=>false,getC:()=>role,
  $:()=>banner,av:()=>'',esc:v=>v,svgIc:()=>'',roleServerPushCallStarted:()=>{},initAudio:()=>{},ringStart:()=>{},appNotify:()=>{},
  setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},ringStop:()=>{},endCallTimers:()=>{},audioRouteReset:()=>{},hideCallBanner:()=>{},callClearPersist:()=>{},renderCall:()=>{},roleServerPushCallEnded:()=>{},phAddRecent:()=>{},phRoleNumber:()=>'',msgs:()=>rows,save:()=>{},cur:()=>({p:'home'}),completedTurnContinuation:()=>'',wechatNaturalCallEventNote:v=>v,scheduleFeatureReply:(...args)=>events.push(args)});
 vm.runInContext('var _call=null,_callMissT=0,_callBusy=false,_callPend=null,_callVisionPend=[],_callStatePend=null,_callStateEpoch=0;',c);
 for(const fn of ['incomingCall','showCallBanner','callMissed'])vm.runInContext(fnSource(src,fn),c);
 banner=null;assert.equal(c.incomingCall('r','voice'),false);assert.equal(c._call,null);assert.equal(timers.length,0);
 banner={className:'',innerHTML:''};assert.equal(c.incomingCall('r','voice'),true);assert.equal(banner.className,'msgbanner show');
 const oldSession=c._call.session;c._call.session='newer-session';timers[0]();assert.equal(rows.length,0,'a queued timeout from another call must not create a missed event');
 aid='other';c.callMissed('r','newer-session');assert.equal(rows.length,0,'call events never cross accounts');aid='main';
 c.callMissed('r','newer-session');c.callMissed('r',oldSession);assert.equal(rows.length,1);assert.equal(events.length,1);assert.equal(c._call,null);
 for(let i=0;i<2;i++){assert.equal(c.incomingCall('r','voice'),true);c.callMissed('r',c._call.session);}
 assert.equal(rows.length,3);assert.equal(c.incomingCall('r','video'),false,'three real unanswered calls exhaust the existing limit');aid='other';assert.equal(c.incomingCall('r','voice'),true,'another account has its own sequence');c.callMissed('r',c._call.session);aid='main';role._cbTries=0;assert.equal(c.incomingCall('r','video'),true,'a new user interaction allows a new real series');
});

for(const [name,file] of BUNDLES)test(`${name}: call facts distinguish real system records from model claims`,()=>{
 const rows=[{role:'assistant',type:'text',content:'我打了电话，你又没接'}],c=vm.createContext({msgsForAccount:()=>rows,actId:()=> 'main',_call:null});vm.runInContext(fnSource(currentRead(file),'wechatCallTruthPrompt'),c);
 assert.match(c.wechatCallTruthPrompt('r','main'),/没有系统确认的未接或拒接记录/);
 rows.push({role:'user',type:'sys',content:'未接来电 · 视频通话',time:12});assert.match(c.wechatCallTruthPrompt('r','main'),/12 未接来电/);
 c._call={id:'r',accountId:'other',state:'incoming',presented:true};assert.match(c.wechatCallTruthPrompt('r','main'),/没有正在响铃/);
 c._call.accountId='main';assert.match(c.wechatCallTruthPrompt('r','main'),/正在显示的来电邀请/);
});
