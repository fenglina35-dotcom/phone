import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const starts = [`async function ${name}(`, `function ${name}(`]
    .map(marker => source.indexOf(marker)).filter(index => index >= 0).sort((a, b) => a - b);
  assert.ok(starts.length, `missing ${name}`);
  const start = starts[0], brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('publishing a Moment gives the lover a real like and comment and sends the post body', async () => {
  const role = { id: 'role-a', name: '先生', remark: '先生', relation: '恋人', model: 'main', chatRouteIndex: 2 };
  const post = { id: 'post-1', authorId: 'me', text: '今天终于把小猫接回家了。', images: [], photoCards: [{ desc: '小猫趴在新的软垫上' }], likes: [], comments: [], acct: 'main', time: Date.now() };
  const renders = [];
  const context = vm.createContext({
    S: { me: { name: 'North' }, contacts: [role], messages: {}, moments: [post], couple: { cid: role.id } },
    Date, String, Array, Object, Promise,
    momentVisibleTo: () => true,
    recordVisit: () => {},
    msgs: () => [{ role: 'user', text: '等会儿给你看猫' }],
    msgToText: msg => msg.text || '',
    momentPhotoCards: value => value || [],
    chatAPI: async (messages, options) => { context.request = messages; context.options = options; return '它看起来已经把这里当家了。'; },
    buildSystem: () => 'role-system',
    cleanMomentText: text => String(text || ''),
    cleanReply: text => String(text || '').trim(),
    replyDedupNorm: text => String(text || '').replace(/\s|[，。！？、,.!?]/g, ''),
    replyBigramScore: (a, b) => a === b ? 1 : 0,
    roleChatRouteIndex: c => c.chatRouteIndex,
    uid: () => 'comment-1',
    momentRunRoleExchange: async () => {},
    save: () => { context.saves = (context.saves || 0) + 1; },
    cur: () => ({ p: 'wxmoment' }),
    wxTab: 'chat',
    momentRenderKeepScroll: id => renders.push(id),
  });
  vm.runInContext(functionSource('momentRoleCommentRepeated'), context);
  vm.runInContext(functionSource('momentContactIsLover'), context);
  vm.runInContext(functionSource('momentEnsureRoleLike'), context);
  vm.runInContext(functionSource('momentReactionText'), context);
  vm.runInContext(functionSource('momentRequestRoleReaction'), context);
  vm.runInContext(functionSource('reactToMyMoment'), context);
  await context.reactToMyMoment(post);
  assert.deepEqual(post.likes, ['先生']);
  assert.equal(post.comments.length, 1);
  assert.equal(post.comments[0].text, '它看起来已经把这里当家了。');
  assert.ok(renders.length >= 1, 'the live Moments page must refresh as soon as the role comment is stored');
  assert.equal(context.options.routeIndex, 2);
  assert.match(context.request[1].content, /今天终于把小猫接回家了/);
  assert.match(context.request[1].content, /小猫趴在新的软垫上/);
  assert.match(context.request[1].content, /必须点赞，也必须留下/);
});

