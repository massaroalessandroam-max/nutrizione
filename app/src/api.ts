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
  toggleFast: () => req<AppState>('/fast/toggle', { method: 'POST' }),
  setFreq: (freq: AppState['freq']) =>
    req<AppState>('/settings/freq', { method: 'PUT', body: JSON.stringify({ freq }) }),
  submitOnboarding: (name: string, schedule: Omit<Schedule, 'snacks'>, snacks: string[], fasting: FastingPref) =>
    req<AppState>('/onboarding', { method: 'POST', body: JSON.stringify({ name, schedule, snacks, fasting }) }),
  getPlan: () => req<PlanItem[]>('/plan'),
  savePlan: (items: PlanItem[]) => req<PlanItem[]>('/plan', { method: 'POST', body: JSON.stringify({ items }) }),
  getPatients: () => req<PatientListItem[]>('/patients'),
  getPatient: (id: string) => req<PatientDetail>(`/patients/${id}`),
};

export interface PlanItem {
  name: string;
  quantity: string;
}
