// delete-junk-links.js — delete spam/junk link messages across all chats
//
// Patterns nuked by default:
//   - YouTube Shorts  (youtube.com/shorts/)
//   - Facebook links  (facebook.com, fb.com, fb.watch)
//
// Usage:
//   node delete-junk-links.js                      (dry run)
//   DRY_RUN=false node delete-junk-links.js        (nuke all patterns)
//   MSG_LIMIT=5000 DRY_RUN=false node delete-junk-links.js

const { createClient } = require('./client');

const DRY_RUN   = process.env.DRY_RUN !== 'false';
const MSG_LIMIT = parseInt(process.env.MSG_LIMIT || '2000', 10);

const PATTERNS = [
  { name: 'YouTube Shorts', re: /youtube\.com\/shorts\//i },
  { name: 'Facebook',       re: /\b(facebook\.com|fb\.com|fb\.watch|m\.facebook\.com)\b/i },
];

const client = createClient();

client.on('ready', async () => {
  console.log('Client ready.\n');

  if (DRY_RUN) {
    console.log('=== DRY RUN — nothing will be deleted ===');
    console.log('    Set DRY_RUN=false to actually delete.\n');
  }

  console.log('Patterns:');
  PATTERNS.forEach(p => console.log(`  - ${p.name}`));
  console.log();

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

    const matching = messages.filter(m => {
      if (!m.body) return false;
      return PATTERNS.some(p => p.re.test(m.body));
    });

    console.log(`${matching.length} hit(s)`);
    hits.push(...matching.map(msg => ({
      chatName: chat.name || chat.id.user,
      pattern:  PATTERNS.find(p => p.re.test(msg.body))?.name,
      msg,
    })));
  }

  // Summary by pattern
  console.log(`\nTotal: ${hits.length} junk link messages\n`);
  for (const p of PATTERNS) {
    const count = hits.filter(h => h.pattern === p.name).length;
    console.log(`  ${p.name}: ${count}`);
  }
  console.log();

  for (const h of hits) {
    console.log(`  [${h.chatName}] [${h.pattern}] ${h.msg.body.replace(/\n/g, ' ').substring(0, 80)}`);
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
