'use strict';
/*
 * United Finance Team — sayt va lid serveri
 *
 *   • public/ papkasidagi saytni tarqatadi — faqat shu papkani, boshqa hech narsani.
 *   • POST /api/lead  →  lidni Telegram guruhiga "#N1, #N2 …" raqami bilan yuboradi.
 *   • Bot tokeni faqat .env faylida turadi va brauzerga hech qachon chiqmaydi.
 *
 * Tashqi paket kerak emas: Node.js 20.12+ (process.loadEnvFile va fetch) yetarli.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const COUNTER_FILE = path.join(DATA_DIR, 'lead-counter.json');
const LOG_FILE = path.join(DATA_DIR, 'leads.jsonl');

const BODY_LIMIT = 8 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

/* ------------------------------------------------------------------ config */

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  console.error('✖ .env fayli topilmadi. .env.example dan nusxa oling va TELEGRAM_BOT_TOKEN ni yozing.');
  process.exit(1);
}

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
let chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
const PORT = Number(process.env.PORT) || 5180;
const HOST = process.env.HOST || '127.0.0.1';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

if (!/^\d+:[\w-]{30,}$/.test(TOKEN)) {
  console.error('✖ .env dagi TELEGRAM_BOT_TOKEN notoʻgʻri yoki boʻsh.');
  process.exit(1);
}

/** Anything that reaches a log goes through here, so the token never does. */
function scrub(value) {
  return String(value).split(TOKEN).join('<TOKEN>');
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

/* --------------------------------------------------------------- utilities */

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function notFound(res) {
  res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Sahifa topilmadi');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('body too large'), { status: 413 }));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) {
    return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Browsers always send Origin on a cross-site POST; reject other sites posting here. */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = (TRUST_PROXY && req.headers['x-forwarded-host']) || req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------- validation */

/** "+998 90 123 45 67", "901234567", "998901234567" → "998901234567" */
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 9) digits = '998' + digits;
  return /^998\d{9}$/.test(digits) ? digits : null;
}

/** "", "@name", "name", "t.me/name" → "" | "name";  invalid → null */
function normalizeTelegram(raw) {
  let value = String(raw || '').trim();
  if (!value) return '';
  value = value
    .replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');
  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(value) ? value : null;
}

function cleanText(raw, max) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------ rate limiting */

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    const recent = list.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length) hits.set(ip, recent);
    else hits.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

/* ------------------------------------------------------ lead numbering (#N) */

// Leads are handled one at a time so two visitors can never receive the same #N.
let queue = Promise.resolve();
function serial(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

// Also remembered in memory: if a counter write ever fails after a successful
// send, the next lead still moves forward instead of repeating the number.
let lastInMemory = 0;

async function readCounter() {
  let raw;
  try {
    raw = await fsp.readFile(COUNTER_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
  const last = JSON.parse(raw).last;
  // a damaged file must stop the line, not silently restart numbering at #N1
  if (!Number.isInteger(last) || last < 0) throw new Error('data/lead-counter.json buzilgan');
  return last;
}

async function writeCounter(last) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const tmp = COUNTER_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify({ last }) + '\n');
  await fsp.rename(tmp, COUNTER_FILE);
}

async function logLead(entry) {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.appendFile(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('✖ data/leads.jsonl ga yozib boʻlmadi:', scrub(err.message));
  }
}

/* ---------------------------------------------------------------- telegram */

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function formatPhone(d) {
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

function tashkentTime(date = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function buildMessage(n, lead) {
  const lines = [
    `🆕 <b>Yangi lid</b> #N${n}`,
    '',
    `📞 <b>Telefon:</b> ${formatPhone(lead.phone)}`,
    `✈️ <b>Telegram:</b> ${lead.telegram ? '@' + escapeHtml(lead.telegram) : 'koʻrsatilmagan'}`,
    `📍 <b>Manba:</b> ${escapeHtml(lead.source || 'Sayt')}`,
  ];
  if (lead.details) lines.push(`📝 <b>Tafsilot:</b> ${escapeHtml(lead.details)}`);
  lines.push(`🕐 <b>Vaqt:</b> ${tashkentTime()}`);
  return lines.join('\n');
}

async function callTelegram(method, params) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10_000),
  });
  return response.json();
}

