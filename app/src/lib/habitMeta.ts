import type { DayPeriod, Habit, Weekday } from '../types';

// Forma di lavoro condivisa tra AbitudiniView e HabitConfigView (senza lo
// stato del giorno) — vive qui, non in nessuno dei due componenti, per
// evitare un import circolare tra loro.
export interface HabitDef { id?: number; text: string; days: Weekday[]; time: string; category: DayPeriod | null }
export const asHabitDef = (h: Habit): HabitDef => ({ id: h.id, text: h.text, days: h.days, time: h.time, category: h.category });

// Ordine "italiano" della settimana (lunedì primo), stesso ordine usato lato
// server in WEEKDAYS (server/src/routes/habits.ts).
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABEL: Record<Weekday, string> = {
  mon: 'L', tue: 'M', wed: 'M', thu: 'G', fri: 'V', sat: 'S', sun: 'D',
};

const JS_DAY_TO_CODE: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function weekdayCodeOf(date: Date): Weekday {
  return JS_DAY_TO_CODE[date.getDay()];
}

export function isDueOn(habit: Pick<Habit, 'days'>, code: Weekday): boolean {
  return habit.days.length === 0 || habit.days.includes(code);
}

export const DAY_PERIODS: DayPeriod[] = ['mattina', 'pomeriggio', 'sera'];
export const PERIOD_LABEL: Record<DayPeriod, string> = { mattina: 'Mattina', pomeriggio: 'Pomeriggio', sera: 'Sera' };

// Nessun orario impostato -> in coda al mattino (semplificazione: non c'è un
// "senza orario" a parte, va messo in un secchio).
export function periodOf(time: string): DayPeriod {
  if (!time) return 'mattina';
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return 'mattina';
  if (hour < 18) return 'pomeriggio';
  return 'sera';
}

// Categoria scelta esplicitamente in "Configura Abitudine" vince; altrimenti
// si deriva dall'orario come prima (e questo corregge anche il caso di
// un'abitudine senza orario, che finiva sempre in "mattina" a prescindere).
export function effectivePeriod(item: { time: string; category?: DayPeriod | null }): DayPeriod {
  return item.category ?? periodOf(item.time);
}

/** Ordina cronologicamente e raggruppa in mattina/pomeriggio/sera; le
 * abitudini senza orario finiscono in coda al proprio gruppo. */
export function groupByPeriod<T extends { time: string; category?: DayPeriod | null }>(items: T[]): Array<[DayPeriod, T[]]> {
  const sorted = [...items].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const groups: Record<DayPeriod, T[]> = { mattina: [], pomeriggio: [], sera: [] };
  for (const it of sorted) groups[effectivePeriod(it)].push(it);
  return DAY_PERIODS
    .map((p): [DayPeriod, T[]] => [p, groups[p]])
    .filter(([, list]) => list.length > 0);
}
