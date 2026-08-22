import { Router } from 'express';
import { db } from '../db.js';
import { ORDER, LABEL, isMealKey, type MealKey } from '../constants.js';
import { score, verdict, verdictOf, pointsForFoods, foodMatches, type MatchContext } from '../match.js';
import { computeStreak, computeWeek, computeBadges } from '../stats.js';
import { romeParts, todayStr } from '../time.js';
import { requirePatient } from '../auth.js';

export const stateRouter = Router();
stateRouter.use(requirePatient);

// Colazione/pranzo/cena hanno un solo orario abituale ciascuno; gli
// spuntini possono essere più d'uno, quindi vivono in una lista a parte
// (snack_schedule) invece che come quarta chiave fissa.
export const FIXED_SCHEDULE_MEALS = ['colazione', 'pranzo', 'cena'] as const;
type FixedScheduleMeal = (typeof FIXED_SCHEDULE_MEALS)[number];

export const DEFAULT_MEAL_TIME: Record<FixedScheduleMeal, string> = {
  colazione: '08:00', pranzo: '13:00', cena: '20:00',
};

export async function loadSchedule(patientId: number) {
  const { rows } = await db.execute({ sql: 'SELECT meal_key, enabled, time FROM meal_schedule WHERE patient_id = ?', args: [patientId] });
  const byKey = new Map((rows as any[]).map((r) => [r.meal_key, r]));
  const meals: Record<FixedScheduleMeal, { enabled: boolean; time: string }> = {} as any;
  for (const key of FIXED_SCHEDULE_MEALS) {
    const row = byKey.get(key) as any;
    meals[key] = row
      ? { enabled: !!row.enabled, time: row.time }
      : { enabled: true, time: DEFAULT_MEAL_TIME[key] };
  }

  const { rows: snackRows } = await db.execute({ sql: 'SELECT time FROM snack_schedule WHERE patient_id = ? ORDER BY idx', args: [patientId] });
  const snacks = (snackRows as any[]).map((r) => r.time as string);

  return { ...meals, snacks };
}

// Alimenti registrati (pasti fatti) negli ultimi 7 giorni fino a `date`
// compreso — usato per verificare se un alimento del piano ha già raggiunto
// il suo tetto settimanale.
async function loadWeekFoods(patientId: number, date: string): Promise<string[]> {
  const { rows } = await db.execute({
    sql: `SELECT foods FROM meals WHERE patient_id = ? AND done = 1 AND date >= date(?, '-6 days') AND date <= ?`,
    args: [patientId, date, date],
  });
  return (rows as any[]).flatMap((r) => JSON.parse(r.foods) as string[]);
}

// Alimenti del piano Nemis del paziente (caricato in PianoView): hanno
// priorità sulle liste generiche CONSIGLIATI/SCONSIGLIATI nel match engine.
// Chi ha un tetto settimanale numerico ('1'/'2'/'3') e lo ha già raggiunto o
// superato questa settimana finisce in overLimitPlanNames, così il match
// engine lo segnala invece di darlo per "buono" a prescindere.
async function loadMatchContext(patientId: number, date: string): Promise<MatchContext> {
  const { rows } = await db.execute({ sql: 'SELECT name, category, max_per_week FROM nutrition_plan_items WHERE patient_id = ?', args: [patientId] });
  const planItems = (rows as any[]).map((r) => ({ name: r.name as string, category: r.category as string, maxPerWeek: r.max_per_week as string }));
  const planFoods = planItems.map((p) => p.name);
  const planCategories = Object.fromEntries(
    planItems.filter((p) => p.category).map((p) => [p.name.toLowerCase(), p.category])
  );

  const weekFoods = await loadWeekFoods(patientId, date);
  const overLimitPlanNames = new Set<string>();
  for (const item of planItems) {
    const cap = Number(item.maxPerWeek);
    if (!Number.isFinite(cap) || cap <= 0) continue; // 'sempre'/'opzionale': nessun tetto
    const count = weekFoods.filter((f) => foodMatches(f.toLowerCase().trim(), item.name)).length;
    if (count > cap) overLimitPlanNames.add(item.name.toLowerCase());
  }

  const divieti = await loadDivieti(patientId);

  return { planFoods, planCategories, overLimitPlanNames, divieti, month: new Date().getMonth() + 1 };
}

