import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';

const notes = read('task-notes.js');
const block = notes.slice(notes.indexOf('/* TASK_PRIVILEGE_V1 */'), notes.indexOf('/* END_TASK_PRIVILEGE_V1 */'));
function fixture() {
  let n = 0, day = '2026-11-07', account = 'main';
  const c = { id: 'r1', name: '角色', tasks: { list: ['a','b','c'].map(id => ({id,done:false})) } };
  const history = [];
  const math = Object.create(Math); math.random = () => 0;
  const x = vm.createContext({ S: { taskNotes: {}, me: { name: '我' }, contacts: [c] }, Math: math,
    Date, JSON, Object, Array, Number, String, Set, window: {}, uid: () => 'card_' + (++n),
    actId: () => account, dayKey: () => day, save() {}, msgs: () => history,
    roleTasks: () => ({ c, t: c.tasks, list: c.tasks.list }),
    store: () => x.S.taskNotes, esc: String, attr: String, IMG: 'assets/task-notes/' });
  vm.runInContext(block + '\n' + fnSource(notes, 'dailyBoxState'), x);
  return { x,c,history,day(v){day=v;},account(v){account=v;} };
}
test('原定三项任务冻结，追加任务与自己打勾的小事不能改变资格', () => {
  const f=fixture(),{x,c}=f;
  assert.equal(x.dailyBoxState().ready,false);
  c.tasks.list.push({id:'extra',punish:true,done:false});
  c.tasks.list.slice(0,3).forEach(t=>t.done=true);
  assert.equal(x.dailyBoxState().ready,true);
  assert.equal(x.dailyBoxState().total,3);
  c.tasks.list.unshift({id:'later',done:false});
  assert.equal(x.dailyBoxState().ready,true,'锁定的是原来的任务 ID，而非每次重新取前三个');
  c.tasks.list=c.tasks.list.filter(t=>t.id!=='a');
  assert.equal(x.dailyBoxState().ready,false,'删除未核实的原定任务不能冒充已完成');
});
test('每天一次，七次未中第八次保底，重开不刷新次数', () => {
  const {x,day}=fixture();
  for(let i=1;i<=7;i++){day('2026-11-'+i);assert.equal(x.privilegeDraw(),'reconcile');x.privilegeDraw();}
  assert.equal(x.privilegeInventory('me').reconcile,7);
  const saved=JSON.parse(JSON.stringify(x.S));x.S=saved;
  day('2026-11-08');assert.equal(x.privilegeDraw(),'obedience');
  assert.equal(x.privilegeAccount().misses,0);x.privilegeDraw();
  assert.equal(x.privilegeInventory('me').obedience,1);
  day('2026-11-09');assert.equal(x.privilegeDraw(),'reconcile');
});
test('赠送转移所有权，角色按自己的库存使用，重复结算只扣一次', () => {
  const {x,c,history}=fixture();x.privilegeInventory('me').obedience=1;
  const gift=x.privilegeMessage(c,'me','gift','obedience','');
  history.push(gift);assert.equal(x.privilegeCommit(c,gift),true);
  assert.equal(x.privilegeInventory('me').obedience,0);
  assert.equal(x.privilegeInventory('role:r1').obedience,1);
  assert.equal(x.privilegeCommit(c,gift),true);
  assert.equal(x.privilegeInventory('role:r1').obedience,1);
  const mine=x.privilegeMessage(c,'me','use','obedience','请去吃饭');
  assert.equal(x.privilegeCommit(c,mine),false,'送出后本人不能再用');
  const parsed=x.privilegeParseLine('先去吃饭吧。【使用特权卡｜听话卡｜好好吃一顿饭】吃完再聊。',c);
  assert.equal(parsed.length,3);const use=parsed[1];
  assert.equal(use.type,'gift');assert.equal(x.privilegeInventory('role:r1').obedience,1,'解析和后台收件预览不扣卡');
  history.push(use);assert.equal(x.privilegeCommit(c,use),true);
  assert.equal(x.privilegeInventory('role:r1').obedience,0);
  x.S=JSON.parse(JSON.stringify(x.S));
  assert.equal(x.privilegeCommit(c,use),true);
  assert.equal(x.privilegeInventory('role:r1').obedience,0,'存档重开也不重复扣');
  const pendingCopy=JSON.parse(JSON.stringify(use));pendingCopy.privilege.state='pending';
  assert.match(x.privilegeChat(c,pendingCopy),/已生效/,'消息快照较旧时也按持久化账本显示正确结果');
  assert.equal(x.privilegeInventory('role:r1').obedience,0,'重开后的显示同步仍不重扣');
});
test('账号、角色与用途边界；口头意愿不消耗卡片', () => {
  const f=fixture(),{x,c}=f;assert.equal(x.privilegeCommit(c,null),false);x.privilegeInventory('role:r1').calm=1;
  const m=x.privilegeMessage(c,'role:r1','use','calm','先缓和一下再聊');
  assert.equal(x.privilegeCommit({id:'other'},m),false);
  f.account('alt');assert.equal(x.privilegeCommit(c,m),false);f.account('main');
  assert.equal(x.privilegeInventory('role:r1').calm,1);
  assert.equal(x.privilegeParseLine('我想用一张消气卡',c),null);
  assert.equal(x.privilegeParseLine('如果我使用听话卡，你会答应吗',c),null);
  assert.equal(x.privilegeCommit(c,x.privilegeMessage(c,'role:r1','use','calm','')),false);
  assert.equal(x.privilegeInventory('role:r1').calm,1);
  assert.equal(x.privilegeCommit(c,m),true);
  assert.match(x.privilegePrompt(c),/缓和说话，不抹除事件记忆/);
});
test('同一确认窗口连续点击只赠送一张，再次打开才可继续赠送', () => {
  const {x,c,history}=fixture();
  Object.assign(x,{attr:String,openModal(){},getC:()=>c,document:{getElementById:()=>({value:c.id})},
    pushMsg:(id,m)=>history.push(m),closeModal(){},render(){},scheduleReply(){},taskToast(){}});
  x.privilegeInventory('me').calm=2;
  x.privilegeOpenAction('calm','gift');x.privilegeSubmit('calm','gift');x.privilegeSubmit('calm','gift');
  assert.equal(history.length,1);assert.equal(x.privilegeInventory('me').calm,1);
  assert.equal(x.privilegeInventory('role:r1').calm,1);
  x.privilegeOpenAction('calm','gift');x.privilegeSubmit('calm','gift');
  assert.equal(history.length,2);assert.equal(x.privilegeInventory('role:r1').calm,2);
});
test('正式卡片、中文分隔符与确定的使用语句都生成卡片，主私两端同路', () => {
  const {x,c}=fixture();
  for(const raw of ['[使用特权卡|听话卡|请先去吃饭]','【使用特权卡｜听话卡｜请先去吃饭】','[特权卡|使用|听话卡|请先去吃饭]','[使用听话卡|请先去吃饭]','我打出一张听话卡，先好好吃饭']){
    const m=x.privilegeParseLine(raw,c);assert.equal(m[0].type,'gift');assert.equal(m[0].privilege.kind,'obedience');
  }
  for(const [,file] of BUNDLES){
    x.TaskPrivilege=x.window.TaskPrivilege;vm.runInContext(fnSource(read(file),'modelUnfilteredMessages'),x);
    const m=x.modelUnfilteredMessages('[使用特权卡|和好卡|我们好好聊聊]',c);
    // 浏览器中 window 上的 API 同时是全局变量。
    if(!x.TaskPrivilege){x.TaskPrivilege=x.window.TaskPrivilege;vm.runInContext(fnSource(read(file),'modelUnfilteredMessages'),x);}
    assert.equal(x.modelUnfilteredMessages('[使用特权卡|和好卡|我们好好聊聊]',c)[0].type,'gift');
  }
  assert.equal(read(PRIV_DIR+'task-notes.js'),notes);
});
