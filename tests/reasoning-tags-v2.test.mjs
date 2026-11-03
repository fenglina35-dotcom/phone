import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read,fnSource,BUNDLES} from './_helpers.mjs';

// REASONING_TAGS_V2（2026-11-04）：视频通话把模型的 <thinking>…</thinking> 英文思考整段当台词念出来（用户截图）。
// 原因：通话路径不过滤思考块；微信的过滤只认 <think>（\b 让 <thinking> 漏过）。
for(const [label,file] of BUNDLES){
 const src=read(file);
 test(label+': thinking blocks never become dialogue, in WeChat or in calls',()=>{
  const ctx=vm.createContext({});
  vm.runInContext(fnSource(src,'roleStripReasoningBlocks')+fnSource(src,'wechatStripReasoningEnvelope'),ctx);
  const shot='<thinking>\nThe system is telling me that North just called me again on video, and I need to naturally continue.\n</thinking>\n【歪头看着镜头，眉毛挑了一下】\nYou hung up on me and called back within a minute.（挂了先生的电话一分钟不到又打回来了。）';
  const out=ctx.wechatStripReasoningEnvelope(shot);
  assert(!/thinking|The system is telling me/.test(out),out);
  assert(out.startsWith('【歪头看着镜头'));
  assert.equal(ctx.roleStripReasoningBlocks('<think>a</think>你好'),'你好');
  assert.equal(ctx.roleStripReasoningBlocks('思考内容</thinking>\n正文'),'正文','closing tag without opening keeps only what follows');
  assert.equal(ctx.roleStripReasoningBlocks('先说<thinking>没结尾'),'先说','unclosed thinking is dropped');
  assert.equal(ctx.roleStripReasoningBlocks('I am thinking about you.'),'I am thinking about you.','plain English stays');
 });
 test(label+': every call model reply goes through the reasoning filter',()=>{
  assert.match(src,/callChatWithRetry\(rows,routeMd\|\|_activeCallMd,c\)\)\.then\(t=>typeof t==='string'&&typeof roleStripReasoningBlocks==='function'\?roleStripReasoningBlocks\(t\):t\)/);
  assert.match(src,/<\\\/\?\(\?:think\(\?:ing\)\?\|analysis\|reasoning\)\\b/,'leak detector also knows <thinking>');
 });
}
