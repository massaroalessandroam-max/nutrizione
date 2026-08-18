import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? path.join(__dirname, '..', 'data.sqlite');

export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    points INTEGER NOT NULL,
    freq TEXT NOT NULL,
    fast_active INTEGER NOT NULL,
    fast_start INTEGER NOT NULL,
    greeting_name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meals (
    date TEXT NOT NULL,
    meal_key TEXT NOT NULL,
    done INTEGER NOT NULL,
    foods TEXT NOT NULL,
    time TEXT NOT NULL,
    PRIMARY KEY (date, meal_key)
  );

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

  CREATE TABLE IF NOT EXISTS patient_meals (
    patient_id TEXT NOT NULL,
    meal_key TEXT NOT NULL,
    time TEXT NOT NULL,
    foods TEXT NOT NULL,
    PRIMARY KEY (patient_id, meal_key)
  );
`);

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function seedIfEmpty() {
  const stateRow = db.prepare('SELECT id FROM app_state WHERE id = 1').get();
  if (!stateRow) {
    db.prepare(
      `INSERT INTO app_state (id, points, freq, fast_active, fast_start, greeting_name)
       VALUES (1, ?, ?, ?, ?, ?)`
    ).run(320, 'day', 1, Date.now() - (14 * 3600 + 20 * 60) * 1000, 'Sofia');

    const insertMeal = db.prepare(
      'INSERT INTO meals (date, meal_key, done, foods, time) VALUES (?, ?, ?, ?, ?)'
    );

    // Today: only breakfast logged so far, matching the prototype's default.
    const today = isoDaysAgo(0);
    const todaySeed: Array<[string, number, string, string]> = [
      ['colazione', 1, JSON.stringify(['Yogurt greco', 'Mirtilli', 'Fiocchi di avena', 'Miele']), '08:10'],
      ['pranzo', 0, '[]', '13:30'],
      ['cena', 0, '[]', '20:00'],
      ['spuntino', 0, '[]', '16:30'],
    ];
    for (const [key, done, foods, time] of todaySeed) {
      insertMeal.run(today, key, done, foods, time);
    }

    // A bit of history so the Premi tab (streak / week chart / badges) has
    // real data to compute from on first run, instead of showing all zeros.
    // Day -5 is deliberately left empty to show a broken streak in the chart.
    const history: Array<[number, string, string, string]> = [
      [1, 'colazione', JSON.stringify(['Uova', 'Avena', 'Mirtilli']), '07:55'],
      [1, 'pranzo', JSON.stringify(['Pollo', 'Quinoa', 'Broccoli']), '13:20'],
      [1, 'cena', JSON.stringify(['Salmone', 'Insalata']), '20:05'],
      [2, 'colazione', JSON.stringify(['Yogurt greco', 'Banana']), '08:00'],
      [2, 'pranzo', JSON.stringify(['Pizza', 'Patatine']), '13:40'],
      [3, 'colazione', JSON.stringify(['Fiocchi di avena', 'Mandorle']), '07:50'],
      [3, 'pranzo', JSON.stringify(['Lenticchie', 'Riso integrale']), '13:15'],
      [3, 'cena', JSON.stringify(['Tacchino', 'Zucchine']), '19:50'],
      [3, 'spuntino', JSON.stringify(['Mela', 'Noci']), '16:20'],
      [4, 'colazione', JSON.stringify(['Yogurt greco', 'Frutti di bosco']), '08:05'],
      [6, 'colazione', JSON.stringify(['Uova', 'Frutta']), '08:15'],
    ];
    for (const [daysAgo, key, foods, time] of history) {
      insertMeal.run(isoDaysAgo(daysAgo), key, 1, foods, time);
    }
  }

  const patientRow = db.prepare('SELECT id FROM patients LIMIT 1').get();
  if (!patientRow) {
    const insertPatient = db.prepare(
      `INSERT INTO patients (id, name, initials, plan, adherence, tone, streak, last_meal_summary, last_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertPatientMeal = db.prepare(
      'INSERT INTO patient_meals (patient_id, meal_key, time, foods) VALUES (?, ?, ?, ?)'
    );

    const patients = [
      {
        id: 'giulia-ferrari', name: 'Giulia Ferrari', initials: 'GF', plan: 'Metodo Nemis · 16:8',
        adherence: '92%', tone: 'good', streak: 21, lastSummary: 'Pranzo · Salmone, quinoa, spinaci', lastTime: '13:42',
        log: [
          { key: 'colazione', time: '08:05', foods: ['Yogurt greco', 'Mirtilli', 'Avena'] },
          { key: 'pranzo', time: '13:42', foods: ['Salmone', 'Quinoa', 'Spinaci'] },
        ],
      },
      {
        id: 'marco-bianchi', name: 'Marco Bianchi', initials: 'MB', plan: 'Metodo Nemis · standard',
        adherence: '61%', tone: 'ok', streak: 6, lastSummary: 'Cena · Pizza, birra', lastTime: '20:15',
        log: [
          { key: 'pranzo', time: '13:10', foods: ['Pollo', 'Insalata'] },
          { key: 'cena', time: '20:15', foods: ['Pizza', 'Birra'] },
        ],
      },
      {
        id: 'elena-russo', name: 'Elena Russo', initials: 'ER', plan: 'Metodo Nemis · Flobutir',
        adherence: '78%', tone: 'good', streak: 14, lastSummary: 'Spuntino · Mandorle', lastTime: '16:30',
        log: [
          { key: 'colazione', time: '07:50', foods: ['Uova', 'Frutta secca'] },
          { key: 'spuntino', time: '16:30', foods: ['Mandorle', 'Mela'] },
        ],
      },
      {
        id: 'luca-conti', name: 'Luca Conti', initials: 'LC', plan: 'Metodo Nemis · standard',
        adherence: '44%', tone: 'bad', streak: 0, lastSummary: 'Non registra da 2 giorni', lastTime: '—',
        log: [] as Array<{ key: string; time: string; foods: string[] }>,
      },
    ];

    for (const p of patients) {
      insertPatient.run(p.id, p.name, p.initials, p.plan, p.adherence, p.tone, p.streak, p.lastSummary, p.lastTime);
      for (const l of p.log) {
        insertPatientMeal.run(p.id, l.key, l.time, JSON.stringify(l.foods));
      }
    }
  }
}

seedIfEmpty();
