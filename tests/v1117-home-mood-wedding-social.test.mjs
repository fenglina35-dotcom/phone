import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const wedding=fs.readFileSync(new URL('../wedding-game.js',import.meta.url),'utf8');
const wechat=fs.readFileSync(new URL('../wechat-me.js',import.meta.url),'utf8');

function functionSource(source,name){
  const markers=[`async function ${name}(`,`function ${name}(`];
  const start=Math.min(...markers.map(x=>source.indexOf(x)).filter(x=>x>=0));
  assert.ok(Number.isFinite(start),`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i+=1){const ch=source[i];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='{')depth+=1;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);}
  throw new Error(`unterminated ${name}`);
}

test('long-press drag blocks native touch scrolling only after a real drag begins',()=>{
  assert.match(app,/function appTouchDragGuard\(e\)\{if\(_aDrag&&e\.cancelable\)e\.preventDefault\(\);\}/);
  assert.match(functionSource(app,'appBeginDrag'),/appTouchGuardAttach\(\)/);
  assert.match(functionSource(app,'appTouchGuardAttach'),/addEventListener\('touchmove',appTouchDragGuard,\{passive:false\}\)/);
  assert.match(functionSource(app,'appTouchGuardDetach'),/removeEventListener\('touchmove',appTouchDragGuard\)/);
  let prevented=0;const context=vm.createContext({_aDrag:null});
  vm.runInContext(`${functionSource(app,'appTouchDragGuard')};this.guard=appTouchDragGuard`,context);
  context.guard({cancelable:true,preventDefault(){prevented+=1;}});assert.equal(prevented,0,'normal paging must remain native');
  context._aDrag={};context.guard({cancelable:true,preventDefault(){prevented+=1;}});assert.equal(prevented,1,'active icon drag must keep horizontal movement in the app');
});

test('top mood stays visible across a failed refresh without fabricating new mood',()=>{
  assert.match(wechat,/界面与显示 → 顶部心情/);
  assert.match(wechat,/wxSettingsRow\('顶部心情',S\.settings\.showMoodTag===false\?'已关闭':'已开启'/);
  assert.doesNotMatch(wechat,/<h4>聊天<\/h4>[\s\S]{0,350}wxSettingsRow\('心情气泡'/);
  const context=vm.createContext({wechatNaturalOn:()=>true,String});
  vm.runInContext(`${functionSource(app,'visibleRoleThought')};this.visibleRoleThought=visibleRoleThought`,context);
  assert.equal(context.visibleRoleThought({innerThought:'上一条真实心声',innerThoughtAt:10,innerThoughtMissingAt:20}),'上一条真实心声');
  assert.equal(context.visibleRoleThought({innerThought:'',innerThoughtMissingAt:20}),'','no confirmed thought must remain empty');
  assert.match(app,/else\{c\.innerThoughtMissingAt=Date\.now\(\);save\(\);refreshChatMood\(id\);\}/,'failed extraction remains diagnosable without erasing stored thought');
});

test('manual wedding date is authoritative but does not rewrite ceremony records',()=>{
  const context=vm.createContext({Date,S:{couple:{cid:'role',married:true,marriageDate:'2026-12-25'}},weddingLocalDay:()=> '2026-08-30'});
  for(const name of ['weddingDateDayValid','weddingDateTimestamp','weddingOfficialDay'])vm.runInContext(functionSource(wedding,name),context);
  assert.equal(context.weddingDateDayValid('2026-02-29'),false);
  assert.equal(context.weddingDateDayValid('2028-02-29'),true);
  assert.equal(context.weddingOfficialDay({id:'role'},{date:1}),'2026-12-25');
  assert.equal(new Date(context.weddingDateTimestamp('2026-12-25')).getHours(),12,'local noon avoids timezone day rollover');
  assert.match(wedding,/cp\.marriageDateManual=true/);
  assert.match(app,/旧婚礼记录、旧记忆或你自己的猜测都不能把它改回去/);
  assert.match(wedding,/if\(!cp\.marriageDateManual\)\{cp\.marriedAt=/);
  assert.doesNotMatch(functionSource(wedding,'weddingMarriageDateSave'),/record\.date\s*=/,'manual edit must not destroy original ceremony provenance');
});

test('role Moment and X regeneration keeps the original post object and media',async()=>{
  assert.match(app,/重新生成此条内容/);
  assert.match(app,/p\.authorId!==\'me\'&&getC\(p\.authorId\).*重新生成/s);
  assert.match(functionSource(app,'regenerateRoleTweet'),/t\.text=text;t\.regeneratedAt=Date\.now\(\);save\(\);render\(\)/);
  assert.doesNotMatch(functionSource(app,'regenerateRoleTweet'),/unshift|splice|images\s*=/);
  assert.match(functionSource(app,'regenerateRoleMoment'),/p\.text=text;p\.regeneratedAt=Date\.now\(\);save\(\);momentRenderKeepScroll\(pid\)/);
  assert.doesNotMatch(functionSource(app,'regenerateRoleMoment'),/unshift|splice|images\s*=/);
  assert.match(functionSource(app,'roleSocialRegeneratePrompt'),/同一件事、同一组已知事实/);
});

test('explicit photo-and-caption request becomes a Moment and card fallback without image config',async()=>{
  const context=vm.createContext({});
  vm.runInContext(functionSource(app,'roleMomentPhotoCaptionIntent'),context);
  assert.equal(context.roleMomentPhotoCaptionIntent('我需要你发图并配文'),true);
  assert.equal(context.roleMomentPhotoCaptionIntent('给我发一张聊天图片'),false);
  assert.match(functionSource(app,'ensureRequestedPhotoCaptionMoment'),/replace\(\/\[\\\[【\]\\s\*图片/);
  assert.match(functionSource(app,'ensureRequestedPhotoCaptionMoment'),/\[发朋友圈\|/);
  assert.match(functionSource(app,'postRoleMoment'),/if\(!S\.settings\.imgGen\|\|!imageGenerationAvailable\(\)\)return publishRoleMomentCardFallback/);
  assert.match(app,/await ensureRequestedPhotoCaptionMoment\(content,c,_userText\)/);
});