test('multi-role Moment reactions keep each real persona output and retry one duplicate once', async () => {
  const roles = [
    { id: 'role-a', name: '先生', remark: '先生', relation: '恋人', persona: '冷静克制', model: 'main', chatRouteIndex: 1 },
    { id: 'role-b', name: '哥哥', remark: '哥哥', persona: '温柔活泼', model: 'main', chatRouteIndex: 3 },
  ];
  const post = { id: 'post-multi', authorId: 'me', text: '先生就是个小气鬼', images: [], photoCards: [], likes: [], comments: [], acct: 'main', time: Date.now() };
  const calls = [];
  const outputs = ['小气鬼现在就在书房坐着，有本事当面说。', '小气鬼现在就在书房坐着，有本事当面说。', '谁欺负你了，哥哥先听你告状。'];
  const context = vm.createContext({
    S: { me: { name: 'North' }, contacts: roles, messages: {}, moments: [post], couple: { cid: 'role-a' } },
    Date, String, Array, Object, Promise, Math, Set,
    momentVisibleTo: () => true,
    recordVisit: () => {},
    msgs: () => [],
    msgToText: msg => msg.text || '',
    momentPhotoCards: value => value || [],
    chatAPI: async (messages, options) => { calls.push({ messages, options }); return outputs[calls.length - 1]; },
    buildSystem: role => `角色=${role.name};人设=${role.persona}`,
    cleanMomentText: text => String(text || ''),
    cleanReply: text => String(text || '').trim(),
    replyDedupNorm: text => String(text || '').replace(/\s|[，。！？、,.!?]/g, ''),
    replyBigramScore: (a, b) => a === b ? 1 : 0,
    roleChatRouteIndex: role => role.chatRouteIndex,
    uid: (() => { let n = 0; return () => `comment-${++n}`; })(),
    momentRunRoleExchange: async () => {},
    save: () => {},
    cur: () => ({ p: 'home' }),
    wxTab: 'chat',
    momentRenderKeepScroll: () => {},
  });
  vm.runInContext(functionSource('momentRoleCommentRepeated'), context);
  vm.runInContext(functionSource('momentContactIsLover'), context);
  vm.runInContext(functionSource('momentEnsureRoleLike'), context);
  vm.runInContext(functionSource('momentReactionText'), context);
  vm.runInContext(functionSource('momentRequestRoleReaction'), context);
  vm.runInContext(functionSource('reactToMyMoment'), context);
  await context.reactToMyMoment(post);
  assert.deepEqual(post.comments.map(comment => comment.text), [
    '小气鬼现在就在书房坐着，有本事当面说。',
    '谁欺负你了，哥哥先听你告状。',
  ]);
  assert.equal(calls.length, 3, 'only the duplicate role gets one bounded genuine-model retry');
  assert.match(calls[0].messages[0].content, /角色=先生;人设=冷静克制/);
  assert.match(calls[1].messages[0].content, /角色=哥哥;人设=温柔活泼/);
  assert.equal(calls[1].options.routeIndex, 3);
  assert.match(calls[1].messages[1].content, /先生：小气鬼现在就在书房坐着/);
  assert.match(calls[1].messages[1].content, /不能复述或模仿这些评论/);
  assert.match(calls[2].messages.at(-1).content, /明显不同的短评/);
});

test('gag bars are red, emoji-free, and lead back to the bound role chat', () => {
  assert.doesNotMatch(source, /🔇 ta把/);
  assert.doesNotMatch(source, /去情侣空间输密码解禁|去情侣空间查看/);
  assert.equal((source.match(/去求他解锁/g) || []).length, 3);
  assert.equal((source.match(/onclick="gagAskUnlock\(\)" style="color:inherit;text-decoration:underline;cursor:pointer">去求他解锁/g) || []).length, 3);
  assert.match(functionSource('gagAskUnlock'), /openChat\(cid\)/);
  assert.match(functionSource('gagAskUnlock'), /当前没有可联系的绑定角色/);
});

test('a role remembers only user Moments visible to that role, including body and described media', () => {
  const role = { id: 'role-a', name: '先生' };
  const context = vm.createContext({
    S: {
      me: { name: 'North' },
      moments: [
        { id: 'public', authorId: 'me', acct: 'main', text: '公开正文', time: 30, images: ['real'], photoCards: [] },
        { id: 'mine', authorId: 'me', acct: 'main', text: '只给先生看的正文', time: 20, visible: ['role-a'], photoCards: [{ desc: '窗边的一束白花' }] },
        { id: 'other', authorId: 'me', acct: 'main', text: '不该让先生看到', time: 10, visible: ['role-b'], photoCards: [] },
      ],
    },
    actId: () => 'main',
    momentVisibleTo: (post, id) => !post.visible?.length || post.visible.includes(id),
    fmtDT: value => `T${value}`,
    cleanMomentText: text => String(text || ''),
    momentPhotoCards: value => (value || []).map(card => ({ desc: card.desc })),
    Math, String, Array,
  });
  vm.runInContext(functionSource('roleVisibleUserMomentsPrompt'), context);
  const prompt = context.roleVisibleUserMomentsPrompt(role, 6);
  assert.match(prompt, /公开正文/);
  assert.match(prompt, /只给先生看的正文/);
  assert.match(prompt, /窗边的一束白花/);
  assert.match(prompt, /真实照片 1 张/);
  assert.doesNotMatch(prompt, /不该让先生看到/);
  assert.match(prompt, /不是评论区回复/);
});

