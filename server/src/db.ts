import { createClient, type Client } from '@libsql/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Persistenza: su hosting gratuiti (Render, Railway, Fly) il disco è
// effimero e viene azzerato a ogni deploy. Usiamo libSQL/Turso — stesso
// client sia per un file locale (`file:...`, sviluppo) sia per il database
// remoto (`libsql://...`, produzione): il codice è uno solo, cambia solo
// l'URL.
//
//   DATABASE_URL=libsql://<nome>-<org>.turso.io
//   DATABASE_AUTH_TOKEN=<token generato con la CLI Turso>
//
// Senza queste variabili si ricade su un file locale accanto al server.
const remoteUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
const localPath = process.env.DB_PATH ?? path.join(__dirname, '..', 'data.sqlite');
const localUrl = localPath === ':memory:' ? ':memory:' : `file:${localPath}`;

export const db: Client = createClient(
  remoteUrl ? { url: remoteUrl, authToken } : { url: localUrl }
);

export function isRemoteDb(): boolean {
  return !!remoteUrl;
}

// Colonne aggiunte ad app_state dopo la creazione iniziale della tabella:
// CREATE TABLE IF NOT EXISTS non tocca le tabelle già esistenti, quindi vanno
// aggiunte con ALTER TABLE a parte. Ognuna fallisce (silenziosamente) se la
// colonna è già presente.
const APP_STATE_MIGRATIONS = [
  'ALTER TABLE app_state ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0',
  "ALTER TABLE app_state ADD COLUMN fast_pref_enabled INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE app_state ADD COLUMN fast_pref_start TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE app_state ADD COLUMN fast_pref_end TEXT NOT NULL DEFAULT ''",
];

// Crea lo schema alla partenza. Va atteso prima di servire richieste: con un
// database remoto l'inizializzazione è una chiamata di rete.
export async function initDb(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      points INTEGER NOT NULL,
      freq TEXT NOT NULL,
      fast_active INTEGER NOT NULL,
      fast_start INTEGER NOT NULL,
      greeting_name TEXT NOT NULL,
      onboarded INTEGER NOT NULL DEFAULT 0,
      fast_pref_enabled INTEGER NOT NULL DEFAULT 0,
      fast_pref_start TEXT NOT NULL DEFAULT '',
      fast_pref_end TEXT NOT NULL DEFAULT ''
    );
  `);
  for (const migration of APP_STATE_MIGRATIONS) {
    try {
      await db.execute(migration);
    } catch {
      // colonna già presente
    }
  }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meal_schedule (
      meal_key TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL,
      time TEXT NOT NULL
    );
  `);
  // Orari abituali degli spuntini: possono essere più di uno, quindi una
  // lista ordinata invece di una singola riga come per colazione/pranzo/cena.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS snack_schedule (
      idx INTEGER PRIMARY KEY,
      time TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meals (
      date TEXT NOT NULL,
      meal_key TEXT NOT NULL,
      done INTEGER NOT NULL,
      foods TEXT NOT NULL,
      time TEXT NOT NULL,
      skipped INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date, meal_key)
    );
  `);
  try {
    await db.execute('ALTER TABLE meals ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0');
  } catch {
    // colonna già presente
  }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      plan TEXT NOT NULL,
      adherence TEXT NOT NULL,
      tone TEXT NOT NULL,
      streak INTEGER NOT NULL,
      last_meal_summary TEXT NOT NULL,
      last_time TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS patient_meals (
      patient_id TEXT NOT NULL,
      meal_key TEXT NOT NULL,
      time TEXT NOT NULL,
      foods TEXT NOT NULL,
      PRIMARY KEY (patient_id, meal_key)
    );
  `);
  // Alimenti e grammature estratti dal piano del nutrizionista (foto/PDF
  // caricati dal paziente). category raggruppa per macro-tipo (carboidrati/
  // proteine/frutta e verdura/latticini); max_per_week è il tetto settimanale
  // concordato col nutrizionista ('1'/'2'/'3'/'sempre'/'opzionale') — usato
  // per segnalare quando un alimento (es. pizza) viene registrato più volte
  // di quanto previsto.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nutrition_plan_items (
      idx INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      max_per_week TEXT NOT NULL DEFAULT 'sempre'
    );
  `);
  for (const migration of [
    "ALTER TABLE nutrition_plan_items ADD COLUMN category TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE nutrition_plan_items ADD COLUMN max_per_week TEXT NOT NULL DEFAULT 'sempre'",
  ]) {
    try {
      await db.execute(migration);
    } catch {
      // colonna già presente
    }
  }

  await ensureAppStateRow();
}

// Nessun dato fittizio: la riga singleton di app_state parte vuota e il
// paziente la popola registrandosi (vedi routes/onboarding.ts).
async function ensureAppStateRow(): Promise<void> {
  const { rows } = await db.execute('SELECT id FROM app_state WHERE id = 1');
  if (rows.length) return;
  await db.execute({
    sql: `INSERT INTO app_state (id, points, freq, fast_active, fast_start, greeting_name)
          VALUES (1, 0, 'day', 0, ?, '')`,
    args: [Date.now()],
  });
}
