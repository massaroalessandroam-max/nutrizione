import { Router } from 'express';
import { db, ensurePatientAppState } from '../db.js';
import { newAccessCode, hashAccessCode, newTempPassword, hashPassword, requireNutritionist } from '../auth.js';
import { buildState } from './state.js';
import { buildReport, buildMacros, shiftDate } from './report.js';
import { loadHabits } from './habits.js';
import { loadPlanItems, loadPlanNotes, savePlanItems } from './plan.js';
import { loadMessages, addMessage, markMessagesRead } from './messages.js';
import { addAppointment, deleteAppointment } from './appointments.js';
import { GOAL_LEVELS, addGoal, deleteGoal, type GoalLevel } from './goals.js';
import { addEvent, loadRecentActivity } from '../events.js';
import { listBodyParts, listExercises } from './exercises.js';
import { createPlan, deletePlan, loadPlans, loadProgress, loadWorkouts, updatePlan } from './workouts.js';

export const nutritionistRouter = Router();
nutritionistRouter.use(requireNutritionist);

interface PatientRow { id: number; name: string; created_at: string; owner_id: number | null }

async function getPatientRow(id: number): Promise<PatientRow | undefined> {
  const { rows } = await db.execute({ sql: 'SELECT id, name, created_at, owner_id FROM patients WHERE id = ?', args: [id] });
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
  const { rows } = await db.execute('SELECT id, name, owner_id FROM patients');
  const { rows: messageCounts } = await db.execute('SELECT patient_id, COUNT(*) as n FROM messages GROUP BY patient_id');
  const patientsWithMessages = new Set((messageCounts as any[]).map((r) => r.patient_id as number));
  const owners = await ownerNames();
  const today = new Date().toISOString().slice(0, 10);

  const list = await Promise.all((rows as unknown as PatientRow[]).map(async (p) => {
    const state = await buildState(p.id);
    // Solo il prossimo, per la riga compatta della lista — lo storico
    // completo si vede aprendo il dettaglio.
    const nextAppointment = state.appointments.find((a) => a.at >= today);
    return {
      id: p.id,
      name: p.name,
      onboarded: state.onboarded,
      adherencePct: state.adherencePct,
      streak: state.streak,
      points: state.points,
      nextVisitAt: nextAppointment?.at ?? '',
      nextVisitNote: nextAppointment?.note ?? '',
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
  await addEvent(patientId, 'patient_created', 'Nuovo paziente aggiunto');

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

// Storico appuntamenti (passati e futuri) — non un singolo campo
// sovrascrivibile: il nutrizionista può accumularne più di uno nel tempo.
nutritionistRouter.post('/patients/:id/appointments', async (req, res) => {
  const patientId = Number(req.params.id);
  const at = String(req.body?.at ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return res.status(400).json({ error: 'data non valida' });
  const note = String(req.body?.note ?? '').trim();
  const list = await addAppointment(patientId, at, note);
  await addEvent(patientId, 'appointment_created', `Nuovo appuntamento fissato per il ${at}`);
  res.json(list);
});

nutritionistRouter.delete('/patients/:id/appointments/:appointmentId', async (req, res) => {
  const patientId = Number(req.params.id);
  const appointmentId = Number(req.params.appointmentId);
  res.json(await deleteAppointment(patientId, appointmentId));
});

// Obiettivi macro (lungo termine) e micro (breve termine) — testo libero
// scelto dal nutrizionista ("perdere 30kg in un anno", "correre una
// maratona in 4 ore"...) con una scadenza, non un valore numerico da
// tracciare.
nutritionistRouter.post('/patients/:id/goals', async (req, res) => {
  const patientId = Number(req.params.id);
  const level = String(req.body?.level ?? '') as GoalLevel;
  if (!(GOAL_LEVELS as readonly string[]).includes(level)) return res.status(400).json({ error: 'livello non valido' });
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'testo obbligatorio' });
  const targetDate = String(req.body?.targetDate ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return res.status(400).json({ error: 'scadenza non valida' });
  res.json(await addGoal(patientId, level, text, targetDate));
});

nutritionistRouter.delete('/patients/:id/goals/:goalId', async (req, res) => {
  const patientId = Number(req.params.id);
  const goalId = Number(req.params.goalId);
  res.json(await deleteGoal(patientId, goalId));
});

// Allenamento: il nutrizionista crea/elimina schede per il paziente e ne
// legge allenamenti e progressi (li registra solo il paziente). Le schede
// sono le stesse del paziente, con createdBy='nutritionist'.
nutritionistRouter.get('/exercises/bodyparts', listBodyParts);
nutritionistRouter.get('/exercises', listExercises);

nutritionistRouter.get('/patients/:id/training', async (req, res) => {
  const patientId = Number(req.params.id);
  const [plans, workouts, progress] = await Promise.all([loadPlans(patientId), loadWorkouts(patientId), loadProgress(patientId)]);
  res.json({ plans, workouts, progress });
});

nutritionistRouter.post('/patients/:id/workout-plans', async (req, res) => {
  const result = await createPlan(Number(req.params.id), 'nutritionist', req.body);
  if (typeof result === 'string') return res.status(400).json({ error: result });
  res.json(result);
});

nutritionistRouter.put('/patients/:id/workout-plans/:planId', async (req, res) => {
  const result = await updatePlan(Number(req.params.id), Number(req.params.planId), req.body);
  if (typeof result === 'string') return res.status(result === 'scheda non trovata' ? 404 : 400).json({ error: result });
  res.json(result);
});

nutritionistRouter.delete('/patients/:id/workout-plans/:planId', async (req, res) => {
  res.json(await deletePlan(Number(req.params.id), Number(req.params.planId)));
});

// Stesso piano del paziente (nutrition_plan_items): entrambi possono
// aggiungere/modificare/cancellare voci, non è una copia separata.
nutritionistRouter.put('/patients/:id/plan', async (req, res) => {
  const patientId = Number(req.params.id);
  res.json(await savePlanItems(patientId, req.body?.items));
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

// Spezza [from,to] in bucket settimanali (ultimo bucket accorciato se il
// resto non è multiplo di 7) per il grafico "Andamento Aderenza Globale":
// stessa buildReport già usata per la finestra singola, solo chiamata una
// volta per paziente per bucket invece che una volta sola sull'intervallo.
export function splitIntoWeeklyBuckets(from: string, to: string): Array<{ from: string; to: string }> {
  const buckets: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const end = shiftDate(cursor, 6);
    buckets.push({ from: cursor, to: end > to ? to : end });
    cursor = shiftDate(cursor, 7);
  }
  return buckets;
}

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

  // ponytail: nessuna cache — O(pazienti × bucket settimanali) chiamate
  // sequenziali a buildReport, accettabile alla scala di uno studio; da
  // rivedere (memoizzazione o tabella aderenza-giornaliera materializzata)
  // se il numero di pazienti o l'ampiezza del range crescono molto.
  const trend = await Promise.all(splitIntoWeeklyBuckets(from, to).map(async (bucket) => ({
    from: bucket.from,
    to: bucket.to,
    patients: await Promise.all(patients.map(async (p) => ({
      id: p.id,
      adherencePct: (await buildReport(p.id, bucket.from, bucket.to)).adherencePct,
    }))),
  })));

  res.json({ from, to, patients: list, trend, recentActivity: await loadRecentActivity() });
});
