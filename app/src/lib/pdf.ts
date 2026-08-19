import { jsPDF } from 'jspdf';

export interface PdfMealRow {
  label: string;
  time: string;
  foods: string[];
  scoreLabel: string;
}

const TEAL: [number, number, number] = [1, 114, 138];
const TEAL_DARK: [number, number, number] = [11, 59, 74];
const INK_SOFT: [number, number, number] = [44, 95, 108];
const LINE: [number, number, number] = [210, 230, 241];

export interface PdfReportOptions {
  patientName: string;
  from: string;
  to: string;
  days: Array<{ date: string; meals: PdfMealRow[] }>;
  adherencePct: number;
  totalMeals: number;
}

const DAY_FMT = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Costruisce il documento senza salvarlo, così il chiamante decide se
// scaricarlo subito (.save) o mostrarne prima l'anteprima (.output('blob')).
export function buildReportPdf(opts: PdfReportOptions): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageBottom = 780;
  let y = 56;

  doc.setFillColor(...TEAL_DARK);
  doc.rect(0, 0, 595, 110, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Report Diario Nemis', marginX, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${opts.patientName} · dal ${opts.from} al ${opts.to}`, marginX, 66);
  doc.setFontSize(10);
  doc.text(`${opts.totalMeals} pasti registrati · aderenza media ${opts.adherencePct}%`, marginX, 86);

  y = 142;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageBottom) {
      doc.addPage();
      y = 56;
    }
  };

  for (const day of opts.days) {
    ensureSpace(50);
    doc.setTextColor(...TEAL_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(capitalize(DAY_FMT.format(new Date(`${day.date}T00:00:00`))), marginX, y);
    y += 14;
    doc.setDrawColor(...LINE);
    doc.line(marginX, y, 595 - marginX, y);
    y += 22;

    for (const meal of day.meals) {
      ensureSpace(60);
      doc.setTextColor(...TEAL_DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(meal.label, marginX, y);
      doc.setTextColor(...INK_SOFT);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(meal.time, marginX + 100, y);
      doc.setTextColor(...TEAL);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(meal.scoreLabel, 595 - marginX, y, { align: 'right' });

      y += 16;
      doc.setTextColor(...INK_SOFT);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      const foodsText = meal.foods.length ? meal.foods.join(', ') : '—';
      const wrapped = doc.splitTextToSize(foodsText, 595 - marginX * 2);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 13 + 16;
    }
    y += 6;
  }

  if (opts.days.length === 0) {
    doc.setTextColor(...INK_SOFT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Nessun pasto registrato in questo periodo.', marginX, y);
  }

  doc.setTextColor(...INK_SOFT);
  doc.setFontSize(9);
  doc.text('Generato da Diario Nemis · Metodo Nemis', marginX, 812);

  return doc;
}

export interface PdfPlanItem {
  name: string;
  quantity: string;
}

export function generatePlanPdf(items: PdfPlanItem[], patientName: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;

  doc.setFillColor(...TEAL_DARK);
  doc.rect(0, 0, 595, 96, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Piano Nemis', marginX, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${patientName} · ${new Date().toLocaleDateString('it-IT')}`, marginX, 66);

  y = 128;
  doc.setTextColor(...TEAL_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Alimenti e grammature', marginX, y);
  y += 20;
  doc.setDrawColor(...LINE);
  doc.line(marginX, y, 595 - marginX, y);
  y += 26;

  for (const item of items) {
    doc.setTextColor(...TEAL_DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(item.name, marginX, y);
    doc.setTextColor(...INK_SOFT);
    doc.text(item.quantity, 595 - marginX, y, { align: 'right' });
    y += 22;

    if (y > 760) {
      doc.addPage();
      y = 56;
    }
  }

  doc.setTextColor(...INK_SOFT);
  doc.setFontSize(9);
  doc.text('Generato da Diario Nemis · Metodo Nemis', marginX, 812);

  doc.save(`piano-nemis-${patientName.toLowerCase().replace(/\s+/g, '-') || 'paziente'}.pdf`);
}
