import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';

const ALLOWED_FILES = new Set(['adapter.mjs', 'security.mjs', 'taobao-flash-browser.mjs', 'runtime-version.json']);
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;

function numericVersion(value) {
  const match = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

export function isNewerVersion(candidate, current) {
  const next = numericVersion(candidate);
  const now = numericVersion(current);
  if (!next || !now) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] !== now[index]) return next[index] > now[index];
  }
  return false;
}

function verifyManifest(manifest, publicKey) {
  if (manifest?.algorithm !== 'Ed25519' || !manifest.payload || typeof manifest.signature !== 'string') {
    throw new Error('更新清单格式无效');
  }
  const payload = manifest.payload;
  if (!/^\d+\.\d+\.\d+$/.test(String(payload.version || ''))) throw new Error('更新版本号无效');
  if (!/^https:\/\//i.test(String(payload.url || ''))) throw new Error('更新地址必须使用 HTTPS');
  if (!/^[a-f0-9]{64}$/i.test(String(payload.sha256 || ''))) throw new Error('更新哈希无效');
  if (!Number.isInteger(payload.size) || payload.size <= 0 || payload.size > MAX_ARCHIVE_BYTES) throw new Error('更新包大小异常');
  const ok = crypto.verify(null, Buffer.from(JSON.stringify(payload)), publicKey, Buffer.from(manifest.signature, 'base64'));
  if (!ok) throw new Error('更新签名校验失败，已拒绝安装');
  return payload;
}

function validateEntries(zip) {
  const entries = zip.getEntries().filter(entry => !entry.isDirectory);
  const names = entries.map(entry => entry.entryName.replace(/\\/g, '/'));
  if (names.length !== ALLOWED_FILES.size || names.some(name => name.includes('/') || !ALLOWED_FILES.has(name))) {
    throw new Error('更新包包含未授权文件');
  }
  for (const required of ALLOWED_FILES) if (!names.includes(required)) throw new Error(`更新包缺少 ${required}`);
}

export class RuntimeUpdater {
  constructor({ runtimeRoot, manifestUrl, publicKey, fetcher = fetch }) {
    this.runtimeRoot = runtimeRoot;
    this.manifestUrl = manifestUrl;
    this.publicKey = publicKey;
    this.fetcher = fetcher;
  }

  async currentVersion() {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.runtimeRoot, 'code', 'runtime-version.json'), 'utf8'));
      return String(value.version || '0.0.0');
    } catch { return '0.0.0'; }
  }

  async fetchBuffer(url, limit) {
    const response = await this.fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`下载更新失败 ${response.status}`);
    const announced = Number(response.headers?.get?.('content-length') || 0);
    if (announced > limit) throw new Error('更新包超过允许大小');
    const value = Buffer.from(await response.arrayBuffer());
    if (value.length > limit) throw new Error('更新包超过允许大小');
    return value;
  }

  async checkAndInstall() {
    if (!this.publicKey?.includes('PUBLIC KEY')) throw new Error('安装包没有可信更新公钥');
    const manifestBytes = await this.fetchBuffer(this.manifestUrl, 128 * 1024);
    let manifest;
    try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch { throw new Error('更新清单不是有效 JSON'); }
    const payload = verifyManifest(manifest, this.publicKey);
    const current = await this.currentVersion();
    if (!isNewerVersion(payload.version, current)) return { updated: false, version: current, message: `当前运行规则已是最新版 ${current}` };

    const archive = await this.fetchBuffer(payload.url, MAX_ARCHIVE_BYTES);
    if (archive.length !== payload.size) throw new Error('更新包大小校验失败');
    const sha256 = crypto.createHash('sha256').update(archive).digest('hex');
    if (sha256 !== payload.sha256.toLowerCase()) throw new Error('更新包哈希校验失败，已拒绝安装');
    const zip = new AdmZip(archive);
    validateEntries(zip);

    const next = path.join(this.runtimeRoot, `code.next.${process.pid}`);
    const currentPath = path.join(this.runtimeRoot, 'code');
    const previous = path.join(this.runtimeRoot, 'code.previous');
    await fs.rm(next, { recursive: true, force: true });
    await fs.mkdir(next, { recursive: true });
    for (const entry of zip.getEntries()) {
      if (!entry.isDirectory) await fs.writeFile(path.join(next, entry.entryName), entry.getData());
    }
    const installed = JSON.parse(await fs.readFile(path.join(next, 'runtime-version.json'), 'utf8'));
    if (String(installed.version) !== payload.version) throw new Error('更新包内部版本不匹配');

    await fs.rm(previous, { recursive: true, force: true });
    try {
      await fs.rename(currentPath, previous);
      await fs.rename(next, currentPath);
    } catch (error) {
      if (!(await fs.stat(currentPath).catch(() => null)) && await fs.stat(previous).catch(() => null)) {
        await fs.rename(previous, currentPath).catch(() => {});
      }
      await fs.rm(next, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    return { updated: true, version: payload.version, message: `运行规则已安全更新到 ${payload.version}` };
  }
}
