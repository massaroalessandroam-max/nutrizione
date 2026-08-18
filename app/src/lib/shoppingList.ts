import type { PlanItem } from '../api';

export const SHOPPING_DAY_OPTIONS = [2, 3, 7] as const;
export type ShoppingDays = (typeof SHOPPING_DAY_OPTIONS)[number];

function parseQuantity(q: string): { value: number; unit: string } | null {
  const m = q.trim().match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(value)) return null;
  return { value, unit: m[2].trim() };
}

// Il piano indica quantità per pasto/giorno; per la spesa moltiplichiamo
// per i giorni scelti. ponytail: assume un consumo giornaliero costante di
// ogni alimento (non sappiamo dal piano quante volte a settimana ricorre) —
// approssimazione ragionevole, da affinare se il piano diventa più
// strutturato (es. con frequenza settimanale per alimento).
export function scaleQuantity(q: string, days: number): string {
  const parsed = parseQuantity(q);
  if (!parsed) return q ? `${q} × ${days}` : '';
  const scaled = Math.round(parsed.value * days * 10) / 10;
  return parsed.unit ? `${scaled} ${parsed.unit}` : `${scaled}`;
}

export interface ShoppingEntry {
  name: string;
  quantity: string;
}

export function buildShoppingList(items: PlanItem[], days: number): ShoppingEntry[] {
  return items
    .filter((it) => it.name.trim())
    .map((it) => ({ name: it.name, quantity: scaleQuantity(it.quantity, days) }));
}
