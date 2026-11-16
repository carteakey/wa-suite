'use strict';

const LINK_RE = /https?:\/\/\S+/i;

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parsePositiveInt(value, name) {
  if (!/^\d+$/.test(String(value).trim())) throw new Error(`${name} must be a positive integer`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInt(value, name) {
  if (!/^\d+$/.test(String(value).trim())) throw new Error(`${name} must be a non-negative integer`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function isOwnMessage(message) {
  return Boolean(message && message.fromMe === true);
}

function isGroup(chat) {
  return Boolean(chat && chat.isGroup === true);
}

function chatMatches(chat, filters = []) {
  if (!filters.length) return true;
  const name = String(chat?.name || '').toLowerCase();
  const id = String(chat?.id?.user || chat?.id?._serialized || '').toLowerCase();
  return filters.some(filter => name.includes(filter) || id.includes(filter));
}

function messageId(message, chat) {
  const id = message?.id?.id || message?.id?._serialized || message?.id;
  const chatId = chat?.id?._serialized || chat?.id?.user || chat?.name || 'chat';
  return `${chatId}:${id || 'unknown'}`;
}

function messageKind(message) {
  if (message?.hasMedia) return 'media';
  if (LINK_RE.test(String(message?.body || ''))) return 'link';
  return 'text';
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(candidate => {
    const key = candidate.key || messageId(candidate.message, candidate.chat);
    if (seen.has(key)) return false;
    seen.add(key);
    candidate.key = key;
    return true;
  });
}

function aggregateKinds(candidates) {
  return candidates.reduce((counts, candidate) => {
    const kind = candidate.kind || messageKind(candidate.message);
    counts[kind] = (counts[kind] || 0) + 1;
    return counts;
  }, {});
}

module.exports = {
  aggregateKinds,
  chatMatches,
  dedupeCandidates,
  isGroup,
  isOwnMessage,
  messageId,
  messageKind,
  parseBoolean,
  parseList,
  parseNonNegativeInt,
  parsePositiveInt,
};