// Divieti espliciti del nutrizionista (allergie, intolleranze, controindicazioni),
// caricati come il piano da PianoView: hanno priorità assoluta nel match engine.
async function loadDivieti(patientId: number): Promise<string[]> {
  const { rows } = await db.execute({ sql: 'SELECT divieti FROM plan_notes WHERE patient_id = ?', args: [patientId] });
  const row = rows[0] as any;
  return row ? JSON.parse(row.divieti) : [];
}

// I pasti "attivi" sono quelli che il paziente fa di solito (impostati in
// onboarding): colazione/pranzo/cena se non segnati come "lo salto", lo
// spuntino solo se ha configurato almeno un orario. Il conteggio
// giornaliero (l'anello "X/N pasti") si basa su questi, non su un fisso 4,
// altrimenti chi non fa spuntini non arriva mai al 100%.
function computeActiveMeals(schedule: Awaited<ReturnType<typeof loadSchedule>>): MealKey[] {
  const active: MealKey[] = [];
  if (schedule.colazione.enabled) active.push('colazione');
  if (schedule.pranzo.enabled) active.push('pranzo');
  if (schedule.cena.enabled) active.push('cena');
  if (schedule.snacks.length > 0) active.push('spuntino');
  return active;
}

function readFastingPref(appState: any) {
  return {
    enabled: !!appState.fast_pref_enabled,
    start: appState.fast_pref_start as string,
    end: appState.fast_pref_end as string,
  };
}

export async function loadMeals(patientId: number, date: string) {
  const { rows } = await db.execute({
    sql: 'SELECT meal_key, done, foods, time, skipped, mood FROM meals WHERE patient_id = ? AND date = ?',
    args: [patientId, date],
  });
  const byKey = new Map((rows as any[]).map((r) => [r.meal_key, r]));
  const meals: Record<MealKey, { done: boolean; foods: string[]; time: string; skipped: boolean; mood: number }> = {} as any;
  for (const key of ORDER) {
    const row = byKey.get(key) as any;
    meals[key] = row
      ? { done: !!row.done, foods: JSON.parse(row.foods), time: row.time, skipped: !!row.skipped, mood: row.mood ?? 0 }
      : { done: false, foods: [], time: '', skipped: false, mood: 0 };
  }
  return meals;
}

// Una data passata dal client (log di un pasto per un giorno precedente non
// segnato) dev'essere una data valida e non futura, altrimenti si ricade su
// oggi — stessa idea di isMealKey: input non fidato, normalizzato subito.
export function resolveDate(input: unknown): string {
  const today = todayStr();
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) && input <= today) return input;
  return today;
}

export async function buildState(patientId: number) {
  const date = todayStr();
  const { rows } = await db.execute({ sql: 'SELECT * FROM app_state WHERE patient_id = ?', args: [patientId] });
  const appState = rows[0] as any;
  const meals = await loadMeals(patientId, date);
  const ctx = await loadMatchContext(patientId, date);
  const schedule = await loadSchedule(patientId);
  const activeMeals = computeActiveMeals(schedule);
  // Denominatore di oggi: pasti della routine non saltati OGGI, più
  // qualsiasi pasto extra registrato fuori routine (es. uno spuntino non
  // pianificato) — quel pasto è "presente" quindi conta. activeMeals resta
  // la routine pura e serve solo a decidere quali pasti mostrare in lista.
  const activeMealCount = ORDER.filter(
    (k) => (activeMeals.includes(k) && !meals[k].skipped) || meals[k].done
  ).length;

  const doneCount = ORDER.filter((k) => meals[k].done).length;
  const allFoods = ORDER.flatMap((k) => meals[k].foods);
  const goodCount = allFoods.filter((f) => verdict(f, ctx) === 'good').length;
  const adherence = allFoods.length ? Math.round((goodCount / allFoods.length) * 100) : 0;

  const mealsOut = Object.fromEntries(
    ORDER.map((k) => {
      const m = meals[k];
      const sc = score(m.foods, ctx);
      return [k, { ...m, label: LABEL[k], scoreLabel: sc.label, tone: sc.tone }];
    })
  );

  const streak = await computeStreak(patientId, date);
  const { rows: patientRows } = await db.execute({ sql: 'SELECT next_visit_at, next_visit_note FROM patients WHERE id = ?', args: [patientId] });
  const patientRow = patientRows[0] as any;

  return {
    date,
    nextVisitAt: patientRow?.next_visit_at ?? '',
    nextVisitNote: patientRow?.next_visit_note ?? '',
    points: appState.points as number,
    streak,
    freq: appState.freq as string,
    reportSendTime: appState.report_send_time as string,
    fastActive: !!appState.fast_active,
    fastStart: appState.fast_start as number,
    greetingName: appState.greeting_name as string,
    onboarded: !!appState.onboarded,
    schedule,
    activeMeals,
    activeMealCount,
    fastingPref: readFastingPref(appState),
    doneCount,
    adherencePct: adherence,
    meals: mealsOut,
    week: await computeWeek(patientId, date),
    badges: await computeBadges(patientId, streak),
  };
}

