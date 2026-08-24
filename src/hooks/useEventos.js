import { useEffect, useMemo, useState } from 'react';

import { explicarFallo, suscribirEventos } from '../services/eventosRepository';
import { claveDe, diffDias, sumarDias } from '../lib/fechas';

/**
 * Eventos de un rango, escuchando en vivo.
 *
 * Devuelve tambien `porDia`: un indice clave -> eventos, porque tanto la vista
 * de mes como la de semana pintan celda a celda y filtrar el array entero en
 * cada una de las 42 celdas seria absurdo.
 *
 * `listo` existe por una carrera real: los hooks de React se llaman siempre,
 * pase lo que pase, así que sin esto la primera suscripción arrancaba antes
 * de saber si hay sesión — y como establecerUsuario() aún no había corrido,
 * se enganchaba a localStorage en vez de a Firestore. Cambiar de mes lo
 * "arreglaba" solo porque eso sí dispara una resuscripción; nada más lo
 * hacía. Con `listo=false` no se suscribe todavía, y en cuanto App.jsx sabe
 * si hay sesión (usuarioActual ya fijado) pasa a true y se suscribe bien.
 */
export function useEventos(desde, hasta, listo = true) {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(null);

  useEffect(() => {
    if (!listo) return undefined;
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
  }, [desde, hasta, listo]);

  const porDia = useMemo(() => {
    const indice = {};
    for (const evento of eventos) {
      const claveInicio = claveDe(evento.inicio);
      const claveFin = evento.fin ? claveDe(evento.fin) : claveInicio;
      // Un evento de varios dias (fin en un dia posterior al de inicio) se
      // apunta en el indice de cada dia que ocupa, no solo el primero: es lo
      // que hace que la agenda de un dia suelto (o la vista semana) lo
      // muestre aunque sea, por ejemplo, el segundo dia de un viaje de tres.
      // VistaMes las saca de aqui igual, pero las pinta como banda en vez de
      // repetir la pildora en cada celda — ver esMultiDia() ahi.
      const dias = claveFin > claveInicio ? diffDias(claveInicio, claveFin) : 0;
      for (let i = 0; i <= dias; i++) {
        const clave = i === 0 ? claveInicio : sumarDias(claveInicio, i);
        (indice[clave] ??= []).push(evento);
      }
    }
    for (const clave of Object.keys(indice)) {
      indice[clave].sort((a, b) => a.inicio.localeCompare(b.inicio));
    }
    return indice;
  }, [eventos]);

  return { eventos, porDia, cargando, fallo };
}
