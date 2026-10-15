/* 细腻情绪与 3D 贴耳（设置 → 声音与通话，一个开关，默认关）。
   旧做法的问题（用户反馈）：笑声僵硬、笑得太勤、不合时宜的叹气、强情绪标签让声音变尖变低。
   这里锁住：开关关着时完全不改原来的语音文字；打开后只用温和标签、限量、不再硬加「哈哈」「唉」；3D 渲染真的出双耳差异且响度对齐。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app.js'),html=read('小手机.html');
function sandbox(settings={},kind='fish'){
  const ctx=vm.createContext({S:{settings,me:{name:'North'}},Math,Date,String,Array,Float32Array,ArrayBuffer,DataView,Promise,Map,RegExp,Object,setTimeout,atob:s=>Buffer.from(s,'base64').toString('binary'),
    ttsStyleKind:()=>kind,ttsCfg:()=>({}),ttsCleanBase:t=>String(t||'').replace(/[（(【][^）)】]*[）)】]/g,'').replace(/\[[^\]]*\]/g,'').replace(/\s+/g,' ').trim(),
    ttsCueKind:c=>/笑|开心/.test(c)?'laugh':/叹|难过|委屈/.test(c)?'soft':/温柔/.test(c)?'warm':/质问|生气/.test(c)?'tense':''});
  vm.runInContext(read('voice-expressive.js'),ctx);return ctx;
}

test('switched off: nothing changes (text, prompt, rendering, split)',async()=>{
  const c=sandbox({}),V=c.NorthVoiceExpressive;
  assert.equal(V.on(),false);
  assert.equal(V.performance('[轻笑]我才不信',{id:'r'},{},{cue:'轻笑'}),null,'null hands the text back to the original logic');
  assert.equal(V.prompt({id:'r'}),'');
  assert.equal(V.split('[小声]想你了'),null);
  assert.equal(await V.binaural(new ArrayBuffer(8),[],'x'),null);
  assert.match(app,/S\.settings\.voiceExpressive===true\?'on':''/,'the settings switch reflects the stored value');
  assert.match(app,/S\.settings\.voiceExpressive=S\.settings\.voiceExpressive!==true;save\(\);render\(\)/);
});

test('inline cues become gentle Fish tags in place; at most two, one sound, no fake 哈哈/唉',()=>{
  const c=sandbox({voiceExpressive:true}),V=c.NorthVoiceExpressive;
  const out=V.performance('[黏糊]你怎么才回我呀……[轻笑]我才不信。[叹气]算了[小声]想你了',{id:'r1'},{},{cue:'温柔'});
  assert.equal(out,'[sweet, clingy, drawn out] 你怎么才回我呀……[chuckling] 我才不信。算了想你了');
  assert.doesNotMatch(out,/哈哈|呵呵|唉|laughing|sobbing|shouting|angry|excited/,'no fake laugh text and no timbre-pulling tags unless explicitly asked');
  const again=V.performance('[轻笑]又来了',{id:'r1'},{},{});
  assert.equal(again,'又来了','a laugh within minutes of the last one is dropped');
  assert.equal(V.performance('[轻笑]你好',{id:'r2'},{},{}),'[chuckling] 你好','cooldown is per role');
  assert.equal(V.performance('想你了[温柔]',{id:'r3'},{},{}),'想你了','a dangling tone tag at the very end is removed');
});

test('without inline cues the old single 语气 becomes one mild leading tag, never a fake laugh or sigh',()=>{
  const c=sandbox({voiceExpressive:true}),V=c.NorthVoiceExpressive;
  assert.equal(V.performance('今天好开心',{id:'a'},{},{cue:'大笑'}),'[happy, light] 今天好开心');
  assert.equal(V.performance('没事的',{id:'b'},{},{cue:'叹气'}),'[sad, quiet] 没事的');
  assert.equal(V.performance('过来',{id:'c'},{},{cue:'温柔'}),'[gentle, tender] 过来');
  assert.equal(V.performance('嗯',{id:'d'},{},{}),'嗯');
});

test('models without inline tag support keep the original logic; ElevenLabs v3 gets its own words',()=>{
  assert.equal(sandbox({voiceExpressive:true},'minimax').NorthVoiceExpressive.performance('[轻笑]你好',{},{},{}),null);
  assert.equal(sandbox({voiceExpressive:true},'').NorthVoiceExpressive.performance('[轻笑]你好',{},{},{}),null);
  assert.equal(sandbox({voiceExpressive:true},'eleven').NorthVoiceExpressive.performance('[撒娇]抱抱',{id:'e'},{},{}),'[sweetly] 抱抱');
});

test('split keeps the transcript clean and remembers where each position tag was said',()=>{
  const V=sandbox({voiceExpressive:true}).NorthVoiceExpressive,r=V.split('[右耳]别动。[脑后][小声]我就在你后面。');
  assert.equal(r.text,'别动。我就在你后面。');
  assert.equal(r.perf,'别动。[小声]我就在你后面。');
  assert.deepEqual(JSON.parse(JSON.stringify(r.spatial)),[{at:0,tag:'右耳'},{at:3,tag:'脑后'}]);
  assert.match(V.prompt({id:'r'}),/\[轻笑\]\[叹气\]\[哽咽\]这种会出声的，一条最多一个/);
  assert.match(V.prompt({id:'r'}),/\[左耳\] \[右耳\] \[脑后\] \[面前\]/);
});

test('3D rendering produces a real left/right difference, matched loudness and a valid stereo WAV',async()=>{
  const c=sandbox({voiceExpressive:true});vm.runInContext(read('binaural-hrir.js'),c);
  const V=c.NorthVoiceExpressive,raw=await V._test.loadHrir();
  assert.equal(raw.ir.length,2*360*2*128);
  const fs=32000,n=fs*3,x=new Float32Array(n);let seed=1;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);
  for(let i=0;i<n;i++){const burst=(Math.floor(i/(fs*.4))%2===0)?1:0;x[i]=burst*rnd()*.3;}
  const out=await V.renderSamples(x,fs,raw,[{at:0,tag:'左耳'}],10);
  const e=a=>a.reduce((s,v)=>s+v*v,0);
  assert.ok(e(out.L)>e(out.R)*4,'a voice at the left ear is much louder in the left channel');
  const inE=e(x)/x.length,outE=(e(out.L)+e(out.R))/(2*out.L.length);
  /* 和 binaural_voice.py 一样：两声道合起来的能量对齐原声的两倍（每只耳朵听到的响度接近原声），峰值压在 -1 dBFS 以下 */
  let peak=0;for(const v of out.L)peak=Math.max(peak,Math.abs(v));for(const v of out.R)peak=Math.max(peak,Math.abs(v));
  assert.ok(peak<=.891,'peak stays under -1 dBFS');
  assert.ok((outE/inE>1.6&&outE/inE<2.4)||peak>=.88,'loudness follows the original voice ('+(outE/inE).toFixed(2)+')');
  assert.ok(out.L.every(Number.isFinite)&&out.R.every(Number.isFinite));
  const wav=V._test.wav16(out.L,out.R,fs),dv=new DataView(wav);
  assert.equal(String.fromCharCode(...new Uint8Array(wav,0,4)),'RIFF');assert.equal(dv.getUint16(22,true),2);assert.equal(dv.getUint32(24,true),fs);
});

