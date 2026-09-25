import { Router } from 'express';
import { db } from '../db.js';
import { requirePatient } from '../auth.js';
import { todayStr } from '../time.js';

export const KINDS = ['strength', 'cardio'] as const;
export type Kind = (typeof KINDS)[number];

export interface SetEntry { weight: number; reps: number; minutes: number }
export interface ExerciseRef { exerciseId: string; name: string; gifUrl: string; kind: Kind }
export interface Performance { date: string; sets: SetEntry[] }
export interface PlanExercise extends ExerciseRef {
  sets: number; reps: number; weight: number; minutes: number;
  last: Performance | null;
  bestWeight: number;
}
export interface WorkoutPlan { id: number; name: string; startDate: string; endDate: string; createdBy: 'patient' | 'nutritionist'; exercises: PlanExercise[] }
export interface WorkoutExercise { exerciseId: string; name: string; kind: Kind; note: string; sets: SetEntry[] }
export interface Workout { id: number; date: string; planId: number | null; planName: string; note: string; exercises: WorkoutExercise[] }
export interface ExerciseProgress {
  exerciseId: string; name: string; kind: Kind; sessions: number;
  bestWeight: number; repsAtBest: number; bestVolume: number;
  last: { date: string; volume: number; topWeight: number; repsAtTop: number };
  history: Array<{ date: string; topWeight: number; volume: number }>; // dal più vecchio al più recente
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 0;
};
const str = (v: unknown, max = 200): string => String(v ?? '').trim().slice(0, max);
const kindOf = (v: unknown): Kind => (v === 'cardio' ? 'cardio' : 'strength');

function parseRef(x: any): ExerciseRef | null {
  const exerciseId = str(x?.exerciseId, 80);
  const name = str(x?.name);
  return exerciseId && name ? { exerciseId, name, gifUrl: str(x?.gifUrl, 500), kind: kindOf(x?.kind) } : null;
}

function parseSets(raw: unknown): SetEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => ({ weight: num(s?.weight), reps: Math.round(num(s?.reps)), minutes: num(s?.minutes) }))
    .filter((s) => s.weight > 0 || s.reps > 0 || s.minutes > 0);
}

const volumeOf = (kind: Kind, sets: SetEntry[]) =>
  Math.round(sets.reduce((t, s) => t + (kind === 'cardio' ? s.minutes : s.weight * s.reps), 0) * 10) / 10;

function topSet(sets: SetEntry[]): SetEntry {
  return sets.reduce((b, s) => (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b), sets[0]);
}

interface HistoryEntry { date: string; name: string; kind: Kind; sets: SetEntry[] }

// Tutte le esecuzioni del paziente per esercizio, dalla più recente.
// ponytail: si legge l'intero storico del paziente a ogni richiesta; se
// diventa lento, filtrare per exercise_id / limitare per data.
async function loadHistory(patientId: number): Promise<Map<string, HistoryEntry[]>> {
  const { rows } = await db.execute({
    sql: `SELECT we.exercise_id, we.name, we.kind, we.sets, w.date
          FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
          WHERE w.patient_id = ? ORDER BY w.date DESC, w.id DESC`,
    args: [patientId],
  });
  const map = new Map<string, HistoryEntry[]>();
  for (const r of rows as any[]) {
    const sets = parseSets(JSON.parse(r.sets));
    if (!sets.length) continue;
    const list = map.get(r.exercise_id) ?? [];
    list.push({ date: r.date, name: r.name, kind: r.kind, sets });
    map.set(r.exercise_id, list);
  }
  return map;
}

