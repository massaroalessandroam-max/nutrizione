import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db, initDb } = await import('./db.js');
const { hashToken } = await import('./auth.js');
const { openPatientSession, openNutritionistSession } = await import('./routes/openAccess.js');

await initDb();

test('accesso libero paziente: un solo account demo, ogni ingresso ha una sessione valida', async () => {
  const t1 = await openPatientSession();
  const t2 = await openPatientSession();
  assert.notEqual(t1, t2);

  const { rows: patients } = await db.execute("SELECT id FROM patients WHERE name = 'Paziente Demo'");
  assert.equal(patients.length, 1);

  for (const t of [t1, t2]) {
    const { rows } = await db.execute({ sql: 'SELECT patient_id FROM patient_sessions WHERE token_hash = ?', args: [hashToken(t)] });
    assert.equal((rows[0] as any).patient_id, (patients[0] as any).id);
  }

  const { rows: state } = await db.execute({ sql: 'SELECT patient_id FROM app_state WHERE patient_id = ?', args: [(patients[0] as any).id] });
  assert.equal(state.length, 1);
});

test('accesso libero nutrizionista: un solo account demo, ogni ingresso ha una sessione valida', async () => {
  const t1 = await openNutritionistSession();
  const t2 = await openNutritionistSession();

  const { rows: nutritionists } = await db.execute("SELECT id FROM nutritionists WHERE email = 'demo@nemis.local'");
  assert.equal(nutritionists.length, 1);

  for (const t of [t1, t2]) {
    const { rows } = await db.execute({ sql: 'SELECT nutritionist_id FROM nutritionist_sessions WHERE token_hash = ?', args: [hashToken(t)] });
    assert.equal((rows[0] as any).nutritionist_id, (nutritionists[0] as any).id);
  }
});
