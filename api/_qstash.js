/**
 * Cliente de Upstash QStash, para disparar avisos a la hora exacta de cada
 * hábito — algo que un Cron de Vercel no puede hacer (solo una vez al día, a
 * una hora fija de todo el proyecto, nunca por usuario). Ver "Recordatorios
 * a hora exacta" en el README para el porqué.
 *
 * Mismo patrón perezoso que firebaseAdmin() en _admin.js: no revienta al
 * arrancar si faltan las variables, solo cuando de verdad hace falta el
 * cliente.
 */
import { Client, Receiver } from '@upstash/qstash';

let cliente = null;

export function qstash() {
  if (cliente) return cliente;

  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error(
      'Falta QSTASH_TOKEN. Cópialo de la consola de Upstash (QStash > tu proyecto) y añádelo en Vercel.',
    );
  }
  // QSTASH_URL importa de verdad: las cuentas nuevas de Upstash caen en una
  // región concreta (eu-central-1, etc.) y el token solo vale contra el
  // endpoint de esa región. Sin esto el cliente apunta al endpoint global por
  // defecto y el token da 401 aunque esté bien copiado.
  const baseUrl = process.env.QSTASH_URL;
  cliente = new Client(baseUrl ? { token, baseUrl } : { token });
  return cliente;
}

/** Verifica que un aviso entrante viene de verdad de QStash, no de cualquiera. */
export function receptorQstash() {
  const actual = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const siguiente = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!actual || !siguiente) {
    throw new Error(
      'Faltan QSTASH_CURRENT_SIGNING_KEY o QSTASH_NEXT_SIGNING_KEY. Están en la consola de Upstash, junto al token.',
    );
  }
  return new Receiver({ currentSigningKey: actual, nextSigningKey: siguiente });
}

/** La URL pública estable de la app — QStash necesita poder llamarla desde fuera. */
export function urlBase() {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error('Falta APP_URL: la URL de producción de la app (https://tu-app.vercel.app, sin barra final).');
  }
  return url.replace(/\/$/, '');
}

/** Un id determinista por hábito: crear con el mismo id sobrescribe el anterior. */
export function idScheduleHabito(uid, habitoId) {
  return `habito-${uid}-${habitoId}`;
}

/** Igual que idScheduleHabito, para los recordatorios semanales. */
export function idScheduleRecordatorio(uid, recordatorioId) {
  return `recordatorio-${uid}-${recordatorioId}`;
}

/**
 * Lunes=0...domingo=6 (convención de la app, ver indiceSemana en fechas.js)
 * -> día de semana de cron (domingo=0...sábado=6, el que espera QStash).
 */
export function diaCron(diaApp) {
  return (diaApp + 1) % 7;
}

/**
 * El plan gratuito de QStash solo admite mandar un mensaje suelto (no un
 * *schedule*) hasta 7 días vista. Se deja medio día de margen por si el cron
 * diario que reencola los recordatorios lejanos (ver api/cron/encolarRecordatorios.js)
 * tarda en pasar por uno que esté justo en el borde.
 */
export const MAX_ADELANTO_SEGUNDOS = 6.5 * 24 * 60 * 60;
