import { Router } from 'express';
import { db } from '../db.js';
import { todayStr } from '../time.js';

export const habitsRouter = Router();

export const HABIT_FREQUENCIES = ['daily', 'weekly'] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

interface HabitRow { id: number; text: string; frequency: string; target_per_week: number; time: string }

// weekCount è la finestra mobile degli ultimi 7 giorni (oggi compreso), non
// la settimana solare — stessa convenzione già usata per il tetto
// settimanale degli alimenti del piano (loadWeekFoods in state.ts).
export async function loadHabits() {
  const { rows } = await db.execute('SELECT id, text, frequency, target_per_week, time FROM habits ORDER BY idx');
  const habits = rows as unknown as HabitRow[];
  const date = todayStr();
  const { rows: checkRows } = await db.execute({
    sql: `SELECT habit_id, date FROM habit_checks WHERE done = 1 AND date >= date(?, '-6 days') AND date <= ?`,
    args: [date, date],
  });
  const checks = checkRows as unknown as Array<{ habit_id: number; date: string }>;

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

habitsRouter.get('/habits', async (_req, res) => {
  res.json(await loadHabits());
});

interface HabitItemBody { id?: unknown; text?: unknown; frequency?: unknown; targetPerWeek?: unknown; time?: unknown }

// Salvataggio in blocco come /plan e /supplements/custom, ma preservando
// l'id: gli item con id vengono aggiornati sul posto, quelli senza sono
// nuovi, e chi resta fuori dalla lista viene cancellato insieme alle sue
// spunte storiche.
export async function saveHabitsList(input: HabitItemBody[]) {
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
        sql: 'UPDATE habits SET idx = ?, text = ?, frequency = ?, target_per_week = ?, time = ? WHERE id = ?',
        args: [idx, it.text, it.frequency, it.targetPerWeek, it.time, it.id],
      });
      keepIds.push(it.id);
    } else {
      const r = await db.execute({
        sql: 'INSERT INTO habits (idx, text, frequency, target_per_week, time) VALUES (?, ?, ?, ?, ?)',
        args: [idx, it.text, it.frequency, it.targetPerWeek, it.time],
      });
      keepIds.push(Number(r.lastInsertRowid));
    }
  }

  const { rows: existing } = await db.execute('SELECT id FROM habits');
  const removedIds = (existing as any[]).map((r) => r.id as number).filter((id) => !keepIds.includes(id));
  for (const id of removedIds) {
    await db.execute({ sql: 'DELETE FROM habits WHERE id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM habit_checks WHERE habit_id = ?', args: [id] });
  }

  return loadHabits();
}

habitsRouter.post('/habits', async (req, res) => {
  const input = Array.isArray(req.body?.items) ? (req.body.items as HabitItemBody[]) : [];
  res.json(await saveHabitsList(input));
});

habitsRouter.put('/habits/:id/check', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id non valido' });
  const done = req.body?.done === true;

  await db.execute({
    sql: `INSERT INTO habit_checks (habit_id, date, done) VALUES (?, ?, ?)
          ON CONFLICT (habit_id, date) DO UPDATE SET done = excluded.done`,
    args: [id, todayStr(), done ? 1 : 0],
  });

  res.json(await loadHabits());
});
