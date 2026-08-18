import { Router } from 'express';
import { db } from '../db.js';
import { buildState, DEFAULT_MEAL_TIME, FIXED_SCHEDULE_MEALS } from './state.js';

export const onboardingRouter = Router();

onboardingRouter.post('/onboarding', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });

  const scheduleIn = (req.body?.schedule ?? {}) as Record<string, { enabled?: boolean; time?: string }>;
  for (const key of FIXED_SCHEDULE_MEALS) {
    const entry = scheduleIn[key] ?? {};
    const enabled = entry.enabled !== false;
    const time = typeof entry.time === 'string' && entry.time ? entry.time : DEFAULT_MEAL_TIME[key];
    await db.execute({
      sql: `INSERT INTO meal_schedule (meal_key, enabled, time) VALUES (?, ?, ?)
            ON CONFLICT(meal_key) DO UPDATE SET enabled = excluded.enabled, time = excluded.time`,
      args: [key, enabled ? 1 : 0, time],
    });
  }

  const snacks: string[] = Array.isArray(req.body?.snacks)
    ? req.body.snacks.map((t: unknown) => String(t).trim()).filter(Boolean)
    : [];
  await db.execute('DELETE FROM snack_schedule');
  for (const [idx, time] of snacks.entries()) {
    await db.execute({ sql: 'INSERT INTO snack_schedule (idx, time) VALUES (?, ?)', args: [idx, time] });
  }

  const fasting = req.body?.fasting ?? {};
  const fastingEnabled = fasting.enabled === true;
  const fastingStart = typeof fasting.start === 'string' ? fasting.start : '';
  const fastingEnd = typeof fasting.end === 'string' ? fasting.end : '';

  await db.execute({
    sql: `UPDATE app_state
          SET greeting_name = ?, onboarded = 1,
              fast_pref_enabled = ?, fast_pref_start = ?, fast_pref_end = ?
          WHERE id = 1`,
    args: [name, fastingEnabled ? 1 : 0, fastingStart, fastingEnd],
  });

  res.json(await buildState());
});
