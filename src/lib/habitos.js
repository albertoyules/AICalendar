/**
 * Cálculos de hábitos: racha, meta del mes y la tira de los últimos 7 días.
 * Todo puro — sin Firestore ni React aquí, para poder probarlo a ojo.
 *
 * Las marcas viajan como { 'YYYY-MM-DD': true } en el propio documento del
 * hábito. Nada de subcolección: un año de marcas son 365 claves, no hay
 * motivo para pagar una consulta aparte por algo tan pequeño.
 */
import { diaDelMes, sumarDias } from './fechas';

/** Las 7 claves que van del día de hoy hacia atrás, en orden cronológico. */
export function tiraSemana(hoyClave) {
  return Array.from({ length: 7 }, (_, i) => sumarDias(hoyClave, i - 6));
}

/**
 * Racha actual: días consecutivos marcados, contando hacia atrás desde hoy
 * si hoy ya está marcado, o desde ayer si hoy todavía está pendiente (el día
 * no ha terminado, así que no puede romper nada todavía).
 *
 * Si ni hoy ni ayer están marcados, la racha es 0 y se considera "rota" —
 * distinto de un hábito nuevo que simplemente no ha empezado.
 */
export function calcularRacha(marcas, hoyClave) {
  let cursor = marcas[hoyClave] ? hoyClave : sumarDias(hoyClave, -1);
  let n = 0;
  while (marcas[cursor]) {
    n += 1;
    cursor = sumarDias(cursor, -1);
  }
  return n;
}

/**
 * Cuántas veces "tocaría" haber cumplido este mes, a estas alturas, según el
 * objetivo semanal. Para "todos los días" (objetivo 7) esto coincide con los
 * días transcurridos del mes; para un objetivo menor, se prorratea.
 */
export function metaMensual(objetivoSemanal, hoyClave) {
  const diasTranscurridos = diaDelMes(hoyClave);
  return Math.max(1, Math.round((diasTranscurridos / 7) * objetivoSemanal));
}

/** Cuántas marcas verdaderas caen dentro del mes de `hoyClave`. */
export function marcasDelMes(marcas, hoyClave) {
  const prefijo = hoyClave.slice(0, 7);
  return Object.entries(marcas).filter(([clave, hecho]) => hecho && clave.startsWith(prefijo)).length;
}

/** 'Todos los días' o 'Objetivo: N por semana'. */
export function textoObjetivo(objetivoSemanal) {
  return objetivoSemanal >= 7 ? 'Todos los días' : `Objetivo: ${objetivoSemanal} por semana`;
}

export function textoRacha(racha) {
  if (racha === 0) return 'racha rota';
  return racha === 1 ? 'día seguido' : 'días seguidos';
}
