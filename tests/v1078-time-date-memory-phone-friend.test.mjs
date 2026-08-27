import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const leaveSql=fs.readFileSync(new URL('../supabase/migrations/202608270001_phone_friend_group_leave.sql',import.meta.url),'utf8');

test('time facts include short exact gaps and generated claims are verified once',()=>{
  assert.match(app,/function conversationGapExact\(gap\)/);
  assert.match(app,/距离上一段可见聊天精确过去/);
  assert.doesNotMatch(app.slice(app.indexOf('function conversationGapNote'),app.indexOf('const BEHAVIOR_META')),/gap<20\*60000/);
  assert.match(app,/function roleTimeClaimIssue\(content,c,now\)/);
  assert.match(app,/const ROLE_TIME_TOLERANCE_MINUTES=2/);
  assert.match(app,/Math\.abs\(said-real\)>ROLE_TIME_TOLERANCE_MINUTES/);
  assert.match(app,/distance>ROLE_TIME_TOLERANCE_MINUTES/);
  assert.match(app,/相差一两分钟属于自然表达，不必纠正/);
  assert.match(app,/把3分钟说成10分钟/);
  assert.match(app,/roleTimeRepairPrompt\(c,_timeIssue,_timeNow\)/);
  assert.match(app,/content=fix&&!roleTimeClaimIssue\(fix,c,_timeNow\)\?fix:''/);
  assert.match(app,/function roleReplyClockPin\(now\)/);
  assert.match(app,/只供你内部知道，不要机械复述/);
  assert.match(app,/除非当前话题确实涉及时间、作息、吃饭或日期，否则不要主动报时/);
  assert.match(app,/const _pin=\{role:'system',content:personaPin\(c\)\+roleReplyClockPin\(Date\.now\(\)\)\+roleReplyTimelinePin\(c\)\}/);
  assert.match(app,/未满一小时不能主动说“怎么这么久没理我”/);
  assert.match(app,/超过一小时才允许按人设自然在意/);
  assert.match(app,/对方直接询问时，无论间隔长短都必须按真实时间戳准确回答/);
  const ai=app.slice(app.indexOf('async function aiReply'),app.indexOf('function replyNoVisibleReasonFromContent'));
  assert.equal((ai.match(/roleTimeRepairPrompt\(c,_timeIssue,_timeNow\)/g)||[]).length,1,'a reply gets at most one true-model time repair');
  assert.ok(ai.indexOf('roleTimeRepairPrompt(c,_timeIssue,_timeNow)')>ai.indexOf('const comfortN='),'time verification must run after all content rewrites and immediately before delivery parsing');
});

test('clock verification tolerates two minutes including hour boundaries',()=>{
  const numberFn=app.match(/function clockNumberValue\(token\)\{[^\n]+\}/)?.[0];
  const distanceFn=app.match(/function clockMinuteDistance\(a,b\)\{[^\n]+\}/)?.[0];
  const claimFn=app.match(/function roleClockClaimDistance\(hourToken,minuteToken,qualifier,period,p\)\{[^\n]+\}/)?.[0];
  assert.ok(numberFn&&distanceFn&&claimFn);
  const distance=Function(`${numberFn}\n${distanceFn}\n${claimFn}\nreturn roleClockClaimDistance;`)();
  assert.equal(distance('10','','','',{hour:9,minute:59}),1);
  assert.equal(distance('9','57','','',{hour:9,minute:59}),2);
  assert.equal(distance('9','56','','',{hour:9,minute:59}),3);
  assert.equal(distance('11','','','',{hour:9,minute:0}),120);
  assert.equal(distance('十二','','','凌晨',{hour:23,minute:59}),1);
});

