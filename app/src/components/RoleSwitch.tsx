import type { Role } from '../hooks/useDiario';

export function RoleSwitch({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="nm-roleswitch">
      <button className={`nm-role-btn ${role === 'paziente' ? 'is-active' : ''}`} onClick={() => onChange('paziente')}>
        Paziente
      </button>
      <button className={`nm-role-btn ${role === 'nutrizionista' ? 'is-active' : ''}`} onClick={() => onChange('nutrizionista')}>
        Nutrizionista
      </button>
    </div>
  );
}