test('app hooks: switch-guarded TTS text, transcript split, binaural voice notes, prompt, entry and offline cache',()=>{
  assert.match(app,/if\(typeof NorthVoiceExpressive!=='undefined'\)\{const vx=NorthVoiceExpressive\.performance\(text,o,tts,opt\);if\(vx!=null\)return vx;\}/);
  assert.match(app,/_vx=typeof NorthVoiceExpressive!=='undefined'\?NorthVoiceExpressive\.split\(vt\):null/);
  assert.match(app,/if\(_vxOn\)\{const bin=await NorthVoiceExpressive\.binaural\(ab,m\.voiceSpatial,m\.content\);if\(bin\)\{ab=bin;_mime='audio\/wav';m\.voice3d=true;\}\}/);
  assert.ok(app.includes("if(_vxOn&&(m.voicePerf||m.voiceAsk||m.voiceDirected))NorthVoiceExpressive.handPerf(m.content,m.voicePerf,m.voiceAsk,m.voiceDirected);")&&app.includes('await ttsArr(m.content,o,{cue:m.voiceCue})'),'voice notes still synthesize from m.content so the language lock keeps working');
  assert.match(app,/NorthVoiceExpressive\.prompt\(c\)/);
  assert.match(html,/<script src="voice-expressive\.js\?v=\d+"><\/script>/);
  assert.match(read('sw.js'),/'\.\/voice-expressive\.js\?v='\+BUILD/);
  assert.match(read('binaural-hrir.js'),/CC BY 4\.0/);
});

