import { test } from 'node:test';
import assert from 'node:assert/strict';

const { resolveDate } = await import('./routes/state.js');
const { todayStr } = await import('./time.js');

function isoDaysFromToday(n: number): string {
  const d = new Date(`${todayStr()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

test('resolveDate: a valid past date from the client is used as-is (backfill)', () => {
  const yesterday = isoDaysFromToday(-1);
  assert.equal(resolveDate(yesterday), yesterday);
});

test('resolveDate: today is accepted', () => {
  assert.equal(resolveDate(todayStr()), todayStr());
});

test('resolveDate: a future date falls back to today (no logging ahead of time)', () => {
  assert.equal(resolveDate(isoDaysFromToday(1)), todayStr());
});

test('resolveDate: malformed or missing input falls back to today', () => {
  assert.equal(resolveDate('not-a-date'), todayStr());
  assert.equal(resolveDate(undefined), todayStr());
  assert.equal(resolveDate(null), todayStr());
});
