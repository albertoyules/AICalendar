/**
 * El navegador llama aquí al pulsar "Seguir" cuando el pomodoro está
 * esperando confirmación (una fase acabó, la siguiente no arranca sola —
 * ver api/qstash/recordatorioPomodoro.js). Arranca la cuenta atrás de la
 * fase que tocaba y programa su aviso en QStash.
 */
import admin from 'firebase-admin';

import { firebaseAdmin, uidDesdeToken } from '../_admin.js';
import { qstash, urlBase } from '../_qstash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { idToken } = req.body ?? {};
  if (!idToken) return res.status(400).json({ error: 'Falta idToken.' });

  let uid;
  try {
    uid = await uidDesdeToken(idToken);
  } catch (error) {
    console.error('[pomodoro/continuar] token:', error);
    return res.status(401).json({ error: 'Sesión no válida.' });
  }

  try {
    firebaseAdmin();
    const refPomodoro = admin.firestore().collection('usuarios').doc(uid).collection('pomodoro').doc('actual');
    const snap = await refPomodoro.get();
    if (!snap.exists || !snap.data().esperando) {
      return res.status(200).json({ ok: true, omitido: 'no hay nada esperando' });
    }

    const estado = snap.data();
    const minutos = estado.fase === 'trabajo' ? estado.minutosTrabajo : estado.minutosDescanso;
    const finEn = Date.now() + minutos * 60_000;

    const destino = `${urlBase()}/api/qstash/recordatorioPomodoro?uid=${encodeURIComponent(uid)}&finEn=${finEn}`;
    const { messageId } = await qstash().publish({ url: destino, notBefore: Math.floor(finEn / 1000) });

    await refPomodoro.set({ esperando: false, finEn, qstashId: messageId }, { merge: true });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[pomodoro/continuar]', error);
    res.status(500).json({ error: error.message ?? 'No se ha podido continuar el pomodoro.' });
  }
}
