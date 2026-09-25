import { useState } from 'react';
import { api } from '../../api';
import type { Exercise, ExerciseRef, PlanExercise, WorkoutPlan } from '../../types';
import { TrashIcon } from '../../icons';
import { describeSet, fmtDate, kindOf, patientCatalog, todayIso } from '../../lib/workoutMeta';
import { ExercisePicker } from './ExercisePicker';

interface SetInput { weight: string; reps: string; minutes: string }
interface Entry { ref: ExerciseRef; note: string; sets: SetInput[]; hint: string }

const txt = (n: number | undefined) => (n ? String(n) : '');
const numOf = (v: string) => Number(v.replace(',', '.')) || 0;

// Le serie partono precompilate con l'ultimo carico eseguito per quell'esercizio
// (in qualunque scheda); solo se non c'è storico si usa il target della scheda.
function entryFromPlan(ex: PlanExercise): Entry {
  const n = ex.kind === 'cardio' ? 1 : Math.max(ex.sets, ex.last?.sets.length ?? 0, 1);
  const sets = Array.from({ length: n }, (_, i) => {
    const src = ex.last ? ex.last.sets[i] ?? ex.last.sets[ex.last.sets.length - 1] : undefined;
    return { weight: txt(src?.weight ?? ex.weight), reps: txt(src?.reps ?? ex.reps), minutes: txt(src?.minutes ?? ex.minutes) };
  });
  const hint = ex.last
    ? `Ultimo (${fmtDate(ex.last.date)}): ${ex.last.sets.map((s) => describeSet(ex.kind, s)).join(' · ')}`
    : ex.kind === 'cardio' ? `Scheda: ${ex.minutes} min` : `Scheda: ${ex.sets} × ${ex.reps}${ex.weight ? ` a ${ex.weight} kg` : ''}`;
  return { ref: { exerciseId: ex.exerciseId, name: ex.name, gifUrl: ex.gifUrl, kind: ex.kind }, note: '', sets, hint };
}

const entryFromCatalog = (ex: Exercise): Entry => {
  const kind = kindOf(ex);
  return {
    ref: { exerciseId: ex.exerciseId, name: ex.name, gifUrl: ex.gifUrl, kind },
    note: '', hint: '',
    sets: Array.from({ length: kind === 'cardio' ? 1 : 3 }, () => ({ weight: '', reps: '', minutes: '' })),
  };
};

export function WorkoutLogView({ plan, onDone, onCancel }: { plan: WorkoutPlan | null; onDone: () => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState<Entry[]>(() => plan?.exercises.map(entryFromPlan) ?? []);
  const [picking, setPicking] = useState(!plan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const patchEntry = (i: number, p: Partial<Entry>) => setEntries((l) => l.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const patchSet = (i: number, k: number, p: Partial<SetInput>) =>
    setEntries((l) => l.map((e, j) => (j === i ? { ...e, sets: e.sets.map((s, m) => (m === k ? { ...s, ...p } : s)) } : e)));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.logWorkout({
        date, planId: plan?.id ?? null, note,
        exercises: entries.map((e) => ({
          ...e.ref, note: e.note,
          sets: e.sets.map((s) => ({ weight: numOf(s.weight), reps: numOf(s.reps), minutes: numOf(s.minutes) })),
        })),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="nm-section">
      <div className="nm-page-title">{plan ? plan.name : 'Allenamento libero'}</div>
      <div className="nm-page-sub">Registra quello che hai fatto. I carichi si ricordano per la prossima volta.</div>

      <label className="nm-workout-field" style={{ maxWidth: 200 }}><span>Data</span>
        <input className="nm-text-input" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <div className="nm-exercise-list" style={{ marginTop: 14 }}>
        {entries.map((e, i) => (
          <div key={e.ref.exerciseId} className="nm-log-card">
            <div className="nm-log-card-head">
              <div className="nm-exercise-name">{e.ref.name}</div>
              {!plan && (
                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setEntries((l) => l.filter((_, j) => j !== i))} aria-label={`Rimuovi ${e.ref.name}`}>
                  <TrashIcon color="var(--ink-faint)" />
                </button>
              )}
            </div>
            {e.hint && <div className="nm-page-sub" style={{ marginBottom: 8 }}>{e.hint}</div>}
            {e.sets.map((s, k) => (
              <div key={k} className="nm-workout-row" style={{ marginBottom: 6 }}>
                {e.ref.kind === 'cardio' ? (
                  <label className="nm-workout-field"><span>Durata (min)</span>
                    <input className="nm-text-input" type="number" inputMode="decimal" min={0} value={s.minutes} onChange={(ev) => patchSet(i, k, { minutes: ev.target.value })} />
                  </label>
                ) : (
                  <>
                    <label className="nm-workout-field"><span>Serie {k + 1} · Kg</span>
                      <input className="nm-text-input" type="number" inputMode="decimal" min={0} step={0.5} value={s.weight} onChange={(ev) => patchSet(i, k, { weight: ev.target.value })} />
                    </label>
                    <label className="nm-workout-field"><span>Ripetizioni</span>
                      <input className="nm-text-input" type="number" inputMode="numeric" min={0} value={s.reps} onChange={(ev) => patchSet(i, k, { reps: ev.target.value })} />
                    </label>
                  </>
                )}
              </div>
            ))}
            {e.ref.kind === 'strength' && (
              <div className="nm-workout-row" style={{ marginBottom: 8 }}>
                <button className="nm-chip is-off" onClick={() => patchEntry(i, { sets: [...e.sets, { ...e.sets[e.sets.length - 1], reps: e.sets[e.sets.length - 1]?.reps ?? '' }] })}>+ serie</button>
                {e.sets.length > 1 && <button className="nm-chip is-off" onClick={() => patchEntry(i, { sets: e.sets.slice(0, -1) })}>− serie</button>}
              </div>
            )}
            <input className="nm-text-input" placeholder="Note (facoltative)" value={e.note} onChange={(ev) => patchEntry(i, { note: ev.target.value })} />
          </div>
        ))}
      </div>

      {!plan && (
        <>
          <button className="nm-modal-btn nm-modal-btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => setPicking((p) => !p)}>
            {picking ? 'Chiudi catalogo' : 'Aggiungi esercizio'}
          </button>
          {picking && (
            <ExercisePicker
              catalog={patientCatalog}
              addedIds={entries.map((e) => e.ref.exerciseId)}
              onAdd={(ex) => setEntries((l) => [...l, entryFromCatalog(ex)])}
            />
          )}
        </>
      )}

      <textarea className="nm-text-input" style={{ marginTop: 14, minHeight: 60 }} placeholder="Note sull'allenamento (facoltative)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="nm-empty-state" style={{ color: 'var(--bad-fg-strong)' }}>{error}</div>}
      <div className="nm-workout-row" style={{ marginTop: 14 }}>
        <button className="nm-modal-btn nm-modal-btn-secondary" onClick={onCancel}>Annulla</button>
        <button className="nm-modal-btn nm-modal-btn-primary" disabled={saving || entries.length === 0} onClick={save}>{saving ? 'Salvataggio…' : 'Salva allenamento'}</button>
      </div>
    </div>
  );
}
