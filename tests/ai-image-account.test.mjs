import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const account=fs.readFileSync(path.join(root,'ai-account.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'supabase/functions/phone-ai/index.ts'),'utf8');
const setup=fs.readFileSync(path.join(root,'AI_BACKEND_SETUP.md'),'utf8');

assert.doesNotMatch(account,/启用图片生成|图片中转站|图片生成套餐|生成一张图片|购买与生图扣费说明/);
assert.doesNotMatch(account,/AI_PURCHASE_NOTICE|aiImageReady|aiImageRouteCount|aiImagePackageCards|aiToggleImageApi|aiOpenImageGenerator|aiGenerateAccountImage/);

assert.doesNotMatch(account,/aiClaimCanvasData|aiClaimImageData|上传付款截图/);
assert.match(account,/点数不足提醒/);
assert.match(account,/function aiCheckLowBalance\(balance\)/);
assert.match(account,/新的点数购买入口已经关闭/);
assert.match(account,/内置 AI 用途范围/);
assert.match(account,/仅用于语音生成和影院字幕识别；不用于普通聊天、聊天识图或聊天生图/);
assert.match(app,/function aiCoreOn\(\)\{return false;\}/);

assert.doesNotMatch(app,/function aiImageInit|function aiImageRelayOn|aiRelay\('image'/);
assert.match(app,/function imageGenerationAvailable\(\)\{const ch=S\.settings\.chat\|\|\{\};return !!\(\(S\.settings\.imgBase\|\|ch\.base\)&&\(S\.settings\.imgKey\|\|ch\.key\)\);\}/);
assert.match(app,/async function genImage\(prompt,opt\)[\s\S]*imageGenerateExternal\(base,key,model,prompt,'1024x1536','medium',\{references\}\)/);
assert.match(app,/function dgImageConfigured\(\)[\s\S]*S\.settings\.imgBase\|\|ch\.base/);
assert.doesNotMatch(app,/内置图片怎么用|AI账户里开启中转站图片|两个开关都开启/);
assert.match(app,/让角色发真照片[\s\S]*使用下方外置图片接口生成，由对应平台计费/);

assert.match(app,/function imageGenerateExternal\(base,key,model,prompt,size,quality\)/);
assert.match(app,/function imageCollectValues\(v,out\)/);
assert.match(app,/inlineData&&v\.inlineData\.data/);
assert.match(app,/response_format:geminiImage\?'b64_json':'url'/);
assert.match(app,/function imageSizeRatio\(size\)/);
assert.match(app,/aspect_ratio:imageSizeRatio\(target\)/);
assert.match(app,/必须保持画布尺寸.*不要改成方图/);

assert.match(backend,/if \(action === "image"\) return json\(\{ ok: false, error: "image-feature-retired" \}, 410\);/);
assert.doesNotMatch(backend,/charge\(userId, clientSecret, "image"\)/);
assert.doesNotMatch(backend,/image:\s*6|image_routes|configuredImageRoutes|generateImageThroughRoute|IMAGE_MODEL|IMAGE_ROUTE_2/);
assert.doesNotMatch(backend,/openai\("\/images\/generations"/);
assert.match(backend,/function recoverStalePendingCharges\(/);
assert.match(backend,/stale-pending-auto-refund/);

assert.doesNotMatch(setup,/IMAGE_MODEL|IMAGE_ROUTE_2|生成图片：|图片备用路线|图片生成复用/);
assert.match(setup,/OPENAI_API_KEY=你的聊天\/识图中转站 key/);
assert.match(setup,/购买渠道已关闭/);

console.log('AI built-in image removal tests passed');
