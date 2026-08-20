import type { ReactElement } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function FlameIcon({ size = 15, color = 'var(--gold-deep)' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2c1.3 3-1.8 4.3-1.8 7.2a3.8 3.8 0 007.6 0c0-1.7-.8-2.7-.8-2.7 2 1 3.3 3.2 3.3 6.2A8.3 8.3 0 113.9 9.8c1.8-3.3 6.4-4.6 8.1-7.8z" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 15, color = 'var(--teal-700)' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 12l1.8 1.8L15 9.5" />
    </svg>
  );
}

export function PlusIcon({ size = 16, color = 'currentColor', strokeWidth = 2.4 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ClockIcon({ size = 22, color = 'var(--gold)' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5M9 2h6" />
    </svg>
  );
}

const NAV_PATHS: Record<string, string> = {
  diario: 'M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2zM8 3v18',
  premi: 'M12 2l3 6.3 6.9.9-5 4.8 1.2 6.9L12 17.6 5.9 20.9 7 14 2 9.2l6.9-.9z',
  digiuno: 'M12 5v7l4 2',
  piano: 'M14 2v5h5M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7zM9 13h6M9 17h4',
  report: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
};

export function NavIcon({ name, color }: { name: string; color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      {name === 'digiuno' && <circle cx="12" cy="12" r="9" />}
      <path d={NAV_PATHS[name]} />
    </svg>
  );
}

export function PdfIcon({ size = 17, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M14 2v5h5M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7z" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

export function WhatsappIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4 0 .5-.1l.7-.8c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.5.3.1.2.1.9-.2 1.5z" />
    </svg>
  );
}

export function MicIcon({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z" />
      <path d="M19 11a7 7 0 01-14 0" fill="none" stroke="#fff" strokeWidth={2} />
      <path d="M12 18v3" stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

const MODE_PATHS: Record<string, ReactElement> = {
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
  audio: (
    <>
      <path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z" />
      <path d="M19 11a7 7 0 01-14 0M12 18v3" />
    </>
  ),
  photo: (
    <>
      <path d="M3 9a2 2 0 012-2h1.5l1-2h5l1 2H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
};

export function ModeIcon({ mode, color }: { mode: string; color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      {MODE_PATHS[mode]}
    </svg>
  );
}

export function CameraIcon({ size = 34, color = 'var(--teal-700)' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <path d="M3 9a2 2 0 012-2h1.5l1-2h5l1 2H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function StarIcon({ size = 17, color = 'var(--gold)' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l3 6.3 6.9.9-5 4.8 1.2 6.9L12 17.6 5.9 20.9 7 14 2 9.2l6.9-.9z" />
    </svg>
  );
}

export function VerdictIcon({ tone, color, size = 17 }: { tone: 'good' | 'ok' | 'bad'; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6}>
      {tone === 'good' && <path d="M20 6L9 17l-5-5" />}
      {tone === 'ok' && <path d="M5 12h14" />}
      {tone === 'bad' && <path d="M18 6L6 18M6 6l12 12" />}
    </svg>
  );
}

export function TrashIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
    </svg>
  );
}

export function PencilIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

export function ChevronIcon({ size = 16, color = 'currentColor', open = false }: IconProps & { open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function SettingsIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function MinusCircleIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function UndoIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M3 10h9a5 5 0 010 10H8" />
      <path d="M7 5L3 10l4 5" />
    </svg>
  );
}

export function BackArrowIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function CheckIcon({ size = 16, color = 'var(--gold)', strokeWidth = 2.4 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const MEAL_PATHS: Record<string, ReactElement> = {
  colazione: ( // tazza di caffè
    <>
      <path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5z" />
      <path d="M17 10h1.5a2.5 2.5 0 010 5H17" />
      <path d="M8 3c-.5.7-.5 1.3 0 2M12 3c-.5.7-.5 1.3 0 2" />
    </>
  ),
  pranzo: ( // piatto con posate
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M9 8v4M11 8v4M9 10h2M15 8v10M15 8c1.5 0 1.5 2 0 3" />
    </>
  ),
  cena: ( // luna
    <path d="M18 13.5A7.5 7.5 0 019.5 5 7.5 7.5 0 1018 13.5z" />
  ),
  spuntino: ( // mela
    <>
      <path d="M12 9c-3 0-5 2.2-5 5.2C7 18 9.2 21 11 21c.8 0 1.2-.4 2-.4s1.2.4 2 .4c1.8 0 4-3 4-6.8C19 11.2 17 9 14 9c-.8 0-1.4.3-2 .3s-1.2-.3-2-.3z" />
      <path d="M12.2 9c0-1.5.8-2.5 2-3" />
    </>
  ),
};

export function MealIcon({ meal, size = 18, color = 'currentColor' }: { meal: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {MEAL_PATHS[meal] ?? MEAL_PATHS.spuntino}
    </svg>
  );
}

export function RefreshIcon({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0115.4-6.4M21 12a9 9 0 01-15.4 6.4" />
      <path d="M16 3v5h-5M8 21v-5h5" />
    </svg>
  );
}
