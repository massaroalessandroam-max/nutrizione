import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db, initDb } = await import('./db.js');
const { addEvent, loadRecentActivity } = await import('./events.js');

await initDb();

test('addEvent/loadRecentActivity: più recenti prima, col nome paziente risolto', async () => {
  await db.execute('DELETE FROM events');
  await db.execute('DELETE FROM patients');
  await db.execute({
    sql: 'INSERT INTO patients (id, name, access_code_hash, created_at) VALUES (1, ?, ?, ?)',
    args: ['Marco', 'x', new Date().toISOString()],
  });

  await addEvent(1, 'patient_created', 'Nuovo paziente aggiunto');
  await addEvent(1, 'onboarding_completed', "Ha completato l'onboarding");

  const activity = await loadRecentActivity();
  assert.equal(activity.length, 2);
  assert.equal(activity[0].type, 'onboarding_completed', 'il più recente viene prima');
  assert.equal(activity[0].patientName, 'Marco', 'il nome paziente è risolto via join');
});

test('loadRecentActivity: rispetta il limite', async () => {
  await db.execute('DELETE FROM events');
  await db.execute('DELETE FROM patients');
  await db.execute({
    sql: 'INSERT INTO patients (id, name, access_code_hash, created_at) VALUES (1, ?, ?, ?)',
    args: ['Marco', 'x', new Date().toISOString()],
  });

  for (let i = 0; i < 5; i++) await addEvent(1, 'appointment_created', `evento ${i}`);

  const activity = await loadRecentActivity(3);
  assert.equal(activity.length, 3);
});
