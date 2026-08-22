import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db, initDb } = await import('./db.js');
const { loadHabits, saveHabitsList } = await import('./routes/habits.js');

await initDb();

const PATIENT = 1;

test('saveHabitsList: adding a new item preserves the existing id and its check history', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  const [acqua] = await saveHabitsList(PATIENT, [{ text: 'Bere acqua', frequency: 'daily', targetPerWeek: 7 }]);
  await db.execute({ sql: 'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, 1)', args: [acqua.id, '2026-08-20'] });

  const withNew = await saveHabitsList(PATIENT, [
    { id: acqua.id, text: 'Bere acqua', frequency: 'daily', targetPerWeek: 7 },
    { text: 'Camminare', frequency: 'weekly', targetPerWeek: 3 },
  ]);

  assert.equal(withNew.length, 2);
  const acquaAfter = withNew.find((h) => h.id === acqua.id)!;
  assert.ok(acquaAfter, 'id originale conservato');
  const { rows } = await db.execute({ sql: 'SELECT done FROM habit_checks WHERE habit_id = ? AND date = ?', args: [acqua.id, '2026-08-20'] });
  assert.equal(rows.length, 1, 'la spunta storica non va persa quando si aggiunge una voce');
});

test('saveHabitsList: removing an item deletes its habit_checks too', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  const [h] = await saveHabitsList(PATIENT, [{ text: 'Stretching', frequency: 'daily', targetPerWeek: 7 }]);
  await db.execute({ sql: 'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, 1)', args: [h.id, '2026-08-20'] });

  const after = await saveHabitsList(PATIENT, []);
  assert.equal(after.length, 0);
  const { rows } = await db.execute({ sql: 'SELECT * FROM habit_checks WHERE habit_id = ?', args: [h.id] });
  assert.equal(rows.length, 0, 'le spunte orfane vanno cancellate insieme all\'abitudine');
});

test('loadHabits: weekCount uses a rolling 7-day window, doneToday reflects today only', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  const [h] = await saveHabitsList(PATIENT, [{ text: 'Palestra', frequency: 'weekly', targetPerWeek: 3 }]);
  const today = new Date().toISOString().slice(0, 10);
  await db.execute({ sql: 'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, 1)', args: [h.id, today] });

  const [loaded] = await loadHabits(PATIENT);
  assert.equal(loaded.doneToday, true);
  assert.equal(loaded.weekCount, 1);
});

test('loadHabits: scoped per patient, one patient does not see another\'s habits', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  await saveHabitsList(PATIENT, [{ text: 'Del paziente 1', frequency: 'daily', targetPerWeek: 7 }]);
  await saveHabitsList(2, [{ text: 'Del paziente 2', frequency: 'daily', targetPerWeek: 7 }]);

  const habitsOfPatient1 = await loadHabits(PATIENT);
  assert.equal(habitsOfPatient1.length, 1);
  assert.equal(habitsOfPatient1[0].text, 'Del paziente 1');
});
