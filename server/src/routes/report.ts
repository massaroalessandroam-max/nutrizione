import { Router } from 'express';
import { db } from '../db.js';
import { LABEL, type MealKey } from '../constants.js';
import { score, verdict, foodMatches } from '../match.js';
import { ANTHROPIC_API_KEY, callClaudeText, extractJsonArray } from '../anthropic.js';
import { PLAN_CATEGORIES } from './plan.js';

export const reportRouter = Router();

async function loadPlanFoods(): Promise<string[]> {
  const { rows } = await db.execute('SELECT name FROM nutrition_plan_items');
  return (rows as any[]).map((r) => r.name as string);
}

async function loadPlanItemsWithCategory(): Promise<Array<{ name: string; category: string }>> {
  const { rows } = await db.execute('SELECT name, category FROM nutrition_plan_items');
  return (rows as any[]).map((r) => ({ name: r.name as string, category: (r.category as string) || 'Altro' }));
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadFoodEntriesInRange(from: string, to: string): Promise<Array<{ date: string; food: string }>> {
  const { rows } = await db.execute({
    sql: 'SELECT date, foods FROM meals WHERE done = 1 AND date >= ? AND date <= ?',
    args: [from, to],
  });
  const entries: Array<{ date: string; food: string }> = [];
  for (const r of rows as any[]) {
    for (const food of JSON.parse((r as any).foods) as string[]) entries.push({ date: (r as any).date, food });
  }
  return entries;
}

type Weights = Record<string, number>;

async function loadCachedWeights(foodKeys: string[]): Promise<Map<string, Weights>> {
  if (!foodKeys.length) return new Map();
  const placeholders = foodKeys.map(() => '?').join(',');
  const { rows } = await db.execute({
    sql: `SELECT food_text, weights_json FROM food_category_weights WHERE food_text IN (${placeholders})`,
    args: foodKeys,
  });
  const map = new Map<string, Weights>();
  for (const r of rows as any[]) map.set(r.food_text, JSON.parse(r.weights_json));
  return map;
}

async function saveCachedWeights(entries: Array<{ key: string; weights: Weights }>): Promise<void> {
  for (const e of entries) {
    await db.execute({
      sql: `INSERT INTO food_category_weights (food_text, weights_json) VALUES (?, ?)
            ON CONFLICT(food_text) DO UPDATE SET weights_json = excluded.weights_json`,
      args: [e.key, JSON.stringify(e.weights)],
    });
  }
}

const CATEGORIZE_PROMPT_HEADER = `Sei un nutrizionista che classifica voci di un diario alimentare per macronutrienti.
Per ognuna delle voci elencate sotto (una voce può contenere più alimenti insieme, es. "pasta con verdure e formaggio") suddividi in percentuale tra queste categorie: ${[...PLAN_CATEGORIES, 'Altro'].join(', ')}.
Usa "Altro" SOLO per condimenti o voci senza un vero gruppo alimentare (sale, aceto, spezie, caffè, acqua, tè) — per qualsiasi alimento vero, anche se generico o scritto male, stimalo con buon senso nutrizionale tra le altre categorie invece di scaricarlo su "Altro".
Le percentuali (da 0 a 1) di ciascuna voce devono sommare a 1.
Rispondi ESCLUSIVAMENTE con un array JSON valido, un oggetto per voce, nello stesso ordine dell'elenco, senza testo prima o dopo, in questo formato:
[{"Carboidrati": 0.5, "Verdura": 0.5}, {"Altro": 1}]

Elenco:
`;

// Associa ogni alimento registrato a un peso (0-1) per categoria: match
// diretto col piano quando c'è (100% a quella categoria), altrimenti AI —
// una voce del diario spesso contiene più alimenti insieme, quindi si
// distribuisce invece di forzarla in una categoria sola. Risultati non dal
// piano vengono messi in cache per non richiamare l'AI ad ogni apertura.
async function categorizeFoodsWeighted(
  foods: string[], planItems: Array<{ name: string; category: string }>
): Promise<Map<string, Weights>> {
  const result = new Map<string, Weights>();
  const unresolved: string[] = [];

  for (const food of [...new Set(foods)]) {
    const n = food.toLowerCase().trim();
    const match = planItems.find((p) => foodMatches(n, p.name));
    if (match) result.set(food, { [match.category || 'Altro']: 1 });
    else unresolved.push(food);
  }

  if (!unresolved.length) return result;

  const keyOf = (f: string) => f.toLowerCase().trim();
  const cached = await loadCachedWeights(unresolved.map(keyOf));
  const stillUnresolved = unresolved.filter((f) => !cached.has(keyOf(f)));
  for (const food of unresolved) {
    const hit = cached.get(keyOf(food));
    if (hit) result.set(food, hit);
  }

  if (stillUnresolved.length && ANTHROPIC_API_KEY) {
    try {
      const prompt = CATEGORIZE_PROMPT_HEADER + stillUnresolved.map((f, i) => `${i + 1}. ${f}`).join('\n');
      const text = await callClaudeText(prompt, 4096);
      const parsed = extractJsonArray(text) as Weights[];
      const toCache: Array<{ key: string; weights: Weights }> = [];
      stillUnresolved.forEach((food, i) => {
        const weights = parsed[i] && typeof parsed[i] === 'object' ? parsed[i] : { Altro: 1 };
        result.set(food, weights);
        toCache.push({ key: keyOf(food), weights });
      });
      await saveCachedWeights(toCache);
    } catch (e) {
      console.error('[report/macros] classificazione AI fallita:', (e as Error).message);
      for (const food of stillUnresolved) result.set(food, { Altro: 1 });
    }
  } else {
    for (const food of stillUnresolved) result.set(food, { Altro: 1 });
  }

  return result;
}

// Date (YYYY-MM-DD) del mese dato con almeno un pasto registrato — per
// colorare il calendario senza scaricare tutti i pasti.
reportRouter.get('/report/activity', async (req, res) => {
  const month = String(req.query.month ?? '');
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'mese non valido' });

  const { rows } = await db.execute({
    sql: 'SELECT DISTINCT date FROM meals WHERE done = 1 AND date LIKE ?',
    args: [`${month}-%`],
  });
  res.json((rows as any[]).map((r) => r.date as string));
});

