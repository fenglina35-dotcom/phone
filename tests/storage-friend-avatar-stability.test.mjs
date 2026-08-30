import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const plainStart = source.indexOf(`function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

assert.match(functionSource('pfAvatarHTML'), /isStoredImgRef\(v\)\)return av\(v,extra\)/,
  'stored real-friend avatars must render a lazy-hydration marker instead of a permanent fallback');

const avatarContext = vm.createContext({
  phoneFriendAvatar: () => 'idb:friend-avatar',
  isStoredImgRef: value => String(value || '').startsWith('idb:'),
  isImg: value => /^(https?:|data:|blob:)/i.test(String(value || '')),
  _imgCache: {},
  esc: value => String(value),
  ICONS: {user: '<path />'},
});
vm.runInContext(`${functionSource('_avIc')}\n${functionSource('av')}\n${functionSource('pfAvatarHTML')}\nglobalThis.renderAvatar=pfAvatarHTML;`, avatarContext);
assert.match(avatarContext.renderAvatar({}), /data-idb-avatar="friend-avatar"/,
  'an unloaded friend avatar must remain discoverable by the visible-image loader');

const writes = [];
const localizeContext = vm.createContext({
  imgPut: async (key, value) => { writes.push([key, value]); },
  isStoredImgRef: value => String(value || '').startsWith('idb:'),
  isBigImg: value => typeof value === 'string' && value.startsWith('data:image') && value.length > 2000,
  _imgCache: {},
  _imgRev: new Map(),
  _imgReady: new Set(),
  Promise,
});
vm.runInContext([
  functionSource('pfAvatarStorageKey'),
  functionSource('pfAvatarRevision'),
  functionSource('pfLocalizeRemoteAvatar'),
  functionSource('pfLocalizeRemoteRows'),
  functionSource('pfLocalizeRemoteData'),
  'globalThis.localize=pfLocalizeRemoteData;',
].join('\n'), localizeContext);

const bigAvatar = 'data:image/jpeg;base64,' + 'a'.repeat(2400);
const localized = await localizeContext.localize({
  friends: [{phone_id: 'ab-12', avatar: bigAvatar}],
});
assert.equal(localized.friends[0].avatar, 'idb:pf_avatar_v2_AB-12');
assert.equal(writes.length, 1);
assert.equal(writes[0][0], 'pf_avatar_v2_AB-12', 'the same friend must reuse one stable image key across syncs');
assert.ok(!Object.hasOwn(localized, 'groups'), 'an incremental response without groups must not become an authoritative empty list');

const invalidRemoteRef = await localizeContext.localize({friends: [{phone_id: 'AB-12', avatar: 'idb:other-device-key'}]});
assert.ok(!Object.hasOwn(invalidRemoteRef.friends[0], 'avatar'),
  'another device local IndexedDB key must not overwrite a valid avatar on this device');

const emptyRemote = await localizeContext.localize({friends: [{phone_id: 'AB-12', avatar: ''}]});
assert.ok(!Object.hasOwn(emptyRemote.friends[0], 'avatar'),
  'an empty incremental avatar must not erase the last valid local copy');
assert.equal(typeof localized.friends[0]._avatarRev, 'string');
assert.ok(localized.friends[0]._avatarRev.length > 10,
  'localized avatars need a small revision stamp so an avatar-only sync repaints immediately');
assert.match(functionSource('pfRemoteListStamp'), /pfAvatarRevision/,
  'friend and group change detection must include avatar revisions');

assert.match(functionSource('pfProfilePayload'), /await rolePushAvatarData/,
  'profile upload must resolve local image references into a transport-safe avatar');
assert.match(functionSource('pfEnsure'), /await pfProfilePayload\(\)/,
  'profile registration must wait for avatar serialization');

const deleted = [];
const liveBigImage = 'data:image/png;base64,' + 'b'.repeat(2200);
const gcContext = vm.createContext({
  S: {friend: {avatar: 'idb:keep'}, cover: liveBigImage},
  imageRefKeys: () => ['keep'],
  isBigImg: value => typeof value === 'string' && value.startsWith('data:image') && value.length > 2000,
  imgKeys: async () => ['keep', 'mapped', 'orphan', '__messages', '__recovery'],
  imgDel: async key => { deleted.push(key); },
  _imgCache: {keep: 'keep-data', mapped: liveBigImage, orphan: 'orphan-data'},
  _imgRev: new Map([[liveBigImage, 'mapped']]),
  _imgReady: new Set(['keep', 'mapped', 'orphan']),
  _imgGCWrite: Promise.resolve(),
  Set,
  Promise,
});
vm.runInContext(`${functionSource('imgUsedKeys')}\n${functionSource('imgGC')}\nglobalThis.collect=imgGC;`, gcContext);
await gcContext.collect();
assert.deepEqual(deleted, ['orphan'],
  'GC must delete only an unreferenced ordinary image and preserve references plus protected archives');

assert.match(functionSource('_imgReplacer'), /_imgReady\.add\(key\);imageReferenceCompactSoon\(\)/,
  'a completed image write must promptly schedule a second compacting save');
assert.match(functionSource('storageMeter'), /主存档.*保护副本/,
  'native main data and rotating safety copies must be shown separately');

console.log('storage and real-friend avatar stability tests passed');
