'use strict';
/*
 * Kompyuterda sinash uchun server: public/ saytini beradi va /api/lead ni
 * Vercel'dagi bilan aynan bir xil funksiyaga (api/lead.js) yoʻnaltiradi.
 *
 * Vercel'ga bu fayl kerak emas — u yerda public/ va api/ oʻzi ishlaydi.
 * Ishga tushirish: npm start  →  http://localhost:5180
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PUBLIC_DIR = path.join(__dirname, 'public');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  console.warn('⚠ .env topilmadi — sayt ochiladi, lekin forma lid yubormaydi (TELEGRAM_BOT_TOKEN kerak).');
}

const handleLead = require('./api/lead.js');

const PORT = Number(process.env.PORT) || 5180;
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end('Sahifa topilmadi');
}

async function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return notFound(res);
  }
  if (rel.includes('\\') || rel.includes('\0')) return notFound(res);
  if (rel.endsWith('/')) rel += 'index.html';

  const segments = rel.split('/').filter(Boolean);
  if (segments.some((s) => s.startsWith('.'))) return notFound(res);

  // only files that really live inside public/ are ever served
  const file = path.join(PUBLIC_DIR, ...segments);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return notFound(res);

  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) return notFound(res);

  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    return notFound(res);
  }
  if (!stat.isFile()) return notFound(res);

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/lead') return await handleLead(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    return await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('✖ Server xatosi:', (err && err.message) || err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Server xatosi');
    } else {
      res.destroy();
    }
  }
}).listen(PORT, HOST, () => {
  console.log(`United Finance Team sayti: http://localhost:${PORT}`);
});
