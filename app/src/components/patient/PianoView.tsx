import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  api, PLAN_CATEGORIES, MAX_PER_WEEK_OPTIONS, planUploadDownloadUrl,
  type PlanItem, type PlanNotes, type PlanUpload, type ChefCombo,
} from '../../api';
import { CameraIcon, PdfIcon, PlusIcon, PencilIcon, TrashIcon, ChevronIcon, MealIcon, RefreshIcon } from '../../icons';
import { generatePlanPdf } from '../../lib/pdf';
import { fileToBase64 } from '../../lib/file';
import { MEAL_LABEL } from '../../lib/mealMeta';
import { MEAL_ORDER, type MealKey } from '../../types';

const MAX_PER_WEEK_LABEL: Record<string, string> = {
  '': '-', '1': '1 volta/sett.', '2': '2 volte/sett.', '3': '3 volte/sett.', sempre: 'Sempre', opzionale: 'Opzionale',
};
const MAX_PER_WEEK_SELECT_OPTIONS = ['', ...MAX_PER_WEEK_OPTIONS];
const OTHER_CATEGORY = 'Altro';
const GROUPS = [...PLAN_CATEGORIES, OTHER_CATEGORY];

// Composizione di partenza (solo per il primo menu casuale, prima che il
// paziente salvi una combo propria): una categoria per slot. Il paziente
// può poi aggiungere/togliere slot liberamente — questa è solo un punto di
// partenza ragionevole, non una regola fissa.
const CHEF_STARTER_CATEGORIES: Record<MealKey, string[]> = {
  colazione: ['Carboidrati', 'Latticini', 'Frutta'],
  pranzo: ['Carboidrati', 'Proteine', 'Verdura', 'Grassi'],
  cena: ['Proteine', 'Verdura', 'Grassi'],
  spuntino: ['Frutta'],
};

const CHEF_DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const;
const CHEF_DAY_LABEL: Record<string, string> = { lun: 'L', mar: 'M', mer: 'M', gio: 'G', ven: 'V', sab: 'S', dom: 'D' };
const JS_DAY_TO_CODE = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
function chefTodayCode(): string {
  return JS_DAY_TO_CODE[new Date().getDay()];
}

interface ChefDraftSlot { category: string; item: PlanItem | null }

