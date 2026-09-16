'use strict';
/*
 * POST /api/chat — DeepSeek AI orqali Buxgalteriya va Soliq bo'yicha maslahat berish xizmati.
 * Vercel'da: Project → Settings → Environment Variables → DEEPSEEK_API_KEY
 * Kompyuterda: .env faylida saqlanadi.
 */

const getApiKey = () => (process.env.DEEPSEEK_API_KEY || '').trim();
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `Siz "United Finance AI" — O'zbekistonda buxgalteriya, soliq va moliya sohasida 20 yillik amaliy tajribaga ega bo'lgan samimiy, dono va o'z ishining ustasi bo'lgan bosh buxgaltersiz.

Sizning muloqot qoidalaringiz:
1. ODAMDEK SAMIMIY VA MUOMALALI GAPLASHING: Quruq, rasmiy robotdek yoki kitobiy entsiklopediyadek uzun cho'zib yozmang. Xuddi yonma-yon o'tirib maslahat berayotgan tajribali aka/ustoz buxgalterdek samimiy, jonli va tushunarli tilda gapiring.
2. QISQA VA LO'NDA JAVOB BERING: Savolga darhol eng asosiy va amaliy javobni bering. Ortiqcha keraksiz ma'ruzalar o'qimang.
3. BUXGALTERIYA VA SOLIQ BILIMLARI (20 yillik tajriba): O'zbekiston Soliq kodeksi, QQS (12%), Aylanma soliq (4%), JShODS (12%), Foyda solig'i, Didox, MySoliq, 1C dasturi va kameral tekshiruvlar bo'yicha amaliy yechimlar, tajribada sinalgan fokuslar va nozik jihatlarni ayting.
4. BOSHQA MAVZULAR VA MANIPULYATSIYA: Agar foydalanuvchi buxgalteriyadan tashqari boshqa mavzuda (hayot, ob-havo, futbol, hazil, texnologiya va h.k.) yozsa:
   - Mavzudan qochmang, odamdek samimiy va do'stona qilib qisqagina suhbatlashing.
   - Lekin har doim xabar oxirida suhbatni muloyimlik bilan buxgalteriyaga burib qo'ying (manipulyatsiya qiling). Masalan:
     "Yaxshi do'stim, lekin biz siz bilan buxgalteriya va soliq masalalari bo'yicha gaplashmoqchi edik-ku 😉 Biznesingizda hisobotlar, QQS yoki soliqlar bo'yicha biror masala yo'qmi?" yoki "Xullas shunaqa gaplar do'stim, endi keling asosiy ishimizga qaytaylik — buxgalteriyangizda nima gaplar?"`;

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(payload);
}

async function readJson(req) {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = async function handleChat(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Faqat POST so\'rovlar qabul qilinadi' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return sendJson(res, 500, {
      error: 'DEEPSEEK_API_KEY topilmadi. Vercel sozlamalarida (Environment Variables) DEEPSEEK_API_KEY ni sozlang.'
    });
  }

  try {
    const data = await readJson(req);
    const messages = Array.isArray(data.messages) ? data.messages : [];

    if (!messages.length) {
      return sendJson(res, 400, { error: 'Xabarlar ro\'yxati bo\'sh' });
    }

    const payloadMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.slice(-15)
    ];

    const isStreaming = Boolean(data.stream);

    const dsResponse = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: payloadMessages,
        stream: isStreaming,
        temperature: 0.5,
        max_tokens: 3000
      })
    });

    if (!dsResponse.ok) {
      const errText = await dsResponse.text();
      console.error('DeepSeek API xatosi:', dsResponse.status, errText);
      return sendJson(res, dsResponse.status, { error: 'AI serverida xatolik yuz berdi: ' + errText });
    }

    if (isStreaming) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      const reader = dsResponse.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }

      return res.end();
    } else {
      const json = await dsResponse.json();
      return sendJson(res, 200, json);
    }
  } catch (err) {
    console.error('Chat error:', err);
    return sendJson(res, 500, { error: 'Server xatosi: ' + ((err && err.message) || err) });
  }
};