// Report su un intervallo di date (una o più settimane, un mese, un anno):
// tutti i pasti fatti raggruppati per giorno, con verdetto e aderenza
// aggregata sull'intero periodo.
reportRouter.get('/report', async (req, res) => {
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'intervallo non valido' });
  }

  const { rows } = await db.execute({
    sql: 'SELECT date, meal_key, foods, time FROM meals WHERE done = 1 AND date >= ? AND date <= ? ORDER BY date, meal_key',
    args: [from, to],
  });
  const planFoods = await loadPlanFoods();

  const byDate = new Map<string, any[]>();
  for (const r of rows as any[]) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date)!.push(r);
  }

  let totalFoods = 0;
  let goodFoods = 0;
  let totalMeals = 0;

  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, mealRows]) => {
      // Mese del giorno stesso (non quello di oggi), per la stagionalità
      // frutta/verdura corretta su un report che copre più mesi.
      const ctx = { planFoods, month: Number(date.slice(5, 7)) };
      const meals = mealRows.map((r) => {
        const foods: string[] = JSON.parse(r.foods);
        const key = r.meal_key as MealKey;
        const sc = score(foods, ctx);
        totalMeals += 1;
        totalFoods += foods.length;
        goodFoods += foods.filter((f) => verdict(f, ctx) === 'good').length;
        return { key, label: LABEL[key], time: r.time as string, foods, scoreLabel: sc.label, tone: sc.tone };
      });
      return { date, meals };
    });

  const adherencePct = totalFoods > 0 ? Math.round((goodFoods / totalFoods) * 100) : 0;

  res.json({ from, to, days, totalMeals, adherencePct });
});

