/**
 * El navegador llama aquí cuando se crea, edita o borra un hábito con aviso,
 * para dar de alta (o quitar) su schedule en QStash.
 *
 * El uid nunca se fía del cuerpo de la petición: se verifica el idToken de
 * Firebase que manda el cliente y se usa el uid que sale de ahí. Sin esto,
 * cualquiera podría registrar avisos a nombre de otro usuario con solo saber
 * su uid, que no es secreto pero tampoco algo que deba bastar para escribir
 * en su cuenta.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';
import { idScheduleHabito, qstash, urlBase } from '../_qstash.js';

async function uidDesdeToken(idToken) {
  firebaseAdmin();
  const decodificado = await admin.auth().verifyIdToken(idToken);
  return decodificado.uid;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { idToken, habitoId, horaAviso } = req.body ?? {};
  if (!idToken || !habitoId) return res.status(400).json({ error: 'Faltan idToken o habitoId.' });

  let uid;
  try {
    uid = await uidDesdeToken(idToken);
  } catch (error) {
    console.error('[habitos/recordatorio] token:', error);
    return res.status(401).json({ error: 'Sesión no válida.' });
  }

  const scheduleId = idScheduleHabito(uid, habitoId);

  try {
    if (!horaAviso) {
      // Sin hora, no hay aviso que mandar: si existía un schedule de antes
      // (se ha desactivado o borrado el hábito), se retira.
      await qstash().schedules.delete(scheduleId).catch(() => {});
      return res.status(200).json({ ok: true, schedule: null });
    }

    const [hora, minuto] = String(horaAviso).split(':');
    const destino = `${urlBase()}/api/qstash/recordatorio?uid=${encodeURIComponent(uid)}&habitoId=${encodeURIComponent(habitoId)}`;

    await qstash().schedules.create({
      scheduleId,
      destination: destino,
      cron: `CRON_TZ=Europe/Madrid ${Number(minuto)} ${Number(hora)} * * *`,
    });
    res.status(200).json({ ok: true, schedule: scheduleId });
  } catch (error) {
    console.error('[habitos/recordatorio] qstash:', error);
    res.status(500).json({ error: error.message ?? 'No se ha podido programar el aviso.' });
  }
}