test('final clock guard catches a bare jumped hour but leaves schedules and two-minute drift alone',()=>{
  const names=['clockNumberValue','clockMinuteDistance','roleClockClaimDistance','roleTimeClaimIssue'];
  const src=names.map(name=>app.match(new RegExp(`function ${name}\\([^\\n]+`))?.[0]).filter(Boolean);
  assert.equal(src.length,names.length);
  const issue=Function(`const S={settings:{timeAware:true}};const ROLE_TIME_TOLERANCE_MINUTES=2;function roleTimeParts(){return {hour:3,minute:50};}function conversationGapFact(){return null;}function conversationClaimGapFact(){return null;}function conversationComplaintGapFact(){return null;}function conversationGapQuestion(){return false;}function conversationGapExact(){return '';}function msgToText(){return '';}\n${src.join('\n')}\nreturn roleTimeClaimIssue;`)();
  assert.match(issue('四点了，快睡吧',{id:'c'},1),/当前时间说成了四点/);
  assert.equal(issue('现在三点五十二分',{id:'c'},1),'');
  assert.equal(issue('我们四点见',{id:'c'},1),'');
  assert.equal(issue('已经约好四点见',{id:'c'},1),'');
  assert.equal(issue('等到四点了再叫我',{id:'c'},1),'');
});

test('direct gap questions use the earlier real return point instead of the latest few seconds',()=>{
  const pick=name=>app.match(new RegExp(`function ${name}\\([^\\n]+`))?.[0];
  const names=['conversationGapExact','clockNumberValue','clockMinuteDistance','roleClockClaimDistance','conversationVisibleRows','conversationGapFact','conversationGapQuestion','conversationHistoricalGapQuestion','conversationReferencedGapFact','conversationClaimGapFact','conversationComplaintGapFact','roleTimeClaimIssue'];
  const src=names.map(pick).filter(Boolean);
  assert.equal(src.length,names.length);
  const rows=[
    {id:'a1',role:'assistant',type:'text',content:'我在这儿等你',time:Date.UTC(2026,7,27,12,0)},
    {id:'s1',role:'user',type:'sys',content:'系统内部记录',time:Date.UTC(2026,7,27,14,3)},
    {id:'u1',role:'user',type:'text',content:'我刷视频回来啦',time:Date.UTC(2026,7,27,14,5)},
    {id:'a2',role:'assistant',type:'text',content:'看了什么',time:Date.UTC(2026,7,27,14,5,10)},
    {id:'u2',role:'user',type:'text',content:'我刚才隔了多久才回来？',time:Date.UTC(2026,7,27,14,6)}
  ];
  const make=Function('rows',`const S={settings:{timeAware:true}};const ROLE_TIME_TOLERANCE_MINUTES=2;function msgs(){return rows;}function msgToText(m){return m&&m.content||'';}function roleTimeParts(){return {hour:14,minute:6};}\n${src.join('\n')}\nreturn {current:conversationGapFact({id:'c'}),referenced:conversationReferencedGapFact({id:'c'}),issue:roleTimeClaimIssue};`);
  const result=make(rows);
  assert.equal(result.current.gap,50*1000,'the current follow-up itself is only fifty seconds later');
  assert.equal(result.referenced.gap,125*60000,'the asked-about return was two hours and five minutes later');
  assert.match(result.issue('你两分钟前跟我说去刷视频，现在才回来。',{id:'c'},Date.UTC(2026,7,27,14,6)),/2小时5分钟/);
});

test('a first return question uses its current gap rather than an unrelated older gap',()=>{
  const pick=name=>app.match(new RegExp(`function ${name}\\([^\\n]+`))?.[0];
  const names=['conversationVisibleRows','conversationGapFact','conversationGapQuestion','conversationHistoricalGapQuestion','conversationReferencedGapFact','conversationClaimGapFact'];
  const src=names.map(pick).filter(Boolean);
  assert.equal(src.length,names.length);
  const rows=[
    {id:'u0',role:'user',type:'text',content:'早',time:Date.UTC(2026,7,27,8,0)},
    {id:'a0',role:'assistant',type:'text',content:'早',time:Date.UTC(2026,7,27,8,1)},
    {id:'u1',role:'user',type:'text',content:'距离我们上次说话多久了？',time:Date.UTC(2026,7,27,8,21)}
  ];
  const fact=Function('rows',`function msgs(){return rows;}function msgToText(m){return m&&m.content||'';}\n${src.join('\n')}\nreturn conversationClaimGapFact({id:'c'});`)(rows);
  assert.equal(fact.gap,20*60000);
  assert.equal(fact.referenced,undefined);
});

