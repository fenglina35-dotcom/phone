// Fixed-backend authorization transport plus fixed-host external TTS transport.
// No storage, logging, cache, account lookup, billing, or retry.
const UPSTREAM = 'https://lkhlyfpssmrjkkzhuzag.supabase.co/functions/v1/phone-license';
const APP_ORIGIN = 'https://fenglina35-dotcom.github.io';
const EXTERNAL_TTS_PATH = '/functions/v1/external-tts';
const ACTIONS = new Set(['activate','legacy_activate','register_options','register_verify',
  'restore_options','restore_verify','session_check','session_list','session_revoke',
  'ai_identity_sync','phone_friend_identity_sync']);
const ADMIN_ACTIONS = new Set(['admin_auth','admin_invite_generate','admin_invite_list',
  'admin_owner_pair_create',
  'admin_license_users','admin_license_block','admin_license_unblock','admin_license_restore_all',
  'admin_orders','admin_assign_private_voice','admin_review','admin_delete_order','admin_delete_orders',
  'admin_config','admin_subscribe']);
const ADMIN_PUBLIC_ACTIONS = new Set(['admin_owner_pair_claim']);
const MAX_BODY = 65536;
// Same original friend database, fixed RPC allowlist. No arbitrary REST proxy.
const FRIEND_RPC = new Set(['phone_friend_search','phone_friend_sync','phone_friend_upsert_profile',
  'phone_friend_send_message','phone_friend_send_group_message','phone_friend_send_request',
  'phone_friend_respond_request','phone_friend_mark_received','phone_friend_recall_message',
  'phone_friend_create_group','phone_friend_group_invite','phone_friend_group_accept_invite',
  'phone_friend_group_disband','phone_friend_group_leave','phone_friend_group_remove_member',
  'phone_friend_delete_friend']);
async function friendRpcRelay(request, url, headers, fetchUpstream, timeoutMs) {
  const fn=url.pathname.slice('/rest/v1/rpc/'.length),reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(!FRIEND_RPC.has(fn))return reply(404,{message:'friend-rpc-not-allowed'});
  if(url.search)return reply(400,{message:'query-not-accepted'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey, authorization'}});
  if(request.method!=='POST')return reply(405,{message:'method-not-allowed'});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return reply(415,{message:'json-required'});
  const apikey=cleanText(request.headers.get('apikey'),2048),authorization=cleanText(request.headers.get('Authorization'),4096);
  if(!apikey||!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization))return reply(401,{message:'friend-auth-required'});
  let body;try{body=await boundedBody(request,262144);if(body===null)return reply(413,{message:'body-too-large'});const data=JSON.parse(body);if(!data||typeof data!=='object'||Array.isArray(data))return reply(400,{message:'invalid-json'});}catch(_){return reply(400,{message:'invalid-json'});}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(timeoutMs,35000));
  try{const response=await fetchUpstream('https://lkhlyfpssmrjkkzhuzag.supabase.co/rest/v1/rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json',apikey,Authorization:authorization},body,signal:controller.signal,redirect:'manual'});
    if(response.status>=300&&response.status<400)return reply(502,{message:'friend-upstream-redirect-rejected'});
    const data=await response.text();try{JSON.parse(data);}catch(_){return reply(502,{message:'friend-upstream-non-json'});}
    return new Response(data,{status:response.status,headers});
  }catch(_){return reply(502,{message:controller.signal.aborted?'friend-upstream-timeout':'friend-upstream-unreachable'});}finally{clearTimeout(timer);}
}
// Private role sync uses its original independent database. No general companion proxy.
const MAX_TTS_BODY = 16384;
const TTS_PROVIDERS = new Set(['minimax','fish','mossland','elevenlabs','hume']);
async function boundedBody(request, maxBody = MAX_BODY) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBody) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

// MiniMax rejects an empty or unknown emotion with "invalid params: voice_setting emotion".
// Neutral lines carry no emotion, so the field must be left out instead of sent as "".
const MINIMAX_EMOTIONS = new Set(['happy','sad','angry','fearful','disgusted','surprised','calm']);
function minimaxEmotion(value) {
  const emotion = cleanText(value, 32).toLowerCase();
  return MINIMAX_EMOTIONS.has(emotion) ? {emotion} : {};
}

