// Calendario stagionale di frutta e verdura in Italia. Dati agronomici
// generali (calendario di stagionalità comune, non legato a una fonte
// specifica), mesi numerati 1 (gennaio) - 12 (dicembre). Alcuni prodotti
// sono disponibili tutto l'anno (es. patate, carote) e restano quindi
// sempre "in stagione".
export interface SeasonalItem {
  name: string;
  months: number[];
}

const ALL_YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const SEASONAL_PRODUCE: SeasonalItem[] = [
  // Frutta
  { name: 'fragole', months: [4, 5, 6] },
  { name: 'ciliegie', months: [5, 6, 7] },
  { name: 'albicocche', months: [6, 7] },
  { name: 'pesche', months: [6, 7, 8, 9] },
  { name: 'nettarine', months: [6, 7, 8] },
  { name: 'susine', months: [6, 7, 8, 9] },
  { name: 'prugne', months: [6, 7, 8, 9] },
  { name: 'melone', months: [6, 7, 8, 9] },
  { name: 'anguria', months: [6, 7, 8] },
  { name: 'cocomero', months: [6, 7, 8] },
  { name: 'fichi', months: [8, 9] },
  { name: 'uva', months: [8, 9, 10] },
  { name: 'more', months: [8, 9] },
  { name: 'lamponi', months: [6, 7, 8] },
  { name: 'mirtilli', months: [6, 7, 8] },
  { name: 'frutti di bosco', months: [6, 7, 8] },
  { name: 'castagne', months: [9, 10, 11] },
  { name: 'melograno', months: [9, 10, 11] },
  { name: 'cachi', months: [10, 11] },
  { name: 'kiwi', months: [10, 11, 12, 1, 2, 3, 4] },
  { name: 'mele', months: [9, 10, 11, 12, 1, 2, 3] },
  { name: 'pere', months: [9, 10, 11, 12, 1] },
  { name: 'mandarini', months: [11, 12, 1, 2] },
  { name: 'clementine', months: [11, 12, 1] },
  { name: 'arance', months: [12, 1, 2, 3, 4] },
  { name: 'pompelmo', months: [12, 1, 2, 3] },
  { name: 'limoni', months: ALL_YEAR },
  { name: 'banana', months: ALL_YEAR },

  // Verdura
  { name: 'zucchine', months: [5, 6, 7, 8, 9] },
  { name: 'melanzane', months: [6, 7, 8, 9] },
  { name: 'peperoni', months: [6, 7, 8, 9] },
  { name: 'pomodori', months: [6, 7, 8, 9] },
  { name: 'fagiolini', months: [6, 7, 8, 9] },
  { name: 'cetrioli', months: [5, 6, 7, 8, 9] },
  { name: 'zucca', months: [9, 10, 11, 12] },
  { name: 'broccoli', months: [10, 11, 12, 1, 2, 3] },
  { name: 'cavolfiore', months: [10, 11, 12, 1, 2, 3] },
  { name: 'cavolo', months: [10, 11, 12, 1, 2, 3] },
  { name: 'verza', months: [10, 11, 12, 1, 2, 3] },
  { name: 'radicchio', months: [10, 11, 12, 1, 2] },
  { name: 'carciofi', months: [10, 11, 12, 1, 2, 3, 4] },
  { name: 'finocchi', months: [10, 11, 12, 1, 2, 3] },
  { name: 'porri', months: [10, 11, 12, 1, 2, 3] },
  { name: 'spinaci', months: [10, 11, 12, 1, 2, 3, 4] },
  { name: 'bietole', months: [4, 5, 6, 9, 10, 11] },
  { name: 'asparagi', months: [3, 4, 5] },
  { name: 'piselli', months: [4, 5, 6] },
  { name: 'fave', months: [4, 5, 6] },
  { name: 'carote', months: ALL_YEAR },
  { name: 'patate', months: ALL_YEAR },
  { name: 'cipolle', months: ALL_YEAR },
  { name: 'insalata', months: ALL_YEAR },
  { name: 'lattuga', months: ALL_YEAR },
  { name: 'sedano', months: [9, 10, 11, 12, 1, 2] },
  { name: 'rucola', months: [3, 4, 5, 9, 10, 11] },
];

// null = il nome non corrisponde a nessuna frutta/verdura nota (non
// applicabile: non deve influenzare il verdetto).
export function isInSeason(name: string, month: number): boolean | null {
  const n = name.toLowerCase().trim();
  const item = SEASONAL_PRODUCE.find((p) => n.includes(p.name));
  if (!item) return null;
  return item.months.includes(month);
}
