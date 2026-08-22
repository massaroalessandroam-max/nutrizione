import { Router } from 'express';
import { db } from '../db.js';
import { todayStr } from '../time.js';
import { requirePatient } from '../auth.js';

export const habitsRouter = Router();
habitsRouter.use(requirePatient);

export const HABIT_FREQUENCIES = ['daily', 'weekly'] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

interface HabitRow { id: number; text: string; frequency: string; target_per_week: number; time: string }

// weekCount è la finestra mobile degli ultimi 7 giorni (oggi compreso), non
// la settimana solare — stessa convenzione già usata per il tetto
// settimanale degli alimenti del piano (loadWeekFoods in state.ts).
export async function loadHabits(patientId: number) {
  const { rows } = await db.execute({ sql: 'SELECT id, text, frequency, target_per_week, time FROM habits WHERE patient_id = ? ORDER BY idx', args: [patientId] });
  const habits = rows as unknown as HabitRow[];
  const date = todayStr();
  const habitIds = habits.map((h) => h.id);
  const checks: Array<{ habit_id: number; date: string }> = [];
  if (habitIds.length) {
    const placeholders = habitIds.map(() => '?').join(',');
    const { rows: checkRows } = await db.execute({
      sql: `SELECT habit_id, date FROM habit_checks WHERE done = 1 AND date >= date(?, '-6 days') AND date <= ? AND habit_id IN (${placeholders})`,
      args: [date, date, ...habitIds],
    });
    checks.push(...(checkRows as unknown as Array<{ habit_id: number; date: string }>));
  }

  return habits.map((h) => {
    const weekChecks = checks.filter((c) => c.habit_id === h.id);
    return {
      id: h.id,
      text: h.text,
      frequency: h.frequency,
      targetPerWeek: h.target_per_week,
      time: h.time,
      doneToday: weekChecks.some((c) => c.date === date),
      weekCount: weekChecks.length,
    };
  });
}

habitsRouter.get('/habits', async (req, res) => {
  res.json(await loadHabits(req.patientId!));
});

interface HabitItemBody { id?: unknown; text?: unknown; frequency?: unknown; targetPerWeek?: unknown; time?: unknown }

// Salvataggio in blocco come /plan e /supplements/custom, ma preservando
// l'id: gli item con id vengono aggiornati sul posto, quelli senza sono
// nuovi, e chi resta fuori dalla lista viene cancellato insieme alle sue
// spunte storiche.
export async function saveHabitsList(patientId: number, input: HabitItemBody[]) {
  const clean = input
    .map((it) => ({
      id: typeof it?.id === 'number' ? it.id : undefined,
      text: String(it?.text ?? '').trim(),
      frequency: (HABIT_FREQUENCIES as readonly string[]).includes(String(it?.frequency)) ? String(it.frequency) : 'daily',
      targetPerWeek: Math.min(7, Math.max(1, Number(it?.targetPerWeek) || 7)),
      time: /^\d{2}:\d{2}$/.test(String(it?.time)) ? String(it.time) : '',
    }))
    .filter((it) => it.text);

  const keepIds: number[] = [];
  for (const [idx, it] of clean.entries()) {
    if (it.id !== undefined) {
      await db.execute({
        sql: 'UPDATE habits SET idx = ?, text = ?, frequency = ?, target_per_week = ?, time = ? WHERE id = ? AND patient_id = ?',
        args: [idx, it.text, it.frequency, it.targetPerWeek, it.time, it.id, patientId],
      });
      keepIds.push(it.id);
    } else {
      const r = await db.execute({
        sql: 'INSERT INTO habits (patient_id, idx, text, frequency, target_per_week, time) VALUES (?, ?, ?, ?, ?, ?)',
        args: [patientId, idx, it.text, it.frequency, it.targetPerWeek, it.time],
      });
      keepIds.push(Number(r.lastInsertRowid));
    }
  }

  const { rows: existing } = await db.execute({ sql: 'SELECT id FROM habits WHERE patient_id = ?', args: [patientId] });
  const removedIds = (existing as any[]).map((r) => r.id as number).filter((id) => !keepIds.includes(id));
  for (const id of removedIds) {
    await db.execute({ sql: 'DELETE FROM habits WHERE id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM habit_checks WHERE habit_id = ?', args: [id] });
  }

  return loadHabits(patientId);
}

habitsRouter.post('/habits', async (req, res) => {
  const input = Array.isArray(req.body?.items) ? (req.body.items as HabitItemBody[]) : [];
  res.json(await saveHabitsList(req.patientId!, input));
});

habitsRouter.put('/habits/:id/check', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id non valido' });
  const patientId = req.patientId!;

  // L'abitudine dev'essere del paziente autenticato — altrimenti si
  // potrebbe spuntare l'abitudine di qualcun altro indovinando l'id.
  const { rows: owned } = await db.execute({ sql: 'SELECT id FROM habits WHERE id = ? AND patient_id = ?', args: [id, patientId] });
  if (!owned[0]) return res.status(404).json({ error: 'abitudine non trovata' });

  const done = req.body?.done === true;
  await db.execute({
    sql: `INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, ?)
          ON CONFLICT (habit_id, date) DO UPDATE SET done = excluded.done`,
    args: [id, todayStr(), done ? 1 : 0],
  });

  res.json(await loadHabits(patientId));
});
