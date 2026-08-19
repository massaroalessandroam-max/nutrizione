import { Router } from 'express';
import { ANTHROPIC_API_KEY, MAX_BASE64_LEN, callClaudeWithFile, extractJsonArray } from '../anthropic.js';

export const mealPhotoRouter = Router();

const MEAL_PHOTO_PROMPT = `Sei un assistente che riconosce gli alimenti in una foto di un pasto.
Analizza la foto ed elenca gli alimenti visibili, con un nome breve in italiano (es. "Petto di pollo", "Insalata mista"), senza indicare quantità o grammature.
Rispondi ESCLUSIVAMENTE con un array JSON di stringhe, senza testo aggiuntivo prima o dopo, in questo formato esatto:
["alimento 1", "alimento 2"]
Se la foto non mostra un pasto o non riesci a riconoscere alimenti, rispondi con: []`;

mealPhotoRouter.post('/meal-photo/extract', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Riconoscimento non disponibile: ANTHROPIC_API_KEY non configurata sul server.' });
  }

  const { fileBase64, mediaType } = req.body ?? {};
  if (typeof fileBase64 !== 'string' || !fileBase64 || typeof mediaType !== 'string' || !mediaType) {
    return res.status(400).json({ error: 'file mancante' });
  }
  if (fileBase64.length > MAX_BASE64_LEN) {
    return res.status(413).json({ error: 'File troppo grande (limite ~10MB)' });
  }

  try {
    const text = await callClaudeWithFile(fileBase64, mediaType, MEAL_PHOTO_PROMPT, 1024);
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) throw new Error('la risposta non è un array');

    const foods = (parsed as unknown[]).map((f) => String(f).trim()).filter(Boolean);
    res.json(foods);
  } catch (e) {
    if ((e as any).code === 'api_unavailable') {
      return res.status(502).json({ error: 'Riconoscimento fallito (servizio AI non disponibile). Inserisci gli alimenti a mano.' });
    }
    console.error('[meal-photo/extract] errore:', (e as Error).message);
    res.status(502).json({ error: 'Non sono riuscito a riconoscere gli alimenti nella foto. Riprova o inserisci a mano.' });
  }
});
