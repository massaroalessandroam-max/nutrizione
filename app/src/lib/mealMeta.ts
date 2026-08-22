import type { MealKey } from '../types';

export const MEAL_LABEL: Record<MealKey, string> = {
  colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Spuntino',
};

// Umore dopo il pasto, 1-5 — 0 (non valutato) non ha voce qui, va gestito a parte.
export const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

export function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
