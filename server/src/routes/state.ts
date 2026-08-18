import { Router } from 'express';
import { db } from '../db.js';
import { ORDER, LABEL, isMealKey, type MealKey } from '../constants.js';
import { score, verdict, pointsForFoods } from '../match.js';
import { computeStreak, computeWeek, computeBadges } from '../stats.js';

export const stateRouter = Router();

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadMeals(date: string) {
  const { rows } = await db.execute({
    sql: 'SELECT meal_key, done, foods, time FROM meals WHERE date = ?',
    args: [date],
  });
  const byKey = new Map((rows as any[]).map((r) => [r.meal_key, r]));
  const meals: Record<MealKey, { done: boolean; foods: string[]; time: string }> = {} as any;
  for (const key of ORDER) {
    const row = byKey.get(key) as any;
    meals[key] = row
      ? { done: !!row.done, foods: JSON.parse(row.foods), time: row.time }
      : { done: false, foods: [], time: '' };
  }
  return meals;
}

export async function buildState() {
  const date = todayStr();
  const { rows } = await db.execute('SELECT * FROM app_state WHERE id = 1');
  const appState = rows[0] as any;
  const meals = await loadMeals(date);

  const doneCount = ORDER.filter((k) => meals[k].done).length;
  const allFoods = ORDER.flatMap((k) => meals[k].foods);
  const goodCount = allFoods.filter((f) => verdict(f) === 'good').length;
  const adherence = allFoods.length ? Math.round((goodCount / allFoods.length) * 100) : 0;

  const mealsOut = Object.fromEntries(
    ORDER.map((k) => {
      const m = meals[k];
      const sc = score(m.foods);
      return [k, { ...m, label: LABEL[k], scoreLabel: sc.label, tone: sc.tone }];
    })
  );

  const streak = await computeStreak(date);

  return {
    date,
    points: appState.points as number,
    streak,
    freq: appState.freq as string,
    fastActive: !!appState.fast_active,
    fastStart: appState.fast_start as number,
    greetingName: appState.greeting_name as string,
    doneCount,
    adherencePct: adherence,
    meals: mealsOut,
    week: await computeWeek(date),
    badges: await computeBadges(streak),
  };
}

stateRouter.get('/state', async (_req, res) => {
  res.json(await buildState());
});

stateRouter.put('/settings/freq', async (req, res) => {
  const { freq } = req.body ?? {};
  if (!['meal', 'multi', 'day', 'manual'].includes(freq)) {
    return res.status(400).json({ error: 'invalid freq' });
  }
  await db.execute({ sql: 'UPDATE app_state SET freq = ? WHERE id = 1', args: [freq] });
  res.json(await buildState());
});

stateRouter.post('/fast/toggle', async (_req, res) => {
  const { rows } = await db.execute('SELECT fast_active, fast_start FROM app_state WHERE id = 1');
  const appState = rows[0] as any;
  const nowActive = !appState.fast_active;
  const fastStart = nowActive ? Date.now() : appState.fast_start;
  await db.execute({
    sql: 'UPDATE app_state SET fast_active = ?, fast_start = ? WHERE id = 1',
    args: [nowActive ? 1 : 0, fastStart],
  });
  res.json(await buildState());
});

stateRouter.post('/meals/:key/log', async (req, res) => {
  const { key } = req.params;
  if (!isMealKey(key)) return res.status(400).json({ error: 'invalid meal key' });
  const foods: string[] = Array.isArray(req.body?.foods)
    ? req.body.foods.map((f: unknown) => String(f).trim()).filter(Boolean)
    : [];
  if (!foods.length) return res.status(400).json({ error: 'no foods provided' });

  const date = todayStr();
  const time = new Date().toTimeString().slice(0, 5);
  await db.execute({
    sql: `INSERT INTO meals (date, meal_key, done, foods, time) VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(date, meal_key) DO UPDATE SET done = 1, foods = excluded.foods, time = excluded.time`,
    args: [date, key, JSON.stringify(foods), time],
  });

  const pts = pointsForFoods(foods);
  await db.execute({ sql: 'UPDATE app_state SET points = points + ? WHERE id = 1', args: [pts] });

  const sc = score(foods);
  const summary = {
    key,
    label: LABEL[key],
    foods: foods.map((f) => ({ name: f, verdict: verdict(f) })),
    score: sc,
    pointsEarned: pts,
  };

  res.json({ state: await buildState(), summary });
});
