import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db } = await import('./db.js');
const { computeStreak, computeWeek } = await import('./stats.js');

function insertMeal(date: string, mealKey: string, done: 0 | 1, foods: string[]) {
  db.prepare(
    `INSERT INTO meals (date, meal_key, done, foods, time) VALUES (?, ?, ?, ?, '12:00')
     ON CONFLICT(date, meal_key) DO UPDATE SET done = excluded.done, foods = excluded.foods`
  ).run(date, mealKey, done, JSON.stringify(foods));
}

function isoDaysAgo(base: Date, n: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

test('computeStreak: counts consecutive logged days ending today, today does not break it', () => {
  db.exec('DELETE FROM meals');
  const today = new Date('2026-08-18T00:00:00Z');
  const todayStr = isoDaysAgo(today, 0);
  insertMeal(isoDaysAgo(today, 1), 'colazione', 1, ['Yogurt greco']);
  insertMeal(isoDaysAgo(today, 2), 'colazione', 1, ['Uova']);
  // gap at day -3 (nothing logged)
  insertMeal(isoDaysAgo(today, 4), 'colazione', 1, ['Avena']);

  // Today has nothing logged yet -> should not break the streak, and
  // shouldn't count either.
  assert.equal(computeStreak(todayStr), 2);
});

test('computeStreak: a logged today extends the streak', () => {
  db.exec('DELETE FROM meals');
  const today = new Date('2026-08-18T00:00:00Z');
  const todayStr = isoDaysAgo(today, 0);
  insertMeal(todayStr, 'colazione', 1, ['Yogurt greco']);
  insertMeal(isoDaysAgo(today, 1), 'colazione', 1, ['Uova']);

  assert.equal(computeStreak(todayStr), 2);
});

test('computeStreak: zero when nothing has ever been logged', () => {
  db.exec('DELETE FROM meals');
  assert.equal(computeStreak('2026-08-18'), 0);
});

test('computeWeek: returns 7 days ending today, with real doneCount per day', () => {
  db.exec('DELETE FROM meals');
  const today = new Date('2026-08-18T00:00:00Z');
  const todayStr = isoDaysAgo(today, 0);
  insertMeal(todayStr, 'colazione', 1, ['Yogurt greco']);
  insertMeal(isoDaysAgo(today, 1), 'colazione', 1, ['Uova']);
  insertMeal(isoDaysAgo(today, 1), 'pranzo', 1, ['Pollo']);

  const week = computeWeek(todayStr);
  assert.equal(week.length, 7);
  assert.equal(week[6].date, todayStr);
  assert.equal(week[6].isToday, true);
  assert.equal(week[6].doneCount, 1);
  assert.equal(week[5].doneCount, 2);
});
