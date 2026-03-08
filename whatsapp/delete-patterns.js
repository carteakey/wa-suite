// delete-patterns.js — delete messages matching custom regex patterns
//
// Patterns are loaded from patterns.txt (one regex per line, # = comment).
// Default targets: good morning/night spam, news forwards, motivational filler.
//
// Usage:
//   node delete-patterns.js                        (dry run)
//   DRY_RUN=false node delete-patterns.js          (nuke)
//   PATTERNS_FILE=./my-patterns.txt DRY_RUN=false node delete-patterns.js

const { createClient } = require('./client');
const fs = require('fs');
const path = require('path');

const DRY_RUN      = process.env.DRY_RUN !== 'false';
const MSG_LIMIT    = parseInt(process.env.MSG_LIMIT || '2000', 10);
const PATTERNS_FILE = process.env.PATTERNS_FILE || path.join(__dirname, 'patterns.txt');

function loadPatterns(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  return lines
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const match = l.match(/^\/(.+)\/([gimsuy]*)$/);
      return match ? new RegExp(match[1], match[2] || 'i') : new RegExp(l, 'i');
    });
}

let patterns;
try {
  patterns = loadPatterns(PATTERNS_FILE);
} catch (e) {
  console.error(`Could not load patterns file: ${PATTERNS_FILE}`);
  console.error(e.message);
  process.exit(1);
}

const client = createClient();

client.on('ready', async () => {
  console.log('Client ready.\n');

  if (DRY_RUN) {
    console.log('=== DRY RUN — nothing will be deleted ===');
    console.log('    Set DRY_RUN=false to actually delete.\n');
  }

  console.log(`Loaded ${patterns.length} pattern(s) from ${PATTERNS_FILE}`);
  patterns.forEach(p => console.log(`  ${p}`));
  console.log();

  const chats = await client.getChats();
  console.log(`Scanning ${chats.length} chats...\n`);

  const hits = [];

  for (const chat of chats) {
    process.stdout.write(`  ${chat.name || chat.id.user} ... `);

    let messages;
    try {
      messages = await chat.fetchMessages({ limit: MSG_LIMIT });
    } catch (e) {
      console.log(`SKIP (${e.message})`);
      continue;
    }

    const matching = messages.filter(m => {
      if (!m.body) return false;
      return patterns.some(p => p.test(m.body));
    });

    console.log(`${matching.length} hit(s)`);
    hits.push(...matching.map(msg => ({
      chatName: chat.name || chat.id.user,
      matched: patterns.find(p => p.test(msg.body)),
      msg,
    })));
  }

  console.log(`\nTotal: ${hits.length} messages matching patterns\n`);

  for (const h of hits) {
    console.log(`  [${h.chatName}] [${h.matched}] ${h.msg.body.replace(/\n/g, ' ').substring(0, 80)}`);
  }

  if (DRY_RUN || hits.length === 0) {
    console.log(hits.length ? '\nDry run done. Set DRY_RUN=false to nuke.' : '\nNothing to delete.');
    process.exit(0);
  }

  console.log('\nDeleting...');
  let n = 0;
  for (const h of hits) {
    try {
      await h.msg.delete(false);
      process.stdout.write(`\r  ${++n}/${hits.length}`);
      await sleep(600);
    } catch (e) {
      console.log(`\n  Failed: ${e.message}`);
    }
  }

  console.log(`\n\nDone. ${n}/${hits.length} deleted.`);
  process.exit(0);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

client.initialize();
