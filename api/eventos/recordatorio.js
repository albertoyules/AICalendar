/**
 * El navegador llama aquí al crear, editar o borrar un evento con "avísame
 * antes", para dar de alta (o cancelar) el mensaje suelto en QStash.
 *
 * A diferencia del recordatorio de hábito (que es un *schedule* recurrente),
 * esto es un mensaje de una sola vez — el plan gratuito de QStash solo admite
 * programarlo hasta 7 días vista. Si el evento cae más lejos, aquí no se hace
 * nada: api/cron/encolarRecordatorios.js lo recogerá el día que entre dentro
 * de esa ventana.
 *
 * Mismo cuidado que en habitos/recordatorio.js: el uid sale del idToken
 * verificado, nunca de lo que mande el cliente.
 */
import admin from 'firebase-admin';

import { firebaseAdmin, uidDesdeToken } from '../_admin.js';
import { instanteMadrid } from '../cron/_comun.js';
import { MAX_ADELANTO_SEGUNDOS, qstash, urlBase } from '../_qstash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { idToken, eventoId, inicio, recordatorioMinutosAntes } = req.body ?? {};
  if (!idToken || !eventoId) return res.status(400).json({ error: 'Faltan idToken o eventoId.' });

  let uid;
  try {
    uid = await uidDesdeToken(idToken);
  } catch (error) {
    console.error('[eventos/recordatorio] token:', error);
    return res.status(401).json({ error: 'Sesión no válida.' });
  }

  try {
    firebaseAdmin();
    const refEvento = admin.firestore().collection('usuarios').doc(uid).collection('eventos').doc(eventoId);
    const snap = await refEvento.get();
    const anteriorId = snap.exists ? snap.data().recordatorioIdQstash : null;

    // Tanto si se apaga el aviso como si se reprograma (cambió la hora o el
    // "cuánto antes"), lo que hubiera antes ya no vale — se cancela siempre
    // antes de decidir qué hacer con lo nuevo.
    if (anteriorId) {
      await qstash().messages.cancel(anteriorId).catch(() => {});
    }

    if (!recordatorioMinutosAntes || !inicio) {
      await refEvento.set({ recordatorioIdQstash: null }, { merge: true });
      return res.status(200).json({ ok: true, mensaje: null });
    }

    const objetivoMs = instanteMadrid(inicio) - recordatorioMinutosAntes * 60_000;
    const faltanSegundos = Math.floor((objetivoMs - Date.now()) / 1000);

    if (faltanSegundos <= 0) {
      await refEvento.set({ recordatorioIdQstash: null }, { merge: true });
      return res.status(200).json({ ok: true, omitido: 'la hora del aviso ya ha pasado' });
    }

    if (faltanSegundos > MAX_ADELANTO_SEGUNDOS) {
      // Demasiado lejos para el plan gratuito: se deja sin id, y el cron
      // diario lo programa de verdad en cuanto entre en la ventana.
      await refEvento.set({ recordatorioIdQstash: null }, { merge: true });
      return res.status(200).json({ ok: true, pendiente: true });
    }

    const destino = `${urlBase()}/api/qstash/recordatorioEvento?uid=${encodeURIComponent(uid)}&eventoId=${encodeURIComponent(eventoId)}`;
    const { messageId } = await qstash().publish({ url: destino, notBefore: Math.floor(objetivoMs / 1000) });
    await refEvento.set({ recordatorioIdQstash: messageId }, { merge: true });
    res.status(200).json({ ok: true, mensaje: messageId });
  } catch (error) {
    console.error('[eventos/recordatorio]', error);
    res.status(500).json({ error: error.message ?? 'No se ha podido programar el aviso.' });
  }
}
