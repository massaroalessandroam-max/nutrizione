import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, PLAN_CATEGORIES, MAX_PER_WEEK_OPTIONS, type PlanItem } from '../../api';
import { CameraIcon, PdfIcon, PlusIcon } from '../../icons';
import { generatePlanPdf } from '../../lib/pdf';
import { fileToBase64 } from '../../lib/file';

const MAX_PER_WEEK_LABEL: Record<string, string> = {
  '1': '1 volta/sett.', '2': '2 volte/sett.', '3': '3 volte/sett.', sempre: 'Sempre', opzionale: 'Opzionale',
};
const OTHER_CATEGORY = 'Altro';
const GROUPS = [...PLAN_CATEGORIES, OTHER_CATEGORY];

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

  useEffect(() => {
    api.getPlan().then(setItems).catch(() => setItems([]));
  }, []);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset subito, altrimenti il browser non rilancia onChange se il
    // prossimo scatto/selezione ha lo stesso nome file del precedente
    // (comune con le foto della fotocamera) — la foto successiva verrebbe
    // ignorata silenziosamente.
    e.target.value = '';
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

  const updateItem = (i: number, patch: Partial<PlanItem>) =>
    setItems((it) => it?.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) ?? it);
  const removeItem = (i: number) => setItems((it) => it?.filter((_, idx) => idx !== i) ?? it);
  const addItem = (category: string) =>
    setItems((it) => [...(it ?? []), { name: '', quantity: '', category: category === OTHER_CATEGORY ? '' : category, maxPerWeek: 'sempre' }]);

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

  // Raggruppa per macro-categoria (ordine fisso), con "Altro" per le voci
  // senza categoria riconosciuta.
  const groups = useMemo(() => {
    const byCategory = new Map<string, { item: PlanItem; index: number }[]>();
    (items ?? []).forEach((item, index) => {
      const key = (PLAN_CATEGORIES as readonly string[]).includes(item.category) ? item.category : OTHER_CATEGORY;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push({ item, index });
    });
    return GROUPS.map((name) => ({ name, entries: byCategory.get(name) ?? [] }));
  }, [items]);

  return (
    <div className="nm-section">
      <div className="nm-page-title">Piano del nutrizionista</div>
      <div className="nm-page-sub">Carica una foto o un PDF delle indicazioni: estraiamo alimenti, grammature e frequenza.</div>

      <label className="nm-photo-dropzone" style={{ cursor: 'pointer' }}>
        <input type="file" accept="image/*,.pdf" onChange={onFile} style={{ display: 'none' }} />
        <CameraIcon />
        <div className="nm-photo-dropzone-title">{fileName || 'Carica foto o PDF del piano'}</div>
        <div className="nm-photo-dropzone-sub">
          {extracting ? 'Estrazione in corso…' : 'Riconosciamo alimenti, quantità e categoria automaticamente'}
        </div>
      </label>

      {extractError && <div className="nm-plan-error">{extractError}</div>}

      {items === null ? (
        <div className="nm-empty-state">Caricamento…</div>
      ) : (
        <>
          <div className="nm-plan-section-head">
            <div className="nm-section-label" style={{ marginTop: 20, marginBottom: 0 }}>Alimenti</div>
            {items.length > 0 && (
              <button className="nm-plan-pdf-btn" onClick={downloadPdf} aria-label="Scarica piano in PDF">
                <PdfIcon size={15} /> PDF
              </button>
            )}
          </div>
          {items.length === 0 && <div className="nm-hint">Nessun alimento ancora. Carica un file o aggiungi a mano.</div>}

          {groups.map((group) => (
            <div key={group.name}>
              {(group.entries.length > 0 || group.name !== OTHER_CATEGORY) && (
                <div className="nm-plan-group-title">{group.name}</div>
              )}
              {group.entries.map(({ item, index }) => (
                <div key={index} className="nm-plan-item-card">
                  <div className="nm-plan-item-top">
                    <input
                      className="nm-text-input"
                      value={item.name}
                      onChange={(e) => updateItem(index, { name: e.target.value })}
                      placeholder="Alimento"
                    />
                    <button className="nm-onboard-remove-btn" onClick={() => removeItem(index)} aria-label="Rimuovi alimento">×</button>
                  </div>
                  <div className="nm-plan-item-bottom">
                    <input
                      className="nm-text-input"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                      placeholder="Grammatura"
                    />
                    <select
                      className="nm-text-input"
                      value={item.category}
                      onChange={(e) => updateItem(index, { category: e.target.value })}
                    >
                      <option value="">{OTHER_CATEGORY}</option>
                      {PLAN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      className="nm-text-input"
                      value={item.maxPerWeek}
                      onChange={(e) => updateItem(index, { maxPerWeek: e.target.value })}
                    >
                      {MAX_PER_WEEK_OPTIONS.map((o) => <option key={o} value={o}>{MAX_PER_WEEK_LABEL[o]}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {group.name !== OTHER_CATEGORY && (
                <button className="nm-onboard-add-btn" onClick={() => addItem(group.name)}>
                  <PlusIcon size={14} /> Aggiungi a {group.name.toLowerCase()}
                </button>
              )}
            </div>
          ))}

          <button className="nm-submit-btn" disabled={saving} onClick={save}>
            {saving ? 'Salvataggio…' : saved ? 'Salvato ✓' : 'Salva piano'}
          </button>
        </>
      )}
    </div>
  );
}
