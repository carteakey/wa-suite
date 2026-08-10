'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { collectCandidates: collectForwarded, configFromEnv: forwardedConfig, matchesForwardedMessage } = require('../unforwarder/whatsapp/delete-forwards');
const { collectCandidates: collectOld, configFromEnv: oldConfig, isOlderThan, matchesOldMessage } = require('../unforwarder/whatsapp/delete-old');
const { isExplicitConfirmation, matchingGroups, parsePatterns } = require('../unforwarder/whatsapp/group-utils');
const { collectCandidates: collectInactive, leaveGroups } = require('../unforwarder/whatsapp/leave-groups');
const { parseBoolean, messageKind } = require('../unforwarder/whatsapp/cleanup-utils');
const { formatStarredEntry, mergeStarredEntries, summarizeMessages } = require('../memento/whatsapp/report-utils');
const { isActiveOnDate, entryKey } = require('../memento/whatsapp/schedule-utils');
const { renderStats } = require('../memento/whatsapp/stats');

function message(overrides = {}) {
  return {
    id: { id: `msg-${Math.random().toString(16).slice(2)}` },
    fromMe: true,
    isForwarded: false,
    forwardingScore: 0,
    timestamp: Math.floor(Date.now() / 1000),
    body: '',
    hasMedia: false,
    ...overrides,
  };
}

function fixtureChat(messages, overrides = {}) {
  return {
    name: 'Sanitized Group',
    id: { _serialized: 'group-san' },
    isGroup: true,
    fetchMessages: async () => messages,
    ...overrides,
  };
}

test('forwarded cleanup is own-message-only, thresholded, and de-duplicates', async () => {
  const config = forwardedConfig({ DRY_RUN: 'true', MSG_LIMIT: '20', FORWARD_SCORE: '5' });
  const own = message({ id: { id: 'forwarded-1' }, isForwarded: true, forwardingScore: 5 });
  const other = message({ id: { id: 'forwarded-2' }, isForwarded: true, forwardingScore: 9, fromMe: false });
  const chat = fixtureChat([own, other]);
  assert.equal(matchesForwardedMessage(own, config), true);
  assert.equal(matchesForwardedMessage(other, config), false);
  const result = await collectForwarded([chat, chat], config);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.failedChats, 0);
});

test('old-message cleanup fails closed and respects type/date boundaries', () => {
  assert.throws(() => oldConfig({ DRY_RUN: 'true', MSG_LIMIT: '10' }), /AGE_DAYS is required/);
  const config = oldConfig({ DRY_RUN: 'true', MSG_LIMIT: '10', AGE_DAYS: '30', MESSAGE_TYPES: 'text' });
  const now = 2_000_000_000;
  const oldText = message({ timestamp: now - 31 * 86400, body: 'old' });
  const recentText = message({ timestamp: now - 2 * 86400, body: 'recent' });
  const oldMedia = message({ timestamp: now - 31 * 86400, hasMedia: true, type: 'image' });
  assert.equal(isOlderThan(oldText, 30, now), true);
  assert.equal(isOlderThan(recentText, 30, now), false);
  assert.equal(matchesOldMessage(oldText, config, now), true);
  assert.equal(matchesOldMessage(oldMedia, config, now), false);
  assert.equal(messageKind(oldMedia), 'media');
});

test('group tools match groups only and require exact confirmations', async () => {
  const patterns = parsePatterns('Sanitized Group');
  const groups = [fixtureChat([]), fixtureChat([], { name: 'Direct', isGroup: false })];
  assert.equal(matchingGroups(groups, patterns).length, 1);
  assert.equal(isExplicitConfirmation('LEAVE_MATCHING_GROUPS', 'LEAVE_MATCHING_GROUPS'), true);
  assert.equal(isExplicitConfirmation('yes', 'LEAVE_MATCHING_GROUPS'), false);
  const result = await collectInactive(groups, {
    patterns,
    inactiveDays: null,
    msgLimit: 5,
    dryRun: true,
    confirmed: false,
  });
  assert.equal(result.candidates.length, 1);
  let left = false;
  const outcome = await leaveGroups([{ group: { isGroup: true, leave: async () => { left = true; } } }], {
    dryRun: false,
    confirmed: false,
  });
  assert.equal(left, false);
  assert.equal(outcome.left, 0);
});

test('schedule ranges support year wrap and stable per-day keys', () => {
  const december = new Date(2025, 11, 15);
  const january = new Date(2026, 0, 15);
  const july = new Date(2026, 6, 15);
  const entry = { id: 'birthday', start_month: 11, start_day: 1, end_month: 2, end_day: 28 };
  assert.equal(isActiveOnDate(entry, december), true);
  assert.equal(isActiveOnDate(entry, january), true);
  assert.equal(isActiveOnDate(entry, july), false);
  assert.equal(entryKey(entry, 0, january), '2026-01-15:birthday');
});

test('starred reports are repeat-safe and stats contain hashes, not private labels', () => {
  const chat = { name: 'Sanitized Chat', id: { _serialized: 'chat-1' } };
  const msg = message({ id: { id: 'star-1' }, isStarred: true, body: 'fixture body', timestamp: 1_700_000_000 });
  const entry = formatStarredEntry(chat, msg);
  const merged = mergeStarredEntries('', [entry, entry]);
  assert.equal((merged.match(/wa-message-id/g) || []).length, 1);
  const summary = summarizeMessages([{ chatId: 'phone-123', isGroup: true, message: msg }]);
  const rendered = renderStats(summary, 0);
  assert.equal(rendered.includes('phone-123'), false);
  assert.equal(rendered.includes('fixture body'), false);
});

test('safe defaults parse predictably and run.sh rejects unknown commands', () => {
  assert.equal(parseBoolean(undefined, true), true);
  assert.equal(parseBoolean('false', true), false);
  const help = spawnSync('bash', ['run.sh', '--help'], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(help.status, 0);
  const classifyHelp = spawnSync('bash', ['run.sh', 'classify', '--help'], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(classifyHelp.status, 0);
  const unknown = spawnSync('bash', ['run.sh', 'unknown-command'], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(unknown.status, 2);
});
