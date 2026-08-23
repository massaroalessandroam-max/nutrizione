import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Habit, HabitWeekDay, Weekday } from '../../types';
import { CheckIcon, PencilIcon } from '../../icons';
import { WEEKDAYS, DAY_LABEL, weekdayCodeOf, isDueOn, groupByPeriod, PERIOD_LABEL } from '../../lib/habitMeta';

interface HabitDef { id?: number; text: string; days: Weekday[]; time: string }

const asDef = (h: Habit): HabitDef => ({ id: h.id, text: h.text, days: h.days, time: h.time });

function DayPicker({ days, onChange }: { days: Weekday[]; onChange: (days: Weekday[]) => void }) {
  return (
    <div className="nm-habit-days">
      {WEEKDAYS.map((d) => (
        <button
          key={d}
          type="button"
          className={`nm-habit-day ${days.includes(d) ? 'is-on' : ''}`}
          onClick={() => onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
          aria-label={days.includes(d) ? `Rimuovi ${DAY_LABEL[d]}` : `Aggiungi ${DAY_LABEL[d]}`}
        >
          {DAY_LABEL[d]}
        </button>
      ))}
    </div>
  );
}

interface EditRowProps {
  habit: Habit;
  onSave: (patch: Partial<HabitDef>) => void;
  onDelete: () => void;
}

function EditRow({ habit, onSave, onDelete }: EditRowProps) {
  const [text, setText] = useState(habit.text);

  return (
    <div className="nm-habit-edit-row">
      <div className="nm-habit-edit-top">
        <input
          className="nm-habit-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (text.trim() && text.trim() !== habit.text) onSave({ text: text.trim() }); else setText(habit.text); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
        <button className="nm-habit-delete" onClick={onDelete} aria-label={`Elimina ${habit.text}`}>×</button>
      </div>
      <div className="nm-habit-edit-bottom">
        <input
          className="nm-habit-time"
          type="time"
          value={habit.time}
          onChange={(e) => onSave({ time: e.target.value })}
        />
        <DayPicker days={habit.days} onChange={(days) => onSave({ days })} />
      </div>
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

function TomorrowRow({ habit }: { habit: Habit }) {
  return (
    <div className="nm-habit-row">
      <span className="nm-habit-check" style={{ borderStyle: 'dashed' }} />
      <span className="nm-habit-text-static">{habit.text}</span>
      {habit.time && <span className="nm-habit-time-static">{habit.time}</span>}
    </div>
  );
}

export function AbitudiniView() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [week, setWeek] = useState<HabitWeekDay[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [showTomorrow, setShowTomorrow] = useState(false);

  useEffect(() => {
    api.getHabits().then(setHabits).catch(() => setHabits([]));
    api.getHabitsWeek().then(setWeek).catch(() => setWeek([]));
  }, []);

  const refreshWeek = () => { api.getHabitsWeek().then(setWeek).catch(() => {}); };

  // Base per ogni salvataggio in blocco: le definizioni correnti (senza lo
  // stato del giorno), su cui aggiungere/rimuovere/modificare una voce.
  const currentDefs = (): HabitDef[] => (habits ?? []).map(asDef);

  const toggleToday = async (h: Habit) => {
    setHabits(await api.checkHabit(h.id, !h.doneToday));
    refreshWeek();
  };

  const saveField = async (id: number, patch: Partial<HabitDef>) => {
    const items = currentDefs().map((d) => (d.id === id ? { ...d, ...patch } : d));
    setHabits(await api.saveHabits(items));
    // "days" cambia anche il conteggio dovuto per i giorni passati nel
    // grafico (aderenza calcolata sulla configurazione attuale), non solo
    // per oggi — va rinfrescato a ogni modifica, non solo su check/delete.
    if (patch.days) refreshWeek();
  };

  const removeHabit = async (id: number) => {
    setHabits(await api.saveHabits(currentDefs().filter((d) => d.id !== id)));
    refreshWeek();
  };

  const commitAdd = async () => {
    const text = newText.trim();
    setAdding(false);
    setNewText('');
    if (!text) return;
    const items = [...currentDefs(), { text, days: [] as Weekday[], time: '' }];
    setHabits(await api.saveHabits(items));
    refreshWeek();
  };

  const closeEditing = async () => {
    if (adding && newText.trim()) await commitAdd();
    setEditing(false);
  };

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

  return (
    <div className="nm-section">
      <div className="nm-page-title">Abitudini</div>
      <div className="nm-page-sub">Le tue abitudini di oggi: spuntale mano a mano.</div>

      {week && week.some((d) => d.dueCount > 0) && (
        <div className="nm-week-card">
          <div className="nm-week-card-title">Aderenza abitudini</div>
          <div className="nm-page-sub" style={{ marginTop: -4, marginBottom: 4 }}>Ultimi 7 giorni</div>
          <div className="nm-week-chart">
            {week.map((d) => {
              const color = d.isToday ? 'var(--gold)' : d.duePct > 0 ? 'var(--teal-700)' : 'var(--neutral-chip)';
              const labelColor = d.isToday ? 'var(--ink)' : 'var(--ink-faint)';
              const heightPct = d.dueCount === 0 ? 6 : Math.max(6, d.duePct);
              return (
                <div key={d.date} className="nm-week-day">
                  <div className="nm-week-bar-track">
                    <div className="nm-week-bar-fill" style={{ height: `${heightPct}%`, background: color }} />
                  </div>
                  <span className="nm-week-day-label" style={{ color: labelColor, fontWeight: d.isToday ? 700 : 500 }}>{d.dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing ? (
        <div className="nm-habit-list">
          {habits.map((h) => (
            <EditRow key={h.id} habit={h} onSave={(patch) => saveField(h.id, patch)} onDelete={() => removeHabit(h.id)} />
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

          <button className="nm-btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={closeEditing}>Salva</button>
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
                  {list.map((h) => <TomorrowRow key={h.id} habit={h} />)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
