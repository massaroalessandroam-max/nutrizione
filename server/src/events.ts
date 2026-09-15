import { db } from './db.js';

export type EventType = 'patient_created' | 'onboarding_completed' | 'appointment_created' | 'message_from_patient';

export async function addEvent(patientId: number, type: EventType, message: string): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO events (patient_id, type, message, created_at) VALUES (?, ?, ?, ?)',
    args: [patientId, type, message, new Date().toISOString()],
  });
}

export interface ActivityItem { id: number; patientId: number; patientName: string; type: string; message: string; createdAt: string }

// Ultimi eventi di tutto lo studio, col nome paziente già risolto: il
// filtro per titolare lo fa il client incrociando patientId con la lista
// pazienti (che ha già ownerId), come già fa per la lista pazienti stessa.
export async function loadRecentActivity(limit = 20): Promise<ActivityItem[]> {
  const { rows } = await db.execute({
    sql: `SELECT e.id, e.patient_id, p.name AS patient_name, e.type, e.message, e.created_at
          FROM events e JOIN patients p ON p.id = e.patient_id
          ORDER BY e.created_at DESC, e.id DESC LIMIT ?`,
    args: [limit],
  });
  return (rows as any[]).map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    type: r.type,
    message: r.message,
    createdAt: r.created_at,
  }));
}
