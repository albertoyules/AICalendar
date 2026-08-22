/**
 * A donde llama QStash al acabar cada fase del pomodoro.
 *
 * No encadena solo: al acabar una fase, manda el aviso y deja el pomodoro
 * "esperando" (fase y ronda ya avanzadas, pero sin cuenta atrás corriendo) —
 * hace falta que alguien pulse "seguir" en la app para arrancar la
 * siguiente fase (api/pomodoro/continuar.js). Así el descanso no se activa
 * solo mientras sigues currando a medias de la tarea.
 *
 * `finEn` va en la URL para dos cosas: además de servir de clave del
 * candado anti-duplicados, permite comprobar que este disparo sigue siendo
 * el "vigente" — si mientras tanto se paró o se reprogramó el pomodoro
 * desde la app, el finEn guardado en Firestore ya no coincidirá y esta
 * llamada se descarta sin mandar nada.
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

    const siguienteFase = estado.fase === 'trabajo' ? 'descanso' : 'trabajo';
    const siguienteRonda = estado.fase === 'descanso' ? estado.ronda + 1 : estado.ronda;

    const mensaje =
      siguienteFase === 'descanso'
        ? { titulo: 'Descanso', cuerpo: `Toca descansar ${estado.minutosDescanso} min. Sigue cuando quieras.` }
        : { titulo: 'Descanso terminado', cuerpo: `Ronda ${siguienteRonda} de ${estado.rondas} cuando estés listo.` };

    await enviarATodosLosDispositivos(refUsuario, { ...mensaje, tipo: 'pomodoro' });

    // Esperando confirmación: sin finEn ni qstashId, no hay cuenta atrás
    // corriendo hasta que se llame a api/pomodoro/continuar.js.
    await refPomodoro.set(
      { fase: siguienteFase, ronda: siguienteRonda, esperando: true, finEn: null, qstashId: null },
      { merge: true },
    );
    res.status(200).json({ ok: true, esperando: true });
  } catch (error) {
    console.error('[qstash/recordatorioPomodoro]', error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
