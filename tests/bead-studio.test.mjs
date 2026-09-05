import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const bead=fs.readFileSync(new URL('../bead-studio.js',import.meta.url),'utf8');
const privateRoot=new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/',import.meta.url);
const privateApp=fs.readFileSync(new URL('app.js',privateRoot),'utf8');
const privateHtml=fs.readFileSync(new URL('index.html',privateRoot),'utf8');
const privateBead=fs.readFileSync(new URL('bead-studio.js',privateRoot),'utf8');

function runtime(){
  let id=0;const scheduled=[];
  const head={appendChild(){}};
  const sandbox=vm.createContext({console,JSON,Math,Date,String,Array,Number,Object,Set,Map,Promise,
    window:{devicePixelRatio:1},document:{createElement:()=>({style:{},click(){},getContext:()=>({})}),head,getElementById:()=>null,querySelectorAll:()=>[]},
    S:{me:{name:'我'}},uid:()=>`u${++id}`,getC:cid=>({id:cid,name:'先生',remark:'先生'}),save(){},render(){},toast(){},requestAnimationFrame(){},setTimeout(){},setInterval(){return 1},clearInterval(){},
    gameLineIcon:()=>'',esc:s=>String(s),closeModal(){},openModal(){},go(){},openGames(){},uiConfirm:async()=>true,chatAPI:async()=>'',buildSystem:()=>'',gameModelUseAux:()=>false,roleChatRouteIndex:()=>0,cleanReply:s=>String(s),parseObj:JSON.parse,gameSetHandoff(){},featureEventNote:(kind,detail)=>`[功能事件即时反应｜${kind}]\n${detail}`,scheduleReply:(cid,note)=>{scheduled.push({cid,note});return true;},stack:[{p:'home'},{p:'gameshub'},{p:'beadstudio'}],NORTH_PREVIEW_PARAMS:''
  });
  sandbox.window.window=sandbox.window;sandbox.window.document=sandbox.document;sandbox.window.__northBootReady=false;
  vm.runInContext(bead+'\nthis.__out=window.__beadTest;',sandbox);
  sandbox.__out.__sandbox=sandbox;sandbox.__out.__scheduled=scheduled;
  return sandbox.__out;
}

test('game hall routes the shared Bead Atelier in web and private runtimes',()=>{
  for(const source of [app,privateApp]){
    assert.match(source,/\{k:'beads',e:'',n:'像素拼拼乐',tag:'上传图片 · 百级精细方格'\}/);
    assert.match(source,/c\.p==='beadstudio'/);
    assert.match(source,/if\(k==='beads'&&typeof beadOpenSetup==='function'\)/);
    assert.match(source,/beadstudio:'games'/);
    assert.match(source,/m\.game==='beads'/);
    assert.match(source,/<button type="button" class="l" onclick="home\(\)" aria-label="返回主屏幕">/,'the game lobby back control must be a real accessible button');
    assert.match(source,/c\.p==='gameshub'[\s\S]{0,120}onclick=back/,'the lobby returns through its real route stack so WeChat and home entries both remain correct');
  }
  assert.match(html,/bead-studio\.js\?v=1192&r=v1184-pixel-puzzle-4/);
  assert.match(privateHtml,/bead-studio\.js\?v=1190&r=v1184-pixel-puzzle-4/);
  assert.match(sw,/bead-studio\.js\?v='\+BUILD\+'\&r=v1184-pixel-puzzle-4/);
  assert.equal(privateBead,bead,'web and private App must use the same Bead Atelier runtime');
});

