import { Router } from 'express';
import { db } from '../db.js';
import { isMealKey } from '../constants.js';
import { requirePatient } from '../auth.js';

export const chefRouter = Router();
chefRouter.use(requirePatient);

const VALID_DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

interface SlotBody { category?: unknown; name?: unknown; quantity?: unknown }

function cleanSlots(input: unknown) {
  if (!Array.isArray(input)) return [];
  return (input as SlotBody[])
    .map((s) => ({
      category: String(s?.category ?? '').trim(),
      name: String(s?.name ?? '').trim(),
      quantity: String(s?.quantity ?? '').trim(),
    }))
    .filter((s) => s.name && s.category);
}

function cleanDays(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((d) => VALID_DAYS.includes(d));
}

async function allCombos(patientId: number) {
  const { rows } = await db.execute({ sql: 'SELECT id, meal_key, days, slots FROM chef_combos WHERE patient_id = ? ORDER BY id', args: [patientId] });
  return (rows as any[]).map((r) => ({
    id: r.id, mealKey: r.meal_key, days: JSON.parse(r.days), slots: JSON.parse(r.slots),
  }));
}

chefRouter.get('/chef/combos', async (req, res) => {
  res.json(await allCombos(req.patientId!));
});

// Upsert: con id valido aggiorna la combo esistente, altrimenti ne crea una
// nuova — "modifica" e "salva" sono la stessa azione lato client.
chefRouter.post('/chef/combos', async (req, res) => {
  const patientId = req.patientId!;
  const mealKey = String(req.body?.mealKey ?? '');
  if (!isMealKey(mealKey)) return res.status(400).json({ error: 'pasto non valido' });

  const days = cleanDays(req.body?.days);
  const slots = cleanSlots(req.body?.slots);
  if (!days.length || !slots.length) return res.status(400).json({ error: 'giorni o alimenti mancanti' });

  const id = Number(req.body?.id);
  let savedId = id;
  if (Number.isInteger(id) && id > 0) {
    await db.execute({
      sql: 'UPDATE chef_combos SET meal_key = ?, days = ?, slots = ? WHERE id = ? AND patient_id = ?',
      args: [mealKey, JSON.stringify(days), JSON.stringify(slots), id, patientId],
    });
  } else {
    const result = await db.execute({
      sql: 'INSERT INTO chef_combos (patient_id, meal_key, days, slots) VALUES (?, ?, ?, ?)',
      args: [patientId, mealKey, JSON.stringify(days), JSON.stringify(slots)],
    });
    savedId = Number(result.lastInsertRowid);
  }

  res.json({ id: savedId, combos: await allCombos(patientId) });
});

chefRouter.delete('/chef/combos/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM chef_combos WHERE id = ? AND patient_id = ?', args: [req.params.id, req.patientId!] });
  res.json(await allCombos(req.patientId!));
});
