/**
 * Utilidades de fecha. Todo en español y con la semana empezando en lunes,
 * que es como se lee un calendario aqui.
 *
 * Convencion del proyecto: una fecha "suelta" (sin hora) viaja siempre como
 * 'YYYY-MM-DD' y una fecha con hora como 'YYYY-MM-DDTHH:mm'. Nada de objetos
 * Date en la base de datos: son un infierno de zonas horarias, y esta app solo
 * necesita saber "el martes a las diez" en la vida del usuario, no en UTC.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Iniciales de la cabecera del calendario, ya en orden lunes-domingo. */
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function hoy() {
  return aClave(new Date());
}

/** Date -> 'YYYY-MM-DD' en hora local (nada de toISOString, que pasa por UTC). */
export function aClave(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' (o 'YYYY-MM-DDTHH:mm') -> Date local. */
export function aFecha(clave) {
  const [dia, hora] = String(clave).split('T');
  const [y, m, d] = dia.split('-').map(Number);
  if (!hora) return new Date(y, m - 1, d);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm ?? 0);
}

export function claveDe(fechaHora) {
  return String(fechaHora).slice(0, 10);
}

/** 'YYYY-MM-DDTHH:mm' -> 'HH:mm'. Devuelve null si el evento no tiene hora. */
export function horaDe(fechaHora) {
  const partes = String(fechaHora).split('T');
  return partes[1] ? partes[1].slice(0, 5) : null;
}

export function sumarDias(clave, n) {
  const f = aFecha(clave);
  f.setDate(f.getDate() + n);
  return aClave(f);
}

export function sumarMeses(clave, n) {
  const f = aFecha(clave);
  const diaOriginal = f.getDate();
  f.setDate(1);
  f.setMonth(f.getMonth() + n);
  // Si venia de un dia 31 y el mes destino no lo tiene, nos quedamos en el ultimo.
  f.setDate(Math.min(diaOriginal, diasDelMes(f.getFullYear(), f.getMonth())));
  return aClave(f);
}

export function diasDelMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

/** Indice del dia dentro de la semana con lunes = 0. */
export function indiceSemana(clave) {
  return (aFecha(clave).getDay() + 6) % 7;
}

export function lunesDe(clave) {
  return sumarDias(clave, -indiceSemana(clave));
}

/** Las siete claves de la semana a la que pertenece una fecha. */
export function semanaDe(clave) {
  const lunes = lunesDe(clave);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/**
 * Las 42 celdas de la rejilla mensual (6 semanas), incluyendo el relleno del
 * mes anterior y el siguiente. Siempre 6 filas para que la altura no salte al
 * cambiar de mes.
 */
export function rejillaMes(clave) {
  const f = aFecha(clave);
  const primero = new Date(f.getFullYear(), f.getMonth(), 1);
  const inicio = lunesDe(aClave(primero));
  return Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
}

export function mismoMes(a, b) {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function esFinDeSemana(clave) {
  return indiceSemana(clave) >= 5;
}

/* ---------------- Formato para pantalla ---------------- */

export function nombreMes(clave) {
  return MESES[aFecha(clave).getMonth()];
}

export function anioDe(clave) {
  return aFecha(clave).getFullYear();
}

export function diaDelMes(clave) {
  return aFecha(clave).getDate();
}

export function nombreDia(clave) {
  return DIAS[aFecha(clave).getDay()];
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** 'Lunes 21' */
export function tituloDia(clave) {
  return `${capitalizar(nombreDia(clave))} ${diaDelMes(clave)}`;
}

/** 'Septiembre' */
export function tituloMes(clave) {
  return capitalizar(nombreMes(clave));
}

/** '21 – 27 sep' */
export function tituloSemana(clave) {
  const dias = semanaDe(clave);
  const a = aFecha(dias[0]);
  const b = aFecha(dias[6]);
  const abrev = (f) => MESES[f.getMonth()].slice(0, 3);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${b.getDate()} ${abrev(a)}`;
  }
  return `${a.getDate()} ${abrev(a)} – ${b.getDate()} ${abrev(b)}`;
}

/** 'martes 22 de septiembre' */
export function fechaLarga(clave) {
  return `${nombreDia(clave)} ${diaDelMes(clave)} de ${nombreMes(clave)}`;
}

/** Numero de semana ISO. Sale en la cabecera de la vista semanal. */
export function semanaISO(clave) {
  const f = aFecha(clave);
  // El jueves manda: la semana ISO pertenece al anio de su jueves.
  const jueves = new Date(f.getFullYear(), f.getMonth(), f.getDate() + 3 - ((f.getDay() + 6) % 7));
  const enero = new Date(jueves.getFullYear(), 0, 1);
  return Math.ceil(((jueves - enero) / 86400000 + 1) / 7);
}

/** 'en 3 días', 'mañana', 'hoy'. Para los avisos de lo que vence. */
export function cuantoFalta(clave) {
  const dias = Math.round((aFecha(claveDe(clave)) - aFecha(hoy())) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  if (dias > 0) return `en ${dias} días`;
  return `hace ${Math.abs(dias)} días`;
}
