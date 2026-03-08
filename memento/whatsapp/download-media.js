// download-media.js — save personal photos & videos from WhatsApp to disk
//
// Usage:
//   node download-media.js                          (dry run, all chats)
//   DRY_RUN=false node download-media.js            (download everything)
//   DRY_RUN=false CHATS="Family,Best Friends" node download-media.js
//   DRY_RUN=false SKIP_FORWARDED=false node download-media.js  (include forwarded)
//
// Output: ~/Pictures/WhatsApp/YYYY-MM/<timestamp>_<id>.<ext>
// Checkpoint: OUTPUT_DIR/.checkpoint.json — reruns skip already-downloaded files

const { createClient } = require('../../lib/client');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Config ───────────────────────────────────────────────────────────────────
const DRY_RUN        = process.env.DRY_RUN !== 'false';
const MSG_LIMIT      = parseInt(process.env.MSG_LIMIT || '2000', 10);
const SKIP_FORWARDED = process.env.SKIP_FORWARDED !== 'false'; // default: personal only
const OUTPUT_DIR     = (process.env.OUTPUT_DIR || '~/Pictures/WhatsApp').replace('~', os.homedir());
const CHAT_FILTER    = process.env.CHATS ? process.env.CHATS.split(',').map(s => s.trim().toLowerCase()) : null;

const MEDIA_TYPES = new Set(['image', 'video', 'document']);

const MIME_TO_EXT = {
  'image/jpeg':    '.jpg',
  'image/jpg':     '.jpg',
  'image/png':     '.png',
  'image/webp':    '.webp',
  'image/gif':     '.gif',
  'video/mp4':     '.mp4',
  'video/3gpp':    '.3gp',
  'video/quicktime': '.mov',
  'video/webm':    '.webm',
};

// ─── Checkpoint ───────────────────────────────────────────────────────────────
const CHECKPOINT_PATH = path.join(OUTPUT_DIR, '.checkpoint.json');

function loadCheckpoint() {
  if (DRY_RUN) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
    return new Set(data);
  } catch {
    return new Set();
  }
}

function saveCheckpoint(done) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify([...done], null, 2));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function monthDir(ts) {
  const d = new Date(ts * 1000);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  return path.join(OUTPUT_DIR, `${yyyy}-${mm}`);
}

function makeFilename(msg, media) {
  const ext = MIME_TO_EXT[media.mimetype] || path.extname(media.filename || '') || '.bin';
  if (media.filename && media.filename.includes('.')) return media.filename;
  return `${msg.timestamp}_${msg.id.id.slice(-8)}${ext}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const client = createClient();

client.on('ready', async () => {
  console.log('Client ready.\n');

  if (DRY_RUN) {
    console.log('=== DRY RUN — nothing will be saved ===');
    console.log('    Set DRY_RUN=false to actually download.\n');
  }

  console.log(`Skip forwarded: ${SKIP_FORWARDED}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  if (CHAT_FILTER) console.log(`Chat filter: ${CHAT_FILTER.join(', ')}`);
  console.log();

  if (!DRY_RUN) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const done     = loadCheckpoint();
  const chats    = await client.getChats();
  const filtered = CHAT_FILTER
    ? chats.filter(c => CHAT_FILTER.some(f => (c.name || '').toLowerCase().includes(f)))
    : chats;

  console.log(`Scanning ${filtered.length} chat(s)...\n`);

  let total = 0, skipped = 0, saved = 0;

  for (const chat of filtered) {
    process.stdout.write(`  ${chat.name || chat.id.user} ... `);

    let messages;
    try {
      messages = await chat.fetchMessages({ limit: MSG_LIMIT });
    } catch (e) {
      console.log(`SKIP (${e.message})`);
      continue;
    }

    const media = messages.filter(m =>
      m.hasMedia &&
      MEDIA_TYPES.has(m.type) &&
      (!SKIP_FORWARDED || !m.isForwarded) &&
      !done.has(m.id.id)
    );

    console.log(`${media.length} new media item(s)`);
    total += media.length;

    for (const msg of media) {
      if (DRY_RUN) {
        const dir = monthDir(msg.timestamp);
        console.log(`    [${msg.type}] → ${path.relative(os.homedir(), dir)}/...`);
        continue;
      }

      let mediaData;
      try {
        mediaData = await msg.downloadMedia();
      } catch (e) {
        console.log(`    Failed to download ${msg.id.id}: ${e.message}`);
        skipped++;
        continue;
      }

      if (!mediaData) { skipped++; continue; }

      const dir      = monthDir(msg.timestamp);
      const filename = makeFilename(msg, mediaData);
      const filepath = path.join(dir, filename);

      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filepath, Buffer.from(mediaData.data, 'base64'));

        // Restore original timestamp
        const ts = msg.timestamp * 1000;
        fs.utimesSync(filepath, new Date(ts), new Date(ts));

        done.add(msg.id.id);
        saveCheckpoint(done);
        saved++;
        process.stdout.write(`\r  Saved ${saved}/${total} ...`);
      } catch (e) {
        console.log(`    Failed to write ${filename}: ${e.message}`);
        skipped++;
      }

      await sleep(200);
    }
  }

  console.log(`\n\n──────────────────────────────────────────`);
  if (DRY_RUN) {
    console.log(`Would download: ${total} media files`);
    console.log(`Run with DRY_RUN=false to save them.`);
  } else {
    console.log(`Saved:   ${saved}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Output:  ${OUTPUT_DIR}`);
  }
  console.log(`──────────────────────────────────────────\n`);
  process.exit(0);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

client.initialize();
