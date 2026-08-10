'use strict';

function parsePatterns(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(pattern => {
      const match = pattern.match(/^\/(.+)\/([imsuy]*)$/);
      try {
        return match ? new RegExp(match[1], match[2]) : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      } catch (error) {
        throw new Error(`Invalid group pattern "${pattern}": ${error.message}`);
      }
    });
}

function matchingGroups(chats, patterns) {
  return chats.filter(chat => chat?.isGroup === true && patterns.some(pattern => pattern.test(String(chat.name || ''))));
}

function isExplicitConfirmation(value, expected) {
  return String(value || '').trim() === expected;
}

module.exports = { isExplicitConfirmation, matchingGroups, parsePatterns };
