import { useEffect, useState } from 'react';
import type { AppState, MealKey } from '../../types';
import { MEAL_ORDER } from '../../types';
import type { LogMode } from '../../hooks/useDiario';
import { MicIcon, ModeIcon, CameraIcon } from '../../icons';
import { toneBg, toneColor, toneGlyph } from '../../lib/tone';
import { useSpeechRecognition, speechRecognitionSupported } from '../../hooks/useSpeechRecognition';
import { api, type PlanItem } from '../../api';

const MODES: Array<{ key: LogMode; label: string }> = [
  { key: 'text', label: 'Testo' },
  { key: 'audio', label: 'Audio' },
  { key: 'photo', label: 'Foto' },
];

const MOCK_PHOTO_ITEMS = ['Petto di pollo', 'Insalata mista', 'Riso integrale', 'Olio evo'];

function verdictOf(name: string, CONSIGLIATI: string[], SCONSIGLIATI: string[]): 'good' | 'ok' | 'bad' {
  const n = name.toLowerCase();
  if (SCONSIGLIATI.some((w) => n.includes(w))) return 'bad';
  if (CONSIGLIATI.some((w) => n.includes(w))) return 'good';
  return 'ok';
}

interface Props {
  open: boolean;
  state: AppState;
  activeMeal: MealKey;
  onSelectMeal: (k: MealKey) => void;
  mode: LogMode;
  onSelectMode: (m: LogMode) => void;
  logText: string;
  onLogTextChange: (v: string) => void;
  hasTranscript: boolean;
  onTranscript: (text: string) => void;
  photoAdded: boolean;
  onAddPhoto: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function LogSheet({
  open, state, activeMeal, onSelectMeal, mode, onSelectMode,
  logText, onLogTextChange, hasTranscript, onTranscript,
  photoAdded, onAddPhoto, onClose, onSubmit,
}: Props) {
  const { recording, error, start, stop } = useSpeechRecognition();

  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  useEffect(() => {
    if (open) api.getPlan().then(setPlanItems).catch(() => setPlanItems([]));
    else setShowSuggestions(false);
  }, [open]);

  if (!open) return null;

  const toggleRec = () => {
    if (recording) {
      stop();
    } else {
      start((transcript) => onTranscript(transcript || logText));
    }
  };

  const canSubmit = mode === 'photo' ? photoAdded : logText.trim().length > 0;

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
        <div className="nm-sheet-label">Registra</div>

        <div className="nm-chip-row">
          {MEAL_ORDER.map((k) => {
            const on = activeMeal === k;
            return (
              <button key={k} className={`nm-chip ${on ? 'is-on' : 'is-off'}`} onClick={() => onSelectMeal(k)}>
                {state.meals[k].label}
              </button>
            );
          })}
        </div>

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
              <div className="nm-suggestions-chips">
                {planItems.map((it) => (
                  <button
                    key={it.name}
                    className="nm-suggestion-chip"
                    onClick={() => onLogTextChange(logText.trim() ? `${logText}, ${it.name}` : it.name)}
                  >
                    {it.name}{it.quantity ? ` · ${it.quantity}` : ''}
                  </button>
                ))}
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
          photoAdded ? (
            <div className="nm-photo-preview">
              <div className="nm-photo-thumb">Foto del pasto</div>
              <div className="nm-photo-recognized">
                <div className="nm-photo-recognized-label">RICONOSCIUTO NELLA FOTO</div>
                <div className="nm-food-chips">
                  {MOCK_PHOTO_ITEMS.map((n) => {
                    const v = verdictOf(n, CONSIGLIATI, SCONSIGLIATI);
                    return (
                      <span key={n} className="nm-food-chip" style={{ background: toneBg(v), color: toneColor(v) }}>
                        {toneGlyph(v)} {n}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <button className="nm-photo-dropzone" onClick={onAddPhoto}>
              <CameraIcon />
              <div className="nm-photo-dropzone-title">Scatta o carica una foto</div>
              <div className="nm-photo-dropzone-sub">Riconosciamo gli alimenti automaticamente</div>
            </button>
          )
        )}

        <button className="nm-submit-btn" onClick={onSubmit} disabled={!canSubmit}>Analizza pasto</button>
      </div>
    </div>
  );
}

// Kept in sync with the server's matching lists (server/src/match.ts) purely
// for the photo-mode mock preview chips, which never leave the client.
const CONSIGLIATI = [
  'yogurt', 'avena', 'fiocchi', 'mirtilli', 'frutti di bosco', 'pesce', 'salmone',
  'verdura', 'insalata', 'spinaci', 'pollo', 'tacchino', 'uova', 'frutta secca',
  'noci', 'mandorle', 'riso integrale', 'quinoa', 'lenticchie', 'ceci', 'legumi',
  'olio evo', 'acqua', 'the verde', 'frutta', 'mela', 'banana', 'broccoli', 'zucchine',
];
const SCONSIGLIATI = [
  'zucchero', 'dolce', 'dolci', 'fritto', 'fritti', 'patatine', 'bibita', 'cola',
  'pizza', 'pane bianco', 'merendina', 'biscotti', 'alcol', 'birra', 'vino',
  'gelato', 'nutella', 'cornetto', 'brioche', 'salsiccia', 'insaccati',
];
