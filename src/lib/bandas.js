/**
 * Geometria de las bandas de un evento de varios dias en la vista de mes
 * (el "MADRIZ" que atraviesa 28-30 en el Calendario de iPhone). Pura, sin
 * React ni Firestore, igual que fechas.js y recurrencia.js.
 *
 * La rejilla del mes son 42 celdas en 6 filas de 7 columnas (rejillaMes en
 * fechas.js). Un evento largo puede cruzar mas de una fila: aqui se corta en
 * un "segmento" por cada fila que pisa, y a cada segmento se le asigna un
 * carril (0, 1, 2...) para que dos eventos que se solapan esa semana no
 * pinten la banda encima la una de la otra.
 */
import { claveDe, diffDias } from './fechas';

/** ¿Este evento ocupa mas de un dia? Los de un solo dia siguen siendo pildoras. */
export function esMultiDia(evento) {
  return Boolean(evento?.fin) && claveDe(evento.fin) > claveDe(evento.inicio);
}

/**
 * Trocea cada evento de varios dias en segmentos por fila de la rejilla y les
 * asigna carril. Devuelve tambien cuantos carriles hace falta reservar en
 * cada una de las 6 filas, para que el hueco encima de las pildoras normales
 * sea el mismo en las 7 celdas de esa fila.
 */
export function calcularBandas(dias, eventos) {
  const inicioRejilla = dias[0];
  const finRejilla = dias[dias.length - 1];

  const segmentos = [];
  for (const evento of eventos) {
    const claveInicioReal = claveDe(evento.inicio);
    const claveFinReal = claveDe(evento.fin);
    const claveInicio = claveInicioReal < inicioRejilla ? inicioRejilla : claveInicioReal;
    const claveFin = claveFinReal > finRejilla ? finRejilla : claveFinReal;
    if (claveFin < claveInicio) continue;

    let idx = diffDias(inicioRejilla, claveInicio);
    const idxFin = diffDias(inicioRejilla, claveFin);
    while (idx <= idxFin) {
      const fila = Math.floor(idx / 7);
      const finDeFila = fila * 7 + 6;
      const finSegmento = Math.min(idxFin, finDeFila);
      segmentos.push({
        evento,
        fila,
        colInicio: idx % 7,
        colSpan: finSegmento - idx + 1,
        // Redondeamos la punta solo si el segmento toca de verdad el
        // principio/fin del evento, no un corte por salto de semana.
        puntaIzquierda: idx === diffDias(inicioRejilla, claveInicioReal),
        puntaDerecha: finSegmento === diffDias(inicioRejilla, claveFinReal),
      });
      idx = finSegmento + 1;
    }
  }

  // Un mismo evento intenta conservar su carril semana a semana; si esa
  // semana ya esta ocupado, coge el primero libre (barrido simple, no hace
  // falta nada mas fino con el puñado de eventos largos que tendra un mes).
  const carrilPorEvento = new Map();
  const ocupadoPorFila = Array.from({ length: 6 }, () => []);
  const bandas = [];

  for (const seg of segmentos.sort((a, b) => a.fila - b.fila || a.colInicio - b.colInicio)) {
    const colFin = seg.colInicio + seg.colSpan - 1;
    const ocupados = ocupadoPorFila[seg.fila];
    const libre = (c) => ocupados[c] === undefined || ocupados[c] < seg.colInicio;

    let carril = carrilPorEvento.get(seg.evento.id);
    if (carril === undefined || !libre(carril)) {
      carril = 0;
      while (!libre(carril)) carril++;
      carrilPorEvento.set(seg.evento.id, carril);
    }
    ocupados[carril] = colFin;
    bandas.push({ ...seg, carril });
  }

  const carrilesPorFila = ocupadoPorFila.map((ocupados) => ocupados.length);

  return { bandas, carrilesPorFila };
}
