import { db } from '../db.js';

export interface Appointment { id: number; at: string; note: string }

// Ordinati per data: lo storico intero (passati e futuri), non solo il
// prossimo — il client filtra/derivano il "prossimo" da qui se serve.
export async function loadAppointments(patientId: number): Promise<Appointment[]> {
  const { rows } = await db.execute({ sql: 'SELECT id, at, note FROM appointments WHERE patient_id = ? ORDER BY at', args: [patientId] });
  return (rows as any[]).map((r) => ({ id: r.id, at: r.at, note: r.note }));
}

export async function addAppointment(patientId: number, at: string, note: string): Promise<Appointment[]> {
  await db.execute({
    sql: 'INSERT INTO appointments (patient_id, at, note, created_at) VALUES (?, ?, ?, ?)',
    args: [patientId, at, note, new Date().toISOString()],
  });
  return loadAppointments(patientId);
}

export async function deleteAppointment(patientId: number, id: number): Promise<Appointment[]> {
  await db.execute({ sql: 'DELETE FROM appointments WHERE id = ? AND patient_id = ?', args: [id, patientId] });
  return loadAppointments(patientId);
}
