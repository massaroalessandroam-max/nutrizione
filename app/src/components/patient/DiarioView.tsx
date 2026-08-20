import type { AppState, MealKey } from '../../types';
import { MEAL_ORDER } from '../../types';
import { RingSvg } from '../RingSvg';
import { FlameIcon, CheckCircleIcon, PlusIcon, ClockIcon, TrashIcon, MinusCircleIcon, UndoIcon, MealIcon } from '../../icons';
import { badgeClass } from '../../lib/tone';
import { formatDateLabel } from '../../lib/mealMeta';
import { useNow } from '../../hooks/useNow';

interface Props {
  state: AppState;
  onOpenMeal: (key: MealKey) => void;
  onOpenLogQuick: () => void;
  onGoDigiuno: () => void;
  onDeleteMeal: (key: MealKey) => void;
  onSkipMeal: (key: MealKey, skipped: boolean) => void;
}

export function DiarioView({ state, onOpenMeal, onOpenLogQuick, onGoDigiuno, onDeleteMeal, onSkipMeal }: Props) {
  const now = useNow(state.fastActive);
  const elapsedMs = Math.max(0, now - state.fastStart);
  const h = Math.floor(elapsedMs / 3600000);
  const m = Math.floor((elapsedMs % 3600000) / 60000);
  const fastPct = Math.min(1, elapsedMs / (16 * 3600000));

  const doneCount = state.doneCount;
  // Denominatore basato sui pasti che il paziente fa davvero (onboarding) e
  // su eventuali "salta oggi" (es. digiuno prolungato) — non un fisso 4,
  // altrimenti chi non fa spuntini (o oggi salta un pasto) non arriva mai
  // al 100%.
  const activeCount = Math.max(1, state.activeMealCount);
  const shownCount = Math.min(doneCount, activeCount);
  const almostThreshold = Math.max(1, activeCount - 1);
  const dayHeadline = doneCount >= almostThreshold ? 'Giornata quasi completa!' : 'Buon lavoro finora';
  const daySub = doneCount >= almostThreshold ? 'Ti manca poco per il bonus di oggi.' : 'Registra i prossimi pasti per guadagnare punti.';
  // Pasti fatti negli ultimi 7 giorni sul totale atteso (pasti/giorno di
  // oggi × 7) — stessa base della ring giornaliera, non un valore fisso.
  const weekDone = state.week.reduce((sum, d) => sum + d.doneCount, 0);
  const weekTarget = activeCount * state.week.length;
  const weekPct = `${weekTarget > 0 ? Math.min(100, Math.round((weekDone / weekTarget) * 100)) : 0}%`;
  const visibleMeals = MEAL_ORDER.filter((k) => state.activeMeals.includes(k) || state.meals[k].done);

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
        <div className="nm-ring-top">
          <RingSvg size={112} radius={48} strokeWidth={10} progress={shownCount / activeCount} trackColor="rgba(255,255,255,.22)" progressColor="var(--gold)">
            <span className="nm-ring-count">{shownCount}/{activeCount}</span>
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
        <div className="nm-week-days-row">
          {state.week.map((d) => {
            // Cerchio pieno (oro) solo se il giorno è completo; altrimenti
            // più denso quanti più pasti mancano, non solo acceso/spento.
            const complete = d.doneCount >= activeCount;
            const density = Math.min(1, Math.max(0, activeCount - d.doneCount) / activeCount);
            return (
              <div
                key={d.date}
                className={`nm-week-day-circle ${complete ? 'is-complete' : ''} ${d.isToday ? 'is-today' : ''}`}
                style={complete ? undefined : { background: `rgba(255,255,255,${(0.14 + density * 0.4).toFixed(2)})` }}
                title={`${d.doneCount}/${activeCount} pasti`}
              >
                {d.dayLabel}
              </div>
            );
          })}
        </div>
      </div>

      <div className="nm-meals">
        {visibleMeals.map((key) => {
          const meal = state.meals[key];
          return (
            <div key={key} className={`nm-meal-card ${meal.done ? 'is-done' : ''}`}>
              <button className="nm-meal-card-main" onClick={() => onOpenMeal(key)}>
                <div className="nm-meal-icon" style={{ background: meal.done ? 'var(--card)' : 'var(--neutral-chip)' }}>
                  <MealIcon meal={key} size={20} color={meal.done ? 'var(--teal-900)' : 'var(--ink-faint)'} />
                </div>
                <div className="nm-meal-body">
                  <div className="nm-meal-title-row">
                    <span className="nm-meal-title">{meal.label}</span>
                    <span className="nm-meal-time">{meal.time}</span>
                  </div>
                  <div className="nm-meal-preview">
                    {meal.done
                      ? `+${meal.foods.length} ${meal.foods.length === 1 ? 'alimento' : 'alimenti'}`
                      : meal.skipped ? 'Saltato oggi' : 'Tocca per registrare'}
                  </div>
                </div>
                {meal.done ? (
                  <span className={badgeClass(meal.tone)}>{meal.scoreLabel}</span>
                ) : !meal.skipped ? (
                  <span className="nm-meal-add"><PlusIcon size={16} color="var(--teal-700)" /></span>
                ) : null}
              </button>
              {meal.done && (
                <button
                  className="nm-meal-delete-btn"
                  onClick={() => onDeleteMeal(key)}
                  aria-label={`Elimina ${meal.label}`}
                >
                  <TrashIcon size={16} />
                </button>
              )}
              {!meal.done && !meal.skipped && (
                <button
                  className="nm-meal-delete-btn"
                  onClick={() => onSkipMeal(key, true)}
                  aria-label={`Salta ${meal.label} oggi`}
                >
                  <MinusCircleIcon size={16} />
                </button>
              )}
              {!meal.done && meal.skipped && (
                <button
                  className="nm-meal-delete-btn"
                  onClick={() => onSkipMeal(key, false)}
                  aria-label={`Ripristina ${meal.label}`}
                >
                  <UndoIcon size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {state.fastActive && (
        <button className="nm-fast-mini" onClick={onGoDigiuno}>
          <ClockIcon size={15} color="var(--teal-700)" />
          <div className="nm-fast-mini-body">
            <div className="nm-fast-mini-title">Digiuno in corso</div>
            <div className="nm-fast-mini-sub">{h}h {String(m).padStart(2, '0')}m</div>
          </div>
          <span className="nm-fast-mini-pct">{Math.round(fastPct * 100)}%</span>
        </button>
      )}

      <button className="nm-cta" onClick={onOpenLogQuick}>
        <PlusIcon size={19} color="#fff" />
        Registra un pasto
      </button>
    </div>
  );
}
