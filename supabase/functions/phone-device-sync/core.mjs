// PRIVATE_DEVICE_SYNC_V1. Native-only private account journal; never writes legacy backups.
const utf8 = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const revision = /^(0|[1-9][0-9]{0,18})$/;
const LIMIT = Object.freeze({body: 3_000_000, record: 240_000, changes: 64});
const knownErrors = new Set(['device_revoked','device_revoked_or_unknown','device_not_found','invalid_device',
  'mutation_payload_changed','conflict_not_found','duplicate_key','invalid_batch','invalid_change','invalid_cursor',
  'invalid_seed','empty_seed','seed_requires_phone','seed_in_progress','seed_not_ready','invalid_turn','turn_lease_lost',
  'primary_required','primary_changed','cannot_revoke_primary']);
class SyncError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
function ensure(condition, code = 'invalid_request', status = 400) {
  if (!condition) throw new SyncError(code, status);
}
function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, '');
}
function unbase64(s) {
  ensure(typeof s === 'string' && /^[A-Za-z0-9_-]+$/.test(s), 'invalid_envelope');
  try { return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/') + '='.repeat((4-s.length%4)%4)), c=>c.charCodeAt(0)); }
  catch { throw new SyncError('invalid_envelope'); }
}
function canonical(value) {
  let nodes = 0;
  function visit(x, depth) {
    ensure(++nodes <= 50000 && depth <= 64, 'record_too_complex', 413);
    if (x === null || typeof x === 'string' || typeof x === 'boolean') return JSON.stringify(x);
    if (typeof x === 'number') { ensure(Number.isFinite(x)); return JSON.stringify(x); }
    if (Array.isArray(x)) return '['+x.map(v=>visit(v,depth+1)).join(',')+']';
    ensure(typeof x === 'object');
    return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+visit(x[k],depth+1)).join(',')+'}';
  }
  return visit(value, 0);
}
async function boundedJSON(request) {
  ensure(request.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'json_required', 415);
  const reader = request.body?.getReader();
  ensure(reader, 'invalid_request');
  const chunks = []; let count = 0;
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      count += value.byteLength;
      if (count > LIMIT.body) { await reader.cancel(); throw new SyncError('request_too_large', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(count); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
  catch { throw new SyncError('invalid_json'); }
}
function keyName(key) {
  // Device permissions and MCP secrets use separate protocols, never a state record.
  ensure(typeof key === 'string' && /^(state|blob)\/[A-Za-z0-9_./:%-]+$/.test(key)
    && utf8.encode(key).length <= 512 && !key.split('/').some(k=>['__proto__','constructor','prototype'].includes(k)), 'invalid_record_key');
  return key;
}
function generationKey(key){return keyName(key.replace(/^(state|blob)\//,'$1/sync2/'));}
function logicalKey(key){ensure(/^(state|blob)\/sync2\//.test(key),'sync_generation_mismatch',409);return key.replace(/^(state|blob)\/sync2\//,'$1/');}
function cursor(value = '0') {
  ensure(typeof value === 'string' && revision.test(value) && BigInt(value) <= 9223372036854775807n, 'invalid_cursor');
  return value;
}
export function createAccountCipher({store, masterKey, cryptoAPI = globalThis.crypto}) {
  // No persistent DEK cache: account keys are never retained between requests or exposed to clients.
  const importAES = bytes => cryptoAPI.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt','decrypt']);
  async function seal(key, text, aad) {
    const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
    const bytes = await cryptoAPI.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8.encode(aad),tagLength:128}, key, utf8.encode(text));
    return 'v1.'+base64(iv)+'.'+base64(new Uint8Array(bytes));
  }
  async function open(key, envelope, aad, maximum=360000) {
    ensure(typeof envelope === 'string' && envelope.length <= maximum, 'invalid_envelope');
    const [version, ivText, cipherText, extra] = envelope.split('.');
    ensure(version === 'v1' && !extra && ivText && cipherText, 'invalid_envelope');
    const iv = unbase64(ivText); ensure(iv.length === 12, 'invalid_envelope');
    try {
      const bytes = await cryptoAPI.subtle.decrypt({name:'AES-GCM',iv,additionalData:utf8.encode(aad),tagLength:128},key,unbase64(cipherText));
      return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    } catch { throw new SyncError('encrypted_data_unreadable', 409); }
  }
  async function accountKeys(owner) {
    let root;
    try { const raw = unbase64(masterKey); ensure(raw.length === 32); root = await importAES(raw); }
    catch { throw new SyncError('sync_not_configured', 503); }
    const candidate = await seal(root, base64(cryptoAPI.getRandomValues(new Uint8Array(32))), 'private-phone-sync/key/'+owner);
    const wrapped = await store.key(owner, candidate);
    const raw = unbase64(await open(root, wrapped, 'private-phone-sync/key/'+owner));
    ensure(raw.length === 32, 'encrypted_data_unreadable', 409);
    const material = await cryptoAPI.subtle.importKey('raw',raw,'HKDF',false,['deriveKey']);
    raw.fill(0);
    const derive = info=>({name:'HKDF',hash:'SHA-256',salt:utf8.encode(owner),info:utf8.encode(info)});
    const aes = await cryptoAPI.subtle.deriveKey(derive('private-phone-state-encryption-v1'),material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const mac = await cryptoAPI.subtle.deriveKey(derive('private-phone-mutation-digest-v1'),material,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify']);
    return {aes,mac};
  }
  return {accountKeys,seal,open};
}
export function createSyncHandler({store, authenticate, verifyPassword, masterKey, cryptoAPI = globalThis.crypto}) {
  const {accountKeys,seal,open}=createAccountCipher({store,masterKey,cryptoAPI});
  async function unpack(owner, aes, row) {
    const {ciphertext, ...safe} = row;
    return {...safe,key:logicalKey(row.key), ...(row.deleted ? {} : {value: JSON.parse(await open(aes,ciphertext,'private-phone-sync/record/'+owner+'/'+keyName(row.key)))})};
  }
  return async function handle(request) {
    try {
      ensure(request.method === 'POST', 'method_not_allowed', 405);
      // Browser/provider frames must not obtain native account data through this endpoint.
      ensure(!request.headers.has('origin'), 'native_client_required', 403);
      const auth = request.headers.get('authorization') || '';
      ensure(/^Bearer [A-Za-z0-9_.-]{1,8192}$/.test(auth), 'authentication_required', 401);
      const identity = await authenticate(auth.slice(7));
      ensure(identity && uuid.test(identity.userID) && uuid.test(identity.sessionID), 'authentication_required', 401);
      const body = await boundedJSON(request);
      ensure(body && !Array.isArray(body) && typeof body === 'object');
      ensure(body.protocolVersion===2,'sync_upgrade_required',409);
      const {userID:owner,sessionID:session} = identity;
      if (body.action === 'register') {
        ensure(['iOS','macOS'].includes(body.platform) && typeof body.label === 'string'
          && body.label.trim().length > 0 && body.label.length <= 80, 'invalid_device');
        ensure(body.installationId===undefined || uuid.test(body.installationId),'invalid_device');
        const device = await store.rpc('private_phone_sync_device', {p_user:owner,p_session:session,p_platform:body.platform,p_label:body.label.trim(),p_installation:body.installationId||null});
        return respond({ok:true,device});
      }
      ensure(uuid.test(body.deviceId || ''), 'invalid_device');
      const scope = {p_user:owner,p_session:session,p_device:body.deviceId};
      // Recheck even read-only key access; final transactional RPC checks again after encryption.
      await store.rpc('private_phone_sync_assert_device',scope);
      if (body.action === 'primary') {
        const expected=cursor(body.primaryRevision);
        ensure(typeof body.password==='string'&&body.password.length>=8&&body.password.length<=72,'password_verification_failed',403);
        ensure(typeof verifyPassword==='function','password_verification_unavailable',503);
        ensure(await verifyPassword(identity,body.password)===true,'password_verification_failed',403);
        // Rechecks the device and authority under the account lock after password I/O.
        return respond(await store.rpc('private_phone_sync_promote',{...scope,p_expected:expected}));
      }
      if (body.action === 'revoke') {
        ensure(uuid.test(body.targetId || ''), 'invalid_device');
        return respond(await store.rpc('private_phone_sync_revoke',{...scope,p_target:body.targetId}));
      }
      if (body.action === 'inspect') {
        const info=await store.rpc('private_phone_sync_inspect',scope);
        return respond({ok:true,...info,conflicts:(info.conflicts||[]).filter(row=>/^(state|blob)\/sync2\//.test(row.key)).map(row=>({...row,key:logicalKey(row.key)})),
          seed:await store.rpc('private_phone_sync_v2_status',scope),...await store.rpc('private_phone_sync_authority',scope)});
      }
      if (['turn.acquire','turn.renew','turn.finish'].includes(body.action)) {
        ensure(typeof body.threadKey==='string' && body.threadKey.length>0 && body.threadKey.length<=160
          && typeof body.turnKey==='string' && body.turnKey.length>0 && body.turnKey.length<=240 && uuid.test(body.leaseToken||''),'invalid_turn');
        return respond(await store.rpc('private_phone_sync_turn',{...scope,p_action:body.action.slice(5),p_thread:body.threadKey,
          p_turn:body.turnKey,p_token:body.leaseToken,p_complete:body.completed===true}));
      }
      if (body.action === 'seed') {
        ensure(typeof body.finish === 'boolean','invalid_seed');
        return respond({ok:true,seed:await store.rpc('private_phone_sync_v2_seed',{...scope,p_finish:body.finish})});
      }
      ensure(['push','pull','conflict','resolve','media.put','media.get'].includes(body.action), 'unsupported_action');
      // Validate all plain data before obtaining/encrypting account keys.
      let changes;
      if (body.action === 'push') {
        ensure(Array.isArray(body.changes) && body.changes.length <= LIMIT.changes, 'invalid_batch');
        const ids = new Set(), keys = new Set();
        changes = body.changes.map(item=>{
          ensure(item && typeof item === 'object' && !Array.isArray(item), 'invalid_change');
          const key = generationKey(keyName(item.key)), base = cursor(item.baseRevision);
          ensure(uuid.test(item.mutationId || '') && !ids.has(item.mutationId) && !keys.has(key), 'duplicate_change');
          ids.add(item.mutationId); keys.add(key);
          ensure(typeof item.deleted === 'boolean', 'invalid_change');
          const data = canonical(item.deleted ? null : item.value);
          ensure(utf8.encode(data).length <= LIMIT.record, 'record_too_large', 413);
          return {key,baseRevision:base,mutationId:item.mutationId,deleted:item.deleted,data};
        });
      } else if (body.action.startsWith('media.')) {
        ensure(typeof body.hash === 'string' && /^[a-f0-9]{64}$/.test(body.hash), 'invalid_media');
        if (body.action === 'media.put') ensure(typeof body.base64 === 'string' && body.base64.length <= 1_398_104, 'invalid_media');
      } else if (body.action === 'pull') cursor(body.cursor);
      else {
        ensure(uuid.test(body.conflictId || ''), 'invalid_conflict');
        if (body.action === 'resolve') {
          ensure(['server','candidate'].includes(body.choice) && uuid.test(body.mutationId || ''), 'invalid_change');
          cursor(body.baseRevision);
        }
      }
      const {aes,mac} = await accountKeys(owner);
      if (body.action.startsWith('media.')) {
        const digest = base64(new Uint8Array(await cryptoAPI.subtle.sign('HMAC',mac,utf8.encode('media/'+body.hash))));
        const object = owner+'/device-sync/'+digest+'.bin',aad = utf8.encode('private-phone-sync/media/'+owner+'/'+body.hash);
        async function verify(bytes) {
          ensure(bytes.length <= 1048576, 'media_too_large',413);
          const hash = Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
          ensure(hash === body.hash, 'media_integrity_failed',409);
        }
        if (body.action === 'media.put') {
          const bytes = unbase64(body.base64); await verify(bytes);
          const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
          const ciphertext = new Uint8Array(await cryptoAPI.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},aes,bytes));
          const packed = new Uint8Array(12+ciphertext.length);packed.set(iv);packed.set(ciphertext,12);
          await store.putBlob(object,packed);
          await store.rpc('private_phone_sync_assert_device',scope);
          return respond({ok:true,hash:body.hash,bytes:bytes.length});
        }
        const packed = await store.getBlob(object);
        ensure(packed.length >= 28 && packed.length <= 1048604, 'encrypted_data_unreadable',409);
        let bytes;
        try { bytes = new Uint8Array(await cryptoAPI.subtle.decrypt({name:'AES-GCM',iv:packed.slice(0,12),additionalData:aad,tagLength:128},aes,packed.slice(12))); }
        catch { throw new SyncError('encrypted_data_unreadable',409); }
        await verify(bytes);
        await store.rpc('private_phone_sync_assert_device',scope);
        return respond({ok:true,hash:body.hash,base64:base64(bytes),bytes:bytes.length});
      }
      if (changes) {
        ensure(await store.rpc('private_phone_sync_v2_status',scope),'seed_not_ready',409);
        const encrypted = [];
        for (const item of changes) {
          const digest = base64(new Uint8Array(await cryptoAPI.subtle.sign('HMAC',mac,utf8.encode(canonical(item)))));
          const {data,...meta} = item;
          encrypted.push({...meta,digest,ciphertext:item.deleted ? null : await seal(aes,data,'private-phone-sync/record/'+owner+'/'+item.key)});
        }
        const result=await store.rpc('private_phone_sync_apply',{...scope,p_changes:encrypted});
        return respond({ok:true,...result,outcomes:result.outcomes.map(row=>({...row,key:logicalKey(row.key)}))});
      }
      if (body.action === 'pull') {
        const result = await store.rpc('private_phone_sync_v2_pull',{...scope,p_after:cursor(body.cursor)});
        const records = [];
        for (const row of result.records) records.push(await unpack(owner,aes,row));
        return respond({ok:true,records,cursor:result.cursor,more:result.more,seed:result.seed});
      }
      let detail = await store.rpc('private_phone_sync_inspect',{...scope,p_conflict:body.conflictId});
      if (body.action === 'resolve') {
        const digest = base64(new Uint8Array(await cryptoAPI.subtle.sign('HMAC',mac,utf8.encode(canonical({
          conflictId:body.conflictId,choice:body.choice,baseRevision:cursor(body.baseRevision),mutationId:body.mutationId
        })))));
        const outcome = await store.rpc('private_phone_sync_resolve',{...scope,p_conflict:body.conflictId,
          p_choice:body.choice,p_revision:cursor(body.baseRevision),p_mutation:body.mutationId,p_digest:digest});
        detail = await store.rpc('private_phone_sync_inspect',{...scope,p_conflict:body.conflictId});
        return respond({...outcome,conflict:await unpack(owner,aes,detail.conflict),current:await unpack(owner,aes,detail.current)});
      }
      let conflict=await unpack(owner,aes,detail.conflict),current=await unpack(owner,aes,detail.current);
      // PRIVATE_SYNC_IDENTICAL_CONFLICT_V1: ciphertexts are randomized, so only
      // decrypted, canonical exact equality can reconcile a duplicate mutation.
      // A changed current revision remains a conflict; never guess which differs.
      if(!conflict.resolvedAt&&conflict.key===current.key&&conflict.deleted===current.deleted
          &&canonical(conflict.deleted?null:conflict.value)===canonical(current.deleted?null:current.value)){
        const mutationId=cryptoAPI.randomUUID(),baseRevision=cursor(current.revision);
        const digest=base64(new Uint8Array(await cryptoAPI.subtle.sign('HMAC',mac,utf8.encode(canonical({
          conflictId:body.conflictId,choice:'server',baseRevision,mutationId
        })))));
        let concurrentResolution;
        try{await store.rpc('private_phone_sync_resolve',{...scope,p_conflict:body.conflictId,
          p_choice:'server',p_revision:baseRevision,p_mutation:mutationId,p_digest:digest});}
        catch(error){if(error?.message!=='mutation_payload_changed')throw error;concurrentResolution=error;}
        detail=await store.rpc('private_phone_sync_inspect',{...scope,p_conflict:body.conflictId});
        conflict=await unpack(owner,aes,detail.conflict);current=await unpack(owner,aes,detail.current);
        if(concurrentResolution&&!conflict.resolvedAt)throw concurrentResolution;
      }
      return respond({ok:true,conflict,current});
    } catch (error) {
      const safe = error instanceof SyncError ? error : new SyncError(knownErrors.has(error?.message) ? error.message : 'sync_service_unavailable',503);
      return respond({ok:false,error:safe.message},safe.status);
    }
  };
}
function respond(body, status = 200) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}

export function createSupabaseSync({url, serviceKey, masterKey, fetchAPI = globalThis.fetch}) {
  const base = new URL(url);
  ensure(base.protocol === 'https:' && /^[a-z0-9]+\.supabase\.co$/.test(base.hostname) && !base.username && !base.password, 'sync_not_configured',503);
  return async request=>{
    const signal = AbortSignal.timeout(40000);
    async function json(path, {method='GET',body,bearer=serviceKey,prefer}={}) {
      const headers = {'apikey':serviceKey,'Authorization':'Bearer '+bearer,'Content-Type':'application/json'};
      if (prefer) headers.Prefer = prefer;
      const response = await fetchAPI(new URL(path,base),{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal});
      const text = await response.text();
      ensure(text.length <= 2_000_000, 'sync_service_unavailable',503);
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { throw new SyncError('sync_service_unavailable',503); }
      if (!response.ok) {
        if (knownErrors.has(data?.message)) throw new SyncError(data.message,409);
        throw new SyncError(path.startsWith('/auth/')?'authentication_required':'sync_service_unavailable',path.startsWith('/auth/')?401:503);
      }
      return data;
    }
    const store = {
      rpc:(name,args)=>json('/rest/v1/rpc/'+name,{method:'POST',body:args}),
      async key(owner,candidate) {
        const path = '/rest/v1/private_phone_sync_keys?select=wrapped_key,key_version&user_id=eq.'+owner+'&limit=1';
        const existing = await json(path);
        if (existing?.length === 1) {
          ensure(existing[0].key_version === 1,'sync_not_configured',503);
          return existing[0].wrapped_key;
        }
        await json('/rest/v1/private_phone_sync_keys?on_conflict=user_id',{method:'POST',
          body:{user_id:owner,wrapped_key:candidate,key_version:1},prefer:'resolution=ignore-duplicates,return=minimal'});
        const rows = await json(path);
        ensure(rows?.length === 1 && rows[0].key_version === 1, 'sync_not_configured',503);
        return rows[0].wrapped_key;
      },
      async putBlob(object,bytes) {
        const response = await fetchAPI(new URL('/storage/v1/object/private-phone-backups/'+object,base),{method:'POST',
          headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/octet-stream','x-upsert':'false'},
          body:bytes,redirect:'error',signal});
        if (response.ok) { await response.body?.cancel(); return; }
        const info = await response.json().catch(()=>null);
        ensure(response.status===409 || info?.statusCode==='409' || info?.error==='Duplicate','media_upload_unavailable',503);
      },
      async getBlob(object) {
        const response = await fetchAPI(new URL('/storage/v1/object/authenticated/private-phone-backups/'+object,base),{
          headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey},redirect:'error',signal});
        ensure(response.ok,'media_unavailable',response.status===404?404:503);
        const bytes = new Uint8Array(await response.arrayBuffer());
        ensure(bytes.length <= 1048604,'encrypted_data_unreadable',409);
        return bytes;
      }
    };
    async function authenticate(token) {
      const user = await json('/auth/v1/user',{bearer:token});
      let claims;
      try { claims = JSON.parse(new TextDecoder().decode(unbase64(token.split('.')[1]))); }
      catch { throw new SyncError('authentication_required',401); }
      ensure(user?.id === claims.sub && claims.role === 'authenticated' && Number(claims.exp)>Date.now()/1000, 'authentication_required',401);
      return {userID:user.id,sessionID:claims.session_id,email:user.email};
    }
    async function verifyPassword(identity,password) {
      ensure(typeof identity.email==='string'&&identity.email.length<=320,'password_verification_unavailable',503);
      let temporary;
      try {
        temporary=await json('/auth/v1/token?grant_type=password',{method:'POST',body:{email:identity.email,password}});
        ensure(temporary?.user?.id===identity.userID&&typeof temporary?.access_token==='string','password_verification_failed',403);
        return true;
      } catch(error) {
        if(error?.message==='authentication_required')throw new SyncError('password_verification_failed',403);
        throw error;
      } finally {
        // Do not replace the device session or retain the verification-only session.
        if(typeof temporary?.access_token==='string')await json('/auth/v1/logout?scope=local',{
          method:'POST',bearer:temporary.access_token}).catch(()=>{});
      }
    }
    return createSyncHandler({store,authenticate,verifyPassword,masterKey})(request);
  };
}
