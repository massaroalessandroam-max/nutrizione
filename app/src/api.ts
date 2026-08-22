import type { AppState, LogResponse, PatientListItem, PatientDetail, MealKey, DayMealState, Schedule, FastingPref, Tone, Habit, HabitFrequency } from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getState: () => req<AppState>('/state'),
  // date facoltativa: assente = oggi (comportamento invariato), altrimenti
  // backfill di un giorno precedente aperto dal grafico "Andamento".
  logMeal: (key: MealKey, foods: string[], date?: string) =>
    req<LogResponse>(`/meals/${key}/log`, { method: 'POST', body: JSON.stringify({ foods, date }) }),
  updateMealFoods: (key: MealKey, foods: string[], date?: string) =>
    req<AppState>(`/meals/${key}/log`, { method: 'PUT', body: JSON.stringify({ foods, date }) }),
  deleteMeal: (key: MealKey, date?: string) =>
    req<AppState>(`/meals/${key}/log${date ? `?date=${date}` : ''}`, { method: 'DELETE' }),
  skipMeal: (key: MealKey, skipped: boolean) =>
    req<AppState>(`/meals/${key}/skip`, { method: 'PUT', body: JSON.stringify({ skipped }) }),
  setMealMood: (key: MealKey, mood: number, date?: string) =>
    req<AppState>(`/meals/${key}/mood`, { method: 'PUT', body: JSON.stringify({ mood, date }) }),
  getMealsForDate: (date: string) => req<Record<MealKey, DayMealState>>(`/meals?date=${date}`),
  toggleFast: () => req<AppState>('/fast/toggle', { method: 'POST' }),
  setFreq: (freq: AppState['freq']) =>
    req<AppState>('/settings/freq', { method: 'PUT', body: JSON.stringify({ freq }) }),
  submitOnboarding: (name: string, schedule: Omit<Schedule, 'snacks'>, snacks: string[], fasting: FastingPref) =>
    req<AppState>('/onboarding', { method: 'POST', body: JSON.stringify({ name, schedule, snacks, fasting }) }),
  getPlan: () => req<PlanItem[]>('/plan'),
  savePlan: (items: PlanItem[]) => req<PlanItem[]>('/plan', { method: 'POST', body: JSON.stringify({ items }) }),
  extractPlan: (fileBase64: string, mediaType: string, filename: string, signal?: AbortSignal) =>
    req<ExtractedPlan>('/plan/extract', { method: 'POST', body: JSON.stringify({ fileBase64, mediaType, filename }), signal }),
  getPlanUploads: () => req<PlanUpload[]>('/plan/uploads'),
  getPlanNotes: () => req<PlanNotes>('/plan/notes'),
  savePlanNotes: (notes: PlanNotes) => req<PlanNotes>('/plan/notes', { method: 'POST', body: JSON.stringify(notes) }),
  extractMealPhoto: (fileBase64: string, mediaType: string) =>
    req<string[]>('/meal-photo/extract', { method: 'POST', body: JSON.stringify({ fileBase64, mediaType }) }),
  getPatients: () => req<PatientListItem[]>('/patients'),
  getPatient: (id: string) => req<PatientDetail>(`/patients/${id}`),
  getReportActivity: (month: string) => req<string[]>(`/report/activity?month=${month}`),
  getReport: (from: string, to: string) => req<Report>(`/report?from=${from}&to=${to}`),
  getReportMacros: (from: string, to: string) => req<ReportMacros>(`/report/macros?from=${from}&to=${to}`),
  setReportTime: (time: string) => req<AppState>('/settings/report-time', { method: 'PUT', body: JSON.stringify({ time }) }),
  getReportRecipients: () => req<ReportRecipient[]>('/report/recipients'),
  addReportRecipient: (email: string, alias: string) =>
    req<ReportRecipient[]>('/report/recipients', { method: 'POST', body: JSON.stringify({ email, alias }) }),
  deleteReportRecipient: (id: number) => req<ReportRecipient[]>(`/report/recipients/${id}`, { method: 'DELETE' }),
  getReportHistory: () => req<ReportHistoryEntry[]>('/report/history'),
  getReportHistoryDetail: (id: number) => req<ReportHistoryDetail>(`/report/history/${id}`),
  getSupplementCatalog: () => req<SupplementCatalogItem[]>('/supplements/catalog'),
  getCustomSupplements: () => req<CustomSupplement[]>('/supplements/custom'),
  saveCustomSupplements: (items: CustomSupplement[]) =>
    req<CustomSupplement[]>('/supplements/custom', { method: 'POST', body: JSON.stringify({ items }) }),
  getSupplementLog: () => req<SupplementLogEntry[]>('/supplements/log'),
  logSupplement: (name: string, quantity: string, time: string) =>
    req<SupplementLogEntry[]>('/supplements/log', { method: 'POST', body: JSON.stringify({ name, quantity, time }) }),
  deleteSupplementLog: (id: number) => req<SupplementLogEntry[]>(`/supplements/log/${id}`, { method: 'DELETE' }),
  getChefCombos: () => req<ChefCombo[]>('/chef/combos'),
  saveChefCombo: (combo: { id?: number; mealKey: MealKey; days: string[]; slots: ChefSlotItem[] }) =>
    req<{ id: number; combos: ChefCombo[] }>('/chef/combos', { method: 'POST', body: JSON.stringify(combo) }),
  deleteChefCombo: (id: number) => req<ChefCombo[]>(`/chef/combos/${id}`, { method: 'DELETE' }),
  getHabits: () => req<Habit[]>('/habits'),
  saveHabits: (items: Array<{ id?: number; text: string; frequency: HabitFrequency; targetPerWeek: number; time: string }>) =>
    req<Habit[]>('/habits', { method: 'POST', body: JSON.stringify({ items }) }),
  checkHabit: (id: number, done: boolean) =>
    req<Habit[]>(`/habits/${id}/check`, { method: 'PUT', body: JSON.stringify({ done }) }),
};

