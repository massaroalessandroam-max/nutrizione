import type { ReactNode } from 'react';

interface RingSvgProps {
  size: number;
  radius: number;
  strokeWidth: number;
  progress: number; // 0..1
  trackColor: string;
  progressColor: string;
  children?: ReactNode;
}

export function RingSvg({ size, radius, strokeWidth, progress, trackColor, progressColor, children }: RingSvgProps) {
  const c = size / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={c} cy={c} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={c} cy={c} r={radius} fill="none" stroke={progressColor} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}