stateRouter.get('/state', async (req, res) => {
  res.json(await buildState(req.patientId!));
});

// Pasti di un giorno precedente (non quello di oggi, già in /state) — usato
// per registrare a posteriori un pasto/alimento non segnato quando si clicca
// un giorno nel grafico "Andamento".
stateRouter.get('/meals', async (req, res) => {
  const date = resolveDate(req.query.date);
  res.json(await loadMeals(req.patientId!, date));
});

stateRouter.put('/settings/freq', async (req, res) => {
  const { freq } = req.body ?? {};
  if (!['meal', 'multi', 'day', 'manual'].includes(freq)) {
    return res.status(400).json({ error: 'invalid freq' });
  }
  await db.execute({ sql: 'UPDATE app_state SET freq = ? WHERE patient_id = ?', args: [freq, req.patientId] });
  res.json(await buildState(req.patientId!));
});

stateRouter.put('/settings/report-time', async (req, res) => {
  const { time } = req.body ?? {};
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'orario non valido' });
  }
  await db.execute({ sql: 'UPDATE app_state SET report_send_time = ? WHERE patient_id = ?', args: [time, req.patientId!] });
  res.json(await buildState(req.patientId!));
});

stateRouter.post('/fast/toggle', async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT fast_active, fast_start FROM app_state WHERE patient_id = ?', args: [req.patientId!] });
  const appState = rows[0] as any;
  const nowActive = !appState.fast_active;
  const fastStart = nowActive ? Date.now() : appState.fast_start;
  await db.execute({
    sql: 'UPDATE app_state SET fast_active = ?, fast_start = ? WHERE patient_id = ?',
    args: [nowActive ? 1 : 0, fastStart, req.patientId],
  });
  res.json(await buildState(req.patientId!));
});

stateRouter.post('/meals/:key/log', async (req, res) => {
  const { key } = req.params;
  if (!isMealKey(key)) return res.status(400).json({ error: 'invalid meal key' });
  const foods: string[] = Array.isArray(req.body?.foods)
    ? req.body.foods.map((f: unknown) => String(f).trim()).filter(Boolean)
    : [];
  if (!foods.length) return res.status(400).json({ error: 'no foods provided' });

  const patientId = req.patientId!;
  // Se il client manda una data (backfill di un giorno precedente dal
  // grafico "Andamento") si registra su quella, non su oggi.
  const date = resolveDate(req.body?.date);
  const time = romeParts().time;

  // Un pasto può accumulare più registrazioni nello stesso giorno (es.
  // yogurt alle 6, colazione completa con uova e pane alle 8): i nuovi
  // alimenti si aggiungono a quelli già registrati invece di sostituirli.
  const { rows: existingRows } = await db.execute({
    sql: 'SELECT foods FROM meals WHERE patient_id = ? AND date = ? AND meal_key = ?',
    args: [patientId, date, key],
  });
  const existingFoods: string[] = existingRows[0] ? JSON.parse((existingRows[0] as any).foods) : [];
  const mergedFoods = [...existingFoods, ...foods];

  await db.execute({
    sql: `INSERT INTO meals (patient_id, date, meal_key, done, foods, time, skipped) VALUES (?, ?, ?, 1, ?, ?, 0)
          ON CONFLICT(patient_id, date, meal_key) DO UPDATE SET done = 1, foods = excluded.foods, time = excluded.time, skipped = 0`,
    args: [patientId, date, key, JSON.stringify(mergedFoods), time],
  });

  const ctx = await loadMatchContext(patientId, date);
  const pts = pointsForFoods(foods, ctx);
  await db.execute({ sql: 'UPDATE app_state SET points = points + ? WHERE patient_id = ?', args: [pts, patientId] });

  const sc = score(foods, ctx);
  const summary = {
    key,
    date,
    label: LABEL[key],
    foods: foods.map((f) => {
      const v = verdictOf(f, ctx);
      return { name: f, verdict: v.tone, reason: v.reason };
    }),
    score: sc,
    pointsEarned: pts,
  };

  res.json({ state: await buildState(patientId), summary });
});

