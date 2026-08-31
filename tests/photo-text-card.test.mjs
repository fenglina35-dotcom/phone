import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const shells=[
  '小手机.html',
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html'
];

test('role photos keep real generation when configured and use an image card otherwise',()=>{
  assert.match(app,/if\(S\.settings\.imgGen&&imageGenerationAvailable\(\)\)\{[\s\S]*?fillGenImage\(msg,prompt\)/);
  assert.match(app,/return \{role:'assistant',type:'image',src:'',textCard:true,desc:desc\|\|'一张没有补充描述的照片'/);
  assert.doesNotMatch(app,/return \{role:'assistant',type:'text',content:'\[图片\]'/);
});

test('user can send a described photo card and the role receives image semantics',()=>{
  assert.match(app,/chatFunctionItem\('图文描述','camera',`cPhotoText\('\$\{id\}'\)`\)/);
  assert.match(app,/function cPhotoText\(id\)[\s\S]*?id="photo_text_desc"[\s\S]*?sendPhotoTextCard/);
  assert.match(app,/function sendPhotoTextCard\(id\)[\s\S]*?role:'user',type:'image',src:'',textCard:true[\s\S]*?visionState:'success'/);
  assert.match(app,/我发了一张图文照片卡。这在聊天里是一张图片/);
  assert.match(app,/只能把这段描述当作画面事实来理解并自然回应，不能添加描述里不存在的视觉细节/);
});

test('photo text cards render as white cards in both WeChat themes',()=>{
  assert.match(app,/if\(m\.textCard\)return `<div class="photo-text-card"[\s\S]*?<div class="photo-text-title">照片<\/div>/);
  for(const rel of shells){
    const html=fs.readFileSync(path.join(root,rel),'utf8');
    assert.match(html,/\.photo-text-card\{[^}]*background:#fff[^}]*color:#717278/);
    assert.match(html,/\.photo-text-title\{[^}]*height:42px[^}]*color:#a5a6ab[^}]*font-size:14px/);
    assert.match(html,/\.photo-text-desc\{[^}]*color:#717278/);
    assert.match(html,/\.photo-text-card\{[^}]*height:auto[^}]*max-height:none/);
    assert.match(html,/\.photo-text-title\{[^}]*flex:none/);
    assert.match(html,/\.photo-text-desc\{[^}]*max-height:none[^}]*overflow:visible[^}]*-webkit-line-clamp:unset/);
    assert.match(html,/\.wxlight \.photo-text-card\{/);
  }
});

test('prompt explicitly separates configured real photos from fallback cards',()=>{
  assert.match(app,/发真实照片：[\s\S]*?系统会真的生成一张照片发给ta/);
  assert.match(app,/发图文照片：当前没有可用的图片生成模型/);
  assert.match(app,/图片生成功能可用时会生成真实图片，不可用时会显示白色图文照片卡/);
});

test('per-role image frequency is opt-in and keeps current behavior when disabled',()=>{
  assert.match(app,/if\(c\.photoFreqEnabled==null\)c\.photoFreqEnabled=false/);
  assert.match(app,/发送图片频率<br><small[^>]*>默认关闭：沿用当前由角色自己决定的方式/);
  assert.match(app,/\[\[1,'偶尔'\],\[2,'经常'\],\[3,'高频'\]\]/);
  assert.match(app,/function rolePhotoFrequencyPrompt\(c\)[\s\S]*?这个设置只改变倾向，不允许为了达到频率捏造照片/);
  assert.match(app,/function roleServerPushRecentContext\(c\)[\s\S]*?rolePhotoFrequencyContext\(c\)/,'the same preference reaches background proactive messages');
  assert.match(app,/function roleSocialVisualPlan\(c,platform,text\)[\s\S]*?if\(!real\)return roleSocialCardPlan\(c,platform,text\)/,'unconfigured Moments do not spend another model call');
  assert.match(app,/function roleSocialCardPlan\(c,platform,text\)[\s\S]*?!c\.photoFreqEnabled/,'default-off autonomous Moments remain text-only without image configuration');
});

test('Moments offer real photos and described photo cards as separate choices',()=>{
  assert.match(app,/function postMoment\(\)[\s\S]*?添加真实照片[\s\S]*?添加图文照片/);
  assert.match(app,/id="mm_card_desc"[\s\S]*?这是图文照片卡，不会调用生图模型/);
  assert.match(app,/function doPostMoment\(\)[\s\S]*?photoCards:cardDesc\?\[\{desc:cardDesc\.slice\(0,500\)\}\]:\[\]/);
  assert.match(app,/function momentHTML\(p\)[\s\S]*?momentPhotoCards\(p\.photoCards\)\.map\(momentPhotoCardHTML\)/);
  assert.match(app,/function reactToMyMoment\(p\)[\s\S]*?图文照片卡，照片描述是/,'roles receive the user-authored visual fact');
});

test('role Moments use configured generation and only fall back to cards when generation is unavailable',()=>{
  assert.match(app,/function roleSocialMedia\(c,platform,text\)[\s\S]*?S\.settings\.imgGen&&imageGenerationAvailable\(\)[\s\S]*?roleSocialImages[\s\S]*?platform==='moment'[\s\S]*?photoCards:\[\{desc:plan\.imagePrompt\}\]/);
  assert.match(app,/function postRoleMoment\(c,tx,opt\)[\s\S]*?!S\.settings\.imgGen\|\|!imageGenerationAvailable\(\)[\s\S]*?publishRoleMomentCardFallback/);
  assert.match(app,/function publishRoleMomentCardFallback\(c,tx,opt\)[\s\S]*?photoCards:\[roleMomentFallbackCard/);
});

test('web and private bundle app scripts stay byte-identical',()=>{
  const bundled=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),'utf8');
  for(const marker of [
    "chatFunctionItem('图文描述','camera'",'function sendPhotoTextCard(id)',
    'function rolePhotoFrequencyPrompt(c)','function roleSocialVisualPlan(c,platform,text)',
    'function postRoleMoment(c,tx,opt)','function publishRoleMomentCardFallback(c,tx,opt)',
  ])assert.ok(bundled.includes(marker),`private photo-card marker missing: ${marker}`);
});
