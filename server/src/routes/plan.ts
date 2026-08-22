import { Router } from 'express';
import { db } from '../db.js';
import { ANTHROPIC_API_KEY, MAX_BASE64_LEN, callClaudeWithFile, extractJsonObject } from '../anthropic.js';
import { ORDER as MEAL_ORDER, isMealKey, type MealKey } from '../constants.js';

export const planRouter = Router();

// Macro-categorie fisse per raggruppare gli alimenti del piano, e opzioni
// per il tetto settimanale concordato col nutrizionista. Frutta e Verdura
// separate (non "Frutta e verdura" unica) e Legumi/Grassi a parte da
// Carboidrati/Proteine perché nutrizionalmente distinti.
export const PLAN_CATEGORIES = ['Carboidrati', 'Proteine', 'Legumi', 'Grassi', 'Frutta', 'Verdura', 'Latticini'] as const;
export const MAX_PER_WEEK_OPTIONS = ['1', '2', '3', 'sempre', 'opzionale'] as const;

interface PlanItemBody {
  name?: unknown;
  quantity?: unknown;
  category?: unknown;
  maxPerWeek?: unknown;
}

function cleanItems(input: unknown): Array<{ name: string; quantity: string; category: string; maxPerWeek: string }> {
  if (!Array.isArray(input)) return [];
  return (input as PlanItemBody[])
    .map((it) => {
      const category = String(it?.category ?? '').trim();
      const maxPerWeek = String(it?.maxPerWeek ?? '').trim();
      return {
        name: String(it?.name ?? '').trim(),
        quantity: String(it?.quantity ?? '').trim(),
        category: (PLAN_CATEGORIES as readonly string[]).includes(category) ? category : '',
        // Stringa vuota = non specificato nel documento (mostrato come "-"
        // in UI), diverso da "sempre" (consentito esplicitamente ogni
        // giorno) o "opzionale".
        maxPerWeek: maxPerWeek === '' || (MAX_PER_WEEK_OPTIONS as readonly string[]).includes(maxPerWeek) ? maxPerWeek : '',
      };
    })
    .filter((it) => it.name);
}

// Righe di testo libero (regole generali, divieti): trim, scarta le vuote,
// nessun limite sul contenuto — è il nutrizionista a deciderne il senso.
function cleanStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((s) => String(s ?? '').trim()).filter(Boolean);
}

function cleanMealExamples(input: unknown): Record<MealKey, string[]> {
  const out = {} as Record<MealKey, string[]>;
  for (const key of MEAL_ORDER) out[key] = [];
  if (!input || typeof input !== 'object') return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isMealKey(key)) out[key] = cleanStringList(value);
  }
  return out;
}

interface PlanNotes { generalRules: string[]; mealExamples: Record<MealKey, string[]>; divieti: string[] }

async function loadPlanNotes(): Promise<PlanNotes> {
  const { rows } = await db.execute('SELECT general_rules, meal_examples, divieti FROM plan_notes WHERE id = 1');
  const row = rows[0] as any;
  if (!row) return { generalRules: [], mealExamples: cleanMealExamples({}), divieti: [] };
  return {
    generalRules: JSON.parse(row.general_rules),
    mealExamples: cleanMealExamples(JSON.parse(row.meal_examples)),
    divieti: JSON.parse(row.divieti),
  };
}

async function savePlanNotes(notes: PlanNotes): Promise<void> {
  await db.execute({
    sql: `INSERT INTO plan_notes (id, general_rules, meal_examples, divieti) VALUES (1, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET general_rules = excluded.general_rules, meal_examples = excluded.meal_examples, divieti = excluded.divieti`,
    args: [JSON.stringify(notes.generalRules), JSON.stringify(notes.mealExamples), JSON.stringify(notes.divieti)],
  });
}

planRouter.get('/plan/notes', async (_req, res) => {
  res.json(await loadPlanNotes());
});

planRouter.post('/plan/notes', async (req, res) => {
  const notes: PlanNotes = {
    generalRules: cleanStringList(req.body?.generalRules),
    mealExamples: cleanMealExamples(req.body?.mealExamples),
    divieti: cleanStringList(req.body?.divieti),
  };
  await savePlanNotes(notes);
  res.json(notes);
});

planRouter.get('/plan', async (_req, res) => {
  const { rows } = await db.execute('SELECT name, quantity, category, max_per_week FROM nutrition_plan_items ORDER BY idx');
  res.json((rows as any[]).map((r) => ({ name: r.name, quantity: r.quantity, category: r.category, maxPerWeek: r.max_per_week })));
});

planRouter.post('/plan', async (req, res) => {
  const items = cleanItems(req.body?.items);

  await db.execute('DELETE FROM nutrition_plan_items');
  for (const [idx, it] of items.entries()) {
    await db.execute({
      sql: 'INSERT INTO nutrition_plan_items (idx, name, quantity, category, max_per_week) VALUES (?, ?, ?, ?, ?)',
      args: [idx, it.name, it.quantity, it.category, it.maxPerWeek],
    });
  }

  res.json(items);
});

