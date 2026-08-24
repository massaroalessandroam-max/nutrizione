import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db, initDb } = await import('./db.js');
const { loadAppointments, addAppointment, deleteAppointment } = await import('./routes/appointments.js');

await initDb();

const PATIENT = 1;

test('addAppointment: si accumulano, non si sovrascrivono (storico, non un singolo campo)', async () => {
  await db.execute('DELETE FROM appointments');

  await addAppointment(PATIENT, '2026-09-01', 'Prima visita');
  const list = await addAppointment(PATIENT, '2026-10-15', 'Controllo');

  assert.equal(list.length, 2);
  assert.deepEqual(list.map((a) => a.at), ['2026-09-01', '2026-10-15'], 'ordinati per data');
});

test('deleteAppointment: non cancella l\'appuntamento di un altro paziente indovinando l\'id', async () => {
  await db.execute('DELETE FROM appointments');

  const [a] = await addAppointment(PATIENT, '2026-09-01', '');
  await addAppointment(2, '2026-09-02', '');

  await deleteAppointment(2, a.id);
  assert.equal((await loadAppointments(PATIENT)).length, 1, 'l\'appuntamento del paziente 1 resta, il paziente 2 non ne è proprietario');

  const after = await deleteAppointment(PATIENT, a.id);
  assert.equal(after.length, 0);
});
