import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { SecureStore } from './secure-store.mjs';
import { RelayWorker } from './relay-worker.mjs';
import { RuntimeUpdater } from './runtime-updater.mjs';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
let windowRef = null, tray = null, worker = null, store = null, binding = null, publicConfig = null;

function packagedRuntimePath() {
  const appPath = app.getAppPath();
  return appPath.endsWith('app.asar') ? path.join(`${appPath}.unpacked`, 'runtime') : path.join(appPath, 'runtime');
}

function activeRuntimeCodePath() {
  const root = packagedRuntimePath();
  const current = path.join(root, 'code');
  const previous = path.join(root, 'code.previous');
  return existsSync(current) ? current : previous;
}

async function readPublicConfig() {
  const value = JSON.parse(await fs.readFile(path.join(packagedRuntimePath(), 'public-config.json'), 'utf8'));
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(value.supabaseUrl || '') || String(value.publishableKey || '').length < 40) {
    throw new Error('安装包的公开云配置无效');
  }
  return value;
}

function edgeExecutable() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  return candidates.find(candidate => candidate && requireExists(candidate)) || '';
}

function requireExists(value) {
  try { return Boolean(value && existsSync(value)); } catch { return false; }
}

function fullState(extra = {}) {
  const relay = worker?.state() || { worker: binding ? 'offline' : 'unpaired', runtimeVersion: '', lastError: '' };
  return {
    linked: Boolean(binding?.target && binding?.deviceSecret),
    deviceName: binding?.deviceName || os.hostname(),
    version: app.getVersion(),
    ...relay,
    ...extra,
  };
}

function broadcast(extra) {
  const value = fullState(extra);
  if (windowRef && !windowRef.isDestroyed()) windowRef.webContents.send('delivery:state-changed', value);
  return value;
}

