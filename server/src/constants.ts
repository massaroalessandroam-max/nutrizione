export const ORDER = ['colazione', 'pranzo', 'cena', 'spuntino'] as const;
export type MealKey = (typeof ORDER)[number];

export const LABEL: Record<MealKey, string> = {
  colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Spuntino',
};

export const SHORT: Record<MealKey, string> = {
  colazione: 'COL', pranzo: 'PRA', cena: 'CEN', spuntino: 'SPU',
};

export function isMealKey(v: string): v is MealKey {
  return (ORDER as readonly string[]).includes(v);
}
