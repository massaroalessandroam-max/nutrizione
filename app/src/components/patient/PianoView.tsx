import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { api, PLAN_CATEGORIES, MAX_PER_WEEK_OPTIONS, planUploadDownloadUrl, type PlanItem, type PlanUpload } from '../../api';
import { CameraIcon, PdfIcon, PlusIcon, PencilIcon, TrashIcon, ChevronIcon } from '../../icons';
import { generatePlanPdf } from '../../lib/pdf';
import { fileToBase64 } from '../../lib/file';

const MAX_PER_WEEK_LABEL: Record<string, string> = {
  '': '-', '1': '1 volta/sett.', '2': '2 volte/sett.', '3': '3 volte/sett.', sempre: 'Sempre', opzionale: 'Opzionale',
};
const MAX_PER_WEEK_SELECT_OPTIONS = ['', ...MAX_PER_WEEK_OPTIONS];
const OTHER_CATEGORY = 'Altro';
const GROUPS = [...PLAN_CATEGORIES, OTHER_CATEGORY];

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const abortRef = useRef<AbortController | null>(null);

  // Categorie espanse: al primo caricamento del piano già salvato restano
  // compatte; dopo un'estrazione nuova si aprono da sole per la revisione,
  // e si richiudono tutte al salvataggio.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [uploads, setUploads] = useState<PlanUpload[] | null>(null);

  useEffect(() => {
    api.getPlan().then(setItems).catch(() => setItems([]));
    api.getPlanUploads().then(setUploads).catch(() => setUploads([]));
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
    // nuovo, non si ripete finché non ne arriva un altro. Sostituisce i
    // dati estratti finora (un piano nuovo rimpiazza quello vecchio), ma il
    // file resta archiviato nel log caricamenti qui sotto.
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const fileBase64 = await fileToBase64(file);
      const mediaType = file.type || 'application/octet-stream';
      const extracted = await api.extractPlan(fileBase64, mediaType, file.name, controller.signal);
      setItems(extracted);
      setExpanded(new Set(extracted.map((it) => (PLAN_CATEGORIES as readonly string[]).includes(it.category) ? it.category : OTHER_CATEGORY)));
      api.getPlanUploads().then(setUploads).catch(() => {});
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setExtractError((err as Error).message || 'Estrazione fallita. Inserisci gli alimenti a mano.');
      }
    } finally {
      setExtracting(false);
      abortRef.current = null;
    }
  };

  const cancelExtraction = () => abortRef.current?.abort();

  const updateItem = (i: number, patch: Partial<PlanItem>) =>
    setItems((it) => it?.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) ?? it);
  const removeItem = (i: number) => setItems((it) => it?.filter((_, idx) => idx !== i) ?? it);
  const addItem = (category: string) => {
    setItems((it) => [...(it ?? []), { name: '', quantity: '', category: category === OTHER_CATEGORY ? '' : category, maxPerWeek: '' }]);
    setExpanded((s) => new Set(s).add(category));
    setEditingIndex((items ?? []).length);
  };

  const requestDelete = (i: number) => setDeleteIndex(i);
  const confirmDelete = () => {
    if (deleteIndex !== null) removeItem(deleteIndex);
    setDeleteIndex(null);
    setEditingIndex(null);
  };

  const toggleCategory = (name: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const save = async () => {
    if (!items) return;
    setSaving(true);
    const clean = items.filter((it) => it.name.trim());
    const s = await api.savePlan(clean);
    setItems(s);
    setSaving(false);
    setSaved(true);
    setExpanded(new Set());
    setEditingIndex(null);
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
      <div className="nm-page-sub">Carica una foto o un PDF delle indicazioni: estraiamo alimenti, quantità e frequenza.</div>

      <label className="nm-photo-dropzone" style={{ cursor: 'pointer' }}>
        <input type="file" accept="image/*,.pdf" onChange={onFile} style={{ display: 'none' }} />
        <CameraIcon />
        <div className="nm-photo-dropzone-title">{fileName || 'Carica foto o PDF del piano'}</div>
        <div className="nm-photo-dropzone-sub">Riconosciamo alimenti, quantità e categoria automaticamente</div>
      </label>

      {extractError && <div className="nm-plan-error">{extractError}</div>}

      {extracting && (
        <div className="nm-modal-overlay">
          <div className="nm-modal-card">
            <button className="nm-modal-close" onClick={cancelExtraction} aria-label="Interrompi estrazione">×</button>
            <div className="nm-spinner" />
            <div className="nm-modal-text">Attendere, estrazione dati in corso…</div>
          </div>
        </div>
      )}

      {deleteIndex !== null && items && items[deleteIndex] && (
        <div className="nm-modal-overlay">
          <div className="nm-modal-card">
            <button className="nm-modal-close" onClick={() => setDeleteIndex(null)} aria-label="Annulla">×</button>
            <div className="nm-modal-text">Eliminare "{items[deleteIndex].name}" dal piano?</div>
            <div className="nm-modal-actions">
              <button className="nm-modal-btn nm-modal-btn-secondary" onClick={() => setDeleteIndex(null)}>Annulla</button>
              <button className="nm-modal-btn nm-modal-btn-danger" onClick={confirmDelete}>Elimina</button>
            </div>
          </div>
        </div>
      )}

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

          {groups.map((group) => {
            const isOpen = expanded.has(group.name);
            return (
              <div key={group.name} className="nm-plan-category">
                {(group.entries.length > 0 || group.name !== OTHER_CATEGORY) && (
                  <button className="nm-plan-category-head" onClick={() => toggleCategory(group.name)}>
                    <span>{group.name}<span className="nm-plan-category-count"> · {group.entries.length}</span></span>
                    <ChevronIcon size={16} open={isOpen} />
                  </button>
                )}
                {isOpen && (
                  <div className="nm-plan-category-body">
                    {group.entries.map(({ item, index }) =>
                      editingIndex === index ? (
                        <div key={index} className="nm-plan-item-card">
                          <div className="nm-plan-item-top">
                            <input
                              className="nm-text-input"
                              value={item.name}
                              onChange={(e) => updateItem(index, { name: e.target.value })}
                              placeholder="Alimento"
                              autoFocus
                            />
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
                              {MAX_PER_WEEK_SELECT_OPTIONS.map((o) => <option key={o} value={o}>{MAX_PER_WEEK_LABEL[o]}</option>)}
                            </select>
                          </div>
                          <button className="nm-submit-btn" style={{ marginTop: 10 }} onClick={() => setEditingIndex(null)}>Fatto</button>
                        </div>
                      ) : (
                        <div key={index} className="nm-plan-row">
                          <button className="nm-plan-row-icon-btn" onClick={() => setEditingIndex(index)} aria-label={`Modifica ${item.name}`}>
                            <PencilIcon size={14} />
                          </button>
                          <div className="nm-plan-row-main">
                            <span className="nm-plan-row-name">{item.name || '—'}</span>
                            <span className="nm-plan-row-qty">{item.quantity || '-'}</span>
                            <span className="nm-plan-row-freq">{MAX_PER_WEEK_LABEL[item.maxPerWeek] ?? '-'}</span>
                          </div>
                          <button className="nm-plan-row-icon-btn" onClick={() => requestDelete(index)} aria-label={`Elimina ${item.name}`}>
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      )
                    )}
                    {group.name !== OTHER_CATEGORY && (
                      <button className="nm-onboard-add-btn" onClick={() => addItem(group.name)}>
                        <PlusIcon size={14} /> Aggiungi a {group.name.toLowerCase()}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button className="nm-submit-btn" disabled={saving} onClick={save}>
            {saving ? 'Salvataggio…' : saved ? 'Salvato ✓' : 'Salva piano'}
          </button>

          {uploads !== null && uploads.length > 0 && (
            <>
              <div className="nm-section-label" style={{ marginTop: 26 }}>Log caricamenti</div>
              {uploads.map((u) => (
                <a
                  key={u.id}
                  className="nm-upload-row"
                  href={planUploadDownloadUrl(u.id)}
                  download={u.filename}
                >
                  <span className="nm-upload-name">{u.filename}</span>
                  <span className="nm-upload-date">{formatUploadDate(u.uploadedAt)}</span>
                </a>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
