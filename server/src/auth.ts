import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      patientId?: number;
      nutritionistId?: number;
    }
  }
}

export function newSessionToken(): string {
  return randomBytes(24).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Codice d'accesso paziente: breve e leggibile a voce/su carta, alfabeto
// senza caratteri ambigui (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newAccessCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// Il codice non è mai salvato in chiaro — stesso schema hash dei token di
// sessione. Normalizzato (maiuscolo, senza spazi) perché il paziente possa
// ridigitarlo senza badare a maiuscole/minuscole.
export function hashAccessCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

// Password temporanea per il reset di un account nutrizionista (fatto da un
// collega già dentro, non c'è un servizio email per il classico link di
// reset) — stesso alfabeto leggibile del codice paziente, solo più lunga.
export function newTempPassword(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// scrypt salato via node:crypto — nessuna dipendenza (bcrypt/argon2) per un
// solo tipo di password (nutrizionista). Formato salvato: "salt:derivedHex".
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, derivedHex] = stored.split(':');
  if (!salt || !derivedHex) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(derivedHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export async function requirePatient(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'non autenticato' });
  const { rows } = await db.execute({
    sql: 'SELECT patient_id FROM patient_sessions WHERE token_hash = ?',
    args: [hashToken(token)],
  });
  const row = rows[0] as any;
  if (!row) return res.status(401).json({ error: 'sessione non valida' });
  req.patientId = row.patient_id as number;
  next();
}

export async function requireNutritionist(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'non autenticato' });
  const { rows } = await db.execute({
    sql: 'SELECT nutritionist_id FROM nutritionist_sessions WHERE token_hash = ?',
    args: [hashToken(token)],
  });
  const row = rows[0] as any;
  if (!row) return res.status(401).json({ error: 'sessione non valida' });
  req.nutritionistId = row.nutritionist_id as number;
  next();
}
