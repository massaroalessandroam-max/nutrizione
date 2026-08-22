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
  // Umore dopo il pasto, 1-5, 0 = non ancora valutato.
  mood: number;
}

// Sottoinsieme di MealState per un giorno che non è oggi: senza label/
// scoreLabel/tone (calcolati solo dentro buildState per lo stato del
// giorno corrente) — usato per il backfill di un giorno precedente.
export interface DayMealState {
  done: boolean;
  foods: string[];
  time: string;
  skipped: boolean;
  mood: number;
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
  // Prossima visita impostata dal nutrizionista, facoltativa — stringa vuota se non impostata.
  nextVisitAt: string;
  nextVisitNote: string;
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
  date: string;
  label: string;
  foods: FoodVerdict[];
  score: { label: string; tone: Tone | 'none' };
  pointsEarned: number;
}

export interface LogResponse {
  state: AppState;
  summary: LogSummary;
}

export type HabitFrequency = 'daily' | 'weekly';

export interface Habit {
  id: number;
  text: string;
  frequency: HabitFrequency;
  targetPerWeek: number;
  // Orario abituale, facoltativo (es. "08:00") — stringa vuota se non impostato.
  time: string;
  // Spuntata oggi (finestra mobile 7 giorni per weekCount, non settimana solare).
  doneToday: boolean;
  weekCount: number;
}

export interface NutritionistPatientListItem {
  id: number;
  name: string;
  onboarded: boolean;
  adherencePct: number;
  streak: number;
  points: number;
  nextVisitAt: string;
  nextVisitNote: string;
}

export interface NutritionistPatientDetail {
  id: number;
  name: string;
  nextVisitAt: string;
  nextVisitNote: string;
  state: AppState;
  habits: Habit[];
  plan: { items: PlanItemLite[]; notes: PlanNotesLite };
}

// Copie leggere di PlanItem/PlanNotes (definiti in api.ts) per evitare un
// giro di import circolare da types.ts — stessa forma.
export interface PlanItemLite {
  name: string;
  quantity: string;
  category: string;
  maxPerWeek: string;
}

export interface PlanNotesLite {
  generalRules: string[];
  mealExamples: Record<MealKey, string[]>;
  divieti: string[];
}

export interface NutritionistTeamMember {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

export type MessageSender = 'paziente' | 'nutrizionista';

export interface Message {
  id: number;
  sender: MessageSender;
  text: string;
  createdAt: string;
}
