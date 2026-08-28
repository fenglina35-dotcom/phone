import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const context=vm.createContext({});
vm.runInContext(functionSource('parseLyrics'),context);
vm.runInContext(functionSource('musicLyricIndex'),context);
vm.runInContext(functionSource('mLyricBrowse'),context);
vm.runInContext(functionSource('mLyricBind'),context);
vm.runInContext(functionSource('mLyricScroll'),context);
vm.runInContext(functionSource('mLyricTarget'),context);
vm.runInContext(functionSource('mLyricTick'),context);

const lines=context.parseLyrics('[00:01.250]第一句\n[00:02.75]第二句\n[00:03,005]第三句');
assert.equal(lines.length,3);
assert.equal(lines[0].t,1.25,'three digit milliseconds must stay readable');
assert.equal(lines[1].t,2.75);
assert.equal(lines[2].t,3.005);
assert.equal(context.musicLyricIndex(lines,0),-1,'no keyed lyric should highlight before its exact cue');
assert.equal(context.musicLyricIndex(lines,1.24),-1,'a lyric must not highlight early');
assert.equal(context.musicLyricIndex(lines,1.25),0,'a lyric highlights at its exact keyed time');
assert.equal(context.musicLyricIndex(lines,2.75),1);
assert.equal(context.musicLyricIndex(lines,3.1),2);

const rows=lines.map((_,index)=>({
  style:{},
  attrs:{},
  offsetTop:420+index*30,
  contentTop:20+index*30,
  clientHeight:18,
  getBoundingClientRect(){return{top:400+this.contentTop-lyricBox.scrollTop};},
  classList:{values:new Set(),toggle(name,on){on?this.values.add(name):this.values.delete(name);},contains(name){return this.values.has(name);}},
  setAttribute(name,value){this.attrs[name]=value;},
  removeAttribute(name){delete this.attrs[name];}
}));
let scrollCalls=0;
const lyricListeners={};
const lyricBox={clientHeight:64,scrollHeight:180,scrollTop:0,getBoundingClientRect(){return{top:400};},querySelectorAll(){return rows;},addEventListener(type,fn){lyricListeners[type]=fn;},scrollTo(options){scrollCalls++;this.scrollTop=options.top;this.lastBehavior=options.behavior;}};
context.document={getElementById(id){return id==='m_lyrics'?lyricBox:null;}};
context.S={music:{songs:[{id:'song',lyrics:'[00:01.250]第一句\n[00:02.750]第二句\n[00:03.005]第三句'}]}};
context._mCur='song';
context._mAudioSongId='song';
context._mLyricIndex=-2;
context._mLyricManualUntil=0;
context._mLyricFollowPending=false;
context._ma={currentTime:0,duration:4};
context.mLyricTick(true);
assert.equal(rows[0].style.color,'#7d7d88','first keyed line must remain dim before its cue');
assert.equal(rows[1].style.color,'#7d7d88');
context._ma.currentTime=2.8;
context.mLyricTick();
assert.equal(rows[0].style.color,'#7d7d88');
assert.equal(rows[1].style.color,'#ffd6e8','current keyed line must be repainted on every tick');
assert.equal(rows[1].attrs['aria-current'],'true');
assert.equal(scrollCalls,1,'a cue change must move the lyric viewport once');
assert.equal(lyricBox.scrollTop,27,'centering must use the line position inside the lyric box, not its page-level offsetTop');
assert.equal(lyricBox.lastBehavior,'smooth');
context.mLyricTick();
assert.equal(scrollCalls,1,'the 80ms paint loop must not restart the same smooth scroll');

lyricListeners.pointerdown();
context._ma.currentTime=3.1;
context.mLyricTick();
assert.equal(rows[2].style.color,'#ffd6e8','manual browsing must not stop current-line highlighting');
assert.equal(scrollCalls,1,'manual browsing must not be pulled back by automatic centering');
context._mLyricManualUntil=0;
context.mLyricTick();
assert.equal(scrollCalls,2,'automatic following must resume after manual browsing ends');
assert.equal(lyricBox.scrollTop,57,'resumed following must center the highlighted line without a fixed parent offset');

const colorsBeforeMismatch=rows.map(row=>row.style.color);
context._mAudioSongId='another-song';
context._ma.currentTime=3.1;
context.mLyricTick(true);
assert.deepEqual(rows.map(row=>row.style.color),colorsBeforeMismatch,'lyrics must ignore audio that belongs to another song');

