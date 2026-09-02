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

test('permission is visible in settings and defaults to enabled for new and old data', () => {
  assert.match(source, /showMoodTag:true, roleMomentImages:true,/);
  assert.match(source, /允许角色在朋友圈发图片/);
  assert.match(source, /S\.settings\.roleMomentImages=!roleMomentImagesAllowed\(\)/);
  const context = vm.createContext({ S: { settings: {} } });
  vm.runInContext(functionSource('roleMomentImagesAllowed'), context);
  assert.equal(context.roleMomentImagesAllowed(), true, 'older backups without the field stay enabled');
  context.S.settings.roleMomentImages = false;
  assert.equal(context.roleMomentImagesAllowed(), false);
});

test('final role Moment write gate strips real images and fallback photo cards when disabled', () => {
  const context = vm.createContext({
    S: { settings: { roleMomentImages: false }, moments: [] },
    cleanMomentText: text => String(text || '').trim(),
    roleMomentSimilarity: () => ({ hard: false }),
    momentPhotoCards: value => value || [],
    uid: () => 'moment-1',
    actId: () => 'main',
    save: () => {},
    cur: () => ({ p: 'home' }),
    wxTab: 'chat',
    render: () => {},
    toast: () => {},
    Array, Object, String, Date,
  });
  vm.runInContext(functionSource('roleMomentImagesAllowed'), context);
  vm.runInContext(functionSource('publishRoleMoment'), context);
  assert.equal(context.publishRoleMoment({ id: 'role-1', name: '先生' }, '纯文字仍可发布', {
    images: ['data:image/png;base64,abc'],
    photoCards: [{ desc: '不应保存的照片卡' }],
  }), true);
  assert.deepEqual(Array.from(context.S.moments[0].images), []);
  assert.deepEqual(Array.from(context.S.moments[0].photoCards), []);

  context.S.settings.roleMomentImages = true;
  context.publishRoleMoment({ id: 'role-1', name: '先生' }, '开启后带图', {
    images: ['data:image/png;base64,ok'],
    photoCards: [{ desc: '只保留一类媒体也由现有逻辑处理' }],
  });
  assert.deepEqual(Array.from(context.S.moments[0].images), ['data:image/png;base64,ok']);
});

test('disabled permission stops image reuse and generation before posting', () => {
  let published;
  const context = vm.createContext({
    S: { settings: { roleMomentImages: false } },
    _roleMomentPostPending: new Set(),
    roleMomentNorm: text => String(text),
    roleMomentImagesAllowed: () => false,
    roleMomentExplicitPhotoIntent: () => true,
    toast: () => {},
    publishRoleMoment: (role, text, options) => { published = options; return true; },
    roleMomentRequestedUserImage: () => { throw new Error('must not reuse a chat image'); },
    roleMomentReferencedChatImage: () => { throw new Error('must not reuse an older image'); },
    imageGenerationAvailable: () => { throw new Error('must not check or invoke image generation'); },
    Array, Object, String, Set,
  });
  vm.runInContext(functionSource('postRoleMoment'), context);
  assert.equal(context.postRoleMoment({ id: 'role-1' }, '今天的文字', {
    images: ['existing-image'], photoCards: [{ desc: 'existing-card' }], toast: true, userText: '发图并配文',
  }), true);
  assert.deepEqual(Array.from(published.images), []);
  assert.deepEqual(Array.from(published.photoCards), []);
});

test('autonomous Moments skip media planning while X and user-owned posts stay outside the gate', async () => {
  let mediaCalls = 0, published;
  const context = vm.createContext({
    Date, Object,
    cleanMomentText: text => text,
    cleanTweetText: text => text,
    roleMomentGenerate: async () => '自主文字朋友圈',
    roleTweetGenerate: async () => 'tweet',
    roleMomentSimilarity: () => ({ hard: false }),
    roleTweetSimilarity: () => ({ hard: false }),
    roleMomentImagesAllowed: () => false,
    roleSocialMedia: async () => { mediaCalls += 1; return { images: ['wrong'], photoCards: [{ desc: 'wrong' }] }; },
    publishRoleMoment: (role, text, options) => { published = options; return true; },
    publishRoleTweet: () => true,
  });
  vm.runInContext(functionSource('publishRoleSocialAutonomous'), context);
  assert.equal(await context.publishRoleSocialAutonomous({ id: 'role-1' }, 'moment', {}), true);
  assert.equal(mediaCalls, 0);
  assert.deepEqual(Array.from(published.images), []);
  assert.deepEqual(Array.from(published.photoCards), []);
  assert.doesNotMatch(functionSource('postMoment'), /roleMomentImagesAllowed/);
});
