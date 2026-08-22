import { Router } from 'express';
import { db } from '../db.js';
import { romeParts, todayStr } from '../time.js';
import { SUPPLEMENT_CATALOG } from '../supplementCatalog.js';
import { requirePatient } from '../auth.js';

export const supplementsRouter = Router();
supplementsRouter.use(requirePatient);

supplementsRouter.get('/supplements/catalog', (_req, res) => {
  res.json(SUPPLEMENT_CATALOG);
});

supplementsRouter.get('/supplements/custom', async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT name, dosage FROM patient_supplements WHERE patient_id = ? ORDER BY idx', args: [req.patientId!] });
  res.json((rows as any[]).map((r) => ({ name: r.name, dosage: r.dosage })));
});

// Sostituzione in blocco, stesso pattern di POST /plan.
supplementsRouter.post('/supplements/custom', async (req, res) => {
  const patientId = req.patientId!;
  const input = Array.isArray(req.body?.items) ? req.body.items : [];
  const clean = (input as Array<{ name?: unknown; dosage?: unknown }>)
    .map((it) => ({ name: String(it?.name ?? '').trim(), dosage: String(it?.dosage ?? '').trim() }))
    .filter((it) => it.name);

  await db.execute({ sql: 'DELETE FROM patient_supplements WHERE patient_id = ?', args: [patientId] });
  for (const [idx, it] of clean.entries()) {
    await db.execute({
      sql: 'INSERT INTO patient_supplements (patient_id, idx, name, dosage) VALUES (?, ?, ?, ?)',
      args: [patientId, idx, it.name, it.dosage],
    });
  }
  res.json(clean);
});

async function todayLog(patientId: number) {
  const { rows } = await db.execute({
    sql: 'SELECT id, name, quantity, time FROM supplement_logs WHERE patient_id = ? AND date = ? ORDER BY time, id',
    args: [patientId, todayStr()],
  });
  return (rows as any[]).map((r) => ({ id: r.id, name: r.name, quantity: r.quantity, time: r.time }));
}

supplementsRouter.get('/supplements/log', async (req, res) => {
  res.json(await todayLog(req.patientId!));
});

// A differenza dei pasti l'orario è scelto dal paziente (può registrare a
// posteriori "l'ho preso stamattina"), quindi qui il client lo manda e il
// server non lo sovrascrive — cade solo sull'ora corrente se manca/non valido.
supplementsRouter.post('/supplements/log', async (req, res) => {
  const patientId = req.patientId!;
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'nome mancante' });
  const quantity = String(req.body?.quantity ?? '').trim();
  const time = /^\d{2}:\d{2}$/.test(req.body?.time) ? req.body.time : romeParts().time;

  await db.execute({
    sql: 'INSERT INTO supplement_logs (patient_id, date, name, quantity, time) VALUES (?, ?, ?, ?, ?)',
    args: [patientId, todayStr(), name, quantity, time],
  });
  res.json(await todayLog(patientId));
});

supplementsRouter.delete('/supplements/log/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM supplement_logs WHERE id = ? AND patient_id = ? AND date = ?', args: [req.params.id, req.patientId!, todayStr()] });
  res.json(await todayLog(req.patientId!));
});
