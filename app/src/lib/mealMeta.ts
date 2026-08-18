import type { MealKey } from '../types';

export const MEAL_SHORT: Record<MealKey, string> = {
  colazione: 'COL', pranzo: 'PRA', cena: 'CEN', spuntino: 'SPU',
};

export function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
