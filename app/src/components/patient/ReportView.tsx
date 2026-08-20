import { useEffect, useState } from 'react';
import type { AppState } from '../../types';
import { api, type Report, type ReportMacros, type ReportRecipient, type ReportHistoryEntry, type ReportHistoryDetail } from '../../api';
import { PdfIcon, WhatsappIcon, SettingsIcon, TrashIcon } from '../../icons';
import { badgeClass } from '../../lib/tone';
import { formatDateLabel } from '../../lib/mealMeta';
import { buildReportWhatsappText, buildWhatsappLink } from '../../lib/whatsapp';
import { buildReportPdf } from '../../lib/pdf';
import { ReportCalendar, toISODate } from '../ReportCalendar';
import { MacroCompareChart } from '../MacroCompareChart';

interface Props {
  state: AppState;
  onSetFreq: (freq: AppState['freq']) => void;
}

const FREQ: Array<{ key: AppState['freq']; label: string }> = [
  { key: 'meal', label: 'Ad ogni pasto — invio automatico dopo ogni registrazione' },
  { key: 'multi', label: 'Più pasti insieme — raggruppa e invia 2-3 volte al giorno' },
  { key: 'day', label: 'Una volta al giorno — riepilogo serale completo' },
  { key: 'manual', label: 'Solo manuale — invii tu quando vuoi' },
];

type Preset = 'oggi' | 'ieri' | 'settimana' | 'mese' | 'anno';
const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'oggi', label: 'Oggi' },
  { key: 'ieri', label: 'Ieri' },
  { key: 'settimana', label: 'Questa settimana' },
  { key: 'mese', label: 'Questo mese' },
  { key: 'anno', label: "Quest'anno" },
];

function presetRange(preset: Preset): { start: string; end: string } {
  const today = new Date();
  if (preset === 'oggi') return { start: toISODate(today), end: toISODate(today) };
  if (preset === 'ieri') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { start: toISODate(d), end: toISODate(d) };
  }
  if (preset === 'settimana') {
    const dow = (today.getDay() + 6) % 7; // 0 = lunedì
    const monday = new Date(today);
    monday.setDate(monday.getDate() - dow);
    return { start: toISODate(monday), end: toISODate(today) };
  }
  if (preset === 'mese') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: toISODate(first), end: toISODate(today) };
  }
  const first = new Date(today.getFullYear(), 0, 1);
  return { start: toISODate(first), end: toISODate(today) };
}

