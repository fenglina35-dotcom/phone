import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const backend=fs.readFileSync(new URL('../supabase/functions/phone-ai/index.ts',import.meta.url),'utf8');

function functionSource(source,name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const next=source.indexOf('\nfunction ',start+9);
  return source.slice(start,next<0?source.length:next);
}

const context=vm.createContext({});
for(const name of ['rolePhotoClothesOnlyRequest','rolePhotoWearableKind','rolePhotoOutfitRequest','rolePhotoSceneOnlyRequest']){
  vm.runInContext(functionSource(app,name),context);
}

assert.equal(context.rolePhotoWearableKind('发呀黑白色女仆装，记得拍身材好一点'),'outfit');
assert.equal(context.rolePhotoWearableKind('我想看你的西装'),'outfit');
assert.equal(context.rolePhotoWearableKind('手表戴在手上，只拍一只手给我'),'wearable');
assert.equal(context.rolePhotoWearableKind('把戒指戴起来给我看'),'wearable');
assert.equal(context.rolePhotoWearableKind('给我看看你戴的项链'),'wearable');
assert.equal(context.rolePhotoWearableKind('把鞋穿上拍脚部'),'outfit');
assert.equal(context.rolePhotoWearableKind('把新买的胸针佩戴上给我看看'),'wearable');
assert.equal(context.rolePhotoWearableKind('把手表摘下来放桌上，只拍手表本身'),'');
assert.equal(context.rolePhotoClothesOnlyRequest('把手表摘下来放桌上，只拍手表本身'),true);
assert.equal(context.rolePhotoClothesOnlyRequest('只拍衣架上挂着的西装'),true);
assert.equal(context.rolePhotoSceneOnlyRequest('在卧室拍你穿黑白女仆装的全身照'),false);
assert.equal(context.rolePhotoSceneOnlyRequest('拍一下卧室桌面'),true);

const promptContext=vm.createContext({
  msgs:()=>[
    {role:'user',content:'发呀女仆装黑白色的哦，记得拍身材好一点'},
    {role:'assistant',type:'image',desc:'错误的普通自拍'},
    {role:'user',content:'是拍女仆装！重新发'},
    {role:'assistant',content:'你要的是裙子款？'},
    {role:'user',content:'对'},
    {role:'user',content:'求你了，最后一次了'},
  ],
  msgToText:m=>m.content,
  buildImgLock:()=>({}),
  sanitizeRolePhotoScene:s=>s,
  rolePhotoPairWithUser:()=>false,
  rolePhotoGender:()=>({cn:'成年男性'}),
  rolePhotoSceneLogic:()=>'',
  rolePhotoPeoplePolicy:()=>'',
  roleVisualIdentity:()=>'',
});
for(const name of ['rolePhotoClothesOnlyRequest','rolePhotoWearableKind','rolePhotoOutfitRequest','rolePhotoSceneOnlyRequest','rolePhotoLatestUserImageRequest','rolePhotoContextRequest','charImgPrompt']){
  vm.runInContext(functionSource(app,name),promptContext);
}
const merged=promptContext.rolePhotoContextRequest({id:'c1'});
assert.match(merged,/黑白色/);
assert.match(merged,/女仆装/);
assert.match(merged,/身材/);
assert.match(merged,/已确认：你要的是裙子款/);
const maidPrompt=promptContext.charImgPrompt({id:'c1'},'床上叠放着一套黑白女仆装');
assert.match(maidPrompt,/用户图片要求·最高优先级/);
assert.match(maidPrompt,/当前角色本人实际穿上或戴上/);
assert.match(maidPrompt,/黑白色/);
assert.match(maidPrompt,/裙子款/);
assert.match(maidPrompt,/不要只拍衣服、饰品、衣架、床、桌面或空房间/);

promptContext.msgs=()=>[{role:'user',content:'我想看你的手表，只拍一只手给我'}];
const watchPrompt=promptContext.charImgPrompt({id:'c1'},'桌上放着一块银色手表');
assert.match(watchPrompt,/当前角色本人实际穿上或戴上/);
assert.match(watchPrompt,/只拍一只手给我/);

promptContext.msgs=()=>[{role:'user',content:'把鞋穿上拍给我看'}];
const shoesPrompt=promptContext.charImgPrompt({id:'c1'},'地上放着一双黑色鞋');
assert.match(shoesPrompt,/当前角色本人实际穿上或戴上/);
assert.match(shoesPrompt,/不固定成某一种/);

promptContext.msgs=()=>[{role:'user',content:'戴上眼镜拍给我看'}];
const glassesPrompt=promptContext.charImgPrompt({id:'c1'},'桌上有一副眼镜');
assert.match(glassesPrompt,/当前角色本人实际穿上或戴上/);
assert.match(glassesPrompt,/不固定成某一种/);

promptContext.msgs=()=>[
  {role:'user',content:'发张你穿西装的照片'},
  {role:'assistant',type:'image',desc:'西装自拍'},
  {role:'user',content:'拍一下窗外夜景'},
];
assert.equal(promptContext.rolePhotoContextRequest({id:'c1'}),'拍一下窗外夜景');

assert.match(app,/先结合最近几句对话提取主体、颜色、款式和构图/);
assert.match(app,/imageGenerateExternal\(base,key,model,prompt,'1024x1536'\)/);
assert.match(backend,/image-feature-retired/);
assert.doesNotMatch(backend,/guardedChatImagePrompt|generateImageThroughRoute/);

console.log('role photo wearable tests passed');
