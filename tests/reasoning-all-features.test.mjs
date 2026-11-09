// REASONING_ALL_FEATURES_V1 (2026-11-04): a moment comment reply showed "<thinking> North said ..." because only calls
// and WeChat stripped inline thinking. Now every feature strips it at the shared model output; the reply text is kept
// word for word. With "在心声中查看思考摘要" on, the inline thinking goes to that summary instead. A reply that is only
// thinking shows 「思维链暴露未展示」, never a generic failure.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const ctx = vm.createContext({ Math, Number, String, Object, Array, JSON, RegExp, Error,
    roleMoodScopeText: (t) => t, S: { settings: { roleThinkingPreview: true } } });
  for (const name of ['wechatStripReasoningEnvelope', 'roleStripReasoningBlocks', 'chatResultText', 'roleThinkingOn', 'roleThinkingCapture'])
    vm.runInContext(fnSource(src, name), ctx);
  const run = async (content, extra = {}) => {
    const opt = Object.assign({}, extra);
    const out = await ctx.chatResultText([], opt, { choices: [{ message: { content }, finish_reason: 'stop' }] });
    return { out, only: opt._reasoningOnly };
  };
  let r = await run('<thinking> North said "我看" in response to my comment. She\'s sa');
  assert.equal(r.out, '', `${label}: unclosed thinking never reaches the moment comment`);
  assert.equal(r.only, true, `${label}: a thinking-only reply is flagged`);
  r = await run('<thinking>she wants me</thinking>\n那你看吧，只给你看。');
  assert.equal(r.out, '那你看吧，只给你看。', `${label}: the reply after thinking is kept word for word`);
  r = await run('<thinking>x</thinking>原样回复', { unfilteredOutput: true });
  assert.equal(r.out, '原样回复', `${label}: raw output mode also drops only the thinking block`);
  r = await run('No thinking here, just English lyrics.');
  assert.equal(r.out, 'No thinking here, just English lyrics.', `${label}: ordinary text is untouched`);
  assert.equal(r.only, false);

  const cap = { rows: [] };
  ctx.roleThinkingCapture({ reasoningCapture: cap, allowWechatThought: true },
    { choices: [{ message: { content: '<thinking>她在逗我</thinking>才不给你看' } }] }, '才不给你看');
  assert.equal(cap.rows[0].summary, '她在逗我', `${label}: with the summary on, inline thinking moves to the summary as written`);

  assert.match(fnSource(src, 'chatAPI'), /if\(opt\._reasoningOnly&&!String\(out\|\|''\)\.trim\(\)\)\{const e=new Error\('思维链暴露未展示'\);e\.code='reasoning-only';throw e;\}/,
    `${label}: thinking-only replies report 思维链暴露未展示`);
  assert.match(fnSource(src, 'momentReplyStatusHTML'), /思维链暴露未展示/, `${label}: moment retry shows the specific reason`);
}
const push = read('supabase/functions/phone-role-push/index.ts');
assert.match(push, /REASONING_ALL_FEATURES_V1[\s\S]*?function stripReasoningBlocks/);
assert.match(push, /const reasoningFree = stripReasoningBlocks\(rawText\);\s*let text = unfilteredOutput \? reasoningFree/);
console.log('reasoning all features tests passed');

for(const [label,file] of BUNDLES){
 const src=read(file),ctx=vm.createContext({URL,Math,Number,String,Object,Array,RegExp,Error,roleMoodScopeText:t=>t});
 vm.runInContext(fnSource(src,'chatCompletionBody'),ctx);vm.runInContext(fnSource(src,'chatResultText'),ctx);
 const a={base:'https://api.deepseek.com',model:'deepseek-v4-pro',maxTokens:4096,temp:0.8};
 let body=ctx.chatCompletionBody([],{max:700,groupOutput:true},a,false);
 assert.equal(body.max_tokens,4096,label);assert.equal(body.thinking.type,'disabled',label);
 body=ctx.chatCompletionBody([],{max:700},{...a,reasoningEnabled:true,reasoningEffort:'high'},true);
 assert.equal(body.max_tokens,12288,label);assert.equal(body.stream,true);assert.equal(body.thinking.type,'enabled');
 body=ctx.chatCompletionBody([],{max:600},{...a,base:'https://another.invalid/v1',model:'claude'},false);
 assert.equal(body.max_tokens,600);assert.equal(body.thinking,undefined);
 await assert.rejects(()=>ctx.chatResultText([],{complete:true},{choices:[{message:{content:'',reasoning_content:'still thinking'},finish_reason:'length'}]}),e=>e.code==='reasoning-budget');
 assert.equal(await ctx.chatResultText([],{complete:false},{choices:[{message:{content:'正常正文'},finish_reason:'stop'}]}),'正常正文');
}
