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
assert.match(functionSource(root,'mPickVideoFile'),/musicPreparePickedFile\(f,'video'/,'video selection must extract before accepting the file');
assert.match(functionSource(root,'musicExtractMp4AudioBlob'),/new Blob\(\[init,\.\.\.fragments\],\{type:'audio\/mp4'\}\)/,'MP4 and MOV imports must become an audio-only MP4');
assert.match(functionSource(root,'musicExtractMp4AudioBlob'),/这段录屏没有声音，无法作为音乐导入/);
assert.match(functionSource(root,'musicAddSave'),/mPutVerified\(id,picked\)/);
assert.doesNotMatch(functionSource(root,'musicAddSave'),/musicVideoLike|musicExtractMp4AudioBlob/,'saving must only receive a file that selection already prepared');
assert.match(functionSource(root,'musicRepairFile'),/musicPreparePickedFile\(f,kind\)[\s\S]*mPutVerified\(id,prepared\.blob\)/,'repairing from a video must extract its audio before storing');
assert.match(functionSource(root,'musicPlay'),/musicVideoLike\(b,s\.fileName,s\.fileType\|\|b\.type\)[\s\S]*musicPreparePickedFile\(b,'video'/,'legacy raw videos must self-heal before playback');
assert.match(functionSource(root,'musicPlay'),/musicApplyStoredMeta\(s,prepared,stored\)/,'legacy self-healing must persist the new audio metadata');

const helperContext=vm.createContext({String,Number});
for(const name of ['musicVideoLike','musicAudioFileName','musicApplyStoredMeta'])vm.runInContext('this.'+name+'='+functionSource(root,name),helperContext);
assert.equal(helperContext.musicVideoLike({name:'三分钟录屏.MOV',type:''}),true);
assert.equal(helperContext.musicVideoLike({name:'歌曲.m4a',type:'audio/mp4'}),false);
assert.equal(helperContext.musicAudioFileName('三分钟录屏.mov','m4a'),'三分钟录屏.m4a');
const meta={};
helperContext.musicApplyStoredMeta(meta,{fileName:'三分钟录屏.m4a',sourceVideoName:'三分钟录屏.mov',sourceVideoSize:1234,mediaDuration:180},{size:456,type:'audio/mp4',sig:'ok'});
assert.deepEqual({...meta},{fileName:'三分钟录屏.m4a',fileSize:456,fileType:'audio/mp4',fileSig:'ok',sourceVideoName:'三分钟录屏.mov',sourceVideoSize:1234,mediaDuration:180});

let readySent=false;
const noAudioMp4={
  onReady:null,onError:null,
  appendBuffer(){if(!readySent){readySent=true;this.onReady({audioTracks:[],tracks:[]});}},
  flush(){},
};
const noAudioContext=vm.createContext({
  Blob,Math,Number,String,Error,setTimeout,
  async cinemaMp4Library(){return{createFile(){return noAudioMp4;}};},
  musicAudioFileName:helperContext.musicAudioFileName,
});
vm.runInContext('this.musicExtractMp4AudioBlob='+functionSource(root,'musicExtractMp4AudioBlob'),noAudioContext);
await assert.rejects(noAudioContext.musicExtractMp4AudioBlob(new Blob([new Uint8Array(32)],{type:'video/mp4'}),null,'无声录屏.mp4'),/这段录屏没有声音，无法作为音乐导入/);

console.log('music video audio extraction tests passed');
