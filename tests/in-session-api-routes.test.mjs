import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}`);
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

const sessionPages=functionSource('chatRouteSessionPage');
for(const page of ['off','rp','gs','mgroom','uc','wg','dread','tale']){
  assert.match(sessionPages,new RegExp(`'${page}'`),`${page} must use the selected in-session route`);
}

const gamePages=functionSource('gameModelSessionPage');
for(const page of ['gameshub','gs','drawguess','mgroom','uc','wg']){
  assert.match(gamePages,new RegExp(`'${page}'`),`${page} must follow the game-hall model selection`);
}

const chatApiSource=functionSource('chatAPI');
assert.match(chatApiSource,/if\(gameModelSessionPage\(\)\)opt\.aux=gameModelUseAux\(\)/);
assert.match(chatApiSource,/else if\(chatRouteSessionPage\(\)&&!opt\.allowSessionModel\)opt\.aux=false/);
assert.match(functionSource('chatRouteQuickOpen'),/新路线从下一次回复开始生效/);
assert.match(functionSource('chatRouteQuickButton'),/data-chat-route-quick="1"/);
assert.match(functionSource('chatRouteQuickButton'),/\$\{i\+1\}/);

const gameHub=functionSource('renderGameHub');
assert.match(gameHub,/gamehub-model/);
assert.match(gameHub,/gameModelToggle\(\)/);
assert.match(gameHub,/副模型/);

const mount=functionSource('chatRouteMount');
assert.match(mount,/\.nav \.r/);
assert.match(mount,/#dreadwrap/);
assert.match(mount,/#talewrap/);
assert.match(mount,/\.offstage/);
assert.match(source,/const _isWxPage=_wxGlassPages\.includes\(c\.p\);/);
assert.match(source,/const _wxG='';/);
assert.match(source,/const _wxStandalonePremium=\[[^\]]*'wxprofile'[^\]]*'wxsupport'[^\]]*\]\.includes\(c\.p\);\s*const _wxP=\(c\.p==='wechat'\|\|_wxStandalonePremium\)\?' wx-premium':\['chat','pfchat','pfgroup','group'\]\.includes\(c\.p\)\?' wx-chat-premium':'';[\s\S]{0,520}?app\.innerHTML='<div class="page'\+_glass\+_wxG\+_setG\+_wxL\+_wxP\+_wxSection\+_wxFont\+'">'\+html\+'<\/div>';[\s\S]{0,1200}?chatRouteMount\(c\);/);

const calls=[];
const context=vm.createContext({
  S:{settings:{chat:{base:'https://primary.example/v1',key:'primary-key',model:'primary-model',temp:.7,maxTokens:700},aux:{base:'https://aux.example/v1',key:'aux-key',model:'aux-model'},gameUseAux:false}},
  cur:()=>({p:'off'}),
  aiCoreOn:()=>false,
  chatRequestRoute:()=>null,
  chatMainCopy:x=>({...x}),
  fetchT:async(url,opt)=>{calls.push({url,body:JSON.parse(opt.body)});return{ok:true,json:async()=>({choices:[{message:{content:'ok'}}]})};},
  chatResultText:async(_messages,_opt,data)=>data.choices[0].message.content,
  roleInterceptDiagnosticTurnCandidate:(_audit,value)=>value,
  apiCaughtCN:e=>String(e),
  apiErrorCN:(status,msg)=>`${status}:${msg}`,
});
vm.runInContext(sessionPages,context);
vm.runInContext(gamePages,context);
vm.runInContext(functionSource('gameModelUseAux'),context);
vm.runInContext(functionSource('chatModelIsTtsOnly'),context);
vm.runInContext(functionSource('chatModelTypeError'),context);
vm.runInContext(functionSource('chatModelAssertText'),context);
vm.runInContext(functionSource('chatAPI'),context);
await context.chatAPI([],{aux:true});
assert.equal(calls[0].url,'https://primary.example/v1/chat/completions');
assert.equal(calls[0].body.model,'primary-model','an in-session reply must use the currently selected primary route');

context.cur=()=>({p:'gs'});
await context.chatAPI([],{aux:true});
assert.equal(calls[1].url,'https://primary.example/v1/chat/completions');
assert.equal(calls[1].body.model,'primary-model','games must use the main model when the hall selects main');

context.S.settings.gameUseAux=true;
await context.chatAPI([],{aux:false});
assert.equal(calls[2].url,'https://aux.example/v1/chat/completions');
assert.equal(calls[2].body.model,'aux-model','games must use the auxiliary model when the hall selects auxiliary');

context.cur=()=>({p:'chat'});
await context.chatAPI([],{aux:true});
assert.equal(calls[3].url,'https://aux.example/v1/chat/completions');
assert.equal(calls[3].body.model,'aux-model','other auxiliary tasks must keep their existing routing');

console.log('in-session api route tests passed');
