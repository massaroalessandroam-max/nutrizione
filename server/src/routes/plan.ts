import { Router } from 'express';
import { db } from '../db.js';
import { ANTHROPIC_API_KEY, MAX_BASE64_LEN, callClaudeWithFile, extractJsonArray } from '../anthropic.js';

export const planRouter = Router();

// Macro-categorie fisse per raggruppare gli alimenti del piano, e opzioni
// per il tetto settimanale concordato col nutrizionista.
export const PLAN_CATEGORIES = ['Carboidrati', 'Proteine', 'Frutta e verdura', 'Latticini'] as const;
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
        maxPerWeek: (MAX_PER_WEEK_OPTIONS as readonly string[]).includes(maxPerWeek) ? maxPerWeek : 'sempre',
      };
    })
    .filter((it) => it.name);
}

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
// (vision/documenti). Il file non viene salvato lato server: si estrae e
// via, come dichiarato nell'UI.
const EXTRACT_PROMPT = `Sei un assistente che estrae informazioni da un piano alimentare/nutrizionale (dieta) caricato come foto o PDF, che può avere più pagine.
Analizza TUTTE le pagine del documento ed estrai l'elenco completo degli alimenti indicati, uno per voce (non riassumere né tralasciare voci di elenchi lunghi).
Rispondi ESCLUSIVAMENTE con un array JSON valido, senza testo aggiuntivo prima o dopo, in questo formato esatto:
[{"name": "nome alimento", "quantity": "quantità, es. 150 g", "category": "categoria", "maxPerWeek": "frequenza"}]

- "quantity": la grammatura/quantità indicata nel documento per quell'alimento. Molti alimenti (es. verdure a quantità libera) non hanno una grammatura: in quel caso usa una stringa vuota "" e riporta comunque solo il nome dell'alimento, senza inventare un valore.
- "category": una di queste quattro, quella più adatta: "Carboidrati", "Proteine", "Frutta e verdura", "Latticini". Se l'alimento non rientra chiaramente in nessuna, usa una stringa vuota "".
- "maxPerWeek": quante volte massimo a settimana il documento indica per quell'alimento, una di queste stringhe esatte: "1", "2", "3", "sempre" (consentito tutti i giorni/senza limite indicato), "opzionale" (facoltativo/a piacere). Se il documento non specifica una frequenza, usa "sempre".

Se il documento non è un piano alimentare o non contiene alimenti riconoscibili, rispondi con: []`;

planRouter.post('/plan/extract', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Estrazione non disponibile: ANTHROPIC_API_KEY non configurata sul server.' });
  }

  const { fileBase64, mediaType } = req.body ?? {};
  if (typeof fileBase64 !== 'string' || !fileBase64 || typeof mediaType !== 'string' || !mediaType) {
    return res.status(400).json({ error: 'file mancante' });
  }
  if (fileBase64.length > MAX_BASE64_LEN) {
    return res.status(413).json({ error: 'File troppo grande (limite ~10MB)' });
  }

  try {
    const text = await callClaudeWithFile(fileBase64, mediaType, EXTRACT_PROMPT, 8192);
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) throw new Error('la risposta non è un array');

    res.json(cleanItems(parsed));
  } catch (e) {
    if ((e as any).code === 'api_unavailable') {
      return res.status(502).json({ error: 'Estrazione fallita (servizio AI non disponibile). Inserisci gli alimenti a mano.' });
    }
    console.error('[plan/extract] errore:', (e as Error).message);
    res.status(502).json({ error: 'Non sono riuscito a leggere il documento. Riprova o inserisci gli alimenti a mano.' });
  }
});
