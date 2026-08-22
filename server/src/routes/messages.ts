import { Router } from 'express';
import { db } from '../db.js';
import { requirePatient } from '../auth.js';

export const messagesRouter = Router();
messagesRouter.use(requirePatient);

// Il mittente lato studio è "nutrizionista" in generale, non tracciamo
// quale singolo nutrizionista ha scritto (i pazienti sono visibili a tutto
// lo studio, nessuna vista distingue i colleghi tra loro per ora).
export async function loadMessages(patientId: number) {
  const { rows } = await db.execute({
    sql: 'SELECT id, sender, text, created_at FROM messages WHERE patient_id = ? ORDER BY id',
    args: [patientId],
  });
  return (rows as any[]).map((r) => ({ id: r.id, sender: r.sender, text: r.text, createdAt: r.created_at }));
}

export async function addMessage(patientId: number, sender: 'paziente' | 'nutrizionista', text: string) {
  await db.execute({
    sql: 'INSERT INTO messages (patient_id, sender, text, created_at) VALUES (?, ?, ?, ?)',
    args: [patientId, sender, text, new Date().toISOString()],
  });
  return loadMessages(patientId);
}

messagesRouter.get('/messages', async (req, res) => {
  res.json(await loadMessages(req.patientId!));
});

messagesRouter.post('/messages', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'testo mancante' });
  res.json(await addMessage(req.patientId!, 'paziente', text));
});
