import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const webApp = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const privateApp = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',
    import.meta.url,
  ),
  'utf8',
);
const webHTML = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const privateHTML = fs.readFileSync(
  new URL(
    '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    import.meta.url,
  ),
  'utf8',
);

const appCopies = [
  ['web', webApp],
  ['private bundle', privateApp],
];

function functionSource(source, name) {
  const marker = `function ${name}(`;
  const markerAt = source.indexOf(marker);
  assert.notEqual(markerAt, -1, `missing function ${name}`);
  const asyncAt = source.lastIndexOf('async ', markerAt);
  const start = asyncAt >= 0 && asyncAt + 'async '.length === markerAt
    ? asyncAt
    : markerAt;
  const open = source.indexOf('{', markerAt + marker.length);
  assert.notEqual(open, -1, `missing body for ${name}`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated function ${name}`);
}

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

test('studio exposes a compact, in-place time save control in both entry copies', () => {
  for (const [name, source] of appCopies) {
    const modal = functionSource(source, 'roleImageStudioOutfitModal');
    const saveTime = functionSource(source, 'roleImageStudioOutfitTimeSave');

    assert.match(modal, /role-image-time-(?:field|card|panel)/, `${name}: time controls have a scoped compact container`);
    assert.match(modal, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/, `${name}: time inputs use two shrinkable tracks`);
    assert.match(modal, /id="rio_time_start"[^>]*min-width:0/, `${name}: start input cannot force horizontal overflow`);
    assert.match(modal, /id="rio_time_end"[^>]*min-width:0/, `${name}: end input cannot force horizontal overflow`);
    assert.match(modal, /onclick="roleImageStudioOutfitTimeSave\('\$\{id\}'\)"[^>]*>[^<]*(?:单独保存|保存时间)/, `${name}: time module has its own save button`);
    assert.ok(
      modal.indexOf('id="rio_time_end"') < modal.indexOf('roleImageStudioOutfitTimeSave'),
      `${name}: save-time button sits beside the time controls`,
    );
    assert.ok(
      modal.indexOf('roleImageStudioOutfitTimeSave') < modal.indexOf('id="rio_note"'),
      `${name}: save-time button is reachable before the long description field`,
    );
    assert.doesNotMatch(
      modal,
      /grid-template-columns:1fr auto 1fr/,
      `${name}: the old overflowing three-track time row is gone`,
    );
    assert.match(saveTime, /roleImageStudioOutfitReadTimeRange\(\)/);
    assert.match(saveTime, /timeStart/);
    assert.match(saveTime, /timeEnd/);
    assert.match(saveTime, /save(?:NowAsync)?\(/, `${name}: saving time reaches persistent storage`);
  }

  for (const [name, source] of [['web', webHTML], ['private shell', privateHTML]]) {
    assert.match(source, /\.sheet\{[^}]*max-height:[^;}]+[^}]*overflow-y:auto/s, `${name}: the surrounding sheet remains vertically scrollable on short screens`);
  }
});

test('independent wardrobe time save mutates only the selected row and validates before saving', async () => {
  const fn = [
    functionSource(webApp, 'roleImageStudioOutfitTimeError'),
    functionSource(webApp, 'roleImageStudioOutfitTimeSave'),
  ].join('\n');
  const row = {
    id: 'coat',
    name: '深色长风衣',
    occasion: 'daily',
    image: 'coat-ref',
    note: '原说明',
    enabled: false,
    timeStart: '07:00',
    timeEnd: '09:00',
  };
  const contact = { id: 'c1' };
  const studio = { outfits: [row] };
  let timing = { enabled: true, start: '22:00', end: '02:00' };
  let saveCount = 0;
  let persistOk = true;
  let toastText = '';
  const sandbox = {
    getC: () => contact,
    roleImageStudio: () => studio,
    roleImageStudioCapture: () => studio,
    roleImageStudioOutfitReadTimeRange: () => timing,
    roleImageTimeMinutes: value => {
      const m = String(value || '').match(/^(\d{2}):(\d{2})$/);
      if (!m) return -1;
      const h = Number(m[1]);
      const n = Number(m[2]);
      return h < 24 && n < 60 ? h * 60 + n : -1;
    },
    save: () => { saveCount += 1; return true; },
    saveNowAsync: async () => { saveCount += 1; return persistOk; },
    render: () => {},
    toast: text => { toastText = String(text); },
  };
  vm.runInNewContext(
    `let _roleImageOutfitDraft=null;${fn};globalThis.api={saveTime:roleImageStudioOutfitTimeSave,setDraft:v=>{_roleImageOutfitDraft=v}};`,
    sandbox,
  );
  const draft = { ...row, roleId: 'c1', edit: true };
  sandbox.api.setDraft(draft);

  await sandbox.api.saveTime('c1');
  assert.deepEqual(json(row), {
    id: 'coat',
    name: '深色长风衣',
    occasion: 'daily',
    image: 'coat-ref',
    note: '原说明',
    enabled: false,
    timeStart: '22:00',
    timeEnd: '02:00',
  });
  assert.equal(draft.timeStart, '22:00');
  assert.equal(draft.timeEnd, '02:00');
  assert.equal(saveCount, 1);
  assert.match(toastText, /时间(?:段)?.*保存|保存.*时间/);

  timing = { enabled: true, start: '12:00', end: '12:00' };
  toastText = '';
  await sandbox.api.saveTime('c1');
  assert.equal(row.timeStart, '22:00', 'equal endpoints must not overwrite the last valid value');
  assert.equal(row.timeEnd, '02:00');
  assert.equal(saveCount, 1, 'invalid time ranges must not be persisted');
  assert.match(toastText, /两个不同|不能相同/);

  persistOk = false;
  timing = { enabled: true, start: '18:00', end: '20:00' };
  toastText = '';
  await sandbox.api.saveTime('c1');
  assert.equal(row.timeStart, '22:00', 'a failed local write rolls the stored row back');
  assert.equal(row.timeEnd, '02:00');
  assert.equal(saveCount, 2);
  assert.match(toastText, /没有写入|保存失败|重试/);

  persistOk = true;
  timing = { enabled: false, start: '10:00', end: '11:00' };
  await sandbox.api.saveTime('c1');
  assert.equal(row.timeStart, '', 'turning fixed time off clears only the range');
  assert.equal(row.timeEnd, '');
  assert.equal(row.name, '深色长风衣');
  assert.equal(row.note, '原说明');
  assert.equal(row.enabled, false, 'wardrobe participation is independent from fixed-time mode');
});

test('full wardrobe save waits for persistence and rolls an existing outfit back on failure', async () => {
  const fn = functionSource(webApp, 'roleImageStudioOutfitSave');
  const row = {
    id: 'coat',
    name: '原名字',
    occasion: 'daily',
    note: '原说明',
    timeStart: '07:00',
    timeEnd: '09:00',
  };
  const studio = { outfits: [row] };
  const inputs = {
    rio_name: { value: '新名字' },
    rio_occasion: { value: 'work' },
    rio_note: { value: '新说明' },
  };
  let persistOk = false;
  let closeCount = 0;
  let renderCount = 0;
  let toastText = '';
  const sandbox = {
    getC: id => (id === 'c1' ? { id: 'c1' } : null),
    roleImageStudio: () => studio,
    roleImageStudioOutfitReadTimeRange: () => ({ enabled: true, start: '22:00', end: '02:00' }),
    roleImageStudioOutfitTimeError: () => '',
    $: selector => inputs[String(selector).replace(/^#/, '')] || null,
    saveNowAsync: async () => persistOk,
    closeModal: () => { closeCount += 1; },
    render: () => { renderCount += 1; },
    toast: text => { toastText = String(text); },
  };
  vm.runInNewContext(
    `let _roleImageOutfitDraft=null;${fn};globalThis.api={save:roleImageStudioOutfitSave,setDraft:v=>{_roleImageOutfitDraft=v}};`,
    sandbox,
  );
  const draft = { id: 'coat', roleId: 'c1', edit: true };
  sandbox.api.setDraft(draft);

  await sandbox.api.save('c1');
  assert.deepEqual(json(row), {
    id: 'coat',
    name: '原名字',
    occasion: 'daily',
    note: '原说明',
    timeStart: '07:00',
    timeEnd: '09:00',
  }, 'a failed full save restores every edited field');
  assert.equal(closeCount, 0, 'failed persistence keeps the editor open');
  assert.equal(renderCount, 0, 'failed persistence does not render a fake success state');
  assert.match(toastText, /没有写入|重试/);

  persistOk = true;
  await sandbox.api.save('c1');
  assert.equal(row.name, '新名字');
  assert.equal(row.occasion, 'work');
  assert.equal(row.note, '新说明');
  assert.equal(row.timeStart, '22:00');
  assert.equal(row.timeEnd, '02:00');
  assert.equal(closeCount, 1);
  assert.equal(renderCount, 1);
  assert.match(toastText, /已保存/);
});

test('replying as me writes self authorship and an explicit target link', () => {
  const fn = functionSource(webApp, 'doXReply');
  const tweet = {
    id: 't1',
    comments: [{ id: 'n1', authorType: 'net', name: '网友A', text: '原评论' }],
  };
  const sandbox = {
    S: { me: { name: '用户甲', avatar: 'me-avatar' } },
    $: () => ({ value: '谢谢提醒' }),
    tw: id => (id === 't1' ? tweet : null),
    uid: () => 'my-reply',
    getC: () => null,
    save: () => {},
    closeModal: () => {},
    render: () => {},
    xCommentReply: () => assert.fail('a netizen reply must not trigger the legacy role-private reply route'),
  };
  vm.runInNewContext(`${fn};globalThis.reply=doXReply;`, sandbox);

  sandbox.reply('t1', 0);
  assert.equal(tweet.comments.length, 2);
  assert.deepEqual(json(tweet.comments[1]), {
    id: 'my-reply',
    name: '用户甲',
    avatar: 'me-avatar',
    authorType: 'me',
    text: '回复 网友A：谢谢提醒',
    replyToId: 'n1',
    replyToName: '网友A',
  });
});

test('X comment action distinguishes me from role and stores reply authorship metadata', () => {
  for (const [name, source] of appCopies) {
    const menu = functionSource(source, 'xReplyComment');
    const asMe = functionSource(source, 'xReplyCommentAsMe');
    const meSave = functionSource(source, 'doXReply');
    const roleReply = functionSource(source, 'xRoleReplyToNetizen');

    assert.match(menu, />\s*我(?:来)?回复\s*</, `${name}: comment menu offers a user reply`);
    assert.match(menu, />\s*让角色回复\s*</, `${name}: comment menu offers a role reply`);
    assert.match(menu, /xCommentAuthorType\(cm\)/, `${name}: role reply is gated by real commenter type`);
    assert.match(menu, /===?['"]net['"]/, `${name}: only ordinary netizen comments expose role reply`);
    assert.match(asMe, /回复/);
    assert.match(meSave, /authorType:['"]me['"]/);
    assert.match(meSave, /replyToId/);
    assert.match(meSave, /replyToName/);
    assert.match(roleReply, /authorType:['"]role['"]/);
    assert.match(roleReply, /replyToId/);
    assert.match(roleReply, /replyToName/);
  }
});

test('legacy and new X comments resolve to stable author types', () => {
  const fn = functionSource(webApp, 'xCommentAuthorType');
  const contacts = [{ id: 'c1', name: '角色一' }];
  const sandbox = {
    S: { me: { name: '用户甲', avatar: 'me-avatar' }, contacts },
    getC: id => contacts.find(c => c.id === id) || null,
  };
  vm.runInNewContext(`${fn};globalThis.classify=xCommentAuthorType;`, sandbox);

  assert.equal(sandbox.classify({ id: 'n', authorType: 'net', name: '路人' }), 'net');
  assert.equal(sandbox.classify({ id: 'm', authorType: 'me', name: '随便改名' }), 'me');
  assert.equal(sandbox.classify({ id: 'r', authorType: 'role', cid: 'c1' }), 'role');
  assert.equal(sandbox.classify({ cid: 'c1', name: '旧角色评论' }), 'role', 'legacy cid comments still belong to a role');
  assert.equal(sandbox.classify({ name: '用户甲' }), 'me', 'legacy self-name comments still belong to me');
  assert.equal(sandbox.classify({ name: '改名前的本人', avatar: 'me-avatar' }), 'me', 'legacy self comments survive a later user rename when their avatar still matches');
  assert.equal(sandbox.classify({ name: '陌生网友' }), 'net', 'unknown legacy comments are netizens, never silently treated as me');
  assert.equal(sandbox.classify({ authorType: 'role', cid: 'deleted-role' }), 'role', 'explicit new-format authorship is stable even if a contact was later deleted');
  assert.equal(sandbox.classify({ cid: 'deleted-role', name: '旧孤儿评论' }), 'net', 'an orphan legacy cid alone is not enough to infer a role');
});

test('role X reply prompt treats the target as a public stranger and keeps private context out', () => {
  for (const [name, source] of appCopies) {
    const publicProfileSource = functionSource(source, 'xRolePublicProfile');
    const publicNameSource = functionSource(source, 'xRolePublicName');
    const publicVoiceSource = functionSource(source, 'xRolePublicVoice');
    const promptSource = functionSource(source, 'xRoleNetizenReplyPrompt');
    assert.match(promptSource, /X (?:账号|公开)|公开的 X/, `${name}: prompt identifies X`);
    assert.match(promptSource, /公开评论区/, `${name}: prompt identifies a public comment area`);
    assert.match(promptSource, /普通网友|陌生网友/);
    assert.match(promptSource, /不是(?:当前小手机用户|手机主人)/);
    assert.match(promptSource, /不是微信私聊/);
    assert.match(promptSource, /距离|分寸/);
    assert.match(promptSource, /亲[密昵]称呼/);
    assert.match(promptSource, /共同记忆|共同经历/);
    assert.match(promptSource, /不得泄露|不能泄露/);
    assert.doesNotMatch(promptSource, /buildSystem\s*\(/, `${name}: public stranger replies do not inherit the private-chat system prompt`);
    assert.doesNotMatch(promptSource, /msgs\s*\(/, `${name}: public stranger replies do not read private chat bubbles`);
    assert.doesNotMatch(promptSource, /netCommentTone/, `${name}: per-role reply style is separate from my global netizen-generation tone`);
    assert.doesNotMatch(promptSource, /c\.persona/, `${name}: the public model prompt never receives the raw private persona`);
    assert.doesNotMatch(publicNameSource, /c\.remark/, `${name}: a private contact remark can never become the public X account name`);
    assert.match(publicProfileSource, /cid===c\.id/, `${name}: the role resolves its own public X profile by stable contact id`);
    assert.match(publicVoiceSource, /这里只保留公开表达底色|不带入私人关系/, `${name}: private persona is reduced to a bounded public voice locally`);
  }

  const publicProfile = functionSource(webApp, 'xRolePublicProfile');
  const publicName = functionSource(webApp, 'xRolePublicName');
  const publicVoice = functionSource(webApp, 'xRolePublicVoice');
  const fn = functionSource(webApp, 'xRoleNetizenReplyPrompt');
  const sandbox = {
    S: { me: { name: '用户甲' }, x: { users: { publicRole: { cid: 'c1', name: '公开账号名', bio: '公开简介' } } } },
    xRoleNetizenReplyStyle: c => String(c.xNetizenReplyStyle || '').trim() || '礼貌、克制、有距离感',
  };
  vm.runInNewContext(`${publicProfile};${publicName};${publicVoice};${fn};globalThis.makePrompt=xRoleNetizenReplyPrompt;`, sandbox);
  const p1 = JSON.stringify(sandbox.makePrompt(
    { id: 't1', text: '今天下雨了' },
    { id: 'c1', name: '角色一', remark: '我的私人备注名', persona: '寡言；用户生日是九月九日，私下叫她小猫', xNetizenReplyStyle: '简短礼貌，不与粉丝暧昧' },
    { id: 'n1', name: '网友A', text: '你也没带伞吗' },
  ));
  const p2 = JSON.stringify(sandbox.makePrompt(
    { id: 't2', text: '今天很忙' },
    { id: 'c2', name: '角色二', persona: '温和', xNetizenReplyStyle: '温和但不透露私事' },
    { id: 'n2', name: '网友B', text: '休息一下吧' },
  ));
  assert.match(p1, /简短礼貌，不与粉丝暧昧/);
  assert.match(p1, /寡言克制/);
  assert.match(p1, /公开账号名/);
  assert.doesNotMatch(p1, /九月九日|小猫|我的私人备注名/, 'private persona facts, pet names, and contact remarks never enter the public request');
  assert.doesNotMatch(p1, /温和但不透露私事/);
  assert.match(p2, /温和但不透露私事/);
  assert.doesNotMatch(p2, /简短礼貌，不与粉丝暧昧/);
});

test('role X profiles own independent netizen-reply styles', () => {
  for (const [name, source] of appCopies) {
    const profile = functionSource(source, 'renderXUser');
    const editor = functionSource(source, 'editUserProfile');
    const profileSave = functionSource(source, 'saveUserProfile');
    const style = functionSource(source, 'xRoleNetizenReplyStyle');
    const reply = functionSource(source, 'xRoleReplyToNetizen');

    assert.match(profile, /editUserProfile/, `${name}: X profile exposes its profile editor`);
    assert.match(editor, /c=u\.cid&&getC\(u\.cid\)/, `${name}: editor resolves an independently bound role`);
    assert.match(profile + editor, /回复网友的风格/);
    assert.match(editor + profileSave, /xNetizenReplyStyle/);
    assert.match(style, /礼貌[^'"`\n]{0,12}克制/);
    assert.match(style, /距离|分寸/);
    assert.match(editor, /只用于[^\n]{0,80}在 X 公开回复(?:普通)?网友/);
    assert.match(editor, /不影响微信聊天、通话(?:、|或)朋友圈/);
    assert.match(editor + profileSave, /getC\(u\.cid\)[\s\S]*xNetizenReplyStyle|xNetizenReplyStyle[\s\S]*getC\(u\.cid\)/);
    assert.doesNotMatch(editor + profileSave, /S\.x\.profile\.xNetizenReplyStyle/, `${name}: role style is not one shared global setting`);
    assert.match(reply, /routeIndex\s*:\s*roleChatRouteIndex\(c\)/);
    assert.match(reply, /aux\s*:\s*c\.model===['"]aux['"]/);
    assert.match(reply, /complete\s*:\s*true/);
  }
});