// Sostituisce l'intero elenco di alimenti già registrati per il pasto oggi
// (a differenza di POST, che aggiunge) — usato per modificare il testo di
// una voce o cancellarne una singola da quelle già fatte, invece di dover
// cancellare tutto il pasto e ricominciare.
stateRouter.put('/meals/:key/log', async (req, res) => {
  const { key } = req.params;
  if (!isMealKey(key)) return res.status(400).json({ error: 'invalid meal key' });
  const foods: string[] = Array.isArray(req.body?.foods)
    ? req.body.foods.map((f: unknown) => String(f).trim()).filter(Boolean)
    : [];

  const patientId = req.patientId!;
  const date = resolveDate(req.body?.date);
  const { rows } = await db.execute({
    sql: 'SELECT foods FROM meals WHERE patient_id = ? AND date = ? AND meal_key = ?',
    args: [patientId, date, key],
  });
  const existingFoods: string[] = rows[0] ? JSON.parse((rows[0] as any).foods) : [];

  const ctx = await loadMatchContext(patientId, date);
  const oldPts = pointsForFoods(existingFoods, ctx);
  const newPts = pointsForFoods(foods, ctx);
  await db.execute({ sql: 'UPDATE app_state SET points = MAX(0, points - ? + ?) WHERE patient_id = ?', args: [oldPts, newPts, patientId] });

  const time = romeParts().time;
  await db.execute({
    sql: `INSERT INTO meals (patient_id, date, meal_key, done, foods, time, skipped) VALUES (?, ?, ?, ?, ?, ?, 0)
          ON CONFLICT(patient_id, date, meal_key) DO UPDATE SET done = excluded.done, foods = excluded.foods, time = excluded.time, skipped = 0`,
    args: [patientId, date, key, foods.length ? 1 : 0, JSON.stringify(foods), foods.length ? time : ''],
  });

  res.json(await buildState(patientId));
});

stateRouter.delete('/meals/:key/log', async (req, res) => {
  const { key } = req.params;
  if (!isMealKey(key)) return res.status(400).json({ error: 'invalid meal key' });

  const patientId = req.patientId!;
  const date = resolveDate(req.query.date);
  const { rows } = await db.execute({
    sql: 'SELECT foods FROM meals WHERE patient_id = ? AND date = ? AND meal_key = ?',
    args: [patientId, date, key],
  });
  const row = rows[0] as any;
  if (row) {
    const foods: string[] = JSON.parse(row.foods);
    const pts = pointsForFoods(foods, await loadMatchContext(patientId, date));
    await db.execute({ sql: 'UPDATE app_state SET points = MAX(0, points - ?) WHERE patient_id = ?', args: [pts, patientId] });
  }

  await db.execute({
    sql: `INSERT INTO meals (patient_id, date, meal_key, done, foods, time, skipped) VALUES (?, ?, ?, 0, '[]', '', 0)
          ON CONFLICT(patient_id, date, meal_key) DO UPDATE SET done = 0, foods = '[]', time = '', skipped = 0`,
    args: [patientId, date, key],
  });

  res.json(await buildState(patientId));
});

stateRouter.put('/meals/:key/skip', async (req, res) => {
  const { key } = req.params;
  if (!isMealKey(key)) return res.status(400).json({ error: 'invalid meal key' });
  const skipped = req.body?.skipped === true ? 1 : 0;
  const patientId = req.patientId!;
  const date = todayStr();

  await db.execute({
    sql: `INSERT INTO meals (patient_id, date, meal_key, done, foods, time, skipped) VALUES (?, ?, ?, 0, '[]', '', ?)
          ON CONFLICT(patient_id, date, meal_key) DO UPDATE SET skipped = excluded.skipped`,
    args: [patientId, date, key, skipped],
  });

  res.json(await buildState(patientId));
});

// Valutazione dell'umore dopo il pasto (1-5), impostata con una chiamata a
// parte dal riepilogo mostrato dopo la registrazione — non blocca il flusso
// di log stesso, il paziente può chiuderlo senza valutare.
stateRouter.put('/meals/:key/mood', async (req, res) => {
  const { key } = req.params;
  if (!isMealKey(key)) return res.status(400).json({ error: 'invalid meal key' });
  const mood = Number(req.body?.mood);
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) return res.status(400).json({ error: 'mood non valido (1-5)' });
  const patientId = req.patientId!;
  const date = resolveDate(req.body?.date);

  await db.execute({ sql: 'UPDATE meals SET mood = ? WHERE patient_id = ? AND date = ? AND meal_key = ?', args: [mood, patientId, date, key] });

  res.json(await buildState(patientId));
});
