/**
 * A donde llama QStash a la hora exacta de un aviso programado, sea del tipo
 * que sea: hábito, evento, pomodoro, o recordatorio (semanal o único).
 *
 * Un único fichero para los cinco, y no por gusto: el plan Hobby de Vercel
 * limita a 12 Serverless Functions por despliegue, y tenerlos como cinco
 * ficheros sueltos (más los de alta, más chat/salud/crons) lo superaba —
 * el build falló en seco con "No more than 12 Serverless Functions" al
 * añadir los recordatorios, que fueron la gota que colmó el vaso.
 * `[tipo]` es una ruta dinámica: cada aviso se sigue programando contra la
 * misma URL de siempre (`/api/qstash/recordatorio`, `/api/qstash/recordatorioEvento`,
 * etc. — nada cambia en quien programa el aviso), pero las cinco caen aquí y
 * `req.query.tipo` dice cuál tocaba.
 *
 * Firma verificada una sola vez, al principio, para las cinco — el resto es
 * el mismo cuerpo que tenía cada fichero por separado antes de fusionarse.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';
import { enviarATodosLosDispositivos, reclamarAviso } from '../_avisos.js';
import { receptorQstash, urlBase } from '../_qstash.js';
import { hoyMadrid } from '../cron/_comun.js';

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

/** Hábito: recordatorio diario a hora exacta. */
async function avisoHabito(req, res) {
  const { uid, habitoId } = req.query ?? {};
  if (!uid || !habitoId) return res.status(400).json({ error: 'Faltan uid o habitoId.' });

  const refUsuario = admin.firestore().collection('usuarios').doc(uid);
  const refHabito = refUsuario.collection('habitos').doc(habitoId);
  const snap = await refHabito.get();

  if (!snap.exists || !snap.data().horaAviso) {
    return res.status(200).json({ ok: true, omitido: 'hábito ya no existe o sin aviso activo' });
  }

  const hoy = hoyMadrid();
  const reclamado = await reclamarAviso(refHabito.collection('avisos').doc(hoy));
  if (!reclamado) return res.status(200).json({ ok: true, omitido: 'ya se avisó hoy' });

  const { enviados, fallos } = await enviarATodosLosDispositivos(refUsuario, {
    titulo: 'Hábito',
    cuerpo: `No olvides: ${snap.data().nombre}`,
    tipo: 'habito',
  });
  return res.status(200).json({ ok: true, enviados, fallos });
}

/** Evento: aviso suelto "X antes", con nota opcional. */
async function avisoEvento(req, res) {
  const { uid, eventoId } = req.query ?? {};
  if (!uid || !eventoId) return res.status(400).json({ error: 'Faltan uid o eventoId.' });

  const refUsuario = admin.firestore().collection('usuarios').doc(uid);
  const refEvento = refUsuario.collection('eventos').doc(eventoId);
  const snap = await refEvento.get();
  const evento = snap.data();

  if (!snap.exists || !evento.recordatorioMinutosAntes) {
    return res.status(200).json({ ok: true, omitido: 'evento ya no existe o sin aviso activo' });
  }

  const reclamado = await reclamarAviso(refEvento.collection('avisos').doc(evento.recordatorioIdQstash));
  if (!reclamado) return res.status(200).json({ ok: true, omitido: 'ya se avisó de este evento' });

  const cuerpo = evento.nota
    ? `${textoCuanto(evento.recordatorioMinutosAntes)}: ${evento.titulo} — ${evento.nota}`
    : `${textoCuanto(evento.recordatorioMinutosAntes)}: ${evento.titulo}`;

  const { enviados, fallos } = await enviarATodosLosDispositivos(refUsuario, { titulo: 'Recordatorio', cuerpo, tipo: 'evento' });
  return res.status(200).json({ ok: true, enviados, fallos });
}

/** Pomodoro: fin de fase. No encadena solo, deja el pomodoro "esperando". */
async function avisoPomodoro(req, res) {
  const { uid, finEn } = req.query ?? {};
  if (!uid || !finEn) return res.status(400).json({ error: 'Faltan uid o finEn.' });

  const refUsuario = admin.firestore().collection('usuarios').doc(uid);
  const refPomodoro = refUsuario.collection('pomodoro').doc('actual');
  const snap = await refPomodoro.get();
  const estado = snap.data();

  if (!snap.exists || !estado.activo || String(estado.finEn) !== String(finEn)) {
    return res.status(200).json({ ok: true, omitido: 'pomodoro parado o reprogramado' });
  }

  const reclamado = await reclamarAviso(refPomodoro.collection('avisos').doc(String(finEn)));
  if (!reclamado) return res.status(200).json({ ok: true, omitido: 'este aviso ya se mandó' });

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

  await refPomodoro.set(
    { fase: siguienteFase, ronda: siguienteRonda, esperando: true, finEn: null, qstashId: null },
    { merge: true },
  );
  return res.status(200).json({ ok: true, esperando: true });
}

