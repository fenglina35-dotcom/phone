import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const quiz=fs.readFileSync(new URL('../heart-quiz.js',import.meta.url),'utf8');
const privateRoot=new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/',import.meta.url);
const privateApp=fs.readFileSync(new URL('app.js',privateRoot),'utf8');
const privateHtml=fs.readFileSync(new URL('index.html',privateRoot),'utf8');
const privateQuiz=fs.readFileSync(new URL('heart-quiz.js',privateRoot),'utf8');

function runtime(){
  const sandbox=vm.createContext({console,JSON,Math,Date,String,Array,Number,Object,Set,Map,
    document:{getElementById:()=>null,createElement:()=>({id:'',textContent:''}),head:{appendChild(){}}},
    S:{me:{name:'我'}},getC:id=>({id,name:'先生',remark:'先生'}),save(){},render(){},toast(){},parseArr:JSON.parse,
    heartQuizDummy:true
  });
  vm.runInContext(quiz+'\nthis.__hqTest={bank:HEART_QUIZ_BANK,fallback:heartQuizFallback,normalize:heartQuizNormalize,result:heartQuizResult,ending:heartQuizFallbackLine,levels:HEART_QUIZ_LEVELS,intensity:HEART_QUIZ_INTENSITY,total:HEART_QUIZ_TOTAL};',sandbox);
  return sandbox.__hqTest;
}

test('game hall exposes Heart Verdict as a dedicated routed game in both runtimes',()=>{
  for(const source of [app,privateApp]){
    assert.match(source,/\{k:'heartquiz',e:'',n:'心动审判',tag:'30题 · 双人锁答 · 多结局'\}/);
    assert.match(source,/c\.p==='heartquiz'\)html=renderHeartQuiz\(\)/);
    assert.match(source,/if\(k==='heartquiz'\)return heartQuizOpenSetup\(cid\)/);
    assert.match(source,/heartquiz:'games'/);
  }
  assert.match(html,/heart-quiz\.js\?v=\d+/);
  assert.match(privateHtml,/heart-quiz\.js\?v=\d+/);
  assert.equal(privateQuiz,quiz,'web and private App must use the same questionnaire runtime');
});

test('white and dark preview papers each contain exactly 30 three-option questions',()=>{
  const hq=runtime();
  for(const mode of ['white','dark']){
    assert.equal(hq.bank[mode].length,30);
    const rows=hq.fallback(mode,3,'role-1',12345);
    assert.equal(rows.length,30);
    assert.equal(new Set(rows.map(x=>x.q)).size,30);
    for(const row of rows){
      assert.match(row.q,/你/,'every question must ask the user directly');
      const lastClause=row.q.split(/[，,；;]/).at(-1);
      assert.match(lastClause,/你/,'the actual question clause must address the user');
      assert.doesNotMatch(lastClause,/(?:我会|我该|我应该|我想|我愿意|我希望|我最|我觉得|我认为)[^？?]*[？?]$/,'no question may ask what the role itself would do');
      assert.equal(row.options.length,3);
      assert.ok(row.options.every(option=>option.startsWith('我')),'every answer option must use the chooser first-person voice');
      assert.equal(row.traits.length,3);
      assert.ok(row.roleChoice>=0&&row.roleChoice<3);
      assert.ok(row.intensity>=1&&row.intensity<=5);
      assert.deepEqual(Array.from(row.reactions),[],'preview questions must not impersonate a live role reaction');
    }
  }
  assert.equal(hq.total,30);
  assert.equal(hq.levels.white.length,3);
  assert.equal(hq.levels.dark.length,3);
  assert.equal(hq.intensity.dark.length,5);
  assert.equal(hq.bank.dark[0][0],'如果有别的男人靠近你，你应该怎么做？');
  assert.deepEqual(Array.from(hq.bank.dark[0][1]),[
    '我会立刻明确拒绝，告诉他我已经有你',
    '我会主动拉开距离，也马上告诉你',
    '我会保持必要分寸，不给他暧昧机会',
  ]);
  assert.match(quiz,/问题里的“你”永远指'\+S\.me\.name\+'，“我”永远指你/);
  assert.match(quiz,/roleChoice只能是0、1或2，代表你在看见'\+S\.me\.name\+'回答之前就锁定的期待答案/);
  assert.match(quiz,/!heartQuizQuestionForUser\(q\)/,'generated questions with the old role-self perspective must be rejected');
  assert.match(quiz,/g\.source==='preview'[\s\S]*?NORTH_PREVIEW_PARAMS\.includes\('heartquiz'\)[\s\S]*?isPreview\?12345:Date\.now\(\)/);
});

