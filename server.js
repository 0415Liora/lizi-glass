/* 厘子 · 病恋档案 —— 单端口服务
   1) 静态站点  2) 随站自带的云端快照仓库 /api/snap
   只读短链接把高清内容快照存这里，链接只需带一个短 id；
   静态托管（无此接口）时前端自动降级为「数据内嵌只读链接」，同样可用。 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'snaps.json');
const PORT = Number(process.env.PORT) || 3000;

let snaps = {};
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) snaps = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {};
} catch (e) { console.warn('快照仓库初始化：', e.message); }

function persist() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(snaps)); }
  catch (e) { console.warn('快照落盘失败（内存仍有效）：', e.message); }
}
function newId() {
  const c = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < 10; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, code, obj) {
  cors(res); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, 'http://' + (req.headers.host || 'localhost')); }
  catch (e) { json(res, 400, { error: 'bad url' }); return; }
  const p = u.pathname;

  if (p === '/api/snap' || p.endsWith('/api/snap')) {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
    if (req.method === 'GET') {
      const id = u.searchParams.get('id');
      if (!id) { json(res, 200, { ok: true, service: 'lizi-snapshot', count: Object.keys(snaps).length }); return; }
      if (!snaps[id]) { json(res, 404, { error: 'not found' }); return; }
      json(res, 200, { id: id, payload: snaps[id].payload, time: snaps[id].time });
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', function (c) { body += c; if (body.length > 25 * 1024 * 1024) { req.destroy(); } });
      req.on('end', function () {
        try {
          const j = JSON.parse(body || '{}');
          if (!j.payload) { json(res, 400, { error: 'missing payload' }); return; }
          const id = newId();
          snaps[id] = { payload: String(j.payload), time: Date.now() };
          persist();
          json(res, 200, { id: id });
        } catch (e) { json(res, 400, { error: 'bad json' }); }
      });
      return;
    }
    json(res, 405, { error: 'method' }); return;
  }

  // 静态文件
  let rel = decodeURIComponent(p);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('lizi site running on port ' + PORT + ' | snaps: ' + Object.keys(snaps).length);
});
