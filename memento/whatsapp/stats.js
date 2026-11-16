// stats.js — privacy-safe WhatsApp usage statistics
//
// Output contains aggregate counts and short hashes instead of contact names,
// phone numbers, or message bodies. It never writes unless OUTPUT_FILE is set.

'use strict';

const fs = require('fs');
const { summarizeMessages } = require('./report-utils');

const DRY_RUN = process.env.DRY_RUN !== 'false';
const MSG_LIMIT = Number.parseInt(process.env.MSG_LIMIT || '2000', 10);
const FORMAT = String(process.env.STATS_FORMAT || 'json').toLowerCase();
const OUTPUT_FILE = process.env.OUTPUT_FILE || '';

async function collectRecords(chats, limit = MSG_LIMIT) {
  const records = [];
  let failedChats = 0;
  for (const chat of chats) {
    let messages;
    try {
      messages = await chat.fetchMessages({ limit });
    } catch (error) {
      failedChats += 1;
      continue;
    }
    for (const message of messages) {
      records.push({
        chatId: chat?.id?._serialized || chat?.id?.user || chat?.name,
        isGroup: chat?.isGroup === true,
        message,
      });
    }
  }
  return { records, failedChats };
}

function renderStats(summary, failedChats) {
  const payload = { ...summary, failedChats };
  if (FORMAT === 'text') {
    return [
      `Chats: ${payload.chats}`,
      `Groups: ${payload.groups}`,
      `Messages: ${payload.messages}`,
      `Media: ${payload.media}`,
      `Links: ${payload.links}`,
      `Failed chats: ${payload.failedChats}`,
    ].join('\n');
  }
  return JSON.stringify(payload, null, 2);
}

async function main() {
  if (!Number.isInteger(MSG_LIMIT) || MSG_LIMIT <= 0) throw new Error('MSG_LIMIT must be a positive integer');
  const { createClient } = require('../../lib/client');
  const client = createClient();
  client.on('ready', async () => {
    try {
      const { records, failedChats } = await collectRecords(await client.getChats());
      const output = renderStats(summarizeMessages(records), failedChats);
      console.log(output);
      if (!DRY_RUN && OUTPUT_FILE) fs.writeFileSync(OUTPUT_FILE, `${output}\n`, 'utf8');
      if (!DRY_RUN && !OUTPUT_FILE) console.log('Live mode is read-only; set OUTPUT_FILE to persist aggregate statistics.');
    } finally {
      await client.destroy().catch(() => {});
    }
  });
  client.initialize();
}

if (require.main === module) {
  main().catch(error => {
    console.error(`stats failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { collectRecords, renderStats };