test('an empty or failed model call never manufactures a role reply to a netizen', async () => {
  const replySource = functionSource(webApp, 'xRoleReplyToNetizen');
  const publicProfileSource = functionSource(webApp, 'xRolePublicProfile');
  const publicNameSource = functionSource(webApp, 'xRolePublicName');
  const publicVoiceSource = functionSource(webApp, 'xRolePublicVoice');
  const promptSource = functionSource(webApp, 'xRoleNetizenReplyPrompt');
  const tweet = {
    id: 't1',
    who: 'c1',
    name: '角色一',
    text: '一条角色推文',
    comments: [{ id: 'n1', authorType: 'net', name: '普通网友', text: '你好' }],
  };
  const role = { id: 'c1', name: '角色一', remark: '我的私下备注', model: 'main', xNetizenReplyStyle: '简短、客气' };
  let mode = 'empty';
  let calls = 0;
  const sandbox = {
    S: { me: { name: '用户甲' }, x: { tweets: [tweet], users: { rolePublic: { cid: 'c1', name: '公开角色名', avatar: 'public-avatar', bio: '' } } } },
    tw: id => (id === tweet.id ? tweet : null),
    getC: id => (id === role.id ? role : null),
    xCommentAuthorType: cm => cm.authorType || 'net',
    xRoleNetizenReplyStyle: c => c.xNetizenReplyStyle || '礼貌、克制、有距离感',
    chatAPI: async () => {
      calls += 1;
      if (mode === 'throw') throw new Error('upstream failed');
      if (mode === 'disable') {
        role.deleted = true;
        return '这条本来能发出去。';
      }
      return mode === 'empty' ? '' : '谢谢，你也注意休息。';
    },
    cleanReply: value => String(value || '').trim(),
    cleanTweetText: value => String(value || '').trim(),
    roleChatRouteIndex: () => 2,
    uid: (() => { let n = 0; return () => `reply-${++n}`; })(),
    save: () => {},
    render: () => {},
    toast: () => {},
    aiLoad: () => {},
    aiDone: () => {},
    cur: () => ({ p: 'xtweet', id: 't1' }),
  };
  vm.runInNewContext(
    `let _xRoleReplyBusy=new Set();${publicProfileSource};${publicNameSource};${publicVoiceSource};${promptSource};${replySource};globalThis.reply=xRoleReplyToNetizen;`,
    sandbox,
  );

  await sandbox.reply('t1', 0, 'c1');
  assert.equal(tweet.comments.length, 1, 'empty model output adds no fixed fallback comment');
  mode = 'throw';
  await sandbox.reply('t1', 0, 'c1');
  assert.equal(tweet.comments.length, 1, 'a failed model request adds no fake role comment');
  mode = 'disable';
  await sandbox.reply('t1', 0, 'c1');
  assert.equal(tweet.comments.length, 1, 'a role disabled while the request is running cannot append a late public reply');
  role.deleted = false;
  mode = 'ok';
  await sandbox.reply('t1', 0, 'c1');
  assert.equal(tweet.comments.length, 2);
  assert.equal(tweet.comments[1].id, 'reply-1');
  assert.equal(tweet.comments[1].authorType, 'role');
  assert.equal(tweet.comments[1].name, '公开角色名');
  assert.equal(tweet.comments[1].avatar, 'public-avatar');
  assert.equal(tweet.comments[1].cid, 'c1');
  assert.match(tweet.comments[1].text, /谢谢，你也注意休息。/, 'the posted comment contains the genuine model reply');
  assert.equal(tweet.comments[1].replyToId, 'n1');
  assert.equal(tweet.comments[1].replyToName, '普通网友');
  assert.equal(calls, 4);
});

