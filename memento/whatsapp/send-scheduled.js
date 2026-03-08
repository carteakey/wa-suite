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

const DRY_RUN          = process.env.DRY_RUN !== 'false';
const OLLAMA_URL       = process.env.OLLAMA_SERVER_URL || 'http://localhost:11434';
const OLLAMA_MODEL     = process.env.OLLAMA_TEXT_MODEL || 'llama3.2';
const SCHEDULE_FILE    = path.join(__dirname, 'schedule.json');

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
async function generateMessage(theme) {
  const prompt = `Write a short, creative, warm birthday message. Theme or context: "${theme}".
Make it feel personal and genuine, not generic. Vary the style — sometimes funny, sometimes heartfelt, sometimes poetic.
Keep it under 3 sentences. Just the message text, nothing else.`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  });

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
    const chat = chats.find(c =>
      (c.name || '').toLowerCase().includes(entry.contact.toLowerCase()) ||
      (c.id?.user || '').includes(entry.contact.replace(/\D/g, ''))
    );

    if (!chat) {
      console.log(`  ✗ Chat not found for "${entry.contact}"\n`);
      continue;
    }

    // Generate or use message
    let message = entry.message;
    if (entry.use_ai) {
      try {
        process.stdout.write(`  Generating message via Ollama (${OLLAMA_MODEL})...`);
        message = await generateMessage(entry.message || 'birthday');
        console.log(' done.');
      } catch (e) {
        console.log(`\n  ✗ Ollama failed: ${e.message} — falling back to static message.`);
      }
    }

    console.log(`  Message: ${message}`);

    if (!DRY_RUN) {
      await chat.sendMessage(message);
      console.log(`  ✓ Sent to ${chat.name}`);
    } else {
      console.log(`  (dry run — not sent)`);
    }

    console.log();
  }

  process.exit(0);
});

client.initialize();