test('the switch is read from app.js script-level S (a let, not a window property)',()=>{
  /* 浏览器里实测踩到的坑：S 是 app.js 顶层的 let，不在 window 上；只读 window.S 会让开关永远是关的。 */
  const ctx=vm.createContext({Math,Date,String,Array,RegExp,Object,Map});
  vm.runInContext("let S={settings:{voiceExpressive:true},me:{name:'North'}};function ttsStyleKind(){return 'fish';}function ttsCfg(){return {};}",ctx);
  vm.runInContext(read('voice-expressive.js'),ctx);
  assert.equal(vm.runInContext('typeof window==="undefined"&&globalThis.S===undefined',ctx),true);
  assert.equal(vm.runInContext('NorthVoiceExpressive.on()',ctx),true);
  assert.match(vm.runInContext('NorthVoiceExpressive.prompt({id:"r"})',ctx),/North戴着耳机/);
});

test('the private App ships the same module, data file, hooks and switch',()=>{
  const D='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/',papp=read(D+'app.js');
  assert.equal(read(D+'voice-expressive.js'),read('voice-expressive.js'));
  assert.equal(read(D+'binaural-hrir.js'),read('binaural-hrir.js'));
  for(const f of ['index.html','小手机.html'])assert.match(read(D+f),/<script src="voice-expressive\.js\?v=\d+"><\/script>/);
  assert.match(papp,/if\(typeof NorthVoiceExpressive!=='undefined'\)\{const vx=NorthVoiceExpressive\.performance\(text,o,tts,opt\);if\(vx!=null\)return vx;\}/);
  assert.match(papp,/_vtShow=_vx\?_vx\.text:vt;let vm=voiceReplyBlocked/);
  assert.match(papp,/NorthVoiceExpressive\.binaural\(ab,m\.voiceSpatial,m\.content\)/);
  assert.match(papp,/NorthVoiceExpressive\.prompt\(c\)/);
  assert.match(papp,/S\.settings\.voiceExpressive=S\.settings\.voiceExpressive!==true;save\(\);render\(\)/);
});

test('handed-over performance text is used once for the same transcript and passes through the language lock',()=>{
  const c=sandbox({voiceExpressive:true});let locked='';c.ttsDropOffLanguage=(s)=>{locked=s;return s.replace(/[\u4e00-\u9fff]/g,'');};
  const V=c.NorthVoiceExpressive;V.handPerf('I miss you.','[撒娇]I miss you.宝贝');
  assert.equal(V.performance('I miss you.',{id:'f',voice:{lang:'英'}},{},{}),'[sweet, clingy] I miss you.');
  assert.match(locked,/\uE010\d\uE011I miss you\.宝贝/,'the lock sees the cue as a placeholder, so only the stray Chinese is dropped');
  assert.equal(V.performance('I miss you.',{id:'f'},{},{}),'I miss you.','the hand-off is consumed once');
});

