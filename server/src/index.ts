import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stateRouter } from './routes/state.js';
import { patientsRouter } from './routes/patients.js';
import { initDb, isRemoteDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDist = path.join(__dirname, '..', '..', 'app', 'dist');

const app = express();
const PORT = Number(process.env.PORT ?? 4001);

app.use(cors());
app.use(express.json());

app.use('/api', stateRouter);
app.use('/api', patientsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, remoteDb: isRemoteDb() }));

// Serve il frontend compilato (app/dist), così un solo servizio ospita sia
// il sito che le API — niente CORS/proxy da configurare in produzione.
app.use(express.static(appDist));
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(appDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// Ultima rete di sicurezza: se una route async lancia, Express 5 la inoltra
// qui invece di lasciare la richiesta senza risposta.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] errore non gestito:', err.message);
  res.status(500).json({ error: 'server_error', detail: err.message });
});

// Lo schema va pronto prima di accettare richieste: con un database remoto
// l'inizializzazione è una chiamata di rete.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Diario Nemis API in ascolto su http://localhost:${PORT}`);
      console.log(
        isRemoteDb()
          ? 'Database remoto (persistente tra i deploy) collegato.'
          : 'Database su file locale: i dati NON sopravvivono a un nuovo deploy. Imposta DATABASE_URL per la persistenza.'
      );
    });
  })
  .catch((e) => {
    console.error('Inizializzazione database fallita:', (e as Error).message);
    process.exit(1);
  });
