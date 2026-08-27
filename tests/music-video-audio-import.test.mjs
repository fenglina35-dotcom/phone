import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundled=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function functionSource(source,name){
  const fnStart=source.indexOf('function '+name+'(');
  assert.ok(fnStart>=0,'missing '+name);
  const start=source.slice(Math.max(0,fnStart-6),fnStart)==='async '?fnStart-6:fnStart;
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

assert.equal(root,bundled,'web source and private iOS bundle must keep the same music extraction logic');
assert.match(functionSource(root,'mPickVideoFile'),/musicPreparePickedFile\(f,'video'/,'video selection must validate before accepting the file');
assert.match(functionSource(root,'musicExtractMp4AudioBlob'),/musicKeepOriginalMediaBlob/,'MP4 imports must preserve the original playable container');
assert.doesNotMatch(functionSource(root,'musicExtractMp4AudioBlob'),/initializeSegmentation|fragments|new Blob/,'video import must not assemble MSE fragments as a standalone M4A');
assert.match(functionSource(root,'musicProbePlayableBlob'),/onloadedmetadata=ready/);
assert.match(functionSource(root,'mPutVerified'),/musicProbePlayableBlob\(saved,'导入的音乐'\)/,'the exact persisted blob must pass a real media probe');
assert.match(functionSource(root,'mPutVerified'),/catch\(e\)\{await mDelIDB\(k\);throw e;\}/,'unplayable blobs must be removed instead of accepted');
assert.match(functionSource(root,'musicAddSave'),/mPutVerified\(id,picked\)/);
assert.doesNotMatch(functionSource(root,'musicAddSave'),/musicVideoLike|musicExtractMp4AudioBlob/,'saving must only receive a file that selection already prepared');
assert.match(functionSource(root,'musicRepairFile'),/musicPreparePickedFile\(f,kind\)[\s\S]*mPutVerified\(id,prepared\.blob\)/,'repairing from a video must validate the selected original before storing');
assert.doesNotMatch(functionSource(root,'musicPlay'),/musicExtractMp4AudioBlob|musicPreparePickedFile\(b,'video'/,'playback must not rewrite an already stored playable recording');

const helperContext=vm.createContext({String,Number});
for(const name of ['musicVideoLike','musicAudioFileName','musicApplyStoredMeta'])vm.runInContext('this.'+name+'='+functionSource(root,name),helperContext);
assert.equal(helperContext.musicVideoLike({name:'三分钟录屏.MOV',type:''}),true);
assert.equal(helperContext.musicVideoLike({name:'歌曲.m4a',type:'audio/mp4'}),false);
assert.equal(helperContext.musicAudioFileName('三分钟录屏.mov','m4a'),'三分钟录屏.m4a');
const meta={};
helperContext.musicApplyStoredMeta(meta,{fileName:'三分钟录屏.m4a',sourceVideoName:'三分钟录屏.mov',sourceVideoSize:1234,mediaDuration:180},{size:456,type:'audio/mp4',sig:'ok'});
assert.deepEqual({...meta},{fileName:'三分钟录屏.m4a',fileSize:456,fileType:'audio/mp4',fileSig:'ok',sourceVideoName:'三分钟录屏.mov',sourceVideoSize:1234,mediaDuration:180});

class PlayableAudio{
  constructor(){this.duration=0;}
  load(){if(!this.src)return;this.duration=180;queueMicrotask(()=>this.onloadedmetadata&&this.onloadedmetadata());}
  pause(){}
  removeAttribute(){this.src='';}
}
const playableContext=vm.createContext({Blob,Math,Number,String,Error,Promise,Audio:PlayableAudio,setTimeout,clearTimeout,queueMicrotask,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}}});
for(const name of ['musicProbePlayableBlob','musicKeepOriginalMediaBlob','musicExtractMp4AudioBlob'])vm.runInContext('this.'+name+'='+functionSource(root,name),playableContext);
const original=new Blob([new Uint8Array(64)],{type:'video/mp4'});
Object.defineProperty(original,'name',{value:'三分钟录屏.mp4'});
const prepared=await playableContext.musicExtractMp4AudioBlob(original,null,original.name);
assert.equal(prepared.blob,original,'validated video must be stored byte-for-byte instead of remuxed');
assert.equal(prepared.fileName,'三分钟录屏.mp4');
assert.equal(prepared.mediaDuration,180);

class BrokenAudio extends PlayableAudio{load(){if(!this.src)return;queueMicrotask(()=>this.onerror&&this.onerror());}}
const brokenContext=vm.createContext({Blob,Math,Number,String,Error,Promise,Audio:BrokenAudio,setTimeout,clearTimeout,queueMicrotask,URL:{createObjectURL:()=> 'blob:bad',revokeObjectURL:()=>{}}});
vm.runInContext('this.musicProbePlayableBlob='+functionSource(root,'musicProbePlayableBlob'),brokenContext);
await assert.rejects(brokenContext.musicProbePlayableBlob(new Blob(['broken'],{type:'audio/mpeg'}),'导入的音乐'),/不是当前设备可播放的完整音频/);

console.log('music video audio extraction tests passed');
