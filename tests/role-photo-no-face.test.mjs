import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 9);
  return source.slice(start, next < 0 ? source.length : next);
}

const context = vm.createContext({});
vm.runInContext(functionSource(app, "sanitizeRolePhotoScene"), context);
vm.runInContext(functionSource(app, "rolePhotoPromptLocked"), context);
vm.runInContext(functionSource(app, "rolePhotoClothesOnlyRequest"), context);
vm.runInContext(functionSource(app, "rolePhotoWearableKind"), context);
vm.runInContext(functionSource(app, "rolePhotoOutfitRequest"), context);
vm.runInContext(functionSource(app, "rolePhotoSceneOnlyRequest"), context);

const sanitized = context.sanitizeRolePhotoScene("拍一张露脸、完整正脸、清晰侧脸、看镜头的镜子自拍");
assert.doesNotMatch(sanitized, /露脸|正脸|侧脸|看镜头|五官|面部|脸部/);
assert.match(sanitized, /手机完全遮住脸/);

const locked = context.rolePhotoPromptLocked("character wearing a suit");
assert.equal((locked.match(/ABSOLUTE COMPOSITION AND GENDER RULE:/g) || []).length, 1);
assert.match(locked, /phone fully covering the face/i);
assert.match(locked, /keep the head/i);
assert.match(locked, /no face or recognizable facial features may appear/i);
assert.match(locked, /Never use a random stock selfie person/i);
assert.match(locked, /preserve the exact character identity, biological sex, time, lighting, and location/i);
assert.match(locked, /zero women, girls, female bodies, female hands/i);
assert.match(locked, /night view, street view, sky, weather, object, food, pet/i);
assert.match(locked, /ZERO PEOPLE and NO CHARACTER IN FRAME/);

assert.equal(context.rolePhotoSceneOnlyRequest('给我发一张今晚的城市夜景照片'), true);
assert.equal(context.rolePhotoSceneOnlyRequest('拍一张窗外的晚霞给我'), true);
assert.equal(context.rolePhotoSceneOnlyRequest('拍你站在夜景前的背影'), false);
assert.equal(context.rolePhotoSceneOnlyRequest('自拍一张你和夜景'), false);

assert.doesNotMatch(app, /aiRelay\('image'/);
assert.match(app, /function roleVisualIdentity\(c\)/);
assert.match(app, /Same exact character identity and biological sex, no gender swap, no random stock selfie/);
assert.match(app, /function rolePhotoSceneLogic\(c,rawScene\)/);
assert.match(app, /当前真实时间是/);
assert.match(app, /照片背景、光线、衣着状态和上一句聊天必须连贯/);
assert.match(app, /不能生成白天、海边、飞机窗边、咖啡店等无关背景/);
assert.match(app, /你的样子\|现在的样子\|看看你\|看你\|想看你\|想看看你/);
assert.match(app, /directSceneOnly=rolePhotoSceneOnlyRequest\(directUserRequest\)/);
assert.match(app, /const wantsSelf=!directSceneOnly&&/);
assert.match(app, /风景\|夜景\|街景\|城市灯光/);
assert.match(app, /ZERO PEOPLE, NO CHARACTER IN FRAME/);
assert.match(app, /如果是夜景、风景、街景、天空、晚霞或天气/);
assert.match(app, /【最高优先级构图锁】整张图片绝对不能出现任何人的脸或可辨认五官/);
assert.match(app, /不要默认无头裁切|不要默认把整个头部裁到画面外/);
assert.match(app, /手机完全挡住整张脸/);
assert.match(app, /【最终检查】画面中零张脸、零个可见五官/);
assert.match(app, /遮脸硬规则，优先级最高/);
assert.match(app, /function retryGeneratedImage\(cid,mid\)/);
assert.match(app, /外置图片平台限流或没有成功出图，请稍后重试/);
assert.match(app, /点这里重试/);

assert.match(backend, /image-feature-retired/);
assert.doesNotMatch(backend, /ROLE_PHOTO_NO_FACE_GUARD|generateImageThroughRoute|guardedImagePrompt/);
