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
export type VerdictReason = 'plan' | 'season-in' | 'season-out' | 'list' | 'none';

export interface Verdict {
  tone: Tone;
  reason: VerdictReason;
}

export interface MatchContext {
  planFoods?: string[];
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

function foodMatches(loggedName: string, planItemName: string): boolean {
  const a = loggedName.trim();
  const b = planItemName.toLowerCase().trim();
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

export function verdictOf(name: string, ctx: MatchContext = {}): Verdict {
  const n = name.toLowerCase().trim();
  const month = ctx.month ?? new Date().getMonth() + 1;

  if (ctx.planFoods?.some((p) => foodMatches(n, p))) return { tone: 'good', reason: 'plan' };

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

export function score(foods: string[], ctx: MatchContext = {}): Score {
  if (!foods.length) return { label: '—', tone: 'ok' };
  const tones = foods.map((f) => verdict(f, ctx));
  const bad = tones.filter((t) => t === 'bad').length;
  const good = tones.filter((t) => t === 'good').length;
  if (bad === 0 && good >= 1) return { label: 'Buona scelta', tone: 'good' };
  if (bad >= 2) return { label: 'Da rivedere', tone: 'bad' };
  return { label: 'Nel complesso ok', tone: 'ok' };
}

export function verdictLabel(v: Verdict): string {
  switch (v.reason) {
    case 'plan': return 'Consigliato dal piano';
    case 'season-in': return 'Frutta/verdura di stagione';
    case 'season-out': return 'Fuori stagione';
    case 'list': return v.tone === 'good' ? 'Scelta consigliata' : 'Da limitare';
    default: return 'Consentito con moderazione';
  }
}
