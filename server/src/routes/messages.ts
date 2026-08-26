import { Router } from 'express';
import { db } from '../db.js';
import { requirePatient } from '../auth.js';
import { addEvent } from '../events.js';

export const messagesRouter = Router();
messagesRouter.use(requirePatient);

type Sender = 'paziente' | 'nutrizionista';

// Chi ha scritto l'ultimo messaggio non ha bisogno di "leggerlo" — il non
// letto riguarda solo i messaggi dell'ALTRA parte.
function otherSender(viewer: Sender): Sender {
  return viewer === 'paziente' ? 'nutrizionista' : 'paziente';
}

// Il mittente lato studio è "nutrizionista" in generale, non tracciamo
// quale singolo nutrizionista ha scritto (i pazienti sono visibili a tutto
// lo studio, nessuna vista distingue i colleghi tra loro per ora).
export async function loadMessages(patientId: number) {
  const { rows } = await db.execute({
    sql: 'SELECT id, sender, text, created_at, read FROM messages WHERE patient_id = ? ORDER BY id',
    args: [patientId],
  });
  return (rows as any[]).map((r) => ({ id: r.id, sender: r.sender, text: r.text, createdAt: r.created_at, read: !!r.read }));
}

export async function addMessage(patientId: number, sender: Sender, text: string) {
  await db.execute({
    sql: 'INSERT INTO messages (patient_id, sender, text, created_at, read) VALUES (?, ?, ?, ?, 0)',
    args: [patientId, sender, text, new Date().toISOString()],
  });
  return loadMessages(patientId);
}

// Chiamata quando `viewer` apre il thread: i messaggi dell'altra parte
// diventano "letti" — è questo che spegne il pallino di notifica.
export async function markMessagesRead(patientId: number, viewer: Sender): Promise<void> {
  await db.execute({
    sql: 'UPDATE messages SET read = 1 WHERE patient_id = ? AND sender = ? AND read = 0',
    args: [patientId, otherSender(viewer)],
  });
}

export async function hasUnreadMessages(patientId: number, viewer: Sender): Promise<boolean> {
  const { rows } = await db.execute({
    sql: 'SELECT 1 FROM messages WHERE patient_id = ? AND sender = ? AND read = 0 LIMIT 1',
    args: [patientId, otherSender(viewer)],
  });
  return rows.length > 0;
}

messagesRouter.get('/messages', async (req, res) => {
  const list = await loadMessages(req.patientId!);
  await markMessagesRead(req.patientId!, 'paziente');
  res.json(list);
});

messagesRouter.post('/messages', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'testo mancante' });
  const list = await addMessage(req.patientId!, 'paziente', text);
  await addEvent(req.patientId!, 'message_from_patient', 'Ha scritto un nuovo messaggio');
  res.json(list);
});
