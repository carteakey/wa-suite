// leave-groups.js — list or leave explicitly matched WhatsApp groups
//
// Live mutation requires both DRY_RUN=false and LEAVE_CONFIRM=LEAVE_MATCHING_GROUPS.

'use strict';

const { isExplicitConfirmation, matchingGroups, parsePatterns } = require('./group-utils');
const { parsePositiveInt } = require('./cleanup-utils');

function configFromEnv(env = process.env) {
  const patterns = parsePatterns(env.GROUP_PATTERNS);
  if (!patterns.length) throw new Error('GROUP_PATTERNS is required; refusing to leave every group');
  const inactiveDays = env.INACTIVE_DAYS ? parsePositiveInt(env.INACTIVE_DAYS, 'INACTIVE_DAYS') : null;
  return {
    dryRun: env.DRY_RUN !== 'false',
    patterns,
    inactiveDays,
    msgLimit: parsePositiveInt(env.MSG_LIMIT || '50', 'MSG_LIMIT'),
    confirmed: isExplicitConfirmation(env.LEAVE_CONFIRM, 'LEAVE_MATCHING_GROUPS'),
  };
}

async function collectCandidates(chats, config, nowSeconds = Date.now() / 1000) {
  const groups = matchingGroups(chats, config.patterns);
  const candidates = [];
  let failed = 0;
  for (const group of groups) {
    let messages = [];
    try {
      messages = await group.fetchMessages({ limit: config.msgLimit });
    } catch (error) {
      failed += 1;
      continue;
    }
    const latest = messages.reduce((max, message) => Math.max(max, Number(message.timestamp) || 0), 0);
    if (config.inactiveDays && latest > nowSeconds - config.inactiveDays * 24 * 60 * 60) continue;
    candidates.push({ group, latest });
  }
  return { candidates, failed };
}

async function leaveGroups(candidates, config) {
  if (config.dryRun || !config.confirmed) return { left: 0, failed: 0 };
  let left = 0;
  let failed = 0;
  for (const candidate of candidates) {
    // collectCandidates only returns isGroup=true chats; keep the guard at the mutation boundary.
    if (candidate.group?.isGroup !== true) continue;
    try {
      await candidate.group.leave();
      left += 1;
    } catch (error) {
      failed += 1;
    }
  }
  return { left, failed };
}

async function main() {
  const config = configFromEnv();
  const { createClient } = require('../../lib/client');
  const client = createClient();
  client.on('ready', async () => {
    try {
      const result = await collectCandidates(await client.getChats(), config);
      console.log(`Matching inactive groups: ${result.candidates.length}; fetch failures: ${result.failed}`);
      if (config.dryRun) {
        console.log('Dry run — no groups left. Set DRY_RUN=false and LEAVE_CONFIRM=LEAVE_MATCHING_GROUPS to mutate.');
      } else if (!config.confirmed) {
        console.log('Confirmation missing — no groups left.');
      } else {
        const outcome = await leaveGroups(result.candidates, config);
        console.log(`Left: ${outcome.left}; failed: ${outcome.failed}`);
      }
    } finally {
      await client.destroy().catch(() => {});
    }
  });
  client.initialize();
}

if (require.main === module) {
  main().catch(error => {
    console.error(`leave-groups failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { collectCandidates, configFromEnv, leaveGroups };
