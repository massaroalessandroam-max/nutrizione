import type { AppState } from '../../types';
import { RingSvg } from '../RingSvg';
import { useNow } from '../../hooks/useNow';

interface Props {
  state: AppState;
  onToggleFast: () => void;
}

function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DigiunoView({ state, onToggleFast }: Props) {
  const now = useNow(state.fastActive);
  const elapsedMs = Math.max(0, now - state.fastStart);
  const h = Math.floor(elapsedMs / 3600000);
  const m = Math.floor((elapsedMs % 3600000) / 60000);
  const sec = Math.floor((elapsedMs % 60000) / 1000);
  const fastPct = Math.min(1, elapsedMs / (16 * 3600000));
  const startD = new Date(state.fastStart);
  const endD = new Date(state.fastStart + 16 * 3600000);

  return (
    <div className="nm-section">
      <div className="nm-page-title">Digiuno intermittente</div>
      <div className="nm-page-sub">Protocollo 16:8 · finestra alimentare 8 ore</div>

      <div className="nm-fast-card">
        <RingSvg size={210} radius={92} strokeWidth={15} progress={fastPct} trackColor="rgba(255,255,255,.14)" progressColor="var(--gold)">
          <span className="nm-fast-state">{state.fastActive ? 'DIGIUNO IN CORSO' : 'FINESTRA APERTA'}</span>
          <span className="nm-fast-elapsed">{h}:{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}</span>
          <span className="nm-fast-target">obiettivo 16:00</span>
        </RingSvg>
        <button className={`nm-fast-toggle ${state.fastActive ? 'is-active' : 'is-inactive'}`} onClick={onToggleFast}>
          {state.fastActive ? 'Termina digiuno' : 'Inizia digiuno'}
        </button>
      </div>

      <div className="nm-fast-info-row">
        <div className="nm-fast-info-card">
          <div className="nm-fast-info-label">Inizio digiuno</div>
          <div className="nm-fast-info-value">{fmtClock(startD)}</div>
        </div>
        <div className="nm-fast-info-card">
          <div className="nm-fast-info-label">Prossimo pasto</div>
          <div className="nm-fast-info-value">{fmtClock(endD)}</div>
        </div>
      </div>
    </div>
  );
}
