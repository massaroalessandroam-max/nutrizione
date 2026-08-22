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

// SQLite non permette di alterare un vincolo/PRIMARY KEY esistente: per le
// tabelle che passano da "un solo paziente" a multi-tenant e la cui vecchia
// chiave (id fisso, o una chiave naturale come meal_key/idx/date) non può
// più essere globale, l'unica via è ricreare la tabella. Lo facciamo una
// volta sola: controlliamo se la colonna "marker" (quella nuova) esiste già
// — se sì, la tabella è già alla forma nuova e non tocchiamo nulla; se no,
// è la vecchia forma (o non esiste ancora) e ricreiamo da zero. I dati di
// oggi sono di prova (confermato), quindi scartarli in questo passaggio è
// sicuro; dopo la prima migrazione questo controllo non droppa più nulla.
async function recreateIfMissingColumn(table: string, markerColumn: string, createSql: string): Promise<void> {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  const hasMarker = (rows as any[]).some((r) => r.name === markerColumn);
  if (hasMarker) return;
  await db.execute(`DROP TABLE IF EXISTS ${table}`);
  await db.execute(createSql);
}

// Tabelle la cui vecchia PRIMARY KEY era già un id globale (AUTOINCREMENT):
// per queste basta aggiungere la colonna patient_id, senza ricreare nulla.
// Stesso pattern try/catch già in uso per le altre colonne aggiunte dopo
// (skipped, mood, category...): il secondo ALTER fallisce (colonna già
// presente) e fa da guardia — il DELETE che segue scatta solo la prima
// volta, mai più sui dati reali dei pazienti futuri.
async function addPatientIdColumn(table: string): Promise<void> {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN patient_id INTEGER NOT NULL DEFAULT 0`);
    await db.execute(`DELETE FROM ${table}`);
  } catch {
    // colonna già presente: migrazione già fatta
  }
}

// Crea lo schema alla partenza. Va atteso prima di servire richieste: con un
// database remoto l'inizializzazione è una chiamata di rete.
export async function initDb(): Promise<void> {
  // ===== Account: pazienti e nutrizionisti =====

  // Sostituisce la vecchia tabella demo (mai collegata a un flusso reale):
  // stesso nome, forma nuova. Nessun collegamento a un nutrizionista
  // specifico — pool condiviso, visibile a tutto lo studio.
  await recreateIfMissingColumn('patients', 'access_code_hash', `
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      access_code_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      next_visit_at TEXT NOT NULL DEFAULT '',
      next_visit_note TEXT NOT NULL DEFAULT ''
    );
  `);
  // Vecchia tabella demo, sostituita dal vero "meals" scoperto per paziente.
  await db.execute('DROP TABLE IF EXISTS patient_meals');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS patient_sessions (
      token_hash TEXT PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS nutritionists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  // Registrazione solo su invito (tranne il primissimo account, che
  // sblocca da sé — vedi routes/nutritionistAuth.ts): un invito si
  // consuma alla prima registrazione riuscita (used_at valorizzato).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nutritionist_invites (
      token_hash TEXT PRIMARY KEY,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nutritionist_sessions (
      token_hash TEXT PRIMARY KEY,
      nutritionist_id INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Messaggi asincroni paziente↔nutrizionista. Solo testo per ora; il
  // mittente lato studio non traccia quale nutrizionista specifico ha
  // scritto (i pazienti sono visibili a tutto lo studio, nessuna vista
  // richiede di distinguerli).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // ===== Dati del paziente: da singleton a una riga/gruppo per patient_id =====

  await recreateIfMissingColumn('app_state', 'patient_id', `
    CREATE TABLE app_state (
      patient_id INTEGER PRIMARY KEY,
      points INTEGER NOT NULL,
      freq TEXT NOT NULL,
      fast_active INTEGER NOT NULL,
      fast_start INTEGER NOT NULL,
      greeting_name TEXT NOT NULL,
      onboarded INTEGER NOT NULL DEFAULT 0,
      fast_pref_enabled INTEGER NOT NULL DEFAULT 0,
      fast_pref_start TEXT NOT NULL DEFAULT '',
      fast_pref_end TEXT NOT NULL DEFAULT '',
      report_send_time TEXT NOT NULL DEFAULT '21:00'
    );
  `);

  await recreateIfMissingColumn('meal_schedule', 'patient_id', `
    CREATE TABLE meal_schedule (
      patient_id INTEGER NOT NULL,
      meal_key TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      time TEXT NOT NULL,
      PRIMARY KEY (patient_id, meal_key)
    );
  `);
  // Orari abituali degli spuntini: possono essere più di uno, quindi una
  // lista ordinata invece di una singola riga come per colazione/pranzo/cena.
  await recreateIfMissingColumn('snack_schedule', 'patient_id', `
    CREATE TABLE snack_schedule (
      patient_id INTEGER NOT NULL,
      idx INTEGER NOT NULL,
      time TEXT NOT NULL,
      PRIMARY KEY (patient_id, idx)
    );
  `);
  await recreateIfMissingColumn('meals', 'patient_id', `
    CREATE TABLE meals (
      patient_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      meal_key TEXT NOT NULL,
      done INTEGER NOT NULL,
      foods TEXT NOT NULL,
      time TEXT NOT NULL,
      skipped INTEGER NOT NULL DEFAULT 0,
      mood INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (patient_id, date, meal_key)
    );
  `);

  // Alimenti e grammature estratti dal piano del nutrizionista (foto/PDF
  // caricati dal paziente). category raggruppa per macro-tipo (carboidrati/
  // proteine/frutta e verdura/latticini); max_per_week è il tetto settimanale
  // concordato col nutrizionista ('1'/'2'/'3'/'sempre'/'opzionale') — usato
  // per segnalare quando un alimento (es. pizza) viene registrato più volte
  // di quanto previsto.
  await recreateIfMissingColumn('nutrition_plan_items', 'patient_id', `
    CREATE TABLE nutrition_plan_items (
      patient_id INTEGER NOT NULL,
      idx INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      max_per_week TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (patient_id, idx)
    );
  `);

  // Archivio dei documenti piano caricati (PDF/foto), come log — al
  // ricaricare un piano nuovo i dati estratti (nutrition_plan_items) vengono
  // sostituiti, ma il file resta salvato qui con la data di caricamento.
  // id già globale (AUTOINCREMENT): basta la colonna patient_id in più.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS plan_uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      media_type TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );
  `);
  await addPatientIdColumn('plan_uploads');

  // Testo del piano che non è un "alimento con grammatura": regole generali,
  // esempi di pasto per tipologia e divieti. Una riga per paziente (come
  // app_state), liste/mappe serializzate JSON.
  await recreateIfMissingColumn('plan_notes', 'patient_id', `
    CREATE TABLE plan_notes (
      patient_id INTEGER PRIMARY KEY,
      general_rules TEXT NOT NULL DEFAULT '[]',
      meal_examples TEXT NOT NULL DEFAULT '{}',
      divieti TEXT NOT NULL DEFAULT '[]'
    );
  `);

  // Destinatari email del report (con alias, es. "Dott.ssa Rossi") e log
  // degli invii effettuati — l'invio automatico vero e proprio richiede un
  // servizio email da collegare in seguito; queste tabelle esistono già
  // pronte per quando sarà attivo. id già globale: basta patient_id in più.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      alias TEXT NOT NULL DEFAULT ''
    );
  `);
  await addPatientIdColumn('report_recipients');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_send_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sent_at TEXT NOT NULL,
      recipients TEXT NOT NULL,
      report_from TEXT NOT NULL,
      report_to TEXT NOT NULL,
      body_text TEXT NOT NULL
    );
  `);
  await addPatientIdColumn('report_send_log');

  // Abitudini da spuntare, giornaliere o settimanali ("N volte a settimana").
  // id già globale (AUTOINCREMENT): basta patient_id in più. habit_checks
  // referenzia habit_id (già globale), non serve patient_id lì.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idx INTEGER NOT NULL,
      text TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'daily',
      target_per_week INTEGER NOT NULL DEFAULT 7,
      time TEXT NOT NULL DEFAULT ''
    );
  `);
  await addPatientIdColumn('habits');
  // Una spunta per abitudine/giorno. Il conteggio settimanale è a finestra
  // mobile di 7 giorni (stessa convenzione di loadWeekFoods per il piano),
  // non settimana solare.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS habit_checks (
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (habit_id, date)
    );
  `);

  // Cache delle ripartizioni per categoria (macronutrienti) degli alimenti
  // registrati che non matchano un alimento del piano: calcolate una volta
  // via AI e riusate, invece di richiamarla ad ogni apertura del report.
  // Generica (non è dato di un paziente specifico): nessuna scoping.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS food_category_weights (
      food_text TEXT PRIMARY KEY,
      weights_json TEXT NOT NULL
    );
  `);

  // Integratori personali del paziente, oltre al catalogo curato Nemis
  // (statico, in supplementCatalog.ts).
  await recreateIfMissingColumn('patient_supplements', 'patient_id', `
    CREATE TABLE patient_supplements (
      patient_id INTEGER NOT NULL,
      idx INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (patient_id, idx)
    );
  `);
  // Log assunzioni: a differenza dei pasti (un orario = "adesso", imposto
  // dal server) qui l'orario è scelto dal paziente perché può registrare a
  // posteriori ("l'ho preso stamattina"), quindi più righe per prodotto per
  // giorno invece di una entry sola per chiave. id già globale.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS supplement_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity TEXT NOT NULL,
      time TEXT NOT NULL
    );
  `);
  await addPatientIdColumn('supplement_logs');

  // Combo Chef salvate dal paziente: un elenco di macro-categorie con
  // l'alimento scelto per ciascuna, per un pasto, valide solo nei giorni
  // della settimana indicati (es. "colazione feriale" lun-ven, "colazione
  // domenica" solo dom). id già globale.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chef_combos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_key TEXT NOT NULL,
      days TEXT NOT NULL,
      slots TEXT NOT NULL
    );
  `);
  await addPatientIdColumn('chef_combos');
}

// Crea la riga app_state per un paziente appena creato dal nutrizionista —
// stesso ruolo di quello che prima era un singleton globale, ora una riga
// per patient_id. Il nome resta vuoto: lo imposta il paziente al primo
// accesso (onboarding), può differire dal nome che il nutrizionista ha dato
// al record (sono due cose diverse: etichetta interna vs. saluto in app).
export async function ensurePatientAppState(patientId: number): Promise<void> {
  await db.execute({
    sql: `INSERT INTO app_state (patient_id, points, freq, fast_active, fast_start, greeting_name)
          VALUES (?, 0, 'day', 0, ?, '')`,
    args: [patientId, Date.now()],
  });
}
