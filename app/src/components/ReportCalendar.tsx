const WEEKDAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const MONTH_FMT = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  month: Date;
  onMonthChange: (d: Date) => void;
  activityDates: Set<string>;
  rangeStart: string | null;
  rangeEnd: string | null;
  onSelectDay: (iso: string) => void;
}

export function ReportCalendar({ month, onMonthChange, activityDates, rangeStart, rangeEnd, onSelectDay }: Props) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstOfMonth = new Date(year, monthIdx, 1);
  // Lunedì = 0 invece della domenica di JS, per un calendario all'italiana.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayIso = toISODate(new Date());

  const cells: Array<{ day: number; iso: string } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const iso = toISODate(new Date(year, monthIdx, i + 1));
      return { day: i + 1, iso };
    }),
  ];

  return (
    <div className="nm-calendar">
      <div className="nm-calendar-head">
        <button className="nm-calendar-nav" onClick={() => onMonthChange(new Date(year, monthIdx - 1, 1))} aria-label="Mese precedente">‹</button>
        <div className="nm-calendar-month">{MONTH_FMT.format(month)}</div>
        <button className="nm-calendar-nav" onClick={() => onMonthChange(new Date(year, monthIdx + 1, 1))} aria-label="Mese successivo">›</button>
      </div>
      <div className="nm-calendar-weekdays">
        {WEEKDAY_LABELS.map((w, i) => <span key={i}>{w}</span>)}
      </div>
      <div className="nm-calendar-grid">
        {cells.map((cell, i) => {
          if (!cell) return <span key={i} className="nm-calendar-cell is-blank" />;
          const inRange = !!rangeStart && !!rangeEnd && cell.iso >= rangeStart && cell.iso <= rangeEnd;
          const isEdge = cell.iso === rangeStart || cell.iso === rangeEnd;
          const hasActivity = activityDates.has(cell.iso);
          const isToday = cell.iso === todayIso;
          const cls = [
            'nm-calendar-cell',
            inRange ? 'is-in-range' : '',
            isEdge ? 'is-edge' : '',
            isToday ? 'is-today' : '',
          ].filter(Boolean).join(' ');
          return (
            <button key={i} className={cls} onClick={() => onSelectDay(cell.iso)}>
              {cell.day}
              {hasActivity && <span className="nm-calendar-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
