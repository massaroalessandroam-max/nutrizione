import type { Tab } from '../hooks/useDiario';
import { NavIcon } from '../icons';

const NAV_ITEMS: Array<{ key: Tab; label: string }> = [
  { key: 'diario', label: 'Diario' },
  { key: 'abitudini', label: 'Abitudini' },
  { key: 'premi', label: 'Andamento' },
  { key: 'piano', label: 'Piano' },
  { key: 'report', label: 'Report' },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="nm-bottom-nav">
      {NAV_ITEMS.map((n) => {
        const on = tab === n.key;
        const color = on ? 'var(--teal-700)' : 'var(--ink-faint)';
        return (
          <button key={n.key} className="nm-nav-btn" style={{ color }} onClick={() => onChange(n.key)}>
            <NavIcon name={n.key} color={color} />
            <span style={{ fontWeight: on ? 700 : 500 }}>{n.label}</span>
          </button>
        );
      })}
    </div>
  );
}
