import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword, verifyPassword, hashToken, newSessionToken, requireNutritionist } from '../auth.js';

export const nutritionistAuthRouter = Router();

async function createNutritionistSession(nutritionistId: number): Promise<string> {
  const token = newSessionToken();
  await db.execute({
    sql: 'INSERT INTO nutritionist_sessions (token_hash, nutritionist_id, created_at) VALUES (?, ?, ?)',
    args: [hashToken(token), nutritionistId, new Date().toISOString()],
  });
  return token;
}

type RegisterResult = { ok: true; token: string } | { ok: false; status: number; error: string };

// Registrazione solo su invito — tranne il primissimo account in assoluto,
// che sblocca da sé (altrimenti nessuno potrebbe mai registrarsi). Estratta
// dalla route per essere testabile senza passare da Express.
export async function registerNutritionist(input: { name: string; email: string; password: string; inviteToken?: string }): Promise<RegisterResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const inviteToken = (input.inviteToken ?? '').trim();

  if (!name || !email || password.length < 8) {
    return { ok: false, status: 400, error: 'nome, email e password (almeno 8 caratteri) sono obbligatori' };
  }

  const { rows: countRows } = await db.execute('SELECT COUNT(*) as n FROM nutritionists');
  const isFirstEver = Number((countRows[0] as any).n) === 0;

  let inviteHash: string | null = null;
  if (!isFirstEver) {
    if (!inviteToken) return { ok: false, status: 400, error: 'serve un invito di un collega già registrato' };
    inviteHash = hashToken(inviteToken);
    const { rows } = await db.execute({
      sql: 'SELECT token_hash FROM nutritionist_invites WHERE token_hash = ? AND used_at IS NULL',
      args: [inviteHash],
    });
    if (!rows[0]) return { ok: false, status: 400, error: 'invito non valido o già usato' };
  }

  const { rows: dupe } = await db.execute({ sql: 'SELECT id FROM nutritionists WHERE email = ?', args: [email] });
  if (dupe[0]) return { ok: false, status: 409, error: 'esiste già un account con questa email' };

  const result = await db.execute({
    sql: 'INSERT INTO nutritionists (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
    args: [name, email, hashPassword(password), new Date().toISOString()],
  });
  const nutritionistId = Number(result.lastInsertRowid);

  if (inviteHash) {
    await db.execute({ sql: 'UPDATE nutritionist_invites SET used_at = ? WHERE token_hash = ?', args: [new Date().toISOString(), inviteHash] });
  }

  return { ok: true, token: await createNutritionistSession(nutritionistId) };
}

nutritionistAuthRouter.post('/nutritionist-auth/register', async (req, res) => {
  const result = await registerNutritionist({
    name: String(req.body?.name ?? ''),
    email: String(req.body?.email ?? ''),
    password: String(req.body?.password ?? ''),
    inviteToken: typeof req.body?.inviteToken === 'string' ? req.body.inviteToken : undefined,
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ token: result.token });
});

nutritionistAuthRouter.post('/nutritionist-auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const { rows } = await db.execute({ sql: 'SELECT id, password_hash FROM nutritionists WHERE email = ?', args: [email] });
  const row = rows[0] as any;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'email o password non corretti' });
  }

  res.json({ token: await createNutritionistSession(row.id) });
});

// Genera un invito per un collega — solo un nutrizionista già autenticato
// può farlo. Il token va condiviso fuori banda (messaggio, email...).
nutritionistAuthRouter.post('/nutritionist-auth/invite', requireNutritionist, async (req, res) => {
  const token = newSessionToken();
  await db.execute({
    sql: 'INSERT INTO nutritionist_invites (token_hash, created_by, created_at) VALUES (?, ?, ?)',
    args: [hashToken(token), req.nutritionistId!, new Date().toISOString()],
  });
  res.json({ inviteToken: token });
});
