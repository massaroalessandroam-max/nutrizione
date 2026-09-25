import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { PatientTraining, PlanDraft, WorkoutPlan } from '../../types';
import { nutritionistCatalog } from '../../lib/workoutMeta';
import { SchedaBuilder } from '../patient/SchedaBuilder';
import { ProgressCard } from '../patient/ProgressiView';
import { PlanCard, WorkoutHistory } from '../patient/WorkoutParts';

// Il nutrizionista crea e toglie schede; gli allenamenti li registra solo il paziente.
export function PatientTrainingTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<PatientTraining | null>(null);
  // undefined = elenco; null = nuova scheda; scheda = modifica di quella scheda
  const [editing, setEditing] = useState<WorkoutPlan | null | undefined>(undefined);

  useEffect(() => {
    setData(null);
    api.getPatientTraining(patientId).then(setData).catch(() => setData({ plans: [], workouts: [], progress: [] }));
  }, [patientId]);

  if (!data) return <div className="nm-empty-state">Caricamento…</div>;

  if (editing !== undefined) {
    return (
      <SchedaBuilder
        catalog={nutritionistCatalog}
        initial={editing ?? undefined}
        onCancel={() => setEditing(undefined)}
        onSave={async (draft: PlanDraft) => {
          const plans = editing
            ? await api.updatePatientWorkoutPlan(patientId, editing.id, draft)
            : await api.createPatientWorkoutPlan(patientId, draft);
          setData({ ...data, plans });
          setEditing(undefined);
        }}
      />
    );
  }

  const remove = async (id: number, name: string) => {
    if (window.confirm(`Eliminare la scheda "${name}"? Gli allenamenti già registrati restano nello storico.`)) {
      setData({ ...data, plans: await api.deletePatientWorkoutPlan(patientId, id) });
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <button className="nm-modal-btn nm-modal-btn-primary" style={{ width: '100%' }} onClick={() => setEditing(null)}>Nuova scheda per il paziente</button>

      <div className="nm-section-label" style={{ marginTop: 16 }}>Schede</div>
      {data.plans.length === 0 && <div className="nm-empty-state">Nessuna scheda.</div>}
      <div className="nm-exercise-list">
        {data.plans.map((p) => (
          <PlanCard key={p.id} plan={p}>
            <button className="nm-modal-btn nm-modal-btn-secondary" onClick={() => setEditing(p)}>Modifica</button>
            <button className="nm-modal-btn nm-modal-btn-secondary" onClick={() => remove(p.id, p.name)}>Elimina</button>
          </PlanCard>
        ))}
      </div>

      <div className="nm-section-label" style={{ marginTop: 20 }}>Ultimi allenamenti</div>
      {data.workouts.length === 0 ? <div className="nm-empty-state">Nessun allenamento registrato.</div> : <WorkoutHistory workouts={data.workouts} />}

      {data.progress.length > 0 && (
        <>
          <div className="nm-section-label" style={{ marginTop: 20 }}>Progressi</div>
          <div className="nm-exercise-list">{data.progress.map((p) => <ProgressCard key={p.exerciseId} p={p} />)}</div>
        </>
      )}
    </div>
  );
}
