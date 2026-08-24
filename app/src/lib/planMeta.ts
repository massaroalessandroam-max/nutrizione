import { MAX_PER_WEEK_OPTIONS } from '../api';

export const MAX_PER_WEEK_LABEL: Record<string, string> = {
  '': '-', '1': '1 volta/sett.', '2': '2 volte/sett.', '3': '3 volte/sett.', sempre: 'Sempre', opzionale: 'Opzionale',
};
export const MAX_PER_WEEK_SELECT_OPTIONS = ['', ...MAX_PER_WEEK_OPTIONS];
