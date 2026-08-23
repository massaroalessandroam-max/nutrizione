import type { Habit, Weekday } from '../types';

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

export type DayPeriod = 'mattina' | 'pomeriggio' | 'sera';
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

/** Ordina cronologicamente e raggruppa in mattina/pomeriggio/sera; le
 * abitudini senza orario finiscono in coda al proprio gruppo. */
export function groupByPeriod<T extends { time: string }>(items: T[]): Array<[DayPeriod, T[]]> {
  const sorted = [...items].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const groups: Record<DayPeriod, T[]> = { mattina: [], pomeriggio: [], sera: [] };
  for (const it of sorted) groups[periodOf(it.time)].push(it);
  return (['mattina', 'pomeriggio', 'sera'] as DayPeriod[])
    .map((p): [DayPeriod, T[]] => [p, groups[p]])
    .filter(([, list]) => list.length > 0);
}
