import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const app=read('app.js');
const html=read('小手机.html');
const privateApp=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
const privateHtml=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html');
const releaseVersion=source=>Number(source.match(/const APP_VER='v(\d+)/)?.[1]||0);

function lineFunction(name){
  const match=app.match(new RegExp(`^function ${name}\\([^\\n]+$`,'m'));
  assert.ok(match,`missing ${name}`);
  return match[0];
}
function functionSource(name){
  let start=app.indexOf('function '+name+'(');
  if(start<0)start=app.indexOf('async function '+name+'(');
  assert.ok(start>=0,`missing ${name}`);
  const nextFunction=app.indexOf('\nfunction ',start+10);
  const nextAsync=app.indexOf('\nasync function ',start+10);
  const ends=[nextFunction,nextAsync].filter(x=>x>=0);
  return app.slice(start,ends.length?Math.min(...ends):app.length).trim();
}

test('role call video is device-local Blob media and cannot take the call audio route',()=>{
  assert.match(app,/视频通话角色画面/);
  assert.match(app,/只保存在当前设备/);
  assert.match(functionSource('roleCallLoopVideoSave'),/await imgPut\(key,file\)/);
  assert.match(functionSource('roleCallLoopVideoSave'),/await imgGet\(key\)/);
  assert.doesNotMatch(functionSource('roleCallLoopVideoSave'),/FileReader|readAsDataURL|base64/i);
  const visual=lineFunction('callRoleVisualHTML');
  assert.match(visual,/muted loop playsinline webkit-playsinline disablepictureinpicture/);
  assert.doesNotMatch(visual,/autoplay/,'role media only starts after the active visible call is attached');
  const play=lineFunction('callRoleLoopPlay');
  assert.match(play,/v\.muted=true/);
  assert.match(play,/v\.volume=0/);
  assert.match(play,/audioTracks/);
  assert.doesNotMatch(play,/stopCallMediaAudio|audioRouteReset|speechSynthesis|tts|callAI/);
});

test('role video pauses on background without touching voice, camera, screen share or the call itself',()=>{
  const pause=lineFunction('callRoleLoopPause');
  const release=lineFunction('callRoleLoopRelease');
  assert.match(pause,/v\.pause\(\)/);
  assert.doesNotMatch(pause,/stopCallMediaAudio|callVideoCameraStop|callScreenShareSet|callHFStop|hangupCall/);
  assert.match(lineFunction('endCallTimers'),/callRoleLoopRelease\(\)/,'the Blob URL is released only with the established end lifecycle');
  assert.match(app,/document\.addEventListener\('visibilitychange',\(\)=>\{if\(document\.hidden\)callRoleLoopPause\(true\)/);
  assert.match(functionSource('renderCall'),/if\(_call\.min&&_call\.state!=='incoming'\)\{callRoleLoopPause\(false\)/);
  assert.doesNotMatch(release,/stopCallMediaAudio|audioRouteReset|callVideoCameraStop|callScreenShareSet/);
});

test('active video calls swap the role visual and the user inset like WeChat',()=>{
  const render=functionSource('renderCall');
  assert.match(render,/role-visual-expanded/);
  assert.match(render,/callRoleVisualToggle\(\)/);
  assert.match(render,/callSelfAvatarHTML\(\)/);
  assert.match(render,/callRoleLoopAttach\(c\)/);
  assert.match(functionSource('callPersist'),/roleVisualExpanded:!!_call\.roleVisualExpanded/);
  assert.match(functionSource('restoreActiveCall'),/roleVisualExpanded:!!p\.roleVisualExpanded/);
  assert.match(html,/\.callscreen\.video\.active\.role-visual-expanded \.cav\.call-role-visual\{inset:0/);
  assert.match(html,/\.callscreen\.video\.active\.role-visual-expanded \.call-camera-preview\.show/);
  assert.match(html,/\.call-self-avatar\{/);
});

test('automatic memory accepts grounded durable facts and rejects copied fragments',()=>{
  const sandbox={
    S:{me:{name:'North'}},
    String,Math,Set,
    aboutMeNoteText(value){let v=String(value||'').replace(/\s+/g,' ').trim();return v.replace(/我/g,'North').replace(/你/g,'对方');},
    memoryOperationalEventOnly(){return false;},
  };
  vm.runInNewContext(
    lineFunction('memoryImportantCandidate')+'\n'+
    lineFunction('memoryTerms')+'\n'+
    lineFunction('memoryCandidateQuality')+'\n'+
    lineFunction('memoryCandidateGrounded')+'\n'+
    'globalThis.quality=memoryCandidateQuality;globalThis.grounded=memoryCandidateGrounded;',sandbox,
  );
  assert.equal(sandbox.quality('宝宝喜欢喝燕麦牛奶粥'),true);
  assert.equal(sandbox.quality('宝宝喜欢郁金香花'),true);
  assert.equal(sandbox.quality('婚期定在2026年12月25日圣诞节'),true);
  assert.equal(sandbox.quality('North养了一只叫米香的猫'),true);
  assert.equal(sandbox.quality('个屁了...早干什么去了'),false);
  assert.equal(sandbox.quality('为什么现在才回来？'),false);
  const c={name:'先生'};
  assert.equal(sandbox.grounded(c,'宝宝喜欢喝燕麦牛奶粥','我喜欢喝燕麦牛奶粥',''),true);
  assert.equal(sandbox.grounded(c,'婚期定在2026年12月25日','我们把婚期定在圣诞节','婚期就是2026年12月25日。'),true);
  assert.equal(sandbox.grounded(c,'North养了一只叫米香的猫','我刚才只是说今天很累','早点休息。'),false);
});

test('online, call and offline memory tags all use the same evidence gate',()=>{
  assert.match(app,/rememberFromConversation\(c,mm\[1\],_userText,content\)/);
  assert.match(app,/rememberFromConversation\(c,tx,\(_luc&&msgToText\(_luc\)\)\|\|'',content\)/);
  assert.match(lineFunction('offlineApplyMemoryTags'),/rememberFromConversation\(c,tx,userText,full\)/);
  assert.match(app,/不能复制聊天原句/);
  assert.match(app,/不得保存疑问、反问、辱骂、情绪碎片、截断的半句话/);
});

test('root and private business sources are synchronized after release sync',()=>{
  const webVersion=releaseVersion(app),privateVersion=releaseVersion(privateApp);
  assert.ok(privateVersion>=webVersion,`private bundle v${privateVersion} must contain public web v${webVersion}`);
  for(const name of ['roleCallLoopVideoSave','renderCall','callPersist','restoreActiveCall']){
    assert.ok(privateApp.includes(functionSource(name)),`private call function differs: ${name}`);
  }
  for(const name of ['callRoleVisualHTML','callRoleLoopPlay','callRoleLoopPause','callRoleLoopRelease','endCallTimers','memoryImportantCandidate','memoryTerms','memoryCandidateQuality','memoryCandidateGrounded']){
    assert.ok(privateApp.includes(lineFunction(name)),`private call or memory line differs: ${name}`);
  }
  const privateMemory=privateApp.match(/^function offlineApplyMemoryTags\([^\n]+$/m)?.[0]||'';
  assert.match(privateMemory,/rememberFromConversation\(c,tx,userText,full\)/);
  assert.match(privateMemory,/if\(changed\)save\(\)/);
  const rootCss=html.slice(html.indexOf('/* ===== 通话 ===== */'),html.indexOf('.spybanner'));
  const privateCss=privateHtml.slice(privateHtml.indexOf('/* ===== 通话 ===== */'),privateHtml.indexOf('.spybanner'));
  assert.equal(privateCss,rootCss);
});
