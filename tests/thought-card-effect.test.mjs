import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const app=readFileSync(join(root,'app.js'),'utf8');
const effect=readFileSync(join(root,'thought-card-effects.js'),'utf8');
const html=readFileSync(join(root,'小手机.html'),'utf8');
const sw=readFileSync(join(root,'sw.js'),'utf8');
const preview=readFileSync(join(root,'thought-card-preview.html'),'utf8');

test('the hidden card is a role-chosen rare easter egg with a three-day minimum interval',()=>{
  assert.match(app,/const THOUGHT_EGG_COOLDOWN_MS=3\*86400000/);
  assert.match(app,/三天只是最短间隔，不是每三天必须发送/);
  assert.match(app,/特别重要的事，或你连续多轮强烈思念/);
  assert.match(app,/不因对方说“想你\/爱你\/给我惊喜”就触发/);
  assert.match(app,/function thoughtEggCanSend/);
  assert.match(app,/function thoughtEggNovel/);
  assert.match(app,/thoughtEggSimilarity\(signature,old\.words\|\|\[\]\)>=\.62/);
});

test('relationship questions and direct spoken requests guarantee a card even during autonomous cooldown',()=>{
  assert.match(app,/function thoughtEggRequestIntent/);
  assert.match(app,/在一起\|认识\|陪着彼此/);
  const start=app.indexOf('function thoughtEggRequestIntent');
  const end=app.indexOf('\nfunction thoughtEggRequested',start);
  const requestIntent=vm.runInNewContext('('+app.slice(start,end)+')');
  assert.equal(requestIntent('给我发那个心情彩蛋'),true);
  assert.equal(requestIntent('心声彩蛋给我看一下'),true);
  assert.equal(requestIntent('我要他发那个隐藏卡片'),true);
  assert.equal(requestIntent('别给我发心情彩蛋'),false);
  assert.equal(requestIntent('我不要你发心情彩蛋'),false);
  assert.equal(requestIntent('我不想看心声彩蛋'),false);
  assert.equal(requestIntent('给我惊喜'),false);
  assert.match(app,/隐藏心声卡为用户明确索取（必须触发）/);
  assert.match(app,/优先级高于三天自主彩蛋冷却/);
  assert.match(app,/用户明确索取不受该冷却限制/);
  assert.match(app,/_thoughtIntent&&!\/\\\[心声彩蛋\\\|\/\.test\(content\)/);
  assert.match(app,/系统最终纠正：对方刚才明确索取了隐藏心声卡/);
  assert.match(app,/thoughtEggMessage\(cch,tm\[1\],tm\[2\],tm\[3\],thoughtEggRequested\(cch\)\)/);
});

test('the role can create a short, unique thought-card message and the chat renders a mystery card',()=>{
  assert.match(app,/\[心声彩蛋\|你自己写的一句简短开场白\|16至18个很短的句子/);
  assert.match(app,/const tm=line\.match\(\/\^\\\[心声彩蛋/);
  assert.match(app,/opening:payload\.opening\|\|opening/);
  assert.match(app,/playThoughtCardEffect\(\{opening:m\.opening,thoughts:m\.thoughts/);
  assert.match(app,/type:'thoughtcard',from:'ta'/);
  assert.match(app,/m\.type==='thoughtcard'/);
  assert.match(app,/class="thought-egg-chat-card"/);
  assert.match(app,/thoughtMessageOpen\('\$\{m\.id\}',this\)/);
  assert.match(app,/FOR YOUR EYES ONLY/);
});

test('the effect covers the full screen from orientation prompt through final sentence',()=>{
  assert.match(effect,/\.thought-egg-overlay\{position:fixed;inset:0/);
  assert.match(effect,/opening:clean\(options\.opening,42\)/);
  assert.match(effect,/Math\.min\(100,Math\.round\(\+options\.frameCount\|\|100\)\)/);
  assert.match(effect,/请翻转屏幕 \^ \^/);
  assert.match(effect,/className='thought-egg-start waiting'/);
  assert.match(effect,/frameInterval=400,introDelay=6000/);
  assert.match(effect,/classList\.remove\('waiting'\);},payload\.introDelay/);
  assert.match(effect,/screen\.orientation\.lock\('landscape'\)/);
  assert.match(effect,/runCountdown\(3\)/);
  assert.match(effect,/thought-egg-note/);
  assert.match(effect,/thought-egg-note-head/);
  assert.match(effect,/width:clamp\(190px,18vw,270px\)/);
  assert.match(effect,/total=payload\.frameCount\|\|100,spawnGap=payload\.frameInterval\|\|400,holdTime=3600,exitGap=12/);
  assert.match(effect,/while\(spots\.length<total\)/);
  assert.match(effect,/safeX=Math\.min\(46,\(noteW\/2\+10\)\/stageW\*100\)/);
  assert.match(effect,/const loose=rng\(\)<\.2,x=50\+gaussian\(rng\)\*\(loose\?31:24\),y=51\+gaussian\(rng\)\*\(loose\?20:13\)/);
  assert.match(effect,/x>safeX&&x<100-safeX/);
  assert.match(effect,/y>Math\.max\(14,safeY\)&&y<Math\.min\(86,100-safeY\)/);
  assert.match(effect,/max-width:calc\(100vw - 20px\)/);
  assert.match(effect,/overflow-wrap:anywhere/);
  assert.doesNotMatch(effect,/Math\.pow\(hx\*hx\+hy\*hy-1,3\)|notch=/);
  assert.match(effect,/note\.classList\.add\('leaving'\)/);
  assert.doesNotMatch(effect,/filter:blur/);
  assert.doesNotMatch(effect,/playParticleFinal|thought-egg-final-particles|FORM_MS|DISSOLVE_MS/);
  assert.match(effect,/final\.classList\.add\('show'\)/);
  assert.match(effect,/THE LAST THING I WANT TO SAY/);
});

test('the preview and offline shell load the hidden-card effect',()=>{
  assert.match(preview,/id="mysteryCard"/);
  assert.match(preview,/thought-card-effects\.js\?v=preview-4/);
  assert.doesNotMatch(preview,/fast=1|URLSearchParams|introDelay:fast|frameInterval:fast/);
  assert.match(preview,/opening:'我攒了一些没来得及说的话/);
  assert.match(preview,/frameCount:100/);
  assert.match(preview,/我没有时时刻刻说想你，但我一直在想你/);
assert.match(html,/thought-card-effects\.js\?v=1176/);
  assert.match(sw,/thought-card-effects\.js\?v='\+BUILD/);
});
