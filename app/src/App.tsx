import { useDiario } from './hooks/useDiario';
import { BottomNav, SubNav } from './components/BottomNav';
import { Toast } from './components/Toast';
import { OnboardingView } from './components/patient/OnboardingView';
import { DiarioView } from './components/patient/DiarioView';
import { AbitudiniView } from './components/patient/AbitudiniView';
import { PremiView } from './components/patient/PremiView';
import { PianoView } from './components/patient/PianoView';
import { SchedeView } from './components/patient/SchedeView';
import { SchedaBuilder } from './components/patient/SchedaBuilder';
import { ProgressiView } from './components/patient/ProgressiView';
import { api } from './api';
import { patientCatalog } from './lib/workoutMeta';
import { ReportView } from './components/patient/ReportView';
import { MessaggiView } from './components/patient/MessaggiView';
import { LogSheet } from './components/sheet/LogSheet';
import { SummaryOverlay } from './components/sheet/SummaryOverlay';
import { SupplementSheet } from './components/sheet/SupplementSheet';
import { formatDateLabel } from './lib/mealMeta';

interface Props {
  onLogout: () => void;
}

function App({ onLogout }: Props) {
  const d = useDiario();
  const mealsSource = d.backfillDate ? d.backfillMeals : d.appState?.meals ?? null;
  const sheetLabel = d.backfillDate ? `Registra per ${formatDateLabel(d.backfillDate).toLowerCase()}` : 'Registra';

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
              <SubNav tab={d.tab} onChange={d.setTab} />
              {d.tab === 'diario' && (
                <DiarioView
                  state={d.appState}
                  onOpenMeal={d.openSheet}
                  onOpenLogQuick={d.openLogQuick}
                  onToggleFast={d.toggleFast}
                  fastToggling={d.fastToggling}
                  onDeleteMeal={d.deleteMeal}
                  onSkipMeal={d.skipMeal}
                  onOpenSupplements={d.openSupplementSheet}
                  onLogout={onLogout}
                />
              )}
              {d.tab === 'abitudini' && <AbitudiniView />}
              {d.tab === 'premi' && <PremiView state={d.appState} onDayClick={d.openBackfill} />}
              {d.tab === 'piano' && <PianoView patientName={d.appState.greetingName} />}
              {d.tab === 'schede' && <SchedeView />}
              {d.tab === 'crea' && (
                <SchedaBuilder
                  catalog={patientCatalog}
                  onSave={async (draft) => { await api.createWorkoutPlan(draft); d.setTab('schede'); }}
                />
              )}
              {d.tab === 'progressi' && <ProgressiView />}
              {d.tab === 'report' && <ReportView state={d.appState} onSetFreq={d.setFreq} />}
              {d.tab === 'messaggi' && <MessaggiView onMessagesOpened={d.refreshState} />}
            </>
          )}
          {d.appState?.onboarded && <BottomNav tab={d.tab} onChange={d.setTab} unreadMessages={d.appState.unreadMessages} />}
        </div>

        {mealsSource && (
          <LogSheet
            open={d.sheetOpen}
            mealsSource={mealsSource}
            sheetLabel={sheetLabel}
            isBackfill={!!d.backfillDate}
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

        <SummaryOverlay open={d.summaryOpen} summary={d.lastSummary} onClose={d.closeSummary} onSend={d.sendFromSummary} onSetMood={d.setMood} />

        <SupplementSheet open={d.supplementSheetOpen} onClose={d.closeSupplementSheet} />

        <Toast message={d.toast} />
      </div>
    </div>
  );
}

export default App;
