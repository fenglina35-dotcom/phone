import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export class RelayWorker {
  constructor({ config, binding, runtimePath, profilePath, version, edgePath, onState }) {
    this.config = config;
    this.binding = binding;
    this.runtimePath = runtimePath;
    this.profilePath = profilePath;
    this.version = version;
    this.edgePath = edgePath;
    this.onState = onState || (() => {});
    this.stopped = true;
    this.running = false;
    this.browser = null;
    this.adapter = null;
    this.runtimeVersion = '';
    this.lastError = '';
  }

  async rpc(name, body) {
    const response = await fetch(`${this.config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: this.config.publishableKey,
        authorization: `Bearer ${this.config.publishableKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(25_000),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) throw new Error(String(data?.message || data || `云端请求失败 ${response.status}`).slice(0, 240));
    return data;
  }

  async ensureAdapter() {
    if (this.adapter) return this.adapter;
    process.env.PHONE_DELIVERY_CHROME_PATH = this.edgePath;
    process.env.PHONE_DELIVERY_CDP_PORT = '9333';
    const [{ DeliveryAdapter }, { TaobaoFlashBrowser }] = await Promise.all([
      import(pathToFileURL(path.join(this.runtimePath, 'adapter.mjs')).href),
      import(pathToFileURL(path.join(this.runtimePath, 'taobao-flash-browser.mjs')).href),
    ]);
    try {
      const info = JSON.parse(await fs.readFile(path.join(this.runtimePath, 'runtime-version.json'), 'utf8'));
      this.runtimeVersion = String(info.version || '');
    } catch { this.runtimeVersion = ''; }
    this.browser = new TaobaoFlashBrowser({
      profile: this.profilePath,
      headless: false,
      timeout: 30_000,
      cdpPort: 9333,
    });
    this.adapter = new DeliveryAdapter({
      browser: this.browser,
      secret: this.binding.deviceSecret,
      maxOrderAmount: 100,
      maxOffers: 4,
    });
    return this.adapter;
  }

  state() {
    return {
      worker: this.running ? 'busy' : this.stopped ? 'offline' : 'online',
      runtimeVersion: this.runtimeVersion,
      lastError: this.lastError,
    };
  }

  emit() { this.onState(this.state()); }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.emit();
    this.loop().catch(error => {
      this.lastError = String(error?.message || error).slice(0, 180);
      this.running = false;
      this.stopped = true;
      this.emit();
    });
  }

  async stop({ closeEdge = false } = {}) {
    this.stopped = true;
    if (closeEdge) await this.browser?.forceClose?.().catch(() => {});
    else await this.browser?.close().catch(() => {});
    this.browser = null;
    this.adapter = null;
    this.emit();
  }

  async openLogin() {
    const adapter = await this.ensureAdapter();
    await adapter.browser.start();
    await adapter.browser.page?.goto('https://h5.ele.me/', { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    await adapter.browser.reveal();
    this.emit();
  }

  async loop() {
    let backoff = 1500;
    while (!this.stopped) {
      try {
        const jobs = await this.rpc('phone_delivery_pull_device_jobs', {
          p_target: this.binding.target,
          p_device_secret: this.binding.deviceSecret,
          p_agent_version: this.version,
        });
        if (jobs === null) throw new Error('设备绑定已失效，请在小手机里重新配对');
        this.lastError = '';
        backoff = 1500;
        for (const job of Array.isArray(jobs) ? jobs : []) {
          if (this.stopped) break;
          await this.execute(job);
        }
        this.emit();
        await wait(2200);
      } catch (error) {
        this.lastError = String(error?.message || error).slice(0, 180);
        this.emit();
        await wait(backoff);
        backoff = Math.min(30_000, Math.round(backoff * 1.7));
      }
    }
  }

  async execute(job) {
    const id = String(job?.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    this.running = true;
    this.emit();
    let ok = false, result = {}, errorText = '';
    try {
      const adapter = await this.ensureAdapter();
      result = await adapter.handle(String(job.action || ''), job.payload || {}, {
        ...(job.context || {}),
        target: this.binding.target,
        deviceId: this.binding.deviceId,
        deviceName: os.hostname(),
      });
      ok = true;
    } catch (error) {
      errorText = String(error?.message || error || '个人外卖电脑执行失败').slice(0, 240);
    }
    try {
      const completed = await this.rpc('phone_delivery_complete_device_job', {
        p_target: this.binding.target,
        p_device_secret: this.binding.deviceSecret,
        p_job_id: id,
        p_ok: ok,
        p_result: ok && result && typeof result === 'object' ? result : {},
        p_error: errorText,
      });
      if (completed !== true) throw new Error('任务完成回执被拒绝');
    } finally {
      this.running = false;
      this.emit();
    }
  }
}
