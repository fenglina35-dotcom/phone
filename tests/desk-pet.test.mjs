import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const P='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('desk pet ships identically in web and private and is wired into every entry',()=>{
  const web=read('desk-pet.js');assert.equal(read(P+'desk-pet.js'),web);
  for(const p of ['小手机.html',P+'index.html',P+'小手机.html'])assert.match(read(p),/<script src="desk-pet\.js\?v=\d+"/);
  assert.match(read('sw.js'),/'\.\/desk-pet\.js\?v='\+BUILD/);
  for(const p of ['app.js',P+'app.js'])assert.match(read(p),/onclick="deskPetSet\('\$\{id\}'\)"><span>桌面小机器人<\/span>/);
});

test('desk pet follows the bound role mood, schedule, music and holidays',()=>{
  const s=read('desk-pet.js');
  for(const m of ['idle','happy','love','sad','angry','sleep','sleepy','work','music','party'])assert.match(s,new RegExp(`\\b${m}:\\{eyes:`));
  assert.match(s,/c\.innerThought,c\.mood,lastRoleText\(c\)/);
  assert.match(s,/activitySpec\(c\)/);assert.match(s,/S\.music\.session\.cid===c\.id/);assert.match(s,/roleHolidayOn\(c\)/);
  assert.match(s,/if\(c\.blocked\)return'sad'/);
});

test('desk pet can be tapped, petted, dragged, climbs walls and stays under modals',()=>{
  const s=read('desk-pet.js');
  assert.match(s,/function tap\(\)/);assert.match(s,/function pet\(\)/);assert.match(s,/drag\.moved=true/);
  assert.match(s,/state\.rot=state\.x<=1\?90:-90/);
  assert.match(s,/\.dp-root\{position:absolute;left:0;top:0;z-index:180/);
  assert.match(s,/function tryPerch\(\)/);assert.match(s,/state\.annoyedUntil=now\+6000/);assert.match(s,/dpBreathe/);
  assert.doesNotMatch(s,/dp-bubble/,'点它不再弹文字框');
  assert.match(s,/S\.settings\.deskPet/);
});
