import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import type { Workout, WorkoutPlan } from '../../types';
import { patientCatalog } from '../../lib/workoutMeta';
import { SchedaBuilder } from './SchedaBuilder';
import { WorkoutLogView } from './WorkoutLogView';
import { PlanCard, WorkoutHistory } from './WorkoutParts';

export function SchedeView() {
  const [plans, setPlans] = useState<WorkoutPlan[] | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  // undefined = elenco; null = allenamento libero; scheda = allenamento da scheda
  const [logging, setLogging] = useState<WorkoutPlan | null | undefined>(undefined);
  const [editing, setEditing] = useState<WorkoutPlan | null>(null);

  const load = useCallback(() => {
    api.getWorkoutPlans().then(setPlans).catch(() => setPlans([]));
    api.getWorkouts().then(setWorkouts).catch(() => setWorkouts([]));
  }, []);
  useEffect(load, [load]);

  if (editing) {
    return (
      <SchedaBuilder
        catalog={patientCatalog}
        initial={editing}
        onCancel={() => setEditing(null)}
        onSave={async (draft) => { setPlans(await api.updateWorkoutPlan(editing.id, draft)); setEditing(null); }}
      />
    );
  }

  if (logging !== undefined) {
    return <WorkoutLogView plan={logging} onCancel={() => setLogging(undefined)} onDone={() => { setLogging(undefined); load(); }} />;
  }

  const remove = async (p: WorkoutPlan) => {
    if (window.confirm(`Eliminare la scheda "${p.name}"? Gli allenamenti già registrati restano nello storico.`)) {
      setPlans(await api.deleteWorkoutPlan(p.id));
    }
  };

  return (
    <div className="nm-section">
      <div className="nm-page-title">Le mie schede</div>
      <button className="nm-modal-btn nm-modal-btn-secondary" style={{ width: '100%' }} onClick={() => setLogging(null)}>Allenamento libero</button>

      {plans === null ? (
        <div className="nm-empty-state">Caricamento…</div>
      ) : plans.length === 0 ? (
        <div className="nm-empty-state">Nessuna scheda ancora. Creala da "Crea scheda".</div>
      ) : (
        <div className="nm-exercise-list" style={{ marginTop: 14 }}>
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p}>
              <button className="nm-modal-btn nm-modal-btn-primary" onClick={() => setLogging(p)}>Allenati</button>
              <button className="nm-modal-btn nm-modal-btn-secondary" onClick={() => setEditing(p)}>Modifica</button>
              <button className="nm-modal-btn nm-modal-btn-secondary" onClick={() => remove(p)}>Elimina</button>
            </PlanCard>
          ))}
        </div>
      )}

      {workouts.length > 0 && (
        <>
          <div className="nm-section-label" style={{ marginTop: 20 }}>Ultimi allenamenti</div>
          <WorkoutHistory workouts={workouts} />
        </>
      )}
    </div>
  );
}
