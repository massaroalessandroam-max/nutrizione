import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { db, ensurePatientAppState } from '../db.js';
import { hashAccessCode, hashPassword, hashToken, newAccessCode, newSessionToken } from '../auth.js';
import { createNutritionistSession } from './nutritionistAuth.js';

// Fase di test: chiunque abbia il link entra senza codice/password, come
// "Paziente Demo" o "Nutrizionista Demo". Le sessioni sono quelle vere (le
// route restano protette da requirePatient/requireNutritionist): qui si crea
// solo una sessione per un account demo. Spegni con OPEN_ACCESS=0 su Render.
export const OPEN_ACCESS = process.env.OPEN_ACCESS !== '0';

const DEMO_PATIENT_NAME = 'Paziente Demo';
const DEMO_NUTRITIONIST_EMAIL = 'demo@nemis.local';

// Il codice paziente / la password dell'account demo sono casuali e mai
// mostrati: con OPEN_ACCESS=0 l'account demo non è più raggiungibile.
export async function openPatientSession(): Promise<string> {
  const { rows } = await db.execute({ sql: 'SELECT id FROM patients WHERE name = ? ORDER BY id LIMIT 1', args: [DEMO_PATIENT_NAME] });
  let patientId = (rows[0] as any)?.id as number | undefined;
  if (patientId === undefined) {
    const result = await db.execute({
      sql: 'INSERT INTO patients (name, access_code_hash, created_at) VALUES (?, ?, ?)',
      args: [DEMO_PATIENT_NAME, hashAccessCode(newAccessCode(16)), new Date().toISOString()],
    });
    patientId = Number(result.lastInsertRowid);
    await ensurePatientAppState(patientId);
  }

  const token = newSessionToken();
  await db.execute({
    sql: 'INSERT INTO patient_sessions (token_hash, patient_id, created_at) VALUES (?, ?, ?)',
    args: [hashToken(token), patientId, new Date().toISOString()],
  });
  return token;
}

export async function openNutritionistSession(): Promise<string> {
  const { rows } = await db.execute({ sql: 'SELECT id FROM nutritionists WHERE email = ?', args: [DEMO_NUTRITIONIST_EMAIL] });
  let nutritionistId = (rows[0] as any)?.id as number | undefined;
  if (nutritionistId === undefined) {
    const result = await db.execute({
      sql: 'INSERT INTO nutritionists (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      args: ['Nutrizionista Demo', DEMO_NUTRITIONIST_EMAIL, hashPassword(randomBytes(24).toString('hex')), new Date().toISOString()],
    });
    nutritionistId = Number(result.lastInsertRowid);
  }
  return createNutritionistSession(nutritionistId);
}

export const openAccessRouter = Router();

openAccessRouter.post('/open/patient', async (_req, res) => {
  if (!OPEN_ACCESS) return res.status(404).json({ error: 'accesso libero disattivato' });
  res.json({ token: await openPatientSession() });
});

openAccessRouter.post('/open/nutritionist', async (_req, res) => {
  if (!OPEN_ACCESS) return res.status(404).json({ error: 'accesso libero disattivato' });
  res.json({ token: await openNutritionistSession() });
});