function externalTtsRequest(input) {
  const provider = cleanText(input?.provider, 32).toLowerCase();
  const operation = cleanText(input?.operation || 'synthesize', 32).toLowerCase();
  const key = cleanText(input?.key, 1024);
  const model = cleanText(input?.model, 160);
  const voice = cleanText(input?.voice_id, 240);
  const text = cleanText(input?.text, 1200);
  const group = cleanText(input?.group, 240);
  const configuredBase = cleanText(input?.base, 300).replace(/\/+$/, '');
  if (!TTS_PROVIDERS.has(provider)) throw new Error('provider-not-allowed');
  if (!['synthesize','list_voices'].includes(operation)) throw new Error('operation-not-allowed');
  if (!key) throw new Error('missing-api-key');
  if (operation === 'synthesize' && (!text || [...text].length > 300)) throw new Error('invalid-text');
  if (operation === 'synthesize' && !voice && provider !== 'fish') throw new Error('missing-voice');

  if (provider === 'fish') {
    const url = operation === 'list_voices'
      ? 'https://api.fish.audio/model?self=true&page_size=100'
      : 'https://api.fish.audio/v1/tts';
    return {url, init:{
      method:operation === 'list_voices' ? 'GET' : 'POST',
      headers:{Authorization:'Bearer '+key, ...(operation === 'synthesize' ? {'Content-Type':'application/json', model:model || 's2.1-pro-free'} : {})},
      ...(operation === 'synthesize' ? {body:JSON.stringify({text, ...(voice ? {reference_id:voice} : {}), format:'mp3', normalize:true})} : {}),
    }};
  }
  if (provider === 'mossland') {
    const url = operation === 'list_voices'
      ? 'https://api.mosi.cn/v1/audio/voices?limit=200'
      : 'https://api.mosi.cn/v1/audio/speech';
    return {url, init:{
      method:operation === 'list_voices' ? 'GET' : 'POST',
      headers:{Authorization:'Bearer '+key, ...(operation === 'synthesize' ? {'Content-Type':'application/json'} : {})},
      ...(operation === 'synthesize' ? {body:JSON.stringify({model:model || 'moss-tts', input:text, voice_id:voice, response_format:'mp3', delivery_method:'audio'})} : {}),
    }};
  }
  if (provider === 'elevenlabs') {
    if (operation !== 'synthesize') throw new Error('operation-not-supported');
    return {url:'https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice), init:{
      method:'POST', headers:{'xi-api-key':key, 'Content-Type':'application/json'},
      body:JSON.stringify({text, model_id:model || 'eleven_multilingual_v2'}),
    }};
  }
  if (provider === 'hume') {
    if (operation !== 'synthesize') throw new Error('operation-not-supported');
    return {url:'https://api.hume.ai/v0/tts/file', init:{
      method:'POST', headers:{'X-Hume-Api-Key':key, 'Content-Type':'application/json'},
      body:JSON.stringify({utterances:[{text,voice:{id:voice}}],format:{type:'mp3'},num_generations:1,split_utterances:false,version:/octave-1/i.test(model)?'1':'2'}),
    }};
  }
  let minimaxBase = 'https://api.minimaxi.com';
  if (configuredBase) {
    let parsed;
    try { parsed = new URL(configuredBase); } catch (_) { throw new Error('invalid-minimax-base'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !['api.minimax.io','api.minimaxi.com'].includes(parsed.hostname) || (parsed.pathname && parsed.pathname !== '/')) throw new Error('invalid-minimax-base');
    minimaxBase = parsed.origin;
  }
  const suffix = operation === 'list_voices' ? '/v1/get_voice' : '/v1/t2a_v2';
  const url = minimaxBase+suffix+(group ? '?GroupId='+encodeURIComponent(group) : '');
  return {url, init:{
    method:'POST',
    headers:{Authorization:'Bearer '+key, 'Content-Type':'application/json'},
    body:JSON.stringify(operation === 'list_voices' ? {voice_type:'all'} : {
      model:model || 'speech-02-turbo', text, stream:false, language_boost:cleanText(input?.language_boost || 'auto', 32),
      voice_setting:{voice_id:voice, speed:Number(input?.voice_setting?.speed) || 1, vol:Number(input?.voice_setting?.vol) || 1, pitch:Number(input?.voice_setting?.pitch) || 0, ...minimaxEmotion(input?.voice_setting?.emotion)},
      audio_setting:{sample_rate:32000, bitrate:128000, format:'mp3', channel:1},
    }),
  }};
}

