import crypto from 'node:crypto';
import net from 'node:net';
import os from 'node:os';
import createMdns from 'multicast-dns';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

export const NAMED_COLORS = Object.freeze({
  pink: [335, 60], rose: [345, 70], red: [0, 75], orange: [28, 80],
  yellow: [52, 75], green: [120, 65], cyan: [185, 65], blue: [215, 70],
  purple: [282, 58], white: [0, 0],
});

function privateAddress(value) {
  if (net.isIPv4(value)) {
    const parts = value.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 169 && parts[1] === 254);
  }
  return net.isIPv6(value) && (/^(?:fe80|fc|fd)/i.test(value) || value === '::1');
}

function hsvToRgb(hue, saturation) {
  const h = ((Number(hue) % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const c = s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = 1 - c;
  let rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  rgb = rgb.map(value => Math.round((value + m) * 255));
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

function rgbToHsv(value) {
  const r = ((value >> 16) & 255) / 255, g = ((value >> 8) & 255) / 255, b = (value & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = delta === 0 ? 0 : max === r ? 60 * (((g - b) / delta) % 6)
    : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return { hue: Math.round(hue), saturation: Math.round((max === 0 ? 0 : delta / max) * 100) };
}

function rawHttpPost(host, body, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: 80 });
    const chunks = [];
    const fail = error => { socket.destroy(); reject(error); };
    socket.setTimeout(timeout, () => fail(new Error('灯具响应超时')));
    socket.on('error', fail);
    socket.on('data', chunk => {
      chunks.push(chunk);
      if (chunks.reduce((sum, value) => sum + value.length, 0) > 2 * 1024 * 1024) fail(new Error('灯具响应过大'));
    });
    socket.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8'), split = raw.indexOf('\r\n\r\n');
        const json = (split >= 0 ? raw.slice(split + 4) : raw).trim();
        resolve(JSON.parse(json));
      } catch (_) { reject(new Error('灯具返回的数据无法解析')); }
    });
    socket.on('connect', () => {
      const bytes = Buffer.byteLength(body);
      socket.write(`POST /config HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/json\r\nContent-Length: ${bytes}\r\nConnection: close\r\n\r\n${body}`);
    });
  });
}

function normalizePlan(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const allowed = new Set(['power', 'brightness', 'color', 'hue', 'saturation', 'warmth']);
  if (!Object.keys(value).length || Object.keys(value).some(key => !allowed.has(key))) throw new Error('灯控动作不在白名单内');
  const plan = {};
  if (value.power !== undefined) {
    if (!['on', 'off'].includes(value.power)) throw new Error('开关参数无效');
    plan.power = value.power;
  }
  if (value.brightness !== undefined) {
    const n = Number(value.brightness);
    if (!Number.isFinite(n) || n < 1 || n > 100) throw new Error('亮度必须是 1 到 100');
    plan.brightness = Math.round(n);
  }
  if (value.color !== undefined) {
    if (!NAMED_COLORS[value.color]) throw new Error('颜色不在允许范围内');
    plan.color = value.color;
  }
  const hasHue = value.hue !== undefined, hasSaturation = value.saturation !== undefined;
  if (hasHue !== hasSaturation) throw new Error('色相和饱和度必须同时提供');
  if (hasHue) {
    const hue = Number(value.hue), saturation = Number(value.saturation);
    if (!Number.isFinite(hue) || hue < 0 || hue > 360 || !Number.isFinite(saturation) || saturation < 0 || saturation > 100) throw new Error('颜色数值无效');
    plan.hue = hue; plan.saturation = saturation;
  }
  if (value.warmth !== undefined) {
    const warmth = Number(value.warmth);
    if (!Number.isFinite(warmth) || warmth < 0 || warmth > 100) throw new Error('色温数值无效');
    plan.warmth = Math.round(warmth);
  }
  if (plan.color !== undefined && hasHue || plan.warmth !== undefined && (plan.color !== undefined || hasHue)) throw new Error('颜色和色温不能混用');
  if (plan.power === 'off' && Object.keys(plan).length > 1) throw new Error('关灯动作不能混入其他参数');
  return plan;
}

export class MerossLocalController {
  constructor({ host, key = '', fetchImpl = null }) {
    if (!privateAddress(host)) throw new Error('只允许连接局域网设备');
    this.host = host;
    this.key = String(key || '');
    this.fetchImpl = fetchImpl;
  }

