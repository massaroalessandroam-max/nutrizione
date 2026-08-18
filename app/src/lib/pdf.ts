import { jsPDF } from 'jspdf';

export interface PdfMealRow {
  label: string;
  time: string;
  foods: string[];
  scoreLabel: string;
}

export interface PdfDiarioOptions {
  patientName: string;
  date: string;
  meals: PdfMealRow[];
  adherencePct: number;
}

const TEAL: [number, number, number] = [1, 114, 138];
const TEAL_DARK: [number, number, number] = [11, 59, 74];
const INK_SOFT: [number, number, number] = [44, 95, 108];
const LINE: [number, number, number] = [210, 230, 241];

export function generateDiarioPdf(opts: PdfDiarioOptions) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;

  doc.setFillColor(...TEAL_DARK);
  doc.rect(0, 0, 595, 96, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Diario Nemis', marginX, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${opts.patientName} · ${opts.date}`, marginX, 66);

  y = 128;
  doc.setTextColor(...TEAL_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Aderenza giornata', marginX, y);
  doc.setTextColor(...TEAL);
  doc.text(`${opts.adherencePct}%`, 595 - marginX, y, { align: 'right' });

  y += 24;
  doc.setDrawColor(...LINE);
  doc.line(marginX, y, 595 - marginX, y);
  y += 28;

  for (const meal of opts.meals) {
    doc.setTextColor(...TEAL_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(meal.label, marginX, y);
    doc.setTextColor(...INK_SOFT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(meal.time, marginX + 110, y);

    doc.setTextColor(...TEAL);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(meal.scoreLabel, 595 - marginX, y, { align: 'right' });

    y += 18;
    doc.setTextColor(...INK_SOFT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const foodsText = meal.foods.length ? meal.foods.join(', ') : '—';
    const wrapped = doc.splitTextToSize(foodsText, 595 - marginX * 2);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 14 + 18;

    if (y > 760) {
      doc.addPage();
      y = 56;
    }
  }

  doc.setTextColor(...INK_SOFT);
  doc.setFontSize(9);
  doc.text('Generato da Diario Nemis · Metodo Nemis', marginX, 812);

  doc.save(`diario-nemis-${opts.patientName.toLowerCase().replace(/\s+/g, '-')}-${opts.date}.pdf`);
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