async function rpc(name, body) {
  const response = await fetch(`${publicConfig.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: publicConfig.publishableKey,
      authorization: `Bearer ${publicConfig.publishableKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const original = String(data?.message || data || `云端请求失败 ${response.status}`);
    const friendly = /pair-code-invalid-or-expired/.test(original) ? '配对码不正确或已经过期，请在小手机里重新生成'
      : /invalid-pair-code/.test(original) ? '请输入小手机显示的十位配对码'
      : /device_id.*unique|duplicate key/i.test(original) ? '这台电脑已经绑定过另一个小手机，请先在原账号中解绑'
      : original;
    throw new Error(friendly.slice(0, 240));
  }
  return data;
}

function startWorker() {
  if (!binding?.target || worker) return;
  const edgePath = edgeExecutable();
  if (!edgePath) throw new Error('这台电脑没有找到 Microsoft Edge');
  worker = new RelayWorker({
    config: publicConfig,
    binding,
    runtimePath: activeRuntimeCodePath(),
    profilePath: path.join(app.getPath('userData'), 'delivery-edge-profile'),
    version: app.getVersion(),
    edgePath,
    onState: () => broadcast(),
  });
  worker.start();
}

async function checkRuntimeUpdate({ automatic = false } = {}) {
  if (worker?.state().worker === 'busy') {
    if (automatic) return { updated: false, skipped: true, message: '正在执行点单，本次自动更新已跳过' };
    throw new Error('正在执行点单，请完成后再检查更新');
  }
  const updater = new RuntimeUpdater({
    runtimeRoot: packagedRuntimePath(),
    manifestUrl: publicConfig.runtimeManifestUrl,
    publicKey: publicConfig.runtimeUpdatePublicKey,
  });
  const hadWorker = Boolean(worker);
  if (hadWorker) { await worker.stop(); worker = null; }
  try {
    const result = await updater.checkAndInstall();
    broadcast({ updateMessage: result.message });
    return result;
  } finally {
    if (hadWorker && binding) startWorker();
  }
}

function showWindow() {
  if (!windowRef || windowRef.isDestroyed()) createWindow();
  windowRef.show();
  windowRef.focus();
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 620,
    height: 760,
    minWidth: 520,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: '小手机外卖伴生程序',
    webPreferences: {
      preload: path.join(sourceDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  windowRef.loadFile(path.join(sourceDirectory, 'index.html'));
  windowRef.once('ready-to-show', () => windowRef?.show());
  windowRef.on('close', event => {
    if (!app.isQuitting) { event.preventDefault(); windowRef?.hide(); }
  });
}

function createTray() {
  let icon = nativeImage.createFromPath(path.join(packagedRuntimePath(), 'icon.png'));
  if (!icon.isEmpty()) icon = icon.resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip('小手机外卖伴生程序');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开', click: showWindow },
    { label: '打开专用外卖 Edge', click: () => worker?.openLogin().catch(error => broadcast({ lastError: error.message })) },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showWindow);
}

ipcMain.handle('delivery:state', () => fullState());
ipcMain.handle('delivery:pair', async (_event, rawCode) => {
  const pairCode = String(rawCode || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(pairCode)) throw new Error('请输入小手机显示的十位配对码');
  const identity = SecureStore.newIdentity();
  const deviceName = `${os.hostname()} · Windows 外卖电脑`.slice(0, 80);
  const result = await rpc('phone_delivery_bind_device', {
    p_pair_code: pairCode,
    p_device_id: identity.deviceId,
    p_device_name: deviceName,
    p_device_secret: identity.deviceSecret,
    p_agent_version: app.getVersion(),
  });
  if (!result?.ok || !result?.target) throw new Error('云端没有确认设备绑定');
  binding = { ...identity, target: result.target, deviceName };
  await store.save(binding);
  startWorker();
  return broadcast();
});
ipcMain.handle('delivery:open-login', async () => {
  if (!worker) throw new Error('请先输入小手机配对码');
  await worker.openLogin();
  return true;
});
ipcMain.handle('delivery:open-small-phone', () => shell.openExternal(publicConfig.smallPhoneUrl));
ipcMain.handle('delivery:check-update', async () => checkRuntimeUpdate());
ipcMain.handle('delivery:forget-local', async () => {
  await worker?.stop(); worker = null; binding = null; await store.clear(); return broadcast();
});
ipcMain.handle('delivery:purge-local', async () => {
  await worker?.stop({ closeEdge: true });
  worker = null;
  const userData = path.resolve(app.getPath('userData'));
  const profile = path.resolve(userData, 'delivery-edge-profile');
  if (path.dirname(profile) !== userData) throw new Error('本机资料目录校验失败，已停止清理');
  await fs.rm(profile, { recursive: true, force: true });
  binding = null;
  await store.clear();
  return broadcast();
});

const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    publicConfig = await readPublicConfig();
    store = new SecureStore(app.getPath('userData'));
    if (!SecureStore.available()) throw new Error('Windows DPAPI 安全存储不可用，已拒绝启动外卖设备绑定');
    binding = await store.load();
    app.setLoginItemSettings({ openAtLogin: true, args: ['--background'] });
    createWindow(); createTray();
    if (binding) startWorker();
    setTimeout(() => checkRuntimeUpdate({ automatic: true }).catch(error => broadcast({ updateMessage: `自动更新未完成：${error.message}` })), 15_000);
    setInterval(() => checkRuntimeUpdate({ automatic: true }).catch(error => broadcast({ updateMessage: `自动更新未完成：${error.message}` })), 12 * 60 * 60 * 1000);
    if (process.argv.includes('--background') && binding) windowRef?.hide();
  }).catch(error => {
    createWindow();
    windowRef?.webContents.once('did-finish-load', () => broadcast({ lastError: String(error?.message || error), worker: 'offline' }));
  });
}

app.on('before-quit', () => { app.isQuitting = true; worker?.stop().catch(() => {}); });
