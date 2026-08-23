/**
 * El navegador llama aquí al crear, editar o borrar un recordatorio, para dar
 * de alta (o retirar) su aviso en QStash. Combina los dos mecanismos que ya
 * existen para hábitos y eventos, según el tipo:
 *
 *   'semanal' — igual que un hábito: un *schedule* recurrente con id
 *               determinista, con la lista de días en el propio cron.
 *   'unico'   — igual que un evento: un mensaje suelto, con el límite de 7
 *               días del plan gratuito (api/cron/encolarRecordatorios.js
 *               recoge los que caen más lejos).
 *
 * El uid nunca se fía del cuerpo de la petición: se verifica el idToken de
 * Firebase que manda el cliente y se usa el uid que sale de ahí.
 */
import admin from 'firebase-admin';

import { firebaseAdmin, uidDesdeToken } from '../_admin.js';
import { instanteMadrid } from '../cron/_comun.js';
import { MAX_ADELANTO_SEGUNDOS, diaCron, idScheduleRecordatorio, qstash, urlBase } from '../_qstash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { idToken, recordatorioId, borrar, tipo, fecha, dias, hora } = req.body ?? {};
  if (!idToken || !recordatorioId) return res.status(400).json({ error: 'Faltan idToken o recordatorioId.' });

  let uid;
  try {
    uid = await uidDesdeToken(idToken);
  } catch (error) {
    console.error('[recordatorios/programar] token:', error);
    return res.status(401).json({ error: 'Sesión no válida.' });
  }

  try {
    firebaseAdmin();
    const refRecordatorio = admin.firestore().collection('usuarios').doc(uid).collection('recordatorios').doc(recordatorioId);
    const snap = await refRecordatorio.get();
    const anterior = snap.exists ? snap.data() : null;

    // Lo que hubiera antes ya no vale, sea cual sea el tipo nuevo: se limpia
    // siempre antes de decidir qué hacer con lo que llega.
    await qstash().schedules.delete(idScheduleRecordatorio(uid, recordatorioId)).catch(() => {});
    if (anterior?.recordatorioIdQstash) {
      await qstash().messages.cancel(anterior.recordatorioIdQstash).catch(() => {});
    }

    if (borrar || !tipo || !hora) {
      return res.status(200).json({ ok: true, aviso: null });
    }

    if (tipo === 'semanal') {
      if (!Array.isArray(dias) || dias.length === 0) return res.status(200).json({ ok: true, aviso: null });

      const [horaN, minutoN] = hora.split(':').map(Number);
      const diasCron = dias.map(diaCron).join(',');
      const scheduleId = idScheduleRecordatorio(uid, recordatorioId);
      const destino = `${urlBase()}/api/qstash/recordatorioSemanal?uid=${encodeURIComponent(uid)}&recordatorioId=${encodeURIComponent(recordatorioId)}`;

      await qstash().schedules.create({
        scheduleId,
        destination: destino,
        cron: `CRON_TZ=Europe/Madrid ${minutoN} ${horaN} * * ${diasCron}`,
      });
      return res.status(200).json({ ok: true, aviso: scheduleId });
    }

    // tipo === 'unico'
    if (!fecha) return res.status(200).json({ ok: true, aviso: null });

    const objetivoMs = instanteMadrid(`${fecha}T${hora}`);
    const faltanSegundos = Math.floor((objetivoMs - Date.now()) / 1000);

    if (faltanSegundos <= 0) {
      return res.status(200).json({ ok: true, omitido: 'la hora del recordatorio ya ha pasado' });
    }
    if (faltanSegundos > MAX_ADELANTO_SEGUNDOS) {
      // Demasiado lejos para el plan gratuito: el cron diario lo recoge en
      // cuanto entre en la ventana de 7 días.
      return res.status(200).json({ ok: true, pendiente: true });
    }

    const destino = `${urlBase()}/api/qstash/recordatorioUnico?uid=${encodeURIComponent(uid)}&recordatorioId=${encodeURIComponent(recordatorioId)}`;
    const { messageId } = await qstash().publish({ url: destino, notBefore: Math.floor(objetivoMs / 1000) });
    await refRecordatorio.set({ recordatorioIdQstash: messageId }, { merge: true });
    res.status(200).json({ ok: true, aviso: messageId });
  } catch (error) {
    console.error('[recordatorios/programar]', error);
    res.status(500).json({ error: error.message ?? 'No se ha podido programar el aviso.' });
  }
}
