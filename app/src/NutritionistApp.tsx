import { useState } from 'react';
import { useNutritionist } from './hooks/useNutritionist';
import { PatientListView } from './components/nutritionist/PatientListView';
import { PatientDetailView } from './components/nutritionist/PatientDetailView';
import { TeamView } from './components/nutritionist/TeamView';
import { authStorage } from './api';

interface Props {
  onLogout: () => void;
}

type View = 'patients' | 'team';

function NutritionistApp({ onLogout }: Props) {
  const n = useNutritionist();
  const [view, setView] = useState<View>('patients');

  return (
    <div className="nm-page">
      <div className="nm-shell">
        <div className="nm-patient-body">
          {view === 'team' ? (
            <TeamView onBack={() => setView('patients')} onGenerateInvite={n.generateInvite} />
          ) : n.activePatientId === null ? (
            <PatientListView
              patients={n.patients}
              onSelect={n.selectPatient}
              onCreatePatient={n.createPatient}
              onOpenTeam={() => setView('team')}
            />
          ) : (
            <PatientDetailView
              patient={n.activePatient}
              messages={n.messages}
              onBack={n.backToList}
              onSetNextVisit={n.setNextVisit}
              onSendMessage={n.sendMessage}
            />
          )}
          <button
            className="nm-modal-btn nm-modal-btn-secondary"
            style={{ marginTop: 20 }}
            onClick={() => { authStorage.clearNutritionistToken(); onLogout(); }}
          >
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}

export default NutritionistApp;
