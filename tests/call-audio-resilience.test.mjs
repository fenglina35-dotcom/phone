import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false,regex=false,regexClass=false,prev='';
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(regex){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='[')regexClass=true;else if(ch===']')regexClass=false;else if(ch==='/'&&!regexClass)regex=false;continue;}
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&source[i+1]!=='/'&&source[i+1]!=='*'&&/[=(,:;!&|?\[{]/.test(prev)){regex=true;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
    if(!/\s/.test(ch))prev=ch;
  }
  throw new Error(`unterminated ${name}`);
}

const durationContext=vm.createContext({Math,Number,VOICE_MAX_SECONDS:60});
for(const name of ['stripSpoken','ttsCleanBase','voiceEstimatedSeconds','callSpeechDurationPlausible'])vm.runInContext(functionSource(name),durationContext);
assert.equal(durationContext.callSpeechDurationPlausible('嗯？',.2),true,'very short interjections must remain valid');
assert.equal(durationContext.callSpeechDurationPlausible('路上注意安全，到了跟我说一声好不好，我在这里等你消息。',.8),false,'obviously truncated Chinese audio must be rejected');
assert.equal(durationContext.callSpeechDurationPlausible('路上注意安全，到了跟我说一声好不好，我在这里等你消息。',5),true,'normal Chinese audio must remain valid');
assert.equal(durationContext.callSpeechDurationPlausible('Please remember your umbrella when you go outside tonight.',.5),false,'obviously truncated English audio must be rejected');
assert.doesNotMatch(functionSource('callSpeechDurationPlausible'),/\\p\{/,'older Android engines must not parse Unicode property escapes');

let intervalCallback=null,started=false,settled=false;
const playbackSource={connect(){},start(){started=true;},stop(){if(this.onended)this.onended();}};
const playbackAudio={
  state:'running',currentTime:0,destination:{},resumeCalls:0,
  resume(){this.resumeCalls++;return Promise.resolve();},
  createBufferSource(){return playbackSource;},
  createGain(){return{gain:{value:1},connect(){}};},
};
const playbackContext=vm.createContext({
  _audio:playbackAudio,_curSrc:null,Math,Number,String,Date,Promise,
  ensureAudio(){},volMul:()=>1,
  setTimeout,clearTimeout,
  setInterval(fn){intervalCallback=fn;return 1;},clearInterval(){},
});
vm.runInContext(functionSource('stopBufSource'),playbackContext);
vm.runInContext('async '+functionSource('callAudioReady'),playbackContext);
vm.runInContext('async '+functionSource('playBufWait'),playbackContext);
const playback=playbackContext.playBufWait({duration:2},()=>{}).then(value=>{settled=true;return value;});
await Promise.resolve();
assert.equal(started,true);
playbackAudio.state='suspended';
intervalCallback();
await Promise.resolve();
assert.equal(settled,false,'a suspended AudioContext must not advance to the next sentence');
assert.equal(playbackAudio.resumeCalls,1,'suspended playback should request a safe resume');
playbackAudio.state='running';
playbackAudio.currentTime=4;
intervalCallback();
assert.equal(await playback,true,'playback should finish after the real audio clock catches up');

let generateCalls=0,refundCalls=0;
const retryContext=vm.createContext({
  ttsUseRelay:()=>true,
  async ttsArr(){generateCalls++;return{attempt:generateCalls};},
  async decodeBuf(ab){return{duration:ab.attempt===1?.2:4};},
  callSpeechDurationPlausible:(_text,duration)=>duration>=1,
  async ttsRefundAudio(){refundCalls++;return true;},
});
vm.runInContext('async '+functionSource('prepareCallSpeech'),retryContext);
const retried=await retryContext.prepareCallSpeech('这是一句足够长的测试语音',{},{});
assert.equal(generateCalls,2,'a confirmed-refunded truncated relay response should retry once');
assert.equal(refundCalls,1);
assert.equal(retried.buf.duration,4);

generateCalls=0;refundCalls=0;
retryContext.ttsRefundAudio=async()=>{refundCalls++;return false;};
const notRetried=await retryContext.prepareCallSpeech('这是一句足够长的测试语音',{},{});
assert.equal(notRetried,null);
assert.equal(generateCalls,1,'relay synthesis must not retry when refund was not confirmed');
assert.equal(refundCalls,1);

let now=5000,created=0,closed=0,resumed=0;
class FakeAudioContext{
  constructor(){created++;this.state='suspended';}
  close(){closed++;this.state='closed';}
  resume(){resumed++;return Promise.resolve();}
}
const staleAudio={state:'suspended',close(){closed++;this.state='closed';},resume(){resumed++;return Promise.resolve();}};
const recoveryContext=vm.createContext({
  _audio:staleAudio,_audioBornAt:0,_curSrc:{},window:{AudioContext:FakeAudioContext},Date:{now:()=>now},Promise,
});
vm.runInContext(functionSource('ensureAudio'),recoveryContext);
const recovered=recoveryContext.ensureAudio(true);
assert.notEqual(recovered,staleAudio,'a stale suspended context should be replaced on the next user gesture');
assert.equal(closed,1);
assert.equal(created,1);
assert.equal(recoveryContext._curSrc,null);
now+=200;
assert.equal(recoveryContext.ensureAudio(true),recovered,'the pointerdown and click from one gesture must reuse the fresh context');
assert.equal(created,1,'one gesture must not repeatedly rebuild the audio context');
assert.ok(resumed>=2,'audio recovery should request resume on both the stale replacement and the follow-up gesture');

let pulseNow=9000,pulseStarts=0,pulseCloses=0,pulseCancels=0;
const pulseSamples=new Float32Array(32);
const runningAudio={
  state:'running',destination:{},
  resume(){return Promise.resolve();},
  close(){pulseCloses++;this.state='closed';return Promise.resolve();},
  createBuffer(){return{getChannelData(){return pulseSamples;}};},
  createBufferSource(){return{connect(){},start(){pulseStarts++;}};},
};
const pulseContext=vm.createContext({
  _audio:runningAudio,_audioBornAt:pulseNow,_audioPulseAt:0,_curSrc:null,
  window:{AudioContext:FakeAudioContext,speechSynthesis:{cancel(){pulseCancels++;}}},
  speechSynthesis:{cancel(){pulseCancels++;}},Date:{now:()=>pulseNow},Promise,
});
vm.runInContext(functionSource('stopBufSource'),pulseContext);
vm.runInContext(functionSource('ensureAudio'),pulseContext);
vm.runInContext(functionSource('audioUnlock'),pulseContext);
vm.runInContext(functionSource('audioRouteReset'),pulseContext);
pulseContext.audioUnlock();
assert.equal(pulseStarts,1,'a context reporting running must still receive a real unlock pulse');
assert.ok(pulseSamples[0]>0&&pulseSamples[0]<.00002,'the unlock pulse must not be optimized away as an empty buffer');
pulseContext.audioUnlock();
assert.equal(pulseStarts,1,'one tap must not create duplicate unlock sources');
pulseNow+=181;
pulseContext.audioUnlock();
assert.equal(pulseStarts,2,'a later user gesture may repair a silent output route again');
pulseContext.audioRouteReset(false);
assert.equal(pulseCloses,1,'ending a call must release the communication AudioContext');
assert.equal(pulseContext._audio,null);
assert.ok(pulseCancels>=1,'ending a call must also stop device speech output');

assert.match(source,/visibilitychange/);
assert.match(source,/window\.addEventListener\('pageshow',\(\)=>\{audioMarkWakeRequired\(\);audioProbeMicPermission\(\);\}/);
assert.doesNotMatch(source,/pageshow[\s\S]{0,140}audioKick\(\)/,'returning to the app must not seize the active media session');
assert.match(functionSource('audioKick'),/_audioWakeRequired&&mic\)audioHardWake\(true\)/,'only an explicit call-microphone gesture may hard-wake media channels');
assert.doesNotMatch(functionSource('audioKick'),/audioHardWake\(mic\)/,'ordinary navigation touches must not prime HTMLAudio channels');
let kickUnlocks=0,kickHardWakes=0;
const kickContext=vm.createContext({_audioWakeRequired:true,_ma:null,_mWantPlay:false,audioUnlock(){kickUnlocks++;},audioHardWake(){kickHardWakes++;}});
vm.runInContext(functionSource('audioKick'),kickContext);
kickContext.audioKick({target:{closest(){return null;}}});
assert.equal(kickUnlocks,1,'ordinary app navigation should only resume WebAudio');
assert.equal(kickHardWakes,0,'ordinary app navigation must leave background media alone');
kickContext.audioKick({target:{closest(){return {};}}});
assert.equal(kickHardWakes,1,'the call microphone keeps its dedicated iOS repair path');
assert.match(functionSource('audioHardWake'),/audioRouteReset\(true\)[\s\S]*audioMediaWake\(\)[\s\S]*if\(!skipMic\)audioMicRouteCycle\(\)/,'hard wake must rebuild WebAudio and only cycle the microphone for non-mic gestures');
assert.match(functionSource('audioMicRouteCycle'),/!_audioMicGranted/,'touch recovery must never request a new microphone permission');
assert.match(functionSource('audioKick'),/closest\('\[data-call-mic\]'\)/,'the call microphone gesture must not be pre-empted by route cycling');
assert.match(functionSource('audioMicRouteCancel'),/getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/,'temporary microphone streams must be releasable');
assert.match(functionSource('callHFStart'),/^function callHFStart\(\)\{audioMicRouteCancel\(\)/);
assert.match(functionSource('audioProbeMicPermission'),/query\(\{name:'microphone'\}\)/);
assert.match(functionSource('audioProbeMicPermission'),/enumerateDevices\(\)/,'Android browsers without Permissions API should still detect an already-authorized microphone');
assert.match(functionSource('callHFToggle'),/callHFStop\(\);audioRouteReset\(false\)/);
assert.match(functionSource('callHFStop'),/typeof _callSR\.abort==='function'/,'ending recognition should release the Android communication route immediately');
assert.match(functionSource('callHFStop'),/audioMicRouteCancel\(\)/,'hanging up must also release a pending route-cycle microphone stream');
assert.match(functionSource('declineCall'),/audioRouteReset\(false\)/);
assert.match(functionSource('hangupCall'),/audioRouteReset\(false\)/);
assert.match(functionSource('speakWait'),/playCallMediaWait\(ready\.ab,ready\.buf,start\)/,'API call speech must use the iOS-safe media channel');
assert.match(functionSource('playCallMediaWait'),/a\.play\(\)/);
assert.match(functionSource('playCallMediaWait'),/playCallFallbackWait\(buf,onStart\)/,'WebAudio remains a bounded fallback');
assert.match(functionSource('playCallFallbackWait'),/stopBufSource\('call-fallback-timeout'\)/,'a suspended fallback cannot hold the call reply queue indefinitely');
assert.match(functionSource('playCallMediaWait'),/2500/,'a blocked iOS media start must fall back quickly instead of freezing the reply queue');
assert.match(functionSource('endCallTimers'),/stopCallMediaAudio/,'hanging up must stop any prepared call media');
assert.match(source,/pagehide',\(\)=>\{roleBackgroundFlush\(\);audioMarkWakeRequired\(\);if\(_callHF&&!callHFMayStayInNativeBackground\(\)\)\{callHFStop\(\);audioRouteReset\(false\);\}/);

const failureContext=vm.createContext({String,Number});
vm.runInContext(functionSource('callFailureText'),failureContext);
assert.equal(failureContext.callFailureText({status:401,message:'unauthorized',source:'external-chat'}),'(当前聊天接口密钥无效或没有该模型权限，请检查聊天接口设置)');
assert.equal(failureContext.callFailureText({status:401,message:'unauthorized',raw:'Insufficient credits',source:'external-chat'}),'(当前聊天接口账户余额不足，请到接口平台充值)');
assert.equal(failureContext.callFailureText({status:402,message:'AI点数不足',raw:'no-balance',source:'ai-core'}),'(AI 账户点数不足，请充值后再通话)');
assert.equal(failureContext.callFailureText({status:429,message:'Too many requests',source:'external-chat'}),'(当前聊天接口请求过于频繁或达到平台限额，请稍后再试)');
assert.equal(failureContext.callFailureText({network:true,message:'fetch failed'}),'(未取得可用的接口响应，尚不能确定连接失败原因，请复制请求故障诊断)');
assert.equal(failureContext.callFailureText(new Error('request timeout')),'(请求中断或等待超时，请复制请求故障诊断)');
assert.match(functionSource('chatAPI'),/e\.status=res\.status;e\.data=d\|\|null;e\.raw=raw;e\.source='external-chat'/,'direct chat errors must preserve upstream status and detail for the call UI');
assert.match(functionSource('aiRelay'),/e\.source='ai-core'/,'built-in AI failures must identify their real source');
assert.doesNotMatch(functionSource('callFailureText'),/通话服务授权失败，请检查 AI 账户/,'call failures must not collapse unrelated causes into the AI account hint');
assert.doesNotMatch(source,/\(信号不好…\)/,'call failures must not hide every root cause behind a generic signal message');
console.log('call audio resilience tests passed');
