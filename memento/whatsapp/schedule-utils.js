'use strict';

function monthDayValue(date) {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

function entryBoundaryValue(entry, prefix) {
  const month = Number(entry?.[`${prefix}_month`]);
  const day = Number(entry?.[`${prefix}_day`]);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) return null;
  return month * 100 + day;
}

function isActiveOnDate(entry, date = new Date()) {
  const start = entryBoundaryValue(entry, 'start');
  const end = entryBoundaryValue(entry, 'end');
  if (start === null || end === null) return false;
  const current = monthDayValue(date);
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

function dayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function entryKey(entry, index, date = new Date()) {
  const identity = entry.id || entry.contact || `entry-${index}`;
  return `${dayKey(date)}:${identity}`;
}

function loadCheckpoint(file) {
  try {
    const value = require('fs').readFileSync(file, 'utf8');
    const parsed = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed : parsed.sent || []);
  } catch (error) {
    return new Set();
  }
}

function saveCheckpoint(file, checkpoint) {
  const fs = require('fs');
  const path = require('path');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ sent: [...checkpoint].sort() }, null, 2) + '\n', 'utf8');
}

module.exports = { dayKey, entryBoundaryValue, entryKey, isActiveOnDate, loadCheckpoint, saveCheckpoint };