  static async discover({ timeout = 8000, mdnsFactory = createMdns, networkInterfaces = os.networkInterfaces() } = {}) {
    const addresses = Object.values(networkInterfaces).flat().filter(row => row && row.family === 'IPv4' && !row.internal && privateAddress(row.address)).map(row => row.address);
    const services = new Map(), hosts = new Map(), sockets = [];
    const ensure = name => {
      const key = String(name || '').toLowerCase();
      if (!services.has(key)) services.set(key, { instance: String(name || ''), txt: {}, target: '', port: 0 });
      return services.get(key);
    };
    const onResponse = packet => {
      for (const row of [...(packet.answers || []), ...(packet.additionals || [])]) {
        if (row.type === 'PTR' && String(row.name).toLowerCase() === '_hap._tcp.local') ensure(row.data);
        else if (row.type === 'TXT') {
          const service = ensure(row.name);
          for (const part of Array.isArray(row.data) ? row.data : []) {
            const entry = Buffer.from(part).toString(), split = entry.indexOf('=');
            if (split > 0) service.txt[entry.slice(0, split).toLowerCase()] = entry.slice(split + 1);
          }
        } else if (row.type === 'SRV') {
          const service = ensure(row.name); service.target = String(row.data?.target || '').toLowerCase(); service.port = Number(row.data?.port || 0);
        } else if ((row.type === 'A' || row.type === 'AAAA') && privateAddress(String(row.data || ''))) hosts.set(String(row.name || '').toLowerCase(), String(row.data));
      }
    };
    try {
      for (const address of addresses) {
        const socket = mdnsFactory({ interface: address });
        socket.on('response', onResponse);
        socket.query([{ name: '_hap._tcp.local', type: 'PTR' }]);
        sockets.push(socket);
      }
      await wait(timeout);
    } finally {
      for (const socket of sockets) socket.destroy();
    }
    return [...services.values()].filter(service => String(service.txt.md || '').toLowerCase() === 'msl430' && hosts.has(service.target) && service.port > 0).map(service => ({
      host: hosts.get(service.target), port: service.port, model: 'MSL430', name: service.instance.replace(/\._hap\._tcp\.local\.?$/i, ''),
    }));
  }

  async request(method, namespace, payload = {}) {
    const messageId = crypto.randomUUID().replaceAll('-', '');
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = crypto.createHash('md5').update(`${messageId}${this.key}${timestamp}`).digest('hex');
    const body = JSON.stringify({ header: { from: '/app/0/subscribe', messageId, method, namespace, payloadVersion: 1, sign, timestamp, triggerSrc: 'Android' }, payload });
    let data;
    if (this.fetchImpl) {
      const response = await this.fetchImpl(`http://${this.host}/config`, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(5000), body });
      if (!response.ok) throw new Error(`灯具连接失败 ${response.status}`);
      data = await response.json();
    } else data = await rawHttpPost(this.host, body);
    if (data?.payload?.error) throw new Error(`灯具拒绝请求 ${data.payload.error.code || ''}`.trim());
    const expectedAck = `${method}ACK`;
    if (data?.header?.method !== expectedAck) throw new Error('灯具没有返回有效确认');
    return data;
  }

  async snapshot() {
    const data = await this.request('GET', 'Appliance.System.All', {});
    const all = data?.payload?.all || {}, digest = all.digest || {}, light = digest.light || {};
    const toggle = Array.isArray(digest.togglex) ? digest.togglex[0] || {} : {};
    if (String(all?.system?.hardware?.type || '').toLowerCase() !== 'msl430') throw new Error('当前只允许控制已实测的 MSL430');
    const color = Number.isFinite(Number(light.rgb)) ? rgbToHsv(Number(light.rgb)) : { hue: null, saturation: null };
    return {
      model: 'MSL430', power: Number(toggle.onoff) === 1, brightness: Number(light.luminance),
      rgb: Number(light.rgb), hue: color.hue, saturation: color.saturation,
      warmth: Number(light.temperature), capacity: Number(light.capacity), channel: Number(light.channel || 0),
      readAt: new Date().toISOString(),
    };
  }

  async setPower(on) {
    await this.request('SET', 'Appliance.Control.ToggleX', { togglex: { channel: 0, onoff: on ? 1 : 0 } });
  }

  async setLight(current, plan) {
    const brightness = plan.brightness ?? current.brightness;
    let capacity = current.capacity, rgb = current.rgb, warmth = current.warmth;
    if (plan.color !== undefined || plan.hue !== undefined) {
      const [hue, saturation] = plan.color !== undefined ? NAMED_COLORS[plan.color] : [plan.hue, plan.saturation];
      rgb = hsvToRgb(hue, saturation); capacity = 5;
    } else if (plan.warmth !== undefined) {
      warmth = plan.warmth; capacity = 6;
    }
    const light = { channel: 0, gradual: 0, capacity, luminance: brightness };
    if (capacity & 1) light.rgb = rgb;
    if (capacity & 2) light.temperature = warmth;
    await this.request('SET', 'Appliance.Control.Light', { light });
  }

  matches(state, plan) {
    if (plan.power !== undefined && state.power !== (plan.power === 'on')) return false;
    if (plan.brightness !== undefined && Math.abs(state.brightness - plan.brightness) > 1) return false;
    if (plan.warmth !== undefined && Math.abs(state.warmth - plan.warmth) > 1) return false;
    if (plan.color !== undefined || plan.hue !== undefined) {
      const [hue, saturation] = plan.color !== undefined ? NAMED_COLORS[plan.color] : [plan.hue, plan.saturation];
      const expected = hsvToRgb(hue, saturation);
      if (state.rgb !== expected) return false;
    }
    return true;
  }

  async execute(rawPlan) {
    const plan = normalizePlan(rawPlan);
    let before = await this.snapshot();
    if (plan.power !== undefined) await this.setPower(plan.power === 'on');
    if (plan.brightness !== undefined || plan.color !== undefined || plan.hue !== undefined || plan.warmth !== undefined) await this.setLight(before, plan);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt) await wait(350);
      const state = await this.snapshot();
      if (this.matches(state, plan)) return { ok: true, verified: true, state };
    }
    throw new Error('命令后的真实状态与目标不一致');
  }
}
