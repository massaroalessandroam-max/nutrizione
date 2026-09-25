import { useEffect, useState } from 'react';
import type { Exercise } from '../../types';
import { ChevronIcon, PlusIcon } from '../../icons';

const BODY_PART_LABEL: Record<string, string> = {
  back: 'Schiena', cardio: 'Cardio', chest: 'Petto', 'lower arms': 'Avambracci',
  'lower legs': 'Polpacci', neck: 'Collo', shoulders: 'Spalle', 'upper arms': 'Braccia',
  'upper legs': 'Gambe', waist: 'Addome',
};

// Chi ospita il catalogo (paziente o nutrizionista) passa le proprie
// chiamate: le route sono separate perché l'autenticazione è diversa.
export interface Catalog {
  list: (p: { q?: string; bodyPart?: string; offset?: number }) => Promise<{ total: number; items: Exercise[]; catalogReady: boolean }>;
  bodyParts: () => Promise<string[]>;
}

function ExerciseCard({ exercise, open, onToggle, added, onAdd }: {
  exercise: Exercise; open: boolean; onToggle: () => void; added: boolean; onAdd: () => void;
}) {
  return (
    <div className="nm-exercise-card">
      <div className="nm-exercise-card-head" style={{ cursor: 'default' }}>
        <img className="nm-exercise-gif" src={exercise.gifUrl} alt={exercise.name} loading="lazy" onClick={onToggle} />
        <button className="nm-exercise-card-main" style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer' }} onClick={onToggle}>
          <div className="nm-exercise-name">{exercise.name}</div>
          <div className="nm-page-sub" style={{ margin: 0 }}>
            {exercise.targetMuscles.join(', ')} · {exercise.equipments.join(', ')}
          </div>
        </button>
        <button className="nm-chip is-on" style={{ opacity: added ? 0.5 : 1 }} disabled={added} onClick={onAdd} aria-label={`Aggiungi ${exercise.name}`}>
          {added ? '✓' : <PlusIcon size={14} />}
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={onToggle} aria-label="Istruzioni">
          <ChevronIcon open={open} color="var(--ink-faint)" />
        </button>
      </div>
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

export function ExercisePicker({ catalog, addedIds, onAdd }: { catalog: Catalog; addedIds: string[]; onAdd: (ex: Exercise) => void }) {
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [bodyPart, setBodyPart] = useState('');
  const [q, setQ] = useState('');
  const [result, setResult] = useState<{ total: number; items: Exercise[]; catalogReady: boolean } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    catalog.bodyParts().then(setBodyParts).catch(() => setBodyParts([]));
  }, [catalog]);

  useEffect(() => {
    setResult(null);
    const t = setTimeout(() => {
      catalog.list({ q, bodyPart }).then(setResult).catch(() => setResult({ total: 0, items: [], catalogReady: true }));
    }, 250);
    return () => clearTimeout(t);
  }, [catalog, q, bodyPart]);

  // Il catalogo è a pagine: si accodano gli esercizi successivi a quelli già mostrati.
  const loadMore = async () => {
    if (!result) return;
    setLoadingMore(true);
    try {
      const more = await catalog.list({ q, bodyPart, offset: result.items.length });
      setResult({ ...more, items: [...result.items, ...more.items] });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <input className="nm-text-input" style={{ marginTop: 10 }} placeholder="Cerca per nome (es. squat)…" value={q} onChange={(e) => setQ(e.target.value)} />

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
              added={addedIds.includes(ex.exerciseId)}
              onAdd={() => onAdd(ex)}
            />
          ))}
        </div>
      )}
      {result && result.items.length > 0 && (
        <div style={{ textAlign: 'center', margin: '14px 0' }}>
          <div className="nm-page-sub" style={{ marginBottom: 8 }}>{result.items.length} di {result.total} esercizi</div>
          {result.items.length < result.total && (
            <button className="nm-modal-btn nm-modal-btn-secondary" style={{ width: '100%' }} disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Caricamento…' : 'Mostra altri esercizi'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
