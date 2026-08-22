import { useState } from 'react';
import type { NutritionistPatientDetail, Message } from '../../types';
import { MEAL_ORDER } from '../../types';
import { badgeClass } from '../../lib/tone';
import { MEAL_LABEL, MOOD_EMOJI, formatDateLabel } from '../../lib/mealMeta';
import { BackArrowIcon } from '../../icons';
import { api, type Report } from '../../api';

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
  onBack: () => void;
  onSetNextVisit: (at: string, note: string) => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PatientDetailView({ patient, messages, onBack, onSetNextVisit, onSendMessage }: Props) {
  const [tab, setTab] = useState<Tab>('diario');
  const [visitAt, setVisitAt] = useState('');
  const [visitNote, setVisitNote] = useState('');
  const [editingVisit, setEditingVisit] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [reportFrom, setReportFrom] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(todayIso());
  const [report, setReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  if (!patient) return <div className="nm-empty-state">Caricamento…</div>;

  const startEditVisit = () => {
    setVisitAt(patient.nextVisitAt);
    setVisitNote(patient.nextVisitNote);
    setEditingVisit(true);
  };

  const saveVisit = async () => {
    await onSetNextVisit(visitAt, visitNote);
    setEditingVisit(false);
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

      {newCode && (
        <div className="nm-plan-item-card">
          <div style={{ fontWeight: 600 }}>Nuovo codice per {patient.name}</div>
          <div className="nm-page-sub" style={{ marginTop: 2 }}>Il vecchio non funziona più. Condividilo — non sarà più visibile dopo.</div>
          <div className="nm-text-input" style={{ marginTop: 8, fontWeight: 700, letterSpacing: 2, textAlign: 'center' }}>{newCode}</div>
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

      <div className="nm-section-label" style={{ marginTop: 16 }}>Prossima visita</div>
      {editingVisit ? (
        <div className="nm-plan-item-card">
          <input className="nm-text-input" type="date" value={visitAt} onChange={(e) => setVisitAt(e.target.value)} />
          <input className="nm-text-input" style={{ marginTop: 8 }} placeholder="Nota (facoltativa)" value={visitNote} onChange={(e) => setVisitNote(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="nm-modal-btn nm-modal-btn-secondary" onClick={() => setEditingVisit(false)}>Annulla</button>
            <button className="nm-modal-btn nm-modal-btn-primary" onClick={saveVisit}>Salva</button>
          </div>
        </div>
      ) : (
        <button className="nm-plan-item-card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={startEditVisit}>
          {patient.nextVisitAt
            ? <>{formatDateLabel(patient.nextVisitAt)}{patient.nextVisitNote && ` — ${patient.nextVisitNote}`}</>
            : 'Non impostata — tocca per aggiungerla'}
        </button>
      )}

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
                {h.frequency === 'weekly' ? `${h.weekCount}/${h.targetPerWeek}` : h.doneToday ? 'Fatta oggi' : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'piano' && (
        <div style={{ marginTop: 14 }}>
          {patient.plan.items.length === 0 && <div className="nm-empty-state">Nessun piano caricato.</div>}
          {patient.plan.items.map((it, i) => (
            <div key={i} className="nm-plan-item-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{it.name}</strong>
                <span className="nm-page-sub">{it.quantity}</span>
              </div>
              <div className="nm-page-sub">{it.category || '—'} · {it.maxPerWeek || '—'}</div>
            </div>
          ))}
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
