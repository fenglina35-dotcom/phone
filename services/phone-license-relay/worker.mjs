// Fixed-backend authorization transport. No storage, logging, cache, or retry.
const UPSTREAM = 'https://lovbzibismsjqvjujilz.supabase.co/functions/v1/phone-license';
const APP_ORIGIN = 'https://fenglina35-dotcom.github.io';
const ACTIONS = new Set(['activate','legacy_activate','register_options','register_verify',
  'restore_options','restore_verify','session_check','session_list','session_revoke',
  'ai_identity_sync','phone_friend_identity_sync']);
const MAX_BODY = 65536;
async function boundedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export function createHandler(fetchUpstream = (...args) => fetch(...args), timeoutMs = 20000) {
  return async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin',
    };
    if (origin === APP_ORIGIN) headers['Access-Control-Allow-Origin'] = APP_ORIGIN;
    const reply = (status, body) => new Response(JSON.stringify(body), {status, headers});
    if (origin && origin !== APP_ORIGIN) return reply(403, {ok:false, code:'origin-not-allowed'});
    const health = url.pathname === '/health';
    if (!health && url.pathname !== '/functions/v1/phone-license') return reply(404, {ok:false, code:'not-found'});
    if (url.search) return reply(400, {ok:false, code:'query-not-accepted'});
    if (request.method === 'OPTIONS') {
      return new Response(null, {status:204, headers:{...headers, 'Access-Control-Allow-Methods':health ? 'GET, OPTIONS' : 'POST, OPTIONS', 'Access-Control-Allow-Headers':'content-type'}});
    }
    if (request.method !== (health ? 'GET' : 'POST')) return reply(405, {ok:false, code:'method-not-allowed'});
    let payload = JSON.stringify({action:'session_check', sessionToken:''});
    if (!health) {
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return reply(415, {ok:false, code:'json-required'});
      if (Number(request.headers.get('Content-Length')) > MAX_BODY) return reply(413, {ok:false, code:'body-too-large'});
      try {
        payload = await boundedBody(request);
        if (payload === null) return reply(413, {ok:false, code:'body-too-large'});
        const input = JSON.parse(payload);
        if (!input || !ACTIONS.has(input.action)) return reply(403, {ok:false, code:'action-not-allowed'});
      } catch (_) { return reply(400, {ok:false, code:'invalid-json'}); }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Preserve the original body and device label. Forward only required headers, never admin credentials.
      const upstream = await fetchUpstream(UPSTREAM, {
        method:'POST',
        headers:{'Content-Type':'application/json', Origin:APP_ORIGIN, ...(!health ? {'User-Agent':request.headers.get('User-Agent') || ''} : {})},
        body:payload,
        signal:controller.signal,
        redirect:'manual',
      });
      let body;
      try { body = await upstream.json(); }
      catch (_) {
        if (controller.signal.aborted) throw _;
        return reply(502, {ok:false, code:'upstream-non-json', upstreamStatus:upstream.status});
      }
      if (!health) {
        if (upstream.status < 200 || upstream.status >= 600 || (upstream.status >= 300 && upstream.status < 400)) {
          return reply(502, {ok:false, code:'unexpected-upstream-response', permanent:false});
        }
        return reply(upstream.status, body);
      }
      const reachable = upstream.status === 400 && body.ok === false
        && body.code === 'license-request-failed' && body.error === '本浏览器还没有授权';
      return reply(reachable ? 200 : 502, {
        ok:reachable,
        code:reachable ? 'license-backend-reachable' : 'unexpected-upstream-response',
        message:reachable ? '备用入口已连通授权服务器；本页面不会兑换邀请码。' : '入口可达，授权服务器响应异常。',
      });
    } catch (_) {
      return reply(502, {ok:false, code:controller.signal.aborted ? 'upstream-timeout' : 'upstream-unreachable', permanent:false, error:'授权服务器连接暂时中断；若提交过邀请码，请先确认授权结果，避免重复核销。'});
    } finally {
      clearTimeout(timer);
    }
  };
}

export default {fetch:createHandler()};