async function sendToGroup(text) {
  const params = { text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
  let data = await callTelegram('sendMessage', { chat_id: chatId, ...params });

  // a group that becomes a supergroup gets a new id; follow it once
  const movedTo = data && !data.ok && data.parameters && data.parameters.migrate_to_chat_id;
  if (movedTo) {
    console.warn(`⚠ Guruh supergroup ga aylangan. .env dagi TELEGRAM_CHAT_ID ni ${movedTo} ga almashtiring.`);
    chatId = String(movedTo);
    data = await callTelegram('sendMessage', { chat_id: chatId, ...params });
  }

  if (!data || !data.ok) {
    throw new Error(`Telegram rad etdi: ${(data && data.description) || 'nomaʼlum xato'}`);
  }
}

/* ------------------------------------------------------------ POST /api/lead */

async function handleLead(req, res) {
  if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'origin' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return sendJson(res, 415, { ok: false, error: 'type' });
  }
  if (Number(req.headers['content-length'] || 0) > BODY_LIMIT) {
    return sendJson(res, 413, { ok: false, error: 'size' });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    return sendJson(res, err.status === 413 ? 413 : 400, { ok: false, error: 'body' });
  }
  if (!body || typeof body !== 'object') return sendJson(res, 400, { ok: false, error: 'body' });

  // honeypot: people never see this field, form-filling bots do — answer "ok", send nothing
  if (cleanText(body.website, 200)) return sendJson(res, 200, { ok: true });

  const phone = normalizePhone(body.phone);
  if (!phone) return sendJson(res, 400, { ok: false, error: 'phone' });

  const telegram = normalizeTelegram(body.telegram);
  if (telegram === null) return sendJson(res, 400, { ok: false, error: 'telegram' });

  if (!chatId) {
    console.error('✖ TELEGRAM_CHAT_ID yoʻq — lid yuborilmadi. `npm run guruh` bilan guruhni ulang.');
    return sendJson(res, 503, { ok: false, error: 'setup' });
  }

  if (rateLimited(clientIp(req))) return sendJson(res, 429, { ok: false, error: 'rate' });

  const lead = {
    phone,
    telegram,
    source: cleanText(body.source, 80),
    details: cleanText(body.details, 400),
  };

  try {
    const n = await serial(async () => {
      const next = Math.max(await readCounter(), lastInMemory) + 1;
      await sendToGroup(buildMessage(next, lead));
      lastInMemory = next;
      try {
        await writeCounter(next);
      } catch (err) {
        console.error(`✖ #N${next} yuborildi, lekin hisoblagich saqlanmadi:`, scrub(err.message));
      }
      return next;
    });
    await logLead({ n, at: new Date().toISOString(), ...lead, delivered: true });
    console.log(`✔ #N${n} guruhga yuborildi — ${lead.source || 'Sayt'}`);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    await logLead({ n: null, at: new Date().toISOString(), ...lead, delivered: false, error: scrub(err.message) });
    console.error('✖ Lid yuborilmadi:', scrub(err.message));
    return sendJson(res, 502, { ok: false, error: 'delivery' });
  }
}

/* ------------------------------------------------------------ static files */

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
    ...SECURITY_HEADERS,
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------------ server */

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/api/lead') {
      if (req.method !== 'POST') {
        res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'POST' });
        return res.end();
      }
      return await handleLead(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD' });
      return res.end();
    }
    return await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('✖ Server xatosi:', scrub((err && err.stack) || err));
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'server' });
    else res.destroy();
  }
});

server.listen(PORT, HOST, () => {
  const shown = HOST === '127.0.0.1' || HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`United Finance Team sayti: http://${shown}:${PORT}`);
  console.log(chatId
    ? `Lidlar Telegram guruhiga yuboriladi (chat ${chatId}).`
    : '⚠ TELEGRAM_CHAT_ID hali yoʻq — lidlar yuborilmaydi. `npm run guruh` bilan guruhni ulang.');
});
