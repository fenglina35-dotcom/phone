import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1370 关系网：人物卡 + 关系（双向称谓、两边好感、矛盾、来历、过往、锁）。两边都知道彼此是谁；
// 角色推荐关系网里的人给我、我加了以后转正成联系人，关系跟过去；我推荐名片给角色，角色自己定关系（待确认）；
// 角色用 [关系|名字|±n|原因] 调好感（有上限、有记录、锁了不变）；剧场来客关系没填时按关系网来。
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const theater = fs.readFileSync(new URL('../cohab-theater.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const me = fs.readFileSync(new URL('../wechat-me.js', import.meta.url), 'utf8');
const grab = (src, name) => {
  const i = src.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert.ok(i >= 0, 'missing ' + name);
  let depth = 0, quote = '', esc = false;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    const ch = src[k];
    if (quote) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === quote) quote = ''; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++; else if (ch === '}' && !--depth) return src.slice(i, k + 1);
  }
};
const line = p => app.split('\n').find(l => l.startsWith(p)) || '';
const CORE = ['relInit', 'relStatus', 'relRecommendable', 'relTitleTaken', 'relNameTaken', 'relDayHit', 'relDayNote', 'relLoginTag', 'relPerson', 'relKeyLive', 'relExists', 'relName', 'relPromptName', 'relLabel', 'relRealName', 'relBrief', 'relFeelText', 'relLinkOf', 'relView', 'relLinksOf', 'relCleanLink', 'relNewLink', 'relPromote', 'relPromptFor', 'relAmongText', 'relFindByName', 'relAdjust', 'relConsumeTags'];
const load = () => {
  const contacts = [{ id: 'c1', name: '克劳德', remark: '先生', gender: '男' }, { id: 'c2', name: '小助手' }];
  const ctx = { S: { me: { name: 'North' }, contacts }, getC: id => contacts.find(c => c.id === id) || null, uid: (() => { let n = 0; return () => 'u' + (++n); })(), save: () => {}, Date, Math, JSON, Object, Array, String, Number, Set };
  vm.runInNewContext([line('const REL_FEEL_STEP='), line('const REL_STATUS='), line('const REL_MULTI_RE='), ...CORE.map(n => grab(app, n)), 'globalThis.api={' + CORE.join(',') + '};'].join('\n'), ctx);
  return ctx;
};

test('both sides know who the other is, with their own titles and feelings', () => {
  const { api, S } = load();
  api.relInit().people.push({ id: 'np_mom', name: '沈清秋', age: '52', gender: '女', identity: '退休教师', persona: '嘴硬心软' });
  api.relNewLink('c1', 'np_mom', { ab: '妈妈', ba: '儿子', fa: 70, fb: 85, how: '亲生母亲', story: [{ t: '高中', text: '偷偷买了画板' }] });
  const quiet = api.relPromptFor(S.contacts[0], '今天天气不错');
  assert.match(quiet, /你的家人朋友：妈妈沈清秋。/, 'the short roster is always there');
  assert.doesNotMatch(quiet, /· 沈清秋/, 'details only when relevant');
  const his = api.relPromptFor(S.contacts[0], '你妈最近还好吗');
  assert.match(his, /· 沈清秋（52岁，女，退休教师）：是你的妈妈；你是ta的儿子。你对ta 70\/100（亲近），ta对你 85\/100（非常亲）/);
  assert.match(his, /过往：高中：偷偷买了画板/);
  assert.match(his, /ta不在North的微信里/);
  assert.match(his, /你可以把这些人的微信名片推荐给North：沈清秋。想推荐时单独一行写 \[推荐好友\|名字\|一句介绍\]/, 'he can recommend people from his network');
  assert.match(his, /平时不用主动提他们/);
  S.contacts.push({ id: 'c3', name: '沈清秋' });
  api.relPromote('np_mom', 'c3', 'c1');
  const mom = api.relPromptFor(S.contacts[2], '我儿子');
  assert.match(mom, /· 克劳德（男）：是你的儿子；你是ta的妈妈。你对ta 85\/100[^]*ta现在在North的微信通讯录里（备注「先生」）/, 'the promoted contact knows she is his mom');
  assert.equal(api.relLoginTag('c1', 'c3'), '｜这是你的妈妈（你推荐给North的）', 'when he logs into my WeChat he recognises her');
  assert.match(api.relPromptFor(S.contacts[0], '沈清秋'), /ta现在在North的微信通讯录里（备注「沈清秋」），是你把ta的名片推荐给North的——在North手机里看到ta，就是这个人，不是North的亲戚或陌生人/);
});

