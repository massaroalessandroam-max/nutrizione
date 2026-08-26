import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Habit, HabitDayItem, HabitWeekDay, Weekday } from '../../types';
import { CheckIcon, PencilIcon, TrashIcon } from '../../icons';
import { DAY_LABEL, weekdayCodeOf, isDueOn, groupByPeriod, PERIOD_LABEL, asHabitDef, type HabitDef } from '../../lib/habitMeta';
import { HabitConfigView } from './HabitConfigView';

function daysSummary(days: Weekday[]): string {
  if (days.length === 0) return 'Ogni giorno';
  return days.map((d) => DAY_LABEL[d]).join(', ');
}

function SummaryRow({ habit, onEdit, onDelete }: { habit: Habit; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="nm-habit-summary-row">
      <div className="nm-habit-summary-main">
        <div className="nm-habit-summary-text">{habit.text}</div>
        <div className="nm-habit-summary-meta">
          {habit.time && `${habit.time} · `}{daysSummary(habit.days)}
        </div>
      </div>
      <button className="nm-habit-edit-btn" onClick={onEdit} aria-label={`Modifica ${habit.text}`}><PencilIcon size={15} /></button>
      <button className="nm-habit-delete" style={{ opacity: 1 }} onClick={onDelete} aria-label={`Elimina ${habit.text}`}><TrashIcon size={15} /></button>
    </div>
  );
}

function TodayRow({ habit, onToggle }: { habit: Habit; onToggle: () => void }) {
  return (
    <div className="nm-habit-row">
      <button
        className={`nm-habit-check ${habit.doneToday ? 'is-on' : ''}`}
        onClick={onToggle}
        aria-label={habit.doneToday ? `Segna ${habit.text} come non fatta` : `Segna ${habit.text} come fatta`}
      >
        {habit.doneToday && <CheckIcon size={12} color="#fff" strokeWidth={3} />}
      </button>
      <span
        className="nm-habit-text-static"
        style={{ textDecoration: habit.doneToday ? 'line-through' : 'none', color: habit.doneToday ? 'var(--ink-faint)' : 'var(--ink)' }}
      >
        {habit.text}
      </span>
      {habit.time && <span className="nm-habit-time-static">{habit.time}</span>}
    </div>
  );
}

