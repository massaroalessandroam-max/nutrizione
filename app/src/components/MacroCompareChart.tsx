import { useState } from 'react';
import { PLAN_CATEGORIES, type ReportMacros, type ReportMacroItem } from '../api';
import { formatDateLabel } from '../lib/mealMeta';
import { ChevronIcon } from '../icons';

const CATEGORIES = [...PLAN_CATEGORIES, 'Altro'];

function itemLabel(it: ReportMacroItem): string {
  const short = it.food.length > 60 ? `${it.food.slice(0, 60)}…` : it.food;
  return it.weight < 0.999 ? `${short} (${Math.round(it.weight * 100)}%)` : short;
}

interface Props {
  macros: ReportMacros;
}

export function MacroCompareChart({ macros }: Props) {
  const [openCat, setOpenCat] = useState<string | null>(null);

  const rows = CATEGORIES
    .map((cat) => ({
      cat,
      current: macros.current.categories[cat]?.pct ?? 0,
      previous: macros.previous.categories[cat]?.pct ?? 0,
    }))
    .filter((r) => r.current > 0 || r.previous > 0);

  const maxPct = Math.max(1, ...rows.flatMap((r) => [r.current, r.previous]));
  const previousLabel = macros.previous.from === macros.previous.to
    ? formatDateLabel(macros.previous.from)
    : `${macros.previous.from} → ${macros.previous.to}`;

  if (rows.length === 0) {
    return <div className="nm-hint">Nessun alimento categorizzato in questo periodo o nel precedente.</div>;
  }

  return (
    <div className="nm-macro-chart">
      <div className="nm-macro-legend">
        <span className="nm-macro-legend-item"><span className="nm-macro-swatch is-current" /> Periodo selezionato</span>
        <span className="nm-macro-legend-item"><span className="nm-macro-swatch is-previous" /> Precedente ({previousLabel})</span>
      </div>
      {rows.map((r) => {
        const isOpen = openCat === r.cat;
        const currentItems = macros.current.categories[r.cat]?.items ?? [];
        const previousItems = macros.previous.categories[r.cat]?.items ?? [];
        return (
          <div key={r.cat} className="nm-macro-row">
            <button className="nm-macro-row-label" onClick={() => setOpenCat(isOpen ? null : r.cat)}>
              {r.cat}
              <ChevronIcon size={13} open={isOpen} color="var(--ink-faint)" />
            </button>
            <div className="nm-macro-bar-track">
              <div className="nm-macro-bar is-current" style={{ width: `${(r.current / maxPct) * 100}%` }} />
              <span className="nm-macro-bar-value">{Math.round(r.current)}%</span>
            </div>
            <div className="nm-macro-bar-track">
              <div className="nm-macro-bar is-previous" style={{ width: `${(r.previous / maxPct) * 100}%` }} />
              <span className="nm-macro-bar-value">{Math.round(r.previous)}%</span>
            </div>
            {isOpen && (
              <div className="nm-macro-detail">
                <div className="nm-macro-detail-group">
                  <div className="nm-macro-detail-title">Periodo selezionato</div>
                  {currentItems.length === 0 && <div className="nm-hint">Nessuna voce.</div>}
                  {currentItems.map((it, i) => (
                    <div key={i} className="nm-macro-detail-item">
                      <span className="nm-macro-detail-date">{it.date}</span>
                      <span>{itemLabel(it)}</span>
                    </div>
                  ))}
                </div>
                <div className="nm-macro-detail-group">
                  <div className="nm-macro-detail-title">Precedente</div>
                  {previousItems.length === 0 && <div className="nm-hint">Nessuna voce.</div>}
                  {previousItems.map((it, i) => (
                    <div key={i} className="nm-macro-detail-item">
                      <span className="nm-macro-detail-date">{it.date}</span>
                      <span>{itemLabel(it)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