test('an explicit request in this turn wins: 笑一笑 always laughs, 凶一点 gets firm, even past the cooldown',()=>{
  const c=sandbox({voiceExpressive:true}),V=c.NorthVoiceExpressive;
  V.performance('[轻笑]先笑一个',{id:'k'},{},{});
  V.handPerf('满意了吧','','笑一笑');
  assert.equal(V.performance('满意了吧',{id:'k'},{},{}),'[chuckling] 满意了吧','asked to laugh: a laugh is added even inside the cooldown and without a written cue');
  V.handPerf('满意了吧','[轻笑]满意了吧','大笑给我听');
  assert.equal(V.performance('满意了吧',{id:'k'},{},{}),'[laughing] 满意了吧','a big laugh request uses the full laugh tag');
  V.handPerf('你再说一遍','','凶一点');
  assert.equal(V.performance('你再说一遍',{id:'k'},{},{}),'[angry, firm voice] 你再说一遍');
  V.handPerf('你再说一遍','[不满]你再说一遍','凶一点');
  assert.equal(V.performance('你再说一遍',{id:'k'},{},{}),'[angry, firm voice] 你再说一遍','a written 不满 becomes firm when the user asked for it');
  assert.equal(V.performance('你再说一遍',{id:'k2'},{},{}),'你再说一遍','without the request it stays gentle');
});

test('normalize repairs a voice note that still carries cues or position tags, whatever path created it',()=>{
  const V=sandbox({}).NorthVoiceExpressive,m={type:'voice',content:'[左耳][小声]嘿，小狗……[右耳]现在我在这边了。',trans:'',showText:true};
  assert.equal(V.normalize(m),true,'works even with the switch off, so the transcript is always clean');
  assert.equal(m.content,'嘿，小狗……现在我在这边了。');
  assert.equal(m.voicePerf,'[小声]嘿，小狗……现在我在这边了。');
  assert.deepEqual(JSON.parse(JSON.stringify(m.voiceSpatial)),[{at:0,tag:'左耳'},{at:6,tag:'右耳'}]);
  assert.equal(V.normalize(m),false,'idempotent');
  assert.equal(V.normalize({type:'text',content:'[小声]x'}),false,'only voice notes');
});

