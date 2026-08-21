/**
 * A donde llama QStash a la hora exacta de cada hábito.
 *
 * No lleva cuerpo: toda la identificación va en la URL (uid + habitoId), así
 * que aquí solo se comprueba la firma y se lee el hábito tal cual esté en
 * Firestore ahora mismo — si cambió de nombre desde que se creó el aviso, se
 * manda el nombre actual, no uno guardado hace semanas en la cola.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';
import { enviarATodosLosDispositivos } from '../_avisos.js';
import { receptorQstash, urlBase } from '../_qstash.js';
import { hoyMadrid } from '../cron/_comun.js';

export default async function handler(req, res) {
  const firma = req.headers['upstash-signature'];
  if (!firma) return res.status(401).json({ error: 'Falta la firma de QStash.' });

  try {
    const valida = await receptorQstash().verify({ signature: firma, body: '', url: `${urlBase()}${req.url}` });
    if (!valida) return res.status(401).json({ error: 'Firma inválida.' });
  } catch (error) {
    console.error('[qstash/recordatorio] firma:', error);
    return res.status(401).json({ error: 'No se ha podido verificar la firma.' });
  }

  const { uid, habitoId } = req.query ?? {};
  if (!uid || !habitoId) return res.status(400).json({ error: 'Faltan uid o habitoId.' });

  try {
    firebaseAdmin();
    const refUsuario = admin.firestore().collection('usuarios').doc(uid);
    const refHabito = refUsuario.collection('habitos').doc(habitoId);
    const habitoSnap = await refHabito.get();

    // El hábito se pudo borrar o desactivar el aviso después de programarlo:
    // no es un error, solo ya no hay nada que avisar.
    if (!habitoSnap.exists || !habitoSnap.data().horaAviso) {
      return res.status(200).json({ ok: true, omitido: 'hábito ya no existe o sin aviso activo' });
    }

    // QStash reintenta (hasta 5 veces por defecto) si esta función no
    // responde a tiempo — algo fácil en un arranque en frío, aunque el push
    // ya se haya mandado antes de que Vercel corte la función. Sin este
    // candado, cada reintento manda el mismo aviso otra vez.
    const hoy = hoyMadrid();
    if (habitoSnap.data().ultimoAvisoEnviado === hoy) {
      return res.status(200).json({ ok: true, omitido: 'ya se avisó hoy' });
    }

    const { enviados, fallos } = await enviarATodosLosDispositivos(refUsuario, {
      titulo: 'Hábito',
      cuerpo: `No olvides: ${habitoSnap.data().nombre}`,
      tipo: 'habito',
    });
    if (enviados > 0) await refHabito.set({ ultimoAvisoEnviado: hoy }, { merge: true });
    res.status(200).json({ ok: true, enviados, fallos });
  } catch (error) {
    console.error('[qstash/recordatorio]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
