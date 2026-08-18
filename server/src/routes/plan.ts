import { Router } from 'express';
import { db } from '../db.js';

export const planRouter = Router();

interface PlanItemBody {
  name?: unknown;
  quantity?: unknown;
}

function cleanItems(input: unknown): Array<{ name: string; quantity: string }> {
  if (!Array.isArray(input)) return [];
  return (input as PlanItemBody[])
    .map((it) => ({ name: String(it?.name ?? '').trim(), quantity: String(it?.quantity ?? '').trim() }))
    .filter((it) => it.name);
}

planRouter.get('/plan', async (_req, res) => {
  const { rows } = await db.execute('SELECT name, quantity FROM nutrition_plan_items ORDER BY idx');
  res.json((rows as any[]).map((r) => ({ name: r.name, quantity: r.quantity })));
});

planRouter.post('/plan', async (req, res) => {
  const items = cleanItems(req.body?.items);

  await db.execute('DELETE FROM nutrition_plan_items');
  for (const [idx, it] of items.entries()) {
    await db.execute({
      sql: 'INSERT INTO nutrition_plan_items (idx, name, quantity) VALUES (?, ?, ?)',
      args: [idx, it.name, it.quantity],
    });
  }

  res.json(items);
});

// Estrazione alimenti+grammature da una foto o un PDF del piano, via Claude
// (vision/documenti). Chiamata via fetch nativo invece dell'SDK: una
// richiesta HTTP semplice non giustifica una dipendenza in più. Il file non
// viene salvato lato server: si estrae e via, come dichiarato nell'UI.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const MAX_BASE64_LEN = 14_000_000; // ~10MB decodificati

const EXTRACT_PROMPT = `Sei un assistente che estrae informazioni da un piano alimentare/nutrizionale (dieta) caricato come foto o PDF.
Analizza il documento ed estrai l'elenco degli alimenti indicati con le relative quantità/grammature.
Rispondi ESCLUSIVAMENTE con un array JSON valido, senza testo aggiuntivo prima o dopo, in questo formato esatto:
[{"name": "nome alimento", "quantity": "quantità, es. 150 g"}]
Se un alimento non ha una quantità specificata nel documento, usa una stringa vuota "" per quantity.
Se il documento non è un piano alimentare o non contiene alimenti riconoscibili, rispondi con: []`;

function extractJsonArray(text: string): unknown {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('nessun array JSON nella risposta');
  return JSON.parse(text.slice(start, end + 1));
}

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

  const isPdf = mediaType === 'application/pdf';
  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: EXTRACT_PROMPT }] }],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error('[plan/extract] errore Anthropic API:', resp.status, errBody);
      return res.status(502).json({ error: 'Estrazione fallita (servizio AI non disponibile). Inserisci gli alimenti a mano.' });
    }

    const data = (await resp.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? '';
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) throw new Error('la risposta non è un array');

    res.json(cleanItems(parsed));
  } catch (e) {
    console.error('[plan/extract] errore:', (e as Error).message);
    res.status(502).json({ error: 'Non sono riuscito a leggere il documento. Riprova o inserisci gli alimenti a mano.' });
  }
});
