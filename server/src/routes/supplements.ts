import { Router } from 'express';
import { db } from '../db.js';
import { romeParts, todayStr } from '../time.js';
import { SUPPLEMENT_CATALOG } from '../supplementCatalog.js';

export const supplementsRouter = Router();

supplementsRouter.get('/supplements/catalog', (_req, res) => {
  res.json(SUPPLEMENT_CATALOG);
});

supplementsRouter.get('/supplements/custom', async (_req, res) => {
  const { rows } = await db.execute('SELECT name, dosage FROM patient_supplements ORDER BY idx');
  res.json((rows as any[]).map((r) => ({ name: r.name, dosage: r.dosage })));
});

// Sostituzione in blocco, stesso pattern di POST /plan.
supplementsRouter.post('/supplements/custom', async (req, res) => {
  const input = Array.isArray(req.body?.items) ? req.body.items : [];
  const clean = (input as Array<{ name?: unknown; dosage?: unknown }>)
    .map((it) => ({ name: String(it?.name ?? '').trim(), dosage: String(it?.dosage ?? '').trim() }))
    .filter((it) => it.name);

  await db.execute('DELETE FROM patient_supplements');
  for (const [idx, it] of clean.entries()) {
    await db.execute({
      sql: 'INSERT INTO patient_supplements (idx, name, dosage) VALUES (?, ?, ?)',
      args: [idx, it.name, it.dosage],
    });
  }
  res.json(clean);
});

async function todayLog() {
  const { rows } = await db.execute({
    sql: 'SELECT id, name, quantity, time FROM supplement_logs WHERE date = ? ORDER BY time, id',
    args: [todayStr()],
  });
  return (rows as any[]).map((r) => ({ id: r.id, name: r.name, quantity: r.quantity, time: r.time }));
}

supplementsRouter.get('/supplements/log', async (_req, res) => {
  res.json(await todayLog());
});

// A differenza dei pasti l'orario è scelto dal paziente (può registrare a
// posteriori "l'ho preso stamattina"), quindi qui il client lo manda e il
// server non lo sovrascrive — cade solo sull'ora corrente se manca/non valido.
supplementsRouter.post('/supplements/log', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'nome mancante' });
  const quantity = String(req.body?.quantity ?? '').trim();
  const time = /^\d{2}:\d{2}$/.test(req.body?.time) ? req.body.time : romeParts().time;

  await db.execute({
    sql: 'INSERT INTO supplement_logs (date, name, quantity, time) VALUES (?, ?, ?, ?)',
    args: [todayStr(), name, quantity, time],
  });
  res.json(await todayLog());
});

supplementsRouter.delete('/supplements/log/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM supplement_logs WHERE id = ? AND date = ?', args: [req.params.id, todayStr()] });
  res.json(await todayLog());
});