export async function loadPlans(patientId: number): Promise<WorkoutPlan[]> {
  const { rows: planRows } = await db.execute({
    sql: 'SELECT id, name, start_date, end_date, created_by FROM workout_plans WHERE patient_id = ? ORDER BY start_date DESC, id DESC',
    args: [patientId],
  });
  if (!planRows.length) return [];
  const ids = (planRows as any[]).map((p) => p.id);
  const { rows: exRows } = await db.execute({
    sql: `SELECT plan_id, exercise_id, name, gif_url, kind, sets, reps, weight, minutes FROM workout_plan_exercises
          WHERE plan_id IN (${ids.map(() => '?').join(',')}) ORDER BY plan_id, idx`,
    args: ids,
  });
  const history = await loadHistory(patientId);
  return (planRows as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.start_date,
    endDate: p.end_date,
    createdBy: p.created_by,
    exercises: (exRows as any[])
      .filter((e) => e.plan_id === p.id)
      .map((e) => {
        const runs = history.get(e.exercise_id) ?? [];
        return {
          exerciseId: e.exercise_id, name: e.name, gifUrl: e.gif_url, kind: e.kind,
          sets: e.sets, reps: e.reps, weight: e.weight, minutes: e.minutes,
          // Carico proposto: l'ultimo eseguito (in qualunque scheda), non il target scritto.
          last: runs[0] ? { date: runs[0].date, sets: runs[0].sets } : null,
          bestWeight: Math.max(0, ...runs.flatMap((r) => r.sets.map((s) => s.weight))),
        };
      }),
  }));
}

