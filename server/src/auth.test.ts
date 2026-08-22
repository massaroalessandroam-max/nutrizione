import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';

const { db, initDb } = await import('./db.js');
const { hashPassword, verifyPassword, hashToken, newSessionToken, newAccessCode, hashAccessCode } = await import('./auth.js');
const { registerNutritionist } = await import('./routes/nutritionistAuth.js');

await initDb();

test('hashPassword/verifyPassword: correct password verifies, wrong one does not', () => {
  const stored = hashPassword('supersegreta1');
  assert.equal(verifyPassword('supersegreta1', stored), true);
  assert.equal(verifyPassword('altra-password', stored), false);
});

test('hashToken: deterministic (stesso input, stesso hash)', () => {
  const token = newSessionToken();
  assert.equal(hashToken(token), hashToken(token));
});

test('newAccessCode/hashAccessCode: case/spazi non contano nel confronto', () => {
  const code = newAccessCode();
  assert.equal(hashAccessCode(code), hashAccessCode(` ${code.toLowerCase()} `));
});

test('registerNutritionist: bootstrap — il primo account non richiede invito', async () => {
  await db.execute('DELETE FROM nutritionists');
  await db.execute('DELETE FROM nutritionist_invites');

  const result = await registerNutritionist({ name: 'Prima', email: 'prima@studio.it', password: 'passwordlunga1' });
  assert.equal(result.ok, true);
});

test('registerNutritionist: dal secondo account in poi serve un invito valido e non riusabile', async () => {
  await db.execute('DELETE FROM nutritionists');
  await db.execute('DELETE FROM nutritionist_invites');

  await registerNutritionist({ name: 'Prima', email: 'prima2@studio.it', password: 'passwordlunga1' });

  const senzaInvito = await registerNutritionist({ name: 'Seconda', email: 'seconda@studio.it', password: 'passwordlunga1' });
  assert.equal(senzaInvito.ok, false);

  const inviteToken = newSessionToken();
  await db.execute({
    sql: 'INSERT INTO nutritionist_invites (token_hash, created_by, created_at) VALUES (?, 1, ?)',
    args: [hashToken(inviteToken), new Date().toISOString()],
  });

  const conInvito = await registerNutritionist({ name: 'Seconda', email: 'seconda@studio.it', password: 'passwordlunga1', inviteToken });
  assert.equal(conInvito.ok, true);

  const riuso = await registerNutritionist({ name: 'Terza', email: 'terza@studio.it', password: 'passwordlunga1', inviteToken });
  assert.equal(riuso.ok, false, 'un invito già usato non deve funzionare una seconda volta');
});
