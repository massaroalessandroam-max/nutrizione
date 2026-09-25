import type { ReactNode } from 'react';
import type { Workout, WorkoutPlan } from '../../types';
import { describeSet, fmtDate, todayIso } from '../../lib/workoutMeta';

// Usati sia dal paziente (SchedeView) sia dal nutrizionista (PatientTrainingTab).
export function PlanCard({ plan: p, children }: { plan: WorkoutPlan; children?: ReactNode }) {
  return (
    <div className="nm-log-card">
      <div className="nm-log-card-head">
        <div className="nm-exercise-name" style={{ textTransform: 'none' }}>{p.name}</div>
        {p.endDate && p.endDate < todayIso() && <span className="nm-food-chip nm-food-chip-neutral">Conclusa</span>}
      </div>
      <div className="nm-page-sub" style={{ marginBottom: 8 }}>
        Dal {fmtDate(p.startDate)}{p.endDate ? ` al ${fmtDate(p.endDate)}` : ''}{p.createdBy === 'nutritionist' ? ' · dal nutrizionista' : ''}
      </div>
      {p.exercises.map((e) => (
        <div key={e.exerciseId} style={{ fontSize: 13, marginBottom: 6 }}>
          <strong style={{ textTransform: 'capitalize' }}>{e.name}</strong>
          <div className="nm-page-sub" style={{ margin: 0 }}>
            {e.kind === 'cardio' ? `${e.minutes} min` : `${e.sets} × ${e.reps}${e.weight ? ` · ${e.weight} kg` : ''}`}
            {e.last && ` · Ultimo ${e.last.sets.map((s) => describeSet(e.kind, s)).join(', ')}`}
            {e.kind === 'strength' && e.bestWeight > 0 && ` · Max ${e.bestWeight} kg`}
          </div>
        </div>
      ))}
      {children && <div className="nm-workout-row" style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

export function WorkoutHistory({ workouts }: { workouts: Workout[] }) {
  return (
    <div className="nm-exercise-list">
      {workouts.slice(0, 10).map((w) => (
        <div key={w.id} className="nm-log-card">
          <div className="nm-log-card-head">
            <div className="nm-exercise-name" style={{ textTransform: 'none' }}>{w.planName || 'Allenamento libero'}</div>
            <span className="nm-page-sub" style={{ margin: 0 }}>{fmtDate(w.date)}</span>
          </div>
          {w.exercises.map((e) => (
            <div key={e.exerciseId} className="nm-page-sub" style={{ margin: '0 0 4px' }}>
              <strong style={{ textTransform: 'capitalize', color: 'var(--ink)' }}>{e.name}</strong>: {e.sets.map((s) => describeSet(e.kind, s)).join(', ') || '—'}{e.note && ` — ${e.note}`}
            </div>
          ))}
          {w.note && <div className="nm-page-sub" style={{ margin: '6px 0 0', fontStyle: 'italic' }}>{w.note}</div>}
        </div>
      ))}
    </div>
  );
}
