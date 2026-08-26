import { useState } from 'react';
import { useNutritionist } from './hooks/useNutritionist';
import { PatientListView } from './components/nutritionist/PatientListView';
import { PatientDetailView } from './components/nutritionist/PatientDetailView';
import { TeamView } from './components/nutritionist/TeamView';
import { DashboardView } from './components/nutritionist/DashboardView';
import { authStorage } from './api';

interface Props {
  onLogout: () => void;
}

type View = 'patients' | 'team' | 'dashboard';

const NAV_ITEMS: Array<{ key: View; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'patients', label: 'Pazienti' },
  { key: 'team', label: 'Team' },
];

// Sidebar persistente da desktop, tab in alto da mobile — "Dashboard" e
// "Team" sono destinazioni alla pari di "Pazienti" dentro lo stesso guscio,
// non più schermate a sé che sostituiscono tutto con un pulsante indietro.
// Dentro "Pazienti" resta il layout a due colonne: su mobile lista e
// dettaglio si escludono a vicenda (is-detail-active decide quale), da
// desktop (media query in app.css) sono sempre affiancate.
function NutritionistApp({ onLogout }: Props) {
  const n = useNutritionist();
  const [view, setView] = useState<View>('patients');

  const logout = () => { authStorage.clearNutritionistToken(); onLogout(); };

  return (
    <div className="nm-page nm-nutri-page">
      <div className="nm-nutri-app-shell">
        <nav className="nm-nutri-navrail">
          <div className="nm-nutri-navrail-brand">Diario Nemis</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nm-nutri-navrail-item ${view === item.key ? 'is-on' : ''}`}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
          <button className="nm-modal-btn nm-modal-btn-secondary nm-nutri-navrail-logout" onClick={logout}>Esci</button>
        </nav>

        <div className="nm-nutri-mobile-tabs nm-mode-tabs">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nm-mode-tab ${view === item.key ? 'is-on' : 'is-off'}`}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button className="nm-modal-btn nm-modal-btn-secondary nm-nutri-mobile-logout" onClick={logout}>Esci</button>

        <div className="nm-nutri-content">
          {view === 'dashboard' && (
            <div className="nm-nutri-body">
              <DashboardView team={n.team} />
            </div>
          )}

          {view === 'team' && (
            <div className="nm-nutri-body">
              <TeamView onGenerateInvite={n.generateInvite} />
            </div>
          )}

          {view === 'patients' && (
            <div className={`nm-nutri-shell ${n.activePatientId !== null ? 'is-detail-active' : ''}`}>
              <div className="nm-nutri-sidebar">
                <div className="nm-nutri-body">
                  <PatientListView
                    patients={n.patients}
                    activePatientId={n.activePatientId}
                    onSelect={n.selectPatient}
                    onCreatePatient={n.createPatient}
                  />
                </div>
              </div>

              <div className="nm-nutri-main">
                <div className="nm-nutri-body" style={{ flex: 1 }}>
                  {n.activePatientId !== null ? (
                    <PatientDetailView
                      patient={n.activePatient}
                      messages={n.messages}
                      team={n.team}
                      onBack={n.backToList}
                      onAddAppointment={n.addAppointment}
                      onDeleteAppointment={n.deleteAppointment}
                      onAddGoal={n.addGoal}
                      onDeleteGoal={n.deleteGoal}
                      onSavePlan={n.savePlan}
                      onSendMessage={n.sendMessage}
                      onSetOwner={n.setOwner}
                    />
                  ) : (
                    <div className="nm-empty-state">Seleziona un paziente dalla lista.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NutritionistApp;
