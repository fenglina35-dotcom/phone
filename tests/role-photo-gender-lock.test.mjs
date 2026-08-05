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
for (const name of [
  "rolePhotoGender",
  "rolePhotoExplicitFemale",
  "rolePhotoPairWithUser",
  "rolePhotoPeoplePolicy",
]) {
  vm.runInContext(functionSource(app, name), context);
}

const male = { name: "顾沉", gender: "男", relation: "恋人", persona: "用户可能是女生，但你本人是成年男性" };
assert.equal(context.rolePhotoGender(male).cn, "成年男性");

const inventedWoman = context.rolePhotoPeoplePolicy(
  male,
  "一个漂亮女人替角色拍照，旁边还有女路人",
  "给我拍一张你自己的生活照",
);
assert.match(inventedWoman, /女性人数必须为0/);
assert.match(inventedWoman, /AI自己写在画面描述里的女性词无效/);
assert.match(inventedWoman, /用户和接收照片的人必须在镜头外/);

const handHolding = context.rolePhotoPeoplePolicy(
  male,
  "两个人牵手",
  "我想看我和你的牵手照片",
);
assert.match(handHolding, /用户亲口要求两人互动/);
assert.match(handHolding, /中性手部或手臂边缘/);
assert.match(handHolding, /不推断用户性别/);

const explicitWoman = context.rolePhotoPeoplePolicy(
  male,
  "男性角色和一位女性朋友合照",
  "拍一张你和一位女性朋友的合照",
);
assert.match(explicitWoman, /当前角色.*始终是成年男性/);
assert.match(explicitWoman, /只有描述中被明确点名的女性可以出现/);

assert.match(app, /男性照片铁律，优先级最高/);
assert.match(app, /“恋人、对象、用户、我、收照片的人”都不等于女性/);
assert.match(app, /function rolePhotoLatestUserImageRequest\(c\)/);
assert.match(app, /const directUserRequest=rolePhotoContextRequest\(c\)\|\|rolePhotoLatestUserImageRequest\(c\)/);
assert.match(app, /只有用户亲口提出的要求可以授权女性入镜/);
assert.match(app, /imageGenerateExternal\(base,key,model,prompt,size,quality\)\{const p=\(prompt\|\|'一张生活照'\)\.slice\(0,3200\)/);
assert.match(app, /const rawPrompt=String\(prompt\|\|''\)/);

assert.match(backend, /image-feature-retired/);
assert.doesNotMatch(backend, /guardedImagePrompt|generateImageThroughRoute|charge\(userId, clientSecret, "image"\)/);

console.log("role photo gender lock tests passed");
