import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { initDb } = await import('./db.js');
const { createPlan, saveWorkout, loadPlans, loadProgress, deletePlan } = await import('./routes/workouts.js');

await initDb();

const PATIENT = 1;
const bench = { exerciseId: 'bench', name: 'Panca piana', gifUrl: '', kind: 'strength' };
const run = { exerciseId: 'run', name: 'Corsa', gifUrl: '', kind: 'cardio' };

test('carico registrato: la scheda (anche una nuova) propone l\'ultimo peso, non il target', async () => {
  const plans = await createPlan(PATIENT, 'patient', {
    name: 'Forza A', startDate: '2026-09-01',
    exercises: [{ ...bench, sets: 3, reps: 10, weight: 30 }, { ...run, minutes: 20 }],
  });
  assert.ok(typeof plans !== 'string');
  assert.equal(plans[0].exercises[0].last, null, 'nessun allenamento: si usa il target');

  await saveWorkout(PATIENT, {
    date: '2026-09-02', planId: plans[0].id,
    exercises: [{ ...bench, sets: [{ weight: 50, reps: 8 }, { weight: 50, reps: 6 }], note: 'pesante' }, { ...run, sets: [{ minutes: 25 }] }],
  });

  const next = await createPlan(PATIENT, 'nutritionist', { name: 'Forza B', startDate: '2026-10-01', exercises: [{ ...bench, sets: 3, reps: 10, weight: 30 }] });
  assert.ok(typeof next !== 'string');
  const forzaB = next.find((p) => p.name === 'Forza B')!;
  assert.deepEqual(forzaB.exercises[0].last?.sets.map((s) => s.weight), [50, 50]);
  assert.equal(forzaB.exercises[0].bestWeight, 50);
  assert.equal(forzaB.createdBy, 'nutritionist');
});

test('progressi: massimo, ripetizioni al massimo, volume; cardio in minuti', async () => {
  await saveWorkout(PATIENT, { date: '2026-09-09', exercises: [{ ...bench, sets: [{ weight: 40, reps: 12 }] }] });
  const progress = await loadProgress(PATIENT);
  const b = progress.find((p) => p.exerciseId === 'bench')!;
  assert.equal(b.bestWeight, 50);
  assert.equal(b.repsAtBest, 8);
  assert.equal(b.bestVolume, 50 * 8 + 50 * 6);
  assert.equal(b.last.volume, 480, 'ultimo allenamento: 40x12');
  assert.equal(b.history.length, 2);
  assert.equal(progress.find((p) => p.exerciseId === 'run')!.bestVolume, 25);
});

test('validazione e cancellazione scheda', async () => {
  assert.equal(await createPlan(PATIENT, 'patient', { name: '', startDate: '2026-09-01', exercises: [bench] }), 'nome obbligatorio');
  assert.equal(await createPlan(PATIENT, 'patient', { name: 'x', startDate: '2026-09-05', endDate: '2026-09-01', exercises: [bench] }), 'data di fine non valida');
  assert.equal(await saveWorkout(PATIENT, { exercises: [{ ...bench, sets: [] }] }), 'registra almeno una serie');

  const [plan] = await loadPlans(PATIENT);
  await deletePlan(2, plan.id);
  assert.equal((await loadPlans(PATIENT)).length, 2, 'un altro paziente non cancella schede altrui');
  assert.equal((await deletePlan(PATIENT, plan.id)).length, 1);
});
