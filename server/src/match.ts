// Food-matching engine: decide se un alimento registrato è una buona
// scelta. Ordine di priorità:
//   1. Corrisponde a un alimento del piano Nemis del paziente (caricato in
//      PianoView, estratto da foto/PDF) -> 'good'.
//   2. È frutta/verdura: in stagione -> 'good', fuori stagione -> 'bad'
//      (calendario in seasonal.ts).
//   3. Fallback sulle liste generiche CONSIGLIATI/SCONSIGLIATI (ported dal
//      prototipo), altrimenti 'ok'.

import { isInSeason } from './seasonal.js';

export type Tone = 'good' | 'ok' | 'bad';
export type VerdictReason = 'divieto' | 'plan' | 'plan-over-limit' | 'season-in' | 'season-out' | 'list' | 'none';

export interface Verdict {
  tone: Tone;
  reason: VerdictReason;
}

export interface MatchContext {
  // Alimenti/comportamenti vietati dal nutrizionista (allergie, intolleranze,
  // controindicazioni) — hanno priorità assoluta su tutto il resto, piano
  // compreso: un piano scritto prima di scoprire un'allergia non deve poter
  // dare "consigliato dal piano" a un divieto.
  divieti?: string[];
  planFoods?: string[];
  // Categoria (Carboidrati/Proteine/...) per ciascun alimento del piano,
  // chiave = nome pianificato in minuscolo. Usata per accorgersi che un
  // pasto è nutrizionalmente sbilanciato (es. riso+pane+pasta) anche se
  // ogni singolo alimento preso a sé è "consigliato dal piano".
  planCategories?: Record<string, string>;
  // Nomi (lowercase) degli alimenti del piano il cui tetto settimanale
  // ("massimo X volte a settimana") è già stato raggiunto o superato questa
  // settimana — calcolato dal chiamante su meals/nutrition_plan_items.
  overLimitPlanNames?: Set<string>;
  // Mese 1-12: parametrizzabile (test, o un futuro fuso orario del
  // paziente) invece di leggere sempre l'orologio di sistema.
  month?: number;
}

export const CONSIGLIATI = [
  'yogurt', 'avena', 'fiocchi', 'mirtilli', 'frutti di bosco', 'pesce', 'salmone',
  'verdura', 'insalata', 'spinaci', 'pollo', 'tacchino', 'uova', 'frutta secca',
  'noci', 'mandorle', 'riso integrale', 'quinoa', 'lenticchie', 'ceci', 'legumi',
  'olio evo', 'acqua', 'the verde', 'frutta', 'mela', 'banana', 'broccoli', 'zucchine',
];

export const SCONSIGLIATI = [
  'zucchero', 'dolce', 'dolci', 'fritto', 'fritti', 'patatine', 'bibita', 'cola',
  'pizza', 'pane bianco', 'merendina', 'biscotti', 'alcol', 'birra', 'vino',
  'gelato', 'nutella', 'cornetto', 'brioche', 'salsiccia', 'insaccati',
];

export function foodMatches(loggedName: string, planItemName: string): boolean {
  const a = loggedName.trim();
  const b = planItemName.toLowerCase().trim();
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

export function verdictOf(name: string, ctx: MatchContext = {}): Verdict {
  const n = name.toLowerCase().trim();
  const month = ctx.month ?? new Date().getMonth() + 1;

  if (ctx.divieti?.some((d) => foodMatches(n, d))) return { tone: 'bad', reason: 'divieto' };

  const matchedPlan = ctx.planFoods?.find((p) => foodMatches(n, p));
  if (matchedPlan) {
    if (ctx.overLimitPlanNames?.has(matchedPlan.toLowerCase())) return { tone: 'bad', reason: 'plan-over-limit' };
    return { tone: 'good', reason: 'plan' };
  }

  const seasonal = isInSeason(n, month);
  if (seasonal === true) return { tone: 'good', reason: 'season-in' };
  if (seasonal === false) return { tone: 'bad', reason: 'season-out' };

  if (SCONSIGLIATI.some((w) => n.includes(w))) return { tone: 'bad', reason: 'list' };
  if (CONSIGLIATI.some((w) => n.includes(w))) return { tone: 'good', reason: 'list' };
  return { tone: 'ok', reason: 'none' };
}

export function verdict(name: string, ctx: MatchContext = {}): Tone {
  return verdictOf(name, ctx).tone;
}

export const POINTS: Record<Tone, number> = { good: 15, ok: 8, bad: 3 };

export function pointsForFoods(foods: string[], ctx: MatchContext = {}): number {
  return foods.reduce((total, f) => total + POINTS[verdict(f, ctx)], 0);
}

export interface Score {
  label: string;
  tone: Tone | 'none';
}

// Un pasto con almeno 2 alimenti riconosciuti nel piano che appartengono
// TUTTI alla stessa macro-categoria (es. riso+pane+pasta, tutti
// Carboidrati) non è un pasto completo, anche se ogni alimento preso da
// solo è "consigliato dal piano". Alimenti non riconosciuti nel piano non
// contano né a favore né contro: senza la loro categoria non possiamo
// giudicare, quindi il controllo si applica solo se ne restano almeno 2
// classificati.
function isSingleCategoryMeal(foods: string[], ctx: MatchContext): boolean {
  if (!ctx.planFoods?.length || !ctx.planCategories) return false;
  const categories = new Set<string>();
  let matched = 0;
  for (const f of foods) {
    const n = f.toLowerCase().trim();
    const matchedPlan = ctx.planFoods.find((p) => foodMatches(n, p));
    if (!matchedPlan) continue;
    const category = ctx.planCategories[matchedPlan.toLowerCase()];
    if (!category) continue;
    matched += 1;
    categories.add(category);
  }
  return matched >= 2 && categories.size === 1;
}

export function score(foods: string[], ctx: MatchContext = {}): Score {
  if (!foods.length) return { label: '—', tone: 'ok' };
  const tones = foods.map((f) => verdict(f, ctx));
  const bad = tones.filter((t) => t === 'bad').length;
  const good = tones.filter((t) => t === 'good').length;
  if (bad >= 2) return { label: 'Da rivedere', tone: 'bad' };
  if (bad === 0 && good >= 1 && !isSingleCategoryMeal(foods, ctx)) return { label: 'Buona scelta', tone: 'good' };
  return { label: 'Nel complesso ok', tone: 'ok' };
}

export function verdictLabel(v: Verdict): string {
  switch (v.reason) {
    case 'divieto': return 'Vietato dal nutrizionista';
    case 'plan': return 'Consigliato dal piano';
    case 'plan-over-limit': return 'Troppe volte questa settimana';
    case 'season-in': return 'Frutta/verdura di stagione';
    case 'season-out': return 'Fuori stagione';
    case 'list': return v.tone === 'good' ? 'Scelta consigliata' : 'Da limitare';
    default: return 'Consentito con moderazione';
  }
}
