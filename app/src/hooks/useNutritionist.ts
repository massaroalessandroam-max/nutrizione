import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { NutritionistPatientListItem, NutritionistPatientDetail, NutritionistTeamMember, Message } from '../types';

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

  const setNextVisit = useCallback(async (nextVisitAt: string, nextVisitNote: string) => {
    if (!activePatientId) return;
    await api.setPatientNextVisit(activePatientId, nextVisitAt, nextVisitNote);
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
    selectPatient, backToList, createPatient, setNextVisit, sendMessage, generateInvite, setOwner,
  };
}

export type Nutritionist = ReturnType<typeof useNutritionist>;
