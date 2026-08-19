import type { FoodVerdict, Tone } from '../types';

export function badgeClass(tone: Tone): string {
  return `nm-badge nm-badge-${tone}`;
}

export function toneColor(tone: Tone): string {
  return tone === 'good' ? 'var(--teal-700)' : tone === 'ok' ? 'var(--ok-fg)' : 'var(--bad-fg-strong)';
}

export function toneBg(tone: Tone): string {
  return tone === 'good' ? 'var(--good-bg)' : tone === 'ok' ? 'var(--ok-bg)' : 'var(--bad-bg)';
}

export function toneGlyph(tone: Tone): string {
  return tone === 'good' ? '✓' : tone === 'ok' ? '~' : '✕';
}

export function verdictLabel(f: FoodVerdict): string {
  switch (f.reason) {
    case 'plan': return 'Consigliato dal piano';
    case 'plan-over-limit': return 'Troppe volte questa settimana';
    case 'season-in': return 'Frutta/verdura di stagione';
    case 'season-out': return 'Fuori stagione';
    case 'list': return f.verdict === 'good' ? 'Scelta consigliata' : 'Da limitare';
    default: return f.verdict === 'good' ? 'Scelta consigliata' : f.verdict === 'bad' ? 'Da limitare' : 'Consentito con moderazione';
  }
}
