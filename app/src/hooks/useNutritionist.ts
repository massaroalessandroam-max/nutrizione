import { useCallback, useEffect, useState } from 'react';
import { api, type PlanItem } from '../api';
import type { NutritionistPatientListItem, NutritionistPatientDetail, NutritionistTeamMember, Message, GoalLevel } from '../types';

export function useNutritionist() {
  const [patients, setPatients] = useState<NutritionistPatientListItem[] | null>(null);
  const [activePatientId, setActivePatientId] = useState<number | null>(null);
  const [activePatient, setActivePatient] = useState<NutritionistPatientDetail | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  // Per il selettore "titolare" nel dettaglio paziente — caricato una volta,
  // non cambia spesso quanto la lista pazienti.
  const [team, setTeam] = useState<NutritionistTeamMember[] | null>(null);

  const refreshPatients = useCallback(async () => {
    setPatients(await api.getNutritionistPatients());
  }, []);

  useEffect(() => {
    refreshPatients();
    api.getNutritionistTeam().then(setTeam).catch(() => setTeam([]));
  }, [refreshPatients]);

  const refreshActivePatient = useCallback(async (id: number) => {
    const [detail, msgs] = await Promise.all([api.getNutritionistPatient(id), api.getPatientMessages(id)]);
    setActivePatient(detail);
    setMessages(msgs);
  }, []);

  const selectPatient = useCallback((id: number) => {
    setActivePatientId(id);
    setActivePatient(null);
    setMessages(null);
    refreshActivePatient(id);
  }, [refreshActivePatient]);

  const backToList = useCallback(() => {
    setActivePatientId(null);
    setActivePatient(null);
    setMessages(null);
    refreshPatients();
  }, [refreshPatients]);

  const createPatient = useCallback(async (name: string) => {
    const created = await api.createPatient(name);
    await refreshPatients();
    return created;
  }, [refreshPatients]);

  const addAppointment = useCallback(async (at: string, note: string) => {
    if (!activePatientId) return;
    await api.addPatientAppointment(activePatientId, at, note);
    await refreshActivePatient(activePatientId);
  }, [activePatientId, refreshActivePatient]);

  const deleteAppointment = useCallback(async (appointmentId: number) => {
    if (!activePatientId) return;
    await api.deletePatientAppointment(activePatientId, appointmentId);
    await refreshActivePatient(activePatientId);
  }, [activePatientId, refreshActivePatient]);

  const addGoal = useCallback(async (level: GoalLevel, text: string, targetDate: string) => {
    if (!activePatientId) return;
    await api.addPatientGoal(activePatientId, level, text, targetDate);
    await refreshActivePatient(activePatientId);
  }, [activePatientId, refreshActivePatient]);

  const deleteGoal = useCallback(async (goalId: number) => {
    if (!activePatientId) return;
    await api.deletePatientGoal(activePatientId, goalId);
    await refreshActivePatient(activePatientId);
  }, [activePatientId, refreshActivePatient]);

  const savePlan = useCallback(async (items: PlanItem[]) => {
    if (!activePatientId) return;
    await api.setPatientPlan(activePatientId, items);
    await refreshActivePatient(activePatientId);
  }, [activePatientId, refreshActivePatient]);

  const sendMessage = useCallback(async (text: string) => {
    if (!activePatientId) return;
    setMessages(await api.sendPatientMessage(activePatientId, text));
  }, [activePatientId]);

  const generateInvite = useCallback(async () => {
    const { inviteToken } = await api.createNutritionistInvite();
    return inviteToken;
  }, []);

  const setOwner = useCallback(async (nutritionistId: number | null) => {
    if (!activePatientId) return;
    await api.setPatientOwner(activePatientId, nutritionistId);
    await refreshActivePatient(activePatientId);
  }, [activePatientId, refreshActivePatient]);

  return {
    patients, activePatientId, activePatient, messages, team,
    selectPatient, backToList, createPatient, sendMessage, generateInvite, setOwner,
    addAppointment, deleteAppointment, addGoal, deleteGoal, savePlan,
  };
}

export type Nutritionist = ReturnType<typeof useNutritionist>;
