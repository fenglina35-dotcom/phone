import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-ai/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202607270001_asr_billing.sql',import.meta.url),'utf8');

function functionSource(name){
  const start=edge.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=edge.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<edge.length;i++){
    if(edge[i]==='{')depth++;
    else if(edge[i]==='}'&&--depth===0)return edge.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('cinema ASR preserves external configuration with internal route disabled',()=>{
  assert.match(app,/stt:\{base:'',key:'',model:'',relay:false\}/);
  assert.match(app,/function sttRelayOn\(\)/);
  assert.match(app,/relay:!!oldStt\.relay/);
});
test('voice messages preserve audio and never call paid ASR',()=>{
  assert.match(app,/audio:m\.audio,content:m\.content\|\|'',showText:!!m\.content/);
  assert.match(app,/const content=\(R\.getText\(\)\|\|''\)\.trim\(\),error='';/);
  assert.doesNotMatch(app,/function stopRec[\s\S]{0,1200}sttTranscribe\(/);
});

test('diagnostic recordings are converted to wav for the cinema-only ASR route',()=>{
  assert.match(app,/async function sttRecordedWav\(blob,durationSeconds\)/);
  assert.match(app,/cinemaAudioChunkWav\(audio,0,end,16000\)/);
  assert.match(edge,/asr-purpose-not-allowed/);
});

test('cinema chunks send trusted actual duration and never upload video to built-in ASR',()=>{
  assert.match(app,/durationSeconds:end-start/);
  assert.match(app,/purpose:'cinema_subtitles'/);
  assert.match(app,/if\(sttRelayOn\(\)\)return toast\('内置识别不会上传原视频/);
  assert.match(app,/sttRelaySecondsPerPoint\(\)/);
  assert.match(app,/cinemaAsrDiscountPct/);
});

test('legacy cached cinema clients remain compatible without reopening generic voice ASR',()=>{
  assert.match(edge,/const legacyCinemaPurpose = !requestedPurpose/);
  assert.match(edge,/body\.timestamps === true/);
  assert.match(edge,/\.wav\$\/i\.test\(String\(body\.filename/);
  assert.match(edge,/data:audio\\\/\(\?:wav\|x-wav\);base64,/);
  assert.match(edge,/requestedPurpose \|\| \(legacyCinemaPurpose \? "cinema_subtitles" : ""\)/);
});

test('server reads WAV byte rate instead of mistaking sample rate for duration billing',()=>{
  const context={DataView,Uint8Array,String};
  const source=functionSource('wavDurationSeconds').replace('bytes: Uint8Array','bytes').replace('offset: number','offset');
  vm.runInNewContext(source,context);
  const rate=16000,frames=rate,bytes=new Uint8Array(44+frames*2),view=new DataView(bytes.buffer);
  const ascii=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  ascii(0,'RIFF');view.setUint32(4,36+frames*2,true);ascii(8,'WAVE');ascii(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  ascii(36,'data');view.setUint32(40,frames*2,true);
  assert.equal(context.wavDurationSeconds(bytes),1);
});

test('server prices ASR by each started interval and attempts each configured route once',()=>{
  assert.match(edge,/asr_seconds_per_point:/);
  assert.match(edge,/Math\.ceil\(durationSeconds \/ ASR_SECONDS_PER_POINT\)/);
  assert.ok(edge.indexOf('routes.push("aliyun")')<edge.indexOf('routes.push("tencent")'));
  assert.match(edge,/for \(const route of routes\)/);
  assert.doesNotMatch(edge,/asrAttempts|retryAsr|for \(let attempt.*asr/i);
});

test('ASR billing reserve and refund are atomic and idempotent',()=>{
  assert.match(migration,/from public\.phone_ai_accounts[\s\S]*for update;/);
  assert.match(migration,/feature = 'asr'[\s\S]*request_id = p_request_id/);
  assert.match(migration,/if found then[\s\S]*'duplicate', true/);
  assert.match(migration,/if v_ledger\.status <> 'pending' then/);
  assert.match(migration,/set status = 'failed'/);
  assert.match(edge,/await refundAsrPoints\(reserved\.ledger_id, userId, reason\)/);
  assert.match(edge,/语音识别失败，本次点数已全额退回/);
});
