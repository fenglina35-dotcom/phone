const api = window.smallPhoneSmartHome;
const $ = id => document.getElementById(id);
let awaitingConfirmation = false;

function message(value, kind = '') {
  const element = $('message');
  element.textContent = value || '';
  element.className = kind;
}

function render(state) {
  const linked = !!state?.linked;
  $('setup').classList.toggle('hidden', linked || awaitingConfirmation);
  $('confirmLamp').classList.toggle('hidden', !awaitingConfirmation);
  $('linked').classList.toggle('hidden', !linked);
  $('upgrade').classList.toggle('hidden', !state?.securityUpgrade);
  if (!linked) return;
  const online = state.worker === 'online', busy = state.worker === 'busy';
  $('dot').className = online || busy ? 'online' : 'offline';
  $('title').textContent = busy ? '正在执行并回读' : online ? '灯具已安全连接' : '正在重新连接固定灯具';
  $('detail').textContent = `${state.lamp?.name || 'MSL430'} · 助手 ${state.version || ''}`;
  if (state.lastError) message(state.lastError, 'error');
}

async function refresh() {
  try { render(await api.state()); } catch (error) { message(error.message, 'error'); }
}

$('pair').onclick = async () => {
  const code = $('pairCode').value.replace(/\D/g, ''), button = $('pair');
  if (code.length !== 10) return message('请输入网页显示的十位配对码', 'error');
  button.disabled = true;
  message('正在寻找 MSL430。灯会闪烁两次，完成后请亲眼确认…');
  try {
    const result = await api.pairStart(code);
    awaitingConfirmation = !!result?.awaitingConfirmation;
    $('confirmName').textContent = `发现：${result?.lampName || 'MSL430'}。闪烁后已恢复原来的开关、亮度和颜色。`;
    render(await api.state());
    message('请确认刚才闪烁的确实是你准备绑定的灯。');
  } catch (error) { message(error.message || '灯具验证失败', 'error'); }
  finally { button.disabled = false; }
};

$('confirmYes').onclick = async () => {
  const button = $('confirmYes');
  button.disabled = true;
  message('正在固定这盏灯的唯一身份…');
  try {
    const state = await api.pairConfirm();
    awaitingConfirmation = false;
    render(state);
    message('安全连接成功。以后只认这盏灯，不会自动改连其他灯。', 'ok');
  } catch (error) { message(error.message || '安全绑定失败', 'error'); }
  finally { button.disabled = false; }
};

$('confirmNo').onclick = async () => {
  await api.pairCancel();
  awaitingConfirmation = false;
  render(await api.state());
  message('已取消，没有绑定任何灯。', 'ok');
};

$('test').onclick = async () => {
  message('正在读取固定灯具的真实状态…');
  try {
    const result = await api.test();
    message(result?.verified ? '真实状态读取成功' : '没有确认成功', result?.verified ? 'ok' : 'error');
  } catch (error) { message(error.message, 'error'); }
};

$('open').onclick = () => api.openSmallPhone();
$('guideSetup').onclick = $('guideLinked').onclick = () => api.openGuide();
$('forget').onclick = async () => {
  if (!confirm('清除这台电脑上的绑定吗？网页端还需要点击“解除电脑连接”。')) return;
  render(await api.forget());
  message('本机绑定已清除', 'ok');
};

api.onState(render);
refresh();
setInterval(refresh, 8000);
