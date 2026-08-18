import express from 'express';
import cors from 'cors';
import './db.js';
import { stateRouter } from './routes/state.js';
import { patientsRouter } from './routes/patients.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4001);

app.use(cors());
app.use(express.json());

app.use('/api', stateRouter);
app.use('/api', patientsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Diario Nemis API listening on http://localhost:${PORT}`);
});
