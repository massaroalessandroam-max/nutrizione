import { Router } from 'express';
import { db } from '../db.js';
import { todayStr } from '../time.js';
import { requirePatient } from '../auth.js';
import { computeHabitsWeek } from '../stats.js';

export const habitsRouter = Router();
habitsRouter.use(requirePatient);

// Ordine "italiano" della settimana (lunedì primo) usato per i giorni scelti
// su ogni abitudine. getUTCDay() di JS parte dalla domenica: WEEKDAY_INDEX
// mappa un codice al suo indice getUTCDay() per confrontarlo con una data.
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
const WEEKDAY_INDEX: Record<Weekday, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export function weekdayCodeOf(date: string): Weekday {
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  return WEEKDAYS.find((w) => WEEKDAY_INDEX[w] === jsDay)!;
}

interface HabitRow { id: number; text: string; time: string; days: string }

export async function loadHabits(patientId: number) {
  const { rows } = await db.execute({ sql: 'SELECT id, text, time, days FROM habits WHERE patient_id = ? ORDER BY idx', args: [patientId] });
  const habits = rows as unknown as HabitRow[];
  const date = todayStr();
  const todayCode = weekdayCodeOf(date);
  const habitIds = habits.map((h) => h.id);
  const doneToday = new Set<number>();
  if (habitIds.length) {
    const placeholders = habitIds.map(() => '?').join(',');
    const { rows: checkRows } = await db.execute({
      sql: `SELECT habit_id FROM habit_checks WHERE done = 1 AND date = ? AND habit_id IN (${placeholders})`,
      args: [date, ...habitIds],
    });
    for (const r of checkRows as unknown as Array<{ habit_id: number }>) doneToday.add(r.habit_id);
  }

  return habits.map((h) => {
    const days = h.days ? (h.days.split(',') as Weekday[]) : [];
    return {
      id: h.id,
      text: h.text,
      time: h.time,
      days,
      dueToday: days.length === 0 || days.includes(todayCode),
      doneToday: doneToday.has(h.id),
    };
  });
}

habitsRouter.get('/habits', async (req, res) => {
  res.json(await loadHabits(req.patientId!));
});

habitsRouter.get('/habits/week', async (req, res) => {
  res.json(await computeHabitsWeek(req.patientId!, todayStr()));
});

interface HabitItemBody { id?: unknown; text?: unknown; days?: unknown; time?: unknown }

// Salvataggio in blocco come /plan e /supplements/custom, ma preservando
// l'id: gli item con id vengono aggiornati sul posto, quelli senza sono
// nuovi, e chi resta fuori dalla lista viene cancellato insieme alle sue
// spunte storiche.
export async function saveHabitsList(patientId: number, input: HabitItemBody[]) {
  const clean = input
    .map((it) => ({
      id: typeof it?.id === 'number' ? it.id : undefined,
      text: String(it?.text ?? '').trim(),
      days: Array.isArray(it?.days) ? it.days.filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(String(d))) : [],
      time: /^\d{2}:\d{2}$/.test(String(it?.time)) ? String(it.time) : '',
    }))
    .filter((it) => it.text);

  const keepIds: number[] = [];
  for (const [idx, it] of clean.entries()) {
    const daysCsv = it.days.join(',');
    if (it.id !== undefined) {
      await db.execute({
        sql: 'UPDATE habits SET idx = ?, text = ?, time = ?, days = ? WHERE id = ? AND patient_id = ?',
        args: [idx, it.text, it.time, daysCsv, it.id, patientId],
      });
      keepIds.push(it.id);
    } else {
      const r = await db.execute({
        sql: 'INSERT INTO habits (patient_id, idx, text, time, days) VALUES (?, ?, ?, ?, ?)',
        args: [patientId, idx, it.text, it.time, daysCsv],
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
