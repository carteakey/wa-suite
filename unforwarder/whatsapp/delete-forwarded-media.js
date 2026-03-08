// delete-forwarded-media.js — delete forwarded media (images/videos) for me only
// WhatsApp shows "Forwarded many times" at forwardingScore >= 5
//
// Usage:
//   node delete-forwarded-media.js                      (dry run, score >= 5)
//   DRY_RUN=false node delete-forwarded-media.js        (nuke score >= 5)
//   FORWARD_SCORE=2 DRY_RUN=false node delete-forwarded-media.js
//   FORWARD_SCORE=1 DRY_RUN=false node delete-forwarded-media.js  (any forward)

const { createClient } = require('../../lib/client');

const DRY_RUN       = process.env.DRY_RUN !== 'false';
const MSG_LIMIT     = parseInt(process.env.MSG_LIMIT || '2000', 10);
const FORWARD_SCORE = parseInt(process.env.FORWARD_SCORE || '5', 10);

const client = createClient();

client.on('ready', async () => {
  console.log('Client ready.\n');

  if (DRY_RUN) {
    console.log('=== DRY RUN — nothing will be deleted ===');
    console.log('    Set DRY_RUN=false to actually delete.\n');
  }

  console.log(`Targeting: forwarded media with forwardingScore >= ${FORWARD_SCORE}`);
  console.log(`Scanning up to ${MSG_LIMIT} messages per chat...\n`);

  const chats = await client.getChats();
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

    const matching = messages.filter(m =>
      m.hasMedia &&
      m.isForwarded &&
      (m.forwardingScore ?? 1) >= FORWARD_SCORE
    );

    console.log(`${matching.length} hit(s)`);
    hits.push(...matching.map(msg => ({
      chatName: chat.name || chat.id.user,
      score: msg.forwardingScore ?? 1,
      type: msg.type,
      msg,
    })));
  }

  console.log(`\nTotal: ${hits.length} forwarded media messages (score >= ${FORWARD_SCORE})\n`);

  // Summary by type
  const byType = hits.reduce((acc, h) => {
    acc[h.type] = (acc[h.type] || 0) + 1;
    return acc;
  }, {});
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log();

  for (const h of hits) {
    console.log(`  [${h.chatName}] score=${h.score} type=${h.type}`);
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
