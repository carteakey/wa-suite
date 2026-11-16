// delete-shorts.js — delete all YouTube Shorts messages (for me only)
// Usage:
//   node delete-shorts.js            (dry run)
//   DRY_RUN=false node delete-shorts.js
//   MSG_LIMIT=5000 DRY_RUN=false node delete-shorts.js

const { createClient } = require('../../lib/client');
const { dedupeCandidates, isOwnMessage, messageId } = require('./cleanup-utils');

const DRY_RUN   = process.env.DRY_RUN !== 'false';
const MSG_LIMIT = parseInt(process.env.MSG_LIMIT || '2000', 10);
const SHORTS_RE = /youtube\.com\/shorts\//i;

const client = createClient();

client.on('ready', async () => {
  console.log('Client ready.\n');

  if (DRY_RUN) {
    console.log('=== DRY RUN — nothing will be deleted ===');
    console.log('    Set DRY_RUN=false to actually delete.\n');
  }

  const chats = await client.getChats();
  console.log(`Scanning ${chats.length} chats (limit ${MSG_LIMIT} msgs each)...\n`);

  const hits = [];

  for (const chat of chats) {
    process.stdout.write('  scanning chat ... ');
    let messages;
    try {
      messages = await chat.fetchMessages({ limit: MSG_LIMIT });
    } catch (e) {
      console.log(`SKIP (${e.message})`);
      continue;
    }
    const matching = messages.filter(m => isOwnMessage(m) && m.body && SHORTS_RE.test(m.body));
    console.log(`${matching.length} hit(s)`);
    hits.push(...matching.map(msg => ({ key: messageId(msg, chat), message: msg })));
  }

  const uniqueHits = dedupeCandidates(hits);

  console.log(`\nTotal: ${uniqueHits.length} own YouTube Shorts messages\n`);

  if (DRY_RUN || uniqueHits.length === 0) {
    console.log(uniqueHits.length ? '\nDry run done. Set DRY_RUN=false to nuke.' : '\nNothing to delete.');
    process.exit(0);
  }

  console.log('\nDeleting...');
  let n = 0;
  for (const h of uniqueHits) {
    try {
      await h.message.delete(false); // for me only
      process.stdout.write(`\r  ${++n}/${uniqueHits.length}`);
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
