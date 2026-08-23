/**
 * A donde llama QStash a la hora exacta de un recordatorio único.
 *
 * Igual que qstash/recordatorioEvento.js: sin cuerpo, firma verificada, se
 * relee el recordatorio tal cual esté en Firestore ahora. Al mandar el aviso
 * se marca `hecho: true` — no se borra solo, el usuario decide cuándo
 * quitarlo de la lista; es justo la diferencia con el semanal, que sigue
 * sonando hasta que se borra a mano.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';
import { enviarATodosLosDispositivos, reclamarAviso } from '../_avisos.js';
import { receptorQstash, urlBase } from '../_qstash.js';

export default async function handler(req, res) {
  const firma = req.headers['upstash-signature'];
  if (!firma) return res.status(401).json({ error: 'Falta la firma de QStash.' });

  try {
    const valida = await receptorQstash().verify({ signature: firma, body: '', url: `${urlBase()}${req.url}` });
    if (!valida) return res.status(401).json({ error: 'Firma inválida.' });
  } catch (error) {
    console.error('[qstash/recordatorioUnico] firma:', error);
    return res.status(401).json({ error: 'No se ha podido verificar la firma.' });
  }

  const { uid, recordatorioId } = req.query ?? {};
  if (!uid || !recordatorioId) return res.status(400).json({ error: 'Faltan uid o recordatorioId.' });

  try {
    firebaseAdmin();
    const refUsuario = admin.firestore().collection('usuarios').doc(uid);
    const refRecordatorio = refUsuario.collection('recordatorios').doc(recordatorioId);
    const snap = await refRecordatorio.get();
    const recordatorio = snap.data();

    // Se pudo borrar, marcar como hecho a mano, o reprogramar (cambia
    // recordatorioIdQstash) después de encolar este mensaje: no es un error,
    // ya no hay nada que avisar.
    if (!snap.exists || recordatorio.tipo !== 'unico' || recordatorio.hecho) {
      return res.status(200).json({ ok: true, omitido: 'recordatorio ya no existe, ya está hecho o ya no es único' });
    }

    // Reclamo por mensaje, no por recordatorio: así reprogramar el aviso (que
    // cancela el mensaje viejo y crea uno nuevo) deja sitio para un aviso de
    // verdad, sin arrastrar el candado del anterior.
    const reclamado = await reclamarAviso(refRecordatorio.collection('avisos').doc(recordatorio.recordatorioIdQstash ?? recordatorioId));
    if (!reclamado) {
      return res.status(200).json({ ok: true, omitido: 'ya se avisó de este recordatorio' });
    }

    const { enviados, fallos } = await enviarATodosLosDispositivos(refUsuario, {
      titulo: 'Recordatorio',
      cuerpo: recordatorio.texto,
      tipo: 'recordatorio',
    });
    await refRecordatorio.set({ hecho: true }, { merge: true });
    res.status(200).json({ ok: true, enviados, fallos });
  } catch (error) {
    console.error('[qstash/recordatorioUnico]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
