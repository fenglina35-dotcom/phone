// 窗台测速的局域网小网站：只给同一个 Wi-Fi 里的手机看这个文件夹（测试页 + build/ 里的测试版窗台），
// 收手机传回的测速结果，存到 results/ 并在这里打印。不上网、不公开，测完关掉。
// Usage: node scripts/windowsill_phone_test/serve.mjs [port]   (default 8790)
import {createServer} from 'node:http';
import {readFileSync, writeFileSync, existsSync, statSync, mkdirSync} from 'node:fs';
import {join, resolve, dirname, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const port = +process.argv[2] || 8790;
if (!existsSync(join(here, 'build/index.html'))) throw new Error('先打测试版：node scripts/build_couple_windowsill.mjs --tools <工具文件夹> --test-out scripts/windowsill_phone_test/build');
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg'};

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/report') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body), dir = join(here, 'results'); mkdirSync(dir, {recursive: true});
        const file = join(dir, new Date().toISOString().replace(/[:.]/g, '-') + '.json');
        writeFileSync(file, JSON.stringify(data, null, 2));
        console.log('\n收到测速结果 ' + file + '\n' + (data.device && data.device.ua || ''));
        const ph = p => p ? `${p.fps}帧 程序${p.jsAvg}ms 画${p.calls}遍` : '—';
        for (const s of data.segments || []) for (const k of ['overview', 'book', 'back1', 'music', 'back2', 'early', 'mid', 'late']) if (s[k] && s[k].steps) console.log('  ' + (s.id + ' ' + k).padEnd(16), Object.entries(s[k].steps).slice(0, 6).map(([n, v]) => n + ' ' + v + 'ms').join('  '));
        for (const s of data.segments || []) console.log((s.name || s.id).padEnd(22), s.error || (s.early ? `开头 ${ph(s.early)} | 中间 ${ph(s.mid)} | 降速后 ${ph(s.late)} | 清晰度 ${s.scale}` : s.overview ? `全景 ${ph(s.overview)} | 共读 ${ph(s.book)} | 一起听 ${ph(s.music)} | 清晰度 ${s.scale}` : `${s.fps} 帧/秒  最卡 ${s.worst}ms  卡顿 ${s.slow} 次  清晰度 ${s.scale}`));
        res.writeHead(200, {'Content-Type': 'application/json'}); res.end('{"ok":true}');
      } catch (e) { res.writeHead(400); res.end('bad report'); }
    });
    return;
  }
  const path = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = resolve(here, '.' + path);
  if (!file.startsWith(here + sep) || file.includes(sep + 'results' + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
  res.end(readFileSync(file));
}).listen(port, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log('窗台测速已开：' + ips.map(ip => `http://${ip}:${port}/`).join('  '));
});
