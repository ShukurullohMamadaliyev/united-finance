'use strict';
/*
 * Botni lidlar guruhiga ulash.
 *
 *   1. Botni guruhga qoʻshing.
 *   2. Guruhga istalgan xabar yozing (masalan: salom).
 *   3. npm run guruh
 *
 * Skript guruhni topadi, bot u yerga yoza olishini tekshiradi va TELEGRAM_CHAT_ID ni
 * .env ga yozadi. Guruhga hech narsa yubormaydi.
 *
 * Bir nechta guruh topilsa:  npm run guruh -- --id=-1001234567890
 */

const fs = require('node:fs');
const path = require('node:path');

const ENV_FILE = path.join(__dirname, '..', '.env');
const WAIT_MS = 2 * 60 * 1000;

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  console.error('✖ .env fayli topilmadi.');
  process.exit(1);
}

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const scrub = (v) => String(v).split(TOKEN).join('<TOKEN>');

async function api(method, params = {}) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(40_000),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

function setEnv(key, value) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  text = pattern.test(text) ? text.replace(pattern, line) : text.replace(/\s*$/, '\n') + line + '\n';
  fs.writeFileSync(ENV_FILE, text);
}

async function findGroups() {
  const groups = new Map();
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    // no offset: nothing is marked as read, the same updates stay available
    const updates = await api('getUpdates', { timeout: 25, allowed_updates: ['message', 'my_chat_member'] });
    for (const u of updates) {
      const chat = (u.message || u.my_chat_member || {}).chat;
      if (chat && (chat.type === 'group' || chat.type === 'supergroup')) groups.set(String(chat.id), chat.title);
    }
    if (groups.size) return groups;
  }
  return groups;
}

async function main() {
  const me = await api('getMe');
  console.log(`Bot: ${me.first_name} (@${me.username})`);

  const forced = (process.argv.find((a) => a.startsWith('--id=')) || '').slice(5);
  let chatId = forced;

  if (!chatId) {
    console.log('Guruhdan xabar kutilmoqda (2 daqiqagacha) — guruhga istalgan xabar yozing…');
    const groups = await findGroups();
    if (groups.size === 0) {
      console.error('✖ Guruh topilmadi. Bot guruhda ekanini tekshiring va guruhga yana xabar yozing.');
      process.exit(1);
    }
    if (groups.size > 1) {
      console.log('Bir nechta guruh topildi. Keraklisini tanlang:');
      for (const [id, title] of groups) console.log(`   npm run guruh -- --id=${id}    (${title})`);
      process.exit(1);
    }
    chatId = [...groups.keys()][0];
  }

  const chat = await api('getChat', { chat_id: chatId });
  const member = await api('getChatMember', { chat_id: chatId, user_id: me.id });

  if (member.status === 'left' || member.status === 'kicked') {
    console.error(`✖ Bot «${chat.title}» guruhida emas.`);
    process.exit(1);
  }
  if (member.status === 'restricted' && member.can_send_messages === false) {
    console.error(`✖ «${chat.title}» guruhida botga xabar yozish taqiqlangan. Guruh sozlamalarida ruxsat bering.`);
    process.exit(1);
  }

  setEnv('TELEGRAM_CHAT_ID', chatId);
  console.log(`✔ «${chat.title}» guruhi ulandi (bot holati: ${member.status}).`);
  console.log('  Serverni qayta ishga tushiring: npm start');
}

main().catch((err) => {
  console.error('✖', scrub(err.message));
  process.exit(1);
});
