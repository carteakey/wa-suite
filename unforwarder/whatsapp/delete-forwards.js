// delete-forwards.js — delete forwarded messages sent by the authenticated user
//
// Safe defaults: dry-run, forwarding score >= 5, and no private message-body
// logging. Set DRY_RUN=false to mutate only after reviewing the aggregate scan.

'use strict';

const {
  aggregateKinds,
  chatMatches,
  dedupeCandidates,
  isGroup,
  isOwnMessage,
  messageId,
  parseBoolean,
  parseList,
  parsePositiveInt,
} = require('./cleanup-utils');

function configFromEnv(env = process.env) {
  return {
    dryRun: env.DRY_RUN !== 'false',
    msgLimit: parsePositiveInt(env.MSG_LIMIT || '2000', 'MSG_LIMIT'),
    minScore: parsePositiveInt(env.FORWARD_SCORE || '5', 'FORWARD_SCORE'),
    chatFilters: parseList(env.CHATS),
    groupsOnly: parseBoolean(env.GROUPS_ONLY, false),
  };
}

function matchesForwardedMessage(message, config) {
  return isOwnMessage(message) &&
    message?.isForwarded === true &&
    Number(message?.forwardingScore ?? 1) >= config.minScore;
}

async function collectCandidates(chats, config) {
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
      if (!matchesForwardedMessage(message, config)) continue;
      candidates.push({ chat, message, key: messageId(message, chat), score: Number(message.forwardingScore ?? 1) });
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
      const byKind = aggregateKinds(candidates);
      console.log(`Forwarded own-message candidates: ${candidates.length}`);
      console.log(`Breakdown: ${JSON.stringify(byKind)}; failed chats: ${failedChats}`);
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
    console.error(`delete-forwards failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { collectCandidates, configFromEnv, deleteCandidates, matchesForwardedMessage };
