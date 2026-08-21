import { aFecha, indiceSemana, sumarDias } from './fechas.js';

/**
 * Genera las fechas de una serie repetida.
 *
 * Nada de repetir para siempre: eso son escrituras infinitas. Se limita a un
 * horizonte de 6 meses vista, que para una agenda personal es de sobra —
 * pasado ese punto, se vuelve a pedir. Si el usuario da una fecha de fin más
 * cercana, se respeta esa.
 */
const HORIZONTE_DIAS = 180;
const TOPE_OCURRENCIAS = 200; // cinturón y tirantes: un writeBatch aguanta 500

export function fechasDeSerie({ frecuencia, dias, inicio, hasta }) {
  const limite = hasta ? aFecha(hasta) : sumarDias(inicio, HORIZONTE_DIAS);
  const limiteFecha = typeof limite === 'string' ? aFecha(limite) : limite;

  // 'semanal' sin dias explícitos: se repite el mismo día de la semana que
  // el de la fecha de inicio. Es el caso normal ("cada martes").
  const diasSemana =
    frecuencia === 'semanal' ? (dias?.length ? dias : [indiceSemana(inicio)]) : null;

  const resultado = [];
  let clave = inicio;
  while (aFecha(clave) <= limiteFecha && resultado.length < TOPE_OCURRENCIAS) {
    if (frecuencia === 'diaria' || diasSemana.includes(indiceSemana(clave))) {
      resultado.push(clave);
    }
    clave = sumarDias(clave, 1);
  }
  return resultado;
}
