import type { Exercise, ExerciseKind, SetEntry } from '../types';
import { api } from '../api';
import type { Catalog } from '../components/patient/ExercisePicker';

export const kindOf = (ex: Exercise): ExerciseKind => (ex.bodyParts.includes('cardio') ? 'cardio' : 'strength');

export const fmtDate = (iso: string) => iso.split('-').reverse().join('/');

const fmtNum = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export function describeSet(kind: ExerciseKind, s: SetEntry): string {
  if (kind === 'cardio') return `${fmtNum(s.minutes)} min`;
  return `${fmtNum(s.weight)} kg × ${s.reps}`;
}

export const todayIso = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in fuso locale


export const patientCatalog: Catalog = { list: api.getExercises, bodyParts: api.getExerciseBodyParts };

export const nutritionistCatalog: Catalog = { list: api.getNutritionistExercises, bodyParts: api.getNutritionistExerciseBodyParts };
