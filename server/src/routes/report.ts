import { Router } from 'express';
import { db } from '../db.js';
import { LABEL, type MealKey } from '../constants.js';
import { score, verdict } from '../match.js';

export const reportRouter = Router();

async function loadPlanFoods(): Promise<string[]> {
  const { rows } = await db.execute('SELECT name FROM nutrition_plan_items');
  return (rows as any[]).map((r) => r.name as string);
}

// Date (YYYY-MM-DD) del mese dato con almeno un pasto registrato — per
// colorare il calendario senza scaricare tutti i pasti.
reportRouter.get('/report/activity', async (req, res) => {
  const month = String(req.query.month ?? '');
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'mese non valido' });

  const { rows } = await db.execute({
    sql: 'SELECT DISTINCT date FROM meals WHERE done = 1 AND date LIKE ?',
    args: [`${month}-%`],
  });
  res.json((rows as any[]).map((r) => r.date as string));
});

// Report su un intervallo di date (una o più settimane, un mese, un anno):
// tutti i pasti fatti raggruppati per giorno, con verdetto e aderenza
// aggregata sull'intero periodo.
reportRouter.get('/report', async (req, res) => {
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'intervallo non valido' });
  }

  const { rows } = await db.execute({
    sql: 'SELECT date, meal_key, foods, time FROM meals WHERE done = 1 AND date >= ? AND date <= ? ORDER BY date, meal_key',
    args: [from, to],
  });
  const planFoods = await loadPlanFoods();

  const byDate = new Map<string, any[]>();
  for (const r of rows as any[]) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date)!.push(r);
  }

  let totalFoods = 0;
  let goodFoods = 0;
  let totalMeals = 0;

  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, mealRows]) => {
      // Mese del giorno stesso (non quello di oggi), per la stagionalità
      // frutta/verdura corretta su un report che copre più mesi.
      const ctx = { planFoods, month: Number(date.slice(5, 7)) };
      const meals = mealRows.map((r) => {
        const foods: string[] = JSON.parse(r.foods);
        const key = r.meal_key as MealKey;
        const sc = score(foods, ctx);
        totalMeals += 1;
        totalFoods += foods.length;
        goodFoods += foods.filter((f) => verdict(f, ctx) === 'good').length;
        return { key, label: LABEL[key], time: r.time as string, foods, scoreLabel: sc.label, tone: sc.tone };
      });
      return { date, meals };
    });

  const adherencePct = totalFoods > 0 ? Math.round((goodFoods / totalFoods) * 100) : 0;

  res.json({ from, to, days, totalMeals, adherencePct });
});
