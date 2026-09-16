# United Finance Team — sayt va Telegram lidlari

Saytdagi har bir aloqa tugmasi forma ochadi. Yuborilgan lid Telegram guruhiga tushadi.

## Vercel'ga joylash

1. [vercel.com/new](https://vercel.com/new) → shu GitHub repozitoriyni **Import** qiling.
2. Framework Preset: **Other**. Qolgan sozlamalarga tegmang (`vercel.json` hammasini belgilaydi).
3. **Environment Variables** ga qoʻshing:
   - `TELEGRAM_BOT_TOKEN` = bot tokeni
4. **Deploy**.

Token qoʻshilgandan keyin qayta deploy qilish kerak boʻlsa: Deployments → oxirgisi → **Redeploy**.

Shundan keyin GitHub'ga har bir `git push` saytni avtomatik yangilaydi.

## Kompyuterda ishga tushirish

```bash
npm start
```

Sayt: http://localhost:5180. Node.js 20.12 yoki yangisi kerak, qoʻshimcha paket oʻrnatish shart emas.
Token `.env` faylida boʻladi (`.env.example` namuna).

> **Diqqat:** bu papkada `python -m http.server` kabi oddiy statik serverni ishga tushirmang —
> u `.env` faylini ham tarqatadi. Faqat `npm start` dan foydalaning.

## Fayllar

| Fayl | Vazifasi |
| --- | --- |
| `public/index.html` | Saytning oʻzi. |
| `public/images/team/` | Xodimlar rasmlari (WebP, 800×1000 va 480×600). |
| `api/lead.js` | Lidni tekshiradi va Telegram guruhiga yuboradi. Vercel'da funksiya boʻlib ishlaydi. |
| `dev-server.js` | Faqat kompyuterda sinash uchun. Vercel'da ishlatilmaydi. |
| `vercel.json` | Vercel sozlamalari: sayt papkasi va xavfsizlik sarlavhalari. |
| `.env` | Bot tokeni. **Maxfiy** — GitHub'ga yuklanmaydi. |

## Himoya

- Token faqat serverda (Vercel sozlamalari yoki `.env`) turadi, sahifa kodida yoʻq.
- Lid faqat belgilangan guruhga yuboriladi — brauzer manzilni tanlay olmaydi.
- Telefon va username serverda ham qayta tekshiriladi.
- Spam-botlar uchun koʻrinmas tuzoq maydoni va tezlik cheklovi bor.
- Telegram vaqtincha ishlamasa, lid Vercel jurnaliga (Logs) yoziladi — yoʻqolmaydi.

## Guruhni almashtirish

Standart guruh `api/lead.js` da (`DEFAULT_CHAT_ID`). Boshqa guruhga yuborish uchun
Vercel'ga `TELEGRAM_CHAT_ID` oʻzgaruvchisini qoʻshing. Guruh ID sini topish:
botni guruhga qoʻshing, guruhga xabar yozing va `npm run guruh` ni ishga tushiring.
