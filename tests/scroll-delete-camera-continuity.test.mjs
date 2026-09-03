import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const privateApp=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');
const wechat=fs.readFileSync(new URL('../wechat-me.js',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const next=app.indexOf('\nfunction ',start+10);
  return app.slice(start,next<0?app.length:next).trim();
}

test('record and social pages participate in render scroll restoration',()=>{
  for(const source of [app,privateApp]){
    const start=source.indexOf('function renderScrollTarget(');
    const target=source.slice(start,source.indexOf('\nfunction ',start+10));
    for(const marker of ["wxalbum:['.wxalbum-page',0]","wxfavorites:['.wxfav-page',0]","spy:['spyAppScroll',0]","x:['xscroll',0]","dy:['dyfeed',0]"]){
      assert.ok(target.includes(marker),`missing scroll target ${marker}`);
    }
    assert.match(source,/id="spyAppScroll" data-render-scroll-key="spy:/);
    assert.match(source,/data-render-scroll-key="x:/);
    assert.match(source,/data-render-scroll-key="dy:/);
  }
  assert.match(functionSource('renderScrollElement'),/querySelector\(t\.id\)/,'class-based legacy pages can be restored without rewriting their templates');
  assert.match(functionSource('spyAppView'),/id="spyAppScroll" data-render-scroll-key="spy:/);
  assert.match(functionSource('renderX'),/data-render-scroll-key="x:/);
  assert.match(functionSource('dyFeedView'),/data-render-scroll-key="dy:/);
  assert.match(wechat,/class="scroll wxalbum-page"/);
  assert.match(wechat,/class="scroll wxfav-page"/);
});

test('dynamic page identity restores the same list but not a newly selected tab',()=>{
  const old={scrollTop:740,scrollHeight:1300,clientHeight:480,isConnected:true,getAttribute:name=>name==='data-render-scroll-key'?'spy:c1:lifelog':''};
  let current=old;
  const context=vm.createContext({
    document:{getElementById:id=>id==='spyAppScroll'?current:null,querySelector:()=>null},
    requestAnimationFrame:fn=>fn(),
    _scrollBottomOnce:{},
  });
  vm.runInContext([
    functionSource('renderPageKey'),
    functionSource('renderScrollTarget'),
    functionSource('renderScrollStateKey'),
    functionSource('renderScrollElement'),
    functionSource('captureRenderScroll'),
    functionSource('restoreRenderScroll'),
    'this.capture=captureRenderScroll;this.restore=restoreRenderScroll;'
  ].join('\n'),context);
  const state=context.capture({p:'spy',id:'c1'});
  current={scrollTop:0,scrollHeight:1200,clientHeight:480,isConnected:true,getAttribute:name=>name==='data-render-scroll-key'?'spy:c1:lifelog':''};
  context.restore({p:'spy',id:'c1'},state);
  assert.equal(current.scrollTop,740,'deleting a lower item keeps the notebook at its prior position');
  current={scrollTop:0,scrollHeight:1200,clientHeight:480,isConnected:true,getAttribute:name=>name==='data-render-scroll-key'?'spy:c1:grudge':''};
  context.restore({p:'spy',id:'c1'},state);
  assert.equal(current.scrollTop,0,'switching to another notebook does not inherit the old position');
});

test('private speech rotation preserves the active camera audio session',()=>{
  assert.match(bridge,/beginRecognition\(\s*language: String,\s*preserveAudioSession: Bool = false\s*\)/s);
  assert.match(bridge,/if !preserveAudioSession \{\s*let audioSession = AVAudioSession\.sharedInstance\(\)/s);
  assert.match(bridge,/rotateRecognition[\s\S]*?beginRecognition\(\s*language: self\.language,\s*preserveAudioSession: true\s*\)/);
  assert.match(bridge,/cleanupCurrentRecognition\(deactivateAudioSession: false\)/,'continuous chunks keep the shared play-and-record session active');
});

test('a final hands-free sentence probes and repairs only a truly stalled private camera',()=>{
  const verify=functionSource('callVideoCameraVerifyAfterSpeech');
  const start=functionSource('callVideoCameraStart');
  const stop=functionSource('callVideoCameraStop');
  const handsFree=functionSource('callHFStart');
  assert.match(handsFree,/hfHeard\(t,meta\);callVideoCameraVerifyAfterSpeech\(\)/);
  assert.match(verify,/privateNativeAppOn\(\)/);
  assert.match(verify,/currentTime/);
  assert.match(verify,/callVideoCameraStart\(_callCameraFacing,\{quiet:true,repair:true\}\)/);
  assert.match(verify,/callScreenShareOn\(\)/,'camera repair never interferes with screen sharing');
  assert.match(start,/if\(!opt\.quiet\)toast/,'automatic repair does not announce a second manual camera opening');
  assert.match(stop,/_callCameraRepairToken\+\+/,'closing or replacing the camera cancels stale repair probes');
  assert.match(privateApp,/hfHeard\(t,meta\);callVideoCameraVerifyAfterSpeech\(\)/,'the private bundle must contain the camera continuity probe');
});
