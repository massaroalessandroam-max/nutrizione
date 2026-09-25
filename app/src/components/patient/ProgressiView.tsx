import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { ExerciseProgress } from '../../types';
import { fmtDate } from '../../lib/workoutMeta';

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export function ProgressCard({ p }: { p: ExerciseProgress }) {
  const cardio = p.kind === 'cardio';
  const values = p.history.map((h) => (cardio ? h.volume : h.topWeight));
  const max = Math.max(...values, 1);
  return (
    <div className="nm-log-card">
      <div className="nm-log-card-head">
        <div className="nm-exercise-name">{p.name}</div>
        <span className="nm-page-sub" style={{ margin: 0 }}>{p.sessions} {p.sessions === 1 ? 'sessione' : 'sessioni'}</span>
      </div>
      <div className="nm-progress-stats">
        <div><span>{cardio ? 'Durata max' : 'Carico max'}</span><strong>{cardio ? `${fmt(p.bestVolume)} min` : `${fmt(p.bestWeight)} kg × ${p.repsAtBest}`}</strong></div>
        {!cardio && <div><span>Volume max sessione</span><strong>{fmt(p.bestVolume)} kg</strong></div>}
        <div><span>Ultimo · {fmtDate(p.last.date)}</span><strong>{cardio ? `${fmt(p.last.volume)} min` : `${fmt(p.last.topWeight)} kg × ${p.last.repsAtTop} · vol. ${fmt(p.last.volume)}`}</strong></div>
      </div>
      {p.history.length > 1 && (
        <>
          <div className="nm-progress-caption">{cardio ? 'Durata' : 'Carico massimo'} nelle ultime {p.history.length} sessioni</div>
          <div className="nm-progress-bars" style={{ marginTop: 6 }} aria-label="Andamento">
          {values.map((v, i) => <div key={i} className="nm-progress-bar" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} title={`${fmtDate(p.history[i].date)}: ${fmt(v)}`} />)}
          </div>
        </>
      )}
    </div>
  );
}

export function ProgressiView() {
  const [items, setItems] = useState<ExerciseProgress[] | null>(null);
  useEffect(() => { api.getWorkoutProgress().then(setItems).catch(() => setItems([])); }, []);

  return (
    <div className="nm-section">
      <div className="nm-page-title">Progressi</div>
      <div className="nm-page-sub">Lo storico di ogni esercizio: carico massimo, volume e andamento.</div>
      {items === null ? (
        <div className="nm-empty-state">Caricamento…</div>
      ) : items.length === 0 ? (
        <div className="nm-empty-state">Registra un allenamento per vedere qui i tuoi progressi.</div>
      ) : (
        <div className="nm-exercise-list">{items.map((p) => <ProgressCard key={p.exerciseId} p={p} />)}</div>
      )}
    </div>
  );
}
