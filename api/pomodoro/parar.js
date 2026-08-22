/**
 * El navegador llama aquí al pulsar "Parar". Cancela el próximo aviso en
 * QStash y marca el pomodoro como inactivo — sin esto, el aviso ya
 * programado llegaría igual aunque hubieras parado el reloj en la app.
 */
import admin from 'firebase-admin';

import { firebaseAdmin, uidDesdeToken } from '../_admin.js';
import { qstash } from '../_qstash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { idToken } = req.body ?? {};
  if (!idToken) return res.status(400).json({ error: 'Falta idToken.' });

  let uid;
  try {
    uid = await uidDesdeToken(idToken);
  } catch (error) {
    console.error('[pomodoro/parar] token:', error);
    return res.status(401).json({ error: 'Sesión no válida.' });
  }

  try {
    firebaseAdmin();
    const refPomodoro = admin.firestore().collection('usuarios').doc(uid).collection('pomodoro').doc('actual');
    const snap = await refPomodoro.get();
    if (snap.exists && snap.data().qstashId) {
      await qstash().messages.cancel(snap.data().qstashId).catch(() => {});
    }
    await refPomodoro.set({ activo: false }, { merge: true });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[pomodoro/parar]', error);
    res.status(500).json({ error: error.message ?? 'No se ha podido parar el pomodoro.' });
  }
}
