/**
 * A donde llama QStash al acabar cada fase del pomodoro. A diferencia de
 * hábitos (schedule recurrente) y eventos (un mensaje suelto), el pomodoro
 * encadena: cada vez que se dispara, manda el aviso de la fase que acaba Y
 * programa el siguiente mensaje para la fase que empieza — hasta que se
 * completan las rondas pedidas o alguien para el reloj desde la app.
 *
 * `finEn` va en la URL para dos cosas: además de identificar qué disparo es
 * (y servir de clave del candado anti-duplicados), permite comprobar que
 * sigue siendo el disparo "vigente" — si mientras tanto se paró o se
 * reprogramó el pomodoro, el finEn guardado en Firestore ya no coincidirá y
 * esta llamada se descarta sin mandar nada.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';
import { enviarATodosLosDispositivos, reclamarAviso } from '../_avisos.js';
import { qstash, receptorQstash, urlBase } from '../_qstash.js';

export default async function handler(req, res) {
  const firma = req.headers['upstash-signature'];
  if (!firma) return res.status(401).json({ error: 'Falta la firma de QStash.' });

  try {
    const valida = await receptorQstash().verify({ signature: firma, body: '', url: `${urlBase()}${req.url}` });
    if (!valida) return res.status(401).json({ error: 'Firma inválida.' });
  } catch (error) {
    console.error('[qstash/recordatorioPomodoro] firma:', error);
    return res.status(401).json({ error: 'No se ha podido verificar la firma.' });
  }

  const { uid, finEn } = req.query ?? {};
  if (!uid || !finEn) return res.status(400).json({ error: 'Faltan uid o finEn.' });

  try {
    firebaseAdmin();
    const refUsuario = admin.firestore().collection('usuarios').doc(uid);
    const refPomodoro = refUsuario.collection('pomodoro').doc('actual');
    const snap = await refPomodoro.get();
    const estado = snap.data();

    // Se paró, o se reprogramó (otro finEn) desde que se programó este aviso.
    if (!snap.exists || !estado.activo || String(estado.finEn) !== String(finEn)) {
      return res.status(200).json({ ok: true, omitido: 'pomodoro parado o reprogramado' });
    }

    const reclamado = await reclamarAviso(refPomodoro.collection('avisos').doc(String(finEn)));
    if (!reclamado) {
      return res.status(200).json({ ok: true, omitido: 'este aviso ya se mandó' });
    }

    if (estado.fase === 'trabajo' && estado.ronda >= estado.rondas) {
      await enviarATodosLosDispositivos(refUsuario, {
        titulo: 'Pomodoro completo',
        cuerpo: `${estado.rondas} ${estado.rondas === 1 ? 'ronda hecha' : 'rondas hechas'}. Buen trabajo.`,
        tipo: 'pomodoro',
      });
      await refPomodoro.set({ activo: false }, { merge: true });
      return res.status(200).json({ ok: true, terminado: true });
    }

    const siguiente =
      estado.fase === 'trabajo'
        ? { fase: 'descanso', ronda: estado.ronda, finEn: Date.now() + estado.minutosDescanso * 60_000 }
        : { fase: 'trabajo', ronda: estado.ronda + 1, finEn: Date.now() + estado.minutosTrabajo * 60_000 };

    const mensaje =
      siguiente.fase === 'descanso'
        ? { titulo: 'Descanso', cuerpo: `Toca descansar ${estado.minutosDescanso} min.` }
        : { titulo: 'A trabajar', cuerpo: `Ronda ${siguiente.ronda} de ${estado.rondas}.` };

    await enviarATodosLosDispositivos(refUsuario, { ...mensaje, tipo: 'pomodoro' });

    const destino = `${urlBase()}/api/qstash/recordatorioPomodoro?uid=${encodeURIComponent(uid)}&finEn=${siguiente.finEn}`;
    const { messageId } = await qstash().publish({ url: destino, notBefore: Math.floor(siguiente.finEn / 1000) });

    await refPomodoro.set({ ...siguiente, qstashId: messageId }, { merge: true });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[qstash/recordatorioPomodoro]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
