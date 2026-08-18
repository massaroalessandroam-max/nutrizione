import { useDiario } from './hooks/useDiario';
import { RoleSwitch } from './components/RoleSwitch';
import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';
import { DiarioView } from './components/patient/DiarioView';
import { PremiView } from './components/patient/PremiView';
import { DigiunoView } from './components/patient/DigiunoView';
import { ReportView } from './components/patient/ReportView';
import { LogSheet } from './components/sheet/LogSheet';
import { SummaryOverlay } from './components/sheet/SummaryOverlay';
import { PatientListView } from './components/nutritionist/PatientListView';
import { PatientDetailView } from './components/nutritionist/PatientDetailView';
import { generateDiarioPdf } from './lib/pdf';
import { MEAL_ORDER } from './types';
import type { PatientDetail } from './types';

function App() {
  const d = useDiario();

  const handleExportOwnPdf = () => {
    if (!d.appState) return;
    const s = d.appState;
    generateDiarioPdf({
      patientName: s.greetingName,
      date: s.date,
      adherencePct: s.adherencePct,
      meals: MEAL_ORDER.filter((k) => s.meals[k].done).map((k) => ({
        label: s.meals[k].label, time: s.meals[k].time, foods: s.meals[k].foods, scoreLabel: s.meals[k].scoreLabel,
      })),
    });
    d.showToast('PDF del diario generato');
  };

  const handleDownloadPatientPdf = (patient: PatientDetail) => {
    generateDiarioPdf({
      patientName: patient.name,
      date: new Date().toISOString().slice(0, 10),
      adherencePct: Number.parseInt(patient.adherence, 10) || 0,
      meals: patient.log.map((l) => ({ label: l.label, time: l.time, foods: l.foods.map((f) => f.name), scoreLabel: l.scoreLabel })),
    });
    d.showToast('PDF del diario generato');
  };

  return (
    <div className="nm-page">
      <div className="nm-shell">
        <RoleSwitch role={d.role} onChange={d.changeRole} />

        {d.role === 'paziente' && (
          <div className="nm-patient-body">
            {d.loading || !d.appState ? (
              <div className="nm-section"><div className="nm-empty-state">Caricamento…</div></div>
            ) : (
              <>
                {d.tab === 'diario' && (
                  <DiarioView state={d.appState} onOpenMeal={d.openSheet} onOpenLogQuick={d.openLogQuick} onGoDigiuno={d.goDigiuno} />
                )}
                {d.tab === 'premi' && <PremiView state={d.appState} />}
                {d.tab === 'digiuno' && <DigiunoView state={d.appState} onToggleFast={d.toggleFast} />}
                {d.tab === 'report' && (
                  <ReportView
                    state={d.appState}
                    onSetFreq={d.setFreq}
                    onExportPdf={handleExportOwnPdf}
                    onSendWhatsapp={() => d.showToast('Apertura WhatsApp…')}
                  />
                )}
              </>
            )}
            <BottomNav tab={d.tab} onChange={d.setTab} />
          </div>
        )}

        {d.role === 'nutrizionista' && (
          <div className="nm-nutri-body">
            {!d.activePatientId ? (
              <PatientListView patients={d.patients} onSelect={d.selectPatient} />
            ) : (
              <PatientDetailView patient={d.activePatient} onBack={d.backToList} onDownloadPdf={handleDownloadPatientPdf} />
            )}
          </div>
        )}

        {d.appState && (
          <LogSheet
            open={d.sheetOpen}
            state={d.appState}
            activeMeal={d.activeMeal}
            onSelectMeal={d.setActiveMeal}
            mode={d.mode}
            onSelectMode={d.setMode}
            logText={d.logText}
            onLogTextChange={d.setLogText}
            hasTranscript={d.hasTranscript}
            onTranscript={d.applyTranscript}
            photoAdded={d.photoAdded}
            onAddPhoto={d.addPhoto}
            onClose={d.closeSheet}
            onSubmit={d.submitLog}
          />
        )}

        <SummaryOverlay open={d.summaryOpen} summary={d.lastSummary} onClose={d.closeSummary} onSend={d.sendFromSummary} />

        <Toast message={d.toast} />
      </div>
    </div>
  );
}

export default App;
