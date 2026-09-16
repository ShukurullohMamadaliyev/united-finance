'use strict';
/*
 * POST /api/chat — DeepSeek AI orqali Buxgalteriya va Soliq bo'yicha maslahat berish xizmati.
 * Vercel'da: Project → Settings → Environment Variables → DEEPSEEK_API_KEY
 * Kompyuterda: .env faylida saqlanadi.
 */

const getApiKey = () => (process.env.DEEPSEEK_API_KEY || '').trim();
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `Siz "United Finance AI" — O'zbekiston Respublikasi qonunchiligi, soliq kodeksi, buxgalteriya hisobi (BHMS, MHXS/IFRS), moliya va audit bo'yicha oliy toifali professional buxgalter-maslahatchisiz.

Asosiy vazifangiz va qoidalaringiz:
1. O'zbekiston Respublikasi amaldagi Soliq kodeksi (yangi tahrir), Mehnat kodeksi, Fuqarolik kodeksi hamda buxgalteriya hisobi milliy standartlari (BHMS) asosida aniq va qonuniy asoslangan javoblar bering.
2. Barcha asosiy soliq turlari bo'yicha mukammal bilimga egasiz:
   - QQS (Qo'shilgan qiymat solig'i - 12%)
   - Aylanmadan olinadigan soliq (4%, xizmat va savdo turlari bo'yicha)
   - JShODS (Jismoniy shaxslardan olinadigan daromad solig'i - 12%)
   - Foyda solig'i (15%, banklar va boshqalar 20%)
   - Ijtimoiy soliq (12%, byudjet tashkilotlari 25%)
   - Mol-mulk, Yer, Suv soliqlari va aksizlar
3. Elektron hisobvaraq-fakturalar (Didox.uz, Faktura.uz, E-Faktura), MySoliq portali, 1C: Buxgalteriya 8.3 dasturi, E-Imzo, YMMT (Yagona milliy mehnat tizimi) va bank-mijoz tizimlari bilan ishlash bo'yicha amaliy ko'rsatmalar bera olasiz.
4. Javoblaringiz doimo aniq, muloyim, chiroyli tuzilmalangan (ro'yxatlar, jadvallar, formulalar bilan) va o'zbek tilida (agar foydalanuvchi ruscha yozsa rus tilida) bo'lsin.
5. Har bir hisob-kitobni bosqichma-bosqich tushuntirib bering. Agar savol murakkab audit yoki individual hujjat tahlilini talab qilsa, amaliy maslahat bering va United Finance professional buxgalterlar jamoasiga murojaat qilish mumkinligini eslatib o'ting.`;

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
