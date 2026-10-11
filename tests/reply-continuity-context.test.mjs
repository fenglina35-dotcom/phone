import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g,'\n');
const bundled = readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8').replace(/\r\n/g,'\n');
const releaseVersion = source => Number(source.match(/const APP_VER='v(\d+)/)?.[1] || 0);

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let quote = '';
  let escape = false;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('100 configured WeChat rounds are real complete ordinary rounds', () => {
  const context = vm.createContext({ Math });
  vm.runInContext(`${functionSource(app, 'lastRounds')};this.lastRounds=lastRounds`, context);
  const rows = [];
  for (let round = 0; round < 120; round += 1) {
    rows.push({ id: `u${round}`, role: 'user', content: `用户${round}` });
    for (let bubble = 0; bubble < 4; bubble += 1) rows.push({ id: `a${round}-${bubble}`, role: 'assistant', content: `回复${round}-${bubble}` });
  }
  const selected = context.lastRounds(rows, 100);
  assert.equal(selected.length, 500);
  assert.equal(selected[0].id, 'u20');
  assert.equal(selected.at(-1).id, 'a119-3');
  assert.equal(selected.filter(row => row.role === 'user').length, 100);
});

test('the settings UI and save path both state and enforce the 2 to 100 range', () => {
  assert.match(app, /带几个回合（2–100，最高100回合）/);
  assert.match(app, /整通语音\/视频算1回合/);
  assert.match(app, /id="s_hist" type="number" min="2" max="100"/);
  assert.match(app, /S\.settings\.hist=Math\.max\(2,Math\.min\(100,/);
  assert.doesNotMatch(app, /S\.settings\.hist=Math\.max\(2,Math\.min\(40,/);
});

test('continuity pin keeps raw cross-channel statements without turning examples into facts', () => {
  const now = Date.parse('2026-08-28T20:00:00+08:00');
  const rows = Array.from({ length: 10 }, (_, index) => ({
    at: now - (10 - index) * 60_000,
    channel: index === 7 ? 'call' : index === 8 ? 'cohab' : 'online',
    role: index % 2 ? 'assistant' : 'user',
    text: index === 8 ? '比如说已经回家又说还在路上' : index === 9 ? '我刚答应等你回来再说' : `原话${index}`,
  }));
  const context = vm.createContext({
    Date,
    String,
    S: { settings: { timeAware: true }, me: { name: '用户' } },
    roleInteractionRows: () => rows,
    offlineWechatLiveOn: () => true,
    fmtDT: value => new Date(value).toISOString(),
  });
  vm.runInContext(`${functionSource(app, 'roleRecentChannelRounds')}${functionSource(app, 'roleReplyContinuityPin')};this.pin=roleReplyContinuityPin`, context);
  const prompt = context.pin({ name: '角色' }, now);
  assert.doesNotMatch(prompt, /原话0|原话1/);
  assert.match(prompt, /\[电话\]/);
  assert.match(prompt, /\[共同生活\]/);
  assert.match(prompt, /我刚答应等你回来再说/);
  assert.match(prompt, /假设、举例、引用、玩笑、询问和尚未实行的计划不能当成已经发生/);
  assert.match(prompt, /不得无依据推翻、倒退或改写上一轮状态/);
  assert.match(prompt, /资料不足就自然询问/);
  assert.doesNotMatch(functionSource(app, 'roleReplyContinuityPin'), /chatAPI\(/);
});

test('continuity is limited to reply routes and excluded from global and visual-special prompts', () => {
  assert.doesNotMatch(functionSource(app, 'buildSystem'), /roleReplyContinuityPin/);
  assert.match(app, /const _pin=roleReplyRequestPin\(c,Date\.now\(\)\)/);
  assert.match(functionSource(app, 'roleReplyRequestPin'), /roleReplyTimelinePin\(c\)\+roleReplyContinuityPin\(c,now\)\+roleReplyCrossChannelHandoffPrompt\(c,now\)/);
  assert.match(functionSource(app, 'roleServerPushRecentContext'), /roleReplyContinuityPin\(c,Date\.now\(\)\)/);
  assert.match(functionSource(app, 'cohabReplyCore'), /offlineFormatPin\(c\)\+roleReplyContinuityPin\(c,Date\.now\(\),\{channel:'cohab'\}\)/);
  assert.match(functionSource(app, 'cohabRepairMessages'), /offlineFormatPin\(c\)\+roleReplyContinuityPin\(c,Date\.now\(\),\{channel:'cohab'\}\)/);
  assert.match(app, /const _ordinaryCallContinuity=!_videoVision&&!_screenShareEvent&&!_connectionEvent&&!_inspectionCompletion\?roleReplyContinuityPin/);
});

test('disabled online and co-living sync keeps both continuity worlds isolated', () => {
  const now = Date.parse('2026-08-28T20:00:00+08:00');
  const rows = [
    { at: now - 3_000, channel: 'online', role: 'user', text: '微信里的事情' },
    { at: now - 2_000, channel: 'call', role: 'assistant', text: '电话里的回答' },
    { at: now - 1_000, channel: 'cohab', role: 'user', text: '共同生活里的事情' },
  ];
  const context = vm.createContext({
    Date,
    String,
    S: { settings: { timeAware: true }, me: { name: '用户' } },
    roleInteractionRows: () => rows,
    offlineWechatLiveOn: () => false,
    fmtDT: value => new Date(value).toISOString(),
  });
  vm.runInContext(`${functionSource(app, 'roleRecentChannelRounds')}${functionSource(app, 'roleReplyContinuityPin')};this.pin=roleReplyContinuityPin`, context);
  const online = context.pin({ name: '角色' }, now);
  assert.match(online, /微信里的事情/);
  assert.match(online, /电话里的回答/);
  assert.doesNotMatch(online, /共同生活里的事情/);
  const cohab = context.pin({ name: '角色' }, now, { channel: 'cohab' });
  assert.match(cohab, /共同生活里的事情/);
  assert.doesNotMatch(cohab, /微信里的事情|电话里的回答/);
});

test('web source and private iOS bundle both keep the continuity functions they execute', () => {
  for(const name of ['roleRecentChannelRounds','roleReplyContinuityPin','lastRounds','roleReplyRequestPin','roleServerPushRecentContext','cohabReplyCore','cohabRepairMessages']){
    assert.match(functionSource(app,name),/\S/,`web continuity function is empty: ${name}`);
    assert.match(functionSource(bundled,name),/\S/,`private continuity function is empty: ${name}`);
  }
  assert.match(functionSource(bundled,'cohabReplyCore'),/cohabReplyHistory\(c,o\)/);
  assert.match(functionSource(bundled,'cohabReplyCore'),/cohabRepairMessages\(c,o,turn/);
});

for(const [label,src] of [['web',app],['private',bundled]])test(label+' a previous photo cannot become a mandatory response in an unrelated new turn',()=>{
 const rows=[{id:'photo',role:'user',type:'image',desc:'轮回对戒'}, {role:'assistant',type:'text',content:'已经看过了'}, {id:'now',role:'user',type:'text',content:'好～'}],ctx=vm.createContext({S:{settings:{hist:12}},id:'r',msgs:()=>rows,lastRounds:r=>r,note:'',_lu:rows[2],_userText:'好～'});
 const line=src.split('\n').find(l=>l.trim().startsWith('const _recentVision='));vm.runInContext(line+'\nglobalThis.guard=_visionGuard;',ctx);assert.equal(ctx.guard,'');
});

for(const [label,src] of [['web',app],['private',bundled]])test(label+' old dismissive words remain remembered but cannot be described as just now in a new thought',()=>{const now=Date.now(),rows=[{role:'user',at:now-7200000,text:'滚'}, {role:'assistant',at:now-7199000,text:'先冷静'}, {role:'user',at:now-1000,text:'好～'}],c={id:'r'},ctx=vm.createContext({Date,roleInteractionRows:()=>rows,wechatNaturalOn:()=>true,rememberValidInnerThought(){}});for(const name of ['roleThoughtRecencyText','naturalInnerThoughtText','setNaturalInnerThought'])vm.runInContext(functionSource(src,name),ctx);ctx.setNaturalInnerThought(c,'她刚才让我滚，我还有点不高兴');assert.match(c.innerThought,/之前让我滚/);assert.doesNotMatch(c.innerThought,/刚才/);});

for(const [label,src] of [['web',app],['private',bundled]])test(label+' thinking about a query or food order cannot execute it',()=>{const ctx=vm.createContext({String});vm.runInContext(functionSource(src,'roleActionEnvelopeContent'),ctx);const clean=ctx.roleActionEnvelopeContent('[内心|想[查店铺|奶茶]，也想[点外卖|奶茶|15|店|无|温热|1]，还没决定]\n好～\n[锁定|微信]');assert.doesNotMatch(clean,/查店铺|点外卖/);assert.match(clean,/内心/);assert.match(clean,/好～/);assert.match(clean,/\[锁定\|微信\]/);const query=src.indexOf('const _shopAction=content.match('),envelope=src.lastIndexOf('content=roleActionEnvelopeContent(content);',query);assert(envelope>=0&&envelope<query);});

for(const [label,source] of [['web',app],['private',bundled]])test(label+' precise time trial anchors departure instead of latest input and cancels commitments safely',async()=>{
 const start=source.indexOf('/* PRECISE_ROLE_TIME_TEST_V1 */'),end=source.indexOf('/* END_PRECISE_ROLE_TIME_TEST_V1 */');assert(start>=0&&end>start,'precise-time feature missing');
 let now=10000000;const c={id:'r',proactive:{enabled:true}},rows=[],S={settings:{timeAware:true,preciseRoleTime:true,preciseRoleTimeSince:now,preciseRoleTimeEpoch:'e'},contacts:[c],me:{},messages:{}};
 const x={S,Date:class extends Date{static now(){return now}},msgs:()=>rows,msgToText:m=>m.content,getC:()=>c,roleCrossChannelOn:()=>true,actId:()=> 'main',fmtDT:t=>String(t),conversationGapExact:ms=>String(ms),save:()=>{},render:()=>{},toast:()=>{},uid:()=> 'new'};vm.runInNewContext(source.slice(start,end),x);
 rows.push({role:'user',content:'我去上厕所了',time:now});now+=1000;rows.push({role:'assistant',content:'给你三分钟，到点我找你。',time:now});const due=now+180000;
 assert.equal(x.rolePreciseTimeState(c).promise.dueAt,due);now+=23*60000;rows.push({role:'user',content:'我回来了',time:now});const state=x.rolePreciseTimeState(c);assert.equal(state.departure.at,10000000);assert.equal(state.departure.returnedAt,now);assert.equal(state.promise,null);assert.equal(x.rolePreciseTimeClaimGap(c,'你离开已经过了一分钟。',now).gap,1381000);assert.match(x.rolePreciseTimePrompt(c),/1381000/);assert.doesNotMatch(x.rolePreciseTimePrompt(c),/待执行/);
 rows.push({role:'user',content:'我们聊聊电影吧',time:now+1});now+=1;assert.equal(x.rolePreciseTimePrompt(c),'','unrelated chat gets no repeated event reminder');assert.equal(x.rolePreciseTimeConfig(c).departure,null);S.settings.preciseRoleTime=false;assert.equal(x.rolePreciseTimePrompt(c),'');assert.equal(x.rolePreciseTimeConfig(c).enabled,false);
 S.settings.preciseRoleTime=true;S.settings.preciseRoleTimeSince=now;S.settings.preciseRoleTimeEpoch='new';assert.equal(x.rolePreciseTimeState(c).promise,null);
 S.settings.timeAware=false;assert.equal(x.rolePreciseTimePrompt(c),'');
});
for(const [label,source] of [['web',app],['private',bundled]])test(label+' precise time trial does not invent timestamps or schedule uncertain/quoted promises',()=>{
 const start=source.indexOf('/* PRECISE_ROLE_TIME_TEST_V1 */'),end=source.indexOf('/* END_PRECISE_ROLE_TIME_TEST_V1 */');assert(start>=0);let now=9000000;const c={id:'r'},rows=[];
 const x={S:{settings:{timeAware:true,preciseRoleTime:true,preciseRoleTimeSince:1,preciseRoleTimeEpoch:'e'}},Date:class extends Date{static now(){return now}},msgs:()=>rows,msgToText:m=>m.content,roleCrossChannelOn:()=>true};vm.runInNewContext(source.slice(start,end),x);
 rows.push({role:'user',content:'我去吃饭了'});assert.equal(x.rolePreciseTimeState(c).departure,null);
 for(const text of ['也许三分钟后我找你。','三分钟后我去洗澡。','三分钟后我找你吗？','你说“三分钟后我找你”。','如果三分钟后我找你，你会回吗？','三分钟后我不找你。','三分钟后他来找你。','[内心|三分钟后我找你]'])assert.equal(x.rolePreciseTimePromise(text,now),null,text);
 assert.equal(x.rolePreciseTimePromise('三分钟后我来找你。',now).dueAt,now+180000);assert.equal(x.rolePreciseTimePromise('十秒后我联系你。',now),null,'minimum one minute');rows.push({role:'user',content:'张三去上厕所了',time:now-181000},{role:'assistant',content:'三分钟后我找你。',time:now-180000},{role:'assistant',content:'回来了吗？',time:now});assert.equal(x.rolePreciseTimeState(c).departure,null,'other people are not the user');assert.equal(x.rolePreciseTimeState(c).promise,null,'already contacted at deadline');
});

for(const [label,source] of [['web',app],['private',bundled]])test(label+' precise foreground commitment yields to busy/server paths and is revoked on toggle',async()=>{
 const start=source.indexOf('/* PRECISE_ROLE_TIME_TEST_V1 */'),end=source.indexOf('/* END_PRECISE_ROLE_TIME_TEST_V1 */');let now=9000000,calls=0,busy=true,note='';const c={id:'r',proactive:{enabled:true}},rows=[{role:'user',content:'我去上厕所了',time:now-181000},{role:'assistant',content:'三分钟后我来找你。',time:now-180000}];
 const x={S:{settings:{timeAware:true,preciseRoleTime:true,preciseRoleTimeSince:1,preciseRoleTimeEpoch:'e'},me:{}},Date:class extends Date{static now(){return now}},msgs:()=>rows,msgToText:m=>m.content,roleCrossChannelOn:()=>true,getC:()=>c,actId:()=> 'main',fmtDT:t=>String(t),conversationGapExact:t=>String(t),save:()=>{},replyGenerationBusy:()=>busy,initiativeQueueNote:(_,__,text)=>text,replyEpoch:()=>1,aiReply:async(_,text)=>{calls++;note=text}};vm.runInNewContext(source.slice(start,end),x);
 assert.equal(x.rolePreciseTimeMaybeSend(c),false);assert.equal(c._preciseTimeRuns,undefined);busy=false;c.proactive.serverPush=true;assert.equal(x.rolePreciseTimeMaybeSend(c),false);c.proactive.serverPush=false;
 assert.equal(x.rolePreciseTimeMaybeSend(c),true);assert.equal(calls,1);assert.equal(x.rolePreciseTimeMaybeSend(c),false);assert.equal(x.rolePreciseTimeNoteValid(note,'r'),true);x.S.settings.preciseRoleTime=false;assert.equal(x.rolePreciseTimeNoteValid(note,'r'),false);assert.equal(x.rolePreciseTimeNoteValid('ordinary reply','r'),true);
 x.S.settings.preciseRoleTime=true;x.S.settings.preciseRoleTimeEpoch='new';assert.equal(x.rolePreciseTimeNoteValid(note,'r'),false);
});

for(const [label,source] of [['web',app],['private',bundled]])test(label+' precise synchronization serializes toggles and drops queued work after account changes',async()=>{
 const start=source.indexOf('/* PRECISE_ROLE_TIME_TEST_V1 */'),end=source.indexOf('/* END_PRECISE_ROLE_TIME_TEST_V1 */');let account='main',release,started=[];const c={id:'r'},x={S:{settings:{}},actId:()=>account,cloudId:()=> 'owner'};vm.runInNewContext(source.slice(start,end),x);
 const first=x.rolePreciseTimeSyncSerialize(c,()=>{started.push('first');return new Promise(r=>release=r)}),second=x.rolePreciseTimeSyncSerialize(c,()=>{started.push('second');return true});await Promise.resolve();await new Promise(r=>setImmediate(r));assert.deepEqual(started,['first']);release(true);assert.equal(await first,true);assert.equal(await second,true);assert.deepEqual(started,['first','second']);
 const third=x.rolePreciseTimeSyncSerialize(c,()=>new Promise(r=>release=r)),fourth=x.rolePreciseTimeSyncSerialize(c,()=>{started.push('wrong-account');return true});await new Promise(r=>setImmediate(r));account='other';release(true);await third;assert.equal(await fourth,false);assert(!started.includes('wrong-account'));
});