test('v1372: roles see real names, my remark is only a note; pages show remark plus real name', () => {
  const { api, S } = load();
  S.contacts.push({ id: 'c4', name: '陆沉', remark: '哥哥' });
  api.relNewLink('c1', 'c4', { ab: '死对头', ba: '情敌', fa: 20, fb: 15 });
  const p = api.relPromptFor(S.contacts[0], '陆沉最近怎么样');
  assert.match(p, /你的家人朋友：死对头陆沉。/);
  assert.match(p, /· 陆沉：是你的死对头；你是ta的情敌。[^]*（备注「哥哥」）/, 'the remark is said to be only my remark');
  assert.doesNotMatch(p, /死对头哥哥|· 哥哥/, 'my remark is never used as his name');
  assert.match(api.relPromptFor(S.contacts[2], ''), /你的家人朋友：情敌克劳德。/);
  assert.equal(api.relAmongText(['c1', 'c4']).split('：')[0], '克劳德 和 陆沉');
  assert.equal(api.relLabel('c4'), '哥哥（陆沉）');
  assert.equal(api.relLabel('c2'), '小助手');
  assert.equal(api.relFindByName(S.contacts[0], '哥哥').other, 'c4', 'tags written with my remark still find him');
  assert.equal(api.relFindByName(S.contacts[0], '陆沉').other, 'c4');
  assert.match(app, /list\.push\(\{k:c\.id,name:relLabel\(c\.id\),kind:'微信里的人'\}\)/);
});

test('details: at most the chosen number, present and pinned people and birthdays count; the gone cannot be recommended', () => {
  const { api, S } = load();
  const r = api.relInit();
  r.people.push({ id: 'np_dad', name: '沈国华', status: '已故', statusNote: '2018年因病去世', memorial: '' }, { id: 'np_baby', name: '沈朵朵', status: '没有微信', statusNote: '刚出生' }, { id: 'np_aunt', name: '沈红', birthday: (d => (d.getMonth() + 1) + '-' + d.getDate())(new Date()) });
  api.relNewLink('c1', 'np_dad', { ab: '爸爸', ba: '儿子', pinned: true });
  api.relNewLink('c1', 'np_baby', { ab: '小妹妹', ba: '哥哥' });
  api.relNewLink('c1', 'np_aunt', { ab: '姑姑', ba: '侄子' });
  const p = api.relPromptFor(S.contacts[0], '', { present: [] });
  assert.match(p, /· 沈国华[^\n]*ta已经去世了（2018年因病去世）/, 'pinned people always get details');
  assert.match(p, /· 沈红[^\n]*【今天是ta的生日，你记得，可以自然提一句】/);
  assert.doesNotMatch(p, /· 沈朵朵/);
  assert.match(p, /推荐给North：沈红。/, 'only people who can be reached are offered: the dead and those without WeChat are not');
  assert.match(p, /爸爸沈国华（已故）/);
  r.detailCap = 1;
  assert.equal((api.relPromptFor(S.contacts[0], '', {}).match(/\n· /g) || []).length, 1, 'cap respected');
  assert.equal(api.relRecommendable(r.people[0]), false);
});

test('one title per person (friends and colleagues may repeat) and names never repeat', () => {
  const { api, S } = load();
  api.relInit().people.push({ id: 'np_a', name: '沈小雨' }, { id: 'np_b', name: '阿杰' });
  api.relNewLink('c1', 'np_a', { ab: '亲妹妹', ba: '哥哥' });
  api.relNewLink('c1', 'np_b', { ab: '好朋友', ba: '好朋友' });
  assert.ok(api.relTitleTaken('c1', '亲妹妹', 'other'), 'a second 亲妹妹 is refused');
  assert.equal(api.relTitleTaken('c1', '好朋友', 'other'), null, 'friends may repeat');
  assert.match(api.relNameTaken('沈小雨', ''), /已经有一个叫「沈小雨」的人物卡/);
  assert.match(api.relNameTaken('先生', ''), /微信里已经有「先生」了/);
  assert.match(api.relNameTaken('North', ''), /你自己的名字/);
  assert.equal(api.relNameTaken('沈小雨', 'np_a'), '', 'saving the same card again is fine');
});

test('a deleted promoted contact turns back into a person card with its relations', () => {
  const { api, S } = load();
  api.relInit().people.push({ id: 'np_mom', name: '沈清秋' });
  api.relNewLink('c1', 'np_mom', { ab: '妈妈', ba: '儿子' });
  S.contacts.push({ id: 'c3', name: '沈清秋' });
  api.relPromote('np_mom', 'c3', 'c1');
  assert.equal(api.relLinksOf('c1')[0].other, 'c3');
  S.contacts[2].deleted = true;
  assert.equal(api.relLinksOf('c1')[0].other, 'np_mom');
  assert.equal(api.relPerson('np_mom').cid, '');
});

test('roles adjust feelings with a hidden tag, capped per step and per day, never when locked', () => {
  const { api, S } = load();
  api.relInit().people.push({ id: 'np_sis', name: '沈小雨' });
  const l = api.relNewLink('c1', 'np_sis', { ab: '亲妹妹', ba: '哥哥', fa: 35, fb: 80 });
  assert.equal(api.relConsumeTags('嗯\n[关系|沈小雨|+8|她道歉了]\n好', S.contacts[0]), '嗯\n\n好'.replace('\n\n', '\n\n'));
  assert.equal(l.fa, 43);
  api.relConsumeTags('[关系|沈小雨|+50|太感动]', S.contacts[0]);
  assert.equal(l.fa, 53, 'one step is at most ±10');
  api.relConsumeTags('[关系|沈小雨|+10|又一次]', S.contacts[0]);
  assert.equal(l.fa, 55, 'one side moves at most 20 a day');
  assert.equal(l.fb, 80, 'only his own side changes');
  assert.equal(Array.from(l.log, x => x.why).join(','), '她道歉了,太感动,又一次');
  l.locked = true;
  api.relConsumeTags('[关系|沈小雨|-5|吵架]', S.contacts[0]);
  assert.equal(l.fa, 55, 'locked relations do not move');
});