test('role-generated papers carry role-selected intensity and three in-character same-screen reactions',()=>{
  const hq=runtime(),rows=Array.from({length:30},(_,i)=>({
    q:`第${i+1}题，如果我故意让你吃醋，你会怎么做？`,
    options:['我会立刻回到你身边','我会故意再刺激你一次','我会等你亲自来抓我'],
    roleChoice:i%3,intensity:i<10?3:i<20?4:5,
    reactions:[`第${i+1}题反应一，只准看着我`,`第${i+1}题反应二，这笔账我记住了`,`第${i+1}题反应三，那我亲自来抓你`]
  })),normalized=hq.normalize(JSON.stringify(rows),'dark','role-1',2,12345);
  assert.equal(normalized.length,30);
  assert.ok(normalized.every(row=>row.reactions.length===3));
  assert.ok(normalized.every(row=>row.intensity>=1&&row.intensity<=5));
  assert.match(quiz,/每题强度由你本人决定/);
  assert.match(quiz,/黑卷就是暗黑、惊辣、偏执而病态的情侣审判/);
  assert.match(quiz,/同屏反应：为三个选项分别写一句你本人/);
  assert.doesNotMatch(quiz,/不能把现实跟踪|每题必须保留一个清醒沟通|只属于双方自愿/);
});

test('different answer patterns produce materially different white and dark endings',()=>{
  const hq=runtime(),answer=(trait,same=true)=>({trait,userChoice:0,roleChoice:same?0:1});
  const soulmate=hq.result({mode:'white',answers:Array.from({length:30},()=>answer('bond',true))});
  const apart=hq.result({mode:'white',answers:Array.from({length:30},()=>answer('space',false))});
  const abyss=hq.result({mode:'dark',answers:Array.from({length:30},()=>answer('obsess',true))});
  const awake=hq.result({mode:'dark',answers:Array.from({length:30},()=>answer('defy',false))});
  assert.equal(soulmate.title,'心有灵犀');
  assert.equal(apart.title,'清醒相爱');
  assert.equal(abyss.title,'双向沉沦');
  assert.equal(awake.title,'驯服反噬');
  assert.notEqual(soulmate.desc,apart.desc);
  assert.notEqual(abyss.desc,awake.desc);
});

