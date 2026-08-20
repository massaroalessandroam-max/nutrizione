import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stateRouter } from './routes/state.js';
import { patientsRouter } from './routes/patients.js';
import { onboardingRouter } from './routes/onboarding.js';
import { planRouter } from './routes/plan.js';
import { mealPhotoRouter } from './routes/mealPhoto.js';
import { reportRouter } from './routes/report.js';
import { supplementsRouter } from './routes/supplements.js';
import { chefRouter } from './routes/chef.js';
import { initDb, isRemoteDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDist = path.join(__dirname, '..', '..', 'app', 'dist');

const app = express();
const PORT = Number(process.env.PORT ?? 4001);

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.use('/api', stateRouter);
app.use('/api', patientsRouter);
app.use('/api', onboardingRouter);
app.use('/api', planRouter);
app.use('/api', mealPhotoRouter);
app.use('/api', reportRouter);
app.use('/api', supplementsRouter);
app.use('/api', chefRouter);

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

// Il piano free di Render mette in standby il servizio dopo ~15 minuti di
// inattività: un self-ping periodico all'health endpoint lo tiene sveglio.
// RENDER_EXTERNAL_URL è impostata automaticamente da Render, quindi in
// locale questo blocco non fa nulla.
function startKeepAlive() {
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (!externalUrl) return;
  setInterval(() => {
    fetch(`${externalUrl}/api/health`).catch((e) => {
      console.error('[keep-alive] ping fallito:', (e as Error).message);
    });
  }, 10 * 60_000).unref();
}

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
      startKeepAlive();
    });
  })
  .catch((e) => {
    console.error('Inizializzazione database fallita:', (e as Error).message);
    process.exit(1);
  });