test('relations among the people present are spelled out for groups and the theater', () => {
  const { api } = load();
  api.relNewLink('c1', 'c2', { ab: '助理', ba: '老板', fa: 55, fb: 60 });
  assert.match(api.relAmongText(['c1', 'c2']), /克劳德 和 小助手：小助手是克劳德的助理，克劳德是小助手的老板；好感 55 \/ 60/);
  assert.match(grab(app, 'gContext'), /const net=typeof relAmongText==='function'\?relAmongText\(g\.members\):''/);
  assert.match(theater, /\(g\.relationToHost\|\|theaterRelTitle\(g,c\)\|\|'未特别设置'\)/, 'theater falls back to the network when the guest relation is blank');
  assert.match(theater, /\(entry\.relationToHost\|\|\(isGuest&&theaterRelTitle\(entry,host\)\)\|\|'未特别设置'\)/);
  assert.match(theater, /isGuest&&actor&&typeof relPromptFor==='function'\?relPromptFor\(actor,typeof current==='string'\?current:/);
  assert.match(theater, /relAfterScene\(id,rows,'多人剧场'\);relAfterScene\(g\.contactId,rows,'多人剧场'\)/);
});

test('wired everywhere: prompts, tags, cards, his friend list, offline end, pages', () => {
  assert.match(grab(app, 'buildSystem'), /if\(typeof relPromptFor==='function'\)s\+=relPromptFor\(c,opt&&opt\.query\);/);
  assert.match(app, /content=applyGroupUnmuteTag\(content,c\);if\(typeof relConsumeTags==='function'\)content=relConsumeTags\(content,c\);/);
  assert.equal((app.match(/if\(typeof relConsumeTags==='function'\)r=relConsumeTags\(r,c\);let replyMeta=\{\}/g) || []).length, 2, 'offline and common life');
  assert.match(grab(app, 'groupRoleReplyItems'), /if\(typeof relConsumeTags==='function'\)content=relConsumeTags\(content,c\);/);
  assert.match(app, /nc\.personId=rp\.id;nc\.cname=rp\.name;/);
  assert.match(grab(app, 'addHisCard'), /if\(rp&&!rp\.cid\)relPromote\(rp\.id,nc\.id,oc&&oc\.id\);/);
  assert.match(app, /if\(card\.refId&&getC\(card\.refId\)\)relAutoLink\(id,card\.refId,/);
  assert.match(grab(app, 'hisSeed'), /if\(typeof relHisFriends==='function'&&relHisFriends\(cid,d\)\)ch=true;/);
  assert.match(grab(app, 'offEnd'), /relAfterScene\(id,endedMsgs,'线下约会'\)/);
  assert.match(grab(app, 'renderFriendInfo'), /<div class="wx-info-label">人际关系<\/div><div class="wx-info-group"><button onclick="relOpen\('\$\{id\}'\)"><span>TA的人际关系<\/span>/);
  assert.doesNotMatch(grab(app, 'renderContactInfo'), /relOpen/);
  assert.match(grab(app, 'wxLoginWechatSummary'), /relLoginTag\(cid,x\.id\)/);
  assert.match(grab(app, 'offlineSystem'), /s\+=relPromptFor\(c,/);
  assert.match(grab(app, 'cohabSystem'), /s\+=relPromptFor\(c,/);
  assert.match(app, /if\(rp&&!relRecommendable\(rp\)&&!rp\.cid\)\{_replyAuditPartial=true;continue;\}/);
  assert.match(grab(app, 'relHisFriends'), /x\.name===title\|\|x\.name===title\.replace\(\/\^亲\/,''\)/, 'the default 妈妈 friend is replaced, not duplicated');
  assert.match(grab(app, 'relHisFriends'), /if\(x!==f&&!x\.relKey&&f\.alias\.includes\(x\.name\)\)/, 'a 妈妈 chat synced from his phone later merges into her');
  assert.match(grab(app, 'hisSeed'), /Array\.isArray\(x\.alias\)&&x\.alias\.includes\(w\.who\)/);
  assert.match(me, /wxMeHomeRow\('relnet','关系网',"relOpen\(''\)"\)/);
  assert.match(html, /\.relnet-row\{/);
  for (const p of ["c.p==='relnet')html=renderRelNet(c)", "c.p==='reledit')html=renderRelEdit()", "c.p==='relperson')html=renderRelPerson(c)"]) assert.ok(app.includes(p), p);
  assert.match(app, /\|关系';/);
  assert.match(grab(app, 'relInit'), /if\(r\.autoLink!==false\)r\.autoLink=true;/, 'auto relation on by default');
});
