// send-scheduled.js — send scheduled messages, with optional AI-generated creative text
//
// Reads schedule.json (gitignored — copy from schedule.example.json).
// For each entry active today, sends the message to the contact.
// With use_ai: true, generates a fresh creative message via Ollama every run.
//
// Usage:
//   node send-scheduled.js              (dry run)
//   DRY_RUN=false node send-scheduled.js
//
// Schedule config: memento/whatsapp/schedule.json (see schedule.example.json)

const { createClient } = require('../../lib/client');
const fs   = require('fs');
const path = require('path');

const DRY_RUN       = process.env.DRY_RUN !== 'false';
const OLLAMA_URL    = process.env.OLLAMA_SERVER_URL || 'http://localhost:11434';
const OLLAMA_MODEL  = process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';
const SCHEDULE_FILE = path.join(__dirname, 'schedule.json');

// ─── Load schedule ────────────────────────────────────────────────────────────
if (!fs.existsSync(SCHEDULE_FILE)) {
  console.error(`schedule.json not found. Copy schedule.example.json to schedule.json and fill it in.`);
  process.exit(1);
}
const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));

// ─── Check if an entry is active today ────────────────────────────────────────
function isActiveToday(entry) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day   = now.getDate();

  const afterStart = month > entry.start_month || (month === entry.start_month && day >= entry.start_day);
  const beforeEnd  = month < entry.end_month   || (month === entry.end_month   && day <= entry.end_day);
  return afterStart && beforeEnd;
}

// ─── Generate message via Ollama ──────────────────────────────────────────────
async function generateMessage(theme, contact) {
  const prompt = `Write a short, creative, warm birthday message for ${contact}. Theme or context: "${theme}".
Address them by name. Make it feel personal and genuine, not generic. Vary the style — sometimes funny, sometimes heartfelt, sometimes poetic.
Keep it under 3 sentences. Just the message text, nothing else.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, think: false }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response.trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const client = createClient();

client.on('ready', async () => {
  console.log('Client ready.\n');

  if (DRY_RUN) {
    console.log('=== DRY RUN — no messages will be sent ===\n');
  }

  const today = new Date();
  console.log(`Date: ${today.toDateString()}\n`);

  const active = schedule.filter(isActiveToday);

  if (active.length === 0) {
    console.log('No scheduled messages active today.');
    process.exit(0);
  }

  console.log(`${active.length} scheduled message(s) active today.\n`);

  const chats = await client.getChats();

  for (const entry of active) {
    console.log(`Contact: ${entry.contact}`);

    // Find the chat
    const digits = entry.contact.replace(/\D/g, '');
    const chat = chats.find(c =>
      (c.name || '').toLowerCase().includes(entry.contact.toLowerCase()) ||
      (digits.length > 5 && (c.id?.user || '').includes(digits))
    );

    if (!chat) {
      console.log(`  ✗ Chat not found for "${entry.contact}"\n`);
      continue;
    }

    console.log(`  Chat: ${chat.name} | group: ${chat.isGroup} | id: ${chat.id._serialized}`);

    // Generate or use message
    let message = null;
    if (entry.use_ai) {
      try {
        process.stdout.write(`  Generating message via Ollama (${OLLAMA_MODEL} @ ${OLLAMA_URL})...`);
        message = await generateMessage(entry.message || 'birthday', entry.contact);
        console.log(' done.');
      } catch (e) {
        console.log(`\n  ✗ Ollama failed: ${e.message}`);
        if (entry.fallback_message) {
          message = entry.fallback_message;
          console.log(`  Using fallback: ${message}`);
        } else {
          console.log(`  No fallback_message set — skipping send to avoid sending garbage.`);
          console.log(`  Tip: set OLLAMA_SERVER_URL or add "fallback_message" to schedule.json\n`);
          continue;
        }
      }
    } else {
      message = entry.message;
    }

    console.log(`  Message: ${message}`);

    if (!DRY_RUN) {
      try {
        await sleep(2000); // give client a moment after ready
        const result = await client.sendMessage(chat.id._serialized, message);
        // Wait for server ack (ack: 0 = pending, 1 = sent to server, 2 = delivered)
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('ack timeout')), 15000);
          client.on('message_ack', (msg, ack) => {
            if (msg.id.id === result.id.id && ack >= 1) {
              clearTimeout(timeout);
              resolve(ack);
            }
          });
        });
        console.log(`  ✓ Delivered to ${chat.name}`);
      } catch (e) {
        console.log(`  ✗ Send failed: ${e.message}`);
        console.log(e);
      }
    } else {
      console.log(`  (dry run — not sent)`);
    }

    console.log();
  }

  process.exit(0);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

client.initialize();
