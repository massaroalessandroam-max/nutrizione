import type { Tab } from '../hooks/useDiario';
import { NavIcon } from '../icons';

type Area = { key: string; label: string; tabs: Array<{ key: Tab; label: string }> };

const AREAS: Area[] = [
  { key: 'home', label: 'Home', tabs: [{ key: 'premi', label: 'Andamento' }, { key: 'report', label: 'Report' }] },
  { key: 'alimentazione', label: 'Alimentazione', tabs: [{ key: 'diario', label: 'Diario' }, { key: 'piano', label: 'Piano' }] },
  { key: 'allenamento', label: 'Allenamento', tabs: [{ key: 'schede', label: 'Schede' }, { key: 'crea', label: 'Crea scheda' }, { key: 'progressi', label: 'Progressi' }] },
  { key: 'abitudini', label: 'Abitudini', tabs: [{ key: 'abitudini', label: 'Abitudini' }] },
  { key: 'messaggi', label: 'Messaggi', tabs: [{ key: 'messaggi', label: 'Messaggi' }] },
];

const areaOf = (tab: Tab) => AREAS.find((a) => a.tabs.some((t) => t.key === tab))!;

interface Props {
  tab: Tab;
  onChange: (t: Tab) => void;
  unreadMessages: boolean;
}

export function BottomNav({ tab, onChange, unreadMessages }: Props) {
  const current = areaOf(tab);
  return (
    <div className="nm-bottom-nav">
      {AREAS.map((a) => {
        const on = current === a;
        const color = on ? 'var(--teal-700)' : 'var(--ink-faint)';
        return (
          <button key={a.key} className="nm-nav-btn" style={{ color }} onClick={() => onChange(a.tabs[0].key)}>
            <span className="nm-nav-icon-wrap">
              <NavIcon name={a.key} color={color} />
              {a.key === 'messaggi' && unreadMessages && <span className="nm-nav-badge" />}
            </span>
            <span style={{ fontWeight: on ? 700 : 500 }}>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Sotto-sezioni dell'area attiva; niente se l'area ne ha una sola. */
export function SubNav({ tab, onChange }: Omit<Props, 'unreadMessages'>) {
  const { tabs } = areaOf(tab);
  if (tabs.length < 2) return null;
  return (
    <div className="nm-section" style={{ paddingBottom: 0 }}>
      <div className="nm-chip-row" style={{ marginBottom: 0 }}>
        {tabs.map((t) => (
          <button key={t.key} className={`nm-chip ${tab === t.key ? 'is-on' : 'is-off'}`} onClick={() => onChange(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
