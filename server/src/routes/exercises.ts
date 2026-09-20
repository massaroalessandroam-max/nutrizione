import { Router } from 'express';
import { requirePatient } from '../auth.js';

const EDB_BASE = 'https://oss.exercisedb.dev/api/v1';
const PAGE_SIZE = 25;
const PAGE_DELAY_MS = 3000;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface Exercise {
  exerciseId: string;
  name: string;
  gifUrl: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
}

interface EdbPage {
  success: boolean;
  meta: { hasNextPage: boolean; nextCursor: string | null };
  data: Exercise[];
}

// Catalogo statico (1500 esercizi) tenuto in memoria. L'endpoint di ricerca
// remoto (/exercises/search) risponde sempre vuoto qualunque sia la query, e
// il tier gratuito ha un rate limit talvolta talmente stretto che anche 2s
// tra una richiesta e l'altra fanno scattare 429 — bloccare una richiesta
// del paziente finché tutte le ~60 pagine non arrivano l'ha fatta restare
// appesa per minuti in prova. Invece: si risponde sempre con quello che c'è
// in cache *adesso* (anche vuota o parziale appena dopo un riavvio), mentre
// il riempimento prosegue lento in background, una pagina alla volta.
let cache: Exercise[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(cursor: string | null): Promise<EdbPage | null> {
  const url = new URL(`${EDB_BASE}/exercises`);
  url.searchParams.set('limit', String(PAGE_SIZE));
  // Il parametro si chiama "after", non "offset" (non documentato in modo
  // ovvio) — con "offset" l'API ignora il valore e ripete sempre pagina 1.
  if (cursor) url.searchParams.set('after', cursor);
  const res = await fetch(url);
  if (res.status === 429) return null; // riprova al prossimo giro del loop
  if (!res.ok) throw new Error(`exercisedb ${res.status}`);
  return res.json() as Promise<EdbPage>;
}

async function fillCacheLoop() {
  let cursor: string | null = null;
  // Map invece di array: l'API si è già mostrata inaffidabile (paginazione
  // e ricerca rotte su parametri "ovvi" ma sbagliati) — dedup per id è
  // un'assicurazione a costo zero contro un'altra sorpresa del genere.
  const byId = new Map<string, Exercise>();
  for (;;) {
    const page = await fetchPage(cursor);
    if (page) {
      for (const ex of page.data) byId.set(ex.exerciseId, ex);
      cache = [...byId.values()]; // ogni pagina arrivata è subito visibile alle richieste in corso
      if (!page.meta.hasNextPage || !page.meta.nextCursor) break;
      cursor = page.meta.nextCursor;
    }
    await sleep(PAGE_DELAY_MS);
  }
}

// ponytail: nessun retry/backoff mirato sul singolo 429 — il loop
// semplicemente ritenta al giro successivo. Se serve un refresh più
// reattivo di 24h, va aggiunto un trigger esplicito qui.
function startBackgroundRefresh() {
  fillCacheLoop().catch((e) => console.error('[exercises] catalogo non caricato:', (e as Error).message));
  setInterval(() => {
    fillCacheLoop().catch((e) => console.error('[exercises] refresh catalogo fallito:', (e as Error).message));
  }, REFRESH_INTERVAL_MS);
}
startBackgroundRefresh();

export const exercisesRouter = Router();
exercisesRouter.use(requirePatient);

exercisesRouter.get('/exercises/bodyparts', (_req, res) => {
  const set = new Set<string>();
  for (const ex of cache) for (const bp of ex.bodyParts) set.add(bp);
  res.json([...set].sort());
});

exercisesRouter.get('/exercises', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const bodyPart = String(req.query.bodyPart ?? '').trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const filtered = cache.filter((ex) => {
    if (bodyPart && !ex.bodyParts.some((b) => b.toLowerCase() === bodyPart)) return false;
    if (q && !ex.name.toLowerCase().includes(q)) return false;
    return true;
  });

  res.json({ total: filtered.length, items: filtered.slice(offset, offset + limit), catalogReady: cache.length > 0 });
});
