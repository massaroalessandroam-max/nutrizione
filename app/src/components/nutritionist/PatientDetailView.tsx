import type { PatientDetail } from '../../types';
import { badgeClass, toneBg, toneColor, toneGlyph } from '../../lib/tone';
import { BackArrowIcon, PdfIcon } from '../../icons';

interface Props {
  patient: PatientDetail | null;
  onBack: () => void;
  onDownloadPdf: (patient: PatientDetail) => void;
}

export function PatientDetailView({ patient, onBack, onDownloadPdf }: Props) {
  if (!patient) return <div className="nm-empty-state">Caricamento…</div>;

  return (
    <div>
      <button className="nm-back-btn" onClick={onBack}>
        <BackArrowIcon />Tutti i pazienti
      </button>

      <div className="nm-patient-header">
        <div className="nm-avatar is-lg" style={{ background: toneBg(patient.tone), color: toneColor(patient.tone) }}>{patient.initials}</div>
        <div>
          <div className="nm-patient-header-name">{patient.name}</div>
          <div className="nm-patient-header-plan">{patient.plan}</div>
        </div>
      </div>

      <div className="nm-patient-stats">
        <div className="nm-patient-stat">
          <div className="nm-patient-stat-value" style={{ color: 'var(--teal-700)' }}>{patient.adherence}</div>
          <div className="nm-patient-stat-label">aderenza</div>
        </div>
        <div className="nm-patient-stat">
          <div className="nm-patient-stat-value" style={{ color: 'var(--gold-text)' }}>{patient.streak}</div>
          <div className="nm-patient-stat-label">giorni</div>
        </div>
        <div className="nm-patient-stat">
          <div className="nm-patient-stat-value" style={{ color: 'var(--teal-900)' }}>{patient.mealsToday}</div>
          <div className="nm-patient-stat-label">pasti/oggi</div>
        </div>
      </div>

      <div className="nm-section-label">Diario di oggi</div>
      <div className="nm-log-list">
        {patient.log.length === 0 && <div className="nm-empty-state">Nessun pasto registrato.</div>}
        {patient.log.map((l) => (
          <div key={l.key} className="nm-log-card">
            <div className="nm-log-card-head">
              <div className="nm-log-card-title">
                <span>{l.label}</span>
                <span>{l.time}</span>
              </div>
              <span className={badgeClass(l.tone)}>{l.scoreLabel}</span>
            </div>
            <div className="nm-food-chips">
              {l.foods.map((f) => (
                <span key={f.name} className="nm-food-chip" style={{ background: toneBg(f.verdict), color: toneColor(f.verdict) }}>
                  {toneGlyph(f.verdict)} {f.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="nm-download-btn" onClick={() => onDownloadPdf(patient)}>
        <PdfIcon color="var(--gold)" />
        Scarica PDF del diario
      </button>
    </div>
  );
}
