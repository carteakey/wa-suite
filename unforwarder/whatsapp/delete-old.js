// delete-old.js — delete old messages sent by the authenticated user
//
// AGE_DAYS/MAX_AGE_DAYS is required and must be positive. The command defaults
// to dry-run and fails closed when the age or filters are invalid.

'use strict';

const {
  aggregateKinds,
  chatMatches,
  dedupeCandidates,
  isGroup,
  isOwnMessage,
  messageId,
  messageKind,
  parseBoolean,
  parseList,
  parsePositiveInt,
} = require('./cleanup-utils');

function configFromEnv(env = process.env) {
  const ageValue = env.AGE_DAYS || env.MAX_AGE_DAYS;
  if (!ageValue) throw new Error('AGE_DAYS is required (for example AGE_DAYS=365)');
  const types = parseList(env.MESSAGE_TYPES || env.TYPES);
  const allowed = new Set(['text', 'media', 'link']);
  if (types.some(type => !allowed.has(type))) throw new Error('MESSAGE_TYPES must contain only text, media, or link');
  return {
    dryRun: env.DRY_RUN !== 'false',
    msgLimit: parsePositiveInt(env.MSG_LIMIT || '2000', 'MSG_LIMIT'),
    ageDays: parsePositiveInt(ageValue, 'AGE_DAYS'),
    chatFilters: parseList(env.CHATS),
    groupsOnly: parseBoolean(env.GROUPS_ONLY, false),
    types: new Set(types),
  };
}

function isOlderThan(message, ageDays, nowSeconds = Date.now() / 1000) {
  const timestamp = Number(message?.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return timestamp < nowSeconds - ageDays * 24 * 60 * 60;
}

function matchesOldMessage(message, config, nowSeconds = Date.now() / 1000) {
  if (!isOwnMessage(message) || !isOlderThan(message, config.ageDays, nowSeconds)) return false;
  return !config.types.size || config.types.has(messageKind(message));
}

async function collectCandidates(chats, config, nowSeconds = Date.now() / 1000) {
  const candidates = [];
  let failedChats = 0;
  for (const chat of chats) {
    if (config.groupsOnly && !isGroup(chat)) continue;
    if (!chatMatches(chat, config.chatFilters)) continue;
    let messages;
    try {
      messages = await chat.fetchMessages({ limit: config.msgLimit });
    } catch (error) {
      failedChats += 1;
      continue;
    }
    for (const message of messages) {
      if (matchesOldMessage(message, config, nowSeconds)) {
        candidates.push({ chat, message, key: messageId(message, chat), kind: messageKind(message) });
      }
    }
  }
  return { candidates: dedupeCandidates(candidates), failedChats };
}

async function deleteCandidates(candidates, dryRun) {
  if (dryRun) return { deleted: 0, failed: 0 };
  let deleted = 0;
  let failed = 0;
  for (const candidate of candidates) {
    if (!isOwnMessage(candidate.message)) continue;
    try {
      await candidate.message.delete(false);
      deleted += 1;
    } catch (error) {
      failed += 1;
    }
  }
  return { deleted, failed };
}

async function main() {
  const config = configFromEnv();
  const { createClient } = require('../../lib/client');
  const client = createClient();
  client.on('ready', async () => {
    try {
      const { candidates, failedChats } = await collectCandidates(await client.getChats(), config);
      console.log(`Old own-message candidates: ${candidates.length}`);
      console.log(`Breakdown: ${JSON.stringify(aggregateKinds(candidates))}; failed chats: ${failedChats}`);
      if (config.dryRun) {
        console.log('Dry run — no messages deleted. Set DRY_RUN=false to mutate.');
      } else {
        const result = await deleteCandidates(candidates, false);
        console.log(`Deleted: ${result.deleted}; failed: ${result.failed}`);
      }
    } finally {
      await client.destroy().catch(() => {});
    }
  });
  client.initialize();
}

if (require.main === module) {
  main().catch(error => {
    console.error(`delete-old failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { collectCandidates, configFromEnv, deleteCandidates, isOlderThan, matchesOldMessage };
