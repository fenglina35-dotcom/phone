import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';

// License and invitation data live in this failover project's own database.
// The legacy project can be quota-restricted, so it must never be allowed to
// take the license path down with it. Only payment administration keeps using
// the optional legacy database connection below.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ORDER_SUPABASE_URL = Deno.env.get('PHONE_SUPABASE_URL') || SUPABASE_URL;
const ORDER_SERVICE_KEY = Deno.env.get('PHONE_SERVICE_ROLE_KEY') || SERVICE_KEY;
const RP_ID = Deno.env.get('LICENSE_RP_ID') || 'fenglina35-dotcom.github.io';
const RP_NAME = 'North 小手机';
const PROOF_BUCKET = 'phone-ai-payment-proofs';
const MAX_SESSIONS = 3;
const TRANSFER_CREATE_COOLDOWN_MS = 30 * 1000;
const TRANSFER_CREATE_HOURLY_LIMIT = 10;
const TRANSFER_REDEEM_WINDOW_MS = 10 * 60 * 1000;
const TRANSFER_REDEEM_FAILURE_LIMIT = 8;
const TRANSFER_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
const RECOVERY_CREATE_DAILY_LIMIT = 5;
const RECOVERY_VALID_MS = 365 * 24 * 60 * 60 * 1000;
// 大刷新时与 app.js 的 SHARE_EPOCH 一起递增并重新部署，旧通行密钥将无法恢复。
const LICENSE_EPOCH = Number(Deno.env.get('LICENSE_EPOCH') || 4);
const ALLOWED_ORIGINS = new Set([
  'https://fenglina35-dotcom.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const orderSupabase = createClient(ORDER_SUPABASE_URL, ORDER_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let minimaxVoiceCache: JsonMap[] = [];
let minimaxVoiceCacheAt = 0;

type JsonMap = Record<string, unknown>;

class LicenseHttpError extends Error {
  status: number;
  code: string;
  permanent: boolean;

  constructor(message: string, status: number, code: string, permanent = false) {
    super(message);
    this.name = 'LicenseHttpError';
    this.status = status;
    this.code = code;
    this.permanent = permanent;
  }
}

function temporaryLicenseError(message = '授权服务暂时不可用，请稍后重试') {
  return new LicenseHttpError(message, 503, 'license-service-unavailable', false);
}

function requestOrigin(req: Request): string {
  const origin = req.headers.get('origin') || '';
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  if (!origin) return `https://${RP_ID}`;
  throw new Error('当前打开地址不支持手机授权');
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : `https://${RP_ID}`,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  };
}

function secureEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type LicenseAdminIdentity = { role: 'owner' | 'license'; operatorId: string };

function requireLicenseAdmin(req: Request, body: JsonMap): LicenseAdminIdentity {
  const supplied = cleanText(req.headers.get('x-admin-token') || body.admin_token, 240);
  const ownerToken = String(Deno.env.get('ADMIN_ACCESS_TOKEN') || '').trim();
  if (ownerToken && secureEqual(supplied, ownerToken)) {
    return { role: 'owner', operatorId: 'owner' };
  }
  const unifiedTokens = String(Deno.env.get('UNIFIED_ADMIN_TOKENS') || '')
    .split(/[\n,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const unifiedIndex = unifiedTokens.findIndex((token) => secureEqual(supplied, token));
  if (unifiedIndex >= 0) {
    const labelled = supplied.match(/^ADMIN-(\d{2})-/i);
    return {
      role: 'owner',
      operatorId: labelled ? `unified-${labelled[1]}` : `unified-${unifiedIndex + 1}`,
    };
  }
  const tokens = String(Deno.env.get('LICENSE_ADMIN_TOKENS') || '')
    .split(/[\n,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const tokenIndex = tokens.findIndex((token) => secureEqual(supplied, token));
  if (tokenIndex < 0) throw new LicenseHttpError('后台授权码无效', 401, 'admin-unauthorized', true);
  const labelled = supplied.match(/^ADMIN-(\d{2})-/i);
  return { role: 'license', operatorId: labelled ? `admin-${labelled[1]}` : `license-${tokenIndex + 1}` };
}

function ownerPairCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function requireOwnerAdmin(req: Request, body: JsonMap): LicenseAdminIdentity {
  const identity = requireLicenseAdmin(req, body);
  if (identity.role !== 'owner') throw new LicenseHttpError('主管理员权限不足', 403, 'owner-required', true);
  return identity;
}

async function adminOwnerPairCreate(req: Request, body: JsonMap): Promise<JsonMap> {
  requireOwnerAdmin(req, body);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from('phone_admin_owner_pairings').delete().lt('expires_at', new Date().toISOString());
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = ownerPairCode();
    const codeHash = await sha256Hex(`phone-admin-owner-pair:${code}`);
    const { error } = await supabase.from('phone_admin_owner_pairings').insert({ code_hash: codeHash, expires_at: expiresAt });
    if (!error) return { ok: true, pair_code: code, expires_at: expiresAt };
    if (String(error.code || '') !== '23505') throw error;
  }
  throw new LicenseHttpError('临时绑定码生成失败，请重试', 503, 'owner-pair-create-failed', false);
}

async function adminOwnerPairClaim(body: JsonMap): Promise<JsonMap> {
  const code = cleanText(body.pair_code, 40).toUpperCase().replace(/[\s-]+/g, '');
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/.test(code)) {
    throw new LicenseHttpError('一次性绑定码无效', 401, 'owner-pair-invalid', true);
  }
  const codeHash = await sha256Hex(`phone-admin-owner-pair:${code}`);
  const { data, error } = await supabase.rpc('phone_admin_owner_pair_claim', { p_code_hash: codeHash });
  if (error) throw error;
  if (data !== true) throw new LicenseHttpError('一次性绑定码无效、已使用或已过期', 401, 'owner-pair-invalid', true);
  const ownerToken = String(Deno.env.get('ADMIN_ACCESS_TOKEN') || '').trim();
  if (!ownerToken) throw new LicenseHttpError('主管理员入口尚未配置', 503, 'owner-not-configured', false);
  return { ok: true, admin_token: ownerToken };
}

async function adminLicenseUsers(req: Request, body: JsonMap): Promise<JsonMap> {
  requireLicenseAdmin(req, body);
  const pageSize = Math.min(100, Math.max(10, Math.trunc(Number(body.page_size || 50))));
  const page = Math.min(200000, Math.max(1, Math.trunc(Number(body.page || 1))));
  const query = cleanText(body.query, 120);
  const requestedStatus = cleanText(body.status || 'all', 16).toLowerCase();
  const status = requestedStatus === 'active' || requestedStatus === 'blocked' ? requestedStatus : 'all';
  const { data, error } = await supabase.rpc('phone_license_admin_page', {
    p_query: query,
    p_status: status,
    p_offset: (page - 1) * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;
  const payload = data && typeof data === 'object' ? data as JsonMap : {};
  const users = Array.isArray(payload.users) ? payload.users : [];
  const total = Math.max(0, Number(payload.total || 0));
  return { ok: true, users, total, page, page_size: pageSize, total_pages: Math.max(1, Math.ceil(total / pageSize)), status, query };
}

async function adminLicenseBlock(req: Request, body: JsonMap): Promise<JsonMap> {
  const identity = requireLicenseAdmin(req, body);
  const licenseId = cleanText(body.license_id, 80);
  if (!/^[0-9a-f-]{36}$/i.test(licenseId)) throw new LicenseHttpError('授权编号无效', 400, 'invalid-license-id', true);
  const { data: license, error: findError } = await supabase.from('phone_licenses').select('id,phone_friend_id').eq('id', licenseId).maybeSingle();
  if (findError) throw findError;
  if (!license) throw new LicenseHttpError('手机授权不存在', 404, 'license-not-found', true);
  const now = new Date().toISOString();
  const { error: blockError } = await supabase.from('phone_licenses').update({ status: 'blocked', updated_at: now }).eq('id', license.id);
  if (blockError) throw blockError;
  const [sessions, codes] = await Promise.all([
    supabase.from('phone_license_sessions').update({ revoked_at: now }).eq('license_id', license.id).is('revoked_at', null),
    supabase.from('phone_license_transfers').update({ used_at: now }).eq('license_id', license.id).is('used_at', null),
  ]);
  if (sessions.error || codes.error) throw sessions.error || codes.error;
  await supabase.from('phone_license_admin_actions').insert({ license_id: license.id, phone_friend_id: license.phone_friend_id, action: 'block', operator_id: identity.operatorId });
  return { ok: true };
}

async function adminLicenseUnblock(req: Request, body: JsonMap): Promise<JsonMap> {
  const identity = requireLicenseAdmin(req, body);
  const licenseId = cleanText(body.license_id, 80);
  if (!/^[0-9a-f-]{36}$/i.test(licenseId)) throw new LicenseHttpError('授权编号无效', 400, 'invalid-license-id', true);
  const { data: license, error: findError } = await supabase.from('phone_licenses').select('id,phone_friend_id').eq('id', licenseId).maybeSingle();
  if (findError) throw findError;
  if (!license) throw new LicenseHttpError('手机授权不存在', 404, 'license-not-found', true);
  const now = new Date().toISOString();
  const { error: restoreError } = await supabase.from('phone_licenses').update({ status: 'active', epoch: LICENSE_EPOCH, updated_at: now }).eq('id', license.id);
  if (restoreError) throw restoreError;
  await supabase.from('phone_license_admin_actions').insert({ license_id: license.id, phone_friend_id: license.phone_friend_id, action: 'recovery', operator_id: identity.operatorId });
  return { ok: true };
}

async function adminLicenseRestoreAll(req: Request, body: JsonMap): Promise<JsonMap> {
  const identity = requireLicenseAdmin(req, body);
  const { data, error } = await supabase.rpc('phone_license_restore_all_safe', { p_epoch: LICENSE_EPOCH, p_operator_id: identity.operatorId });
  if (error) throw error;
  const result = data && typeof data === 'object' ? data as JsonMap : {};
  return { ok: true, restored: Math.max(0, Number(result.restored || 0)), total: Math.max(0, Number(result.total || 0)), expires_at: String(result.expires_at || '') };
}

async function adminInviteGenerate(req: Request, body: JsonMap): Promise<JsonMap> {
  requireLicenseAdmin(req, body);
  const count = Math.min(100, Math.max(1, Math.trunc(Number(body.count || 1))));
  const note = cleanText(body.note, 180) || `新版授权 ${new Date().toISOString().slice(0, 10)}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codes: string[] = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const batch = new Set<string>();
    while (batch.size < count) {
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      const suffix = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
      batch.add(`YB2-${suffix}`);
    }
    const next = [...batch];
    const { error } = await supabase.from('invites').insert(next.map((code) => ({ code, active: true, reusable: false, note })));
    if (!error) { codes = next; break; }
    if (error.code !== '23505') throw error;
  }
  if (codes.length !== count) throw temporaryLicenseError('邀请码没有完整生成，请重新操作');
  return { ok: true, codes, count: codes.length };
}

async function adminInviteList(req: Request, body: JsonMap): Promise<JsonMap> {
  requireLicenseAdmin(req, body);
  const limit = Math.min(500, Math.max(1, Math.trunc(Number(body.limit || 200))));
  const { data, error, count } = await supabase
    .from('invites')
    .select('code,note,created_at', { count: 'exact' })
    .eq('active', true)
    .eq('reusable', false)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .order('code', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return { ok: true, invites: Array.isArray(data) ? data : [], total: Math.max(0, Number(count || 0)), limit };
}

function validPrivateVoiceId(value: unknown): string {
  const voiceId = cleanText(value, 256);
  return /^[A-Za-z][A-Za-z0-9_-]{6,254}[A-Za-z0-9]$/.test(voiceId) ? voiceId : '';
}

function publicPrivateVoice(row: JsonMap): JsonMap {
  return {
    id: row.id,
    voice_id: row.voice_id,
    display_name: row.display_name,
    purchase_id: row.purchase_id || null,
    created_at: row.created_at,
  };
}

async function minimaxVoices(force = false): Promise<JsonMap[]> {
  if (!force && minimaxVoiceCache.length && Date.now() - minimaxVoiceCacheAt < 5 * 60 * 1000) {
    return minimaxVoiceCache.slice();
  }
  const base = String(Deno.env.get('MINIMAX_BASE_URL') || 'https://api.minimaxi.com').replace(/\/+$/, '');
  const key = String(Deno.env.get('MINIMAX_API_KEY') || '');
  const groupId = String(Deno.env.get('MINIMAX_GROUP_ID') || '');
  if (!key) throw new LicenseHttpError('克隆音色服务尚未配置', 503, 'voice-service-unavailable', false);
  const url = base + '/v1/get_voice' + (groupId ? ('?GroupId=' + encodeURIComponent(groupId)) : '');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ voice_type: 'all' }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || (data?.base_resp && data.base_resp.status_code !== 0)) {
    throw new LicenseHttpError('克隆音色服务暂时不可用', 502, 'voice-service-unavailable', false);
  }
  const clones = (Array.isArray(data?.voice_cloning) ? data.voice_cloning : []).map((voice: JsonMap) => ({
    id: cleanText(voice.voice_id, 256),
    name: cleanText(voice.voice_name || voice.voice_id || '我的克隆', 120),
    clone: true,
  })).filter((voice: JsonMap) => voice.id);
  const system = (Array.isArray(data?.system_voice) ? data.system_voice : []).map((voice: JsonMap) => ({
    id: cleanText(voice.voice_id, 256),
    name: cleanText(voice.voice_name || voice.voice_id || '系统音色', 120),
    clone: false,
  })).filter((voice: JsonMap) => voice.id);
  minimaxVoiceCache = clones.concat(system);
  minimaxVoiceCacheAt = Date.now();
  return minimaxVoiceCache.slice();
}

async function adminOrders(req: Request, body: JsonMap): Promise<JsonMap> {
  requireOwnerAdmin(req, body);
  const scope = cleanText(body.scope || 'pending', 16);
  let query = orderSupabase
    .from('phone_ai_purchases')
    .select('id,user_id,plan_id,provider,amount_cny,points,status,review_status,payer_hint,claimed_paid_at,proof_path,review_submitted_at,reviewed_at,review_note,external_order_id,created_at,paid_at')
    .neq('review_status', 'unsubmitted')
    .order('review_submitted_at', { ascending: false, nullsFirst: false })
    .limit(100);
  if (scope === 'pending') query = query.eq('status', 'pending').eq('review_status', 'submitted');
  const { data: rows, error } = await query;
  if (error) throw error;
  const purchases = Array.isArray(rows) ? rows : [];
  const userIds = [...new Set(purchases.map((row: JsonMap) => cleanText(row.user_id, 80)).filter(Boolean))];
  const balances = new Map<string, number>();
  if (userIds.length) {
    const { data: accounts, error: accountError } = await orderSupabase.from('phone_ai_accounts').select('user_id,points').in('user_id', userIds);
    if (accountError) throw accountError;
    (accounts || []).forEach((account: JsonMap) => balances.set(cleanText(account.user_id, 80), Number(account.points || 0)));
  }
  const purchaseIds = purchases.map((row: JsonMap) => cleanText(row.id, 80)).filter(Boolean);
  const voicesByPurchase = new Map<string, JsonMap>();
  if (purchaseIds.length) {
    const { data: voices, error: voiceError } = await orderSupabase
      .from('phone_ai_private_voices')
      .select('id,user_id,purchase_id,voice_id,display_name,status,created_at')
      .in('purchase_id', purchaseIds);
    if (voiceError) throw voiceError;
    (voices || []).forEach((voice: JsonMap) => {
      const purchaseId = cleanText(voice.purchase_id, 80);
      if (purchaseId) voicesByPurchase.set(purchaseId, publicPrivateVoice(voice));
    });
  }
  const orders = await Promise.all(purchases.map(async (row: JsonMap) => {
    let proofUrl = '';
    if (row.proof_path) {
      const { data } = await orderSupabase.storage.from(PROOF_BUCKET).createSignedUrl(String(row.proof_path), 600);
      proofUrl = data?.signedUrl || '';
    }
    return {
      ...row,
      account_points: balances.get(cleanText(row.user_id, 80)) || 0,
      private_voice: voicesByPurchase.get(cleanText(row.id, 80)) || null,
      proof_url: proofUrl,
    };
  }));
  const { count, error: countError } = await orderSupabase
    .from('phone_ai_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('review_status', 'submitted');
  if (countError) throw countError;
  return { ok: true, orders, pending_count: count || 0 };
}

async function adminAssignPrivateVoice(req: Request, body: JsonMap): Promise<JsonMap> {
  requireOwnerAdmin(req, body);
  const purchaseId = cleanText(body.purchase_id, 80);
  const voiceId = validPrivateVoiceId(body.voice_id);
  const displayName = cleanText(body.display_name, 60);
  if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) throw new LicenseHttpError('订单编号无效', 400, 'invalid-purchase-id', true);
  if (!voiceId) throw new LicenseHttpError('克隆音色编号无效', 400, 'invalid-private-voice-id', true);
  if (!displayName) throw new LicenseHttpError('请填写用户看到的音色名称', 400, 'private-voice-name-required', true);
  const { data: purchase, error: purchaseError } = await orderSupabase
    .from('phone_ai_purchases')
    .select('id,user_id,plan_id,points,status,review_status')
    .eq('id', purchaseId)
    .maybeSingle();
  if (purchaseError) throw purchaseError;
  if (!purchase) throw new LicenseHttpError('订单不存在', 404, 'purchase-not-found', true);
  if (purchase.plan_id !== 'svc_clone_1990' || Number(purchase.points) !== 0) throw new LicenseHttpError('该订单不是克隆音色服务', 409, 'purchase-is-not-voice-clone-service', true);
  if (purchase.status !== 'paid' || purchase.review_status !== 'approved') throw new LicenseHttpError('请先确认克隆音色订单已到账', 409, 'voice-clone-payment-not-approved', true);
  const available = await minimaxVoices(true);
  if (!available.find((voice) => voice.clone === true && voice.id === voiceId)) throw new LicenseHttpError('海螺账户中没有这个克隆音色', 404, 'private-voice-not-found-in-minimax-account', true);
  const { data: assigned, error } = await orderSupabase
    .from('phone_ai_private_voices')
    .upsert({
      user_id: purchase.user_id,
      purchase_id: purchase.id,
      voice_id: voiceId,
      display_name: displayName,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'purchase_id' })
    .select('id,voice_id,display_name,purchase_id,created_at')
    .single();
  if (error?.code === '23505') throw new LicenseHttpError('这个克隆音色已经属于另一位用户', 409, 'private-voice-already-belongs-to-another-customer', true);
  if (error) throw error;
  return { ok: true, private_voice: publicPrivateVoice(assigned as JsonMap) };
}

async function adminReview(req: Request, body: JsonMap): Promise<JsonMap> {
  requireOwnerAdmin(req, body);
  const purchaseId = cleanText(body.purchase_id, 80);
  const decision = cleanText(body.decision, 16);
  if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) throw new LicenseHttpError('订单编号无效', 400, 'invalid-purchase-id', true);
  if (decision === 'approve') {
    const paymentRef = cleanText(body.payment_ref, 120);
    if (paymentRef.length < 4) throw new LicenseHttpError('请填写到账凭据', 400, 'payment-reference-required', true);
    const { data: balance, error } = await orderSupabase.rpc('phone_ai_confirm_purchase', { p_purchase_id: purchaseId, p_payment_ref: paymentRef });
    if (error) throw error;
    return { ok: true, balance };
  }
  if (decision === 'reject') {
    const note = cleanText(body.review_note || 'payment not found', 300);
    const { data: rejected, error } = await orderSupabase
      .from('phone_ai_purchases')
      .update({ status: 'cancelled', review_status: 'rejected', reviewed_at: new Date().toISOString(), review_note: note })
      .eq('id', purchaseId)
      .eq('status', 'pending')
      .eq('review_status', 'submitted')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!rejected) throw new LicenseHttpError('该订单当前不能驳回', 409, 'purchase-not-reviewable', true);
    return { ok: true };
  }
  throw new LicenseHttpError('审核决定无效', 400, 'invalid-review-decision', true);
}

async function adminDeleteOrder(req: Request, body: JsonMap): Promise<JsonMap> {
  requireOwnerAdmin(req, body);
  const purchaseId = cleanText(body.purchase_id, 80);
  if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) throw new LicenseHttpError('订单编号无效', 400, 'invalid-purchase-id', true);
  const { data: purchase, error: findError } = await orderSupabase.from('phone_ai_purchases').select('id,proof_path').eq('id', purchaseId).maybeSingle();
  if (findError) throw findError;
  if (!purchase) throw new LicenseHttpError('订单不存在', 404, 'purchase-not-found', true);
  const { error } = await orderSupabase.from('phone_ai_purchases').delete().eq('id', purchaseId);
  if (error) throw error;
  if (purchase.proof_path) await orderSupabase.storage.from(PROOF_BUCKET).remove([purchase.proof_path]).catch(() => null);
  return { ok: true };
}

async function adminDeleteOrders(req: Request, body: JsonMap): Promise<JsonMap> {
  requireOwnerAdmin(req, body);
  const scope = cleanText(body.scope || 'pending', 16);
  let query = orderSupabase.from('phone_ai_purchases').select('id,proof_path').neq('review_status', 'unsubmitted').limit(300);
  if (scope === 'pending') query = query.eq('status', 'pending').eq('review_status', 'submitted');
  const { data: rows, error: findError } = await query;
  if (findError) throw findError;
  const purchases = Array.isArray(rows) ? rows : [];
  const ids = purchases.map((row: JsonMap) => cleanText(row.id, 80)).filter(Boolean);
  const proofPaths = purchases.map((row: JsonMap) => cleanText(row.proof_path, 500)).filter(Boolean);
  if (!ids.length) return { ok: true, deleted: 0 };
  const { error } = await orderSupabase.from('phone_ai_purchases').delete().in('id', ids);
  if (error) throw error;
  if (proofPaths.length) await orderSupabase.storage.from(PROOF_BUCKET).remove(proofPaths).catch(() => null);
  return { ok: true, deleted: ids.length };
}

async function adminSubscribe(req: Request, body: JsonMap): Promise<JsonMap> {
  requireOwnerAdmin(req, body);
  const subscription = body.subscription && typeof body.subscription === 'object' ? body.subscription as JsonMap : {};
  const keys = subscription.keys && typeof subscription.keys === 'object' ? subscription.keys as JsonMap : {};
  const endpoint = cleanText(subscription.endpoint, 1000);
  const p256dh = cleanText(keys.p256dh, 300);
  const auth = cleanText(keys.auth, 300);
  if (!endpoint.startsWith('https://') || !p256dh || !auth) throw new LicenseHttpError('通知订阅信息无效', 400, 'invalid-push-subscription', true);
  const { error } = await orderSupabase.from('phone_ai_admin_push').upsert({
    endpoint,
    p256dh,
    auth,
    user_agent: cleanText(body.user_agent, 300),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw error;
  return { ok: true };
}

function reply(req: Request, body: JsonMap, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function cleanText(value: unknown, max = 160): string {
  return String(value || '').trim().slice(0, max);
}

function cleanInvite(value: unknown): string {
  return cleanText(value, 80).replace(/\s+/g, '').toUpperCase();
}

function cleanTransferCode(value: unknown): string {
  return cleanText(value, 24).replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function cleanRecoveryCode(value: unknown): string {
  return cleanText(value, 48).replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function randomHex(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomTransferCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function randomRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function formatRecoveryCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') || code;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function transferRequesterHash(req: Request): Promise<string> {
  const forwarded = cleanText(req.headers.get('x-forwarded-for'), 180).split(',')[0].trim();
  const ip = forwarded || cleanText(req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip'), 80) || 'unknown';
  const ua = cleanText(req.headers.get('user-agent'), 300);
  return sha256Hex(`${ip}|${ua}`);
}

function bytesToBase64URL(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64URLToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function activeLicense(licenseId: string) {
  const { data, error } = await supabase
    .from('phone_licenses')
    .select('id,status,epoch')
    .eq('id', licenseId)
    .maybeSingle();
  if (error) throw temporaryLicenseError();
  if (!data) throw new LicenseHttpError('手机授权不存在', 403, 'license-not-found', true);
  if (data.status !== 'active') {
    const { data: blockAction, error: blockError } = await supabase
      .from('phone_license_admin_actions')
      .select('id')
      .eq('license_id', licenseId)
      .eq('action', 'block')
      .limit(1)
      .maybeSingle();
    if (blockError) throw temporaryLicenseError();
    if (blockAction) throw new LicenseHttpError('手机授权已被管理员移出', 403, 'license-admin-blocked', true);
    throw new LicenseHttpError('手机授权正在等待管理员恢复', 409, 'license-awaiting-admin-restore');
  }
  if (Number(data.epoch) !== LICENSE_EPOCH) throw new LicenseHttpError('手机授权需要管理员恢复', 409, 'license-epoch-mismatch');
  return data;
}

async function sessionAuth(tokenValue: unknown) {
  const token = cleanText(tokenValue, 180);
  if (!token) throw new Error('本浏览器还没有授权');
  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase
    .from('phone_license_sessions')
    .select('id,license_id,label,created_at,last_seen_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw temporaryLicenseError();
  if (!data) throw new LicenseHttpError('本浏览器授权已失效', 401, 'license-session-invalid', true);
  await activeLicense(data.license_id);
  return { ...data, token };
}

async function registrationAuth(body: JsonMap) {
  if (body.sessionToken) {
    const session = await sessionAuth(body.sessionToken);
    return { licenseId: session.license_id as string, session, bootstrap: false };
  }
  const licenseId = cleanText(body.licenseId, 80);
  const bootstrap = cleanText(body.bootstrapToken, 180);
  if (!licenseId || !bootstrap) throw new Error('缺少手机绑定凭证');
  const tokenHash = await sha256Hex(bootstrap);
  const { data, error } = await supabase
    .from('phone_license_bootstraps')
    .select('license_id,expires_at,used_at')
    .eq('license_id', licenseId)
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error('手机绑定凭证已失效');
  }
  await activeLicense(licenseId);
  return { licenseId, session: null, bootstrap: true };
}

async function createSession(licenseId: string, req: Request, labelValue: unknown) {
  await activeLicense(licenseId);
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const label = cleanText(labelValue, 80) || '手机浏览器';
  const userAgent = cleanText(req.headers.get('user-agent'), 400);
  const { data: inserted, error: insertError } = await supabase
    .from('phone_license_sessions')
    .insert({ license_id: licenseId, token_hash: tokenHash, label, user_agent: userAgent })
    .select('id')
    .single();
  if (insertError || !inserted) throw new Error('创建浏览器授权失败');

  const { data: sessions, error: listError } = await supabase
    .from('phone_license_sessions')
    .select('id,label,created_at')
    .eq('license_id', licenseId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (listError) throw new Error('检查浏览器名额失败');
  const overflow = (sessions || []).slice(MAX_SESSIONS);
  if (overflow.length) {
    const ids = overflow.map((row) => row.id);
    await supabase
      .from('phone_license_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .in('id', ids)
      .is('revoked_at', null);
  }
  await supabase
    .from('phone_licenses')
    .update({ updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
    .eq('id', licenseId);
  return {
    token,
    licenseId,
    sessionId: inserted.id,
    activeCount: Math.min((sessions || []).length, MAX_SESSIONS),
    evicted: overflow.map((row) => cleanText(row.label, 80)),
  };
}

async function activateInvite(req: Request, body: JsonMap) {
  const inviteCode = cleanInvite(body.inviteCode);
  if (!inviteCode) throw new Error('请输入邀请码');
  const { data, error } = await supabase.rpc('redeem_invite_license', {
    p_code: inviteCode,
    p_epoch: LICENSE_EPOCH,
    p_label: cleanText(body.deviceLabel, 80) || '手机浏览器',
    p_user_agent: cleanText(req.headers.get('user-agent'), 400),
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error) {
    console.error('redeem_invite_license', error.message);
    throw new Error('邀请码验证服务暂时不可用');
  }
  if (!row?.license_id || !row?.bootstrap_token || !row?.session_token || !row?.session_id) {
    throw new Error('邀请码无效或已经使用');
  }
  const session = {
    token: row.session_token,
    licenseId: row.license_id,
    sessionId: row.session_id,
    activeCount: 1,
    evicted: [],
  };
  return { ok: true, session, bootstrapToken: row.bootstrap_token };
}

async function activateLegacy(req: Request, body: JsonMap) {
  const legacyToken = cleanText(body.legacyDeviceToken, 180);
  if (legacyToken.length < 32 || Number(body.legacyEpoch) !== 3) throw new Error('旧版授权校验失败');
  const legacyHash = await sha256Hex(legacyToken);
  let { data: license, error } = await supabase
    .from('phone_licenses')
    .select('id,status,epoch')
    .eq('legacy_device_hash', legacyHash)
    .maybeSingle();
  if (error) throw new Error('读取旧版授权失败');
  let bootstrapToken = '';
  if (!license) {
    const inserted = await supabase
      .from('phone_licenses')
      .insert({ legacy_device_hash: legacyHash, epoch: LICENSE_EPOCH })
      .select('id,status,epoch')
      .single();
    if (inserted.error || !inserted.data) throw new Error('升级旧版授权失败');
    license = inserted.data;
    bootstrapToken = randomHex(32);
    const bootstrapHash = await sha256Hex(bootstrapToken);
    const saved = await supabase.from('phone_license_bootstraps').insert({
      license_id: license.id,
      token_hash: bootstrapHash,
    });
    if (saved.error) throw new Error('保存手机绑定凭证失败');
  }
  if (license.status !== 'active' || Number(license.epoch) !== LICENSE_EPOCH) {
    throw new Error('手机授权已失效');
  }
  const session = await createSession(license.id, req, body.deviceLabel);
  return { ok: true, session, bootstrapToken };
}

async function registrationOptions(req: Request, body: JsonMap) {
  const origin = requestOrigin(req);
  const auth = await registrationAuth(body);
  const { data: passkeys, error } = await supabase
    .from('phone_license_passkeys')
    .select('credential_id,transports')
    .eq('license_id', auth.licenseId);
  if (error) throw new Error('读取手机通行密钥失败');
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(auth.licenseId),
    userName: `north-${auth.licenseId.slice(0, 8)}`,
    userDisplayName: 'North 手机授权',
    attestationType: 'none',
    excludeCredentials: (passkeys || []).map((key) => ({
      id: key.credential_id,
      transports: key.transports || [],
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
    supportedAlgorithmIDs: [-7, -257],
    timeout: 60000,
  });
  const { data: challenge, error: challengeError } = await supabase
    .from('phone_license_challenges')
    .insert({
      kind: 'register',
      license_id: auth.licenseId,
      challenge: options.challenge,
      origin,
    })
    .select('id')
    .single();
  if (challengeError || !challenge) throw new Error('创建手机验证失败');
  return { ok: true, options, challengeId: challenge.id };
}

async function registrationVerify(req: Request, body: JsonMap) {
  const auth = await registrationAuth(body);
  const challengeId = cleanText(body.challengeId, 80);
  const { data: challenge, error } = await supabase
    .from('phone_license_challenges')
    .select('id,license_id,challenge,origin,expires_at,used_at')
    .eq('id', challengeId)
    .eq('kind', 'register')
    .maybeSingle();
  if (
    error || !challenge || challenge.license_id !== auth.licenseId || challenge.used_at ||
    new Date(challenge.expires_at).getTime() < Date.now()
  ) throw new Error('手机验证已过期，请重新点击绑定');
  const verification = await verifyRegistrationResponse({
    response: body.credential as never,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error('系统没有完成手机验证');
  const info = verification.registrationInfo;
  const credential = info.credential;
  const saved = await supabase.from('phone_license_passkeys').upsert({
    license_id: auth.licenseId,
    credential_id: credential.id,
    public_key: bytesToBase64URL(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
    device_type: info.credentialDeviceType,
    backed_up: info.credentialBackedUp,
    last_used_at: new Date().toISOString(),
  }, { onConflict: 'credential_id' });
  if (saved.error) throw new Error('保存手机通行密钥失败');
  await supabase
    .from('phone_license_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challenge.id)
    .is('used_at', null);
  if (auth.bootstrap) {
    await supabase
      .from('phone_license_bootstraps')
      .update({ used_at: new Date().toISOString() })
      .eq('license_id', auth.licenseId)
      .is('used_at', null);
  }
  const session = auth.session
    ? { token: auth.session.token, licenseId: auth.licenseId, sessionId: auth.session.id }
    : await createSession(auth.licenseId, req, body.deviceLabel);
  return { ok: true, session, passkeyCount: 1 };
}

async function authenticationOptions(req: Request) {
  const origin = requestOrigin(req);
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    timeout: 60000,
  });
  const { data: challenge, error } = await supabase
    .from('phone_license_challenges')
    .insert({ kind: 'authenticate', challenge: options.challenge, origin })
    .select('id')
    .single();
  if (error || !challenge) throw new Error('创建恢复验证失败');
  return { ok: true, options, challengeId: challenge.id };
}

async function authenticationVerify(req: Request, body: JsonMap) {
  const challengeId = cleanText(body.challengeId, 80);
  const credential = body.credential as JsonMap;
  const credentialId = cleanText(credential?.id, 1024);
  if (!credentialId) throw new Error('没有读到手机通行密钥');
  const { data: challenge, error } = await supabase
    .from('phone_license_challenges')
    .select('id,challenge,origin,expires_at,used_at')
    .eq('id', challengeId)
    .eq('kind', 'authenticate')
    .maybeSingle();
  if (error || !challenge || challenge.used_at || new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error('恢复验证已过期，请重新点击恢复');
  }
  const { data: passkey, error: keyError } = await supabase
    .from('phone_license_passkeys')
    .select('id,license_id,credential_id,public_key,counter,transports')
    .eq('credential_id', credentialId)
    .maybeSingle();
  if (keyError || !passkey) throw new Error('这台手机没有可恢复的授权');
  await activeLicense(passkey.license_id);
  const verification = await verifyAuthenticationResponse({
    response: body.credential as never,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credential_id,
      publicKey: base64URLToBytes(passkey.public_key),
      counter: Number(passkey.counter) || 0,
      transports: passkey.transports || [],
    },
    requireUserVerification: true,
  });
  if (!verification.verified) throw new Error('系统没有完成手机验证');
  await supabase
    .from('phone_license_passkeys')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', passkey.id);
  await supabase
    .from('phone_license_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challenge.id)
    .is('used_at', null);
  const session = await createSession(passkey.license_id, req, body.deviceLabel);
  return { ok: true, session };
}

async function checkSession(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const now = new Date().toISOString();
  await supabase.from('phone_license_sessions').update({ last_seen_at: now }).eq('id', session.id);
  await supabase.from('phone_licenses').update({ last_seen_at: now }).eq('id', session.license_id);
  const [{ count: sessionCount }, { count: passkeyCount }] = await Promise.all([
    supabase
      .from('phone_license_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', session.license_id)
      .is('revoked_at', null),
    supabase
      .from('phone_license_passkeys')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', session.license_id),
  ]);
  return {
    ok: true,
    valid: true,
    licenseId: session.license_id,
    sessionId: session.id,
    sessionCount: sessionCount || 0,
    passkeyCount: passkeyCount || 0,
  };
}

async function listSessions(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const { data, error } = await supabase
    .from('phone_license_sessions')
    .select('id,label,created_at,last_seen_at')
    .eq('license_id', session.license_id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error('读取浏览器授权失败');
  return {
    ok: true,
    currentSessionId: session.id,
    sessions: (data || []).map((row) => ({ ...row, current: row.id === session.id })),
  };
}

async function revokeSession(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const targetId = cleanText(body.targetSessionId, 80);
  const { data, error } = await supabase
    .from('phone_license_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', targetId)
    .eq('license_id', session.license_id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) throw new Error('这个浏览器授权已经移除');
  return { ok: true, revokedCurrent: targetId === session.id };
}

async function createTransfer(req: Request, body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: recentCount, error: countError }, { data: latest, error: latestError }] = await Promise.all([
    supabase
      .from('phone_license_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', session.license_id)
      .eq('kind', 'transfer')
      .gte('created_at', hourAgo),
    supabase
      .from('phone_license_transfers')
      .select('created_at')
      .eq('license_id', session.license_id)
      .eq('kind', 'transfer')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (countError || latestError) throw new Error('检查迁移码生成频率失败');
  if ((recentCount || 0) >= TRANSFER_CREATE_HOURLY_LIMIT) throw new Error('迁移码生成过于频繁，请一小时后再试');
  if (latest && Date.now() - new Date(latest.created_at).getTime() < TRANSFER_CREATE_COOLDOWN_MS) {
    throw new Error('请30秒后再生成新的迁移码');
  }
  await supabase
    .from('phone_license_transfers')
    .update({ used_at: new Date().toISOString() })
    .eq('license_id', session.license_id)
    .eq('kind', 'transfer')
    .is('used_at', null);
  const code = randomTransferCode();
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await supabase.from('phone_license_transfers').insert({
    license_id: session.license_id,
    code_hash: codeHash,
    created_by_session: session.id,
    kind: 'transfer',
    expires_at: expiresAt,
  });
  if (error) throw new Error('生成迁移码失败');
  return { ok: true, code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt };
}

async function redeemTransfer(req: Request, body: JsonMap) {
  const requesterHash = await transferRequesterHash(req);
  await supabase
    .from('phone_license_transfer_attempts')
    .delete()
    .lt('created_at', new Date(Date.now() - TRANSFER_ATTEMPT_RETENTION_MS).toISOString());
  const attemptCutoff = new Date(Date.now() - TRANSFER_REDEEM_WINDOW_MS).toISOString();
  const { count: failedCount, error: attemptError } = await supabase
    .from('phone_license_transfer_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('requester_hash', requesterHash)
    .gte('created_at', attemptCutoff);
  if (attemptError) throw new Error('检查迁移码安全限制失败');
  if ((failedCount || 0) >= TRANSFER_REDEEM_FAILURE_LIMIT) throw new Error('迁移码尝试过多，请10分钟后再试');
  const code = cleanTransferCode(body.transferCode);
  if (code.length !== 8) {
    await supabase.from('phone_license_transfer_attempts').insert({ requester_hash: requesterHash });
    throw new Error('请输入8位迁移码');
  }
  const codeHash = await sha256Hex(code);
  const { data: transfer, error } = await supabase
    .from('phone_license_transfers')
    .select('id,license_id,expires_at,used_at')
    .eq('code_hash', codeHash)
    .eq('kind', 'transfer')
    .maybeSingle();
  if (error || !transfer || transfer.used_at || new Date(transfer.expires_at).getTime() < Date.now()) {
    await supabase.from('phone_license_transfer_attempts').insert({ requester_hash: requesterHash });
    throw new Error('迁移码无效、已使用或已过期');
  }
  const { data: claimed, error: claimError } = await supabase
    .from('phone_license_transfers')
    .update({ used_at: new Date().toISOString() })
    .eq('id', transfer.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (claimError || !claimed) throw new Error('迁移码已经被使用');
  const session = await createSession(transfer.license_id, req, body.deviceLabel);
  await supabase.from('phone_license_transfer_attempts').delete().eq('requester_hash', requesterHash);
  return { ok: true, session };
}

async function createRecovery(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await supabase
    .from('phone_license_transfers')
    .select('*', { count: 'exact', head: true })
    .eq('license_id', session.license_id)
    .eq('kind', 'recovery')
    .not('created_by_session', 'is', null)
    .gte('created_at', dayAgo);
  if (countError) throw new Error('检查备用恢复码生成频率失败');
  if ((recentCount || 0) >= RECOVERY_CREATE_DAILY_LIMIT) {
    throw new Error('备用恢复码生成过于频繁，请24小时后再试');
  }
  await supabase
    .from('phone_license_transfers')
    .update({ used_at: new Date().toISOString() })
    .eq('license_id', session.license_id)
    .eq('kind', 'recovery')
    .is('used_at', null);
  const code = randomRecoveryCode();
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + RECOVERY_VALID_MS).toISOString();
  const { error } = await supabase.from('phone_license_transfers').insert({
    license_id: session.license_id,
    code_hash: codeHash,
    created_by_session: session.id,
    kind: 'recovery',
    expires_at: expiresAt,
  });
  if (error) throw new Error('生成备用恢复码失败');
  return { ok: true, code: formatRecoveryCode(code), expiresAt };
}

async function redeemRecovery(req: Request, body: JsonMap) {
  const requesterHash = await transferRequesterHash(req);
  await supabase
    .from('phone_license_transfer_attempts')
    .delete()
    .lt('created_at', new Date(Date.now() - TRANSFER_ATTEMPT_RETENTION_MS).toISOString());
  const attemptCutoff = new Date(Date.now() - TRANSFER_REDEEM_WINDOW_MS).toISOString();
  const { count: failedCount, error: attemptError } = await supabase
    .from('phone_license_transfer_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('requester_hash', requesterHash)
    .gte('created_at', attemptCutoff);
  if (attemptError) throw new Error('检查备用恢复码安全限制失败');
  if ((failedCount || 0) >= TRANSFER_REDEEM_FAILURE_LIMIT) {
    throw new Error('备用恢复码尝试过多，请10分钟后再试');
  }
  const code = cleanRecoveryCode(body.recoveryCode);
  if (code.length !== 24) {
    await supabase.from('phone_license_transfer_attempts').insert({ requester_hash: requesterHash });
    throw new Error('请输入24位备用恢复码');
  }
  const codeHash = await sha256Hex(code);
  const { data: recovery, error } = await supabase
    .from('phone_license_transfers')
    .select('id,license_id,expires_at,used_at')
    .eq('code_hash', codeHash)
    .eq('kind', 'recovery')
    .maybeSingle();
  if (error || !recovery || recovery.used_at || new Date(recovery.expires_at).getTime() < Date.now()) {
    await supabase.from('phone_license_transfer_attempts').insert({ requester_hash: requesterHash });
    throw new Error('备用恢复码无效、已使用或已过期');
  }
  const { data: claimed, error: claimError } = await supabase
    .from('phone_license_transfers')
    .update({ used_at: new Date().toISOString() })
    .eq('id', recovery.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (claimError || !claimed) throw new Error('备用恢复码已经被使用');
  const session = await createSession(recovery.license_id, req, body.deviceLabel);
  await supabase.from('phone_license_transfer_attempts').delete().eq('requester_hash', requesterHash);
  return { ok: true, session };
}

async function restoreLocalIdentity(req: Request, body: JsonMap) {
  const phoneFriendId = cleanText(body.phoneFriendId, 16).toUpperCase();
  const phoneFriendSecret = cleanText(body.phoneFriendSecret, 180);
  const aiUserId = cleanText(body.aiUserId, 140);
  const aiClientSecret = cleanText(body.aiClientSecret, 260);
  const hasFriendIdentity = /^SP[A-Z0-9]{8}$/.test(phoneFriendId) && phoneFriendSecret.length >= 16;
  const hasAiIdentity = aiUserId.length >= 8 && aiClientSecret.length >= 16;
  if (!hasFriendIdentity && !hasAiIdentity) {
    throw new LicenseHttpError('本机恢复身份不完整', 400, 'license-local-identity-missing');
  }
  const { data: wave, error: waveError } = await supabase
    .from('phone_license_incident_recovery')
    .select('expires_at')
    .eq('id', true)
    .maybeSingle();
  if (waveError) throw temporaryLicenseError();
  if (!wave || new Date(wave.expires_at).getTime() <= Date.now()) {
    throw new LicenseHttpError('当前没有开放批量恢复', 409, 'license-incident-recovery-closed');
  }
  const licenses = new Map<string, JsonMap>();
  let friendServiceFailed = false;
  if (hasFriendIdentity) {
    const { data: verified, error: verifyError } = await supabase.rpc('phone_friend_check', {
      p_phone_id: phoneFriendId,
      p_secret: phoneFriendSecret,
    });
    friendServiceFailed = !!verifyError;
    if (!verifyError && verified === true) {
      const { data: rows, error } = await supabase
        .from('phone_licenses')
        .select('id,status,epoch,updated_at')
        .eq('phone_friend_id', phoneFriendId)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw temporaryLicenseError();
      for (const item of rows || []) licenses.set(String(item.id), item);
    }
  }
  if (hasAiIdentity) {
    const { data: rows, error } = await supabase
      .from('phone_licenses')
      .select('id,status,epoch,updated_at')
      .eq('ai_user_id', aiUserId)
      .eq('ai_client_secret', aiClientSecret)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) throw temporaryLicenseError();
    for (const item of rows || []) licenses.set(String(item.id), item);
  }
  if (!licenses.size) {
    if (friendServiceFailed) throw temporaryLicenseError();
    throw new LicenseHttpError('本机恢复身份校验失败', 403, 'license-local-identity-invalid', true);
  }
  const eligible = [...licenses.values()].find((item) => item.status === 'active' && Number(item.epoch) === LICENSE_EPOCH);
  if (!eligible) throw new LicenseHttpError('等待管理员执行一键恢复', 409, 'license-awaiting-admin-restore');
  if (eligible.status !== 'active' || Number(eligible.epoch) !== LICENSE_EPOCH) {
    throw new LicenseHttpError('等待管理员执行一键恢复', 409, 'license-awaiting-admin-restore');
  }
  const session = await createSession(eligible.id, req, body.deviceLabel);
  return { ok: true, session, restoredBy: 'local-identity' };
}

async function syncAIIdentity(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const proposedUserId = cleanText(body.userId, 140);
  const proposedSecret = cleanText(body.clientSecret, 260);
  const { data: current, error } = await supabase
    .from('phone_licenses')
    .select('id,ai_user_id,ai_client_secret')
    .eq('id', session.license_id)
    .single();
  if (error || !current) throw new Error('读取AI账户绑定失败');
  if (current.ai_user_id && current.ai_client_secret) {
    return {
      ok: true,
      userId: current.ai_user_id,
      clientSecret: current.ai_client_secret,
      existing: true,
    };
  }
  if (proposedUserId.length < 8 || proposedSecret.length < 16) throw new Error('本机AI账户身份不完整');
  const { data: claimed, error: claimError } = await supabase
    .from('phone_licenses')
    .update({
      ai_user_id: proposedUserId,
      ai_client_secret: proposedSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.license_id)
    .is('ai_user_id', null)
    .select('ai_user_id,ai_client_secret')
    .maybeSingle();
  if (claimError) throw new Error('绑定AI账户失败');
  if (claimed) {
    return {
      ok: true,
      userId: claimed.ai_user_id,
      clientSecret: claimed.ai_client_secret,
      existing: false,
    };
  }
  const { data: winner, error: winnerError } = await supabase
    .from('phone_licenses')
    .select('ai_user_id,ai_client_secret')
    .eq('id', session.license_id)
    .single();
  if (winnerError || !winner?.ai_user_id || !winner?.ai_client_secret) throw new Error('绑定AI账户失败');
  return {
    ok: true,
    userId: winner.ai_user_id,
    clientSecret: winner.ai_client_secret,
    existing: true,
  };
}

async function syncPhoneFriendIdentity(body: JsonMap) {
  const session = await sessionAuth(body.sessionToken);
  const phoneFriendId = cleanText(body.phoneFriendId, 16).toUpperCase();
  const phoneFriendSecret = cleanText(body.phoneFriendSecret, 180);
  if (!/^SP[A-Z0-9]{8}$/.test(phoneFriendId) || phoneFriendSecret.length < 16) {
    throw new Error('小手机ID身份不完整');
  }
  const { data: verified, error: verifyError } = await supabase.rpc('phone_friend_check', {
    p_phone_id: phoneFriendId,
    p_secret: phoneFriendSecret,
  });
  if (verifyError || verified !== true) throw new Error('小手机ID归属验证失败');
  const { error } = await supabase
    .from('phone_licenses')
    .update({ phone_friend_id: phoneFriendId, updated_at: new Date().toISOString() })
    .eq('id', session.license_id);
  if (error) throw new Error('保存小手机ID授权记录失败');
  return { ok: true, phoneFriendId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return reply(req, { ok: false, error: '只支持POST请求' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(req, { ok: false, error: '授权服务未配置' }, 503);
  try {
    requestOrigin(req);
    const body = await req.json() as JsonMap;
    const action = cleanText(body.action, 48);
    let result: JsonMap;
    if (action === 'admin_auth') {
      const identity = requireLicenseAdmin(req, body);
      result = { ok: true, role: identity.role };
    }
    else if (action === 'admin_owner_pair_create') result = await adminOwnerPairCreate(req, body);
    else if (action === 'admin_owner_pair_claim') result = await adminOwnerPairClaim(body);
    else if (action === 'admin_invite_generate') result = await adminInviteGenerate(req, body);
    else if (action === 'admin_invite_list') result = await adminInviteList(req, body);
    else if (action === 'admin_license_users') result = await adminLicenseUsers(req, body);
    else if (action === 'admin_license_block') result = await adminLicenseBlock(req, body);
    else if (action === 'admin_license_unblock') result = await adminLicenseUnblock(req, body);
    else if (action === 'admin_license_restore_all') result = await adminLicenseRestoreAll(req, body);
    else if (action === 'admin_orders') result = await adminOrders(req, body);
    else if (action === 'admin_assign_private_voice') result = await adminAssignPrivateVoice(req, body);
    else if (action === 'admin_review') result = await adminReview(req, body);
    else if (action === 'admin_delete_order') result = await adminDeleteOrder(req, body);
    else if (action === 'admin_delete_orders') result = await adminDeleteOrders(req, body);
    else if (action === 'admin_config') {
      requireOwnerAdmin(req, body);
      result = {
        ok: true,
        vapid_public_key: String(Deno.env.get('VAPID_PUBLIC_KEY') || ''),
        push_enabled: !!Deno.env.get('VAPID_PUBLIC_KEY'),
      };
    }
    else if (action === 'admin_subscribe') result = await adminSubscribe(req, body);
    else if (action === 'activate') result = await activateInvite(req, body);
    else if (action === 'legacy_activate') result = await activateLegacy(req, body);
    else if (action === 'register_options') result = await registrationOptions(req, body);
    else if (action === 'register_verify') result = await registrationVerify(req, body);
    else if (action === 'restore_options') result = await authenticationOptions(req);
    else if (action === 'restore_verify') result = await authenticationVerify(req, body);
    else if (action === 'session_check') result = await checkSession(body);
    else if (action === 'session_list') result = await listSessions(body);
    else if (action === 'session_revoke') result = await revokeSession(body);
    else if (['transfer_create', 'transfer_redeem', 'recovery_create', 'recovery_redeem', 'local_identity_restore'].includes(action)) {
      throw new LicenseHttpError('设备恢复只允许使用本人的人脸或指纹验证', 403, 'biometric-required', true);
    }
    else if (action === 'ai_identity_sync') result = await syncAIIdentity(body);
    else if (action === 'phone_friend_identity_sync') result = await syncPhoneFriendIdentity(body);
    else throw new Error('未知的授权操作');
    return reply(req, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '授权操作失败';
    console.error('phone-license', message);
    if (error instanceof LicenseHttpError) {
      return reply(req, { ok: false, error: message, code: error.code, permanent: error.permanent }, error.status);
    }
    const status = /频繁|尝试过多|稍后再试/.test(message) ? 429 : /无效|失效|过期|没有|缺少|校验|已经|请输入/.test(message) ? 400 : 500;
    return reply(req, { ok: false, error: message, code: 'license-request-failed', permanent: false }, status);
  }
});
