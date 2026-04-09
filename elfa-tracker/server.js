import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ELFA_KEY = process.env.ELFA_API_KEY || 'elfak_4ac83fb79bad812096956c477705ffb0ca1b66d1';
const PORT     = process.env.PORT || 3001;

function proxyElfa(req, res, bodyStr) {
  const targetPath = req.url.replace(/^\/api/, '');
  const options = {
    hostname: 'api.elfa.ai',
    port: 443,
    path: targetPath,
    method: req.method,
    headers: { 'Content-Type': 'application/json', 'x-elfa-api-key': ELFA_KEY },
  };
  if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
  if (bodyStr) proxyReq.write(bodyStr);
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500); res.end('Could not load index.html');
    }
    return;
  }

  if (req.url.startsWith('/api/')) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => proxyElfa(req, res, body || null));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  Elfa Opinion Tracker → http://localhost:${PORT}\n`);
});
