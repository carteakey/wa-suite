// export-chat.js — export a WhatsApp chat to a markdown file
//
// Usage:
//   CHAT="Family" node export-chat.js              (dry run, preview)
//   CHAT="Family" DRY_RUN=false node export-chat.js
//   CHAT="Best Friends" OUTPUT_DIR=~/Documents/WhatsApp DRY_RUN=false node export-chat.js
//
// Output: OUTPUT_DIR/<chat-name>.md
// Each run overwrites the file — reruns produce a fresh full export.

const { createClient } = require('../../lib/client');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const DRY_RUN    = process.env.DRY_RUN !== 'false';
const MSG_LIMIT  = parseInt(process.env.MSG_LIMIT || '2000', 10);
const CHAT_NAME  = process.env.CHAT || '';
const OUTPUT_DIR = (process.env.OUTPUT_DIR || '~/Documents/WhatsApp').replace('~', os.homedir());

if (!CHAT_NAME) {
  console.error('Error: set CHAT="partial chat name" to specify which chat to export.');
  process.exit(1);
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const client = createClient();

client.on('ready', async () => {
  console.log('Client ready.\n');

  const chats = await client.getChats();
  const matches = chats.filter(c =>
    (c.name || '').toLowerCase().includes(CHAT_NAME.toLowerCase())
  );

  if (matches.length === 0) {
    console.error('No matching chat found.');
    process.exit(1);
  }

  if (matches.length > 1) {
    console.log(`Multiple matches (${matches.length}); using the first.`);
  }

  const chat = matches[0];
  console.log(`Exporting one chat (limit ${MSG_LIMIT} messages).\n`);

  const messages = await chat.fetchMessages({ limit: MSG_LIMIT });
  console.log(`Fetched ${messages.length} messages.`);

  // Group by day
  const days = new Map();
  for (const msg of messages) {
    const day = formatDate(msg.timestamp);
    if (!days.has(day)) days.set(day, []);

    const contact = msg.fromMe ? 'Me' : (msg._data?.notifyName || msg.author || msg.from);
    const time    = formatTime(msg.timestamp);
    const body    = msg.body
      ? msg.body.replace(/\n/g, '\n  ')
      : msg.hasMedia ? `[${msg.type}]` : '[empty]';

    days.get(day).push({ contact, time, body });
  }

  // Build markdown
  const lines = [`# ${chat.name}`, ``, `*Exported ${new Date().toLocaleDateString('en-GB')} — ${messages.length} messages*`, ``];

  for (const [day, msgs] of days) {
    lines.push(`## ${day}`, ``);
    for (const m of msgs) {
      lines.push(`**${m.contact}** ${m.time}`, `${m.body}`, ``);
    }
  }

  const markdown = lines.join('\n');

  if (DRY_RUN) {
    console.log(`\nDry run done: ${messages.length} messages across ${days.size} days. Set DRY_RUN=false to write the file.`);
    process.exit(0);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filename = path.join(OUTPUT_DIR, `${slugify(chat.name)}.md`);
  fs.writeFileSync(filename, markdown, 'utf8');

  console.log('\nExport complete.');
  console.log(`${messages.length} messages, ${days.size} days.`);
  process.exit(0);
});

client.initialize();