const pending=new Map(),revoked=[];
class FakeAudio{
  constructor(){this.paused=true;this.src='';this.loop=false;}
  pause(){this.paused=true;if(this.onpause)this.onpause();}
  play(){this.paused=false;if(this.onplay)this.onplay();return Promise.resolve();}
}
const raceContext=vm.createContext({
  S:{music:{songs:[{id:'first',src:{t:'idb'}},{id:'second',src:{t:'idb'}}]}},
  musicInit(){},mLyricLoopStop(){},mLyricTick(){},mLyricLoopStart(){},mTick(){},mEnded(){},mBtns(){},
  Audio:FakeAudio,toast(){},save(){},render(){},setTimeout,
  musicVideoLike(){return false;},
  mGet(id){return new Promise(resolve=>pending.set(id,resolve));},
  URL:{createObjectURL(blob){return 'blob:'+blob.id;},revokeObjectURL(url){revoked.push(url);}},
});
vm.runInContext('let _ma=null,_mCur=null,_mPlaying=false,_mUrl=null,_mWantPlay=false,_mLyricIndex=-2,_mLyricPaintAt=0,_mPlayToken=0,_mAudioSongId=null;',raceContext);
vm.runInContext('function musicMediaElement(){if(!_ma)_ma=new Audio();return _ma;}',raceContext);
vm.runInContext('async '+functionSource('musicPlay'),raceContext);
const firstPlay=raceContext.musicPlay('first');
const secondPlay=raceContext.musicPlay('second');
pending.get('second')({id:'second'});await Promise.resolve();await Promise.resolve();
pending.get('first')({id:'first'});await Promise.all([firstPlay,secondPlay]);
assert.equal(vm.runInContext('_mCur',raceContext),'second','a stale IndexedDB read must not replace the latest selected song');
assert.equal(vm.runInContext('_mAudioSongId',raceContext),'second','the audio/song identity must stay aligned after rapid switching');
assert.equal(vm.runInContext('_ma.src',raceContext),'blob:second');
assert.deepEqual(revoked,[],'the stale request must not revoke the latest song URL');

assert.match(source,/if\(_mAudioSongId!==id\|\|!_ma\|\|!_ma\.src\)await musicPlay\(id\)/);
assert.match(functionSource('musicImportSong'),/mPutVerified\(s\.id,blob,kind\)/,'music packs must verify every IndexedDB write with the original media kind');
assert.match(functionSource('musicPlay'),/musicMissingModal\(s\)/,'missing audio must offer in-place repair instead of telling users to delete timed lyrics');
assert.match(source,/跳过 '\+skipped\+' 首不完整歌曲/);
assert.match(functionSource('musicMediaElement'),/onloadedmetadata=\(\)=>mLyricTick\(true\)/,'metadata readiness must repaint keyed lyrics');
assert.match(functionSource('musicMediaElement'),/onseeked=\(\)=>mLyricTick\(true\)/,'seeking to an authored cue must repaint immediately');
assert.match(functionSource('musicMediaElement'),/onplaying=\(\)=>\{mLyricTick\(true\);mLyricLoopStart\(\);\}/,'actual playback must restart the lyric clock');
assert.match(functionSource('musicPlay'),/token!==_mPlayToken/,'rapid song changes must discard stale asynchronous loads');
assert.match(functionSource('mLyricTick'),/_mAudioSongId!==_mCur/,'lyric timing must only read audio for the displayed song');
assert.match(functionSource('mLyricTick'),/changed\|\|_mLyricFollowPending/,'timed lyrics must scroll only when the active cue changes');
assert.match(functionSource('mLyricTick'),/Date\.now\(\)<_mLyricManualUntil/,'manual lyric browsing must temporarily suspend auto-centering');
assert.doesNotMatch(functionSource('mLyricTick'),/els\[idx\]\.offsetTop/,'auto-centering must not mix page-level offsetTop with lyric-box scroll coordinates');
assert.match(source,/if\(c\.p==='music'\)[\s\S]*?requestAnimationFrame\(\(\)=>\{mTick\(\);if\(_ma&&!_ma\.paused\)mLyricLoopStart\(\);\}\)/,'rebuilding the player DOM must restore progress and lyric state');

const entryCalls=[],entrySong={id:'song'};
const entryContext=vm.createContext({
  S:{music:{songs:[entrySong]}},
  musicInit(){},musicAdd(){},musicEnsureCurrent(){return entrySong;},
  musicPlay(id){entryCalls.push(id);return Promise.resolve(true);},
  render(){entryCalls.push('render');},mLyricTick(){},setTimeout(fn){fn();},
});
vm.runInContext("var _ma={src:'blob:old',paused:false,play(){entryCalls.push('resume');return Promise.resolve();}},_mCur='song',_mAudioSongId='old-song',_mView='home';",entryContext);
vm.runInContext(functionSource('musicOpenPlayer'),entryContext);
vm.runInContext(functionSource('musicExpandPlayer'),entryContext);
entryContext.musicOpenPlayer('song',true);
assert.deepEqual(entryCalls,['song'],'opening a song must reload it when the displayed song and audio instance are mismatched');
entryCalls.length=0;
entryContext.musicExpandPlayer();
assert.deepEqual(entryCalls,['song'],'expanding the player must repair a stale audio/song binding');
entryCalls.length=0;
vm.runInContext("_mAudioSongId='song';_ma.src='blob:song';",entryContext);
entryContext.musicOpenPlayer('song',true);
assert.deepEqual(entryCalls,['render'],'an already bound playing song must not restart');

console.log('music lyrics tests passed');
