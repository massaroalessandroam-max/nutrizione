import { Router } from 'express';
import { db } from '../db.js';

export const planRouter = Router();

interface PlanItemBody {
  name?: unknown;
  quantity?: unknown;
}

function cleanItems(input: unknown): Array<{ name: string; quantity: string }> {
  if (!Array.isArray(input)) return [];
  return (input as PlanItemBody[])
    .map((it) => ({ name: String(it?.name ?? '').trim(), quantity: String(it?.quantity ?? '').trim() }))
    .filter((it) => it.name);
}

planRouter.get('/plan', async (_req, res) => {
  const { rows } = await db.execute('SELECT name, quantity FROM nutrition_plan_items ORDER BY idx');
  res.json((rows as any[]).map((r) => ({ name: r.name, quantity: r.quantity })));
});

planRouter.post('/plan', async (req, res) => {
  const items = cleanItems(req.body?.items);

  await db.execute('DELETE FROM nutrition_plan_items');
  for (const [idx, it] of items.entries()) {
    await db.execute({
      sql: 'INSERT INTO nutrition_plan_items (idx, name, quantity) VALUES (?, ?, ?)',
      args: [idx, it.name, it.quantity],
    });
  }

  res.json(items);
});
