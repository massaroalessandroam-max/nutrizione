import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, type PlanItem } from '../../api';
import { CameraIcon, PdfIcon, PlusIcon } from '../../icons';
import { generatePlanPdf } from '../../lib/pdf';
import { SHOPPING_DAY_OPTIONS, buildShoppingList, type ShoppingDays } from '../../lib/shoppingList';

const DAY_LABEL: Record<ShoppingDays, string> = { 2: '2 giorni', 3: '3 giorni', 7: '1 settimana' };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('lettura file fallita'));
    reader.readAsDataURL(file);
  });
}

interface Props {
  patientName: string;
}

export function PianoView({ patientName }: Props) {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shoppingDays, setShoppingDays] = useState<ShoppingDays>(7);

  useEffect(() => {
    api.getPlan().then(setItems).catch(() => setItems([]));
  }, []);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSaved(false);
    setExtractError('');
    setExtracting(true);
    // Estrazione una tantum: parte solo qui, al caricamento di un file
    // nuovo, non si ripete finché non ne arriva un altro.
    try {
      const fileBase64 = await fileToBase64(file);
      const extracted = await api.extractPlan(fileBase64, file.type || 'application/octet-stream');
      setItems(extracted);
    } catch (err) {
      setExtractError((err as Error).message || 'Estrazione fallita. Inserisci gli alimenti a mano.');
    } finally {
      setExtracting(false);
    }
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

  const downloadPdf = () => {
    if (!items?.length) return;
    generatePlanPdf(items, patientName);
  };

  const shoppingList = useMemo(() => buildShoppingList(items ?? [], shoppingDays), [items, shoppingDays]);

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

      {extractError && <div className="nm-plan-error">{extractError}</div>}

      {items === null ? (
        <div className="nm-empty-state">Caricamento…</div>
      ) : (
        <>
          <div className="nm-plan-section-head">
            <div className="nm-section-label" style={{ marginTop: 20, marginBottom: 0 }}>Alimenti e grammature</div>
            {items.length > 0 && (
              <button className="nm-plan-pdf-btn" onClick={downloadPdf} aria-label="Scarica piano in PDF">
                <PdfIcon size={15} /> PDF
              </button>
            )}
          </div>
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

          {items.length > 0 && (
            <>
              <div className="nm-section-label" style={{ marginTop: 26 }}>Lista della spesa</div>
              <div className="nm-chip-row">
                {SHOPPING_DAY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    className={`nm-chip ${shoppingDays === d ? 'is-on' : 'is-off'}`}
                    onClick={() => setShoppingDays(d)}
                  >
                    {DAY_LABEL[d]}
                  </button>
                ))}
              </div>
              <div className="nm-plan-item-list">
                {shoppingList.map((entry, i) => (
                  <div key={i} className="nm-shopping-row">
                    <span>{entry.name}</span>
                    <span className="nm-shopping-qty">{entry.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="nm-hint">Quantità stimate assumendo il consumo indicato ogni giorno del periodo scelto.</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
