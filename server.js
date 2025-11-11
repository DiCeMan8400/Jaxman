// Minimal Node server to serve dist/ and handle high-score storage.
// No external dependencies.
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const distDir = path.resolve(__dirname, 'dist');
const dataDir = path.resolve(__dirname, 'data');
const dataPath = path.resolve(dataDir, 'highscores.json');

const ensureDir = () => { try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {} };
const readScores = () => {
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
};
const writeScores = (list) => {
  ensureDir();
  try { fs.writeFileSync(dataPath, JSON.stringify(list.slice(0, 200), null, 2), 'utf-8'); } catch (_) {}
};

const sendJson = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
};

const serveStatic = (req, res) => {
  let filePath = url.parse(req.url).pathname || '/';
  if (filePath === '/') filePath = '/index.html';
  const safePath = path.normalize(filePath).replace(/^\\|^\//, '');
  const fullPath = path.resolve(distDir, safePath);
  if (!fullPath.startsWith(distDir)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(fullPath).toLowerCase();
    const type = ext === '.html' ? 'text/html'
      : ext === '.js' ? 'application/javascript'
      : ext === '.css' ? 'text/css'
      : ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.svg' ? 'image/svg+xml'
      : ext === '.json' ? 'application/json'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  const { method, url: reqUrl } = req;
  const parsed = url.parse(reqUrl, true);

  if (parsed.pathname === '/api/highscores' && method === 'GET') {
    const list = readScores().sort((a, b) => (b.score || 0) - (a.score || 0));
    return sendJson(res, 200, { ok: true, top: list.slice(0, 10) });
  }
  if (parsed.pathname === '/api/highscores' && method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const name = ((payload.name || 'Anonymous') + '').substring(0, 32);
        const score = Math.floor(Number(payload.score) || 0);
        const timestamp = Number(payload.timestamp) || Date.now();
        if (!Number.isFinite(score) || score <= 0) throw new Error('Invalid score');
        const list = readScores();
        list.push({ name, score, timestamp });
        list.sort((a, b) => (b.score || 0) - (a.score || 0));
        writeScores(list);
        return sendJson(res, 200, { ok: true, entry: { name, score, timestamp }, top: list.slice(0, 10) });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: e.message || 'Bad Request' });
      }
    });
    return;
  }

  // Fallback to static assets
  serveStatic(req, res);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});