export async function createPlan(patientId: number, createdBy: 'patient' | 'nutritionist', body: any): Promise<WorkoutPlan[] | string> {
  const name = str(body?.name, 80);
  if (!name) return 'nome obbligatorio';
  const startDate = str(body?.startDate, 10);
  if (!ISO_DATE.test(startDate)) return 'data di inizio non valida';
  const endDate = str(body?.endDate, 10);
  if (endDate && (!ISO_DATE.test(endDate) || endDate < startDate)) return 'data di fine non valida';
  const exercises = (Array.isArray(body?.exercises) ? body.exercises : [])
    .map((x: any) => {
      const ref = parseRef(x);
      return ref && { ...ref, sets: Math.round(num(x?.sets)), reps: Math.round(num(x?.reps)), weight: num(x?.weight), minutes: num(x?.minutes) };
    })
    .filter(Boolean);
  if (!exercises.length) return 'aggiungi almeno un esercizio';

  const result = await db.execute({
    sql: 'INSERT INTO workout_plans (patient_id, name, start_date, end_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [patientId, name, startDate, endDate, createdBy, new Date().toISOString()],
  });
  const planId = Number(result.lastInsertRowid);
  for (const [idx, e] of exercises.entries()) {
    await db.execute({
      sql: `INSERT INTO workout_plan_exercises (plan_id, idx, exercise_id, name, gif_url, kind, sets, reps, weight, minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [planId, idx, e.exerciseId, e.name, e.gifUrl, e.kind, e.sets, e.reps, e.weight, e.minutes],
    });
  }
  return loadPlans(patientId);
}

export async function deletePlan(patientId: number, planId: number): Promise<WorkoutPlan[]> {
  const { rows } = await db.execute({ sql: 'SELECT id FROM workout_plans WHERE id = ? AND patient_id = ?', args: [planId, patientId] });
  if (rows.length) {
    await db.execute({ sql: 'DELETE FROM workout_plan_exercises WHERE plan_id = ?', args: [planId] });
    await db.execute({ sql: 'DELETE FROM workout_plans WHERE id = ?', args: [planId] });
  }
  return loadPlans(patientId);
}

export async function saveWorkout(patientId: number, body: any): Promise<Workout[] | string> {
  const date = str(body?.date, 10) || todayStr();
  if (!ISO_DATE.test(date)) return 'data non valida';
  const exercises = (Array.isArray(body?.exercises) ? body.exercises : [])
    .map((x: any) => {
      const ref = parseRef(x);
      return ref && { ...ref, note: str(x?.note, 500), sets: parseSets(x?.sets) };
    })
    .filter((e: any) => e && (e.sets.length || e.note));
  if (!exercises.length) return 'registra almeno una serie';

  let planId: number | null = null;
  if (body?.planId != null) {
    const { rows } = await db.execute({ sql: 'SELECT id FROM workout_plans WHERE id = ? AND patient_id = ?', args: [Number(body.planId), patientId] });
    if (!rows.length) return 'scheda non trovata';
    planId = Number(body.planId);
  }
  const result = await db.execute({
    sql: 'INSERT INTO workouts (patient_id, plan_id, date, note, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [patientId, planId, date, str(body?.note, 1000), new Date().toISOString()],
  });
  const workoutId = Number(result.lastInsertRowid);
  for (const [idx, e] of exercises.entries()) {
    await db.execute({
      sql: 'INSERT INTO workout_exercises (workout_id, idx, exercise_id, name, kind, note, sets) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [workoutId, idx, e.exerciseId, e.name, e.kind, e.note, JSON.stringify(e.sets)],
    });
  }
  return loadWorkouts(patientId);
}

export async function loadWorkouts(patientId: number, limit = 30): Promise<Workout[]> {
  const { rows } = await db.execute({
    sql: `SELECT w.id, w.date, w.plan_id, w.note, p.name AS plan_name
          FROM workouts w LEFT JOIN workout_plans p ON p.id = w.plan_id
          WHERE w.patient_id = ? ORDER BY w.date DESC, w.id DESC LIMIT ?`,
    args: [patientId, limit],
  });
  if (!rows.length) return [];
  const ids = (rows as any[]).map((w) => w.id);
  const { rows: exRows } = await db.execute({
    sql: `SELECT workout_id, exercise_id, name, kind, note, sets FROM workout_exercises
          WHERE workout_id IN (${ids.map(() => '?').join(',')}) ORDER BY workout_id, idx`,
    args: ids,
  });
  return (rows as any[]).map((w) => ({
    id: w.id,
    date: w.date,
    planId: w.plan_id,
    planName: w.plan_name ?? '',
    note: w.note,
    exercises: (exRows as any[])
      .filter((e) => e.workout_id === w.id)
      .map((e) => ({ exerciseId: e.exercise_id, name: e.name, kind: e.kind, note: e.note, sets: parseSets(JSON.parse(e.sets)) })),
  }));
}

// Progressi per esercizio (come la sezione Progressi di TOP78): carico
// massimo e ripetizioni fatte con quello, volume massimo in una sessione,
// volume/carico dell'ultimo allenamento, andamento nel tempo.
export async function loadProgress(patientId: number): Promise<ExerciseProgress[]> {
  const history = await loadHistory(patientId);
  const out: ExerciseProgress[] = [];
  for (const [exerciseId, runs] of history) {
    const kind = runs[0].kind;
    const perRun = runs.map((r) => {
      const top = topSet(r.sets);
      return { date: r.date, topWeight: top.weight, repsAtTop: top.reps, volume: volumeOf(kind, r.sets) };
    });
    const best = perRun.reduce((b, r) => (r.topWeight > b.topWeight || (r.topWeight === b.topWeight && r.repsAtTop > b.repsAtTop) ? r : b));
    out.push({
      exerciseId, name: runs[0].name, kind, sessions: runs.length,
      bestWeight: best.topWeight, repsAtBest: best.repsAtTop,
      bestVolume: Math.max(...perRun.map((r) => r.volume)),
      last: perRun[0],
      history: perRun.slice(0, 12).reverse().map(({ date, topWeight, volume }) => ({ date, topWeight, volume })),
    });
  }
  return out.sort((a, b) => b.last.date.localeCompare(a.last.date));
}

export const workoutsRouter = Router();
workoutsRouter.use(requirePatient);

workoutsRouter.get('/workout-plans', async (req, res) => res.json(await loadPlans(req.patientId!)));

workoutsRouter.post('/workout-plans', async (req, res) => {
  const result = await createPlan(req.patientId!, 'patient', req.body);
  if (typeof result === 'string') return res.status(400).json({ error: result });
  res.json(result);
});

workoutsRouter.delete('/workout-plans/:id', async (req, res) => res.json(await deletePlan(req.patientId!, Number(req.params.id))));

workoutsRouter.get('/workouts', async (req, res) => res.json(await loadWorkouts(req.patientId!)));

workoutsRouter.post('/workouts', async (req, res) => {
  const result = await saveWorkout(req.patientId!, req.body);
  if (typeof result === 'string') return res.status(400).json({ error: result });
  res.json(result);
});

workoutsRouter.get('/workout-progress', async (req, res) => res.json(await loadProgress(req.patientId!)));
