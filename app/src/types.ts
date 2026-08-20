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
  // Saltato apposta per oggi (es. digiuno prolungato) — diverso da "non
  // ancora fatto": non conta nel denominatore del completamento giornaliero.
  skipped: boolean;
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
  current: number;
  target: number;
}

export interface MealScheduleEntry {
  enabled: boolean;
  time: string;
}

// Colazione/pranzo/cena hanno un solo orario abituale; gli spuntini possono
// essere più di uno, quindi sono una lista di orari invece di un'unica voce.
export interface Schedule {
  colazione: MealScheduleEntry;
  pranzo: MealScheduleEntry;
  cena: MealScheduleEntry;
  snacks: string[];
}

export interface FastingPref {
  enabled: boolean;
  start: string;
  end: string;
}

export interface AppState {
  date: string;
  points: number;
  streak: number;
  freq: 'meal' | 'multi' | 'day' | 'manual';
  reportSendTime: string;
  fastActive: boolean;
  fastStart: number;
  greetingName: string;
  onboarded: boolean;
  schedule: Schedule;
  // Pasti che il paziente fa di solito (da onboarding): colazione/pranzo/
  // cena non "saltati", spuntino solo se ha orari configurati. Decide quali
  // pasti mostrare in lista.
  activeMeals: MealKey[];
  // Denominatore di oggi per l'anello "X/N pasti": activeMeals meno quelli
  // marcati "salta oggi" (es. digiuno prolungato per un giorno).
  activeMealCount: number;
  fastingPref: FastingPref;
  doneCount: number;
  adherencePct: number;
  meals: Record<MealKey, MealState>;
  week: WeekDay[];
  badges: Badge[];
}

// Perché un alimento ha ricevuto quel verdetto: 'plan' = presente nel piano
// Nemis caricato dal paziente, 'season-in'/'season-out' = frutta/verdura
// di/fuori stagione, 'list' = liste generiche consigliati/sconsigliati.
export type VerdictReason = 'plan' | 'plan-over-limit' | 'season-in' | 'season-out' | 'list' | 'none';

export interface FoodVerdict {
  name: string;
  verdict: Tone;
  reason?: VerdictReason;
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
