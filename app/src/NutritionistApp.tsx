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

// Su mobile lista e dettaglio si escludono a vicenda (una schermata alla
// volta, come il resto dell'app): la classe is-detail-active decide quale
// mostrare. Da desktop (media query in app.css) sono sempre entrambe
// visibili affiancate — la classe non ha più effetto, solo il CSS decide.
function NutritionistApp({ onLogout }: Props) {
  const n = useNutritionist();
  const [view, setView] = useState<View>('patients');

  const logout = () => { authStorage.clearNutritionistToken(); onLogout(); };

  if (view === 'team') {
    return (
      <div className="nm-page">
        <div className="nm-shell">
          <div className="nm-patient-body">
            <div className="nm-nutri-body">
              <TeamView onBack={() => setView('patients')} onGenerateInvite={n.generateInvite} />
            </div>
            <button className="nm-modal-btn nm-modal-btn-secondary" style={{ margin: '0 20px' }} onClick={logout}>Esci</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nm-page nm-nutri-page">
      <div className={`nm-nutri-shell ${n.activePatientId !== null ? 'is-detail-active' : ''}`}>
        <div className="nm-nutri-sidebar">
          <div className="nm-nutri-body">
            <PatientListView
              patients={n.patients}
              activePatientId={n.activePatientId}
              onSelect={n.selectPatient}
              onCreatePatient={n.createPatient}
              onOpenTeam={() => setView('team')}
            />
          </div>
          <button className="nm-modal-btn nm-modal-btn-secondary nm-nutri-logout" onClick={logout}>Esci</button>
        </div>

        <div className="nm-nutri-main">
          <div className="nm-nutri-body" style={{ flex: 1 }}>
            {n.activePatientId !== null ? (
              <PatientDetailView
                patient={n.activePatient}
                messages={n.messages}
                onBack={n.backToList}
                onSetNextVisit={n.setNextVisit}
                onSendMessage={n.sendMessage}
              />
            ) : (
              <div className="nm-empty-state">Seleziona un paziente dalla lista.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NutritionistApp;
