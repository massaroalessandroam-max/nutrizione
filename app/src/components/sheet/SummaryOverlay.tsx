import type { CSSProperties } from 'react';
import type { LogSummary } from '../../types';
import { StarIcon } from '../../icons';
import { toneColor, verdictLabel } from '../../lib/tone';

interface Props {
  open: boolean;
  summary: LogSummary | null;
  onClose: () => void;
  onSend: () => void;
}

const HEAD_GRADIENT: Record<string, string> = {
  good: 'linear-gradient(150deg, var(--teal-700), var(--teal-900))',
  ok: 'linear-gradient(150deg, #B67B12, #8a5c0d)',
  bad: 'linear-gradient(150deg, #C0502A, #8f3a1c)',
  none: 'linear-gradient(150deg, var(--teal-700), var(--teal-900))',
};

const EMOJI: Record<string, string> = { good: '🎉', ok: '👍', bad: '💪', none: '👍' };

const SUB: Record<string, string> = {
  good: 'Ottimo, in linea con il tuo piano Nemis.',
  ok: 'Buono! Puoi migliorare ancora un po’.',
  bad: 'Domani riprendiamo con scelte migliori.',
  none: '',
};

const CONFETTI_COLORS = ['var(--gold)', '#fff', 'var(--border-subtle)'];

export function SummaryOverlay({ open, summary, onClose, onSend }: Props) {
  if (!open || !summary) return null;

  const tone = summary.score.tone;
  const isGood = tone === 'good';

  return (
    <div className="nm-summary-overlay">
      <div className="nm-summary-head" style={{ background: HEAD_GRADIENT[tone] }}>
        <div className="nm-confetti-row">
          {isGood && Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="nm-confetti-piece"
              style={{
                left: `${6 + i * 6.6}%`,
                background: CONFETTI_COLORS[i % 3],
                animation: `nm-conf ${0.9 + (i % 5) * 0.15}s ease-out ${(i % 4) * 0.08}s forwards`,
              }}
            />
          ))}
        </div>
        <div className="nm-summary-emoji-wrap">
          <span className="nm-summary-emoji">{EMOJI[tone]}</span>
        </div>
        <div className="nm-summary-text">
          <div className="nm-summary-title">{summary.score.label}!</div>
          <div className="nm-summary-sub">{SUB[tone]}</div>
          <div className="nm-summary-points">
            <StarIcon />
            <span>+{summary.pointsEarned} punti</span>
          </div>
        </div>
      </div>

      <div className="nm-summary-body">
        <div className="nm-summary-body-title">{summary.label}</div>
        <div className="nm-summary-body-sub">Match con il tuo piano Nemis consigliato</div>
        <ul className="nm-summary-foods">
          {summary.foods.map((f) => (
            <li key={f.name} className="nm-summary-food-item" style={{ '--marker-color': toneColor(f.verdict) } as CSSProperties}>
              <span className="nm-summary-food-name">{f.name}</span>{' '}
              <span className="nm-summary-food-verdict" style={{ color: toneColor(f.verdict) }}>
                {verdictLabel(f)}
              </span>
            </li>
          ))}
        </ul>
        <div className="nm-summary-actions">
          <button className="nm-btn-ghost" onClick={onClose}>Chiudi</button>
          <button className="nm-btn-primary" onClick={onSend}>Invia al nutrizionista</button>
        </div>
      </div>
    </div>
  );
}