// Ripartizione per categoria (macronutrienti) degli alimenti registrati nel
// periodo scelto, a confronto con lo stesso numero di giorni immediatamente
// precedente (es. "oggi" -> ieri; una settimana -> la settimana prima) — con
// il dettaglio di quali alimenti/giorni compongono ogni percentuale.
reportRouter.get('/report/macros', async (req, res) => {
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'intervallo non valido' });
  }

  const spanDays = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
  const prevTo = shiftDate(from, -1);
  const prevFrom = shiftDate(prevTo, -(spanDays - 1));

  const planItems = await loadPlanItemsWithCategory();
  const [currentEntries, previousEntries] = await Promise.all([
    loadFoodEntriesInRange(from, to),
    loadFoodEntriesInRange(prevFrom, prevTo),
  ]);

  const weightsMap = await categorizeFoodsWeighted(
    [...currentEntries, ...previousEntries].map((e) => e.food),
    planItems
  );

  function buildPeriod(entries: Array<{ date: string; food: string }>) {
    const categories: Record<string, { pct: number; items: Array<{ date: string; food: string; weight: number }> }> = {};
    for (const e of entries) {
      const weights = weightsMap.get(e.food) ?? { Altro: 1 };
      for (const [cat, weight] of Object.entries(weights)) {
        if (!weight) continue;
        if (!categories[cat]) categories[cat] = { pct: 0, items: [] };
        categories[cat].items.push({ date: e.date, food: e.food, weight });
        categories[cat].pct += weight;
      }
    }
    for (const cat of Object.keys(categories)) {
      categories[cat].pct = entries.length > 0 ? (categories[cat].pct / entries.length) * 100 : 0;
      categories[cat].items.sort((a, b) => b.date.localeCompare(a.date));
    }
    return { total: entries.length, categories };
  }

  res.json({
    current: { from, to, ...buildPeriod(currentEntries) },
    previous: { from: prevFrom, to: prevTo, ...buildPeriod(previousEntries) },
  });
});

// Destinatari email del report, con alias (es. "Dott.ssa Rossi").
reportRouter.get('/report/recipients', async (_req, res) => {
  const { rows } = await db.execute('SELECT id, email, alias FROM report_recipients ORDER BY id');
  res.json((rows as any[]).map((r) => ({ id: r.id, email: r.email, alias: r.alias })));
});

reportRouter.post('/report/recipients', async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const alias = String(req.body?.alias ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'email non valida' });
  }
  await db.execute({ sql: 'INSERT INTO report_recipients (email, alias) VALUES (?, ?)', args: [email, alias] });
  const { rows } = await db.execute('SELECT id, email, alias FROM report_recipients ORDER BY id');
  res.json((rows as any[]).map((r) => ({ id: r.id, email: r.email, alias: r.alias })));
});

reportRouter.delete('/report/recipients/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM report_recipients WHERE id = ?', args: [req.params.id] });
  const { rows } = await db.execute('SELECT id, email, alias FROM report_recipients ORDER BY id');
  res.json((rows as any[]).map((r) => ({ id: r.id, email: r.email, alias: r.alias })));
});

// Storico invii — vuoto finché l'invio email automatico non è collegato a
// un servizio reale (vedi commento in db.ts): le righe si popoleranno da
// sole quando quella parte sarà attiva.
reportRouter.get('/report/history', async (_req, res) => {
  const { rows } = await db.execute('SELECT id, sent_at, recipients, report_from, report_to FROM report_send_log ORDER BY id DESC');
  res.json((rows as any[]).map((r) => ({
    id: r.id, sentAt: r.sent_at, recipients: JSON.parse(r.recipients), from: r.report_from, to: r.report_to,
  })));
});

reportRouter.get('/report/history/:id', async (req, res) => {
  const { rows } = await db.execute({
    sql: 'SELECT id, sent_at, recipients, report_from, report_to, body_text FROM report_send_log WHERE id = ?',
    args: [req.params.id],
  });
  const row = rows[0] as any;
  if (!row) return res.status(404).json({ error: 'invio non trovato' });
  res.json({
    id: row.id, sentAt: row.sent_at, recipients: JSON.parse(row.recipients),
    from: row.report_from, to: row.report_to, bodyText: row.body_text,
  });
});
