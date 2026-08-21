/**
 * La función que atiende POST /api/chat en producción.
 *
 * Vercel publica cada fichero de api/ como una ruta. Todo el trabajo está en
 * _cerebro.js, que comparte con el servidor local: aquí solo se traduce de
 * petición HTTP a llamada y de vuelta.
 */
import { ErrorDeCerebro, MODELO, pensar } from './_cerebro.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, modelo: MODELO });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    res.status(200).json(await pensar(req.body ?? {}));
  } catch (error) {
    if (error instanceof ErrorDeCerebro) {
      return res.status(error.estado).json({ error: error.message, reintentable: error.reintentable });
    }
    console.error('[chat]', error);
    res.status(500).json({ error: 'Algo ha salido mal.', reintentable: false });
  }
}
