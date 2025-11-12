// One-file prod-ish host for your event: HTTPS on 443 + HTTP->HTTPS redirect on 80
// - Serves ./dist (build output)
// - In-memory /api/highscores (resets when the process restarts)
// - Uses a PFX cert (Windows-friendly)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import https from 'https';
import http from 'http';

// ---- config (edit to taste or pass via env) ----
const HOST = process.env.HOST || '0.0.0.0';
const HTTPS_PORT = Number(process.env.PORT || 443);
const HTTP_PORT  = Number(process.env.HTTP_PORT || 80);

// PFX cert settings
const PFX_PATH = process.env.PFX_PATH || 'e:/webs/Jaxman/jaxman_jax_org.pfx';
const PFX_PASSPHRASE = process.env.PFX_PASSPHRASE || 'P@55w0rd';

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

// ---- express app ----
const app = express();
app.set('trust proxy', true);

// Security-ish headers (lightweight)
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});

// Parse JSON bodies for API
app.use(express.json({ limit: '32kb' }));

// In-memory scoreboard (ephemeral)
const scores = [];

app.get('/api/highscores', (req, res) => {
  const list = scores.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  res.json({ ok: true, top: list.slice(0, 10) });
});

app.post('/api/highscores', (req, res) => {
  try {
    const { name = 'Anonymous', score = 0, timestamp = Date.now() } = req.body || {};
    const entry = {
      name: String(name).substring(0, 32),
      score: Math.floor(Number(score) || 0),
      timestamp: Number(timestamp) || Date.now()
    };
    if (!Number.isFinite(entry.score) || entry.score <= 0) throw new Error('Invalid score');
    scores.push(entry);
    scores.sort((a, b) => (b.score || 0) - (a.score || 0));
    res.json({ ok: true, entry, top: scores.slice(0, 10) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || 'Bad Request' });
  }
});

// Serve static build
app.use(express.static(DIST_DIR, { maxAge: 0 }));

// Fallback to index.html (if client-side routing is used)
app.get('*', (_, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));

// ---- start HTTPS server ----
const httpsOptions = {
  pfx: fs.readFileSync(PFX_PATH),
  passphrase: PFX_PASSPHRASE,
  // secureOptions/ALPN default is fine; Node will negotiate HTTP/1.1
};

const httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(HTTPS_PORT, HOST, () => {
  console.log(`HTTPS server up on https://${HOST}:${HTTPS_PORT}`);
});

// ---- tiny HTTP -> HTTPS redirector on port 80 (optional but recommended) ----
const httpServer = http.createServer((req, res) => {
  const hostHeader = req.headers.host || 'localhost';
  const [hostOnly] = hostHeader.split(':'); // strip port if present
  const location = `https://${hostOnly}${HTTPS_PORT === 443 ? '' : ':' + HTTPS_PORT}${req.url}`;
  res.statusCode = 301;
  res.setHeader('Location', location);
  res.end();
});
httpServer.listen(HTTP_PORT, HOST, () => {
  console.log(`HTTP redirector on http://${HOST}:${HTTP_PORT} -> https://${HOST}:${HTTPS_PORT}`);
});
