/**
 * El navegador llama aquí al pulsar "Empezar" en el pomodoro. A partir de
 * aquí el reloj vive en el servidor (Firestore + un mensaje de QStash por
 * cada cambio de fase), así que sigue avisando aunque cierres la app —
 * antes solo era un timer del navegador, y por eso no llegaba nada con el
 * móvil bloqueado o la pestaña cerrada.
 */
import admin from 'firebase-admin';

import { firebaseAdmin, uidDesdeToken } from '../_admin.js';
import { qstash, urlBase } from '../_qstash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { idToken, minutosTrabajo, minutosDescanso, rondas } = req.body ?? {};
  if (!idToken) return res.status(400).json({ error: 'Falta idToken.' });

  const trabajo = Math.min(180, Math.max(1, Number(minutosTrabajo) || 25));
  const descanso = Math.min(180, Math.max(1, Number(minutosDescanso) || 5));
  const total = Math.min(20, Math.max(1, Number(rondas) || 4));

  let uid;
  try {
    uid = await uidDesdeToken(idToken);
  } catch (error) {
    console.error('[pomodoro/iniciar] token:', error);
    return res.status(401).json({ error: 'Sesión no válida.' });
  }

  try {
    firebaseAdmin();
    const refPomodoro = admin.firestore().collection('usuarios').doc(uid).collection('pomodoro').doc('actual');

    // Si ya había un pomodoro corriendo, su próximo aviso queda huérfano en
    // cuanto lo sustituimos por este — se cancela antes de programar el nuevo.
    const anterior = await refPomodoro.get();
    if (anterior.exists && anterior.data().qstashId) {
      await qstash().messages.cancel(anterior.data().qstashId).catch(() => {});
    }

    const finEn = Date.now() + trabajo * 60_000;
    const destino = `${urlBase()}/api/qstash/recordatorioPomodoro?uid=${encodeURIComponent(uid)}&finEn=${finEn}`;
    const { messageId } = await qstash().publish({ url: destino, notBefore: Math.floor(finEn / 1000) });

    await refPomodoro.set({
      activo: true,
      fase: 'trabajo',
      ronda: 1,
      rondas: total,
      minutosTrabajo: trabajo,
      minutosDescanso: descanso,
      esperando: false,
      finEn,
      qstashId: messageId,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[pomodoro/iniciar]', error);
    res.status(500).json({ error: error.message ?? 'No se ha podido arrancar el pomodoro.' });
  }
}