test('new games start blank and cannot bypass the upload-only design gate',()=>{
  const b=runtime();
  for(const size of [8,16,32,104,128]){
    const g=b.fresh('r1',size,size);
    assert.equal(g.target.length,size*size);
    assert.equal(g.board.length,size*size);
    assert.equal(b.total(g),0,`${size}x${size} should wait for an upload`);
    assert.equal(g.template,'upload');
  }
  const malformed={cols:99,rows:2,target:['#fff']},fixed=b.normalize(malformed);
  assert.equal(fixed.cols,99);assert.equal(fixed.rows,8);assert.equal(fixed.target.length,792);
  assert.doesNotMatch(bead,/onclick="beadTemplate\('/,'built-in heart, flower and cat presets must not be exposed');
  assert.match(bead,/g\.template!=='image'\|\|!g\.sourceName/,'locking is impossible before a real image upload');
});

test('leaving a continued canvas returns to the lobby once and then reaches home',()=>{
  const b=runtime();
  b.exit();
  assert.deepEqual(Array.from(b.__sandbox.stack,x=>x.p),['home','gameshub']);
  b.__sandbox.stack.pop();
  assert.deepEqual(Array.from(b.__sandbox.stack,x=>x.p),['home']);
});

test('wrong user colors are rejected and role selection can only use unfinished target cells',()=>{
  const b=runtime(),g=b.fresh('r1',16,16);g.target=Array(256).fill('#dc365c');g.phase='play';
  const targetIndex=g.target.findIndex(Boolean),right=g.target[targetIndex],wrong=b.colors.find(x=>x.id!==right).id;
  assert.equal(b.canPlace(g,targetIndex,wrong),false);
  assert.equal(b.canPlace(g,targetIndex,right),true);
  g.board[targetIndex]=right;g.owners[targetIndex]='me';
  assert.equal(b.canPlace(g,targetIndex,right),false,'filled cells cannot be overwritten');
  const plan=b.parsePlan('{"focus":"樱粉","region":"右下","say":"慢慢拼，别急。"}'),chosen=b.chooseRoleCells(g,plan);
  assert.ok(chosen.length>0&&chosen.length<=10);
  assert.ok(chosen.every(i=>g.target[i]&&!g.board[i]));
  assert.equal(new Set(chosen).size,chosen.length);
  assert.equal(plan.say,'慢慢拼，别急。');
  assert.equal(b.turn,10);
  g.turnQuota=37;assert.equal(b.turnQuota(g),37);assert.equal(b.chooseRoleCells(g,plan).length,37);
  g.turnQuota=999;assert.equal(b.turnQuota(g),100);
});

test('local robot planning needs no model and cannot control coordinates',()=>{
  const b=runtime(),g=b.fresh('r1',16,16);g.target=Array(256).fill('#dc365c');g.phase='play';
  const plan=b.parsePlan('颜色：莓红\n区域：左上\n话：先从这一角开始');
  assert.equal(plan.color,'#dc365c');assert.equal(plan.region,'左上');
  const chosen=b.chooseRoleCells(g,plan);
  assert.ok(chosen.every(i=>i>=0&&i<g.target.length));
  assert.doesNotMatch(bead,/obj\.(?:x|y|row|col|coordinates)\b/,'model coordinates must never drive placement');
  assert.match(bead,/g\.board\[i\]=g\.target\[i\]/,'role placement must copy the locked target color');
  const planner=bead.slice(bead.indexOf('function beadRolePlan(g)'),bead.indexOf('async function beadRoleTurn(g)'));
  assert.doesNotMatch(planner,/chatAPI|buildSystem|scheduleReply/,'ordinary robot turns must be completely local');
  assert.match(bead,/完成了第 '\+g\.round\+' 轮本地自动补位/,'robot turns are recorded as system events, never fabricated role speech');
  assert.match(bead,/function beadDemoUserTurn\(/,'a local alternating robot demo must be available for preview');
  assert.match(bead,/window\.__northBootReady===true/,'preview routing must wait until the app boot route has finished');
  assert.match(bead,/上次角色回合被中断，正在安全接续/);
  assert.match(bead,/_bead\.phase==='play'&&_bead\.turn==='ta'&&!_bead\.busy/,'an interrupted role turn must resume when reopening');
});

test('completion follow-up is durably queued once with real artwork facts',()=>{
  const b=runtime(),g=b.fresh('r1',16,16);g.phase='done';g.workName='企鹅';g.sourceName='IMG_0475.jpg';g.target=Array(256).fill('#2b292c');g.owners=Array(256).fill('').map((_,i)=>i<96?'me':'ta');
  assert.equal(b.queueCompletionMessage(g),true);
  assert.equal(b.queueCompletionMessage(g),false,'the same saved work cannot enqueue twice');
  assert.equal(b.__scheduled.length,1);
  assert.match(b.__scheduled[0].note,/功能事件即时反应｜像素作品完成/);
  assert.match(b.__scheduled[0].note,/作品名《企鹅》/);
  assert.match(b.__scheduled[0].note,/原图名称“IMG_0475\.jpg”/);
  assert.match(b.__scheduled[0].note,/炭黑 256格/);
  assert.match(b.__scheduled[0].note,/你（先生）和我共同完成并保存的协作画作/);
  assert.match(b.__scheduled[0].note,/我实际填了 96 格，你实际填了 160 格/);
});

test('finished pixel works live in the single shared artwork gallery instead of taking draft slots',()=>{
  assert.match(app,/onclick="dgOpenGallery\(\)"[\s\S]{0,180}<b>我的画作<\/b>/);
  assert.match(app,/beadGalleryItemsHTML/);
  assert.match(privateApp,/beadGalleryItemsHTML/);
  assert.match(bead,/filter\(g=>g&&g\.phase!=='done'\)/,'finished pixel works must not remain in the horizontal continue-game rail');
  assert.doesNotMatch(bead,/const saved=works\.slice/,'saved works must not be duplicated as individual lobby cards');
  assert.match(bead,/我的画作 · 已保存 \$\{workCount\} 幅像素作品/,'the setup offers one compact gallery entry instead of one button per work');
  assert.match(bead,/function beadGalleryItemsHTML\(/);
  assert.match(bead,/previewSrc:beadThumbnailData\(g\)/,'new pixel works keep a compact gallery thumbnail');
  assert.match(bead,/src=x\.previewSrc\|\|beadThumbnailData\(x\)/,'older archived pixel works receive a gallery thumbnail when first opened');
  assert.match(bead,/collaboration:Object\.assign\(\{\},g\.collaboration\)/,'the archived work keeps the two collaborators and their actual contributions');
  assert.equal(privateBead,bead,'web and private App must use the same consolidated pixel gallery runtime');
});

test('uploaded images are converted into square color-code charts up to 128 cells',()=>{
  const b=runtime(),data=new Uint8ClampedArray([
    247,243,232,255, 32,56,84,255,
    111,32,36,255, 0,0,0,0
  ]),result=b.importImageData(data,2,2,104);
  assert.equal(result.cols,104);assert.equal(result.rows,104);assert.equal(result.target.length,10816);
  assert.ok(result.target[0]);assert.ok(result.target.every(Boolean),'every imported canvas cell must remain fillable, including white or transparent background');
  assert.equal(b.total({...result,board:[],owners:[]}),10816,'an imported 104x104 canvas requires all 10816 cells');
  const whiteFrame=new Uint8ClampedArray(4*4*4);for(let i=0;i<16;i++){whiteFrame[i*4]=whiteFrame[i*4+1]=whiteFrame[i*4+2]=255;whiteFrame[i*4+3]=255;}for(const i of [5,6,9,10]){whiteFrame[i*4]=32;whiteFrame[i*4+1]=56;whiteFrame[i*4+2]=84;}
  const framed=b.importImageData(whiteFrame,4,4,32),roleGame={...framed,board:Array(framed.target.length).fill(''),turnQuota:100};
  const subjectOnly=b.recognitionTarget(framed,false),withBackground=b.recognitionTarget(framed,true);
  assert.ok(subjectOnly.filter(Boolean).length<withBackground.filter(Boolean).length,'subject-only is the default compact goal');
  assert.equal(withBackground.filter(Boolean).length,framed.target.length,'the optional full-background mode restores every cell');
  const picked=b.roleCandidates(roleGame);assert.ok(picked.length>0);assert.ok(picked.every(i=>!framed.background[i]),'the role must finish foreground cells before entering detected background');
  for(const i of picked)roleGame.board[i]=roleGame.target[i];assert.ok(b.roleCandidates(roleGame).every(i=>framed.background[i]),'background stays fillable after the subject is finished');
  assert.equal(b.colors.length,30);assert.equal(b.colorCode(b.colors[0].id),'A1');
  assert.doesNotMatch(bead,/showAll=/,'the palette must never invent colors that were not detected in the uploaded image');
  assert.match(bead,/touch-action:none/);assert.match(bead,/Math\.max\(1,Math\.min\(14/);
  assert.match(bead,/function beadClampView\(/,'zoomed charts must be clamped inside the viewport');
  assert.match(bead,/if\(scale>1\.05\)/,'zoomed charts keep a complete-image minimap visible');
  assert.match(bead,/coordinateStep=shown>=13\?1:5/,'zoomed charts must expose every visible row and column number');
  assert.match(bead,/>仅主体<\/option>/,'subject-only recognition must be the default visible choice');
  assert.match(bead,/>主体＋背景<\/option>/,'the user can explicitly restore the full background');
  assert.match(bead,/Object\.assign\(window,\{[^}]*beadSetBackgroundMode/,'the recognition selector handler must be callable from inline UI');
  assert.match(bead,/g\.phase==='play'&&target&&!placed\?\.18:1/,'unfilled target cells stay faint until actually placed');
  assert.match(bead,/<div><b>像素拼拼乐<\/b><small>/,'the game name and remaining count must occupy the fixed top-center slot');
  assert.match(bead,/left:50%;width:190px;transform:translateX\(-50%\)/,'top title must be centered independently of side controls');
  assert.match(bead,/完成并命名/);assert.match(bead,/beadWorkName/);
  assert.match(bead,/typeof featureEventNote==='function'\?featureEventNote\('像素作品完成'/,'completion uses the durable feature-event queue rather than an optional background message');
  assert.match(bead,/queued=scheduleReply\(g\.cid,note\);if\(queued\)\{g\.completionMessaged=true/,'completion is marked queued only after the reply pipeline accepts it');
  assert.match(bead,/保存进度/,'unfinished work has an explicit save-without-exit action');
  assert.match(bead,/class="bead-nav-save"[^>]*onclick="beadSaveExit\(\)"/,'save and exit has a large independent top-right control');
  assert.doesNotMatch(bead,/class="bead-play-actions"/,'the former stack of three tiny actions is removed');
  assert.match(bead,/让\$\{esc\(partner\)\}补完/,'the role can correctly finish every remaining locked target cell');
  assert.match(bead,/if\(g\.target\[i\]&&!g\.board\[i\]\)\{g\.board\[i\]=g\.target\[i\];g\.owners\[i\]='ta'/);
  assert.match(bead,/remaining\+' 格未完成'/,'the remaining-cell count is visible directly under the centered title');
  assert.match(bead,/class="bead-view-quota"/,'the 1-100 turn quota stays visible beside the canvas instead of being buried in a disclosure');
  assert.match(bead,/id="beadTurnQuota"[^>]*min="1" max="100"/);
  assert.match(bead,/_beadSourceCache\.get\(g\.id\)/,'changing detail re-rasterizes the currently uploaded source image');
  assert.doesNotMatch(bead,/g\.owners\[i\]==='me'\?'rgba\(255,255,255/,'ownership must not put a white outline around a colored cell');
  assert.match(bead,/shown>=14/,'owner marks are hidden when zoomed out so they cannot change perceived color');
  assert.match(bead,/target&&shown>=18/,'dense charts hide labels until each on-screen cell is large enough');
  assert.match(bead,/labelPx\/scale/,'label height stays fixed on screen instead of growing beyond a zoomed cell');
  assert.match(bead,/ctx\.clip\(\)/,'every color code is clipped inside its own square');
  assert.match(bead,/stack=\[\{p:'home'\},\{p:'gameshub'\}\];render\(\)/,'leaving the canvas must replace the stack and prevent a canvas-lobby loop');
  assert.match(bead,/box\.works\.push\(snapshot\)/,'completed named works are archived for later viewing');
  assert.match(bead,/if\(!_bead\.archivedView\)beadSave\(_bead\)/,'viewing a saved work must not overwrite the active draft on exit');
  assert.match(bead,/if\(box\.works\.length>10\)/,'archive count is capped to protect local storage');
  assert.match(bead,/typeof dgOpenGallery==='function'/,'pixel setup links to the shared artwork gallery');
  assert.doesNotMatch(bead,/ctx\.arc\(x\*size/,'exported artwork must use square cells, not round beads');
});
