import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function cleanupOld()');
const end=source.indexOf('setInterval(cleanupOld',start);
assert.ok(start>=0&&end>start);
const cleanup=source.slice(start,end);

test('social posts remain retained and keep their explicit delete controls',()=>{
  assert.doesNotMatch(cleanup,/S\.moments\s*=\s*S\.moments\.filter/,'moments must not expire after 24 hours');
  assert.doesNotMatch(cleanup,/S\.x\.tweets\s*=\s*S\.x\.tweets\.filter/,'tweets must not expire after 24 hours');
  assert.match(source,/\$\{fmtDT\(p\.time\)\}/,'moments must show full year-month-day time');
  assert.match(source,/aria-label="删除朋友圈"[\s\S]*?svgIc\('trash',14/);
  assert.match(source,/aria-label="删除朋友圈"[\s\S]*?svgIc\('trash',15/);
  assert.match(source,/aria-label="删除推文"[\s\S]*?svgIc\('trash',14/);
  const deletion=source.slice(source.indexOf('async function momentDelete(pid)'),source.indexOf('function momentMenu(',source.indexOf('async function momentDelete(pid)')));
  assert.match(deletion,/S\.moments\.some\(x=>x&&x\.id===pid\)/);
  assert.doesNotMatch(deletion,/authorId===['"]me['"]/,'role moments must remain deletable');
});

test('moment likes and comments are inline, reversible, and preserve the current scroll position',()=>{
  assert.match(source,/function momentRenderKeepScroll\(/);
  assert.match(source,/const restore=\(\)=>\{const after=momentScrollElement\(\);if\(after\)after\.scrollTop=top/);
  assert.match(source,/requestAnimationFrame\(\(\)=>\{restore\(\);requestAnimationFrame\(restore\);\}\)/);
  assert.match(source,/function toggleMomentLike\(pid\)/);
  assert.match(source,/splice\(i,1\)/);
  assert.match(source,/push\(S\.me\.name\)/);
  assert.match(source,/function momentCommentFocus\(pid,replyName,targetCid\)/);
  assert.match(source,/function momentCommentSubmit\(pid,inputId\)/);
  assert.match(source,/class="moment-action-popover"/);
  assert.match(source,/class="moment-inline-compose"/);
  assert.doesNotMatch(source,/openModal\(`<h3>互动<\/h3>/);
});

test('role replies to moment comments use the exact thread and recent WeChat context without fake fallback text',()=>{
  const begin=source.indexOf('async function reactToComment(');
  const end=source.indexOf('function ',begin+20);
  const block=source.slice(begin,end);
  assert.match(block,/lastRounds\(msgs\(c\.id\),12\)\.slice\(-80\)/);
  assert.match(block,/最近的微信私聊上下文/);
  assert.match(block,/按时间顺序，已标明说话人/);
  assert.match(block,/selectRelevantMemory\(c,query,4\)/);
  assert.match(block,/buildSystem\(c,\{natural:wechatNaturalOn\(\),query,selectiveMemory:true,memoryItems:memory\.items\}\)/);
  assert.match(block,/memoryRetrievalPrompt\(c,memory\)/);
  assert.match(block,/targetComment/);
  assert.match(block,/roleBackgroundCancel\(c\.id,\['one_minute_test','app_watch_test'\]\)/);
  assert.match(block,/chatAPI\(request,\{timeout:70000\}\)/);
  assert.match(block,/\+e\.status===503/);
  assert.equal((block.match(/await chatAPI\(/g)||[]).length,1,'Moment comments must use the July 30 single real model request');
  assert.match(block,/momentReplySpecific/);
  assert.doesNotMatch(source,/function momentReplySpecific\(txt\)[^\n]*看到了\|我看到了\|收到/);
  assert.match(block,/像真人回评论那样接话、回应或调侃/);
  assert.doesNotMatch(functionBlock('momentReplyStatusHTML'),/正在回复|正在真实回复/);
  assert.doesNotMatch(source,/function momentReplyFallback\(/);
});

test('failed moment comment retries retain the exact role target without inventing a reply',()=>{
  const submit=functionBlock('momentCommentSubmit');
  const target=functionBlock('momentCommentReplyContact');
  const retryStart=source.indexOf('function momentRetryComment('),retry=source.slice(retryStart,source.indexOf('async function reactToComment(',retryStart));
  const reply=source.slice(source.indexOf('async function reactToComment('),source.indexOf('async function refreshMoments',source.indexOf('async function reactToComment(')));
  assert.match(submit,/comment\._roleReplyContactId=targetCid/);
  assert.match(target,/cm\._roleReplyContactId&&getC\(cm\._roleReplyContactId\)/);
  assert.match(target,/p\.authorId!=='me'&&getC\(p\.authorId\)/);
  assert.match(retry,/const target=momentCommentReplyContact\(p,cm\)/);
  assert.match(retry,/reactToComment\(p,target,cm\)/);
  assert.match(reply,/targetComment\._roleReplyContactId=c\.id/);
  assert.doesNotMatch(retry,/comments\.push|text:/,'retry only re-runs the real role request and never inserts fallback text');
});

function functionBlock(name){const begin=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',begin+10);assert.ok(begin>=0);return source.slice(begin,end<0?source.length:end);}

test('role-set app limits keep counting and locking without a floating countdown badge',()=>{
  const tick=functionBlock('usageTick');
  assert.match(tick,/au\.used\[key\]=\(au\.used\[key\]\|\|0\)\+1/);
  assert.match(tick,/if\(remain<=0\)/);
  assert.match(tick,/S\.couple\.locks/);
  assert.doesNotMatch(tick,/textContent='⏳|style\.display=.*block/);
});
