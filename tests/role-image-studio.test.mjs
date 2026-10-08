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
  const replaceOnly={id:'replace',name:'暗纹黑色哥特长款礼服大衣',occasion:'formal',image:'old-ref',note:'原有补充说明',enabled:false};
  assert.equal(ctx.roleImageStudioOutfitApplyImage(replaceOnly,'new-ref'),true,`${name}: an existing wardrobe image can be replaced`);
  assert.deepEqual({...replaceOnly},{id:'replace',name:'暗纹黑色哥特长款礼服大衣',occasion:'formal',image:'new-ref',note:'原有补充说明',enabled:false},`${name}: image-only replacement preserves every text and state field`);
  assert.equal(ctx.roleImageFaceMode(c),'hidden',`${name}: no reference must never expose a face`);
  c.imageStudio.identityRefs=[{id:'front',angle:'front',image:'face-front',note:'固定脸型'}];
  assert.equal(ctx.roleImageFaceMode(c),'allowed',`${name}: a fixed identity reference may allow a face`);
  assert.equal(ctx.roleImageWardrobePick(c,'他在家里客厅准备睡觉').id,'sleep');
  assert.equal(ctx.roleImageWardrobePick(c,'他正在医院值班').id,'work');
  assert.equal(ctx.roleImageWardrobePick(c,'在家里穿白色医生工服拍照').id,'work','explicit outfit name overrides scene');
  const timed={id:'timed',imageStudio:{enabled:true,faceMode:'hidden',identityRefs:[],outfits:[
    {id:'seven',name:'七点晨装',occasion:'daily',image:'seven-ref',note:'固定晨装',timeStart:'07:00',timeEnd:'09:00'},
    {id:'night',name:'夜间长袍',occasion:'home',image:'night-ref',note:'跨午夜',timeStart:'22:00',timeEnd:'02:00'},
    {id:'random',name:'未固定风衣',occasion:'daily',image:'random-ref',note:'普通随机'},
  ]}};
  assert.equal(ctx.roleImageWardrobePick(timed,'随手拍一张照片',7*60).id,'seven',`${name}: 07:00 enters an exact wardrobe time range`);
  assert.equal(ctx.roleImageWardrobePick(timed,'正在医院工作',8*60+59).id,'seven',`${name}: a fixed time range wins even when its scene category differs`);
  assert.equal(ctx.roleImageWardrobePick(timed,'随手拍一张照片',9*60).id,'random',`${name}: the range end is exclusive and returns to untimed random outfits`);
  assert.equal(ctx.roleImageWardrobePick(timed,'准备睡觉',23*60).id,'night',`${name}: custom wardrobe ranges may cross midnight`);
  assert.equal(ctx.roleImageWardrobePick(timed,'准备睡觉',60).id,'night',`${name}: after-midnight minutes remain inside a crossing range`);
  assert.equal(ctx.roleImageWardrobePick(timed,'穿七点晨装去散步',15*60).id,'seven',`${name}: explicitly naming an outfit still overrides its fixed time`);
  const fixedOnly={imageStudio:{enabled:true,outfits:[{id:'office',name:'晨间工装',occasion:'work',image:'office-ref',timeStart:'07:00',timeEnd:'09:00'}]}};
  assert.equal(ctx.roleImageWardrobePick(fixedOnly,'正在办公室工作',12*60),null,`${name}: an inactive fixed outfit is never reused outside its configured time`);
  const prompt=ctx.roleImageStudioPrompt(c,{scene:'他正在医院整理病历',requestText:'工作室里拍一张半身照'});
  assert.match(prompt,/角色形象工作室·替代旧外观提示词/);
  assert.match(prompt,/白色医生工服/);
  const scene=ctx.roleImageStudioPrompt(c,{scene:'桌上的咖啡',objectOnly:true});
  assert.match(scene,/ZERO PEOPLE, NO CHARACTER IN FRAME/);
  assert.deepEqual(Array.from(ctx.roleImageGenerateOptions(c,prompt).references),['face-front','work-ref']);
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
  assert.doesNotMatch(ordinaryTest,/【本次露脸硬要求】/,`${name}: allowing faces no longer forces a portrait`);assert.match(ordinaryTest,/是否露脸及角度服从本次构图/);
  assert.equal(ctx.roleImageGenerateOptions(c,ordinaryTest).faceMode,'allowed');
  const mirrorTest=ctx.roleImageStudioPrompt(c,{scene:'穿今天的衣服拍一张全身对镜照片',requestText:'穿今天的衣服拍一张全身对镜照片'});
  assert.match(mirrorTest,/【全身对镜遮脸特例】/,`${name}: only an explicit full-body mirror photo permits occasional phone occlusion`);
  assert.equal(ctx.roleImageGenerateOptions(c,mirrorTest).faceMode,'mirror');
  const croppedMirror=ctx.roleImageStudioPrompt(c,{scene:'拍一张对镜半身照',requestText:'拍一张对镜半身照'});
  assert.doesNotMatch(croppedMirror,/【全身对镜遮脸特例】/);
  assert.equal(ctx.roleImageGenerateOptions(c,croppedMirror).faceMode,'allowed');
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
  assert.match(source,/genOptions:roleImageStudioForScene\(cch,/);
  assert.match(source,/genImage\(prompt,\{roleId:c\.id,accountId:photoAccount\}\)/);
  assert.match(source,/roleImageStudioOutfitEdit/);
  assert.match(source,/>仅替换图片<\//,`${name}: the edit modal exposes a dedicated image-only action`);
  const replaceSource=source.slice(source.indexOf('function roleImageStudioOutfitReplaceImage'),source.indexOf('\nfunction roleImageStudioOutfitActions'));
  assert.match(replaceSource,/roleImageStudioOutfitApplyImage\(row,src\)/,`${name}: the replacement path uses the image-only mutator`);
  assert.doesNotMatch(replaceSource,/roleImageStudioDescribe|row\.(?:name|occasion|note|enabled|timeStart|timeEnd)\s*=/,`${name}: replacing an image cannot rerun recognition or rewrite wardrobe metadata`);
  const flowRow={id:'replace',name:'原衣物名',occasion:'formal',image:'old-ref',note:'原补充说明',enabled:false,timeStart:'07:00',timeEnd:'09:00'};
  let pending,saveCount=0,toastText='',reopenedDraft=null;
  const flow=vm.createContext({
    $:key=>({value:key==='#rio_name'?'尚未保存的新名字':key==='#rio_occasion'?'date':'尚未保存的新说明'}),
    pickFile:(_accept,callback)=>{pending=callback({name:'new.png'});},
    getC:()=>({id:'c1'}),roleImageStudioOwner:()=>({id:'c1'}),roleImageStudio:()=>({outfits:[flowRow]}),aiLoad:()=>{},aiDone:()=>{},
    compress:async()=>'new-ref',primeImageForSave:async()=>{},save:()=>{saveCount++;},
    roleImageStudioOutfitReadTimeRange:()=>({enabled:true,start:'10:00',end:'12:00'}),
    roleImageStudioOutfitApplyImage:(row,src)=>{row.image=String(src);return true;},
    roleImageStudioOutfitModal:(_id,draft)=>{reopenedDraft={...draft};},toast:text=>{toastText=text;},
  });
  vm.runInContext(`let _roleImageOutfitDraft=null;${replaceSource};globalThis.setOutfitDraft=v=>{_roleImageOutfitDraft=v}`,flow);
  flow.setOutfitDraft({id:'replace',roleId:'c1',image:'old-ref',name:'原衣物名',occasion:'formal',note:'原补充说明',enabled:false,timeStart:'07:00',timeEnd:'09:00',edit:true});
  flow.roleImageStudioOutfitReplaceImage('c1');
  await pending;
  assert.deepEqual({...flowRow},{id:'replace',name:'原衣物名',occasion:'formal',image:'new-ref',note:'原补充说明',enabled:false,timeStart:'07:00',timeEnd:'09:00'},`${name}: the real picker flow persists only the new image`);
  assert.equal(saveCount,1,`${name}: replacement is saved once`);
  assert.equal(reopenedDraft.image,'new-ref');
  assert.equal(reopenedDraft.name,'尚未保存的新名字',`${name}: unsaved form edits remain visible but are not written by image replacement`);
  assert.equal(reopenedDraft.timeStart,'10:00',`${name}: unsaved time edits remain visible after replacing the image`);
  assert.equal(reopenedDraft.timeEnd,'12:00');
  assert.match(toastText,/文字和时间设置保持不变/);
  assert.match(source,/id="rio_time_fixed" type="checkbox"/,`${name}: every outfit exposes an independent fixed-time switch`);
  assert.match(source,/id="rio_time_start" type="time"/,`${name}: exact start time is editable`);
  assert.match(source,/id="rio_time_end" type="time"/,`${name}: exact end time is editable`);
  assert.match(source,/结束时间早于开始时间时会自动按跨午夜处理/,`${name}: the UI explains crossing-midnight ranges`);
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
}


for(const [name,source] of [['web',root],['private',bundle]]){
  const ctx=loadStudio(source);let account='main';
  const role={id:'r',name:'角色',gender:'男',imageStudio:{enabled:true,faceMode:'allowed',appearancePrompt:'成年男性，浅肤色',identityNote:'必须露脸，不可遮脸',identityRefs:[{id:'r-face',angle:'front',image:'role-face',note:'固定人物'}],outfits:[{id:'r-coat',name:'角色黑外套',occasion:'daily',image:'role-coat',note:'黑色棉质衣袖'}]}};
  const me={id:'main',name:'本人',imageStudio:{enabled:false,gender:'女',faceMode:'allowed',identityRefs:[{id:'u-face',angle:'side',image:'user-face',note:'本人侧面'}],outfits:[{id:'u-shirt',name:'本人白衬衫',occasion:'daily',image:'user-shirt',note:'白色衣袖'}]}};
  ctx.S={me:{accounts:[me,{id:'other',name:'另一个账号'}]}};ctx.actId=()=>account;ctx.getC=id=>id==='r'?role:null;ctx.roleVisualIdentity=()=> '角色原有身份';
  const start=source.indexOf('function rolePhotoExplicitFemale('),end=source.indexOf('function rolePhotoClothesOnlyRequest(',start);vm.runInContext(source.slice(start,end),ctx);
  assert.equal(ctx.roleImageStudioForScene(role,'我和他的合照'),true);
  const before=ctx.roleImageStudioPrompt(role,{scene:'我和他的合照',requestText:'我和他的合照'});
  assert.ok(!before.includes('人物B'),'disabled personal wardrobe never injects the user');
  me.imageStudio.enabled=true;
  const pair=ctx.roleImageStudioPrompt(role,{scene:'我和他的合照',requestText:'我和他的合照',userRequest:'我和他的合照'}),pairOpt=ctx.roleImageGenerateOptions(role,pair);
  assert.match(pair,/人物A.*人物B/);assert.match(pair,/成年女性/);assert.deepEqual(Array.from(pairOpt.references),['role-face','role-coat','user-face','user-shirt']);assert.deepEqual(Array.from(pairOpt.referenceLabels),['当前角色的身份参考','当前角色的衣物参考','用户本人的身份参考','用户本人的衣物参考']);assert.equal(pairOpt.faceMode,'paired');
  for(const scene of ['我和他的手部照片','我们俩牵手特写','只拍他的手腕','脚部特写']){
    const prompt=ctx.roleImageStudioPrompt(role,{scene,requestText:scene,userRequest:scene}),opt=ctx.roleImageGenerateOptions(role,prompt);
    assert.match(prompt,/【局部构图优先】/);assert.doesNotMatch(prompt,/必须露脸|【本次露脸硬要求】/);assert.equal(opt.faceMode,'detail');assert.ok(!Array.from(opt.references).some(ref=>ref.includes('face')),name+' '+scene+' never sends portrait references');
  }
  const back=ctx.roleImageStudioPrompt(role,{scene:'我和他的背影照片',requestText:'我和他的背影照片'});assert.equal(ctx.roleImageGenerateOptions(role,back).faceMode,'back');assert.doesNotMatch(back,/【本次露脸硬要求】/);
  const objects=ctx.roleImageStudioPrompt(role,{scene:'只拍桌上咖啡，不要人物',objectOnly:true});assert.deepEqual(Array.from(ctx.roleImageGenerateOptions(role,objects).references),[]);
  const mother=ctx.roleImageStudioPrompt(role,{scene:'和妈妈合照',requestText:'和妈妈合照',userRequest:'和妈妈合照'});assert.ok(!mother.includes('用户本人的身份'),'another named woman is not replaced by the user');
  const first=ctx.userImageStudioContact(false);assert.equal(first.imageStudio,me.imageStudio);account='other';assert.equal(ctx.roleImageStudioOwner(first.id),null);assert.equal(ctx.userImageStudioContact(false),null);const other=ctx.userImageStudioContact(true);ctx.roleImageStudio(other,true);assert.equal(other.imageStudio.enabled,false);assert.notEqual(other.imageStudio,me.imageStudio);account='main';assert.equal(ctx.userImageStudioContact(false),first);
  const normalizeStart=source.indexOf('function normalizeAccount('),normalizeEnd=source.indexOf('\nfunction initAccounts',normalizeStart);ctx.accountIdOK=()=>true;ctx.genWxid=()=> 'fixture';vm.runInContext(source.slice(normalizeStart,normalizeEnd),ctx);assert.equal(ctx.normalizeAccount(me,0,new Set()).imageStudio,me.imageStudio,'normalizing the account preserves its wardrobe');
  assert.equal(ctx.roleImageFrame('不要背影，要正脸'),'natural');assert.equal(ctx.roleImageFrame('别露脸'),'covered');assert.equal(ctx.roleImageFrame('不要拿手机遮脸，看镜头'),'natural');
  const hidden=ctx.roleImageStudioPrompt(role,{scene:'自然全身对镜照',requestText:'全身对镜照，别露脸，手机自然挡脸',userRequest:'全身对镜照，别露脸，手机自然挡脸'});assert.equal(ctx.roleImageGenerateOptions(role,hidden).faceMode,'covered');assert.match(hidden,/不强行改成背影/);
  const solo=ctx.roleImageStudioPrompt(role,{scene:'本人在窗边',requestText:'拍我的照片',userRequest:'拍我的照片'}),soloOpt=ctx.roleImageGenerateOptions(role,solo);assert.match(solo,/【仅用户本人入镜】/);assert.ok(!Array.from(soloOpt.references).includes('role-face'));assert.ok(Array.from(soloOpt.references).includes('user-face'));
  role.imageStudio.identityRefs.push({id:'rside',angle:'side',image:'role-side',note:'角色侧面'});const side=ctx.roleImageStudioPrompt(role,{scene:'自然生活照',requestText:'只拍角色侧脸，朝窗外看',userRequest:'只拍角色侧脸，朝窗外看'});assert.match(side,/用户原要求：只拍角色侧脸，朝窗外看/);assert.equal(ctx.roleImageGenerateOptions(role,side).references[0],'role-side');
  const duplicate=ctx.roleImageStudioPrompt(role,{scene:'角色黑外套自然照片',requestText:'角色黑外套自然照片'});role.imageStudio.outfits.push({id:'r-other',name:'角色黑外套',occasion:'daily',image:'wrong-coat',note:'另一件衣服'});ctx.Math.random=()=>.99;assert.ok(!Array.from(ctx.roleImageGenerateOptions(role,duplicate).references).includes('wrong-coat'),'the chosen outfit id survives duplicate names and another random draw');

}
