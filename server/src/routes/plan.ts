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
        // Stringa vuota = non specificato nel documento (mostrato come "-"
        // in UI), diverso da "sempre" (consentito esplicitamente ogni
        // giorno) o "opzionale".
        maxPerWeek: maxPerWeek === '' || (MAX_PER_WEEK_OPTIONS as readonly string[]).includes(maxPerWeek) ? maxPerWeek : '',
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
// (vision/documenti). Il file caricato viene anche archiviato (vedi
// plan_uploads) come log dei caricamenti: ricaricare un piano sostituisce i
// dati estratti (nutrition_plan_items) ma non cancella i file già archiviati.
const EXTRACT_PROMPT = `Sei un assistente che estrae informazioni da un piano alimentare/nutrizionale (dieta) caricato come foto o PDF, che può avere più pagine.
Analizza TUTTE le pagine del documento ed estrai l'elenco completo degli alimenti indicati, uno per voce (non riassumere né tralasciare voci di elenchi lunghi).
Rispondi ESCLUSIVAMENTE con un array JSON valido, senza testo aggiuntivo prima o dopo, in questo formato esatto:
[{"name": "nome alimento", "quantity": "quantità, es. 150 g", "category": "categoria", "maxPerWeek": "frequenza"}]

- "quantity": la grammatura/quantità indicata nel documento per quell'alimento, SEMPRE con un'unità o un riferimento esplicito — mai un numero da solo. Se il documento indica un peso usa "150 g"; se indica un numero di pezzi/unità (es. una banana, due uova) usa "1 banana", "2 uova" e non semplicemente "1" o "2" — il numero da solo è ambiguo (non si capisce se sono grammi o pezzi). Molti alimenti (es. verdure a quantità libera) non hanno una grammatura: in quel caso usa una stringa vuota "" e riporta comunque solo il nome dell'alimento, senza inventare un valore.
- "category": una di queste quattro, quella più adatta: "Carboidrati", "Proteine", "Frutta e verdura", "Latticini". Se l'alimento non rientra chiaramente in nessuna, usa una stringa vuota "".
- "maxPerWeek": quante volte massimo a settimana il documento indica per quell'alimento, una di queste stringhe esatte: "1", "2", "3", "sempre" (consentito esplicitamente tutti i giorni), "opzionale" (facoltativo/a piacere). Se il documento non specifica una frequenza, usa una stringa vuota "" — non inventare "sempre" quando non è indicato.

Se il documento non è un piano alimentare o non contiene alimenti riconoscibili, rispondi con: []`;

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
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) throw new Error('la risposta non è un array');

    await db.execute({
      sql: 'INSERT INTO plan_uploads (filename, media_type, data_base64, uploaded_at) VALUES (?, ?, ?, ?)',
      args: [typeof filename === 'string' && filename ? filename : 'piano', mediaType, fileBase64, new Date().toISOString()],
    });

    res.json(cleanItems(parsed));
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
