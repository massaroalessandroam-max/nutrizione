import type { AppState, LogResponse, PatientListItem, PatientDetail, MealKey, Schedule, FastingPref, Tone } from './types';

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
  logMeal: (key: MealKey, foods: string[]) =>
    req<LogResponse>(`/meals/${key}/log`, { method: 'POST', body: JSON.stringify({ foods }) }),
  updateMealFoods: (key: MealKey, foods: string[]) =>
    req<AppState>(`/meals/${key}/log`, { method: 'PUT', body: JSON.stringify({ foods }) }),
  deleteMeal: (key: MealKey) => req<AppState>(`/meals/${key}/log`, { method: 'DELETE' }),
  skipMeal: (key: MealKey, skipped: boolean) =>
    req<AppState>(`/meals/${key}/skip`, { method: 'PUT', body: JSON.stringify({ skipped }) }),
  toggleFast: () => req<AppState>('/fast/toggle', { method: 'POST' }),
  setFreq: (freq: AppState['freq']) =>
    req<AppState>('/settings/freq', { method: 'PUT', body: JSON.stringify({ freq }) }),
  submitOnboarding: (name: string, schedule: Omit<Schedule, 'snacks'>, snacks: string[], fasting: FastingPref) =>
    req<AppState>('/onboarding', { method: 'POST', body: JSON.stringify({ name, schedule, snacks, fasting }) }),
  getPlan: () => req<PlanItem[]>('/plan'),
  savePlan: (items: PlanItem[]) => req<PlanItem[]>('/plan', { method: 'POST', body: JSON.stringify({ items }) }),
  extractPlan: (fileBase64: string, mediaType: string, filename: string, signal?: AbortSignal) =>
    req<PlanItem[]>('/plan/extract', { method: 'POST', body: JSON.stringify({ fileBase64, mediaType, filename }), signal }),
  getPlanUploads: () => req<PlanUpload[]>('/plan/uploads'),
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
