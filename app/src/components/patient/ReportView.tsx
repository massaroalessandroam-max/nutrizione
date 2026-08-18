import type { AppState } from '../../types';
import { MEAL_ORDER } from '../../types';
import { badgeClass } from '../../lib/tone';
import { PdfIcon, WhatsappIcon } from '../../icons';
import { buildReportWhatsappText, buildWhatsappLink } from '../../lib/whatsapp';

interface Props {
  state: AppState;
  onSetFreq: (freq: AppState['freq']) => void;
  onExportPdf: () => void;
  onSendWhatsapp: () => void;
}

const FREQ: Array<{ key: AppState['freq']; label: string; desc: string }> = [
  { key: 'meal', label: 'Ad ogni pasto', desc: 'Invio automatico dopo ogni registrazione' },
  { key: 'multi', label: 'Più pasti insieme', desc: 'Raggruppa e invia 2-3 volte al giorno' },
  { key: 'day', label: 'Una volta al giorno', desc: 'Riepilogo serale completo, ore 21:00' },
  { key: 'manual', label: 'Solo manuale', desc: 'Invii tu quando vuoi' },
];

export function ReportView({ state, onSetFreq, onExportPdf, onSendWhatsapp }: Props) {
  const reportMeals = MEAL_ORDER.filter((k) => state.meals[k].done).map((k) => state.meals[k]);
  const waHref = buildWhatsappLink(buildReportWhatsappText(state));

  return (
    <div className="nm-section">
      <div className="nm-page-title">Report al nutrizionista</div>
      <div className="nm-page-sub">Decidi tu quando e come inviare il diario.</div>

      <div className="nm-section-label">Quando inviare</div>
      <div className="nm-freq-list">
        {FREQ.map((f) => {
          const on = state.freq === f.key;
          return (
            <button key={f.key} className={`nm-freq-option ${on ? 'is-on' : 'is-off'}`} onClick={() => onSetFreq(f.key)}>
              <div className="nm-freq-dot" style={{ borderColor: on ? 'var(--teal-700)' : 'var(--line-strong)' }}>
                <div className="nm-freq-dot-fill" style={{ background: on ? 'var(--teal-700)' : 'transparent' }} />
              </div>
              <div className="nm-freq-text">
                <div className="nm-freq-label">{f.label}</div>
                <div className="nm-freq-desc">{f.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="nm-report-preview">
        <div className="nm-report-preview-head">
          <div className="nm-report-preview-head-title">Anteprima report · oggi</div>
          <span className="nm-report-count">{state.doneCount} pasti</span>
        </div>
        <div className="nm-report-preview-body">
          {reportMeals.map((m) => (
            <div key={m.label} className="nm-report-meal-row">
              <div>
                <span className="nm-report-meal-name">{m.label}</span>{' '}
                <span className="nm-report-meal-foods">· {m.foods.slice(0, 3).join(', ')}</span>
              </div>
              <span className={badgeClass(m.tone)}>{m.scoreLabel}</span>
            </div>
          ))}
          <div className="nm-report-adherence">
            <span>Aderenza giornata</span>
            <span>{state.adherencePct}%</span>
          </div>
        </div>
      </div>

      <div className="nm-report-actions">
        <button className="nm-btn-outline" onClick={onExportPdf}>
          <PdfIcon />
          Esporta PDF
        </button>
        <a className="nm-btn-whatsapp" href={waHref} target="_blank" rel="noopener noreferrer" onClick={onSendWhatsapp}>
          <WhatsappIcon />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
