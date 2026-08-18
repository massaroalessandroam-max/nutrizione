// Derives streak / weekly chart / badges from the real meal history in
// `meals` — no more hardcoded demo numbers. Everything here is computed
// from rows the patient has actually logged.
import { db } from './db.js';
import { ORDER } from './constants.js';
import { verdict } from './match.js';

interface MealRow {
  date: string;
  meal_key: string;
  done: number;
  foods: string;
}

async function allMealRows(): Promise<MealRow[]> {
  const { rows } = await db.execute('SELECT date, meal_key, done, foods FROM meals ORDER BY date DESC');
  return rows as unknown as MealRow[];
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Consecutive days (ending today) with at least one meal logged. Today
 * doesn't break the streak if nothing's logged yet — it just doesn't count
 * until something is. */
export async function computeStreak(today: string): Promise<number> {
  const rows = await allMealRows();
  const doneDates = new Set(rows.filter((r) => r.done).map((r) => r.date));

  let streak = 0;
  const cursor = new Date(`${today}T00:00:00Z`);
  for (;;) {
    const key = toDateKey(cursor);
    if (doneDates.has(key)) {
      streak += 1;
    } else if (key !== today) {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (streak > 3650) break; // sanity guard
  }
  return streak;
}

export interface WeekDay {
  date: string;
  dayLabel: string;
  doneCount: number;
  isToday: boolean;
}

/** Last 7 calendar days (oldest → today), with how many meals were
 * completed each day. */
export async function computeWeek(today: string): Promise<WeekDay[]> {
  const rows = await allMealRows();
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (!r.done) continue;
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1);
  }

  const dayLabels = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
  const days: WeekDay[] = [];
  const cursor = new Date(`${today}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - 6);
  for (let i = 0; i < 7; i++) {
    const key = toDateKey(cursor);
    days.push({
      date: key,
      dayLabel: dayLabels[cursor.getUTCDay()],
      doneCount: byDate.get(key) ?? 0,
      isToday: key === today,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export interface Badge {
  key: string;
  name: string;
  desc: string;
  icon: string;
  earned: boolean;
}

export async function computeBadges(streak: number): Promise<Badge[]> {
  const rows = await allMealRows();

  let goodBreakfasts = 0;
  const goodFoods = new Set<string>();
  for (const r of rows) {
    if (!r.done) continue;
    const foods: string[] = JSON.parse(r.foods);
    for (const f of foods) {
      // ponytail: badge sui alimenti storici valutati con le regole di
      // OGGI (mese corrente, nessun piano) invece che con mese/piano validi
      // quel giorno — approssimazione accettabile per un conteggio
      // gamification, da rivedere se serve precisione storica.
      if (verdict(f) === 'good') {
        goodFoods.add(f.toLowerCase());
        if (r.meal_key === ORDER[0]) goodBreakfasts += 1;
      }
    }
  }

  return [
    { key: 'week1', name: 'Prima settimana', desc: '7 giorni consecutivi', icon: '🌱', earned: streak >= 7 },
    { key: 'breakfast', name: 'Colazione top', desc: '10 colazioni consigliate', icon: '☀️', earned: goodBreakfasts >= 10 },
    { key: 'variety', name: 'Varietà', desc: '20 alimenti consigliati diversi', icon: '🥗', earned: goodFoods.size >= 20 },
    { key: 'consistency', name: 'Costanza', desc: '30 giorni · in corso', icon: '🏆', earned: streak >= 30 },
  ];
}
