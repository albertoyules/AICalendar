/**
 * A donde llama QStash a la hora exacta de un recordatorio semanal.
 *
 * Igual que qstash/recordatorio.js (hábitos): sin cuerpo, toda la
 * identificación en la URL, firma verificada, y se relee el recordatorio tal
 * cual esté en Firestore ahora — así si le cambiaste el texto después de
 * programar el aviso, llega el texto actual.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';
import { enviarATodosLosDispositivos, reclamarAviso } from '../_avisos.js';
import { receptorQstash, urlBase } from '../_qstash.js';
import { hoyMadrid } from '../cron/_comun.js';

export default async function handler(req, res) {
  const firma = req.headers['upstash-signature'];
  if (!firma) return res.status(401).json({ error: 'Falta la firma de QStash.' });

  try {
    const valida = await receptorQstash().verify({ signature: firma, body: '', url: `${urlBase()}${req.url}` });
    if (!valida) return res.status(401).json({ error: 'Firma inválida.' });
  } catch (error) {
    console.error('[qstash/recordatorioSemanal] firma:', error);
    return res.status(401).json({ error: 'No se ha podido verificar la firma.' });
  }

  const { uid, recordatorioId } = req.query ?? {};
  if (!uid || !recordatorioId) return res.status(400).json({ error: 'Faltan uid o recordatorioId.' });

  try {
    firebaseAdmin();
    const refUsuario = admin.firestore().collection('usuarios').doc(uid);
    const refRecordatorio = refUsuario.collection('recordatorios').doc(recordatorioId);
    const snap = await refRecordatorio.get();

    // El recordatorio se pudo borrar o cambiar a "único" después de
    // programar este aviso: no es un error, solo ya no hay nada que avisar.
    if (!snap.exists || snap.data().tipo !== 'semanal') {
      return res.status(200).json({ ok: true, omitido: 'recordatorio ya no existe o ya no es semanal' });
    }

    // Misma carrera que los hábitos: QStash puede invocar esto más de una vez
    // casi a la vez, así que se reclama el día antes de mandar nada.
    const hoy = hoyMadrid();
    const reclamado = await reclamarAviso(refRecordatorio.collection('avisos').doc(hoy));
    if (!reclamado) {
      return res.status(200).json({ ok: true, omitido: 'ya se avisó hoy' });
    }

    const { enviados, fallos } = await enviarATodosLosDispositivos(refUsuario, {
      titulo: 'Recordatorio',
      cuerpo: snap.data().texto,
      tipo: 'recordatorio',
    });
    res.status(200).json({ ok: true, enviados, fallos });
  } catch (error) {
    console.error('[qstash/recordatorioSemanal]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
