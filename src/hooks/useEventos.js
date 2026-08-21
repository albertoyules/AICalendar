import { useEffect, useMemo, useState } from 'react';

import { explicarFallo, suscribirEventos } from '../services/eventosRepository';
import { claveDe } from '../lib/fechas';

/**
 * Eventos de un rango, escuchando en vivo.
 *
 * Devuelve tambien `porDia`: un indice clave -> eventos, porque tanto la vista
 * de mes como la de semana pintan celda a celda y filtrar el array entero en
 * cada una de las 42 celdas seria absurdo.
 */
export function useEventos(desde, hasta) {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(null);

  useEffect(() => {
    setCargando(true);
    setFallo(null);
    const cancelar = suscribirEventos(
      desde,
      hasta,
      (lista) => {
        setEventos(lista);
        setCargando(false);
      },
      (error) => {
        setFallo(explicarFallo(error));
        setCargando(false);
      },
    );
    return cancelar;
  }, [desde, hasta]);

  const porDia = useMemo(() => {
    const indice = {};
    for (const evento of eventos) {
      const clave = claveDe(evento.inicio);
      (indice[clave] ??= []).push(evento);
    }
    for (const clave of Object.keys(indice)) {
      indice[clave].sort((a, b) => a.inicio.localeCompare(b.inicio));
    }
    return indice;
  }, [eventos]);

  return { eventos, porDia, cargando, fallo };
}
