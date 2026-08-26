import { useState } from 'react';
import type { DayPeriod } from '../../types';
import { BackArrowIcon } from '../../icons';
import { DAY_PERIODS, PERIOD_LABEL, type HabitDef } from '../../lib/habitMeta';
import { DayPicker } from './DayPicker';

const BLANK: HabitDef = { text: '', days: [], time: '', category: null };

interface Props {
  habit: HabitDef | null;
  onSave: (def: HabitDef) => void;
  onCancel: () => void;
}

export function HabitConfigView({ habit, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<HabitDef>(habit ?? BLANK);
  const isNew = habit === null;

  const canSave = draft.text.trim().length > 0;

  return (
    <div className="nm-section">
      <button className="nm-back-btn" onClick={onCancel}><BackArrowIcon />Indietro</button>
      <div className="nm-page-title">{isNew ? 'Nuova abitudine' : 'Configura Abitudine'}</div>

      <div className="nm-onboard-meal-list">
        <div className="nm-onboard-meal-row">
          <div className="nm-onboard-meal-name">Nome dell'abitudine</div>
          <input
            className="nm-text-input"
            style={{ marginTop: 10 }}
            placeholder="Es. Bere 2 litri d'acqua"
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            autoFocus={isNew}
          />
        </div>

        <div className="nm-onboard-meal-row">
          <div className="nm-onboard-meal-name">Orario di esecuzione</div>
          <input
            className="nm-time-input"
            type="time"
            value={draft.time}
            onChange={(e) => setDraft({ ...draft, time: e.target.value })}
          />
        </div>

        <div className="nm-onboard-meal-row">
          <div className="nm-onboard-meal-name">Giorni della settimana</div>
          <div style={{ marginTop: 10 }}>
            <DayPicker days={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
          </div>
        </div>

        <div className="nm-onboard-meal-row">
          <div className="nm-onboard-meal-name">Categoria</div>
          <div className="nm-habit-category-grid">
            {DAY_PERIODS.map((p: DayPeriod) => (
              <button
                key={p}
                type="button"
                className={`nm-habit-category-card ${draft.category === p ? 'is-on' : ''}`}
                onClick={() => setDraft({ ...draft, category: draft.category === p ? null : p })}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className="nm-btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={!canSave} onClick={() => onSave(draft)}>
        Salva
      </button>
    </div>
  );
}
