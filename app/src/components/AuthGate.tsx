import { useState } from 'react';
import { api, authStorage } from '../api';

type Screen = 'choose' | 'patient' | 'nutri-login' | 'nutri-register';

interface Props {
  onPatientAuthenticated: () => void;
  onNutritionistAuthenticated: () => void;
}

export function AuthGate({ onPatientAuthenticated, onNutritionistAuthenticated }: Props) {
  const [screen, setScreen] = useState<Screen>('choose');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  const patientLogin = async () => {
    setError('');
    setBusy(true);
    try {
      const { token } = await api.patientLogin(code);
      authStorage.setPatientToken(token);
      onPatientAuthenticated();
    } catch (e) {
      setError((e as Error).message || 'Codice non valido');
    } finally {
      setBusy(false);
    }
  };

  const nutriLogin = async () => {
    setError('');
    setBusy(true);
    try {
      const { token } = await api.nutritionistLogin(email, password);
      authStorage.setNutritionistToken(token);
      onNutritionistAuthenticated();
    } catch (e) {
      setError((e as Error).message || 'Accesso non riuscito');
    } finally {
      setBusy(false);
    }
  };

  const nutriRegister = async () => {
    setError('');
    setBusy(true);
    try {
      const { token } = await api.nutritionistRegister(name, email, password, inviteToken || undefined);
      authStorage.setNutritionistToken(token);
      onNutritionistAuthenticated();
    } catch (e) {
      setError((e as Error).message || 'Registrazione non riuscita');
    } finally {
      setBusy(false);
    }
  };

  if (screen === 'choose') {
    return (
      <div className="nm-section">
        <div className="nm-page-title">Diario Nemis</div>
        <div className="nm-page-sub">Accedi con il tuo codice paziente, o come nutrizionista.</div>
        <button className="nm-submit-btn" style={{ marginTop: 20 }} onClick={() => { setError(''); setScreen('patient'); }}>
          Ho un codice paziente
        </button>
        <button className="nm-onboard-add-btn" style={{ marginTop: 12 }} onClick={() => { setError(''); setScreen('nutri-login'); }}>
          Sono un nutrizionista
        </button>
      </div>
    );
  }

  if (screen === 'patient') {
    return (
      <div className="nm-section">
        <div className="nm-page-title">Codice paziente</div>
        <div className="nm-page-sub">Il codice te lo ha dato il tuo nutrizionista.</div>
        <input
          className="nm-text-input"
          style={{ marginTop: 16, textTransform: 'uppercase' }}
          placeholder="Es. TX7K9P"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        {error && <div className="nm-plan-error">{error}</div>}
        <button className="nm-submit-btn" style={{ marginTop: 16 }} disabled={busy || !code.trim()} onClick={patientLogin}>
          {busy ? 'Accesso…' : 'Entra'}
        </button>
        <button className="nm-modal-btn nm-modal-btn-secondary" style={{ marginTop: 10 }} onClick={() => setScreen('choose')}>Indietro</button>
      </div>
    );
  }

  if (screen === 'nutri-login') {
    return (
      <div className="nm-section">
        <div className="nm-page-title">Accesso nutrizionista</div>
        <input className="nm-text-input" style={{ marginTop: 16 }} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <input className="nm-text-input" style={{ marginTop: 8 }} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="nm-plan-error">{error}</div>}
        <button className="nm-submit-btn" style={{ marginTop: 16 }} disabled={busy || !email.trim() || !password} onClick={nutriLogin}>
          {busy ? 'Accesso…' : 'Entra'}
        </button>
        <button className="nm-onboard-add-btn" style={{ marginTop: 10 }} onClick={() => { setError(''); setScreen('nutri-register'); }}>
          Registrati con un invito
        </button>
        <button className="nm-modal-btn nm-modal-btn-secondary" style={{ marginTop: 10 }} onClick={() => setScreen('choose')}>Indietro</button>
      </div>
    );
  }

  return (
    <div className="nm-section">
      <div className="nm-page-title">Registrazione nutrizionista</div>
      <div className="nm-page-sub">Il primo account dello studio non ha bisogno di invito; da quello in poi sì.</div>
      <input className="nm-text-input" style={{ marginTop: 16 }} placeholder="Nome e cognome" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className="nm-text-input" style={{ marginTop: 8 }} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="nm-text-input" style={{ marginTop: 8 }} type="password" placeholder="Password (almeno 8 caratteri)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <input className="nm-text-input" style={{ marginTop: 8 }} placeholder="Codice invito (se ne hai uno)" value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} />
      {error && <div className="nm-plan-error">{error}</div>}
      <button className="nm-submit-btn" style={{ marginTop: 16 }} disabled={busy || !name.trim() || !email.trim() || password.length < 8} onClick={nutriRegister}>
        {busy ? 'Registrazione…' : 'Crea account'}
      </button>
      <button className="nm-modal-btn nm-modal-btn-secondary" style={{ marginTop: 10 }} onClick={() => setScreen('nutri-login')}>Indietro</button>
    </div>
  );
}
