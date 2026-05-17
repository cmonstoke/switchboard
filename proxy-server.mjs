import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR ?? '/data';
const SWITCHES_FILE = path.join(DATA_DIR, 'switches.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSwitches() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(SWITCHES_FILE, 'utf8')); }
  catch { return []; }
}

function writeSwitches(list) {
  ensureDataDir();
  fs.writeFileSync(SWITCHES_FILE, JSON.stringify(list, null, 2));
}

function jsonResponse(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => resolve(body));
  });
}

http.createServer(async (req, res) => {
  const url = req.url ?? '/';

  // ── /api/switches ─────────────────────────────────────────────────────────
  if (url === '/api/switches' && req.method === 'GET') {
    return jsonResponse(res, 200, readSwitches());
  }

  if (url === '/api/switches' && req.method === 'POST') {
    const body = await readBody(req);
    const { name, ip } = JSON.parse(body);
    const sw = { id: crypto.randomUUID(), name, ip };
    writeSwitches([...readSwitches(), sw]);
    return jsonResponse(res, 201, sw);
  }

  const deleteMatch = url.match(/^\/api\/switches\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    writeSwitches(readSwitches().filter((s) => s.id !== deleteMatch[1]));
    res.writeHead(204); res.end();
    return;
  }

  // ── /switch/{ip}/{path} proxy ─────────────────────────────────────────────
  const match = url.match(/^\/switch\/([^/]+)(\/.*)?$/);
  if (!match) { res.writeHead(404); res.end('Not found'); return; }
  const [, ip, rest = '/'] = match;

  const proxyReq = http.request(
    { hostname: ip, port: 80, path: rest, method: req.method,
      headers: { ...req.headers, host: ip } },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );
  proxyReq.on('error', () => { res.writeHead(502); res.end('Switch unreachable'); });
  req.pipe(proxyReq, { end: true });
}).listen(3001, () => {
  console.log(`Switch proxy listening on :3001 (data: ${DATA_DIR})`);
});
