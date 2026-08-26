import { MAX_PER_WEEK_OPTIONS } from '../api';

export const MAX_PER_WEEK_LABEL: Record<string, string> = {
  '': '-', '1': '1 volta/sett.', '2': '2 volte/sett.', '3': '3 volte/sett.', sempre: 'Sempre', opzionale: 'Opzionale',
};
export const MAX_PER_WEEK_SELECT_OPTIONS = ['', ...MAX_PER_WEEK_OPTIONS];

// Etichette corte per i chip categoria nella lista Alimenti (l'enum e il
// <select> di modifica restano coi nomi completi, invariati).
export const CATEGORY_LABEL_SHORT: Record<string, string> = {
  Carboidrati: 'Carbo', Proteine: 'Pro', Legumi: 'Legumi', Grassi: 'Grassi', Frutta: 'Frutta', Verdura: 'Verdura', Latticini: 'Latt',
};
