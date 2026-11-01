// FISH_LOGIN_KEEP_V1：Fish 会员登录不再莫名其妙地掉。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, PRIV_DIR } from './_helpers.mjs';

const PRIV = PRIV_DIR;
const STORE = 'north_fish_mcp_v1';
const MCP = 'https://license.smallphoneapp.com/fish-mcp';
const TOKEN = 'https://api.fish.audio/oauth/token';

const res = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (k) => headers[k] || headers[k.toLowerCase()] || null },
  text: async () => typeof body === 'string' ? body : JSON.stringify(body),
});

function sandbox(mod, fetchImpl) {
  const store = new Map();
  const ctx = {
    localStorage: { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    location: { protocol: 'file:', origin: '', pathname: '/', search: '', href: '' }, history: { replaceState() {} },
    crypto: { getRandomValues: (a) => a }, TextEncoder, URLSearchParams, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'), fetch: fetchImpl, setTimeout, clearTimeout, console,
    Uint8Array, Uint32Array, Promise, Date, Math, JSON, String, Object, Array, RegExp, Error, AbortController,
  };
  ctx.open = () => {}; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(mod, ctx);
  return { F: ctx.NorthFishMcp, store, ctx };
}

// 一个会“轮换”续期凭证的假 Fish：用 R1 换一次得到 AT2/R2，之后再拿 R1 来换就报 invalid_grant
function fakeFish(opts = {}) {
  const log = { token: 0, mcpAuth: [] };
  let current = 'R1';
  const fetchImpl = async (url, init) => {
    if (url === TOKEN) {
      log.token += 1;
      if (opts.networkDown) throw new TypeError('Load failed');
      const rt = new URLSearchParams(init.body).get('refresh_token');
      await new Promise((r) => setTimeout(r, 5));
      if (rt !== current || opts.revoked) return res(400, { error: 'invalid_grant', error_description: 'refresh token is invalid' });
      current = 'R2';
      return res(200, { access_token: 'AT2', refresh_token: 'R2', expires_in: 3600 });
    }
    if (url === MCP) {
      const b = JSON.parse(init.body);
      log.mcpAuth.push(init.headers.Authorization);
      if (init.headers.Authorization !== 'Bearer AT2') return res(401, { error: 'expired' });
      if (b.method === 'initialize') return res(200, { jsonrpc: '2.0', id: b.id, result: {} }, { 'Mcp-Session-Id': 'S1', 'Content-Type': 'application/json' });
      if (b.method === 'notifications/initialized') return res(202, '');
      return res(200, { jsonrpc: '2.0', id: b.id, result: { content: [{ type: 'text', text: 'ok' }] } }, { 'Content-Type': 'application/json' });
    }
    throw new Error('unexpected ' + url);
  };
  return { fetchImpl, log };
}

const expired = () => JSON.stringify({ access: 'AT1', refresh: 'R1', exp: Date.now() - 1000, client: 'cid', redirect: 'cb', at: 1, team: 'My Team' });

for (const [label, file] of [['web', 'fish-mcp.js'], ['private', PRIV + 'fish-mcp.js']]) {
  const mod = read(file);

  test(label + ' Fish: several voices renewing at once keep the login (only one renewal is sent)', async () => {
    const fish = fakeFish(), { F, store } = sandbox(mod, fish.fetchImpl);
    store.set(STORE, expired());
    const results = await Promise.allSettled([1, 2, 3].map(() => F.call('text_to_speech', { text: 'hi' })));
    assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'fulfilled', 'fulfilled'], String(results.find((r) => r.reason)?.reason));
    assert.equal(fish.log.token, 1, '同一时间只续一次');
    assert.equal(F.status().loggedIn, true, '登录还在');
    assert.equal(JSON.parse(store.get(STORE)).refresh, 'R2');
  });

  test(label + ' Fish: a network failure while renewing never logs her out', async () => {
    const fish = fakeFish({ networkDown: true }), { F, store } = sandbox(mod, fish.fetchImpl);
    store.set(STORE, expired());
    await assert.rejects(F.call('text_to_speech', { text: 'hi' }));
    assert.equal(F.status().loggedIn, true);
  });

  test(label + ' Fish: only a login Fish really revoked asks her to log in again, with a clear message', async () => {
    const fish = fakeFish({ revoked: true }), { F, store } = sandbox(mod, fish.fetchImpl);
    store.set(STORE, expired());
    await assert.rejects(F.call('text_to_speech', { text: 'hi' }), /重新登录/);
    assert.equal(F.status().loggedIn, false);
  });
}

test('after logging in to Fish again, a failed voice bubble can be regenerated right away', async () => {
  for (const file of ['app.js', PRIV + 'app.js']) {
    const src = read(file);
    const start = src.indexOf('function warmVoiceMsg(');
    const body = src.slice(start, src.indexOf('m._ttsLoading=true', start));
    assert.match(body, /window\.__northFishLoginAt/, file);
  }
  for (const file of ['fish-mcp.js', PRIV + 'fish-mcp.js']) {
    const fish = fakeFish(), { F, store, ctx } = sandbox(read(file), fish.fetchImpl);
    store.set(STORE, expired());
    await F.call('text_to_speech', { text: 'hi' });
    assert.ok(ctx.__northFishLoginAt > 0, file);
  }
});
