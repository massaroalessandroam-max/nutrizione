import type { Report } from '../api';

export function buildReportWhatsappText(report: Report, patientName: string): string {
  const range = report.from === report.to ? report.from : `dal ${report.from} al ${report.to}`;
  const lines = [`*Diario Nemis* — ${patientName}, ${range}`, ''];
  for (const day of report.days) {
    lines.push(`*${day.date}*`);
    for (const m of day.meals) {
      lines.push(`${m.label} (${m.time}): ${m.foods.join(', ')} — ${m.scoreLabel}`);
    }
    lines.push('');
  }
  lines.push(`Pasti registrati: ${report.totalMeals} · Aderenza media: ${report.adherencePct}%`);
  return lines.join('\n');
}

export function buildWhatsappLink(text: string, phone?: string): string {
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}
