import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const rootUrl = new URL('../app.js', import.meta.url);
const bundleUrl = new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url);
const source = fs.readFileSync(rootUrl, 'utf8').replace(/\r\n/g, '\n');
const bundle = fs.readFileSync(bundleUrl, 'utf8').replace(/\r\n/g, '\n');

function functionSource(name, text = source) {
  const start = text.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = text.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

for (const name of ['phoneFriendAvatar','privateTrimImageMemoryCache','storedImageDisplaySource','routeCriticalStoredImageKeys','hydrateRouteCriticalStoredImages']) {
  assert.ok(bundle.includes(functionSource(name)), `private bundle image repair differs: ${name}`);
}
assert.match(functionSource('renderChat'), /storedImageDisplaySource\(c\.chatBg\)/, 'chat renders must reuse an already hydrated background instead of flashing an idb URL');
assert.match(functionSource('renderChat', bundle), /storedImageDisplaySource\(c\.chatBg\)/, 'private chat renders must keep the same critical image hydration contract even when unrelated header behavior releases later');
assert.match(functionSource('phoneFriendAvatar'), /storedImageDisplaySource/, 'real-friend avatars must reuse hydrated image data across renders');
assert.match(functionSource('privateTrimImageMemoryCache'), /routeCriticalStoredImageKeys/, 'active chat and friend images must be protected from generic memory trimming');

const context = vm.createContext({
  _imgCache: {bg: 'data:image/jpeg;base64,BG', friend: 'data:image/jpeg;base64,FRIEND'},
  isStoredImgRef: value => /^idb:/.test(String(value || '')),
  cur: () => ({p: 'chat', id: 'role'}),
  getC: () => ({chatBg: 'idb:bg', avatar: 'idb:role'}),
  phoneFriendState: () => ({friends: [{id: 'friend-1', avatar: 'idb:friend'}]}),
  phoneFriendById: id => id === 'friend-1' ? {id, avatar: 'idb:friend'} : null,
  pfGroupById: () => ({members: []}),
  pfKeyOf: value => String(value || ''),
});
vm.runInContext([
  functionSource('storedImageDisplaySource'),
  functionSource('routeCriticalStoredImageKeys'),
  'globalThis.display=storedImageDisplaySource;globalThis.keys=routeCriticalStoredImageKeys;',
].join('\n'), context);

assert.equal(context.display('idb:bg'), 'data:image/jpeg;base64,BG', 'cached chat backgrounds must be available in the same paint');
assert.equal(context.display('idb:missing'), 'idb:missing', 'a missing image reference must stay recoverable for asynchronous hydration');
assert.deepEqual(Array.from(context.keys({p: 'chat', id: 'role'})), ['bg', 'role']);
assert.deepEqual(Array.from(context.keys({p: 'wechat'})), ['friend']);

const hydrated = {nodes: 0, trimKeys: [], reads: []};
const hydrateContext = vm.createContext({
  lazyStoredImagesOn: () => true,
  routeCriticalStoredImageKeys: () => ['bg', 'friend'],
  _imgCache: {},
  _imgRev: new Map(),
  _imgReady: new Set(),
  _visibleImageMisses: new Map([['bg', {count: 2}], ['friend', {count: 1}]]),
  renderPageKey: () => 'wechat',
  cur: () => ({p: 'wechat'}),
  imgMany: async keys => {
    hydrated.reads.push([...keys]);
    return {bg: 'data:image/jpeg;base64,BG', friend: 'data:image/jpeg;base64,FRIEND'};
  },
  hydrateStoredImageNodes: () => { hydrated.nodes += 1; },
  privateTrimImageMemoryCache: keys => { hydrated.trimKeys = [...keys]; },
  Promise,
});
vm.runInContext(`let _routeImageHydratePromise=null,_routeImageHydrateSignature='';\n${functionSource('hydrateRouteCriticalStoredImages')}\nglobalThis.hydrate=hydrateRouteCriticalStoredImages;`, hydrateContext);
assert.equal(await hydrateContext.hydrate(), true);
assert.deepEqual(hydrated.reads, [['bg', 'friend']], 'route-critical images must use one immediate independent IndexedDB batch');
assert.equal(hydrateContext._imgCache.bg, 'data:image/jpeg;base64,BG');
assert.equal(hydrateContext._imgCache.friend, 'data:image/jpeg;base64,FRIEND');
assert.equal(hydrated.nodes, 1, 'loaded image nodes must update without rebuilding the whole chat route');
assert.deepEqual(hydrated.trimKeys, ['bg', 'friend'], 'the freshly loaded route images must remain protected while trimming memory');
assert.equal(hydrateContext._visibleImageMisses.size, 0, 'successful priority hydration must clear stale retry backoff');

const renderSource = functionSource('render');
assert.ok(renderSource.indexOf('hydrateRouteCriticalStoredImages()') < renderSource.indexOf('scheduleVisibleStoredImages'), 'route-critical images must start loading before the generic four-image queue');

console.log('chat critical image hydration tests passed');
