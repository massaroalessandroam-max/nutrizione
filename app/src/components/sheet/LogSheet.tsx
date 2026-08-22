import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { MealKey } from '../../types';
import { MEAL_ORDER } from '../../types';
import type { LogMode } from '../../hooks/useDiario';
import { MicIcon, ModeIcon, CameraIcon, ChevronIcon, TrashIcon } from '../../icons';
import { useSpeechRecognition, speechRecognitionSupported } from '../../hooks/useSpeechRecognition';
import { api, PLAN_CATEGORIES, type PlanItem } from '../../api';
import { MEAL_LABEL } from '../../lib/mealMeta';

const SUGGESTION_OTHER = 'Altro';

const MODES: Array<{ key: LogMode; label: string }> = [
  { key: 'text', label: 'Testo' },
  { key: 'audio', label: 'Audio' },
  { key: 'photo', label: 'Foto' },
];

interface Props {
  open: boolean;
  // Pasti già registrati per il giorno in questione — oggi (state.meals) o
  // un giorno precedente (fetch a parte) se si sta facendo un backfill.
  mealsSource: Record<MealKey, { done: boolean; foods: string[] }>;
  // Es. "Registra per venerdì 21 agosto" quando si registra un giorno
  // precedente, altrimenti "Registra" (oggi, comportamento invariato).
  sheetLabel: string;
  // true quando si sta registrando un giorno precedente (backfill dal
  // grafico "Andamento") invece di oggi — cambia solo una stringa di aiuto.
  isBackfill: boolean;
  activeMeal: MealKey;
  onSelectMeal: (k: MealKey) => void;
  lockMeal: boolean;
  mode: LogMode;
  onSelectMode: (m: LogMode) => void;
  logText: string;
  onLogTextChange: (v: string) => void;
  hasTranscript: boolean;
  onTranscript: (text: string) => void;
  photoFoods: string[] | null;
  photoExtracting: boolean;
  photoError: string;
  onAddPhoto: (file: File) => void;
  onRetakePhoto: () => void;
  onUpdateFoods: (key: MealKey, foods: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function LogSheet({
  open, mealsSource, sheetLabel, isBackfill, activeMeal, onSelectMeal, lockMeal, mode, onSelectMode,
  logText, onLogTextChange, hasTranscript, onTranscript,
  photoFoods, photoExtracting, photoError, onAddPhoto, onRetakePhoto, onUpdateFoods, onClose, onSubmit,
}: Props) {
  const { recording, error, start, stop } = useSpeechRecognition();

  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedSuggestionCats, setExpandedSuggestionCats] = useState<Set<string>>(new Set());
  // Suggerimenti selezionati dal piano: quantità modificabile per voce, e
  // un click li aggiunge al testo una sola volta (riclick li toglie)
  // invece di duplicarli ad ogni tocco.
  const [suggestionQty, setSuggestionQty] = useState<Record<string, string>>({});
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  // Copia locale modificabile degli alimenti già registrati oggi per il
  // pasto attivo: null se il pasto non è ancora fatto. Si risincronizza
  // solo al cambio pasto/apertura, non ad ogni aggiornamento di stato,
  // altrimenti una modifica in corso verrebbe persa.
  const [editedFoods, setEditedFoods] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  useEffect(() => {
    if (open) {
      api.getPlan().then(setPlanItems).catch(() => setPlanItems([]));
      setEditedFoods(mealsSource[activeMeal].done ? [...mealsSource[activeMeal].foods] : null);
    } else {
      setShowSuggestions(false);
      setExpandedSuggestionCats(new Set());
      setSelectedSuggestions(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeMeal]);

  const toggleSuggestionCategory = (cat: string) =>
    setExpandedSuggestionCats((s) => {
      const next = new Set(s);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });

  const updateEditedFood = (i: number, value: string) =>
    setEditedFoods((f) => f?.map((x, idx) => (idx === i ? value : x)) ?? f);
  const removeEditedFood = (i: number) => setEditedFoods((f) => f?.filter((_, idx) => idx !== i) ?? f);
  const foodsAreDirty = editedFoods !== null && JSON.stringify(editedFoods) !== JSON.stringify(mealsSource[activeMeal].foods);
  const saveEditedFoods = () => {
    if (editedFoods) onUpdateFoods(activeMeal, editedFoods.map((f) => f.trim()).filter(Boolean));
  };

  const segmentFor = (name: string, qty: string) => (qty.trim() ? `${name} ${qty.trim()}` : name);

  const toggleSuggestion = (it: PlanItem) => {
    const qty = suggestionQty[it.name] ?? it.quantity;
    const segment = segmentFor(it.name, qty);
    const parts = logText.split(',').map((s) => s.trim()).filter(Boolean);
    if (selectedSuggestions.has(it.name)) {
      onLogTextChange(parts.filter((s) => s !== segment).join(', '));
      setSelectedSuggestions((s) => { const next = new Set(s); next.delete(it.name); return next; });
    } else {
      onLogTextChange([...parts, segment].join(', '));
      setSelectedSuggestions((s) => new Set(s).add(it.name));
    }
  };

  const changeSuggestionQty = (it: PlanItem, newQty: string) => {
    const oldQty = suggestionQty[it.name] ?? it.quantity;
    setSuggestionQty((q) => ({ ...q, [it.name]: newQty }));
    if (selectedSuggestions.has(it.name)) {
      const oldSegment = segmentFor(it.name, oldQty);
      const newSegment = segmentFor(it.name, newQty);
      const parts = logText.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (s === oldSegment ? newSegment : s));
      onLogTextChange(parts.join(', '));
    }
  };

  if (!open) return null;

  const toggleRec = () => {
    if (recording) {
      stop();
    } else {
      start((transcript) => onTranscript(transcript || logText));
    }
  };

  const onPhotoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset subito, altrimenti il browser non rilancia onChange se lo
    // scatto successivo ha lo stesso nome file del precedente.
    e.target.value = '';
    if (file) onAddPhoto(file);
  };

  const canSubmit = mode === 'photo' ? !!photoFoods?.length : logText.trim().length > 0;

  const recLabel = !speechRecognitionSupported
    ? 'Riconoscimento vocale non disponibile su questo browser'
    : error
      ? error
      : recording
        ? 'Sto ascoltando... tocca per fermare'
        : hasTranscript
          ? 'Trascrizione pronta'
          : 'Tocca il microfono per parlare';

  return (
    <div className="nm-sheet-overlay">
      <button className="nm-sheet-backdrop" onClick={onClose} aria-label="Chiudi" />
      <div className="nm-sheet">
        <div className="nm-sheet-handle" />
        <div className="nm-sheet-label">{sheetLabel}</div>

        {lockMeal ? (
          <div className="nm-sheet-meal-label">{MEAL_LABEL[activeMeal]}</div>
        ) : (
          <div className="nm-chip-row">
            {MEAL_ORDER.map((k) => {
              const on = activeMeal === k;
              return (
                <button key={k} className={`nm-chip ${on ? 'is-on' : 'is-off'}`} onClick={() => onSelectMeal(k)}>
                  {MEAL_LABEL[k]}
                </button>
              );
            })}
          </div>
        )}

        {editedFoods !== null && (
          <div className="nm-logged-foods">
            <div className="nm-hint">Già registrato{isBackfill ? '' : ' oggi'} — modifica o rimuovi una voce, o aggiungi altro qui sotto (si somma):</div>
            {editedFoods.map((food, i) => (
              <div key={i} className="nm-logged-food-row">
                <input className="nm-text-input" value={food} onChange={(e) => updateEditedFood(i, e.target.value)} />
                <button className="nm-plan-row-icon-btn" onClick={() => removeEditedFood(i)} aria-label="Rimuovi alimento">
                  <TrashIcon size={15} />
                </button>
              </div>
            ))}
            {foodsAreDirty && (
              <button className="nm-onboard-add-btn" onClick={saveEditedFoods}>Salva modifiche</button>
            )}
          </div>
        )}

        <div className="nm-mode-tabs">
          {MODES.map((md) => {
            const on = mode === md.key;
            const col = on ? 'var(--teal-900)' : 'var(--ink-faint)';
            return (
              <button key={md.key} className={`nm-mode-tab ${on ? 'is-on' : 'is-off'}`} onClick={() => onSelectMode(md.key)}>
                <ModeIcon mode={md.key} color={col} />
                {md.label}
              </button>
            );
          })}
        </div>

        {planItems.length > 0 && (
          <div className="nm-suggestions">
            <button className="nm-suggestions-toggle" onClick={() => setShowSuggestions((s) => !s)}>
              Suggerimenti dal piano {showSuggestions ? '▲' : '▼'}
            </button>
            {showSuggestions && (
              <div className="nm-suggestions-table">
                {[...PLAN_CATEGORIES, SUGGESTION_OTHER].map((cat) => {
                  const catItems = planItems.filter((it) =>
                    cat === SUGGESTION_OTHER ? !(PLAN_CATEGORIES as readonly string[]).includes(it.category) : it.category === cat
                  );
                  if (!catItems.length) return null;
                  const isOpen = expandedSuggestionCats.has(cat);
                  return (
                    <div key={cat} className="nm-suggestions-group">
                      <button className="nm-suggestions-group-head" onClick={() => toggleSuggestionCategory(cat)}>
                        <span>{cat}<span className="nm-plan-category-count"> · {catItems.length}</span></span>
                        <ChevronIcon size={14} open={isOpen} />
                      </button>
                      {isOpen && catItems.map((it) => (
                        <div key={it.name} className={`nm-suggestions-row ${selectedSuggestions.has(it.name) ? 'is-on' : ''}`}>
                          <button className="nm-suggestions-row-name" onClick={() => toggleSuggestion(it)}>
                            {it.name}
                          </button>
                          <input
                            className="nm-suggestions-row-qty"
                            value={suggestionQty[it.name] ?? it.quantity}
                            onChange={(e) => changeSuggestionQty(it, e.target.value)}
                            placeholder="Quantità"
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === 'text' && (
          <>
            <textarea
              className="nm-textarea"
              value={logText}
              onChange={(e) => onLogTextChange(e.target.value)}
              placeholder="Es. Yogurt greco, mirtilli, un cucchiaino di miele..."
            />
            <div className="nm-hint">Separa gli alimenti con una virgola. Faremo il match con il piano consigliato.</div>
          </>
        )}

        {mode === 'audio' && (
          <div className="nm-audio-box">
            <button className={`nm-mic-btn ${recording ? 'is-recording' : 'is-idle'}`} onClick={toggleRec} disabled={!speechRecognitionSupported}>
              <MicIcon />
            </button>
            <div className="nm-wave-row">
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className="nm-wave-bar"
                  style={{
                    background: recording ? 'var(--teal-700)' : 'var(--line-strong)',
                    animation: recording ? `nm-rec ${0.5 + (i % 4) * 0.18}s ease-in-out ${i * 0.05}s infinite` : 'none',
                  }}
                />
              ))}
            </div>
            <div className="nm-rec-label">{recLabel}</div>
            {hasTranscript && logText && <div className="nm-transcript">"{logText}"</div>}
          </div>
        )}

        {mode === 'photo' && (
          photoExtracting ? (
            <div className="nm-photo-dropzone">
              <CameraIcon />
              <div className="nm-photo-dropzone-title">Riconoscimento in corso…</div>
            </div>
          ) : photoFoods ? (
            <div className="nm-photo-preview">
              <div className="nm-photo-thumb">Foto del pasto</div>
              <div className="nm-photo-recognized">
                <div className="nm-photo-recognized-label">
                  {photoFoods.length ? 'RICONOSCIUTO NELLA FOTO' : 'Nessun alimento riconosciuto'}
                </div>
                {photoFoods.length > 0 && (
                  <div className="nm-food-chips">
                    {photoFoods.map((n, i) => (
                      <span key={`${n}-${i}`} className="nm-food-chip nm-food-chip-neutral">{n}</span>
                    ))}
                  </div>
                )}
                <button type="button" className="nm-onboard-add-btn" onClick={onRetakePhoto}>Rifai la foto</button>
              </div>
            </div>
          ) : (
            <>
              <label className="nm-photo-dropzone" style={{ cursor: 'pointer' }}>
                <input type="file" accept="image/*" capture="environment" onChange={onPhotoFile} style={{ display: 'none' }} />
                <CameraIcon />
                <div className="nm-photo-dropzone-title">Scatta o carica una foto</div>
                <div className="nm-photo-dropzone-sub">Riconosciamo gli alimenti automaticamente</div>
              </label>
              {photoError && <div className="nm-plan-error">{photoError}</div>}
            </>
          )
        )}

        <button className="nm-submit-btn" onClick={onSubmit} disabled={!canSubmit}>Analizza pasto</button>
      </div>
    </div>
  );
}
