import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { read, fnSource, BUNDLES } from "./_helpers.mjs";

const source = read("app.js");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false, regex = false, regexClass = false, prev = "";
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (regex) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "[") regexClass = true;
      else if (ch === "]") regexClass = false;
      else if (ch === "/" && !regexClass) regex = false;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && /[=(,:;!&|?\[{]/.test(prev)) { regex = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const fields = {
  s_cbase: { value: "https://chat.example/v1" },
  s_ckey: { value: "sk-chat" },
  s_cmodel: { value: "speech-2.8-hd", focused: 0, selected: 0, focus() { this.focused++; }, select() { this.selected++; } },
  s_xbase: { value: "" },
  s_xkey: { value: "" },
  s_xmodel: { value: "gpt-4o-mini" },
  testC: { style: {}, textContent: "" },
  testX: { style: {}, textContent: "" },
};
let fetches = 0;
let response = { ok: true, status: 200, text: async () => JSON.stringify({choices:[{finish_reason:"stop",message:{content:"在"}}]}) };
const context = vm.createContext({
  setTimeout, clearTimeout, URL, uiConfirm:async()=>false,
  CHAT_ROUTE_NAMES: ["路线一", "路线二", "路线三", "路线四"],
  S: { settings: { chatRouteActive: 0 } },
  $: (selector) => fields[String(selector).replace(/^#/, "")] || null,
  fetchT: async () => { fetches++; return response; },
  apiErrorCN: () => "接口错误",
  apiCaughtCN: (e) => String(e && e.message || e),
});
for (const name of ["modelProbeModes", "modelProbeRead", "modelProbeText", "modelProbeResponse", "modelProbeBody", "chatCompletionBody", "wechatStripReasoningEnvelope"]) {
  if(source.includes('function '+name+'('))vm.runInContext(fnSource(source,name),context);
}
for (const name of ["chatModelIsTtsOnly", "chatModelTypeError", "chatModelAssertText", "testModel"]) {
  const fn = functionSource(name);
  vm.runInContext(name === "testModel" ? "async " + fn : fn, context);
}

assert.equal(context.chatModelIsTtsOnly("SPEECH-2.8-HD"), true);
assert.equal(context.chatModelIsTtsOnly("vendor/speech_02_turbo"), true);
assert.equal(context.chatModelIsTtsOnly("tts-1-hd"), true);
assert.equal(context.chatModelIsTtsOnly("gpt-4o-mini-tts"), true);
assert.equal(context.chatModelIsTtsOnly("speechless-chat"), false);
assert.equal(context.chatModelIsTtsOnly("gpt-4.1-mini"), false);

assert.throws(
  () => context.chatModelAssertText("speech-2.8-hd", "主聊天模型"),
  (error) => error && error.code === "chat-model-is-tts" && /语音合成模型/.test(error.message),
);
assert.doesNotThrow(() => context.chatModelAssertText("gpt-4o-mini", "主聊天模型"));

await context.testModel("s_cbase", "s_ckey", "s_cmodel", "testC", "gpt-4o-mini");
assert.equal(fetches, 0, "testing a TTS-only model must stop before the network request");
assert.match(fields.testC.textContent, /只能填在「语音模型 \/ TTS」里/);
assert.equal(fields.s_cmodel.focused, 1);
assert.equal(fields.s_cmodel.selected, 1);

fields.s_cmodel.value = "gpt-4o-mini";
await context.testModel("s_cbase", "s_ckey", "s_cmodel", "testC", "gpt-4o-mini");
assert.equal(fetches, 1, "a normal chat model must keep using the existing test request");
assert.match(fields.testC.textContent, /连接成功/);
assert.match(fields.testC.textContent, /路线一 · 主模型「gpt-4o-mini」/);

response = { ok: false, status: 503, text: async () => '{"error":{"message":"upstream worker overloaded"}}' };
await context.testModel("s_cbase", "s_ckey", "s_cmodel", "testC", "gpt-4o-mini");
assert.equal(fetches, 2);
assert.match(fields.testC.textContent, /路线一 · 主模型「gpt-4o-mini」非流式测试失败/);
assert.match(fields.testC.textContent, /接口错误/);

console.log("chat model type guard tests passed");

// Execute shipped entrypoints, including the old implementation for the must-fail check.
for(const [bundle,file] of BUNDLES){
 const src=read(file),out={style:{},textContent:''},inputs={s_cbase:{value:'https://fixture.invalid/v1'},s_ckey:{value:'fixture-key'},s_cmodel:{value:'text-model'},s_xbase:{value:''},s_xkey:{value:''},s_xmodel:{value:'aux-model'},s_sebase:{value:'https://fixture.invalid/v1'},s_sekey:{value:'fixture'},s_semodel:{value:'search-model'},s_reasoning_on:{checked:false},s_reasoning_effort:{value:'high'}};
 let reply='',saves=0,body;
 const c=vm.createContext({setTimeout,clearTimeout,URL,S:{settings:{chatRouteActive:0,chat:{},search:{mode:'model'}}},CHAT_ROUTE_NAMES:['路线一'],
  $:sel=>inputs[sel.slice(1)]||out,fetchT:async(u,o)=>{body=JSON.parse(o.body);return{ok:true,status:200,text:async()=>reply};},
  apiErrorCN:(status)=>'HTTP '+status,apiCaughtCN:e=>e.message,healthErr:e=>e.message,healthHttpFail:async()=>'',
  chatModelTypeError:()=>'',save:()=>saves++,uiConfirm:async()=>true});
 for(const name of ['modelProbeModes','modelProbeRead','modelProbeSearch','modelProbeText','modelProbeResponse','modelProbeBody','chatCompletionBody','wechatStripReasoningEnvelope','testModel','testConn','testCallScale','callScaleFiller','healthAsk','testSE','saveTestedSearch'])if(src.includes('function '+name+'('))vm.runInContext(fnSource(src,name),c);
 const valid={choices:[{finish_reason:'stop',message:{content:'在'}}]};
 const cases=['<html>upstream error</html>','',JSON.stringify({error:{message:'unavailable'}}),JSON.stringify({choices:[]}),JSON.stringify({choices:[{finish_reason:'stop',message:{content:''}}]}),JSON.stringify({choices:[{finish_reason:'length',message:{content:'在'}}]}),JSON.stringify({choices:[{finish_reason:'stop',message:{content:{error:'invalid'}}}]}),JSON.stringify({choices:[{finish_reason:'stop',message:{content:'<think>still thinking</think>'}}]})];
 for(const bad of cases){reply=bad;for(const slot of ['s_cmodel','s_xmodel']){await c.testModel('s_cbase','s_ckey',slot,'result','');assert.ok(!out.textContent.includes('✅'),bundle+' must reject bad response '+bad);}
 await c.testSE();assert.ok(!out.textContent.includes('✅'),bundle+' search model must reject bad response');
 await c.testConn();assert.ok(!out.textContent.includes('✅'),bundle+' legacy probe must reject bad response');
 await c.testCallScale();assert.ok(!out.textContent.includes('✅'),bundle+' call probe must reject bad response');
 const health=await c.healthAsk({base:'https://fixture.invalid',key:'fixture',model:'text-model'},'在');assert.ok(health.fail,bundle+' health probe must reject bad response');}
 reply=JSON.stringify(valid);await c.testModel('s_cbase','s_ckey','s_cmodel','result','');assert.match(out.textContent,/✅/);assert.ok(body.max_tokens>=256);assert.equal(body.stream,false);
 assert.equal((await c.healthAsk({base:'https://fixture.invalid',key:'fixture',model:'text-model'},'在')).text,'在');
 const parsed=c.modelProbeText({choices:[{finish_reason:'stop',message:{content:[{type:'text',text:'在'}]}}]});assert.equal(parsed,'在');
 await assert.rejects(c.modelProbeResponse({ok:true,status:200,text:()=>new Promise(()=>{})},5),/超时/);
 assert.equal(saves,0,'failed tests must not change model configuration');
 await c.testSE();assert.match(out.textContent,/✅/);assert.equal(saves,1);
 await assert.rejects(c.modelProbeSearch({ok:true,status:200,text:async()=>'<html>error</html>'}),/搜索结果/);
 await c.modelProbeSearch({ok:true,status:200,text:async()=>'Title: Example\nURL Source: https://example.com'});
}

// The shared request builder must preserve the opt-in reasoning switch.
for(const [bundle,file] of BUNDLES){
 const src=read(file),fields={s_reasoning_on:{checked:false},s_reasoning_effort:{value:'high'}},c=vm.createContext({URL,S:{settings:{chat:{}}},$:s=>fields[s.slice(1)]});
 vm.runInContext(fnSource(src,'chatCompletionBody')+';'+fnSource(src,'modelProbeBody'),c);
 let body=c.modelProbeBody('deepseek-reasoner','https://api.deepseek.com','在');assert.equal(body.thinking.type,'disabled');assert.ok(!('reasoning_effort' in body));
 fields.s_reasoning_on.checked=true;body=c.modelProbeBody('deepseek-reasoner','https://api.deepseek.com','在');assert.equal(body.thinking.type,'enabled');assert.equal(body.reasoning_effort,'high');assert.ok(body.max_tokens>256);
 body=c.modelProbeBody('text-model','https://fixture.invalid/v1','在');assert.equal(body.reasoning_effort,'high');assert.ok(!('thinking' in body));
}

// Transport fallback is explicit, isolated, and must validate complete SSE.
for(const [bundle,file] of BUNDLES){
 const src=read(file),output={style:{},isConnected:true},requests=[];let approve=true,answers=[],confirmations=0;
 const c=vm.createContext({setTimeout,clearTimeout,URL,S:{settings:{chatStreaming:false}},apiErrorCN:()=> 'HTTP error',apiCaughtCN:e=>e.message,
  uiConfirm:async()=>{confirmations++;return approve;},fetchT:async(u,o)=>{requests.push(JSON.parse(o.body));return {ok:true,status:200,text:async()=>answers.shift()};}});
 vm.runInContext(read('request-diagnostics.js'),c);
 for(const name of ['modelProbeRead','modelProbeText','modelProbeResponse','modelProbeModes','wechatStripReasoningEnvelope'])vm.runInContext(fnSource(src,name),c);
 const sse='data: '+JSON.stringify({choices:[{index:0,delta:{content:'在'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
 answers=['<html>upstream error</html>',sse];await c.modelProbeModes(output,'https://fixture.invalid','key',{model:'fixture'},'主模型',100);
 assert.deepEqual(requests.map(x=>x.stream),[false,true]);assert.match(output.textContent,/✅/);assert.match(output.textContent,/非流式测试失败/);assert.equal(c.S.settings.chatStreaming,false);assert.equal(confirmations,1);
 requests.length=0;answers=['bad'];approve=false;await c.modelProbeModes(output,'https://fixture.invalid','key',{},'主模型',100);assert.equal(requests.length,1);assert.match(output.textContent,/尚未测试/);
 requests.length=0;approve=true;c.S.settings.chatStreaming=true;answers=['data: {"choices":[{"delta":{"content":"半截"}}]}\n\n',JSON.stringify({choices:[{finish_reason:'stop',message:{content:'在'}}]})];
 await c.modelProbeModes(output,'https://fixture.invalid','key',{},'副模型',100);assert.deepEqual(requests.map(x=>x.stream),[true,false]);assert.match(output.textContent,/✅/);assert.equal(c.S.settings.chatStreaming,true);
 answers=['bad','data: {"choices":[{"delta":{"content":"在"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'];await c.modelProbeModes(output,'https://fixture.invalid','key',{},'副模型',100);assert.match(output.textContent,/两种模式均测试失败/);assert.ok(!output.textContent.includes('✅'));
}
