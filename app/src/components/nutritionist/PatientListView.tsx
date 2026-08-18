import type { PatientListItem } from '../../types';
import { toneBg, toneColor, badgeClass } from '../../lib/tone';

interface Props {
  patients: PatientListItem[] | null;
  onSelect: (id: string) => void;
}

export function PatientListView({ patients, onSelect }: Props) {
  return (
    <div>
      <div className="nm-page-title">Pazienti oggi</div>
      <div className="nm-page-sub">Report ricevuti in tempo reale dal diario.</div>

      <div className="nm-nutri-stats">
        <div className="nm-nutri-stat is-primary">
          <div className="nm-nutri-stat-value">18</div>
          <div className="nm-nutri-stat-label" style={{ opacity: .9 }}>report oggi</div>
        </div>
        <div className="nm-nutri-stat is-neutral">
          <div className="nm-nutri-stat-value" style={{ color: 'var(--gold-text)' }}>3</div>
          <div className="nm-nutri-stat-label" style={{ color: 'var(--ink-soft)' }}>da ricontattare</div>
        </div>
        <div className="nm-nutri-stat is-neutral">
          <div className="nm-nutri-stat-value" style={{ color: 'var(--teal-900)' }}>84%</div>
          <div className="nm-nutri-stat-label" style={{ color: 'var(--ink-soft)' }}>aderenza media</div>
        </div>
      </div>

      <div className="nm-patient-list">
        {patients === null && <div className="nm-empty-state">Caricamento…</div>}
        {patients?.map((p) => (
          <button key={p.id} className="nm-patient-row" onClick={() => onSelect(p.id)}>
            <div className="nm-avatar" style={{ background: toneBg(p.tone), color: toneColor(p.tone) }}>{p.initials}</div>
            <div className="nm-patient-row-body">
              <div className="nm-patient-row-name">{p.name}</div>
              <div className="nm-patient-row-last">{p.last}</div>
            </div>
            <div className="nm-patient-row-meta">
              <span className={badgeClass(p.tone)}>{p.adherence}</span>
              <div className="nm-patient-row-time">{p.time}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
