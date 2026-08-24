import { useEffect, useState } from 'react';
import type { NutritionistPatientDetail, NutritionistTeamMember, Message, GoalLevel } from '../../types';
import { MEAL_ORDER } from '../../types';
import { badgeClass } from '../../lib/tone';
import { MEAL_LABEL, MOOD_EMOJI, formatDateLabel } from '../../lib/mealMeta';
import { DAY_LABEL } from '../../lib/habitMeta';
import { MAX_PER_WEEK_LABEL, MAX_PER_WEEK_SELECT_OPTIONS } from '../../lib/planMeta';
import { BackArrowIcon, PlusIcon, TrashIcon } from '../../icons';
import { api, PLAN_CATEGORIES, type Report, type PlanItem } from '../../api';
import { ShareActions } from '../ShareActions';

type Tab = 'diario' | 'andamento' | 'abitudini' | 'piano' | 'report' | 'messaggi';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'diario', label: 'Diario' },
  { key: 'andamento', label: 'Andamento' },
  { key: 'abitudini', label: 'Abitudini' },
  { key: 'piano', label: 'Piano' },
  { key: 'report', label: 'Report' },
  { key: 'messaggi', label: 'Messaggi' },
];

interface Props {
  patient: NutritionistPatientDetail | null;
  messages: Message[] | null;
  team: NutritionistTeamMember[] | null;
  onBack: () => void;
  onAddAppointment: (at: string, note: string) => Promise<void>;
  onDeleteAppointment: (appointmentId: number) => Promise<void>;
  onAddGoal: (level: GoalLevel, text: string, targetDate: string) => Promise<void>;
  onDeleteGoal: (goalId: number) => Promise<void>;
  onSavePlan: (items: PlanItem[]) => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onSetOwner: (nutritionistId: number | null) => Promise<void>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PatientDetailView({
  patient, messages, team, onBack, onAddAppointment, onDeleteAppointment, onAddGoal, onDeleteGoal, onSavePlan, onSendMessage, onSetOwner,
}: Props) {
  const [tab, setTab] = useState<Tab>('diario');
  const [apptAt, setApptAt] = useState('');
  const [apptNote, setApptNote] = useState('');
  const [goalLevel, setGoalLevel] = useState<GoalLevel>('macro');
  const [goalText, setGoalText] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [planSaving, setPlanSaving] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [reportFrom, setReportFrom] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(todayIso());
  const [report, setReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Risincronizza solo quando cambia il paziente selezionato, non ad ogni
  // refresh del dettaglio (altrimenti una modifica in corso qui verrebbe
  // persa quando un'altra azione, es. aggiungere un appuntamento, ricarica
  // patient da capo).
  useEffect(() => {
    setPlanItems(patient?.plan.items ?? []);
  }, [patient?.id]);

  if (!patient) return <div className="nm-empty-state">Caricamento…</div>;

  const submitAppointment = async () => {
    if (!apptAt) return;
    await onAddAppointment(apptAt, apptNote.trim());
    setApptAt('');
    setApptNote('');
  };

  const submitGoal = async () => {
    const text = goalText.trim();
    if (!text || !goalTargetDate) return;
    await onAddGoal(goalLevel, text, goalTargetDate);
    setGoalText('');
    setGoalTargetDate('');
  };

  const updatePlanItem = (i: number, patch: Partial<PlanItem>) =>
    setPlanItems((items) => items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removePlanItem = (i: number) => setPlanItems((items) => items.filter((_, idx) => idx !== i));
  const addPlanItem = () => setPlanItems((items) => [...items, { name: '', quantity: '', category: '', maxPerWeek: '' }]);

  const savePlan = async () => {
    setPlanSaving(true);
    try {
      await onSavePlan(planItems.filter((it) => it.name.trim()));
    } finally {
      setPlanSaving(false);
    }
  };

  const loadReport = async () => {
    setReportLoading(true);
    try {
      setReport(await api.getPatientReport(patient.id, reportFrom, reportTo));
    } finally {
      setReportLoading(false);
    }
  };

  const submitMessage = async () => {
    const text = messageText.trim();
    if (!text) return;
    setMessageText('');
    await onSendMessage(text);
  };

  const regenerateCode = async () => {
    const { accessCode } = await api.regeneratePatientCode(patient.id);
    setNewCode(accessCode);
  };

  return (
    <div>
      <button className="nm-back-btn" onClick={onBack}>
        <BackArrowIcon />Tutti i pazienti
      </button>

      <div className="nm-patient-header">
        <div className="nm-avatar is-lg" style={{ background: 'var(--neutral-chip)', color: 'var(--ink-soft)' }}>
          {patient.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div className="nm-patient-header-name">{patient.name}</div>
          <div className="nm-patient-header-plan">{patient.state.onboarded ? `Ciao, ${patient.state.greetingName}` : 'Non ancora entrato/a nell\'app'}</div>
        </div>
        <button className="nm-modal-btn nm-modal-btn-secondary" style={{ flex: 'none' }} onClick={regenerateCode}>
          Rigenera codice
        </button>
      </div>

      <div className="nm-owner-row">
        <span className="nm-owner-label">Titolare</span>
        <select
          className="nm-owner-select"
          value={patient.ownerId ?? ''}
          onChange={(e) => onSetOwner(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Non assegnato</option>
          {team?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <span className="nm-page-sub" style={{ margin: 0 }}>Visibile a tutto il team in ogni caso.</span>
      </div>

      {newCode && (
        <div className="nm-plan-item-card">
          <div style={{ fontWeight: 600 }}>Nuovo codice per {patient.name}</div>
          <div className="nm-page-sub" style={{ marginTop: 2 }}>Il vecchio non funziona più. Condividilo — non sarà più visibile dopo.</div>
          <div className="nm-text-input" style={{ marginTop: 8, fontWeight: 700, letterSpacing: 2, textAlign: 'center' }}>{newCode}</div>
          <ShareActions
            text={`Ciao ${patient.name}, ecco il tuo nuovo codice per accedere a Diario Nemis: ${newCode}`}
            emailSubject="Il tuo nuovo codice Diario Nemis"
          />
          <button className="nm-modal-btn nm-modal-btn-secondary" style={{ marginTop: 8 }} onClick={() => setNewCode(null)}>Fatto</button>
        </div>
      )}

      <div className="nm-patient-stats">
        <div className="nm-patient-stat">
          <div className="nm-patient-stat-value" style={{ color: 'var(--teal-700)' }}>{patient.state.adherencePct}%</div>
          <div className="nm-patient-stat-label">aderenza</div>
        </div>
        <div className="nm-patient-stat">
          <div className="nm-patient-stat-value" style={{ color: 'var(--gold-text)' }}>{patient.state.streak}</div>
          <div className="nm-patient-stat-label">giorni</div>
        </div>
        <div className="nm-patient-stat">
          <div className="nm-patient-stat-value" style={{ color: 'var(--teal-900)' }}>{patient.state.points}</div>
          <div className="nm-patient-stat-label">punti</div>
        </div>
      </div>

      <div className="nm-section-label" style={{ marginTop: 16 }}>Appuntamenti</div>
      {patient.state.appointments.length === 0 && <div className="nm-hint">Nessun appuntamento ancora.</div>}
      {patient.state.appointments.map((a) => (
        <div key={a.id} className="nm-plan-item-card" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{formatDateLabel(a.at)}</strong>
            {a.note && <div className="nm-page-sub" style={{ margin: 0 }}>{a.note}</div>}
          </div>
          <button className="nm-plan-row-icon-btn" onClick={() => onDeleteAppointment(a.id)} aria-label={`Elimina appuntamento del ${a.at}`}>
            <TrashIcon size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <input className="nm-text-input" type="date" value={apptAt} onChange={(e) => setApptAt(e.target.value)} />
        <input className="nm-text-input" style={{ flex: 1, minWidth: 140 }} placeholder="Nota (facoltativa)" value={apptNote} onChange={(e) => setApptNote(e.target.value)} />
        <button className="nm-modal-btn nm-modal-btn-primary" style={{ flex: 'none', padding: '0 16px' }} disabled={!apptAt} onClick={submitAppointment}>
          <PlusIcon size={14} />
        </button>
      </div>

      <div className="nm-section-label" style={{ marginTop: 20 }}>Obiettivi</div>
      {patient.state.goals.length === 0 && <div className="nm-hint">Nessun obiettivo ancora.</div>}
      {patient.state.goals.map((g) => (
        <div key={g.id} className="nm-plan-item-card" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{g.level === 'macro' ? 'Macro' : 'Micro'}</strong> · {g.text}
            <div className="nm-page-sub" style={{ margin: 0 }}>Entro {formatDateLabel(g.targetDate)}</div>
          </div>
          <button className="nm-plan-row-icon-btn" onClick={() => onDeleteGoal(g.id)} aria-label={`Elimina obiettivo ${g.text}`}>
            <TrashIcon size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <select className="nm-owner-select" value={goalLevel} onChange={(e) => setGoalLevel(e.target.value as GoalLevel)}>
          <option value="macro">Macro</option>
          <option value="micro">Micro</option>
        </select>
        <input className="nm-text-input" style={{ flex: 1, minWidth: 140 }} placeholder="Es. Perdere 30kg" value={goalText} onChange={(e) => setGoalText(e.target.value)} />
        <input className="nm-text-input" type="date" value={goalTargetDate} onChange={(e) => setGoalTargetDate(e.target.value)} />
        <button className="nm-modal-btn nm-modal-btn-primary" style={{ flex: 'none', padding: '0 16px' }} disabled={!goalText.trim() || !goalTargetDate} onClick={submitGoal}>
          <PlusIcon size={14} />
        </button>
      </div>

      <div className="nm-chip-row" style={{ marginTop: 18 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`nm-chip ${tab === t.key ? 'is-on' : 'is-off'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'diario' && (
        <div className="nm-log-list" style={{ marginTop: 14 }}>
          {MEAL_ORDER.filter((k) => patient.state.meals[k].done).length === 0 && (
            <div className="nm-empty-state">Nessun pasto registrato oggi.</div>
          )}
          {MEAL_ORDER.filter((k) => patient.state.meals[k].done).map((k) => {
            const m = patient.state.meals[k];
            return (
              <div key={k} className="nm-log-card">
                <div className="nm-log-card-head">
                  <div className="nm-log-card-title">
                    <span>{MEAL_LABEL[k]}</span>
                    <span>{m.time}{m.mood ? ` · ${MOOD_EMOJI[m.mood]}` : ''}</span>
                  </div>
                  <span className={badgeClass(m.tone)}>{m.scoreLabel}</span>
                </div>
                <div className="nm-food-chips">
                  {m.foods.map((f, i) => <span key={i} className="nm-food-chip nm-food-chip-neutral">{f}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'andamento' && (
        <div style={{ marginTop: 14 }}>
          <div className="nm-week-card">
            <div className="nm-week-card-title">Ultimi 7 giorni</div>
            <div className="nm-week-chart">
              {patient.state.week.map((d) => {
                const max = Math.max(1, ...patient.state.week.map((x) => x.doneCount));
                const heightPct = d.doneCount === 0 ? 6 : Math.round((d.doneCount / max) * 100);
                return (
                  <div key={d.date} className="nm-week-day">
                    <div className="nm-week-bar-track">
                      <div className="nm-week-bar-fill" style={{ height: `${heightPct}%`, background: d.isToday ? 'var(--gold)' : 'var(--teal-700)' }} />
                    </div>
                    <span className="nm-week-day-label">{d.dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="nm-section-label" style={{ marginTop: 16 }}>Obiettivi</div>
          <div className="nm-badge-grid">
            {patient.state.badges.map((b) => (
              <div key={b.key} className="nm-badge-card" style={{ opacity: b.earned ? 1 : 0.6 }}>
                <div className="nm-badge-icon">{b.icon}</div>
                <div className="nm-badge-name">{b.name}</div>
                <div className="nm-badge-progress-label">{Math.min(b.current, b.target)}/{b.target}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'abitudini' && (
        <div className="nm-habit-list" style={{ marginTop: 14 }}>
          {patient.habits.length === 0 && <div className="nm-empty-state">Nessuna abitudine impostata.</div>}
          {patient.habits.map((h) => (
            <div key={h.id} className="nm-habit-row">
              <span style={{ flex: 1 }}>{h.text}</span>
              {h.time && <span className="nm-habit-time">{h.time}</span>}
              <span className="nm-habit-progress">
                {h.days.length === 0 ? 'Ogni giorno' : h.days.map((d) => DAY_LABEL[d]).join(' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'piano' && (
        <div style={{ marginTop: 14 }}>
          {planItems.length === 0 && <div className="nm-empty-state">Nessun alimento nel piano.</div>}
          {planItems.map((it, i) => (
            <div key={i} className="nm-plan-item-card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="nm-text-input" style={{ flex: 1 }} placeholder="Alimento" value={it.name} onChange={(e) => updatePlanItem(i, { name: e.target.value })} />
                <button className="nm-plan-row-icon-btn" onClick={() => removePlanItem(i)} aria-label={`Elimina ${it.name || 'alimento'}`}>
                  <TrashIcon size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="nm-text-input" placeholder="Grammatura" value={it.quantity} onChange={(e) => updatePlanItem(i, { quantity: e.target.value })} />
                <select className="nm-text-input" value={it.category} onChange={(e) => updatePlanItem(i, { category: e.target.value })}>
                  <option value="">Altro</option>
                  {PLAN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="nm-text-input" value={it.maxPerWeek} onChange={(e) => updatePlanItem(i, { maxPerWeek: e.target.value })}>
                  {MAX_PER_WEEK_SELECT_OPTIONS.map((o) => <option key={o} value={o}>{MAX_PER_WEEK_LABEL[o]}</option>)}
                </select>
              </div>
            </div>
          ))}
          <button className="nm-onboard-add-btn" onClick={addPlanItem}>
            <PlusIcon size={14} /> Aggiungi alimento
          </button>
          <button className="nm-submit-btn" style={{ marginTop: 14 }} disabled={planSaving} onClick={savePlan}>
            {planSaving ? 'Salvataggio…' : 'Salva piano'}
          </button>

          {patient.plan.notes.divieti.length > 0 && (
            <>
              <div className="nm-section-label" style={{ marginTop: 14 }}>Divieti</div>
              {patient.plan.notes.divieti.map((d, i) => <div key={i} className="nm-page-sub">• {d}</div>)}
            </>
          )}
          {patient.plan.notes.generalRules.length > 0 && (
            <>
              <div className="nm-section-label" style={{ marginTop: 14 }}>Regole generali</div>
              {patient.plan.notes.generalRules.map((r, i) => <div key={i} className="nm-page-sub">• {r}</div>)}
            </>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="nm-text-input" type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
            <input className="nm-text-input" type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
            <button className="nm-modal-btn nm-modal-btn-primary" style={{ flex: 'none', padding: '0 16px' }} onClick={loadReport}>
              {reportLoading ? '…' : 'Vai'}
            </button>
          </div>
          {report && (
            <div style={{ marginTop: 14 }}>
              <div className="nm-page-sub">{report.totalMeals} pasti · {report.adherencePct}% aderenza</div>
              {report.days.map((d) => (
                <div key={d.date} style={{ marginTop: 10 }}>
                  <div className="nm-section-label">{formatDateLabel(d.date)}</div>
                  {d.meals.map((m, i) => (
                    <div key={i} className="nm-log-card">
                      <div className="nm-log-card-head">
                        <div className="nm-log-card-title"><span>{m.label}</span><span>{m.time}</span></div>
                        <span className={badgeClass(m.tone)}>{m.scoreLabel}</span>
                      </div>
                      <div className="nm-food-chips">
                        {m.foods.map((f, j) => <span key={j} className="nm-food-chip nm-food-chip-neutral">{f}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'messaggi' && (
        <div style={{ marginTop: 14 }}>
          <div className="nm-logged-foods">
            {messages === null && <div className="nm-empty-state">Caricamento…</div>}
            {messages?.length === 0 && <div className="nm-empty-state">Nessun messaggio ancora.</div>}
            {messages?.map((m) => (
              <div
                key={m.id}
                className="nm-plan-item-card"
                style={{ marginLeft: m.sender === 'nutrizionista' ? '20%' : 0, marginRight: m.sender === 'nutrizionista' ? 0 : '20%', background: m.sender === 'nutrizionista' ? 'var(--good-bg)' : 'var(--card)' }}
              >
                <div>{m.text}</div>
                <div className="nm-page-sub" style={{ marginTop: 4 }}>{new Date(m.createdAt).toLocaleString('it-IT')}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              className="nm-text-input"
              placeholder="Scrivi un messaggio…"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitMessage(); }}
            />
            <button className="nm-modal-btn nm-modal-btn-primary" style={{ flex: 'none', padding: '0 16px' }} onClick={submitMessage}>Invia</button>
          </div>
        </div>
      )}
    </div>
  );
}
