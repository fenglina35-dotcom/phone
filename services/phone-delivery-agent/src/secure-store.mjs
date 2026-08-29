import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { safeStorage } from 'electron';

export class SecureStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'device-binding.dat');
  }

  async load() {
    try {
      const encoded = await fs.readFile(this.file);
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 安全存储当前不可用');
      const decoded = safeStorage.decryptString(encoded);
      const value = JSON.parse(decoded);
      return value && typeof value === 'object' ? value : null;
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(value) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 安全存储当前不可用，已拒绝保存设备密钥');
    await fs.mkdir(this.directory, { recursive: true });
    const encrypted = safeStorage.encryptString(JSON.stringify(value));
    const temporary = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, encrypted, { mode: 0o600 });
    await fs.rename(temporary, this.file);
  }

  async clear() {
    await fs.rm(this.file, { force: true });
  }

  static newIdentity() {
    return {
      deviceId: `win_${crypto.randomUUID()}`,
      deviceSecret: `dld_${crypto.randomBytes(32).toString('hex')}`,
    };
  }

  static available() {
    return safeStorage.isEncryptionAvailable();
  }
}
