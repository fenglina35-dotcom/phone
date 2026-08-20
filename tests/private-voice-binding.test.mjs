import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = fs.readFileSync(path.join(root, 'supabase/functions/phone-ai/index.ts'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/202607230003_private_tts_voices.sql'),
  'utf8',
);
const account = fs.readFileSync(path.join(root, 'ai-account.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin/app.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.match(migration, /create table if not exists public\.phone_ai_private_voices/);
assert.match(migration, /voice_id text not null unique/);
assert.match(migration, /purchase_id uuid unique references public\.phone_ai_purchases\(id\) on delete set null/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on table public\.phone_ai_private_voices from anon/);

assert.match(backend, /async function authorizedTTSVoice/);
assert.match(backend, /\.eq\("user_id", userId\)[\s\S]*?\.eq\("voice_id", voiceId\)[\s\S]*?\.eq\("status", "active"\)/);
assert.match(backend, /throw new Error\("tts-private-voice-not-owned"\)/);
assert.match(backend, /if \(action === "admin_assign_private_voice"\)/);
assert.match(backend, /purchase\.status !== "paid" \|\| purchase\.review_status !== "approved"/);
assert.match(backend, /private-voice-not-found-in-minimax-account/);
assert.match(backend, /private_voices: privateVoices/);
assert.match(backend, /const authorizedVoice = await authorizedTTSVoice\(userId, body\.voice_id\);/);
assert.ok(
  backend.indexOf('const authorizedVoice = await authorizedTTSVoice(userId, body.voice_id);')
    < backend.indexOf('const c = await charge(userId, clientSecret, "tts", ttsCost);'),
  'ownership must be verified before any TTS charge',
);
const voiceListRoute = backend.slice(
  backend.indexOf('if (action === "tts_voices")'),
  backend.indexOf('if (action === "external_tts")'),
);
assert.doesNotMatch(voiceListRoute, /minimaxVoices\(\)/);
assert.match(voiceListRoute, /visibleTTSVoicesForUser\(userId\)/);
assert.match(backend, /async function activePrivateVoiceBindings\(\)/);
assert.match(backend, /if \(binding && binding\.user_id !== userId\) return/);
assert.match(backend, /unbound: !!voice\.clone && !binding/);
assert.match(backend, /if \(data\.user_id !== userId\) throw new Error\("tts-private-voice-not-owned"\)/);
assert.match(backend, /const available = await minimaxVoices\(\)/);
assert.match(backend, /async function minimaxVoices\(force = false\)/);
assert.match(backend, /await minimaxVoices\(true\)/);
assert.match(app, /function ttsRelayVoiceIds\(tts\)/);
assert.match(app, /tts\.relayVoice/);
assert.match(app, /typeof aiInternalVoiceId==='function'\?aiInternalVoiceId\(\):tts\.voice/);
assert.match(app, /const ids=ttsRelayVoiceIds\(tts\)/);
assert.doesNotMatch(app, /ttsRelayVoiceIds\(v&&v\.ttsVoice,tts\)/);
assert.match(app, /仅关闭内置语音、使用外置接口时生效/);
assert.match(backend, /\{ id: "qingshouyin20260726", name: "青受音", clone: true, preset: true \}/);
assert.match(backend, /\{ id: "xiayizhou20260725", name: "夏以昼", clone: true, preset: true \}/);

assert.match(account, /onclick="aiPullVoices\(\)"/);
assert.match(account, /\{id:'qingshouyin20260726',name:'青受音',clone:true,preset:true\}/);
assert.match(account, /\{id:'xiayizhou20260725',name:'夏以昼',clone:true,preset:true\}/);
assert.match(account, /系统免费音色和尚未绑定的克隆音色/);
assert.match(account, /未绑定克隆/);
assert.match(account, /新的音色克隆申请入口已经关闭/);
assert.match(account, /已经绑定的克隆音色只对绑定账户显示/);
assert.match(account, /function aiUsePrivateVoice/);
assert.match(account, /S\.settings\.tts\.relayVoice=voice\.voice_id/);
assert.doesNotMatch(account, /function aiUsePrivateVoice\(id\)[^\n]*S\.settings\.tts\.voice=voice\.voice_id/);
assert.match(admin, /绑定客户专属音色/);
assert.match(admin, /admin_assign_private_voice/);

console.log('private voice binding tests passed');
