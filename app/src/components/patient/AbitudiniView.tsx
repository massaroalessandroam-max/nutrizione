import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Habit, HabitFrequency } from '../../types';
import { CheckIcon } from '../../icons';

const FREQ_OPTIONS: Array<{ value: string; frequency: HabitFrequency; targetPerWeek: number; label: string }> = [
  { value: 'daily', frequency: 'daily', targetPerWeek: 7, label: 'Ogni giorno' },
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({
    value: `weekly-${n}`, frequency: 'weekly' as const, targetPerWeek: n, label: `${n}x a settimana`,
  })),
];

const freqValue = (h: Pick<Habit, 'frequency' | 'targetPerWeek'>) =>
  h.frequency === 'daily' ? 'daily' : `weekly-${h.targetPerWeek}`;

interface HabitDef { id?: number; text: string; frequency: HabitFrequency; targetPerWeek: number; time: string }

interface RowProps {
  habit: Habit;
  onToggle: () => void;
  onSave: (patch: Partial<HabitDef>) => void;
  onDelete: () => void;
}

function HabitRow({ habit, onToggle, onSave, onDelete }: RowProps) {
  const [text, setText] = useState(habit.text);

  return (
    <div className="nm-habit-row">
      <button
        className={`nm-habit-check ${habit.doneToday ? 'is-on' : ''}`}
        onClick={onToggle}
        aria-label={habit.doneToday ? `Segna ${habit.text} come non fatta` : `Segna ${habit.text} come fatta`}
      >
        {habit.doneToday && <CheckIcon size={12} color="#fff" strokeWidth={3} />}
      </button>
      <input
        className="nm-habit-text"
        style={{ textDecoration: habit.doneToday ? 'line-through' : 'none', color: habit.doneToday ? 'var(--ink-faint)' : 'var(--ink)' }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text.trim() && text.trim() !== habit.text) onSave({ text: text.trim() }); else setText(habit.text); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <input
        className="nm-habit-time"
        type="time"
        value={habit.time}
        onChange={(e) => onSave({ time: e.target.value })}
      />
      {habit.frequency === 'weekly' && (
        <span className="nm-habit-progress">{habit.weekCount}/{habit.targetPerWeek}</span>
      )}
      <select
        className="nm-habit-freq"
        value={freqValue(habit)}
        onChange={(e) => {
          const opt = FREQ_OPTIONS.find((o) => o.value === e.target.value)!;
          onSave({ frequency: opt.frequency, targetPerWeek: opt.targetPerWeek });
        }}
      >
        {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button className="nm-habit-delete" onClick={onDelete} aria-label={`Elimina ${habit.text}`}>×</button>
    </div>
  );
}

export function AbitudiniView() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    api.getHabits().then(setHabits).catch(() => setHabits([]));
  }, []);

  // Base per ogni salvataggio in blocco: le definizioni correnti (senza lo
  // stato del giorno), su cui aggiungere/rimuovere/modificare una voce.
  const currentDefs = (): HabitDef[] =>
    (habits ?? []).map((h) => ({ id: h.id, text: h.text, frequency: h.frequency, targetPerWeek: h.targetPerWeek, time: h.time }));

  const toggleToday = async (h: Habit) => {
    setHabits(await api.checkHabit(h.id, !h.doneToday));
  };

  const saveField = async (id: number, patch: Partial<HabitDef>) => {
    const items = currentDefs().map((d) => (d.id === id ? { ...d, ...patch } : d));
    setHabits(await api.saveHabits(items));
  };

  const removeHabit = async (id: number) => {
    setHabits(await api.saveHabits(currentDefs().filter((d) => d.id !== id)));
  };

  const commitAdd = async () => {
    const text = newText.trim();
    setAdding(false);
    setNewText('');
    if (!text) return;
    const items = [...currentDefs(), { text, frequency: 'daily' as HabitFrequency, targetPerWeek: 7, time: '' }];
    setHabits(await api.saveHabits(items));
  };

  return (
    <div className="nm-section">
      <div className="nm-page-title">Abitudini</div>
      <div className="nm-page-sub">Le tue abitudini di oggi: spuntale mano a mano.</div>

      {habits === null ? (
        <div className="nm-empty-state">Caricamento…</div>
      ) : (
        <div className="nm-habit-list">
          {habits.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              onToggle={() => toggleToday(h)}
              onSave={(patch) => saveField(h.id, patch)}
              onDelete={() => removeHabit(h.id)}
            />
          ))}

          {adding ? (
            <div className="nm-habit-add-row">
              <span className="nm-habit-check" style={{ borderStyle: 'dashed' }} />
              <input
                className="nm-habit-add-input"
                autoFocus
                placeholder="Nuova abitudine…"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onBlur={commitAdd}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setNewText(''); setAdding(false); } }}
              />
            </div>
          ) : (
            <button className="nm-habit-add-trigger" onClick={() => setAdding(true)}>+ Nuova abitudine</button>
          )}
        </div>
      )}
    </div>
  );
}
