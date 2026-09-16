# United Finance Team — sayt va lid serveri

Saytdagi har bir aloqa tugmasi forma ochadi. Yuborilgan lid Telegram guruhiga
`#N1`, `#N2`, … raqami bilan tushadi.

## Ishga tushirish

```bash
npm start
```

Sayt: http://localhost:5180

Node.js 20.12 yoki undan yangisi kerak. Qoʻshimcha paket oʻrnatish shart emas.

> **Diqqat:** `python -m http.server` yoki boshqa oddiy statik serverni bu papkada
> ishga tushirmang — u `.env` faylini ham tarqatadi va bot tokeni ochilib qoladi.
> Faqat `npm start` dan foydalaning.

## Fayllar

| Fayl | Vazifasi |
| --- | --- |
| `public/index.html` | Saytning oʻzi. Brauzerga faqat shu papka beriladi. |
| `public/images/team/` | Xodimlar rasmlari (WebP, 800×1000 va 480×600). |
| `server.js` | Saytni tarqatadi va `/api/lead` orqali lidni guruhga yuboradi. |
| `.env` | Bot tokeni va guruh ID si. **Maxfiy** — hech kimga bermang, saytga yuklamang. |
| `data/lead-counter.json` | Oxirgi lid raqami. Oʻchirilsa, raqamlash #N1 dan qayta boshlanadi. |
| `data/leads.jsonl` | Barcha lidlar nusxasi — Telegram ishlamay qolsa ham lid yoʻqolmaydi. |
| `scripts/link-group.js` | Botni boshqa guruhga ulash yordamchisi. |

## Guruhni almashtirish

1. Botni yangi guruhga qoʻshing.
2. Guruhga istalgan xabar yozing.
3. `npm run guruh`, keyin serverni qayta ishga tushiring.

## Himoya

- Token faqat serverda turadi, sahifa kodida yoʻq.
- Lid faqat `.env` dagi guruhga yuboriladi — brauzer manzilni tanlay olmaydi.
- Bir manzildan 10 daqiqada 5 tadan ortiq lid qabul qilinmaydi.
- Spam-botlar uchun koʻrinmas tuzoq maydoni bor.
- Telefon va username serverda ham qayta tekshiriladi.

## Internetga joylash

Bu loyiha Node.js ishlata oladigan hosting talab qiladi (VPS, Render, Railway va h.k.).
Netlify kabi faqat statik hostingga yuklansa, forma ishlamaydi.

Hostingda `.env` faylini qoʻlda yarating (`.env.example` namuna) va `HOST=0.0.0.0` qiling.
Nginx yoki hosting proksisi ortida boʻlsa, `TRUST_PROXY=1`.
