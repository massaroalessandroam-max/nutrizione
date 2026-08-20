// Catalogo curato dei prodotti Nemis/Liberi dalle Calorie. Elenco statico
// (nessun pannello admin per gestirlo): per aggiungere, correggere o
// togliere un prodotto si modifica questo file e si fa deploy. dosageHint
// lasciato vuoto finché non arriva il dosaggio consigliato reale dal
// nutrizionista — non va inventato.
export interface SupplementCatalogItem {
  name: string;
  dosageHint: string;
  url: string;
}

export const SUPPLEMENT_CATALOG: SupplementCatalogItem[] = [
  { name: 'Flobutir', dosageHint: '', url: 'https://liberidallecalorie.it/prodotto/flobutir/' },
];
