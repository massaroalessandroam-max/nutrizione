import { useDiario } from './hooks/useDiario';
import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';
import { OnboardingView } from './components/patient/OnboardingView';
import { DiarioView } from './components/patient/DiarioView';
import { PremiView } from './components/patient/PremiView';
import { DigiunoView } from './components/patient/DigiunoView';
import { PianoView } from './components/patient/PianoView';
import { ReportView } from './components/patient/ReportView';
import { LogSheet } from './components/sheet/LogSheet';
import { SummaryOverlay } from './components/sheet/SummaryOverlay';
import { generateDiarioPdf } from './lib/pdf';
import { MEAL_ORDER } from './types';

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

  return (
    <div className="nm-page">
      <div className="nm-shell">
        <div className="nm-patient-body">
          {d.loading || !d.appState ? (
            <div className="nm-section"><div className="nm-empty-state">Caricamento…</div></div>
          ) : !d.appState.onboarded ? (
            <OnboardingView
              meals={d.appState.meals}
              defaultSchedule={d.appState.schedule}
              defaultFasting={d.appState.fastingPref}
              onSubmit={d.completeOnboarding}
            />
          ) : (
            <>
              {d.tab === 'diario' && (
                <DiarioView
                  state={d.appState}
                  onOpenMeal={d.openSheet}
                  onOpenLogQuick={d.openLogQuick}
                  onGoDigiuno={d.goDigiuno}
                  onDeleteMeal={d.deleteMeal}
                  onSkipMeal={d.skipMeal}
                />
              )}
              {d.tab === 'premi' && <PremiView state={d.appState} />}
              {d.tab === 'digiuno' && <DigiunoView state={d.appState} onToggleFast={d.toggleFast} />}
              {d.tab === 'piano' && <PianoView patientName={d.appState.greetingName} />}
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
          {d.appState?.onboarded && <BottomNav tab={d.tab} onChange={d.setTab} />}
        </div>

        {d.appState && (
          <LogSheet
            open={d.sheetOpen}
            state={d.appState}
            activeMeal={d.activeMeal}
            onSelectMeal={d.setActiveMeal}
            lockMeal={d.mealLocked}
            mode={d.mode}
            onSelectMode={d.setMode}
            logText={d.logText}
            onLogTextChange={d.setLogText}
            hasTranscript={d.hasTranscript}
            onTranscript={d.applyTranscript}
            photoFoods={d.photoFoods}
            photoExtracting={d.photoExtracting}
            photoError={d.photoError}
            onAddPhoto={d.addPhoto}
            onRetakePhoto={d.retakePhoto}
            onUpdateFoods={d.updateMealFoods}
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