export function ReportView({ state, onSetFreq }: Props) {
  const [preset, setPreset] = useState<Preset | null>('oggi');
  const initial = presetRange('oggi');
  const [rangeStart, setRangeStart] = useState(initial.start);
  const [rangeEnd, setRangeEnd] = useState(initial.end);
  // Data cliccata in attesa della seconda (per selezionare un intervallo sul
  // calendario con due tap): null quando la selezione è già completa.
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [activityDates, setActivityDates] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<Report | null>(null);
  const [macros, setMacros] = useState<ReportMacros | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; blob: Blob } | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recipients, setRecipients] = useState<ReportRecipient[] | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [history, setHistory] = useState<ReportHistoryEntry[] | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<number | null>(null);
  const [historyDetail, setHistoryDetail] = useState<ReportHistoryDetail | null>(null);

  useEffect(() => {
    const monthKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
    api.getReportActivity(monthKey).then((dates) => setActivityDates(new Set(dates))).catch(() => setActivityDates(new Set()));
  }, [calendarMonth]);

  useEffect(() => {
    api.getReport(rangeStart, rangeEnd).then(setReport).catch(() => setReport(null));
    api.getReportMacros(rangeStart, rangeEnd).then(setMacros).catch(() => setMacros(null));
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    if (!settingsOpen) return;
    api.getReportRecipients().then(setRecipients).catch(() => setRecipients([]));
    api.getReportHistory().then(setHistory).catch(() => setHistory([]));
  }, [settingsOpen]);

  // Rilascia l'URL del blob quando cambia o quando si chiude l'anteprima,
  // altrimenti resta in memoria finché non si ricarica la pagina.
  useEffect(() => () => { if (pdfPreview) URL.revokeObjectURL(pdfPreview.url); }, [pdfPreview]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    setPendingStart(null);
    const r = presetRange(p);
    setRangeStart(r.start);
    setRangeEnd(r.end);
  };

  const handleSelectDay = (iso: string) => {
    setPreset(null);
    if (pendingStart === null) {
      setRangeStart(iso);
      setRangeEnd(iso);
      setPendingStart(iso);
    } else if (iso < pendingStart) {
      setRangeStart(iso);
      setRangeEnd(iso);
      setPendingStart(iso);
    } else {
      setRangeStart(pendingStart);
      setRangeEnd(iso);
      setPendingStart(null);
    }
  };

  const openPdfPreview = () => {
    if (!report) return;
    const doc = buildReportPdf({
      patientName: state.greetingName,
      from: report.from,
      to: report.to,
      days: report.days,
      adherencePct: report.adherencePct,
      totalMeals: report.totalMeals,
    });
    const blob = doc.output('blob');
    setPdfPreview({ url: URL.createObjectURL(blob), blob });
  };

  const closePdfPreview = () => setPdfPreview(null);

  const downloadPdf = () => {
    if (!pdfPreview || !report) return;
    const a = document.createElement('a');
    a.href = pdfPreview.url;
    a.download = `report-nemis-${report.from}_${report.to}.pdf`;
    a.click();
  };

  const shareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const sharePdf = async () => {
    if (!pdfPreview || !report) return;
    const file = new File([pdfPreview.blob], `report-nemis-${report.from}_${report.to}.pdf`, { type: 'application/pdf' });
    try {
      await navigator.share({ files: [file], title: 'Report Diario Nemis', text: `Report dal ${report.from} al ${report.to}` });
    } catch {
      // utente ha annullato la condivisione, o non supportata: nessun errore da mostrare
    }
  };

  const addRecipient = async () => {
    if (!newEmail.trim()) return;
    const list = await api.addReportRecipient(newEmail.trim(), newAlias.trim());
    setRecipients(list);
    setNewEmail('');
    setNewAlias('');
  };

  const removeRecipient = async (id: number) => {
    const list = await api.deleteReportRecipient(id);
    setRecipients(list);
  };

  const toggleHistoryEntry = async (id: number) => {
    if (openHistoryId === id) {
      setOpenHistoryId(null);
      setHistoryDetail(null);
      return;
    }
    setOpenHistoryId(id);
    setHistoryDetail(null);
    const detail = await api.getReportHistoryDetail(id);
    setHistoryDetail(detail);
  };

  const waHref = report ? buildWhatsappLink(buildReportWhatsappText(report, state.greetingName)) : '';
  const rangeLabel = rangeStart === rangeEnd ? formatDateLabel(rangeStart) : `${rangeStart} → ${rangeEnd}`;

  return (
    <div className="nm-section">
      <div className="nm-plan-section-head">
        <div>
          <div className="nm-page-title">Report al nutrizionista</div>
          <div className="nm-page-sub">Decidi tu quando e come inviare il diario.</div>
        </div>
        <button className="nm-icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Impostazioni invio">
          <SettingsIcon size={19} color="var(--teal-700)" />
        </button>
      </div>

      <div className="nm-section-label">Periodo</div>
      <div className="nm-chip-row">
        {PRESETS.map((p) => (
          <button key={p.key} className={`nm-chip ${preset === p.key ? 'is-on' : 'is-off'}`} onClick={() => applyPreset(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <ReportCalendar
        month={calendarMonth}
        onMonthChange={setCalendarMonth}
        activityDates={activityDates}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onSelectDay={handleSelectDay}
      />

      <div className="nm-section-label">Macronutrienti · vs periodo precedente</div>
      {macros ? <MacroCompareChart macros={macros} /> : <div className="nm-hint">Caricamento…</div>}

      <div className="nm-report-preview">
        <div className="nm-report-preview-head">
          <div className="nm-report-preview-head-title">Anteprima report · {rangeLabel}</div>
          <span className="nm-report-count">{report?.totalMeals ?? 0} pasti</span>
        </div>
        <div className="nm-report-preview-body">
          {report && report.days.length === 0 && <div className="nm-hint">Nessun pasto registrato in questo periodo.</div>}
          {report?.days.map((day) => (
            <div key={day.date}>
              <div className="nm-report-day-label">{formatDateLabel(day.date)}</div>
              {day.meals.map((m) => (
                <div key={m.key} className="nm-report-meal-row">
                  <div>
                    <span className="nm-report-meal-name">{m.label}</span>{' '}
                    <span className="nm-report-meal-foods">· {m.foods.slice(0, 3).join(', ')}</span>
                  </div>
                  <span className={badgeClass(m.tone)}>{m.scoreLabel}</span>
                </div>
              ))}
            </div>
          ))}
          {report && report.days.length > 0 && (
            <div className="nm-report-adherence">
              <span>Aderenza periodo</span>
              <span>{report.adherencePct}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="nm-report-actions">
        <button className="nm-btn-outline" onClick={openPdfPreview} disabled={!report}>
          <PdfIcon />
          Pdf
        </button>
        <a className="nm-btn-whatsapp" href={waHref} target="_blank" rel="noopener noreferrer">
          <WhatsappIcon />
          WhatsApp
        </a>
      </div>

      {pdfPreview && (
        <div className="nm-modal-overlay">
          <div className="nm-pdf-modal-card">
            <button className="nm-modal-close" onClick={closePdfPreview} aria-label="Chiudi anteprima">×</button>
            <iframe src={pdfPreview.url} className="nm-pdf-iframe" title="Anteprima PDF report" />
            <div className="nm-pdf-modal-actions">
              <button className="nm-modal-btn nm-modal-btn-secondary" onClick={downloadPdf}>Scarica</button>
              {shareSupported && (
                <button className="nm-modal-btn nm-modal-btn-primary" onClick={sharePdf}>Condividi</button>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="nm-modal-overlay">
          <div className="nm-pdf-modal-card nm-settings-card">
            <button className="nm-modal-close" onClick={() => setSettingsOpen(false)} aria-label="Chiudi impostazioni">×</button>
            <div className="nm-settings-scroll">
              <div className="nm-settings-title">Impostazioni invio</div>

              <div className="nm-section-label">Quando inviare</div>
              <select
                className="nm-text-input"
                value={state.freq}
                onChange={(e) => onSetFreq(e.target.value as AppState['freq'])}
              >
                {FREQ.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>

              <div className="nm-section-label" style={{ marginTop: 18 }}>Orario di invio</div>
              <input
                className="nm-text-input"
                type="time"
                value={state.reportSendTime}
                onChange={(e) => api.setReportTime(e.target.value)}
              />
              <div className="nm-hint">L'invio automatico via email parte non appena colleghiamo un servizio email — per ora imposti qui orario e destinatari.</div>

              <div className="nm-section-label" style={{ marginTop: 18 }}>Destinatari email</div>
              {(recipients ?? []).map((r) => (
                <div key={r.id} className="nm-logged-food-row">
                  <div className="nm-text-input" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>{r.alias || r.email}</span>
                    {r.alias && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{r.email}</span>}
                  </div>
                  <button className="nm-plan-row-icon-btn" onClick={() => removeRecipient(r.id)} aria-label={`Rimuovi ${r.email}`}>
                    <TrashIcon size={15} />
                  </button>
                </div>
              ))}
              <div className="nm-plan-item-bottom" style={{ marginTop: 8 }}>
                <input className="nm-text-input" placeholder="Alias, es. Dott.ssa Rossi" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
                <input className="nm-text-input" placeholder="email@esempio.it" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <button className="nm-onboard-add-btn" onClick={addRecipient}>+ Aggiungi destinatario</button>

              <div className="nm-section-label" style={{ marginTop: 18 }}>Storico invii</div>
              {history !== null && history.length === 0 && (
                <div className="nm-hint">Ancora nessun invio — comparirà qui non appena l'invio email sarà attivo.</div>
              )}
              {history?.map((h) => (
                <div key={h.id} className="nm-plan-category">
                  <button className="nm-plan-category-head" onClick={() => toggleHistoryEntry(h.id)}>
                    <span>{h.sentAt} · {h.recipients.join(', ')}</span>
                  </button>
                  {openHistoryId === h.id && (
                    <div className="nm-plan-category-body">
                      {historyDetail ? (
                        <pre className="nm-history-text">{historyDetail.bodyText}</pre>
                      ) : (
                        <div className="nm-hint">Caricamento…</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