test('dark mismatch feedback is dramatic but bounded and accessibility-aware',()=>{
  assert.match(quiz,/mismatch&&g\.mode==='dark'&&g\.scare/);
  assert.doesNotMatch(quiz,/heartQuizFxSound|AudioContext|webkitAudioContext|createOscillator|createBufferSource/);
  assert.match(quiz,/navigator\.vibrate\(\[65,45,110\]\)/);
  assert.match(quiz,/setTimeout\(\(\)=>\{[\s\S]*?classList\.remove\('hq-scare'\)[\s\S]*?\},920\)/);
  assert.match(quiz,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(quiz,/选定后立即揭晓TA锁定的期待/);
});

test('white matches use bounded heart, heartbeat, and reduced-motion feedback without sound',()=>{
  assert.match(quiz,/match&&g\.mode==='white'/);
  assert.doesNotMatch(quiz,/heartQuizFxSound|AudioContext|webkitAudioContext/);
  assert.match(quiz,/hq-love-fx/);
  assert.match(quiz,/@keyframes hqHeartbeat/);
  assert.match(quiz,/@keyframes hqHeartUp/);
  assert.match(quiz,/classList\.remove\('hq-love'\)[\s\S]*?1120/);
  assert.match(quiz,/@media\(prefers-reduced-motion:reduce\)[^\n]*hq-shell\.hq-love/);
});

test('paper names stay concise and each reveal shows the role expectation for the user',()=>{
  assert.match(quiz,/return mode==='dark'\?'黑卷':'白卷'/);
  assert.doesNotMatch(quiz,/心动白卷|暗夜黑卷|病娇极限/);
  assert.match(quiz,/<b>白卷<\/b>/);
  assert.match(quiz,/<b>黑卷<\/b>/);
  assert.match(quiz,/<b>心动审判<\/b>/);
  assert.match(quiz,/TA希望你这样回答/);
  assert.match(quiz,/已锁定期待/);
  assert.match(quiz,/你的回答与TA期待已揭晓/);
  assert.match(quiz,/期待我选/);
  assert.doesNotMatch(quiz,/heartQuizGenerateReaction|heartQuizPreviewReaction/);
  assert.match(quiz,/class="hq-reaction"/);
  assert.match(quiz,/>TA反应</);
  assert.match(quiz,/reaction:Array\.isArray\(q\.reactions\)/);
  assert.match(quiz,/由TA决定/);
  assert.match(quiz,/TA定档/);
  assert.match(quiz,/<button class="hq-next" onclick="heartQuizNext\(\)">/);
});

test('every result includes a role-specific final sentence with model and fallback paths',()=>{
  const hq=runtime(),g={mode:'dark',answers:Array.from({length:30},()=>({trait:'possess',userChoice:0,roleChoice:1}))},result=hq.result(g),line=hq.ending(g,result,{name:'先生',remark:'先生'});
  assert.ok(line.text.length>8);
  assert.match(quiz,/TA 留给你的一句话/);
  assert.match(quiz,/async function heartQuizGenerateRoleLine/);
  assert.match(quiz,/10到42个中文字/);
  assert.match(quiz,/g\.roleLine=text/);
});

test('preview setup stays compact, uses a circular partner portrait, and has no answer avatar',()=>{
  assert.match(quiz,/hq-shell hq-setup \$\{g\.mode==='dark'\?'dark':'white'\}/);
  assert.match(quiz,/\.hq-shell\.hq-setup\.white\{/);
  assert.match(quiz,/\.hq-setup\.white \.hq-choice\.on\{[^}]*background:#f6c7d6[^}]*color:#563640/);
  assert.match(quiz,/\.hq-setup\.white \.hq-primary\{[^}]*background:#f6c7d6[^}]*box-shadow:none/);
  assert.match(quiz,/\.hq-setup\.white \.hq-kicker,[^\n]*\.hq-setup\.white \.hq-choice small\{display:none\}/);
  assert.match(quiz,/\.hq-setup\.dark \.hq-kicker,[^\n]*\.hq-setup\.dark \.hq-note\{display:none\}/);
  assert.doesNotMatch(quiz,/\.gamehub-card\.heart-verdict/);
  assert.doesNotMatch(app,/heart-verdict/);
  assert.doesNotMatch(privateApp,/heart-verdict/);
  assert.match(quiz,/\.hq-partner \.avatar\{[^}]*flex:0 0 38px!important[^}]*border-radius:50%!important/);
  assert.match(quiz,/<div><b>\$\{esc\(c\.remark\|\|c\.name\)\}<\/b><p>\$\{esc\(answer\.roleText\)\}<\/p>/);
  assert.doesNotMatch(quiz,/<div>\$\{av\(c\.avatar,'sm'\)\}<b>\$\{esc\(answer\.roleText\)\}/);
  assert.match(quiz,/无需API，直接体验流程/);
});

test('Heart Verdict uses a dedicated compact chat invitation card in both directions',()=>{
  assert.match(quiz,/\.hq-invite-card\{/);
  assert.match(quiz,/heartquiz-invite/);
  for(const source of [app,privateApp]){
    assert.match(source,/if\(m\.game==='heartquiz'\)/);
    assert.match(source,/我发出的邀请/);
    assert.match(source,/邀请你/);
    assert.match(source,/function roleGameInvite\(id,kind\)/);
    assert.match(source,/kind=kind==='heartquiz'\?'heartquiz':'drawguess'/);
    assert.match(source,/roleGameInvite\(id,'heartquiz'\)/);
    assert.match(source,/roleGameInvite\(c\.id,'heartquiz'\)/);
    assert.match(source,/心动审判情侣问卷：\[心动审判\]/);
  }
});
