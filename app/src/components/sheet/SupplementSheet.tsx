import { useEffect, useState } from 'react';
import { api, type CustomSupplement, type SupplementCatalogItem, type SupplementLogEntry } from '../../api';
import { TrashIcon, PlusIcon } from '../../icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

function nowLocalTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Draft { qty: string; time: string }

export function SupplementSheet({ open, onClose }: Props) {
  const [catalog, setCatalog] = useState<SupplementCatalogItem[]>([]);
  const [custom, setCustom] = useState<CustomSupplement[]>([]);
  const [log, setLog] = useState<SupplementLogEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDosage, setCustomDosage] = useState('');

  useEffect(() => {
    if (!open) {
      setAddingCustom(false);
      setCustomName('');
      setCustomDosage('');
      return;
    }
    api.getSupplementCatalog().then(setCatalog).catch(() => setCatalog([]));
    api.getCustomSupplements().then(setCustom).catch(() => setCustom([]));
    api.getSupplementLog().then(setLog).catch(() => setLog([]));
  }, [open]);

  if (!open) return null;

  const draftFor = (name: string, defaultQty: string): Draft =>
    drafts[name] ?? { qty: defaultQty, time: nowLocalTime() };
  const setDraft = (name: string, patch: Partial<Draft>, defaultQty: string) =>
    setDrafts((d) => ({ ...d, [name]: { ...draftFor(name, defaultQty), ...patch } }));

  const logItem = async (name: string, defaultQty: string) => {
    const d = draftFor(name, defaultQty);
    const updated = await api.logSupplement(name, d.qty.trim(), d.time);
    setLog(updated);
  };

  const removeLogEntry = async (id: number) => {
    const updated = await api.deleteSupplementLog(id);
    setLog(updated);
  };

  const addCustom = async () => {
    if (!customName.trim()) return;
    const updated = await api.saveCustomSupplements([...custom, { name: customName.trim(), dosage: customDosage.trim() }]);
    setCustom(updated);
    setAddingCustom(false);
    setCustomName('');
    setCustomDosage('');
  };

  const removeCustom = async (idx: number) => {
    const updated = await api.saveCustomSupplements(custom.filter((_, i) => i !== idx));
    setCustom(updated);
  };

  return (
    <div className="nm-sheet-overlay">
      <button className="nm-sheet-backdrop" onClick={onClose} aria-label="Chiudi" />
      <div className="nm-sheet">
        <div className="nm-sheet-handle" />
        <div className="nm-sheet-label">Integratori</div>

        {log.length > 0 && (
          <div className="nm-logged-foods">
            <div className="nm-hint">Preso oggi:</div>
            {log.map((e) => (
              <div key={e.id} className="nm-logged-food-row">
                <div className="nm-text-input" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{e.name}{e.quantity ? ` · ${e.quantity}` : ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{e.time}</span>
                </div>
                <button className="nm-plan-row-icon-btn" onClick={() => removeLogEntry(e.id)} aria-label={`Rimuovi ${e.name}`}>
                  <TrashIcon size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="nm-section-label" style={{ marginTop: log.length ? 18 : 0 }}>I nostri prodotti</div>
        {catalog.length === 0 && <div className="nm-hint">Nessun prodotto in catalogo.</div>}
        {catalog.map((it) => {
          const d = draftFor(it.name, it.dosageHint);
          return (
            <div key={it.name} className="nm-plan-item-card">
              <div className="nm-plan-item-top">
                <span style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</span>
              </div>
              <div className="nm-plan-item-bottom">
                <input
                  className="nm-text-input"
                  value={d.qty}
                  onChange={(e) => setDraft(it.name, { qty: e.target.value }, it.dosageHint)}
                  placeholder="Quantità"
                />
                <input
                  className="nm-text-input"
                  type="time"
                  value={d.time}
                  onChange={(e) => setDraft(it.name, { time: e.target.value }, it.dosageHint)}
                />
              </div>
              <button className="nm-onboard-add-btn" onClick={() => logItem(it.name, it.dosageHint)}>
                <PlusIcon size={14} /> Registra
              </button>
            </div>
          );
        })}

        <div className="nm-section-label" style={{ marginTop: 18 }}>I tuoi</div>
        {custom.map((it, idx) => {
          const d = draftFor(it.name, it.dosage);
          return (
            <div key={it.name} className="nm-plan-item-card">
              <div className="nm-plan-item-top">
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{it.name}</span>
                <button className="nm-plan-row-icon-btn" onClick={() => removeCustom(idx)} aria-label={`Elimina ${it.name}`}>
                  <TrashIcon size={14} />
                </button>
              </div>
              <div className="nm-plan-item-bottom">
                <input
                  className="nm-text-input"
                  value={d.qty}
                  onChange={(e) => setDraft(it.name, { qty: e.target.value }, it.dosage)}
                  placeholder="Quantità"
                />
                <input
                  className="nm-text-input"
                  type="time"
                  value={d.time}
                  onChange={(e) => setDraft(it.name, { time: e.target.value }, it.dosage)}
                />
              </div>
              <button className="nm-onboard-add-btn" onClick={() => logItem(it.name, it.dosage)}>
                <PlusIcon size={14} /> Registra
              </button>
            </div>
          );
        })}

        {addingCustom ? (
          <div className="nm-plan-item-card">
            <input className="nm-text-input" placeholder="Nome integratore" value={customName} onChange={(e) => setCustomName(e.target.value)} autoFocus />
            <input className="nm-text-input" style={{ marginTop: 8 }} placeholder="Dosaggio, es. 1 cpr" value={customDosage} onChange={(e) => setCustomDosage(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="nm-modal-btn nm-modal-btn-secondary" onClick={() => setAddingCustom(false)}>Annulla</button>
              <button className="nm-modal-btn nm-modal-btn-primary" onClick={addCustom} disabled={!customName.trim()}>Salva</button>
            </div>
          </div>
        ) : (
          <button className="nm-onboard-add-btn" onClick={() => setAddingCustom(true)}>
            <PlusIcon size={14} /> Aggiungi un tuo integratore
          </button>
        )}

        <button className="nm-submit-btn" onClick={onClose}>Fatto</button>
      </div>
    </div>
  );
}
