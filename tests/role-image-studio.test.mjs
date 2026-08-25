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
  const prompt=ctx.roleImageStudioPrompt(c,{scene:'他正在医院整理病历',requestText:'工作室里拍一张半身照'});
  assert.match(prompt,/角色形象工作室·替代旧外观提示词/);
  assert.match(prompt,/白色医生工服/);
  const scene=ctx.roleImageStudioPrompt(c,{scene:'桌上的咖啡',objectOnly:true});
  assert.match(scene,/ZERO PEOPLE, NO CHARACTER IN FRAME/);
  assert.deepEqual(Array.from(ctx.roleImageGenerateOptions(c,prompt).references),['face-front','work-ref']);

  assert.match(source,/else if\(c\.p==='roleImageStudio'\)html=renderRoleImageStudio\(c\.id\)/);
  assert.match(source,/go\('roleImageStudio',\{id:'\$\{id\}'\}\)/);
  assert.match(source,/没有上传正面或侧面身份参考时，即使选了允许露脸，也会自动按“不允许露脸”执行/);
  assert.match(source,/function imageGenerateReferenceEdit\(/);
  assert.match(source,/input_fidelity','high'/);
  assert.match(source,/genOptions:roleImageStudioOn\(cch\)\?\{roleId:cch\.id\}:null/);
  assert.match(source,/genImage\(prompt,\{roleId:c\.id\}\)/);
  assert.match(source,/roleImageStudioOutfitEdit/);
}
