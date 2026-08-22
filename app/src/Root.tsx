import { useEffect, useState } from 'react';
import { authStorage } from './api';
import { AuthGate } from './components/AuthGate';
import App from './App';
import NutritionistApp from './NutritionistApp';

type Session = 'checking' | 'none' | 'patient' | 'nutritionist';

// Smista tra le tre viste in base a quale token è salvato — l'app paziente
// (App.tsx) resta esattamente quella di sempre, invariata; questo è solo il
// gate che decide se mostrarla o mostrare la dashboard nutrizionista.
function Root() {
  const [session, setSession] = useState<Session>('checking');

  useEffect(() => {
    if (authStorage.getNutritionistToken()) setSession('nutritionist');
    else if (authStorage.getPatientToken()) setSession('patient');
    else setSession('none');
  }, []);

  if (session === 'checking') return null;

  if (session === 'none') {
    return (
      <div className="nm-page">
        <div className="nm-shell">
          <div className="nm-patient-body">
            <AuthGate
              onPatientAuthenticated={() => setSession('patient')}
              onNutritionistAuthenticated={() => setSession('nutritionist')}
            />
          </div>
        </div>
      </div>
    );
  }

  if (session === 'nutritionist') {
    return <NutritionistApp onLogout={() => setSession('none')} />;
  }

  return <App />;
}

export default Root;
