import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundle=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function loadStudio(source){
  const start=source.indexOf('const ROLE_IMAGE_OCCASIONS=');
  const end=source.indexOf('\nfunction rolePhotoSceneLogic',start);
  assert.ok(start>=0&&end>start,'missing role image studio core');
  const context=vm.createContext({
    rolePhotoGender:()=>({cn:'成年男性'}),
    rolePhotoPeoplePolicy:()=>'',
    Math:Object.create(Math),
  });
  context.Math.random=()=>0;
  vm.runInContext(source.slice(start,end),context);
  return context;
}
for(const [name,source] of [['web',root],['private bundle',bundle]]){
  const ctx=loadStudio(source);
  const c={id:'c1',imageStudio:{enabled:true,faceMode:'allowed',appearancePrompt:'黑色大背头必须梳理整齐',identityRefs:[],outfits:[
    {id:'sleep',name:'深蓝丝质睡衣',occasion:'home',image:'home-ref',note:'深蓝丝质'},
    {id:'work',name:'白色医生工服',occasion:'work',image:'work-ref',note:'白色制服'},
    {id:'daily',name:'黑色长风衣',occasion:'daily',image:'daily-ref',note:'黑色羊毛'},
  ]}};
  assert.equal(ctx.roleImageFaceMode(c),'hidden',`${name}: no reference must never expose a face`);
  c.imageStudio.identityRefs=[{id:'front',angle:'front',image:'face-front',note:'固定脸型'}];
  assert.equal(ctx.roleImageFaceMode(c),'allowed',`${name}: a fixed identity reference may allow a face`);
  assert.equal(ctx.roleImageWardrobePick(c,'他在家里客厅准备睡觉').id,'sleep');
  assert.equal(ctx.roleImageWardrobePick(c,'他正在医院值班').id,'work');
  assert.equal(ctx.roleImageWardrobePick(c,'在家里穿白色医生工服拍照').id,'work','explicit outfit name overrides scene');
  const sparse={id:'c2',imageStudio:{enabled:true,faceMode:'hidden',identityRefs:[],outfits:[
    {id:'only-home',name:'灰色家居服',occasion:'home',image:'only-home-ref',note:'灰色棉质'},
    {id:'only-work',name:'深色工作服',occasion:'work',image:'only-work-ref',note:'深色制服'},
  ]}};
  assert.equal(ctx.roleImageWardrobePick(sparse,'在健身房跑步').id,'only-home',`${name}: a missing occasion still chooses an enabled wardrobe item`);
  const prompt=ctx.roleImageStudioPrompt(c,{scene:'他正在医院整理病历',requestText:'工作室里拍一张半身照'});
  assert.match(prompt,/角色形象工作室·替代旧外观提示词/);
  assert.match(prompt,/白色医生工服/);
  assert.match(prompt,/【衣柜唯一服装ID:work】/);
  assert.match(prompt,/衣柜服装硬锁·最高优先级/);
  assert.match(prompt,/禁止生成、替换、叠穿或额外添加衣柜外/);
  const scene=ctx.roleImageStudioPrompt(c,{scene:'桌上的咖啡',objectOnly:true});
  assert.match(scene,/ZERO PEOPLE, NO CHARACTER IN FRAME/);
  assert.deepEqual(Array.from(ctx.roleImageGenerateOptions(c,prompt).references),['face-front','work-ref']);
  assert.equal(ctx.roleImageGenerateOptions(c,prompt).outfitId,'work',`${name}: prompt and API references keep the same selected outfit`);
  const sparsePrompt=ctx.roleImageStudioPrompt(sparse,{scene:'在健身房跑步',requestText:'穿红色运动服在健身房跑步'});
  assert.match(sparsePrompt,/【衣柜唯一服装ID:only-home】/);
  assert.match(sparsePrompt,/场景分类没有对应衣服时，本次选择仍然有效/);
  assert.equal(ctx.roleImageGenerateOptions(sparse,sparsePrompt).outfitId,'only-home');
  const empty={id:'empty',imageStudio:{enabled:true,faceMode:'hidden',identityRefs:[],outfits:[]}};
  assert.match(ctx.roleImageGenerateOptions(empty,ctx.roleImageStudioPrompt(empty,{scene:'在客厅拍照'})).blockedReason,/衣柜里没有已启用的衣服/);
  assert.equal(ctx.roleImageStudioTestObjectOnly('坐在沙发上拿着鞭子'),false,`${name}: studio tests default to the role being present`);
  assert.equal(ctx.roleImageStudioTestObjectOnly('只拍沙发和鞭子，不要人物'),true,`${name}: an explicit people exclusion stays object-only`);
  const personTest=ctx.roleImageStudioPrompt(c,{scene:'坐在沙发上拿着鞭子',requestText:'坐在沙发上拿着鞭子',objectOnly:ctx.roleImageStudioTestObjectOnly('坐在沙发上拿着鞭子')});
  assert.match(personTest,/画面人物只能是当前角色本人/,`${name}: the studio test prompt requires the role`);
  assert.doesNotMatch(personTest,/ZERO PEOPLE|NO CHARACTER IN FRAME/,`${name}: the studio test prompt must not inherit the old empty-scene lock`);
  c.imageStudio.identityNote='必须露出脸，不可遮挡';
  const faceTest=ctx.roleImageStudioPrompt(c,{scene:'工作室里认真工作的一张侧脸视角照片',requestText:'工作室里认真工作的一张侧脸视角照片'});
  assert.match(faceTest,/【本次露脸硬要求】/,`${name}: an explicit face request becomes a hard requirement`);
  assert.match(faceTest,/都可以按场景正常出现，但不得遮住眼睛、鼻子、嘴巴/);
  assert.doesNotMatch(faceTest,/禁止手机、手、头发、口罩、阴影、裁切/);
  assert.equal(ctx.roleImageGenerateOptions(c,faceTest).faceMode,'required',`${name}: generation receives the required-face mode instead of the old hidden lock`);
  c.imageStudio.identityNote='固定脸型';
  const ordinaryTest=ctx.roleImageStudioPrompt(c,{scene:'在工作室整理文件',requestText:'在工作室整理文件'});
  assert.match(ordinaryTest,/【本次露脸硬要求】/,`${name}: ordinary character photos keep the face visible`);
  assert.equal(ctx.roleImageGenerateOptions(c,ordinaryTest).faceMode,'required');
  const mirrorTest=ctx.roleImageStudioPrompt(c,{scene:'穿今天的衣服拍一张全身对镜照片',requestText:'穿今天的衣服拍一张全身对镜照片'});
  assert.match(mirrorTest,/【全身对镜遮脸特例】/,`${name}: only an explicit full-body mirror photo permits occasional phone occlusion`);
  assert.equal(ctx.roleImageGenerateOptions(c,mirrorTest).faceMode,'mirror');
  const croppedMirror=ctx.roleImageStudioPrompt(c,{scene:'拍一张对镜半身照',requestText:'拍一张对镜半身照'});
  assert.doesNotMatch(croppedMirror,/【全身对镜遮脸特例】/);
  assert.equal(ctx.roleImageGenerateOptions(c,croppedMirror).faceMode,'required');
  const directCamera=ctx.roleImageStudioPrompt(c,{scene:'不要拿手机遮脸，假装凶一点看镜头',requestText:'不要拿手机遮脸，假装凶一点看镜头'});
  assert.match(directCamera,/脸部清晰无遮挡/,`${name}: negative phone wording becomes a positive visible-face instruction`);
  assert.match(directCamera,/直视镜头/);
  assert.doesNotMatch(directCamera,/不要拿手机遮脸|手机完全遮(?:住)?脸/,`${name}: the final studio prompt cannot retain the legacy phone-cover scene`);
  assert.match(directCamera,/用户没有要求手机时，画面中不要出现手机/);
  assert.equal(ctx.roleImageGenerateOptions(c,directCamera).faceMode,'required');

  assert.match(source,/else if\(c\.p==='roleImageStudio'\)html=renderRoleImageStudio\(c\.id\)/);
  assert.match(source,/未经允许不可侵犯他人肖像权，后果自负。/,`${name}: the studio shows the portrait-rights warning before its controls`);
  assert.match(source,/go\('roleImageStudio',\{id:'\$\{id\}'\}\)/);
  assert.match(source,/没有上传正面或侧面身份参考时，即使选了允许露脸，也会自动按“不允许露脸”执行/);
  assert.match(source,/function imageGenerateReferenceEdit\(/);
  assert.match(source,/input_fidelity','high'/);
  assert.match(source,/genOptions:roleImageStudioOn\(cch\)\?\{roleId:cch\.id\}:null/);
  assert.match(source,/genImage\(prompt,\{roleId:c\.id\}\)/);
  assert.match(source,/roleImageStudioOutfitEdit/);
  assert.match(source,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,`${name}: wardrobe uses a compact two-column grid`);
  assert.match(source,/aria-label="衣物操作"/,`${name}: compact cards retain item actions`);
  assert.match(source,/aria-label="面部参考操作"/,`${name}: face references use compact cards too`);
  assert.match(source,/查看识别详情/,`${name}: long face analysis is hidden behind an optional detail view`);
  assert.doesNotMatch(source,/\$\{esc\(ref\.note\|\|'已作为固定脸参考'\)\}/,`${name}: long face analysis is no longer rendered inline`);
  assert.match(source,/faceMode==='mirror'\?mirror:faceMode==='required'\?required/,`${name}: the final image prompt supports both the narrow mirror exception and the visible-face lock`);
  assert.match(source,/roleImageStudioPrompt\(c,\{scene,requestText:scene,objectOnly,userRequest:scene\}\)/,`${name}: studio test bypasses the legacy face-masking sanitizer`);
  assert.match(source,/scene=studio\?rawScene:sanitizeRolePhotoScene\(rawScene\)/,`${name}: chat images preserve the real request whenever the studio is enabled`);
  assert.match(source,/safe=studio\?\(raw\|\|String\(text\|\|''\)\.slice\(0,180\)\):sanitizeRolePhotoScene/,`${name}: social images also bypass the old face-mask rewrite`);
  assert.match(source,/body=faceMode==='required'\?roleImageStudioVisibleScene\(prompt\)/,`${name}: retries clean legacy phone-cover text before the image request`);
  assert.match(source,/ABSOLUTE WARDROBE RULE/,`${name}: final provider prompt receives an English wardrobe hard lock`);
  assert.match(source,/if\(opt\.blockedReason\)throw new Error\(opt\.blockedReason\)/,`${name}: an empty wardrobe cannot silently generate arbitrary clothing`);
  assert.match(source,/场景没有对应分类时，也会从衣柜其余已启用衣服中挑一件/,`${name}: UI explains the strict fallback behavior`);
}
