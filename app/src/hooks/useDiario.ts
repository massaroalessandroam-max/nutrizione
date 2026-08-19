import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { fileToBase64 } from '../lib/file';
import type { AppState, FastingPref, LogSummary, MealKey, Schedule, PatientDetail, PatientListItem } from '../types';
import { MEAL_ORDER } from '../types';

export type Role = 'paziente' | 'nutrizionista';
export type Tab = 'diario' | 'premi' | 'digiuno' | 'piano' | 'report';
export type LogMode = 'text' | 'audio' | 'photo';

export function useDiario() {
  const [role, setRole] = useState<Role>('paziente');
  const [tab, setTab] = useState<Tab>('diario');

  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealKey>('pranzo');
  const [mealLocked, setMealLocked] = useState(true);
  const [mode, setMode] = useState<LogMode>('text');
  const [logText, setLogText] = useState('');
  const [hasTranscript, setHasTranscript] = useState(false);
  const [photoFoods, setPhotoFoods] = useState<string[] | null>(null);
  const [photoExtracting, setPhotoExtracting] = useState(false);
  const [photoError, setPhotoError] = useState('');
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

  // key: locked di default (tap su un pasto specifico dal Diario) -> nel
  // sheet non si può cambiare pasto. Il testo/foto parte sempre vuoto: ogni
  // registrazione si AGGIUNGE a quelle già fatte per quel pasto oggi (es.
  // yogurt alle 6, poi uova e pane alle 8), non le sostituisce.
  const openSheet = useCallback((key: MealKey, locked = true) => {
    setActiveMeal(key);
    setMode('text');
    setLogText('');
    setHasTranscript(false);
    setPhotoFoods(null);
    setPhotoError('');
    setMealLocked(locked);
    setSheetOpen(true);
  }, []);

  const openLogQuick = useCallback(() => {
    // Preferisce il prossimo pasto tra quelli abituali del paziente; se
    // sono già tutti fatti, propone comunque un pasto extra fuori routine.
    // Aperto da qui il pasto resta cambiabile (locked=false).
    const active = appState?.activeMeals ?? [];
    const nextMeal =
      active.find((k) => !appState?.meals[k]?.done) ??
      MEAL_ORDER.find((k) => !appState?.meals[k]?.done) ??
      'spuntino';
    openSheet(nextMeal, false);
  }, [appState, openSheet]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const applyTranscript = useCallback((text: string) => {
    setLogText(text);
    setHasTranscript(true);
  }, []);

  const addPhoto = useCallback(async (file: File) => {
    setPhotoError('');
    setPhotoExtracting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const foods = await api.extractMealPhoto(fileBase64, file.type || 'application/octet-stream');
      setPhotoFoods(foods);
    } catch (err) {
      setPhotoError((err as Error).message || 'Riconoscimento fallito. Inserisci gli alimenti a mano.');
    } finally {
      setPhotoExtracting(false);
    }
  }, []);

  const retakePhoto = useCallback(() => {
    setPhotoFoods(null);
    setPhotoError('');
  }, []);

  const submitLog = useCallback(async () => {
    const foods =
      mode === 'photo' ? photoFoods ?? [] : logText.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    if (!foods.length) return;

    const { state, summary } = await api.logMeal(activeMeal, foods);
    setAppState(state);
    setLastSummary(summary);
    setSheetOpen(false);
    setSummaryOpen(true);
  }, [mode, photoFoods, logText, activeMeal]);

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

  const updateMealFoods = useCallback(async (key: MealKey, foods: string[]) => {
    const s = await api.updateMealFoods(key, foods);
    setAppState(s);
    showToast('Pasto aggiornato');
  }, [showToast]);

  const skipMeal = useCallback(async (key: MealKey, skipped: boolean) => {
    const s = await api.skipMeal(key, skipped);
    setAppState(s);
    showToast(skipped ? 'Pasto saltato per oggi' : 'Pasto ripristinato');
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
    activeMeal, setActiveMeal, mealLocked,
    mode, setMode,
    logText, setLogText,
    hasTranscript, applyTranscript,
    photoFoods, photoExtracting, photoError, addPhoto, retakePhoto,
    submitLog,
    toast, showToast,
    completeOnboarding,
    deleteMeal,
    updateMealFoods,
    skipMeal,
    toggleFast, setFreq, goDigiuno,
    patients, activePatientId, activePatient, selectPatient, backToList,
  };
}

export type Diario = ReturnType<typeof useDiario>;
