import { Router } from 'express';
import { db, ensurePatientAppState } from '../db.js';
import { newAccessCode, hashAccessCode, newTempPassword, hashPassword, requireNutritionist } from '../auth.js';
import { buildState } from './state.js';
import { buildReport, buildMacros } from './report.js';
import { loadHabits } from './habits.js';
import { loadPlanItems, loadPlanNotes } from './plan.js';
import { loadMessages, addMessage } from './messages.js';

export const nutritionistRouter = Router();
nutritionistRouter.use(requireNutritionist);

interface PatientRow { id: number; name: string; created_at: string; next_visit_at: string; next_visit_note: string }

async function getPatientRow(id: number): Promise<PatientRow | undefined> {
  const { rows } = await db.execute({ sql: 'SELECT id, name, created_at, next_visit_at, next_visit_note FROM patients WHERE id = ?', args: [id] });
  return rows[0] as unknown as PatientRow | undefined;
}

// Pool condiviso: qualunque nutrizionista dello studio vede tutti i
// pazienti, non solo quelli che ha creato lui.
nutritionistRouter.get('/patients', async (_req, res) => {
  const { rows } = await db.execute('SELECT id, name, next_visit_at, next_visit_note FROM patients ORDER BY name');
  const list = await Promise.all((rows as unknown as PatientRow[]).map(async (p) => {
    const state = await buildState(p.id);
    return {
      id: p.id,
      name: p.name,
      onboarded: state.onboarded,
      adherencePct: state.adherencePct,
      streak: state.streak,
      points: state.points,
      nextVisitAt: p.next_visit_at,
      nextVisitNote: p.next_visit_note,
    };
  }));
  res.json(list);
});

nutritionistRouter.post('/patients', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'nome obbligatorio' });

  const code = newAccessCode();
  const result = await db.execute({
    sql: 'INSERT INTO patients (name, access_code_hash, created_at) VALUES (?, ?, ?)',
    args: [name, hashAccessCode(code), new Date().toISOString()],
  });
  const patientId = Number(result.lastInsertRowid);
  await ensurePatientAppState(patientId);

  // Il codice in chiaro si vede SOLO in questa risposta — dopo è solo hash.
  res.json({ id: patientId, name, accessCode: code });
});

nutritionistRouter.get('/patients/:id', async (req, res) => {
  const patientId = Number(req.params.id);
  const patient = await getPatientRow(patientId);
  if (!patient) return res.status(404).json({ error: 'paziente non trovato' });

  const [state, habits, planItems, planNotes] = await Promise.all([
    buildState(patientId),
    loadHabits(patientId),
    loadPlanItems(patientId),
    loadPlanNotes(patientId),
  ]);

  res.json({
    id: patient.id,
    name: patient.name,
    nextVisitAt: patient.next_visit_at,
    nextVisitNote: patient.next_visit_note,
    state,
    habits,
    plan: { items: planItems, notes: planNotes },
  });
});

nutritionistRouter.put('/patients/:id/next-visit', async (req, res) => {
  const patientId = Number(req.params.id);
  const nextVisitAt = typeof req.body?.nextVisitAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.nextVisitAt) ? req.body.nextVisitAt : '';
  const nextVisitNote = typeof req.body?.nextVisitNote === 'string' ? req.body.nextVisitNote.trim() : '';

  await db.execute({ sql: 'UPDATE patients SET next_visit_at = ?, next_visit_note = ? WHERE id = ?', args: [nextVisitAt, nextVisitNote, patientId] });
  res.json({ nextVisitAt, nextVisitNote });
});

// Il paziente perde il codice (o va dato a un nuovo telefono): ne genera
// uno nuovo, quello vecchio smette subito di funzionare. Le sessioni già
// aperte restano valide — rigenerare il codice non è un incidente di
// sicurezza, è solo "gliene serve uno nuovo per entrare la prima volta".
nutritionistRouter.post('/patients/:id/regenerate-code', async (req, res) => {
  const patientId = Number(req.params.id);
  const patient = await getPatientRow(patientId);
  if (!patient) return res.status(404).json({ error: 'paziente non trovato' });

  const code = newAccessCode();
  await db.execute({ sql: 'UPDATE patients SET access_code_hash = ? WHERE id = ?', args: [hashAccessCode(code), patientId] });
  res.json({ accessCode: code });
});

nutritionistRouter.get('/patients/:id/report', async (req, res) => {
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'intervallo non valido' });
  }
  res.json(await buildReport(Number(req.params.id), from, to));
});

nutritionistRouter.get('/patients/:id/report/macros', async (req, res) => {
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'intervallo non valido' });
  }
  res.json(await buildMacros(Number(req.params.id), from, to));
});

nutritionistRouter.get('/patients/:id/messages', async (req, res) => {
  res.json(await loadMessages(Number(req.params.id)));
});

nutritionistRouter.post('/patients/:id/messages', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'testo mancante' });
  res.json(await addMessage(Number(req.params.id), 'nutrizionista', text));
});

// Colleghi dello studio — per poter reimpostare la password di uno di loro
// se la dimentica (non c'è un servizio email per il classico link di reset:
// se sei fuori non puoi chiederlo da solo, deve farlo un collega già dentro).
nutritionistRouter.get('/team', async (_req, res) => {
  const { rows } = await db.execute('SELECT id, name, email, created_at FROM nutritionists ORDER BY name');
  res.json((rows as any[]).map((r) => ({ id: r.id, name: r.name, email: r.email, createdAt: r.created_at })));
});

nutritionistRouter.post('/team/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await db.execute({ sql: 'SELECT id FROM nutritionists WHERE id = ?', args: [id] });
  if (!rows[0]) return res.status(404).json({ error: 'nutrizionista non trovato' });

  const password = newTempPassword();
  await db.execute({ sql: 'UPDATE nutritionists SET password_hash = ? WHERE id = ?', args: [hashPassword(password), id] });
  // Un reset password è più sensibile di un codice paziente perso: chiude
  // le sessioni già aperte, non solo quelle future.
  await db.execute({ sql: 'DELETE FROM nutritionist_sessions WHERE nutritionist_id = ?', args: [id] });

  res.json({ password });
});