// Riga di sola lettura per domani (non ancora accaduto: spunta sempre
// tratteggiata) e per un giorno passato della striscia (spunta piena se
// `done`, così la differenza tra "non ancora dovuto" e "dovuto ma saltato"
// resta visibile anche nella storia).
function ReadOnlyRow({ text, time, done }: { text: string; time: string; done: boolean }) {
  return (
    <div className="nm-habit-row">
      {done ? (
        <span className="nm-habit-check is-on"><CheckIcon size={12} color="#fff" strokeWidth={3} /></span>
      ) : (
        <span className="nm-habit-check" style={{ borderStyle: 'dashed' }} />
      )}
      <span className="nm-habit-text-static" style={{ color: done ? 'var(--ink-faint)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>{text}</span>
      {time && <span className="nm-habit-time-static">{time}</span>}
    </div>
  );
}

export function AbitudiniView() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [week, setWeek] = useState<HabitWeekDay[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [configuring, setConfiguring] = useState<HabitDef | 'new' | null>(null);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // null = oggi
  const [dayDetail, setDayDetail] = useState<HabitDayItem[] | null>(null);

  useEffect(() => {
    api.getHabits().then(setHabits).catch(() => setHabits([]));
    api.getHabitsWeek().then(setWeek).catch(() => setWeek([]));
  }, []);

  useEffect(() => {
    if (selectedDate === null) { setDayDetail(null); return; }
    setDayDetail(null);
    api.getHabitsDay(selectedDate).then(setDayDetail).catch(() => setDayDetail([]));
  }, [selectedDate]);

  const refreshWeek = () => { api.getHabitsWeek().then(setWeek).catch(() => {}); };

  // Base per ogni salvataggio in blocco: le definizioni correnti (senza lo
  // stato del giorno), su cui aggiungere/rimuovere/modificare una voce.
  const currentDefs = (): HabitDef[] => (habits ?? []).map(asHabitDef);

  const toggleToday = async (h: Habit) => {
    setHabits(await api.checkHabit(h.id, !h.doneToday));
    refreshWeek();
  };

  const saveDraft = async (draft: HabitDef) => {
    const defs = currentDefs();
    const items = draft.id !== undefined ? defs.map((d) => (d.id === draft.id ? draft : d)) : [...defs, draft];
    setHabits(await api.saveHabits(items));
    refreshWeek();
    setConfiguring(null);
  };

  const removeHabit = async (id: number) => {
    setHabits(await api.saveHabits(currentDefs().filter((d) => d.id !== id)));
    refreshWeek();
  };

  if (configuring !== null) {
    return (
      <HabitConfigView
        habit={configuring === 'new' ? null : configuring}
        onSave={saveDraft}
        onCancel={() => setConfiguring(null)}
      />
    );
  }

  if (habits === null) {
    return (
      <div className="nm-section">
        <div className="nm-page-title">Abitudini</div>
        <div className="nm-empty-state">Caricamento…</div>
      </div>
    );
  }

  const dueTodayGroups = groupByPeriod(habits.filter((h) => h.dueToday));
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowCode = weekdayCodeOf(tomorrow);
  const tomorrowGroups = groupByPeriod(habits.filter((h) => isDueOn(h, tomorrowCode)));
  const dayDetailGroups = dayDetail ? groupByPeriod(dayDetail.filter((h) => h.due)) : null;
  const selectedDay = week?.find((d) => d.date === selectedDate);

  return (
    <div className="nm-section">
      <div className="nm-page-title">Abitudini</div>
      <div className="nm-page-sub">Le tue abitudini di oggi: spuntale mano a mano.</div>

      {week && week.some((d) => d.dueCount > 0) && (
        <div className="nm-week-card">
          <div className="nm-week-card-title">Aderenza abitudini</div>
          <div className="nm-page-sub" style={{ marginTop: -4, marginBottom: 4 }}>Ultimi 7 giorni — tocca un giorno per vederne le abitudini</div>
          <div className="nm-week-chart">
            {week.map((d) => {
              const isSelected = d.isToday ? selectedDate === null : selectedDate === d.date;
              const color = isSelected ? 'var(--gold)' : d.duePct > 0 ? 'var(--teal-700)' : 'var(--neutral-chip)';
              const labelColor = isSelected ? 'var(--ink)' : 'var(--ink-faint)';
              const heightPct = d.dueCount === 0 ? 6 : Math.max(6, d.duePct);
              return (
                <button
                  key={d.date}
                  className="nm-week-day nm-week-day-btn"
                  onClick={() => setSelectedDate(d.isToday ? null : d.date)}
                  aria-label={`Abitudini del ${d.dayLabel}`}
                >
                  <div className="nm-week-bar-track">
                    <div className="nm-week-bar-fill" style={{ height: `${heightPct}%`, background: color }} />
                  </div>
                  <span className="nm-week-day-label" style={{ color: labelColor, fontWeight: isSelected ? 700 : 500 }}>{d.dayLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedDate !== null ? (
        <>
          <div className="nm-section-label" style={{ marginTop: 14 }}>{selectedDay?.dayLabel ?? selectedDate}</div>
          {dayDetailGroups === null ? (
            <div className="nm-empty-state">Caricamento…</div>
          ) : dayDetailGroups.length === 0 ? (
            <div className="nm-empty-state">Nessuna abitudine prevista.</div>
          ) : (
            <div className="nm-habit-list">
              {dayDetailGroups.map(([period, list]) => (
                <div key={period}>
                  <div className="nm-section-label">{PERIOD_LABEL[period]}</div>
                  {list.map((h) => <ReadOnlyRow key={h.id} text={h.text} time={h.time} done={h.done} />)}
                </div>
              ))}
            </div>
          )}
        </>
      ) : editing ? (
        <div className="nm-habit-list">
          {habits.map((h) => (
            <SummaryRow key={h.id} habit={h} onEdit={() => setConfiguring(asHabitDef(h))} onDelete={() => removeHabit(h.id)} />
          ))}
          <button className="nm-habit-add-trigger" onClick={() => setConfiguring('new')}>+ Nuova abitudine</button>
          <button className="nm-btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => setEditing(false)}>Fatto</button>
        </div>
      ) : (
        <>
          <button className="nm-habit-manage-btn" onClick={() => setEditing(true)}>
            <PencilIcon size={14} /> Crea/modifica abitudini
          </button>

          {dueTodayGroups.length === 0 ? (
            <div className="nm-empty-state">Nessuna abitudine per oggi.</div>
          ) : (
            <div className="nm-habit-list">
              {dueTodayGroups.map(([period, list]) => (
                <div key={period}>
                  <div className="nm-section-label">{PERIOD_LABEL[period]}</div>
                  {list.map((h) => <TodayRow key={h.id} habit={h} onToggle={() => toggleToday(h)} />)}
                </div>
              ))}
            </div>
          )}

          <button className="nm-habit-tomorrow-btn" onClick={() => setShowTomorrow((v) => !v)}>
            {showTomorrow ? 'Nascondi impegni di domani' : 'Vedi impegni per domani'}
          </button>

          {showTomorrow && (
            <div className="nm-habit-list" style={{ marginTop: 10 }}>
              {tomorrowGroups.length === 0 ? (
                <div className="nm-empty-state">Nessuna abitudine prevista domani.</div>
              ) : tomorrowGroups.map(([period, list]) => (
                <div key={period}>
                  <div className="nm-section-label">{PERIOD_LABEL[period]}</div>
                  {list.map((h) => <ReadOnlyRow key={h.id} text={h.text} time={h.time} done={false} />)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
