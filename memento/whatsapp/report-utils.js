'use strict';

const crypto = require('crypto');

function stableMessageId(chat, message) {
  const chatId = chat?.id?._serialized || chat?.id?.user || chat?.name || 'chat';
  const messageId = message?.id?.id || message?.id?._serialized || message?.id || 'message';
  return `${chatId}:${messageId}`;
}

function privacyHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
}

function messageTimestamp(message) {
  const seconds = Number(message?.timestamp || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function formatStarredEntry(chat, message) {
  const id = stableMessageId(chat, message);
  const timestamp = messageTimestamp(message);
  const date = timestamp ? new Date(timestamp * 1000).toISOString() : 'unknown time';
  const sender = message?.fromMe ? 'Me' : String(message?._data?.notifyName || message?.author || 'Unknown');
  const body = String(message?.body || (message?.hasMedia ? `[${message.type || 'media'}]` : '[empty]'))
    .replace(/\r?\n/g, '\n  ');
  return [
    `<!-- wa-message-id: ${id} -->`,
    `### ${date} — ${chat?.name || 'Unknown chat'}`,
    `**${sender}**`,
    body,
    '',
  ].join('\n');
}

function mergeStarredEntries(existing, entries) {
  const byId = new Map();
  const marker = /<!-- wa-message-id: ([^>]+) -->/g;
  let match;
  while ((match = marker.exec(existing || ''))) {
    const start = match.index;
    const next = existing.indexOf('<!-- wa-message-id:', marker.lastIndex);
    const end = next === -1 ? existing.length : next;
    byId.set(match[1].trim(), existing.slice(start, end).trim());
  }
  for (const entry of entries) {
    const idMatch = entry.match(/<!-- wa-message-id: ([^>]+) -->/);
    if (idMatch) byId.set(idMatch[1].trim(), entry.trim());
  }
  const sorted = [...byId.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const heading = '# Starred WhatsApp messages\n\n';
  return heading + sorted.map(([, entry]) => `${entry}\n`).join('\n');
}

function summarizeMessages(records) {
  const summary = {
    chats: 0,
    groups: 0,
    messages: 0,
    media: 0,
    links: 0,
    byDay: {},
    bySender: {},
    byChat: {},
  };
  const chats = new Set();
  const groupChats = new Set();
  for (const record of records || []) {
    const chatKey = privacyHash(record.chatId || record.chatName || 'chat');
    chats.add(chatKey);
    if (record.isGroup) groupChats.add(chatKey);
    const message = record.message || record;
    summary.messages += 1;
    if (message.hasMedia) summary.media += 1;
    if (/https?:\/\/\S+/i.test(String(message.body || ''))) summary.links += 1;
    const senderKey = message.fromMe ? 'me' : privacyHash(message.from || message.author || 'unknown');
    summary.bySender[senderKey] = (summary.bySender[senderKey] || 0) + 1;
    summary.byChat[chatKey] = (summary.byChat[chatKey] || 0) + 1;
    const timestamp = Number(message.timestamp || 0);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      const day = new Date(timestamp * 1000).toISOString().slice(0, 10);
      summary.byDay[day] = (summary.byDay[day] || 0) + 1;
    }
  }
  summary.chats = chats.size;
  summary.groups = groupChats.size;
  return summary;
}

module.exports = { formatStarredEntry, mergeStarredEntries, messageTimestamp, privacyHash, stableMessageId, summarizeMessages };