test('worldbook category UI and CRUD exist without entering the injection path', () => {
  const expected = [
    'worldbookCategoryRows',
    'worldbookEntryCategoryId',
    'worldbookCategoryFilteredRows',
    'worldbookCategoryCreate',
    'worldbookCategoryRenameSave',
    'worldbookCategoryDelete',
  ];
  for (const [name, source] of appCopies) {
    for (const fn of expected) assert.match(source, new RegExp(`function ${fn}\\(`), `${name}: ${fn} is present`);
    const render = functionSource(source, 'renderWorldbook');
    const edit = functionSource(source, 'editWorld');
    const hits = functionSource(source, 'worldHits');
    const prompt = functionSource(source, 'worldbookPrompt');
    const promptMany = functionSource(source, 'worldbookPromptForContacts');
    const filter = functionSource(source, 'worldbookCategoryFilteredRows');

    assert.match(render, /分类/);
    assert.match(render, /全部/);
    assert.match(render, /未分类/);
    assert.match(render, /分类只方便你整理和查看|分类只改变列表/);
    assert.match(edit, /id="w_category"/);
    assert.match(edit, /只用于整理查看/);
    assert.doesNotMatch(hits, /category/i, `${name}: worldHits is category-blind`);
    assert.doesNotMatch(prompt, /category/i, `${name}: single-role prompt injection is category-blind`);
    assert.doesNotMatch(promptMany, /category/i, `${name}: multi-role prompt injection is category-blind`);
    assert.doesNotMatch(filter, /\.sort\s*\(|\.splice\s*\(|S\.worldbook\s*=/, `${name}: filtering cannot reorder or rewrite the source entries`);
  }
});

test('worldbook category filtering and CRUD preserve entry and prompt order', async () => {
  const names = [
    'worldHits',
    'worldbookScopeOn',
    'worldbookText',
    'worldbookPrompt',
    'worldbookPromptForContacts',
    'worldbookCategoryRows',
    'worldbookEntryCategoryId',
    'worldbookCategoryName',
    'worldbookCategoryFilterSet',
    'worldbookCategoryFilteredRows',
    'worldbookCategoryCleanName',
    'worldbookCategoryNameError',
    'worldbookCategoryCreate',
    'worldbookCategoryRenameSave',
    'worldbookCategoryDelete',
  ];
  const functions = names.map(name => functionSource(webApp, name)).join('\n');
  const worldbook = [
    { id: 'global', enabled: true, always: true, name: '全局规则', content: '全局先注入', contacts: [], categoryId: 'rules' },
    { id: 'legacy', enabled: true, always: true, name: '旧条目', content: '旧条目第二', contacts: [] },
    { id: 'place', enabled: true, keys: '机场', name: '机场', content: '机场第三', contacts: [], categoryId: 'places' },
    { id: 'role', enabled: true, always: true, name: '角色规则', content: '角色第四', contacts: ['c1'], categoryId: 'missing-category' },
  ];
  const input = {
    worldbook_category_new: { value: '人物' },
    worldbook_category_rename: { value: '地点与场景' },
  };
  let uidNo = 0;
  let saveCount = 0;
  const sandbox = {
    S: {
      settings: { worldbookApps: {} },
      worldbook,
      worldbookCategories: [
        { id: 'rules', name: '规则' },
        { id: 'places', name: '地点' },
      ],
    },
    $: selector => input[String(selector).replace(/^#/, '')] || null,
    uid: () => `cat-${++uidNo}`,
    save: () => { saveCount += 1; },
    render: () => {},
    closeModal: () => {},
    toast: () => {},
    worldbookCategoryManage: () => {},
    uiConfirm: async () => true,
  };
  vm.runInNewContext(
    `let _worldbookCategoryFilter='all';${functions};globalThis.api={worldHits,worldbookPrompt,worldbookPromptForContacts,rows:worldbookCategoryFilteredRows,setFilter:worldbookCategoryFilterSet,create:worldbookCategoryCreate,rename:worldbookCategoryRenameSave,remove:worldbookCategoryDelete,entryCategory:worldbookEntryCategoryId};`,
    sandbox,
  );

  const originalEntries = json(worldbook);
  const originalIds = worldbook.map(w => w.id);
  const hitBefore = json(sandbox.api.worldHits('机场', 'c1').map(w => w.id));
  const promptBefore = sandbox.api.worldbookPrompt('机场', 'c1', '', 'wechat');
  const manyBefore = sandbox.api.worldbookPromptForContacts('机场', ['c1'], '测试', 'wechat');

  sandbox.api.setFilter('places');
  assert.deepEqual(json(sandbox.api.rows().map(w => w.id)), ['place']);
  sandbox.api.setFilter('uncategorized');
  assert.deepEqual(
    json(sandbox.api.rows().map(w => w.id)),
    ['legacy', 'role'],
    'legacy and orphan category ids appear as uncategorized in source order',
  );
  sandbox.api.setFilter('all');
  assert.deepEqual(json(sandbox.api.rows().map(w => w.id)), originalIds);
  assert.deepEqual(json(worldbook), originalEntries, 'filtering is a read-only view operation');

  sandbox.api.create();
  assert.deepEqual(json(worldbook.map(w => w.id)), originalIds, 'category creation does not move entries');
  assert.deepEqual(json(sandbox.S.worldbookCategories.map(c => c.name)), ['规则', '地点', '人物']);

  sandbox.api.rename('places');
  assert.equal(sandbox.S.worldbookCategories[1].name, '地点与场景');
  assert.deepEqual(json(worldbook.map(w => w.id)), originalIds, 'category rename does not move entries');

  await sandbox.api.remove('places');
  assert.equal(worldbook[2].categoryId, '', 'deleting a category only returns its entries to uncategorized');
  assert.deepEqual(json(worldbook.map(w => w.id)), originalIds, 'category delete never deletes or reorders entries');
  for (let i = 0; i < worldbook.length; i += 1) {
    const before = originalEntries[i];
    const after = json(worldbook[i]);
    delete before.categoryId;
    delete after.categoryId;
    assert.deepEqual(after, before, `entry ${worldbook[i].id} keeps all injection-relevant fields`);
  }

  assert.deepEqual(json(sandbox.api.worldHits('机场', 'c1').map(w => w.id)), hitBefore);
  assert.equal(sandbox.api.worldbookPrompt('机场', 'c1', '', 'wechat'), promptBefore);
  assert.equal(sandbox.api.worldbookPromptForContacts('机场', ['c1'], '测试', 'wechat'), manyBefore);
  assert.ok(saveCount >= 3, 'each CRUD mutation is persisted');
});

test('worldbook imports start uncategorized and cannot smuggle category ordering into prompts', () => {
  const names = ['worldbookFileBase', 'worldbookJSONList', 'worldbookImportRows'];
  const sandbox = { S: { contacts: [{ id: 'c1' }] } };
  vm.runInNewContext(
    `${names.map(name => functionSource(webApp, name)).join('\n')};globalThis.read=worldbookImportRows;`,
    sandbox,
  );
  const textRows = sandbox.read(null, '城市资料.md', '苏州全年多雨');
  const jsonRows = sandbox.read(
    { entries: { 0: { name: '机场', key: ['机场'], content: '机场设定', categoryId: 'external-category' } } },
    'book.json',
    '',
  );
  assert.equal(textRows[0].categoryId || '', '');
  assert.equal(jsonRows[0].categoryId || '', '', 'external category ids are not trusted or silently created');
});
