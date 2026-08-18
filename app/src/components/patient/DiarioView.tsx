import type { AppState, MealKey } from '../../types';
import { MEAL_ORDER } from '../../types';
import { RingSvg } from '../RingSvg';
import { FlameIcon, CheckCircleIcon, PlusIcon, ClockIcon } from '../../icons';
import { badgeClass } from '../../lib/tone';
import { MEAL_SHORT, formatDateLabel } from '../../lib/mealMeta';
import { useNow } from '../../hooks/useNow';

interface Props {
  state: AppState;
  onOpenMeal: (key: MealKey) => void;
  onOpenLogQuick: () => void;
  onGoDigiuno: () => void;
}

export function DiarioView({ state, onOpenMeal, onOpenLogQuick, onGoDigiuno }: Props) {
  const now = useNow(state.fastActive);
  const elapsedMs = Math.max(0, now - state.fastStart);
  const h = Math.floor(elapsedMs / 3600000);
  const m = Math.floor((elapsedMs % 3600000) / 60000);
  const fastPct = Math.min(1, elapsedMs / (16 * 3600000));

  const doneCount = state.doneCount;
  const dayHeadline = doneCount >= 3 ? 'Giornata quasi completa!' : 'Buon lavoro finora';
  const daySub = doneCount >= 3 ? 'Ti manca poco per il bonus di oggi.' : 'Registra i prossimi pasti per guadagnare punti.';
  const weekPct = '68%';

  return (
    <div className="nm-section">
      <div className="nm-diario-head">
        <div>
          <div className="nm-eyebrow">{formatDateLabel(state.date)}</div>
          <div className="nm-greeting">Ciao {state.greetingName} 👋</div>
        </div>
        <div className="nm-pills">
          <div className="nm-pill nm-pill-streak">
            <FlameIcon />
            <span>{state.streak}</span>
          </div>
          <div className="nm-pill nm-pill-points">
            <CheckCircleIcon />
            <span>{state.points}</span>
          </div>
        </div>
      </div>

      <div className="nm-ring-card">
        <RingSvg size={112} radius={48} strokeWidth={10} progress={doneCount / 4} trackColor="rgba(255,255,255,.22)" progressColor="var(--gold)">
          <span className="nm-ring-count">{doneCount}/4</span>
          <span className="nm-ring-unit">PASTI</span>
        </RingSvg>
        <div className="nm-ring-info">
          <div className="nm-day-headline">{dayHeadline}</div>
          <div className="nm-day-sub">{daySub}</div>
          <div className="nm-week-row">
            <div className="nm-week-labels"><span>Obiettivo settimana</span><span>{weekPct}</span></div>
            <div className="nm-week-track"><div className="nm-week-fill" style={{ width: weekPct }} /></div>
          </div>
        </div>
      </div>

      <div className="nm-meals">
        {MEAL_ORDER.map((key) => {
          const meal = state.meals[key];
          return (
            <button key={key} className="nm-meal-card" onClick={() => onOpenMeal(key)}>
              <div className="nm-meal-icon" style={{ background: meal.done ? 'var(--good-bg)' : 'var(--neutral-chip)' }}>
                <span style={{ color: meal.done ? 'var(--teal-900)' : 'var(--ink-faint)' }}>{MEAL_SHORT[key]}</span>
              </div>
              <div className="nm-meal-body">
                <div className="nm-meal-title-row">
                  <span className="nm-meal-title">{meal.label}</span>
                  <span className="nm-meal-time">{meal.time}</span>
                </div>
                <div className="nm-meal-preview">{meal.done ? meal.foods.join(', ') : 'Tocca per registrare'}</div>
              </div>
              {meal.done ? (
                <span className={badgeClass(meal.tone)}>{meal.scoreLabel}</span>
              ) : (
                <span className="nm-meal-add"><PlusIcon size={16} color="var(--teal-700)" /></span>
              )}
            </button>
          );
        })}
      </div>

      <button className="nm-fast-mini" onClick={onGoDigiuno}>
        <ClockIcon />
        <div className="nm-fast-mini-body">
          <div className="nm-fast-mini-title">Digiuno intermittente</div>
          <div className="nm-fast-mini-sub">{state.fastActive ? `In corso · ${h}h ${String(m).padStart(2, '0')}m` : 'Non attivo'}</div>
        </div>
        <span className="nm-fast-mini-pct">{Math.round(fastPct * 100)}%</span>
      </button>

      <button className="nm-cta" onClick={onOpenLogQuick}>
        <PlusIcon size={19} color="#fff" />
        Registra un pasto
      </button>
    </div>
  );
}
