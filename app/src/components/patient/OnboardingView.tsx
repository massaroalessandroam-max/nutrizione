import { useState } from 'react';
import type { AppState, FastingPref, MealScheduleEntry, Schedule } from '../../types';
import { PlusIcon } from '../../icons';

const FIXED_MEALS = ['colazione', 'pranzo', 'cena'] as const;
type FixedMeal = (typeof FIXED_MEALS)[number];

interface Props {
  meals: AppState['meals'];
  defaultSchedule: Schedule;
  defaultFasting: FastingPref;
  onSubmit: (name: string, schedule: Record<FixedMeal, MealScheduleEntry>, snacks: string[], fasting: FastingPref) => void;
}

export function OnboardingView({ meals, defaultSchedule, defaultFasting, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState<Record<FixedMeal, MealScheduleEntry>>({
    colazione: defaultSchedule.colazione, pranzo: defaultSchedule.pranzo, cena: defaultSchedule.cena,
  });
  const [snacks, setSnacks] = useState<string[]>(defaultSchedule.snacks.length ? defaultSchedule.snacks : ['16:30']);
  const [fasting, setFasting] = useState<FastingPref>(defaultFasting);

  const setEnabled = (k: FixedMeal, enabled: boolean) =>
    setSchedule((s) => ({ ...s, [k]: { ...s[k], enabled } }));
  const setTime = (k: FixedMeal, time: string) =>
    setSchedule((s) => ({ ...s, [k]: { ...s[k], time } }));

  const addSnack = () => setSnacks((s) => [...s, '16:30']);
  const removeSnack = (i: number) => setSnacks((s) => s.filter((_, idx) => idx !== i));
  const setSnackTime = (i: number, time: string) =>
    setSnacks((s) => s.map((t, idx) => (idx === i ? time : t)));

  const canSubmit = name.trim().length > 0;

  return (
    <div className="nm-section">
      <div className="nm-page-title">Benvenuto/a</div>
      <div className="nm-page-sub">Raccontaci le tue abitudini, così personalizziamo il diario.</div>

      <div className="nm-section-label">Il tuo nome</div>
      <input
        className="nm-text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Es. Sofia"
      />

      <div className="nm-section-label" style={{ marginTop: 22 }}>I tuoi orari abituali</div>
      <div className="nm-onboard-meal-list">
        {FIXED_MEALS.map((k) => {
          const m = schedule[k];
          return (
            <div key={k} className={`nm-onboard-meal-row ${m.enabled ? 'is-on' : 'is-off'}`}>
              <div className="nm-onboard-meal-head">
                <span className="nm-onboard-meal-name">{meals[k].label}</span>
                <label className="nm-onboard-skip">
                  <input
                    type="checkbox"
                    checked={!m.enabled}
                    onChange={(e) => setEnabled(k, !e.target.checked)}
                  />
                  Di solito lo salto
                </label>
              </div>
              {m.enabled && (
                <input
                  type="time"
                  className="nm-time-input"
                  value={m.time}
                  onChange={(e) => setTime(k, e.target.value)}
                />
              )}
            </div>
          );
        })}

        <div className="nm-onboard-meal-row is-on">
          <div className="nm-onboard-meal-head">
            <span className="nm-onboard-meal-name">Spuntini</span>
          </div>
          {snacks.length === 0 && <div className="nm-hint">Nessuno spuntino abituale.</div>}
          {snacks.map((t, i) => (
            <div key={i} className="nm-onboard-snack-row">
              <input
                type="time"
                className="nm-time-input"
                value={t}
                onChange={(e) => setSnackTime(i, e.target.value)}
              />
              <button className="nm-onboard-remove-btn" onClick={() => removeSnack(i)} aria-label="Rimuovi spuntino">×</button>
            </div>
          ))}
          <button className="nm-onboard-add-btn" onClick={addSnack}>
            <PlusIcon size={14} /> Aggiungi spuntino
          </button>
        </div>
      </div>

      <div className="nm-section-label" style={{ marginTop: 22 }}>Digiuno intermittente</div>
      <div className={`nm-onboard-meal-row ${fasting.enabled ? 'is-on' : 'is-off'}`}>
        <div className="nm-onboard-meal-head">
          <span className="nm-onboard-meal-name">Segui il digiuno intermittente</span>
          <label className="nm-onboard-skip">
            <input
              type="checkbox"
              checked={fasting.enabled}
              onChange={(e) => setFasting((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Sì
          </label>
        </div>
        {fasting.enabled && (
          <div className="nm-onboard-fast-range">
            <div>
              <div className="nm-onboard-fast-label">Da</div>
              <input
                type="time"
                className="nm-time-input"
                value={fasting.start}
                onChange={(e) => setFasting((f) => ({ ...f, start: e.target.value }))}
              />
            </div>
            <div>
              <div className="nm-onboard-fast-label">A</div>
              <input
                type="time"
                className="nm-time-input"
                value={fasting.end}
                onChange={(e) => setFasting((f) => ({ ...f, end: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>

      <button
        className="nm-submit-btn"
        disabled={!canSubmit}
        onClick={() => onSubmit(name.trim(), schedule, snacks, fasting)}
      >
        Continua
      </button>
    </div>
  );
}
