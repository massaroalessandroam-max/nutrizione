import type { AppState, MealKey } from '../types';
import { MEAL_ORDER } from '../types';

export function buildReportWhatsappText(state: AppState): string {
  const lines = [`*Diario Nemis* — ${state.greetingName}, ${state.date}`, ''];
  for (const key of MEAL_ORDER as MealKey[]) {
    const m = state.meals[key];
    if (!m.done) continue;
    lines.push(`${m.label} (${m.time}): ${m.foods.join(', ')} — ${m.scoreLabel}`);
  }
  lines.push('', `Aderenza giornata: ${state.adherencePct}%`);
  return lines.join('\n');
}

export function buildWhatsappLink(text: string, phone?: string): string {
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}