// Confronto per nome (non per riferimento): un item caricato da una combo
// salvata è un oggetto nuovo ogni volta, non lo stesso riferimento del
// pool — confrontare per riferimento non lo escluderebbe mai dallo swap.
function pickRandom(pool: PlanItem[], exclude?: PlanItem | null): PlanItem | null {
  const options = exclude ? pool.filter((x) => x.name !== exclude.name) : pool;
  const from = options.length ? options : pool;
  return from.length ? from[Math.floor(Math.random() * from.length)] : null;
}

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const linesToList = (text: string): string[] => text.split('\n').map((s) => s.trim()).filter(Boolean);

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
  // Testo libero del piano (regole, esempi per pasto, divieti): tenuto come
  // stringa grezza per riga finché non si salva, per non perdere la riga
  // vuota che il paziente sta scrivendo a ogni tasto premuto.
  const [generalRulesText, setGeneralRulesText] = useState('');
  const [mealExamplesText, setMealExamplesText] = useState<Record<MealKey, string>>({ colazione: '', pranzo: '', cena: '', spuntino: '' });
  const [divietiText, setDivietiText] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  // "Alimenti" è chiuso finché il paziente non tocca il titolo per
  // esplorare le macro-categorie del piano.
  const [alimentiOpen, setAlimentiOpen] = useState(false);

  const [combos, setCombos] = useState<ChefCombo[] | null>(null);
  const [draft, setDraft] = useState<Partial<Record<MealKey, ChefDraftSlot[]>>>({});
  const [editingComboId, setEditingComboId] = useState<Partial<Record<MealKey, number>>>({});
  const [daysDraft, setDaysDraft] = useState<Partial<Record<MealKey, string[]>>>({});
  const [addPickerOpen, setAddPickerOpen] = useState<Partial<Record<MealKey, boolean>>>({});
  const [savePanelOpen, setSavePanelOpen] = useState<Partial<Record<MealKey, boolean>>>({});
  const chefInitialized = useRef(false);

  useEffect(() => {
    api.getPlan().then(setItems).catch(() => setItems([]));
    api.getPlanUploads().then(setUploads).catch(() => setUploads([]));
    api.getChefCombos().then(setCombos).catch(() => setCombos([]));
    api.getPlanNotes().then(applyNotes).catch(() => setNotesLoaded(true));
  }, []);

  function applyNotes(notes: PlanNotes) {
    setGeneralRulesText(notes.generalRules.join('\n'));
    setMealExamplesText({
      colazione: (notes.mealExamples.colazione ?? []).join('\n'),
      pranzo: (notes.mealExamples.pranzo ?? []).join('\n'),
      cena: (notes.mealExamples.cena ?? []).join('\n'),
      spuntino: (notes.mealExamples.spuntino ?? []).join('\n'),
    });
    setDivietiText(notes.divieti.join('\n'));
    setNotesLoaded(true);
  }

  const poolFor = (category: string) => (items ?? []).filter((it) => it.name.trim() && it.category === category);
  const randomSlotsFor = (meal: MealKey): ChefDraftSlot[] =>
    CHEF_STARTER_CATEGORIES[meal].map((category) => ({ category, item: pickRandom(poolFor(category)) }));

  const applyCombo = (meal: MealKey, combo: ChefCombo) => {
    setDraft((d) => ({
      ...d,
      [meal]: combo.slots.map((s) => ({ category: s.category, item: { name: s.name, quantity: s.quantity, category: s.category, maxPerWeek: '' } })),
    }));
    setEditingComboId((e) => ({ ...e, [meal]: combo.id }));
    setDaysDraft((dd) => ({ ...dd, [meal]: combo.days }));
    setSavePanelOpen((s) => ({ ...s, [meal]: false }));
    setAddPickerOpen((s) => ({ ...s, [meal]: false }));
  };

  const startFresh = (meal: MealKey) => {
    setDraft((d) => ({ ...d, [meal]: randomSlotsFor(meal) }));
    setEditingComboId((e) => { const next = { ...e }; delete next[meal]; return next; });
    setDaysDraft((dd) => { const next = { ...dd }; delete next[meal]; return next; });
    setSavePanelOpen((s) => ({ ...s, [meal]: false }));
    setAddPickerOpen((s) => ({ ...s, [meal]: false }));
  };

  // Al primo caricamento, per ogni pasto: se esiste una combo salvata valida
  // per oggi la mostra, altrimenti genera un menu casuale di partenza.
  useEffect(() => {
    if (chefInitialized.current || !items || combos === null) return;
    chefInitialized.current = true;
    const today = chefTodayCode();
    for (const meal of MEAL_ORDER) {
      const match = combos.find((c) => c.mealKey === meal && c.days.includes(today));
      if (match) applyCombo(meal, match);
      else setDraft((d) => ({ ...d, [meal]: randomSlotsFor(meal) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, combos]);

  const swapSlot = (meal: MealKey, i: number) => {
    setDraft((d) => {
      const slots = d[meal] ?? [];
      const current = slots[i];
      if (!current) return d;
      const next = pickRandom(poolFor(current.category), current.item);
      return { ...d, [meal]: slots.map((s, idx) => (idx === i ? { ...s, item: next } : s)) };
    });
  };

  // Scelta diretta (dropdown con tutte le opzioni della categoria), invece
  // di dover ricliccare il dado finché non esce quella che si vuole.
  const selectSlotItem = (meal: MealKey, i: number, name: string) => {
    setDraft((d) => {
      const slots = d[meal] ?? [];
      const current = slots[i];
      if (!current) return d;
      const chosen = poolFor(current.category).find((p) => p.name === name) ?? null;
      return { ...d, [meal]: slots.map((s, idx) => (idx === i ? { ...s, item: chosen } : s)) };
    });
  };

  const removeSlot = (meal: MealKey, i: number) =>
    setDraft((d) => ({ ...d, [meal]: (d[meal] ?? []).filter((_, idx) => idx !== i) }));

  const addSlot = (meal: MealKey, category: string) => {
    setDraft((d) => ({ ...d, [meal]: [...(d[meal] ?? []), { category, item: pickRandom(poolFor(category)) }] }));
    setAddPickerOpen((s) => ({ ...s, [meal]: false }));
  };

  const availableCategoriesFor = (meal: MealKey) => {
    const used = new Set((draft[meal] ?? []).map((s) => s.category));
    return PLAN_CATEGORIES.filter((c) => !used.has(c) && poolFor(c).length > 0);
  };

  const toggleChefDay = (meal: MealKey, day: string) =>
    setDaysDraft((dd) => {
      const current = dd[meal] ?? [];
      return { ...dd, [meal]: current.includes(day) ? current.filter((d) => d !== day) : [...current, day] };
    });

  const saveCombo = async (meal: MealKey) => {
    const slots = (draft[meal] ?? [])
      .filter((s): s is ChefDraftSlot & { item: PlanItem } => !!s.item)
      .map((s) => ({ category: s.category, name: s.item.name, quantity: s.item.quantity }));
    const days = daysDraft[meal] ?? [];
    if (!slots.length || !days.length) return;
    const result = await api.saveChefCombo({ id: editingComboId[meal], mealKey: meal, days, slots });
    setCombos(result.combos);
    setEditingComboId((e) => ({ ...e, [meal]: result.id }));
    setSavePanelOpen((s) => ({ ...s, [meal]: false }));
  };

  const deleteCombo = async (meal: MealKey, id: number) => {
    const updated = await api.deleteChefCombo(id);
    setCombos(updated);
    if (editingComboId[meal] === id) startFresh(meal);
  };

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
      setItems(extracted.items);
      setExpanded(new Set(extracted.items.map((it) => (PLAN_CATEGORIES as readonly string[]).includes(it.category) ? it.category : OTHER_CATEGORY)));
      applyNotes({ generalRules: extracted.generalRules, mealExamples: extracted.mealExamples, divieti: extracted.divieti });
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
    const [s] = await Promise.all([
      api.savePlan(clean),
      api.savePlanNotes({
        generalRules: linesToList(generalRulesText),
        mealExamples: {
          colazione: linesToList(mealExamplesText.colazione),
          pranzo: linesToList(mealExamplesText.pranzo),
          cena: linesToList(mealExamplesText.cena),
          spuntino: linesToList(mealExamplesText.spuntino),
        },
        divieti: linesToList(divietiText),
      }),
    ]);
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

      {notesLoaded && (
        <>
          <div className="nm-section-label" style={{ marginTop: 20 }}>Regole generali</div>
          <div className="nm-page-sub">Valide per ogni pasto. Una per riga.</div>
          <textarea
            className="nm-text-input"
            style={{ minHeight: 80, resize: 'vertical' }}
            value={generalRulesText}
            onChange={(e) => setGeneralRulesText(e.target.value)}
            placeholder={'Es. Bere almeno 1,5 L d\'acqua al giorno\nNon saltare mai la colazione'}
          />

          <div className="nm-section-label" style={{ marginTop: 20 }}>Tipologie di pasto ed esempi</div>
          {MEAL_ORDER.map((meal) => (
            <div key={meal} style={{ marginTop: 10 }}>
              <div className="nm-hint">{MEAL_LABEL[meal]}</div>
              <textarea
                className="nm-text-input"
                style={{ minHeight: 60, resize: 'vertical', marginTop: 4 }}
                value={mealExamplesText[meal]}
                onChange={(e) => setMealExamplesText((m) => ({ ...m, [meal]: e.target.value }))}
                placeholder="Un esempio di pasto completo per riga"
              />
            </div>
          ))}

          <div className="nm-section-label" style={{ marginTop: 20 }}>Divieti</div>
          <div className="nm-page-sub">Allergie, intolleranze o alimenti vietati (non solo da limitare). Uno per riga.</div>
          <textarea
            className="nm-text-input"
            style={{ minHeight: 80, resize: 'vertical' }}
            value={divietiText}
            onChange={(e) => setDivietiText(e.target.value)}
            placeholder="Es. Arachidi"
          />
        </>
      )}

      {items === null ? (
        <div className="nm-empty-state">Caricamento…</div>
      ) : (
        <>
          {items.length > 0 && (
            <>
              <div className="nm-section-label" style={{ marginTop: 20 }}>Chef</div>
              <div className="nm-page-sub">Un'idea di pasto completo, pescata dal tuo piano. Aggiungi, togli o cambia una voce, poi salvala come combo per i giorni che vuoi.</div>
              {MEAL_ORDER.map((meal) => {
                const mealCombos = (combos ?? []).filter((c) => c.mealKey === meal);
                const slots = draft[meal] ?? [];
                const availableCats = availableCategoriesFor(meal);
                return (
                  <div key={meal} className="nm-chef-card">
                    <div className="nm-chef-card-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MealIcon meal={meal} size={17} color="var(--teal-700)" />
                        <span>{MEAL_LABEL[meal]}</span>
                      </div>
                      <button className="nm-plan-row-icon-btn" onClick={() => startFresh(meal)} aria-label={`Nuova combinazione casuale per ${MEAL_LABEL[meal].toLowerCase()}`}>
                        <RefreshIcon size={15} />
                      </button>
                    </div>

                    {mealCombos.length > 0 && (
                      <div className="nm-chip-row" style={{ padding: '10px 14px 0' }}>
                        {mealCombos.map((c) => (
                          <button
                            key={c.id}
                            className={`nm-chip ${editingComboId[meal] === c.id ? 'is-on' : 'is-off'}`}
                            onClick={() => applyCombo(meal, c)}
                          >
                            {c.days.map((d) => CHEF_DAY_LABEL[d]).join('')}
                          </button>
                        ))}
                      </div>
                    )}

                    {slots.map((slot, i) => {
                      const pool = poolFor(slot.category);
                      return (
                      <div key={i} className="nm-chef-slot">
                        <div className="nm-chef-slot-info">
                          <span className="nm-chef-slot-cat">{slot.category}</span>
                          {pool.length > 0 ? (
                            <select
                              className="nm-text-input"
                              style={{ marginTop: 2, padding: '6px 8px', fontSize: 13.5 }}
                              value={slot.item?.name ?? ''}
                              onChange={(e) => selectSlotItem(meal, i, e.target.value)}
                            >
                              {pool.map((p) => (
                                <option key={p.name} value={p.name}>{p.name}{p.quantity ? ` · ${p.quantity}` : ''}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="nm-chef-slot-empty">Niente nel piano per questa categoria</span>
                          )}
                        </div>
                        {pool.length > 1 && (
                          <button className="nm-plan-row-icon-btn" onClick={() => swapSlot(meal, i)} aria-label={`Alimento casuale per ${slot.category.toLowerCase()}`}>
                            <RefreshIcon size={15} />
                          </button>
                        )}
                        <button className="nm-plan-row-icon-btn" onClick={() => removeSlot(meal, i)} aria-label={`Rimuovi ${slot.category.toLowerCase()}`}>
                          <TrashIcon size={14} />
                        </button>
                      </div>
                      );
                    })}

                    {addPickerOpen[meal] ? (
                      availableCats.length > 0 ? (
                        <div className="nm-chip-row" style={{ padding: '8px 14px' }}>
                          {availableCats.map((cat) => (
                            <button key={cat} className="nm-chip is-off" onClick={() => addSlot(meal, cat)}>{cat}</button>
                          ))}
                        </div>
                      ) : (
                        <div className="nm-hint" style={{ padding: '0 14px 8px' }}>Nessun'altra categoria disponibile nel piano.</div>
                      )
                    ) : (
                      <button className="nm-onboard-add-btn" onClick={() => setAddPickerOpen((s) => ({ ...s, [meal]: true }))}>
                        <PlusIcon size={14} /> Aggiungi macro
                      </button>
                    )}

                    {savePanelOpen[meal] ? (
                      <div style={{ padding: '10px 14px 14px' }}>
                        <div className="nm-hint">Quando vuoi mangiare questa combinazione?</div>
                        <div className="nm-chip-row" style={{ marginTop: 8 }}>
                          {CHEF_DAYS.map((d) => (
                            <button
                              key={d}
                              className={`nm-chip ${(daysDraft[meal] ?? []).includes(d) ? 'is-on' : 'is-off'}`}
                              onClick={() => toggleChefDay(meal, d)}
                            >
                              {CHEF_DAY_LABEL[d]}
                            </button>
                          ))}
                        </div>
                        <button
                          className="nm-submit-btn"
                          disabled={!(daysDraft[meal] ?? []).length || !slots.some((s) => s.item)}
                          onClick={() => saveCombo(meal)}
                        >
                          {editingComboId[meal] ? 'Aggiorna combo' : 'Salva combo'}
                        </button>
                      </div>
                    ) : (
                      <button className="nm-onboard-add-btn" onClick={() => setSavePanelOpen((s) => ({ ...s, [meal]: true }))}>
                        Salva come combo preferita
                      </button>
                    )}

                    {editingComboId[meal] !== undefined && (
                      <button
                        className="nm-onboard-add-btn"
                        style={{ borderStyle: 'solid', color: 'var(--bad-fg-strong)' }}
                        onClick={() => deleteCombo(meal, editingComboId[meal]!)}
                      >
                        <TrashIcon size={14} /> Elimina questa combo
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <div className="nm-plan-section-head" style={{ marginTop: 26 }}>
            <button className="nm-suggestions-toggle" onClick={() => setAlimentiOpen((o) => !o)}>
              Alimenti · {items.length} {alimentiOpen ? '▲' : '▼'}
            </button>
            {items.length > 0 && (
              <button className="nm-plan-pdf-btn" onClick={downloadPdf} aria-label="Scarica piano in PDF">
                <PdfIcon size={15} /> PDF
              </button>
            )}
          </div>
          {!alimentiOpen ? null : items.length === 0 ? (
            <div className="nm-hint">Nessun alimento ancora. Carica un file o aggiungi a mano.</div>
          ) : (
          groups.map((group) => {
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
          })
          )}

          <button className="nm-submit-btn" style={{ marginTop: 20 }} disabled={saving} onClick={save}>
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
