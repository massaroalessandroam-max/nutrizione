import { useEffect, useState } from 'react';
import type { StudioDashboard, StudioDashboardPatient, NutritionistTeamMember } from '../../types';
import { BackArrowIcon } from '../../icons';
import { api } from '../../api';

interface Props {
  team: NutritionistTeamMember[] | null;
  onBack: () => void;
}

interface OwnerStats { ownerId: number | null; ownerName: string; count: number; avgAdherence: number; totalMeals: number; totalMessages: number }

function groupByOwner(patients: StudioDashboardPatient[]): OwnerStats[] {
  const groups = new Map<string, StudioDashboardPatient[]>();
  for (const p of patients) {
    const key = String(p.ownerId ?? 'none');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      ownerId: key === 'none' ? null : Number(key),
      ownerName: list[0].ownerName || 'Non assegnato',
      count: list.length,
      avgAdherence: Math.round(list.reduce((s, p) => s + p.adherencePct, 0) / list.length),
      totalMeals: list.reduce((s, p) => s + p.totalMeals, 0),
      totalMessages: list.reduce((s, p) => s + p.messagesFromPatient, 0),
    }))
    .sort((a, b) => a.avgAdherence - b.avgAdherence);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardView({ team, onBack }: Props) {
  const [from, setFrom] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<StudioDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.getStudioDashboard(from, to));
    } finally {
      setLoading(false);
    }
  };

  // Carica subito col periodo di default (ultimi 7 giorni) — "Vai" serve
  // solo per ricaricare dopo aver cambiato le date.
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patients = data?.patients ?? [];
  const byOwner = groupByOwner(patients);
  const overall = {
    count: patients.length,
    avgAdherence: patients.length ? Math.round(patients.reduce((s, p) => s + p.adherencePct, 0) / patients.length) : 0,
    totalMessages: patients.reduce((s, p) => s + p.messagesFromPatient, 0),
  };

  const filteredOwner = ownerFilter === 'all' ? null : byOwner.find((o) => String(o.ownerId ?? 'none') === ownerFilter) ?? null;
  const filteredPatients = ownerFilter === 'all'
    ? []
    : patients.filter((p) => String(p.ownerId ?? 'none') === ownerFilter).sort((a, b) => a.adherencePct - b.adherencePct);

  return (
    <div>
      <button className="nm-back-btn" onClick={onBack}>
        <BackArrowIcon />Pazienti
      </button>

      <div className="nm-page-title">Dashboard studio</div>
      <div className="nm-page-sub">Aderenza al piano nel periodo, per tutto lo studio o per singolo nutrizionista.</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="nm-text-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="nm-text-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="nm-modal-btn nm-modal-btn-primary" style={{ flex: 'none', padding: '0 16px' }} onClick={load}>
          {loading ? '…' : 'Vai'}
        </button>
      </div>

      {data && (
        <>
          <select className="nm-owner-select" style={{ marginBottom: 14 }} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="all">Tutti i nutrizionisti</option>
            {team?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value="none">Non assegnato</option>
          </select>

          {patients.length === 0 ? (
            <div className="nm-empty-state">Nessun paziente ancora.</div>
          ) : ownerFilter === 'all' ? (
            <>
              <div className="nm-nutri-stats">
                <div className="nm-nutri-stat is-primary">
                  <div className="nm-nutri-stat-value">{overall.count}</div>
                  <div className="nm-nutri-stat-label" style={{ opacity: .9 }}>pazienti</div>
                </div>
                <div className="nm-nutri-stat is-neutral">
                  <div className="nm-nutri-stat-value" style={{ color: 'var(--teal-900)' }}>{overall.avgAdherence}%</div>
                  <div className="nm-nutri-stat-label" style={{ color: 'var(--ink-soft)' }}>aderenza media</div>
                </div>
                <div className="nm-nutri-stat is-neutral">
                  <div className="nm-nutri-stat-value" style={{ color: 'var(--teal-900)' }}>{overall.totalMessages}</div>
                  <div className="nm-nutri-stat-label" style={{ color: 'var(--ink-soft)' }}>messaggi ricevuti</div>
                </div>
              </div>

              <div className="nm-section-label">Per nutrizionista</div>
              {byOwner.map((o) => (
                <button
                  key={o.ownerId ?? 'none'}
                  className="nm-plan-item-card"
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8 }}
                  onClick={() => setOwnerFilter(String(o.ownerId ?? 'none'))}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{o.ownerName}</span>
                    <span>{o.avgAdherence}%</span>
                  </div>
                  <div className="nm-page-sub" style={{ margin: '2px 0 0' }}>
                    {o.count} pazienti · {o.totalMeals} pasti · {o.totalMessages} messaggi nel periodo
                  </div>
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="nm-nutri-stats">
                <div className="nm-nutri-stat is-primary">
                  <div className="nm-nutri-stat-value">{filteredOwner?.count ?? 0}</div>
                  <div className="nm-nutri-stat-label" style={{ opacity: .9 }}>pazienti</div>
                </div>
                <div className="nm-nutri-stat is-neutral">
                  <div className="nm-nutri-stat-value" style={{ color: 'var(--teal-900)' }}>{filteredOwner?.avgAdherence ?? 0}%</div>
                  <div className="nm-nutri-stat-label" style={{ color: 'var(--ink-soft)' }}>aderenza media</div>
                </div>
                <div className="nm-nutri-stat is-neutral">
                  <div className="nm-nutri-stat-value" style={{ color: 'var(--teal-900)' }}>{filteredOwner?.totalMessages ?? 0}</div>
                  <div className="nm-nutri-stat-label" style={{ color: 'var(--ink-soft)' }}>messaggi ricevuti</div>
                </div>
              </div>

              <div className="nm-section-label">Pazienti</div>
              {filteredPatients.length === 0 && <div className="nm-empty-state">Nessun paziente in questo periodo.</div>}
              {filteredPatients.map((p) => (
                <div key={p.id} className="nm-plan-item-card" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{p.name}</span>
                    <span>{p.adherencePct}%</span>
                  </div>
                  <div className="nm-page-sub" style={{ margin: '2px 0 0' }}>
                    {p.totalMeals} pasti · {p.messagesFromPatient} messaggi nel periodo
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
