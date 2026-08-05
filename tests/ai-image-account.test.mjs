import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const account=fs.readFileSync(path.join(root,'ai-account.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'supabase/functions/phone-ai/index.ts'),'utf8');
const setup=fs.readFileSync(path.join(root,'AI_BACKEND_SETUP.md'),'utf8');

// AI账户不再提供任何内置图片入口、套餐、测试按钮或说明。
assert.doesNotMatch(account,/启用图片生成|图片中转站|图片生成套餐|生成一张图片|购买与生图扣费说明/);
assert.doesNotMatch(account,/AI_PURCHASE_NOTICE|aiImageReady|aiImageRouteCount|aiImagePackageCards|aiToggleImageApi|aiOpenImageGenerator|aiGenerateAccountImage/);

// 付款截图仍是充值流程的一部分，不能随内置生图功能一起删除。
assert.match(account,/accept="image\/\*,\.jpg,\.jpeg,\.png,\.webp,\.heic,\.heif"/);
assert.match(account,/function aiClaimCanvasData\(source,width,height\)/);
assert.match(account,/typeof createImageBitmap==='function'/);
assert.match(account,/当前浏览器不能读取 HEIC\/HEIF/);
assert.match(account,/点数不足提醒/);
assert.match(account,/function aiCheckLowBalance\(balance\)/);
assert.match(account,/语音或影院字幕服务中断/);

// 前端不再读取旧的内置图片开关，也不会向 phone-ai 发送 image 请求。
assert.doesNotMatch(app,/function aiImageInit|function aiImageRelayOn|aiRelay\('image'/);
assert.match(app,/function imageGenerationAvailable\(\)\{const ch=S\.settings\.chat\|\|\{\};return !!\(\(S\.settings\.imgBase\|\|ch\.base\)&&\(S\.settings\.imgKey\|\|ch\.key\)\);\}/);
assert.match(app,/async function genImage\(prompt\)[\s\S]*imageGenerateExternal\(base,key,model,prompt,'1024x1536'\)/);
assert.match(app,/function dgImageConfigured\(\)[\s\S]*S\.settings\.imgBase\|\|ch\.base/);
assert.doesNotMatch(app,/内置图片怎么用|AI账户里开启中转站图片|两个开关都开启/);
assert.match(app,/让角色发真照片[\s\S]*使用下方外置图片接口生成，由对应平台计费/);

// 外置图片能力继续保留，避免破坏用户自己配置的角色真图和绘画功能。
assert.match(app,/function imageGenerateExternal\(base,key,model,prompt,size,quality\)/);
assert.match(app,/const urls=\/\\\/v1\$\/i\.test\(b\)\?\[b\+path\]:\[b\+'\/v1'\+path,b\+path\]/);
assert.match(app,/接口返回网页HTML，不是API JSON/);
assert.match(app,/function imageCollectValues\(v,out\)/);
assert.match(app,/inlineData&&v\.inlineData\.data/);
assert.match(app,/response_format:geminiImage\?'b64_json':'url'/);
assert.match(app,/function imageSizeRatio\(size\)/);
assert.match(app,/aspect_ratio:imageSizeRatio\(target\)/);
assert.match(app,/必须保持画布尺寸.*不要改成方图/);
assert.match(app,/gemini-3\.1-flash-image-preview/);
assert.match(app,/gemini-3-pro-image-preview/);

// 后台先返回 410，再进入任何计费分支；图片能力和部署参数均已移除。
assert.match(backend,/if \(action === "image"\) return json\(\{ ok: false, error: "image-feature-retired" \}, 410\);/);
assert.doesNotMatch(backend,/charge\(userId, clientSecret, "image"\)/);
assert.doesNotMatch(backend,/image:\s*6|image_routes|configuredImageRoutes|generateImageThroughRoute|IMAGE_MODEL|IMAGE_ROUTE_2/);
assert.doesNotMatch(backend,/openai\("\/images\/generations"/);
assert.match(backend,/function recoverStalePendingCharges\(/,'old pending image charges still need safe automatic refunds');
assert.match(backend,/stale-pending-auto-refund/);

assert.doesNotMatch(setup,/IMAGE_MODEL|IMAGE_ROUTE_2|生成图片：|图片备用路线|图片生成复用/);
assert.match(setup,/OPENAI_API_KEY=你的聊天\/识图中转站 key/);

console.log('AI built-in image removal tests passed');
