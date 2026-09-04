import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('app.js', 'utf8');
const wedding = fs.readFileSync('wedding-game.js', 'utf8');
const css = fs.readFileSync('wedding-game.css', 'utf8');
const bridge = fs.readFileSync(
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift',
  'utf8',
);
const project = fs.readFileSync(
  'native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',
  'utf8',
);

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const body = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = body; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is not closed`);
}

test('v990 only auto-invites on Qixi, while agreed calendar weddings wait for exact time', () => {
  const strict = wedding.slice(wedding.lastIndexOf('weddingAutoInvitation=function'));
  assert.match(strict, /weddingLocalDay\(at\)!==WEDDING_RELEASE_DAY/);
  assert.match(strict, /weddingSendInvitationPersonalized\(c,'manual'/);
  assert.match(wedding, /if\(now<at\)return true/);
  assert.match(wedding, /weddingSendInvitationPersonalized\(c,'calendar'/);
  assert.match(app, /\[婚礼日程\|YYYY-MM-DD\|HH:MM\]/);
  assert.match(app, /到了约定日期和时间才由你主动发来/);
  assert.match(app, /function consumeWeddingCalendarTags\(/);
});

test('an open period stays ongoing until an explicit end date is saved', () => {
  const names = [
    'calDateParts', 'calUtcValue', 'calDayDiff', 'calAddDays', 'periodStore',
    'periodNormalize', 'periodRecords', 'periodEstimate', 'periodFactsText',
  ];
  const context = vm.createContext({
    S: { periods: [{ id: 'p1', startDate: '2026-08-17', endDate: '' }] },
    todayStr: () => '2026-08-19',
    Date, Number, Math, String, Array, Object,
  });
  vm.runInContext(
    `${names.map((name) => functionSource(app, name)).join('\n')}this.api={periodRecords,periodEstimate,periodFactsText};`,
    context,
  );
  assert.equal(context.api.periodRecords()[0].endDate, '');
  assert.equal(context.api.periodEstimate(), null);
  assert.match(context.api.periodFactsText(), /仍在进行/);
  assert.match(context.api.periodFactsText(), /第3天/);
  assert.match(app, /function periodEndModal\(/);
  assert.match(app, /function periodEndSave\(/);
});

test('modern ceremony keeps its opening and places ring before hand-back kiss', () => {
  const override = wedding.slice(
    wedding.indexOf('weddingBuildItems=function'),
    wedding.indexOf('function weddingCurrent'),
  );
  assert.match(override, /scene:'welcome',text:s\.opening_narration/);
  assert.match(override, /scene:'welcome',text:s\.opening_line/);
  const ring = override.indexOf("id:'ring'");
  const kiss = override.indexOf("scene:'kiss'");
  assert.ok(ring >= 0 && kiss > ring);
  assert.match(override, /婚戒已经稳稳留在左手无名指上/);
  assert.match(wedding, /为她左手无名指戴上戒指，再亲吻她已经戴着婚戒的手背/);
  assert.match(wedding, /为她戴上婚戒、亲吻她戴着婚戒的手背/);
});

test('couple-space album reads current scene keys so a chapter replacement updates the same cell', () => {
  assert.match(wedding, /高清婚礼影集/);
  assert.match(wedding, /const key=prepared\.sceneKeys&&prepared\.sceneKeys\[scene\]/);
  assert.match(wedding, /prepared\.sceneKeys\[scene\]=cacheKey/);
  assert.match(wedding, /prepared\.sceneRevisions\[scene\]=\(prepared\.sceneRevisions\[scene\]\|\|0\)\+1/);
  assert.match(wedding, /在线下约会重做某一章后，这里会自动换成最新画面/);
  assert.match(wedding, /setTimeout\(\(\)=>weddingSavePhotoElement\(el\),720\)/);
  assert.match(wedding, /SmallPhoneNative\.request\('media\.photo\.save'/);
  assert.match(wedding, /function weddingOpenPhotoViewer\(index\)/);
  assert.match(wedding, /保存高清原图/);
  const album=wedding.slice(wedding.indexOf('async function weddingOpenPhotoAlbum'),wedding.indexOf('async function weddingAfterMessage'));
  assert.doesNotMatch(album,/weddingOpenSceneRegenerator/);
  assert.match(css, /\.wedding-photo-viewer/);
  assert.doesNotMatch(css, /\.wedding-album-regenerate/);
});

test('expired wedding countdown self-recovers after app resume and browser gets the same offline controls', () => {
  assert.doesNotMatch(wedding, /function weddingOfflineEntryHTML\(\)\{if\(!weddingPrivateApp\(\)\)return''/);
  assert.match(wedding, /function weddingRecoverReadyInvite\(cid,token,style\)/);
  assert.match(wedding, /立即进入婚礼/);
  assert.match(wedding, /document\.addEventListener\('visibilitychange'/);
  assert.match(wedding, /window\.addEventListener\('pageshow'/);
  assert.match(wedding, /window\.addEventListener\('focus'/);
});

test('a deleted ready card recovers from the latest prepared wedding instead of looping on a stale countdown', () => {
  assert.match(wedding, /function weddingLatestPreparedEntry\(c,style\)/);
  assert.match(wedding, /function weddingResolvePreparedInvite\(c,m\)/);
  assert.match(wedding, /if\(!ref&&token&&weddingState\(\)\.prepared\[token\]\)/);
  assert.match(wedding, /原邀请卡即使已经删除，也可以从这里继续进入或重新准备/);
  assert.match(wedding, /weddingRecoverReadyInvite\(\\''\+c\.id\+'\\',\\''\+token\+'\\',\\''\+style\+'\\'\)/);
  assert.match(wedding, /weddingStartSimulation\(\\''\+c\.id\+'\\',\\''\+token\+'\\',\\''\+style\+'\\'\)/);
  assert.match(wedding, /weddingOpenSceneRegenerator\(\\''\+c\.id\+'\\',\\''\+token\+'\\'\)/);
  assert.match(wedding, /重新生成'\+label\+'婚礼/);
  assert.match(wedding, /m\.preparedId=ref\.id/);
});

test('deleted-card recovery actions reuse prepared content without forcing a new full generation', () => {
  assert.match(wedding, /const direct=token&&st\.prepared\[token\]/);
  assert.match(wedding, /if\(direct&&direct\.cid===cid\)return\{c,m:null,record:null,prepared:direct,preparedId:token,token\}/);
  assert.match(wedding, /if\(!prepared&&mid\)\{const context=weddingSceneContext\(c\.id,mid\)/);
  assert.match(wedding, /const invite=m&&m\.phase==='ready'&&!m\.supersededAt\?m:\{id:preparedId,preparedId,eventAt:Date\.now\(\),style,phase:'ready'\}/);
  assert.match(wedding, /weddingEnterPrepared\(c,invite,prepared,true\)/);
});

test('private bridge saves original wedding art to Photos with add-only permission', () => {
  assert.match(bridge, /import Photos/);
  assert.match(bridge, /static let contractVersion = 35/);
  assert.match(bridge, /case "media\.photo\.save"/);
  assert.match(bridge, /authorizationStatus\(for: \.addOnly\)/);
  assert.match(bridge, /PHAssetChangeRequest\.creationRequestForAsset/);
  assert.match(project, /INFOPLIST_KEY_NSPhotoLibraryAddUsageDescription/);
});
