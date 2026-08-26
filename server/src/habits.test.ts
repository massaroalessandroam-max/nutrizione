import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db, initDb } = await import('./db.js');
const { loadHabits, saveHabitsList, loadHabitsForDate } = await import('./routes/habits.js');

await initDb();

const PATIENT = 1;

test('saveHabitsList: adding a new item preserves the existing id and its check history', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  const [acqua] = await saveHabitsList(PATIENT, [{ text: 'Bere acqua', days: [] }]);
  await db.execute({ sql: 'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, 1)', args: [acqua.id, '2026-08-20'] });

  const withNew = await saveHabitsList(PATIENT, [
    { id: acqua.id, text: 'Bere acqua', days: [] },
    { text: 'Camminare', days: ['mon', 'wed', 'fri'] },
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

  const [h] = await saveHabitsList(PATIENT, [{ text: 'Stretching', days: [] }]);
  await db.execute({ sql: 'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, 1)', args: [h.id, '2026-08-20'] });

  const after = await saveHabitsList(PATIENT, []);
  assert.equal(after.length, 0);
  const { rows } = await db.execute({ sql: 'SELECT * FROM habit_checks WHERE habit_id = ?', args: [h.id] });
  assert.equal(rows.length, 0, 'le spunte orfane vanno cancellate insieme all\'abitudine');
});

test('saveHabitsList: days vuoto = tutti i giorni, altrimenti dueToday segue i giorni scelti', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  await saveHabitsList(PATIENT, [{ text: 'Ogni giorno', days: [] }, { text: 'Solo lunedì', days: ['mon'] }]);
  const habits = await loadHabits(PATIENT);
  const daily = habits.find((h) => h.text === 'Ogni giorno')!;
  const mondayOnly = habits.find((h) => h.text === 'Solo lunedì')!;

  assert.equal(daily.dueToday, true, 'nessun giorno impostato = dovuta ogni giorno');
  const todayIsMonday = new Date().getUTCDay() === 1;
  assert.equal(mondayOnly.dueToday, todayIsMonday);
});

test('loadHabits: doneToday riflette la spunta di oggi', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  const [h] = await saveHabitsList(PATIENT, [{ text: 'Palestra', days: [] }]);
  const today = new Date().toISOString().slice(0, 10);
  await db.execute({ sql: 'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, 1)', args: [h.id, today] });

  const [loaded] = await loadHabits(PATIENT);
  assert.equal(loaded.doneToday, true);
});

test('loadHabits: scoped per patient, one patient does not see another\'s habits', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  await saveHabitsList(PATIENT, [{ text: 'Del paziente 1', days: [] }]);
  await saveHabitsList(2, [{ text: 'Del paziente 2', days: [] }]);

  const habitsOfPatient1 = await loadHabits(PATIENT);
  assert.equal(habitsOfPatient1.length, 1);
  assert.equal(habitsOfPatient1[0].text, 'Del paziente 1');
});

test('saveHabitsList: persiste la categoria esplicita, ignora valori non validi', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  const [sera, senzaCategoria] = await saveHabitsList(PATIENT, [
    { text: 'Camomilla', days: [], category: 'sera' },
    { text: 'Boh', days: [], category: 'notte' },
  ]);

  assert.equal(sera.category, 'sera');
  assert.equal(senzaCategoria.category, null, 'una categoria non tra le 3 valide viene ignorata (null)');

  const [reloaded] = await loadHabits(PATIENT);
  assert.equal(reloaded.category, 'sera', 'la categoria sopravvive a un ricaricamento');
});

test('loadHabitsForDate: riflette due/done per una data passata, non per oggi', async () => {
  await db.execute('DELETE FROM habits');
  await db.execute('DELETE FROM habit_checks');

  const [h] = await saveHabitsList(PATIENT, [{ text: 'Solo lunedì', days: ['mon'] }]);
  // Trova un lunedì recente qualsiasi, indipendente dalla data di oggi.
  const cursor = new Date();
  while (cursor.getUTCDay() !== 1) cursor.setUTCDate(cursor.getUTCDate() - 1);
  const monday = cursor.toISOString().slice(0, 10);
  await db.execute({ sql: 'INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, 1)', args: [h.id, monday] });

  const [dayItem] = await loadHabitsForDate(PATIENT, monday);
  assert.equal(dayItem.due, true);
  assert.equal(dayItem.done, true);
});
