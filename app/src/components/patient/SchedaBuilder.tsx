import { useState } from 'react';
import type { Exercise, PlanDraft, PlanDraftExercise, WorkoutPlan } from '../../types';
import { TrashIcon } from '../../icons';
import { kindOf, todayIso } from '../../lib/workoutMeta';
import { ExercisePicker, type Catalog } from './ExercisePicker';

const numOf = (v: string) => Number(v.replace(',', '.')) || 0;

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="nm-workout-field">
      <span>{label}</span>
      <input className="nm-text-input" type="number" inputMode="decimal" min={0} step={step} value={value || ''} onChange={(e) => onChange(numOf(e.target.value))} />
    </label>
  );
}

// Senza `initial` crea una scheda nuova; con `initial` la modifica (stesso modulo, precompilato).
export function SchedaBuilder({ catalog, onSave, initial, onCancel }: {
  catalog: Catalog;
  onSave: (draft: PlanDraft) => Promise<void>;
  initial?: WorkoutPlan;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [exercises, setExercises] = useState<PlanDraftExercise[]>(
    () => initial?.exercises.map(({ exerciseId, name, gifUrl, kind, sets, reps, weight, minutes }) => ({ exerciseId, name, gifUrl, kind, sets, reps, weight, minutes })) ?? []
  );
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const add = (ex: Exercise) =>
    setExercises((list) => [...list, { exerciseId: ex.exerciseId, name: ex.name, gifUrl: ex.gifUrl, kind: kindOf(ex), sets: 3, reps: 10, weight: 0, minutes: kindOf(ex) === 'cardio' ? 20 : 0 }]);
  const patch = (i: number, p: Partial<PlanDraftExercise>) => setExercises((list) => list.map((e, j) => (j === i ? { ...e, ...p } : e)));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave({ name, startDate, endDate, exercises });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="nm-section">
      <div className="nm-page-title">{initial ? 'Modifica scheda' : 'Crea scheda'}</div>
      <div className="nm-page-sub">
        {initial ? 'Cambia nome, date, esercizi o valori. Gli allenamenti già registrati restano com\'erano.' : 'Dai un nome alla scheda, scegli gli esercizi e imposta i valori di partenza.'}
      </div>

      <input className="nm-text-input" placeholder="Nome scheda (es. Forza A)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="nm-workout-row" style={{ marginTop: 10 }}>
        <label className="nm-workout-field"><span>Inizio</span><input className="nm-text-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label className="nm-workout-field"><span>Fine (facoltativa)</span><input className="nm-text-input" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      </div>

      <div className="nm-section-label" style={{ marginTop: 18 }}>Esercizi ({exercises.length})</div>
      {exercises.length === 0 && <div className="nm-empty-state">Nessun esercizio: aggiungine uno dal catalogo.</div>}
      <div className="nm-exercise-list">
        {exercises.map((e, i) => (
          <div key={e.exerciseId} className="nm-log-card">
            <div className="nm-log-card-head">
              <div className="nm-exercise-name">{e.name}</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setExercises((l) => l.filter((_, j) => j !== i))} aria-label={`Rimuovi ${e.name}`}>
                <TrashIcon color="var(--ink-faint)" />
              </button>
            </div>
            <div className="nm-workout-row">
              {e.kind === 'cardio' ? (
                <NumField label="Minuti" value={e.minutes} onChange={(minutes) => patch(i, { minutes })} />
              ) : (
                <>
                  <NumField label="Serie" value={e.sets} onChange={(sets) => patch(i, { sets })} />
                  <NumField label="Rip." value={e.reps} onChange={(reps) => patch(i, { reps })} />
                  <NumField label="Kg" value={e.weight} step={0.5} onChange={(weight) => patch(i, { weight })} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <button className="nm-modal-btn nm-modal-btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => setPicking((p) => !p)}>
        {picking ? 'Chiudi catalogo' : 'Aggiungi esercizio'}
      </button>
      {picking && <ExercisePicker catalog={catalog} addedIds={exercises.map((e) => e.exerciseId)} onAdd={add} />}

      {error && <div className="nm-empty-state" style={{ color: 'var(--bad-fg-strong)' }}>{error}</div>}
      <div className="nm-workout-row" style={{ marginTop: 16 }}>
        {onCancel && <button className="nm-modal-btn nm-modal-btn-secondary" onClick={onCancel}>Annulla</button>}
        <button className="nm-modal-btn nm-modal-btn-primary" disabled={saving || !name.trim() || exercises.length === 0} onClick={save}>
          {saving ? 'Salvataggio…' : initial ? 'Salva modifiche' : 'Salva scheda'}
        </button>
      </div>
    </div>
  );
}
