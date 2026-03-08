// delete-shorts.js — delete all YouTube Shorts messages (for me only)
// Usage:
//   node delete-shorts.js            (dry run)
//   DRY_RUN=false node delete-shorts.js
//   MSG_LIMIT=5000 DRY_RUN=false node delete-shorts.js

const { createClient } = require('./client');

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
    process.stdout.write(`  ${chat.name || chat.id.user} ... `);
    let messages;
    try {
      messages = await chat.fetchMessages({ limit: MSG_LIMIT });
    } catch (e) {
      console.log(`SKIP (${e.message})`);
      continue;
    }
    const matching = messages.filter(m => m.body && SHORTS_RE.test(m.body));
    console.log(`${matching.length} hit(s)`);
    hits.push(...matching.map(msg => ({ chatName: chat.name || chat.id.user, msg })));
  }

  console.log(`\nTotal: ${hits.length} YouTube Shorts messages\n`);

  for (const h of hits) {
    console.log(`  [${h.chatName}] ${h.msg.body.replace(/\n/g, ' ').substring(0, 90)}`);
  }

  if (DRY_RUN || hits.length === 0) {
    console.log(hits.length ? '\nDry run done. Set DRY_RUN=false to nuke.' : '\nNothing to delete.');
    process.exit(0);
  }

  console.log('\nDeleting...');
  let n = 0;
  for (const h of hits) {
    try {
      await h.msg.delete(false); // for me only
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