export const PLAN_CATEGORIES = ['Carboidrati', 'Proteine', 'Legumi', 'Grassi', 'Frutta', 'Verdura', 'Latticini'] as const;
export const MAX_PER_WEEK_OPTIONS = ['1', '2', '3', 'sempre', 'opzionale'] as const;
export type MaxPerWeek = (typeof MAX_PER_WEEK_OPTIONS)[number];

export interface PlanItem {
  name: string;
  quantity: string;
  category: string;
  maxPerWeek: string;
}

// Testo del piano che non è un "alimento con grammatura": regole generali
// valide per ogni pasto, esempi di pasto completo per tipologia, e divieti
// espliciti (allergie/intolleranze) — separati dagli alimenti (PlanItem)
// perché non hanno quantità/frequenza, sono testo libero.
export interface PlanNotes {
  generalRules: string[];
  mealExamples: Record<MealKey, string[]>;
  divieti: string[];
}

export interface ExtractedPlan extends PlanNotes {
  items: PlanItem[];
}

export interface PlanUpload {
  id: number;
  filename: string;
  mediaType: string;
  uploadedAt: string;
}

export const planUploadDownloadUrl = (id: number) => `/api/plan/uploads/${id}/download`;

export interface ReportMeal {
  key: MealKey;
  label: string;
  time: string;
  foods: string[];
  scoreLabel: string;
  tone: Tone;
}

export interface ReportDay {
  date: string;
  meals: ReportMeal[];
}

export interface Report {
  from: string;
  to: string;
  days: ReportDay[];
  totalMeals: number;
  adherencePct: number;
}

export interface ReportMacroItem {
  date: string;
  food: string;
  weight: number;
}

export interface ReportMacroCategory {
  pct: number;
  items: ReportMacroItem[];
}

export interface ReportMacroPeriod {
  from: string;
  to: string;
  total: number;
  categories: Record<string, ReportMacroCategory>;
}

export interface ReportMacros {
  current: ReportMacroPeriod;
  previous: ReportMacroPeriod;
}

export interface ReportRecipient {
  id: number;
  email: string;
  alias: string;
}

export interface ReportHistoryEntry {
  id: number;
  sentAt: string;
  recipients: string[];
  from: string;
  to: string;
}

export interface ReportHistoryDetail extends ReportHistoryEntry {
  bodyText: string;
}

export interface SupplementCatalogItem {
  name: string;
  dosageHint: string;
  url: string;
}

export interface CustomSupplement {
  name: string;
  dosage: string;
}

export interface SupplementLogEntry {
  id: number;
  name: string;
  quantity: string;
  time: string;
}

export interface ChefSlotItem {
  category: string;
  name: string;
  quantity: string;
}

export interface ChefCombo {
  id: number;
  mealKey: MealKey;
  days: string[];
  slots: ChefSlotItem[];
}
