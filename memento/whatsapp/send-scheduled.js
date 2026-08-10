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
const {
  entryKey,
  isActiveOnDate,
  loadCheckpoint,
  saveCheckpoint,
} = require('./schedule-utils');

const DRY_RUN       = process.env.DRY_RUN !== 'false';
const OLLAMA_URL    = process.env.OLLAMA_SERVER_URL || 'http://localhost:11434';
const OLLAMA_MODEL  = process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';
const SCHEDULE_FILE = path.join(__dirname, 'schedule.json');
const SEND_ONCE_PER_DAY = process.env.SEND_ONCE_PER_DAY !== 'false';
const CHECKPOINT_FILE = process.env.SCHEDULE_CHECKPOINT || path.join(__dirname, 'schedule-progress.json');

// ─── Load schedule ────────────────────────────────────────────────────────────
if (!fs.existsSync(SCHEDULE_FILE)) {
  console.error(`schedule.json not found. Copy schedule.example.json to schedule.json and fill it in.`);
  process.exit(1);
}
const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));

// ─── Check if an entry is active today ────────────────────────────────────────
function isActiveToday(entry) {
  return isActiveOnDate(entry, new Date());
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

  const checkpoint = loadCheckpoint(CHECKPOINT_FILE);
  const active = schedule
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isActiveToday(entry))
    .filter(({ entry, index }) => !SEND_ONCE_PER_DAY || !checkpoint.has(entryKey(entry, index, today)));

  if (active.length === 0) {
    console.log('No scheduled messages active today.');
    process.exit(0);
  }

  console.log(`${active.length} scheduled message(s) active today.\n`);

  const chats = await client.getChats();

  for (const { entry, index } of active) {
    console.log(`Schedule entry ${index + 1}`);

    // Find the chat
    const digits = entry.contact.replace(/\D/g, '');
    const chat = chats.find(c =>
      (c.name || '').toLowerCase().includes(entry.contact.toLowerCase()) ||
      (digits.length > 5 && (c.id?.user || '').includes(digits))
    );

    if (!chat) {
      console.log('  ✗ Chat not found; skipping.\n');
      continue;
    }

    console.log(`  Chat matched (group: ${Boolean(chat.isGroup)})`);

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
          console.log('  Using configured fallback message.');
        } else {
          console.log(`  No fallback_message set — skipping send to avoid sending garbage.`);
          console.log(`  Tip: set OLLAMA_SERVER_URL or add "fallback_message" to schedule.json\n`);
          continue;
        }
      }
    } else {
      message = entry.message;
    }

    console.log('  Message prepared.');

    if (!DRY_RUN) {
      try {
        await sleep(2000); // give client a moment after ready
        const result = await client.sendMessage(chat.id._serialized, message);
        // Wait for server ack (ack: 0 = pending, 1 = sent to server, 2 = delivered)
        await new Promise((resolve, reject) => {
          let onAck;
          const timeout = setTimeout(() => {
            if (onAck) client.off('message_ack', onAck);
            reject(new Error('ack timeout'));
          }, 15000);
          onAck = (msg, ack) => {
            if (msg.id.id === result.id.id && ack >= 1) {
              clearTimeout(timeout);
              client.off('message_ack', onAck);
              resolve(ack);
            }
          };
          client.on('message_ack', onAck);
          timeout.unref?.();
        });
        if (SEND_ONCE_PER_DAY) {
          checkpoint.add(entryKey(entry, index, today));
          saveCheckpoint(CHECKPOINT_FILE, checkpoint);
        }
        console.log('  ✓ Delivered.');
      } catch (e) {
        console.log(`  ✗ Send failed: ${e.message}`);
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