// Estrazione alimenti+grammature da una foto o un PDF del piano, via Claude
// (vision/documenti). Il file caricato viene anche archiviato (vedi
// plan_uploads) come log dei caricamenti: ricaricare un piano sostituisce i
// dati estratti (nutrition_plan_items) ma non cancella i file già archiviati.
const EXTRACT_PROMPT = `Sei un assistente che estrae informazioni da un piano alimentare/nutrizionale (dieta) caricato come foto o PDF, che può avere più pagine.
Analizza TUTTE le pagine del documento. Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo aggiuntivo prima o dopo, in questo formato esatto:
{"items": [...], "generalRules": [...], "mealExamples": {"colazione": [...], "pranzo": [...], "cena": [...], "spuntino": [...]}, "divieti": [...]}

"items": l'elenco completo degli alimenti indicati con relativa grammatura, uno per voce (non riassumere né tralasciare voci di elenchi lunghi). Ogni voce: {"name": "nome alimento", "quantity": "quantità, es. 150 g", "category": "categoria", "maxPerWeek": "frequenza"}
- "quantity": la grammatura/quantità indicata nel documento per quell'alimento, SEMPRE con un'unità o un riferimento esplicito — mai un numero da solo. Se il documento indica un peso usa "150 g"; se indica un numero di pezzi/unità (es. una banana, due uova) usa "1 banana", "2 uova" e non semplicemente "1" o "2" — il numero da solo è ambiguo (non si capisce se sono grammi o pezzi). Molti alimenti (es. verdure a quantità libera) non hanno una grammatura: in quel caso usa una stringa vuota "" e riporta comunque solo il nome dell'alimento, senza inventare un valore.
- "category": una di queste sette, quella più adatta: "Carboidrati" (cereali, pane, pasta, riso, patate...), "Proteine" (carne, pesce, uova, tofu, seitan...), "Legumi" (fagioli, ceci, lenticchie...), "Grassi" (olio, frutta secca, semi, avocado, cioccolato fondente...), "Frutta", "Verdura", "Latticini" (formaggi, yogurt, latte...). Se l'alimento non rientra chiaramente in nessuna (es. sale, aceto, spezie), usa una stringa vuota "".
- "maxPerWeek": quante volte massimo a settimana il documento indica per quell'alimento, una di queste stringhe esatte: "1", "2", "3", "sempre" (consentito esplicitamente tutti i giorni), "opzionale" (facoltativo/a piacere). Se il documento non specifica una frequenza, usa una stringa vuota "" — non inventare "sempre" quando non è indicato.

"generalRules": regole generali valide per ogni pasto (es. "Bere almeno 1,5 L d'acqua al giorno", "Non saltare mai la colazione", "Aspettare almeno 3 ore tra un pasto e l'altro"), una stringa per regola, così come scritte nel documento. Array vuoto [] se il documento non ne indica.

"mealExamples": per ciascuna delle quattro tipologie di pasto (colazione, pranzo, cena, spuntino), gli esempi di pasto completo indicati nel documento (es. per "colazione": "Yogurt bianco + 30 g fiocchi d'avena + una banana"), una stringa per esempio. Array vuoto [] per una tipologia senza esempi nel documento.

"divieti": alimenti o comportamenti esplicitamente vietati (non solo "da limitare") — es. allergie, intolleranze, controindicazioni mediche indicate dal nutrizionista ("Vietato: arachidi", "Vietato saltare i pasti"), una stringa per divieto. Diverso dagli alimenti con maxPerWeek basso, che sono permessi ma limitati: qui solo ciò che il documento vieta esplicitamente. Array vuoto [] se il documento non ne indica.

Se il documento non è un piano alimentare o non contiene informazioni riconoscibili, rispondi con: {"items": [], "generalRules": [], "mealExamples": {}, "divieti": []}`;

planRouter.post('/plan/extract', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Estrazione non disponibile: ANTHROPIC_API_KEY non configurata sul server.' });
  }

  const { fileBase64, mediaType, filename } = req.body ?? {};
  if (typeof fileBase64 !== 'string' || !fileBase64 || typeof mediaType !== 'string' || !mediaType) {
    return res.status(400).json({ error: 'file mancante' });
  }
  if (fileBase64.length > MAX_BASE64_LEN) {
    return res.status(413).json({ error: 'File troppo grande (limite ~10MB)' });
  }

  try {
    const text = await callClaudeWithFile(fileBase64, mediaType, EXTRACT_PROMPT, 8192);
    const parsed = extractJsonObject(text) as Record<string, unknown>;

    await db.execute({
      sql: 'INSERT INTO plan_uploads (filename, media_type, data_base64, uploaded_at) VALUES (?, ?, ?, ?)',
      args: [typeof filename === 'string' && filename ? filename : 'piano', mediaType, fileBase64, new Date().toISOString()],
    });

    res.json({
      items: cleanItems(parsed.items),
      generalRules: cleanStringList(parsed.generalRules),
      mealExamples: cleanMealExamples(parsed.mealExamples),
      divieti: cleanStringList(parsed.divieti),
    });
  } catch (e) {
    if ((e as any).code === 'api_unavailable') {
      return res.status(502).json({ error: 'Estrazione fallita (servizio AI non disponibile). Inserisci gli alimenti a mano.' });
    }
    console.error('[plan/extract] errore:', (e as Error).message);
    res.status(502).json({ error: 'Non sono riuscito a leggere il documento. Riprova o inserisci gli alimenti a mano.' });
  }
});

// Log dei documenti piano caricati in passato (senza il contenuto, pesante).
planRouter.get('/plan/uploads', async (_req, res) => {
  const { rows } = await db.execute('SELECT id, filename, media_type, uploaded_at FROM plan_uploads ORDER BY id DESC');
  res.json((rows as any[]).map((r) => ({ id: r.id, filename: r.filename, mediaType: r.media_type, uploadedAt: r.uploaded_at })));
});

planRouter.get('/plan/uploads/:id/download', async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT filename, media_type, data_base64 FROM plan_uploads WHERE id = ?', args: [req.params.id] });
  const row = rows[0] as any;
  if (!row) return res.status(404).json({ error: 'file non trovato' });

  res.setHeader('Content-Type', row.media_type);
  res.setHeader('Content-Disposition', `attachment; filename="${row.filename.replace(/"/g, '')}"`);
  res.send(Buffer.from(row.data_base64, 'base64'));
});
