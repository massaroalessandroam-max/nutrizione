import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db, initDb } = await import('./db.js');
const { computeStreak, computeWeek } = await import('./stats.js');

await initDb();

const PATIENT = 1;

async function insertMeal(date: string, mealKey: string, done: 0 | 1, foods: string[]) {
  await db.execute({
    sql: `INSERT INTO meals (patient_id, date, meal_key, done, foods, time) VALUES (?, ?, ?, ?, ?, '12:00')
          ON CONFLICT(patient_id, date, meal_key) DO UPDATE SET done = excluded.done, foods = excluded.foods`,
    args: [PATIENT, date, mealKey, done, JSON.stringify(foods)],
  });
}

function isoDaysAgo(base: Date, n: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

test('computeStreak: counts consecutive logged days ending today, today does not break it', async () => {
  await db.execute('DELETE FROM meals');
  const today = new Date('2026-08-18T00:00:00Z');
  const todayStr = isoDaysAgo(today, 0);
  await insertMeal(isoDaysAgo(today, 1), 'colazione', 1, ['Yogurt greco']);
  await insertMeal(isoDaysAgo(today, 2), 'colazione', 1, ['Uova']);
  // gap at day -3 (nothing logged)
  await insertMeal(isoDaysAgo(today, 4), 'colazione', 1, ['Avena']);

  // Today has nothing logged yet -> should not break the streak, and
  // shouldn't count either.
  assert.equal(await computeStreak(PATIENT, todayStr), 2);
});

test('computeStreak: a logged today extends the streak', async () => {
  await db.execute('DELETE FROM meals');
  const today = new Date('2026-08-18T00:00:00Z');
  const todayStr = isoDaysAgo(today, 0);
  await insertMeal(todayStr, 'colazione', 1, ['Yogurt greco']);
  await insertMeal(isoDaysAgo(today, 1), 'colazione', 1, ['Uova']);

  assert.equal(await computeStreak(PATIENT, todayStr), 2);
});

test('computeStreak: zero when nothing has ever been logged', async () => {
  await db.execute('DELETE FROM meals');
  assert.equal(await computeStreak(PATIENT, '2026-08-18'), 0);
});

test('computeStreak: scoped per patient, one patient\'s meals do not count for another', async () => {
  await db.execute('DELETE FROM meals');
  const today = new Date('2026-08-18T00:00:00Z');
  const todayStr = isoDaysAgo(today, 0);
  await db.execute({
    sql: `INSERT INTO meals (patient_id, date, meal_key, done, foods, time) VALUES (2, ?, 'colazione', 1, '["Uova"]', '12:00')`,
    args: [todayStr],
  });
  assert.equal(await computeStreak(PATIENT, todayStr), 0);
});

test('computeWeek: returns 7 days ending today, with real doneCount per day', async () => {
  await db.execute('DELETE FROM meals');
  const today = new Date('2026-08-18T00:00:00Z');
  const todayStr = isoDaysAgo(today, 0);
  await insertMeal(todayStr, 'colazione', 1, ['Yogurt greco']);
  await insertMeal(isoDaysAgo(today, 1), 'colazione', 1, ['Uova']);
  await insertMeal(isoDaysAgo(today, 1), 'pranzo', 1, ['Pollo']);

  const week = await computeWeek(PATIENT, todayStr);
  assert.equal(week.length, 7);
  assert.equal(week[6].date, todayStr);
  assert.equal(week[6].isToday, true);
  assert.equal(week[6].doneCount, 1);
  assert.equal(week[5].doneCount, 2);
});
