import { Router } from 'express';
import { db } from '../db.js';
import { hashAccessCode, hashToken, newSessionToken } from '../auth.js';

export const patientAuthRouter = Router();

patientAuthRouter.post('/patient-auth/login', async (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  if (!code) return res.status(400).json({ error: 'codice mancante' });

  const { rows } = await db.execute({
    sql: 'SELECT id FROM patients WHERE access_code_hash = ?',
    args: [hashAccessCode(code)],
  });
  const patient = rows[0] as any;
  if (!patient) return res.status(401).json({ error: 'codice non valido' });

  const token = newSessionToken();
  await db.execute({
    sql: 'INSERT INTO patient_sessions (token_hash, patient_id, created_at) VALUES (?, ?, ?)',
    args: [hashToken(token), patient.id, new Date().toISOString()],
  });

  res.json({ token, patientId: patient.id });
});
