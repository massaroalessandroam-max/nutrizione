import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Exercise } from '../../types';
import { ChevronIcon } from '../../icons';

const BODY_PART_LABEL: Record<string, string> = {
  back: 'Schiena', cardio: 'Cardio', chest: 'Petto', 'lower arms': 'Avambracci',
  'lower legs': 'Polpacci', neck: 'Collo', shoulders: 'Spalle', 'upper arms': 'Braccia',
  'upper legs': 'Gambe', waist: 'Addome',
};

function ExerciseCard({ exercise, open, onToggle }: { exercise: Exercise; open: boolean; onToggle: () => void }) {
  return (
    <div className="nm-exercise-card">
      <button className="nm-exercise-card-head" onClick={onToggle}>
        <img className="nm-exercise-gif" src={exercise.gifUrl} alt={exercise.name} loading="lazy" />
        <div className="nm-exercise-card-main">
          <div className="nm-exercise-name">{exercise.name}</div>
          <div className="nm-page-sub" style={{ margin: 0 }}>
            {exercise.targetMuscles.join(', ')} · {exercise.equipments.join(', ')}
          </div>
        </div>
        <ChevronIcon open={open} color="var(--ink-faint)" />
      </button>
      {open && (
        <ol className="nm-exercise-instructions">
          {exercise.instructions.map((step, i) => (
            <li key={i}>{step.replace(/^Step:\d+\s*/, '')}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function EserciziView() {
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [bodyPart, setBodyPart] = useState('');
  const [q, setQ] = useState('');
  const [result, setResult] = useState<{ total: number; items: Exercise[]; catalogReady: boolean } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api.getExerciseBodyParts().then(setBodyParts).catch(() => setBodyParts([]));
  }, []);

  useEffect(() => {
    setResult(null);
    const t = setTimeout(() => {
      api.getExercises({ q, bodyPart }).then(setResult).catch(() => setResult({ total: 0, items: [], catalogReady: true }));
    }, 250);
    return () => clearTimeout(t);
  }, [q, bodyPart]);

  return (
    <div className="nm-section">
      <div className="nm-page-title">Esercizi</div>
      <div className="nm-page-sub">Cerca un esercizio e guarda l'animazione di esecuzione.</div>

      <input
        className="nm-text-input"
        style={{ marginTop: 10 }}
        placeholder="Cerca per nome (es. squat)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="nm-chip-row" style={{ marginTop: 12 }}>
        <button className={`nm-chip ${bodyPart === '' ? 'is-on' : 'is-off'}`} onClick={() => setBodyPart('')}>Tutti</button>
        {bodyParts.map((bp) => (
          <button key={bp} className={`nm-chip ${bodyPart === bp ? 'is-on' : 'is-off'}`} onClick={() => setBodyPart(bp)}>
            {BODY_PART_LABEL[bp] ?? bp}
          </button>
        ))}
      </div>

      {result === null ? (
        <div className="nm-empty-state">Caricamento…</div>
      ) : result.items.length === 0 ? (
        <div className="nm-empty-state">
          {result.catalogReady ? 'Nessun esercizio trovato.' : 'Catalogo in caricamento, riprova tra qualche minuto.'}
        </div>
      ) : (
        <div className="nm-exercise-list">
          {result.items.map((ex) => (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              open={openId === ex.exerciseId}
              onToggle={() => setOpenId(openId === ex.exerciseId ? null : ex.exerciseId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
