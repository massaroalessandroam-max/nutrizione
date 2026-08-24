import { db } from '../db.js';

export const GOAL_LEVELS = ['macro', 'micro'] as const;
export type GoalLevel = (typeof GOAL_LEVELS)[number];

export interface Goal { id: number; level: GoalLevel; text: string; targetDate: string }

// Testo libero + scadenza, non un valore numerico: un obiettivo può essere
// di peso ma anche "correre una maratona in 4 ore" o "arrivare alla taglia
// 42" — niente da cui calcolare una percentuale di avanzamento universale.
export async function loadGoals(patientId: number): Promise<Goal[]> {
  const { rows } = await db.execute({ sql: 'SELECT id, level, text, target_date FROM goals WHERE patient_id = ? ORDER BY target_date', args: [patientId] });
  return (rows as any[]).map((r) => ({ id: r.id, level: r.level, text: r.text, targetDate: r.target_date }));
}

export async function addGoal(patientId: number, level: GoalLevel, text: string, targetDate: string): Promise<Goal[]> {
  await db.execute({
    sql: 'INSERT INTO goals (patient_id, level, text, target_date, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [patientId, level, text, targetDate, new Date().toISOString()],
  });
  return loadGoals(patientId);
}

export async function deleteGoal(patientId: number, id: number): Promise<Goal[]> {
  await db.execute({ sql: 'DELETE FROM goals WHERE id = ? AND patient_id = ?', args: [id, patientId] });
  return loadGoals(patientId);
}
