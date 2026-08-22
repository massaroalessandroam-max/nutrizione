import type { AppState } from '../../types';

interface Props {
  state: AppState;
  onDayClick: (date: string) => void;
}

export function PremiView({ state, onDayClick }: Props) {
  const maxDone = Math.max(1, ...state.week.map((d) => d.doneCount));

  return (
    <div className="nm-section">
      <div className="nm-page-title">Andamento</div>
      <div className="nm-page-sub">Ogni pasto registrato ti avvicina all'obiettivo.</div>

      <div className="nm-stat-row">
        <div className="nm-stat-card">
          <div className="nm-stat-value" style={{ color: 'var(--gold-text)' }}>{state.streak}</div>
          <div className="nm-stat-label">giorni di fila</div>
        </div>
        <div className="nm-stat-card">
          <div className="nm-stat-value" style={{ color: 'var(--teal-900)' }}>{state.points}</div>
          <div className="nm-stat-label">punti totali</div>
        </div>
        <div className="nm-stat-card">
          <div className="nm-stat-value" style={{ color: 'var(--teal-700)' }}>{state.badges.filter((b) => b.earned).length}</div>
          <div className="nm-stat-label">obiettivi</div>
        </div>
      </div>

      <div className="nm-week-card">
        <div className="nm-week-card-title">Ultimi 7 giorni</div>
        <div className="nm-page-sub" style={{ marginTop: -4, marginBottom: 4 }}>Tocca un giorno precedente per registrare un pasto non segnato.</div>
        <div className="nm-week-chart">
          {state.week.map((d) => {
            const color = d.isToday ? 'var(--gold)' : d.doneCount > 0 ? 'var(--teal-700)' : 'var(--neutral-chip)';
            const labelColor = d.isToday ? 'var(--ink)' : 'var(--ink-faint)';
            const heightPct = d.doneCount === 0 ? 6 : Math.round((d.doneCount / maxDone) * 100);
            return (
              <button
                key={d.date}
                className="nm-week-day nm-week-day-btn"
                disabled={d.isToday}
                onClick={() => onDayClick(d.date)}
                aria-label={`Registra un pasto per ${d.dayLabel}`}
              >
                <div className="nm-week-bar-track">
                  <div className="nm-week-bar-fill" style={{ height: `${heightPct}%`, background: color }} />
                </div>
                <span className="nm-week-day-label" style={{ color: labelColor, fontWeight: d.isToday ? 700 : 500 }}>{d.dayLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="nm-section-label">Obiettivi</div>
      <div className="nm-badge-grid">
        {state.badges.map((b) => (
          <div key={b.key} className="nm-badge-card" style={{ background: b.earned ? 'var(--card)' : 'var(--neutral-chip)', opacity: b.earned ? 1 : 0.6 }}>
            <div className="nm-badge-icon" style={{ background: b.earned ? 'var(--gold-tint)' : 'rgba(11,59,74,.06)' }}>{b.icon}</div>
            <div className="nm-badge-name">{b.name}</div>
            <div className="nm-badge-desc">{b.desc}</div>
            {!b.earned && (
              <div className="nm-badge-progress">
                <div className="nm-badge-progress-track">
                  <div className="nm-badge-progress-fill" style={{ width: `${Math.min(100, Math.round((b.current / b.target) * 100))}%` }} />
                </div>
                <div className="nm-badge-progress-label">{Math.min(b.current, b.target)}/{b.target}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
