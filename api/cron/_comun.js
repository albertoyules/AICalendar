/**
 * Lo que comparten los dos avisos programados.
 */
import admin from 'firebase-admin';

import { firebaseAdmin } from '../_admin.js';

/** 'YYYY-MM-DD' de hoy en Madrid, sea cual sea la hora UTC en la que dispare Vercel. */
export function hoyMadrid() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
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

export function usuariosConDispositivo() {
  firebaseAdmin();
  return admin.firestore().collection('usuarios').get();
}
