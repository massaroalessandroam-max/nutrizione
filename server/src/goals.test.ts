import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db, initDb } = await import('./db.js');
const { loadGoals, addGoal, deleteGoal } = await import('./routes/goals.js');

await initDb();

const PATIENT = 1;

test('addGoal: macro e micro convivono, testo libero non un valore numerico', async () => {
  await db.execute('DELETE FROM goals');

  await addGoal(PATIENT, 'macro', 'Perdere 30kg', '2027-08-23');
  const list = await addGoal(PATIENT, 'micro', 'Correre una maratona in 4 ore', '2026-09-23');

  assert.equal(list.length, 2);
  assert.deepEqual(list.map((g) => g.level), ['micro', 'macro'], 'ordinati per scadenza, la più vicina prima');
});

test('deleteGoal: rimuove solo l\'obiettivo indicato', async () => {
  await db.execute('DELETE FROM goals');

  const [g] = await addGoal(PATIENT, 'macro', 'Taglia 42', '2027-01-01');
  const after = await deleteGoal(PATIENT, g.id);
  assert.equal(after.length, 0);
});
