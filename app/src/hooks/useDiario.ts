import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { fileToBase64 } from '../lib/file';
import type { AppState, DayMealState, FastingPref, LogSummary, MealKey, Schedule } from '../types';
import { MEAL_ORDER } from '../types';

export type Tab = 'diario' | 'abitudini' | 'premi' | 'piano' | 'report' | 'messaggi';
export type LogMode = 'text' | 'audio' | 'photo';

export function useDiario() {
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
  // Non-null quando il sheet è aperto per registrare un pasto/alimento non
  // segnato di un giorno precedente (click su un giorno nel grafico
  // "Andamento"), invece del pasto di oggi.
  const [backfillDate, setBackfillDate] = useState<string | null>(null);
  const [backfillMeals, setBackfillMeals] = useState<Record<MealKey, DayMealState> | null>(null);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [supplementSheetOpen, setSupplementSheetOpen] = useState(false);
  const openSupplementSheet = useCallback(() => setSupplementSheetOpen(true), []);
  const closeSupplementSheet = useCallback(() => setSupplementSheetOpen(false), []);

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

  // key: locked di default (tap su un pasto specifico dal Diario) -> nel
  // sheet non si può cambiare pasto. Il testo/foto parte sempre vuoto: ogni
  // registrazione si AGGIUNGE a quelle già fatte per quel pasto oggi (es.
  // yogurt alle 6, poi uova e pane alle 8), non le sostituisce.
  const openSheet = useCallback((key: MealKey, locked = true, date: string | null = null) => {
    setActiveMeal(key);
    setMode('text');
    setLogText('');
    setHasTranscript(false);
    setPhotoFoods(null);
    setPhotoError('');
    setMealLocked(locked);
    setBackfillDate(date);
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

  // Aperto dal grafico "Andamento" cliccando un giorno precedente: carica i
  // pasti già segnati quel giorno (per non sovrascriverli) e propone il
  // primo non ancora fatto, pasto comunque cambiabile.
  const openBackfill = useCallback(async (date: string) => {
    const meals = await api.getMealsForDate(date);
    setBackfillMeals(meals);
    const nextMeal = MEAL_ORDER.find((k) => !meals[k].done) ?? 'colazione';
    openSheet(nextMeal, false, date);
  }, [openSheet]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setBackfillDate(null);
    setBackfillMeals(null);
  }, []);

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

    const { state, summary } = await api.logMeal(activeMeal, foods, backfillDate ?? undefined);
    setAppState(state);
    setLastSummary(summary);
    setSheetOpen(false);
    setBackfillDate(null);
    setBackfillMeals(null);
    setSummaryOpen(true);
  }, [mode, photoFoods, logText, activeMeal, backfillDate]);

  const closeSummary = useCallback(() => setSummaryOpen(false), []);

  const sendFromSummary = useCallback(() => {
    setSummaryOpen(false);
    showToast('Pasto inviato al nutrizionista');
  }, [showToast]);

  const setMood = useCallback(async (mood: number) => {
    if (!lastSummary) return;
    const s = await api.setMealMood(lastSummary.key, mood, lastSummary.date);
    setAppState(s);
  }, [lastSummary]);

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
    const s = await api.updateMealFoods(key, foods, backfillDate ?? undefined);
    setAppState(s);
    showToast('Pasto aggiornato');
    // Il sheet legge "già registrato" da backfillMeals (non da appState per
    // un giorno passato): va riallineato dopo la modifica.
    if (backfillDate) setBackfillMeals(await api.getMealsForDate(backfillDate));
  }, [showToast, backfillDate]);

  const skipMeal = useCallback(async (key: MealKey, skipped: boolean) => {
    const s = await api.skipMeal(key, skipped);
    setAppState(s);
    showToast(skipped ? 'Pasto saltato per oggi' : 'Pasto ripristinato');
  }, [showToast]);

  const [fastToggling, setFastToggling] = useState(false);
  const fastToggleInFlight = useRef(false);
  const toggleFast = useCallback(async () => {
    // Guardia sincrona (oltre al disabled sul pulsante, che aggiorna solo al
    // prossimo render): un doppio tap sul touch può far partire due
    // richieste prima che il bottone si disabiliti, e i due toggle si
    // annullano a vicenda lasciando il digiuno com'era — sembra "non si
    // ferma" anche se il singolo toggle funziona.
    if (fastToggleInFlight.current) return;
    fastToggleInFlight.current = true;
    setFastToggling(true);
    try {
      const s = await api.toggleFast();
      setAppState(s);
    } finally {
      fastToggleInFlight.current = false;
      setFastToggling(false);
    }
  }, []);

  const setFreq = useCallback(async (freq: AppState['freq']) => {
    const s = await api.setFreq(freq);
    setAppState(s);
  }, []);

  return {
    tab, setTab,
    appState, loading, refreshState,
    sheetOpen, openSheet, openLogQuick, openBackfill, closeSheet,
    backfillDate, backfillMeals,
    summaryOpen, closeSummary, sendFromSummary, lastSummary, setMood,
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
    toggleFast, fastToggling, setFreq,
    supplementSheetOpen, openSupplementSheet, closeSupplementSheet,
  };
}

export type Diario = ReturnType<typeof useDiario>;
