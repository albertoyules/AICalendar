/**
 * A donde llama QStash a la hora exacta del "avísame X antes" de un evento.
 *
 * Igual que qstash/recordatorio.js (hábitos): sin cuerpo, toda la
 * identificación en la URL, firma verificada, y se relee el evento tal cual
 * esté en Firestore ahora — así si lo editaste después de programar el
 * aviso, el mensaje habla del evento actual, no de uno guardado hace días.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';
import { enviarATodosLosDispositivos } from '../_avisos.js';
import { receptorQstash, urlBase } from '../_qstash.js';

function textoCuanto(minutos) {
  if (minutos >= 1440 && minutos % 1440 === 0) {
    const dias = minutos / 1440;
    return dias === 1 ? 'mañana' : `en ${dias} días`;
  }
  if (minutos >= 60 && minutos % 60 === 0) {
    const horas = minutos / 60;
    return horas === 1 ? 'en 1 hora' : `en ${horas} horas`;
  }
  return `en ${minutos} min`;
}

export default async function handler(req, res) {
  const firma = req.headers['upstash-signature'];
  if (!firma) return res.status(401).json({ error: 'Falta la firma de QStash.' });

  try {
    const valida = await receptorQstash().verify({ signature: firma, body: '', url: `${urlBase()}${req.url}` });
    if (!valida) return res.status(401).json({ error: 'Firma inválida.' });
  } catch (error) {
    console.error('[qstash/recordatorioEvento] firma:', error);
    return res.status(401).json({ error: 'No se ha podido verificar la firma.' });
  }

  const { uid, eventoId } = req.query ?? {};
  if (!uid || !eventoId) return res.status(400).json({ error: 'Faltan uid o eventoId.' });

  try {
    firebaseAdmin();
    const refUsuario = admin.firestore().collection('usuarios').doc(uid);
    const refEvento = refUsuario.collection('eventos').doc(eventoId);
    const snap = await refEvento.get();
    const evento = snap.data();

    // El evento se pudo borrar, o se apagó/reprogramó el aviso después de
    // encolar este mensaje: no es un error, ya no hay nada que avisar.
    if (!snap.exists || !evento.recordatorioMinutosAntes) {
      return res.status(200).json({ ok: true, omitido: 'evento ya no existe o sin aviso activo' });
    }
    // Mismo candado que los hábitos, para un reintento de QStash que caiga
    // sobre un aviso que ya se mandó.
    if (evento.recordatorioEnviado) {
      return res.status(200).json({ ok: true, omitido: 'ya se avisó de este evento' });
    }

    const cuerpo = evento.nota
      ? `${textoCuanto(evento.recordatorioMinutosAntes)}: ${evento.titulo} — ${evento.nota}`
      : `${textoCuanto(evento.recordatorioMinutosAntes)}: ${evento.titulo}`;

    const { enviados, fallos } = await enviarATodosLosDispositivos(refUsuario, {
      titulo: 'Recordatorio',
      cuerpo,
      tipo: 'evento',
    });
    if (enviados > 0) await refEvento.set({ recordatorioEnviado: true }, { merge: true });
    res.status(200).json({ ok: true, enviados, fallos });
  } catch (error) {
    console.error('[qstash/recordatorioEvento]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
