import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const app=readFileSync(join(root,'app.js'),'utf8');
const pet=readFileSync(join(root,'pet-game.js'),'utf8');
const css=readFileSync(join(root,'pet-game.css'),'utf8');
const html=readFileSync(join(root,'小手机.html'),'utf8');
const preview=readFileSync(join(root,'pet-preview.html'),'utf8');
const sw=readFileSync(join(root,'sw.js'),'utf8');

test('game hall exposes a direct electronic-pet entry',()=>{
  assert.match(app,/\{k:'pet',e:'',n:'电子宠物'/);
  assert.match(app,/else if\(c\.p==='pet'\)html=renderPetGame\(\)/);
  assert.match(app,/g\.k==='pet'\?'openPetGame\(\)'/);
  assert.match(app,/if\(k==='pet'\)return openPetGame\(\)/);
  assert.match(app,/typeof petRolePrompt==='function'/);
  assert.match(app,/M8 8q4-2 8 0/,'the pet icon should have a closed top bridge');
  assert.match(preview,/M8 8q4-2 8 0/,'the preview icon must match the repaired game-hall icon');
});

test('pet state is isolated, persistent and limited to two pets',()=>{
  assert.match(pet,/S\.me\.ePet/);
  assert.match(pet,/x\.pets\.length>=2/);
  assert.match(pet,/已经养了两只宠物|已经住着两只宠物/);
  assert.match(pet,/inventory:\{kibble:3,chicken:1,fish:1,snack:2\}/);
  assert.match(pet,/ownedWear:\[\]/);
  assert.match(pet,/looks=p\.looks\.slice\(-8\)/);
});

test('care loop covers growth, meals, mood, cleaning and sleep',()=>{
  assert.match(pet,/PET_STAGE_NAMES=\['奶团期','幼崽期','少年期','成长期','成年期'\]/);
  assert.match(pet,/days\/15\*12\*boost/,'fifteen real days should equal about one pet year');
  assert.match(pet,/Math\.min\(\.18,/,'good care may accelerate growth by at most eighteen percent');
  assert.match(pet,/breakfast.*lunch.*dinner/s);
  assert.match(pet,/p\.poop>=3\|\|p\.clean<24/);
  assert.match(pet,/petIsNight\(\)\?elapsed\*4\.2/,'night restores energy');
  assert.match(pet,/p\.depressed=/);
  assert.match(pet,/pet-need-bubble/);
});

test('customization and shared care stay in the pet module',()=>{
  assert.match(pet,/蝴蝶结/);
  assert.match(pet,/发卡/);
  assert.match(pet,/项圈/);
  assert.match(pet,/小裙子/);
  assert.match(pet,/针织衫/);
  assert.match(pet,/canvas id="petPaintCanvas"/);
  assert.match(pet,/保存为新形象/);
  assert.match(pet,/function petInviteRole/);
  assert.match(pet,/function petRoleCare/);
  assert.match(pet,/你们共同照顾的电子宠物/);
  assert.match(pet,/function petPair/);
});

test('wardrobe offers several collars and richer decorations with live SVG previews',()=>{
  for(const name of ['软绒项圈','格纹铃铛项圈','珍珠花边项圈','野餐小领巾','春日花环项圈','月光吊坠项圈','雏菊小花夹','软呢小贝雷帽','奶油小皇冠','雨后小斗篷','莓果背带裤','星夜短披风'])assert.match(pet,new RegExp(name));
  assert.ok((pet.match(/type:'neck'/g)||[]).length>=6,'the wardrobe should include at least six neck decorations');
  assert.match(pet,/function petNeckWearSvg/);
  assert.match(pet,/function petHeadWearSvg/);
  assert.match(pet,/function petBodyWearSvg/);
  assert.match(pet,/petNeckWearSvg\(p\.accessories\.neck,accent\)/);
});

test('immersive room uses every visible prop as a real interaction',()=>{
  assert.match(pet,/class="pet-page pet-home-world/);
  assert.match(pet,/aria-label="去小窝睡觉"/);
  assert.match(pet,/aria-label="点击食盆喂饭或购买食物"/);
  assert.match(pet,/aria-label="打开玩具篮选择小球"/);
  assert.match(pet,/function petDragMount/);
  assert.match(pet,/p\.roomX=petClamp/);
  assert.doesNotMatch(pet,/夜深了，它正在自己睡觉/);
  assert.doesNotMatch(pet,/睡眠中 · 活力正在恢复/);
  assert.match(css,/\.pet-home-world\{position:absolute;inset:0/);
  assert.match(css,/\.pet-world>\.pet-room-bg/);
});

test('color preview, roommates and fetch play use separate live state',()=>{
  assert.match(pet,/\+\(\+\+_petSvgNonce\)/,'every SVG render should get a fresh gradient id for WebKit');
  assert.match(pet,/petSvg\(p,\{awake:true\}\)/,'the dress room must show the full awake pet');
  assert.match(pet,/实时全身预览/);
  assert.match(pet,/function petRenderRoomPet/);
  assert.match(pet,/pet-character \$\{active\?'drag-enabled active':'roommate'\}/);
  assert.match(pet,/Math\.hypot\(a\.roomX-b\.roomX,a\.roomY-b\.roomY\)/,'old overlapping saves should be separated');
  assert.match(pet,/function petChooseBall/);
  assert.match(pet,/function petThrowAt/);
  assert.match(pet,/捡到啦/);
  assert.match(pet,/querySelectorAll\('\.pet-character\[data-pet-id\]'\)/,'dragging must bind every pet, not only the active pet');
  assert.match(pet,/function petPlayTogether/);
  assert.match(pet,/一起追到啦/);
  assert.match(css,/\.pet-thrown-ball\.flying/);
  assert.match(css,/@keyframes petBallFlight/);
});

test('pet dragging uses precise prop targets instead of broad accidental snap zones',()=>{
  assert.match(pet,/function petDropTarget/);
  assert.match(pet,/hit\(20,49,10,9\)/,'bed drop target should stay close to the bed center');
  assert.match(pet,/hit\(80,49,9,8\)/,'bowl drop target should stay close to the bowls');
  assert.match(pet,/hit\(19,80,9,7\)/,'toy drop target should stay close to the toy basket');
  assert.doesNotMatch(pet,/px<43&&py>34&&py<68/,'the old broad bed snap rectangle must not return');
  assert.match(pet,/p\.roomY=petClamp\(startY\+dy,22,86\)/);
});

test('mobile pet taps react inside the pointer lifecycle without long-press selection',()=>{
  assert.match(pet,/function petTapDirect\(p\)[\s\S]*petAnimalVoice\(p\.species\)/,'every deliberate awake-pet tap should reach its voice path');
  assert.match(pet,/wasActive=x\.activeId===p\.id/,'pointerdown should remember whether the touched pet was already active');
  assert.match(pet,/else if\(canceled\)\{save\(\);setTimeout\(render,20\);\}else\{_petIgnoreTapUntil=Date\.now\(\)\+450;save\(\);if\(wasActive\)petTapDirect\(p\);else render\(\);\}/,'an unmoved pointerup must react directly instead of waiting for a synthesized mobile click');
  assert.match(pet,/addEventListener\('contextmenu',ev=>ev\.preventDefault\(\)\)/);
  assert.match(pet,/onclick="petCharacterTap\('\$\{q\.id\}',event\)"/,'desktop click fallback should share the guarded pet tap route');
  assert.match(css,/\.pet-world,\.pet-world \*\{[^}]*-webkit-user-select:none;user-select:none;[^}]*-webkit-touch-callout:none;[^}]*-webkit-tap-highlight-color:transparent/);
  assert.match(css,/\.pet-world \.pet-character \.pet-svg,\.pet-world \.pet-character \.pet-room-name\{pointer-events:none\}/,'SVG paths and labels must not steal mobile long presses from the draggable pet');
});

test('sleeping faces use pose-local ears and bichon keeps a closed crown',()=>{
  assert.match(pet,/const sleepEars=/);
  assert.match(pet,/const sleepMark=/);
  assert.match(pet,/Q82 83 102 65q13-25 36-14/,'bichon crown should have an explicit outline');
  assert.doesNotMatch(pet,/translate\(\$\{hx\} \$\{hy\}\) scale\(\$\{flip\}/,'old detached-ear sleeping transform must stay removed');
});

test('cats have a distinct filled tail, softer body and no eyebrow-like mask line',()=>{
  assert.match(pet,/p\.species==='cat'\?`<g class="pet-tail"><path/);
  assert.match(pet,/const body=p\.species==='cat'/);
  assert.match(pet,/p\.breed==='bichon'\?`<g class="pet-tail">/,'bichon keeps its own fluffy tail');
  assert.doesNotMatch(pet,/M145 93q15 11 30 0/,'ragdoll and siamese should not regain the eyebrow-like line');
  assert.doesNotMatch(pet,/M110 118l25 5m75-5-25 5/,'orange cat cheek markings should not look like eyebrows');
});

test('cats and dogs have breed choices and living reactions',()=>{
  for(const name of ['奶油橘猫','布偶猫','银渐层','暹罗猫','柴犬','柯基','比熊','金毛'])assert.match(pet,new RegExp(name));
  assert.match(pet,/function petChooseBreed/);
  assert.match(pet,/function petAnimalVoice/);
  assert.match(pet,/\['spin','jump','lick','voice','hop'\]/);
  assert.match(pet,/sleep-pose-/);
  assert.match(pet,/class="pet-zzz"/);
  assert.match(css,/petWorldLick/);
  assert.match(css,/petWorldSpin/);
  assert.match(css,/petWorldHop/);
  assert.match(css,/petWorldEat/);
  assert.match(css,/petWorldBath/);
  assert.match(css,/petWorldTogether/);
});

test('wardrobe, visual growth, plumpness and diary controls remain discoverable',()=>{
  assert.match(pet,/选择\$\{p\.species==='cat'\?'猫猫':'狗狗'\}品种/);
  assert.match(pet,/未拥有的也可直接购买/);
  assert.match(pet,/function petChangeBreed/);
  assert.match(pet,/function petBuyWearFromStyle/);
  assert.match(pet,/p\.plumpness=petClamp/);
  assert.match(pet,/petSvg\(preview,\{awake:true,stage:i\}\)/);
  assert.match(pet,/function petDeleteLog/);
  assert.match(pet,/function petClearLogs/);
  assert.match(pet,/最近照顾记录/);
  assert.match(pet,/当前需要留意/);
});

test('preview and app load the complete visual module',()=>{
  assert.match(html,/pet-game\.css\?v=824/);
  assert.match(html,/pet-game\.js\?v=824/);
  assert.match(preview,/north-pet-preview/);
  assert.match(preview,/onclick="openPetGame\(\)"/);
  assert.match(css,/assets\/pet-room-v1\.webp/);
  assert.match(css,/\.pet-painter/);
  assert.match(sw,/pet-game\.js\?v=824/);
  assert.match(sw,/pet-room-v1\.webp/);
});