test('long-silence complaints are blocked before one hour and allowed at one hour',()=>{
  const pick=name=>app.match(new RegExp(`function ${name}\\([^\\n]+`))?.[0];
  const names=['conversationGapExact','clockNumberValue','clockMinuteDistance','roleClockClaimDistance','conversationVisibleRows','conversationGapFact','conversationGapQuestion','conversationHistoricalGapQuestion','conversationReferencedGapFact','conversationClaimGapFact','conversationComplaintGapFact','roleTimeClaimIssue'];
  const src=names.map(pick).filter(Boolean);
  assert.equal(src.length,names.length);
  const make=Function('rows',`const S={settings:{timeAware:true}};const ROLE_TIME_TOLERANCE_MINUTES=2;function msgs(){return rows;}function msgToText(m){return m&&m.content||'';}function roleTimeParts(){return {hour:15,minute:0};}\n${src.join('\n')}\nreturn roleTimeClaimIssue;`);
  const at=Date.UTC(2026,7,27,14,20),rows=[{id:'u',role:'user',type:'text',content:'我去看会儿动画',time:at},{id:'a',role:'assistant',type:'text',content:'好',time:at+1000}];
  const issue=make(rows);
  assert.match(issue('怎么这么久没理我？',{id:'c'},at+59*60000),/未满一小时/);
  assert.equal(issue('怎么这么久没理我？',{id:'c'},at+60*60000),'');
});

test('one-time date end is durable and never falls back to a manufactured role line',()=>{
  assert.match(app,/c\._lastOfflineEnded=\{session:full\.session,endedAt:c\._offlineHandoff\.endedAt/);
  assert.match(app,/function offLastEndedPrompt\(c\)/);
  assert.match(app,/这不是共同生活，也不是仍待赴约的邀请/);
  assert.match(app,/绝不能把这同一场见面说成“马上去见你、等会儿见、还没见到”/);
  assert.doesNotMatch(app,/function offEndReplyFallback/);
  assert.match(app,/if\(fix&&offEndReplyMatches\(_offEndInfo,fix\)\)content=fix;else content=''/);
});

test('active memory frequency is a meaningful daily ceiling',()=>{
  assert.match(app,/memoryFreq:1/);
  assert.match(app,/function memoryFrequencyLimit\(\)/);
  assert.match(app,/return n===5\?5:n===3\?3:1/);
  assert.match(app,/function rememberFromConversation\(c,text,userText\)/);
  assert.match(app,/function memoryImportantCandidate\(text\)/);
  assert.match(app,/没有重要内容就不要输出，绝不能为达到数量编造/);
  assert.match(app,/偶尔 · 1条\/天/);
  assert.match(app,/经常 · 3条\/天/);
  assert.match(app,/总是 · 5条\/天/);
  assert.match(app,/rememberFromConversation\(c,mm\[1\],_userText\)/);
  assert.match(app,/rememberFromConversation\(c,tx,\(_luc&&msgToText\(_luc\)\)\|\|''\)/);
});

test('real-person recall is visible and group members can leave safely',()=>{
  assert.match(app,/class="pfrecall" aria-label="撤回这条消息"/);
  assert.match(html,/\.pfrecall\{[^}]*font-size:12px[^}]*min-height:28px/);
  assert.match(app,/function phoneFriendLeaveGroup\(gid\)/);
  assert.match(app,/phone_friend_group_leave/);
  assert.match(app,/群主不能直接退出，请先解散群聊/);
  assert.match(leaveSql,/phone_friend_check\(v_phone, p_secret\)/);
  assert.match(leaveSql,/owner-must-disband/);
  assert.match(leaveSql,/delete from public\.phone_friend_group_members/);
  assert.match(leaveSql,/grant execute on function public\.phone_friend_group_leave\(text,text,uuid\) to anon, authenticated/);
});
