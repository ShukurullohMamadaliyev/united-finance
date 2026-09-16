'use strict';
/*
 * POST /api/lead — saytdagi formadan kelgan lidni Telegram guruhiga yuboradi.
 *
 *   Vercel'da:   bu fayl avtomatik funksiyaga aylanadi. Bot tokeni loyihaning
 *                Environment Variables boʻlimida (TELEGRAM_BOT_TOKEN) turadi.
 *   Kompyuterda: dev-server.js shu faylni chaqiradi, token .env dan olinadi.
 *
 * Token kodda ham, GitHub'da ham yoʻq va brauzerga hech qachon yuborilmaydi.
 */

// Lidlar guruhi. Chat ID maxfiy emas: bot tokenisiz unga hech kim yoza olmaydi.
// Boshqa guruhga oʻtish kerak boʻlsa, TELEGRAM_CHAT_ID muhit oʻzgaruvchisi bilan almashtiriladi.
const DEFAULT_CHAT_ID = '-1004415578594';

const BODY_LIMIT = 8 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

const token = () => (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const chatId = () => (process.env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID).trim();

/** Anything that reaches a log goes through here, so the token never does. */
function scrub(value) {
  const t = token();
  return t ? String(value).split(t).join('<TOKEN>') : String(value);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(payload);
}

async function readJson(req) {
  // Vercel parses JSON bodies itself behind a lazy getter; the local dev server hands over the raw stream
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function clientIp(req) {
  // on Vercel these headers are written by the platform, so they can be trusted
  if (process.env.VERCEL) {
    const forwarded = req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0];
    if (forwarded) return String(forwarded).trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/** Browsers always send Origin on a cross-site POST; reject other sites posting here. */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const hosts = [req.headers.host, req.headers['x-forwarded-host']].filter(Boolean);
  try {
    return hosts.includes(new URL(origin).host);
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
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------ rate limiting */

// Per running instance. Vercel reuses warm instances, so this still stops a
// burst from one visitor; it is a brake, not a guarantee.
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
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

function buildMessage(lead) {
  const lines = [
    '🆕 <b>Yangi lid</b>',
    '',
    `📞 <b>Telefon:</b> ${formatPhone(lead.phone)}`,
    `✈️ <b>Telegram:</b> ${lead.telegram ? '@' + escapeHtml(lead.telegram) : 'koʻrsatilmagan'}`,
    `📍 <b>Manba:</b> ${escapeHtml(lead.source || 'Sayt')}`,
  ];
  if (lead.details) lines.push(`📝 <b>Tafsilot:</b> ${escapeHtml(lead.details)}`);
  lines.push(`🕐 <b>Vaqt:</b> ${tashkentTime()}`);
  return lines.join('\n');
}

async function sendToGroup(text) {
  const response = await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId(),
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram rad etdi: ${data.description || 'nomaʼlum xato'}`);
}

/* ------------------------------------------------------------------ handler */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method' });
  }
  if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'origin' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return sendJson(res, 415, { ok: false, error: 'type' });
  }
  if (Number(req.headers['content-length'] || 0) > BODY_LIMIT) {
    return sendJson(res, 413, { ok: false, error: 'size' });
  }

  let body;
  try {
    body = await readJson(req);
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

  if (!token()) {
    console.error('✖ TELEGRAM_BOT_TOKEN yoʻq — Vercel: Settings → Environment Variables ga qoʻshing.');
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
    await sendToGroup(buildMessage(lead));
    console.log(`✔ Lid guruhga yuborildi — ${lead.source || 'Sayt'}`);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    // the lead is written to the private Vercel log so it can still be called back
    console.error('✖ Lid yuborilmadi:', scrub(err.message), JSON.stringify(lead));
    return sendJson(res, 502, { ok: false, error: 'delivery' });
  }
};
