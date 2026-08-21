(function () {
  'use strict';

  const SESSION_KEY = 'north_license_session_v1';
  const MANAGED_KEY = 'north_license_managed_v1';
  const META_KEY = 'north_license_meta_v1';
  const LEGACY_DEVICE_KEY = 'north_license_legacy_device_v1';
  const LAST_ENDPOINT_KEY = 'north_license_last_endpoint_v1';
  let config = { baseUrl: '', apiKey: '', epoch: 0, endpoints: [] };
  let lastEndpointId = '';

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }

  function randomToken(bytes) {
    const data = new Uint8Array(bytes || 32);
    try { crypto.getRandomValues(data); } catch (_) {
      for (let i = 0; i < data.length; i += 1) data[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(data, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  function session() {
    const value = readJSON(SESSION_KEY);
    return value && value.token && value.licenseId ? value : null;
  }

  function meta() {
    return readJSON(META_KEY) || {};
  }

  function isManaged() {
    try { return localStorage.getItem(MANAGED_KEY) === String(config.epoch); } catch (_) { return false; }
  }

  function isPrivateApp() {
    return window.__SMALL_PHONE_PRIVATE__ === true;
  }

  function saveSession(value, extra, endpointId) {
    if (!value || !value.token || !value.licenseId) throw new Error('服务器没有返回完整授权');
    const saved = {
      token: String(value.token),
      licenseId: String(value.licenseId),
      sessionId: String(value.sessionId || ''),
      endpointId: String(endpointId || value.endpointId || lastEndpointId || (session() && session().endpointId) || ''),
      savedAt: Date.now(),
    };
    if (!writeJSON(SESSION_KEY, saved)) throw new Error(isPrivateApp() ? 'App 无法保存授权，请检查手机存储空间' : '浏览器无法保存授权，请检查无痕模式');
    try { if (saved.endpointId) localStorage.setItem(LAST_ENDPOINT_KEY, saved.endpointId); } catch (_) {}
    try { localStorage.setItem(MANAGED_KEY, String(config.epoch)); } catch (_) {}
    if (extra) writeJSON(META_KEY, Object.assign({}, meta(), extra, { checkedAt: Date.now() }));
    return saved;
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(MANAGED_KEY);
      localStorage.removeItem(META_KEY);
    } catch (_) {}
  }

  function deviceLabel() {
    const ua = navigator.userAgent || '';
    if (isPrivateApp()) return /iPad/i.test(ua) ? 'iPad · 私人App' : 'iPhone · 私人App';
    const standalone = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || !!navigator.standalone;
    let device = /iPhone/i.test(ua) ? 'iPhone' : /iPad/i.test(ua) ? 'iPad' : /Android/i.test(ua) ? '安卓手机' : '手机';
    let browser = /MicroMessenger/i.test(ua) ? '微信浏览器' : /EdgiOS|EdgA|Edg\//i.test(ua) ? 'Edge' : /CriOS|Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : '浏览器';
    if (standalone) browser = '主屏幕';
    return device + ' · ' + browser;
  }

  function supportsPasskey() {
    return !!(window.isSecureContext && window.PublicKeyCredential && navigator.credentials);
  }

  function b64urlToBuffer(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function bufferToB64url(value) {
    if (value == null) return null;
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function creationOptions(options) {
    const value = Object.assign({}, options);
    value.challenge = b64urlToBuffer(value.challenge);
    value.user = Object.assign({}, value.user, { id: b64urlToBuffer(value.user.id) });
    value.excludeCredentials = (value.excludeCredentials || []).map((item) => Object.assign({}, item, {
      id: b64urlToBuffer(item.id),
    }));
    return value;
  }

  function requestOptions(options) {
    const value = Object.assign({}, options);
    value.challenge = b64urlToBuffer(value.challenge);
    value.allowCredentials = (value.allowCredentials || []).map((item) => Object.assign({}, item, {
      id: b64urlToBuffer(item.id),
    }));
    return value;
  }

  function registrationCredentialJSON(credential) {
    const response = credential.response;
    const result = {
      id: credential.id,
      rawId: bufferToB64url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
      response: {
        clientDataJSON: bufferToB64url(response.clientDataJSON),
        attestationObject: bufferToB64url(response.attestationObject),
        transports: response.getTransports ? response.getTransports() : [],
      },
    };
    if (response.getPublicKey) {
      const publicKey = response.getPublicKey();
      if (publicKey) result.response.publicKey = bufferToB64url(publicKey);
    }
    if (response.getPublicKeyAlgorithm) result.response.publicKeyAlgorithm = response.getPublicKeyAlgorithm();
    return result;
  }

  function authenticationCredentialJSON(credential) {
    const response = credential.response;
    return {
      id: credential.id,
      rawId: bufferToB64url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
      response: {
        clientDataJSON: bufferToB64url(response.clientDataJSON),
        authenticatorData: bufferToB64url(response.authenticatorData),
        signature: bufferToB64url(response.signature),
        userHandle: response.userHandle ? bufferToB64url(response.userHandle) : null,
      },
    };
  }

  function licenseEndpoints(action, body) {
    const configured = Array.isArray(config.endpoints) && config.endpoints.length
      ? config.endpoints
      : [{ id: 'primary', baseUrl: config.baseUrl, apiKey: config.apiKey }];
    const seen = new Set();
    const endpoints = configured.map((item, index) => ({
      id: String(item && item.id || (index ? 'failover-' + index : 'primary')),
      baseUrl: String(item && item.baseUrl || ''),
      apiKey: String(item && item.apiKey || ''),
    })).filter((item) => {
      const key = item.baseUrl.replace(/\/+$/, '');
      if (!key || !item.apiKey || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (action === 'activate' && /^YB2-/i.test(String(body && body.inviteCode || '').replace(/\s+/g, ''))) {
      const isolated = endpoints.filter((endpoint) => endpoint.id === 'license-failover');
      return isolated.length ? isolated : endpoints;
    }
    const current = session();
    let preferredId = current && current.endpointId || '';
    if (!preferredId && ['restore_options', 'restore_verify'].includes(action)) {
      try { preferredId = localStorage.getItem(LAST_ENDPOINT_KEY) || ''; } catch (_) {}
    }
    if (!preferredId || ['activate', 'legacy_activate'].includes(action)) return endpoints;
    return endpoints.slice().sort((left, right) =>
      Number(right.id === preferredId) - Number(left.id === preferredId));
  }

  function rememberSessionEndpoint(endpointId, body) {
    const current = session();
    if (!current || !endpointId || current.endpointId === endpointId) return;
    if (body && body.sessionToken && String(body.sessionToken) !== current.token) return;
    writeJSON(SESSION_KEY, Object.assign({}, current, { endpointId: String(endpointId) }));
  }

  function retryableLicenseError(error) {
    const status = Number(error && error.status || 0);
    return !!(error && error.network) || status === 0 || status === 408 || status === 425 || status === 429 || status >= 500
      || ((status === 401 || status === 403) && !(error && error.code));
  }

  async function requestEndpoint(endpoint, action, body, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 25000);
    let response;
    let nativeResult = null;
    try {
      if (window.SmallPhoneNative && location.protocol === 'file:') {
        nativeResult = await window.SmallPhoneNative.request('license.request', {
          baseUrl: endpoint.baseUrl,
          apiKey: endpoint.apiKey,
          action: action,
          body: body || {},
          timeoutMs: timeoutMs || 25000,
        });
      } else {
        response = await fetch(endpoint.baseUrl.replace(/\/+$/, '') + '/functions/v1/phone-license', {
          method: 'POST',
          headers: {
            apikey: endpoint.apiKey,
            Authorization: 'Bearer ' + endpoint.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(Object.assign({ action: action }, body || {})),
          signal: controller.signal,
        });
      }
    } catch (error) {
      const out = new Error(error && error.name === 'AbortError' ? '授权服务器响应超时' : '连不上授权服务器，请检查网络');
      out.network = true;
      out.endpointId = endpoint.id;
      throw out;
    } finally {
      clearTimeout(timer);
    }
    let payload = nativeResult && nativeResult.payload || null;
    let status = nativeResult && Number(nativeResult.status) || 0;
    if (!nativeResult) {
      status = response.status;
      try { payload = await response.json(); } catch (_) {}
    }
    if (status < 200 || status >= 300 || !payload || payload.ok !== true) {
      const out = new Error((payload && payload.error) || ('授权服务器异常(' + status + ')'));
      out.status = status;
      out.server = true;
      out.endpointId = endpoint.id;
      out.code = String(payload && payload.code || '');
      const permanentCodes = new Set([
        'license-session-invalid',
        'license-admin-blocked',
        'license-not-found',
        'license-local-identity-invalid',
      ]);
      // API gateways may emit a bare or synthetic 401 during an outage. Only
      // a signed license response with one of our explicit terminal codes may
      // remove a local session.
      out.permanent = !!(payload && payload.permanent) && permanentCodes.has(out.code);
      throw out;
    }
    lastEndpointId = endpoint.id;
    rememberSessionEndpoint(endpoint.id, body || {});
    return payload;
  }

  async function api(action, body, timeoutMs) {
    const endpoints = licenseEndpoints(action, body);
    if (!endpoints.length) throw new Error('授权服务尚未配置');
    let firstTemporary = null;
    let firstPermanent = null;
    let lastError = null;
    for (let index = 0; index < endpoints.length; index += 1) {
      try {
        return await requestEndpoint(endpoints[index], action, body, timeoutMs);
      } catch (error) {
        lastError = error;
        const temporary = retryableLicenseError(error);
        if (temporary && !firstTemporary) firstTemporary = error;
        if (error && error.permanent && !firstPermanent) firstPermanent = error;
        const mayBelongToAnotherBackend = !!(body && body.sessionToken) || ['restore_options', 'restore_verify'].includes(action);
        const shouldTryNext = index + 1 < endpoints.length && (temporary || (mayBelongToAnotherBackend && error && error.permanent));
        if (!shouldTryNext) {
          if (index + 1 >= endpoints.length && firstTemporary && !temporary) throw firstTemporary;
          throw error;
        }
      }
    }
    // If the preferred backend was unavailable and the standby has not caught
    // up yet, keep the outage error. Never turn that situation into a false
    // "invalid session/invite" result that could remove a valid local grant.
    if (firstTemporary) throw firstTemporary;
    if (firstPermanent) throw firstPermanent;
    throw lastError || new Error('授权服务暂时不可用');
  }

  async function activate(inviteCode) {
    const result = await api('activate', { inviteCode: inviteCode, deviceLabel: deviceLabel() });
    saveSession(result.session, { sessionCount: 1, passkeyCount: 0 });
    return result;
  }

  async function legacyActivate() {
    let legacyToken = '';
    try { legacyToken = localStorage.getItem(LEGACY_DEVICE_KEY) || ''; } catch (_) {}
    if (!legacyToken) {
      legacyToken = randomToken(32);
      try { localStorage.setItem(LEGACY_DEVICE_KEY, legacyToken); } catch (_) {}
    }
    const result = await api('legacy_activate', {
      legacyDeviceToken: legacyToken,
      legacyEpoch: config.epoch,
      deviceLabel: deviceLabel(),
    });
    saveSession(result.session, { sessionCount: result.session.activeCount || 1, passkeyCount: 0 });
    return result;
  }

  async function bindPasskey() {
    if (!supportsPasskey()) throw new Error(isPrivateApp() ? '当前 App 无法调用系统扫脸/指纹，请检查系统设置' : '当前浏览器不支持系统扫脸/指纹，不能恢复设备授权');
    const current = session();
    if (!current) throw new Error(isPrivateApp() ? '请先在当前 App 完成授权' : '请先在当前浏览器完成授权');
    const start = await api('register_options', { sessionToken: current.token });
    let credential;
    try {
      credential = await navigator.credentials.create({ publicKey: creationOptions(start.options) });
    } catch (error) {
      if (error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) throw new Error('已取消手机绑定');
      if (error && error.name === 'InvalidStateError') {
        writeJSON(META_KEY, Object.assign({}, meta(), { passkeyCount: Math.max(1, Number(meta().passkeyCount) || 0), checkedAt: Date.now() }));
        return { ok: true, alreadyBound: true, passkeyCount: Math.max(1, Number(meta().passkeyCount) || 0) };
      }
      if (error && error.name === 'SecurityError') throw new Error('当前打开地址与手机验证绑定域名不一致，请从原来的官方网址进入后重试');
      if (error && error.name === 'NotSupportedError') throw new Error(isPrivateApp() ? '当前 App 暂不支持系统手机验证，请更新安装包后重试' : '当前浏览器不支持系统手机验证，请使用 Safari 或 Chrome');
      throw new Error(isPrivateApp() ? '系统手机验证失败，请稍后重试' : '系统手机验证失败，请换Safari或Chrome重试');
    }
    if (!credential) throw new Error('系统没有返回手机验证结果');
    const result = await api('register_verify', {
      sessionToken: current.token,
      challengeId: start.challengeId,
      credential: registrationCredentialJSON(credential),
      deviceLabel: deviceLabel(),
    });
    if (result.session) saveSession(result.session, { passkeyCount: Math.max(1, result.passkeyCount || 1) });
    else writeJSON(META_KEY, Object.assign({}, meta(), { passkeyCount: 1, checkedAt: Date.now() }));
    return result;
  }

  async function restorePasskey() {
    if (!supportsPasskey()) throw new Error(isPrivateApp() ? '当前 App 无法调用系统扫脸/指纹，请检查系统设置' : '当前浏览器不支持系统扫脸/指纹，不能恢复设备授权');
    const endpoints = licenseEndpoints('restore_options', {});
    if (!endpoints.length) throw new Error('授权服务尚未配置');
    let endpoint = null;
    let start = null;
    let startError = null;
    for (const candidate of endpoints) {
      try {
        start = await requestEndpoint(candidate, 'restore_options', {}, 25000);
        endpoint = candidate;
        break;
      } catch (error) {
        startError = error;
        if (!retryableLicenseError(error)) break;
      }
    }
    if (!start || !endpoint) throw startError || new Error('授权服务暂时不可用');
    let credential;
    try {
      credential = await navigator.credentials.get({ publicKey: requestOptions(start.options) });
    } catch (error) {
      if (error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) throw new Error('已取消恢复授权');
      throw new Error(isPrivateApp() ? '系统恢复验证失败，请稍后重试' : '系统恢复验证失败，请换Safari或Chrome重试');
    }
    if (!credential) throw new Error('系统没有返回恢复结果');
    const result = await requestEndpoint(endpoint, 'restore_verify', {
      challengeId: start.challengeId,
      credential: authenticationCredentialJSON(credential),
      deviceLabel: deviceLabel(),
    }, 25000);
    saveSession(result.session, {
      sessionCount: result.session.activeCount || 1,
      passkeyCount: 1,
      evicted: result.session.evicted || [],
    }, endpoint.id);
    return result;
  }

  async function retirePreviousSession(previous, result) {
    if (!previous || !previous.token || !previous.sessionId || !result || !result.session) return result;
    if (previous.sessionId !== result.session.sessionId) {
      try {
        await api('session_revoke', {
          sessionToken: previous.token,
          targetSessionId: previous.sessionId,
        });
      } catch (_) {}
    }
    try {
      const status = await check();
      result.session.activeCount = status.sessionCount || 1;
    } catch (_) {}
    return result;
  }

  async function relinkPasskey() {
    const previous = session();
    const result = await restorePasskey();
    return retirePreviousSession(previous, result);
  }

  async function check() {
    const current = session();
    if (!current) throw new Error(isPrivateApp() ? '当前 App 还没有授权' : '本浏览器还没有授权');
    const result = await api('session_check', { sessionToken: current.token }, 15000);
    writeJSON(META_KEY, Object.assign({}, meta(), result, { checkedAt: Date.now() }));
    return result;
  }

  async function listSessions() {
    const current = session();
    if (!current) throw new Error(isPrivateApp() ? '当前 App 还没有授权' : '本浏览器还没有授权');
    const result = await api('session_list', { sessionToken: current.token });
    writeJSON(META_KEY, Object.assign({}, meta(), {
      sessionCount: Array.isArray(result.sessions) ? result.sessions.length : 0,
      checkedAt: Date.now(),
    }));
    return result;
  }

  async function revokeSession(targetSessionId) {
    const current = session();
    if (!current) throw new Error(isPrivateApp() ? '当前 App 还没有授权' : '本浏览器还没有授权');
    const result = await api('session_revoke', {
      sessionToken: current.token,
      targetSessionId: targetSessionId,
    });
    if (result.revokedCurrent) clearSession();
    return result;
  }

  async function syncAIIdentity(userId, clientSecret) {
    const current = session();
    if (!current) throw new Error(isPrivateApp() ? '当前 App 还没有授权' : '本浏览器还没有授权');
    return api('ai_identity_sync', {
      sessionToken: current.token,
      userId: userId,
      clientSecret: clientSecret,
    });
  }

  async function syncPhoneFriendIdentity(phoneFriendId, phoneFriendSecret) {
    const current = session();
    if (!current) throw new Error(isPrivateApp() ? '当前 App 还没有授权' : '本浏览器还没有授权');
    return api('phone_friend_identity_sync', {
      sessionToken: current.token,
      phoneFriendId: phoneFriendId,
      phoneFriendSecret: phoneFriendSecret,
    });
  }

  function init(nextConfig) {
    config = Object.assign({}, config, nextConfig || {});
    if (!Array.isArray(config.endpoints) || !config.endpoints.length) {
      config.endpoints = [{ id: 'primary', baseUrl: config.baseUrl, apiKey: config.apiKey }];
    }
    return api;
  }

  window.NorthLicense = {
    init,
    session,
    meta,
    isManaged,
    saveSession,
    clearSession,
    deviceLabel,
    supportsPasskey,
    activate,
    legacyActivate,
    bindPasskey,
    restorePasskey,
    relinkPasskey,
    check,
    listSessions,
    revokeSession,
    syncAIIdentity,
    syncPhoneFriendIdentity,
    _test: { b64urlToBuffer, bufferToB64url, creationOptions, requestOptions, licenseEndpoints, retryableLicenseError },
  };
})();
