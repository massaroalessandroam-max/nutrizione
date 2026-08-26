import type { Weekday } from '../../types';
import { WEEKDAYS, DAY_LABEL } from '../../lib/habitMeta';

export function DayPicker({ days, onChange }: { days: Weekday[]; onChange: (days: Weekday[]) => void }) {
  return (
    <div className="nm-habit-days">
      {WEEKDAYS.map((d) => (
        <button
          key={d}
          type="button"
          className={`nm-habit-day ${days.includes(d) ? 'is-on' : ''}`}
          onClick={() => onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
          aria-label={days.includes(d) ? `Rimuovi ${DAY_LABEL[d]}` : `Aggiungi ${DAY_LABEL[d]}`}
        >
          {DAY_LABEL[d]}
        </button>
      ))}
    </div>
  );
}
