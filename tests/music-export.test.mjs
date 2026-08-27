import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function functionSource(name){
  const fnStart=source.indexOf('function '+name+'(');
  assert.ok(fnStart>=0,'missing '+name);
  const start=source.slice(Math.max(0,fnStart-6),fnStart)==='async '?fnStart-6:fnStart;
  let brace=source.indexOf('{',start),depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

assert.match(source,/MUSIC_EXPORT_PACK_SAFE_BYTES=20\*1024\*1024,MUSIC_BINARY_MAGIC='NORTHMUSIC2\\n'/);
assert.doesNotMatch(source,/MUSIC_EXPORT_ONE_SAFE_BYTES/,'long single-song export must no longer use the old 32MB Base64 ceiling');
assert.match(functionSource('musicExportPack'),/measured\.missing\.length/);
assert.match(functionSource('musicExportPack'),/MUSIC_EXPORT_PACK_SAFE_BYTES[\s\S]*musicExportOneModal/);
assert.match(functionSource('musicExportOne'),/musicBinaryPackBlob\(s,measured\.blobs\.get\(s\.id\)\)/);
assert.match(functionSource('musicExportOne'),/\.northmusic/);
assert.doesNotMatch(functionSource('musicExportOne'),/MUSIC_EXPORT_ONE_SAFE_BYTES|mBlobDataURL/);
assert.match(functionSource('musicImportPack'),/\.northmusic/);
assert.match(functionSource('musicImportSong'),/mPutVerified\(s\.id,blob\)/);
assert.match(functionSource('mPutVerified'),/savedSize!==expectedSize/);
assert.match(functionSource('mPutVerified'),/savedSig!==expectedSig/);
assert.match(functionSource('musicPersistStorage'),/navigator\.storage\.persist/);
assert.match(functionSource('musicRepairFile'),/musicPreparePickedFile\(f,kind\)[\s\S]*mPutVerified\(id,prepared\.blob\)/);
assert.doesNotMatch(functionSource('musicRepairFile'),/lyrics\s*=/,'repairing audio must preserve lyrics and timestamps');
assert.match(functionSource('musicMissingModal'),/歌词和已经打好的时间轴都还在/);
assert.match(functionSource('beautySaveFile'),/blob&&blob\.type\|\|'application\/octet-stream'/);

const ctx=vm.createContext({
  S:{music:{loop:true,totalSec:12,distance:8,meAvatar:'me',taAvatar:'ta',bg:'bg',discColor:'blue'}},
  Blob,Map,Date,TextEncoder,TextDecoder,DataView,Uint8Array,JSON,
  musicExportDataURLSafe(){return true;},
  async mGet(){throw new Error('preloaded blob should be reused');},
  async mBlobDataURL(){return 'data:audio/mpeg;base64,QUJD';}
});
for(const name of ['musicPackSettings','musicPackBlob','musicBinaryPackBlob','musicBinaryPackRead'])vm.runInContext('this.'+name+'='+functionSource(name),ctx);
vm.runInContext("this.MUSIC_BINARY_MAGIC='NORTHMUSIC2\\n'",ctx);

const songs=[{id:'local',title:'本地歌',lyrics:'[00:12.34]第一句',src:{t:'idb'}},{id:'remote',title:'直链歌',src:{t:'url',url:'https://example.com/a.mp3'}}];
const jsonBlob=await ctx.musicPackBlob(songs,false,new Map([['local',new Blob(['ABC'],{type:'audio/mpeg'})]]));
const parsed=JSON.parse(await jsonBlob.text());
assert.equal(parsed.type,'yibei-music-pack');
assert.equal(parsed.ver,1);
assert.equal(parsed.music.songs[0].file,'data:audio/mpeg;base64,QUJD');
assert.equal(parsed.music.songs[0].lyrics,'[00:12.34]第一句');
assert.equal(parsed.music.songs[1].src.url,'https://example.com/a.mp3');
assert.equal(parsed.music.discColor,'blue');

const longAudio=new Blob([new Uint8Array(40*1024*1024)],{type:'video/mp4'});
const binaryBlob=ctx.musicBinaryPackBlob({...songs[0],fileName:'四分钟录屏.mp4'},longAudio);
assert.equal(binaryBlob.size>longAudio.size,true);
assert.equal(binaryBlob.type,'application/x-smallphone-music');
const binary=await ctx.musicBinaryPackRead(binaryBlob);
assert.equal(binary.header.ver,2);
assert.equal(binary.header.music.song.lyrics,'[00:12.34]第一句');
assert.equal(binary.header.audio.name,'四分钟录屏.mp4');
assert.equal(binary.audio.size,longAudio.size);
assert.equal(binary.audio.type,'video/mp4');

let encoded=0,routed='';
const limitCtx=vm.createContext({
  S:{music:{songs:[{id:'large'}]}},
  musicInit(){},toast(){},cacheSizeText(n){return String(n);},
  async musicExportMeasure(){return{bytes:20*1024*1024+1,blobs:new Map(),missing:[]};},
  musicExportOneModal(reason){routed=reason;},
  async musicPackBlob(){encoded++;},musicPrepareReadyExport(){},Map,Date
});
vm.runInContext('const MUSIC_EXPORT_PACK_SAFE_BYTES=20*1024*1024;let _musicExportBusy=false;this.musicExportPack='+functionSource('musicExportPack'),limitCtx);
await limitCtx.musicExportPack();
assert.equal(encoded,0,'oversized packs must stop before Base64 encoding');
assert.match(routed,/安全分首导出/);

console.log('music export and durable import tests passed');
