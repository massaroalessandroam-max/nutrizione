// Food-matching engine: compares logged foods against the recommended
// ("Metodo Nemis") plan. Ported 1:1 from the design prototype's
// CONSIGLIATI/SCONSIGLIATI lists and verdict()/score() logic.

export type Tone = 'good' | 'ok' | 'bad';

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

export function verdict(name: string): Tone {
  const n = name.toLowerCase().trim();
  if (SCONSIGLIATI.some((w) => n.includes(w))) return 'bad';
  if (CONSIGLIATI.some((w) => n.includes(w))) return 'good';
  return 'ok';
}

export const POINTS: Record<Tone, number> = { good: 15, ok: 8, bad: 3 };

export function pointsForFoods(foods: string[]): number {
  return foods.reduce((total, f) => total + POINTS[verdict(f)], 0);
}

export interface Score {
  label: string;
  tone: Tone | 'none';
}

export function score(foods: string[]): Score {
  if (!foods.length) return { label: '—', tone: 'ok' };
  const tones = foods.map((f) => verdict(f));
  const bad = tones.filter((t) => t === 'bad').length;
  const good = tones.filter((t) => t === 'good').length;
  if (bad === 0 && good >= 1) return { label: 'Buona scelta', tone: 'good' };
  if (bad >= 2) return { label: 'Da rivedere', tone: 'bad' };
  return { label: 'Nel complesso ok', tone: 'ok' };
}

export function verdictLabel(v: Tone): string {
  return v === 'good' ? 'Consigliato dal piano' : v === 'ok' ? 'Consentito con moderazione' : 'Da limitare';
}
