import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { initDb } = await import('./db.js');
const { splitIntoWeeklyBuckets } = await import('./routes/nutritionist.js');

await initDb();

test('splitIntoWeeklyBuckets: divide un range in settimane, l\'ultimo bucket si accorcia se avanza', async () => {
  const buckets = splitIntoWeeklyBuckets('2026-08-01', '2026-08-20');
  assert.deepEqual(buckets, [
    { from: '2026-08-01', to: '2026-08-07' },
    { from: '2026-08-08', to: '2026-08-14' },
    { from: '2026-08-15', to: '2026-08-20' },
  ]);
});

test('splitIntoWeeklyBuckets: un range più corto di una settimana produce un solo bucket', async () => {
  const buckets = splitIntoWeeklyBuckets('2026-08-01', '2026-08-03');
  assert.deepEqual(buckets, [{ from: '2026-08-01', to: '2026-08-03' }]);
});
