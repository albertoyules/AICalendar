/**
 * El cerebro en local.
 *
 * En producción esto no existe: Vercel publica api/chat.js como función. Aquí
 * solo hay un Express que llama exactamente al mismo código, para poder
 * trabajar sin desplegar. La lógica vive en api/_cerebro.js y no está duplicada.
 */
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { ErrorDeCerebro, MODELO, pensar } from '../../api/_cerebro.js';

const PUERTO = Number(process.env.PORT ?? 8787);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    '\nFalta ANTHROPIC_API_KEY.\n' +
      'Copia server/.env.example a server/.env y pega tu clave de Anthropic.\n',
  );
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 40, // de sobra para una persona; frena un bucle infinito del cliente
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/api/salud', (_req, res) => res.json({ ok: true, modelo: MODELO }));

app.post('/api/chat', async (req, res) => {
  try {
    res.json(await pensar(req.body ?? {}));
  } catch (error) {
    if (error instanceof ErrorDeCerebro) {
      return res.status(error.estado).json({ error: error.message, reintentable: error.reintentable });
    }
    console.error('[chat]', error);
    res.status(500).json({ error: 'Algo ha salido mal.', reintentable: false });
  }
});

app.listen(PUERTO, () => {
  console.log(`Cerebro escuchando en http://localhost:${PUERTO}  ·  modelo ${MODELO}`);
});
