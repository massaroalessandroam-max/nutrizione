import { useState } from 'react';
import type { NutritionistPatientListItem } from '../../types';
import { PlusIcon } from '../../icons';

interface Props {
  patients: NutritionistPatientListItem[] | null;
  onSelect: (id: number) => void;
  onCreatePatient: (name: string) => Promise<{ id: number; name: string; accessCode: string }>;
  onOpenTeam: () => void;
}

export function PatientListView({ patients, onSelect, onCreatePatient, onOpenTeam }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [createdCode, setCreatedCode] = useState<{ name: string; code: string } | null>(null);

  const submitNewPatient = async () => {
    const name = newName.trim();
    if (!name) return;
    const created = await onCreatePatient(name);
    setCreatedCode({ name: created.name, code: created.accessCode });
    setAdding(false);
    setNewName('');
  };

  const avgAdherence = patients?.length
    ? Math.round(patients.reduce((s, p) => s + p.adherencePct, 0) / patients.length)
    : 0;

  return (
    <div>
      <div className="nm-page-title">Pazienti</div>
      <div className="nm-page-sub">Tutti i pazienti dello studio.</div>

      <div className="nm-nutri-stats">
        <div className="nm-nutri-stat is-primary">
          <div className="nm-nutri-stat-value">{patients?.length ?? '—'}</div>
          <div className="nm-nutri-stat-label" style={{ opacity: .9 }}>pazienti</div>
        </div>
        <div className="nm-nutri-stat is-neutral">
          <div className="nm-nutri-stat-value" style={{ color: 'var(--teal-900)' }}>{avgAdherence}%</div>
          <div className="nm-nutri-stat-label" style={{ color: 'var(--ink-soft)' }}>aderenza media</div>
        </div>
      </div>

      {createdCode && (
        <div className="nm-plan-item-card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600 }}>Codice per {createdCode.name}</div>
          <div className="nm-page-sub" style={{ marginTop: 2 }}>Condividilo col paziente — non sarà più visibile dopo.</div>
          <div className="nm-text-input" style={{ marginTop: 8, fontWeight: 700, letterSpacing: 2, textAlign: 'center' }}>{createdCode.code}</div>
          <button className="nm-modal-btn nm-modal-btn-secondary" style={{ marginTop: 8 }} onClick={() => setCreatedCode(null)}>Fatto</button>
        </div>
      )}

      {adding ? (
        <div className="nm-plan-item-card" style={{ marginTop: 14 }}>
          <input className="nm-text-input" placeholder="Nome del paziente" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="nm-modal-btn nm-modal-btn-secondary" onClick={() => { setAdding(false); setNewName(''); }}>Annulla</button>
            <button className="nm-modal-btn nm-modal-btn-primary" disabled={!newName.trim()} onClick={submitNewPatient}>Crea</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="nm-onboard-add-btn" style={{ flex: 1 }} onClick={() => setAdding(true)}>
            <PlusIcon size={14} /> Aggiungi paziente
          </button>
          <button className="nm-onboard-add-btn" style={{ flex: 1 }} onClick={onOpenTeam}>
            Nutrizionisti dello studio
          </button>
        </div>
      )}

      <div className="nm-patient-list" style={{ marginTop: 14 }}>
        {patients === null && <div className="nm-empty-state">Caricamento…</div>}
        {patients?.length === 0 && <div className="nm-empty-state">Nessun paziente ancora — aggiungine uno.</div>}
        {patients?.map((p) => (
          <button key={p.id} className="nm-patient-row" onClick={() => onSelect(p.id)}>
            <div className="nm-avatar" style={{ background: 'var(--neutral-chip)', color: 'var(--ink-soft)' }}>
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="nm-patient-row-body">
              <div className="nm-patient-row-name">{p.name}</div>
              <div className="nm-patient-row-last">{p.onboarded ? `${p.streak} giorni di fila` : 'Non ancora entrato/a'}</div>
            </div>
            <div className="nm-patient-row-meta">
              <span className="nm-badge nm-badge-ok">{p.adherencePct}%</span>
              {p.nextVisitAt && <div className="nm-patient-row-time">Visita {p.nextVisitAt}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
