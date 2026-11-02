import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import vm from 'node:vm';
import {fnSource} from './_helpers.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const app=readFileSync(join(root,'app.js'),'utf8');

function functionSource(name){return fnSource(app,name);}

test('solo game bubbles from both sides open the same edit/delete menu',()=>{
  assert.match(functionSource('renderGS'),/onclick="gsMsgMenu\('\$\{m\.id\}'\)"/);
  assert.match(functionSource('gsAbsorb'),/id:uid\(\),who:'ta'/);
  assert.match(functionSource('gsSend'),/id:uid\(\),who:'me'/);

  const fields={gs_e:{value:'修改后的台词'}};
  const context=vm.createContext({
    _gs:{msgs:[{id:'mine',who:'me',text:'原来的话'},{id:'role',who:'ta',text:'角色原话'}]},
    $:s=>fields[String(s).replace(/^#/,'')]||null,
    gsSaveDraft:()=>{context.saved=(context.saved||0)+1;},
    closeModal:()=>{context.closed=(context.closed||0)+1;},
    gsRender:()=>{context.rendered=(context.rendered||0)+1;},
  });
  vm.runInContext(functionSource('gsEditMsg'),context);
  vm.runInContext(functionSource('gsDelMsg'),context);
  context.gsEditMsg('role');
  assert.equal(context._gs.msgs[1].text,'修改后的台词');
  context.gsDelMsg('mine');
  assert.deepEqual(context._gs.msgs.map(x=>x.id),['role']);
});

test('multiplayer game room messages are edited and deleted in the saved room',()=>{
  assert.match(functionSource('renderMGRoom'),/onclick="mgrMsgMenu\('\$\{id\}','\$\{m\.id\}'\)"/);
  const room={msgs:[{id:'sys',kind:'sys',text:'开始'},{id:'me',kind:'me',text:'我说'},{id:'role',kind:'role',text:'角色说'}]};
  const fields={mgr_e:{value:'角色改过的话'}};
  const context=vm.createContext({
    mgrRoom:()=>room,
    $:s=>fields[String(s).replace(/^#/,'')]||null,
    save:()=>{context.saved=(context.saved||0)+1;},
    closeModal:()=>{},render:()=>{},
  });
  vm.runInContext(functionSource('mgrEditMsg'),context);
  vm.runInContext(functionSource('mgrDelMsg'),context);
  context.mgrEditMsg('room','role');
  assert.equal(room.msgs[2].text,'角色改过的话');
  context.mgrDelMsg('room','me');
  assert.deepEqual(room.msgs.map(x=>x.id),['sys','role']);
  context.mgrDelMsg('room','sys');
  assert.deepEqual(room.msgs.map(x=>x.id),['sys','role'],'system room events are protected');
});

test('roleplay already supports editing and deleting both sides',()=>{
  assert.match(functionSource('renderRP'),/renderDateScene\(id,rpData\(id\),true\)/);assert.match(functionSource('renderDateScene'),/\$\{action\}MsgMenu/);
  assert.match(functionSource('rpEditMsg'),/mm\.text=v/);
  assert.match(functionSource('rpDelMsg'),/filter\(x=>x\.id!==mid\)/);
});

test('special game dialogue cards also expose edit/delete',()=>{
  assert.match(functionSource('ucPill'),/ucMsgMenu\('\$\{p\.id\}'\)/);
  assert.match(functionSource('ucEditMsg'),/p\.desc=v\.slice/);
  assert.match(functionSource('ucDelMsg'),/p\.desc=''/);
  assert.match(functionSource('renderWG'),/wgMsgMenu\('desc','desc'\)/);
  assert.match(functionSource('renderWG'),/wgMsgMenu\('mydesc','mydesc'\)/);
  assert.match(functionSource('renderWG'),/wgMsgMenu\('guess'/);
});

test('memory and summary actions use separated larger hit targets',()=>{
  assert.match(functionSource('editMemory'),/gap:12px/);
  assert.match(functionSource('editMemory'),/width:36px;height:36px/);
  assert.match(functionSource('editSummary'),/aria-label="编辑对话总结"/);
  assert.match(functionSource('editSummary'),/aria-label="删除对话总结"/);
});

test('game context uses independently configurable complete rounds and hands off invisibly to WeChat',()=>{
  assert.match(functionSource('gameContextRounds'),/gameHistRounds/);
  assert.match(functionSource('gameContextRounds'),/Math\.min\(100,n\)/);
  assert.doesNotMatch(functionSource('gameContextRounds'),/offlineContextLimit|offHist/);
  assert.match(functionSource('gsReply'),/gameContextRows\(g\.msgs\)/);
  assert.match(functionSource('mgrRoleTurn'),/gameContextRows\(r\.msgs\|\|\[\]\)/);
  assert.match(functionSource('openGames'),/gameshub/);
  assert.match(functionSource('gameHubSettings'),/游戏上下文回合数/);
  assert.match(functionSource('gameHubSettings'),/id="game_hist"/);

  const context=vm.createContext({S:{settings:{gameHistRounds:2}}});
  vm.runInContext(functionSource('gameContextRounds')+functionSource('gameContextRows'),context);
  const rows=[
    {who:'ta',text:'开场'},
    {who:'me',text:'第一轮第一句'},{who:'me',text:'第一轮补充'},
    {who:'ta',text:'第一轮回答一'},{who:'ta',text:'第一轮回答二'},
    {who:'me',text:'第二轮'},{who:'ta',text:'第二轮回答'},
    {who:'me',text:'第三轮'},{who:'ta',text:'第三轮回答'},
  ];
  assert.deepEqual(Array.from(context.gameContextRows(rows),x=>x.text),['第二轮','第二轮回答','第三轮','第三轮回答']);
  assert.match(functionSource('gsEnd'),/gameSetHandoff\(g\.cid,g\.title,g\.msgs\)/);
  assert.match(functionSource('gameWechatHandoffPrompt'),/不属于长期记忆或对话总结/);
  assert.match(functionSource('gameWechatHandoffPrompt'),/不要把它写成新的长期记忆/);
  assert.doesNotMatch(functionSource('gameSetHandoff'),/summaries|memoryList|rememberForChar/);
});

test('solo game exit preserves the draft while end clears it',()=>{
  const render=functionSource('renderGS');
  assert.match(render,/onclick="gsExit\(\)"/);
  assert.match(render,/onclick="gsEnd\(\)"/);
  assert.match(render,/onclick="gsClear\(\)"/);
  assert.match(functionSource('renderGameHub'),/继续游戏/);
  assert.match(functionSource('gsReply'),/const g=_gs/);
  assert.match(functionSource('gsReply'),/if\(_gs!==g\)return/,'a late reply from an exited game must not enter a newly opened game');

  const draft={cid:'c1',kind:'quiz',title:'默契考验',msgs:[{id:'m1',who:'me',text:'第一句'}],_tm:7,busy:true};
  const exitContext=vm.createContext({
    _gs:draft,
    clearInterval:()=>{exitContext.cleared=true;},
    gsSaveDraft:g=>{exitContext.saved=g;},
    home:()=>{exitContext.homed=true;},
  });
  vm.runInContext(functionSource('gsExit'),exitContext);
  exitContext.gsExit();
  assert.equal(exitContext.saved,draft,'exit must save the current game draft');
  assert.equal(exitContext._gs,null);
  assert.equal(exitContext.homed,true);

  const ending={cid:'c1',kind:'quiz',title:'默契考验',msgs:[{id:'m1',who:'me',text:'第一句'}],_tm:8};
  const endContext=vm.createContext({
    _gs:ending,
    clearInterval:()=>{},
    gameSetHandoff:()=>{endContext.handoff=true;},
    gsDropDraft:g=>{endContext.dropped=g;},
    home:()=>{endContext.homed=true;},
  });
  vm.runInContext(functionSource('gsEnd'),endContext);
  endContext.gsEnd();
  assert.equal(endContext.dropped,ending,'end must delete the saved draft');
  assert.equal(endContext.handoff,true);
  assert.equal(endContext._gs,null);
});
