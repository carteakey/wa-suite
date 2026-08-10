// auto-mute.js — preview or mute groups matching explicit name patterns

'use strict';

const { isExplicitConfirmation, matchingGroups, parsePatterns } = require('./group-utils');
const { parsePositiveInt } = require('./cleanup-utils');

function configFromEnv(env = process.env) {
  const patterns = parsePatterns(env.GROUP_PATTERNS);
  if (!patterns.length) throw new Error('GROUP_PATTERNS is required; refusing to match every group');
  const muteDays = env.MUTE_DAYS ? parsePositiveInt(env.MUTE_DAYS, 'MUTE_DAYS') : null;
  return {
    dryRun: env.DRY_RUN !== 'false',
    patterns,
    muteDays,
    confirmed: isExplicitConfirmation(env.MUTE_CONFIRM, 'MUTE_MATCHING_GROUPS'),
  };
}

async function muteGroups(groups, config) {
  if (config.dryRun || !config.confirmed) return { muted: 0, failed: 0, skipped: groups.length };
  let muted = 0;
  let failed = 0;
  const until = config.muteDays ? new Date(Date.now() + config.muteDays * 24 * 60 * 60 * 1000) : undefined;
  for (const group of groups) {
    try {
      await group.mute(until);
      muted += 1;
    } catch (error) {
      failed += 1;
    }
  }
  return { muted, failed, skipped: 0 };
}

async function main() {
  const config = configFromEnv();
  const { createClient } = require('../../lib/client');
  const client = createClient();
  client.on('ready', async () => {
    try {
      const groups = matchingGroups(await client.getChats(), config.patterns);
      console.log(`Matching groups: ${groups.length}`);
      if (config.dryRun) {
        console.log('Dry run — no groups muted. Set DRY_RUN=false and MUTE_CONFIRM=MUTE_MATCHING_GROUPS to mutate.');
      } else if (!config.confirmed) {
        console.log('Confirmation missing — no groups muted.');
      } else {
        const result = await muteGroups(groups, config);
        console.log(`Muted: ${result.muted}; failed: ${result.failed}`);
      }
    } finally {
      await client.destroy().catch(() => {});
    }
  });
  client.initialize();
}

if (require.main === module) {
  main().catch(error => {
    console.error(`auto-mute failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { configFromEnv, muteGroups };
