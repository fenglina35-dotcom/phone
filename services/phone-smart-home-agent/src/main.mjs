import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { SecureStore } from './secure-store.mjs';
import { RelayWorker } from './relay-worker.mjs';
import { MerossLocalController } from './meross-local.mjs';

const source = path.dirname(fileURLToPath(import.meta.url));
const FINGERPRINT = /^sha256:[0-9a-f]{64}$/;
let win, worker, store, binding, config, tray, pendingVerification;

const runtime = () => app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'runtime') : path.join(app.getAppPath(), 'runtime');

async function rpc(name, body) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, authorization: `Bearer ${config.publishableKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const message = String(data?.message || data || '云端请求失败');
    if (message.includes('lamp-already-bound')) throw new Error('这盏灯已经绑定到另一个网页家庭；请先在原网页解除连接');
    throw new Error(message.slice(0, 200));
  }
  return data;
}

function secureBinding() { return !!(binding?.target && FINGERPRINT.test(binding?.lampFingerprint || '')); }

function state(extra = {}) {
  return {
    linked: secureBinding(),
    securityUpgrade: !!binding && !secureBinding(),
    deviceName: binding?.deviceName || os.hostname(),
    version: app.getVersion(),
    ...(worker?.state() || { worker: secureBinding() ? 'offline' : 'unpaired', lamp: null, lastError: '' }),
    ...extra,
  };
}

function emit(extra) {
  const value = state(extra);
  if (win && !win.isDestroyed()) win.webContents.send('smarthome:state-changed', value);
  return value;
}

function start() {
  if (!secureBinding() || worker) return;
  worker = new RelayWorker({ config, binding, version: app.getVersion(), onState: () => emit() });
  worker.start();
}

function createWindow() {
  win = new BrowserWindow({
    width: 620,
    height: 790,
    minWidth: 520,
    minHeight: 660,
    show: false,
    autoHideMenuBar: true,
    title: '小手机智能家电助手',
    webPreferences: { preload: path.join(source, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(source, 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', event => {
    if (!app.isQuitting) { event.preventDefault(); win.hide(); }
  });
}

ipcMain.handle('smarthome:state', () => state());

ipcMain.handle('smarthome:pair-start', async (_event, raw) => {
  const code = String(raw || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(code)) throw new Error('请输入网页显示的十位配对码');
  const devices = await MerossLocalController.discover({ timeout: 7000 });
  if (devices.length !== 1) throw new Error(devices.length ? '发现多盏 MSL430：首次验证时请只让准备绑定的那盏保持在线' : '没有发现 MSL430，请确认电脑和灯在同一个私人路由器下');
  const lamp = devices[0];
  if (!FINGERPRINT.test(lamp.fingerprint || '')) throw new Error('灯具没有提供可固定的唯一身份');
  const controller = new MerossLocalController({ host: lamp.host });
  await controller.snapshot();
  pendingVerification = { code, fingerprint: lamp.fingerprint, lampName: lamp.name, expiresAt: Date.now() + 4 * 60 * 1000 };
  await controller.identify();
  return { awaitingConfirmation: true, lampName: lamp.name, expiresAt: pendingVerification.expiresAt };
});

ipcMain.handle('smarthome:pair-confirm', async () => {
  const pending = pendingVerification;
  if (!pending || Date.now() >= pending.expiresAt) { pendingVerification = null; throw new Error('灯具确认已经超时，请重新开始'); }
  const devices = await MerossLocalController.discover({ timeout: 6000 });
  const lamp = devices.find(device => device.fingerprint === pending.fingerprint);
  if (!lamp) throw new Error('刚才闪烁的那盏灯已经离线，未建立绑定');
  const controller = new MerossLocalController({ host: lamp.host });
  await controller.snapshot();
  const savedIdentity = binding?.deviceId && binding?.deviceSecret ? { deviceId: binding.deviceId, deviceSecret: binding.deviceSecret } : SecureStore.identity();
  const deviceName = `${os.hostname()} · Windows 智能家电电脑`.slice(0, 80);
  const result = await rpc('phone_smart_home_bind_verified_device', {
    p_pair_code: pending.code,
    p_device_id: savedIdentity.deviceId,
    p_device_name: deviceName,
    p_device_secret: savedIdentity.deviceSecret,
    p_agent_version: app.getVersion(),
    p_lamp_id_hash: pending.fingerprint,
    p_lamp_name: pending.lampName,
  });
  if (!result?.ok || !result?.target) throw new Error('云端没有确认安全绑定');
  await worker?.stop();
  worker = null;
  binding = { ...savedIdentity, target: result.target, deviceName, lampFingerprint: pending.fingerprint };
  pendingVerification = null;
  await store.save(binding);
  start();
  return emit({ verifiedLamp: true });
});

ipcMain.handle('smarthome:pair-cancel', () => {
  pendingVerification = null;
  return state();
});

ipcMain.handle('smarthome:test', async () => {
  const controller = await worker?.ensureLamp();
  if (!controller) throw new Error('请先完成配对和灯具闪烁确认');
  const current = await controller.snapshot();
  return controller.execute({ power: current.power ? 'on' : 'off' });
});

ipcMain.handle('smarthome:open-small-phone', () => shell.openExternal(config.smallPhoneUrl));
ipcMain.handle('smarthome:open-guide', () => shell.openPath(path.join(runtime(), '新手教程.html')));
ipcMain.handle('smarthome:forget', async () => {
  await worker?.stop();
  worker = null;
  binding = null;
  pendingVerification = null;
  await store.clear();
  return emit();
});

const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.whenReady().then(async () => {
    config = JSON.parse(await fs.readFile(path.join(runtime(), 'public-config.json'), 'utf8'));
    store = new SecureStore(app.getPath('userData'));
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 安全存储不可用');
    if (process.argv.includes('--smoke-test')) {
      if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.supabaseUrl) || !/^sb_publishable_/.test(config.publishableKey)) throw new Error('打包后的公开云配置无效');
      await fs.access(path.join(runtime(), '新手教程.html'));
      app.isQuitting = true;
      app.quit();
      return;
    }
    binding = await store.load();
    app.setLoginItemSettings({ openAtLogin: true, args: ['--background'] });
    createWindow();
    let icon = nativeImage.createFromPath(path.join(runtime(), 'icon.png'));
    if (!icon.isEmpty()) icon = icon.resize({ width: 20, height: 20 });
    tray = new Tray(icon);
    tray.setToolTip('小手机智能家电助手');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开', click: () => { win.show(); win.focus(); } },
      { label: '查看新手教程', click: () => shell.openPath(path.join(runtime(), '新手教程.html')) },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    if (secureBinding()) start();
    if (process.argv.includes('--background') && secureBinding()) win.hide();
  }).catch(error => {
    if (process.argv.includes('--smoke-test')) { console.error(error); app.exit(1); return; }
    createWindow();
    win.webContents.once('did-finish-load', () => emit({ lastError: String(error?.message || error) }));
  });
}

app.on('before-quit', () => { app.isQuitting = true; worker?.stop(); });
