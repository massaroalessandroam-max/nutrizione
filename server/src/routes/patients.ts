import { Router } from 'express';
import { db } from '../db.js';
import { LABEL, ORDER } from '../constants.js';
import { score, verdict } from '../match.js';

export const patientsRouter = Router();

interface PatientRow {
  id: string; name: string; initials: string; plan: string;
  adherence: string; tone: string; streak: number; last_meal_summary: string; last_time: string;
}

patientsRouter.get('/patients', (_req, res) => {
  const rows = db.prepare('SELECT * FROM patients ORDER BY name').all() as unknown as PatientRow[];
  res.json(
    rows.map((p) => ({
      id: p.id, name: p.name, initials: p.initials, adherence: p.adherence,
      tone: p.tone, last: p.last_meal_summary, time: p.last_time,
    }))
  );
});

patientsRouter.get('/patients/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id) as unknown as PatientRow | undefined;
  if (!p) return res.status(404).json({ error: 'not found' });

  const logRows = db
    .prepare('SELECT meal_key, time, foods FROM patient_meals WHERE patient_id = ?')
    .all(p.id) as Array<{ meal_key: string; time: string; foods: string }>;

  const log = ORDER.filter((k) => logRows.some((r) => r.meal_key === k)).map((k) => {
    const row = logRows.find((r) => r.meal_key === k)!;
    const foods: string[] = JSON.parse(row.foods);
    const sc = score(foods);
    return {
      key: k, label: LABEL[k], time: row.time, scoreLabel: sc.label, tone: sc.tone,
      foods: foods.map((f) => ({ name: f, verdict: verdict(f) })),
    };
  });

  const mealsToday = logRows.length;

  res.json({
    id: p.id, name: p.name, initials: p.initials, plan: p.plan,
    adherence: p.adherence, tone: p.tone, streak: p.streak, mealsToday, log,
  });
});
