import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { NutritionistTeamMember } from '../../types';
import { BackArrowIcon } from '../../icons';

interface Props {
  onBack: () => void;
  onGenerateInvite: () => Promise<string>;
}

export function TeamView({ onBack, onGenerateInvite }: Props) {
  const [team, setTeam] = useState<NutritionistTeamMember[] | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [reset, setReset] = useState<{ name: string; password: string } | null>(null);

  useEffect(() => {
    api.getNutritionistTeam().then(setTeam).catch(() => setTeam([]));
  }, []);

  const resetPassword = async (member: NutritionistTeamMember) => {
    const { password } = await api.resetNutritionistPassword(member.id);
    setReset({ name: member.name, password });
  };

  return (
    <div>
      <button className="nm-back-btn" onClick={onBack}>
        <BackArrowIcon />Pazienti
      </button>

      <div className="nm-page-title">Nutrizionisti dello studio</div>
      <div className="nm-page-sub">Tutti vedono tutti i pazienti.</div>

      <button className="nm-onboard-add-btn" style={{ marginTop: 14 }} onClick={() => onGenerateInvite().then(setInviteToken)}>
        Invita un collega
      </button>

      {inviteToken && (
        <div className="nm-plan-item-card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600 }}>Invito</div>
          <div className="nm-page-sub" style={{ marginTop: 2 }}>Condividilo fuori banda — non sarà più visibile dopo.</div>
          <div className="nm-text-input" style={{ marginTop: 8, fontWeight: 700, wordBreak: 'break-all' }}>{inviteToken}</div>
          <button className="nm-modal-btn nm-modal-btn-secondary" style={{ marginTop: 8 }} onClick={() => setInviteToken(null)}>Fatto</button>
        </div>
      )}

      {reset && (
        <div className="nm-plan-item-card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600 }}>Password temporanea per {reset.name}</div>
          <div className="nm-page-sub" style={{ marginTop: 2 }}>La vecchia non funziona più. Condividila fuori banda — non sarà più visibile dopo.</div>
          <div className="nm-text-input" style={{ marginTop: 8, fontWeight: 700, letterSpacing: 1, textAlign: 'center' }}>{reset.password}</div>
          <button className="nm-modal-btn nm-modal-btn-secondary" style={{ marginTop: 8 }} onClick={() => setReset(null)}>Fatto</button>
        </div>
      )}

      <div className="nm-patient-list" style={{ marginTop: 14 }}>
        {team === null && <div className="nm-empty-state">Caricamento…</div>}
        {team?.map((m) => (
          <div key={m.id} className="nm-patient-row" style={{ cursor: 'default' }}>
            <div className="nm-avatar" style={{ background: 'var(--neutral-chip)', color: 'var(--ink-soft)' }}>
              {m.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="nm-patient-row-body">
              <div className="nm-patient-row-name">{m.name}</div>
              <div className="nm-patient-row-last">{m.email}</div>
            </div>
            <button className="nm-modal-btn nm-modal-btn-secondary" style={{ flex: 'none' }} onClick={() => resetPassword(m)}>
              Reimposta password
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