/** Recordatorio semanal: sigue sonando cada semana hasta que se borra a mano. */
async function avisoRecordatorioSemanal(req, res) {
  const { uid, recordatorioId } = req.query ?? {};
  if (!uid || !recordatorioId) return res.status(400).json({ error: 'Faltan uid o recordatorioId.' });

  const refUsuario = admin.firestore().collection('usuarios').doc(uid);
  const refRecordatorio = refUsuario.collection('recordatorios').doc(recordatorioId);
  const snap = await refRecordatorio.get();

  if (!snap.exists || snap.data().tipo !== 'semanal') {
    return res.status(200).json({ ok: true, omitido: 'recordatorio ya no existe o ya no es semanal' });
  }

  const hoy = hoyMadrid();
  const reclamado = await reclamarAviso(refRecordatorio.collection('avisos').doc(hoy));
  if (!reclamado) return res.status(200).json({ ok: true, omitido: 'ya se avisó hoy' });

  const { enviados, fallos } = await enviarATodosLosDispositivos(refUsuario, {
    titulo: 'Recordatorio',
    cuerpo: snap.data().texto,
    tipo: 'recordatorio',
  });
  return res.status(200).json({ ok: true, enviados, fallos });
}

/** Recordatorio único: se marca hecho al sonar, no se borra solo. */
async function avisoRecordatorioUnico(req, res) {
  const { uid, recordatorioId } = req.query ?? {};
  if (!uid || !recordatorioId) return res.status(400).json({ error: 'Faltan uid o recordatorioId.' });

  const refUsuario = admin.firestore().collection('usuarios').doc(uid);
  const refRecordatorio = refUsuario.collection('recordatorios').doc(recordatorioId);
  const snap = await refRecordatorio.get();
  const recordatorio = snap.data();

  if (!snap.exists || recordatorio.tipo !== 'unico' || recordatorio.hecho) {
    return res.status(200).json({ ok: true, omitido: 'recordatorio ya no existe, ya está hecho o ya no es único' });
  }

  const reclamado = await reclamarAviso(
    refRecordatorio.collection('avisos').doc(recordatorio.recordatorioIdQstash ?? recordatorioId),
  );
  if (!reclamado) return res.status(200).json({ ok: true, omitido: 'ya se avisó de este recordatorio' });

  const { enviados, fallos } = await enviarATodosLosDispositivos(refUsuario, {
    titulo: 'Recordatorio',
    cuerpo: recordatorio.texto,
    tipo: 'recordatorio',
  });
  await refRecordatorio.set({ hecho: true }, { merge: true });
  return res.status(200).json({ ok: true, enviados, fallos });
}

const AVISOS = {
  recordatorio: avisoHabito,
  recordatorioEvento: avisoEvento,
  recordatorioPomodoro: avisoPomodoro,
  recordatorioSemanal: avisoRecordatorioSemanal,
  recordatorioUnico: avisoRecordatorioUnico,
};

/**
 * La URL exacta que QStash firmo al mandar la peticion — para reconstruirla
 * NO vale `req.url` tal cual. En una ruta dinamica como esta, Vercel cuela el
 * propio segmento (`tipo`) como query param ademas de resolverlo en el path,
 * asi que `req.url` trae `...&tipo=recordatorioSemanal` de mas. QStash firmo
 * la URL de destino que se programo (sin ese `tipo`), asi que `Receiver.verify`
 * comparaba dos URLs distintas y rechazaba la firma siempre — de ahi que
 * ningun aviso de los cinco tipos llegara a mandar nada desde que estos
 * ficheros se fusionaron en una ruta dinamica.
 */
function urlFirmada(req) {
  const { tipo, ...resto } = req.query ?? {};
  const qs = new URLSearchParams(resto).toString();
  return `${urlBase()}/api/qstash/${tipo}${qs ? `?${qs}` : ''}`;
}

export default async function handler(req, res) {
  const firma = req.headers['upstash-signature'];
  if (!firma) return res.status(401).json({ error: 'Falta la firma de QStash.' });

  try {
    const valida = await receptorQstash().verify({ signature: firma, body: '', url: urlFirmada(req) });
    if (!valida) return res.status(401).json({ error: 'Firma inválida.' });
  } catch (error) {
    console.error(`[qstash/${req.query?.tipo}] firma:`, error);
    return res.status(401).json({ error: 'No se ha podido verificar la firma.' });
  }

  const avisar = AVISOS[req.query?.tipo];
  if (!avisar) return res.status(404).json({ error: `Tipo de aviso desconocido: ${req.query?.tipo}` });

  try {
    firebaseAdmin();
    await avisar(req, res);
  } catch (error) {
    console.error(`[qstash/${req.query.tipo}]`, error);
    res.status(500).json({ error: error.message ?? 'Fallo inesperado.' });
  }
}
