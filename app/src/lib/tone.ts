import type { Tone } from '../types';

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