export function createHandler(fetchUpstream = (input, init) => fetch(input, init), timeoutMs = 20000) {
  return async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin',
    };
    if (origin === APP_ORIGIN || origin === 'null') headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status, body) => new Response(JSON.stringify(body), {status, headers});
    if (origin && origin !== APP_ORIGIN && origin !== 'null') return reply(403, {ok:false, code:'origin-not-allowed'});
    if(url.pathname.startsWith('/companion/'))return reply(410,{ok:false,code:'role-sync-relay-retired'});
    if(url.pathname.startsWith('/rest/v1/rpc/'))return friendRpcRelay(request,url,headers,fetchUpstream,timeoutMs);
    const health = url.pathname === '/health';
    const externalTts = url.pathname === EXTERNAL_TTS_PATH;
    if (externalTts) {
      if (url.search) return reply(400, {ok:false, code:'query-not-accepted'});
      if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:{...headers, 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'content-type'}});
      if (request.method !== 'POST') return reply(405, {ok:false, code:'method-not-allowed'});
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return reply(415, {ok:false, code:'json-required'});
      if (Number(request.headers.get('Content-Length')) > MAX_TTS_BODY) return reply(413, {ok:false, code:'body-too-large'});
      let target;
      try {
        const raw = await boundedBody(request, MAX_TTS_BODY);
        if (raw === null) return reply(413, {ok:false, code:'body-too-large'});
        target = externalTtsRequest(JSON.parse(raw));
      } catch (error) {
        return reply(400, {ok:false, code:String(error?.message || 'invalid-request')});
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, 190000));
      try {
        const upstream = await fetchUpstream(target.url, {...target.init, signal:controller.signal, redirect:'manual'});
        if (upstream.status >= 300 && upstream.status < 400) return reply(502, {ok:false, code:'upstream-redirect-rejected'});
        const outHeaders = {...headers, 'Content-Type':upstream.headers.get('Content-Type') || 'application/octet-stream'};
        return new Response(upstream.body, {status:upstream.status, headers:outHeaders});
      } catch (_) {
        return reply(502, {ok:false, code:controller.signal.aborted ? 'upstream-timeout' : 'upstream-unreachable'});
      } finally { clearTimeout(timer); }
    }
    if (!health && url.pathname !== '/functions/v1/phone-license') return reply(404, {ok:false, code:'not-found'});
    if (url.search) return reply(400, {ok:false, code:'query-not-accepted'});
    if (request.method === 'OPTIONS') {
      return new Response(null, {status:204, headers:{...headers, 'Access-Control-Allow-Methods':health ? 'GET, OPTIONS' : 'POST, OPTIONS', 'Access-Control-Allow-Headers':'content-type, x-admin-token'}});
    }
    if (request.method !== (health ? 'GET' : 'POST')) return reply(405, {ok:false, code:'method-not-allowed'});
    let payload = JSON.stringify({action:'session_check', sessionToken:''});
    let adminToken = '';
    if (!health) {
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return reply(415, {ok:false, code:'json-required'});
      if (Number(request.headers.get('Content-Length')) > MAX_BODY) return reply(413, {ok:false, code:'body-too-large'});
      try {
        payload = await boundedBody(request);
        if (payload === null) return reply(413, {ok:false, code:'body-too-large'});
        const input = JSON.parse(payload);
        if (!input || (!ACTIONS.has(input.action) && !ADMIN_ACTIONS.has(input.action) && !ADMIN_PUBLIC_ACTIONS.has(input.action))) return reply(403, {ok:false, code:'action-not-allowed'});
        if (ADMIN_ACTIONS.has(input.action)) {
          adminToken = cleanText(request.headers.get('x-admin-token'), 240);
          if (!adminToken) return reply(401, {ok:false, code:'admin-token-required', error:'请输入管理员凭证'});
        }
      } catch (_) { return reply(400, {ok:false, code:'invalid-json'}); }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Preserve the original body and device label. Admin credentials are forwarded only for the fixed admin allowlist.
      const upstream = await fetchUpstream(UPSTREAM, {
        method:'POST',
        headers:{'Content-Type':'application/json', Origin:APP_ORIGIN, ...(!health ? {'User-Agent':request.headers.get('User-Agent') || ''} : {}), ...(adminToken ? {'x-admin-token':adminToken} : {})},
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
