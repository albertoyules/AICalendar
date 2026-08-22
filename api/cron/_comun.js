/**
 * Lo que comparten los dos avisos programados.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';

/** 'YYYY-MM-DD' de hoy en Madrid, sea cual sea la hora UTC en la que dispare Vercel. */
export function hoyMadrid() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

/**
 * Cuántos minutos hay que sumarle a una hora de Madrid para tener UTC, en el
 * instante aproximado dado. Cambia con el horario de verano/invierno, por
 * eso no es una constante.
 */
function desfaseMadridMinutos(instanteAproximado) {
  const parte = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(instanteAproximado)
    .find((p) => p.type === 'timeZoneName').value; // 'GMT+2' o 'GMT+1'
  const horas = Number(parte.replace('GMT', '')) || 0;
  return horas * 60;
}

/**
 * 'YYYY-MM-DDTHH:mm' tal y como lo vive alguien en Madrid -> milisegundos
 * desde epoch, de verdad. Las fechas del calendario se guardan como hora
 * local sin zona (ver fechas.js), así que para programar algo en QStash a un
 * instante exacto hay que deshacer ese desfase primero.
 */
export function instanteMadrid(fechaHoraLocal) {
  // Primero una lectura aproximada tratando el texto como si fuera UTC: sirve
  // para saber en qué mitad del año caemos (verano/invierno) y sacar el
  // desfase real de esa fecha. El error de esta primera pasada es como mucho
  // el propio desfase (1-2h), muy lejos de una transición de horario.
  const aproximado = new Date(`${fechaHoraLocal}:00Z`);
  const desfase = desfaseMadridMinutos(aproximado);
  return aproximado.getTime() - desfase * 60_000;
}

/** Solo Vercel puede llamar a esto — ver CRON_SECRET en la guía de despliegue. */
export function autorizado(req) {
  const secreto = process.env.CRON_SECRET;
  return Boolean(secreto) && req.headers.authorization === `Bearer ${secreto}`;
}

export async function eventosDelUsuario(refUsuario, desde, hasta) {
  const snap = await refUsuario
    .collection('eventos')
    .where('inicio', '>=', desde)
    .where('inicio', '<=', `${hasta}T99:99`)
    .get();
  return snap.docs.map((d) => d.data());
}

/**
 * A quién hay que avisar: no se enumera `usuarios` directamente porque ese
 * documento nunca se crea explícitamente — solo existen sus subcolecciones
 * (`eventos`, `dispositivos`). Firestore lo enseña en la consola porque tiene
 * hijos, pero como documento en sí no existe, y una `collection('usuarios').get()`
 * no devuelve documentos fantasma: el bucle no encontraba a nadie a quien
 * avisar, sin ni un error de por medio.
 *
 * En su lugar se parte de los dispositivos — esos sí son documentos reales—
 * con una consulta de grupo de colecciones que encuentra todos los
 * `dispositivos` de cualquier usuario de una vez, y de ahí se sube al uid.
 */
export async function usuariosConDispositivo() {
  firebaseAdmin();
  const dispositivos = await admin.firestore().collectionGroup('dispositivos').get();

  const porUsuario = new Map();
  for (const d of dispositivos.docs) {
    const uid = d.ref.parent.parent.id; // .../usuarios/{uid}/dispositivos/{id}
    if (!porUsuario.has(uid)) porUsuario.set(uid, admin.firestore().collection('usuarios').doc(uid));
  }
  return [...porUsuario.values()];
}
