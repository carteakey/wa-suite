// starred-sync.js — sync starred WhatsApp messages to a local Markdown file
//
// Defaults to dry-run. Set DRY_RUN=false to write OUTPUT_FILE. The output is
// intentionally local and may contain private message text; it is gitignored.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { formatStarredEntry, mergeStarredEntries, stableMessageId } = require('./report-utils');

const DRY_RUN = process.env.DRY_RUN !== 'false';
const MSG_LIMIT = Number.parseInt(process.env.MSG_LIMIT || '2000', 10);
const OUTPUT_FILE = (process.env.OUTPUT_FILE || '~/Documents/WhatsApp/starred.md').replace(/^~/, os.homedir());
const CHAT_FILTER = String(process.env.CHATS || '')
  .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);

function chatMatches(chat) {
  if (!CHAT_FILTER.length) return true;
  const name = String(chat?.name || '').toLowerCase();
  return CHAT_FILTER.some(filter => name.includes(filter));
}

async function collectStarred(chats, limit = MSG_LIMIT) {
  const entries = [];
  let scannedChats = 0;
  let failedChats = 0;
  for (const chat of chats.filter(chatMatches)) {
    scannedChats += 1;
    let messages;
    try {
      messages = await chat.fetchMessages({ limit });
    } catch (error) {
      failedChats += 1;
      continue;
    }
    for (const message of messages) {
      if (!message?.isStarred) continue;
      entries.push({
        id: stableMessageId(chat, message),
        markdown: formatStarredEntry(chat, message),
      });
    }
  }
  return { entries, scannedChats, failedChats };
}

async function main() {
  if (!Number.isInteger(MSG_LIMIT) || MSG_LIMIT <= 0) {
    throw new Error('MSG_LIMIT must be a positive integer');
  }
  const { createClient } = require('../../lib/client');
  const client = createClient();
  client.on('ready', async () => {
    try {
      const result = await collectStarred(await client.getChats());
      const unique = new Map(result.entries.map(entry => [entry.id, entry.markdown]));
      console.log(`Starred messages found: ${unique.size} (chats scanned: ${result.scannedChats}, failures: ${result.failedChats})`);
      if (DRY_RUN) {
        console.log('Dry run — no starred-message file was written. Set DRY_RUN=false to sync.');
      } else {
        const existing = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf8') : '';
        const merged = mergeStarredEntries(existing, [...unique.values()]);
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
        fs.writeFileSync(OUTPUT_FILE, merged, 'utf8');
        console.log(`Synced ${unique.size} starred message(s) to ${OUTPUT_FILE}.`);
      }
    } finally {
      await client.destroy().catch(() => {});
    }
  });
  client.initialize();
}

if (require.main === module) {
  main().catch(error => {
    console.error(`starred-sync failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { chatMatches, collectStarred };
