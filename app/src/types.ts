export type MealKey = 'colazione' | 'pranzo' | 'cena' | 'spuntino';
export const MEAL_ORDER: MealKey[] = ['colazione', 'pranzo', 'cena', 'spuntino'];

export type Tone = 'good' | 'ok' | 'bad';

export interface MealState {
  done: boolean;
  foods: string[];
  time: string;
  label: string;
  scoreLabel: string;
  tone: Tone;
}

export interface WeekDay {
  date: string;
  dayLabel: string;
  doneCount: number;
  isToday: boolean;
}

export interface Badge {
  key: string;
  name: string;
  desc: string;
  icon: string;
  earned: boolean;
}

export interface AppState {
  date: string;
  points: number;
  streak: number;
  freq: 'meal' | 'multi' | 'day' | 'manual';
  fastActive: boolean;
  fastStart: number;
  greetingName: string;
  doneCount: number;
  adherencePct: number;
  meals: Record<MealKey, MealState>;
  week: WeekDay[];
  badges: Badge[];
}

export interface FoodVerdict {
  name: string;
  verdict: Tone;
}

export interface LogSummary {
  key: MealKey;
  label: string;
  foods: FoodVerdict[];
  score: { label: string; tone: Tone | 'none' };
  pointsEarned: number;
}

export interface LogResponse {
  state: AppState;
  summary: LogSummary;
}

export interface PatientListItem {
  id: string;
  name: string;
  initials: string;
  adherence: string;
  tone: Tone;
  last: string;
  time: string;
}

export interface PatientLogMeal {
  key: MealKey;
  label: string;
  time: string;
  scoreLabel: string;
  tone: Tone;
  foods: FoodVerdict[];
}

export interface PatientDetail {
  id: string;
  name: string;
  initials: string;
  plan: string;
  adherence: string;
  tone: Tone;
  streak: number;
  mealsToday: number;
  log: PatientLogMeal[];
}
