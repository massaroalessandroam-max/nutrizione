import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AppState, FastingPref, LogSummary, MealKey, Schedule, PatientDetail, PatientListItem } from '../types';
import { MEAL_ORDER } from '../types';

export type Role = 'paziente' | 'nutrizionista';
export type Tab = 'diario' | 'premi' | 'digiuno' | 'piano' | 'report';
export type LogMode = 'text' | 'audio' | 'photo';

const MOCK_PHOTO_FOODS = ['Petto di pollo', 'Insalata mista', 'Riso integrale', 'Olio evo'];

export function useDiario() {
  const [role, setRole] = useState<Role>('paziente');
  const [tab, setTab] = useState<Tab>('diario');

  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealKey>('pranzo');
  const [mode, setMode] = useState<LogMode>('text');
  const [logText, setLogText] = useState('');
  const [hasTranscript, setHasTranscript] = useState(false);
  const [photoAdded, setPhotoAdded] = useState(false);
  const [lastSummary, setLastSummary] = useState<LogSummary | null>(null);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [patients, setPatients] = useState<PatientListItem[] | null>(null);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [activePatient, setActivePatient] = useState<PatientDetail | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const refreshState = useCallback(async () => {
    const s = await api.getState();
    setAppState(s);
    return s;
  }, []);

  useEffect(() => {
    refreshState().finally(() => setLoading(false));
  }, [refreshState]);

  useEffect(() => {
    if (role !== 'nutrizionista' || activePatientId) return;
    api.getPatients().then(setPatients).catch(() => setPatients([]));
  }, [role, activePatientId]);

  useEffect(() => {
    if (!activePatientId) {
      setActivePatient(null);
      return;
    }
    api.getPatient(activePatientId).then(setActivePatient).catch(() => setActivePatient(null));
  }, [activePatientId]);

  const openSheet = useCallback((key: MealKey) => {
    const done = appState?.meals[key];
    setActiveMeal(key);
    setMode('text');
    setLogText(done?.done ? done.foods.join(', ') : '');
    setHasTranscript(!!done?.done);
    setPhotoAdded(false);
    setSheetOpen(true);
  }, [appState]);

  const openLogQuick = useCallback(() => {
    const nextMeal = MEAL_ORDER.find((k) => !appState?.meals[k]?.done) ?? 'spuntino';
    openSheet(nextMeal);
  }, [appState, openSheet]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const applyTranscript = useCallback((text: string) => {
    setLogText(text);
    setHasTranscript(true);
  }, []);

  const addPhoto = useCallback(() => setPhotoAdded(true), []);

  const submitLog = useCallback(async () => {
    let foods: string[];
    if (mode === 'photo' && photoAdded) {
      foods = MOCK_PHOTO_FOODS;
    } else {
      foods = logText.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    }
    if (!foods.length) return;

    const { state, summary } = await api.logMeal(activeMeal, foods);
    setAppState(state);
    setLastSummary(summary);
    setSheetOpen(false);
    setSummaryOpen(true);
  }, [mode, photoAdded, logText, activeMeal]);

  const closeSummary = useCallback(() => setSummaryOpen(false), []);

  const sendFromSummary = useCallback(() => {
    setSummaryOpen(false);
    showToast('Pasto inviato al nutrizionista');
  }, [showToast]);

  const completeOnboarding = useCallback(
    async (name: string, schedule: Omit<Schedule, 'snacks'>, snacks: string[], fasting: FastingPref) => {
      const s = await api.submitOnboarding(name, schedule, snacks, fasting);
      setAppState(s);
    },
    []
  );

  const deleteMeal = useCallback(async (key: MealKey) => {
    const s = await api.deleteMeal(key);
    setAppState(s);
    showToast('Pasto rimosso');
  }, [showToast]);

  const toggleFast = useCallback(async () => {
    const s = await api.toggleFast();
    setAppState(s);
  }, []);

  const setFreq = useCallback(async (freq: AppState['freq']) => {
    const s = await api.setFreq(freq);
    setAppState(s);
  }, []);

  const goDigiuno = useCallback(() => setTab('digiuno'), []);

  const selectPatient = useCallback((id: string) => setActivePatientId(id), []);
  const backToList = useCallback(() => setActivePatientId(null), []);

  const changeRole = useCallback((r: Role) => {
    setRole(r);
    if (r === 'nutrizionista') setActivePatientId(null);
  }, []);

  return {
    role, changeRole, tab, setTab,
    appState, loading, refreshState,
    sheetOpen, openSheet, openLogQuick, closeSheet,
    summaryOpen, closeSummary, sendFromSummary, lastSummary,
    activeMeal, setActiveMeal,
    mode, setMode,
    logText, setLogText,
    hasTranscript, applyTranscript,
    photoAdded, addPhoto,
    submitLog,
    toast, showToast,
    completeOnboarding,
    deleteMeal,
    toggleFast, setFreq, goDigiuno,
    patients, activePatientId, activePatient, selectPatient, backToList,
  };
}

export type Diario = ReturnType<typeof useDiario>;
