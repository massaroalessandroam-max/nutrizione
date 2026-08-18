import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, type PlanItem } from '../../api';
import { CameraIcon, PlusIcon } from '../../icons';

// Nessuna API di visione/OCR configurata (stessa situazione del
// riconoscimento foto pasto in LogSheet): l'estrazione è mockata con una
// lista plausibile. Da sostituire con un servizio OCR/vision reale quando
// disponibile — il caricamento del file resta client-side, non c'è ancora
// uno storage lato server per l'immagine/PDF originale.
const MOCK_EXTRACTED: PlanItem[] = [
  { name: 'Petto di pollo', quantity: '150 g' },
  { name: 'Riso integrale', quantity: '70 g' },
  { name: 'Verdura mista', quantity: '200 g' },
  { name: 'Olio evo', quantity: '1 cucchiaio' },
];

export function PianoView() {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getPlan().then(setItems).catch(() => setItems([]));
  }, []);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSaved(false);
    setExtracting(true);
    setTimeout(() => {
      setItems(MOCK_EXTRACTED);
      setExtracting(false);
    }, 900);
  };

  const setName = (i: number, name: string) =>
    setItems((it) => it?.map((x, idx) => (idx === i ? { ...x, name } : x)) ?? it);
  const setQty = (i: number, quantity: string) =>
    setItems((it) => it?.map((x, idx) => (idx === i ? { ...x, quantity } : x)) ?? it);
  const removeItem = (i: number) => setItems((it) => it?.filter((_, idx) => idx !== i) ?? it);
  const addItem = () => setItems((it) => [...(it ?? []), { name: '', quantity: '' }]);

  const save = async () => {
    if (!items) return;
    setSaving(true);
    const clean = items.filter((it) => it.name.trim());
    const s = await api.savePlan(clean);
    setItems(s);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="nm-section">
      <div className="nm-page-title">Piano del nutrizionista</div>
      <div className="nm-page-sub">Carica una foto o un PDF delle indicazioni: estraiamo alimenti e grammature.</div>

      <label className="nm-photo-dropzone" style={{ cursor: 'pointer' }}>
        <input type="file" accept="image/*,.pdf" onChange={onFile} style={{ display: 'none' }} />
        <CameraIcon />
        <div className="nm-photo-dropzone-title">{fileName || 'Carica foto o PDF del piano'}</div>
        <div className="nm-photo-dropzone-sub">
          {extracting ? 'Estrazione in corso…' : 'Riconosciamo alimenti e quantità automaticamente'}
        </div>
      </label>

      {items === null ? (
        <div className="nm-empty-state">Caricamento…</div>
      ) : (
        <>
          <div className="nm-section-label" style={{ marginTop: 20 }}>Alimenti e grammature</div>
          {items.length === 0 && <div className="nm-hint">Nessun alimento ancora. Carica un file o aggiungi a mano.</div>}

          {items.map((it, i) => (
            <div key={i} className="nm-plan-item-row">
              <input
                className="nm-text-input"
                value={it.name}
                onChange={(e) => setName(i, e.target.value)}
                placeholder="Alimento"
              />
              <input
                className="nm-text-input nm-plan-qty-input"
                value={it.quantity}
                onChange={(e) => setQty(i, e.target.value)}
                placeholder="Quantità"
              />
              <button className="nm-onboard-remove-btn" onClick={() => removeItem(i)} aria-label="Rimuovi alimento">×</button>
            </div>
          ))}

          <button className="nm-onboard-add-btn" onClick={addItem}>
            <PlusIcon size={14} /> Aggiungi alimento
          </button>

          <button className="nm-submit-btn" disabled={saving} onClick={save}>
            {saving ? 'Salvataggio…' : saved ? 'Salvato ✓' : 'Salva piano'}
          </button>
        </>
      )}
    </div>
  );
}
