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

test('home exposes a direct electronic-pet entry',()=>{
  assert.match(app,/pet:\{e:'',c:'#17171c',t:'电子宠物'/);
  assert.match(app,/else if\(c\.p==='pet'\)html=renderPetGame\(\)/);
  assert.match(app,/pet:\(\)=>/);
  assert.match(app,/if\(k==='pet'\)return openPetGame\(\)/);
  assert.match(app,/typeof petRolePrompt==='function'/);
  assert.match(app,/M8 8q4-2 8 0/,'the pet icon should have a closed top bridge');
  assert.match(preview,/M8 8q4-2 8 0/,'the preview icon must match the repaired game-hall icon');
});

test('leaving the pet returns to the existing game hall without creating a loop',()=>{
  assert.match(app,/function openGames\(\)[\s\S]*cur\(\)\.p==='pet'[\s\S]*stack\[stack\.length-2\]\.p==='gameshub'[\s\S]*stack\.pop\(\)/);
  assert.match(app,/if\(cur\(\)\.p==='gameshub'\)return render\(\)/);
});

test('pet state is isolated, persistent and limited to four pets',()=>{
  assert.match(pet,/S\.me\.ePet/);
  assert.match(pet,/const PET_MAX=4/);
  assert.match(pet,/x\.pets\.length>=PET_MAX/);
  assert.match(pet,/已经养了四只宠物|已经住着四只宠物/);
  assert.match(pet,/inventory:\{kibble:3,chicken:1,fish:1,snack:2,medicine:0\}/);
  assert.match(pet,/ownedWear:\[\]/);
  assert.match(pet,/looks=p\.looks\.slice\(-8\)/);
});

test('care loop covers growth, meals, mood, cleaning and sleep',()=>{
  assert.match(pet,/PET_STAGE_NAMES=\['奶团期','幼崽期','少年期','成长期','成年期'\]/);
  assert.match(pet,/Math\.floor\(days\/30\)/,'pet evolves once per real month');
  assert.match(pet,/const PET_STAGE_MONTHS=\[0,1,2,3,4\]/);
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
  assert.match(pet,/Math\.hypot\(p\.roomX-q\.roomX,p\.roomY-q\.roomY\)/,'old overlapping saves should be separated');
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

test('dragging a pet cannot leak a synthesized tap into the bowl or shop',()=>{
  assert.match(pet,/let _petSceneTapBlockUntil=0/);
  assert.match(pet,/function petSceneHotspotAllowed\(e\).*Date\.now\(\)<_petSceneTapBlockUntil/s);
  assert.match(pet,/const blockSceneTap=\(\)=>\{_petSceneTapBlockUntil=Date\.now\(\)\+700;\}/);
  assert.match(pet,/if\(moved\)blockSceneTap\(\)/);
  assert.match(pet,/function petBowl\(e\)\{if\(!petSceneHotspotAllowed\(e\)\)return/);
  assert.match(pet,/else if\(target==='bowl'\)setTimeout\(\(\)=>\{render\(\);petBowl\(\);\},20\)/,'an intentional bowl drop still feeds without a DOM click event');
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
  for(const name of ['奶油橘猫','布偶猫','银渐层','暹罗猫','缅因猫','柴犬','柯基','比熊','金毛'])assert.match(pet,new RegExp(name));
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
  assert.match(pet,/选择\$\{petSpeciesName\(p\.species\)\}品种/);
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

test('Maine Coon, three hamsters and three white rabbit breeds use persistent line-art pets',()=>{
  for(const name of ['缅因猫','金丝熊','布丁仓鼠','银狐仓鼠','纯白侏儒兔','纯白垂耳兔','纯白狮子兔'])assert.match(pet,new RegExp(name));
  assert.equal((pet.match(/hamster:\[/g)||[]).length,1);
  assert.equal((pet.match(/rabbit:\[/g)||[]).length,1);
  assert.match(pet,/function petSpeciesKey\(species\)/,'new species must survive save normalization');
  assert.match(pet,/function petSmallAnimalSvg\(p,opt\)/,'hamsters and rabbits need their own SVG anatomy');
  assert.match(pet,/pet-species-\$\{p\.species\}/);
  assert.match(pet,/petSpeciesCards\(false\)/,'all four species should appear in first adoption');
  assert.match(pet,/petSpeciesCards\(true\)/,'all four species should appear when adopting a second pet');
  assert.match(pet,/十五种品种/);
  assert.match(css,/\.pet-world \.pet-svg\.pet-species-hamster/);
});

test('preview and app load the complete visual module',()=>{
assert.match(html,/pet-game\.css\?v=1872/);
assert.match(html,/pet-game\.js\?v=1872/);
  assert.match(preview,/north-pet-preview/);
  assert.match(preview,/onclick="openPetGame\(\)"/);
  assert.match(css,/assets\/pet-room-v1\.webp/);
  assert.match(css,/\.pet-painter/);
assert.match(sw,/pet-game\.js\?v='\+BUILD/);
  assert.match(sw,/pet-room-v1\.webp/);
});


async function petPrivacyFixture(source=pet){
 const {default:vm}=await import('node:vm');
 const c={account:'main',S:{me:{name:'测试自己'},contacts:[{id:'lover',name:'情侣'},{id:'friend',name:'普通角色'}],couple:{cid:'lover'}},messages:[],modal:'',renders:0,saves:0,confirmResult:true,saveResult:true};
 Object.assign(c,{window:{addEventListener(){}},getC:id=>c.S.contacts.find(r=>r.id===id),isMain:()=>c.account==='main',actId:()=>c.account,esc:x=>String(x??''),save:()=>c.saves++,saveNowAsync:async()=>c.saveResult,render:()=>c.renders++,toast:t=>c.messages.push(t),openModal:html=>c.modal=html,closeModal:()=>c.modal='',uiConfirm:async()=>c.confirmResult,confirm:()=>c.confirmResult,cur:()=>({p:'pet'}),setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
 vm.createContext(c);vm.runInContext(source,c);
 const x=c.petRoot();x.pets=[c.petDefault('cat','保密猫'),c.petDefault('dog','小伙伴')];x.activeId=x.pets[0].id;x.sharedRoleId='lover';return c;
}

test('only the current couple role receives pet state and can become a co-carer',async()=>{
 const c=await petPrivacyFixture(),x=c.petRoot(),lover=c.getC('lover'),friend=c.getC('friend');
 assert.equal(c.petRolePrompt(friend),'','ordinary roles must receive no pet names or state');
 assert.match(c.petRolePrompt(lover),/保密猫/);
 const before=x.sharedRoleId;c.petSetRole('friend');assert.equal(x.sharedRoleId,before,'a direct setter cannot invite another role');
 c.petInviteRole();assert(!c.modal.includes("petSetRole('friend')"));assert(c.modal.includes("petSetRole('lover')"));
 x.sharedRoleId='friend';assert.equal(c.petRole(),null,'old non-couple invitations no longer authorize care');
 c.S.couple.cid='friend';assert.equal(c.petRolePrompt(lover),'','the previous couple loses state access immediately');
 c.account='alt';assert.equal(c.petRolePrompt(friend),'','another account must not receive the main couple pet state');
});

test('deleting a pet requires confirmation, clears its pair link and keeps other belongings',async()=>{
 const c=await petPrivacyFixture(),x=c.petRoot(),first=x.pets[0],other=x.pets[1];first.mateId=other.id;other.mateId=first.id;
 assert.equal(typeof c.petDelete,'function');const coins=x.coins,food=JSON.stringify(x.inventory);
 c.confirmResult=false;await c.petDelete(first.id);assert.equal(x.pets.length,2);
 c.confirmResult=true;await c.petDelete(first.id);assert.equal(x.pets.length,1);assert.equal(x.pets[0].id,other.id);assert.equal(other.mateId,'');assert.equal(x.activeId,other.id);assert.equal(x.coins,coins);assert.equal(JSON.stringify(x.inventory),food);
 await c.petDelete(other.id);assert.equal(x.pets.length,0);assert.equal(x.activeId,'');assert.equal(c.petRolePrompt(c.getC('lover')),'');
});

test('failed pet deletion is rolled back and switching accounts cancels confirmation',async()=>{
 const c=await petPrivacyFixture(),x=c.petRoot(),id=x.activeId;c.saveResult=false;
 await c.petDelete(id);assert(x.pets.some(p=>p.id===id),'failed storage must keep the pet');assert.equal(x.activeId,id);
 c.uiConfirm=async()=>{c.account='alt';return true;};c.saveResult=true;await c.petDelete(id);assert.equal(x.pets.length,2);
});


test('private pet module enforces the same couple-only gate',async()=>{
 const source=readFileSync(join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/pet-game.js'),'utf8');
 assert.equal(source,pet);
 const c=await petPrivacyFixture(source);assert.equal(c.petRolePrompt(c.getC('friend')),'');assert.match(c.petRolePrompt(c.getC('lover')),/保密猫/);
});

test('real web and private pages hide pet status from other roles and delete through the care book',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const priv of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:8778')return route.abort();const f=path.resolve(decodeURIComponent(u.pathname.slice(1))),ok=f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile();return route.fulfill({status:ok?200:404,body:ok?fs.readFileSync(f):'',contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html'});});
  await page.goto('http://127.0.0.1:8778/'+(priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady);
  const proof=await page.evaluate(async()=>{S.me.locked=false;S.settings.sound=false;await northEnsureComponent('pet');const lover=S.contacts[0],friend=S.contacts[1];S.couple=Object.assign(S.couple||{},{cid:lover.id});const x=petRoot();x.pets=[petDefault('cat','保密宠物甲'),petDefault('dog','保密宠物乙')];x.pets.forEach(p=>{p.revealed=true;});x.activeId=x.pets[0].id;x.sharedRoleId=lover.id;x.pets[0].mateId=x.pets[1].id;x.pets[1].mateId=x.pets[0].id;x.logs=[];openPetGame();return{partner:buildSystem(lover).includes('保密宠物甲'),other:buildSystem(friend).includes('保密宠物甲'),coins:x.coins};});
  assert.equal(proof.partner,true);assert.equal(proof.other,false);
  await page.getByRole('button',{name:/手册/}).click();await page.getByRole('button',{name:'删除这只宠物',exact:true}).click();await page.locator('#cfmNo').click();assert.equal(await page.evaluate(()=>petRoot().pets.length),2);
  await page.getByRole('button',{name:'删除这只宠物',exact:true}).click();await page.locator('#cfmYes').click();await page.waitForFunction(()=>petRoot().pets.length===1&&!_petDeleteBusy);
  const left=await page.evaluate(()=>({name:petActive().name,mate:petActive().mateId,coins:petRoot().coins}));assert.deepEqual(left,{name:'保密宠物乙',mate:'',coins:proof.coins});
  await page.getByRole('button',{name:/手册/}).click();await page.getByRole('button',{name:'删除这只宠物',exact:true}).click();await page.locator('#cfmYes').click();await page.waitForFunction(()=>petRoot().pets.length===0&&!_petDeleteBusy);assert(await page.getByText('领养你的').count());assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
});