test('all role-speaking routes use the character route without changing cohab route settings', () => {
  assert.match(functionSource('aiReply'), /const _routeIndex=roleChatRouteIndex\(c\),_md=\{roleReplyLanguageGuard:true,routeIndex:_routeIndex/);
  assert.match(functionSource('callAI'), /routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(functionSource('roleMomentGenerate'), /routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(functionSource('wxLoginSession'), /routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(functionSource('wxLoginEnsureRequestedRemark'), /routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(functionSource('cohabRoleChat'), /routeIndex:cohabReplyRouteIndex\(d\)/, 'cohab keeps its existing explicit route control');
  assert.match(functionSource('buildSystem'), /roleVisibleUserMomentsPrompt\(c,6\)/);
  assert.match(functionSource('offlineSystem'), /roleVisibleUserMomentsPrompt\(c,6\)/);
  assert.match(functionSource('cohabSystem'), /roleVisibleUserMomentsPrompt\(c,6\)/);
});


test('composer publish eligibility rejects whitespace, pending uploads and another account; photo-only posts stay valid',()=>{
 const fields={'#mm_t':{value:'  '},'#mm_card_desc':{value:''}};
 const x=vm.createContext({window:{_mmDraft:{account:'main',pending:false},_mmImgs:[]},actId:()=> 'main',$:id=>fields[id]});
 vm.runInContext(functionSource('momentEditorReady'),x);
 assert.equal(x.momentEditorReady(),false);fields['#mm_t'].value='想说的话';assert.equal(x.momentEditorReady(),true);
 fields['#mm_t'].value='';x.window._mmImgs=['photo'];assert.equal(x.momentEditorReady(),true);
 x.window._mmDraft.pending=true;assert.equal(x.momentEditorReady(),false);x.window._mmDraft.pending=false;x.window._mmDraft.account='other';assert.equal(x.momentEditorReady(),false);
});
test('new visibility modes protect private/excluded posts and preserve old public/selective posts',()=>{
 const x=vm.createContext({});vm.runInContext(functionSource('momentVisibleTo'),x);
 assert.equal(x.momentVisibleTo({authorId:'me'},'a'),true);
 assert.equal(x.momentVisibleTo({authorId:'me',visible:['a']},'b'),false);
 assert.equal(x.momentVisibleTo({authorId:'me',visibilityMode:'private'},'a'),false);
 assert.equal(x.momentVisibleTo({authorId:'me',visibilityMode:'include',visible:[]},'a'),false);
 assert.equal(x.momentVisibleTo({authorId:'me',visibilityMode:'exclude',excluded:['a']},'a'),false);
 assert.equal(x.momentVisibleTo({authorId:'me',visibilityMode:'exclude',excluded:['a']},'b'),true);
});
test('photo-only publishing copies images, stores manual location and removes reminders outside visibility',()=>{
 const fields={'#mm_t':{value:''},'#mm_card_desc':{value:''}};
 const imgs=['photo'];const x=vm.createContext({window:{_mmDraft:{account:'main',pending:false,mode:'include',visible:['a'],remind:['a','b'],location:'湖边'},_mmImgs:imgs},S:{me:{},moments:[]},$:id=>fields[id],actId:()=> 'main',uid:()=> 'p',cleanMomentText:t=>t,toast(){throw Error('unexpected reject')},save(){},momentEditorCancel(){x.closed=true},closeModal(){},render(){},reactToMyMoment(p){x.reacted=p}});
 for(const n of ['momentEditorReady','momentVisibleTo','doPostMoment'])vm.runInContext(functionSource(n),x);
 x.doPostMoment();assert.equal(x.S.moments.length,1);const p=x.S.moments[0];assert.equal(p.location,'湖边');assert.deepEqual(Array.from(p.remind),['a']);assert.notEqual(p.images,imgs);assert.equal(x.closed,true);assert.equal(x.reacted,p);assert.deepEqual(Array.from(p.visible),['a']);
});
test('late image conversion cannot attach to a cancelled/replaced draft',async()=>{
 let callback,finish;const d={account:'main',pending:false};const x=vm.createContext({window:{_mmDraft:d,_mmImgs:[]},actId:()=> 'main',pickFile:(type,fn)=>{callback=fn},compress:()=>new Promise(r=>finish=r),momentEditorUpdate(){},momentEditorMedia(){x.media=true},toast(){},$:()=>({})});
 vm.runInContext(functionSource('addMomentImg'),x);x.addMomentImg();const job=callback({});assert.equal(d.pending,true);x.window._mmDraft={account:'main',pending:false};finish('late-photo');await job;assert.equal(x.window._mmImgs.length,0);assert.equal(x.media,undefined);
});


test('friend selector search preserves checked friends hidden by filtering and close discards unconfirmed changes',()=>{
 const fields={'#mm_visibility_mode':{value:'public'},'#mmPeoplePage':{remove(){x.removed=true}}};
 const x=vm.createContext({window:{_mmDraft:{account:'main',mode:'public',remind:[],visible:[],people:{kind:'visible',ids:['a'],mode:'public'}}},S:{contacts:[{id:'a',name:'Alice',wxid:'aaa'},{id:'b',name:'Bob',wxid:'bbb'},{id:'gone',name:'Deleted',deleted:true},{id:'blocked',name:'Blocked',blocked:true}]},actId:()=> 'main',$:id=>fields[id],wxContactInitial:n=>n[0].toUpperCase(),momentEditorPeopleCount(){}});
 for(const n of ['momentEditorPeopleRows','momentEditorPersonToggle','momentEditorPeopleClose'])vm.runInContext(functionSource(n),x);
 assert.deepEqual(Array.from(x.momentEditorPeopleRows('bbb'),c=>c.id),['b']);assert.deepEqual(Array.from(x.window._mmDraft.people.ids),['a']);
 x.momentEditorPersonToggle({checked:true,getAttribute:()=> 'b'});assert.deepEqual(Array.from(x.window._mmDraft.people.ids),['a','b']);assert.equal(fields['#mm_visibility_mode'].value,'include');assert.deepEqual(Array.from(x.window._mmDraft.visible),[]);
 x.momentEditorPeopleClose();assert.equal(x.window._mmDraft.people,undefined);assert.deepEqual(Array.from(x.window._mmDraft.visible),[]);assert.equal(x.removed,true);
});
test('bottom Select commits both filtered-out and visible choices while dropping deleted contacts',()=>{
 const x=vm.createContext({window:{_mmDraft:{account:'main',mode:'public',remind:[],visible:[],people:{kind:'remind',ids:['a','b','gone'],mode:'public'}}},S:{contacts:[{id:'a',name:'Alice'},{id:'b',name:'Bob'},{id:'gone',name:'Deleted',deleted:true}]},actId:()=> 'main',wxContactInitial:n=>n[0].toUpperCase(),momentEditorPeopleClose(){delete x.window._mmDraft.people},momentEditorUpdate(){},toast(){throw Error('unexpected')},Set});
 for(const n of ['momentEditorPeopleRows','momentEditorPeopleSave'])vm.runInContext(functionSource(n),x);
 x.momentEditorPeopleSave('remind');assert.deepEqual(Array.from(x.window._mmDraft.remind),['a','b']);assert.equal(x.window._mmDraft.mode,'public');
 x.window._mmDraft.people={kind:'visible',mode:'exclude',ids:['b']};x.momentEditorPeopleSave('visible');assert.equal(x.window._mmDraft.mode,'exclude');assert.deepEqual(Array.from(x.window._mmDraft.visible),['b']);
});

test('mentioned roles receive the explicit reminder once, including friends beyond the usual reaction limit',async()=>{
 const roles=Array.from({length:7},(_,i)=>({id:'r'+i,name:'Role'+i}));roles[0].relation='恋人';roles[5].blocked=true;roles[6].deleted=true;
 const post={id:'mention',authorId:'me',text:'周末见',remind:['r0','r4','r4','r5','r6'],images:[],comments:[],likes:[],visibilityMode:'exclude',excluded:['r2']};
 const calls=[];
 const x=vm.createContext({S:{me:{name:'North'},contacts:roles,couple:{}},Date,Math,recordVisit(){},msgs:()=>[],msgToText:m=>m.text,momentPhotoCards:()=>[],buildSystem:c=>c.id,roleChatRouteIndex:()=>0,cleanMomentText:t=>t,cleanReply:t=>t,replyDedupNorm:t=>t,replyBigramScore:()=>0,chatAPI:async req=>{calls.push(req);return '忽略'},save(){},cur:()=>({p:'home'}),momentRunRoleExchange:async()=>{},uid:()=> 'comment'});
 for(const n of ['momentVisibleTo','momentContactIsLover','momentEnsureRoleLike','momentRoleCommentRepeated','momentReactionText','momentRequestRoleReaction','reactToMyMoment'])vm.runInContext(functionSource(n),x);
 await x.reactToMyMoment(post);
 const ids=calls.map(r=>r[0].content);assert.deepEqual(ids,['r0','r4','r1']);
 for(const id of ['r0','r4'])assert.match(calls.find(r=>r[0].content===id)[1].content,/特意使用了“提醒谁看”提醒你/);
 assert.doesNotMatch(calls.find(r=>r[0].content==='r1')[1].content,/特意使用了/);
 assert.equal(ids.filter(id=>id==='r0').length,1);
});
