import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const effect=readFileSync(join(root,'gift-effects.js'),'utf8');
const app=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'小手机.html'),'utf8');
const preview=readFileSync(join(root,'gift-flower-preview.html'),'utf8');
const sw=readFileSync(join(root,'sw.js'),'utf8');

test('supported particle gifts open from received role gift cards',()=>{
  for(const name of ['花束','玫瑰','百合','郁金香','向日葵','满天星','永生花'])assert.match(app,new RegExp(name));
  assert.match(app,/function giftNameIsFloral/);
  assert.match(app,/function giftEffectKind/);
  assert.match(app,/function giftMessageBloom/);
  assert.match(app,/found\.from!=='ta'/,'outgoing gifts must not masquerade as received flower effects');
  assert.match(app,/giftcard giftcard-effect giftcard-simple/);
  assert.match(app,/function giftBoxCardArt/,'formal role cards should render only the chosen minimal Moonlight box and text');
  assert.match(app,/pend=\(m\.from==='ta'.+&&!effect\)/,'particle gift cards must not show receive or reject preview controls');
  assert.match(app,/function giftMessageOpen/);
  assert.match(app,/playGiftBoxReveal\(\{giftName:found\.name/,'chat cards must open the dedicated full-screen gift-box stage');
  assert.match(app,/onOpen:\(\)=>giftMessageBloom\(mid\)/,'the particle gift opens only after the box stage completes');
  assert.match(effect,/function playGiftBoxReveal/);
  assert.match(effect,/if\(step===0\)/,'the full-screen box must require a wake-up tap before the open tap');
  assert.match(effect,/cue\.textContent='再次轻触，打开礼物'/);
  assert.match(effect,/\.giftcard-simple\{width:210px;min-height:138px/,'the formal chat card should stay close to the compact original template');
  assert.match(effect,/\.giftcard-effect\{[^}]*border:0!important/,'the chat gift card must not regain a pale outline');
  assert.match(effect,/\.gift-box-stage\{[^}]*position:fixed;inset:0/,'opening the chat card must occupy the full screen');
  assert.match(effect,/\.gift-box-stage\{[^}]*opacity:1/,'the full-screen box background must cover chat immediately without a transparent flash');
  assert.doesNotMatch(effect,/\.gift-box-stage\{[^}]*opacity:0/,'the chat page must never show through while the gift box enters');
  assert.match(effect,/\.gift-bouquet-overlay\{[^}]*opacity:1/,'the revealed gift background must be opaque before its first painted frame');
  assert.match(effect,/if\(open\)open\(\);stop\(true\)/,'the revealed gift must cover the screen before the box layer is removed');
  assert.match(effect,/width:min\(80vw,310px\)/,'the full-screen stage should keep a centered medium gift box without filling the phone width');
  assert.match(effect,/@keyframes giftCardShake/);
  assert.doesNotMatch(effect,/content:'点击开启'/,'the formal role card should not add a pseudo-button');
});

test('mail signing opens the saved flower, toy or ring recipe without changing delivery logic',()=>{
  assert.match(app,/effect=L\.kind==='gift'&&giftEffectKind\(L\.giftName\)/);
  assert.match(app,/setTimeout\(\(\)=>playGiftRecipe\(L\.giftName/);
  assert.match(app,/scheduleReply\(L\.cid/,'the existing role acknowledgement remains intact');
});

test('bouquet composition is constrained-random rather than one fixed drawing',()=>{
  assert.match(effect,/const PALETTES=\[/);
  assert.match(effect,/FLOWER_TYPES=\['rose','daisy','peony'\]/);
  assert.match(effect,/const flowerCount=\(reduced\?7:9\)\+Math\.floor/);
  assert.match(effect,/anchors=\[/,'flowers should keep a bouquet silhouette while positions vary');
  assert.match(effect,/seededRandom\(seed\)/);
  assert.match(effect,/palette:palette\.name/);
  assert.match(effect,/baseY=h\*\.59/,'the full bouquet and wrapping must sit above the bottom copy');
  assert.match(effect,/wrapBottom=Math\.min\(h\*\.82,baseY\+bouquetW\*\.47\)/,'the wrapping must continue well below the flower heads instead of ending as a shallow top flap');
  assert.match(effect,/wrapTieY=baseY\+bouquetW\*\.335/,'the ribbon must gather the complete lower wrapping');
  assert.match(effect,/ctx\.lineTo\(x-w\*\.31,top-w\*\.02\)/,'the bouquet must draw a full left wrapping sheet');
  assert.match(effect,/ctx\.lineTo\(x\+w\*\.31,top-w\*\.015\)/,'the bouquet must draw a full right wrapping sheet');
  assert.match(effect,/alpha\*\.7/,'the wrapping should remain visibly distinct from the dark background');
});

test('direct gifts never become shopping orders while role-paid purchases name the payer',()=>{
  assert.match(app,/function shopOrderIsDirectGift\(order\)/);
  assert.match(app,/function shopOrderRows\(\)\{return \(S\.shop&&S\.shop\.orders\|\|\[\]\)\.filter\(order=>!shopOrderIsDirectGift\(order\)\);\}/,'all order views must filter legacy direct-gift rows');
  assert.match(app,/if\(kind!=='gift'\)\{const c=cid&&getC\(cid\),payerName=/,'parcel delivery must keep direct gifts out of order creation');
  assert.match(app,/emoji:opts\.emoji\|\|\(kind==='pay'\?'🛍️':'🛒'\),payerName,buyTs/,'paid orders must persist who paid');
  assert.match(app,/shopOrderPayerName\(order\)\+'代付'/,'the order card must display the role name with the paid-by label');
  assert.match(app,/orders=shopOrderRows\(\).*shopOrderFact\(o\)/,'phone inspection must see the same filtered order history and payer label');
  assert.match(app,/giftSend[\s\S]{0,700}parcelDeliver\(cid,name,price,'gift'/,'role gifts must still travel through the mailbox without becoming orders');
});

test('natural short gift requests are recognized without the exact phrase one bouquet',()=>{
  assert.match(app,/function giftRequestIntent/);
  assert.match(app,/花花\|鲜花\|花束/);
  assert.match(app,/想要\|想收\|我也要\|送我\|给我/);
  assert.match(app,/function giftRequestPrompt/);
  assert.match(app,/不需要说出完整的“一束鲜花”/);
  assert.match(app,/if\(_giftIntent&&!\/\\\[送礼\\\|\/\.test\(content\)\)/,'a missed gift action must receive a final correction pass');
  assert.match(app,/giftRequestFallback\(_giftIntent\)/,'a failed correction must still create the requested gift card');
});

test('the chosen flower, meaning and date persist as role-readable gift facts',()=>{
  assert.match(effect,/const FLOWER_RECIPES=\[/);
  assert.match(effect,/function createBouquetRecipe/);
  assert.match(effect,/flowerMeaning:chosen\.meaning/);
  assert.match(effect,/meaning\.textContent='花语 · '/);
  assert.match(effect,/detail\.textContent=safeLabel\(options\.sender,'TA'\)\+' 赠予 · '\+recipe\.date/);
  assert.match(app,/giftRecipe:opts\.giftRecipe\|\|null/,'parcel must retain the exact generated recipe');
  assert.match(app,/giftRecipe:g\.giftRecipe\|\|null/,'mail delivery must retain the exact generated recipe');
  assert.match(app,/function giftRecipeContext/,'role history must serialize the exact generated gift fact');
  assert.match(app,/以后提起必须和这次已经确定的礼物一致/,'the signing acknowledgement must pin the role to the saved gift');
});

test('holidays and anniversaries provide a real date fact and leave the action to the role',()=>{
  assert.match(app,/function occasionGift/);
  assert.match(app,/重要日期自主决策/);
  assert.match(app,/系统不替你决定情绪或行动/);
  assert.match(app,/自主决定是否联系、是否准备礼物或邀请一起做某件事/);
  assert.match(app,/真正想送礼时使用 \[送礼\|礼物名\|价格\|附言\]/);
  assert.doesNotMatch(app,/三类中必须且只能选一类/);
  assert.match(app,/giftEffectRecipe\(name,null,giftId,giftTime,words\)/,'the role note must persist into the chosen particle recipe');
  for(const color of ['blue','pink','white','red'])assert.match(app,new RegExp(color+":'#"));
});

test('teddy and engagement-ring previews use bounded particle recipes with words and dates',()=>{
  assert.match(effect,/const TEDDY_RECIPES=\[/);
  assert.match(effect,/const RING_RECIPES=\[/);
  for(const species of ['bear','rabbit','puppy','kitten'])assert.match(effect,new RegExp("species:'"+species+"'"));
  for(const style of ['round','halo','heart','pear'])assert.match(effect,new RegExp("style:'"+style+"'"));
  assert.match(effect,/function buildTeddyTargets/);
  assert.match(effect,/function buildRingTargets/);
  assert.match(effect,/lastCollectibleId=\{teddy:'',ring:''\}/,'consecutive previews should not immediately repeat');
  assert.match(effect,/74\*s,74\*s/,'the engagement ring should use a compact round band');
  assert.match(effect,/global\.playTeddyGiftEffect/);
  assert.match(effect,/global\.playRingGiftEffect/);
  assert.match(effect,/bottom:max\(8px,calc\(env\(safe-area-inset-bottom\) \+ 4px\)\)/,'gift copy must stay below the generated object');
  assert.match(preview,/data-kind="teddy">玩偶礼物/);
  assert.match(preview,/data-kind="ring">订婚戒指/);
});

test('full-screen particle animation is mobile-bounded and cleans itself up',()=>{
  assert.match(effect,/requestAnimationFrame\(draw\)/);
  assert.match(effect,/Math\.min\(global\.devicePixelRatio\|\|1,1\.75\)/,'retina resolution must be capped for mobile stability');
  assert.match(effect,/prefers-reduced-motion: reduce/);
  assert.match(effect,/document\.hidden\)stop\(true\)/);
  assert.match(effect,/cancelAnimationFrame\(frame\)/);
  assert.match(effect,/overlay\.remove\(\)/);
  assert.match(effect,/position:fixed;inset:0;z-index:2147483000/);
});

test('the app, offline cache and gate-free preview all load the effect',()=>{
  assert.match(html,/gift-effects\.js\?v=1102/);
  assert.match(sw,/gift-effects\.js\?v='\+BUILD/);
  assert.match(sw,/gift-effects\|thought-card-effects/,'optional gift and thought-card scripts must be served from the offline cache');
  assert.match(html,/\.giftcard-simple\{[^}]*width:210px/,'the gift card must retain its layout even before the effect script executes');
  assert.match(app,/function giftEffectsEnsure\(\)/,'a failed effect script must be reloadable from the card tap');
  assert.match(app,/async function giftMessageOpen/);
  assert.match(preview,/gift-effects\.js\?v=preview-2/);
  assert.match(preview,/class="gift-cover"/);
  assert.match(preview,/id="giftNameCn">一束鲜花</);
  assert.match(preview,/id="giftNameEn">A BOUQUET OF FLOWERS</);
  assert.match(preview,/class="box-variant variant-b"/,'the chosen Moonlight structure should be the only box geometry');
  assert.doesNotMatch(preview,/variant-[acd]/);
  for(const color of ['blue','pink','white','red'])assert.match(preview,new RegExp('data-box-choice="'+color+'"'));
  assert.match(effect,/GIFT_STAGE_COLORS=\{blue:'#8fbce8',pink:'#f2adc7',white:'#f2efe8',red:'#ef6b6f'\}/,'the full-screen gift box and stars must follow the saved color');
  assert.doesNotMatch(preview,/M142 113l-25 47/,'the lower bow tails must be removed to prevent clipping');
  assert.match(preview,/playGiftBoxReveal\(\{giftName:giftLabels\[currentGiftKind\]/,'the preview should demonstrate compact card, box wake-up, and final reveal');
  assert.match(effect,/english\.textContent=recipe\.enName/);
  assert.doesNotMatch(preview,/花材、配色|连续查看|看看蓝色花束|本地预览分支/);
});