test('app hooks: render and synthesis both normalize, the 3D badge marks rendered notes, the request is kept',()=>{
  for(const src of [app,read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js')]){
    assert.match(src,/if\(m\.type==='voice'\)\{if\(typeof NorthVoiceExpressive!=='undefined'\)NorthVoiceExpressive\.normalize\(m\);/);
    assert.match(src,/NorthVoiceExpressive\.normalize\(m\)\)save\(\);if\(_vxOn\)\{try\{if\(await NorthVoiceExpressive\.direct\(m,o\)\)save\(\);\}catch\(_\)\{\}\}[^\n]*?if\(_vxOn&&\(m\.voicePerf\|\|m\.voiceAsk\|\|m\.voiceDirected\)\)NorthVoiceExpressive\.handPerf\(m\.content,m\.voicePerf,m\.voiceAsk,m\.voiceDirected\);/);
    assert.match(src,/if\(bin\)\{ab=bin;_mime='audio\/wav';m\.voice3d=true;\}/);
    assert.match(src,/\$\{m\.voice3d\?'<span class="v3d" title="已渲染 3D 贴耳">3D<\/span>':''\}/);
    assert.match(src,/\{voiceAsk:String\(_userText\)\.slice\(0,80\)\}/);
  }
  assert.match(html,/\.voiceb \.v3d\{/);
});

/* 第三版：语音导演。角色回完话后，用副模型（没配就用主模型）专门给这条语音做一次表演标注再交给 Fish。 */
function directorSandbox(reply,kind='fish'){
  const c=sandbox({voiceExpressive:true},kind);c.calls=[];c.roleChatRouteIndex=()=>0;
  c.chatAPI=async(rows,opt)=>{c.calls.push({rows,opt});if(reply instanceof Error)throw reply;return typeof reply==='function'?reply(rows):reply;};
  return c;
}
test('the director annotates Chinese and English lines with natural fillers and verified Fish tags',async()=>{
  const zh=directorSandbox('输出：[soft] 嗯……过来。[chuckling] 我才不信呢。'),m={type:'voice',content:'过来。我才不信。',voiceAsk:'笑一笑'};
  assert.equal(await zh.NorthVoiceExpressive.direct(m,{id:'r',name:'Claude'}),'[soft] 嗯……过来。[chuckling] 我才不信呢。');
  assert.equal(m.voiceDirectedFor,'过来。我才不信。');
  const call=zh.calls[0];assert.equal(call.opt.aux,true);assert.equal(call.opt.roleInterceptAudit,null);
  assert.match(call.rows[1].content,/用户这一轮的要求：笑一笑/);assert.match(call.rows[1].content,/台词：\n过来。我才不信。/);
  const en=directorSandbox("[soft] Hey... come here. [chuckling] You're ridiculous, haha."),e={type:'voice',content:"Come here. You're ridiculous."};
  assert.equal(await en.NorthVoiceExpressive.direct(e,{id:'r'}),"[soft] Hey... come here. [chuckling] You're ridiculous, haha.");
  const V=zh.NorthVoiceExpressive;V.handPerf(m.content,'',m.voiceAsk,m.voiceDirected);
  assert.equal(V.performance(m.content,{id:'r'},{},{}),'[soft] 嗯……过来。[chuckling] 我才不信呢。','the directed text goes to Fish as is');
});
test('the director may not change the meaning; a bad or failed result falls back to the inline cues',async()=>{
  const c=directorSandbox('[happy] 过来。我才不信。我们明天去海边吧，我已经订好票了！'),m={type:'voice',content:'过来。我才不信。'};
  assert.equal(await c.NorthVoiceExpressive.direct(m,{id:'r'}),null);assert.equal(m.voiceDirected,undefined);assert.match(m.voiceDirectError,/改动了台词/);
  const f=directorSandbox(new Error('HTTP 500')),n={type:'voice',content:'过来。'};
  assert.equal(await f.NorthVoiceExpressive.direct(n,{id:'r'}),null);assert.match(n.voiceDirectError,/500/);
  const t=directorSandbox('[rain] 过来。'),k={type:'voice',content:'过来。'};
  assert.equal(await t.NorthVoiceExpressive.direct(k,{id:'r'}),null,'ambient sound tags are refused');
});
test('the director runs once per line, only for Fish, only with the switch on',async()=>{
  const c=directorSandbox('[soft] 过来。'),m={type:'voice',content:'过来。'};
  await c.NorthVoiceExpressive.direct(m,{id:'r'});await c.NorthVoiceExpressive.direct(m,{id:'r'});assert.equal(c.calls.length,1,'cached on the message');
  m.content='别走。';await c.NorthVoiceExpressive.direct(m,{id:'r'});assert.equal(c.calls.length,2,'an edited line is directed again');
  const mm=directorSandbox('[soft] x','minimax');assert.equal(await mm.NorthVoiceExpressive.direct({type:'voice',content:'过来。'},{id:'r'}),null);assert.equal(mm.calls.length,0);
  const off=sandbox({});off.chatAPI=async()=>{throw new Error('must not call');};assert.equal(await off.NorthVoiceExpressive.direct({type:'voice',content:'过来。'},{id:'r'}),null);
});
test('director clean-up, prompt rules and the spoken-length limit',()=>{
  const V=sandbox({voiceExpressive:true}).NorthVoiceExpressive,T=V._test;
  assert.equal(T.directorClean('```\n"[soft]过来。[小声]乖"\n```'),'[soft] 过来。乖','Chinese bracket cues are dropped and a space follows each tag');
  assert.match(T.DIRECTOR_PROMPT,/\[laugh softly\]/);assert.match(T.DIRECTOR_PROMPT,/台词是英文就用英文语气词改写/);assert.match(T.DIRECTOR_PROMPT,/不能增删事实/);
  for(const src of [app,read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js')]){
    assert.match(src,/if\(_vxOn\)\{try\{if\(await NorthVoiceExpressive\.direct\(m,o\)\)save\(\);\}catch\(_\)\{\}\}/);
    assert.match(src,/if\(ttsSpokenLength\(t\)>VOICE_MAX_CHARS\)\{/);
    const fnSrc=src.split('\n').find(l=>l.startsWith('function ttsSpokenLength('));const ctx=vm.createContext({});vm.runInContext(fnSrc,ctx);
    assert.equal(ctx.ttsSpokenLength('[soft] [voice softening into a low murmur] 过来'),2,'tags do not count against the voice length limit');
  }
});
