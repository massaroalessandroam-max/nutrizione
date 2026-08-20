// Helper condiviso per mandare un file (immagine o PDF, base64) + un prompt
// testuale a Claude e leggere la risposta come array JSON. Usato sia
// dall'estrazione del piano nutrizionista che dal riconoscimento alimenti
// da foto pasto. Chiamata via fetch nativo invece dell'SDK: una richiesta
// HTTP semplice non giustifica una dipendenza in più. Il file non viene mai
// salvato lato server: si estrae e via.
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
export const MAX_BASE64_LEN = 14_000_000; // ~10MB decodificati

export function extractJsonArray(text: string): unknown {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('nessun array JSON nella risposta');
  return JSON.parse(text.slice(start, end + 1));
}

// Lancia un errore con .code = 'api_unavailable' se la chiamata ad Anthropic
// fallisce (rete/HTTP), per distinguerlo da un errore di parsing della
// risposta — i chiamanti mostrano messaggi diversi per i due casi.
async function callClaude(content: unknown[], maxTokens: number): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    console.error('[anthropic] errore API:', resp.status, errBody);
    throw Object.assign(new Error(`anthropic_error_${resp.status}`), { code: 'api_unavailable' });
  }

  const data = (await resp.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text ?? '';
}

export async function callClaudeWithFile(
  fileBase64: string, mediaType: string, prompt: string, maxTokens: number
): Promise<string> {
  const isPdf = mediaType === 'application/pdf';
  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } };
  return callClaude([contentBlock, { type: 'text', text: prompt }], maxTokens);
}

export async function callClaudeText(prompt: string, maxTokens: number): Promise<string> {
  return callClaude([{ type: 'text', text: prompt }], maxTokens);
}
