import { Router } from 'express';
import { db, ensurePatientAppState } from '../db.js';
import { newAccessCode, hashAccessCode, newTempPassword, hashPassword, requireNutritionist } from '../auth.js';
import { buildState } from './state.js';
import { buildReport, buildMacros } from './report.js';
import { loadHabits } from './habits.js';
import { loadPlanItems, loadPlanNotes } from './plan.js';
import { loadMessages, addMessage, markMessagesRead } from './messages.js';

export const nutritionistRouter = Router();
nutritionistRouter.use(requireNutritionist);

interface PatientRow { id: number; name: string; created_at: string; next_visit_at: string; next_visit_note: string; owner_id: number | null }

async function getPatientRow(id: number): Promise<PatientRow | undefined> {
  const { rows } = await db.execute({ sql: 'SELECT id, name, created_at, next_visit_at, next_visit_note, owner_id FROM patients WHERE id = ?', args: [id] });
  return rows[0] as unknown as PatientRow | undefined;
}

async function ownerNames(): Promise<Map<number, string>> {
  const { rows } = await db.execute('SELECT id, name FROM nutritionists');
  return new Map((rows as any[]).map((r) => [r.id as number, r.name as string]));
}

// Pool condiviso: qualunque nutrizionista dello studio vede tutti i
// pazienti, non solo quelli che ha creato lui — l'owner_id (titolare del
// rapporto) è solo un'etichetta per sapere di chi è, non limita l'accesso:
// se il titolare è assente, chiunque in team vede comunque i messaggi e può
// rispondere. Ordine di default pensato per il triage: prima chi ha uno
// scambio di messaggi aperto (c'è probabilmente qualcosa da seguire), poi
// per aderenza crescente — così chi segue meno il piano si vede subito,
// senza dover ordinare a mano.
nutritionistRouter.get('/patients', async (_req, res) => {
  const { rows } = await db.execute('SELECT id, name, next_visit_at, next_visit_note, owner_id FROM patients');
  const { rows: messageCounts } = await db.execute('SELECT patient_id, COUNT(*) as n FROM messages GROUP BY patient_id');
  const patientsWithMessages = new Set((messageCounts as any[]).map((r) => r.patient_id as number));
  const owners = await ownerNames();

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
      hasMessages: patientsWithMessages.has(p.id),
      ownerId: p.owner_id,
      ownerName: p.owner_id ? owners.get(p.owner_id) ?? '' : '',
    };
  }));

  list.sort((a, b) => (Number(b.hasMessages) - Number(a.hasMessages)) || (a.adherencePct - b.adherencePct));
  res.json(list);
});

nutritionistRouter.post('/patients', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'nome obbligatorio' });

  const code = newAccessCode();
  // Chi crea il paziente ne diventa titolare di default — riassegnabile
  // dopo dal dettaglio paziente.
  const result = await db.execute({
    sql: 'INSERT INTO patients (name, access_code_hash, created_at, owner_id) VALUES (?, ?, ?, ?)',
    args: [name, hashAccessCode(code), new Date().toISOString(), req.nutritionistId!],
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

  const [state, habits, planItems, planNotes, owners] = await Promise.all([
    buildState(patientId),
    loadHabits(patientId),
    loadPlanItems(patientId),
    loadPlanNotes(patientId),
    ownerNames(),
  ]);

  res.json({
    id: patient.id,
    name: patient.name,
    nextVisitAt: patient.next_visit_at,
    nextVisitNote: patient.next_visit_note,
    ownerId: patient.owner_id,
    ownerName: patient.owner_id ? owners.get(patient.owner_id) ?? '' : '',
    state,
    habits,
    plan: { items: planItems, notes: planNotes },
  });
});

// Riassegna il titolare del rapporto (o lo rimuove con nutritionistId null)
// — sola etichetta, non tocca la visibilità: il pool resta condiviso.
nutritionistRouter.put('/patients/:id/owner', async (req, res) => {
  const patientId = Number(req.params.id);
  const patient = await getPatientRow(patientId);
  if (!patient) return res.status(404).json({ error: 'paziente non trovato' });

  const nutritionistId = req.body?.nutritionistId;
  let ownerId: number | null = null;
  if (nutritionistId !== null && nutritionistId !== undefined) {
    const id = Number(nutritionistId);
    const { rows } = await db.execute({ sql: 'SELECT id FROM nutritionists WHERE id = ?', args: [id] });
    if (!rows[0]) return res.status(400).json({ error: 'nutrizionista non trovato' });
    ownerId = id;
  }

  await db.execute({ sql: 'UPDATE patients SET owner_id = ? WHERE id = ?', args: [ownerId, patientId] });
  const owners = await ownerNames();
  res.json({ ownerId, ownerName: ownerId ? owners.get(ownerId) ?? '' : '' });
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
  const patientId = Number(req.params.id);
  const list = await loadMessages(patientId);
  await markMessagesRead(patientId, 'nutrizionista');
  res.json(list);
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

// Aderenza di ogni paziente nel periodo, col relativo titolare — il client
// aggrega/filtra per nutrizionista da qui, non serve un parametro dedicato:
// stessa aderenza-nel-periodo già calcolata per il report del singolo
// paziente (buildReport), solo estesa a tutto lo studio in un colpo solo.
nutritionistRouter.get('/dashboard', async (req, res) => {
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'intervallo non valido' });
  }

  const { rows } = await db.execute('SELECT id, name, owner_id FROM patients');
  const patients = rows as unknown as Array<{ id: number; name: string; owner_id: number | null }>;
  const owners = await ownerNames();

  // Quanto scrive il paziente nel periodo — un indicatore di quanto sta
  // seguendo/chiedendo supporto, utile accanto all'aderenza. date() legge
  // anche gli ISO datetime salvati in created_at, non solo date pure.
  const { rows: messageRows } = await db.execute({
    sql: `SELECT patient_id, COUNT(*) as n FROM messages WHERE sender = 'paziente' AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY patient_id`,
    args: [from, to],
  });
  const messageCounts = new Map((messageRows as any[]).map((r) => [r.patient_id as number, r.n as number]));

  const list = await Promise.all(patients.map(async (p) => {
    const report = await buildReport(p.id, from, to);
    return {
      id: p.id,
      name: p.name,
      ownerId: p.owner_id,
      ownerName: p.owner_id ? owners.get(p.owner_id) ?? '' : '',
      adherencePct: report.adherencePct,
      totalMeals: report.totalMeals,
      messagesFromPatient: messageCounts.get(p.id) ?? 0,
    };
  }));

  res.json({ from, to, patients: list });
});
