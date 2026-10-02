import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const P='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('desk pet ships identically in web and private and is wired into every entry',()=>{
  const web=read('desk-pet.js');assert.equal(read(P+'desk-pet.js'),web);
  for(const p of ['小手机.html',P+'index.html',P+'小手机.html'])assert.match(read(p),/<script src="desk-pet\.js\?v=\d+"/);
  assert.match(read('sw.js'),/'\.\/desk-pet\.js\?v='\+BUILD/);
  for(const p of ['app.js',P+'app.js']){const s=read(p);
    assert.match(s,/else if\(c\.p==='deskPet'\)html=typeof renderDeskPetPage==='function'\?renderDeskPetPage\(\):'';/);
    assert.match(s,/if\(_main&&typeof deskPetPrompt==='function'\)s\+=deskPetPrompt\(c\);/);
    assert.equal((s.match(/content=typeof deskPetConsume==='function'\?deskPetConsume\(content,c\):content;/g)||[]).length,3);
    assert.match(s,/\|批准\|驳回\|桌宠\)\\s\*/);
    assert.doesNotMatch(s,/deskPetSet\(/,'入口只在设置最下面，不在角色资料页');
  }
});

test('the settings home bottom row is the desk pet, and the duplicate 小 K row is gone',()=>{
  const s=read('desk-pet.js');
  assert.match(s,/settingsHomeHTML=function\(\)\{const html=original\.apply\(this,arguments\);return html\.includes\('deskPetOpen\(\)'\)\?html:html\.replace\('<div class="ios-settings-version"',deskPetRow\(\)/);
  assert.match(s,/<b>桌面宠物<\/b>/);assert.match(s,/miniSprite\(26\)/);
  const k=read(P+'private-robot-face.js');
  assert.doesNotMatch(k,/桌面伙伴 · 表情联动/);
  assert.match(k,/APPDEFS\.robotFace=\{e:'K'/,'主屏的小 K 图标保留');
});

test('desk pet binds one role, has a name the role knows, and stays separate from the physical 小K',()=>{
  const s=read('desk-pet.js');
  assert.match(s,/function deskPetBind\(id\)\{const p=ensureCfg\(\);p\.cid=id/);
  assert.match(s,/function deskPetRename\(v\)/);
  assert.match(s,/名字叫「'\+n\+'」/);
  assert.match(s,/和实体桌面机器人「小K」没有任何关系/);
  assert.match(s,/\[桌宠\|动作\]/);
  for(const k of ['开心','爱心眼','星星眼','难过','生气','睡觉','跳舞','转圈','趴下'])assert.match(s,new RegExp(`'${k}':\\{eyes:`));
});

test('desk pet reacts to music, typing and the role mood, and changes poses smoothly',()=>{
  const s=read('desk-pet.js');
  assert.match(s,/_mPlaying/);assert.match(s,/cls:'sway',hat:'music'/);
  assert.match(s,/cls:'sit keys type'/);assert.match(s,/document\.addEventListener\('input'/);
  for(const m of ['idle','happy','love','sad','angry','sleep','sleepy','work','party'])assert.match(s,new RegExp(`\\b${m}:\\{eyes:`));
  assert.match(s,/function settleBody\(next\)/);
  assert.match(s,/state\.eyeSwapUntil=now\+90/);
  assert.match(s,/dpHatIn/);
});

test('desk pet taps, pets, drags, climbs and perches without text bubbles',()=>{
  const s=read('desk-pet.js');
  assert.match(s,/function tap\(\)/);assert.match(s,/function pet\(\)/);assert.match(s,/drag\.moved=true/);
  assert.match(s,/state\.rot=state\.x<=1\?90:-90/);
  assert.match(s,/function tryPerch\(\)/);assert.match(s,/state\.annoyedUntil=now\+6000/);
  assert.match(s,/\.dp-root\{position:absolute;left:0;top:0;z-index:180/);
  assert.doesNotMatch(s,/dp-bubble/);
});

test('the role reply line handler turns [桌宠|动作] into a pet action instead of a chat message',()=>{
  for(const p of ['app.js',P+'app.js']){const s=read(p);
    assert.match(s,/if\(\/\^\[\\\[【\]\\s\*桌宠\\s\*\[\|｜:：\]\[\^\\\]】\]\*\[\\\]】\]\$\/\.test\(line\)\)\{if\(typeof deskPetConsume==='function'\)deskPetConsume\(line,c\);continue;\}/);
  }
  const s=read('desk-pet.js');
  assert.match(s,/function deskPetConsume\(text,c\)/);
  for(const k of ['跑出去','过来','跳上气泡'])assert.match(s,new RegExp(`'${k}':\\(\\)=>`));
});

test('the pet lives on the chat input bar, hops bubble to bubble, runs off screen and stays where it is dropped',()=>{
  const s=read('desk-pet.js');
  assert.match(s,/function groundY\(\)/);assert.match(s,/\.chat-inputbar,\.inputbar/);
  assert.match(s,/walkTo\(Math\.random\(\)\*b\.w,gy,\{ground:true\}\)/);
  assert.match(s,/if\(r<\.22&&tryPerch\(\)\)/);
  assert.match(s,/function runAway\(\)/);assert.match(s,/function comeBack\(\)/);
  assert.match(s,/function dropAt\(\)/);assert.match(s,/state\.placedUntil=Date\.now\(\)\+PLACE_MS/);
  assert.match(s,/function watchMessages\(now\)/);
  assert.match(s,/state\.napping=true/);
  assert.match(s,/on:false,cid:'',name:DP_DEFAULT_NAME/,'默认是关着的');
});

test('hats and headphones can be taken off in settings',()=>{
  const s=read('desk-pet.js');
  assert.match(s,/if\(c&&c\.hats===false&&hat&&hat!=='music'\)hat='';if\(c&&c\.phones===false&&hat==='music'\)hat='';/);
  assert.match(s,/onclick="deskPetWear\('hats'\)"/);assert.match(s,/onclick="deskPetWear\('phones'\)"/);
});
