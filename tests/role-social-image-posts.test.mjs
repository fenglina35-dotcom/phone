import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

function functionSource(name) {
  const marker = `function ${name}(`;
  const markerStart = app.indexOf(marker);
  assert.notEqual(markerStart, -1, `${name} should exist`);
  const start = app.slice(Math.max(0, markerStart - 6), markerStart) === 'async ' ? markerStart - 6 : markerStart;
  const brace = app.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('role decides whether a concrete Moment or X post needs an image', () => {
  const plan = functionSource('roleSocialVisualPlan');
  assert.match(plan, /if\(!real\)return roleSocialCardPlan\(c,platform,text\)/, 'unconfigured Moments use the local text-card decision without another model call');
  assert.match(plan, /roleSocialVisualPrompt/, 'the role model makes the visual decision');
  assert.match(functionSource('roleSocialVisualPrompt'), /纯心情、抽象感想、关系表态/);
  assert.match(functionSource('publishRoleSocialAutonomous'), /await roleSocialMedia\(c,platform,text\)/, 'publishing waits for the shared real-image or text-card decision');
});

test('default-off card frequency preserves current behavior and the unconfigured path spends no model call', async () => {
  let modelCalls = 0, cardCalls = 0;
  const context = vm.createContext({
    S: { settings: { imgGen: false } },
    imageGenerationAvailable: () => false,
    roleSocialCardPlan: () => { cardCalls++; return { useImage: false, imagePrompt: '' }; },
    chatAPI: async () => { modelCalls++; return '{}'; },
    buildSystem: () => '', roleSocialVisualPrompt: () => '', parseObj: JSON.parse
  });
  vm.runInContext(functionSource('roleSocialVisualPlan'), context);
  const plan = await context.roleSocialVisualPlan({ photoFreqEnabled: false }, 'moment', '午后的咖啡');
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), { useImage: false, imagePrompt: '' });
  assert.equal(cardCalls, 1);
  assert.equal(modelCalls, 0, 'no image configuration must not spend an extra model request');
  assert.match(functionSource('roleSocialCardPlan'), /!c\.photoFreqEnabled/);
  assert.match(functionSource('roleSocialCardPlan'), /platform!==['"]moment['"]/);
});

test('failed social image generation retries exactly once and then falls back to text', async () => {
  let calls = 0;
  const context = vm.createContext({
    S: { settings: { imgGen: true } },
    imageGenerationAvailable: () => true,
    roleSocialVisualPlan: async () => ({ useImage: true, imagePrompt: '雨夜街灯' }),
    roleSocialImagePrompt: () => 'prompt',
    genImage: async () => { calls++; throw new Error('upstream failed'); },
    stableImageSrc: async value => value
  });
  vm.runInContext(functionSource('roleSocialImages'), context);
  const images = await context.roleSocialImages({}, 'moment', '雨夜回家');
  assert.deepEqual([...images], []);
  assert.equal(calls, 2, 'one initial attempt plus one automatic retry');
});

test('successful retry publishes one real image while publication supports text fallback', async () => {
  let calls = 0;
  const context = vm.createContext({
    S: { settings: { imgGen: true } },
    imageGenerationAvailable: () => true,
    roleSocialVisualPlan: async () => ({ useImage: true, imagePrompt: '桌上的咖啡' }),
    roleSocialImagePrompt: () => 'prompt',
    genImage: async () => { calls++; if (calls === 1) throw new Error('temporary'); return 'https://img.example/coffee.jpg'; },
    stableImageSrc: async value => value
  });
  vm.runInContext(functionSource('roleSocialImages'), context);
  const images = await context.roleSocialImages({}, 'x', '今晚的咖啡');
  assert.deepEqual([...images], ['https://img.example/coffee.jpg']);
  assert.equal(calls, 2);
  assert.match(functionSource('publishRoleMoment'), /Array\.isArray\(opt\.images\)/);
  assert.match(functionSource('publishRoleTweet'), /Array\.isArray\(opt\.images\)/);
});

test('unconfigured Moments use a text-photo card while configured image generation stays authoritative', async () => {
  const context = vm.createContext({
    S: { settings: { imgGen: false } },
    imageGenerationAvailable: () => false,
    roleSocialVisualPlan: async () => ({ useImage: true, imagePrompt: '窗边木桌上的热咖啡' }),
    roleSocialImages: async () => ['generated-image']
  });
  vm.runInContext(functionSource('roleSocialMedia'), context);
  const card = await context.roleSocialMedia({}, 'moment', '午后的咖啡');
  assert.deepEqual(JSON.parse(JSON.stringify(card)), {images:[], photoCards:[{desc:'窗边木桌上的热咖啡'}]});
  const x = await context.roleSocialMedia({}, 'x', '午后的咖啡');
  assert.deepEqual(JSON.parse(JSON.stringify(x)), {images:[], photoCards:[]});
  context.S.settings.imgGen = true;
  context.imageGenerationAvailable = () => true;
  const generated = await context.roleSocialMedia({}, 'moment', '午后的咖啡');
  assert.deepEqual(JSON.parse(JSON.stringify(generated)), {images:['generated-image'], photoCards:[]});
});

test('all autonomous role post entry points use the shared media pipeline', () => {
  assert.match(functionSource('doAutoMoment'), /publishRoleSocialAutonomous\(c,'moment'/);
  assert.match(functionSource('doAutoTweet'), /publishRoleSocialAutonomous\(c,'x'/);
  assert.match(functionSource('refreshMoments'), /publishRoleSocialAutonomous\(c,'moment'/);
  assert.match(functionSource('doGenContactTweet'), /publishRoleSocialAutonomous\(c,'x'/);
  assert.match(functionSource('genUserTweet'), /publishRoleSocialAutonomous\(isC,'x'/);
});

test('profile ellipsis uses a compact realistic spacing', () => {
  assert.match(html, /\.wx-real-nav button:last-child\{[^}]*letter-spacing:-1\.5px/);
  assert.match(app, /aria-label="联系人设置">•••<\/button>/);
});


test('social generation uses role-specific recent openings without rewriting history or spending an extra request', async () => {
  const posts=[{authorId:'a',text:'六点二十，咖啡终于凉了。'},{authorId:'b',text:'其他角色秘密开头'}];
  const tweets=[{who:'a',text:'07:30，又在等电梯。'}];
  const original=JSON.stringify({posts,tweets}), calls=[];
  const context=vm.createContext({S:{moments:posts,x:{tweets,users:{}}},circleObj:()=>({}),roleMomentRecentText:()=>'',roleTweetLifeContext:()=> '当前时间：08:10',buildSystem:()=> '角色人设',roleSocialIdentityPin:()=> '',roleChatRouteIndex:()=> 0,cleanReply:x=>x,cleanTweetText:x=>x,cleanMomentText:x=>x,roleMomentSimilarity:()=>({hard:false,soft:false}),roleTweetSimilarity:()=>({hard:false,soft:false}),chatAPI:async messages=>{calls.push(messages);return '杯沿的热气散了，正好喝。';}});
  for(const name of ['roleSocialOpeningPrompt','roleTweetGenerate','roleMomentGenerate'])vm.runInContext(functionSource(name),context);
  for(const platform of ['moment','x']){
    const prompt=context.roleSocialOpeningPrompt({id:'a'},platform);
    assert.match(prompt,/不要习惯性/);assert.match(prompt,/才自然提到准确时间/);assert.doesNotMatch(prompt,/其他角色秘密开头/);
  }
  await context.roleMomentGenerate({id:'a',name:'A'});
  await context.roleTweetGenerate({id:'a',name:'A'});
  assert.equal(calls.length,2);
  assert.match(calls[0][1].content,/六点二十/);assert.match(calls[1][1].content,/07:30/);
  assert.equal(JSON.stringify({posts,tweets}),original);
});
