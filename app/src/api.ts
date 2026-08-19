import type { AppState, LogResponse, PatientListItem, PatientDetail, MealKey, Schedule, FastingPref } from './types';

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
};

export const PLAN_CATEGORIES = ['Carboidrati', 'Proteine', 'Frutta e verdura', 'Latticini'] as const;
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
